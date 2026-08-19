/**
 * apps/api/test/dashboards-f3b.integration.test.ts — #142 F3b: i dati dentro le viste.
 *
 * COSA PROVA, e soprattutto cosa NON basta provare. Che l'endpoint risponda e che le viste
 * si riempiano è la parte facile e la meno informativa: si vedrebbe verde anche se la
 * mascheratura non funzionasse. Quindi metà di questi casi sono **negativi** — verificano
 * che i valori NON ci siano dove non devono esserci, e che l'assenza sia dichiarata.
 *
 * Il difetto che F3a aveva pagato — un test **tautologico**, che filtrava i blocchi per
 * `COMPENSATION` e poi asseriva che contenessero `COMPENSATION` — qui è evitato per
 * costruzione: l'atteso non si ricava dalla stessa espressione che produce il risultato, ma
 * dal confronto fra DUE attori con mandati diversi sulla STESSA vista.
 *
 * Attori scelti per caratteristica (helpers/actors.ts), mai per nome: i nomi cambiano col
 * dato, la caratteristica no.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";

interface Contenuto {
  kind: "counters" | "series" | "list";
  counters?: { key: string; label: string; value: number }[];
  points?: { bucket: string; value: number }[];
  rows?: { id: string; label: string }[];
}
interface Vista {
  code: string;
  name: string;
  dataClasses: string[];
  access: "open" | "masked" | "denied";
  content: Contenuto | null;
  withheldReason: string | null;
}
interface Dati {
  code: string;
  blocks: Vista[];
  scope: { kind: string; tenantId: string | null };
}

/** PLATFORM_ADMIN: mandato TECNICO — ADR-0032 gli maschera COMPENSATION ed EVALUATION. */
const MANDATO_TECNICO = "enzo.spenuso@heuresys.com";
/** HRMS_MANAGER: mandato HR — I22 lo dichiara plenipotenziario sui dati business. */
const MANDATO_HR = "valentina.conti@rtl-bank.org";
/** Nessun dominio: solo il pavimento universale (I17). */
const SENZA_DOMINI = "antonio.parisi@rtl-bank.org";

