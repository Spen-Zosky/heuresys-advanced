-- ============================================================================
-- 000485 — Il modello dei ruoli (ADR-0057; modello approvato da Enzo il 2026-11-10).
--
-- PERCHE' ESISTE. Misura del 2026-11-10 sul dump di produzione delle 03:42: 402 concessioni
-- attive su 167 utenti di RTL Bank, ruoli a pila (i 10 direttori di filiale con BRANCH_MANAGER,
-- TEAM_LEADER, TEAM_MEMBER e USER), sei ruoli sulla Direttrice HR, nessun atto di mandato. La
-- causa non e' un errore singolo: dieci migrazioni concedono ruoli, ciascuna con il suo criterio,
-- e si riapplicano a ogni rilascio. ADR-0057 fissa le regole:
--   · il ruolo di COMANDO si calcola dall'organigramma, al massimo uno per persona;
--   · il ruolo FUNZIONALE lo decide Enzo per nome, al massimo uno per persona;
--   · TEAM_MEMBER non si concede piu' (i suoi permessi sono tutti dentro USER);
--   · un ruolo che ne contiene un altro lo sostituisce.
--
-- COSA FA QUESTO FILE (struttura, non dati di persone):
--   §1 allinea i permessi perche' «chi contiene sostituisce» sia vero: BRANCH_MANAGER e CEO
--      ricevono i permessi di TEAM_LEADER, CEO quelli di BRANCH_MANAGER, TENANT_ADMIN i 3 di
--      HRMS_MANAGER che non aveva. Solo aggiunte: nessun permesso tolto a nessuno.
--   §2 sys.v_ruoli_di_comando_attesi: il ruolo di comando che l'organigramma assegna a ogni
--      persona (regola R2 di ADR-0057).
--   §3 sys.v_ruoli_fuori_modello: le concessioni attive che il modello non prevede e i ruoli
--      di comando attesi che mancano. Informativa: non blocca la catena.
--   §4 staging.modello_ruoli_corse e staging.modello_ruoli_undo: il registro delle corse dello
--      script db/scripts/modello-ruoli.sql e il suo giornale di ritorno. Quando lo script e'
--      stato applicato (una riga APPLICATA), le migrazioni 000150, 000155, 000259 e 000272
--      smettono di concedere ruoli: su un database nuovo continuano a farlo come prima.
--
-- I DATI DELLE PERSONE NON LI TOCCA: l'allineamento delle concessioni e' lo script fuori catena
-- db/scripts/modello-ruoli.sql, che in produzione si lancia solo con una frase scritta di Enzo.
--
-- IDEMPOTENTE: ON CONFLICT DO NOTHING, CREATE OR REPLACE VIEW, CREATE TABLE IF NOT EXISTS.
-- ROLLBACK di §1: i permessi aggiunti sono elencati in staging.modello_ruoli_permessi_aggiunti;
-- si ritirano con
--   UPDATE sys.sys_auth_role_permissions SET revoked_at = now(),
--          revoked_by_migration = '000485-rollback'
--    WHERE (auth_role_id, auth_permission_id) IN (SELECT auth_role_id, auth_permission_id
--                                                  FROM staging.modello_ruoli_permessi_aggiunti);
-- ============================================================================

BEGIN;

