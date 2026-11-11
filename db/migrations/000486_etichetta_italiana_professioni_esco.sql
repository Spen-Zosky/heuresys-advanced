-- 000486: etichetta italiana delle professioni ESCO negli abbinamenti (voce 8, mandato RTL 2026-11-11).
-- La colonna esco_occupation_mapping_esco_label_it e' popolata da db/scripts/rtl-allinea/F_etichette_esco_it.sh dal datastore (sola lettura).
-- Idempotente, non distruttiva: aggiunge una colonna.
ALTER TABLE sys.sys_esco_occupation_mappings
  ADD COLUMN IF NOT EXISTS esco_occupation_mapping_esco_label_it varchar(300);
COMMENT ON COLUMN sys.sys_esco_occupation_mappings.esco_occupation_mapping_esco_label_it
  IS 'Etichetta preferita in italiano della professione ESCO, caricata dal datastore; l''interfaccia la mostra al posto di esco_label (inglese).';
