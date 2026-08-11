/**
 * apps/api/test/successor-mask.integration.test.ts
 *
 * #124 D4 (S1054) — gli ultimi due moduli della classe EVALUATION:
 * `successor-candidates` e `successor-readiness`.
 *
 * E' qui che il **vincolo 5** di `lib/scope/mask.ts` morde per la prima volta:
 * «gli aggregati seguono il dato — nascondere i valori individuali e pubblicare
 * la media di un'unita' di tre persone e' una fuga aritmetica».
 *
 * Misura S1054: 20 candidati distribuiti su 4 livelli (6 · 6 · 5 · 3). Le RIGHE
 * restano visibili al mandato piattaforma — e' il senso di ADR-0032 — quindi
 * pubblicare ANCHE i conteggi per livello direbbe che esattamente 3 di quelle 20
 * persone sono pronte fra sei mesi. L'endpoint di distribuzione sopprime percio'
 * gli `items` e **dichiara** la soppressione: una lista vuota e basta si
 * leggerebbe come «non ci sono candidati», che e' una bugia diversa ma pur
 * sempre una bugia.
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
let livelliVeri: string[] = [];

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

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(PLATFORM_EMAIL);
  hrMandate = await login(HR_MANDATE_EMAIL);
  const r = await pool.query<{ l: string }>(
    `SELECT DISTINCT successor_candidate_readiness_level AS l FROM sys.sys_successor_candidates
      WHERE successor_candidate_readiness_level IS NOT NULL`);
  livelliVeri = r.rows.map((x) => x.l);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#124 D4 — successori: il giudizio di prontezza sparisce, la candidatura resta", () => {
  it("gira su un universo dove PUÒ fallire", () => {
    expect(livelliVeri.length, "nessun livello di prontezza: la prova sarebbe cieca").toBeGreaterThan(1);
  });

  it("candidati: via `readinessLevel`, restano persona, pool e STATO della candidatura", async () => {
    const p = await getAs(platform, "/v1/successor-candidates?limit=200");
    const h = await getAs(hrMandate, "/v1/successor-candidates?limit=200");
    expect(h.items.length, "l'HR non vede candidati — prova cieca").toBeGreaterThan(0);
    expect(p.items.length, "il platform non vede candidati — la RIGA deve restare").toBeGreaterThan(0);

    for (const row of p.items) {
      expect(row.masked, "masked mancante").toEqual(["readinessLevel"]);
      expect(Object.hasOwn(row, "readinessLevel"), "il livello dev'essere ASSENTE").toBe(false);
      expect(Object.hasOwn(row, "status"), "lo STATO della candidatura resta (I20)").toBe(true);
      expect(Object.hasOwn(row, "userName"), "la persona resta").toBe(true);
      expect(Object.hasOwn(row, "poolName"), "il pool resta").toBe(true);
    }
    for (const row of h.items) {
      expect(row.masked, "il mandato HR legge in chiaro (I20)").toBeUndefined();
    }
    // Nessun nome di livello nel corpo del platform, in nessuna forma.
    const trapelati = livelliVeri.filter((l) => p.raw.includes(`"${l}"`));
    expect(trapelati, "livelli di prontezza nel corpo del platform").toEqual([]);
    expect(livelliVeri.some((l) => h.raw.includes(`"${l}"`)),
      "l'HR non vede nessun livello — controprova cieca").toBe(true);
  });

  it("VINCOLO 5 — la distribuzione è un aggregato sulla classe mascherata: soppressa e dichiarata", async () => {
    const p = await getAs(platform, "/v1/successor-candidates/readiness-distribution");
    const h = await getAs(hrMandate, "/v1/successor-candidates/readiness-distribution");

    expect(h.items.length, "l'HR non vede la distribuzione — prova cieca").toBeGreaterThan(0);
    expect(p.items, "gli item devono essere soppressi per il mandato piattaforma").toEqual([]);
    expect((p.body as Riga).masked, "la soppressione dev'essere DICHIARATA, non silenziosa").toEqual(["items"]);
    // `total` resta: è già deducibile dalla lista dei candidati, che resta visibile.
    expect(p.body["total"], "il totale resta (già noto dalla lista)").toBe(h.body["total"]);
    const trapelati = livelliVeri.filter((l) => p.raw.includes(`"${l}"`));
    expect(trapelati, "i livelli sono trapelati dall'aggregato").toEqual([]);
  });

  it("valutazioni di prontezza: via punteggio, orizzonte e spiegazione; resta la data", async () => {
    const p = await getAs(platform, "/v1/successor-readiness?limit=200");
    const h = await getAs(hrMandate, "/v1/successor-readiness?limit=200");
    expect(h.items.length, "l'HR non vede valutazioni — prova cieca").toBeGreaterThan(0);
    expect(p.items.length, "il platform non vede valutazioni — la RIGA deve restare").toBeGreaterThan(0);

    for (const row of p.items) {
      expect(row.masked, "masked mancante o incompleto").toEqual(["horizon", "payload", "score"]);
      for (const f of ["score", "horizon", "payload"]) {
        expect(Object.hasOwn(row, f), `${f} dev'essere ASSENTE`).toBe(false);
      }
      expect(Object.hasOwn(row, "candidateId"), "il candidato di riferimento resta").toBe(true);
      expect(Object.hasOwn(row, "assessedAt"), "la data della valutazione resta").toBe(true);
    }
    for (const row of h.items) {
      expect(row.masked, "il mandato HR legge in chiaro").toBeUndefined();
      expect(Object.hasOwn(row, "score"), "l'HR deve vedere il punteggio").toBe(true);
    }
    expect(p.raw.includes('"score":'), "la chiave del punteggio è nel corpo del platform").toBe(false);
    expect(h.raw.includes('"score":'), "l'HR non vede il punteggio — controprova cieca").toBe(true);
  });
});