-- §4 (prima di tutto: §1 vi registra cio' che aggiunge) ------------------------------------
CREATE TABLE IF NOT EXISTS staging.modello_ruoli_corse (
  run_id        uuid         PRIMARY KEY,
  modo          varchar(8)   NOT NULL CHECK (modo IN ('PROVA','APPLICA')),
  esito         varchar(10)  NOT NULL CHECK (esito IN ('APPLICATA','PROVATA','ANNULLATA')),
  concedente_id uuid         NOT NULL,
  concessioni   integer      NOT NULL DEFAULT 0,
  revoche       integer      NOT NULL DEFAULT 0,
  eseguita_il   timestamptz  NOT NULL DEFAULT clock_timestamp(),
  annullata_il  timestamptz
);

CREATE TABLE IF NOT EXISTS staging.modello_ruoli_undo (
  undo_id            bigserial    PRIMARY KEY,
  run_id             uuid         NOT NULL,
  azione             varchar(8)   NOT NULL CHECK (azione IN ('CONCEDE','REVOCA')),
  user_auth_role_id  uuid         NOT NULL,
  user_id            uuid         NOT NULL,
  ruolo              text         NOT NULL,
  tenant_id          uuid,
  motivo             text         NOT NULL,
  eseguito_il        timestamptz  NOT NULL DEFAULT clock_timestamp(),
  annullato_il       timestamptz
);
CREATE INDEX IF NOT EXISTS modello_ruoli_undo_run_idx ON staging.modello_ruoli_undo (run_id);

CREATE TABLE IF NOT EXISTS staging.modello_ruoli_permessi_aggiunti (
  auth_role_id        uuid  NOT NULL,
  auth_permission_id  uuid  NOT NULL,
  da_ruolo            text  NOT NULL,
  aggiunto_il         timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (auth_role_id, auth_permission_id)
);

-- §1 «chi contiene sostituisce» ---------------------------------------------------------------
WITH inclusioni(dst, src) AS (
  VALUES ('BRANCH_MANAGER', 'TEAM_LEADER'),
         ('CEO',            'TEAM_LEADER'),
         ('CEO',            'BRANCH_MANAGER'),
         ('TENANT_ADMIN',   'HRMS_MANAGER')
), mancanti AS (
  SELECT DISTINCT d.auth_role_id, rp.auth_permission_id, i.src
    FROM inclusioni i
    JOIN sys.sys_auth_roles d ON d.auth_role_code = i.dst
    JOIN sys.sys_auth_roles s ON s.auth_role_code = i.src
    JOIN sys.sys_auth_role_permissions rp
      ON rp.auth_role_id = s.auth_role_id AND rp.revoked_at IS NULL
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_role_permissions x
                      WHERE x.auth_role_id = d.auth_role_id
                        AND x.auth_permission_id = rp.auth_permission_id)
), aggiunti AS (
  INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
  SELECT DISTINCT auth_role_id, auth_permission_id FROM mancanti
  ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING
  RETURNING auth_role_id, auth_permission_id
)
INSERT INTO staging.modello_ruoli_permessi_aggiunti (auth_role_id, auth_permission_id, da_ruolo)
SELECT a.auth_role_id, a.auth_permission_id, min(m.src)
  FROM aggiunti a JOIN mancanti m USING (auth_role_id, auth_permission_id)
 GROUP BY a.auth_role_id, a.auth_permission_id
ON CONFLICT DO NOTHING;

