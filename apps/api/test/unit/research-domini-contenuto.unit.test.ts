/**
 * #132 F5 — i cinque domini di contenuto.
 *
 * La proprieta' che questa batteria protegge non e' «i domini esistono»: e' che **aggiungerli
 * sia stato dichiarare, non toccare il motore**. Se un domani per farne entrare uno servisse
 * cambiare `engine.ts`, il contratto di `domain.ts` sarebbe sbagliato — e il caso che lo
 * verifica e' l'ultimo di questo file, che fa girare il motore su tutti e cinque senza
 * conoscerne nessuno per nome.
 */
import { describe, it, expect } from "vitest";
import { chiaviDominio, risolviDominio, DOMINI_DI_CONTENUTO } from "../../src/modules/research/domains/index.js";
import {
  ORGANIZATION_UNITS_DOMAIN,
  POSITIONS_DOMAIN,
  KPIS_DOMAIN,
  BUSINESS_PROCESSES_DOMAIN,
  SKILLS_DOMAIN,
} from "../../src/modules/research/domains/contenuto-del-modello.js";
import { valutaProposte } from "../../src/modules/research/engine.js";
import type { ContestoRicerca, DominioRicercabile } from "../../src/modules/research/domain.js";
import type { PaginaLetta } from "../../src/modules/research/web-reader.js";

const CONTESTO: ContestoRicerca = {
  atecoCode: "64.19",
  atecoLabel: "Altre intermediazioni monetarie",
  sizeBandCode: "M",
  employeeCount: 158,
  countryCode: "IT",
  regulatoryIntensity: "HIGH",
  operatingModelCode: "RETAIL",
};

const pagina = (url: string): PaginaLetta => ({
  urlRichiesto: url, url, status: 200, contentType: "text/html", byte: 10,
  sha256: "c".repeat(64), retrievedAt: "2026-08-19T21:00:00.000Z",
  testoNonFidato: "contenuto di una pagina istituzionale", troncato: false,
});

const regola = (c: Array<{ regola: string; esito: string }>, nome: string) =>
  c.find((x) => x.regola === nome)?.esito;

describe("i cinque domini sono dichiarati, e sono cinque", () => {
  it("il registro li conosce tutti, piu' il pilota", () => {
    const chiavi = chiaviDominio();
    for (const k of ["research_sources", "organization_units", "positions", "skills", "kpis", "business_processes"]) {
      expect(chiavi, k).toContain(k);
    }
    expect(DOMINI_DI_CONTENUTO).toHaveLength(5);
  });

  it("⚠ tutti e cinque CONFRONTANO le fonti col registro: l'eccezione e' del solo pilota", () => {
    for (const d of DOMINI_DI_CONTENUTO) {
      expect(d.fontiConfrontateColRegistro, d.chiave).toBe(true);
      expect(d.minimoFonti, d.chiave).toBeGreaterThanOrEqual(1);
    }
    expect(risolviDominio("research_sources").fontiConfrontateColRegistro).toBe(false);
  });

  it("le domande nominano i parametri di categoria e non il cliente", () => {
    for (const d of DOMINI_DI_CONTENUTO) {
      const testo = d.domande(CONTESTO).join(" ");
      expect(testo, d.chiave).toContain("64.19");
      expect(testo, d.chiave).toContain("158");
      expect(testo, d.chiave).not.toMatch(/RTL|rtl-bank/i);
    }
  });

  it("ogni dominio ha una chiave naturale che e' il codice", () => {
    expect(ORGANIZATION_UNITS_DOMAIN.chiaveNaturale({ code: "DIR-RISK" } as never)).toBe("DIR-RISK");
    expect(POSITIONS_DOMAIN.chiaveNaturale({ code: "CRO" } as never)).toBe("CRO");
  });
});

