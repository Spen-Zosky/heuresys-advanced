-- ============================================================================
-- 000272 — Chi regge una FILIALE ha il cruscotto. Chi guida una SQUADRA no.
--
-- LA DECISIONE (Enzo, 2026-08-05)
--   «Possiamo dare il cruscotto ai capi filiale, perche' una filiale e' un
--   sotto-albero gerarchico; i capi squadra vanno trattati diversamente: una
--   squadra e' attiva su uno SCOPO funzionale, e il suo capo puo' essere
--   gerarchicamente inferiore a uno o piu' membri — va inteso come capo
--   progetto dello scopo assegnato.»
--
--   Chiude la domanda aperta «un capo filiale deve vedere il cruscotto?»
--   (`.handoff/STATE.md`, lasciata aperta da #116 per non presumerla).
--
-- PERCHE' UN RUOLO NUOVO E NON UN GRANT SU `TEAM_LEADER`
--   Misurato prima di scrivere: i 10 capi filiale e `marco.rinaldi`, che guida
--   una squadra e non regge alcuna unita', hanno gli STESSI TRE RUOLI —
--   TEAM_LEADER + TEAM_MEMBER + USER. Concedere `dashboard:view` a TEAM_LEADER
--   avrebbe dato il cruscotto anche a lui: esattamente la confusione che la
--   decisione chiede di evitare.
--
--   Il ruolo non distingue i due casi; il FATTO si': reggere un'unita' attiva di
--   tipo BRANCH. E' la stessa lezione di S1044 e della 000271 — decidere da una
--   proprieta' verificabile, non da un'etichetta.
--
-- L'ASSEGNAZIONE E' DERIVATA, NON UN ELENCO
--   Nessuna email compare qui. Il ruolo va a chi risulta responsabile di
--   un'unita' BRANCH attiva al momento dell'esecuzione. Se domani apre una
--   filiale, la migrazione ri-eseguita la include; se una chiude, la riga resta
--   e va revocata esplicitamente (revocare e' una decisione, non un effetto).
--
-- DIREZIONE DICHIARATA (Enzo, 2026-08-05) — perche' questo NON e' il punto d'arrivo
--   Proseguendo nascera' una FAMIGLIA di cruscotti focalizzati per tipologia di
--   utilizzatore: Dashboard Azienda · Processi · Organizzazione · Filiale · HR
--   Management · Platform Management · Tenant Management · Self-Service … e
--   «cruscotto» da solo non bastera' piu' a collegare una persona a una vista:
--   ogni cruscotto avra' requisiti d'accesso propri, incluso il DIVIETO e la
--   granularita' di cio' che mostra.
--
--   Quando quel modello arrivera', `BRANCH_MANAGER` e' gia' l'aggancio giusto per
--   «Dashboard Filiale»: si sostituisce il grant generico con quello specifico e
--   non si tocca chi detiene il ruolo. E' il motivo per cui qui si spende un ruolo
--   invece di una scorciatoia sul ruolo condiviso.
--
-- COSA NON FA
--   Non concede nulla oltre `dashboard:view`. Un capo filiale regge un
--   sotto-albero gerarchico e per ADR-0027/I18 potrebbe legittimamente avere di
--   piu' sui propri riporti: non e' stato chiesto, quindi non si presume.
--
-- IDEMPOTENTE + twice-run safe.
-- ============================================================================

BEGIN;

-- 1. Il ruolo. `ON CONFLICT DO NOTHING`: la seconda esecuzione non tocca nulla.
INSERT INTO sys.sys_auth_roles (auth_role_code, auth_role_name, auth_role_description)
VALUES ('BRANCH_MANAGER', 'Responsabile di filiale',
        'Regge una filiale: un sotto-albero gerarchico reale. Distinto dal capo '
        || 'squadra, che guida uno scopo funzionale e non una catena di riporto.')
ON CONFLICT (auth_role_code) DO NOTHING;

-- 2. Il permesso del cruscotto (oggi generico; diventera' specifico per vista).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = 'dashboard:view'
 WHERE r.auth_role_code = 'BRANCH_MANAGER'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 3. Il ruolo a chi REGGE una filiale — derivato dal dato, mai un elenco di nomi.
INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id)
SELECT DISTINCT ou.organization_unit_manager_user_id, r.auth_role_id
  FROM sys.sys_organization_units ou
  JOIN sys.sys_organization_unit_types t
    ON t.organization_unit_type_id = ou.organization_unit_type_id
  JOIN sys.sys_users u ON u.user_id = ou.organization_unit_manager_user_id
 CROSS JOIN sys.sys_auth_roles r
 WHERE ou.organization_unit_is_active
   AND t.organization_unit_type_code = 'BRANCH'
   AND u.user_status = 'ACTIVE'
   AND r.auth_role_code = 'BRANCH_MANAGER'
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_user_auth_roles x
      WHERE x.user_auth_role_user_id = ou.organization_unit_manager_user_id
        AND x.user_auth_role_role_id = r.auth_role_id
        AND x.user_auth_role_revoked_at IS NULL);

-- 4. La traduzione inglese. NON un dettaglio: `sys.v_reference_translation_coverage`
--    e' cablata in una guardia della catena di migrazioni, che si ferma se una
--    riga di catalogo esiste in italiano e non in inglese. Un ruolo nuovo senza
--    traduzione rompe la catena — misurato: la prima stesura di questa migrazione
--    ha fatto fallire `migrate-idempotent` con «Copertura EN: restano 2
--    traduzioni mancanti», che sono esattamente nome e descrizione di qui.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
-- `source='MANUAL'`: il CHECK ammette HARVEST | ESCO | LLM | MANUAL, e queste due
-- righe sono scritte a mano qui, non raccolte da una fonte esterna.
SELECT 'sys_auth_roles', r.auth_role_id, v.field, 'en', v.text, 'MANUAL'
  FROM sys.sys_auth_roles r
 CROSS JOIN (VALUES
   ('name',        'Branch manager'),
   ('description', 'Heads a branch: a real hierarchical sub-tree. Distinct from a team '
                || 'lead, who drives a functional scope rather than a reporting chain.')
 ) AS v(field, text)
 WHERE r.auth_role_code = 'BRANCH_MANAGER'
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_reference_translations x
      WHERE x.entity_table = 'sys_auth_roles' AND x.entity_id = r.auth_role_id
        AND x.field = v.field AND x.locale = 'en');

