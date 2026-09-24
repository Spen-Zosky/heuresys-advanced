-- 000451 — Mandato K, D11: il DPO apre il dossier, e lo legge mascherato.
--
-- LA DECISIONE. Enzo, 2026-09-25 (esiti/RISPOSTE_ENZO.md, riga «D11-permesso | 2026-09-25 | 1»),
-- dopo la domanda posta in esiti/D11.md: al DPO si concede `user:read`, cioe' la STRADA 1.
-- E' la conseguenza operativa della decisione del 2026-09-24 (riga «D11 | 2026-09-24 | A»):
-- il terzo stato — perimetro tenant-wide con COMPENSATION/EVALUATION mascherate, quinta
-- eccezione dichiarata ad ADR-0036 §5 — era gia' costruito in `lib/scope/` e provato nel
-- service, ma la porta HTTP restava chiusa perche' `GET /v1/users/:userId/dossier` e'
-- protetta da `user:read` e il DPO non lo aveva.
--
-- CHE COSA APRE DAVVERO, misurato e detto a Enzo prima che scegliesse. `requirePermission`
-- accetta UN codice solo, e `user:read` protegge quattro rotte dello stesso modulo
-- (apps/api/src/modules/users/routes.ts:35,49,63,138): l'elenco degli utenti, la scheda di
-- una persona, il dossier, e i ruoli di una persona. Tutte LETTURE, tutte filtrate dallo
-- stesso asse organizzativo che questa voce ha appena definito per il DPO; l'unica
-- informazione nuova rispetto al dossier e' quale ruolo porta una persona. L'alternativa
-- (un permesso dedicato) avrebbe richiesto di insegnare a `requirePermission` ad accettare
-- codici alternativi, toccando l'asserzione di boot che mappa ogni rotta a UN permesso
-- (D-51): costo alto e debito permanente su RBAC per zero effetti. Enzo ha scelto la prima.
--
-- COSA NON CAMBIA, ed e' il punto. `user:read` e' un permesso di LETTURA: il DPO non
-- guadagna nessuna scrittura (`user:create/update/delete` restano fuori), e sui dati
-- sensibili di un'altra persona legge MASCHERATO — `masksUnderTenantWideMandate`
-- (apps/api/src/lib/scope/mask.ts) toglie COMPENSATION ed EVALUATION e le dichiara in
-- `masked`. Le quattro eccezioni preesistenti di ADR-0036 §5 restano tutte vere per lui:
-- whistleblowing (isolamento assoluto, sentinella `v_whistleblowing_fuori_dal_custode`),
-- SPECIAL_CATEGORY, soglia di catena sulla retribuzione dei vertici, valutazioni non
-- comunicate. E `HR_MANDATED_ROLES` NON e' stato toccato: quello aprirebbe in chiaro.
--
-- IL CENSIMENTO, prima di toccare (C1, `chi_sorveglia.py user:read`):
--   ① sentinelle: nessuna · ② cancelli: un frammento dell'atlas (api_c9.yaml) · ③ test:
--   smoke-5-personas (e2e), me-permissions, landing-pages, dpo-dossier-mascherato · ④
--   scrittori: populate-reference-translations-governance.sql · ⑤ migrazioni: 000005
--   (lo crea), 000045, 000210 · ⑦ codice: users/routes.ts, roles-editor.tsx.
--   `000210` e' il self-healing deny-by-default e riguarda la sola allowlist di
--   TENANT_ADMIN: il DPO non e' TENANT_ADMIN, quindi non lo tocca e non lo disfa (verificato
--   leggendo il file, non dedotto). La matrice `esiti/R-11_matrice.json` — SoT delle prove
--   negative — e' aggiornata insieme a questa migrazione; il registro rotte di R-11 copre
--   solo le SCRITTURE e per `user` porta il solo `user:delete`, che il DPO non ha.
--
-- ROLLBACK DICHIARATO: un solo `UPDATE ... SET revoked_at = now()` sulla riga concessa qui
--   (elenco esplicito, mai un jolly), che disfa la concessione lasciando la storia:
--     UPDATE sys.sys_auth_role_permissions rp SET revoked_at = now(),
--            revoked_by_migration = 'rollback-000451'
--       FROM sys.sys_auth_roles r, sys.sys_auth_permissions p
--      WHERE rp.auth_role_id = r.auth_role_id AND rp.auth_permission_id = p.auth_permission_id
--        AND r.auth_role_code = 'DPO' AND p.auth_permission_code = 'user:read'
--        AND rp.revoked_at IS NULL;
--   NON va in db/migrations/ (ADR-0035: la catena si riapplica, lo disferebbe al giro dopo).
--
-- Effetto verificabile:
--   SELECT count(*) FROM sys.sys_auth_role_permissions rp
--     JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
--     JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
--    WHERE r.auth_role_code='DPO' AND p.auth_permission_code='user:read'
--      AND rp.revoked_at IS NULL;   -- atteso: 1
--
\set ON_ERROR_STOP on

