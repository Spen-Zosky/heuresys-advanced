import { describe, expect, it } from "vitest";
import { incontriLeggibili } from "./mentorship-coppie";

const base = { mentorUserId: "a", menteeUserId: "b", mentorName: "Rossi, Anna", menteeName: "Bianchi, Luca" };

describe("incontriLeggibili (K30)", () => {
  it("con le due persone nel perimetro gli incontri si leggono", () => {
    expect(incontriLeggibili(base)).toBe(true);
  });

  it("con una persona fuori perimetro ({omissis}) no: l'API risponderebbe 404", () => {
    expect(incontriLeggibili({ ...base, mentorName: null })).toBe(false);
    expect(incontriLeggibili({ ...base, menteeName: null })).toBe(false);
  });

  it("una persona non ancora assegnata non nasconde niente", () => {
    expect(incontriLeggibili({ ...base, menteeUserId: null, menteeName: null })).toBe(true);
  });
});
