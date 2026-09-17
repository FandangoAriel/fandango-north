import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), ".data", "media");
const ID_OK = /^[a-zA-Z0-9._-]+$/;

export const MAX_MEDIA_BYTES = 4_000_000;

export function mediaIdOk(id: string) {
  return ID_OK.test(id) && id.length <= 80;
}

export function saveMediaFile(id: string, mime: string, data: Buffer) {
  if (!mediaIdOk(id)) throw new Error("bad_media_id");
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, id), data);
  writeFileSync(join(DIR, `${id}.meta.json`), JSON.stringify({ mime }));
}

export function readMediaFile(id: string) {
  if (!mediaIdOk(id)) return null;
  const path = join(DIR, id);
  if (!existsSync(path)) return null;
  const data = readFileSync(path);
  let mime = "application/octet-stream";
  try {
    const meta = JSON.parse(readFileSync(join(DIR, `${id}.meta.json`), "utf8")) as { mime?: string };
    if (meta.mime) mime = meta.mime;
  } catch {
    // ignore
  }
  return { mime, data };
}
