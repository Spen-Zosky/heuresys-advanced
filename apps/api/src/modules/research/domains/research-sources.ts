/**
 * apps/api/src/modules/research/domains/research-sources.ts
 *
 * IL DOMINIO PILOTA: LA PRIMA RICERCA E' SU **DOVE CERCARE** (#132 F4b — epica P2a §4.3).
 *
 * L'elenco delle fonti ammesse non lo scrive nessuno a mano (richiesta di Enzo, 2026-08-05):
 * nasce da una ricerca e lo approva un umano, una fonte per volta. Percio' il primo dominio
 * dichiarato non descrive un'azienda: propone **fonti**.
 *
 * Ed e' anche una scelta di prudenza. Se il motore e' rotto — se inventa, se ripete cio' che
 * ha gia' visto, se legge male — lo si scopre su un dominio che non tocca nessun cliente,
 * invece che mentre si descrive l'organizzazione di un'azienda vera.
 *
 * ⚠ L'ECCEZIONE E' QUI E SOLO QUI: `fontiConfrontateColRegistro: false`. Il registro nasce
 * vuoto, e un controllo che non ha niente contro cui confrontare respingerebbe tutto. Le
 * fonti restano **obbligatorie** (`minimoFonti: 1`): quello che salta e' il confronto col
 * registro, non l'obbligo di dire da dove viene una proposta.
 */
import { z } from "zod";
import type { ContestoRicerca, DominioRicercabile } from "../domain.js";
import { hostOf, suffissoCopre } from "../sources.js";

/**
 * La stessa forma che il database pretende
 * (`sys_research_source_host_suffix_check`, mig. `000333`): minuscolo, almeno due
 * etichette, niente schema, niente porta, niente percorso. Se le due divergessero, una
 * proposta passerebbe il controllo e verrebbe respinta dal database al momento
 * dell'applicazione — cioe' molto piu' tardi, dove attribuirla e' difficile.
 */
export const SUFFISSO_HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const FontePropostaSchema = z.object({
  hostSuffix: z.string().min(3).max(253).regex(SUFFISSO_HOST),
  label: z.string().min(2).max(256),
  classe: z.enum(["INSTITUTIONAL", "ACCREDITED", "TOP_CONSULTING", "USER_GENERATED"]),
  /** ISO 3166-1 alpha-2 maiuscolo, oppure `null` per una fonte sovranazionale. */
  paese: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .default(null),
  /** Il dominio ricercabile per cui vale; `null` = per tutti. */
  dominioApplicabile: z.string().max(64).nullable().default(null),
  /** Perche' questa fonte e' autorevole. E' cio' che un umano legge per decidere. */
  motivazione: z.string().min(20).max(2000),
});
export type FonteProposta = z.infer<typeof FontePropostaSchema>;

export const RESEARCH_SOURCES_DOMAIN: DominioRicercabile<FonteProposta> = {
  chiave: "research_sources",
  etichetta: "Fonti su cui la ricerca puo' appoggiarsi",

  domande(c: ContestoRicerca): string[] {
    return [
      `Quali autorita' di vigilanza, registri pubblici e istituti di statistica pubblicano dati ufficiali sulle imprese classificate ATECO ${c.atecoCode} (${c.atecoLabel}) in ${c.countryCode}?`,
      `Quali organismi di normazione e associazioni di categoria riconosciute pubblicano, per il settore ATECO ${c.atecoCode} in ${c.countryCode}, documenti su organizzazione, processi e ruoli?`,
      `Per un'impresa di ${c.employeeCount} addetti (fascia ${c.sizeBandCode}) con modello operativo ${c.operatingModelCode} e intensita' di vigilanza ${c.regulatoryIntensity}, quali fonti descrivono gli obblighi organizzativi applicabili in ${c.countryCode}?`,
      `Quali testi normativi e contrattuali (contratto collettivo applicabile compreso) governano l'organizzazione del lavoro nel settore ATECO ${c.atecoCode} in ${c.countryCode}?`,
    ];
  },

  forma: FontePropostaSchema,

  /**
   * Due proposte sono la stessa fonte se coprono lo stesso host per lo stesso perimetro.
   * E' la stessa chiave dell'indice unico del database, e non e' un caso: se le due
   * divergessero, una seconda corsa scriverebbe un doppione che poi non si applica.
   */
  chiaveNaturale: (f) => `${f.hostSuffix}|${f.dominioApplicabile ?? "*"}`,

  minimoFonti: 1,
  fontiConfrontateColRegistro: false,

  controlli: [
    /**
     * Proporre come ammissibile una fonte di contenuto generato da utenti e' esattamente
     * cio' che la politica vieta (§4.3). Non e' un avviso: e' un rifiuto.
     */
    (f) =>
      f.classe === "USER_GENERATED"
        ? {
            regola: "SOURCE_CLASS_USER_GENERATED",
            esito: "FAILED",
            messaggio: `${f.hostSuffix} e' proposta come contenuto generato da utenti: la politica delle fonti non l'ammette.`,
          }
        : { regola: "SOURCE_CLASS_USER_GENERATED", esito: "PASSED" },

    /**
     * ⚠ IL CONTROLLO CHE CONTA DAVVERO, ed e' anche la difesa di §4.4 applicata a questo
     * dominio: **la prova di una fonte dev'essere la fonte stessa**. Se una proposta dice
     * «`istat.it` e' autorevole» citando come evidenza un blog, sta riportando cio' che ha
     * letto **altrove** — e cio' che ha letto altrove puo' essere stato scritto apposta per
     * essere letto da un agente. Qui l'evidenza deve stare sull'host che si propone.
     */
    (f, _c, evidenze) => {
      const propria = evidenze.some((u) => {
        const h = hostOf(u);
        return h !== null && suffissoCopre(f.hostSuffix, h);
      });
      return propria
        ? { regola: "SOURCE_EVIDENCE_IS_SELF", esito: "PASSED" }
        : {
            regola: "SOURCE_EVIDENCE_IS_SELF",
            esito: "FAILED",
            messaggio: `Nessuna evidenza letta su ${f.hostSuffix}: una fonte si propone dopo averla aperta, non perche' qualcun altro la nomina.`,
          };
    },

    /**
     * Una fonte di un altro paese non e' un errore — molte delle fonti migliori sono
     * sovranazionali — ma chi decide deve vederlo. Avviso, non rifiuto.
     */
    (f, c) =>
      f.paese !== null && f.paese !== c.countryCode
        ? {
            regola: "SOURCE_COUNTRY_DIFFERS",
            esito: "WARNING",
            messaggio: `${f.hostSuffix} e' dichiarata di ${f.paese}, mentre la ricerca riguarda ${c.countryCode}.`,
          }
        : { regola: "SOURCE_COUNTRY_DIFFERS", esito: "PASSED" },
  ],
};
