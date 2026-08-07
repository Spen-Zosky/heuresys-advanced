-- @migrate: once
-- ═══════════════════════════════════════════════════════════════════════════════
-- 000277_realign_career_paths_and_targets.sql
--
-- #155 — I PERCORSI DI CARRIERA E GLI OBIETTIVI SEGUONO LE PERSONE CHE SI SONO
--        SPOSTATE. È il pezzo dimenticato dalla riparazione della ricostruzione.
--
-- IL DIFETTO
--   La ricostruzione dell'organigramma (000244→000251) ha creato posizioni nuove e
--   disattivato le vecchie. Tre cataloghi dipendevano da quell'albero: i requisiti
--   (#112, riparati da 000260), l'albero delle posizioni (#114, riparato da 000258)
--   e i percorsi di carriera. Il terzo non fu toccato.
--
--   Misurato il 2026-08-07 sul database vivo:
--     · `sys_position_career_paths`  252 righe, **207 su posizioni disattivate**
--       (152 posizioni distinte, tutti e 7 i percorsi colpiti);
--     · `sys_user_target_positions`  **97 obiettivi su 153 non-rifiutati puntano a
--       una posizione disattivata** (19 posizioni distinte) — questa metà non era
--       nella scheda #155 ed è emersa riparando la prima;
--     · conseguenza per le persone: **130 obiettivi su 153 irraggiungibili** da
--       qualunque percorso (`C5c(iii)`, es. `alberto.colombo@rtl-bank.org`).
--
-- LA MAPPA È LA PERSONA, NON IL TITOLO — la stessa di 000260
--   Ogni assegnazione chiusa dalla ricostruzione porta in nota «chiusa dalla
--   ricostruzione organigramma (fase N)»: si sa CHI occupava la posizione vecchia,
--   e quella persona oggi ne ha esattamente una attiva. 133 coppie, identiche a
--   quelle che 000260 usò per i requisiti. Nessuna corrispondenza è inventata.
--   Le 19 posizioni senza successore erano già vacanti prima della ricostruzione.
--
-- PERCHÉ ANCHE GLI OBIETTIVI, E PERCHÉ NON BASTAVA LA MAPPA
--   Un percorso è un'affermazione sulla POSIZIONE e la segue (§2). Un obiettivo è
--   un'aspirazione della PERSONA: applicargli la mappa dice «chi aspirava a X ora
--   aspira a Y», che non è la stessa affermazione. Misurato: la sola mappa porta
--   `C5c(iii)` a zero ma lascia **47 obiettivi che non sono una crescita**
--   (`C5c(iv)`, già rosso oggi con 105 casi — non si vedeva perché (iii) abortiva
--   prima). Enzo ha autorizzato entrambi i passi il 2026-08-07.
--
--   Per i 47 non si sceglie a intuito: si RI-DERIVA con la regola che li ha
--   generati, `db/seeds/storia36/05_career.sql:184-211`, contro l'organigramma di
--   oggi. Quella regola pretende le stesse tre cose del check — più in alto
--   davvero, mestiere diverso, qualcuno ci lavora. Seed e check sono d'accordo: è
--   l'albero che è cambiato sotto. Tutti e 164 gli obiettivi portano
--   `metadata->>'storia36' = 'C5'`, cioè sono dato generato: ri-derivarli ripara il
--   generatore, non cancella l'aspirazione di una persona.
--
-- LA CHIAVE CONTIENE IL BERSAGLIO
--   L'id è `uuid_generate_v5(ns, 'STORIA36::C5::TARGET::'||user||'::'||target)`.
--   Cambiare il bersaglio senza ricalcolare l'id lascerebbe una riga che il seed
--   non riconosce più: alla corsa successiva ne inserirebbe una seconda invece di
--   saltarla. Qui l'id si ricalcola (§5), così `storia36.sh` resta idempotente.
--
-- ROLLBACK COMPLETO (richiesto da Enzo, 2026-08-07)
--   Ogni riga toccata è archiviata PRIMA in `staging.storia36_155_undo` con la
--   propria versione precedente. `SELECT staging.storia36_155_rollback();` riporta
--   il database esattamente allo stato di partenza — spostamenti, rimozioni e
--   ricalcoli di chiave compresi. È la differenza da 000260, che dichiarava di
--   essere reversibile «solo dallo snapshot» perché la riga non conservava la
--   provenienza. Il rollback è stato COLLAUDATO prima dell'applicazione.
--
-- Rieseguibile: agisce solo su ciò che punta a una posizione disattivata o che il
-- check rifiuta; su un database già allineato non tocca niente. Marcata `once`
-- perché §3 e §5 cancellano righe: senza il marcatore la catena, che gira a ogni
-- deploy, trasformerebbe «rimuovi ciò che non è una crescita» in una regola
-- permanente, e un obiettivo legittimo creato in futuro da una persona vera
-- sarebbe mangiato al deploy successivo.
-- Prerequisiti: 000251, 000258, 000260 applicate.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- §0. L'ARCHIVIO DEL RITORNO — si scrive PRIMA di toccare qualunque riga
-- ───────────────────────────────────────────────────────────────────────────────
-- ATTENZIONE — la chiave NON è un identificatore univoco d'archivio, e il primo
-- collaudo lo ha dimostrato: §5 RICALCOLA le chiavi primarie, quindi una riga può
-- assumere la chiave che un'altra aveva un istante prima. Con un indice unico su
-- (tabella, chiave) le due voci collidono, `ON CONFLICT DO NOTHING` ne scarta una
-- in silenzio, e due righe restano non ripristinabili — misurato: 164 -> 162 al
-- ritorno. L'archivio è quindi un GIORNALE ordinato, e si disfa a ritroso.
CREATE TABLE IF NOT EXISTS staging.storia36_155_undo (
  undo_id      bigserial PRIMARY KEY,
  applicata_il timestamptz NOT NULL DEFAULT now(),
  passo        smallint NOT NULL,
  tabella      text NOT NULL,
  operazione   text NOT NULL,
  chiave       uuid NOT NULL,   -- l'id della riga DOPO l'operazione (per ritrovarla)
  riga_prima   jsonb NOT NULL,  -- la riga com'era PRIMA, integrale
  CONSTRAINT storia36_155_undo_op_check CHECK (operazione IN ('UPDATE','DELETE'))
);
COMMENT ON TABLE staging.storia36_155_undo IS
  '#155/000277 — giornale ordinato dello stato precedente di ogni riga toccata. Si disfa a ritroso (undo_id DESC) via staging.storia36_155_rollback().';

-- ───────────────────────────────────────────────────────────────────────────────
-- §1. LA MAPPA vecchia -> nuova (identica a 000260 §1)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE mappa_pos ON COMMIT DROP AS
SELECT DISTINCT ON (vecchia.pos_id)
       vecchia.pos_id AS pos_vecchia, nuova.position_id AS pos_nuova
  FROM (
    SELECT DISTINCT a.user_position_assignment_position_id AS pos_id,
           a.user_position_assignment_user_id AS persona
      FROM sys.sys_user_position_assignments a
      JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
     WHERE a.user_position_assignment_status = 'ENDED'
       AND a.user_position_assignment_notes LIKE '%ricostruzione organigramma%'
       AND NOT p.position_is_active
  ) vecchia
  JOIN sys.sys_user_position_assignments att
    ON att.user_position_assignment_user_id = vecchia.persona
   AND att.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions nuova
    ON nuova.position_id = att.user_position_assignment_position_id
   AND nuova.position_is_active
 ORDER BY vecchia.pos_id, nuova.position_id;

CREATE TEMP TABLE prima_di ON COMMIT DROP AS
SELECT (SELECT count(*) FROM sys.sys_position_career_paths) AS pcp_tot,
       (SELECT count(*) FROM sys.sys_position_career_paths pcp
          JOIN sys.sys_positions p ON p.position_id = pcp.position_id
         WHERE NOT p.position_is_active) AS pcp_morte,
       (SELECT count(*) FROM sys.sys_user_target_positions) AS utp_tot;

-- ───────────────────────────────────────────────────────────────────────────────
-- §2. I PERCORSI SEGUONO LA POSIZIONE — 186 righe attese
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO staging.storia36_155_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 2, 'sys_position_career_paths', 'UPDATE', pcp.position_career_path_id, to_jsonb(pcp)
  FROM sys.sys_position_career_paths pcp
  JOIN mappa_pos m ON m.pos_vecchia = pcp.position_id;

UPDATE sys.sys_position_career_paths pcp
   SET position_id = m.pos_nuova, updated_at = now()
  FROM mappa_pos m
 WHERE pcp.position_id = m.pos_vecchia;

-- ───────────────────────────────────────────────────────────────────────────────
-- §3. LE TAPPE SENZA SUCCESSORE — 21 righe attese, su 19 posizioni già vacanti
--     prima della ricostruzione. Enzo ha autorizzato la rimozione il 2026-08-07,
--     sapendo che due percorsi perdono il gradino d'ingresso (nessun `Cassiere`
--     resta in `Banking Operations Track`).
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO staging.storia36_155_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 3, 'sys_position_career_paths', 'DELETE', pcp.position_career_path_id, to_jsonb(pcp)
  FROM sys.sys_position_career_paths pcp
  JOIN sys.sys_positions p ON p.position_id = pcp.position_id
 WHERE NOT p.position_is_active;

