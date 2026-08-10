/**
 * apps/api/test/predictions-mask.integration.test.ts
 *
 * #124 D4 (S1054) — il mask di ADR-0032 copre la classe EVALUATION anche su
 * `predictions`, che e' la superficie dove il giudizio e' piu' esplicito:
 * un punteggio di rischio per persona, con la sua spiegazione.
 *
 * Misurato PRIMA di scrivere (468 righe / 156 soggetti, 0 senza soggetto):
 *  - `prediction_details` porta `is_high_potential`, `risk_factors`,
 *    `improvement_suggestions`, `recommended_actions` e un `feature_importance`
 *    che contiene `performance_rating` e **`salary_percentile`**: la spiegazione
 *    e' piu' rivelatrice del punteggio, e sconfina in COMPENSATION;
 *  - `prediction_metadata` porta INVECE solo lineage di ingestione
 *    (`source_table`, `legacy_employee_id`, `legacy_prediction_id`,
 *    `legacy_model_id`, `unresolved_model`) — resta visibile, ed e' l'oggetto
 *    stesso del mandato tecnico che ADR-0032 vuole preservare;
 *  - `prediction_natural_key` e' `LEGACY_MPRED::<uuid>` su tutte le righe:
 *    verificato che non porti il giudizio dentro di se'.
 *
 * La prova cerca i valori veri nel BODY GREZZO, non nei campi tipizzati: e' il
 * solo modo di accorgersi di una fuga che passa da una chiave che non stiamo
 * guardando.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org";

const MASKED = ["confidence", "details", "label", "value"];

interface Session { cookies: Map<string, string> }

function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let t: TestApp;
let platform: Session;
let hrMandate: Session;
/** Valori veri, nella forma che il filo trasporta. */
let trueValues: string[] = [];
let trueLabels: string[] = [];

async function login(email: string): Promise<Session> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

