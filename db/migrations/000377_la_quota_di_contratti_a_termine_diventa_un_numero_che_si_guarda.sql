-- ─────────────────────────────────────────────────────────────────────────────
-- 000377 — La quota di contratti a termine diventa un numero che si guarda (#246 F4)
--
-- ── LA SECONDA METÀ DELLA CAUSA ─────────────────────────────────────────────
-- Un terzo dell'organico è rimasto a tempo determinato per due anni, e non
-- perché nessuno sapesse leggere una tabella: perché **quel rapporto non era un
-- numero da nessuna parte**. Le due sentinelle della 000376 impediscono che il
-- difetto torni nella sua forma nota (fuori ammissibilità, durata incoerente),
-- ma una sentinella risponde «sì/no» a una regola già scritta. Non dice
-- **quanto**, e quindi non fa venire la domanda a nessuno.
--
-- Enzo lo aveva colto prima di qualunque strumento, guardando i dati:
-- *«un terzo dell'organico a termine mi sembra assolutamente eccessivo»*. È da
-- lì che è nata `#246`. Questa vista rende quella domanda **ripetibile senza di
-- lui**.
--
-- ── PERCHÉ È INFORMATIVA, E NON UNA SENTINELLA ──────────────────────────────
-- ⚠ Ogni `sys.v_*` nuova entra **da sola** nella batteria di `db_health.py`, che
--   pretende **zero righe** (memoria `new_sys_view_becomes_sentinel`). Questa
--   vista **conta stato**, non anomalie: una riga per tenant, sempre presente
--   anche quando va tutto bene. Lasciata fra le sentinelle renderebbe rossa la
--   prova generale per costruzione — cioè un allarme che suona sempre, che è il
--   modo più rapido di insegnare a non guardarlo (`#194`).
--   Va quindi dichiarata in `INFORMATIVE` dentro `db_health.py`, e lo si fa nello
--   stesso commit: una vista aggiunta oggi e dichiarata domani è una prova
--   generale rossa nel mezzo.
--
-- ── COSA MOSTRA ────────────────────────────────────────────────────────────
-- Una riga per azienda, con: quanti rapporti attivi, quanti a termine, la
-- **quota** in percentuale, e i due sotto-insiemi che `#246` ha reso leggibili
-- (senza scadenza · con scadenza oltre i 16 mesi). La quota è calcolata, mai
-- scritta: ⭐ IL PUNTO FISSO — un numero del genere è vero il giorno in cui lo
-- scrivi e falso poco dopo.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE VIEW sys.v_quota_contratti_a_termine AS
SELECT
  t.tenant_id                                                     AS tenant_id,
  t.tenant_name                                                   AS azienda,
  count(*)                                                         AS rapporti_attivi,
  count(*) FILTER (WHERE c.user_contract_type = 'fixed_term')      AS a_termine,
  -- la quota, arrotondata a un decimale: con 160 rapporti il secondo decimale è
  -- rumore, e un numero più preciso del dato che lo produce invita a fidarsene
  -- più di quanto meriti.
  round(
    100.0 * count(*) FILTER (WHERE c.user_contract_type = 'fixed_term')
    / nullif(count(*), 0), 1)                                      AS quota_pct,
  count(*) FILTER (
    WHERE c.user_contract_type = 'fixed_term'
      AND c.user_contract_end_date IS NULL)                        AS a_termine_senza_scadenza,
  count(*) FILTER (
    WHERE c.user_contract_type = 'fixed_term'
      AND e.user_employment_hire_date IS NOT NULL
      AND c.user_contract_end_date > e.user_employment_hire_date + interval '16 months')
                                                                   AS a_termine_oltre_16_mesi
FROM sys.sys_user_contracts c
JOIN sys.sys_users u            ON u.user_id = c.user_contract_user_id
JOIN sys.sys_tenancies t        ON t.tenant_id = u.user_tenant_id
LEFT JOIN sys.sys_user_employment e ON e.user_employment_user_id = c.user_contract_user_id
WHERE c.user_contract_status = 'ACTIVE'
GROUP BY t.tenant_id, t.tenant_name;

COMMENT ON VIEW sys.v_quota_contratti_a_termine IS
  'INFORMATIVA (#246 F4): una riga per azienda con la quota di rapporti a termine sul totale '
  'attivo. Conta STATO, non anomalie — righe qui sono normali. Nasce perche'' il difetto di '
  '#246 e'' sopravvissuto due anni non essendo mai stato un numero che qualcuno guardava. '
  'Le violazioni della regola le presidiano le due sentinelle della 000376.';

-- ── La prova: la vista deve DIRE QUALCOSA, non essere vuota ─────────────────
-- Una vista di rapporto che non restituisce righe non è «tutto a posto»: è un
-- rapporto che non misura. Si verifica che ci sia una riga per ogni azienda che
-- ha rapporti attivi.
DO $$
DECLARE
  v_righe   int;
  v_aziende int;
  v_quota   numeric;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.v_quota_contratti_a_termine;
  SELECT count(DISTINCT u.user_tenant_id) INTO v_aziende
  FROM sys.sys_user_contracts c
  JOIN sys.sys_users u ON u.user_id = c.user_contract_user_id
  WHERE c.user_contract_status = 'ACTIVE';

  IF v_righe <> v_aziende THEN
    RAISE EXCEPTION '000377: la vista rende % righe per % aziende con rapporti attivi', v_righe, v_aziende;
  END IF;

  SELECT max(quota_pct) INTO v_quota FROM sys.v_quota_contratti_a_termine;
  -- `%%%` metteva il segno di percentuale PRIMA del numero («%0.0»): in RAISE il
  -- primo `%` e' il segnaposto e `%%` il letterale, quindi l'ordine conta.
  RAISE NOTICE '000377: % aziende misurate · quota a termine piu'' alta: % per cento', v_righe, v_quota;
END $$;

COMMIT;
