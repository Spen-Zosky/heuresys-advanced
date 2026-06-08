/**
 * apps/api/src/modules/reference-sync/esco-connector.ts
 * Cap⑤ scraping — ESCO occupation connector (P1 full-catalogue fetch).
 *
 * The official ESCO API (https://ec.europa.eu/esco/api/search) publishes a JSON
 * HATEOAS catalogue: `_embedded.results[]`, each with `uri` (the ESCO occupation
 * URI), `title` (label), `code` (full ESCO/ISCO code, incl. specialisation suffixes
 * like 2166.3.1). The HTTP fetcher is behind the `EscoFetcher` seam so the
 * integration suite injects a recorded fixture — NO live HTTP in CI (scraping spec
 * §7); the live-data doctrine applies to OUR DB, not to hammering EU servers.
 *
 * FULL-CATALOGUE ENUMERATION (P1 fix, S978):
 *   The search endpoint enumerates the WHOLE occupation catalogue (~2942 rows incl.
 *   specialisations) ONLY via a single large page. Two empirically-measured caps make
 *   the naive paging in the P1 connector return a partial set:
 *     (a) full=true caps/breaks the response (large per-row payloads → not the catalogue);
 *     (b) offset-paging dies past offset≈500 (deep-paging window) → re-fetching offset>0
 *         returns 0 results even though `total` is the real count.
 *   So we read `total` with a tiny probe, then fetch the entire catalogue in ONE page
 *   (limit=total, offset=0, full=false). Two requests total — the politest complete
 *   enumeration. A truncation guard fails loud (no silent partial ingest) if the API
 *   ever returns fewer rows than it reports.
 */
export const ESCO_SEARCH_URL = "https://ec.europa.eu/esco/api/search";

// The ESCO search backend is Elasticsearch-backed; very large single pages beyond its
// result window would be rejected. The occupation catalogue is ~3k, so this ceiling is
// never reached in practice — it exists to fail loud (not silently partial) if ESCO ever
// grows past what a single page can return, which would require a different strategy.
export const ESCO_MAX_PAGE = 10000;

export interface EscoOccupation {
  escoUri: string;
  label: string;
  iscoCode: string | null;
  metadata: Record<string, unknown>;
}

/** Raw ESCO search result shape (only the fields we consume). */
export interface RawEscoResult {
  uri?: string;
  title?: string;
  code?: string;
  className?: string;
  status?: string;
}

export interface EscoPage {
  results: RawEscoResult[];
  total: number;
}

/** Injectable acquisition seam: one page of occupations at `offset`. */
export interface EscoFetcher {
  fetchPage(offset: number, limit: number): Promise<EscoPage>;
}

/** Production fetcher — the real ESCO published API. Polite UA; full=false flat rows. */
export class HttpEscoFetcher implements EscoFetcher {
  async fetchPage(offset: number, limit: number): Promise<EscoPage> {
    // full=false → flat rows (uri/title/code); full=true breaks the response at scale.
    const url = `${ESCO_SEARCH_URL}?type=occupation&language=en&full=false&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "heuresys-advanced reference-sync (ESCO refresh)" },
    });
    if (!res.ok) {
      throw new Error(`ESCO fetch failed: HTTP ${res.status} at offset ${offset} limit ${limit}`);
    }
    const json = (await res.json()) as { total?: number; _embedded?: { results?: RawEscoResult[] } };
    return { results: json._embedded?.results ?? [], total: json.total ?? 0 };
  }
}

/** Normalize raw ESCO results → flat catalog rows (occupations only, with a URI). */
export function normalizeEscoResults(results: RawEscoResult[]): EscoOccupation[] {
  const out: EscoOccupation[] = [];
  for (const r of results) {
    if (!r.uri) continue;
    if (r.className && r.className !== "Occupation") continue;
    out.push({
      escoUri: r.uri,
      label: r.title ?? "",
      iscoCode: r.code ?? null,
      metadata: { className: r.className ?? null, status: r.status ?? null },
    });
  }
  return out;
}

/**
 * Fetch the WHOLE ESCO occupation catalogue and dedupe by URI (the upsert later
 * cannot touch the same conflict key twice in one statement).
 *
 * Strategy (see file header): probe `total`, then fetch all rows in a single page.
 * Offset-paging is deliberately NOT used — the ESCO deep-paging window makes it return
 * a partial set silently. Throws on a truncated response so a partial fetch becomes a
 * FAILED run (watermark not advanced, retried next week) rather than a silent regression.
 */
export async function fetchAllEscoOccupations(fetcher: EscoFetcher): Promise<EscoOccupation[]> {
  const probe = await fetcher.fetchPage(0, 1);
  const total = probe.total;
  if (total <= 0) return [];
  if (total > ESCO_MAX_PAGE) {
    throw new Error(
      `ESCO catalogue total ${total} exceeds single-page ceiling ${ESCO_MAX_PAGE}; ` +
        "deep-paging is unreliable — a chunked enumeration strategy is required.",
    );
  }
  const page = await fetcher.fetchPage(0, total);
  if (page.results.length < total) {
    throw new Error(
      `ESCO returned a truncated catalogue: ${page.results.length} rows for a reported total of ${total} ` +
        "(refusing a silent partial ingest).",
    );
  }
  const byUri = new Map<string, EscoOccupation>();
  for (const occ of normalizeEscoResults(page.results)) byUri.set(occ.escoUri, occ);
  return [...byUri.values()];
}
