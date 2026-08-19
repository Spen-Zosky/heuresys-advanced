/**
 * apps/api/src/modules/research/ponte.ts
 *
 * IL PONTE (#132 F6) — le proposte approvate diventano il contenuto di un modello.
 *
 * E' l'ultimo passo prima che una ricerca serva a qualcosa: fino a qui c'erano proposte con
 * le loro fonti e la decisione di una persona; da qui in poi c'e' un modello che il
 * costruttore (`#198`) sa realizzare in un'azienda vera.
 *
 * ⚠ QUI SI VERIFICANO I CATALOGHI, e il posto e' questo per una ragione precisa. I domini di
 * `F5` non controllano il tipo di un'unita', la specie di una competenza o il verso di un
 * indicatore: quei vocabolari vivono in **tabelle**, e un controllo puro che ne ricopiasse
 * l'elenco sarebbe una misura variabile cristallizzata (⭐ IL PUNTO FISSO). Qui il catalogo
 * arriva come **parametro**, letto dal database un attimo prima: la funzione resta pura e
 * provabile, e cio' che verifica e' il vocabolario **vero**, non una sua copia invecchiata.
 *
 * ⚠ E SI VERIFICA ORA, NON DOPO. Una proposta col tipo sbagliato passerebbe il cancello e
 * romperebbe la **costruzione** — cioe' molto piu' tardi, dove attribuirla e' difficile. E'
 * la stessa forma del difetto che `F2` ha corretto sull'ordine delle unita': un dato che
 * sembra buono finche' qualcuno non prova a usarlo.
 */
import type { RisultatoControllo } from "./domain.js";

/** I vocabolari veri, letti dal database prima di applicare. */
export interface Cataloghi {
  tipiUnita: ReadonlySet<string>;
  specieCompetenza: ReadonlySet<string>;
  versiIndicatore: ReadonlySet<string>;
}

export interface PropostaApprovata {
  candidateId: string;
  dominio: string;
  chiaveNaturale: string;
  contenuto: unknown;
  /** Chi l'ha approvata e perche': il registro delle fonti li pretende per vincolo. */
  approvatoreUserId?: string | null;
  motivazione?: string | null;
}

/** Una riga pronta per il database, per dominio. */
export interface ContenutoDaScrivere {
  units: Array<{ code: string; name: string; nameEn: string; parentCode: string | null; unitType: string; level: number }>;
  positions: Array<{ code: string; title: string; titleEn: string; unitCode: string; criticality: string }>;
  skills: Array<{ code: string; name: string; nameEn: string; kind: string; category: string | null }>;
  kpis: Array<{ code: string; name: string; nameEn: string; unit: string | null; direction: string }>;
  processes: Array<{ code: string; name: string; nameEn: string; ordinal: number; ownerPositionCode: string | null; isOptional: boolean }>;
  /**
   * ⚠ LE FONTI NON SONO CONTENUTO DI MODELLO, e hanno una destinazione propria: il registro
   * `sys_research_sources`. Trovato dal test di integrazione, non dal ragionamento: senza
   * questa strada una proposta di fonte approvata resta APPROVATA per sempre e **blocca il
   * ponte**, perche' non e' applicabile al modello e il ponte non applica niente a meta'.
   */
  sources: Array<{
    hostSuffix: string;
    label: string;
    classe: string;
    paese: string | null;
    dominio: string | null;
    motivazione: string;
    approvatoreUserId: string | null;
  }>;
}

export interface EsitoTraduzione {
  contenuto: ContenutoDaScrivere;
  /** Le proposte che NON si possono applicare, con il motivo. */
  respinte: Array<{ candidateId: string; chiaveNaturale: string; controllo: RisultatoControllo }>;
  /** Gli identificativi delle proposte tradotte: sono quelle da marcare `APPLIED`. */
  applicate: string[];
}

