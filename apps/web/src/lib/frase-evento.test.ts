import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parametriEvento } from "./frase-evento";

/*
 * K26 del giro forense del 23/11/2026: nella storia di /me la frase dell'evento («Corso completato:
 * GDPR e Privacy») è scritta in italiano nel dato, e in una pagina inglese restava italiana. Il tipo e
 * il soggetto si separano, e la frase si compone nella lingua di chi guarda.
 */
describe("K26: frase di un evento della storia", () => {
  it("separa il tipo dal soggetto per i prefissi noti", () => {
    expect(parametriEvento("COURSE_COMPLETED", "Corso completato: GDPR e Privacy (conformità)")).toEqual({ kind: "COURSE_COMPLETED", subject: "GDPR e Privacy (conformità)" });
    expect(parametriEvento("CERTIFICATION_EARNED", "Certificazione conseguita: GDPR Data Protection Officer (TUV)")).toEqual({ kind: "CERTIFICATION_EARNED", subject: "GDPR Data Protection Officer (TUV)" });
    expect(parametriEvento("HIRE", "Assunto come Cassiere")).toEqual({ kind: "HIRE", subject: "Cassiere" });
  });

  it("una frase senza prefisso noto resta com'è", () => {
    expect(parametriEvento("COURSE_COMPLETED", "Altro testo")).toBeNull();
    expect(parametriEvento("OTHER", "Corso completato: X")).toBeNull();
    expect(parametriEvento("COURSE_COMPLETED", null)).toBeNull();
  });

  it("le frasi composte esistono in italiano e in inglese", () => {
    for (const l of ["it", "en"]) {
      const admin = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "locales", l, "admin.json"), "utf8"));
      for (const k of ["COURSE_COMPLETED", "CERTIFICATION_EARNED", "HIRE"]) expect(admin.dashboard.catalogo.evento[k], `${l} ${k}`).toContain("{{subject}}");
    }
  });
});

describe("K26: testi fissi in italiano fuori dai dizionari", () => {
  const radice = path.resolve(__dirname, "..");
  const leggi = (f: string) => fs.readFileSync(path.join(radice, f), "utf8");
  const dizionario = (l: string, ns: string) => JSON.parse(fs.readFileSync(path.join(radice, "locales", l, `${ns}.json`), "utf8"));

  it("le sigle della matrice processi × unità stanno nei dizionari", () => {
    const sorgente = leggi("components/processo/matrice-processi.tsx");
    expect(sorgente).not.toMatch(/CONTRIBUTOR: "E"/);
    expect(sorgente).not.toMatch(/>E\/C</);
    for (const l of ["it", "en"]) {
      const m = dizionario(l, "blueprints").processiDelTenant.matrice;
      for (const r of ["OWNER", "CONTRIBUTOR", "CONSULTED", "INFORMED"]) expect(m.sigla?.[r], `${l} ${r}`).toBeTruthy();
      expect(m.eC, l).toBeTruthy();
    }
  });

  it("il motivo di una vista mascherata o negata si scrive nella lingua di chi guarda", () => {
    for (const l of ["it", "en"]) {
      const f = dizionario(l, "admin").dashboard.famiglie;
      expect(f.motivoMasked, l).toBeTruthy();
      expect(f.motivoDenied, l).toBeTruthy();
    }
    expect(leggi("app/(authenticated)/dashboard/[famiglia]/page.tsx")).toContain("dashboard.famiglie.motivoMasked");
  });
});
