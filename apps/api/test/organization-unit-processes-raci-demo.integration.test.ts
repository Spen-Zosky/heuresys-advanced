import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

/**
 * ITEM #5/#11 — LIVE verification of the PRODUCTION RACI OU<->process seed.
 *
 * Originally (S994 #11) this read back the small DEMO crosswalk (12 rows tagged
 * 'S994-#11'). S1002 (commit 9ce9a92) replaced that demo with the APPROVED
 * PRODUCTION mapping — 105 assignments tagged 'S1002-#5/#11' (DELETE demo →
 * INSERT 105) in db/seeds/reconciliation/54_raci_demo_rtl_s994.sql. This test
 * was re-pointed to the production seed and its role assertions re-verified
 * against the live DB (S1003) so the suite stays green after that refactor.
 *
 * It READS BACK the persistent AUTHORED PRODUCTION crosswalk through the REAL
 * endpoints, as the real RTL_BANK TENANT_ADMIN persona
 * (federica.marchetti@rtl-bank.org), and asserts the RACI roles are served from
 * the live DB. It also proves the write-path live (POST->GET->DELETE) on a
 * non-seed (OU,process) pair so it never disturbs the seeded rows.
 *
 * SAFETY: every assertion is scoped to RTL_BANK OUs; the write round-trip targets
 * an RTL OU only (the assignment inherits the OU's tenant — never HEURESYS, I5).
 * No DELETE of seeded rows (the temp assignment uses an unused OU/process).
 */

const PWD = TEST_PERSONA_PASSWORD;
const RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const SEED_ITEM = "S1002-#5/#11";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function jhdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" }; }
function chdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken }; }

async function ouIdByCode(code: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT organization_unit_id AS id FROM sys.sys_organization_units
      WHERE organization_unit_code=$1 AND organization_unit_tenant_id=$2`,
    [code, RTL],
  );
  if (!r.rows[0]) throw new Error(`RTL OU ${code} not found`);
  return r.rows[0].id;
}
/**
 * [S1045] L'unita' RTL che il seme dichiara INFORMED su un processo, letta dal vivo.
 * Lancia se non ne esiste nessuna: una verifica senza soggetto non va contata fra
 * quelle superate (stessa regola di `helpers/org-actors.ts`).
 */
async function ouInformataSu(processCode: string): Promise<{ id: string; code: string }> {
  const r = await pool.query<{ id: string; code: string }>(
    `SELECT ou.organization_unit_id AS id, ou.organization_unit_code AS code
       FROM sys.sys_organization_unit_processes p
       JOIN sys.sys_organization_units ou
         ON ou.organization_unit_id = p.org_unit_process_org_unit_id
        AND ou.organization_unit_is_active
       JOIN sys.sys_blueprint_process_registry r
         ON r.blueprint_process_id = p.org_unit_process_blueprint_process_id
      WHERE p.org_unit_process_tenant_id = $1
        AND p.org_unit_process_metadata->>'item' = $2
        AND r.blueprint_process_code = $3
        AND p.org_unit_process_role = 'INFORMED'
      ORDER BY ou.organization_unit_code
      LIMIT 1`,
    [RTL, SEED_ITEM, processCode],
  );
  const a = r.rows[0];
  if (!a) throw new Error(`nessuna unita' attiva INFORMED sul processo ${processCode}: verifica cieca`);
  return a;
}

