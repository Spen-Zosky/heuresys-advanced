/**
 * apps/api/src/modules/position-career-paths/service.ts
 * Junction table. Tenant inherited from position. Career path must be
 * visible to position's tenant (global or own).
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  PositionCareerPath,
  PositionCareerPathListQuery,
  CreatePositionCareerPathBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}
function visible(actor: ActorContext, l: PositionCareerPath): boolean {
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && l.tenantId === actor.tenantId;
}

export const positionCareerPathsService = {
  async list(actor: ActorContext, query: PositionCareerPathListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listLinks(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<PositionCareerPath> {
    const target = await repo.findLinkById(pool, id);
    if (!target) throw new NotFoundError("PositionCareerPath");
    if (!visible(actor, target)) throw new NotFoundError("PositionCareerPath");
    return target;
  },

  async create(actor: ActorContext, body: CreatePositionCareerPathBody): Promise<PositionCareerPath> {
    if (!isPlatform(actor) && !actor.tenantId) {
      throw new ForbiddenError("Tenant context required");
    }
    const pos = await pool.query<{ position_tenant_id: string }>(
      `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`,
      [body.positionId],
    );
    if (pos.rows.length === 0) throw new NotFoundError("Position");
    const tenantId = pos.rows[0]!.position_tenant_id;
    if (!isPlatform(actor) && tenantId !== actor.tenantId) {
      throw new ForbiddenError("Position not in actor tenant", "POSITION_NOT_IN_TENANT");
    }
    const cpVisible = await repo.careerPathVisibleToTenant(pool, body.careerPathId, tenantId);
    if (!cpVisible) throw new NotFoundError("CareerPath");
    const dup = await repo.findExisting(pool, body.positionId, body.careerPathId);
    if (dup) {
      throw new ConflictError(
        "Career path already linked to this position",
        "POSITION_CAREER_PATH_DUPLICATE",
      );
    }
    return repo.insertLink(pool, tenantId, body, actor.userId);
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findLinkById(pool, id);
    if (!target) throw new NotFoundError("PositionCareerPath");
    if (!visible(actor, target)) throw new NotFoundError("PositionCareerPath");
    const ok = await repo.deleteLink(pool, id);
    if (!ok) throw new NotFoundError("PositionCareerPath");
  },
};
