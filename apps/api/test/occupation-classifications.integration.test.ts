/**
 * apps/api/test/occupation-classifications.integration.test.ts
 *
 * Module: occupation-classifications (global ISCO-08 + CP2021 catalog, no tenant
 * — asse PROFESSIONE, mig 000206-000208). Visibility model (service.ts): read for
 * anyone holding `occupation_classification:read` (audience = enterprise_typing:read);
 * write (POST/PATCH/DELETE) is PLATFORM_ADMIN only (route permission audience =
 * tenant:create + service isPlatform). Unique natural key (scheme, code).
 * i18n ADR-0029: name IT-canonical in-row + EN overlay via x-locale — expectations
 * are DERIVED from the live DB (sys_reference_translations), never hardcoded.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_OC_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
const createdIds: string[] = [];

describe("/v1/occupation-classifications/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM sys.sys_occupation_classifications WHERE occupation_classification_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/occupation-classifications" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST ?scheme=ISCO_08 → total matches live DB count, all rows ISCO_08", async () => {
    const db = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_occupation_classifications WHERE occupation_classification_scheme = 'ISCO_08'`,
    );
    const expected = Number(db.rows[0]!.n);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/occupation-classifications?scheme=ISCO_08&limit=20",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { scheme: string }[]; total: number };
    expect(body.total).toBe(expected);
    expect(expected).toBeGreaterThan(0); // seed loaded (populate-occupation-classifications)
    expect(body.items.every((i) => i.scheme === "ISCO_08")).toBe(true);
  });

  it("LIST as TENANT_ADMIN (read audience is broad) → 200", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/occupation-classifications?scheme=CP_2021&limit=5",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    const db = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_occupation_classifications WHERE occupation_classification_scheme = 'CP_2021'`,
    );
    expect(body.total).toBe(Number(db.rows[0]!.n));
  });

  it("tree navigation: parentCode filter returns exactly the DB children set", async () => {
    // pick the first ISCO root (level 1) live from the DB
    const root = await pool.query<{ code: string }>(
      `SELECT occupation_classification_code AS code FROM sys.sys_occupation_classifications
        WHERE occupation_classification_scheme = 'ISCO_08' AND occupation_classification_parent_code IS NULL
        ORDER BY occupation_classification_code LIMIT 1`,
    );
    const rootCode = root.rows[0]!.code;
    const children = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_occupation_classifications
        WHERE occupation_classification_scheme = 'ISCO_08' AND occupation_classification_parent_code = $1`,
      [rootCode],
    );
    const r = await suite.app.inject({
      method: "GET", url: `/v1/occupation-classifications?scheme=ISCO_08&parentCode=${rootCode}&limit=500`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { parentCode: string | null }[]; total: number };
    expect(body.total).toBe(Number(children.rows[0]!.n));
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((i) => i.parentCode === rootCode)).toBe(true);
  });

  it("i18n: x-locale=en swaps name to the EN overlay; default stays IT in-row (expected derived from DB)", async () => {
    // derive a row whose EN overlay differs from the IT in-row name
    const probe = await pool.query<{ id: string; name_it: string; name_en: string }>(
      `SELECT o.occupation_classification_id AS id,
              o.occupation_classification_name AS name_it, t.text AS name_en
         FROM sys.sys_occupation_classifications o
         JOIN sys.sys_reference_translations t
           ON t.entity_table = 'sys_occupation_classifications'
          AND t.entity_id = o.occupation_classification_id
          AND t.field = 'name' AND t.locale = 'en'
        WHERE t.text <> o.occupation_classification_name
        ORDER BY o.occupation_classification_scheme, o.occupation_classification_code
        LIMIT 1`,
    );
    expect(probe.rows.length).toBe(1); // overlay EN loaded
    const { id, name_it, name_en } = probe.rows[0]!;

    const rIt = await suite.app.inject({
      method: "GET", url: `/v1/occupation-classifications/${id}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(rIt.statusCode).toBe(200);
    expect((rIt.json() as { name: string }).name).toBe(name_it);

    const rEn = await suite.app.inject({
      method: "GET", url: `/v1/occupation-classifications/${id}`,
      headers: { cookie: ch(platformS.cookies), "x-locale": "en" },
    });
    expect(rEn.statusCode).toBe(200);
    expect((rEn.json() as { name: string }).name).toBe(name_en);
  });

  it("CREATE then GET /:id as PLATFORM_ADMIN happy path; duplicate → 409", async () => {
    const code = `${SUITE_PREFIX}HP`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/occupation-classifications",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "ISCO_08", code, name: "Classificazione di prova" },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as { occupationClassificationId: string; code: string; scheme: string };
    expect(c.code).toBe(code);
    expect(c.scheme).toBe("ISCO_08");
    createdIds.push(c.occupationClassificationId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/occupation-classifications/${c.occupationClassificationId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/occupation-classifications",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "ISCO_08", code, name: "Duplicato" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("OCCUPATION_CLASSIFICATION_CONFLICT");
  });

  it("CREATE as TENANT_ADMIN → 403 (write audience is PLATFORM_ADMIN-only)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/occupation-classifications",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "CP_2021", code: `${SUITE_PREFIX}TA`, name: "Non consentito" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("PATCH then DELETE as PLATFORM_ADMIN; GET after delete → 404", async () => {
    const code = `${SUITE_PREFIX}PD`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/occupation-classifications",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "CP_2021", code, name: "Da aggiornare", level: 5 },
    });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as { occupationClassificationId: string }).occupationClassificationId;
    createdIds.push(id);

    const patched = await suite.app.inject({
      method: "PATCH", url: `/v1/occupation-classifications/${id}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { name: "Aggiornata", description: "descrizione di prova" },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as { name: string; description: string }).name).toBe("Aggiornata");

    const deleted = await suite.app.inject({
      method: "DELETE", url: `/v1/occupation-classifications/${id}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(deleted.statusCode).toBe(204);

    const gone = await suite.app.inject({
      method: "GET", url: `/v1/occupation-classifications/${id}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(gone.statusCode).toBe(404);
  });
});
