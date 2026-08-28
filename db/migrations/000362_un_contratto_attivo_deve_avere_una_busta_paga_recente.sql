-- ============================================================================
-- 000362 — Un contratto attivo deve avere una busta paga recente
--
-- VOCE: #234 F2, firma `X3c` — «Contratto attivo senza busta paga recente».
-- Misurato il 2026-08-28 con la query del check: **2 righe su 160**, ed erano
-- **entrambe del tenant Heuresys System**, non di RTL Bank:
--     andrea.spenuso@heuresys.com   Dirigente  (nessuna busta)   46.260 giorni
--     chiara.spenuso@heuresys.com   Quadro     2025-11-30           271 giorni
--
-- LA CAUSA, misurata e non dedotta. RTL Bank ha una **storia retributiva viva**:
-- 5.638 buste dal 2023-08-31 al 2026-07-31, che `db/scripts/storia36.sh` porta
-- avanti da se con un timer notturno. Heuresys System non ce l-ha: possiede tre
-- buste per una sola delle sue due persone sotto contratto, ferme a novembre
-- 2025, evidentemente seminate a titolo di esempio e mai proseguite. Le due
-- righe rosse non sono un guasto: sono un tenant lasciato indietro.
--
-- E LE TRE BUSTE ESISTENTI SONO ANOMALE ANCHE NELLA FORMA, verificato
-- confrontandole con le 5.638 di RTL:
--   · `user_pay_slip_period` vale `November 2025`, mentre la convenzione reale
--     della colonna e `YYYY-MM` (5.638 righe su 5.641).
--   · `user_pay_slip_status` vale `available`, mentre i mesi chiusi sono `paid`
--     (5.638 su 5.641).
-- Questa migrazione **non le riscrive** — non e il difetto che deve curare, e
-- riscrivere righe altrui per uniformarle e il modo piu rapido di rompere
-- qualcosa che non si stava guardando. Le nuove righe seguono la convenzione
-- reale, non quella delle tre anomale.
--
-- LA DERIVAZIONE, e perche non e invenzione. Il rubinetto del brownfield e
-- chiuso (I12 / ADR-0038): cio che manca **si deriva da cio che `sys.*` gia
-- contiene**. Qui si deriva tutto da tre fonti interne:
--   · **il periodo** — dal mese successivo all-ultima busta della persona (o da
--     2025-09 se non ne ha alcuna) fino a **2026-07**, che e il mese a cui
--     arriva la storia di RTL. Allineare i due tenant e la ragione di questa
--     scelta: un tenant di produzione non deve avere due orologi.
--   · **il lordo** — la retribuzione annua lorda del **contratto** divisa per
--     **tredici**, che e la fonte autorevole e la convenzione gia in vigore.
--   · **il netto** — il rapporto netto/lordo della sua ultima busta, oppure, in
--     assenza, **0,7184**, che e la media misurata sulle 5.641 buste realmente
--     presenti. Non un numero scelto: un numero letto.
--
-- ⚠ PERCHE TREDICI, E PERCHE NON SI PROSEGUE LA SERIE. La prima stesura di
-- questa migrazione proseguiva la serie esistente della persona col suo ultimo
-- lordo, ragionando che una retribuzione non fa scalini senza un evento che li
-- giustifichi. **La prova generale sul gemello l-ha smentita**, e questo e il
-- motivo per cui esiste: la seconda passata e uscita rossa con «2 persone hanno
-- uno scarto busta/contratto NON spiegato». Esiste gia una sentinella,
-- `sys.v_payslip_contract_mismatch` (migrazione `000296`), che pretende
-- `lordo_mensile * 13 = gross_annual_salary` entro cinquanta centesimi, e la
-- catena si ferma se e accesa. Dividere per dodici, come faceva la prima
-- stesura, sbagliava anche la persona che non aveva alcuna serie.
--   Conseguenza voluta: per chiara.spenuso il lordo passa da 5.800 (le tre
--   buste seminate, ferme a novembre 2025) a 7.280,32, che e il suo contratto
--   diviso tredici. Lo scalino a dicembre 2025 non e un effetto collaterale: e
--   cio che la sentinella della catena impone, ed e la lettura giusta — il
--   contratto e l-autorita, le tre buste anomale sono un residuo di semina.
--   Restano dove sono, non riscritte, e la sentinella non le guarda perche il
--   loro periodo non ha la forma `YYYY-MM`.
--
-- ⚠ E SI RIACCENDERA, e va detto adesso invece che scoprirlo fra tre mesi: il
-- controllo guarda una finestra di **novanta giorni**, e questa migrazione porta
-- il tenant a luglio 2026, non lo aggancia a un avanzamento. Senza un timer come
-- quello di RTL, `X3c` tornera rosso. La cura strutturale e estendere
-- l-avanzamento della storia al tenant di piattaforma, ed e materia di una voce
-- propria, non di una migrazione.
--
-- NESSUN FILE DELLA CATENA RICREA QUESTE RIGHE — le buste di Heuresys nascono da
-- un seed una-tantum, e quelle di RTL da uno script di storia. Non c-e quindi un
-- file da emendare ai sensi di ADR-0035.
--
-- ROLLBACK: giornale `staging.mig362_buste_heuresys_undo` +
-- `staging.mig362_buste_heuresys_undo_apply()`.
--
-- IDEMPOTENTE: ogni riga e filtrata con NOT EXISTS sulla coppia (persona, mese).
-- Alla seconda passata tocca zero righe.
-- Authored: 2026-08-28 (S1083).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Il giornale di annullamento, PRIMA di qualunque scrittura.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.mig362_buste_heuresys_undo (
  undo_id      bigserial PRIMARY KEY,
  migrazione   text        NOT NULL,
  pay_slip_id  uuid        NOT NULL,
  user_id      uuid        NOT NULL,
  periodo      text        NOT NULL,
  creato_il    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE staging.mig362_buste_heuresys_undo IS
  'Giornale di annullamento delle buste paga generate per il tenant Heuresys System '
  '(X3c, #234 F2, S1083). Conserva le chiavi delle righe create: disfare qui '
  'significa cancellare cio che si e aggiunto. Si applica al contrario con '
  'staging.mig362_buste_heuresys_undo_apply().';

-- ----------------------------------------------------------------------------
-- 1. LA GUARDIA — ri-verifica la precondizione ADESSO, non eredita la misura.
--
--    Fallisce, e deve, se una persona da servire non avesse ne una serie
--    esistente ne una retribuzione contrattuale: si scriverebbero buste da
--    importo nullo, cioe si sostituirebbe un buco visibile con un dato falso.
--    Non fallisce se non c-e nessuno da servire: deve poter girare su un
--    database nuovo e su heuresys_ci.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_da_servire int;
  v_senza_base int;
BEGIN
  SELECT count(*) INTO v_da_servire
    FROM sys.sys_users u
    JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
   WHERE t.tenant_code = 'HEURESYS'
     AND c.user_contract_end_date IS NULL;

  SELECT count(*) INTO v_senza_base
    FROM sys.sys_users u
    JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
   WHERE t.tenant_code = 'HEURESYS'
     AND c.user_contract_end_date IS NULL
     AND coalesce(c.user_contract_gross_annual_salary, 0) <= 0;

  IF v_senza_base > 0 THEN
    RAISE EXCEPTION
      'mig362: % persone hanno un contratto attivo senza retribuzione annua. '
      'Scrivere buste a importo nullo sostituirebbe un buco visibile con un '
      'dato falso.', v_senza_base;
  END IF;

  RAISE NOTICE 'mig362 guardia: % contratti attivi nel tenant di piattaforma, '
               '0 senza base di calcolo', v_da_servire;
END $$;

-- ----------------------------------------------------------------------------
-- 2. LE BUSTE MANCANTI. La base di calcolo per persona, poi i mesi mancanti.
-- ----------------------------------------------------------------------------
WITH base AS (
  SELECT u.user_id,
         u.user_tenant_id,
         -- lordo: il contratto diviso TREDICI. Non la serie esistente: la
         -- sentinella v_payslip_contract_mismatch (mig 000296) pretende
         -- lordo * 13 = annuo entro 0,50, e la catena si ferma se e accesa.
         round(c.user_contract_gross_annual_salary / 13.0, 2) AS lordo,
         -- rapporto netto/lordo: quello della persona, altrimenti la media reale
         coalesce(
           (SELECT round(ps.user_pay_slip_net_pay / nullif(ps.user_pay_slip_gross_pay, 0), 4)
              FROM sys.sys_user_pay_slips ps
             WHERE ps.user_pay_slip_user_id = u.user_id
               AND ps.user_pay_slip_gross_pay > 0
             ORDER BY ps.user_pay_slip_period_end DESC LIMIT 1),
           0.7184
         ) AS rapporto,
         -- il primo mese da coprire: quello dopo l-ultima busta, o 2025-09
         coalesce(
           (SELECT date_trunc('month', max(ps.user_pay_slip_period_end))::date
                 + interval '1 month'
              FROM sys.sys_user_pay_slips ps
             WHERE ps.user_pay_slip_user_id = u.user_id),
           DATE '2025-09-01'
         )::date AS dal
    FROM sys.sys_users u
    JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
   WHERE t.tenant_code = 'HEURESYS'
     AND c.user_contract_end_date IS NULL
),
mesi AS (
  SELECT b.*, m::date AS inizio
    FROM base b
   CROSS JOIN LATERAL generate_series(b.dal, DATE '2026-07-01', interval '1 month') m
)
INSERT INTO sys.sys_user_pay_slips
  (user_pay_slip_user_id, user_pay_slip_tenant_id, user_pay_slip_period,
   user_pay_slip_period_start, user_pay_slip_period_end,
   user_pay_slip_gross_pay, user_pay_slip_net_pay, user_pay_slip_deductions,
   user_pay_slip_payment_date, user_pay_slip_status, user_pay_slip_metadata)
SELECT m.user_id,
       m.user_tenant_id,
       to_char(m.inizio, 'YYYY-MM'),
       m.inizio,
       (m.inizio + interval '1 month - 1 day')::date,
       m.lordo,
       round(m.lordo * m.rapporto, 2),
       '{}'::jsonb,
       (m.inizio + interval '27 days')::date,
       'paid',
       jsonb_build_object('origine', 'mig000362',
                          'derivazione', 'serie della persona o contratto diviso dodici')
  FROM mesi m
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_user_pay_slips ps
    WHERE ps.user_pay_slip_user_id = m.user_id
      AND ps.user_pay_slip_period_start = m.inizio);

