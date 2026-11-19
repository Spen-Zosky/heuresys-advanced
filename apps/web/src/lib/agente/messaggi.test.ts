import { describe, expect, it } from "vitest";
import { csvDa, fase, messaggiDaRighe, riepilogoProposta, tsvDa } from "./messaggi";

const r = (id: number, kind: string, text: string) => ({ id, kind, text });

describe("messaggiDaRighe", () => {
  it("domanda e risposta; gli strumenti e i comandi della pagina non diventano messaggi", () => {
    const m = messaggiDaRighe([
      r(1, "prompt", "Quante unità?"),
      r(2, "tool", "hrx_org_units_list"),
      r(3, "page_command", "filtra → ok"),
      r(4, "message", "Sono **42**."),
      r(5, "message", "| a | b |\n|---|---|\n| 1 | 2 |"),
      r(6, "done", "{}"),
    ]);
    expect(m.map((x) => x.ruolo)).toEqual(["persona", "assistente"]);
    expect(m[1]?.testo).toBe("Sono **42**.\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(JSON.stringify(m)).not.toContain("hrx_");
  });

  it("il rifiuto prende il posto della risposta di quella domanda, non delle precedenti", () => {
    const m = messaggiDaRighe([
      r(1, "prompt", "prima"),
      r(2, "message", "risposta uno"),
      r(3, "prompt", "stipendi di tutti?"),
      r(4, "message", "Non posso leggere…"),
      r(5, "rifiuto", "Non hai le autorizzazioni necessarie."),
    ]);
    expect(m.map((x) => x.testo)).toEqual(["prima", "risposta uno", "stipendi di tutti?", "Non hai le autorizzazioni necessarie."]);
    expect(m[3]?.rifiuto).toBe(true);
  });

  it("errori e limiti sono avvisi, senza testo tecnico", () => {
    const m = messaggiDaRighe([r(1, "prompt", "x"), r(2, "error", '{"message":"boom"}'), r(3, "limit", '{"limite":"DURATA"}')]);
    expect(m.slice(1)).toEqual([
      { id: 2, ruolo: "avviso", testo: "errore" },
      { id: 3, ruolo: "avviso", testo: "limite" },
    ]);
  });
});

describe("fase", () => {
  it("dice consulta, scrive o pensa dall'ultima riga utile", () => {
    expect(fase([r(1, "prompt", "x")])).toBe("pensa");
    expect(fase([r(1, "prompt", "x"), r(2, "tool", "t")])).toBe("consulta");
    expect(fase([r(1, "prompt", "x"), r(2, "tool", "t"), r(3, "message", "y")])).toBe("scrive");
  });
});

describe("csvDa e tsvDa", () => {
  it("CSV con «;» e virgolette solo dove servono", () => {
    expect(csvDa([["Nome", "Nota"], ["Rossi, Mario", 'dice "sì"; poi']])).toBe('Nome;Nota\r\nRossi, Mario;"dice ""sì""; poi"');
  });
  it("TSV senza tabulazioni o a capo dentro le celle", () => {
    expect(tsvDa([["a\tb", "c\nd"]])).toBe("a b\tc d");
  });
  it("una cella che sembra una formula non si esegue; i numeri restano numeri", () => {
    expect(csvDa([["=HYPERLINK(\"x\")", "+1+1", "@SUM(A1)", "-12,5", "42"]])).toBe('"\'=HYPERLINK(""x"")";\'+1+1;\'@SUM(A1);-12,5;42');
    expect(tsvDa([["=1+1"]])).toBe("'=1+1");
  });
});

describe("riepilogoProposta", () => {
  it("dice l'azione, l'oggetto e i campi che la scrittura cambierebbe", () => {
    const r = riepilogoProposta("mcp__heuresys__hrx_positions_upsert", { id: "p1", payload: { title: "Analista", headcount: 2 } });
    expect(r).toEqual({
      azione: "crea-aggiorna",
      oggetto: "positions",
      campi: [
        { nome: "id", valore: "p1" },
        { nome: "title", valore: "Analista" },
        { nome: "headcount", valore: "2" },
      ],
    });
    expect(riepilogoProposta("hrx_org_units_delete", { id: "u1" }).azione).toBe("elimina");
  });
});
