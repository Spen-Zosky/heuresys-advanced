/**
 * apps/api/test/tenant-contracts.integration.test.ts
 * GET /v1/tenants/:id/contracts — la scheda «Contratti» del tenant (sola lettura, additiva).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

let suite: TestApp;
let cookie: string;

describe("/v1/tenants/:id/contracts", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "platform-test-admin@collaudo.invalid", TEST_PERSONA_PASSWORD);
    cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  });
  afterAll(async () => { await suite.app.close(); await closePool(); });

  it("senza accesso → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/tenants/${randomUUID()}/contracts` });
    expect(r.statusCode).toBe(401);
  });

  it("tenant inesistente → 404", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/tenants/${randomUUID()}/contracts`, headers: { cookie } });
    expect(r.statusCode).toBe(404);
  });

  it("un tenant esistente → forma completa e conteggi coerenti con i livelli", async () => {
    const t = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies ORDER BY tenant_code LIMIT 1`);
    const r = await suite.app.inject({ method: "GET", url: `/v1/tenants/${t.rows[0]!.tenant_id}/contracts`, headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { contracts: { levels: { annualMinimumEur: string | null }[]; gapLevelCodes: string[] }[]; summary: Record<string, number> };
    expect(['ACTIVE', 'OTHER_VERSION']).toContain((b as unknown as { source: { kind: string } }).source.kind);
    expect(b.summary.contracts).toBe(b.contracts.length);
    expect(b.summary.levels).toBe(b.contracts.reduce((s, c) => s + c.levels.length, 0));
    expect(b.summary.levelsWithoutMinimum).toBe(b.contracts.reduce((s, c) => s + c.levels.filter((l) => l.annualMinimumEur === null).length, 0));
  });

  it("senza contratti nella versione attiva, il tenant mostra quelli della versione della sua corsa, con la provenienza", async () => {
    const cod = `T_CONTR_${randomUUID().slice(0, 8)}`;
    const ind = await pool.query<{ c: string }>(`SELECT tenant_industry_code AS c FROM sys.sys_tenancies WHERE tenant_industry_code IS NOT NULL LIMIT 1`);
    const ten = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status, tenant_industry_code)
       VALUES ($1, 'Prova contratti', 'ACTIVE', $2) RETURNING tenant_id AS id`, [cod, ind.rows[0]!.c]);
    const tenantId = ten.rows[0]!.id;
    const fam = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name, blueprint_family_description)
       VALUES ($1, 'Prova contratti', 'Prova') RETURNING blueprint_family_id AS id`, [cod]);
    try {
      const mkVer = async (codice: string) => {
        const v = await pool.query<{ id: string }>(
          `INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name, blueprint_variant_description)
           VALUES ($1, $2, 'Prova', 'Prova') RETURNING blueprint_variant_id AS id`, [fam.rows[0]!.id, `${cod}_${codice}`]);
        const ver = await pool.query<{ id: string }>(
          `INSERT INTO sys.sys_blueprint_variant_versions (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
           VALUES ($1, 1, 'DRAFT') RETURNING blueprint_variant_version_id AS id`, [v.rows[0]!.id]);
        return { variante: v.rows[0]!.id, versione: ver.rows[0]!.id };
      };
      const attiva = await mkVer("ATTIVA");
      const altra = await mkVer("ALTRA");
      await pool.query(
        `INSERT INTO sys.sys_blueprint_activations (blueprint_activation_tenant_id, blueprint_activation_variant_id, blueprint_activation_variant_version_id, blueprint_activation_status)
         VALUES ($1, $2, $3, 'ACTIVE')`, [tenantId, attiva.variante, attiva.versione]);
      await pool.query(
        `INSERT INTO sys.sys_blueprint_content_ccnl (blueprint_content_ccnl_version_id, blueprint_content_ccnl_code, blueprint_content_ccnl_name)
         VALUES ($1, 'CCNL_X', 'Contratto di prova')`, [altra.versione]);
      await pool.query(
        `INSERT INTO sys.sys_blueprint_content_ccnl_levels (blueprint_content_ccnl_level_version_id, blueprint_content_ccnl_level_ccnl_code,
           blueprint_content_ccnl_level_code, blueprint_content_ccnl_level_name, blueprint_content_ccnl_level_annual_minimum_eur)
         VALUES ($1, 'CCNL_X', 'CCNL_X_L1', 'Livello 1', 30000)`, [altra.versione]);
      await pool.query(
        `INSERT INTO sys.sys_blueprint_runs (blueprint_run_tenant_id, blueprint_run_code, blueprint_run_package_version, blueprint_run_package_hash,
           blueprint_run_variant_version_id, blueprint_run_model_label, blueprint_run_model_loaded_at)
         VALUES ($1, 'R1', 1, 'h', $2, 'Prova', now())`, [tenantId, altra.versione]);
      const r = await suite.app.inject({ method: "GET", url: `/v1/tenants/${tenantId}/contracts`, headers: { cookie } });
      expect(r.statusCode).toBe(200);
      const b = r.json() as { source: { kind: string }; contracts: { levels: unknown[] }[] };
      expect(b.source.kind).toBe("OTHER_VERSION");
      expect(b.contracts).toHaveLength(1);
      expect(b.contracts[0]!.levels).toHaveLength(1);
    } finally {
      await pool.query(`DELETE FROM sys.sys_tenancies WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [fam.rows[0]!.id]);
    }
  });
});
