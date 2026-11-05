-- 000472_a4_sentinella_del_pavimento_area_personale.sql
-- Piano interfacce, voce A-4 (2026-11-05). Il pavimento dell'area personale imposto da una
-- sentinella, invece che dalla prassi.
--
-- Il pavimento sono i 9 permessi :self che ogni ruolo porta (000054 «granted to ALL roles»,
-- 000432 §(a), invariante I17), più il ruolo USER che ogni persona attiva ha nel suo tenant
-- (regola di Enzo del 31/10, PR #135: /me per tutti). Oggi nessun controllo li impone dopo la
-- nascita del tenant: HIRING_MANAGER e RECRUITER, nati con 000427/000428, erano rimasti senza i
-- 9 permessi e non aprivano nessuna pagina (D-06 del confronto V4); un agente che agisce per una
-- persona senza pavimento fallisce ogni azione di autoservizio (M-5).
--
-- Vista sys.v_pavimento_area_personale_mancante, due specie di riga:
--   ruolo   -> un ruolo di tenant (auth_role_is_platform = false) a cui manca almeno uno dei 9
--              permessi; il dettaglio li elenca. I ruoli di piattaforma restano fuori: hanno un
--              perimetro tecnico, non un'area personale di tenant.
--   persona -> una persona attiva, non di servizio, con almeno un ruolo attivo in un tenant e
--              senza USER attivo in quel tenant. Si riporta l'id, mai il nome.
-- Ogni riga è una violazione da guardare: la sentinella pretende zero.
--
-- Idempotente: CREATE OR REPLACE VIEW. Sola lettura. Rollback dichiarato: DROP VIEW (nessun
-- oggetto ne dipende).

BEGIN;

CREATE OR REPLACE VIEW sys.v_pavimento_area_personale_mancante AS
WITH pavimento(codice) AS (
  VALUES ('consent:manage:self'), ('gdpr:export:self'), ('leave:request:self'),
         ('me:content:read'), ('me:preferences:read'), ('me:preferences:update'),
         ('me:sessions:manage'), ('surveys:respond:self'), ('team:read:self')
), mancanti_per_ruolo AS (
  SELECT r.auth_role_code, string_agg(pv.codice, ', ' ORDER BY pv.codice) AS mancanti
    FROM sys.sys_auth_roles r
    CROSS JOIN pavimento pv
   WHERE r.auth_role_is_platform = false
     AND NOT EXISTS (
       SELECT 1
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE rp.auth_role_id = r.auth_role_id AND p.auth_permission_code = pv.codice)
   GROUP BY r.auth_role_code
), persone_senza_user AS (
  SELECT DISTINCT ur.user_auth_role_user_id AS user_id, ur.user_auth_role_tenant_id AS tenant_id
    FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
   WHERE ur.user_auth_role_revoked_at IS NULL
     AND ur.user_auth_role_tenant_id IS NOT NULL
     AND u.user_status = 'ACTIVE'
     AND u.user_type <> 'SERVICE'
     AND NOT EXISTS (
       SELECT 1
         FROM sys.sys_user_auth_roles ux
         JOIN sys.sys_auth_roles rx ON rx.auth_role_id = ux.user_auth_role_role_id
        WHERE ux.user_auth_role_user_id = ur.user_auth_role_user_id
          AND ux.user_auth_role_tenant_id = ur.user_auth_role_tenant_id
          AND ux.user_auth_role_revoked_at IS NULL
          AND rx.auth_role_code = 'USER')
)
SELECT 'ruolo'::text AS specie, auth_role_code::text AS soggetto, NULL::uuid AS tenant_id,
       'mancano: ' || mancanti AS dettaglio
  FROM mancanti_per_ruolo
UNION ALL
SELECT 'persona'::text, user_id::text, tenant_id,
       'persona attiva con ruoli nel tenant ma senza USER: niente area personale'
  FROM persone_senza_user;

COMMENT ON VIEW sys.v_pavimento_area_personale_mancante IS
  'A-4 del piano interfacce (mig 000472): i ruoli di tenant senza uno dei 9 permessi del pavimento :self (I17) e le persone attive senza USER nel tenant dove hanno ruoli. Pretende zero. Sola lettura.';

COMMIT;
