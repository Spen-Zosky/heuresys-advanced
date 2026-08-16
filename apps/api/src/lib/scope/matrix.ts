/**
 * apps/api/src/lib/scope/matrix.ts — M1, la matrice dominio × classe × modalità (#99 F7).
 *
 * ADR-0036 fonda l'accesso sull'**intersezione** di un perimetro gerarchico (*su quali
 * persone*) e di una modalità funzionale (*quali dati e come*). Il primo è calcolato da
 * `resolver.ts`; la seconda è **questa tabella**, che fino a oggi viveva soltanto in un
 * documento e in due costanti sparse.
 *
 * PERCHÉ ESISTE, e non è una riscrittura del già fatto. Prima di F7 la modalità era
 * dichiarata in tre posti che non si conoscevano:
 *
 *  - `MASKED_UNDER_PLATFORM_MANDATE` (mask.ts) — la riga `platform_mandate` di M1, scritta
 *    a mano. Ora **discende da qui** (vedi `classiMascherateDa`), così le due non possono
 *    divergere: erano già due verità sullo stesso fatto.
 *  - `DOMINI_CHE_APRONO_UNA_SUPERFICIE` (domains.ts) — un predicato binario che risponde
 *    «vedi oltre il tuo record sì/no». È l'approssimazione grossolana di M1: dice *se*
 *    guardi, non *cosa*. Resta valido come pavimento, ma non basta a decidere una voce di
 *    menu, ed è il difetto che F7 chiude.
 *  - `ui_interface_requires_admin` (una colonna booleana) — la dichiarazione a mano che M3
 *    esiste per rendere derivabile.
 *
 * LA REGOLA DI DERIVAZIONE (M3, §11 del documento dei domini):
 *
 *   una tipologia vede una voce **se e solo se** esiste almeno una cella non-`none` fra i
 *   suoi domini e le classi di dato che quella pagina espone.
 *
 * ⚠ COSA QUESTA TABELLA NON FA. Non concede accesso: **restringe**. Il permesso RBAC resta
 * il *se* (I16) e viene valutato prima; M1 dice *cosa*, e può solo togliere. Un dominio con
 * `edit` su una classe non apre una pagina di cui non si ha il permesso.
 */

import type { DataClass } from "./data-classes.js";
import type { Domain } from "./domains.js";

/**
 * Le quattro modalità di ADR-0036. `mask` è il **quarto stato di autorizzazione** (I20):
 * la riga si vede, il valore è ridotto — non è nascondere lato grafica (C3).
 */
export type AccessMode = "edit" | "read" | "mask" | "none";

/**
 * M1 — 10 domini × 7 classi.
 *
 * DUE ASSENZE DICHIARATE, perché un'assenza non spiegata è un difetto travestito:
 *
 *  - **`self` non è una riga.** Il documento gliene dà una, ma `self` non è un dominio che
 *    si accende: è il pavimento universale (I17), sempre vero per tutti, e vive fuori da
 *    questo gate — le voci `/me/*` non lo interrogano. Metterlo qui suggerirebbe che possa
 *    valere `none`, che è esattamente ciò che I17 vieta.
 *  - **`delegation` non eredita, qui.** M1 dice «eredita dal delegante». Per la visibilità
 *    di una voce di menu quell'eredità andrebbe risolta a ogni richiesta, interrogando i
 *    domini di un'altra persona. Costo alto, beneficio oggi nullo: l'unico ambito che un
 *    endpoint concede è `APPROVALS` (dichiarato in `000314`), e la delega è `readonly` per
 *    §7.2. Quindi qui la delega vale ciò che il suo ambito consente davvero — `ACTIVITY` in
 *    lettura — e **concede meno** del delegante, mai di più. Il giorno che `FULL` diventerà
 *    concedibile, questa cella va risolta a runtime: è una riga di codice, non una
 *    migrazione, ed è annotata sul CHECK della tabella.
 */
