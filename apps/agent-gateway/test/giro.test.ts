/**
 * T6b (ADR-0056 D4) — il giro staccato dalla finestra, provato senza modello e senza server.
 *
 * Ogni regola ha la sua controprova: la finestra chiusa non ferma il giro (e il registro riceve lo
 * stesso ciò che la persona vede); la ripresa passa la sessione salvata e il contatore riparte
 * dalle impronte; la durata si accorcia al gettone; una proposta che non si salva è negata.
 */
import { describe, it, expect } from "vitest";
import { ApprovalRegistry } from "../src/approval-bridge.js";
import { ContatorePersone } from "../src/persone-distinte.js";
import { eseguiGiro, MARGINE_GETTONE_MS, type ChiamataGiro, type OpzioniEsecuzione, type RegistroGiro } from "../src/giro.js";
import type { Evento, MotivoArresto, StatoAttivita } from "../src/conversazione.js";
import { riduci, fineDi, misuraDi, titoloDa } from "../src/conversazione.js";

const PERSONA = "11111111-1111-4111-8111-111111111111";
const ALTRA = "22222222-2222-4222-8222-222222222222";

class RegistroFinto implements RegistroGiro {
  eventi: Evento[] = [];
  stati: Array<{ status: StatoAttivita; stopReason?: MotivoArresto; result?: string }> = [];
  proposte: Array<Record<string, unknown>> = [];
  ricordi: Array<{ sdkSessionRef?: string; personsSeen?: string[] }> = [];
  rifiutaProposte = false;
  readonly attivitaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  constructor(readonly conversazione: { id: string; sdkSessionRef: string | null; personsSeen: string[] }) {}
  aggiungi(e: readonly Evento[]): void {
    this.eventi.push(...e);
  }
  async svuota(): Promise<void> {}
  async proposta(p: Parameters<RegistroGiro["proposta"]>[0]): Promise<void> {
    if (this.rifiutaProposte) throw new Error("POST /agent-conversations/... -> 502");
    this.proposte.push(p as unknown as Record<string, unknown>);
  }
  async stato(status: StatoAttivita, extra: { stopReason?: MotivoArresto; result?: string } = {}): Promise<void> {
    this.stati.push({ status, ...extra });
  }
  async ricorda(extra: { sdkSessionRef?: string; personsSeen?: string[] }): Promise<void> {
    this.ricordi.push(extra);
  }
}

const CONV = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const init = (sid: string) => ({ type: "system", subtype: "init", session_id: sid });
const testo = (t: string) => ({ type: "assistant", message: { content: [{ type: "text", text: t }] } });
const strumento = (n: string) => ({
  type: "assistant",
  message: { content: [{ type: "tool_use", name: n, input: { userId: ALTRA, salario: 50000 } }] },
});
const risultato = (r: string) => ({ type: "result", subtype: "success", is_error: false, result: r, num_turns: 2 });

function deps(registro: RegistroFinto, esegui: (o: OpzioniEsecuzione) => AsyncIterable<unknown>, extra: Partial<Parameters<typeof eseguiGiro>[0]> = {}) {
  const scritti: string[] = [];
  return {
    scritti,
    d: {
      registro,
      esegui,
      contatore: new ContatorePersone(undefined, registro.conversazione.personsSeen),
      approvals: new ApprovalRegistry({ approvalTimeoutMs: 60_000 }),
      owner: PERSONA,
      scadenzaGettone: Date.now() + 600_000,
      durataMs: 900_000,
      approvalTimeoutMs: 60_000,
      scrivi: (p: string) => scritti.push(p),
      ...extra,
    },
  };
}

