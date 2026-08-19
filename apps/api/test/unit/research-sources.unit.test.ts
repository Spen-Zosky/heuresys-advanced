/**
 * #132 F4b — la politica delle fonti, e il confine che regge sul caso limite.
 *
 * La proprieta' che conta di piu' non e' «una fonte approvata passa»: e' che
 * `bancaditalia.it` **non** copra `bancaditalia.it.attaccante.example`. Un confronto per
 * sottostringa passerebbe il primo caso e fallirebbe il secondo senza che nessuno se ne
 * accorga, perche' l'esito «ammessa» ha lo stesso aspetto in tutti e due.
 *
 * Ogni caso negativo ha la sua CONTROPROVA positiva: senza, una funzione che rispondesse
 * sempre «non ammessa» supererebbe l'intera batteria dei negativi.
 */
import { describe, it, expect } from "vitest";
import {
  hostOf,
  suffissoCopre,
  fonteAmmessa,
  CLASSI_AMMESSE,
  type FonteRegistrata,
} from "../../src/modules/research/sources.js";
import { RESEARCH_SOURCES_DOMAIN } from "../../src/modules/research/domains/index.js";
import { risolviDominio, chiaviDominio } from "../../src/modules/research/domains/index.js";
import type { ContestoRicerca } from "../../src/modules/research/domain.js";

const REGISTRO: FonteRegistrata[] = [
  { hostSuffix: "bancaditalia.it", label: "Banca d'Italia", classe: "INSTITUTIONAL", stato: "APPROVED", dominio: null },
  { hostSuffix: "istat.it", label: "ISTAT", classe: "INSTITUTIONAL", stato: "APPROVED", dominio: null },
  { hostSuffix: "forum.example", label: "Un forum", classe: "USER_GENERATED", stato: "REJECTED", dominio: null },
  { hostSuffix: "abi.it", label: "ABI", classe: "ACCREDITED", stato: "PROPOSED", dominio: null },
  { hostSuffix: "solo-processi.example", label: "Vale per un dominio solo", classe: "ACCREDITED", stato: "APPROVED", dominio: "business_processes" },
];

const CONTESTO: ContestoRicerca = {
  atecoCode: "64.19",
  atecoLabel: "Altre intermediazioni monetarie",
  sizeBandCode: "M",
  employeeCount: 158,
  countryCode: "IT",
  regulatoryIntensity: "HIGH",
  operatingModelCode: "RETAIL",
};

describe("hostOf — normalizza, e dice di no quando non e' un indirizzo", () => {
  it("estrae l'host abbassando le maiuscole e togliendo porta e credenziali", () => {
    expect(hostOf("https://DATI.BancaDItalia.it:8443/x?y#z")).toBe("dati.bancaditalia.it");
    expect(hostOf("https://utente:segreto@istat.it/x")).toBe("istat.it");
  });

  it("toglie il punto finale della radice, che altrimenti sfuggirebbe al confronto", () => {
    expect(hostOf("https://istat.it./x")).toBe("istat.it");
  });

  it("risponde null su cio' che non e' un indirizzo web", () => {
    expect(hostOf("non-un-indirizzo")).toBeNull();
    expect(hostOf("")).toBeNull();
    // Uno schema che non e' http/https non e' una pagina da leggere: e' un'altra cosa.
    expect(hostOf("javascript:alert(1)")).toBeNull();
    expect(hostOf("file:///etc/passwd")).toBeNull();
    expect(hostOf("data:text/html,<h1>x</h1>")).toBeNull();
  });
});

describe("suffissoCopre — il confine, non la sottostringa", () => {
  it("copre se stesso e i propri sottodomini", () => {
    expect(suffissoCopre("bancaditalia.it", "bancaditalia.it")).toBe(true);
    expect(suffissoCopre("bancaditalia.it", "dati.bancaditalia.it")).toBe(true);
    expect(suffissoCopre("bancaditalia.it", "a.b.c.bancaditalia.it")).toBe(true);
  });

  it("⚠ NON copre un host che lo contiene come prefisso — e' la trappola", () => {
    expect(suffissoCopre("bancaditalia.it", "bancaditalia.it.attaccante.example")).toBe(false);
  });

  it("NON copre un host che lo contiene senza confine di etichetta", () => {
    expect(suffissoCopre("istat.it", "falsoistat.it")).toBe(false);
    expect(suffissoCopre("istat.it", "istat.it.example")).toBe(false);
  });

  it("un suffisso vuoto non copre niente (altrimenti coprirebbe tutto)", () => {
    expect(suffissoCopre("", "istat.it")).toBe(false);
    expect(suffissoCopre("   ", "istat.it")).toBe(false);
  });
});

