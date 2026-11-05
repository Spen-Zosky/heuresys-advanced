/**
 * apps/api/src/modules/mandate-acts/service.ts — ADR-0050 D4 e D7 (mig 000475).
 *
 * Concedere, revocare o riconfermare un mandato forte (MANDATE_ROLES) è un atto in tre tempi:
 *   1. lo propone chi può concedere ruoli (CAN_GRANT_ROLES), con motivo e, per concessione e
 *      riconferma, una data di revisione entro un anno; mai per sé stesso;
 *   2. lo decide un SECONDO titolare di mandato che può concedere ruoli: mai chi lo ha proposto,
 *      mai chi lo riceve; chi lo ha proposto può solo ritirarlo;
 *   3. solo l'approvazione produce l'effetto su sys.sys_user_auth_roles, nella stessa
 *      transazione, e l'effetto porta il riferimento all'atto.
 * Il perimetro è quello di `grantRole`: PLATFORM_ADMIN su tutti i tenant e sulle concessioni di
 * piattaforma; TENANT_ADMIN e SECURITY_ADMIN sul proprio tenant soltanto.
 * D7 si rifiuta già alla proposta (`mandatoIncompatibileCon`) e di nuovo, senza scampo, nel
 * database all'approvazione.
 */

import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import type { RoleCode } from "../../config/constants.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../errors/index.js";
import {
  MANDATE_REVIEW_MAX_DAYS,
  type MandateAct,
  type MandateActListQuery,
  type ProposeMandateActBody,
} from "@heuresys/shared";
import {
  MANDATE_ROLES,
  haMandatoPiattaforma,
  mandatoIncompatibileCon,
  puoConcedereRuoli,
} from "../../lib/scope/mandati.js";
import * as usersRepo from "../users/repository.js";
import * as repo from "./repository.js";


/** Chi non vede l'atto non ne conosce l'esistenza: 404, come per le persone di un altro tenant. */
function puoVedere(actor: ActorContext, act: { tenantId: string | null }): boolean {
  if (haMandatoPiattaforma(actor)) return true;
  return act.tenantId !== null && act.tenantId === actor.tenantId;
}

function oggiUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function fraGiorni(giorni: number): string {
  return new Date(Date.now() + giorni * 86_400_000).toISOString().slice(0, 10);
}

/** Un errore di un trigger della 000475 diventa un rifiuto leggibile, con il suo codice. */
function traduciRifiuto(err: unknown): never {
  const e = err as { code?: string; message?: string };
  if (e?.code === "23514" && typeof e.message === "string") {
    if (e.message.includes("ADR-0050 D7")) throw new ConflictError(e.message, "MANDATE_INCOMPATIBLE");
    if (e.message.includes("approver must hold a mandate")) {
      throw new ForbiddenError(e.message, "MANDATE_APPROVER_WITHOUT_MANDATE");
    }
  }
  if (e?.code === "23505") {
    throw new ConflictError("An open proposal for the same act already exists", "MANDATE_ACT_PENDING");
  }
  throw err;
}

function richiedeChiConcede(actor: ActorContext): void {
  if (!puoConcedereRuoli(actor)) {
    throw new ForbiddenError("Insufficient privileges to propose or decide mandate acts");
  }
}

