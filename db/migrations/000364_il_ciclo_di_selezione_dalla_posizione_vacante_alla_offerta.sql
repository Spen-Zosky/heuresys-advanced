-- ============================================================================
-- 000364 — Il ciclo di selezione: dalla posizione vacante all offerta
--
-- VOCE: #54 F2 — «modello dati del dominio, costruito sul DBMS attuale:
-- requisition -> posting -> candidate -> interview -> offer, agganciata alle
-- posizioni (I1: una requisizione nasce da una posizione vacante)».
--
-- COSA C ERA, misurato in F1 (2026-08-14) e ri-verificato: **niente**. La ricerca
-- su `sys.*` per (recruit|candidat|requisition|interview|offer|applicant|posting|
-- vacan|hir) dava due riscontri, ed erano **due falsi amici**:
-- `sys_seed_candidate_records` e la pipeline di acquisizione dati e
-- `sys_successor_candidates` e la successione sulle posizioni critiche. Nessun
-- modulo API di dominio. Il recruiting non esiste in questo prodotto.
--
-- ⛔ E NON SI IMPORTA NULLA. Direzione di Enzo del 2026-08-14 (I12 / ADR-0038):
-- *«nessun dato riferito al brownfield deve essere rimesso in circolo»*. Il
-- legacy ha 19 tabelle popolate su questo ciclo, e **nessuna di esse entra qui**.
-- Questa migrazione crea **struttura vuota**: le righe nasceranno dall uso.
--
-- ⭐ COSA IL LEGACY HA INSEGNATO, che e conoscenza di dominio e non un dato. La
-- F1 aveva trovato lo stesso ciclo costruito **due volte** la dentro: una
-- famiglia senza prefisso (candidates, requisitions, interviews,
-- interview_feedback, job_postings) e una `recruiting_*` piu ricca. Solo la
-- seconda ha le **offerte** e il contorno operativo — storico del candidato,
-- partecipanti al colloquio, modelli di colloquio, disponibilita degli
-- intervistatori. Chi ha rifatto il lavoro ha aggiunto proprio quelle: e il segno
-- di quali entita sono davvero servite all uso. Questo modello le tiene tutte e
-- sette; il contorno operativo (modelli di colloquio, disponibilita) resta fuori
-- perche e ottimizzazione di processo, non il ciclo.
--
-- ── LE SETTE ENTITA, e perche sono sette ────────────────────────────────────
--   1. `sys_job_requisitions`      la richiesta di coprire una posizione
--   2. `sys_job_postings`          l annuncio, interno o pubblico
--   3. `sys_candidates`            la persona che si candida — NON un utente
--   4. `sys_candidate_applications` la candidatura: un candidato su un annuncio
--   5. `sys_interviews`            il colloquio
--   6. `sys_interview_feedback`    la valutazione di chi vi ha partecipato
--   7. `sys_job_offers`            l offerta
--
-- ⭐ **I1 — LA REQUISIZIONE NASCE DA UNA POSIZIONE, ed e un vincolo non un
-- commento**: `requisition_position_id` e NOT NULL con FK. Il modello e
-- position-centric, non employee-centric: non si assume «una persona», si copre
-- **un posto**. Senza questo vincolo il recruiting diventerebbe un elenco di
-- assunzioni scollegato dall organigramma, che e precisamente il modello che I1
-- vieta.
--
-- ⚠ **UN CANDIDATO NON E UN UTENTE, e la distinzione ha conseguenze.**
-- `sys_candidates` non ha FK verso `sys_users`: e una persona **esterna**
-- all azienda, che potrebbe non diventarne mai parte. Tre conseguenze scritte
-- qui perche nessuno le debba ri-dedurre:
--   · il registro GDPR (`sys_gdpr_data_map`) sorveglia le FK verso `sys_users` e
--     **non vedrebbe questa tabella**: la guardia della `000304` resterebbe
--     verde su dati personali di persone reali. Per questo `sys_candidates`
--     porta la sua **base giuridica e la sua scadenza** nello schema, e non in
--     un documento — `candidate_consent_given_on` e `candidate_retention_until`
--     sono colonne, e la seconda ha un CHECK che le impedisce di precedere la
--     prima;
--   · quando un candidato viene assunto diventa un `sys_users`, e il legame si
--     scrive in `candidate_hired_user_id`: e nullable perche la stragrande
--     maggioranza dei candidati non lo diventa mai;
--   · le classi di dato di ADR-0036 parlano di persone **dell azienda**. Un
--     candidato non ha una catena organizzativa, quindi I19 non lo raggiunge:
--     chi puo vederlo lo decide il **permesso** (RBAC) piu il tenant, ed e
--     materia di F3.
--
-- ── SCELTE DI SCHEMA, con la regola che le governa ──────────────────────────
-- · ogni campo categoriale e **varchar + CHECK**, mai ENUM (RD-08).
-- · le date sono `date`; `timestamptz` solo dove l ora conta davvero — l inizio
--   di un colloquio (RD-09).
-- · isolamento tenant con FK + filtro nel middleware, **mai RLS** (I5).
-- · nomi `sys.sys_<plurale>`, nessun prefisso di dominio (I3/I4).
-- · un candidato non puo candidarsi due volte allo stesso annuncio: vincolo di
--   unicita, non un controllo applicativo che qualcuno un giorno dimentichera.
--
-- NON FA PARTE DI QUESTA FASE: le rotte API (F3), il cluster `/recruiting` e il
-- Kanban (F4). Questa migrazione crea lo schema e lo dichiara al registro GDPR;
-- nessun codice lo legge ancora, ed e il motivo per cui non puo rompere niente.
--
-- ROLLBACK: le sette tabelle sono nuove e vuote. `staging.mig364_selezione_undo_apply()`
-- le svuota, e si rifiuta se nel frattempo qualcuno ci ha scritto — a quel punto
-- non sarebbe piu un rollback.
--
-- IDEMPOTENTE: `IF NOT EXISTS` ovunque, `NOT EXISTS` sulle righe di registro.
-- Authored: 2026-08-28 (S1083).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. LA REQUISIZIONE — nasce da una posizione (I1), non da un desiderio.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_job_requisitions (
  requisition_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_tenant_id     uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  requisition_code          varchar(64) NOT NULL,
  -- I1: si copre un POSTO, non si assume una persona. NOT NULL per costruzione.
  requisition_position_id   uuid NOT NULL REFERENCES sys.sys_positions(position_id),
  requisition_headcount     integer NOT NULL DEFAULT 1
    CONSTRAINT sys_job_requisitions_headcount_check CHECK (requisition_headcount > 0),
  requisition_status        varchar(32) NOT NULL DEFAULT 'DRAFT'
    CONSTRAINT sys_job_requisitions_status_check
    CHECK (requisition_status IN ('DRAFT','APPROVED','OPEN','ON_HOLD','FILLED','CANCELLED')),
  requisition_reason        varchar(32)
    CONSTRAINT sys_job_requisitions_reason_check
    CHECK (requisition_reason IS NULL OR requisition_reason IN
           ('NEW_ROLE','REPLACEMENT','GROWTH','TEMPORARY','INTERNAL_MOBILITY')),
  requisition_opened_on     date,
  requisition_target_start  date,
  requisition_closed_on     date,
  requisition_notes         text,
  requisition_metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid,
  CONSTRAINT sys_job_requisitions_code_unique UNIQUE (requisition_tenant_id, requisition_code),
  CONSTRAINT sys_job_requisitions_dates_check
    CHECK (requisition_closed_on IS NULL OR requisition_opened_on IS NULL
           OR requisition_closed_on >= requisition_opened_on)
);
COMMENT ON TABLE sys.sys_job_requisitions IS
  'Richiesta di coprire una POSIZIONE vacante (#54 F2, S1083). requisition_position_id '
  'e NOT NULL per I1: il modello e position-centric, si copre un posto e non si '
  'assume una persona. Senza quel vincolo il recruiting diventerebbe un elenco di '
  'assunzioni scollegato dall organigramma.';
