/**
 * @heuresys/shared — 3.3 BPM runtime, Slice D: generic approval runtime schemas.
 * Backs /v1/approvals/* over sys.sys_approval_requests + sys.sys_approval_steps.
 *
 * A generic, domain-agnostic approval runtime: an actor opens a request for a
 * polymorphic subject (resource_type/resource_id) and a list of approvers; one
 * step is materialized per approver; each pending step is delivered to the
 * approver's inbox (3.4 notification center) as an actionable task; on quorum
 * (ALL_OF / ANY_OF) the request reaches a terminal status and may be APPLIED.
 * All categorical fields are varchar+CHECK on the DB side (RD-08, never ENUM);
 * the enums below mirror those CHECK domains. Zod v4 API (z.uuid()/z.iso.datetime()).
 */
import { z } from "zod";

const META = z.record(z.string(), z.unknown());

/* --- enums (mirror DB CHECK domains) --------------------------------------- */
export const ApprovalStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "APPLIED"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const ApprovalStepStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "SKIPPED"]);
export type ApprovalStepStatus = z.infer<typeof ApprovalStepStatusEnum>;

export const ApprovalDecisionPolicyEnum = z.enum(["ALL_OF", "ANY_OF"]);
export type ApprovalDecisionPolicy = z.infer<typeof ApprovalDecisionPolicyEnum>;

/** Aligns to the inbox priority domain so it passes straight to emitNotification. */
export const ApprovalPriorityEnum = z.enum(["INFO", "MEDIUM", "HIGH", "CRITICAL"]);
export type ApprovalPriority = z.infer<typeof ApprovalPriorityEnum>;

/* --- request / step rows --------------------------------------------------- */
export const ApprovalRequestSchema = z.object({
  approvalRequestId: z.uuid(),
  tenantId: z.uuid(),
  title: z.string(),
  body: z.string().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.uuid().nullable(),
  status: ApprovalStatusEnum,
  decisionPolicy: ApprovalDecisionPolicyEnum,
  priority: ApprovalPriorityEnum,
  metadata: META,
  resolvedAt: z.iso.datetime().nullable(),
  appliedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  createdBy: z.uuid().nullable(),
  updatedAt: z.iso.datetime(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

/** The base step row (returned by the decide endpoint). */
export const ApprovalStepSchema = z.object({
  approvalStepId: z.uuid(),
  requestId: z.uuid(),
  tenantId: z.uuid(),
  approverUserId: z.uuid(),
  ordinal: z.number().int(),
  levelPolicy: ApprovalDecisionPolicyEnum.nullable(), // slice-2: per-level quorum (null → request policy)
  status: ApprovalStepStatusEnum,
  decisionComment: z.string().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  decidedBy: z.uuid().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;

/** A step enriched with the approver's identity (for the ledger UI). */
export const ApprovalStepDetailSchema = ApprovalStepSchema.extend({
  approverEmail: z.string().nullable(),
  approverName: z.string().nullable(),
});
export type ApprovalStepDetail = z.infer<typeof ApprovalStepDetailSchema>;

/** Request + its full step ledger (GET /:id). */
export const ApprovalRequestDetailSchema = ApprovalRequestSchema.extend({
  createdByEmail: z.string().nullable(),
  steps: z.array(ApprovalStepDetailSchema),
});
export type ApprovalRequestDetail = z.infer<typeof ApprovalRequestDetailSchema>;

/** List item: the request + derived step counts for the status badge. */
export const ApprovalRequestListItemSchema = ApprovalRequestSchema.extend({
  stepCount: z.number().int(),
  pendingStepCount: z.number().int(),
});
export type ApprovalRequestListItem = z.infer<typeof ApprovalRequestListItemSchema>;

export const ApprovalListResponseSchema = z.object({
  items: z.array(ApprovalRequestListItemSchema),
  total: z.number().int().min(0),
});
export type ApprovalListResponse = z.infer<typeof ApprovalListResponseSchema>;

/* --- request bodies / params ----------------------------------------------- */
/** slice-2: one ordered level of an approval chain. policy falls back to the request decisionPolicy. */
export const ApprovalLevelInputSchema = z.object({
  approverUserIds: z.array(z.uuid()).min(1).max(50),
  policy: ApprovalDecisionPolicyEnum.optional(),
});
export type ApprovalLevelInput = z.infer<typeof ApprovalLevelInputSchema>;

export const CreateApprovalRequestBodySchema = z
  .object({
    title: z.string().min(1).max(255),
    body: z.string().max(8192).nullable().optional(),
    resourceType: z.string().max(64).nullable().optional(),
    resourceId: z.uuid().nullable().optional(),
    priority: ApprovalPriorityEnum.optional(),
    decisionPolicy: ApprovalDecisionPolicyEnum.optional(),
    /** B3 (#34): payload consumed by the apply-effect handler registered for
     *  `resourceType` (e.g. `{ archetypeKey }` for TENANT_MATERIALIZATION). The row and
     *  the read schema always had it; only the create path dropped it. */
    metadata: META.optional(),
    // slice-1 sugar: a single level of approvers. Mutually exclusive with `levels`.
    approverUserIds: z.array(z.uuid()).min(1).max(50).optional(),
    // slice-2: ordered multi-level chain (level 1 first; a level opens only once the prior is satisfied).
    levels: z.array(ApprovalLevelInputSchema).min(1).max(10).optional(),
  })
  .refine((b) => (b.approverUserIds ? 1 : 0) + (b.levels ? 1 : 0) === 1, {
    error: "Provide exactly one of approverUserIds (single level) or levels (ordered chain)",
  });
export type CreateApprovalRequestBody = z.infer<typeof CreateApprovalRequestBodySchema>;

export const DecideApprovalStepBodySchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().max(2000).nullable().optional(),
});
export type DecideApprovalStepBody = z.infer<typeof DecideApprovalStepBodySchema>;

export const ApprovalIdParamSchema = z.object({ id: z.uuid() });
export const ApprovalDecideParamsSchema = z.object({ id: z.uuid(), stepId: z.uuid() });

/** GET / list filter (admin tracking, tenant-scoped server-side). */
export const ApprovalListQuerySchema = z.object({
  status: ApprovalStatusEnum.optional(),
  resourceType: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type ApprovalListQuery = z.infer<typeof ApprovalListQuerySchema>;
