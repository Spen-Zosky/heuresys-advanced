-- ============================================================================================
-- 000492 — I titoli delle approvazioni parlano italiano e gli avvisi dei passi decisi si chiudono
--          (controllo forense del portale personale, rilievi D2-14 e D2-07).
--
-- PERCHÉ.
--  · D2-14: il seed storia36 componeva il titolo con un cast numerico e con `FM999G999` in locale
--    inglese: «Richiesta di ferie — 9.00 giorni dal 16/08/2026» (566 titoli) e «Adeguamento retributivo
--    — 1,158 EUR» (86 titoli, più gli avvisi che li ripetono). In italiano: «9 giorni», «1.158 EUR». Il
--    seed è già corretto; qui si riportano a posto le righe esistenti.
--  · D2-07: gli avvisi «Approvazione in attesa/scaduta» puntano a passi già APPROVED o decisi in altro
--    modo (25 nel tenant). Un passo non più in attesa non deve lasciare avvisi aperti: si portano a
--    DISMISSED (non si cancellano). Da ora lo fa il codice alla decisione (approvals/repository.ts).
--
-- IDEMPOTENZA. Ogni UPDATE ha come condizione il difetto stesso: alla seconda passata non trova righe.
-- ROLLBACK. staging.approvazioni_italiano_undo registra, prima della scrittura, il valore di prima di ogni
--   colonna toccata; tornare indietro = riscrivere value_before dove la colonna vale ancora value_after.
-- GUARDIA. Si toccano solo le righe che combaciano con i formati difettosi; nessun'altra colonna.
-- ============================================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS staging.approvazioni_italiano_undo (
  table_name   varchar(63) NOT NULL,
  record_id    uuid        NOT NULL,
  column_name  varchar(63) NOT NULL,
  value_before text,
  value_after  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, record_id, column_name)
);

-- La riscrittura di un titolo è una funzione pura: la stessa per le richieste e per gli avvisi che li citano.
CREATE OR REPLACE FUNCTION staging.titolo_approvazione_in_italiano(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $f$
  SELECT regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(t, '(\d+)\.00 giorni', '\1 giorni'),
               '(\d+)\.(\d)0 giorni', '\1,\2 giorni'),
             '(\d+)\.(\d\d) giorni', '\1,\2 giorni'),
           '(\d{1,3}),(\d{3}) EUR', '\1.\2 EUR')
$f$;

-- ① i titoli delle richieste
INSERT INTO staging.approvazioni_italiano_undo (table_name, record_id, column_name, value_before, value_after)
SELECT 'sys_approval_requests', approval_request_id, 'approval_request_title', approval_request_title,
       staging.titolo_approvazione_in_italiano(approval_request_title)
  FROM sys.sys_approval_requests
 WHERE approval_request_title ~ '(\d+\.\d\d giorni|\d{1,3},\d{3} EUR)'
   AND approval_request_title <> staging.titolo_approvazione_in_italiano(approval_request_title)
ON CONFLICT DO NOTHING;

UPDATE sys.sys_approval_requests
   SET approval_request_title = staging.titolo_approvazione_in_italiano(approval_request_title)
 WHERE approval_request_title ~ '(\d+\.\d\d giorni|\d{1,3},\d{3} EUR)'
   AND approval_request_title <> staging.titolo_approvazione_in_italiano(approval_request_title);

-- ② gli avvisi che ripetono quei titoli
INSERT INTO staging.approvazioni_italiano_undo (table_name, record_id, column_name, value_before, value_after)
SELECT 'sys_inbox_notifications', notification_id, 'notification_subject', notification_subject,
       staging.titolo_approvazione_in_italiano(notification_subject)
  FROM sys.sys_inbox_notifications
 WHERE notification_type IN ('APPROVAL_REMINDER', 'APPROVAL_OVERDUE')
   AND notification_subject ~ '(\d+\.\d\d giorni|\d{1,3},\d{3} EUR)'
   AND notification_subject <> staging.titolo_approvazione_in_italiano(notification_subject)
ON CONFLICT DO NOTHING;

UPDATE sys.sys_inbox_notifications
   SET notification_subject = staging.titolo_approvazione_in_italiano(notification_subject)
 WHERE notification_type IN ('APPROVAL_REMINDER', 'APPROVAL_OVERDUE')
   AND notification_subject ~ '(\d+\.\d\d giorni|\d{1,3},\d{3} EUR)'
   AND notification_subject <> staging.titolo_approvazione_in_italiano(notification_subject);

-- ③ gli avvisi di passi non più in attesa si chiudono (DISMISSED), senza cancellarli
INSERT INTO staging.approvazioni_italiano_undo (table_name, record_id, column_name, value_before, value_after)
SELECT 'sys_inbox_notifications', n.notification_id, 'notification_status', n.notification_status, 'DISMISSED'
  FROM sys.sys_inbox_notifications n
  JOIN sys.sys_approval_steps s ON s.approval_step_id = n.notification_resource_id
 WHERE n.notification_resource_type = 'APPROVAL_STEP'
   AND n.notification_type IN ('APPROVAL_REMINDER', 'APPROVAL_OVERDUE')
   AND n.notification_status <> 'DISMISSED'
   AND s.approval_step_status <> 'PENDING'
ON CONFLICT DO NOTHING;

UPDATE sys.sys_inbox_notifications n
   SET notification_status = 'DISMISSED',
       notification_dismissed_at = COALESCE(n.notification_dismissed_at, now())
  FROM sys.sys_approval_steps s
 WHERE s.approval_step_id = n.notification_resource_id
   AND n.notification_resource_type = 'APPROVAL_STEP'
   AND n.notification_type IN ('APPROVAL_REMINDER', 'APPROVAL_OVERDUE')
   AND n.notification_status <> 'DISMISSED'
   AND s.approval_step_status <> 'PENDING';

COMMIT;
