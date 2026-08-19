-- ============================================================================
-- 000336 — Le famiglie e le varianti non sono un catalogo: sono un sottoprodotto. (#132 F6)
--
-- LA RIQUALIFICA, nelle parole dell'epica P2a §4.8: *«`sys_blueprint_families` e
-- `sys_blueprint_variants` **non sono un catalogo costruito in anticipo**: sono un
-- **sottoprodotto dei clienti**. Il modello bancario esiste perche' esiste RTL, non
-- viceversa.»* E' esattamente cio' che dice **E10** — la capacita' di ricerca e' della
-- piattaforma, i modelli nascono dai fascicoli — e va scritto **dove qualcuno lo leggera'**.
--
-- PERCHE' UNA MIGRAZIONE SOLO DI COMMENTI NON E' UN VEZZO. Chi apre il database non ha il
-- repository davanti. Due tabelle chiamate «famiglie» e «varianti», vuote o quasi, invitano a
-- riempirle «per completezza»: si mette dentro un catalogo di settori plausibili, e da quel
-- momento la piattaforma ha modelli che nessun cliente ha mai chiesto — cioe' esattamente il
-- difetto che **E29** ha fatto togliere dal codice (l'archetipo aprioristico) rientrato dalla
-- porta dei dati. Il commento e' il posto in cui quel «non riempire» si vede.
--
-- MISURATO PRIMA (2026-08-19): **1** famiglia (`FIN_BANKING`), **1** variante, **1** versione —
-- e nascono tutte dall'unico cliente che esiste. La riqualifica descrive cio' che c'e' gia'.
--
-- IDEMPOTENTE: `COMMENT ON` si riscrive. ROLLBACK: rimettere il commento precedente, che era
-- assente. Nessun dato toccato: questa migrazione non ha un giornale di annullamento perche'
-- non cambia nemmeno una riga.
-- ============================================================================
BEGIN;

COMMENT ON TABLE sys.sys_blueprint_families IS
  'Le famiglie di modello per settore. ⚠ NON E'' UN CATALOGO COSTRUITO IN ANTICIPO: e'' un '
  'SOTTOPRODOTTO DEI CLIENTI (epica Tenant Builder P2a §4.8, decisione E10). Una famiglia nasce '
  'perche'' un fascicolo di quel settore e'' arrivato, e la ricerca (#132) ne ha generato il '
  'contenuto — non viceversa. Riempirla «per completezza» con settori plausibili rimetterebbe '
  'dentro dalla porta dei dati l''archetipo aprioristico che E29 ha fatto togliere dal codice.';

COMMENT ON TABLE sys.sys_blueprint_variants IS
  'Le varianti di una famiglia (per fascia dimensionale, modello operativo, paese). ⚠ Come la '
  'famiglia, e'' un SOTTOPRODOTTO DEI CLIENTI e non un catalogo anticipato: una variante esiste '
  'perche'' un cliente con quella forma esiste. Il contenuto vero di una variante vive nella sua '
  'VERSIONE (`sys_blueprint_variant_versions` + `sys_blueprint_content_*` + il registro dei '
  'processi), cosi'' che possa essere fotografato e riapplicato.';

COMMENT ON TABLE sys.sys_research_sources IS
  'Le fonti che la ricerca (#132) puo'' leggere. Il confronto e'' per SUFFISSO DI HOST, mai per '
  'sottostringa. Una riga e'' utilizzabile solo se `APPROVED`, e l''approvazione porta sempre '
  'approvatore, data e motivazione (vincolo, non disciplina). L''elenco non si scrive a mano: '
  'nasce da una corsa di ricerca sul dominio `research_sources`, lo approva un umano una fonte '
  'per volta, e il ponte (#132 F6) scrive qui la riga con la motivazione di QUELLA decisione.';

-- ── le post-condizioni ───────────────────────────────────────────────────────
DO $$
DECLARE v_fam text; v_var text; v_fonti text; n_fam int; n_var int;
BEGIN
  SELECT obj_description('sys.sys_blueprint_families'::regclass) INTO v_fam;
  SELECT obj_description('sys.sys_blueprint_variants'::regclass) INTO v_var;
  SELECT obj_description('sys.sys_research_sources'::regclass) INTO v_fonti;

  -- 1. CIO' CHE DOVEVA CAMBIARE: i tre commenti ci sono e dicono la cosa che devono dire.
  --    Si verifica il CONTENUTO, non la presenza: un commento vuoto passerebbe un controllo
  --    di sola esistenza, e non spiegherebbe niente a nessuno.
  IF v_fam IS NULL OR v_fam NOT LIKE '%SOTTOPRODOTTO DEI CLIENTI%' THEN
    RAISE EXCEPTION '000336: il commento della tabella delle famiglie non dichiara la riqualifica';
  END IF;
  IF v_var IS NULL OR v_var NOT LIKE '%SOTTOPRODOTTO DEI CLIENTI%' THEN
    RAISE EXCEPTION '000336: il commento della tabella delle varianti non dichiara la riqualifica';
  END IF;
  IF v_fonti IS NULL OR v_fonti NOT LIKE '%SUFFISSO DI HOST%' THEN
    RAISE EXCEPTION '000336: il commento del registro delle fonti non nomina il criterio di confronto';
  END IF;

  -- 2. CIO' CHE NON DOVEVA CAMBIARE: nessuna riga. Questa migrazione parla, non tocca.
  SELECT count(*) INTO n_fam FROM sys.sys_blueprint_families;
  SELECT count(*) INTO n_var FROM sys.sys_blueprint_variants;
  RAISE NOTICE '000336 ok — famiglie % · varianti %: descritte, non toccate', n_fam, n_var;
END $$;

COMMIT;
