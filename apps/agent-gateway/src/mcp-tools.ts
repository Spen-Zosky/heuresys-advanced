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
import type { AtlasOperationResolver } from "./atlas-resolver.js";

/**
 * Sostituisce i `:segnaposto` del percorso con i parametri, e rifiuta ciò che non torna.
 *
 * Due rifiuti, e sono la stessa regola vista da due lati: un segnaposto senza valore
 * lascerebbe un percorso letterale `/:id` che l'API interpreterebbe come un id chiamato
 * «:id»; un valore che contiene `/` o `?` uscirebbe dal percorso previsto e ne
 * raggiungerebbe un altro — che è il modo in cui una lettura diventa qualcos'altro.
 * Il resolver ha già detto QUALE percorso; qui si difende il fatto che resti quello.
 */
export function bindPath(template: string, params: Record<string, unknown>): string {
  return template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, nome: string) => {
    const v = params[nome];
    if (v === undefined || v === null || v === "") {
      throw new Error(`parametro di percorso mancante: ${nome}`);
    }
    const s = String(v);
    if (/[/?#]/.test(s)) throw new Error(`parametro di percorso non ammesso: ${nome}`);
    return encodeURIComponent(s);
  });
}

export function buildHeuresysMcp(client: HeuresysClient, operations?: AtlasOperationResolver) {
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

  // --- IL CATALOGO GENERICO (ADR-0033, #156) --------------------------------------
  // Tre strumenti che non nominano nessuna entità: il dominio lo porta la mappa generata
  // dall'atlante. Si montano SOLO se un resolver c'è ed è non vuoto — un catalogo che
  // annuncia capacità e poi nega ogni chiamata insegna al modello a insistere, e riempie
  // il diario di dinieghi che non sono decisioni di sicurezza ma un errore di montaggio.
  const generici = operations && !operations.isEmpty()
    ? [
        tool(
          "hrx_concepts_search",
          "Elenca i concetti di dominio che l'agente puo' interrogare (perimetri aperti). " +
            "Filtro testuale facoltativo. Ritorna id e operazioni disponibili.",
          { query: z.string().optional() },
          async (a: { query?: string }) => {
            const q = (a.query ?? "").trim().toLowerCase();
            const ids = operations
              .conceptIds()
              .filter((id) => q === "" || id.toLowerCase().includes(q));
            return ok({
              concepts: ids.map((id) => ({
                conceptId: id,
                operations: Object.keys(operations.operationsOf(id)).sort(),
              })),
            });
          },
        ),
        tool(
          "hrx_concept_describe",
          "Descrive un concetto: l'elenco CHIUSO delle sue operazioni, con metodo, percorso " +
            "e permesso richiesto. Cio' che non compare qui non e' invocabile.",
          { conceptId: z.string() },
          async (a: { conceptId: string }) => {
            const ops = operations.operationsOf(a.conceptId);
            // Un concetto ignoto NON e' un elenco vuoto: la differenza fra «non esiste» e
            // «esiste e non fa nulla» e' esattamente cio' che il modello deve poter dire.
            if (Object.keys(ops).length === 0) {
              return ok({ conceptId: a.conceptId, known: false, operations: {} });
            }
            return ok({ conceptId: a.conceptId, known: true, operations: ops });
          },
        ),
        tool(
          "hrx_entity_query",
          "Esegue un'operazione dichiarata da hrx_concept_describe. Il metodo e il percorso " +
            "li decide la mappa, non questo input: dichiararsi in lettura non cambia cio' che " +
            "l'operazione e'. params riempie i segnaposto del percorso; query va in querystring.",
          {
            conceptId: z.string(),
            operationId: z.string(),
            params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
            query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
          },
          async (a: {
            conceptId: string;
            operationId: string;
            params?: Record<string, string | number | boolean>;
            query?: Record<string, string | number | boolean>;
          }) => {
            const op = operations.operationsOf(a.conceptId)[a.operationId];
            // Ridondante col gate, e deve restarlo: il gate e' la guardia di sicurezza, questo
            // e' l'errore leggibile per il modello. Se un giorno il gate venisse invocato in
            // modo diverso, questa riga resta l'ultima che impedisce una chiamata inventata.
            if (!op) {
              throw new Error(
                `operazione non dichiarata: ${a.conceptId}.${a.operationId} — usa hrx_concept_describe`,
              );
            }
            const percorso = bindPath(op.path, a.params ?? {});
            const qs = new URLSearchParams(
              Object.entries(a.query ?? {}).map(([k, v]) => [k, String(v)] as [string, string]),
            ).toString();
            const base = `/${a.conceptId}${percorso === "/" ? "" : percorso}`;
            return ok(await client.call(op.method, qs ? `${base}?${qs}` : base));
          },
        ),
      ]
    : [];

  return createSdkMcpServer({
    name: "heuresys",
    tools: [
      ...generici,
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
      // WI-C: costruzione di un'azienda da un MODELLO (WRITE; utente di servizio
      // PLATFORM_ADMIN). Prendeva la chiave di un modello cablato in TypeScript, ritirato
      // da #132 F3 (E29): qualunque azienda si costruisse nasceva la stessa banca.
      // mode=plan is a dry-run (no writes); mode=apply mutates. Both route through the HITL
      // gate (classified WRITE by name in mcp-tool-names.ts → canUseTool approval).
      tool(
        "hrx_tenant_materialize",
        "Build a tenant (org-units, positions, skills, KPIs) from a MODEL version. mode=plan (dry-run) | apply (WRITE). PLATFORM_ADMIN.",
        { tenantId: z.string(), variantVersionId: z.string(), mode: z.enum(["plan", "apply"]) },
        async (a: { tenantId: string; variantVersionId: string; mode: "plan" | "apply" }) =>
          ok(await client.call("POST", "/tenant-materialization", a)),
      ),
    ],
  });
}
