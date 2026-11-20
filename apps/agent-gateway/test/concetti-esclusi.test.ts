/**
 * Prova dal vivo del 2026-11-20 (HRMS_MANAGER): la ricerca del catalogo in italiano non trovava
 * niente, e i concetti vietati risultavano «assenti» invece che vietati, così il rifiuto fisso non
 * scattava. Qui le due regole, provate sul server MCP vero.
 */
import { describe, it, expect } from "vitest";
import { AtlasOperationResolver } from "../src/atlas-resolver.js";
import { buildHeuresysMcp } from "../src/mcp-tools.js";
import { HeuresysClient, type FetchLike } from "../src/heuresys-client.js";
import { EsitiLetture, MESSAGGIO_NON_AUTORIZZATO } from "../src/omissis.js";
import { caricaEsclusi, concettiPer } from "../src/concetti-esclusi.js";

type CallHandler = (req: unknown, extra: unknown) => Promise<{ content: Array<{ text: string }> }>;

const op = (path: string, permission: string) => ({ method: "GET", path, permission });
const resolver = AtlasOperationResolver.fromConcepts({
  compensation: { solaLettura: true, data: "x", decisione: "x", operations: { get: op("/", "compensation:read") } },
  "time-off": { solaLettura: true, data: "x", decisione: "x", operations: { get: op("/", "time-off:read") } },
  users: { solaLettura: true, data: "x", decisione: "x", operations: { get: op("/", "user:read") } },
} as never);

function montaServer() {
  const esiti = new EsitiLetture();
  const fetchImpl: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "{}" });
  const client = new HeuresysClient({ baseUrl: "http://api", session: { cookieAccess: "x", cookieCsrf: "y", csrf: "y" }, fetchImpl });
  client.collegaEsiti(esiti);
  const server = buildHeuresysMcp(client, resolver, undefined, { whistleblowing: "isolamento assoluto" }) as unknown as {
    instance: { server: { _requestHandlers: Map<string, CallHandler> } };
  };
  const call = server.instance.server._requestHandlers.get("tools/call")!;
  const chiama = async (name: string, args: Record<string, unknown>) =>
    JSON.parse((await call({ method: "tools/call", params: { name, arguments: args } }, { signal: new AbortController().signal })).content[0]!.text) as Record<string, unknown>;
  return { esiti, chiama };
}

describe("ricerca del catalogo in italiano", () => {
  it("processo, sottoprocesso, progetto e Gantt portano alle schede di processi e progetti (V8)", () => {
    const ids = ["processes", "blueprint-processes", "projects", "positions"];
    expect(concettiPer("descrivimi il processo del credito", ids)).toEqual(["processes", "blueprint-processes"]);
    expect(concettiPer("quali sottoprocessi ha", ids)).toEqual(["processes", "blueprint-processes"]);
    expect(concettiPer("mostrami il Gantt del progetto", ids)).toEqual(["projects"]);
  });

  it("retribuzione, malattia e persone portano ai concetti veri", () => {
    const ids = ["compensation", "time-off", "users", "positions"];
    expect(concettiPer("retribuzione annua", ids)).toEqual(["compensation"]);
    expect(concettiPer("certificato di malattia", ids)).toEqual(["time-off"]);
    expect(concettiPer("le persone della direzione", ids)).toEqual(["users"]);
    expect(concettiPer("", ids)).toEqual(ids);
  });

  it("senza corrispondenze la ricerca ritorna tutti i concetti, non un elenco vuoto", async () => {
    const { chiama } = montaServer();
    const r = await chiama("hrx_concepts_search", { query: "zzz-niente" });
    expect((r.concepts as unknown[]).length).toBe(3);
  });
});

describe("i concetti vietati sono vietati, non assenti", () => {
  it("cercare le segnalazioni dà NON_AUTORIZZATO e conta una lettura negata: scatta il rifiuto fisso", async () => {
    const { chiama, esiti } = montaServer();
    const r = await chiama("hrx_concepts_search", { query: "segnalazioni whistleblowing" });
    expect(r.vietati).toEqual([expect.objectContaining({ conceptId: "whistleblowing", accesso: "NON_AUTORIZZATO" })]);
    expect(esiti.rifiuto()).toBe(MESSAGGIO_NON_AUTORIZZATO);
  });

  it("descriverlo dà NON_AUTORIZZATO", async () => {
    const { chiama, esiti } = montaServer();
    const r = await chiama("hrx_concept_describe", { conceptId: "whistleblowing" });
    expect(r).toMatchObject({ conceptId: "whistleblowing", accesso: "NON_AUTORIZZATO" });
    expect(esiti.conteggio().negate).toBe(1);
  });

  it("una ricerca che trova anche concetti leciti non fa scattare il rifiuto", async () => {
    const { chiama, esiti } = montaServer();
    await chiama("hrx_concepts_search", { query: "retribuzione" });
    expect(esiti.rifiuto()).toBeNull();
  });

  it("la mappa generata dichiara gli esclusi", () => {
    expect(Object.keys(caricaEsclusi())).toEqual(expect.arrayContaining(["whistleblowing", "auth"]));
  });
});
