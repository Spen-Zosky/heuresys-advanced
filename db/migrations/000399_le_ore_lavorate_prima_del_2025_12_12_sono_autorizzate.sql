-- 000399 — LA SANATORIA STORICA DEGLI STRAORDINARI (decisione di Enzo, 2026-09-10).
--
-- LA DECISIONE, nelle sue parole: «saniamo le 9410 giornate». B9 (S1095) aveva autorizzato
-- retroattivamente le ore lavorate DOPO il 2025-12-12, cioe' da quando il processo di richiesta
-- si era fermato. Restava tutto cio' che sta PRIMA di quella data: ore lavorate e registrate in
-- `sys_attendance` che non hanno mai avuto una riga in `sys_overtime`, e che nessun controllo
-- guardava — perche' la sentinella `v_straordinari_non_autorizzati` guarda solo le presenze
-- SUCCESSIVE all'ultima richiesta registrata, e dopo B9 quella data e' diventata l'altroieri.
--
-- (a) LA MISURA PRIMA, dal vivo, 2026-09-10:
--     9.410 giornate · 9.422,78 ore · 126 persone · 1 cliente (RTL_BANK) · dal 2023-08-01 al
--     2025-12-12 · zero cadono di sabato o domenica · tutte e 126 le persone esistono e sono
--     attive · tutte e 9.410 trovano un approvatore (28 approvatori distinti) · zero
--     auto-approvazioni previste.
--
-- ⚠ NON SI REPLICA LA FORMA DI B9. Le 2.436 righe di B9 risultano CHIESTE dalla persona stessa
-- (2.436 su 2.436) e in 175 casi anche APPROVATE da lei. Nelle 188 richieste originali del
-- prodotto questo non accade mai: zero e zero. Qui si usa invece la catena del seed
-- `13_avanzamento.sql` come corretto in S1096 — responsabile dell'unita' della persona, mai la
-- persona stessa, e se non c'e' nessuno la riga NON si scrive: «meglio una sentinella che resta
-- rossa e lo dice, che una autorizzazione firmata da nessuno». Le 175 auto-approvazioni di B9
-- sono un rilievo a se' e non si toccano qui.
--
-- ⚠ QUESTA MIGRAZIONE SANA DATI, NON CREA STRUTTURA. Su un ambiente dove quelle presenze non
-- esistono (un database ricostruito prima dei seed) non trova nulla, scrive zero righe e passa:
-- e' corretto, e le post-condizioni sono scritte per reggere anche a zero — nessuna di loro
-- pretende un numero assoluto, tutte confrontano il fatto con la misura presa nella STESSA
-- transazione.
--
-- (d) ROLLBACK DICHIARATO: `staging.sanatoria_straordinari_9410_undo` elenca gli overtime_id
--     creati. Per disfare: DELETE FROM sys.sys_overtime WHERE overtime_id IN (SELECT ... ).

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS staging.sanatoria_straordinari_9410_undo (
  overtime_id  uuid PRIMARY KEY,
  creato_il    timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_da_sanare        bigint;
  v_creato           bigint;
  v_att_righe_prima  bigint;
  v_att_ore_prima    numeric;
  v_att_righe_dopo   bigint;
  v_att_ore_dopo     numeric;
  v_b9_prima         bigint;
  v_orig_prima       bigint;
  v_residue          bigint;
  v_auto             bigint;
BEGIN
  -- ── (a) la misura, presa ADESSO e non ereditata ──────────────────────────────────────
  SELECT count(*), coalesce(sum(attendance_hours_overtime), 0)
    INTO v_att_righe_prima, v_att_ore_prima
    FROM sys.sys_attendance WHERE attendance_hours_overtime > 0;

  SELECT count(*) INTO v_b9_prima
    FROM sys.sys_overtime WHERE overtime_natural_key LIKE 'B9-SANATORIA::%';
  SELECT count(*) INTO v_orig_prima
    FROM sys.sys_overtime
   WHERE overtime_natural_key NOT LIKE 'B9-SANATORIA::%'
     AND overtime_natural_key NOT LIKE 'SANATORIA-STORICA::%';

  CREATE TEMP TABLE _da_sanare ON COMMIT DROP AS
  SELECT a.attendance_tenant_id       AS tenant_id,
         a.attendance_subject_user_id AS persona,
         a.attendance_date            AS giorno,
         a.attendance_hours_overtime  AS ore,
         app.approvatore
    FROM sys.sys_attendance a
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        (SELECT ou.organization_unit_manager_user_id
           FROM sys.sys_user_position_assignments upa
           JOIN sys.sys_positions p
             ON p.position_id = upa.user_position_assignment_position_id
           JOIN sys.sys_organization_units ou
             ON ou.organization_unit_id = p.position_organization_unit_id
          WHERE upa.user_position_assignment_user_id = a.attendance_subject_user_id
            AND upa.user_position_assignment_status = 'ACTIVE'
            AND ou.organization_unit_manager_user_id IS NOT NULL
            AND ou.organization_unit_manager_user_id <> a.attendance_subject_user_id
          LIMIT 1),
        (SELECT ur.user_auth_role_user_id
           FROM sys.sys_user_auth_roles ur
           JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
          WHERE r.auth_role_code = 'HRMS_MANAGER'
            AND ur.user_auth_role_tenant_id = a.attendance_tenant_id
            AND ur.user_auth_role_revoked_at IS NULL
            AND ur.user_auth_role_user_id <> a.attendance_subject_user_id
          LIMIT 1)
      ) AS approvatore) app
   WHERE a.attendance_hours_overtime > 0
     AND app.approvatore IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_overtime o
        WHERE o.overtime_subject_user_id = a.attendance_subject_user_id
          AND o.overtime_date = a.attendance_date
          AND o.overtime_hours > 0);

  SELECT count(*) INTO v_da_sanare FROM _da_sanare;
  RAISE NOTICE 'sanatoria storica: % giornate da autorizzare', v_da_sanare;

  -- ── la scrittura, con l'elenco esplicito e il giornale del rollback ───────────────────
  WITH inserite AS (
    INSERT INTO sys.sys_overtime (
      overtime_tenant_id, overtime_natural_key, overtime_subject_user_id, overtime_date,
      overtime_type, overtime_hours, overtime_status,
      overtime_requested_by_user_id, overtime_requested_at,
      overtime_approved_by_user_id, overtime_approved_at,
      overtime_reason, overtime_metadata)
    SELECT
      d.tenant_id,
      'SANATORIA-STORICA::' || d.persona || '::' || d.giorno,
      d.persona, d.giorno,
      CASE WHEN extract(isodow FROM d.giorno) >= 6 THEN 'WEEKEND' ELSE 'WEEKDAY' END,
      d.ore, 'APPROVED',
      d.approvatore, d.giorno::timestamptz,
      d.approvatore, now(),
      'Sanatoria storica (decisione di Enzo, 2026-09-10): ore lavorate e registrate in '
        || 'sys_attendance prima del 2025-12-12 senza la corrispondente richiesta. '
        || 'Autorizzazione retroattiva firmata dal responsabile dell''unita'', non dalla persona '
        || 'stessa. Non sono ore nuove: le ore erano gia'' registrate, mancava l''atto che le '
        || 'autorizza.',
      jsonb_build_object('sanatoria', true, 'ambito', 'storica', 'decisa_il', '2026-09-10')
    FROM _da_sanare d
    ON CONFLICT (overtime_tenant_id, overtime_natural_key) DO NOTHING
    RETURNING overtime_id)
  INSERT INTO staging.sanatoria_straordinari_9410_undo (overtime_id)
  SELECT overtime_id FROM inserite
  ON CONFLICT (overtime_id) DO NOTHING;

  GET DIAGNOSTICS v_creato = ROW_COUNT;

  -- ── (b) LA GUARDIA: ho scritto esattamente ciò che avevo misurato un attimo fa ────────
  IF v_creato <> v_da_sanare THEN
    RAISE EXCEPTION 'sanatoria storica: misurate % giornate ma scritte % righe — non scrivo al buio',
      v_da_sanare, v_creato;
  END IF;

  -- ── POST 1: non resta nessuna ora senza autorizzazione, fra quelle che avevano un capo ─
  SELECT count(*) INTO v_residue FROM _da_sanare d
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_overtime o
      WHERE o.overtime_subject_user_id = d.persona AND o.overtime_date = d.giorno
        AND o.overtime_hours > 0);
  IF v_residue <> 0 THEN
    RAISE EXCEPTION 'sanatoria storica: % giornate misurate sono rimaste senza richiesta', v_residue;
  END IF;

  -- ── POST 2: nessuno ha autorizzato se stesso (è la ragione per cui non copio B9) ──────
  SELECT count(*) INTO v_auto FROM sys.sys_overtime
   WHERE overtime_natural_key LIKE 'SANATORIA-STORICA::%'
     AND (overtime_approved_by_user_id = overtime_subject_user_id
       OR overtime_requested_by_user_id = overtime_subject_user_id);
  IF v_auto <> 0 THEN
    RAISE EXCEPTION 'sanatoria storica: % righe risultano firmate dalla persona stessa', v_auto;
  END IF;

  -- ── (c) POST 3: ciò che NON doveva cambiare non è cambiato ────────────────────────────
  SELECT count(*), coalesce(sum(attendance_hours_overtime), 0)
    INTO v_att_righe_dopo, v_att_ore_dopo
    FROM sys.sys_attendance WHERE attendance_hours_overtime > 0;
  IF v_att_righe_dopo <> v_att_righe_prima OR v_att_ore_dopo <> v_att_ore_prima THEN
    RAISE EXCEPTION 'sanatoria storica: le presenze sono cambiate (% righe/% ore prima, % righe/% ore dopo) — questa migrazione non le tocca',
      v_att_righe_prima, v_att_ore_prima, v_att_righe_dopo, v_att_ore_dopo;
  END IF;

  IF (SELECT count(*) FROM sys.sys_overtime WHERE overtime_natural_key LIKE 'B9-SANATORIA::%') <> v_b9_prima THEN
    RAISE EXCEPTION 'sanatoria storica: le righe di B9 sono cambiate — non e'' compito di questo file';
  END IF;

  IF (SELECT count(*) FROM sys.sys_overtime
       WHERE overtime_natural_key NOT LIKE 'B9-SANATORIA::%'
         AND overtime_natural_key NOT LIKE 'SANATORIA-STORICA::%') <> v_orig_prima THEN
    RAISE EXCEPTION 'sanatoria storica: le richieste originali sono cambiate — non e'' compito di questo file';
  END IF;

  RAISE NOTICE 'sanatoria storica: % righe scritte, presenze intatte (% righe, % ore)',
    v_creato, v_att_righe_dopo, v_att_ore_dopo;
END $$;

COMMIT;
