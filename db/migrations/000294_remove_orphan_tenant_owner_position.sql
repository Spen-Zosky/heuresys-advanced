-- ═══════════════════════════════════════════════════════════════════════════════
-- 000294_remove_orphan_tenant_owner_position.sql
--
-- #139 — VIA L'ULTIMO PEZZO DEL RESIDUO: LA POSIZIONE CHE NON HA PIÙ NESSUNO.
--
-- LA DECISIONE (Enzo, 2026-08-08): «sì, la posizione POS-e1000001 va rimossa».
--
-- CHE COS'È. `POS-e1000001 «Tenant Owner»` era la posizione occupata da
-- `platform.admin@heuresys.com`, l'account sintetico rimosso dalla `000286`. Il codice
-- della posizione è lo stesso `e1000001` del codice legacy falso che quell'account
-- portava: **sono lo stesso residuo**, e allora fu rimosso solo l'account perché una
-- posizione è un oggetto dell'organigramma e la sua rimozione è una decisione a sé.
--
-- STATO MISURATO PRIMA DI TOCCARLA: **inattiva**, **nessun capo**, **nessun riporto**,
-- **nessun titolare**, e **zero righe** che la referenzino in tutto il database
-- (verificato scorrendo ogni chiave esterna che punta a `sys_positions`, non solo le
-- assegnazioni). È un nodo staccato dall'albero.
--
-- PERCHÉ QUESTA CANCELLAZIONE È DUREVOLE (ADR-0035). La regola dice di controllare chi
-- crea l'oggetto prima di cancellarlo a valle. Controllato: **nessuna migrazione la
-- crea**. La `000048` la nomina, ma in un elenco che **aggiorna il titolo** di posizioni
-- già esistenti — se la posizione non c'è, non combacia con niente e non la ricrea. La
-- posizione nasceva dai seed della ricostruzione RTL, **ritirati** (`#164` F1,
-- `db/seeds/rtl-rebuild/RETIRED.md`), che non fanno parte della catena. La seconda
-- passata della prova generale è la verifica, non questa nota.
--
-- Idempotente. Guardia: si rimuove **solo** se è ancora orfana — se qualcuno l'avesse
-- riattivata o le avesse dato un titolare, il presupposto non varrebbe più.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  c_code constant text := 'POS-e1000001';
  v_id    uuid;
  v_att   boolean;
  v_tit   bigint;
  v_rip   bigint;
  v_prima bigint;
  v_dopo  bigint;
  v_fatto boolean;
BEGIN
  SELECT position_id, position_is_active INTO v_id, v_att
    FROM sys.sys_positions WHERE position_code = c_code;

  SELECT count(*) INTO v_prima FROM sys.sys_positions WHERE position_is_active;

  IF v_id IS NULL THEN
    v_fatto := false;
  ELSE
    v_fatto := true;
    SELECT count(*) INTO v_tit FROM sys.sys_user_position_assignments
     WHERE user_position_assignment_position_id = v_id;
    SELECT count(*) INTO v_rip FROM sys.sys_positions
     WHERE position_reports_to_position_id = v_id;

    -- GUARDIA: orfana vuol dire tutte e tre le cose insieme, verificate ADESSO.
    -- Una sola di esse sarebbe un test che passa per caso.
    IF v_att THEN
      RAISE EXCEPTION '000294: % risulta ATTIVA — qualcuno l ha riattivata, non la rimuovo', c_code;
    END IF;
    IF v_tit > 0 THEN
      RAISE EXCEPTION '000294: % ha % titolari — non e piu orfana', c_code, v_tit;
    END IF;
    IF v_rip > 0 THEN
      RAISE EXCEPTION '000294: % ha % riporti — rimuoverla staccherebbe un ramo', c_code, v_rip;
    END IF;

    DELETE FROM sys.sys_positions WHERE position_id = v_id;
  END IF;

  -- POST-CONDIZIONE 1 — non c'e' piu'.
  IF EXISTS (SELECT 1 FROM sys.sys_positions WHERE position_code = c_code) THEN
    RAISE EXCEPTION '000294: % e ancora li', c_code;
  END IF;

  -- POST-CONDIZIONE 2 — e' la verifica che conta: le posizioni ATTIVE non sono cambiate.
  -- La posizione rimossa era inattiva, quindi il conteggio delle attive deve essere
  -- identico a prima. Se calasse, avremmo colpito oltre il bersaglio.
  SELECT count(*) INTO v_dopo FROM sys.sys_positions WHERE position_is_active;
  IF v_dopo <> v_prima THEN
    RAISE EXCEPTION '000294: le posizioni attive erano % e ora sono % — colpito oltre il bersaglio', v_prima, v_dopo;
  END IF;

  -- Il messaggio dice cosa e' successo DAVVERO. La prima stesura diceva «rimossa» anche
  -- alla seconda passata, quando non aveva rimosso niente: un rendiconto che afferma
  -- un'azione mai compiuta e' la stessa specie di difetto che questa migrazione ripara.
  IF v_fatto THEN
    RAISE NOTICE '000294 done: % rimossa; posizioni attive invariate (%)', c_code, v_dopo;
  ELSE
    RAISE NOTICE '000294 done: % non c''era gia piu, nessuna modifica; posizioni attive (%)', c_code, v_dopo;
  END IF;
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — non esiste: e' una riga cancellata, senza giornale. Era pero' un nodo
-- staccato (inattiva, senza capo, senza riporti, senza titolari, zero riferimenti),
-- quindi ricrearla non restituirebbe nulla a nessuno. La rete resta l'istantanea
-- pg_dump pre-deploy.
-- ═══════════════════════════════════════════════════════════════════════════════
