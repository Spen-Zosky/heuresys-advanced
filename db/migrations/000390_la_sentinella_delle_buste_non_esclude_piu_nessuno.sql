-- 000390 — B8: la sentinella dei contratti non esclude più righe per il formato del periodo.
--
-- PERCHE' ESISTE. `sys.v_payslip_contract_mismatch` (mig. 000296) filtrava la propria fonte
-- con `WHERE user_pay_slip_period ~ '^[0-9]{4}-[0-9]{2}$'`, per non inciampare sulle tre
-- buste di chiara.spenuso (mig. 000362) scritte come "November 2025" invece di "2025-11".
-- B8 (bundle 2026-09-09) ha normalizzato quelle tre righe DIRETTAMENTE (non qui: e' un dato,
-- non struttura) e ha installato una sentinella dedicata al formato,
-- sys.v_busta_paga_periodo_malformato (mig. 000387, B3). Con quel controllo separato, il
-- filtro qui non esclude più nulla — misurato: 5.644 righe su 5.644 hanno oggi la forma
-- YYYY-MM — e tenerlo significherebbe due sentinelle con la stessa responsabilità: una
-- guarda il FORMATO, l'altra deve guardare l'IMPORTO, non filtrare silenziosamente chi non
-- le piace.
--
-- Nessun cambiamento di comportamento atteso: 0 righe prima, 0 righe dopo (verificato).

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE VIEW sys.v_payslip_contract_mismatch AS
WITH ultima AS (
  SELECT DISTINCT ON (user_pay_slip_user_id)
         user_pay_slip_user_id     AS uid,
         user_pay_slip_gross_pay   AS lordo_mensile,
         user_pay_slip_period      AS periodo,
         user_pay_slip_period_end  AS fine_periodo
    FROM sys.sys_user_pay_slips
   WHERE user_pay_slip_gross_pay IS NOT NULL
   ORDER BY user_pay_slip_user_id, user_pay_slip_period_end DESC
)
SELECT u.user_email,
       x.periodo                              AS ultima_busta,
       x.lordo_mensile,
       round(x.lordo_mensile * 13, 2)         AS annuo_dalle_buste,
       c.user_contract_gross_annual_salary    AS annuo_dal_contratto,
       round(x.lordo_mensile * 13 - c.user_contract_gross_annual_salary, 2) AS scarto,
       c.updated_at::date                     AS contratto_aggiornato_il,
       x.fine_periodo                         AS busta_chiusa_il
  FROM ultima x
  JOIN sys.sys_user_contracts c ON c.user_contract_user_id = x.uid
  JOIN sys.sys_users u          ON u.user_id = x.uid
 WHERE c.user_contract_gross_annual_salary IS NOT NULL
   AND abs(x.lordo_mensile * 13 - c.user_contract_gross_annual_salary) > 0.50
   AND c.updated_at::date <= x.fine_periodo;

COMMENT ON VIEW sys.v_payslip_contract_mismatch IS
  'SENTINELLA: persone la cui ultima busta (x13) non vale la retribuzione contrattuale SENZA '
  'che il contratto sia piu'' recente della busta. Attesa: 0 righe. B8 (2026-09-09, mig. 000390) '
  'ha tolto il filtro sul FORMATO del periodo: lo guarda ora sys.v_busta_paga_periodo_malformato '
  '(mig. 000387). "ultima" si sceglie per data reale (period_end), non per ordinamento del '
  'testo del periodo — lo stesso difetto che B8 ha corretto nel grafico della dashboard HR.';

COMMIT;
