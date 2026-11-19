-- ============================================================================================
-- 000499 — Le decisioni della scheda «Allineamento» del consolidamento (piano
-- docs/piani/PIANO_scheda-allineamento_20261118.md, ADR-0059).
--
-- COSA FA.
--   ① sys.sys_alignment_decisions: per un tenant e una corsa del modello (sys_blueprint_runs), una riga per
--      ogni voce della distanza su cui una persona ha preso una decisione: Unisco, Adotto, Tengo, Tolgo.
--      La voce si riconosce dalla sua chiave (dominio, lato, nomi normalizzati, ricorrenza), calcolata
--      dall'API sulla misura della distanza; i nomi si conservano per leggere la decisione anche quando la
--      voce non c'è più.
--      Due colonne di decisione: quella in BOZZA e quella APPROVATA. Il Direttore HR salva le bozze; il
--      pulsante rosso porta le bozze in approvate. Le approvate sono il registro da cui il motore
--      dell'allineamento (tappe B-C-E del piano 20261116) cambierà i dati del tenant: questa tabella non
--      cambia nessun dato del tenant.
--
-- IDEMPOTENTE: IF NOT EXISTS ovunque. NESSUNA CANCELLAZIONE, nessun dato scritto.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_alignment_decisions (
  alignment_decision_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alignment_decision_tenant_id   uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  alignment_decision_run_id      uuid NOT NULL REFERENCES sys.sys_blueprint_runs(blueprint_run_id) ON DELETE CASCADE,
  alignment_decision_domain      varchar(32) NOT NULL,
  alignment_decision_row_key     varchar(64) NOT NULL,
  alignment_decision_side        varchar(16) NOT NULL,
  alignment_decision_model_label text,
  alignment_decision_tenant_label text,
  alignment_decision_proposed    varchar(16),
  alignment_decision_draft       varchar(16),
  alignment_decision_drafted_by  uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  alignment_decision_drafted_at  timestamptz,
  alignment_decision_approved    varchar(16),
  alignment_decision_approved_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  alignment_decision_approved_at timestamptz,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_alignment_decisions_row_uq
    UNIQUE (alignment_decision_run_id, alignment_decision_domain, alignment_decision_row_key),
  CONSTRAINT sys_alignment_decisions_domain_ck CHECK (alignment_decision_domain IN (
    'ateco', 'classe', 'ccnl', 'processi', 'unita', 'organigramma', 'obblighi', 'ruoli', 'copertura',
    'inquadramento', 'fasi', 'skill', 'obiettivi', 'metriche', 'derivati', 'bersagli', 'formazione',
    'carriere', 'incentivi', 'commesse', 'criticita', 'condizioni', 'ruoli_funzionali', 'utenti')),
  CONSTRAINT sys_alignment_decisions_side_ck
    CHECK (alignment_decision_side IN ('COPPIA', 'SOLO_MODELLO', 'SOLO_TENANT')),
  CONSTRAINT sys_alignment_decisions_proposed_ck
    CHECK (alignment_decision_proposed IS NULL OR alignment_decision_proposed IN ('UNISCO', 'ADOTTO', 'TENGO', 'TOLGO')),
  CONSTRAINT sys_alignment_decisions_draft_ck
    CHECK (alignment_decision_draft IS NULL OR alignment_decision_draft IN ('UNISCO', 'ADOTTO', 'TENGO', 'TOLGO')),
  CONSTRAINT sys_alignment_decisions_approved_ck
    CHECK (alignment_decision_approved IS NULL OR alignment_decision_approved IN ('UNISCO', 'ADOTTO', 'TENGO', 'TOLGO')),
  CONSTRAINT sys_alignment_decisions_row_key_ck CHECK (alignment_decision_row_key ~ '^[0-9a-f]{32}$'),
  -- una riga vive solo se porta almeno una decisione
  CONSTRAINT sys_alignment_decisions_something_ck
    CHECK (alignment_decision_draft IS NOT NULL OR alignment_decision_approved IS NOT NULL),
  CONSTRAINT sys_alignment_decisions_approval_ck
    CHECK ((alignment_decision_approved IS NULL) = (alignment_decision_approved_at IS NULL))
);
CREATE INDEX IF NOT EXISTS sys_alignment_decisions_tenant_run_idx
  ON sys.sys_alignment_decisions (alignment_decision_tenant_id, alignment_decision_run_id);
CREATE INDEX IF NOT EXISTS sys_alignment_decisions_draft_idx
  ON sys.sys_alignment_decisions (alignment_decision_run_id) WHERE alignment_decision_draft IS NOT NULL;

DROP TRIGGER IF EXISTS sys_alignment_decisions_set_updated_at ON sys.sys_alignment_decisions;
CREATE TRIGGER sys_alignment_decisions_set_updated_at BEFORE UPDATE ON sys.sys_alignment_decisions
  FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();

COMMENT ON TABLE sys.sys_alignment_decisions IS
  'Decisioni della scheda Allineamento (Unisco, Adotto, Tengo, Tolgo) per voce della distanza fra tenant e corsa del modello: bozza e approvata; non cambia i dati del tenant (000499).';

COMMIT;