describe("#142 F3b — i dati dentro le viste", () => {
  let t: TestApp;
  const cookie: Record<string, string> = {};

  beforeAll(async () => {
    t = await buildTestApp();
    for (const email of [MANDATO_TECNICO, MANDATO_HR, SENZA_DOMINI]) {
      const r = await loginRaw(t.app, email);
      cookie[email] = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    }
  });

  afterAll(async () => {
    await t.app.close();
  });

  const dati = async (email: string, code: string) =>
    t.app.inject({
      method: "GET",
      url: `/v1/dashboard/catalog/${code}/data`,
      headers: { cookie: cookie[email] as string },
    });

  describe("la forma del contratto", () => {
    it("una vista aperta porta un contenuto, mai null", async () => {
      const r = await dati(MANDATO_HR, "hr");
      expect(r.statusCode).toBe(200);
      const d = r.json() as Dati;
      const aperte = d.blocks.filter((b) => b.access === "open");
      expect(aperte.length).toBeGreaterThan(0);
      for (const v of aperte) {
        expect(v.content, `vista aperta senza contenuto: ${v.code}`).not.toBeNull();
        expect(v.withheldReason).toBeNull();
      }
    });

    it("ogni contenuto dichiara la propria forma, e la forma corrisponde ai campi", async () => {
      const d = (await dati(MANDATO_HR, "org")).json() as Dati;
      for (const v of d.blocks) {
        if (!v.content) continue;
        if (v.content.kind === "counters") expect(Array.isArray(v.content.counters)).toBe(true);
        if (v.content.kind === "series") expect(Array.isArray(v.content.points)).toBe(true);
        if (v.content.kind === "list") expect(Array.isArray(v.content.rows)).toBe(true);
      }
    });

    it("il perimetro su cui i dati sono calcolati è dichiarato, non implicito", async () => {
      const d = (await dati(MANDATO_HR, "hr")).json() as Dati;
      expect(d.scope.kind).toBeTruthy();
    });
  });

  describe("i casi negativi — è qui che il test guadagna il suo posto", () => {
    it("una vista mascherata NON porta valori, e dice perché", async () => {
      const d = (await dati(MANDATO_TECNICO, "hr")).json() as Dati;
      const mascherate = d.blocks.filter((b) => b.access === "masked");
      expect(mascherate.length, "il mandato tecnico deve avere almeno una vista mascherata").toBeGreaterThan(0);
      for (const v of mascherate) {
        expect(v.content, `vista mascherata CON valori: ${v.code}`).toBeNull();
        expect(v.withheldReason ?? "", `vista mascherata muta: ${v.code}`).not.toBe("");
      }
    });

    it("la stessa vista è mascherata per il mandato tecnico e aperta per quello HR", async () => {
      // Il confronto FRA DUE ATTORI è ciò che rende il caso non tautologico: l'atteso non
      // viene dalla stessa espressione che produce il risultato, ma dall'altro attore.
      const tecnico = (await dati(MANDATO_TECNICO, "hr")).json() as Dati;
      const hr = (await dati(MANDATO_HR, "hr")).json() as Dati;

      const ecoT = tecnico.blocks.find((b) => b.dataClasses.includes("COMPENSATION"));
      const ecoH = hr.blocks.find((b) => b.dataClasses.includes("COMPENSATION"));
      expect(ecoT?.code).toBe(ecoH?.code);

      expect(ecoT?.access, "ADR-0032: il mandato tecnico non apre COMPENSATION").toBe("masked");
      expect(ecoT?.content).toBeNull();
      expect(ecoH?.access, "I22: il mandato HR la apre").toBe("open");
      expect(ecoH?.content).not.toBeNull();
    });

    it("un cruscotto senza il permesso di famiglia è negato, col codice di requirePermission", async () => {
      const r = await dati(SENZA_DOMINI, "hr");
      expect(r.statusCode).toBe(403);
      expect((r.json() as { error?: { code?: string } }).error?.code).toBe("FORBIDDEN");
    });

    it("un cruscotto inesistente è 404, non un elenco vuoto", async () => {
      const r = await dati(MANDATO_HR, "cruscotto-che-non-esiste");
      expect(r.statusCode).toBe(404);
      expect((r.json() as { error?: { code?: string } }).error?.code).toBe("DASHBOARD_NOT_FOUND");
    });
  });

  describe("il Self-Service è il pavimento universale (I17)", () => {
    it("chi non ha alcun dominio riceve comunque i propri dati", async () => {
      // ⚠ Questo caso nasce da un difetto vero, trovato dalla prova live: il service
      // chiedeva il tier di scope PRIMA di servire qualunque cruscotto, e
      // `scopeTierAndRole` **lancia** per chi non ha domini (#119). Risultato: un 500
      // sull'unico cruscotto che I17 garantisce a chiunque.
      const r = await dati(SENZA_DOMINI, "self");
      expect(r.statusCode, `atteso 200, ricevuto ${r.statusCode}: ${r.body.slice(0, 300)}`).toBe(200);
      const d = r.json() as Dati;
      expect(d.blocks.length).toBeGreaterThan(0);
      for (const v of d.blocks) {
        expect(v.access, "il Self-Service non si maschera: sono i dati della persona").toBe("open");
        expect(v.content).not.toBeNull();
      }
    });

    it("il Self-Service mostra la persona che guarda, non un'altra", async () => {
      const a = (await dati(SENZA_DOMINI, "self")).json() as Dati;
      const b = (await dati(MANDATO_HR, "self")).json() as Dati;
      const profilo = (d: Dati) =>
        d.blocks.find((v) => v.code === "il-mio-profilo")?.content?.rows?.[0]?.id;
      expect(profilo(a)).toBeTruthy();
      expect(profilo(b)).toBeTruthy();
      expect(profilo(a), "due persone diverse devono vedere due profili diversi").not.toBe(profilo(b));
    });
  });

  describe("i contenuti sono dati reali, non forme vuote", () => {
    it("il cruscotto di piattaforma conta ciò che il database contiene davvero", async () => {
      const d = (await dati(MANDATO_TECNICO, "platform")).json() as Dati;
      const salute = d.blocks.find((v) => v.code === "salute-sistema");
      expect(salute?.content?.kind).toBe("counters");
      const utenti = salute?.content?.counters?.find((c) => c.key === "utenti");
      // L'atteso non è un numero scritto a mano — sarebbe una SoT duplicata che invecchia
      // da sola: si verifica che il contatore sia positivo e coerente col fatto che questa
      // stessa suite è autenticata, quindi almeno un utente attivo esiste per costruzione.
      expect(utenti?.value ?? 0).toBeGreaterThan(0);
    });

    it("una vista senza fornitore si dichiara invece di sembrare vuota", async () => {
      // Ogni vista dichiarata nel database deve avere il suo fornitore nel codice. Se un
      // giorno ne comparisse una senza, il contratto lo dice — non esce come «non hai dati».
      for (const code of ["company", "process", "org", "branch", "hr", "platform", "tenant", "self"]) {
        const r = await dati(MANDATO_TECNICO, code);
        if (r.statusCode !== 200) continue;
        const d = r.json() as Dati;
        const orfane = d.blocks.filter((v) => v.withheldReason === "Vista senza fornitore di dati");
        expect(orfane.map((v) => `${code}/${v.code}`), "viste dichiarate ma non alimentate").toEqual([]);
      }
    });
  });
});
