import { JWT } from "google-auth-library";
import type { EquipmentItem, Farm, FarmId, LabeledContainer, LoadItem, LoadRecord } from "./types";
import { FARM_SHEETS, farmLoadItems, isSuppliedFlag, todayIso } from "./types";

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
      equipment.push({
        id: `${farmId}-${i}`,
        name,
        actual: parseNumber(rows[i]?.[1]),
        maxStock: parseNumber(rows[i]?.[2]),
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
  updates: { id: string; actual: number; name?: string }[],
) {
  const farm = await googleGetFarm(farmId);
  const meta = FARM_SHEETS[farmId];
  const data = await sheetsGet(`'${meta.sheet}'!A${meta.startRow}:B80`);
  const rows = data.values ?? [];
  const byName = new Map(updates.map((item) => [item.name, item.actual]));
  for (const item of updates) {
    const found = farm.equipment.find((row) => row.id === item.id);
    if (found) byName.set(found.name, item.actual);
  }
  for (let i = 0; i < rows.length; i += 1) {
    const name = rows[i]?.[0]?.trim();
    if (!name || !byName.has(name)) continue;
    const rowNumber = meta.startRow + i;
    await sheetsUpdate(`'${meta.sheet}'!B${rowNumber}`, [[byName.get(name) ?? 0]]);
  }
  await sheetsUpdate(`'${meta.sheet}'!C1`, [[todayIso()]]);
  return googleGetFarm(farmId);
}

export async function googleGetLoad(farmId: FarmId): Promise<LoadItem[]> {
  const farm = await googleGetFarm(farmId);
  let checked = new Set<string>();
  try {
    const log = await sheetsGet("העמסות!A2:F200");
    const rows = (log.values ?? []).reverse();
    const latest = rows.find((row) => row[2] === farmId || row[2] === FARM_SHEETS[farmId].name);
    if (latest?.[5]) {
      checked = new Set(
        String(latest[5])
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean),
      );
    }
  } catch {
    // tab may not exist yet
  }
  return farmLoadItems(farm, checked);
}

export async function googleSaveLoad(
  farmId: FarmId,
  user: string,
  loadedIds: string[],
): Promise<LoadRecord> {
  const items = await googleGetLoad(farmId);
  const loaded = new Set(loadedIds);
  const nextItems = items.map((item) => ({ ...item, loaded: loaded.has(item.itemId) }));
  const loadedNames = nextItems.filter((item) => item.loaded).map((item) => item.name);
  const record: LoadRecord = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    user,
    farmId,
    items: nextItems,
  };
  await sheetsAppend("העמסות!A1", [
    [
      record.at,
      user,
      FARM_SHEETS[farmId].name,
      farmId,
      loadedNames.length,
      loadedNames.join(", "),
    ],
  ]);
  return record;
}
