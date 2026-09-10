import type { ContainerJob, EquipmentFilter, EquipmentItem, Site } from "./types";

export function toSupply(item: EquipmentItem): number {
  return Math.max(0, item.maxStock - item.actual);
}

export function surplus(item: EquipmentItem): number {
  return Math.max(0, item.actual - item.maxStock);
}

export function fillPercent(item: EquipmentItem): number {
  if (item.maxStock <= 0) return item.actual > 0 ? 100 : 0;
  return Math.min(100, Math.round((item.actual / item.maxStock) * 100));
}

export function isShortage(item: EquipmentItem): boolean {
  return item.maxStock > 0 && item.actual < item.maxStock;
}

export function isEmpty(item: EquipmentItem): boolean {
  return item.actual === 0 && item.maxStock > 0;
}

export function isOk(item: EquipmentItem): boolean {
  return item.maxStock > 0 && item.actual >= item.maxStock;
}

export function matchesFilter(item: EquipmentItem, filter: EquipmentFilter): boolean {
  if (filter === "all") return true;
  if (filter === "shortage") return isShortage(item);
  if (filter === "empty") return isEmpty(item);
  return isOk(item);
}

export function siteShortages(site: Site): EquipmentItem[] {
  return site.equipment.filter(isShortage).sort((a, b) => toSupply(b) - toSupply(a));
}

export function siteSupplyUnits(site: Site): number {
  return site.equipment.reduce((sum, item) => sum + toSupply(item), 0);
}

export function pendingContainers(site: Site): ContainerJob[] {
  return site.containers.filter((job) => !job.supplied);
}

export function formatHeDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export function daysSince(iso: string): number {
  const then = new Date(`${iso}T00:00:00`).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function isStale(iso: string, thresholdDays = 45): boolean {
  return daysSince(iso) > thresholdDays;
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
