/**
 * apps/api/src/modules/user-position-assignments/service.ts — Mandato K, G-1 (D4=B, F6).
 *
 * Le tre scritture (assegna/termina/trasferisci) creano SOLO una richiesta di approvazione
 * (`USER_POSITION_ASSIGNMENT`, approvals/effects/position-assignment.ts); nulla e' scritto in
 * `sys.sys_user_position_assignments` finche' non arriva la firma. Anti-enumerazione (pattern
 * gia' usato in S-4): una posizione o un incarico fuori dal tenant dell'attore rispondono 404,
 * mai 403 — non si conferma l'esistenza di un oggetto di un'altra azienda (I5).
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../../errors/index.js";
import type {
  UserPositionAssignmentListQuery,
  AssignPositionBody,
  TerminatePositionAssignmentBody,
  TransferPositionAssignmentBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { approvalService } from "../approvals/service.js";
import { USER_POSITION_ASSIGNMENT } from "../approvals/effects/position-assignment.js";
import { avvisiDiUnaAssegnazione } from "../hierarchy-levels/service.js";

function tenantOf(actor: ActorContext): string {
  if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
  return actor.tenantId;
}

async function approversFor(tenantId: string, actor: ActorContext): Promise<string[]> {
  const approvatori = await repo.findApproversInTenant(pool, tenantId, actor.userId);
  if (approvatori.length === 0) {
    throw new ConflictError(
      "Nessun altro utente puo' approvare: manca chi detiene user_position_assignment:update in questo tenant",
      "POSITION_ASSIGNMENT_NO_APPROVER",
    );
  }
  return approvatori;
}

export const userPositionAssignmentsService = {
  async list(actor: ActorContext, query: UserPositionAssignmentListQuery) {
    const tenantId = isPlatform(actor) ? undefined : tenantOf(actor);
    const res = await repo.listAssignments(pool, { ...(tenantId ? { tenantId } : {}), query });
    return { items: res.items, total: res.total, limit: query.limit, offset: query.offset };
  },

  async get(actor: ActorContext, id: string) {
    const row = await repo.findAssignmentById(pool, id);
    if (!row || (!isPlatform(actor) && row.tenantId !== tenantOf(actor))) {
      throw new NotFoundError("Assegnazione non trovata", "ASSIGNMENT_NOT_FOUND");
    }
    return row;
  },

  /** Propone una nuova assegnazione (nessuna riga preesistente). */
  async proposeAssign(actor: ActorContext, body: AssignPositionBody) {
    const tenantId = tenantOf(actor);
    const posizioneTenant = await repo.findPositionTenant(pool, body.positionId);
    if (!posizioneTenant || posizioneTenant !== tenantId) {
      throw new NotFoundError("Posizione non trovata", "POSITION_NOT_FOUND");
    }
    const approvatori = await approversFor(tenantId, actor);
    const richiesta = await approvalService.createRequest(actor, {
      title: `Assegnazione — persona → posizione (dal ${body.startDate})`,
      body: body.notes ?? null,
      resourceType: USER_POSITION_ASSIGNMENT,
      decisionPolicy: "ANY_OF",
      priority: "MEDIUM",
      approverUserIds: approvatori,
      metadata: {
        action: "ASSIGN",
        userId: body.userId,
        positionId: body.positionId,
        kind: body.kind,
        fte: body.fte,
        startDate: body.startDate,
        notes: body.notes ?? null,
      },
    });
    // Principio gerarchia-livelli (#265): cosa succederebbe all'organigramma se la proposta fosse approvata. Avvisa, non blocca.
    const avvisiGerarchiaLivelli = await avvisiDiUnaAssegnazione(tenantId, { userId: body.userId, positionId: body.positionId });
    return { approvalRequestId: richiesta.approvalRequestId, status: richiesta.status, action: "ASSIGN" as const, avvisiGerarchiaLivelli };
  },

  /** Propone la chiusura dell'intervallo (I1: mai una DELETE). */
  async proposeTerminate(actor: ActorContext, id: string, body: TerminatePositionAssignmentBody) {
    const tenantId = tenantOf(actor);
    const riga = await repo.findAssignmentById(pool, id);
    if (!riga || riga.tenantId !== tenantId) throw new NotFoundError("Assegnazione non trovata", "ASSIGNMENT_NOT_FOUND");
    const approvatori = await approversFor(tenantId, actor);
    const richiesta = await approvalService.createRequest(actor, {
      title: `Termine incarico — ${riga.userDisplayName ?? riga.userId} (al ${body.endDate})`,
      body: body.notes ?? null,
      resourceType: USER_POSITION_ASSIGNMENT,
      resourceId: riga.assignmentId,
      decisionPolicy: "ANY_OF",
      priority: "MEDIUM",
      approverUserIds: approvatori,
      metadata: { action: "TERMINATE", assignmentId: riga.assignmentId, endDate: body.endDate, notes: body.notes ?? null },
    });
    // Terminare un incarico non può introdurre un livello più alto sotto uno più basso: nessun avviso da calcolare.
    return { approvalRequestId: richiesta.approvalRequestId, status: richiesta.status, action: "TERMINATE" as const, avvisiGerarchiaLivelli: [] };
  },

  /** Propone: termina la riga corrente, apre la nuova (kind/fte ereditati dalla riga corrente). */
  async proposeTransfer(actor: ActorContext, id: string, body: TransferPositionAssignmentBody) {
    const tenantId = tenantOf(actor);
    const riga = await repo.findAssignmentById(pool, id);
    if (!riga || riga.tenantId !== tenantId) throw new NotFoundError("Assegnazione non trovata", "ASSIGNMENT_NOT_FOUND");
    const posizioneTenant = await repo.findPositionTenant(pool, body.newPositionId);
    if (!posizioneTenant || posizioneTenant !== tenantId) {
      throw new NotFoundError("Posizione non trovata", "POSITION_NOT_FOUND");
    }
    const approvatori = await approversFor(tenantId, actor);
    const richiesta = await approvalService.createRequest(actor, {
      title: `Trasferimento — ${riga.userDisplayName ?? riga.userId} (dal ${body.startDate})`,
      body: body.notes ?? null,
      resourceType: USER_POSITION_ASSIGNMENT,
      resourceId: riga.assignmentId,
      decisionPolicy: "ANY_OF",
      priority: "MEDIUM",
      approverUserIds: approvatori,
      metadata: {
        action: "TRANSFER",
        assignmentId: riga.assignmentId,
        newPositionId: body.newPositionId,
        startDate: body.startDate,
        notes: body.notes ?? null,
      },
    });
    const avvisiGerarchiaLivelli = await avvisiDiUnaAssegnazione(tenantId, { userId: riga.userId, positionId: body.newPositionId, trasferimento: true });
    return { approvalRequestId: richiesta.approvalRequestId, status: richiesta.status, action: "TRANSFER" as const, avvisiGerarchiaLivelli };
  },
};
