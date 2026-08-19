/**
 * apps/api/test/helpers/drift-check.ts — l'assert di drift post-suite.
 *
 * PERCHE' ESISTE
 * --------------
 * La suite gira contro il PostgreSQL condiviso con la produzione. D-52 ha portato
 * l'isolamento transazionale PER FILE (`tx-isolation.ts`), che azzera i residui della
 * suite d'integrazione — ma NON copre chi scrive sul DB da fuori quel meccanismo: gli
 * E2E Playwright passano da HTTP contro un server vero, e i loro cleanup vivono dentro
 * `catch` che ingoiano l'errore e che nessuno guarda (F-WS-F-9). Il risultato non e' teorico:
 * al 2026-08-09 il database porta ancora quattro righe lasciate il 9 e l'11 GIUGNO —
 * `ZZZ Link E2E 1780970642672` e `ZZZ Link E2E 1781217690611` in
 * `sys_content_documents.document_title` e `sys_content_versions.version_title`. Due
 * mesi senza che niente lo dicesse.
 *
 * La proposta d'origine (F-WS-F-6c) era «count(*) WHERE name LIKE 'E2E%' sulle tabelle
 * a prefisso NOTO». La lista di tabelle note e' stata scartata dopo averla misurata:
 * una lista scritta a mano invecchia in silenzio, e proprio la coppia che perde righe
 * oggi (`sys_content_*`) non sarebbe mai finita in una lista compilata a intuito. La
 * scansione qui e' ESAUSTIVA — tutte le colonne testuali di `sys` — perche' costa
 * quanto non costa niente: **~700 colonne** di `sys`, **1,3-2,0 secondi** misurati,
 * contro i ~40 minuti della suite.
 *
 * IL NUMERO ESATTO NON SI SCRIVE QUI, e la ragione e' che e' gia' successo due volte.
 * Il commento diceva «737 su 219», che non si riproduceva; corretto in «695 su 199» il
 * 2026-08-10, era **715** appena nove giorni dopo — il database cresce, e un conteggio
 * cablato in un commento invecchia in silenzio mentre sembra una misura. Chi vuole il
 * numero di adesso chiama `colonneSorvegliate()`, che lo conta: e' la stessa funzione
 * che il setup usa per non dichiararsi verde quando non ha guardato niente.
 * (Il filtro `table_type='BASE TABLE'` esclude le viste: senza, il conteggio e' piu' alto.)
 *
 * COSA FALLISCE, E COSA NO
 * ------------------------
 * Fallisce sul DRIFT: le righe che QUESTA corsa ha lasciato dietro di se' (censimento
 * a `setup`, ri-censimento a `teardown`, differenza positiva). Non fallisce sul totale
 * assoluto, e la ragione e' misurata, non ideologica: i residui pre-esistenti esistono
 * gia', quindi un check «rosso se il totale > 0» nascerebbe rosso il primo giorno per
 * colpa di qualcun altro. Un rosso che non indica un difetto di chi lo vede insegna a
 * non guardare i rossi — e' l'errore che `vitest.config.ts` documenta gia' a proposito
 * dei timeout. I pre-esistenti vengono comunque STAMPATI a ogni corsa, cosi' non
 * spariscono dal radar.
 *
 * Non fallisce nemmeno quando il database non risponde: un guasto del tunnel non e' un
 * difetto del codice sotto test, e trasformarlo in un rosso renderebbe la suite ostaggio
 * della rete. In quel caso avvisa forte e lascia passare — ma la riga di censimento
 * viene stampata SEMPRE, quindi un rilevatore morto si vede nel log invece di fingere.
 *
 * Via di fuga esplicita: `DRIFT_CHECK=0`, come `SUITE_LOCK=0` per il lucchetto.
 */
import { config as dotenvConfig } from "dotenv";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/**
 * I prefissi che marcano un dato di test. Non sono inventati: ognuno e' stato
 * misurato con un grep sui sorgenti delle prove (2026-08-09).
 *
 *   E2E%      — 97 spec Playwright: 'E2E-OU-', 'E2E-SKILL-', 'E2E Bank', 'E2E_TENANT_'…
 *   ZZ%       — convenzione dei test d'integrazione per ordinare in fondo ('ZZZCMSTEST',
 *               'ZZ.1.1'); e' il prefisso che ha effettivamente lasciato i residui vivi
 *   TEST%     — 'TEST-APPROVAL', 'TEST-FX-', 'TESTFIX::TL::n', 'TEST_STEPPED'
 *   IT-S%     — fixture datate per sessione ('IT-S1028-LC')
 *   IT\_SSE\_% — `inbox-stream.integration.test.ts:113`, ed e' il caso che conta di piu':
 *               apre un `new Client()` FUORI dal pool, quindi sfugge all'isolamento
 *               transazionale di D-52 e COMMITTA per davvero. E' l'unico scrittore della
 *               suite d'integrazione che possa lasciare righe dietro di se', e fino al
 *               2026-08-10 era l'unico che questa lista NON vedeva: `IT-S%` non lo copre,
 *               perche' il terzo carattere del pattern e' un trattino letterale mentre il
 *               soggetto ha un underscore. Le barre rovesciate sono necessarie — in LIKE
 *               `_` e' un jolly, e senza escape il pattern matcherebbe anche 'ITxSSEy'.
 *               Verificato: 'IT_SSE_ABC' LIKE 'IT\_SSE\_%' -> true, 'ITxSSEyABC' -> false.
 *
 * Chi aggiunge una convenzione nuova la aggiunge qui: e' l'unico posto dove la
 * definizione di «residuo» e' scritta.
 */
