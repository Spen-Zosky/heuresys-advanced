/**
 * apps/api/test/talent-review-mask.integration.test.ts
 *
 * #124 D4 (S1054) — il mask di ADR-0032 sulle quattro famiglie person-level di
 * `talent-review`: 9-box, position-fit, readiness, succession.
 *
 * Universo misurato prima di scrivere: 154 talent_scores, 146 fit_scores,
 * 89 readiness_scores, 89 succession_scores.
 *
 * Il caso piu' istruttivo e' il 9-box: `potentialBand` e `performanceBand` sono
 * DERIVATE da `potential` e `performance`. Mascherare i due numeri lasciando le
 * due bande pubblicherebbe la casella della griglia — cioe' la conclusione —
 * dopo aver tolto gli addendi. Per questo il test asserisce che spariscano
 * tutti e cinque i campi, e cerca i nomi delle bande nel BODY GREZZO.
 *
 * Cio' che deve RESTARE e' altrettanto vincolante: la riga, il soggetto, la
 * posizione, la dimensione, l'orizzonte e la data. ADR-0032 non nasconde che una
 * valutazione esista: nasconde quanto vale.
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
let bandNames: string[] = [];

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

/**
 * Per un endpoint person-level: campi assenti + dichiarati per il platform,
 * presenti per l'HR, e ciò che deve restare resta davvero.
 */
async function provaFamiglia(
  url: string,
  maskedFields: string[],
  keptFields: string[],
): Promise<{ platformRaw: string; hrRaw: string }> {
  const p = await listAs(platform, url);
  const h = await listAs(hrMandate, url);

  expect(h.items.length, `${url}: l'HR non vede righe — universo vuoto, prova cieca`).toBeGreaterThan(0);
  expect(p.items.length, `${url}: il platform non vede righe — ADR-0032 vuole la RIGA visibile`).toBeGreaterThan(0);

  for (const row of p.items) {
    expect(row["masked"], `${url}: masked mancante o incompleto sul platform`).toEqual([...maskedFields].sort());
    for (const f of maskedFields) {
      expect(Object.hasOwn(row, f), `${url}: ${f} dev'essere ASSENTE per il platform`).toBe(false);
    }
    for (const f of keptFields) {
      expect(Object.hasOwn(row, f), `${url}: ${f} deve RESTARE (la riga resta, il verdetto no)`).toBe(true);
    }
  }
  for (const row of h.items) {
    expect(row["masked"], `${url}: il mandato HR non va mascherato (I20)`).toBeUndefined();
    expect(Object.hasOwn(row, maskedFields[0]!), `${url}: l'HR deve vedere il giudizio`).toBe(true);
  }
  return { platformRaw: p.raw, hrRaw: h.raw };
}

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(PLATFORM_EMAIL);
  hrMandate = await login(HR_MANDATE_EMAIL);
  const r = await pool.query<{ v: string }>(
    `SELECT DISTINCT talent_score_band AS v FROM sys.sys_talent_scores WHERE talent_score_band IS NOT NULL`);
  bandNames = r.rows.map((x) => x.v);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#124 D4 — talent-review è mascherato al solo mandato piattaforma", () => {
  it("gira su un universo dove PUÒ fallire", () => {
    expect(bandNames.length, "nessuna banda nel 9-box: la prova sarebbe cieca").toBeGreaterThan(0);
  });

  it("9-box: spariscono i punteggi E le bande che ne derivano", async () => {
    const { platformRaw, hrRaw } = await provaFamiglia(
      "/v1/talent-review/nine-box?limit=200",
      ["band", "performance", "performanceBand", "potential", "potentialBand"],
      ["userId", "subjectUserName", "computedAt"],
    );
    // La fuga da cui nasce questo test: le bande sono la conclusione dei punteggi.
    const trapelate = bandNames.filter((b) => platformRaw.includes(`"${b}"`));
    expect(trapelate, "nomi di banda nel body del platform: la casella del 9-box è deducibile").toEqual([]);
    expect(bandNames.some((b) => hrRaw.includes(`"${b}"`)),
      "l'HR non vede nessuna banda — confronto senza significato").toBe(true);
  });

  it("position-fit: via il punteggio e il payload, resta la dimensione valutata", async () => {
    await provaFamiglia(
      "/v1/talent-review/fit?limit=200",
      ["payload", "score"],
      ["userId", "positionId", "dimension", "computedAt"],
    );
  });

  it("readiness: via il valore, resta l'orizzonte", async () => {
    await provaFamiglia(
      "/v1/talent-review/readiness?limit=200",
      ["payload", "value"],
      ["userId", "positionId", "horizon", "computedAt"],
    );
  });

  it("succession: via il valore, resta la posizione a cui si riferisce", async () => {
    await provaFamiglia(
      "/v1/talent-review/succession?limit=200",
      ["payload", "value"],
      ["userId", "positionId", "computedAt"],
    );
  });

  it("posizioni critiche e copertura sono per POSIZIONE, non per persona: non si mascherano", async () => {
    // Il criterio che regge D4: si maschera ciò che giudica una persona. Una
    // posizione critica giudica un RUOLO, e la copertura conta candidati senza
    // nominarli — mascherarle toglierebbe la vista di rischio organizzativo
    // senza proteggere nessuno.
    for (const url of ["/v1/talent-review/critical-positions?limit=50",
                       "/v1/talent-review/critical-coverage?limit=50"]) {
      const p = await listAs(platform, url);
      for (const row of p.items) {
        expect(row["masked"], `${url}: non ha un soggetto persona, mascherarlo sarebbe un errore`).toBeUndefined();
      }
    }
  });
});
