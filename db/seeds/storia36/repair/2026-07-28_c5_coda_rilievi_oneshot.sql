-- ============================================================================
-- storia36 C5 — la CODA dei rilievi adversarial non assorbiti nella passata v2
--
-- Registrati in .storia36/PROGRESS.md (entry «C5 · v2 post-review»), ripresi
-- come voce #78 dell'Action register. Sei sezioni, un rilievo ciascuna. Ogni
-- numero citato qui sotto è stato MISURATO prima di scrivere la riparazione,
-- non stimato.
--
--  A (#18) TRE registri di criticità, DISGIUNTI. Misura: 8 posizioni in
--          sys_critical_positions · 8 con relevance.is_critical · 7 con
--          positions.position_criticality alta — e ZERO in comune fra i tre.
--          Un ruolo era «critico» in un registro e ordinario negli altri due.
--          Invariante stabilito qui: position_criticality='CRITICAL'
--          ⟺ riga in sys_critical_positions ⟺ relevance.is_critical.
--          La fonte è sys_critical_positions: è l'unico registro che porta
--          motivazione e impatto di business, ed è su quello che C5 ha
--          costruito bacini e successori.
--  B (#19) NOMI dei bacini incoerenti: la stessa carica compariva come
--          «Chief Executive Officer» e «CEO / Amministratore Delegato»,
--          «Head of Human Resources» e «Head of HR», «VP of Operations» e
--          «COO» — due convenzioni legacy (CROLE e SPLAN) mescolate. Il nome
--          ora DERIVA dal titolo della posizione servita.
--  C (#4/#5) SUCCESSORI scelti senza criterio: su 49 candidati, 22 non erano
--          né un riporto diretto della posizione né qualcuno che quel mestiere
--          lo fa già altrove. Erano nomi. Vengono rimossi; il seed li
--          rigenera con il criterio (le valutazioni di prontezza seguono in
--          CASCADE e vengono riscritte insieme ai sostituti).
--  D (#27) PASSI dei percorsi di carriera: 35 passi su 35 senza posizione di
--          origine NÉ di destinazione. Un percorso che non dice da dove a dove
--          si va è un titolo. Il wiring deriva dall'organigramma; per i due
--          percorsi che non avevano alcuna posizione collegata (Management,
--          Software Engineering) le posizioni si derivano dai titoli reali.
--  E (#30/#33) DATORE e SETTORE sorteggiati indipendentemente: «Banca Popolare
--          del Verbano» risultava insieme banca, assicurazione e società di
--          consulenza ICT. 9 datori su 9 incoerenti. Ora il settore si estrae
--          per primo (stessa distribuzione di prima: 70/20/10) e il datore si
--          sceglie DENTRO quel settore.
--  F (#13/#20) ARTEFATTI DI CALENDARIO: 85 esperienze su 255 iniziavano il
--          giorno 1 del mese e 104 su 255 a gennaio, perché l'inizio coincideva
--          con la fine degli studi. Uno sfasamento deterministico disperde le
--          date senza toccare i vincoli (mai prima dell'inizio carriera, mai
--          oltre l'ingresso in RTL).
--
-- Le formule di E e F sono le STESSE che il seed 05_career.sql usa ora: su un
-- database vuoto il seed produce già il dato corretto, questo file allinea
-- quello scritto dalla passata precedente. Idempotente: rieseguibile, alla
-- seconda corsa non tocca nulla.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns  constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  v_n   bigint;
  v_hr  uuid;
BEGIN
  SELECT user_id INTO STRICT v_hr FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org';

  -- ==========================================================================
  -- A (#18) — un solo registro della criticità
  -- ==========================================================================
  UPDATE sys.sys_positions p
     SET position_criticality = 'CRITICAL', updated_at = now()
   WHERE p.position_tenant_id = c_rtl
     AND p.position_criticality IS DISTINCT FROM 'CRITICAL'
     AND EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                  WHERE cp.critical_position_position_id = p.position_id
                    AND cp.critical_position_tenant_id = c_rtl);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'A: posizioni del registro portate a CRITICAL: %', v_n;

  -- chi si diceva critico senza stare nel registro scende di un gradino: il
  -- segnale non si butta, ma «critico» resta una parola sola
  UPDATE sys.sys_positions p
     SET position_criticality = 'HIGH', updated_at = now()
   WHERE p.position_tenant_id = c_rtl
     AND p.position_criticality = 'CRITICAL'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                      WHERE cp.critical_position_position_id = p.position_id
                        AND cp.critical_position_tenant_id = c_rtl);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'A: posizioni critiche fuori registro declassate a HIGH: %', v_n;

  -- la vista successione dice il vero: is_critical segue il registro...
  UPDATE sys.sys_position_succession_relevance r
     SET is_critical = EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                                WHERE cp.critical_position_position_id = r.position_id
                                  AND cp.critical_position_tenant_id = c_rtl),
         updated_at = now()
   WHERE r.position_succession_relevance_tenant_id = c_rtl
     AND r.is_critical IS DISTINCT FROM EXISTS (
           SELECT 1 FROM sys.sys_critical_positions cp
            WHERE cp.critical_position_position_id = r.position_id
              AND cp.critical_position_tenant_id = c_rtl);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'A: righe di rilevanza riallineate al registro: %', v_n;

  -- ...e ogni posizione critica ha la sua riga, che prima poteva mancare
  INSERT INTO sys.sys_position_succession_relevance (
    position_succession_relevance_id, position_id,
    position_succession_relevance_tenant_id, is_critical,
    position_succession_relevance_metadata, created_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::PSR::' || cp.critical_position_position_id),
         cp.critical_position_position_id, c_rtl, true,
         jsonb_build_object('storia36', 'C5', 'riparazione', 'coda-rilievi #18'), v_hr
    FROM sys.sys_critical_positions cp
   WHERE cp.critical_position_tenant_id = c_rtl
     AND NOT EXISTS (SELECT 1 FROM sys.sys_position_succession_relevance r
                      WHERE r.position_id = cp.critical_position_position_id
                        AND r.position_succession_relevance_tenant_id = c_rtl)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'A: righe di rilevanza create per posizioni critiche scoperte: %', v_n;

  -- (l'orizzonte di copertura — NULL su tutte e 9 le righe — è un dato DERIVATO
  --  dal candidato più pronto del bacino: si calcola nel seed, dopo che i
  --  successori sono stati scelti, altrimenti questa riparazione non è stabile
  --  alla riesecuzione perché la sezione C qui sotto cambia i bacini.)

  -- ==========================================================================
  -- B (#19) — il nome del bacino è il titolo della posizione servita
  -- ==========================================================================
  UPDATE sys.sys_succession_pools sp
     SET succession_pool_name = 'Successione — ' || p.position_title,
         updated_at = now()
    FROM sys.sys_positions p
   WHERE p.position_id = sp.succession_pool_position_id
     AND sp.succession_pool_tenant_id = c_rtl
     AND sp.succession_pool_name IS DISTINCT FROM 'Successione — ' || p.position_title;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'B: nomi di bacino uniformati al titolo della posizione: %', v_n;

  -- ==========================================================================
  -- C (#4/#5) — via i successori senza criterio
  --   Conforme = chi occupa una posizione che RIPORTA a quella del bacino
  --   (il successore naturale), oppure chi ricopre lo STESSO ruolo altrove
  --   (il mestiere lo fa già). Chi non è né l'uno né l'altro esce.
  -- ==========================================================================
  DELETE FROM sys.sys_successor_candidates sc
   WHERE sc.successor_candidate_tenant_id = c_rtl
     AND NOT EXISTS (
       SELECT 1
         FROM sys.sys_succession_pools sp
         JOIN sys.sys_positions pp ON pp.position_id = sp.succession_pool_position_id
         JOIN sys.sys_user_position_assignments a
           ON a.user_position_assignment_user_id = sc.successor_candidate_user_id
          AND a.user_position_assignment_status = 'ACTIVE'
         JOIN sys.sys_positions cpz
           ON cpz.position_id = a.user_position_assignment_position_id
        WHERE sp.succession_pool_id = sc.successor_candidate_pool_id
          AND (cpz.position_reports_to_position_id = sp.succession_pool_position_id
            OR (cpz.position_title = pp.position_title AND cpz.position_id <> pp.position_id)));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'C: successori senza criterio rimossi (prontezze in cascata): %', v_n;

  -- ==========================================================================
  -- D (#27) — da dove a dove si va, su ogni percorso
  --   D.1 due percorsi non avevano NESSUNA posizione collegata: si derivano
  --       dai titoli reali dell'organigramma, non si inventano.
  -- ==========================================================================
  INSERT INTO sys.sys_position_career_paths (
    position_career_path_id, position_id, career_path_id,
    position_career_path_tenant_id, position_career_path_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::PCP::' || p.position_id || '::' || cp.career_path_id),
         p.position_id, cp.career_path_id, c_rtl,
         jsonb_build_object('storia36', 'C5', 'riparazione', 'coda-rilievi #27',
                            'criterio', 'titolo della posizione')
    FROM sys.sys_career_paths cp
    JOIN sys.sys_positions p ON p.position_tenant_id = c_rtl
   WHERE cp.career_path_name IN ('Management Track', 'Software Engineering Track')
     AND NOT EXISTS (SELECT 1 FROM sys.sys_position_career_paths x
                      WHERE x.career_path_id = cp.career_path_id)
     AND (
       (cp.career_path_name = 'Management Track'
        AND (p.position_title ILIKE '%Manager%' OR p.position_title ILIKE '%Director%'
          OR p.position_title ILIKE '%Head of%' OR p.position_title ILIKE '%Chief%'
          OR p.position_title ILIKE '%Supervisor%' OR p.position_title = 'CEO'))
       OR
       (cp.career_path_name = 'Software Engineering Track'
        AND (p.position_title ILIKE '%Developer%' OR p.position_title ILIKE '%Engineer%'
          OR p.position_title ILIKE '%System Administrator%' OR p.position_title ILIKE '%IT %'
          OR p.position_title ILIKE '%Architect%' OR p.position_title ILIKE '%Data %'))
     )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'D.1: posizioni collegate ai percorsi che non ne avevano: %', v_n;

  -- D.2 il passo k arriva al livello k: la destinazione è la posizione
  --     rappresentativa della fascia k, l'origine è quella della fascia k-1.
  --     Il passo 1 non ha origine — al livello d'ingresso si arriva da fuori.
  --     Rappresentante della fascia = la posizione più occupata (a parità, il
  --     titolo in ordine alfabetico): è la strada che la gente percorre davvero.
  CREATE TEMP TABLE _fascia ON COMMIT DROP AS
  WITH RECURSIVE disc AS (
    SELECT p.position_id, 0 AS livello
      FROM sys.sys_positions p
     WHERE p.position_tenant_id = c_rtl AND p.position_reports_to_position_id IS NULL
    UNION ALL
    SELECT p.position_id, d.livello + 1
      FROM sys.sys_positions p
      JOIN disc d ON d.position_id = p.position_reports_to_position_id
     WHERE p.position_tenant_id = c_rtl
  ),
  prof AS (SELECT position_id, min(livello) AS livello FROM disc GROUP BY 1),
  pos_path AS (
    SELECT pcp.career_path_id, pcp.position_id, pr.livello, p.position_title,
           (SELECT count(*) FROM sys.sys_user_position_assignments a
             WHERE a.user_position_assignment_position_id = pcp.position_id
               AND a.user_position_assignment_status = 'ACTIVE') AS titolari
      FROM sys.sys_position_career_paths pcp
      JOIN prof pr ON pr.position_id = pcp.position_id
      JOIN sys.sys_positions p ON p.position_id = pcp.position_id
     WHERE p.position_tenant_id = c_rtl
  ),
  -- 5 fasce per percorso: il livello più profondo è il gradino d'ingresso
  scaglioni AS (
    SELECT career_path_id, position_id, position_title, titolari,
           ntile(5) OVER (PARTITION BY career_path_id ORDER BY livello DESC, position_title) AS fascia
      FROM pos_path
  )
  SELECT DISTINCT ON (career_path_id, fascia)
         career_path_id, fascia, position_id, position_title
    FROM scaglioni
   ORDER BY career_path_id, fascia, titolari DESC, position_title;

  UPDATE sys.sys_career_path_steps s
     SET career_path_step_target_position_id = arrivo.position_id,
         career_path_step_origin_position_id = partenza.position_id,
         career_path_step_typical_duration_months =
           COALESCE(s.career_path_step_typical_duration_months, 18 + 6 * s.career_path_step_ordinal),
         career_path_step_metadata = s.career_path_step_metadata
           || jsonb_build_object('storia36', 'C5', 'riparazione', 'coda-rilievi #27',
                                 'criterio', 'fascia di profondita organigramma, rappresentante piu occupato'),
         updated_at = now()
    FROM _fascia arrivo
    LEFT JOIN _fascia partenza
      ON partenza.career_path_id = arrivo.career_path_id
     AND partenza.fascia = arrivo.fascia - 1
   WHERE arrivo.career_path_id = s.career_path_step_path_id
     AND arrivo.fascia = s.career_path_step_ordinal
     AND (s.career_path_step_target_position_id IS DISTINCT FROM arrivo.position_id
       OR s.career_path_step_origin_position_id IS DISTINCT FROM partenza.position_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'D.2: passi di carriera collegati a posizioni reali: %', v_n;

  -- ==========================================================================
  -- E (#30/#33) + F (#13/#20) — esperienze precedenti: coerenza datore/settore
  --   e dispersione delle date. Stessa formula del seed (05_career.sql §1).
  -- ==========================================================================
  WITH base AS (
    SELECT x.user_prof_exp_id,
           x.user_prof_exp_user_id AS uid,
           (x.user_prof_exp_metadata->>'tratto')::int AS i,
           (x.user_prof_exp_metadata->>'su')::int AS n,
           staging.storia36_c5_inizio_carriera(x.user_prof_exp_user_id) AS inizio,
           (SELECT min(em.user_employment_hire_date) FROM sys.sys_user_employment em
             WHERE em.user_employment_user_id = x.user_prof_exp_user_id) AS hire
      FROM sys.sys_user_professional_experiences x
     WHERE x.user_prof_exp_tenant_id = c_rtl
       AND x.user_prof_exp_metadata->>'storia36' = 'C5'
  ),
  calc AS (
    SELECT b.*,
           -- F: lo sfasamento che stacca l'inizio dalla fine degli studi
           (pg_temp.h(b.uid::text || 'OFF') % (1 + LEAST(270, (b.hire - b.inizio) / 4))) AS off
      FROM base b
     WHERE b.inizio IS NOT NULL AND b.hire IS NOT NULL AND b.hire > b.inizio
  ),
  nuovo AS (
    SELECT c.user_prof_exp_id,
           -- E: prima il settore (70/20/10, la distribuzione di prima), poi il
           --    datore DENTRO quel settore
           s.settore,
           s.datori[1 + (pg_temp.h(c.uid::text || c.i || 'EMP') % array_length(s.datori, 1))] AS datore,
           ((c.inizio + c.off) + ((c.i - 1) * (c.hire - c.inizio - c.off) / c.n))::date AS d_ini,
           ((c.inizio + c.off) + (c.i * (c.hire - c.inizio - c.off) / c.n)
              - (7 + pg_temp.h(c.uid::text || c.i || 'GAP') % 80))::date AS d_fin
      FROM calc c
      CROSS JOIN LATERAL (
        SELECT CASE WHEN pg_temp.h(c.uid::text || c.i || 'IND') % 10 < 7 THEN 'Banche e servizi finanziari'
                    WHEN pg_temp.h(c.uid::text || c.i || 'IND') % 10 < 9 THEN 'Assicurazioni'
                    ELSE 'Consulenza e servizi ICT' END AS settore,
               CASE WHEN pg_temp.h(c.uid::text || c.i || 'IND') % 10 < 7
                      THEN ARRAY['Banca Popolare del Verbano','Credito Lombardo SpA',
                                 'Istituto di Credito Adriatico','Banca di Credito Cooperativo Brianza',
                                 'Nuova Cassa di Risparmio Padana','Mediocredito Insubria']
                    WHEN pg_temp.h(c.uid::text || c.i || 'IND') % 10 < 9
                      THEN ARRAY['Assicurazioni Riunite del Nord','Compagnia Assicurativa Lariana',
                                 'Mutua Assicuratrice Padana']
                    ELSE ARRAY['Consorzio Servizi Bancari Italia','Sistemi Informativi Bancari Srl',
                               'Finanziaria Ticinese SpA'] END AS datori) s
  )
  UPDATE sys.sys_user_professional_experiences x
     SET user_prof_exp_industry = n.settore,
         user_prof_exp_employer = n.datore,
         user_prof_exp_start_date = n.d_ini,
         user_prof_exp_end_date = n.d_fin,
         updated_at = now()
    FROM nuovo n
   WHERE x.user_prof_exp_id = n.user_prof_exp_id
     AND (x.user_prof_exp_industry IS DISTINCT FROM n.settore
       OR x.user_prof_exp_employer IS DISTINCT FROM n.datore
       OR x.user_prof_exp_start_date IS DISTINCT FROM n.d_ini
       OR x.user_prof_exp_end_date IS DISTINCT FROM n.d_fin);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'E+F: esperienze riallineate (datore coerente col settore, date disperse): %', v_n;

  -- ==========================================================================
  -- G — INCARICHI SOVRAPPOSTI (difetto legacy, trovato dal check C5k(ii) nuovo)
  --   I sei passaggi di posizione che il legacy già portava chiudevano il
  --   vecchio incarico lo STESSO giorno in cui cominciava il nuovo — e in un
  --   caso diciassette mesi dopo: la persona risultava occupare due posizioni
  --   insieme. Il precedente finisce il giorno prima. Non è un rilievo della
  --   coda: è un difetto che la coda ha fatto emergere, e si corregge qui
  --   (nessun dato si perde, si sposta solo la data di chiusura).
  -- ==========================================================================
  UPDATE sys.sys_user_position_assignments prec
     SET user_position_assignment_end_date = att.user_position_assignment_start_date - 1,
         updated_at = now()
    FROM sys.sys_user_position_assignments att
   WHERE att.user_position_assignment_user_id = prec.user_position_assignment_user_id
     AND att.user_position_assignment_status = 'ACTIVE'
     AND prec.user_position_assignment_tenant_id = c_rtl
     AND prec.user_position_assignment_status = 'ENDED'
     AND prec.user_position_assignment_end_date >= att.user_position_assignment_start_date
     AND att.user_position_assignment_start_date - 1 >= prec.user_position_assignment_start_date;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'G: incarichi precedenti chiusi il giorno prima del subentro: %', v_n;
END $$;

COMMIT;
