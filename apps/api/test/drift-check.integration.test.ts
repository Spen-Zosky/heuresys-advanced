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
import { PREFISSI, censimento, drift, type Censimento } from "./helpers/drift-check.js";

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

  it("il drift fra «niente» e i residui reali e' rilevato, con i conteggi giusti", async () => {
    const niente = await censimento(interroga, [`${IMPOSSIBILE}%`]);
    const reale = await censimento(interroga, PREFISSI);

    const cresciuti = drift(niente, reale);

    // Ogni posto che il censimento reale conosce risulta cresciuto rispetto al vuoto,
    // con lo stesso conteggio: e' la catena completa censimento -> confronto.
    expect(cresciuti.length).toBe(reale.size);
    for (const c of cresciuti) {
      expect(c.prima).toBe(0);
      expect(c.dopo).toBe(reale.get(c.loc));
      expect(c.dopo).toBeGreaterThan(0);
    }
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
