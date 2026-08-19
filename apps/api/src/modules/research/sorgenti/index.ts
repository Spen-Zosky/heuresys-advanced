/**
 * apps/api/src/modules/research/sorgenti/index.ts
 *
 * CHI PROPONE — il registro delle sorgenti (#132 F4g).
 *
 * Il motore sa cercare, leggere, validare e registrare; **non sa proporre**. Proporre vuol
 * dire ricavare un dato strutturato dal testo di pagine appena lette, ed e' l'unico atto di
 * questa catena che non si puo' scrivere come funzione: lo fa un modello linguistico.
 *
 * ⚠ SE IL FORNITORE NON C'E', SI DICE. La sorgente predefinita non e' una finta che
 * restituisce un elenco vuoto: e' una che **solleva**, con un codice riconoscibile. Una corsa
 * che si chiude «COMPLETED, 0 proposte» perche' non c'era nessuno a proporre e' identica, a
 * chi la legge, a una corsa che ha cercato e non ha trovato niente — e sono due cose
 * opposte. Lo zero silenzioso e' il difetto peggiore, perche' somiglia a un successo.
 */
import type { ProposalSource } from "../engine.js";

export const RESEARCH_SOURCE_UNAVAILABLE = "RESEARCH_SOURCE_UNAVAILABLE";

export class SorgenteNonDisponibileError extends Error {
  readonly code = RESEARCH_SOURCE_UNAVAILABLE;
  constructor(motivo: string) {
    super(`Nessuno puo' proporre: ${motivo}`);
    this.name = "SorgenteNonDisponibileError";
  }
}

/** La sorgente che dichiara la propria assenza invece di fingere una corsa vuota. */
export const SORGENTE_ASSENTE: ProposalSource = {
  chiave: "assente",
  proponi() {
    return Promise.reject(
      new SorgenteNonDisponibileError(
        "il fornitore di proposte non e' configurato (#132 F4h). La ricerca sa leggere e validare, ma non c'e' chi ricavi le proposte dalle pagine lette.",
      ),
    );
  },
};

let registrata: ProposalSource = SORGENTE_ASSENTE;

/** Registra chi propone. Lo fa l'avvio dell'applicazione, o un test con la sua. */
export function registraSorgente(s: ProposalSource): void {
  registrata = s;
}

export function sorgenteRegistrata(): ProposalSource {
  return registrata;
}

/** Per i test, e per il riavvio pulito: torna alla sorgente che dichiara l'assenza. */
export function azzeraSorgente(): void {
  registrata = SORGENTE_ASSENTE;
}
