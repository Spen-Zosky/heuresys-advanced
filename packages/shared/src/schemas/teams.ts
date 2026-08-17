/**
 * packages/shared/src/schemas/teams.ts
 * Schemas for /v1/teams/* and /v1/me/team (sys.sys_teams + sys.sys_team_members).
 *
 * WS-4 R1b: teams are derived from the real org structure (an org unit + its manager + the
 * users holding a position in it). The "my team" 3rd RBAC scope axis is enforced in the service
 * layer (admin roles see all teams in tenant; a TEAM_LEADER/TEAM_MEMBER sees only teams they
 * lead or belong to).
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
import { queryBoolean } from "./_query-boolean.js";
export const TEAM_MEMBER_ROLES = ["LEAD", "MEMBER"] as const;
export const TeamMemberRoleSchema = z.enum(TEAM_MEMBER_ROLES);
export type TeamMemberRole = z.infer<typeof TeamMemberRoleSchema>;

export const TeamSchema = z.object({
  teamId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  name: z.string(),
  organizationUnitId: z.uuid().nullable(),
  leadUserId: z.uuid().nullable(),
  isActive: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  memberCount: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamMemberSchema = z.object({
  userId: z.uuid(),
  role: TeamMemberRoleSchema,
  email: z.string().nullable(),
  fullName: z.string().nullable(),
  isActive: z.boolean(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamDetailSchema = TeamSchema.extend({
  members: z.array(TeamMemberSchema),
});
export type TeamDetail = z.infer<typeof TeamDetailSchema>;

export const TeamListQuerySchema = z.object({
  isActive: queryBoolean().optional(),
  ...paginationFields(200, 50),
});
export type TeamListQuery = z.infer<typeof TeamListQuerySchema>;

export const TeamListResponseSchema = z.object({
  items: z.array(TeamSchema),
  total: z.number().int().min(0),
});
export type TeamListResponse = z.infer<typeof TeamListResponseSchema>;

export const TeamIdParamSchema = z.object({ id: z.uuid() });

/** Response of GET /v1/me/team — the caller's own teams (lead + member), with members. */
export const MyTeamsResponseSchema = z.object({
  teams: z.array(TeamDetailSchema),
});
export type MyTeamsResponse = z.infer<typeof MyTeamsResponseSchema>;

/* --- #75 lifecycle (ex D-71): the module was read-only; teams came from seeds. */

/** POST /v1/teams — create (team:manage). Non-platform actors create in their
 *  own tenant; PLATFORM_ADMIN may pass tenantId. Lead (optional) must belong to
 *  the team's tenant and is mirrored as a LEAD membership row (seed invariant
 *  "lead team = LEAD member" is preserved by the service). */
export const TeamCreateBodySchema = z.object({
  code: z.string().min(2).max(64).regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Uppercase code, digits, '-' '_'"),
  name: z.string().min(2).max(255),
  organizationUnitId: z.uuid().nullable().optional(),
  leadUserId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  tenantId: z.uuid().optional(),
});
export type TeamCreateBody = z.infer<typeof TeamCreateBodySchema>;

/** PATCH /v1/teams/:id — partial update (team:manage). `leadUserId: null` clears
 *  the lead (the old LEAD membership row is demoted to MEMBER). */
export const TeamUpdateBodySchema = z
  .object({
    name: z.string().min(2).max(255).optional(),
    organizationUnitId: z.uuid().nullable().optional(),
    leadUserId: z.uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { error: "At least one field must be provided" });
export type TeamUpdateBody = z.infer<typeof TeamUpdateBodySchema>;

/** PUT /v1/teams/:id/members/:userId — upsert a membership (team:manage).
 *  Promoting to LEAD also sets the team's lead (single-lead model). */
export const TeamMemberUpsertBodySchema = z.object({
  role: TeamMemberRoleSchema.optional(),
  isActive: z.boolean().optional(),
});
export type TeamMemberUpsertBody = z.infer<typeof TeamMemberUpsertBodySchema>;

export const TeamMemberParamSchema = z.object({ id: z.uuid(), userId: z.uuid() });
export type TeamMemberParam = z.infer<typeof TeamMemberParamSchema>;
