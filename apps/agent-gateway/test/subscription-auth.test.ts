/**
 * apps/agent-gateway/test/subscription-auth.test.ts — S1029.
 *
 * Il gateway può girare sull'abbonamento Claude dell'operatore invece che su una
 * chiave API (#9 §A.1). Perché funzioni, l'ambiente deve essere privo di credenziali
 * API PRIMA che l'SDK le legga. Qui si verifica il contratto della funzione; il fatto
 * che venga eseguita abbastanza presto è garantito dall'essere il primo import di
 * `server.ts` (side-effect import), non da un test.
 */

import { describe, it, expect } from "vitest";
import { applySubscriptionAuth, API_CREDENTIAL_ENV_VARS } from "../src/subscription-auth.js";

describe("applySubscriptionAuth", () => {
  it("con il flag attivo rimuove entrambe le credenziali e le dichiara", () => {
    const env: Record<string, string | undefined> = {
      AGENT_GATEWAY_SUBSCRIPTION_AUTH: "1",
      ANTHROPIC_API_KEY: "sk-test-non-reale",
      ANTHROPIC_AUTH_TOKEN: "token-non-reale",
      ALTRA_VAR: "intatta",
    };
    const removed = applySubscriptionAuth(env);

    expect(removed.sort()).toEqual([...API_CREDENTIAL_ENV_VARS].sort());
    expect("ANTHROPIC_API_KEY" in env).toBe(false);
    expect("ANTHROPIC_AUTH_TOKEN" in env).toBe(false);
    // non è una pulizia a tappeto: tocca solo ciò che deve
    expect(env.ALTRA_VAR).toBe("intatta");
    expect(env.AGENT_GATEWAY_SUBSCRIPTION_AUTH).toBe("1");
  });

  it("senza il flag NON tocca nulla — la modalità a chiave API resta possibile", () => {
    const env: Record<string, string | undefined> = { ANTHROPIC_API_KEY: "sk-test-non-reale" };
    expect(applySubscriptionAuth(env)).toEqual([]);
    expect(env.ANTHROPIC_API_KEY).toBe("sk-test-non-reale");
  });

  it("il flag a un valore diverso da '1' non attiva la modalità", () => {
    // Evita che un "true"/"yes" attivi per sbaglio un cambio di modalità di billing.
    for (const v of ["true", "yes", "0", ""]) {
      const env: Record<string, string | undefined> = {
        AGENT_GATEWAY_SUBSCRIPTION_AUTH: v,
        ANTHROPIC_API_KEY: "sk-test-non-reale",
      };
      expect(applySubscriptionAuth(env)).toEqual([]);
      expect(env.ANTHROPIC_API_KEY).toBe("sk-test-non-reale");
    }
  });

  it("è idempotente e non si lamenta se le credenziali già non ci sono", () => {
    const env: Record<string, string | undefined> = { AGENT_GATEWAY_SUBSCRIPTION_AUTH: "1" };
    expect(applySubscriptionAuth(env)).toEqual([]);
    expect(applySubscriptionAuth(env)).toEqual([]);
  });
});
