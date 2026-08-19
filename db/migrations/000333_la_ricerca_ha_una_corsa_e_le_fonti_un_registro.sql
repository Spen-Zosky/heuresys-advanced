-- ============================================================================
-- 000333 — La ricerca ha una corsa, e le fonti hanno un registro.  (#132 F4a)
--
-- COSA SERVE ALLA RICERCA, e perche' quasi tutto c'era gia'. Le cinque tabelle di
-- acquisizione (`sys_seed_*`, mig. `000020`) sono gia' «corsa → proposta → fonte →
-- regola applicata → decisione motivata»: la fonte porta gia' indirizzo, data di
-- recupero e impronta del contenuto. Quello che manca non e' la contabilita': e' che
-- oggi quelle tabelle sanno vivere solo dentro un tenant, e una ricerca si fa PRIMA
-- della firma — quando il cliente non e' ancora un tenant, ma un fascicolo.
--
-- ⚠ LE TABELLE SONO GIA' IN USO, E NON DALLA RICERCA. Misurato il 2026-08-19: le 12
-- corse presenti sono tutte di `STORIA36` (la storia RTL a 36 mesi), con 12 proposte
-- `APPLIED`, 36 validazioni e 12 decisioni, tutte con lo stesso tenant. Questa
-- migrazione deve **conviverci, non appropriarsene**: ogni allargamento e' additivo, e
-- la post-condizione protegge **quelle righe** — cioe' cio' che NON doveva cambiare —
-- non solo le nuove (metodo di bonifica, punto ④c).
--
-- COSA FA, in quattro pezzi:
--   ② la corsa puo' appartenere a un FASCICOLO invece che a un tenant, e un `CHECK`
--      sulla coppia impedisce il terzo caso: una corsa che non appartiene a niente.
--   ③ la proposta segue la corsa: `tenant_id` nullabile, e un trigger che le tiene
--      allineate — il candidato non puo' dichiarare un tenant diverso dalla sua corsa.
--   ④ `sys.sys_research_sources`: il registro delle fonti ammesse. Non e' un elenco
--      scritto a mano — nasce da una ricerca e lo approva un umano, e una fonte
--      approvata SENZA approvatore e motivazione e' impossibile per vincolo, non per
--      disciplina (epica P2a §4.3, richiesta di Enzo del 2026-08-05).
--   ⑤ la sentinella: un'evidenza che nomina un indirizzo web di una fonte mai
--      registrata, o registrata e respinta, e' una violazione della politica delle
--      fonti — e si vede da sola, senza che nessuno la vada a cercare.
--
-- IL CONFRONTO E' PER SUFFISSO DI HOST, MAI PER SOTTOSTRINGA. `bancaditalia.it` copre
-- `dati.bancaditalia.it` e **non** copre `bancaditalia.it.attaccante.example`. Qui e'
-- scritto senza `LIKE` e senza caratteri jolly — `right(host, len+1) = '.' || suffisso` —
-- perche' un jolly dentro un dato controllato da altri e' il modo in cui questo confine
-- si buca. La stessa regola vale nel codice (`research/sources.ts`), e le due si provano
-- sullo stesso caso limite.
--
-- ADR-0035 — PERCHE' QUI NON C'E' UN EMENDAMENTO DELLA `000020`. Non e' un ritiro: e'
-- un allargamento additivo, e `ALTER ... DROP NOT NULL` e' idempotente. Le due strade
-- (database nuovo che applica la catena intera, database esistente che applica solo
-- questa) arrivano allo **stesso stato**, e la post-condizione ⑥ lo verifica leggendo
-- `information_schema` invece di fidarsi dell'ordine. La colonna che aggancia la
-- versione di fascicolo NON poteva stare nella `000020`: la tabella che referenzia
-- nasce 300 migrazioni dopo (`000320`).
--
-- IDEMPOTENTE: ogni pezzo e' `IF NOT EXISTS` / `DROP ... IF EXISTS` + ricreazione.
-- ROLLBACK: `ALTER TABLE ... SET NOT NULL` sulle due colonne (possibile solo se nessuna
-- corsa di fascicolo esiste), `DROP TABLE sys.sys_research_sources`, `DROP VIEW`,
-- `DROP TRIGGER`, `DROP FUNCTION`. Nessun dato esistente viene modificato da questo
-- file, quindi non serve un giornale di annullamento: non c'e' niente da rimettere
-- com'era.
-- ============================================================================
BEGIN;

-- ── ① la misura PRIMA, e la guardia ri-verificata adesso ─────────────────────
-- Non si eredita la misura di sessione: questa migrazione gira anche sul clone di CI e
-- su un database ricreato da zero, dove i numeri sono diversi.
DO $$
DECLARE n_corse int; n_cand int; n_disallineati int;
BEGIN
  SELECT count(*) INTO n_corse FROM sys.sys_seed_acquisition_runs;
  SELECT count(*) INTO n_cand  FROM sys.sys_seed_candidate_records;
  SELECT count(*) INTO n_disallineati
    FROM sys.sys_seed_candidate_records c
    JOIN sys.sys_seed_acquisition_runs r ON r.seed_acquisition_run_id = c.seed_candidate_record_run_id
   WHERE c.seed_candidate_record_tenant_id IS DISTINCT FROM r.seed_acquisition_run_tenant_id;

  RAISE NOTICE '000333: corse esistenti % · proposte % · proposte con un tenant diverso dalla loro corsa: %',
    n_corse, n_cand, n_disallineati;

  -- Il trigger di ③ pretende che candidato e corsa dichiarino lo stesso tenant. Se il
  -- dato esistente lo violasse gia', installarlo renderebbe non aggiornabili righe
  -- storiche: meglio fermarsi e guardarle una per una che scoprirlo al primo UPDATE.
  IF n_disallineati > 0 THEN
    RAISE EXCEPTION '000333: % proposte dichiarano un tenant diverso da quello della loro corsa. Il trigger di coerenza non si installa su un dato gia'' incoerente.', n_disallineati;
  END IF;
END $$;

-- ── ② la corsa: puo' appartenere a un fascicolo, mai a niente ────────────────
ALTER TABLE sys.sys_seed_acquisition_runs
  ALTER COLUMN seed_acquisition_run_tenant_id DROP NOT NULL;

-- ON DELETE RESTRICT, e non SET NULL: una corsa E' l'evidenza di come quel fascicolo e'
-- stato costruito. Se la versione sparisse portando la corsa a `NULL`, la corsa
-- resterebbe senza tenant e senza fascicolo — cioe' appartenente a niente, che e'
-- esattamente il caso che il `CHECK` qui sotto vieta. Meglio impedire la cancellazione
-- della versione: chi vuole davvero disfarla toglie prima le sue ricerche, di proposito.
ALTER TABLE sys.sys_seed_acquisition_runs
  ADD COLUMN IF NOT EXISTS seed_acquisition_run_blueprint_version_id uuid
  REFERENCES sys.sys_tenant_blueprint_versions(tenant_blueprint_version_id) ON DELETE RESTRICT;

ALTER TABLE sys.sys_seed_acquisition_runs
  DROP CONSTRAINT IF EXISTS sys_seed_acquisition_run_scope_check;
ALTER TABLE sys.sys_seed_acquisition_runs
  ADD CONSTRAINT sys_seed_acquisition_run_scope_check
  CHECK (seed_acquisition_run_tenant_id IS NOT NULL
      OR seed_acquisition_run_blueprint_version_id IS NOT NULL);

-- L'unicita' del codice esisteva solo dentro un tenant. Senza tenant quell'indice non
-- vede niente (in un indice unico i NULL non collidono fra loro), quindi due corse
-- omonime di fascicoli diversi passerebbero. Indice parziale, per il ramo nuovo.
CREATE UNIQUE INDEX IF NOT EXISTS sys_seed_acquisition_runs_version_code_uq
  ON sys.sys_seed_acquisition_runs (seed_acquisition_run_blueprint_version_id, seed_acquisition_run_code)
  WHERE seed_acquisition_run_tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS sys_seed_acquisition_runs_version_idx
  ON sys.sys_seed_acquisition_runs (seed_acquisition_run_blueprint_version_id)
  WHERE seed_acquisition_run_blueprint_version_id IS NOT NULL;

COMMENT ON COLUMN sys.sys_seed_acquisition_runs.seed_acquisition_run_tenant_id IS
  'Il tenant a cui la corsa appartiene. NULLO per una ricerca condotta PRIMA della firma, '
  'quando il cliente e'' ancora un fascicolo e non un tenant: in quel caso vale '
  '`..._blueprint_version_id`. Uno dei due c''e'' sempre (sys_seed_acquisition_run_scope_check).';
COMMENT ON COLUMN sys.sys_seed_acquisition_runs.seed_acquisition_run_blueprint_version_id IS
  'La versione di fascicolo per cui questa ricerca e'' stata condotta (#132 F4). NULLA per le '
  'corse di acquisizione che non nascono da un fascicolo — le 12 di STORIA36 sono cosi'', e '
  'restano valide.';

-- ── ③ la proposta segue la corsa ─────────────────────────────────────────────
ALTER TABLE sys.sys_seed_candidate_records
  ALTER COLUMN seed_candidate_record_tenant_id DROP NOT NULL;

-- Un `CHECK` non puo' leggere un'altra tabella: la coerenza fra proposta e corsa e' un
-- trigger. E' lo stesso pattern gia' in uso su questa famiglia (`sys_blueprint_size_band_coherence`,
-- mig. `000323`). L'errore esce come violazione di vincolo (23514) perche' chi lo cattura
-- — la prova qui sotto, e il servizio — possa distinguerlo da un guasto qualunque.
CREATE OR REPLACE FUNCTION sys.sys_seed_candidate_tenant_matches_run()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE v_tenant_corsa uuid;
BEGIN
  SELECT seed_acquisition_run_tenant_id INTO v_tenant_corsa
    FROM sys.sys_seed_acquisition_runs
   WHERE seed_acquisition_run_id = NEW.seed_candidate_record_run_id;

  IF NEW.seed_candidate_record_tenant_id IS DISTINCT FROM v_tenant_corsa THEN
    RAISE EXCEPTION 'La proposta dichiara il tenant % mentre la sua corsa dichiara %: una proposta appartiene a chi appartiene la corsa.',
      coalesce(NEW.seed_candidate_record_tenant_id::text, 'NESSUNO'),
      coalesce(v_tenant_corsa::text, 'NESSUNO')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS sys_seed_candidate_tenant_coherence ON sys.sys_seed_candidate_records;
CREATE TRIGGER sys_seed_candidate_tenant_coherence
  BEFORE INSERT OR UPDATE OF seed_candidate_record_tenant_id, seed_candidate_record_run_id
  ON sys.sys_seed_candidate_records
  FOR EACH ROW EXECUTE FUNCTION sys.sys_seed_candidate_tenant_matches_run();

COMMENT ON COLUMN sys.sys_seed_candidate_records.seed_candidate_record_tenant_id IS
  'Il tenant della proposta, che e'' sempre quello della sua corsa — presidiato dal trigger '
  '`sys_seed_candidate_tenant_coherence`. NULLO quando la corsa nasce da un fascicolo non '
  'ancora firmato.';

-- ── ④ il registro delle fonti ammesse ────────────────────────────────────────
-- Perche' una tabella e non un elenco in codice, mentre il DOMINIO ricercabile sta in
-- codice (E10): il dominio e' una capacita' della piattaforma, che si rilascia; l'elenco
-- delle fonti deve poter **crescere senza un rilascio**, una riga per volta, ognuna con
-- il suo approvatore. Non e' dato di un cliente — nessun `tenant_id` — e' patrimonio
-- della piattaforma (E11).
CREATE TABLE IF NOT EXISTS sys.sys_research_sources (
  research_source_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  research_source_host_suffix     varchar(253) NOT NULL,
  research_source_label           varchar(256) NOT NULL,
  research_source_class           varchar(32)  NOT NULL,
  research_source_status          varchar(32)  NOT NULL DEFAULT 'PROPOSED',
  research_source_domain          varchar(64),
  research_source_country_code    char(2),
  research_source_rationale       text,
  research_source_approved_by uuid        REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT,
  research_source_approved_at     timestamptz,
  research_source_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz  NOT NULL DEFAULT now(),
  created_by                      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                      timestamptz  NOT NULL DEFAULT now(),
  updated_by                      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

-- Le quattro classi dell'epica §4.3. `USER_GENERATED` esiste per poter REGISTRARE un
-- rifiuto motivato: senza, una fonte respinta non lascerebbe traccia e la stessa
-- verrebbe riproposta al giro dopo.
ALTER TABLE sys.sys_research_sources DROP CONSTRAINT IF EXISTS sys_research_source_class_check;
ALTER TABLE sys.sys_research_sources ADD CONSTRAINT sys_research_source_class_check
  CHECK (research_source_class IN ('INSTITUTIONAL', 'ACCREDITED', 'TOP_CONSULTING', 'USER_GENERATED'));

ALTER TABLE sys.sys_research_sources DROP CONSTRAINT IF EXISTS sys_research_source_status_check;
ALTER TABLE sys.sys_research_sources ADD CONSTRAINT sys_research_source_status_check
  CHECK (research_source_status IN ('PROPOSED', 'APPROVED', 'REJECTED', 'RETIRED'));

-- Il suffisso e' un nome di host normalizzato: minuscolo, almeno due etichette, niente
-- schema, niente porta, niente percorso, niente punto iniziale o finale. Un suffisso
-- scritto come `https://banca.it/` non combacerebbe mai con niente, e il difetto
-- sarebbe invisibile: la ricerca respingerebbe una fonte che qualcuno crede approvata.
ALTER TABLE sys.sys_research_sources DROP CONSTRAINT IF EXISTS sys_research_source_host_suffix_check;
ALTER TABLE sys.sys_research_sources ADD CONSTRAINT sys_research_source_host_suffix_check
  CHECK (research_source_host_suffix ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$');

-- Una fonte APPROVATA senza chi l'ha approvata, quando, e perche' e' impossibile per
-- vincolo. E' la richiesta di Enzo del 2026-08-05, resa meccanica.
ALTER TABLE sys.sys_research_sources DROP CONSTRAINT IF EXISTS sys_research_source_approval_check;
ALTER TABLE sys.sys_research_sources ADD CONSTRAINT sys_research_source_approval_check
  CHECK (
    research_source_status <> 'APPROVED'
    OR (research_source_approved_by IS NOT NULL
        AND research_source_approved_at IS NOT NULL
        AND research_source_rationale IS NOT NULL
        AND length(btrim(research_source_rationale)) > 0)
  );

-- Una fonte vale per tutti i domini (`domain` nullo) oppure per uno solo. Due righe con
-- lo stesso suffisso e lo stesso perimetro sono la stessa fonte.
CREATE UNIQUE INDEX IF NOT EXISTS sys_research_sources_suffix_domain_uq
  ON sys.sys_research_sources (research_source_host_suffix, coalesce(research_source_domain, '*'));

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_research_sources_set_updated_at'
                   AND tgrelid = 'sys.sys_research_sources'::regclass) THEN
    CREATE TRIGGER sys_research_sources_set_updated_at BEFORE UPDATE ON sys.sys_research_sources
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

COMMENT ON TABLE sys.sys_research_sources IS
  'Le fonti che la ricerca (#132) puo'' leggere. Il confronto e'' per SUFFISSO DI HOST, mai per '
  'sottostringa. Una riga e'' utilizzabile solo se `APPROVED`, e l''approvazione porta sempre '
  'approvatore, data e motivazione (vincolo, non disciplina). L''elenco non si scrive a mano: '
  'nasce da una corsa di ricerca sul dominio `research_sources` e lo approva un umano.';
COMMENT ON COLUMN sys.sys_research_sources.research_source_host_suffix IS
  'Nome di host normalizzato (minuscolo, senza schema/porta/percorso). Copre se stesso e i propri '
  'sottodomini: `bancaditalia.it` copre `dati.bancaditalia.it` e NON copre '
  '`bancaditalia.it.attaccante.example`.';
COMMENT ON COLUMN sys.sys_research_sources.research_source_domain IS
  'Il dominio ricercabile per cui questa fonte vale; NULLO = vale per tutti. Il conteggio delle '
  'fonti approvate PER dominio dice quali ondate di ricerca sono possibili e quali no.';

-- Il registro di riconciliazione: ogni tabella `sys.*` deve dichiararsi, o la vista
-- `v_reconciliation_status` la marca UNCLASSIFIED e la `000062` pretende zero.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_research_sources', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — registro delle fonti della ricerca (#132 F4a). Nasce da una corsa di ricerca approvata da un umano, non da un''importazione: non e'' un bersaglio di riconciliazione.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

-- ── ⑤ la sentinella ──────────────────────────────────────────────────────────
-- Estrarre l'host da un indirizzo. `IMMUTABLE` perche' la vista ci si appoggia e non
-- dipende da niente fuori dall'argomento.
CREATE OR REPLACE FUNCTION sys.research_url_host(p_url text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT lower(
           split_part(                             -- via la porta
             regexp_replace(
               split_part(                         -- via le credenziali, se ci fossero
                 (regexp_match(p_url, '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#]+)'))[1],
                 '@', -1),
               '\.$', ''),                         -- via il punto finale della radice
             ':', 1)
         );
$fn$;

COMMENT ON FUNCTION sys.research_url_host(text) IS
  'L''host di un indirizzo, normalizzato: minuscolo, senza credenziali, senza porta, senza punto '
  'finale. NULLO se l''argomento non e'' un indirizzo con schema. Gemello di `hostOf()` in '
  'apps/api/src/modules/research/sources.ts: le due si provano sugli stessi casi limite.';

-- Un'evidenza web che nomina una fonte mai registrata — o registrata e RESPINTA — e' una
-- violazione della politica delle fonti (E14).
--
-- ⚠ PERCHE' `RETIRED` NON RENDE ROSSA LA STORIA: ritirare una fonte vuol dire «non la si
-- usa piu'», non «non andava bene». Se il ritiro accendesse la sentinella, ogni ritiro
-- futuro renderebbe rosso un passato legittimo — e sarebbe un allarme che insegna a non
-- guardarlo (#194). `REJECTED`, invece, e' un giudizio sul merito: un'evidenza che vi si
-- appoggia e' un difetto vero, oggi come allora.
-- Le 12 righe di STORIA36 hanno indirizzi `repo://` e restano fuori per costruzione: la
-- politica delle fonti riguarda cio' che si legge dal web.
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
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_research_sources s
      WHERE s.research_source_status <> 'REJECTED'
        AND (sys.research_url_host(e.seed_source_evidence_url) = s.research_source_host_suffix
          OR right(sys.research_url_host(e.seed_source_evidence_url),
                   length(s.research_source_host_suffix) + 1) = '.' || s.research_source_host_suffix)
   );

COMMENT ON VIEW sys.v_research_evidence_source_not_approved IS
  'SENTINELLA (#132 F4a) — deve restare a zero righe. Un''evidenza `http(s)` la cui fonte non e'' '
  'nel registro, o vi e'' REJECTED, e'' una proposta costruita su una fonte che la politica non '
  'ammette. Confronto per suffisso di host, senza caratteri jolly.';

-- ── ⑥ le post-condizioni ─────────────────────────────────────────────────────
DO $$
DECLARE n int; v_nullable text; v_versione uuid; v_tenant uuid; v_respinto boolean;
BEGIN
  -- 1. CIO' CHE NON DOVEVA CAMBIARE. Le corse storiche sono ancora tutte li', con il
  --    loro tenant e il loro stato; nessuna ha preso un fascicolo per sbaglio.
  SELECT count(*) INTO n FROM sys.sys_seed_acquisition_runs
   WHERE seed_acquisition_run_tenant_id IS NULL AND seed_acquisition_run_code LIKE 'STORIA36%';
  IF n <> 0 THEN
    RAISE EXCEPTION '000333: % corse di STORIA36 hanno perso il proprio tenant', n;
  END IF;
  SELECT count(*) INTO n FROM sys.sys_seed_acquisition_runs
   WHERE seed_acquisition_run_code LIKE 'STORIA36%'
     AND seed_acquisition_run_blueprint_version_id IS NOT NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION '000333: % corse di STORIA36 risultano agganciate a una versione di fascicolo', n;
  END IF;
  SELECT count(*) INTO n FROM sys.sys_seed_candidate_records
   WHERE seed_candidate_record_tenant_id IS NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION '000333: % proposte esistenti hanno perso il proprio tenant', n;
  END IF;

  -- 2. Le due colonne sono davvero nullabili — letto da `information_schema`, non
  --    dedotto dall'ordine di applicazione (ADR-0035: le due strade, stesso stato).
  SELECT is_nullable INTO v_nullable FROM information_schema.columns
   WHERE table_schema='sys' AND table_name='sys_seed_acquisition_runs'
     AND column_name='seed_acquisition_run_tenant_id';
  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION '000333: il tenant della corsa e'' ancora obbligatorio (%)', v_nullable;
  END IF;
  SELECT is_nullable INTO v_nullable FROM information_schema.columns
   WHERE table_schema='sys' AND table_name='sys_seed_candidate_records'
     AND column_name='seed_candidate_record_tenant_id';
  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION '000333: il tenant della proposta e'' ancora obbligatorio (%)', v_nullable;
  END IF;

  -- 3. La sentinella esiste ed e' a zero.
  EXECUTE 'SELECT count(*) FROM sys.v_research_evidence_source_not_approved' INTO n;
  IF n <> 0 THEN
    RAISE EXCEPTION '000333: % evidenze web si appoggiano a una fonte non ammessa', n;
  END IF;

  -- 4. LA PROVA CHE DEVE POTER FALLIRE — i due vincoli si provano su righe vere,
  --    dentro questa transazione, e cio' che scrivono viene tolto subito. Un vincolo
  --    «installato» che nessuno ha visto respingere e' una difesa dichiarata, non una
  --    difesa. Il `CHECK` di ② non ha bisogno di altre tabelle e si prova sempre; il
  --    trigger di ③ pretende una versione di fascicolo, che sul clone di CI puo' non
  --    esserci: li' si dichiara «installato, NON verificato» invece di fingere.
  v_respinto := false;
  BEGIN
    INSERT INTO sys.sys_seed_acquisition_runs (seed_acquisition_run_code) VALUES ('__PROVA_000333_SENZA_PADRONE__');
  EXCEPTION WHEN check_violation THEN v_respinto := true;
  END;
  IF NOT v_respinto THEN
    DELETE FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_code = '__PROVA_000333_SENZA_PADRONE__';
    RAISE EXCEPTION '000333: una corsa senza tenant e senza fascicolo e'' stata accettata: il CHECK sulla coppia non e'' in funzione';
  END IF;

  SELECT tenant_blueprint_version_id INTO v_versione FROM sys.sys_tenant_blueprint_versions LIMIT 1;
  SELECT tenant_id INTO v_tenant FROM sys.sys_tenancies LIMIT 1;
  IF v_versione IS NULL OR v_tenant IS NULL THEN
    RAISE NOTICE '000333: nessuna versione di fascicolo (o nessun tenant) su questo database — trigger di coerenza INSTALLATO, NON VERIFICATO';
  ELSE
    DECLARE v_corsa uuid;
    BEGIN
      INSERT INTO sys.sys_seed_acquisition_runs
        (seed_acquisition_run_code, seed_acquisition_run_blueprint_version_id)
      VALUES ('__PROVA_000333_TRIGGER__', v_versione)
      RETURNING seed_acquisition_run_id INTO v_corsa;

      v_respinto := false;
      BEGIN
        -- La corsa non ha tenant; la proposta ne dichiara uno: va respinta.
        INSERT INTO sys.sys_seed_candidate_records
          (seed_candidate_record_run_id, seed_candidate_record_tenant_id,
           seed_candidate_record_domain, seed_candidate_record_natural_key)
        VALUES (v_corsa, v_tenant, 'prova_000333', 'PROVA');
      EXCEPTION WHEN check_violation THEN v_respinto := true;
      END;

      DELETE FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_id = v_corsa;

      IF NOT v_respinto THEN
        RAISE EXCEPTION '000333: una proposta con un tenant diverso da quello della sua corsa e'' stata accettata: il trigger di coerenza non e'' in funzione';
      END IF;
      RAISE NOTICE '000333: verificati sul vivo — corsa senza padrone RESPINTA, proposta disallineata RESPINTA';
    END;
  END IF;

  SELECT count(*) INTO n FROM sys.sys_seed_acquisition_runs;
  RAISE NOTICE '000333 ok — corse presenti a fine migrazione: % (le stesse di prima: niente di quanto scritto dalle prove sopravvive)', n;
END $$;

COMMIT;
