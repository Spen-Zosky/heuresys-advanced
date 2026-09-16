-- 000421 — R-0 (mandato K): l'asse "utente di piattaforma assegnato a certi clienti" (D9=B).
--
-- IL PERCHE'. D9=B (Enzo, 2026-09-14): i ruoli di piattaforma nuovi che il mandato costruira'
-- (R-9 PLATFORM_OPERATOR/SALES, R-8 IMPLEMENTATION_CONSULTANT, R-5 BLUEPRINT_MANAGER) non
-- devono vedere TUTTI i clienti come PLATFORM_ADMIN: solo quelli a cui sono stati assegnati.
-- Un consulente d'avviamento esterno che vede l'elenco completo dei clienti di una banca e' un
-- problema commerciale prima che tecnico.
--
-- IL FATTO, misurato da I-G (2026-09-15) e ri-misurato oggi (esiti/R-0_porte.md): oggi non
-- esiste alcun asse utente<->piu' clienti. `sys_users.user_tenant_id` e' NOT NULL (anche
-- PLATFORM_ADMIN appartiene a un cliente "di casa"); `sys_user_auth_roles.user_auth_role_tenant_id`
-- e' solo metadato del grant, mai letto dal resolver. R-0 parte da zero.
--
-- QUESTO FILE crea la tabella di assegnazione e il permesso che la governa. Il filtro nel
-- codice (apps/api/src/lib/actor.ts, funzione perimetroClienti) e il collegamento dei 24 punti
-- misurati da I-G sono nello stesso commit di questo file, non dentro di esso: la migrazione
-- non tocca codice applicativo (ADR-0035 non lo richiede qui, non e' un ritiro).
--
-- Effetto per dove_siamo.py:
--   select 1 from information_schema.tables where table_schema='sys'
--     and table_name='sys_platform_user_tenant_assignments'
--
\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_platform_user_tenant_assignments (
  platform_user_tenant_assignment_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_tenant_assignment_user_id     uuid NOT NULL REFERENCES sys.sys_users(user_id),
  platform_user_tenant_assignment_tenant_id   uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  platform_user_tenant_assignment_assigned_at timestamptz NOT NULL DEFAULT now(),
  platform_user_tenant_assignment_assigned_by uuid NULL REFERENCES sys.sys_users(user_id),
  platform_user_tenant_assignment_revoked_at  timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sys.sys_platform_user_tenant_assignments IS
  '000421 (mandato K, R-0, D9=B) - quali clienti un utente di piattaforma (ruolo in PLATFORM_ASSIGNED_MANDATE_ROLES, apps/api/src/lib/scope/mandati.ts) puo vedere. Assenza di riga = nessun cliente, non tutti. Ritirare = valorizzare revoked_at (ADR-0035), mai DELETE.';

-- Una sola assegnazione ATTIVA per coppia utente+cliente: si puo' revocare e ri-assegnare, ma
-- non stare doppia mentre e' viva.
CREATE UNIQUE INDEX IF NOT EXISTS ux_platform_user_tenant_assignment_active
  ON sys.sys_platform_user_tenant_assignments
     (platform_user_tenant_assignment_user_id, platform_user_tenant_assignment_tenant_id)
  WHERE platform_user_tenant_assignment_revoked_at IS NULL;

-- L'unico accesso che il codice fara' a runtime: tutte le assegnazioni vive di un utente.
CREATE INDEX IF NOT EXISTS ix_platform_user_tenant_assignment_user
  ON sys.sys_platform_user_tenant_assignments (platform_user_tenant_assignment_user_id)
  WHERE platform_user_tenant_assignment_revoked_at IS NULL;

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action,
   auth_permission_description)
VALUES
  ('platform_tenant_assignment:manage', 'Assegna o revoca clienti a un utente di piattaforma',
   'platform_tenant_assignment', 'manage',
   'Governa sys_platform_user_tenant_assignments: quali clienti un ruolo di piattaforma assegnato (D9=B, mandato K) puo vedere. R-0, 2026-09-16.')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Solo PLATFORM_ADMIN (D9): nessun altro ruolo, oggi, decide chi vede quali clienti.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'platform_tenant_assignment:manage'
   AND r.auth_role_code = 'PLATFORM_ADMIN'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Traduzioni EN (guardia 000255): un permesso nuovo senza traduzione ferma l'intera catena al
-- prossimo deploy, non su questo file.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_permissions p
  JOIN (VALUES
    ('platform_tenant_assignment:manage', 'name', 'Assign or revoke tenants to a platform user'),
    ('platform_tenant_assignment:manage', 'description',
     'Governs sys_platform_user_tenant_assignments: which tenants an assigned platform role (D9=B, mandate K) may see. R-0, 2026-09-16.')
  ) AS x(codice, campo, testo) ON x.codice = p.auth_permission_code
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================================
-- LE POST-CONDIZIONI
-- ============================================================================================
DO $post$
DECLARE n_tab int; n_idx int; n_perm int; n_grant int; n_gap bigint;
BEGIN
  SELECT count(*) INTO n_tab FROM information_schema.tables
   WHERE table_schema='sys' AND table_name='sys_platform_user_tenant_assignments';
  IF n_tab <> 1 THEN RAISE EXCEPTION '000421: tabella non creata'; END IF;

  SELECT count(*) INTO n_idx FROM pg_indexes
   WHERE schemaname='sys' AND tablename='sys_platform_user_tenant_assignments';
  IF n_idx < 3 THEN -- PK + i due indici parziali
    RAISE EXCEPTION '000421: indici attesi almeno 3, trovati %', n_idx;
  END IF;

  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code = 'platform_tenant_assignment:manage';
  IF n_perm <> 1 THEN RAISE EXCEPTION '000421: permesso non creato'; END IF;

  SELECT count(*) INTO n_grant FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE p.auth_permission_code = 'platform_tenant_assignment:manage';
  IF n_grant <> 1 THEN
    RAISE EXCEPTION '000421: concessioni = % invece di 1 (solo PLATFORM_ADMIN, D9)', n_grant;
  END IF;

  SELECT coalesce(sum(missing), 0) INTO n_gap FROM sys.v_reference_translation_coverage;
  IF n_gap <> 0 THEN
    RAISE EXCEPTION '000421: restano % traduzioni EN mancanti', n_gap;
  END IF;

  RAISE NOTICE '000421 ok - tabella creata (% indici), 1 permesso, 1 concessione (solo PLATFORM_ADMIN).', n_idx;
END
$post$;

-- FINE 000421
