/**
 * packages/shared/src/schemas/tenant-processes.ts
 *
 * I processi del tenant (sys_tenant_processes) e la loro scheda strutturata: voce V4 del piano
 * docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md.
 *
 * Un solo lessico (V3): il PROCESSO è del tenant, ha un livello (1 = processo, 2 = sottoprocesso,
 * 000498) e contiene ATTIVITÀ ordinate (sys_tenant_process_steps); le UNITÀ partecipano con un ruolo
 * (OWNER/CONTRIBUTOR/CONSULTED/INFORMED, la RACI); il PROCESSO DEL MODELLO è il catalogo da cui il
 * tenant è partito, un altro oggetto. La scheda è la stessa per la pagina e per l'agente (V8).
 */
import { z } from "zod";

export const TenantProcessExecutorKindSchema = z.enum(["POSIZIONE", "RUOLO", "AGENTE"]);
export const TenantProcessUnitRoleSchema = z.enum(["OWNER", "CONTRIBUTOR", "CONSULTED", "INFORMED"]);

export const TenantProcessListQuerySchema = z.object({
  /** 1 = i processi, 2 = i sottoprocessi; senza filtro, tutti e due. */
  level: z.coerce.number().int().min(1).max(2).optional(),
  parentId: z.uuid().optional(),
});
export type TenantProcessListQuery = z.infer<typeof TenantProcessListQuerySchema>;

export const TenantProcessIdParamSchema = z.object({ id: z.uuid() });

export const TenantProcessSummarySchema = z.object({
  processId: z.uuid(),
  tenantId: z.uuid(),
  tenantName: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  level: z.number().int().min(1).max(2),
  parentId: z.uuid().nullable(),
  parentName: z.string().nullable(),
  isActive: z.boolean(),
  /** la posizione che risponde del processo e chi la tiene oggi («Cognome, Nome») */
  ownerPositionId: z.uuid().nullable(),
  ownerPositionTitle: z.string().nullable(),
  ownerName: z.string().nullable(),
  /** il processo del modello da cui viene, se c'è */
  modelProcessName: z.string().nullable(),
  subprocessCount: z.number().int().min(0),
  activityCount: z.number().int().min(0),
  unitCount: z.number().int().min(0),
});
export type TenantProcessSummary = z.infer<typeof TenantProcessSummarySchema>;

export const TenantProcessListResponseSchema = z.object({
  items: z.array(TenantProcessSummarySchema),
  total: z.number().int().min(0),
});
export type TenantProcessListResponse = z.infer<typeof TenantProcessListResponseSchema>;

export const TenantProcessActivitySchema = z.object({
  activityId: z.uuid(),
  /** il processo (o sottoprocesso) a cui l'attività appartiene */
  processId: z.uuid(),
  ordinal: z.number().int().min(1),
  code: z.string(),
  name: z.string(),
  input: z.string().nullable(),
  output: z.string().nullable(),
  unitId: z.uuid().nullable(),
  unitName: z.string().nullable(),
  executorKind: TenantProcessExecutorKindSchema.nullable(),
  /** la posizione, il ruolo o l'agente che esegue, scritto per esteso */
  executorName: z.string().nullable(),
  executorPositionId: z.uuid().nullable(),
  executorJobRoleId: z.uuid().nullable(),
  workNature: z.string().nullable(),
  deliveryModel: z.string().nullable(),
  typicalHoursPerCycle: z.number().nullable(),
});
export type TenantProcessActivity = z.infer<typeof TenantProcessActivitySchema>;

export const TenantProcessParticipantSchema = z.object({
  userId: z.uuid(),
  fullName: z.string().nullable(),
  role: TenantProcessUnitRoleSchema,
});

export const TenantProcessUnitSchema = z.object({
  unitId: z.uuid(),
  unitName: z.string(),
  role: TenantProcessUnitRoleSchema,
  participants: z.array(TenantProcessParticipantSchema),
});
export type TenantProcessUnit = z.infer<typeof TenantProcessUnitSchema>;