export const M1: Readonly<Record<Domain, Readonly<Record<DataClass, AccessMode>>>> = {
  // ── i due mandati: role-shaped per definizione (ADR-0036 §2.5), non dedotti dall'albero
  hr_mandate: {
    PERSONAL: "edit", COMPENSATION: "edit", SKILL: "edit", EVALUATION: "edit",
    ACTIVITY: "edit", CREDENTIAL: "none", SPECIAL_CATEGORY: "none",
  },
  platform_mandate: {
    // ⚠ RESTRINGE rispetto a prima di ADR-0032: l'amministratore tecnico deve far
    // funzionare il sistema, non leggere stipendi e valutazioni.
    PERSONAL: "edit", COMPENSATION: "mask", SKILL: "read", EVALUATION: "mask",
    ACTIVITY: "read", CREDENTIAL: "edit", SPECIAL_CATEGORY: "none",
  },
  // ── il dominio gerarchico: il capo di una catena (I19)
  line_management: {
    // IDENTITY `mask`: identità professionale in chiaro, vita privata no. Un capo coordina
    // il lavoro, non amministra la casa. CONTRACT_PAY `mask`: fascia sì, importo esatto no.
    PERSONAL: "mask", COMPENSATION: "mask", SKILL: "read", EVALUATION: "edit",
    ACTIVITY: "read", CREDENTIAL: "none", SPECIAL_CATEGORY: "none",
  },
  // ── i domini funzionali: dicono COSA FAI, non SU CHI GUARDI (I18)
  team_lead: {
    PERSONAL: "mask", COMPENSATION: "none", SKILL: "read", EVALUATION: "none",
    ACTIVITY: "edit", CREDENTIAL: "none", SPECIAL_CATEGORY: "none",
  },
  process_owner: {
    PERSONAL: "mask", COMPENSATION: "none", SKILL: "read", EVALUATION: "none",
    ACTIVITY: "edit", CREDENTIAL: "none", SPECIAL_CATEGORY: "none",
  },
  mentor: {
    PERSONAL: "mask", COMPENSATION: "none", SKILL: "read", EVALUATION: "none",
    ACTIVITY: "read", CREDENTIAL: "none", SPECIAL_CATEGORY: "none",
  },
  approver: {
    // CONTRACT_PAY `none`: chi approva vede la RICHIESTA, non la situazione economica del
    // richiedente. Se un'approvazione ha bisogno di un importo, quell'importo sta nella
    // richiesta (classe ACTIVITY), non si apre la classe economica per ottenerlo.
    PERSONAL: "mask", COMPENSATION: "none", SKILL: "none", EVALUATION: "none",
    ACTIVITY: "read", CREDENTIAL: "none", SPECIAL_CATEGORY: "none",
  },
  team_peer: {
    // Vincolo posto da Enzo alla scelta: nome, competenze, disponibilità. Mai anagrafica
    // privata, mai economico, mai valutativo.
    PERSONAL: "mask", COMPENSATION: "none", SKILL: "read", EVALUATION: "none",
    ACTIVITY: "read", CREDENTIAL: "none", SPECIAL_CATEGORY: "none",
  },
  delegation: {
    PERSONAL: "none", COMPENSATION: "none", SKILL: "none", EVALUATION: "none",
    ACTIVITY: "read", CREDENTIAL: "none", SPECIAL_CATEGORY: "none",
  },
  // ── la custodia: isolamento assoluto in entrambe le direzioni (ADR-0036 §5)
  custody: {
    // IDENTITY `read`: l'identità del segnalante, quando la segnalazione non è anonima,
    // serve a istruire il caso. Tutto il resto è chiuso — la custodia non è un mandato HR.
    PERSONAL: "read", COMPENSATION: "none", SKILL: "none", EVALUATION: "none",
    ACTIVITY: "edit", CREDENTIAL: "none", SPECIAL_CATEGORY: "none",
  },
};

/** Vero se il dominio vede la classe in una qualunque modalità diversa da `none`. */
export function vede(domain: Domain, dataClass: DataClass): boolean {
  return M1[domain][dataClass] !== "none";
}

/**
 * La regola di derivazione M3, in una funzione.
 *
 * `classi` vuoto significa **«questa superficie non espone dati di persona»** — cataloghi,
 * blueprint, processi, strutture — e allora M1 non ha voce in capitolo: decide il solo RBAC,
 * che è già stato valutato dal chiamante. Restituire `false` lì sarebbe il difetto opposto a
 * quello che F7 corregge: spegnerebbe le pagine di catalogo a chiunque.
 */
export function almenoUnaCellaAperta(
  domini: ReadonlySet<Domain>,
  classi: readonly DataClass[],
): boolean {
  if (classi.length === 0) return true;
  for (const d of domini) for (const c of classi) if (vede(d, c)) return true;
  return false;
}

/**
 * La modalità con cui l'attore può guardare UNA VISTA, dati i suoi domini (#142 F3a).
 *
 * PERCHÉ NON BASTA `almenoUnaCellaAperta`, e la differenza è costata un difetto reale.
 * Quella funzione risponde a «questa superficie ti riguarda, sì o no?», e per rispondere
 * tratta `mask` come **aperto** — giustamente: una pagina di cui vedi metà dei valori è
 * comunque una pagina tua. Ma la domanda di una VISTA dentro un cruscotto è un'altra:
 * *come* la guardi. Con la sola funzione binaria un `PLATFORM_ADMIN` si vedeva la vista
 * delle retribuzioni **in chiaro**, mentre ADR-0032 gli dà `mask` su `COMPENSATION`.
 * Misurato dalla prova live del 2026-08-16, non dal ragionamento.
 *
 * LA REGOLA, e sceglie di FALLIRE CHIUSO:
 *  · per ogni classe della vista si prende la modalità MIGLIORE fra i domini attivi
 *    (è ciò che l'attore può davvero fare su quella classe);
 *  · la vista prende poi la modalità PEGGIORE fra le sue classi, perché una vista è una
 *    cosa sola e non può mostrarne metà: se una delle sue classi è chiusa, la vista è
 *    chiusa; se una è mascherata, la vista è mascherata.
 *  · una vista SENZA classi è `open`: non espone dati di persona, e M1 non ha voce in
 *    capitolo — è il caso del Self-Service (I17), dove mascherare significherebbe negare
 *    a una persona i propri stessi dati.
 */
export type ModalitaVista = "open" | "masked" | "denied";

const FORZA: Record<AccessMode, number> = { edit: 3, read: 2, mask: 1, none: 0 };

export function modalitaDellaVista(
  domini: ReadonlySet<Domain>,
  classi: readonly DataClass[],
): ModalitaVista {
  if (classi.length === 0) return "open";
  let peggiore = 3;
  for (const c of classi) {
    let migliore = 0;
    for (const d of domini) migliore = Math.max(migliore, FORZA[M1[d][c]]);
    peggiore = Math.min(peggiore, migliore);
  }
  if (peggiore >= 2) return "open";
  return peggiore === 1 ? "masked" : "denied";
}

/**
 * Le classi che il dominio vede **mascherate**.
 *
 * È la sorgente da cui `mask.ts` deriva `MASKED_UNDER_PLATFORM_MANDATE`: prima erano due
 * dichiarazioni della stessa cosa in due file, e una delle due sarebbe invecchiata da sola.
 */
export function classiMascherateDa(domain: Domain): ReadonlySet<DataClass> {
  const out = new Set<DataClass>();
  for (const [c, mode] of Object.entries(M1[domain]) as [DataClass, AccessMode][]) {
    if (mode === "mask") out.add(c);
  }
  return out;
}