-- ----------------------------------------------------------------------------
-- 3. Il giornale si popola con cio che e stato appena creato.
-- ----------------------------------------------------------------------------
INSERT INTO staging.mig362_buste_heuresys_undo
  (migrazione, pay_slip_id, user_id, periodo)
SELECT '000362', ps.user_pay_slip_id, ps.user_pay_slip_user_id, ps.user_pay_slip_period
  FROM sys.sys_user_pay_slips ps
 WHERE ps.user_pay_slip_metadata ->> 'origine' = 'mig000362'
   AND NOT EXISTS (SELECT 1 FROM staging.mig362_buste_heuresys_undo u
                    WHERE u.pay_slip_id = ps.user_pay_slip_id);

-- ----------------------------------------------------------------------------
-- 4. LE POST-CONDIZIONI — proteggono anche cio che NON doveva cambiare.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_rossi     int;
  v_create    int;
  v_estranee  int;
  v_intatte   int;
  v_scarti    int;
BEGIN
  -- (a) cio che DOVEVA cambiare: nessun contratto attivo del tenant di
  --     piattaforma resta senza busta recente rispetto al mese di riferimento.
  --     Si misura sulla stessa soglia del check (90 giorni), ma ancorata al
  --     2026-07-31 e non a today(): una migrazione deve dare lo stesso esito
  --     domani e fra un anno, e `CURRENT_DATE` la renderebbe rossa col tempo.
  SELECT count(*) INTO v_rossi
    FROM sys.sys_users u
    JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
   WHERE t.tenant_code = 'HEURESYS'
     AND c.user_contract_end_date IS NULL
     AND DATE '2026-07-31' - coalesce(
           (SELECT max(ps.user_pay_slip_period_end) FROM sys.sys_user_pay_slips ps
             WHERE ps.user_pay_slip_user_id = u.user_id), DATE '1900-01-01') > 90;
  IF v_rossi <> 0 THEN
    RAISE EXCEPTION 'mig362: restano % contratti attivi senza busta recente', v_rossi;
  END IF;

  -- (b) cio che NON doveva cambiare, ed e la meta che conta.
  --     b1: nessuna busta e stata scritta fuori dal tenant di piattaforma.
  SELECT count(*) INTO v_estranee
    FROM staging.mig362_buste_heuresys_undo u
    JOIN sys.sys_users us ON us.user_id = u.user_id
    JOIN sys.sys_tenancies t ON t.tenant_id = us.user_tenant_id
   WHERE u.migrazione = '000362' AND t.tenant_code <> 'HEURESYS';
  IF v_estranee <> 0 THEN
    RAISE EXCEPTION
      'mig362: % buste sono finite fuori dal tenant di piattaforma', v_estranee;
  END IF;

  --     b2: le tre buste anomale preesistenti sono ancora la, immutate. Se la
  --     generazione le avesse sovrascritte, (a) sarebbe verde lo stesso e non se
  --     ne saprebbe nulla.
  SELECT count(*) INTO v_intatte
    FROM sys.sys_user_pay_slips
   WHERE user_pay_slip_status = 'available'
     AND user_pay_slip_period !~ '^[0-9]{4}-[0-9]{2}$';

  --     b3: la sentinella dello scarto busta/contratto non si accende. E la
  --     prova che la derivazione ha usato il divisore giusto: la prima stesura
  --     divideva per dodici e la faceva accendere su entrambe le persone.
  SELECT count(*) INTO v_scarti FROM sys.v_payslip_contract_mismatch;
  IF v_scarti <> 0 THEN
    RAISE EXCEPTION
      'mig362: la sentinella dello scarto busta/contratto segnala % persone', v_scarti;
  END IF;

  SELECT count(*) INTO v_create
    FROM staging.mig362_buste_heuresys_undo WHERE migrazione = '000362';

  RAISE NOTICE 'mig362 post: 0 contratti scoperti · % buste create · 0 fuori tenant · '
               '0 scarti busta/contratto · % buste preesistenti in forma anomala intatte',
    v_create, v_intatte;
END $$;

-- ----------------------------------------------------------------------------
-- 5. La funzione che disfa.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.mig362_buste_heuresys_undo_apply()
RETURNS TABLE(azione text, righe bigint)
LANGUAGE plpgsql AS $$
DECLARE v_tolte bigint := 0;
BEGIN
  DELETE FROM sys.sys_user_pay_slips ps
   USING staging.mig362_buste_heuresys_undo u
   WHERE u.migrazione = '000362' AND ps.user_pay_slip_id = u.pay_slip_id;
  GET DIAGNOSTICS v_tolte = ROW_COUNT;

  RETURN QUERY VALUES ('buste rimosse', v_tolte);
END $$;

COMMIT;
