-- ============================================================================
-- 000342 — #221 F3 (rilievo F7-02): la freschezza dei vettori si misura
--          dall'IMPRONTA del testo, non dalla data del calcolo.
--
-- IL RILIEVO E' SMENTITO, e la misura e' questa (2026-08-20, sul vivo):
--
--   SELECT count(*) FILTER (WHERE e.source_text_hash = <sha256 del testo attuale>)
--     FROM sys.sys_skill_embeddings e JOIN sys.sys_skills s USING (skill_id);
--   -> 14.036 su 14.036 combaciano. ZERO stantii.
--
-- Il dossier osservava che i vettori portano `min = max = 2026-06-06` mentre il
-- testo da cui derivano sarebbe cambiato dopo, e concludeva che la datazione non
-- e' tracciabilita'. La prima meta' e' vera — quel timestamp dice quando e'
-- girato il backfill, non a cosa si riferisce — ma la conclusione non segue: la
-- tracciabilita' NON e' mai stata la data. E' `source_text_hash`, popolata su
-- 14.036 righe su 14.036, con un solo modello (`voyage-4-lite`), e il codice la
-- usa gia' per saltare i ricalcoli inutili
-- (`apps/api/src/modules/semantic-matching/backfill.ts`, «salto per impronta» —
-- che il dossier stesso elenca fra i POSITIVI da conservare, §9).
--
-- PERCHE' ALLORA QUESTO FILE ESISTE. Perche' «oggi combaciano» e' una misura di
-- oggi, e il rilievo tornera' identico la prossima volta che qualcuno guarda le
-- date. Scrivere in un documento «verificato, stanno bene» sarebbe cristallizzare
-- una misura variabile — il difetto che IL PUNTO FISSO vieta. Si scrive invece
-- **il controllo che la produce**, e lo si mette dove viene interrogato da se'.
--
-- ⚠ UNA VISTA `sys.v_*` DIVENTA UNA SENTINELLA, AUTOMATICAMENTE. `db_health.py`
-- raccoglie le viste da `pg_views` e pretende che abbiano ZERO righe. Qui e'
-- esattamente il comportamento voluto: un vettore la cui impronta non combacia
-- piu' col suo testo E' un difetto, e deve far scattare la prova generale.
-- (Se servisse una vista che misura senza sorvegliare, andrebbe dichiarata
-- informativa — vedi la memoria `new_sys_view_becomes_sentinel`.)
--
-- LE TRE FORMULE non sono inventate qui: sono copiate dalle query che il modulo
-- `semantic-matching` usa per costruire il corpus, cosi' la sentinella misura
-- **la stessa cosa** che il backfill calcola. Se le due divergessero, la vista
-- segnalerebbe stantii che non esistono — un allarme che insegna a non guardarlo.
--   · skill     : btrim(nome || ' ' || descrizione)
--   · job role  : btrim(nome || ' ' || descrizione)
--   · occupazione ESCO : btrim(etichetta)
--
-- ROLLBACK DICHIARATO: nessun giornale, non si tocca alcun dato — e' una vista.
-- L'inversa e' `DROP VIEW sys.v_embedding_impronta_non_combacia`.
--
-- IDEMPOTENTE: `CREATE OR REPLACE VIEW`.
-- ============================================================================

CREATE OR REPLACE VIEW sys.v_embedding_impronta_non_combacia AS
  SELECT 'sys_skill_embeddings'::text        AS tabella,
         e.skill_id::text                    AS chiave,
         e.model_id,
         e.created_at                        AS calcolato_il
    FROM sys.sys_skill_embeddings e
    JOIN sys.sys_skills s ON s.skill_id = e.skill_id
   WHERE e.source_text_hash IS DISTINCT FROM
         encode(sha256(convert_to(
           btrim(coalesce(s.skill_name, '') || ' ' || coalesce(s.skill_description, '')),
           'UTF8')), 'hex')

  UNION ALL

  SELECT 'sys_job_role_embeddings',
         e.job_role_id::text,
         e.model_id,
         e.created_at
    FROM sys.sys_job_role_embeddings e
    JOIN sys.sys_job_roles r ON r.job_role_id = e.job_role_id
   WHERE e.source_text_hash IS DISTINCT FROM
         encode(sha256(convert_to(
           btrim(coalesce(r.job_role_name, '') || ' ' || coalesce(r.job_role_description, '')),
           'UTF8')), 'hex')

  UNION ALL

  -- L'embedding delle occupazioni e' chiavato per URI, e piu' righe di mapping
  -- possono portare lo stesso URI: il corpus ne prende UNA sola
  -- (`DISTINCT ON ... ORDER BY uri`). La sentinella deve fare lo stesso, o
  -- confronterebbe l'impronta con l'etichetta di una riga diversa da quella che
  -- il backfill ha usato, e griderebbe al falso stantio.
  SELECT 'sys_esco_occupation_embeddings',
         e.esco_uri,
         e.model_id,
         e.created_at
    FROM sys.sys_esco_occupation_embeddings e
    JOIN LATERAL (
      SELECT btrim(coalesce(m.esco_occupation_mapping_esco_label, '')) AS testo
        FROM sys.sys_esco_occupation_mappings m
       WHERE m.esco_occupation_mapping_esco_uri = e.esco_uri
         AND m.esco_occupation_mapping_esco_label IS NOT NULL
         AND btrim(m.esco_occupation_mapping_esco_label) <> ''
       ORDER BY m.esco_occupation_mapping_esco_uri
       LIMIT 1
    ) c ON true
   WHERE e.source_text_hash IS DISTINCT FROM
         encode(sha256(convert_to(c.testo, 'UTF8')), 'hex');

COMMENT ON VIEW sys.v_embedding_impronta_non_combacia IS
  'SENTINELLA (#221 F3, rilievo F7-02): vettori la cui impronta non combacia piu'' col testo da cui derivano. Zero righe = tutti allineati. La freschezza si misura dall''impronta, non da created_at, che dice solo quando e'' girato il backfill.';

-- ---------------------------------------------------------------------------
-- POST-CONDIZIONE. Due controlli, e il secondo e' quello che conta.
--
-- Il primo dice che oggi non ci sono vettori stantii. Il secondo verifica che
-- la sentinella SAPPIA VEDERE: una vista che non trova mai nulla perche' il suo
-- JOIN non aggancia niente sarebbe verde per sempre, ed e' il modo piu' comune
-- in cui un presidio diventa decorativo. Se il numero di vettori confrontati
-- fosse zero, questa vista misurerebbe se stessa.
-- ---------------------------------------------------------------------------
DO $$
DECLARE stantii int; confrontati int;
BEGIN
  SELECT count(*) INTO stantii FROM sys.v_embedding_impronta_non_combacia;

  SELECT (SELECT count(*) FROM sys.sys_skill_embeddings e
           JOIN sys.sys_skills s ON s.skill_id = e.skill_id)
       + (SELECT count(*) FROM sys.sys_job_role_embeddings e
           JOIN sys.sys_job_roles r ON r.job_role_id = e.job_role_id)
    INTO confrontati;

  IF confrontati = 0 THEN
    RAISE EXCEPTION '000342: la sentinella non confronta nulla — i JOIN non agganciano, sarebbe verde per costruzione';
  END IF;

  IF stantii > 0 THEN
    RAISE EXCEPTION '000342: % vettori con impronta non combaciante — vanno ricalcolati prima di installare la sentinella', stantii;
  END IF;

  RAISE NOTICE '000342 ok — 0 vettori stantii su % confrontati; la freschezza ora si misura da se''', confrontati;
END $$;
