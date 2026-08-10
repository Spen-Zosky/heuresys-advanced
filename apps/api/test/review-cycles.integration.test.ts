/**
 * apps/api/test/review-cycles.integration.test.ts — #92 passo 3/7.
 * Il catalogo dei cicli oggi e' VUOTO per costruzione (i cicli legacy erano
 * 'Test Auth Cycle' in draft, decisi da non importare): la lista vuota e' un
 * empty-state REALE, e il test lo fissa come tale — total deriva dal DB,
 * mai scritto a mano.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const HR_EMAIL = "federica.marchetti@rtl-bank.org";

let t: TestApp;
let hrCookie = "";
let plainCookie = "";
let dbTotal = 0;

async function cookieOf(email: string): Promise<string> {
  const r = await loginRaw(t.app, email);
  return r.cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ");
}

beforeAll(async () => {
  t = await buildTestApp();
  hrCookie = await cookieOf(HR_EMAIL);
  // Un utente autenticabile SENZA i ruoli che detengono performance-review:read
  // (derivato, mai fissato): per lui la superficie manageriale e' FORBIDDEN.
  const { rows } = await pool.query<{ email: string }>(
    `SELECT u.user_email AS email FROM sys.sys_users u
      WHERE EXISTS (SELECT 1 FROM sys.sys_auth_identities i
                     JOIN sys.sys_auth_credentials c ON c.auth_credential_identity_id = i.auth_identity_id
                    WHERE i.auth_identity_user_id = u.user_id AND i.auth_identity_is_active)
        AND EXISTS (SELECT 1 FROM sys.sys_auth_mfa_factors f WHERE f.auth_mfa_factor_user_id = u.user_id)
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles ur
            JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
            JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
           WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
             AND p.auth_permission_code = 'performance-review:read')
      ORDER BY u.user_email LIMIT 1`,
  );
  if (!rows[0]) throw new Error("nessun utente senza performance-review:read: verifica cieca");
  plainCookie = await cookieOf(rows[0].email);
  dbTotal = Number((await pool.query(`SELECT count(*)::int AS n FROM sys.sys_review_cycles`)).rows[0]!.n);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#92 passo 3/7 — /v1/review-cycles", () => {
  it("l'HR legge il catalogo: il totale e' quello del DB (oggi un empty-state reale)", async () => {
    const res = await t.app.inject({ method: "GET", url: "/v1/review-cycles/", headers: { cookie: hrCookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(dbTotal);
    expect(body.items.length).toBe(Math.min(dbTotal, 50));
  });

  it("senza performance-review:read la superficie e' FORBIDDEN", async () => {
    const res = await t.app.inject({ method: "GET", url: "/v1/review-cycles/", headers: { cookie: plainCookie } });
    expect(res.statusCode).toBe(403);
    expect((res.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("un ciclo inesistente risponde 404, non 500", async () => {
    const res = await t.app.inject({
      method: "GET", url: "/v1/review-cycles/00000000-0000-4000-8000-000000000000",
      headers: { cookie: hrCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
