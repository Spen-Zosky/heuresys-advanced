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

/** Base of the ESCO published API; the skill-resource resolver hangs off `/resource/skill`. */
export const ESCO_API_BASE = "https://ec.europa.eu/esco/api";

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

/* ── T1.1: ESCO skill-hierarchy resolver (skill_group_uri + broader_uri) ─────────
 *
 * The ESCO `/resource/skill?uri={uri}&language=en` endpoint returns a single skill's
 * HATEOAS resource. Two `_links` arrays carry the hierarchy we backfill into
 * sys.sys_skills.skill_metadata:
 *   - `broaderHierarchyConcept[]` → the skill GROUP (a node in the ESCO skills
 *     hierarchy / skill-group taxonomy) → persisted as `skill_group_uri`.
 *   - `broaderSkill[]`            → the broader SKILL (the IS-A parent skill) →
 *     persisted as `broader_uri`.
 *
 * Policy (spec §1 "Policy da fissare", CLI decision):
 *   - multiple `broaderHierarchyConcept` → take the FIRST (default; replicates the
 *     ESCO portal's primary-grouping behaviour). Same first-wins for `broaderSkill`.
 *   - a skill with NO group → resolve to null → the persistence layer leaves the
 *     existing value untouched / NULL (the "skill group unavailable" bucket, preserved).
 *
 * The fetch is behind the `EscoSkillFetcher` seam (injectable) so the fixture test
 * feeds canned JSON — NO live HTTP in CI (scraping spec §7). The production fetcher
 * adds a concurrency cap + 429 backoff for the deferred LIVE 14k backfill (it is
 * coded but NOT exercised in tests — the live run is the deferred DoD step). */

/** One resolved skill-hierarchy record (null = "skill group unavailable", preserved). */
export interface EscoSkillHierarchy {
  /** The ESCO skill URI this record describes (the natural key into sys_skills). */
  skillEscoUri: string;
  /** First `broaderHierarchyConcept` href (the skill group) — null if none. */
  skillGroupUri: string | null;
  /** First `broaderSkill` href (the broader IS-A skill) — null if none. */
  broaderUri: string | null;
}

/** Raw ESCO `/resource/skill` response shape (only the `_links` we consume). */
export interface RawEscoSkillLink {
  href?: string;
  uri?: string;
}
export interface RawEscoSkillResource {
  uri?: string;
  _links?: {
    broaderHierarchyConcept?: RawEscoSkillLink[];
    broaderSkill?: RawEscoSkillLink[];
  };
}

/** Injectable acquisition seam: resolve ONE skill resource by its ESCO URI. */
export interface EscoSkillFetcher {
  fetchSkill(uri: string): Promise<RawEscoSkillResource>;
}

/** Concurrency cap for the live 14k backfill (spec §1 / File 1 §D: 6-8 polite). */
export const ESCO_SKILL_CONCURRENCY = 6;
/** Max retries on a 429 (rate-limit) before the run fails loud. */
export const ESCO_SKILL_MAX_RETRIES = 5;
/** Base backoff (ms); the production fetcher backs off exponentially on 429. */
export const ESCO_SKILL_BACKOFF_BASE_MS = 1000;

/** First href in a HATEOAS link array (href preferred, uri fallback) — null if empty. */
/**
 * ESCO's `_links` carry the API CALL, not the concept URI:
 *   https://ec.europa.eu/esco/api/resource/concept?uri=http://data.europa.eu/esco/skill/S1.6.1&language=en
 * The thing we want to store is the `uri` parameter — the stable identifier of the
 * concept. The rest (host, path, `language`) describes how we asked, not what we got.
 *
 * Storing the call URL made group comparison depend on the endpoint and the language
 * of the request: two clients asking the same concept in different languages produced
 * two different "groups". Migration 000344 cleaned up 12,887 rows already written that
 * way — normalising HERE is what stops the next sync run from putting them back.
 *
 * Anything that is not an ESCO API call is returned untouched: a plain concept URI is
 * already canonical, and a shape we do not recognise must not be silently mangled.
 */