describe("i controlli che si possono fare guardando la sola proposta", () => {
  const unita = (o: Partial<{ code: string; parentCode: string | null; level: number }>) =>
    ORGANIZATION_UNITS_DOMAIN.forma.parse({
      code: "DIR-RISK", name: "Direzione Rischi", nameEn: "Risk Management",
      unitType: "DIVISION", level: 1, parentCode: "CDA", ...o,
    });

  it("la radice sta a livello 0, e chi ha un padre non ci sta", () => {
    const buona = ORGANIZATION_UNITS_DOMAIN.controlli.map((c) => c(unita({}), CONTESTO, []));
    expect(regola(buona, "UNIT_ROOT_LEVEL")).toBe("PASSED");

    const radiceSbagliata = ORGANIZATION_UNITS_DOMAIN.controlli.map((c) =>
      c(unita({ parentCode: null, level: 2 }), CONTESTO, []),
    );
    expect(regola(radiceSbagliata, "UNIT_ROOT_LEVEL")).toBe("FAILED");

    const figlioSbagliato = ORGANIZATION_UNITS_DOMAIN.controlli.map((c) =>
      c(unita({ parentCode: "CDA", level: 0 }), CONTESTO, []),
    );
    expect(regola(figlioSbagliato, "UNIT_ROOT_LEVEL")).toBe("FAILED");
  });

  it("un'unita' che dipende da se' stessa e' respinta", () => {
    const esiti = ORGANIZATION_UNITS_DOMAIN.controlli.map((c) =>
      c(unita({ code: "DIR-RISK", parentCode: "DIR-RISK", level: 1 }), CONTESTO, []),
    );
    expect(regola(esiti, "UNIT_ROOT_LEVEL")).toBe("FAILED");
  });

  it("una posizione che riporta a se' stessa e' respinta", () => {
    const p = POSITIONS_DOMAIN.forma.parse({
      code: "CRO", name: "Direttore Rischi", nameEn: "Chief Risk Officer",
      unitCode: "DIR-RISK", reportsToCode: "CRO",
    });
    expect(regola(POSITIONS_DOMAIN.controlli.map((c) => c(p, CONTESTO, [])), "POSITION_REPORTS_TO_SELF")).toBe("FAILED");
  });

  it("un nome inglese uguale a quello italiano avvisa, non blocca", () => {
    const k = KPIS_DOMAIN.forma.parse({
      code: "NPL-RATIO", name: "NPL Ratio", nameEn: "npl ratio", direction: "LOWER_IS_BETTER", unit: "%",
    });
    const esiti = KPIS_DOMAIN.controlli.map((c) => c(k, CONTESTO, []));
    expect(regola(esiti, "BILINGUAL_NAMES_DISTINCT")).toBe("WARNING");
    expect(esiti.some((e) => e.esito === "FAILED")).toBe(false);
  });

  it("un intervallo-obiettivo senza unita' di misura avvisa", () => {
    const k = KPIS_DOMAIN.forma.parse({
      code: "LCR", name: "Indice di liquidita'", nameEn: "Liquidity Coverage Ratio",
      direction: "TARGET_RANGE", unit: null,
    });
    expect(regola(KPIS_DOMAIN.controlli.map((c) => c(k, CONTESTO, [])), "KPI_RANGE_NEEDS_UNIT")).toBe("WARNING");
  });

  it("un processo obbligatorio senza presidio avvisa", () => {
    const p = BUSINESS_PROCESSES_DOMAIN.forma.parse({
      code: "KYC", name: "Adeguata verifica", nameEn: "Know Your Customer", ordinal: 1,
    });
    expect(regola(BUSINESS_PROCESSES_DOMAIN.controlli.map((c) => c(p, CONTESTO, [])), "PROCESS_NEEDS_OWNER")).toBe("WARNING");
  });

  it("la forma respinge un codice minuscolo o con spazi", () => {
    expect(SKILLS_DOMAIN.forma.safeParse({ code: "credit risk", name: "Rischio", nameEn: "Risk", kind: "TECHNICAL" }).success).toBe(false);
    expect(SKILLS_DOMAIN.forma.safeParse({ code: "CREDIT-RISK", name: "Rischio di credito", nameEn: "Credit Risk", kind: "TECHNICAL" }).success).toBe(true);
  });
});

