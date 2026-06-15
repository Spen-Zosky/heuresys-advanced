/**
 * MCP tool catalogue over heuresys /v1 (#9 WI-B). Wraps the HeuresysClient so the
 * Agent SDK can call the platform as the calling principal. Reads are auto-allowed;
 * writes are gated by canUseTool (sdk-agent.ts). Permission codes are the REAL ones
 * verified in PLATFORM_MAP / the forensic pass; the server enforces them via
 * requirePermission — this catalogue only mirrors the surface.
 *
 * Principal note (hybrid auth): job-families + blueprint-* catalogue writes need the
 * SERVICE user (PLATFORM_ADMIN); everything else can run as the forwarded user. The
 * principal is chosen by which HeuresysClient (session) is injected here.
 *
 * Reference skeleton — SDK symbol names pinned to @anthropic-ai/claude-agent-sdk.
 */
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { HeuresysClient } from "./heuresys-client.js";

export function buildHeuresysMcp(client: HeuresysClient) {
  const ok = (d: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(d) }] });

  const rd = (n: string, p: string) =>
    tool(n, `GET ${p}`, {}, async () => ok(await client.call("GET", p)));
  const rdId = (n: string, base: string) =>
    tool(n, `GET ${base}/:id`, { id: z.string() }, async (a: { id: string }) =>
      ok(await client.call("GET", `${base}/${a.id}`)),
    );
  const up = (n: string, base: string) =>
    tool(
      n,
      `Upsert ${base} (WRITE)`,
      { id: z.string().optional(), payload: z.record(z.string(), z.any()) },
      async (a: { id?: string; payload: Record<string, unknown> }) =>
        ok(await client.call(a.id ? "PATCH" : "POST", a.id ? `${base}/${a.id}` : base, a.payload)),
    );
  const putUp = (n: string, base: string) =>
    tool(n, `PUT-upsert ${base} (WRITE)`, { payload: z.record(z.string(), z.any()) }, async (a: { payload: Record<string, unknown> }) =>
      ok(await client.call("PUT", base, a.payload)),
    );
  const del = (n: string, base: string) =>
    tool(n, `DELETE ${base}/:id (WRITE)`, { id: z.string() }, async (a: { id: string }) =>
      ok(await client.call("DELETE", `${base}/${a.id}`)),
    );

  return createSdkMcpServer({
    name: "heuresys",
    tools: [
      // --- reads (auto-approved) ---
      rd("hrx_org_units_list", "/organization-units"),
      rdId("hrx_org_units_get", "/organization-units"),
      rd("hrx_positions_list", "/positions"),
      rdId("hrx_positions_get", "/positions"),
      rd("hrx_job_roles_list", "/job-roles"),
      rd("hrx_job_families_list", "/job-families"),
      rd("hrx_skills_list", "/skills"),
      rd("hrx_skill_prof_levels", "/skill-proficiency-levels"),
      rd("hrx_kpi_defs_list", "/kpi-definitions"),
      rd("hrx_process_kpi_templates_list", "/process-kpi-templates"),
      rd("hrx_orgunit_kpi_templates_list", "/organization-unit-kpi-templates"),
      rd("hrx_typing_profiles_list", "/enterprise-typing-profiles"),
      rd("hrx_blueprint_families_list", "/blueprint-families"),
      rd("hrx_blueprint_variants_list", "/blueprint-variants"),
      rd("hrx_blueprint_processes_list", "/blueprint-processes"),
      rd("hrx_blueprint_activations_list", "/blueprint-activations"),
      rd("hrx_blueprint_overrides_list", "/blueprint-overrides"),
      // --- writes (gated by canUseTool) ---
      // user OR service principal:
      up("hrx_org_units_upsert", "/organization-units"), // organization_unit:{create,update}
      del("hrx_org_units_delete", "/organization-units"), // organization_unit:delete
      up("hrx_positions_upsert", "/positions"), // position:{create,update}
      del("hrx_positions_delete", "/positions"), // position:delete
      up("hrx_job_roles_upsert", "/job-roles"), // job_role:{create,update} (no delete)
      up("hrx_skills_upsert", "/skills"), // skill:{create,update} (no delete)
      up("hrx_kpi_defs_upsert", "/kpi-definitions"), // kpi:{create,update}
      del("hrx_kpi_defs_delete", "/kpi-definitions"), // kpi:delete
      putUp("hrx_process_kpi_template_upsert", "/process-kpi-templates"), // bpm_process:update
      putUp("hrx_orgunit_kpi_template_upsert", "/organization-unit-kpi-templates"), // bpm_process:update
      putUp("hrx_typing_profile_upsert", "/enterprise-typing-profiles"), // enterprise_typing:update (tenant-admin)
      up("hrx_blueprint_activation_upsert", "/blueprint-activations"), // blueprint:activate (tenant-admin)
      putUp("hrx_blueprint_override_upsert", "/blueprint-overrides"), // blueprint:override (tenant-admin)
      // SERVICE principal (PLATFORM_ADMIN): job-families + blueprint catalogue --
      up("hrx_job_families_upsert", "/job-families"), // PLATFORM_ADMIN service-gate
      del("hrx_job_families_delete", "/job-families"),
      up("hrx_blueprint_families_upsert", "/blueprint-families"), // blueprint:activate/override (PLATFORM_ADMIN)
      up("hrx_blueprint_variants_upsert", "/blueprint-variants"),
      up("hrx_blueprint_processes_upsert", "/blueprint-processes"),
      // FUTURE (Phase B, WI-C): hrx_tenant_materialize — per-tenant generator, not built yet.
    ],
  });
}
