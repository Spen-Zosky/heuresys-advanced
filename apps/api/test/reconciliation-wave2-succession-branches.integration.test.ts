import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, type TestApp } from './helpers/build-test-app.js';
import { loginRaw } from './helpers/login.js';
import { pool } from '../src/db/client.js';
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// Wave-2 / B-50 close (S982, mig 000106 + seeds 49-50): the last 3 NEEDS_DECISION tables
// were imported under PM decisions D1-D3 (Enzo 2026-06-10, dossiers
// docs/kb/B50_DEFER_UNBLOCK_PACKAGE.md + WAVE2_UNBLOCK_PACKAGE.md):
//   sys_branches             6  (anchor-OU rule, 5 RTL + 1 HS)
//   sys_succession_pools     17 (15 incumbent-anchor + 2 PM-signed title-match)
//   sys_successor_candidates 25 (24 RTL + 1 HS; plan-cascade via the corrected false friend)
// Hits the live DB (no mocks). Pool shared across the suite — NOT closed here.

const RTL = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
const HS = '8bc5bc59-f2d2-4a8a-882a-ea26ac367858';

const count = async (sql: string, params: unknown[] = []): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql, params);
  return rows[0]?.n ?? -1;
};

describe('reconciliation Wave-2 close — branches + succession (S982)', () => {
  describe('sys_branches (seed 50, D1=anchor-OU)', () => {
    it('6 branches (5 RTL + 1 HS), 6 distinct anchor OUs, tenant-coherent, country IT', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_branches`)).toBe(6);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_branches WHERE branch_tenant_id = $1`, [RTL])).toBe(5);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_branches WHERE branch_tenant_id = $1`, [HS])).toBe(1);
      expect(await count(`SELECT count(DISTINCT branch_organization_unit_id)::int AS n FROM sys.sys_branches`)).toBe(6);
      // anchor OU belongs to the branch tenant (I5 coherence)
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_branches b
           JOIN sys.sys_organization_units ou ON ou.organization_unit_id = b.branch_organization_unit_id
          WHERE ou.organization_unit_tenant_id <> b.branch_tenant_id`,
      )).toBe(0);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_branches WHERE branch_country_code <> 'IT'`)).toBe(0);
    });

    it('full provenance: legacy_location_id + anchor rule + name on every row', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_branches
          WHERE branch_metadata->>'legacy_location_id' IS NULL
             OR branch_metadata->>'name' IS NULL
             OR branch_metadata->>'anchor_rule' IS NULL`,
      )).toBe(0);
    });
  });

  describe('sys_succession_pools (seed 49, D2=incumbent-anchor + title-match)', () => {
    it('17 pools (16 RTL + 1 HS): 15 incumbent + 2 title_match, all ACTIVE, position FK tenant-coherent', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools`)).toBe(17);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_tenant_id = $1`, [RTL])).toBe(16);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_tenant_id = $1`, [HS])).toBe(1);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_metadata->>'anchor' = 'incumbent'`,
      )).toBe(15);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_metadata->>'anchor' = 'title_match'`,
      )).toBe(2);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_status <> 'ACTIVE'`,
      )).toBe(0);
      // pool position belongs to the pool tenant (I5)
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_succession_pools sp
           JOIN sys.sys_positions p ON p.position_id = sp.succession_pool_position_id
          WHERE p.position_tenant_id <> sp.succession_pool_tenant_id`,
      )).toBe(0);
    });

    it('code provenance prefixes: 9 LEGACY_SPLAN:: (7 incumbent + 2 title-match) + 8 LEGACY_CROLE::', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_code LIKE 'LEGACY_SPLAN::%'`,
      )).toBe(9);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_code LIKE 'LEGACY_CROLE::%'`,
      )).toBe(8);
    });
  });

  describe('sys_successor_candidates (seed 49, plan-cascade via corrected false friend)', () => {
    it('25 candidati dall import (+ quelli della storia), tenant = pool tenant, UNIQUE(pool,user), all CANDIDATE', async () => {
      // Le tre asserzioni di questo blocco riguardano il RISULTATO DELL'IMPORT
      // Wave-2, non l'intera tabella: dal cluster storia36 C5 i bacini delle
      // posizioni critiche hanno i loro candidati, ed e' un fatto voluto. Si
      // riconoscono dalla provenienza (`legacy_plan_id`), che l'import scrive
      // e la storia no — le invarianti restano invece su TUTTE le righe.
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_successor_candidates
          WHERE successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL`,
      )).toBe(25);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_successor_candidates c
           JOIN sys.sys_succession_pools sp ON sp.succession_pool_id = c.successor_candidate_pool_id
          WHERE sp.succession_pool_tenant_id <> c.successor_candidate_tenant_id`,
      )).toBe(0);
      expect(await count(
        `SELECT (count(*) - count(DISTINCT (successor_candidate_pool_id, successor_candidate_user_id)))::int AS n
           FROM sys.sys_successor_candidates`,
      )).toBe(0);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_successor_candidates WHERE successor_candidate_status <> 'CANDIDATE'`,
      )).toBe(0);
    });

    it('readiness mapping (D2): READY_1_YEAR=6, READY_2_YEARS=6, NOT_READY=13; raw legacy value preserved', async () => {
      const { rows } = await pool.query<{ readiness: string | null; n: number }>(
        `SELECT successor_candidate_readiness_level AS readiness, count(*)::int AS n
           FROM sys.sys_successor_candidates
          WHERE successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL GROUP BY 1`,
      );
      const m = Object.fromEntries(rows.map((r) => [r.readiness ?? 'NULL', r.n]));
      expect(m).toEqual({ READY_1_YEAR: 6, READY_2_YEARS: 6, NOT_READY: 13 });
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_successor_candidates
          WHERE successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL
            AND (successor_candidate_metadata->>'legacy_readiness' IS NULL
              OR successor_candidate_metadata->>'legacy_employee_id' IS NULL)`,
      )).toBe(0);
    });

    it('only LEGACY_SPLAN:: pools carry candidates (legacy candidates link plans, not critical_roles)', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_successor_candidates c
           JOIN sys.sys_succession_pools sp ON sp.succession_pool_id = c.successor_candidate_pool_id
          WHERE c.successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL
            AND sp.succession_pool_code NOT LIKE 'LEGACY_SPLAN::%'`,
      )).toBe(0);
    });
  });

  describe('API serialization smoke (zod lesson of mig 000096)', () => {
    let suite: TestApp;
    let cookieHeader: string;

    beforeAll(async () => {
      suite = await buildTestApp();
      // S984: dual-mode login (raw single-step broke at fixture-seed time —
      // step-1 returns 200 mfa_required with NO cookies once the persona has
      // a verified factor, policy-independent).
      const r = await loginRaw(suite.app, 'federica.marchetti@rtl-bank.org', TEST_PERSONA_PASSWORD);
      cookieHeader = r.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    });

    afterAll(async () => {
      await suite.app.close();
    });

    it('GET /v1/succession-pools and /v1/successor-candidates serialize the imported rows (200)', async () => {
      const pools = await suite.app.inject({
        method: 'GET', url: '/v1/succession-pools', headers: { cookie: cookieHeader },
      });
      expect(pools.statusCode).toBe(200);
      const cands = await suite.app.inject({
        method: 'GET', url: '/v1/successor-candidates', headers: { cookie: cookieHeader },
      });
      expect(cands.statusCode).toBe(200);
    });
  });
});
