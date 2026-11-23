import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { requirePermissionOr, setRolePermissionCache } from "../../src/middleware/rbac.js";

// Unit-level (nessun DB): la cache dei permessi è iniettata. Il potere «dal dato» (alternativa)
// recupera solo il diniego di ruolo semplice, mai il perimetro di un gettone d'agente.

const PERM = "bpm_process:update";
type Utente = { roles: string[]; agente?: { permessi: ReadonlySet<string> | null; ruoliPieni?: string[] } };

const req = (user: Utente | undefined) => ({ user }) as unknown as FastifyRequest;
const esegui = (user: Utente | undefined, alt: () => Promise<boolean>) =>
  (requirePermissionOr(PERM, alt) as unknown as (r: FastifyRequest, p: FastifyReply) => Promise<void>)(req(user), {} as FastifyReply);

describe("requirePermissionOr — l'alternativa non scavalca il perimetro del gettone d'agente", () => {
  beforeAll(() => {
    setRolePermissionCache(new Map([["USER", new Set(["bpm_process:read"])], ["PROCESS_OWNER", new Set([PERM, "bpm_process:read"])]]) as never);
  });
  const si = async () => true;

  it("persona senza permesso, ma responsabile: passa", async () => {
    await expect(esegui({ roles: ["USER"] }, si)).resolves.toBeUndefined();
  });

  it("persona senza permesso e non responsabile: FORBIDDEN", async () => {
    await expect(esegui({ roles: ["USER"] }, async () => false)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("gettone d'agente con compito che esclude il permesso: negato anche se la persona è responsabile", async () => {
    let interrogata = false;
    const alt = async () => { interrogata = true; return true; };
    const agente = { permessi: new Set(["bpm_process:read"]) };
    await expect(esegui({ roles: ["USER"], agente }, alt)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(interrogata).toBe(false);
  });

  it("gettone d'agente con compito che comprende il permesso: il responsabile in carica passa", async () => {
    await expect(esegui({ roles: ["USER"], agente: { permessi: new Set([PERM]) } }, si)).resolves.toBeUndefined();
    await expect(esegui({ roles: ["USER"], agente: { permessi: null } }, si)).resolves.toBeUndefined();
  });

  it("AGENT_MANDATE_ONLY non ricade sull'alternativa", async () => {
    setRolePermissionCache(new Map([["USER", new Set(["bpm_process:read"])], ["HRMS_MANAGER", new Set([PERM])]]) as never);
    const agente = { permessi: null, ruoliPieni: ["HRMS_MANAGER"] };
    await expect(esegui({ roles: ["USER"], agente }, si)).rejects.toMatchObject({ code: "AGENT_MANDATE_ONLY" });
  });
});