const vuoto = (): ContenutoDaScrivere => ({ units: [], positions: [], skills: [], kpis: [], processes: [], sources: [] });

function s(v: unknown, campo: string): string {
  const x = (v as Record<string, unknown>)[campo];
  return typeof x === "string" ? x : "";
}
function sn(v: unknown, campo: string): string | null {
  const x = (v as Record<string, unknown>)[campo];
  return typeof x === "string" && x.length > 0 ? x : null;
}
function n(v: unknown, campo: string, difetto = 0): number {
  const x = (v as Record<string, unknown>)[campo];
  return typeof x === "number" && Number.isFinite(x) ? x : difetto;
}
function b(v: unknown, campo: string): boolean {
  return (v as Record<string, unknown>)[campo] === true;
}

/**
 * Da proposte approvate a righe di contenuto, verificando i cataloghi.
 *
 * Non scrive niente e non solleva: **restituisce** cio' che si puo' applicare e cio' che no,
 * col motivo. Chi chiama decide se applicare il parziale o fermarsi — e la decisione e' del
 * servizio, che sa se sta rispondendo a una persona o a un programma.
 */
export function traduciProposte(
  proposte: readonly PropostaApprovata[],
  cataloghi: Cataloghi,
): EsitoTraduzione {
  const contenuto = vuoto();
  const respinte: EsitoTraduzione["respinte"] = [];
  const applicate: string[] = [];

  const respingi = (p: PropostaApprovata, regola: string, messaggio: string) =>
    respinte.push({ candidateId: p.candidateId, chiaveNaturale: p.chiaveNaturale, controllo: { regola, esito: "FAILED", messaggio } });

  for (const p of proposte) {
    const c = p.contenuto;
    switch (p.dominio) {
      case "organization_units": {
        const tipo = s(c, "unitType");
        if (!cataloghi.tipiUnita.has(tipo)) {
          respingi(p, "CATALOG_UNIT_TYPE_UNKNOWN",
            `"${p.chiaveNaturale}" dichiara il tipo di unita' "${tipo}", che il catalogo non conosce. Ammessi: ${[...cataloghi.tipiUnita].sort().join(", ")}.`);
          continue;
        }
        contenuto.units.push({
          code: s(c, "code"), name: s(c, "name"), nameEn: s(c, "nameEn"),
          parentCode: sn(c, "parentCode"), unitType: tipo, level: n(c, "level"),
        });
        break;
      }
      case "positions":
        contenuto.positions.push({
          code: s(c, "code"), title: s(c, "name"), titleEn: s(c, "nameEn"),
          unitCode: s(c, "unitCode"), criticality: s(c, "criticality") || "MEDIUM",
        });
        break;
      case "skills": {
        const specie = s(c, "kind");
        if (!cataloghi.specieCompetenza.has(specie)) {
          respingi(p, "CATALOG_SKILL_KIND_UNKNOWN",
            `"${p.chiaveNaturale}" dichiara la specie "${specie}", che il catalogo delle competenze non conosce. Ammesse: ${[...cataloghi.specieCompetenza].sort().join(", ")}.`);
          continue;
        }
        contenuto.skills.push({
          code: s(c, "code"), name: s(c, "name"), nameEn: s(c, "nameEn"),
          kind: specie, category: sn(c, "category"),
        });
        break;
      }
      case "kpis": {
        const verso = s(c, "direction");
        if (!cataloghi.versiIndicatore.has(verso)) {
          respingi(p, "CATALOG_KPI_DIRECTION_UNKNOWN",
            `"${p.chiaveNaturale}" dichiara il verso "${verso}", che il prodotto non conosce. Ammessi: ${[...cataloghi.versiIndicatore].sort().join(", ")}.`);
          continue;
        }
        contenuto.kpis.push({
          code: s(c, "code"), name: s(c, "name"), nameEn: s(c, "nameEn"),
          unit: sn(c, "unit"), direction: verso,
        });
        break;
      }
      case "business_processes":
        contenuto.processes.push({
          code: s(c, "code"), name: s(c, "name"), nameEn: s(c, "nameEn"),
          ordinal: n(c, "ordinal"), ownerPositionCode: sn(c, "ownerPositionCode"), isOptional: b(c, "isOptional"),
        });
        break;
      case "research_sources": {
        // La destinazione e' il registro delle fonti (§4.3): «l'elenco non lo scrive nessuno a
        // mano, nasce da una ricerca e lo approva un umano». La riga porta approvatore e
        // motivazione della DECISIONE, che il vincolo del database pretende per una fonte
        // approvata — e sono quelli veri, non un valore di comodo.
        const motivazione = (p.motivazione ?? "").trim();
        if (motivazione.length === 0) {
          respingi(p, "SOURCE_APPROVAL_RATIONALE_MISSING",
            `"${p.chiaveNaturale}" e' approvata ma senza motivazione: una fonte approvata senza il perche' e' impossibile per vincolo, non per disciplina.`);
          continue;
        }
        contenuto.sources.push({
          hostSuffix: s(c, "hostSuffix"),
          label: s(c, "label"),
          classe: s(c, "classe"),
          paese: sn(c, "paese"),
          dominio: sn(c, "dominioApplicabile"),
          motivazione,
          approvatoreUserId: p.approvatoreUserId ?? null,
        });
        break;
      }
      default:
        respingi(p, "DOMAIN_NOT_APPLICABLE",
          `Il dominio "${p.dominio}" non ha una destinazione: le sue proposte non si applicano da nessuna parte.`);
        continue;
    }
    applicate.push(p.candidateId);
  }

  // ⚠ LA COERENZA INTERNA, che si vede solo guardando l'INSIEME — ed e' il difetto che F2 ha
  // gia' pagato una volta: un legame per codice che punta a un codice inesistente non rompe
  // qui, rompe alla costruzione. Le posizioni devono trovare la loro unita', e i processi la
  // posizione che li presidia.
  const codiciUnita = new Set(contenuto.units.map((u) => u.code));
  const codiciPosizione = new Set(contenuto.positions.map((p) => p.code));
  const orfane = contenuto.positions.filter((p) => p.unitCode !== "" && !codiciUnita.has(p.unitCode));
  const presidiIgnoti = contenuto.processes.filter(
    (p) => p.ownerPositionCode !== null && !codiciPosizione.has(p.ownerPositionCode),
  );

  return {
    contenuto,
    applicate,
    respinte: [
      ...respinte,
      ...orfane.map((p) => ({
        candidateId: "",
        chiaveNaturale: p.code,
        controllo: {
          regola: "CONTENT_UNIT_CODE_UNRESOLVED",
          esito: "FAILED" as const,
          messaggio: `La posizione "${p.code}" siede nell'unita' "${p.unitCode}", che nessuna proposta approvata definisce.`,
        },
      })),
      ...presidiIgnoti.map((p) => ({
        candidateId: "",
        chiaveNaturale: p.code,
        controllo: {
          regola: "CONTENT_OWNER_CODE_UNRESOLVED",
          esito: "WARNING" as const,
          messaggio: `Il processo "${p.code}" e' presidiato da "${p.ownerPositionCode}", che nessuna proposta approvata definisce.`,
        },
      })),
    ],
  };
}

/** Cio' che il ponte ha scritto, per dominio: serve al referto e al test. */
export interface ConteggiApplicazione {
  units: number;
  positions: number;
  skills: number;
  kpis: number;
  processes: number;
  sources: number;
}

export function conta(c: ContenutoDaScrivere): ConteggiApplicazione {
  return {
    units: c.units.length,
    positions: c.positions.length,
    skills: c.skills.length,
    kpis: c.kpis.length,
    processes: c.processes.length,
    sources: c.sources.length,
  };
}
