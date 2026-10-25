import { describe, it, expect } from "vitest";
import {
  fetchAllEscoOccupations,
  normalizeEscoResults,
  ESCO_MAX_PAGE,
  ESCO_UNAVAILABLE_ATTEMPTS,
  EscoUnavailableError,
  HttpEscoFetcher,
  type EscoFetcher,
  type EscoPage,
  type RawEscoResult,
} from "../src/modules/reference-sync/esco-connector.js";

// Cap⑤ scraping — ESCO connector P1 full-catalogue fetch (S978). Pure unit tests (no DB,
// no live HTTP): they pin the single-large-page strategy that fixes the partial-fetch bug
// (full=true cap + offset-paging deep-window) and the fail-loud truncation/ceiling guards.

/** Fixture: serves the FULL set in one page (limit≥total), an empty page otherwise —
 *  mirrors the real ESCO endpoint after the fix (offset>0 / small limit are not used). */
class FullPageFetcher implements EscoFetcher {
  public calls: Array<{ offset: number; limit: number }> = [];
  constructor(private readonly rows: RawEscoResult[]) {}
  async fetchPage(offset: number, limit: number): Promise<EscoPage> {
    this.calls.push({ offset, limit });
    if (offset > 0) return { results: [], total: this.rows.length };
    return { results: this.rows.slice(0, limit), total: this.rows.length };
  }
}

function mkRows(n: number): RawEscoResult[] {
  return Array.from({ length: n }, (_, i) => ({
    uri: `http://data.europa.eu/esco/occupation/UNIT-${i}`,
    title: `occupation ${i}`,
    code: `99${String(i).padStart(2, "0")}`,
  }));
}

describe("ESCO connector — full-catalogue fetch (P1)", () => {
  it("fetches the WHOLE catalogue in a single large page (no offset-paging)", async () => {
    const rows = mkRows(2942); // realistic catalogue size
    const f = new FullPageFetcher(rows);
    const out = await fetchAllEscoOccupations(f);
    expect(out).toHaveLength(2942);
    // probe(limit=1) then one full page(limit=total) — never offset>0 (deep-paging is unsafe).
    expect(f.calls).toEqual([
      { offset: 0, limit: 1 },
      { offset: 0, limit: 2942 },
    ]);
    expect(out.every((o) => o.iscoCode !== null)).toBe(true);
  });

  it("dedupes by URI", async () => {
    const dup: RawEscoResult[] = [
      { uri: "http://data.europa.eu/esco/occupation/X", title: "a", code: "1" },
      { uri: "http://data.europa.eu/esco/occupation/X", title: "a-dup", code: "1" },
      { uri: "http://data.europa.eu/esco/occupation/Y", title: "b", code: "2" },
    ];
    const out = await fetchAllEscoOccupations(new FullPageFetcher(dup));
    expect(out).toHaveLength(2);
  });

  it("empty catalogue → empty result (no second fetch)", async () => {
    const f = new FullPageFetcher([]);
    expect(await fetchAllEscoOccupations(f)).toHaveLength(0);
    expect(f.calls).toEqual([{ offset: 0, limit: 1 }]); // probe only; total=0 short-circuits
  });

  it("FAILS LOUD on a truncated response (refuses a silent partial ingest)", async () => {
    const truncating: EscoFetcher = {
      async fetchPage(offset: number): Promise<EscoPage> {
        // reports 2942 but only ever returns 50 rows (the deep-paging bug class)
        return { results: offset > 0 ? [] : mkRows(50), total: 2942 };
      },
    };
    await expect(fetchAllEscoOccupations(truncating)).rejects.toThrow(/truncated catalogue/);
  });

  it("FAILS LOUD when total exceeds the single-page ceiling", async () => {
    const huge: EscoFetcher = {
      async fetchPage(): Promise<EscoPage> {
        return { results: [], total: ESCO_MAX_PAGE + 1 };
      },
    };
    await expect(fetchAllEscoOccupations(huge)).rejects.toThrow(/exceeds single-page ceiling/);
  });

  it("normalizeEscoResults skips non-occupation classes and rows without a URI", () => {
    const mixed: RawEscoResult[] = [
      { uri: "http://data.europa.eu/esco/occupation/A", title: "occ", code: "1", className: "Occupation" },
      { uri: "http://data.europa.eu/esco/skill/B", title: "skill", className: "Skill" },
      { title: "no-uri", code: "3" },
    ];
    const out = normalizeEscoResults(mixed);
    expect(out).toHaveLength(1);
    expect(out[0]!.escoUri).toBe("http://data.europa.eu/esco/occupation/A");
  });
});

// 2026-10-25: the EC put ESCO behind its maintenance page (307 → https://sorry.ec.europa.eu/,
// HTML "Server temporarily unavailable"); the run died on JSON.parse("<!DOCTYPE"). The
// fetcher must name the outage, retry a little, and still fail (no silent skip).
describe("ESCO connector — upstream unavailable", () => {
  const sorry = (): Response =>
    new Response(null, { status: 307, headers: { location: "https://sorry.ec.europa.eu/" } });
  const ok = (): Response =>
    new Response(JSON.stringify({ total: 1, _embedded: { results: [{ uri: "u1", title: "t", code: "1" }] } }), {
      status: 200,
      headers: { "content-type": "application/json;charset=UTF-8" },
    });

  it("a redirect to the maintenance page fails as EscoUnavailableError after the retries", async () => {
    let calls = 0;
    const f = new HttpEscoFetcher(async (_url, init) => {
      calls++;
      expect(init.redirect).toBe("manual");
      return sorry();
    }, 0);
    await expect(f.fetchPage(0, 1)).rejects.toThrow(EscoUnavailableError);
    await expect(new HttpEscoFetcher(async () => sorry(), 0).fetchPage(0, 1)).rejects.toThrow(/sorry\.ec\.europa\.eu/);
    expect(calls).toBe(ESCO_UNAVAILABLE_ATTEMPTS);
  });

  it("an HTML body served with 200 is not parsed as JSON", async () => {
    const f = new HttpEscoFetcher(
      async () => new Response("<!DOCTYPE html><title>Server temporarily unavailable</title>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      0,
    );
    await expect(f.fetchPage(0, 1)).rejects.toThrow(/instead of JSON/);
  });

  it("recovers when ESCO comes back within the retries", async () => {
    let calls = 0;
    const f = new HttpEscoFetcher(async () => (++calls === 1 ? sorry() : ok()), 0);
    const page = await f.fetchPage(0, 1);
    expect(page.total).toBe(1);
    expect(calls).toBe(2);
  });

  it("a 4xx is a plain failure, not retried", async () => {
    let calls = 0;
    const f = new HttpEscoFetcher(async () => {
      calls++;
      return new Response("bad", { status: 400 });
    }, 0);
    await expect(f.fetchPage(0, 1)).rejects.toThrow(/HTTP 400/);
    expect(calls).toBe(1);
  });
});
