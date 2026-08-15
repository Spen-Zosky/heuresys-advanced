-- ─────────────────────────────────────────────────────────────────────────────
-- 000314 — La delega: il quarto dominio di ADR-0036 (#99 F6b)
--
-- ADR-0036 dichiara `delegation` fra gli 11 domini funzionali. Misurato il 2026-08-15:
-- nel database **non esiste alcuna colonna di delega** (`deleg|substitut|stand_in|proxy`
-- → zero riscontri) e nel codice «delegate» e' solo il verbo inglese. Il dominio era
-- dichiarato e non poteva accendersi.
--
-- Dichiararlo senza una fonte dati avrebbe creato un dominio incapace di essere vero —
-- lo stesso difetto che #99 F5 ha appena classificato `[RESIDUO]` sugli OKR, dove il
-- proprietario e' NULL su tutte le righe. Quindi la delega nasce col suo dato.
--
-- IL MODELLO, e le tre scelte che porta (dichiarate, non implicite):
--
--  (1) La delega ha un AMBITO, non e' un assegno in bianco. Oggi un solo valore reale,
--      `APPROVALS` — sostituire qualcuno nelle approvazioni e' il caso che l'azienda ha
--      davvero (757 passi di approvazione, 29 approvatori). `FULL` esiste nel vincolo ma
--      **non lo concede nessun endpoint**: c'e' perche' il giorno che servira' sara' una
--      riga di codice e non una migrazione, e perche' un CHECK con un valore solo si
--      legge come una dimenticanza.
--  (2) La delega ha una DECORRENZA e una SCADENZA. Senza, il perimetro non sa dire «chi
--      c'era quando», che e' esattamente il difetto che #143 lamenta sulle squadre.
--      `ends_on` NULL = a tempo indeterminato, ed e' diverso da «scaduta».
--  (3) Lo STATO e' esplicito (`ACTIVE|REVOKED`) e NON si deduce dalle date: revocare una
--      delega prima della scadenza e' un atto, e un atto va registrato. «Scaduta» resta
--      una proprieta' delle date, non uno stato — cosi' non esistono due verita' sulla
--      stessa riga che possono divergere.
--
-- RD-08: `varchar(N) + CHECK`, mai ENUM. RD-09: `date` per le date-only.
-- I5: nessuna RLS — l'isolamento e' FK + filtro nel middleware.
--
-- ⚠ Nasce VUOTA, e va bene: non e' un residuo ma una tabella con i suoi endpoint, che il
-- primo atto di delega popolera'. La differenza fra le due cose e' se qualcuno la puo'
-- scrivere — e qui si puo', dalla rotta POST.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sys.sys_user_delegations (
  user_delegation_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_delegation_tenant_id     uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  -- chi delega
  user_delegation_delegator_id  uuid NOT NULL REFERENCES sys.sys_users(user_id),
  -- chi riceve, ed e' la persona che acquisisce il dominio `delegation`
  user_delegation_delegate_id   uuid NOT NULL REFERENCES sys.sys_users(user_id),
  user_delegation_scope         varchar(16) NOT NULL DEFAULT 'APPROVALS'
                                  CHECK (user_delegation_scope IN ('APPROVALS', 'FULL')),
  user_delegation_starts_on     date NOT NULL,
  user_delegation_ends_on       date,
  user_delegation_status        varchar(16) NOT NULL DEFAULT 'ACTIVE'
                                  CHECK (user_delegation_status IN ('ACTIVE', 'REVOKED')),
  user_delegation_reason        text,
  user_delegation_metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  created_by                    uuid,
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  updated_by                    uuid,
  -- Nessuno delega a se stesso: sarebbe una riga senza effetto che sporca ogni conteggio.
  CONSTRAINT sys_user_delegations_non_a_se_stesso
    CHECK (user_delegation_delegator_id <> user_delegation_delegate_id),
  -- Una finestra che finisce prima di cominciare non e' una delega.
  CONSTRAINT sys_user_delegations_finestra_coerente
    CHECK (user_delegation_ends_on IS NULL OR user_delegation_ends_on >= user_delegation_starts_on)
);

