/**
 * Piano interfacce, lotto L10 — A-16: le letture di maggior valore che nessuna pagina mostra
 * (valutazioni, misure KPI, predizioni, processi del tenant) hanno uno strumento MCP dedicato.
 *
 * Si chiama `tools/call` sul server vero, con un cliente che registra la richiesta invece di
 * mandarla: ogni strumento legge (GET) il percorso giusto, codifica l'identificativo e porta i
 * filtri in querystring; e ogni nome sta fra le letture del catalogo.
 */
import { describe, it, expect } from "vitest";
import { buildHeuresysMcp } from "../src/mcp-tools.js";
import { HeuresysClient } from "../src/heuresys-client.js";
import { AtlasOperationResolver } from "../src/atlas-resolver.js";
import { READ_TOOL_NAMES, WRITE_TOOL_NAMES } from "../src/mcp-tool-names.js";

type Handler = (req: unknown, extra: unknown) => Promise<{ content: Array<{ text?: string }>; isError?: boolean }>;

class ClienteCheRegistra extends HeuresysClient {
  chiamate: Array<{ method: string; path: string }> = [];
  constructor() {
    super({ baseUrl: "http://localhost:0", session: { cookieAccess: "x", cookieCsrf: "y", csrf: "y" } });
  }
  override async call<T = unknown>(method: string, path: string): Promise<T> {
    this.chiamate.push({ method, path });
    return { ok: true } as T;
  }
}

async function chiama(cliente: ClienteCheRegistra, name: string, args: Record<string, unknown>) {
  const server = buildHeuresysMcp(cliente, AtlasOperationResolver.load()) as unknown as {
    instance: { server: { _requestHandlers: Map<string, Handler> } };
  };
  const h = server.instance.server._requestHandlers.get("tools/call")!;
  const r = await h({ method: "tools/call", params: { name, arguments: args } }, { signal: new AbortController().signal });
  expect(r.isError ?? false, JSON.stringify(r)).toBe(false);
  return cliente.chiamate.at(-1);
}

const CASI: Array<[string, Record<string, unknown>, string]> = [
  ["hrx_performance_reviews_list", { query: { cycleId: "c-1", limit: 5 } }, "/performance-reviews?cycleId=c-1&limit=5"],
  ["hrx_performance_reviews_list", {}, "/performance-reviews"],
  ["hrx_performance_reviews_get", { id: "r 1" }, "/performance-reviews/r%201"],
  ["hrx_kpi_measurements_list", { id: "k-1", query: { from: "2026-01-01" } }, "/kpi-definitions/k-1/measurements?from=2026-01-01"],
  ["hrx_predictions_list", { query: { model: "attrition" } }, "/predictions?model=attrition"],
  ["hrx_predictions_get", { id: "p-1" }, "/predictions/p-1"],
  ["hrx_org_unit_processes_list", { id: "ou/1" }, "/organization-unit-processes/by-ou/ou%2F1"],
];

describe("A-16 — strumenti MCP per le letture che nessuna pagina mostra", () => {
  it.each(CASI)("%s legge il percorso giusto", async (nome, args, percorso) => {
    const c = new ClienteCheRegistra();
    expect(await chiama(c, nome, args)).toEqual({ method: "GET", path: percorso });
  });

  it("sono letture del catalogo, non scritture", () => {
    for (const [nome] of CASI) {
      expect(READ_TOOL_NAMES as readonly string[]).toContain(nome);
      expect(WRITE_TOOL_NAMES as readonly string[]).not.toContain(nome);
    }
  });
});
