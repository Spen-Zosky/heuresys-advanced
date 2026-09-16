/**
 * apps/api/test/unit/perimetro-clienti.unit.test.ts — mandato K, R-0 (D9=B), passo 38(i).
 *
 * La prova SUL VIVO (un ruolo di piattaforma assegnato vero, dati reali) la fa R-9, la voce
 * successiva del mandato: oggi nessun ruolo popola `PLATFORM_ASSIGNED_MANDATE_ROLES`
 * (`apps/api/src/lib/scope/mandati.ts`), quindi non esiste un attore vero da usare qui.
 * Questo test unitario prova il MECCANISMO — `perimetroClienti`/`puoVedereCliente` letti
 * direttamente da `actor.assignedTenantIds` — con un attore SINTETICO, senza database.
 */
import { describe, it, expect } from "vitest";
import { isPlatform, perimetroClienti, puoVedereCliente, type ActorContext } from "../../src/lib/actor.js";

const attore = (over: Partial<ActorContext>): ActorContext => ({
  userId: "u-test", tenantId: null, roles: [], ...over,
});

describe("perimetroClienti / puoVedereCliente (mandato K, R-0)", () => {
  it("PLATFORM_ADMIN non ha filtro: undefined, sempre", () => {
    const a = attore({ roles: ["PLATFORM_ADMIN"], tenantId: "heuresys-system", assignedTenantIds: ["x"] });
    expect(isPlatform(a)).toBe(true);
    expect(perimetroClienti(a)).toBeUndefined();
    expect(puoVedereCliente(a, "qualunque-cliente")).toBe(true);
  });

  it("un ruolo di piattaforma ASSEGNATO con due clienti vede solo quei due", () => {
    const a = attore({ roles: ["BLUEPRINT_MANAGER"], assignedTenantIds: ["rtl-bank", "acme"] });
    const perimetro = perimetroClienti(a);
    expect(perimetro).toEqual(new Set(["rtl-bank", "acme"]));
    expect(puoVedereCliente(a, "rtl-bank")).toBe(true);
    expect(puoVedereCliente(a, "un-terzo-cliente")).toBe(false);
  });

  it("un ruolo di piattaforma ASSEGNATO con zero clienti non vede nessuno — non tutti", () => {
    const a = attore({ roles: ["BLUEPRINT_MANAGER"], assignedTenantIds: [] });
    expect(perimetroClienti(a)).toEqual(new Set());
    expect(puoVedereCliente(a, "rtl-bank")).toBe(false);
  });

  it("un attore ordinario (nessuna assegnazione) vede solo il proprio tenant", () => {
    const a = attore({ roles: ["USER"], tenantId: "rtl-bank" });
    expect(a.assignedTenantIds).toBeUndefined();
    expect(perimetroClienti(a)).toEqual(new Set(["rtl-bank"]));
    expect(puoVedereCliente(a, "rtl-bank")).toBe(true);
    expect(puoVedereCliente(a, "acme")).toBe(false);
  });

  it("un attore ordinario senza tenantId non vede nessun cliente (mai un errore silenzioso di 'tutti')", () => {
    const a = attore({ roles: ["USER"], tenantId: null });
    expect(perimetroClienti(a)).toEqual(new Set());
  });

  // Controprova (V8/regola 5): un predicato che non sa fallire non prova nulla. Si altera
  // apposta l'input e si verifica che il risultato cambi di conseguenza.
  it("controprova: rimuovere un cliente dall'assegnazione lo toglie SUBITO dal perimetro", () => {
    const assegnati = ["rtl-bank", "acme"];
    const a = attore({ roles: ["BLUEPRINT_MANAGER"], assignedTenantIds: assegnati });
    expect(puoVedereCliente(a, "acme")).toBe(true);
    const dopoRevoca = attore({ roles: ["BLUEPRINT_MANAGER"], assignedTenantIds: assegnati.filter((t) => t !== "acme") });
    expect(puoVedereCliente(dopoRevoca, "acme")).toBe(false);
  });
});
