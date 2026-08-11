/**
 * apps/api/test/insights-mask.integration.test.ts
 *
 * #124 D4 (S1054) — il mask di ADR-0032 sui tre modelli di `insights`:
 * flight-risk, succession-readiness, skill-gap.
 *
 * Qui la spiegazione e' piu' pericolosa del punteggio, per due ragioni misurate:
 *  1. i modelli sono DETERMINISTICI e i pesi sono pubblici (`service.ts`), quindi
 *     da `features` il punteggio si RICALCOLA esattamente;
 *  2. `features[].raw` porta i valori grezzi dei fattori — fra cui
 *     `kpiAchievement`, `engagementAvg` e **`compBandPct`**, il percentile della
 *     banda retributiva: la spiegazione di un punteggio EVALUATION farebbe
 *     passare dati COMPENSATION.
 *
 * E c'e' un terzo canale, che un test sui soli campi non vedrebbe mai:
 * **l'ORDINE**. Le tre liste tornano ordinate per punteggio decrescente. Togliere
 * il punteggio e consegnare la stessa sequenza lascerebbe in mano al lettore la
 * graduatoria completa delle persone — in molti usi piu' rivelatrice del numero
 * tolto. E' la «order-preserving truncation» che il vincolo 4 di
 * `lib/scope/mask.ts` vieta. Per questo il test asserisce l'ordine, non solo i
 * campi.
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
/** L'id del platform-admin: serve per isolare le righe che I17 gli lascia in chiaro. */
let platformUserId = "";

async function login(email: string): Promise<Session> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

interface Riga { userId: string; masked?: string[]; [k: string]: unknown }

async function listAs(s: Session, url: string): Promise<{ raw: string; items: Riga[] }> {
  const res = await t.app.inject({ method: "GET", url, headers: { cookie: cookieHeader(s.cookies) } });
  expect(res.statusCode, `${url}: ${res.body.slice(0, 200)}`).toBe(200);
  const j = res.json() as { items?: Riga[] };
  return { raw: res.body, items: j.items ?? [] };
}

