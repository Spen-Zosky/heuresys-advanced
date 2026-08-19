-- ============================================================================
-- 000317 — L'organigramma dichiara di mostrare persone, e resta visibile a tutti
--          (#193 — decisione di Enzo, 2026-08-16)
--
-- IL DIFETTO CHE CHIUDE. La voce `ORG_CHART` non dichiarava alcuna classe di dato.
-- Per la regola M3 (mig. 000315) quel silenzio e' un'AFFERMAZIONE: «questa pagina non
-- espone dati di persona». Su un organigramma — che mostra nomi, ruoli e collocazione —
-- e' semplicemente falsa. Trovata dall'E2E di #99 F8b su un caso vero.
--
-- PERCHE' NON BASTAVA DICHIARARE `PERSONAL`. Dichiararla la sottoporrebbe a M1, e chi non
-- ha ALCUN dominio ha per definizione zero celle aperte: perderebbe la voce. Misurato sul
-- vivo il 2026-08-16: 117 utenti su 161 non hanno alcun dominio, e per uno di loro
-- (`antonio.parisi@rtl-bank.org`, letto in produzione con il suo login) `ORG_CHART` e'
-- **l'unica voce non-personale dell'intero menu** — WORKFORCE 1, GOVERNANCE 0,
-- INTELLIGENCE 0, OVERVIEW 0. Dichiararla e basta avrebbe spento l'unica finestra che la
-- maggioranza dell'azienda ha sull'azienda.
--
-- LA DECISIONE DI ENZO (2026-08-16), che scioglie il nodo:
--   «l'organigramma aziendale deve restare visibile a chiunque lavori in azienda».
-- Conferma e generalizza la direzione del 2026-08-05 sulla «rubrica aziendale».
--
-- LA FORMA SCELTA, e perche' non le altre due. Serve un terzo stato: la voce dichiara il
-- vero (mostra persone) E dichiara che quel dato e' aperto a chi lavora nel tenant.
--   (a) tacere            → e' lo stato di prima: un'affermazione falsa. Scartata.
--   (b) classe nuova      → un livello `DIRECTORY` distinto da `PERSONAL` sarebbe
--                           concettualmente pulito, ma trascina M1 (11 domini x 7 classi),
--                           `DataClass`, il cancello di `data-classes.ts` e ogni consumatore.
--                           Costo sproporzionato per una voce. Scartata, e registrata come
--                           strada se un giorno le voci «rubrica» diventassero molte.
--   (c) esenzione dichiarata sulla riga → chirurgica, additiva, e la ragione VIVE NEL DATO.
--                           Scelta.
--
-- L'ESENZIONE PRETENDE UNA RAGIONE, e il vincolo lo impone il database: un'esenzione senza
-- motivo scritto e' indistinguibile da una dimenticanza — lo stesso principio per cui le
-- esclusioni di `data-classes.ts` sono elencate una per una e mai con un jolly.
--
-- ⚠ NON tocca l'API: `/v1/organization-units` chiede `organization_unit:read`, che
-- **tutti e 161** gli utenti attivi detengono (misurato). Qui si allinea il menu a cio'
-- che l'API gia' concede; non si apre nulla di nuovo.
-- ============================================================================

ALTER TABLE sys.sys_ui_interface_data_classes
  ADD COLUMN IF NOT EXISTS data_class_open_to_tenant boolean NOT NULL DEFAULT false;

ALTER TABLE sys.sys_ui_interface_data_classes
  ADD COLUMN IF NOT EXISTS data_class_open_reason text;

COMMENT ON COLUMN sys.sys_ui_interface_data_classes.data_class_open_to_tenant IS
  'La voce espone questa classe, ma il dato e'' di livello RUBRICA AZIENDALE: aperto a '
  'chiunque lavori nel tenant, quindi M1 non lo filtra. NON e'' una scorciatoia per '
  'sbloccare una pagina: e'' una decisione di prodotto, e la colonna accanto ne pretende '
  'la ragione. Default false: il silenzio non concede nulla.';

COMMENT ON COLUMN sys.sys_ui_interface_data_classes.data_class_open_reason IS
  'Perche'' quella classe e'' aperta al tenant, con autore e data. Obbligatoria quando '
  'data_class_open_to_tenant e'' vero.';

-- Un'esenzione senza ragione non deve poter esistere.
ALTER TABLE sys.sys_ui_interface_data_classes
  DROP CONSTRAINT IF EXISTS sys_ui_interface_data_classes_open_needs_reason;
ALTER TABLE sys.sys_ui_interface_data_classes
  ADD CONSTRAINT sys_ui_interface_data_classes_open_needs_reason
  CHECK (data_class_open_to_tenant = false OR data_class_open_reason IS NOT NULL);

-- ── La dichiarazione: l'organigramma mostra persone, e quel dato e' la rubrica aziendale.
--
-- ⚠ LE VOCI SONO DUE, non una, e la prima stesura ne dichiarava una sola. A trovarlo e'
-- stato un test che c'era gia' — «esige la classe su ogni voce la cui resource e'
-- person-level» — andato rosso appena `organization_unit` e' diventata person-level:
-- `/organization` usa la stessa resource, mostra la stessa materia, e senza la sua riga
-- sarebbe rimasta una voce person-level muta. Elencate per codice, mai per `LIKE`.
INSERT INTO sys.sys_ui_interface_data_classes
  (ui_interface_id, data_class, data_class_open_to_tenant, data_class_open_reason)
SELECT i.ui_interface_id, 'PERSONAL', true,
       'Enzo, 2026-08-16 (#193): «l''organigramma aziendale deve restare visibile a '
       'chiunque lavori in azienda». Mostra nomi e collocazione — quindi PERSONAL, detto '
       'per intero — ma di livello rubrica aziendale, non dato sensibile: M1 non lo '
       'filtra. Conferma la direzione del 2026-08-05. Senza questa riga la voce sparirebbe '
       'a 117 utenti su 161.'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_code IN ('ORG_CHART', 'org')
ON CONFLICT ON CONSTRAINT sys_ui_interface_data_classes_uq DO UPDATE
  SET data_class_open_to_tenant = EXCLUDED.data_class_open_to_tenant,
      data_class_open_reason    = EXCLUDED.data_class_open_reason;

DO $$
DECLARE
  n_org int; n_aperte int; n_senza_ragione int; n_personal int; n_dich int;
BEGIN
  -- 1. la dichiarazione esiste, ed e' aperta
  SELECT count(*) INTO n_org
    FROM sys.sys_ui_interface_data_classes dc
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
   WHERE i.ui_interface_code IN ('ORG_CHART', 'org')
     AND dc.data_class = 'PERSONAL' AND dc.data_class_open_to_tenant;
  IF n_org <> 2 THEN
    RAISE EXCEPTION '000317: le voci della struttura che dichiarano PERSONAL aperta sono % invece di 2 (ORG_CHART + org)', n_org;
  END IF;

  -- 2. ⚠ POST-CONDIZIONE CHE PROTEGGE CIO' CHE NON DOVEVA CAMBIARE, ed e' la piu'
  --    importante: le esenzioni devono restare DUE — le due voci della struttura, e nessuna
  --    altra. Se domani ne comparisse una terza senza passare da una decisione, M1 verrebbe
  --    svuotata un pezzo per volta, in silenzio — che e' il modo in cui i cancelli muoiono
  --    davvero. Il numero non e' sacro: cambiarlo deve costare una riga e una ragione.
  SELECT count(*) INTO n_aperte
    FROM sys.sys_ui_interface_data_classes WHERE data_class_open_to_tenant;
  IF n_aperte <> 2 THEN
    RAISE EXCEPTION '000317: le classi aperte al tenant sono % invece di 2 — chi ha aggiunto la terza, e con quale decisione?', n_aperte;
  END IF;

  -- 3. nessuna esenzione muta (il CHECK lo impedisce; qui si verifica che l'abbia impedito)
  SELECT count(*) INTO n_senza_ragione
    FROM sys.sys_ui_interface_data_classes
   WHERE data_class_open_to_tenant AND data_class_open_reason IS NULL;
  IF n_senza_ragione <> 0 THEN
    RAISE EXCEPTION '000317: % esenzioni senza ragione scritta', n_senza_ragione;
  END IF;

  -- 4. l'invariante di I17 della 000315 regge ancora: nessuna voce PERSONAL ha classi
  SELECT count(*) INTO n_personal
    FROM sys.sys_ui_interface_data_classes dc
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
   WHERE i.ui_interface_perspective = 'PERSONAL';
  IF n_personal <> 0 THEN
    RAISE EXCEPTION '000317: % voci dell''area personale hanno una classe — I17 a rischio', n_personal;
  END IF;

  -- 5. ⚠ IL TOTALE ESATTO SE N'E' ANDATO DA QUI IL 2026-08-19, ed e' successo esattamente
  --    come questo commento prevedeva. Diceva: «chi aggiungera' righe dopo di me deve
  --    spostare QUESTO conteggio nel proprio file, non alzarlo qui». La `000326` (#142 F4)
  --    ne ha aggiunte 15 — le classi delle sette famiglie di cruscotto, ereditate dalle
  --    proprie viste — e la prova generale ha detto «41 invece di 26» alla seconda passata.
  --
  --    Quindi questa migrazione torna a pretendere solo le SUE, con `>=`, esattamente come
  --    la 000315 fa con le proprie 24: e' l'unica forma che resta vera sia su un database
  --    da zero sia dopo qualunque aggiunta successiva. Il totale esatto ora vive nella
  --    `000326`, che e' la piu' recente a toccare la tabella — l'unica che possa conoscerlo.
  SELECT count(*) INTO n_dich FROM sys.sys_ui_interface_data_classes;
  IF n_dich < 26 THEN
    RAISE EXCEPTION '000317: le dichiarazioni sono % e devono essere almeno le mie 26', n_dich;
  END IF;

  RAISE NOTICE '000317 ok — % dichiarazioni totali, 2 aperte al tenant (ORG_CHART + org)', n_dich;
END $$;
