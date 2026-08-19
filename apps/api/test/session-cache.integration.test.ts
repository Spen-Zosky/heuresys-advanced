/**
 * apps/api/test/session-cache.integration.test.ts — Z-251 F2, la prova sul vivo.
 *
 * Gli unit provano la logica della cache; qui si prova ciò che gli unit non possono:
 * che una sessione ottenuta una volta **funzioni davvero** su un'altra istanza dell'app,
 * cioè che il riuso non sia un'illusione contabile.
 *
 * La domanda a cui questo file risponde, ed è la premessa di tutta F2: un access token
 * emesso dentro la transazione di un file sopravvive al rollback? Se la risposta fosse no,
 * la cache produrrebbe 401 sparsi in tutta la suite. È la ragione per cui la prova gira
 * contro il database reale e non contro un finto.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import {
  azzeraCache,
  leggiSessione,
  loginVeri,
  cacheAttiva,
} from "./helpers/session-cache.js";

const EMAIL = "federica.marchetti@rtl-bank.org";

/** Quanti login veri risultano finora per questa email (0 se non ne ha mai fatti). */
const contatore = (): number => loginVeri()[EMAIL.toLowerCase()] ?? 0;

describe("Z-251 F2 — le sessioni condivise fra file", () => {
  let a: TestApp;
  let b: TestApp;

  beforeAll(async () => {
    a = await buildTestApp();
    // Una SECONDA istanza: è il punto della prova. Nella suite ogni file costruisce la
    // propria app, e la sessione deve valere anche lì — altrimenti condividerla fra file
    // non servirebbe a niente.
    b = await buildTestApp();
  });

  afterAll(async () => {
    await a.app.close();
    await b.app.close();
  });

  it("l'interruttore è acceso in questo file (o le prove che seguono non provano nulla)", () => {
    expect(cacheAttiva()).toBe(true);
  });

  it("il primo login è vero, il secondo è servito dalla cache — misurato sul contatore", async () => {
    azzeraCache();
    const prima = contatore();

    const r1 = await loginRaw(a.app, EMAIL);
    expect(r1.statusCode).toBe(200);
    expect(contatore(), "il primo login deve essere VERO").toBe(prima + 1);

    const r2 = await loginRaw(a.app, EMAIL);
    expect(r2.statusCode).toBe(200);
    expect(contatore(), "il secondo NON deve toccare l'API").toBe(prima + 1);

    // Stessa sessione, non una nuova: è ciò che rende il riuso un riuso.
    const acc = (r: typeof r1) => r.cookies.find((c) => c.name === "hrx_access")?.value;
    expect(acc(r2)).toBe(acc(r1));
  });

  it("la sessione cachata autentica una richiesta su UN'ALTRA istanza dell'app", async () => {
    const salvata = leggiSessione(EMAIL);
    expect(salvata, "la prova precedente deve averla lasciata in cache").not.toBeNull();

    const access = salvata?.cookies.find((c) => c.name === "hrx_access")?.value;
    expect(access).toBeTruthy();

    // L'istanza `b` non ha mai visto questo login. Se il token valesse solo per l'istanza
    // che lo ha emesso — o se dipendesse da una riga scritta nella transazione del file —
    // qui arriverebbe un 401.
    const r = await b.app.inject({
      method: "GET",
      url: "/v1/me/profile",
      cookies: { hrx_access: access as string },
    });
    expect(r.statusCode, `atteso 200, ricevuto ${r.statusCode}: ${r.body.slice(0, 200)}`).toBe(200);
  });

  it("una password esplicita e diversa non passa dalla cache e viene rifiutata", async () => {
    // Guardia n.2: se la cache intercettasse anche questo caso, il test della password
    // sbagliata riceverebbe la sessione buona e diventerebbe verde per il motivo peggiore.
    const prima = contatore();
    const r = await a.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: EMAIL, password: "questa-password-non-e-quella-derivata" },
    });
    expect(r.statusCode).not.toBe(200);
    expect(contatore(), "una password esplicita non entra nemmeno nel contatore").toBe(prima);
  });

  it("azzerare la cache costringe al login vero successivo", async () => {
    azzeraCache();
    expect(leggiSessione(EMAIL)).toBeNull();
    const prima = contatore();
    const r = await loginRaw(a.app, EMAIL);
    expect(r.statusCode).toBe(200);
    expect(contatore()).toBe(prima + 1);
  });
});
