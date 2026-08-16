/**
 * apps/api/test/tenant-materialization-segnaposto.integration.test.ts
 * #198 Tenant Builder P3, T3 — i segnaposto parlano (E17).
 *
 * La regola è *«non indurre in confusione»*: una riga generata da un fascicolo non
 * deve poter essere scambiata per una persona vera. Finché il generatore pescava da
 * due liste di nomi propri italiani produceva «Marco Rossi» e «Giulia Bianchi» —
 * indistinguibili, in un elenco, da chi in azienda ci lavora davvero.
 *
 * Questo test è la traduzione MECCANICA di quella regola: senza, resta
 * un'intenzione. E i nomi contro cui confronta non sono ricopiati qui — si leggono
 * dalle persone reali del tenant di riferimento, così il giorno in cui qualcuno
 * reintroducesse un elenco di nomi propri il test se ne accorgerebbe da solo.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { getArchetype, archetypeUsers } from "../src/modules/tenant-materialization/blueprints.js";
import { pool, closePool } from "../src/db/client.js";

const CHIAVE = "RETAIL_BANK_REFERENCE";

let nomiVeri: Set<string>;

describe("segnaposto parlanti (P3/T3, E17)", () => {
  beforeAll(async () => {
    const { rows } = await pool.query<{ nome: string }>(
      `SELECT DISTINCT lower(user_first_name) AS nome
         FROM sys.sys_users
        WHERE user_first_name IS NOT NULL
          AND coalesce(user_type, '') <> 'GENERATED_INCUMBENT'`,
    );
    nomiVeri = new Set(rows.map((r) => r.nome));
  });

  afterAll(async () => {
    await closePool();
  });

  it("l'universo dei nomi reali non è vuoto — o il confronto non proverebbe nulla", () => {
    // Zero nomi reali renderebbe il caso seguente verde per vacuità: «nessun
    // segnaposto usa un nome vero» è banalmente soddisfatto se non ne esiste uno.
    expect(nomiVeri.size).toBeGreaterThan(0);
  });

  it("nessun segnaposto porta il nome proprio di una persona reale", () => {
    const utenti = archetypeUsers(getArchetype(CHIAVE)!);
    expect(utenti.length).toBeGreaterThan(0);

    const colpevoli = utenti
      .filter((u) => nomiVeri.has(u.firstName.toLowerCase().replace(/\s+\d+$/, "")))
      .map((u) => `${u.displayName} (${u.positionCode})`);

    expect(`segnaposto con un nome di persona reale: ${colpevoli.join(", ") || "nessuno"}`).toBe(
      "segnaposto con un nome di persona reale: nessuno",
    );
  });

  it("il segnaposto dice il posto: ruolo come nome, unità come cognome", () => {
    const a = getArchetype(CHIAVE)!;
    const unita = new Map(a.orgUnits.map((u) => [u.code, u.name]));
    const utenti = archetypeUsers(a);

    for (const p of a.positions) {
      const u = utenti.find((x) => x.positionCode === p.code)!;
      expect(`${p.code} → cognome`, `il cognome deve essere l'unità che contiene la posizione`).
        toBeDefined();
      expect(u.lastName).toBe(unita.get(p.orgUnitCode));
      // il nome contiene il ruolo, al netto della sede fra parentesi e dell'ordinale
      const ruolo = p.title.replace(/\s*\([^)]*\)\s*$/, "").trim();
      expect(u.firstName.replace(/\s+\d+$/, "")).toBe(ruolo);
    }
  });

  it("i gemelli sono TUTTI numerati, o nessuno lo è", () => {
    // E23 rende la coppia ripetuta il caso normale (tre casse = tre posizioni di
    // cassiere). Numerare dal secondo in poi suggerirebbe che il primo sia il
    // titolare e gli altri dei sostituti: non è così.
    const a = getArchetype(CHIAVE)!;
    const utenti = archetypeUsers(a);

    const perCoppia = new Map<string, string[]>();
    for (const u of utenti) {
      const k = `${u.firstName.replace(/\s+\d+$/, "")}·${u.lastName}`;
      perCoppia.set(k, [...(perCoppia.get(k) ?? []), u.firstName]);
    }
    const incoerenti = [...perCoppia.entries()]
      .filter(([, nomi]) => nomi.length > 1 && nomi.some((n) => !/\s\d+$/.test(n)))
      .map(([k, nomi]) => `${k}: [${nomi.join(" | ")}]`);

    expect(`coppie ripetute senza ordinale su tutti: ${incoerenti.join(", ") || "nessuna"}`).toBe(
      "coppie ripetute senza ordinale su tutti: nessuna",
    );
  });

  it("ogni segnaposto resta distinguibile dagli altri", () => {
    const utenti = archetypeUsers(getArchetype(CHIAVE)!);
    const visti = new Set(utenti.map((u) => u.displayName));
    expect(`nomi distinti: ${visti.size} su ${utenti.length}`).toBe(
      `nomi distinti: ${utenti.length} su ${utenti.length}`,
    );
  });

  /**
   * I due casi che seguono NON usano l'archetipo reale, e la ragione va detta:
   * `RETAIL_BANK_REFERENCE` non ha oggi due posizioni con lo stesso ruolo nella
   * stessa unità, quindi i controlli sui gemelli sopra passano **per vacuità** —
   * sono ciechi, non superati. E23 rende invece quel caso la norma («tante persone
   * segnaposto quante le posizioni contemplate»: tre casse = tre cassieri).
   *
   * Qui l'archetipo si costruisce apposta perché il ramo esista. Se domani
   * l'archetipo reale acquisisse dei gemelli, i controlli sopra smetterebbero di
   * essere ciechi da soli — questi restano comunque la rete.
   */
  const CON_GEMELLI = {
    key: "PROVA_GEMELLI",
    label: "Archetipo di prova — tre casse nella stessa filiale",
    orgUnits: [
      { code: "PG-HQ", name: "Sede", type: "HEADQUARTERS" as const, parentCode: null },
      { code: "PG-BR", name: "Filiale Centro", type: "BRANCH" as const, parentCode: "PG-HQ" },
    ],
    positions: [
      { code: "PG-C1", title: "Cassiere (Centro)", orgUnitCode: "PG-BR", criticality: "MEDIUM" as const, economicWeight: 0.3 },
      { code: "PG-C2", title: "Cassiere (Centro)", orgUnitCode: "PG-BR", criticality: "MEDIUM" as const, economicWeight: 0.3 },
      { code: "PG-C3", title: "Cassiere (Centro)", orgUnitCode: "PG-BR", criticality: "MEDIUM" as const, economicWeight: 0.3 },
      { code: "PG-DIR", title: "Direttore", orgUnitCode: "PG-HQ", criticality: "HIGH" as const, economicWeight: 0.8 },
    ],
    skills: [],
    kpis: [],
    processOwnership: [],
  };

  it("tre posizioni uguali nella stessa unità → tre segnaposto distinti, numerati TUTTI", () => {
    const utenti = archetypeUsers(CON_GEMELLI);
    const casse = utenti.filter((u) => u.positionCode.startsWith("PG-C"));

    expect(casse.map((u) => u.displayName).sort()).toEqual([
      "Cassiere 1 · Filiale Centro",
      "Cassiere 2 · Filiale Centro",
      "Cassiere 3 · Filiale Centro",
    ]);

    // e chi NON ha gemelli non prende l'ordinale: numerarlo sarebbe rumore
    const direttore = utenti.find((u) => u.positionCode === "PG-DIR")!;
    expect(direttore.displayName).toBe("Direttore · Sede");
  });

  it("nemmeno nel caso dei gemelli compare un nome proprio", () => {
    const utenti = archetypeUsers(CON_GEMELLI);
    const colpevoli = utenti
      .filter((u) => nomiVeri.has(u.firstName.toLowerCase().replace(/\s+\d+$/, "")))
      .map((u) => u.displayName);
    expect(`gemelli con un nome di persona reale: ${colpevoli.join(", ") || "nessuno"}`).toBe(
      "gemelli con un nome di persona reale: nessuno",
    );
  });
});
