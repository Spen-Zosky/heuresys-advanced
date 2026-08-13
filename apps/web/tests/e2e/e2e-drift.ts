/**
 * apps/web/tests/e2e/e2e-drift.ts — l'assert di drift DOPO la suite Playwright.
 *
 * PERCHE' ESISTE
 * --------------
 * `global-teardown.ts` cancella i residui che gli E2E lasciano sul DB condiviso, ma ogni
 * suo blocco e' best-effort: `catch` che logga e ingoia. Finche' nessuno CONTA le righe
 * dopo la pulizia, una cancellazione che non parte (psql assente, connessione sbagliata,
 * FK, spec interrotta a meta') e' indistinguibile da una riuscita.
 *
 * Non e' teorico. Due difetti misurati, entrambi veri al 2026-08-13:
 *
 *   1. righe `E2E %` ferme in `sys_content_documents` / `sys_content_versions` dal GIUGNO
 *      scorso, su tabelle che il teardown non cancella affatto;
 *   2. sul runner di CI il teardown e' un NO-OP SILENZIOSO. `playwright-smoke.yml` mette
 *      `POSTGRES_DB=heuresys_ci` nell'AMBIENTE del job (riga 39) e scrive
 *      `/tmp/ci-migrate.env`, non un `.env` in radice — che e' gitignored e quindi la'
 *      non esiste. La vecchia risoluzione leggeva `POSTGRES_*` SOLO dal file, quindi
 *      ripiegava su `heuresys_advanced:5433`, che sul runner non c'e'. Ogni psql falliva
 *      e il `catch` se lo mangiava. Corretto qui: l'ambiente ha la precedenza sul file.
 *
 * PERCHE' IL CENSIMENTO E NON UNA LISTA DI TABELLE
 * -----------------------------------------------
 * Una versione precedente di questo lavoro (ramo `gov/w2-recuperato`) portava un
 * MANIFESTO scritto a mano di 19 marcatori, tabella per tabella. E' esattamente
 * l'impostazione che `apps/api/test/helpers/drift-check.ts` ha gia' misurato e SCARTATO:
 * «una lista scritta a mano invecchia in silenzio, e proprio la coppia che perde righe
 * oggi (`sys_content_*`) non sarebbe mai finita in una lista compilata a intuito».
 * Verificato il 2026-08-13: quel manifesto NON nomina `sys_content_versions`, cioe' una
 * delle due tabelle che perdono righe davvero. Avrebbe dichiarato «zero residui» con le
 * righe ancora li'.
 *
 * Qui si usa quindi lo stesso censimento esaustivo del lato API — tutte le colonne
 * testuali di `sys`, i prefissi come parametro — che costa 1-2 secondi contro i minuti
 * della suite.
 *
 * COSA FALLISCE, E COSA NO — identico al lato API, di proposito
 * ------------------------------------------------------------
 * Fallisce sul DRIFT (censimento prima, ri-censimento dopo, differenza positiva), non sul
 * totale assoluto: un check «rosso se totale > 0» nascerebbe rosso per colpa di residui
 * altrui, e un rosso che non indica un difetto di chi lo vede insegna a non guardare i
 * rossi. I pre-esistenti si stampano comunque a ogni corsa.
 *
 * Non fallisce quando il database non risponde: un tunnel giu' non e' un difetto del
 * codice sotto prova. Ma la riga di censimento si stampa SEMPRE, quindi un rilevatore
 * morto si vede nel log invece di fingere.
 *
 * Via di fuga esplicita: `DRIFT_CHECK=0`, come sul lato API.
 *
 * Lanciabile anche da solo, senza far girare la suite:
 *     cd apps/web && pnpm e2e:residue-check
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * I prefissi che marcano un dato di prova.
 *
 * ⚠️ La CASA di questa definizione e' `apps/api/test/helpers/drift-check.ts`. Qui vive
 * una copia perche' `apps/web` e `apps/api` sono workspace distinti e questo file gira
 * dentro il transpiler di Playwright, non dentro il build dell'API. La copia NON puo'
 * divergere in silenzio: `apps/api/test/e2e-drift-prefissi.test.ts` legge i due file e
 * fallisce se le liste non coincidono. Chi aggiunge una convenzione la aggiunge nella
 * casa, e quel test dice subito che manca qui.
 */
export const PREFISSI = ["E2E%", "ZZ%", "TEST%", "IT-S%", "IT\\_SSE\\_%"] as const;

/** Dove sta un residuo e quanti ce n'e': `sys_content_versions.version_title` → 2. */
export type Censimento = Map<string, number>;

