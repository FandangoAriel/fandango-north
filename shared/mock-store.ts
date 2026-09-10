import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createSeedStore } from "./seed";
import type { AppStore, FarmId, LoadItem, LoadMark, LoadRecord, ReportRecord, StockUpdate } from "./types";
import { applyItemOrder, farmLoadItems, todayIso } from "./types";

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
  return readStore().users.slice(0, 10);
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
    .filter((item) => item.farmId === farmId)
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
) {
  const store = readStore();
  const farm = store.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error("farm_not_found");
  for (const update of updates) {
    const item =
      farm.equipment.find((row) => row.id === update.id) ??
      farm.equipment.find((row) => row.name === update.name);
    if (!item) continue;
    if (update.actual !== undefined && Number.isFinite(Number(update.actual))) {
      item.actual = Math.max(0, Math.round(Number(update.actual)));
    }
    if (update.maxStock !== undefined && Number.isFinite(Number(update.maxStock))) {
      item.maxStock = Math.max(0, Math.round(Number(update.maxStock)));
    }
  }
  farm.updatedAt = todayIso();
  store.reports.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    user: user.trim() || "לא ידוע",
    farmId,
    note: note.trim() || undefined,
    items: updates,
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
    items,
  };
  store.loads.push(record);
  writeStore(store);
  return record;
}

export function isDemoMode() {
  return !process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID;
}
