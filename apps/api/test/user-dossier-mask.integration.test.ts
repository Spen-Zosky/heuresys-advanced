/**
 * apps/api/test/user-dossier-mask.integration.test.ts
 *
 * #124 D1 (S1053) — la falla del dossier, chiusa e provata sul filo.
 *
 * GET /v1/users/:userId/dossier (#81) è nato PRIMA del mask di ADR-0032 e
 * restituiva al PLATFORM_ADMIN le buste paga (grossPay/netPay/deductions), lo
 * stipendio contrattuale e le valutazioni di chiunque — smentendo la prova di
 * chiusura di S1044 («la busta paga altrui non è esposta da alcuna API»: lo
 * era, da qui). Questo file fissa il comportamento di ADR-0032 sull'intero
 * dossier: la riga resta, il giudizio e il denaro no.
 *
 * Come per compensation-mask: l'asserzione che conta legge il body GREZZO —
 * un importo sopravvissuto in un campo gemello è esattamente il guasto che
 * un'ispezione per-campo non vedrebbe. Ogni atteso viene dal DB live.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { passwordFor } from "./helpers/personas.js";

const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org"; // TENANT_ADMIN — I20

interface Session {
  cookies: Map<string, string>;
}

function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function login(t: TestApp, email: string): Promise<Session> {
  const r = await loginRaw(t.app, email, passwordFor(email));
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let t: TestApp;
let platform: Session;
let hrMandate: Session;

/** Il bersaglio: una persona RTL con buste, stipendio e valutazioni REALI. */
let targetId = "";
/** I valori veri, letti dalla tabella: quelli che il mask deve nascondere. */
let trueMoney: string[] = [];

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(t, PLATFORM_EMAIL);
  hrMandate = await login(t, HR_MANDATE_EMAIL);

  // Bersaglio deterministico: ha almeno una busta con importi, uno stipendio
  // in employment e una valutazione con rating. Se non esistesse, il test non
  // può dimostrare nulla e deve dirlo (universo che PUÒ fallire).
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT u.user_id
       FROM sys.sys_users u
      WHERE EXISTS (SELECT 1 FROM sys.sys_user_pay_slips p
                     WHERE p.user_pay_slip_user_id = u.user_id
                       AND p.user_pay_slip_gross_pay IS NOT NULL AND p.user_pay_slip_gross_pay <> 0)
        AND EXISTS (SELECT 1 FROM sys.sys_user_employment e
                     WHERE e.user_employment_user_id = u.user_id
                       AND e.user_employment_salary IS NOT NULL AND e.user_employment_salary <> 0)
        AND EXISTS (SELECT 1 FROM sys.sys_performance_reviews r
                     WHERE r.review_subject_user_id = u.user_id
                       AND r.review_overall_rating IS NOT NULL)
        AND u.user_email <> $1
      ORDER BY u.user_email
      LIMIT 1`,
    [HR_MANDATE_EMAIL],
  );
  targetId = rows[0]?.user_id ?? "";
  if (!targetId) return;

  const money = await pool.query<{ v: string }>(
    `SELECT DISTINCT p.user_pay_slip_gross_pay::text AS v FROM sys.sys_user_pay_slips p
      WHERE p.user_pay_slip_user_id = $1 AND p.user_pay_slip_gross_pay IS NOT NULL AND p.user_pay_slip_gross_pay <> 0
     UNION
     SELECT DISTINCT p.user_pay_slip_net_pay::text FROM sys.sys_user_pay_slips p
      WHERE p.user_pay_slip_user_id = $1 AND p.user_pay_slip_net_pay IS NOT NULL AND p.user_pay_slip_net_pay <> 0
     UNION
     SELECT e.user_employment_salary::text FROM sys.sys_user_employment e
      WHERE e.user_employment_user_id = $1 AND e.user_employment_salary IS NOT NULL AND e.user_employment_salary <> 0`,
    [targetId],
  );
  trueMoney = money.rows.map((r) => r.v);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

async function dossierAs(s: Session): Promise<{ raw: string; body: Record<string, unknown> }> {
  const res = await t.app.inject({
    method: "GET",
    url: `/v1/users/${targetId}/dossier`,
    headers: { cookie: cookieHeader(s.cookies) },
  });
  expect(res.statusCode, `dossier failed: ${res.body.slice(0, 300)}`).toBe(200);
  return { raw: res.body, body: res.json() as Record<string, unknown> };
}

const PAY_SLIP_MASKED = ["deductions", "grossPay", "netPay"];
const REVIEW_MASKED = [
  "competencyRating", "goalRating", "overallRating",
  "performanceBox", "potentialBox", "potentialRating",
];

describe("#124 D1 — il dossier maschera denaro e giudizio sotto il mandato piattaforma", () => {
  it("gira su un universo dove PUÒ fallire", async () => {
    expect(targetId, "nessun utente con buste+stipendio+valutazioni: niente da nascondere").toBeTruthy();
    expect(trueMoney.length).toBeGreaterThan(0);
  });

  it("platform: la riga resta, il denaro e il giudizio no", async () => {
    const { body } = await dossierAs(platform);

    const paySlips = body["paySlips"] as Record<string, unknown>[];
    expect(paySlips.length, "il bersaglio è stato scelto perché HA buste").toBeGreaterThan(0);
    for (const p of paySlips) {
      expect(p["period"], "il periodo resta visibile (ADR-0032)").toBeTruthy();
      expect(p["masked"]).toEqual(PAY_SLIP_MASKED);
      expect(Object.hasOwn(p, "grossPay"), "grossPay dev'essere ASSENTE, non null").toBe(false);
      expect(Object.hasOwn(p, "netPay")).toBe(false);
      expect(Object.hasOwn(p, "deductions")).toBe(false);
    }

    const profile = body["profile"] as Record<string, unknown>;
    const employment = profile["employment"] as Record<string, unknown> | null;
    expect(employment, "il bersaglio è stato scelto perché HA un rapporto di lavoro").toBeTruthy();
    expect(Object.hasOwn(employment!, "salary")).toBe(false);
    expect(employment!["masked"]).toContain("salary");
    // i fatti del rapporto restano: assunzione e stato non sono retribuzione
    expect(Object.hasOwn(employment!, "hireDate")).toBe(true);
    expect(Object.hasOwn(employment!, "status")).toBe(true);

    const contracts = body["contracts"] as Record<string, unknown>[];
    for (const c of contracts) {
      expect(Object.hasOwn(c, "grossAnnualSalary")).toBe(false);
      expect(c["masked"]).toContain("grossAnnualSalary");
    }

    const performance = body["performance"] as Record<string, unknown>[];
    expect(performance.length, "il bersaglio è stato scelto perché HA valutazioni").toBeGreaterThan(0);
    for (const r of performance) {
      expect(r["type"], "tipo e periodo restano (ADR-0032)").toBeTruthy();
      expect(r["masked"]).toEqual(REVIEW_MASKED);
      for (const k of REVIEW_MASKED) {
        expect(Object.hasOwn(r, k), `${k} dev'essere ASSENTE`).toBe(false);
      }
    }
  });

  it("platform: nessun importo vero sopravvive nel body serializzato", async () => {
    const { raw } = await dossierAs(platform);
    const leaked = trueMoney.filter((v) => raw.includes(v));
    expect(leaked, "questi importi veri sono sopravvissuti nel body").toEqual([]);
  });

  it("HR mandate (I20): legge tutto, senza mask", async () => {
    const { raw, body } = await dossierAs(hrMandate);
    const paySlips = body["paySlips"] as Record<string, unknown>[];
    expect(paySlips.length).toBeGreaterThan(0);
    for (const p of paySlips) {
      expect(p["masked"]).toBeUndefined();
      expect(Object.hasOwn(p, "grossPay")).toBe(true);
    }
    const performance = body["performance"] as Record<string, unknown>[];
    for (const r of performance) {
      expect(r["masked"]).toBeUndefined();
      expect(Object.hasOwn(r, "overallRating")).toBe(true);
    }
    expect(
      trueMoney.some((v) => raw.includes(v)),
      "il mandato HR non ha visto nessun importo vero: il confronto col platform non dimostra nulla",
    ).toBe(true);
  });
});
