/**
 * apps/api/test/compensation-residual-mask.integration.test.ts
 *
 * #124 D3 (S1053) — il mask di ADR-0032 copre TUTTA la superficie COMPENSATION,
 * non solo le recommendations.
 *
 * Misurato prima di scrivere: /variable-pay espone amountEur e un payload con
 * attainment e curva; /variable-pay/:id/evaluation ricalcola l'importo;
 * /reward-gates porta il punteggio per-persona nel latestResult;
 * /bonus-pools espone totalEur; /position-economic-weight un valore che per le
 * posizioni mono-titolare e' un proxy dello stipendio; /handoff-records un
 * payload con total_gross e total_net REALI (misurato: 664207.28 / 478229.29).
 *
 * Stessa regola di D1: la riga resta (periodi, stati, esistenza), il denaro e
 * il punteggio no; il mandato HR (I20) legge tutto.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org";

interface Session { cookies: Map<string, string> }

function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let t: TestApp;
let platform: Session;
let hrMandate: Session;
/** Importi veri, per endpoint, letti dalle tabelle. */
let vpAmounts: string[] = [];
let poolTotals: string[] = [];
let weightValues: string[] = [];
let handoffTotals: string[] = [];

async function login(email: string): Promise<Session> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(PLATFORM_EMAIL);
  hrMandate = await login(HR_MANDATE_EMAIL);
  // String(Number(...)): il DB stampa "125000.00", il JSON serializza 125000 —
  // il confronto sul body grezzo va fatto nella forma che il filo trasporta.
  const q = async (sql: string) => (await pool.query<{ v: string }>(sql)).rows.map((r) => String(Number(r.v)));
  vpAmounts = await q(`SELECT DISTINCT variable_pay_calculation_amount_eur::text AS v
      FROM sys.sys_variable_pay_calculations WHERE variable_pay_calculation_amount_eur IS NOT NULL AND variable_pay_calculation_amount_eur <> 0 LIMIT 10`);
  poolTotals = await q(`SELECT DISTINCT bonus_pool_total_eur::text AS v
      FROM sys.sys_bonus_pools WHERE bonus_pool_total_eur IS NOT NULL AND bonus_pool_total_eur <> 0 LIMIT 10`);
  weightValues = await q(`SELECT DISTINCT position_economic_weight_value::text AS v
      FROM sys.sys_position_economic_weight WHERE position_economic_weight_value IS NOT NULL LIMIT 10`);
  handoffTotals = await q(`SELECT DISTINCT (payroll_handoff_record_payload->>'total_gross') AS v
      FROM sys.sys_payroll_handoff_records WHERE payroll_handoff_record_payload ? 'total_gross' LIMIT 10`);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

async function listAs(s: Session, url: string): Promise<{ raw: string; items: Record<string, unknown>[] }> {
  const res = await t.app.inject({ method: "GET", url, headers: { cookie: cookieHeader(s.cookies) } });
  expect(res.statusCode, `${url}: ${res.body.slice(0, 200)}`).toBe(200);
  const j = res.json() as { items?: Record<string, unknown>[] };
  return { raw: res.body, items: j.items ?? [] };
}

/** Per ogni endpoint: campi assenti+dichiarati per il platform, presenti per l'HR,
 *  e nessun valore vero nel body grezzo del platform. */
async function provaEndpoint(
  url: string,
  maskedFields: string[],
  keptField: string,
  trueValues: string[],
): Promise<void> {
  const p = await listAs(platform, url);
  const h = await listAs(hrMandate, url);
  expect(h.items.length, `${url}: l'HR non vede righe — universo vuoto, prova cieca`).toBeGreaterThan(0);
  expect(p.items.length, `${url}: il platform non vede righe — ADR-0032 vuole la riga visibile`).toBeGreaterThan(0);
  for (const row of p.items) {
    expect(row["masked"], `${url}: masked mancante sul platform`).toEqual([...maskedFields].sort());
    for (const f of maskedFields) {
      expect(Object.hasOwn(row, f), `${url}: ${f} dev'essere ASSENTE per il platform`).toBe(false);
    }
    expect(Object.hasOwn(row, keptField), `${url}: ${keptField} deve RESTARE`).toBe(true);
  }
  for (const row of h.items) {
    expect(row["masked"], `${url}: l'HR non va mascherato`).toBeUndefined();
  }
  const leaked = trueValues.filter((v) => p.raw.includes(v));
  expect(leaked, `${url}: importi veri nel body del platform`).toEqual([]);
  if (trueValues.length > 0) {
    expect(
      trueValues.some((v) => h.raw.includes(v)),
      `${url}: l'HR non vede nessun valore vero — confronto senza significato`,
    ).toBe(true);
  }
}

