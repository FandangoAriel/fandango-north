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
  googleSaveDirtyMedia,
  googleSaveLoad,
  googleSaveOrder,
} from "./google";
import { dirtyMediaFromReports, type DirtyMedia, type FarmId, type LoadMark, type StockUpdate } from "./types";
import { MAX_MEDIA_BYTES, readMediaFile, saveMediaFile } from "./media-store";

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

export function binary(status: number, data: Buffer, mime: string) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
    },
    body: data.toString("base64"),
    isBase64Encoded: true,
  };
}

type DirtyMediaInput = {
  id?: string;
  kind?: "image" | "video";
  name?: string;
  mime?: string;
  data?: string;
  url?: string;
};

async function persistDirtyMedia(items: DirtyMediaInput[]): Promise<DirtyMedia[]> {
  const prepared = items
    .map((item) => {
      const id = item.id?.trim() || crypto.randomUUID();
      const kind = item.kind === "video" ? ("video" as const) : ("image" as const);
      const name = item.name?.trim() || `${kind}-${id}`;
      const mime = item.mime?.trim() || (kind === "video" ? "video/mp4" : "image/jpeg");
      return { id, kind, name, mime, data: item.data, url: item.url };
    })
    .filter((item) => item.data || item.url);

  const local: DirtyMedia[] = [];
  for (const item of prepared) {
    if (item.data) {
      const data = Buffer.from(item.data, "base64");
      if (!data.length || data.length > MAX_MEDIA_BYTES) continue;
      try {
        saveMediaFile(item.id, item.mime, data);
        local.push({
          id: item.id,
          kind: item.kind,
          name: item.name,
          mime: item.mime,
          url: `/api/media/${item.id}`,
        });
      } catch {
        // skip broken files
      }
    } else if (item.url) {
      local.push({
        id: item.id,
        kind: item.kind,
        name: item.name,
        mime: item.mime,
        url: item.url,
      });
    }
  }

  if (googleConfigured() && !isDemoMode()) {
    try {
      const uploaded = await googleSaveDirtyMedia(prepared);
      if (uploaded.length) {
        const byId = new Map(local.map((item) => [item.id, item]));
        for (const item of uploaded) byId.set(item.id, item);
        return [...byId.values()];
      }
    } catch {
      // keep local urls
    }
  }
  return local;
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
  dirtyMedia?: DirtyMediaInput[];
}) {
  const farmId = farmIdFrom(payload.farmId ?? null);
  const items = payload.items ?? [];
  const user = payload.user ?? "";
  const note = payload.note ?? "";
  const dirtyMedia = await persistDirtyMedia(payload.dirtyMedia ?? []);
  if (googleConfigured() && !isDemoMode()) {
    try {
      const farm = await googleReportStock(farmId, items, user, note, dirtyMedia);
      return json(200, { farm, demo: false, dirtyMedia });
    } catch {
      // demo fallback
    }
  }
  const farm = reportStock(farmId, items, user, note, dirtyMedia);
  return json(200, { farm, demo: true, dirtyMedia });
}

export function handleGetMedia(idRaw: string | null) {
  const id = idRaw?.trim() ?? "";
  const file = readMediaFile(id);
  if (!file) return json(404, { error: "not_found" });
  return binary(200, file.data, file.mime);
}

export async function handleGetLoad(farmRaw: string | null) {
  const farmId = farmIdFrom(farmRaw);
  if (googleConfigured() && !isDemoMode()) {
    try {
      const farm = await googleGetFarm(farmId);
      const reports = await googleListReports(farmId).catch(() => []);
      return json(200, {
        items: await googleGetLoad(farmId),
        equipmentIds: farm.equipment.map((item) => item.id),
        dirtyMedia: dirtyMediaFromReports(reports),
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
    dirtyMedia: dirtyMediaFromReports(listReports(farmId)),
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
