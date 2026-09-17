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
  DirtyMedia,
} from "./types";
import { FARM_SHEETS, applyItemOrder, farmLoadItems, todayIso } from "./types";
import { parseFarmSheet } from "./sheet-layout";

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
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
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

const REPORTS_HEADER = [
  "תאריך",
  "משתמש",
  "חווה",
  "מזהה",
  "הערה",
  "סיכום",
  "JSON",
  "סוג",
  "ע״י המעמיס",
  "ציוד מלוכלך",
];

async function googleUploadMedia(name: string, mime: string, bytes: Buffer) {
  const { token } = await accessToken();
  const boundary = "fandango_media";
  const meta = JSON.stringify({ name, mimeType: mime });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const created = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!created.ok) return undefined;
  const file = (await created.json()) as { id?: string; webViewLink?: string; webContentLink?: string };
  if (!file.id) return undefined;
  await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  }).catch(() => undefined);
  if (file.id) return `https://drive.google.com/uc?id=${file.id}&export=view`;
  return file.webContentLink || file.webViewLink;
}

export async function googleSaveDirtyMedia(
  items: { id: string; kind: "image" | "video"; name: string; mime: string; data?: string; url?: string }[],
): Promise<DirtyMedia[]> {
  const saved: DirtyMedia[] = [];
  for (const item of items) {
    if (item.url && !item.data) {
      saved.push({ id: item.id, kind: item.kind, name: item.name, mime: item.mime, url: item.url });
      continue;
    }
    if (!item.data) continue;
    const bytes = Buffer.from(item.data, "base64");
    let url: string | undefined;
    try {
      url = await googleUploadMedia(item.name || `${item.kind}-${item.id}`, item.mime, bytes);
    } catch {
      url = undefined;
    }
    if (!url) continue;
    saved.push({ id: item.id, kind: item.kind, name: item.name, mime: item.mime, url });
  }
  return saved;
}

async function appendReportsLog(row: (string | number)[]) {
  try {
    const existing = await sheetsGet("דיווחים!A1:J1");
    const first = existing.values?.[0]?.[0]?.trim() ?? "";
    if (!first) {
      await sheetsUpdate("דיווחים!A1:J1", [REPORTS_HEADER]);
    }
  } catch {
    try {
      await sheetsUpdate("דיווחים!A1:J1", [REPORTS_HEADER]);
    } catch {
      // tab may not exist
    }
  }
  await sheetsAppend("דיווחים!A1", [row]);
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
  const data = await sheetsGet(`'${meta.sheet}'!A1:P200`);
  const parsed = parseFarmSheet(farmId, data.values ?? []);
  const usedIds = new Set<string>();
  const equipment: EquipmentItem[] = parsed.equipment.map((item) => ({
    ...item,
    id: uniqueEquipmentId(farmId, item.name, usedIds),
  }));
  const containers: LabeledContainer[] = parsed.containers.map((item, index) => ({
    ...item,
    id: `${farmId}-c-${index}`,
  }));
  const itemOrder = await googleGetOrder(farmId);
  return {
    id: farmId,
    name: meta.name,
    updatedAt: parsed.updatedAt,
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
  dirtyMedia: DirtyMedia[] = [],
) {
  const farm = await googleGetFarm(farmId);
  const meta = FARM_SHEETS[farmId];
  const data = await sheetsGet(`'${meta.sheet}'!A${meta.startRow}:C200`);
  const rows = data.values ?? [];
  const byName = new Map<string, StockUpdate>();
  for (const item of updates) {
    const found = farm.equipment.find((row) => row.id === item.id);
    const name = (item.name || found?.name || "").trim();
    if (name) byName.set(name, item);
  }
  const existingNames = new Set<string>();
  let lastNamed = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const name = rows[i]?.[0]?.trim();
    if (!name) continue;
    existingNames.add(name);
    lastNamed = i;
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
  const added: (string | number)[][] = [];
  for (const item of updates) {
    const found = farm.equipment.find((row) => row.id === item.id);
    const name = (item.name || found?.name || "").trim();
    if (!name || existingNames.has(name)) continue;
    if (!item.isNew && found) continue;
    existingNames.add(name);
    added.push([name, item.actual ?? 0, item.maxStock ?? item.actual ?? 0]);
  }
  if (added.length) {
    const start = meta.startRow + lastNamed + 1;
    await sheetsUpdate(`'${meta.sheet}'!A${start}:C${start + added.length - 1}`, added);
  }
  await sheetsUpdate(`'${meta.sheet}'!C1`, [[todayIso()]]);
  try {
    await appendReportsLog([
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
      "דיווח",
      "",
      dirtyMedia.length ? JSON.stringify(dirtyMedia) : "",
    ]);
  } catch {
    // tab may not exist yet
  }
  return googleGetFarm(farmId);
}

export async function googleListReports(farmId: FarmId): Promise<ReportRecord[]> {
  try {
    const data = await sheetsGet("דיווחים!A2:J200");
    const farmName = FARM_SHEETS[farmId].name;
    return (data.values ?? [])
      .filter((row) => row[3] === farmId || row[2] === farmName)
      .filter((row) => row[7] !== "העמסה")
      .map((row, index) => {
        let items: StockUpdate[] = [];
        try {
          const parsed = JSON.parse(row[6] || "[]") as StockUpdate[];
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          items = [];
        }
        let dirtyMedia: DirtyMedia[] | undefined;
        try {
          const parsed = JSON.parse(row[9] || "[]") as DirtyMedia[];
          if (Array.isArray(parsed) && parsed.length) dirtyMedia = parsed;
        } catch {
          dirtyMedia = undefined;
        }
        return {
          id: `${farmId}-report-${index}-${row[0] ?? ""}`,
          at: row[0] || "",
          user: row[1] || "",
          farmId,
          note: row[4] || undefined,
          items,
          dirtyMedia,
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
  byLoader = false,
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
    byLoader,
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
      byLoader ? "כן" : "",
    ],
  ]);
  try {
    await appendReportsLog([
      record.at,
      user,
      FARM_SHEETS[farmId].name,
      farmId,
      note,
      nextItems
        .map((item) => {
          const label = item.detail ? `${item.name} ${item.detail}` : item.name;
          if (item.kind === "container") {
            return `${label} ${item.mark}`;
          }
          return `${label} צריך ${item.toSupply} הועמס ${item.mark === "full" ? item.toSupply : item.mark === "partial" ? (item.haveQty ?? 0) : item.mark === "none" ? 0 : "לא סומן"}`;
        })
        .join("; "),
      JSON.stringify(
        nextItems.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          detail: item.detail,
          mark: item.mark,
          haveQty: item.haveQty ?? null,
          toSupply: item.toSupply,
        })),
      ),
      "העמסה",
      byLoader ? "כן" : "לא",
    ]);
  } catch {
    // דיווחים tab may not exist yet
  }
  return record;
}