async function listAs(s: Session, url: string): Promise<{ raw: string; items: Record<string, unknown>[] }> {
  const res = await t.app.inject({ method: "GET", url, headers: { cookie: cookieHeader(s.cookies) } });
  expect(res.statusCode, `${url}: ${res.body.slice(0, 200)}`).toBe(200);
  const j = res.json() as { items?: Record<string, unknown>[] };
  return { raw: res.body, items: j.items ?? [] };
}

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(PLATFORM_EMAIL);
  hrMandate = await login(HR_MANDATE_EMAIL);
  // String(Number(...)): il DB stampa "0.5420", il JSON serializza 0.542 — il
  // confronto sul body grezzo va fatto nella forma che il filo trasporta.
  const r1 = await pool.query<{ v: string }>(
    `SELECT DISTINCT prediction_value::text AS v FROM sys.sys_model_predictions
      WHERE prediction_value IS NOT NULL LIMIT 20`);
  trueValues = r1.rows.map((r) => String(Number(r.v)));
  const r2 = await pool.query<{ v: string }>(
    `SELECT DISTINCT prediction_label AS v FROM sys.sys_model_predictions
      WHERE prediction_label IS NOT NULL LIMIT 20`);
  trueLabels = r2.rows.map((r) => r.v);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#124 D4 — le predizioni sono mascherate al solo mandato piattaforma", () => {
  it("gira su un universo dove PUÒ fallire", () => {
    expect(trueValues.length, "nessuna predizione con valore: la prova sarebbe cieca").toBeGreaterThan(0);
    expect(trueLabels.length, "nessuna predizione con etichetta").toBeGreaterThan(0);
  });

  it("lista: il verdetto e la spiegazione spariscono, il soggetto e il lineage restano", async () => {
    const p = await listAs(platform, "/v1/predictions?limit=200");
    const h = await listAs(hrMandate, "/v1/predictions?limit=200");

    expect(h.items.length, "l'HR non vede righe — universo vuoto, prova cieca").toBeGreaterThan(0);
    expect(p.items.length, "il platform non vede righe — ADR-0032 vuole la RIGA visibile").toBeGreaterThan(0);

    for (const row of p.items) {
      expect(row["masked"], "masked mancante o incompleto sul platform").toEqual(MASKED);
      for (const f of MASKED) {
        expect(Object.hasOwn(row, f), `${f} dev'essere ASSENTE per il platform`).toBe(false);
      }
      // Cio' che il mandato tecnico conserva: su chi, di che tipo, da quale importazione.
      expect(Object.hasOwn(row, "subjectUserId"), "il soggetto resta").toBe(true);
      expect(Object.hasOwn(row, "type"), "il tipo resta").toBe(true);
      expect(Object.hasOwn(row, "metadata"), "il lineage di ingestione resta").toBe(true);
    }
    for (const row of h.items) {
      expect(row["masked"], "il mandato HR non va mascherato (I20)").toBeUndefined();
      expect(Object.hasOwn(row, "value"), "l'HR deve vedere il valore").toBe(true);
    }

    // Il body grezzo: niente valori, niente etichette, niente chiavi della spiegazione.
    expect(trueValues.filter((v) => p.raw.includes(v)),
      "valori veri nel body del platform").toEqual([]);
    expect(trueLabels.filter((v) => p.raw.includes(v)),
      "etichette vere nel body del platform").toEqual([]);
    for (const chiave of ["salary_percentile", "performance_rating", "is_high_potential", "risk_factors"]) {
      expect(p.raw.includes(chiave), `«${chiave}» nel body del platform: details non e' stato tolto`).toBe(false);
    }

    // Controprova: se l'HR non vedesse nulla di vero, il confronto sopra non direbbe niente.
    expect(trueValues.some((v) => h.raw.includes(v)),
      "l'HR non vede nessun valore vero — confronto senza significato").toBe(true);
    expect(h.raw.includes("salary_percentile") || h.raw.includes("feature_importance"),
      "l'HR non vede la spiegazione — confronto senza significato").toBe(true);
  });

  it("per-id: la stessa riga letta da due attori", async () => {
    const h = await listAs(hrMandate, "/v1/predictions?limit=1");
    const id = h.items[0]?.["predictionId"] as string;
    expect(id, "nessuna predizione da leggere").toBeTruthy();

    const pr = await t.app.inject({
      method: "GET", url: `/v1/predictions/${id}`,
      headers: { cookie: cookieHeader(platform.cookies) },
    });
    expect(pr.statusCode, pr.body.slice(0, 200)).toBe(200);
    const prow = pr.json() as Record<string, unknown>;
    expect(prow["masked"]).toEqual(MASKED);
    for (const f of MASKED) {
      expect(Object.hasOwn(prow, f), `${f} dev'essere ASSENTE per il platform`).toBe(false);
    }
    expect(Object.hasOwn(prow, "subjectUserId"), "il soggetto resta").toBe(true);

    const hr = await t.app.inject({
      method: "GET", url: `/v1/predictions/${id}`,
      headers: { cookie: cookieHeader(hrMandate.cookies) },
    });
    expect(hr.statusCode).toBe(200);
    const hrow = hr.json() as Record<string, unknown>;
    expect(hrow["masked"], "il mandato HR legge in chiaro").toBeUndefined();
    expect(Object.hasOwn(hrow, "value"), "l'HR deve vedere il valore").toBe(true);
  });

  it("i modelli predittivi sono un CATALOGO: non si mascherano", async () => {
    // La distinzione che regge tutto D4: si maschera cio' che giudica una
    // persona, non cio' che descrive una struttura. Un modello non ha soggetto.
    const p = await listAs(platform, "/v1/predictions/models?limit=50");
    expect(p.items.length, "nessun modello: la prova sarebbe cieca").toBeGreaterThan(0);
    for (const row of p.items) {
      expect(row["masked"], "un modello non ha soggetto: mascherarlo sarebbe un errore").toBeUndefined();
    }
  });
});
