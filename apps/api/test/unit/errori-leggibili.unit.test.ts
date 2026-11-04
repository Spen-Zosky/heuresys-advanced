/**
 * apps/api/test/unit/errori-leggibili.unit.test.ts
 *
 * S-12 e S-13 del piano interfacce (docs/piani/PIANO_interfacce_20261103.md).
 *
 * Un errore deve dire che cosa e' successo (il codice, che il client traduce) e
 * come ritrovarlo (l'identificativo della richiesta). Prima di S-12 nessuna busta
 * portava il `requestId`, una risposta fuori contratto era un anonimo
 * «Unexpected server error», e il tetto dei risultati analitici un 500.
 *
 * Senza database: un'app Fastify minima con gli stessi compilatori Zod e lo stesso
 * gestore d'errori dell'API vera.
 */
import Fastify from "fastify";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { ForbiddenError, NotFoundError } from "../../src/errors/index.js";
import { guardResultCap } from "../../src/lib/result-cap.js";

const app = Fastify().withTypeProvider<ZodTypeProvider>();

beforeAll(async () => {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.get("/vietato", async () => {
    throw new ForbiddenError("Missing permission: x:read");
  });
  app.get("/assente", async () => {
    throw new NotFoundError("Thing");
  });
  app.get("/tetto", async () => guardResultCap([1, 2, 3], "prova", 2));
  app.get(
    "/fuori-contratto",
    { schema: { response: { 200: z.object({ obbligatorio: z.string() }) } } },
    async () => ({ altro: 1 }) as unknown as { obbligatorio: string },
  );
  app.get("/rotto", async () => {
    throw new Error("boom");
  });
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

type Busta = { error: { code: string; message: string; requestId?: string; details?: unknown } };

async function chiama(url: string): Promise<{ status: number; body: Busta }> {
  const r = await app.inject({ method: "GET", url });
  return { status: r.statusCode, body: r.json() as Busta };
}

describe("S-12 — ogni errore porta codice e identificativo della richiesta", () => {
  it.each([
    ["/vietato", 403, "FORBIDDEN"],
    ["/assente", 404, "NOT_FOUND"],
    ["/rotto", 500, "INTERNAL_ERROR"],
  ])("%s risponde %i con codice %s e requestId", async (url, status, code) => {
    const r = await chiama(url);
    expect(r.status).toBe(status);
    expect(r.body.error.code).toBe(code);
    expect(typeof r.body.error.requestId).toBe("string");
    expect(r.body.error.requestId).not.toBe("");
  });

  it("una risposta fuori dal proprio contratto e' RESPONSE_CONTRACT_VIOLATION, non un errore anonimo", async () => {
    const r = await chiama("/fuori-contratto");
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe("RESPONSE_CONTRACT_VIOLATION");
    expect(typeof r.body.error.requestId).toBe("string");
  });
});

describe("S-13 — oltre il tetto dei risultati, 422 con un'istruzione", () => {
  it("risponde 422 RESULT_LIMIT_EXCEEDED con il tetto e il suggerimento", async () => {
    const r = await chiama("/tetto");
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("RESULT_LIMIT_EXCEEDED");
    expect(r.body.error.message).toMatch(/RESULT_SET_TRUNCATION/);
    expect(r.body.error.details).toMatchObject({ cap: 2, what: "prova" });
  });
});
