-- @migrate: once
-- ═══════════════════════════════════════════════════════════════════════════════
-- 000278_reattach_critical_roles_to_real_positions.sql
--
-- #160 — LE POSIZIONI CRITICHE TORNANO SUI RUOLI CHE DICHIARANO DI ESSERE.
--
-- IL DIFETTO, E LA SUA VERA RADICE
--   `C5g` segnalava 27 successori «che non riportano alla posizione né ne fanno il
--   mestiere altrove». Il sospetto naturale era la ricostruzione dell'organigramma,
--   come per #112/#114/#155. **È stato escluso con una misura**: `C5g` conta 27 casi
--   sullo stato attuale e 27 identici dopo aver eseguito
--   `staging.storia36_155_rollback()`, cioè sullo stato precedente alla 000277.
--   Identico prima e dopo ⇒ la causa è altrove, ed è più antica.
--
--   È l'ingestione brownfield. Le 8 posizioni critiche vengono dal legacy
--   (`metadata.legacy.source_table = 'critical_roles'`) e dichiarano ruoli di
--   vertice, ma l'aggancio a `position_id` è **arbitrario**:
--
--     Chief Executive Officer  → Securities Dealer      Head of Risk Management  → Software Developer
--     Chief Financial Officer  → Bank Teller            Head of Human Resources  → Investment Advisor
--     Chief Technology Officer → Risk Analyst           Senior Architect         → Compliance Officer
--     VP of Operations         → Bank Manager           VP of Sales              → Risk Analyst
--
--   Nessuna corrispondenza è sensata, e 6 delle 8 posizioni agganciate sono pure
--   disattivate. Da lì discende tutto: i bacini nascono dalle posizioni critiche, e
--   i candidati si cercano fra chi riporta a quella posizione o ne fa il mestiere
--   altrove. Su una posizione che non c'entra col ruolo, il criterio non può che
--   fallire. **Non è un check troppo rigido**: seed (`05_career.sql:288-315`) e
--   check pretendono le stesse due condizioni.
--
-- PERCHÉ NON SI USA LA MAPPA DI #155
--   Provata e scartata, con i numeri: produrrebbe `Risk Analyst → Cassiere` e
--   `Bank Manager → Vice Direttore di Filiale` come posizioni **critiche**, e non
--   risolverebbe comunque (27 → 25 in simulazione, poi annullata). Il motivo è di
--   sostanza: quella mappa risponde a «dov'è finita la persona», mentre qui la
--   domanda è «quale posizione è critica per la banca». Sono due cose diverse, e
--   nessuna deduzione automatica risponde alla seconda.
--
-- L'AGGANCIO È UNA DECISIONE, ED È DI ENZO (2026-08-07)
--   Sei corrispondenze confermate perché evidenti dai nomi; `VP of Sales → Retail
--   Director` scelto fra due candidati (l'altro era `Direttore Divisione Crediti`);
--   `Senior Architect` non ha equivalente nell'organigramma di oggi e Enzo ha
--   chiesto di conservarlo su una posizione tecnica: scelto `Software Developer`
--   `POS-00000324`, l'unica posizione tecnica viva con riporti diretti (3), quindi
--   strutturalmente la più senior fra le tecniche.
--
-- I BACINI GIUSTI ESISTONO GIÀ — NON SE NE SPOSTA NESSUNO
--   Misurato: dei 17 bacini, 9 non sono legati ad alcuna posizione critica e sei di
--   questi puntano **già** alle destinazioni scelte (`Successione — CEO`,
--   `— Finance Director`, `— IT Director`, `— HR Director`, `— Operations Director`,
--   `— Retail Director`), tutti **vuoti**. Riagganciando le critiche, quei bacini
--   diventano da soli i bacini delle posizioni critiche: nessun `UPDATE` sui pool,
--   che oltretutto non sarebbe possibile sulla chiave — `sys_successor_candidates`
--   la referenzia senza `ON UPDATE CASCADE` (verificato: l'UPDATE viola la FK).
--   Per `Head of Risk Management` e `Senior Architect` il bacino non esiste ancora e
--   lo crea il seed, che per costruzione ne fa uno per ogni critica che ne è priva.
--
-- COSA SI RIMUOVE
--   Gli 8 bacini rimasti orfani (quelli agganciati male) con i loro 24 candidati, e
--   i bacini appesi a posizioni **disattivate** con i loro: non si succede a una
--   posizione che non esiste più. Le valutazioni di prontezza seguono i candidati
--   per `ON DELETE CASCADE`, quindi si archiviano anche quelle.
--
-- DOPO QUESTA MIGRAZIONE VA ESEGUITO IL SEED
--   `psql -f db/seeds/storia36/05_career.sql` (o `storia36.sh custodia --repair-missing`).
--   La migrazione svuota i bacini sbagliati; è il seed che ne crea i due mancanti e
--   li popola di candidati conformi **con le loro valutazioni di prontezza**, che
--   `C5b(ii)`/`C5b(iii)` pretendono. Senza quel passo `C5b` diventa rosso: la
--   migrazione da sola lascia posizioni critiche scoperte.
--
-- Rieseguibile: agisce solo su ciò che è ancora agganciato male. Marcata `once`
-- perché rimuove righe.
--
-- STATO (S1048): APPLICATA. Il blocco era `#162` — il seed su cui poggia il passo
-- successivo produceva 31 incarichi sovrapposti. Risolto: il blocco della mobilità
-- interna ora salta chi ha già un incarico chiuso, perché quella mobilità è VERA e
-- non va inventata sopra. Collaudo congiunto migrazione+seed con tutti i check
-- attivi: C5g, C5k, C5c e C5f passano; seconda corsa del seed a delta 0.
-- Prerequisiti: 000277 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- §0. IL GIORNALE DEL RITORNO — stessa forma di 000277, comprese le sue lezioni:
--     nessun indice unico sulla chiave, si disfa a ritroso.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging.storia36_160_undo (
  undo_id      bigserial PRIMARY KEY,
  applicata_il timestamptz NOT NULL DEFAULT now(),
  passo        smallint NOT NULL,
  tabella      text NOT NULL,
  operazione   text NOT NULL,
  chiave       uuid NOT NULL,
  riga_prima   jsonb NOT NULL,
  CONSTRAINT storia36_160_undo_op_check CHECK (operazione IN ('UPDATE','DELETE','INSERT'))
);
COMMENT ON TABLE staging.storia36_160_undo IS
  '#160/000278 — giornale ordinato dello stato precedente. Si disfa a ritroso via staging.storia36_160_rollback().';

-- ───────────────────────────────────────────────────────────────────────────────
-- §1. L'AGGANCIO DECISO DA ENZO
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE aggancio (ruolo text, codice text) ON COMMIT DROP;
INSERT INTO aggancio VALUES
  ('Chief Executive Officer',  'POS-00000321'),      -- CEO
  ('Chief Financial Officer',  'POS-00000384'),      -- Finance Director
  ('Chief Technology Officer', 'POS-00000431'),      -- IT Director
  ('Head of Risk Management',  'POS-CMD-DIR-RISKM'), -- Responsabile Direzione Risk Management
  ('Head of Human Resources',  'POS-00000403'),      -- HR Director
  ('VP of Operations',         'POS-00000338'),      -- Operations Director
  ('VP of Sales',              'POS-00000436'),      -- Retail Director
  ('Senior Architect',         'POS-00000324');      -- Software Developer (3 riporti diretti)

-- Le destinazioni devono esistere, essere vive e avere un titolare: una posizione
-- critica senza nessuno dentro non è una posizione critica, è una casella.
DO $$
DECLARE v_mancanti int;
BEGIN
  SELECT count(*) INTO v_mancanti
    FROM aggancio a
    LEFT JOIN sys.sys_positions p ON p.position_code = a.codice AND p.position_is_active
   WHERE p.position_id IS NULL;
  IF v_mancanti > 0 AND EXISTS (SELECT 1 FROM sys.sys_critical_positions) THEN
    RAISE EXCEPTION '000278: % destinazioni non esistono o non sono attive', v_mancanti;
  END IF;
END $$;

CREATE TEMP TABLE prima_di ON COMMIT DROP AS
SELECT (SELECT count(*) FROM sys.sys_succession_pools)     AS pool_tot,
       (SELECT count(*) FROM sys.sys_successor_candidates) AS cand_tot;

-- ───────────────────────────────────────────────────────────────────────────────
-- §2. LE POSIZIONI CRITICHE TORNANO AL LORO RUOLO
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO staging.storia36_160_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 2, 'sys_critical_positions', 'UPDATE', cp.critical_position_id, to_jsonb(cp)
  FROM sys.sys_critical_positions cp
  JOIN aggancio a ON a.ruolo = cp.critical_position_metadata->'legacy'->>'role_name'
  JOIN sys.sys_positions p ON p.position_code = a.codice
 WHERE cp.critical_position_position_id <> p.position_id;

UPDATE sys.sys_critical_positions cp
   SET critical_position_position_id = p.position_id
  FROM aggancio a
  JOIN sys.sys_positions p ON p.position_code = a.codice
 WHERE cp.critical_position_metadata->'legacy'->>'role_name' = a.ruolo
   AND cp.critical_position_position_id <> p.position_id;

-- ───────────────────────────────────────────────────────────────────────────────
-- §2b. IL FLAG DI CRITICITÀ SEGUE IL REGISTRO
--     `C5f` è bidirezionale e va soddisfatto in entrambi i versi: (i) ogni
--     posizione nel registro dev'essere `CRITICAL` in anagrafica, (ii) ogni
--     `CRITICAL` in anagrafica dev'essere nel registro. Spostare solo il registro
--     rompe il secondo verso — misurato: il seed abortisce con «8 posizioni nel
--     registro delle critiche che l'anagrafica non dice critiche (es. CEO)».
--     Le vecchie tornano a NULL: il loro `CRITICAL` era una conseguenza
--     dell'aggancio sbagliato, non un giudizio su quelle posizioni. Il valore
--     precedente resta nel giornale, quindi il ritorno lo rimette.
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO staging.storia36_160_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 3, 'sys_positions', 'UPDATE', p.position_id, to_jsonb(p)
  FROM sys.sys_positions p
 WHERE (p.position_criticality = 'CRITICAL'
        AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                         WHERE cp.critical_position_position_id = p.position_id))
    OR (p.position_criticality IS DISTINCT FROM 'CRITICAL'
        AND EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                     WHERE cp.critical_position_position_id = p.position_id));

