-- 000403 — Un cruscotto di sola piattaforma non entra nel profilo di un cliente (B31).
--
-- IL FATTO, misurato in produzione il 2026-09-10 e riverificato prima di scrivere. Il catalogo
-- `sys.sys_dashboards` tiene otto cruscotti, ognuno con il proprio permesso. Interrogando
-- `sys_auth_role_permissions` su chi li possiede:
--
--   platform  → dashboard_platform:view  → SOLO PLATFORM_ADMIN        → nel profilo della banca: SI', ED E' SBAGLIATO
--   tenant    → dashboard_tenant:view    → PLATFORM_ADMIN e TENANT_ADMIN → SI', ED E' GIUSTO
--   self      → (nessun permesso)        → chiunque (pavimento I17)   → SI', ed e' giusto
--   gli altri → il proprio               → ruoli di cliente           → SI', ed e' giusto
--
-- ⚠ LA RIGA FUORI POSTO E' UNA, NON DUE. Il referto della corsa precedente
-- (`docs/kb/xtras/C3_REFERTO_perimetro_dashboard_20260910.md`) ne indicava due, `platform` e
-- `tenant`. La misura di oggi corregge quel referto: `tenant` e' il cruscotto con cui un
-- cliente amministra SE' STESSO — `TENANT_ADMIN` lo possiede — e appartiene legittimamente al
-- suo profilo. Solo `platform` e' amministrazione della piattaforma.
--
-- LA REGOLA SI CALCOLA DAI DATI, NON DA UN ELENCO. Un elenco scritto a mano e' vero il giorno
-- che lo scrivi e falso poco dopo: il giorno in cui qualcuno concedesse `dashboard_platform:view`
-- a un ruolo di cliente, o togliesse `dashboard_tenant:view` a `TENANT_ADMIN`, un elenco
-- resterebbe fermo mentre il fatto cambia. La regola:
--
--   ⭐ un cruscotto il cui permesso e' concesso E lo e' SOLTANTO a PLATFORM_ADMIN
--     non puo' comparire in sys_blueprint_content_dashboards.
--
-- ⚠⚠ IL CASO LIMITE CHE ROMPE LA REGOLA SCRITTA MALE: `self` NON HA NESSUN PERMESSO. Una
-- formulazione ingenua — «nessun ruolo diverso da PLATFORM_ADMIN lo possiede» — su `self` e'
-- VERA per vacuita' (nessun ruolo lo possiede affatto), e lo butterebbe fuori dal profilo di
-- ogni cliente. Ma `self` e' il pavimento ESS che I17 garantisce a chiunque: e' l'esatto
-- opposto di un cruscotto di piattaforma. Per questo la regola pretende PRIMA che il permesso
-- esista e sia concesso a qualcuno, e solo POI che quel qualcuno sia il solo PLATFORM_ADMIN.
-- La prova a esiti opposti in coda lo dimostra su tutti e tre i casi.
--
-- ⚠ UN SECONDO CASO LIMITE, DICHIARATO: un cruscotto con un permesso esistente ma concesso a
-- NESSUN ruolo non viola la regola. E' voluto — un permesso che nessuno possiede non rende
-- quel cruscotto «di piattaforma», lo rende invisibile a tutti, che e' un altro problema e
-- un'altra guardia.
--
-- ⚠ LA RIMOZIONE DELLA RIGA E' UNA CANCELLAZIONE DI DATO, e in questo progetto non si cancella
-- senza conferma esplicita. Enzo l'ha autorizzata per QUESTA RIGA SOLA (mandato del quarto
-- blocco, 2026-09-10). L'elenco e' esplicito e nominato, mai un carattere jolly: si tolgono le
-- righe di `sys_blueprint_content_dashboards` il cui codice viola la regola calcolata sopra —
-- oggi una, `platform` sul profilo della banca — e la post-condizione verifica che tutte le
-- altre siano ancora li'.
--
-- (d) ROLLBACK DICHIARATO: `staging.cruscotti_fuori_profilo_undo` conserva, PRIMA della
-- rimozione, la riga intera. Per rimetterla:
--   INSERT INTO sys.sys_blueprint_content_dashboards (...) SELECT ... FROM staging.cruscotti_fuori_profilo_undo;
-- Non eseguito qui.
--
-- IDEMPOTENTE: alla seconda esecuzione non trova piu' violazioni e non tocca nulla.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ⚠ LA FUNZIONE NON NASCE QUI, e la ragione e' ADR-0035. La prima stesura la creava in questo
-- file e filtrava solo A VALLE, cancellando la riga: la prova generale ha mostrato che alla
-- SECONDA passata il giornale di ripristino passava da 1 riga a 2 — perche' la `000398`
-- rimetteva `platform` nel profilo della banca e questo file lo ritoglieva, a ogni deploy, per
-- sempre. E' esattamente il difetto che ADR-0035 nomina: «una DELETE a valle viene disfatta al
-- giro dopo; si emenda il file che CREA l'oggetto».
-- Quindi la funzione e' definita nella `000398`, che e' il file che crea il contenuto dei
-- cruscotti, e la usa per non inserire mai una riga che violi la regola. Qui resta cio' che a
-- quel file non compete: la sentinella che rende la regola interrogabile, la rimozione della
-- riga GIA' PRESENTE, e le prove.

