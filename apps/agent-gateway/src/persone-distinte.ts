/**
 * Il CONTATORE DI PERSONE DISTINTE per conversazione (#251, ADR-0040 R2).
 *
 * ⭐ IL FRENO VERO DELL'AGENTE, e perché è questo e non un tetto sulle righe. Misurato l'8
 * settembre 2026: fra «il reparto più grande» e «tutta l'azienda» ci sono ~4× righe — tarata
 * bassa una soglia sulle righe blocca il reparto, tarata alta lascia passare l'azienda intera.
 * Il numero di **persone distinte** invece separa bene (1 · 7 · 38 · 160 nelle quattro domande
 * tipo), è la grandezza su cui ragiona il diritto (la profilazione di massa si definisce sugli
 * interessati) e si legge senza essere tecnici.
 *
 * ⚠ IL BUCO CHE ESISTE GIÀ, e che questo modulo chiude: il tetto è **per chiamata**
 * (`packages/shared/src/schemas/_pagination.ts`, `limit` ≤ 200/500/1000) e **non esiste alcun
 * tetto sul totale letto in una conversazione**. Non dipende dalla dottrina nuova: la dottrina
 * lo rende visibile.
 *
 * DOVE PRENDE I DATI, senza toccare l'API (fattibilità misurata in S1101, ADR-0040 §4a): ogni
 * lettura dell'agente — generica (`hrx_entity_query`) o di dominio — passa da
 * `HeuresysClient.call`, e la risposta è JSON conforme agli schemi di `packages/shared`, dove
 * l'identificativo di persona sta sotto una famiglia chiusa di nomi che finiscono in `UserId`
 * (26 nomi distinti, misurati:
 *   grep -rhoE '\b[a-zA-Z]*[uU]ser_?[iI]d\b' packages/shared/src/schemas | sort | uniq -c
 * ). Non c'è da dichiarare un elenco di nomi da contare: si contano tutti, per FORMA del nome.
 *
 * ⚠ SI CONTA PER FORMA, NON PER ELENCO — e la direzione dell'errore è scelta. Un elenco di
 * nomi da contare invecchierebbe in silenzio: un campo nuovo `coacheeUserId` nascerebbe non
 * contato, e il freno si allenterebbe senza che nessuno decida niente. Contando per forma, un
 * campo nuovo è contato dal primo giorno; il costo è che qualche attore finisce fra i
 * soggetti, e quello fa scattare il freno **prima** — che è il verso sicuro.
 */
import { livelloDi, type LivelloPersone, type Soglie } from "./soglie-persone.js";

/**
 * GLI ATTORI DI AUDIT NON SONO SOGGETTI, e sono SEI (criterio di `#214` S1078, ripreso da
 * ADR-0040 §4a). Chi ha creato, rivisto, eseguito, annullato o pubblicato una riga non è la
 * persona di cui la riga parla: se contassero, **ogni** tabella della piattaforma sarebbe dati
 * di persona e il contatore misurerebbe il traffico, non l'esposizione.
 *
 * ⚠ L'ELENCO NON SI ALLARGA A MANO — decisione D3 di `#251`. `approverUserId`,
 * `approvatoreUserId`, `reviewerUserId`, `assessorUserId`, `interviewerUserId` sono anch'essi
 * attori, e **restano contati**: sovrastimare fa scattare il freno prima (verso sicuro),
 * sottostimarlo lo disattiva. Togliere un nome da qui è una decisione di prodotto, non una
 * pulizia di passaggio: passa da un aggiornamento dell'ADR.
 */
export const ATTORI_DI_AUDIT: ReadonlySet<string> = new Set([
  "createdByUserId",
  "reviewedByUserId",
  "performedByUserId",
  "cancelledByUserId",
  "publishedByUserId",
  "actorUserId",
]);

/**
 * La FORMA di un nome che porta un identificativo di persona: `userId`, `subjectUserId`,
 * `ownerUserId`, `user_id`… Niente underscore in mezzo al prefisso, perché le risposte di
 * `/v1` sono camelCase (schemi Zod): un ipotetico `created_by_user_id` non combacia, e non è
 * un problema — non esiste in queste risposte.
 */