DELETE FROM sys.sys_position_career_paths pcp
 USING sys.sys_positions p
 WHERE p.position_id = pcp.position_id AND NOT p.position_is_active;

-- ───────────────────────────────────────────────────────────────────────────────
-- §4. GLI OBIETTIVI CHE PUNTANO A UNA POSIZIONE SPENTA — 104 righe attese
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO staging.storia36_155_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 4, 'sys_user_target_positions', 'UPDATE', t.user_target_position_id, to_jsonb(t)
  FROM sys.sys_user_target_positions t
  JOIN mappa_pos m ON m.pos_vecchia = t.user_target_position_position_id;

UPDATE sys.sys_user_target_positions t
   SET user_target_position_position_id = m.pos_nuova
  FROM mappa_pos m
 WHERE t.user_target_position_position_id = m.pos_vecchia;

-- ───────────────────────────────────────────────────────────────────────────────
-- §5. GLI OBIETTIVI CHE NON SONO UNA CRESCITA — ri-derivati con la regola del seed
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.h155(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

CREATE TEMP TABLE prof ON COMMIT DROP AS
WITH RECURSIVE disc AS (
  SELECT p.position_id, p.position_tenant_id, 0 AS livello
    FROM sys.sys_positions p WHERE p.position_reports_to_position_id IS NULL
  UNION ALL
  SELECT p.position_id, p.position_tenant_id, d.livello + 1
    FROM sys.sys_positions p JOIN disc d ON d.position_id = p.position_reports_to_position_id
)
SELECT position_id, position_tenant_id, min(livello) AS livello FROM disc GROUP BY 1, 2;

-- gli obiettivi che il check C5c(iv) rifiuta, con la posizione attuale di chi li ha
CREATE TEMP TABLE rotti ON COMMIT DROP AS
SELECT t.user_target_position_id AS tid, t.user_target_position_user_id AS uid,
       a.user_position_assignment_position_id AS pos
  FROM sys.sys_user_target_positions t
  JOIN sys.sys_user_position_assignments a
    ON a.user_position_assignment_user_id = t.user_target_position_user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions p_ora  ON p_ora.position_id  = a.user_position_assignment_position_id
  JOIN sys.sys_positions p_meta ON p_meta.position_id = t.user_target_position_position_id
  LEFT JOIN prof l_ora  ON l_ora.position_id  = p_ora.position_id
  LEFT JOIN prof l_meta ON l_meta.position_id = p_meta.position_id
 WHERE t.user_target_position_review_status <> 'REJECTED'
   AND (l_meta.livello IS NULL OR l_ora.livello IS NULL
     OR l_meta.livello >= l_ora.livello
     OR p_meta.position_title = p_ora.position_title
     OR NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a2
                     WHERE a2.user_position_assignment_position_id = p_meta.position_id
                       AND a2.user_position_assignment_status = 'ACTIVE'));

