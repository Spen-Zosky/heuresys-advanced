/**
 * apps/api/test/unit/ruoli-dei-test.unit.test.ts — la dichiarazione dei ruoli che i test danno
 * per scontati (db/scripts/ruoli-dei-test.json), senza database.
 *
 * La dichiarazione resta onesta solo se ogni riga dice perché esiste e chi la usa: un test
 * nominato che non esiste più è una concessione da togliere, e una forma sbagliata deve fermare
 * lo script prima che apra una transazione. La guardia del collaudo non si riprova qui: è la
 * stessa funzione di provision-collaudo-access.ts, provata in collaudo-guard.unit.test.ts.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { leggiDichiarazione } from "../../scripts/ruoli-dei-test.mjs";

const testDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function dichiarazioneDi(contenuto: unknown): string {
  const d = mkdtempSync(join(tmpdir(), "ruoli-dei-test-"));
  const f = join(d, "r.json");
  writeFileSync(f, JSON.stringify(contenuto));
  return f;
}

describe("ruoli-dei-test.json", () => {
  const dichiarate = leggiDichiarazione();

  it("non è vuota e ogni riga ha motivo e test", () => {
    expect(dichiarate.length).toBeGreaterThan(0);
    for (const c of dichiarate) {
      expect(c.motivo.length).toBeGreaterThanOrEqual(10);
      expect(c.test.length).toBeGreaterThan(0);
    }
  });

  it("ogni test nominato esiste", () => {
    for (const c of dichiarate) {
      for (const t of c.test) {
        const f = join(testDir, `${t}.integration.test.ts`);
        expect(existsSync(f), `${c.email} ${c.ruolo}: il test ${t} non esiste più`).toBe(true);
      }
    }
  });

  it("rifiuta una riga senza motivo, ripetuta o su un'utenza di collaudo", () => {
    const base = { email: "x.y@rtl-bank.org", ruolo: "MANAGER", motivo: "un motivo lungo abbastanza", test: ["dashboard"] };
    expect(() => leggiDichiarazione(dichiarazioneDi({ concessioni: [{ ...base, motivo: "" }] }))).toThrow(/motivo/);
    expect(() => leggiDichiarazione(dichiarazioneDi({ concessioni: [base, base] }))).toThrow(/ripetuta/);
    expect(() =>
      leggiDichiarazione(dichiarazioneDi({ concessioni: [{ ...base, email: "governo@collaudo.invalid" }] })),
    ).toThrow(/collaudo/);
    expect(() => leggiDichiarazione(dichiarazioneDi({ concessioni: [] }))).toThrow(/concessioni/);
    expect(leggiDichiarazione(dichiarazioneDi({ concessioni: [base] }))).toHaveLength(1);
  });

  it("lo script si ferma fuori dal collaudo con la guardia condivisa", () => {
    const sorgente = readFileSync(resolve(testDir, "..", "..", "..", "db", "scripts", "ruoli-dei-test.ts"), "utf8");
    expect(sorgente).toContain('from "../../apps/api/scripts/collaudo-guard.mjs"');
    expect(sorgente.indexOf("if (!eDiCollaudo())")).toBeLessThan(sorgente.indexOf("await db.connect()"));
  });
});
