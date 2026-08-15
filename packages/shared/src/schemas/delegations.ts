/**
 * packages/shared/src/schemas/delegations.ts
 *
 * Le deleghe — il quarto dominio funzionale di ADR-0036 (#99 F6b).
 *
 * Una delega dice che, in una finestra di tempo e per un ambito dichiarato, una persona
 * agisce al posto di un'altra. È l'istituto che mancava: prima di `000314` il dominio
 * `delegation` era dichiarato dall'ADR e non poteva accendersi, perché nessuna tabella lo
 * definiva.
 */

import { z } from "zod";
import { paginationFields } from "./_pagination.js";

/**
 * L'ambito: una delega non è un assegno in bianco.
 *
 * `APPROVALS` è il caso reale (757 passi di approvazione, 29 approvatori). `FULL` esiste
 * nel vincolo del database ma **nessun endpoint lo concede**: c'è perché il giorno che
 * servirà sarà una riga di codice e non una migrazione.
 */
export const DELEGATION_SCOPE_VALUES = ["APPROVALS", "FULL"] as const;
export const DelegationScopeSchema = z.enum(DELEGATION_SCOPE_VALUES);
export type DelegationScope = z.infer<typeof DelegationScopeSchema>;

/** Lo stato è un ATTO registrato, non una deduzione dalle date: «revocata» ≠ «scaduta». */
export const DELEGATION_STATUS_VALUES = ["ACTIVE", "REVOKED"] as const;
export const DelegationStatusSchema = z.enum(DELEGATION_STATUS_VALUES);
export type DelegationStatus = z.infer<typeof DelegationStatusSchema>;

export const DelegationSchema = z.object({
  delegationId: z.uuid(),
  tenantId: z.uuid(),
  /** Chi conferisce la delega. */
  delegatorUserId: z.uuid(),
  delegatorName: z.string().nullable(),
  /** Chi la riceve — è questa persona ad acquisire il dominio `delegation`. */
  delegateUserId: z.uuid(),
  delegateName: z.string().nullable(),
  scope: DelegationScopeSchema,
  startsOn: z.string(),
  /** `null` = a tempo indeterminato, che è diverso da «scaduta». */
  endsOn: z.string().nullable(),
  status: DelegationStatusSchema,
  reason: z.string().nullable(),
  /** Derivato, non memorizzato: la delega è in vigore ADESSO? */
  isInForce: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Delegation = z.infer<typeof DelegationSchema>;

export const DelegationListQuerySchema = z.object({
  delegateUserId: z.uuid().optional(),
  delegatorUserId: z.uuid().optional(),
  status: DelegationStatusSchema.optional(),
  /** Solo quelle in vigore oggi. */
  inForce: z.coerce.boolean().optional(),
  ...paginationFields(200, 50),
});
export type DelegationListQuery = z.infer<typeof DelegationListQuerySchema>;

export const DelegationListResponseSchema = z.object({
  items: z.array(DelegationSchema),
  total: z.number().int().min(0),
});
export type DelegationListResponse = z.infer<typeof DelegationListResponseSchema>;

export const CreateDelegationBodySchema = z.object({
  delegatorUserId: z.uuid(),
  delegateUserId: z.uuid(),
  scope: DelegationScopeSchema.optional().default("APPROVALS"),
  startsOn: z.string(),
  endsOn: z.string().nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});
export type CreateDelegationBody = z.infer<typeof CreateDelegationBodySchema>;

/** La revoca è l'unica mutazione ammessa dopo la creazione: una delega non si «modifica». */
export const RevokeDelegationBodySchema = z.object({
  reason: z.string().max(500).nullable().optional(),
});
export type RevokeDelegationBody = z.infer<typeof RevokeDelegationBodySchema>;

export const DelegationIdParamSchema = z.object({ id: z.uuid() });

/** GET /v1/me/delegations — quelle che riguardano me, dai due lati (I17). */
export const MeDelegationsResponseSchema = z.object({
  /** Deleghe che ho CONFERITO ad altri. */
  granted: z.array(DelegationSchema),
  /** Deleghe che ho RICEVUTO — quelle che mi danno il dominio. */
  received: z.array(DelegationSchema),
});
export type MeDelegationsResponse = z.infer<typeof MeDelegationsResponseSchema>;
