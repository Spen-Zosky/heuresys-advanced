/**
 * apps/web/src/lib/glossario.ts — il glossario delle interfacce (classe C13 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Enzo, 2026-11-11: «nessun uso di icone di info che spieghino brevemente il significato di un
 * dato, di una sigla, di un indicatore». Una voce per concetto (R7: un termine per concetto),
 * scritta per chi guarda la pagina e non per chi l'ha costruita: che cosa misura, come si legge.
 * Le intestazioni di colonna e i titoli degli indicatori la trovano da sé (`spiegazioneDi`), e
 * le sigle trovate in un testo si spiegano al passaggio (`sigleIn`).
 *
 * Forense frontend 15/11/2026, S-06: le voci non stanno più qui ma in `common:glossario.*`, una
 * per lingua. Le sigle (KPI, VRIO…) sono uguali in ogni lingua; i concetti hanno un `termine`
 * per lingua («priorità» / «priority»), con più forme separate da «|». Una colonna si
 * riconosce con il titolo che la persona vede, quindi la ricerca usa il dizionario della sua lingua.
 */
import { ramo } from "./testi";

export interface Voce {
  /** il nome per esteso, per una sigla */
  esteso?: string;
  /** una o due frasi */
  testo: string;
}

type VoceSigla = { esteso: string; testo: string };
type VoceConcetto = { termine: string; testo: string };

function sigle(lingua: string | undefined): Record<string, VoceSigla> {
  return (ramo(lingua, "glossario.sigle") ?? {}) as unknown as Record<string, VoceSigla>;
}

/** I concetti della lingua, con ogni forma del termine in minuscolo → la voce. */
function concetti(lingua: string | undefined): Array<{ chiave: string; voce: Voce }> {
  const raw = (ramo(lingua, "glossario.concetti") ?? {}) as unknown as Record<string, VoceConcetto>;
  const out: Array<{ chiave: string; voce: Voce }> = [];
  for (const c of Object.values(raw)) {
    for (const forma of c.termine.split("|")) out.push({ chiave: norma(forma), voce: { testo: c.testo } });
  }
  return out;
}

const norma = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[:.]$/, "");

/** La spiegazione di un'intestazione o di un titolo d'indicatore, se il glossario la conosce. */
export function spiegazioneDi(titolo: string, lingua?: string): (Voce & { termine: string }) | undefined {
  const n = norma(titolo);
  if (!n) return undefined;
  const S = sigle(lingua);
  const sigla = S[titolo.trim().toUpperCase()];
  if (sigla && /^[A-Za-z0-9-]{2,6}$/.test(titolo.trim())) return { ...sigla, termine: titolo.trim().toUpperCase() };
  const C = concetti(lingua);
  const esatto = C.find((c) => c.chiave === n);
  if (esatto) return { ...esatto.voce, termine: titolo.trim() };
  for (const c of C) if (n.startsWith(`${c.chiave} `) || n.endsWith(` ${c.chiave}`)) return { ...c.voce, termine: c.chiave };
  for (const s of sigleIn(titolo, lingua)) return { ...S[s]!, termine: s };
  return undefined;
}

/** Le sigle note che compaiono in un testo, nell'ordine. */
export function sigleIn(testo: string, lingua?: string): string[] {
  const S = sigle(lingua);
  const visti: string[] = [];
  for (const m of testo.matchAll(/\b[A-Z][A-Z0-9]{1,5}\b/g)) if (S[m[0]] && !visti.includes(m[0])) visti.push(m[0]);
  return visti;
}
