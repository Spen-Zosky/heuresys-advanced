/**
 * apps/api/src/modules/brownfield-source-exports/service.ts
 * Read-only. PLATFORM_ADMIN-gated at route level via brownfield_adaptation:read.
 */
import { pool } from "../../db/client.js";
import { NotFoundError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { BrownfieldSourceExport, BrownfieldSourceExportListQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }

export const brownfieldSourceExportsService = {
  async list(_actor: ActorContext, query: BrownfieldSourceExportListQuery) {
    return repo.listExports(pool, query);
  },
  async getById(_actor: ActorContext, id: string): Promise<BrownfieldSourceExport> {
    const t = await repo.findExportById(pool, id);
    if (!t) throw new NotFoundError("BrownfieldSourceExport");
    return t;
  },
};