-- La sentinella che rende la regola interrogabile invece che sepolta in una migrazione.
CREATE OR REPLACE VIEW sys.v_cruscotti_di_piattaforma_nei_profili AS
  SELECT c.blueprint_content_dashboard_id AS contenuto_id,
         c.blueprint_content_dashboard_version_id AS versione_id,
         c.blueprint_content_dashboard_code AS cruscotto
    FROM sys.sys_blueprint_content_dashboards c
   WHERE sys.fn_cruscotto_e_di_sola_piattaforma(c.blueprint_content_dashboard_code);

COMMENT ON VIEW sys.v_cruscotti_di_piattaforma_nei_profili IS
  'SENTINELLA (B31, 2026-09-10). Cruscotti di sola amministrazione di piattaforma finiti nel '
  'profilo di un cliente. Zero righe attese. Non e'' una questione di accesso — il permesso '
  'RBAC li chiude comunque — ma di verita'' del dato: dire che l''amministrazione della '
  'piattaforma fa parte di cio'' che un cliente usa e'' un''affermazione falsa.';

-- ── IL GIORNALE, popolato PRIMA della rimozione ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging.cruscotti_fuori_profilo_undo (
  blueprint_content_dashboard_id       uuid PRIMARY KEY,
  blueprint_content_dashboard_version_id uuid NOT NULL,
  blueprint_content_dashboard_code     varchar(48) NOT NULL,
  blueprint_content_dashboard_name     varchar(128) NOT NULL,
  blueprint_content_dashboard_name_en  varchar(128),
  blueprint_content_dashboard_order    integer NOT NULL,
  blueprint_content_dashboard_metadata jsonb NOT NULL,
  tolto_il                             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE staging.cruscotti_fuori_profilo_undo IS
  'B31 (S1096) — giornale di ripristino dei cruscotti di sola piattaforma tolti dal profilo di '
  'un cliente. Conserva la riga intera: per rimetterla basta un INSERT ... SELECT da qui.';

-- ── LA GUARDIA, ri-verificata AL MOMENTO dell'esecuzione ────────────────────────────────
DO $guardia$
DECLARE n_viol bigint; n_tot bigint; v_codici text;
BEGIN
  SELECT count(*), coalesce(string_agg(DISTINCT cruscotto, ', '), '')
    INTO n_viol, v_codici FROM sys.v_cruscotti_di_piattaforma_nei_profili;
  SELECT count(*) INTO n_tot FROM sys.sys_blueprint_content_dashboards;

  IF n_viol = 0 THEN
    RAISE NOTICE 'B31: nessun cruscotto di sola piattaforma nei profili. Niente da togliere.';
    RETURN;
  END IF;

  -- L'autorizzazione di Enzo copre la riga `platform`. Se la regola trovasse altro, ci si
  -- ferma: una riga di troppo si toglie domani, un dato tolto per errore no.
  IF EXISTS (SELECT 1 FROM sys.v_cruscotti_di_piattaforma_nei_profili WHERE cruscotto <> 'platform') THEN
    RAISE EXCEPTION 'B31 guardia: la regola trova anche cruscotti diversi da «platform» (%). '
      'L''autorizzazione a cancellare copre quella riga sola: mi fermo invece di togliere un '
      'dato che nessuno ha autorizzato', v_codici;
  END IF;

  RAISE NOTICE 'B31: % riga/e da togliere (%), su % contenuti di cruscotto in tutto',
    n_viol, v_codici, n_tot;
END
$guardia$;

INSERT INTO staging.cruscotti_fuori_profilo_undo
  (blueprint_content_dashboard_id, blueprint_content_dashboard_version_id,
   blueprint_content_dashboard_code, blueprint_content_dashboard_name,
   blueprint_content_dashboard_name_en, blueprint_content_dashboard_order,
   blueprint_content_dashboard_metadata)
SELECT c.blueprint_content_dashboard_id, c.blueprint_content_dashboard_version_id,
       c.blueprint_content_dashboard_code, c.blueprint_content_dashboard_name,
       c.blueprint_content_dashboard_name_en, c.blueprint_content_dashboard_order,
       c.blueprint_content_dashboard_metadata
  FROM sys.sys_blueprint_content_dashboards c
 WHERE c.blueprint_content_dashboard_code = 'platform'
   AND sys.fn_cruscotto_e_di_sola_piattaforma(c.blueprint_content_dashboard_code)
ON CONFLICT (blueprint_content_dashboard_id) DO NOTHING;

-- L'unica cancellazione autorizzata di questo mandato, e nominata per codice.
DELETE FROM sys.sys_blueprint_content_dashboards c
 WHERE c.blueprint_content_dashboard_code = 'platform'
   AND sys.fn_cruscotto_e_di_sola_piattaforma(c.blueprint_content_dashboard_code);

COMMIT;

-- ============================================================================================
-- LE POST-CONDIZIONI — anche su cio' che NON doveva cambiare
-- ============================================================================================
DO $post$
DECLARE n_viol bigint; n_tenant bigint; n_self bigint; n_altri bigint; n_giornale bigint;
BEGIN
  SELECT count(*) INTO n_viol FROM sys.v_cruscotti_di_piattaforma_nei_profili;
  IF n_viol <> 0 THEN
    RAISE EXCEPTION '000403: restano % cruscotti di sola piattaforma nei profili', n_viol;
  END IF;

  -- CIO' CHE NON DOVEVA CAMBIARE, e che una regola sbagliata avrebbe portato via:
  SELECT count(*) INTO n_tenant FROM sys.sys_blueprint_content_dashboards
   WHERE blueprint_content_dashboard_code = 'tenant';
  SELECT count(*) INTO n_self FROM sys.sys_blueprint_content_dashboards
   WHERE blueprint_content_dashboard_code = 'self';
  SELECT count(*) INTO n_altri FROM sys.sys_blueprint_content_dashboards
   WHERE blueprint_content_dashboard_code NOT IN ('platform', 'tenant', 'self');

  IF n_tenant = 0 THEN
    RAISE EXCEPTION '000403: il cruscotto «tenant» e'' sparito dai profili — e'' quello con cui '
      'un cliente amministra se'' stesso, e TENANT_ADMIN lo possiede';
  END IF;
  IF n_self = 0 THEN
    RAISE EXCEPTION '000403: il cruscotto «self» e'' sparito dai profili — e'' il pavimento ESS '
      'di I17, e la regola lo ha trattato come «di piattaforma» per vacuita''';
  END IF;

  SELECT count(*) INTO n_giornale FROM staging.cruscotti_fuori_profilo_undo;
  RAISE NOTICE '000403 ok — 0 cruscotti di piattaforma nei profili; tenant %, self %, altri % '
    '(intatti); giornale di ripristino: % riga/e.', n_tenant, n_self, n_altri, n_giornale;
END
$post$;

-- ============================================================================================
-- LA PROVA A ESITI OPPOSTI — la regola deve RIFIUTARE platform e ACCETTARE self e tenant.
-- E' il punto delicato di questa voce: una regola scritta male passa il caso ovvio e sbaglia
-- proprio sul caso limite. Tutto dentro una transazione che finisce in ROLLBACK.
-- ============================================================================================
BEGIN;
DO $prova$
DECLARE v_ver uuid; n_prima bigint; n_dopo bigint;
BEGIN
  -- ① la regola, interrogata sui tre casi che contano
  IF NOT sys.fn_cruscotto_e_di_sola_piattaforma('platform') THEN
    RAISE EXCEPTION 'PROVA 1 FALLITA: «platform» NON e'' riconosciuto di sola piattaforma, '
      'eppure il suo permesso e'' concesso al solo PLATFORM_ADMIN';
  END IF;
  RAISE NOTICE 'PROVA 1 SUPERATA: «platform» e'' riconosciuto di sola piattaforma.';

  IF sys.fn_cruscotto_e_di_sola_piattaforma('self') THEN
    RAISE EXCEPTION 'PROVA 2 FALLITA: «self» e'' stato letto come di sola piattaforma — e'' il '
      'caso limite: non ha NESSUN permesso, e una regola scritta male lo butta fuori per vacuita''';
  END IF;
  RAISE NOTICE 'PROVA 2 SUPERATA: «self», che non ha permessi, NON e'' di sola piattaforma.';

  IF sys.fn_cruscotto_e_di_sola_piattaforma('tenant') THEN
    RAISE EXCEPTION 'PROVA 3 FALLITA: «tenant» e'' stato letto come di sola piattaforma, ma '
      'TENANT_ADMIN lo possiede: e'' il cruscotto con cui un cliente amministra se'' stesso';
  END IF;
  RAISE NOTICE 'PROVA 3 SUPERATA: «tenant» resta del cliente.';

  -- ② la sentinella sa accendersi: si rimette «platform» in un profilo e deve vederlo
  SELECT count(*) INTO n_prima FROM sys.v_cruscotti_di_piattaforma_nei_profili;
  SELECT blueprint_content_dashboard_version_id INTO v_ver
    FROM sys.sys_blueprint_content_dashboards LIMIT 1;
  IF v_ver IS NULL THEN
    RAISE NOTICE 'PROVA 4: nessun profilo con cruscotti su questo database — NON MISURATA, e '
      'dichiarata invece che data per buona.';
    RETURN;
  END IF;

  INSERT INTO sys.sys_blueprint_content_dashboards
    (blueprint_content_dashboard_version_id, blueprint_content_dashboard_code,
     blueprint_content_dashboard_name)
  VALUES (v_ver, 'platform', '__PROVA_000403__')
  ON CONFLICT (blueprint_content_dashboard_version_id, blueprint_content_dashboard_code) DO NOTHING;

  SELECT count(*) INTO n_dopo FROM sys.v_cruscotti_di_piattaforma_nei_profili;
  IF n_dopo <= n_prima THEN
    RAISE EXCEPTION 'PROVA 4 NON SA FALLIRE: rimesso «platform» in un profilo, la sentinella '
      'vede ancora % righe (prima %)', n_dopo, n_prima;
  END IF;
  RAISE NOTICE 'PROVA 4 SUPERATA: la sentinella e'' passata da % a % — sa accendersi.',
    n_prima, n_dopo;
END
$prova$;
ROLLBACK;   -- OBBLIGATORIO: la riga di prova non resta
