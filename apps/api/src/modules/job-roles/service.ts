/**
 * apps/api/src/modules/job-roles/service.ts
 * job_role:read open to all (per matrix); create/update for PLATFORM_ADMIN,
 * TENANT_ADMIN, HRMS_MANAGER per seeded perms. No delete in seed → not
 * exposed.
 *
 * ⚠ DAL 2026-09-10 LA LETTURA PASSA DAL PROFILO (ADR-0039, B22/B21). Prima l'attore era
 * ignorato — il parametro si chiamava letteralmente `_actor` — e chiunque riceveva tutti i
 * 176 ruoli del catalogo di piattaforma. Ora un utente del cliente riceve i ruoli del
 * profilo del proprio cliente più le voci che quel cliente si è creato; chi amministra la
 * piattaforma riceve il catalogo intero, perché è chi costruisce un cliente nuovo ed è
 * l'unico momento in cui serve vederlo tutto.
 *
 * ⚠ IL CATALOGO NON SI SVUOTA MAI: filtrare è una lettura, non una cancellazione. I ruoli
 * fuori dal profilo di un cliente restano nel catalogo, disponibili per il cliente di un
 * altro settore che nascerà.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";
import { perimetroDiCatalogo } from "../../lib/scope/profilo.js";

export type { ActorContext };
import { NotFoundError, ConflictError } from "../../errors/index.js";
import type {
  JobRole,
  JobRoleListQuery,
  CreateJobRoleBody,
  UpdateJobRoleBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export const jobRolesService = {
  async list(actor: ActorContext, query: JobRoleListQuery) {
    return repo.listJobRoles(pool, query, await perimetroDiCatalogo(pool, actor, "job_roles"));
  },

  async getById(actor: ActorContext, id: string): Promise<JobRole> {
    // Fuori dal perimetro la risposta è 404, non 403: un ruolo che il profilo del cliente non
    // contiene non è «vietato», semplicemente non fa parte del suo mondo — e un 403 direbbe
    // all'attore che quel ruolo esiste, cioè esattamente ciò che il filtro toglie.
    const target = await repo.findJobRoleInPerimeter(
      pool, id, await perimetroDiCatalogo(pool, actor, "job_roles"),
    );
    if (!target) throw new NotFoundError("JobRole");
    return target;
  },

  async create(actor: ActorContext, body: CreateJobRoleBody): Promise<JobRole> {
    // ADR-0015: jobFamilyId is now optional+nullable. Only check FK if provided.
    if (body.jobFamilyId && !(await repo.jobFamilyExists(pool, body.jobFamilyId))) {
      throw new NotFoundError("JobFamily");
    }
    // ADR-0039 regola 3 — chi amministra la piattaforma scrive nel CATALOGO (cliente NULL);
    // chiunque altro si crea una VOCE PROPRIA, che resta sua e non compare a nessun altro.
    const proprietario = isPlatform(actor) ? null : actor.tenantId;
    const dup = await repo.findJobRoleByCode(pool, body.code, proprietario);
    if (dup) {
      throw new ConflictError(
        `Job role code '${body.code}' already exists`,
        "JOB_ROLE_CODE_CONFLICT",
      );
    }
    return repo.insertJobRole(pool, body, actor.userId, proprietario);
  },

  async update(actor: ActorContext, id: string, patch: UpdateJobRoleBody): Promise<JobRole> {
    // Dentro il perimetro anche in scrittura: senza, un cliente modificherebbe per
    // identificativo un ruolo che il suo profilo non contiene — cioè il catalogo di tutti.
    const target = await repo.findJobRoleInPerimeter(
      pool, id, await perimetroDiCatalogo(pool, actor, "job_roles"),
    );
    if (!target) throw new NotFoundError("JobRole");
    if (patch.jobFamilyId && !(await repo.jobFamilyExists(pool, patch.jobFamilyId))) {
      throw new NotFoundError("JobFamily");
    }
    const updated = await repo.updateJobRolePartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("JobRole");
    return updated;
  },
};
