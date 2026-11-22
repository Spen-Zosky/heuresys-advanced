-- ============================================================================================
-- 000507 — Le faccette dei processi: come si classifica un processo del tenant.
--          (ADR-0061 D4, passo 2 del piano di attuazione §7; accettato da Enzo il 2026-11-22)
--
-- IL FATTO. La gerarchia (dominio, famiglia, processo, attivita', compito) dice dove sta un processo;
-- non dice per chi lavora, come parte, quanto e' automatizzato, se e' comune o specifico. ADR-0061 D4
-- chiede dimensioni INDIPENDENTI, a vocabolario chiuso, con piu' valori quando serve, e ogni valore
-- con il criterio applicato e la fonte.
--
-- CHE COSA CREA. Solo aggiunte, nessun oggetto esistente toccato:
--   · `sys_process_facet_values`: il vocabolario chiuso delle sette faccette a valori enumerabili di D4
--     (finalita', beneficiario, perimetro, modalita' di lavoro, attivazione, partecipazione
--     tecnologica, standardizzazione), con codice stabile, nome e spiegazione in italiano e inglese.
--     E' un catalogo di piattaforma (infrastruttura): lo stato e' dichiarato qui e ci si porta a ogni
--     applicazione (INSERT ... ON CONFLICT DO UPDATE), aperto a tutte le industrie (I21).
--     Le faccette a riferimento esterno (dominio funzionale, applicabilita', criticita', ripetitivita')
--     non stanno qui: hanno scale proprie e criteri espliciti (regola sulla criticita' di D4) e
--     arrivano ciascuna con un caso reale.
--   · `sys_tenant_process_facets`: il valore di una faccetta per un processo del tenant, con il
--     criterio con cui e' stato assegnato (obbligatorio), la fonte (PERSONA o AGENTE) e lo stato
--     (PROPOSTA dell'agente, APPROVATA da chi ha il potere). Piu' valori per faccetta quando servono
--     (un processo con beneficiari interni ed esterni). Gli agenti propongono, un umano decide (§6).
--
-- I DATI. Il vocabolario nasce pieno (26 valori). Le classificazioni nascono vuote: le scrive chi ha
-- il potere dalla scheda del processo, o l'agente come proposta. Nessuna classificazione inventata.
-- NESSUNA COLONNA NOMINA UNA PERSONA: l'autore lo scrive il registro di audit dell'API.
-- CLASSIFICAZIONE E REGISTRO: tabelle classificate in 000429 e registrate in 000062 (file di numero
--   minore, emendati come per la 000503); la tabella delle classificazioni e' vuota per ragione scritta
--   nell'elenco di storia36.
-- IDEMPOTENTE: IF NOT EXISTS, vincoli in forma DROP/ADD, vocabolario per upsert.
-- ROLLBACK DICHIARATO (solo su tabelle vuote o con il loro contenuto, elenco esplicito):
--   DROP TABLE sys.sys_tenant_process_facets, sys.sys_process_facet_values;
--   e le righe in 000429, 000062 e db/scripts/audit-storia36-empty-tables.txt.
-- ============================================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_process_facet_values (
  process_facet_value_facet        varchar(24) NOT NULL,
  process_facet_value_code         varchar(32) NOT NULL,
  process_facet_value_ordinal      smallint    NOT NULL,
  process_facet_value_label_it     varchar(120) NOT NULL,
  process_facet_value_label_en     varchar(120) NOT NULL,
  process_facet_value_description_it text NOT NULL,
  process_facet_value_description_en text NOT NULL,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_process_facet_values_pk PRIMARY KEY (process_facet_value_facet, process_facet_value_code)
);
ALTER TABLE sys.sys_process_facet_values DROP CONSTRAINT IF EXISTS sys_process_facet_values_facet_check;
ALTER TABLE sys.sys_process_facet_values ADD CONSTRAINT sys_process_facet_values_facet_check
  CHECK (process_facet_value_facet IN ('FINALITA','BENEFICIARIO','PERIMETRO','MODALITA','ATTIVAZIONE','TECNOLOGIA','STANDARDIZZAZIONE'));
COMMENT ON TABLE sys.sys_process_facet_values IS
  'ADR-0061 D4 (000507): vocabolario chiuso delle faccette dei processi, catalogo di piattaforma.';

INSERT INTO sys.sys_process_facet_values AS v
  (process_facet_value_facet, process_facet_value_code, process_facet_value_ordinal,
   process_facet_value_label_it, process_facet_value_label_en, process_facet_value_description_it, process_facet_value_description_en)
VALUES
  ('FINALITA','GOVERNO',1,'Governo e indirizzo','Governance and direction','Il processo decide dove va l''azienda e come la si controlla.','The process decides where the company goes and how it is controlled.'),
  ('FINALITA','VALORE',2,'Realizzazione del valore','Value delivery','Il processo produce ciò per cui il cliente paga.','The process produces what the customer pays for.'),
  ('FINALITA','SUPPORTO',3,'Supporto','Support','Il processo rende possibili gli altri processi.','The process makes the other processes possible.'),
  ('BENEFICIARIO','CLIENTE_ESTERNO',1,'Cliente esterno','External customer','Chi riceve il risultato è un cliente dell''azienda.','The result goes to a customer of the company.'),
  ('BENEFICIARIO','CLIENTE_INTERNO',2,'Cliente interno','Internal customer','Chi riceve il risultato è una persona o un''unità dell''azienda.','The result goes to a person or unit of the company.'),
  ('BENEFICIARIO','PARTNER',3,'Partner','Partner','Chi riceve il risultato è un fornitore o un partner.','The result goes to a supplier or partner.'),
  ('BENEFICIARIO','AUTORITA',4,'Autorità','Authority','Chi riceve il risultato è un''autorità di vigilanza o pubblica.','The result goes to a supervisory or public authority.'),
  ('BENEFICIARIO','ALTRI',5,'Altri portatori di interesse','Other stakeholders','Azionisti, comunità, sindacati o altri portatori di interesse.','Shareholders, community, unions or other stakeholders.'),
  ('PERIMETRO','INTERNO_UNITA',1,'Interno a un''unità','Within one unit','Il processo si svolge dentro una sola unità.','The process runs inside a single unit.'),
  ('PERIMETRO','INTERFUNZIONALE',2,'Interfunzionale','Cross-functional','Il processo attraversa più unità dell''azienda.','The process crosses several units of the company.'),
  ('PERIMETRO','INTERAZIENDALE',3,'Interaziendale','Inter-company','Il processo coinvolge altre aziende.','The process involves other companies.'),
  ('MODALITA','FLUSSO',1,'Flusso prescritto','Prescribed flow','I passi e il loro ordine sono stabiliti prima.','Steps and their order are set in advance.'),
  ('MODALITA','CASO',2,'Gestione di caso','Case management','Chi lavora sceglie i passi caso per caso.','Whoever works chooses the steps case by case.'),
  ('MODALITA','IBRIDA',3,'Ibrida','Hybrid','Una parte è un flusso prescritto, una parte si decide caso per caso.','Part is a prescribed flow, part is decided case by case.'),
  ('ATTIVAZIONE','EVENTO',1,'Evento','Event','Il processo parte quando accade qualcosa.','The process starts when something happens.'),
  ('ATTIVAZIONE','CALENDARIO',2,'Calendario','Calendar','Il processo parte a date stabilite.','The process starts on set dates.'),
  ('ATTIVAZIONE','RICHIESTA',3,'Richiesta','Request','Il processo parte quando qualcuno lo chiede.','The process starts when someone asks for it.'),
  ('ATTIVAZIONE','SOGLIA',4,'Condizione o soglia','Condition or threshold','Il processo parte quando una misura supera una soglia.','The process starts when a measure crosses a threshold.'),
  ('TECNOLOGIA','MANUALE',1,'Manuale','Manual','Il lavoro è svolto da persone senza strumenti che lo guidino.','Work is done by people without tools guiding it.'),
  ('TECNOLOGIA','ASSISTITA',2,'Assistita','Assisted','Le persone lavorano con strumenti o agenti che le aiutano.','People work with tools or agents that help them.'),
  ('TECNOLOGIA','AUTOMATIZZATA',3,'Automatizzata','Automated','Il lavoro è svolto da sistemi o agenti; le persone decidono le eccezioni.','Work is done by systems or agents; people decide exceptions.'),
  ('TECNOLOGIA','MISTA',4,'Mista','Mixed','Alcune attività sono manuali, altre assistite o automatizzate.','Some activities are manual, others assisted or automated.'),
  ('STANDARDIZZAZIONE','COMUNE',1,'Comune','Common','Uguale in ogni azienda e settore.','The same in every company and sector.'),
  ('STANDARDIZZAZIONE','PARAMETRIZZABILE',2,'Parametrizzabile','Configurable','Uguale nella struttura, cambia solo nei parametri.','Same structure, only parameters change.'),
  ('STANDARDIZZAZIONE','VARIANTE_SETTORE',3,'Variante di settore','Sector variant','La struttura cambia per il settore (per esempio il credito).','The structure changes for the sector (for example banking).'),
  ('STANDARDIZZAZIONE','SPECIFICO',4,'Specifico dell''azienda','Company-specific','Esiste solo in questa azienda.','Exists only in this company.')
ON CONFLICT (process_facet_value_facet, process_facet_value_code) DO UPDATE SET
  process_facet_value_ordinal = EXCLUDED.process_facet_value_ordinal,
  process_facet_value_label_it = EXCLUDED.process_facet_value_label_it,
  process_facet_value_label_en = EXCLUDED.process_facet_value_label_en,
  process_facet_value_description_it = EXCLUDED.process_facet_value_description_it,
  process_facet_value_description_en = EXCLUDED.process_facet_value_description_en,
  updated_at = now()
WHERE (v.process_facet_value_ordinal, v.process_facet_value_label_it, v.process_facet_value_label_en,
       v.process_facet_value_description_it, v.process_facet_value_description_en)
  IS DISTINCT FROM (EXCLUDED.process_facet_value_ordinal, EXCLUDED.process_facet_value_label_it, EXCLUDED.process_facet_value_label_en,
       EXCLUDED.process_facet_value_description_it, EXCLUDED.process_facet_value_description_en);

CREATE TABLE IF NOT EXISTS sys.sys_tenant_process_facets (
  tenant_process_facet_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_process_facet_tenant_id   uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  tenant_process_facet_process_id  uuid NOT NULL REFERENCES sys.sys_tenant_processes(tenant_process_id) ON DELETE CASCADE,
  tenant_process_facet_facet       varchar(24) NOT NULL,
  tenant_process_facet_value_code  varchar(32) NOT NULL,
  tenant_process_facet_criterion   text NOT NULL,
  tenant_process_facet_source      varchar(8)  NOT NULL DEFAULT 'PERSONA',
  tenant_process_facet_status      varchar(10) NOT NULL DEFAULT 'APPROVATA',
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_tenant_process_facets_value_fk FOREIGN KEY (tenant_process_facet_facet, tenant_process_facet_value_code)
    REFERENCES sys.sys_process_facet_values (process_facet_value_facet, process_facet_value_code) ON DELETE RESTRICT
);
ALTER TABLE sys.sys_tenant_process_facets DROP CONSTRAINT IF EXISTS sys_tenant_process_facets_source_check;
ALTER TABLE sys.sys_tenant_process_facets ADD CONSTRAINT sys_tenant_process_facets_source_check
  CHECK (tenant_process_facet_source IN ('PERSONA','AGENTE'));
ALTER TABLE sys.sys_tenant_process_facets DROP CONSTRAINT IF EXISTS sys_tenant_process_facets_status_check;
ALTER TABLE sys.sys_tenant_process_facets ADD CONSTRAINT sys_tenant_process_facets_status_check
  CHECK (tenant_process_facet_status IN ('PROPOSTA','APPROVATA'));
ALTER TABLE sys.sys_tenant_process_facets DROP CONSTRAINT IF EXISTS sys_tenant_process_facets_criterion_check;
ALTER TABLE sys.sys_tenant_process_facets ADD CONSTRAINT sys_tenant_process_facets_criterion_check
  CHECK (length(trim(tenant_process_facet_criterion)) > 0);
CREATE UNIQUE INDEX IF NOT EXISTS sys_tenant_process_facets_value_uq
  ON sys.sys_tenant_process_facets (tenant_process_facet_process_id, tenant_process_facet_facet, tenant_process_facet_value_code);
CREATE INDEX IF NOT EXISTS sys_tenant_process_facets_tenant_idx ON sys.sys_tenant_process_facets (tenant_process_facet_tenant_id);
COMMENT ON TABLE sys.sys_tenant_process_facets IS
  'ADR-0061 D4 (000507): valori delle faccette di un processo del tenant, con criterio, fonte (PERSONA/AGENTE) e stato (PROPOSTA/APPROVATA).';

-- Sentinella: una faccetta di un processo di un altro tenant. Deve stare a zero.
CREATE OR REPLACE VIEW sys.v_tenant_process_facets_defects AS
SELECT f.tenant_process_facet_id AS riga, 'tenant diverso da quello del processo' AS difetto
  FROM sys.sys_tenant_process_facets f
  JOIN sys.sys_tenant_processes p ON p.tenant_process_id = f.tenant_process_facet_process_id
 WHERE p.tenant_process_tenant_id <> f.tenant_process_facet_tenant_id;

-- Post-condizione: vocabolario completo, tabelle classificate (I23).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_process_facet_values;
  IF n <> 26 THEN RAISE EXCEPTION '000507: attesi 26 valori di faccetta, trovati %', n; END IF;
  SELECT count(*) INTO n FROM sys.sys_classificazione_direzione_dato
   WHERE tabella IN ('sys_process_facet_values','sys_tenant_process_facets');
  IF n <> 2 THEN RAISE EXCEPTION '000507: le tabelle delle faccette non sono classificate in 000429 (%)', n; END IF;
  SELECT count(*) INTO n FROM sys.v_tenant_process_facets_defects;
  IF n <> 0 THEN RAISE EXCEPTION '000507: % faccette con il tenant sbagliato', n; END IF;
END $$;

COMMIT;
