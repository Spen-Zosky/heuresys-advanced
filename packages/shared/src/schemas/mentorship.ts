/**
 * @heuresys/shared — mentorship schemas (SDBI B-10b m1, S970).
 * Backs /v1/mentorship/* over sys.sys_mentorship_programs / sys_mentorships /
 * sys_mentorship_sessions / sys_mentor_match_scores.
 * Visibility: tenant-scoped (non-PLATFORM_ADMIN sees only own tenant; PLATFORM_ADMIN sees all).
 * match-scores are read-only (derived scoring); programs/pairings/sessions are full CRUD.
 * Zod v4 API (z.uuid()/z.iso.datetime()/z.iso.date()/z.record(z.string(), z.unknown())).
 */
import { z } from "zod";

const META = z.record(z.string(), z.unknown());

// ─────────────────────────── Programs ───────────────────────────
export const ProgramTypeEnum = z.enum(["GENERAL", "LEADERSHIP", "TECHNICAL", "MANAGEMENT", "DEI"]);
export const ProgramStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED", "DRAFT"]);

export const MentorshipProgramSchema = z.object({
  programId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: ProgramTypeEnum,
  status: ProgramStatusEnum,
  durationMonths: z.number().int().nullable(),
  maxParticipants: z.number().int().nullable(),
  focusAreas: z.array(z.string()).nullable(),
  eligibilityCriteria: META,
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MentorshipProgram = z.infer<typeof MentorshipProgramSchema>;

export const MentorshipProgramListQuerySchema = z.object({
  status: ProgramStatusEnum.optional(),
  type: ProgramTypeEnum.optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type MentorshipProgramListQuery = z.infer<typeof MentorshipProgramListQuerySchema>;

export const MentorshipProgramListResponseSchema = z.object({
  items: z.array(MentorshipProgramSchema),
  total: z.number().int().min(0),
});

export const CreateMentorshipProgramBodySchema = z.object({
  tenantId: z.uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  type: ProgramTypeEnum.optional().default("GENERAL"),
  status: ProgramStatusEnum.optional().default("ACTIVE"),
  durationMonths: z.number().int().min(0).nullable().optional(),
  maxParticipants: z.number().int().min(0).nullable().optional(),
  focusAreas: z.array(z.string()).nullable().optional(),
  eligibilityCriteria: META.optional().default({}),
  startDate: z.iso.date().nullable().optional(),
  endDate: z.iso.date().nullable().optional(),
  metadata: META.optional().default({}),
});
export type CreateMentorshipProgramBody = z.infer<typeof CreateMentorshipProgramBodySchema>;

export const UpdateMentorshipProgramBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  type: ProgramTypeEnum.optional(),
  status: ProgramStatusEnum.optional(),
  durationMonths: z.number().int().min(0).nullable().optional(),
  maxParticipants: z.number().int().min(0).nullable().optional(),
  focusAreas: z.array(z.string()).nullable().optional(),
  eligibilityCriteria: META.optional(),
  startDate: z.iso.date().nullable().optional(),
  endDate: z.iso.date().nullable().optional(),
  metadata: META.optional(),
});
export type UpdateMentorshipProgramBody = z.infer<typeof UpdateMentorshipProgramBodySchema>;

// ─────────────────────────── Pairings (mentorships) ───────────────────────────
export const MentorshipStatusEnum = z.enum(["ACTIVE", "COMPLETED", "ON_HOLD", "CANCELLED", "PENDING"]);
export const MeetingFrequencyEnum = z.enum(["WEEKLY", "BI_WEEKLY", "MONTHLY", "QUARTERLY", "AD_HOC"]);

export const MentorshipSchema = z.object({
  mentorshipId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  programId: z.uuid().nullable(),
  mentorUserId: z.uuid().nullable(),
  menteeUserId: z.uuid().nullable(),
  status: MentorshipStatusEnum,
  focusAreas: z.array(z.string()).nullable(),
  meetingFrequency: MeetingFrequencyEnum,
  goals: z.array(z.string()).nullable(),
  matchScore: z.number().nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  notes: z.string().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Mentorship = z.infer<typeof MentorshipSchema>;

export const MentorshipListQuerySchema = z.object({
  status: MentorshipStatusEnum.optional(),
  programId: z.uuid().optional(),
  mentorUserId: z.uuid().optional(),
  menteeUserId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type MentorshipListQuery = z.infer<typeof MentorshipListQuerySchema>;

export const MentorshipListResponseSchema = z.object({
  items: z.array(MentorshipSchema),
  total: z.number().int().min(0),
});

export const CreateMentorshipBodySchema = z.object({
  tenantId: z.uuid().optional(),
  programId: z.uuid().nullable().optional(),
  mentorUserId: z.uuid().nullable().optional(),
  menteeUserId: z.uuid().nullable().optional(),
  status: MentorshipStatusEnum.optional().default("ACTIVE"),
  focusAreas: z.array(z.string()).nullable().optional(),
  meetingFrequency: MeetingFrequencyEnum.optional().default("BI_WEEKLY"),
  goals: z.array(z.string()).nullable().optional(),
  matchScore: z.number().min(0).max(100).nullable().optional(),
  startDate: z.iso.date().nullable().optional(),
  endDate: z.iso.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: META.optional().default({}),
});
export type CreateMentorshipBody = z.infer<typeof CreateMentorshipBodySchema>;

export const UpdateMentorshipBodySchema = z.object({
  programId: z.uuid().nullable().optional(),
  mentorUserId: z.uuid().nullable().optional(),
  menteeUserId: z.uuid().nullable().optional(),
  status: MentorshipStatusEnum.optional(),
  focusAreas: z.array(z.string()).nullable().optional(),
  meetingFrequency: MeetingFrequencyEnum.optional(),
  goals: z.array(z.string()).nullable().optional(),
  matchScore: z.number().min(0).max(100).nullable().optional(),
  startDate: z.iso.date().nullable().optional(),
  endDate: z.iso.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: META.optional(),
});
export type UpdateMentorshipBody = z.infer<typeof UpdateMentorshipBodySchema>;

// ─────────────────────────── Sessions ───────────────────────────
export const SessionStatusEnum = z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"]);

export const MentorshipSessionSchema = z.object({
  sessionId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  mentorshipId: z.uuid(),
  date: z.iso.datetime(),
  durationMinutes: z.number().int().nullable(),
  status: SessionStatusEnum,
  topics: z.array(z.string()).nullable(),
  notes: z.string().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
});
export type MentorshipSession = z.infer<typeof MentorshipSessionSchema>;

export const MentorshipSessionListResponseSchema = z.object({
  items: z.array(MentorshipSessionSchema),
  total: z.number().int().min(0),
});

export const CreateMentorshipSessionBodySchema = z.object({
  date: z.iso.datetime(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  status: SessionStatusEnum.optional().default("SCHEDULED"),
  topics: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  metadata: META.optional().default({}),
});
export type CreateMentorshipSessionBody = z.infer<typeof CreateMentorshipSessionBodySchema>;

export const UpdateMentorshipSessionBodySchema = z.object({
  date: z.iso.datetime().optional(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  status: SessionStatusEnum.optional(),
  topics: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  metadata: META.optional(),
});
export type UpdateMentorshipSessionBody = z.infer<typeof UpdateMentorshipSessionBodySchema>;

// ─────────────────────────── Match scores (read-only) ───────────────────────────
export const MentorMatchScoreSchema = z.object({
  matchId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  menteeUserId: z.uuid().nullable(),
  mentorUserId: z.uuid().nullable(),
  skillId: z.uuid().nullable(),
  skillName: z.string().nullable(),
  menteeLevel: z.number().nullable(),
  mentorLevel: z.number().nullable(),
  score: z.number().nullable(),
  factors: META,
  isRecommended: z.boolean(),
  recommendationRank: z.number().int().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
});
export type MentorMatchScore = z.infer<typeof MentorMatchScoreSchema>;

export const MentorMatchScoreListQuerySchema = z.object({
  mentorUserId: z.uuid().optional(),
  menteeUserId: z.uuid().optional(),
  isRecommended: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type MentorMatchScoreListQuery = z.infer<typeof MentorMatchScoreListQuerySchema>;

export const MentorMatchScoreListResponseSchema = z.object({
  items: z.array(MentorMatchScoreSchema),
  total: z.number().int().min(0),
});

// ─────────────────────────── Shared params ───────────────────────────
export const MentorshipIdParamSchema = z.object({ id: z.uuid() });
