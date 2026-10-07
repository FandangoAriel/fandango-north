import assert from "node:assert/strict";
import { loadShareMessage, parseLoadShare, showLoadSaveOnly, whatsAppMediaUrl, type LoadShareSnapshot } from "./summary";
import type { LoadItem } from "./types";

const items: LoadItem[] = [
  {
    itemId: "note:1",
    kind: "note",
    name: "1234",
    toSupply: 1,
    mark: "unset",
  },
  {
    itemId: "stock-1",
    kind: "stock",
    name: "חביות",
    toSupply: 4,
    mark: "full",
  },
  {
    itemId: "box-1",
    kind: "container",
    name: "לקוח א",
    detail: "450",
    toSupply: 1,
    mark: "none",
  },
];

assert.equal(showLoadSaveOnly("", 0), true);
assert.equal(showLoadSaveOnly("  ", 0), true);
assert.equal(showLoadSaveOnly("הערה", 0), false);
assert.equal(showLoadSaveOnly("", 1), false);

const { text, pageUrl } = loadShareMessage({
  farmName: "כפר חסידים",
  user: "אריאל",
  items,
  note: "להביא מפתח",
  dirtyMedia: [{ name: "סרטון", url: "/api/media/dirty1234" }],
  shareMedia: [{ kind: "video", name: "סרטון", url: "/api/media/abc12345" }],
  origin: "https://example.com",
  at: new Date("2026-10-07T12:00:00.000Z"),
});

assert.match(text, /חביות — צריך 4, הועמס 4/);
assert.match(text, /1234 — לא סומן/);
assert.match(text, /לקוח א · 450 — אין/);
assert.match(text, /הערה: להביא מפתח/);
assert.match(text, /צפייה בסרטון שנשלח:\nhttps:\/\/example.com\/api\/media\/dirty1234\.jpg/);
assert.match(text, /תמונה או סרטון מהמעמיס:\nhttps:\/\/example.com\/api\/media\/abc12345\.mp4/);
assert.equal(text.includes("לצפייה ברשימה ובסרטון"), false);
assert.equal(text.includes("view=load"), false);
assert.equal(text.includes("ע״י המעמיס"), false);
assert.equal(
  whatsAppMediaUrl("/api/media/d9fb5bbc-6e47-419b-89cb-4d13b1f3d80d", "https://example.com", "image"),
  "https://example.com/api/media/d9fb5bbc6e47419b89cb4d13b1f3d80d.jpg",
);
assert.equal(whatsAppMediaUrl("/api/media/d9fb5bbc-6e47-419b-89cb-4d13b1f3d80d", "https://example.com", "image").includes("-"), false);
assert.equal(pageUrl.startsWith("https://example.com/?view=load#"), true);

const parsed = parseLoadShare(new URL(pageUrl).hash);
assert.ok(parsed);
assert.equal(parsed?.farmName, "כפר חסידים");
assert.equal(parsed?.note, "להביא מפתח");
assert.equal(parsed?.media[0]?.url, "https://example.com/api/media/abc12345.mp4");
assert.equal(parsed?.media[0]?.kind, "video");
assert.match(parsed?.lines.join("\n") ?? "", /חביות — צריך 4, הועמס 4/);

const evil: LoadShareSnapshot = {
  farmName: "חווה",
  user: "",
  at: "",
  note: "",
  lines: ["שורה"],
  media: [{ kind: "video", name: "x", url: "javascript:alert(1)" }],
};
assert.equal(parseLoadShare(`#${encodeURIComponent(JSON.stringify(evil))}`)?.media.length, 0);
assert.equal(parseLoadShare("#not-json"), null);

console.log("summary tests ok");
