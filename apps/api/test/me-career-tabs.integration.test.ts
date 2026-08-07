/**
 * apps/api/test/me-career-tabs.integration.test.ts
 * S1011 F3b — /me/career sub-tabs (Obiettivi | Percorsi | Rischio & Successione).
 *   GET /v1/me/goals          (goal:read:self, backfilled subject user mig 000166)
 *   GET /v1/me/risk           (career_succession:read:self)
 *   GET /v1/me/career-paths   (career_succession:read:self)
 *
 * Self-scope inherited from the me module: userId always from req.user, no :userId param.
 * Expected values are DERIVED from the live DB (S1012 no-hardcoded-test-data:
 * flight-risk bands and counts evolve — the insights timers recompute scores —
 * and a pinned literal breaks on any legitimately refreshed clone; S1023 the
 * hardcoded 'LOW' failed on the off-prod runner whose clone carried MEDIUM).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import type { MeGoalsResponse, MeRiskResponse, MeCareerPathsResponse } from "@heuresys/shared";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookie: string }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return { cookie };
}
function get(t: TestApp, s: S, url: string) {
  return t.app.inject({ method: "GET", url, headers: { cookie: s.cookie } });
}

let suite: TestApp;
let employee: S;   // tommaso.fiore — USER with real career data
let outsider: S;   // antonio.parisi — USER, different person
let employeeId: string;

describe("/v1/me/{goals,risk,career-paths} — F3b career sub-tabs", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    employee = await login(suite, "tommaso.fiore@rtl-bank.org");
    outsider = await login(suite, "antonio.parisi@rtl-bank.org");
    const u = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = 'tommaso.fiore@rtl-bank.org'`,
    );
    employeeId = u.rows[0]!.user_id;
  });
  afterAll(async () => { await suite.app.close(); await closePool(); });

  it("GET /v1/me/goals returns the caller's own goals (count derived from the DB)", async () => {
    const expected = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_goals WHERE goal_subject_user_id = $1`,
      [employeeId],
    );
    const r = await get(suite, employee, "/v1/me/goals");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MeGoalsResponse;
    expect(body.total).toBe(body.items.length);
    expect(body.total).toBe(expected.rows[0]!.n);
    expect(body.total).toBeGreaterThan(0); // tommaso is the goals-bearing persona (mig 000166)
    expect(body.items[0]).toHaveProperty("title");
    expect(body.items[0]).toHaveProperty("progressPercent");
  });

  it("GET /v1/me/risk returns own flight-risk (latest, DB-derived) + succession-readiness per position", async () => {
    const latest = await pool.query<{ band: string; value: string }>(
      `SELECT flight_risk_score_band AS band, flight_risk_score_value::text AS value
         FROM sys.sys_flight_risk_scores
        WHERE flight_risk_score_user_id = $1
        ORDER BY flight_risk_score_computed_at DESC LIMIT 1`,
      [employeeId],
    );
    const positions = await pool.query<{ n: number }>(
      `SELECT count(DISTINCT succession_readiness_score_position_id)::int AS n
         FROM sys.sys_succession_readiness_scores
        WHERE succession_readiness_score_user_id = $1`,
      [employeeId],
    );
    const r = await get(suite, employee, "/v1/me/risk");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MeRiskResponse;
    expect(body.flightRisk).not.toBeNull();
    expect(body.flightRisk?.band).toBe(latest.rows[0]!.band);
    expect(typeof body.flightRisk?.value).toBe("number");
    expect(body.flightRisk?.value).toBeCloseTo(Number(latest.rows[0]!.value), 2);
    expect(body.succession.length).toBe(positions.rows[0]!.n);
    expect(body.succession.length).toBeGreaterThan(0); // tommaso carries readiness rows
    expect(body.succession[0]).toHaveProperty("positionTitle");
    expect(body.succession[0]).toHaveProperty("horizon");
  });

  it("GET /v1/me/career-paths derives paths from the PRIMARY position", async () => {
    const r = await get(suite, employee, "/v1/me/career-paths");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MeCareerPathsResponse;
    expect(body.fromPositionTitle).toBeTruthy(); // tommaso has a PRIMARY position
    expect(Array.isArray(body.paths)).toBe(true);
    expect(Array.isArray(body.plans)).toBe(true);
  });

  /**
   * #155/S1048 — la posizione di partenza è quella IN CORSO, mai un incarico chiuso.
   *
   * La query filtrava `kind = 'PRIMARY'` ma non lo stato, con un `LIMIT 1` privo di
   * ordinamento: restituiva un'assegnazione qualsiasi fra quelle mai avute. Misurato
   * live su PROD prima del fix: `alberto.colombo@rtl-bank.org` si vedeva come
   * «Securities Dealer», incarico chiuso nel 2020, e quindi senza alcun percorso.
   * Riguarda **140 persone su 163**, cioè chiunque abbia cambiato posizione.
   *
   * Restava invisibile perché le posizioni disattivate avevano ancora percorsi
   * attaccati; il riallineamento di #155 (mig 000277) li ha tolti e la pagina è
   * diventata vuota — il difetto c'era da prima, il dato lo mascherava.
   *
   * L'atteso è DERIVATO dal DB (S1012): tommaso ha 1 incarico attivo e 1 chiuso,
   * quindi il test distingue davvero fra i due.
   */
  it("GET /v1/me/career-paths starts from the ACTIVE assignment, never a closed one", async () => {
    const atteso = await pool.query<{ position_title: string | null; n_chiuse: number }>(
      `SELECT p.position_title,
              (SELECT count(*)::int FROM sys.sys_user_position_assignments c
                WHERE c.user_position_assignment_user_id = $1
                  AND c.user_position_assignment_kind = 'PRIMARY'
                  AND c.user_position_assignment_status <> 'ACTIVE') AS n_chiuse
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
        WHERE a.user_position_assignment_user_id = $1
          AND a.user_position_assignment_kind = 'PRIMARY'
          AND a.user_position_assignment_status = 'ACTIVE'
        ORDER BY a.user_position_assignment_start_date DESC NULLS LAST
        LIMIT 1`, [employeeId],
    );
    const row = atteso.rows[0]!;
    // Se la persona non avesse incarichi chiusi, il test passerebbe anche col difetto:
    // senza questa guardia sarebbe una prova che non può fallire.
    expect(row.n_chiuse).toBeGreaterThan(0);

    const r = await get(suite, employee, "/v1/me/career-paths");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MeCareerPathsResponse;
    expect(body.fromPositionTitle).toBe(row.position_title);

    // e la posizione di partenza dev'essere viva: una posizione spenta non ha percorsi
    const viva = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_positions
        WHERE position_title = $1 AND position_is_active`, [body.fromPositionTitle],
    );
    expect(viva.rows[0]!.n).toBeGreaterThan(0);
  });

  it("is self-scoped: a different persona gets their own data, never another user's", async () => {
    const mine = (await get(suite, employee, "/v1/me/goals")).json() as MeGoalsResponse;
    const theirs = (await get(suite, outsider, "/v1/me/goals")).json() as MeGoalsResponse;
    // No :userId param exists; each caller sees only their own goals. Totals are independent.
    expect((await get(suite, outsider, "/v1/me/goals")).statusCode).toBe(200);
    expect(mine.total).not.toBe(undefined);
    expect(theirs.total).not.toBe(undefined);
    // La proprieta' di self-scope e' che i due insiemi non condividono NESSUNA
    // riga — non che non condividano un titolo: due persone possono avere lo
    // stesso obiettivo («Ridurre i crediti deteriorati») e da quando il ciclo di
    // performance e' popolato lo hanno davvero. Confrontare i titoli faceva
    // fallire il test per un fatto legittimo del dato, e soprattutto non provava
    // l'isolamento: si verifica sull'identificativo.
    const miei = new Set(mine.items.map((g) => g.goalId));
    expect(theirs.items.filter((g) => miei.has(g.goalId))).toHaveLength(0);
  });

  it("rejects unauthenticated access", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/goals" });
    expect([401, 403]).toContain(r.statusCode);
  });
});
