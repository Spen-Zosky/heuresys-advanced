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

export const TEAM_MEMBER_ROLES = ["LEAD", "MEMBER"] as const;
export const TeamMemberRoleSchema = z.enum(TEAM_MEMBER_ROLES);
export type TeamMemberRole = z.infer<typeof TeamMemberRoleSchema>;

export const TeamSchema = z.object({
  teamId: z.string().uuid(),
  tenantId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  organizationUnitId: z.string().uuid().nullable(),
  leadUserId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  memberCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamMemberSchema = z.object({
  userId: z.string().uuid(),
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
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type TeamListQuery = z.infer<typeof TeamListQuerySchema>;

export const TeamListResponseSchema = z.object({
  items: z.array(TeamSchema),
  total: z.number().int().min(0),
});
export type TeamListResponse = z.infer<typeof TeamListResponseSchema>;

export const TeamIdParamSchema = z.object({ id: z.string().uuid() });

/** Response of GET /v1/me/team — the caller's own teams (lead + member), with members. */
export const MyTeamsResponseSchema = z.object({
  teams: z.array(TeamDetailSchema),
});
export type MyTeamsResponse = z.infer<typeof MyTeamsResponseSchema>;
