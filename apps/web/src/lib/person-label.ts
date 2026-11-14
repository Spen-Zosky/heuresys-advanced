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
  firstName?: string | null;
  lastName?: string | null;
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
  // R1 (blocco B8): anche nelle caselle di scelta la persona si scrive «Cognome, Nome».
  const nome = cognomeNome(u) || u.displayName;
  if (!nonEUnaPersona(u)) return nome;
  return `${nome} (${enumLabel("userType", u.type)})`;
}

/**
 * R1 del repertorio interfacce (docs/kb/xtras/INTERFACCE_INTELLIGENTI.md, regola di Enzo
 * del 10/11/2026): in ogni elenco una persona si scrive «Cognome, Nome», così l'occhio
 * scorre l'ordine alfabetico per cognome. Senza cognome (un'utenza di servizio) resta il
 * nome com'è.
 */
export function cognomeNome(u: {
  displayName: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const cognome = u.lastName?.trim();
  const nome = u.firstName?.trim();
  if (cognome && nome) return `${cognome}, ${nome}`;
  if (cognome) return cognome;
  return u.displayName ?? "";
}

/**
 * C1/C4: la stringa del browser («Mozilla/5.0 (X11; Linux x86_64) …») non dice niente a chi la
 * legge. Si scrive il browser e il sistema, come «Chrome su Windows».
 */
export function dispositivoLeggibile(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /curl\//.test(ua) ? "curl" : null;
  const sistema = /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  if (browser && sistema) return `${browser} su ${sistema}`;
  return browser ?? sistema ?? "Dispositivo non riconosciuto";
}
