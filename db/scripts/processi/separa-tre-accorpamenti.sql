-- Separa tre accorpamenti del consolidamento di RTL Bank e ne fa tre sottoprocessi.
-- Piano: docs/piani/PIANO_tre-accorpamenti-rtl_20261122.md.
--
-- Decisione di Enzo del 2026-11-22 (thread «Processi RTL», raccomandazione accettata con «Va bene»):
--   P26 «Sviluppo e gestione dei servizi/soluzioni IT (core banking)» non è accorpato in 16 «IT e cybersecurity»:
--       diventa un sottoprocesso di 16;
--   P20 «Gestione del credito e delle politiche di affidamento» non è accorpato in 05 «Erogazione del credito»:
--       diventa un sottoprocesso di 05;
--   P04 «Gestione del rischio operativo e antiriciclaggio (AML)» esce da 10 «Gestione del rischio» e va dentro
--       02 «Adeguata verifica e antiriciclaggio», come suo sottoprocesso.
--
-- COSA FA, in una transazione, con la stessa semantica dell'applicazione del consolidamento (applicazione.ts):
--   1. una decisione RIFIUTATA nuova per ciascuna delle tre corrispondenze, che sostituisce la CONFERMATA del
--      2026-11-17 (decided_by = l'Amministratore di Sistema che l'ha presa, ragione scritta);
--   2. il ritiro di ciò che la CONFERMATA aveva scritto: la descrizione presa dal P e copiata in 10, 05 e 16 torna
--      com'era (vuota), solo se nessuno l'ha cambiata dopo, dal giornale staging.tenant_consolidation_undo;
--   3. il collegamento della proposta porta la decisione nuova e il rapporto;
--   4. tre processi nuovi P04, P20, P26 al livello 2, con nome e descrizione del modello in uso
--      (sys_blueprint_process_registry della versione del consolidamento), come i 21 sottoprocessi adottati.
-- Giornale: staging.tenant_consolidation_undo (righe INSERT della decisione nuova). Inversa: separa-tre-accorpamenti-inversa.sql.
-- Nessuna tabella nuova: lo script gira col ruolo degli agenti, che non crea strutture.
--
-- GUARDIE (si ferma senza scrivere): le tre proposte sono correnti e la loro decisione in vigore è CONFERMATA;
-- nessun processo del tenant ha già i codici P04, P20, P26; i genitori 02, 05, 16 sono attivi e di primo livello.
-- POST-CONDIZIONI: 21 processi attivi di primo livello e 24 sottoprocessi; le colonne dei processi che esistevano
-- prima sono invariate tranne le tre descrizioni ritirate; nessun difetto in sys.v_tenant_processes_parent_defects.
--
-- PROVA A SECCO: senza -v applica=1 la transazione si chiude con ROLLBACK e lo dice.
-- UNA SOLA APPLICAZIONE: una seconda corsa dice «GIÀ APPLICATO» ed esce. Dopo l'inversa i tre codici restano come
-- righe spente e la guardia ferma una nuova andata: rifarla vuol dire riaccenderli, ed è una decisione nuova.
-- NIENTE CANCELLAZIONI.
\set ON_ERROR_STOP on
\if :{?applica}
\else
  \set applica 0
\endif

-- Già applicato? Le tre corrispondenze sono RIFIUTATA e i tre sottoprocessi esistono attivi: si esce puliti.
SELECT (SELECT count(*) FROM sys.sys_tenant_consolidation_links l
          JOIN sys.sys_tenant_consolidation_proposals p ON p.tenant_consolidation_proposal_id = l.tenant_consolidation_link_proposal_id
         WHERE p.tenant_consolidation_proposal_group = 'PROCESSES' AND p.tenant_consolidation_proposal_superseded_at IS NULL
           AND p.tenant_consolidation_proposal_prototype_keys[1] IN ('P04','P20','P26')
           AND l.tenant_consolidation_link_decision = 'RIFIUTATA') = 3
   AND (SELECT count(*) FROM sys.sys_tenant_processes
         WHERE tenant_process_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND tenant_process_is_active
           AND tenant_process_level = 2 AND tenant_process_code IN ('P04','P20','P26')) = 3 AS gia_applicato \gset
\if :gia_applicato
  \echo 'GIÀ APPLICATO: le tre corrispondenze sono RIFIUTATA e P04, P20, P26 sono sottoprocessi attivi. Niente da fare.'
  \quit
