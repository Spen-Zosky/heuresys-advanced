/**
 * apps/api/test/istat-ateco-connector.test.ts
 * Unit tests for the ISTAT ATECO 2025 connector (cap⑤ 2nd source, S983 WS-C).
 * Pure fixture-driven: no live HTTP, no DB — parse/normalize/dedupe/guards.
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  ATECO_EXPECTED_HEADER,
  ATECO_SHEET_NAME,
  fetchAllAtecoActivities,
  normalizeAtecoRows,
  parseAtecoWorkbook,
  type AtecoFetcher,
  type RawAtecoRow,
} from "../src/modules/reference-sync/istat-ateco-connector.js";

const ROW = (over: Partial<RawAtecoRow>): RawAtecoRow => ({
  ordine: 1,
  code: "A",
  titleIt: "AGRICOLTURA",
  titleEn: "AGRICULTURE",
  titleDe: "LANDWIRTSCHAFT",
  level: 1,
  parentCode: null,
  ...over,
});

class FixtureFetcher implements AtecoFetcher {
  constructor(private readonly rows: RawAtecoRow[]) {}
  async fetchAll(): Promise<RawAtecoRow[]> {
    return this.rows;
  }
}

/** Build a tiny in-memory workbook in the official layout (header + data rows). */
async function buildWorkbook(rows: (string | number | null)[][], sheet = ATECO_SHEET_NAME): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet);
  ws.addRow([...ATECO_EXPECTED_HEADER]);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("istat-ateco-connector (unit)", () => {
  it("normalizeAtecoRows maps fields and routes EN/DE titles + ordine into metadata", () => {
    const [a] = normalizeAtecoRows([
      ROW({ code: "01.11", titleIt: "Coltivazione di cereali", level: 4, parentCode: "01.1", ordine: 4 }),
    ]);
    expect(a).toEqual({
      code: "01.11",
      parentCode: "01.1",
      titleIt: "Coltivazione di cereali",
      level: 4,
      metadata: { title_en: "AGRICULTURE", title_de: "LANDWIRTSCHAFT", ordine: 4 },
    });
  });

  it("normalizeAtecoRows skips rows missing code, IT title or level", () => {
    const out = normalizeAtecoRows([
      ROW({ code: null }),
      ROW({ titleIt: null }),
      ROW({ level: null }),
      ROW({ code: "B" }),
    ]);
    expect(out.map((r) => r.code)).toEqual(["B"]);
  });

  it("fetchAllAtecoActivities dedupes by code (last occurrence wins)", async () => {
    const out = await fetchAllAtecoActivities(
      new FixtureFetcher([
        ROW({ code: "A", titleIt: "prima" }),
        ROW({ code: "B" }),
        ROW({ code: "A", titleIt: "ultima" }),
      ]),
    );
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.code === "A")?.titleIt).toBe("ultima");
  });

  it("fetchAllAtecoActivities fails loud on an artifact with 0 usable rows", async () => {
    await expect(fetchAllAtecoActivities(new FixtureFetcher([ROW({ code: null })]))).rejects.toThrow(
      /0 usable rows/,
    );
  });

  it("parseAtecoWorkbook reads the official layout (header validated, typed cells)", async () => {
    const buf = await buildWorkbook([
      [1, "A", "AGRICOLTURA, SILVICOLTURA E PESCA", "AGRICULTURE", "LANDWIRTSCHAFT", 1, null, null],
      [2, "01", "Produzioni vegetali", "Crop production", "Landwirtschaft", 2, "A", 1],
    ]);
    const rows = await parseAtecoWorkbook(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      ordine: 1, code: "A", titleIt: "AGRICOLTURA, SILVICOLTURA E PESCA",
      titleEn: "AGRICULTURE", titleDe: "LANDWIRTSCHAFT", level: 1, parentCode: null,
    });
    expect(rows[1]?.parentCode).toBe("A");
    expect(rows[1]?.level).toBe(2);
  });

  it("parseAtecoWorkbook fails loud on header drift (mis-mapped ingest refused)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(ATECO_SHEET_NAME);
    ws.addRow(["ORDINE", "CODICE", "TITOLO", "TITLE", "TITEL", "LIV", "PADRE", "LIV_PADRE"]);
    ws.addRow([1, "A", "x", "y", "z", 1, null, null]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(parseAtecoWorkbook(buf)).rejects.toThrow(/header drift/);
  });

  it("parseAtecoWorkbook fails loud when the data sheet is missing", async () => {
    const buf = await buildWorkbook([[1, "A", "x", "y", "z", 1, null, null]], "Foglio sbagliato");
    await expect(parseAtecoWorkbook(buf)).rejects.toThrow(/no sheet named/);
  });
});
