import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ScenarioDetailSchema } from "@heuresys/shared";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { userWithRole } from "./helpers/actors.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { CALCOLATORE_NEL_TEMPO } from "../src/modules/scenari/calcolatori/nel-tempo.js";

/**
 * F3b-3 del piano Heuresys AI-driven (ADR-0063 D5): lo scenario nel tempo (S-T3) calcolato su RTL.
 *
 *   1. il Direttore HR calcola lo scenario con la stima dalla storia: versione CALCOLATA, opzioni A, B
 *      (e C se la storia ha selezioni concluse), risultati a 6, 12 e 36 mesi con banda, estrazioni e fonti;
 *   2. l'ipotesi del tasso è una STIMA con la banda e la fonte STORIA; nessuna opzione raccomandata,
 *      chi sposta persone dichiara l'equità;
 *   3. le tabelle vere non cambiano;
 *   4. la prova di resistenza con il tasso imposto al 10% dichiara il tasso come VINCOLO e, sulle
 *      stesse uscite, la copertura interna non lascia più posizioni scoperte della nessuna copertura;
 *   5. un orizzonte fuori elenco è rifiutato dal contratto.
 * Il file gira in una transazione annullata alla fine (tx-isolation): nessun residuo.
 */

interface S { cookies: Map<string, string>; csrfToken: string }
const hdr = (s: S): Record<string, string> => ({
  cookie: [...s.cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; "),
  "x-csrf-token": s.csrfToken,
  "content-type": "application/json",
});

let t: TestApp;
let hr: S;
let tenantId = "";

async function impronteVere(): Promise<string> {
  const r = await pool.query<{ x: string }>(
    `SELECT concat_ws('|',
       (SELECT md5(string_agg(t::text, '|' ORDER BY organization_unit_id)) FROM sys.sys_organization_units t WHERE organization_unit_tenant_id = $1),
       (SELECT md5(string_agg(t::text, '|' ORDER BY position_id)) FROM sys.sys_positions t WHERE position_tenant_id = $1),
       (SELECT md5(string_agg(t::text, '|' ORDER BY user_position_assignment_id)) FROM sys.sys_user_position_assignments t WHERE user_position_assignment_tenant_id = $1),
       (SELECT md5(string_agg(t::text, '|' ORDER BY successor_candidate_id)) FROM sys.sys_successor_candidates t WHERE successor_candidate_tenant_id = $1)) AS x`,
    [tenantId],
  );
  return r.rows[0]!.x;
}

beforeAll(async () => {
  t = await buildTestApp();
  const rtl = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`);
  tenantId = rtl.rows[0]!.tenant_id;
  const r = await loginRaw(t.app, (await userWithRole("HRMS_MANAGER", { tenantId })).email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  hr = { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}, 120_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("F3b-3 — lo scenario nel tempo", () => {
  it("con la stima dalla storia: tre orizzonti, bande, fonti, nessuna scrittura vera", async () => {
    const prima = await impronteVere();
    const crea = await t.app.inject({ method: "POST", url: "/v1/scenari/nel-tempo", headers: hdr(hr), payload: { draws: 200 } });
    expect(crea.statusCode, crea.body).toBe(201);
    const d = ScenarioDetailSchema.parse(crea.json());
    expect(d.scenario.family).toBe("NEL_TEMPO");
    expect(d.scenario.catalogCode).toBe("S-T3");
    const v = d.version!;
    expect(v.status).toBe("CALCOLATA");
    expect(v.options.map((o) => o.code).slice(0, 2)).toEqual(["A", "B"]);
    const tasso = v.assumptions.find((a) => a.kind === "STIMA" && a.statement.includes("dodici mesi"));
    expect(tasso, "ipotesi del tasso di uscita").toBeDefined();
    expect(tasso!.low).not.toBeNull();
    expect(tasso!.sources.some((s) => s.kind === "STORIA")).toBe(true);
    for (const o of v.options) {
      expect(o.recommended).toBe(false);
      if (o.touchesPeople) expect(o.equityChecks.length).toBeGreaterThan(0);
      for (const mesi of [6, 12, 36]) {
        const sc = o.results.find((r) => r.metricCode === "posizioni_scoperte" && r.horizonMonths === mesi);
        expect(sc, `${o.code} a ${mesi} mesi`).toBeDefined();
        expect(sc!.draws).toBe(200);
        expect(sc!.low).not.toBeNull();
        expect(sc!.computedBy).toBe(CALCOLATORE_NEL_TEMPO);
      }
      for (const r of o.results) expect(r.sources.length, `fonti di ${o.code}.${r.metricCode}`).toBeGreaterThan(0);
    }
    expect(await impronteVere()).toBe(prima);
  }, 120_000);

  it("prova di resistenza al 10%: tasso come vincolo, la copertura interna non peggiora le scoperte", async () => {
    const crea = await t.app.inject({
      method: "POST", url: "/v1/scenari/nel-tempo", headers: hdr(hr),
      payload: { draws: 200, horizonsMonths: [12], annualExitRate: 0.1 },
    });
    expect(crea.statusCode, crea.body).toBe(201);
    const v = ScenarioDetailSchema.parse(crea.json()).version!;
    expect(v.assumptions.some((a) => a.kind === "VINCOLO" && a.value === 10)).toBe(true);
    const scoperte = (code: string) => v.options.find((o) => o.code === code)!.results.find((r) => r.metricCode === "posizioni_scoperte")!.value;
    const uscite = (code: string) => v.options.find((o) => o.code === code)!.results.find((r) => r.metricCode === "uscite")!.value;
    expect(uscite("A")).toBeGreaterThan(0);
    expect(scoperte("B")).toBeLessThanOrEqual(scoperte("A"));
  }, 120_000);

  it("un orizzonte fuori elenco è rifiutato", async () => {
    const r = await t.app.inject({ method: "POST", url: "/v1/scenari/nel-tempo", headers: hdr(hr), payload: { horizonsMonths: [5] } });
    expect(r.statusCode).toBe(400);
  });
});
