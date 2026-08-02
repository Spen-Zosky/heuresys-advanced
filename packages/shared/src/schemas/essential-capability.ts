/**
 * packages/shared/src/schemas/essential-capability.ts — #55 F/F1.
 *
 * The Essential Capability Ranker answers the CFO question "where do I invest L&D
 * budget?" by ranking the skills the organization actually depends on. Every field is a
 * declared, drillable component — the score is never a black box.
 *
 * Formula (all components in [0,1] unless noted), declared here so the contract IS the spec:
 *   essentiality = wEcon·econ + wCrit·crit + wScarce·scarcity      (weights below, sum 1)
 *   investmentPriority = essentiality · (1 − maturity)
 * i.e. a capability that is economically valuable, critical and scarce, yet held at a low
 * average level, is where a euro of training returns the most.
 */
import { z } from "zod";

/** Declared weights of the essentiality blend (sum = 1). Surfaced so the UI can show them. */
export const ESSENTIAL_CAPABILITY_WEIGHTS = { econ: 0.4, crit: 0.3, scarcity: 0.3 } as const;

export const EssentialCapabilityItemSchema = z.object({
  skillId: z.uuid(),
  skillCode: z.string(),
  skillName: z.string(),
  /**
   * Il gruppo a cui la skill appartiene — il ponte verso la scorecard VRIO, che ragiona per
   * gruppo e non per skill. Aggiunto S1041: senza di esso l'unico aggancio possibile era il
   * NOME, e nome-skill contro nome-gruppo non coincide mai (misurato: 0 su 10). Nullable
   * perche' non tutte le skill del catalogo sono classificate.
   */
  skillGroupId: z.uuid().nullable(),
  // demand side
  positionsRequiring: z.number().int().min(0),
  criticalPositions: z.number().int().min(0),
  // components (each [0,1], the drill-down)
  econ: z.number().min(0).max(1), // percentile of the avg comp-band value of requiring positions
  crit: z.number().min(0).max(1), // share of requiring positions that are CRITICAL-weighted
  scarcity: z.number().min(0).max(1), // 1 − coverage: how under-supplied vs demand
  maturity: z.number().min(0).max(1), // avg held level of current holders (quality), 0 if none
  holders: z.number().int().min(0),
  // outputs (0-100)
  essentialityScore: z.number().min(0).max(100),
  investmentPriority: z.number().min(0).max(100),
});
export type EssentialCapabilityItem = z.infer<typeof EssentialCapabilityItemSchema>;

export const EssentialCapabilityRankingSchema = z.object({
  items: z.array(EssentialCapabilityItemSchema),
  total: z.number().int().min(0),
  weights: z.object({
    econ: z.number(),
    crit: z.number(),
    scarcity: z.number(),
  }),
});
export type EssentialCapabilityRanking = z.infer<typeof EssentialCapabilityRankingSchema>;
