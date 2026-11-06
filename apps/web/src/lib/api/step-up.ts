/**
 * apps/web/src/lib/api/step-up.ts — ADR-0050 D5.
 *
 * Chi legge per mandato la retribuzione o le valutazioni di un'altra persona deve avere
 * confermato il secondo fattore da poco. L'API risponde 403 `STEP_UP_REQUIRED`; `apiFetch`
 * chiede qui la conferma e, se arriva, ripete la richiesta una volta.
 *
 * La conferma la raccoglie `StepUpDialog`, montato una volta nel guscio autenticato, che si
 * registra con `registraRichiestaConferma`. Più richieste respinte insieme (una pagina ne fa
 * molte in parallelo) aprono UNA finestra sola: tutte aspettano la stessa promessa.
 * Senza una finestra registrata (pagine pubbliche, prove) la conferma non arriva e l'errore
 * resta quello dell'API.
 */
import { STEP_UP_REQUIRED_CODE } from "@heuresys/shared/schemas/mfa";

export { STEP_UP_REQUIRED_CODE };

type Richiesta = () => Promise<boolean>;

let gestore: Richiesta | null = null;
let inVolo: Promise<boolean> | null = null;

/** Il dialogo si registra al montaggio; la funzione restituita lo toglie allo smontaggio. */
export function registraRichiestaConferma(fn: Richiesta): () => void {
  gestore = fn;
  return () => {
    if (gestore === fn) gestore = null;
  };
}

/** Chiede la conferma del secondo fattore. Vero se la persona l'ha data. */
export function chiediConferma(): Promise<boolean> {
  if (!gestore) return Promise.resolve(false);
  if (!inVolo) {
    const corrente = gestore;
    inVolo = corrente().finally(() => {
      inVolo = null;
    });
  }
  return inVolo;
}
