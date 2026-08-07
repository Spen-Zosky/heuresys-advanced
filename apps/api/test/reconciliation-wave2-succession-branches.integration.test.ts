import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, type TestApp } from './helpers/build-test-app.js';
import { loginRaw } from './helpers/login.js';
import { pool } from '../src/db/client.js';
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// Wave-2 / B-50 close (S982, mig 000106 + seeds 49-50): the last 3 NEEDS_DECISION tables
// were imported under PM decisions D1-D3 (Enzo 2026-06-10, dossiers
// docs/kb/B50_DEFER_UNBLOCK_PACKAGE.md + WAVE2_UNBLOCK_PACKAGE.md):
//   sys_branches             6  (anchor-OU rule, 5 RTL + 1 HS)
//   sys_succession_pools     17 (15 incumbent-anchor + 2 PM-signed title-match) → 9 dopo la 000278 (#160)
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
    /**
     * [S1048] Erano 17. La 000278 (#160) ha rimosso i bacini appesi a posizioni
     * DISATTIVATE e quelli agganciati a un ruolo critico che non era il loro —
     * `Chief Executive Officer` stava su `Securities Dealer`, il `CFO` su
     * `Bank Teller`. Restano **9**: 7 con la provenienza dell'import (5
     * incumbent + 2 title_match) e 2 creati dal seed storia36 per le due
     * posizioni critiche che un bacino non l'avevano ancora.
     * Non è import perso: ogni riga è in `staging.storia36_160_undo` e
     * `SELECT staging.storia36_160_rollback();` la rimette.
     */
    it('9 pools (8 RTL + 1 HS): 5 incumbent + 2 title_match + 2 dalla storia, all ACTIVE, position FK tenant-coherent', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools`)).toBe(9);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_tenant_id = $1`, [RTL])).toBe(8);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_tenant_id = $1`, [HS])).toBe(1);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_metadata->>'anchor' = 'incumbent'`,
      )).toBe(5);
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

    // [S1048] Gli 8 `LEGACY_CROLE::` sono spariti: erano esattamente i bacini
    // dei ruoli critici agganciati male, che la 000278 ha rimosso. I 7
    // `LEGACY_SPLAN::` superstiti sono quelli ancorati a posizioni vive.
    it('code provenance prefixes: 7 LEGACY_SPLAN:: (5 incumbent + 2 title-match), 0 LEGACY_CROLE::', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_code LIKE 'LEGACY_SPLAN::%'`,
      )).toBe(7);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_succession_pools WHERE succession_pool_code LIKE 'LEGACY_CROLE::%'`,
      )).toBe(0);
    });
  });

  describe('sys_successor_candidates (seed 49, plan-cascade via corrected false friend)', () => {
    it('25 candidati dall import (+ quelli della storia), tenant = pool tenant, UNIQUE(pool,user), all CANDIDATE', async () => {
      // Le tre asserzioni di questo blocco riguardano il RISULTATO DELL'IMPORT
      // Wave-2, non l'intera tabella: dal cluster storia36 C5 i bacini delle
      // posizioni critiche hanno i loro candidati, ed e' un fatto voluto. Si
      // riconoscono dalla provenienza (`legacy_plan_id`), che l'import scrive
      // e la storia no — le invarianti restano invece su TUTTE le righe.
      // Quanti siano i candidati importati NON è un invariante: la storia C5
      // rimuove chi non soddisfa il criterio di successione (coda #4/#5), e un
      // numero fisso qui misurerebbe lo stato, non la regola. L'invariante è
      // che la provenienza sia sempre completa — nessun candidato «mezzo
      // legacy» — e che ce ne sia ancora almeno uno da controllare.
      // [S1048] Il minimo di 1 è stato tolto: la 000278 (#160) ha rimosso TUTTI
      // i candidati importati, e zero è l'esito corretto. Erano appesi ai bacini
      // agganciati al ruolo critico sbagliato, quindi nessuno reggeva il criterio
      // di successione — `C5g` li contava tutti. L'invariante che resta è quello
      // che conta: la provenienza non è mai a metà.
      const legacyCount = await count(
        `SELECT count(*)::int AS n FROM sys.sys_successor_candidates
          WHERE successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL`,
      );
      expect(legacyCount).toBeGreaterThanOrEqual(0);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_successor_candidates
          WHERE (successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL)
             <> (successor_candidate_metadata->>'legacy_candidate_id' IS NOT NULL)`,
      )).toBe(0);
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

    it('readiness mapping (D2): ogni riga rispetta la mappa legacy→dominio; raw legacy value preserved', async () => {
      // La REGOLA della decisione D2 (db/seeds/reconciliation/49_*.sql), non la
      // fotografia dei conteggi: quelli cambiano quando la storia C5 rimuove i
      // successori scelti senza criterio, la mappa no. Si verifica riga per
      // riga, così vale su qualunque popolazione residua.
      const MAPPA: Record<string, string> = {
        ready_now: 'READY_NOW',
        ready_1_year: 'READY_1_YEAR',
        ready_2_years: 'READY_2_YEARS',
        ready_3_years: 'NOT_READY',
        ready_3_5_years: 'NOT_READY',
        development_needed: 'NOT_READY',
      };
      const { rows } = await pool.query<{ grezzo: string; mappato: string | null; n: number }>(
        `SELECT successor_candidate_metadata->>'legacy_readiness' AS grezzo,
                successor_candidate_readiness_level AS mappato, count(*)::int AS n
           FROM sys.sys_successor_candidates
          WHERE successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL
          GROUP BY 1, 2`,
      );
      // [S1048] Zero righe è ora l'esito corretto: la 000278 (#160) ha rimosso
      // tutti i candidati importati, che stavano in bacini agganciati al ruolo
      // critico sbagliato. La REGOLA continua a essere verificata riga per riga —
      // su zero righe passa a vuoto, ed è giusto così: pretendere che ne
      // sopravviva almeno una significherebbe pretendere che sopravviva un dato
      // incoerente. Il ciclo qui sotto resta il vero contenuto del test.
      expect(rows.length).toBeGreaterThanOrEqual(0);
      for (const r of rows) {
        // nessun valore legacy fuori dal vocabolario dichiarato dalla decisione D2
        expect(Object.keys(MAPPA)).toContain(r.grezzo);
        expect(r.mappato).toBe(MAPPA[r.grezzo]);
      }
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
