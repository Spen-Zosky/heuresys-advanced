/**
 * apps/api/src/modules/job-families/service.ts
 * Platform-level reference data. Read open to all authenticated; mutation
 * gated to PLATFORM_ADMIN since there's no granular job_family permission
 * in the seed and these are cross-tenant taxonomic anchors.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  JobFamily,
  JobFamilyListQuery,
  CreateJobFamilyBody,
  UpdateJobFamilyBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function ensurePlatformAdmin(actor: ActorContext): void {
  if (!actor.roles.includes("PLATFORM_ADMIN")) {
    throw new ForbiddenError(
      "Only PLATFORM_ADMIN may manage job families",
      "JOB_FAMILY_ADMIN_ONLY",
    );
  }
}

export const jobFamiliesService = {
  async list(_actor: ActorContext, query: JobFamilyListQuery) {
    return repo.listJobFamilies(pool, query);
  },

  async getById(_actor: ActorContext, id: string): Promise<JobFamily> {
    const target = await repo.findJobFamilyById(pool, id);
    if (!target) throw new NotFoundError("JobFamily");
    return target;
  },

  async create(actor: ActorContext, body: CreateJobFamilyBody): Promise<JobFamily> {
    ensurePlatformAdmin(actor);
    const dup = await repo.findJobFamilyByCode(pool, body.code);
    if (dup) {
      throw new ConflictError(
        `Job family code '${body.code}' already exists`,
        "JOB_FAMILY_CODE_CONFLICT",
      );
    }
    return repo.insertJobFamily(pool, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateJobFamilyBody): Promise<JobFamily> {
    ensurePlatformAdmin(actor);
    const target = await repo.findJobFamilyById(pool, id);
    if (!target) throw new NotFoundError("JobFamily");
    const updated = await repo.updateJobFamilyPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("JobFamily");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    ensurePlatformAdmin(actor);
    const target = await repo.findJobFamilyById(pool, id);
    if (!target) throw new NotFoundError("JobFamily");
    try {
      const ok = await repo.deleteJobFamily(pool, id);
      if (!ok) throw new NotFoundError("JobFamily");
    } catch (err) {
      // FK restrict on sys_job_roles → emit 409 instead of a raw pg error.
      const e = err as { code?: string };
      if (e.code === "23503") {
        throw new ConflictError(
          "Cannot delete job family with attached job roles",
          "JOB_FAMILY_IN_USE",
        );
      }
      throw err;
    }
  },
};
