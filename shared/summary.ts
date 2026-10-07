import type { LoadItem } from "./types";

export interface ShareMediaLink {
  kind: "image" | "video";
  name: string;
  url: string;
}

export interface LoadShareSnapshot {
  farmName: string;
  user: string;
  at: string;
  note: string;
  lines: string[];
  media: ShareMediaLink[];
}

export function loadedQty(item: LoadItem): number | null {
  if (item.mark === "full") return item.toSupply;
  if (item.mark === "partial") return item.haveQty ?? 0;
  if (item.mark === "none") return 0;
  return null;
}

export function showLoadSaveOnly(note: string, mediaCount: number) {
  return !note.trim() && mediaCount === 0;
}

export function absoluteMediaUrl(url: string, origin: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${origin.replace(/\/$/, "")}${trimmed}`;
  return "";
}

function mediaExtension(kind?: "image" | "video") {
  return kind === "video" ? ".mp4" : ".jpg";
}

/** A media address WhatsApp can keep intact: no hyphens in the id, and a file extension. */
export function whatsAppMediaUrl(url: string, origin: string, kind?: "image" | "video") {
  const absolute = absoluteMediaUrl(url, origin);
  if (!absolute) return "";
  const match = absolute.match(/\/api\/media\/([^/?#]+)$/);
  if (!match) return absolute;
  const bare = decodeURIComponent(match[1]).replace(/\.(?:jpe?g|png|mp4|webm|mov|m4v)$/i, "").replace(/-/g, "");
  return `${origin.replace(/\/$/, "")}/api/media/${bare}${mediaExtension(kind)}`;
}

export function loadWhatsAppText(
  farmName: string,
  user: string,
  items: LoadItem[],
  note = "",
  byLoader = false,
  dirtyMedia: { name: string; url: string }[] = [],
  shareMedia: { name: string; url: string }[] = [],
) {
  const lines = [`העמסה · ${farmName}`, `${user} · ${new Date().toLocaleString("he-IL")}`, ""];
  const stock = items.filter((item) => item.kind === "stock");
  const containers = items.filter((item) => item.kind === "container");
  const notes = items.filter((item) => item.kind === "note");
  if (notes.length) {
    lines.push("הערה מהדיווח:");
    for (const item of notes) {
      const status =
        item.mark === "full"
          ? "סומן"
          : item.mark === "none"
            ? "אין"
            : item.mark === "partial"
              ? "חלקי"
              : "לא סומן";
      lines.push(`${item.name} — ${status}`);
    }
    lines.push("");
  }
  if (stock.length) {
    lines.push("ציוד:");
    for (const item of stock) {
      const loaded = loadedQty(item);
      const loadedText = loaded === null ? "לא סומן" : String(loaded);
      lines.push(`${item.name} — צריך ${item.toSupply}, הועמס ${loadedText}`);
    }
    lines.push("");
  }
  if (containers.length) {
    lines.push("מיכלים:");
    for (const item of containers) {
      const status =
        item.mark === "full"
          ? "הועמס"
          : item.mark === "none"
            ? "אין"
            : item.mark === "partial"
              ? `חלקי${item.haveQty != null ? ` ${item.haveQty}` : ""}`
              : "לא סומן";
      lines.push(`${item.name}${item.detail ? ` · ${item.detail}` : ""} — ${status}`);
    }
    lines.push("");
  }
  if (note.trim()) lines.push(`הערה: ${note.trim()}`);
  if (byLoader) lines.push("ע״י המעמיס");
  if (dirtyMedia.length) {
    lines.push("", "צפייה בסרטון שנשלח:");
    for (const item of dirtyMedia) {
      lines.push(item.url || item.name);
    }
  }
  const attached = shareMedia.filter((item) => item.url.trim() || item.name.trim());
  if (attached.length) {
    lines.push("", "תמונה או סרטון מהמעמיס:");
    for (const item of attached) lines.push(item.url.trim() || item.name.trim());
  }
  return lines.join("\n").trim();
}

const SHARE_MEDIA_URL = /^(https?:\/\/[^\s]+|\/api\/media\/[A-Za-z0-9._-]{8,80})$/;

export function loadSharePageUrl(origin: string, snapshot: LoadShareSnapshot) {
  return `${origin.replace(/\/$/, "")}/?view=load#${encodeURIComponent(JSON.stringify(snapshot))}`;
}

export function parseLoadShare(hash: string): LoadShareSnapshot | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    text = raw;
  }
  try {
    const data = JSON.parse(text) as Partial<LoadShareSnapshot>;
    if (!data || typeof data.farmName !== "string" || !data.farmName.trim()) return null;
    const lines = Array.isArray(data.lines)
      ? data.lines.filter((line): line is string => typeof line === "string").slice(0, 80)
      : [];
    const media = Array.isArray(data.media)
      ? data.media
          .filter(
            (item): item is ShareMediaLink =>
              Boolean(item) &&
              (item.kind === "image" || item.kind === "video") &&
              typeof item.url === "string" &&
              SHARE_MEDIA_URL.test(item.url),
          )
          .slice(0, 8)
          .map((item) => ({
            kind: item.kind,
            name: String(item.name || "").slice(0, 80),
            url: item.url,
          }))
      : [];
    return {
      farmName: data.farmName.slice(0, 80),
      user: String(data.user || "").slice(0, 80),
      at: String(data.at || "").slice(0, 40),
      note: String(data.note || "").slice(0, 500),
      lines,
      media,
    };
  } catch {
    return null;
  }
}

export function loadShareMessage(input: {
  farmName: string;
  user: string;
  items: LoadItem[];
  note?: string;
  byLoader?: boolean;
  dirtyMedia?: { name: string; url: string; kind?: "image" | "video" }[];
  shareMedia?: ShareMediaLink[];
  origin: string;
  at?: Date;
}) {
  const origin = input.origin.replace(/\/$/, "");
  const shareMedia = (input.shareMedia ?? [])
    .map((item) => ({
      kind: item.kind,
      name: item.name,
      url: whatsAppMediaUrl(item.url, origin, item.kind),
    }))
    .filter((item) => item.url);
  const dirtyMedia = (input.dirtyMedia ?? [])
    .map((item) => ({
      name: item.name,
      url: whatsAppMediaUrl(item.url, origin, item.kind) || item.url,
    }))
    .filter((item) => item.url || item.name);
  const at = input.at ?? new Date();
  const body = loadWhatsAppText(
    input.farmName,
    input.user,
    input.items,
    input.note ?? "",
    input.byLoader ?? false,
    dirtyMedia,
    shareMedia,
  );
  const snapshot: LoadShareSnapshot = {
    farmName: input.farmName,
    user: input.user,
    at: at.toISOString(),
    note: input.note?.trim() ?? "",
    lines: body.split("\n"),
    media: shareMedia,
  };
  return {
    text: body,
    pageUrl: loadSharePageUrl(origin, snapshot),
    snapshot,
  };
}

export function whatsAppUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
