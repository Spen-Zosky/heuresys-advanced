-- ═══════════════════════════════════════════════════════════════════════════════
-- 000248_positions_command_roles.sql
--
-- FASE 5a della ricostruzione dell'organigramma — LE POSIZIONI DI COMANDO.
--
-- Perche' la fase 5 e' spezzata in tre
--   Spostare le persone significa tre cose diverse, con rischi diversi:
--     5a  i 25 responsabili che dirigono un'unita in cui non hanno una posizione
--     5b  i ~74 operativi della rete (filiali)
--     5c  i ~60 operativi delle divisioni centrali
--   Farle in un colpo solo produrrebbe una migrazione da centinaia di righe in cui
--   un errore e' invisibile. La 5a e' anche la piu URGENTE: finche' un responsabile
--   non ha una posizione nell'unita che dirige, il perimetro organizzativo non si
--   puo calcolare, e le matrici di autorizzazione restano non verificabili.
--   Misurato: dei 29 nominati alla fase 4, solo 3 sono gia dentro la propria unita.
--
-- Che cosa fa questa migrazione
--   A. crea una posizione di comando in ogni unita il cui responsabile e' «esterno»
--   B. sposta il responsabile su quella posizione: chiude l'assegnazione vecchia
--      (ENDED) e ne apre una nuova (ACTIVE) — la posizione precedente resta e
--      diventa vacante, sara' valutata alla fase 6
--   C. NON tocca nessun altro: le persone che non sono responsabili di unita
--      restano dove sono
--
-- Il numero di assegnazioni ATTIVE resta invariato (161): per ogni assegnazione
-- chiusa se ne apre esattamente una.
--
-- Prerequisiti: 000244, 000245, 000246, 000247 applicate.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- 0. CHI VA SPOSTATO — insieme calcolato, non elencato a mano
--    Un responsabile e' «esterno» quando nessuna sua assegnazione attiva punta a
--    una posizione collocata nell'unita che dirige. La tabella temporanea tiene
--    anche il titolo della nuova posizione, derivato dal tipo di unita.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE da_collocare ON COMMIT DROP AS
SELECT
  ou.organization_unit_id                       AS unita_id,
  ou.organization_unit_code                     AS unita_codice,
  ou.organization_unit_name                     AS unita_nome,
  ou.organization_unit_type                     AS unita_tipo,
  ou.organization_unit_tenant_id                AS tenant_id,
  ou.organization_unit_manager_user_id          AS persona_id,
  a.user_position_assignment_id                 AS assegnazione_vecchia_id,
  -- titolo della posizione di comando, derivato dal tipo di unita
  CASE ou.organization_unit_type
    WHEN 'BRANCH'     THEN 'Direttore di Filiale'
    WHEN 'AREA'       THEN 'Responsabile di Area'
    WHEN 'DIVISION'   THEN 'Direttore ' || ou.organization_unit_name
    WHEN 'DEPARTMENT' THEN 'Responsabile ' || ou.organization_unit_name
    WHEN 'OFFICE'     THEN 'Responsabile ' || ou.organization_unit_name
    ELSE 'Responsabile ' || ou.organization_unit_name
  END                                           AS titolo_nuovo,
  -- codice posizione: POS-CMD-<codice unita>
  'POS-CMD-' || ou.organization_unit_code        AS codice_nuovo
FROM sys.sys_organization_units ou
JOIN sys.sys_user_position_assignments a
  ON a.user_position_assignment_user_id = ou.organization_unit_manager_user_id
 AND a.user_position_assignment_status  = 'ACTIVE'
WHERE ou.organization_unit_manager_user_id IS NOT NULL
  -- esclusa la societa: la CEO ha la sua posizione qui, e da qui dirige anche la
  -- Direzione Generale. Quando una persona regge due unita puo essere interna a
  -- una sola: e' l'eccezione dichiarata del caso «CEO = DG».
  AND ou.organization_unit_type <> 'HEADQUARTERS'
  AND ou.organization_unit_code <> 'DG'
  -- solo chi non ha gia una posizione nell'unita che dirige
  AND NOT EXISTS (
    SELECT 1
      FROM sys.sys_user_position_assignments a2
      JOIN sys.sys_positions p2 ON p2.position_id = a2.user_position_assignment_position_id
     WHERE a2.user_position_assignment_user_id = ou.organization_unit_manager_user_id
       AND a2.user_position_assignment_status  = 'ACTIVE'
       AND p2.position_organization_unit_id    = ou.organization_unit_id
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- A. LE POSIZIONI DI COMANDO
--    Una per unita, collocata nell'unita, con riporto alla posizione di comando
--    dell'unita madre quando esiste — cosi' i due alberi (unita e posizioni)
--    tornano a dire la stessa cosa, che e' la regola R3 del referto.
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_positions (
  position_tenant_id, position_code, position_title,
  position_organization_unit_id, position_is_active, position_effective_from
)
SELECT d.tenant_id, d.codice_nuovo, d.titolo_nuovo, d.unita_id, true, CURRENT_DATE
FROM da_collocare d
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_positions p WHERE p.position_code = d.codice_nuovo
);

