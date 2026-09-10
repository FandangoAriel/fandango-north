import { JWT } from "google-auth-library";
import type {
  EquipmentItem,
  Farm,
  FarmId,
  LabeledContainer,
  LoadItem,
  LoadMark,
  LoadRecord,
  StockUpdate,
} from "./types";
import {
  FARM_SHEETS,
  completeFromRow,
  farmLoadItems,
  isSuppliedFlag,
  previousLoadMap,
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
  for (let i = meta.startRow - 1; i < rows.length; i += 1) {
    const name = rows[i]?.[0]?.trim();
    if (name) {
      const actual = parseNumber(rows[i]?.[1]);
      const maxStock = parseNumber(rows[i]?.[2]);
      equipment.push({
        id: `${farmId}-${i}`,
        name,
        actual,
        maxStock,
        toComplete: completeFromRow(rows[i], actual, maxStock),
      });
    }
    const customerName = rows[i]?.[meta.container.customerName]?.trim() ?? "";
    const containerType = rows[i]?.[meta.container.type]?.trim() ?? "";
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
  return { id: farmId, name: meta.name, updatedAt, equipment, containers };
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
      ],
    ]);
  } catch {
    // tab may not exist yet
  }
  return googleGetFarm(farmId);
}

function parseMarksCell(value: string | undefined): Map<string, LoadItem> {
  if (!value) return new Map();
  try {
    const parsed = JSON.parse(value) as {
      itemId?: string;
      name?: string;
      mark?: LoadMark;
      haveQty?: number | null;
    }[];
    const items: LoadItem[] = parsed.map((row) => ({
      itemId: row.itemId || row.name || "",
      kind: "stock",
      name: row.name || row.itemId || "",
      toSupply: 0,
      mark: row.mark ?? "unset",
      haveQty: row.haveQty ?? null,
    }));
    return previousLoadMap(items);
  } catch {
    const names = String(value)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const items: LoadItem[] = names.map((name) => ({
      itemId: name,
      kind: "stock",
      name,
      toSupply: 0,
      mark: "full",
      haveQty: null,
    }));
    return previousLoadMap(items);
  }
}

export async function googleGetLoad(farmId: FarmId): Promise<LoadItem[]> {
  const farm = await googleGetFarm(farmId);
  let previous = new Map<string, LoadItem>();
  try {
    const log = await sheetsGet("העמסות!A2:H200");
    const rows = (log.values ?? []).reverse();
    const latest = rows.find((row) => row[2] === farmId || row[2] === FARM_SHEETS[farmId].name);
    if (latest?.[7]) previous = parseMarksCell(latest[7]);
    else if (latest?.[5]) previous = parseMarksCell(latest[5]);
  } catch {
    // tab may not exist yet
  }
  return farmLoadItems(farm, previous);
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
