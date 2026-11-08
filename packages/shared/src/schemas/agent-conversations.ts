/**
 * packages/shared/src/schemas/agent-conversations.ts — ADR-0056 D4, piano dei principi agentici
 * voce T6a.
 *
 * Le conversazioni dell'assistente (migrazione 000483) viste dall'API. Una conversazione è della
 * persona che l'ha aperta: la leggono e la scrivono solo lei e l'assistente per conto suo (il
 * gettone d'agente porta lo stesso `userId`). Una proposta la decide solo la persona: un gettone
 * d'agente non approva le proprie proposte.
 *
 * Due stati non si scrivono mai, si leggono: una proposta oltre la scadenza è `SCADUTA`, un'attività
 * aperta più vecchia di `AGENT_ACTIVITY_STALE_MINUTES` è `INTERROTTA`.
 */
import { z } from "zod";
import { AgentActionClassSchema } from "./agent-capabilities.js";

/** Oltre questa età un'attività ancora aperta si legge interrotta (il gateway si ferma prima). */
export const AGENT_ACTIVITY_STALE_MINUTES = 30;

export const AGENT_ACTIVITY_STATUS_VALUES = ["IN_CORSO", "IN_ATTESA", "FATTA", "FALLITA", "INTERROTTA"] as const;
export const AgentActivityStatusSchema = z.enum(AGENT_ACTIVITY_STATUS_VALUES);
export type AgentActivityStatus = z.infer<typeof AgentActivityStatusSchema>;

export const AGENT_ACTIVITY_STOP_VALUES = ["DURATA", "GETTONE", "GIRI", "ERRORE", "PERSONA"] as const;
export const AgentActivityStopReasonSchema = z.enum(AGENT_ACTIVITY_STOP_VALUES);
export type AgentActivityStopReason = z.infer<typeof AgentActivityStopReasonSchema>;

export const AGENT_ACTIVITY_EVENT_KIND_VALUES = ["TESTO", "STRUMENTO", "PROPOSTA", "LIMITE", "ERRORE", "FINE"] as const;
export const AgentActivityEventKindSchema = z.enum(AGENT_ACTIVITY_EVENT_KIND_VALUES);
export type AgentActivityEventKind = z.infer<typeof AgentActivityEventKindSchema>;

export const AGENT_PROPOSAL_KIND_VALUES = ["SCRITTURA", "LETTURA"] as const;
export const AgentProposalKindSchema = z.enum(AGENT_PROPOSAL_KIND_VALUES);

/** `SCADUTA` non si scrive: è una proposta in attesa oltre la sua scadenza. */
export const AGENT_PROPOSAL_STATUS_VALUES = ["IN_ATTESA", "APPROVATA", "SCARTATA", "SCADUTA"] as const;
export const AgentProposalStatusSchema = z.enum(AGENT_PROPOSAL_STATUS_VALUES);
export type AgentProposalStatus = z.infer<typeof AgentProposalStatusSchema>;

/** I codici d'errore propri delle conversazioni. */
export const AGENT_CONVERSATION_ERRORS = {
  /** Una persona senza tenant non ha dove tenere una conversazione. */
  NO_TENANT: "AGENT_CONVERSATION_NO_TENANT",
  /** Un gettone d'agente non decide le proposte dell'agente. */
  AGENT_CANNOT_DECIDE: "AGENT_CANNOT_DECIDE",
  /** Scartare una proposta chiede un motivo (ADR-0056 D4). */
  REJECT_REASON_REQUIRED: "AGENT_PROPOSAL_REJECT_REASON_REQUIRED",
  /** La proposta è già stata decisa. */
  PROPOSAL_NOT_PENDING: "AGENT_PROPOSAL_NOT_PENDING",
  /** La proposta è oltre la sua scadenza: non si decide più. */
  PROPOSAL_EXPIRED: "AGENT_PROPOSAL_EXPIRED",
  /** L'attività è chiusa: non riceve eventi, proposte né un altro stato. */
  ACTIVITY_CLOSED: "AGENT_ACTIVITY_CLOSED",
  /** Il database ha rifiutato la riga (forma, misura, scadenza). */
  RULE: "AGENT_CONVERSATION_RULE",
} as const;

const SHA256 = z.string().regex(/^[0-9a-f]{64}$/);
const AGENT_CODE = z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(64);
const PAYLOAD = z.record(z.string(), z.unknown());

export const AgentActivitySchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  prompt: z.string(),
  status: AgentActivityStatusSchema,
  stopReason: AgentActivityStopReasonSchema.nullable(),
  result: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  /** Le proposte ancora in attesa della persona (non scadute). */
  pendingProposals: z.number().int(),
});
export type AgentActivity = z.infer<typeof AgentActivitySchema>;

