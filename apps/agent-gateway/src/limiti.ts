/**
 * apps/agent-gateway/src/limiti.ts — ADR-0056 (cancello), piano dei principi agentici voce T3.
 *
 * I LIMITI DI UNA CONVERSAZIONE DELL'ASSISTENTE, e il modello con cui pensa:
 *
 *   · il modello è fissato per NOME (principio P24, ADR-0056 D3): non un alias come «sonnet» o
 *     «default», che cambia sotto i piedi quando cambia la versione di Claude Code sulla VM, ma un
 *     identificativo completo. Lo stesso nome vale per l'assistente e per i due agenti senza
 *     strumenti (il giudice del consolidamento e la proposta di ricerca);
 *   · quante conversazioni possono girare insieme, per persona e in tutto il servizio: l'abbonamento
 *     è uno solo (ADR-0056 D3), e una persona che apre dieci schede non deve fermare le altre;
 *   · quanti giri può fare una conversazione (`maxTurns` dell'SDK);
 *   · quanto può durare, dopo di che si interrompe.
 *
 * Ogni limite si legge dall'ambiente, con un default dichiarato qui. Un valore illeggibile non
 * diventa «senza limite»: si torna al default, e il modello illeggibile ferma l'avvio.
 */

/** Il modello di default: identificativo completo, mai un alias. */
export const MODELLO_DEFAULT = "claude-sonnet-5-5";

/** Un nome di modello completo: `claude-<famiglia>-<versione>`, niente alias né spazi. */
// Un solo modo di leggere ogni nome: ogni gruppo comincia con un trattino e ha solo cifre, quindi
// non ci sono due modi di dividere la stessa stringa (niente ritorni a ritroso esponenziali).
const NOME_MODELLO = /^claude-[a-z]+(?:-[0-9]+)+$/;

export class ModelloNonValido extends Error {}

/**
 * Il modello con cui pensano gli agenti del gateway. Se l'ambiente ne nomina uno che non è un
 * identificativo completo, si alza: un gateway che parte con un modello che non sa nominare è il
 * difetto che questa funzione esiste per impedire.
 */
export function modelloAgenti(env: Record<string, string | undefined> = process.env): string {
  const scelto = env.AGENT_GATEWAY_MODEL?.trim();
  if (!scelto) return MODELLO_DEFAULT;
  if (!NOME_MODELLO.test(scelto)) {
    throw new ModelloNonValido(
      `AGENT_GATEWAY_MODEL deve essere un identificativo completo (es. ${MODELLO_DEFAULT}), non «${scelto}»`,
    );
  }
  return scelto;
}

/**
 * Le persone ammesse all'assistente (decisione di Enzo, ADR-0056 D3: prima solo lui). Un elenco di
 * identificativi utente in `AGENT_GATEWAY_ALLOWED_USER_IDS`, separati da virgola. Vuoto o assente
 * = nessuno: chi non è nominato non parla con l'assistente, e aprirlo ad altri è un cambio di
 * questa riga di configurazione, non del codice.
 */
export function personeAmmesse(env: Record<string, string | undefined> = process.env): ReadonlySet<string> {
  return new Set(
    (env.AGENT_GATEWAY_ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0),
  );
}

/**
 * I tenant le cui persone sono ammesse all'assistente, in `AGENT_GATEWAY_ALLOWED_TENANT_IDS`
 * (identificativi separati da virgola; vuoto o assente = nessuno). Serve al caso che D3 nomina:
 * Enzo che entra con l'utenza di una persona del tenant per una dimostrazione. Ammettere un tenant
 * non allarga niente oltre la persona: il gettone dell'agente porta solo i suoi permessi, senza
 * mandati (ADR-0050 D6), e l'API filtra per tenant (I5).
 */
export function tenantAmmessi(env: Record<string, string | undefined> = process.env): ReadonlySet<string> {
  return new Set(
    (env.AGENT_GATEWAY_ALLOWED_TENANT_IDS ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0),
  );
}

/** Ammesso chi è nominato per persona, oppure chi appartiene a un tenant ammesso. Fail-closed. */
export function ammessoAllAssistente(
  chi: { userId: string; tenantId: string | null },
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (personeAmmesse(env).has(chi.userId)) return true;
  return chi.tenantId !== null && tenantAmmessi(env).has(chi.tenantId);
}

