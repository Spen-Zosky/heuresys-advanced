/**
 * apps/web/src/lib/agente/bozza-oggetto.ts — il modo «lavora sull'oggetto» (piano dell'assistente
 * nelle interfacce, blocco I5; logiche L4 e L9 in
 * `docs/architecture/agenti/LOGICHE_assistente-nelle-interfacce.md`).
 *
 * Ripreso da mod-platform (`configuratore.aggiungi`: «resta sull'area, la salva la persona"),
 * adattato al fascicolo del modello del tenant: l'assistente PREPARA sulla pagina le decisioni sui
 * processi (dentro, in parte, fuori, con la motivazione); niente arriva al database finché la
 * persona non preme «Salva» sulla riga, con le regole e i permessi di sempre. Ogni comando è un
 * passo, e «annulla» torna allo stato di prima dell'ultimo passo.
 *
 * Le regole del dominio stanno qui, nel programma, non nel modello: un processo che il fascicolo
 * non ha, una decisione fuori dalle tre, una motivazione vuota o un fascicolo già firmato tornano
 * «rifiutata» con la ragione, e lo stato non cambia.
 */
import type { EsitoPagina } from "./vista-tabella";
import { testo } from "../testi";

export const COMANDI_FASCICOLO = ["fascicolo.decidi", "fascicolo.annulla"] as const;

export const INCLUSIONI_FASCICOLO = ["IN", "PARTIAL", "OUT"] as const;
export type InclusioneFascicolo = (typeof INCLUSIONI_FASCICOLO)[number];

export interface DecisionePreparata {
  inclusion: InclusioneFascicolo;
  rationale: string;
}

export interface ProcessoDelFascicolo {
  processId: string;
  processCode: string;
  processName: string;
  inclusion: InclusioneFascicolo | null;
}

export interface StatoBozza {
  /** Le decisioni preparate dall'assistente e non ancora salvate, per processId. */
  bozze: Readonly<Record<string, DecisionePreparata>>;
  /** Gli stati di prima di ogni passo, l'ultimo in coda. */
  passi: ReadonlyArray<Readonly<Record<string, DecisionePreparata>>>;
}

export const BOZZA_VUOTA: StatoBozza = { bozze: {}, passi: [] };

/** Un tetto ai passi tenuti: oltre, si dimentica il più vecchio (l'annulla torna fino a lì). */
export const MAX_PASSI = 50;

const MAX_MOTIVAZIONE = 500;

function rifiuta(dettaglio: string): { stato: null; esito: EsitoPagina } {
  return { stato: null, esito: { stato: "rifiutata", dettaglio } };
}

function trova(processi: readonly ProcessoDelFascicolo[], cercato: string): ProcessoDelFascicolo | undefined {
  const c = cercato.trim().toLowerCase();
  return (
    processi.find((p) => p.processCode.toLowerCase() === c) ??
    processi.find((p) => p.processName.toLowerCase() === c)
  );
}

/**
 * Esegue un comando del fascicolo. `stato: null` vuol dire che non è cambiato niente.
 */
export function eseguiSulFascicolo(
  s: StatoBozza,
  nome: string,
  argomenti: Record<string, unknown>,
  ctx: { processi: readonly ProcessoDelFascicolo[]; modificabile: boolean; lingua?: string },
): { stato: StatoBozza | null; esito: EsitoPagina } {
  const tr = (chiave: string, parametri?: Record<string, string | number>) => testo(ctx.lingua, chiave, parametri);
  if (nome === "fascicolo.annulla") {
    const prima = s.passi.at(-1);
    if (prima === undefined) return rifiuta(tr("esitoAgente.nessunPasso"));
    const restanti = Object.keys(prima).length;
    return {
      stato: { bozze: prima, passi: s.passi.slice(0, -1) },
      esito: { stato: "ok", dettaglio: tr("esitoAgente.annullato", { n: restanti }) },
    };
  }
  if (nome !== "fascicolo.decidi") return rifiuta(tr("esitoAgente.comandoPagina"));
  if (!ctx.modificabile) return rifiuta(tr("esitoAgente.nonModificabile"));

  const processo = typeof argomenti.processo === "string" ? trova(ctx.processi, argomenti.processo) : undefined;
  if (!processo) return rifiuta(tr("esitoAgente.processoAssente", { processo: String(argomenti.processo ?? "") }));
  const inclusion = argomenti.inclusione;
  if (typeof inclusion !== "string" || !(INCLUSIONI_FASCICOLO as readonly string[]).includes(inclusion))
    return rifiuta(tr("esitoAgente.decisioneNo"));
  const rationale = typeof argomenti.motivazione === "string" ? argomenti.motivazione.trim() : "";
  if (!rationale) return rifiuta(tr("esitoAgente.senzaMotivazione"));
  if (rationale.length > MAX_MOTIVAZIONE) return rifiuta(tr("esitoAgente.motivazioneLunga", { max: MAX_MOTIVAZIONE }));

  const bozze = { ...s.bozze, [processo.processId]: { inclusion: inclusion as InclusioneFascicolo, rationale } };
  const passi = [...s.passi, s.bozze].slice(-MAX_PASSI);
  return {
    stato: { bozze, passi },
    esito: {
      stato: "ok",
      dettaglio: tr("esitoAgente.preparata", { inclusione: inclusion, processo: processo.processName, n: Object.keys(bozze).length }),
    },
  };
}

function senza(r: Readonly<Record<string, DecisionePreparata>>, chiave: string): Record<string, DecisionePreparata> {
  const copia = { ...r };
  delete copia[chiave];
  return copia;
}

/** Una bozza salvata dalla persona esce dalla bozza; i passi restano, così l'annulla non la ripropone. */
export function salvata(s: StatoBozza, processId: string): StatoBozza {
  if (!Object.hasOwn(s.bozze, processId)) return s;
  return {
    bozze: senza(s.bozze, processId),
    passi: s.passi.map((p) => (Object.hasOwn(p, processId) ? senza(p, processId) : p)),
  };
}

/** Il riassunto che la pagina dichiara all'assistente: codici e decisioni, mai le motivazioni salvate. */
export function vistaDelFascicolo(
  processi: readonly ProcessoDelFascicolo[],
  s: StatoBozza,
  modificabile: boolean,
  max = 60,
  lingua?: string,
): Record<string, unknown> {
  return {
    tipo: testo(lingua, "esitoAgente.tipoFascicolo"),
    modificabile,
    processiTotali: processi.length,
    processi: processi.slice(0, max).map((p) => ({
      codice: p.processCode,
      nome: p.processName.slice(0, 60),
      decisione: p.inclusion ?? testo(lingua, "esitoAgente.comeModello"),
      ...(Object.hasOwn(s.bozze, p.processId) ? { preparata: s.bozze[p.processId]!.inclusion } : {}),
    })),
    ...(processi.length > max ? { altriProcessi: processi.length - max } : {}),
    passiAnnullabili: s.passi.length,
  };
}
