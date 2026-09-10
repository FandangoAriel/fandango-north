export type SiteId = "beit-haemek" | "lehavot-haviva" | "kfar-hasidim";

export interface EquipmentItem {
  id: string;
  name: string;
  actual: number;
  maxStock: number;
}

export interface ContainerJob {
  id: string;
  customerId: string;
  customerName: string;
  containerType: string;
  plannedDate: string | null;
  dueDate: string | null;
  supplied: boolean;
}

export interface Site {
  id: SiteId;
  name: string;
  updatedAt: string;
  equipment: EquipmentItem[];
  containers: ContainerJob[];
}

export interface InventoryState {
  sites: Site[];
}

export type EquipmentFilter = "all" | "shortage" | "ok" | "empty";
