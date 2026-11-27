/**
 * Il motore del generatore: un MODELLO di domanda è dato (testo, query, confronto); qui si eseguono
 * le query e se ne ricava la risposta attesa. Un dominio nuovo aggiunge soltanto i suoi modelli in
 * `modelli/` e la riga in `modelli/indice.ts`.
 */
import { impronta, type Atteso, type Confronto, type Domanda, type Voce } from "./tipi.js";
import { VOCABOLARI } from "./vocabolari.js";

export type Riga = Record<string, unknown>;
export type Interroga = (sql: string, parametri: unknown[]) => Promise<Riga[]>;

/** Una domanda prima della misura. */
export interface Bozza {
  categoria: string;
  profilo: string;
  testo: string;
  confronto: Confronto;
  sql: string;
  parametri?: unknown[];
  vocabolario?: string;
}

export interface Modello {
  /** La parte centrale dell'id: `D1-<chiave>-NNN`. */
  chiave: string;
  /** Le bozze di questo modello; può interrogare il database per scegliere i parametri. */
  bozze: (q: Interroga) => Promise<Bozza[]>;
}

export interface Dominio {
  codice: string;
  nome: string;
  modelli: Modello[];
}

/** «Cognome, Nome» vale anche scritto al contrario; ogni altra voce vale com'è scritta. */
export function voceDa(nome: string, altre: string[] = []): Voce {
  const m = /^([^,]+), (.+)$/.exec(nome);
  if (nome.startsWith("Divisione ")) altre = [...altre, nome.slice("Divisione ".length)];
  return { nome, varianti: [nome, ...(m ? [`${m[2]} ${m[1]}`, `${m[1]} ${m[2]}`] : []), ...altre] };
}

const delVocabolario = (voc: string | undefined, codice: unknown): Voce => {
  const v = voc ? VOCABOLARI[voc]?.[String(codice)] : undefined;
  if (voc && !v) throw new Error(`codice «${String(codice)}» fuori dal vocabolario ${voc}`);
  return v ?? voceDa(String(codice));
};

/**
 * La risposta attesa dalle righe della query, o `null` se la domanda non si può porre senza
 * ambiguità (nessun fatto, un pareggio in una classifica): la domanda si scarta.
 */
export function attesoDaRighe(confronto: Confronto, righe: Riga[], vocabolario?: string): Atteso | null {
  // `dentro` assente: la query elenca solo chi è dentro. NULL (confronto su un dato che manca): fuori.
  const eDentro = (r: Riga) => r.dentro === undefined || r.dentro === true;
  const voce = (r: Riga) => voceDa(String(r.nome), Array.isArray(r.varianti) ? (r.varianti as string[]) : []);
  switch (confronto) {
    case "numero":
      return righe.length === 1 && righe[0]!.n !== null ? { confronto, numero: Number(righe[0]!.n) } : null;
    case "veroFalso":
      return righe.length === 1 && typeof righe[0]!.vero === "boolean" ? { confronto, vero: righe[0]!.vero as boolean } : null;
    case "etichetta": {
      if (righe.length !== 1 || righe[0]!.etichetta === null) return null;
      const codice = String(righe[0]!.etichetta);
      const altre = vocabolario
        ? Object.entries(VOCABOLARI[vocabolario]!).filter(([k]) => k !== codice).map(([, v]) => v)
        : ((righe[0]!.altre as string[] | null) ?? []).map((a) => voceDa(a));
      return { confronto, etichetta: delVocabolario(vocabolario, codice), etichetteVietate: altre };
    }
    case "coppie": {
      const dentro = righe.filter(eDentro);
      if (!dentro.length) return null;
      return {
        confronto,
        coppie: dentro.map((r) => ({ voce: voce(r), etichetta: delVocabolario(vocabolario, r.etichetta) })),
        vietate: righe.filter((r) => !eDentro(r)).map(voce),
      };
    }
    case "rifiuto":
    case "fuoriPerimetro":
      return righe.length ? { confronto, voci: righe.map(voce) } : null;
    case "insieme":
    case "ordine":
    case "primo": {
      const dentro = righe.filter(eDentro);
      if (!dentro.length || (confronto === "primo" && dentro.length !== 1)) return null;
      if (confronto === "ordine") {
        // Un pareggio fra i nominati, o fra l'ultimo nominato e il primo escluso, rende la classifica opinabile.
        const valori = righe.slice(0, dentro.length + 1).map((r) => String(r.valore));
        if (new Set(valori).size !== valori.length) return null;
      }
      return { confronto, voci: dentro.map(voce), vietate: righe.filter((r) => !eDentro(r)).map(voce) };
    }
  }
}

export async function genera(
  dominio: Dominio,
  q: Interroga,
  misurataIl: string,
): Promise<{ domande: Domanda[]; scartate: string[] }> {
  const domande: Domanda[] = [];
  const scartate: string[] = [];
  for (const m of dominio.modelli) {
    let n = 0;
    for (const b of await m.bozze(q)) {
      const parametri = b.parametri ?? [];
      const atteso = attesoDaRighe(b.confronto, await q(b.sql, parametri), b.vocabolario);
      if (!atteso) {
        scartate.push(`${dominio.codice}-${m.chiave}: ${b.testo}`);
        continue;
      }
      const base = { query: { sql: b.sql, parametri }, atteso };
      domande.push({
        id: `${dominio.codice}-${m.chiave}-${String(++n).padStart(3, "0")}`,
        dominio: dominio.codice,
        categoria: b.categoria,
        profilo: b.profilo,
        testo: b.testo,
        ...(b.vocabolario ? { vocabolario: b.vocabolario } : {}),
        ...base,
        impronta: impronta(base),
        misurataIl,
      });
    }
  }
  return { domande, scartate };
}
