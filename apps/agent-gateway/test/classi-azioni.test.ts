/**
 * ADR-0056 D2, piano dei principi agentici voce T2: la classe di ogni azione del catalogo.
 *
 * Quattro affermazioni, ognuna con la sua controprova:
 *   1. ogni nome del catalogo ha una classe, e nessun nome fuori dal catalogo ne ha una;
 *   2. nessuna scrittura è di classe A, e ogni cancellazione è di classe C;
 *   3. lo strumento generico prende la classe dal metodo risolto (GET è A, il resto C, l'ignoto niente);
 *   4. il gate NEGA una scrittura ammessa dall'allowlist ma senza classe, senza chiamare l'approvatore.
 */
import { describe, expect, it, vi } from "vitest";
import { MemoryAuditSink } from "../src/audit-sink.js";
import { CLASSI_STRUMENTI, classeAzione } from "../src/classi-azioni.js";
import {
  GENERIC_TOOL_NAMES,
  READ_TOOL_NAMES,
  WRITE_TOOL_NAMES,
  PARAMETRIC_TOOL_NAMES,
} from "../src/mcp-tool-names.js";
import { makeCanUseTool } from "../src/write-gate.js";

const NOMINATI: string[] = [...GENERIC_TOOL_NAMES, ...READ_TOOL_NAMES, ...WRITE_TOOL_NAMES].filter(
  (n) => !PARAMETRIC_TOOL_NAMES.has(n),
);

describe("ogni azione del catalogo ha una classe fissa (ADR-0056 D2)", () => {
  it("ogni nome del catalogo con un nome proprio ha una classe", () => {
    const senza = NOMINATI.filter((n) => CLASSI_STRUMENTI[n] === undefined);
    expect(senza).toEqual([]);
  });

  it("nessuna classe per un nome che il catalogo non conosce (la mappa non allarga il catalogo)", () => {
    const fuori = Object.keys(CLASSI_STRUMENTI).filter((n) => !NOMINATI.includes(n));
    expect(fuori).toEqual([]);
  });

  // La verità su chi legge e chi scrive sono gli elenchi del catalogo, non il verbo nel nome:
  // `isWriteTool` vede «override» in `hrx_blueprint_overrides_list`, che è una GET (mcp-tools.ts),
  // e la tratta da scrittura. È prudente, non un buco; è riportato nel piano come scoperta.
  it("nessuna scrittura del catalogo è di classe A", () => {
    const scrittureA = WRITE_TOOL_NAMES.filter((n) => CLASSI_STRUMENTI[n] === "A");
    expect(scrittureA).toEqual([]);
  });

  it("ogni lettura del catalogo è di classe A", () => {
    const lettureNonA = [...READ_TOOL_NAMES, ...GENERIC_TOOL_NAMES]
      .filter((n) => !PARAMETRIC_TOOL_NAMES.has(n))
      .filter((n) => CLASSI_STRUMENTI[n] !== "A");
    expect(lettureNonA).toEqual([]);
  });

  it("ogni cancellazione è di classe C (P17, ADR-0035)", () => {
    const cancellazioni = NOMINATI.filter((n) => /delete/i.test(n));
    expect(cancellazioni.length).toBeGreaterThan(0);
    for (const n of cancellazioni) expect(CLASSI_STRUMENTI[n]).toBe("C");
  });

  it("vale anche con lo spazio dei nomi mcp__heuresys__", () => {
    expect(classeAzione("mcp__heuresys__hrx_org_units_upsert", {})).toBe("B");
    expect(classeAzione("mcp__heuresys__hrx_org_units_delete", {})).toBe("C");
  });
});

describe("lo strumento generico prende la classe dall'operazione risolta", () => {
  const metodi: Record<string, string> = { "c:leggi": "GET", "c:crea": "POST", "c:togli": "DELETE" };
  const resolver = { methodOf: (c: string, o: string) => metodi[`${c}:${o}`] };

  it("GET è A, POST e DELETE sono C", () => {
    expect(classeAzione("hrx_entity_query", { conceptId: "c", operationId: "leggi" }, resolver)).toBe("A");
    expect(classeAzione("hrx_entity_query", { conceptId: "c", operationId: "crea" }, resolver)).toBe("C");
    expect(classeAzione("hrx_entity_query", { conceptId: "c", operationId: "togli" }, resolver)).toBe("C");
  });

  it("CONTROPROVA: operazione ignota, input incompleto o risolutore assente non hanno classe", () => {
    expect(classeAzione("hrx_entity_query", { conceptId: "c", operationId: "boh" }, resolver)).toBeUndefined();
    expect(classeAzione("hrx_entity_query", { conceptId: "c" }, resolver)).toBeUndefined();
    expect(classeAzione("hrx_entity_query", { conceptId: "c", operationId: "leggi" })).toBeUndefined();
  });
});

describe("il gate nega una scrittura senza classe", () => {
  it("una scrittura in allowlist ma fuori dalla mappa delle classi è negata senza chiedere", async () => {
    const approve = vi.fn(async () => true);
    const audit = new MemoryAuditSink();
    const canUseTool = makeCanUseTool(approve, {
      audit,
      allowlist: new Set(["hrx_compensation_recommend"]),
    });
    const d = await canUseTool("hrx_compensation_recommend", {});
    expect(d.behavior).toBe("deny");
    expect(approve).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(audit.entries.at(-1)?.reason).toBe("ACTION_CLASS_UNKNOWN");
  });

  it("CONTROPROVA: una scrittura del catalogo con classe va ancora all'approvazione umana", async () => {
    const approve = vi.fn(async () => true);
    const canUseTool = makeCanUseTool(approve, { audit: new MemoryAuditSink() });
    const d = await canUseTool("hrx_org_units_upsert", { payload: {} });
    expect(d.behavior).toBe("allow");
    expect(approve).toHaveBeenCalledOnce();
  });
});
