export type FarmId = "beit-haemek" | "lehavot-haviva" | "kfar-hasidim";

export interface EquipmentItem {
  id: string;
  name: string;
  actual: number;
  maxStock: number;
}

export interface Farm {
  id: FarmId;
  name: string;
  updatedAt: string;
  equipment: EquipmentItem[];
}

export interface LoadItem {
  itemId: string;
  name: string;
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

export const FARM_SHEETS: Record<FarmId, { name: string; sheet: string; startRow: number }> = {
  "beit-haemek": { name: "בית העמק", sheet: "בית העמק", startRow: 6 },
  "lehavot-haviva": { name: "להבות חביבה", sheet: "להבות חביבה", startRow: 6 },
  "kfar-hasidim": { name: "כפר חסידים", sheet: "כפר חסידים", startRow: 5 },
};

export function toSupply(item: EquipmentItem): number {
  return Math.max(0, item.maxStock - item.actual);
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
