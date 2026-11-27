/**
 * F3c — le stime dalla storia di RTL Bank (tenant dimostrativo con storia generata).
 *
 * Le asserzioni non fissano i numeri, che cambiano quando la storia avanza: provano che
 * ogni stima esce con la sua banda, passa lo schema delle ipotesi del motore degli
 * scenari, cita la storia come fonte e dichiara che la storia è generata, e che la prova
 * sul periodo tenuto da parte si fa sugli ultimi quattro trimestri interi.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { ScenarioAssumptionSchema } from "@heuresys/shared";
import { pool } from "../src/db/client.js";
import { stimeDallaStoria, type StimeDallaStoria } from "../src/modules/insights/stime.js";
import { DICHIARAZIONE_STORIA_GENERATA } from "../src/modules/insights/probabilita.js";
import { leggiDurateSelezione } from "../src/modules/insights/storia-repository.js";

let esito: StimeDallaStoria;

beforeAll(async () => {
  const t = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`);
  if (!t.rows[0]) throw new Error("il tenant RTL_BANK non c'è: il caso da provare non c'è");
  esito = await stimeDallaStoria(pool, t.rows[0].tenant_id);
});

describe("F3c — stime dalla storia di RTL", () => {
  it("riconosce che la storia di RTL è generata", () => {
    expect(esito.storiaGenerata).toBe(true);
  });

  it("ogni ipotesi è una STIMA valida per il motore, con banda, fonte STORIA e dichiarazione", () => {
    const presenti = esito.stime.filter((s) => s.ipotesi !== null);
    expect(presenti.length).toBeGreaterThanOrEqual(4);
    for (const { ipotesi } of presenti) {
      const { dettaglio, ...riga } = ipotesi!;
      const parsed = ScenarioAssumptionSchema.safeParse({
        ...riga,
        id: "00000000-0000-4000-8000-000000000001",
        optionId: null,
        sources: riga.sources.map((s, i) => ({ ...s, id: `00000000-0000-4000-8000-00000000002${i}` })),
      });
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(riga.low).toBeLessThanOrEqual(riga.value);
      expect(riga.value).toBeLessThanOrEqual(riga.high);
      expect(riga.sources.every((s) => s.kind === "STORIA")).toBe(true);
      expect(riga.statement).toContain(DICHIARAZIONE_STORIA_GENERATA);
      expect(dettaglio.casi).toBeGreaterThan(0);
    }
  });

  it("stima le uscite su dodici mesi e dichiara quando la storia non ne ha", () => {
    const u = esito.stime.find((s) => s.codice === "uscita_12_mesi");
    expect(u?.ipotesi).not.toBeNull();
    if (u!.senzaEventi) expect(u!.nota).toMatch(/limite superiore/);
  });

  it("stima i tempi di selezione dalle selezioni concluse, o dice quante ne mancano", async () => {
    // Le selezioni concluse dipendono dalla copia del database: si contano qui, con la
    // stessa lettura della stima, e l'esito deve essere coerente con il conteggio.
    const t = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`);
    const concluse = (await leggiDurateSelezione(pool, t.rows[0]!.tenant_id)).length;
    const m = esito.stime.find((s) => s.codice === "selezione_giorni_mediana");
    expect(m).toBeDefined();
    if (concluse >= 2) {
      expect(m!.ipotesi?.unit).toBe("giorni");
      expect(m!.ipotesi!.dettaglio.casi).toBe(concluse);
    } else {
      expect(m!.ipotesi).toBeNull();
      expect(m!.senzaEventi).toBe(concluse === 0);
      expect(m!.nota).toBe(`selezioni concluse: ${concluse}, ne servono almeno due`);
    }
  });

  it("fa la prova sugli ultimi quattro trimestri tenuti da parte", () => {
    expect(esito.provaUscite).not.toBeNull();
    expect(esito.provaUscite!.trimestriProva).toBe(4);
    expect(esito.provaUscite!.previste.low).toBeLessThanOrEqual(esito.provaUscite!.previste.high);
  });
});
