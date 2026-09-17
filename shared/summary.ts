import type { LoadItem } from "./types";

export function loadedQty(item: LoadItem): number | null {
  if (item.mark === "full") return item.toSupply;
  if (item.mark === "partial") return item.haveQty ?? 0;
  if (item.mark === "none") return 0;
  return null;
}

export function loadWhatsAppText(
  farmName: string,
  user: string,
  items: LoadItem[],
  note = "",
  byLoader = false,
  dirtyMedia: { name: string; url: string }[] = [],
) {
  const lines = [`העמסה · ${farmName}`, `${user} · ${new Date().toLocaleString("he-IL")}`, ""];
  const stock = items.filter((item) => item.kind === "stock");
  const containers = items.filter((item) => item.kind === "container");
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
    lines.push("", "ציוד מלוכלך:");
    for (const item of dirtyMedia) {
      lines.push(item.url || item.name);
    }
  }
  return lines.join("\n").trim();
}

export function whatsAppUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
