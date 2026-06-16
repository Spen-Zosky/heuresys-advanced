/**
 * apps/api/src/lib/export/serializers.ts — 3.5 reporting/export.
 *
 * Flat-list serializers for the generic `?format=csv|xlsx|pdf` export hook
 * (export-hook.ts). Input is the `items` array of any `{items,total}` list
 * endpoint; output is a downloadable buffer/string. Unlike analytics/csv.ts
 * (multi-section, for nested aggregate views), these render ONE table:
 * header = union of item keys (first-seen order), one row per item.
 *
 * Object/array cell values are JSON-stringified; null/undefined → empty.
 */
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { csvCell } from "../../modules/analytics/csv.js";

type Row = Record<string, unknown>;

/** Header = union of keys across all rows, first-seen order. */
export function unionKeys(rows: Row[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
}

/** Scalar string for xlsx/pdf cells (objects/arrays → JSON, null/undefined → ""). */
function plain(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** CSV (RFC-4180 via csvCell): header row + one row per item. */
export function listToCsv(items: Row[]): string {
  const cols = unionKeys(items);
  const lines = [cols.map(csvCell).join(",")];
  for (const it of items) lines.push(cols.map((c) => csvCell(it[c])).join(","));
  return lines.join("\n") + "\n";
}

/** XLSX via exceljs: one worksheet, bold header row, one row per item. */
export async function listToXlsx(items: Row[], sheetName = "export"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  // Excel caps sheet names at 31 chars and forbids []:*?/\ — sanitize.
  const ws = wb.addWorksheet(sheetName.replace(/[[\]:*?/\\]/g, "_").slice(0, 31) || "export");
  const cols = unionKeys(items);
  const header = ws.addRow(cols);
  header.font = { bold: true };
  for (const it of items) ws.addRow(cols.map((c) => plain(it[c])));
  // Reasonable column widths (clamped) for readability.
  ws.columns.forEach((col, i) => {
    const key = cols[i] ?? "";
    const maxLen = items.reduce((m, it) => Math.max(m, plain(it[key]).length), key.length);
    col.width = Math.min(Math.max(maxLen + 2, 10), 60);
  });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * PDF via pdfkit: landscape A4 table. Lists are wide & heterogeneous, so columns
 * beyond what fits are dropped with an explicit note (full data stays in CSV/XLSX);
 * cell text is truncated to its column and rows paginate automatically.
 */
export function listToPdf(items: Row[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const usable = right - left;
    const allCols = unionKeys(items);
    // Each column needs ~80pt to be legible; cap how many we render.
    const maxCols = Math.max(1, Math.min(allCols.length, Math.floor(usable / 80)));
    const cols = allCols.slice(0, maxCols);
    const dropped = allCols.length - cols.length;
    const colW = usable / cols.length;
    const rowH = 14;
    const fontSize = 7;

    const bottom = doc.page.height - doc.page.margins.bottom;

    doc.fontSize(13).font("Helvetica-Bold").text(title, left, doc.page.margins.top);
    doc.moveDown(0.3);
    doc.fontSize(8).font("Helvetica").fillColor("#555").text(
      `${items.length} row(s)` + (dropped > 0 ? ` · ${dropped} column(s) omitted — use CSV/XLSX for the full dataset` : ""),
    );
    doc.fillColor("#000");
    let y = doc.y + 6;

    const fit = (text: string, width: number): string => {
      let s = text;
      while (s.length > 0 && doc.widthOfString(s) > width - 4) s = s.slice(0, -1);
      return s.length < text.length ? s.slice(0, Math.max(0, s.length - 1)) + "…" : s;
    };

    const drawHeader = () => {
      doc.fontSize(fontSize).font("Helvetica-Bold");
      cols.forEach((c, i) => doc.text(fit(c, colW), left + i * colW + 2, y, { lineBreak: false, width: colW }));
      y += rowH;
      doc.moveTo(left, y - 3).lineTo(right, y - 3).strokeColor("#999").lineWidth(0.5).stroke();
      doc.font("Helvetica");
    };

    drawHeader();
    for (const it of items) {
      if (y + rowH > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
      cols.forEach((c, i) => doc.text(fit(plain(it[c]), colW), left + i * colW + 2, y, { lineBreak: false, width: colW }));
      y += rowH;
    }
    doc.end();
  });
}
