/**
 * packages/shared/src/schemas/agent-capabilities.ts — ADR-0053 (A1, A3, D4), ADR-0056 D2,
 * piano dei principi agentici voce T3c.
 *
 * Il registro delle capacità degli agenti (migrazione 000480) visto dall'API:
 *   · la piattaforma (`PLATFORM_ADMIN`) scrive il catalogo: crea una capacità in bozza, ne
 *     dichiara le operazioni, la pubblica, la ritira;
 *   · il Direttore HR del tenant (`HRMS_MANAGER`) decide il modo per il suo tenant;
 *   · la piattaforma può solo riportare una capacità a `CONFERMA` (l'interruttore, ADR-0053 D4).
 *
 * Un agente non decide mai il proprio modo: le rotte di scrittura rifiutano un gettone d'agente.
 */
import { z } from "zod";

export const AGENT_CAPABILITY_STATUS_VALUES = ["BOZZA", "PUBBLICATA", "RITIRATA"] as const;
export const AgentCapabilityStatusSchema = z.enum(AGENT_CAPABILITY_STATUS_VALUES);
export type AgentCapabilityStatus = z.infer<typeof AgentCapabilityStatusSchema>;

export const AGENT_CAPABILITY_MODE_VALUES = ["CONFERMA", "LIBERA"] as const;
export const AgentCapabilityModeSchema = z.enum(AGENT_CAPABILITY_MODE_VALUES);
export type AgentCapabilityMode = z.infer<typeof AgentCapabilityModeSchema>;

export const AGENT_UNDO_MECHANISM_VALUES = ["GIORNALE_UNDO", "RIGA_SOSTITUTIVA"] as const;
export const AgentUndoMechanismSchema = z.enum(AGENT_UNDO_MECHANISM_VALUES);

export const AGENT_ACTION_CLASS_VALUES = ["A", "B", "C"] as const;
export const AgentActionClassSchema = z.enum(AGENT_ACTION_CLASS_VALUES);

export const AGENT_HTTP_METHOD_VALUES = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const AgentHttpMethodSchema = z.enum(AGENT_HTTP_METHOD_VALUES);

/** I codici d'errore propri del registro. */
export const AGENT_CAPABILITY_ERRORS = {
  /** Un gettone d'agente non decide il modo di un agente, né scrive il catalogo. */
  AGENT_CANNOT_DECIDE: "AGENT_CANNOT_DECIDE",
  /** La piattaforma può solo riportare a `CONFERMA`, mai liberare (ADR-0053 D4). */
  PLATFORM_ONLY_CONFERMA: "PLATFORM_ONLY_CONFERMA",
  /**
   * `LIBERA` chiede il registro «per conto di» (ADR-0053 D2 punto 3, passo A2), che nasce con la
   * voce T5 del piano: finché non c'è, nessuna capacità si libera.
   */
  ONBEHALF_REGISTER_MISSING: "AGENT_ONBEHALF_REGISTER_MISSING",
  /** Il database ha rifiutato il cambiamento (bozza chiusa, classe, condizioni previe). */
  CAPABILITY_RULE: "AGENT_CAPABILITY_RULE",
  /** Una capacità in bozza non ha ancora un modo da decidere. */
  CAPABILITY_NOT_PUBLISHED: "AGENT_CAPABILITY_NOT_PUBLISHED",
  /** La stessa coppia codice e versione, o la stessa operazione, esiste già. */
  CAPABILITY_DUPLICATE: "AGENT_CAPABILITY_DUPLICATE",
} as const;

const CODE = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/).max(100);

export const AgentCapabilityOperationSchema = z.object({
  id: z.uuid(),
  conceptId: z.string(),
  operationId: z.string(),
  httpMethod: AgentHttpMethodSchema,
  actionClass: AgentActionClassSchema,
});
export type AgentCapabilityOperation = z.infer<typeof AgentCapabilityOperationSchema>;

export const AgentCapabilityActivationSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  mode: AgentCapabilityModeSchema,
  source: z.enum(["PERSONA", "AUTOMATICO"]),
  reason: z.string(),
  decidedBy: z.uuid().nullable(),
  decidedAt: z.string(),
});
export type AgentCapabilityActivation = z.infer<typeof AgentCapabilityActivationSchema>;

export const AgentCapabilitySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  version: z.number().int(),
  agentCode: z.string(),
  description: z.string(),
  dataGroups: z.array(z.string()),
  excludedGroups: z.array(z.string()),
  undoMechanism: AgentUndoMechanismSchema,
  undoRef: z.string(),
  volumeCap: z.number().int(),
  status: AgentCapabilityStatusSchema,
  publishedAt: z.string().nullable(),
  operations: z.array(AgentCapabilityOperationSchema),
  /** Il modo in vigore per il tenant di chi legge; `null` = mai deciso, cioè `CONFERMA`. */
  activation: AgentCapabilityActivationSchema.nullable(),
});
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const AgentCapabilityListResponseSchema = z.object({ items: z.array(AgentCapabilitySchema) });

export const CreateAgentCapabilityBodySchema = z.object({
  code: CODE,
  agentCode: z.string().min(1).max(64),
  description: z.string().min(1).max(2000),
  dataGroups: z.array(z.string().min(1).max(64)).max(20).default([]),
  excludedGroups: z.array(z.string().min(1).max(64)).max(20).default([]),
  undoMechanism: AgentUndoMechanismSchema,
  undoRef: z.string().min(1).max(300),
  volumeCap: z.number().int().min(1).max(10_000),
});
export type CreateAgentCapabilityBody = z.infer<typeof CreateAgentCapabilityBodySchema>;

export const AddAgentCapabilityOperationBodySchema = z.object({
  conceptId: z.string().min(1).max(200),
  operationId: z.string().min(1).max(200),
  httpMethod: AgentHttpMethodSchema,
  actionClass: AgentActionClassSchema,
});
export type AddAgentCapabilityOperationBody = z.infer<typeof AddAgentCapabilityOperationBodySchema>;

export const DecideAgentCapabilityModeBodySchema = z.object({
  mode: AgentCapabilityModeSchema,
  reason: z.string().trim().min(3).max(2000),
  /** Solo la piattaforma: il tenant da riportare a `CONFERMA`. Il Direttore decide per il suo. */
  tenantId: z.uuid().optional(),
  noticeRef: z.string().max(300).optional(),
  rollbackProofRef: z.string().max(500).optional(),
});
export type DecideAgentCapabilityModeBody = z.infer<typeof DecideAgentCapabilityModeBodySchema>;

export const AgentCapabilityIdParamSchema = z.object({ id: z.uuid() });
