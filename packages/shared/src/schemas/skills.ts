/**
 * packages/shared/src/schemas/skills.ts
 * Schemas for /v1/skills/* (sys.sys_skills).
 *
 * Skill records may be tenant-scoped (skill_tenant_id != NULL) or "global"
 * (skill_is_global = true, often skill_tenant_id NULL). The service
 * enforces visibility: a tenant-scoped skill is only visible to that tenant
 * (and PLATFORM_ADMIN); global skills are visible to all authenticated.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
import { queryBoolean } from "./_query-boolean.js";
export const SkillSchema = z.object({
  skillId: z.uuid(),
  tenantId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  escoUri: z.string().nullable(),
  isGlobal: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const SkillListQuerySchema = z.object({
  isGlobal: queryBoolean().optional(),
  categoryId: z.uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type SkillListQuery = z.infer<typeof SkillListQuerySchema>;

export const SkillListResponseSchema = z.object({
  items: z.array(SkillSchema),
  total: z.number().int().min(0),
});

export const CreateSkillBodySchema = z.object({
  code: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  description: z.string().max(2048).nullable().optional(),
  /**
   * Force creation as a global (cross-tenant) skill. Only PLATFORM_ADMIN
   * may set this true; the service forces false for other actors.
   */
  isGlobal: z.boolean().optional().default(false),
  categoryId: z.uuid().nullable().optional(),
  escoUri: z.string().max(1024).nullable().optional(),
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSkillBody = z.infer<typeof CreateSkillBodySchema>;

export const UpdateSkillBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2048).nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  escoUri: z.string().max(1024).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSkillBody = z.infer<typeof UpdateSkillBodySchema>;

export const SkillIdParamSchema = z.object({ id: z.uuid() });

/* ─────────────────────────────────────────────────────────────────────────────
 * IL GRAFO DELLE COMPETENZE — #50 F2 (S1083)
 *
 * ⚠ Il grafo ha DUE famiglie di arco, e servirne una sola sarebbe falso: misurato
 * il 2026-08-28, 4.464 competenze su 14.033 (31,8%) non hanno alcun arco esplicito,
 * ma 4.383 di esse (98,2%) hanno un gruppo ESCO con un padre. Non sono isolate
 * nella tassonomia — lo sono nel solo grafo competenza→competenza. Per questo
 * `includeGroups` vale `true` di default: il difetto da evitare e' il grafo che
 * sembra bucato. Effetto misurato: 18.420 archi -> 32.703.
 * ───────────────────────────────────────────────────────────────────────────── */

export const SkillGraphQuerySchema = z.object({
  /** Ancoraggio: da quale competenza (o gruppo) partire. Assente = tutto il catalogo. */
  root: z.uuid().optional(),
  /** Quanti salti dall'ancoraggio. Senza un limite l'ancoraggio non servirebbe. */
  depth: z.coerce.number().int().min(1).max(6).optional().default(2),
  /** Filtra i tipi di arco ESPLICITO. Assente = tutti. */
  kinds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : v.split(","))),
  /**
   * Accende gli archi di APPARTENENZA (competenza→gruppo, gruppo→padre).
   *
   * ⚠ NON `z.coerce.boolean()`: `Boolean("false")` vale **true**, quindi
   * `?includeGroups=false` accendeva i gruppi invece di spegnerli — e il test
   * «spegnerli ne toglie» lo ha colto, mentre leggere il codice non lo avrebbe
   * fatto. In una query string il booleano arriva come testo e va letto come tale.
   */
  includeGroups: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(true)
    .transform((v) => (typeof v === "boolean" ? v : !/^(false|0|no)$/i.test(v.trim()))),
});
export type SkillGraphQuery = z.infer<typeof SkillGraphQuerySchema>;

export const SkillGraphNodeSchema = z.object({
  id: z.uuid(),
  /** Due specie, dichiarate: chi disegna non deve indovinare quale sta guardando. */
  kind: z.enum(["SKILL", "GROUP"]),
  label: z.string(),
  code: z.string().nullable(),
  tenantId: z.uuid().nullable(),
  isEsco: z.boolean(),
});
export type SkillGraphNode = z.infer<typeof SkillGraphNodeSchema>;

export const SkillGraphEdgeSchema = z.object({
  source: z.uuid(),
  target: z.uuid(),
  kind: z.string(),
  /** EXPLICIT = sys_skill_taxonomy_edges · GROUP = appartenenza alla tassonomia ESCO. */
  family: z.enum(["EXPLICIT", "GROUP"]),
  /** La fonte dichiarata, quando c'e': gli 11.964 archi RELATED non ne portano alcuna. */
  source_ref: z.string().nullable(),
});
export type SkillGraphEdge = z.infer<typeof SkillGraphEdgeSchema>;

export const SkillGraphResponseSchema = z.object({
  nodes: z.array(SkillGraphNodeSchema),
  edges: z.array(SkillGraphEdgeSchema),
  /** I conteggi si misurano a ogni chiamata: non sono un dato da ricordare. */
  counts: z.object({
    nodes: z.number().int(),
    edges: z.number().int(),
    explicitEdges: z.number().int(),
    groupEdges: z.number().int(),
  }),
});
export type SkillGraphResponse = z.infer<typeof SkillGraphResponseSchema>;