\endif

BEGIN;

CREATE TEMP TABLE mappa(figlio text PRIMARY KEY, genitore text NOT NULL) ON COMMIT DROP;
INSERT INTO mappa VALUES ('P04','02'), ('P20','05'), ('P26','16');

CREATE TEMP TABLE ctx ON COMMIT DROP AS
SELECT '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid AS tenant,
       '8f4d0161-04ab-5ddb-b5a1-c8656f9c1fa1'::uuid AS decisore,
       'Decisione dell''Amministratore di Sistema del 2026-11-22: la corrispondenza non regge, il processo del modello resta separato come sottoprocesso.'::text AS ragione;

-- I collegamenti delle tre proposte si bloccano prima di leggerli: una decisione presa dalla pagina nel frattempo
-- aspetta la fine di questa transazione invece di essere sovrascritta.
SELECT count(*) AS collegamenti_bloccati FROM (
  SELECT 1 FROM sys.sys_tenant_consolidation_links l
    JOIN sys.sys_tenant_consolidation_proposals p ON p.tenant_consolidation_proposal_id = l.tenant_consolidation_link_proposal_id
   WHERE p.tenant_consolidation_proposal_group = 'PROCESSES' AND p.tenant_consolidation_proposal_superseded_at IS NULL
     AND p.tenant_consolidation_proposal_prototype_keys[1] IN ('P04','P20','P26')
     FOR UPDATE OF l) x;

-- Le tre proposte correnti con la decisione in vigore (quella del collegamento).
CREATE TEMP TABLE prop ON COMMIT DROP AS
SELECT m.figlio, m.genitore, p.tenant_consolidation_proposal_id AS proposta, c.tenant_consolidation_id AS cons,
       c.tenant_consolidation_variant_version_id AS versione,
       l.tenant_consolidation_link_decision_id AS dec_prima, l.tenant_consolidation_link_decision AS valore_prima,
       gen_random_uuid() AS dec_nuova
  FROM mappa m
  JOIN sys.sys_tenant_consolidation_proposals p
    ON p.tenant_consolidation_proposal_group = 'PROCESSES'
   AND p.tenant_consolidation_proposal_prototype_keys = ARRAY[m.figlio]
   AND p.tenant_consolidation_proposal_superseded_at IS NULL
  JOIN sys.sys_tenant_consolidations c ON c.tenant_consolidation_id = p.tenant_consolidation_proposal_consolidation_id
  JOIN sys.sys_tenant_consolidation_links l ON l.tenant_consolidation_link_proposal_id = p.tenant_consolidation_proposal_id
 WHERE c.tenant_consolidation_tenant_id = (SELECT tenant FROM ctx);

CREATE TEMP TABLE pr ON COMMIT DROP AS
SELECT tenant_process_code c, tenant_process_id id, tenant_process_level lv, tenant_process_is_active att
  FROM sys.sys_tenant_processes WHERE tenant_process_tenant_id = (SELECT tenant FROM ctx);

DO $$
DECLARE n_prop int; n_conf int; n_gia int; n_gen int; n_mod int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE valore_prima = 'CONFERMATA') INTO n_prop, n_conf FROM prop;
  SELECT count(*) INTO n_gia FROM pr WHERE c IN (SELECT figlio FROM mappa);
  SELECT count(*) INTO n_gen FROM pr WHERE c IN (SELECT genitore FROM mappa) AND lv = 1 AND att;
  SELECT count(*) INTO n_mod FROM prop p JOIN sys.sys_blueprint_process_registry r
    ON r.blueprint_process_variant_version_id = p.versione AND r.blueprint_process_code = p.figlio;
  RAISE NOTICE 'misura: % proposte (% CONFERMATA), % codici già presenti, % genitori validi, % voci del modello',
    n_prop, n_conf, n_gia, n_gen, n_mod;
  IF n_prop <> 3 OR n_conf <> 3 THEN RAISE EXCEPTION 'guardia: le tre proposte non sono tutte correnti e confermate, niente scritto'; END IF;
  IF n_gia <> 0 THEN RAISE EXCEPTION 'guardia: % dei codici P04, P20, P26 esistono già nel tenant, niente scritto', n_gia; END IF;
  IF n_gen <> 3 THEN RAISE EXCEPTION 'guardia: i genitori 02, 05, 16 non sono tutti attivi di primo livello, niente scritto'; END IF;
  IF n_mod <> 3 THEN RAISE EXCEPTION 'guardia: il modello in uso non ha tutte e tre le voci, niente scritto'; END IF;
