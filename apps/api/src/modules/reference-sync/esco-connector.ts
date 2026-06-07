/**
 * apps/api/src/modules/reference-sync/esco-connector.ts
 * Cap⑤ scraping — ESCO occupation connector.
 *
 * The official ESCO API (https://ec.europa.eu/esco/api/search) publishes a JSON
 * HATEOAS catalogue: `_embedded.results[]`, each with `uri` (the ESCO occupation
 * URI), `title` (label), `code` (ISCO). We page through it, normalize to flat
 * rows, and dedupe by URI. The HTTP fetcher is behind the `EscoFetcher` seam so
 * the integration suite injects a recorded fixture — NO live HTTP in CI (scraping
 * spec §7); the live-data doctrine applies to OUR DB, not to hammering EU servers.
 */
export const ESCO_SEARCH_URL = "https://ec.europa.eu/esco/api/search";

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

/** Production fetcher — the real ESCO published API. Polite UA; conditional paging. */
export class HttpEscoFetcher implements EscoFetcher {
  async fetchPage(offset: number, limit: number): Promise<EscoPage> {
    const url = `${ESCO_SEARCH_URL}?type=occupation&language=en&full=true&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "heuresys-advanced reference-sync (ESCO refresh)" },
    });
    if (!res.ok) {
      throw new Error(`ESCO fetch failed: HTTP ${res.status} at offset ${offset}`);
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
 * Page through the whole occupation catalogue and dedupe by URI (the upsert later
 * cannot touch the same conflict key twice in one statement). `maxPages` is a
 * runaway guard well above the real catalogue size (~3k occupations).
 */
export async function fetchAllEscoOccupations(
  fetcher: EscoFetcher,
  pageSize = 100,
  maxPages = 200,
): Promise<EscoOccupation[]> {
  const byUri = new Map<string, EscoOccupation>();
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  let pages = 0;
  while (offset < total && pages < maxPages) {
    const page = await fetcher.fetchPage(offset, pageSize);
    total = page.total;
    pages += 1;
    if (page.results.length === 0) break;
    for (const occ of normalizeEscoResults(page.results)) byUri.set(occ.escoUri, occ);
    offset += pageSize;
  }
  return [...byUri.values()];
}
