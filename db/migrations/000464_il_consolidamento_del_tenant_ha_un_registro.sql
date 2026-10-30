-- ============================================================================================
-- 000464 — Il consolidamento di un tenant rispetto al prototipo ha un registro
--          (agente di consolidamento, voce AC-3; disegno `.programmi/consolidamento/agente/05_DISEGNO_TECNICO.md` §4).
--
-- IL PROBLEMA. Un tenant che ha già i suoi dati riceve un prototipo. L'agente propone, voce per voce, se le
-- due parti parlano della stessa cosa; decide il Direttore HR o un suo delegato (specifica confermata da Enzo
-- il 2026-10-30, §6). Le decisioni durano giorni: il ponte di approvazione del gateway, in memoria e con
-- scadenza di due minuti, non può tenerle. Serve un registro nel database.
--
-- COSA FA. Sei tabelle nuove, vuote:
--   ① sys_tenant_consolidations          — una sessione: tenant, versione del prototipo, motivo, stato, gruppo aperto;
--   ② sys_tenant_consolidation_rounds    — un giro di un gruppo, con le equipollenze adottate (R-14: un giro
--                                          che non adotta niente chiude i giri del gruppo);
--   ③ sys_tenant_consolidation_working_items — la COPIA DI LAVORO del prototipo per quel tenant: il nome
--                                          originale non cambia mai, quello tradotto sì (R-13);
--   ④ sys_tenant_consolidation_proposals — una proposta dell'agente, con metodo, fiducia, motivo, dipendenze;
--   ⑤ sys_tenant_consolidation_decisions — una decisione di una persona; non si aggiorna mai, una revisione
--                                          è una riga nuova (come le deleghe, 000314);
--   ⑥ sys_platform_vocabulary_equivalences — le equivalenze di vocabolario comuni, di piattaforma, senza
--                                          tenant e senza riferimenti a righe di un tenant (R-7).
--
-- CHI SCRIVE: solo l'API (modulo tenant-consolidation). Il giudice del gateway non scrive niente.
-- CLASSIFICAZIONE E REGISTRO: le tabelle nuove sono classificate in 000429 e registrate in 000062, file di numero
--   minore, come per la 000460 e la 000462.
-- IDEMPOTENTE: IF NOT EXISTS ovunque. NESSUNA CANCELLAZIONE, nessun dato scritto.
-- INVERSA, FUORI CATENA: db/scripts/consolidamento/inversa-000464.sql (si rifiuta se una tabella ha righe).
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── ① la sessione ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_tenant_consolidations (
  tenant_consolidation_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_consolidation_tenant_id          uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  -- RESTRICT: la versione con cui si è confrontato un tenant non si cancella finché il registro la cita
  tenant_consolidation_variant_version_id uuid NOT NULL
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE RESTRICT,
  tenant_consolidation_trigger            varchar(16) NOT NULL,
  tenant_consolidation_status             varchar(16) NOT NULL DEFAULT 'GIRI',
  tenant_consolidation_open_group         varchar(24),
  tenant_consolidation_started_by         uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  tenant_consolidation_started_at         timestamptz NOT NULL DEFAULT now(),
  tenant_consolidation_closed_at          timestamptz,
  tenant_consolidation_metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT sys_tenant_consolidations_trigger_ck
    CHECK (tenant_consolidation_trigger IN ('RILASCIO', 'VERSIONE_NUOVA', 'RICHIESTA')),
  CONSTRAINT sys_tenant_consolidations_status_ck
    CHECK (tenant_consolidation_status IN ('GIRI', 'IN_CONFERMA', 'APPLICATA', 'CHIUSA')),
  CONSTRAINT sys_tenant_consolidations_group_ck
    CHECK (tenant_consolidation_open_group IS NULL OR tenant_consolidation_open_group IN
      ('ORGANIZATION', 'POSITIONS_ROLES', 'SKILLS', 'PROCESSES', 'INDICATORS_GOALS'))
);
CREATE INDEX IF NOT EXISTS sys_tenant_consolidations_tenant_idx
  ON sys.sys_tenant_consolidations (tenant_consolidation_tenant_id, tenant_consolidation_status);
