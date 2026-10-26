// O2-09 (ADR-0044 passo 3a): per ogni persona attiva di RTL Bank, l'insieme
// functionalScopeUserIds e il dominio process_owner, sul database indicato da POSTGRES_DB.
// Si lancia da apps/api con il codice di PRIMA e con quello di DOPO; l'uscita (JSON, una riga
// per persona) si confronta con O2-09_confronta.py.
//   POSTGRES_DB=<copia> pnpm exec tsx <questo file> > uscita.jsonl
import { pool, closePool } from "../../../../apps/api/src/db/client.js";
import { functionalScopeUserIds } from "../../../../apps/api/src/lib/scope/functional.js";
import { activeDomainsOf } from "../../../../apps/api/src/lib/scope/domains.js";

const { rows } = await pool.query<{ user_id: string; user_email: string; tenant_id: string }>(
  `SELECT u.user_id, u.user_email, u.user_tenant_id AS tenant_id
     FROM sys.sys_users u JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
    WHERE t.tenant_code = 'RTL_BANK' AND u.user_status = 'ACTIVE'
    ORDER BY u.user_email`,
);
for (const r of rows) {
  const scope = (await functionalScopeUserIds(pool, r.user_id)).sort();
  const domini = await activeDomainsOf(pool, { userId: r.user_id, tenantId: r.tenant_id, roles: [] });
  console.log(JSON.stringify({ id: r.user_id, process_owner: domini.has("process_owner"), scope }));
}
await closePool();
