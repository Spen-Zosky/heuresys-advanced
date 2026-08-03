-- 000242_declare_tenant_industries.sql
--
-- Dichiarazione dell'industry dei due tenant di produzione, ancorata alla
-- tassonomia ATECO invece che a un codice inventato.
--
-- PRINCIPIO (Enzo, 2026-08-03): i dati che DERIVANO dall'industry del tenant
-- devono essere coerenti con essa — Consulenza Direzionale per Heuresys,
-- Banche e Assicurazioni per RTL Bank. Le tabelle che definiscono TASSONOMIE e
-- ONTOLOGIE (Industry, ESCO, ISCO, NACE, ATECO, modelli operativi, CCNL)
-- restano invece **aperte a ogni tipologia di tenant**: senza di esse non si
-- potrebbero piu' creare nuovi blueprint, nuovi tenant, nuove strutture
-- organizzative, nuovi processi. Il criterio che ne discende e' strutturale:
-- un dato CON `tenant_id` deve essere coerente con l'industry di quel tenant;
-- un dato GLOBALE e' materiale generativo e resta aperto.
--
-- Verifica condotta prima di scrivere questa migrazione (2026-08-03):
--   · scansione di tutte le tabelle `sys` dotate di `tenant_id`, alla ricerca
--     di marcatori di industry estranee (alimentare, energia, manifattura,
--     retail, sanita'): **nessun dato per-tenant incoerente**;
--   · le 37 competenze e i 2 KPI di settore intercettati (`HACCP-COMPLIANCE`,
--     `ENERGY-SAVINGS`) sono tutti GLOBALI — materiale generativo, non dati di
--     un tenant: restano, ed e' la stessa distinzione per cui la 000235 rimosse
--     `BP-SF-*` (che nominava SmartFood) e non questi;
--   · i dati di Heuresys sono gia' coerenti con la consulenza: CEO & Founder,
--     COO, Head of Product; unita' Corporate / Operations / Product & Development.
--
-- L'UNICA incoerenza trovata e' dichiarativa: `tenant_industry_code` era NULL
-- su Heuresys, e il metadato diceva "HR Technology & Software" invece della
-- consulenza direzionale. RTL Bank era gia' completa (`FIN_BANKING`).
--
-- I riferimenti ATECO sono presi dalla tassonomia viva, non scritti a memoria:
--   70.20  Consulenza imprenditoriale e altre attivita' di consulenza gestionale
--   64.19  Altre intermediazioni monetarie
BEGIN;

DO $$
DECLARE
  v_ateco_consulenza text := '70.20';
  v_ateco_banca      text := '64.19';
BEGIN
  -- Le due voci devono esistere nella tassonomia: se un domani lo schema ATECO
  -- venisse ricaricato con una codifica diversa, meglio fermarsi che scrivere
  -- nei metadati un riferimento che non risolve.
  IF NOT EXISTS (SELECT 1 FROM sys.sys_activity_classifications
                  WHERE activity_classification_code = v_ateco_consulenza)
     OR NOT EXISTS (SELECT 1 FROM sys.sys_activity_classifications
                     WHERE activity_classification_code = v_ateco_banca) THEN
    RAISE EXCEPTION
      '000242: le voci ATECO % e % non sono entrambe nella tassonomia: '
      'l''ancoraggio dell''industry non e'' verificabile.',
      v_ateco_consulenza, v_ateco_banca;
  END IF;

  UPDATE sys.sys_tenancies
     SET tenant_industry_code = 'MGMT_CONSULTING',
         tenant_metadata = tenant_metadata
           || jsonb_build_object('industry', 'Consulenza Direzionale',
                                 'ateco_code', v_ateco_consulenza),
         updated_at = now()
   WHERE tenant_code = 'HEURESYS';

  -- RTL Bank ha gia' il codice industry: qui si aggiunge solo l'ancora ATECO,
  -- cosi' entrambi i tenant sono agganciati alla stessa tassonomia e non a due
  -- vocabolari paralleli.
  UPDATE sys.sys_tenancies
     SET tenant_metadata = tenant_metadata
           || jsonb_build_object('industry', 'Banche e Assicurazioni',
                                 'ateco_code', v_ateco_banca),
         updated_at = now()
   WHERE tenant_code = 'RTL_BANK';
END $$;

COMMIT;
