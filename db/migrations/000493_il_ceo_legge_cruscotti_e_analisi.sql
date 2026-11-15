-- 000493 — L'amministratore delegato legge cruscotti e analisi (forense frontend 2026-11-15, D8).
--
-- IL FATTO, misurato il 2026-11-15 sulla matrice ruolo x permesso viva. `CEO` ha 48 permessi e fra
-- questi `dashboard_company:view`, quindi l'intento di prodotto e' che veda il cruscotto Azienda;
-- ma NON ha `dashboard:view`, `analytics:view`, `talent:read`, `goal:read`, `okr:read` e
-- `performance-review:read`: federica.marchetti riceveva 403 «Missing permission: analytics:view»
-- su ogni analisi, sul cruscotto iniziale, su obiettivi, OKR, revisione dei talenti e valutazioni.
-- Una persona a capo dell'azienda che non puo' aprire l'organico e' un difetto del ruolo, non una scelta.
--
-- LA DECISIONE (principio «il ruolo segue il lavoro», ADR-0050): i ruoli gerarchici sono di chi
-- dirige. Chi dirige l'azienda LEGGE cio' che dirige; non lo modifica. Si concedono quindi solo
-- permessi di LETTURA, e solo quelli le cui rotte il CEO gia' apre in altre forme:
--   dashboard:view, analytics:view, talent:read, goal:read, okr:read, performance-review:read.
-- NON si concede `insights:view`: il rischio di abbandono di una persona e' dichiarato riservato a
-- chi amministra o governa le persone (D-6 di insights/routes.ts), e non e' parte del lavoro di un CEO.
-- Che cosa il CEO veda DENTRO queste pagine non lo decide questo file: lo decidono il perimetro
-- gerarchico (I16-I20, il capo di una catena vede tutto cio' che le sta sotto) e la mascheratura
-- per classe di dato (ADR-0032), che restano invariati.
--
-- IDEMPOTENTE: `ON CONFLICT DO NOTHING` sulla concessione; i permessi esistono gia' (nessuna riga
-- di catalogo nuova, quindi nessuna traduzione da aggiungere). NESSUNA CANCELLAZIONE: per tornare
-- indietro basta togliere questo file (ADR-0035) e revocare le sei concessioni.
-- ALLOWLIST: riguarda solo TENANT_ADMIN (000210); nessun permesso viene concesso a TENANT_ADMIN.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'CEO'
   AND p.auth_permission_code IN ('dashboard:view', 'analytics:view', 'talent:read',
                                  'goal:read', 'okr:read', 'performance-review:read')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

COMMIT;

-- ============================================================================================
-- LE POST-CONDIZIONI
-- ============================================================================================
DO $post$
DECLARE n_ceo bigint;
BEGIN
  -- Dove il CEO esiste, ha le sei concessioni e nessuna e' ritirata (su un database nuovo
  -- senza il ruolo non c'e' nulla da verificare, e la catena non deve fermarsi qui).
  IF EXISTS (SELECT 1 FROM sys.sys_auth_roles WHERE auth_role_code = 'CEO') THEN
    SELECT count(*) INTO n_ceo
      FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
     WHERE r.auth_role_code = 'CEO' AND rp.revoked_at IS NULL
       AND p.auth_permission_code IN ('dashboard:view', 'analytics:view', 'talent:read',
                                      'goal:read', 'okr:read', 'performance-review:read');
    IF n_ceo <> 6 THEN
      RAISE EXCEPTION '000493: il CEO ha % delle 6 concessioni di lettura (una e'' ritirata o manca un permesso)', n_ceo;
    END IF;
  END IF;
  RAISE NOTICE '000493 ok — il CEO legge dashboard, analisi, talenti, obiettivi, OKR e valutazioni.';
END
$post$;
