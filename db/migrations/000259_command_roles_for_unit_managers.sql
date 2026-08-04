-- ═══════════════════════════════════════════════════════════════════════════════
-- 000259_command_roles_for_unit_managers.sql
--
-- I RESPONSABILI DI UNITA' RICEVONO IL RUOLO DI COMANDO CHE LA RICOSTRUZIONE
-- NON HA DATO LORO.
--
-- Il difetto
--   `000247` ha scritto 29 nomine in `organization_unit_manager_user_id` e
--   nient'altro: nessuna delle dieci migrazioni dell'organigramma tocca i ruoli
--   (verificato, zero occorrenze di `sys_user_auth_roles`). Risultato misurato dopo
--   l'applicazione: su 43 unita attive, **30 responsabili non detengono alcun ruolo
--   di comando** e 26 di loro hanno esattamente `TEAM_MEMBER+USER`, cioe' l'insieme
--   di chi non dirige nulla. Prima della ricostruzione erano 4.
--   Le nomine erano state scritte nell'organigramma e non nei permessi.
--
-- IL CRITERIO NON E' QUELLO PROPOSTO, E LA DIFFERENZA E' MISURATA
--   La consegna proponeva di derivare il ruolo dal TIPO di unita
--   (`AREA`/`DIVISION`/`HEADQUARTERS` -> MANAGER, il resto -> TEAM_LEADER) «salvo che
--   il criterio non regga alla verifica su chi il ruolo giusto ce l'ha gia'». Ho fatto
--   quella verifica e **il criterio non regge**: fra le 8 divisioni, sei responsabili
--   hanno `TEAM_LEADER` e tre `MANAGER`; fra le 15 direzioni, tre `MANAGER` e due
--   `TEAM_LEADER`. Il precedente esistente e' incoerente con se stesso — ed e'
--   naturale, visto che e' lo stesso organigramma che era incoerente al 66%.
--   Derivare da li' significherebbe ereditare il disordine.
--
--   Il criterio usato deriva dalla STRUTTURA, che ora e' attendibile:
--     · chi dirige un'unita che ne CONTIENE altre  -> `MANAGER`     (12 casi)
--     · chi dirige un'unita FOGLIA                 -> `TEAM_LEADER` (31 casi)
--   In parole: chi comanda dei responsabili e' MANAGER, chi comanda delle persone
--   e' TEAM_LEADER. Taglia trasversalmente i tipi e li spiega — un'AREA che contiene
--   filiali diventa MANAGER, una filiale diventa TEAM_LEADER, e una divisione senza
--   direzioni sotto sta col secondo gruppo invece che col primo per la ragione giusta.
--
-- CIO' CHE NON FACCIO, E PERCHE'
--   La consegna chiedeva anche di **revocare `TEAM_LEADER` a chi non regge piu'
--   alcuna unita**: oggi un caso solo, `marco.rinaldi`. Verificato prima di eseguire:
--   **guida una squadra attiva**. `TEAM_LEADER` non e' un ruolo del solo asse
--   organizzativo — per ADR-0027 l'asse funzionale (squadre, processi) e' ortogonale
--   a quello gerarchico, e lui un comando ce l'ha, sull'altro asse. Revocarglielo
--   avrebbe tolto un potere legittimo per far tornare a zero una verifica che in quel
--   caso segnala un falso positivo. Non si revoca.
--
-- Chi gia' detiene un ruolo di comando non viene toccato: `NOT EXISTS` sul ruolo.
-- Rieseguibile. Non distruttiva: solo concessioni.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE da_promuovere ON COMMIT DROP AS
SELECT DISTINCT ON (ou.organization_unit_manager_user_id)
       ou.organization_unit_manager_user_id AS persona_id,
       ou.organization_unit_tenant_id       AS tenant_id,
       CASE WHEN EXISTS (SELECT 1 FROM sys.sys_organization_units c
                          WHERE c.organization_unit_parent_id = ou.organization_unit_id
                            AND c.organization_unit_is_active)
            THEN 'MANAGER' ELSE 'TEAM_LEADER' END AS ruolo
  FROM sys.sys_organization_units ou
 WHERE ou.organization_unit_is_active
   AND ou.organization_unit_manager_user_id IS NOT NULL
   -- chi un comando ce l'ha gia', in qualunque forma, resta come sta
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_user_auth_roles ur
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE ur.user_auth_role_user_id = ou.organization_unit_manager_user_id
        AND ur.user_auth_role_revoked_at IS NULL
        AND r.auth_role_code IN ('CEO','MANAGER','TEAM_LEADER','HRMS_MANAGER','PLATFORM_ADMIN','TENANT_ADMIN'))
 -- se una persona regge PIU' unita, vince il grado piu' alto: MANAGER prima
 ORDER BY ou.organization_unit_manager_user_id,
          (CASE WHEN EXISTS (SELECT 1 FROM sys.sys_organization_units c
                              WHERE c.organization_unit_parent_id = ou.organization_unit_id
                                AND c.organization_unit_is_active) THEN 0 ELSE 1 END);

INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id,
                                     user_auth_role_tenant_id, user_auth_role_granted_at)
SELECT d.persona_id, r.auth_role_id, d.tenant_id, now()
  FROM da_promuovere d
  JOIN sys.sys_auth_roles r ON r.auth_role_code = d.ruolo
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_user_auth_roles x
    WHERE x.user_auth_role_user_id = d.persona_id
      AND x.user_auth_role_role_id = r.auth_role_id
      AND x.user_auth_role_revoked_at IS NULL);

-- ───────────────────────────────────────────────────────────────────────────────
-- AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_senza int; n_promossi int; n_mgr int; n_tl int; n_universo int;
BEGIN
  SELECT count(*) INTO n_universo FROM sys.sys_organization_units
   WHERE organization_unit_is_active AND organization_unit_manager_user_id IS NOT NULL;
  IF n_universo = 0 THEN
    RAISE EXCEPTION 'Nessuna unita con responsabile: verifica cieca, qualcosa e piu rotto di cosi';
  END IF;

  -- LA PROVA: nessun responsabile di unita attiva resta senza un ruolo di comando
  SELECT count(*) INTO n_senza FROM sys.sys_organization_units ou
   WHERE ou.organization_unit_is_active AND ou.organization_unit_manager_user_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_user_auth_roles ur
         JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
        WHERE ur.user_auth_role_user_id = ou.organization_unit_manager_user_id
          AND ur.user_auth_role_revoked_at IS NULL
          AND r.auth_role_code IN ('CEO','MANAGER','TEAM_LEADER','HRMS_MANAGER','PLATFORM_ADMIN','TENANT_ADMIN'));
  IF n_senza <> 0 THEN
    RAISE EXCEPTION 'Responsabili di unita ancora senza ruolo di comando: % su %', n_senza, n_universo;
  END IF;

  SELECT count(*) INTO n_promossi FROM da_promuovere;
  SELECT count(*) INTO n_mgr FROM da_promuovere WHERE ruolo = 'MANAGER';
  SELECT count(*) INTO n_tl  FROM da_promuovere WHERE ruolo = 'TEAM_LEADER';

  -- Nessuno riceve DUE ruoli di comando da questa migrazione: sarebbe il segno che il
  -- DISTINCT ON non ha fatto il suo mestiere su chi regge piu di un'unita.
  IF n_promossi <> n_mgr + n_tl THEN
    RAISE EXCEPTION 'Promozioni incoerenti: % totali contro %+%', n_promossi, n_mgr, n_tl;
  END IF;

  RAISE NOTICE 'RUOLI DI COMANDO OK — % responsabili promossi (% MANAGER, % TEAM_LEADER); tutti i % responsabili di unita attive hanno ora un comando riconosciuto dai permessi.',
               n_promossi, n_mgr, n_tl, n_universo;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   python tools/verifica_incrociata.py --famiglia X1
--   atteso: X1a a zero su universo 43. X1b resta 1 (marco.rinaldi) ed e' un FALSO
--   POSITIVO dichiarato: guida una squadra, quindi un comando ce l'ha sull'asse
--   funzionale — la verifica guarda solo quello organizzativo.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   UPDATE sys.sys_user_auth_roles SET user_auth_role_revoked_at = now()
--    WHERE user_auth_role_revoked_at IS NULL
--      AND user_auth_role_granted_at >= '2026-08-04'::date
--      AND user_auth_role_role_id IN (SELECT auth_role_id FROM sys.sys_auth_roles
--                                      WHERE auth_role_code IN ('MANAGER','TEAM_LEADER'));
-- COMMIT;