BEGIN;

-- (a) LA MISURA PRIMA — quanti ruoli hanno `user:read` oggi, per la post-condizione (c).
CREATE TEMP TABLE mig451_prima ON COMMIT DROP AS
SELECT count(*)::int AS ruoli_con_user_read
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
 WHERE p.auth_permission_code = 'user:read' AND rp.revoked_at IS NULL;

-- (b) LA GUARDIA — il ruolo e il permesso devono esistere davvero. Un grant che "non fa
--     niente" perche' una delle due parti manca e' il modo in cui una concessione sparisce
--     senza che nessuno lo sappia.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.sys_auth_roles WHERE auth_role_code = 'DPO' AND retired_at IS NULL) THEN
    RAISE EXCEPTION '000451: il ruolo DPO non esiste o e'' ritirato (lo crea 000423)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sys.sys_auth_permissions WHERE auth_permission_code = 'user:read') THEN
    RAISE EXCEPTION '000451: il permesso user:read non esiste (lo crea 000005)';
  END IF;
END $$;

-- 1. La concessione. Elenco esplicito di UN permesso, mai un jolly.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'DPO'
   AND p.auth_permission_code = 'user:read'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 1b. Se la riga esisteva ritirata, la concessione va RIAPERTA: `ON CONFLICT DO NOTHING`
--     da solo lascerebbe una riga con `revoked_at` valorizzato e il permesso resterebbe
--     negato mentre la migrazione dichiara di averlo concesso. E' il caso che si presenta
--     dopo un rollback seguito da un nuovo deploy.
UPDATE sys.sys_auth_role_permissions rp
   SET revoked_at = NULL, revoked_by_migration = NULL
  FROM sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE rp.auth_role_id = r.auth_role_id
   AND rp.auth_permission_id = p.auth_permission_id
   AND r.auth_role_code = 'DPO'
   AND p.auth_permission_code = 'user:read'
   AND rp.revoked_at IS NOT NULL;

-- 2. La descrizione del ruolo diceva «La lettura mascherata del dossier (I18/I20) e' una
--    voce separata, non ancora decisa». Ora e' decisa: si emenda il file che la CREA
--    (ADR-0035) — cioe' questa riga, che e' l'ultima parola sulla descrizione — invece di
--    lasciare in produzione un testo che contraddice il comportamento.
UPDATE sys.sys_auth_roles
   SET auth_role_description =
       'Nucleo GDPR del tenant (gdpr:read, gdpr:export, gdpr:erase, gdpr:retention) piu'' la '
       'lettura del dossier di qualunque persona del tenant con retribuzione e valutazioni '
       'MASCHERATE: quinta eccezione dichiarata ad ADR-0036 §5 (mandato K, D11, decisioni di '
       'Enzo del 2026-09-24 e 2026-09-25). Tenant-scoped come TENANT_ADMIN/HRMS_MANAGER, '
       'nessun mandato di piattaforma e nessun mandato HR: i campi di COMPENSATION ed '
       'EVALUATION gli arrivano assenti e dichiarati in `masked`.'
 WHERE auth_role_code = 'DPO';

