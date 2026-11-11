/**
 * apps/api/test/me-quadro.integration.test.ts — GET /v1/me/quadro (classe C15 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Che cosa si prova:
 *  - ogni lente gira sullo schema vero: per un mandato HR nessuna lente resta non calcolata;
 *  - chi vede solo sé stesso riceve solo le lenti personali;
 *  - gli insight arrivano in ordine di gravità;
 *  - chi non è autenticato riceve 401.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { AREE_QUADRO, type AreaQuadro } from "@heuresys/shared";
import { pool } from "../src/db/client.js";
import type { ActorContext } from "../src/lib/actor.js";
import { leggiQuadro } from "../src/modules/quadro/service.js";
import { resolveOrgReadScope } from "../src/lib/scope/resolver.js";

type Quadro = { insight: { chiave: string; area: string; tono: string; titolo: string }[]; nonCalcolate: string[]; verifiche: number };
const PESO: Record<string, number> = { rischio: 0, attenzione: 1, informazione: 2, positivo: 3 };

describe("GET /v1/me/quadro", () => {
  let t: TestApp;
  beforeAll(async () => { t = await buildTestApp(); });
  afterAll(async () => { await t.app.close(); });

  const chiedi = async (email: string, aree?: string) => {
    const login = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
    const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const url = aree ? `/v1/me/quadro?aree=${aree}` : "/v1/me/quadro";
    return t.app.inject({ method: "GET", url, headers: { cookie } });
  };

  it("401 senza sessione", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/me/quadro" });
    expect(r.statusCode).toBe(401);
  });

  it("per un mandato HR ogni lente si calcola, in ordine di gravità", async () => {
    const r = await chiedi("federica.marchetti@rtl-bank.org");
    expect(r.statusCode).toBe(200);
    const b = r.json() as Quadro;
    expect(b.nonCalcolate).toEqual([]);
    // tutte le lenti del mandato HR, comprese quelle di governo (accessi, processi, contenuti…)
    expect(b.verifiche).toBeGreaterThanOrEqual(20);
    const pesi = b.insight.map((i) => PESO[i.tono]!);
    expect(pesi).toEqual([...pesi].sort((a, c) => a - c));
  });

  it("chi vede solo sé stesso riceve solo le lenti personali, anche su una pagina senza lenti personali", async () => {
    // L'attore ha il solo ruolo USER e non guida unità: si sceglie fra le persone di RTL la
    // prima il cui perimetro risolve davvero a sé stesso (chi guida un'unità vede il suo ramo).
    const candidati = await pool.query<{ user_id: string; tenant_id: string }>(
      `SELECT u.user_id, u.user_tenant_id AS tenant_id FROM sys.sys_users u
        WHERE u.user_email LIKE '%@rtl-bank.org' ORDER BY u.user_email LIMIT 50`,
    );
    let actor: ActorContext | null = null;
    for (const c of candidati.rows) {
      const prova = { userId: c.user_id, tenantId: c.tenant_id, roles: ["USER"] } as ActorContext;
      if ((await resolveOrgReadScope(pool, prova)).kind === "self") { actor = prova; break; }
    }
    expect(actor).not.toBeNull();
    for (const aree of [[...AREE_QUADRO], ["selezione"]] as AreaQuadro[][]) {
      const b = await leggiQuadro(actor!, aree);
      expect(b.nonCalcolate).toEqual([]);
      expect(b.verifiche).toBeGreaterThan(0);
      for (const i of b.insight) expect(i.area).toBe("personale");
    }
  });

  it("le aree filtrano le lenti", async () => {
    const r = await chiedi("federica.marchetti@rtl-bank.org", "assenze");
    const b = r.json() as Quadro;
    for (const i of b.insight) expect(["assenze"]).toContain(i.area);
  });
});
