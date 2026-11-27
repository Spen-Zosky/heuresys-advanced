/**
 * heuresys /v1 client for the Agent SDK backend (#9 WI-B).
 *
 * Hybrid auth (the only identity channel is a user JWT cookie, PLATFORM_MAP §1):
 *  - user-scoped ops  → the webapp forwards the logged-in user's cookies;
 *  - catalogue authoring → la persona con PLATFORM_ADMIN, come ogni altra scrittura
 *    (ADR-0050 D6: niente utenza di servizio con mandato).
 * Writes carry the CSRF double-submit (`hrx_csrf` cookie + `x-csrf-token` header).
 * Tenant is implicit in the JWT — never sent as a header (I5).
 *
 * Refresh is single-flight (M-5): a 401 triggers at most ONE concurrent
 * /v1/auth/refresh; concurrent calls await the same rotation (no replay storm).
 * fetchImpl is injectable so the client is unit-testable without live heuresys.
 */

import { conOmissis, letturaDaConfermare, letturaNegata, type EsitiLetture } from "./omissis.js";

/** ADR-0050 D5: lo stesso codice di `packages/shared/src/schemas/mfa.ts` (il gateway non dipende da shared). */
const STEP_UP_REQUIRED_CODE = "STEP_UP_REQUIRED";

export interface Session {
  cookieAccess: string;
  cookieCsrf: string;
  csrf: string;
  cookieRefresh?: string;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  /** Le intestazioni della risposta (A-14: l'origine del dato); facoltative per i doppi delle prove. */
  headers?: { get(name: string): string | null };
}>;

/** Ciò che il gateway legge della specifica OpenAPI dell'API: i filtri delle letture e i corpi delle scritture. */
interface OperazioneSpecifica {
  parameters?: Array<{ in?: string; name?: string; schema?: { type?: string; format?: string } }>;
  requestBody?: { content?: Record<string, { schema?: unknown }> };
}
type SpecificaApi = {
  paths?: Record<string, Partial<Record<"get" | "post" | "put" | "patch" | "delete", OperazioneSpecifica>>>;
};

/** A-14: l'intestazione con cui l'API dichiara l'origine del dato (`DATA_ORIGIN_HEADER` in @heuresys/shared). */
export const INTESTAZIONE_ORIGINE = "x-heuresys-data-origin";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface HeuresysClientOptions {
  baseUrl: string; // e.g. http://localhost:3001
  session: Session;
  fetchImpl?: FetchLike;
  /**
   * F0-3, il test del valore: il codice dell'agente che chiama, dichiarato all'API in
   * `x-heuresys-superficie: agente:<codice>`. Così una decisione presa dall'agente per
   * conto della persona si conta come decisione dell'agente, non come dato di uno script.
   * È contesto, non identità: chi agisce resta la persona del cookie.
   */
  agente?: string;
  /**
   * La lingua della pagina da cui arriva la domanda, dichiarata all'API in `x-locale`: i testi dei
   * campi registrati tornano nella stessa lingua della pagina (ADR-0062), e l'assistente non
   * mostra in italiano un nome che la persona vede in inglese.
   */
  lingua?: "it" | "en";
}

/**
 * Chi osserva le risposte per contare le persone distinte (#251). È un'interfaccia e non la
 * classe concreta perché il client non deve dipendere dal contatore: qui passa solo ciò che
 * serve, cioè «prendi questa risposta e fanne quello che devi».
 */
export interface OsservatoreRisposte {
  aggiungi(risposta: unknown): void;
}

export class HeuresysClient {
  private readonly baseUrl: string;
  private session: Session;
  private readonly fetchImpl: FetchLike;
  private readonly superficie: string;
  private readonly lingua: "it" | "en" | undefined;
  private refreshing: Promise<boolean> | null = null;
  private contatore: OsservatoreRisposte | undefined;

