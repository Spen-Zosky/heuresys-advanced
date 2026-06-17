/**
 * apps/api/src/modules/blueprint-processes/service.ts
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  BlueprintProcess, BlueprintProcessListQuery,
  CreateBlueprintProcessBody, UpdateBlueprintProcessBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export const blueprintProcessesService = {
  async list(_actor: ActorContext, query: BlueprintProcessListQuery) {
    return repo.listProcesses(pool, query);
  },
  async getById(_actor: ActorContext, id: string): Promise<BlueprintProcess> {
    const t = await repo.findProcessById(pool, id);
    if (!t) throw new NotFoundError("BlueprintProcess");
    return t;
  },
  async create(actor: ActorContext, body: CreateBlueprintProcessBody): Promise<BlueprintProcess> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    if (!(await repo.variantExists(pool, body.variantId))) throw new NotFoundError("BlueprintVariant");
    const dup = await repo.findProcessByVariantCode(pool, body.variantId, body.code);
    if (dup) throw new ConflictError(
      `Process '${body.code}' already in variant`, "BLUEPRINT_PROCESS_CODE_CONFLICT",
    );
    return repo.insertProcess(pool, body);
  },
  async update(actor: ActorContext, id: string, patch: UpdateBlueprintProcessBody): Promise<BlueprintProcess> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const u = await repo.updateProcessPartial(pool, id, patch);
    if (!u) throw new NotFoundError("BlueprintProcess");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const ok = await repo.deleteProcess(pool, id);
    if (!ok) throw new NotFoundError("BlueprintProcess");
  },
};
