-- 000404 — Le filiali hanno un permesso (B14).
--
-- IL FATTO, misurato il 2026-09-10. `sys.sys_branches` esiste, contiene 6 righe e porta
-- `branch_tenant_id` — e' quindi un dato DI CLIENTE a tutti gli effetti. Ma **nessun file di
-- `apps/api/src` la nomina** (cercato nel contenuto di tutti i `.ts`, non nei nomi dei file) e
-- **nessun permesso RBAC esiste per la risorsa `branch`**: `auth_permission_resource='branch'`
-- da' zero righe.
--
-- Esiste pero' un cruscotto `branch` («Cruscotto Filiale») con `dashboard_branch:view`, e il
-- ruolo `BRANCH_MANAGER`: c'e' una superficie, e un mestiere, per una cosa che l'API non serve.
-- Per una banca il cui ruolo piu' diffuso e' «responsabile di filiale», le filiali non avevano
-- ne' API ne' permesso.
--
-- CHI RICEVE IL PERMESSO, e la scelta e' presa dai dati esistenti, non a gusto: gli stessi
-- ruoli che possiedono `dashboard_branch:view` (BRANCH_MANAGER, MANAGER, PLATFORM_ADMIN) piu'
-- quelli che governano l'organizzazione del cliente e che gia' leggono le squadre —
-- TENANT_ADMIN, HRMS_MANAGER, CEO. Una filiale e' un'unita' organizzativa con un indirizzo:
-- chi legge l'organigramma deve poterla leggere.
--
-- ⚠ NON e' un dato di persona: le colonne sono codice, indirizzo, citta', CAP, orari, zona
-- regolamentare. Nessun soggetto, nessun attore — solo `created_by`/`updated_by`, che sono
-- attori tecnici. Percio' la risorsa non entra nella tassonomia delle classi sensibili, e le
-- rotte non dichiarano `orgGate`. Dichiarano invece il confine fra clienti, che c'e' eccome.
--
-- IDEMPOTENTE: `ON CONFLICT DO NOTHING` su entrambe le tabelle.
-- NESSUNA CANCELLAZIONE. Per tornare indietro: togliere questo file (ADR-0035).
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action,
   auth_permission_description)
VALUES
  ('branch:list', 'Elenco filiali (filtrate per cliente)', 'branch', 'list',
   'Elenco delle filiali del proprio cliente. B14, 2026-09-10.'),
  ('branch:read', 'Lettura di una filiale', 'branch', 'read',
   'Dettaglio di una filiale del proprio cliente. B14, 2026-09-10.')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- I ruoli: quelli che gia' vedono il cruscotto delle filiali, piu' quelli che governano
-- l'organizzazione del cliente. Derivati, non elencati a caso — e la post-condizione verifica
-- che BRANCH_MANAGER ci sia, perche' senza di lui il permesso non servirebbe a chi lo usa.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE p.auth_permission_code IN ('branch:list', 'branch:read')
   AND r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER',
                            'CEO', 'MANAGER', 'BRANCH_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- ── LE TRADUZIONI INGLESI, che NON sono un dettaglio cosmetico ──────────────────────────
-- `sys_auth_permissions` e' nel registro dei campi traducibili (`sys_translatable_field`) per
-- nome E descrizione, e la guardia della `000255` pretende copertura EN totale: due permessi
-- nuovi senza traduzione fermano l'INTERA catena di migrazioni. Misurato subito: la prova
-- generale e' uscita rossa con «Copertura EN: restano 4 traduzioni mancanti» — 2 permessi per
-- 2 campi. E' lo stesso inciampo gia' pagato dalla `000272` e dai 34 KPI di B30: chi aggiunge
-- una riga di catalogo la scrive anche in inglese, o blocca il deploy di tutti.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_permissions p
  JOIN (VALUES
    ('branch:list', 'name',        'Branch list (tenant-scoped)'),
    ('branch:list', 'description', 'List of the branches of one''s own tenant. B14, 2026-09-10.'),
    ('branch:read', 'name',        'Read a branch'),
    ('branch:read', 'description', 'Detail of a branch of one''s own tenant. B14, 2026-09-10.')
  ) AS x(codice, campo, testo) ON x.codice = p.auth_permission_code
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================================
-- LE POST-CONDIZIONI
-- ============================================================================================
DO $post$
DECLARE n_perm bigint; n_grant bigint; n_bm bigint; n_filiali bigint;
BEGIN
  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_resource = 'branch';
  IF n_perm <> 2 THEN
    RAISE EXCEPTION '000404: i permessi della risorsa branch sono % invece di 2', n_perm;
  END IF;

  SELECT count(*) INTO n_grant FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_resource = 'branch';
  IF n_grant <> 12 THEN
    RAISE EXCEPTION '000404: le concessioni sui permessi branch sono % invece di 12 '
      '(6 ruoli x 2 permessi)', n_grant;
  END IF;

  -- Chi fa il mestiere deve avere il permesso: senza BRANCH_MANAGER questa voce non servirebbe
  -- a nessuno, ed e' il caso che una guardia distratta lascerebbe passare.
  SELECT count(*) INTO n_bm FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE p.auth_permission_code = 'branch:read' AND r.auth_role_code = 'BRANCH_MANAGER';
  IF n_bm <> 1 THEN
    RAISE EXCEPTION '000404: BRANCH_MANAGER non ha branch:read — il ruolo che porta il nome '
      'delle filiali non potrebbe leggerle';
  END IF;

  -- La copertura EN torna a zero: se non lo facesse, la catena si fermerebbe sulla `000255`
  -- al prossimo deploy, e non su questo file — cioe' lontano dalla causa.
  DECLARE n_gap bigint;
  BEGIN
    SELECT coalesce(sum(missing), 0) INTO n_gap FROM sys.v_reference_translation_coverage;
    IF n_gap <> 0 THEN
      RAISE EXCEPTION '000404: restano % traduzioni EN mancanti — i permessi nuovi bloccherebbero '
        'la catena sulla guardia della 000255', n_gap;
    END IF;
  END;

  -- CIO' CHE NON DOVEVA CAMBIARE: le filiali non si toccano, questo file crea permessi.
  SELECT count(*) INTO n_filiali FROM sys.sys_branches;
  RAISE NOTICE '000404 ok — 2 permessi branch, % concessioni su 6 ruoli, % filiali intatte, '
    'copertura EN a zero.', n_grant, n_filiali;
END
$post$;
