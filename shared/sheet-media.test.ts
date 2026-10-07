import assert from "node:assert/strict";
import {
  canStoreMediaInSheet,
  joinSheetMedia,
  mediaApiUrl,
  mediaLookupIds,
  parseByteRange,
  SHEET_CELL_CHARS,
  SHEET_MEDIA_MAX_CHARS,
  splitSheetMedia,
} from "./sheet-media";

assert.equal(canStoreMediaInSheet("abc"), true);
assert.equal(canStoreMediaInSheet(""), false);
assert.equal(canStoreMediaInSheet(undefined), false);
assert.equal(canStoreMediaInSheet("x".repeat(SHEET_MEDIA_MAX_CHARS)), true);
assert.equal(canStoreMediaInSheet("x".repeat(SHEET_MEDIA_MAX_CHARS + 1)), false);
assert.equal(mediaApiUrl("pic-1"), "/api/media/pic-1");
assert.deepEqual(mediaLookupIds("d9fb5bbc6e47419b89cb4d13b1f3d80d.jpg"), [
  "d9fb5bbc6e47419b89cb4d13b1f3d80d",
  "d9fb5bbc-6e47-419b-89cb-4d13b1f3d80d",
]);

{
  const data = "a".repeat(SHEET_CELL_CHARS) + "b".repeat(12);
  const chunks = splitSheetMedia(data);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0]?.length, SHEET_CELL_CHARS);
  assert.equal(joinSheetMedia([...chunks, "", "ignored"]), data);
  assert.equal(joinSheetMedia(["abc"]), "abc");
}

assert.deepEqual(parseByteRange(10, undefined), { start: 0, end: 9 });
assert.deepEqual(parseByteRange(10, "bytes=0-3"), { start: 0, end: 3 });
assert.deepEqual(parseByteRange(10, "bytes=8-"), { start: 8, end: 9 });
assert.deepEqual(parseByteRange(10, "bytes=-4"), { start: 6, end: 9 });
assert.equal(parseByteRange(10, "bytes=20-30"), null);
console.log("sheet-media tests passed");
