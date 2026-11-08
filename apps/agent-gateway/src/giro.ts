/**
 * Un giro dell'assistente, staccato dalla finestra (ADR-0056 D4, piano dei principi agentici T6b).
 *
 * Prima di T6 il giro viveva dentro la risposta HTTP: chiudere la finestra lo interrompeva, e ciò
 * che era successo restava solo nel diario del gate. Qui il giro:
 *  - CONTINUA a finestra chiusa. Lo ferma solo un limite: la durata massima, la scadenza del
 *    gettone (che non si rinnova, ADR-0050 D6: oltre, l'agente non potrebbe più chiamare
 *    l'API) o i giri del modello. `scrivi` verso una finestra chiusa non fa niente;
 *  - SCRIVE ciò che la persona vede nel registro della conversazione (`conversazione.ts`), così la
 *    finestra riaperta lo ritrova, e salva la sessione dell'SDK e le impronte delle persone lette;
 *  - SALVA ogni proposta prima di mostrarla, con la sua scadenza: la persona la ritrova e la decide
 *    anche da una finestra nuova. Una proposta che non si riesce a salvare è negata;
 *  - RIPRENDE una conversazione: la sessione dell'SDK salvata va a `resume`, e il contatore delle
 *    persone distinte riparte dalle impronte salvate (lo costruisce chi chiama), così il freno
 *    di ADR-0040 §4b non si aggira riprendendo.
 *
 * Il modulo non conosce HTTP né l'SDK: riceve chi esegue il giro (`esegui`) e dove scrivere. Così
 * le regole qui sopra si provano senza modello e senza server (test/giro.test.ts).
 */
import type { ApprovalRegistry } from "./approval-bridge.js";
import { redact } from "./redact.js";
import type { ContatorePersone } from "./persone-distinte.js";
import type { ApprovalRequest, ApproveFn } from "./write-gate.js";
import {
  fineDi,
  riduci,
  sessioneDi,
  type MotivoArresto,
  type RegistroConversazione,
  type StatoAttivita,
} from "./conversazione.js";

/** Ciò che il giro usa del registro: il registro vero, o il suo doppio nelle prove. */
export type RegistroGiro = Pick<
  RegistroConversazione,
  "conversazione" | "attivitaId" | "aggiungi" | "svuota" | "proposta" | "stato" | "ricorda"
>;

/** Ciò che `esegui` riceve: lo stesso che `runHrAgent` accetta per questo giro. */
export interface OpzioniEsecuzione {
  approve: ApproveFn;
  abortController: AbortController;
  contatore: ContatorePersone;
  conversationId: string;
  resume?: string;
}

export interface GiroDeps {
  registro: RegistroGiro;
  /** Chi esegue il giro: in servizio `runHrAgent`, nelle prove un doppio. */
  esegui: (opts: OpzioniEsecuzione) => AsyncIterable<unknown>;
  /** Il contatore della conversazione, già seminato con le impronte salvate. */
  contatore: ContatorePersone;
  approvals: ApprovalRegistry;
  /** La persona per conto di cui l'agente lavora: la sola che può decidere le proposte. */
  owner: string;
  /** Quando scade il gettone d'agente (millisecondi dall'epoca). */
  scadenzaGettone: number;
  durataMs: number;
  approvalTimeoutMs: number;
  /** Verso la finestra. Una finestra chiusa non riceve niente, e il giro continua lo stesso. */
  scrivi: (pezzo: string) => void;
  now?: () => number;
}

/** Il margine prima della scadenza del gettone: l'ultima chiamata deve ancora valere. */
export const MARGINE_GETTONE_MS = 15_000;

export interface EsitoGiro {
  stato: StatoAttivita;
  motivo?: MotivoArresto;
}

function evento(nome: string | undefined, dati: unknown): string {
  return `${nome ? `event: ${nome}\n` : ""}data: ${JSON.stringify(dati)}\n\n`;
}

