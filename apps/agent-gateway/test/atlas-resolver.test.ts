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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { describe, it, expect } from "vitest";
import { AtlasOperationResolver } from "../src/atlas-resolver.js";
import { classifyCall } from "../src/write-gate.js";

/**
 * La radice del workspace, risalita come fa il resolver (`atlas-resolver.ts:50`): la cwd
 * cambia fra il gateway (radice) e i test (`apps/agent-gateway`), e un percorso relativo
 * si leggerebbe in un caso e non nell'altro — cioè verde qui e vuoto in produzione.
 */
function radiceRepo(): string {
  let dir = resolvePath(process.cwd());
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const su = dirname(dir);
    if (su === dir) break;
    dir = su;
  }
  return process.cwd();
}

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

  it("porta i perimetri decisi con la loro decisione, e ogni altro modulo in sola lettura (#254)", () => {
    // L'atteso si DERIVA dalla fonte, non si fotografa (lezione del 2026-08-17). Dal 2026-11-05
    // (#254, ADR-0040 §5, piano interfacce L10 A-13) le LETTURE si aprono su tutti i moduli:
    // i perimetri decisi restano con la loro decisione, gli altri entrano in sola lettura con
    // la decisione di ADR-0040; restano fuori solo i moduli dichiarati nel generatore.
    expect(vero.isEmpty(),
      "agent-operations.json non si legge: rigenerarlo con build_agent_operations.py").toBe(false);
    const perimetri = JSON.parse(
      readFileSync(join(radiceRepo(), "docs", "kb", "agent-perimetri.json"), "utf8"),
    ) as { aperti?: Array<{ concetto: string }> };
    const decisi = (perimetri.aperti ?? []).map((v) => v.concetto).sort();
    expect(decisi.length, "nessun perimetro deciso: la fonte non si legge").toBeGreaterThan(0);
    const aperti = vero.conceptIds();
    for (const d of decisi) expect(aperti, `il perimetro deciso ${d} manca`).toContain(d);
    expect(aperti.length).toBeGreaterThan(decisi.length);
    // Le eccezioni dichiarate restano fuori anche dalle letture.
    expect(aperti).not.toContain("auth");
    expect(aperti).not.toContain("whistleblowing");
    // Un modulo con dati di persona ora si legge, con il permesso della persona: è l'API a filtrare.
    expect(aperti).toContain("compensation");
    // F1 (ADR-0063): le sue scritture entrano con la classe C (ADR-0036 §5), le letture con la A.
    for (const op of Object.values(vero.operationsOf("compensation"))) {
      expect(op.classe).toBe(op.method === "GET" ? "A" : "C");
    }
  });

  it("F1: le scritture sono SOLO quelle con classe B o C nel registro, e le cancellazioni solo logiche", () => {
    // Dall'ondata 4 al 2026-11-25 le scritture si aprivano per nome nei perimetri. Da F1 (ADR-0063)
    // le apre il registro delle classi: l'atteso si deriva da lì, mai da una fotografia.
    const registro = JSON.parse(
      readFileSync(join(radiceRepo(), "docs", "kb", "agent-classi-scritture.json"), "utf8"),
    ) as { scritture: Record<string, Record<string, { metodo: string; classe?: string; fuori?: string; verifica?: string }>> };
    const perimetri = JSON.parse(
      readFileSync(join(radiceRepo(), "docs", "kb", "agent-perimetri.json"), "utf8"),
    ) as { aperti?: Array<{ concetto: string; scritture?: string[] }> };
    const aperti = new Set(vero.conceptIds());
    const attese = new Set<string>();
    for (const [cid, ops] of Object.entries(registro.scritture)) {
      if (!aperti.has(cid)) continue; // più prefissi o fuori dalle letture: il concetto non c'è
      for (const [opId, v] of Object.entries(ops)) if (v.classe === "B" || v.classe === "C") attese.add(`${cid}.${opId}`);
    }
    expect(attese.size, "F1: il registro non apre scritture").toBeGreaterThan(150);
    const trovate = new Set<string>();
    for (const cid of vero.conceptIds()) {
      for (const [opId, op] of Object.entries(vero.operationsOf(cid))) {
        if (op.method === "GET") {
          expect(op.classe, `${cid}.${opId}: una lettura è di classe A`).toBe("A");
          continue;
        }
        const riga = registro.scritture[cid]?.[opId];
        expect(riga?.fuori, `${cid}.${opId}: esclusa nel registro ma presente nella mappa`).toBeUndefined();
        expect(op.classe, `${cid}.${opId}: la classe della mappa non è quella del registro`).toBe(riga?.classe);
        if (op.method === "DELETE") {
          expect(op.classe, `${cid}.${opId}: una cancellazione è sempre C`).toBe("C");
          expect(riga?.verifica, `${cid}.${opId}: cancellazione senza prova del ritiro logico`).toBeTruthy();
        }
        trovate.add(`${cid}.${opId}`);
      }
    }
    expect([...trovate].sort()).toEqual([...attese].sort());
    // Le scritture decise nei perimetri prima di F1 ci sono ancora tutte.
    for (const v of perimetri.aperti ?? []) {
      for (const w of v.scritture ?? []) expect(trovate.has(`${v.concetto}.${w}`), `${v.concetto}.${w}`).toBe(true);
    }
    // CONTROPROVA: le esclusioni non esistono nella mappa (accessi, governo degli agenti, cancellazioni fisiche).
    expect(vero.methodOf("agent-capabilities", "post_by_id_mode")).toBeUndefined();
    expect(vero.methodOf("users", "post_by_id_roles")).toBeUndefined();
    expect(vero.methodOf("users", "delete_by_id_purge")).toBeUndefined();
    expect(vero.methodOf("kpi-definitions", "delete_by_id")).toBeUndefined();
  });

  it("ogni concetto dichiara la base su cui l'API lo monta (ondata 4)", () => {
    // `semantic-matching` sta sotto /matching: prima dell'ondata 4 il catalogo chiamava /semantic-matching.
    expect(vero.baseOf("semantic-matching")).toBe("/matching");
    expect(vero.baseOf("positions")).toBe("/positions");
    expect(vero.conceptIds()).not.toContain("tenant-consolidation");
  });
});

