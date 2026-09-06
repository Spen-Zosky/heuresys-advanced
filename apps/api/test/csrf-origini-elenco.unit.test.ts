/**
 * apps/api/test/csrf-origini-elenco.unit.test.ts — S1088, #219 F5e.
 *
 * `ADMIN_ORIGIN` puo' dichiarare PIU' origini, perche' una macchina puo' servirne
 * legittimamente piu' di una: il gemello di produzione risponde all'uso umano su
 * `http://192.168.1.11:3013` e al web che la suite E2E avvia per conto suo su
 * `http://localhost:3000`. Con una sola origine ammessa, ogni scrittura fatta dal
 * BROWSER durante la corsa integrale veniva rifiutata con `ORIGIN_MISMATCH` — 42 casi
 * rossi che tre triage successivi hanno attribuito ai permessi, perche' `verifyCsrf` e
 * `requirePermission` rispondono entrambi 403.
 *
 * ⚠ Il punto di questi casi NON e' che l'elenco funzioni: e' che allungarlo **non
 * indebolisca** il confronto. La proprieta' che F-007/F-010 protegge — uguaglianza
 * esatta di origine, mai un prefisso — deve valere su OGNI voce, non solo sulla prima.
 * Per questo ogni look-alike qui sotto e' costruito sulla voce di mezzo o sull'ultima:
 * un'implementazione che controllasse bene solo la prima passerebbe un test scritto
 * sulla prima, ed e' esattamente l'errore che questo file esiste per rendere visibile.
 *
 * La funzione e' provata QUI e non attraverso l'app perche' attraverso l'app si
 * potrebbe provare solo l'elenco che il `.env` della macchina dichiara — cioe' quasi
 * mai quello che serve provare. Il collegamento reale resta presidiato da
 * `csrf-origin.integration.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { origineAmmessa } from "../src/middleware/csrf.js";

/** Come le normalizza `config/env.ts` prima di consegnarle al presidio. */
const norm = (...v: string[]) => v.map((s) => new URL(s).origin);

const UNA = norm("http://localhost:3000");
const DUE = norm("http://192.168.1.11:3013", "http://localhost:3000");
const TRE = norm("https://www.heuresys.com", "http://192.168.1.11:3013", "http://localhost:3000");

describe("origineAmmessa — l'elenco non indebolisce l'uguaglianza esatta", () => {
  it("ammette l'unica origine dichiarata (il caso di produzione, invariato)", () => {
    expect(origineAmmessa("http://localhost:3000", UNA)).toBe(true);
  });

  it("ammette OGNI voce dell'elenco, non solo la prima", () => {
    for (const o of ["https://www.heuresys.com", "http://192.168.1.11:3013", "http://localhost:3000"]) {
      expect(origineAmmessa(o, TRE), `${o} deve essere ammessa`).toBe(true);
    }
  });

  it("rifiuta il look-alike per prefisso costruito sull'ULTIMA voce", () => {
    // `startsWith` avrebbe ammesso "http://localhost:30000" contro "http://localhost:3000".
    expect(origineAmmessa("http://localhost:30000", TRE)).toBe(false);
  });

  it("rifiuta il look-alike per suffisso costruito sulla voce di MEZZO", () => {
    expect(origineAmmessa("http://192.168.1.11:3013.evil.com", TRE)).toBe(false);
  });

  it("rifiuta un sottodominio che assomiglia alla prima voce", () => {
    expect(origineAmmessa("https://www.heuresys.com.evil.com", TRE)).toBe(false);
  });

  it("distingue lo SCHEMA: http non entra da una dichiarazione https", () => {
    expect(origineAmmessa("http://www.heuresys.com", norm("https://www.heuresys.com"))).toBe(false);
  });

  it("distingue la PORTA anche a parita' di host", () => {
    expect(origineAmmessa("http://192.168.1.11:3000", DUE)).toBe(false);
  });

  it("rifiuta un'origine illeggibile invece di lasciarla passare", () => {
    expect(origineAmmessa("non-un-url", DUE)).toBe(false);
    expect(origineAmmessa("", DUE)).toBe(false);
  });

  it("ignora il percorso e la barra finale, che `origin` non porta con se'", () => {
    // Senza la normalizzazione a `origin`, "http://localhost:3000/" sarebbe un'altra
    // cosa e il confronto esatto fallirebbe per un carattere di battitura nel `.env`.
    expect(origineAmmessa("http://localhost:3000/", UNA)).toBe(true);
    expect(origineAmmessa("http://localhost:3000/admin/users", UNA)).toBe(true);
  });

  it("con elenco vuoto il controllo NON e' attivo, e lo dichiara tornando true", () => {
    // E' il comportamento storico (`if (originHeader && env.ADMIN_ORIGIN)`): senza
    // origini dichiarate il presidio primario resta il token double-submit. Lo si prova
    // perche' un cambiamento silenzioso qui aprirebbe o chiuderebbe tutto.
    expect(origineAmmessa("https://evil.example", [])).toBe(true);
  });
});
