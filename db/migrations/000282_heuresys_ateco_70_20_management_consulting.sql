-- ═══════════════════════════════════════════════════════════════════════════════
-- 000282_heuresys_ateco_70_20_management_consulting.sql
--
-- #144 — LA CARTA D'IDENTITA' DI HEURESYS DICEVA LO STRUMENTO, NON IL MESTIERE.
--
-- Enzo ha dichiarato l'attivita' il 2026-08-05: consulenza direzionale su metodologie
-- e strumenti AI-augmented per change management e sviluppo organizzativo.
-- NACE Rev 2.1 70.20 = ATECO 2025 70.20 «Consulenza imprenditoriale e altre attivita
-- di consulenza gestionale» (il vecchio 70.22.09 e' confluito qui).
--
-- Lo stato misurato prima: `sys_enterprise_typing_profiles` puntava HEURESYS a
-- **62.10 «Attivita di programmazione informatica»**. Descriveva il software che
-- l'azienda scrive, non il servizio che vende — e contraddiceva
-- `sys_tenancies.tenant_industry_code = MGMT_CONSULTING`, che era gia' corretto e
-- NON si tocca. E' il caso concreto di **#135** (l'identita' dichiarata due volte,
-- e per Heuresys le due dissentono): qui si allinea la dichiarazione sbagliata a
-- quella giusta, non si sceglie una nuova verita'.
--
-- Livello scelto: **70.20**, quarto livello, la stessa profondita' di `64.19` (RTL
-- Bank) e del `62.10` che sostituisce. Non 70.2 (troppo generico) ne' 70.20.09
-- (residuale «n.c.a.»): la consulenza direzionale E' il ramo, non il suo residuo.
--
-- COERENZA CON L'INVARIANTE I21. Il settore di un tenant governa quali dati gli
-- appartengono. HEURESYS = Consulenza Direzionale: questa riga lo rende vero anche
-- nella carta d'identita, non solo nel codice di settore.
--
-- Idempotente: aggiorna solo se il profilo non punta gia' al 70.20.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  v_target uuid;
  v_upd    bigint;
  v_code   text;
  v_ind    text;
BEGIN
  SELECT activity_classification_id INTO v_target
    FROM sys.sys_activity_classifications
   WHERE activity_classification_code = '70.20'
     AND activity_classification_scheme = 'ATECO_2025';
  IF v_target IS NULL THEN
    RAISE EXCEPTION '000282: ATECO_2025 70.20 assente dal catalogo — la classificazione va importata prima';
  END IF;

  UPDATE sys.sys_enterprise_typing_profiles p
     SET enterprise_typing_industry_class_id = v_target,
         updated_at = now()
    FROM sys.sys_tenancies t
   WHERE t.tenant_id = p.enterprise_typing_tenant_id
     AND t.tenant_code = 'HEURESYS'
     AND p.enterprise_typing_industry_class_id IS DISTINCT FROM v_target;
  GET DIAGNOSTICS v_upd = ROW_COUNT;
  RAISE NOTICE '000282: profili HEURESYS riallineati: %', v_upd;

  -- POST-CONDIZIONE — le DUE dichiarazioni devono concordare. E' la proprieta' di
  -- #135 asserita sul caso che l'ha fatta emergere: non basta che l'ATECO sia
  -- cambiato, deve essere coerente con il settore gia' dichiarato.
  SELECT a.activity_classification_code, t.tenant_industry_code INTO v_code, v_ind
    FROM sys.sys_enterprise_typing_profiles p
    JOIN sys.sys_tenancies t ON t.tenant_id = p.enterprise_typing_tenant_id
    JOIN sys.sys_activity_classifications a ON a.activity_classification_id = p.enterprise_typing_industry_class_id
   WHERE t.tenant_code = 'HEURESYS';

  IF v_code IS DISTINCT FROM '70.20' THEN
    RAISE EXCEPTION '000282: la carta d''identita di HEURESYS dice ancora % invece di 70.20', COALESCE(v_code,'(nessuna)');
  END IF;
  IF v_ind IS DISTINCT FROM 'MGMT_CONSULTING' THEN
    RAISE EXCEPTION '000282: il settore di HEURESYS e % : non concorda con ATECO 70.20', COALESCE(v_ind,'(nessuno)');
  END IF;

  RAISE NOTICE '000282 done: HEURESYS — settore % e ATECO % concordano', v_ind, v_code;
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (riporta la carta d'identita al codice sbagliato — solo per emergenza)
-- ═══════════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   UPDATE sys.sys_enterprise_typing_profiles p
--      SET enterprise_typing_industry_class_id =
--          (SELECT activity_classification_id FROM sys.sys_activity_classifications
--            WHERE activity_classification_code='62.10' AND activity_classification_scheme='ATECO_2025')
--     FROM sys.sys_tenancies t
--    WHERE t.tenant_id = p.enterprise_typing_tenant_id AND t.tenant_code='HEURESYS';
-- COMMIT;
