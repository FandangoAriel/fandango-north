import {
  getFarm,
  getLoadChecklist,
  isDemoMode,
  listReports,
  listUsers,
  reportStock,
  saveItemOrder,
  saveLoad,
} from "./mock-store";
import {
  googleConfigured,
  googleGetFarm,
  googleGetLoad,
  googleListReports,
  googleListUsers,
  googleReportStock,
  googleSaveLoad,
  googleSaveOrder,
} from "./google";
import type { FarmId, LoadMark, StockUpdate } from "./types";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export function json(status: number, body: unknown) {
  return {
    statusCode: status,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  };
}

function farmIdFrom(value: string | null): FarmId {
  if (value === "beit-haemek" || value === "lehavot-haviva" || value === "kfar-hasidim") {
    return value;
  }
  throw new Error("farm_not_found");
}

export async function handleUsers() {
  if (googleConfigured()) {
    try {
      const users = await googleListUsers();
      if (users.length) return json(200, { users, demo: false });
    } catch {
      // fall through to demo
    }
  }
  return json(200, { users: listUsers(), demo: true });
}

export async function handleInventory(farmRaw: string | null) {
  const farmId = farmIdFrom(farmRaw);
  if (googleConfigured() && !isDemoMode()) {
    try {
      const farm = await googleGetFarm(farmId);
      return json(200, { farm, demo: false });
    } catch {
      // demo fallback
    }
  }
  return json(200, { farm: getFarm(farmId), demo: isDemoMode() || !googleConfigured() });
}

export async function handleReport(payload: {
  farmId?: string;
  user?: string;
  note?: string;
  items?: StockUpdate[];
}) {
  const farmId = farmIdFrom(payload.farmId ?? null);
  const items = payload.items ?? [];
  const user = payload.user ?? "";
  const note = payload.note ?? "";
  if (googleConfigured() && !isDemoMode()) {
    try {
      const farm = await googleReportStock(farmId, items, user, note);
      return json(200, { farm, demo: false });
    } catch {
      // demo fallback
    }
  }
  const farm = reportStock(farmId, items, user, note);
  return json(200, { farm, demo: true });
}

export async function handleGetLoad(farmRaw: string | null) {
  const farmId = farmIdFrom(farmRaw);
  if (googleConfigured() && !isDemoMode()) {
    try {
      const farm = await googleGetFarm(farmId);
      return json(200, {
        items: await googleGetLoad(farmId),
        equipmentIds: farm.equipment.map((item) => item.id),
        demo: false,
      });
    } catch {
      // demo fallback
    }
  }
  const farm = getFarm(farmId);
  return json(200, {
    items: getLoadChecklist(farmId),
    equipmentIds: farm.equipment.map((item) => item.id),
    demo: true,
  });
}

export async function handleSaveLoad(payload: {
  farmId?: string;
  user?: string;
  note?: string;
  loadedIds?: string[];
  byLoader?: boolean;
  items?: { itemId: string; mark?: LoadMark; haveQty?: number | null }[];
}) {
  const farmId = farmIdFrom(payload.farmId ?? null);
  const user = payload.user ?? "";
  const note = payload.note ?? "";
  const byLoader = Boolean(payload.byLoader);
  const items =
    payload.items ??
    (payload.loadedIds ?? []).map((itemId) => ({ itemId, mark: "full" as const, haveQty: null }));
  if (googleConfigured() && !isDemoMode()) {
    try {
      const record = await googleSaveLoad(farmId, user, items, note, byLoader);
      return json(200, { record, demo: false });
    } catch {
      // demo fallback
    }
  }
  const record = saveLoad(farmId, user, items, note, byLoader);
  return json(200, { record, demo: true });
}

export async function handleListReports(farmRaw: string | null) {
  const farmId = farmIdFrom(farmRaw);
  if (googleConfigured() && !isDemoMode()) {
    try {
      const reports = await googleListReports(farmId);
      return json(200, { reports, demo: false });
    } catch {
      // demo fallback
    }
  }
  return json(200, { reports: listReports(farmId), demo: true });
}

export async function handleSaveOrder(payload: { farmId?: string; itemIds?: string[] }) {
  const farmId = farmIdFrom(payload.farmId ?? null);
  const itemIds = payload.itemIds ?? [];
  if (googleConfigured() && !isDemoMode()) {
    try {
      const farm = await googleSaveOrder(farmId, itemIds);
      return json(200, { farm, demo: false });
    } catch {
      // demo fallback
    }
  }
  const farm = saveItemOrder(farmId, itemIds);
  return json(200, { farm, demo: true });
}
