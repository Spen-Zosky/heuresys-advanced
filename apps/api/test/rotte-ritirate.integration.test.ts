import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { ROTTE_RITIRATE, RITIRI_APPLICATI } from "../src/lib/rotte-ritirate.js";

// Ondata 5 degli endpoint senza consumatori (classe c): una rotta ritirata resta registrata con i
// suoi permessi, risponde 410 a chi poteva chiamarla, e non tocca nessuna riga (ADR-0035).

interface S { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let tenantAdmin: S;
let plainUser: S;

beforeAll(async () => {
  suite = await buildTestApp();
  tenantAdmin = await login(suite, "governo@collaudo.invalid");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
});
afterAll(async () => { await suite.app.close(); });

describe("rotte ritirate", () => {
  it("ogni rotta dell'elenco esiste davvero, e quindi è stata ritirata", () => {
    // Un percorso rinominato senza aggiornare l'elenco darebbe un ritiro che non ritira niente.
    const mancanti = ROTTE_RITIRATE.map((r) => `${r.metodo} ${r.percorso}`).filter((k) => !RITIRI_APPLICATI.has(k));
    expect(mancanti).toEqual([]);
  });

  it("una cancellazione ritirata risponde 410 con l'alternativa, e la riga resta", async () => {
    const g = await pool.query<{ id: string }>("SELECT goal_id AS id FROM sys.sys_goals ORDER BY goal_id LIMIT 1");
    expect(g.rows.length, "nessun obiettivo su cui provare").toBe(1);
    const id = g.rows[0]!.id;
    const r = await suite.app.inject({
      method: "DELETE", url: `/v1/goals/${id}`,
      headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken },
    });
    expect(r.statusCode).toBe(410);
    const body = r.json() as { error: { code: string; details: { alternativa: string | null } } };
    expect(body.error.code).toBe("ROUTE_RETIRED");
    expect(body.error.details.alternativa).toBe("PATCH /v1/goals/:id");
    const ancora = await pool.query("SELECT 1 FROM sys.sys_goals WHERE goal_id = $1", [id]);
    expect(ancora.rowCount).toBe(1);
  });

  it("i permessi restano: chi non poteva chiamarla riceve ancora 403, non 410", async () => {
    const r = await suite.app.inject({
      method: "DELETE", url: "/v1/goals/00000000-0000-4000-8000-000000000000",
      headers: { cookie: ch(plainUser.cookies), "x-csrf-token": plainUser.csrfToken },
    });
    expect(r.statusCode).toBe(403);
  });
});
