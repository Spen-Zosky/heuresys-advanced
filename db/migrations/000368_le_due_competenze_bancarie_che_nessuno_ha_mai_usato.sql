-- ============================================================================
-- 000368 — Le due competenze che nessuno usa e nessuna tassonomia colloca (#227 F3)
--
-- `#227` F1 aveva classificato le competenze isolate in cinque specie. Questa migrazione
-- consuma **S5**: non-ESCO, senza un solo arco tassonomico, e **mai usate da nessuno**.
-- Sono due, e si nominano una per una — mai un carattere jolly:
--
--     CUSTOM::BANCASSUR   Bancassicurazione
--     CUSTOM::FRAUD-DET   Rilevamento e prevenzione delle frodi
--
-- PERCHÉ SI RITIRANO, e perché la risposta non era ovvia. Sono competenze **bancarie**, e
-- l'invariante I21 tiene il catalogo coerente con l'industry del tenant: a prima vista sono
-- catalogo legittimo di RTL Bank, non residuo. Ciò che decide è la **provenienza**, misurata:
-- vengono da `db/seeds/rtl-rebuild/extracted/tenant_custom_skills.csv`, cioè da
-- `00_extract_legacy_subset.sh` — un'**estrazione dal legacy**, non un catalogo curato. Le
-- altre 23 sorelle dello stesso file qualcuno le usa; queste due non le ha mai usate nessuno,
-- in nessuna persona, posizione, lacuna formativa, occupazione, fascicolo o percorso.
-- Un residuo dell'import senza referente si risolve (I12: il rubinetto è chiuso).
--
-- ⚠ IL CSV NON È VERSIONATO (`git ls-files` → non tracciato), quindi emendarlo NON
-- propagherebbe niente: sugli altri host quel file non esiste. La cura deve stare nella
-- catena, che è ciò che gira ovunque — ed è questa migrazione. Il seed `06_skills_certs.sql`
-- che lo carica non fa parte del deploy: gira solo in un rebuild di RTL, che da quel CSV
-- locale non è comunque riproducibile altrove.
--
-- MISURATO PRIMA (2026-08-30, produzione): 14.033 competenze · 25 `CUSTOM::` · 5 `COMP::` ·
-- 30 senza URI ESCO · 4.464 isolate, di cui 4.434 ESCO (tassonomia europea: restano, I21) e
-- **2 non-ESCO mai usate** — queste.
--
-- ROLLBACK DICHIARATO: `staging.skill_ritirate_undo` conserva la riga intera prima della
-- cancellazione, con la funzione che la rimette. Non è un commento: è una tabella.
-- ============================================================================

CREATE TABLE IF NOT EXISTS staging.skill_ritirate_undo (
  undo_id          bigserial PRIMARY KEY,
  ritirata_il      timestamptz NOT NULL DEFAULT now(),
  ritirata_da      text        NOT NULL,
  skill_riga       jsonb       NOT NULL
);

COMMENT ON TABLE staging.skill_ritirate_undo IS
  'Giornale di rollback dei ritiri di competenze (#227). Ogni riga porta la tupla INTERA '
  'prima della cancellazione: `staging.ripristina_skill_ritirata(<undo_id>)` la rimette.';

CREATE OR REPLACE FUNCTION staging.ripristina_skill_ritirata(p_undo_id bigint)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE r jsonb; c text;
BEGIN
  SELECT skill_riga INTO r FROM staging.skill_ritirate_undo WHERE undo_id = p_undo_id;
  IF r IS NULL THEN RETURN 'nessun undo con id ' || p_undo_id; END IF;
  c := r ->> 'skill_code';
  -- Il giornale ospita anche le righe satellite (embedding): quelle non si rimettono da qui,
  -- e dirlo e' meglio che tentare un INSERT nella tabella sbagliata.
  IF c IS NULL THEN RETURN 'undo ' || p_undo_id || ' non e'' una competenza (riga satellite): si rimette a mano'; END IF;
  IF EXISTS (SELECT 1 FROM sys.sys_skills WHERE skill_code = c) THEN
    RETURN 'gia'' presente: ' || c;
  END IF;
  INSERT INTO sys.sys_skills SELECT * FROM jsonb_populate_record(NULL::sys.sys_skills, r);
  RETURN 'ripristinata ' || c;
END $fn$;

DO $$
DECLARE
  bersagli text[] := ARRAY['CUSTOM::BANCASSUR', 'CUSTOM::FRAUD-DET'];
  n_usate   int;
  n_archi   int;
  n_prima   int;
  n_dopo    int;
  n_custom  int;
  n_tolte   int;
BEGIN
  SELECT count(*) INTO n_prima FROM sys.sys_skills;

  -- ── GUARDIA (a) — ri-verificata ADESSO, mai ereditata dalla misura di ieri: nessuno dei
  --    due bersagli deve essere usato. Se qualcuno nel frattempo li ha assegnati, non sono
  --    piu' residuo e la migrazione si ferma invece di cancellare.
  SELECT count(*) INTO n_usate
    FROM sys.sys_skills s
   WHERE s.skill_code = ANY(bersagli)
     AND (EXISTS (SELECT 1 FROM sys.sys_user_skills u WHERE u.user_skill_skill_id = s.skill_id)
       OR EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements p WHERE p.skill_id = s.skill_id)
       OR EXISTS (SELECT 1 FROM sys.sys_learning_gaps g WHERE g.learning_gap_skill_id = s.skill_id)
       OR EXISTS (SELECT 1 FROM sys.sys_occupation_skill_requirements o WHERE o.occupation_skill_req_skill_id = s.skill_id)
       OR EXISTS (SELECT 1 FROM sys.sys_blueprint_content_skills b WHERE b.blueprint_content_skill_id = s.skill_id)
       OR EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings m WHERE m.skill_learning_mapping_skill_id = s.skill_id));
  IF n_usate <> 0 THEN
    RAISE EXCEPTION '000368: % dei bersagli sono ORA in uso — non sono piu'' residuo, non si ritirano', n_usate;
  END IF;

  -- ── GUARDIA (b): devono essere ancora isolate. Un arco nato nel frattempo le colloca
  --    nella tassonomia, e una competenza collocata non e' residuo.
  SELECT count(*) INTO n_archi
    FROM sys.sys_skills s
    JOIN sys.sys_skill_taxonomy_edges e
      ON e.skill_taxonomy_edge_parent_id = s.skill_id OR e.skill_taxonomy_edge_child_id = s.skill_id
   WHERE s.skill_code = ANY(bersagli);
  IF n_archi <> 0 THEN
    RAISE EXCEPTION '000368: i bersagli hanno ora % archi tassonomici — sono collocati, non si ritirano', n_archi;
  END IF;

  -- ── il giornale PRIMA della cancellazione (se qualcosa va storto dopo, la riga c'e' gia')
  INSERT INTO staging.skill_ritirate_undo (ritirata_da, skill_riga)
  SELECT '000368 (#227 F3)', to_jsonb(s) FROM sys.sys_skills s
   WHERE s.skill_code = ANY(bersagli)
     AND NOT EXISTS (SELECT 1 FROM staging.skill_ritirate_undo u
                      WHERE u.skill_riga ->> 'skill_code' = s.skill_code);

  -- ── ⚠ NON SONO SOLE: 2 EMBEDDING LE REFERENZIANO (misurato prima di scrivere il DELETE).
  --    Una cascata silenziosa se li porterebbe via senza lasciare traccia, e il giornale di
  --    undo rimetterebbe una competenza monca. Quindi anche loro passano dal giornale, e si
  --    cancellano ESPLICITAMENTE prima — non per effetto collaterale di una FK.
  INSERT INTO staging.skill_ritirate_undo (ritirata_da, skill_riga)
  SELECT '000368 embedding (#227 F3)', to_jsonb(e)
    FROM sys.sys_skill_embeddings e
   WHERE e.skill_id IN (SELECT skill_id FROM sys.sys_skills WHERE skill_code = ANY(bersagli))
     AND NOT EXISTS (SELECT 1 FROM staging.skill_ritirate_undo u
                      WHERE u.ritirata_da LIKE '000368 embedding%'
                        AND u.skill_riga ->> 'skill_id' = e.skill_id::text);
  DELETE FROM sys.sys_skill_embeddings
   WHERE skill_id IN (SELECT skill_id FROM sys.sys_skills WHERE skill_code = ANY(bersagli));

  -- ── il ritiro, per codice esplicito
  WITH d AS (DELETE FROM sys.sys_skills WHERE skill_code = ANY(bersagli) RETURNING 1)
  SELECT count(*) INTO n_tolte FROM d;

  -- ── POST-CONDIZIONI. La prima guarda cio' che DOVEVA cambiare…
  IF EXISTS (SELECT 1 FROM sys.sys_skills WHERE skill_code = ANY(bersagli)) THEN
    RAISE EXCEPTION '000368: i bersagli sono ancora presenti dopo il ritiro';
  END IF;
  -- …e le altre due cio' che NON doveva: le 23 sorelle bancarie in uso, e il catalogo intero.
  SELECT count(*) INTO n_custom FROM sys.sys_skills WHERE skill_code LIKE 'CUSTOM::%';
  IF n_custom <> 23 THEN
    RAISE EXCEPTION '000368: le CUSTOM rimaste sono % invece di 23 — il ritiro ha preso di piu'' di quanto doveva', n_custom;
  END IF;
  SELECT count(*) INTO n_dopo FROM sys.sys_skills;
  IF n_prima - n_dopo <> n_tolte THEN
    RAISE EXCEPTION '000368: il catalogo e'' passato da % a % ma le tolte sono %', n_prima, n_dopo, n_tolte;
  END IF;
  IF n_tolte > 2 THEN
    RAISE EXCEPTION '000368: tolte % righe, al massimo 2', n_tolte;
  END IF;

  RAISE NOTICE '000368 OK — % competenze ritirate (0 alla riesecuzione), % CUSTOM restano, giornale di undo popolato', n_tolte, n_custom;
END $$;

-- ── LA SENTINELLA (#227 F5) ────────────────────────────────────────────────────────────
-- Nessuna misura contava le competenze isolate: il numero è potuto crescere fino a un terzo
-- del catalogo senza che niente lo dicesse.
--
-- ⚠ La soglia NON è «zero competenze isolate»: 4.434 delle 4.464 sono **ESCO con URI**, cioè
-- la tassonomia europea, che l'invariante I21 tiene deliberatamente aperta a ogni industry —
-- pretendere zero lì sarebbe chiedere di potare ESCO, ed è il contrario di ciò che il
-- progetto vuole. Ciò che non deve esistere è il **residuo**: una competenza che non viene da
-- una tassonomia, che nessuna tassonomia colloca, e che nessuno usa. Di quelle zero è
-- l'atteso, quindi questa vista può essere una sentinella bloccante come tutte le altre.
CREATE OR REPLACE VIEW sys.v_skill_isolate_residue AS
SELECT s.skill_id, s.skill_code, s.skill_name, s.skill_tenant_id
  FROM sys.sys_skills s
 WHERE s.skill_esco_uri IS NULL
   AND NOT EXISTS (SELECT 1 FROM sys.sys_skill_taxonomy_edges e
                    WHERE e.skill_taxonomy_edge_parent_id = s.skill_id
                       OR e.skill_taxonomy_edge_child_id  = s.skill_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_user_skills u WHERE u.user_skill_skill_id = s.skill_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements p WHERE p.skill_id = s.skill_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_learning_gaps g WHERE g.learning_gap_skill_id = s.skill_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_occupation_skill_requirements o WHERE o.occupation_skill_req_skill_id = s.skill_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_blueprint_content_skills b WHERE b.blueprint_content_skill_id = s.skill_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings m WHERE m.skill_learning_mapping_skill_id = s.skill_id);

COMMENT ON VIEW sys.v_skill_isolate_residue IS
  'SENTINELLA (#227 F5, 2026-08-30). Zero righe attese. Una competenza SENZA URI ESCO, senza '
  'un solo arco tassonomico e che nessuno usa e'' residuo di un import, non catalogo: va '
  'ritirata (come le due della 000368) oppure collocata. Le isolate ESCO NON entrano qui: sono '
  'la tassonomia europea, che I21 tiene aperta a ogni industry: pretendere zero equivarrebbe a potarla.';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.v_skill_isolate_residue;
  IF n <> 0 THEN
    RAISE EXCEPTION '000368: la sentinella vede % competenze residue — il ritiro non le ha prese tutte', n;
  END IF;
  RAISE NOTICE '000368 OK — sentinella v_skill_isolate_residue a zero';
END $$;
