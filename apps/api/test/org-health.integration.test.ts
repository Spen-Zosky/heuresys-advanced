/**
 * apps/api/test/org-health.integration.test.ts
 *
 * #57 F/F3 — organizational health index: GET /v1/org-health.
 *
 * A health index is acted on: a unit marked CRITICAL gets a manager's attention, one marked
 * STRONG gets left alone. So the suite pins the properties that make it worth acting on:
 *   1. the composite EQUALS the declared weighted mean of the dimensions that have data;
 *   2. a missing dimension leaves the denominator — it is never scored as zero;
 *   3. the index DISCRIMINATES: units must not all land on the same value or the same band.
 * (3) is the lesson of #56, where absolute cuts on uncalibrated scales collapsed a
 * four-axis model onto one. Here it is asserted from the first commit, not after the fact.
 *
 * Expectations are derived from the live database in this file; nothing is hardcoded.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import {
  ORG_HEALTH_WEIGHTS as W,
  ORG_HEALTH_BANDS as B,
  ORG_HEALTH_MIN_COVERAGE,
  ORG_HEALTH_DIMENSIONS,
} from "@heuresys/shared";

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string> }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

type Status = "STRONG" | "HEALTHY" | "WATCH" | "CRITICAL" | "INSUFFICIENT_DATA";
interface Dim { dimension: string; score: number | null; sampleSize: number; effectiveWeight: number }
type Standing = "LEADING" | "MIDDLE" | "LAGGING" | "UNRANKED";
interface Unit {
  orgUnitId: string; orgUnitName: string; headcount: number;
  index: number | null; status: Status; standing: Standing; percentile: number | null;
  coverage: number; dimensions: Dim[];
}
interface Scorecard {
  units: Unit[]; total: number; organizationIndex: number | null;
  summary: Record<Status, number>;
  weights: Record<string, number>;
  bands: { strong: number; healthy: number; watch: number };
  minCoverage: number;
  distribution: { min: number | null; median: number | null; max: number | null; spread: number | null };
  generatedAt: string;
}

let suite: TestApp;
let tenantAdmin: S; // federica.marchetti — org_director:read
let plainUser: S; // tommaso.fiore — no org_director:read

const health = (s: S) =>
  suite.app.inject({ method: "GET", url: "/v1/org-health", headers: { cookie: ch(s.cookies) } });

describe("#57 F3 — organizational health index", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
    plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
  }, 60_000);

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("RBAC: a plain USER without org_director:read is denied", async () => {
    expect((await health(plainUser)).statusCode).toBe(403);
  });

  it("scores every org-unit that has people, echoing the declared model", async () => {
    const r = await health(tenantAdmin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as Scorecard;
    expect(b.total).toBe(b.units.length);
    expect(b.weights).toEqual({ ...W });
    expect(b.bands).toEqual({ ...B });
    expect(b.minCoverage).toBe(ORG_HEALTH_MIN_COVERAGE);

    // one row per org-unit with at least one PRIMARY-ACTIVE incumbent
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(DISTINCT p.position_organization_unit_id)::text AS n
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
         JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id AND t.tenant_name = 'RTL Bank'
        WHERE a.user_position_assignment_kind = 'PRIMARY'
          AND a.user_position_assignment_status = 'ACTIVE'
          AND p.position_organization_unit_id IS NOT NULL`,
    );
    expect(b.total).toBe(Number(rows[0]?.n));
    for (const u of b.units) expect(u.headcount).toBeGreaterThan(0);
  });

  it("the index EQUALS the declared weighted mean of the dimensions that have data", async () => {
    const b = (await health(tenantAdmin)).json() as Scorecard;
    for (const u of b.units) {
      const present = u.dimensions.filter((d) => d.score !== null);
      if (present.length === 0) {
        expect(u.index).toBeNull();
        continue;
      }
      const availableWeight = present.reduce((acc, d) => acc + W[d.dimension as keyof typeof W], 0);
      const weighted = present.reduce(
        (acc, d) => acc + W[d.dimension as keyof typeof W] * (d.score as number), 0,
      );
      expect(u.index).toBeCloseTo(100 * (weighted / availableWeight), 1);
      // the effective weights of the present dimensions must renormalize to 1
      expect(present.reduce((acc, d) => acc + d.effectiveWeight, 0)).toBeCloseTo(1, 3);
    }
  });

  it("a missing dimension leaves the denominator — it is never counted as zero", async () => {
    const b = (await health(tenantAdmin)).json() as Scorecard;
    for (const u of b.units) {
      for (const d of u.dimensions) {
        if (d.score === null) {
          expect(d.sampleSize).toBe(0);
          expect(d.effectiveWeight).toBe(0); // carries no weight at all, rather than weight×0
        } else {
          expect(d.sampleSize).toBeGreaterThan(0);
          expect(d.effectiveWeight).toBeGreaterThan(0);
        }
      }
      // coverage is exactly the share of declared weight that had data
      const totalW = Object.values(W).reduce((a, c) => a + c, 0);
      const availW = u.dimensions
        .filter((d) => d.score !== null)
        .reduce((acc, d) => acc + W[d.dimension as keyof typeof W], 0);
      expect(u.coverage).toBeCloseTo(availW / totalW, 3);
    }
  });

  it("a unit whose model coverage is too thin gets no band, only the raw number", async () => {
    const b = (await health(tenantAdmin)).json() as Scorecard;
    for (const u of b.units) {
      if (u.coverage < ORG_HEALTH_MIN_COVERAGE) expect(u.status).toBe("INSUFFICIENT_DATA");
      else if (u.index !== null) expect(u.status).not.toBe("INSUFFICIENT_DATA");
    }
  });

  it("the band matches the declared cuts", async () => {
    const b = (await health(tenantAdmin)).json() as Scorecard;
    for (const u of b.units) {
      if (u.status === "INSUFFICIENT_DATA" || u.index === null) continue;
      const expected =
        u.index >= B.strong ? "STRONG"
        : u.index >= B.healthy ? "HEALTHY"
        : u.index >= B.watch ? "WATCH"
        : "CRITICAL";
      expect(u.status).toBe(expected);
    }
  });

  it("DISCRIMINATES: the index and its dimensions actually vary across units", async () => {
    // The #56 failure mode, asserted up-front: a model that gives every unit the same
    // answer is not measuring the organization, it is measuring its own constants.
    const b = (await health(tenantAdmin)).json() as Scorecard;
    const scored = b.units.filter((u) => u.index !== null).map((u) => u.index as number);
    expect(scored.length).toBeGreaterThan(1);
    expect(new Set(scored).size, "every unit got an identical index").toBeGreaterThan(1);
    expect(Math.max(...scored) - Math.min(...scored), "the index has no spread at all")
      .toBeGreaterThan(0);

    for (const dim of ORG_HEALTH_DIMENSIONS) {
      const vals = b.units
        .map((u) => u.dimensions.find((d) => d.dimension === dim)?.score)
        .filter((v): v is number => v !== null && v !== undefined);
      if (vals.length <= 1) continue; // dimension present for at most one unit — nothing to vary
      expect(new Set(vals).size, `dimension "${dim}" is constant across every unit`).toBeGreaterThan(1);
    }
  });

  it("the relative standing ranks the units — and does NOT collapse into one bucket", async () => {
    // Why this exists: the absolute band is not actionable on its own. Measured live, the
    // index spans a narrow range and every unit lands STRONG/HEALTHY, so "no problem
    // anywhere" would be the whole message. The standing must therefore separate units even
    // when the band does not.
    const b = (await health(tenantAdmin)).json() as Scorecard;
    const ranked = b.units.filter((u) => u.standing !== "UNRANKED");
    expect(ranked.length).toBeGreaterThan(2);

    for (const u of ranked) {
      expect(u.percentile).not.toBeNull();
      const p = u.percentile as number;
      const expected = p >= 2 / 3 ? "LEADING" : p >= 1 / 3 ? "MIDDLE" : "LAGGING";
      expect(u.standing).toBe(expected);
    }
    // an unranked unit carries no percentile, and vice versa
    for (const u of b.units.filter((x) => x.standing === "UNRANKED")) {
      expect(u.percentile).toBeNull();
    }
    // all three buckets must be usable: a ranking that puts everyone in one is not a ranking
    expect(new Set(ranked.map((u) => u.standing)).size).toBeGreaterThan(1);

    // percentile must respect the index order
    for (const a of ranked) {
      for (const c of ranked) {
        if ((a.index as number) > (c.index as number)) {
          expect(a.percentile as number).toBeGreaterThanOrEqual(c.percentile as number);
        }
      }
    }
  });

  it("publishes the observed spread, so a half-point gap is not over-read", async () => {
    const b = (await health(tenantAdmin)).json() as Scorecard;
    const scored = b.units
      .filter((u) => u.standing !== "UNRANKED")
      .map((u) => u.index as number)
      .sort((x, y) => x - y);
    if (scored.length === 0) {
      expect(b.distribution.min).toBeNull();
      return;
    }
    expect(b.distribution.min).toBeCloseTo(scored[0] as number, 1);
    expect(b.distribution.max).toBeCloseTo(scored[scored.length - 1] as number, 1);
    expect(b.distribution.spread).toBeCloseTo(
      (scored[scored.length - 1] as number) - (scored[0] as number), 1,
    );
    expect(b.distribution.median).not.toBeNull();
    expect(b.distribution.median as number).toBeGreaterThanOrEqual(b.distribution.min as number);
    expect(b.distribution.median as number).toBeLessThanOrEqual(b.distribution.max as number);
  });

  it("the organization index is the headcount-weighted mean of the banded units", async () => {
    const b = (await health(tenantAdmin)).json() as Scorecard;
    const banded = b.units.filter((u) => u.status !== "INSUFFICIENT_DATA" && u.index !== null);
    if (banded.length === 0) {
      expect(b.organizationIndex).toBeNull();
      return;
    }
    const mass = banded.reduce((acc, u) => acc + u.headcount, 0);
    const expected = banded.reduce((acc, u) => acc + u.headcount * (u.index as number), 0) / mass;
    expect(b.organizationIndex).toBeCloseTo(expected, 1);
  });

  it("summary counts match the units, and the weakest unit is listed first", async () => {
    const b = (await health(tenantAdmin)).json() as Scorecard;
    const tally: Record<string, number> = {};
    for (const u of b.units) tally[u.status] = (tally[u.status] ?? 0) + 1;
    for (const [status, n] of Object.entries(b.summary)) expect(n).toBe(tally[status] ?? 0);

    const scored = b.units.filter((u) => u.index !== null).map((u) => u.index as number);
    expect(scored).toEqual([...scored].sort((a, c) => a - c));
  });

  /* ------------------------------------------------ #187: da quale clima si misura */

  it("l'engagement viene dalla rilevazione VIVA, non dalla famiglia ferma", async () => {
    const b = (await health(tenantAdmin)).json() as Scorecard;
    const campione = b.units.reduce(
      (acc, u) => acc + (u.dimensions.find((d) => d.dimension === "engagement")?.sampleSize ?? 0),
      0,
    );

    // Atteso derivato dalla fonte: le risposte numeriche dell'ULTIMA rilevazione con dati,
    // limitate a chi ha un incarico primario attivo — le stesse persone che l'indice pesa.
    const { rows: vivo } = await pool.query<{ n: string }>(
      `WITH ultima AS (
         SELECT DISTINCT ON (s.survey_tenant_id) s.survey_id
           FROM sys.sys_surveys s
          WHERE EXISTS (SELECT 1 FROM sys.sys_survey_responses r
                         WHERE r.survey_response_survey_id = s.survey_id
                           AND r.survey_response_rating_value IS NOT NULL)
          ORDER BY s.survey_tenant_id, s.survey_end_date DESC NULLS LAST, s.created_at DESC
       )
       SELECT count(*)::text AS n
         FROM sys.sys_survey_responses r
         JOIN ultima u ON u.survey_id = r.survey_response_survey_id
         JOIN sys.sys_survey_questions q ON q.survey_question_id = r.survey_response_question_id
        WHERE r.survey_response_rating_value IS NOT NULL
          AND q.survey_question_type IN ('rating','nps')
          AND EXISTS (
            SELECT 1 FROM sys.sys_user_position_assignments a
              JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
             WHERE a.user_position_assignment_user_id = r.survey_response_subject_user_id
               AND a.user_position_assignment_kind = 'PRIMARY'
               AND a.user_position_assignment_status = 'ACTIVE'
               AND p.position_organization_unit_id IS NOT NULL)`,
    );
    expect(campione).toBe(Number(vivo[0]?.n));
    expect(campione).toBeGreaterThan(0);

    // E NON dalla famiglia ferma: se qualcuno ri-puntasse indietro la sorgente, il campione
    // tornerebbe a coincidere con quel conteggio e questo test diventerebbe rosso.
    const { rows: fermo } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM sys.sys_engagement_survey_responses r
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(r.response_answers) = 'array' THEN r.response_answers
                ELSE '[]'::jsonb END) e(elem)
        WHERE r.response_is_complete
          AND (e.elem ? 'rating' OR e.elem ? 'nps'
               OR (e.elem ? 'value' AND e.elem->>'question_type' IN ('rating','nps')))`,
    );
    expect(campione).not.toBe(Number(fermo[0]?.n));
  });

  it("la scala delle risposte è 1..10: se comparisse una rilevazione 1..5 la normalizzazione mentirebbe", async () => {
    // La scala non è dichiarata da nessuna parte (niente CHECK, `survey_question_options` è
    // vuota): il codice normalizza rating su 1..10 perché è ciò che i dati mostrano. Questa
    // è la prova che quel presupposto regge ancora — e l'avviso se un giorno smette.
    const { rows } = await pool.query<{ titolo: string; massimo: string }>(
      `SELECT s.survey_title AS titolo, max(r.survey_response_rating_value)::text AS massimo
         FROM sys.sys_survey_responses r
         JOIN sys.sys_surveys s ON s.survey_id = r.survey_response_survey_id
         JOIN sys.sys_survey_questions q ON q.survey_question_id = r.survey_response_question_id
        WHERE q.survey_question_type = 'rating' AND r.survey_response_rating_value IS NOT NULL
        GROUP BY s.survey_title
       HAVING max(r.survey_response_rating_value) <= 5`,
    );
    expect(rows.map((r) => `${r.titolo} (max ${r.massimo})`)).toEqual([]);
  });

  it("is deterministic: two calls give the same scores", async () => {
    const key = (s: Scorecard) => s.units.map((u) => `${u.orgUnitId}:${u.index}:${u.status}`);
    expect(key((await health(tenantAdmin)).json() as Scorecard))
      .toEqual(key((await health(tenantAdmin)).json() as Scorecard));
  });
});
