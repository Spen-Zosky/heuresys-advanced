/**
 * apps/api/test/unit/login-rate-limit.unit.test.ts — D-64 unit layer.
 *
 * `loginRateLimitMax()` è la guardia brute-force del login. Fino a S1029 la route
 * faceva `Number(process.env.AUTH_LOGIN_RATELIMIT_MAX) || 10`: un refuso diventava
 * 10 in silenzio (rumore innocuo) e un valore assurdo passava senza obiezioni
 * (pericoloso, perché disattiva di fatto il limitatore). Su un parametro di
 * sicurezza il degrado silenzioso non è accettabile: o è valido, o fallisce.
 *
 * L'integrazione copre il comportamento del limitatore (11 tentativi → 429); qui
 * si copre il CONTRATTO del valore, che l'integrazione non può esercitare senza
 * far esplodere il boot.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loginRateLimitMax } from "../../src/config/env.js";

const KEY = "AUTH_LOGIN_RATELIMIT_MAX";
let saved: string | undefined;

beforeEach(() => {
  saved = process.env[KEY];
});
afterEach(() => {
  if (saved === undefined) delete process.env[KEY];
  else process.env[KEY] = saved;
});

describe("loginRateLimitMax (unit)", () => {
  it("assente → default di produzione 10", () => {
    delete process.env[KEY];
    expect(loginRateLimitMax()).toBe(10);
  });

  it("valore valido → usato così com'è", () => {
    process.env[KEY] = "25";
    expect(loginRateLimitMax()).toBe(25);
  });

  it("il budget alto della suite (10000) è ammesso", () => {
    // test/helpers/setup.ts lo alza perché l'intera suite condivide una finestra
    // di 5 minuti: se questo fosse rifiutato, il boot dei test fallirebbe.
    process.env[KEY] = "10000";
    expect(loginRateLimitMax()).toBe(10000);
  });

  it("un refuso NON degrada in silenzio a 10 — fallisce", () => {
    process.env[KEY] = "abc";
    expect(() => loginRateLimitMax()).toThrow();
  });

  it("zero e negativi sono rifiutati (0 disattiverebbe il login, non il limite)", () => {
    process.env[KEY] = "0";
    expect(() => loginRateLimitMax()).toThrow();
    process.env[KEY] = "-5";
    expect(() => loginRateLimitMax()).toThrow();
  });

  it("un valore assurdo è rifiutato — è così che si disattiva un limitatore per sbaglio", () => {
    process.env[KEY] = "1000000000";
    expect(() => loginRateLimitMax()).toThrow();
  });

  it("i decimali sono rifiutati: il conteggio dei tentativi è intero", () => {
    process.env[KEY] = "10.5";
    expect(() => loginRateLimitMax()).toThrow();
  });

  it("viene RI-letto a ogni chiamata, non congelato al primo boot", () => {
    // È ciò che permette a un test di fissare il proprio limite e ricostruire l'app.
    process.env[KEY] = "10";
    expect(loginRateLimitMax()).toBe(10);
    process.env[KEY] = "77";
    expect(loginRateLimitMax()).toBe(77);
  });
});
