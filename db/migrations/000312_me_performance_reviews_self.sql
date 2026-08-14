-- ─────────────────────────────────────────────────────────────────────────────
-- 000312 — La persona legge le PROPRIE valutazioni (#92 F5)
--
-- I17 (pavimento ESS universale): ogni persona accede ai dati che la riguardano. Le
-- valutazioni erano l'eccezione — 548 righe su 158 persone, e nessun permesso `:self`
-- che le rendesse raggiungibili dall'area personale. Chi voleva sapere come era andata
-- la propria valutazione doveva chiederlo a qualcun altro.
--
-- LA FINESTRA NON E' «SEMPRE»: ADR-0036 §5 elenca fra le quattro eccezioni al mandato HR
-- le **valutazioni non comunicate**, e ne fissa il criterio — `review_shared_at` oppure
-- `review_acknowledged_at`. Una valutazione scritta ma non ancora consegnata non e' un
-- dato che la persona possa leggere: sarebbe scavalcare il colloquio. Il filtro vive nel
-- repository; qui nasce solo il permesso.
--
-- Misurato il 2026-08-14: 546 valutazioni comunicate, **2 non comunicate** (entrambe della
-- stessa persona). Quelle due sono il caso limite su cui il test prova che il filtro esiste
-- davvero — senza, la verifica sarebbe verde per mancanza di controesempi.
--
-- La platea ricalca quella degli altri permessi `:self` (`goal:read:self`,
-- `assessment:read:self`, `skill:read:self`): PLATFORM_ADMIN · TENANT_ADMIN · READ_ONLY ·
-- USER. Non e' una scelta nuova, e' la stessa gia' presa per l'area personale.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT 'performance-review:read:self', 'Leggere le proprie valutazioni (ESS)', 'performance-review', 'read:self'
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_auth_permissions WHERE auth_permission_code = 'performance-review:read:self'
);

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'performance-review:read:self'
   AND r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'READ_ONLY', 'USER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Traduzione EN: senza, il cancello i18n torna rosso (ADR-0029).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', 'Read own performance reviews (ESS)', 'MANUAL'
  FROM sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'performance-review:read:self'
ON CONFLICT DO NOTHING;

DO $$
DECLARE n_perm int; n_grant int; n_trad int; n_comunicate int; n_non int;
BEGIN
  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code = 'performance-review:read:self';
  IF n_perm <> 1 THEN RAISE EXCEPTION '000312: il permesso self non e stato creato'; END IF;

  SELECT count(*) INTO n_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'performance-review:read:self';
  IF n_grant <> 4 THEN
    RAISE EXCEPTION '000312: il permesso self e concesso a % ruoli invece di 4', n_grant;
  END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en' AND t.field = 'name'
     AND p.auth_permission_code = 'performance-review:read:self';
  IF n_trad <> 1 THEN RAISE EXCEPTION '000312: manca la traduzione EN del permesso'; END IF;

  -- NON doveva cambiare: il permesso di lettura PIENA resta ai quattro ruoli della 000309,
  -- e questo `:self` non e' una scorciatoia per ottenerlo.
  IF EXISTS (
    SELECT 1 FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
     WHERE p.auth_permission_code = 'performance-review:read'
       AND r.auth_role_code IN ('BLUEPRINT_MANAGER','PROCESS_OWNER','USER','READ_ONLY')) THEN
    RAISE EXCEPTION '000312: la lettura PIENA delle valutazioni e finita a un ruolo che non deve averla';
  END IF;

  SELECT count(*) FILTER (WHERE review_shared_at IS NOT NULL OR review_acknowledged_at IS NOT NULL),
         count(*) FILTER (WHERE review_shared_at IS NULL AND review_acknowledged_at IS NULL)
    INTO n_comunicate, n_non
    FROM sys.sys_performance_reviews;
  RAISE NOTICE '000312 ok — permesso self a 4 ruoli; valutazioni: % comunicate, % non comunicate (queste ultime restano invisibili alla persona)',
    n_comunicate, n_non;
END $$;
