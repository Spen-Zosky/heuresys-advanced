import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ScenarioDetailSchema, ScenarioListSchema } from "@heuresys/shared";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { managerAndReport, userWithRole } from "./helpers/actors.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

/**
 * F3b-2 del piano Heuresys AI-driven (ADR-0063 D5): le rotte del motore degli scenari.
 *
 *   1. il Direttore HR di RTL calcola uno scenario di uscita a cascata (201) e la risposta rispetta il contratto;
 *   2. lo ritrova nell'elenco del tenant e nel dettaglio, con tre opzioni, risultati e fonti;
 *   3. una persona senza mandato HR riceve FORBIDDEN in lettura e in calcolo;
 *   4. uno scenario che non c'è risponde SCENARIO_NOT_FOUND.
 * Il file gira in una transazione annullata alla fine (tx-isolation): nessun residuo.
 */

interface S { cookies: Map<string, string>; csrfToken: string }
const hdr = (s: S): Record<string, string> => ({
  cookie: [...s.cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; "),
  "x-csrf-token": s.csrfToken,
});
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let t: TestApp;
let hr: S;
let senzaMandato: S;
let uscente = "";

beforeAll(async () => {
  t = await buildTestApp();
  const rtl = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`);
  const tenantId = rtl.rows[0]!.tenant_id;
  hr = await login(t, (await userWithRole("HRMS_MANAGER", { tenantId })).email);
  senzaMandato = await login(t, (await managerAndReport()).report.email);
  // il titolare PRIMARY di una posizione con una tavola di successione attiva
  const c = await pool.query<{ user_id: string }>(
    `SELECT a.user_position_assignment_user_id AS user_id
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_succession_pools sp ON sp.succession_pool_position_id = a.user_position_assignment_position_id
        AND sp.succession_pool_status = 'ACTIVE'
      WHERE a.user_position_assignment_tenant_id = $1 AND a.user_position_assignment_kind = 'PRIMARY'
        AND a.user_position_assignment_status = 'ACTIVE' AND a.user_position_assignment_start_date <= current_date
        AND (a.user_position_assignment_end_date IS NULL OR a.user_position_assignment_end_date >= current_date)
      ORDER BY a.user_position_assignment_user_id LIMIT 1`,
    [tenantId],
  );
  if (!c.rows[0]) throw new Error("in RTL non c'è un titolare di una posizione con una tavola di successione: il caso da provare non c'è");
  uscente = c.rows[0].user_id;
}, 120_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("F3b-2 — le rotte degli scenari", () => {
  it("il Direttore HR calcola, ritrova e legge uno scenario a cascata", async () => {
    const crea = await t.app.inject({
      method: "POST", url: "/v1/scenari/uscite", headers: { ...hdr(hr), "content-type": "application/json" },
      payload: { userIds: [uscente], family: "CASCATA" },
    });
    expect(crea.statusCode, crea.body).toBe(201);
    const d = ScenarioDetailSchema.parse(crea.json());
    expect(d.scenario.catalogCode).toBe("S-T2");
    expect(d.version?.status).toBe("CALCOLATA");
    expect(d.version?.options.map((o) => o.code)).toEqual(["A", "B", "C"]);
    for (const o of d.version!.options) {
      expect(o.results.length, `risultati di ${o.code}`).toBeGreaterThan(0);
      for (const r of o.results) expect(r.sources.length, `fonti di ${o.code}.${r.metricCode}`).toBeGreaterThan(0);
      expect(o.recommended).toBe(false);
    }

    const elenco = await t.app.inject({ method: "GET", url: "/v1/scenari", headers: hdr(hr) });
    expect(elenco.statusCode, elenco.body).toBe(200);
    const l = ScenarioListSchema.parse(elenco.json());
    expect(l.total).toBe(l.items.length);
    expect(l.items.map((s) => s.id)).toContain(d.scenario.id);

    const uno = await t.app.inject({ method: "GET", url: `/v1/scenari/${d.scenario.id}`, headers: hdr(hr) });
    expect(uno.statusCode, uno.body).toBe(200);
    expect(ScenarioDetailSchema.parse(uno.json())).toEqual(d);
  });

  it("chi non ha il mandato HR non legge e non calcola", async () => {
    const l = await t.app.inject({ method: "GET", url: "/v1/scenari", headers: hdr(senzaMandato) });
    expect(l.statusCode).toBe(403);
    expect(l.json().error.code).toBe("FORBIDDEN");
    const c = await t.app.inject({
      method: "POST", url: "/v1/scenari/uscite", headers: { ...hdr(senzaMandato), "content-type": "application/json" },
      payload: { userIds: [uscente], family: "EFFETTO_DIRETTO" },
    });
    expect(c.statusCode).toBe(403);
  });

  it("uno scenario che non c'è risponde SCENARIO_NOT_FOUND", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/scenari/00000000-0000-4000-8000-000000000000", headers: hdr(hr) });
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe("SCENARIO_NOT_FOUND");
  });
});
