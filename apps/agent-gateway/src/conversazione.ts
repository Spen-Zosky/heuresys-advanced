/**
 * La conversazione salvata (ADR-0056 D4, piano dei principi agentici voce T6b).
 *
 * Il gateway non tiene più la conversazione dentro la richiesta HTTP: la scrive nel database
 * attraverso `/v1/agent-conversations` (modulo API della voce T6a), con il gettone d'agente della
 * persona. Così il giro prosegue a finestra chiusa, la finestra riaperta ritrova ciò che è successo
 * leggendo dall'API con i cookie della persona, e una conversazione si riprende.
 *
 * Due regole che reggono il resto:
 *  - SI SALVA CIÒ CHE LA PERSONA VEDE, non ciò che l'agente ha letto. `riduci` tiene il testo
 *    dell'assistente, il nome dello strumento chiamato e la fine del giro; lascia fuori gli
 *    argomenti e i risultati degli strumenti, che possono riguardare altre persone.
 *  - SALVARE NON DEVE FERMARE IL GIRO. Un guasto dell'API su un evento si conta e si dichiara nel
 *    log, ma non interrompe la conversazione in corso: la finestra aperta riceve comunque lo
 *    stream. Le scritture che contano per la sicurezza (la proposta in attesa) invece falliscono
 *    chiuse: una proposta che non si riesce a salvare è una proposta negata.
 *
 * Il client che usa questo modulo è uno a parte, senza contatore di persone: le risposte del
 * registro non sono letture dell'agente.
 */
import type { HeuresysClient } from "./heuresys-client.js";

export type TipoEvento = "TESTO" | "STRUMENTO" | "PROPOSTA" | "LIMITE" | "ERRORE" | "FINE";
export interface Evento {
  kind: TipoEvento;
  payload: Record<string, unknown>;
}

export type StatoAttivita = "IN_CORSO" | "IN_ATTESA" | "FATTA" | "FALLITA" | "INTERROTTA";
export type MotivoArresto = "DURATA" | "GETTONE" | "GIRI" | "ERRORE" | "PERSONA";

/** Lo stato salvato di una conversazione, ciò che serve per riprenderla. */
export interface ConversazioneSalvata {
  id: string;
  sdkSessionRef: string | null;
  personsSeen: string[];
}

/** Il testo più lungo che si salva in un evento: ciò che la persona vede, non un deposito. */
const MAX_TESTO = 16_000;

function taglia(s: string): string {
  return s.length > MAX_TESTO ? `${s.slice(0, MAX_TESTO)}…` : s;
}

/**
 * Ciò che la persona vede di un evento dell'SDK, già ridotto. Pura: non chiama niente.
 *  - `assistant`: un evento per ogni blocco di testo, uno per ogni strumento (solo il nome);
 *  - `result`: la fine, con il testo finale e i giri;
 *  - tutto il resto (sistema, risultati degli strumenti, flussi parziali) non si salva.
 */
export function riduci(evento: unknown): Evento[] {
  if (!evento || typeof evento !== "object") return [];
  const e = evento as { type?: unknown; message?: { content?: unknown }; subtype?: unknown; result?: unknown; num_turns?: unknown; is_error?: unknown };
  if (e.type === "assistant" && Array.isArray(e.message?.content)) {
    const out: Evento[] = [];
    for (const b of e.message.content as Array<{ type?: unknown; text?: unknown; name?: unknown }>) {
      if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
        out.push({ kind: "TESTO", payload: { testo: taglia(b.text) } });
      } else if (b?.type === "tool_use" && typeof b.name === "string") {
        out.push({ kind: "STRUMENTO", payload: { strumento: b.name } });
      }
    }
    return out;
  }
  if (e.type === "result") {
    return [{
      kind: "FINE",
      payload: {
        esito: typeof e.subtype === "string" ? e.subtype : "sconosciuto",
        ...(typeof e.result === "string" ? { risultato: taglia(e.result) } : {}),
        ...(typeof e.num_turns === "number" ? { giri: e.num_turns } : {}),
        errore: e.is_error === true,
      },
    }];
  }
  return [];
}

/** L'identificativo di sessione che l'SDK annuncia all'avvio (`system`/`init`), se l'evento lo è. */
export function sessioneDi(evento: unknown): string | undefined {
  if (!evento || typeof evento !== "object") return undefined;
  const e = evento as { type?: unknown; subtype?: unknown; session_id?: unknown };
  return e.type === "system" && e.subtype === "init" && typeof e.session_id === "string" && e.session_id
    ? e.session_id
    : undefined;
}

/** Il testo finale e l'esito dell'SDK, per chiudere l'attività. */
export function fineDi(evento: unknown): { risultato?: string; esito: StatoAttivita; motivo?: MotivoArresto } | undefined {
  if (!evento || typeof evento !== "object") return undefined;
  const e = evento as { type?: unknown; subtype?: unknown; result?: unknown; is_error?: unknown };
  if (e.type !== "result") return undefined;
  if (e.subtype === "success" && e.is_error !== true) {
    return { esito: "FATTA", ...(typeof e.result === "string" ? { risultato: taglia(e.result) } : {}) };
  }
  if (e.subtype === "error_max_turns") return { esito: "INTERROTTA", motivo: "GIRI" };
  return { esito: "FALLITA", motivo: "ERRORE" };
}

