-- ============================================================================
-- 000271 — Il cruscotto dichiara il permesso che serve per aprirlo.
--
-- CHE COSA E' SUCCESSO
--   Lo smoke E2E delle cinque persone e' rosso su una riga sola: «un utente
--   semplice NON deve vedere il link Cruscotto», e invece lo vede.
--
--   Misurato, non supposto: `tommaso.fiore@rtl-bank.org` ha TEAM_LEADER +
--   TEAM_MEMBER + USER, e NESSUNO dei tre concede `dashboard:view` (lo
--   detengono BLUEPRINT_MANAGER, HRMS_MANAGER, MANAGER, PLATFORM_ADMIN,
--   PROCESS_OWNER, TENANT_ADMIN). Il menu gli offriva una pagina che il
--   sistema gli nega.
--
-- PERCHE' ACCADEVA
--   Il filtro di `/v1/me/interfaces` (modules/me/service.ts) e' gia' corretto e
--   fa due cose in quest'ordine: se la voce DICHIARA una coppia risorsa+azione,
--   esige quel permesso; poi, se la voce e' riservata, esige un ruolo di classe
--   admin. Su 52 voci attive, 38 sono riservate e 37 dichiarano la loro coppia.
--   `dashboard` era l'UNICA riservata a non dichiararla: senza permesso da
--   valutare il filtro ricadeva sul solo controllo di classe, e `tommaso` lo
--   supera perche' guida una squadra.
--
--   E' la stessa malattia gia' corretta altrove in S1044 — decidere da
--   un'etichetta generica invece che dalla proprieta' che conta. L'ATTERRAGGIO
--   dopo il login era stato riportato al permesso; la VOCE DI MENU no.
--
-- CHE COSA FA QUESTA MIGRAZIONE
--   Scrive sulla riga `dashboard` la coppia che gia' governa la pagina:
--   `dashboard` + `view`. Nessun permesso cambia di mano, nessun ruolo viene
--   toccato: cambia che ora la voce dice di cosa ha bisogno, e il filtro che
--   esiste gia' puo' finalmente applicarla.
--
--   Effetto atteso: chi ha `dashboard:view` continua a vedere il Cruscotto
--   esattamente come prima; chi non ce l'ha smette di vederselo offrire.
--
-- PERCHE' NON SI TOCCA IL TEST
--   L'asserzione E2E misurava una proprieta' vera («il menu non offre cio' che
--   e' negato») e ha trovato un difetto reale. Adeguarla avrebbe spento
--   l'unica sentinella che se ne era accorta.
--
-- IDEMPOTENTE + twice-run safe (UPDATE su valori finali, guardia che verifica).
-- ============================================================================

BEGIN;

UPDATE sys.sys_ui_interfaces
   SET ui_interface_required_resource = 'dashboard',
       ui_interface_required_action   = 'view',
       updated_at                     = now()
 WHERE ui_interface_code = 'dashboard'
   AND (ui_interface_required_resource IS DISTINCT FROM 'dashboard'
     OR ui_interface_required_action   IS DISTINCT FROM 'view');

DO $$
DECLARE
  n_muti int;
  n_perm int;
BEGIN
  -- 1. Il permesso dichiarato deve ESISTERE, altrimenti la voce sparirebbe per
  --    tutti: una coppia che non corrisponde a nulla non e' mai soddisfatta.
  SELECT count(*) INTO n_perm
    FROM sys.sys_auth_permissions
   WHERE auth_permission_code = 'dashboard:view';
  IF n_perm <> 1 THEN
    RAISE EXCEPTION 'atteso 1 permesso dashboard:view, trovati %', n_perm;
  END IF;

  -- 2. Nessuna voce riservata deve piu' restare senza permesso dichiarato:
  --    e' la condizione che ha prodotto il difetto, e vale per la RIGA intera,
  --    non solo per la cella corretta.
  SELECT count(*) INTO n_muti
    FROM sys.sys_ui_interfaces
   WHERE ui_interface_is_active
     AND ui_interface_requires_admin
     AND (ui_interface_required_resource IS NULL
       OR ui_interface_required_action IS NULL);
  IF n_muti <> 0 THEN
    RAISE EXCEPTION
      '% voci riservate non dichiarano il permesso che le governa: il menu puo'' offrire pagine negate',
      n_muti;
  END IF;

  RAISE NOTICE '000271: il cruscotto dichiara dashboard:view — 0 voci riservate mute';
END $$;

COMMIT;
