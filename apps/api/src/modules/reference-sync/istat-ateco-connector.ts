/**
 * apps/api/src/modules/reference-sync/istat-ateco-connector.ts
 * Cap⑤ scraping — ISTAT ATECO 2025 connector (2nd official source, S983).
 *
 * ISTAT publishes the official ATECO 2025 structure as a single XLSX artifact
 * (sheet "ATECO 2025 Struttura", 3257 rows): code, IT/EN/DE titles, hierarchy
 * level 1-6 and parent code. There is no JSON/CSV API — the connector fetches
 * the workbook and parses it with exceljs. The HTTP+parse pipeline sits behind
 * the `AtecoFetcher` seam so the integration suite injects plain fixture rows
 * (NO live HTTP in CI, scraping spec §7 — same doctrine as the ESCO connector).
 *
 * Target: sys.sys_activity_classifications under scheme 'ATECO_2025' — a NEW
 * parallel generation. The legacy 'ATECO'/'NACE' rows (brownfield import) stay
 * untouched: provenance preserved, FK-by-id consumers unaffected (decision
 * S983, plan WS-C §4). Scheme already whitelisted in the CHECK (mig 000032).
 *
 * Fail-loud guards (no silent partial ingest, mirrors esco-connector):
 *   - header drift: the sheet header must match the known column layout;
 *   - empty artifact / row floor: the official structure has ~3.2k rows — a
 *     drastically smaller artifact means a truncated download or a format
 *     change, and MUST fail the run (watermark not advanced, retried weekly).
 */
import ExcelJS from "exceljs";

export const ATECO_STRUCTURE_URL =
  "https://www.istat.it/wp-content/uploads/2025/02/StrutturaATECO-2025-IT-EN-DE.xlsx";

export const ATECO_SHEET_NAME = "ATECO 2025 Struttura";
export const ATECO_SCHEME = "ATECO_2025";

/** The official 2025 structure ships 3257 rows; a fetch below this floor is a
 *  truncated/foreign artifact, not a plausible revision of the classification. */
export const ATECO_MIN_EXPECTED_ROWS = 1000;

/** Expected header row (column drift = fail loud, not silent mis-mapping). */
export const ATECO_EXPECTED_HEADER = [
  "ORDINE_CODICE_ATECO_2025",
  "CODICE_ATECO_2025",
  "TITOLO_ITALIANO_ATECO_2025",
  "TITOLO_INGLESE_ATECO_2025",
  "TITOLO_TEDESCO_ATECO_2025",
  "GERARCHIA_ATECO_2025",
  "CODICE_PADRE_ATECO_2025",
  "GERARCHIA_PADRE_ATECO_2025",
] as const;

/** One parsed worksheet row (pre-normalization; nullable everywhere). */
export interface RawAtecoRow {
  ordine: number | null;
  code: string | null;
  titleIt: string | null;
  titleEn: string | null;
  titleDe: string | null;
  level: number | null;
  parentCode: string | null;
}

/** One normalized catalog row, ready for the scheme+code upsert. */
export interface AtecoActivity {
  code: string;
  parentCode: string | null;
  titleIt: string;
  level: number;
  metadata: Record<string, unknown>;
}

/** Injectable acquisition seam: the whole raw structure in one shot. */
export interface AtecoFetcher {
  fetchAll(): Promise<RawAtecoRow[]>;
}

/**
 * Production fetcher — downloads the official ISTAT workbook and parses it.
 * Applies the row-count plausibility floor HERE (the live artifact is ~3.2k
 * rows; below the floor = truncated download/format change → fail loud). The
 * floor intentionally does NOT live in fetchAllAtecoActivities: fixture
 * fetchers in the test suites ingest tiny synthetic sets.
 */
