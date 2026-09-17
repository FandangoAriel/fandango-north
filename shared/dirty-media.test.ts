import assert from "node:assert/strict";
import { mediaApiUrl } from "./sheet-media";
import { dirtyMediaFromReports, driveFileId, mediaPreviewUrl, type ReportRecord } from "./types";

const reports: ReportRecord[] = [
  {
    id: "load-1",
    at: "2026-09-17T10:00:00.000Z",
    user: "יוסי",
    farmId: "beit-haemek",
    kind: "load",
    items: [],
    dirtyMedia: [{ id: "skip", kind: "image", name: "no", mime: "image/jpeg", url: "/api/media/skip" }],
  },
  {
    id: "inv-1",
    at: "2026-09-17T09:00:00.000Z",
    user: "מיכל",
    farmId: "beit-haemek",
    kind: "inventory",
    items: [],
    dirtyMedia: [
      { id: "pic-1", kind: "image", name: "דלי", mime: "image/jpeg", url: "/api/media/pic-1" },
      { id: "vid-1", kind: "video", name: "חבית", mime: "video/mp4", url: "https://drive.google.com/file/d/abc1234567/view" },
    ],
  },
  {
    id: "inv-0",
    at: "2026-09-16T09:00:00.000Z",
    user: "דוד",
    farmId: "beit-haemek",
    items: [],
    dirtyMedia: [{ id: "pic-1", kind: "image", name: "dup", mime: "image/jpeg", url: "/api/media/pic-1" }],
  },
];

const items = dirtyMediaFromReports(reports);
assert.equal(items.length, 2);
assert.equal(items[0]?.id, "pic-1");
assert.equal(items[0]?.user, "מיכל");
assert.equal(items[1]?.kind, "video");
assert.equal(driveFileId("https://drive.google.com/file/d/abc1234567/view"), "abc1234567");
assert.equal(mediaPreviewUrl(items[1]!), "/api/media/abc1234567");
assert.equal(mediaPreviewUrl(items[0]!), mediaApiUrl("pic-1"));
assert.equal(mediaPreviewUrl(items[0]!), "/api/media/pic-1");
assert.equal(
  mediaPreviewUrl({
    id: "x",
    kind: "image",
    url: "https://drive.google.com/uc?id=abcdefghij&export=view",
  }),
  "/api/media/abcdefghij",
);
assert.equal(dirtyMediaFromReports(reports.filter((item) => !item.dirtyMedia)).length, 0);
console.log("dirty-media tests passed");
