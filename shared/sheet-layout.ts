import type { FarmId, LabeledContainer } from "./types";
import { FARM_SHEETS, isSuppliedFlag, parseCompleteCell, toBringQty, todayIso } from "./types";

export type SheetRow = (string | undefined)[];

export interface DetectedLayout {
  headerRow: number;
  nameCol: number;
  actualCol: number;
  maxCol: number;
  completeCol: number;
  /** Column with 1, 2, 3… before the name. -1 when the farm has no serials. */
  serialCol: number;
  /** "ציוד לספק" name copy. -1 when missing. */
  supplyNameCol: number;
  /** TRUE/FALSE checkbox after the qty-to-bring. -1 when missing. */
  flagCol: number;
  container: { customerId: number; customerName: number; type: number; supplied: number };
}

export interface ParsedEquipment {
  name: string;
  actual: number;
  maxStock: number;
  toComplete: number;
}

export interface ParsedFarmSheet {
  updatedAt: string;
  equipment: ParsedEquipment[];
  containers: Omit<LabeledContainer, "id">[];
  layout: DetectedLayout;
}

const BOOLEAN_VALUES = new Set(["true", "false", "yes", "no", "כן", "לא"]);

const HEADER_LABELS = new Set([
  "ציוד",
  "פריט",
  "שם",
  "מלאי",
  "מקס",
  "מלאי קיים",
  "מלאי מקסימום",
  "מקסימום",
  "ציוד לספק",
  "סוג מיכל",
  "שם לקוח",
  "מספר + שם לקוח",
  "מס לקוח",
  "מס' לקוח",
  "מיכלים משולטים",
  "תאריך פעילות מתוכנן",
]);

function cell(row: SheetRow | undefined, index: number): string {
  return String(row?.[index] ?? "").trim();
}

