/**
 * apps/api/test/drift-check.integration.test.ts
 *
 * Prova che l'assert di drift post-suite (`helpers/drift-check.ts`) SA DISTINGUERE.
 * Un rilevatore che non si e' mai visto dire «trovato» non e' un rilevatore, e uno che
 * dice sempre «trovato» non lo e' altrettanto: qui si dimostrano entrambe le risposte
 * contro il database vero.
 *
 * Tutto in SOLA LETTURA, e non per timidezza: `gov_worker` — l'identita' con cui girano
 * le sessioni lavoratrici di gov (#173) — porta `default_transaction_read_only=on`
 * inciso sul ruolo, esattamente come `codex_auditor`. Un test che pretendesse di
 * scrivere per provarsi sarebbe ineseguibile meta' delle volte, e l'unico modo di
 * eseguirlo sarebbe smontare quella guardia. Provarlo senza scrivere e' la strada
 * migliore, non il ripiego: il rilevatore deve funzionare anche su una replica.
 */
import { describe, expect, it } from "vitest";

import { pool } from "../src/db/client.js";
import {
  PREFISSI,
  censimento,
  colonneSorvegliate,
  drift,
  esitoBaseline,
  type Censimento,
} from "./helpers/drift-check.js";

const interroga = (sql: string, params?: unknown[]) => pool.query(sql, params as never[]);

/** Non puo' esistere: un residuo con questo prefisso vorrebbe dire che il test mente. */
const IMPOSSIBILE = "@@@prefisso-che-nessuno-usa-";

