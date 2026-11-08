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
import { eseguiGiro, MARGINE_GETTONE_MS, type OpzioniEsecuzione, type RegistroGiro } from "../src/giro.js";
import type { Evento, MotivoArresto, StatoAttivita } from "../src/conversazione.js";
import { riduci, fineDi, titoloDa } from "../src/conversazione.js";

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
