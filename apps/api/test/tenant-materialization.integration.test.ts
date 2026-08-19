/**
 * apps/api/test/tenant-materialization.integration.test.ts
 * COSTRUIRE UN'AZIENDA DA UN MODELLO (#4 WI-C, riscritto da #132 F3 — E29).
 *
 * `/v1/tenant-materialization`: login vero, database vivo. Riservato a `PLATFORM_ADMIN`;
 * l'azienda di destinazione deve esistere ed essere `ACTIVE` (M-1). Le scritture toccano solo
 * l'azienda validata (I5).
 *
 * ⚠ COSA È CAMBIATO. Questo file provava il modulo quando costruiva da un **archetipo**
 * cablato in TypeScript — 296 righe che descrivevano una banca al dettaglio, con codici
 * `RBR-*` e titolari sintetici `SYN_RBR-*`. Ritirato da `#132` F3 (E29): *«qualunque azienda
 * si costruisse, nasceva quella banca»*. Ora il contenuto viene dal database, e il modello di
 * prova **lo semina questo file** — non è un archetipo con un altro nome, è una fixture che
 * nasce e muore con la corsa (→ `helpers/modello-di-prova.ts`).
 *
 * I CONTEGGI ATTESI SI DERIVANO DAL MODELLO SEMINATO, non sono ricopiati qui: `modello.attese`
 * viene dallo stesso posto che ha scritto le righe. Ricopiarli sarebbe una seconda SoT da
 * tenere allineata a mano — e il giorno in cui la fixture cambiasse, il test proverebbe una
 * cosa diversa da quella che dice.
 *
 * ⚠ ZERO TITOLARI NON È UN BUCO, È LA DECISIONE. Un modello descrive la **forma** di
 * un'azienda, non chi ci lavora: `users`, `assignments` e le evidenze valgono `0`. L'archetipo
 * ne inventava uno per posizione, ed è il motivo per cui ogni azienda costruita nasceva con lo
 * stesso organico fittizio.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { anIndustryCode } from "./helpers/industry.js";
import { seminaModello, type ModelloDiProva } from "./helpers/modello-di-prova.js";
import { platformAdmin } from "./helpers/actors.js";

const RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const MARCA = `WIC-${Date.now()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  // ⚠ La password NON è un valore unico condiviso: si DERIVA dall'email (Z-262), ed è
  //   `loginRaw` a farlo quando non gliene si passa una. Un utente `platform.admin@…`
  //   scritto a mano non esiste: l'attore si cerca nel database per RUOLO.
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
const jhdr = (s: S) => ({ cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" });

let suite: TestApp;
let admin: S, federica: S;
let suspendedTenantId: string;
let modello: ModelloDiProva;

interface Counts {
  orgUnits: number; positions: number; users: number; assignments: number;
  skills: number; kpis: number; skillEvidence: number; kpiEvidence: number;
}
interface Result { created: Counts; skipped: Counts; total: Counts; tenantId: string; sourceLabel: string }

function materialize(s: S, tenantId: string, mode: "plan" | "apply", variantVersionId?: string) {
  return suite.app.inject({
    method: "POST", url: "/v1/tenant-materialization", headers: jhdr(s),
    payload: { tenantId, variantVersionId: variantVersionId ?? modello.variantVersionId, mode },
  });
}

/** Le righe che QUESTO modello crea, riconosciute dal suffisso della fixture. */
async function conta(tenantId: string): Promise<{ ou: number; pos: number; skills: number; kpis: number }> {
  const q = async (sql: string) => {
    const r = await pool.query<{ c: string }>(sql, [tenantId, `%-${MARCA}`]);
    return Number(r.rows[0]!.c);
  };
  return {
    ou: await q(`SELECT count(*) AS c FROM sys.sys_organization_units
                  WHERE organization_unit_tenant_id = $1 AND organization_unit_code LIKE $2`),
    pos: await q(`SELECT count(*) AS c FROM sys.sys_positions
                   WHERE position_tenant_id = $1 AND position_code LIKE $2`),
    skills: await q(`SELECT count(*) AS c FROM sys.sys_skills
                      WHERE skill_tenant_id = $1 AND skill_code LIKE $2`),
    kpis: await q(`SELECT count(*) AS c FROM sys.sys_kpi_definitions
                    WHERE kpi_definition_tenant_id = $1 AND kpi_definition_code LIKE $2`),
  };
}

