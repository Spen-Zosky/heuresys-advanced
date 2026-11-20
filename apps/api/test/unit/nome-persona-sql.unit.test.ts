import { describe, it, expect } from "vitest";
import { cognomeNomeSql } from "../../src/lib/nome-persona-sql.js";

describe("cognomeNomeSql", () => {
  it("compone cognome e nome dall'alias dato, con il nome visibile come ripiego", () => {
    const s = cognomeNomeSql("u");
    expect(s).toContain("u.user_last_name");
    expect(s).toContain("u.user_first_name");
    expect(s).toMatch(/, u\.user_display_name\)$/);
    expect(s).toContain("concat_ws(', '");
  });
  it("rifiuta un alias che non sia un identificatore", () => {
    expect(() => cognomeNomeSql("u; DROP")).toThrow();
  });
});
