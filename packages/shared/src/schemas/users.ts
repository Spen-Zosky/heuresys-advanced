/**
 * packages/shared/src/schemas/users.ts
 * Zod request/response schemas for /v1/users/*. Mirrors sys.sys_users +
 * sys.sys_user_auth_roles CHECK constraints.
 *
 * Per API_IMPLEMENTATION_PLAN §6 + AUTH_SECURITY_PLAN §6 matrix.
 */

import { z } from "zod";
import { RoleCodeSchema } from "./role-codes.js";

export const USER_STATUS_VALUES = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
  "DEACTIVATED",
] as const;
export type UserStatus = (typeof USER_STATUS_VALUES)[number];
export const UserStatusSchema = z.enum(USER_STATUS_VALUES);

export const USER_TYPE_VALUES = [
  "STANDARD",
  "SYNTHETIC_REFERENCE",
  "SERVICE",
] as const;
export type UserType = (typeof USER_TYPE_VALUES)[number];
export const UserTypeSchema = z.enum(USER_TYPE_VALUES);

/* --- read shape -------------------------------------------------------- */

export const UserSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  externalCode: z.string().nullable(),
  status: UserStatusSchema,
  type: UserTypeSchema,
  isSynthetic: z.boolean(),
  locale: z.string().nullable(),
  timezone: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

/* --- POST /v1/users ---------------------------------------------------- */

export const CreateUserBodySchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().min(1).max(255),
  /**
   * Target tenant for the new user. Optional and only honored for PLATFORM_
   * ADMIN actors (cross-tenant create). For TENANT_ADMIN, the service forces
   * the actor's own tenantId regardless of what's sent here.
   */
  tenantId: z.string().uuid().optional(),
  firstName: z.string().max(128).nullable().optional(),
  lastName: z.string().max(128).nullable().optional(),
  externalCode: z.string().max(64).nullable().optional(),
  status: UserStatusSchema.optional().default("PENDING_VERIFICATION"),
  type: UserTypeSchema.optional().default("STANDARD"),
  locale: z.string().max(16).nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateUserBody = z.infer<typeof CreateUserBodySchema>;

/* --- PATCH /v1/users/:id ----------------------------------------------- */

export const UpdateUserBodySchema = z.object({
  email: z.string().email().max(254).optional(),
  displayName: z.string().min(1).max(255).optional(),
  firstName: z.string().max(128).nullable().optional(),
  lastName: z.string().max(128).nullable().optional(),
  externalCode: z.string().max(64).nullable().optional(),
  status: UserStatusSchema.optional(),
  type: UserTypeSchema.optional(),
  locale: z.string().max(16).nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateUserBody = z.infer<typeof UpdateUserBodySchema>;

/**
 * Fields MANAGER and USER can submit when updating in their scope. Anything
 * else returns 403 from the service. Enforced at the service layer.
 */
export const NON_PRIVILEGED_UPDATABLE_FIELDS = [
  "displayName",
  "firstName",
  "lastName",
  "locale",
  "timezone",
  "metadata",
] as const satisfies ReadonlyArray<keyof UpdateUserBody>;

/* --- GET /v1/users (list) ---------------------------------------------- */

export const UserListQuerySchema = z.object({
  status: UserStatusSchema.optional(),
  type: UserTypeSchema.optional(),
  isSynthetic: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const UserListResponseSchema = z.object({
  items: z.array(UserSchema),
  total: z.number().int().min(0),
});
export type UserListResponse = z.infer<typeof UserListResponseSchema>;

/* --- :id param --------------------------------------------------------- */

export const UserIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type UserIdParam = z.infer<typeof UserIdParamSchema>;

/* --- role grants ------------------------------------------------------- */

export const RoleGrantSchema = z.object({
  grantId: z.string().uuid(),
  roleCode: RoleCodeSchema,
  tenantId: z.string().uuid().nullable(),
  grantedAt: z.string().datetime(),
  grantedBy: z.string().uuid().nullable(),
});
export type RoleGrant = z.infer<typeof RoleGrantSchema>;

export const RoleGrantListResponseSchema = z.object({
  items: z.array(RoleGrantSchema),
});
export type RoleGrantListResponse = z.infer<typeof RoleGrantListResponseSchema>;

export const GrantRoleBodySchema = z.object({
  roleCode: RoleCodeSchema,
  /**
   * For TENANT_ADMIN grants: ignored — service forces actor.tenantId.
   * For PLATFORM_ADMIN: optional — null grants platform-wide; otherwise
   * scopes to the supplied tenantId.
   */
  tenantId: z.string().uuid().nullable().optional(),
});
export type GrantRoleBody = z.infer<typeof GrantRoleBodySchema>;

export const GrantIdParamSchema = z.object({
  id: z.string().uuid(),
  grantId: z.string().uuid(),
});
export type GrantIdParam = z.infer<typeof GrantIdParamSchema>;