-- il bersaglio nuovo, UNO PER PERSONA come fa il seed (PARTITION BY user_id)
CREATE TEMP TABLE bersaglio ON COMMIT DROP AS
WITH cand AS (
  SELECT DISTINCT r.uid, pcp_meta.position_id AS target,
         row_number() OVER (PARTITION BY r.uid
           ORDER BY lm.livello DESC, pg_temp.h155(r.uid::text || pcp_meta.position_id::text)) AS rango
    FROM rotti r
    JOIN prof l_ora ON l_ora.position_id = r.pos
    JOIN sys.sys_position_career_paths pcp_ora
      ON pcp_ora.position_id = r.pos
     AND pcp_ora.position_career_path_metadata->>'storia36' = 'C5'
    JOIN sys.sys_position_career_paths pcp_meta
      ON pcp_meta.career_path_id = pcp_ora.career_path_id
     AND pcp_meta.position_id <> r.pos
     AND pcp_meta.position_career_path_metadata->>'storia36' = 'C5'
    JOIN prof lm ON lm.position_id = pcp_meta.position_id
    JOIN sys.sys_positions p_meta ON p_meta.position_id = pcp_meta.position_id
    JOIN sys.sys_positions p_ora  ON p_ora.position_id  = r.pos
   WHERE lm.livello < l_ora.livello
     AND p_meta.position_title <> p_ora.position_title
     AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                  WHERE a.user_position_assignment_position_id = pcp_meta.position_id
                    AND a.user_position_assignment_status = 'ACTIVE'))
