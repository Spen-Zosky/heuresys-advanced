/**
 * S1099 (#214 F6) — il server MCP del gateway deve poter ELENCARE i propri strumenti.
 *
 * Non e' ovvio, ed e' successo il contrario: dal 2026-09-03 (bump dell'SDK, #243) `tools/list`
 * lanciava su `z.record(...)` — e il CLI, invece di un errore, mostrava il server `connected`
 * con zero strumenti. Nessun test lo vedeva: i test del gate provano il gate, quelli del
 * catalogo provano la mappa, nessuno chiedeva al server VERO «quali strumenti hai?». La prova
 * live dei perimetri (`live-perimetro.ts`) e' stata la prima a dirlo, dieci giorni dopo.
 *
 * Qui si chiama `tools/list` sul server costruito da `buildHeuresysMcp`, come fa il CLI, e si
 * pretende che risponda con TUTTI i nomi del catalogo. La CONTROPROVA e' la forma che rompeva:
 * un server con `z.record` deve ancora lanciare — se un giorno non lancera' piu', la nota in
 * `mcp-tools.ts` potra' essere ritirata sapendolo.
 */
import { describe, it, expect } from "vitest";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { buildHeuresysMcp } from "../src/mcp-tools.js";
import { HeuresysClient } from "../src/heuresys-client.js";
import { AtlasOperationResolver } from "../src/atlas-resolver.js";
import { GENERIC_TOOL_NAMES, READ_TOOL_NAMES, WRITE_TOOL_NAMES } from "../src/mcp-tool-names.js";

type ListResult = { tools: Array<{ name: string; inputSchema: unknown }> };

async function toolsList(server: unknown): Promise<ListResult> {
  // Lo stesso handler che il CLI invoca sul trasporto in-process: se lancia qui, lancia la'.
  const inst = (server as { instance: { server: { _requestHandlers: Map<string, (req: unknown, extra: unknown) => Promise<ListResult>> } } }).instance;
  const handler = inst.server._requestHandlers.get("tools/list");
  if (!handler) throw new Error("il server non registra tools/list");
  return handler({ method: "tools/list", params: {} }, { signal: new AbortController().signal });
}

describe("il server MCP del gateway elenca i propri strumenti", () => {
  const client = new HeuresysClient({
    baseUrl: "http://localhost:0",
    session: { cookieAccess: "x", cookieCsrf: "y", csrf: "y" },
  });

  it("tools/list risponde con ogni nome del catalogo, e ogni schema e' JSON serializzabile", async () => {
    // Il resolver dei perimetri come lo monta il gateway (l'atlante generato): con una mappa
    // vuota i tre strumenti generici non vengono montati per costruzione, non per difetto.
    const r = await toolsList(buildHeuresysMcp(client, AtlasOperationResolver.load()));
    const nomi = new Set(r.tools.map((t) => t.name));
    const attesi = [...GENERIC_TOOL_NAMES, ...READ_TOOL_NAMES, ...WRITE_TOOL_NAMES];
    const mancanti = attesi.filter((n) => !nomi.has(n));
    expect(mancanti).toEqual([]);
    expect(r.tools.length).toBeGreaterThanOrEqual(attesi.length);
    for (const t of r.tools) expect(() => JSON.stringify(t.inputSchema)).not.toThrow();
  });

  it("controprova: un `z.record` nello schema fa ancora lanciare tools/list (la ragione della nota)", async () => {
    const rotto = createSdkMcpServer({
      name: "rotto",
      tools: [tool("t", "d", { p: z.record(z.string(), z.any()) }, async () => ({ content: [] }))],
    });
    await expect(toolsList(rotto)).rejects.toThrow();
  });
});
