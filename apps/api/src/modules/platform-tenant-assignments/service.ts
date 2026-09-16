/**
 * apps/api/src/modules/platform-tenant-assignments/service.ts — mandato K, R-0 (D9=B).
 *
 * Governa l'unico posto dove nasce l'insieme che `perimetroClienti` legge
 * (apps/api/src/lib/actor.ts, via `req.assignedTenantIds` popolato da
 * middleware/tenantContext.ts). Solo `PLATFORM_ADMIN` detiene
 * `platform_tenant_assignment:manage` oggi (mig `000421`): assegnare o revocare un cliente a
 * un ruolo di piattaforma assegnato è un atto amministrativo, non un perimetro.
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { NotFoundError, ConflictError, UnprocessableEntityError } from "../../errors/index.js";
import type {
  CreatePlatformTenantAssignmentBody,
  PlatformTenantAssignment,
  PlatformTenantAssignmentListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export type { ActorContext };

export const platformTenantAssignmentsService = {
  async list(query: PlatformTenantAssignmentListQuery) {
    return repo.listAssignments(pool, query);
  },

  async get(id: string): Promise<PlatformTenantAssignment> {
    const a = await repo.findAssignmentById(pool, id);
    if (!a) throw new NotFoundError("Assegnazione non trovata", "PLATFORM_TENANT_ASSIGNMENT_NOT_FOUND");
    return a;
  },

  async create(
    actor: ActorContext,
    body: CreatePlatformTenantAssignmentBody,
  ): Promise<PlatformTenantAssignment> {
    const { userExists, tenantExists } = await repo.esistonoEntita(pool, body.userId, body.tenantId);
    if (!userExists || !tenantExists) {
      throw new UnprocessableEntityError(
        { userExists, tenantExists },
        "Utente o cliente inesistente",
        "PLATFORM_TENANT_ASSIGNMENT_PARTY_INVALID",
      );
    }
    const attiva = await repo.findActiveAssignment(pool, body.userId, body.tenantId);
    if (attiva) {
      throw new ConflictError(
        "Assegnazione già attiva per questa coppia utente/cliente",
        "PLATFORM_TENANT_ASSIGNMENT_ALREADY_ACTIVE",
      );
    }
    return repo.insertAssignment(pool, {
      userId: body.userId,
      tenantId: body.tenantId,
      assignedBy: actor.userId,
    });
  },

  async revoke(id: string): Promise<PlatformTenantAssignment> {
    const esiste = await repo.findAssignmentById(pool, id);
    if (!esiste) throw new NotFoundError("Assegnazione non trovata", "PLATFORM_TENANT_ASSIGNMENT_NOT_FOUND");

    const { revocata } = await repo.revokeAssignment(pool, id);
    if (!revocata) {
      throw new UnprocessableEntityError(
        { status: "già revocata" },
        "L'assegnazione non è attiva",
        "PLATFORM_TENANT_ASSIGNMENT_NOT_ACTIVE",
      );
    }
    return this.get(id);
  },
};
