/**
 * apps/web/src/lib/agente/conversazioni.ts — ADR-0056 D4, piano dei principi agentici T6c.
 *
 * Le conversazioni dell'assistente lette dall'API (`/v1/agent-conversations`, modulo della T6a),
 * con la sessione della persona: è ciò che la finestra ritrova quando si riapre. Solo letture:
 * le scritture le fa il gateway con il gettone d'agente, e le decisioni sulle proposte passano
 * dal gateway (`/agent/approve`), che le registra qui prima di sbloccare il giro.
 *
 * Funzioni pure accanto alle letture, perché sono la parte che può sbagliare in silenzio:
 * quale proposta mostrare per prima e come riconoscere un'attività ancora aperta.
 */
import {
  AgentActivityEventsResponseSchema,
  AgentConversationListResponseSchema,
  AgentConversationSchema,
  type AgentActivity,
  type AgentActivityEventsResponse,
  type AgentConversation,
  type AgentConversationSummary,
  type AgentProposal,
} from "@heuresys/shared/schemas/agent-conversations";
import { apiFetch } from "../api/fetch";

export async function elencoConversazioni(): Promise<AgentConversationSummary[]> {
  const r = await apiFetch<{ items: AgentConversationSummary[] }>("/v1/agent-conversations", {
    schema: AgentConversationListResponseSchema,
  });
  return r.items;
}

export async function leggiConversazione(id: string): Promise<AgentConversation> {
  return apiFetch<AgentConversation>(`/v1/agent-conversations/${encodeURIComponent(id)}`, {
    schema: AgentConversationSchema,
  });
}

export async function leggiAttivita(activityId: string, after = 0): Promise<AgentActivityEventsResponse> {
  return apiFetch<AgentActivityEventsResponse>(
    `/v1/agent-conversations/activities/${encodeURIComponent(activityId)}/events?after=${after}`,
    { schema: AgentActivityEventsResponseSchema },
  );
}

/** Aperta = il giro non è finito: è in corso o aspetta la persona. */
export function attivitaAperta(a: Pick<AgentActivity, "status">): boolean {
  return a.status === "IN_CORSO" || a.status === "IN_ATTESA";
}

/** L'ultima attività della conversazione (le attività arrivano in ordine di inizio). */
export function ultimaAttivita(c: Pick<AgentConversation, "activities">): AgentActivity | undefined {
  return c.activities.at(-1);
}

/**
 * La proposta da mostrare: la più vecchia ancora in attesa e non scaduta. Una scaduta si legge
 * `SCADUTA` dall'API e non si offre più: decidere una cosa che il giro ha già negato sarebbe
 * un'approvazione che non approva niente.
 */
export function propostaDaDecidere(proposte: readonly AgentProposal[]): AgentProposal | undefined {
  return proposte
    .filter((p) => p.status === "IN_ATTESA")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}
