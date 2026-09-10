-- 000398 — Il profilo della banca e' DICHIARATO, non dedotto (B21+B22, ADR-0039).
--
-- PERCHE' ESISTE. La 000397 ha costruito la casa del profilo; questo file la abita.
-- ADR-0039 regola 4: «un elenco chiesto da un utente del cliente restituisce le voci del suo
-- profilo piu' le sue voci proprie, mai il catalogo intero». Finche' il profilo e' vuoto,
-- quella regola non ha nulla su cui appoggiarsi.
--
-- COSA CONTIENE IL PROFILO DELLA BANCA, e come lo si e' deciso. Misurato in produzione il
-- 2026-09-10, prima di scrivere:
--   · il catalogo ha 176 ruoli professionali;
--   · 34 di essi portano gia' una nota scritta da B11 (S1095) dentro il `motivo` della loro
--     mappatura ESCO: «altro settore: resta nel catalogo, non nel profilo della banca».
--     Sono i mestieri alimentari ed energetici, le direzioni QSE e R&D — pasticcere,
--     ingegnere geotermico, addetto alla tostatura delle fave di cacao;
--   · NESSUNO di quei 34 e' usato da una posizione: zero, verificato. Toglierli dal profilo
--     non toglie niente a nessuno;
--   · le posizioni di RTL usano 65 ruoli distinti su 312 posizioni, e tutti e 65 restano
--     dentro. Verificato prima di scrivere e riverificato in post-condizione.
-- Il profilo e' quindi 176 - 34 = 142 ruoli.
--
-- ⚠ LA NOTA SERVE UNA VOLTA SOLA, E POI NON PIU'. ADR-0039 e' esplicito nello scartare il
-- filtro per settore: «il profilo e' una scelta dichiarata; il settore e' un'inferenza, e le
-- inferenze in questo prodotto hanno gia' fatto danni misurabili». Quella nota si usa QUI,
-- per popolare il profilo una volta; da questo momento il profilo e' un DATO, e nessuna
-- lettura tornera' mai a interrogare il testo di un motivo per sapere cosa mostrare.
--
-- IL CATALOGO NON SI SVUOTA MAI — e' la condizione che Enzo ha posto per iscritto. I 34
-- restano dove sono: nessuna riga di `sys.sys_job_roles` viene toccata da questo file, e la
-- post-condizione lo verifica invece di affermarlo.
--
-- LE DASHBOARD. Tutte e otto entrano nel profilo: sono le viste di prodotto, e nessuna e'
-- specifica di un settore. Il valore della tabella non e' escludere qualcosa oggi — e'
-- esistere, perche' il giorno in cui un cliente vorra' la propria dashboard il posto dove
-- dirlo c'e' gia'. Fino ad allora il profilo dichiara «tutte», che e' un'affermazione, non
-- un silenzio.
--
-- IDEMPOTENTE: `ON CONFLICT (versione, codice) DO NOTHING`. Nessuna cancellazione.
-- PER TORNARE INDIETRO: togliere questo file — la catena si ri-applica per intero (ADR-0035).
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- La versione di modello attiva per la banca. Si RISOLVE, non si scrive a mano: un uuid
-- cablato in un file e' vero il giorno in cui lo scrivi e falso al primo ricostruito.
CREATE TEMP TABLE versione_banca ON COMMIT DROP AS
SELECT vv.blueprint_variant_version_id AS id
  FROM sys.sys_blueprint_activations a
  JOIN sys.sys_tenancies t ON t.tenant_id = a.blueprint_activation_tenant_id
  JOIN sys.sys_blueprint_variants v ON v.blueprint_variant_id = a.blueprint_activation_variant_id
  JOIN sys.sys_blueprint_variant_versions vv
    ON vv.blueprint_variant_version_variant_id = v.blueprint_variant_id
 WHERE t.tenant_code = 'RTL_BANK'
   AND a.blueprint_activation_status = 'ACTIVE'
   AND vv.blueprint_variant_version_status = 'PUBLISHED';

