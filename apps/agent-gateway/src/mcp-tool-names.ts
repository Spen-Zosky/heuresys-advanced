/**
 * Canonical MCP tool-name allowlist for the write-gate (#9 WI-B, M-3).
 *
 * This is the SINGLE source of truth for "which tool names the agent is permitted
 * to invoke at all" — a deny-by-default defense-in-depth layer (I8) that runs BEFORE
 * the read/write branch in makeCanUseTool. The platform itself still enforces RBAC +
 * tenant (requirePermission), so this is belt-and-suspenders: an unknown / unlisted /
 * mis-spelled / future tool name is DENIED here regardless of what the model emits.
 *
 * The list is kept in lock-step with the tool catalogue in mcp-tools.ts (every `tool(n,…)`
 * name registered on the heuresys MCP server must appear here, and nothing else). When
 * a new tool is added to the catalogue, add its name here too — otherwise it is denied.
 *
 * SDK-free + pure data so it is unit-testable without the live @anthropic-ai/claude-agent-sdk.
 */

/**
 * Il CATALOGO GENERICO (ADR-0033, #156 — collegato in S1067).
 *
 * Tre strumenti che non nominano nessuna entità: quello che sanno fare lo dice
 * `docs/kb/atlas/agent-operations.json`, generato dall'atlante e dai perimetri decisi.
 * Aprire un perimetro nuovo non aggiunge una riga qui — ed è il punto: questo elenco
 * cresce solo quando cambia il *tipo* di capacità, non quando cambia il dominio.
 *
 * `hrx_entity_query` sta fra le LETTURE **per nome soltanto**, e non basterebbe: la sua
 * classe la decide il resolver dalla coppia (conceptId, operationId), non la stringa. Se
 * la coppia non si risolve la chiamata è `unresolved` → NEGATA, non «letta». La prova che
 * lo dimostra è che una `delete_by_id` su un perimetro di sola lettura **non esiste nella
 * mappa**, quindi non c'è niente da filtrare: non è bloccata, è inesistente.
 */
export const GENERIC_TOOL_NAMES = [
  "hrx_concepts_search",
  "hrx_concept_describe",
  "hrx_entity_query",
] as const;

/** Read tools (auto-allowed by the gate once allowlisted). */
export const READ_TOOL_NAMES = [
  "hrx_org_units_list",
  "hrx_org_units_get",
  "hrx_positions_list",
  "hrx_positions_get",
  "hrx_job_roles_list",
  "hrx_job_families_list",
  "hrx_skills_list",
  "hrx_skill_prof_levels",
  "hrx_kpi_defs_list",
  "hrx_process_kpi_templates_list",
  "hrx_orgunit_kpi_templates_list",
  "hrx_typing_profiles_list",
  "hrx_blueprint_families_list",
  "hrx_blueprint_variants_list",
  "hrx_blueprint_processes_list",
  "hrx_blueprint_activations_list",
  "hrx_blueprint_overrides_list",
] as const;

/** Write tools (allowlisted, but still routed through the HITL approval round-trip). */
export const WRITE_TOOL_NAMES = [
  "hrx_org_units_upsert",
  "hrx_org_units_delete",
  "hrx_positions_upsert",
  "hrx_positions_delete",
  "hrx_job_roles_upsert",
  "hrx_skills_upsert",
  "hrx_kpi_defs_upsert",
  "hrx_kpi_defs_delete",
  "hrx_process_kpi_template_upsert",
  "hrx_orgunit_kpi_template_upsert",
  "hrx_typing_profile_upsert",
  "hrx_blueprint_activation_upsert",
  "hrx_blueprint_override_upsert",
  "hrx_job_families_upsert",
  "hrx_job_families_delete",
  "hrx_blueprint_families_upsert",
  "hrx_blueprint_variants_upsert",
  "hrx_blueprint_processes_upsert",
  "hrx_tenant_materialize", // WI-C — dry-run plan + apply both gated (deny-by-default → allowlisted)
] as const;

/**
 * The default allowlist = every catalogue tool name (reads + writes). The MCP server
 * namespaces tools as `mcp__heuresys__<name>`; the gate sees the bare `<name>` (the
 * SDK strips the prefix before canUseTool). We allowlist BOTH forms so the gate is
 * robust whether it receives the bare or the namespaced name.
 */
export const MCP_TOOL_PREFIX = "mcp__heuresys__";

function withNamespace(names: readonly string[]): string[] {
  return names.flatMap((n) => [n, `${MCP_TOOL_PREFIX}${n}`]);
}

/** Frozen deny-by-default allowlist used as the gate's safe default. */
export const DEFAULT_TOOL_ALLOWLIST: ReadonlySet<string> = new Set([
  ...withNamespace(GENERIC_TOOL_NAMES),
  ...withNamespace(READ_TOOL_NAMES),
  ...withNamespace(WRITE_TOOL_NAMES),
]);

/** Strips the MCP namespace prefix if present (so classification works on the bare name). */
export function bareToolName(name: string): string {
  return name.startsWith(MCP_TOOL_PREFIX) ? name.slice(MCP_TOOL_PREFIX.length) : name;
}