async function processIdByCode(code: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT blueprint_process_id AS id FROM sys.sys_blueprint_process_registry WHERE blueprint_process_code=$1`,
    [code],
  );
  if (!r.rows[0]) throw new Error(`process ${code} not found`);
  return r.rows[0].id;
}

let suite: TestApp;
let author: S;  // TENANT_ADMIN (RTL) — reads + write round-trip

beforeAll(async () => {
  suite = await buildTestApp();
  author = await login(suite, "federica.marchetti@rtl-bank.org");

  // [S1045] PRECONDIZIONE STRUTTURALE, NON UN CONTEGGIO.
  //
  // Prima si esigevano >=100 righe ("105 di produzione"). Quel numero descriveva
  // l'organigramma del 21 giugno: la ricostruzione (S1043, mig 000244->000258) ha
  // DISATTIVATO due unita' — DIR-CORP e DIV-RISK — e le loro 9 assegnazioni sono
  // sparite con loro (105 -> 96). Non e' il seme che manca: e' l'azienda che e'
  // cambiata, ed e' esattamente il difetto che #115 ha corretto altrove — un
  // atteso fisso che duplica una fonte di verita' viva.
  //
  // Cio' che DEVE valere non e' quante righe ci sono, ma che la matrice regga:
  // ogni processo coperto ha uno e un solo responsabile, e nessuna responsabilita'
  // pende da un reparto chiuso. Se domani si chiude un altro reparto il test resta
  // verde; se un processo resta senza responsabile diventa rosso — che e' il caso
  // che vale la pena sorvegliare.
  const stato = await pool.query<{
    processi: string; owner: string; processi_con_owner: string; su_unita_spente: string;
  }>(
    `WITH seme AS (
       SELECT p.org_unit_process_blueprint_process_id AS processo,
              p.org_unit_process_role                 AS ruolo,
              ou.organization_unit_is_active          AS attiva
         FROM sys.sys_organization_unit_processes p
         JOIN sys.sys_organization_units ou
           ON ou.organization_unit_id = p.org_unit_process_org_unit_id
        WHERE p.org_unit_process_tenant_id = $1
          AND p.org_unit_process_metadata->>'item' = $2)
     SELECT count(DISTINCT processo)                              AS processi,
            count(*) FILTER (WHERE ruolo = 'OWNER')               AS owner,
            count(DISTINCT processo) FILTER (WHERE ruolo='OWNER') AS processi_con_owner,
            count(*) FILTER (WHERE NOT attiva)                    AS su_unita_spente
       FROM seme`,
    [RTL, SEED_ITEM],
  );
  const s = stato.rows[0]!;
  // >12 distingue il seme di PRODUZIONE dalla vecchia demo S994 (12 righe, altro tag).
  if (Number(s.processi) <= 12) {
    throw new Error(
      `RACI production seed missing (solo ${s.processi} processi coperti col tag ${SEED_ITEM}). ` +
        "Applica db/seeds/reconciliation/54_raci_demo_rtl_s994.sql.",
    );
  }
  if (s.processi !== s.processi_con_owner || s.owner !== s.processi) {
    throw new Error(
      `matrice RACI incoerente: ${s.processi} processi coperti, ${s.processi_con_owner} con un ` +
        `responsabile, ${s.owner} responsabili in tutto — atteso uno e uno solo per processo`,
    );
  }
  if (Number(s.su_unita_spente) > 0) {
    throw new Error(
      `${s.su_unita_spente} responsabilita' RACI pendono da unita' disattivate: ` +
        "vanno riassegnate a un'unita' viva, non lasciate su un reparto chiuso",
    );
  }
});

afterAll(async () => {
  await suite.app.close();
});

describe("RACI OU<->process PRODUCTION seed — live read-back via real API (S1002 #5/#11)", () => {
  it("by-ou: the unit INFORMED on '02 KYC / AML' is served as INFORMED through the API", async () => {
    // [S1045] L'unita' non e' piu' scritta a mano. Era `DIV-RISK`, che la
    // ricostruzione dell'organigramma ha DISATTIVATO: il test cadeva su un reparto
    // chiuso, senza misurare niente sull'API. Si chiede al dato chi e' informato
    // oggi (e' `RTL`, la capogruppo) e poi si verifica che l'API serva QUEL ruolo.
    // Non e' tautologico: il confronto e' fra il DB e il percorso rotta->servizio->
    // repository->RBAC, che e' l'oggetto del test.
    const atteso = await ouInformataSu("02");
    const r = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${atteso.id}`, headers: { cookie: ch(author.cookies) } });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: { blueprintProcessCode: string; blueprintProcessName: string; role: string }[] }).items;
    const aml = items.find((i) => i.blueprintProcessCode === "02");
    expect(aml).toBeTruthy();
    expect(aml!.role).toBe("INFORMED");
    expect(aml!.blueprintProcessName).toContain("KYC");
  });

  it("by-ou: DIV-LEGAL is OWNER of '11 Compliance & Regulatory Reporting'", async () => {
    const ou = await ouIdByCode("DIV-LEGAL");
    const r = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ou}`, headers: { cookie: ch(author.cookies) } });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: { blueprintProcessCode: string; role: string }[] }).items;
    expect(items.find((i) => i.blueprintProcessCode === "11")?.role).toBe("OWNER");
  });

  it("by-ou: DIV-OPS is INFORMED on '12 Internal Audit'", async () => {
    const ou = await ouIdByCode("DIV-OPS");
    const r = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ou}`, headers: { cookie: ch(author.cookies) } });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: { blueprintProcessCode: string; role: string }[] }).items;
    expect(items.find((i) => i.blueprintProcessCode === "12")?.role).toBe("INFORMED");
  });

  it("by-process: '10 Risk Management' reverse-lookup lists DIR-RISKM as OWNER", async () => {
    const proc = await processIdByCode("10");
    const r = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-process/${proc}`, headers: { cookie: ch(author.cookies) } });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: { orgUnitCode: string; orgUnitName: string; role: string }[] }).items;
    const riskm = items.find((i) => i.orgUnitCode === "DIR-RISKM");
    expect(riskm).toBeTruthy();
    expect(riskm!.role).toBe("OWNER");
    expect(riskm!.orgUnitName).toBeTruthy();
  });

  it("all 4 RACI roles (OWNER/CONTRIBUTOR/CONSULTED/INFORMED) are present across the seeded OUs, served via the API", async () => {
    // Pull the seeded OUs from the DB, then collect roles strictly through the API.
    const seedOus = await pool.query<{ code: string; id: string }>(
      `SELECT DISTINCT ou.organization_unit_code AS code, ou.organization_unit_id AS id
         FROM sys.sys_organization_unit_processes x
         JOIN sys.sys_organization_units ou ON ou.organization_unit_id=x.org_unit_process_org_unit_id
        WHERE x.org_unit_process_metadata->>'item'=$1 AND x.org_unit_process_tenant_id=$2`,
      [SEED_ITEM, RTL],
    );
    const roles = new Set<string>();
    for (const ou of seedOus.rows) {
      const r = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ou.id}`, headers: { cookie: ch(author.cookies) } });
      expect(r.statusCode).toBe(200);
      for (const it of (r.json() as { items: { role: string }[] }).items) roles.add(it.role);
    }
    expect(roles).toEqual(new Set(["OWNER", "CONTRIBUTOR", "CONSULTED", "INFORMED"]));
  });

  it("write-path live: POST a fresh RACI assignment (CSRF) → GET by-ou → DELETE (no seed disturbed)", async () => {
    // Use a (OU, process) pair NOT in the seed: FIL-MI-CEN (a branch) x '13 Branch Operations'.
    const ou = await ouIdByCode("FIL-MI-CEN");
    const proc = await processIdByCode("13");
    // Pristine: ensure no leftover assignment from a prior run.
    await pool.query(
      "DELETE FROM sys.sys_organization_unit_processes WHERE org_unit_process_org_unit_id=$1 AND org_unit_process_blueprint_process_id=$2",
      [ou, proc],
    );

    const created = await suite.app.inject({
      method: "POST", url: "/v1/organization-unit-processes", headers: jhdr(author),
      payload: { ouId: ou, processId: proc, role: "OWNER" },
    });
    expect(created.statusCode).toBe(200);
    const body = created.json() as { orgUnitProcessId: string; role: string; tenantId: string };
    expect(body.role).toBe("OWNER");
    expect(body.tenantId).toBe(RTL); // inherits the OU's tenant — never HEURESYS

    const byOu = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ou}`, headers: { cookie: ch(author.cookies) } });
    expect(byOu.statusCode).toBe(200);
    expect((byOu.json() as { items: { blueprintProcessCode: string }[] }).items.some((i) => i.blueprintProcessCode === "13")).toBe(true);

    const del = await suite.app.inject({ method: "DELETE", url: `/v1/organization-unit-processes/${body.orgUnitProcessId}`, headers: chdr(author) });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { deleted: boolean }).deleted).toBe(true);

    const after = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ou}`, headers: { cookie: ch(author.cookies) } });
    expect((after.json() as { items: { blueprintProcessCode: string }[] }).items.some((i) => i.blueprintProcessCode === "13")).toBe(false);
  });
});