export interface Limiti {
  /** Conversazioni contemporanee della stessa persona. */
  perPersona: number;
  /** Conversazioni contemporanee in tutto il servizio. */
  totali: number;
  /** Giri massimi di una conversazione (`maxTurns`). */
  giri: number;
  /** Durata massima di una conversazione, in millisecondi. */
  durataMs: number;
}

export const LIMITI_DEFAULT: Readonly<Limiti> = Object.freeze({
  perPersona: 2,
  totali: 4,
  giri: 30,
  durataMs: 15 * 60_000,
});

function intero(valore: string | undefined, predefinito: number): number {
  if (valore === undefined || valore.trim() === "") return predefinito;
  const n = Number(valore);
  return Number.isInteger(n) && n > 0 ? n : predefinito;
}

export function leggiLimiti(env: Record<string, string | undefined> = process.env): Limiti {
  return {
    perPersona: intero(env.AGENT_GATEWAY_MAX_CONVERSAZIONI_PERSONA, LIMITI_DEFAULT.perPersona),
    totali: intero(env.AGENT_GATEWAY_MAX_CONVERSAZIONI, LIMITI_DEFAULT.totali),
    giri: intero(env.AGENT_GATEWAY_MAX_GIRI, LIMITI_DEFAULT.giri),
    durataMs: intero(env.AGENT_GATEWAY_MAX_DURATA_MS, LIMITI_DEFAULT.durataMs),
  };
}

export type Ingresso =
  | {
      ok: true;
      esci: () => void;
      /**
       * Prova dal vivo del 2026-11-20: due conversazioni ferme ad aspettare la conferma della
       * persona le impedivano di aprirne una terza (TOO_MANY_CONVERSATIONS_PERSON). Mentre il giro
       * aspetta la persona non lavora: il suo posto personale si sospende e si riprende alla decisione.
       */
      sospendi: () => void;
      riprendi: () => void;
    }
  | { ok: false; motivo: "PERSONA" | "SERVIZIO" };

/**
 * Il registro delle conversazioni aperte. Uno per processo, come il registro delle approvazioni.
 * `entra` occupa un posto, e il posto si libera chiamando `esci` (una volta sola: le chiamate in
 * più non liberano il posto di un'altra conversazione).
 */
export class ConversazioniAperte {
  private readonly perPersona = new Map<string, number>();
  /** Conversazioni sospese per persona: anche loro hanno un tetto, pari a `perPersona`, così una
   * persona non riempie il servizio di giri in attesa (revisione di sicurezza del 2026-11-20). */
  private readonly sospese = new Map<string, number>();
  private totale = 0;

  constructor(private readonly limiti: Pick<Limiti, "perPersona" | "totali">) {}

  get aperte(): number {
    return this.totale;
  }

  entra(persona: string): Ingresso {
    const sue = this.perPersona.get(persona) ?? 0;
    if (sue >= this.limiti.perPersona) return { ok: false, motivo: "PERSONA" };
    if (this.totale >= this.limiti.totali) return { ok: false, motivo: "SERVIZIO" };
    this.perPersona.set(persona, sue + 1);
    this.totale += 1;
    let uscito = false;
    let sospeso = false;
    const sposta = (mappa: Map<string, number>, delta: number) => {
      const ora = (mappa.get(persona) ?? 0) + delta;
      if (ora > 0) mappa.set(persona, ora);
      else mappa.delete(persona);
    };
    return {
      ok: true,
      esci: () => {
        if (uscito) return;
        uscito = true;
        sposta(sospeso ? this.sospese : this.perPersona, -1);
        this.totale -= 1;
      },
      sospendi: () => {
        if (uscito || sospeso) return;
        // Oltre il tetto delle sospese il posto resta occupato: la persona aspetta, come prima.
        if ((this.sospese.get(persona) ?? 0) >= this.limiti.perPersona) return;
        sospeso = true;
        sposta(this.perPersona, -1);
        sposta(this.sospese, 1);
      },
      riprendi: () => {
        if (uscito || !sospeso) return;
        sospeso = false;
        // Il giro era già ammesso: riprende anche se nel frattempo la persona ne ha aperti altri
        // (al massimo 2 × perPersona in tutto, per il tetto delle sospese).
        sposta(this.sospese, -1);
        sposta(this.perPersona, 1);
      },
    };
  }
}
