-- 000397 — Il profilo di un cliente dice quali ruoli e quali dashboard sono suoi (B22, ADR-0039).
--
-- PERCHE' ESISTE. ADR-0039 (ACCEPTED, Enzo 2026-09-09) decide che «un catalogo e' di tutti e
-- non porta mai il cliente; un profilo dice quali voci del catalogo un cliente usa; le voci che
-- un cliente si crea vivono accanto a quelle di catalogo, nella stessa tabella, distinte dalla
-- colonna del cliente».
--
-- Oggi manca il pezzo di mezzo. Misurato in produzione il 2026-09-10, prima di scrivere:
--   · `sys.sys_job_roles` porta 176 ruoli e NON ha la colonna del cliente — il repository lo
--     dichiara in testa: «no tenant_id — platform-level». `/v1/job-roles` non filtra: un
--     responsabile HR della banca vede anche i ruoli dei settori che non sono il suo.
--   · di quei 176, le posizioni di RTL_BANK ne usano 65 distinti su 312 posizioni; quelle di
--     HEURESYS ne usano ZERO.
--   · le quattro tabelle `sys_blueprint_content_*` esistono e ORA sono piene (33 unita',
--     71 posizioni, 132 competenze, 73 KPI — fase 3 del bundle, S1095). Erano vuote fino a
--     ieri, ed e' la ragione per cui questa voce non era eseguibile prima.
--   · manca il contenuto per i RUOLI PROFESSIONALI e per le DASHBOARD: nessuna tabella dice
--     quali di essi appartengono al profilo di un modello di settore.
--
-- COSA FA QUESTO FILE, e nient'altro:
--   ① `sys_blueprint_content_job_roles`  — quali ruoli del catalogo fanno parte di un profilo
--   ② `sys_blueprint_content_dashboards` — quali dashboard del catalogo fanno parte di un profilo
--   ③ `sys_job_roles.job_role_tenant_id` NULLABLE — la casa delle voci proprie del cliente
--
-- LA FORMA E' GIA' SCELTA DAL PROGETTO, non inventata qui: e' quella della 000327
-- («il primo costa la forma, gli altri quattro la riusano»). Ogni riga appartiene a UNA
-- VERSIONE di variante; la chiave naturale e' `(versione, codice)`; i legami si esprimono per
-- CODICE e non per uuid, perche' un profilo nomina «responsabile di filiale», non un
-- identificativo che chi lo scrive non conosce. La risoluzione a uuid la fa chi legge.
--
-- ⚠ PERCHE' `sys_job_roles_code_uq` VIENE SOSTITUITO, e non e' una cancellazione di dati.
-- L'unicita' globale su `job_role_code` impedirebbe a due clienti di darsi una voce propria
-- con lo stesso codice — cioe' romperebbe la regola 3 dell'ADR il giorno stesso in cui la si
-- applica. Il rimpiazzo e' l'indice per-cliente che `sys.sys_skills` usa GIA' da sempre:
-- `UNIQUE (COALESCE(tenant_id, uuid-zero), code)`. Per le 176 righe di catalogo, che hanno
-- tutte il cliente a NULL, il vincolo e' ESATTAMENTE quello di prima: nessun codice di
-- catalogo puo' duplicarsi. La post-condizione lo verifica invece di affermarlo.
--
-- I3/I4: tabelle `sys.sys_<plural>`. I5: il contenuto di un modello e' di PIATTAFORMA e non
-- porta `tenant_id` (regola 1 dell'ADR: i cataloghi non acquisiscono mai la colonna del
-- cliente — su `sys_job_roles` la colonna esiste per le VOCI PROPRIE, e resta NULL su tutto
-- cio' che e' catalogo). RD-08: categorici `varchar + CHECK`, mai ENUM. RD-09: `timestamptz`.
--
-- IDEMPOTENTE. Nessuna riga viene toccata: solo CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT
-- EXISTS e la sostituzione di un indice.
-- PER TORNARE INDIETRO: togliere questo file e ricreare `sys_job_roles_code_uq` — la catena si
-- ri-applica per intero a ogni deploy (ADR-0035).
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── ① i ruoli professionali che un profilo porta con se' ─────────────────────────────────
-- Il codice riferisce `sys.sys_job_roles.job_role_code`. NON e' una FK: un profilo puo'
-- nominare un ruolo che il catalogo non ha ancora — e' il caso di un modello di settore
-- preparato prima del catalogo che lo serve. Chi costruisce risolve, e dichiara cosa non ha
-- trovato; e' lo stesso patto che le posizioni hanno con le unita' (`unit_code`).
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_job_roles (
  blueprint_content_job_role_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_job_role_version_id uuid         NOT NULL
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_job_role_code       varchar(128) NOT NULL,
  blueprint_content_job_role_name       varchar(255) NOT NULL,
  blueprint_content_job_role_name_en    varchar(255),
  blueprint_content_job_role_seniority  varchar(32),
  blueprint_content_job_role_metadata   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_job_roles_uq
    UNIQUE (blueprint_content_job_role_version_id, blueprint_content_job_role_code),
  -- Lo stesso vocabolario di `sys_job_roles.job_role_seniority_level`: due elenchi che
  -- divergono sono due verita' da tenere allineate a mano.
  CONSTRAINT sys_blueprint_content_job_roles_seniority_ck
    CHECK (blueprint_content_job_role_seniority IS NULL
           OR blueprint_content_job_role_seniority IN ('ENTRY','JUNIOR','MID','SENIOR','LEAD','EXECUTIVE'))
);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_job_roles_versione_idx
  ON sys.sys_blueprint_content_job_roles (blueprint_content_job_role_version_id);