export const mandateActsService = {
  async list(actor: ActorContext, query: MandateActListQuery): Promise<MandateAct[]> {
    richiedeChiConcede(actor);
    return repo.listActs(pool, {
      tenantId: haMandatoPiattaforma(actor) ? "ALL" : actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    });
  },

  async get(actor: ActorContext, actId: string): Promise<MandateAct> {
    richiedeChiConcede(actor);
    const act = await repo.findAct(pool, actId);
    if (!act || !puoVedere(actor, act)) throw new NotFoundError("MandateAct");
    return act;
  },

  async propose(actor: ActorContext, body: ProposeMandateActBody): Promise<MandateAct> {
    richiedeChiConcede(actor);

    const target = await usersRepo.findUserById(pool, body.userId);
    if (!target) throw new NotFoundError("User");
    if (!haMandatoPiattaforma(actor) && target.tenantId !== actor.tenantId) throw new NotFoundError("User");
    if (target.userId === actor.userId && body.kind !== "REVOKE") {
      throw new ForbiddenError("Nobody proposes a mandate for themselves (ADR-0050 D4)", "MANDATE_SELF_PROPOSAL");
    }

    let roleId: string;
    let roleCode: RoleCode;
    let tenantId: string | null;
    let grantId: string | null = null;

    if (body.kind === "GRANT") {
      roleCode = body.roleCode!;
      if (!MANDATE_ROLES.has(roleCode)) {
        throw new ConflictError(
          `Role ${roleCode} is not a mandate: grant it with POST /v1/users/:id/roles`,
          "NOT_A_MANDATE",
        );
      }
      const role = await repo.findRoleByCode(pool, roleCode);
      if (!role) throw new NotFoundError("Role");
      roleId = role.id;
      // Stesse regole di perimetro di `grantRole` (users/service.ts).
      if (haMandatoPiattaforma(actor)) {
        if (body.tenantId === null) {
          if (!role.isPlatform) {
            throw new ConflictError(
              `Role ${roleCode} is not a platform role; tenantId must be provided`,
              "PLATFORM_GRANT_INVALID",
            );
          }
          tenantId = null;
        } else {
          tenantId = body.tenantId ?? target.tenantId;
        }
      } else {
        if (role.isPlatform) {
          throw new ForbiddenError("Only PLATFORM_ADMIN proposes platform-scoped mandates", "PLATFORM_GRANT_FORBIDDEN");
        }
        tenantId = actor.tenantId;
      }
      if (await repo.findActiveGrantByRole(pool, target.userId, roleId, tenantId)) {
        throw new ConflictError(`Role ${roleCode} already granted with the same scope`, "ROLE_GRANT_DUPLICATE");
      }
      const portati = (await usersRepo.listRoleGrantsForUser(pool, target.userId)).map((g) => g.roleCode);
      const conflitto = mandatoIncompatibileCon(roleCode, portati);
      if (conflitto) {
        throw new ConflictError(
          `${roleCode} and ${conflitto} cannot be held by the same person (ADR-0050 D7)`,
          "MANDATE_INCOMPATIBLE",
        );
      }
    } else {
      const grant = await repo.findGrant(pool, body.grantId!);
      if (!grant || grant.userId !== target.userId) throw new NotFoundError("RoleGrant");
      if (!grant.active) {
        throw new ConflictError("Role grant already revoked", "ROLE_GRANT_ALREADY_REVOKED");
      }
      roleCode = grant.roleCode as RoleCode;
      if (!MANDATE_ROLES.has(roleCode)) {
        throw new ConflictError(
          `Role ${roleCode} is not a mandate: revoke it with DELETE /v1/users/:id/roles/:grantId`,
          "NOT_A_MANDATE",
        );
      }
      if (!haMandatoPiattaforma(actor)) {
        if (grant.tenantId === null) {
          throw new ForbiddenError("Only PLATFORM_ADMIN acts on platform-scoped grants", "PLATFORM_REVOKE_FORBIDDEN");
        }
        if (grant.tenantId !== actor.tenantId) throw new NotFoundError("RoleGrant");
      }
      roleId = grant.roleId;
      tenantId = grant.tenantId;
      grantId = body.grantId!;
    }

    const reviewBy = body.kind === "REVOKE" ? null : body.reviewBy!;
    if (reviewBy !== null && (reviewBy <= oggiUtc() || reviewBy > fraGiorni(MANDATE_REVIEW_MAX_DAYS))) {
      throw new ValidationError(
        [{ path: ["reviewBy"], message: `reviewBy must be after today and within ${MANDATE_REVIEW_MAX_DAYS} days` }],
        "Invalid review date",
      );
    }
    if (body.positionId && !(await repo.positionHeldBy(pool, body.positionId, target.userId))) {
      throw new ValidationError(
        [{ path: ["positionId"], message: "the position is not held by this person" }],
        "Invalid position",
      );
    }

    let actId: string;
    try {
      actId = await repo.insertAct(pool, {
        kind: body.kind,
        userId: target.userId,
        roleId,
        tenantId,
        grantId,
        reason: body.reason,
        reviewBy,
        positionId: body.positionId ?? null,
        proposedBy: actor.userId,
      });
    } catch (err) {
      traduciRifiuto(err);
    }
    return (await repo.findAct(pool, actId))!;
  },

  async approve(actor: ActorContext, actId: string, note: string | null): Promise<MandateAct> {
    richiedeChiConcede(actor);
    try {
      await withTransaction(async (client) => {
        const act = await repo.findAct(client, actId, true);
        if (!act || !puoVedere(actor, act)) throw new NotFoundError("MandateAct");
        if (act.status !== "PENDING") throw new ConflictError("The act is already decided", "MANDATE_ACT_DECIDED");
        if (act.proposedBy === actor.userId) {
          throw new ForbiddenError("The proposer does not approve their own act (ADR-0050 D4)", "MANDATE_SAME_PERSON");
        }
        if (act.userId === actor.userId) {
          throw new ForbiddenError("Nobody approves an act about themselves (ADR-0050 D4)", "MANDATE_SAME_PERSON");
        }

        if (act.userId === null) {
          throw new ConflictError("The person this act concerns no longer exists", "MANDATE_ACT_SUBJECT_GONE");
        }
        const soggetto = act.userId;

        await repo.decideAct(client, actId, "APPROVED", actor.userId, note);
        const roleId = (await repo.findRoleByCode(client, act.roleCode))?.id;
        if (!roleId) throw new NotFoundError("Role");

        if (act.kind === "GRANT") {
          if (await repo.findActiveGrantByRole(client, soggetto, roleId, act.tenantId)) {
            throw new ConflictError(`Role ${act.roleCode} already granted with the same scope`, "ROLE_GRANT_DUPLICATE");
          }
          const grantId = await repo.insertMandateGrant(client, {
            userId: soggetto,
            roleId,
            tenantId: act.tenantId,
            grantedBy: act.proposedBy,
            actId,
            reason: act.reason,
            reviewBy: act.reviewBy,
            approvedBy: actor.userId,
          });
          await repo.setActGrant(client, actId, grantId);
        } else if (act.kind === "CONFIRM") {
          const n = await repo.confirmMandateGrant(client, {
            grantId: act.grantId!,
            actId,
            reason: act.reason,
            reviewBy: act.reviewBy,
            approvedBy: actor.userId,
          });
          if (n !== 1) throw new ConflictError("Role grant already revoked", "ROLE_GRANT_ALREADY_REVOKED");
        } else {
          const n = await repo.revokeMandateGrant(client, { grantId: act.grantId!, actId, revokedBy: actor.userId });
          if (n !== 1) throw new ConflictError("Role grant already revoked", "ROLE_GRANT_ALREADY_REVOKED");
        }
      });
    } catch (err) {
      traduciRifiuto(err);
    }
    return (await repo.findAct(pool, actId))!;
  },

  async reject(actor: ActorContext, actId: string, note: string): Promise<MandateAct> {
    richiedeChiConcede(actor);
    await withTransaction(async (client) => {
      const act = await repo.findAct(client, actId, true);
      if (!act || !puoVedere(actor, act)) throw new NotFoundError("MandateAct");
      if (act.status !== "PENDING") throw new ConflictError("The act is already decided", "MANDATE_ACT_DECIDED");
      if (act.proposedBy === actor.userId) {
        throw new ForbiddenError("The proposer withdraws, not rejects, their own act", "MANDATE_SAME_PERSON");
      }
      if (act.userId === actor.userId) {
        throw new ForbiddenError("Nobody decides an act about themselves (ADR-0050 D4)", "MANDATE_SAME_PERSON");
      }
      await repo.decideAct(client, actId, "REJECTED", actor.userId, note);
    });
    return (await repo.findAct(pool, actId))!;
  },

  async withdraw(actor: ActorContext, actId: string, note: string | null): Promise<MandateAct> {
    richiedeChiConcede(actor);
    await withTransaction(async (client) => {
      const act = await repo.findAct(client, actId, true);
      if (!act || !puoVedere(actor, act)) throw new NotFoundError("MandateAct");
      if (act.status !== "PENDING") throw new ConflictError("The act is already decided", "MANDATE_ACT_DECIDED");
      if (act.proposedBy !== actor.userId) {
        throw new ForbiddenError("Only the proposer withdraws an act (ADR-0050 D4)", "MANDATE_NOT_PROPOSER");
      }
      await repo.decideAct(client, actId, "WITHDRAWN", actor.userId, note);
    });
    return (await repo.findAct(pool, actId))!;
  },
};
