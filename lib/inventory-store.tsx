"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cloneSeed, seedState } from "./seed";
import { todayIso } from "./stats";
import type {
  ContainerJob,
  EquipmentItem,
  InventoryState,
  Site,
  SiteId,
} from "./types";

const STORAGE_KEY = "fandango-north-inventory-v1";

type InventoryContextValue = {
  state: InventoryState;
  hydrated: boolean;
  updateActual: (siteId: SiteId, itemId: string, actual: number) => void;
  updateMax: (siteId: SiteId, itemId: string, maxStock: number) => void;
  fillItem: (siteId: SiteId, itemId: string) => void;
  addItem: (siteId: SiteId, item: Omit<EquipmentItem, "id">) => void;
  removeItem: (siteId: SiteId, itemId: string) => void;
  addContainer: (siteId: SiteId, job: Omit<ContainerJob, "id" | "supplied">) => void;
  toggleSupplied: (siteId: SiteId, jobId: string) => void;
  removeContainer: (siteId: SiteId, jobId: string) => void;
  reset: () => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

const listeners = new Set<() => void>();
let memory: InventoryState | undefined;

function emit() {
  listeners.forEach((listener) => listener());
}

function persist(state: InventoryState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

function loadFromStorage(): InventoryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSeed();
    const parsed = JSON.parse(raw) as InventoryState;
    if (parsed?.sites?.length) return parsed;
  } catch {
    // ignore malformed cache
  }
  return cloneSeed();
}

function getClientSnapshot(): InventoryState {
  if (!memory) memory = loadFromStorage();
  return memory;
}

function getServerSnapshot(): InventoryState {
  return seedState;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: InventoryState) {
  memory = next;
  persist(next);
  emit();
}

function clampQty(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function touchSite(site: Site): Site {
  return { ...site, updatedAt: todayIso() };
}

function mapSite(state: InventoryState, siteId: SiteId, mapper: (site: Site) => Site): InventoryState {
  return {
    sites: state.sites.map((site) => (site.id === siteId ? mapper(site) : site)),
  };
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const state = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const updateActual = useCallback((siteId: SiteId, itemId: string, actual: number) => {
    commit(
      mapSite(getClientSnapshot(), siteId, (site) =>
        touchSite({
          ...site,
          equipment: site.equipment.map((item) =>
            item.id === itemId ? { ...item, actual: clampQty(actual) } : item,
          ),
        }),
      ),
    );
  }, []);

  const updateMax = useCallback((siteId: SiteId, itemId: string, maxStock: number) => {
    commit(
      mapSite(getClientSnapshot(), siteId, (site) =>
        touchSite({
          ...site,
          equipment: site.equipment.map((item) =>
            item.id === itemId ? { ...item, maxStock: clampQty(maxStock) } : item,
          ),
        }),
      ),
    );
  }, []);

  const fillItem = useCallback((siteId: SiteId, itemId: string) => {
    commit(
      mapSite(getClientSnapshot(), siteId, (site) =>
        touchSite({
          ...site,
          equipment: site.equipment.map((item) =>
            item.id === itemId ? { ...item, actual: item.maxStock } : item,
          ),
        }),
      ),
    );
  }, []);

  const addItem = useCallback((siteId: SiteId, item: Omit<EquipmentItem, "id">) => {
    const next: EquipmentItem = {
      id: crypto.randomUUID(),
      name: item.name.trim(),
      actual: clampQty(item.actual),
      maxStock: clampQty(item.maxStock),
    };
    commit(
      mapSite(getClientSnapshot(), siteId, (site) =>
        touchSite({ ...site, equipment: [...site.equipment, next] }),
      ),
    );
  }, []);

  const removeItem = useCallback((siteId: SiteId, itemId: string) => {
    commit(
      mapSite(getClientSnapshot(), siteId, (site) =>
        touchSite({
          ...site,
          equipment: site.equipment.filter((item) => item.id !== itemId),
        }),
      ),
    );
  }, []);

  const addContainer = useCallback(
    (siteId: SiteId, job: Omit<ContainerJob, "id" | "supplied">) => {
      const next: ContainerJob = {
        id: crypto.randomUUID(),
        customerId: job.customerId.trim(),
        customerName: job.customerName.trim(),
        containerType: job.containerType.trim(),
        plannedDate: job.plannedDate,
        dueDate: job.dueDate,
        supplied: false,
      };
      commit(
        mapSite(getClientSnapshot(), siteId, (site) =>
          touchSite({ ...site, containers: [...site.containers, next] }),
        ),
      );
    },
    [],
  );

  const toggleSupplied = useCallback((siteId: SiteId, jobId: string) => {
    commit(
      mapSite(getClientSnapshot(), siteId, (site) =>
        touchSite({
          ...site,
          containers: site.containers.map((job) =>
            job.id === jobId ? { ...job, supplied: !job.supplied } : job,
          ),
        }),
      ),
    );
  }, []);

  const removeContainer = useCallback((siteId: SiteId, jobId: string) => {
    commit(
      mapSite(getClientSnapshot(), siteId, (site) =>
        touchSite({
          ...site,
          containers: site.containers.filter((job) => job.id !== jobId),
        }),
      ),
    );
  }, []);

  const reset = useCallback(() => {
    commit(cloneSeed());
  }, []);

  const value = useMemo(
    () => ({
      state,
      hydrated,
      updateActual,
      updateMax,
      fillItem,
      addItem,
      removeItem,
      addContainer,
      toggleSupplied,
      removeContainer,
      reset,
    }),
    [
      state,
      hydrated,
      updateActual,
      updateMax,
      fillItem,
      addItem,
      removeItem,
      addContainer,
      toggleSupplied,
      removeContainer,
      reset,
    ],
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used within InventoryProvider");
  return ctx;
}
