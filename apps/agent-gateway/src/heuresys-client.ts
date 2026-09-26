/**
 * heuresys /v1 client for the Agent SDK backend (#9 WI-B).
 *
 * Hybrid auth (the only identity channel is a user JWT cookie, PLATFORM_MAP §1):
 *  - user-scoped ops  → the webapp forwards the logged-in user's cookies;
 *  - catalogue authoring → the dedicated service-user session (PLATFORM_ADMIN).
 * Writes carry the CSRF double-submit (`hrx_csrf` cookie + `x-csrf-token` header).
 * Tenant is implicit in the JWT — never sent as a header (I5).
 *
 * Refresh is single-flight (M-5): a 401 triggers at most ONE concurrent
 * /v1/auth/refresh; concurrent calls await the same rotation (no replay storm).
 * fetchImpl is injectable so the client is unit-testable without live heuresys.
 */

export interface Session {
  cookieAccess: string;
  cookieCsrf: string;
  csrf: string;
  cookieRefresh?: string;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface HeuresysClientOptions {
  baseUrl: string; // e.g. http://localhost:3001
  session: Session;
  fetchImpl?: FetchLike;
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
  private refreshing: Promise<boolean> | null = null;
  private contatore: OsservatoreRisposte | undefined;

  constructor(opts: HeuresysClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.session = opts.session;
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  private headers(method: string): Record<string, string> {
    const h: Record<string, string> = {
      "content-type": "application/json",
      cookie: `hrx_access=${this.session.cookieAccess}; hrx_csrf=${this.session.cookieCsrf}`,
    };
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
    if (!res.ok) {
      throw new Error(`${method} ${path} -> ${res.status}`);
    }
    const dati = (await res.json()) as T;
    // #251 — le persone distinte si contano QUI, sulla risposta già mascherata dall'API (R3):
    // il contatore non vede mai un campo che l'utente non poteva vedere. `aggiungi` non alza
    // per contratto, ma il `try` resta: un contatore rotto non deve poter negare una lettura.
    try {
      this.contatore?.aggiungi(dati);
    } catch {
      /* contare non è la lettura: un guasto del contatore non cambia l'esito della chiamata */
    }
    return dati;
  }
}
