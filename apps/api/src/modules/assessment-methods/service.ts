/**
 * apps/api/src/modules/assessment-methods/service.ts
 * Read-only catalog.
 */

import { pool } from "../../db/client.js";
import type { RoleCode } from "../../config/constants.js";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

export const assessmentMethodsService = {
  async list(_actor: ActorContext) {
    return repo.listMethods(pool);
  },
};
