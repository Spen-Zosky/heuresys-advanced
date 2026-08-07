-- ═══════════════════════════════════════════════════════════════════════════════
-- 000295_platform_admin_is_the_owner.sql
--
-- #139 — L'AMMINISTRATORE DI PIATTAFORMA È IL PROPRIETARIO, NON UN ACCOUNT FINTO.
--
-- LA DECISIONE (Enzo, 2026-08-08): «l'utenza di servizio di Heuresys va eliminata perché
-- le sue funzioni sono tutte incarnate da Enzo Spenuso».
--
-- COSA C'ERA. `admin@heuresys.com` era l'unico `PLATFORM_ADMIN` del sistema, mentre
-- `enzo.spenuso@heuresys.com` — il proprietario — aveva `MANAGER, USER`. Chi possiede la
-- piattaforma non poteva amministrarla, e ad amministrarla era un account che non
-- corrisponde a nessuno.
--
-- ⚠️ LA MISURA CHE HA CAMBIATO L'IMPLEMENTAZIONE. La prima stesura cancellava e basta.
-- Contando le righe che referenziano quell'account è emerso che **non è un guscio**: è
-- l'AUTORE di migliaia di righe — **32.203** eventi di accesso, **705** requisiti di
-- posizione, **296** token, **56** obiettivi KPI, **19** posizioni, e le **3** valutazioni
-- della CEO. Quasi tutte quelle colonne sono `ON DELETE SET NULL`: una cancellazione
-- secca avrebbe **azzerato la paternità** di tutto, e la prova generale l'ha colta
-- («Restano 3 valutazioni senza soggetto o senza valutatore»).
--
-- Ma quelle azioni **erano di Enzo**, compiute attraverso un account tecnico. Quindi non
-- si perdono: si **ri-attribuiscono**. Non è una falsificazione della storia, è la stessa
-- correzione che la decisione enuncia — le funzioni erano sue, e ora lo dice anche il
-- dato.
--
-- LA REGOLA CHE DISTINGUE I DUE CASI, e non è una scelta caso per caso:
--   · colonne `ON DELETE CASCADE` → la riga **appartiene** all'account (le sue
--     credenziali, i suoi token, le sue preferenze, i suoi fattori MFA): sparisce con
--     lui, ed è giusto — non sono di Enzo, sono di un'identità che non deve esistere;
--   · colonne `ON DELETE SET NULL` → la riga registra **chi ha fatto una cosa**
--     (`created_by`, `updated_by`, il valutatore): si ri-attribuisce a Enzo.
-- L'elenco delle colonne non è scritto qui: si **ricava dal catalogo** a ogni esecuzione,
-- così una colonna aggiunta domani è coperta senza che nessuno se lo ricordi.
--
-- ORDINE OBBLIGATO: mandato → ri-attribuzione → rimozione. Invertendo i primi due il
-- sistema resterebbe senza amministratore; invertendo gli ultimi due si perderebbe la
-- paternità che si voleva salvare.
--
-- ⚠️ NON È REVERSIBILE.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  c_vecchio constant text := 'admin@heuresys.com';
  c_nuovo   constant text := 'enzo.spenuso@heuresys.com';
  v_role uuid;
  v_enzo uuid;
  v_old  uuid;
  v_n    bigint;
  v_adm  bigint;
  v_tot  bigint := 0;
  r      record;
