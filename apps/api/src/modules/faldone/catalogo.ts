/**
 * apps/api/src/modules/faldone/catalogo.ts — il catalogo del Faldone, LETTO dal database.
 *
 * Perché non è scritto a mano: Enzo ha chiesto tutti i dati di una persona «senza esclusione
 * alcuna», e un elenco scritto a mano esclude in silenzio la prima tabella che nasce dopo di
 * lui. Qui il catalogo è ciò che il database dichiara con le sue chiavi esterne:
 *
 *   diretto   — ogni tabella con una FK a colonna singola verso `sys.sys_users`, una sezione per
 *               colonna di legame (la stessa tabella può legare la persona in due modi);
 *   collegato — ogni tabella con una FK verso una tabella diretta di legame `soggetto`: sono le
 *               righe figlie dei dati della persona (le voci di una valutazione, i passi di un piano).
 *
 * La parte scritta a mano è solo la CLASSIFICAZIONE (`classi.ts`): quale classe di dati, quale
 * capitolo, se la sfera è privata, se il legame è soggetto o relazione. Una tabella del catalogo
 * senza classificazione è un rosso della prova `faldone-catalogo`, non un'esclusione.
 *
 * Il catalogo si legge una volta per processo (come la mappa RBAC) e si rilegge solo al riavvio:
 * lo schema cambia solo con una migrazione, e ogni migrazione arriva con un deploy.
 *
 * SICUREZZA DEL SQL. I nomi di tabella e di colonna che il servizio compone nel SQL vengono SOLO
 * da qui, cioè dal catalogo di sistema di PostgreSQL, e passano da `ident()` (quotatura di
 * PostgreSQL). I valori viaggiano sempre come parametri `$n`. Nessun nome arriva dalla richiesta:
 * la richiesta sceglie una sezione per id, e l'id si cerca in questa mappa.
 */
import type { DbConnector } from "../../lib/scope/org.js";
import { LEGAMI_IMPLICITI, legameSoggetto } from "./classi.js";

export interface ColonnaCatalogo {
  nome: string;
  /** Tipo come lo scrive PostgreSQL (`format_type`). */
  tipo: string;
  /** Se la colonna è una FK a colonna singola: la tabella e la colonna riferite. */
  riferisce: { tabella: string; colonna: string } | null;
}

export interface TabellaCatalogo {
  /** `schema.tabella`, già nella forma che si quota con `identQualificato`. */
  nome: string;
  schema: string;
  relname: string;
  colonne: ColonnaCatalogo[];
  chiave: string[];
  /** La colonna leggibile per le etichette di chi la riferisce, se ce n'è una. */
  etichetta: string | null;
}

export interface LegameCatalogo {
  id: string;
  livello: "diretto" | "collegato";
  tabella: string;
  colonna: string;
  /** Solo per i collegati: la tabella madre (diretta), la sua colonna riferita e la sua colonna verso la persona. */
  madre: { tabella: string; colonnaRiferita: string; colonnaPersona: string } | null;
}

export interface Catalogo {
  tabelle: Map<string, TabellaCatalogo>;
  legami: LegameCatalogo[];
  perId: Map<string, LegameCatalogo>;
  /** Colonne di `sys.sys_users`: anche la persona stessa è una sezione. */
  persona: TabellaCatalogo;
}

const UTENTI = "sys.sys_users";

/** Quota un identificatore come fa PostgreSQL (`quote_ident`). */
export function ident(nome: string): string {
  return `"${nome.replace(/"/g, '""')}"`;
}
export function identQualificato(nome: string): string {
  const i = nome.indexOf(".");
  return `${ident(nome.slice(0, i))}.${ident(nome.slice(i + 1))}`;
}

interface RigaColonna {
  tabella: string; schema: string; relname: string; colonna: string; tipo: string;
  rif_tabella: string | null; rif_colonna: string | null; in_chiave: boolean;
}

/** Le colonne di tutte le tabelle ordinarie (non partizioni figlie) degli schemi applicativi. */
const SQL_COLONNE = `
  SELECT n.nspname || '.' || c.relname AS tabella, n.nspname AS schema, c.relname,
         a.attname AS colonna, format_type(a.atttypid, a.atttypmod) AS tipo,
         rn.nspname || '.' || rc.relname AS rif_tabella, ra.attname AS rif_colonna,
         EXISTS (SELECT 1 FROM pg_constraint p WHERE p.conrelid = c.oid AND p.contype = 'p'
                   AND a.attnum = ANY (p.conkey)) AS in_chiave
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN LATERAL (
      SELECT f.confrelid, f.confkey[1] AS confcol FROM pg_constraint f
       WHERE f.conrelid = c.oid AND f.contype = 'f' AND array_length(f.conkey, 1) = 1
         AND f.conkey[1] = a.attnum
       ORDER BY f.conname LIMIT 1
    ) fk ON true
    LEFT JOIN pg_class rc ON rc.oid = fk.confrelid
    LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
    LEFT JOIN pg_attribute ra ON ra.attrelid = fk.confrelid AND ra.attnum = fk.confcol
   WHERE c.relkind IN ('r', 'p') AND NOT c.relispartition
     AND n.nspname IN ('sys', 'audit', 'staging', 'reference_sync')
   ORDER BY 1, a.attnum`;

