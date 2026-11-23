/**
 * apps/api/test/unit/faldone-sezioni-lunghe.unit.test.ts — K27 (forense 23/11/2026).
 *
 * «Mostra le righe» delle sezioni collegate del faldone falliva sempre con 414: l'identificativo
 * `<figlia>.<colonna>@<madre>.<colonna>` sta nel percorso, e Fastify rifiuta per difetto un
 * parametro oltre 100 caratteri. Senza database: un'app Fastify minima con le stesse opzioni del
 * router dell'API vera e lo stesso schema dei parametri.
 */
import Fastify from "fastify";
import { describe, it, expect } from "vitest";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { FaldoneSezioneSelfParamSchema } from "@heuresys/shared";
import { ROUTER_OPTIONS } from "../../src/lib/router-options.js";

// Il più lungo dei tre identificativi visti in errore nel giro s2 (117 caratteri).
const SEZIONE =
  "sys.sys_successor_readiness.successor_readiness_candidate_id@sys.sys_successor_candidates.successor_candidate_user_id";

async function appCon(opzioni?: typeof ROUTER_OPTIONS) {
  const app = Fastify(opzioni ? { routerOptions: opzioni } : {}).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.get("/v1/me/faldone/sezioni/:sezione", { schema: { params: FaldoneSezioneSelfParamSchema } }, async (req) => ({
    sezione: req.params.sezione,
  }));
  await app.ready();
  return app;
}

describe("faldone — sezioni collegate con identificativo lungo (K27)", () => {
  it("con le opzioni di difetto Fastify risponde 414: è il difetto visto nel giro", async () => {
    const app = await appCon();
    const r = await app.inject({ method: "GET", url: `/v1/me/faldone/sezioni/${encodeURIComponent(SEZIONE)}` });
    expect(r.statusCode).toBe(414);
    await app.close();
  });

  it("con le opzioni dell'API la sezione si apre e l'identificativo arriva intero", async () => {
    const app = await appCon(ROUTER_OPTIONS);
    const r = await app.inject({ method: "GET", url: `/v1/me/faldone/sezioni/${encodeURIComponent(SEZIONE)}?limit=100&offset=0` });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { sezione: string }).sezione).toBe(SEZIONE);
    await app.close();
  });

  it("il tetto copre la lunghezza massima del contratto, con la @ codificata", async () => {
    const massimo = FaldoneSezioneSelfParamSchema.shape.sezione.maxLength ?? 0;
    expect(massimo).toBeGreaterThan(0);
    expect(ROUTER_OPTIONS.maxParamLength).toBeGreaterThanOrEqual(massimo + 2);
    const app = await appCon(ROUTER_OPTIONS);
    const lunga = `${"a".repeat(massimo - 1)}@`;
    const r = await app.inject({ method: "GET", url: `/v1/me/faldone/sezioni/${encodeURIComponent(lunga)}` });
    expect(r.statusCode).toBe(200);
    await app.close();
  });
});
