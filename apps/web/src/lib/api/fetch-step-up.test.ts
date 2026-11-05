/**
 * apps/web/src/lib/api/fetch-step-up.test.ts — ADR-0050 D5.
 *
 * Su un 403 STEP_UP_REQUIRED il client chiede la conferma del secondo fattore alla finestra
 * registrata e, se arriva, ripete la richiesta UNA volta. Senza conferma resta l'errore
 * dell'API. Più richieste respinte insieme aprono una finestra sola.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const chiamate: string[] = [];

function risposta(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const NEGATA = { error: { code: "STEP_UP_REQUIRED", message: "confirm" } };

beforeEach(() => {
  chiamate.length = 0;
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.stubGlobal("document", { cookie: "" });
});

async function carica() {
  const { apiFetch } = await import("./fetch");
  const { registraRichiestaConferma } = await import("./step-up");
  const { ApiError } = await import("./errors");
  return { apiFetch, registraRichiestaConferma, ApiError };
}

describe("ADR-0050 D5 — conferma del secondo fattore su 403 STEP_UP_REQUIRED", () => {
  it("con la conferma ripete la richiesta una volta", async () => {
    let confermata = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      chiamate.push(url);
      return confermata ? risposta(200, { items: [] }) : risposta(403, NEGATA);
    }));
    const { apiFetch, registraRichiestaConferma } = await carica();
    const finestra = vi.fn(async () => { confermata = true; return true; });
    registraRichiestaConferma(finestra);
    await expect(apiFetch("/v1/compensation/variable-pay")).resolves.toEqual({ items: [] });
    expect(finestra).toHaveBeenCalledTimes(1);
    expect(chiamate).toEqual(["/api/v1/compensation/variable-pay", "/api/v1/compensation/variable-pay"]);
  });

  it("senza conferma resta l'errore dell'API, e non si ripete", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { chiamate.push(url); return risposta(403, NEGATA); }));
    const { apiFetch, registraRichiestaConferma, ApiError } = await carica();
    registraRichiestaConferma(async () => false);
    const err = await apiFetch("/v1/compensation/variable-pay").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as InstanceType<typeof ApiError>).code).toBe("STEP_UP_REQUIRED");
    expect(chiamate).toHaveLength(1);
  });

  it("se anche dopo la conferma l'API rifiuta, non chiede di nuovo", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { chiamate.push(url); return risposta(403, NEGATA); }));
    const { apiFetch, registraRichiestaConferma } = await carica();
    const finestra = vi.fn(async () => true);
    registraRichiestaConferma(finestra);
    await expect(apiFetch("/v1/compensation/variable-pay")).rejects.toBeTruthy();
    expect(finestra).toHaveBeenCalledTimes(1);
    expect(chiamate).toHaveLength(2);
  });

  it("richieste respinte insieme aprono una finestra sola", async () => {
    let confermata = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      chiamate.push(url);
      return confermata ? risposta(200, {}) : risposta(403, NEGATA);
    }));
    const { apiFetch, registraRichiestaConferma } = await carica();
    let apri: (ok: boolean) => void = () => {};
    const finestra = vi.fn(() => new Promise<boolean>((r) => { apri = r; }));
    registraRichiestaConferma(finestra);
    const tre = Promise.all([apiFetch("/v1/a"), apiFetch("/v1/b"), apiFetch("/v1/c")]);
    await vi.waitFor(() => expect(finestra).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    confermata = true;
    apri(true);
    await expect(tre).resolves.toHaveLength(3);
    expect(finestra).toHaveBeenCalledTimes(1);
  });

  it("senza finestra registrata (pagine pubbliche) resta l'errore", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => risposta(403, NEGATA)));
    const { apiFetch } = await carica();
    await expect(apiFetch("/v1/compensation/variable-pay")).rejects.toBeTruthy();
  });
});