/** La colonna leggibile di una tabella riferita: titolo, nome, etichetta, poi codice. */
function sceltaEtichetta(colonne: ColonnaCatalogo[]): string | null {
  const testo = colonne.filter((c) => /^(text|character varying.*|character.*)$/.test(c.tipo));
  for (const re of [/_title$/, /_name$/, /_label$/, /_name_it$/, /_code$/]) {
    const c = testo.find((x) => re.test(x.nome));
    if (c) return c.nome;
  }
  return null;
}

export async function leggiCatalogo(q: DbConnector): Promise<Catalogo> {
  const { rows } = await q.query<RigaColonna>(SQL_COLONNE);
  const tabelle = new Map<string, TabellaCatalogo>();
  for (const r of rows) {
    let t = tabelle.get(r.tabella);
    if (!t) {
      t = { nome: r.tabella, schema: r.schema, relname: r.relname, colonne: [], chiave: [], etichetta: null };
      tabelle.set(r.tabella, t);
    }
    t.colonne.push({
      nome: r.colonna, tipo: r.tipo,
      riferisce: r.rif_tabella && r.rif_colonna ? { tabella: r.rif_tabella, colonna: r.rif_colonna } : null,
    });
    if (r.in_chiave) t.chiave.push(r.colonna);
  }
  for (const t of tabelle.values()) t.etichetta = sceltaEtichetta(t.colonne);

  const persona = tabelle.get(UTENTI);
  if (!persona) throw new Error("faldone: sys.sys_users assente dal catalogo");

  const legami: LegameCatalogo[] = [];
  for (const t of tabelle.values()) {
    if (t.nome === UTENTI) continue;
    for (const c of t.colonne) {
      if (c.riferisce?.tabella === UTENTI) {
        legami.push({ id: `${t.nome}.${c.nome}`, livello: "diretto", tabella: t.nome, colonna: c.nome, madre: null });
      }
    }
  }
  // I legami impliciti (senza chiave esterna) dichiarati in classi.ts: entrano solo se la colonna
  // esiste ed è un uuid. Una riga di LEGAMI_IMPLICITI che non trova la colonna la segnala la prova.
  for (const id of LEGAMI_IMPLICITI) {
    const i = id.lastIndexOf(".");
    const t = tabelle.get(id.slice(0, i));
    const c = t?.colonne.find((x) => x.nome === id.slice(i + 1));
    if (!t || !c || c.tipo !== "uuid" || legami.some((l) => l.id === id)) continue;
    legami.push({ id, livello: "diretto", tabella: t.nome, colonna: c.nome, madre: null });
  }
  return completaCatalogo(tabelle, legami, persona);
}

/** Aggiunge i collegati: le figlie dei legami diretti `soggetto` (il ruolo viene da `classi.ts`). */
function completaCatalogo(
  tabelle: Map<string, TabellaCatalogo>,
  diretti: LegameCatalogo[],
  persona: TabellaCatalogo,
): Catalogo {
  const tabelleDirette = new Set(diretti.map((l) => l.tabella));
  const madri = diretti.filter((l) => legameSoggetto(l.tabella, l.colonna));
  const collegati: LegameCatalogo[] = [];
  for (const t of tabelle.values()) {
    if (t.nome === UTENTI || tabelleDirette.has(t.nome)) continue;
    for (const c of t.colonne) {
      if (!c.riferisce) continue;
      for (const m of madri) {
        if (m.tabella !== c.riferisce.tabella) continue;
        collegati.push({
          id: `${t.nome}.${c.nome}@${m.id}`, livello: "collegato", tabella: t.nome, colonna: c.nome,
          madre: { tabella: m.tabella, colonnaRiferita: c.riferisce.colonna, colonnaPersona: m.colonna },
        });
      }
    }
  }
  const legami = [...diretti, ...collegati].sort((a, b) => a.id.localeCompare(b.id));
  return { tabelle, legami, perId: new Map(legami.map((l) => [l.id, l])), persona };
}

let inCache: Promise<Catalogo> | null = null;
/** Il catalogo del processo: letto alla prima richiesta, poi riusato. */
export function catalogo(q: DbConnector): Promise<Catalogo> {
  if (!inCache) {
    inCache = leggiCatalogo(q).catch((e: unknown) => {
      inCache = null;
      throw e;
    });
  }
  return inCache;
}
