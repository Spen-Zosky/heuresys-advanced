/**
 * Ogni flusso SSE del gateway dice ai proxy di non toccarlo. Senza `no-transform`, la compressione
 * di Next sul rewrite /agent-gateway accumula lo stream: nella prova dal vivo del 2026-11-12 i
 * page_command sono arrivati alla pagina a fine giro (73 s), dopo che l'attesa dell'esito (30 s)
 * era scaduta, e l'assistente ha ripetuto il comando. Prova sul sorgente: ogni risposta
 * `text/event-stream` porta le due intestazioni, come quella di apps/api (/me).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sorgente = readFileSync(fileURLToPath(new URL("../src/server.ts", import.meta.url)), "utf8");

describe("intestazioni dei flussi SSE", () => {
  it("ogni text/event-stream porta no-transform e x-accel-buffering: no", () => {
    const blocchi = [...sorgente.matchAll(/writeHead\(\s*200\s*,\s*\{([^}]*text\/event-stream[^}]*)\}/gu)].map((m) => m[1] ?? "");
    expect(blocchi.length).toBeGreaterThan(0);
    for (const b of blocchi) {
      expect(b).toMatch(/"cache-control":\s*"[^"]*no-transform/u);
      expect(b).toMatch(/"x-accel-buffering":\s*"no"/u);
    }
  });
});
