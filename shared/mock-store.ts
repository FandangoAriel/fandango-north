import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createSeedStore } from "./seed";
import type { AppStore, FarmId, LoadItem, LoadRecord } from "./types";
import { todayIso, toSupply } from "./types";

const STORE_PATH = join(process.cwd(), ".data", "store.json");

function readStore(): AppStore {
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AppStore;
    if (parsed?.farms?.length && parsed?.users?.length) return parsed;
  } catch {
    // first run or corrupt file
  }
  return createSeedStore();
}

function writeStore(store: AppStore) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function listUsers(): string[] {
  return readStore().users.slice(0, 10);
}

export function getFarm(farmId: FarmId) {
  const farm = readStore().farms.find((item) => item.id === farmId);
  if (!farm) throw new Error("farm_not_found");
  return farm;
}

export function reportStock(
  farmId: FarmId,
  updates: { id: string; actual: number }[],
) {
  const store = readStore();
  const farm = store.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error("farm_not_found");
  for (const update of updates) {
    const item = farm.equipment.find((row) => row.id === update.id);
    if (!item) continue;
    item.actual = Math.max(0, Math.round(Number(update.actual) || 0));
  }
  farm.updatedAt = todayIso();
  writeStore(store);
  return farm;
}

export function getLoadChecklist(farmId: FarmId): LoadItem[] {
  const store = readStore();
  const farm = store.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error("farm_not_found");
  const latest = [...store.loads].reverse().find((load) => load.farmId === farmId);
  const checked = new Set(
    (latest?.items ?? []).filter((item) => item.loaded).map((item) => item.itemId),
  );
  return farm.equipment
    .filter((item) => toSupply(item) > 0)
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      toSupply: toSupply(item),
      loaded: checked.has(item.id),
    }))
    .sort((a, b) => b.toSupply - a.toSupply);
}

export function saveLoad(
  farmId: FarmId,
  user: string,
  loadedIds: string[],
): LoadRecord {
  const store = readStore();
  const farm = store.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error("farm_not_found");
  const loaded = new Set(loadedIds);
  const items: LoadItem[] = farm.equipment
    .filter((item) => toSupply(item) > 0)
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      toSupply: toSupply(item),
      loaded: loaded.has(item.id),
    }));
  const record: LoadRecord = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    user: user.trim() || "לא ידוע",
    farmId,
    items,
  };
  store.loads.push(record);
  writeStore(store);
  return record;
}

export function isDemoMode() {
  return !process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID;
}