COMMENT ON TABLE sys.sys_blueprint_content_job_roles IS
  'ADR-0039 regola 2 — quali ruoli professionali del catalogo di piattaforma fanno parte del '
  'profilo di un modello di settore. Il catalogo resta sys.sys_job_roles e non si svuota mai.';

-- ── ② le dashboard che un profilo porta con se' ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_dashboards (
  blueprint_content_dashboard_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_dashboard_version_id uuid        NOT NULL
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_dashboard_code       varchar(48) NOT NULL,
  blueprint_content_dashboard_name       varchar(128) NOT NULL,
  blueprint_content_dashboard_name_en    varchar(128),
  blueprint_content_dashboard_order      integer     NOT NULL DEFAULT 0,
  blueprint_content_dashboard_metadata   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_dashboards_uq
    UNIQUE (blueprint_content_dashboard_version_id, blueprint_content_dashboard_code),
  CONSTRAINT sys_blueprint_content_dashboards_ordine_ck
    CHECK (blueprint_content_dashboard_order >= 0)
);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_dashboards_versione_idx
  ON sys.sys_blueprint_content_dashboards (blueprint_content_dashboard_version_id);

COMMENT ON TABLE sys.sys_blueprint_content_dashboards IS
  'ADR-0039 regola 2 — quali dashboard del catalogo di piattaforma fanno parte del profilo di '
  'un modello di settore. Il catalogo resta sys.sys_dashboards.';

-- ── ③ la casa delle voci proprie del cliente, sul modello di sys_skills ──────────────────
ALTER TABLE sys.sys_job_roles
  ADD COLUMN IF NOT EXISTS job_role_tenant_id uuid;

