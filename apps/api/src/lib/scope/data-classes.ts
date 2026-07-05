/**
 * apps/api/src/lib/scope/data-classes.ts — F2 of the two-axis authorization model (ADR-0027).
 *
 * The DATA-CLASS taxonomy: every resource that carries person-level data is tagged with exactly
 * one class, and the class selects which axis gates it (ADR-0027 §2.4):
 *   PERSONAL / COMPENSATION / SKILL / EVALUATION  → SENSITIVE → ORGANIZATIONAL axis (reports-to)
 *   ACTIVITY                                       → FUNCTIONAL axis (team/process membership)
 *
 * F2 classifies AND (since D-51) prescribes: `lib/scope/gate.ts` refuses to boot the app if a
 * read route on a resource classified sensitive here lacks a `config.orgGate` declaration, so a
 * new sensitive module can no longer omit the org gate silently. F3 enforces at the data level
 * (a manager may read a report's COMPENSATION only if the report is in their org sub-tree). A
 * resource NOT in the map carries no person-level sensitive data and stays RBAC+tenant-gated
 * (blueprints, processes, tenants, roles, org structure, …).
 *
 * Keys are the RBAC `auth_permission_resource` values (verified to exist — see the drift test).
 */

/** The closed set of data classes (Enzo's four sensitive categories + the functional one). */
export type DataClass = "PERSONAL" | "COMPENSATION" | "SKILL" | "EVALUATION" | "ACTIVITY";

/** Classes gated by the ORGANIZATIONAL axis (sensitive personal data — I18/I20). */
export const SENSITIVE_DATA_CLASSES: ReadonlySet<DataClass> = new Set<DataClass>([
  "PERSONAL",
  "COMPENSATION",
  "SKILL",
  "EVALUATION",
]);

/**
 * resource (auth_permission_resource) → data class. Only person-level resources appear here.
 *
 * Classification (Enzo's four sensitive categories):
 *  - PERSONAL     personal identity / contacts / documents / career aspirations
 *  - COMPENSATION pay, variable pay, comp recommendations
 *  - SKILL        competency evidence + gaps
 *  - EVALUATION   assessments, performance KPIs/goals/OKRs, succession & talent predictions
 *  - ACTIVITY     team/process work items (added at F4 — none mapped yet)
 *
 * Borderline resources resolved by Enzo (2026-07-01): `learning` + `training_initiative`
 * (formazione), `matching` + `capability` (matching/capacità, derived from competencies) → SKILL;
 * `mentorship` → PERSONAL — all RISERVATI. `engagement_feedback` + `surveys` (feedback/clima) stay
 * UNMAPPED → NORMAL (Enzo: often anonymous/aggregated by policy, not org-gated).
 */
export const RESOURCE_DATA_CLASS: Readonly<Record<string, DataClass>> = {
  // PERSONAL
  user: "PERSONAL",
  user_profile: "PERSONAL",
  document: "PERSONAL",
  certification: "PERSONAL",
  career: "PERSONAL",
  mentorship: "PERSONAL", // Enzo 2026-07-01: riservato (personal development relationship)
  // COMPENSATION
  compensation_intelligence: "COMPENSATION",
  // SKILL (competency + development + competency-derived)
  skill: "SKILL",
  gap_analysis: "SKILL",
  learning: "SKILL", // Enzo 2026-07-01: formazione riservata
  training_initiative: "SKILL", // Enzo 2026-07-01: formazione riservata
  matching: "SKILL", // Enzo 2026-07-01: matching riservato (derived from competencies)
  capability: "SKILL", // Enzo 2026-07-01: capacità riservate (derived from competencies)
  // EVALUATION
  assessment: "EVALUATION",
  kpi: "EVALUATION",
  goal: "EVALUATION",
  okr: "EVALUATION",
  career_succession: "EVALUATION",
  predictions: "EVALUATION",
  insights: "EVALUATION",
};

/** The data class of a resource, or null when the resource carries no person-level data. */
export function dataClassOf(resource: string): DataClass | null {
  return RESOURCE_DATA_CLASS[resource] ?? null;
}

/** True iff the class is gated by the organizational axis (sensitive personal data). */
export function isSensitiveClass(dataClass: DataClass): boolean {
  return SENSITIVE_DATA_CLASSES.has(dataClass);
}

/** True iff the resource carries SENSITIVE person-level data (→ organizational axis at F3). */
export function isSensitiveResource(resource: string): boolean {
  const c = dataClassOf(resource);
  return c !== null && isSensitiveClass(c);
}
