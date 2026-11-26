-- 000518 — ADR-0063 D4, piano «Heuresys AI-driven» voce F0b: il modo LIBERA resta spento.
--
-- IL FATTO. ADR-0053 ha dato agli agenti un modo `LIBERA` (una capacità pubblicata, per un tenant,
-- scrive senza ponte di approvazione); 000480 ne ha fatto il registro e il cancello del gateway lo
-- legge a ogni scrittura (`apps/agent-gateway/src/capacita.ts`). Il 2026-11-26 Enzo ha deciso
-- (ADR-0063 D4, decisione E3): «niente passa senza conferma». Il meccanismo resta nel codice e nelle
-- prove, ma nessuna capacità si attiva in modo `LIBERA` per nessun tenant finché Enzo non lo decide
-- con una decisione nuova.
--
-- CHE COSA FA, in tre strati che non si fidano l'uno dell'altro:
--   ① qui, nel database: un'attivazione `LIBERA` nuova è rifiutata. Una sola eccezione, per le prove
--      del meccanismo (`db/scripts/agenti/prova-000480.sql`): il database si dichiara di collaudo dal
--      nome E la sessione lo chiede con `SET LOCAL heuresys.prova_libera = 'on'`. Sul database di
--      produzione (`heuresys_advanced`) l'eccezione non si apre mai, nemmeno con la richiesta;
--   ② qui, una volta sola per ogni riga: un'attivazione `LIBERA` oggi in vigore (se ce n'è) viene
--      sostituita da una `CONFERMA` automatica. Il registro accetta solo aggiunte (000480), quindi
--      la riga di prima resta e si legge; la storia non si riscrive;
--   ③ nell'API (`agent-capabilities/service.ts`) e nel cancello del gateway (`write-gate.ts`): la
--      richiesta `LIBERA` risponde `AGENT_CAPABILITY_LIBERA_SPENTA`, e una capacità che il registro
--      dichiarasse libera torna comunque davanti alla persona.
--
-- PER RIACCENDERE serve una decisione nuova di Enzo e una migrazione nuova che tolga il grilletto
-- (e il comando corrispondente nel cancello): non c'è un interruttore d'ambiente da girare.
--
-- RITORNO. Il passo ② non cancella e non modifica niente: aggiunge righe `CONFERMA` che sostituiscono
-- quelle `LIBERA`, che restano nel registro. Tornare indietro vuol dire una decisione nuova di Enzo
-- (vedi sopra), non un giornale di ritorno: per questo `staging.*_undo` qui non c'è.
--
-- Idempotente: la funzione si sostituisce, il grilletto si ricrea, il passo ② non trova niente da
-- fare la seconda volta (la vista del modo in vigore dice già `CONFERMA`).

CREATE OR REPLACE FUNCTION sys.f_agent_capability_libera_spenta() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.agent_capability_activation_mode = 'LIBERA' THEN
    IF current_database() <> 'heuresys_advanced'
       AND current_database() ~ '(ci|prova|rehearsal|copia)'
       AND coalesce(current_setting('heuresys.prova_libera', true), '') = 'on' THEN
      RETURN NEW; -- solo le prove del meccanismo, su una copia che si dichiara tale
    END IF;
    RAISE EXCEPTION 'sys_agent_capability_activations: il modo LIBERA è spento (ADR-0063 D4); ogni scrittura dell''agente passa dalla conferma della persona'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_agent_capability_libera_spenta ON sys.sys_agent_capability_activations;
CREATE TRIGGER trg_agent_capability_libera_spenta
  BEFORE INSERT ON sys.sys_agent_capability_activations
  FOR EACH ROW EXECUTE FUNCTION sys.f_agent_capability_libera_spenta();

COMMENT ON FUNCTION sys.f_agent_capability_libera_spenta() IS
  '000518 (ADR-0063 D4) — rifiuta ogni attivazione LIBERA. Eccezione solo per le prove del meccanismo: database di collaudo dal nome e SET LOCAL heuresys.prova_libera = on; mai su heuresys_advanced.';

-- ② ciò che fosse già libero torna a CONFERMA, con una riga nuova che sostituisce la vecchia.
DO $spegni$
DECLARE
  v_n int;
BEGIN
  INSERT INTO sys.sys_agent_capability_activations
         (agent_capability_activation_tenant_id, agent_capability_activation_capability_id,
          agent_capability_activation_mode, agent_capability_activation_source,
          agent_capability_activation_reason, agent_capability_activation_supersedes_id)
  SELECT v.agent_capability_activation_tenant_id, v.agent_capability_activation_capability_id,
         'CONFERMA', 'AUTOMATICO',
         'ADR-0063 D4: il modo LIBERA resta spento finché Enzo non decide altro (migrazione 000518)',
         v.agent_capability_activation_id
    FROM sys.v_agent_capability_activations_current v
   WHERE v.agent_capability_activation_mode = 'LIBERA';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '000518: attivazioni LIBERA riportate a CONFERMA: %', v_n;
END $spegni$;

-- La sentinella: deve restare a zero righe.
CREATE OR REPLACE VIEW sys.v_agent_capability_libera_in_vigore AS
SELECT v.agent_capability_activation_id,
       v.agent_capability_activation_tenant_id,
       v.agent_capability_code,
       v.agent_capability_version,
       v.agent_capability_activation_decided_at
  FROM sys.v_agent_capability_activations_current v
 WHERE v.agent_capability_activation_mode = 'LIBERA';

COMMENT ON VIEW sys.v_agent_capability_libera_in_vigore IS
  '000518 (ADR-0063 D4) — sentinella: le capacità oggi in modo LIBERA. Deve restare vuota finché Enzo non decide altro.';
