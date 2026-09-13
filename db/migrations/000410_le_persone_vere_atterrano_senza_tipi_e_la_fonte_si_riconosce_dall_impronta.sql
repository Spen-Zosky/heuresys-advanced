-- 000410 — Le persone vere atterrano senza tipi, e la fonte si riconosce dall'impronta.
--
-- #206 T2 + T3 (Tenant Builder P4, S1098). P3 costruisce l'azienda dal fascicolo; P4 e' il
-- momento in cui arrivano le persone vere dal sistema informativo DEL CLIENTE — mai dal legacy
-- (I12: il rubinetto e' chiuso). Due oggetti, entrambi misurati prima di scriverli (2026-09-13):
--
--   1. `staging.tenant_import_people` — la tabella di atterraggio, sul modello di
--      `staging.rtl_employees` (162 righe, TUTTE le colonne text). La regola che non si negozia:
--      NESSUN TIPO IN INGRESSO. Un sistema esterno manda date come '31/02/2024', booleani come
--      'S', codici con spazi in coda. Tipizzare qui vuol dire rifiutare la riga prima di averla
--      potuta guardare, e perdere l'unica occasione di dire PERCHE' e' stata rifiutata: la
--      tipizzazione avviene nella validazione (T4), dove un fallimento ha un nome e una riga.
--      Le sole colonne tipizzate sono le NOSTRE: la fonte da cui la riga viene e il numero di
--      riga nel file — che non arrivano dal cliente, li scriviamo noi.
--
--   2. l'impronta di `reference_sync.source_exports` diventa UNICA. La consegna del lab diceva
--      «porta gia' l'impronta del contenuto, ed e' cio' che rende una corsa idempotente»; misurato,
--      `source_export_file_hash` non aveva NESSUN vincolo (6 righe, 4 con impronta, 0 duplicati),
--      mentre il NOME era unico. Cioe' l'idempotenza era per nome: lo stesso file con un nome
--      diverso sarebbe entrato due volte. L'indice e' parziale perche' due righe storiche non hanno
--      impronta, e quelle non si toccano (ADR-0035: si dichiara, non si cancella).
--
-- Idempotente: CREATE ... IF NOT EXISTS su tutto. Nessuna riga scritta, nessuna toccata.
-- Post-condizioni: i due oggetti esistono; e cio' che NON doveva cambiare — il numero di righe di
-- `source_exports` e di `rtl_employees` — e' lo stesso di prima. Rollback dichiarato: DROP TABLE
-- staging.tenant_import_people + DROP INDEX reference_sync.source_exports_file_hash_uq; non c'e'
-- un giornale perche' questa migrazione non muove dati.

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_exports_prima bigint;
  v_rtl_prima     bigint;
BEGIN
  SELECT count(*) INTO v_exports_prima FROM reference_sync.source_exports;
  SELECT count(*) INTO v_rtl_prima     FROM staging.rtl_employees;
  PERFORM set_config('mig410.exports_prima', v_exports_prima::text, true);
  PERFORM set_config('mig410.rtl_prima',     v_rtl_prima::text,     true);
END $$;

-- 1. La tabella di atterraggio: le colonne del cliente sono TUTTE text, per costruzione.
CREATE TABLE IF NOT EXISTS staging.tenant_import_people (
  tenant_import_person_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- le due colonne NOSTRE: da quale estrazione viene la riga, e a che riga del file stava
  tenant_import_person_export_id uuid    NOT NULL
    REFERENCES reference_sync.source_exports (source_export_id) ON DELETE RESTRICT,
  tenant_import_person_row_no    integer NOT NULL,
  -- da qui in giu': il cliente. Nessun tipo, nessun default, nessun NOT NULL.
  external_id           text,
  email                 text,
  personal_email        text,
  first_name            text,
  middle_name           text,
  last_name             text,
  job_title             text,
  department            text,
  location              text,
  position_code         text,
  org_unit_code         text,
  manager_external_id   text,
  pernr                 text,
  hire_date             text,
  seniority_date        text,
  is_active             text,
  employment_status     text,
  phone_mobile          text,
  phone_work            text,
  address_street        text,
  address_city          text,
  address_postal_code   text,
  address_country       text,
  -- le competenze che il cliente dichiara per la persona: codici separati da ';' (E19 le
  -- confronta coi requisiti CRITICAL della posizione; senza, ogni requisito risulta mancante)
  skill_codes           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_import_people_export_row_uq UNIQUE (tenant_import_person_export_id, tenant_import_person_row_no),
  CONSTRAINT tenant_import_people_row_no_ck CHECK (tenant_import_person_row_no >= 1)
);

COMMENT ON TABLE staging.tenant_import_people IS
  'Atterraggio delle persone vere estratte dal sistema del CLIENTE (#206 T2, Tenant Builder P4). '
  'Tutte le colonne del cliente sono text per costruzione: la tipizzazione avviene nella validazione, '
  'dove un fallimento ha un nome. Mai popolata dal legacy (I12).';

CREATE INDEX IF NOT EXISTS tenant_import_people_export_idx
  ON staging.tenant_import_people (tenant_import_person_export_id);

-- 2. L'impronta e' unica: e' lei che rende la corsa idempotente, non il nome.
CREATE UNIQUE INDEX IF NOT EXISTS source_exports_file_hash_uq
  ON reference_sync.source_exports (source_export_file_hash)
  WHERE source_export_file_hash IS NOT NULL;

COMMENT ON INDEX reference_sync.source_exports_file_hash_uq IS
  'Lo stesso contenuto e'' la stessa fonte, qualunque nome porti (#206 T3). Parziale: le righe '
  'storiche senza impronta restano, dichiarate non idempotenti.';

-- Post-condizioni.
DO $$
DECLARE
  v_exports_dopo bigint;
  v_rtl_dopo     bigint;
  v_tipizzate    int;
BEGIN
  IF to_regclass('staging.tenant_import_people') IS NULL THEN
    RAISE EXCEPTION '000410: staging.tenant_import_people non esiste';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'reference_sync'
                    AND indexname = 'source_exports_file_hash_uq') THEN
    RAISE EXCEPTION '000410: l''indice unico sull''impronta non esiste';
  END IF;
  -- la regola «nessun tipo in ingresso», verificata sul catalogo e non sulla fiducia: fra le
  -- colonne del cliente non deve essercene una che non sia text.
  SELECT count(*) INTO v_tipizzate
    FROM information_schema.columns
   WHERE table_schema = 'staging' AND table_name = 'tenant_import_people'
     AND column_name NOT IN ('tenant_import_person_id', 'tenant_import_person_export_id',
                             'tenant_import_person_row_no', 'created_at')
     AND data_type <> 'text';
  IF v_tipizzate <> 0 THEN
    RAISE EXCEPTION '000410: % colonne del cliente sono tipizzate — la tabella di atterraggio rifiuterebbe righe prima di guardarle', v_tipizzate;
  END IF;
  -- cio' che NON doveva cambiare
  SELECT count(*) INTO v_exports_dopo FROM reference_sync.source_exports;
  SELECT count(*) INTO v_rtl_dopo     FROM staging.rtl_employees;
  IF v_exports_dopo::text <> current_setting('mig410.exports_prima', true) THEN
    RAISE EXCEPTION '000410: source_exports e'' cambiata (% → %)', current_setting('mig410.exports_prima', true), v_exports_dopo;
  END IF;
  IF v_rtl_dopo::text <> current_setting('mig410.rtl_prima', true) THEN
    RAISE EXCEPTION '000410: staging.rtl_employees e'' cambiata (% → %)', current_setting('mig410.rtl_prima', true), v_rtl_dopo;
  END IF;
  RAISE NOTICE '000410 done: atterraggio senza tipi pronto, impronta unica su source_exports (% fonti)', v_exports_dopo;
END $$;

COMMIT;
