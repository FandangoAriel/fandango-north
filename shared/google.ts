import { JWT } from "google-auth-library";
import type {
  EquipmentItem,
  Farm,
  FarmId,
  LabeledContainer,
  LoadItem,
  LoadMark,
  LoadRecord,
  ReportRecord,
  StockUpdate,
} from "./types";
import {
  FARM_SHEETS,
  applyItemOrder,
  completeFromRow,
  farmLoadItems,
  isSuppliedFlag,
  todayIso,
} from "./types";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!raw || !spreadsheetId) return null;
  try {
    return { keys: JSON.parse(raw) as { client_email: string; private_key: string }, spreadsheetId };
  } catch {
    return null;
  }
}

export function googleConfigured() {
  return credentials() !== null;
}

async function accessToken() {
  const creds = credentials();
  if (!creds) throw new Error("google_not_configured");
  const client = new JWT({
    email: creds.keys.client_email,
    key: creds.keys.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const tokens = await client.authorize();
  if (!tokens.access_token) throw new Error("google_auth_failed");
  return { token: tokens.access_token, spreadsheetId: creds.spreadsheetId };
}

async function sheetsGet(range: string) {
  const { token, spreadsheetId } = await accessToken();
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`sheets_get_${res.status}`);
  return (await res.json()) as { values?: string[][] };
}

async function sheetsUpdate(range: string, values: (string | number)[][]) {
  const { token, spreadsheetId } = await accessToken();
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ range, values }),
  });
  if (!res.ok) throw new Error(`sheets_update_${res.status}`);
}

async function sheetsAppend(range: string, values: (string | number)[][]) {
  const { token, spreadsheetId } = await accessToken();
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`sheets_append_${res.status}`);
}

function parseNumber(value: string | undefined) {
  const n = Number(String(value ?? "").replace(",", ""));
  return Number.isFinite(n) ? n : 0;
}

export async function googleListUsers(): Promise<string[]> {
  const data = await sheetsGet("משתמשים!A2:A11");
  return (data.values ?? []).map((row) => row[0]?.trim()).filter(Boolean).slice(0, 10);
}