describe("fonteAmmessa — quattro rifiuti distinti, e un permesso", () => {
  it("ammette un sottodominio di una fonte approvata (la controprova positiva)", () => {
    const e = fonteAmmessa("https://dati.bancaditalia.it/serie", REGISTRO, "research_sources");
    expect(e.ammessa).toBe(true);
    if (e.ammessa) expect(e.fonte.hostSuffix).toBe("bancaditalia.it");
  });

  it("respinge l'host-trappola, e non con un errore generico", () => {
    const e = fonteAmmessa("https://bancaditalia.it.attaccante.example/x", REGISTRO, "research_sources");
    expect(e.ammessa).toBe(false);
    if (!e.ammessa) expect(e.motivo).toContain("sconosciuta");
  });

  it("distingue respinta, non-ancora-approvata e sconosciuta", () => {
    const respinta = fonteAmmessa("https://forum.example/t/1", REGISTRO, "research_sources");
    const inAttesa = fonteAmmessa("https://abi.it/x", REGISTRO, "research_sources");
    const ignota = fonteAmmessa("https://blog.qualunque.example/p", REGISTRO, "research_sources");
    expect([respinta.ammessa, inAttesa.ammessa, ignota.ammessa]).toEqual([false, false, false]);
    if (!respinta.ammessa) expect(respinta.motivo).toContain("respinta");
    if (!inAttesa.ammessa) expect(inAttesa.motivo).toContain("non ancora approvata");
    if (!ignota.ammessa) expect(ignota.motivo).toContain("sconosciuta");
  });

  it("una fonte vincolata a un dominio non vale per un altro", () => {
    const suo = fonteAmmessa("https://solo-processi.example/x", REGISTRO, "business_processes");
    const altrui = fonteAmmessa("https://solo-processi.example/x", REGISTRO, "research_sources");
    expect(suo.ammessa).toBe(true);
    expect(altrui.ammessa).toBe(false);
  });

  it("il suffisso piu' specifico vince su quello piu' generale", () => {
    const registro: FonteRegistrata[] = [
      ...REGISTRO,
      { hostSuffix: "sperimentale.istat.it", label: "Sezione respinta", classe: "INSTITUTIONAL", stato: "REJECTED", dominio: null },
    ];
    expect(fonteAmmessa("https://sperimentale.istat.it/x", registro, "research_sources").ammessa).toBe(false);
    expect(fonteAmmessa("https://dati.istat.it/x", registro, "research_sources").ammessa).toBe(true);
  });

  it("un indirizzo che non e' un indirizzo e' respinto, non ignorato", () => {
    expect(fonteAmmessa("javascript:alert(1)", REGISTRO, "research_sources").ammessa).toBe(false);
  });

  it("la classe del contenuto generato da utenti non e' fra quelle ammesse", () => {
    expect(CLASSI_AMMESSE.has("USER_GENERATED" as never)).toBe(false);
    expect(CLASSI_AMMESSE.size).toBe(3);
  });
});