END $$;

-- Il ritiro deve trovare esattamente una riga aperta per proposta, sulla descrizione: se la decisione del
-- 2026-11-17 avesse scritto anche nome o codice (forma NOME_PROTOTIPO) lo script si ferma invece di lasciarli.
DO $$
DECLARE n_aperte int; n_desc int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE u.table_name = 'sys_tenant_processes' AND u.column_name = 'tenant_process_description')
    INTO n_aperte, n_desc
    FROM staging.tenant_consolidation_undo u JOIN prop p ON p.proposta = u.proposal_id
   WHERE u.kind = 'UPDATE' AND u.reverted_at IS NULL;
  IF n_aperte <> 3 OR n_desc <> 3 THEN
    RAISE EXCEPTION 'guardia: righe aperte del giornale % (sulla descrizione %), attese 3 e 3, niente scritto', n_aperte, n_desc;
  END IF;
END $$;

CREATE TEMP TABLE impronta_prima ON COMMIT DROP AS
SELECT count(*) n, md5(string_agg((to_jsonb(t) - 'tenant_process_description' - 'updated_at')::text, '|' ORDER BY t.tenant_process_id)) h
  FROM sys.sys_tenant_processes t;

-- 1. Le decisioni nuove.
INSERT INTO sys.sys_tenant_consolidation_decisions
  (tenant_consolidation_decision_id, tenant_consolidation_decision_proposal_id, tenant_consolidation_decision_tenant_id,
   tenant_consolidation_decision_value, tenant_consolidation_decision_form, tenant_consolidation_decision_adr48_state,
   tenant_consolidation_decision_reason, tenant_consolidation_decision_decided_by, tenant_consolidation_decision_supersedes_id)
SELECT p.dec_nuova, p.proposta, x.tenant, 'RIFIUTATA', NULL, NULL, x.ragione, x.decisore, p.dec_prima
  FROM prop p CROSS JOIN ctx x;

-- 2. Il ritiro delle descrizioni scritte dalla CONFERMATA, solo dove sono ancora quelle scritte.
CREATE TEMP TABLE ritiro ON COMMIT DROP AS
SELECT u.undo_id, u.record_id, u.value_before, u.value_after, p.figlio
  FROM staging.tenant_consolidation_undo u JOIN prop p ON p.proposta = u.proposal_id
 WHERE u.kind = 'UPDATE' AND u.reverted_at IS NULL
   AND u.table_name = 'sys_tenant_processes' AND u.column_name = 'tenant_process_description';

CREATE TEMP TABLE rimesse ON COMMIT DROP AS
WITH r AS (
  UPDATE sys.sys_tenant_processes t SET tenant_process_description = ri.value_before, updated_at = now()
    FROM ritiro ri
   WHERE t.tenant_process_id = ri.record_id AND t.tenant_process_tenant_id = (SELECT tenant FROM ctx)
     AND t.tenant_process_description IS NOT DISTINCT FROM ri.value_after
  RETURNING ri.figlio, ri.undo_id
) SELECT * FROM r;

UPDATE staging.tenant_consolidation_undo u SET reverted_at = now() FROM ritiro ri WHERE u.undo_id = ri.undo_id;

-- 4. I tre sottoprocessi.
CREATE TEMP TABLE creati ON COMMIT DROP AS
WITH ins AS (
  INSERT INTO sys.sys_tenant_processes
    (tenant_process_tenant_id, tenant_process_code, tenant_process_name, tenant_process_description,
     tenant_process_parent_id, tenant_process_level, tenant_process_metadata)
  SELECT x.tenant, r.blueprint_process_code, r.blueprint_process_name, r.blueprint_process_description,
         g.id, 2, jsonb_build_object('decisione', '2026-11-22', 'separato_da', p.figlio)
    FROM prop p CROSS JOIN ctx x
    JOIN sys.sys_blueprint_process_registry r
      ON r.blueprint_process_variant_version_id = p.versione AND r.blueprint_process_code = p.figlio
    JOIN pr g ON g.c = p.genitore
  RETURNING tenant_process_id, tenant_process_code
) SELECT * FROM ins;

