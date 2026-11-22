-- @migrate: once
-- ============================================================================================
-- 000510 — L'agente propone due faccette dei processi del tenant: perimetro e partecipazione
--          tecnologica. (ADR-0061 D4 e §6, passo 2b del piano di attuazione §7)
--
-- IL FATTO. Le faccette (000507) le assegna chi ha il potere; l'agente PROPONE e una persona decide.
-- Due delle sette faccette si ricavano dalle attività del processo, senza interpretare nomi:
--   · PERIMETRO dalle unità che eseguono le attività e dal modello di erogazione:
--       un'attività erogata da fuori (ESTERNO) → Interaziendale;
--       altrimenti due o più unità diverse → Interfunzionale; una sola unità → Interno a un'unità.
--   · TECNOLOGIA dalla natura del lavoro delle attività:
--       tutte PERSONA → Manuale; tutte ASSISTITO_AI → Assistita;
--       tutte AUTOMATIZZABILE o AGENTE_SUPERVISIONATO → Automatizzata; nature diverse → Mista.
-- Le altre cinque (finalità, beneficiario, modalità, attivazione, standardizzazione) chiedono di
-- leggere il senso del processo: non si inventano qui, arrivano con un passo proprio.
--
-- CHE COSA SCRIVE. Solo righe nuove in sys.sys_tenant_process_facets, fonte AGENTE, stato PROPOSTA,
-- con il criterio applicato e i numeri che lo giustificano. Per ogni processo attivo con attività
-- e solo per la faccetta che NON ha ancora nessun valore: una decisione di una persona non si tocca,
-- e nemmeno una proposta già fatta.
--
-- PERCHÉ `@migrate: once`. È una proposta, non uno stato da imporre: se una persona la rifiuta
-- svuotando la faccetta, rigirare il file a ogni deploy la riproporrebbe. Su un database nuovo
-- gira comunque (la catena è riproducibile); dove l'impronta coincide si salta.
--
-- GUARDIA. Il vocabolario della 000507 deve esserci (7 valori fra perimetro e tecnologia), o il
-- file si ferma. POST-CONDIZIONE. Nessuna riga di fonte PERSONA cambia; ogni proposta scritta ha un
-- criterio; le proposte stanno solo su processi con attività.
-- ROLLBACK DICHIARATO (elenco esplicito, solo ciò che questo file scrive):
--   DELETE FROM sys.sys_tenant_process_facets
--    WHERE tenant_process_facet_source = 'AGENTE' AND tenant_process_facet_status = 'PROPOSTA'
--      AND tenant_process_facet_facet IN ('PERIMETRO','TECNOLOGIA')
--      AND tenant_process_facet_criterion LIKE 'Proposta dell''agente (000510)%';
-- ============================================================================================

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM sys.sys_process_facet_values
   WHERE process_facet_value_facet IN ('PERIMETRO','TECNOLOGIA');
  IF v <> 7 THEN
    RAISE EXCEPTION '000510: il vocabolario di perimetro e tecnologia ha % valori, attesi 7 (000507)', v;
  END IF;
END $$;

CREATE TEMP TABLE m510_persona ON COMMIT DROP AS
SELECT tenant_process_facet_id, tenant_process_facet_value_code, tenant_process_facet_criterion, tenant_process_facet_status
  FROM sys.sys_tenant_process_facets WHERE tenant_process_facet_source = 'PERSONA';

