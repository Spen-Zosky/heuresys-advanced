-- ============================================================================================
-- 000509 — La corrispondenza delle attività con APQC, con il tipo dichiarato.
--          (ADR-0061 D7 «è_mappato_a», passo 4 del piano di attuazione §7)
--
-- IL FATTO. Le 131 attività di RTL Bank (000462, riempimento fuori catena db/scripts/attivita/)
-- vengono dalle fasi del datastore, che le prende dal catalogo APQC PCF Banking 8.0 (ADR-0049): il
-- codice APQC sta nei metadati dell'attività (`tenant_process_step_metadata->>'apqc'`). Che
-- l'attività corrisponda alla voce APQC ESATTAMENTE, o sia più ampia, più ristretta o parziale, oggi
-- non è scritto da nessuna parte: si presume esatto. ADR-0061 D7 vuole il tipo dichiarato, non presunto.
--
-- CHE COSA CREA. Solo un'aggiunta, nessun oggetto esistente toccato:
--   · `sys_tenant_process_step_mappings`: per un'attività e uno schema esterno (oggi solo APQC_PCF),
--     il codice esterno, il tipo di corrispondenza (ESATTO, PIU_AMPIO, PIU_RISTRETTO, PARZIALE), il
--     criterio con cui è dichiarato (obbligatorio), la fonte (PERSONA o AGENTE) e lo stato
--     (PROPOSTA o APPROVATA). Una sola corrispondenza per attività e schema.
--
-- I DATI. Nasce vuota: un'attività con il codice APQC nei metadati e senza riga qui è «da
-- dichiarare», ed è così che la pagina la mostra. Il tipo lo dichiara chi ha il potere dalla scheda
-- del processo, o l'agente come proposta. Nessun tipo presunto.
-- NESSUNA COLONNA NOMINA UNA PERSONA: l'autore lo scrive il registro di audit dell'API.
-- CLASSIFICAZIONE E REGISTRO: classificata in 000429 e registrata in 000062; vuota per ragione scritta
--   nell'elenco di storia36.
-- IDEMPOTENTE: IF NOT EXISTS, vincoli in forma DROP/ADD.
-- ROLLBACK DICHIARATO: DROP TABLE sys.sys_tenant_process_step_mappings; e le righe in 000429, 000062
--   e db/scripts/audit-storia36-empty-tables.txt.
-- ============================================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_tenant_process_step_mappings (
  tenant_process_step_mapping_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_process_step_mapping_tenant_id  uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  tenant_process_step_mapping_step_id    uuid NOT NULL REFERENCES sys.sys_tenant_process_steps(tenant_process_step_id) ON DELETE CASCADE,
  tenant_process_step_mapping_scheme     varchar(16) NOT NULL DEFAULT 'APQC_PCF',
  tenant_process_step_mapping_code       varchar(32) NOT NULL,
  tenant_process_step_mapping_kind       varchar(16) NOT NULL,
  tenant_process_step_mapping_criterion  text NOT NULL,
  tenant_process_step_mapping_source     varchar(8)  NOT NULL DEFAULT 'PERSONA',
  tenant_process_step_mapping_status     varchar(10) NOT NULL DEFAULT 'APPROVATA',
  created_at                             timestamptz NOT NULL DEFAULT now(),
  updated_at                             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sys.sys_tenant_process_step_mappings DROP CONSTRAINT IF EXISTS sys_tenant_process_step_mappings_scheme_check;
ALTER TABLE sys.sys_tenant_process_step_mappings ADD CONSTRAINT sys_tenant_process_step_mappings_scheme_check
  CHECK (tenant_process_step_mapping_scheme IN ('APQC_PCF'));
ALTER TABLE sys.sys_tenant_process_step_mappings DROP CONSTRAINT IF EXISTS sys_tenant_process_step_mappings_kind_check;
ALTER TABLE sys.sys_tenant_process_step_mappings ADD CONSTRAINT sys_tenant_process_step_mappings_kind_check
  CHECK (tenant_process_step_mapping_kind IN ('ESATTO','PIU_AMPIO','PIU_RISTRETTO','PARZIALE'));
ALTER TABLE sys.sys_tenant_process_step_mappings DROP CONSTRAINT IF EXISTS sys_tenant_process_step_mappings_source_check;
ALTER TABLE sys.sys_tenant_process_step_mappings ADD CONSTRAINT sys_tenant_process_step_mappings_source_check
  CHECK (tenant_process_step_mapping_source IN ('PERSONA','AGENTE'));
ALTER TABLE sys.sys_tenant_process_step_mappings DROP CONSTRAINT IF EXISTS sys_tenant_process_step_mappings_status_check;
ALTER TABLE sys.sys_tenant_process_step_mappings ADD CONSTRAINT sys_tenant_process_step_mappings_status_check
  CHECK (tenant_process_step_mapping_status IN ('PROPOSTA','APPROVATA'));
ALTER TABLE sys.sys_tenant_process_step_mappings DROP CONSTRAINT IF EXISTS sys_tenant_process_step_mappings_criterion_check;
ALTER TABLE sys.sys_tenant_process_step_mappings ADD CONSTRAINT sys_tenant_process_step_mappings_criterion_check
  CHECK (length(trim(tenant_process_step_mapping_criterion)) > 0);
CREATE UNIQUE INDEX IF NOT EXISTS sys_tenant_process_step_mappings_uq
  ON sys.sys_tenant_process_step_mappings (tenant_process_step_mapping_step_id, tenant_process_step_mapping_scheme);
CREATE INDEX IF NOT EXISTS sys_tenant_process_step_mappings_tenant_idx
  ON sys.sys_tenant_process_step_mappings (tenant_process_step_mapping_tenant_id);
COMMENT ON TABLE sys.sys_tenant_process_step_mappings IS
  'ADR-0061 D7 (000509): corrispondenza di un''attivita'' del tenant con una voce esterna (APQC PCF), con il tipo dichiarato, il criterio, la fonte e lo stato.';

-- Sentinella: una corrispondenza con il tenant diverso da quello dell'attività. Deve stare a zero.
CREATE OR REPLACE VIEW sys.v_tenant_process_step_mappings_defects AS
SELECT m.tenant_process_step_mapping_id AS riga, 'tenant diverso da quello dell''attivita''' AS difetto
  FROM sys.sys_tenant_process_step_mappings m
  JOIN sys.sys_tenant_process_steps s ON s.tenant_process_step_id = m.tenant_process_step_mapping_step_id
 WHERE s.tenant_process_step_tenant_id <> m.tenant_process_step_mapping_tenant_id;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_classificazione_direzione_dato WHERE tabella = 'sys_tenant_process_step_mappings';
  IF n <> 1 THEN RAISE EXCEPTION '000509: la tabella delle corrispondenze non e'' classificata in 000429 (%)', n; END IF;
  SELECT count(*) INTO n FROM sys.v_tenant_process_step_mappings_defects;
  IF n <> 0 THEN RAISE EXCEPTION '000509: % corrispondenze con il tenant sbagliato', n; END IF;
END $$;

COMMIT;
