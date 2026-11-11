-- Blocco B (mandato RTL 2026-11-11): RTL e' una banca, via le regole di maturazione "CCNL Commercio" doppione.
-- Idempotente. Giornale: staging.rtl_allinea_regole_undo (riga intera in jsonb).
-- Rollback: INSERT INTO sys.sys_leave_accrual_rules SELECT (jsonb_populate_record(NULL::sys.sys_leave_accrual_rules, riga)).* FROM staging.rtl_allinea_regole_undo;
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_regole_undo (salvato_il timestamptz NOT NULL DEFAULT now(), riga jsonb NOT NULL);

-- guardia: ogni tipo di permesso con una regola Commercio deve avere una regola Credito 2024 nello stesso tenant
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM (SELECT DISTINCT accrual_rule_tenant_id, accrual_rule_leave_type FROM sys.sys_leave_accrual_rules WHERE accrual_rule_ccnl_type = 'CCNL Commercio') c
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_leave_accrual_rules k WHERE k.accrual_rule_tenant_id = c.accrual_rule_tenant_id
                       AND k.accrual_rule_leave_type = c.accrual_rule_leave_type AND k.accrual_rule_ccnl_type = 'CCNL Credito 2024');
  IF n > 0 THEN RAISE EXCEPTION 'B: % tipi di permesso resterebbero senza regola Credito', n; END IF;
END $$;

INSERT INTO staging.rtl_allinea_regole_undo (riga)
SELECT to_jsonb(r) FROM sys.sys_leave_accrual_rules r
 WHERE r.accrual_rule_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND r.accrual_rule_ccnl_type = 'CCNL Commercio'
   AND NOT EXISTS (SELECT 1 FROM staging.rtl_allinea_regole_undo u WHERE u.riga->>'accrual_rule_id' = r.accrual_rule_id::text);
DELETE FROM sys.sys_leave_accrual_rules
 WHERE accrual_rule_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND accrual_rule_ccnl_type = 'CCNL Commercio';

-- post-condizione
DO $$ DECLARE n int; m int; BEGIN
  SELECT count(*) INTO n FROM sys.sys_leave_accrual_rules WHERE accrual_rule_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND accrual_rule_ccnl_type <> 'CCNL Credito 2024';
  SELECT count(DISTINCT accrual_rule_leave_type) INTO m FROM sys.sys_leave_accrual_rules WHERE accrual_rule_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  IF n <> 0 OR m <> 5 THEN RAISE EXCEPTION 'B: post-condizione fallita (non Credito=%, tipi=%)', n, m; END IF;
END $$;
COMMIT;
SELECT 'B ok' AS esito, (SELECT count(*) FROM sys.sys_leave_accrual_rules WHERE accrual_rule_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0') AS regole_rtl, (SELECT count(*) FROM staging.rtl_allinea_regole_undo) AS nel_giornale;