describe("T6b — ciò che si salva di un evento dell'SDK", () => {
  it("il testo e il nome dello strumento sì; gli argomenti dello strumento no", () => {
    const e = riduci(strumento("hrx_get_user"));
    expect(e).toEqual([{ kind: "STRUMENTO", payload: { strumento: "hrx_get_user" } }]);
    expect(JSON.stringify(e)).not.toContain(ALTRA);
    expect(riduci(testo("ciao"))).toEqual([{ kind: "TESTO", payload: { testo: "ciao" } }]);
    expect(riduci({ type: "user", message: { content: [{ type: "tool_result", content: ALTRA }] } })).toEqual([]);
  });

  it("la fine: successo è FATTA col testo, i giri esauriti INTERROTTA, il resto FALLITA", () => {
    expect(fineDi(risultato("fatto"))).toEqual({ esito: "FATTA", risultato: "fatto" });
    expect(fineDi({ type: "result", subtype: "error_max_turns", is_error: true })).toEqual({ esito: "INTERROTTA", motivo: "GIRI" });
    expect(fineDi({ type: "result", subtype: "error_during_execution", is_error: true })).toEqual({ esito: "FALLITA", motivo: "ERRORE" });
  });

  it("il titolo è la prima richiesta su una riga, tagliata a 80", () => {
    expect(titoloDa("  chi è\n in ferie?  ")).toBe("chi è in ferie?");
    expect(titoloDa("x".repeat(200))).toHaveLength(80);
  });
});

describe("T6b — il giro continua a finestra chiusa", () => {
  it("dopo la chiusura non si scrive più alla finestra, ma il registro riceve tutto e il giro finisce FATTA", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    let finestraAperta = true;
    const scritti: string[] = [];
    const { d } = deps(reg, async function* () {
      yield init("sess-1");
      yield testo("prima parte");
      finestraAperta = false; // la persona chiude la finestra qui
      yield testo("seconda parte, a finestra chiusa");
      yield risultato("finito");
    });
    const esito = await eseguiGiro({ ...d, scrivi: (p) => { if (finestraAperta) scritti.push(p); } });

    expect(esito).toEqual({ stato: "FATTA" });
    expect(reg.eventi.map((e) => e.kind)).toEqual(["TESTO", "TESTO", "FINE"]);
    expect(reg.eventi[1]?.payload).toEqual({ testo: "seconda parte, a finestra chiusa" });
    expect(reg.stati.at(-1)).toEqual({ status: "FATTA", result: "finito" });
    expect(reg.ricordi[0]).toEqual({ sdkSessionRef: "sess-1" });
    expect(scritti.join("")).not.toContain("seconda parte");
  });
});

describe("2026-11-18 — la domanda tutta su dati vietati riceve il messaggio fisso", () => {
  it("con il rifiuto, il registro, la finestra e il risultato portano il messaggio, non il testo del modello", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const { d, scritti } = deps(reg, async function* () {
      yield testo("Mi dispiace, non riesco a leggere le retribuzioni.");
      yield risultato("Mi dispiace, non riesco a leggere le retribuzioni.");
    }, { rifiuto: () => "Non hai le autorizzazioni necessarie." });
    await eseguiGiro(d);
    expect(reg.eventi.at(-1)).toEqual({ kind: "TESTO", payload: { testo: "Non hai le autorizzazioni necessarie.", origine: "piattaforma", rifiuto: true } });
    expect(scritti.join("")).toContain("event: rifiuto");
    expect(reg.stati.at(-1)).toEqual({ status: "FATTA", result: "Non hai le autorizzazioni necessarie." });
  });

  it("senza rifiuto il risultato resta quello del modello", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const { d, scritti } = deps(reg, async function* () {
      yield risultato("ecco i dati");
    }, { rifiuto: () => null });
    await eseguiGiro(d);
    expect(scritti.join("")).not.toContain("event: rifiuto");
    expect(reg.stati.at(-1)).toEqual({ status: "FATTA", result: "ecco i dati" });
  });
});

