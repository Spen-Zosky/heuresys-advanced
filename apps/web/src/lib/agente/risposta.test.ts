import { describe, expect, it } from "vitest";
import { domandaDaPrompt, nomeStrumento, righeDaMessaggio, titoloLeggibile } from "./risposta";

describe("righeDaMessaggio: della risposta si vede il testo, non lo stream dell'SDK", () => {
  it("il testo dell'assistente diventa una riga leggibile", () => {
    const d = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Partecipi a 2 processi." }] } });
    expect(righeDaMessaggio(d)).toEqual([{ kind: "message", text: "Partecipi a 2 processi." }]);
  });

  it("uno strumento si mostra col nome senza prefisso", () => {
    const d = JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "mcp__heuresys__hrx_concepts_search" }] } });
    expect(righeDaMessaggio(d)).toEqual([{ kind: "tool", text: "hrx_concepts_search" }]);
  });

  it("system, rate limit, token di pensiero e risultati degli strumenti non si mostrano", () => {
    for (const ev of [
      { type: "system", subtype: "init", tools: ["Bash", "Write"] },
      { type: "rate_limit_event", rate_limit_info: {} },
      { type: "system", subtype: "thinking_tokens", estimated_tokens: 50 },
      { type: "user", message: { content: [{ type: "tool_result" }] } },
    ]) {
      expect(righeDaMessaggio(JSON.stringify(ev))).toEqual([]);
    }
  });

  it("un JSON rotto o un blocco di testo vuoto non producono niente", () => {
    expect(righeDaMessaggio("{rotto")).toEqual([]);
    expect(righeDaMessaggio(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "  " }] } }))).toEqual([]);
  });
});

describe("domanda e titolo senza il contesto della pagina", () => {
  it("toglie la riga di contesto davanti alla domanda", () => {
    expect(domandaDaPrompt("Contesto: Pagina «Heuresys» (/me)\n\na quali processi partecipo?")).toBe("a quali processi partecipo?");
    expect(domandaDaPrompt("una domanda sola")).toBe("una domanda sola");
  });

  it("riconosce il titolo salvato con il contesto davanti", () => {
    expect(titoloLeggibile("Contesto: Pagina «Heuresys» (/me/skills) quanti anni ha valentina?")).toBe("quanti anni ha valentina?");
    expect(titoloLeggibile("Titolo normale")).toBe("Titolo normale");
  });

  it("nomeStrumento", () => {
    expect(nomeStrumento("mcp__heuresys__x_y")).toBe("x_y");
    expect(nomeStrumento("ToolSearch")).toBe("ToolSearch");
  });
});