UPDATE sys.sys_positions p
   SET position_criticality = NULL, updated_at = now()
 WHERE p.position_criticality = 'CRITICAL'
   AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                    WHERE cp.critical_position_position_id = p.position_id);

UPDATE sys.sys_positions p
   SET position_criticality = 'CRITICAL', updated_at = now()
 WHERE p.position_criticality IS DISTINCT FROM 'CRITICAL'
   AND EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                WHERE cp.critical_position_position_id = p.position_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- §2c. E LA RILEVANZA DI SUCCESSIONE, che è la TERZA dichiarazione della stessa
--     cosa. `C5f` la pretende concorde col registro in entrambi i versi (iii/iv).
--     Tre tabelle dicono «questa posizione è critica» — registro, anagrafica e
--     rilevanza — e vanno mosse insieme o il seed abortisce sulla prima che resta
--     indietro. Chi crea le righe è `sys_position_succession_relevance`, che ha un
--     unico per posizione: quindi upsert, non insert cieco.
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO staging.storia36_160_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 3, 'sys_position_succession_relevance', 'UPDATE', r.position_succession_relevance_id, to_jsonb(r)
  FROM sys.sys_position_succession_relevance r
 WHERE r.is_critical <> EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                                 WHERE cp.critical_position_position_id = r.position_id);

