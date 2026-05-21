/**
 * apps/api/src/modules/job-roles/service.ts
 * job_role:read open to all (per matrix); create/update for PLATFORM_ADMIN,
 * TENANT_ADMIN, HRMS_MANAGER per seeded perms. No delete in seed → not
 * exposed.
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  JobRole,
  JobRoleListQuery,
  CreateJobRoleBody,
  UpdateJobRoleBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

export const jobRolesService = {
  async list(_actor: ActorContext, query: JobRoleListQuery) {
    return repo.listJobRoles(pool, query);
  },

  async getById(_actor: ActorContext, id: string): Promise<JobRole> {
    const target = await repo.findJobRoleById(pool, id);
    if (!target) throw new NotFoundError("JobRole");
    return target;
  },

  async create(actor: ActorContext, body: CreateJobRoleBody): Promise<JobRole> {
    // ADR-0015: jobFamilyId is now optional+nullable. Only check FK if provided.
    if (body.jobFamilyId && !(await repo.jobFamilyExists(pool, body.jobFamilyId))) {
      throw new NotFoundError("JobFamily");
    }
    const dup = await repo.findJobRoleByCode(pool, body.code);
    if (dup) {
      throw new ConflictError(
        `Job role code '${body.code}' already exists`,
        "JOB_ROLE_CODE_CONFLICT",
      );
    }
    return repo.insertJobRole(pool, body, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdateJobRoleBody): Promise<JobRole> {
    const target = await repo.findJobRoleById(pool, id);
    if (!target) throw new NotFoundError("JobRole");
    if (patch.jobFamilyId && !(await repo.jobFamilyExists(pool, patch.jobFamilyId))) {
      throw new NotFoundError("JobFamily");
    }
    const updated = await repo.updateJobRolePartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("JobRole");
    return updated;
  },
};
