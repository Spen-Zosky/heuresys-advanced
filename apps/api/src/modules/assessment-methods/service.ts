/**
 * apps/api/src/modules/assessment-methods/service.ts
 * Read-only catalog.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import * as repo from "./repository.js";

export const assessmentMethodsService = {
  async list(_actor: ActorContext) {
    return repo.listMethods(pool);
  },
};