UPDATE sys.sys_position_succession_relevance r
   SET is_critical = false, updated_at = now()
 WHERE r.is_critical
   AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                    WHERE cp.critical_position_position_id = r.position_id);

-- le righe che l'upsert CREERA' vanno segnate come da cancellare al ritorno:
-- un giornale che registra solo gli aggiornamenti lascerebbe dietro righe nuove.
INSERT INTO staging.storia36_160_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 3, 'sys_position_succession_relevance', 'INSERT', cp.critical_position_position_id,
       jsonb_build_object('position_id', cp.critical_position_position_id)
  FROM sys.sys_critical_positions cp
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_position_succession_relevance r
                    WHERE r.position_id = cp.critical_position_position_id);

INSERT INTO sys.sys_position_succession_relevance
       (position_id, position_succession_relevance_tenant_id, is_critical)
SELECT cp.critical_position_position_id, cp.critical_position_tenant_id, true
  FROM sys.sys_critical_positions cp
    ON CONFLICT (position_id) DO UPDATE SET is_critical = true, updated_at = now();

-- ───────────────────────────────────────────────────────────────────────────────
-- §3. VIA I BACINI SENZA PIÙ RAGIONE — e i loro candidati
--     Due categorie, entrambe prive di senso dopo il riaggancio:
--       (a) bacini appesi a una posizione DISATTIVATA — non si succede al nulla;
--       (b) bacini che erano il bacino di una critica e non lo sono più, cioè
--           quelli agganciati male, ora senza alcuna posizione critica dietro.
--     I candidati si archiviano PRIMA dei bacini: la FK li porterebbe via in
--     cascata e il giornale resterebbe senza la loro versione.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE pool_da_togliere ON COMMIT DROP AS
SELECT sp.succession_pool_id
  FROM sys.sys_succession_pools sp
  JOIN sys.sys_positions p ON p.position_id = sp.succession_pool_position_id
 WHERE NOT p.position_is_active
    OR (sp.succession_pool_name LIKE 'Successione —%'
        AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                         WHERE cp.critical_position_position_id = sp.succession_pool_position_id)
        AND EXISTS (SELECT 1 FROM sys.sys_successor_candidates sc
                     WHERE sc.successor_candidate_pool_id = sp.succession_pool_id));