export async function eseguiGiro(d: GiroDeps): Promise<EsitoGiro> {
  const now = d.now ?? Date.now;
  const { registro } = d;

  // La durata vera è la più corta fra il tetto della conversazione e la vita del gettone.
  const vitaGettone = d.scadenzaGettone - now() - MARGINE_GETTONE_MS;
  const perGettone = vitaGettone < d.durataMs;
  const tempo = Math.max(0, Math.min(d.durataMs, vitaGettone));

  d.scrivi(evento("conversation", { conversationId: registro.conversazione.id, activityId: registro.attivitaId }));

  const interrompi = new AbortController();
  let motivo: MotivoArresto | undefined;
  const timer = setTimeout(() => {
    motivo = perGettone ? "GETTONE" : "DURATA";
    interrompi.abort();
  }, tempo);

  const approve: ApproveFn = async (req: ApprovalRequest) => {
    const { approvalId, decided } = d.approvals.create(d.owner);
    const scade = Math.min(now() + d.approvalTimeoutMs, d.scadenzaGettone);
    // Redatti una volta, per la finestra e per il registro: la proposta salvata non porta ciò che
    // la finestra non deve vedere (redact.ts, M-2).
    const tool = String(redact(req.tool));
    const input = redact(req.input);
    const payload = {
      approvalId,
      tool,
      input,
      ...(req.classe !== undefined ? { classe: req.classe } : {}),
      ...(req.personeDistinte !== undefined ? { personeDistinte: req.personeDistinte } : {}),
      ...(req.livello !== undefined ? { livello: req.livello } : {}),
      expiresAt: new Date(scade).toISOString(),
    };
    try {
      await registro.proposta({
        proposalId: approvalId,
        kind: req.classe === "read" ? "LETTURA" : "SCRITTURA",
        tool,
        input,
        ...(req.personeDistinte !== undefined ? { personsCount: req.personeDistinte } : {}),
        expiresAt: payload.expiresAt,
      });
    } catch (e) {
      // Fail-closed: una proposta che la persona non può ritrovare non si decide.
      d.approvals.resolve(approvalId, "deny");
      console.error(JSON.stringify({ level: "error", phase: "agent-gateway-giro", msg: "proposta non salvata, negata", error: String(e) }));
      registro.aggiungi([{ kind: "ERRORE", payload: { messaggio: "proposta non salvata: negata" } }]);
      return false;
    }
    registro.aggiungi([{ kind: "PROPOSTA", payload: { proposalId: approvalId, strumento: tool } }]);
    await registro.stato("IN_ATTESA");
    d.scrivi(evento("approval_required", payload));
    const ok = await decided;
    await registro.stato("IN_CORSO");
    return ok;
  };

  let sessione = registro.conversazione.sdkSessionRef ?? undefined;
  let fine: ReturnType<typeof fineDi>;
  let errore = false;
  try {
    for await (const ev of d.esegui({
      approve,
      abortController: interrompi,
      contatore: d.contatore,
      conversationId: registro.conversazione.id,
      ...(registro.conversazione.sdkSessionRef ? { resume: registro.conversazione.sdkSessionRef } : {}),
    })) {
      d.scrivi(evento(undefined, ev));
      const nuova = sessioneDi(ev);
      if (nuova && nuova !== sessione) {
        sessione = nuova;
        await registro.ricorda({ sdkSessionRef: nuova });
      }
      fine = fineDi(ev) ?? fine;
      const visti = riduci(ev);
      if (visti.length > 0) {
        registro.aggiungi(visti);
        void registro.svuota();
      }
    }
  } catch (err) {
    // Un'interruzione voluta non è un errore: la si racconta qui sotto, una volta sola.
    if (motivo === undefined) {
      errore = true;
      console.error(JSON.stringify({ level: "error", phase: "agent-gateway-giro", msg: "giro fermato da un errore", error: String(err) }));
      registro.aggiungi([{ kind: "ERRORE", payload: { messaggio: "il giro si è fermato per un errore" } }]);
      d.scrivi(evento("error", { message: String(err) }));
    }
  } finally {
    clearTimeout(timer);
  }

  let esito: EsitoGiro;
  if (motivo !== undefined) {
    registro.aggiungi([{ kind: "LIMITE", payload: { limite: motivo } }]);
    d.scrivi(evento("limit", { limite: motivo, durataMs: tempo }));
    esito = { stato: "INTERROTTA", motivo };
  } else if (errore) {
    esito = { stato: "FALLITA", motivo: "ERRORE" };
  } else {
    esito = fine ? { stato: fine.esito, ...(fine.motivo ? { motivo: fine.motivo } : {}) } : { stato: "FATTA" };
  }
  await registro.stato(esito.stato, {
    ...(esito.motivo ? { stopReason: esito.motivo } : {}),
    ...(fine?.risultato && esito.stato === "FATTA" ? { result: fine.risultato } : {}),
  });
  await registro.ricorda({ personsSeen: d.contatore.impronte() });
  d.scrivi(evento("done", {}));
  return esito;
}