describe("#124 D3 — la superficie COMPENSATION residua è mascherata al mandato piattaforma", () => {
  it("gira su un universo dove PUÒ fallire", () => {
    expect(vpAmounts.length, "nessun variable-pay con importo").toBeGreaterThan(0);
    expect(poolTotals.length, "nessun bonus pool con totale").toBeGreaterThan(0);
    expect(weightValues.length, "nessun peso economico").toBeGreaterThan(0);
    expect(handoffTotals.length, "nessun handoff con total_gross").toBeGreaterThan(0);
  });

  it("variable-pay: l'importo, il punteggio e il payload spariscono; il periodo resta", async () => {
    await provaEndpoint("/v1/compensation/variable-pay?limit=100",
      ["amountEur", "payload", "signalScore"], "periodStart", vpAmounts);
  });

  it("variable-pay/:id/evaluation: il ragionamento resta, i numeri no", async () => {
    const h = await listAs(hrMandate, "/v1/compensation/variable-pay?limit=1");
    const id = h.items[0]?.["variablePayCalculationId"] as string;
    expect(id, "nessun calcolo da valutare").toBeTruthy();

    const pe = await t.app.inject({
      method: "GET", url: `/v1/compensation/variable-pay/${id}/evaluation`,
      headers: { cookie: cookieHeader(platform.cookies) },
    });
    expect(pe.statusCode).toBe(200);
    const prow = pe.json() as Record<string, unknown>;
    expect(prow["masked"]).toEqual(["attainment", "curveExplanation", "curveFactor", "finalFactor", "recordedAmountEur"]);
    for (const f of ["recordedAmountEur", "attainment", "curveFactor", "finalFactor", "curveExplanation"]) {
      expect(Object.hasOwn(prow, f), `${f} dev'essere ASSENTE`).toBe(false);
    }
    expect(Object.hasOwn(prow, "gateDecision"), "l'esito dei cancelli resta").toBe(true);

    const he = await t.app.inject({
      method: "GET", url: `/v1/compensation/variable-pay/${id}/evaluation`,
      headers: { cookie: cookieHeader(hrMandate.cookies) },
    });
    expect(he.statusCode).toBe(200);
    const hrow = he.json() as Record<string, unknown>;
    expect(hrow["masked"]).toBeUndefined();
    expect(Object.hasOwn(hrow, "recordedAmountEur")).toBe(true);
  });

  it("reward-gates: la riga e lo stato restano, payload e punteggio no", async () => {
    const p = await listAs(platform, "/v1/compensation/reward-gates?limit=100");
    const h = await listAs(hrMandate, "/v1/compensation/reward-gates?limit=100");
    expect(h.items.length).toBeGreaterThan(0);
    expect(p.items.length).toBeGreaterThan(0);
    let latestSeen = 0;
    for (const row of p.items) {
      expect(row["masked"]).toEqual(["payload"]);
      expect(Object.hasOwn(row, "payload")).toBe(false);
      expect(Object.hasOwn(row, "catalogCode"), "il catalogo resta").toBe(true);
      const lr = row["latestResult"] as Record<string, unknown> | null;
      if (lr) {
        latestSeen += 1;
        expect(lr["masked"]).toEqual(["payload", "score"]);
        expect(Object.hasOwn(lr, "score"), "lo score per-persona dev'essere ASSENTE").toBe(false);
        expect(Object.hasOwn(lr, "status"), "lo stato categoriale resta").toBe(true);
      }
    }
    expect(latestSeen, "nessun latestResult nell'universo: la prova sullo score è cieca").toBeGreaterThan(0);
    for (const row of h.items) expect(row["masked"]).toBeUndefined();
  });

  it("bonus-pools: totalEur e payload spariscono (aggregato senza soggetto, vincolo 5)", async () => {
    await provaEndpoint("/v1/compensation/bonus-pools?limit=100",
      ["payload", "totalEur"], "periodStart", poolTotals);
  });

  it("position-economic-weight: il valore sparisce (proxy dello stipendio sulle mono-titolare)", async () => {
    await provaEndpoint("/v1/compensation/position-economic-weight?limit=100",
      ["metadata", "value"], "positionId", weightValues);
  });

  it("handoff-records: il payload con total_gross/total_net sparisce", async () => {
    await provaEndpoint("/v1/compensation/handoff-records?limit=100",
      ["payload"], "recipientSystem", handoffTotals);
  });
});
