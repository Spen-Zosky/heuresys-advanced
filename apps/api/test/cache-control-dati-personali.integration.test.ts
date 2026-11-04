/**
 * apps/api/test/cache-control-dati-personali.integration.test.ts
 *
 * F-7 del piano interfacce (lotto L7): le risposte `/v1/*` portano `cache-control: no-store`,
 * così nessun dato personale resta nella cache del browser o di un proxy. Misurato sul banco
 * il 2026-11-04: /v1/me/profile, /v1/me/pay-slips e /v1/me/documents rispondevano 200 senza
 * alcuna intestazione di cache.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

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
