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
import { queryBoolean } from "./_query-boolean.js";

/**
 * L'ambito: una delega non è un assegno in bianco.
 *
 * `APPROVALS` è il caso reale (757 passi di approvazione, 29 approvatori). `FULL` esiste
 * nel vincolo del database ma **nessun endpoint lo concede**: c'è perché il giorno che
 * servirà sarà una riga di codice e non una migrazione. `CONSOLIDATION` (mig `000465`) è la delega
 * del Direttore HR sul consolidamento del tenant, limitata ai gruppi di `groups`.
 */
export const DELEGATION_SCOPE_VALUES = ["APPROVALS", "FULL", "CONSOLIDATION", "PROCESS_STEP"] as const;
export const DelegationScopeSchema = z.enum(DELEGATION_SCOPE_VALUES);
export type DelegationScope = z.infer<typeof DelegationScopeSchema>;

/**
 * ADR-0051 — il tipo di delega si LEGGE dall'ambito, non si memorizza: APPROVALS e PROCESS_STEP
 * sono deleghe di CATENA (un capo affida una sua attività a una persona della sua catena),
 * CONSOLIDATION e FULL sono deleghe di MANDATO (il Direttore HR, o la piattaforma).
 */
export const CHAIN_DELEGATION_SCOPES = ["APPROVALS", "PROCESS_STEP"] as const;
export const ChainDelegationScopeSchema = z.enum(CHAIN_DELEGATION_SCOPES);
export type ChainDelegationScope = z.infer<typeof ChainDelegationScopeSchema>;
export const DELEGATION_KIND_VALUES = ["CHAIN", "MANDATE"] as const;
export type DelegationKind = (typeof DELEGATION_KIND_VALUES)[number];
export function delegationKindOf(scope: DelegationScope): DelegationKind {
  return (CHAIN_DELEGATION_SCOPES as readonly string[]).includes(scope) ? "CHAIN" : "MANDATE";
}

/**
 * ADR-0051 §3 — i tipi di richiesta che una delega di catena può toccare. Elenco CHIUSO e per
 * inclusione: un tipo nuovo non diventa delegabile da sé. Restano fuori per regola gli adeguamenti
 * retributivi e le valutazioni (classi COMPENSATION ed EVALUATION), e le richieste senza tipo, di
 * cui non si sa che cosa contengano. Chi aggiunge un tipo qui aggiunge anche la sua regola in
 * `requestsConcerning` (repository delle deleghe): senza, ogni richiesta di quel tipo vale come
 * «propria» del delegato e non si decide per delega.
 */
export const DELEGABLE_REQUEST_TYPES = ["TIME_OFF_REQUEST", "TRAINING_INITIATIVE"] as const;
export const DelegableRequestTypeSchema = z.enum(DELEGABLE_REQUEST_TYPES);
export type DelegableRequestType = z.infer<typeof DelegableRequestTypeSchema>;

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
  /** Per una delega CONSOLIDATION, i gruppi di dati su cui il delegato decide; `null` per gli altri. */
  groups: z.array(z.string()).nullable(),
  /** ADR-0051: CHAIN (APPROVALS, PROCESS_STEP) o MANDATE (CONSOLIDATION, FULL), derivato dall'ambito. */
  kind: z.enum(DELEGATION_KIND_VALUES),
  /** Per una delega APPROVALS, il solo tipo di richiesta delegato; `null` = tutti i tipi delegabili. */
  requestType: z.string().nullable(),
  /** Per una delega PROCESS_STEP, l'attività di processo delegata. */
  tenantProcessStepId: z.uuid().nullable(),
  tenantProcessStepName: z.string().nullable(),
  /**
   * ADR-0051 §2 — per una delega di catena: il delegato sta OGGI nella catena del delegante?
   * Se no la delega resta registrata ma non ha effetto («sospesa»). `null` per le deleghe di mandato.
   */
  inChain: z.boolean().nullable(),
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
  inForce: queryBoolean().optional(),
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
  /** Obbligatorio per CONSOLIDATION, vietato per gli altri ambiti (lo controlla anche il CHECK della 000465). */
  groups: z.array(z.enum(["ORGANIZATION", "POSITIONS_ROLES", "SKILLS", "PROCESSES", "INDICATORS_GOALS"])).min(1).max(5).optional(),
  /** Solo per APPROVALS: restringe la delega a un tipo di richiesta (ADR-0051). */
  requestType: DelegableRequestTypeSchema.nullable().optional(),
  /** Obbligatorio per PROCESS_STEP, vietato per gli altri ambiti (CHECK della 000468). */
  tenantProcessStepId: z.uuid().nullable().optional(),
  startsOn: z.string(),
  endsOn: z.string().nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});
