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

/* ------------------------------------------------------------------ testo dei riquadri */

/**
 * Le parole intere di `testo` che stanno in `n - 1` caratteri, seguite da «…». Si taglia una parola
 * solo se la prima, da sola, è più lunga: un nome tagliato a metà parola non si legge, e il lettore di
 * schermo non lo ritrova nel nome accessibile (classe N4 del giro di verifica del 25/11/2026).
 */
function conPuntini(testo: string, n: number): string {
  const parole = testo.split(/\s+/).filter(Boolean);
  let riga = "";
  for (const p of parole) {
    const prova = riga ? `${riga} ${p}` : p;
    if (prova.length > n - 1) break;
    riga = prova;
  }
  if (!riga) riga = (parole[0] ?? "").slice(0, n - 1);
  return `${riga}…`;
}

/** Va a capo su al massimo due righe di `n` caratteri; l'ultima finisce con «…» se il testo è più lungo. */
export function dueRighe(testo: string, n: number): string[] {
  const parole = testo.split(/\s+/).filter(Boolean);
  const righe: string[] = [];
  let riga = "";
  for (const p of parole) {
    if ((riga + " " + p).trim().length <= n) riga = (riga + " " + p).trim();
    else { if (riga) righe.push(riga); riga = p; }
  }
  if (riga) righe.push(riga);
  const intera = (r: string) => (r.length > n ? conPuntini(r, n) : r);
  if (righe.length <= 2) return righe.map(intera);
  return [intera(righe[0]!), conPuntini(righe.slice(1).join(" "), n)];
}

/**
 * Una riga sola di `n` caratteri, con «…» se il testo non ci sta: il titolo della fascia di un
 * sottoprocesso. Prima si teneva la prima di due righe e i puntini non comparivano, da cui
 * «Erogazione del» senza segno che il nome continua (classe N1).
 */
export function unaRiga(testo: string, n: number): string {
  const t = testo.split(/\s+/).filter(Boolean).join(" ");
  return t.length <= n ? t : conPuntini(t, n);
}

/** Le parole di un testo come le confronta la regola axe label-content-name-mismatch: minuscole, senza punteggiatura. */
function parole(testo: string): string[] {
  return testo.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").split(" ").filter(Boolean);
}

/**
 * Il nome accessibile di un oggetto del disegno: deve contenere, nello stesso ordine, il testo che
 * l'oggetto mostra (WCAG 2.5.3, regola axe label-content-name-mismatch; classe N4). Se il nome completo
 * lo contiene già, è quello; altrimenti il nome comincia con il testo visibile e prosegue con quello
 * completo, così chi legge con la voce sente prima ciò che vede e poi il dettaglio.
 */
export function nomeAccessibile(visibili: readonly string[], completo: string): string {
  const v = parole(visibili.join(" ")), c = parole(completo);
  if (v.length === 0) return completo;
  for (let i = 0; i + v.length <= c.length; i++) {
    if (v.every((p, j) => p === c[i + j])) return completo;
  }
  const testo = visibili.map((r) => r.replace(/…$/, "")).join(" ").trim();
  return `${testo} — ${completo}`;
}
