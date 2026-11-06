/**
 * ADR-0053 A3, piano dei principi agentici voce T3b: quale operazione dell'atlante fa una scrittura.
 *
 * La prova che conta è l'ultima: invoca OGNI strumento di scrittura del server MCP vero, con un
 * client che registra la chiamata, e pretende che metodo e percorso coincidano con
 * `operazioneDiChiamata`. Se un percorso cambia in `mcp-tools.ts` e non in `operazione.ts`, il
 * registro delle capacità risponderebbe su un'operazione diversa da quella eseguita.
 */
import { describe, it, expect } from "vitest";
import { buildHeuresysMcp } from "../src/mcp-tools.js";
import { HeuresysClient, type FetchLike } from "../src/heuresys-client.js";
import { WRITE_TOOL_NAMES } from "../src/mcp-tool-names.js";
import { RISORSE_SCRITTURE, idOperazione, operazioneDiChiamata } from "../src/operazione.js";

describe("idOperazione: la regola di build_agent_operations.py", () => {
  it.each([
    ["GET", "/", "get"],
    ["POST", "/", "post"],
    ["PATCH", "/:id", "patch_by_id"],
    ["DELETE", "/:id", "delete_by_id"],
    ["GET", "/by-ou/:ouId", "get_by_ou_by_ouid"],
    ["GET", "/:id/skill-requirements/history", "get_by_id_skill_requirements_history"],
  ])("%s %s → %s", (m, p, atteso) => {
    expect(idOperazione(m, p)).toBe(atteso);
  });
});

describe("operazioneDiChiamata", () => {
  it("upsert senza id crea (POST /), con id aggiorna (PATCH /:id)", () => {
    expect(operazioneDiChiamata("mcp__heuresys__hrx_positions_upsert", { payload: {} })).toEqual({
      conceptId: "positions", operationId: "post", method: "POST",
    });
    expect(operazioneDiChiamata("hrx_positions_upsert", { id: "p", payload: {} })).toEqual({
      conceptId: "positions", operationId: "patch_by_id", method: "PATCH",
    });
  });

  it("lo strumento generico prende la coppia dall'input e il metodo dall'atlante, mai dall'input", () => {
    const resolver = { methodOf: (c: string, o: string) => (c === "positions" && o === "post" ? "POST" : undefined) };
    expect(operazioneDiChiamata("hrx_entity_query", { conceptId: "positions", operationId: "post", method: "GET" }, resolver))
      .toEqual({ conceptId: "positions", operationId: "post", method: "POST" });
    expect(operazioneDiChiamata("hrx_entity_query", { conceptId: "positions", operationId: "x" }, resolver)).toBeUndefined();
    expect(operazioneDiChiamata("hrx_entity_query", { conceptId: "positions", operationId: "post" })).toBeUndefined();
  });

  it("uno strumento sconosciuto o una lettura non hanno un'operazione di scrittura", () => {
    expect(operazioneDiChiamata("hrx_org_units_list", {})).toBeUndefined();
    expect(operazioneDiChiamata("hrx_inventato_upsert", {})).toBeUndefined();
  });

  it("ogni strumento di scrittura del catalogo ha la sua risorsa, e nessuna risorsa è in più", () => {
    expect(Object.keys(RISORSE_SCRITTURE).sort()).toEqual([...WRITE_TOOL_NAMES].sort());
  });
});

type Chiamata = { method: string; url: string };
type CallHandler = (req: unknown, extra: unknown) => Promise<unknown>;

describe("operazione dichiarata = chiamata eseguita, per ogni strumento di scrittura", () => {
  const chiamate: Chiamata[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    chiamate.push({ method: init.method, url });
    return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" };
  };
  const client = new HeuresysClient({
    baseUrl: "http://api",
    session: { cookieAccess: "x", cookieCsrf: "y", csrf: "y" },
    fetchImpl,
  });
  const server = buildHeuresysMcp(client) as unknown as {
    instance: { server: { _requestHandlers: Map<string, CallHandler> } };
  };
  const call = server.instance.server._requestHandlers.get("tools/call");

  const ingressi: Array<[string, Record<string, unknown>]> = WRITE_TOOL_NAMES.flatMap((n) => {
    const forma = RISORSE_SCRITTURE[n]!.forma;
    if (forma === "up") return [[n, { payload: {} }], [n, { id: "ID1", payload: {} }]] as Array<[string, Record<string, unknown>]>;
    if (forma === "del") return [[n, { id: "ID1" }]] as Array<[string, Record<string, unknown>]>;
    if (n === "hrx_tenant_materialize") return [[n, { tenantId: "t", variantVersionId: "v", mode: "plan" }]] as Array<[string, Record<string, unknown>]>;
    return [[n, { payload: {} }]] as Array<[string, Record<string, unknown>]>;
  });

  it.each(ingressi)("%s %j", async (nome, args) => {
    if (!call) throw new Error("il server non registra tools/call");
    chiamate.length = 0;
    await call({ method: "tools/call", params: { name: nome, arguments: args } }, { signal: new AbortController().signal });
    expect(chiamate).toHaveLength(1);
    const op = operazioneDiChiamata(nome, args)!;
    const percorso = new URL(chiamate[0]!.url).pathname.replace(/^\/v1/, "");
    const atteso = `/${op.conceptId}${op.operationId.endsWith("_by_id") ? `/${args.id as string}` : ""}`;
    expect(chiamate[0]!.method).toBe(op.method);
    expect(percorso).toBe(atteso);
  });
});
