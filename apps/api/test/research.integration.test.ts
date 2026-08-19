/**
 * apps/api/test/research.integration.test.ts
 * #132 F4g — la superficie della ricerca, contro il database vero.
 *
 * COSA PROVA DAVVERO, e cosa no. Prova che una corsa **scriva la propria contabilita'**:
 * proposte, fonti con impronta, esiti dei controlli uno per uno, decisione motivata. Chi
 * propone e' una porta iniettata — non un finto prodotto, ma il **doppio della sola porta
 * non deterministica**, come il lettore ha il proprio server locale. Il fornitore vero e la
 * prova su pagine vere sono `F4h`.
 *
 * ⚠ IL CASO PIU' IMPORTANTE E' L'ULTIMO: le **12** corse di `STORIA36` vivono in queste
 * stesse tabelle, e nessuna riga di ricerca deve toccarle. Non e' teoria: sono la storia a
 * 36 mesi di RTL, ed e' il dataset su cui gira la dimostrazione del prodotto.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { platformAdmin } from "./helpers/actors.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { researchService } from "../src/modules/research/service.js";
import type { ProposalSource, PropostaGrezza } from "../src/modules/research/engine.js";
import type { WebReader, PaginaLetta } from "../src/modules/research/web-reader.js";
import { actorFromRequest } from "../src/lib/actor.js";

interface S { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
const hdr = (s: S) => ({ cookie: ch(s.cookies), "x-csrf-token": s.csrfToken });
const codiceDi = (b: unknown): string | undefined => (b as { error?: { code?: string } }).error?.code;

let t: TestApp;
let admin: S;
let adminUserId: string;
let versionId: string;
let blueprintId: string;
let numero: number;

/** Il lettore delle prove: pagine finte ma **byte veri**, cosi' l'impronta e' quella. */
const lettore = (pagine: Record<string, string>): WebReader => ({
  async leggi(url) {
    const testo = pagine[url];
    if (testo === undefined) throw new Error(`404 ${url}`);
    const { createHash } = await import("node:crypto");
    const buf = Buffer.from(testo, "utf8");
    const p: PaginaLetta = {
      urlRichiesto: url, url, status: 200, contentType: "text/html",
      byte: buf.byteLength, sha256: createHash("sha256").update(buf).digest("hex"),
      retrievedAt: new Date().toISOString(), testoNonFidato: testo, troncato: false,
    };
    return p;
  },
});

const sorgente = (proposte: PropostaGrezza[], daLeggere: string[]): ProposalSource => ({
  chiave: "prova-integrazione",
  async proponi(m) {
    for (const u of daLeggere) {
      try { await m.leggi(u); } catch { /* una pagina che non si apre non ferma la corsa */ }
    }
    return proposte;
  },
});

const FONTE_BUONA = {
  hostSuffix: "istat.it",
  label: "ISTAT",
  classe: "INSTITUTIONAL" as const,
  paese: "IT",
  dominioApplicabile: null,
  motivazione: "Istituto nazionale di statistica: pubblica i dati ufficiali sulle imprese italiane.",
};

beforeAll(async () => {
  t = await buildTestApp();
  const r = await loginRaw(t.app, (await platformAdmin()).email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  admin = { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };

  // Il fascicolo reale: RTL-BANK-CONFIG v1, che ha tutti e sei i parametri della ricerca.
  const { rows } = await pool.query<{ v: string; b: string; n: number }>(
    `SELECT v.tenant_blueprint_version_id AS v, b.tenant_blueprint_id AS b,
            v.tenant_blueprint_version_number AS n
       FROM sys.sys_tenant_blueprints b
       JOIN sys.sys_tenant_blueprint_versions v ON v.tenant_blueprint_version_blueprint_id = b.tenant_blueprint_id
      WHERE v.tenant_blueprint_version_industry_class_id IS NOT NULL
        AND v.tenant_blueprint_version_operating_model_id IS NOT NULL
        AND v.tenant_blueprint_version_employee_count >= 1
      ORDER BY v.created_at LIMIT 1`,
  );
  if (!rows[0]) throw new Error("nessuna versione di fascicolo coi sei parametri: il test misurerebbe il nulla");
  versionId = rows[0].v; blueprintId = rows[0].b; numero = rows[0].n;

  const { rows: u } = await pool.query<{ id: string }>(
    `SELECT user_id AS id FROM sys.sys_users WHERE user_email = $1`, [(await platformAdmin()).email],
  );
  adminUserId = u[0]!.id;
});

afterAll(async () => { await t.app.close(); await closePool(); });

/** L'attore, costruito come lo costruirebbe una rotta. */
const attore = () => actorFromRequest({ user: { sub: adminUserId, tenantId: null, roles: ["PLATFORM_ADMIN"] } } as never);

describe("i domini dichiarati", () => {
  it("l'elenco viene dal codice, e contiene il dominio pilota", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/tenant-blueprints/research-domains", headers: hdr(admin) });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ chiave: string; fontiConfrontateColRegistro: boolean }> };
    const pilota = body.items.find((x) => x.chiave === "research_sources");
    expect(pilota).toBeDefined();
    // L'eccezione al confronto col registro e' visibile da fuori: non e' un segreto del codice.
    expect(pilota!.fontiConfrontateColRegistro).toBe(false);
  });
});

