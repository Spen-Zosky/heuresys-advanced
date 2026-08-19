/**
 * apps/api/src/modules/research/domains/contenuto-del-modello.ts
 *
 * I CINQUE DOMINI DI CONTENUTO (#132 F5) — unita', posizioni, competenze, indicatori,
 * processi. Sono cio' che, approvato, diventa il modello di un fascicolo (`F6`).
 *
 * PERCHE' STANNO IN UN FILE SOLO. Condividono la stessa forma — un **codice** che e' la chiave
 * naturale, un nome **bilingue** (E16), e i legami interni espressi **per codice** e non per
 * identificativo — e gli stessi due controlli di fondo. Metterli in cinque file avrebbe
 * ricopiato cinque volte le stesse quindici righe; il piano diceva «il primo costa la forma,
 * gli altri quattro la riusano», ed e' esattamente cosi'.
 *
 * ⚠ I LEGAMI SONO PER CODICE, MAI PER UUID. Una proposta nasce da una pagina web: non puo'
 * conoscere l'identificativo di una riga che non esiste ancora. E' la stessa scelta della
 * mig. `000327` per le tabelle di contenuto, e le due devono restare d'accordo.
 *
 * ⚠ COSA QUESTI DOMINI **NON** CONTROLLANO, e non e' una dimenticanza: il tipo di un'unita',
 * la specie di una competenza e il verso di un indicatore vivono in **cataloghi del database**,
 * e un controllo puro che ne ricopiasse l'elenco sarebbe una misura variabile cristallizzata
 * (⭐ IL PUNTO FISSO). Li verifica chi ha il database davanti — il ponte `F6` — con il
 * messaggio d'errore nel posto dove serve. Qui si controlla cio' che si puo' controllare
 * guardando la sola proposta: la forma, la coerenza interna, e le fonti.
 *
 * ⚠ TUTTI E CINQUE CONFRONTANO LE FONTI COL REGISTRO (`fontiConfrontateColRegistro: true`).
 * L'eccezione vale per il solo `research_sources`, che il registro lo costruisce. Finche'
 * nessuna fonte e' approvata, questi domini **non sono ricercabili** — e il servizio lo dice
 * prima di avviare la corsa, invece di lasciar respingere tutte le proposte una per una.
 */
import { z } from "zod";
import type { ContestoRicerca, DominioRicercabile, RisultatoControllo } from "../domain.js";

/** Un codice: maiuscolo, senza spazi, stabile. E' la chiave naturale di ogni dominio. */
const Codice = z.string().min(2).max(64).regex(/^[A-Z0-9][A-Z0-9_.-]*$/, "codice: maiuscolo, senza spazi");

/** La parte comune: codice, nome italiano, nome inglese. */
const BASE = {
  code: Codice,
  name: z.string().min(2).max(255),
  /** E16 — la traduzione fa parte della proposta, non di un passaggio successivo. */
  nameEn: z.string().min(2).max(255),
};

/** Il controllo che vale per tutti: i due nomi non devono essere la stessa stringa. */
function nomiDistinti<T extends { name: string; nameEn: string; code: string }>(
  p: T,
): RisultatoControllo {
  return p.name.trim().toLowerCase() === p.nameEn.trim().toLowerCase()
    ? {
        regola: "BILINGUAL_NAMES_DISTINCT",
        esito: "WARNING",
        messaggio: `"${p.code}": il nome italiano e quello inglese coincidono. Puo' essere legittimo (una sigla), ma piu' spesso vuol dire che la traduzione non e' stata fatta.`,
      }
    : { regola: "BILINGUAL_NAMES_DISTINCT", esito: "PASSED" };
}

/** Le domande comuni: si costruiscono SOLO dal contesto di categoria (§4.5). */
function intestazione(c: ContestoRicerca): string {
  return `un'impresa italiana del settore ATECO ${c.atecoCode} (${c.atecoLabel}) in ${c.countryCode}, con ${c.employeeCount} addetti (fascia ${c.sizeBandCode}), modello operativo ${c.operatingModelCode} e intensita' di vigilanza ${c.regulatoryIntensity}`;
}

// ── ① le unita' organizzative ────────────────────────────────────────────────
export const UnitaPropostaSchema = z.object({
  ...BASE,
  /** Il codice dell'unita' superiore; `null` per la radice. */
  parentCode: Codice.nullable().default(null),
  /** Il tipo, come stringa: il catalogo e' una tabella, e la verifica sta dove vive. */
  unitType: z.string().min(2).max(64),
  level: z.number().int().min(0).max(12),
});
export type UnitaProposta = z.infer<typeof UnitaPropostaSchema>;

