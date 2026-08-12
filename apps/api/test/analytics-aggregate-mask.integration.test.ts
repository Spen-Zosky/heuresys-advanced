/**
 * apps/api/test/analytics-aggregate-mask.integration.test.ts
 *
 * #124 (S1055) — il VINCOLO 5 di ADR-0032 sugli aggregati, sulle due superfici
 * dove morde davvero. Non e' un caso di scuola: un aggregato smette di essere
 * aggregato quando il gruppo su cui media ha una persona sola.
 *
 *  1. `/v1/analytics/compensation` — lo `scatter` emette una riga per posizione
 *     con titolo, banda e mediana. MISURATO 2026-08-12: **280 posizioni su 299
 *     hanno un solo titolare**, quindi quel punto E' la retribuzione di quella
 *     persona, con nome ricavabile dal titolo della posizione.
 *  2. `/v1/org-health/` — `retention` e' 1 - media(rischio di fuga)/100 e
 *     `performance` e' una media di valutazioni. Su un'unita' con campione 1 la
 *     media E' il punteggio individuale, e si ricava invertendo l'aritmetica.
 *     Sono gli stessi punteggi che `insights` gia' maschera allo stesso attore.
 *
 * E c'e' un terzo canale che un test sui soli campi non vedrebbe: **il CSV**.
 * `/v1/analytics/:view/export` non passa dallo schema Zod di risposta e
 * serializza il payload cosi' com'e'. Se la maschera vivesse nello schema
 * invece che nel service, il CSV sarebbe una porta di servizio aperta.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";

const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org";

interface Session { cookies: Map<string, string> }

function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let t: TestApp;
let platform: Session;
let hrMandate: Session;

async function login(email: string): Promise<Session> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

async function get(s: Session, url: string): Promise<{ status: number; raw: string }> {
  const r = await t.app.inject({ method: "GET", url, headers: { cookie: cookieHeader(s.cookies) } });
  return { status: r.statusCode, raw: r.body };
}

describe("#124 — vincolo 5: gli aggregati su una classe mascherata", () => {
  beforeAll(async () => {
    t = await buildTestApp();
    platform = await login(PLATFORM_EMAIL);
    hrMandate = await login(HR_MANDATE_EMAIL);
  });
  afterAll(async () => {
    await t.app.close();
    await closePool();
  });

  it("analytics/compensation: al mandato TECNICO lo scatter e le mediane sono tolti e dichiarati", async () => {
    const r = await get(platform, "/v1/analytics/compensation");
    expect(r.status).toBe(200);
    const b = JSON.parse(r.raw) as Record<string, unknown> & { masked?: string[] };

    // Tolti, non svuotati: la chiave e' assente, cosi' non c'e' un segnaposto
    // da scambiare per un valore.
    for (const k of ["scatter", "bandingByOu", "overallMedianMidEur", "overallMinMidEur", "overallMaxMidEur"]) {
      expect(b[k], `${k} non doveva essere servito al mandato tecnico`).toBeUndefined();
    }
    expect(b.masked).toEqual([
      "bandingByOu", "overallMaxMidEur", "overallMedianMidEur", "overallMinMidEur", "scatter",
    ]);

    // Cio' che NON doveva sparire: i conteggi dicono la forma dell'organizzazione
    // senza dire quanto prende nessuno.
    expect(typeof b.totalProfiles).toBe("number");
    expect(typeof b.ouCount).toBe("number");

    // E nel corpo grezzo non deve restare traccia degli importi.
    expect(r.raw).not.toContain("midEur");
  });

  it("analytics/compensation: al mandato HR gli stessi campi ci sono ancora", async () => {
    const r = await get(hrMandate, "/v1/analytics/compensation");
    expect(r.status).toBe(200);
    const b = JSON.parse(r.raw) as Record<string, unknown> & { masked?: string[] };
    // Senza questa asserzione la prova non potrebbe fallire: un service che
    // maschera SEMPRE passerebbe il test precedente.
    expect(Array.isArray(b.scatter)).toBe(true);
    expect(Array.isArray(b.bandingByOu)).toBe(true);
    expect(b.masked).toBeUndefined();
  });

  it("analytics: il canale CSV eredita la maschera invece di scavalcarla", async () => {
    const csv = await get(platform, "/v1/analytics/compensation/export?format=csv");
    expect(csv.status).toBe(200);
    // La rotta non passa dallo schema di risposta: se la maschera vivesse li',
    // qui uscirebbero gli importi.
    //
    // Si cercano le SEZIONI, non la stringa "midEur": quel nome compare
    // legittimamente nell'elenco di cio' che e' stato tolto — la prima stesura
    // di questa asserzione l'ha vista rossa proprio per quello, cioe' stava
    // misurando la dichiarazione invece del dato.
    expect(csv.raw).not.toContain("# scatter");
    expect(csv.raw).not.toContain("# bandingByOu");
    expect(csv.raw).not.toMatch(/^overallMedianMidEur,/m);
    // E dichiara cosa manca, invece di consegnare un file misteriosamente corto.
    expect(csv.raw).toContain("# masked");

    const json = await get(platform, "/v1/analytics/compensation/export?format=json");
    expect(json.status).toBe(200);
    const b = JSON.parse(json.raw) as Record<string, unknown>;
    expect(b.scatter).toBeUndefined();
    expect(b.masked).toBeDefined();
  });

  it("org-health: al mandato TECNICO retention e performance sono non disponibili e dichiarate", async () => {
    const r = await get(platform, "/v1/org-health/");
    expect(r.status).toBe(200);
    const b = JSON.parse(r.raw) as {
      masked?: string[];
      units: { dimensions: { dimension: string; score: number | null; effectiveWeight: number }[] }[];
    };
    expect(b.masked).toEqual(["performance", "retention"]);
    expect(b.units.length).toBeGreaterThan(0);

    for (const u of b.units) {
      for (const d of u.dimensions) {
        if (d.dimension === "retention" || d.dimension === "performance") {
          expect(d.score, `${d.dimension} non doveva avere punteggio`).toBeNull();
          // Peso azzerato: se restasse, il composito sarebbe ancora funzione
          // del punteggio tolto e lo si ricaverebbe per differenza.
          expect(d.effectiveWeight).toBe(0);
        }
      }
    }
  });

  it("org-health: al mandato HR le due dimensioni portano ancora un punteggio", async () => {
    const r = await get(hrMandate, "/v1/org-health/");
    expect(r.status).toBe(200);
    const b = JSON.parse(r.raw) as {
      masked?: string[];
      units: { dimensions: { dimension: string; score: number | null }[] }[];
    };
    expect(b.masked).toBeUndefined();
    const conPunteggio = b.units.some((u) =>
      u.dimensions.some((d) => (d.dimension === "retention" || d.dimension === "performance") && d.score !== null),
    );
    expect(conPunteggio, "nessuna unita' porta i punteggi: la prova non potrebbe fallire").toBe(true);
  });
});
