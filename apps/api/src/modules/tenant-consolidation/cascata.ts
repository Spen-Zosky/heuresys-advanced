/**
 * apps/api/src/modules/tenant-consolidation/cascata.ts — la cascata di una decisione
 * (piano docs/piani/PIANO_registro-corse-consolidamento_20261114.md, richiesta di Enzo del 2026-11-14).
 *
 * Una voce del modello non vive da sola: un'unità ha un'unità madre (prerequisito) e porta posizioni e
 * obiettivi (conseguenze); una posizione sta in un'unità e chiede competenze e indicatori; un processo ha
 * obiettivi e indicatori. La cascata si ricava dai legami del CONTENUTO del modello (le colonne *_code delle
 * tabelle sys_blueprint_content_*), mai da un elenco scritto a mano, e si traduce nelle proposte della
 * stessa sessione che parlano di quelle voci. Chi decide la vede prima di confermare; «Aggiorna cascata»
 * registra la stessa scelta anche sulle proposte della cascata ancora senza decisione.
 */
import type { CascadeItem, ConsolidationGroup, ConsolidationProposal, Decision, ProposalOutcome } from "@heuresys/shared";
import type { DbConnector } from "./repository.js";

type Relazione = "PREREQUISITO" | "CONSEGUENZA";
interface Legame { relation: Relazione; group: ConsolidationGroup; key: string }

/**
 * I legami di una voce del modello, per gruppo. Le chiavi sono quelle di sorgenti.ts: il codice della voce
 * (indicatori e obiettivi con il prefisso KPI:/GOAL:). Parametri: $1 versione, $2 chiavi della proposta.
 */
const LEGAMI: Record<ConsolidationGroup, string> = {
  ORGANIZATION: `
    SELECT 'PREREQUISITO' AS relation, 'ORGANIZATION' AS grp, u.blueprint_content_unit_parent_code AS key
      FROM sys.sys_blueprint_content_units u
     WHERE u.blueprint_content_unit_version_id = $1 AND u.blueprint_content_unit_code = ANY($2)
       AND u.blueprint_content_unit_parent_code IS NOT NULL
    UNION ALL
    SELECT 'CONSEGUENZA', 'POSITIONS_ROLES', p.blueprint_content_position_code
      FROM sys.sys_blueprint_content_positions p
     WHERE p.blueprint_content_position_version_id = $1 AND p.blueprint_content_position_unit_code = ANY($2)
    UNION ALL
    SELECT 'CONSEGUENZA', 'INDICATORS_GOALS', 'GOAL:' || g.blueprint_content_goal_code
      FROM sys.sys_blueprint_content_goals g
     WHERE g.blueprint_content_goal_version_id = $1 AND g.blueprint_content_goal_unit_code = ANY($2)`,
  POSITIONS_ROLES: `
    SELECT 'PREREQUISITO' AS relation, 'ORGANIZATION' AS grp, p.blueprint_content_position_unit_code AS key
      FROM sys.sys_blueprint_content_positions p
     WHERE p.blueprint_content_position_version_id = $1 AND p.blueprint_content_position_code = ANY($2)
       AND p.blueprint_content_position_unit_code IS NOT NULL
    UNION ALL
    SELECT 'CONSEGUENZA', 'SKILLS', r.blueprint_content_psr_skill_code
      FROM sys.sys_blueprint_content_position_skill_requirements r
     WHERE r.blueprint_content_psr_version_id = $1 AND r.blueprint_content_psr_position_code = ANY($2)
    UNION ALL
    SELECT 'CONSEGUENZA', 'INDICATORS_GOALS', 'KPI:' || k.blueprint_content_kpi_code
      FROM sys.sys_blueprint_content_kpis k
     WHERE k.blueprint_content_kpi_version_id = $1 AND k.blueprint_content_kpi_owner_position_code = ANY($2)`,
  SKILLS: `SELECT NULL::text AS relation, NULL::text AS grp, NULL::text AS key WHERE false`,
  PROCESSES: `
    SELECT 'CONSEGUENZA' AS relation, 'INDICATORS_GOALS' AS grp, 'GOAL:' || g.blueprint_content_goal_code AS key
      FROM sys.sys_blueprint_content_goals g
     WHERE g.blueprint_content_goal_version_id = $1 AND g.blueprint_content_goal_process_code = ANY($2)
    UNION ALL
    SELECT 'CONSEGUENZA', 'INDICATORS_GOALS', 'KPI:' || k.blueprint_content_kpi_code
      FROM sys.sys_blueprint_content_kpis k
      JOIN sys.sys_blueprint_content_goals g
        ON g.blueprint_content_goal_version_id = k.blueprint_content_kpi_version_id
       AND g.blueprint_content_goal_code = k.blueprint_content_kpi_goal_code
     WHERE k.blueprint_content_kpi_version_id = $1 AND g.blueprint_content_goal_process_code = ANY($2)`,
  INDICATORS_GOALS: `
    SELECT 'PREREQUISITO' AS relation, 'INDICATORS_GOALS' AS grp, 'GOAL:' || k.blueprint_content_kpi_goal_code AS key
      FROM sys.sys_blueprint_content_kpis k
     WHERE k.blueprint_content_kpi_version_id = $1 AND 'KPI:' || k.blueprint_content_kpi_code = ANY($2)
       AND k.blueprint_content_kpi_goal_code IS NOT NULL
    UNION ALL
    SELECT 'PREREQUISITO', 'PROCESSES', g.blueprint_content_goal_process_code
      FROM sys.sys_blueprint_content_goals g
     WHERE g.blueprint_content_goal_version_id = $1 AND 'GOAL:' || g.blueprint_content_goal_code = ANY($2)
       AND g.blueprint_content_goal_process_code IS NOT NULL
    UNION ALL
    SELECT 'PREREQUISITO', 'ORGANIZATION', g.blueprint_content_goal_unit_code
      FROM sys.sys_blueprint_content_goals g
     WHERE g.blueprint_content_goal_version_id = $1 AND 'GOAL:' || g.blueprint_content_goal_code = ANY($2)
       AND g.blueprint_content_goal_unit_code IS NOT NULL`,
};

