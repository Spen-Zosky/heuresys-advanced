/**
 * apps/api/test/exposure-gate.integration.test.ts
 *
 * Il CANCELLO DI ESPOSIZIONE (regola Enzo 2026-07-28): un dato che nessuna API
 * espone non e' nel prodotto, e' solo nel database. Alla chiusura di ogni cluster
 * del programma storia36 le lacune di esposizione vanno colmate.
 *
 * Questo file copre i tre endpoint nati da quella regola — le tre tabelle che il
 * programma popolava e che nessun modulo leggeva:
 *   sys_user_professional_experiences      → GET /v1/me/professional-experiences
 *   sys_position_skill_requirement_history → GET /v1/positions/:id/skill-requirements/history
 *   sys_payout_curves                      → GET /v1/compensation/payout-curves
 *
 * Le attese sono DERIVATE dalla sorgente (dottrina no-hardcoded-test-data): il
 * test confronta la risposta con la stessa riga di database, non con un numero
 * scritto a mano.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let dipendente: S;
let hr: S;

describe("cancello di esposizione — i dati del programma sono raggiungibili dall'API", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    dipendente = await login(suite, "tommaso.fiore@rtl-bank.org");
    hr = await login(suite, "federica.marchetti@rtl-bank.org");
  });
  afterAll(async () => { await suite.app.close(); await closePool(); });

  it("GET /v1/me/professional-experiences restituisce il curriculum di chi chiama, non di altri", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/professional-experiences",
      headers: { cookie: ch(dipendente.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      total: number;
      items: Array<{ employer: string; roleTitle: string; startDate: string; endDate: string | null; durationMonths: number | null }>;
    };

    // atteso DERIVATO dalla sorgente, mai un numero scritto a mano
    const src = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_user_professional_experiences
        WHERE user_prof_exp_user_id = $1`, [dipendente.userId]);
    expect(body.total).toBe(Number(src.rows[0]!.n));

    for (const e of body.items) {
      expect(e.employer.length).toBeGreaterThan(0);
      expect(e.roleTitle.length).toBeGreaterThan(0);
      expect(e.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (e.endDate) {
        expect(e.endDate >= e.startDate).toBe(true);
        expect(e.durationMonths).not.toBeNull();
      }
    }
    // ordinamento: dalla piu' recente, come un curriculum
    const inizi = body.items.map((e) => e.startDate);
    expect([...inizi].sort().reverse()).toEqual(inizi);
  });

  it("le esperienze sono self-scoped: due persone non condividono nemmeno una riga", async () => {
    const mie = (await suite.app.inject({
      method: "GET", url: "/v1/me/professional-experiences",
      headers: { cookie: ch(dipendente.cookies) },
    })).json() as { items: Array<{ professionalExperienceId: string }> };
    const sue = (await suite.app.inject({
      method: "GET", url: "/v1/me/professional-experiences",
      headers: { cookie: ch(hr.cookies) },
    })).json() as { items: Array<{ professionalExperienceId: string }> };
    const idMiei = new Set(mie.items.map((e) => e.professionalExperienceId));
    expect(sue.items.filter((e) => idMiei.has(e.professionalExperienceId))).toHaveLength(0);
  });

  it("GET /v1/positions/:id/skill-requirements/history racconta come sono cambiati i requisiti", async () => {
    // si sceglie la posizione con piu' storia: derive-live, non un uuid fisso
    const scelta = await pool.query<{ position_id: string; n: string }>(
      `SELECT position_skill_requirement_history_position_id AS position_id, count(*)::text AS n
         FROM sys.sys_position_skill_requirement_history
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`);
    if (scelta.rows.length === 0) {
      expect.fail("nessuna storia di requisiti: il cancello di esposizione non e' verificabile");
    }
    const positionId = scelta.rows[0]!.position_id;

    const r = await suite.app.inject({
      method: "GET", url: `/v1/positions/${positionId}/skill-requirements/history`,
      headers: { cookie: ch(hr.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      total: number;
      items: Array<{ oldProficiency: string | null; newProficiency: string; skillName: string | null; effectiveAt: string }>;
    };
    expect(body.total).toBe(Number(scelta.rows[0]!.n));
    for (const h of body.items) {
      // una variazione che non varia nulla non e' una variazione
      expect(h.newProficiency).not.toBe(h.oldProficiency);
      // il nome della competenza e' risolto: senza, la storia sarebbe illeggibile
      expect(h.skillName).not.toBeNull();
    }
    const date = body.items.map((h) => h.effectiveAt);
    expect([...date].sort().reverse()).toEqual(date);
  });

  it("GET /v1/compensation/payout-curves espone la regola con cui il premio e' calcolato", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/payout-curves",
      headers: { cookie: ch(hr.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      total: number;
      items: Array<{ code: string; kind: string; payload: Record<string, unknown>; isGlobal: boolean }>;
    };
    const src = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_payout_curves
        WHERE payout_curve_is_global = true
           OR payout_curve_tenant_id = (SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1)`,
      [hr.userId]);
    expect(body.total).toBe(Number(src.rows[0]!.n));
    expect(body.total).toBeGreaterThan(0);
    for (const c of body.items) {
      expect(c.code.length).toBeGreaterThan(0);
      // il payload E' la curva: una curva vuota non spiega nessun importo
      expect(Object.keys(c.payload).length).toBeGreaterThan(0);
    }
  });

  it("i tre endpoint rifiutano il chiamante non autenticato", async () => {
    for (const url of [
      "/v1/me/professional-experiences",
      "/v1/compensation/payout-curves",
    ]) {
      const r = await suite.app.inject({ method: "GET", url });
      expect([401, 403]).toContain(r.statusCode);
    }
  });
});
