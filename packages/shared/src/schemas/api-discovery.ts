/**
 * packages/shared/src/schemas/api-discovery.ts — piano interfacce L10, voce A-9.
 *
 * La SCOPERTA delle operazioni dell'API: chi chiama (persona o agente) chiede che cosa l'API sa
 * fare e, per ciascuna operazione, se lui può farla adesso. È letta dalla stessa specifica
 * OpenAPI generata dai contratti Zod (`GET /openapi.json`), non da un elenco scritto a mano.
 */
import { z } from "zod";

/** Estensione OpenAPI con il permesso che l'operazione chiede (assente = nessun permesso). */
export const OPENAPI_PERMISSION_EXTENSION = "x-heuresys-permission";

export const ApiOperationsQuerySchema = z
  .object({
    /** Testo cercato nell'identificativo, nel percorso, nel riassunto o nel permesso. */
    q: z.string().trim().min(1).max(100).optional(),
    /** Solo le operazioni di un'etichetta (il modulo: `employees`, `approvals`, …). */
    tag: z.string().trim().min(1).max(64).optional(),
    /** `true`: solo ciò che chi chiama può fare adesso. */
    allowedOnly: z.enum(["true", "false"]).optional(),
  })
  .strict();
export type ApiOperationsQuery = z.infer<typeof ApiOperationsQuerySchema>;

export const ApiOperationSchema = z.object({
  operationId: z.string(),
  method: z.string(),
  /** Il percorso come nella specifica: `/v1/employees/{id}`. */
  path: z.string(),
  tag: z.string(),
  summary: z.string(),
  /** Il permesso che l'operazione chiede (null = basta essere autenticati, o è pubblica). */
  permission: z.string().nullable(),
  /** Se chi chiama, con i suoi ruoli (e per un agente con il suo gettone), può farla. */
  allowed: z.boolean(),
});
export type ApiOperation = z.infer<typeof ApiOperationSchema>;

export const ApiOperationsResponseSchema = z.object({
  /** La versione della specifica (`info.version`). */
  version: z.string(),
  /** L'impronta della specifica, la stessa dell'`ETag` di `/openapi.json`. */
  specHash: z.string(),
  total: z.number().int(),
  operations: z.array(ApiOperationSchema),
});
export type ApiOperationsResponse = z.infer<typeof ApiOperationsResponseSchema>;