export const ORGANIZATION_UNITS_DOMAIN: DominioRicercabile<UnitaProposta> = {
  chiave: "organization_units",
  etichetta: "Unita' organizzative del modello",
  domande: (c) => [
    `Quali unita' organizzative (direzioni, aree, servizi, filiali) compongono di norma ${intestazione(c)}?`,
    `Quali di quelle unita' sono imposte o fortemente indotte dalla normativa applicabile al settore ATECO ${c.atecoCode} in ${c.countryCode}?`,
    `Come si articolano su piu' livelli gerarchici in un'impresa di quella dimensione, e quali unita' dipendono da quali?`,
  ],
  forma: UnitaPropostaSchema,
  chiaveNaturale: (u) => u.code,
  minimoFonti: 1,
  fontiConfrontateColRegistro: true,
  controlli: [
    nomiDistinti,
    // Un'unita' che dichiara un padre non puo' stare al livello della radice, e viceversa:
    // e' la sola incoerenza che si vede guardando la SOLA proposta. Il ciclo A→B→A lo trova
    // la sorgente di costruzione, che ha davanti tutto l'albero (#132 F2).
    (u) => {
      if (u.parentCode === null && u.level !== 0) {
        return { regola: "UNIT_ROOT_LEVEL", esito: "FAILED", messaggio: `"${u.code}" non ha un'unita' superiore ma dichiara livello ${u.level}: la radice sta a livello 0.` };
      }
      if (u.parentCode !== null && u.level === 0) {
        return { regola: "UNIT_ROOT_LEVEL", esito: "FAILED", messaggio: `"${u.code}" dipende da "${u.parentCode}" ma dichiara livello 0: il livello 0 e' della sola radice.` };
      }
      if (u.parentCode === u.code) {
        return { regola: "UNIT_ROOT_LEVEL", esito: "FAILED", messaggio: `"${u.code}" dipende da se' stessa.` };
      }
      return { regola: "UNIT_ROOT_LEVEL", esito: "PASSED" };
    },
  ],
};

// ── ② le posizioni ───────────────────────────────────────────────────────────
export const PosizionePropostaSchema = z.object({
  ...BASE,
  /** L'unita' in cui la posizione vive, per codice. */
  unitCode: Codice,
  /** A chi riporta, per codice di posizione; `null` per il vertice. */
  reportsToCode: Codice.nullable().default(null),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});
export type PosizioneProposta = z.infer<typeof PosizionePropostaSchema>;

export const POSITIONS_DOMAIN: DominioRicercabile<PosizioneProposta> = {
  chiave: "positions",
  etichetta: "Posizioni del modello",
  domande: (c) => [
    `Quali posizioni di responsabilita' esistono di norma in ${intestazione(c)}, e in quale unita' organizzativa siedono?`,
    `Quali posizioni sono richieste dalla normativa o dalla vigilanza per il settore ATECO ${c.atecoCode} in ${c.countryCode} (per esempio funzioni di controllo obbligatorie)?`,
    `Quali di queste posizioni sono critiche per la continuita' operativa di un'impresa di ${c.employeeCount} addetti?`,
  ],
  forma: PosizionePropostaSchema,
  chiaveNaturale: (p) => p.code,
  minimoFonti: 1,
  fontiConfrontateColRegistro: true,
  controlli: [
    nomiDistinti,
    (p) =>
      p.reportsToCode === p.code
        ? { regola: "POSITION_REPORTS_TO_SELF", esito: "FAILED", messaggio: `"${p.code}" riporta a se' stessa.` }
        : { regola: "POSITION_REPORTS_TO_SELF", esito: "PASSED" },
  ],
};

// ── ③ le competenze ──────────────────────────────────────────────────────────
export const CompetenzaPropostaSchema = z.object({
  ...BASE,
  /** La specie: il vocabolario vero e' quello di `sys_skills`, e li' si verifica. */
  kind: z.string().min(2).max(32),
  /** Le posizioni che la richiedono, per codice. Vuoto = competenza dell'impresa. */
  requiredByPositionCodes: z.array(Codice).max(200).default([]),
});
export type CompetenzaProposta = z.infer<typeof CompetenzaPropostaSchema>;

