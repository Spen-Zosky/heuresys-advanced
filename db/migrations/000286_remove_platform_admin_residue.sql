-- ═══════════════════════════════════════════════════════════════════════════════
-- 000286_remove_platform_admin_residue.sql
--
-- #139 — `platform.admin@heuresys.com` NON DEVE ESISTERE.
--
-- LA DECISIONE (Enzo, 2026-08-07): «non deve esistere: è un residuo inquinante».
--
-- CHE COS'È, MISURATO PRIMA DI TOCCARLO. Non è un utente dormiente: è un account
-- sintetico che il sistema ha trattato come una persona in sette tabelle diverse.
--   · `sys_users` — stato **DEACTIVATED**, creato 2025-11-25, con
--     `user_external_code = 'LEGACY_EMP::e1000001-…'` (rimosso dalla `000285`: per
--     **I14** dichiarava di essere una persona importata dal legacy, e quel dipendente
--     non esiste);
--   · occupa la posizione **`POS-e1000001` «Tenant Owner»** — inattiva, assegnazione
--     **ENDED**, e lui è l'unico titolare. Il codice della posizione è lo stesso
--     `e1000001` del codice legacy falso: sono lo stesso residuo, non due cose;
--   · ha una riga di anagrafica, una di rapporto di lavoro, un evento di storia
--     personale, un punteggio di prontezza, un punteggio di successione e il ruolo
--     **TENANT_ADMIN**.
-- Un account che non è una persona ma porta punteggi di successione e un mandato
-- TENANT_ADMIN non è residuo inerte: è rumore che entra nei conteggi, nelle
-- riconciliazioni e nei bacini.
--
-- COSA FA. Rimuove l'assegnazione (l'unico riferimento in **RESTRICT**: senza, la
-- cancellazione fallirebbe) e poi l'utente. Le altre sei tabelle sono in **CASCADE**
-- e seguono da sé — è il comportamento dichiarato dallo schema, non una scorciatoia.
--
-- COSA NON FA. Non tocca la posizione `POS-e1000001`, che resterà inattiva e senza
-- titolari. È lo stesso residuo, ma una posizione è un oggetto dell'organigramma e la
-- sua rimozione è una decisione separata: qui si esegue ciò che è stato chiesto.
--
-- ⚠️ **NON È REVERSIBILE.** Una cancellazione non ha rollback: le righe non esistono
-- più. La rete di sicurezza è l'istantanea `pg_dump` che `vm-deploy.sh` prende PRIMA
-- di ogni migrazione (`pg_dump_snapshots/pre-deploy/`). Va detto invece di lasciare
-- intendere che ci sia un rimedio a portata di mano.
--
-- Idempotente: se l'account non c'è più, non fa nulla e la post-condizione resta vera.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  c_email constant text := 'platform.admin@heuresys.com';
  v_id      uuid;
  v_stato   text;
  v_prima   bigint;
  v_dopo    bigint;
  v_assegn  bigint;
BEGIN
  SELECT user_id, user_status INTO v_id, v_stato
    FROM sys.sys_users WHERE user_email = c_email;

  IF v_id IS NULL THEN
    RAISE NOTICE '000286: % non esiste gia piu — niente da fare', c_email;
  ELSE
    -- GUARDIA: si rimuove un residuo DISATTIVATO. Se qualcuno l'avesse riattivato,
    -- il presupposto della decisione non varrebbe piu' e la migrazione deve fermarsi,
    -- non cancellare un account che nel frattempo e' tornato in uso. Un guard che
    -- passa comunque non e' un guard.
    IF v_stato <> 'DEACTIVATED' THEN
      RAISE EXCEPTION '000286: % risulta % e non DEACTIVATED — qualcuno l ha riattivato, non lo cancello', c_email, v_stato;
    END IF;

    SELECT count(*) INTO v_prima FROM sys.sys_users u
      JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id WHERE t.tenant_code = 'HEURESYS';

    -- L'unico riferimento in RESTRICT: va tolto esplicitamente, e va CONTATO, perche'
    -- «quante assegnazioni aveva» e' l'informazione che sparisce con la riga.
    DELETE FROM sys.sys_user_position_assignments WHERE user_position_assignment_user_id = v_id;
    GET DIAGNOSTICS v_assegn = ROW_COUNT;

    DELETE FROM sys.sys_users WHERE user_id = v_id;

    SELECT count(*) INTO v_dopo FROM sys.sys_users u
      JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id WHERE t.tenant_code = 'HEURESYS';

    RAISE NOTICE '000286: rimosso % (% assegnazioni) — utenti HEURESYS % -> %', c_email, v_assegn, v_prima, v_dopo;
  END IF;

  -- POST-CONDIZIONE 1 — l'account non c'e' piu'.
  IF EXISTS (SELECT 1 FROM sys.sys_users WHERE user_email = c_email) THEN
    RAISE EXCEPTION '000286: % esiste ancora', c_email;
  END IF;

  -- POST-CONDIZIONE 2 — non restano righe appese al suo identificativo nelle tabelle
  -- che NON erano in cascade. Si verifica lo stato, non il numero di righe cancellate:
  -- alla seconda esecuzione non si cancella nulla e dev'essere comunque verde.
  IF v_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM sys.sys_user_position_assignments WHERE user_position_assignment_user_id = v_id
  ) THEN
    RAISE EXCEPTION '000286: restano assegnazioni appese all identificativo rimosso';
  END IF;

  -- POST-CONDIZIONE 3 — le persone vere di HEURESYS sono ancora tutte li'. E' la
  -- verifica che conta: prova che la cancellazione ha colpito il residuo e nient'altro.
  -- ⚠️ EMENDATO S1049 (#139): l'elenco conteneva anche `admin@heuresys.com`, che pero'
  -- NON era una persona — era l'utenza tecnica, rimossa dalla `000295`. Elencarla fra
  -- «le persone vere» era un errore mio del mattino, e si e' visto solo quando
  -- l'account e' sparito davvero. Restano le tre persone che Enzo ha dichiarato.
  FOREACH v_stato IN ARRAY ARRAY['enzo.spenuso@heuresys.com',
                                 'andrea.spenuso@heuresys.com','chiara.spenuso@heuresys.com'] LOOP
    IF NOT EXISTS (SELECT 1 FROM sys.sys_users WHERE user_email = v_stato) THEN
      RAISE EXCEPTION '000286: % e sparito — la cancellazione ha colpito oltre il residuo', v_stato;
    END IF;
  END LOOP;
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — NON ESISTE, e va detto.
-- Le righe sono cancellate. L'unica rete e' l'istantanea pre-deploy in
-- pg_dump_snapshots/pre-deploy/ (pg_restore, DISTRUTTIVO a sua volta).
-- ═══════════════════════════════════════════════════════════════════════════════
