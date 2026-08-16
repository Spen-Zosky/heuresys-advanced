/**
 * apps/api/test/unit/scope-data-classes.unit.test.ts — D-64 unit layer.
 * Tassonomia data-class ADR-0027 (D-51: resa prescrittiva). Le proprietà sono
 * INVARIANTI comportamentali, non copie della mappa (regola S1012
 * no-hardcoded-test-data): coerenza tra dataClassOf / isSensitiveClass /
 * isSensitiveResource, e i pilastri I18 (sensitive = org-axis only).
 */

import { describe, it, expect } from "vitest";
import {
  SENSITIVE_DATA_CLASSES,
  RESOURCE_DATA_CLASS,
  dataClassOf,
  isSensitiveClass,
  isSensitiveResource,
  RESOURCE_RUBRICA_AZIENDALE,
} from "../../src/lib/scope/data-classes.js";

describe("scope data-classes (unit)", () => {
  /**
   * L'equivalenza vale per ogni resource TRANNE quelle di rubrica aziendale (#193), e
   * l'eccezione è dichiarata qui invece di allargare la maglia del test.
   *
   * PERCHÉ ESISTE L'ECCEZIONE. `organization_unit` dichiara `PERSONAL` — l'organigramma
   * mostra nomi, tacerlo era il difetto che #193 chiude — ma per decisione di Enzo del
   * 2026-08-16 quel dato è aperto a chiunque lavori in azienda, quindi NON passa dall'asse
   * organizzativo. Se `isSensitiveResource` la dicesse sensibile, l'asserzione D-51 al boot
   * pretenderebbe un `orgGate` sulle sue rotte di lettura e **l'app non partirebbe**.
   *
   * Questo test è andato rosso in CI appena l'eccezione è stata introdotta, ed è il
   * comportamento giusto: un'eccezione che nessuna prova nota è un'eccezione che domani
   * diventa la regola senza che nessuno l'abbia decisa.
   */
  it("coerenza: isSensitiveResource(r) ⟺ dataClassOf(r) sensibile, salvo la rubrica aziendale", () => {
    for (const resource of Object.keys(RESOURCE_DATA_CLASS)) {
      const cls = dataClassOf(resource);
      expect(cls, `dataClassOf(${resource})`).not.toBeNull();
      const atteso = isSensitiveClass(cls!) && RESOURCE_RUBRICA_AZIENDALE[resource] === undefined;
      expect(isSensitiveResource(resource), resource).toBe(atteso);
    }
  });

  it("la rubrica aziendale è un'eccezione DICHIARATA, non una maglia larga", () => {
    const rubrica = Object.keys(RESOURCE_RUBRICA_AZIENDALE);
    // Se l'elenco si svuotasse, il test sopra tornerebbe l'equivalenza secca e questo
    // fallirebbe: l'eccezione non può sparire in silenzio.
    expect(rubrica.length, "nessuna resource di rubrica: l'eccezione di #193 è sparita").toBeGreaterThan(0);
    for (const r of rubrica) {
      // Ognuna dichiara PERSONAL — dice il vero su cosa mostra...
      expect(dataClassOf(r), `${r} deve dichiarare la classe che espone`).toBe("PERSONAL");
      // ...e NON è sensibile ai fini dell'asse organizzativo. Le due insieme sono la decisione.
      expect(isSensitiveResource(r), `${r} è di rubrica: non passa dall'asse organizzativo`).toBe(false);
      // Una riga senza ragione è indistinguibile da una dimenticanza.
      expect(RESOURCE_RUBRICA_AZIENDALE[r] ?? "", `${r} senza ragione scritta`).toMatch(/#\d+/);
    }
  });

  it("risorsa ignota → dataClassOf null e MAI sensibile-per-caso", () => {
    expect(dataClassOf("resource_that_does_not_exist")).toBeNull();
    expect(isSensitiveResource("resource_that_does_not_exist")).toBe(false);
  });

  it("i pilastri I18 restano sensibili (PERSONAL/COMPENSATION/SKILL/EVALUATION)", () => {
    // I18: i dati personali altrui passano SOLO dalla catena organizzativa.
    for (const cls of ["PERSONAL", "COMPENSATION", "SKILL", "EVALUATION"] as const) {
      expect(SENSITIVE_DATA_CLASSES.has(cls), `${cls} deve restare sensitive`).toBe(true);
    }
  });

  it("ogni valore della mappa è una data-class che il predicato sa classificare", () => {
    for (const [resource, cls] of Object.entries(RESOURCE_DATA_CLASS)) {
      expect(typeof isSensitiveClass(cls), `class di ${resource}`).toBe("boolean");
    }
  });
});
