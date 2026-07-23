/**
 * apps/api/src/lib/result-cap.ts — #62 G3: no silent truncation.
 *
 * Several analytics reads carried an inline `LIMIT 5000`: correct today (the
 * working sets are hundreds of rows) but a future 5001st row would have been
 * dropped SILENTLY, skewing dashboards with no signal. Callers now fetch
 * cap+1 rows and pass through this guard: crossing the cap becomes a loud,
 * actionable 500 instead of quietly wrong numbers (fail-loud doctrine).
 */

export const ANALYTICS_ROW_CAP = 5000;

/** Throws if `rows` exceeds the cap (caller queried cap+1); returns rows unchanged. */
export function guardResultCap<T>(rows: T[], what: string, cap: number = ANALYTICS_ROW_CAP): T[] {
  if (rows.length > cap) {
    throw new Error(
      `RESULT_SET_TRUNCATION: ${what} exceeded the ${cap}-row analytics cap — ` +
        `add pagination/scoping to this read before the result set grows further`,
    );
  }
  return rows;
}
