/**
 * packages/shared/src/schemas/projects.ts
 * Schemi per /v1/projects/* (sys.sys_projects + sys.sys_project_members).
 *
 * `#143` — «una squadra e' un progetto»: l'entita' che porta il LAVORO e' il progetto, e
 * l'appartenenza porta il RUOLO e la sua finestra temporale. Due conseguenze che si vedono
 * qui dentro:
 *
 *   · IL CAPO E' UN'APPARTENENZA, NON UNA COLONNA (decisione di F2, imposta dai dati:
 *     misurate il 2026-08-28, le due fonti divergevano davvero — 26 squadre con
 *     `team_lead_user_id` ma 25 con un membro `LEAD`, una senza e una con due). Qui non
 *     esiste nessun `leadUserId`: il capo si legge dai membri con `role: "LEAD"`.
 *   · L'AUTORITA' E' SUL LAVORO, NON SULLE PERSONE (I18). Essere capo di un progetto non
 *     apre i dati sensibili dei membri: quelli restano alla catena organizzativa. Questo
 *     modulo espone l'anagrafica minima di chi partecipa, mai il resto.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
import { queryBoolean } from "./_query-boolean.js";

/** Gli stati che `sys_projects.project_status` ammette — LETTI DAL CHECK, non supposti
 *  (RD-08: varchar + CHECK, mai ENUM). La prima stesura ne dichiarava quattro con un
 *  `CLOSED` che il vincolo non conosce: la creazione passava e il cambio di stato tornava
 *  500. Un progetto non si «chiude»: o e' `COMPLETED` o e' `CANCELLED`, e la distinzione
 *  e' esattamente cio' che un solo `CLOSED` avrebbe perso. */
export const PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export const ProjectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

/** I quattro ruoli che il CHECK di `sys_project_members` ammette — misurati sullo schema
 *  vivo, non dedotti dal piano, che ne nominava due. `CONTRIBUTOR` e `OBSERVER` esistono
 *  nel vincolo dal giorno della `000363`: dichiararne due qui avrebbe fatto rifiutare da
 *  Zod righe che il database considera valide. */
export const PROJECT_MEMBER_ROLES = ["LEAD", "MEMBER", "CONTRIBUTOR", "OBSERVER"] as const;
export const ProjectMemberRoleSchema = z.enum(PROJECT_MEMBER_ROLES);
export type ProjectMemberRole = z.infer<typeof ProjectMemberRoleSchema>;

export const ProjectSchema = z.object({
  projectId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  name: z.string(),
  purpose: z.string().nullable(),
  objective: z.string().nullable(),
  organizationUnitId: z.uuid().nullable(),
  status: ProjectStatusSchema,
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  /** 0..100 con due decimali; `null` finche' nessuno lo dichiara — un progetto senza
   *  avanzamento dichiarato non e' un progetto fermo a zero. */
  progressPct: z.number().nullable(),
  /** Da quale squadra e' nato, quando e' nato da una: la provenienza riga per riga che
   *  la `000363` ha conservato invece di buttarla. */
  originTeamId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  memberCount: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

/** ⚠ Anagrafica MINIMA, ed e' una scelta di I18, non una semplificazione: chi guida un
 *  progetto vede CHI ci lavora e con quale ruolo, mai i dati sensibili di quella persona. */
export const ProjectMemberSchema = z.object({
  userId: z.uuid(),
  role: ProjectMemberRoleSchema,
  email: z.string().nullable(),
  fullName: z.string().nullable(),
  startsOn: z.string(),
  endsOn: z.string().nullable(),
  /** Se l'appartenenza copre oggi: una finestra chiusa ieri e' storia, non partecipazione. */
  isCurrent: z.boolean(),
});
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;

export const ProjectDetailSchema = ProjectSchema.extend({
  members: z.array(ProjectMemberSchema),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;

export const ProjectListQuerySchema = z.object({
  status: ProjectStatusSchema.optional(),
  /** Solo i progetti la cui finestra copre oggi. */
  current: queryBoolean().optional(),
  ...paginationFields(200, 50),
});
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;

export const ProjectListResponseSchema = z.object({
  items: z.array(ProjectSchema),
  total: z.number().int().min(0),
});
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

export const ProjectIdParamSchema = z.object({ id: z.uuid() });
export const ProjectMemberParamSchema = z.object({ id: z.uuid(), userId: z.uuid() });

export const ProjectCreateBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  purpose: z.string().max(4000).nullish(),
  objective: z.string().max(4000).nullish(),
  organizationUnitId: z.uuid().nullish(),
  status: ProjectStatusSchema.optional(),
  startsOn: z.iso.date().nullish(),
  endsOn: z.iso.date().nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ProjectCreateBody = z.infer<typeof ProjectCreateBodySchema>;

export const ProjectUpdateBodySchema = ProjectCreateBodySchema.partial().omit({ code: true });
export type ProjectUpdateBody = z.infer<typeof ProjectUpdateBodySchema>;

/** L'avanzamento ha una rotta sua: e' il gesto piu' frequente del ciclo di vita, e
 *  confonderlo con una modifica generica costringerebbe a rimandare l'intero oggetto. */
export const ProjectProgressBodySchema = z.object({
  progressPct: z.number().min(0).max(100),
});
export type ProjectProgressBody = z.infer<typeof ProjectProgressBodySchema>;

export const ProjectMemberUpsertBodySchema = z.object({
  role: ProjectMemberRoleSchema,
  startsOn: z.iso.date().optional(),
  endsOn: z.iso.date().nullish(),
});
export type ProjectMemberUpsertBody = z.infer<typeof ProjectMemberUpsertBodySchema>;