describe("T6b — la conversazione si riprende", () => {
  it("la sessione salvata va a resume, il contatore riparte dalle impronte e le impronte si salvano alla fine", async () => {
    const seme = new ContatorePersone();
    seme.aggiungi({ items: [{ subjectUserId: ALTRA }] });
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: "sess-1", personsSeen: seme.impronte() });
    let visto: OpzioniEsecuzione | undefined;
    const { d } = deps(reg, async function* (o) {
      visto = o;
      yield init("sess-1");
      yield risultato("ripreso");
    });
    await eseguiGiro(d);

    expect(visto?.resume).toBe("sess-1");
    expect(visto?.conversationId).toBe(CONV);
    expect(visto?.contatore.conta()).toBe(1);
    // la sessione non cambia: non si riscrive
    expect(reg.ricordi.filter((r) => r.sdkSessionRef !== undefined)).toEqual([]);
    expect(reg.ricordi.at(-1)).toEqual({ personsSeen: seme.impronte() });
  });

  it("una conversazione nuova non passa resume", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    let visto: OpzioniEsecuzione | undefined;
    const { d } = deps(reg, async function* (o) {
      visto = o;
      yield risultato("nuova");
    });
    await eseguiGiro(d);
    expect(visto).toBeDefined();
    expect(visto && "resume" in visto).toBe(false);
  });
});

describe("T6b — i limiti", () => {
  it("la durata si accorcia alla vita del gettone, e l'arresto si dice GETTONE", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const { d } = deps(reg, async function* (o) {
      yield testo("comincio");
      await new Promise<void>((_, rifiuta) => {
        o.abortController.signal.addEventListener("abort", () => rifiuta(new Error("aborted")));
      });
    }, { scadenzaGettone: Date.now() + MARGINE_GETTONE_MS + 30, durataMs: 900_000 });
    const esito = await eseguiGiro(d);
    expect(esito).toEqual({ stato: "INTERROTTA", motivo: "GETTONE" });
    expect(reg.eventi.at(-1)).toEqual({ kind: "LIMITE", payload: { limite: "GETTONE" } });
    expect(reg.stati.at(-1)).toEqual({ status: "INTERROTTA", stopReason: "GETTONE" });
  });

  it("con il gettone lungo l'arresto si dice DURATA", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const { d } = deps(reg, async function* (o) {
      await new Promise<void>((_, rifiuta) => {
        o.abortController.signal.addEventListener("abort", () => rifiuta(new Error("aborted")));
      });
      yield testo("mai");
    }, { durataMs: 30 });
    expect(await eseguiGiro(d)).toEqual({ stato: "INTERROTTA", motivo: "DURATA" });
  });

  it("un errore del giro è FALLITA, senza il testo dell'errore nel registro", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const { d } = deps(reg, async function* () {
      yield testo("ok");
      throw new Error(`segreto ${ALTRA}`);
    });
    expect(await eseguiGiro(d)).toEqual({ stato: "FALLITA", motivo: "ERRORE" });
    expect(JSON.stringify(reg.eventi)).not.toContain(ALTRA);
  });
});

describe("T6b — le proposte", () => {
  it("la proposta si salva prima di mostrarla, con scadenza non oltre il gettone; l'attività va IN_ATTESA e torna IN_CORSO", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const scadenza = Date.now() + 40_000;
    let decisione: boolean | undefined;
    const { d, scritti } = deps(reg, async function* (o) {
      const attesa = o.approve({ tool: "mcp__heuresys__hrx_update_user", input: { note: "x" }, classe: "write", personeDistinte: 3 });
      // la persona approva dalla finestra (qui: dal registro in memoria)
      await new Promise((r) => setTimeout(r, 5));
      const id = reg.proposte[0]?.proposalId as string;
      d.approvals.resolveAs(id, "allow", PERSONA);
      decisione = await attesa;
      yield risultato("scritto");
    }, { scadenzaGettone: scadenza, approvalTimeoutMs: 120_000 });
    await eseguiGiro(d);

    expect(decisione).toBe(true);
    const p = reg.proposte[0]!;
    expect(p.kind).toBe("SCRITTURA");
    expect(p.personsCount).toBe(3);
    expect(Date.parse(p.expiresAt as string)).toBe(scadenza);
    expect(reg.stati.map((s) => s.status)).toEqual(["IN_ATTESA", "IN_CORSO", "FATTA"]);
    expect(reg.eventi.map((e) => e.kind)).toContain("PROPOSTA");
    expect(scritti.join("")).toContain("approval_required");
  });

  it("una proposta che non si salva è negata e non si mostra", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    reg.rifiutaProposte = true;
    let decisione: boolean | undefined;
    const { d, scritti } = deps(reg, async function* (o) {
      decisione = await o.approve({ tool: "mcp__heuresys__hrx_update_user", input: {}, classe: "write" });
      yield risultato("niente");
    });
    await eseguiGiro(d);
    expect(decisione).toBe(false);
    expect(scritti.join("")).not.toContain("approval_required");
    expect(reg.eventi.map((e) => e.kind)).toContain("ERRORE");
    expect(d.approvals.size).toBe(0);
  });

  it("solo la persona che ha chiesto decide: un'altra non chiude la proposta", async () => {
    const r = new ApprovalRegistry({ approvalTimeoutMs: 60_000 });
    const { approvalId } = r.create(PERSONA);
    expect(r.peek(approvalId, ALTRA)).toBe("not-owner");
    expect(r.peek(approvalId, PERSONA)).toBe("pending");
    expect(r.peek("sconosciuta", PERSONA)).toBe("unknown");
  });
});

