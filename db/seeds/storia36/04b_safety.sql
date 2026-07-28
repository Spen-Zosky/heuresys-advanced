-- ============================================================================
-- storia36 C4 — SICUREZZA SUL LAVORO (D.Lgs 81/08 e decreti attuativi).
--
-- Piano:   docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C4)
-- Dominio: docs/kb/storia36/DOMINIO_FORMAZIONE_OBBLIGATORIA.md §5
--
-- Il dataset RTL portava un solo schema di sicurezza («Sicurezza Base D.Lgs
-- 81/08», 42 persone su 158) e la cornice si fermava lì: 116 lavoratori attivi
-- senza alcun record su un obbligo che l'art. 37 pone per OGNI lavoratore, e
-- nessuna traccia delle figure che la norma distingue — preposti, dirigenti,
-- datore di lavoro, squadre di emergenza.
--
-- Le platee NON sono elenchi scritti a mano: si derivano dai fatti gia' presenti.
--   · lavoratori   → tutti gli attivi (l'obbligo non ha eccezioni)
--   · preposti     → chi ha almeno un riporto diretto nell'organigramma (32)
--   · dirigenti    → l'inquadramento contrattuale «Dirigente» (9)
--   · datore di lavoro → chi occupa la posizione al vertice, senza riporto (1)
--   · squadre di emergenza → due addetti per SEDE, e la sede di ciascuno si
--     ricava risalendo l'albero delle unita' fino alla filiale piu' vicina
--     (vista `staging.storia36_sede_personale`: MI-HQ 137, MI-OPS 11, MI-CEN 10)
--
-- Le cadenze le fissa la LEGGE, non la mediana del dato
-- (`staging.storia36_cert_validity_di_legge`): lavoratori 5 anni, preposti 2,
-- dirigenti 5, datore di lavoro 5, antincendio 5, primo soccorso 3.
--
-- La catena parte un ciclo PRIMA dell'apertura della finestra, cosi' i 36 mesi
-- della storia sono coperti per intero e resta un anello precedente a fare da
-- ancora. Il rinnovo si ottiene PRIMA della scadenza (mai dopo: un'abilitazione
-- non ammette scoperture — C4b(iv)).
--
-- PERIMETRO DICHIARATO: qui si scrive l'ABILITAZIONE, non le ore. La formazione
-- sicurezza in banca e' tenuta dal servizio di prevenzione e protezione, non dal
-- catalogo formativo: non genera evidenze nel registro dei corsi e quindi non
-- concorre al monte-ore di C4a. E' una scelta dichiarata, non una dimenticanza.
--
-- Idempotente: id uuid_generate_v5 su (utente, schema, progressivo). Twice-run 0.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl   constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns    constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_start constant date := DATE '2023-08-01';
  c_to    date;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;
  IF c_to IS NULL THEN
    RAISE EXCEPTION 'storia36 C4/sicurezza: nessuna presenza nel tenant RTL — eseguire prima il C1';
  END IF;

  CREATE TEMP TABLE _scope ON COMMIT DROP AS
  SELECT u.user_id, u.user_email, min(e.user_employment_hire_date) AS hire
    FROM sys.sys_users u
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND e.user_employment_hire_date IS NOT NULL
   GROUP BY 1, 2;

  -- --------------------------------------------------------------------------
  -- Le platee, ciascuna con il proprio ancoraggio nel dato
  -- --------------------------------------------------------------------------
  CREATE TEMP TABLE _obbligo ON COMMIT DROP AS
  SELECT s.user_id, s.hire, 'Sicurezza Base D.Lgs 81/08'::text AS nome
    FROM _scope s
  UNION ALL
  SELECT s.user_id, s.hire, 'Aggiornamento preposti (D.Lgs 81/08 art. 37)'
    FROM _scope s
   WHERE EXISTS (
     SELECT 1 FROM sys.sys_user_position_assignments a
      JOIN sys.sys_positions p ON p.position_reports_to_position_id = a.user_position_assignment_position_id
     WHERE a.user_position_assignment_user_id = s.user_id
       AND a.user_position_assignment_kind = 'PRIMARY'
       AND a.user_position_assignment_status = 'ACTIVE')
  UNION ALL
  SELECT s.user_id, s.hire, 'Formazione dirigenti per la sicurezza (D.Lgs 81/08)'
    FROM _scope s
    JOIN sys.sys_user_contracts ct ON ct.user_contract_user_id = s.user_id
   WHERE ct.user_contract_ccnl_level = 'Dirigente'
  UNION ALL
  SELECT s.user_id, s.hire, 'Formazione datore di lavoro (D.Lgs 81/08)'
    FROM _scope s
   WHERE EXISTS (
     SELECT 1 FROM sys.sys_user_position_assignments a
      JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
     WHERE a.user_position_assignment_user_id = s.user_id
       AND a.user_position_assignment_kind = 'PRIMARY'
       AND a.user_position_assignment_status = 'ACTIVE'
       AND p.position_reports_to_position_id IS NULL)
  UNION ALL
  SELECT x.user_id, s.hire, x.nome
    FROM (
      SELECT sp.user_id, f.nome,
             row_number() OVER (PARTITION BY sp.branch_code, f.nome
                                ORDER BY pg_temp.h(sp.user_id::text || f.nome)) AS rango
        FROM staging.storia36_sede_personale sp
        CROSS JOIN (VALUES
          ('Addetto antincendio - rischio basso (DM 02/09/2021)'),
          ('Addetto primo soccorso - gruppo B (DM 388/2003)')) AS f(nome)
    ) x
    JOIN _scope s ON s.user_id = x.user_id
   WHERE x.rango <= 2;

  -- --------------------------------------------------------------------------
  -- Le catene: un anello per ciclo, dal ciclo che precede la finestra fino a
  -- superare la frontiera della storia.
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_user_certifications (
    user_certification_id, user_certification_user_id, user_certification_tenant_id,
    user_certification_name, user_certification_issuer,
    user_certification_issued_date, user_certification_expires_date,
    user_certification_credential_id, user_certification_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C4::SIC::' || o.user_id || '::' || o.nome || '::' || g.n),
         o.user_id, c_rtl, o.nome, 'INAIL',
         -- rilasciata prima della scadenza precedente, mai prima dell'assunzione
         GREATEST(o.hire, (o.inizio + ((g.n - 1) * o.cad_days))::date
                            - (pg_temp.h(o.user_id::text || o.nome || g.n || 'I') % 20)),
         (o.inizio + (g.n * o.cad_days))::date,
         'ATT-' || upper(substr(md5(o.user_id::text || o.nome || g.n), 1, 10)),
         jsonb_build_object('storia36', 'C4', 'blocco', 'sicurezza', 'progressivo', g.n)
    FROM (
      SELECT ob.user_id, ob.hire, ob.nome,
             round(staging.storia36_cert_validity_di_legge(ob.nome) * 365)::int AS cad_days,
             GREATEST(ob.hire,
                      c_start - round(staging.storia36_cert_validity_di_legge(ob.nome) * 365)::int
             ) AS inizio
        FROM _obbligo ob
       WHERE staging.storia36_cert_validity_di_legge(ob.nome) IS NOT NULL
         -- chi possiede gia' quello schema dal legacy tiene la propria storia:
         -- la sua catena la estende il seed 04 (INAIL e' schema abilitante)
         AND NOT EXISTS (
           SELECT 1 FROM sys.sys_user_certifications c
            WHERE c.user_certification_user_id = ob.user_id
              AND c.user_certification_name = ob.nome
              AND c.user_certification_metadata->>'storia36' IS NULL)
    ) o
    CROSS JOIN generate_series(1, 12) AS g(n)
   WHERE (o.inizio + ((g.n - 1) * o.cad_days))::date < c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4/sicurezza: abilitazioni inserite %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C4', '04b_safety.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c4b(c_to);
  PERFORM staging.storia36_check_c4h(c_to);

  RAISE NOTICE 'storia36 C4/sicurezza OK: % righe (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