/** Legge SOLO le chiavi di connessione non segrete dal .env di radice. */
function leggiEnvFile(): Record<string, string> {
  const envPath = resolve(process.cwd(), "..", "..", ".env");
  const out: Record<string, string> = {};
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^(POSTGRES_(?:HOST|PORT|DB|USER))=(.*)$/.exec(line.trim());
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

/**
 * Precedenza: `PG*` dell'ambiente → `POSTGRES_*` dell'AMBIENTE → `.env` di radice → default.
 *
 * Il passaggio di mezzo e' quello che mancava, ed e' il difetto (2) del commento in testa:
 * senza, sul runner di CI ogni pulizia puntava a un database inesistente e falliva zitta.
 * La password non compare mai qui: arriva da `~/.pgpass`.
 */
export function pgConn(): { host: string; port: string; db: string; user: string } {
  const f = leggiEnvFile();
  return {
    host: process.env.PGHOST ?? process.env.POSTGRES_HOST ?? f.POSTGRES_HOST ?? "localhost",
    port: process.env.PGPORT ?? process.env.POSTGRES_PORT ?? f.POSTGRES_PORT ?? "5433",
    db: process.env.PGDATABASE ?? process.env.POSTGRES_DB ?? f.POSTGRES_DB ?? "heuresys_advanced",
    user: process.env.PGUSER ?? process.env.POSTGRES_USER ?? f.POSTGRES_USER ?? "heuresys",
  };
}

/** Gli argomenti fissi di psql per questa connessione. */
export function psqlArgs(): string[] {
  const c = pgConn();
  return ["-h", c.host, "-p", c.port, "-U", c.user, "-d", c.db, "-v", "ON_ERROR_STOP=1", "-tA"];
}

/** L'array SQL dei prefissi. `format(%L)` lo cita lato server: niente quoting nel client. */
function arrayPrefissi(prefissi: readonly string[]): string {
  return `ARRAY[${prefissi.map((p) => `'${p.replace(/'/g, "''")}'`).join(",")}]::text[]`;
}

/**
 * Conta i residui in TUTTE le colonne testuali di `sys`, in un solo round-trip.
 * Stessa query del lato API: `query_to_xml` esegue lato server la count generata per
 * ogni colonna, quindi niente 700 andate e ritorno sul tunnel.
 */
export function censimento(prefissi: readonly string[] = PREFISSI): Censimento {
  const sql = `
    SELECT loc || '|' || n FROM (
      SELECT c.table_name || '.' || c.column_name AS loc,
             (xpath('/row/c/text()',
                    query_to_xml(
                      format('SELECT count(*) AS c FROM sys.%I WHERE %I LIKE ANY(%L::text[])',
                             c.table_name, c.column_name, ${arrayPrefissi(prefissi)}),
                      false, true, '')))[1]::text::bigint AS n
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name  = c.table_name
         AND t.table_type  = 'BASE TABLE'
       WHERE c.table_schema = 'sys'
         AND c.data_type IN ('character varying', 'text')
    ) x WHERE n > 0 ORDER BY 1`;
  const out = execFileSync("psql", [...psqlArgs(), "-c", sql], {
    stdio: ["ignore", "pipe", "pipe"],
  })
    .toString()
    .trim();
  const mappa: Censimento = new Map();
  if (out === "") return mappa;
  for (const riga of out.split(/\r?\n/)) {
    const i = riga.lastIndexOf("|");
    if (i > 0) mappa.set(riga.slice(0, i), Number(riga.slice(i + 1)));
  }
  return mappa;
}

/**
 * Quante colonne il censimento sta davvero guardando.
 *
 * Distingue due esiti che `censimento()` da solo confonde, ed e' la differenza fra un
 * rilevatore e un placebo: la mappa torna VUOTA sia quando 695 colonne sono state
 * ispezionate e nessuna ha residui — il caso buono — sia quando di colonne non ne e'
 * stata ispezionata NESSUNA (grant mancante, database sbagliato, schema invisibile).
 * Senza questo conteggio l'esito sarebbe «nessun residuo»: un verde muto, cioe' la
 * peggiore delle risposte, perche' identica a quella giusta.
 */
export function colonneSorvegliate(): number {
  const sql = `SELECT count(*) FROM information_schema.columns c
                 JOIN information_schema.tables t
                   ON t.table_schema=c.table_schema AND t.table_name=c.table_name
                  AND t.table_type='BASE TABLE'
                WHERE c.table_schema='sys' AND c.data_type IN ('character varying','text')`;
  return Number(execFileSync("psql", [...psqlArgs(), "-c", sql], {
    stdio: ["ignore", "pipe", "pipe"],
  }).toString().trim());
}

export interface EsitoDrift {
  readonly misurato: boolean;
  readonly colonne: number;
  readonly preesistenti: number;
  readonly cresciuti: { loc: string; prima: number; dopo: number }[];
  readonly totale: number;
}

