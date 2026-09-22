import assert from "node:assert/strict";
import { detectSheetLayout, parseFarmSheet, columnA1, lastEquipmentRowIndex, nextEquipmentSerial, newEquipmentRowValues } from "./sheet-layout";
import { toBringQty } from "./types";

const beitHaemek: string[][] = [
  ["", "בית העמק", "", "17/09/2026"],
  ["", "", "", "", "בית העמק", "", "", "", "בית העמק", "מיכלים משולטים"],
  ["", "ציוד", "", "", "ציוד לספק", "", "", "", "מספר + שם לקוח", "סוג מיכל"],
  ["1", "חביות", "23", "40", "חביות", "17", "FALSE", "", "13793-מסעדת כוכב גני הגליל", "601 - לשנות השילוט", "FALSE"],
  ["2", "עגלות לחביות", "21", "20", "עגלות לחביות", "-1", "FALSE", "", "", "", "FALSE"],
  ["3", "מיכסים לחביות", "0", "10", "מיכסים לחביות", "10", "FALSE", "", "להביא חזרה מבית העמק", "מיכל 600", "FALSE"],
  ["4", "מנעולי קאבה", "2", "15", "מנעולי קאבה", "13", "FALSE", "", "", "", "FALSE"],
];

const kfarHasidim: string[][] = [
  ["כפר חסידים", "", "20/05/2026"],
  ["", "", "", "", "", "מיכלים משולטים"],
  ["ציוד", "", "", "", "", "תאריך פעילות מתוכנן", "מס' לקוח", "שם לקוח", "סוג מיכל"],
  ["חביות", "7", "32", "25", "", "", "", "", "", "", "FALSE"],
  ["עגלות לחביות", "3", "20", "17", "", "", "", "", "", "", "FALSE"],
];

const namedMax: string[][] = [
  ["ציוד", "מלאי קיים", "מלאי מקסימום"],
  ["חביות", "23", "40"],
  ["עגלות לחביות", "21", "20"],
];

{
  const parsed = parseFarmSheet("beit-haemek", beitHaemek);
  assert.equal(parsed.equipment[0]?.name, "חביות");
  assert.equal(parsed.equipment[0]?.actual, 23);
  assert.equal(parsed.equipment[0]?.maxStock, 40);
  assert.equal(parsed.equipment[1]?.name, "עגלות לחביות");
  assert.equal(parsed.equipment[1]?.maxStock, 20);
  assert.equal(parsed.equipment[1]?.toComplete, 0);
  assert.ok(!parsed.equipment.some((item) => /^\d+$/.test(item.name)));
  assert.equal(parsed.updatedAt, "2026-09-17");
  assert.equal(parsed.containers.length, 2);
  assert.equal(parsed.containers[0]?.customerName, "13793-מסעדת כוכב גני הגליל");
  assert.equal(parsed.containers[0]?.containerType, "601 - לשנות השילוט");
  assert.ok(!parsed.containers.some((item) => /false/i.test(`${item.customerName} ${item.containerType}`)));
  assert.equal(parsed.layout.maxCol, 3);
  assert.equal(parsed.layout.serialCol, 0);
  assert.equal(parsed.layout.supplyNameCol, 4);
  assert.equal(parsed.layout.completeCol, 5);
  assert.equal(parsed.layout.flagCol, 6);
}

{
  const parsed = parseFarmSheet("kfar-hasidim", kfarHasidim);
  assert.equal(parsed.equipment[0]?.name, "חביות");
  assert.equal(parsed.equipment[0]?.actual, 7);
  assert.equal(parsed.equipment[0]?.maxStock, 32);
  assert.equal(parsed.containers.length, 0);
  assert.equal(parsed.layout.maxCol, 2);
  assert.equal(parsed.layout.serialCol, -1);
  assert.equal(parsed.layout.flagCol, -1);
}

{
  const layout = detectSheetLayout("beit-haemek", namedMax);
  const parsed = parseFarmSheet("beit-haemek", namedMax);
  assert.equal(layout.maxCol, 2);
  assert.equal(layout.actualCol, 1);
  assert.equal(parsed.equipment[0]?.name, "חביות");
  assert.equal(parsed.equipment[0]?.maxStock, 40);
  assert.equal(parsed.equipment[0]?.actual, 23);
  assert.equal(parsed.equipment[1]?.toComplete, 0);
}

assert.equal(toBringQty(21, 20), 0);
assert.equal(toBringQty(21, 20, -1), 0);
assert.equal(toBringQty(23, 40, 17), 17);
assert.equal(columnA1(0), "A");
assert.equal(columnA1(5), "F");

{
  const parsed = parseFarmSheet("beit-haemek", beitHaemek);
  const last = lastEquipmentRowIndex(beitHaemek, parsed.layout, "בית העמק");
  assert.equal(last, 6);
  assert.equal(nextEquipmentSerial(beitHaemek, parsed.layout), 5);
  const row = newEquipmentRowValues(
    parsed.layout,
    { name: "פריט חדש", actual: 2, maxStock: 8, serial: 5 },
    beitHaemek[last],
  );
  assert.deepEqual(row, [5, "פריט חדש", 2, 8, "פריט חדש", 6, "FALSE"]);
}

{
  const parsed = parseFarmSheet("kfar-hasidim", kfarHasidim);
  const row = newEquipmentRowValues(parsed.layout, { name: "פריט חדש", actual: 2, maxStock: 8 });
  assert.deepEqual(row, ["פריט חדש", 2, 8, 6]);
}

console.log("sheet-layout tests passed");
