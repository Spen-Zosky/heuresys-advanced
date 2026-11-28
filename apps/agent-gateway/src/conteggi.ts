/**
 * I conteggi per sottoinsieme li fa il sistema, non il modello (difetto del 2026-11-28: l'assistente
 * scrisse «10 posizioni critiche» su una lettura con 21 righe, di cui 11 critiche e 10 non critiche, e
 * contraddisse da sé la propria tabella). Su una lettura con un elenco `items`, per ogni campo vero/falso
 * presente in tutte le righe il gateway aggiunge quante righe sono vere e quante false, sulle righe
 * effettivamente lette. Non cambia le righe e non tocca i campi mascherati ({omissis}): un campo che in
 * qualche riga non è vero o falso non si conta.
 */

type Riga = Record<string, unknown>;

export interface ConteggiBooleani {
  suRighe: number;
  perCampo: Record<string, { true: number; false: number }>;
  nota: string;
}

const MAX_CAMPI = 12;

export function contaBooleani(dati: unknown): ConteggiBooleani | null {
  if (!dati || typeof dati !== "object") return null;
  const righe = (dati as Record<string, unknown>)["items"];
  if (!Array.isArray(righe) || righe.length < 2) return null;
  if (!righe.every((r) => r && typeof r === "object" && !Array.isArray(r))) return null;
  const prima = righe[0] as Riga;
  const perCampo: Record<string, { true: number; false: number }> = {};
  for (const campo of Object.keys(prima)) {
    if (typeof prima[campo] !== "boolean") continue;
    if (!righe.every((r) => typeof (r as Riga)[campo] === "boolean")) continue;
    const vere = righe.filter((r) => (r as Riga)[campo] === true).length;
    perCampo[campo] = { true: vere, false: righe.length - vere };
    if (Object.keys(perCampo).length >= MAX_CAMPI) break;
  }
  if (Object.keys(perCampo).length === 0) return null;
  return {
    suRighe: righe.length,
    perCampo,
    nota: "conteggi fatti dal sistema sulle righe lette: per quanti sono veri o falsi usa questi numeri, non contare a mente",
  };
}