CREATE INDEX IF NOT EXISTS sys_job_requisitions_tenant_idx   ON sys.sys_job_requisitions (requisition_tenant_id);
CREATE INDEX IF NOT EXISTS sys_job_requisitions_position_idx ON sys.sys_job_requisitions (requisition_position_id);
CREATE INDEX IF NOT EXISTS sys_job_requisitions_status_idx   ON sys.sys_job_requisitions (requisition_status);

-- ----------------------------------------------------------------------------
-- 2. L ANNUNCIO — interno, esterno o pubblico. Il canale pubblico e il percorso
--    prospect di ADR-0026, e per questo la visibilita e un campo, non un flag.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_job_postings (
  posting_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_tenant_id      uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  posting_requisition_id uuid NOT NULL REFERENCES sys.sys_job_requisitions(requisition_id) ON DELETE CASCADE,
  posting_code           varchar(64) NOT NULL,
  posting_title          varchar(255) NOT NULL,
  posting_description    text,
  posting_visibility     varchar(32) NOT NULL DEFAULT 'INTERNAL'
    CONSTRAINT sys_job_postings_visibility_check
    CHECK (posting_visibility IN ('INTERNAL','EXTERNAL','PUBLIC')),
  posting_status         varchar(32) NOT NULL DEFAULT 'DRAFT'
    CONSTRAINT sys_job_postings_status_check
    CHECK (posting_status IN ('DRAFT','PUBLISHED','CLOSED','EXPIRED')),
  posting_published_on   date,
  posting_expires_on     date,
  posting_location       varchar(255),
  posting_metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid,
  CONSTRAINT sys_job_postings_code_unique UNIQUE (posting_tenant_id, posting_code),
  CONSTRAINT sys_job_postings_dates_check
    CHECK (posting_expires_on IS NULL OR posting_published_on IS NULL
           OR posting_expires_on >= posting_published_on)
);
COMMENT ON TABLE sys.sys_job_postings IS
  'Annuncio nato da una requisizione (#54 F2, S1083). La visibilita e un campo a tre '
  'valori e non un flag: PUBLIC e il percorso prospect di ADR-0026, e va distinto da '
  'EXTERNAL, che passa da un canale ma non dal sito.';