export type CreateDelegationBody = z.infer<typeof CreateDelegationBodySchema>;

/**
 * POST /v1/me/delegations — ADR-0051 §4: il capo delega da sé una SUA attività. Il delegante è
 * sempre chi chiama, quindi non sta nel corpo; gli ambiti ammessi sono solo quelli di catena.
 */
export const CreateMyDelegationBodySchema = z.object({
  delegateUserId: z.uuid(),
  scope: ChainDelegationScopeSchema.optional().default("APPROVALS"),
  requestType: DelegableRequestTypeSchema.nullable().optional(),
  tenantProcessStepId: z.uuid().nullable().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});
export type CreateMyDelegationBody = z.infer<typeof CreateMyDelegationBodySchema>;

/** GET /v1/me/delegations/candidates — le persone della mia catena di delega (ADR-0051 §1). */
export const DelegationCandidateSchema = z.object({
  userId: z.uuid(),
  name: z.string().nullable(),
  positionTitle: z.string().nullable(),
  organizationUnitName: z.string().nullable(),
});
export type DelegationCandidate = z.infer<typeof DelegationCandidateSchema>;
export const DelegationCandidatesResponseSchema = z.object({
  items: z.array(DelegationCandidateSchema),
  /** Le attività di processo delle mie unità, delegabili con l'ambito PROCESS_STEP. */
  processSteps: z.array(z.object({
    tenantProcessStepId: z.uuid(),
    name: z.string(),
    processName: z.string().nullable(),
    organizationUnitName: z.string().nullable(),
  })),
});
export type DelegationCandidatesResponse = z.infer<typeof DelegationCandidatesResponseSchema>;

/**
 * GET /v1/me/delegations/approvals — i passi di approvazione che posso decidere PER CONTO DI chi
 * mi ha delegato (ADR-0051 §3 e §5). Solo i tipi delegabili, solo deleghe in vigore e in catena.
 */
export const DelegatedApprovalItemSchema = z.object({
  delegationId: z.uuid(),
  delegatorUserId: z.uuid(),
  delegatorName: z.string().nullable(),
  approvalRequestId: z.uuid(),
  approvalStepId: z.uuid(),
  title: z.string(),
  body: z.string().nullable(),
  resourceType: z.string(),
  priority: z.string(),
  requesterName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type DelegatedApprovalItem = z.infer<typeof DelegatedApprovalItemSchema>;
export const DelegatedApprovalsResponseSchema = z.object({
  items: z.array(DelegatedApprovalItemSchema),
});
export type DelegatedApprovalsResponse = z.infer<typeof DelegatedApprovalsResponseSchema>;
export const DelegatedApprovalParamsSchema = z.object({ requestId: z.uuid(), stepId: z.uuid() });

/**
 * GET /v1/me/delegations/proposals — ADR-0051 §6: l'agente PROPONE, la persona decide. Oggi una
 * sola regola: un'assenza approvata in arrivo mentre ho passi di approvazione aperti.
 */
export const DelegationProposalSchema = z.object({
  motivo: z.enum(["ASSENZA_APPROVATA"]),
  spiegazione: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  pendingApprovals: z.number().int().min(0),
  suggestedDelegateUserId: z.uuid().nullable(),
  suggestedDelegateName: z.string().nullable(),
});
export type DelegationProposal = z.infer<typeof DelegationProposalSchema>;
export const DelegationProposalsResponseSchema = z.object({
  items: z.array(DelegationProposalSchema),
});
export type DelegationProposalsResponse = z.infer<typeof DelegationProposalsResponseSchema>;

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
