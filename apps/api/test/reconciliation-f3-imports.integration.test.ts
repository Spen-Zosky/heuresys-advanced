import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F3 of the reconciliation-closure cycle: bridgeable imports across the job->position wall.
// Hits the live DB (no mocks). #1 + #2 imported; #3 (successor_candidates) was BLOCKED by a
// NOT NULL pool_id FK to the then-empty sys_succession_pools — unblocked by the Wave-2 close
// (S982, mig 000106 + seed 49: incumbent-anchor pools import).

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation F3 imports', () => {
  describe('position_career_paths (#1) — employee bridge', () => {
    it('imported 38 rows, tenant-coherent, all FKs resolved', async () => {
      // I 40 erano il risultato dell'IMPORT. Il cluster storia36 C5 ha poi
      // ricostruito la giunzione per famiglia professionale (177 posizioni):
      // qui si verifica l'import, quindi si guarda la sua provenienza.
      //
      // [S1048] Sono 38. La 000277 (#155) ha rimosso le 2 righe d'import appese a
      // posizioni DISATTIVATE — una `Compliance Officer`, una `Securities Dealer` —
      // insieme alle altre 19 orfane marcate storia36. Quelle posizioni erano già
      // vacanti prima della ricostruzione dell'organigramma, quindi non hanno una
      // viva che le sostituisca e la mappa non le copre. Non è import perso: ogni
      // riga è in `staging.storia36_155_undo` con la sua versione integrale, e
      // `SELECT staging.storia36_155_rollback();` la rimette dov'era.
      //
      // Il numero resta FISSO apposta, come per i requisiti formativi qui sotto:
      // derivarlo dal database renderebbe il test tautologico — conterebbe se
      // stesso invece di sorvegliare che l'import non si eroda in silenzio.
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_position_career_paths
          WHERE position_career_path_metadata->>'storia36' IS NULL`,
      )).toBe(38);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_position_career_paths pcp
           JOIN sys.sys_positions p ON p.position_id = pcp.position_id
          WHERE p.position_tenant_id <> pcp.position_career_path_tenant_id`,
      )).toBe(0);
    });
  });

  describe('position_learning_requirements (#2) — job_title->role->position 1:N', () => {
    // [S1045] Erano 1791 righe su 158 posizioni. La 000273 ha archiviato i 58
    // requisiti formativi appesi a 5 posizioni RITIRATE dalla ricostruzione
    // dell'organigramma: 1733 su 153. Non e' import perso — quelle posizioni non
    // hanno titolare, non hanno una viva che le sostituisca, e portavano i titoli
    // inglesi del vecchio organigramma. Le righe restano leggibili e re-inseribili
    // in `audit.position_requirements_stale_archive`.
    //
    // I numeri restano fissi apposta: questo test sorveglia che l'import F3 non
    // perda righe in silenzio, e un conteggio derivato dal DB si adeguerebbe alla
    // perdita invece di segnalarla.
    it('imported 1733 fan-out rows across 153 positions, all resolving a learning_path', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_position_learning_requirements`)).toBe(1733);
      expect(await count(
        `SELECT count(DISTINCT position_id)::int AS n FROM sys.sys_position_learning_requirements`,
      )).toBe(153);
      // every row resolves a real learning_path (FK integrity beyond the constraint)
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_position_learning_requirements plr
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_learning_paths lp WHERE lp.learning_path_id = plr.learning_path_id)`,
      )).toBe(0);
    });
  });

  describe('successor_candidates (#3) — unblocked by Wave-2 close (S982)', () => {
    it('populated by seed 49: the pool dependency was resolved by the incumbent-anchor import', async () => {
      // F3 (S960) measured this as BLOCKED (NOT NULL pool_id on empty pools). The Wave-2
      // close (mig 000106 + seed 49, PM decisions D2/D3) imported 17 pools + 25 candidates.
      // Il numero esatto dei candidati NON è più un invariante: la storia C5 rimuove chi
      // non ha titolo a stare in un bacino (né riporto diretto né stesso mestiere — coda
      // #4/#5), quindi il conteggio scende per costruzione. Resta invariante che l'import
      // non abbia prodotto più di quanto dichiarato, e che qualcosa sia arrivato.
      const importati = await count(
        `SELECT count(*)::int AS n FROM sys.sys_successor_candidates
          WHERE successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL`,
      );
      expect(importati).toBeGreaterThan(0);
      expect(importati).toBeLessThanOrEqual(25);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools`)).toBe(17);
    });
  });

  describe('PARTIAL subset imports (closure)', () => {
    it('career_path_steps 35, critical_positions 8, position_succession_relevance 9, user_learning_assignments 1990', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_career_path_steps`)).toBe(35);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_critical_positions`)).toBe(8);
      // vincolato alla provenienza dell'import: la storia C5 aggiunge una riga di
      // rilevanza per ogni posizione critica che ne era scoperta (coda #18), e quelle
      // righe portano il marchio del programma
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_position_succession_relevance
          WHERE position_succession_relevance_metadata->>'storia36' IS NULL`,
      )).toBe(9);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_learning_assignments
          WHERE user_learning_assignment_metadata->>'storia36' IS NULL`,
      )).toBe(1990);
    });
    it('user_learning_assignments all resolve a real learning_path + valid status', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_learning_assignments a
          WHERE a.user_learning_assignment_metadata->>'storia36' IS NULL
            AND (a.user_learning_assignment_path_id IS NULL
             OR a.user_learning_assignment_status NOT IN ('ASSIGNED','IN_PROGRESS','COMPLETED','OVERDUE','WAIVED','CANCELLED'))`,
      )).toBe(0);
    });
  });

  it('the 6 imported F3 tables read POPULATED in the view', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name IN ('sys_position_career_paths','sys_position_learning_requirements',
          'sys_career_path_steps','sys_critical_positions','sys_position_succession_relevance','sys_user_learning_assignments')
          AND resolved_status = 'POPULATED'`,
    );
    expect(rows[0]?.n).toBe(6);
  });
});