describe("la corsa non parte quando non deve", () => {
  it("dominio sconosciuto: 422 che dice quali esistono", async () => {
    const r = await t.app.inject({
      method: "POST", url: `/v1/tenant-blueprints/${blueprintId}/versions/${numero}/research`,
      headers: hdr(admin), payload: { dominio: "un_dominio_mai_dichiarato" },
    });
    expect(r.statusCode).toBe(422);
    expect(codiceDi(r.json())).toBe("RESEARCH_DOMAIN_UNKNOWN");
  });

  it("versione inesistente: 404", async () => {
    const r = await t.app.inject({
      method: "POST", url: `/v1/tenant-blueprints/${blueprintId}/versions/9999/research`,
      headers: hdr(admin), payload: { dominio: "research_sources" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("⚠ senza chi propone, la corsa NON si chiude con zero proposte: fallisce e lo dice", async () => {
    // La sorgente predefinita e' quella che dichiara la propria assenza. Uno zero silenzioso
    // qui sarebbe indistinguibile da «ha cercato e non ha trovato niente».
    const r = await t.app.inject({
      method: "POST", url: `/v1/tenant-blueprints/${blueprintId}/versions/${numero}/research`,
      headers: hdr(admin), payload: { dominio: "research_sources" },
    });
    expect(r.statusCode).toBe(409);
    expect(codiceDi(r.json())).toBe("RESEARCH_RUN_FAILED");
    expect(JSON.stringify(r.json())).toContain("fornitore di proposte non e' configurato");

    // ...e la corsa caduta resta nel registro col motivo, invece di sparire.
    const { rows } = await pool.query<{ stato: string; motivo: string | null }>(
      `SELECT seed_acquisition_run_status AS stato, seed_acquisition_run_metadata->>'errore' AS motivo
         FROM sys.sys_seed_acquisition_runs
        WHERE seed_acquisition_run_blueprint_version_id = $1
        ORDER BY seed_acquisition_run_started_at DESC LIMIT 1`, [versionId],
    );
    expect(rows[0]?.stato).toBe("FAILED");
    expect(rows[0]?.motivo).toContain("proporre");
  });
});

describe("una corsa vera scrive la propria contabilita'", () => {
  it("proposte, fonti con impronta, controlli uno per uno — e la decisione motivata", async () => {
    const url = "https://www.istat.it/it/imprese";
    const corsa = await researchService.avvia(attore(), versionId, "research_sources", {
      lettore: lettore({ [url]: "<html><body><h1>Imprese</h1><p>dati ufficiali</p></body></html>" }),
      sorgente: sorgente(
        [
          { contenuto: FONTE_BUONA, fonti: [url] },
          // senza fonti: dev'essere respinta, e comparire lo stesso nel registro
          { contenuto: { ...FONTE_BUONA, hostSuffix: "bancaditalia.it", label: "Banca d'Italia" }, fonti: [] },
        ],
        [url],
      ),
    });

    expect(corsa.stato).toBe("COMPLETED");
    expect(corsa.proposteTotali).toBe(2);
    expect(corsa.propostePassate).toBe(1);
    expect(corsa.proposteRespinte).toBe(1);
    expect(corsa.pagineLette).toBe(1);
    expect(corsa.domande.length).toBeGreaterThan(0);

    const lista = await t.app.inject({
      method: "GET", url: `/v1/seed-acquisition-runs/${corsa.runId}/candidates`, headers: hdr(admin),
    });
    expect(lista.statusCode).toBe(200);
    const body = lista.json() as {
      items: Array<{
        candidateId: string; chiaveNaturale: string; stato: string;
        controlli: Array<{ regola: string; esito: string }>;
        evidenze: Array<{ url: string; sha256: string | null }>;
      }>;
    };
    expect(body.items).toHaveLength(2);

    const passata = body.items.find((x) => x.stato === "PASSED")!;
    expect(passata.chiaveNaturale).toBe("istat.it|*");
    expect(passata.evidenze).toHaveLength(1);
    expect(passata.evidenze[0]!.url).toBe(url);
    expect(passata.evidenze[0]!.sha256).toHaveLength(64);
    expect(passata.controlli.map((c) => c.regola)).toContain("SOURCES_PRESENT");
    expect(passata.controlli.find((c) => c.regola === "RAW_TEXT_LEAK")?.esito).toBe("PASSED");

    const respinta = body.items.find((x) => x.stato === "FAILED")!;
    expect(respinta.controlli.find((c) => c.regola === "SOURCES_PRESENT")?.esito).toBe("FAILED");
    expect(respinta.evidenze).toHaveLength(0);

    // ⚠ una proposta respinta dai controlli non si approva a mano
    const forzata = await t.app.inject({
      method: "POST", url: `/v1/seed-candidate-records/${respinta.candidateId}/decision`,
      headers: hdr(admin), payload: { decisione: "APPROVED", motivazione: "la voglio lo stesso, e non e' un motivo" },
    });
    expect(forzata.statusCode).toBe(409);
    expect(codiceDi(forzata.json())).toBe("RESEARCH_CANDIDATE_FAILED_CHECKS");

    // ...ma respingerla con motivazione si', e la motivazione resta scritta
    const respinge = await t.app.inject({
      method: "POST", url: `/v1/seed-candidate-records/${respinta.candidateId}/decision`,
      headers: hdr(admin), payload: { decisione: "REJECTED", motivazione: "senza una fonte non e' una proposta" },
    });
    expect(respinge.statusCode).toBe(200);

    const decisa = await t.app.inject({
      method: "POST", url: `/v1/seed-candidate-records/${passata.candidateId}/decision`,
      headers: hdr(admin), payload: { decisione: "APPROVED", motivazione: "fonte istituzionale, verificata aprendola" },
    });
    expect(decisa.statusCode).toBe(200);
    const dopo = decisa.json() as { stato: string; decisione: { motivazione: string; approvatoreUserId: string } | null };
    expect(dopo.stato).toBe("APPROVED");
    expect(dopo.decisione?.motivazione).toContain("fonte istituzionale");
    expect(dopo.decisione?.approvatoreUserId).toBe(adminUserId);
  });

  it("una seconda corsa non duplica cio' che c'e': lo segnala", async () => {
    const url = "https://www.istat.it/it/imprese";
    const opzioni = {
      lettore: lettore({ [url]: "<html><body>dati</body></html>" }),
      sorgente: sorgente([{ contenuto: FONTE_BUONA, fonti: [url] }], [url]),
    };
    await researchService.avvia(attore(), versionId, "research_sources", opzioni);
    const seconda = await researchService.avvia(attore(), versionId, "research_sources", opzioni);
    expect(seconda.proposteConAvviso).toBe(1);
    expect(seconda.propostePassate).toBe(0);
  });
});

describe("⚠ la convivenza con STORIA36", () => {
  it("le corse storiche restano intatte, col loro tenant e senza fascicolo", async () => {
    const { rows } = await pool.query<{ n: string; senza_tenant: string; con_versione: string }>(
      `SELECT count(*)::text AS n,
              count(*) FILTER (WHERE seed_acquisition_run_tenant_id IS NULL)::text AS senza_tenant,
              count(*) FILTER (WHERE seed_acquisition_run_blueprint_version_id IS NOT NULL)::text AS con_versione
         FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_code LIKE 'STORIA36%'`,
    );
    expect(Number(rows[0]!.n)).toBeGreaterThan(0);
    expect(rows[0]!.senza_tenant).toBe("0");
    expect(rows[0]!.con_versione).toBe("0");
  });

  it("e le loro proposte non finiscono fra quelle di una corsa di ricerca", async () => {
    const url = "https://www.istat.it/x";
    const corsa = await researchService.avvia(attore(), versionId, "research_sources", {
      lettore: lettore({ [url]: "<html>dati</html>" }),
      sorgente: sorgente([{ contenuto: FONTE_BUONA, fonti: [url] }], [url]),
    });
    const proposte = await researchService.proposte(attore(), corsa.runId);
    expect(proposte.items.every((p) => p.dominio === "research_sources")).toBe(true);
    expect(proposte.items.some((p) => p.dominio === "storia36")).toBe(false);
  });
});
