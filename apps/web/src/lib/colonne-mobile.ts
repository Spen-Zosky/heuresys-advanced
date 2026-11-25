/**
 * apps/web/src/lib/colonne-mobile.ts — K18 del giro forense del 23/11/2026: le tabelle che non si
 * ripiegano a 390 px.
 *
 * Una tabella con sei colonne, a 390 px, restava tabella: le ultime colonne uscivano dallo schermo
 * o una colonna si stringeva a pochi caratteri. Sotto md (768 px) restano in tabella le prime
 * colonne con un titolo, e le altre si leggono nella scheda della riga, che le mostra tutte. La
 * colonna dei comandi (intestazione vuota) resta sempre, perché è lì che si agisce. Se la tabella
 * non ha la scheda della riga (una pagina che apre la riga altrove), non si nasconde niente: un
 * dato che non si può più raggiungere è peggio di una tabella che scorre.
 */
export const COLONNE_SU_MOBILE = 3;

export function visibiliSuMobile(
  intestazioni: readonly unknown[],
  { conScheda = true, massimo = COLONNE_SU_MOBILE }: { conScheda?: boolean; massimo?: number } = {},
): boolean[] {
  if (!conScheda) return intestazioni.map(() => true);
  let conTitolo = 0;
  return intestazioni.map((h) => {
    if (h === "") return true;
    conTitolo += 1;
    return conTitolo <= massimo;
  });
}

/**
 * Le classi di una tabella che sotto md si ripiega in schede: ogni riga diventa un blocco, ogni
 * cella una coppia «intestazione · valore» (l'intestazione la scrive la cella stessa, visibile solo
 * sotto md). Un solo albero DOM per le due larghezze: le prove che contano le righe o cercano un
 * comando dentro una cella trovano gli stessi elementi a 390 e a 1440 px.
 */
export const RIPIEGABILE = {
  tabella: "block w-full text-sm md:table",
  intestazione: "hidden md:table-header-group",
  corpo: "block divide-y divide-border md:table-row-group",
  riga: "block py-2 md:table-row md:py-0",
  cella: "grid grid-cols-[7rem_minmax(0,1fr)] gap-2 px-3 py-1 align-top md:table-cell md:py-2",
  etichetta: "text-xs text-muted-foreground md:hidden",
} as const;

/**
 * L'etichetta di una cella ripiegata scritta dal CSS, dall'attributo `data-etichetta` della cella,
 * invece che da un elemento in più (giro del 25/11, `EntityTable`): il testo della cella resta
 * quello del dato, per le prove che lo leggono e per chi lo copia. Il `::before` di una griglia ne
 * è il primo elemento, quindi cade nella colonna di 7rem di `RIPIEGABILE.cella`.
 */
export const ETICHETTA_DA_ATTRIBUTO =
  "before:content-[attr(data-etichetta)] before:text-xs before:text-muted-foreground md:before:hidden";