-- I ruoli che B11 ha marcato come di un altro settore. Elenco esplicito, mai un jolly.
CREATE TEMP TABLE fuori_settore ON COMMIT DROP AS
SELECT DISTINCT esco_occupation_mapping_job_role_id AS id
  FROM sys.sys_esco_occupation_mappings
 WHERE esco_occupation_mapping_metadata->>'motivo' LIKE '%non nel profilo della banca%';

-- ── LA GUARDIA, ri-verificata AL MOMENTO DELL'ESECUZIONE, mai ereditata dalla misura ─────
DO $guardia$
DECLARE
  n_versione bigint; n_fuori bigint; n_ruoli bigint; n_usati_fuori bigint;
BEGIN
  SELECT count(*) INTO n_versione FROM versione_banca;
  IF n_versione <> 1 THEN
    RAISE EXCEPTION '000398 guardia: la banca ha % versioni di modello attive e pubblicate, '
      'ne era attesa 1 — il profilo non si popola al buio', n_versione;
  END IF;

  SELECT count(*) INTO n_ruoli FROM sys.sys_job_roles WHERE job_role_tenant_id IS NULL;
  SELECT count(*) INTO n_fuori FROM fuori_settore;

  -- Su un database dove B11 non e' passata (il clone della CI) la nota non c'e': zero e' un
  -- esito legittimo, e allora il profilo e' il catalogo intero. Un numero DIVERSO da 0 e da
  -- quello misurato vuol dire che qualcuno ha cambiato le note sotto, e allora ci si ferma.
  IF n_fuori NOT IN (0, 34) THEN
    RAISE EXCEPTION '000398 guardia: i ruoli marcati fuori settore sono %, attesi 0 o 34 — '
      'la nota di B11 e'' cambiata e il profilo va rideciso, non dedotto', n_fuori;
  END IF;

  -- La condizione che protegge il cliente: nessun ruolo che una sua posizione USA puo'
  -- finire fuori dal suo profilo. Se accadesse, una posizione esistente riferirebbe un ruolo
  -- che il suo stesso cliente non vede.
  SELECT count(DISTINCT p.position_job_role_id) INTO n_usati_fuori
    FROM sys.sys_positions p
    JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id
   WHERE t.tenant_code = 'RTL_BANK'
     AND p.position_job_role_id IN (SELECT id FROM fuori_settore);
  IF n_usati_fuori <> 0 THEN
    RAISE EXCEPTION '000398 guardia: % ruoli usati da posizioni di RTL finirebbero fuori dal '
      'profilo del loro stesso cliente', n_usati_fuori;
  END IF;

  RAISE NOTICE '000398 guardia superata: 1 versione attiva, % ruoli in catalogo, % fuori '
    'settore, 0 usati che restino fuori.', n_ruoli, n_fuori;
END
$guardia$;

-- ── ① i ruoli del profilo ────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_blueprint_content_job_roles
  (blueprint_content_job_role_version_id, blueprint_content_job_role_code,
   blueprint_content_job_role_name, blueprint_content_job_role_name_en,
   blueprint_content_job_role_seniority, blueprint_content_job_role_metadata)
SELECT (SELECT id FROM versione_banca),
       jr.job_role_code,
       jr.job_role_name,
       (SELECT t.text FROM sys.sys_reference_translations t
         WHERE t.entity_table = 'sys_job_roles' AND t.entity_id = jr.job_role_id
           AND t.field = 'name' AND t.locale = 'en'),
       jr.job_role_seniority_level,
       jsonb_build_object('origine', 'S1096 B22 — catalogo di piattaforma, profilo bancario')
  FROM sys.sys_job_roles jr
 WHERE jr.job_role_tenant_id IS NULL
   AND jr.job_role_id NOT IN (SELECT id FROM fuori_settore)
ON CONFLICT (blueprint_content_job_role_version_id, blueprint_content_job_role_code) DO NOTHING;