CREATE INDEX IF NOT EXISTS sys_job_postings_tenant_idx      ON sys.sys_job_postings (posting_tenant_id);
CREATE INDEX IF NOT EXISTS sys_job_postings_requisition_idx ON sys.sys_job_postings (posting_requisition_id);
CREATE INDEX IF NOT EXISTS sys_job_postings_status_idx      ON sys.sys_job_postings (posting_status);

-- ----------------------------------------------------------------------------
-- 3. IL CANDIDATO — una persona ESTERNA. Porta la sua base giuridica nello
--    schema, perche il registro GDPR guarda le FK verso `sys_users` e qui non
--    ce ne sono: senza queste colonne la guardia resterebbe verde su dati
--    personali di persone reali.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_candidates (
  candidate_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_tenant_id      uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  candidate_external_code  varchar(128),
  candidate_first_name     varchar(128) NOT NULL,
  candidate_last_name      varchar(128) NOT NULL,
  candidate_email          varchar(320) NOT NULL,
  candidate_phone          varchar(64),
  candidate_source         varchar(32) NOT NULL DEFAULT 'DIRECT'
    CONSTRAINT sys_candidates_source_check
    CHECK (candidate_source IN ('DIRECT','REFERRAL','AGENCY','JOB_BOARD','INTERNAL','EVENT')),
  candidate_status         varchar(32) NOT NULL DEFAULT 'ACTIVE'
    CONSTRAINT sys_candidates_status_check
    CHECK (candidate_status IN ('ACTIVE','HIRED','WITHDRAWN','BLACKLISTED','ARCHIVED')),
  -- la base giuridica, nello schema e non in un documento
  candidate_consent_given_on date,
  candidate_retention_until  date,
  -- quando un candidato viene assunto diventa un utente. Nullable perche la
  -- stragrande maggioranza non lo diventa mai.
  candidate_hired_user_id  uuid REFERENCES sys.sys_users(user_id),
  candidate_metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid,
  CONSTRAINT sys_candidates_email_unique UNIQUE (candidate_tenant_id, candidate_email),
  CONSTRAINT sys_candidates_retention_check
    CHECK (candidate_retention_until IS NULL OR candidate_consent_given_on IS NULL
           OR candidate_retention_until >= candidate_consent_given_on),
  -- uno stato HIRED senza l utente che ne e nato e una contraddizione
  CONSTRAINT sys_candidates_hired_check
    CHECK (candidate_status <> 'HIRED' OR candidate_hired_user_id IS NOT NULL)
);
COMMENT ON TABLE sys.sys_candidates IS
  'Persona ESTERNA che si candida (#54 F2, S1083). Non e un sys_users e potrebbe non '
  'diventarlo mai: per questo il registro GDPR, che sorveglia le FK verso sys_users, '
  'non la vedrebbe — e per questo consenso e scadenza di conservazione sono COLONNE '
  'con un CHECK, non una riga in un documento. Non avendo catena organizzativa, I19 '
  'non la raggiunge: chi puo vederla lo decidono permesso e tenant.';