SELECT uid, target FROM cand WHERE rango = 1;

-- una sola riga per persona sopravvive e prende il bersaglio; la chiave si ricalcola
CREATE TEMP TABLE applica ON COMMIT DROP AS
SELECT DISTINCT ON (r.uid) r.tid, r.uid, b.target,
       uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8',
         'STORIA36::C5::TARGET::' || b.uid || '::' || b.target) AS id_nuovo
  FROM rotti r JOIN bersaglio b ON b.uid = r.uid
 ORDER BY r.uid, r.tid;

INSERT INTO staging.storia36_155_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 5, 'sys_user_target_positions', 'UPDATE', a.id_nuovo, to_jsonb(t)
  FROM sys.sys_user_target_positions t
  JOIN applica a ON a.tid = t.user_target_position_id
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_target_positions x
                    WHERE x.user_target_position_id = a.id_nuovo);

UPDATE sys.sys_user_target_positions t
   SET user_target_position_position_id = a.target,
       user_target_position_id = a.id_nuovo
  FROM applica a
 WHERE t.user_target_position_id = a.tid
   AND NOT EXISTS (SELECT 1 FROM sys.sys_user_target_positions x
                    WHERE x.user_target_position_id = a.id_nuovo);

-- ciò che resta rifiutato è un doppione della stessa aspirazione: la persona ha
-- già la sua riga con il bersaglio ri-derivato.
INSERT INTO staging.storia36_155_undo (passo, tabella, operazione, chiave, riga_prima)
SELECT 6, 'sys_user_target_positions', 'DELETE', t.user_target_position_id, to_jsonb(t)
  FROM sys.sys_user_target_positions t
  JOIN rotti r ON r.tid = t.user_target_position_id
 WHERE t.user_target_position_id NOT IN (SELECT id_nuovo FROM applica);

DELETE FROM sys.sys_user_target_positions t
 USING rotti r
 WHERE t.user_target_position_id = r.tid
   AND t.user_target_position_id NOT IN (SELECT id_nuovo FROM applica);

ANALYZE sys.sys_position_career_paths;
ANALYZE sys.sys_user_target_positions;

