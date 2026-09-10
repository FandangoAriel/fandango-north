export type FarmId = "beit-haemek" | "lehavot-haviva" | "kfar-hasidim";

export interface EquipmentItem {
  id: string;
  name: string;
  actual: number;
  maxStock: number;
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
}

export interface LoadItem {
  itemId: string;
  kind: "stock" | "container";
  name: string;
  detail?: string;
  toSupply: number;
  loaded: boolean;
}

export interface LoadRecord {
  id: string;
  at: string;
  user: string;
  farmId: FarmId;
  items: LoadItem[];
}

export interface AppStore {
  users: string[];
  farms: Farm[];
  loads: LoadRecord[];
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

export function toSupply(item: EquipmentItem): number {
  return Math.max(0, item.maxStock - item.actual);
}

export function isSuppliedFlag(value: string | undefined) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "כן" || v === "v" || v === "✓";
}

export function pendingContainers(farm: Farm): LabeledContainer[] {
  return farm.containers.filter(
    (item) => !item.supplied && (item.customerName.trim() || item.containerType.trim()),
  );
}

export function farmLoadItems(farm: Farm, checked: Set<string>): LoadItem[] {
  const containers: LoadItem[] = pendingContainers(farm).map((item) => ({
    itemId: item.id,
    kind: "container",
    name: item.customerName || item.containerType,
    detail: [item.containerType, item.customerId ? `מס׳ ${item.customerId}` : ""]
      .filter(Boolean)
      .join(" · "),
    toSupply: 1,
    loaded: checked.has(item.id) || checked.has(item.customerName),
  }));
  const stock: LoadItem[] = farm.equipment
    .filter((item) => toSupply(item) > 0)
    .map((item) => ({
      itemId: item.id,
      kind: "stock" as const,
      name: item.name,
      toSupply: toSupply(item),
      loaded: checked.has(item.id) || checked.has(item.name),
    }))
    .sort((a, b) => b.toSupply - a.toSupply);
  return [...containers, ...stock];
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
