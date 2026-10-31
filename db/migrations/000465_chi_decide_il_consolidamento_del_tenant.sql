-- ============================================================================================
-- 000465 — Chi decide il consolidamento del tenant: quattro permessi e la delega per gruppi di dati
--          (agente di consolidamento, voce AC-4; disegno `.programmi/consolidamento/agente/05_DISEGNO_TECNICO.md` §7).
--
-- LA REGOLA (specifica confermata da Enzo il 2026-10-30, §6). Ogni collegamento, adozione e normalizzazione li
-- conferma il Direttore HR del tenant (HRMS_MANAGER) o un suo delegato. Il Direttore può nominare più delegati e
-- limitarli a gruppi di dati (per esempio il responsabile della formazione solo per le competenze); la delega è
-- registrata e revocabile. Il vocabolario comune lo approva la piattaforma.
--
-- COSA FA.
--   ① quattro permessi: consolidation:read, consolidation:run, consolidation:decide, vocabulary:approve;
--   ② le concessioni: HRMS_MANAGER read+run+decide; TENANT_ADMIN read; PLATFORM_ADMIN read+vocabulary:approve.
--     PLATFORM_ADMIN NON riceve decide da qui: è un mandato tecnico (ADR-0036). La 000005 gli dà
--     comunque ogni permesso; il confine sui dati del cliente lo tiene il tenant della sessione (I5);
--   ③ la delega CONSOLIDATION: un ambito in più su sys_user_delegations e la colonna dei gruppi ammessi. Il CHECK
--     nasce in 000314, EMENDATA alla fonte in questo stesso incremento (ADR-0035); qui si cambia l'esemplare
--     esistente, che un CREATE TABLE IF NOT EXISTS non ricrea;
--   ④ le traduzioni EN dei permessi (ADR-0029).
-- I quattro permessi sono solo-plenipotenziari PER DECISIONE: dichiarati in 000418, file di numero minore.
--
-- IDEMPOTENTE. NESSUNA CANCELLAZIONE: il CHECK si allarga, nessuna delega esistente diventa non valida.
-- MISURA PRIMA E DOPO: il numero delle deleghe non cambia (post-condizione).
-- ============================================================================================

\set ON_ERROR_STOP on

CREATE TEMP TABLE _deleghe_prima_000465 AS SELECT count(*) AS n FROM sys.sys_user_delegations;

BEGIN;

-- ── ① i permessi ────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT v.code, v.nome, v.risorsa, v.azione
  FROM (VALUES
    ('consolidation:read',   'Vedere il consolidamento del tenant e il suo registro', 'consolidation', 'read'),
    ('consolidation:run',    'Avviare una sessione o un giro di consolidamento',       'consolidation', 'run'),
    ('consolidation:decide', 'Confermare, rifiutare o adottare le proposte di consolidamento', 'consolidation', 'decide'),
    ('vocabulary:approve',   'Approvare le equivalenze del vocabolario comune',        'vocabulary',    'approve')
  ) AS v(code, nome, risorsa, azione)
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_permissions p WHERE p.auth_permission_code = v.code);

-- TENANT_ADMIN legge soltanto (guardia D-57, deny-by-default della 000210).
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000465(code text PRIMARY KEY);
INSERT INTO _ta_extend_000465(code) VALUES
    ('consolidation:read');
DROP TABLE _ta_extend_000465;

-- ── ② le concessioni ────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM (VALUES
    ('HRMS_MANAGER',   'consolidation:read'),
    ('HRMS_MANAGER',   'consolidation:run'),
    ('HRMS_MANAGER',   'consolidation:decide'),
    ('TENANT_ADMIN',   'consolidation:read'),
    ('PLATFORM_ADMIN', 'consolidation:read'),
    ('PLATFORM_ADMIN', 'vocabulary:approve')
  ) AS g(ruolo, codice)
  JOIN sys.sys_auth_roles r ON r.auth_role_code = g.ruolo
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = g.codice
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- ── ③ la delega per gruppi ──────────────────────────────────────────────────────────────
ALTER TABLE sys.sys_user_delegations
  ADD COLUMN IF NOT EXISTS user_delegation_groups text[];

-- l'esemplare del CHECK dell'ambito: si sostituisce solo se non ammette già CONSOLIDATION
DO $$
DECLARE nome text; def text;
BEGIN
  SELECT c.conname, pg_get_constraintdef(c.oid) INTO nome, def
    FROM pg_constraint c
   WHERE c.conrelid = 'sys.sys_user_delegations'::regclass AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%user_delegation_scope%';
  IF def IS NULL OR def NOT LIKE '%CONSOLIDATION%' THEN
    IF nome IS NOT NULL THEN EXECUTE format('ALTER TABLE sys.sys_user_delegations DROP CONSTRAINT %I', nome); END IF;
    ALTER TABLE sys.sys_user_delegations ADD CONSTRAINT sys_user_delegations_user_delegation_scope_check
      CHECK (user_delegation_scope IN ('APPROVALS', 'FULL', 'CONSOLIDATION'));
  END IF;
END $$;

