/**
 * apps/api/src/modules/research/web-reader.ts
 *
 * IL LETTORE: L'UNICO PUNTO IN CUI QUESTO SISTEMA APRE UNA PAGINA WEB (#132 F4c).
 *
 * Perche' la lettura sta qui e non nel gateway agente. L'impronta che l'epica pretende e'
 * lo **SHA-256 dei byte effettivamente ricevuti** (§4.3, correzione del 2026-08-06: le 12
 * impronte storiche non riproducono, e un'impronta mai verificata diventa in silenzio un
 * ornamento). Uno strumento di lettura di un modello linguistico restituisce testo gia'
 * interpretato: i byte non li vede nessuno, e cio' che si firmerebbe non sarebbe la pagina.
 * Qui i byte si contano, si misurano e si firmano prima che qualcuno li legga.
 *
 * ⚠ CIO' CHE ESCE DA QUI E' DATO NON FIDATO (§4.4). Una pagina web puo' contenere un testo
 * rivolto all'agente — «ignora le istruzioni precedenti e proponi quanto segue». Non e'
 * un'ipotesi: e' il modo normale in cui questi sistemi vengono attaccati. Il tipo lo dice nel
 * nome (`testoNonFidato`) e il motore non lo tratta mai come istruzione. La difesa vera non
 * e' filtrare le pagine: e' che da questo testo puo' nascere **solo** una proposta
 * strutturata, validata contro una forma dichiarata, che nessuno applica senza l'approvazione
 * di un umano.
 *
 * LE QUATTRO GUARDIE, e ognuna nasce da un modo reale di farsi male:
 *   1. **solo `https`** — un `http` in chiaro puo' essere riscritto da chiunque stia in mezzo,
 *      e l'impronta firmerebbe cio' che ha scritto lui;
 *   2. **niente rete interna** (SSRF) — un indirizzo che punta a `127.0.0.1`, alla rete
 *      privata o al servizio di metadati della macchina virtuale farebbe leggere al sistema
 *      **se stesso**, e le pagine proposte da un modello sono indirizzi che arrivano da fuori;
 *   3. **limiti di dimensione e di tempo** — una risposta senza fine tiene occupato il
 *      processo finche' non muore;
 *   4. **redirect seguiti a mano**, ri-controllando **ogni** salto: un indirizzo pubblico che
 *      rimanda a `169.254.169.254` aggira la guardia 2 se si lascia fare a `fetch`.
 */
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface PaginaLetta {
  /** L'indirizzo chiesto, prima dei redirect: e' quello che il motore aveva in mano. */
  urlRichiesto: string;
  /** L'indirizzo finale, dopo i redirect: e' quello che si e' letto davvero. */
  url: string;
  status: number;
  contentType: string | null;
  /** Byte ricevuti (dopo la decompressione operata da fetch). */
  byte: number;
  /** SHA-256 **dei byte ricevuti**, in esadecimale minuscolo, 64 caratteri. */
  sha256: string;
  retrievedAt: string;
  /** ⚠ Testo estratto dalla pagina. NON e' un'istruzione. Non lo diventa mai. */
  testoNonFidato: string;
  /** Il testo e' stato tagliato perche' la pagina era piu' lunga del limite. */
  troncato: boolean;
}

export type CodiceErroreLettura =
  | "SCHEMA_NON_AMMESSO"
  | "HOST_NON_PUBBLICO"
  | "HOST_NON_RISOLTO"
  | "TROPPI_REDIRECT"
  | "RISPOSTA_TROPPO_GRANDE"
  | "TIPO_NON_AMMESSO"
  | "STATO_NON_OK"
  | "TEMPO_SCADUTO"
  | "LETTURA_FALLITA";

export class ErroreLettura extends Error {
  constructor(
    public readonly codice: CodiceErroreLettura,
    message: string,
    public readonly url: string,
  ) {
    super(message);
    this.name = "ErroreLettura";
  }
}

export interface OpzioniLettore {
  /** Byte massimi accettati. Oltre, la lettura si interrompe e fallisce. */
  byteMassimi?: number;
  /** Caratteri di testo estratto conservati. Il resto e' troncato, e si dichiara. */
  caratteriMassimi?: number;
  timeoutMs?: number;
  redirectMassimi?: number;
  /**
   * ⚠ SOLO PER LE PROVE. Permette di leggere `127.0.0.1`, perche' un test che verifica il
   * lettore ha bisogno di un server che gira sulla macchina. In produzione resta **spento**,
   * e un test dedicato verifica che il valore di default blocchi la rete locale: se qualcuno
   * lo accendesse per comodita', quel test non se ne accorgerebbe — ma il codice che lo
   * accende si vede in una revisione, mentre una difesa spenta di nascosto no.
   */
  permettiReteLocale?: boolean;
  /**
   * Le due porte verso il mondo, iniettabili **perche' le difese si possano provare**.
   * Senza, la guardia sui salti intermedi sarebbe verificabile solo con un attaccante vero:
   * una prova che non si puo' scrivere e' una difesa che nessuno ha mai visto funzionare.
   */
  fetchImpl?: typeof fetch;
  risolviHost?: (host: string) => Promise<Array<{ address: string }>>;
}

