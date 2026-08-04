/**
 * apps/api/test/organization-units.integration.test.ts
 * Integration tests for /v1/organization-units/*.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_OU_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let tenantS: S;
let employeeS: S;
const createdIds: string[] = [];

describe("/v1/organization-units/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    employeeS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM sys.sys_organization_units WHERE organization_unit_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("LIST: USER can read OUs in own tenant", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/organization-units?limit=100",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { total: number };
    expect(body.total).toBeGreaterThanOrEqual(6); // RTL seed has 6
  });

  it("CREATE / GET / PATCH / DELETE happy path as TENANT_ADMIN", async () => {
    const code = `${SUITE_PREFIX}_HAPPY`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/organization-units",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Happy Unit", type: "DEPARTMENT" },
    });
    expect(created.statusCode).toBe(201);
    const ou = created.json() as { organizationUnitId: string; isActive: boolean };
    expect(ou.isActive).toBe(true);
    createdIds.push(ou.organizationUnitId);

    const single = await suite.app.inject({
      method: "GET", url: `/v1/organization-units/${ou.organizationUnitId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(single.statusCode).toBe(200);

    const patched = await suite.app.inject({
      method: "PATCH", url: `/v1/organization-units/${ou.organizationUnitId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { name: "Happy Unit Renamed" },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as { name: string }).name).toBe("Happy Unit Renamed");

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/organization-units/${ou.organizationUnitId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);

    const after = await suite.app.inject({
      method: "GET", url: `/v1/organization-units/${ou.organizationUnitId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect((after.json() as { isActive: boolean }).isActive).toBe(false);
  });

  it("CREATE duplicate code → 409 OU_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/organization-units",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup A" },
    });
    expect(first.statusCode).toBe(201);
    createdIds.push((first.json() as { organizationUnitId: string }).organizationUnitId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/organization-units",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup B" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("OU_CODE_CONFLICT");
  });

  describe("PATCH parentId: the tree must stay a tree (#83)", () => {
    // A ← B ← C, built once for the whole block.
    let a: string, b: string, c: string;

    async function createOu(code: string, parentId?: string): Promise<string> {
      const r = await suite.app.inject({
        method: "POST", url: "/v1/organization-units",
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
        payload: { code, name: code, ...(parentId ? { parentId } : {}) },
      });
      expect(r.statusCode).toBe(201);
      const id = (r.json() as { organizationUnitId: string }).organizationUnitId;
      createdIds.push(id);
      return id;
    }

    async function reparent(id: string, parentId: string) {
      return suite.app.inject({
        method: "PATCH", url: `/v1/organization-units/${id}`,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
        payload: { parentId },
      });
    }

    beforeAll(async () => {
      a = await createOu(`${SUITE_PREFIX}_CYC_A`);
      b = await createOu(`${SUITE_PREFIX}_CYC_B`, a);
      c = await createOu(`${SUITE_PREFIX}_CYC_C`, b);
    });

    it("a unit cannot become its own parent", async () => {
      const r = await reparent(a, a);
      expect(r.statusCode).toBe(409);
      expect((r.json() as { error: { code: string } }).error.code).toBe("OU_PARENT_CYCLE");
    });

    it("a unit cannot be moved under its direct child", async () => {
      const r = await reparent(a, b);
      expect(r.statusCode).toBe(409);
      expect((r.json() as { error: { code: string } }).error.code).toBe("OU_PARENT_CYCLE");
    });

    it("a unit cannot be moved under a deeper descendant", async () => {
      const r = await reparent(a, c);
      expect(r.statusCode).toBe(409);
      expect((r.json() as { error: { code: string } }).error.code).toBe("OU_PARENT_CYCLE");
    });

    it("the rejected move leaves the tree untouched", async () => {
      const r = await suite.app.inject({
        method: "GET", url: `/v1/organization-units/${a}`,
        headers: { cookie: ch(tenantS.cookies) },
      });
      expect((r.json() as { parentId: string | null }).parentId).toBeNull();
    });

    // Counter-proof: the guard must reject cycles, not every reparent.
    it("a legitimate move up the tree still succeeds", async () => {
      const r = await reparent(c, a);
      expect(r.statusCode).toBe(200);
      expect((r.json() as { parentId: string | null }).parentId).toBe(a);
    });
  });

  describe("parentId: the parent must live in the same tenant (#87)", () => {
    // The FK guarantees the parent EXISTS, not that it belongs to this tenant.
    // Both ids are resolved from the live DB — no UUID is written into the test.
    let foreignOuId: string;

    beforeAll(async () => {
      const r = await pool.query<{ organization_unit_id: string }>(
        `SELECT organization_unit_id
           FROM sys.sys_organization_units
          WHERE organization_unit_tenant_id <> (SELECT user_tenant_id FROM sys.sys_users WHERE user_email = $1)
          LIMIT 1`,
        ["federica.marchetti@rtl-bank.org"],
      );
      const row = r.rows[0];
      if (!row) throw new Error("fixture: no organization unit outside the actor tenant — test cannot falsify");
      foreignOuId = row.organization_unit_id;
    });

    async function create(code: string, parentId: string) {
      return suite.app.inject({
        method: "POST", url: "/v1/organization-units",
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
        payload: { code, name: code, parentId },
      });
    }

    it("CREATE under a parent from another tenant → 404 OU_PARENT_NOT_FOUND", async () => {
      const r = await create(`${SUITE_PREFIX}_XT_CREATE`, foreignOuId);
      expect(r.statusCode).toBe(404);
      expect((r.json() as { error: { code: string } }).error.code).toBe("OU_PARENT_NOT_FOUND");
    });

    it("PATCH onto a parent from another tenant → 404 OU_PARENT_NOT_FOUND", async () => {
      const own = await suite.app.inject({
        method: "POST", url: "/v1/organization-units",
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
        payload: { code: `${SUITE_PREFIX}_XT_PATCH`, name: "XT patch target" },
      });
      expect(own.statusCode).toBe(201);
      const id = (own.json() as { organizationUnitId: string }).organizationUnitId;
      createdIds.push(id);

      const r = await suite.app.inject({
        method: "PATCH", url: `/v1/organization-units/${id}`,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
        payload: { parentId: foreignOuId },
      });
      expect(r.statusCode).toBe(404);
      expect((r.json() as { error: { code: string } }).error.code).toBe("OU_PARENT_NOT_FOUND");

      // The rejected move must leave the row untouched — not half-written.
      const after = await suite.app.inject({
        method: "GET", url: `/v1/organization-units/${id}`,
        headers: { cookie: ch(tenantS.cookies) },
      });
      expect((after.json() as { parentId: string | null }).parentId).toBeNull();
    });

    it("CREATE under a parent that does not exist at all → 404, not a database error", async () => {
      const r = await create(`${SUITE_PREFIX}_XT_GHOST`, randomUUID());
      expect(r.statusCode).toBe(404);
      expect((r.json() as { error: { code: string } }).error.code).toBe("OU_PARENT_NOT_FOUND");
    });

    // Counter-proof: the guard must reject foreign parents, not every parent.
    it("CREATE under a parent in the same tenant still succeeds", async () => {
      const parent = await suite.app.inject({
        method: "POST", url: "/v1/organization-units",
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
        payload: { code: `${SUITE_PREFIX}_XT_OKPARENT`, name: "Legit parent" },
      });
      expect(parent.statusCode).toBe(201);
      const parentId = (parent.json() as { organizationUnitId: string }).organizationUnitId;
      createdIds.push(parentId);

      const r = await create(`${SUITE_PREFIX}_XT_OKCHILD`, parentId);
      expect(r.statusCode).toBe(201);
      const child = r.json() as { organizationUnitId: string; parentId: string | null };
      createdIds.push(child.organizationUnitId);
      expect(child.parentId).toBe(parentId);
    });

    it("PLATFORM_ADMIN gets a diagnostic 409, not a masked 404", async () => {
      const platformS = await login(suite, "admin@heuresys.com");
      const own = await suite.app.inject({
        method: "POST", url: "/v1/organization-units",
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
        payload: { code: `${SUITE_PREFIX}_XT_PLAT`, name: "Platform patch target" },
      });
      expect(own.statusCode).toBe(201);
      const id = (own.json() as { organizationUnitId: string }).organizationUnitId;
      createdIds.push(id);

      const r = await suite.app.inject({
        method: "PATCH", url: `/v1/organization-units/${id}`,
        headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
        payload: { parentId: foreignOuId },
      });
      expect(r.statusCode).toBe(409);
      expect((r.json() as { error: { code: string } }).error.code).toBe("OU_PARENT_TENANT_MISMATCH");
    });
  });

  // Il legame LINEA/STAFF esiste nel database dalla migrazione 000244 ed e' popolato su
  // ogni unita, ma nessun modulo API lo leggeva: lo ha misurato il cancello di esposizione
  // (#79). Questo test difende l'esposizione. L'atteso NON e' scritto qui: si legge dal
  // database e si confronta con cio' che l'API restituisce per la stessa unita — se un
  // giorno il campo sparisse dalla SELECT, il confronto fallirebbe invece di passare su
  // due `undefined`.
  it("LIST espone il legame LINEA/STAFF, e coincide con il database", async () => {
    const atteso = await pool.query<{ id: string; relation: string | null }>(
      `SELECT organization_unit_id AS id, organization_unit_relation AS relation
         FROM sys.sys_organization_units
        WHERE organization_unit_is_active AND organization_unit_relation IS NOT NULL
        ORDER BY organization_unit_relation DESC, organization_unit_code
        LIMIT 20`,
    );
    // universo dichiarato: se il database non ha righe col legame valorizzato, questa
    // verifica non puo' fallire e va detto invece di contarla fra quelle superate
    expect(atteso.rowCount, "nessuna unita col legame valorizzato: verifica cieca").toBeGreaterThan(0);
    // e deve esserci almeno un STAFF, altrimenti si sta confrontando un valore solo
    expect(atteso.rows.some((r) => r.relation === "STAFF")).toBe(true);

    const r = await suite.app.inject({
      method: "GET", url: "/v1/organization-units?limit=200",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: { organizationUnitId: string; relation: string | null }[] }).items;
    const perId = new Map(items.map((i) => [i.organizationUnitId, i.relation]));
    for (const riga of atteso.rows) {
      if (!perId.has(riga.id)) continue;   // fuori dal tenant dell'attore: non e' un difetto
      expect(perId.get(riga.id), `legame divergente per l'unita ${riga.id}`).toBe(riga.relation);
    }
  });

  it("USER cannot create (no permission)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/organization-units",
      headers: { cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_BLOCKED`, name: "X" },
    });
    expect(r.statusCode).toBe(403);
  });
});
