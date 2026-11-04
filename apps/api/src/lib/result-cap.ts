/**
 * apps/api/src/lib/result-cap.ts — #62 G3: no silent truncation.
 *
 * Several analytics reads carried an inline `LIMIT 5000`: correct today (the
 * working sets are hundreds of rows) but a future 5001st row would have been
 * dropped SILENTLY, skewing dashboards with no signal. Callers now fetch
 * cap+1 rows and pass through this guard: crossing the cap becomes a loud,
 * actionable error instead of quietly wrong numbers (fail-loud doctrine).
 *
 * S-13 del piano interfacce (2026-11-04): l'errore era un 500 anonimo, «Unexpected
 * server error», che non diceva a nessuno che cosa fare. Ora e' un 422 con il codice
 * `RESULT_LIMIT_EXCEEDED` e, nei dettagli, il tetto e il suggerimento: restringere con
 * un filtro (unita', periodo) o paginare. Il testo conserva `RESULT_SET_TRUNCATION`,
 * che i log e le prove cercano gia'.
 */

import { UnprocessableEntityError } from "../errors/index.js";

export const ANALYTICS_ROW_CAP = 5000;

/** Throws if `rows` exceeds the cap (caller queried cap+1); returns rows unchanged. */
export function guardResultCap<T>(rows: T[], what: string, cap: number = ANALYTICS_ROW_CAP): T[] {
  if (rows.length > cap) {
    throw new UnprocessableEntityError(
      { cap, what, hint: "narrow the request with a filter (unit, period) or paginate" },
      `RESULT_SET_TRUNCATION: ${what} exceeded the ${cap}-row analytics cap — ` +
        `add pagination/scoping to this read before the result set grows further`,
      "RESULT_LIMIT_EXCEEDED",
    );
  }
  return rows;
}