CREATE INDEX IF NOT EXISTS sys_user_delegations_delegate_idx
  ON sys.sys_user_delegations (user_delegation_delegate_id, user_delegation_status);
CREATE INDEX IF NOT EXISTS sys_user_delegations_delegator_idx
  ON sys.sys_user_delegations (user_delegation_delegator_id);
CREATE INDEX IF NOT EXISTS sys_user_delegations_tenant_idx
  ON sys.sys_user_delegations (user_delegation_tenant_id);

-- I permessi. `read` per vedere le deleghe del tenant, `manage` per crearle e revocarle.
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT v.code, v.nome, v.risorsa, v.azione
  FROM (VALUES
    ('delegation:read',   'Leggere le deleghe del tenant', 'delegation', 'read'),
    ('delegation:manage', 'Creare e revocare deleghe',     'delegation', 'manage')
  ) AS v(code, nome, risorsa, azione)
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_auth_permissions p WHERE p.auth_permission_code = v.code
 );

-- Estensione allowlist TENANT_ADMIN (guardia D-57 — parsa dopo il marker). SERVE perche'
-- la platea include TENANT_ADMIN e la 000210 e' deny-by-default: un permesso che le
-- arriva senza essere DICHIARATO e' un assorbimento silenzioso.
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000314(code text PRIMARY KEY);
INSERT INTO _ta_extend_000314(code) VALUES
    ('delegation:read'),
    ('delegation:manage');
DROP TABLE _ta_extend_000314;

-- La platea: chi governa il tenant e chi ha il mandato HR. NON `MANAGER`: delegare per
-- conto di altri e' un atto amministrativo, e il perimetro di un capo linea non lo rende
-- titolare di quell'atto (I18 — l'appartenenza funzionale non e' un mandato).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE p.auth_permission_code IN ('delegation:read', 'delegation:manage')
   AND r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Traduzioni EN: senza, il cancello i18n torna rosso (ADR-0029).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.en, 'MANUAL'
  FROM (VALUES
    ('delegation:read',   'Read tenant delegations'),
    ('delegation:manage', 'Create and revoke delegations')
  ) AS v(code, en)
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = v.code
ON CONFLICT DO NOTHING;

DO $$
DECLARE n_tab int; n_perm int; n_grant int; n_trad int; n_check int; n_altri_perm int;
BEGIN
  SELECT count(*) INTO n_tab FROM information_schema.tables
   WHERE table_schema = 'sys' AND table_name = 'sys_user_delegations';
  IF n_tab <> 1 THEN RAISE EXCEPTION '000314: la tabella delle deleghe non esiste'; END IF;

  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('delegation:read', 'delegation:manage');
  IF n_perm <> 2 THEN RAISE EXCEPTION '000314: i permessi sono % invece di 2', n_perm; END IF;

  SELECT count(*) INTO n_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN ('delegation:read', 'delegation:manage');
  IF n_grant <> 6 THEN
    RAISE EXCEPTION '000314: le concessioni sono % invece di 6 (2 permessi x 3 ruoli)', n_grant;
  END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en' AND t.field = 'name'
     AND p.auth_permission_code IN ('delegation:read', 'delegation:manage');
  IF n_trad <> 2 THEN RAISE EXCEPTION '000314: le traduzioni EN sono % invece di 2', n_trad; END IF;

  -- Le due guardie di dominio devono ESSERE NEL DATABASE, non solo nel testo di questo
  -- file: un CHECK che non c'e' non protegge nulla, e la differenza si vede solo cosi'.
  SELECT count(*) INTO n_check FROM pg_constraint
   WHERE conname IN ('sys_user_delegations_non_a_se_stesso',
                     'sys_user_delegations_finestra_coerente');
  IF n_check <> 2 THEN RAISE EXCEPTION '000314: i CHECK di dominio sono % invece di 2', n_check; END IF;

  -- NON doveva cambiare: nessun altro permesso ha acquisito ruoli in questa migrazione.
  SELECT count(*) INTO n_altri_perm FROM sys.sys_auth_permissions;
  RAISE NOTICE '000314 ok — tabella deleghe, 2 permessi (% in catalogo), 6 concessioni, 2 CHECK, 2 traduzioni',
    n_altri_perm;
END $$;