WITH att AS (
  SELECT p.tenant_process_id AS pid, p.tenant_process_tenant_id AS tid,
         count(*) AS n,
         count(DISTINCT s.tenant_process_step_org_unit_id) AS unita,
         count(*) FILTER (WHERE s.tenant_process_step_delivery_model = 'ESTERNO') AS esterne,
         count(s.tenant_process_step_work_nature) AS con_natura,
         count(*) FILTER (WHERE s.tenant_process_step_work_nature = 'PERSONA') AS persona,
         count(*) FILTER (WHERE s.tenant_process_step_work_nature = 'ASSISTITO_AI') AS assistite,
         count(*) FILTER (WHERE s.tenant_process_step_work_nature IN ('AUTOMATIZZABILE','AGENTE_SUPERVISIONATO')) AS automatiche
    FROM sys.sys_tenant_processes p
    JOIN sys.sys_tenant_process_steps s ON s.tenant_process_step_process_id = p.tenant_process_id
   WHERE p.tenant_process_is_active
   GROUP BY p.tenant_process_id, p.tenant_process_tenant_id
),
proposte AS (
  SELECT tid, pid, 'PERIMETRO'::text AS faccetta,
         CASE WHEN esterne > 0 THEN 'INTERAZIENDALE' WHEN unita >= 2 THEN 'INTERFUNZIONALE' ELSE 'INTERNO_UNITA' END AS valore,
         'Proposta dell''agente (000510): ' ||
         CASE WHEN esterne > 0 THEN esterne || ' attività su ' || n || ' sono erogate da fuori dell''azienda.'
              WHEN unita >= 2 THEN 'le ' || n || ' attività sono eseguite da ' || unita || ' unità diverse.'
              ELSE 'le ' || n || ' attività sono eseguite da una sola unità.' END AS criterio
    FROM att WHERE esterne > 0 OR unita >= 1
  UNION ALL
  SELECT tid, pid, 'TECNOLOGIA',
         CASE WHEN persona = con_natura THEN 'MANUALE' WHEN assistite = con_natura THEN 'ASSISTITA'
              WHEN automatiche = con_natura THEN 'AUTOMATIZZATA' ELSE 'MISTA' END,
         'Proposta dell''agente (000510): su ' || con_natura || ' attività, ' || persona || ' svolte da persone, '
           || assistite || ' assistite, ' || automatiche || ' automatizzabili o svolte da agenti sotto supervisione.'
    FROM att WHERE con_natura > 0
)
INSERT INTO sys.sys_tenant_process_facets
  (tenant_process_facet_tenant_id, tenant_process_facet_process_id, tenant_process_facet_facet,
   tenant_process_facet_value_code, tenant_process_facet_criterion, tenant_process_facet_source, tenant_process_facet_status)
SELECT q.tid, q.pid, q.faccetta, q.valore, q.criterio, 'AGENTE', 'PROPOSTA'
  FROM proposte q
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_tenant_process_facets f
                    WHERE f.tenant_process_facet_process_id = q.pid AND f.tenant_process_facet_facet = q.faccetta)
ON CONFLICT DO NOTHING;

DO $$
DECLARE cambiate int; senza_criterio int; senza_attivita int;
BEGIN
  SELECT count(*) INTO cambiate FROM m510_persona m
    LEFT JOIN sys.sys_tenant_process_facets f ON f.tenant_process_facet_id = m.tenant_process_facet_id
   WHERE f.tenant_process_facet_id IS NULL
      OR (f.tenant_process_facet_value_code, f.tenant_process_facet_criterion, f.tenant_process_facet_status, f.tenant_process_facet_source)
         IS DISTINCT FROM (m.tenant_process_facet_value_code, m.tenant_process_facet_criterion, m.tenant_process_facet_status, 'PERSONA');
  SELECT count(*) INTO senza_criterio FROM sys.sys_tenant_process_facets
   WHERE tenant_process_facet_source = 'AGENTE' AND length(trim(tenant_process_facet_criterion)) = 0;
  SELECT count(*) INTO senza_attivita FROM sys.sys_tenant_process_facets f
   WHERE f.tenant_process_facet_criterion LIKE 'Proposta dell''agente (000510)%'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_tenant_process_steps s WHERE s.tenant_process_step_process_id = f.tenant_process_facet_process_id);
  IF cambiate <> 0 OR senza_criterio <> 0 OR senza_attivita <> 0 THEN
    RAISE EXCEPTION '000510: decisioni di persone cambiate=%, proposte senza criterio=%, proposte su processi senza attività=%',
      cambiate, senza_criterio, senza_attivita;
  END IF;
END $$;
