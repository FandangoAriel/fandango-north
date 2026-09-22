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
import { FARM_SHEETS, applyItemOrder, driveFileId, farmLoadItems, todayIso } from "./types";
import {
  columnA1,
  lastEquipmentRowIndex,
  newEquipmentRowValues,
  nextEquipmentSerial,
  parseFarmSheet,
  type DetectedLayout,
  type SheetRow,
} from "./sheet-layout";
import { canStoreMediaInSheet, mediaApiUrl } from "./sheet-media";

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

async function sheetsUpdate(
  range: string,
  values: (string | number)[][],
  valueInputOption: "USER_ENTERED" | "RAW" = "USER_ENTERED",
) {
  const { token, spreadsheetId } = await accessToken();
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`;
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

async function sheetsAppend(
  range: string,
  values: (string | number)[][],
  valueInputOption: "USER_ENTERED" | "RAW" = "USER_ENTERED",
) {
  const { token, spreadsheetId } = await accessToken();
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`;
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

async function sheetsBatchUpdate(requests: unknown[]) {
  if (!requests.length) return;
  const { token, spreadsheetId } = await accessToken();
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`sheets_batch_${res.status}`);
}

function quoteSheet(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export function reportSheetTitle(farmName: string, at = new Date()) {
  const day = String(at.getDate()).padStart(2, "0");
  const month = String(at.getMonth() + 1).padStart(2, "0");
  return `${farmName} ${day}-${month}-${at.getFullYear()}`;
}

async function listSheets() {
  const { token, spreadsheetId } = await accessToken();
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`sheets_meta_${res.status}`);
  const data = (await res.json()) as { sheets?: { properties?: { sheetId?: number; title?: string } }[] };
  return (data.sheets ?? [])
    .map((sheet) => ({
      sheetId: sheet.properties?.sheetId ?? -1,
      title: sheet.properties?.title ?? "",
    }))
    .filter((sheet) => sheet.title && sheet.sheetId >= 0);
}

async function listSheetTitles() {
  return (await listSheets()).map((sheet) => sheet.title);
}

async function sheetIdByTitle(title: string) {
  const sheets = await listSheets();
  return sheets.find((sheet) => sheet.title === title)?.sheetId;
}

async function ensureSheet(title: string) {
  const titles = await listSheetTitles();
  if (titles.includes(title)) return;
  const { token, spreadsheetId } = await accessToken();
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title, rightToLeft: true } } }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && /already exists/i.test(text)) return;
    throw new Error(`sheets_add_${res.status}`);
  }
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
  if (file.id) return `https://drive.google.com/file/d/${file.id}/view`;
  return file.webContentLink || file.webViewLink;
}

const MEDIA_SHEET = "מדיה";
const MEDIA_HEADER = ["מזהה", "סוג", "שם", "MIME", "תאריך", "Drive", "נתונים"];

async function ensureMediaSheet() {
  await ensureSheet(MEDIA_SHEET);
  try {
    const existing = await sheetsGet(`${MEDIA_SHEET}!A1:G1`);
    const first = existing.values?.[0]?.[0]?.trim() ?? "";
    if (!first) await sheetsUpdate(`${MEDIA_SHEET}!A1:G1`, [MEDIA_HEADER]);
  } catch {
    await sheetsUpdate(`${MEDIA_SHEET}!A1:G1`, [MEDIA_HEADER]);
  }
}

type SheetMediaRow = {
  id: string;
  kind: "image" | "video";
  name: string;
  mime: string;
  driveUrl?: string;
  data?: string;
};

async function writeSheetMedia(item: SheetMediaRow) {
  await ensureMediaSheet();
  const data = canStoreMediaInSheet(item.data) ? item.data : "";
  let rows: string[][] = [];
  try {
    rows = (await sheetsGet(`${MEDIA_SHEET}!A2:G500`)).values ?? [];
  } catch {
    rows = [];
  }
  const index = rows.findIndex((row) => row[0] === item.id);
  const payload: (string | number)[] = [
    item.id,
    item.kind,
    item.name,
    item.mime,
    new Date().toISOString(),
    item.driveUrl ?? "",
    data,
  ];
  if (index >= 0) {
    await sheetsUpdate(`${MEDIA_SHEET}!A${index + 2}:G${index + 2}`, [payload], "RAW");
  } else {
    await sheetsAppend(`${MEDIA_SHEET}!A1`, [payload], "RAW");
  }
}

