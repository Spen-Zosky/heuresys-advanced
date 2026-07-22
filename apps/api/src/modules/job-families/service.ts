/**
 * apps/api/src/modules/job-families/service.ts
 * Platform-level reference data. Read open to all authenticated; mutations
 * gated by `job_family:*` at the route (000199, #61 G2 — PLATFORM_ADMIN-only
 * audience); ensurePlatformAdmin below stays as defense in depth on these
 * cross-tenant taxonomic anchors.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { localize, localizeOne } from "../../lib/i18n/localize.js";
import type { Locale } from "../../middleware/locale.js";

export type { ActorContext };

// i18n overlay (ADR-0029): swap name/description to the requested locale (fallback = IT in-row).
const JOB_FAMILY_I18N = {
  name: (r: JobFamily, t: string) => { r.name = t; },
  description: (r: JobFamily, t: string) => { r.description = t; },
};
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
  async list(_actor: ActorContext, query: JobFamilyListQuery, locale: Locale = "it") {
    const res = await repo.listJobFamilies(pool, query);
    await localize(pool, locale, "sys_job_families", res.items, (r) => r.jobFamilyId, JOB_FAMILY_I18N);
    return res;
  },

  async getById(_actor: ActorContext, id: string, locale: Locale = "it"): Promise<JobFamily> {
    const target = await repo.findJobFamilyById(pool, id);
    if (!target) throw new NotFoundError("JobFamily");
    await localizeOne(pool, locale, "sys_job_families", target, (r) => r.jobFamilyId, JOB_FAMILY_I18N);
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
