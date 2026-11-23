/**
 * apps/web/src/components/processo/corsie-fasi.ts — la parte pura (senza React) dei diagrammi del processo:
 * l'ordine delle attività e le corsie del diagramma per fasi. Sta in un file a sé per poterla provare.
 */
import type { TenantProcessScheda } from "@heuresys/shared";

type Attivita = TenantProcessScheda["activities"][number];

/** Le attività nell'ordine in cui si leggono: prima quelle del processo, poi un sottoprocesso alla volta. */
export function attivitaInOrdine(s: TenantProcessScheda): Attivita[] {
  const ordine = new Map<string, number>([[s.process.processId, 0], ...s.subprocesses.map((p, i) => [p.processId, i + 1] as [string, number])]);
  return [...s.activities].sort((a, b) => (ordine.get(a.processId) ?? 99) - (ordine.get(b.processId) ?? 99) || a.ordinal - b.ordinal);
}

export type CorsiaFasi = { chiave: string; id: string | null; nome: string };

/**
 * Le corsie del diagramma per fasi: prima quelle di chi esegue le attività, nell'ordine in cui compaiono,
 * poi le unità del processo che non ne eseguono (consultate, informate): hanno comunque la loro corsia,
 * vuota, così le unità del diagramma sono tutte quelle dichiarate dal processo.
 */
export function corsieFasi(scheda: TenantProcessScheda, att: Attivita[], senzaUnita: string) {
  const chiaveDi = (a: Attivita) => a.unitId ?? `x:${a.unitName ?? a.executorName ?? ""}`;
  const corsie: CorsiaFasi[] = [];
  const indice = new Map<string, number>();
  for (const a of att) {
    const k = chiaveDi(a);
    if (!indice.has(k)) { indice.set(k, corsie.length); corsie.push({ chiave: k, id: a.unitId, nome: a.unitName ?? a.executorName ?? senzaUnita }); }
  }
  for (const u of scheda.units) {
    if (!indice.has(u.unitId)) { indice.set(u.unitId, corsie.length); corsie.push({ chiave: u.unitId, id: u.unitId, nome: u.unitName }); }
  }
  return { corsie, indice, chiaveDi };
}

/** Il nome che si legge di un'attività nei disegni: numero, nome e, se c'è, chi la esegue. */
export function etichettaAttivita(a: Pick<Attivita, "ordinal" | "name" | "executorName">): string {
  return `${a.ordinal}. ${a.name}${a.executorName ? ` — ${a.executorName}` : ""}`;
}

/**
 * Le proprietà di un oggetto del disegno che si apre (doppio clic, Invio o spazio). Il nome è obbligatorio:
 * un gruppo SVG con role="button" non ha testo proprio da leggere, e senza aria-label chi usa un lettore di
 * schermo sente solo «pulsante» (classe K10 del controllo forense del 23/11/2026).
 */
export function propsApribili(etichetta: string, f: () => void) {
  return {
    tabIndex: 0,
    role: "button" as const,
    "aria-label": etichetta,
    style: { cursor: "pointer" },
    onDoubleClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); f(); },
    onKeyDown: (e: { key: string; preventDefault: () => void }) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } },
  };
}
