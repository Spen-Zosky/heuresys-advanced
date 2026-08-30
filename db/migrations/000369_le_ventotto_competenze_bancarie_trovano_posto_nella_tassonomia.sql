-- ============================================================================
-- 000369 — Le competenze in uso trovano posto nella tassonomia (#227 F4)
--
-- Ultima specie di `#227` F1: le **28** competenze non-ESCO che qualcuno usa davvero e che
-- nessun arco colloca — 23 `CUSTOM::` bancarie di RTL Bank più 5 `COMP::` comportamentali.
-- Non sono residuo (quelle le ha ritirate la `000368`): sono il **catalogo di dominio**, e
-- restavano isolate solo perché nessuno le aveva mai collocate.
--
-- IL CRITERIO, E PERCHÉ NON È «APPLICA LA SOMIGLIANZA».
-- Tutte e 28 hanno un embedding (28 su 28, misurato) e le ESCO già collocate ne hanno 14.003:
-- l'arco si può **derivare** cercando la ESCO più vicina che abbia già un padre. Ma la misura
-- dice anche che applicarlo alla cieca sarebbe sbagliato:
--
--     Gestione della liquidità aziendale  →  gestire il trasporto di contanti   0,823  ✗ FALSA
--     Erogazione prestiti                 →  gestire le domande di prestito     0,800  ✓ vera
--
-- **La somiglianza non ordina la correttezza**: nessuna soglia separa le buone dalle cattive.
-- Quindi la macchina **propone** e la decisione è presa una per una, con la ragione — che è
-- ciò che F4 chiama «curatela vera». Elenco esplicito, mai un carattere jolly.
--
-- 18 COLLOCATE. L'arco è `IS_A` con `parent` = la ESCO sovraordinata e `child` = la nostra
-- (il verso letto dagli archi esistenti, non supposto).
--
-- 10 NON COLLOCATE, e ognuna porta la sua ragione — sono dichiarate, non dimenticate:
--   CASH-MGMT     0,823  «trasporto di contanti» è logistica di valori, non tesoreria d'impresa
--   SUSTAIN-FIN   0,792  «green bond» è uno STRUMENTO della finanza sostenibile: arco invertito
--   AML-OPS       0,777  l'antiriciclaggio confina con le frodi ma non ne è una specie
--   DIGITAL-PAY   0,765  i pagamenti digitali CONTENGONO la carta di credito: arco invertito
--   KYC-DUE       0,728  il KYC identifica il cliente, non ne misura il merito creditizio
--   IFRS9         0,722  è un principio contabile, non gestione del rischio
--   CORE-BANKING  0,718  un gestionale bancario non è «configurare sistemi TIC»
--   INT-AUDIT     0,703  l'audit interno verifica i controlli, non gestisce il rischio
--   TRADE-FIN     0,678  il trade finance non è analisi del credito
--   PSD2-OPEN     0,659  PSD2 e GDPR sono normative diverse
--
-- Restano isolate **con la ragione scritta**, che è l'altra metà di ciò che F3/F4 ammettono.
-- Non compaiono nella sentinella `v_skill_isolate_residue` della `000368`, e correttamente:
-- quella conta il **residuo** — senza URI, senza arco e **che nessuno usa** — e queste sono usate.
--
-- ROLLBACK DICHIARATO: `staging.skill_archi_undo` conserva ogni arco scritto qui, con la
-- funzione che lo toglie. 18 archi scritti a macchina vanno potuti disfare.
-- ============================================================================

CREATE TABLE IF NOT EXISTS staging.skill_archi_undo (
  undo_id        bigserial PRIMARY KEY,
  scritto_il     timestamptz NOT NULL DEFAULT now(),
  scritto_da     text        NOT NULL,
  edge_id        uuid        NOT NULL,
  parent_code    text        NOT NULL,
  child_code     text        NOT NULL,
  edge_kind      text        NOT NULL
);

COMMENT ON TABLE staging.skill_archi_undo IS
  'Giornale di rollback degli archi tassonomici scritti a macchina (#227 F4). '
  '`staging.disfa_archi_di(<scritto_da>)` li toglie tutti insieme.';

CREATE OR REPLACE FUNCTION staging.disfa_archi_di(p_scritto_da text)
RETURNS int LANGUAGE plpgsql AS $fn$
DECLARE n int;
BEGIN
  WITH d AS (
    DELETE FROM sys.sys_skill_taxonomy_edges e
     WHERE e.skill_taxonomy_edge_id IN (SELECT edge_id FROM staging.skill_archi_undo WHERE scritto_da = p_scritto_da)
    RETURNING 1)
  SELECT count(*) INTO n FROM d;
  RETURN n;
END $fn$;

-- Le 18 decisioni, come coppie di codici. Una tabella temporanea invece di 18 INSERT: l'elenco
-- resta leggibile in un colpo d'occhio, ed è quello che va riletto se un domani qualcosa stona.
CREATE TEMP TABLE _decisioni_227_f4 (child_code text, parent_code text) ON COMMIT DROP;
INSERT INTO _decisioni_227_f4 (child_code, parent_code) VALUES
  ('COMP::8b376ba7-8a43-4cf5-b005-7e2115401e31', 'ESCO::2aaa4f91-0c64-47d2-a9d2-cfdd1b56af96'), -- Collaborazione → collaborare con i colleghi
  ('CUSTOM::WEALTH-MGMT',   'ESCO::eb7adc61-8551-4742-bde9-9bce66eb14a3'), -- consulenza patrimoniale → consulenza investimenti
  ('CUSTOM::OP-RISK',       'ESCO::b4ad7308-2989-4b64-bb7b-2ffeb6f396c5'), -- rischio operativo → Gestione del rischio
  ('CUSTOM::MARKET-RISK',   'ESCO::b4ad7308-2989-4b64-bb7b-2ffeb6f396c5'), -- rischio di mercato → Gestione del rischio
  ('COMP::7780f0ba-f5fc-4dca-aee5-3f44ec6ac498', 'ESCO::65743ed2-e994-42d3-8a54-211d86912add'), -- Innovazione → cercare innovazioni
  ('CUSTOM::LOAN-ORIG',     'ESCO::8c56329b-4ddb-4af5-ba9a-bfddc8e06309'), -- erogazione prestiti → gestire le domande di prestito
  ('CUSTOM::STRESS-TEST',   'ESCO::b4ad7308-2989-4b64-bb7b-2ffeb6f396c5'), -- stress testing → Gestione del rischio
  ('COMP::15a059d5-5432-4a80-b653-f04e5042eb82', 'ESCO::db780813-6f5c-40ce-b283-53e6087e038e'), -- orientamento ai risultati → attuare obiettivi
  ('CUSTOM::NPL-MGMT',      'ESCO::ad96b4a5-b325-4b39-9ee5-374b64a0fcb1'), -- NPL → tecniche di riscossione debiti
  ('COMP::f49bf172-8442-4167-8e48-b1251cac91d9', 'ESCO::454061f6-292d-467f-8ad3-38456dc4081d'), -- orientamento al cliente → soddisfare i clienti
  ('CUSTOM::MIFID-COMP',    'ESCO::da2a7c58-c573-4293-9ec4-d012e43b7965'), -- MiFID II → gestione della compliance
  ('CUSTOM::FX-TRADING',    'ESCO::919a11d2-563f-4764-85d3-e49ddbf5957e'), -- trading valute → acquistare o vendere valute estere
  ('COMP::02c2f3c8-9c3d-4620-ba2c-89a2fd6cd751', 'ESCO::f4df90da-fbb7-420d-8f1e-9da6b0a32eaf'), -- Leadership → guidare gli altri
  ('CUSTOM::CREDIT-SCORE',  'ESCO::227106e9-01af-42a5-8d4c-f2b49e0e59f6'), -- credit scoring → analizzare storia creditizia e capacità di rimborso
  ('CUSTOM::CYBER-FIN',     'ESCO::95db988f-d888-4571-8be3-0e683e954d5d'), -- cybersecurity finanziaria → sicurezza informatica
  ('CUSTOM::PRIV-BANKING',  'ESCO::eb7adc61-8551-4742-bde9-9bce66eb14a3'), -- private banking → consulenza investimenti
  ('CUSTOM::BASEL-REG',     'ESCO::b4ad7308-2989-4b64-bb7b-2ffeb6f396c5'), -- Basilea → Gestione del rischio
  ('CUSTOM::REL-BANKING',   'ESCO::ef20fbdb-02c3-4fba-b54c-e88db697f0e2'); -- relationship banking → strategia account cliente

DO $$
DECLARE
  n_attese     int;
  n_risolte    int;
  n_archi_pre  int;
  n_archi_post int;
  n_scritti    int;
  n_isolate    int;
BEGIN
  SELECT count(*) INTO n_attese FROM _decisioni_227_f4;
  IF n_attese <> 18 THEN
    RAISE EXCEPTION '000369: le decisioni sono % invece di 18 — l''elenco e'' stato toccato', n_attese;
  END IF;

  -- GUARDIA (a): ogni codice dell'elenco deve esistere DAVVERO. Un refuso in un codice
  -- produrrebbe silenziosamente un arco in meno, e il conteggio finale non basterebbe a dirlo.
  SELECT count(*) INTO n_risolte
    FROM _decisioni_227_f4 d
    JOIN sys.sys_skills c ON c.skill_code = d.child_code
    JOIN sys.sys_skills p ON p.skill_code = d.parent_code;
  IF n_risolte <> 18 THEN
    RAISE EXCEPTION '000369: solo % coppie su 18 si risolvono in competenze esistenti', n_risolte;
  END IF;

  -- GUARDIA (b): nessuna decisione deve puntare a se stessa (un arco riflessivo e' un difetto,
  -- non un'opinione), e il padre deve essere ESCO — la nostra tassonomia risale a quella.
  IF EXISTS (SELECT 1 FROM _decisioni_227_f4 WHERE child_code = parent_code) THEN
    RAISE EXCEPTION '000369: una decisione punta a se stessa';
  END IF;
  IF EXISTS (SELECT 1 FROM _decisioni_227_f4 d
              JOIN sys.sys_skills p ON p.skill_code = d.parent_code
             WHERE p.skill_esco_uri IS NULL) THEN
    RAISE EXCEPTION '000369: un padre proposto non e'' ESCO';
  END IF;

  SELECT count(*) INTO n_archi_pre FROM sys.sys_skill_taxonomy_edges;

  -- La scrittura. `NOT EXISTS` invece di `ON CONFLICT` perche' la tabella non ha un vincolo
  -- univoco su (parent, child, kind) — verificato su `pg_constraint`, non supposto.
  WITH nuovi AS (
    INSERT INTO sys.sys_skill_taxonomy_edges
      (skill_taxonomy_edge_parent_id, skill_taxonomy_edge_child_id, skill_taxonomy_edge_kind, skill_taxonomy_edge_metadata)
    SELECT p.skill_id, c.skill_id, 'IS_A',
           jsonb_build_object('origine', '000369 (#227 F4)',
                              'criterio', 'ESCO piu'' vicina per embedding, riletta una per una')
      FROM _decisioni_227_f4 d
      JOIN sys.sys_skills c ON c.skill_code = d.child_code
      JOIN sys.sys_skills p ON p.skill_code = d.parent_code
     WHERE NOT EXISTS (
       SELECT 1 FROM sys.sys_skill_taxonomy_edges e
        WHERE e.skill_taxonomy_edge_parent_id = p.skill_id
          AND e.skill_taxonomy_edge_child_id  = c.skill_id
          AND e.skill_taxonomy_edge_kind      = 'IS_A')
    RETURNING skill_taxonomy_edge_id, skill_taxonomy_edge_parent_id, skill_taxonomy_edge_child_id)
  INSERT INTO staging.skill_archi_undo (scritto_da, edge_id, parent_code, child_code, edge_kind)
  SELECT '000369 (#227 F4)', n.skill_taxonomy_edge_id, p.skill_code, c.skill_code, 'IS_A'
    FROM nuovi n
    JOIN sys.sys_skills p ON p.skill_id = n.skill_taxonomy_edge_parent_id
    JOIN sys.sys_skills c ON c.skill_id = n.skill_taxonomy_edge_child_id;
  GET DIAGNOSTICS n_scritti = ROW_COUNT;

  SELECT count(*) INTO n_archi_post FROM sys.sys_skill_taxonomy_edges;

  -- POST-CONDIZIONE ① — cio' che DOVEVA cambiare: le 18 non sono piu' isolate.
  SELECT count(*) INTO n_isolate
    FROM _decisioni_227_f4 d
    JOIN sys.sys_skills c ON c.skill_code = d.child_code
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skill_taxonomy_edges e
                      WHERE e.skill_taxonomy_edge_parent_id = c.skill_id
                         OR e.skill_taxonomy_edge_child_id  = c.skill_id);
  IF n_isolate <> 0 THEN
    RAISE EXCEPTION '000369: % delle 18 sono ancora isolate dopo la scrittura', n_isolate;
  END IF;

  -- POST-CONDIZIONE ② — cio' che NON doveva cambiare: il grafo cresce ESATTAMENTE degli archi
  -- scritti qui, ne' uno di piu'. Alla riesecuzione n_scritti e' 0 e il grafo non si muove.
  IF n_archi_post - n_archi_pre <> n_scritti THEN
    RAISE EXCEPTION '000369: il grafo e'' passato da % a % ma gli archi scritti sono %',
      n_archi_pre, n_archi_post, n_scritti;
  END IF;
  IF n_scritti > 18 THEN
    RAISE EXCEPTION '000369: scritti % archi, al massimo 18', n_scritti;
  END IF;

  -- POST-CONDIZIONE ③ — le 10 NON collocate devono essere rimaste tali. Se un giro futuro le
  -- collocasse per errore, la ragione scritta in testa a questo file diventerebbe una bugia.
  IF EXISTS (
    SELECT 1 FROM sys.sys_skills s
     WHERE s.skill_code IN ('CUSTOM::CASH-MGMT','CUSTOM::SUSTAIN-FIN','CUSTOM::AML-OPS',
                            'CUSTOM::DIGITAL-PAY','CUSTOM::KYC-DUE','CUSTOM::IFRS9',
                            'CUSTOM::CORE-BANKING','CUSTOM::INT-AUDIT','CUSTOM::TRADE-FIN',
                            'CUSTOM::PSD2-OPEN')
       AND EXISTS (SELECT 1 FROM sys.sys_skill_taxonomy_edges e
                    WHERE e.skill_taxonomy_edge_parent_id = s.skill_id
                       OR e.skill_taxonomy_edge_child_id  = s.skill_id)) THEN
    RAISE EXCEPTION '000369: una delle 10 dichiarate NON collocabili ha ricevuto un arco';
  END IF;

  RAISE NOTICE '000369 OK — % archi scritti (0 alla riesecuzione), 18 collocate, 10 dichiarate con la ragione', n_scritti;
END $$;
