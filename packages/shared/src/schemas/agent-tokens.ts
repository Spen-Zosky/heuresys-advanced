/**
 * packages/shared/src/schemas/agent-tokens.ts — piano interfacce L9, voci A-1, A-2, A-3
 * (ADR-0050 D6, ADR-0040).
 *
 * Il GETTONE DELL'AGENTE: una persona con una sessione viva lo chiede per un agente e un
 * compito, e l'agente lo usa al posto dei cookie della persona.
 *  - A-1: l'API sa che chi chiama è un agente, quale, per quale compito e per conto di chi;
 *    il registro delle scritture li conserva tutti e due.
 *  - A-2: il perimetro è al più quello della persona SENZA mandati (D6) e si restringe per
 *    compito con un elenco di permessi.
 *  - A-3: dura pochi minuti e non si rinnova: scaduto, si ripassa dalla persona.
 */
import { z } from "zod";

/** Durata del gettone, in secondi: nessun rinnovo, alla scadenza si ripassa dalla persona. */
export const AGENT_TOKEN_TTL_SECONDS = 600;

/** Il codice di un agente, come nell'intestazione `x-heuresys-superficie: agente:<codice>`. */
export const AGENT_CODE_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export const CreateAgentTokenBodySchema = z
  .object({
    agentCode: z.string().regex(AGENT_CODE_RE),
    /** Il compito, in parole: finisce nel registro di ogni scrittura dell'agente. */
    task: z.string().trim().min(3).max(200),
    /** A-2: i soli permessi che servono al compito. Assente = tutti quelli della persona senza mandati. */
    permissions: z.array(z.string().min(3).max(100)).min(1).max(64).optional(),
  })
  .strict();
export type CreateAgentTokenBody = z.infer<typeof CreateAgentTokenBodySchema>;

export const AgentTokenResponseSchema = z.object({
  /** Il token firmato: l'agente lo presenta nel cookie di accesso al posto di quello della persona. */
  token: z.string(),
  expiresAt: z.string(),
  agentCode: z.string(),
  task: z.string(),
  /** I permessi del gettone (null = tutti quelli dei ruoli del gettone). */
  permissions: z.array(z.string()).nullable(),
  /** I ruoli che il gettone porta: quelli della persona senza i mandati (ADR-0050 D6). */
  roles: z.array(z.string()),
});
export type AgentTokenResponse = z.infer<typeof AgentTokenResponseSchema>;

/** Codici d'errore del gettone. */
export const AGENT_TOKEN_ERRORS = {
  /** Un gettone d'agente non chiede un altro gettone, né tocca l'autenticazione. */
  AGENT_FORBIDDEN_AUTH: "AGENT_FORBIDDEN_AUTH",
  /** Un permesso chiesto che la persona, senza mandati, non ha. */
  AGENT_SCOPE_EXCEEDS_PERSON: "AGENT_SCOPE_EXCEEDS_PERSON",
  /** Tolti i mandati, alla persona non resta nessun ruolo da prestare. */
  AGENT_NO_ROLES: "AGENT_NO_ROLES",
  /** Serve una sessione piena della persona (non di sola iscrizione, non scaduta). */
  AGENT_SESSION_REQUIRED: "AGENT_SESSION_REQUIRED",
} as const;
