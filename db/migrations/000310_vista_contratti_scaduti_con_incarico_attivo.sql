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
-- PERCHE' INFORMATIVA E NON ALLARME
--   Rinnovare o cessare sette rapporti di lavoro e' una decisione HR, non una correzione
--   tecnica: non la prende una migrazione. La vista nasce quindi **informativa**
--   (`db_health.INFORMATIVE`) — espone il fenomeno e i suoi giorni di scadenza senza
--   bloccare la catena. Diventa un allarme il giorno in cui la decisione e' presa e il
--   valore atteso e' zero: a quel punto basta toglierla da quell'elenco.
--
-- NON scrive nulla: e' una vista.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW sys.v_incarico_attivo_senza_contratto AS
SELECT
  a.user_position_assignment_user_id            AS user_id,
  u.user_email                                  AS email,
  u.user_tenant_id                              AS tenant_id,
  p.position_title                              AS posizione,
  (SELECT max(c.user_contract_end_date)
     FROM sys.sys_user_contracts c
    WHERE c.user_contract_user_id = a.user_position_assignment_user_id)  AS scaduto_il,
  (SELECT count(*)
     FROM sys.sys_user_contracts c
    WHERE c.user_contract_user_id = a.user_position_assignment_user_id)  AS contratti_totali,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM sys.sys_user_contracts c
                      WHERE c.user_contract_user_id = a.user_position_assignment_user_id)
      THEN 'MAI_AVUTO_CONTRATTO'
    ELSE 'SCADUTO_E_NON_RINNOVATO'
  END                                           AS caso
FROM sys.sys_user_position_assignments a
JOIN sys.sys_users u     ON u.user_id     = a.user_position_assignment_user_id
JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
WHERE a.user_position_assignment_status = 'ACTIVE'
  AND u.user_status = 'ACTIVE'
  AND NOT EXISTS (
        SELECT 1 FROM sys.sys_user_contracts c
         WHERE c.user_contract_user_id = a.user_position_assignment_user_id
           AND (c.user_contract_end_date IS NULL OR c.user_contract_end_date >= CURRENT_DATE));

COMMENT ON VIEW sys.v_incarico_attivo_senza_contratto IS
  'Chi ha un incarico ATTIVO ma nessun contratto in corso (#123). Due casi distinti nella '
  'colonna `caso`: SCADUTO_E_NON_RINNOVATO (a termine, giunto a scadenza mentre la persona '
  'resta in servizio) e MAI_AVUTO_CONTRATTO (strutturale, es. il fondatore). Informativa '
  'finche la decisione HR su rinnovo/cessazione non e presa; poi diventa una sentinella a zero.';

-- Post-condizione: la vista deve poter VEDERE. Una vista che non trova mai nulla perche'
-- e' scritta male darebbe lo stesso verde di un dataset sano.
DO $$
DECLARE n_tot int; n_scaduti int; n_mai int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE caso = 'SCADUTO_E_NON_RINNOVATO'),
         count(*) FILTER (WHERE caso = 'MAI_AVUTO_CONTRATTO')
    INTO n_tot, n_scaduti, n_mai
    FROM sys.v_incarico_attivo_senza_contratto;

  IF n_tot = 0 THEN
    RAISE NOTICE '000310: la vista non trova nulla — o il dataset e sano, o la vista non guarda dove deve';
  ELSE
    RAISE NOTICE '000310 ok — % incarichi attivi senza contratto in corso: % scaduti e non rinnovati, % senza contratto per natura',
      n_tot, n_scaduti, n_mai;
  END IF;
END $$;
