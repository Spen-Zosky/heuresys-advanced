-- ============================================================================================
-- 000488 — Il consolidamento applica le decisioni ai dati del tenant (agente di consolidamento, voce AC-8;
--          piano docs/piani/PIANO_consolidamento-applicazione_20261113.md).
--
-- COSA FA.
--   ① sys.sys_tenant_consolidation_links: una riga per proposta, con il collegamento fra le voci del tenant e
--      quelle del prototipo, la forma scelta, lo stato ADR-0048 e il rapporto dell'ultima applicazione;
--   ② staging.tenant_consolidation_undo: il giornale di ritorno. Ogni valore sovrascritto o riga creata
--      dall'applicazione ha qui il valore di prima; l'applicazione lo usa per ritirare una decisione sostituita.
--
-- IDEMPOTENTE: IF NOT EXISTS ovunque. NESSUNA CANCELLAZIONE, nessun dato scritto.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_tenant_consolidation_links (
  tenant_consolidation_link_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_consolidation_link_tenant_id     uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  tenant_consolidation_link_proposal_id   uuid NOT NULL
    REFERENCES sys.sys_tenant_consolidation_proposals(tenant_consolidation_proposal_id) ON DELETE CASCADE,
  tenant_consolidation_link_decision_id   uuid NOT NULL
    REFERENCES sys.sys_tenant_consolidation_decisions(tenant_consolidation_decision_id),
  tenant_consolidation_link_group         varchar(24) NOT NULL,
  tenant_consolidation_link_decision      varchar(20) NOT NULL,
  tenant_consolidation_link_form          varchar(16),
  tenant_consolidation_link_adr48_state   varchar(12),
  tenant_consolidation_link_tenant_keys   text[] NOT NULL DEFAULT '{}',
  tenant_consolidation_link_prototype_keys text[] NOT NULL DEFAULT '{}',
  tenant_consolidation_link_report        jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_consolidation_link_applied_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_tenant_consolidation_links_proposal_uq UNIQUE (tenant_consolidation_link_proposal_id),
  CONSTRAINT sys_tenant_consolidation_links_group_ck
    CHECK (tenant_consolidation_link_group IN ('ORGANIZATION', 'POSITIONS_ROLES', 'SKILLS', 'PROCESSES', 'INDICATORS_GOALS')),
  CONSTRAINT sys_tenant_consolidation_links_adr48_ck
    CHECK (tenant_consolidation_link_adr48_state IS NULL OR tenant_consolidation_link_adr48_state IN ('EREDITATA', 'CONSERVATA', 'PROPRIA'))
);
CREATE INDEX IF NOT EXISTS sys_tenant_consolidation_links_tenant_idx
  ON sys.sys_tenant_consolidation_links (tenant_consolidation_link_tenant_id, tenant_consolidation_link_group);

CREATE TABLE IF NOT EXISTS staging.tenant_consolidation_undo (
  undo_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  proposal_id   uuid NOT NULL,
  decision_id   uuid NOT NULL,
  kind          varchar(8) NOT NULL CHECK (kind IN ('UPDATE', 'INSERT')),
  table_name    varchar(63) NOT NULL,
  record_id     uuid NOT NULL,
  column_name   varchar(63),
  value_before  text,
  value_after   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  reverted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS tenant_consolidation_undo_proposal_idx
  ON staging.tenant_consolidation_undo (proposal_id) WHERE reverted_at IS NULL;

COMMIT;
