-- 000221_visualization_export_payload.sql
--
-- #36 (linea B5) — l'export delle visualizzazioni diventa un contenuto, non un
-- promemoria.
--
-- Com'era: `sys.sys_visualization_exports` registrava CHE un export era stato
-- chiesto (formato, grafo, layout, data) e null'altro. L'unico riferimento al
-- contenuto era `export_payload_uri`, e le 3 righe presenti puntano a
-- `storage://rtl/organigramma/...` — un archivio che non esiste in nessun
-- ambiente. Chiedere un export produceva una riga; scaricarlo era impossibile.
--
-- Cosa cambia: il contenuto renderizzato vive qui, accanto al suo record.
--
--   export_payload       il documento vero e proprio (SVG, Mermaid, JSON: sono
--                        tutti testo). Resta NULL per i formati binari, che
--                        oggi il motore non produce.
--   export_content_type  il MIME con cui il download si presenta al browser.
--   export_byte_size     la dimensione in byte del payload, misurata alla
--                        generazione — così la lista degli export mostra un
--                        peso reale senza dover leggere il documento.
--
-- Perché nel database e non su disco: il payload di un grafo è testo
-- dell'ordine dei KB, il runtime è già su PostgreSQL nativo (I13) e un
-- filesystem condiviso fra API, VM e linux-pc semplicemente non c'è.
-- `export_payload_uri` resta al suo posto per un eventuale storage esterno
-- futuro: le due strade non si escludono.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.

ALTER TABLE sys.sys_visualization_exports
  ADD COLUMN IF NOT EXISTS export_payload text,
  ADD COLUMN IF NOT EXISTS export_content_type varchar(128),
  ADD COLUMN IF NOT EXISTS export_byte_size integer;

COMMENT ON COLUMN sys.sys_visualization_exports.export_payload IS
  'Documento renderizzato (testo: SVG/Mermaid/JSON). NULL per i formati binari non ancora prodotti dal motore.';
COMMENT ON COLUMN sys.sys_visualization_exports.export_content_type IS
  'MIME type con cui il download viene servito.';
COMMENT ON COLUMN sys.sys_visualization_exports.export_byte_size IS
  'Dimensione in byte del payload, misurata alla generazione.';
