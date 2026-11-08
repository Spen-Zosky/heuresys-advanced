/**
 * apps/agent-gateway/src/operazione.ts — ADR-0053 A3, piano dei principi agentici voce T3b.
 *
 * QUALE OPERAZIONE DELL'ATLANTE FA UNA SCRITTURA. Il registro delle capacità (migrazione 000480)
 * elenca le operazioni con la coppia dell'atlante, concetto e operazione. Il cancello deve quindi
 * sapere, per ogni scrittura che l'agente chiede, quale coppia sta per eseguire:
 *
 *   · per lo strumento generico la coppia sta nell'input, e il metodo lo dice l'atlante;
 *   · per gli strumenti con un nome proprio la coppia si ricava da ciò che lo strumento chiama
 *     davvero (metodo e percorso, `mcp-tools.ts`), con la stessa regola con cui
 *     `docs/kb/tools/build_agent_operations.py` nomina le operazioni dell'atlante.
 *
 * Una prova (`test/operazione.test.ts`) invoca ogni strumento di scrittura del server MCP con un
 * client che registra la chiamata, e pretende che metodo e percorso coincidano con quelli dichiarati
 * qui: se qualcuno cambia un percorso in `mcp-tools.ts` e non qui, la prova è rossa.
 *
 * Ciò che non si sa risolvere è `undefined`, e chi riceve `undefined` non libera niente.
 */
import { bareToolName, isParametricToolName } from "./mcp-tool-names.js";

export interface Operazione {
  conceptId: string;
  operationId: string;
  method: string;
}

/** La forma di uno strumento di scrittura: quale metodo usa e su quale percorso. */
type Forma = "up" | "putUp" | "del" | "post";

/** Il percorso base di ogni strumento di scrittura con un nome proprio (lo stesso di `mcp-tools.ts`). */
export const RISORSE_SCRITTURE: Readonly<Record<string, { base: string; forma: Forma }>> = Object.freeze({
  hrx_org_units_upsert: { base: "/organization-units", forma: "up" },
  hrx_org_units_delete: { base: "/organization-units", forma: "del" },
  hrx_positions_upsert: { base: "/positions", forma: "up" },
  hrx_positions_delete: { base: "/positions", forma: "del" },
  hrx_job_roles_upsert: { base: "/job-roles", forma: "up" },
  hrx_skills_upsert: { base: "/skills", forma: "up" },
  hrx_kpi_defs_upsert: { base: "/kpi-definitions", forma: "up" },
  // hrx_kpi_defs_delete tolto il 2026-11-08 (classe X, ADR-0056 D2).
  hrx_process_kpi_template_upsert: { base: "/process-kpi-templates", forma: "putUp" },
  hrx_orgunit_kpi_template_upsert: { base: "/organization-unit-kpi-templates", forma: "putUp" },
  hrx_typing_profile_upsert: { base: "/enterprise-typing-profiles", forma: "putUp" },
  hrx_blueprint_activation_upsert: { base: "/blueprint-activations", forma: "up" },
  hrx_blueprint_override_upsert: { base: "/blueprint-overrides", forma: "putUp" },
  hrx_job_families_upsert: { base: "/job-families", forma: "up" },
  // hrx_job_families_delete tolto il 2026-11-08 (classe X, ADR-0056 D2).
  hrx_blueprint_families_upsert: { base: "/blueprint-families", forma: "up" },
  hrx_blueprint_variants_upsert: { base: "/blueprint-variants", forma: "up" },
  hrx_blueprint_processes_upsert: { base: "/blueprint-processes", forma: "up" },
  hrx_tenant_materialize: { base: "/tenant-materialization", forma: "post" },
});

/**
 * Il nome di un'operazione dall'atlante, la stessa regola di `operation_id` in
 * `docs/kb/tools/build_agent_operations.py`: metodo in minuscolo, poi i segmenti del percorso;
 * un parametro `:x` diventa `by_x`, ogni carattere fuori da `[a-z0-9]` diventa `_`.
 */
export function idOperazione(metodo: string, percorso: string): string {
  const pezzi = [metodo.toLowerCase()];
  for (const seg of percorso.replace(/^\/+|\/+$/g, "").split("/")) {
    if (!seg) continue;
    if (seg.startsWith(":")) pezzi.push("by_" + seg.slice(1).toLowerCase().replace(/[^a-z0-9]+/g, "_"));
    else pezzi.push(seg.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  }
  return pezzi.join("_");
}

/** Metodo e percorso relativo al concetto che uno strumento con nome proprio chiama, dato l'input. */
export function chiamataDiStrumento(nudo: string, input: unknown): { method: string; base: string; sotto: string } | undefined {
  const r = RISORSE_SCRITTURE[nudo];
  if (!r) return undefined;
  const a = (input ?? {}) as { id?: unknown };
  const conId = typeof a.id === "string" && a.id !== "";
  switch (r.forma) {
    case "up":
      return conId ? { method: "PATCH", base: r.base, sotto: "/:id" } : { method: "POST", base: r.base, sotto: "/" };
    case "putUp":
      return { method: "PUT", base: r.base, sotto: "/" };
    case "del":
      return { method: "DELETE", base: r.base, sotto: "/:id" };
    case "post":
      return { method: "POST", base: r.base, sotto: "/" };
  }
}

/** Risolve il metodo di un'operazione dell'atlante (lo stesso contratto del gate). */
export interface RisolutoreMetodo {
  methodOf(conceptId: string, operationId: string): string | undefined;
}

/** La coppia dell'atlante che la chiamata esegue, oppure `undefined`. */
export function operazioneDiChiamata(
  name: string, input: unknown, resolver?: RisolutoreMetodo,
): Operazione | undefined {
  const nudo = bareToolName(name);
  if (isParametricToolName(nudo)) {
    const a = (input ?? {}) as { conceptId?: unknown; operationId?: unknown };
    if (typeof a.conceptId !== "string" || typeof a.operationId !== "string" || !resolver) return undefined;
    const method = resolver.methodOf(a.conceptId, a.operationId)?.toUpperCase();
    return method ? { conceptId: a.conceptId, operationId: a.operationId, method } : undefined;
  }
  const c = chiamataDiStrumento(nudo, input);
  if (!c) return undefined;
  return { conceptId: c.base.replace(/^\//, ""), operationId: idOperazione(c.method, c.sotto), method: c.method };
}
