/**
 * apps/web/src/lib/api/fetch-refresh.test.ts — lotto L7 del piano interfacce (2026-11-04).
 *
 * Su un 401 il client tenta un rinnovo della sessione. Senza il token CSRF il rinnovo non
 * può riuscire (l'API risponde 403 CSRF_FAIL), quindi non si tenta: niente richiesta, e la
 * pagina passa subito a «sessione scaduta». Con il token il rinnovo parte e porta il token.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const chiamate: { url: string; init: RequestInit | undefined }[] = [];

function risposta(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  chiamate.length = 0;
  vi.resetModules();
  vi.unstubAllGlobals();
});

async function carica(cookie: string) {
  vi.stubGlobal("document", { cookie });
  const { apiFetch } = await import("./fetch");
  const { SessionExpiredError } = await import("./errors");
  return { apiFetch, SessionExpiredError };
}

describe("L7 — rinnovo della sessione su 401", () => {
  it("senza token CSRF non tenta il rinnovo e dichiara la sessione scaduta", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      chiamate.push({ url, init });
      return risposta(401, { error: { code: "UNAUTHENTICATED", message: "no" } });
    }));
    const { apiFetch, SessionExpiredError } = await carica("");
    await expect(apiFetch("/v1/me/permissions")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(chiamate.map((c) => c.url)).toEqual(["/api/v1/me/permissions"]);
  });

  it("con il token CSRF tenta il rinnovo, lo porta nell'intestazione e ripete la richiesta", async () => {
    let primo = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      chiamate.push({ url, init });
      if (url.endsWith("/v1/auth/refresh")) return risposta(200, { csrfToken: "nuovo" });
      if (primo) { primo = false; return risposta(401, { error: { code: "UNAUTHENTICATED", message: "no" } }); }
      return risposta(200, { permissions: [] });
    }));
    const { apiFetch } = await carica("hrx_csrf=vecchio");
    await expect(apiFetch("/v1/me/permissions")).resolves.toEqual({ permissions: [] });
    expect(chiamate.map((c) => c.url)).toEqual([
      "/api/v1/me/permissions",
      "/api/v1/auth/refresh",
      "/api/v1/me/permissions",
    ]);
    const intestazioni = chiamate[1]?.init?.headers as Record<string, string>;
    expect(intestazioni["x-csrf-token"]).toBe("vecchio");
  });
});
