import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F1 of the reconciliation-closure cycle. Asserts the registry + view shipped by
// migration 000058 + seed 04_registry.sql. Hits the live DB via the tunnel (no mocks),
// consistent with the rest of the integration suite. The pool is shared across the
// suite (singleThread) so this file does NOT close it.

describe('reconciliation registry (F1)', () => {
  /**
   * RETIRED (S1021): this used to assert a frozen census — "exactly 115 rows, split
   * A27/B16/C23/D49" — carrying a 45-line changelog of the ~25 times the number had been
   * bumped by hand. It duplicated the registry, which IS the source of truth, so every new
   * `sys.*` table turned a green suite red for bookkeeping reasons rather than for a defect;
   * the changelog itself records a session that left the assert stale and red without noticing
   * ("was already red at the S990 session start"). Its real content — that nothing escapes
   * classification — is already asserted, better, by the 0-UNCLASSIFIED test below.
   *
   * Replaced by invariants derived from the live schema, which cannot go stale:
   *   - every registry row carries a valid bucket and declared status;
   *   - no row points at a table that no longer exists (a dropped table left registered would
   *     otherwise sit unnoticed — something the census could never catch).
   */
  it('every registry row is well-formed and points at a table that exists', async () => {
    const { rows: malformed } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_bucket NOT IN ('A','B','C','D')
           OR reconciliation_registry_declared_status IS NULL`,
    );
    expect(malformed[0]?.n, 'righe con bucket/declared_status non validi').toBe(0);

    const { rows: orphans } = await pool.query<{ t: string }>(
      `SELECT r.reconciliation_registry_table_name AS t
         FROM sys.sys_reconciliation_registry r
        WHERE NOT EXISTS (
          SELECT 1 FROM pg_tables p
           WHERE p.schemaname = 'sys' AND p.tablename = r.reconciliation_registry_table_name
        )`,
    );
    expect(orphans.map((r) => r.t), 'righe di registro orfane (tabella inesistente)').toEqual([]);
  });

  it('the bucket split is internally consistent (every classified table counted once)', async () => {
    const { rows } = await pool.query<{ b: string; n: number }>(
      `SELECT reconciliation_registry_bucket AS b, count(*)::int AS n
         FROM sys.sys_reconciliation_registry GROUP BY 1`,
    );
    const m = Object.fromEntries(rows.map((r: { b: string; n: number }) => [r.b, r.n]));
    const total = Object.values(m).reduce((s, n) => s + (n as number), 0);

    const { rows: all } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry`,
    );
    expect(total).toBe(all[0]?.n);
    expect(Object.keys(m).sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('the v_reconciliation_status view leaves zero UNCLASSIFIED tables', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED'`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('every B (wall) row names a structural wall', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_bucket = 'B' AND reconciliation_registry_wall IS NULL`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('every A/B row carries a legacy_source (a real importable source)', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_bucket IN ('A', 'B') AND reconciliation_registry_legacy_source IS NULL`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('the registry table is excluded from its own view (no self-classification)', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name = 'sys_reconciliation_registry'`,
    );
    expect(rows[0]?.n).toBe(0);
  });
});

