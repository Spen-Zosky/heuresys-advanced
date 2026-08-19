/**
 * apps/api/src/modules/research/domain.ts
 *
 * UN DOMINIO RICERCABILE SI DICHIARA, NON SI SCRIVE (#132 F4b — epica P2a §4.1, E10).
 *
 * La capacita' di ricerca e' della **piattaforma**, non di un cliente: percio' un dominio
 * vive **in codice**, tipizzato e versionato con l'applicazione, e non in una tabella. Nel
 * database ci vanno i fascicoli e le corse; qui ci va cosa si sa cercare.
 *
 * Un dominio ha quattro parti, ed e' un contratto perche' il motore non ne conosca nessuna
 * per nome:
 *   1. **le domande**, parametrizzate su cio' che il fascicolo sa gia';
 *   2. **la forma** di una proposta valida — uno schema che il contenuto deve rispettare;
 *   3. **la chiave naturale** — cosa rende due proposte la stessa proposta, cosi' che una
 *      seconda corsa non duplichi cio' che c'e';
 *   4. **i controlli** — cosa deve essere vero perche' una proposta arrivi al consulente.
 *
 * ⚠ LE DOMANDE NON VEDONO IL CLIENTE (§4.5, E15). `domande()` riceve un `ContestoRicerca`,
 * che porta **solo informazioni di categoria** — settore, fascia, addetti, paese, vigilanza,
 * modello operativo. Non riceve il fascicolo, non riceve il tenant, non riceve un nome di
 * azienda. Non e' una raccomandazione: e' la **firma del tipo**, cosi' che interpolare il
 * nome di un cliente in una domanda diretta al web non sia una svista possibile. Una
 * richiesta inviata a terzi resta nei loro registri, e non la si richiama indietro.
 */
import type { z } from "zod";

/**
 * Cio' che una ricerca puo' sapere del cliente: **la sua categoria, mai la sua identita'**.
 * I sei parametri di `PARAMETRI_RICERCA` (mig. `000323`, #132 F0) risolti in valori
 * leggibili — il motore traduce gli identificativi in codici prima di arrivare qui, perche'
 * `industryClassId` e' un uuid e una domanda non si fa con un uuid.
 */
export interface ContestoRicerca {
  /** Classificazione di attivita' (ATECO), es. `64.19`. */
  atecoCode: string;
  atecoLabel: string;
  /** `XS | S | M | L | XL` — canalizza la ricerca. */
  sizeBandCode: string;
  /** Il numero vero di addetti: descrive l'azienda, non la corsia. */
  employeeCount: number;
  /** ISO 3166-1 alpha-2, es. `IT`: cambia organi di controllo, contratto, obblighi. */
  countryCode: string;
  /** `LOW | MEDIUM | HIGH | EXTREME`: decide se esiste una direzione Risk & Compliance. */
  regulatoryIntensity: string;
  /** `RETAIL | WHOLESALE | MIXED | B2B_SERVICES | MANUFACTURING | PUBLIC_SECTOR`. */
  operatingModelCode: string;
}

/** L'esito di un controllo, nel vocabolario di `sys_seed_validation_results`. */
export type EsitoControllo = "PASSED" | "FAILED" | "WARNING" | "SKIPPED";

export interface RisultatoControllo {
  /** Codice della regola, che finisce in `seed_validation_result_rule_code`. */
  regola: string;
  esito: EsitoControllo;
  messaggio?: string;
}

/**
 * Un controllo del dominio: funzione **pura** sulla proposta gia' validata nella forma.
 * I controlli trasversali — forma valida, fonti conformi, doppione — li applica il motore
 * a tutti i domini: qui ci va solo cio' che e' specifico.
 */
export type ControlloProposta<T> = (
  proposta: T,
  contesto: ContestoRicerca,
  /** Gli indirizzi da cui la proposta dice di venire: alcuni controlli guardano quelli. */
  evidenze: readonly string[],
) => RisultatoControllo;

export interface DominioRicercabile<T = unknown> {
  /** La chiave che finisce in `seed_candidate_record_domain`. */
  chiave: string;
  etichetta: string;
  /**
   * Le domande da porre, costruite **solo** dal contesto di categoria. Sono anche cio' che
   * si scrive in `seed_acquisition_run_prompt_template`: le domande **effettivamente**
   * poste, non una descrizione di cosa si e' cercato.
   */
  domande(contesto: ContestoRicerca): string[];
  /** La forma di una proposta valida. Una proposta malformata e' respinta, non corretta. */
  forma: z.ZodType<T>;
  /** Cosa rende due proposte la stessa proposta. */
  chiaveNaturale(proposta: T): string;
  controlli: ControlloProposta<T>[];
  /** Quante fonti servono al minimo. Zero non e' ammesso da nessun dominio (§4.3). */
  minimoFonti: number;
  /**
   * Le fonti di questo dominio si confrontano col registro?
   *
   * ⚠ **`false` E' UN'ECCEZIONE DICHIARATA, E VALE PER UN DOMINIO SOLO.** Il registro delle
   * fonti nasce vuoto: la prima ricerca non puo' passare da un controllo che non ha ancora
   * niente contro cui confrontare. Il filtro della prima ondata **e' un umano**, che approva
   * una fonte per volta; da li' in poi il filtro e' il registro che ha approvato. E' scritto
   * come proprieta' del dominio, e non come interruttore globale, proprio perche' nessuno
   * possa spegnerlo per tutti «solo per questa volta».
   */
  fontiConfrontateColRegistro: boolean;
}

/** Il registro dei domini dichiarati. Si popola in `domains/index.ts`. */
export type RegistroDomini = ReadonlyMap<string, DominioRicercabile<unknown>>;

export class DominioSconosciutoError extends Error {
  constructor(public readonly chiave: string, disponibili: readonly string[]) {
    super(
      `Dominio di ricerca sconosciuto: "${chiave}". Dichiarati: ${disponibili.join(", ") || "nessuno"}.`,
    );
    this.name = "DominioSconosciutoError";
  }
}