-- i gruppi: solo per una delega CONSOLIDATION, almeno uno, presi dall'elenco chiuso dei cinque.
-- `IS NOT NULL` esplicito: un CHECK che vale NULL lascia passare la riga, e cardinality(NULL) è
-- NULL (visto sulla copia della VM il 2026-10-31: una delega CONSOLIDATION senza gruppi passava).
-- Un esemplare nato senza quella clausola si sostituisce.
DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint
   WHERE conrelid = 'sys.sys_user_delegations'::regclass AND conname = 'sys_user_delegations_groups_ck';
  IF def IS NOT NULL AND def NOT LIKE '%user_delegation_groups IS NOT NULL%' THEN
    ALTER TABLE sys.sys_user_delegations DROP CONSTRAINT sys_user_delegations_groups_ck;
    def := NULL;
  END IF;
  IF def IS NULL THEN
    ALTER TABLE sys.sys_user_delegations ADD CONSTRAINT sys_user_delegations_groups_ck CHECK (
      (user_delegation_scope <> 'CONSOLIDATION' AND user_delegation_groups IS NULL)
      OR (user_delegation_scope = 'CONSOLIDATION'
          AND user_delegation_groups IS NOT NULL
          AND cardinality(user_delegation_groups) > 0
          AND user_delegation_groups <@ ARRAY['ORGANIZATION', 'POSITIONS_ROLES', 'SKILLS', 'PROCESSES', 'INDICATORS_GOALS']::text[]));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_user_delegations.user_delegation_groups IS
  '000465 (AC-4) — per una delega CONSOLIDATION, i gruppi di dati su cui il delegato decide; nulla per gli altri ambiti.';

-- ── ④ le traduzioni EN ──────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.en, 'MANUAL'
  FROM (VALUES
    ('consolidation:read',   'View the tenant consolidation and its register'),
    ('consolidation:run',    'Start a consolidation session or round'),
    ('consolidation:decide', 'Confirm, reject or adopt consolidation proposals'),
    ('vocabulary:approve',   'Approve common vocabulary equivalences')
  ) AS v(code, en)
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = v.code
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================================
-- POST-CONDIZIONI
-- ============================================================================================
DO $$
DECLARE n_perm int; n_grant int; n_trad int; n_ck int; n_prima bigint; n_dopo bigint;
BEGIN
  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('consolidation:read', 'consolidation:run', 'consolidation:decide', 'vocabulary:approve');
  IF n_perm <> 4 THEN RAISE EXCEPTION '000465: i permessi sono % invece di 4', n_perm; END IF;

  -- ciò che QUESTA migrazione concede, non lo stato globale (la lezione della 000314)
  SELECT count(*) INTO n_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE (r.auth_role_code, p.auth_permission_code) IN (
     ('HRMS_MANAGER', 'consolidation:read'), ('HRMS_MANAGER', 'consolidation:run'), ('HRMS_MANAGER', 'consolidation:decide'),
     ('TENANT_ADMIN', 'consolidation:read'), ('PLATFORM_ADMIN', 'consolidation:read'), ('PLATFORM_ADMIN', 'vocabulary:approve'));
  IF n_grant <> 6 THEN RAISE EXCEPTION '000465: le concessioni sono % invece di 6', n_grant; END IF;

  -- PLATFORM_ADMIN riceve OGNI permesso dalla 000005 a ogni passata della catena (visto in CI il
  -- 2026-10-31: una post-condizione che glielo negava rompeva la seconda passata). Il «nessun decide
  -- sui dati di un tenant cliente» non sta quindi nella concessione ma nel servizio: il tenant
  -- viene dalla sessione (I5), e la sessione di un amministratore di piattaforma non è quella di
  -- un tenant cliente. Ritirargli il permesso sarebbe una seconda eccezione a G-D2 (000420).

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en' AND t.field = 'name'
     AND p.auth_permission_code IN ('consolidation:read', 'consolidation:run', 'consolidation:decide', 'vocabulary:approve');
  IF n_trad <> 4 THEN RAISE EXCEPTION '000465: le traduzioni EN sono % invece di 4', n_trad; END IF;

  SELECT count(*) INTO n_ck FROM pg_constraint
   WHERE conrelid = 'sys.sys_user_delegations'::regclass
     AND (conname = 'sys_user_delegations_groups_ck'
          OR (contype = 'c' AND pg_get_constraintdef(oid) LIKE '%CONSOLIDATION%' AND pg_get_constraintdef(oid) LIKE '%APPROVALS%'));
  IF n_ck <> 2 THEN RAISE EXCEPTION '000465: i CHECK della delega CONSOLIDATION sono % invece di 2', n_ck; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_user_delegations_groups_ck'
                  AND pg_get_constraintdef(oid) LIKE '%user_delegation_groups IS NOT NULL%') THEN
    RAISE EXCEPTION '000465: il CHECK dei gruppi non respinge una delega CONSOLIDATION senza gruppi';
  END IF;

  SELECT n INTO n_prima FROM _deleghe_prima_000465;
  SELECT count(*) INTO n_dopo FROM sys.sys_user_delegations;
  IF n_prima <> n_dopo THEN RAISE EXCEPTION '000465: le deleghe erano % e ora sono %', n_prima, n_dopo; END IF;

  RAISE NOTICE '000465 ok — 4 permessi, 6 concessioni, delega CONSOLIDATION per gruppi, % deleghe invariate', n_dopo;
END $$;

DROP TABLE _deleghe_prima_000465;
