/**
 * apps/api/test/data-classification.integration.test.ts — #262.
 *
 * READ-only API over sys.sys_classificazione_direzione_dato (I23/ADR-0041).
 * RBAC: data_classification:read = DATA_STEWARD (mig 000453). Nessuno scope
 * organizzativo: la tabella non ha tenant_id, classifica lo schema.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";

const DATA_STEWARD_EMAIL = "data-steward@collaudo.invalid";
const HRMS_MANAGER_EMAIL = "maria.colombo@rtl-bank.org";

interface S { cookies: Map<string, string> }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string, password: string): Promise<S> {
  const r = await loginRaw(t.app, email, password);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}
async function liveCount(sql: string): Promise<number> {
  const r = await pool.query<{ n: string }>(sql);
  return Number(r.rows[0]!.n);
}

let suite: TestApp;
let dataSteward: S; let hrmsManager: S;

describe("#262 data-classification", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    dataSteward = await login(suite, DATA_STEWARD_EMAIL, deriveCollaudoPassword(key, DATA_STEWARD_EMAIL));
    hrmsManager = await login(suite, HRMS_MANAGER_EMAIL, TEST_PERSONA_PASSWORD);
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("DATA_STEWARD list total == live registry size, totals sum to it", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_classificazione_direzione_dato`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/data-classification",
      headers: { cookie: ch(dataSteward.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { tabella: string; stato: string }[]; totals: Record<string, number> };
    expect(body.items.length).toBe(live);
    expect(live).toBeGreaterThan(50);
    const sum = Object.values(body.totals).reduce((a, b) => a + b, 0);
    expect(sum).toBe(live);
  });

  it("la tabella si classifica da se' come 'infrastruttura' (X-1)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/data-classification",
      headers: { cookie: ch(dataSteward.cookies) },
    });
    const body = r.json() as { items: { tabella: string; stato: string }[] };
    const self = body.items.find((i) => i.tabella === "sys_classificazione_direzione_dato");
    expect(self?.stato).toBe("infrastruttura");
  });

  it("HRMS_MANAGER (senza il permesso) -> 403", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/data-classification",
      headers: { cookie: ch(hrmsManager.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });
});
