/**
 * 000513 — un solo giro aperto per conversazione. Il gateway legge lo stato prima di aprire un giro,
 * ma due richieste nello stesso istante passano entrambe quella lettura: il posto lo tiene il
 * database, e il 409 dell'API deve diventare `ConversazioneOccupata` (409 CONVERSATION_BUSY alla
 * finestra), non un 502 «conversazione non salvata».
 */
import { describe, it, expect } from "vitest";
import { ConversazioneOccupata, RegistroConversazione } from "../src/conversazione.js";
import type { HeuresysClient } from "../src/heuresys-client.js";

const CONV = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function apiFinta(rispostaAttivita: () => unknown, attivitaLette: Array<{ status: string }> = []) {
  return {
    async call(method: string, path: string): Promise<unknown> {
      if (method === "GET" && path === `/agent-conversations/${CONV}`) {
        return { id: CONV, sdkSessionRef: "s1", personsSeen: [], activities: attivitaLette };
      }
      if (method === "POST" && path === `/agent-conversations/${CONV}/activities`) return rispostaAttivita();
      throw new Error(`${method} ${path} -> 500`);
    },
  } as unknown as HeuresysClient;
}

describe("000513 — la seconda apertura nello stesso istante", () => {
  it("il 409 dell'API diventa ConversazioneOccupata", async () => {
    const api = apiFinta(() => {
      throw new Error(`POST /agent-conversations/${CONV}/activities -> 409 (scrittura NON eseguita)`);
    });
    await expect(RegistroConversazione.apri(api, { conversationId: CONV, agentCode: "assistente-hr", prompt: "ciao" }))
      .rejects.toBeInstanceOf(ConversazioneOccupata);
  });

  it("un altro errore resta un errore (502 per la finestra), non un'occupazione", async () => {
    const api = apiFinta(() => {
      throw new Error(`POST /agent-conversations/${CONV}/activities -> 500`);
    });
    const e = await RegistroConversazione.apri(api, { conversationId: CONV, agentCode: "assistente-hr", prompt: "ciao" })
      .catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(ConversazioneOccupata);
  });

  it("libera, si apre il giro", async () => {
    const api = apiFinta(() => ({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }));
    const r = await RegistroConversazione.apri(api, { conversationId: CONV, agentCode: "assistente-hr", prompt: "ciao" });
    expect(r.attivitaId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});