CREATE INDEX IF NOT EXISTS sys_candidates_tenant_idx ON sys.sys_candidates (candidate_tenant_id);
CREATE INDEX IF NOT EXISTS sys_candidates_status_idx ON sys.sys_candidates (candidate_status);
CREATE INDEX IF NOT EXISTS sys_candidates_hired_idx  ON sys.sys_candidates (candidate_hired_user_id);

-- ----------------------------------------------------------------------------
-- 4. LA CANDIDATURA — un candidato su un annuncio. Due volte sullo stesso
--    annuncio e impossibile per vincolo, non per controllo applicativo.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_candidate_applications (
  application_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_tenant_id    uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  application_candidate_id uuid NOT NULL REFERENCES sys.sys_candidates(candidate_id) ON DELETE CASCADE,
  application_posting_id   uuid NOT NULL REFERENCES sys.sys_job_postings(posting_id) ON DELETE CASCADE,
  application_stage        varchar(32) NOT NULL DEFAULT 'APPLIED'
    CONSTRAINT sys_candidate_applications_stage_check
    CHECK (application_stage IN ('APPLIED','SCREENING','INTERVIEWING','OFFER','HIRED','REJECTED','WITHDRAWN')),
  application_applied_on   date NOT NULL DEFAULT CURRENT_DATE,
  application_closed_on    date,
  application_reject_reason varchar(64),
  application_metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid,
  CONSTRAINT sys_candidate_applications_unique
    UNIQUE (application_candidate_id, application_posting_id),
  CONSTRAINT sys_candidate_applications_dates_check
    CHECK (application_closed_on IS NULL OR application_closed_on >= application_applied_on),
  -- un rifiuto senza motivo e un dato che non serve a nessuno
  CONSTRAINT sys_candidate_applications_reject_check
    CHECK (application_stage <> 'REJECTED' OR application_reject_reason IS NOT NULL)
);
COMMENT ON TABLE sys.sys_candidate_applications IS
  'Candidatura: un candidato su un annuncio (#54 F2, S1083). Lo stadio e il campo su '
  'cui il Kanban di F4 si appoggera. Due candidature dello stesso candidato sullo '
  'stesso annuncio sono impossibili per VINCOLO, non per un controllo applicativo che '
  'un giorno qualcuno dimentichera.';
CREATE INDEX IF NOT EXISTS sys_candidate_applications_tenant_idx    ON sys.sys_candidate_applications (application_tenant_id);
CREATE INDEX IF NOT EXISTS sys_candidate_applications_candidate_idx ON sys.sys_candidate_applications (application_candidate_id);
CREATE INDEX IF NOT EXISTS sys_candidate_applications_posting_idx   ON sys.sys_candidate_applications (application_posting_id);
CREATE INDEX IF NOT EXISTS sys_candidate_applications_stage_idx     ON sys.sys_candidate_applications (application_stage);

