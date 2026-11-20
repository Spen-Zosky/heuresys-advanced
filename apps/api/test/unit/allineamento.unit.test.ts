/**
 * apps/api/test/unit/allineamento.unit.test.ts — la scheda «Allineamento» (piano 20261118), senza database.
 *
 * La chiave di una voce resta la stessa fra due misure se dominio, lato e nomi non cambiano; due voci identiche
 * hanno chiavi diverse; la proposta segue il lato; un doppione del tenant si propone di toglierlo solo nei
 * cataloghi; i ruoli di accesso restano del tenant; le decisioni registrate si attaccano alla loro voce e quelle
 * senza voce si contano come superate; una bozza si controlla contro la misura di oggi.
 */
import { describe, expect, it } from "vitest";
import { ALIGNMENT_FAMILIES, DISTANCE_DOMAIN_VALUES } from "@heuresys/shared";
import {
  chiaveDi,
  componiAllineamento,
  controllaBozza,
  vociDelDominio,
} from "../../src/modules/tenant-consolidation/allineamento.js";
import type { MisuraDistanza, MisuraDominio, RigaDistanza } from "../../src/modules/tenant-consolidation/distanza.js";

function dominio(d: MisuraDominio["dominio"], righe: RigaDistanza[]): MisuraDominio {
  const n = (e: RigaDistanza["esito"]) => righe.filter((r) => r.esito === e).length;
  return {
    dominio: d, righe: righe.length, uguali: n("uguale"), parziali: n("parziale"), diversi: n("diverso"),
    solo_modello: n("solo_modello"), solo_tenant: n("solo_tenant"), ricchezza_persa: 0, nota: "", dettaglio: righe,
  };
}

describe("allineamento: chiavi e proposte", () => {
  it("le famiglie coprono i 24 domini, ciascuno una volta", () => {
    const tutti = ALIGNMENT_FAMILIES.flatMap((f) => f.domini);
    expect([...tutti].sort()).toEqual([...DISTANCE_DOMAIN_VALUES].sort());
  });

  it("la chiave non dipende da maiuscole e accenti, e cambia con il lato e la ricorrenza", () => {
    const a = chiaveDi("skill", "COPPIA", "Analisi del Credito", "analisi del credito", 0);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(chiaveDi("skill", "COPPIA", "ANALISI DEL CRÉDITO", "Analisi del credito", 0)).toBe(a);
    expect(chiaveDi("skill", "SOLO_MODELLO", "Analisi del Credito", null, 0)).not.toBe(a);
    expect(chiaveDi("skill", "COPPIA", "Analisi del Credito", "analisi del credito", 1)).not.toBe(a);
  });

  it("propone Unisco, Adotto, Tengo e Tolgo secondo il lato e i doppioni", () => {
    const v = vociDelDominio("skill", [
      { esito: "uguale", modello: "Cassa", tenant: "Cassa" },
      { esito: "parziale", modello: "Analisi credito", tenant: "Analisi del rischio di credito" },
      { esito: "solo_modello", modello: "Antiriciclaggio", tenant: null },
      { esito: "solo_tenant", modello: null, tenant: "Excel avanzato" },
      { esito: "solo_tenant", modello: null, tenant: "Negoziazione" },
      { esito: "solo_tenant", modello: null, tenant: "negoziazione" },
    ]);
    expect(v.map((x) => x.proposta)).toEqual([null, "UNISCO", "ADOTTO", "TENGO", "TOLGO", "TOLGO"]);
    expect(new Set(v.map((x) => x.chiave)).size).toBe(6);
  });

  it("fuori dai cataloghi lo stesso nome non è un doppione, e i ruoli di accesso restano del tenant", () => {
    const ruoli = vociDelDominio("ruoli", [
      { esito: "solo_tenant", modello: null, tenant: "Cassiere" },
      { esito: "solo_tenant", modello: null, tenant: "Cassiere" },
    ]);
    expect(ruoli.map((x) => x.proposta)).toEqual(["TENGO", "TENGO"]);
    expect(ruoli[0]!.chiave).not.toBe(ruoli[1]!.chiave);
    expect(vociDelDominio("ruoli_funzionali", [{ esito: "solo_tenant", modello: null, tenant: "Lettore" }])[0]!.proposta).toBe("TENGO");
  });
});

describe("allineamento: decisioni registrate", () => {
  const misura: MisuraDistanza = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    variantVersionId: "00000000-0000-4000-8000-000000000002",
    misurataIl: "2026-11-18T05:00:00.000Z",
    domini: [dominio("unita", [
      { esito: "uguale", modello: "Direzione Crediti", tenant: "Direzione Crediti" },
      { esito: "solo_modello", modello: "Compliance", tenant: null },
    ])],
    totale: { righe: 2, uguali: 1, parziali: 0, diversi: 0, solo_modello: 1, solo_tenant: 0, ricchezza_persa: 0 },
  };

  it("attacca le decisioni alla loro voce, conta bozze, approvate e superate", () => {
    const k = chiaveDi("unita", "SOLO_MODELLO", "Compliance", null, 0);
    const c = componiAllineamento(misura, [
      { dominio: "unita", chiave: k, bozza: "TOLGO", approvata: "ADOTTO", approvataIl: "2026-11-18T05:00:00.000Z" },
      { dominio: "unita", chiave: "f".repeat(32), bozza: null, approvata: "TENGO", approvataIl: "2026-11-17T05:00:00.000Z" },
    ]);
    const unita = c.domini[0]!;
    expect(unita.famiglia).toBe("organizzazione");
    expect(unita.copertura).toBe("GIRI");
    const riga = unita.righe_voci.find((r) => r.chiave === k)!;
    expect(riga).toMatchObject({ proposta: "ADOTTO", bozza: "TOLGO", approvata: "ADOTTO" });
    expect(c).toMatchObject({ bozze: 1, approvate: 2, superate: 1 });
  });

  it("una bozza vale solo su una voce di oggi, non uguale, con una decisione ammessa dal lato", () => {
    const c = componiAllineamento(misura, []);
    const uguale = c.domini[0]!.righe_voci[0]!;
    const sola = c.domini[0]!.righe_voci[1]!;
    expect(controllaBozza(c.domini, { dominio: "unita", chiave: sola.chiave, decisione: "ADOTTO" }).ok).toBe(true);
    expect(controllaBozza(c.domini, { dominio: "unita", chiave: sola.chiave, decisione: "UNISCO" }).ok).toBe(false);
    expect(controllaBozza(c.domini, { dominio: "unita", chiave: uguale.chiave, decisione: "UNISCO" }).ok).toBe(false);
    expect(controllaBozza(c.domini, { dominio: "unita", chiave: "0".repeat(32), decisione: "ADOTTO" }).ok).toBe(false);
  });
});
