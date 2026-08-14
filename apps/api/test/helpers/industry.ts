/**
 * apps/api/test/helpers/industry.ts
 * Un codice settore VALIDO, preso dal catalogo vivo.
 *
 * Dalla mig 000305 `sys_tenancies.tenant_industry_code` è NOT NULL + FK verso
 * `sys.sys_industry_codes` (I21): un tenant di prova senza settore non è più
 * inseribile, e uno con un codice inventato cade sulla FK.
 *
 * Il codice NON si scrive a mano nei test: si legge dal catalogo. Se domani una
 * migrazione ritira `FIN_BANKING`, un valore cablato renderebbe rossa mezza suite
 * per una ragione che non c'entra nulla con ciò che quei test verificano.
 */
import { pool } from "../../src/db/client.js";

interface Queryable {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

let cached: string | undefined;

/** Il primo codice attivo del catalogo, in ordine deterministico. */
export async function anIndustryCode(q: Queryable = pool as unknown as Queryable): Promise<string> {
  if (cached) return cached;
  const r = await q.query<{ industry_code: string }>(
    `SELECT industry_code FROM sys.sys_industry_codes
      WHERE industry_is_active = true
      ORDER BY industry_code
      LIMIT 1`,
  );
  const code = r.rows[0]?.industry_code;
  if (!code) {
    throw new Error(
      "sys.sys_industry_codes non ha codici attivi: la 000305 rende il settore " +
        "obbligatorio, quindi senza catalogo nessun tenant è creabile.",
    );
  }
  cached = code;
  return code;
}
