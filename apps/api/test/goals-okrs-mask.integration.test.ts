/**
 * apps/api/test/goals-okrs-mask.integration.test.ts
 *
 * #124 D4 (S1054) — il mask di ADR-0032 su `goals` e `okrs`.
 *
 * QUI IL CONFINE LO DETTA L'INVARIANTE, non il gusto: **I20 vuole che «riga,
 * soggetto, periodo e STATO» restino visibili**. Quindi gli stati NON si
 * mascherano — ne' `status` sull'obiettivo, ne' `newStatus` su un aggiornamento,
 * ne' `statusUpdate` su un check-in — e se ne va il QUANTO: percentuali, valori
 * raggiunti, testi scritti sulla persona, e l'autovalutazione `confidenceLevel`.
 * Sul risultato-chiave: `startValue`/`targetValue` restano (e' la definizione di
 * cosa ci si aspettava), `currentValue`/`progressPercent` no.
 *
 * DUE UNIVERSI MOLTO DIVERSI, misurati prima di scrivere:
 *  - `goals` e' ricco — 2189 obiettivi, TUTTI con un soggetto, piu' 7567
 *    check-in, 1075 aggiornamenti, 500 commenti: si prova sui dati reali;
 *  - `okrs` e' cieco — **0 su 17 OKR hanno un proprietario**, 0 su 20
 *    risultati-chiave, 0 su 25 check-in. Su quei dati il mask non puo' mordere,
 *    e un test che li leggesse passerebbe qualunque cosa faccia il codice.
 *    Percio' la condizione si COSTRUISCE dentro il file: l'isolamento
 *    transazionale (D-52) la annulla a fine corsa. Senza questo, la meta' OKR di
 *    questa consegna sarebbe codice mai eseguito con un test verde sopra.
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
let goalId = "";
let goalConCheckIn = "";
let goalConCommento = "";
/** OKR costruito qui: i dati reali non hanno proprietari (vedi intestazione). */
let okrSintetico = "";
let tenantRtl = "";
let personaRtl = "";

async function login(email: string): Promise<Session> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

interface Riga { masked?: string[]; [k: string]: unknown }

async function getAs(s: Session, url: string): Promise<{ raw: string; items: Riga[]; body: Record<string, unknown> }> {
  const res = await t.app.inject({ method: "GET", url, headers: { cookie: cookieHeader(s.cookies) } });
  expect(res.statusCode, `${url}: ${res.body.slice(0, 200)}`).toBe(200);
  const body = res.json() as { items?: Riga[] };
  return { raw: res.body, items: body.items ?? [], body: body as Record<string, unknown> };
}