-- riporto gerarchico: la posizione di comando riporta a quella dell'unita madre
UPDATE sys.sys_positions p
   SET position_reports_to_position_id = madre.position_id,
       updated_at = now()
  FROM da_collocare d
  JOIN sys.sys_organization_units ou ON ou.organization_unit_id = d.unita_id
  JOIN sys.sys_positions madre
    ON madre.position_organization_unit_id = ou.organization_unit_parent_id
   AND madre.position_code LIKE 'POS-CMD-%'
 WHERE p.position_code = d.codice_nuovo;

-- ───────────────────────────────────────────────────────────────────────────────
-- B. SPOSTAMENTO DEI RESPONSABILI
--    B1. si chiude l'assegnazione precedente
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_user_position_assignments a
   SET user_position_assignment_status   = 'ENDED',
       user_position_assignment_end_date = CURRENT_DATE - 1,
       user_position_assignment_notes    = coalesce(a.user_position_assignment_notes || ' · ', '')
                                           || 'chiusa dalla ricostruzione organigramma (fase 5a): la persona assume il comando della propria unita',
       updated_at                        = now()
  FROM da_collocare d
 WHERE a.user_position_assignment_id = d.assegnazione_vecchia_id
   -- RIESEGUIBILITA' (regola di progetto: ogni migrazione e' idempotente, e
   -- migrate.sh ri-applica OGNI file a ogni deploy). Senza questa condizione la
   -- seconda esecuzione chiuderebbe l'assegnazione appena creata e ne inserirebbe
   -- una copia: stesso conteggio finale, ma storia riscritta a ogni deploy.
   AND a.user_position_assignment_position_id IS DISTINCT FROM
       (SELECT position_id FROM sys.sys_positions WHERE position_code = d.codice_nuovo);

--    B2. si apre quella nuova sulla posizione di comando
INSERT INTO sys.sys_user_position_assignments (
  user_position_assignment_tenant_id, user_position_assignment_user_id,
  user_position_assignment_position_id, user_position_assignment_kind,
  user_position_assignment_fte, user_position_assignment_start_date,
  user_position_assignment_status, user_position_assignment_notes
)
SELECT d.tenant_id, d.persona_id, p.position_id, 'PRIMARY', 1.0, CURRENT_DATE, 'ACTIVE',
       'ricostruzione organigramma (fase 5a): responsabile collocato nell unita che dirige'
FROM da_collocare d
JOIN sys.sys_positions p ON p.position_code = d.codice_nuovo
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_position_assignments x
   WHERE x.user_position_assignment_user_id     = d.persona_id
     AND x.user_position_assignment_position_id = p.position_id
     AND x.user_position_assignment_status      = 'ACTIVE');

-- ───────────────────────────────────────────────────────────────────────────────
-- C. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_spostati int; n_pos_cmd int; n_attive int; n_doppie int;
  n_esterni int; n_senza_pos int;
