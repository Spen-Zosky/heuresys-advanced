/**
 * packages/shared/src/schemas/vrio-scorecard.ts — #56 F/F2.
 *
 * The VRIO scorecard answers the CSO/CFO question "which of our capabilities is an actual
 * competitive advantage, and which is just table stakes?" using Barney's VRIO frame:
 * a resource yields sustained advantage only if it is Valuable, Rare, costly to Imitate,
 * and the Organization is arranged to exploit it.
 *
 * Unit of analysis is the SKILL GROUP, not the individual skill: a board reads ~20
 * capabilities, not 14k skills. F1 (essential-capability) ranks skills for L&D spend;
 * F2 classifies capability groups for strategy. They share the same economic base — the
 * position compensation band — so "value" means one thing across the platform.
 *
 * Every dimension is DERIVED from real rows and ships its raw evidence alongside the figure,
 * so any number can be recomputed by hand from the item:
 *   valueRaw          = wEcon·econPercentile + wCrit·criticalityShare
 *   rarityRaw         = 1 − holders / headcount
 *   inimitabilityRaw  = wDepth·(avgHeldRank/maxRank) + wVerified·verifiedShare + wEvidence·evidenceShare
 *   organizationRaw   = coveredRequirements / totalRequirements
 * The four reported dimensions are those raw measures ranked into PERCENTILES across the
 * organization's own capability set (see VRIO_THRESHOLDS for why), and a dimension counts as
 * "present" when its percentile reaches the threshold. The verdict is then the Barney lattice,
 * never an average of the four.
 *
 * One case sits outside the lattice: a capability positions demand but NOBODY holds. Raw rarity
 * would read 1.0 and flatter it as "extremely rare", when it is simply missing — so it is
 * classified CAPABILITY_GAP before the lattice is consulted.
 */
import { z } from "zod";

/** Declared blend of the Value dimension (sum = 1). */
export const VRIO_VALUE_WEIGHTS = { econ: 0.6, crit: 0.4 } as const;

/** Declared blend of the Inimitability dimension (sum = 1). */
export const VRIO_INIMITABILITY_WEIGHTS = { depth: 0.5, verified: 0.25, evidence: 0.25 } as const;

/**
 * A dimension is "present" at or above its threshold — and the threshold applies to the
 * dimension's PERCENTILE within this organization's own capability set, not to its raw value.
 *
 * Why percentiles: the raw scales are not calibrated against anything. Measured on the live
 * RTL Bank data, raw rarity never drops below 0.5 (the most widely held capability still sits
 * with 79 holders out of 158), raw organization is above 0.8 almost everywhere, and raw
 * inimitability above 0.6 — so an absolute 0.5 cut marks every capability "present" on three
 * dimensions out of four, and the verdict silently collapses onto Value alone. Ranking each
 * dimension against the others restores four working axes and makes the reading explicit:
 * "valuable/rare/… COMPARED TO our other capabilities". Raw figures stay in `evidence`.
 */
export const VRIO_THRESHOLDS = { value: 0.5, rarity: 0.5, inimitability: 0.5, organization: 0.5 } as const;

/** Highest proficiency rank in sys.sys_skill_proficiency_levels (NOVICE=1 … MASTER=6). */
export const VRIO_MAX_PROFICIENCY_RANK = 6 as const;

export const VRIO_VERDICTS = [
  "CAPABILITY_GAP", // demanded by positions, held by NOBODY — an absence, never an advantage
  "DISADVANTAGE", // not valuable — the org spends on something the market does not reward
  "PARITY", // valuable but common — table stakes
  "TEMPORARY_ADVANTAGE", // valuable + rare, but cheap to imitate
  "UNUSED_ADVANTAGE", // valuable + rare + hard to imitate, but the org is not set up to exploit it
  "SUSTAINED_ADVANTAGE", // all four
] as const;
export const VrioVerdictSchema = z.enum(VRIO_VERDICTS);
export type VrioVerdict = z.infer<typeof VrioVerdictSchema>;

export const VrioCapabilityItemSchema = z.object({
  skillGroupId: z.uuid(),
  skillGroupName: z.string(),
  skillCount: z.number().int().min(0), // skills of this group that are in play (held or required)

  // ---- dimensions: PERCENTILE within this org's capability set, each [0,1] ----
  value: z.number().min(0).max(1),
  rarity: z.number().min(0).max(1),
  inimitability: z.number().min(0).max(1),
  organization: z.number().min(0).max(1),

  // ---- the boolean reading of each dimension against VRIO_THRESHOLDS ----
  isValuable: z.boolean(),
  isRare: z.boolean(),
  isInimitable: z.boolean(),
  isOrganized: z.boolean(),
  verdict: VrioVerdictSchema,

  // ---- raw evidence: every dimension recomputable by hand from these ----
  evidence: z.object({
    // the un-ranked measures the percentiles above were computed from
    valueRaw: z.number().min(0).max(1),
    rarityRaw: z.number().min(0).max(1),
    inimitabilityRaw: z.number().min(0).max(1),
    organizationRaw: z.number().min(0).max(1),
    // value
    positionsRequiring: z.number().int().min(0),
    criticalPositions: z.number().int().min(0),
    avgCompensationBandEur: z.number().nullable(), // null when no requiring position has a band
    econPercentile: z.number().min(0).max(1),
    criticalityShare: z.number().min(0).max(1),
    // rarity
    holders: z.number().int().min(0),
    headcount: z.number().int().min(0),
    // inimitability
    avgHeldRank: z.number().nullable(), // 1..6, null when nobody holds it
    verifiedShare: z.number().min(0).max(1),
    evidenceShare: z.number().min(0).max(1),
    // organization
    totalRequirements: z.number().int().min(0), // (position, skill) pairs demanded
    coveredRequirements: z.number().int().min(0), // …whose incumbent actually holds the skill
  }),
});
export type VrioCapabilityItem = z.infer<typeof VrioCapabilityItemSchema>;

export const VrioScorecardSchema = z.object({
  items: z.array(VrioCapabilityItemSchema),
  total: z.number().int().min(0),
  headcount: z.number().int().min(0),
  /** Count of items per verdict — the board-level summary. */
  summary: z.object({
    CAPABILITY_GAP: z.number().int().min(0),
    DISADVANTAGE: z.number().int().min(0),
    PARITY: z.number().int().min(0),
    TEMPORARY_ADVANTAGE: z.number().int().min(0),
    UNUSED_ADVANTAGE: z.number().int().min(0),
    SUSTAINED_ADVANTAGE: z.number().int().min(0),
  }),
  /** The rules applied, echoed so the reader never has to trust an undocumented constant. */
  thresholds: z.object({
    value: z.number(),
    rarity: z.number(),
    inimitability: z.number(),
    organization: z.number(),
  }),
  weights: z.object({
    value: z.object({ econ: z.number(), crit: z.number() }),
    inimitability: z.object({ depth: z.number(), verified: z.number(), evidence: z.number() }),
  }),
  generatedAt: z.string(),
});
export type VrioScorecard = z.infer<typeof VrioScorecardSchema>;
