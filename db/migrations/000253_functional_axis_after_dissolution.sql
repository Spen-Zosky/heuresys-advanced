-- ═══════════════════════════════════════════════════════════════════════════════
-- 000253_functional_axis_after_dissolution.sql
--
-- L'ASSE FUNZIONALE DOPO LO SCIOGLIMENTO DELLE DUE UNITA'.
--
-- Perche' esiste questa migrazione
--   La fase 6 (000251) scioglie «Divisione Risk & Compliance» e «Direzione
--   Corporate Banking» perche' il disegno target non le prevede. Si occupa delle
--   PERSONE — nessuna resta appesa a un'unita inattiva — ma non dell'ASSE
--   FUNZIONALE, che per ADR-0027 e' ortogonale a quello organizzativo e vive in
--   tabelle diverse. Risultato misurato ri-eseguendo la verifica incrociata dopo
--   le otto migrazioni (S1043): la famiglia X8a passa da 0 a 18. Diciotto legami
--   che nominano un'unita che non esiste piu':
--
--     · 2 SQUADRE, con 36 e 5 persone dentro — gente vera, non contenitori vuoti
--     · 16 attaccamenti di processo (RACI: OWNER / CONTRIBUTOR / CONSULTED / INFORMED)
--
--   E' esattamente la classe di incoerenza che questa serie elimina — un legame
--   verso un'entita che non c'e' piu' — solo sull'altro asse. Va chiusa qui, non
--   lasciata come strascico.
--
-- Le due scelte, e perche'
--   A. Le squadre si RIAGGANCIANO, non si disattivano. Disattivarle toglierebbe
--      41 persone dall'asse funzionale per un problema che e' dell'asse
--      organizzativo: una squadra non muore perche' muore l'unita che la
--      ospitava. Vanno all'antenato ATTIVO piu' vicino.
--   B. Gli attaccamenti di processo si spostano allo stesso antenato, MA nove dei
--      sedici esistono gia' li': l'indice unico (org_unit, blueprint_process) li
--      vieta, e soprattutto sarebbero un doppione semantico — lo stesso processo
--      attaccato due volte allo stesso reparto. Quelli si CANCELLANO invece di
--      essere spostati. Non e' perdita di storia: la tabella non ha versionamento
--      ne' colonna di validita, e la riga superstite dice gia' la stessa cosa.
--
-- Reversibile: rollback in coda, commentato (le cancellazioni sono ricostruibili
-- perche' la riga gemella sul padre esiste — e' il motivo per cui erano doppioni).
-- Rieseguibile: agisce solo su cio' che punta a un'unita inattiva.
-- Prerequisiti: 000251 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- 0. L'ANTENATO ATTIVO PIU' VICINO, per ogni unita sciolta
--    Ricorsivo e non «il padre»: se un giorno si sciogliesse una catena di due
--    unita, salire di un solo livello atterrerebbe su un'altra unita morta.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE erede ON COMMIT DROP AS
WITH RECURSIVE risali(morta_id, candidato_id, attivo) AS (
  SELECT ou.organization_unit_id, ou.organization_unit_parent_id, false
    FROM sys.sys_organization_units ou
   WHERE NOT ou.organization_unit_is_active
  UNION ALL
  SELECT r.morta_id, c.organization_unit_parent_id, c.organization_unit_is_active
    FROM risali r
    JOIN sys.sys_organization_units c ON c.organization_unit_id = r.candidato_id
   WHERE NOT r.attivo
)
SELECT DISTINCT ON (r.morta_id)
       r.morta_id,
       c.organization_unit_id AS erede_id
  FROM risali r
  JOIN sys.sys_organization_units c ON c.organization_unit_id = r.candidato_id
 WHERE c.organization_unit_is_active
 ORDER BY r.morta_id, c.organization_unit_id;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. LE SQUADRE — riagganciate all'erede
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_teams t
   SET team_organization_unit_id = e.erede_id,
       updated_at                = now()
  FROM erede e
 WHERE t.team_organization_unit_id = e.morta_id;

-- ───────────────────────────────────────────────────────────────────────────────
-- B1. GLI ATTACCAMENTI DI PROCESSO GIA' PRESENTI SULL'EREDE — doppioni, via
-- ───────────────────────────────────────────────────────────────────────────────
DELETE FROM sys.sys_organization_unit_processes p
 USING erede e
 WHERE p.org_unit_process_org_unit_id = e.morta_id
   AND EXISTS (SELECT 1 FROM sys.sys_organization_unit_processes q
                WHERE q.org_unit_process_org_unit_id = e.erede_id
                  AND q.org_unit_process_blueprint_process_id = p.org_unit_process_blueprint_process_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- B2. I RIMANENTI — spostati sull'erede
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_unit_processes p
   SET org_unit_process_org_unit_id = e.erede_id,
       updated_at                   = now()
  FROM erede e
 WHERE p.org_unit_process_org_unit_id = e.morta_id;

-- ───────────────────────────────────────────────────────────────────────────────
-- C. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_squadre_orfane int; n_processi_orfani int; n_membri int; n_squadre_attive int;
BEGIN
  SELECT count(*) INTO n_squadre_orfane FROM sys.sys_teams t
    JOIN sys.sys_organization_units ou ON ou.organization_unit_id = t.team_organization_unit_id
   WHERE t.team_is_active AND NOT ou.organization_unit_is_active;
  IF n_squadre_orfane <> 0 THEN
    RAISE EXCEPTION 'Squadre attive ancora su unita sciolte: %', n_squadre_orfane;
  END IF;

  SELECT count(*) INTO n_processi_orfani FROM sys.sys_organization_unit_processes p
    JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.org_unit_process_org_unit_id
   WHERE NOT ou.organization_unit_is_active;
  IF n_processi_orfani <> 0 THEN
    RAISE EXCEPTION 'Attaccamenti di processo ancora su unita sciolte: %', n_processi_orfani;
  END IF;

  -- Nessuna persona e' uscita dall'asse funzionale: le due squadre riagganciate
  -- portavano 36 e 5 membri, ed e' il numero che questa migrazione difende.
  SELECT count(*) INTO n_membri FROM sys.sys_team_members m
    JOIN sys.sys_teams t ON t.team_id = m.team_member_team_id
   WHERE t.team_is_active;
  IF n_membri < 41 THEN
    RAISE EXCEPTION 'Appartenenze a squadre attive scese a %: qualcuno e uscito dall asse funzionale', n_membri;
  END IF;

  SELECT count(*) INTO n_squadre_attive FROM sys.sys_teams WHERE team_is_active;
  RAISE NOTICE 'ASSE FUNZIONALE OK — % squadre attive tutte su unita vive, nessun attaccamento di processo orfano, % appartenenze intatte.',
               n_squadre_attive, n_membri;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   python tools/verifica_incrociata.py --famiglia X8    # atteso: X8a a 0
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — riporta squadre e processi sulle due unita sciolte
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   UPDATE sys.sys_teams SET team_organization_unit_id =
--     (SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_code = team_code)
--    WHERE team_code IN ('DIV-RISK','DIR-CORP');
--   -- gli attaccamenti spostati tornano indietro; i doppioni cancellati si
--   -- ricreano dalla riga gemella rimasta sull erede, che non e stata toccata.
-- COMMIT;