function uniqueEquipmentId(farmId: FarmId, name: string, used: Set<string>) {
  let id = `${farmId}:${name}`;
  let n = 2;
  while (used.has(id)) {
    id = `${farmId}:${name}:${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

async function googleGetOrder(farmId: FarmId): Promise<string[]> {
  try {
    const data = await sheetsGet("סדר!A1:B30");
    const row = (data.values ?? []).find((item) => item[0] === farmId);
    if (!row?.[1]) return [];
    const parsed = JSON.parse(row[1]) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function googleSaveOrder(farmId: FarmId, itemIds: string[]) {
  const farm = await googleGetFarm(farmId);
  const names = itemIds
    .map((id) => farm.equipment.find((item) => item.id === id)?.name ?? id)
    .filter(Boolean);
  let rows: string[][] = [];
  try {
    rows = (await sheetsGet("סדר!A1:B30")).values ?? [];
  } catch {
    rows = [];
  }
  const index = rows.findIndex((row) => row[0] === farmId);
  const payload = [farmId, JSON.stringify(names)];
  if (index >= 0) {
    await sheetsUpdate(`סדר!A${index + 1}:B${index + 1}`, [payload]);
  } else {
    await sheetsAppend("סדר!A1", [payload]);
  }
  return googleGetFarm(farmId);
}

export async function googleGetFarm(farmId: FarmId): Promise<Farm> {
  const meta = FARM_SHEETS[farmId];
  const data = await sheetsGet(`'${meta.sheet}'!A1:M80`);
  const rows = data.values ?? [];
  const updatedRaw = rows[0]?.[2] ?? todayIso();
  let updatedAt = todayIso();
  if (updatedRaw) {
    const parsed = new Date(updatedRaw);
    if (!Number.isNaN(parsed.getTime())) {
      updatedAt = parsed.toISOString().slice(0, 10);
    }
  }
  const equipment: EquipmentItem[] = [];
  const containers: LabeledContainer[] = [];
  const usedIds = new Set<string>();
  for (let i = meta.startRow - 1; i < rows.length; i += 1) {
    const name = rows[i]?.[0]?.trim();
    if (name) {
      const actual = parseNumber(rows[i]?.[1]);
      const maxStock = parseNumber(rows[i]?.[2]);
      equipment.push({
        id: uniqueEquipmentId(farmId, name, usedIds),
        name,
        actual,
        maxStock,
        toComplete: completeFromRow(rows[i], actual, maxStock),
      });
    }
    const customerName = rows[i]?.[meta.container.customerName]?.trim() ?? "";
    const fromTypeCol = rows[i]?.[meta.container.type]?.trim() ?? "";
    const fromColJ = rows[i]?.[9]?.trim() ?? "";
    const containerType =
      (fromTypeCol && fromTypeCol !== customerName ? fromTypeCol : "") ||
      (fromColJ && fromColJ !== customerName ? fromColJ : "") ||
      fromTypeCol;
    if (customerName || containerType) {
      containers.push({
        id: `${farmId}-c-${i}`,
        customerId: rows[i]?.[meta.container.customerId]?.trim() ?? "",
        customerName,
        containerType,
        supplied: isSuppliedFlag(rows[i]?.[meta.container.supplied]),
      });
    }
  }
  const itemOrder = await googleGetOrder(farmId);
  return {
    id: farmId,
    name: meta.name,
    updatedAt,
    equipment: applyItemOrder(equipment, itemOrder),
    containers,
    itemOrder,
  };
}

export async function googleReportStock(
  farmId: FarmId,
  updates: StockUpdate[],
  user = "",
  note = "",
) {
  const farm = await googleGetFarm(farmId);
  const meta = FARM_SHEETS[farmId];
  const data = await sheetsGet(`'${meta.sheet}'!A${meta.startRow}:C80`);
  const rows = data.values ?? [];
  const byName = new Map<string, StockUpdate>();
  for (const item of updates) {
    const found = farm.equipment.find((row) => row.id === item.id);
    byName.set(item.name || found?.name || item.id, item);
  }
  for (let i = 0; i < rows.length; i += 1) {
    const name = rows[i]?.[0]?.trim();
    if (!name || !byName.has(name)) continue;
    const update = byName.get(name);
    if (!update) continue;
    const rowNumber = meta.startRow + i;
    if (update.actual !== undefined && update.maxStock !== undefined) {
      await sheetsUpdate(`'${meta.sheet}'!B${rowNumber}:C${rowNumber}`, [[update.actual, update.maxStock]]);
    } else if (update.actual !== undefined) {
      await sheetsUpdate(`'${meta.sheet}'!B${rowNumber}`, [[update.actual]]);
    } else if (update.maxStock !== undefined) {
      await sheetsUpdate(`'${meta.sheet}'!C${rowNumber}`, [[update.maxStock]]);
    }
  }
  await sheetsUpdate(`'${meta.sheet}'!C1`, [[todayIso()]]);
  try {
    await sheetsAppend("דיווחים!A1", [
      [
        new Date().toISOString(),
        user,
        FARM_SHEETS[farmId].name,
        farmId,
        note,
        updates
          .map((item) => {
            const parts = [item.name || item.id];
            if (item.actual !== undefined) parts.push(`יש ${item.actual}`);
            if (item.maxStock !== undefined) parts.push(`מקס ${item.maxStock}`);
            return parts.join(" ");
          })
          .join("; "),
        JSON.stringify(updates),
      ],
    ]);
  } catch {
    // tab may not exist yet
  }
  return googleGetFarm(farmId);
}

export async function googleListReports(farmId: FarmId): Promise<ReportRecord[]> {
  try {
    const data = await sheetsGet("דיווחים!A2:G200");
    const farmName = FARM_SHEETS[farmId].name;
    return (data.values ?? [])
      .filter((row) => row[3] === farmId || row[2] === farmName)
      .map((row, index) => {
        let items: StockUpdate[] = [];
        try {
          const parsed = JSON.parse(row[6] || "[]") as StockUpdate[];
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          items = [];
        }
        return {
          id: `${farmId}-report-${index}-${row[0] ?? ""}`,
          at: row[0] || "",
          user: row[1] || "",
          farmId,
          note: row[4] || undefined,
          items,
        };
      })
      .reverse()
      .slice(0, 20);
  } catch {
    return [];
  }
}

export async function googleGetLoad(farmId: FarmId): Promise<LoadItem[]> {
  const farm = await googleGetFarm(farmId);
  return farmLoadItems(farm);
}

export async function googleSaveLoad(
  farmId: FarmId,
  user: string,
  itemsPayload: { itemId: string; mark?: LoadMark; haveQty?: number | null }[],
  note = "",
): Promise<LoadRecord> {
  const items = await googleGetLoad(farmId);
  const byId = new Map(itemsPayload.map((item) => [item.itemId, item]));
  const nextItems = items.map((item) => {
    const update = byId.get(item.itemId);
    if (!update) return item;
    return {
      ...item,
      mark: update.mark ?? "unset",
      haveQty: update.haveQty ?? null,
    };
  });
  const marked = nextItems.filter((item) => item.mark !== "unset");
  const record: LoadRecord = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    user,
    farmId,
    note: note.trim() || undefined,
    items: nextItems,
  };
  await sheetsAppend("העמסות!A1", [
    [
      record.at,
      user,
      FARM_SHEETS[farmId].name,
      farmId,
      marked.length,
      marked.map((item) => item.name).join(", "),
      note,
      JSON.stringify(
        nextItems.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          mark: item.mark,
          haveQty: item.haveQty ?? null,
        })),
      ),
    ],
  ]);
  return record;
}
