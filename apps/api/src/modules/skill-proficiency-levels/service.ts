/**
 * apps/api/src/modules/skill-proficiency-levels/service.ts
 * Read-only — catalog values are seeded by migration and cannot be mutated
 * through the API. Any authenticated actor can list.
 */

import { pool } from "../../db/client.js";
import type { RoleCode } from "../../config/constants.js";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

export const skillProficiencyLevelsService = {
  async list(_actor: ActorContext) {
    return repo.listProficiencyLevels(pool);
  },
};
