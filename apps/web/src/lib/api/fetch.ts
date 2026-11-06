/**
 * apps/web/src/lib/api/fetch.ts
 *
 * Single fetch wrapper for the Heuresys API. Lives behind the Next.js
 * `/api/*` proxy so cookies stay same-origin (HttpOnly + SameSite=Lax).
 *
 * Features:
 *   - automatic `credentials: "include"` for cookie forwarding,
 *   - automatic `x-csrf-token` injection on mutations from `csrfStore`,
 *   - silent refresh on 401 (single-flight, one retry via /v1/auth/refresh),
 *   - typed error throw (ApiError / SessionExpiredError / NetworkError),
 *   - optional Zod schema validation on success body,
 *   - JSON bodies by default, `FormData` passed through as multipart (C4).
 */

import type { ZodTypeAny } from "zod";
import i18next from "i18next";
import { csrfStore } from "./csrf-store";
import { ApiError, NetworkError, SessionExpiredError, type ApiErrorBody } from "./errors";
import { SUPERFICIE_HEADER, superficiePagina } from "@heuresys/shared/schemas/valore";
import { segnalaPermessoNegato, svuotaCopiaDiSessione } from "./session-cache";
import { chiediConferma, STEP_UP_REQUIRED_CODE } from "./step-up";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiFetchOptions<TSchema extends ZodTypeAny | undefined = undefined> {
  method?: HttpMethod;
  /** JSON-serialized, EXCEPT a `FormData` which is sent as-is (multipart). */
  body?: unknown;
  schema?: TSchema;
  /** Internal flag — set by the silent-refresh retry to prevent infinite loops. */
  isRetry?: boolean;
  /** Internal flag — set by the ADR-0050 D5 retry after a second-factor confirmation. */
  isStepUpRetry?: boolean;
  /** Override base URL (default: same-origin `/api`). */
  baseUrl?: string;
  /** Extra headers (caller-supplied; we always set content-type for JSON). */
  headers?: Record<string, string>;
  /** Fetch signal for cancellation. */
  signal?: AbortSignal;
}

const SAFE_METHODS = new Set<HttpMethod>(["GET"]);

function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function attemptRefresh(baseUrl: string): Promise<boolean> {
  try {
    const csrf = csrfStore.get();
    // Senza il token CSRF non c'è una sessione da rinnovare: l'API risponde sempre 403
    // CSRF_FAIL (verifyCsrf sulla rotta), e la richiesta inutile consuma il limite di 60
    // rinnovi in 5 minuti. Succede su ogni pagina aperta da chi non è entrato (L7).
    if (!csrf) return false;
    const headers: Record<string, string> = { accept: "application/json", "x-csrf-token": csrf };
    const res = await fetch(joinUrl(baseUrl, "/v1/auth/refresh"), {
      method: "POST",
      headers,
      credentials: "include",
      body: "{}",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { csrfToken?: string };
    if (body.csrfToken) csrfStore.set(body.csrfToken);
    return true;
  } catch {
    return false;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Single-flight + cross-tab-serialized silent refresh (D-26).
 *
 * Refresh tokens are SINGLE-USE (server-side rotation + replay detection):
 * two concurrent POSTs presenting the same token are a replay and revoke the
 * whole token family — a hard logout. A page load fires many queries in
 * parallel, so concurrent 401s are the norm, not the exception.
 *
 *   - the module-level promise collapses concurrent 401s from THIS tab into
 *     one POST (everyone awaits the same flight);
 *   - the Web Lock serializes refreshes ACROSS tabs: the loser of the race
 *     runs after the winner's Set-Cookie landed, so its own POST carries the
 *     freshly rotated token — a valid rotation, not a replay.
 */
function refreshOnce(baseUrl: string): Promise<boolean> {
  if (!refreshInFlight) {
    const run: Promise<boolean> =
      typeof navigator !== "undefined" && "locks" in navigator && navigator.locks
        ? (navigator.locks.request("hrx_refresh_rotation", () =>
            attemptRefresh(baseUrl),
          ) as Promise<boolean>)
        : attemptRefresh(baseUrl);
    refreshInFlight = run.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions<ZodTypeAny | undefined> = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    schema,
    isRetry = false,
    isStepUpRetry = false,
    baseUrl = "/api",
    headers: extraHeaders,
    signal,
  } = options;

  const headers: Record<string, string> = {
    accept: "application/json",
    // F0-3, il test del valore: la pagina da cui parte la richiesta. È contesto, non
    // identità (chi agisce lo dice il cookie); senza, una decisione presa da qui
    // conterebbe come un dato caricato da uno script.
    ...(typeof window !== "undefined" ? { [SUPERFICIE_HEADER]: superficiePagina(window.location.pathname) } : {}),
    ...extraHeaders,
  };

  let payload: BodyInit | undefined;
  if (body !== undefined && method !== "GET") {
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      // Multipart: the browser MUST generate content-type itself so the
      // multipart boundary matches the serialized body. Setting it by hand
      // (even to the right mime) yields a boundary-less header the server
      // cannot parse — so we also strip a caller-supplied one.
      delete headers["content-type"];
      delete headers["Content-Type"];
      payload = body;
    } else {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  if (!SAFE_METHODS.has(method)) {
    const csrf = csrfStore.get();
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(joinUrl(baseUrl, path), {
      method,
      headers,
      credentials: "include",
      ...(payload !== undefined ? { body: payload } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    throw new NetworkError(
      i18next.isInitialized ? i18next.t("common:apiErrors.network") : "Unable to reach the API",
      err,
    );
  }

  // Silent refresh on 401 (once, single-flight).
  if (response.status === 401 && !isRetry && path !== "/v1/auth/login" && path !== "/v1/auth/refresh") {
    const ok = await refreshOnce(baseUrl);
    if (ok) {
      return apiFetch<T>(path, { ...options, isRetry: true });
    }
    svuotaCopiaDiSessione();
    throw new SessionExpiredError();
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    // ADR-0050 D5: non è un permesso negato, è una conferma che manca. Si chiede il secondo
    // fattore e, se la persona lo conferma, si ripete la richiesta una volta.
    const codice =
      parsed && typeof parsed === "object" && "error" in parsed
        ? (parsed as ApiErrorBody).error?.code
        : undefined;
    if (response.status === 403 && codice === STEP_UP_REQUIRED_CODE) {
      if (!isStepUpRetry && (await chiediConferma())) {
        return apiFetch<T>(path, { ...options, isStepUpRetry: true });
      }
      throw new ApiError(response.status, parsed as ApiErrorBody);
    }
    // V-12: un 403 puo' voler dire che i ruoli sono cambiati: si rileggono permessi e menu.
    if (response.status === 403) segnalaPermessoNegato();
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      throw new ApiError(response.status, parsed as ApiErrorBody);
    }
    throw new ApiError(response.status, {
      error: { code: "UNKNOWN", message: `HTTP ${response.status}` },
    });
  }

  if (schema) {
    return schema.parse(parsed) as T;
  }
  return parsed as T;
}
