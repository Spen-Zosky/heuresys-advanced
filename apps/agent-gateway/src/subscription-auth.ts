/**
 * apps/agent-gateway/src/subscription-auth.ts
 *
 * Neutralizza le credenziali API prima che l'SDK possa leggerle, quando il gateway
 * deve girare sull'abbonamento Claude dell'operatore (#9 §A.1,
 * `AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`): senza chiave in ambiente, `query()` ricade
 * sulle credenziali della macchina già loggata, a costo marginale zero.
 *
 * PERCHE' UN MODULO A SE' (S1029). La stessa logica viveva in fondo agli import di
 * `server.ts`, ed era una trappola da ordine di valutazione: gli import ESM sono
 * *hoisted*, quindi `./sdk-agent.js` — e con esso `@anthropic-ai/claude-agent-sdk` —
 * veniva caricato PRIMA che la `delete` fosse eseguita. Se l'SDK legge la variabile
 * al momento dell'import (pattern diffuso nei client HTTP), la cancellazione arrivava
 * troppo tardi e il gateway usava la chiave API proprio nel caso in cui era stato
 * configurato per non farlo — un fallimento silenzioso, per giunta con un costo.
 *
 * Importando QUESTO modulo per primo (side-effect import in cima a server.ts) la
 * neutralizzazione avviene prima di ogni altro modulo del grafo.
 */

/** Variabili che l'SDK Anthropic considera credenziali API. */
export const API_CREDENTIAL_ENV_VARS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"] as const;

/**
 * Rimuove le credenziali API dall'ambiente passato, se la modalità subscription è
 * attiva. Funzione pura sull'oggetto ricevuto: prende `env` come parametro invece di
 * toccare `process.env` direttamente, così il comportamento è verificabile senza
 * mutare il processo di test.
 *
 * @returns i nomi delle variabili effettivamente rimosse (vuoto = nessuna azione).
 */
export function applySubscriptionAuth(env: Record<string, string | undefined>): string[] {
  if (env.AGENT_GATEWAY_SUBSCRIPTION_AUTH !== "1") return [];
  const removed: string[] = [];
  for (const key of API_CREDENTIAL_ENV_VARS) {
    if (env[key] !== undefined) {
      delete env[key];
      removed.push(key);
    }
  }
  return removed;
}

// Side effect all'import: è il punto dell'intero modulo.
applySubscriptionAuth(process.env);
