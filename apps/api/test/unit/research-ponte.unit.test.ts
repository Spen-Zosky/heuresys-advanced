/**
 * #132 F6 — il ponte: da proposte approvate a contenuto di modello.
 *
 * I casi che contano sono quelli in cui il ponte deve dire **no**, e il perche' e' sempre lo
 * stesso: un modello che passa il cancello e si rompe alla costruzione e' il difetto peggiore
 * di tutta questa catena, perche' si manifesta lontano dal punto in cui e' nato.
 *
 * I cataloghi arrivano come parametro: qui sono finti, e nel servizio sono letti dal database
 * un attimo prima. La funzione resta pura, e cio' che verifica in produzione e' il vocabolario
 * vero — non una sua copia invecchiata (⭐ IL PUNTO FISSO).
 */
import { describe, it, expect } from "vitest";
import { traduciProposte, conta, type PropostaApprovata, type Cataloghi } from "../../src/modules/research/ponte.js";

const CATALOGHI: Cataloghi = {
  tipiUnita: new Set(["DIVISION", "DEPARTMENT", "OFFICE", "BRANCH", "PLANT", "WAREHOUSE", "TEAM"]),
  specieCompetenza: new Set(["SKILL", "KNOWLEDGE", "COMPETENCE", "BEHAVIOR", "OTHER"]),
  versiIndicatore: new Set(["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "TARGET_RANGE"]),
};

const p = (n: number, dominio: string, contenuto: unknown, chiave = `K${n}`): PropostaApprovata => ({
  candidateId: `00000000-0000-0000-0000-00000000000${n}`,
  dominio,
  chiaveNaturale: chiave,
  contenuto,
});

const UNITA = { code: "DIR-RISK", name: "Direzione Rischi", nameEn: "Risk Management", parentCode: null, unitType: "DIVISION", level: 0 };
const POSIZIONE = { code: "CRO", name: "Direttore Rischi", nameEn: "Chief Risk Officer", unitCode: "DIR-RISK", criticality: "CRITICAL" };

describe("cio' che si traduce", () => {
  it("porta i cinque domini nelle loro case, coi nomi bilingui", () => {
    const e = traduciProposte(
      [
        p(1, "organization_units", UNITA, "DIR-RISK"),
        p(2, "positions", POSIZIONE, "CRO"),
        p(3, "skills", { code: "CREDIT-RISK", name: "Rischio di credito", nameEn: "Credit Risk", kind: "KNOWLEDGE" }, "CREDIT-RISK"),
        p(4, "kpis", { code: "NPL", name: "Indice sofferenze", nameEn: "NPL Ratio", direction: "LOWER_IS_BETTER", unit: "%" }, "NPL"),
        p(5, "business_processes", { code: "KYC", name: "Adeguata verifica", nameEn: "Know Your Customer", ordinal: 1, ownerPositionCode: "CRO" }, "KYC"),
      ],
      CATALOGHI,
    );
    expect(conta(e.contenuto)).toEqual({ units: 1, positions: 1, skills: 1, kpis: 1, processes: 1, sources: 0 });
    expect(e.applicate).toHaveLength(5);
    expect(e.respinte).toHaveLength(0);
    expect(e.contenuto.units[0]!.nameEn).toBe("Risk Management");
    expect(e.contenuto.processes[0]!.ownerPositionCode).toBe("CRO");
  });
});

describe("cio' che NON si traduce, e con quale nome", () => {
  it("⚠ un tipo di unita' che il catalogo non conosce", () => {
    const e = traduciProposte([p(1, "organization_units", { ...UNITA, unitType: "SUCCURSALE" })], CATALOGHI);
    expect(e.contenuto.units).toHaveLength(0);
    expect(e.applicate).toHaveLength(0);
    expect(e.respinte[0]!.controllo.regola).toBe("CATALOG_UNIT_TYPE_UNKNOWN");
    // Il messaggio elenca cosa e' ammesso: chi lo legge non deve andarselo a cercare.
    expect(e.respinte[0]!.controllo.messaggio).toContain("DIVISION");
  });

  it("una specie di competenza che il catalogo non conosce", () => {
    const e = traduciProposte([p(1, "skills", { code: "X", name: "a", nameEn: "b", kind: "TECHNICAL" })], CATALOGHI);
    expect(e.respinte[0]!.controllo.regola).toBe("CATALOG_SKILL_KIND_UNKNOWN");
  });

  it("un verso di indicatore che il prodotto non conosce", () => {
    const e = traduciProposte([p(1, "kpis", { code: "X", name: "a", nameEn: "b", direction: "TARGET_IS_BEST" })], CATALOGHI);
    expect(e.respinte[0]!.controllo.regola).toBe("CATALOG_KPI_DIRECTION_UNKNOWN");
  });

  it("⚠ una posizione che siede in un'unita' che nessuno ha proposto", () => {
    const e = traduciProposte([p(1, "positions", { ...POSIZIONE, unitCode: "DIR-MAI-VISTA" })], CATALOGHI);
    const r = e.respinte.find((x) => x.controllo.regola === "CONTENT_UNIT_CODE_UNRESOLVED");
    expect(r).toBeDefined();
    expect(r!.controllo.esito).toBe("FAILED");
  });

  it("un processo presidiato da una posizione che nessuno ha proposto: AVVISO, non rifiuto", () => {
    const e = traduciProposte(
      [p(1, "business_processes", { code: "KYC", name: "a", nameEn: "b", ordinal: 0, ownerPositionCode: "MAI-VISTO" })],
      CATALOGHI,
    );
    const r = e.respinte.find((x) => x.controllo.regola === "CONTENT_OWNER_CODE_UNRESOLVED");
    expect(r!.controllo.esito).toBe("WARNING");
    // ...e il processo si applica lo stesso: un avviso non ferma.
    expect(e.contenuto.processes).toHaveLength(1);
    expect(e.applicate).toHaveLength(1);
  });

  it("⚠ il dominio delle FONTI ha la sua destinazione: il registro, non il modello", () => {
    const e = traduciProposte(
      [{ candidateId: "id-1", dominio: "research_sources", chiaveNaturale: "istat.it|*",
         contenuto: { hostSuffix: "istat.it", label: "ISTAT", classe: "INSTITUTIONAL", paese: "IT", dominioApplicabile: null },
         approvatoreUserId: "chi-ha-approvato", motivazione: "fonte istituzionale, verificata aprendola" }],
      CATALOGHI,
    );
    expect(e.contenuto.sources).toHaveLength(1);
    expect(e.contenuto.sources[0]!.approvatoreUserId).toBe("chi-ha-approvato");
    expect(e.applicate).toEqual(["id-1"]);
    expect(e.contenuto.units).toHaveLength(0);
  });

  it("una fonte approvata SENZA motivazione non entra nel registro: il vincolo la respingerebbe", () => {
    const e = traduciProposte(
      [{ candidateId: "id-2", dominio: "research_sources", chiaveNaturale: "istat.it|*",
         contenuto: { hostSuffix: "istat.it", label: "ISTAT", classe: "INSTITUTIONAL" },
         approvatoreUserId: "x", motivazione: "  " }],
      CATALOGHI,
    );
    expect(e.respinte[0]!.controllo.regola).toBe("SOURCE_APPROVAL_RATIONALE_MISSING");
    expect(e.applicate).toHaveLength(0);
  });

  it("un dominio senza destinazione non si applica in silenzio", () => {
    const e = traduciProposte([p(1, "un_dominio_ignoto", {})], CATALOGHI);
    expect(e.respinte[0]!.controllo.regola).toBe("DOMAIN_NOT_APPLICABLE");
    expect(e.applicate).toHaveLength(0);
  });

  it("una sola proposta guasta non porta via le altre dall'elenco: si vede tutto", () => {
    const e = traduciProposte(
      [p(1, "organization_units", UNITA, "DIR-RISK"), p(2, "organization_units", { ...UNITA, code: "X", unitType: "IGNOTO" }, "X")],
      CATALOGHI,
    );
    expect(e.contenuto.units).toHaveLength(1);
    expect(e.respinte).toHaveLength(1);
    // Chi chiama decide: il servizio, davanti a un FAILED, non applica NIENTE.
    expect(e.respinte[0]!.controllo.esito).toBe("FAILED");
  });
});
