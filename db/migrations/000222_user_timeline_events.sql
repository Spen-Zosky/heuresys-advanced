-- 000222_user_timeline_events.sql
--
-- #49 (linea D5) — la storia di una persona, importata dal sistema precedente.
--
-- Cosa manca oggi: la scheda di una persona mostra il presente (posizione,
-- competenze, obiettivi) e quasi nulla del percorso. Nel database legacy
-- `heuresys_platform` vive `employee_timeline` — 4.641 fatti già datati e
-- attribuiti (assunzioni, avanzamenti, corsi conclusi, certificazioni,
-- variazioni retributive, valutazioni) — che nessuna tabella di v5 accoglie.
--
-- ATTENZIONE a cosa NON è: questo non è l'event-sourcing di dominio. È un
-- registro CONSULTIVO in sola lettura di fatti già avvenuti e importati.
-- Nessuno stato del sistema si ricostruisce da qui, e nessun modulo deve
-- iniziare a scriverci per "registrare" ciò che sta facendo: chi vuole
-- l'event-sourcing dovrà progettarlo, non ereditarlo per sbaglio da questa
-- tabella.
--
-- Scelte:
--   * `event_type` è varchar + CHECK, mai un ENUM (RD-08). I valori sono i 26
--     del vincolo legacy, normalizzati in maiuscolo come gli altri
--     discriminatori del progetto.
--   * `occurred_at` è timestamptz: nel legacy `event_date` porta l'ora, e per
--     ordinare più fatti dello stesso giorno serve (RD-09).
--   * `external_code` porta la chiave naturale `LEGACY_TL::<id>` — è ciò che
--     rende l'import ripetibile senza duplicare (stessa dottrina di D1/D2).
--   * l'`embedding` del legacy NON viene importato: serviva alla ricerca
--     semantica di quel sistema, non a una timeline consultiva.
--
-- Idempotente: IF NOT EXISTS su tabella e indici.

CREATE TABLE IF NOT EXISTS sys.sys_user_timeline_events (
  user_timeline_event_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_timeline_event_tenant_id     uuid NOT NULL
    REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  user_timeline_event_user_id       uuid NOT NULL
    REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_timeline_event_type          varchar(64) NOT NULL,
  user_timeline_event_occurred_at   timestamptz NOT NULL,
  -- Da dove viene il fatto nel sistema di origine: tabella e riga.
  user_timeline_event_source_table  varchar(64),
  user_timeline_event_source_id     uuid,
  user_timeline_event_summary       text,
  user_timeline_event_payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_timeline_event_external_code varchar(128),
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sys_user_timeline_event_type_check CHECK (
    user_timeline_event_type IN (
      'HIRE', 'PROMOTION', 'LEVEL_CHANGE', 'SALARY_CHANGE',
      'COURSE_COMPLETED', 'COURSE_ENROLLED',
      'SKILL_VALIDATED', 'SKILL_UPDATED',
      'REVIEW_COMPLETED', 'MANAGER_CHANGE',
      'CERTIFICATION_EARNED', 'CERTIFICATION_EXPIRED',
      'GOAL_ACHIEVED', 'GOAL_ASSIGNED',
      'ROLE_CHANGE', 'LOCATION_CHANGE',
      'CONTRACT_RENEWED', 'CONTRACT_SIGNED',
      'WELLBEING_ALERT', 'FEEDBACK_RECEIVED',
      'TIME_OFF_TAKEN', 'ABSENCE_RECORDED',
      'SUCCESSION_NOMINATION', 'TALENT_POOL_INCLUSION',
      'DISCIPLINARY_ACTION', 'OTHER'
    )
  )
);

-- La chiave naturale dell'import: ri-eseguire aggiorna, non duplica.
CREATE UNIQUE INDEX IF NOT EXISTS sys_user_timeline_events_external_code_uq
  ON sys.sys_user_timeline_events (user_timeline_event_external_code)
  WHERE user_timeline_event_external_code IS NOT NULL;

-- L'accesso reale: la storia di UNA persona, dalla più recente.
CREATE INDEX IF NOT EXISTS sys_user_timeline_events_user_date_idx
  ON sys.sys_user_timeline_events (user_timeline_event_user_id, user_timeline_event_occurred_at DESC);

-- Filtro per tipo dentro un tenant (es. "tutte le promozioni del 2025").
CREATE INDEX IF NOT EXISTS sys_user_timeline_events_tenant_type_idx
  ON sys.sys_user_timeline_events (user_timeline_event_tenant_id, user_timeline_event_type, user_timeline_event_occurred_at DESC);

COMMENT ON TABLE sys.sys_user_timeline_events IS
  'D5 (#49) — registro consultivo dei fatti della vita lavorativa di una persona, importato dal sistema precedente. NON e'' un event-store di dominio: sola lettura, nessuno stato si ricostruisce da qui.';
COMMENT ON COLUMN sys.sys_user_timeline_events.user_timeline_event_external_code IS
  'Chiave naturale LEGACY_TL::<employee_timeline.id> — rende l''import ripetibile.';
