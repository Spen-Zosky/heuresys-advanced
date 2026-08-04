/**
 * apps/api/src/lib/scope/mask.ts — the fourth authorization state (#124).
 *
 * The system had two states, `read` and `403`. The domain matrix needs four —
 * `edit`, `read`, `mask`, `none` — and `mask` had no implementation, which is
 * why the matrix stayed a document. This module is `mask`.
 *
 * WHAT IT IMPLEMENTS. Enzo's decision of 2026-08-04: **the technical
 * administrator stops seeing salaries and evaluations, but still knows they
 * exist.** Not the same as `none`: hiding the row would tell the administrator
 * nothing exists, and diagnosing a payroll handoff means being able to see that
 * July's record IS there. So the ROW survives and the FIELD goes.
 *
 * WHERE IT SITS. Between the service (which has already read the true value)
 * and the Zod response serializer. Never in the frontend: masking in the client
 * means the true value already crossed the network, and the mask is then
 * cosmetic. Never in the database either — the same row serves actors with
 * different rights, and a view per domain multiplies views by domains. And
 * never via RLS, which invariant **I5** excludes project-wide.
 *
 * THE FOUR PROPERTIES the masked value must have (project constraints 2-5):
 *  - per FIELD, not per row — the period stays, the amount goes;
 *  - DECLARED — an amount replaced by `0` or `null` is a lie, because the
 *    client cannot tell "you may not see this" from "there is nothing here".
 *    The field is ABSENT and its name is listed in `masked`, so the interface
 *    can say «nascosto per il tuo profilo» instead of rendering a zero;
 *  - STABLE and NON-INVERTIBLE — same row, same actor, same outcome, and no
 *    order-preserving truncation. Absence is the strongest form of both: there
 *    is no residue to difference against and nothing left to sort by;
 *  - AGGREGATES FOLLOW THE DATA — hiding individual salaries while publishing
 *    the mean of a three-person unit is an arithmetic leak. Any aggregate over
 *    a masked class must pass through the same gate or be suppressed.
 *
 * WHY THE MANDATE IS READ FROM ROLES HERE, when #116/#119 exist precisely to
 * stop deriving behaviour from role lists: because the mandate IS a role.
 * ADR-0027 §2.5 defines the HR mandate by explicit grant, "not via the axes" —
 * `HR_MANDATED_ROLES` in resolver.ts is that definition, and this module reuses
 * it rather than restating it. The platform mandate likewise: `PLATFORM_ADMIN`
 * is the only role carrying `auth_role_is_platform` (verified on the live map
 * 2026-08-04), so `isPlatform` reads a property of the role, not a name in a
 * hand-written set.
 */

import { isPlatform, type ActorContext } from "../actor.js";
import { HR_MANDATED_ROLES } from "./resolver.js";
import type { DataClass } from "./data-classes.js";

/**
 * The classes the platform mandate alone does NOT open.
 *
 * The domain matrix names these cells `platform_mandate`/`CONTRACT_PAY` and
 * `platform_mandate`/`EVALUATION`; in code the pay class is `COMPENSATION`
 * (data-classes.ts), which is the same class under the taxonomy's own name.
 *
 * `PERSONAL` and `SKILL` are deliberately NOT here: Enzo's decision named
 * salaries and evaluations, and widening it silently would be inventing a
 * decision. They are covered by the IDENTITY_PRO/IDENTITY_PRIV split, which is
 * a separate, class-level change and needs no masking at all.
 */
export const MASKED_UNDER_PLATFORM_MANDATE: ReadonlySet<DataClass> = new Set<DataClass>([
  "COMPENSATION",
  "EVALUATION",
]);

/**
 * Does this actor read this class under the platform mandate ALONE?
 *
 * Three ways the answer is no, in order of precedence:
 *  1. the row is the actor's own — **I17**, the universal ESS floor: self-scope
 *     overrides every axis, and a person always sees their own pay;
 *  2. the actor holds an HR mandate (`TENANT_ADMIN`, `HRMS_MANAGER`) — **I20**
 *     keeps those tenant-wide by explicit mandate, and holding one alongside
 *     PLATFORM_ADMIN means the read is authorized by the HR mandate, not by the
 *     platform one;
 *  3. the actor is not a platform actor at all, in which case the organizational
 *     axis already decided whether they see the row (I18) and masking would be
 *     answering a question that was never asked.
 *
 * @param subjectUserId the person the row is ABOUT. Pass null for a row with no
 *   single subject (an aggregate) — the self-exemption cannot apply there.
 */
export function masksUnderPlatformMandate(
  actor: ActorContext,
  dataClass: DataClass,
  subjectUserId: string | null,
): boolean {
  if (!MASKED_UNDER_PLATFORM_MANDATE.has(dataClass)) return false;
  if (subjectUserId !== null && subjectUserId === actor.userId) return false; // I17
  if (actor.roles.some((r) => HR_MANDATED_ROLES.has(r))) return false; // I20
  return isPlatform(actor);
}

/** A row that has been through the mask carries the list of what was taken. */
export type Masked<T> = Omit<T, never> & { masked?: string[] };

/**
 * Remove `fields` from `row` and declare them in `masked`.
 *
 * Deletion, not substitution: the key is absent from the serialized object, so
 * there is no placeholder to mistake for a value and no residue to invert. The
 * `masked` list is sorted so the same row always serializes identically —
 * "stable" in constraint 4 means the client cannot learn anything from the
 * shape of the response either.
 *
 * Fields already absent are still declared: the caller asked for them to be
 * hidden, and the client must not have to distinguish "hidden" from "null in
 * the database" by their absence from the list.
 */
export function maskFields<T extends Record<string, unknown>>(
  row: T,
  fields: readonly string[],
): Masked<T> {
  if (fields.length === 0) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!fields.includes(k)) out[k] = v;
  }
  out["masked"] = [...fields].sort();
  return out as Masked<T>;
}