/** Il totale delle righe censite. */
function somma(c: Censimento): number {
  let n = 0;
  for (const v of c.values()) n += v;
  return n;
}

/**
 * Il confronto. NON solleva da solo: restituisce l'esito e lascia decidere al chiamante,
 * cosi' il teardown puo' stampare sempre e fallire solo quando deve.
 */
export function confronta(prima: Censimento, dopo: Censimento): EsitoDrift {
  const cresciuti: { loc: string; prima: number; dopo: number }[] = [];
  for (const [loc, n] of dopo) {
    const p = prima.get(loc) ?? 0;
    if (n > p) cresciuti.push({ loc, prima: p, dopo: n });
  }
  cresciuti.sort((a, b) => b.dopo - b.prima - (a.dopo - a.prima));
  return {
    misurato: true,
    colonne: 0,
    preesistenti: somma(prima),
    cresciuti,
    totale: somma(dopo),
  };
}

/**
 * L'assert completo: rilegge la linea di partenza, ri-censisce, stampa SEMPRE, e solleva
 * solo se la corsa ha lasciato righe.
 *
 * Sta qui e non dentro `global-teardown.ts` per una ragione pratica: nel teardown
 * verrebbe dopo sedici DELETE e un UPDATE sul database vero, quindi provarlo
 * significherebbe eseguirli. Isolato, si prova da solo — ed e' l'unico modo di vederlo
 * fallire senza toccare dati che non c'entrano.
 *
 * Non solleva mai per un guasto d'ambiente: tunnel giu', psql assente o linea di partenza
 * mancante producono un avviso e un ritorno. Un non-so non e' un verde, ma nemmeno un
 * rosso a carico di chi non ha colpa.
 */
export function verificaDrift(baselinePath: string): void {
  if (process.env.DRIFT_CHECK === "0") {
    console.log("[e2e drift] DRIFT_CHECK=0 — assert saltato per richiesta esplicita.");
    return;
  }
  if (!existsSync(baselinePath)) {
    console.warn("[e2e drift] NON MISURATO: manca la linea di partenza (il censimento "
      + "iniziale non e' riuscito). Non e' un verde, e' un non-so.");
    return;
  }
  let esito: EsitoDrift;
  try {
    const salvato = JSON.parse(readFileSync(baselinePath, "utf8")) as {
      colonne: number;
      prima: [string, number][];
    };
    const dopo = censimento();
    esito = { ...confronta(new Map(salvato.prima), dopo), colonne: colonneSorvegliate() };
  } catch (err) {
    console.warn("[e2e drift] NON MISURATO:", (err as Error).message);
    return;
  } finally {
    try { unlinkSync(baselinePath); } catch { /* la linea di partenza e' usa-e-getta */ }
  }
  stampaEsito(esito);
  if (esito.colonne === 0) return;          // rilevatore morto: gia' detto, non e' un drift
  if (esito.cresciuti.length === 0) return;
  const aggiunte = esito.cresciuti.reduce((n, c) => n + c.dopo - c.prima, 0);
  const dettaglio = esito.cresciuti.map((c) => `${c.loc} +${c.dopo - c.prima}`).join(", ");
  throw new Error(
    `[e2e drift] la suite ha lasciato ${aggiunte} riga/e sul database condiviso: ${dettaglio}. `
    + "O la spec le cancella, o il teardown le copre. Via di fuga: DRIFT_CHECK=0.",
  );
}

/** La riga di log, sempre stampata: un rilevatore morto si vede, non finge. */
export function stampaEsito(esito: EsitoDrift): void {
  if (!esito.misurato) {
    console.warn("[e2e drift] NON MISURATO — il censimento non ha potuto girare. "
      + "Non e' un verde: e' un non-so.");
    return;
  }
  if (esito.colonne === 0) {
    console.warn("[e2e drift] ZERO COLONNE ISPEZIONATE — grant, database o schema sbagliati. "
      + "Un 'nessun residuo' qui sarebbe un verde muto.");
    return;
  }
  const testa = `[e2e drift] ${esito.colonne} colonne ispezionate · `
    + `${esito.preesistenti} righe residue PRE-ESISTENTI (non le lascia questa corsa)`;
  if (esito.cresciuti.length === 0) {
    console.log(`${testa} · nessun residuo aggiunto da questa corsa (totale ${esito.totale}).`);
    return;
  }
  console.error(`${testa}\n[e2e drift] ⛔ QUESTA CORSA HA LASCIATO RIGHE DIETRO DI SE':`);
  for (const c of esito.cresciuti) {
    console.error(`             ${c.loc}: ${c.prima} → ${c.dopo}  (+${c.dopo - c.prima})`);
  }
}