const NOME_DI_PERSONA = /^[A-Za-z]*[Uu]ser_?[Ii]d$/;

/**
 * Solo UUID. Serve a non contare come persona un valore che sta sotto un nome giusto ma non è
 * un identificativo: `userId: "me"` è un segnaposto delle rotte self-scope, e contarlo
 * gonfierebbe l'insieme con una persona che non esiste.
 */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Gli identificativi di persona **soggetto** presenti in un JSON di risposta, in ordine di
 * incontro e con i duplicati (li deduplica il `Set` del contatore).
 *
 * `esclusi` è iniettabile per UNA sola ragione dichiarata: il test di sabotaggio (F4) deve
 * poter dimostrare che l'esclusione porta peso, contando gli attori e vedendo il conto salire.
 * Non è un interruttore di configurazione: in produzione nessuno lo passa.
 */
export function raccogliPersone(
  valore: unknown,
  esclusi: ReadonlySet<string> = ATTORI_DI_AUDIT,
): string[] {
  const trovati: string[] = [];
  const visita = (nodo: unknown, chiave?: string): void => {
    if (typeof nodo === "string") {
      if (chiave && NOME_DI_PERSONA.test(chiave) && !esclusi.has(chiave) && UUID.test(nodo)) {
        trovati.push(nodo.toLowerCase());
      }
      return;
    }
    if (Array.isArray(nodo)) {
      // Gli elementi di un array ereditano la chiave del padre: `subjectUserIds: [uuid, uuid]`
      // non esiste negli schemi di oggi, ma se nascesse va contato, non saltato in silenzio.
      for (const e of nodo) visita(e, chiave);
      return;
    }
    if (nodo && typeof nodo === "object") {
      for (const [k, v] of Object.entries(nodo as Record<string, unknown>)) visita(v, k);
    }
  };
  visita(valore);
  return trovati;
}

/** Ciò che il gate e il diario leggono dal contatore: il numero e il livello. Niente di più. */
export interface LettoreContatore {
  conta(): number;
  livello(): LivelloPersone;
}

/**
 * L'insieme delle persone toccate da UNA conversazione.
 *
 * DOVE VIVE LO STATO — nella richiesta, senza infrastruttura nuova (ADR-0040 §4b): una
 * conversazione è oggi **una** `POST /agent` = **una** `runHrAgent` = **una** `query()`
 * dell'SDK senza `resume`. Un insieme in chiusura, creato in `runHrAgent` e collegato al
 * client, copre esattamente ciò che esiste.
 *
 * ⚠ LIMITE DICHIARATO, non scoperto a metà: se il web un giorno **riprenderà** una
 * conversazione (`resume`), il contatore deve seguire quell'identificativo, altrimenti ogni
 * ripresa riparte da zero — e il freno si aggira riprendendo.
 */
export class ContatorePersone implements LettoreContatore {
  private readonly persone = new Set<string>();
  private guasto = false;
  private readonly soglie: Soglie | undefined;

  constructor(soglie?: Soglie) {
    this.soglie = soglie;
  }

  /**
   * Aggiunge le persone di una risposta. **Non alza mai**: contare non deve poter rompere una
   * lettura (D4). Ma un guasto non passa per un verde: il contatore si dichiara guasto e il
   * livello diventa `non-misurato`, che `#252` tratta come «oltre la soglia».
   */
  aggiungi(risposta: unknown): void {
    try {
      for (const id of raccogliPersone(risposta)) this.persone.add(id);
    } catch {
      this.guasto = true;
    }
  }

  conta(): number {
    return this.persone.size;
  }

  /** `true` se la raccolta è fallita almeno una volta: il conto è un minimo, non il totale. */
  eGuasto(): boolean {
    return this.guasto;
  }

  livello(): LivelloPersone {
    if (this.guasto) return "non-misurato";
    return livelloDi(this.persone.size, this.soglie);
  }
}
