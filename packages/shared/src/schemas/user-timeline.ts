/**
 * packages/shared/src/schemas/user-timeline.ts
 * D5 (#49) — la storia della vita lavorativa di una persona.
 *
 * Registro CONSULTIVO di fatti già avvenuti, importato dal sistema precedente:
 * non è un event-store di dominio e non esiste una scrittura via API.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

export const USER_TIMELINE_EVENT_TYPES = [
  "HIRE", "PROMOTION", "LEVEL_CHANGE", "SALARY_CHANGE",
  "COURSE_COMPLETED", "COURSE_ENROLLED",
  "SKILL_VALIDATED", "SKILL_UPDATED",
  "REVIEW_COMPLETED", "MANAGER_CHANGE",
  "CERTIFICATION_EARNED", "CERTIFICATION_EXPIRED",
  "GOAL_ACHIEVED", "GOAL_ASSIGNED",
  "ROLE_CHANGE", "LOCATION_CHANGE",
  "CONTRACT_RENEWED", "CONTRACT_SIGNED",
  "WELLBEING_ALERT", "FEEDBACK_RECEIVED",
  "TIME_OFF_TAKEN", "ABSENCE_RECORDED",
  "SUCCESSION_NOMINATION", "TALENT_POOL_INCLUSION",
  "DISCIPLINARY_ACTION", "OTHER",
] as const;
export const UserTimelineEventTypeSchema = z.enum(USER_TIMELINE_EVENT_TYPES);
export type UserTimelineEventType = z.infer<typeof UserTimelineEventTypeSchema>;

export const UserTimelineEventSchema = z.object({
  userTimelineEventId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  type: UserTimelineEventTypeSchema,
  occurredAt: z.iso.datetime(),
  sourceTable: z.string().nullable(),
  sourceId: z.uuid().nullable(),
  /** La sintesi del fatto così com'era nel sistema di origine. */
  summary: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type UserTimelineEvent = z.infer<typeof UserTimelineEventSchema>;

export const UserTimelineListQuerySchema = z.object({
  userId: z.uuid().optional(),
  type: UserTimelineEventTypeSchema.optional(),
  /** Finestra temporale, estremi inclusi. */
  from: z.string().optional(),
  to: z.string().optional(),
  ...paginationFields(200, 50),
});
export type UserTimelineListQuery = z.infer<typeof UserTimelineListQuerySchema>;

export const UserTimelineListResponseSchema = z.object({
  items: z.array(UserTimelineEventSchema),
  total: z.number().int().min(0),
});
export type UserTimelineListResponse = z.infer<typeof UserTimelineListResponseSchema>;

/** Quanti fatti per tipo — alimenta l'intestazione della scheda. */
export const UserTimelineSummaryResponseSchema = z.object({
  items: z.array(z.object({ type: UserTimelineEventTypeSchema, count: z.number().int().min(0) })),
  total: z.number().int().min(0),
  firstEventAt: z.iso.datetime().nullable(),
  lastEventAt: z.iso.datetime().nullable(),
});
export type UserTimelineSummaryResponse = z.infer<typeof UserTimelineSummaryResponseSchema>;