/** Quante persone generate esistono nell'azienda: dev'essere sempre zero (#132 F2). */
async function contaGenerati(tenantId: string): Promise<number> {
  const r = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_users
      WHERE user_tenant_id = $1 AND coalesce(user_type, '') = 'GENERATED_INCUMBENT'`,
    [tenantId],
  );
  return Number(r.rows[0]!.c);
}

beforeAll(async () => {
  suite = await buildTestApp();
  modello = await seminaModello(pool, MARCA);
  admin = await login(suite, (await platformAdmin()).email);
  federica = await login(suite, "federica.marchetti@rtl-bank.org");

  const t = await pool.query<{ tenant_id: string }>(
    `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status, tenant_industry_code)
     VALUES ($1, $2, 'SUSPENDED', $3) RETURNING tenant_id`,
    [`WIC_SUSP_${MARCA}`, "Azienda sospesa di collaudo", await anIndustryCode()],
  );
  suspendedTenantId = t.rows[0]!.tenant_id;
});

afterAll(async () => {
  await suite.app.close();
});

describe("costruzione di un'azienda da un modello (#4 WI-C)", () => {
  it("GET /sources elenca il modello seminato coi suoi conteggi", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/tenant-materialization/sources", headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: { variantVersionId: string; label: string; orgUnitCount: number; positionCount: number }[] };
    const mio = b.items.find((x) => x.variantVersionId === modello.variantVersionId);
    expect(mio, "il modello seminato non compare fra quelli costruibili").toBeDefined();
    expect(mio!.label).toBe(modello.label);
    expect(mio!.orgUnitCount).toBe(modello.attese.orgUnits);
    expect(mio!.positionCount).toBe(modello.attese.positions);
  });

  it("plan non scrive niente e dichiara tutto ciò che nascerebbe", async () => {
    const prima = await conta(RTL);
    expect(prima, "l'azienda non deve già contenere le righe di questo modello").toEqual({
      ou: 0, pos: 0, skills: 0, kpis: 0,
    });

    const r = await materialize(admin, RTL, "plan");
    expect(r.statusCode, r.body).toBe(200);
    const b = r.json() as Result;
    expect(b.sourceLabel).toBe(modello.label);
    expect(b.total.orgUnits).toBe(modello.attese.orgUnits);
    expect(b.total.positions).toBe(modello.attese.positions);
    expect(b.created.orgUnits).toBe(modello.attese.orgUnits);
    expect(b.created.positions).toBe(modello.attese.positions);

    // …e dopo un `plan` il database è come prima: è ciò che distingue un'anteprima.
    expect(await conta(RTL)).toEqual({ ou: 0, pos: 0, skills: 0, kpis: 0 });
  });

  it("apply costruisce davvero, e la prova sta nelle righe non nella risposta", async () => {
    const r = await materialize(admin, RTL, "apply");
    expect(r.statusCode, r.body).toBe(200);
    const b = r.json() as Result;
    expect(b.created.orgUnits).toBe(modello.attese.orgUnits);
    expect(b.created.positions).toBe(modello.attese.positions);

    const dopo = await conta(RTL);
    expect(dopo.ou).toBe(modello.attese.orgUnits);
    expect(dopo.pos).toBe(modello.attese.positions);
    expect(dopo.skills).toBe(modello.attese.skills);
    expect(dopo.kpis).toBe(modello.attese.kpis);
  });

  it("⭐ un modello non porta persone: nessun titolare sintetico è nato", async () => {
    // L'archetipo ne creava uno per posizione, con nome e cognome inventati. Se qualcuno li
    // reintroducesse, ogni azienda costruita tornerebbe ad avere lo stesso organico finto.
    expect(await contaGenerati(RTL)).toBe(0);
  });

  it("⭐ la struttura costruita è un ALBERO: i figli hanno davvero il loro padre", async () => {
    // È il difetto ① di `#132` F2: il motore risolve il padre da una mappa riempita man mano,
    // e un figlio costruito prima del padre finiva IN CIMA all'albero in silenzio. Qui si
    // guarda il risultato sul database, non l'ordine della lista.
    const r = await pool.query<{ code: string; padre: string | null }>(
      `SELECT u.organization_unit_code AS code, p.organization_unit_code AS padre
         FROM sys.sys_organization_units u
         LEFT JOIN sys.sys_organization_units p ON p.organization_unit_id = u.organization_unit_parent_id
        WHERE u.organization_unit_tenant_id = $1 AND u.organization_unit_code LIKE $2
        ORDER BY u.organization_unit_code`,
      [RTL, `%-${MARCA}`],
    );
    const per = new Map(r.rows.map((x) => [x.code, x.padre]));
    expect(per.get(`STAB-${MARCA}`)).toBe(`DG-${MARCA}`);
    expect(per.get(`MAG-${MARCA}`)).toBe(`STAB-${MARCA}`);
    expect(per.get(`LIN-${MARCA}`)).toBe(`STAB-${MARCA}`);
    expect(per.get(`DG-${MARCA}`), "la radice non ha padre").toBeNull();
  });

  it("ri-applicare è idempotente: zero create, tutte saltate", async () => {
    const r = await materialize(admin, RTL, "apply");
    expect(r.statusCode, r.body).toBe(200);
    const b = r.json() as Result;
    expect(b.created.orgUnits).toBe(0);
    expect(b.created.positions).toBe(0);
    expect(b.skipped.orgUnits).toBe(modello.attese.orgUnits);
    expect(b.skipped.positions).toBe(modello.attese.positions);
    expect(await conta(RTL)).toEqual({
      ou: modello.attese.orgUnits,
      pos: modello.attese.positions,
      skills: modello.attese.skills,
      kpis: modello.attese.kpis,
    });
  });

  it("chi non è PLATFORM_ADMIN non costruisce niente", async () => {
    const r = await materialize(federica, RTL, "apply");
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("TENANT_MATERIALIZE_ADMIN_ONLY");
  });

  it("un'azienda che non esiste → 404, e niente viene scritto", async () => {
    const r = await materialize(admin, "00000000-0000-0000-0000-000000000000", "apply");
    expect(r.statusCode).toBe(404);
  });

  it("un'azienda non ACTIVE non viene costruita (M-1, ri-verificato adesso)", async () => {
    const r = await materialize(admin, suspendedTenantId, "apply");
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("TENANT_NOT_ACTIVE");
    expect(await conta(suspendedTenantId)).toEqual({ ou: 0, pos: 0, skills: 0, kpis: 0 });
  });

  it("⭐ un modello che non esiste si rifiuta PRIMA di scrivere, non costruisce zero righe", async () => {
    // Lo zero silenzioso è il difetto peggiore qui: un'azienda vuota e un atto riuscito sono,
    // per chi guarda, la stessa cosa (`#132` F2).
    const r = await materialize(admin, RTL, "apply", "00000000-0000-0000-0000-000000000000");
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("BLUEPRINT_CONTENT_MISSING");
  });
});
