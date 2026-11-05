import { describe, it, expect } from "vitest";
import { paginaIdonea } from "./idoneita";
import { PAGINE_IDONEE_AGENTE } from "./pagine-idonee.generated";

describe("A-8 — le pagine idonee al pannello dell'agente", () => {
  const elenco = ["/positions", "/positions/new", "/positions/[positionId]/skills", "/approvals/[id]"];

  it("una rotta fissa vale per sé, una dinamica per qualunque valore del segmento", () => {
    expect(paginaIdonea("/positions", elenco)).toBe("/positions");
    expect(paginaIdonea("/positions/", elenco)).toBe("/positions");
    expect(paginaIdonea("/positions/new", elenco)).toBe("/positions/new");
    expect(paginaIdonea("/positions/abc-123/skills?x=1", elenco)).toBe("/positions/[positionId]/skills");
    expect(paginaIdonea("/approvals/9f1c", elenco)).toBe("/approvals/[id]");
  });

  it("una pagina fuori dall'elenco non è idonea, anche se ne è un prefisso", () => {
    expect(paginaIdonea("/positions/abc/kpis", elenco)).toBeNull();
    expect(paginaIdonea("/approvals", elenco)).toBeNull();
    expect(paginaIdonea("/login", elenco)).toBeNull();
  });

  it("l'elenco generato esclude le superfici di presidio e l'isolamento assoluto", () => {
    expect(PAGINE_IDONEE_AGENTE.length).toBeGreaterThan(0);
    for (const fuori of ["/whistleblowing-console", "/system-health", "/provenance", "/dev/agent", "/admin/roles", "/login"]) {
      expect(paginaIdonea(fuori)).toBeNull();
    }
    expect(paginaIdonea("/approvals/qualunque")).toBe("/approvals/[id]");
  });
});
