/**
 * apps/api/test/dpo-nessun-dato-sensibile-in-chiaro.integration.test.ts
 *
 * S-9 del piano interfacce (docs/piani/PIANO_interfacce_20261103.md; analisi V4 D-04, T-6;
 * debito D-50). Il DPO ha il perimetro dell'intero tenant con COMPENSATION ed EVALUATION
 * mascherate (D11, ADR-0036 §5). Fin qui la maschera era provata solo sul dossier
 * (dpo-dossier-mascherato): ogni altra rotta che il DPO raggiunge non era mai stata
 * guardata campo per campo.
 *
 * COME. L'elenco delle rotte non e' scritto a mano: si ricava dal codice, leggendo in
 * `src/app.ts` quale modulo e' montato su quale prefisso e, nei `routes.ts`, ogni GET senza
 * parametri di percorso. Il DPO le chiama tutte; per ogni risposta 200 si cerca, a ogni
 * profondita', un campo di retribuzione o di giudizio con un valore presente. La prova
 * fallisce elencando rotta e campo. Restano fuori `/v1/me/*` (i dati propri, I17) e
 * `/v1/auth/*`.
 *
 * PERCHE' PUO' FALLIRE. Se una rotta raggiungibile dal DPO restituisce un importo o un
 * giudizio in chiaro, la prova la nomina. E se il DPO non raggiungesse niente (login rotto,
 * perimetro cambiato), il primo controllo fallisce invece di passare per assenza di casi.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";

const DPO_EMAIL = "dpo@collaudo.invalid";
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Campi che portano un importo o un giudizio su una persona (dai `maskFields` dei moduli). */
const CAMPI_SENSIBILI = new Set([
  // COMPENSATION
  "grossAnnualSalary", "grossPay", "netPay", "deductions", "salary", "amountEur",
  "recordedAmountEur", "totalEur", "economicWeight",
  // EVALUATION
  "overallRating", "calibratedRating", "preCalibrationRating", "potentialRating",
  "competencyRating", "goalAchievementRating", "selfRating", "performanceBox", "potentialBox",
  "managerComments", "strengths", "areasForImprovement", "calibrationNotes",
  "developmentPlan", "readinessLevel", "reviewNotes",
]);

const ESCLUSE = [/^\/v1\/me(\/|$)/, /^\/v1\/auth(\/|$)/];

/** Le GET senza parametri di percorso, con il loro prefisso, lette dal codice. */
function rotteGet(): string[] {
  const app = readFileSync(join(SRC, "app.ts"), "utf8");
  const fileDi = new Map<string, string>();
  for (const m of app.matchAll(/^import \{([^}]+)\} from "\.\/(modules\/[^"]+)\.js";/gm)) {
    for (const nome of (m[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      fileDi.set(nome, `${m[2]}.ts`);
    }
  }
  const out = new Set<string>();
  for (const m of app.matchAll(/app\.register\((\w+), \{ prefix: "([^"]+)"/g)) {
    const file = fileDi.get(m[1] ?? "");
    const prefisso = m[2] ?? "";
    if (!file) continue;
    let sorgente: string;
    try {
      sorgente = readFileSync(join(SRC, file), "utf8");
    } catch {
      continue;
    }
    for (const g of sorgente.matchAll(/app\.get(?:<[^>]*>)?\(\s*"([^"]*)"/g)) {
      const percorso = g[1] ?? "";
      if (percorso.includes(":") || percorso.includes("*")) continue;
      const url = `${prefisso}${percorso === "/" ? "" : percorso}`;
      if (ESCLUSE.some((r) => r.test(url))) continue;
      out.add(url);
    }
  }
  return [...out].sort();
}

/** Ogni campo sensibile con un valore presente, a qualunque profondita'. */
function campiInChiaro(v: unknown, via = ""): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => campiInChiaro(x, `${via}[${i}]`));
  if (v === null || typeof v !== "object") return [];
  const trovati: string[] = [];
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (CAMPI_SENSIBILI.has(k) && x !== null && x !== undefined && x !== "") {
      trovati.push(`${via}.${k}`);
    }
    trovati.push(...campiInChiaro(x, `${via}.${k}`));
  }
  return trovati;
}

let t: TestApp;
let cookie = "";

describe("S-9 — il DPO non riceve importi né giudizi in chiaro da nessuna rotta", () => {
  beforeAll(async () => {
    t = await buildTestApp();
    const r = await loginRaw(t.app, DPO_EMAIL);
    cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  });
  afterAll(async () => {
    await t.app.close();
    await closePool();
  });

  it("su ogni GET raggiungibile, nessun campo di retribuzione o di giudizio arriva con un valore", async () => {
    const rotte = rotteGet();
    expect(rotte.length, "nessuna rotta letta dal codice: il lettore di app.ts è rotto").toBeGreaterThan(100);

    const aperte: string[] = [];
    const fughe: string[] = [];
    for (const url of rotte) {
      const r = await t.app.inject({ method: "GET", url, headers: { cookie } });
      if (r.statusCode !== 200) continue;
      if (!String(r.headers["content-type"] ?? "").includes("application/json")) continue;
      aperte.push(url);
      const campi = campiInChiaro(r.json());
      if (campi.length > 0) fughe.push(`${url}: ${campi.slice(0, 5).join(", ")}`);
    }

    expect(aperte.length, "il DPO non apre nessuna rotta: login o perimetro rotti").toBeGreaterThan(5);
    expect(fughe, `rotte aperte al DPO: ${aperte.length}`).toEqual([]);
  });
});
