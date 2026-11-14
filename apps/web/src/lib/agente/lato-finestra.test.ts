import { describe, expect, it } from "vitest";
import { latoDellaFinestra, latoVuoto } from "./lato-finestra";

describe("la colonna di destra della finestra (I2)", () => {
  it("raccoglie i comandi con il loro esito, le letture senza doppioni e la proposta", () => {
    const l = latoDellaFinestra(
      [
        { id: 1, kind: "prompt", text: "filtra" },
        { id: 2, kind: "tool", text: "hrx_positions_list" },
        { id: 3, kind: "page_command", text: "tabella.cerca → ok: 12 righe" },
        { id: 4, kind: "tool", text: "hrx_positions_list" },
        { id: 5, kind: "page_command", text: "fascicolo.decidi → rifiutata: Il fascicolo non ha il processo «X»." },
        { id: 6, kind: "page_command", text: "tabella.ordina → ok" },
        { id: 7, kind: "message", text: "Fatto." },
      ],
      "hrx_kpi_defs_update",
    );
    expect(l.comandi).toEqual([
      { nome: "tabella.cerca", esito: "ok", dettaglio: "12 righe" },
      { nome: "fascicolo.decidi", esito: "rifiutata", dettaglio: "Il fascicolo non ha il processo «X»." },
      { nome: "tabella.ordina", esito: "ok", dettaglio: null },
    ]);
    expect(l.letture).toEqual(["hrx_positions_list"]);
    expect(l.proposta).toBe("hrx_kpi_defs_update");
    expect(latoVuoto(l)).toBe(false);
  });

  it("senza eventi la colonna è vuota, e una riga storta non diventa un comando", () => {
    const l = latoDellaFinestra([{ id: 1, kind: "page_command", text: "senza freccia" }], null);
    expect(l.comandi).toEqual([]);
    expect(latoVuoto(l)).toBe(true);
  });
});
