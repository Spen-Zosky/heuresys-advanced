/**
 * apps/api/test/rbac-tenant-admin-allowlist.test.ts — D-57 regression guard.
 *
 * 000005 grants TENANT_ADMIN every permission via CROSS JOIN ("everything minus
 * 7"): any future permission was silently absorbed on the next db:migrate.
 * 000210 inverted this into an explicit deny-by-default allowlist.
 *
 * Guard invariant (derived from the real sources — the migration files and the
 * live grant table — never from a hardcoded list that would drift):
 *
 *   live TENANT_ADMIN audience == allowlist(000210)
 *                                 ∪ codes under a `TENANT_ADMIN-ALLOWLIST-EXTEND`
 *                                   marker in any migration AFTER 000210.
 *
 * A new permission reaching TENANT_ADMIN without the explicit marker (i.e. via
 * the 000005 blanket) makes this test fail — the silent-absorption trap D-57
 * described cannot reopen unnoticed.
 */

import { describe, it, expect, afterAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pool, closePool } from "../src/db/client.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
const ALLOWLIST_FILE = "000210_tenant_admin_permission_allowlist.sql";
const EXTEND_MARKER = "TENANT_ADMIN-ALLOWLIST-EXTEND";
/** `    ('permission:code'),` — the VALUES row format of 000210 and its
 *  extensions (the last row closes the statement with `;`). */
const CODE_ROW = /^\s*\('([a-z0-9_:]+)'\)[,;]?\s*$/;

function codesFromValuesRows(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const m = CODE_ROW.exec(line);
    if (m?.[1]) out.push(m[1]);
  }
  return out;
}

function expectedAllowlist(): Set<string> {
  const base = readFileSync(join(MIGRATIONS_DIR, ALLOWLIST_FILE), "utf8");
  const expected = new Set(codesFromValuesRows(base));
  expect(expected.size).toBeGreaterThan(100); // sanity: the frozen list parsed

  // Extensions: migrations after 000210 carrying the explicit marker.
  for (const f of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!f.endsWith(".sql") || f <= ALLOWLIST_FILE || f === ALLOWLIST_FILE) continue;
    const text = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    const at = text.indexOf(EXTEND_MARKER);
    if (at === -1) continue;
    for (const code of codesFromValuesRows(text.slice(at))) expected.add(code);
  }
  return expected;
}

describe("TENANT_ADMIN allowlist (D-57 deny-by-default)", () => {
  afterAll(async () => {
    await closePool();
  });

  it("live TENANT_ADMIN audience equals the explicit allowlist (no silent absorption)", async () => {
    const expected = expectedAllowlist();
    const res = await pool.query<{ code: string }>(
      `SELECT p.auth_permission_code AS code
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE r.auth_role_code = 'TENANT_ADMIN'`,
    );
    const live = new Set(res.rows.map((r) => r.code));

    const absorbed = [...live].filter((c) => !expected.has(c)).sort();
    const missing = [...expected].filter((c) => !live.has(c)).sort();
    // Explicit lists in the assertion message: a failure names the exact codes.
    expect(absorbed, `permessi assorbiti da TENANT_ADMIN fuori allowlist (aggiungi il marker ${EXTEND_MARKER} se voluto)`).toEqual([]);
    expect(missing, "codici in allowlist non concessi live (grant perso?)").toEqual([]);
  });

  it("every permission NOT in the allowlist is truly unheld (deny-by-default is real)", async () => {
    const expected = expectedAllowlist();
    const res = await pool.query<{ code: string }>(
      `SELECT p.auth_permission_code AS code
         FROM sys.sys_auth_permissions p
        WHERE NOT EXISTS (
          SELECT 1 FROM sys.sys_auth_role_permissions rp
            JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
           WHERE r.auth_role_code = 'TENANT_ADMIN'
             AND rp.auth_permission_id = p.auth_permission_id
        )`,
    );
    for (const { code } of res.rows) {
      expect(expected.has(code), `${code} è negato live ma compare in allowlist`).toBe(false);
    }
  });
});
