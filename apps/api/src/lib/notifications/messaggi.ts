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
  code:
    | "APPROVAL_REMINDER"
    | "APPROVAL_OVERDUE"
    | "GAP_CLOSURE_DUE"
    | "AGENT_WEEKLY_SUMMARY"
    | "AGENT_SIGNAL_POSIZIONE_CRITICA_SENZA_SUCCESSORE"
    | "AGENT_SIGNAL_AMPIEZZA_DI_CONTROLLO"
    | "AGENT_SIGNAL_POSIZIONE_SCOPERTA";
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

const PREFISSO_RIEPILOGO = "Riepilogo settimanale dell'assistente: ";
const RIEPILOGO_CORPO = /^Dal (\d{4}-\d{2}-\d{2}) al (\d{4}-\d{2}-\d{2}): (\d+) scritture confermate, (\d+) negate, (\d+) eseguite senza conferma\.$/;

/** ADR-0063 D3 (E5): il riepilogo settimanale delle scritture fatte con l'assistente, per la piattaforma. */
export function testoRiepilogoAgente(
  dal: string, al: string, confermate: number, negate: number, autonome: number,
): { subject: string; body: string } {
  return {
    subject: `${PREFISSO_RIEPILOGO}${dal}`,
    body: `Dal ${dal} al ${al}: ${confermate} scritture confermate, ${negate} negate, ${autonome} eseguite senza conferma.`,
  };
}

// ── I segnalatori (ADR-0063 E6, voce F4a): un oggetto fisso per segnalatore, il corpo con i numeri.
const OGGETTO_SUCCESSIONE = "Segnalazione: posizione critica senza successore pronto";
const OGGETTO_AMPIEZZA = "Segnalazione: ampiezza di controllo oltre la soglia";
const OGGETTO_SCOPERTA = "Segnalazione: posizione senza titolare";
const CORPO_SUCCESSIONE = /^La posizione critica «(.+)» dell'unità «(.+)» non ha un successore pronto ora: (\d+) candidati nel bacino, (\d+) pronti entro sei mesi\.$/;
const CORPO_AMPIEZZA = /^La posizione «(.+)» dell'unità «(.+)» ha (\d+) riporti diretti, oltre la soglia di (\d+)\.$/;
const CORPO_SCOPERTA = /^La posizione «(.+)» dell'unità «(.+)» è senza titolare da (\d+) giorni\.$/;

export function testoSegnalazioneSuccessione(
  posizione: string, unita: string, candidati: number, entroSeiMesi: number,
): { subject: string; body: string } {
  return {
    subject: OGGETTO_SUCCESSIONE,
    body: `La posizione critica «${posizione}» dell'unità «${unita}» non ha un successore pronto ora: ${candidati} candidati nel bacino, ${entroSeiMesi} pronti entro sei mesi.`,
  };
}

export function testoSegnalazioneAmpiezza(
  posizione: string, unita: string, riporti: number, soglia: number,
): { subject: string; body: string } {
  return {
    subject: OGGETTO_AMPIEZZA,
    body: `La posizione «${posizione}» dell'unità «${unita}» ha ${riporti} riporti diretti, oltre la soglia di ${soglia}.`,
  };
}

export function testoSegnalazioneScoperta(posizione: string, unita: string, giorni: number): { subject: string; body: string } {
  return {
    subject: OGGETTO_SCOPERTA,
    body: `La posizione «${posizione}» dell'unità «${unita}» è senza titolare da ${giorni} giorni.`,
  };
}

function messaggioSegnalazione(subject: string, body: string): MessaggioAvviso | null {
  if (subject === OGGETTO_SUCCESSIONE) {
    const m = CORPO_SUCCESSIONE.exec(body);
    return m
      ? { code: "AGENT_SIGNAL_POSIZIONE_CRITICA_SENZA_SUCCESSORE",
          params: { position: m[1]!, unit: m[2]!, candidates: Number(m[3]), ready6Months: Number(m[4]) } }
      : null;
  }
  if (subject === OGGETTO_AMPIEZZA) {
    const m = CORPO_AMPIEZZA.exec(body);
    return m
      ? { code: "AGENT_SIGNAL_AMPIEZZA_DI_CONTROLLO",
          params: { position: m[1]!, unit: m[2]!, reports: Number(m[3]), threshold: Number(m[4]) } }
      : null;
  }
  if (subject === OGGETTO_SCOPERTA) {
    const m = CORPO_SCOPERTA.exec(body);
    return m
      ? { code: "AGENT_SIGNAL_POSIZIONE_SCOPERTA", params: { position: m[1]!, unit: m[2]!, count: Number(m[3]) } }
      : null;
  }
  return null;
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
  if (type === "SYSTEM" && subject.startsWith("Segnalazione: ") && body !== null) {
    return messaggioSegnalazione(subject, body);
  }
  if (type === "SYSTEM" && subject.startsWith(PREFISSO_RIEPILOGO) && body !== null) {
    const m = RIEPILOGO_CORPO.exec(body);
    if (m) {
      return {
        code: "AGENT_WEEKLY_SUMMARY",
        params: { from: m[1]!, to: m[2]!, confirmed: Number(m[3]), denied: Number(m[4]), autonomous: Number(m[5]) },
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
