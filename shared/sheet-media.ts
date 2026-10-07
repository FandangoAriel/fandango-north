/** One Google Sheets cell stays under the 50,000 character limit. */
export const SHEET_CELL_CHARS = 40_000;
/** Enough chunks for a short equipment video, still under the API body limit. */
export const SHEET_MEDIA_MAX_CHUNKS = 100;
export const SHEET_MEDIA_MAX_CHARS = SHEET_CELL_CHARS * SHEET_MEDIA_MAX_CHUNKS;
export const TARGET_IMAGE_BYTES = 18_000;

export function canStoreMediaInSheet(base64: string | undefined): base64 is string {
  return typeof base64 === "string" && base64.length > 0 && base64.length <= SHEET_MEDIA_MAX_CHARS;
}

export function splitSheetMedia(data: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += SHEET_CELL_CHARS) {
    chunks.push(data.slice(i, i + SHEET_CELL_CHARS));
  }
  return chunks;
}

export function joinSheetMedia(cells: Array<string | undefined>): string {
  const parts: string[] = [];
  for (const cell of cells) {
    const part = String(cell ?? "").trim();
    if (!part) break;
    parts.push(part);
  }
  return parts.join("");
}

/** `undefined` header means the whole file. `null` means the range cannot be satisfied. */
export function parseByteRange(
  size: number,
  header: string | null | undefined,
): { start: number; end: number } | null {
  if (!header?.trim()) return { start: 0, end: Math.max(0, size - 1) };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || size <= 0) return null;
  const startRaw = match[1] ?? "";
  const endRaw = match[2] ?? "";
  if (!startRaw && !endRaw) return null;
  let start: number;
  let end: number;
  if (!startRaw) {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end >= size) end = size - 1;
  if (start < 0 || start >= size || end < start) return null;
  return { start, end };
}

export function mediaApiUrl(id: string) {
  return `/api/media/${id}`;
}

const MEDIA_EXT = /\.(?:jpe?g|png|mp4|webm|mov|m4v)$/i;

/** Ids as stored, plus a hyphen-free UUID restored to the canonical dashed form. */
export function mediaLookupIds(raw: string): string[] {
  const noExt = decodeURIComponent(raw).replace(MEDIA_EXT, "");
  const ids = new Set<string>();
  if (noExt) ids.add(noExt);
  const hex = noExt.replace(/-/g, "");
  if (/^[0-9a-fA-F]{32}$/.test(hex)) {
    const lower = hex.toLowerCase();
    ids.add(lower);
    ids.add(`${lower.slice(0, 8)}-${lower.slice(8, 12)}-${lower.slice(12, 16)}-${lower.slice(16, 20)}-${lower.slice(20)}`);
  }
  return [...ids];
}
