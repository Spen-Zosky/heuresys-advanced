-- ═══════════════════════════════════════════════════════════════════════════════
-- 000293_remove_brownfield_menu_entry.sql
--
-- #164 FASE 3 — VIA LA VOCE DI MENU CHE NON PORTA PIÙ DA NESSUNA PARTE.
--
-- Nello stesso commit sono stati rimossi 4 moduli API, 4 schemi condivisi, la pagina
-- web `/brownfield-adaptation`, 12 file di test e il flag d'ambiente. La voce di menu
-- resterebbe puntata su una pagina che non esiste.
--
-- MISURATO SUL SISTEMA VIVO PRIMA DI RIMUOVERE. Le 4 superfici ETL erano **già dark in
-- produzione**: su `www.heuresys.com`, `/v1/brownfield-import-runs` risponde **404**
-- mentre `/v1/users` risponde **401**. La differenza fra i due codici è la prova che le
-- prime non erano registrate e le seconde sì. Il ritiro porta via un'insegna spenta.
--
-- PERCHÉ QUESTA CANCELLAZIONE È DUREVOLE, E LA PRIMA STESURA NON LO ERA.
-- La riga la creava `000050_sys_ui_interfaces_registry.sql`, e **la catena si ri-applica
-- per intero a ogni deploy**: una DELETE a valle sarebbe stata disfatta al giro
-- successivo. La prova generale l'ha mostrato andando rossa **alla seconda passata** —
-- che è precisamente il difetto per cui quella seconda passata esiste. Quindi la riga è
-- stata tolta **dalla fonte** (`000050`, emendata nello stesso commit) e qui si rimuove
-- l'esemplare già presente nei database esistenti. Le due cose insieme sono un ritiro;
-- una sola delle due è un'oscillazione.
--
-- COSA RESTA, DICHIARATO E NON DIMENTICATO. I tre permessi
-- `brownfield_adaptation:read|trigger|approve` restano nel catalogo, e `TENANT_ADMIN` li
-- ha ancora in allowlist. Sono **inerti** — nessuna rotta li richiede più — ma per
-- toglierli davvero servirebbe emendare `000005_auth_foundation.sql` (che li definisce),
-- `000210` (che li concede) e le traduzioni inglesi che vi si appoggiano: cinque file
-- della fondazione auth. È un lavoro a sé, registrato in `#164`, non da improvvisare in
-- coda a un altro.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  v_voci bigint;
  v_lin  bigint;
BEGIN
  DELETE FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'brownfield' OR ui_interface_route = '/brownfield-adaptation';
  GET DIAGNOSTICS v_voci = ROW_COUNT;

  IF EXISTS (SELECT 1 FROM sys.sys_ui_interfaces
              WHERE ui_interface_code = 'brownfield' OR ui_interface_route = '/brownfield-adaptation') THEN
    RAISE EXCEPTION '000293: la voce di menu brownfield e ancora li';
  END IF;

  -- La verifica che conta davvero: il ritiro dello strumento non deve aver toccato la
  -- risposta a «questo dato da dove viene?». ADR-0023 resta in vigore.
  SELECT count(*) INTO v_lin FROM sys.sys_source_lineage_records;
  IF v_lin < 70000 THEN
    RAISE EXCEPTION '000293: la tracciabilita e scesa a % righe — il ritiro ha toccato cio che non doveva', v_lin;
  END IF;

  RAISE NOTICE '000293 done: % voce/i di menu rimosse; tracciabilita intatta (% righe)', v_voci, v_lin;
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — per tornare indietro si ripristina il COMMIT, non la riga: rimetterla
-- senza la pagina ricrea una voce di menu verso un 404.
-- ═══════════════════════════════════════════════════════════════════════════════