DO $$
DECLARE
  n_capi int; n_assegnati int; n_squadra_puri int; n_gap int;
BEGIN
  -- Quanti reggono una filiale attiva
  SELECT count(DISTINCT ou.organization_unit_manager_user_id) INTO n_capi
    FROM sys.sys_organization_units ou
    JOIN sys.sys_organization_unit_types t
      ON t.organization_unit_type_id = ou.organization_unit_type_id
    JOIN sys.sys_users u ON u.user_id = ou.organization_unit_manager_user_id
   WHERE ou.organization_unit_is_active AND t.organization_unit_type_code = 'BRANCH'
     AND u.user_status = 'ACTIVE';

  -- Quanti hanno effettivamente il ruolo
  SELECT count(*) INTO n_assegnati
    FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
   WHERE r.auth_role_code = 'BRANCH_MANAGER' AND ur.user_auth_role_revoked_at IS NULL;

  IF n_assegnati < n_capi THEN
    RAISE EXCEPTION 'BRANCH_MANAGER: % capi filiale ma solo % assegnazioni', n_capi, n_assegnati;
  END IF;

  -- LA GUARDIA CHE CONTA: nessuno che guidi SOLO una squadra deve averlo.
  -- Se un giorno qualcuno lo prendesse per errore, questa riga lo ferma — ed e'
  -- la distinzione che la decisione di Enzo protegge.
  SELECT count(*) INTO n_squadra_puri
    FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
    JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
   WHERE r.auth_role_code = 'BRANCH_MANAGER'
     AND ur.user_auth_role_revoked_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_organization_units ou
         JOIN sys.sys_organization_unit_types t
           ON t.organization_unit_type_id = ou.organization_unit_type_id
        WHERE ou.organization_unit_manager_user_id = u.user_id
          AND ou.organization_unit_is_active
          AND t.organization_unit_type_code = 'BRANCH');

  IF n_squadra_puri > 0 THEN
    RAISE EXCEPTION
      '% persone hanno BRANCH_MANAGER senza reggere una filiale: il ruolo segue il fatto, non il nome',
      n_squadra_puri;
  END IF;

  -- La copertura EN dei ruoli deve restare piena: e' cio' che la catena verifica.
  SELECT count(*) INTO n_gap
    FROM sys.sys_auth_roles r
   CROSS JOIN (VALUES ('name'), ('description')) AS f(field)
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_reference_translations x
      WHERE x.entity_table='sys_auth_roles' AND x.entity_id=r.auth_role_id
        AND x.field=f.field AND x.locale='en');
  IF n_gap > 0 THEN
    RAISE EXCEPTION '% campi di ruolo senza traduzione EN: la catena di migrazioni si fermera'' qui', n_gap;
  END IF;

  RAISE NOTICE '000272: BRANCH_MANAGER -> % capi filiale, 0 capi squadra, copertura EN piena', n_assegnati;
END $$;

COMMIT;