INSERT INTO staging.storia36_160_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 3, 'sys_successor_readiness', 'DELETE', sr.successor_readiness_id, to_jsonb(sr)
  FROM sys.sys_successor_readiness sr
  JOIN sys.sys_successor_candidates sc ON sc.successor_candidate_id = sr.successor_readiness_candidate_id
 WHERE sc.successor_candidate_pool_id IN (SELECT succession_pool_id FROM pool_da_togliere);

INSERT INTO staging.storia36_160_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 3, 'sys_successor_candidates', 'DELETE', sc.successor_candidate_id, to_jsonb(sc)
  FROM sys.sys_successor_candidates sc
 WHERE sc.successor_candidate_pool_id IN (SELECT succession_pool_id FROM pool_da_togliere);

INSERT INTO staging.storia36_160_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 3, 'sys_succession_pools', 'DELETE', sp.succession_pool_id, to_jsonb(sp)
  FROM sys.sys_succession_pools sp
 WHERE sp.succession_pool_id IN (SELECT succession_pool_id FROM pool_da_togliere);

DELETE FROM sys.sys_succession_pools
 WHERE succession_pool_id IN (SELECT succession_pool_id FROM pool_da_togliere);

-- ───────────────────────────────────────────────────────────────────────────────
-- §4. I CANDIDATI RIMASTI CHE NON REGGONO IL CRITERIO
--     Il seed li rimetterà dove servono, con la sua regola e con le valutazioni
--     di prontezza che il modello pretende.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE cand_da_togliere ON COMMIT DROP AS
SELECT sc.successor_candidate_id AS id
  FROM sys.sys_successor_candidates sc
  JOIN sys.sys_succession_pools sp ON sp.succession_pool_id = sc.successor_candidate_pool_id
  JOIN sys.sys_positions pp ON pp.position_id = sp.succession_pool_position_id
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a0
                    WHERE a0.user_position_assignment_user_id = sc.successor_candidate_user_id
                      AND a0.user_position_assignment_status = 'ACTIVE'
                      AND a0.user_position_assignment_position_id = sp.succession_pool_position_id)
   AND NOT EXISTS (SELECT 1
                     FROM sys.sys_user_position_assignments a
                     JOIN sys.sys_positions cpz ON cpz.position_id = a.user_position_assignment_position_id
                    WHERE a.user_position_assignment_user_id = sc.successor_candidate_user_id
                      AND a.user_position_assignment_status = 'ACTIVE'
                      AND (cpz.position_reports_to_position_id = sp.succession_pool_position_id
                        OR (cpz.position_title = pp.position_title AND cpz.position_id <> pp.position_id)));

INSERT INTO staging.storia36_160_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 4, 'sys_successor_readiness', 'DELETE', sr.successor_readiness_id, to_jsonb(sr)
  FROM sys.sys_successor_readiness sr
 WHERE sr.successor_readiness_candidate_id IN (SELECT id FROM cand_da_togliere);

INSERT INTO staging.storia36_160_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 4, 'sys_successor_candidates', 'DELETE', sc.successor_candidate_id, to_jsonb(sc)
  FROM sys.sys_successor_candidates sc
 WHERE sc.successor_candidate_id IN (SELECT id FROM cand_da_togliere);

DELETE FROM sys.sys_successor_candidates
 WHERE successor_candidate_id IN (SELECT id FROM cand_da_togliere);

ANALYZE sys.sys_critical_positions;
ANALYZE sys.sys_succession_pools;
ANALYZE sys.sys_successor_candidates;

