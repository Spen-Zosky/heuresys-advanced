/**
 * apps/api/src/lib/equita/tratti.ts — legge i tratti protetti delle persone di una proposta,
 * per il solo controllo di equità (E12, voce F6b). I valori non escono mai dall'API: escono
 * solo i conteggi per gruppo della dichiarazione, con i gruppi piccoli riuniti.
 *
 * Il filtro di tenant è sempre esplicito (I5): una proposta di piattaforma che attraversa più
 * tenant passa `tenantId = null` e legge per le sole persone già nel suo perimetro.
 */
import type { Pool, PoolClient } from "pg";
import type { TrattiPersona } from "./valuta.js";

export type DbConnector = Pool | PoolClient;

export async function leggiTrattiProtetti(
  q: DbConnector,
  tenantId: string | null,
  userIds: readonly string[],
): Promise<Map<string, TrattiPersona>> {
  const ids = [...new Set(userIds)];
  const out = new Map<string, TrattiPersona>();
  if (ids.length === 0) return out;
  const params: unknown[] = [ids];
  let tenantClause = "";
  if (tenantId !== null) {
    params.push(tenantId);
    tenantClause = " AND d.user_demographics_tenant_id = $2";
  }
  const res = await q.query<{ user_id: string; genere: string | null; nascita: string | null; nazionalita: string | null; stato_civile: string | null }>(
    `SELECT d.user_demographics_user_id AS user_id,
            d.user_demographics_gender AS genere,
            to_char(d.user_demographics_birth_date, 'YYYY-MM-DD') AS nascita,
            d.user_demographics_nationality AS nazionalita,
            d.user_demographics_marital_status AS stato_civile
       FROM sys.sys_user_demographics d
      WHERE d.user_demographics_user_id = ANY($1::uuid[])${tenantClause}`,
    params,
  );
  for (const r of res.rows) {
    out.set(r.user_id, { genere: r.genere, nascita: r.nascita, nazionalita: r.nazionalita, statoCivile: r.stato_civile });
  }
  return out;
}
