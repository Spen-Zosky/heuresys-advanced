import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import {
  normalizeEscoSkillResource,
  resolveEscoSkillHierarchies,
  type EscoSkillFetcher,
  type RawEscoSkillResource,
} from "../src/modules/reference-sync/esco-connector.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// Cap⑤ T1.1 — ESCO skill-hierarchy backfill (/v1/reference-sync source
// ESCO_SKILL_HIERARCHY). Real login + live DB. The skill fetcher is INJECTED with a
// fixture (NO live HTTP, scraping spec §7 / spec §1). The fixture uses SYNTHETIC test
// skill URIs only — the real 14011-row ESCO skill catalog is untouched (the synthetic
// rows are inserted, then deleted in afterAll). PLATFORM_ADMIN-only (reference_sync,
// source-agnostic permission 000084).

const PWD = TEST_PERSONA_PASSWORD;
const SKILL_PREFIX = "http://data.europa.eu/esco/skill/HEURESYS-T11-";
const GROUPED_URI = `${SKILL_PREFIX}grouped`;
const UNGROUPED_URI = `${SKILL_PREFIX}ungrouped`;
const GROUP_HREF = "http://data.europa.eu/esco/skill-group/HEURESYS-T11-S1";
const GROUP_HREF_SECONDARY = "http://data.europa.eu/esco/skill-group/HEURESYS-T11-S2";
const BROADER_HREF = `${SKILL_PREFIX}broaderparent`;

// Fixture: the grouped skill has TWO broaderHierarchyConcept (first-wins policy) + a
// broaderSkill; the ungrouped skill has empty _links (→ skill_group_uri stays null,
// the "skill group unavailable" bucket preserved).
const FIXTURE: Record<string, RawEscoSkillResource> = {
  [GROUPED_URI]: {
    uri: GROUPED_URI,
    _links: {
      broaderHierarchyConcept: [{ href: GROUP_HREF }, { href: GROUP_HREF_SECONDARY }],
      broaderSkill: [{ href: BROADER_HREF }],
    },
  },
  [UNGROUPED_URI]: { uri: UNGROUPED_URI, _links: {} },
};

class FixtureEscoSkillFetcher implements EscoSkillFetcher {
  public calls: string[] = [];
  constructor(private readonly byUri: Record<string, RawEscoSkillResource>) {}
  async fetchSkill(uri: string): Promise<RawEscoSkillResource> {
    this.calls.push(uri);
    return this.byUri[uri] ?? { uri, _links: {} };
  }
}

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

// Two synthetic sys_skills rows with our test ESCO URIs (deleted in afterAll). The
// global skill_code namespace is unique-per-NULL-tenant (mig 000013), so the codes
// carry the test prefix to avoid any clash with the real catalog.
const INSERT_SKILLS = `
  INSERT INTO sys.sys_skills (skill_code, skill_name, skill_esco_uri, skill_is_global)
  VALUES
    ('HEURESYS-T11-GROUPED',   'T11 grouped skill',   $1, true),
    ('HEURESYS-T11-UNGROUPED', 'T11 ungrouped skill', $2, true)
  ON CONFLICT DO NOTHING`;
const DELETE_SKILLS = `DELETE FROM sys.sys_skills WHERE skill_esco_uri LIKE $1`;

const RESET_WATERMARK = `
  UPDATE reference_sync.source_watermarks
     SET source_watermark_content_hash = NULL, source_watermark_last_succeeded_at = NULL,
         source_watermark_last_fetched_at = NULL, source_watermark_last_import_run_id = NULL,
         source_watermark_status = 'IDLE'
   WHERE source_watermark_source_key = 'ESCO_SKILL_HIERARCHY'`;

let suite: TestApp;
let admin: S;
let fixtureFetcher: FixtureEscoSkillFetcher;

beforeAll(async () => {
  fixtureFetcher = new FixtureEscoSkillFetcher(FIXTURE);
  suite = await buildTestApp({
    referenceSyncDeps: {
      escoSkillFetcher: fixtureFetcher,
      // Scope the backfill to ONLY our 2 synthetic skills — the real 14011-row catalog
      // is never resolved or mutated by the suite (same isolation as the synthetic-URI
      // fixtures of the sibling ESCO/ATECO suites). The DEFERRED live run uses the
      // default URI source (every sys_skills row with a URI).
      escoSkillUriSource: async () => [GROUPED_URI, UNGROUPED_URI],
    },
  });
  admin = await login(suite, "enzo.spenuso@heuresys.com");
  await pool.query(DELETE_SKILLS, [`${SKILL_PREFIX}%`]);
  await pool.query(INSERT_SKILLS, [GROUPED_URI, UNGROUPED_URI]);
  await pool.query(RESET_WATERMARK);
});

afterAll(async () => {
  await pool.query(DELETE_SKILLS, [`${SKILL_PREFIX}%`]);
  await pool.query(RESET_WATERMARK);
  await suite.app.close();
});

async function trigger(s: S) {
  return suite.app.inject({
    method: "POST", url: "/v1/reference-sync/runs",
    headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" },
    payload: { source: "ESCO_SKILL_HIERARCHY" },
  });
}

