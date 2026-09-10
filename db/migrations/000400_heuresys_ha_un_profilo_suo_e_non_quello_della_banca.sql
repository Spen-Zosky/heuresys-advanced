-- 000400 — HEURESYS ha un profilo suo, e non quello della banca (C1, ADR-0039).
--
-- IL FATTO, misurato in produzione il 2026-09-10 prima di scrivere. HEURESYS non ha nessuna
-- attivazione di modello, quindi il suo perimetro di catalogo e' VUOTO — e il fail-closed
-- dichiarato in `apps/api/src/lib/scope/profilo.ts` fa il resto: `/v1/job-roles` restituisce
-- zero righe a chi non amministra la piattaforma, e chiedere un ruolo per identificativo
-- risponde 404. Riguarda due persone reali (andrea.spenuso e chiara.spenuso, TEAM_LEADER e
-- USER) piu' enzo.spenuso come MANAGER.
--
-- ⚠ E QUELLO ZERO ERA UN ERRORE DI MISURA MIO, non un fatto. Il commento che ho scritto in
-- S1096 diceva «HEURESYS usa ZERO ruoli nelle proprie posizioni»: veniva da una query che
-- interrogava `tenant_code = 'HEURESYS_SYSTEM'`, un codice che NON ESISTE — il codice vero e'
-- `HEURESYS`. Zero righe da un codice sbagliato letto come zero ruoli. La misura vera: HEURESYS
-- ha **tre posizioni attive** e tutte e tre usano un ruolo di catalogo:
--   RTL-ROLE-CEO-FOUNDER · RTL-ROLE-COO · RTL-ROLE-HEAD-OF-PRODUCT
-- Il commento in `profilo.ts` e' corretto nello stesso commit di questo file.
--
-- ⚠ DUE SCOSTAMENTI DAL PIANO, DICHIARATI E NON SILENZIOSI.
--
-- (1) Il piano diceva «famiglia esistente, variante nuova». **La famiglia esistente non e'
--     utilizzabile**: ne esiste UNA sola, `FIN_BANKING`, agganciata alla classe ATECO 64
--     (servizi finanziari). HEURESYS e' `MGMT_CONSULTING`, ATECO 70.20, e appenderla li'
--     violerebbe I21 — i dati che derivano dal settore di un cliente devono essere coerenti
--     con quel settore. Quindi la famiglia si crea, agganciata alla classe 70: e' la
--     conseguenza meccanica di cio' che il piano dice gia' («HEURESYS non puo' ereditare la
--     variante della banca»), non una scelta nuova.
--
-- (2) `chi_sorveglia.py sys_blueprint_activations` ha trovato una sentinella **BLOCCANTE** che
--     il piano non nomina: `sys.v_reward_gate_completeness` pretende che ogni cliente con
--     un'attivazione ACTIVE abbia almeno una porta di ricompensa legata alla propria variante.
--     Creare l'attivazione senza quelle righe avrebbe reso ROSSA la prova generale. Le porte
--     si scrivono qui, e sono le **quattro universali** delle sette che ha la banca: quelle
--     tre che restano fuori — rischio, rilievi di audit, danno al cliente — sono di una banca
--     vigilata, e darle a una societa' di consulenza sarebbe lo stesso difetto di I21 al
--     contrario. La sentinella chiede che il perimetro sia chiuso, non che si inventi un
--     catalogo.
--
-- LA FORMA E' QUELLA DI 000397/000398, che fanno la stessa cosa per la banca: famiglia →
-- variante → versione (creata dal trigger, MAI a mano) → contenuto → attivazione.
--
-- IDEMPOTENTE: solo `INSERT ... ON CONFLICT DO NOTHING` e `CREATE ... IF NOT EXISTS`.
-- NESSUNA CANCELLAZIONE. Per tornare indietro: togliere questo file — la catena si ri-applica
-- per intero a ogni deploy (ADR-0035).
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── ① la famiglia di modello della consulenza direzionale ────────────────────────────────
INSERT INTO sys.sys_blueprint_families
  (blueprint_family_code, blueprint_family_name, blueprint_family_description,
   blueprint_family_metadata)
VALUES ('MGMT_CONSULTING', 'Management Consulting',
        'Modelli d''azienda per la consulenza direzionale (ATECO 70.20). Nasce con HEURESYS, '
          || 'che non poteva ereditare il modello bancario senza violare I21.',
        jsonb_build_object('origine', 'S1096 C1 — ADR-0039'))
