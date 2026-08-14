-- ─────────────────────────────────────────────────────────────────────────────
-- 000310 — Chi lavora con un contratto scaduto: renderlo VISIBILE (#123)
--
-- DA DOVE VIENE
--   `organigramma-bis.html` (lab, 4 agosto) segnalava «1 posizione senza contratto
--   attivo». Ri-misurato il 2026-08-14 sono **8**, ed e' un numero che PEGGIORA — la
--   categoria di numero a cui il documento stesso dice di riservare il sospetto.
--
-- COSA HO TROVATO, misurando
--   Sette persone hanno un contratto a termine **scaduto fra il 1 luglio e il 12 agosto
--   2026** mentre il loro incarico sulla posizione e' ancora ACTIVE: nessuno ha registrato
--   ne' il rinnovo ne' la cessazione. L'ottavo caso e' diverso e strutturale: il fondatore
--   non ha alcun contratto di lavoro dipendente, e non e' un difetto.
--
--   Il difetto non sono le sette persone: e' che **niente se ne accorge**. La storia RTL
--   avanza nel tempo (la custodia la porta a ieri), quindi i contratti a termine scadono
--   da soli, in silenzio, e il dataset si allontana dalla realta' senza che nulla lo dica.
--
-- DA INFORMATIVA A SENTINELLA, NELLO STESSO GIORNO
--   Era nata **informativa**: rinnovare o cessare sette rapporti e' una decisione HR, non
--   una correzione tecnica, e non la prende una migrazione. Enzo l'ha presa poche ore
--   dopo — «tutti i dipendenti devono avere un contratto in vigore» — quindi la 000311
--   mette in vigore i sette contratti e questa vista diventa una **SENTINELLA a zero**,
--   tolta da `db_health.INFORMATIVE`. Chi non ha mai avuto un contratto (il fondatore)
--   resta fuori dal conteggio: non e' un rapporto di lavoro dipendente.
--
-- NON scrive nulla: e' una vista.
-- ─────────────────────────────────────────────────────────────────────────────

-- [EMENDATA il 2026-08-14, stesso giorno] La prima stesura esponeva anche
-- `contratti_totali` e includeva chi non ha MAI avuto un contratto. La 000311 l'ha poi
-- ristretta ai soli difetti, e alla SECONDA passata della catena questa migrazione non
-- riusciva piu a rimpiazzare la vista ristretta (PostgreSQL non consente a
-- `CREATE OR REPLACE VIEW` di togliere o rinominare colonne). ADR-0035: si emenda il file
-- che CREA l'oggetto, non si aggiunge un file dopo. La vista nasce quindi gia' cosi'.
DROP VIEW IF EXISTS sys.v_incarico_attivo_senza_contratto;
CREATE VIEW sys.v_incarico_attivo_senza_contratto AS
SELECT
  a.user_position_assignment_user_id AS user_id,
  u.user_email                       AS email,
  u.user_tenant_id                   AS tenant_id,
  p.position_title                   AS posizione,
  (SELECT max(c.user_contract_end_date)
     FROM sys.sys_user_contracts c
    WHERE c.user_contract_user_id = a.user_position_assignment_user_id) AS scaduto_il,
  'SCADUTO_E_NON_RINNOVATO'::text    AS caso
FROM sys.sys_user_position_assignments a
JOIN sys.sys_users u     ON u.user_id     = a.user_position_assignment_user_id
JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
WHERE a.user_position_assignment_status = 'ACTIVE'
  AND u.user_status = 'ACTIVE'
  AND EXISTS (SELECT 1 FROM sys.sys_user_contracts c
               WHERE c.user_contract_user_id = a.user_position_assignment_user_id)
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_contracts c
                   WHERE c.user_contract_user_id = a.user_position_assignment_user_id
                     AND (c.user_contract_end_date IS NULL OR c.user_contract_end_date >= CURRENT_DATE));

COMMENT ON VIEW sys.v_incarico_attivo_senza_contratto IS
  'SENTINELLA (attesa: 0 righe). Chi ha un incarico ATTIVO, ha avuto un contratto, e non '
  'ne ha piu nessuno in vigore. Mandato di Enzo 2026-08-14: nessuno lavora con un contratto '
  'scaduto. Chi non ha MAI avuto un contratto e escluso: non e un rapporto di lavoro '
  'dipendente (es. il fondatore), e non e un difetto.';

-- Post-condizione: la vista deve poter VEDERE. Una vista che non trova mai nulla perche'
-- e' scritta male darebbe lo stesso verde di un dataset sano.
DO $$
DECLARE n_tot int; n_scaduti int; n_mai int;
BEGIN
  SELECT count(*) INTO n_tot FROM sys.v_incarico_attivo_senza_contratto;
  n_scaduti := n_tot; n_mai := 0;

  IF n_tot = 0 THEN
    RAISE NOTICE '000310: la vista non trova nulla — o il dataset e sano, o la vista non guarda dove deve';
  ELSE
    RAISE NOTICE '000310 ok — % incarichi attivi senza contratto in corso: % scaduti e non rinnovati, % senza contratto per natura',
      n_tot, n_scaduti, n_mai;
  END IF;
END $$;
