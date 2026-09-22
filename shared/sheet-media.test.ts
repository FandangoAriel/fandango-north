import assert from "node:assert/strict";
import { canStoreMediaInSheet, mediaApiUrl, SHEET_MEDIA_MAX_CHARS } from "./sheet-media";

assert.equal(canStoreMediaInSheet("abc"), true);
assert.equal(canStoreMediaInSheet(""), false);
assert.equal(canStoreMediaInSheet(undefined), false);
assert.equal(canStoreMediaInSheet("x".repeat(SHEET_MEDIA_MAX_CHARS)), true);
assert.equal(canStoreMediaInSheet("x".repeat(SHEET_MEDIA_MAX_CHARS + 1)), false);
assert.equal(mediaApiUrl("pic-1"), "/api/media/pic-1");
console.log("sheet-media tests passed");