-- ───────────────────────────────────────────────────────────────────────────────
-- §6. IL RITORNO — la funzione che disfa tutto, versionata insieme all'andata
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staging.storia36_155_rollback()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  r record; n_upd int := 0; n_ins int := 0; n_persi int := 0;
BEGIN
  -- Il trigger `sys_utp_set_updated_at` riscrive `updated_at = now()` a ogni
  -- UPDATE: lasciandolo attivo, il ritorno riporta i dati ma non gli orari, e
  -- l'impronta della tabella non coincide più con quella di partenza (misurato al
  -- secondo collaudo: righe identiche, digest diverso). Si sospende per la durata
  -- del ritorno; se qualcosa solleva, la transazione annulla anche la sospensione.
  ALTER TABLE sys.sys_user_target_positions DISABLE TRIGGER sys_utp_set_updated_at;

  -- SI DISFA A RITROSO, UNA RIGA PER VOLTA. Non è pignoleria: §5 ricalcola le
  -- chiavi primarie, quindi l'ordine conta. Disfare §5 prima di §4 libera la
  -- chiave che §4 dovrà riprendersi; un UPDATE set-based, che non ha ordine, qui
  -- perde righe — è il difetto che il primo collaudo ha fatto emergere.
  FOR r IN SELECT * FROM staging.storia36_155_undo ORDER BY undo_id DESC
  LOOP
    IF r.operazione = 'UPDATE' AND r.tabella = 'sys_position_career_paths' THEN
      UPDATE sys.sys_position_career_paths
         SET position_id = (r.riga_prima->>'position_id')::uuid,
             updated_at  = (r.riga_prima->>'updated_at')::timestamptz
       WHERE position_career_path_id = r.chiave;
      IF FOUND THEN n_upd := n_upd + 1; ELSE n_persi := n_persi + 1; END IF;

    ELSIF r.operazione = 'UPDATE' AND r.tabella = 'sys_user_target_positions' THEN
      UPDATE sys.sys_user_target_positions
         SET user_target_position_id          = (r.riga_prima->>'user_target_position_id')::uuid,
             user_target_position_position_id = (r.riga_prima->>'user_target_position_position_id')::uuid,
             updated_at                       = (r.riga_prima->>'updated_at')::timestamptz
       WHERE user_target_position_id = r.chiave;
      IF FOUND THEN n_upd := n_upd + 1; ELSE n_persi := n_persi + 1; END IF;

    ELSIF r.operazione = 'DELETE' AND r.tabella = 'sys_position_career_paths' THEN
      INSERT INTO sys.sys_position_career_paths
      SELECT (jsonb_populate_record(NULL::sys.sys_position_career_paths, r.riga_prima)).*
      ON CONFLICT (position_career_path_id) DO NOTHING;
      IF FOUND THEN n_ins := n_ins + 1; ELSE n_persi := n_persi + 1; END IF;

    ELSIF r.operazione = 'DELETE' AND r.tabella = 'sys_user_target_positions' THEN
      INSERT INTO sys.sys_user_target_positions
      SELECT (jsonb_populate_record(NULL::sys.sys_user_target_positions, r.riga_prima)).*
      ON CONFLICT (user_target_position_id) DO NOTHING;
      IF FOUND THEN n_ins := n_ins + 1; ELSE n_persi := n_persi + 1; END IF;
    END IF;
  END LOOP;

  ALTER TABLE sys.sys_user_target_positions ENABLE TRIGGER sys_utp_set_updated_at;

  -- Un ritorno che salta righe non è un ritorno: meglio un errore che un database
  -- a metà strada, che nessuno saprebbe più riportare indietro.
  IF n_persi > 0 THEN
    RAISE EXCEPTION 'rollback 000277 NON integrale: % voci di archivio non hanno trovato la loro riga', n_persi;
  END IF;

  RETURN format('rollback 000277: %s righe ripristinate, %s re-inserite, 0 perse', n_upd, n_ins);
END $fn$;

COMMENT ON FUNCTION staging.storia36_155_rollback() IS
  '#155/000277 — riporta percorsi e obiettivi allo stato precedente leggendo staging.storia36_155_undo.';

