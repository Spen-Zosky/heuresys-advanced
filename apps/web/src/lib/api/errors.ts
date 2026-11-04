/**
 * apps/web/src/lib/api/errors.ts
 * Typed error classes that mirror apps/api/src/errors/index.ts so the UI can
 * branch on error.code without parsing strings.
 *
 * S-12 e F-4 del piano interfacce (2026-11-04). `message` e' il testo per la persona,
 * nella sua lingua: si ricava dal CODICE (o, se il codice non ha un testo suo, dallo
 * stato HTTP) con le chiavi `common:apiErrors.*`, e porta il riferimento da citare
 * quando la richiesta ne ha uno. Il testo tecnico inglese del server resta in
 * `serverMessage`, per chi diagnostica. Cosi' ogni pagina che stampa `e.message`
 * mostra gia' la frase giusta, senza toccarle una a una.
 */

import i18next from "i18next";

/** Il testo per la persona: prima il codice, poi lo stato, poi il generico. */
export function testoErrore(status: number, code: string, requestId?: string): string {
  const t = i18next.isInitialized ? i18next.t.bind(i18next) : null;
  if (!t) return requestId ? `HTTP ${status} (${code}) — ${requestId}` : `HTTP ${status} (${code})`;
  const perCodice = `common:apiErrors.code.${code}`;
  const perStato = `common:apiErrors.status.${status}`;
  const base = i18next.exists(perCodice)
    ? t(perCodice)
    : i18next.exists(perStato)
      ? t(perStato)
      : t(status >= 500 ? "common:apiErrors.status.500" : "common:apiErrors.status.default");
  return requestId ? `${base} ${t("common:apiErrors.reference", { requestId })}` : base;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;
  /** Il testo tecnico del server, in inglese: per la diagnosi, non per la persona. */
  readonly serverMessage: string;

  constructor(status: number, body: ApiErrorBody) {
    super(testoErrore(status, body.error.code, body.error.requestId));
    this.serverMessage = body.error.message;
    this.name = "ApiError";
    this.status = status;
    this.code = body.error.code;
    if (body.error.requestId !== undefined) this.requestId = body.error.requestId;
    if (body.error.details !== undefined) this.details = body.error.details;
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super(i18next.isInitialized ? i18next.t("common:apiErrors.sessionExpired") : "Session expired");
    this.name = "SessionExpiredError";
  }
}

export class NetworkError extends Error {
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    if (cause !== undefined) this.cause = cause;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