async function groupUriOf(escoUri: string): Promise<string | null> {
  const { rows } = await pool.query<{ g: string | null }>(
    `SELECT skill_metadata->>'skill_group_uri' AS g FROM sys.sys_skills WHERE skill_esco_uri = $1`,
    [escoUri],
  );
  return rows[0]?.g ?? null;
}

describe("ESCO skill-hierarchy resolver (T1.1) — pure unit", () => {
  it("normalizeEscoSkillResource: first broaderHierarchyConcept wins; broaderSkill first wins", () => {
    const h = normalizeEscoSkillResource(GROUPED_URI, FIXTURE[GROUPED_URI]!);
    expect(h.skillGroupUri).toBe(GROUP_HREF);   // first of TWO concepts (policy: first)
    expect(h.broaderUri).toBe(BROADER_HREF);
  });

  it("normalizeEscoSkillResource: no _links → both null (skill group unavailable bucket)", () => {
    const h = normalizeEscoSkillResource(UNGROUPED_URI, { uri: UNGROUPED_URI, _links: {} });
    expect(h.skillGroupUri).toBeNull();
    expect(h.broaderUri).toBeNull();
  });

  it("resolveEscoSkillHierarchies: order-preserving, bounded pool resolves every URI", async () => {
    const f = new FixtureEscoSkillFetcher(FIXTURE);
    const out = await resolveEscoSkillHierarchies(f, [GROUPED_URI, UNGROUPED_URI], 6);
    expect(out.map((o) => o.skillEscoUri)).toEqual([GROUPED_URI, UNGROUPED_URI]);
    expect(out[0]!.skillGroupUri).toBe(GROUP_HREF);
    expect(out[1]!.skillGroupUri).toBeNull();
    expect(new Set(f.calls)).toEqual(new Set([GROUPED_URI, UNGROUPED_URI]));
  });
});

describe("reference-sync API (cap⑤ ESCO_SKILL_HIERARCHY, T1.1)", () => {
  it("RBAC: MANAGER cannot trigger the backfill → 403", async () => {
    const manager = await login(suite, "paolo.caputo@rtl-bank.org");
    expect((await trigger(manager)).statusCode).toBe(403);
  });

  it("first backfill populates skill_group_uri for the grouped skill, NULL preserved for the ungrouped", async () => {
    const r = await trigger(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { source: string; total: number; updated: number; skipped: boolean };
    expect(b.source).toBe("ESCO_SKILL_HIERARCHY");
    expect(b.skipped).toBe(false);  // watermark was reset → real backfill
    expect(b.total).toBe(2);        // scoped to our 2 synthetic skills
    // ONE, not two — and the difference is the point (#223 F1, rilievo F3-02).
    // The ungrouped skill has no broaderHierarchyConcept: the backfill writes NULL
    // over a NULL and changes nothing. The UPDATE is now guarded by
    // `IS DISTINCT FROM`, so a row that does not change is not counted as updated —
    // which is what "updated" should have meant all along.
    // Before the guard this said 2, because the unconditional UPDATE rewrote every
    // matched row whether or not anything differed. That is exactly the ~14,000
    // identical rewrites per sync run that F3-02 reports; a test asserting 2 here
    // was asserting the defect.
    expect(b.updated).toBe(1);      // only the grouped row actually changed
    // grouped skill: skill_group_uri = the FIRST broaderHierarchyConcept (policy)
    expect(await groupUriOf(GROUPED_URI)).toBe(GROUP_HREF);
    // ungrouped skill: NULL preserved (group-unavailable bucket)
    expect(await groupUriOf(UNGROUPED_URI)).toBeNull();
    // broader_uri merged for the grouped skill
    const { rows } = await pool.query<{ b: string | null }>(
      `SELECT skill_metadata->>'broader_uri' AS b FROM sys.sys_skills WHERE skill_esco_uri = $1`,
      [GROUPED_URI],
    );
    expect(rows[0]!.b).toBe(BROADER_HREF);
  });

  it("re-running the SAME resolved artifact is an UNCHANGED no-op (watermark hash-skip)", async () => {
    const r = await trigger(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { skipped: boolean; inserted: number; updated: number };
    expect(b.skipped).toBe(true);  // content_hash matches the last successful backfill
    expect(b.inserted).toBe(0);
    expect(b.updated).toBe(0);     // no UPDATE performed on the skip path
    // values are still in place (nothing wiped)
    expect(await groupUriOf(GROUPED_URI)).toBe(GROUP_HREF);
    expect(await groupUriOf(UNGROUPED_URI)).toBeNull();
  });

  it("GET /sources lists ESCO_SKILL_HIERARCHY with its watermark advanced (STAGED/UNCHANGED)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/reference-sync/sources", headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: { key: string; watermark: { status: string } | null }[] };
    const src = b.items.find((x) => x.key === "ESCO_SKILL_HIERARCHY");
    expect(src).toBeDefined();
    expect(src!.watermark).not.toBeNull();
    expect(["STAGED", "UNCHANGED"]).toContain(src!.watermark!.status);
  });
});
