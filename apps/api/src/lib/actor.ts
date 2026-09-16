/**
 * apps/api/src/lib/actor.ts
 * Shared ActorContext — the minimal authenticated-caller projection that every
 * service uses for scope authorization, plus the helpers that build it from a
 * request and test the platform-admin role (B4).
 *
 * Previously ~73 service.ts files each declared an identical `ActorContext`
 * interface + a local `isPlatform()`, and ~72 routes.ts files each declared an
 * identical `actor(req)` builder. This module is the single source of truth.
 *
 * NOTE: the reference-sync module deliberately uses a DIFFERENT actor shape
 * (`{ userId: string | null }` — a system/scheduled run may have no user) and
 * keeps its own local type; it does not consume this module.
 */

import type { FastifyRequest } from "fastify";
import type { RoleCode } from "../config/constants.js";
import { UnauthorizedError } from "../errors/index.js";

/** Authenticated caller projection used by services for scope authorization. */
export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
  /**
   * Mandato K, R-0 (D9=B). Presente SOLO quando `middleware/tenantContext.ts` ha trovato
   * assegnazioni attive in `sys.sys_platform_user_tenant_assignments` per un ruolo in
   * `PLATFORM_ASSIGNED_MANDATE_ROLES` (oggi quell'insieme è vuoto: nessuna richiesta lo
   * valorizza mai). `undefined` = "non è un ruolo di piattaforma assegnato", non "zero clienti"
   * — la differenza la fa `perimetroClienti`.
   */
  assignedTenantIds?: readonly string[];
}

/** True iff the actor holds the cross-tenant PLATFORM_ADMIN role. */
export function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}

/**
 * Il perimetro di clienti che l'attore può vedere (mandato K, R-0, D9=B).
 * `undefined` = nessun filtro (PLATFORM_ADMIN, tutti i clienti). Un `Set` — anche vuoto —
 * = solo quei clienti: vuoto significa "nessuno assegnato", non "tutti". Le 24 porte misurate
 * da `I-G` sostituiscono qui il loro `isPlatform(actor) ? undefined : actor.tenantId` locale.
 */
export function perimetroClienti(a: ActorContext): Set<string> | undefined {
  if (isPlatform(a)) return undefined;
  if (a.assignedTenantIds !== undefined) return new Set(a.assignedTenantIds);
  return new Set(a.tenantId ? [a.tenantId] : []);
}

/** Vero se l'attore può vedere il cliente `tenantId` (nessun filtro, o è nel suo perimetro). */
export function puoVedereCliente(a: ActorContext, tenantId: string): boolean {
  const perimetro = perimetroClienti(a);
  return perimetro === undefined || perimetro.has(tenantId);
}

/**
 * Builds the ActorContext from an authenticated request. Throws
 * UnauthorizedError when `req.user` is absent (route-level auth guard).
 * `assignedTenantIds` is read off `req` — populated (or left undefined) by
 * `middleware/tenantContext.ts`, which runs earlier in the plugin chain.
 */
export function actorFromRequest(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return {
    userId: req.user.userId,
    tenantId: req.user.tenantId,
    roles: req.user.roles,
    ...(req.assignedTenantIds !== undefined ? { assignedTenantIds: req.assignedTenantIds } : {}),
  };
}