-- ----------------------------------------------------------------------------
-- 5. IL COLLOQUIO — qui l ora conta, quindi `timestamptz` (RD-09).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_interviews (
  interview_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_tenant_id      uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  interview_application_id uuid NOT NULL REFERENCES sys.sys_candidate_applications(application_id) ON DELETE CASCADE,
  interview_kind           varchar(32) NOT NULL DEFAULT 'SCREENING'
    CONSTRAINT sys_interviews_kind_check
    CHECK (interview_kind IN ('SCREENING','TECHNICAL','BEHAVIORAL','PANEL','FINAL')),
  interview_status         varchar(32) NOT NULL DEFAULT 'SCHEDULED'
    CONSTRAINT sys_interviews_status_check
    CHECK (interview_status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  interview_scheduled_at   timestamptz,
  interview_duration_min   integer
    CONSTRAINT sys_interviews_duration_check
    CHECK (interview_duration_min IS NULL OR interview_duration_min > 0),
  interview_location       varchar(255),
  interview_metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid
);
COMMENT ON TABLE sys.sys_interviews IS
  'Colloquio di una candidatura (#54 F2, S1083). interview_scheduled_at e timestamptz '
  'e non date, perche qui l ora del giorno conta davvero (RD-09).';
CREATE INDEX IF NOT EXISTS sys_interviews_tenant_idx      ON sys.sys_interviews (interview_tenant_id);
CREATE INDEX IF NOT EXISTS sys_interviews_application_idx ON sys.sys_interviews (interview_application_id);
CREATE INDEX IF NOT EXISTS sys_interviews_scheduled_idx   ON sys.sys_interviews (interview_scheduled_at);

-- ----------------------------------------------------------------------------
-- 6. LA VALUTAZIONE — chi ha condotto il colloquio e un utente dell azienda,
--    quindi questa FK **finisce nel registro GDPR** (vedi §8).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_interview_feedback (
  feedback_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_tenant_id       uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  feedback_interview_id    uuid NOT NULL REFERENCES sys.sys_interviews(interview_id) ON DELETE CASCADE,
  feedback_interviewer_user_id uuid NOT NULL REFERENCES sys.sys_users(user_id),
  feedback_recommendation  varchar(32) NOT NULL DEFAULT 'NEUTRAL'
    CONSTRAINT sys_interview_feedback_recommendation_check
    CHECK (feedback_recommendation IN ('STRONG_YES','YES','NEUTRAL','NO','STRONG_NO')),
  feedback_score           numeric(4,2)
    CONSTRAINT sys_interview_feedback_score_check
    CHECK (feedback_score IS NULL OR (feedback_score >= 0 AND feedback_score <= 10)),
  feedback_notes           text,
  feedback_submitted_on    date,
  feedback_metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid,
  CONSTRAINT sys_interview_feedback_unique
    UNIQUE (feedback_interview_id, feedback_interviewer_user_id)
);
COMMENT ON TABLE sys.sys_interview_feedback IS
  'Valutazione di chi ha condotto un colloquio (#54 F2, S1083). La FK verso sys_users '
  'e quella dell INTERVISTATORE, non del candidato: e un incarico funzionale, e come '
  'tale e dichiarata nel registro GDPR.';
CREATE INDEX IF NOT EXISTS sys_interview_feedback_tenant_idx      ON sys.sys_interview_feedback (feedback_tenant_id);
CREATE INDEX IF NOT EXISTS sys_interview_feedback_interview_idx   ON sys.sys_interview_feedback (feedback_interview_id);
CREATE INDEX IF NOT EXISTS sys_interview_feedback_interviewer_idx ON sys.sys_interview_feedback (feedback_interviewer_user_id);

-- ----------------------------------------------------------------------------
-- 7. L OFFERTA — l entita che la prima versione del legacy non aveva, e che la
--    seconda ha dovuto aggiungere. E il segno che serve davvero.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_job_offers (
  offer_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_tenant_id       uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  offer_application_id  uuid NOT NULL REFERENCES sys.sys_candidate_applications(application_id) ON DELETE CASCADE,
  offer_status          varchar(32) NOT NULL DEFAULT 'DRAFT'
    CONSTRAINT sys_job_offers_status_check
    CHECK (offer_status IN ('DRAFT','SENT','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN')),
  offer_gross_annual_salary numeric(12,2)
    CONSTRAINT sys_job_offers_salary_check
    CHECK (offer_gross_annual_salary IS NULL OR offer_gross_annual_salary > 0),
  offer_contract_type   varchar(32),
  offer_start_date      date,
  offer_sent_on         date,
  offer_responded_on    date,
  offer_metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  CONSTRAINT sys_job_offers_dates_check
    CHECK (offer_responded_on IS NULL OR offer_sent_on IS NULL
           OR offer_responded_on >= offer_sent_on),
  -- una risposta senza che l offerta sia stata mandata e una contraddizione
  CONSTRAINT sys_job_offers_flow_check
    CHECK (offer_status NOT IN ('ACCEPTED','DECLINED') OR offer_sent_on IS NOT NULL)
);
COMMENT ON TABLE sys.sys_job_offers IS
  'Offerta su una candidatura (#54 F2, S1083). La retribuzione qui e COMPENSATION per '
  'natura, ma il soggetto e un candidato esterno e non un dipendente: le regole di '
  'mascheramento di ADR-0036 vanno decise su questa superficie in F3, non ereditate.';
CREATE INDEX IF NOT EXISTS sys_job_offers_tenant_idx      ON sys.sys_job_offers (offer_tenant_id);
CREATE INDEX IF NOT EXISTS sys_job_offers_application_idx ON sys.sys_job_offers (offer_application_id);
CREATE INDEX IF NOT EXISTS sys_job_offers_status_idx      ON sys.sys_job_offers (offer_status);

-- ----------------------------------------------------------------------------
-- 8. IL REGISTRO GDPR — le FK verso una persona dell azienda si dichiarano.
--    Qui ce n e una sola che conti: l intervistatore. `candidate_hired_user_id`
--    e un collegamento all utente NATO dal candidato, non un incarico, ma la
--    guardia della `000304` non fa questa distinzione e va dichiarata comunque —
--    con la sua natura scritta, che e il modo giusto di soddisfare una guardia.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_gdpr_data_map (
  gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk,
  gdpr_map_data_class, gdpr_map_erasure_strategy, gdpr_map_reference_kind,
  gdpr_map_legal_basis
)
SELECT v.sch, v.tbl, v.col, v.cls, v.str, v.knd, v.base
  FROM (VALUES
    ('sys','sys_interview_feedback','feedback_interviewer_user_id',
     'OPERATIONAL','DELETE','SUBJECT',
     'Valutazione espressa da chi ha condotto un colloquio: incarico funzionale corrente, non record di impiego.'),
    ('sys','sys_candidates','candidate_hired_user_id',
     'OPERATIONAL','DELETE','SUBJECT',
     'Collegamento fra il candidato e l utente nato dalla sua assunzione. Il soggetto del dato e il CANDIDATO, la cui base giuridica e la cui scadenza stanno nelle colonne candidate_consent_given_on e candidate_retention_until.')
  ) AS v(sch,tbl,col,cls,str,knd,base)
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_gdpr_data_map m
    WHERE m.gdpr_map_table_schema = v.sch
      AND m.gdpr_map_table_name   = v.tbl
      AND m.gdpr_map_subject_fk   = v.col);