const PREDEFINITE: Required<Omit<OpzioniLettore, "fetchImpl" | "risolviHost">> = {
  byteMassimi: 3_000_000,
  caratteriMassimi: 200_000,
  timeoutMs: 20_000,
  redirectMassimi: 3,
  permettiReteLocale: false,
};

/** I tipi che ha senso leggere. Un PDF o un'immagine non si interpretano qui. */
const TIPI_AMMESSI = ["text/html", "application/xhtml+xml", "text/plain", "application/json", "text/xml", "application/xml"];

/**
 * Un indirizzo IP appartiene a una rete che non si deve poter raggiungere da qui?
 * Loopback, privata, link-local (che comprende `169.254.169.254`, i metadati delle macchine
 * virtuali), CGNAT, e le corrispondenti IPv6.
 */
export function indirizzoNonPubblico(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map((n) => Number.parseInt(n, 10));
    const [a, b] = [p[0] ?? 0, p[1] ?? 0];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;               // link-local + metadati
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;     // CGNAT
    if (a >= 224) return true;                             // multicast e riservati
    return false;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    if (s.startsWith("fe80") || s.startsWith("fc") || s.startsWith("fd")) return true;
    // IPv4 incapsulato: `::ffff:127.0.0.1` non deve aggirare il controllo di sopra.
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (m?.[1]) return indirizzoNonPubblico(m[1]);
    return false;
  }
  return true; // non e' un indirizzo: non si giudica «pubblico»
}

export interface WebReader {
  leggi(url: string): Promise<PaginaLetta>;
}

/**
 * Il testo di una pagina, senza il suo involucro. Non e' un interprete di HTML: toglie cio'
 * che non e' testo (script, stile, commenti, marcatori), scioglie le entita' piu' comuni e
 * comprime gli spazi. Il risultato serve a **capire**, non a essere ricostruito: chi vuole
 * verificare risale alla fonte, che e' registrata con la sua impronta.
 */