export const PREFISSI = ["E2E%", "ZZ%", "TEST%", "IT-S%", "IT\\_SSE\\_%"] as const;

/** Chi sa interrogare il database. Il pool dell'app, un Client dedicato: indifferente. */
export type Interrogante = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

/** Dove sta un residuo e quanti ce n'e': `sys_content_versions.version_title` → 2. */
export type Censimento = Map<string, number>;

/**
 * Conta i residui in TUTTE le colonne testuali di `sys`, in un solo round-trip.
 *
 * `query_to_xml` esegue lato server la count generata per ogni colonna: niente
 * assemblaggio di SQL nel client e niente 737 andate e ritorno sul tunnel. Nessun
 * pezzo di questa query e' concatenato a mano — gli identificatori li cita `format(%I)`
 * e i prefissi arrivano come PARAMETRO `$1`, incisi nel testo generato da `format(%L)`,
 * che e' quoting del server e non del chiamante.
 */
export async function censimento(q: Interrogante, prefissi: readonly string[] = PREFISSI): Promise<Censimento> {
  const sql = `
    SELECT loc, n FROM (
      SELECT c.table_name || '.' || c.column_name AS loc,
             (xpath('/row/c/text()',
                    query_to_xml(
                      format('SELECT count(*) AS c FROM sys.%I WHERE %I LIKE ANY(%L::text[])',
                             c.table_name, c.column_name, $1::text[]),
                      false, true, '')))[1]::text::bigint AS n
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name  = c.table_name
         AND t.table_type  = 'BASE TABLE'
       WHERE c.table_schema = 'sys'
         AND c.data_type IN ('character varying', 'text')
    ) x WHERE n > 0`;

  const { rows } = await q(sql, [[...prefissi]]);
  const out: Censimento = new Map();
  for (const r of rows as { loc: string; n: string | number }[]) out.set(r.loc, Number(r.n));
  return out;
}

/**
 * Quante colonne il censimento sta davvero guardando.
 *
 * Esiste per distinguere due esiti che `censimento()` da solo confonde, ed e' la
 * distinzione fra un rilevatore e un placebo: la mappa torna VUOTA sia quando 695
 * colonne sono state ispezionate e nessuna ha residui — il caso buono — sia quando
 * di colonne non ne e' stata ispezionata NESSUNA. Il secondo caso non e' teorico:
 * `information_schema.columns` mostra solo cio' su cui il ruolo ha privilegi, quindi
 * un grant mancante, un database sbagliato o uno schema invisibile producono zero
 * righe. Senza questo conteggio l'esito sarebbe «nessun residuo di test sul
 * database»: un verde muto, cioe' la peggiore delle risposte, perche' e' identica a
 * quella giusta.
 */
export async function colonneSorvegliate(q: Interrogante): Promise<number> {
  const { rows } = await q(`
    SELECT count(*)::int AS n
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name  = c.table_name
       AND t.table_type  = 'BASE TABLE'
     WHERE c.table_schema = 'sys'
       AND c.data_type IN ('character varying', 'text')`);
  return Number((rows[0] as { n: number | string }).n);
}

/** Cosa e' COMPARSO fra due censimenti. Le sparizioni non interessano: quello e' cleanup. */
export function drift(prima: Censimento, dopo: Censimento): { loc: string; prima: number; dopo: number }[] {
  const cresciuti: { loc: string; prima: number; dopo: number }[] = [];
  for (const [loc, n] of dopo) {
    const era = prima.get(loc) ?? 0;
    if (n > era) cresciuti.push({ loc, prima: era, dopo: n });
  }
  return cresciuti.sort((a, b) => b.dopo - b.prima - (a.dopo - a.prima));
}

function totale(c: Censimento): number {
  let t = 0;
  for (const n of c.values()) t += n;
  return t;
}

async function conUnClient<T>(fn: (q: Interrogante) => Promise<T>): Promise<T> {
  dotenvConfig({ path: join(REPO, ".env") });
  const client = new pg.Client({
    host: process.env["POSTGRES_HOST"],
    port: Number(process.env["POSTGRES_PORT"] ?? 5432),
    database: process.env["POSTGRES_DB"],
    user: process.env["POSTGRES_USER"],
    password: process.env["POSTGRES_PASSWORD"],
    ...(process.env["POSTGRES_SSL"] === "require" ? { ssl: { rejectUnauthorized: true } } : {}),
  });
  await client.connect();
  try {
    return await fn((sql, params) => client.query(sql, params as never[]));
  } finally {
    await client.end();
  }
}

