import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createSeedStore } from "./seed";
import type { AppStore, DirtyMedia, FarmId, LoadItem, LoadMark, LoadRecord, ReportRecord, StockUpdate } from "./types";
import { applyItemOrder, farmLoadItems } from "./types";

const STORE_PATH = join(process.cwd(), ".data", "store.json");

function readStore(): AppStore {
  const seed = createSeedStore();
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AppStore;
    if (!parsed?.farms?.length || !parsed?.users?.length) return seed;
    parsed.farms = parsed.farms.map((farm) => {
      const fromSeed = seed.farms.find((item) => item.id === farm.id);
      return {
        ...farm,
        containers: farm.containers ?? fromSeed?.containers ?? [],
        equipment: applyItemOrder(
          (farm.equipment ?? []).map((item) => {
            const seeded = fromSeed?.equipment.find((row) => row.id === item.id);
            return {
              ...item,
              toComplete:
                typeof item.toComplete === "number"
                  ? item.toComplete
                  : (seeded?.toComplete ?? Math.max(0, item.maxStock - item.actual)),
            };
          }),
          farm.itemOrder ?? fromSeed?.itemOrder,
        ),
        itemOrder: farm.itemOrder ?? fromSeed?.equipment.map((item) => item.id) ?? [],
      };
    });
    parsed.loads = parsed.loads ?? [];
    parsed.reports = parsed.reports ?? [];
    return parsed;
  } catch {
    return seed;
  }
}

function writeStore(store: AppStore) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { encoding: "utf8" });
}

export function listUsers(): string[] {
  return readStore().users;
}

export function addUser(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("missing_name");
  const store = readStore();
  if (!store.users.some((user) => user.toLowerCase() === trimmed.toLowerCase())) {
    store.users.push(trimmed);
    writeStore(store);
  }
  return readStore().users;
}

export function getFarm(farmId: FarmId) {
  const farm = readStore().farms.find((item) => item.id === farmId);
  if (!farm) throw new Error("farm_not_found");
  return {
    ...farm,
    equipment: applyItemOrder(farm.equipment, farm.itemOrder),
  };
}

export function listReports(farmId: FarmId): ReportRecord[] {
  return [...readStore().reports]
    .filter((item) => item.farmId === farmId && item.kind !== "load")
    .reverse()
    .slice(0, 20);
}

export function saveItemOrder(farmId: FarmId, itemIds: string[]) {
  const store = readStore();
  const farm = store.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error("farm_not_found");
  farm.itemOrder = itemIds;
  farm.equipment = applyItemOrder(farm.equipment, itemIds);
  writeStore(store);
  return getFarm(farmId);
}

export function reportStock(
  farmId: FarmId,
  updates: StockUpdate[],
  user = "",
  note = "",
  dirtyMedia: DirtyMedia[] = [],
) {
  const store = readStore();
  const farm = store.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error("farm_not_found");
  store.reports.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    user: user.trim() || "לא ידוע",
    farmId,
    note: note.trim() || undefined,
    items: updates,
    kind: "inventory" as const,
    dirtyMedia: dirtyMedia.length ? dirtyMedia : undefined,
  });
  writeStore(store);
  return getFarm(farmId);
}

export function getLoadChecklist(farmId: FarmId): LoadItem[] {
  const farm = getFarm(farmId);
  return farmLoadItems(farm);
}

export function saveLoad(
  farmId: FarmId,
  user: string,
  itemsPayload: { itemId: string; mark?: LoadMark; haveQty?: number | null }[],
  note = "",
  byLoader = false,
): LoadRecord {
  const store = readStore();
  const farm = store.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error("farm_not_found");
  const ordered = applyItemOrder(farm.equipment, farm.itemOrder);
  const byId = new Map(itemsPayload.map((item) => [item.itemId, item]));
  const items = farmLoadItems({ ...farm, equipment: ordered }).map((item) => {
    const update = byId.get(item.itemId);
    if (!update) return item;
    return {
      ...item,
      mark: update.mark ?? "unset",
      haveQty: update.haveQty ?? null,
    };
  });
  const record: LoadRecord = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    user: user.trim() || "לא ידוע",
    farmId,
    note: note.trim() || undefined,
    byLoader,
    items,
  };
  store.loads.push(record);
  store.reports.push({
    id: record.id,
    at: record.at,
    user: record.user,
    farmId,
    note: record.note,
    kind: "load",
    byLoader,
    items: items.map((item) => ({
      id: item.itemId,
      name: item.detail ? `${item.name} · ${item.detail}` : item.name,
    })),
  });
  writeStore(store);
  return record;
}

export function isDemoMode() {
  return !process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID;
}