-- 3. I collegamenti portano la decisione nuova e il rapporto, solo se la decisione in vigore è ancora quella letta.
CREATE TEMP TABLE collegati ON COMMIT DROP AS
WITH u AS (
UPDATE sys.sys_tenant_consolidation_links l
   SET tenant_consolidation_link_decision_id = p.dec_nuova,
       tenant_consolidation_link_decision = 'RIFIUTATA',
       tenant_consolidation_link_form = NULL,
       tenant_consolidation_link_adr48_state = NULL,
       tenant_consolidation_link_report = jsonb_build_object(
         'changed', '[]'::jsonb, 'created', '[]'::jsonb,
         'reverted', (SELECT count(*) FROM rimesse m WHERE m.figlio = p.figlio),
         'skipped', jsonb_build_array('Il processo del modello resta separato: creato come sottoprocesso di ' || p.genitore || '.')),
       tenant_consolidation_link_applied_at = now()
  FROM prop p
 WHERE l.tenant_consolidation_link_proposal_id = p.proposta
   AND l.tenant_consolidation_link_decision_id = p.dec_prima
RETURNING l.tenant_consolidation_link_id
) SELECT * FROM u;

-- Il giornale dell'applicazione: una riga INSERT per processo creato, legata alla decisione nuova, come fa
-- l'adozione (applicazione.ts). L'inversa la legge da qui.
INSERT INTO staging.tenant_consolidation_undo (tenant_id, proposal_id, decision_id, kind, table_name, record_id, value_after)
SELECT x.tenant, p.proposta, p.dec_nuova, 'INSERT', 'sys_tenant_processes', c.tenant_process_id, c.tenant_process_code
  FROM prop p CROSS JOIN ctx x JOIN creati c ON c.tenant_process_code = p.figlio;

DO $$
DECLARE a bigint; b text; l1 int; l2 int; dif int; nr int; nc int;
BEGIN
  SELECT count(*), md5(string_agg((to_jsonb(t) - 'tenant_process_description' - 'updated_at')::text, '|' ORDER BY t.tenant_process_id))
    INTO a, b FROM sys.sys_tenant_processes t WHERE t.tenant_process_id NOT IN (SELECT tenant_process_id FROM creati);
  IF a <> (SELECT n FROM impronta_prima) OR b <> (SELECT h FROM impronta_prima) THEN
    RAISE EXCEPTION 'post-condizione: sono cambiate altre colonne dei processi';
  END IF;
  SELECT count(*) FILTER (WHERE tenant_process_level = 1), count(*) FILTER (WHERE tenant_process_level = 2)
    INTO l1, l2 FROM sys.sys_tenant_processes
   WHERE tenant_process_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND tenant_process_is_active;
  SELECT count(*) INTO dif FROM sys.v_tenant_processes_parent_defects;
  SELECT count(*) INTO nr FROM rimesse;
  SELECT count(*) INTO nc FROM creati;
  IF nc <> 3 OR dif <> 0 THEN RAISE EXCEPTION 'post-condizione: creati % (attesi 3), difetti %', nc, dif; END IF;
  IF nr <> 3 THEN RAISE EXCEPTION 'post-condizione: descrizioni ritirate % (attese 3): qualcuno le aveva cambiate', nr; END IF;
  IF (SELECT count(*) FROM collegati) <> 3 THEN RAISE EXCEPTION 'post-condizione: collegamenti aggiornati % (attesi 3)', (SELECT count(*) FROM collegati); END IF;
  IF l1 <> 21 OR l2 <> 24 THEN RAISE EXCEPTION 'post-condizione: % processi di primo livello e % sottoprocessi (attesi 21 e 24)', l1, l2; END IF;
  RAISE NOTICE 'fatto: % processi di primo livello e % sottoprocessi attivi, % descrizioni ritirate, % creati, 0 difetti', l1, l2, nr, nc;
END $$;

SELECT figlio || ' sotto ' || genitore AS collocazione FROM prop ORDER BY figlio;

\if :applica
  COMMIT;
  \echo 'APPLICATO'
\else
  ROLLBACK;
  \echo 'PROVA A SECCO: niente scritto (per applicare: -v applica=1)'
\endif
