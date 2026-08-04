-- ═══════════════════════════════════════════════════════════════════════════════
-- 000260_reattach_position_requirement_catalogs.sql
--
-- I CATALOGHI DEI REQUISITI SEGUONO LE PERSONE CHE SI SONO SPOSTATE.
--
-- Il difetto
--   La ricostruzione ha creato 133 posizioni nuove e disattivato 153 vecchie, ma i
--   tre cataloghi di requisiti sono rimasti agganciati alle vecchie:
--     · `sys_position_skill_requirements`     1678 righe, 157 su posizioni ricoperte
--     · `sys_position_learning_requirements`  1791 righe, 199 su posizioni ricoperte
--     · `sys_position_kpi_requirements`        172 righe,  28 su posizioni ricoperte
--
--   L'effetto peggiore non e' il numero di righe appese: e' che le MISURE hanno
--   smesso di vedere. La verifica «requisito della posizione attuale non coperto»
--   e' scesa da 635 a 53 — non perche' i divari siano stati colmati, ma perche'
--   l'universo su cui si misurano e' crollato da 1526 a 157. Un cruscotto che
--   migliora perche' ha perso i dati e' peggio di uno rosso.
--
--   Le 64 auto-verifiche delle otto migrazioni presidiavano l'invariante «161
--   assegnazioni attive» e l'integrita dell'organigramma. Nessuna guardava i
--   cataloghi agganciati per `position_id`. La 000252 ha ri-agganciato i job role,
--   che e' lo stesso problema, ma per un catalogo solo.
--
-- LA MAPPA E' LA PERSONA, NON IL TITOLO
--   La consegna proponeva di appaiare vecchia e nuova posizione per
--   `position_title` + unita di destinazione. Funziona, ma e' un criterio per
--   somiglianza. Ce n'e' uno ESATTO, e lo ha lasciato la ricostruzione stessa: ogni
--   assegnazione chiusa porta in nota «chiusa dalla ricostruzione organigramma
--   (fase N)», quindi si sa CHI occupava la posizione vecchia, e quella persona ha
--   oggi esattamente una posizione attiva. Misurato: 133 posizioni disattivate su
--   153 hanno un successore certo per questa via — le altre 20 erano gia' vacanti
--   prima della ricostruzione, quindi un successore non ce l'hanno e non devono
--   averlo.
--
-- SPOSTARE E NON COPIARE
--   Un requisito e' un'affermazione su una posizione VIVA («questa posizione
--   richiede X»), non un evento accaduto. Copiarlo lascerebbe 1521 righe appese a
--   posizioni spente e ne creerebbe altrettante: il doppio del rumore. Si sposta.
--   Dove la posizione nuova dichiara gia' lo stesso requisito, la riga vecchia
--   resta dov'e' invece di creare un doppione — e il conteggio finale lo dichiara.
--
-- Rieseguibile: agisce solo su cio' che punta a una posizione disattivata.
-- Prerequisiti: 000251 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. LA MAPPA vecchia -> nuova, ricavata da chi occupava la posizione
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE mappa_pos ON COMMIT DROP AS
SELECT DISTINCT ON (vecchia.pos_id)
       vecchia.pos_id  AS pos_vecchia,
       nuova.position_id AS pos_nuova
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

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. COMPETENZE
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_position_skill_requirements r
   SET position_id = m.pos_nuova, updated_at = now()
  FROM mappa_pos m
 WHERE r.position_id = m.pos_vecchia
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements x
                    WHERE x.position_id = m.pos_nuova AND x.skill_id = r.skill_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. FORMAZIONE
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_position_learning_requirements r
   SET position_id = m.pos_nuova, updated_at = now()
  FROM mappa_pos m
 WHERE r.position_id = m.pos_vecchia
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements x
                    WHERE x.position_id = m.pos_nuova AND x.learning_path_id = r.learning_path_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. INDICATORI
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_position_kpi_requirements r
   SET position_id = m.pos_nuova, updated_at = now()
  FROM mappa_pos m
 WHERE r.position_id = m.pos_vecchia
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_kpi_requirements x
                    WHERE x.position_id = m.pos_nuova AND x.kpi_definition_id = r.kpi_definition_id);

