-- 000471 — S-18 del piano interfacce (docs/piani/PIANO_interfacce_20261103.md).
--
-- IL PERCHE'. `gdpr:retention` (POST /v1/gdpr/retention/run, la pulizia dei dati scaduti su
-- tutte le finestre del registro) era concesso a PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER e
-- DPO, ma il servizio lo nega con 403 PLATFORM_ONLY a chiunque non sia PLATFORM_ADMIN
-- (gdpr/service.ts; difetto gia' annotato in lib/scope/mandati.ts). Il permesso prometteva
-- un'azione che la persona non poteva fare: la pagina o l'agente che lo leggeva sbagliava.
--
-- LA DECISIONE. Enzo, 2026-11-04 05:56 Roma, scheda «Chi puo' lanciare la pulizia dei dati
-- scaduti (retention GDPR)?» -> «Solo la piattaforma». Si allinea il permesso a cio' che il
-- servizio fa; nessuna pulizia nuova, nessun dato cancellato.
--
-- COME (ADR-0035, ritirare non e' cancellare).
--   - TENANT_ADMIN: si toglie il codice dall'allowlist di 000210, che e' la sola via che non
--     oscilla (vedi il suo «COME SI TOGLIE UN PERMESSO»): il passo 2 di 000210 lo rimuove.
--   - HRMS_MANAGER: ruolo preesistente al mandato K, quindi il ritiro e' una seconda eccezione
--     a D2: la riga di ammissione e' in 000420 (decisa da Enzo, voce S-18), qui l'atto.
--   - DPO: 000423 non lo concede piu'; qui si marca la riga gia' concessa.
--   La riga resta, con revoked_at e revoked_by_migration. 000186 continua a concederlo a
--   HRMS_MANAGER su un database nuovo (ON CONFLICT DO NOTHING non toglie il ritiro): e' lo
--   stesso schema di gdpr:erase con 000423.
--
-- IDEMPOTENTE: aggiorna solo righe ancora attive.

BEGIN;

UPDATE sys.sys_auth_role_permissions rp
   SET revoked_at = now(), revoked_by_migration = '000471'
  FROM sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE r.auth_role_id = rp.auth_role_id
   AND p.auth_permission_id = rp.auth_permission_id
   AND p.auth_permission_code = 'gdpr:retention'
   AND r.auth_role_code IN ('HRMS_MANAGER', 'DPO')
   AND rp.revoked_at IS NULL;

DO $$
DECLARE titolari text[]; n_guardia int;
BEGIN
  SELECT array_agg(r.auth_role_code::text ORDER BY r.auth_role_code) INTO titolari
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'gdpr:retention' AND rp.revoked_at IS NULL;
  IF titolari IS DISTINCT FROM ARRAY['PLATFORM_ADMIN']::text[] THEN
    RAISE EXCEPTION '000471: gdpr:retention attivo per %, atteso solo PLATFORM_ADMIN', titolari;
  END IF;

  SELECT count(*) INTO n_guardia FROM sys.v_permessi_ritirati_a_ruoli_preesistenti;
  IF n_guardia <> 0 THEN
    RAISE EXCEPTION '000471: guardia G-D2 accesa (% righe), attese 0', n_guardia;
  END IF;
  RAISE NOTICE '000471: gdpr:retention solo a PLATFORM_ADMIN';
END $$;

COMMIT;
