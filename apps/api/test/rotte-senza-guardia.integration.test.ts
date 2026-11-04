/**
 * apps/api/test/rotte-senza-guardia.integration.test.ts — S-10 del piano interfacce.
 *
 * Ogni rotta dell'API chiede un permesso, oppure sta in `ROTTE_SENZA_PERMESSO`
 * (src/lib/scope/guardia.ts) con la ragione per cui non lo chiede. Il confronto e' nei due
 * sensi: una rotta nuova senza permesso e senza ragione e' rossa; una ragione che non ha piu'
 * la sua rotta e' rossa anche lei, perche' un elenco che invecchia smette di essere letto.
 *
 * Misurato il 2026-11-04 avviando l'app: 54 rotte senza permesso; una
 * (`GET /v1/tenant-materialization/sources`) era una dimenticanza e ora chiede
 * `tenant_materialization:execute`.
 */
import { describe, it, expect } from "vitest";
import { buildTestApp } from "./helpers/build-test-app.js";
import { ROTTE_SENZA_PERMESSO, SECONDO_CONFIGURAZIONE } from "../src/lib/scope/guardia.js";

describe("S-10 — nessuna rotta senza permesso e senza ragione scritta", () => {
  it("la raccolta all'avvio coincide con l'elenco delle ragioni", async () => {
    const { app } = await buildTestApp();
    await app.ready();
    const viste = new Set(app.guardiaStats.senzaPermesso);
    await app.close();

    // La raccolta e' viva: le sonde ci sono sempre.
    expect(viste.has("GET /healthz")).toBe(true);

    const senzaRagione = [...viste].filter((r) => !(r in ROTTE_SENZA_PERMESSO)).sort();
    expect(senzaRagione, "rotte senza permesso e senza ragione in guardia.ts").toEqual([]);

    const ragioniOrfane = Object.keys(ROTTE_SENZA_PERMESSO)
      .filter((r) => !viste.has(r) && !SECONDO_CONFIGURAZIONE.has(r))
      .sort();
    expect(ragioniOrfane, "ragioni in guardia.ts per rotte che non esistono piu'").toEqual([]);

    for (const [rotta, ragione] of Object.entries(ROTTE_SENZA_PERMESSO)) {
      expect(ragione.length, rotta).toBeGreaterThan(20);
    }
  });
});
