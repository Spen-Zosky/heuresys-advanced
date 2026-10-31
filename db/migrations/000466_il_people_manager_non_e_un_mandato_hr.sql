-- ============================================================================================
-- 000466 — PEOPLE_MANAGER non è un mandato HR tenant-wide (correzione di sicurezza D-01, 2026-10-31).
--
-- IL PERCHE'. L'analisi delle interfacce del 2026-10-31 ha misurato in produzione che PEOPLE_MANAGER
-- leggeva retribuzioni e valutazioni di tutto RTL in chiaro, con risposte identiche a TENANT_ADMIN.
-- La causa stava nel codice (apps/api/src/lib/scope/resolver.ts, HR_MANDATED_ROLES), dove il mandato K
-- R-6 lo aveva messo come conseguenza applicata senza chiedere. I20 nomina come mandati HR solo
-- TENANT_ADMIN e HRMS_MANAGER. La correzione è nel codice, nello stesso incremento; qui si allinea la
-- DESCRIZIONE del ruolo, che la 000432 scriveva «Mandato HR tenant-wide» e che le pagine dei ruoli
-- mostrano: una descrizione che promette un perimetro che il codice non dà più è un difetto anch'essa.
--
-- COSA FA. Riscrive auth_role_description di PEOPLE_MANAGER. Nessun permesso cambia: i permessi dicono
-- COSA, l'asse organizzativo dice SU CHI (ADR-0036), ed è solo il secondo a cambiare.
-- La 000432 non va emendata: il suo ON CONFLICT non tocca la descrizione, quindi non la riporta indietro.
--
-- IDEMPOTENTE: la seconda corsa trova il testo già scritto e non cambia niente. NESSUNA CANCELLAZIONE.
-- POST-CONDIZIONE: il numero di permessi attivi di PEOPLE_MANAGER non cambia.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE _pm_permessi_prima_000466 AS
SELECT count(*) AS n
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
 WHERE r.auth_role_code = 'PEOPLE_MANAGER' AND rp.revoked_at IS NULL;

UPDATE sys.sys_auth_roles
   SET auth_role_description =
       'Gestione operativa delle persone: scrittura sulle tabelle NATIVE/IBRIDE della classificazione X-1 '
       '(obiettivi, competenze, formazione, carriera, engagement, KPI, posizioni, organigramma...) + lettura '
       'sulle tabelle IMPORTATE dal legacy. Perimetro organizzativo: se stesso e la catena che dirige; '
       'NON è un mandato HR tenant-wide (I20: solo TENANT_ADMIN e HRMS_MANAGER; correzione D-01 del '
       '2026-10-31). Non concede ruoli, non tocca GDPR/avviamento/recruiting/tassonomia/whistleblowing. '
       'Nato mandato K, R-6, 2026-09-19.'
 WHERE auth_role_code = 'PEOPLE_MANAGER'
   AND auth_role_description IS DISTINCT FROM
       'Gestione operativa delle persone: scrittura sulle tabelle NATIVE/IBRIDE della classificazione X-1 '
       '(obiettivi, competenze, formazione, carriera, engagement, KPI, posizioni, organigramma...) + lettura '
       'sulle tabelle IMPORTATE dal legacy. Perimetro organizzativo: se stesso e la catena che dirige; '
       'NON è un mandato HR tenant-wide (I20: solo TENANT_ADMIN e HRMS_MANAGER; correzione D-01 del '
       '2026-10-31). Non concede ruoli, non tocca GDPR/avviamento/recruiting/tassonomia/whistleblowing. '
       'Nato mandato K, R-6, 2026-09-19.';

DO $post$
DECLARE
  v_prima bigint;
  v_dopo  bigint;
BEGIN
  SELECT n INTO v_prima FROM _pm_permessi_prima_000466;
  SELECT count(*) INTO v_dopo
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE r.auth_role_code = 'PEOPLE_MANAGER' AND rp.revoked_at IS NULL;
  IF v_dopo IS DISTINCT FROM v_prima THEN
    RAISE EXCEPTION '000466: i permessi di PEOPLE_MANAGER sono cambiati (% -> %): questa migrazione non deve toccarli', v_prima, v_dopo;
  END IF;
  RAISE NOTICE '000466 done: descrizione di PEOPLE_MANAGER allineata, permessi invariati (%)', v_dopo;
END $post$;

COMMIT;

DROP TABLE IF EXISTS _pm_permessi_prima_000466;