/** I campi che la decisione porta con sé oltre a nome, codice e descrizione (per gruppo). */
export const CAMPI_IN_CASCATA: Partial<Record<ConsolidationGroup, string[]>> = {
  ORGANIZATION: ["SITE", "PLANNED_HEADCOUNT", "HEADCOUNT_NOTE"],
};

interface RigaProposta {
  id: string;
  grp: ConsolidationGroup;
  outcome: ProposalOutcome;
  pkeys: string[];
  decision: Decision | null;
}

/** La cascata di una proposta: le proposte della sessione legate alle sue voci nel modello. */
export async function cascataDi(
  db: DbConnector,
  variantVersionId: string,
  p: Pick<ConsolidationProposal, "proposalId" | "consolidationId" | "group" | "prototypeKeys">,
): Promise<CascadeItem[]> {
  if (p.prototypeKeys.length === 0) return [];
  const { rows: legami } = await db.query<{ relation: Relazione; grp: ConsolidationGroup; key: string }>(
    LEGAMI[p.group], [variantVersionId, p.prototypeKeys],
  );
  const validi: Legame[] = legami.filter((l) => l.key).map((l) => ({ relation: l.relation, group: l.grp, key: l.key }));
  if (validi.length === 0) return [];
  const { rows } = await db.query<RigaProposta>(
    `SELECT p.tenant_consolidation_proposal_id AS id, p.tenant_consolidation_proposal_group AS grp,
            p.tenant_consolidation_proposal_outcome AS outcome, p.tenant_consolidation_proposal_prototype_keys AS pkeys,
            (SELECT d.tenant_consolidation_decision_value FROM sys.sys_tenant_consolidation_decisions d
              WHERE d.tenant_consolidation_decision_proposal_id = p.tenant_consolidation_proposal_id
                AND NOT EXISTS (SELECT 1 FROM sys.sys_tenant_consolidation_decisions s
                                 WHERE s.tenant_consolidation_decision_supersedes_id = d.tenant_consolidation_decision_id)
              ORDER BY d.tenant_consolidation_decision_decided_at DESC LIMIT 1) AS decision
       FROM sys.sys_tenant_consolidation_proposals p
      WHERE p.tenant_consolidation_proposal_consolidation_id = $1
        AND p.tenant_consolidation_proposal_superseded_at IS NULL
        AND p.tenant_consolidation_proposal_id <> $2
        AND p.tenant_consolidation_proposal_prototype_keys && $3::text[]`,
    [p.consolidationId, p.proposalId, validi.map((l) => l.key)],
  );
  const out: CascadeItem[] = [];
  for (const r of rows) {
    const l = validi.find((x) => x.group === r.grp && r.pkeys.includes(x.key));
    if (!l) continue;
    out.push({ proposalId: r.id, relation: l.relation, group: r.grp, outcome: r.outcome, prototypeKeys: r.pkeys, decision: r.decision });
  }
  // prima i prerequisiti, poi le conseguenze, nell'ordine dei gruppi
  return out.sort((a, b) => (a.relation === b.relation ? 0 : a.relation === "PREREQUISITO" ? -1 : 1));
}

/** La scelta che «Aggiorna cascata» registra su una proposta della cascata, dato l'esito che l'agente le ha dato. */
export function sceltaInCascata(principale: Decision, esito: ProposalOutcome): Decision | null {
  if (principale !== "CONFERMATA" && principale !== "ADOTTATA") return null; // si propagano solo le scelte che allineano
  if (esito === "CORRISPONDENZA") return "CONFERMATA";
  if (esito === "LACUNA") return "ADOTTATA";
  return null; // una personalizzazione resta una scelta della persona
}
