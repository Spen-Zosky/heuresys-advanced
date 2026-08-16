/**
 * apps/api/test/tenant-materialization-processes.integration.test.ts
 * #198 Tenant Builder P3, T2 — l'archetipo dice chi presidia quale processo.
 *
 * Perché questo test esiste. Senza `processOwnership`, applicare un fascicolo non
 * produce nulla per lo strato dei processi — metà del fascicolo. Ma una
 * dichiarazione che cita codici sbagliati è peggio del nulla: costruisce
 * un'azienda i cui processi puntano a niente, e non se ne accorge nessuno finché
 * qualcuno non apre la pagina.
 *
 * Il difetto silenzioso di questo task è **il riferimento che non risolve**: un
 * `processCode` che il registro non ha, o un `orgUnitCode` che l'archetipo non
 * contiene. Nessuno dei due dà errore a compilazione — sono stringhe.
 *
 * Perciò i codici NON sono ricopiati qui: si leggono dal database (il registro dei
 * processi) e dall'archetipo stesso. Se qualcuno cambia il registro, questo test
 * diventa rosso invece di lasciare l'archetipo a puntare nel vuoto.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { getArchetype } from "../src/modules/tenant-materialization/blueprints.js";
import { pool, closePool } from "../src/db/client.js";

const CHIAVE = "RETAIL_BANK_REFERENCE";

let codiciDelRegistro: string[];

describe("archetipo — chi presidia quale processo (P3/T2)", () => {
  beforeAll(async () => {
    const { rows } = await pool.query<{ code: string }>(
      `SELECT DISTINCT blueprint_process_code AS code
         FROM sys.sys_blueprint_process_registry
        ORDER BY blueprint_process_code`,
    );
    codiciDelRegistro = rows.map((r) => r.code);
  });

  afterAll(async () => {
    await closePool();
  });

  it("l'universo non è vuoto — altrimenti tutto il resto sarebbe cieco", () => {
    // Zero processi nel registro renderebbe VERDI per vacuità i due casi che
    // seguono: «tutti i codici citati esistono» è banalmente vero se non se ne
    // cita nessuno. È la lezione dell'universo dichiarato.
    expect(codiciDelRegistro.length).toBeGreaterThan(0);
  });

  it("ogni processo del registro ha ESATTAMENTE un OWNER nell'archetipo", () => {
    const a = getArchetype(CHIAVE);
    expect(a, `l'archetipo ${CHIAVE} non esiste più`).not.toBeNull();

    const proprietariPerProcesso = new Map<string, string[]>();
    for (const p of a!.processOwnership.filter((x) => x.role === "OWNER")) {
      proprietariPerProcesso.set(p.processCode, [
        ...(proprietariPerProcesso.get(p.processCode) ?? []),
        p.orgUnitCode,
      ]);
    }

    const senzaProprietario = codiciDelRegistro.filter((c) => !proprietariPerProcesso.has(c));
    expect(
      `processi del registro senza OWNER: ${senzaProprietario.join(", ") || "nessuno"}`,
    ).toBe("processi del registro senza OWNER: nessuno");

    const conPiuProprietari = [...proprietariPerProcesso.entries()]
      .filter(([, u]) => u.length > 1)
      .map(([c, u]) => `${c}→[${u.join("|")}]`);
    expect(`processi con più di un OWNER: ${conPiuProprietari.join(", ") || "nessuno"}`).toBe(
      "processi con più di un OWNER: nessuno",
    );
  });

  it("nessun riferimento punta nel vuoto — né i processi né le unità", () => {
    const a = getArchetype(CHIAVE)!;
    const unitaDellArchetipo = new Set(a.orgUnits.map((u) => u.code));
    const processiVeri = new Set(codiciDelRegistro);

    const processiFantasma = [
      ...new Set(a.processOwnership.map((p) => p.processCode).filter((c) => !processiVeri.has(c))),
    ];
    expect(
      `processCode citati e assenti dal registro: ${processiFantasma.join(", ") || "nessuno"}`,
    ).toBe("processCode citati e assenti dal registro: nessuno");

    const unitaFantasma = [
      ...new Set(
        a.processOwnership.map((p) => p.orgUnitCode).filter((c) => !unitaDellArchetipo.has(c)),
      ),
    ];
    expect(
      `orgUnitCode citati e assenti dall'archetipo: ${unitaFantasma.join(", ") || "nessuno"}`,
    ).toBe("orgUnitCode citati e assenti dall'archetipo: nessuno");
  });

  it("la stessa unità non compare due volte sullo stesso processo", () => {
    // Due righe (processo, unità) con ruoli diversi sarebbero una contraddizione:
    // la stessa unità non può essere insieme proprietaria e informata.
    const a = getArchetype(CHIAVE)!;
    const visti = new Map<string, string>();
    const doppi: string[] = [];
    for (const p of a.processOwnership) {
      const k = `${p.processCode}·${p.orgUnitCode}`;
      const gia = visti.get(k);
      if (gia) doppi.push(`${k} (${gia} e ${p.role})`);
      else visti.set(k, p.role);
    }
    expect(`coppie processo-unità dichiarate due volte: ${doppi.join(", ") || "nessuna"}`).toBe(
      "coppie processo-unità dichiarate due volte: nessuna",
    );
  });
});