describe("⚠ il motore non conosce nessuno di questi domini per nome", () => {
  it("li valuta tutti e cinque con lo stesso codice, e li respinge per la stessa regola", () => {
    // Una proposta valida nella forma ma SENZA fonti: dev'essere respinta su SOURCES_PRESENT
    // in ognuno dei cinque, senza che il motore sappia di che dominio si tratti.
    const proposte: Record<string, unknown> = {
      organization_units: { code: "DIR-RISK", name: "Direzione Rischi", nameEn: "Risk Management", unitType: "DIVISION", level: 1, parentCode: "CDA" },
      positions: { code: "CRO", name: "Direttore Rischi", nameEn: "Chief Risk Officer", unitCode: "DIR-RISK" },
      skills: { code: "CREDIT-RISK", name: "Rischio di credito", nameEn: "Credit Risk", kind: "TECHNICAL" },
      kpis: { code: "NPL-RATIO", name: "Indice sofferenze", nameEn: "NPL Ratio", direction: "LOWER_IS_BETTER" },
      business_processes: { code: "KYC", name: "Adeguata verifica", nameEn: "Know Your Customer", ordinal: 1, ownerPositionCode: "CRO" },
    };

    for (const d of DOMINI_DI_CONTENUTO as ReadonlyArray<DominioRicercabile<unknown>>) {
      const senzaFonti = valutaProposte({
        dominio: d, contesto: CONTESTO, registroFonti: [], chiaviGiaPresenti: new Set(),
        grezze: [{ contenuto: proposte[d.chiave], fonti: [] }], letture: new Map(),
      });
      expect(senzaFonti[0]!.stato, d.chiave).toBe("FAILED");
      expect(regola(senzaFonti[0]!.controlli, "SOURCES_PRESENT"), d.chiave).toBe("FAILED");
      expect(regola(senzaFonti[0]!.controlli, "SHAPE_VALID"), d.chiave).toBe("PASSED");

      // ...e con una fonte letta e approvata passa: la controprova, dominio per dominio.
      const url = "https://www.bancaditalia.it/x";
      const conFonte = valutaProposte({
        dominio: d, contesto: CONTESTO, chiaviGiaPresenti: new Set(),
        registroFonti: [{ hostSuffix: "bancaditalia.it", label: "Banca d'Italia", classe: "INSTITUTIONAL", stato: "APPROVED", dominio: null }],
        grezze: [{ contenuto: proposte[d.chiave], fonti: [url] }],
        letture: new Map([[url, pagina(url)]]),
      });
      expect(conFonte[0]!.stato, d.chiave).toBe("PASSED");
      expect(regola(conFonte[0]!.controlli, "SOURCES_POLICY"), d.chiave).toBe("PASSED");
    }
  });

  it("e una fonte non ammessa li respinge tutti, con la stessa regola", () => {
    const url = "https://blog.qualunque.example/x";
    for (const d of DOMINI_DI_CONTENUTO as ReadonlyArray<DominioRicercabile<unknown>>) {
      const esito = valutaProposte({
        dominio: d, contesto: CONTESTO, chiaviGiaPresenti: new Set(),
        registroFonti: [{ hostSuffix: "istat.it", label: "ISTAT", classe: "INSTITUTIONAL", stato: "APPROVED", dominio: null }],
        grezze: [{ contenuto: { code: "X-1", name: "Qualcosa", nameEn: "Something", unitType: "DIVISION", level: 0, parentCode: null, unitCode: "UNIT-1", kind: "TECHNICAL", direction: "LOWER_IS_BETTER", ordinal: 0 }, fonti: [url] }],
        letture: new Map([[url, pagina(url)]]),
      });
      expect(regola(esito[0]!.controlli, "SOURCES_POLICY"), d.chiave).toBe("FAILED");
    }
  });
});
