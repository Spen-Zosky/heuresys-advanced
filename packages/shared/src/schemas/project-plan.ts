/**
 * packages/shared/src/schemas/project-plan.ts
 *
 * Il piano di un progetto e la sua scheda: voci V6 e V7 del piano
 * docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md (migrazione 000503).
 *
 * Una FASE è un nodo della scomposizione del lavoro: PHASE (contiene altro), ACTIVITY, MILESTONE
 * (una data sola). Le date sono di sola data (`YYYY-MM-DD`). Chi porta una fase è un'appartenenza
 * al progetto, non una persona (I18). Una DIPENDENZA dice che il successore aspetta il predecessore
 * (FS fine-inizio, SS, FF, SF), con un ritardo in giorni. La scheda è la stessa per la pagina e per
 * l'agente (V8).
 */
import { z } from "zod";
import { ProjectDetailSchema } from "./projects.js";
import { TenantProcessSummarySchema } from "./tenant-processes.js";

export const PROJECT_PHASE_KINDS = ["PHASE", "ACTIVITY", "MILESTONE"] as const;
export const ProjectPhaseKindSchema = z.enum(PROJECT_PHASE_KINDS);
export const PROJECT_PHASE_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const ProjectPhaseStatusSchema = z.enum(PROJECT_PHASE_STATUSES);
export const PROJECT_DEPENDENCY_KINDS = ["FS", "SS", "FF", "SF"] as const;
export const ProjectDependencyKindSchema = z.enum(PROJECT_DEPENDENCY_KINDS);
export type ProjectPhaseKind = z.infer<typeof ProjectPhaseKindSchema>;
export type ProjectPhaseStatus = z.infer<typeof ProjectPhaseStatusSchema>;
export type ProjectDependencyKind = z.infer<typeof ProjectDependencyKindSchema>;

export const ProjectPhaseSchema = z.object({
  phaseId: z.uuid(),
  projectId: z.uuid(),
  parentId: z.uuid().nullable(),
  kind: ProjectPhaseKindSchema,
  ordinal: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  plannedStart: z.iso.date().nullable(),
  plannedEnd: z.iso.date().nullable(),
  actualStart: z.iso.date().nullable(),
  actualEnd: z.iso.date().nullable(),
  progressPct: z.number().nullable(),
  status: ProjectPhaseStatusSchema,
  /** l'appartenenza che porta la fase, e il nome della persona («Cognome, Nome») */
  ownerMemberId: z.uuid().nullable(),
  ownerName: z.string().nullable(),
  /** l'attività di processo che la fase esegue, se c'è */
  processStepId: z.uuid().nullable(),
  processStepName: z.string().nullable(),
});
export type ProjectPhase = z.infer<typeof ProjectPhaseSchema>;

export const ProjectDependencySchema = z.object({
  dependencyId: z.uuid(),
  predecessorId: z.uuid(),
  successorId: z.uuid(),
  kind: ProjectDependencyKindSchema,
  lagDays: z.number().int(),
});
export type ProjectDependency = z.infer<typeof ProjectDependencySchema>;

export const ProjectSchedaSchema = z.object({
  project: ProjectDetailSchema,
  /** il processo che il progetto serve, se è collegato */
  process: TenantProcessSummarySchema.nullable(),
  phases: z.array(ProjectPhaseSchema),
  dependencies: z.array(ProjectDependencySchema),
  /** se chi guarda può pianificare (il mandato o chi guida il progetto) */
  canManage: z.boolean(),
});
export type ProjectScheda = z.infer<typeof ProjectSchedaSchema>;

const dataONull = z.iso.date().nullish();

export const ProjectPhaseCreateBodySchema = z.object({
  parentId: z.uuid().nullish(),
  kind: ProjectPhaseKindSchema.optional(),
  ordinal: z.number().int().min(1).optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(4000).nullish(),
  plannedStart: dataONull,
  plannedEnd: dataONull,
  actualStart: dataONull,
  actualEnd: dataONull,
  progressPct: z.number().min(0).max(100).nullish(),
  status: ProjectPhaseStatusSchema.optional(),
  ownerMemberId: z.uuid().nullish(),
  processStepId: z.uuid().nullish(),
});
export type ProjectPhaseCreateBody = z.infer<typeof ProjectPhaseCreateBodySchema>;

export const ProjectPhaseUpdateBodySchema = ProjectPhaseCreateBodySchema.partial();
export type ProjectPhaseUpdateBody = z.infer<typeof ProjectPhaseUpdateBodySchema>;

export const ProjectPhaseParamSchema = z.object({ id: z.uuid(), phaseId: z.uuid() });
export const ProjectDependencyParamSchema = z.object({ id: z.uuid(), dependencyId: z.uuid() });

export const ProjectDependencyCreateBodySchema = z.object({
  predecessorId: z.uuid(),
  successorId: z.uuid(),
  kind: ProjectDependencyKindSchema.optional(),
  lagDays: z.number().int().min(-365).max(365).optional(),
});
export type ProjectDependencyCreateBody = z.infer<typeof ProjectDependencyCreateBodySchema>;
