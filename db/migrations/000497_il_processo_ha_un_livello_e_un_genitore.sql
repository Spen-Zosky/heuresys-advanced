-- ============================================================================
-- 000497 — Il processo del tenant ha un livello e un genitore (piano
--          docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md, voce V2)
--
-- IL PROBLEMA. Misurato il 2026-11-18 in produzione: RTL Bank ha 42 processi attivi, ma sono due
-- elenchi sovrapposti. 21 sono i processi unici del catalogo approvato da Enzo il 2026-11-10/11
-- (codici 00-22, con responsabile, unita' e attivita'); 21 sono i processi P01-P30 del prototipo,
-- adottati dal consolidamento il 2026-11-17 come processi alla pari, senza responsabile, unita' ne'
-- attivita'. Le pagine contano ora gli uni ora gli altri.
--
-- DECISIONE. Enzo, 2026-11-18 03:43 di Roma (scheda di decisione del thread «Rendere sistematici
-- processi e progetti»): i P sono sottoprocessi dei processi unici. Il catalogo dei 21 processi unici
-- dice gia' quale processo accorpa quale (documento «Agente esperto bancario», 2026-11-10).
--
-- COSA FA. Due colonne su sys_tenant_processes:
--   tenant_process_parent_id  il processo di primo livello che contiene questo, nullo al primo livello;
--   tenant_process_level      1 (processo) o 2 (sottoprocesso), coerente con il genitore.
-- Una sentinella sys.v_tenant_processes_parent_defects, che deve stare a zero: genitore di un altro
-- tenant, genitore che e' a sua volta un sottoprocesso, processo genitore di se stesso.
--
-- NON FA. Non colloca nessun processo: le colonne nascono a livello 1 e senza genitore. La collocazione
-- e' fuori catena (db/scripts/processi/colloca-sottoprocessi.sql), con giornale e inversa.
-- POST-CONDIZIONE: righe e impronta di sys_tenant_processes invariate, tranne le colonne nuove.
-- IDEMPOTENTE: IF NOT EXISTS ovunque, vincoli solo se assenti. Authored: 2026-11-18.
-- ============================================================================
BEGIN;

DO $$
DECLARE v_n bigint; v_h text; w_n bigint; w_h text;
BEGIN
  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'tenant_process_parent_id' - 'tenant_process_level')::text, '|' ORDER BY t.tenant_process_id)), '')
    INTO v_n, v_h FROM sys.sys_tenant_processes t;

  ALTER TABLE sys.sys_tenant_processes ADD COLUMN IF NOT EXISTS tenant_process_parent_id uuid;
  ALTER TABLE sys.sys_tenant_processes ADD COLUMN IF NOT EXISTS tenant_process_level smallint NOT NULL DEFAULT 1;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tenant_processes_parent_fk') THEN
    ALTER TABLE sys.sys_tenant_processes ADD CONSTRAINT sys_tenant_processes_parent_fk
      FOREIGN KEY (tenant_process_parent_id) REFERENCES sys.sys_tenant_processes(tenant_process_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tenant_processes_level_ck') THEN
    ALTER TABLE sys.sys_tenant_processes ADD CONSTRAINT sys_tenant_processes_level_ck
      CHECK ((tenant_process_level = 1 AND tenant_process_parent_id IS NULL)
          OR (tenant_process_level = 2 AND tenant_process_parent_id IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tenant_processes_not_own_parent_ck') THEN
    ALTER TABLE sys.sys_tenant_processes ADD CONSTRAINT sys_tenant_processes_not_own_parent_ck
      CHECK (tenant_process_parent_id IS NULL OR tenant_process_parent_id <> tenant_process_id);
  END IF;
  CREATE INDEX IF NOT EXISTS sys_tenant_processes_parent_idx ON sys.sys_tenant_processes (tenant_process_parent_id);

  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'tenant_process_parent_id' - 'tenant_process_level')::text, '|' ORDER BY t.tenant_process_id)), '')
    INTO w_n, w_h FROM sys.sys_tenant_processes t;
  IF w_n <> v_n OR w_h <> v_h THEN RAISE EXCEPTION '000497: i processi del tenant sono cambiati (% -> % righe)', v_n, w_n; END IF;
  RAISE NOTICE '000497: livello e genitore presenti; % processi invariati.', v_n;
END $$;

COMMENT ON COLUMN sys.sys_tenant_processes.tenant_process_parent_id IS
  '000497 — il processo di primo livello che contiene questo sottoprocesso; nullo per un processo di primo livello.';
COMMENT ON COLUMN sys.sys_tenant_processes.tenant_process_level IS
  '000497 — 1 processo, 2 sottoprocesso. Le pagine contano «Processi» al livello 1 e i sottoprocessi dentro il loro processo.';

-- Sentinella: deve stare a zero.
CREATE OR REPLACE VIEW sys.v_tenant_processes_parent_defects AS
SELECT c.tenant_process_id AS riga, 'genitore di un altro tenant' AS difetto
  FROM sys.sys_tenant_processes c JOIN sys.sys_tenant_processes p ON p.tenant_process_id = c.tenant_process_parent_id
 WHERE p.tenant_process_tenant_id <> c.tenant_process_tenant_id
UNION ALL
SELECT c.tenant_process_id, 'il genitore e'' a sua volta un sottoprocesso'
  FROM sys.sys_tenant_processes c JOIN sys.sys_tenant_processes p ON p.tenant_process_id = c.tenant_process_parent_id
 WHERE p.tenant_process_level <> 1;

COMMIT;