describe("assert di drift post-suite", () => {
  it("i prefissi sorvegliati non sono vuoti e includono quello del finding", () => {
    expect(PREFISSI.length).toBeGreaterThan(0);
    expect(PREFISSI).toContain("E2E%");
  });

  it("scopre le colonne da sole: censendo tutto trova decine di posti, senza nessuna lista scritta a mano", async () => {
    const tutto = await censimento(interroga, ["%"]);

    // La proposta d'origine (F-WS-F-6c) parlava di «tabelle a prefisso noto». Se la
    // scoperta fosse una lista, questo numero sarebbe la lunghezza della lista.
    expect(tutto.size).toBeGreaterThan(50);

    // E i posti trovati sono davvero colonne di `sys`, non un artefatto.
    const [primo] = [...tutto.keys()];
    expect(primo).toMatch(/^[a-z0-9_]+\.[a-z0-9_]+$/);
  });

  it("sa dire di NO: un prefisso che nessuno usa non produce nemmeno un posto", async () => {
    const nulla = await censimento(interroga, [`${IMPOSSIBILE}%`]);
    expect([...nulla.entries()]).toEqual([]);
  });

  it("il drift fra «niente» e un insieme popolato e' rilevato, con i conteggi giusti", async () => {
    const niente = await censimento(interroga, [`${IMPOSSIBILE}%`]);

    // `%` — qualunque testo — e NON `PREFISSI`. La differenza e' la ragione per cui
    // questo test esiste ancora: con `PREFISSI` l'insieme di confronto sono i 4 residui
    // di giugno, e nel giorno in cui verranno ripuliti — cioe' eseguendo l'ordine che
    // il messaggio d'errore del rilevatore da' esplicitamente — `reale.size` andrebbe a
    // 0, il `for` non itererebbe piu' e l'asserzione diventerebbe `0 === 0`. Il test
    // sarebbe rimasto VERDE senza piu' dimostrare niente: un falso verde nato dal
    // successo, che e' il modo piu' subdolo di perdere una prova.
    const popolato = await censimento(interroga, ["%"]);

    // La guardia che rende impossibile quella deriva: se l'insieme di confronto si
    // svuotasse, questo test diventa ROSSO invece di diventare vacuo.
    expect(popolato.size).toBeGreaterThan(0);

    const cresciuti = drift(niente, popolato);

    // Ogni posto che il censimento conosce risulta cresciuto rispetto al vuoto,
    // con lo stesso conteggio: e' la catena completa censimento -> confronto.
    expect(cresciuti.length).toBe(popolato.size);
    for (const c of cresciuti) {
      expect(c.prima).toBe(0);
      expect(c.dopo).toBe(popolato.get(c.loc));
      expect(c.dopo).toBeGreaterThan(0);
    }
  });

  // ── IL RAMO CIECO, che prima non era provabile (#181 F3) ────────────────────────
  // Il rimedio al falso-verde muto (rilievo 2) esisteva dal 2026-08-10 e NON AVEVA PROVA:
  // per esercitarlo bisognava rompere i grant di un database vero, quindi non si provava
  // mai. Un rimedio senza prova e' la stessa specie di difetto che rimedia.
  // `esitoBaseline` isola la decisione dal database: qui si chiama con due numeri.
  it("zero colonne ispezionate NON e' «nessun residuo»: il rilevatore si dichiara cieco", () => {
    const esito = esitoBaseline(new Map(), 0);

    expect(esito.cieco).toBe(true);
    // La baseline resta NULL: senza, il teardown confronterebbe con una mappa vuota e
    // qualunque riga trovata dopo verrebbe attribuita a questa corsa.
    expect(esito.baseline).toBeNull();
    expect(esito.messaggio).toMatch(/CIECO/);
    // E soprattutto: NON deve essere il messaggio del caso verde, che e' la frase che
    // renderebbe il falso verde indistinguibile da quello vero.
    // ⚠ Si cerca `baseline: nessun residuo`, non `nessun residuo` da solo: il messaggio
    // del ramo cieco contiene quelle due parole DENTRO la negazione — «non e' la stessa
    // cosa di nessun residuo» — e la prima stesura di questa riga e' caduta proprio li'.
    // Il test ha fatto il suo lavoro: mi ha costretto a leggere il messaggio vero.
    expect(esito.messaggio).not.toMatch(/baseline: nessun residuo/);
  });

  it("colonne ispezionate e mappa vuota SI' e' «nessun residuo»: i due casi non si confondono", () => {
    const esito = esitoBaseline(new Map(), 715);

    expect(esito.cieco).toBe(false);
    expect(esito.baseline).not.toBeNull();
    expect(esito.messaggio).toMatch(/nessun residuo/);
    // Il numero delle colonne guardate compare nel messaggio: e' cio' che permette a un
    // umano di accorgersi se un giorno diventasse implausibile.
    expect(esito.messaggio).toMatch(/715/);
  });

  it("sa dire quante colonne sta guardando: «nessun residuo» e «non ho guardato» non si confondono", async () => {
    const colonne = await colonneSorvegliate(interroga);

    // Il numero e' quello che il censimento ispeziona davvero (filtro BASE TABLE incluso).
    expect(colonne).toBeGreaterThan(100);

    // E combacia con il conteggio indipendente fatto qui, riga per riga: se `censimento`
    // e `colonneSorvegliate` divergessero, la guardia del setup misurerebbe un universo
    // diverso da quello censito, e non varrebbe niente.
    const { rows } = await interroga(
      `SELECT count(*)::int AS n
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
          AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = 'sys' AND c.data_type IN ('character varying', 'text')`,
    );
    expect(colonne).toBe(Number((rows[0] as { n: number }).n));
  });

  it("sorveglia il soggetto di inbox-stream, l'unico scrittore della suite che committa davvero", async () => {
    // `inbox-stream.integration.test.ts:113` apre un `new Client()` fuori dal pool: sfugge
    // all'isolamento transazionale di D-52 e i suoi INSERT restano se il cleanup salta.
    // Fino al 2026-08-10 nessun prefisso lo copriva — `IT-S%` ha un trattino letterale
    // dove il soggetto ha un underscore.
    const { rows } = await interroga(
      `SELECT 'IT_SSE_ABC' LIKE ANY($1::text[]) AS coperto,
              'ITxSSEyABC' LIKE ANY($1::text[]) AS falso_positivo`,
      [[...PREFISSI]],
    );
    const r = rows[0] as { coperto: boolean; falso_positivo: boolean };

    expect(r.coperto).toBe(true);
    // L'escape conta: senza `\_` l'underscore sarebbe un jolly e il pattern
    // rastrellerebbe dati veri che cominciano per «IT».
    expect(r.falso_positivo).toBe(false);
  });

  it("un censimento identico non produce drift, e una diminuzione non e' drift", () => {
    const base: Censimento = new Map([["sys_x.nome", 3]]);

    expect(drift(base, new Map([["sys_x.nome", 3]]))).toEqual([]);
    expect(drift(base, new Map([["sys_x.nome", 1]]))).toEqual([]); // qualcuno ha pulito: non e' un difetto
    expect(drift(base, new Map())).toEqual([]);

    // Cresce: e' drift, e dice di quanto.
    expect(drift(base, new Map([["sys_x.nome", 4]]))).toEqual([{ loc: "sys_x.nome", prima: 3, dopo: 4 }]);
    // Comparso dal nulla: baseline implicita a zero.
    expect(drift(new Map(), new Map([["sys_y.codice", 2]]))).toEqual([{ loc: "sys_y.codice", prima: 0, dopo: 2 }]);
  });
});
