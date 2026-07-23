/**
 * packages/shared/src/schemas/notifications.ts
 * 3.4 Notification center — shared contracts.
 *
 * Consumer side (inbox) already lives in me.ts; this module adds the per-user
 * delivery PREFERENCES surface (GET/PATCH /v1/me/notification-preferences) and
 * the canonical notification-type union (mirrors the sys_inbox_notifications +
 * sys_notification_preferences CHECK domains — RD-08, never ENUM).
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

export const NotificationTypeSchema = z.enum([
  "TRAINING_DEADLINE",
  "ASSESSMENT_REQUEST",
  "MANAGER_FEEDBACK_READY",
  "CAREER_TARGET_STATUS",
  "GAP_CLOSURE_DUE",
  "SYSTEM",
  "APPROVAL_REQUEST",
  "APPROVAL_REMINDER",
  "APPROVAL_OVERDUE",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationPrioritySchema = z.enum(["INFO", "MEDIUM", "HIGH", "CRITICAL"]);
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

/** Effective preference for one type (default-on in-app, default-off email). */
export const NotificationPreferenceSchema = z.object({
  notificationType: NotificationTypeSchema,
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});
export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;

/** GET — all six types with their effective state (row or default). */
export const NotificationPreferencesResponseSchema = z.object({
  items: z.array(NotificationPreferenceSchema),
  total: z.number().int().min(0),
});
export type NotificationPreferencesResponse = z.infer<typeof NotificationPreferencesResponseSchema>;

/** PATCH — upsert one type's channels (at least one channel field required). */
export const UpdateNotificationPreferenceBodySchema = z
  .object({
    notificationType: NotificationTypeSchema,
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
  })
  .refine((b) => b.inAppEnabled !== undefined || b.emailEnabled !== undefined, {
    error: "At least one of inAppEnabled / emailEnabled must be provided",
  });
export type UpdateNotificationPreferenceBody = z.infer<typeof UpdateNotificationPreferenceBodySchema>;

/** SYSTEM broadcast (admin, notification:create) — emit a SYSTEM notification to
 *  a target user list. Recipients outside the actor's tenant are dropped for
 *  non-platform actors (I5); PLATFORM_ADMIN may target any tenant. */
export const BroadcastNotificationBodySchema = z.object({
  userIds: z.array(z.uuid()).min(1).max(500),
  subject: z.string().min(1).max(255),
  body: z.string().max(8192).nullable().optional(),
  priority: NotificationPrioritySchema.optional(),
  actionUrl: z.string().max(1024).nullable().optional(),
  tenantId: z.uuid().nullable().optional(),
});
export type BroadcastNotificationBody = z.infer<typeof BroadcastNotificationBodySchema>;

export const BroadcastNotificationResponseSchema = z.object({
  requested: z.number().int(),
  emitted: z.number().int(),
});
export type BroadcastNotificationResponse = z.infer<typeof BroadcastNotificationResponseSchema>;

/** GET /v1/notifications/broadcasts — administrative audit of sent SYSTEM
 *  broadcasts (#74, ex D-70: the module was write-only). One audit row per
 *  broadcast EVENT: the bulk emit writes every recipient row in a single
 *  INSERT, so (created_by, subject, created_at) reconstructs the event
 *  exactly; recipients/readCount aggregate its per-user rows. Non-platform
 *  actors see only broadcasts that reached their own tenant (I5). */
export const ListBroadcastsQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  ...paginationFields(100, 50),
});
export type ListBroadcastsQuery = z.infer<typeof ListBroadcastsQuerySchema>;

export const BroadcastAuditItemSchema = z.object({
  subject: z.string(),
  body: z.string().nullable(),
  priority: NotificationPrioritySchema,
  actionUrl: z.string().nullable(),
  createdByUserId: z.uuid().nullable(),
  createdByEmail: z.string().nullable(),
  emittedAt: z.iso.datetime({ offset: true }),
  recipients: z.number().int().min(0),
  readCount: z.number().int().min(0),
  tenants: z.number().int().min(0),
});
export type BroadcastAuditItem = z.infer<typeof BroadcastAuditItemSchema>;

export const ListBroadcastsResponseSchema = z.object({
  items: z.array(BroadcastAuditItemSchema),
  total: z.number().int().min(0),
});
export type ListBroadcastsResponse = z.infer<typeof ListBroadcastsResponseSchema>;
