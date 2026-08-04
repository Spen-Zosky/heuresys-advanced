-- ═══════════════════════════════════════════════════════════════════════════════
-- 000256_review_cycle_and_calibration_ddl.sql
--
-- CICLO DI VALUTAZIONE — PASSO 1 di 7: LO SCHEMA E I PERMESSI.
--
-- Che cosa risolve
--   `sys_performance_reviews` ha gia' le 16 colonne del flusso — `review_self_*`,
--   `review_pre_calibration_rating`, `review_calibrated_*`, `review_finalized_*`,
--   `review_shared_at` — e sono TUTTE vuote sulle 550 review esistenti, che
--   dichiarano `review_self_assessment_status = 'NOT_STARTED'`. Non e' un difetto
--   d'importazione: nel legacy quelle colonne sono popolate 0 su 157, cioe' la
--   funzione non e' mai esistita. Le review storiche restano come sono e
--   `NOT_STARTED` diventa il loro marcatore legittimo di «ciclo chiuso senza
--   autovalutazione»; il ciclo nuovo vale da qui in avanti.
--
--   Quello che manca non sono le colonne: sono i CONTENITORI del processo.
--
-- Le quattro tabelle
--   · sys_review_cycles          il ciclo a cui le review appartengono (nome, periodo,
--                                scadenza dell'autovalutazione, scadenza del manager,
--                                stato). Modellato ex-novo: i 17 cicli legacy sono
--                                tutti «Test Auth Cycle» in stato draft, artefatti di
--                                collaudo, e importarli sarebbe portare dentro spazzatura.
--   · sys_calibration_sessions   la sessione di calibrazione. QUI il legacy ha dato vero
--   · sys_calibration_participants  chi siede alla sessione
--   · sys_calibration_discussions   la singola discussione su una persona, col voto
--                                   prima e dopo. E' il cuore: dice se e perche' un
--                                   voto e' stato mosso in sede collegiale.
--   L'ingestione delle righe legacy e' il PASSO 2, non questo: qui si costruisce
--   solo il posto dove metterle.
--
-- La macchina a stati che queste tabelle sorreggono
--   DRAFT → SELF_ASSESSMENT → MANAGER_REVIEW → CALIBRATION → FINALIZED → SHARED
--   Le transizioni le valida il servizio (passo 4), non l'interfaccia. Qui gli stati
--   sono chiusi da un CHECK, che e' cio' che impedisce a una scrittura fuori flusso
--   di entrare comunque.
--
-- Vincoli di progetto rispettati, uno per uno
--   I3/I4  tabelle `sys.sys_<plurale>`, colonne prefissate con l'entita
--   RD-08  stati = varchar + CHECK, MAI enum PostgreSQL
--   RD-09  `date` per le date pure, `timestamptz` solo dove serve l'ora
--   I5     isolamento tenant = FK + filtro nel middleware, MAI RLS
--   I16/I18 `performance_review` e' dato di classe EVALUATION: sensibile, accessibile
--          per catena ORGANIZZATIVA e mai per appartenenza funzionale. I permessi qui
--          sotto sono la meta' «l'azione e' ammessa»; l'altra meta' — «su quali
--          persone» — la decide il gate d'organizzazione nelle rotte (passo 3).
--
-- Non distruttiva: crea, non tocca dati esistenti. Rieseguibile: IF NOT EXISTS e
-- ON CONFLICT DO NOTHING ovunque.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. IL CICLO DI VALUTAZIONE
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_review_cycles (
  review_cycle_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_cycle_tenant_id        uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  review_cycle_code             varchar(64)  NOT NULL,
  review_cycle_name             varchar(255) NOT NULL,
  review_cycle_description      text,
  review_cycle_type             varchar(32)  NOT NULL DEFAULT 'ANNUAL',
  review_cycle_period_start     date NOT NULL,
  review_cycle_period_end       date NOT NULL,
  -- le due scadenze del flusso: oltre la prima l'autovalutazione non e' piu' apribile,
  -- oltre la seconda il ciclo passa in calibrazione anche senza il manager
  review_cycle_self_deadline    date,
  review_cycle_manager_deadline date,
  review_cycle_status           varchar(32) NOT NULL DEFAULT 'DRAFT',
  review_cycle_opened_at        timestamptz,
  review_cycle_closed_at        timestamptz,
  review_cycle_metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  created_by                    uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  updated_by                    uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_review_cycles_code_uq UNIQUE (review_cycle_tenant_id, review_cycle_code),
  CONSTRAINT sys_review_cycles_type_chk CHECK (
    review_cycle_type IN ('ANNUAL','MID_YEAR','PROBATION','PROJECT','AD_HOC')),
  -- gli stati del ciclo. La review ha i propri (colonna review_status): questi
  -- governano la finestra, quelli il singolo fascicolo.
  CONSTRAINT sys_review_cycles_status_chk CHECK (
    review_cycle_status IN ('DRAFT','SELF_ASSESSMENT','MANAGER_REVIEW','CALIBRATION','FINALIZED','SHARED','CANCELLED')),
  CONSTRAINT sys_review_cycles_period_chk CHECK (review_cycle_period_end >= review_cycle_period_start),
  -- una scadenza fuori dal periodo e' un errore di data, non una scelta
  CONSTRAINT sys_review_cycles_deadline_chk CHECK (
    (review_cycle_self_deadline    IS NULL OR review_cycle_self_deadline    >= review_cycle_period_start) AND
    (review_cycle_manager_deadline IS NULL OR review_cycle_manager_deadline >= review_cycle_period_start))
);
COMMENT ON TABLE sys.sys_review_cycles IS
  'Ciclo di valutazione: la finestra a cui le review appartengono. Modellato ex-novo — i 17 cicli del legacy sono artefatti di collaudo (tutti «Test Auth Cycle» in draft) e non sono stati importati.';

