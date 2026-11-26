-- ============================================================================================
-- 000513 — Un solo giro aperto per conversazione dell'assistente (ADR-0056 D4, correzione di T6).
--
-- IL DIFETTO. Il gateway controllava che la conversazione non avesse un giro aperto leggendo lo
-- stato prima di aprirne uno nuovo (apps/agent-gateway/src/conversazione.ts). Due richieste che
-- arrivano nello stesso istante leggono entrambe «libera» e aprono due giri sulla stessa sessione
-- dell'SDK, che la scrivono in due rami (nota della PR #204). Il controllo vero lo tiene il database:
-- un indice unico parziale ammette al più un'attività IN_CORSO o IN_ATTESA per conversazione, e la
-- seconda apertura riceve un rifiuto (23505) che l'API traduce in 409 AGENT_CONVERSATION_BUSY.
--
-- PRIMA DELL'INDICE. Un'attività rimasta aperta oltre AGENT_ACTIVITY_STALE_MINUTES (30, in
-- packages/shared/src/schemas/agent-conversations.ts) l'API la legge già INTERROTTA, ma la riga resta
-- IN_CORSO e occuperebbe l'indice per sempre. Qui la si chiude come la si legge. Se in una
-- conversazione restano più attività aperte recenti, si tiene la più nuova e le altre si chiudono.
-- Da qui in poi è l'API a chiudere le attività scadute prima di aprirne una nuova (repository.ts).
--
-- MISURA PRIMA E DOPO, POST-CONDIZIONE. Il file conta le attività chiuse e si ferma se dopo la
-- pulizia una conversazione ha ancora più di un'attività aperta. Nessuna attività già chiusa cambia.
-- ROLLBACK DICHIARATO. DROP INDEX IF EXISTS sys.sys_agent_activities_una_aperta_uq; le righe chiuse
-- qui non hanno un giornale perché il loro stato scritto diventa quello che l'API già ne leggeva
-- (INTERROTTA): nessuna informazione si perde, il prompt e il risultato restano.
-- ============================================================================================

DO $$
DECLARE
  n_scadute int;
  n_doppie  int;
  n_residue int;
BEGIN
  UPDATE sys.sys_agent_activities
     SET agent_activity_status = 'INTERROTTA', agent_activity_ended_at = now()
   WHERE agent_activity_status IN ('IN_CORSO', 'IN_ATTESA')
     AND agent_activity_started_at < now() - interval '30 minutes';
  GET DIAGNOSTICS n_scadute = ROW_COUNT;

  WITH ordinate AS (
    SELECT agent_activity_id,
           row_number() OVER (PARTITION BY agent_activity_conversation_id
                              ORDER BY agent_activity_started_at DESC, agent_activity_id DESC) AS n
      FROM sys.sys_agent_activities
     WHERE agent_activity_status IN ('IN_CORSO', 'IN_ATTESA'))
  UPDATE sys.sys_agent_activities a
     SET agent_activity_status = 'INTERROTTA', agent_activity_ended_at = now()
    FROM ordinate o
   WHERE o.agent_activity_id = a.agent_activity_id AND o.n > 1;
  GET DIAGNOSTICS n_doppie = ROW_COUNT;

  SELECT count(*) INTO n_residue FROM (
    SELECT 1 FROM sys.sys_agent_activities
     WHERE agent_activity_status IN ('IN_CORSO', 'IN_ATTESA')
     GROUP BY agent_activity_conversation_id HAVING count(*) > 1) d;
  IF n_residue > 0 THEN
    RAISE EXCEPTION '000513: % conversazioni hanno ancora più di un giro aperto', n_residue;
  END IF;
  RAISE NOTICE '000513: chiuse % attività scadute e % doppie', n_scadute, n_doppie;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_agent_activities_una_aperta_uq
  ON sys.sys_agent_activities (agent_activity_conversation_id)
  WHERE agent_activity_status IN ('IN_CORSO', 'IN_ATTESA');