/** La baseline vive qui: `setup` e `teardown` sono lo stesso modulo nello stesso processo. */
let baseline: Censimento | null = null;

export async function setup(): Promise<void> {
  if (process.env["DRIFT_CHECK"] === "0") return;
  try {
    const { mappa, colonne } = await conUnClient(async (q) => ({
      mappa: await censimento(q),
      colonne: await colonneSorvegliate(q),
    }));

    // Un censimento che non guarda niente non e' un censimento verde: e' cieco.
    // Meglio dichiararsi scoperti che dire «nessun residuo» senza aver guardato.
    if (colonne === 0) {
      baseline = null;
      console.warn(
        "[drift] ZERO colonne ispezionate: il rilevatore e' CIECO (grant mancanti, " +
          "database sbagliato o schema `sys` invisibile a questo ruolo). La corsa NON e' coperta " +
          "dall'assert di drift — e non e' la stessa cosa di «nessun residuo».",
      );
      return;
    }

    baseline = mappa;
    const pre = totale(baseline);
    console.log(
      pre === 0
        ? `[drift] baseline: nessun residuo di test sul database (${colonne} colonne ispezionate).`
        : `[drift] baseline: ${pre} righe residue PRE-ESISTENTI (non le lascia questa corsa), ` +
            `su ${colonne} colonne ispezionate:\n` +
            [...baseline].map(([loc, n]) => `         ${loc}: ${n}`).join("\n"),
    );
  } catch (e) {
    baseline = null;
    console.warn(`[drift] baseline NON presa (${(e as Error).message}). Il drift non sara' verificabile.`);
  }
}

export async function teardown(): Promise<void> {
  if (process.env["DRIFT_CHECK"] === "0") return;
  if (!baseline) {
    console.warn("[drift] nessuna baseline: salto il confronto. La corsa NON e' coperta dall'assert di drift.");
    return;
  }

  let dopo: Censimento;
  try {
    dopo = await conUnClient(censimento);
  } catch (e) {
    console.warn(`[drift] censimento finale fallito (${(e as Error).message}): la corsa NON e' coperta.`);
    return;
  }

  const cresciuti = drift(baseline, dopo);
  if (cresciuti.length === 0) {
    console.log(`[drift] nessun residuo aggiunto da questa corsa (totale invariato: ${totale(dopo)}).`);
    return;
  }

  // QUI NON SI LANCIA, e la ragione e' misurata (esperimento Z-112, Vitest 4.1.10).
  //
  // Su questa versione i teardown di `globalSetup` girano in sequenza e in ordine
  // INVERSO all'array, ma la catena NON e' protetta per elemento: il primo teardown
  // che lancia interrompe tutti quelli dopo di se'. Poiche' `drift-check` sta in fondo
  // all'array, il suo teardown gira per PRIMO — quindi un `throw` qui saltava il
  // teardown di `suite-lock.ts` e `.zp/suite.lock` restava su disco col PID della corsa,
  // proprio nel caso per cui questo codice esiste. La corsa successiva trovava un
  // lucchetto occupato da un processo finito.
  //
  // `process.exitCode = 1` da solo ottiene entrambe le cose. Provato con due
  // globalSetup finti, uno che rilascia un marker e uno che segnala il guasto:
  //   con `throw`                  -> EXIT=0 e il marker NON viene scritto
  //   con `process.exitCode` solo  -> EXIT=1 e il marker VIENE scritto
  // La prima riga dice anche perche' il solo `throw` non bastava comunque: un teardown
  // che lancia viene stampato come «error during close ...» e il processo esce **0**.
  process.exitCode = 1;
  const occorrenze = cresciuti.reduce((s, c) => s + c.dopo - c.prima, 0);
  console.error(
    `[drift] QUESTA CORSA HA LASCIATO RIGHE SUL DATABASE CONDIVISO.\n` +
      // «occorrenze», non «righe»: il conteggio e' per COLONNA, e una riga che porta il
      // prefisso in due colonne (es. titolo + slug) conta due volte.
      `  ${occorrenze} occorrenze in ${cresciuti.length} colonne:\n` +
      cresciuti.map((c) => `    ${c.loc}: ${c.prima} -> ${c.dopo}`).join("\n") +
      `\n  Prefissi sorvegliati: ${PREFISSI.join(", ")}\n` +
      `  Un cleanup non ha ripulito (spesso e' un catch che ingoia l'errore, F-WS-F-9).\n` +
      `  Le righe restano su un database condiviso con la produzione: vanno rimosse a mano.\n` +
      `  Se sai quello che fai: DRIFT_CHECK=0.`,
  );
}