BEGIN
  SELECT auth_role_id INTO v_role FROM sys.sys_auth_roles WHERE auth_role_code = 'PLATFORM_ADMIN';
  SELECT user_id INTO v_enzo FROM sys.sys_users WHERE user_email = c_nuovo;
  SELECT user_id INTO v_old  FROM sys.sys_users WHERE user_email = c_vecchio;

  IF v_role IS NULL THEN RAISE EXCEPTION '000295: ruolo PLATFORM_ADMIN inesistente'; END IF;
  IF v_enzo IS NULL THEN RAISE EXCEPTION '000295: % non esiste — non posso trasferirgli il mandato', c_nuovo; END IF;

  -- ── 1. il mandato al proprietario, PRIMA di ogni rimozione ──────────────────
  INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
  SELECT v_enzo, v_role, NULL
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_user_auth_roles
      WHERE user_auth_role_user_id = v_enzo AND user_auth_role_role_id = v_role
        AND user_auth_role_revoked_at IS NULL);

  IF v_old IS NOT NULL THEN
    -- ── 2. la paternità passa a Enzo ─────────────────────────────────────────
    FOR r IN
      SELECT n.nspname AS sch, t.relname AS tab, a.attname AS col
        FROM pg_constraint c
        JOIN pg_class t  ON t.oid  = c.conrelid  JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_class ft ON ft.oid = c.confrelid
        JOIN unnest(c.conkey) k(att) ON true
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.att
       WHERE c.contype = 'f' AND ft.relname = 'sys_users'
         AND c.confdeltype = 'n'          -- SET NULL = colonna di PATERNITA', non di appartenenza
       ORDER BY 1, 2, 3
    LOOP
      EXECUTE format('UPDATE %I.%I SET %I = %L WHERE %I = %L',
                     r.sch, r.tab, r.col, v_enzo, r.col, v_old);
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_tot := v_tot + v_n;
      IF v_n > 0 THEN
        RAISE NOTICE '  ri-attribuite % righe: %.%', v_n, r.tab, r.col;
      END IF;
    END LOOP;

    -- ── 3. e SOLO ORA l'account se ne va (con cio' che gli appartiene) ────────
    SELECT count(*) INTO v_n FROM sys.sys_user_position_assignments
     WHERE user_position_assignment_user_id = v_old;
    IF v_n > 0 THEN
      RAISE EXCEPTION '000295: % occupa % posizioni — non e il residuo misurato', c_vecchio, v_n;
    END IF;
    DELETE FROM sys.sys_users WHERE user_id = v_old;
  END IF;

  -- ── POST-CONDIZIONI ─────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM sys.sys_users WHERE user_email = c_vecchio) THEN
    RAISE EXCEPTION '000295: % esiste ancora', c_vecchio;
  END IF;

  -- LA VERIFICA CHE CONTA: non «Enzo ha il mandato» ma «esiste un amministratore
  -- attivo» — protegge dal caso in cui il passo 1 fallisse in silenzio.
  -- Variabile DEDICATA: riusare `v_n` faceva stampare al messaggio finale il conteggio
  -- delle valutazioni al posto degli amministratori — «0 amministratori attivi» su una
  -- migrazione riuscita. Un rendiconto che riusa una variabile racconta un'altra cosa.
  SELECT count(*) INTO v_adm
    FROM sys.sys_user_auth_roles ur JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
   WHERE ur.user_auth_role_role_id = v_role AND ur.user_auth_role_revoked_at IS NULL
     AND u.user_status = 'ACTIVE';
  IF v_adm = 0 THEN
    RAISE EXCEPTION '000295: nessun PLATFORM_ADMIN attivo — il sistema resterebbe senza amministratore';
  END IF;

  -- Nessuna valutazione puo' essere rimasta senza valutatore: e' il difetto concreto che
  -- la cancellazione secca produceva, e qui si pretende che non ci sia.
  SELECT count(*) INTO v_n FROM sys.sys_performance_reviews
   WHERE review_subject_user_id IS NULL OR review_reviewer_user_id IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION '000295: % valutazioni senza soggetto o valutatore', v_n;
  END IF;

  IF EXISTS (SELECT 1 FROM sys.v_user_census_deviation) THEN
    RAISE EXCEPTION '000295: il censimento non torna piu dopo la rimozione';
  END IF;

  RAISE NOTICE '000295 done: mandato al proprietario (% amministratori attivi); % righe ri-attribuite; % rimosso; % persone, % utenze di servizio',
    v_adm, v_tot, c_vecchio,
    (SELECT count(*) FROM sys.sys_users WHERE user_type IS DISTINCT FROM 'SERVICE'),
    (SELECT count(*) FROM sys.sys_users WHERE user_type = 'SERVICE');
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — non esiste: ricreare l'account significherebbe ricreare cio' che si e'
-- deciso non debba esistere, e la paternita' e' stata ri-attribuita a chi quelle azioni
-- le ha compiute davvero. La rete e' l'istantanea pg_dump pre-deploy.
-- ═══════════════════════════════════════════════════════════════════════════════
