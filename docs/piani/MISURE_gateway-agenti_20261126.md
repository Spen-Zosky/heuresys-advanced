# Misure sul gateway agenti (26/11/2026, 02:31 UTC)

Sola lettura: `sudo -u postgres psql -p 5432 -d heuresys_advanced`, `BEGIN TRANSACTION READ ONLY` ... `ROLLBACK`. I numeri cambiano: si rimisurano.

| misura | valore |
|---|---|
| `sys.sys_agent_conversations` | 37 conversazioni, 3 persone, dal 10/11 13:14 al 24/11 04:07 UTC; ultimi 30 giorni 37 (3 persone) |
| per tenant | tutte RTL_BANK (37, 3 persone) |
| `sys.sys_agent_activities` | 38 |
| `sys.sys_agent_proposals` | 31 |
| `sys.sys_agent_call_log` | 28 |
| `audit.agent_gateway_decisions` | 0 |
| `sys.sys_agent_requests` per stato | tabella vuota |
| `sys.sys_agent_capabilities` | tabella vuota |
| `sys.v_agent_capability_activations_current` per modo | nessuna riga |
| drop-in `accesso-assistente.conf` | 1 persona nominata (attiva, già in un tenant ammesso) |
| drop-in `accesso-tenant.conf` | 2 tenant: RTL_BANK (167 utenti attivi, 158 STANDARD), HEURESYS (9 attivi, 3 STANDARD) |

Il file di consolidamento `/etc/heuresys/agent-gateway-consolidation.conf` e il token non sono stati letti.
