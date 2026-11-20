/**
 * C4 del giro qa-web 18/11/2026: nella colonna «Obiettivo di riferimento» dei KPI di posizione
 * compariva il JSON grezzo del modello (`{"legacy":{...},"target_value":85,...}`). Qui il modello
 * diventa una lista di voci «etichetta: valore», senza le chiavi di importazione (`legacy`).
 */
export type ChiaveTemplateKpi = "min" | "target" | "stretch";

const NOTE: Record<string, ChiaveTemplateKpi> = {
  min_acceptable: "min",
  target_value: "target",
  stretch_target: "stretch",
};

/** L'ordine in cui si leggono: dal minimo accettabile al massimo sperato. */
const ORDINE: ChiaveTemplateKpi[] = ["min", "target", "stretch"];

export interface VoceTemplateKpi {
  chiave: ChiaveTemplateKpi;
  valore: number;
}

/**
 * Le soglie note del modello, in ordine di lettura. Una chiave sconosciuta o un valore non
 * numerico non si mostra: meglio una cella più corta che un pezzo di JSON.
 */
export function vociTemplateKpi(template: Record<string, unknown> | null | undefined): VoceTemplateKpi[] {
  if (!template) return [];
  const trovate = new Map<ChiaveTemplateKpi, number>();
  for (const [k, v] of Object.entries(template)) {
    const chiave = NOTE[k];
    if (!chiave) continue;
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    if (Number.isFinite(n)) trovate.set(chiave, n);
  }
  return ORDINE.filter((c) => trovate.has(c)).map((c) => ({ chiave: c, valore: trovate.get(c)! }));
}
