/**
 * #156 — il risolutore costruito dall'atlante, e le prove che sanno fallire.
 *
 * Il criterio di chiusura di ADR-0033 §5.2 chiede UNA cosa sopra le altre: **un operationId
 * non dichiarato NON si risolve**. Tutto il resto del gate poggia su quella; se scivolasse
 * verso «trattalo come lettura», la guardia sarebbe decorativa.
 *
 * Ogni prova qui ha la sua controprova — il caso che deve dare esito OPPOSTO. Una batteria
 * che verifica solo il ramo felice resta verde anche quando il resolver risponde sempre sì.
 */
import { describe, it, expect } from "vitest";
import { AtlasOperationResolver } from "../src/atlas-resolver.js";
import { classifyCall } from "../src/write-gate.js";

/** Una mappa minima e realistica: il perimetro di `#156`, in sola lettura. */
const PERIMETRO_REALE = {
  "organization-units": {
    solaLettura: true,
    data: "2026-08-16",
    decisione: "Enzo (#156): primo perimetro in sola lettura",
    operations: {
      get: { method: "GET", path: "/", permission: "organization_unit:read" },
      get_by_id: { method: "GET", path: "/:id", permission: "organization_unit:read" },
    },
  },
};

/** Un perimetro che AMMETTE scritture: serve a provare che il gate le vede davvero. */
const PERIMETRO_CON_SCRITTURA = {
  esempio: {
    solaLettura: false,
    data: "2026-08-16",
    decisione: "solo per la prova",
    operations: {
      get: { method: "GET", path: "/", permission: "x:read" },
      delete_by_id: { method: "DELETE", path: "/:id", permission: "x:delete" },
    },
  },
};

describe("#156 AtlasOperationResolver — l'ignoto non è una lettura", () => {
  const r = AtlasOperationResolver.fromConcepts(PERIMETRO_REALE);

  it("risolve un'operazione dichiarata", () => {
    expect(r.methodOf("organization-units", "get")).toBe("GET");
    expect(r.methodOf("organization-units", "get_by_id")).toBe("GET");
  });

  it("NON risolve un operationId non dichiarato — è il criterio di ADR-0033 §5.2", () => {
    expect(r.methodOf("organization-units", "delete_by_id")).toBeUndefined();
    expect(r.methodOf("organization-units", "post")).toBeUndefined();
    expect(r.methodOf("organization-units", "")).toBeUndefined();
    // ...e il caso subdolo: un nome plausibile che nessuno ha dichiarato.
    expect(r.methodOf("organization-units", "get_all")).toBeUndefined();
  });

  it("NON risolve un concetto fuori perimetro, per quanto esista nel prodotto", () => {
    // `users` è un modulo vero dell'API: se bastasse esistere, il perimetro non esisterebbe.
    expect(r.methodOf("users", "get")).toBeUndefined();
    expect(r.methodOf("compensation", "get")).toBeUndefined();
  });

  it("un resolver vuoto nega tutto, e lo dichiara invece di tacerlo", () => {
    const vuoto = AtlasOperationResolver.fromConcepts({});
    expect(vuoto.isEmpty()).toBe(true);
    expect(vuoto.methodOf("organization-units", "get")).toBeUndefined();
    // Controprova: quello vero NON deve dirsi vuoto, o `isEmpty` non distinguerebbe nulla.
    expect(r.isEmpty()).toBe(false);
  });

  it("un file assente produce un resolver vuoto, non un'eccezione al boot", () => {
    const mancante = AtlasOperationResolver.load("docs/kb/atlas/QUESTO-NON-ESISTE.json");
    expect(mancante.isEmpty()).toBe(true);
    expect(mancante.methodOf("organization-units", "get")).toBeUndefined();
  });

  it("l'elenco delle operazioni è CHIUSO (ADR-0033 §2 `describe`)", () => {
    expect(Object.keys(r.operationsOf("organization-units")).sort()).toEqual(["get", "get_by_id"]);
    expect(r.operationsOf("users")).toEqual({});
  });
});

describe("#156 il gate usa il resolver, e senza di esso nega", () => {
  const r = AtlasOperationResolver.fromConcepts(PERIMETRO_REALE);
  const chiamata = { conceptId: "organization-units", operationId: "get" };

  it("con il resolver una GET dichiarata è una lettura", () => {
    expect(classifyCall("hrx_entity_query", chiamata, r)).toBe("read");
  });

  it("SENZA resolver la stessa identica chiamata è `unresolved`", () => {
    // La controprova che rende non-tautologica quella sopra: se anche senza resolver
    // uscisse "read", il resolver non starebbe decidendo nulla.
    expect(classifyCall("hrx_entity_query", chiamata)).toBe("unresolved");
  });

  it("un'operazione non dichiarata è `unresolved`, non `read`", () => {
    expect(classifyCall("hrx_entity_query",
      { conceptId: "organization-units", operationId: "delete_by_id" }, r)).toBe("unresolved");
  });

  it("il metodo lo dice la mappa, non l'input: dichiararsi GET non salva una DELETE", () => {
    const conScrittura = AtlasOperationResolver.fromConcepts(PERIMETRO_CON_SCRITTURA);
    const bugiardo = { conceptId: "esempio", operationId: "delete_by_id", method: "GET" };
    expect(classifyCall("hrx_entity_query", bugiardo, conScrittura)).toBe("write");
  });

  it("in un perimetro di sola lettura la scrittura non è filtrata: NON ESISTE", () => {
    // La differenza conta. `delete_by_id` esiste nel perimetro con scritture (sopra, → write)
    // e non esiste in quello di sola lettura (→ unresolved). Ciò che non esiste non si aggira.
    expect(classifyCall("hrx_entity_query",
      { conceptId: "organization-units", operationId: "delete_by_id" }, r)).toBe("unresolved");
    expect(classifyCall("hrx_entity_query",
      { conceptId: "esempio", operationId: "delete_by_id" },
      AtlasOperationResolver.fromConcepts(PERIMETRO_CON_SCRITTURA))).toBe("write");
  });
});

describe("#156 il file generato sul disco è coerente con la decisione", () => {
  const vero = AtlasOperationResolver.load();

  it("porta il perimetro deciso, e solo quello", () => {
    // L'atteso NON è cablato: è il perimetro dichiarato nel file dei perimetri, letto qui.
    expect(vero.isEmpty(),
      "agent-operations.json non si legge: rigenerarlo con build_agent_operations.py").toBe(false);
    expect(vero.conceptIds()).toEqual(["organization-units"]);
  });

  it("non contiene NESSUNA operazione di scrittura", () => {
    for (const cid of vero.conceptIds()) {
      for (const [opId, op] of Object.entries(vero.operationsOf(cid))) {
        expect(["GET", "HEAD"], `${cid}.${opId} è una scrittura in un perimetro di sola lettura`)
          .toContain(op.method);
      }
    }
  });
});
