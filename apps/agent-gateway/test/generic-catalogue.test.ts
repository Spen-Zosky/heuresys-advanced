/**
 * #156 — il CATALOGO GENERICO collegato: concepts_search → concept_describe → entity_query.
 *
 * È il criterio di chiusura della voce: *«una superficie in sola lettura risponde a una
 * domanda vera passando dai tre strumenti, con il gate che nega tutto il resto»*. Qui si
 * prova il percorso senza l'SDK — `bindPath` e la mappa sono SDK-free apposta, così la
 * batteria gira ovunque e non dipende dal modello.
 *
 * Ogni prova porta la sua CONTROPROVA: il caso che deve dare esito opposto. Una batteria
 * che verifica solo il ramo felice resta verde anche se il catalogo dicesse sempre di sì.
 */
import { describe, it, expect } from "vitest";
import { AtlasOperationResolver } from "../src/atlas-resolver.js";
import { bindPath } from "../src/mcp-tools.js";
import { classifyCall } from "../src/write-gate.js";
import { DEFAULT_TOOL_ALLOWLIST, GENERIC_TOOL_NAMES, MCP_TOOL_PREFIX } from "../src/mcp-tool-names.js";

/** Il perimetro vero di #156, in sola lettura — la stessa forma che genera l'atlante. */
const PERIMETRO = {
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

const resolver = AtlasOperationResolver.fromConcepts(PERIMETRO);

describe("#156 — i tre strumenti generici sono invocabili", () => {
  it("sono tutti e tre in allowlist, in forma nuda e con lo spazio dei nomi", () => {
    for (const n of GENERIC_TOOL_NAMES) {
      expect(DEFAULT_TOOL_ALLOWLIST.has(n), `${n} nudo`).toBe(true);
      expect(DEFAULT_TOOL_ALLOWLIST.has(`${MCP_TOOL_PREFIX}${n}`), `${n} con prefisso`).toBe(true);
    }
  });

  it("CONTROPROVA: uno strumento inventato NON è in allowlist", () => {
    expect(DEFAULT_TOOL_ALLOWLIST.has("hrx_entity_delete_everything")).toBe(false);
    expect(DEFAULT_TOOL_ALLOWLIST.has(`${MCP_TOOL_PREFIX}hrx_concepts_search_v2`)).toBe(false);
  });
});

describe("#156 — concepts_search e concept_describe dicono solo ciò che è aperto", () => {
  it("l'elenco dei concetti è il perimetro deciso, non il catalogo dei moduli", () => {
    expect(resolver.conceptIds()).toEqual(["organization-units"]);
  });

  it("describe elenca operazioni con metodo, percorso e permesso", () => {
    const ops = resolver.operationsOf("organization-units");
    expect(Object.keys(ops).sort()).toEqual(["get", "get_by_id"]);
    expect(ops.get_by_id).toMatchObject({ method: "GET", path: "/:id", permission: "organization_unit:read" });
  });

  it("CONTROPROVA: un concetto non aperto descrive il VUOTO, e il vuoto non è un'apertura", () => {
    // `compensation` è un modulo vero e popolato: se comparisse qui, il perimetro non
    // sarebbe il perimetro deciso ma il catalogo intero.
    expect(resolver.operationsOf("compensation")).toEqual({});
    expect(resolver.conceptIds()).not.toContain("compensation");
  });
});

describe("#156 — entity_query: la mappa decide, non l'input", () => {
  it("una lettura dichiarata si classifica read", () => {
    expect(classifyCall("hrx_entity_query", { conceptId: "organization-units", operationId: "get" }, resolver)).toBe("read");
  });

  it("LA PROVA CHE CHIUDE ADR-0033 §5.2: un'operazione non dichiarata non si risolve", () => {
    expect(
      classifyCall("hrx_entity_query", { conceptId: "organization-units", operationId: "delete_by_id" }, resolver),
    ).toBe("unresolved");
  });

  it("in un perimetro di sola lettura la scrittura NON è filtrata: non esiste", () => {
    // La differenza conta. Una scrittura «bloccata» è una riga di codice che si può
    // sbagliare; una scrittura assente dalla mappa non ha niente da aggirare.
    expect(resolver.methodOf("organization-units", "delete_by_id")).toBeUndefined();
    expect(Object.values(resolver.operationsOf("organization-units")).every((o) => o.method === "GET")).toBe(true);
  });

  it("dichiararsi in lettura non salva una scrittura: il metodo lo dice la mappa", () => {
    const conScrittura = AtlasOperationResolver.fromConcepts({
      esempio: {
        solaLettura: false,
        data: "2026-01-01",
        decisione: "perimetro di prova con scritture",
        operations: { cancella: { method: "DELETE", path: "/:id", permission: "x:delete" } },
      },
    });
    // input che PROVA a dichiararsi GET — la classificazione resta write
    expect(
      classifyCall("hrx_entity_query", { conceptId: "esempio", operationId: "cancella", method: "GET" }, conScrittura),
    ).toBe("write");
  });

  it("senza resolver ogni chiamata parametrica è unresolved (il default è negare)", () => {
    expect(classifyCall("hrx_entity_query", { conceptId: "organization-units", operationId: "get" })).toBe("unresolved");
  });
});

describe("#156 — bindPath difende il percorso che il resolver ha scelto", () => {
  it("sostituisce il segnaposto", () => {
    expect(bindPath("/:id", { id: "abc-123" })).toBe("/abc-123");
    expect(bindPath("/", {})).toBe("/");
  });

  it("CONTROPROVA: un segnaposto senza valore è un errore, non un percorso letterale", () => {
    // Senza questo, il percorso resterebbe `/:id` e l'API leggerebbe un'unità chiamata «:id»
    expect(() => bindPath("/:id", {})).toThrow(/parametro di percorso mancante/);
    expect(() => bindPath("/:id", { id: "" })).toThrow(/mancante/);
  });

  it("CONTROPROVA: un valore che esce dal percorso è rifiutato, non codificato e basta", () => {
    expect(() => bindPath("/:id", { id: "../../users" })).toThrow(/non ammesso/);
    expect(() => bindPath("/:id", { id: "x?admin=1" })).toThrow(/non ammesso/);
  });

  it("un valore normale viene codificato (uno spazio non spezza il percorso)", () => {
    expect(bindPath("/:code", { code: "AREA NORD" })).toBe("/AREA%20NORD");
  });
});
