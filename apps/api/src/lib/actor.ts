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
}

/** True iff the actor holds the cross-tenant PLATFORM_ADMIN role. */
export function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}

/**
 * Builds the ActorContext from an authenticated request. Throws
 * UnauthorizedError when `req.user` is absent (route-level auth guard).
 */
export function actorFromRequest(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}