  constructor(opts: HeuresysClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.session = opts.session;
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.superficie = `agente:${opts.agente ?? "assistente-hr"}`;
    this.lingua = opts.lingua;
  }

  private headers(method: string): Record<string, string> {
    const h: Record<string, string> = {
      "content-type": "application/json",
      cookie: `hrx_access=${this.session.cookieAccess}; hrx_csrf=${this.session.cookieCsrf}`,
      "x-heuresys-superficie": this.superficie,
    };
    if (this.lingua) h["x-locale"] = this.lingua;
    if (!SAFE_METHODS.has(method)) h["x-csrf-token"] = this.session.csrf; // CSRF on writes only
    return h;
  }

  /**
   * Collega il contatore di persone distinte della conversazione in corso (#251, ADR-0040 R2).
   *
   * PERCHÉ QUI E NON NEL COSTRUTTORE: il client nasce in `server.ts`, una volta per richiesta,
   * mentre l'insieme delle persone è di una CONVERSAZIONE e lo crea `runHrAgent` (ADR-0040
   * §4b). Se il client lo creasse da sé, il gate riceverebbe un contatore e il client ne
   * alimenterebbe un altro — il difetto che `sdk-agent.ts` evita già per il resolver dei
   * perimetri: una fonte sola, letta una volta.
   *
   * È l'UNICO punto di raccolta e basta uno: ogni lettura dell'agente, generica o di dominio,
   * passa da `call` (misurato: sette chiamate in `mcp-tools.ts`, tutte `client.call`).
   */
  collegaContatore(contatore: OsservatoreRisposte): void {
    this.contatore = contatore;
  }

  /** Le letture del giro in corso, riuscite e negate (omissis.ts): servono al rifiuto deterministico. */
  private esiti: EsitiLetture | undefined;

  collegaEsiti(esiti: EsitiLetture): void {
    this.esiti = esiti;
  }

  /** Una lettura negata che non passa dall'API: un concetto vietato chiesto al catalogo. */
  segnaLetturaNegata(): void {
    this.esiti?.negata();
  }