-- §2 il ruolo di comando che l'organigramma assegna --------------------------------------------
CREATE OR REPLACE VIEW sys.v_ruoli_di_comando_attesi AS
WITH titolari AS (
  SELECT ou.organization_unit_manager_user_id AS user_id,
         ou.organization_unit_tenant_id       AS tenant_id,
         ou.organization_unit_code::varchar   AS unita,  -- varchar senza lunghezza: tipo stabile per CREATE OR REPLACE
         CASE
           WHEN ou.organization_unit_type IN ('HEADQUARTERS','GENERAL_MANAGEMENT') THEN 'CEO'
           WHEN ou.organization_unit_type = 'BRANCH'                               THEN 'BRANCH_MANAGER'
           WHEN EXISTS (SELECT 1 FROM sys.sys_organization_units c
                         WHERE c.organization_unit_parent_id = ou.organization_unit_id
                           AND c.organization_unit_is_active)                       THEN 'MANAGER'
           ELSE 'TEAM_LEADER'
         END AS ruolo,
         'titolare dell''unita ' || ou.organization_unit_code AS fonte
    -- Guidare una squadra (sys_teams) senza reggere un'unita' non da' TEAM_LEADER: decisione di
    -- Enzo del 2026-10-31 (revoca a marco.rinaldi, «non guida un'unita»), confermata dalla prova
    -- del 2026-11-10 che altrimenti lo avrebbe ridato a lui e a martina.gentile.
    FROM sys.sys_organization_units ou
    JOIN sys.sys_users u ON u.user_id = ou.organization_unit_manager_user_id
   WHERE ou.organization_unit_is_active
     AND u.user_status = 'ACTIVE'
     AND u.user_email NOT ILIKE '%@collaudo.invalid'
), graduati AS (
  SELECT *, CASE ruolo WHEN 'CEO' THEN 1 WHEN 'MANAGER' THEN 2
                       WHEN 'BRANCH_MANAGER' THEN 3 ELSE 4 END AS grado
    FROM titolari
)
SELECT DISTINCT ON (user_id) user_id, tenant_id, ruolo, unita, fonte
  FROM graduati
 ORDER BY user_id, grado, unita;

COMMENT ON VIEW sys.v_ruoli_di_comando_attesi IS
  'ADR-0057 R2 (mig 000485): il ruolo di comando che l''organigramma assegna a ogni persona: titolare di sede o Direzione Generale = CEO, di filiale = BRANCH_MANAGER, di un''unita con figlie = MANAGER, di un''unita foglia = TEAM_LEADER. Vince il grado piu alto. Utenze di collaudo escluse.';

-- §3 cio' che il modello non prevede ----------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_ruoli_fuori_modello AS
WITH comando(codice) AS (VALUES ('CEO'),('MANAGER'),('BRANCH_MANAGER'),('TEAM_LEADER'))
SELECT 'COMANDO_IN_PIU'::text AS difetto, g.user_auth_role_user_id AS user_id,
       r.auth_role_code AS ruolo, g.user_auth_role_tenant_id AS tenant_id
  FROM sys.sys_user_auth_roles g
  JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
  JOIN sys.sys_users u ON u.user_id = g.user_auth_role_user_id
 WHERE g.user_auth_role_revoked_at IS NULL
   AND r.auth_role_code IN (SELECT codice FROM comando)
   AND u.user_email NOT ILIKE '%@collaudo.invalid'
   AND NOT EXISTS (SELECT 1 FROM sys.v_ruoli_di_comando_attesi a
                    WHERE a.user_id = g.user_auth_role_user_id AND a.ruolo = r.auth_role_code)
UNION ALL
SELECT 'COMANDO_MANCANTE', a.user_id, a.ruolo, a.tenant_id
  FROM sys.v_ruoli_di_comando_attesi a
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles g
                     JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
                    WHERE g.user_auth_role_user_id = a.user_id AND r.auth_role_code = a.ruolo
                      AND g.user_auth_role_revoked_at IS NULL)
UNION ALL
SELECT 'TEAM_MEMBER_CONCESSO', g.user_auth_role_user_id, 'TEAM_MEMBER', g.user_auth_role_tenant_id
  FROM sys.sys_user_auth_roles g
  JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
 WHERE g.user_auth_role_revoked_at IS NULL AND r.auth_role_code = 'TEAM_MEMBER';

COMMENT ON VIEW sys.v_ruoli_fuori_modello IS
  'ADR-0057 (mig 000485): concessioni di comando che l''organigramma non giustifica, comandi attesi mancanti, TEAM_MEMBER ancora concessi. Si svuota con db/scripts/modello-ruoli.sql. Informativa: non e una guardia della catena.';

-- verifica: le inclusioni di §1 reggono -------------------------------------------------------
DO $$
DECLARE v_mancano int;
BEGIN
  SELECT count(*) INTO v_mancano
    FROM (VALUES ('BRANCH_MANAGER','TEAM_LEADER'),('CEO','TEAM_LEADER'),
                 ('CEO','BRANCH_MANAGER'),('TENANT_ADMIN','HRMS_MANAGER')) i(dst, src)
    JOIN sys.sys_auth_roles d ON d.auth_role_code = i.dst
    JOIN sys.sys_auth_roles s ON s.auth_role_code = i.src
    JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = s.auth_role_id AND rp.revoked_at IS NULL
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_role_permissions x
                      WHERE x.auth_role_id = d.auth_role_id
                        AND x.auth_permission_id = rp.auth_permission_id
                        AND x.revoked_at IS NULL);
  IF v_mancano > 0 THEN
    -- un permesso ritirato apposta sul ruolo che contiene: non lo si ridà, ma si dice
    RAISE NOTICE '000485: % permessi del ruolo contenuto restano ritirati sul ruolo che contiene', v_mancano;
  END IF;
  RAISE NOTICE '000485: modello dei ruoli in catena (viste e registro); le concessioni le allinea db/scripts/modello-ruoli.sql';
END $$;

COMMIT;
