/**
 * F3c — «persona in forza» (lib/scope/persone.ts): un ex dipendente resta nel tenant con la
 * sua storia, ma non entra nell'organico di oggi. Tre persone di prova dentro la transazione
 * del file (rollback a fine file): una uscita con l'utenza disattivata, una con la cessazione
 * già arrivata, una con la cessazione fra un mese. Le prime due escono dal conteggio, la terza resta.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { personaInForza, soloPersone } from "../src/lib/scope/persone.js";

let tenantId = "";
const conta = async (predicato: string): Promise<number> => {
  const r = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM sys.sys_users u WHERE u.user_tenant_id = $1 AND ${predicato}`,
    [tenantId],
  );
  return r.rows[0]?.n ?? -1;
};

async function persona(email: string, stato: string, cessazione: string | null): Promise<void> {
  const u = await pool.query<{ user_id: string }>(
    `INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name, user_status, user_type)
     VALUES ($1, $2, $2, $3, 'STANDARD') RETURNING user_id`,
    [tenantId, email, stato],
  );
  await pool.query(
    `INSERT INTO sys.sys_user_employment
       (user_employment_user_id, user_employment_tenant_id, user_employment_hire_date,
        user_employment_termination_date, user_employment_status)
     VALUES ($1, $2, DATE '2015-01-01', $3::date, $4)`,
    [u.rows[0]!.user_id, tenantId, cessazione, cessazione === null ? "ACTIVE" : "TERMINATED"],
  );
}

beforeAll(async () => {
  const t = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`);
  if (!t.rows[0]) throw new Error("il tenant RTL_BANK non c'è: il caso da provare non c'è");
  tenantId = t.rows[0].tenant_id;
});

describe("persona in forza", () => {
  it("toglie gli usciti dall'organico di oggi e li lascia nella storia", async () => {
    const primaInForza = await conta(personaInForza("u"));
    const primaPersone = await conta(soloPersone("u"));
    await persona("uscita.disattivata@prova-inforza.invalid", "DEACTIVATED", "2025-06-30");
    await persona("uscita.cessata@prova-inforza.invalid", "ACTIVE", "2026-01-31");
    await persona("in.preavviso@prova-inforza.invalid", "ACTIVE", null);
    await pool.query(
      `UPDATE sys.sys_user_employment SET user_employment_termination_date = current_date + 30
        WHERE user_employment_user_id = (SELECT user_id FROM sys.sys_users
                                          WHERE user_tenant_id = $1 AND user_email = 'in.preavviso@prova-inforza.invalid')`,
      [tenantId],
    );
    expect(await conta(soloPersone("u"))).toBe(primaPersone + 3);
    expect(await conta(personaInForza("u"))).toBe(primaInForza + 1);
  });
});
