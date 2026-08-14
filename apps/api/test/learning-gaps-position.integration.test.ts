/**
 * apps/api/test/learning-gaps-position.integration.test.ts
 *
 * #188 — «LE LACUNE FORMATIVE NON SANNO A QUALE POSIZIONE SI RIFERISCONO».
 *
 * L'item poneva una scelta binaria: **o** si mostra la posizione *attuale* della persona
 * dichiarando l'inferenza, **o** la colonna si ritira dalla superficie invece di mostrare
 * «—» per sempre. Misurando prima di scegliere è saltato fuori un terzo fatto, che rende
 * sbagliate entrambe: `CreateLearningGapBodySchema` **accetta `positionId`** e la lista lo
 * espone come **filtro**. La colonna è nel contratto pieno — letta, filtrabile, scrivibile.
 *
 * Ritirarla dalla superficie avrebbe quindi creato un difetto NUOVO e peggiore di quello
 * che chiudeva: una lacuna creata oggi *con* la posizione sarebbe stata invisibile in
 * lettura. È lo stesso caso di `goal_owner_user_id` in `#123`, dove il verdetto fu
 * **registrare**: il contratto è completo, sono i **dati storici** a non portare il campo.
 *
 * Questo file è la prova di quel verdetto, e sa fallire in entrambi i versi:
 *  - se qualcuno ritira `positionTitle` dallo schema di risposta → rosso (Zod lo scarta in
 *    uscita in silenzio, quindi la prova è contro la **porta HTTP**, non contro il repository);
 *  - se qualcuno «riempie» la posizione delle righe storiche inferendola dall'incarico
 *    corrente → rosso, perché l'ultimo caso pretende che restino quelle che sono.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { loginRaw } from "./helpers/login.js";

let t: TestApp;
let cookies = "";
let csrf = "";
let posizioneId = "";
let posizioneTitolo = "";
let personaId = "";
/** Lo stato dei dati storici, misurato all'avvio: non è un numero cablato. */
let storicheTotali = 0;
let storicheConPosizione = 0;

beforeAll(async () => {
  t = await buildTestApp();

  const login = await loginRaw(t.app, "federica.marchetti@rtl-bank.org");
  cookies = (login.cookies as { name: string; value: string }[])
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  csrf = (login.json() as { csrfToken: string }).csrfToken;

  const r = await pool.query<{
    position_id: string;
    position_title: string;
    user_id: string;
  }>(
    `SELECT p.position_id, p.position_title, u.user_id
       FROM sys.sys_positions p, sys.sys_users u
      WHERE u.user_email = 'federica.marchetti@rtl-bank.org'
        AND p.position_tenant_id = u.user_tenant_id
        AND p.position_title IS NOT NULL
      LIMIT 1`,
  );
  posizioneId = r.rows[0]?.position_id ?? "";
  posizioneTitolo = r.rows[0]?.position_title ?? "";
  personaId = r.rows[0]?.user_id ?? "";

  const s = await pool.query<{ totali: string; con_posizione: string }>(
    `SELECT count(*)::text AS totali,
            count(learning_gap_position_id)::text AS con_posizione
       FROM sys.sys_learning_gaps`,
  );
  storicheTotali = Number(s.rows[0]?.totali ?? 0);
  storicheConPosizione = Number(s.rows[0]?.con_posizione ?? 0);
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#188 — la posizione di una lacuna formativa", () => {
  it("gira su un universo dove PUÒ fallire: esistono lacune e posizioni reali", () => {
    expect(storicheTotali, "nessuna lacuna nel database: la verifica non guarderebbe niente").toBeGreaterThan(0);
    expect(posizioneId, "nessuna posizione con titolo nel tenant: non c'è nulla su cui agganciare").not.toBe("");
    expect(personaId, "nessuna persona: la creazione non sarebbe possibile").not.toBe("");
  });

  it("REGISTRATO — i dati storici non portano la posizione, e non la si inventa", () => {
    // Il fatto che l'item chiamava difetto. È un fatto sui DATI: la lacuna fu rilevata in un
    // momento, e attribuirla alla posizione di oggi racconterebbe una cosa che nessuno ha
    // misurato. Il numero non è cablato: è quello che il database dice adesso.
    expect(storicheConPosizione, "una riga storica ha acquisito una posizione: da dove?").toBe(0);
  });

  it("LA SUPERFICIE È VIVA: una lacuna creata con la posizione la espone dalla porta HTTP", async () => {
    // È il caso che rende sbagliato il ritiro della colonna. Scrive davvero — e l'isolamento
    // transazionale del file lo rollbacka a fine suite.
    const creata = await t.app.inject({
      method: "POST",
      url: "/v1/learning-gaps",
      headers: { cookie: cookies, "x-csrf-token": csrf },
      payload: {
        userId: personaId,
        positionId: posizioneId,
        severity: "MEDIUM",
        metadata: { origine: "test #188 — prova che la posizione arriva al client" },
      },
    });
    expect(creata.statusCode, `creazione: ${creata.statusCode} ${creata.body.slice(0, 300)}`).toBe(201);
    const nuova = creata.json() as { learningGapId: string; positionId: string | null; positionTitle: string | null };
    expect(nuova.positionId, "il POST ha accettato positionId ma non lo ha conservato").toBe(posizioneId);

    // La prova che conta: la LISTA, dove Zod potrebbe scartare il campo in uscita senza dirlo.
    const lista = await t.app.inject({
      method: "GET",
      url: `/v1/learning-gaps?positionId=${posizioneId}&limit=50&offset=0`,
      headers: { cookie: cookies },
    });
    expect(lista.statusCode, `lista filtrata: ${lista.statusCode} ${lista.body.slice(0, 300)}`).toBe(200);

    const body = lista.json() as { items: { learningGapId: string; positionTitle: string | null }[] };
    const riga = body.items.find((g) => g.learningGapId === nuova.learningGapId);
    expect(riga, "il filtro per posizione non ritrova la lacuna appena creata").toBeDefined();
    expect(
      riga?.positionTitle,
      "`positionTitle` non è arrivato al client: la colonna è stata ritirata dalla superficie",
    ).toBe(posizioneTitolo);
  });

  it("il filtro per posizione è vivo anche come esclusione: le storiche non vi rientrano", async () => {
    // Contro-prova: se qualcuno derivasse la posizione dall'incarico corrente, le righe
    // storiche comincerebbero a comparire in un filtro per posizione. Qui non devono.
    const lista = await t.app.inject({
      method: "GET",
      url: `/v1/learning-gaps?positionId=${posizioneId}&limit=200&offset=0`,
      headers: { cookie: cookies },
    });
    expect(lista.statusCode).toBe(200);
    const body = lista.json() as { total: number };
    expect(
      body.total,
      "il filtro per posizione restituisce più righe di quelle create qui: qualcuno ha inferito la posizione",
    ).toBeLessThanOrEqual(1);
  });
});