-- ── ② le dashboard del profilo ───────────────────────────────────────────────────────────
INSERT INTO sys.sys_blueprint_content_dashboards
  (blueprint_content_dashboard_version_id, blueprint_content_dashboard_code,
   blueprint_content_dashboard_name, blueprint_content_dashboard_order,
   blueprint_content_dashboard_metadata)
SELECT (SELECT id FROM versione_banca), d.dashboard_code, d.dashboard_name, d.dashboard_order,
       jsonb_build_object('origine', 'S1096 B22 — tutte le viste di prodotto, nessuna e'' di settore')
  FROM sys.sys_dashboards d
ON CONFLICT (blueprint_content_dashboard_version_id, blueprint_content_dashboard_code) DO NOTHING;

COMMIT;

-- ============================================================================================
-- LE POST-CONDIZIONI — anche su cio' che NON doveva cambiare (metodo di bonifica ④c)
-- ============================================================================================
DO $post$
DECLARE
  n_profilo bigint; n_catalogo bigint; n_dash bigint; n_scoperti bigint; n_fuori_dentro bigint;
BEGIN
  SELECT count(*) INTO n_catalogo FROM sys.sys_job_roles;
  IF n_catalogo < 176 THEN
    RAISE EXCEPTION '000398: il catalogo e'' sceso a % ruoli — non si svuota MAI (ADR-0039, '
      'condizione posta da Enzo per iscritto)', n_catalogo;
  END IF;

  SELECT count(*) INTO n_profilo FROM sys.sys_blueprint_content_job_roles r
   JOIN sys.sys_blueprint_activations a ON true
   JOIN sys.sys_tenancies t ON t.tenant_id = a.blueprint_activation_tenant_id
                           AND t.tenant_code = 'RTL_BANK'
   JOIN sys.sys_blueprint_variant_versions vv
     ON vv.blueprint_variant_version_id = r.blueprint_content_job_role_version_id
    AND vv.blueprint_variant_version_variant_id = a.blueprint_activation_variant_id;
  IF n_profilo = 0 THEN
    RAISE EXCEPTION '000398: il profilo della banca e'' rimasto vuoto';
  END IF;

  -- Nessuna posizione della banca deve riferire un ruolo che il profilo non contiene.
  -- E' la stessa domanda della guardia, ma posta DOPO: una guardia dice cosa sarebbe
  -- successo, una post-condizione cosa e' successo davvero.
  SELECT count(DISTINCT p.position_job_role_id) INTO n_scoperti
    FROM sys.sys_positions p
    JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id AND t.tenant_code = 'RTL_BANK'
    JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_blueprint_content_job_roles r
      WHERE r.blueprint_content_job_role_code = jr.job_role_code);
  IF n_scoperti <> 0 THEN
    RAISE EXCEPTION '000398: % ruoli usati da posizioni di RTL non sono nel suo profilo', n_scoperti;
  END IF;

  -- E i 34 di un altro settore NON devono essere entrati: e' il senso stesso di B21.
  SELECT count(*) INTO n_fuori_dentro
    FROM sys.sys_blueprint_content_job_roles r
    JOIN sys.sys_job_roles jr ON jr.job_role_code = r.blueprint_content_job_role_code
   WHERE jr.job_role_id IN (
     SELECT DISTINCT esco_occupation_mapping_job_role_id FROM sys.sys_esco_occupation_mappings
      WHERE esco_occupation_mapping_metadata->>'motivo' LIKE '%non nel profilo della banca%');
  IF n_fuori_dentro <> 0 THEN
    RAISE EXCEPTION '000398: % ruoli di un altro settore sono finiti nel profilo della banca',
      n_fuori_dentro;
  END IF;

  SELECT count(*) INTO n_dash FROM sys.sys_blueprint_content_dashboards;
  RAISE NOTICE '000398 ok — profilo della banca: % ruoli su % di catalogo, % dashboard, '
    '0 posizioni scoperte, 0 ruoli di altro settore dentro.', n_profilo, n_catalogo, n_dash;
END
$post$;