DO $add_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'sys_job_roles_tenant_fk' AND conrelid = 'sys.sys_job_roles'::regclass
  ) THEN
    ALTER TABLE sys.sys_job_roles
      ADD CONSTRAINT sys_job_roles_tenant_fk
      FOREIGN KEY (job_role_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
END
$add_fk$;

CREATE INDEX IF NOT EXISTS sys_job_roles_tenant_idx
  ON sys.sys_job_roles (job_role_tenant_id) WHERE job_role_tenant_id IS NOT NULL;

COMMENT ON COLUMN sys.sys_job_roles.job_role_tenant_id IS
  'ADR-0039 regola 3 — NULL = riga di CATALOGO, di tutti; valorizzata = voce PROPRIA di quel '
  'cliente. Stesso schema di sys.sys_skills.skill_tenant_id, che lo pratica dal principio.';

-- L''unicita' del codice diventa per-cliente, come su sys_skills. Per le righe di catalogo
-- (cliente NULL) il vincolo resta identico a quello di prima.
CREATE UNIQUE INDEX IF NOT EXISTS sys_job_roles_tenant_code_uq
  ON sys.sys_job_roles (COALESCE(job_role_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        job_role_code);

-- ⚠ `sys_job_roles_code_uq` e' un INDICE, non un vincolo di tabella — misurato sul database
-- della CI il 2026-09-10, dove `DROP CONSTRAINT IF EXISTS` lo ha saltato IN SILENZIO
-- («il vincolo non esiste, saltato») e la prova a esiti opposti e' andata rossa un istante
-- dopo. Servono entrambe le forme, in quest'ordine: un indice nato da un vincolo si toglie
-- solo togliendo il vincolo, e un indice nato da CREATE INDEX solo con DROP INDEX.
ALTER TABLE sys.sys_job_roles DROP CONSTRAINT IF EXISTS sys_job_roles_code_uq;
DROP INDEX IF EXISTS sys.sys_job_roles_code_uq;

-- ── ④ le due tabelle nuove si dichiarano al registro di riconciliazione ──────────────────
-- La `000062` pretende «0 UNCLASSIFIED» e alla SECONDA passata trovava le mie due — non
-- alla prima, perche' alla prima non esistevano ancora quando quel controllo e' stato
-- valutato. E' esattamente il caso per cui `ci-rehearsal.sh` applica la catena due volte, e
-- l'ha intercettato prima del push invece che in CI venticinque minuti dopo.
-- La registrazione sta QUI, nella stessa transazione che le crea, come fa gia' la `000327`
-- per le quattro tabelle di contenuto sorelle: il file che crea l'oggetto e' il file che lo
-- dichiara (ADR-0035).
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_blueprint_content_job_roles', 'D', 'EXCLUDE', NULL,
   '[S1096, ADR-0039] Contenuto di modello: quali ruoli professionali del catalogo fanno parte del profilo di una versione di variante. Nasce da una decisione di configurazione, non da un''importazione — e I12 vieta comunque di rimettere in circolo righe del brownfield. Non e'' un bersaglio di riconciliazione; il catalogo vero e'' sys_job_roles, che ha la propria classificazione.'),
  ('sys_blueprint_content_dashboards', 'D', 'EXCLUDE', NULL,
   '[S1096, ADR-0039] Contenuto di modello: quali dashboard del catalogo fanno parte del profilo di una versione di variante. Il legacy heuresys-evo non ha alcuna nozione di profilo di dashboard per cliente: nessuna sorgente, nessun bersaglio di riconciliazione.')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

COMMIT;

-- ============================================================================================
-- LE POST-CONDIZIONI — proteggono anche cio' che NON doveva cambiare (metodo di bonifica ④c)
-- ============================================================================================
DO $post$
DECLARE
  n_ruoli        bigint;
  n_non_catalogo bigint;
  n_indice       bigint;
BEGIN
  SELECT count(*) INTO n_ruoli FROM sys.sys_job_roles;
  SELECT count(*) INTO n_non_catalogo FROM sys.sys_job_roles WHERE job_role_tenant_id IS NOT NULL;

  IF n_non_catalogo <> 0 THEN
    RAISE EXCEPTION '000397: % righe di sys_job_roles hanno un cliente: la migrazione non '
      'doveva toccarne nessuna', n_non_catalogo;
  END IF;

  IF n_ruoli = 0 THEN
    RAISE EXCEPTION '000397: sys_job_roles e'' vuota — il catalogo non si svuota mai (ADR-0039)';
  END IF;

  SELECT count(*) INTO n_indice FROM pg_indexes
   WHERE schemaname = 'sys' AND tablename = 'sys_job_roles'
     AND indexname = 'sys_job_roles_tenant_code_uq';
  IF n_indice <> 1 THEN
    RAISE EXCEPTION '000397: manca l''indice di unicita'' per-cliente sui codici dei ruoli';
  END IF;

  -- L''unicita'' GLOBALE deve essere sparita davvero: se resta, due clienti non possono
  -- darsi la stessa voce propria e la regola 3 dell''ADR e' lettera morta. La prova
  -- generale del 2026-09-10 lo ha scoperto proprio qui, perche' il DROP era della forma
  -- sbagliata e non aveva sollevato nulla.
  SELECT count(*) INTO n_indice FROM pg_indexes
   WHERE schemaname = 'sys' AND tablename = 'sys_job_roles'
     AND indexname = 'sys_job_roles_code_uq';
  IF n_indice <> 0 THEN
    RAISE EXCEPTION '000397: l''unicita'' GLOBALE sui codici dei ruoli e'' ancora in piedi '
      '(sys_job_roles_code_uq): due clienti non potrebbero avere la stessa voce propria';
  END IF;

  -- Le due tabelle nuove sono classificate: se non lo fossero, la `000062` cadrebbe alla
  -- passata successiva — cioe' in produzione, non qui.
  SELECT count(*) INTO n_indice FROM information_schema.tables t
   WHERE t.table_schema = 'sys'
     AND t.table_name IN ('sys_blueprint_content_job_roles', 'sys_blueprint_content_dashboards')
     AND NOT EXISTS (SELECT 1 FROM sys.sys_reconciliation_registry r
                      WHERE r.reconciliation_registry_table_name = t.table_name);
  IF n_indice <> 0 THEN
    RAISE EXCEPTION '000397: % tabelle nuove non sono nel registro di riconciliazione', n_indice;
  END IF;

  RAISE NOTICE '000397 post-condizioni: % ruoli in catalogo, 0 con cliente, unicita'' '
    'per-cliente in piedi, 2 tabelle nuove classificate.', n_ruoli;
END
$post$;

-- ============================================================================================
-- LA PROVA A ESITI OPPOSTI — deve poter FALLIRE, altrimenti non e' una prova.
-- Tutto dentro una transazione che finisce in ROLLBACK: nel database non resta niente
-- (C4 — una prova che scrive gira su una copia usa-e-getta; qui la copia e' la transazione).
-- ============================================================================================
BEGIN;
DO $prova$
DECLARE
  v_versione   uuid;
  v_tenant_a   uuid;
  v_tenant_b   uuid;
  v_codice     text := '__PROVA_000397_RUOLO__';
  fallito      boolean := false;
  n            bigint;
BEGIN
  SELECT blueprint_variant_version_id INTO v_versione
    FROM sys.sys_blueprint_variant_versions LIMIT 1;
  SELECT tenant_id INTO v_tenant_a FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK';
  SELECT tenant_id INTO v_tenant_b FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS';

  IF v_versione IS NULL OR v_tenant_a IS NULL OR v_tenant_b IS NULL THEN
    RAISE EXCEPTION '000397 prova: precondizioni assenti (versione=% a=% b=%)',
      v_versione, v_tenant_a, v_tenant_b;
  END IF;

  -- ① DEVE PASSARE: due clienti diversi si danno una voce propria con lo STESSO codice.
  --    E'' cio'' che l''unicita'' globale di prima impediva.
  INSERT INTO sys.sys_job_roles (job_role_code, job_role_name, job_role_tenant_id)
  VALUES (v_codice, 'Ruolo di prova A', v_tenant_a);
  INSERT INTO sys.sys_job_roles (job_role_code, job_role_name, job_role_tenant_id)
  VALUES (v_codice, 'Ruolo di prova B', v_tenant_b);
  RAISE NOTICE 'PROVA 1 SUPERATA: due clienti hanno la stessa voce propria senza collidere.';

  -- ② DEVE FALLIRE: lo stesso cliente non puo'' avere due volte lo stesso codice.
  BEGIN
    INSERT INTO sys.sys_job_roles (job_role_code, job_role_name, job_role_tenant_id)
    VALUES (v_codice, 'Ruolo di prova A bis', v_tenant_a);
    RAISE EXCEPTION 'PROVA 2 NON SA FALLIRE: un doppione dentro lo stesso cliente e'' passato';
  EXCEPTION WHEN unique_violation THEN
    fallito := true;
  END;
  IF NOT fallito THEN
    RAISE EXCEPTION 'PROVA 2: l''indice non ha sollevato unique_violation';
  END IF;
  RAISE NOTICE 'PROVA 2 SUPERATA: doppione dentro lo stesso cliente rifiutato.';

  -- ③ DEVE FALLIRE: il CATALOGO resta unico per codice, esattamente come prima.
  fallito := false;
  BEGIN
    INSERT INTO sys.sys_job_roles (job_role_code, job_role_name, job_role_tenant_id)
    SELECT job_role_code, 'Doppione di catalogo', NULL FROM sys.sys_job_roles
     WHERE job_role_tenant_id IS NULL LIMIT 1;
    RAISE EXCEPTION 'PROVA 3 NON SA FALLIRE: un doppione DI CATALOGO e'' passato';
  EXCEPTION WHEN unique_violation THEN
    fallito := true;
  END;
  IF NOT fallito THEN
    RAISE EXCEPTION 'PROVA 3: il catalogo ha perso l''unicita'' del codice';
  END IF;
  RAISE NOTICE 'PROVA 3 SUPERATA: il catalogo resta unico per codice.';

  -- ④ DEVE FALLIRE: due volte lo stesso ruolo dentro la stessa versione di profilo.
  INSERT INTO sys.sys_blueprint_content_job_roles
    (blueprint_content_job_role_version_id, blueprint_content_job_role_code,
     blueprint_content_job_role_name)
  VALUES (v_versione, v_codice, 'Nel profilo, una volta');
  fallito := false;
  BEGIN
    INSERT INTO sys.sys_blueprint_content_job_roles
      (blueprint_content_job_role_version_id, blueprint_content_job_role_code,
       blueprint_content_job_role_name)
    VALUES (v_versione, v_codice, 'Nel profilo, due volte');
    RAISE EXCEPTION 'PROVA 4 NON SA FALLIRE: lo stesso ruolo due volte nello stesso profilo';
  EXCEPTION WHEN unique_violation THEN
    fallito := true;
  END;
  IF NOT fallito THEN
    RAISE EXCEPTION 'PROVA 4: la chiave naturale (versione, codice) non regge';
  END IF;
  RAISE NOTICE 'PROVA 4 SUPERATA: un ruolo sta in un profilo una volta sola.';

  -- ⑤ DEVE FALLIRE: una dashboard di profilo senza una versione che esista.
  fallito := false;
  BEGIN
    INSERT INTO sys.sys_blueprint_content_dashboards
      (blueprint_content_dashboard_version_id, blueprint_content_dashboard_code,
       blueprint_content_dashboard_name)
    VALUES ('00000000-0000-0000-0000-0000000000ff'::uuid, 'PROVA', 'Senza versione');
    RAISE EXCEPTION 'PROVA 5 NON SA FALLIRE: contenuto agganciato a una versione inesistente';
  EXCEPTION WHEN foreign_key_violation THEN
    fallito := true;
  END;
  IF NOT fallito THEN
    RAISE EXCEPTION 'PROVA 5: il contenuto puo'' esistere senza il suo modello';
  END IF;
  RAISE NOTICE 'PROVA 5 SUPERATA: nessun contenuto senza il suo modello.';

  -- Le prove hanno scritto: si controlla di riconoscere cio' che va disfatto.
  SELECT count(*) INTO n FROM sys.sys_job_roles WHERE job_role_code = v_codice;
  IF n <> 2 THEN
    RAISE EXCEPTION '000397 prova: attese 2 righe di prova, trovate %', n;
  END IF;
END
$prova$;
ROLLBACK;   -- OBBLIGATORIO: nessuna riga di prova resta nel database
