import {
  getFarm,
  getLoadChecklist,
  isDemoMode,
  listUsers,
  reportStock,
  saveLoad,
} from "./mock-store";
import {
  googleConfigured,
  googleGetFarm,
  googleGetLoad,
  googleListUsers,
  googleReportStock,
  googleSaveLoad,
} from "./google";
import type { FarmId } from "./types";

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
  items?: { id: string; actual: number; name?: string }[];
}) {
  const farmId = farmIdFrom(payload.farmId ?? null);
  const items = payload.items ?? [];
  if (googleConfigured() && !isDemoMode()) {
    try {
      const farm = await googleReportStock(farmId, items);
      return json(200, { farm, demo: false });
    } catch {
      // demo fallback
    }
  }
  const farm = reportStock(farmId, items);
  return json(200, { farm, demo: true });
}

export async function handleGetLoad(farmRaw: string | null) {
  const farmId = farmIdFrom(farmRaw);
  if (googleConfigured() && !isDemoMode()) {
    try {
      const items = await googleGetLoad(farmId);
      return json(200, { items, demo: false });
    } catch {
      // demo fallback
    }
  }
  return json(200, { items: getLoadChecklist(farmId), demo: true });
}

export async function handleSaveLoad(payload: {
  farmId?: string;
  user?: string;
  loadedIds?: string[];
}) {
  const farmId = farmIdFrom(payload.farmId ?? null);
  const user = payload.user ?? "";
  const loadedIds = payload.loadedIds ?? [];
  if (googleConfigured() && !isDemoMode()) {
    try {
      const record = await googleSaveLoad(farmId, user, loadedIds);
      return json(200, { record, demo: false });
    } catch {
      // demo fallback
    }
  }
  const record = saveLoad(farmId, user, loadedIds);
  return json(200, { record, demo: true });
}