describe("ADR-0061 passo 10 — il corpo di ogni scrittura, dai contratti (difetto del 2026-11-22)", () => {
  it("ogni scrittura del catalogo ha lo schema del corpo, e quello delle faccette vuole codes (elenco) e non code", () => {
    const r = AtlasOperationResolver.load();
    const catalogo = JSON.parse(readFileSync(join(radiceRepo(), "docs/kb/atlas/agent-operations.json"), "utf8")) as {
      concepts: Record<string, { operations: Record<string, { method: string }> }>;
    };
    const scritture = Object.entries(catalogo.concepts).flatMap(([c, v]) =>
      Object.entries(v.operations)
        .filter(([, op]) => !["GET", "DELETE"].includes(op.method.toUpperCase()))
        .map(([id]) => [c, id] as const),
    );
    expect(scritture.length).toBeGreaterThan(0); // una mappa vuota non è verde
    const senza = scritture.filter(([c, id]) => r.bodyOf(c, id) === undefined).map(([c, id]) => `${c}.${id}`);
    expect(senza).toEqual([]);
    const faccette = r.bodyOf("tenant-processes", "put_by_id_faccette_by_facet") as {
      required?: string[]; properties?: Record<string, { type?: string }>;
    };
    expect(faccette.required).toContain("codes");
    expect(faccette.properties?.codes?.type).toBe("array");
    expect(faccette.properties?.code).toBeUndefined();
  });

  it("CONTROPROVA: senza il file dei corpi nessun corpo è dichiarato (e il catalogo resta)", () => {
    const r = AtlasOperationResolver.load(undefined, "docs/kb/atlas/non-esiste.json");
    expect(r.isEmpty()).toBe(false);
    expect(r.bodyOf("tenant-processes", "put_by_id_faccette_by_facet")).toBeUndefined();
  });
});
