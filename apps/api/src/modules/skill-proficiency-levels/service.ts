/**
 * apps/api/src/modules/skill-proficiency-levels/service.ts
 * Read-only — catalog values are seeded by migration and cannot be mutated
 * through the API. Any authenticated actor can list.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import * as repo from "./repository.js";

export const skillProficiencyLevelsService = {
  async list(_actor: ActorContext) {
    return repo.listProficiencyLevels(pool);
  },
};