BEGIN
  -- I controlli guardano lo STATO RAGGIUNTO, non la dimensione della lista di lavoro.
  -- La prima stesura verificava `count(*) FROM da_collocare BETWEEN 20 AND 30`: corretto
  -- alla prima esecuzione, sbagliato alla seconda, dove la lista e' legittimamente VUOTA
  -- perche' non c'e' piu' niente da spostare. Misurare il lavoro da fare invece del
  -- risultato ottenuto rende la migrazione non rieseguibile — verificato in S1043.
  SELECT count(*) INTO n_pos_cmd FROM sys.sys_positions WHERE position_code LIKE 'POS-CMD-%';
  IF n_pos_cmd NOT BETWEEN 20 AND 30 THEN
    RAISE EXCEPTION 'Posizioni di comando: attese ~25, trovate %', n_pos_cmd;
  END IF;

  -- la lista o e' stata smaltita per intero adesso, o era gia' vuota
  SELECT count(*) INTO n_spostati FROM da_collocare;
  IF n_spostati <> 0 AND n_spostati <> n_pos_cmd THEN
    RAISE EXCEPTION 'Lista di lavoro incoerente: % da collocare contro % posizioni di comando',
                    n_spostati, n_pos_cmd;
  END IF;

  -- il totale delle assegnazioni attive NON deve cambiare
  SELECT count(*) INTO n_attive FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE';
  IF n_attive <> 161 THEN
    RAISE EXCEPTION 'Assegnazioni attive: attese 161 invariate, trovate %', n_attive;
  END IF;

  -- nessuno deve avere due assegnazioni attive
  SELECT count(*) INTO n_doppie FROM (
    SELECT user_position_assignment_user_id
      FROM sys.sys_user_position_assignments
     WHERE user_position_assignment_status = 'ACTIVE'
     GROUP BY 1 HAVING count(*) > 1) x;
  IF n_doppie <> 0 THEN
    RAISE EXCEPTION 'Persone con piu di una assegnazione attiva: %', n_doppie;
  END IF;

  -- e nessuna persona deve essere rimasta senza posizione
  SELECT count(*) INTO n_senza_pos
    FROM sys.sys_organization_units ou
   WHERE ou.organization_unit_manager_user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                      WHERE a.user_position_assignment_user_id = ou.organization_unit_manager_user_id
                        AND a.user_position_assignment_status = 'ACTIVE');
  IF n_senza_pos <> 0 THEN
    RAISE EXCEPTION 'Responsabili rimasti senza posizione attiva: %', n_senza_pos;
  END IF;

  -- il difetto che questa fase chiude: responsabili esterni all unita che dirigono.
  -- Resta 1: la CEO, che regge societa e Direzione Generale e puo essere interna a una sola.
  SELECT count(*) INTO n_esterni
    FROM sys.v_organization_unit_integrity WHERE responsabile_esterno;
  IF n_esterni > 1 THEN
    RAISE EXCEPTION 'Responsabili esterni: atteso al massimo 1 (la CEO su societa e DG), trovati %', n_esterni;
  END IF;

  RAISE NOTICE 'FASE 5a OK — % posizioni di comando create, % responsabili collocati nella propria unita, 161 assegnazioni attive invariate, % responsabile esterno residuo (la CEO).', n_pos_cmd, n_spostati, n_esterni;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1) il difetto chiuso
--    SELECT count(*) FILTER (WHERE responsabile_esterno) AS capo_esterno,
--           count(*) FILTER (WHERE responsabile_condiviso) AS capo_condiviso,
--           count(*) FILTER (WHERE senza_responsabile) AS senza_capo
--      FROM sys.v_organization_unit_integrity;
--    atteso: capo_esterno 1 (la CEO) · capo_condiviso 2 (societa e DG) · senza_capo 2 (da sciogliere)
--    Prima della ricostruzione: 14 · 15 · 11.
--
-- 2) le posizioni di comando e il loro riporto
--    SELECT p.position_code, p.position_title, ou.organization_unit_name AS unita,
--           sup.position_title AS riporta_a
--      FROM sys.sys_positions p
--      JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
--      LEFT JOIN sys.sys_positions sup ON sup.position_id = p.position_reports_to_position_id
--     WHERE p.position_code LIKE 'POS-CMD-%' ORDER BY 3;
--
-- 3) le posizioni rimaste vacanti dallo spostamento
--    SELECT p.position_title, ou.organization_unit_name
--      FROM sys.sys_positions p
--      JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
--     WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
--                        WHERE a.user_position_assignment_position_id = p.position_id
--                          AND a.user_position_assignment_status = 'ACTIVE')
--     ORDER BY 2, 1;
--    Sono le posizioni che i responsabili hanno lasciato: alcune si riusano nelle
--    fasi 5b/5c, le altre si disattivano alla fase 6.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   -- riapre le assegnazioni chiuse e cancella quelle nuove
--   DELETE FROM sys.sys_user_position_assignments
--    WHERE user_position_assignment_position_id IN
--          (SELECT position_id FROM sys.sys_positions WHERE position_code LIKE 'POS-CMD-%');
--   UPDATE sys.sys_user_position_assignments
--      SET user_position_assignment_status = 'ACTIVE',
--          user_position_assignment_end_date = NULL
--    WHERE user_position_assignment_notes LIKE '%fase 5a%';
--   DELETE FROM sys.sys_positions WHERE position_code LIKE 'POS-CMD-%';
-- COMMIT;