/** campi assenti+dichiarati per il platform, presenti per l'HR, e ciò che resta resta. */
async function prova(url: string, campi: string[], restano: string[]): Promise<void> {
  const p = await getAs(platform, url);
  const h = await getAs(hrMandate, url);
  expect(h.items.length, `${url}: l'HR non vede righe — prova cieca`).toBeGreaterThan(0);
  expect(p.items.length, `${url}: il platform non vede righe — la RIGA deve restare`).toBeGreaterThan(0);
  for (const row of p.items) {
    expect(row.masked, `${url}: masked mancante o incompleto`).toEqual([...campi].sort());
    for (const f of campi) {
      expect(Object.hasOwn(row, f), `${url}: ${f} dev'essere ASSENTE`).toBe(false);
    }
    for (const f of restano) {
      expect(Object.hasOwn(row, f), `${url}: ${f} deve RESTARE (I20: lo stato resta visibile)`).toBe(true);
    }
  }
  for (const row of h.items) {
    expect(row.masked, `${url}: il mandato HR legge in chiaro (I20)`).toBeUndefined();
  }
}

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(PLATFORM_EMAIL);
  hrMandate = await login(HR_MANDATE_EMAIL);

  const g = await pool.query<{ id: string }>(
    `SELECT goal_id AS id FROM sys.sys_goals WHERE goal_subject_user_id IS NOT NULL LIMIT 1`);
  goalId = g.rows[0]?.id ?? "";
  const gc = await pool.query<{ id: string }>(
    `SELECT check_in_goal_id AS id FROM sys.sys_goal_check_ins LIMIT 1`);
  goalConCheckIn = gc.rows[0]?.id ?? "";
  const gk = await pool.query<{ id: string }>(
    `SELECT comment_goal_id AS id FROM sys.sys_goal_comments LIMIT 1`);
  goalConCommento = gk.rows[0]?.id ?? "";

  // ── L'OKR che i dati non hanno. Vive solo dentro la transazione del file.
  const u = await pool.query<{ id: string; tid: string }>(
    `SELECT user_id AS id, user_tenant_id AS tid FROM sys.sys_users u
      JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
     WHERE t.tenant_code = 'RTL_BANK' LIMIT 1`);
  personaRtl = u.rows[0]?.id ?? "";
  tenantRtl = u.rows[0]?.tid ?? "";
  if (personaRtl) {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_okrs (okr_tenant_id, okr_owner_user_id, okr_natural_key, okr_objective,
                                 okr_okr_type, okr_period_type, okr_period_start, okr_period_end,
                                 okr_status, okr_overall_progress, okr_confidence_level)
       VALUES ($1, $2, 'PROVA-MASK-S1054', 'Obiettivo di prova per il mask', 'INDIVIDUAL',
               'QUARTERLY', current_date, current_date + 90, 'ACTIVE', 42, 3)
       RETURNING okr_id AS id`, [tenantRtl, personaRtl]);
    okrSintetico = ins.rows[0]?.id ?? "";
    await pool.query(
      `INSERT INTO sys.sys_okr_key_results (key_result_tenant_id, key_result_okr_id, key_result_owner_user_id,
              key_result_natural_key, key_result_description, key_result_metric_type,
              key_result_start_value, key_result_target_value, key_result_current_value,
              key_result_progress_percent, key_result_status, key_result_weight, key_result_confidence_level)
       VALUES ($1, $2, $3, 'PROVA-KR-S1054', 'Risultato chiave di prova', 'NUMBER',
               0, 100, 37, 37, 'ON_TRACK', 1, 4)`, [tenantRtl, okrSintetico, personaRtl]);
  }
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#124 D4 — goals: via il QUANTO, gli stati restano (I20)", () => {
  it("gira su un universo dove PUÒ fallire", () => {
    expect(goalId, "nessun obiettivo con soggetto").toBeTruthy();
    expect(goalConCheckIn, "nessun check-in").toBeTruthy();
    expect(goalConCommento, "nessun commento").toBeTruthy();
  });

  it("lista obiettivi: via l'avanzamento, restano titolo, scadenza e STATO", async () => {
    await prova("/v1/goals?limit=100", ["progressPercent"],
      ["status", "title", "dueDate", "priority", "subjectUserId"]);
  });

  it("check-in: via progresso, note, blocchi, prossimi passi e la sicurezza di farcela", async () => {
    await prova(`/v1/goals/${goalConCheckIn}/check-ins?limit=50`,
      ["previousProgress", "newProgress", "notes", "blockers", "nextSteps", "confidenceLevel"],
      ["statusUpdate", "date", "subjectUserId"]);
  });

  it("commenti: via il testo, resta che il commento esiste e chi l'ha scritto", async () => {
    await prova(`/v1/goals/${goalConCommento}/comments?limit=50`,
      ["content"], ["authorUserId", "createdAt", "isPrivate"]);
  });

  it("le milestone NON si mascherano: sono la definizione del lavoro", async () => {
    const p = await getAs(platform, `/v1/goals/${goalId}/milestones?limit=50`);
    for (const row of p.items) {
      expect(row.masked, "una milestone non porta giudizio: titolo, data e peso sono struttura").toBeUndefined();
    }
  });
});

describe("#124 D4 — okrs: la condizione va costruita, i dati non ce l'hanno", () => {
  it("il reperto che rende necessaria la costruzione", async () => {
    const r = await pool.query<{ n: string }>(
      `SELECT count(*) FILTER (WHERE okr_owner_user_id IS NOT NULL)::text AS n
         FROM sys.sys_okrs WHERE okr_natural_key <> 'PROVA-MASK-S1054'`);
    expect(Number(r.rows[0]!.n), "se i dati reali avessero proprietari, questa costruzione sarebbe superflua").toBe(0);
    expect(okrSintetico, "OKR di prova non creato: la prova sarebbe cieca").toBeTruthy();
  });

  it("OKR con proprietario: via avanzamento e confidenza, restano obiettivo, periodo e STATO", async () => {
    const p = await getAs(platform, `/v1/okrs/${okrSintetico}`);
    const riga = p.body as Riga;
    expect(riga.masked).toEqual(["confidenceLevel", "overallProgress"]);
    expect(Object.hasOwn(riga, "overallProgress"), "l'avanzamento dev'essere ASSENTE").toBe(false);
    expect(Object.hasOwn(riga, "status"), "lo STATO resta (I20)").toBe(true);
    expect(Object.hasOwn(riga, "objective"), "l'obiettivo dichiarato resta").toBe(true);
    // La CHIAVE, non il valore: «42» compare per caso dentro un UUID, e cercarlo
    // darebbe un rosso che non è una fuga (stesso errore già fatto con
    // `"derivation"`, che compariva dentro l'elenco `masked`).
    expect(p.raw.includes('"overallProgress":'), "l'avanzamento è nel corpo del platform").toBe(false);

    const h = await getAs(hrMandate, `/v1/okrs/${okrSintetico}`);
    expect((h.body as Riga).masked, "il mandato HR legge in chiaro").toBeUndefined();
    expect(h.raw.includes('"overallProgress":42'), "l'HR non vede il valore vero — controprova cieca").toBe(true);
  });

  it("risultato chiave: `target` resta (è la definizione), `current` no (è dove sei arrivato)", async () => {
    const p = await getAs(platform, `/v1/okrs/${okrSintetico}/key-results`);
    expect(p.items.length, "nessun risultato chiave").toBeGreaterThan(0);
    for (const row of p.items) {
      expect(row.masked).toEqual(["confidenceLevel", "currentValue", "progressPercent"]);
      expect(Object.hasOwn(row, "targetValue"), "il TARGET resta: è cosa ci si aspettava").toBe(true);
      expect(Object.hasOwn(row, "startValue"), "il punto di partenza resta").toBe(true);
      expect(Object.hasOwn(row, "currentValue"), "il valore raggiunto dev'essere ASSENTE").toBe(false);
      expect(Object.hasOwn(row, "status"), "lo STATO resta (I20)").toBe(true);
    }
    const h = await getAs(hrMandate, `/v1/okrs/${okrSintetico}/key-results`);
    expect(h.items[0]?.masked, "il mandato HR legge in chiaro").toBeUndefined();
    expect(h.items[0]?.["currentValue"], "l'HR vede il valore raggiunto").toBe(37);
  });
});