function normalizeHeader(value: string): string {
  return value
    .replace(/['׳`"]/g, "")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBooleanCell(value: string | undefined): boolean {
  return BOOLEAN_VALUES.has(String(value ?? "").trim().toLowerCase());
}

export function isSerialCell(value: string | undefined): boolean {
  return /^\d+$/.test(String(value ?? "").trim());
}

function farmNames(): Set<string> {
  return new Set(Object.values(FARM_SHEETS).map((item) => item.name));
}

export function isEquipmentName(value: string | undefined, farmName?: string): boolean {
  const name = String(value ?? "").trim();
  if (!name || isBooleanCell(name) || isSerialCell(name)) return false;
  if (HEADER_LABELS.has(name) || HEADER_LABELS.has(normalizeHeader(name))) return false;
  if (farmName && name === farmName) return false;
  if (farmNames().has(name)) return false;
  return /[\p{L}]/u.test(name);
}

export function isUsefulLabel(value: string | undefined): boolean {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || isBooleanCell(text) || text.length <= 1) return false;
  if (HEADER_LABELS.has(text) || HEADER_LABELS.has(normalizeHeader(text))) return false;
  if (farmNames().has(text)) return false;
  if (isSerialCell(text)) return false;
  return /[\p{L}]/u.test(text);
}

function headerIndex(row: SheetRow | undefined, matcher: (normalized: string, raw: string) => boolean): number {
  if (!row) return -1;
  for (let i = 0; i < row.length; i += 1) {
    const raw = cell(row, i);
    if (!raw) continue;
    if (matcher(normalizeHeader(raw), raw)) return i;
  }
  return -1;
}

function findHeaderRow(rows: SheetRow[]): number {
  const limit = Math.min(rows.length, 10);
  for (let i = 0; i < limit; i += 1) {
    if (headerIndex(rows[i], (normalized, raw) => raw === "ציוד" || normalized === "ציוד") >= 0) {
      return i;
    }
  }
  return -1;
}

function findMaxColumn(rows: SheetRow[], headerRow: number): number {
  const start = Math.max(0, headerRow - 1);
  const end = Math.min(rows.length, headerRow + 2);
  for (let i = start; i < end; i += 1) {
    const index = headerIndex(
      rows[i],
      (normalized) => normalized === "מלאי מקסימום" || normalized.includes("מקסימום"),
    );
    if (index >= 0) return index;
  }
  return -1;
}

function findActualColumn(rows: SheetRow[], headerRow: number): number {
  const start = Math.max(0, headerRow - 1);
  const end = Math.min(rows.length, headerRow + 2);
  for (let i = start; i < end; i += 1) {
    const index = headerIndex(
      rows[i],
      (normalized) =>
        normalized === "מלאי קיים" ||
        (normalized.includes("מלאי") && normalized.includes("קיים")),
    );
    if (index >= 0) return index;
  }
  return -1;
}

function findCompleteColumn(header: SheetRow | undefined, fallback: number): number {
  // "ציוד לספק" copies the item name; the qty to complete is the next column.
  const supplyName = headerIndex(
    header,
    (normalized, raw) => raw.startsWith("ציוד לספק") || normalized.startsWith("ציוד לספק"),
  );
  if (supplyName >= 0) return supplyName + 1;
  const complete = headerIndex(
    header,
    (normalized) => normalized.includes("השלמה") && !normalized.includes("מקסימום"),
  );
  return complete >= 0 ? complete : fallback;
}

function detectSuppliedColumn(
  rows: SheetRow[],
  headerRow: number,
  typeCol: number,
  fallback: number,
): number {
  const start = headerRow + 1;
  const end = Math.min(rows.length, headerRow + 16);
  for (let col = typeCol + 1; col <= typeCol + 4; col += 1) {
    const samples: string[] = [];
    for (let i = start; i < end; i += 1) {
      const value = cell(rows[i], col);
      if (value) samples.push(value);
    }
    if (samples.length && samples.every((value) => isBooleanCell(value))) return col;
  }
  return fallback;
}

function detectSerialCol(rows: SheetRow[], headerRow: number, nameCol: number): number {
  if (nameCol <= 0) return -1;
  const serialCol = nameCol - 1;
  const start = headerRow + 1;
  const end = Math.min(rows.length, start + 10);
  let serials = 0;
  for (let i = start; i < end; i += 1) {
    if (isSerialCell(cell(rows[i], serialCol))) serials += 1;
  }
  return serials >= 1 ? serialCol : -1;
}

function detectSupplyNameCol(
  header: SheetRow | undefined,
  rows: SheetRow[],
  headerRow: number,
  nameCol: number,
  completeCol: number,
): number {
  const fromHeader = headerIndex(
    header,
    (normalized, raw) => raw.startsWith("ציוד לספק") || normalized.startsWith("ציוד לספק"),
  );
  if (fromHeader >= 0) return fromHeader;
  const guess = completeCol - 1;
  if (guess <= nameCol) return -1;
  const firstData = rows[headerRow + 1] ?? [];
  const name = cell(firstData, nameCol);
  if (name && cell(firstData, guess) === name && isEquipmentName(name)) return guess;
  return -1;
}

function detectFlagCol(rows: SheetRow[], headerRow: number, completeCol: number): number {
  const col = completeCol + 1;
  const start = headerRow + 1;
  const end = Math.min(rows.length, start + 10);
  for (let i = start; i < end; i += 1) {
    if (isBooleanCell(cell(rows[i], col))) return col;
  }
  return -1;
}

function withRowShape(
  rows: SheetRow[],
  headerRow: number,
  layout: Omit<DetectedLayout, "serialCol" | "supplyNameCol" | "flagCol">,
): DetectedLayout {
  return {
    ...layout,
    serialCol: detectSerialCol(rows, headerRow, layout.nameCol),
    supplyNameCol: detectSupplyNameCol(rows[headerRow], rows, headerRow, layout.nameCol, layout.completeCol),
    flagCol: detectFlagCol(rows, headerRow, layout.completeCol),
  };
}

export function detectSheetLayout(farmId: FarmId, rows: SheetRow[]): DetectedLayout {
  const meta = FARM_SHEETS[farmId];
  const fallback = withRowShape(rows, Math.max(0, meta.startRow - 2), {
    headerRow: Math.max(0, meta.startRow - 2),
    nameCol: meta.equipment.name,
    actualCol: meta.equipment.actual,
    maxCol: meta.equipment.maxStock,
    completeCol: meta.equipment.complete,
    container: { ...meta.container },
  });

  const headerRow = findHeaderRow(rows);
  if (headerRow < 0) return fallback;

  const header = rows[headerRow];
  const nameColRaw = headerIndex(header, (_normalized, raw) => raw === "ציוד");
  const nameCol = nameColRaw >= 0 ? nameColRaw : fallback.nameCol;

  const headerMax = findMaxColumn(rows, headerRow);
  const headerActual = findActualColumn(rows, headerRow);

  let actualCol = headerActual >= 0 ? headerActual : nameCol + 1;
  let maxCol = headerMax >= 0 ? headerMax : nameCol + 2;

  // When headers are missing, a serial in column A means name/actual/max are B/C/D.
  if (headerMax < 0 || headerActual < 0) {
    const firstData = rows[headerRow + 1] ?? [];
    if (isSerialCell(cell(firstData, 0)) && isEquipmentName(cell(firstData, 1), meta.name)) {
      if (headerActual < 0) actualCol = 2;
      if (headerMax < 0) maxCol = 3;
    } else if (isEquipmentName(cell(firstData, 0), meta.name)) {
      if (headerActual < 0) actualCol = 1;
      if (headerMax < 0) maxCol = 2;
    }
  }

  const customerNameRaw = headerIndex(
    header,
    (normalized) =>
      normalized.includes("שם לקוח") ||
      normalized.includes("מספר + שם לקוח") ||
      normalized === "מספר שם לקוח",
  );
  const customerName = customerNameRaw >= 0 ? customerNameRaw : fallback.container.customerName;

  const customerIdRaw = headerIndex(
    header,
    (normalized) => normalized === "מס לקוח" || normalized.includes("מס לקוח") || normalized === "מספר לקוח",
  );
  const customerId = customerIdRaw >= 0 ? customerIdRaw : customerName;

  const typeRaw = headerIndex(header, (normalized) => normalized === "סוג מיכל" || normalized.includes("סוג מיכל"));
  const type = typeRaw >= 0 ? typeRaw : fallback.container.type;
  const supplied = detectSuppliedColumn(rows, headerRow, type, fallback.container.supplied);
  const completeCol = findCompleteColumn(header, fallback.completeCol);

  return withRowShape(rows, headerRow, {
    headerRow,
    nameCol,
    actualCol,
    maxCol,
    completeCol,
    container: { customerId, customerName, type, supplied },
  });
}

function parseSheetNumber(value: string | undefined): number {
  const n = Number(String(value ?? "").replace(/,/g, "").replace(/[−–]/g, "-").trim());
  return Number.isFinite(n) ? n : 0;
}

export function columnA1(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function findUpdatedAt(rows: SheetRow[]): string {
  for (const row of rows.slice(0, 3)) {
    for (const value of row ?? []) {
      const text = String(value ?? "").trim();
      const match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
      if (!match) continue;
      const day = match[1].padStart(2, "0");
      const month = match[2].padStart(2, "0");
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];
      return `${year}-${month}-${day}`;
    }
  }
  return todayIso();
}

export function lastEquipmentRowIndex(rows: SheetRow[], layout: DetectedLayout, farmName?: string): number {
  let last = layout.headerRow;
  for (let i = layout.headerRow + 1; i < rows.length; i += 1) {
    if (isEquipmentName(cell(rows[i], layout.nameCol), farmName)) last = i;
  }
  return last;
}

export function nextEquipmentSerial(rows: SheetRow[], layout: DetectedLayout): number {
  if (layout.serialCol < 0) return 0;
  let max = 0;
  for (let i = layout.headerRow + 1; i < rows.length; i += 1) {
    const value = cell(rows[i], layout.serialCol);
    if (isSerialCell(value)) max = Math.max(max, Number(value));
  }
  return max + 1;
}

export function equipmentRowWidth(layout: DetectedLayout): number {
  return Math.max(layout.nameCol, layout.actualCol, layout.maxCol, layout.completeCol, layout.serialCol, layout.supplyNameCol, layout.flagCol, 0) + 1;
}

export function newEquipmentRowValues(
  layout: DetectedLayout,
  item: { name: string; actual: number; maxStock: number; serial?: number },
  template?: SheetRow,
): (string | number)[] {
  const width = equipmentRowWidth(layout);
  const row: (string | number)[] = Array.from({ length: width }, () => "");
  const complete = toBringQty(item.actual, item.maxStock);
  const templateName = template ? cell(template, layout.nameCol) : "";

  if (layout.serialCol >= 0 && item.serial != null && item.serial > 0) {
    row[layout.serialCol] = item.serial;
  }
  row[layout.nameCol] = item.name;
  row[layout.actualCol] = item.actual;
  row[layout.maxCol] = item.maxStock;
  row[layout.completeCol] = complete;
  if (layout.supplyNameCol >= 0) row[layout.supplyNameCol] = item.name;
  if (layout.flagCol >= 0) row[layout.flagCol] = "FALSE";

  if (template && templateName) {
    for (let col = 0; col < width; col += 1) {
      if (
        col === layout.actualCol ||
        col === layout.maxCol ||
        col === layout.completeCol ||
        col === layout.serialCol ||
        col === layout.flagCol
      ) {
        continue;
      }
      if (cell(template, col) === templateName) row[col] = item.name;
    }
  }
  return row;
}

export function parseFarmSheet(farmId: FarmId, rows: SheetRow[]): ParsedFarmSheet {
  const meta = FARM_SHEETS[farmId];
  const layout = detectSheetLayout(farmId, rows);
  const equipment: ParsedEquipment[] = [];
  const containers: Omit<LabeledContainer, "id">[] = [];

  for (let i = layout.headerRow + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const name = cell(row, layout.nameCol);
    if (isEquipmentName(name, meta.name)) {
      const actual = parseSheetNumber(row[layout.actualCol]);
      const maxStock = parseSheetNumber(row[layout.maxCol]);
      const fromComplete = parseCompleteCell(row[layout.completeCol]);
      equipment.push({
        name,
        actual,
        maxStock,
        toComplete: toBringQty(actual, maxStock, fromComplete),
      });
    }

    const customerName = isUsefulLabel(row[layout.container.customerName])
      ? cell(row, layout.container.customerName).replace(/\s+/g, " ")
      : "";
    const containerType = isUsefulLabel(row[layout.container.type])
      ? cell(row, layout.container.type).replace(/\s+/g, " ")
      : "";
    const customerIdValue = cell(row, layout.container.customerId);
    const customerId =
      customerIdValue &&
      !isBooleanCell(customerIdValue) &&
      layout.container.customerId !== layout.container.customerName
        ? customerIdValue
        : "";
    if (customerName || containerType) {
      containers.push({
        customerId,
        customerName,
        containerType,
        supplied: isSuppliedFlag(row[layout.container.supplied]),
      });
    }
  }

  return {
    updatedAt: findUpdatedAt(rows),
    equipment,
    containers,
    layout,
  };
}
