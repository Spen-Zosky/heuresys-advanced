-- Blocco D / catalogo mansioni (mandato RTL 2026-11-11): nomi in italiano, doppi inglese/italiano unificati sul nome italiano,
-- famiglia e livello dove mancano. Vale per le mansioni usate dai posti RTL. Idempotente.
-- Giornale: staging.rtl_allinea_org_undo (tabelle sys_job_roles e sys_positions, riga prima). Rollback: UPDATE dai valori della riga salvata.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
-- 1) doppi: la mansione inglese confluisce nella italiana gia' presente (posti riagganciati, mansione inglese lasciata inutilizzata)
CREATE TEMP TABLE fusione(en text, it text) ON COMMIT DROP;
INSERT INTO fusione VALUES
 ('RTL-ROLE-BACK-OFFICE-SPECIALIST','RTL-ROLE-SPECIALISTA-BACK-OFFICE'),
 ('RTL-ROLE-BANK-TELLER','RTL-ROLE-CASSIERE'),
 ('RTL-ROLE-BANK-MANAGER','RTL-ROLE-DIRETTORE-FILIALE'),
 ('RTL-ROLE-COMPLIANCE-OFFICER','RTL-ROLE-SPECIALISTA-COMPLIANCE'),
 ('RTL-ROLE-FINANCIAL-ANALYST','RTL-ROLE-ANALISTA-FINANZIARIO'),
 ('RTL-ROLE-RISK-ANALYST','RTL-ROLE-ANALISTA-RISCHIO'),
 ('RTL-ROLE-PAYMENT-SPECIALIST','RTL-ROLE-SPECIALISTA-PAGAMENTI'),
 ('RTL-LEGAL','RTL-ROLE-LEGALE'),
 ('RTL-ROLE-SYSTEM-ADMINISTRATOR','RTL-ROLE-SISTEMISTA');
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_positions', p.position_id, to_jsonb(p) FROM sys.sys_positions p
  JOIN sys.sys_job_roles e ON e.job_role_id=p.position_job_role_id AND e.job_role_tenant_id IS NULL
  JOIN fusione f ON f.en=e.job_role_code
  JOIN sys.sys_job_roles i ON i.job_role_code=f.it AND i.job_role_tenant_id IS NULL
ON CONFLICT DO NOTHING;
UPDATE sys.sys_positions p SET position_job_role_id=i.job_role_id
FROM sys.sys_job_roles e, fusione f, sys.sys_job_roles i
WHERE e.job_role_id=p.position_job_role_id AND e.job_role_tenant_id IS NULL AND f.en=e.job_role_code
  AND i.job_role_code=f.it AND i.job_role_tenant_id IS NULL;
-- 2) nomi italiani, famiglia, livello
CREATE TEMP TABLE nome(codice text, nome text, famiglia text, livello text) ON COMMIT DROP;
INSERT INTO nome VALUES
 ('RTL-AUDIT','Revisore Interno','AUDIT','MID'),
 ('RTL-MKT','Specialista Marketing Bancario','MKT','MID'),
 ('PROTO-7-3','Tesoriere Bancario','TREAS','MID'),
 ('RTL-FX','Trader Cambi e Mercati Monetari','TREAS','MID'),
 ('RTL-ROLE-CEO','Direttore Generale',NULL,NULL),
 ('RTL-ROLE-CHIEF-RISK-OFFICER','Direttore Rischi',NULL,NULL),
 ('RTL-ROLE-FINANCE-DIRECTOR','Direttore Finanza e Amministrazione',NULL,NULL),
 ('RTL-ROLE-HEAD-OF-COMMERCIAL-BANKING','Direttore Commerciale',NULL,NULL),
 ('RTL-ROLE-HR-DIRECTOR','Direttore Risorse Umane',NULL,NULL),
 ('RTL-ROLE-HR-MANAGER','Responsabile Risorse Umane',NULL,NULL),
 ('RTL-ROLE-INVESTMENT-ADVISOR','Consulente Investimenti',NULL,NULL),
 ('RTL-ROLE-IT-DIRECTOR','Direttore IT e Digital',NULL,NULL),
 ('RTL-ROLE-LINE-MANAGER-OPERATIONS','Responsabile Operations',NULL,NULL),
 ('RTL-ROLE-OPERATIONS-DIRECTOR','Direttore Operations',NULL,NULL),
 ('RTL-ROLE-RETAIL-DIRECTOR','Direttore Retail Banking',NULL,NULL),
 ('RTL-ROLE-RISK-MANAGER','Responsabile Gestione Rischi',NULL,NULL),
 ('RTL-ROLE-SECURITIES-DEALER','Operatore Titoli',NULL,NULL),
 ('RTL-ROLE-SOFTWARE-DEVELOPER','Sviluppatore Software',NULL,NULL);
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_job_roles', j.job_role_id, to_jsonb(j) FROM sys.sys_job_roles j JOIN nome n ON n.codice=j.job_role_code AND j.job_role_tenant_id IS NULL
ON CONFLICT DO NOTHING;
UPDATE sys.sys_job_roles j SET job_role_name=n.nome,
  job_role_family_id=COALESCE(j.job_role_family_id,(SELECT job_family_id FROM sys.sys_job_families WHERE job_family_code=n.famiglia)),
  job_role_seniority_level=COALESCE(j.job_role_seniority_level,n.livello)
FROM nome n WHERE n.codice=j.job_role_code AND j.job_role_tenant_id IS NULL
  AND (j.job_role_name<>n.nome OR (j.job_role_family_id IS NULL AND n.famiglia IS NOT NULL) OR (j.job_role_seniority_level IS NULL AND n.livello IS NOT NULL));
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM sys.sys_positions p JOIN sys.sys_job_roles j ON j.job_role_id=p.position_job_role_id
   WHERE p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND (j.job_role_family_id IS NULL OR j.job_role_seniority_level IS NULL OR j.job_role_name=lower(j.job_role_name));
  IF n>0 THEN RAISE EXCEPTION 'E1/mansioni: % posti con mansione incompleta', n; END IF; END $$;
COMMIT;
SELECT 'E1 ok' esito, count(DISTINCT position_job_role_id) mansioni_usate FROM sys.sys_positions WHERE position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
