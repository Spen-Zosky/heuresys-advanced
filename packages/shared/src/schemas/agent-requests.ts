/**
 * packages/shared/src/schemas/agent-requests.ts — tappa T2, migrazione 000501.
 *
 * Le richieste dell'agente con previsione di spesa e il registro di costo e durata delle sue
 * chiamate. Il cancello è lo stesso che la console del datastore ha già collaudato: ogni richiesta
 * porta la previsione e un tetto, la previsione non supera il tetto, il tetto non supera il massimo
 * del servizio, e la richiesta aspetta un sì o un no. Rifiutare chiede un motivo.
 */
import { z } from "zod";

/** Il tetto massimo che una richiesta può chiedere, in dollari; il servizio può abbassarlo con l'ambiente. */
export const AGENT_REQUEST_MAX_CAP_USD = 10;

export const AGENT_REQUEST_STATUS_VALUES = ["IN_ATTESA", "ACCETTATA", "RIFIUTATA"] as const;
export const AgentRequestStatusSchema = z.enum(AGENT_REQUEST_STATUS_VALUES);
export type AgentRequestStatus = z.infer<typeof AgentRequestStatusSchema>;

export const AGENT_CALL_OUTCOME_VALUES = ["OK", "ERRORE", "LIMITE"] as const;
export const AgentCallOutcomeSchema = z.enum(AGENT_CALL_OUTCOME_VALUES);

/** I codici d'errore propri delle richieste dell'agente. */
export const AGENT_REQUEST_ERRORS = {
  NO_TENANT: "AGENT_REQUEST_NO_TENANT",
  /** La previsione supera il tetto: la richiesta non nasce. */
  ESTIMATE_OVER_CAP: "AGENT_REQUEST_ESTIMATE_OVER_CAP",
  /** Il tetto supera il massimo ammesso dal servizio. */
  CAP_OVER_MAX: "AGENT_REQUEST_CAP_OVER_MAX",
  /** Un gettone d'agente non decide le richieste dell'agente. */
  AGENT_CANNOT_DECIDE: "AGENT_REQUEST_AGENT_CANNOT_DECIDE",
  REJECT_REASON_REQUIRED: "AGENT_REQUEST_REJECT_REASON_REQUIRED",
  NOT_PENDING: "AGENT_REQUEST_NOT_PENDING",
  /** Una chiamata la registra solo il gettone dell'agente: una persona o un altro mezzo non la scrivono. */
  CALL_AGENT_ONLY: "AGENT_CALL_AGENT_ONLY",
  /** Il codice dell'agente nel corpo non è quello del gettone. */
  CALL_AGENT_MISMATCH: "AGENT_CALL_AGENT_MISMATCH",
  /** Il costo di una chiamata supera il tetto della richiesta a cui si lega. */
  CALL_OVER_REQUEST_CAP: "AGENT_CALL_OVER_REQUEST_CAP",
} as const;

/** I limiti di una riga del registro: oltre, il numero non è di una chiamata vera. */
export const AGENT_CALL_LIMITS = {
  maxDurationMs: 6 * 3_600_000,
  maxTokens: 20_000_000,
  maxCostUsd: AGENT_REQUEST_MAX_CAP_USD,
} as const;

const AGENT_CODE = z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(64);
/** Dollari con al più quattro decimali, come la colonna `numeric(10,4)`. */
const USD = z.number().positive().max(999999).multipleOf(0.0001);

export const AgentRequestSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  requesterId: z.uuid().nullable(),
  /** «Cognome, Nome» di chi ha chiesto, se la persona esiste ancora. */
  requesterName: z.string().nullable(),
  agentCode: z.string(),
  title: z.string(),
  body: z.string(),
  perimeter: z.string(),
  estimateUsd: z.number(),
  capUsd: z.number(),
  status: AgentRequestStatusSchema,
  rejectReason: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export const AgentRequestListQuerySchema = z.object({
  status: AgentRequestStatusSchema.optional(),
  /** Solo per chi ha `agent_request:read:all`: la coda di tutti i tenant invece della propria. */
  scope: z.enum(["own", "all"]).default("own"),
});
export type AgentRequestListQuery = z.infer<typeof AgentRequestListQuerySchema>;

export const AgentRequestListResponseSchema = z.object({
  items: z.array(AgentRequestSchema),
  /** Il tetto massimo che il servizio ammette per una richiesta. */
  maxCapUsd: z.number(),
});
export type AgentRequestListResponse = z.infer<typeof AgentRequestListResponseSchema>;

export const AgentRequestIdParamSchema = z.object({ id: z.uuid() });

export const CreateAgentRequestBodySchema = z.object({
  agentCode: AGENT_CODE,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(100000),
  perimeter: z.string().trim().min(1).max(200),
  estimateUsd: USD,
  capUsd: USD,
});
export type CreateAgentRequestBody = z.infer<typeof CreateAgentRequestBodySchema>;

export const DecideAgentRequestBodySchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("ACCETTA") }),
  z.object({ decision: z.literal("RIFIUTA"), reason: z.string().trim().min(1).max(2000) }),
]);
export type DecideAgentRequestBody = z.infer<typeof DecideAgentRequestBodySchema>;

export const CreateAgentCallBodySchema = z.object({
  agentCode: AGENT_CODE,
  model: z.string().trim().min(1).max(80),
  outcome: AgentCallOutcomeSchema,
  durationMs: z.number().int().min(0).max(AGENT_CALL_LIMITS.maxDurationMs),
  inputTokens: z.number().int().min(0).max(AGENT_CALL_LIMITS.maxTokens).default(0),
  outputTokens: z.number().int().min(0).max(AGENT_CALL_LIMITS.maxTokens).default(0),
  costUsd: z.number().min(0).max(AGENT_CALL_LIMITS.maxCostUsd).multipleOf(0.0001).default(0),
  requestId: z.uuid().optional(),
});
export type CreateAgentCallBody = z.infer<typeof CreateAgentCallBodySchema>;

export const AgentCallSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  agentCode: z.string(),
  model: z.string(),
  outcome: AgentCallOutcomeSchema,
  durationMs: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number(),
  requestId: z.uuid().nullable(),
  createdAt: z.string(),
});
export type AgentCall = z.infer<typeof AgentCallSchema>;

export const AgentCallListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const AgentCallListResponseSchema = z.object({
  items: z.array(AgentCallSchema),
  /** Totali sulle righe elencate. */
  totals: z.object({ calls: z.number().int(), costUsd: z.number(), durationMs: z.number().int() }),
});
export type AgentCallListResponse = z.infer<typeof AgentCallListResponseSchema>;
