/**
 * apps/api/test/evidence-mask.integration.test.ts
 *
 * #124 D4 (S1054) — il mask di ADR-0032 su `evidence`, che ha due superfici e
 * una trappola.
 *
 * Le due superfici: `/v1/evidence/subject/:userId` (le evidenze su una persona)
 * e `/v1/evidence/for-score` (il «perche' questo punteggio»).
 *
 * La trappola e' la seconda. Mascherare la TESTATA del punteggio e lasciare le
 * evidenze che lo spiegano sarebbe il difetto di `insights` in un'altra forma:
 * la spiegazione consegnata al posto del numero. Per questo il test asserisce il
 * mask su ENTRAMBI i piani della stessa risposta.
 *
 * Il confine dei campi, verificato su come il repository costruisce le righe:
 * `title` RESTA (dimensione, competenza, nome del KPI: dice su COSA si valuta),
 * `narrative` se ne va (commenti del responsabile, messaggi di feedback, punti
 * di forza di un 360: il giudizio in lettere).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org";
const MASKED = ["narrative", "payload", "score"];

interface Session { cookies: Map<string, string> }
function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let t: TestApp;
let platform: Session;
let hrMandate: Session;
/** Un soggetto RTL con evidenze, diverso dal platform-admin (I17 non deve interferire). */
let soggetto = "";

async function login(email: string): Promise<Session> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

interface Riga { masked?: string[]; [k: string]: unknown }

async function getAs(s: Session, url: string): Promise<{ raw: string; body: Record<string, unknown> }> {
  const res = await t.app.inject({ method: "GET", url, headers: { cookie: cookieHeader(s.cookies) } });
  expect(res.statusCode, `${url}: ${res.body.slice(0, 200)}`).toBe(200);
  return { raw: res.body, body: res.json() as Record<string, unknown> };
}

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(PLATFORM_EMAIL);
  hrMandate = await login(HR_MANDATE_EMAIL);
  // Misurato S1054: `narrative` e' NULL su tutte le 1560 righe (e su skill/learning),
  // mentre `score` e' popolato ovunque con 4 valori distinti. Per questo il soggetto
  // si sceglie sul volume di evidenze, e le asserzioni sul corpo grezzo cercano la
  // CHIAVE `"narrative":` / `"score":` e non un valore: su un campo vuoto ovunque,
  // «il valore non compare» sarebbe vero per costruzione — una prova cieca.
  const r = await pool.query<{ id: string }>(
    `SELECT user_assessment_evidence_user_id AS id
       FROM sys.sys_user_assessment_evidence e
       JOIN sys.sys_users u ON u.user_id = e.user_assessment_evidence_user_id
      WHERE u.user_email <> $1
      GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`, [PLATFORM_EMAIL]);
  soggetto = r.rows[0]?.id ?? "";
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#124 D4 — le evidenze sono mascherate al solo mandato piattaforma", () => {
  it("gira su un universo dove PUÒ fallire", () => {
    expect(soggetto, "nessun soggetto con evidenze: la prova sarebbe cieca").toBeTruthy();
  });

  it("evidenze per soggetto: via punteggio, testo e payload; resta di COSA si tratta", async () => {
    const url = `/v1/evidence/subject/${soggetto}?limit=100`;
    const p = await getAs(platform, url);
    const h = await getAs(hrMandate, url);

    const pItems = (p.body["items"] ?? []) as Riga[];
    const hItems = (h.body["items"] ?? []) as Riga[];
    expect(hItems.length, "l'HR non vede evidenze — universo vuoto, prova cieca").toBeGreaterThan(0);
    expect(pItems.length, "il platform non vede evidenze — ADR-0032 vuole la RIGA visibile").toBeGreaterThan(0);

    for (const row of pItems) {
      expect(row.masked, "masked mancante o incompleto").toEqual(MASKED);
      for (const f of MASKED) {
        expect(Object.hasOwn(row, f), `${f} dev'essere ASSENTE per il platform`).toBe(false);
      }
      expect(Object.hasOwn(row, "title"), "«title» RESTA: dice su cosa si è valutato").toBe(true);
      expect(Object.hasOwn(row, "kind"), "il tipo di evidenza RESTA").toBe(true);
      expect(Object.hasOwn(row, "provenance"), "il lineage RESTA: è l'oggetto del mandato tecnico").toBe(true);
    }
    for (const row of hItems) {
      expect(row.masked, "il mandato HR non va mascherato (I20)").toBeUndefined();
    }
    // Le CHIAVI, non i valori: `narrative` è vuoto ovunque, quindi cercare un
    // valore sarebbe vero per costruzione. `score` invece è popolato su tutte le
    // righe, e la sua chiave deve sparire per il platform e restare per l'HR.
    for (const chiave of ['"narrative":', '"score":', '"payload":']) {
      expect(p.raw.includes(chiave), `${chiave} nel corpo del platform`).toBe(false);
      expect(h.raw.includes(chiave), `${chiave} assente per l'HR — controprova cieca`).toBe(true);
    }
  });

  it("«perché questo punteggio»: si mascherano ENTRAMBI i piani, o la spiegazione sostituisce il numero", async () => {
    // Serve un punteggio reale del soggetto: si parte dalla lista flight-risk.
    const lista = await getAs(hrMandate, "/v1/insights/flight-risk");
    const items = (lista.body["items"] ?? []) as { userId: string }[];
    const conPunteggio = items.find((r) => r.userId !== undefined);
    expect(conPunteggio, "nessun punteggio da spiegare").toBeTruthy();

    const url = `/v1/evidence/for-score?scoreType=FLIGHT_RISK_SCORE&scoreId=${
      (await pool.query<{ id: string }>(
        `SELECT flight_risk_score_id AS id FROM sys.sys_flight_risk_scores
          WHERE flight_risk_score_user_id = $1 LIMIT 1`, [conPunteggio!.userId])).rows[0]?.id
    }`;

    const p = await getAs(platform, url);
    const h = await getAs(hrMandate, url);

    const pScore = p.body["score"] as Riga;
    const hScore = h.body["score"] as Riga;
    expect(pScore.masked, "la testata del punteggio non è mascherata").toEqual(["band", "derivation", "value"]);
    for (const f of ["value", "band", "derivation"]) {
      expect(Object.hasOwn(pScore, f), `${f} dev'essere ASSENTE nella testata`).toBe(false);
    }
    expect(Object.hasOwn(pScore, "subjectUserId"), "il soggetto RESTA").toBe(true);
    expect(hScore.masked, "il mandato HR legge la testata in chiaro").toBeUndefined();

    // Il piano che si dimentica: le evidenze che SPIEGANO il punteggio.
    for (const row of (p.body["items"] ?? []) as Riga[]) {
      expect(row.masked, "le evidenze che spiegano il punteggio non sono mascherate").toEqual(MASKED);
    }
    // La CHIAVE con i due punti: `"derivation"` da solo compare anche dentro
    // l'elenco `masked`, e cercarlo così darebbe un rosso che non è una fuga.
    expect(p.raw.includes('"derivation":'), "la derivazione è passata").toBe(false);
    expect(h.raw.includes('"derivation":'), "l'HR non vede la derivazione — controprova cieca").toBe(true);
  });
});