ANALYZE sys.sys_position_skill_requirements;
ANALYZE sys.sys_position_learning_requirements;
ANALYZE sys.sys_position_kpi_requirements;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_map int; n_sk int; n_le int; n_kp int; n_tot_sk int; n_tot_le int; n_tot_kp int;
  n_pos_con_skill int;
BEGIN
  SELECT count(*) INTO n_map FROM mappa_pos;
  IF n_map < 100 THEN
    RAISE EXCEPTION 'Mappa vecchia->nuova: solo % coppie, attese ~133 — la nota della ricostruzione non e stata trovata', n_map;
  END IF;

  -- Quante righe di catalogo stanno su posizioni RICOPERTE: e' la misura che era
  -- crollata, ed e' quella che deve risalire. I totali non cambiano: si sposta.
  SELECT count(*) INTO n_sk FROM sys.sys_position_skill_requirements r
    JOIN sys.sys_positions p ON p.position_id = r.position_id WHERE p.position_is_active;
  SELECT count(*) INTO n_le FROM sys.sys_position_learning_requirements r
    JOIN sys.sys_positions p ON p.position_id = r.position_id WHERE p.position_is_active;
  SELECT count(*) INTO n_kp FROM sys.sys_position_kpi_requirements r
    JOIN sys.sys_positions p ON p.position_id = r.position_id WHERE p.position_is_active;

  IF n_sk < 1000 THEN RAISE EXCEPTION 'Requisiti di competenza su posizioni attive: % (erano 157, attesi >1000)', n_sk; END IF;
  IF n_le < 1000 THEN RAISE EXCEPTION 'Requisiti formativi su posizioni attive: % (erano 199, attesi >1000)', n_le; END IF;
  IF n_kp <   80 THEN RAISE EXCEPTION 'Requisiti KPI su posizioni attive: % (erano 28, attesi >80)', n_kp; END IF;

  -- e nulla si e' perso: i totali restano quelli di prima
  SELECT count(*) INTO n_tot_sk FROM sys.sys_position_skill_requirements;
  SELECT count(*) INTO n_tot_le FROM sys.sys_position_learning_requirements;
  SELECT count(*) INTO n_tot_kp FROM sys.sys_position_kpi_requirements;
  IF n_tot_sk <> 1678 OR n_tot_le <> 1791 OR n_tot_kp <> 172 THEN
    RAISE EXCEPTION 'I totali sono cambiati: competenze % (1678), formazione % (1791), kpi % (172) — questa migrazione SPOSTA, non crea ne cancella',
                    n_tot_sk, n_tot_le, n_tot_kp;
  END IF;

  -- La prova che serve davvero: quante POSIZIONI RICOPERTE dichiarano un atteso.
  -- Erano poche decine; se restassero tali, avremmo spostato righe senza rimettere
  -- in piedi la misura.
  SELECT count(DISTINCT r.position_id) INTO n_pos_con_skill
    FROM sys.sys_position_skill_requirements r
    JOIN sys.sys_positions p ON p.position_id = r.position_id AND p.position_is_active;
  IF n_pos_con_skill < 100 THEN
    RAISE EXCEPTION 'Solo % posizioni attive dichiarano un requisito di competenza', n_pos_con_skill;
  END IF;

  RAISE NOTICE 'CATALOGHI RIAGGANCIATI — % coppie vecchia->nuova; su posizioni ricoperte: % requisiti di competenza (erano 157), % formativi (erano 199), % KPI (erano 28); % posizioni attive dichiarano un atteso di competenza; totali invariati.',
               n_map, n_sk, n_le, n_kp, n_pos_con_skill;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   python tools/verifica_incrociata.py --famiglia X4 --famiglia X5 --famiglia X6
--   Atteso: gli UNIVERSI tornano all'ordine di grandezza pre-ricostruzione. Il numero
--   di DIFETTI puo' risalire, ed e' corretto che risalga: significa che la misura vede
--   di nuovo. Un universo piccolo non e' una buona notizia, e' una misura cieca.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--   Lo spostamento e' reversibile solo dallo snapshot pre-migrazione: la riga non
--   conserva da quale posizione proviene. E' anche la ragione per cui la prossima
--   volta un catalogo agganciato a una posizione dovrebbe portare con se' la propria
--   provenienza, come fanno le tabelle importate.
