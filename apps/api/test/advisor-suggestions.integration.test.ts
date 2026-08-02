/**
 * apps/api/test/advisor-suggestions.integration.test.ts
 * #58 F4 fase 1 — l'advisor prescrittivo. Login reale + DB vivo (RTL_BANK).
 *
 * La guardia che conta non è «l'advisor produce suggerimenti»: è «ogni citazione è
 * verificabile». Per ogni raccomandazione questi test ri-leggono la fonte citata
 * DALL'ENDPOINT che la citazione dichiara, e confrontano il valore con quello riportato.
 * Un motore che inventasse un numero, o che citasse un'entità inesistente, esce rosso.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { ADVISOR_RULES, ADVISOR_MODEL_VERSION } from "@heuresys/shared";
import type { AdvisorSuggestionsResponse, AdvisorCitation } from "@heuresys/shared";

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let director: S;   // TENANT_ADMIN RTL — ha org_director:read
let employee: S;   // USER — non ce l'ha

async function get(s: S, url: string) {
  return suite.app.inject({ method: "GET", url, headers: { cookie: ch(s.cookies) } });
}

/** Rilegge il valore citato dall'endpoint che la citazione stessa dichiara. */
async function reread(c: AdvisorCitation): Promise<number | string | null> {
  const r = await get(director, c.endpoint);
  if (r.statusCode !== 200) return null;
  const body = r.json() as Record<string, unknown>;
  if (c.source === "VRIO") {
    const items = body["items"] as Array<Record<string, unknown>>;
    const item = items.find((i) => i["skillGroupId"] === c.subjectId);
    if (!item) return null;
    if (c.field === "verdict") return item["verdict"] as string;
    const key = c.field.replace("evidence.", "");
    const ev = item["evidence"] as Record<string, unknown>;
    return (ev[key] as number | string | undefined) ?? null;
  }
  if (c.source === "ESSENTIAL_RANKING") {
    const items = body["items"] as Array<Record<string, unknown>>;
    const item = items.find((i) => i["skillId"] === c.subjectId);
    return item ? ((item[c.field] as number | string | undefined) ?? null) : null;
  }
  const units = body["units"] as Array<Record<string, unknown>>;
  const unit = units.find((u) => u["orgUnitId"] === c.subjectId);
  if (!unit) return null;
  if (c.field.startsWith("dimensions.")) {
    const dim = c.field.split(".")[1];
    const dims = unit["dimensions"] as Array<Record<string, unknown>>;
    return (dims.find((d) => d["dimension"] === dim)?.["score"] as number | undefined) ?? null;
  }
  return (unit[c.field] as number | string | undefined) ?? null;
}

let first: AdvisorSuggestionsResponse;

beforeAll(async () => {
  suite = await buildTestApp();
  director = await login(suite, "federica.marchetti@rtl-bank.org");
  employee = await login(suite, "tommaso.fiore@rtl-bank.org");
  const r = await get(director, "/v1/advisor/suggestions");
  expect(r.statusCode).toBe(200);
  first = r.json() as AdvisorSuggestionsResponse;
});

afterAll(async () => { await suite.app.close(); await closePool(); });

