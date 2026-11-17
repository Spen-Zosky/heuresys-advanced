/**
 * apps/api/src/lib/notifications/messaggi.ts
 * I testi degli avvisi che l'API scrive da se' (promemoria e scadenza di un'approvazione, gap di competenze)
 * e il loro significato strutturato: un codice e i parametri.
 *
 * PERCHE' (giudizio qa-web 16/11, T-LINGUA). Il testo si salva in italiano, perche' un avviso e' una riga
 * fissata nel tempo e puo' uscire anche fuori dall'interfaccia. Ma chi guarda in inglese vedeva una frase
 * italiana. L'inbox ora restituisce accanto al testo `message: { code, params }`, ricavato IN LETTURA da tipo,
 * oggetto e testo gia' salvati: nessuna riscrittura dei dati esistenti, e il web compone la frase con i18n.
 *
 * Una sola fonte: le funzioni `testo*` scrivono, `messaggioDellAvviso` riconosce, e il test le prova insieme.
 * Un testo che non e' quello atteso (scritto a mano, di un'altra versione) non si interpreta: resta com'e'.
 */

export interface MessaggioAvviso {
  code: "APPROVAL_REMINDER" | "APPROVAL_OVERDUE" | "GAP_CLOSURE_DUE";
  params: Record<string, string | number>;
}

const PREFISSO_PROMEMORIA = "Approvazione in attesa: ";
const PREFISSO_SCADENZA = "Approvazione scaduta: ";
const CORPO_PROMEMORIA =
  "Una richiesta di approvazione assegnata a te ha superato la scadenza. Aprila per decidere.";
export const OGGETTO_GAP = "Gap di competenze da colmare";

/** Il segmento del gap in parole, per il testo italiano salvato. */
const GAP_IN_PAROLE: Record<string, string> = {
  MAJOR_GAP: "gap rilevante",
  MODERATE_GAP: "gap moderato",
  MINOR_GAP: "gap lieve",
  ALIGNED: "allineato",
};
const GAP_DA_VALUTARE = "gap da valutare";

export function testoPromemoriaApprovazione(titolo: string): { subject: string; body: string } {
  return { subject: `${PREFISSO_PROMEMORIA}${titolo}`, body: CORPO_PROMEMORIA };
}

export function testoScadenzaApprovazione(titolo: string, cicli: number): { subject: string; body: string } {
  return {
    subject: `${PREFISSO_SCADENZA}${titolo}`,
    body: `Una richiesta che hai aperto è ferma da ${cicli} cicli senza decisione dell'approvatore.`,
  };
}

export function testoGapCompetenze(segmento: string): { subject: string; body: string } {
  return {
    subject: OGGETTO_GAP,
    body: `È stato rilevato un gap di competenze per la tua posizione (${GAP_IN_PAROLE[segmento] ?? GAP_DA_VALUTARE}).`,
  };
}

/** Il significato strutturato di un avviso salvato, o null se non e' uno di quelli che l'API scrive da se'. */
export function messaggioDellAvviso(type: string, subject: string, body: string | null): MessaggioAvviso | null {
  if (type === "APPROVAL_REMINDER" && subject.startsWith(PREFISSO_PROMEMORIA) && body === CORPO_PROMEMORIA) {
    return { code: "APPROVAL_REMINDER", params: { title: subject.slice(PREFISSO_PROMEMORIA.length) } };
  }
  if (type === "APPROVAL_OVERDUE" && subject.startsWith(PREFISSO_SCADENZA) && body !== null) {
    const m = /^Una richiesta che hai aperto è ferma da (\d+) cicli senza decisione dell'approvatore\.$/.exec(body);
    if (m) {
      return {
        code: "APPROVAL_OVERDUE",
        params: { title: subject.slice(PREFISSO_SCADENZA.length), cycles: Number(m[1]) },
      };
    }
    return null;
  }
  if (type === "GAP_CLOSURE_DUE" && subject === OGGETTO_GAP && body !== null) {
    // Il formato scritto prima di C1 portava il codice del segmento nella frase: «(priorità MODERATE_GAP)».
    const vecchio = /^È stato rilevato un gap di competenze per la tua posizione \(priorità ([A-Z_]+)\)\.$/.exec(body);
    if (vecchio && vecchio[1] && vecchio[1] in GAP_IN_PAROLE) {
      return { code: "GAP_CLOSURE_DUE", params: { segment: vecchio[1] } };
    }
    for (const segmento of [...Object.keys(GAP_IN_PAROLE), "UNKNOWN"]) {
      if (body === testoGapCompetenze(segmento).body) {
        return { code: "GAP_CLOSURE_DUE", params: { segment: segmento } };
      }
    }
  }
  return null;
}
