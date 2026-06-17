/**
 * packages/shared/src/schemas/_pagination.ts
 * Shared pagination field factory (B5). ~65 list-query schemas duplicated the
 * same `{ limit, offset }` coerced-number pair, differing only in the limit cap
 * (200 / 500 / 1000) and its default (50 / 100 / 200). This factory produces that
 * exact pair so each schema declares its cap once and spreads the fields in.
 *
 * The produced shapes are byte-for-byte equivalent to the previous inline
 * definitions:
 *   limit:  z.coerce.number().int().min(1).max(maxLimit).optional().default(defaultLimit)
 *   offset: z.coerce.number().int().min(0).optional().default(0)
 * so behavior (coercion, bounds, defaults) and the inferred types are unchanged.
 */

import { z } from "zod";

/**
 * Standard `{ limit, offset }` pagination fields for a list-query `z.object({...})`.
 * Spread into the schema: `z.object({ ...filters, ...paginationFields(200, 50) })`.
 *
 * @param maxLimit     hard cap on `limit` (e.g. 200, 500, 1000) — preserved per-schema.
 * @param defaultLimit value used when `limit` is omitted (e.g. 50, 100, 200).
 */
export function paginationFields(maxLimit: number, defaultLimit: number) {
  return {
    limit: z.coerce.number().int().min(1).max(maxLimit).optional().default(defaultLimit),
    offset: z.coerce.number().int().min(0).optional().default(0),
  };
}