-- ----------------------------------------------------------------------------
-- 9. LE POST-CONDIZIONI — proteggono anche cio che NON doveva cambiare.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_tabelle  int;
  v_scoperte int;
  v_righe    int;
BEGIN
  -- (a) cio che DOVEVA cambiare: le sette tabelle esistono.
  SELECT count(*) INTO v_tabelle
    FROM information_schema.tables
   WHERE table_schema = 'sys'
     AND table_name IN ('sys_job_requisitions','sys_job_postings','sys_candidates',
                        'sys_candidate_applications','sys_interviews',
                        'sys_interview_feedback','sys_job_offers');
  IF v_tabelle <> 7 THEN
    RAISE EXCEPTION 'mig364: create % tabelle su 7', v_tabelle;
  END IF;

  -- (b) ogni FK verso una persona e dichiarata al registro. E la stessa
  --     condizione della 000304, ristretta alle tabelle di questa migrazione:
  --     verificarla QUI significa che il rosso arriva subito e nominato, invece
  --     che alla seconda passata della catena con un messaggio generico.
  SELECT count(*) INTO v_scoperte
    FROM (
      SELECT src.relname AS tbl, att.attname AS col
        FROM pg_constraint con
        JOIN pg_class src ON src.oid = con.conrelid
        JOIN pg_class tgt ON tgt.oid = con.confrelid
        JOIN pg_namespace tn ON tn.oid = tgt.relnamespace
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
       WHERE con.contype = 'f' AND tgt.relname = 'sys_users' AND tn.nspname = 'sys'
         AND src.relname IN ('sys_job_requisitions','sys_job_postings','sys_candidates',
                             'sys_candidate_applications','sys_interviews',
                             'sys_interview_feedback','sys_job_offers')
         AND att.attname !~ '(^|_)(created_by|updated_by)$|_by$'
    ) b
    LEFT JOIN sys.sys_gdpr_data_map m
      ON m.gdpr_map_table_name = b.tbl AND m.gdpr_map_subject_fk = b.col
   WHERE m.gdpr_data_map_id IS NULL;
  IF v_scoperte <> 0 THEN
    RAISE EXCEPTION
      'mig364: % chiavi esterne verso una persona non sono dichiarate nel registro GDPR',
      v_scoperte;
  END IF;

  -- (c) cio che NON doveva cambiare: questa migrazione crea STRUTTURA VUOTA.
  --     Se un giorno qualcuno ci aggiungesse un seed, o peggio un import dal
  --     legacy (I12 lo vieta), qui si vedrebbe subito.
  SELECT (SELECT count(*) FROM sys.sys_job_requisitions)
       + (SELECT count(*) FROM sys.sys_job_postings)
       + (SELECT count(*) FROM sys.sys_candidates)
       + (SELECT count(*) FROM sys.sys_candidate_applications)
       + (SELECT count(*) FROM sys.sys_interviews)
       + (SELECT count(*) FROM sys.sys_interview_feedback)
       + (SELECT count(*) FROM sys.sys_job_offers)
    INTO v_righe;

  RAISE NOTICE 'mig364 post: 7 tabelle · 0 FK di persona non dichiarate · % righe '
               '(zero e il valore atteso appena create: il dominio si popola con l uso, '
               'non con un import — I12)', v_righe;
