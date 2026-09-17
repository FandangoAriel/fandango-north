import { TARGET_IMAGE_BYTES } from "../shared/sheet-media";

const DB_NAME = "fandango-dirty-media";
const STORE = "files";

export const MAX_MEDIA_BYTES = 4_000_000;

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(id: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGet(id: string) {
  const db = await openDb();
  return new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function compressImage(file: File) {
  async function render(source: ImageBitmap | File, maxSize: number, quality: number) {
    const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (!(source instanceof ImageBitmap)) bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (!(source instanceof ImageBitmap)) bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
    return blob ?? file;
  }

  const original = await createImageBitmap(file).catch(() => undefined);
  if (!original) return file;
  let maxSize = 960;
  let quality = 0.62;
  let blob: Blob = await render(original, maxSize, quality);
  while (blob.size > TARGET_IMAGE_BYTES && (quality > 0.34 || maxSize > 480)) {
    if (quality > 0.34) quality = Math.max(0.34, quality - 0.08);
    else maxSize = Math.round(maxSize * 0.75);
    blob = await render(original, maxSize, quality);
  }
  original.close();
  return blob;
}

export async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function kindFromMime(mime: string, name: string): "image" | "video" {
  if (mime.startsWith("video/") || /\.(mp4|mov|webm|m4v|3gp)$/i.test(name)) return "video";
  return "image";
}
