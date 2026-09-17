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

function quoteSheet(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export function reportSheetTitle(farmName: string, at = new Date()) {
  const day = String(at.getDate()).padStart(2, "0");
  const month = String(at.getMonth() + 1).padStart(2, "0");
  return `${farmName} ${day}-${month}-${at.getFullYear()}`;
}

async function listSheetTitles() {
  const { token, spreadsheetId } = await accessToken();
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`sheets_meta_${res.status}`);
  const data = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  return (data.sheets ?? []).map((sheet) => sheet.properties?.title ?? "").filter(Boolean);
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
  return file.webViewLink || file.webContentLink;
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

function parseNumber(value: string | undefined) {
  const n = Number(String(value ?? "").replace(",", ""));
  return Number.isFinite(n) ? n : 0;
}

export async function googleListUsers(): Promise<string[]> {
  try {
    const data = await sheetsGet("משתמשים!A1:A200");
    const rows = data.values ?? [];
    const start = rows[0]?.[0]?.trim() === "שם" ? 1 : 0;
    return rows
      .slice(start)
      .map((row) => row[0]?.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function googleAddUser(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("missing_name");
  await ensureSheet("משתמשים");
  const header = await sheetsGet("משתמשים!A1");
  if (!header.values?.[0]?.[0]?.trim()) {
    await sheetsUpdate("משתמשים!A1", [["שם"]]);
  }
  const existing = await googleListUsers();
  if (existing.some((user) => user.toLowerCase() === trimmed.toLowerCase())) return existing;
  await sheetsAppend("משתמשים!A1", [[trimmed]]);
  return [...existing, trimmed];
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
  const data = await sheetsGet(`'${meta.sheet}'!A1:M200`);
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
  dirtyMedia: DirtyMedia[] = [],
) {
  const farm = await googleGetFarm(farmId);
  const farmName = FARM_SHEETS[farmId].name;
  const at = new Date();
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
  const block: (string | number)[][] = [
    ["דיווח מלאי", farmName, time, user],
    ["הערה", note],
    ["ציוד מלוכלך", dirtyMedia.map((item) => item.url).filter(Boolean).join(" ")],
    ["פריט", "מלאי קיים", "מקס"],
    ...table,
  ];
  await sheetsUpdate(`${quoted}!A${start}`, block);
  try {
    await appendReportsLog([
      at.toISOString(),
      user,
      farmName,
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
  return farm;
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