export const AgentConversationSummarySchema = z.object({
  id: z.uuid(),
  agentCode: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Lo stato dell'ultima attività, `null` se non ce n'è ancora una. */
  lastActivityStatus: AgentActivityStatusSchema.nullable(),
});
export type AgentConversationSummary = z.infer<typeof AgentConversationSummarySchema>;

export const AgentConversationSchema = AgentConversationSummarySchema.extend({
  sdkSessionRef: z.string().nullable(),
  /** Impronte SHA-256 delle persone già lette (ADR-0040 §4b): il contatore riparte da qui. */
  personsSeen: z.array(SHA256),
  activities: z.array(AgentActivitySchema),
});
export type AgentConversation = z.infer<typeof AgentConversationSchema>;

export const AgentConversationListResponseSchema = z.object({ items: z.array(AgentConversationSummarySchema) });

export const AgentActivityEventSchema = z.object({
  seq: z.number().int(),
  kind: AgentActivityEventKindSchema,
  payload: PAYLOAD,
  createdAt: z.string(),
});
export type AgentActivityEvent = z.infer<typeof AgentActivityEventSchema>;

export const AgentProposalSchema = z.object({
  id: z.uuid(),
  activityId: z.uuid(),
  kind: AgentProposalKindSchema,
  tool: z.string(),
  input: z.unknown(),
  actionClass: AgentActionClassSchema.nullable(),
  personsCount: z.number().int().nullable(),
  status: AgentProposalStatusSchema,
  rejectReason: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type AgentProposal = z.infer<typeof AgentProposalSchema>;

export const AgentActivityEventsResponseSchema = z.object({
  activity: AgentActivitySchema,
  events: z.array(AgentActivityEventSchema),
  proposals: z.array(AgentProposalSchema),
});
export type AgentActivityEventsResponse = z.infer<typeof AgentActivityEventsResponseSchema>;

export const CreateAgentConversationBodySchema = z.object({
  agentCode: AGENT_CODE,
  title: z.string().trim().min(1).max(200),
});
export type CreateAgentConversationBody = z.infer<typeof CreateAgentConversationBodySchema>;

export const UpdateAgentConversationBodySchema = z.object({
  sdkSessionRef: z.string().min(1).max(100).optional(),
  /** Si aggiungono a quelle già salvate: l'insieme cresce e non si accorcia. */
  personsSeen: z.array(SHA256).max(5000).optional(),
});
export type UpdateAgentConversationBody = z.infer<typeof UpdateAgentConversationBodySchema>;

export const CreateAgentActivityBodySchema = z.object({
  prompt: z.string().trim().min(1).max(20_000),
});
export type CreateAgentActivityBody = z.infer<typeof CreateAgentActivityBodySchema>;

export const UpdateAgentActivityBodySchema = z.object({
  status: AgentActivityStatusSchema,
  stopReason: AgentActivityStopReasonSchema.optional(),
  result: z.string().max(20_000).optional(),
});
export type UpdateAgentActivityBody = z.infer<typeof UpdateAgentActivityBodySchema>;

export const AppendAgentActivityEventBodySchema = z.object({
  kind: AgentActivityEventKindSchema,
  payload: PAYLOAD,
});
export type AppendAgentActivityEventBody = z.infer<typeof AppendAgentActivityEventBodySchema>;

export const AppendAgentActivityEventResponseSchema = z.object({ seq: z.number().int() });

export const AgentActivityEventsQuerySchema = z.object({
  /** Solo gli eventi dopo questo numero (0 = tutti). */
  after: z.coerce.number().int().min(0).default(0),
});

export const CreateAgentProposalBodySchema = z.object({
  /** L'identificativo che il gateway ha già mandato alla finestra. */
  proposalId: z.uuid(),
  kind: AgentProposalKindSchema,
  tool: z.string().min(1).max(120),
  input: z.unknown(),
  actionClass: AgentActionClassSchema.optional(),
  personsCount: z.number().int().min(0).optional(),
  expiresAt: z.iso.datetime({ offset: true }),
});
export type CreateAgentProposalBody = z.infer<typeof CreateAgentProposalBodySchema>;

export const DecideAgentProposalBodySchema = z.object({
  decision: z.enum(["APPROVATA", "SCARTATA"]),
  /** Obbligatorio quando si scarta. */
  reason: z.string().trim().min(1).max(2000).optional(),
});
export type DecideAgentProposalBody = z.infer<typeof DecideAgentProposalBodySchema>;

export const AgentConversationIdParamSchema = z.object({ id: z.uuid() });
export const AgentActivityIdParamSchema = z.object({ activityId: z.uuid() });
export const AgentProposalIdParamSchema = z.object({ proposalId: z.uuid() });