/** Il titolo di una conversazione nuova: l'inizio della prima richiesta, su una riga. */
export function titoloDa(prompt: string): string {
  const riga = prompt.replace(/\s+/g, " ").trim();
  return riga.length > 80 ? `${riga.slice(0, 79)}…` : riga || "Conversazione";
}

export class ConversazioneNonTrovata extends Error {}

/**
 * La conversazione ha già un giro aperto (in corso o in attesa della persona). Due giri insieme
 * sulla stessa sessione dell'SDK la scriverebbero in due rami: il secondo aspetta che il primo
 * finisca. Un giro rimasto aperto oltre la durata massima si legge INTERROTTA e non occupa più.
 */
export class ConversazioneOccupata extends Error {}

/**
 * Il registro di una conversazione e della sua attività in corso, sopra l'API. Gli eventi si
 * raccolgono e partono a lotti (`svuota`), così un giro non diventa una scrittura per ogni riga.
 */
export class RegistroConversazione {
  private coda: Evento[] = [];
  private invio: Promise<void> = Promise.resolve();
  private guasti = 0;

  private constructor(
    private readonly api: HeuresysClient,
    readonly conversazione: ConversazioneSalvata,
    readonly attivitaId: string,
  ) {}

  /**
   * Apre (o riprende) la conversazione e vi apre un'attività per `prompt`. Se `conversationId` è
   * dato e l'API risponde che non c'è (o non è della persona), lancia `ConversazioneNonTrovata`.
   */
  static async apri(
    api: HeuresysClient,
    opts: { conversationId?: string; agentCode: string; prompt: string },
  ): Promise<RegistroConversazione> {
    let c: ConversazioneSalvata;
    if (opts.conversationId) {
      try {
        c = await api.call<ConversazioneSalvata & { activities?: Array<{ status?: string }> }>(
          "GET",
          `/agent-conversations/${encodeURIComponent(opts.conversationId)}`,
        );
      } catch (e) {
        if (String(e).includes("-> 404") || String(e).includes("-> 400")) throw new ConversazioneNonTrovata(opts.conversationId);
        throw e;
      }
      const aperta = (c as { activities?: Array<{ status?: string }> }).activities?.some(
        (a) => a.status === "IN_CORSO" || a.status === "IN_ATTESA",
      );
      if (aperta) throw new ConversazioneOccupata(opts.conversationId);
    } else {
      c = await api.call<ConversazioneSalvata>("POST", "/agent-conversations", {
        agentCode: opts.agentCode,
        title: titoloDa(opts.prompt),
      });
    }
    const a = await api.call<{ id: string }>("POST", `/agent-conversations/${c.id}/activities`, { prompt: opts.prompt });
    return new RegistroConversazione(api, { id: c.id, sdkSessionRef: c.sdkSessionRef ?? null, personsSeen: c.personsSeen ?? [] }, a.id);
  }

  /** Gli eventi che non si sono potuti salvare finora. */
  get eventiPersi(): number {
    return this.guasti;
  }

  /** Mette in coda gli eventi; partono al prossimo `svuota`. */
  aggiungi(eventi: readonly Evento[]): void {
    this.coda.push(...eventi);
  }

  /** Manda gli eventi in coda, in ordine, a lotti di cento. Non lancia: un guasto si conta. */
  svuota(): Promise<void> {
    this.invio = this.invio.then(async () => {
      while (this.coda.length > 0) {
        const lotto = this.coda.splice(0, 100);
        try {
          await this.api.call("POST", `/agent-conversations/activities/${this.attivitaId}/events`, { events: lotto });
        } catch (e) {
          this.guasti += lotto.length;
          console.error(JSON.stringify({ level: "error", phase: "agent-gateway-conversazione", msg: "eventi non salvati", n: lotto.length, error: String(e) }));
        }
      }
    });
    return this.invio;
  }

  /**
   * Salva una proposta in attesa della persona. Lancia se non riesce: chi chiama la tratta come
   * negata (fail-closed), perché una proposta che la persona non può ritrovare non si decide.
   */
  async proposta(p: {
    proposalId: string;
    kind: "SCRITTURA" | "LETTURA";
    tool: string;
    input: unknown;
    actionClass?: "A" | "B" | "C";
    personsCount?: number;
    expiresAt: string;
  }): Promise<void> {
    await this.svuota();
    await this.api.call("POST", `/agent-conversations/activities/${this.attivitaId}/proposals`, p);
  }

  /** Cambia lo stato dell'attività. Non lancia: lo stato si legge comunque (000483). */
  async stato(status: StatoAttivita, extra: { stopReason?: MotivoArresto; result?: string } = {}): Promise<void> {
    await this.svuota();
    try {
      await this.api.call("PATCH", `/agent-conversations/activities/${this.attivitaId}`, { status, ...extra });
    } catch (e) {
      console.error(JSON.stringify({ level: "error", phase: "agent-gateway-conversazione", msg: "stato non salvato", status, error: String(e) }));
    }
  }

  /** Salva la sessione dell'SDK da riprendere e le impronte delle persone lette. Non lancia. */
  async ricorda(extra: { sdkSessionRef?: string; personsSeen?: string[] }): Promise<void> {
    if (!extra.sdkSessionRef && !extra.personsSeen?.length) return;
    try {
      await this.api.call("PATCH", `/agent-conversations/${this.conversazione.id}`, extra);
    } catch (e) {
      console.error(JSON.stringify({ level: "error", phase: "agent-gateway-conversazione", msg: "conversazione non aggiornata", error: String(e) }));
    }
  }
}