CREATE INDEX IF NOT EXISTS sys_review_cycles_tenant_idx ON sys.sys_review_cycles (review_cycle_tenant_id);
CREATE INDEX IF NOT EXISTS sys_review_cycles_status_idx ON sys.sys_review_cycles (review_cycle_status);

-- la review appartiene a un ciclo. NULL sulle 550 storiche: sono nate prima che il
-- ciclo esistesse, e inventare loro un ciclo sarebbe scrivere una storia mai avvenuta.
ALTER TABLE sys.sys_performance_reviews
  ADD COLUMN IF NOT EXISTS review_cycle_id uuid REFERENCES sys.sys_review_cycles(review_cycle_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sys_performance_reviews_cycle_idx ON sys.sys_performance_reviews (review_cycle_id);
COMMENT ON COLUMN sys.sys_performance_reviews.review_cycle_id IS
  'Il ciclo a cui la review appartiene. NULL sulle review storiche, che precedono l''introduzione del ciclo.';

-- ───────────────────────────────────────────────────────────────────────────────
-- B. LA SESSIONE DI CALIBRAZIONE
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_calibration_sessions (
  calibration_session_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_session_tenant_id     uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  calibration_session_cycle_id      uuid REFERENCES sys.sys_review_cycles(review_cycle_id) ON DELETE SET NULL,
  -- chiave naturale di provenienza: e' cosi' che l'import resta ri-eseguibile senza
  -- duplicare, e che una riga si puo' ricondurre alla sua origine
  calibration_session_natural_key   varchar(255),
  calibration_session_name          varchar(255) NOT NULL,
  calibration_session_description   text,
  calibration_session_org_unit_id   uuid REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE SET NULL,
  calibration_session_department    varchar(255),
  calibration_session_scheduled_at  timestamptz,
  calibration_session_duration_min  smallint,
  calibration_session_location      varchar(255),
  calibration_session_facilitator_user_id uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  calibration_session_status        varchar(32) NOT NULL DEFAULT 'SCHEDULED',
  calibration_session_summary_notes text,
  calibration_session_adjustments_count integer NOT NULL DEFAULT 0,
  calibration_session_metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_calibration_sessions_natural_key_uq UNIQUE (calibration_session_natural_key),
  CONSTRAINT sys_calibration_sessions_status_chk CHECK (
    calibration_session_status IN ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')),
  CONSTRAINT sys_calibration_sessions_adjustments_chk CHECK (calibration_session_adjustments_count >= 0)
);
COMMENT ON TABLE sys.sys_calibration_sessions IS
  'Sessione di calibrazione: il momento collegiale in cui i voti vengono confrontati fra pari. Le righe di RTL Bank arrivano dal legacy (dato di business mai importato prima).';

CREATE INDEX IF NOT EXISTS sys_calibration_sessions_tenant_idx   ON sys.sys_calibration_sessions (calibration_session_tenant_id);
CREATE INDEX IF NOT EXISTS sys_calibration_sessions_cycle_idx    ON sys.sys_calibration_sessions (calibration_session_cycle_id);
CREATE INDEX IF NOT EXISTS sys_calibration_sessions_org_unit_idx ON sys.sys_calibration_sessions (calibration_session_org_unit_id);
CREATE INDEX IF NOT EXISTS sys_calibration_sessions_facilitator_idx ON sys.sys_calibration_sessions (calibration_session_facilitator_user_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- C. CHI SIEDE ALLA SESSIONE
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_calibration_participants (
  calibration_participant_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_participant_tenant_id   uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  calibration_participant_session_id  uuid NOT NULL REFERENCES sys.sys_calibration_sessions(calibration_session_id) ON DELETE CASCADE,
  calibration_participant_user_id     uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT,
  calibration_participant_natural_key varchar(255),
  calibration_participant_role        varchar(32) NOT NULL DEFAULT 'PARTICIPANT',
  calibration_participant_attended    boolean NOT NULL DEFAULT false,
  calibration_participant_joined_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_calibration_participants_natural_key_uq UNIQUE (calibration_participant_natural_key),
  -- una persona siede una volta sola alla stessa sessione
  CONSTRAINT sys_calibration_participants_uq UNIQUE (calibration_participant_session_id, calibration_participant_user_id),
  CONSTRAINT sys_calibration_participants_role_chk CHECK (
    calibration_participant_role IN ('FACILITATOR','PARTICIPANT','OBSERVER','HR_BUSINESS_PARTNER'))
);
COMMENT ON TABLE sys.sys_calibration_participants IS
  'Chi siede a una sessione di calibrazione, e se vi ha effettivamente partecipato.';

CREATE INDEX IF NOT EXISTS sys_calibration_participants_session_idx ON sys.sys_calibration_participants (calibration_participant_session_id);
CREATE INDEX IF NOT EXISTS sys_calibration_participants_user_idx    ON sys.sys_calibration_participants (calibration_participant_user_id);
CREATE INDEX IF NOT EXISTS sys_calibration_participants_tenant_idx  ON sys.sys_calibration_participants (calibration_participant_tenant_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- D. LA DISCUSSIONE SU UNA PERSONA — il voto prima, il voto dopo, il perche'
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_calibration_discussions (
  calibration_discussion_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_discussion_tenant_id     uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  calibration_discussion_session_id    uuid NOT NULL REFERENCES sys.sys_calibration_sessions(calibration_session_id) ON DELETE CASCADE,
  calibration_discussion_subject_user_id uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT,
  -- la review su cui la discussione incide, quando e' identificabile
  calibration_discussion_review_id     uuid REFERENCES sys.sys_performance_reviews(review_id) ON DELETE SET NULL,
  calibration_discussion_natural_key   varchar(255),
  calibration_discussion_original_rating    numeric(4,2),
  calibration_discussion_original_potential varchar(32),
  calibration_discussion_calibrated_rating    numeric(4,2),
  calibration_discussion_calibrated_potential varchar(32),
  calibration_discussion_was_adjusted  boolean NOT NULL DEFAULT false,
  calibration_discussion_notes         text,
  calibration_discussion_adjustment_reason text,
  calibration_discussion_discussed_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_calibration_discussions_natural_key_uq UNIQUE (calibration_discussion_natural_key),
  CONSTRAINT sys_calibration_discussions_subject_uq UNIQUE (calibration_discussion_session_id, calibration_discussion_subject_user_id),
  -- un voto fuori scala non e' un dato, e' un errore di scrittura
  CONSTRAINT sys_calibration_discussions_rating_chk CHECK (
    (calibration_discussion_original_rating   IS NULL OR calibration_discussion_original_rating   BETWEEN 0 AND 5) AND
    (calibration_discussion_calibrated_rating IS NULL OR calibration_discussion_calibrated_rating BETWEEN 0 AND 5)),
  -- «aggiustata» deve corrispondere ai numeri: una riga che dichiara un aggiustamento
  -- senza il voto calibrato racconta una decisione che non si puo' verificare
  CONSTRAINT sys_calibration_discussions_adjusted_chk CHECK (
    calibration_discussion_was_adjusted = false OR calibration_discussion_calibrated_rating IS NOT NULL)
);
COMMENT ON TABLE sys.sys_calibration_discussions IS
  'La discussione collegiale su una singola persona: voto di partenza, voto calibrato, e la ragione dello spostamento. E'' il documento che rende verificabile una decisione di calibrazione.';

CREATE INDEX IF NOT EXISTS sys_calibration_discussions_session_idx ON sys.sys_calibration_discussions (calibration_discussion_session_id);
CREATE INDEX IF NOT EXISTS sys_calibration_discussions_subject_idx ON sys.sys_calibration_discussions (calibration_discussion_subject_user_id);
CREATE INDEX IF NOT EXISTS sys_calibration_discussions_review_idx  ON sys.sys_calibration_discussions (calibration_discussion_review_id);
CREATE INDEX IF NOT EXISTS sys_calibration_discussions_tenant_idx  ON sys.sys_calibration_discussions (calibration_discussion_tenant_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- E. I QUATTRO PERMESSI
--    Il pubblico non e' scritto a mano: si ri-deriva da chi ha gia' `talent:read`,
--    che e' la superficie sorella (9-box, fit, readiness, successione). Se domani
--    quel permesso cambia platea, questa migrazione non resta indietro — e' lo
--    stesso criterio usato in 000232 per `leads:update`.
--    HRMS_MANAGER e' plenipotenziario per regola nota e vi rientra da se'.
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('performance-review:read',  'Lettura valutazioni di performance',   'performance-review', 'read'),
  ('performance-review:write', 'Compilazione valutazioni di performance','performance-review','write'),
  ('calibration:manage',       'Gestione sessioni di calibrazione',    'calibration',        'manage'),
  ('review-cycle:manage',      'Gestione cicli di valutazione',        'review-cycle',       'manage')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT rp.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_permissions p
  CROSS JOIN LATERAL (
    SELECT DISTINCT x.auth_role_id
      FROM sys.sys_auth_role_permissions x
      JOIN sys.sys_auth_permissions xp ON xp.auth_permission_id = x.auth_permission_id
     WHERE xp.auth_permission_code = 'talent:read'
  ) rp
 WHERE p.auth_permission_code IN
   ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Traduzione EN, altrimenti il cancello i18n torna rosso (ADR-0029, e la lezione
-- della migrazione 000255 di stamattina)
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.en, 'MANUAL'
  FROM (VALUES
    ('performance-review:read',  'Read performance reviews'),
    ('performance-review:write', 'Complete performance reviews'),
    ('calibration:manage',       'Manage calibration sessions'),
    ('review-cycle:manage',      'Manage review cycles')
  ) AS v(codice, en)
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = v.codice
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- F. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_tab int; n_perm int; n_map int; n_trad int; n_gap int; n_col int;
BEGIN
  SELECT count(*) INTO n_tab FROM information_schema.tables
   WHERE table_schema='sys' AND table_name IN
     ('sys_review_cycles','sys_calibration_sessions','sys_calibration_participants','sys_calibration_discussions');
  IF n_tab <> 4 THEN RAISE EXCEPTION 'Tabelle nuove: attese 4, trovate %', n_tab; END IF;

  SELECT count(*) INTO n_col FROM information_schema.columns
   WHERE table_schema='sys' AND table_name='sys_performance_reviews' AND column_name='review_cycle_id';
  IF n_col <> 1 THEN RAISE EXCEPTION 'Manca la colonna review_cycle_id su sys_performance_reviews'; END IF;

  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage');
  IF n_perm <> 4 THEN RAISE EXCEPTION 'Permessi nuovi: attesi 4, trovati %', n_perm; END IF;

  -- il mapping dev'essere quello di talent:read moltiplicato per 4, non un numero
  -- scritto qui: se domani cambia la platea cambia anche l'atteso, ed e' giusto cosi'
  SELECT count(*) INTO n_map FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage');
  IF n_map <> 4 * (SELECT count(DISTINCT x.auth_role_id) FROM sys.sys_auth_role_permissions x
                     JOIN sys.sys_auth_permissions xp ON xp.auth_permission_id = x.auth_permission_id
                    WHERE xp.auth_permission_code='talent:read') THEN
    RAISE EXCEPTION 'Mapping RBAC incompleto: % righe, non 4 volte la platea di talent:read', n_map;
  END IF;

  -- HRMS_MANAGER e' plenipotenziario sui dati business: se non e' fra i mappati,
  -- qualcosa nella derivazione non ha funzionato
  IF NOT EXISTS (
    SELECT 1 FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
     WHERE r.auth_role_code = 'HRMS_MANAGER' AND p.auth_permission_code = 'calibration:manage') THEN
    RAISE EXCEPTION 'HRMS_MANAGER non ha calibration:manage: la derivazione dalla platea di talent:read non ha funzionato';
  END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table='sys_auth_permissions' AND t.locale='en' AND t.field='name'
     AND p.auth_permission_code IN ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage');
  IF n_trad <> 4 THEN RAISE EXCEPTION 'Traduzioni EN dei permessi: attese 4, trovate %', n_trad; END IF;

  SELECT coalesce(sum(missing),0) INTO n_gap FROM sys.v_reference_translation_coverage;
  IF n_gap <> 0 THEN RAISE EXCEPTION 'Copertura EN: % traduzioni mancanti dopo questa migrazione', n_gap; END IF;

  RAISE NOTICE 'PASSO 1 OK — 4 tabelle del ciclo di valutazione, FK review_cycle_id sulle review, 4 permessi mappati su % righe RBAC, copertura EN intatta.', n_map;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   DELETE FROM sys.sys_reference_translations WHERE entity_table='sys_auth_permissions'
--     AND entity_id IN (SELECT auth_permission_id FROM sys.sys_auth_permissions
--                        WHERE auth_permission_code IN ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage'));
--   DELETE FROM sys.sys_auth_role_permissions WHERE auth_permission_id IN
--     (SELECT auth_permission_id FROM sys.sys_auth_permissions
--       WHERE auth_permission_code IN ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage'));
--   DELETE FROM sys.sys_auth_permissions WHERE auth_permission_code IN
--     ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage');
--   ALTER TABLE sys.sys_performance_reviews DROP COLUMN IF EXISTS review_cycle_id;
--   DROP TABLE IF EXISTS sys.sys_calibration_discussions;
--   DROP TABLE IF EXISTS sys.sys_calibration_participants;
--   DROP TABLE IF EXISTS sys.sys_calibration_sessions;
--   DROP TABLE IF EXISTS sys.sys_review_cycles;
-- COMMIT;