  /** Single-flight refresh: concurrent 401s await one rotation. Returns success. */
  private async refreshOnce(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        if (!this.session.cookieRefresh) return false;
        const res = await this.fetchImpl(`${this.baseUrl}/v1/auth/refresh`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `hrx_refresh=${this.session.cookieRefresh}; hrx_csrf=${this.session.cookieCsrf}`,
            "x-csrf-token": this.session.csrf,
          },
        });
        return res.ok;
      })().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  /** A-14: per ogni risposta (oggetto), l'origine del dato che l'API ha dichiarato. */
  private readonly origini = new WeakMap<object, string>();

  /** L'origine del dato di una risposta di `call`, se l'API l'ha dichiarata (A-14). */
  origineDi(dati: unknown): string | undefined {
    return typeof dati === "object" && dati !== null ? this.origini.get(dati) : undefined;
  }

  private specificaCache: Promise<SpecificaApi | null> | undefined;

  /** La specifica OpenAPI dell'API (generata dai contratti Zod), letta una volta sola. Non lancia. */
  private specifica(): Promise<SpecificaApi | null> {
    this.specificaCache ??= (async () => {
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/openapi.json`, { method: "GET", headers: this.headers("GET") });
        if (!res.ok) return null;
        return (await res.json()) as SpecificaApi;
      } catch {
        return null;
      }
    })();
    return this.specificaCache;
  }

  /**
   * I filtri di query di ogni lettura, ricavati dalla specifica OpenAPI dell'API (generata dai
   * contratti Zod): `"/v1/time-off/requests" -> { userId: "uuid", status: "string", … }`.
   * Il modello non può indovinare i nomi dei filtri: li legge da qui (hrx_concept_describe).
   * Non lancia: senza specifica la descrizione resta senza filtri, come prima.
   */
  async filtriDelleLetture(): Promise<Map<string, Record<string, string>>> {
    const mappa = new Map<string, Record<string, string>>();
    const spec = await this.specifica();
    for (const [percorso, voce] of Object.entries(spec?.paths ?? {})) {
      const filtri: Record<string, string> = {};
      for (const prm of voce.get?.parameters ?? []) {
        if (prm.in === "query" && prm.name) filtri[prm.name] = prm.schema?.format ?? prm.schema?.type ?? "string";
      }
      if (Object.keys(filtri).length > 0) mappa.set(percorso, filtri);
    }
    return mappa;
  }

  /**
   * ADR-0061 passo 10, difetto del 2026-11-22: il corpo di ogni scrittura, dal contratto dell'API.
   * Chiave `"PUT /v1/tenant-processes/{id}/faccette/{facet}"`, valore lo schema JSON del corpo.
   * Senza, il modello indovina la forma (`code` invece di `codes` + `criterion`) e la scrittura
   * approvata dalla persona torna 400. Non lancia: senza specifica non c'è nessun corpo dichiarato.
   */
  async corpiDelleScritture(): Promise<Map<string, unknown>> {
    const mappa = new Map<string, unknown>();
    const spec = await this.specifica();
    for (const [percorso, voce] of Object.entries(spec?.paths ?? {})) {
      for (const metodo of ["post", "put", "patch"] as const) {
        const schema = voce[metodo]?.requestBody?.content?.["application/json"]?.schema;
        if (schema !== undefined) mappa.set(`${metodo.toUpperCase()} ${percorso}`, schema);
      }
    }
    return mappa;
  }

  private readonly scrittureFallite: string[] = [];

  /** Gli esiti delle scritture non salvate dall'ultima consultazione, già in parole per la persona. */
  consumaScrittureFallite(): string[] {
    return this.scrittureFallite.splice(0);
  }

  async call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/v1${path}`;
    const doFetch = () =>
      this.fetchImpl(url, {
        method,
        headers: this.headers(method),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

    let res = await doFetch();
    if (res.status === 401) {
      const refreshed = await this.refreshOnce();
      if (refreshed) res = await doFetch();
    }
    const lettura = SAFE_METHODS.has(method);
    // Richiesta di Enzo del 2026-11-18: una lettura che l'API nega alla persona non è un guasto,
    // è un'informazione per la risposta. Torna al modello come esito NON_AUTORIZZATO e si conta.
    if (lettura && res.status === 403) {
      // ADR-0050 D5: «serve la conferma del secondo fattore» non è «non autorizzato».
      let codice: string | undefined;
      try {
        codice = codiceErrore(await res.text());
      } catch {
        /* nessun corpo leggibile: resta il diniego */
      }
      if (codice === STEP_UP_REQUIRED_CODE) {
        this.esiti?.daConfermareSecondoFattore();
        return letturaDaConfermare() as T;
      }
      this.esiti?.negata();
      return letturaNegata() as T;
    }
    if (!res.ok) {
      // Il motivo dell'API (per esempio il campo del corpo che non va) torna al modello: senza,
      // vede solo «400» e non sa né correggere né spiegare alla persona che cosa non è andato.
      let testo = "";
      try {
        testo = await res.text();
      } catch {
        /* nessun corpo leggibile: resta lo stato */
      }
      const motivo = testo ? `: ${testo.slice(0, 800)}` : "";
      if (lettura) throw new Error(`${method} ${path} -> ${res.status}${motivo}`);
      const perLaPersona = messaggioScritturaNonSalvata(res.status, codiceErrore(testo));
      // Difetto del 2026-11-22: dopo un consenso e un rifiuto l'assistente può chiudere il giro
      // senza dire niente. Il gateway tiene l'esito e, se il modello tace, lo dice lui (sdk-agent).
      this.scrittureFallite.push(perLaPersona);
      throw new Error(`${method} ${path} -> ${res.status} (scrittura NON eseguita). La piattaforma lo scrive da sé alla persona: «${perLaPersona}»${motivo}`);
    }
    if (lettura) this.esiti?.riuscita();
    else this.scrittureFallite.length = 0; // una scrittura riuscita dopo un rifiuto lo supera
    const grezzi = (await res.json()) as unknown;
    // A-14: l'origine del dato del modulo che ha risposto (nativo, importato, ibrido, misto),
    // legata alla risposta stessa: chi la passa all'agente la ritrova senza indovinarla.
    // I campi che l'API ha tolto tornano al loro posto come {omissis} (omissis.ts).
    const dati = conOmissis(grezzi) as T;
    const origine = res.headers?.get(INTESTAZIONE_ORIGINE);
    if (origine && typeof dati === "object" && dati !== null) this.origini.set(dati, origine);
    // #251 — le persone distinte si contano QUI, sulla risposta già mascherata dall'API (R3):
    // il contatore non vede mai un campo che l'utente non poteva vedere. `aggiungi` non alza
    // per contratto, ma il `try` resta: un contatore rotto non deve poter negare una lettura.
    try {
      this.contatore?.aggiungi(grezzi);
    } catch {
      /* contare non è la lettura: un guasto del contatore non cambia l'esito della chiamata */
    }
    return dati;
  }
}

/**
 * Piano interfacce L9, A-1/A-2/A-3 (ADR-0050 D6): il gettone dell'agente.
 *
 * Con i cookie della persona il gateway chiede all'API un gettone breve per un agente e un
 * compito (`POST /v1/auth/agent-tokens`); da lì in poi l'agente chiama con quel gettone, non con
 * i cookie della persona. Così l'API sa che chi scrive è un agente e per conto di chi, il
 * perimetro è al più quello della persona senza mandati (ristretto se il compito porta
 * `permissions`), e alla scadenza non c'è rinnovo: si ripassa dalla persona.
 *
 * Restituisce la sessione da dare al client (senza `cookieRefresh`: niente rinnovo), oppure
 * l'esito dell'API quando il gettone è rifiutato.
 */
/** Il codice d'errore dell'API (`{ error: { code } }`), se il corpo lo porta. */
function codiceErrore(testo: string): string | undefined {
  try {
    const c = (JSON.parse(testo) as { error?: { code?: unknown } }).error?.code;
    return typeof c === "string" ? c : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Che cosa dire alla persona quando una scrittura che ha approvato non è salvata. Difetti del
 * 2026-11-22: «ti manca il permesso» a chi il potere lo ha per mandato, e «puoi farla dalla
 * pagina» a chi non lo ha affatto. ADR-0050 D6: l'assistente scrive senza i mandati della persona,
 * e l'API distingue i due casi (`AGENT_MANDATE_ONLY` contro `FORBIDDEN`/`PERMISSION_DENIED`).
 */
export function messaggioScritturaNonSalvata(stato: number, codice: string | undefined): string {
  if (codice === "AGENT_MANDATE_ONLY") {
    return "La modifica non è stata salvata. Hai questo potere grazie al tuo incarico, e l'assistente non può usarlo per tuo conto: puoi farla tu dalla pagina.";
  }
  if (stato === 403) {
    return "La modifica non è stata salvata: il tuo profilo non permette questa modifica. Può farla chi ha la responsabilità di questi dati.";
  }
  if (stato === 400 || stato === 422) {
    return "La modifica non è stata salvata: i dati preparati non sono stati accettati.";
  }
  if (stato === 404) return "La modifica non è stata salvata: l'elemento da modificare non è stato trovato.";
  if (stato === 409) return "La modifica non è stata salvata: nel frattempo i dati sono cambiati.";
  return "La modifica non è stata salvata per un errore del sistema.";
}

export interface RichiestaGettone {
  agentCode: string;
  task: string;
  permissions?: string[];
}

export async function chiediGettoneAgente(
  baseUrl: string,
  persona: { cookieAccess: string; cookieCsrf: string },
  richiesta: RichiestaGettone,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
): Promise<
  | { ok: true; session: Session; expiresAt: string; persona: { userId: string; tenantCode: string | null } }
  | { ok: false; status: number; corpo: unknown }
> {
  const res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/auth/agent-tokens`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `hrx_access=${persona.cookieAccess}; hrx_csrf=${persona.cookieCsrf}`,
      "x-csrf-token": persona.cookieCsrf,
    },
    body: JSON.stringify(richiesta),
  });
  if (!res.ok) {
    let corpo: unknown = null;
    try {
      corpo = await res.json();
    } catch {
      /* il corpo dell'errore è informazione in più, non la condizione */
    }
    return { ok: false, status: res.status, corpo };
  }
  const dati = (await res.json()) as { token: string; expiresAt: string; userId: string; tenantCode?: string | null };
  return {
    ok: true,
    session: { cookieAccess: dati.token, cookieCsrf: persona.cookieCsrf, csrf: persona.cookieCsrf },
    expiresAt: dati.expiresAt,
    // A-12: per conto di chi, perché il diario dica chi e in quale tenant.
    persona: { userId: dati.userId, tenantCode: dati.tenantCode ?? null },
  };
}

/**
 * Chi sta decidendo un'approvazione (ADR-0056, piano dei principi agentici T3). Il ponte di
 * approvazione non si fida del corpo della richiesta: chiede all'API, con i cookie di chi ha
 * premuto, chi è (`GET /v1/auth/me`). Senza una risposta valida non c'è nessuno, e chi non c'è
 * non decide niente.
 */
export async function chiSei(
  baseUrl: string,
  persona: { cookieAccess: string },
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
): Promise<string | undefined> {
  return (await chiEDove(baseUrl, persona, fetchImpl))?.userId;
}

/**
 * Chi parla e in quale tenant (`GET /v1/auth/me`), per l'ammissione all'assistente (ADR-0056 D3):
 * `tenantId` è null per chi ha un mandato di piattaforma. Non lancia: senza risposta valida non c'è nessuno.
 */
export async function chiEDove(
  baseUrl: string,
  persona: { cookieAccess: string },
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
): Promise<{ userId: string; tenantId: string | null } | undefined> {
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/auth/me`, {
      method: "GET",
      headers: { cookie: `hrx_access=${persona.cookieAccess}` },
    });
    if (!res.ok) return undefined;
    const dati = (await res.json()) as { userId?: unknown; tenantId?: unknown };
    if (typeof dati.userId !== "string" || !dati.userId) return undefined;
    return { userId: dati.userId, tenantId: typeof dati.tenantId === "string" && dati.tenantId ? dati.tenantId : null };
  } catch {
    return undefined; // un'API che non risponde non dice chi sei: fail-closed
  }
}

/**
 * ADR-0056 D4 (piano T6b): registra la decisione della persona su una proposta dell'assistente,
 * con i cookie e il token CSRF di chi ha premuto (`POST /v1/agent-conversations/proposals/:id/decision`).
 * Il token CSRF è quello che la finestra ha mandato nell'intestazione, mai ricavato dal cookie:
 * ricavarlo qui toglierebbe la protezione che chiede. Non lancia: un guasto è uno stato 0.
 */
export async function registraDecisione(
  baseUrl: string,
  persona: { cookieAccess: string; cookieCsrf: string; csrfHeader: string },
  proposalId: string,
  decision: "APPROVATA" | "SCARTATA",
  reason: string | undefined,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetchImpl(
      `${baseUrl.replace(/\/$/, "")}/v1/agent-conversations/proposals/${encodeURIComponent(proposalId)}/decision`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `hrx_access=${persona.cookieAccess}; hrx_csrf=${persona.cookieCsrf}`,
          "x-csrf-token": persona.csrfHeader,
        },
        body: JSON.stringify({ decision, ...(reason !== undefined ? { reason } : {}) }),
      },
    );
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 }; // un'API che non risponde non registra: niente si sblocca
  }
}
