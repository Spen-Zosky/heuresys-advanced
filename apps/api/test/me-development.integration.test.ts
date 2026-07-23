/**
 * apps/api/test/me-development.integration.test.ts
 * #59 F/F5 (ADR-0031, supersedes D-6) — GET /v1/me/development: the caller's
 * OWN computed intelligence (flight-risk + capability) with evidence.
 * Self-scope by construction; expected values DERIVED live from the same
 * tables the endpoint reads (no-hardcoded-test-data).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Map<string, string>> {
  const r = await loginRaw(t.app, email, PWD);
  const m = new Map<string, string>();
  for (const c of r.cookies) m.set(c.name, c.value);
  return m;
}

let suite: TestApp;
let userS: Map<string, string>; // tommaso — USER (ESS floor)

describe("#59 GET /v1/me/development (ADR-0031)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("a plain USER sees their OWN scores with evidence (values derived live)", async () => {
    const uid = (
      await pool.query<{ user_id: string }>(
        `SELECT user_id FROM sys.sys_users WHERE user_email = 'tommaso.fiore@rtl-bank.org'`,
      )
    ).rows[0]!.user_id;
    const dbFr = await pool.query<{ value: string; band: string }>(
      `SELECT flight_risk_score_value AS value, flight_risk_score_band AS band
         FROM sys.sys_flight_risk_scores WHERE flight_risk_score_user_id = $1
        ORDER BY flight_risk_score_computed_at DESC LIMIT 1`,
      [uid],
    );

    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/development", headers: { cookie: ch(userS) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as {
      flightRisk: { value: number; band: string; factors: Array<{ feature: string; weight: number }> } | null;
      capability: { value: number } | null;
      generatedAt: string;
    };

    if (dbFr.rows.length > 0) {
      // the endpoint returns exactly the caller's stored score, evidence included
      expect(b.flightRisk).not.toBeNull();
      expect(b.flightRisk!.value).toBe(Number(dbFr.rows[0]!.value));
      expect(b.flightRisk!.band).toBe(dbFr.rows[0]!.band);
      expect(b.flightRisk!.factors.length).toBeGreaterThan(0);
      expect(b.flightRisk!.factors.some((f) => f.weight > 0)).toBe(true);
    } else {
      expect(b.flightRisk).toBeNull(); // real empty-state, never fabricated
    }
  });

  it("self-scope only: the response carries no other user's identifier", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/development", headers: { cookie: ch(userS) },
    });
    const raw = r.body;
    // no uuid other than none: the contract has no userId fields at all —
    // assert the body doesn't leak any sys_users id besides nothing
    const otherUser = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_email = 'antonio.parisi@rtl-bank.org'`,
    );
    expect(raw.includes(otherUser.rows[0]!.user_id)).toBe(false);
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/development" });
    expect(r.statusCode).toBe(401);
  });
});
