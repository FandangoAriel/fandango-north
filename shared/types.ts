export type FarmId = "beit-haemek" | "lehavot-haviva" | "kfar-hasidim";

export type LoadMark = "unset" | "full" | "partial" | "none";

export interface EquipmentItem {
  id: string;
  name: string;
  actual: number;
  maxStock: number;
  /** כמות להשלמה מעמודה F בגיליון (לא D). */
  toComplete: number;
}

export interface LabeledContainer {
  id: string;
  customerId: string;
  customerName: string;
  containerType: string;
  supplied: boolean;
}

export interface Farm {
  id: FarmId;
  name: string;
  updatedAt: string;
  equipment: EquipmentItem[];
  containers: LabeledContainer[];
  itemOrder?: string[];
}

export interface LoadItem {
  itemId: string;
  kind: "stock" | "container";
  name: string;
  detail?: string;
  toSupply: number;
  mark: LoadMark;
  haveQty?: number | null;
}

export interface LoadRecord {
  id: string;
  at: string;
  user: string;
  farmId: FarmId;
  note?: string;
  byLoader?: boolean;
  items: LoadItem[];
}

export interface StockUpdate {
  id: string;
  name?: string;
  actual?: number;
  maxStock?: number;
  isNew?: boolean;
}

export interface DirtyMedia {
  id: string;
  kind: "image" | "video";
  name: string;
  mime: string;
  url: string;
}

export function isNewEquipmentId(id: string) {
  return id.startsWith("new:");
}

export interface ReportRecord {
  id: string;
  at: string;
  user: string;
  farmId: FarmId;
  note?: string;
  kind?: "inventory" | "load";
  byLoader?: boolean;
  items: StockUpdate[];
  dirtyMedia?: DirtyMedia[];
}

export interface AppStore {
  users: string[];
  farms: Farm[];
  loads: LoadRecord[];
  reports: ReportRecord[];
}

export const FARM_SHEETS: Record<
  FarmId,
  {
    name: string;
    sheet: string;
    startRow: number;
    container: { customerId: number; customerName: number; type: number; supplied: number };
  }
> = {
  "beit-haemek": {
    name: "בית העמק",
    sheet: "בית העמק",
    startRow: 6,
    container: { customerId: 8, customerName: 9, type: 10, supplied: 12 },
  },
  "lehavot-haviva": {
    name: "להבות חביבה",
    sheet: "להבות חביבה",
    startRow: 6,
    container: { customerId: 7, customerName: 8, type: 9, supplied: 11 },
  },
  "kfar-hasidim": {
    name: "כפר חסידים",
    sheet: "כפר חסידים",
    startRow: 5,
    container: { customerId: 6, customerName: 7, type: 8, supplied: 10 },
  },
};

const MARK_CYCLE: LoadMark[] = ["unset", "full", "partial", "none"];

export function nextLoadMark(mark: LoadMark): LoadMark {
  const index = MARK_CYCLE.indexOf(mark);
  return MARK_CYCLE[(index + 1) % MARK_CYCLE.length];
}

export function isSuppliedFlag(value: string | undefined) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "כן" || v === "v" || v === "✓";
}

/** מספר אמיתי מעמודת השלמה. מתעלם מ-TRUE/FALSE/ריק. */
export function parseCompleteCell(value: string | undefined): number | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (
    lower === "true" ||
    lower === "false" ||
    lower === "כן" ||
    lower === "לא" ||
    lower === "v" ||
    lower === "x"
  ) {
    return null;
  }
  const n = Number(v.replace(",", "").replace("−", "-"));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

export function completeFromRow(row: (string | undefined)[] | undefined, actual: number, maxStock: number) {
  const fromF = parseCompleteCell(row?.[5]);
  if (fromF !== null) return fromF;
  const fromE = parseCompleteCell(row?.[4]);
  if (fromE !== null) return fromE;
  return Math.max(0, maxStock - actual);
}

export function toCompleteOf(item: EquipmentItem): number {
  return Math.max(0, item.toComplete ?? Math.max(0, item.maxStock - item.actual));
}

export function pendingContainers(farm: Farm): LabeledContainer[] {
  return farm.containers.filter(
    (item) => !item.supplied && (item.customerName.trim() || item.containerType.trim()),
  );
}

function markFromPrevious(prev: LoadItem | undefined): LoadMark {
  if (!prev) return "unset";
  if (prev.mark) return prev.mark;
  if ((prev as LoadItem & { loaded?: boolean }).loaded) return "full";
  return "unset";
}

export function applyItemOrder<T extends { id?: string; itemId?: string; name: string }>(
  items: T[],
  order: string[] | undefined,
): T[] {
  if (!order?.length) return items;
  const byKey = new Map<string, T>();
  for (const item of items) {
    if (item.id) byKey.set(item.id, item);
    if (item.itemId) byKey.set(item.itemId, item);
    byKey.set(item.name, item);
  }
  const used = new Set<T>();
  const next: T[] = [];
  for (const key of order) {
    const item = byKey.get(key);
    if (item && !used.has(item)) {
      next.push(item);
      used.add(item);
    }
  }
  for (const item of items) {
    if (!used.has(item)) next.push(item);
  }
  return next;
}

export function mergeSubsetOrder(fullOrder: string[], subsetOrder: string[]): string[] {
  const subset = new Set(subsetOrder);
  const next: string[] = [];
  let i = 0;
  for (const id of fullOrder) {
    if (subset.has(id)) {
      if (i < subsetOrder.length) next.push(subsetOrder[i++]);
    } else {
      next.push(id);
    }
  }
  while (i < subsetOrder.length) {
    if (!next.includes(subsetOrder[i])) next.push(subsetOrder[i]);
    i += 1;
  }
  return next;
}

export function farmLoadItems(farm: Farm, previous: Map<string, LoadItem> = new Map()): LoadItem[] {
  const containers: LoadItem[] = pendingContainers(farm).map((item) => {
    const prev = previous.get(item.id) ?? previous.get(item.customerName);
    return {
      itemId: item.id,
      kind: "container" as const,
      name: item.customerName || item.containerType,
      detail:
        item.containerType && item.containerType !== item.customerName ? item.containerType : undefined,
      toSupply: 1,
      mark: markFromPrevious(prev),
      haveQty: prev?.haveQty ?? null,
    };
  });
  const stock: LoadItem[] = applyItemOrder(
    farm.equipment.filter((item) => toCompleteOf(item) > 0),
    farm.itemOrder,
  ).map((item) => {
    const prev = previous.get(item.id) ?? previous.get(item.name);
    return {
      itemId: item.id,
      kind: "stock" as const,
      name: item.name,
      toSupply: toCompleteOf(item),
      mark: markFromPrevious(prev),
      haveQty: prev?.haveQty ?? null,
    };
  });
  return [...containers, ...stock];
}

export function previousLoadMap(items: LoadItem[] | undefined): Map<string, LoadItem> {
  const map = new Map<string, LoadItem>();
  for (const item of items ?? []) {
    map.set(item.itemId, item);
    map.set(item.name, item);
  }
  return map;
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