export const SKILLS_DOMAIN: DominioRicercabile<CompetenzaProposta> = {
  chiave: "skills",
  etichetta: "Competenze richieste dal modello",
  domande: (c) => [
    `Quali competenze professionali sono richieste per operare in ${intestazione(c)}?`,
    `Quali competenze sono imposte da obblighi di legge, di vigilanza o di contratto collettivo nel settore ATECO ${c.atecoCode} in ${c.countryCode}?`,
    `Quali competenze distinguono le posizioni di responsabilita' da quelle operative, in un'impresa di quella dimensione?`,
  ],
  forma: CompetenzaPropostaSchema,
  chiaveNaturale: (s) => s.code,
  minimoFonti: 1,
  fontiConfrontateColRegistro: true,
  controlli: [
    nomiDistinti,
    (s) => {
      const doppi = s.requiredByPositionCodes.filter((x, i, a) => a.indexOf(x) !== i);
      return doppi.length > 0
        ? { regola: "SKILL_POSITIONS_UNIQUE", esito: "WARNING", messaggio: `"${s.code}" nomina piu' volte le stesse posizioni: ${[...new Set(doppi)].join(", ")}` }
        : { regola: "SKILL_POSITIONS_UNIQUE", esito: "PASSED" };
    },
  ],
};

// ── ④ gli indicatori ─────────────────────────────────────────────────────────
export const IndicatorePropostoSchema = z.object({
  ...BASE,
  /** Il verso: lo stesso vocabolario del `CHECK` della mig. `000328`. */
  direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "TARGET_RANGE"]),
  unit: z.string().max(32).nullable().default(null),
  /** L'unita' organizzativa o il processo che l'indicatore misura, per codice. */
  measuresCode: Codice.nullable().default(null),
});
export type IndicatoreProposto = z.infer<typeof IndicatorePropostoSchema>;

export const KPIS_DOMAIN: DominioRicercabile<IndicatoreProposto> = {
  chiave: "kpis",
  etichetta: "Indicatori del modello",
  domande: (c) => [
    `Quali indicatori di prestazione sono comunemente usati per governare ${intestazione(c)}?`,
    `Quali indicatori sono richiesti da obblighi di segnalazione o di vigilanza nel settore ATECO ${c.atecoCode} in ${c.countryCode}?`,
    `Per ciascun indicatore: si misura in che unita', e un valore alto e' migliore, peggiore, o va tenuto dentro un intervallo?`,
  ],
  forma: IndicatorePropostoSchema,
  chiaveNaturale: (k) => k.code,
  minimoFonti: 1,
  fontiConfrontateColRegistro: true,
  controlli: [
    nomiDistinti,
    // Un intervallo-obiettivo senza unita' di misura non e' verificabile da nessuno.
    (k) =>
      k.direction === "TARGET_RANGE" && (k.unit === null || k.unit.trim() === "")
        ? { regola: "KPI_RANGE_NEEDS_UNIT", esito: "WARNING", messaggio: `"${k.code}" va tenuto dentro un intervallo ma non dichiara in che unita' si misura.` }
        : { regola: "KPI_RANGE_NEEDS_UNIT", esito: "PASSED" },
  ],
};

// ── ⑤ i processi ─────────────────────────────────────────────────────────────
export const ProcessoPropostoSchema = z.object({
  ...BASE,
  ordinal: z.number().int().min(0).max(999).default(0),
  /** Chi lo presidia, per codice di posizione: e' la colonna che la `000335` ha aggiunto. */
  ownerPositionCode: Codice.nullable().default(null),
  isOptional: z.boolean().default(false),
});
export type ProcessoProposto = z.infer<typeof ProcessoPropostoSchema>;

export const BUSINESS_PROCESSES_DOMAIN: DominioRicercabile<ProcessoProposto> = {
  chiave: "business_processes",
  etichetta: "Processi del modello",
  domande: (c) => [
    `Quali processi aziendali governa di norma ${intestazione(c)}?`,
    `Quali processi sono imposti dalla normativa o dalla vigilanza applicabile al settore ATECO ${c.atecoCode} in ${c.countryCode}?`,
    `In che ordine si susseguono, e quale posizione di responsabilita' presidia ciascuno?`,
  ],
  forma: ProcessoPropostoSchema,
  chiaveNaturale: (p) => p.code,
  minimoFonti: 1,
  fontiConfrontateColRegistro: true,
  controlli: [
    nomiDistinti,
    // Un processo obbligatorio senza presidio e' un processo che non fa nessuno.
    (p) =>
      !p.isOptional && p.ownerPositionCode === null
        ? { regola: "PROCESS_NEEDS_OWNER", esito: "WARNING", messaggio: `"${p.code}" e' dichiarato obbligatorio ma non dice quale posizione lo presidia.` }
        : { regola: "PROCESS_NEEDS_OWNER", esito: "PASSED" },
  ],
};

export const DOMINI_DI_CONTENUTO = [
  ORGANIZATION_UNITS_DOMAIN,
  POSITIONS_DOMAIN,
  SKILLS_DOMAIN,
  KPIS_DOMAIN,
  BUSINESS_PROCESSES_DOMAIN,
] as const;
