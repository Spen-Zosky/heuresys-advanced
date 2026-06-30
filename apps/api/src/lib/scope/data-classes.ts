/**
 * apps/api/src/lib/scope/data-classes.ts — F2 of the two-axis authorization model (ADR-0027).
 *
 * The DATA-CLASS taxonomy: every resource that carries person-level data is tagged with exactly
 * one class, and the class selects which axis gates it (ADR-0027 §2.4):
 *   PERSONAL / COMPENSATION / SKILL / EVALUATION  → SENSITIVE → ORGANIZATIONAL axis (reports-to)
 *   ACTIVITY                                       → FUNCTIONAL axis (team/process membership)
 *
 * F2 only CLASSIFIES — it does not enforce. F3 consumes `dataClassOf` to gate sensitive reads
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
 * Borderline resources deliberately LEFT UNMAPPED at F2 (treated as non-sensitive until Enzo
 * confirms at F3): `learning`, `mentorship`, `engagement_feedback`, `matching`, `capability`,
 * `surveys`, `training_initiative`. They are development/derived/process data, not squarely one
 * of the four categories.
 */
export const RESOURCE_DATA_CLASS: Readonly<Record<string, DataClass>> = {
  // PERSONAL
  user: "PERSONAL",
  user_profile: "PERSONAL",
  document: "PERSONAL",
  certification: "PERSONAL",
  career: "PERSONAL",
  // COMPENSATION
  compensation_intelligence: "COMPENSATION",
  // SKILL
  skill: "SKILL",
  gap_analysis: "SKILL",
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