// B-50 terminal-annotation close (S972, mig 000076) + Wave-2 close (S982, mig 000106 +
// seeds 49-50): the 7 residual-wall tables that used to RESOLVE to NEEDS_DECISION are now
// ALL terminal. 4 -> NO_SOURCE (no usable 1:1 populated source, unchanged since S972);
// the 3 ex-DEFER tables (branches / succession pools / successor candidates) were IMPORTED
// under PM decisions D1-D3 (Enzo 2026-06-10) and resolve POPULATED via has_rows.
describe('reconciliation registry — B-50 residual-wall terminal close (S972) + Wave-2 close (S982)', () => {
  // ANCHORING (S1035). `resolved_status` is a PURE FUNCTION of has_rows
  // (sys.fn_reconciliation_status: `WHEN v_has THEN 'POPULATED' … ELSE declared_status`),
  // so a literal 'NO_SOURCE'/'POPULATED' expectation asserts the PRESENCE OF A SEED, not an
  // invariant of the registry. The two environments legitimately differ: PROD/local carries
  // the storia36 authored derivations (C3 on the reward pair, C5 on the succession/target
  // pair), while heuresys_ci is a PROD clone frozen before them and re-hydrated with
  // migrations only — no db/seeds/storia36/* step exists in .github/workflows/test-integration.yml.
  // Measured 2026-07-28: PROD 4/4 POPULATED, heuresys_ci 4/4 empty+NO_SOURCE.
  // The assertions below are therefore anchored to PROVENANCE and to view COHERENCE, both
  // of which hold with or without the storia36 history.
  //
  // declared_status = NO_SOURCE is a verdict on the LEGACY provenance ("no importable 1:1
  // source"); it does NOT decay when the table is later filled by a human-authored
  // derivation. That is why these tables can be both terminal and populated.
  const TERMINAL_NO_SOURCE = [
    'sys_successor_readiness',
    'sys_user_target_positions',
  ] as const;
  const STORIA36_C3_AUTHORED = [
    'sys_payout_curves',
    'sys_reward_gate_results',
  ] as const;
  const TERMINAL_TABLES = [...TERMINAL_NO_SOURCE, ...STORIA36_C3_AUTHORED];
  const WAVE2_IMPORTED = [
    'sys_branches',
    'sys_succession_pools',
    'sys_successor_candidates',
  ] as const;
  // The jsonb column that carries the storia36 provenance marker on each table
  // (`->>'storia36'` = 'C3'/'C5' for the authored rows, NULL for the imported ones).
  // Verified live against information_schema, 2026-07-28.
  const PROVENANCE_COLUMN: Record<string, string> = {
    sys_payout_curves: 'payout_curve_payload',
    sys_reward_gate_results: 'reward_gate_result_payload',
    sys_successor_readiness: 'successor_readiness_payload',
    sys_user_target_positions: 'user_target_position_metadata',
    sys_branches: 'branch_metadata',
    sys_succession_pools: 'succession_pool_metadata',
    sys_successor_candidates: 'successor_candidate_metadata',
  };
  const countAuthored = async (table: string, authored: boolean): Promise<number> => {
    const col = PROVENANCE_COLUMN[table];
    if (!col) throw new Error(`no provenance column declared for sys.${table}`);
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.${table}
        WHERE ${col}->>'storia36' IS ${authored ? 'NOT NULL' : 'NULL'}`,
    );
    return rows[0]?.n ?? -1;
  };

  it('view-wide NEEDS_DECISION dropped to exactly 0 (was 3 after S972, 7 before B-50)', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status = 'NEEDS_DECISION'`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  // The terminal declaration must survive both states. When the table is EMPTY the view has
  // to fall back to the registry's NO_SOURCE; when POPULATED it must resolve POPULATED and
  // nothing else.
  //
  // #164 F4 (2026-08-08) — questo test era motivato dal fatto che la catena consultava
  // `brownfield.table_mappings` PRIMA del registro, quindi una carta `IMPORT`/`REFERENCE_ONLY`
  // aggiunta di soppiatto poteva oscurare il verdetto terminale. Quella fonte non esiste piu':
  // il registro e' l'unica autorita' (`000058` emendata). Il test resta valido e utile — ora
  // sorveglia che il verdetto terminale segua `has_rows` — ma non protegge piu' da un
  // oscuramento che non puo' piu' accadere.
  it('the 4 terminal tables resolve coherently with has_rows and never lose the NO_SOURCE fallback', async () => {
    const { rows } = await pool.query<{
      table_name: string;
      has_rows: boolean;
      resolved_status: string;
      declared_status: string;
    }>(
      `SELECT table_name, has_rows, resolved_status, declared_status
         FROM sys.v_reconciliation_status
        WHERE table_name = ANY($1::text[]) ORDER BY table_name`,
      [TERMINAL_TABLES],
    );
    expect(rows.map((r) => r.table_name)).toEqual([...TERMINAL_TABLES].sort());
    for (const r of rows) {
      expect(r.declared_status, `${r.table_name}: declared_status`).toBe('NO_SOURCE');
      expect(
        r.resolved_status,
        `${r.table_name}: risoluzione incoerente con has_rows=${r.has_rows} ` +
          `(una table_mapping brownfield sta oscurando il verdetto terminale?)`,
      ).toBe(r.has_rows ? 'POPULATED' : 'NO_SOURCE');
    }
  });

  // The real content of the retired "terminal tables must remain EMPTY" assertion: no LEGACY
  // import may fabricate rows into a table declared NO_SOURCE. Rows authored by storia36 are
  // legitimate (the B-50 rationale for the C3 pair explicitly called for a human-authored
  // derivation); rows WITHOUT a provenance marker in one of these tables are not.
  // Holds in both environments: heuresys_ci has 0 rows, PROD has 0 non-authored rows.
  it('no terminal NO_SOURCE table holds a row of unauthored (legacy-import) provenance', async () => {
    for (const t of TERMINAL_TABLES) {
      expect(
        await countAuthored(t, false),
        `sys.${t}: righe prive del marcatore storia36 — un import ha invaso una tabella dichiarata NO_SOURCE`,
      ).toBe(0);
    }
  });

  // Data and registry annotation are coupled BOTH WAYS: the storia36 C3 seed pair writes the
  // rows (03_compensation.sql) and the annotation (repair/2026-07-28_c3_fixups_oneshot.sql).
  // Rows without the annotation = the registry lying about a table it declares terminal;
  // annotation without rows = a claim of a derivation that was never produced. Either is red.
  // In heuresys_ci neither ran (both sides false) — the equality still holds and still bites.
  it('the storia36 C3 authored pair: rows and registry annotation move together', async () => {
    const authored = await Promise.all(
      STORIA36_C3_AUTHORED.map(async (t) => ({ t, n: await countAuthored(t, true) })),
    );
    const populated = authored.filter((a) => a.n > 0).map((a) => a.t);
    // 03_compensation.sql writes curves and gate results in one run: a half-populated pair
    // means the seed died mid-way and the registry state can no longer be trusted.
    expect(
      populated.length === 0 || populated.length === STORIA36_C3_AUTHORED.length,
      `coppia C3 popolata a meta': ${JSON.stringify(authored)}`,
    ).toBe(true);

    const { rows: reg } = await pool.query<{ table_name: string; marked_c3: boolean; marked_b50: boolean }>(
      `SELECT reconciliation_registry_table_name AS table_name,
              (reconciliation_registry_rationale LIKE '%[storia36 C3%') AS marked_c3,
              (reconciliation_registry_rationale LIKE '%[B-50 TERMINAL S972]%') AS marked_b50
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = ANY($1::text[])`,
      [STORIA36_C3_AUTHORED as unknown as string[]],
    );
    expect(reg).toHaveLength(2);
    // the B-50 terminal marker ships with migration 000076 → present in every environment.
    expect(reg.every((r) => r.marked_b50 === true), 'marcatore [B-50 TERMINAL S972] mancante').toBe(true);
    for (const r of reg) {
      expect(
        r.marked_c3,
        `${r.table_name}: annotazione [storia36 C3] e dati devono coesistere ` +
          `(righe autorate presenti: ${populated.length > 0})`,
      ).toBe(populated.length > 0);
    }
  });

  it('the 4 terminal tables carry declared_status NO_SOURCE + a B-50 TERMINAL rationale', async () => {
    const { rows } = await pool.query<{ table_name: string; declared: string; marked: boolean }>(
      `SELECT reconciliation_registry_table_name AS table_name,
              reconciliation_registry_declared_status AS declared,
              (reconciliation_registry_rationale LIKE '%[B-50 TERMINAL S972]%') AS marked
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = ANY($1::text[])`,
      [TERMINAL_TABLES],
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.declared === 'NO_SOURCE')).toBe(true);
    expect(rows.every((r) => r.marked === true)).toBe(true);
  });

  it('the 3 Wave-2 imported tables resolve POPULATED in the view (S982)', async () => {
    const { rows } = await pool.query<{ table_name: string; resolved_status: string }>(
      `SELECT table_name, resolved_status FROM sys.v_reconciliation_status
        WHERE table_name = ANY($1::text[]) ORDER BY table_name`,
      [WAVE2_IMPORTED as unknown as string[]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...WAVE2_IMPORTED].sort());
    // [S1048] `sys_successor_candidates` può NON essere POPULATED, e non è una
    // regressione dell'import: la 000278 (#160) ha rimosso i candidati appesi a
    // bacini agganciati a un ruolo critico che non era il loro, e su un clone di
    // CI — dove i seed della storia RTL non girano e quindi non ne arrivano di
    // nuovi — la tabella resta vuota. La vista risolve POPULATED da `has_rows`,
    // quindi segue il dato: è il comportamento corretto, non un difetto.
    // Le altre due restano popolate, e il registro continua a dichiararle IMPORT
    // (verificato dal test successivo, che è la sentinella della DICHIARAZIONE).
    const perTabella = new Map(rows.map((r) => [r.table_name, r.resolved_status]));
    expect(perTabella.get('sys_branches')).toBe('POPULATED');
    expect(perTabella.get('sys_succession_pools')).toBe('POPULATED');
    expect(['POPULATED', 'IMPORT']).toContain(perTabella.get('sys_successor_candidates'));
  });

  it('the 3 Wave-2 tables carry declared_status IMPORT + a WAVE2 CLOSE rationale', async () => {
    const { rows } = await pool.query<{ table_name: string; declared: string; marked: boolean }>(
      `SELECT reconciliation_registry_table_name AS table_name,
              reconciliation_registry_declared_status AS declared,
              (reconciliation_registry_rationale LIKE '%[WAVE2 CLOSE S982]%') AS marked
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = ANY($1::text[])`,
      [WAVE2_IMPORTED as unknown as string[]],
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.declared === 'IMPORT')).toBe(true);
    expect(rows.every((r) => r.marked === true)).toBe(true);
  });

  // The Wave-2 census verifies the IMPORT (seeds 49-50), so it must count the IMPORTED rows.
  // A raw count(*) drifted the moment storia36 C5 added 24 authored candidates on top of the
  // 25 imported ones (measured 2026-07-28: PROD 49 total = 25 import + 24 C5; heuresys_ci 25).
  // Constraining the count to the import provenance restores the original meaning in both.
  it('the 3 Wave-2 tables carry exactly their imported counts (provenance-constrained)', async () => {
    // [S1048] I bacini scendono da 17 a 7. La 000278 (#160) ha rimosso quelli
    // agganciati a un ruolo critico che non era il loro (`Chief Executive Officer`
    // stava su `Securities Dealer`, il `CFO` su `Bank Teller`) e quelli appesi a
    // posizioni disattivate. Non è import eroso in silenzio — che è ciò che questo
    // censimento sorveglia: le righe sono in `staging.storia36_160_undo` e
    // `SELECT staging.storia36_160_rollback();` le rimette.
    expect(await countAuthored('sys_branches', false), "sys.sys_branches: attese 6 righe d'import").toBe(6);
    // [S1048] I bacini non hanno più un conteggio fisso, e non possono averlo: la
    // 000278 (#160) rimuove quelli agganciati a un ruolo critico che non era il
    // loro e quelli su posizioni spente, quindi il numero dipende da quando lo si
    // guarda — 7 su un database allineato, 17 su un clone che ricostruisce la
    // catena da zero. Resta ciò che questo censimento sorveglia davvero: che
    // l'import non si GONFI. Le righe rimosse sono in `staging.storia36_160_undo`.
    const bacini = await countAuthored('sys_succession_pools', false);
    expect(bacini, "sys.sys_succession_pools: l'import non deve gonfiarsi").toBeLessThanOrEqual(17);
    expect(bacini).toBeGreaterThan(0);
    // I candidati fanno eccezione, e la ragione è nel dominio: la storia C5 rimuove dai
    // bacini chi non è né il riporto diretto della posizione né qualcuno che quel mestiere
    // lo fa già altrove (coda #4/#5). Un conteggio fisso qui misurerebbe lo stato e
    // cadrebbe a ogni ripulitura; il vincolo di provenienza da solo non basta più, perché
    // la rimozione tocca proprio le righe importate. Resta l'invariante: l'import non ha
    // prodotto più di quanto dichiarato.
    //
    // [S1048] Ed è arrivato a zero: la 000278 (#160) ha rimosso TUTTI i candidati
    // importati, perché stavano nei bacini agganciati al ruolo critico sbagliato e
    // nessuno reggeva il criterio di successione (`C5g` li contava tutti e 27).
    // Pretendere «almeno uno» significherebbe pretendere la sopravvivenza di un
    // dato incoerente.
    const candidatiImportati = await countAuthored('sys_successor_candidates', false);
    expect(candidatiImportati).toBeGreaterThanOrEqual(0);
    expect(candidatiImportati).toBeLessThanOrEqual(25);
  });

  it('sys_successor_readiness keeps NO_SOURCE with both S972 and WAVE2 markers (cascade branch decayed)', async () => {
    const { rows } = await pool.query<{ declared: string; r: string }>(
      `SELECT reconciliation_registry_declared_status AS declared,
              reconciliation_registry_rationale AS r
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = 'sys_successor_readiness'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.declared).toBe('NO_SOURCE');
    expect(rows[0]?.r).toContain('[B-50 TERMINAL S972]');
    expect(rows[0]?.r).toContain('[WAVE2 S982]');
  });
});

// B-42 RE-CONFIRMATION (S994, item #12, seed 53). sys_process_kpi_templates is the only
// EXCLUDE row with a measurable legacy source (process_kpis). It was re-measured live: the
// KPI side resolves 1:1 (81/81 kpi_code in sys_kpi_definitions) but the NOT-NULL process FK
// to sys_blueprint_process_registry cannot resolve (CODE-overlap 0/25, NAME-overlap 1/25 vs
// the legacy business_processes BP-xxx keyspace). Importing would require an Enzo-authored
// process crosswalk (a WHAT decision) -> kept EXCLUDE, fresh evidence appended to the
// registry rationale. This guards against a silent regression that imports the table or
// flips its terminal status without the crosswalk.
describe('reconciliation registry — B-42 process_kpi_templates EXCLUDE re-confirmed (S994)', () => {
  it('sys_process_kpi_templates resolves EXCLUDE in the view and stays empty', async () => {
    const { rows: view } = await pool.query<{ resolved_status: string }>(
      `SELECT resolved_status FROM sys.v_reconciliation_status
        WHERE table_name = 'sys_process_kpi_templates'`,
    );
    expect(view).toHaveLength(1);
    expect(view[0]?.resolved_status).toBe('EXCLUDE');

    const { rows: cnt } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_process_kpi_templates`,
    );
    expect(cnt[0]?.n, 'sys_process_kpi_templates must remain empty (no fabricated crosswalk)').toBe(0);
  });

  it('the registry row carries declared_status EXCLUDE + the S994 re-confirmation evidence', async () => {
    const { rows } = await pool.query<{ declared: string; r: string }>(
      `SELECT reconciliation_registry_declared_status AS declared,
              reconciliation_registry_rationale AS r
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = 'sys_process_kpi_templates'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.declared).toBe('EXCLUDE');
    // S994 fresh-evidence marker (seed 53) + the original S970 out-of-scope marker (seed 43).
    expect(rows[0]?.r).toContain('RE-CONFIRMED S994');
    expect(rows[0]?.r).toContain('OUT-OF-SCOPE S970');
  });
});