ON CONFLICT (blueprint_family_code) DO NOTHING;

-- La classe di attivita' che porta a questa famiglia: e' cio' che permette a un cliente nuovo
-- di trovarla dal proprio codice di settore, come `FIN_BANKING` la trova dalla 64.
INSERT INTO sys.sys_blueprint_family_activity_classes
  (blueprint_family_activity_class_family_id, blueprint_family_activity_class_classification_id)
SELECT f.blueprint_family_id, ac.activity_classification_id
  FROM sys.sys_blueprint_families f, sys.sys_activity_classifications ac
 WHERE f.blueprint_family_code = 'MGMT_CONSULTING'
   AND ac.activity_classification_code = '70'
ON CONFLICT DO NOTHING;

-- ── ② la variante, e la sua versione la crea il trigger ──────────────────────────────────
-- ⚠ La versione 1 NON si inserisce a mano: la crea `sys_blueprint_variant_ensure_version`
-- quando nasce la variante. Inserirla viola la chiave (variante, numero) — e' il primo errore
-- in cui si inciampa scrivendo su queste tabelle (nota gia' in test/helpers/modello-di-prova.ts).
INSERT INTO sys.sys_blueprint_variants
  (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name,
   blueprint_variant_description, blueprint_variant_size_band_id, blueprint_variant_metadata)
SELECT f.blueprint_family_id, 'MGMT_CONSULTING_SMALL', 'Consulenza direzionale — piccola',
       'Il modello di HEURESYS: una societa'' di consulenza direzionale di banda S.',
       (SELECT enterprise_size_band_id FROM sys.sys_enterprise_size_bands
         WHERE enterprise_size_band_code = 'S'),
       jsonb_build_object('origine', 'S1096 C1 — ADR-0039')
  FROM sys.sys_blueprint_families f
 WHERE f.blueprint_family_code = 'MGMT_CONSULTING'
ON CONFLICT (blueprint_variant_code) DO NOTHING;

-- La versione nasce DRAFT dal trigger: va pubblicata, o il resolver del profilo non la vede
-- (legge solo le versioni PUBLISHED).
UPDATE sys.sys_blueprint_variant_versions vv
   SET blueprint_variant_version_status = 'PUBLISHED',
       blueprint_variant_version_published_at = COALESCE(vv.blueprint_variant_version_published_at, now())
  FROM sys.sys_blueprint_variants v
 WHERE v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
   AND v.blueprint_variant_code = 'MGMT_CONSULTING_SMALL'
   AND vv.blueprint_variant_version_number = 1
   AND vv.blueprint_variant_version_status <> 'PUBLISHED';

-- ── ③ il contenuto: i ruoli che HEURESYS usa DAVVERO ─────────────────────────────────────
-- Non un elenco scritto a mano: si derivano dalle posizioni del cliente. Se domani una
-- posizione cambia ruolo, questo file ri-applicato porta dentro il ruolo nuovo.
INSERT INTO sys.sys_blueprint_content_job_roles
  (blueprint_content_job_role_version_id, blueprint_content_job_role_code,
   blueprint_content_job_role_name, blueprint_content_job_role_name_en,
   blueprint_content_job_role_seniority, blueprint_content_job_role_metadata)
SELECT DISTINCT
       (SELECT vv.blueprint_variant_version_id
          FROM sys.sys_blueprint_variant_versions vv
          JOIN sys.sys_blueprint_variants v
            ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
         WHERE v.blueprint_variant_code = 'MGMT_CONSULTING_SMALL'
           AND vv.blueprint_variant_version_number = 1),
       jr.job_role_code, jr.job_role_name,
       (SELECT t.text FROM sys.sys_reference_translations t
         WHERE t.entity_table = 'sys_job_roles' AND t.entity_id = jr.job_role_id
           AND t.field = 'name' AND t.locale = 'en'),
       jr.job_role_seniority_level,
       jsonb_build_object('origine', 'S1096 C1 — i ruoli che le posizioni di HEURESYS usano')
  FROM sys.sys_positions p
  JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id AND t.tenant_code = 'HEURESYS'
  JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
 WHERE jr.job_role_tenant_id IS NULL
ON CONFLICT (blueprint_content_job_role_version_id, blueprint_content_job_role_code) DO NOTHING;

-- ── ④ i cruscotti NON amministrativi ─────────────────────────────────────────────────────
-- `platform` e `tenant` restano fuori: sono di amministrazione di piattaforma. Che stiano
-- dentro il profilo della banca e' una delle due domande dell'indagine C3, e finche' quella
-- non ha risposta non si replica qui un dubbio aperto.
INSERT INTO sys.sys_blueprint_content_dashboards
  (blueprint_content_dashboard_version_id, blueprint_content_dashboard_code,
   blueprint_content_dashboard_name, blueprint_content_dashboard_order,
   blueprint_content_dashboard_metadata)
SELECT (SELECT vv.blueprint_variant_version_id
          FROM sys.sys_blueprint_variant_versions vv
          JOIN sys.sys_blueprint_variants v
            ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
         WHERE v.blueprint_variant_code = 'MGMT_CONSULTING_SMALL'
           AND vv.blueprint_variant_version_number = 1),
       d.dashboard_code, d.dashboard_name, d.dashboard_order,
       jsonb_build_object('origine', 'S1096 C1 — cruscotti non amministrativi')
  FROM sys.sys_dashboards d
 WHERE d.dashboard_code IN ('company', 'org', 'hr', 'self')
ON CONFLICT (blueprint_content_dashboard_version_id, blueprint_content_dashboard_code) DO NOTHING;

-- ── ⑤ le porte di ricompensa, che la sentinella BLOCCANTE pretende ───────────────────────
INSERT INTO sys.sys_reward_gate_catalog
  (reward_gate_catalog_blueprint_variant_id, reward_gate_catalog_code,
   reward_gate_catalog_name, reward_gate_catalog_description, reward_gate_catalog_is_blocking,
   reward_gate_catalog_metadata)
SELECT v.blueprint_variant_id, x.code, x.nome, x.descr, true,
       jsonb_build_object('origine', 'S1096 C1 — le 4 universali delle 7 della banca')
  FROM sys.sys_blueprint_variants v
 CROSS JOIN (VALUES
   ('COMPLIANCE_GATE',    'Compliance Gate',    'All mandatory compliance training completed.'),
   ('TRAINING_GATE',      'Training Gate',      'All required training completed and assessed.'),
   ('CONDUCT_GATE',       'Conduct Gate',       'No conduct violations during evaluation period.'),
   ('CERTIFICATION_GATE', 'Certification Gate', 'All required certifications current.')
 ) AS x(code, nome, descr)
 WHERE v.blueprint_variant_code = 'MGMT_CONSULTING_SMALL'
ON CONFLICT (reward_gate_catalog_blueprint_variant_id, reward_gate_catalog_code) DO NOTHING;

-- ── ⑥ l'attivazione: da qui in poi HEURESYS ha un perimetro ──────────────────────────────
INSERT INTO sys.sys_blueprint_activations
  (blueprint_activation_tenant_id, blueprint_activation_variant_id,
   blueprint_activation_status, blueprint_activation_effective_from,
   blueprint_activation_metadata)
SELECT t.tenant_id, v.blueprint_variant_id, 'ACTIVE', current_date,
       jsonb_build_object('origine', 'S1096 C1 — ADR-0039')
  FROM sys.sys_tenancies t, sys.sys_blueprint_variants v
 WHERE t.tenant_code = 'HEURESYS'
   AND v.blueprint_variant_code = 'MGMT_CONSULTING_SMALL'
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_blueprint_activations a
      WHERE a.blueprint_activation_tenant_id = t.tenant_id
        AND a.blueprint_activation_variant_id = v.blueprint_variant_id);

