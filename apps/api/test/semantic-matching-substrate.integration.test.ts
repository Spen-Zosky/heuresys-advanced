/**
 * apps/api/test/semantic-matching-substrate.integration.test.ts
 *
 * D7-P0 (AI capability ② — semantic matching, P0 substrate). Asserts the pgvector
 * substrate shipped by migration 000060_pgvector_substrate.sql:
 *   - the `vector` extension is installed,
 *   - the 4 sidecar embedding tables exist, are queryable, and are EMPTY (P0 ships no data),
 *   - the matching:read / matching:admin permissions are seeded with the documented role grants.
 *
 * Hits the live OCI VM DB through the tunnel (no mocks) — consistent with the rest of the
 * integration suite. Boots buildTestApp() so the RBAC permission cache is loaded once (same
 * helper every module uses); the actual assertions run against the shared singleton pool.
 * This file owns the pool close (afterAll) so it can be the last file in the suite.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const EMBEDDING_TABLES = [
  "sys_skill_embeddings",
  "sys_esco_occupation_embeddings",
  "sys_job_role_embeddings",
  "sys_user_profile_embeddings",
] as const;

let suite: TestApp;

describe("D7-P0 pgvector semantic-matching substrate", () => {
  beforeAll(async () => {
    // Boots the app + loads the RBAC cache once (mirrors every other integration file).
    suite = await buildTestApp();
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("the 'vector' extension is installed (pg_extension)", async () => {
    const { rows } = await pool.query<{ extname: string; extversion: string }>(
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0]?.extname).toBe("vector");
  });

  it.each(EMBEDDING_TABLES)(
    "embedding table sys.%s exists, is queryable, and is empty (P0 ships no data)",
    async (table) => {
      // to_regclass returns NULL if the relation does not exist → asserts existence.
      const reg = await pool.query<{ reg: string | null }>(
        `SELECT to_regclass($1) AS reg`,
        [`sys.${table}`],
      );
      expect(reg.rows[0]?.reg).not.toBeNull();

      // Queryable + empty. (No string interpolation of user input; table is a static literal.)
      const cnt = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM sys.${table}`,
      );
      expect(cnt.rows[0]?.n).toBe(0);
    },
  );

  it("each embedding table carries a vector(1024) embedding column", async () => {
    // pgvector stores the dim in atttypmod (no -4 header offset for the vector type).
    const { rows } = await pool.query<{ table_name: string; dim: number }>(
      `SELECT c.relname AS table_name, a.atttypmod AS dim
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace ns ON ns.oid = c.relnamespace
         JOIN pg_type t ON t.oid = a.atttypid
        WHERE ns.nspname = 'sys'
          AND a.attname = 'embedding'
          AND t.typname = 'vector'
          AND c.relname = ANY($1::text[])`,
      [EMBEDDING_TABLES as unknown as string[]],
    );
    expect(rows.length).toBe(EMBEDDING_TABLES.length);
    for (const r of rows) {
      expect(r.dim).toBe(1024);
    }
  });

  it("an HNSW index exists on each embedding table", async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM pg_indexes
        WHERE schemaname = 'sys'
          AND tablename = ANY($1::text[])
          AND indexdef ILIKE '%USING hnsw%'`,
      [EMBEDDING_TABLES as unknown as string[]],
    );
    expect(rows[0]?.n).toBe(EMBEDDING_TABLES.length);
  });

  it("matching:read and matching:admin permissions are seeded", async () => {
    const { rows } = await pool.query<{ code: string }>(
      `SELECT auth_permission_code AS code
         FROM sys.sys_auth_permissions
        WHERE auth_permission_code IN ('matching:read', 'matching:admin')
        ORDER BY auth_permission_code`,
    );
    expect(rows.map((r) => r.code)).toEqual(["matching:admin", "matching:read"]);
  });

  it("matching:read is granted to the 6 analytics admin roles PLUS USER (7 total, incl. USER for ESS)", async () => {
    const { rows } = await pool.query<{ role: string }>(
      `SELECT r.auth_role_code AS role
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
         JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
        WHERE p.auth_permission_code = 'matching:read'
        ORDER BY r.auth_role_code`,
    );
    expect(rows.map((r) => r.role)).toEqual([
      "BLUEPRINT_MANAGER",
      "HRMS_MANAGER",
      "MANAGER",
      "PLATFORM_ADMIN",
      "PROCESS_OWNER",
      "TENANT_ADMIN",
      "USER",
    ]);
  });

  it("matching:admin is granted to platform + tenant admin only (2 total)", async () => {
    const { rows } = await pool.query<{ role: string }>(
      `SELECT r.auth_role_code AS role
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
         JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
        WHERE p.auth_permission_code = 'matching:admin'
        ORDER BY r.auth_role_code`,
    );
    expect(rows.map((r) => r.role)).toEqual(["PLATFORM_ADMIN", "TENANT_ADMIN"]);
  });
});