END $$;

-- ----------------------------------------------------------------------------
-- 10. La funzione che disfa. Si rifiuta se qualcuno ci ha gia scritto.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.mig364_selezione_undo_apply()
RETURNS TABLE(azione text, righe bigint)
LANGUAGE plpgsql AS $$
DECLARE v_righe bigint;
BEGIN
  SELECT (SELECT count(*) FROM sys.sys_candidates)
       + (SELECT count(*) FROM sys.sys_job_requisitions) INTO v_righe;
  IF v_righe > 0 THEN
    RAISE EXCEPTION
      'mig364 undo: il dominio contiene gia % righe fra candidati e requisizioni. '
      'Disfare qui sarebbe perdere dati di persone reali, non annullare un intervento.',
      v_righe;
  END IF;

  DROP TABLE IF EXISTS sys.sys_job_offers, sys.sys_interview_feedback, sys.sys_interviews,
                       sys.sys_candidate_applications, sys.sys_candidates,
                       sys.sys_job_postings, sys.sys_job_requisitions CASCADE;
  DELETE FROM sys.sys_gdpr_data_map
   WHERE gdpr_map_table_name IN ('sys_interview_feedback','sys_candidates');

  RETURN QUERY VALUES ('tabelle rimosse', 7::bigint);
END $$;

COMMIT;
