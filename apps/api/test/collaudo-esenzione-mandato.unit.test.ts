/**
 * La riattivazione del collaudo non riaccende l'esenzione MFA di chi porta un mandato forte
 * (ADR-0050 D2). Caso reale: `sospendi-collaudo --riattiva` rimetteva l'esenzione anche alle
 * sei utenze con mandato, e `provision-collaudo` veniva poi fermato dal trigger della 000473.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { COLLAUDO_IDENTITIES, esenzioneAmmessa } from "../scripts/collaudo-access.mjs";

const MANDATI = ["TENANT_ADMIN", "HRMS_MANAGER", "PEOPLE_MANAGER", "DPO", "PLATFORM_ADMIN", "SECURITY_ADMIN", "WHISTLEBLOWING_CUSTODIAN"];

describe("esenzioneAmmessa", () => {
  it("nega l'esenzione a ogni ruolo con mandato forte", () => {
    for (const r of MANDATI) expect(esenzioneAmmessa(r, MANDATI)).toBe(false);
  });
  it("la ammette ai ruoli senza mandato", () => {
    expect(esenzioneAmmessa("USER", MANDATI)).toBe(true);
    expect(esenzioneAmmessa("SALES", MANDATI)).toBe(true);
  });
  it("le utenze di collaudo con mfaExempt:false sono esattamente quelle con mandato forte", () => {
    for (const c of COLLAUDO_IDENTITIES) {
      if (c.mfaExempt === false) expect(esenzioneAmmessa(c.roleCode, MANDATI)).toBe(false);
    }
  });
});

describe("i due script applicano la regola", () => {
  const leggi = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  it("sospendi-collaudo --riattiva usa esenzioneAmmessa prima di riaccendere", () => {
    const s = leggi("../../../db/scripts/sospendi-collaudo.ts");
    expect(s).toMatch(/ultima\.esenzione && esenzioneAmmessa\(/);
  });
  it("provision-collaudo spegne l'esenzione PRIMA di concedere il ruolo", () => {
    const s = leggi("../../../db/scripts/provision-collaudo-access.ts");
    const spegne = s.indexOf("PRIMA di concedere un mandato forte");
    const concede = s.indexOf("user_auth_role_role_id, user_auth_role_tenant_id");
    expect(spegne).toBeGreaterThan(0);
    expect(spegne).toBeLessThan(concede);
  });
});
