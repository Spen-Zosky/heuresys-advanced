/**
 * apps/api/test/blueprint-build-source.integration.test.ts
 * IL MODELLO SI LEGGE DAL DATABASE (#132 F2, E29 — S1072).
 *
 * Cosa prova, in una frase: che `BlueprintBuildSource` produce un `BuildPlan` **costruibile**
 * a partire dalle cinque tabelle `sys.sys_blueprint_content_*`, e che quando il contenuto non
 * è costruibile **si rifiuta di produrne uno** invece di produrne uno mutilato.
 *
 * ⚠ IL CASO CHE CONTA DI PIÙ È IL TERZO, e il piano di `#132` lo dice per esteso: «un
 * fascicolo senza modello non deve costruire *zero righe con successo*: deve rifiutarsi. Uno
 * zero silenzioso qui è il difetto peggiore, perché somiglia a un successo.» Un'azienda
 * costruita a zero righe e un atto riuscito sono, per chi guarda, la stessa cosa.
 *
 * I DATI SONO SEMINATI QUI E ANNULLATI CON UN ROLLBACK. Tutto gira dentro **una** transazione
 * su un client dedicato, che è anche il connettore passato alla sorgente: la sorgente vede
 * ciò che il test ha appena scritto, e alla fine non resta niente. Nessun `COMMIT` — e non è
 * un dettaglio: su questo progetto un seed con un `COMMIT` interno ha già battuto un
 * `ROLLBACK` esterno, e il database della CI ci ha perso 130 righe.
 *
 * ⚠ IL MODELLO SEMINATO NON È UNA BANCA, ed è deliberato. È un'azienda manifatturiera con
 * uno stabilimento e un magazzino (`PLANT`, `WAREHOUSE`): due tipi di unità che fino a
 * S1072 il piano **non sapeva nominare**, perché `OrgUnitType` enumerava i sei tipi
 * dell'archetipo bancario. Se qualcuno li richiudesse in un'unione, questo test diventerebbe
 * rosso — che è esattamente il senso di E29.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { closePool, pool } from "../src/db/client.js";
import {
  BLUEPRINT_CONTENT_KEY,
  BlueprintBuildSource,
  resolveBuildSource,
} from "../src/modules/tenant-materialization/blueprint-build-source.js";
import { ArchetypeBuildSource } from "../src/modules/tenant-materialization/build-source.js";

let client: PoolClient;

/** La versione di variante popolata: il caso buono. */
let versioneBuona: string;
/** Una versione di variante senza nemmeno una riga di contenuto. */
let versioneVuota: string;

/** Crea famiglia + variante + versione e ne restituisce l'id della versione. */
async function creaVersione(suffisso: string): Promise<string> {
  const f = await client.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name)
     VALUES ($1, $2) RETURNING blueprint_family_id AS id`,
    [`F2PROVA-${suffisso}`, `Prova F2 ${suffisso}`],
  );
  const v = await client.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_variants
       (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name)
     VALUES ($1, $2, $3) RETURNING blueprint_variant_id AS id`,
    [f.rows[0]!.id, `VAR-${suffisso}`, `Variante ${suffisso}`],
  );
  // ⚠ La versione 1 NON si inserisce: la crea gia' il trigger
  //   `sys_blueprint_variant_ensure_version` quando nasce la variante. Inserirla a mano
  //   viola `sys_blueprint_variant_versions_number_uq` — scoperto eseguendo, non leggendo.
  //   Qui si dichiara soltanto da dove nasce il suo contenuto.
  const vv = await client.query<{ id: string }>(
    `UPDATE sys.sys_blueprint_variant_versions
        SET blueprint_variant_version_build_source_key = $2
      WHERE blueprint_variant_version_variant_id = $1
        AND blueprint_variant_version_number = 1
      RETURNING blueprint_variant_version_id AS id`,
    [v.rows[0]!.id, BLUEPRINT_CONTENT_KEY],
  );
  if (!vv.rows[0]) throw new Error("il trigger non ha creato la versione 1 della variante");
  return vv.rows[0].id;
}