export const TenantProcessKpiSchema = z.object({
  kpiId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  unit: z.string().nullable(),
  defaultTarget: z.number().nullable(),
  defaultWeight: z.number().nullable(),
});

export const TenantProcessSkillSchema = z.object({
  skillId: z.uuid(),
  name: z.string(),
  /** quante posizioni che eseguono attività del processo la richiedono */
  positions: z.number().int().min(0),
});

export const TenantProcessProjectSchema = z.object({
  projectId: z.uuid(),
  code: z.string(),
  name: z.string(),
  status: z.string(),
});

export const TenantProcessSchedaSchema = z.object({
  process: TenantProcessSummarySchema,
  subprocesses: z.array(TenantProcessSummarySchema),
  /** le attività del processo e dei suoi sottoprocessi, in ordine di sottoprocesso e di passo */
  activities: z.array(TenantProcessActivitySchema),
  units: z.array(TenantProcessUnitSchema),
  kpis: z.array(TenantProcessKpiSchema),
  skills: z.array(TenantProcessSkillSchema),
  approvals: z.object({ pending: z.number().int().min(0), total: z.number().int().min(0) }),
  projects: z.array(TenantProcessProjectSchema),
});
export type TenantProcessScheda = z.infer<typeof TenantProcessSchedaSchema>;

// ── Il responsabile del processo (ADR-0060, piano docs/piani/PIANO_applet-assistente_20261118.md,
// voce P3). Prima di questa rotta `tenant_process_owner_position_id` si scriveva solo da script.
// L'annullamento è la stessa rotta con il valore precedente, che la risposta restituisce.
export type TenantProcessIdParam = z.infer<typeof TenantProcessIdParamSchema>;

export const TenantProcessSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  ownerPositionId: z.uuid().nullable(),
  ownerPositionTitle: z.string().nullable(),
  /** Vero se la posizione responsabile ha almeno un titolare con assegnazione `ACTIVE`. */
  ownerCovered: z.boolean(),
});
export type TenantProcess = z.infer<typeof TenantProcessSchema>;

export const UpdateTenantProcessOwnerBodySchema = z.object({
  /** La posizione che risponde del processo, dello stesso tenant; `null` la toglie. */
  ownerPositionId: z.uuid().nullable(),
});
export type UpdateTenantProcessOwnerBody = z.infer<typeof UpdateTenantProcessOwnerBodySchema>;

export const UpdateTenantProcessOwnerResponseSchema = z.object({
  process: TenantProcessSchema,
  /** Il valore di prima: rimandarlo alla stessa rotta annulla la modifica. */
  previousOwnerPositionId: z.uuid().nullable(),
});
export type UpdateTenantProcessOwnerResponse = z.infer<typeof UpdateTenantProcessOwnerResponseSchema>;

/**
 * La matrice processi × unità (GET /v1/processes/matrice): righe = processi (e sottoprocessi sotto il
 * loro processo), colonne = unità che partecipano ad almeno un processo, celle = il ruolo RACI
 * dell'unità nel processo. Stessa mappa della corsa del datastore, sui dati vivi del tenant.
 */
export const TenantProcessMatrixQuerySchema = z.object({
  /** solo per un mandato di piattaforma; gli altri vedono il proprio tenant */
  tenantId: z.uuid().optional(),
});
export type TenantProcessMatrixQuery = z.infer<typeof TenantProcessMatrixQuerySchema>;

export const TenantProcessMatrixResponseSchema = z.object({
  tenantId: z.uuid().nullable(),
  processes: z.array(z.object({
    processId: z.uuid(),
    code: z.string(),
    name: z.string(),
    level: z.number().int().min(1).max(2),
    parentId: z.uuid().nullable(),
  })),
  units: z.array(z.object({ unitId: z.uuid(), name: z.string(), code: z.string().nullable() })),
  cells: z.array(z.object({ processId: z.uuid(), unitId: z.uuid(), role: TenantProcessUnitRoleSchema })),
});
export type TenantProcessMatrixResponse = z.infer<typeof TenantProcessMatrixResponseSchema>;
