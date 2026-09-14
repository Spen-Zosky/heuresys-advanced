-- misura-rbac.sql — rigenera i numeri di RBAC_COME_FUNZIONA_DAVVERO.md (⭐ IL PUNTO FISSO:
-- il documento porta numeri datati; questo file è il comando che li produce).
--
--   psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f docs/kb/xtras/misura-rbac.sql
--
-- Adottato in S1100 (2026-09-14) dal workspace Cowork `session_2026-09-14_decisioni-250-240`,
-- con i nomi di colonna corretti sul database vivo (`sys_auth_role_permissions.auth_role_id`).

\echo === 1. i 14 ruoli: famiglia, quanti permessi, quante persone li portano ===
SELECT r.auth_role_code                        AS ruolo,
       coalesce(r.auth_role_category, '(nessuna dichiarata)') AS famiglia,
       (SELECT count(*) FROM sys.sys_auth_role_permissions rp
         WHERE rp.auth_role_id = r.auth_role_id)  AS permessi,
       (SELECT count(DISTINCT ur.user_auth_role_user_id) FROM sys.sys_user_auth_roles ur
         WHERE ur.user_auth_role_role_id = r.auth_role_id
           AND ur.user_auth_role_revoked_at IS NULL) AS persone_che_lo_portano
  FROM sys.sys_auth_roles r
 ORDER BY permessi DESC, ruolo;

\echo === 2. i totali: permessi, coppie ruolo-permesso, ruoli ===
SELECT (SELECT count(*) FROM sys.sys_auth_permissions)      AS permessi_totali,
       (SELECT count(*) FROM sys.sys_auth_role_permissions) AS coppie_ruolo_permesso,
       (SELECT count(*) FROM sys.sys_auth_roles)            AS ruoli_totali;

\echo === 3. la forma di un permesso: un campione ===
SELECT auth_permission_code AS permesso
  FROM sys.sys_auth_permissions
 ORDER BY random() LIMIT 12;

\echo === 4. la porta chiusa del whistleblowing: chi porta whistleblowing:* (atteso: solo il custode) ===
SELECT r.auth_role_code AS ruolo, p.auth_permission_code AS permesso
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_roles r       ON r.auth_role_id = rp.auth_role_id
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
 WHERE p.auth_permission_code LIKE 'whistleblowing:%'
 ORDER BY 1, 2;

\echo === 5. la sentinella (000414): righe fuori dal custode — attese 0 ===
SELECT count(*) AS violazioni FROM sys.v_whistleblowing_fuori_dal_custode;

\echo === 6. i permessi che mancano a PLATFORM_ADMIN ===
SELECT p.auth_permission_code AS permesso_mancante
  FROM sys.sys_auth_permissions p
 WHERE NOT EXISTS (
         SELECT 1 FROM sys.sys_auth_role_permissions rp
           JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
          WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND rp.auth_permission_id = p.auth_permission_id)
 ORDER BY 1;