async function provaModello(
  url: string,
  campi: string[],
  valore: string,
): Promise<void> {
  const p = await listAs(platform, url);
  const h = await listAs(hrMandate, url);

  expect(h.items.length, `${url}: l'HR non vede righe — universo vuoto, prova cieca`).toBeGreaterThan(1);
  expect(p.items.length, `${url}: il platform non vede righe — ADR-0032 vuole la RIGA visibile`).toBeGreaterThan(1);

  // I17 — il pavimento ESS batte ogni asse: le righe SUE il platform-admin le
  // legge in chiaro, e non e' un'eccezione da tollerare ma una proprieta' da
  // provare. (Scoperta scrivendo questo test: enzo.spenuso ha un proprio
  // punteggio di rischio, e la prima stesura pretendeva il mask anche su quello.)
  const proprie = p.items.filter((r) => r.userId === platformUserId);
  const altrui = p.items.filter((r) => r.userId !== platformUserId);
  expect(altrui.length, `${url}: nessuna riga altrui — la prova sarebbe cieca`).toBeGreaterThan(0);
  for (const row of proprie) {
    expect(row.masked, `${url}: I17 — la propria riga non si maschera`).toBeUndefined();
    expect(Object.hasOwn(row, valore), `${url}: I17 — il proprio punteggio si vede`).toBe(true);
  }

  for (const row of altrui) {
    expect(row.masked, `${url}: masked mancante o incompleto`).toEqual([...campi].sort());
    for (const f of campi) {
      expect(Object.hasOwn(row, f), `${url}: ${f} dev'essere ASSENTE per il platform`).toBe(false);
    }
    expect(Object.hasOwn(row, "displayName"), `${url}: il nome della persona RESTA`).toBe(true);
    expect(Object.hasOwn(row, "modelVersion"), `${url}: la versione del modello RESTA`).toBe(true);
  }
  for (const row of h.items) {
    expect(row.masked, `${url}: il mandato HR non va mascherato (I20)`).toBeUndefined();
    expect(Object.hasOwn(row, valore), `${url}: l'HR deve vedere il punteggio`).toBe(true);
  }

  // La spiegazione, che è il canale peggiore. Nel corpo del platform puo'
  // comparire SOLO nelle sue righe (I17): il conteggio lo verifica invece di
  // accontentarsi di «non c'e'», che con zero righe proprie passerebbe per caso.
  const occorrenzeFeatures = (p.raw.match(/"features":/g) ?? []).length;
  expect(occorrenzeFeatures,
    `${url}: la spiegazione compare ${occorrenzeFeatures} volte, ma solo ${proprie.length} righe sono sue`,
  ).toBe(proprie.length);
  expect(h.raw.includes('"features"'), `${url}: l'HR non vede la spiegazione — controprova cieca`).toBe(true);

  // L'ORDINE: neutralizzato per chi è mascherato, vero per chi legge in chiaro.
  const idsPlatform = p.items.map((r) => r.userId);
  const ordinati = [...idsPlatform].sort((a, b) => a.localeCompare(b));
  expect(idsPlatform, `${url}: l'ordine per punteggio è sopravvissuto al mask — è la graduatoria`).toEqual(ordinati);

  const valoriHr = h.items.map((r) => Number(r[valore] ?? 0));
  const decrescente = valoriHr.every((v, i) => i === 0 || valoriHr[i - 1]! >= v);
  expect(decrescente, `${url}: l'HR ha perso la classifica vera — il mask ha danneggiato chi legge in chiaro`).toBe(true);
}

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(PLATFORM_EMAIL);
  hrMandate = await login(HR_MANDATE_EMAIL);
  const r = await pool.query<{ id: string }>(
    `SELECT user_id AS id FROM sys.sys_users WHERE lower(user_email) = lower($1)`, [PLATFORM_EMAIL]);
  platformUserId = r.rows[0]?.id ?? "";
  expect(platformUserId, "id del platform-admin non risolto: la separazione I17 sarebbe cieca").toBeTruthy();
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#124 D4 — gli insight sono mascherati al solo mandato piattaforma", () => {
  it("flight-risk: via punteggio, banda e spiegazione; via anche l'ORDINE", async () => {
    await provaModello("/v1/insights/flight-risk", ["band", "features", "score"], "score");
  });

  it("succession-readiness: via valore, orizzonte e spiegazione", async () => {
    await provaModello("/v1/insights/succession-readiness", ["features", "horizon", "value"], "value");
  });

  it("skill-gap: via valore, segmento e spiegazione", async () => {
    await provaModello("/v1/insights/skill-gap", ["features", "segment", "value"], "value");
  });

  it("flight-risk per-persona: la stessa riga letta dai due attori", async () => {
    const h = await listAs(hrMandate, "/v1/insights/flight-risk");
    // Una riga ALTRUI: sulla propria I17 vince, ed è provato nel test della lista.
    const userId = h.items.find((r) => r.userId !== platformUserId)?.userId;
    expect(userId, "nessun punteggio altrui da leggere").toBeTruthy();

    const pr = await t.app.inject({
      method: "GET", url: `/v1/insights/users/${userId}/flight-risk`,
      headers: { cookie: cookieHeader(platform.cookies) },
    });
    expect(pr.statusCode, pr.body.slice(0, 200)).toBe(200);
    const prow = pr.json() as Riga;
    expect(prow.masked).toEqual(["band", "features", "score"]);
    expect(Object.hasOwn(prow, "displayName"), "il nome della persona RESTA").toBe(true);
    expect(pr.body.includes('"raw"'), "la spiegazione è passata sul per-persona").toBe(false);

    const hr = await t.app.inject({
      method: "GET", url: `/v1/insights/users/${userId}/flight-risk`,
      headers: { cookie: cookieHeader(hrMandate.cookies) },
    });
    expect(hr.statusCode).toBe(200);
    const hrow = hr.json() as Riga;
    expect(hrow.masked, "il mandato HR legge in chiaro").toBeUndefined();
    expect(Object.hasOwn(hrow, "score"), "l'HR deve vedere il punteggio").toBe(true);
  });
});
