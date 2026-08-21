-- ============================================================================
-- 000351 — #222 F7 (rilievo F6-09): le evidenze di una competenza stavano su
--          DUE righe, e chi le contava ne vedeva un quarto.
--
-- IL DIFETTO, misurato il 2026-08-21 sul vivo (i numeri del dossier erano di
-- due giorni prima e li ho ri-misurati, non ereditati). In tutto il catalogo da
-- 14.036 competenze ci sono TRE nomi duplicati — «adattabilita'»,
-- «comunicazione», «problem solving» — e tutti e tre sono la stessa forma:
--
--   riga A (globale)  skill_tenant_id NULL · skill_code 'ESCO::<uuid>'
--                     · skill_kind valorizzato · nata nov-dic 2025
--   riga B (RTL Bank) skill_tenant_id RTL   · skill_code 'COMP::<uuid>'
--                     · skill_kind NULL · skill_esco_uri NULL · nata 2026-02-25
--
-- Le B vengono dal brownfield: `000161` rinomina `OLDDB::competencies::<id>` in
-- `COMP::<id>`, quindi quel prefisso E' il marchio dell'ingestione legacy. Non
-- sono personalizzazioni di un tenant: sono lo stesso concetto entrato due
-- volte da due porte.
--
-- PERCHE' NON LE AVEVA GIA' PRESE `000189`. Quella dedup lavora per
-- (tenant, nome) e sigilla con un UNIQUE su `(COALESCE(tenant,nil), lower(trim
-- (name)))`. Due righe con lo STESSO nome ma tenant DIVERSO non violano quel
-- vincolo — sono esattamente il caso che l'indice non copre, ed e' per questo
-- che sono sopravvissute a una migrazione fatta apposta per toglierle.
--
-- QUANTO COSTA IL DIFETTO, misurato riga per riga sulle 11 tabelle che
-- referenziano `sys_skills`:
--
--       tabella                          sulla A (globale)   sulla B (tenant)
--       sys_user_skills                          26                 81
--       sys_position_skill_requirements          16                 94
--       sys_user_skill_evidence                  26                  0
--       sys_occupation_skill_requirements        26                  0
--       sys_skill_taxonomy_edges                 14                  0
--       sys_skill_embeddings                      3                  3
--       sys_mentor_match_scores                   1                  0
--
-- Centosette competenze di persone e centodieci requisiti di posizione, divisi
-- fra due righe che dicono la stessa cosa. Un'analisi dei divari che parte
-- dalla riga globale vede 26 persone invece di 107: non e' un'imprecisione
-- estetica, e' un numero sbagliato in una schermata che qualcuno legge.
--
-- LE COLLISIONI, MISURATE PRIMA E NON SUPPOSTE. Ripuntare la B sulla A crea un
-- duplicato dove la stessa persona (o la stessa posizione) ha entrambe:
--   · sys_user_skills UNIQUE(user,skill)        ->  4 collisioni su 81
--   · sys_position_skill_requirements UNIQ(p,s) ->  5 collisioni su 94
--   · sys_skill_embeddings UNIQUE(skill)        ->  3 su 3 (una per coppia)
-- In TUTTI E NOVE i casi la riga globale e' la piu' alta o la piu' severa:
--   user_skills          COMPETENT vs PROFICIENT, PROFICIENT vs EXPERT (x3)
--   position_requirements PROFICIENT vs EXPERT, peso 0,600 vs 1,000,
--                         criticita' HIGH vs CRITICAL (tutte e cinque)
-- Percio' assorbire la riga di tenant nella globale non perde informazione: la
-- conserva al livello superiore. Se un domani la riga di tenant fosse la piu'
-- alta, questa migrazione la assorbirebbe comunque — ed e' la ragione per cui
-- il giornale di annullamento qui sotto non e' un ornamento.
--
-- ⛔ QUESTO FILE NON BASTA DA SOLO, e va detto qui perche' chi legge la
-- migrazione non legga meta' della storia: `db/seeds/rtl-banking-skills/
-- seed_banking_skills.sql` risolve le soft skill con
-- `ss.skill_name = ... AND ss.skill_tenant_id = <RTL>`, e ha un guard fail-loud
-- se una non risolve. Tolte le righe B, quel seed si fermerebbe con
-- un'eccezione. E' emendato nello stesso commit per cercare prima nel tenant e
-- poi fra le globali. Ritirare non e' cancellare (ADR-0035): si emenda il file
-- che crea l'oggetto, non solo l'esemplare.
--
-- ROLLBACK: giornale `staging.skill_merge_undo` (riga intera in JSONB per cio'
-- che viene cancellato, mappa prima/dopo per cio' che viene ripuntato) e
-- funzione `staging.skill_merge_undo_apply('000351')` che lo ri-applica al
-- contrario. Provato prima di dichiarare la fase chiusa.
--
-- IDEMPOTENTE: la mappa si ri-deriva a ogni corsa dai dati; alla seconda e'
-- vuota e ogni istruzione tocca zero righe. Authored: 2026-08-21 (S1077).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Il giornale di annullamento, prima di qualunque scrittura.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.skill_merge_undo (
  undo_id      bigserial PRIMARY KEY,
  migrazione   text        NOT NULL,
  tabella      text        NOT NULL,
  azione       text        NOT NULL CHECK (azione IN ('REPOINT','DELETE')),
  riga_id      uuid,
  skill_prima  uuid,
  skill_dopo   uuid,
  riga_intera  jsonb,
  creato_il    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE staging.skill_merge_undo IS
  'Giornale di annullamento delle fusioni di competenze duplicate. REPOINT porta '
  'skill_prima->skill_dopo (si disfa riscrivendo skill_prima); DELETE conserva la '
  'riga intera in JSONB. Si applica con staging.skill_merge_undo_apply(migrazione).';

-- ----------------------------------------------------------------------------
-- 1. La mappa: derivata dai DATI, non da identificativi cablati.
--
--    Il filtro descrive il residuo, non le tre righe di oggi: riga di tenant
--    col marchio 'COMP::' dell'ingestione legacy, senza indirizzo ESCO e senza
--    tipo, che ha una gemella GLOBALE con lo stesso nome normalizzato. Una
--    competenza che un tenant creasse domani di proposito non porta quel
--    prefisso e non viene toccata.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS _fusione_map;
CREATE TEMP TABLE _fusione_map AS
SELECT b.skill_id AS perdente, a.skill_id AS vincente, b.skill_name AS nome
FROM sys.sys_skills b
JOIN sys.sys_skills a
  ON a.skill_tenant_id IS NULL
 AND lower(btrim(a.skill_name)) = lower(btrim(b.skill_name))
 AND a.skill_id <> b.skill_id
WHERE b.skill_tenant_id IS NOT NULL
  AND b.skill_code LIKE 'COMP::%'
  AND b.skill_esco_uri IS NULL
  AND b.skill_kind IS NULL;

-- Guardia di ragionevolezza, ri-verificata AL MOMENTO dell'esecuzione e non
-- ereditata dalla misura di ieri. Non fissa il numero di oggi — sarebbe
-- cristallizzare una misura variabile — ma si ferma se la mappa esplode: una
-- fusione di massa inattesa dev'essere guardata da un umano, non applicata.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _fusione_map;
  IF n > 50 THEN
    RAISE EXCEPTION '000351: la mappa di fusione contiene % righe, oltre la soglia di 50. '
                    'Non e'' il residuo noto: fermarsi e misurare prima di fondere.', n;
  END IF;
  RAISE NOTICE '000351: coppie da fondere = %', n;
END $$;

-- ----------------------------------------------------------------------------
-- 2. sys_user_skills — le collisioni si assorbono, il resto si ripunta.
-- ----------------------------------------------------------------------------
INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, riga_intera)
SELECT '000351', 'sys.sys_user_skills', 'DELETE', u.user_skill_id, u.user_skill_skill_id, to_jsonb(u)
FROM sys.sys_user_skills u JOIN _fusione_map m ON u.user_skill_skill_id = m.perdente
WHERE EXISTS (SELECT 1 FROM sys.sys_user_skills g
              WHERE g.user_skill_user_id = u.user_skill_user_id AND g.user_skill_skill_id = m.vincente);

DELETE FROM sys.sys_user_skills u USING _fusione_map m
WHERE u.user_skill_skill_id = m.perdente
  AND EXISTS (SELECT 1 FROM sys.sys_user_skills g
              WHERE g.user_skill_user_id = u.user_skill_user_id AND g.user_skill_skill_id = m.vincente);

INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo)
SELECT '000351', 'sys.sys_user_skills', 'REPOINT', u.user_skill_id, m.perdente, m.vincente
FROM sys.sys_user_skills u JOIN _fusione_map m ON u.user_skill_skill_id = m.perdente;

UPDATE sys.sys_user_skills u SET user_skill_skill_id = m.vincente, updated_at = now()
FROM _fusione_map m WHERE u.user_skill_skill_id = m.perdente;

-- ----------------------------------------------------------------------------
-- 3. sys_position_skill_requirements — stesso schema.
-- ----------------------------------------------------------------------------
INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, riga_intera)
SELECT '000351', 'sys.sys_position_skill_requirements', 'DELETE',
       r.position_skill_requirement_id, r.skill_id, to_jsonb(r)
FROM sys.sys_position_skill_requirements r JOIN _fusione_map m ON r.skill_id = m.perdente
WHERE EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements g
              WHERE g.position_id = r.position_id AND g.skill_id = m.vincente);

DELETE FROM sys.sys_position_skill_requirements r USING _fusione_map m
WHERE r.skill_id = m.perdente
  AND EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements g
              WHERE g.position_id = r.position_id AND g.skill_id = m.vincente);

INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo)
SELECT '000351', 'sys.sys_position_skill_requirements', 'REPOINT',
       r.position_skill_requirement_id, m.perdente, m.vincente
FROM sys.sys_position_skill_requirements r JOIN _fusione_map m ON r.skill_id = m.perdente;

UPDATE sys.sys_position_skill_requirements r SET skill_id = m.vincente, updated_at = now()
FROM _fusione_map m WHERE r.skill_id = m.perdente;

-- ----------------------------------------------------------------------------
-- 4. sys_skill_embeddings — UNIQUE(skill_id), quindi il vettore della perdente
--    si cancella: quello della globale e' il vettore del concetto canonico.
-- ----------------------------------------------------------------------------
INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, riga_intera)
SELECT '000351', 'sys.sys_skill_embeddings', 'DELETE', e.skill_embedding_id, e.skill_id, to_jsonb(e)
FROM sys.sys_skill_embeddings e JOIN _fusione_map m ON e.skill_id = m.perdente;

DELETE FROM sys.sys_skill_embeddings e USING _fusione_map m WHERE e.skill_id = m.perdente;

-- ----------------------------------------------------------------------------
-- 5. Le tabelle rimaste: nessuna unicita' su skill_id, quindi ripuntamento
--    diretto. Oggi sono a zero riferimenti sulle perdenti, ma il codice c'e'
--    lo stesso: una migrazione che presume «tanto e' vuoto» smette di essere
--    ri-applicabile il giorno in cui non lo e' piu'.
-- ----------------------------------------------------------------------------
INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo)
SELECT '000351', 'sys.sys_user_skill_evidence', 'REPOINT', e.user_skill_evidence_id, m.perdente, m.vincente
FROM sys.sys_user_skill_evidence e JOIN _fusione_map m ON e.user_skill_evidence_skill_id = m.perdente;
UPDATE sys.sys_user_skill_evidence e SET user_skill_evidence_skill_id = m.vincente
FROM _fusione_map m WHERE e.user_skill_evidence_skill_id = m.perdente;

INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo)
SELECT '000351', 'sys.sys_mentor_match_scores', 'REPOINT', s.match_id, m.perdente, m.vincente
FROM sys.sys_mentor_match_scores s JOIN _fusione_map m ON s.match_skill_id = m.perdente;
UPDATE sys.sys_mentor_match_scores s SET match_skill_id = m.vincente
FROM _fusione_map m WHERE s.match_skill_id = m.perdente;

INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo)
SELECT '000351', 'sys.sys_learning_gaps', 'REPOINT', g.learning_gap_id, m.perdente, m.vincente
FROM sys.sys_learning_gaps g JOIN _fusione_map m ON g.learning_gap_skill_id = m.perdente;
UPDATE sys.sys_learning_gaps g SET learning_gap_skill_id = m.vincente
FROM _fusione_map m WHERE g.learning_gap_skill_id = m.perdente;

INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo)
SELECT '000351', 'sys.sys_skill_aliases', 'REPOINT', a.skill_alias_id, m.perdente, m.vincente
FROM sys.sys_skill_aliases a JOIN _fusione_map m ON a.skill_alias_skill_id = m.perdente;
UPDATE sys.sys_skill_aliases a SET skill_alias_skill_id = m.vincente
FROM _fusione_map m WHERE a.skill_alias_skill_id = m.perdente;

-- sys_skill_learning_mappings: UNIQUE(skill, module) da verificare a runtime —
-- si assorbe come le altre, per non lasciare un ramo che rompe in futuro.
INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, riga_intera)
SELECT '000351', 'sys.sys_skill_learning_mappings', 'DELETE',
       l.skill_learning_mapping_id, l.skill_learning_mapping_skill_id, to_jsonb(l)
FROM sys.sys_skill_learning_mappings l JOIN _fusione_map m ON l.skill_learning_mapping_skill_id = m.perdente
WHERE EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings g
              WHERE g.skill_learning_mapping_skill_id = m.vincente
                AND g.skill_learning_mapping_module_id = l.skill_learning_mapping_module_id);
DELETE FROM sys.sys_skill_learning_mappings l USING _fusione_map m
WHERE l.skill_learning_mapping_skill_id = m.perdente
  AND EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings g
              WHERE g.skill_learning_mapping_skill_id = m.vincente
                AND g.skill_learning_mapping_module_id = l.skill_learning_mapping_module_id);
INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo)
SELECT '000351', 'sys.sys_skill_learning_mappings', 'REPOINT',
       l.skill_learning_mapping_id, m.perdente, m.vincente
FROM sys.sys_skill_learning_mappings l JOIN _fusione_map m ON l.skill_learning_mapping_skill_id = m.perdente;
UPDATE sys.sys_skill_learning_mappings l SET skill_learning_mapping_skill_id = m.vincente
FROM _fusione_map m WHERE l.skill_learning_mapping_skill_id = m.perdente;

-- Archi della tassonomia: UNIQUE(parent, child, kind), e vanno visti da
-- entrambi i lati. Si assorbono i doppioni e gli auto-anelli che nascerebbero.
DELETE FROM sys.sys_skill_taxonomy_edges e USING _fusione_map m
WHERE (e.skill_taxonomy_edge_parent_id = m.perdente AND e.skill_taxonomy_edge_child_id = m.vincente)
   OR (e.skill_taxonomy_edge_child_id  = m.perdente AND e.skill_taxonomy_edge_parent_id = m.vincente);
UPDATE sys.sys_skill_taxonomy_edges e SET skill_taxonomy_edge_parent_id = m.vincente
FROM _fusione_map m WHERE e.skill_taxonomy_edge_parent_id = m.perdente
  AND NOT EXISTS (SELECT 1 FROM sys.sys_skill_taxonomy_edges g
                  WHERE g.skill_taxonomy_edge_parent_id = m.vincente
                    AND g.skill_taxonomy_edge_child_id = e.skill_taxonomy_edge_child_id
                    AND g.skill_taxonomy_edge_kind = e.skill_taxonomy_edge_kind);
UPDATE sys.sys_skill_taxonomy_edges e SET skill_taxonomy_edge_child_id = m.vincente
FROM _fusione_map m WHERE e.skill_taxonomy_edge_child_id = m.perdente
  AND NOT EXISTS (SELECT 1 FROM sys.sys_skill_taxonomy_edges g
                  WHERE g.skill_taxonomy_edge_child_id = m.vincente
                    AND g.skill_taxonomy_edge_parent_id = e.skill_taxonomy_edge_parent_id
                    AND g.skill_taxonomy_edge_kind = e.skill_taxonomy_edge_kind);
DELETE FROM sys.sys_skill_taxonomy_edges e USING _fusione_map m
WHERE e.skill_taxonomy_edge_parent_id = m.perdente OR e.skill_taxonomy_edge_child_id = m.perdente;

-- sys_occupation_skill_requirements: l'unicita' e' sugli indirizzi ESCO, non
-- su skill_id, quindi il ripuntamento e' neutro.
INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo)
SELECT '000351', 'sys.sys_occupation_skill_requirements', 'REPOINT',
       o.occupation_skill_requirement_id, m.perdente, m.vincente
FROM sys.sys_occupation_skill_requirements o JOIN _fusione_map m ON o.occupation_skill_req_skill_id = m.perdente;
UPDATE sys.sys_occupation_skill_requirements o SET occupation_skill_req_skill_id = m.vincente
FROM _fusione_map m WHERE o.occupation_skill_req_skill_id = m.perdente;

INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo)
SELECT '000351', 'sys.sys_position_skill_requirement_history', 'REPOINT',
       h.position_skill_requirement_history_id, m.perdente, m.vincente
FROM sys.sys_position_skill_requirement_history h
JOIN _fusione_map m ON h.position_skill_requirement_history_skill_id = m.perdente;
UPDATE sys.sys_position_skill_requirement_history h
   SET position_skill_requirement_history_skill_id = m.vincente
FROM _fusione_map m WHERE h.position_skill_requirement_history_skill_id = m.perdente;

-- ----------------------------------------------------------------------------
-- 6. Le righe perdenti, archiviate e poi rimosse.
-- ----------------------------------------------------------------------------
INSERT INTO staging.skill_merge_undo (migrazione, tabella, azione, riga_id, skill_prima, skill_dopo, riga_intera)
SELECT '000351', 'sys.sys_skills', 'DELETE', s.skill_id, s.skill_id, m.vincente, to_jsonb(s)
FROM sys.sys_skills s JOIN _fusione_map m ON s.skill_id = m.perdente;

DELETE FROM sys.sys_skills s USING _fusione_map m WHERE s.skill_id = m.perdente;

-- ----------------------------------------------------------------------------
-- 7. Post-condizioni. La prima protegge cio' che NON doveva cambiare — che e'
--    il controllo che conta: contare le righe fuse dice solo che qualcosa e'
--    successo, non che sia successa la cosa giusta.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  dup   int;
  orf   int;
BEGIN
  -- (a) nessun nome resta duplicato fra globale e tenant con quel marchio
  SELECT count(*) INTO dup
  FROM sys.sys_skills b JOIN sys.sys_skills a
    ON a.skill_tenant_id IS NULL
   AND lower(btrim(a.skill_name)) = lower(btrim(b.skill_name)) AND a.skill_id <> b.skill_id
  WHERE b.skill_tenant_id IS NOT NULL AND b.skill_code LIKE 'COMP::%'
    AND b.skill_esco_uri IS NULL AND b.skill_kind IS NULL;
  IF dup <> 0 THEN
    RAISE EXCEPTION '000351: restano % coppie non fuse', dup;
  END IF;

  -- (b) nessun riferimento pendente verso una competenza che non esiste piu'
  SELECT count(*) INTO orf FROM sys.sys_user_skills u
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skills s WHERE s.skill_id = u.user_skill_skill_id);
  IF orf <> 0 THEN
    RAISE EXCEPTION '000351: % competenze di persone puntano nel vuoto', orf;
  END IF;

  RAISE NOTICE '000351: fusione completata, nessuna coppia residua e nessun riferimento pendente.';
END $$;

-- ----------------------------------------------------------------------------
-- 8. La funzione che disfa. Esiste perche' un rollback dichiarato e mai scritto
--    e' una promessa, non una garanzia.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.skill_merge_undo_apply(p_migrazione text)
RETURNS TABLE(tabella text, azione text, righe bigint)
LANGUAGE plpgsql AS $fn$
DECLARE
  r record;
  -- La mappa tabella -> (colonna della competenza, chiave primaria). E' dichiarata
  -- qui e non nel giornale perche' e' struttura, non dato: cambia con lo schema,
  -- non con l'esecuzione. Ogni nome e' stato verificato su `pg_constraint` e
  -- `information_schema.columns`, non ricordato.
  mappa CONSTANT text[][] := ARRAY[
    ['sys.sys_user_skills',                       'user_skill_skill_id',                        'user_skill_id'],
    ['sys.sys_position_skill_requirements',       'skill_id',                                   'position_skill_requirement_id'],
    ['sys.sys_user_skill_evidence',               'user_skill_evidence_skill_id',               'user_skill_evidence_id'],
    ['sys.sys_mentor_match_scores',               'match_skill_id',                             'match_id'],
    ['sys.sys_learning_gaps',                     'learning_gap_skill_id',                      'learning_gap_id'],
    ['sys.sys_skill_aliases',                     'skill_alias_skill_id',                       'skill_alias_id'],
    ['sys.sys_skill_learning_mappings',           'skill_learning_mapping_skill_id',            'skill_learning_mapping_id'],
    ['sys.sys_occupation_skill_requirements',     'occupation_skill_req_skill_id',              'occupation_skill_requirement_id'],
    ['sys.sys_position_skill_requirement_history','position_skill_requirement_history_skill_id','position_skill_requirement_history_id']
  ];
  i int;
BEGIN
  -- 1. Le righe cancellate tornano. Le competenze PER PRIME: tutte le altre
  --    tabelle hanno una chiave esterna verso di loro, e reinserirle dopo
  --    fallirebbe — l'ordine qui non e' estetico, e' l'unico che funziona.
  FOR r IN SELECT u.tabella AS t, u.riga_intera AS j FROM staging.skill_merge_undo u
            WHERE u.migrazione = p_migrazione AND u.azione = 'DELETE' AND u.riga_intera IS NOT NULL
            ORDER BY (u.tabella <> 'sys.sys_skills'), u.undo_id
  LOOP
    EXECUTE format('INSERT INTO %s SELECT (jsonb_populate_record(NULL::%s, $1)).* ON CONFLICT DO NOTHING',
                   r.t, r.t) USING r.j;
  END LOOP;

  -- 2. I ripuntamenti si disfanno davvero: ogni riga torna alla competenza da
  --    cui era stata spostata, riconosciuta per chiave primaria.
  FOR i IN 1 .. array_length(mappa, 1) LOOP
    EXECUTE format(
      'UPDATE %s x SET %I = u.skill_prima FROM staging.skill_merge_undo u '
      'WHERE u.migrazione = $1 AND u.azione = ''REPOINT'' AND u.tabella = $2 '
      '  AND x.%I = u.riga_id AND x.%I = u.skill_dopo',
      mappa[i][1], mappa[i][2], mappa[i][3], mappa[i][2])
      USING p_migrazione, mappa[i][1];
  END LOOP;

  RETURN QUERY
    SELECT u.tabella, u.azione, count(*) FROM staging.skill_merge_undo u
     WHERE u.migrazione = p_migrazione GROUP BY 1,2 ORDER BY 1,2;
END $fn$;

COMMENT ON FUNCTION staging.skill_merge_undo_apply(text) IS
  'Disfa una fusione di competenze: reinserisce le righe cancellate (le competenze '
  'per prime, per via delle chiavi esterne) e riporta ogni riga ripuntata alla '
  'competenza di partenza. La condizione x.<colonna> = skill_dopo impedisce di '
  'toccare righe che nel frattempo sono state spostate altrove da qualcun altro.';
