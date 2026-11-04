/**
 * apps/web/src/lib/api/session-cache.test.ts — V-12 del piano interfacce (2026-11-04).
 *
 * La copia di sessione evita di rileggere identita', menu e permessi a ogni pagina. Qui si
 * prova che la copia fresca si riusa, che quella vecchia si scarta, che l'uscita e un 403 la
 * buttano, e che i 403 a raffica non fanno rileggere a raffica.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FRESCHEZZA_MS,
  leggiCopia,
  scriviCopia,
  segnalaPermessoNegato,
  suPermessoNegato,
  svuotaCopiaDiSessione,
} from "./session-cache";

class ArchivioFinto implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

beforeEach(() => {
  vi.useRealTimers();
  vi.stubGlobal("window", { sessionStorage: new ArchivioFinto() });
});

describe("V-12 — la copia di sessione", () => {
  it("una copia fresca si rilegge, con l'ora in cui e' arrivata", () => {
    scriviCopia("me-permissions", { permissions: ["a:read"] });
    const c = leggiCopia<{ permissions: string[] }>("me-permissions");
    expect(c?.data.permissions).toEqual(["a:read"]);
    expect(Date.now() - (c?.savedAt ?? 0)).toBeLessThan(1000);
  });

  it("una copia piu' vecchia della freschezza non vale", () => {
    vi.useFakeTimers();
    scriviCopia("auth-me", { userId: "u" });
    vi.advanceTimersByTime(FRESCHEZZA_MS + 1);
    expect(leggiCopia("auth-me")).toBeUndefined();
  });

  it("svuotare toglie solo le copie di sessione", () => {
    window.sessionStorage.setItem("altro", "resta");
    scriviCopia("me-interfaces", { routes: [] });
    svuotaCopiaDiSessione();
    expect(leggiCopia("me-interfaces")).toBeUndefined();
    expect(window.sessionStorage.getItem("altro")).toBe("resta");
  });

  it("un 403 butta la copia e avvisa una volta sola in trenta secondi", () => {
    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000);
    const avvisi: number[] = [];
    const via = suPermessoNegato(() => avvisi.push(Date.now()));
    scriviCopia("me-permissions", { permissions: [] });
    segnalaPermessoNegato();
    segnalaPermessoNegato();
    expect(leggiCopia("me-permissions")).toBeUndefined();
    expect(avvisi.length).toBe(1);
    vi.advanceTimersByTime(30_001);
    segnalaPermessoNegato();
    expect(avvisi.length).toBe(2);
    via();
  });

  it("senza archivio (lato server) non si rompe niente", () => {
    vi.stubGlobal("window", undefined);
    expect(scriviCopia("x", 1)).toBe(1);
    expect(leggiCopia("x")).toBeUndefined();
    expect(() => svuotaCopiaDiSessione()).not.toThrow();
  });
});
