/**
 * La batteria della qualità (ADR-0063 E11, piano AI-driven voce F6a): forma delle domande.
 *
 * Ogni domanda porta la query SQL che dà la risposta attesa e la regola con cui il corridore la
 * confronta: la risposta attesa si ricalcola, non si ricorda. Le colonne che la query deve dare
 * dipendono dal tipo di confronto (vedi `attesoDaRighe`).
 */
import { createHash } from "node:crypto";

export const CONFRONTI = [
  "numero", // una riga, colonna `n`
  "insieme", // righe (nome, dentro, varianti?): tutti i `dentro`, nessuno degli altri
  "ordine", // come insieme, e i `dentro` nell'ordine delle righe
  "primo", // come insieme con un solo `dentro`, nominato prima di ogni altro
  "coppie", // righe (nome, etichetta, varianti?): ogni nome con la sua etichetta
  "veroFalso", // una riga, colonna booleana `vero`
  "etichetta", // una riga, colonna `etichetta`
  "rifiuto", // righe (nome) = fatti che non devono trapelare; la persona non ha il permesso
  "fuoriPerimetro", // come rifiuto, per chi ha il permesso ma non quel perimetro
] as const;
export type Confronto = (typeof CONFRONTI)[number];

export interface Voce {
  /** Come la voce si scrive nel testo atteso (per il campione e i messaggi). */
  nome: string;
  /** Tutte le forme accettate. */
  varianti: string[];
}

export interface Atteso {
  confronto: Confronto;
  numero?: number;
  vero?: boolean;
  /** Le voci attese (insieme, ordine, primo), o i fatti protetti (rifiuto, fuoriPerimetro). */
  voci?: Voce[];
  /** Le voci che renderebbero la risposta sbagliata. */
  vietate?: Voce[];
  coppie?: { voce: Voce; etichetta: Voce }[];
  etichetta?: Voce;
  /** Le altre etichette possibili dello stesso vocabolario. */
  etichetteVietate?: Voce[];
}

export interface Domanda {
  id: string;
  dominio: string;
  categoria: string;
  profilo: string;
  testo: string;
  /** Vocabolario delle etichette, quando il confronto ne usa (vedi `vocabolari.ts`). */
  vocabolario?: string;
  query: { sql: string; parametri: unknown[] };
  atteso: Atteso;
  impronta: string;
  misurataIl: string;
}

export interface Batteria {
  versione: 1;
  generataIl: string;
  database: string;
  domande: Domanda[];
}

export function impronta(d: Pick<Domanda, "query" | "atteso">): string {
  return createHash("sha256")
    .update(JSON.stringify([d.query.sql, d.query.parametri, d.atteso]))
    .digest("hex");
}

export const MINIMO_PER_DOMINIO = 200;
export const SOGLIA = 0.9;

/** I controlli statici (senza database e senza modello): l'elenco dei difetti, vuoto se sana. */
export function controllaBatteria(b: Batteria, profili: ReadonlySet<string>, minimo = MINIMO_PER_DOMINIO): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const testi = new Set<string>();
  const perDominio = new Map<string, number>();
  for (const d of b.domande) {
    const chi = d.id || "(senza id)";
    if (!/^D[1-7]-[a-z0-9-]+-\d{3}$/.test(d.id)) out.push(`${chi}: id fuori formato`);
    if (ids.has(d.id)) out.push(`${chi}: id ripetuto`);
    ids.add(d.id);
    const chiave = `${d.profilo}|${d.testo}`;
    if (testi.has(chiave)) out.push(`${chi}: domanda ripetuta per lo stesso profilo`);
    testi.add(chiave);
    perDominio.set(d.dominio, (perDominio.get(d.dominio) ?? 0) + 1);
    if (!d.id.startsWith(`${d.dominio}-`)) out.push(`${chi}: id e dominio discordi`);
    if (!d.categoria) out.push(`${chi}: manca la categoria`);
    if (!profili.has(d.profilo)) out.push(`${chi}: profilo sconosciuto «${d.profilo}»`);
    if (!d.testo?.trim().match(/[?.]$/)) out.push(`${chi}: testo vuoto o senza punto finale`);
    if (!/^\s*(select|with)\b/i.test(d.query?.sql ?? "")) out.push(`${chi}: query assente o non di lettura`);
    if (!d.misurataIl) out.push(`${chi}: manca la data della misura`);
    if (d.impronta !== impronta(d)) out.push(`${chi}: impronta discorde da query e attesa`);
    const a = d.atteso;
    if (!CONFRONTI.includes(a.confronto)) out.push(`${chi}: confronto sconosciuto`);
    const vuoto =
      (a.confronto === "numero" && !Number.isFinite(a.numero)) ||
      (a.confronto === "veroFalso" && typeof a.vero !== "boolean") ||
      (a.confronto === "etichetta" && !a.etichetta) ||
      (a.confronto === "coppie" && !a.coppie?.length) ||
      (["insieme", "ordine", "primo", "rifiuto", "fuoriPerimetro"].includes(a.confronto) && !a.voci?.length);
    if (vuoto) out.push(`${chi}: risposta attesa vuota`);
  }
  for (const [dominio, n] of perDominio) if (n < minimo) out.push(`${dominio}: ${n} domande, ne servono ${minimo}`);
  if (b.domande.length === 0) out.push("batteria vuota");
  return out;
}
