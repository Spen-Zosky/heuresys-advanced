/**
 * apps/web/src/lib/person-label.ts — #198 T7: un segnaposto non deve poter passare
 * per una persona.
 *
 * PERCHE' ESISTE, misurato e non supposto. Dalla prima costruzione di un'azienda,
 * `sys_users` contiene due specie: persone (`STANDARD`) e **segnaposto generati**
 * (`GENERATED_INCUMBENT`), piu' le utenze di servizio. Il 2026-08-17 ho contato dove
 * compaiono elenchi di persone nel prodotto:
 *
 *   /users                      elenco vero — mostrava il tipo, ma in grigio come tutto
 *                               il resto: leggibile, non distinguibile a colpo d'occhio
 *   /approvals                  si scegle un APPROVATORE — mostrava solo `displayName`
 *   position-editor (titolare)  si scegle il TITOLARE di una posizione — solo `displayName`
 *
 * Le ultime due non sono un dettaglio di leggibilita': scegliere un segnaposto come
 * approvatore manda una richiesta di firma a qualcuno che non esiste, e la richiesta
 * resta appesa per sempre; assegnargli una posizione scrive un dato falso. In una
 * `<option>` non si puo' mettere un componente, quindi il contrassegno deve essere
 * **testo** — ed e' per questo che questa e' una funzione e non un badge.
 *
 * La regola in una riga: **una persona si chiama col suo nome; tutto ciò che non e' una
 * persona porta scritto che cosa e'.** L'etichetta del tipo viene dal layer i18n
 * (`common:enums.userType.*`, IT+EN in parita'), non da una stringa scritta qui.
 */
import type { EnumLabelFn } from "./enum-labels";

/** Il minimo che serve: qualunque risposta API che porti nome e tipo va bene. */
export type PersonaConTipo = {
  displayName: string;
  type?: string | null;
};

/**
 * `true` quando la riga NON e' una persona reale. Il caso di riferimento e'
 * `GENERATED_INCUMBENT`; `SERVICE` rientra per la stessa ragione (non e' qualcuno a
 * cui si possa chiedere una firma). Un tipo assente si tratta come persona: e' cio'
 * che era prima che il campo esistesse, e inventare un sospetto sarebbe peggio.
 */
export function nonEUnaPersona(u: PersonaConTipo): boolean {
  return u.type === "GENERATED_INCUMBENT" || u.type === "SERVICE";
}

/**
 * L'etichetta da mettere dentro una `<option>`: il nome, e per chi non e' una persona
 * il tipo fra parentesi. Non aggiunge niente alle persone reali — un'annotazione su
 * tutte le righe non distingue nessuna riga.
 */
export function etichettaPersona(u: PersonaConTipo, enumLabel: EnumLabelFn): string {
  if (!nonEUnaPersona(u)) return u.displayName;
  return `${u.displayName} (${enumLabel("userType", u.type)})`;
}
