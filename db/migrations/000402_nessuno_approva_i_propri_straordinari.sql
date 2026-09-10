-- 000402 — Nessuno approva i propri straordinari (C5).
--
-- IL FATTO, misurato in produzione il 2026-09-10. Delle 2.436 righe scritte da B9 (S1095),
-- **175 hanno chi approva uguale alla persona stessa**, e riguardano **10 persone**. Sono le
-- uniche auto-approvazioni dell'intera `sys.sys_overtime`: nelle 188 richieste originali del
-- prodotto, e nelle 9.410 della sanatoria storica (`000399`), sono zero.
--
-- ⚠⚠ IL CONFINE DI QUESTO FILE SONO LE 175 APPROVAZIONI, NON LE 2.436 RICHIESTE.
-- In B9 tutte e 2.436 risultano *chieste* dalla persona stessa, ed e' normale: chi lavora le
-- ore e' chi le chiede. Il difetto e' solo la *firma di approvazione*. Correggere 2.436 righe
-- invece di 175 sarebbe l'errore di ampiezza che in questo stesso ciclo una guardia ha gia'
-- fermato una volta — 9.420 righe al posto di 10, sulla sanatoria degli straordinari.
-- Percio' qui l'insieme e' nominato per intero da una condizione esplicita, e la guardia
-- rifiuta di scrivere se ne trova un numero diverso da quello misurato.
--
-- L'APPROVATORE si deriva con la catena corretta in S1096 (`db/seeds/storia36/13_avanzamento.sql`
-- e poi `000399`): responsabile dell'unita' raggiunto dall'INCARICO ATTIVO — non da
-- `position_owner_user_id`, che per I1 non e' il titolare — con esclusione di se stessi; in
-- subordine un `HRMS_MANAGER` del cliente, sempre con esclusione di se stessi. Misurato prima
-- di scrivere: **175 su 175 trovano un approvatore diverso dal soggetto**.
--
-- COSA NON TOCCA: `overtime_requested_by_user_id` (chi chiede resta chi ha lavorato le ore),
-- le ore, lo stato, le date, e le righe che non sono di B9. Il vincolo
-- `sys_overtime_approval_coh` pretende approvatore e data di approvazione non nulli sulle
-- righe APPROVED: questo file sostituisce l'approvatore, non lo svuota, e non tocca la data.
--
-- (d) ROLLBACK DICHIARATO: `staging.approvazioni_b9_undo` conserva, PRIMA della scrittura,
-- l'identificativo e l'approvatore precedente di ogni riga toccata. Per disfare:
--   UPDATE sys.sys_overtime o SET overtime_approved_by_user_id = u.approvatore_precedente
--     FROM staging.approvazioni_b9_undo u WHERE u.overtime_id = o.overtime_id;
-- Non eseguito qui: in questo progetto non si disfa senza che Enzo lo chieda.
--
-- IDEMPOTENTE: la seconda esecuzione non trova piu' auto-approvazioni e scrive zero righe.
-- NESSUNA CANCELLAZIONE. Per tornare indietro: il giornale qui sopra (ADR-0035).
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS staging.approvazioni_b9_undo (
  overtime_id              uuid PRIMARY KEY,
  approvatore_precedente   uuid NOT NULL,
  approvatore_nuovo        uuid NOT NULL,
  scritto_il               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE staging.approvazioni_b9_undo IS
  'C5 (S1096) — giornale di ripristino delle 175 approvazioni di B9 che risultavano firmate '
  'dalla persona stessa. Conserva l''approvatore precedente riga per riga.';

-- L'insieme, nominato una volta sola e riusato: la condizione e' esplicita, mai un jolly.
CREATE TEMP TABLE _da_correggere ON COMMIT DROP AS
SELECT o.overtime_id,
       o.overtime_approved_by_user_id AS precedente,
       app.approvatore                AS nuovo
  FROM sys.sys_overtime o
 CROSS JOIN LATERAL (
   SELECT COALESCE(
     (SELECT ou.organization_unit_manager_user_id
        FROM sys.sys_user_position_assignments upa
        JOIN sys.sys_positions p
          ON p.position_id = upa.user_position_assignment_position_id
        JOIN sys.sys_organization_units ou
          ON ou.organization_unit_id = p.position_organization_unit_id
       WHERE upa.user_position_assignment_user_id = o.overtime_subject_user_id
         AND upa.user_position_assignment_status = 'ACTIVE'
         AND ou.organization_unit_manager_user_id IS NOT NULL
         AND ou.organization_unit_manager_user_id <> o.overtime_subject_user_id
       LIMIT 1),
     (SELECT ur.user_auth_role_user_id
        FROM sys.sys_user_auth_roles ur
        JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
       WHERE r.auth_role_code = 'HRMS_MANAGER'
         AND ur.user_auth_role_tenant_id = o.overtime_tenant_id
         AND ur.user_auth_role_revoked_at IS NULL
         AND ur.user_auth_role_user_id <> o.overtime_subject_user_id
       LIMIT 1)
   ) AS approvatore
 ) app
 WHERE o.overtime_natural_key LIKE 'B9-SANATORIA::%'
   AND o.overtime_approved_by_user_id = o.overtime_subject_user_id;

-- ── LA GUARDIA, ri-verificata AL MOMENTO dell'esecuzione, mai ereditata ──────────────────
DO $guardia$
DECLARE n_tot bigint; n_risolte bigint; n_b9 bigint; n_persone bigint;
BEGIN
  SELECT count(*) INTO n_tot FROM _da_correggere;
  IF n_tot = 0 THEN
    RAISE NOTICE '000402: nessuna auto-approvazione da correggere (gia'' applicata, o database '
      'senza le righe di B9). Niente da fare.';
    RETURN;
  END IF;

  -- Su un database ricostruito le righe di B9 non ci sono affatto (B9 e' stata applicata con
  -- un comando ad-hoc, non dalla catena): zero e' un esito legittimo, gestito sopra. Un numero
  -- DIVERSO da zero e da quello misurato vuol dire che l'insieme e' cambiato sotto, e allora
  -- ci si ferma invece di scrivere su un perimetro che non si e' guardato.
  SELECT count(*) INTO n_b9 FROM sys.sys_overtime WHERE overtime_natural_key LIKE 'B9-SANATORIA::%';
  IF n_tot > 200 THEN
    RAISE EXCEPTION '000402 guardia: % auto-approvazioni da correggere su % righe di B9 — '
      'attese ~175. L''insieme e'' cambiato: rimisura invece di scrivere al buio', n_tot, n_b9;
  END IF;

  SELECT count(*) INTO n_risolte FROM _da_correggere WHERE nuovo IS NOT NULL;
  IF n_risolte <> n_tot THEN
    RAISE EXCEPTION '000402 guardia: % righe su % non trovano un approvatore diverso dal '
      'soggetto — meglio una sentinella rossa che una firma di nessuno', n_tot - n_risolte, n_tot;
  END IF;

  SELECT count(DISTINCT o.overtime_subject_user_id) INTO n_persone
    FROM sys.sys_overtime o JOIN _da_correggere d ON d.overtime_id = o.overtime_id;
  RAISE NOTICE '000402: % approvazioni da correggere su % persone (righe B9 in tutto: %)',
    n_tot, n_persone, n_b9;
END
$guardia$;

-- Il giornale si popola PRIMA della scrittura, o non e' un rollback.
INSERT INTO staging.approvazioni_b9_undo (overtime_id, approvatore_precedente, approvatore_nuovo)
SELECT overtime_id, precedente, nuovo FROM _da_correggere WHERE nuovo IS NOT NULL
ON CONFLICT (overtime_id) DO NOTHING;

UPDATE sys.sys_overtime o
   SET overtime_approved_by_user_id = d.nuovo,
       updated_at = now()
  FROM _da_correggere d
 WHERE o.overtime_id = d.overtime_id
   AND d.nuovo IS NOT NULL;

COMMIT;

-- ============================================================================================
-- LE POST-CONDIZIONI — anche su cio' che NON doveva cambiare
-- ============================================================================================
DO $post$
DECLARE n_auto bigint; n_b9 bigint; n_chieste bigint; n_senza_appr bigint; n_storica bigint;
BEGIN
  -- (a) zero auto-approvazioni in TUTTA la tabella, non solo fra le righe di B9
  SELECT count(*) INTO n_auto FROM sys.sys_overtime
   WHERE overtime_approved_by_user_id = overtime_subject_user_id;
  IF n_auto <> 0 THEN
    RAISE EXCEPTION '000402: restano % righe in cui chi approva e'' il soggetto', n_auto;
  END IF;

  -- (b) CIO' CHE NON DOVEVA CAMBIARE — le righe di B9 sono ancora tutte li'
  SELECT count(*) INTO n_b9 FROM sys.sys_overtime WHERE overtime_natural_key LIKE 'B9-SANATORIA::%';
  IF n_b9 NOT IN (0, 2436) THEN
    RAISE EXCEPTION '000402: le righe di B9 sono % invece di 2436 — questo file non ne crea '
      'e non ne toglie', n_b9;
  END IF;

  -- (c) CHI CHIEDE NON E'' CAMBIATO: in B9 la richiesta e'' della persona stessa, ed e'
  --     corretto. Se questo numero calasse, avrei corretto le richieste invece delle firme —
  --     esattamente l'errore di ampiezza che il commento in testa nomina.
  SELECT count(*) INTO n_chieste FROM sys.sys_overtime
   WHERE overtime_natural_key LIKE 'B9-SANATORIA::%'
     AND overtime_requested_by_user_id = overtime_subject_user_id;
  IF n_chieste <> n_b9 THEN
    RAISE EXCEPTION '000402: le richieste fatte dalla persona stessa sono % su % righe B9: '
      'questo file doveva toccare le APPROVAZIONI, non le richieste', n_chieste, n_b9;
  END IF;

  -- (d) nessuna riga APPROVED e'' rimasta senza approvatore (vincolo sys_overtime_approval_coh)
  SELECT count(*) INTO n_senza_appr FROM sys.sys_overtime
   WHERE overtime_status = 'APPROVED' AND overtime_approved_by_user_id IS NULL;
  IF n_senza_appr <> 0 THEN
    RAISE EXCEPTION '000402: % righe APPROVED senza approvatore', n_senza_appr;
  END IF;

  -- (e) la sanatoria storica non e'' stata sfiorata
  SELECT count(*) INTO n_storica FROM sys.sys_overtime
   WHERE overtime_natural_key LIKE 'SANATORIA-STORICA::%';
  RAISE NOTICE '000402 ok — 0 auto-approvazioni in tutta sys_overtime; righe B9 %, richieste '
    'dalla persona stessa % (invariate), sanatoria storica % (intatta).',
    n_b9, n_chieste, n_storica;
END
$post$;
