import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// D4 / Wall W2 — org-unit TEMPLATE layer (Option A). Hits the live DB (no mocks).
// Validates migration 000064 (new tenant-less sys_organization_unit_templates + dual-mode XOR FK on
// sys_organization_unit_kpi_templates) + seed 40 (225 templates + 100 KPI templates). Measured live
// S961 against the OCI VM DB via the tunnel:
//   - sys_organization_unit_templates: 225 (9 blueprints x 25 codes), GLOBAL / tenant-less, 216 parents set.
//   - sys_organization_unit_kpi_templates: 100 (was 0) — blueprint-keyed, all unit_template_id + kpi_id
//     resolved 100/100; unit_id NULL, tenant_id NULL (XOR satisfied; I5 no leak).
//   - regression: 26 instance org units / 162 positions / 24 teams unchanged.

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation D4 — org-unit KPI template layer (W2)', () => {
  describe('sys_organization_unit_templates (the new tenant-less taxonomy, 225)', () => {
    it('imported exactly 225 templates = 9 blueprints x 25 codes', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_organization_unit_templates`)).toBe(225);
      expect(await count(
        `SELECT count(DISTINCT organization_unit_template_blueprint_id)::int AS n
           FROM sys.sys_organization_unit_templates`,
      )).toBe(9);
      expect(await count(
        `SELECT count(DISTINCT organization_unit_template_code)::int AS n
           FROM sys.sys_organization_unit_templates`,
      )).toBe(25);
    });

    it('is GLOBAL / tenant-less (no tenant column at all — like sys_organization_unit_types, I5)', async () => {
      // the taxonomy carries no tenant column: the template layer is blueprint reference data outside
      // the middleware tenant filter. Asserting the structural absence of any *tenant* column.
      expect(await count(
        `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_schema = 'sys' AND table_name = 'sys_organization_unit_templates'
            AND column_name ILIKE '%tenant%'`,
      )).toBe(0);
    });

    it('the self-parent hierarchy resolved (216 children, 9 blueprint roots NULL, all parents valid)', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_templates
          WHERE organization_unit_template_parent_id IS NOT NULL`,
      )).toBe(216);
      // every set parent points at a real template row in the same blueprint group
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_templates c
          WHERE c.organization_unit_template_parent_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM sys.sys_organization_unit_templates p
               WHERE p.organization_unit_template_id = c.organization_unit_template_parent_id
                 AND p.organization_unit_template_blueprint_id = c.organization_unit_template_blueprint_id)`,
      )).toBe(0);
    });
  });

  describe('sys_organization_unit_kpi_templates unblocked (was 0) — 100, blueprint-keyed', () => {
    it('imported exactly 100 KPI templates, all resolving unit_template_id + kpi_id (100/100)', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_organization_unit_kpi_templates`)).toBe(100);
      // unit_template_id resolves to a real template + kpi_id resolves to a real KPI definition
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_kpi_templates k
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_organization_unit_templates t
                             WHERE t.organization_unit_template_id = k.organization_unit_kpi_template_unit_template_id)
             OR NOT EXISTS (SELECT 1 FROM sys.sys_kpi_definitions d
                             WHERE d.kpi_definition_id = k.organization_unit_kpi_template_kpi_id)`,
      )).toBe(0);
      // all 100 carry a non-null unit_template_id + kpi_id
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_kpi_templates
          WHERE organization_unit_kpi_template_unit_template_id IS NOT NULL
            AND organization_unit_kpi_template_kpi_id IS NOT NULL`,
      )).toBe(100);
    });

    it('every row is blueprint-keyed with the XOR satisfied (unit_id NULL, never both/neither)', async () => {
      // XOR: exactly one of {unit_id, unit_template_id} non-null. All 100 are template-keyed.
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_kpi_templates
          WHERE (organization_unit_kpi_template_unit_id IS NOT NULL)
                = (organization_unit_kpi_template_unit_template_id IS NOT NULL)`,
      )).toBe(0);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_kpi_templates
          WHERE organization_unit_kpi_template_unit_id IS NULL
            AND organization_unit_kpi_template_unit_template_id IS NOT NULL`,
      )).toBe(100);
    });

    it('I5 no-leak: blueprint KPI templates are tenant-less (tenant_id NULL), not bound to any tenant', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_kpi_templates
          WHERE organization_unit_kpi_template_tenant_id IS NULL`,
      )).toBe(100);
      // and none accidentally references an instance org unit (would be a tenant leak)
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_kpi_templates
          WHERE organization_unit_kpi_template_unit_id IS NOT NULL`,
      )).toBe(0);
    });

    it('weight defaults to 1.000 and the target jsonb carries the legacy direction', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_kpi_templates
          WHERE organization_unit_kpi_template_weight = 1.000`,
      )).toBe(100);
      // every target jsonb has a 'direction' derived from legacy target_direction (NOT NULL in source)
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_organization_unit_kpi_templates
          WHERE organization_unit_kpi_template_target ? 'direction'`,
      )).toBe(100);
    });
  });

  describe('regression — the instance org model is untouched', () => {
    it('26 instance org units / 162 positions / 24 teams unchanged', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_organization_units`)).toBe(26);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_positions`)).toBe(162);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_teams`)).toBe(24);
    });
  });

  it('the 2 W2 targets read POPULATED and 0 UNCLASSIFIED across the registry', async () => {
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name IN ('sys_organization_unit_templates','sys_organization_unit_kpi_templates')
          AND resolved_status = 'POPULATED'`,
    )).toBe(2);
    // the cardinal reconciliation invariant: zero UNCLASSIFIED sys tables.
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED'`,
    )).toBe(0);
  });
});