describe("/v1/advisor — raccomandazioni prescrittive con citazioni (#58 F4)", () => {
  it("risponde con le regole valutate e la versione del modello", () => {
    expect(first.modelVersion).toBe(ADVISOR_MODEL_VERSION);
    expect(first.rulesEvaluated.sort()).toEqual([...ADVISOR_RULES].sort());
  });

  it("produce raccomandazioni sui dati reali del tenant", () => {
    expect(first.total).toBeGreaterThan(0);
    expect(first.items.length).toBe(first.total);
  });

  it("nessuna raccomandazione senza fonte — nemmeno come caso limite", () => {
    for (const s of first.items) {
      expect(s.citations.length).toBeGreaterThan(0);
      for (const c of s.citations) {
        expect(c.endpoint).toBeTruthy();
        expect(c.subjectId).toBeTruthy();
        expect(c.field).toBeTruthy();
      }
    }
  });

  // LA guardia: ogni valore citato deve corrispondere a quello che l'endpoint citato risponde.
  it("ogni citazione è verificabile: valore dichiarato = valore riletto dalla fonte", async () => {
    let checked = 0;
    for (const s of first.items) {
      for (const c of s.citations) {
        const actual = await reread(c);
        expect(actual, `citazione irrisolvibile: ${c.source} ${c.subjectId} ${c.field}`).not.toBeNull();
        if (typeof c.value === "number" && typeof actual === "number") {
          expect(Math.abs(actual - c.value), `${c.source}.${c.field} su ${c.subjectLabel}`).toBeLessThanOrEqual(0.011);
        } else {
          expect(String(actual)).toBe(String(c.value));
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0); // un test che non controlla nulla passerebbe sempre
  });

  it("deterministico: due derivazioni sugli stessi dati danno la stessa lista", async () => {
    const again = (await get(director, "/v1/advisor/suggestions")).json() as AdvisorSuggestionsResponse;
    expect(again.items.map((s) => `${s.ruleId}:${s.subjectId}:${s.priority}`))
      .toEqual(first.items.map((s) => `${s.ruleId}:${s.subjectId}:${s.priority}`));
  });

  it("la traccia è registrata PRIMA di essere mostrata: /audit rilegge le stesse righe", async () => {
    const audit = (await get(director, "/v1/advisor/audit")).json() as AdvisorSuggestionsResponse;
    expect(audit.total).toBe(first.total);
    expect(audit.items.map((s) => `${s.ruleId}:${s.subjectId}`).sort())
      .toEqual(first.items.map((s) => `${s.ruleId}:${s.subjectId}`).sort());
    for (const s of audit.items) expect(s.citations.length).toBeGreaterThan(0);
  });

  it("ri-derivare non fa crescere la tabella (coorte sostituita, non accumulata)", async () => {
    const count = async () => {
      const r = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_advisor_suggestions
          WHERE advisor_suggestion_tenant_id = (SELECT user_tenant_id FROM sys.sys_users WHERE user_email = $1)`,
        ["federica.marchetti@rtl-bank.org"],
      );
      return Number(r.rows[0]!.n);
    };
    const before = await count();
    await get(director, "/v1/advisor/suggestions");
    await get(director, "/v1/advisor/suggestions");
    expect(await count()).toBe(before);
  });

  // Caso di controllo derivato dal DB, non nominato: se esiste una capability richiesta da
  // posizioni e posseduta da nessuno, l'advisor DEVE proporne l'acquisizione. È il caso in cui
  // un consiglio silenzioso sarebbe il danno peggiore.
  it("una capability richiesta e posseduta da nessuno produce una raccomandazione di acquisizione", async () => {
    const vrio = (await get(director, "/v1/capability/composition/vrio")).json() as {
      items: Array<{ skillGroupId: string; verdict: string; evidence: { positionsRequiring: number; holders: number } }>;
    };
    const gaps = vrio.items.filter((i) => i.verdict === "CAPABILITY_GAP" && i.evidence.positionsRequiring > 0);
    if (gaps.length === 0) return; // niente da provare oggi: la fixture non contiene il caso
    for (const g of gaps) {
      const s = first.items.find((x) => x.ruleId === "CAPABILITY_GAP_ACQUIRE" && x.subjectId === g.skillGroupId);
      expect(s, `nessuna raccomandazione per il buco di capability ${g.skillGroupId}`).toBeTruthy();
      expect(s!.citations.some((c) => c.field === "evidence.holders" && Number(c.value) === 0)).toBe(true);
    }
  });

  it("le priorità stanno nell'intervallo dichiarato e la lista è ordinata", () => {
    for (const s of first.items) {
      expect(s.priority).toBeGreaterThanOrEqual(0);
      expect(s.priority).toBeLessThanOrEqual(100);
    }
    const p = first.items.map((s) => s.priority);
    expect([...p].sort((a, b) => b - a)).toEqual(p);
  });

  /**
   * Il ponte F1→F2. La prima versione agganciava per NOME e non poteva mai funzionare:
   * F1 elenca skill, F2 gruppi — 0 coincidenze su 10 misurate. Questo test è rosso contro
   * quella versione, perché nessuna skill del top-N risolveva a un gruppo esistente.
   */
  it("le capability essenziali si agganciano davvero alle capability della scorecard VRIO", async () => {
    const ess = (await get(director, "/v1/capability/composition/essential-ranking")).json() as {
      items: Array<{ skillId: string; skillName: string; skillGroupId: string | null; essentialityScore: number }>;
    };
    const vrio = (await get(director, "/v1/capability/composition/vrio")).json() as {
      items: Array<{ skillGroupId: string }>;
    };
    const groups = new Set(vrio.items.map((i) => i.skillGroupId));
    const top = [...ess.items].sort((a, b) => b.essentialityScore - a.essentialityScore).slice(0, 10);
    expect(top.length).toBeGreaterThan(0);
    // Il gruppo dev'essere un dato, non un nome da indovinare…
    expect(top.filter((s) => s.skillGroupId !== null).length).toBeGreaterThan(0);
    // …e almeno uno dei gruppi in cima deve esistere nella scorecard, altrimenti la regola
    // che li mette in relazione è codice che non può scattare.
    expect(top.filter((s) => s.skillGroupId !== null && groups.has(s.skillGroupId)).length).toBeGreaterThan(0);
  });

  /**
   * Una regola che non scatta mai è codice morto travestito da capability. Questo test non
   * pretende che tutte producano output su questi dati — pretende che ognuna sia RAGGIUNGIBILE:
   * o produce, o la sua precondizione è verificabilmente assente nel tenant.
   */
  it("ogni regola o produce, o ha la precondizione dimostrabilmente assente", async () => {
    const vrio = (await get(director, "/v1/capability/composition/vrio")).json() as {
      items: Array<{ verdict: string; evidence: { positionsRequiring: number; totalRequirements: number } }>;
    };
    const oh = (await get(director, "/v1/org-health")).json() as {
      minCoverage: number; units: Array<{ coverage: number; standing: string }>;
    };
    const prodotte = new Set(first.items.map((s) => s.ruleId));

    const precondizioni: Record<string, number> = {
      CAPABILITY_GAP_ACQUIRE: vrio.items.filter((i) => i.verdict === "CAPABILITY_GAP" && i.evidence.positionsRequiring > 0).length,
      UNUSED_ADVANTAGE_DEPLOY: vrio.items.filter((i) => i.verdict === "UNUSED_ADVANTAGE" && i.evidence.totalRequirements > 0).length,
      LAGGING_UNIT_INTERVENE: oh.units.filter((u) => u.standing === "LAGGING").length,
      INSUFFICIENT_COVERAGE_INSTRUMENT: oh.units.filter((u) => u.coverage < oh.minCoverage).length,
    };
    for (const [rule, casi] of Object.entries(precondizioni)) {
      if (casi > 0) {
        expect(prodotte.has(rule as never), `la regola ${rule} ha ${casi} casi validi e non ha prodotto nulla`).toBe(true);
      }
    }
  });

  it("chi non può vedere le fonti non vede le conclusioni: USER → 403", async () => {
    expect((await get(employee, "/v1/advisor/suggestions")).statusCode).toBe(403);
    expect((await get(employee, "/v1/advisor/audit")).statusCode).toBe(403);
  });
});
