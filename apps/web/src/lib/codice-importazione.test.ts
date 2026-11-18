import { describe, expect, it } from "vitest";
import { codiceLeggibile } from "./codice-importazione";

describe("C5: i codici di importazione non si mostrano", () => {
  it("una chiave con prefisso legacy resta nascosta", () => {
    expect(codiceLeggibile("ESCO::8f14e45f-ceea-467a-9c3e-1b2c3d4e5f60")).toBeNull();
    expect(codiceLeggibile("OLDDB::competency_frameworks::8f14e45f-ceea-467a-9c3e-1b2c3d4e5f60")).toBeNull();
    expect(codiceLeggibile("LEGACY_BP::x")).toBeNull();
  });
  it("un codice vero si mostra", () => {
    expect(codiceLeggibile("SKL-0042")).toBe("SKL-0042");
  });
  it("vuoto o assente non è un codice", () => {
    expect(codiceLeggibile(null)).toBeNull();
    expect(codiceLeggibile("")).toBeNull();
  });
});
