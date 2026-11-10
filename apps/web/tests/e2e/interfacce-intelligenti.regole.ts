/**
 * apps/web/tests/e2e/interfacce-intelligenti.regole.ts
 *
 * Le regole del repertorio interfacce (docs/kb/xtras/INTERFACCE_INTELLIGENTI.md) che una
 * macchina sa misurare su una pagina viva. La funzione `misuraPagina` gira DENTRO il browser
 * (page.evaluate), quindi non importa niente e non chiude su variabili esterne.
 *
 * Che cosa misura, e perché così:
 *  - R3 «stato in coda»: in ogni tabella la colonna dello stato è l'ultima colonna di dati
 *    (dopo può stare solo la colonna delle azioni, che non è un dato).
 *  - R4 «niente codici a video»: nessun codice di macchina (MAIUSCOLO_CON_TRATTINO o una
 *    parola di stato inglese in maiuscolo) nelle intestazioni, nelle celle, nelle caselle di
 *    scelta e nei titoli. Si legge `textContent` e non `innerText`: una parola resa in
 *    maiuscolo dal CSS non è un codice.
 *  - R5 «un solo numero»: se la pagina dichiara un totale nel titolo («N totali», «N persone»)
 *    e la tabella dice «x–y di M», N e M coincidono. Due numeri diversi per la stessa cosa sono
 *    il difetto 167/158 e il troncamento a 50 righe.
 *
 * R1 (cognome, nome) e R2 (colonne scelte per il contesto) sono giudizi: li fa il rito di
 * revisione, non questa funzione.
 */

export type Rilievo = "R3-stato-non-in-coda" | "R4-codice-a-video" | "R5-numeri-diversi";

export interface Misura {
  rilievi: Rilievo[];
  dettagli: string[];
}

/** Gira nel browser. Tutto ciò che usa sta qui dentro. */
export function misuraPagina(): Misura {
  const rilievi = new Set<string>();
  const dettagli: string[] = [];
  const main = document.querySelector("main") ?? document.body;

  const STATO = /^(stato|status|attiv[ao]|stato del dato)$/i;
  const AZIONI = /^(azioni|actions|)$/i;
  for (const t of Array.from(main.querySelectorAll("table"))) {
    const heads = Array.from(t.querySelectorAll("thead th")).map((h) => (h.textContent ?? "").trim());
    let ultima = heads.length - 1;
    while (ultima >= 0 && AZIONI.test(heads[ultima] ?? "")) ultima--;
    heads.forEach((h, i) => {
      if (STATO.test(h) && i !== ultima) {
        rilievi.add("R3-stato-non-in-coda");
        dettagli.push(`R3: «${h}» è la colonna ${i + 1} di ${ultima + 1}`);
      }
    });
  }

  const CODICE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]*[A-Z0-9]\b|\b(?:ACTIVE|INACTIVE|PENDING|DRAFT|STANDARD|MEDIUM|HIGH|LOW|CRITICAL|APPROVED|REJECTED|COMPLETED|CANCELLED|ARCHIVED)\b/g;
  const testi: string[] = [];
  for (const el of Array.from(main.querySelectorAll("th, td, option, h1, h2, h3, [role=option]"))) {
    /* una cella che contiene un'altra cella misurata si conta una volta sola */
    if (el.querySelector("td, th")) continue;
    testi.push((el.textContent ?? "").trim());
  }
  const trovati = new Set<string>();
  for (const s of testi) for (const m of s.match(CODICE) ?? []) trovati.add(m);
  if (trovati.size > 0) {
    rilievi.add("R4-codice-a-video");
    dettagli.push(`R4: ${Array.from(trovati).slice(0, 12).join(", ")}`);
  }

  const testo = (main.textContent ?? "").replace(/\s+/g, " ");
  const dich = testo.match(/(?<![\d.])(\d[\d.]*)\s+(?:totali|persone|utenze|posizioni|righe|elementi)\b/i);
  const pag = testo.match(/\d+\s*[–-]\s*\d+\s+di\s+(\d[\d.]*)/);
  if (dich && pag) {
    const n = Number(dich[1]!.replace(/\./g, ""));
    const m = Number(pag[1]!.replace(/\./g, ""));
    if (n !== m) {
      rilievi.add("R5-numeri-diversi");
      dettagli.push(`R5: il titolo dice ${n}, la tabella ${m}`);
    }
  }
  return { rilievi: Array.from(rilievi).sort() as Rilievo[], dettagli };
}