describe("il dominio pilota research_sources", () => {
  it("e' dichiarato, e un dominio sconosciuto solleva invece di rispondere niente", () => {
    expect(chiaviDominio()).toContain("research_sources");
    expect(() => risolviDominio("un_dominio_mai_dichiarato")).toThrow(/sconosciuto/i);
  });

  it("le domande nominano i parametri di categoria e NON il cliente", () => {
    const d = RESEARCH_SOURCES_DOMAIN.domande(CONTESTO);
    expect(d.length).toBeGreaterThan(0);
    const tutte = d.join(" ");
    expect(tutte).toContain("64.19");
    expect(tutte).toContain("IT");
    expect(tutte).toContain("158");
    // La firma del tipo non espone il fascicolo: qui si verifica che non compaia comunque
    // un nome di azienda per altra via (interpolazione di una costante, per esempio).
    expect(tutte).not.toMatch(/RTL|Heuresys|rtl-bank/i);
  });

  it("respinge un suffisso scritto come indirizzo, come fa il database", () => {
    expect(RESEARCH_SOURCES_DOMAIN.forma.safeParse({
      hostSuffix: "https://istat.it/",
      label: "ISTAT",
      classe: "INSTITUTIONAL",
      paese: "IT",
      dominioApplicabile: null,
      motivazione: "L'istituto nazionale di statistica pubblica i dati ufficiali sulle imprese.",
    }).success).toBe(false);

    expect(RESEARCH_SOURCES_DOMAIN.forma.safeParse({
      hostSuffix: "istat.it",
      label: "ISTAT",
      classe: "INSTITUTIONAL",
      paese: "IT",
      dominioApplicabile: null,
      motivazione: "L'istituto nazionale di statistica pubblica i dati ufficiali sulle imprese.",
    }).success).toBe(true);
  });

  it("la prova di una fonte dev'essere la fonte stessa", () => {
    const proposta = RESEARCH_SOURCES_DOMAIN.forma.parse({
      hostSuffix: "istat.it",
      label: "ISTAT",
      classe: "INSTITUTIONAL",
      paese: "IT",
      dominioApplicabile: null,
      motivazione: "L'istituto nazionale di statistica pubblica i dati ufficiali sulle imprese.",
    });
    const regola = (evidenze: string[]) =>
      RESEARCH_SOURCES_DOMAIN.controlli
        .map((c) => c(proposta, CONTESTO, evidenze))
        .find((r) => r.regola === "SOURCE_EVIDENCE_IS_SELF")!;

    expect(regola(["https://www.istat.it/it/imprese"]).esito).toBe("PASSED");
    expect(regola(["https://blog.qualunque.example/istat-e-bello"]).esito).toBe("FAILED");
    expect(regola([]).esito).toBe("FAILED");
  });

  it("una fonte di contenuto generato da utenti e' respinta, non segnalata", () => {
    const proposta = RESEARCH_SOURCES_DOMAIN.forma.parse({
      hostSuffix: "forum.example",
      label: "Un forum",
      classe: "USER_GENERATED",
      paese: "IT",
      dominioApplicabile: null,
      motivazione: "Contiene molte discussioni sul settore bancario e sui suoi processi.",
    });
    const esiti = RESEARCH_SOURCES_DOMAIN.controlli.map((c) =>
      c(proposta, CONTESTO, ["https://forum.example/t/1"]),
    );
    expect(esiti.find((r) => r.regola === "SOURCE_CLASS_USER_GENERATED")?.esito).toBe("FAILED");
  });

  it("un paese diverso avvisa, non blocca", () => {
    const proposta = RESEARCH_SOURCES_DOMAIN.forma.parse({
      hostSuffix: "europa.eu",
      label: "Unione Europea",
      classe: "INSTITUTIONAL",
      paese: "BE",
      dominioApplicabile: null,
      motivazione: "Portale ufficiale dell'Unione Europea, con i testi normativi applicabili.",
    });
    const esiti = RESEARCH_SOURCES_DOMAIN.controlli.map((c) =>
      c(proposta, CONTESTO, ["https://europa.eu/x"]),
    );
    expect(esiti.find((r) => r.regola === "SOURCE_COUNTRY_DIFFERS")?.esito).toBe("WARNING");
    expect(esiti.some((r) => r.esito === "FAILED")).toBe(false);
  });

  it("l'eccezione sul registro e' dichiarata sul dominio, e vale solo per questo", () => {
    expect(RESEARCH_SOURCES_DOMAIN.fontiConfrontateColRegistro).toBe(false);
    // ...ma le fonti restano obbligatorie: cio' che salta e' il confronto, non l'obbligo.
    expect(RESEARCH_SOURCES_DOMAIN.minimoFonti).toBeGreaterThanOrEqual(1);
  });
});
