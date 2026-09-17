export const SHEET_MEDIA_MAX_CHARS = 45_000;
export const TARGET_IMAGE_BYTES = 18_000;

export function canStoreMediaInSheet(base64: string | undefined): base64 is string {
  return typeof base64 === "string" && base64.length > 0 && base64.length <= SHEET_MEDIA_MAX_CHARS;
}

export function mediaApiUrl(id: string) {
  return `/api/media/${id}`;
}
