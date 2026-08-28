/**
 * apps/api/test/skill-graph.integration.test.ts — #50 F2 (S1083).
 *
 * ⚠ LE PROVE DEVONO POTER FALLIRE. Un test che chiede soltanto «la rotta risponde
 * 200» e' verde anche su un grafo vuoto, ed e' precisamente il difetto che questa
 * voce e' venuta a togliere: un grafo che *sembra* a posto. Ogni asserzione qui
 * confronta due misure che devono divergere, o nomina una proprieta' che una
 * risposta sbagliata violerebbe.
 *
 * ⚠ NESSUN NUMERO CABLATO. Il catalogo cresce, quindi l'atteso si deriva dalla
 * risposta stessa: si confrontano due chiamate fra loro, mai con una costante
 * scritta qui — che sarebbe vera il giorno in cui e' stata scritta e falsa poco
 * dopo.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

let suite: TestApp;
let cookie = "";

describe("skills/graph — il grafo ha due famiglie di arco (#50 F2)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "enzo.spenuso@heuresys.com", TEST_PERSONA_PASSWORD);
    cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  });

  afterAll(async () => {
    await closePool();
  });

  const chiedi = (qs: string) =>
    suite.app.inject({ method: "GET", url: `/v1/skills/graph${qs}`, headers: { cookie } });

  it("senza ancoraggio serve il catalogo intero, e non e' vuoto", async () => {
    const res = await chiedi("?includeGroups=true&depth=2");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.counts.nodes).toBeGreaterThan(0);
    expect(body.counts.edges).toBeGreaterThan(0);
    // i conteggi dichiarati devono combaciare con cio' che e' stato davvero servito:
    // un contatore che non conta le righe che accompagna e' peggio che assente
    expect(body.nodes).toHaveLength(body.counts.nodes);
    expect(body.edges).toHaveLength(body.counts.edges);
  });

  it("gli archi di GRUPPO aggiungono davvero: spegnerli ne toglie", async () => {
    const [con, senza] = await Promise.all([
      chiedi("?includeGroups=true&depth=2"),
      chiedi("?includeGroups=false&depth=2"),
    ]);
    const a = con.json();
    const b = senza.json();
    // e' l'asserzione che regge l'intera premessa della fase: se le due misure
    // coincidessero, la seconda famiglia non esisterebbe e nessuno se ne
    // accorgerebbe guardando un grafo che sembra a posto
    expect(a.counts.edges).toBeGreaterThan(b.counts.edges);
    expect(a.counts.groupEdges).toBeGreaterThan(0);
    expect(b.counts.groupEdges).toBe(0);
    // e spegnerli non deve toccare gli espliciti
    expect(a.counts.explicitEdges).toBe(b.counts.explicitEdges);
  });

  it("il filtro sui tipi discrimina — un filtro che non filtra sembra funzionare", async () => {
    const [tutti, soloIsA] = await Promise.all([
      chiedi("?includeGroups=false&depth=2"),
      chiedi("?includeGroups=false&depth=2&kinds=IS_A"),
    ]);
    expect(soloIsA.json().counts.edges).toBeLessThan(tutti.json().counts.edges);
    expect(soloIsA.json().counts.edges).toBeGreaterThan(0);
    for (const e of soloIsA.json().edges) expect(e.kind).toBe("IS_A");
  });

  it("l'ancoraggio restringe, e la profondita' lo allarga", async () => {
    const intero = (await chiedi("?includeGroups=true&depth=2")).json();
    const radice = intero.nodes.find((n: { kind: string }) => n.kind === "SKILL");
    expect(radice).toBeDefined();

    const [vicino, lontano] = await Promise.all([
      chiedi(`?root=${radice.id}&depth=1&includeGroups=true`),
      chiedi(`?root=${radice.id}&depth=3&includeGroups=true`),
    ]);
    // ancorato deve essere piu' piccolo dell'intero, o l'ancoraggio non ancora nulla
    expect(vicino.json().counts.nodes).toBeLessThan(intero.counts.nodes);
    // e piu' profondita' non puo' dare MENO nodi
    expect(lontano.json().counts.nodes).toBeGreaterThanOrEqual(vicino.json().counts.nodes);
  });

  it("ogni arco punta a nodi presenti: nessun arco verso il nulla", async () => {
    const body = (await chiedi("?includeGroups=true&depth=2")).json();
    const presenti = new Set(body.nodes.map((n: { id: string }) => n.id));
    const orfani = body.edges.filter(
      (e: { source: string; target: string }) => !presenti.has(e.source) || !presenti.has(e.target),
    );
    // il filtro di visibilita' del service toglie i nodi di altri tenant: se non
    // togliesse anche i loro archi, il grafo direbbe che esistono
    expect(orfani).toHaveLength(0);
  });

  it("le due specie di nodo sono dichiarate, non da indovinare", async () => {
    const body = (await chiedi("?includeGroups=true&depth=2")).json();
    const specie = new Set(body.nodes.map((n: { kind: string }) => n.kind));
    expect(specie.has("SKILL")).toBe(true);
    expect(specie.has("GROUP")).toBe(true);
    for (const n of body.nodes) expect(["SKILL", "GROUP"]).toContain(n.kind);
  });

  it("senza permesso non si legge", async () => {
    const res = await suite.app.inject({ method: "GET", url: "/v1/skills/graph" });
    expect([401, 403]).toContain(res.statusCode);
  });
});
