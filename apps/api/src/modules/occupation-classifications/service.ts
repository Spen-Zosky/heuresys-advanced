/**
 * apps/api/src/modules/occupation-classifications/service.ts
 * Global catalog (ISCO-08 + CP2021): read for everyone holding the permission
 * (no tenant filter), write PLATFORM_ADMIN only — platform taxonomy, come
 * job-families/skill-taxonomy (000199) e activity-classifications.
 * i18n ADR-0029: name IT-canonico in-row, overlay EN via localize.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { localize, localizeOne } from "../../lib/i18n/localize.js";
import type { Locale } from "../../middleware/locale.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  OccupationClassification, OccupationClassificationListQuery,
  CreateOccupationClassificationBody, UpdateOccupationClassificationBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

// i18n overlay: swap name to the requested locale (fallback = IT in-row).
const OCCUPATION_CLASS_I18N = {
  name: (o: OccupationClassification, t: string) => { o.name = t; },
};

export const occupationClassificationsService = {
  async list(_actor: ActorContext, query: OccupationClassificationListQuery, locale: Locale = "it") {
    const res = await repo.listOc(pool, query);
    await localize(pool, locale, "sys_occupation_classifications", res.items, (o) => o.occupationClassificationId, OCCUPATION_CLASS_I18N);
    return res;
  },
  async getById(_actor: ActorContext, id: string, locale: Locale = "it"): Promise<OccupationClassification> {
    const t = await repo.findOcById(pool, id);
    if (!t) throw new NotFoundError("OccupationClassification");
    await localizeOne(pool, locale, "sys_occupation_classifications", t, (o) => o.occupationClassificationId, OCCUPATION_CLASS_I18N);
    return t;
  },
  async create(actor: ActorContext, body: CreateOccupationClassificationBody): Promise<OccupationClassification> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const dup = await repo.findOcBySchemeCode(pool, body.scheme, body.code);
    if (dup) throw new ConflictError(
      `Classification '${body.scheme}/${body.code}' already exists`,
      "OCCUPATION_CLASSIFICATION_CONFLICT",
    );
    return repo.insertOc(pool, body);
  },
  async update(actor: ActorContext, id: string, patch: UpdateOccupationClassificationBody): Promise<OccupationClassification> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const u = await repo.updateOcPartial(pool, id, patch);
    if (!u) throw new NotFoundError("OccupationClassification");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const ok = await repo.deleteOc(pool, id);
    if (!ok) throw new NotFoundError("OccupationClassification");
  },
};
