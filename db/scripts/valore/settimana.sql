-- db/scripts/valore/settimana.sql — F0-3, il test del valore come misura.
--
-- Per tenant e per settimana (lunedì, ora di Roma): le decisioni tracciabili, chi le ha
-- prese, su quanti oggetti, e quante persone hanno usato pagine o agenti. Sola lettura.
-- La definizione di «decisione tracciabile» è una sola: sys.v_valore_decisioni_tracciabili
-- (migrazione 000470). Uso:
--   psql -v ON_ERROR_STOP=1 -v tenant="'rtl-bank'" -f db/scripts/valore/settimana.sql
-- Senza -v tenant restituisce tutti i tenant.
\if :{?tenant}
\else
\set tenant NULL
\endif
SELECT tenant_codice, settimana, decisioni_tracciabili, da_persona, da_agente,
       decisori_distinti, oggetti_decisi, tipi_di_decisione, decisioni_senza_traccia,
       persone_attive, usi_orari
  FROM sys.v_valore_settimana
 WHERE :tenant::text IS NULL OR tenant_codice = :tenant::text
 ORDER BY tenant_codice, settimana DESC;
