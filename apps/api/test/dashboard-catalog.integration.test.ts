/**
 * apps/api/test/dashboard-catalog.integration.test.ts
 *
 * #142 F3a — il catalogo dei cruscotti in lettura: `GET /v1/dashboard/catalog` e
 * `GET /v1/dashboard/catalog/:code`.
 *
 * La chiusura dichiarata di `#142` chiede che **il divieto** sia provato quanto l'accesso:
 * «nessuna pagina è raggiungibile da chi non può vederne il contenuto». Metà di questo file
 * prova quindi ciò che NON si vede, ed è la metà che conta — un test che guarda solo chi
 * entra resta verde anche quando la porta è spalancata.
 *
 * Nessun conteggio e nessun codice di famiglia è scritto a mano: gli attesi si derivano dal
 * database, che è la stessa fonte da cui la migrazione li ha creati.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { unEstraneoOrganizzativo, unManagerConPosizioniAttive } from "./helpers/org-actors.js";

const PWD = TEST_PERSONA_PASSWORD;

function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function login(t: TestApp, email: string): Promise<Map<string, string>> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return cookies;
}

interface Catalogo {
  dashboards: {
    code: string; permissionCode: string | null; isActive: boolean;
    blockCount: number; maskedBlockCount: number;
  }[];
}
interface Dettaglio {
  code: string; isActive: boolean;
  blocks: { code: string; dataClasses: string[]; access: string }[];
}

let app: TestApp;
let platform: Map<string, string>;
let tenant: Map<string, string>;
let estraneo: Map<string, string>;

/** Le famiglie come le dichiara il database — la fonte, non una copia. */
let famiglie: { code: string; permesso: string | null; viste: number }[];

beforeAll(async () => {
  app = await buildTestApp();
  platform = await login(app, "enzo.spenuso@heuresys.com");
  tenant = await login(app, "federica.marchetti@rtl-bank.org");
  const manager = await unManagerConPosizioniAttive(pool);
  const fuori = await unEstraneoOrganizzativo(pool, manager.userId);
  estraneo = await login(app, fuori.email);

  const r = await pool.query<{ code: string; permesso: string | null; viste: string }>(
    `SELECT d.dashboard_code AS code, d.dashboard_permission_code AS permesso,
            count(b.dashboard_block_id)::text AS viste
       FROM sys.sys_dashboards d
       LEFT JOIN sys.sys_dashboard_blocks b ON b.dashboard_id = d.dashboard_id
      GROUP BY 1, 2 ORDER BY 1`,
  );
  famiglie = r.rows.map((x) => ({ code: x.code, permesso: x.permesso, viste: Number(x.viste) }));
});

afterAll(async () => {
  await app.app.close();
  await closePool();
});