async function readSheetMedia(id: string): Promise<{ mime: string; data: Buffer; driveUrl?: string } | null> {
  if (!id) return null;
  try {
    const rows = (await sheetsGet(`${MEDIA_SHEET}!A2:G500`)).values ?? [];
    const row = rows.find((item) => item[0] === id);
    if (!row) return null;
    const mime = row[3] || "application/octet-stream";
    const driveUrl = row[5]?.trim() || undefined;
    const data = row[6]?.trim();
    if (data) return { mime, data: Buffer.from(data, "base64"), driveUrl };
    return { mime, data: Buffer.alloc(0), driveUrl };
  } catch {
    return null;
  }
}

export async function googleGetMediaFile(id: string): Promise<{ mime: string; data: Buffer } | null> {
  if (!id) return null;
  const fromSheet = await readSheetMedia(id);
  if (fromSheet?.data.length) return { mime: fromSheet.mime, data: fromSheet.data };
  const driveId = fromSheet?.driveUrl ? driveFileId(fromSheet.driveUrl) : undefined;
  const fileId = driveId || id;
  const { token } = await accessToken();
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,mimeType`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json()) as { mimeType?: string };
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = Buffer.from(await res.arrayBuffer());
  if (!data.length) return null;
  return { mime: meta.mimeType || fromSheet?.mime || "application/octet-stream", data };
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
    const fitsSheet = canStoreMediaInSheet(item.data);
    let driveUrl: string | undefined;
    if (!fitsSheet) {
      try {
        driveUrl = await googleUploadMedia(item.name || `${item.kind}-${item.id}`, item.mime, bytes);
      } catch {
        driveUrl = undefined;
      }
    }
    const payload = {
      id: item.id,
      kind: item.kind,
      name: item.name,
      mime: item.mime,
      driveUrl,
      data: item.data,
    };
    let stored = false;
    try {
      await writeSheetMedia(payload);
      stored = true;
    } catch {
      if (!driveUrl) {
        try {
          driveUrl = await googleUploadMedia(item.name || `${item.kind}-${item.id}`, item.mime, bytes);
        } catch {
          driveUrl = undefined;
        }
      }
      if (driveUrl) {
        try {
          await writeSheetMedia({ ...payload, driveUrl, data: fitsSheet ? item.data : undefined });
          stored = true;
        } catch {
          stored = false;
        }
      }
    }
    saved.push({
      id: item.id,
      kind: item.kind,
      name: item.name,
      mime: item.mime,
      url: driveUrl && !stored ? driveUrl : mediaApiUrl(item.id),
    });
    saved.push({
      id: item.id,
      kind: item.kind,
      name: item.name,
      mime: item.mime,
      url: mediaApiUrl(item.id),
    });
  }
  return saved;
}

async function appendReportsLog(row: (string | number)[]) {
  await ensureSheet("דיווחים");
  try {
    const existing = await sheetsGet("דיווחים!A1:J1");
    const first = existing.values?.[0]?.[0]?.trim() ?? "";
    if (!first) {
      await sheetsUpdate("דיווחים!A1:J1", [REPORTS_HEADER]);
    }
  } catch {
    await sheetsUpdate("דיווחים!A1:J1", [REPORTS_HEADER]);
  }
  await sheetsAppend("דיווחים!A1", [row]);
}

async function writeDailyReport(
  farm: Farm,
  farmId: FarmId,
  updates: StockUpdate[],
  user: string,
  note: string,
  dirtyMedia: DirtyMedia[],
  at: Date,
) {
  const farmName = FARM_SHEETS[farmId].name;
  const title = reportSheetTitle(farmName, at);
  await ensureSheet(title);
  const quoted = quoteSheet(title);
  let last = 0;
  try {
    const colA = await sheetsGet(`${quoted}!A:A`);
    last = colA.values?.length ?? 0;
  } catch {
    last = 0;
  }
  const start = last ? last + 2 : 1;
  const byId = new Map(updates.map((item) => [item.id, item]));
  const byName = new Map(updates.map((item) => [(item.name ?? "").trim(), item]));
  const seen = new Set<string>();
  const table: (string | number)[][] = [];
  for (const item of farm.equipment) {
    const update = byId.get(item.id) ?? byName.get(item.name);
    seen.add(item.name);
    table.push([
      item.name,
      update?.actual === undefined ? "" : update.actual,
      update?.maxStock === undefined ? item.maxStock : update.maxStock,
    ]);
  }
  for (const update of updates) {
    const name = (update.name ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    table.push([name, update.actual ?? "", update.maxStock ?? update.actual ?? ""]);
  }
  const time = at.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const mediaLinks = dirtyMedia.map((item) => item.url).filter(Boolean).join(" ");
  const block: (string | number)[][] = [
    ["דיווח מלאי", farmName, time, user],
    ["הערה", note],
    ["ציוד מלוכלך", mediaLinks],
    ...dirtyMedia.map((item) => [item.kind === "video" ? "סרטון" : "תמונה", item.url]),
    ["פריט", "מלאי קיים", "מקס"],
    ...table,
  ];
  await sheetsUpdate(`${quoted}!A${start}`, block);
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

async function appendEquipmentRow(
  sheetTitle: string,
  layout: DetectedLayout,
  lastIndex: number,
  item: { name: string; actual: number; maxStock: number; serial?: number; template?: SheetRow },
) {
  const values = newEquipmentRowValues(layout, item, item.template);
  const nextRow0 = lastIndex + 1;
  const nextRow = nextRow0 + 1;
  const endCol = columnA1(Math.max(0, values.length - 1));
  try {
    const sheetId = await sheetIdByTitle(sheetTitle);
    if (sheetId != null) {
      await sheetsBatchUpdate([
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: nextRow0,
              endIndex: nextRow0 + 1,
            },
            inheritFromBefore: true,
          },
        },
      ]);
    }
  } catch {
    // write values even if insert/format copy is blocked
  }
  await sheetsUpdate(`'${sheetTitle}'!A${nextRow}:${endCol}${nextRow}`, [values]);
  return nextRow;
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
  const data = await sheetsGet(`'${meta.sheet}'!A1:P200`);
  const rows = data.values ?? [];
  const layout = parseFarmSheet(farmId, rows).layout;
  const byName = new Map<string, StockUpdate>();
  for (const item of updates) {
    const found = farm.equipment.find((row) => row.id === item.id);
    const name = (item.name || found?.name || "").trim();
    if (name) byName.set(name, item);
  }
  const rowByName = new Map<string, number>();
  for (let i = layout.headerRow + 1; i < rows.length; i += 1) {
    const name = String(rows[i]?.[layout.nameCol] ?? "").trim();
    if (!name) continue;
    if (!rowByName.has(name)) rowByName.set(name, i + 1);
  }
  for (const [name, update] of byName) {
    const rowNumber = rowByName.get(name);
    if (!rowNumber) continue;
    const current = farm.equipment.find((item) => item.name === name);
    const actual = update.actual ?? current?.actual;
    const maxStock = update.maxStock ?? current?.maxStock;
    if (update.actual !== undefined) {
      await sheetsUpdate(`'${meta.sheet}'!${columnA1(layout.actualCol)}${rowNumber}`, [[update.actual]]);
    }
    if (update.maxStock !== undefined) {
      await sheetsUpdate(`'${meta.sheet}'!${columnA1(layout.maxCol)}${rowNumber}`, [[update.maxStock]]);
    }
    if (actual !== undefined && maxStock !== undefined && actual > maxStock) {
      await sheetsUpdate(`'${meta.sheet}'!${columnA1(layout.completeCol)}${rowNumber}`, [[0]]);
    }
  }
  let nextSerial = nextEquipmentSerial(rows, layout);
  let lastIndex = lastEquipmentRowIndex(rows, layout, meta.name);
  for (const item of updates) {
    const found = farm.equipment.find((row) => row.id === item.id);
    const name = (item.name || found?.name || "").trim();
    if (!name || rowByName.has(name)) continue;
    if (!item.isNew && found) continue;
    const actual = item.actual ?? 0;
    const maxStock = item.maxStock ?? actual;
    const serial = layout.serialCol >= 0 ? nextSerial : undefined;
    const rowNumber = await appendEquipmentRow(meta.sheet, layout, lastIndex, {
      name,
      actual,
      maxStock,
      serial,
      template: rows[lastIndex],
    });
    rowByName.set(name, rowNumber);
    lastIndex = rowNumber - 1;
    if (serial) nextSerial += 1;
  }
  await sheetsUpdate(`'${meta.sheet}'!C1`, [[todayIso()]]);
  const at = new Date();
  try {
    await writeDailyReport(farm, farmId, updates, user, note, dirtyMedia, at);
  } catch {
    // keep farm write even if the daily tab fails
  }
  try {
    await appendReportsLog([
      at.toISOString(),
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
