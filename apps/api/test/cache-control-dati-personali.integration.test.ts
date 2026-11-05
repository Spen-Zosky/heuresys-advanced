/**
 * apps/api/test/cache-control-dati-personali.integration.test.ts
 *
 * F-7 del piano interfacce (lotto L7): le risposte `/v1/*` portano `cache-control: no-store`,
 * così nessun dato personale resta nella cache del browser o di un proxy. Misurato sul banco
 * il 2026-11-04: /v1/me/profile, /v1/me/pay-slips e /v1/me/documents rispondevano 200 senza
 * alcuna intestazione di cache.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";

// Z-251 F2 — questo file chiama /v1/auth/refresh (il rifiuto senza CSRF): fuori dalla cache
// di sessioni, come ogni file che tocca il flusso di autenticazione. I login qui sono veri.
senzaCacheDiSessione();

let suite: TestApp;
let cookie = "";

describe("cache-control sui dati personali (F-7)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "tommaso.fiore@rtl-bank.org", TEST_PERSONA_PASSWORD);
    cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  for (const url of ["/v1/me/profile", "/v1/me/pay-slips", "/v1/me/documents", "/v1/me/inbox"]) {
    it(`${url} risponde con no-store`, async () => {
      const r = await suite.app.inject({ method: "GET", url, headers: { cookie } });
      expect(r.statusCode, r.body).toBe(200);
      expect(r.headers["cache-control"]).toBe("no-store");
    });
  }

  it("anche un rifiuto (401) non si conserva", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/profile" });
    expect(r.statusCode).toBe(401);
    expect(r.headers["cache-control"]).toBe("no-store");
  });
});

/**
 * La prima stesura scriveva l'intestazione in un `onSend` asincrono, e su ogni risposta
 * d'errore Fastify scriveva le intestazioni due volte: due avvisi «Reply was already sent»
 * (ERR_HTTP_HEADERS_SENT) per ogni 401, 403 o 409. Le risposte arrivavano giuste, quindi
 * nessuna prova se ne accorgeva; sul banco erano 480 righe di registro in un giro della suite.
 * Qui si contano gli avvisi della richiesta: zero, anche quando la risposta è un rifiuto.
 */
describe("cache-control senza risposte scritte due volte (F-7)", () => {
  let app: FastifyInstance;
  const avvisi: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    // Il registro della richiesta è lo stesso della risposta (`reply.log`): si osserva da qui.
    app.addHook("onRequest", async (req) => {
      const warn = req.log.warn.bind(req.log);
      req.log.warn = ((...a: unknown[]) => {
        avvisi.push(String(a[a.length - 1]));
        return (warn as (...x: unknown[]) => void)(...a);
      }) as typeof req.log.warn;
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("un rifiuto (403, CSRF mancante) porta no-store e non lascia avvisi", async () => {
    avvisi.length = 0;
    const r = await app.inject({ method: "POST", url: "/v1/auth/refresh" });
    expect(r.statusCode).toBe(403);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(avvisi.filter((m) => /already sent/i.test(m))).toEqual([]);
  });
});
