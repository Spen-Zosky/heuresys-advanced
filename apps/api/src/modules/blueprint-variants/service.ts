/**
 * apps/api/src/modules/blueprint-variants/service.ts
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  BlueprintVariant, BlueprintVariantListQuery,
  CreateBlueprintVariantBody, UpdateBlueprintVariantBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }
function isPlatform(a: ActorContext): boolean { return a.roles.includes("PLATFORM_ADMIN"); }

export const blueprintVariantsService = {
  async list(_actor: ActorContext, query: BlueprintVariantListQuery) {
    return repo.listVariants(pool, query);
  },
  async getById(_actor: ActorContext, id: string): Promise<BlueprintVariant> {
    const t = await repo.findVariantById(pool, id);
    if (!t) throw new NotFoundError("BlueprintVariant");
    return t;
  },
  async create(actor: ActorContext, body: CreateBlueprintVariantBody): Promise<BlueprintVariant> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    if (!(await repo.familyExists(pool, body.familyId))) throw new NotFoundError("BlueprintFamily");
    if (body.sizeBandId && !(await repo.sizeBandExists(pool, body.sizeBandId))) {
      throw new NotFoundError("EnterpriseSizeBand");
    }
    const dup = await repo.findVariantByCode(pool, body.code);
    if (dup) throw new ConflictError(
      `Blueprint variant '${body.code}' already exists`, "BLUEPRINT_VARIANT_CODE_CONFLICT",
    );
    return repo.insertVariant(pool, body);
  },
  async update(actor: ActorContext, id: string, patch: UpdateBlueprintVariantBody): Promise<BlueprintVariant> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    if (patch.sizeBandId !== undefined && patch.sizeBandId !== null) {
      if (!(await repo.sizeBandExists(pool, patch.sizeBandId))) {
        throw new NotFoundError("EnterpriseSizeBand");
      }
    }
    const u = await repo.updateVariantPartial(pool, id, patch);
    if (!u) throw new NotFoundError("BlueprintVariant");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const ok = await repo.deleteVariant(pool, id);
    if (!ok) throw new NotFoundError("BlueprintVariant");
  },
};