describe("GET /v1/dashboard/catalog — chi vede quali famiglie", () => {
  it("l'estraneo vede SOLO il Self-Service — il pavimento universale, e nient'altro", async () => {
    // È il caso del DIVIETO, e viene per primo apposta. Chi non ha alcun mandato non ha
    // nessuno dei sette permessi per famiglia; gli resta la sola famiglia che non ne ha
    // uno, perché I17 la garantisce per il fatto di esistere.
    const r = await app.app.inject({
      method: "GET", url: "/v1/dashboard/catalog", headers: { cookie: ch(estraneo) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Catalogo;
    const senzaPermesso = famiglie.filter((f) => f.permesso === null).map((f) => f.code);
    expect(body.dashboards.map((d) => d.code)).toEqual(senzaPermesso);
    expect(body.dashboards.every((d) => d.permissionCode === null)).toBe(true);
  });

  it("l'amministratore di piattaforma le vede tutte, e ognuna è attiva perché ha la sua pagina", async () => {
    const r = await app.app.inject({
      method: "GET", url: "/v1/dashboard/catalog", headers: { cookie: ch(platform) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Catalogo;
    // `000005` concede a PLATFORM_ADMIN ogni permesso a tappeto: le vede tutte.
    expect(body.dashboards.map((d) => d.code).sort()).toEqual(famiglie.map((f) => f.code).sort());
    // ⚠ CORRETTO IL 2026-08-19 (#142 F4). Diceva: «un catalogo NON è un menu: finché F4 non
    // costruisce le pagine, nessuna è attiva» — ed era la STESSA fotografia del momento che
    // la mig. `000316` portava nella propria post-condizione: vera quando fu scritta, e
    // destinata a diventare falsa esattamente quando F4 avesse fatto il proprio lavoro.
    // L'ho corretta nella migrazione e non l'ho cercata qui: la CI l'ha trovata per me.
    //
    // L'invariante che l'asserzione voleva dire, e che resta vero prima e dopo F4, è che il
    // catalogo non promette pagine inesistenti. Si verifica quindi il LEGAME, non lo stato:
    // ogni famiglia attiva ha la sua pagina. È la stessa condizione del CHECK
    // `sys_dashboards_attivo_ha_pagina`, letta dal lato del contratto pubblico.
    const { rows: senzaPagina } = await pool.query<{ code: string }>(
      `SELECT dashboard_code AS code FROM sys.sys_dashboards
        WHERE dashboard_is_active AND dashboard_ui_interface_id IS NULL`,
    );
    expect(senzaPagina.map((x) => x.code), "famiglie attive senza pagina").toEqual([]);
  });

  it("il conteggio delle viste combacia col modello, famiglia per famiglia", async () => {
    const r = await app.app.inject({
      method: "GET", url: "/v1/dashboard/catalog", headers: { cookie: ch(platform) },
    });
    const body = r.json() as Catalogo;
    for (const f of famiglie) {
      const vista = body.dashboards.find((d) => d.code === f.code);
      expect(vista, `la famiglia ${f.code} manca dal catalogo`).toBeDefined();
      expect(vista!.blockCount, `viste di ${f.code}`).toBe(f.viste);
      expect(vista!.maskedBlockCount).toBeLessThanOrEqual(vista!.blockCount);
    }
  });

  it("chi governa il tenant NON vede il cruscotto di piattaforma", async () => {
    // Il secondo caso di divieto, ed è quello che distingue i due mandati: `TENANT_ADMIN`
    // non ha `dashboard_platform:view`, quindi quella famiglia non compare — non compare
    // vuota, non compare mascherata: non c'è.
    const r = await app.app.inject({
      method: "GET", url: "/v1/dashboard/catalog", headers: { cookie: ch(tenant) },
    });
    const codici = (r.json() as Catalogo).dashboards.map((d) => d.code);
    expect(codici).not.toContain("platform");
    expect(codici).toContain("hr");
  });
});

describe("GET /v1/dashboard/catalog/:code — il dettaglio, e la mascheratura", () => {
  it("nega con 403 la famiglia di cui non si ha il permesso", async () => {
    const r = await app.app.inject({
      method: "GET", url: "/v1/dashboard/catalog/platform", headers: { cookie: ch(tenant) },
    });
    expect(r.statusCode).toBe(403);
    // Stesso codice che userebbe `requirePermission`: la condizione è la stessa, e due
    // codici diversi per lo stesso diniego renderebbero il contratto incoerente.
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("una famiglia inesistente è 404, non 403 — non si finge che esista", async () => {
    const r = await app.app.inject({
      method: "GET", url: "/v1/dashboard/catalog/famiglia-che-non-esiste",
      headers: { cookie: ch(platform) },
    });
    expect(r.statusCode).toBe(404);
  });

  it("il Self-Service non chiede permesso a nessuno, e non maschera nulla (I17)", async () => {
    const r = await app.app.inject({
      method: "GET", url: "/v1/dashboard/catalog/self", headers: { cookie: ch(estraneo) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Dettaglio;
    expect(body.blocks.length).toBeGreaterThan(0);
    // Mascherare qui significherebbe negare a una persona i propri stessi dati.
    expect(body.blocks.every((b) => b.access === "open")).toBe(true);
    expect(body.blocks.every((b) => b.dataClasses.length === 0)).toBe(true);
  });

  it("il mandato TECNICO vede la vista economica MASCHERATA, quello HR in chiaro", async () => {
    // ⚠ La prima stesura di questa prova era TAUTOLOGICA: filtrava i blocchi per
    // `COMPENSATION` e poi asseriva che contenessero `COMPENSATION`. Non poteva fallire, e
    // infatti non si accorse che `PLATFORM_ADMIN` riceveva la vista delle retribuzioni **in
    // chiaro** — il difetto lo ha trovato la prova live. Ora si asserisce la cosa che
    // distingue i due mandati, ed è l'unica che ADR-0032 promette.
    const vistaEconomica = async (cookie: Map<string, string>) => {
      const r = await app.app.inject({
        method: "GET", url: "/v1/dashboard/catalog/hr", headers: { cookie: ch(cookie) },
      });
      expect(r.statusCode).toBe(200);
      const b = (r.json() as Dettaglio).blocks.find((x) => x.dataClasses.includes("COMPENSATION"));
      expect(b, "il cruscotto HR deve avere una vista economica").toBeDefined();
      return b!;
    };

    // PLATFORM_ADMIN: mandato tecnico. M1 gli dà `mask` su COMPENSATION → la vista c'è,
    // i valori no. Se sparisse sarebbe indistinguibile da una vista mai esistita.
    expect((await vistaEconomica(platform)).access).toBe("masked");
    // TENANT_ADMIN: mandato HR. La stessa vista, aperta. Il confronto fra i due è ciò che
    // rende questa prova capace di fallire: se la mascheratura smettesse di funzionare le
    // due righe direbbero la stessa cosa, e una delle due diventerebbe rossa.
    expect((await vistaEconomica(tenant)).access).toBe("open");
  });

  it("una vista che non espone dati di persona non è mascherabile da M1", async () => {
    const r = await app.app.inject({
      method: "GET", url: "/v1/dashboard/catalog/platform", headers: { cookie: ch(platform) },
    });
    expect(r.statusCode).toBe(200);
    const senzaClassi = (r.json() as Dettaglio).blocks.filter((b) => b.dataClasses.length === 0);
    expect(senzaClassi.length).toBeGreaterThan(0);
    for (const b of senzaClassi) {
      expect(b.access, `la vista ${b.code} non espone classi: M1 non può chiuderla`).toBe("open");
    }
  });

  it("senza autenticazione è 401", async () => {
    const r = await app.app.inject({ method: "GET", url: "/v1/dashboard/catalog" });
    expect(r.statusCode).toBe(401);
  });
});
