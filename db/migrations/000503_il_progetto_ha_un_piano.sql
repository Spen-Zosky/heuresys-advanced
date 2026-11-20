-- ============================================================================================
-- 000503 — Il progetto ha un PIANO: fasi, attività e tappe con le date, e le dipendenze.
--          (V6 del piano docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md)
--
-- IL FATTO. `sys_projects` (000363) porta lo scopo, lo stato, l'avanzamento e due date facoltative;
-- `sys_project_members` dice chi lavora e con quale ruolo. Non c'era dove scrivere COME il progetto
-- arriva al suo scopo: le fasi, le attività dentro le fasi, le tappe (milestone), chi le porta, le
-- date pianificate ed effettive e che cosa deve finire prima che un'altra cosa cominci. Senza questo
-- il Gantt non ha niente da disegnare (Enzo, 18/11: «Gantt dove applicabile»).
--
-- CHE COSA CREA. Solo aggiunte, nessun oggetto esistente toccato:
--   · `sys_project_phases`: un nodo della scomposizione del lavoro (WBS) di un progetto. Tipo
--     PHASE (fase, può contenere altro), ACTIVITY (attività), MILESTONE (tappa, una data sola).
--     Un genitore facoltativo nello stesso progetto, l'ordine fra fratelli, le date pianificate ed
--     effettive (`date`, RD-09), l'avanzamento, lo stato, chi la porta (un'APPARTENENZA al progetto,
--     non una persona: l'autorità di un progetto è sul lavoro, I18) e, facoltativa, l'attività di
--     processo che la fase esegue (`sys_tenant_process_steps`, il legame col processo e i suoi KPI).
--   · `sys_project_dependencies`: «B dipende da A», con il tipo (FS fine-inizio, SS, FF, SF) e il
--     ritardo in giorni; mai una fase da sé stessa, mai fra due progetti.
--
-- I DATI. Le tabelle nascono vuote e restano vuote finché chi guida un progetto non lo pianifica
-- dalla sua pagina: i 25 progetti di RTL sono le squadre di prima (000363), senza date né processo, e
-- nessuna fonte del datastore porta un piano (misurato il 2026-11-20). Un piano inventato sarebbe un
-- dato finto.
--
-- NESSUNA COLONNA NOMINA UNA PERSONA: chi porta una fase è un'appartenenza, e l'autore non si scrive
-- qui (lo scrive il registro di audit dell'API). Attraverso l'appartenenza la fase è un dato
-- COLLEGATO della persona: il Faldone la legge come «Fasi dei progetti che porta» (faldone/classi.ts).
-- CLASSIFICAZIONE E REGISTRO: tabelle classificate in 000429 e registrate in 000062, file di numero
--   minore, emendati come per la 000501; vuote per ragione scritta nell'elenco di storia36.
-- IDEMPOTENTE: IF NOT EXISTS, vincoli in forma DROP/ADD.
-- ROLLBACK DICHIARATO (solo su tabelle vuote o con il loro contenuto, elenco esplicito):
--   DROP TABLE sys.sys_project_dependencies, sys.sys_project_phases;
--   e le due righe in 000429, 000062 e db/scripts/audit-storia36-empty-tables.txt.
-- ============================================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_project_phases (
  project_phase_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_phase_project_id       uuid NOT NULL REFERENCES sys.sys_projects(project_id) ON DELETE CASCADE,
  project_phase_tenant_id        uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  project_phase_parent_id        uuid REFERENCES sys.sys_project_phases(project_phase_id) ON DELETE CASCADE,
  project_phase_kind             varchar(16) NOT NULL DEFAULT 'ACTIVITY',
  project_phase_ordinal          integer NOT NULL DEFAULT 1,
  project_phase_name             varchar(255) NOT NULL,
  project_phase_description      text,
  project_phase_planned_start    date,
  project_phase_planned_end      date,
  project_phase_actual_start     date,
  project_phase_actual_end       date,
  project_phase_progress_pct     numeric(5,2),
  project_phase_status           varchar(16) NOT NULL DEFAULT 'PLANNED',
  project_phase_owner_member_id  uuid REFERENCES sys.sys_project_members(project_member_id) ON DELETE SET NULL,
  project_phase_process_step_id  uuid REFERENCES sys.sys_tenant_process_steps(tenant_process_step_id) ON DELETE SET NULL,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_project_phases DROP CONSTRAINT IF EXISTS sys_project_phases_kind_check;
ALTER TABLE sys.sys_project_phases ADD CONSTRAINT sys_project_phases_kind_check
  CHECK (project_phase_kind IN ('PHASE','ACTIVITY','MILESTONE'));
ALTER TABLE sys.sys_project_phases DROP CONSTRAINT IF EXISTS sys_project_phases_status_check;
ALTER TABLE sys.sys_project_phases ADD CONSTRAINT sys_project_phases_status_check
  CHECK (project_phase_status IN ('PLANNED','ACTIVE','COMPLETED','CANCELLED'));
ALTER TABLE sys.sys_project_phases DROP CONSTRAINT IF EXISTS sys_project_phases_progress_check;
ALTER TABLE sys.sys_project_phases ADD CONSTRAINT sys_project_phases_progress_check
  CHECK (project_phase_progress_pct IS NULL OR (project_phase_progress_pct >= 0 AND project_phase_progress_pct <= 100));
ALTER TABLE sys.sys_project_phases DROP CONSTRAINT IF EXISTS sys_project_phases_planned_check;
ALTER TABLE sys.sys_project_phases ADD CONSTRAINT sys_project_phases_planned_check
  CHECK (project_phase_planned_end IS NULL OR project_phase_planned_start IS NULL
         OR project_phase_planned_end >= project_phase_planned_start);
ALTER TABLE sys.sys_project_phases DROP CONSTRAINT IF EXISTS sys_project_phases_actual_check;
ALTER TABLE sys.sys_project_phases ADD CONSTRAINT sys_project_phases_actual_check
  CHECK (project_phase_actual_end IS NULL OR project_phase_actual_start IS NULL
         OR project_phase_actual_end >= project_phase_actual_start);
-- Una tappa è un istante: inizio e fine pianificati coincidono quando ci sono tutti e due.
ALTER TABLE sys.sys_project_phases DROP CONSTRAINT IF EXISTS sys_project_phases_milestone_check;
ALTER TABLE sys.sys_project_phases ADD CONSTRAINT sys_project_phases_milestone_check
  CHECK (project_phase_kind <> 'MILESTONE' OR project_phase_planned_start IS NULL
         OR project_phase_planned_end IS NULL OR project_phase_planned_start = project_phase_planned_end);
ALTER TABLE sys.sys_project_phases DROP CONSTRAINT IF EXISTS sys_project_phases_not_self_parent;
ALTER TABLE sys.sys_project_phases ADD CONSTRAINT sys_project_phases_not_self_parent
  CHECK (project_phase_parent_id IS NULL OR project_phase_parent_id <> project_phase_id);

CREATE INDEX IF NOT EXISTS sys_project_phases_project_idx ON sys.sys_project_phases (project_phase_project_id);
CREATE INDEX IF NOT EXISTS sys_project_phases_tenant_idx ON sys.sys_project_phases (project_phase_tenant_id);
CREATE INDEX IF NOT EXISTS sys_project_phases_parent_idx ON sys.sys_project_phases (project_phase_parent_id);

COMMENT ON TABLE sys.sys_project_phases IS
  'Piano di un progetto (V6, 000503): fasi, attivita'' e tappe con le date pianificate ed effettive. '
  'Chi porta una fase e'' un''appartenenza al progetto, non una persona (I18).';

CREATE TABLE IF NOT EXISTS sys.sys_project_dependencies (
  project_dependency_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_dependency_project_id    uuid NOT NULL REFERENCES sys.sys_projects(project_id) ON DELETE CASCADE,
  project_dependency_tenant_id     uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  project_dependency_predecessor_id uuid NOT NULL REFERENCES sys.sys_project_phases(project_phase_id) ON DELETE CASCADE,
  project_dependency_successor_id  uuid NOT NULL REFERENCES sys.sys_project_phases(project_phase_id) ON DELETE CASCADE,
  project_dependency_kind          varchar(2) NOT NULL DEFAULT 'FS',
  project_dependency_lag_days      integer NOT NULL DEFAULT 0,
  created_at                       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_project_dependencies DROP CONSTRAINT IF EXISTS sys_project_dependencies_kind_check;
ALTER TABLE sys.sys_project_dependencies ADD CONSTRAINT sys_project_dependencies_kind_check
  CHECK (project_dependency_kind IN ('FS','SS','FF','SF'));
ALTER TABLE sys.sys_project_dependencies DROP CONSTRAINT IF EXISTS sys_project_dependencies_not_self;
ALTER TABLE sys.sys_project_dependencies ADD CONSTRAINT sys_project_dependencies_not_self
  CHECK (project_dependency_predecessor_id <> project_dependency_successor_id);

CREATE UNIQUE INDEX IF NOT EXISTS sys_project_dependencies_pair_idx
  ON sys.sys_project_dependencies (project_dependency_predecessor_id, project_dependency_successor_id);
CREATE INDEX IF NOT EXISTS sys_project_dependencies_project_idx ON sys.sys_project_dependencies (project_dependency_project_id);

COMMENT ON TABLE sys.sys_project_dependencies IS
  'Dipendenze fra le fasi di uno stesso progetto (V6, 000503): FS, SS, FF, SF con ritardo in giorni.';

-- Post-condizione: le due tabelle ci sono e sono classificate (I23) e registrate (000062).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema = 'sys' AND table_name IN ('sys_project_phases','sys_project_dependencies');
  IF n <> 2 THEN RAISE EXCEPTION '000503: attese 2 tabelle del piano, trovate %', n; END IF;
  SELECT count(*) INTO n FROM sys.sys_classificazione_direzione_dato
   WHERE tabella IN ('sys_project_phases','sys_project_dependencies');
  IF n <> 2 THEN RAISE EXCEPTION '000503: le tabelle del piano non sono classificate in 000429 (%)', n; END IF;
END $$;

COMMIT;