export function canonicalConceptUri(href: string | null): string | null {
  if (!href) return null;
  const marker = "uri=";
  const at = href.indexOf(marker);
  if (at < 0) return href;
  const tail = href.slice(at + marker.length);
  const end = tail.indexOf("&");
  const uri = end < 0 ? tail : tail.slice(0, end);
  // An empty or non-absolute extraction means the shape was not what we assumed:
  // keep the original rather than write a broken value.
  return uri.startsWith("http") ? uri : href;
}

function firstHref(links: RawEscoSkillLink[] | undefined): string | null {
  if (!links || links.length === 0) return null;
  const first = links[0];
  const href = first?.href ?? first?.uri ?? null;
  return href && href.length > 0 ? canonicalConceptUri(href) : null;
}

/**
 * Extract the hierarchy record from a raw skill resource (first-wins policy).
 * Pure: no I/O — the fixture test drives this directly off canned JSON.
 */
export function normalizeEscoSkillResource(
  skillEscoUri: string,
  raw: RawEscoSkillResource,
): EscoSkillHierarchy {
  return {
    skillEscoUri,
    skillGroupUri: firstHref(raw._links?.broaderHierarchyConcept),
    broaderUri: firstHref(raw._links?.broaderSkill),
  };
}

/**
 * Production fetcher — the real ESCO `/resource/skill` endpoint with a 429 backoff.
 * Polite UA. Exponential backoff on HTTP 429 (rate-limit) up to ESCO_SKILL_MAX_RETRIES;
 * any other non-OK status fails loud. Used by the DEFERRED live 14k backfill ONLY —
 * the integration suite injects a fixture fetcher (no live HTTP in CI).
 */
export class HttpEscoSkillFetcher implements EscoSkillFetcher {
  async fetchSkill(uri: string): Promise<RawEscoSkillResource> {
    const url = `${ESCO_API_BASE}/resource/skill?uri=${encodeURIComponent(uri)}&language=en`;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "heuresys-advanced reference-sync (ESCO skill hierarchy)" },
      });
      if (res.status === 429) {
        if (attempt >= ESCO_SKILL_MAX_RETRIES) {
          throw new Error(`ESCO skill fetch rate-limited after ${ESCO_SKILL_MAX_RETRIES} retries: ${uri}`);
        }
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : ESCO_SKILL_BACKOFF_BASE_MS * 2 ** attempt;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      if (!res.ok) {
        throw new Error(`ESCO skill fetch failed: HTTP ${res.status} for ${uri}`);
      }
      return (await res.json()) as RawEscoSkillResource;
    }
  }
}

/**
 * Resolve the hierarchy for a list of skill URIs with a bounded concurrency pool
 * (ESCO_SKILL_CONCURRENCY workers). Order-preserving result array. The 429 backoff
 * lives in HttpEscoSkillFetcher; this driver just caps parallelism (spec §1 / File 1
 * §D). The fixture fetcher resolves instantly, so the pool is a no-op in tests — but
 * the SAME code path runs the deferred live 14k backfill.
 */
export async function resolveEscoSkillHierarchies(
  fetcher: EscoSkillFetcher,
  uris: string[],
  concurrency: number = ESCO_SKILL_CONCURRENCY,
): Promise<EscoSkillHierarchy[]> {
  const out: (EscoSkillHierarchy | undefined)[] = new Array<EscoSkillHierarchy | undefined>(uris.length);
  let next = 0;
  let skipped = 0;
  const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), uris.length || 1) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= uris.length) return;
      const uri = uris[i]!;
      try {
        const raw = await fetcher.fetchSkill(uri);
        out[i] = normalizeEscoSkillResource(uri, raw);
      } catch {
        // A stale/retired ESCO URI (HTTP 404) — or a fetch still failing past its 429
        // retries — must NOT abort the whole backfill. The legacy-imported catalogue has
        // some URIs that no longer resolve on live ESCO; skip them (their hierarchy stays
        // NULL) and continue. Only the resolvable skills are returned + persisted.
        skipped++;
      }
    }
  });
  await Promise.all(workers);
  const resolved = out.filter((h): h is EscoSkillHierarchy => h !== undefined);
  if (skipped > 0) {
    console.warn(JSON.stringify({ connector: "esco-skill-hierarchy", phase: "resolve", resolved: resolved.length, skipped }));
  }
  return resolved;
}
