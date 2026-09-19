/**
 * @heuresys/shared — user-position-assignments schemas. Mandato K, G-1 (D4=B, F6).
 *
 * Il gesto "assegna / termina / trasferisci" persona↔posizione nasce come PROPOSTA sotto il
 * modulo approvazioni (approvals/effects/position-assignment.ts): queste rotte creano SOLO una
 * `sys.sys_approval_requests`, mai una riga di `sys.sys_user_position_assignments` — quella la
 * scrive l'effetto, alla sola approvazione. I1 impone la storia: terminare un incarico chiude
 * un intervallo (`end_date`), non cancella la riga; non esiste quindi una DELETE.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

export const UserPositionAssignmentKindEnum = z.enum(["PRIMARY", "SECONDARY", "INTERIM", "ACTING"]);
export const UserPositionAssignmentStatusEnum = z.enum(["ACTIVE", "ENDED"]);

export const UserPositionAssignmentSchema = z.object({
  assignmentId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  userDisplayName: z.string().nullable(),
  positionId: z.uuid(),
  positionTitle: z.string().nullable(),
  kind: z.string(),
  fte: z.number(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  status: z.string(),
  notes: z.string().nullable(),
  origineDato: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserPositionAssignment = z.infer<typeof UserPositionAssignmentSchema>;

export const UserPositionAssignmentIdParamSchema = z.object({ id: z.uuid() });

export const UserPositionAssignmentListQuerySchema = z.object({
  userId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  status: UserPositionAssignmentStatusEnum.optional(),
  ...paginationFields(200, 50),
});
export type UserPositionAssignmentListQuery = z.infer<typeof UserPositionAssignmentListQuerySchema>;

export const UserPositionAssignmentListResponseSchema = z.object({
  items: z.array(UserPositionAssignmentSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});
export type UserPositionAssignmentListResponse = z.infer<typeof UserPositionAssignmentListResponseSchema>;

/** POST /v1/user-position-assignments — propone una nuova assegnazione (nessuna preesistente). */
export const AssignPositionBodySchema = z.object({
  userId: z.uuid(),
  positionId: z.uuid(),
  kind: UserPositionAssignmentKindEnum.optional().default("PRIMARY"),
  fte: z.number().min(0.01).max(1).optional().default(1),
  startDate: z.string(),
  notes: z.string().max(2000).nullable().optional(),
});
export type AssignPositionBody = z.infer<typeof AssignPositionBodySchema>;

/** POST /v1/user-position-assignments/:id/terminate — propone la chiusura dell'intervallo. */
export const TerminatePositionAssignmentBodySchema = z.object({
  endDate: z.string(),
  notes: z.string().max(2000).nullable().optional(),
});
export type TerminatePositionAssignmentBody = z.infer<typeof TerminatePositionAssignmentBodySchema>;

/** POST /v1/user-position-assignments/:id/transfer — propone: termina la riga corrente, apre la nuova. */
export const TransferPositionAssignmentBodySchema = z.object({
  newPositionId: z.uuid(),
  startDate: z.string(),
  notes: z.string().max(2000).nullable().optional(),
});
export type TransferPositionAssignmentBody = z.infer<typeof TransferPositionAssignmentBodySchema>;

export const PositionAssignmentProposalSubmittedSchema = z.object({
  approvalRequestId: z.uuid(),
  status: z.string(),
  action: z.enum(["ASSIGN", "TERMINATE", "TRANSFER"]),
});
export type PositionAssignmentProposalSubmitted = z.infer<typeof PositionAssignmentProposalSubmittedSchema>;
