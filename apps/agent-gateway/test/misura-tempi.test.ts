import { describe, expect, it } from "vitest";
import { mediana, tappe } from "../src/misura-tempi.js";

const msg = (content: unknown[]) => `data: ${JSON.stringify({ type: "assistant", message: { content } })}`;

describe("tappe di un giro (I6)", () => {
  it("riconosce primo byte, comando, strumento, testo e fine", () => {
    const t = tappe([
      { ms: 40, testo: `event: conversation\ndata: {"conversationId":"x"}` },
      { ms: 900, testo: `data: {"type":"system","subtype":"init"}` },
      { ms: 1500, testo: msg([{ type: "tool_use", name: "mcp__heuresys__hrx_x" }]) },
      { ms: 2100, testo: `event: page_command\ndata: {"commandId":"c","nome":"filtra"}` },
      { ms: 2600, testo: msg([{ type: "text", text: "Ecco." }, { type: "tool_use", name: "y" }]) },
      { ms: 3000, testo: `event: done\ndata: {}` },
    ]);
    expect(t).toEqual({
      primoByte: 40,
      primoComando: 2100,
      primoStrumento: 1500,
      primoTesto: 2600,
      fine: 3000,
      esito: "done",
      comandi: 1,
      strumenti: 2,
    });
  });

  it("un limite decide l'esito anche se dopo arriva done; un testo vuoto non conta", () => {
    const t = tappe([
      { ms: 10, testo: msg([{ type: "text", text: "   " }]) },
      { ms: 50, testo: `event: limit\ndata: {"limite":"DURATA"}` },
      { ms: 60, testo: `event: done\ndata: {}` },
    ]);
    expect(t.esito).toBe("limit");
    expect(t.fine).toBe(50);
    expect(t.primoTesto).toBeNull();
  });

  it("stream vuoto: niente tappe", () => {
    expect(tappe([]).primoByte).toBeNull();
    expect(tappe([]).esito).toBeNull();
  });

  it("mediana ignora i nulli", () => {
    expect(mediana([3, null, 1, 2])).toBe(2);
    expect(mediana([1, 4])).toBe(3);
    expect(mediana([null])).toBeNull();
  });
});
