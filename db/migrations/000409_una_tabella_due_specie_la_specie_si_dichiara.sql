-- 000409 — Una tabella, due specie: la specie si dichiara, e una banda senza importo diventa impossibile.
--
-- #232 (HOLD dal 2026-08-25, ripresa in S1097 per mandato). `sys_compensation_bands` ospita
-- 29 righe che NON sono bande: 7 contratti collettivi (`CCNL_*_2024`) e 22 sigle sindacali
-- (`CGIL`, `FISAC_CGIL`, `UILCA`…), tutte senza importi. La 000325 le ha rese globali (I21:
-- sono classificazioni, aperte a ogni settore) e ha nominato il residuo — «una tabella che
-- porta due specie» — rimandando la MODELLAZIONE a una voce propria. Eccola.
--
-- LA DECISIONE, presa misurando e non a intuito (2026-09-12, produzione):
--   · nessuna delle 29 e' referenziata come banda: `sys_position_compensation_profiles` →
--     0 profili su una riga senza importo; e' l'unica FK entrante;
--   · i codici CCNL vivono altrove come TESTO: `sys_user_employment.pay_scale_group`
--     ('CCNL_CRED_2024' su 158 righe) e `sys_user_contracts.ccnl_type` ('CCNL Credito 2024'
--     su 158) — nessuna FK a questa tabella. Le sigle sindacali non sono usate da nessuna
--     tabella (grep sul repo: solo seed legacy archiviati e la 000325);
--   · il catalogo API (`GET /v1/compensation/bands`) le nasconde gia' per EURISTICA
--     (`withValueOnly`: «senza mid_eur non e' una fascia»).
-- Fra «tabella di riferimento propria» e «colonna di specie», la seconda: le 29 righe non
-- hanno consumatori da spostare, e una tabella nuova pretenderebbe un'API che la esponga
-- (#79) per un dato che oggi nessuno legge. Cio' che manca non e' un posto diverso: e' che la
-- specie sia DICHIARATA invece che dedotta da un NULL. RD-08: varchar + CHECK, mai ENUM.
--
-- E LA CHECK CHE CHIUDE LO STATO IMPOSSIBILE. Una riga di specie BAND senza `mid_eur` e'
-- esattamente cio' che l'euristica dell'API doveva tollerare: da oggi non puo' esistere.
-- L'API resta com'e' (l'euristica diventa ridondante, non sbagliata) e guadagna la specie
-- nel contratto.
--
-- Idempotente: colonna IF NOT EXISTS, aggiornamento per ELENCO ESPLICITO (mai un carattere
-- jolly: e' la garanzia che non tocchi altro), CHECK aggiunte solo se assenti. Post-condizioni
-- che proteggono cio' che NON doveva cambiare: il numero di righe e l'impronta di codici e
-- importi. Rollback dichiarato: le righe toccate finiscono in `staging.compensation_bands_specie_undo`
-- con la specie precedente (che e' sempre il default 'BAND'); disfare = riportare 'BAND'.

\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE sys.sys_compensation_bands
  ADD COLUMN IF NOT EXISTS compensation_band_kind varchar(16) NOT NULL DEFAULT 'BAND';

COMMENT ON COLUMN sys.sys_compensation_bands.compensation_band_kind IS
  'Specie della riga (#232, 000409): BAND = fascia retributiva con importi; CCNL = contratto '
  'collettivo; UNION = organizzazione sindacale. Le ultime due sono classificazioni (I21), '
  'senza importi per costruzione. Una BAND senza mid_eur e'' impossibile per CHECK.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'sys.sys_compensation_bands'::regclass
                    AND conname = 'sys_compensation_bands_kind_chk') THEN
    ALTER TABLE sys.sys_compensation_bands
      ADD CONSTRAINT sys_compensation_bands_kind_chk
      CHECK (compensation_band_kind IN ('BAND', 'CCNL', 'UNION'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staging.compensation_bands_specie_undo (
  compensation_band_id uuid PRIMARY KEY,
  compensation_band_code text NOT NULL,
  specie_prima text NOT NULL,
  specie_dopo text NOT NULL,
  registrato_il timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  n_prima int;
  n_dopo int;
  impronta_prima text;
  impronta_dopo text;
  n_ccnl int;
  n_union int;
  n_band_senza_importo int;
BEGIN
  SELECT count(*) INTO n_prima FROM sys.sys_compensation_bands;
  SELECT md5(string_agg(compensation_band_code || '|' || coalesce(compensation_band_mid_eur::text, '<null>')
                        || '|' || coalesce(compensation_band_tenant_id::text, '<null>'),
                        E'\n' ORDER BY compensation_band_id))
    INTO impronta_prima FROM sys.sys_compensation_bands;

  -- il giornale PRIMA della scrittura (idempotente: una riga gia' registrata non si ri-registra)
  INSERT INTO staging.compensation_bands_specie_undo (compensation_band_id, compensation_band_code, specie_prima, specie_dopo)
  SELECT compensation_band_id, compensation_band_code, compensation_band_kind,
         CASE WHEN compensation_band_code LIKE 'CCNL\_%' THEN 'CCNL' ELSE 'UNION' END
    FROM sys.sys_compensation_bands
   WHERE compensation_band_kind = 'BAND'
     AND compensation_band_code IN (
     'CCNL_ALIM_2024','CCNL_COMM_2024','CCNL_CRED_2024','CCNL_ENERGIA_2024',
     'CCNL_METMEC_2024','CCNL_TLC_2024','CCNL_TUR_2024',
     'CGIL','CISL','FABI','FAI_CISL','FILCAMS_CGIL','FILCTEM_CGIL','FIRST_CISL',
     'FISAC_CGIL','FISASCAT_CISL','FLAEI_CISL','FLAI_CGIL','SINFUB','UGL',
     'UGL_AGROALIM','UGL_CHIM_EN','UGL_CREDITO','UGL_TERZIARIO','UIL','UILA_UIL',
     'UILCA','UILTEC_UIL','UILTUCS_UIL')
  ON CONFLICT (compensation_band_id) DO NOTHING;

  UPDATE sys.sys_compensation_bands
     SET compensation_band_kind = 'CCNL', updated_at = now()
   WHERE compensation_band_kind <> 'CCNL'
     AND compensation_band_code IN (
     'CCNL_ALIM_2024','CCNL_COMM_2024','CCNL_CRED_2024','CCNL_ENERGIA_2024',
     'CCNL_METMEC_2024','CCNL_TLC_2024','CCNL_TUR_2024');

  UPDATE sys.sys_compensation_bands
     SET compensation_band_kind = 'UNION', updated_at = now()
   WHERE compensation_band_kind <> 'UNION'
     AND compensation_band_code IN (
     'CGIL','CISL','FABI','FAI_CISL','FILCAMS_CGIL','FILCTEM_CGIL','FIRST_CISL',
     'FISAC_CGIL','FISASCAT_CISL','FLAEI_CISL','FLAI_CGIL','SINFUB','UGL',
     'UGL_AGROALIM','UGL_CHIM_EN','UGL_CREDITO','UGL_TERZIARIO','UIL','UILA_UIL',
     'UILCA','UILTEC_UIL','UILTUCS_UIL');

  -- LA GUARDIA, ri-verificata ADESSO e non ereditata dalla misura: se resta una BAND senza
  -- importo, la CHECK qui sotto non si puo' installare, e la migrazione lo dice per nome.
  SELECT count(*) INTO n_band_senza_importo
    FROM sys.sys_compensation_bands
   WHERE compensation_band_kind = 'BAND' AND compensation_band_mid_eur IS NULL;
  IF n_band_senza_importo <> 0 THEN
    RAISE EXCEPTION
      '000409: % righe di specie BAND senza importo NON sono nell''elenco delle 29: la specie '
      'va decisa una per una, non si allarga l''elenco per far passare la CHECK', n_band_senza_importo;
  END IF;

  -- POST-CONDIZIONI su cio' che NON doveva cambiare: righe, codici, importi, titolari.
  SELECT count(*) INTO n_dopo FROM sys.sys_compensation_bands;
  IF n_dopo <> n_prima THEN
    RAISE EXCEPTION '000409: righe % invece di %: la migrazione ha toccato cio'' che non doveva', n_dopo, n_prima;
  END IF;
  SELECT md5(string_agg(compensation_band_code || '|' || coalesce(compensation_band_mid_eur::text, '<null>')
                        || '|' || coalesce(compensation_band_tenant_id::text, '<null>'),
                        E'\n' ORDER BY compensation_band_id))
    INTO impronta_dopo FROM sys.sys_compensation_bands;
  IF impronta_dopo IS DISTINCT FROM impronta_prima THEN
    RAISE EXCEPTION '000409: codici, importi o titolari sono cambiati (impronta % contro %)', impronta_dopo, impronta_prima;
  END IF;

  SELECT count(*) FILTER (WHERE compensation_band_kind = 'CCNL'),
         count(*) FILTER (WHERE compensation_band_kind = 'UNION')
    INTO n_ccnl, n_union FROM sys.sys_compensation_bands;
  RAISE NOTICE '000409: specie dichiarata · % CCNL · % UNION · % righe invariate per impronta', n_ccnl, n_union, n_dopo;
END $$;

-- La CHECK che chiude lo stato impossibile: una BAND senza importo mediano non esiste.
-- Le classificazioni (CCNL, UNION) restano libere di non averlo — e' la loro natura.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'sys.sys_compensation_bands'::regclass
                    AND conname = 'sys_compensation_bands_band_ha_importo_chk') THEN
    ALTER TABLE sys.sys_compensation_bands
      ADD CONSTRAINT sys_compensation_bands_band_ha_importo_chk
      CHECK (compensation_band_kind <> 'BAND' OR compensation_band_mid_eur IS NOT NULL);
  END IF;
END $$;

-- LA PROVA CHE LA CHECK PUO' FALLIRE, dentro un SAVEPOINT: una BAND senza importo deve essere
-- rifiutata, e una CCNL senza importo accettata. Nessuna riga sopravvive alla prova.
DO $$
DECLARE
  rifiutata boolean := false;
BEGIN
  BEGIN
    INSERT INTO sys.sys_compensation_bands
      (compensation_band_id, compensation_band_code, compensation_band_name, compensation_band_kind, compensation_band_is_global)
    VALUES (gen_random_uuid(), '__PROVA_000409_BAND__', 'prova', 'BAND', true);
  EXCEPTION WHEN check_violation THEN
    rifiutata := true;
  END;
  IF NOT rifiutata THEN
    RAISE EXCEPTION '000409: la CHECK NON ha rifiutato una BAND senza importo — la guardia e'' cieca';
  END IF;

  INSERT INTO sys.sys_compensation_bands
    (compensation_band_id, compensation_band_code, compensation_band_name, compensation_band_kind, compensation_band_is_global)
  VALUES (gen_random_uuid(), '__PROVA_000409_CCNL__', 'prova', 'CCNL', true);
  DELETE FROM sys.sys_compensation_bands WHERE compensation_band_code = '__PROVA_000409_CCNL__';
  IF EXISTS (SELECT 1 FROM sys.sys_compensation_bands WHERE compensation_band_code LIKE '__PROVA_000409%') THEN
    RAISE EXCEPTION '000409: la prova ha lasciato righe';
  END IF;
  RAISE NOTICE '000409: CHECK provata a esiti opposti (BAND senza importo rifiutata, CCNL senza importo ammessa)';
END $$;

COMMIT;
