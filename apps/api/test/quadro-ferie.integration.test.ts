/**
 * Il quadro dice quante ferie e permessi restano: non conta la malattia (verifica dal vivo del 16/11:
 * «Hai 194 giorni di ferie e permessi da godere», perché il saldo SICK vale 175 giorni l'anno).
 * L'atteso si rifà dal database, sulla persona con più tipi di saldo nell'anno.
 */
import { afterAll, describe, expect, it } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { LENTI } from "../src/modules/quadro/lenti.js";

afterAll(async () => {
  await closePool();
});

describe("quadro: ferie e permessi senza la malattia", () => {
  it("mie-ferie somma solo VACATION e PERSONAL dell'anno in corso", async () => {
    const lente = LENTI.find((l) => l.chiave === "mie-ferie")!;
    const chi = await pool.query<{ u: string; tot: string; senza: string }>(
      `SELECT b.balance_subject_user_id AS u,
              sum(coalesce(b.balance_total_days,0) + coalesce(b.balance_carryover_days,0)
                  + coalesce(b.balance_adjustment_days,0) - coalesce(b.balance_used_days,0))::int::text AS tot,
              (sum(coalesce(b.balance_total_days,0) + coalesce(b.balance_carryover_days,0)
                  + coalesce(b.balance_adjustment_days,0) - coalesce(b.balance_used_days,0))
                 FILTER (WHERE b.balance_leave_type IN ('VACATION','PERSONAL')))::int::text AS senza
         FROM sys.sys_time_off_balances b
        WHERE b.balance_year = extract(year FROM current_date)::int
        GROUP BY 1 HAVING bool_or(b.balance_leave_type = 'SICK') AND bool_or(b.balance_leave_type = 'VACATION')
        ORDER BY 2 DESC LIMIT 1`,
    );
    if (chi.rows.length === 0) return; // database senza saldi dell'anno: niente da provare
    const r = chi.rows[0]!;
    const v = await pool.query<{ valore: number }>(lente.sql, [[r.u]]);
    expect(Number(v.rows[0]!.valore)).toBe(Number(r.senza));
    expect(Number(v.rows[0]!.valore)).toBeLessThan(Number(r.tot));
  });
});
