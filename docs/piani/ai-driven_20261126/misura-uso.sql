-- Misura dell'uso degli agenti in produzione (voce M0 del piano docs/piani/PIANO_heuresys-ai-driven_20261126.md).
-- Solo SELECT, in una transazione di sola lettura. Si esegue sulla VM contro heuresys_advanced.
set default_transaction_read_only=on;
select 'conv',count(*),count(distinct agent_conversation_user_id),min(agent_conversation_created_at)::date,max(agent_conversation_created_at)::date from sys.sys_agent_conversations;
select 'conv_ult30',count(*) from sys.sys_agent_conversations where agent_conversation_created_at>now()-interval '30 days';
select 'conv_per_tenant',t.tenant_code,count(*) from sys.sys_agent_conversations c join sys.sys_tenancies t on t.tenant_id=c.agent_conversation_tenant_id group by 2;
select 'attivita',count(*) from sys.sys_agent_activities;
select 'proposte',count(*) from sys.sys_agent_proposals;
select 'richieste',agent_request_status,count(*) from sys.sys_agent_requests group by 2;
select 'calllog',count(*) from sys.sys_agent_call_log;
select 'capacita',agent_capability_code,agent_capability_status,agent_capability_version from sys.sys_agent_capabilities;
select 'attivazioni',agent_capability_activation_mode,count(*) from sys.v_agent_capability_activations_current group by 2;
select 'diario',count(*) from audit.agent_gateway_decisions;
select 'utenti_attivi',count(*) from sys.sys_users;