describe("titoloDa: il titolo è la domanda, non il contesto della pagina", () => {
  it("toglie la riga «Contesto: …» davanti alla domanda", async () => {
    const { titoloDa } = await import("../src/conversazione.js");
    expect(titoloDa("Contesto: Pagina «Heuresys» (/me)\n\na quali processi partecipo e con che ruolo?")).toBe(
      "a quali processi partecipo e con che ruolo?",
    );
    expect(titoloDa("una domanda senza contesto")).toBe("una domanda senza contesto");
    expect(titoloDa("")).toBe("Conversazione");
  });
});

describe("T2 — il costo e la durata di ogni giro vanno nel registro delle chiamate", () => {
  const conCosto = {
    type: "result", subtype: "success", is_error: false, result: "ok", num_turns: 2,
    duration_ms: 4321, total_cost_usd: 0.123456,
    usage: { input_tokens: 1000, cache_read_input_tokens: 500, cache_creation_input_tokens: 100, output_tokens: 250 },
  };

  it("un giro riuscito registra costo, token e durata dell'SDK", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const righe: ChiamataGiro[] = [];
    const { d } = deps(reg, async function* () { yield testo("ciao"); yield conCosto; });
    await eseguiGiro({ ...d, chiamata: async (c) => { righe.push(c); } });
    expect(righe).toEqual([{ outcome: "OK", durationMs: 4321, inputTokens: 1600, outputTokens: 250, costUsd: 0.1235 }]);
  });

  it("un giro fermato dal limite si registra LIMITE, un errore ERRORE", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const righe: ChiamataGiro[] = [];
    const { d } = deps(reg, async function* () { throw new Error("guasto"); });
    await eseguiGiro({ ...d, chiamata: async (c) => { righe.push(c); } });
    expect(righe[0]?.outcome).toBe("ERRORE");
    const reg2 = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const righe2: ChiamataGiro[] = [];
    const { d: d2 } = deps(reg2, async function* (o) {
      await new Promise((_r, rej) => o.abortController.signal.addEventListener("abort", () => rej(new Error("abort"))));
      yield testo("mai");
    }, { durataMs: 20, scadenzaGettone: Date.now() + 600_000 });
    await eseguiGiro({ ...d2, chiamata: async (c) => { righe2.push(c); } });
    expect(righe2[0]?.outcome).toBe("LIMITE");
  });

  it("se la riga non si scrive, il giro finisce lo stesso con il suo esito", async () => {
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const { d } = deps(reg, async function* () { yield testo("ciao"); yield conCosto; });
    const esito = await eseguiGiro({ ...d, chiamata: async () => { throw new Error("POST /agent-requests/calls -> 403"); } });
    expect(esito).toEqual({ stato: "FATTA" });
  });

  it("i numeri stanno nei limiti che l'API accetta, qualunque cosa dica l'evento", () => {
    const m = misuraDi({ type: "result", duration_ms: 99 * 3_600_000, total_cost_usd: 999, usage: { input_tokens: 9e9, output_tokens: -5 } });
    expect(m).toEqual({ durationMs: 6 * 3_600_000, inputTokens: 20_000_000, outputTokens: 0, costUsd: 10 });
    expect(misuraDi({ type: "assistant" })).toBeUndefined();
  });
});

