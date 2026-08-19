-- ============================================================================
-- 000334 — La sentinella non suona sul dominio che costruisce il registro. (#132 F4h)
--
-- COSA E' SUCCESSO, ed e' successo alla PRIMA CORSA VERA (2026-08-19). La ricerca ha letto
-- otto pagine di `bancaditalia.it` e ne ha ricavato una proposta corretta, passata da tutti i
-- controlli. La sentinella `v_research_evidence_source_not_approved` e' diventata **rossa su
-- due righe** — e aveva ragione alla lettera: quelle fonti non sono nel registro. Ma il
-- registro **non poteva** contenerle: e' il dominio `research_sources` che lo costruisce, e la
-- prima ondata di §4.3 e' esentata dal confronto proprio per questo (il filtro e'
-- l'approvazione umana, una fonte per volta).
--
-- Cioe': un allarme che si accende su un fatto legittimo, al primo uso della funzione che
-- vigila. E' il difetto `#194` — «un allarme che insegna a non guardarlo» — e va corretto
-- subito, perche' una sentinella rossa a riposo smette di essere letta nel giro di due giorni.
--
-- COSA FA: la vista esclude le evidenze del solo dominio `research_sources`. L'esenzione e'
-- **nominata**, non generica: ogni altro dominio resta vigilato, e il giorno in cui `F5`
-- dichiara i cinque domini di contenuto, le loro fonti dovranno essere nel registro.
--
-- ADR-0035 — LA COPPIA. La `000333` (che CREA la vista) e' stata emendata, cosi' un database
-- nuovo nasce gia' corretto; questa migrazione corregge l'esemplare esistente. Le due strade
-- arrivano allo stesso posto, e la post-condizione lo verifica leggendo la definizione invece
-- di fidarsi dell'ordine di applicazione.
--
-- IDEMPOTENTE: `CREATE OR REPLACE VIEW`.
-- ROLLBACK: togliere la riga di esclusione — e riavere l'allarme falso.
-- ============================================================================
BEGIN;

-- ── ① la misura PRIMA ─────────────────────────────────────────────────────────
DO $$
DECLARE n_rosse int; n_research int;
BEGIN
  SELECT count(*) INTO n_rosse FROM sys.v_research_evidence_source_not_approved;
  SELECT count(*) INTO n_research
    FROM sys.v_research_evidence_source_not_approved WHERE dominio = 'research_sources';
  RAISE NOTICE '000334: righe rosse prima: % (di cui del dominio research_sources: %)', n_rosse, n_research;
END $$;

-- ── ② la vista corretta ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW sys.v_research_evidence_source_not_approved AS
SELECT e.seed_source_evidence_id,
       e.seed_source_evidence_url,
       sys.research_url_host(e.seed_source_evidence_url) AS host,
       c.seed_candidate_record_domain                    AS dominio,
       c.seed_candidate_record_id                        AS proposta
  FROM sys.sys_seed_source_evidence e
  JOIN sys.sys_seed_candidate_records c
    ON c.seed_candidate_record_id = e.seed_source_evidence_candidate_id
 WHERE e.seed_source_evidence_url ~* '^https?://'
   -- ⚠ IL DOMINIO CHE COSTRUISCE IL REGISTRO NON E' SOGGETTO AL REGISTRO. `research_sources`
   -- e' la prima ondata di §4.3: le sue fonti non si confrontano con un elenco che nasce
   -- proprio da quella corsa, e il filtro e' l'approvazione umana, una fonte per volta.
   -- Senza questa riga la sentinella si accende su un fatto LEGITTIMO al primo uso — e' il
   -- difetto `#194`, l'allarme che insegna a non guardare gli allarmi. Misurato il
   -- 2026-08-19 sulla prima corsa vera: 2 righe rosse su due evidenze corrette.
   -- L'esenzione e' NOMINATA, non generica: ogni altro dominio resta vigilato.
   AND c.seed_candidate_record_domain <> 'research_sources'
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_research_sources s
      WHERE s.research_source_status <> 'REJECTED'
        AND (sys.research_url_host(e.seed_source_evidence_url) = s.research_source_host_suffix
          OR right(sys.research_url_host(e.seed_source_evidence_url),
                   length(s.research_source_host_suffix) + 1) = '.' || s.research_source_host_suffix)
   );

