-- 000098_content_fulltext_search.sql
-- cap④ CMS P3 — full-text search over content documents.
--
-- Adds a STORED generated tsvector (title weighted 'A', body weighted 'B') + a GIN index,
-- so search is index-backed and always in sync with the row (no triggers, no app upkeep).
-- Config 'simple' (no stemming) is deliberate: the corpus is mixed IT+EN, where a single
-- language stemmer would mis-stem the other language. websearch_to_tsquery('simple', q) at
-- query time gives users familiar quote/OR/-term syntax. Idempotent (ADD COLUMN/INDEX IF NOT
-- EXISTS); the generated column backfills existing rows automatically.
--
-- to_tsvector(regconfig, text) + setweight + || are all IMMUTABLE → valid in a GENERATED column.

ALTER TABLE sys.sys_content_documents
  ADD COLUMN IF NOT EXISTS document_search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(document_title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(document_body, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS sys_content_documents_tsv_idx
  ON sys.sys_content_documents USING GIN (document_search_tsv);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'sys' AND table_name = 'sys_content_documents'
    AND column_name = 'document_search_tsv';
  IF n <> 1 THEN
    RAISE EXCEPTION 'cap④ P3: document_search_tsv column not created (got %)', n;
  END IF;
  RAISE NOTICE 'cap④ P3: content full-text search tsvector + GIN index ready.';
END $$;