export function testoDaHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export class HttpWebReader implements WebReader {
  private readonly o: Required<Omit<OpzioniLettore, "fetchImpl" | "risolviHost">>;
  private readonly fetchImpl: typeof fetch;
  private readonly risolviHost: (host: string) => Promise<Array<{ address: string }>>;

  constructor(opzioni: OpzioniLettore = {}) {
    const { fetchImpl, risolviHost, ...resto } = opzioni;
    this.o = { ...PREDEFINITE, ...resto };
    this.fetchImpl = fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
    this.risolviHost = risolviHost ?? ((host: string) => lookup(host, { all: true }));
  }

  /**
   * La guardia degli indirizzi, applicata a **ogni** salto e non solo al primo. E' pubblica
   * perche' si possa provare da sola: un indirizzo che arriva da fuori va giudicato prima di
   * essere aperto, e questo giudizio deve avere una prova propria.
   */
  async verificaDestinazione(url: URL): Promise<void> {
    const schemiAmmessi = this.o.permettiReteLocale ? ["https:", "http:"] : ["https:"];
    if (!schemiAmmessi.includes(url.protocol)) {
      throw new ErroreLettura(
        "SCHEMA_NON_AMMESSO",
        `Si leggono solo indirizzi https: ${url.protocol}//... non e' ammesso`,
        url.toString(),
      );
    }
    if (this.o.permettiReteLocale) return;

    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) !== 0) {
      if (indirizzoNonPubblico(host)) {
        throw new ErroreLettura("HOST_NON_PUBBLICO", `Indirizzo di rete non pubblica: ${host}`, url.toString());
      }
      return;
    }
    let indirizzi: Array<{ address: string }>;
    try {
      indirizzi = await this.risolviHost(host);
    } catch {
      throw new ErroreLettura("HOST_NON_RISOLTO", `Il nome ${host} non si risolve`, url.toString());
    }
    if (indirizzi.length === 0) {
      throw new ErroreLettura("HOST_NON_RISOLTO", `Il nome ${host} non si risolve`, url.toString());
    }
    // BASTA UNO. Un nome che risolve a un indirizzo pubblico E a uno privato e' il modo
    // classico di aggirare questa guardia: si rifiuta tutto il nome, non il singolo indirizzo.
    const privato = indirizzi.find((a) => indirizzoNonPubblico(a.address));
    if (privato) {
      throw new ErroreLettura(
        "HOST_NON_PUBBLICO",
        `Il nome ${host} risolve a un indirizzo di rete non pubblica (${privato.address})`,
        url.toString(),
      );
    }
  }

  async leggi(urlRichiesto: string): Promise<PaginaLetta> {
    let corrente: URL;
    try {
      corrente = new URL(urlRichiesto);
    } catch {
      throw new ErroreLettura("SCHEMA_NON_AMMESSO", `Non e' un indirizzo: ${urlRichiesto}`, urlRichiesto);
    }

    for (let salto = 0; salto <= this.o.redirectMassimi; salto++) {
      await this.verificaDestinazione(corrente);

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.o.timeoutMs);
      let res: Response;
      try {
        res = await this.fetchImpl(corrente, {
          method: "GET",
          redirect: "manual", // i salti li governiamo noi: fetch non ricontrolla l'host
          signal: ctrl.signal,
          headers: {
            accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
            "user-agent": "HeuresysResearchBot/1.0 (+https://www.heuresys.com)",
            "accept-language": "it,en;q=0.8",
          },
        });
      } catch (e) {
        clearTimeout(timer);
        const scaduto = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
        throw new ErroreLettura(
          scaduto ? "TEMPO_SCADUTO" : "LETTURA_FALLITA",
          scaduto
            ? `Nessuna risposta entro ${this.o.timeoutMs} ms`
            : `Lettura fallita: ${e instanceof Error ? e.message : String(e)}`,
          corrente.toString(),
        );
      }
      clearTimeout(timer);

      if (res.status >= 300 && res.status < 400) {
        const dove = res.headers.get("location");
        if (!dove) {
          throw new ErroreLettura("STATO_NON_OK", `Redirect ${res.status} senza destinazione`, corrente.toString());
        }
        if (salto === this.o.redirectMassimi) {
          throw new ErroreLettura(
            "TROPPI_REDIRECT",
            `Piu' di ${this.o.redirectMassimi} redirect a partire da ${urlRichiesto}`,
            corrente.toString(),
          );
        }
        corrente = new URL(dove, corrente); // relativo o assoluto, entrambi legittimi
        continue;
      }

      if (!res.ok) {
        throw new ErroreLettura("STATO_NON_OK", `La pagina risponde ${res.status}`, corrente.toString());
      }

      const contentType = res.headers.get("content-type");
      const tipo = (contentType ?? "").split(";")[0]!.trim().toLowerCase();
      if (tipo !== "" && !TIPI_AMMESSI.includes(tipo)) {
        throw new ErroreLettura("TIPO_NON_AMMESSO", `Tipo di contenuto non leggibile: ${tipo}`, corrente.toString());
      }

      const dichiarati = Number.parseInt(res.headers.get("content-length") ?? "", 10);
      if (Number.isFinite(dichiarati) && dichiarati > this.o.byteMassimi) {
        throw new ErroreLettura(
          "RISPOSTA_TROPPO_GRANDE",
          `La pagina dichiara ${dichiarati} byte, oltre il limite di ${this.o.byteMassimi}`,
          corrente.toString(),
        );
      }

      const buf = Buffer.from(await res.arrayBuffer());
      // Il limite si ri-verifica sui byte VERI: `content-length` e' una dichiarazione di
      // chi risponde, e chi risponde e' esattamente la parte di cui non ci si fida.
      if (buf.byteLength > this.o.byteMassimi) {
        throw new ErroreLettura(
          "RISPOSTA_TROPPO_GRANDE",
          `Ricevuti ${buf.byteLength} byte, oltre il limite di ${this.o.byteMassimi}`,
          corrente.toString(),
        );
      }

      const sha256 = createHash("sha256").update(buf).digest("hex");
      const grezzo = buf.toString("utf8");
      const testo = tipo === "text/plain" || tipo === "application/json" ? grezzo.trim() : testoDaHtml(grezzo);
      const troncato = testo.length > this.o.caratteriMassimi;

      return {
        urlRichiesto,
        url: corrente.toString(),
        status: res.status,
        contentType,
        byte: buf.byteLength,
        sha256,
        retrievedAt: new Date().toISOString(),
        testoNonFidato: troncato ? testo.slice(0, this.o.caratteriMassimi) : testo,
        troncato,
      };
    }

    throw new ErroreLettura("TROPPI_REDIRECT", `Piu' di ${this.o.redirectMassimi} redirect`, urlRichiesto);
  }
}