async function unita(
  versione: string,
  code: string,
  name: string,
  tipo: string,
  padre: string | null,
  livello = 0,
): Promise<void> {
  await client.query(
    `INSERT INTO sys.sys_blueprint_content_units
       (blueprint_content_unit_version_id, blueprint_content_unit_code, blueprint_content_unit_name,
        blueprint_content_unit_type, blueprint_content_unit_parent_code, blueprint_content_unit_level)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [versione, code, name, tipo, padre, livello],
  );
}

describe("BlueprintBuildSource — il modello si legge dal database (#132 F2)", () => {
  beforeAll(async () => {
    client = await pool.connect();
    await client.query("BEGIN");

    versioneBuona = await creaVersione("BUONA");
    versioneVuota = await creaVersione("VUOTA");

    // ⚠ L'ORDINE DI INSERIMENTO È DELIBERATAMENTE SBAGLIATO: i figli prima dei padri, e il
    //   `level` messo tutto a zero perché nemmeno l'`ORDER BY` della query possa salvare la
    //   situazione. Se `plan()` non ordinasse topologicamente, il magazzino uscirebbe prima
    //   dello stabilimento che lo contiene, e `materialize` lo attaccherebbe alla radice
    //   senza dire niente. È il difetto ① di `blueprint-build-source.ts`.
    await unita(versioneBuona, "MAG", "Magazzino centrale", "WAREHOUSE", "STAB");
    await unita(versioneBuona, "LIN-2", "Linea 2", "TEAM", "STAB");
    await unita(versioneBuona, "STAB", "Stabilimento di Brescia", "PLANT", "DG");
    await unita(versioneBuona, "DG", "Direzione generale", "GENERAL_MANAGEMENT", null);

    await client.query(
      `INSERT INTO sys.sys_blueprint_content_positions
         (blueprint_content_position_version_id, blueprint_content_position_code,
          blueprint_content_position_title, blueprint_content_position_unit_code,
          blueprint_content_position_criticality, blueprint_content_position_economic_weight,
          blueprint_content_position_metadata)
       VALUES ($1,'POS-DG','Direttore generale','DG','CRITICAL',0.900,'{}'::jsonb),
              ($1,'POS-CAPO','Capo stabilimento','STAB','HIGH',0.600,
               jsonb_build_object('justification','proposta APP-77 approvata il 2026-08-19: ogni stabilimento ha un responsabile'))`,
      [versioneBuona],
    );

    await client.query(
      `INSERT INTO sys.sys_blueprint_content_skills
         (blueprint_content_skill_version_id, blueprint_content_skill_code,
          blueprint_content_skill_name, blueprint_content_skill_kind, blueprint_content_skill_category)
       VALUES ($1,'SK-LEAN','Lean manufacturing','KNOWLEDGE','TECHNICAL'),
              ($1,'SK-SICU','Sicurezza sul lavoro','BEHAVIOR','SOFT')`,
      [versioneBuona],
    );

    await client.query(
      `INSERT INTO sys.sys_blueprint_content_kpis
         (blueprint_content_kpi_version_id, blueprint_content_kpi_code, blueprint_content_kpi_name,
          blueprint_content_kpi_unit, blueprint_content_kpi_direction)
       VALUES ($1,'KPI-OEE','Efficienza degli impianti','%','HIGHER_IS_BETTER'),
              ($1,'KPI-SCAR','Scarti di produzione','%','LOWER_IS_BETTER')`,
      [versioneBuona],
    );
  });

  afterAll(async () => {
    await client.query("ROLLBACK");
    client.release();
    await closePool();
  });

  it("legge il contenuto della versione e ne fa un piano", async () => {
    const piano = await new BlueprintBuildSource(client, versioneBuona).plan();

    expect(piano.sourceKey).toBe(BLUEPRINT_CONTENT_KEY);
    expect(piano.label).toBe("F2PROVA-BUONA/VAR-BUONA v1");
    expect(piano.orgUnits).toHaveLength(4);
    expect(piano.positions).toHaveLength(2);
    expect(piano.skills).toHaveLength(2);
    expect(piano.kpis).toHaveLength(2);
  });

  it("un modello NON porta persone: il piano non inventa titolari", async () => {
    // Se un giorno qualcuno rimettesse dei segnaposto sintetici, ogni azienda costruita
    // tornerebbe a nascere con lo stesso organico fittizio — la forma di difetto che E29
    // chiede di togliere, con un altro nome.
    const piano = await new BlueprintBuildSource(client, versioneBuona).plan();
    expect(piano.incumbents).toEqual([]);
  });

  it("⭐ le unità escono PADRI PRIMA DEI FIGLI, anche se il database le dà al contrario", async () => {
    const piano = await new BlueprintBuildSource(client, versioneBuona).plan();
    const posizione = new Map(piano.orgUnits.map((u, i) => [u.code, i]));

    // Il criterio è quello che `materialize` usa davvero: quando arriva il turno di un'unità,
    // il suo padre dev'essere già passato — altrimenti `codeToId.get()` non lo trova.
    for (const u of piano.orgUnits) {
      if (u.parentCode) {
        expect(posizione.get(u.parentCode)).toBeLessThan(posizione.get(u.code)!);
      }
    }
    expect(piano.orgUnits[0]!.code).toBe("DG"); // la radice, che era stata inserita per ultima
  });

  it("i tipi di un'azienda manifatturiera sono esprimibili (PLANT, WAREHOUSE)", async () => {
    const piano = await new BlueprintBuildSource(client, versioneBuona).plan();
    const tipi = piano.orgUnits.map((u) => u.type);
    expect(tipi).toContain("PLANT");
    expect(tipi).toContain("WAREHOUSE");
    expect(tipi).toContain("GENERAL_MANAGEMENT");
  });

  it("la ragione dichiarata nel metadata vince sulla ragione generica", async () => {
    const piano = await new BlueprintBuildSource(client, versioneBuona).plan();
    const capo = piano.positions.find((p) => p.code === "POS-CAPO")!;
    const dg = piano.positions.find((p) => p.code === "POS-DG")!;

    // È la catena che `F4`/`F6` completeranno: la giustificazione di una riga sarà la
    // proposta approvata che l'ha generata.
    expect(capo.justification).toContain("proposta APP-77");
    // Senza `justification` nel metadata non se ne finge una: si dice da dove viene la riga.
    expect(dg.justification).toBe("F2PROVA-BUONA/VAR-BUONA v1: posizione del modello, in DG");
  });

  describe("ciò che NON è costruibile viene rifiutato, non costruito a metà", () => {
    it("⭐ un modello vuoto si rifiuta invece di costruire zero righe «con successo»", async () => {
      await expect(new BlueprintBuildSource(client, versioneVuota).plan()).rejects.toThrow(
        /non ha contenuto/i,
      );
    });

    it("una versione che non esiste si rifiuta", async () => {
      const inesistente = "00000000-0000-0000-0000-000000000000";
      await expect(new BlueprintBuildSource(client, inesistente).plan()).rejects.toThrow(
        /non esiste/i,
      );
    });

    it("un padre che non esiste ferma il piano, e dice quale", async () => {
      await client.query("SAVEPOINT prova");
      try {
        const v = await creaVersione("ORFANA");
        await unita(v, "RADICE", "Radice", "HEADQUARTERS", null);
        await unita(v, "FIGLIA", "Figlia", "TEAM", "PADRE-CHE-NON-CE");
        await expect(new BlueprintBuildSource(client, v).plan()).rejects.toThrow(
          /padre inesistente: FIGLIA→PADRE-CHE-NON-CE/,
        );
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT prova");
      }
    });

    it("un ciclo A→B→A ferma il piano — il CHECK del database non lo vede", async () => {
      await client.query("SAVEPOINT prova");
      try {
        const v = await creaVersione("CICLO");
        await unita(v, "RADICE", "Radice", "HEADQUARTERS", null);
        await unita(v, "A", "A", "DIVISION", "B");
        await unita(v, "B", "B", "DIVISION", "A");
        // Il vincolo `..._non_se_stessa_ck` impedisce solo `A → A`: queste due righe lo
        // attraversano indisturbate, ed è la ragione per cui il controllo sta nel codice.
        await expect(new BlueprintBuildSource(client, v).plan()).rejects.toThrow(/ciclo fra: A, B/);
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT prova");
      }
    });

    it("una posizione in un'unità che non esiste ferma il piano", async () => {
      await client.query("SAVEPOINT prova");
      try {
        const v = await creaVersione("POSFUORI");
        await unita(v, "RADICE", "Radice", "HEADQUARTERS", null);
        await client.query(
          `INSERT INTO sys.sys_blueprint_content_positions
             (blueprint_content_position_version_id, blueprint_content_position_code,
              blueprint_content_position_title, blueprint_content_position_unit_code)
           VALUES ($1,'POS-X','Posizione senza casa','UNITA-CHE-NON-CE')`,
          [v],
        );
        await expect(new BlueprintBuildSource(client, v).plan()).rejects.toThrow(
          /POS-X→UNITA-CHE-NON-CE/,
        );
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT prova");
      }
    });

    it("una competenza senza categoria ferma il piano (il difetto T9a, già pagato una volta)", async () => {
      await client.query("SAVEPOINT prova");
      try {
        const v = await creaVersione("SENZACAT");
        await unita(v, "RADICE", "Radice", "HEADQUARTERS", null);
        await client.query(
          `INSERT INTO sys.sys_blueprint_content_skills
             (blueprint_content_skill_version_id, blueprint_content_skill_code,
              blueprint_content_skill_name, blueprint_content_skill_kind)
           VALUES ($1,'SK-NUDA','Competenza senza categoria','SKILL')`,
          [v],
        );
        await expect(new BlueprintBuildSource(client, v).plan()).rejects.toThrow(
          /SK-NUDA.*deploy successivo|senza categoria/s,
        );
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT prova");
      }
    });

    it("un tipo di unità che il catalogo non conosce ferma il piano PRIMA di costruire", async () => {
      await client.query("SAVEPOINT prova");
      try {
        const v = await creaVersione("TIPOIGNOTO");
        await unita(v, "RADICE", "Radice", "ASTRONAVE", null);
        await expect(new BlueprintBuildSource(client, v).plan()).rejects.toThrow(
          /tipi di unità che il catalogo non conosce: ASTRONAVE/,
        );
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT prova");
      }
    });
  });

  describe("resolveBuildSource — l'unico posto in cui una chiave diventa un modo di costruire", () => {
    it("la chiave del contenuto dà la sorgente che legge il database", () => {
      const s = resolveBuildSource(client, BLUEPRINT_CONTENT_KEY, versioneBuona);
      expect(s).toBeInstanceOf(BlueprintBuildSource);
      expect(s!.key).toBe(BLUEPRINT_CONTENT_KEY);
    });

    it("senza una versione ancorata la sorgente del contenuto non è istanziabile", () => {
      // Non è un dettaglio: senza versione non c'è contenuto da leggere, e un oggetto che
      // «sembra» una sorgente fallirebbe più tardi, dopo la firma.
      expect(resolveBuildSource(client, BLUEPRINT_CONTENT_KEY, null)).toBeUndefined();
    });

    it("finché l'archetipo esiste, la sua chiave continua a risolversi (F3 lo ritirerà)", () => {
      const s = resolveBuildSource(client, "RETAIL_BANK_REFERENCE", versioneBuona);
      expect(s).toBeInstanceOf(ArchetypeBuildSource);
    });

    it("una chiave ignota non ripiega su niente", () => {
      expect(resolveBuildSource(client, "CHIAVE_INVENTATA", versioneBuona)).toBeUndefined();
    });
  });
});
