/**
 * apps/api/test/unit/people-manager-mandato.unit.test.ts — correzione D-01 (2026-10-31).
 *
 * Il difetto, misurato in produzione dall'analisi delle interfacce: PEOPLE_MANAGER stava in
 * HR_MANDATED_ROLES e leggeva retribuzioni e valutazioni di tutto il tenant in chiaro, con le
 * stesse risposte di TENANT_ADMIN. I20 nomina come mandati HR solo TENANT_ADMIN e HRMS_MANAGER.
 *
 * Queste prove guardano il MECCANISMO, senza database: un attore sintetico con il solo ruolo
 * PEOPLE_MANAGER e un connettore finto che risponde «non dirige nessuna unità». Rosse prima
 * della correzione (il resolver rispondeva `tenant` senza nemmeno interrogare il connettore),
 * verdi dopo. La prova dal vivo sui dati veri sta nella dimostrazione del rilascio.
 */
import { describe, it, expect } from "vitest";
import {
  HR_MANDATED_ROLES,
  TENANT_WIDE_MANDATE_ROLES,
  ORG_BROWSE_ROLES,
  resolveOrgReadScope,
  resolveActivityScope,
  canReadOrgTarget,
} from "../../src/lib/scope/resolver.js";
import { haMandatoHr } from "../../src/lib/scope/mandati.js";
import type { ActorContext } from "../../src/lib/actor.js";
import type { DbConnector } from "../../src/lib/scope/org.js";

const TENANT = "00000000-0000-0000-0000-0000000000aa";
const PM: ActorContext = { userId: "00000000-0000-0000-0000-000000000001", tenantId: TENANT, roles: ["PEOPLE_MANAGER"] };
const ALTRO = "00000000-0000-0000-0000-000000000002";

/** Connettore finto: nessuna unità diretta, nessuna squadra, sotto-albero = solo se stessi. */
const nessunaUnita = {
  query: async (sql: string) => {
    if (/EXISTS/i.test(sql)) return { rows: [{ hit: false }] };
    return { rows: [{ user_id: PM.userId }] };
  },
} as unknown as DbConnector;

describe("D-01 — PEOPLE_MANAGER non è un mandato HR tenant-wide (I20)", () => {
  it("non sta negli insiemi dei mandati", () => {
    expect(HR_MANDATED_ROLES.has("PEOPLE_MANAGER")).toBe(false);
    expect(TENANT_WIDE_MANDATE_ROLES.has("PEOPLE_MANAGER")).toBe(false);
    expect(ORG_BROWSE_ROLES.has("PEOPLE_MANAGER")).toBe(false);
    expect(haMandatoHr(PM)).toBe(false);
  });

  it("i mandati HR veri restano due, più nessuno", () => {
    expect([...HR_MANDATED_ROLES].sort()).toEqual(["HRMS_MANAGER", "TENANT_ADMIN"]);
  });

  it("senza un'unità diretta il perimetro organizzativo è se stesso, non il tenant", async () => {
    const s = await resolveOrgReadScope(nessunaUnita, PM);
    expect(s.kind).toBe("self");
    if (s.kind === "self") expect(s.userIdAllowList).toEqual([PM.userId]);
  });

  it("e non legge il dato sensibile di un'altra persona del tenant", async () => {
    expect(await canReadOrgTarget(nessunaUnita, PM, ALTRO, TENANT)).toBe(false);
    expect(await canReadOrgTarget(nessunaUnita, PM, PM.userId, TENANT)).toBe(true);
  });

  it("anche l'asse funzionale non gli apre il tenant", async () => {
    const s = await resolveActivityScope(nessunaUnita, PM);
    expect(s.kind).not.toBe("tenant");
  });

  it("controprova: TENANT_ADMIN resta tenant-wide", async () => {
    const ta: ActorContext = { ...PM, roles: ["TENANT_ADMIN"] };
    expect((await resolveOrgReadScope(nessunaUnita, ta)).kind).toBe("tenant");
  });
});
