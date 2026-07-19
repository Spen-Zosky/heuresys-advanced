-- ============================================================================
-- 000179_process_participants.sql — #24 ADR-0027 F4: l'asse FUNZIONALE.
--
-- Il modello bi-assiale (ADR-0027) ha due catene ortogonali:
--   - ORGANIZZATIVA (reports-to transitivo) → gatea i dati SENSIBILI. Gia' viva
--     da F0-F3 (lib/scope/org.ts + resolver.ts).
--   - FUNZIONALE (appartenenza a team/processo) → gatea le ATTIVITA'. Meta'
--     mancante: i team ci sono (sys_teams.team_lead_user_id + sys_team_members),
--     i processi no.
--
-- sys_organization_unit_processes assegna un processo a un'UNITA' ORGANIZZATIVA
-- con ruolo RACI (105 righe live). F4 richiede il livello UTENTE: chi, come
-- persona, conduce o partecipa a un processo. Questa tabella lo aggiunge.
--
-- VOCABOLARIO: stesso RACI della controparte org-unit
-- (OWNER/CONTRIBUTOR/CONSULTED/INFORMED) invece di introdurre un sinonimo.
-- OWNER e' il ruolo che CONCEDE scope funzionale, l'equivalente di LEAD per i
-- team — l'asimmetria dei due nomi e' voluta: ciascun dominio conserva il
-- vocabolario che gia' usa (vedi lib/scope/functional.ts).
--
-- INVARIANTI: I3/I4 (sys.sys_<plural>) · RD-08 (varchar + CHECK, mai ENUM) ·
-- I5 (isolamento tenant via FK + filtro applicativo, mai RLS).
--
-- IDEMPOTENTE: CREATE TABLE/INDEX IF NOT EXISTS.
-- Authored: 2026-07-19.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_process_participants (
  process_participant_id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_participant_tenant_id           uuid NOT NULL,
  process_participant_org_unit_process_id uuid NOT NULL,
  process_participant_user_id             uuid NOT NULL,
  process_participant_role                varchar(16) NOT NULL DEFAULT 'CONTRIBUTOR',
  process_participant_is_active           boolean NOT NULL DEFAULT true,
  process_participant_metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                              timestamptz NOT NULL DEFAULT now(),
  created_by                              uuid,
  updated_at                              timestamptz NOT NULL DEFAULT now(),
  updated_by                              uuid,
  CONSTRAINT sys_process_participants_role_check
    CHECK (process_participant_role IN ('OWNER', 'CONTRIBUTOR', 'CONSULTED', 'INFORMED')),
  CONSTRAINT sys_process_participants_updated_after
    CHECK (updated_at >= created_at),
  CONSTRAINT sys_process_participants_tenant_fk
    FOREIGN KEY (process_participant_tenant_id)
    REFERENCES sys.sys_tenancies (tenant_id) ON DELETE CASCADE,
  CONSTRAINT sys_process_participants_process_fk
    FOREIGN KEY (process_participant_org_unit_process_id)
    REFERENCES sys.sys_organization_unit_processes (organization_unit_process_id) ON DELETE CASCADE,
  CONSTRAINT sys_process_participants_user_fk
    FOREIGN KEY (process_participant_user_id)
    REFERENCES sys.sys_users (user_id) ON DELETE CASCADE
);

-- Una sola riga per (processo, utente): il ruolo si aggiorna, non si duplica.
CREATE UNIQUE INDEX IF NOT EXISTS sys_process_participants_process_user_uq
  ON sys.sys_process_participants (process_participant_org_unit_process_id, process_participant_user_id);

-- "i processi che conduco" (hot path di functionalScopeUserIds)
CREATE INDEX IF NOT EXISTS sys_process_participants_user_idx
  ON sys.sys_process_participants (process_participant_user_id, process_participant_is_active);

-- "chi partecipa a questo processo"
CREATE INDEX IF NOT EXISTS sys_process_participants_process_idx
  ON sys.sys_process_participants (process_participant_org_unit_process_id, process_participant_is_active);

CREATE INDEX IF NOT EXISTS sys_process_participants_tenant_idx
  ON sys.sys_process_participants (process_participant_tenant_id);

-- Reconciliation registry — OBBLIGATORIO per ogni nuova tabella sys.*.
-- 000062 asserisce "0 UNCLASSIFIED" su sys.v_reconciliation_status, che marca come
-- UNCLASSIFIED qualunque tabella sys.* assente dal registro. Su un rebuild da zero
-- 000062 gira prima che questa tabella esista (nessun problema), ma alla RI-esecuzione
-- della catena — cioe' esattamente la prova di idempotenza di `pnpm db:validate` — la
-- tabella c'e' gia' e l'assert scatta. Registrarla qui chiude entrambi i casi.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_process_participants', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored authorization metadata (mig 000179, ADR-0027 F4): user-level process membership feeding the functional axis. Not a legacy-reconciliation target; the org-unit counterpart (sys_organization_unit_processes) and the team counterpart (sys_team_members) are app-authored too.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;
