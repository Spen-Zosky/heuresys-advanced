-- 000231_inbox_notify_trigger.sql
-- #38 B6 — la posta in arrivo passa dal sondaggio ogni 30s alla notifica immediata.
--
-- Il push vero nasce QUI, non nel client: alla scrittura di una notifica il database
-- avvisa chi è in ascolto con NOTIFY. L'alternativa — far interrogare il database
-- all'API ogni pochi secondi — sposterebbe soltanto il sondaggio dal browser al
-- server, moltiplicandolo per il numero di processi invece che di schede aperte.
--
-- Il payload porta solo gli identificativi: NOTIFY ha un limite di 8000 byte, e il
-- contenuto della notifica non deve viaggiare per un canale che non ha né permessi né
-- filtro per tenant. Chi riceve l'avviso rilegge dall'API, dove i controlli valgono.
--
-- Il trigger scatta su INSERT e sui cambi di stato (letta/archiviata): anche una
-- notifica che sparisce cambia ciò che l'utente deve vedere, e lasciarla fuori
-- significherebbe che il conteggio dei non letti resta indietro fino al ricaricamento.
--
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS prima di ricrearlo.

CREATE OR REPLACE FUNCTION sys.fn_notify_inbox_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_user uuid;
  target_tenant uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user   := OLD.notification_user_id;
    target_tenant := OLD.notification_tenant_id;
  ELSE
    target_user   := NEW.notification_user_id;
    target_tenant := NEW.notification_tenant_id;
  END IF;

  -- Il canale è unico e il destinatario viaggia nel payload: un canale per utente
  -- costringerebbe l'API a un LISTEN per ogni sessione aperta, che non scala.
  PERFORM pg_notify(
    'inbox_changed',
    json_build_object(
      'userId',   target_user,
      'tenantId', target_tenant,
      'op',       TG_OP
    )::text
  );
  RETURN NULL; -- AFTER trigger: il valore di ritorno è ignorato
END
$$;

DROP TRIGGER IF EXISTS trg_inbox_notification_changed ON sys.sys_inbox_notifications;

CREATE TRIGGER trg_inbox_notification_changed
AFTER INSERT OR DELETE ON sys.sys_inbox_notifications
FOR EACH ROW EXECUTE FUNCTION sys.fn_notify_inbox_change();

-- Aggiornamento: solo quando cambia qualcosa che l'utente vede. Un UPDATE che tocca
-- altre colonne non deve svegliare tutte le schede aperte.
DROP TRIGGER IF EXISTS trg_inbox_notification_status_changed ON sys.sys_inbox_notifications;

CREATE TRIGGER trg_inbox_notification_status_changed
AFTER UPDATE OF notification_status, notification_read_at, notification_dismissed_at
ON sys.sys_inbox_notifications
FOR EACH ROW
WHEN (OLD.notification_status IS DISTINCT FROM NEW.notification_status
   OR OLD.notification_read_at IS DISTINCT FROM NEW.notification_read_at
   OR OLD.notification_dismissed_at IS DISTINCT FROM NEW.notification_dismissed_at)
EXECUTE FUNCTION sys.fn_notify_inbox_change();

COMMENT ON FUNCTION sys.fn_notify_inbox_change() IS
  '#38 B6 — avvisa gli ascoltatori (canale «inbox_changed») quando la posta in arrivo di un '
  'utente cambia. Il payload porta SOLO gli identificativi: chi riceve rilegge dall''API, dove '
  'valgono permessi e filtro per tenant.';