-- ───────────────────────────────────────────────────────────────────────────────
-- §7. AUTO-VERIFICA
--     Le soglie sono RELATIVE allo stato, mai conteggi assoluti: su un clone senza
--     i dati di storia36 (la CI) tutte le tabelle sono vuote e le verifiche devono
--     passare lo stesso, perché «zero righe rotte» è vero anche su zero righe.
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_pcp_morte int; v_utp_morte int; v_non_crescita int; v_undo int;
  p_pcp int; p_pcp_morte int; p_utp int;
  v_pcp int; v_utp int;
BEGIN
  SELECT pcp_tot, pcp_morte, utp_tot INTO p_pcp, p_pcp_morte, p_utp FROM prima_di;
  SELECT count(*) INTO v_pcp FROM sys.sys_position_career_paths;
  SELECT count(*) INTO v_utp FROM sys.sys_user_target_positions;

  -- (1) l'obiettivo dichiarato: niente più punta a una posizione spenta
  SELECT count(*) INTO v_pcp_morte FROM sys.sys_position_career_paths pcp
    JOIN sys.sys_positions p ON p.position_id = pcp.position_id WHERE NOT p.position_is_active;
  IF v_pcp_morte > 0 THEN
    RAISE EXCEPTION '000277: restano % percorsi su posizioni non attive', v_pcp_morte;
  END IF;

  SELECT count(*) INTO v_utp_morte FROM sys.sys_user_target_positions t
    JOIN sys.sys_positions p ON p.position_id = t.user_target_position_position_id
   WHERE NOT p.position_is_active;
  IF v_utp_morte > 0 THEN
    RAISE EXCEPTION '000277: restano % obiettivi su posizioni non attive', v_utp_morte;
  END IF;

  -- (2) nessun obiettivo residuo che non sia una crescita (il predicato di C5c(iv))
  SELECT count(*) INTO v_non_crescita FROM rotti r
   WHERE EXISTS (SELECT 1 FROM sys.sys_user_target_positions t
                  WHERE t.user_target_position_id = r.tid);
  IF v_non_crescita > 0 THEN
    RAISE EXCEPTION '000277: % obiettivi non-crescita non sono stati ri-derivati', v_non_crescita;
  END IF;

  -- (3) il ritorno è possibile: ogni riga toccata ha la sua copia in archivio.
  --     Confronto contro il DELTA misurato, non contro una costante: se la
  --     migrazione non ha avuto nulla da fare (clone vuoto), l'archivio è vuoto ed
  --     è corretto che lo sia.
  SELECT count(*) INTO v_undo FROM staging.storia36_155_undo;
  IF (p_pcp - v_pcp) + (p_utp - v_utp) > v_undo THEN
    RAISE EXCEPTION '000277: archivio incompleto — % righe sparite, % in archivio: il rollback non sarebbe integrale',
                    (p_pcp - v_pcp) + (p_utp - v_utp), v_undo;
  END IF;

  -- (4) non si creano righe dal nulla: questa migrazione sposta e rimuove soltanto
  IF v_pcp > p_pcp OR v_utp > p_utp THEN
    RAISE EXCEPTION '000277: righe AUMENTATE (percorsi %->%, obiettivi %->%) — qui si sposta e si rimuove soltanto',
                    p_pcp, v_pcp, p_utp, v_utp;
  END IF;

  RAISE NOTICE '000277 — percorsi % -> % (di cui su posizioni spente % -> 0); obiettivi % -> %; archivio di ritorno: % righe. Rollback: SELECT staging.storia36_155_rollback();',
               p_pcp, v_pcp, p_pcp_morte, p_utp, v_utp, v_undo;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--   bash db/scripts/storia36.sh custodia
--   Atteso: C5c verde in tutte e quattro le parti — (i) perimetro tenant,
--   (ii) nessun auto-obiettivo, (iii) ogni obiettivo raggiungibile da un percorso,
--   (iv) ogni obiettivo è una crescita.
--
-- ROLLBACK
--   SELECT staging.storia36_155_rollback();
--   Ripristina bersagli, chiavi ricalcolate e righe rimosse. Collaudato prima
--   dell'applicazione dentro una transazione poi annullata.
-- ═══════════════════════════════════════════════════════════════════════════════