-- 3. La traduzione EN — la guardia della 000255 pretende copertura totale su sys_auth_roles,
--    nome E descrizione. Cambiata la descrizione IT, va cambiata anche quella EN, o la
--    copertura resta formale e il testo inglese descrive un ruolo che non esiste piu'.
UPDATE sys.sys_reference_translations t
   SET text =
       'Tenant GDPR core (gdpr:read, gdpr:export, gdpr:erase, gdpr:retention) plus reading the '
       'dossier of any person in the tenant with pay and evaluations MASKED: the fifth declared '
       'exception of ADR-0036 §5 (mandato K, D11, Enzo''s decisions of 2026-09-24 and 2026-09-25). '
       'Tenant-scoped like TENANT_ADMIN/HRMS_MANAGER, with no platform mandate and no HR mandate: '
       'COMPENSATION and EVALUATION fields arrive absent and declared in `masked`.'
  FROM sys.sys_auth_roles r
 WHERE t.entity_table = 'sys_auth_roles'
   AND t.entity_id = r.auth_role_id
   AND r.auth_role_code = 'DPO'
   AND t.field = 'description'
   AND t.locale = 'en';

-- (c) LE POST-CONDIZIONI — e la prima protegge cio' che NON doveva cambiare.
DO $$
DECLARE
  n_dpo_user_read int;
  n_dpo_gdpr int;
  n_dpo_scritture int;
  n_ruoli_dopo int;
  n_ruoli_prima int;
  n_en int;
BEGIN
  -- ciò che NON doveva cambiare: il numero di ruoli con `user:read` sale di ESATTAMENTE uno.
  SELECT ruoli_con_user_read INTO n_ruoli_prima FROM mig451_prima;
  SELECT count(*) INTO n_ruoli_dopo
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'user:read' AND rp.revoked_at IS NULL;
  IF n_ruoli_dopo NOT IN (n_ruoli_prima, n_ruoli_prima + 1) THEN
    RAISE EXCEPTION '000451: i ruoli con user:read sono passati da % a %: questa migrazione ne aggiunge UNO solo',
      n_ruoli_prima, n_ruoli_dopo;
  END IF;

  -- l'effetto voluto
  SELECT count(*) INTO n_dpo_user_read
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'DPO' AND p.auth_permission_code = 'user:read' AND rp.revoked_at IS NULL;
  IF n_dpo_user_read <> 1 THEN
    RAISE EXCEPTION '000451: DPO deve avere user:read ATTIVO, righe attive trovate: %', n_dpo_user_read;
  END IF;

  -- il nucleo GDPR di 000423 non e'' stato sfiorato
  SELECT count(*) INTO n_dpo_gdpr
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'DPO' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('gdpr:read', 'gdpr:export', 'gdpr:erase', 'gdpr:retention');
  IF n_dpo_gdpr <> 4 THEN
    RAISE EXCEPTION '000451: il nucleo GDPR di DPO non e'' piu'' completo (% su 4)', n_dpo_gdpr;
  END IF;

  -- il DPO resta SENZA scritture sulle persone: e'' il confine di questa voce
  SELECT count(*) INTO n_dpo_scritture
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'DPO' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('user:create', 'user:update', 'user:delete');
  IF n_dpo_scritture <> 0 THEN
    RAISE EXCEPTION '000451: DPO ha guadagnato % permessi di SCRITTURA su user: D11 apre una LETTURA', n_dpo_scritture;
  END IF;

  -- la copertura EN della descrizione (guardia 000255)
  SELECT count(*) INTO n_en
    FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_roles r ON r.auth_role_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_roles' AND r.auth_role_code = 'DPO'
     AND t.field = 'description' AND t.locale = 'en';
  IF n_en <> 1 THEN
    RAISE EXCEPTION '000451: la descrizione EN di DPO non e'' coperta esattamente una volta (%)', n_en;
  END IF;

  RAISE NOTICE '000451 ok: DPO ha user:read (ruoli con user:read: % -> %), nucleo GDPR intatto (4), zero scritture su user',
    n_ruoli_prima, n_ruoli_dopo;
END $$;

COMMIT;
