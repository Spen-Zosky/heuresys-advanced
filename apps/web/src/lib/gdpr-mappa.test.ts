/**
 * Giro forense K34: la mappa dei dati personali si legge per classe e con il titolo della tabella,
 * mai con il nome fisico. Le traduzioni vengono dai dizionari veri (`locales/<lingua>/admin.json`).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GdprDataClassEnum, GdprReferenceKindEnum, type GdprDataMapItem } from "@heuresys/shared";
import { raggruppaMappa, titoloVoce } from "./gdpr-mappa";

type Nodo = { [k: string]: string | Nodo };

function dizionario(lingua: "it" | "en") {
  const d = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "locales", lingua, "admin.json"), "utf8"),
  ) as Nodo;
  const leggi = (k: string): unknown => k.split(".").reduce<unknown>((n, p) => (n as Nodo | undefined)?.[p], d);
  const t = (chiave: string, opzioni?: Record<string, unknown>): string => {
    const valore = (opzioni?.count === 1 ? leggi(`${chiave}_one`) : undefined) ?? leggi(chiave);
    if (typeof valore !== "string") throw new Error(`chiave mancante in ${lingua}: ${chiave}`);
    return valore.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opzioni?.[n] ?? ""));
  };
  return { t, esiste: (k: string) => typeof leggi(k) === "string" };
}

function voce(p: Partial<GdprDataMapItem> & Pick<GdprDataMapItem, "tableName" | "dataClass">): GdprDataMapItem {
  return {
    tableSchema: "sys",
    subjectFkColumn: "user_id",
    erasureStrategy: "DELETE",
    referenceKind: "SUBJECT",
    retentionDays: null,
    ageColumn: null,
    legalBasis: null,
    title: null,
    ...p,
  };
}

const NOME_FISICO = /\bsys_|\w+\.\w+_/;

describe("mappa dei dati personali: titoli e classi, non nomi fisici", () => {
  for (const lingua of ["it", "en"] as const) {
    const { t, esiste } = dizionario(lingua);

    it(`${lingua}: ogni classe di dato e ogni tipo di riferimento ha la sua etichetta`, () => {
      for (const c of GdprDataClassEnum.options) expect(t(`gdpr.classi.${c}`)).not.toMatch(/^[A-Z_]+$/);
      for (const r of GdprReferenceKindEnum.options) expect(t(`gdpr.riferimento.${r}`)).not.toMatch(/^[A-Z_]+$/);
    });

    it(`${lingua}: il titolo è quello dell'API, o il dizionario per le tabelle fuori dal catalogo`, () => {
      expect(titoloVoce({ title: "Coordinate bancarie", tableName: "sys_user_bank_details" }, t, esiste)).toBe("Coordinate bancarie");
      const lead = titoloVoce({ title: null, tableName: "sys_leads" }, t, esiste);
      expect(lead).toBe(t("gdpr.tabelle.sys_leads"));
      expect(lead).not.toMatch(NOME_FISICO);
      expect(titoloVoce({ title: null, tableName: "sys_ignota" }, t, esiste)).toBe(t("gdpr.senzaTitolo"));
    });

    it(`${lingua}: raggruppa per classe nell'ordine della tassonomia e spiega le tabelle ripetute`, () => {
      const gruppi = raggruppaMappa(
        [
          voce({ tableName: "sys_continuous_feedback", dataClass: "EVALUATION", title: "Feedback continuo", subjectFkColumn: "feedback_to_user_id" }),
          voce({ tableName: "sys_continuous_feedback", dataClass: "EVALUATION", title: "Feedback continuo", subjectFkColumn: "feedback_from_user_id", referenceKind: "ACTOR" }),
          voce({ tableName: "sys_users", dataClass: "IDENTITY", title: "Persona" }),
        ],
        t,
        esiste,
        lingua,
      );
      expect(gruppi.map((g) => g.classe)).toEqual(["IDENTITY", "EVALUATION"]);
      expect(gruppi[1]!.voci.every((v) => v.ripetuta === 2)).toBe(true);
      expect(gruppi[0]!.voci[0]!.ripetuta).toBe(1);
      expect(gruppi.flatMap((g) => g.voci.map((v) => v.titolo)).join(" ")).not.toMatch(NOME_FISICO);
      expect(t("gdpr.piuColonne", { count: 2 })).toContain("2");
    });
  }
});
