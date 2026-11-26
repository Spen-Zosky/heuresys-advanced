/**
 * I codici dei dati e le parole italiane con cui l'assistente li può scrivere (le istruzioni gli
 * vietano i codici). Un dominio nuovo aggiunge qui i suoi vocabolari.
 */
import type { Voce } from "./tipi.js";

const voce = (nome: string, ...altre: string[]): Voce => ({ nome, varianti: [nome, ...altre] });

export const VOCABOLARI: Record<string, Record<string, Voce>> = {
  prontezza: {
    READY_NOW: voce("pronto subito", "pronta subito", "pronto ora", "pronta ora", "pronto adesso", "pronta adesso", "pronto immediatamente", "pronta immediatamente", "immediata", "immediatamente", "subito", "da subito"),
    READY_6_MONTHS: voce("entro 6 mesi", "in 6 mesi", "6 mesi", "sei mesi"),
    READY_1_YEAR: voce("entro 1 anno", "entro un anno", "in un anno", "in 1 anno", "1 anno", "un anno", "12 mesi", "dodici mesi"),
    READY_2_YEARS: voce("entro 2 anni", "entro due anni", "in 2 anni", "in due anni", "2 anni", "due anni", "24 mesi"),
  },
  // I fattori del punteggio di rischio di uscita (insights/service.ts).
  fattore: {
    tenure: voce("anzianità", "permanenza", "tempo in azienda"),
    attendance: voce("presenze", "assenze", "straordinari"),
    kpi: voce("kpi", "obiettivi", "indicatori"),
    engagement: voce("coinvolgimento", "engagement"),
    comp: voce("retribuzione", "retributiva", "compenso", "fascia retributiva"),
    promotion: voce("promozione", "promozioni", "avanzamento"),
  },
  rischio: {
    LOW: voce("basso", "bassa"),
    MEDIUM: voce("medio", "media"),
    HIGH: voce("alto", "alta", "elevato", "elevata"),
  },
  talento: {
    STAR: voce("star", "stella", "talento eccellente", "talento di punta"),
    HIGH_PERFORMER: voce("high performer", "prestazione elevata", "alte prestazioni", "alta prestazione", "alto rendimento", "prestazioni elevate", "alta performance"),
    CORE: voce("core", "solido", "pilastro", "nucleo", "contributore chiave", "fondamentale", "centrale"),
  },
  esito: {
    APPROVED: voce("approvata", "approvato", "approvate", "approvati"),
    PENDING_REVIEW: voce("in attesa", "in revisione", "da rivedere", "da valutare", "in valutazione", "in esame"),
    REJECTED: voce("respinta", "respinto", "rifiutata", "rifiutato", "non approvata"),
  },
};