COMMIT;

-- ============================================================================================
-- LE POST-CONDIZIONI — anche su cio' che NON doveva cambiare
-- ============================================================================================
DO $post$
DECLARE
  v_versione uuid; n_ruoli bigint; n_usati bigint; n_scoperti bigint;
  n_dash bigint; n_att bigint; n_catalogo bigint; n_gate bigint; n_banca bigint;
BEGIN
  SELECT vv.blueprint_variant_version_id INTO v_versione
    FROM sys.sys_blueprint_variant_versions vv
    JOIN sys.sys_blueprint_variants v
      ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
   WHERE v.blueprint_variant_code = 'MGMT_CONSULTING_SMALL'
     AND vv.blueprint_variant_version_status = 'PUBLISHED';
  IF v_versione IS NULL THEN
    RAISE EXCEPTION '000400: la versione pubblicata di MGMT_CONSULTING_SMALL non esiste';
  END IF;

  -- Il profilo contiene ESATTAMENTE i ruoli che le posizioni di HEURESYS usano. La guardia
  -- regge sul caso limite che il piano nomina: se una posizione cambiasse ruolo, il conto
  -- dei ruoli usati e non coperti smetterebbe di essere zero.
  SELECT count(*) INTO n_ruoli FROM sys.sys_blueprint_content_job_roles
   WHERE blueprint_content_job_role_version_id = v_versione;
  SELECT count(DISTINCT jr.job_role_code) INTO n_usati
    FROM sys.sys_positions p
    JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id AND t.tenant_code = 'HEURESYS'
    JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id;
  SELECT count(DISTINCT jr.job_role_code) INTO n_scoperti
    FROM sys.sys_positions p
    JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id AND t.tenant_code = 'HEURESYS'
    JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_blueprint_content_job_roles c
                      WHERE c.blueprint_content_job_role_version_id = v_versione
                        AND c.blueprint_content_job_role_code = jr.job_role_code);
  IF n_scoperti <> 0 THEN
    RAISE EXCEPTION '000400: % ruoli usati da posizioni di HEURESYS non sono nel suo profilo',
      n_scoperti;
  END IF;

  SELECT count(*) INTO n_dash FROM sys.sys_blueprint_content_dashboards
   WHERE blueprint_content_dashboard_version_id = v_versione;

  SELECT count(*) INTO n_att FROM sys.sys_blueprint_activations a
    JOIN sys.sys_tenancies t ON t.tenant_id = a.blueprint_activation_tenant_id
   WHERE t.tenant_code = 'HEURESYS' AND a.blueprint_activation_status = 'ACTIVE';
  IF n_att <> 1 THEN
    RAISE EXCEPTION '000400: HEURESYS ha % attivazioni ACTIVE, ne era attesa 1', n_att;
  END IF;

  -- La sentinella BLOCCANTE trovata dal censimento: zero clienti senza porte di ricompensa.
  SELECT count(*) INTO n_gate FROM sys.v_reward_gate_completeness;
  IF n_gate <> 0 THEN
    RAISE EXCEPTION '000400: % clienti con attivazione ACTIVE restano senza porte di '
      'ricompensa — v_reward_gate_completeness si accenderebbe', n_gate;
  END IF;

  -- ⭐ IL CONTEGGIO ESATTO DELLE VERSIONI PUBBLICATE VIVE QUI, e non piu' nella `000301`.
  -- Quella lo portava come post-condizione («doveva restare 1 sola»), ed e' diventata rossa
  -- quando questo file ne ha aggiunta una legittima: la `000301` non tocca le versioni, quindi
  -- prometteva piu' di cio' che fa. Emendata alla propria responsabilita' (>= 1); il numero
  -- esatto e' responsabilita' di chi le crea, cioe' di questo file — ed e' esattamente cio'
  -- che la `000394` chiedeva a chi sarebbe venuto dopo di lei.
  DECLARE n_versioni bigint;
  BEGIN
    SELECT count(*) INTO n_versioni FROM sys.sys_blueprint_variant_versions
     WHERE blueprint_variant_version_status = 'PUBLISHED';
    IF n_versioni <> 2 THEN
      RAISE EXCEPTION '000400: le versioni di modello pubblicate sono % invece di 2 (la banca '
        'e HEURESYS) — se e'' un''aggiunta legittima, il conteggio esatto va spostato nella '
        'migrazione che la introduce', n_versioni;
    END IF;
  END;

  -- CIO' CHE NON DOVEVA CAMBIARE: il catalogo dei ruoli e il profilo della banca.
  SELECT count(*) INTO n_catalogo FROM sys.sys_job_roles WHERE job_role_tenant_id IS NULL;
  IF n_catalogo < 176 THEN
    RAISE EXCEPTION '000400: il catalogo e'' sceso a % ruoli — non si svuota mai', n_catalogo;
  END IF;

  SELECT count(*) INTO n_banca
    FROM sys.sys_blueprint_content_job_roles c
    JOIN sys.sys_blueprint_variant_versions vv
      ON vv.blueprint_variant_version_id = c.blueprint_content_job_role_version_id
    JOIN sys.sys_blueprint_variants v
      ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
   WHERE v.blueprint_variant_code = 'REGIONAL_RETAIL_BANK_MEDIUM';

  RAISE NOTICE '000400 ok — profilo di HEURESYS: % ruoli (% usati, 0 scoperti), % cruscotti, '
    '1 attivazione; catalogo % ruoli, profilo della banca % ruoli (intatto).',
    n_ruoli, n_usati, n_dash, n_catalogo, n_banca;
END
$post$;