COMMENT ON VIEW sys.v_research_evidence_source_not_approved IS
  'SENTINELLA (#132 F4a, corretta in F4h) — deve restare a zero righe. Un''evidenza `http(s)` la '
  'cui fonte non e'' nel registro, o vi e'' REJECTED, e'' una proposta costruita su una fonte che '
  'la politica non ammette. Confronto per suffisso di host, senza caratteri jolly. Il dominio '
  '`research_sources` e'' escluso per costruzione: e'' quello che il registro lo costruisce.';

-- ── ③ le post-condizioni ──────────────────────────────────────────────────────
DO $$
DECLARE n int; v_def text;
BEGIN
  -- 1. CIO' CHE DOVEVA CAMBIARE: la sentinella e' a zero.
  SELECT count(*) INTO n FROM sys.v_research_evidence_source_not_approved;
  IF n <> 0 THEN
    RAISE EXCEPTION '000334: la sentinella e'' ancora rossa su % righe', n;
  END IF;

  -- 2. CIO' CHE NON DOVEVA CAMBIARE: l'esenzione riguarda UN dominio, non tutti. Si legge
  --    la definizione della vista, non il file: e'' l'unico modo di sapere cosa gira davvero.
  SELECT pg_get_viewdef('sys.v_research_evidence_source_not_approved'::regclass, true) INTO v_def;
  IF v_def NOT LIKE '%research_sources%' THEN
    RAISE EXCEPTION '000334: la vista non nomina l''esenzione: o non e'' stata sostituita, o l''esenzione e'' diventata generica';
  END IF;
  IF v_def NOT LIKE '%sys_research_sources%' THEN
    RAISE EXCEPTION '000334: la vista non consulta piu'' il registro delle fonti: non vigila piu'' niente';
  END IF;

  -- 3. LA PROVA CHE DEVE POTER FALLIRE: un'evidenza di un ALTRO dominio, su una fonte
  --    sconosciuta, deve ancora accendere la sentinella. Si scrive, si guarda, si toglie.
  DECLARE v_corsa uuid; v_cand uuid; v_tenant uuid; v_acceso int;
  BEGIN
    SELECT tenant_id INTO v_tenant FROM sys.sys_tenancies LIMIT 1;
    IF v_tenant IS NULL THEN
      RAISE NOTICE '000334: nessun tenant su questo database — esenzione installata, NON verificata';
    ELSE
      INSERT INTO sys.sys_seed_acquisition_runs (seed_acquisition_run_tenant_id, seed_acquisition_run_code)
      VALUES (v_tenant, '__PROVA_000334__') RETURNING seed_acquisition_run_id INTO v_corsa;
      INSERT INTO sys.sys_seed_candidate_records
        (seed_candidate_record_run_id, seed_candidate_record_tenant_id,
         seed_candidate_record_domain, seed_candidate_record_natural_key)
      VALUES (v_corsa, v_tenant, 'un_altro_dominio', 'PROVA') RETURNING seed_candidate_record_id INTO v_cand;
      INSERT INTO sys.sys_seed_source_evidence (seed_source_evidence_candidate_id, seed_source_evidence_url)
      VALUES (v_cand, 'https://blog.mai-registrato.example/x');

      SELECT count(*) INTO v_acceso FROM sys.v_research_evidence_source_not_approved;
      DELETE FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_id = v_corsa;

      IF v_acceso <> 1 THEN
        RAISE EXCEPTION '000334: la sentinella NON si accende su un altro dominio con fonte sconosciuta (% righe): l''esenzione e'' diventata generica', v_acceso;
      END IF;
      RAISE NOTICE '000334: verificata sul vivo — si accende su un altro dominio, tace su research_sources';
    END IF;
  END;

  SELECT count(*) INTO n FROM sys.v_research_evidence_source_not_approved;
  IF n <> 0 THEN
    RAISE EXCEPTION '000334: la prova ha lasciato % righe: qualcosa non e'' stato tolto', n;
  END IF;
  RAISE NOTICE '000334 ok — sentinella a zero, esenzione nominata e verificata';
END $$;

COMMIT;
