import assert from "node:assert/strict";
import { inventoryNoteItem, noteItemId, withInventoryNote, type LoadItem } from "./types";

const report = {
  at: "2026-10-07T09:00:00.000Z",
  note: "1234",
  user: "אריאל",
  kind: "inventory" as const,
};

const item = inventoryNoteItem([report], []);
assert.ok(item);
assert.equal(item?.kind, "note");
assert.equal(item?.name, "1234");
assert.equal(item?.itemId, noteItemId(report.at));
assert.equal(item?.mark, "unset");

assert.equal(
  inventoryNoteItem([{ ...report, note: "  " }, { ...report, at: "2026-10-06T09:00:00.000Z", note: "ישן" }], [])
    ?.name,
  "ישן",
);

const marked = inventoryNoteItem(
  [report],
  [{ at: "2026-10-07T10:00:00.000Z", items: [{ itemId: noteItemId(report.at), mark: "full" }] }],
);
assert.equal(marked, null);

const stillOpen = inventoryNoteItem(
  [report],
  [{ at: "2026-10-07T10:00:00.000Z", items: [{ itemId: noteItemId(report.at), mark: "unset" }] }],
);
assert.equal(stillOpen?.name, "1234");

const tooEarly = inventoryNoteItem(
  [report],
  [{ at: "2026-10-07T08:00:00.000Z", items: [{ itemId: noteItemId(report.at), mark: "full" }] }],
);
assert.equal(tooEarly?.name, "1234");

const replaced = inventoryNoteItem(
  [
    { at: "2026-10-07T12:00:00.000Z", note: "", user: "", kind: "inventory" },
    report,
  ],
  [],
);
assert.equal(replaced?.name, "1234");

const stock: LoadItem = {
  itemId: "stock-1",
  kind: "stock",
  name: "חביות",
  toSupply: 2,
  mark: "unset",
};
assert.equal(withInventoryNote([stock], item)[0]?.kind, "note");
assert.equal(withInventoryNote([stock], null).length, 1);

console.log("load-note tests passed");