-- una sola sessione aperta per tenant: due sessioni parallele produrrebbero decisioni in conflitto
CREATE UNIQUE INDEX IF NOT EXISTS sys_tenant_consolidations_one_open_uq
  ON sys.sys_tenant_consolidations (tenant_consolidation_tenant_id)
  WHERE tenant_consolidation_status IN ('GIRI', 'IN_CONFERMA');

-- ── ② i giri ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_tenant_consolidation_rounds (
  tenant_consolidation_round_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_consolidation_round_consolidation_id uuid NOT NULL
    REFERENCES sys.sys_tenant_consolidations(tenant_consolidation_id) ON DELETE CASCADE,
  tenant_consolidation_round_group            varchar(24) NOT NULL,
  tenant_consolidation_round_number           integer NOT NULL,
  tenant_consolidation_round_asked            integer NOT NULL DEFAULT 0,
  tenant_consolidation_round_adopted          integer NOT NULL DEFAULT 0,
  -- token spesi dal giudice nel giro: il costo dell'abbonamento si misura, non si stima (§11 del disegno)
  tenant_consolidation_round_tokens           integer,
  tenant_consolidation_round_fuse_tripped     boolean NOT NULL DEFAULT false,
  tenant_consolidation_round_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_tenant_consolidation_rounds_group_ck
    CHECK (tenant_consolidation_round_group IN
      ('ORGANIZATION', 'POSITIONS_ROLES', 'SKILLS', 'PROCESSES', 'INDICATORS_GOALS')),
  CONSTRAINT sys_tenant_consolidation_rounds_number_ck CHECK (tenant_consolidation_round_number >= 0),
  CONSTRAINT sys_tenant_consolidation_rounds_counts_ck
    CHECK (tenant_consolidation_round_asked >= 0 AND tenant_consolidation_round_adopted >= 0)
);
CREATE INDEX IF NOT EXISTS sys_tenant_consolidation_rounds_session_idx
  ON sys.sys_tenant_consolidation_rounds (tenant_consolidation_round_consolidation_id, tenant_consolidation_round_group);