export class HttpAtecoFetcher implements AtecoFetcher {
  async fetchAll(): Promise<RawAtecoRow[]> {
    const res = await fetch(ATECO_STRUCTURE_URL, {
      headers: { "user-agent": "heuresys-advanced reference-sync (ATECO refresh)" },
    });
    if (!res.ok) {
      throw new Error(`ATECO fetch failed: HTTP ${res.status} at ${ATECO_STRUCTURE_URL}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const rows = await parseAtecoWorkbook(buf);
    if (rows.length < ATECO_MIN_EXPECTED_ROWS) {
      throw new Error(
        `ATECO artifact yielded ${rows.length} rows — below the plausibility floor ` +
          `${ATECO_MIN_EXPECTED_ROWS} (refusing a truncated ingest).`,
      );
    }
    return rows;
  }
}

/** Coerce an exceljs cell value to a trimmed string (or null). */
function cellString(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number") return String(v);
  // Rich text / formula results — render via their text form when present.
  if (typeof v === "object" && "richText" in v) {
    const t = v.richText.map((r) => r.text).join("").trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "object" && "result" in v) return cellString(v.result as ExcelJS.CellValue);
  return null;
}

/** Coerce an exceljs cell value to an integer (or null). */
function cellInt(v: ExcelJS.CellValue): number | null {
  const s = cellString(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

/** Parse the official workbook buffer into raw rows (header-validated). */
export async function parseAtecoWorkbook(xlsx: Buffer): Promise<RawAtecoRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(ATECO_SHEET_NAME);
  if (!ws) {
    throw new Error(
      `ATECO workbook has no sheet named "${ATECO_SHEET_NAME}" — upstream format changed.`,
    );
  }
  const rows: RawAtecoRow[] = [];
  let headerChecked = false;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      const header = ATECO_EXPECTED_HEADER.map((_, i) => cellString(row.getCell(i + 1).value));
      const drift = ATECO_EXPECTED_HEADER.findIndex((h, i) => header[i] !== h);
      if (drift >= 0) {
        throw new Error(
          `ATECO header drift at column ${drift + 1}: expected "${ATECO_EXPECTED_HEADER[drift]}", ` +
            `got "${header[drift] ?? "<empty>"}" — refusing a mis-mapped ingest.`,
        );
      }
      headerChecked = true;
      return;
    }
    rows.push({
      ordine: cellInt(row.getCell(1).value),
      code: cellString(row.getCell(2).value),
      titleIt: cellString(row.getCell(3).value),
      titleEn: cellString(row.getCell(4).value),
      titleDe: cellString(row.getCell(5).value),
      level: cellInt(row.getCell(6).value),
      parentCode: cellString(row.getCell(7).value),
    });
  });
  if (!headerChecked) throw new Error("ATECO workbook data sheet is empty (no header row).");
  return rows;
}

/** Normalize raw rows → catalog rows (code+title+level required; rest is metadata). */
export function normalizeAtecoRows(raw: RawAtecoRow[]): AtecoActivity[] {
  const out: AtecoActivity[] = [];
  for (const r of raw) {
    if (!r.code || !r.titleIt || r.level === null) continue;
    out.push({
      code: r.code,
      parentCode: r.parentCode,
      titleIt: r.titleIt,
      level: r.level,
      metadata: { title_en: r.titleEn, title_de: r.titleDe, ordine: r.ordine },
    });
  }
  return out;
}

/**
 * Fetch + normalize the whole ATECO 2025 structure, deduped by code (the upsert
 * cannot touch the same conflict key twice in one statement). Throws on an empty
 * or implausibly small artifact so a bad fetch becomes a FAILED run (watermark
 * not advanced) rather than a silent catalog regression.
 */
export async function fetchAllAtecoActivities(fetcher: AtecoFetcher): Promise<AtecoActivity[]> {
  const raw = await fetcher.fetchAll();
  const activities = normalizeAtecoRows(raw);
  if (activities.length === 0) {
    throw new Error("ATECO artifact yielded 0 usable rows (refusing an empty ingest).");
  }
  const byCode = new Map<string, AtecoActivity>();
  for (const a of activities) byCode.set(a.code, a);
  return [...byCode.values()];
}
