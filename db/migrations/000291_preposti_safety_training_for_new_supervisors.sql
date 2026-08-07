-- ═══════════════════════════════════════════════════════════════════════════════
-- 000291_preposti_safety_training_for_new_supervisors.sql
--
-- #167 / `C4h(ii)` — CHI GUIDA QUALCUNO HA L'AGGIORNAMENTO SICUREZZA CHE LA LEGGE GLI CHIEDE.
--
-- IL TRIAGE. Esito **(a) dato mancante** — il fatto non c'è e va creato con la regola
-- del cluster che lo possiede, non aggirato ammorbidendo il controllo.
--
-- LA MISURA. `C4h(ii)` non legge un elenco scritto a mano: **deriva** la platea
-- dall'organigramma — preposto = chi ha riporti diretti (D.Lgs 81/08). Oggi i preposti
-- sono **40** e solo **16** hanno l'aggiornamento valido: ne mancano **24**. È la stessa
-- classe di difetto di `C2c` e `C3c`: **l'organigramma è cambiato e gli obblighi che ne
-- discendono non l'hanno seguito**. Chi ha ricevuto dei riporti è diventato preposto per
-- legge nello stesso istante, ma nessuno gli ha dato la formazione.
--
-- COSA SI CREA, E PERCHÉ COSÌ. Nessun campo è inventato: sono tutti ricavati dalle 96
-- righe già esistenti dello stesso attestato. L'ultima tornata di aggiornamento è del
-- **2025-07-31** (validità biennale, ente **INAIL**, `progressivo` 3): i 24 entrano in
-- **quella** tornata, che è ciò che un'azienda fa davvero — i nuovi preposti seguono il
-- corso insieme agli altri, non uno per uno in date sparse. La data non è scelta: è la
-- più recente presente nel dato.
--
-- Il codice dell'attestato è **derivato** dall'identificativo della persona, quindi è
-- stabile fra riesecuzioni e fra macchine: rigenerarlo a caso creerebbe un codice nuovo
-- a ogni giro e romperebbe l'idempotenza.
--
-- REVERSIBILE senza giornale separato: le righe create portano `origine: "000291"` nei
-- metadati, e `staging.storia36_167_c4h_rollback()` cancella esattamente quelle. Un
-- marcatore nel dato è più solido di una tabella di appoggio che qualcuno può svuotare.
--
-- Idempotente: si crea solo per chi non ce l'ha valido.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  c_rtl  constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_nome constant text := 'Aggiornamento preposti (D.Lgs 81/08 art. 37)';
  v_emiss date;
  v_scad  date;
  v_ente  text;
  v_prog  int;
  v_ins   bigint;
  v_res   bigint;
BEGIN
  -- I parametri della tornata si LEGGONO dall'ultima esistente: se un domani la
  -- cadenza cambiasse, questa migrazione seguirebbe il dato invece di contraddirlo.
  SELECT user_certification_issued_date, user_certification_expires_date,
         user_certification_issuer, (user_certification_metadata->>'progressivo')::int
    INTO v_emiss, v_scad, v_ente, v_prog
    FROM sys.sys_user_certifications
   WHERE user_certification_name = c_nome
   ORDER BY user_certification_issued_date DESC, user_certification_expires_date DESC
   LIMIT 1;

  IF v_emiss IS NULL THEN
    RAISE EXCEPTION '000291: non esiste nessun attestato «%» da cui ricavare la tornata', c_nome;
  END IF;

  INSERT INTO sys.sys_user_certifications (
    user_certification_user_id, user_certification_tenant_id, user_certification_name,
    user_certification_issuer, user_certification_issued_date, user_certification_expires_date,
    user_certification_credential_id, user_certification_metadata)
  SELECT u.user_id, c_rtl, c_nome, v_ente, v_emiss, v_scad,
         'ATT-' || upper(substring(md5(u.user_id::text || '000291') for 10)),
         jsonb_build_object('blocco','sicurezza','storia36','C4','progressivo',v_prog,'origine','000291')
    FROM sys.sys_users u
    JOIN sys.sys_user_position_assignments a
      ON a.user_position_assignment_user_id = u.user_id
     AND a.user_position_assignment_kind = 'PRIMARY'
     AND a.user_position_assignment_status = 'ACTIVE'
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND EXISTS (SELECT 1 FROM sys.sys_positions p
                  WHERE p.position_reports_to_position_id = a.user_position_assignment_position_id)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_certifications c
                      WHERE c.user_certification_user_id = u.user_id
                        AND c.user_certification_name ILIKE '%preposti%'
                        AND c.user_certification_expires_date >= v_emiss);
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  -- POST-CONDIZIONE — il predicato di C4h(ii), ricalcolato alla frontiera della storia.
  SELECT count(*) INTO v_res
    FROM sys.sys_users u
    JOIN sys.sys_user_position_assignments a
      ON a.user_position_assignment_user_id = u.user_id
     AND a.user_position_assignment_kind = 'PRIMARY'
     AND a.user_position_assignment_status = 'ACTIVE'
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND EXISTS (SELECT 1 FROM sys.sys_positions p
                  WHERE p.position_reports_to_position_id = a.user_position_assignment_position_id)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_certifications c
                      WHERE c.user_certification_user_id = u.user_id
                        AND c.user_certification_name ILIKE '%preposti%'
                        AND c.user_certification_expires_date >= COALESCE(staging.storia36_c4_frontier(), CURRENT_DATE));
  IF v_res > 0 THEN
    RAISE EXCEPTION '000291: restano % preposti senza aggiornamento valido', v_res;
  END IF;

  RAISE NOTICE '000291 done: % attestati emessi nella tornata del % (scadenza %); preposti scoperti: 0',
    v_ins, v_emiss, v_scad;
END $mig$;

CREATE OR REPLACE FUNCTION staging.storia36_167_c4h_rollback()
RETURNS TABLE(cancellati bigint) LANGUAGE plpgsql AS $fn$
DECLARE v_n bigint;
BEGIN
  DELETE FROM sys.sys_user_certifications
   WHERE user_certification_metadata->>'origine' = '000291';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN QUERY SELECT v_n;
END $fn$;

COMMIT;