-- ── ③ la copia di lavoro del prototipo ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_tenant_consolidation_working_items (
  tenant_consolidation_working_item_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_consolidation_working_item_consolidation_id uuid NOT NULL
    REFERENCES sys.sys_tenant_consolidations(tenant_consolidation_id) ON DELETE CASCADE,
  tenant_consolidation_working_item_group            varchar(24) NOT NULL,
  -- il codice della voce nel prototipo: la chiave stabile fra due versioni (misura AC-0)
  tenant_consolidation_working_item_prototype_key    varchar(200) NOT NULL,
  tenant_consolidation_working_item_original_name    text NOT NULL,
  tenant_consolidation_working_item_original_code    varchar(200),
  tenant_consolidation_working_item_translated_name  text,
  tenant_consolidation_working_item_translated_round integer,
  CONSTRAINT sys_tenant_consolidation_working_items_group_ck
    CHECK (tenant_consolidation_working_item_group IN
      ('ORGANIZATION', 'POSITIONS_ROLES', 'SKILLS', 'PROCESSES', 'INDICATORS_GOALS')),
  CONSTRAINT sys_tenant_consolidation_working_items_translation_ck
    CHECK ((tenant_consolidation_working_item_translated_name IS NULL) = (tenant_consolidation_working_item_translated_round IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_tenant_consolidation_working_items_key_uq
  ON sys.sys_tenant_consolidation_working_items
     (tenant_consolidation_working_item_consolidation_id, tenant_consolidation_working_item_group,
      tenant_consolidation_working_item_prototype_key);

-- ── ④ le proposte ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_tenant_consolidation_proposals (
  tenant_consolidation_proposal_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_consolidation_proposal_consolidation_id uuid NOT NULL
    REFERENCES sys.sys_tenant_consolidations(tenant_consolidation_id) ON DELETE CASCADE,
  tenant_consolidation_proposal_group            varchar(24) NOT NULL,
  -- due elenchi per la cardinalità: una voce del tenant può coprire più voci del prototipo, e il contrario (R-12)
  tenant_consolidation_proposal_prototype_keys   text[] NOT NULL DEFAULT '{}',
  tenant_consolidation_proposal_tenant_keys      text[] NOT NULL DEFAULT '{}',
  tenant_consolidation_proposal_outcome          varchar(20) NOT NULL,
  tenant_consolidation_proposal_method           varchar(16) NOT NULL,
  tenant_consolidation_proposal_confidence       smallint NOT NULL,
  tenant_consolidation_proposal_reason           text NOT NULL,
  tenant_consolidation_proposal_round            integer NOT NULL,
  tenant_consolidation_proposal_adopted          boolean NOT NULL DEFAULT false,
  tenant_consolidation_proposal_depends_on       uuid[] NOT NULL DEFAULT '{}',
  -- una proposta superata da un rifacimento dei giri non si cancella: si marca, e il registro resta leggibile
  tenant_consolidation_proposal_superseded_at    timestamptz,
  tenant_consolidation_proposal_created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_tenant_consolidation_proposals_group_ck
    CHECK (tenant_consolidation_proposal_group IN
      ('ORGANIZATION', 'POSITIONS_ROLES', 'SKILLS', 'PROCESSES', 'INDICATORS_GOALS')),
  CONSTRAINT sys_tenant_consolidation_proposals_outcome_ck
    CHECK (tenant_consolidation_proposal_outcome IN ('CORRISPONDENZA', 'LACUNA', 'PERSONALIZZAZIONE')),
  CONSTRAINT sys_tenant_consolidation_proposals_method_ck
    CHECK (tenant_consolidation_proposal_method IN ('CHIAVE', 'VOCABOLARIO', 'SEMANTICA')),
  CONSTRAINT sys_tenant_consolidation_proposals_confidence_ck
    CHECK (tenant_consolidation_proposal_confidence BETWEEN 0 AND 100),
  -- la forma dell'esito: una corrispondenza ha due lati, una lacuna solo il prototipo, una personalizzazione solo il tenant
  CONSTRAINT sys_tenant_consolidation_proposals_sides_ck CHECK (
    (tenant_consolidation_proposal_outcome = 'CORRISPONDENZA'
       AND cardinality(tenant_consolidation_proposal_prototype_keys) > 0
       AND cardinality(tenant_consolidation_proposal_tenant_keys) > 0)
    OR (tenant_consolidation_proposal_outcome = 'LACUNA'
       AND cardinality(tenant_consolidation_proposal_prototype_keys) > 0
       AND cardinality(tenant_consolidation_proposal_tenant_keys) = 0)
    OR (tenant_consolidation_proposal_outcome = 'PERSONALIZZAZIONE'
       AND cardinality(tenant_consolidation_proposal_prototype_keys) = 0
       AND cardinality(tenant_consolidation_proposal_tenant_keys) > 0))
);
CREATE INDEX IF NOT EXISTS sys_tenant_consolidation_proposals_session_idx
  ON sys.sys_tenant_consolidation_proposals (tenant_consolidation_proposal_consolidation_id, tenant_consolidation_proposal_group)
  WHERE tenant_consolidation_proposal_superseded_at IS NULL;

-- ── ⑤ le decisioni ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_tenant_consolidation_decisions (
  tenant_consolidation_decision_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_consolidation_decision_proposal_id uuid NOT NULL
    REFERENCES sys.sys_tenant_consolidation_proposals(tenant_consolidation_proposal_id) ON DELETE RESTRICT,
  -- il tenant ripetuto qui: il filtro del middleware (I5) lavora sulla riga, senza risalire la catena
  tenant_consolidation_decision_tenant_id   uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  tenant_consolidation_decision_value       varchar(20) NOT NULL,
  tenant_consolidation_decision_form        varchar(16),
  tenant_consolidation_decision_adr48_state varchar(12),
  tenant_consolidation_decision_reason      text,
  tenant_consolidation_decision_decided_by  uuid NOT NULL REFERENCES sys.sys_users(user_id),
  -- la delega con cui ha deciso un delegato; nulla per il Direttore stesso
  tenant_consolidation_decision_delegation_id uuid REFERENCES sys.sys_user_delegations(user_delegation_id),
  tenant_consolidation_decision_decided_at  timestamptz NOT NULL DEFAULT now(),
  -- una revisione del Direttore è una riga nuova che sostituisce questa: la storia non si sovrascrive
  tenant_consolidation_decision_supersedes_id uuid
    REFERENCES sys.sys_tenant_consolidation_decisions(tenant_consolidation_decision_id),
  CONSTRAINT sys_tenant_consolidation_decisions_value_ck
    CHECK (tenant_consolidation_decision_value IN ('CONFERMATA', 'RIFIUTATA', 'ADOTTATA', 'NON_ADOTTATA', 'PERSONALIZZAZIONE')),
  CONSTRAINT sys_tenant_consolidation_decisions_form_ck
    CHECK (tenant_consolidation_decision_form IS NULL
        OR tenant_consolidation_decision_form IN ('NORMALIZZATA', 'FORMA_TENANT', 'NOME_PROTOTIPO')),
  CONSTRAINT sys_tenant_consolidation_decisions_form_only_link_ck
    CHECK (tenant_consolidation_decision_form IS NULL OR tenant_consolidation_decision_value = 'CONFERMATA'),
  CONSTRAINT sys_tenant_consolidation_decisions_adr48_ck
    CHECK (tenant_consolidation_decision_adr48_state IS NULL
        OR tenant_consolidation_decision_adr48_state IN ('EREDITATA', 'CONSERVATA', 'PROPRIA'))
);
CREATE INDEX IF NOT EXISTS sys_tenant_consolidation_decisions_proposal_idx
  ON sys.sys_tenant_consolidation_decisions (tenant_consolidation_decision_proposal_id);
CREATE INDEX IF NOT EXISTS sys_tenant_consolidation_decisions_tenant_idx
  ON sys.sys_tenant_consolidation_decisions (tenant_consolidation_decision_tenant_id, tenant_consolidation_decision_decided_by);

-- ── ⑥ il vocabolario comune, di piattaforma ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_platform_vocabulary_equivalences (
  platform_vocabulary_equivalence_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_vocabulary_equivalence_group          varchar(24) NOT NULL,
  platform_vocabulary_equivalence_tenant_term    varchar(100) NOT NULL,
  platform_vocabulary_equivalence_prototype_term varchar(100) NOT NULL,
  platform_vocabulary_equivalence_status         varchar(12) NOT NULL DEFAULT 'PROPOSTA',
  platform_vocabulary_equivalence_approved_by    uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  platform_vocabulary_equivalence_approved_at    timestamptz,
  platform_vocabulary_equivalence_created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_platform_vocabulary_equivalences_group_ck
    CHECK (platform_vocabulary_equivalence_group IN
      ('ORGANIZATION', 'POSITIONS_ROLES', 'SKILLS', 'PROCESSES', 'INDICATORS_GOALS')),
  CONSTRAINT sys_platform_vocabulary_equivalences_status_ck
    CHECK (platform_vocabulary_equivalence_status IN ('PROPOSTA', 'APPROVATA', 'RITIRATA')),
  CONSTRAINT sys_platform_vocabulary_equivalences_approved_ck
    CHECK (platform_vocabulary_equivalence_status <> 'APPROVATA'
        OR (platform_vocabulary_equivalence_approved_by IS NOT NULL AND platform_vocabulary_equivalence_approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_platform_vocabulary_equivalences_terms_uq
  ON sys.sys_platform_vocabulary_equivalences
     (platform_vocabulary_equivalence_group, platform_vocabulary_equivalence_tenant_term,
      platform_vocabulary_equivalence_prototype_term);

COMMENT ON TABLE sys.sys_tenant_consolidations IS
  '000464 (agente di consolidamento AC-3) — una sessione di consolidamento di un tenant rispetto a una versione del prototipo.';
COMMENT ON TABLE sys.sys_tenant_consolidation_rounds IS
  '000464 (AC-3) — un giro dell''agente su un gruppo; un giro con zero adozioni chiude i giri del gruppo (R-14).';
COMMENT ON TABLE sys.sys_tenant_consolidation_working_items IS
  '000464 (AC-3) — la copia di lavoro del prototipo per un tenant: il nome originale non cambia mai (R-13). Il prototipo approvato non si tocca.';
COMMENT ON TABLE sys.sys_tenant_consolidation_proposals IS
  '000464 (AC-3) — una proposta dell''agente: corrispondenza, lacuna o personalizzazione, con metodo, fiducia e motivo. Vale solo dopo una decisione.';
COMMENT ON TABLE sys.sys_tenant_consolidation_decisions IS
  '000464 (AC-3) — una decisione di una persona (Direttore HR o delegato) su una proposta. Non si aggiorna: una revisione è una riga nuova.';
COMMENT ON TABLE sys.sys_platform_vocabulary_equivalences IS
  '000464 (AC-3) — equivalenze di vocabolario comuni a tutti i tenant, approvate dalla piattaforma (R-7). Nessun dato di un tenant.';

COMMIT;

-- ============================================================================================
-- POST-CONDIZIONI
-- ============================================================================================
DO $$
DECLARE n_tab int; n_cl int; n_rr int; n_ck int;
BEGIN
  SELECT count(*) INTO n_tab FROM information_schema.tables
   WHERE table_schema = 'sys' AND table_name IN (
     'sys_tenant_consolidations', 'sys_tenant_consolidation_rounds', 'sys_tenant_consolidation_working_items',
     'sys_tenant_consolidation_proposals', 'sys_tenant_consolidation_decisions', 'sys_platform_vocabulary_equivalences');
  IF n_tab <> 6 THEN RAISE EXCEPTION '000464: le tabelle sono % invece di 6', n_tab; END IF;

  SELECT count(*) INTO n_cl FROM sys.sys_classificazione_direzione_dato
   WHERE tabella IN (
     'sys_tenant_consolidations', 'sys_tenant_consolidation_rounds', 'sys_tenant_consolidation_working_items',
     'sys_tenant_consolidation_proposals', 'sys_tenant_consolidation_decisions', 'sys_platform_vocabulary_equivalences');
  SELECT count(*) INTO n_rr FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name IN (
     'sys_tenant_consolidations', 'sys_tenant_consolidation_rounds', 'sys_tenant_consolidation_working_items',
     'sys_tenant_consolidation_proposals', 'sys_tenant_consolidation_decisions', 'sys_platform_vocabulary_equivalences');
  IF n_cl <> 6 OR n_rr <> 6 THEN
    RAISE EXCEPTION '000464: tabelle classificate in 000429: % su 6; registrate in 000062: % su 6', n_cl, n_rr;
  END IF;

  -- le guardie di forma devono essere nel database, non solo nel testo
  SELECT count(*) INTO n_ck FROM pg_constraint
   WHERE conname IN ('sys_tenant_consolidation_proposals_sides_ck', 'sys_tenant_consolidation_decisions_form_only_link_ck',
                     'sys_tenant_consolidation_working_items_translation_ck');
  IF n_ck <> 3 THEN RAISE EXCEPTION '000464: i CHECK di forma sono % invece di 3', n_ck; END IF;

  RAISE NOTICE '000464 ok — 6 tabelle del consolidamento, classificate e registrate, 3 CHECK di forma.';
END $$;
