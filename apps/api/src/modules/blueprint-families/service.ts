/**
 * apps/api/src/modules/blueprint-families/service.ts
 * Global catalog. PLATFORM_ADMIN only for writes.
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  BlueprintFamily, BlueprintFamilyListQuery,
  CreateBlueprintFamilyBody, UpdateBlueprintFamilyBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }
function isPlatform(a: ActorContext): boolean { return a.roles.includes("PLATFORM_ADMIN"); }

export const blueprintFamiliesService = {
  async list(_actor: ActorContext, query: BlueprintFamilyListQuery) {
    return repo.listFamilies(pool, query);
  },
  async getById(_actor: ActorContext, id: string): Promise<BlueprintFamily> {
    const t = await repo.findFamilyById(pool, id);
    if (!t) throw new NotFoundError("BlueprintFamily");
    return t;
  },
  async create(actor: ActorContext, body: CreateBlueprintFamilyBody): Promise<BlueprintFamily> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const dup = await repo.findFamilyByCode(pool, body.code);
    if (dup) throw new ConflictError(
      `Blueprint family '${body.code}' already exists`, "BLUEPRINT_FAMILY_CODE_CONFLICT",
    );
    return repo.insertFamily(pool, body);
  },
  async update(actor: ActorContext, id: string, patch: UpdateBlueprintFamilyBody): Promise<BlueprintFamily> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const u = await repo.updateFamilyPartial(pool, id, patch);
    if (!u) throw new NotFoundError("BlueprintFamily");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    if (await repo.familyHasVariants(pool, id)) {
      throw new ConflictError("Cannot delete family with attached variants", "BLUEPRINT_FAMILY_HAS_VARIANTS");
    }
    const ok = await repo.deleteFamily(pool, id);
    if (!ok) throw new NotFoundError("BlueprintFamily");
  },
};