-- ───────────────────────────────────────────────────────────────────────────────
-- §5. IL RITORNO
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staging.storia36_160_rollback()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE r record; n_upd int := 0; n_ins int := 0; n_persi int := 0;
BEGIN
  FOR r IN SELECT * FROM staging.storia36_160_undo ORDER BY undo_id DESC
  LOOP
    IF r.operazione = 'UPDATE' AND r.tabella = 'sys_critical_positions' THEN
      UPDATE sys.sys_critical_positions
         SET critical_position_position_id = (r.riga_prima->>'critical_position_position_id')::uuid
       WHERE critical_position_id = r.chiave;
      IF FOUND THEN n_upd := n_upd + 1; ELSE n_persi := n_persi + 1; END IF;

    ELSIF r.operazione = 'UPDATE' AND r.tabella = 'sys_positions' THEN
      UPDATE sys.sys_positions
         SET position_criticality = (r.riga_prima->>'position_criticality'),
             updated_at = (r.riga_prima->>'updated_at')::timestamptz
       WHERE position_id = r.chiave;
      IF FOUND THEN n_upd := n_upd + 1; ELSE n_persi := n_persi + 1; END IF;

    ELSIF r.operazione = 'UPDATE' AND r.tabella = 'sys_position_succession_relevance' THEN
      UPDATE sys.sys_position_succession_relevance
         SET is_critical = (r.riga_prima->>'is_critical')::boolean,
             updated_at  = (r.riga_prima->>'updated_at')::timestamptz
       WHERE position_succession_relevance_id = r.chiave;
      IF FOUND THEN n_upd := n_upd + 1; ELSE n_persi := n_persi + 1; END IF;

    ELSIF r.operazione = 'INSERT' AND r.tabella = 'sys_position_succession_relevance' THEN
      DELETE FROM sys.sys_position_succession_relevance WHERE position_id = r.chiave;
      n_upd := n_upd + 1;   -- disfare una creazione e' cancellarla; se non c'e' piu', va bene

    ELSIF r.operazione = 'DELETE' AND r.tabella = 'sys_succession_pools' THEN
      INSERT INTO sys.sys_succession_pools
      SELECT (jsonb_populate_record(NULL::sys.sys_succession_pools, r.riga_prima)).*
      ON CONFLICT (succession_pool_id) DO NOTHING;
      IF FOUND THEN n_ins := n_ins + 1; ELSE n_persi := n_persi + 1; END IF;

    ELSIF r.operazione = 'DELETE' AND r.tabella = 'sys_successor_candidates' THEN
      INSERT INTO sys.sys_successor_candidates
      SELECT (jsonb_populate_record(NULL::sys.sys_successor_candidates, r.riga_prima)).*
      ON CONFLICT (successor_candidate_id) DO NOTHING;
      IF FOUND THEN n_ins := n_ins + 1; ELSE n_persi := n_persi + 1; END IF;

    ELSIF r.operazione = 'DELETE' AND r.tabella = 'sys_successor_readiness' THEN
      INSERT INTO sys.sys_successor_readiness
      SELECT (jsonb_populate_record(NULL::sys.sys_successor_readiness, r.riga_prima)).*
      ON CONFLICT (successor_readiness_id) DO NOTHING;
      IF FOUND THEN n_ins := n_ins + 1; ELSE n_persi := n_persi + 1; END IF;
    END IF;
  END LOOP;

  IF n_persi > 0 THEN
    RAISE EXCEPTION 'rollback 000278 NON integrale: % voci non hanno trovato la loro riga', n_persi;
  END IF;
  RETURN format('rollback 000278: %s righe ripristinate, %s re-inserite, 0 perse', n_upd, n_ins);
END $fn$;

COMMENT ON FUNCTION staging.storia36_160_rollback() IS
  '#160/000278 — riporta posizioni critiche, bacini, candidati e prontezze allo stato precedente.';

