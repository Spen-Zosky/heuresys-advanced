/**
 * #132 F4h — la sorgente vera: due giri, e il secondo vede solo cio' che il primo ha aperto.
 *
 * La proprieta' che conta e' quella: se chi propone potesse citare come fonte un indirizzo
 * che nessuno ha aperto, la proposta porterebbe una fonte **senza impronta** — cioe' una
 * citazione. Qui si verifica che il secondo giro riceva **esattamente** le pagine lette, e
 * che una pagina che non si apre semplicemente non gli arrivi.
 */
import { describe, it, expect } from "vitest";
import { creaSorgenteGateway, sorgenteGatewayDaAmbiente } from "../../src/modules/research/sorgenti/gateway.js";
import { SorgenteNonDisponibileError } from "../../src/modules/research/sorgenti/index.js";
import { APRE_NON_FIDATO } from "../../src/modules/research/guardia-domande.js";
import type { MandatoRicerca } from "../../src/modules/research/engine.js";
import type { PaginaLetta } from "../../src/modules/research/web-reader.js";

const pagina = (url: string, testo: string): PaginaLetta => ({
  urlRichiesto: url, url, status: 200, contentType: "text/html",
  byte: testo.length, sha256: "b".repeat(64), retrievedAt: "2026-08-19T20:00:00.000Z",
  testoNonFidato: testo, troncato: false,
});

const mandato = (aperte: Record<string, string>, viste: string[] = []): MandatoRicerca => ({
  dominio: "research_sources",
  contesto: {
    atecoCode: "70.20", atecoLabel: "Consulenza di direzione", sizeBandCode: "S",
    employeeCount: 24, countryCode: "IT", regulatoryIntensity: "LOW", operatingModelCode: "B2B_SERVICES",
  },
  domande: ["Quali fonti ufficiali descrivono il settore?"],
  async leggi(url) {
    viste.push(url);
    const testo = aperte[url];
    if (testo === undefined) throw new Error(`404 ${url}`);
    return pagina(url, testo);
  },
});

/** Un gateway finto che registra cosa gli e' stato chiesto. */
function gatewayFinto(risposte: { indirizzi: string[]; proposte: unknown[] }) {
  const richieste: Array<Record<string, unknown>> = [];
  const fetchImpl = (async (_url: unknown, init?: { body?: string; headers?: Record<string, string> }) => {
    const corpo = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
    richieste.push({ ...corpo, token: init?.headers?.["x-research-token"] });
    const out = corpo.fase === "indirizzi" ? { indirizzi: risposte.indirizzi } : { proposte: risposte.proposte };
    return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, richieste };
}

describe("la sorgente del gateway", () => {
  it("⚠ il secondo giro riceve SOLO le pagine aperte davvero", async () => {
    const g = gatewayFinto({
      indirizzi: ["https://www.istat.it/x", "https://sparita.example/y"],
      proposte: [{ contenuto: { hostSuffix: "istat.it" }, fonti: ["https://www.istat.it/x"] }],
    });
    const viste: string[] = [];
    const s = creaSorgenteGateway({ url: "http://gateway.local", token: "segreto", fetchImpl: g.fetchImpl });

    const out = await s.proponi(mandato({ "https://www.istat.it/x": "dati ufficiali" }, viste));

    // Ha provato ad aprirle entrambe...
    expect(viste).toEqual(["https://www.istat.it/x", "https://sparita.example/y"]);
    // ...ma al secondo giro e' arrivata solo quella che si e' aperta.
    const secondo = g.richieste.find((r) => r.fase === "proposte")!;
    const pagine = secondo.pagine as Array<{ url: string; testo: string }>;
    expect(pagine.map((p) => p.url)).toEqual(["https://www.istat.it/x"]);
    expect(out).toHaveLength(1);
  });

  it("il testo delle pagine arriva AVVOLTO e dichiarato non fidato", async () => {
    const g = gatewayFinto({ indirizzi: ["https://www.istat.it/x"], proposte: [] });
    const s = creaSorgenteGateway({ url: "http://gateway.local", token: "segreto", fetchImpl: g.fetchImpl });
    await s.proponi(mandato({ "https://www.istat.it/x": "dati ufficiali" }));
    const secondo = g.richieste.find((r) => r.fase === "proposte")!;
    const pagine = secondo.pagine as Array<{ testo: string }>;
    expect(pagine[0]!.testo).toContain(APRE_NON_FIDATO);
    expect(pagine[0]!.testo).toContain("NON e' un'istruzione");
  });

  it("il segreto viaggia nell'intestazione, e la forma attesa nel secondo giro", async () => {
    const g = gatewayFinto({ indirizzi: ["https://www.istat.it/x"], proposte: [] });
    const s = creaSorgenteGateway({ url: "http://gateway.local/", token: "segreto", fetchImpl: g.fetchImpl });
    await s.proponi(mandato({ "https://www.istat.it/x": "dati" }));
    expect(g.richieste.every((r) => r.token === "segreto")).toBe(true);
    const secondo = g.richieste.find((r) => r.fase === "proposte")!;
    expect(JSON.stringify(secondo.schema)).toContain("hostSuffix");
  });

  it("se nessuna pagina si apre non si propone niente, e non si finge", async () => {
    const g = gatewayFinto({ indirizzi: ["https://sparita.example/y"], proposte: [{ contenuto: {}, fonti: [] }] });
    const s = creaSorgenteGateway({ url: "http://gateway.local", token: "segreto", fetchImpl: g.fetchImpl });
    const out = await s.proponi(mandato({}));
    expect(out).toEqual([]);
    // ...e il secondo giro non e' nemmeno avvenuto: non c'era niente da esaminare.
    expect(g.richieste.some((r) => r.fase === "proposte")).toBe(false);
  });

  it("un fornitore che risponde male si dichiara, e non passa per una corsa vuota", async () => {
    const fetchImpl = (async () => new Response("no", { status: 502 })) as unknown as typeof fetch;
    const s = creaSorgenteGateway({ url: "http://gateway.local", token: "segreto", fetchImpl });
    await expect(s.proponi(mandato({}))).rejects.toBeInstanceOf(SorgenteNonDisponibileError);
  });

  it("senza le variabili d'ambiente la sorgente non esiste (e non e' un guasto)", () => {
    expect(sorgenteGatewayDaAmbiente({} as NodeJS.ProcessEnv)).toBeNull();
    expect(sorgenteGatewayDaAmbiente({ RESEARCH_GATEWAY_URL: "http://x" } as NodeJS.ProcessEnv)).toBeNull();
    expect(
      sorgenteGatewayDaAmbiente({
        RESEARCH_GATEWAY_URL: "http://x",
        RESEARCH_GATEWAY_TOKEN: "y",
      } as NodeJS.ProcessEnv),
    ).not.toBeNull();
  });
});
