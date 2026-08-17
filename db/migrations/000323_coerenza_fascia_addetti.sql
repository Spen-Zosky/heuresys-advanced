-- ═══════════════════════════════════════════════════════════════════════════════
-- 000323_coerenza_fascia_addetti.sql
--
-- LA DIMENSIONE E' DICHIARATA DUE VOLTE, E NIENTE LEGAVA LE DUE.  (#132 F0)
--
-- Il difetto, misurato il 2026-08-17
--   `sys_tenant_blueprint_version_employee_count_check` verifica **soltanto** che il
--   numero di addetti sia `>= 0`. La fascia dimensionale sta in un'altra colonna
--   (`size_band_id`, FK), e **nessun vincolo lega il numero alla fascia**: oggi si puo'
--   dichiarare fascia `XS` (1-9) con `5000` addetti, e nulla protesta.
--
-- Perche' non e' teorico, ed e' F0 e non una rifinitura
--   Le due misure hanno DUE RUOLI (Enzo, 2026-08-17): la **fascia** canalizza la
--   ricerca — si cerca «una banca di fascia M», non «una banca di 158 dipendenti» — e
--   serve al prezzo della piattaforma; il **numero** descrive l'azienda vera, ed e'
--   quello su cui lavorano le tabelle gestionali. Riscontro: il fascicolo di RTL
--   dichiara 158 addetti e RTL ha 158 posizioni attive.
--   Con la ricerca (#132 F4) una fascia sbagliata manda a cercare l'azienda sbagliata,
--   **e l'esito non lo rivelerebbe**: ne uscirebbe un'azienda plausibile e generica.
--   Il difetto si vedrebbe solo confrontando due numeri che nessuno confronta.
--
-- PERCHE' UN TRIGGER E NON UN `CHECK` (RD-08 preferisce i CHECK, e qui non si puo')
--   Un CHECK non puo' leggere un'altra tabella, e i limiti delle fasce vivono in
--   `sys_enterprise_size_bands`. Il trigger **non e' un pattern nuovo** in questo
--   progetto: `sys_tenant_blueprint_snapshot_immutable`,
--   `sys_auth_mfa_exemption_eligibility` e `sys_blueprint_variant_ensure_version` sono
--   validazioni di dominio fatte cosi', e le prime due sulla stessa famiglia di tabelle.
--   Il trigger regge anche le scritture che NON passano dal servizio — una migrazione,
--   uno script, una correzione a mano: e' il motivo per cui non basta la validazione
--   applicativa, che pure c'e' (per dare all'utente un messaggio invece di un errore SQL).
--
-- IL VINCOLO NON RENDE OBBLIGATORIO NIENTE, e la distinzione e' voluta
--   Vale **solo quando entrambi i valori ci sono**. Il numero di addetti resta opzionale
--   per la FIRMA (pretenderlo bloccherebbe fascicoli legittimi), e diventa obbligatorio
--   per **avviare una ricerca** — che e' un momento diverso, ed e' dichiarato nel
--   contratto dei parametri in `packages/shared`. Un NOT NULL qui confonderebbe i due.
--
-- Misurato PRIMA: l'unica versione esistente e' `M` (50-249) con **158** addetti →
-- coerente. Il vincolo entra senza respingere niente di cio' che c'e'.
--
-- Idempotente (CREATE OR REPLACE + DROP/CREATE del trigger). Nessuna cancellazione.
-- PER TORNARE INDIETRO: `DROP TRIGGER sys_blueprint_size_band_coherence ON
-- sys.sys_tenant_blueprint_versions;` piu' la rimozione di questo file (ADR-0035).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── la misura di partenza, dentro la transazione ───────────────────────────────
DO $$
DECLARE v_incoerenti int; v_tot int;
BEGIN
  SELECT count(*) INTO v_tot FROM sys.sys_tenant_blueprint_versions;
  SELECT count(*) INTO v_incoerenti
    FROM sys.sys_tenant_blueprint_versions v
    JOIN sys.sys_enterprise_size_bands b
      ON b.enterprise_size_band_id = v.tenant_blueprint_version_size_band_id
   WHERE v.tenant_blueprint_version_employee_count IS NOT NULL
     AND (v.tenant_blueprint_version_employee_count < b.enterprise_size_band_min_employees
       OR (b.enterprise_size_band_max_employees IS NOT NULL
           AND v.tenant_blueprint_version_employee_count > b.enterprise_size_band_max_employees));
  -- GUARDIA: se una riga esistente violasse il vincolo, il trigger la bloccherebbe al
  -- primo aggiornamento e nessuno saprebbe perche'. Si ferma qui, con il numero.
  IF v_incoerenti > 0 THEN
    RAISE EXCEPTION '000323: % versioni su % dichiarano un numero di addetti fuori dalla propria fascia. Vanno riconciliate prima di installare il vincolo.',
                    v_incoerenti, v_tot;
  END IF;
  RAISE NOTICE '000323: % versioni, 0 incoerenti fascia/addetti — il vincolo entra senza respingere nulla', v_tot;
END $$;

-- ── la validazione, in una funzione che dice ANCHE i numeri ───────────────────
CREATE OR REPLACE FUNCTION sys.sys_blueprint_size_band_coherence_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_code text; v_min int; v_max int;
BEGIN
  -- Il vincolo vale solo se entrambi i dati ci sono: il numero resta opzionale per la
  -- firma, ed e' obbligatorio soltanto per avviare una ricerca (momento diverso).
  IF NEW.tenant_blueprint_version_employee_count IS NULL
     OR NEW.tenant_blueprint_version_size_band_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT enterprise_size_band_code, enterprise_size_band_min_employees,
         enterprise_size_band_max_employees
    INTO v_code, v_min, v_max
    FROM sys.sys_enterprise_size_bands
   WHERE enterprise_size_band_id = NEW.tenant_blueprint_version_size_band_id;

  -- Una fascia che non esiste non e' un caso da tacere: la FK la impedisce, ma se
  -- domani la FK cambiasse, tacere qui trasformerebbe il vincolo in un no-op.
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'BLUEPRINT_SIZE_BAND_UNKNOWN: la fascia dichiarata non esiste nel catalogo';
  END IF;

  IF NEW.tenant_blueprint_version_employee_count < v_min
     OR (v_max IS NOT NULL AND NEW.tenant_blueprint_version_employee_count > v_max) THEN
    RAISE EXCEPTION
      'BLUEPRINT_SIZE_BAND_MISMATCH: la fascia % copre % addetti, ma ne sono dichiarati %',
      v_code,
      CASE WHEN v_max IS NULL THEN v_min || '+' ELSE v_min || '-' || v_max END,
      NEW.tenant_blueprint_version_employee_count;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS sys_blueprint_size_band_coherence
  ON sys.sys_tenant_blueprint_versions;
CREATE TRIGGER sys_blueprint_size_band_coherence
  BEFORE INSERT OR UPDATE OF tenant_blueprint_version_employee_count,
                             tenant_blueprint_version_size_band_id
  ON sys.sys_tenant_blueprint_versions
  FOR EACH ROW EXECUTE FUNCTION sys.sys_blueprint_size_band_coherence_fn();

-- ── la sentinella: 0 adesso, e 0 da qui in avanti ─────────────────────────────
-- Una vista `sys.v_*` entra da se' nella batteria di `db_health.py`, che pretende zero
-- righe. Il trigger impedisce di CREARNE di nuove; la sentinella sorveglia il caso in
-- cui una scrittura riesca a scavalcarlo (trigger disabilitato, COPY, restore).
CREATE OR REPLACE VIEW sys.v_blueprint_size_band_mismatch AS
SELECT v.tenant_blueprint_version_id,
       v.tenant_blueprint_version_number,
       b.enterprise_size_band_code,
       b.enterprise_size_band_min_employees,
       b.enterprise_size_band_max_employees,
       v.tenant_blueprint_version_employee_count
  FROM sys.sys_tenant_blueprint_versions v
  JOIN sys.sys_enterprise_size_bands b
    ON b.enterprise_size_band_id = v.tenant_blueprint_version_size_band_id
 WHERE v.tenant_blueprint_version_employee_count IS NOT NULL
   AND (v.tenant_blueprint_version_employee_count < b.enterprise_size_band_min_employees
     OR (b.enterprise_size_band_max_employees IS NOT NULL
         AND v.tenant_blueprint_version_employee_count > b.enterprise_size_band_max_employees));

COMMENT ON VIEW sys.v_blueprint_size_band_mismatch IS
 'Sentinella #132 F0: il numero di addetti dichiarato cade fuori dalla fascia dichiarata. Prima del 2026-08-17 nessun vincolo legava le due, e «XS con 5000 addetti» passava. Deve valere 0.';

-- ── la post-condizione, e una prova che il trigger MORDE davvero ──────────────
DO $$
DECLARE v_n int; v_ha_morso boolean := false; v_versione uuid; v_fascia uuid; v_addetti int;
BEGIN
  SELECT count(*) INTO v_n FROM sys.v_blueprint_size_band_mismatch;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '000323: la sentinella dichiara % incoerenze subito dopo l''installazione', v_n;
  END IF;

  -- IL CONTROLLO CHE DEVE POTER FALLIRE, eseguito qui e non rimandato a un test: si
  -- prova a scrivere un'incoerenza su una riga vera e si pretende che venga RESPINTA,
  -- poi si annulla il tentativo. Un trigger installato e mai provato e' indistinguibile
  -- da un trigger che ritorna NEW e basta.
  SELECT v.tenant_blueprint_version_id, v.tenant_blueprint_version_size_band_id,
         v.tenant_blueprint_version_employee_count
    INTO v_versione, v_fascia, v_addetti
    FROM sys.sys_tenant_blueprint_versions v
   WHERE v.tenant_blueprint_version_size_band_id IS NOT NULL LIMIT 1;

  IF v_versione IS NULL THEN
    RAISE NOTICE '000323: nessuna versione con fascia su questo database — il trigger non e'' provabile qui (clone senza dataset). Installato, non verificato.';
  ELSE
    BEGIN
      UPDATE sys.sys_tenant_blueprint_versions
         SET tenant_blueprint_version_employee_count = 99999
       WHERE tenant_blueprint_version_id = v_versione;
    EXCEPTION WHEN others THEN
      IF SQLERRM LIKE '%BLUEPRINT_SIZE_BAND_MISMATCH%' THEN
        v_ha_morso := true;
      ELSE
        RAISE;
      END IF;
    END;
    IF NOT v_ha_morso THEN
      RAISE EXCEPTION '000323: il trigger NON ha respinto 99999 addetti su una fascia reale: e'' installato ma inerte';
    END IF;
    -- Il tentativo respinto non lascia traccia (la UPDATE e' stata annullata dal
    -- RAISE), ma si ri-afferma il valore misurato all'inizio per non dipendere da
    -- come Postgres tratta lo statement fallito.
    UPDATE sys.sys_tenant_blueprint_versions
       SET tenant_blueprint_version_employee_count = v_addetti
     WHERE tenant_blueprint_version_id = v_versione;
    RAISE NOTICE '000323: il trigger MORDE — 99999 addetti su fascia reale respinti, valore originale (%) ripristinato', v_addetti;
  END IF;
END $$;

COMMIT;