-- ───────────────────────────────────────────────────────────────────────────────
-- §6. AUTO-VERIFICA — soglie relative, così un clone senza i dati storia36 passa
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_male int; v_morti int; v_c5g int; v_pool int; v_cand int; p_pool int; p_cand int;
BEGIN
  SELECT pool_tot, cand_tot INTO p_pool, p_cand FROM prima_di;
  SELECT count(*) INTO v_pool FROM sys.sys_succession_pools;
  SELECT count(*) INTO v_cand FROM sys.sys_successor_candidates;

  -- (1) ogni ruolo critico sta sulla posizione decisa
  SELECT count(*) INTO v_male
    FROM sys.sys_critical_positions cp
    JOIN aggancio a ON a.ruolo = cp.critical_position_metadata->'legacy'->>'role_name'
    JOIN sys.sys_positions p ON p.position_code = a.codice
   WHERE cp.critical_position_position_id <> p.position_id;
  IF v_male > 0 THEN
    RAISE EXCEPTION '000278: % ruoli critici non sono sulla posizione decisa', v_male;
  END IF;

  -- (2) nessun bacino appeso a una posizione spenta
  SELECT count(*) INTO v_morti
    FROM sys.sys_succession_pools sp
    JOIN sys.sys_positions p ON p.position_id = sp.succession_pool_position_id
   WHERE NOT p.position_is_active;
  IF v_morti > 0 THEN
    RAISE EXCEPTION '000278: restano % bacini su posizioni non attive', v_morti;
  END IF;

  -- (3) il predicato di C5g è a zero sui candidati SUPERSTITI
  SELECT count(*) INTO v_c5g
    FROM sys.sys_successor_candidates sc
    JOIN sys.sys_succession_pools sp ON sp.succession_pool_id = sc.successor_candidate_pool_id
    JOIN sys.sys_positions pp ON pp.position_id = sp.succession_pool_position_id
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a0
                      WHERE a0.user_position_assignment_user_id = sc.successor_candidate_user_id
                        AND a0.user_position_assignment_status = 'ACTIVE'
                        AND a0.user_position_assignment_position_id = sp.succession_pool_position_id)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                       JOIN sys.sys_positions cpz ON cpz.position_id = a.user_position_assignment_position_id
                      WHERE a.user_position_assignment_user_id = sc.successor_candidate_user_id
                        AND a.user_position_assignment_status = 'ACTIVE'
                        AND (cpz.position_reports_to_position_id = sp.succession_pool_position_id
                          OR (cpz.position_title = pp.position_title AND cpz.position_id <> pp.position_id)));
  IF v_c5g > 0 THEN
    RAISE EXCEPTION '000278: % candidati non reggono ancora il criterio di C5g', v_c5g;
  END IF;

  -- (3b) C5f in entrambi i versi: registro e anagrafica concordano
  IF EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
               JOIN sys.sys_positions p ON p.position_id = cp.critical_position_position_id
              WHERE p.position_criticality IS DISTINCT FROM 'CRITICAL')
     OR EXISTS (SELECT 1 FROM sys.sys_positions p
                 WHERE p.position_criticality = 'CRITICAL'
                   AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                                    WHERE cp.critical_position_position_id = p.position_id)) THEN
    RAISE EXCEPTION '000278: registro delle critiche e anagrafica non concordano (C5f i/ii)';
  END IF;

  IF EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
              WHERE NOT EXISTS (SELECT 1 FROM sys.sys_position_succession_relevance r
                                 WHERE r.position_id = cp.critical_position_position_id AND r.is_critical))
     OR EXISTS (SELECT 1 FROM sys.sys_position_succession_relevance r
                 WHERE r.is_critical
                   AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                                    WHERE cp.critical_position_position_id = r.position_id)) THEN
    RAISE EXCEPTION '000278: registro e rilevanza di successione non concordano (C5f iii/iv)';
  END IF;

  -- (4) qui si sposta e si rimuove soltanto
  IF v_pool > p_pool OR v_cand > p_cand THEN
    RAISE EXCEPTION '000278: righe AUMENTATE (bacini %->%, candidati %->%)', p_pool, v_pool, p_cand, v_cand;
  END IF;

  RAISE NOTICE '000278 — bacini % -> %, candidati % -> %; ruoli critici riagganciati. ORA VA ESEGUITO db/seeds/storia36/05_career.sql, che crea i bacini mancanti e li popola. Rollback: SELECT staging.storia36_160_rollback();',
               p_pool, v_pool, p_cand, v_cand;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOPO L'APPLICAZIONE — obbligatorio, in quest'ordine
-- ═══════════════════════════════════════════════════════════════════════════════
--   psql -f db/seeds/storia36/05_career.sql      (crea i bacini mancanti e li popola)
--   bash db/scripts/storia36.sh custodia         (atteso: C5b e C5g verdi)
--
-- ROLLBACK
--   SELECT staging.storia36_160_rollback();
-- ═══════════════════════════════════════════════════════════════════════════════
