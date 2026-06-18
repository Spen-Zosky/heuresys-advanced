/**
 * apps/api/src/modules/tenant-materialization/blueprints.ts
 * #4 WI-C — deterministic archetype catalog. An archetype is a tenant-agnostic org
 * structure (org-units + positions) that the generator materializes into a target tenant.
 * Codes use the archetype's own namespace (e.g. RBR-*) so they never collide with a
 * tenant's pre-existing data — applying to a populated tenant only adds the archetype's
 * rows (ON CONFLICT skips the rest). 3 confirmed design facts (PLAN §9): the catalog is the
 * source of structure (no recommender), variants are thin headers, activation is a link row.
 * Slice-1 = org-units + positions only (users/assignments/skills/KPI = residuo).
 */

type OrgUnitType = "HEADQUARTERS" | "DIVISION" | "DEPARTMENT" | "TEAM" | "BRANCH" | "OFFICE";
type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ArchetypeOrgUnit {
  code: string;
  name: string;
  type: OrgUnitType;
  /** parent org-unit code (must appear earlier in the list — parents first). */
  parentCode: string | null;
}
export interface ArchetypePosition {
  code: string;
  title: string;
  orgUnitCode: string;
  criticality: Criticality;
  economicWeight: number;
}
export interface Archetype {
  key: string;
  label: string;
  orgUnits: ArchetypeOrgUnit[];
  positions: ArchetypePosition[];
}

// RETAIL_BANK_REFERENCE — a compact, deterministic retail-bank skeleton: 1 HQ, 3 directorates,
// 3 branches; key leadership + per-branch manager/teller. Distilled from the RTL reference seed
// (db/scripts/seed-reference-bank.ts) but namespaced (RBR-) and slimmed for a generator slice.
const RETAIL_BANK_REFERENCE: Archetype = {
  key: "RETAIL_BANK_REFERENCE",
  label: "Retail Bank — reference org skeleton (HQ + directorates + 3 branches)",
  orgUnits: [
    { code: "RBR-HQ", name: "Headquarters", type: "HEADQUARTERS", parentCode: null },
    { code: "RBR-DIR-RETAIL", name: "Retail Banking Directorate", type: "DIVISION", parentCode: "RBR-HQ" },
    { code: "RBR-DIR-RISK", name: "Risk & Compliance Directorate", type: "DIVISION", parentCode: "RBR-HQ" },
    { code: "RBR-DIR-OPS", name: "Operations Directorate", type: "DIVISION", parentCode: "RBR-HQ" },
    { code: "RBR-BR-MILANO", name: "Milano Branch", type: "BRANCH", parentCode: "RBR-DIR-RETAIL" },
    { code: "RBR-BR-ROMA", name: "Roma Branch", type: "BRANCH", parentCode: "RBR-DIR-RETAIL" },
    { code: "RBR-BR-TORINO", name: "Torino Branch", type: "BRANCH", parentCode: "RBR-DIR-RETAIL" },
  ],
  positions: [
    { code: "RBR-CEO", title: "Chief Executive Officer", orgUnitCode: "RBR-HQ", criticality: "CRITICAL", economicWeight: 1.0 },
    { code: "RBR-CFO", title: "Chief Financial Officer", orgUnitCode: "RBR-HQ", criticality: "CRITICAL", economicWeight: 0.9 },
    { code: "RBR-DIR-RETAIL-HEAD", title: "Head of Retail Banking", orgUnitCode: "RBR-DIR-RETAIL", criticality: "HIGH", economicWeight: 0.7 },
    { code: "RBR-DIR-RISK-HEAD", title: "Head of Risk & Compliance", orgUnitCode: "RBR-DIR-RISK", criticality: "HIGH", economicWeight: 0.7 },
    { code: "RBR-DIR-OPS-HEAD", title: "Head of Operations", orgUnitCode: "RBR-DIR-OPS", criticality: "HIGH", economicWeight: 0.7 },
    { code: "RBR-BR-MILANO-MGR", title: "Branch Manager (Milano)", orgUnitCode: "RBR-BR-MILANO", criticality: "HIGH", economicWeight: 0.5 },
    { code: "RBR-BR-MILANO-TELLER", title: "Teller (Milano)", orgUnitCode: "RBR-BR-MILANO", criticality: "MEDIUM", economicWeight: 0.3 },
    { code: "RBR-BR-ROMA-MGR", title: "Branch Manager (Roma)", orgUnitCode: "RBR-BR-ROMA", criticality: "HIGH", economicWeight: 0.5 },
    { code: "RBR-BR-ROMA-TELLER", title: "Teller (Roma)", orgUnitCode: "RBR-BR-ROMA", criticality: "MEDIUM", economicWeight: 0.3 },
    { code: "RBR-BR-TORINO-MGR", title: "Branch Manager (Torino)", orgUnitCode: "RBR-BR-TORINO", criticality: "HIGH", economicWeight: 0.5 },
    { code: "RBR-BR-TORINO-TELLER", title: "Teller (Torino)", orgUnitCode: "RBR-BR-TORINO", criticality: "MEDIUM", economicWeight: 0.3 },
  ],
};

const ARCHETYPES: Record<string, Archetype> = {
  [RETAIL_BANK_REFERENCE.key]: RETAIL_BANK_REFERENCE,
};

export function getArchetype(key: string): Archetype | null {
  return ARCHETYPES[key] ?? null;
}
export function listArchetypes(): Archetype[] {
  return Object.values(ARCHETYPES);
}
