/**
 * apps/api/test/blueprint-process-publishability.integration.test.ts — il controllo di pubblicazione
 * dei processi del modello (ADR-0061 D10, passo 3). Sola lettura.
 *
 * Prova, sulla versione del modello con più processi:
 *  · ogni processo porta gli otto criteri, numerati da 1 a 8, e `soddisfatti` li conta;
 *  · un criterio è soddisfatto solo senza mancanze; `pubblicabile` vuol dire otto su otto;
 *  · i criteri che il metamodel non sa ancora rappresentare (2, 5, 7) non sono mai soddisfatti, e il
 *    totale dei pubblicabili è coerente con le righe;
 *  · una versione inesistente risponde un elenco vuoto; senza sessione 401.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

let suite: TestApp;
let cookie = "";
let versionId: string | null = null;

interface Risposta {
  total: number;
  pubblicabili: number;
  items: Array<{ soddisfatti: number; pubblicabile: boolean; criteri: Array<{ numero: number; soddisfatto: boolean; mancanze: string[] }> }>;
}

beforeAll(async () => {
  suite = await buildTestApp();
  const r = await loginRaw(suite.app, "platform-test-admin@collaudo.invalid", TEST_PERSONA_PASSWORD);
  cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const v = await pool.query<{ id: string }>(
    `SELECT blueprint_process_variant_version_id AS id FROM sys.sys_blueprint_process_registry
      WHERE blueprint_process_variant_version_id IS NOT NULL
      GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`);
  versionId = v.rows[0]?.id ?? null;
});

afterAll(async () => {
  await suite.app.close();
});

describe("ADR-0061 D10 — il controllo di pubblicazione dei processi del modello", () => {
  it("ogni processo ha otto criteri coerenti con il conteggio", async (ctx) => {
    if (!versionId) ctx.skip();
    const r = await suite.app.inject({ method: "GET", url: `/v1/blueprint-processes/pubblicabilita?variantVersionId=${versionId}`, headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as Risposta;
    expect(b.total).toBe(b.items.length);
    expect(b.total).toBeGreaterThan(0);
    for (const p of b.items) {
      expect(p.criteri.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      for (const c of p.criteri) expect(c.soddisfatto).toBe(c.mancanze.length === 0);
      expect(p.soddisfatti).toBe(p.criteri.filter((c) => c.soddisfatto).length);
      expect(p.pubblicabile).toBe(p.soddisfatti === 8);
      for (const n of [2, 5, 7]) expect(p.criteri[n - 1]!.soddisfatto).toBe(false);
    }
    expect(b.pubblicabili).toBe(b.items.filter((p) => p.pubblicabile).length);
  });

  it("una versione inesistente risponde un elenco vuoto", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/blueprint-processes/pubblicabilita?variantVersionId=00000000-0000-4000-8000-0000000000fe", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as Risposta).total).toBe(0);
  });

  it("senza sessione la lettura è rifiutata", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/blueprint-processes/pubblicabilita?variantVersionId=00000000-0000-4000-8000-0000000000fe` });
    expect(r.statusCode).toBe(401);
  });
});