describe("2026-11-22 — dopo il consenso, l'esito di una scrittura non salvata lo scrive il gateway", () => {
  // Il giro vero: proposta, consenso della persona, PUT rifiutata dall'API, e il modello che parla
  // d'altro («chi ha il permesso può salvare…») o tace. In entrambi i casi la persona deve leggere
  // la frase del gateway, nello stream e riaprendo la conversazione (registro).
  async function giroConRifiuto(codice: string, parlaIlModello: boolean) {
    const { HeuresysClient, messaggioScritturaNonSalvata } = await import("../src/heuresys-client.js");
    const client = new HeuresysClient({
      baseUrl: "http://api",
      session: { cookieAccess: "a", csrfToken: "c" } as never,
      fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}), text: async () => JSON.stringify({ error: { code: codice } }) }),
    });
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const { d, scritti } = deps(reg, async function* (o) {
      const attesa = o.approve({ tool: "mcp__heuresys__hrx_entity_query", input: {}, classe: "write" });
      await new Promise((r) => setTimeout(r, 5));
      d.approvals.resolveAs(reg.proposte[0]?.proposalId as string, "allow", PERSONA);
      expect(await attesa).toBe(true);
      await client.call("PUT", "/tenant-processes/p-1/faccette/PERIMETRO", { codes: ["INTERFUNZIONALE"], criterion: "x" }).catch(() => undefined);
      if (parlaIlModello) yield testo("Chi ha il permesso di modificare i processi può salvare; se vuoi preparo il testo.");
      yield risultato(parlaIlModello ? "preparo il testo" : "");
    }, { scrittureNonSalvate: () => client.consumaScrittureFallite() });
    await eseguiGiro(d);
    return { reg, scritti: scritti.join(""), frase: messaggioScritturaNonSalvata(403, codice) };
  }

  for (const [codice, attesa] of [["FORBIDDEN", "chi ha la responsabilità"], ["AGENT_MANDATE_ONLY", "puoi farla tu dalla pagina"]] as const) {
    for (const parla of [false, true]) {
      it(`${codice}, modello ${parla ? "che parla d'altro" : "muto"}: la frase c'è, nello stream e nel registro`, async () => {
        const { reg, scritti, frase } = await giroConRifiuto(codice, parla);
        expect(frase).toContain(attesa);
        // Fallisce se dopo il consenso non c'è testo del gateway: è il difetto da non ripetere.
        expect(scritti).toContain("event: nota");
        expect(scritti).toContain(frase);
        expect(reg.eventi.some((e) => e.kind === "TESTO" && (e.payload as { testo?: string }).testo?.includes(frase))).toBe(true);
        if (codice === "FORBIDDEN") expect(scritti).not.toContain("dalla pagina");
      });
    }
  }

  it("CONTROPROVA: una scrittura riuscita dopo il consenso non lascia nessuna nota", async () => {
    const { HeuresysClient } = await import("../src/heuresys-client.js");
    const client = new HeuresysClient({
      baseUrl: "http://api",
      session: { cookieAccess: "a", csrfToken: "c" } as never,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "{}" }),
    });
    const reg = new RegistroFinto({ id: CONV, sdkSessionRef: null, personsSeen: [] });
    const { d, scritti } = deps(reg, async function* () {
      await client.call("PUT", "/tenant-processes/p-1/faccette/PERIMETRO", {});
      yield risultato("fatto");
    }, { scrittureNonSalvate: () => client.consumaScrittureFallite() });
    await eseguiGiro(d);
    expect(scritti.join("")).not.toContain("event: nota");
  });
});
