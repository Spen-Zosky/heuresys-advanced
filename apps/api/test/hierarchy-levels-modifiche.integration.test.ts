/**
 * apps/api/test/hierarchy-levels-modifiche.integration.test.ts — #265 F3: l'avviso gerarchia-livelli nelle risposte di modifica.
 *
 * Cambiare il riporto o il responsabile di un'unita' (PATCH/POST /v1/organization-units) e proporre un'assegnazione di posto
 * (POST /v1/user-position-assignments, /:id/transfer) puo' mettere un livello contrattuale piu' alto sotto uno piu' basso. La risposta
 * porta gli avvisi che QUELLA modifica introduce, con la motivazione scritta; la modifica si applica comunque (non blocca).
 * ADR-0045: nessuna rotta scrive i dati contrattuali. Qui il livello delle persone si imposta con SQL del test, dentro la transazione
 * del file (D-52), che a fine corsa torna indietro: i contratti restano "importati" e la prova DIF-4 non cambia.
 *
 * Ogni scenario ha il suo esito opposto (stessa mossa, livelli invertiti): un avviso che compare sempre, o mai, non dimostra niente.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";

senzaCacheDiSessione();

const RTL_BANK = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const HRMS_MANAGER_EMAIL = "maria.colombo@rtl-bank.org";
const MARCA = randomUUID().slice(0, 8).toUpperCase();

// I livelli del contratto di prova nascono dalla 000454: dove non c'e' (clone del gemello prima del deploy) la prova lo dice e salta.
const schemaPresente = (await pool.query<{ ok: boolean }>(`SELECT to_regclass('sys.sys_blueprint_content_ccnl_levels') IS NOT NULL AS ok`)).rows[0]?.ok === true;
if (!schemaPresente) console.warn("[hierarchy-levels-modifiche] PROVA NON ESEGUITA: manca sys.sys_blueprint_content_ccnl_levels (migrazione 000454)");

interface Avviso { unitaId: string; responsabileLivello: string; sottopostoPosto: string; sottopostoLivello: string; motivazione: string }
interface Unita { organizationUnitId: string; parentId: string | null; managerUserId: string | null; avvisiGerarchiaLivelli: Avviso[] }

let suite: TestApp;
let cookie = "";
let csrf = "";
let Q1 = "", Q2 = "", Q3 = "", Q3B = "";
let trasferibile: { assignmentId: string; userId: string } | null = null;

const H = () => ({ cookie, "x-csrf-token": csrf });
async function creaUnita(nome: string, extra: Record<string, unknown> = {}): Promise<Unita> {
  const r = await suite.app.inject({ method: "POST", url: "/v1/organization-units", headers: H(), payload: { code: `GL-${MARCA}-${nome}`, name: `Prova ${MARCA} ${nome}`, ...extra } });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as Unita;
}
async function modifica(id: string, payload: Record<string, unknown>): Promise<{ status: number; body: Unita }> {
  const r = await suite.app.inject({ method: "PATCH", url: `/v1/organization-units/${id}`, headers: H(), payload });
  return { status: r.statusCode, body: r.json() as Unita };
}
async function creaPosto(unitId: string, nome: string): Promise<string> {
  const r = await suite.app.inject({ method: "POST", url: "/v1/positions", headers: H(), payload: { code: `GL-${MARCA}-${nome}`, title: `Posto ${nome} ${MARCA}`, organizationUnitId: unitId } });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { positionId: string }).positionId;
}
const assegna = (userId: string, positionId: string) =>
  suite.app.inject({ method: "POST", url: "/v1/user-position-assignments", headers: H(), payload: { userId, positionId, startDate: "2026-11-01" } });

describe.skipIf(!schemaPresente)("avvisi gerarchia-livelli nelle risposte di modifica (#265 F3)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, HRMS_MANAGER_EMAIL, TEST_PERSONA_PASSWORD);
    cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    csrf = (r.json() as { csrfToken: string }).csrfToken;

    // Un modello PUBBLICATO con un contratto di tre livelli, attivo su RTL_BANK al posto di quello che c'e' (si torna indietro a fine file).
    const fam = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name, blueprint_family_description)
       VALUES ($1, 'Prova avvisi di modifica', 'Famiglia di prova') RETURNING blueprint_family_id AS id`, [`TEST_GL_${MARCA}`]);
    const variante = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name, blueprint_variant_description)
       VALUES ($1, 'V', 'Prova', 'Prova') RETURNING blueprint_variant_id AS id`, [fam.rows[0]!.id]);
    const ver = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_variant_versions (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
       VALUES ($1, 2, 'PUBLISHED') RETURNING blueprint_variant_version_id AS id`, [variante.rows[0]!.id]);
    const versionId = ver.rows[0]!.id;
    await pool.query(`INSERT INTO sys.sys_blueprint_content_ccnl (blueprint_content_ccnl_version_id, blueprint_content_ccnl_code, blueprint_content_ccnl_name) VALUES ($1, 'CCNL_T', 'Contratto di prova')`, [versionId]);
    for (const [codice, minimo] of [["CCNL_T_QD1", 40000], ["CCNL_T_QD2", 50000], ["CCNL_T_QD3", 60000]] as const) {
      await pool.query(
        `INSERT INTO sys.sys_blueprint_content_ccnl_levels (blueprint_content_ccnl_level_version_id, blueprint_content_ccnl_level_ccnl_code, blueprint_content_ccnl_level_code,
            blueprint_content_ccnl_level_name, blueprint_content_ccnl_level_annual_minimum_eur) VALUES ($1, 'CCNL_T', $2, $4, $3)`,
        [versionId, codice, minimo, `Livello ${codice}`]);
    }
    await pool.query(`UPDATE sys.sys_blueprint_activations SET blueprint_activation_status = 'SUSPENDED' WHERE blueprint_activation_tenant_id = $1 AND blueprint_activation_status = 'ACTIVE'`, [RTL_BANK]);
    await pool.query(`INSERT INTO sys.sys_blueprint_activations (blueprint_activation_tenant_id, blueprint_activation_variant_id) VALUES ($1, $2)`, [RTL_BANK, variante.rows[0]!.id]);

    // Quattro persone vere con un contratto attivo, e il loro livello nel contratto di prova (SQL del test: nessuna rotta lo fa).
    const persone = await pool.query<{ user_id: string }>(
      `SELECT DISTINCT c.user_contract_user_id AS user_id FROM sys.sys_user_contracts c JOIN sys.sys_users u ON u.user_id = c.user_contract_user_id
        WHERE c.user_contract_status = 'ACTIVE' AND u.user_tenant_id = $1 ORDER BY 1 LIMIT 4`, [RTL_BANK]);
    expect(persone.rows).toHaveLength(4);
    [Q1, Q2, Q3, Q3B] = persone.rows.map((x) => x.user_id) as [string, string, string, string];
    for (const [uid, livello] of [[Q1, "CCNL_T_QD1"], [Q2, "CCNL_T_QD2"], [Q3, "CCNL_T_QD3"], [Q3B, "CCNL_T_QD3"]] as const) {
      await pool.query(`UPDATE sys.sys_user_contracts SET user_contract_ccnl_level = $2 WHERE user_contract_user_id = $1 AND user_contract_status = 'ACTIVE'`, [uid, livello]);
    }
    // Un incarico attivo di una quinta persona vera, per il trasferimento: la porto a QD3.
    const inc = await pool.query<{ aid: string; uid: string }>(
      `SELECT a.user_position_assignment_id AS aid, a.user_position_assignment_user_id AS uid
         FROM sys.sys_user_position_assignments a JOIN sys.sys_user_contracts c ON c.user_contract_user_id = a.user_position_assignment_user_id AND c.user_contract_status = 'ACTIVE'
        WHERE a.user_position_assignment_tenant_id = $1 AND a.user_position_assignment_status = 'ACTIVE' AND a.user_position_assignment_user_id NOT IN ($2, $3, $4, $5) LIMIT 1`,
      [RTL_BANK, Q1, Q2, Q3, Q3B]);
    if (inc.rows[0]) {
      trasferibile = { assignmentId: inc.rows[0].aid, userId: inc.rows[0].uid };
      await pool.query(`UPDATE sys.sys_user_contracts SET user_contract_ccnl_level = 'CCNL_T_QD3' WHERE user_contract_user_id = $1 AND user_contract_status = 'ACTIVE'`, [trasferibile.userId]);
    }
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool(); // la transazione del file torna indietro: modello, attivazione, unita' e livelli di prova non restano
  });

  it("il riporto: spostare sotto un QD2 un'unita' guidata da un QD3 avvisa, con la motivazione scritta, e lo spostamento si applica", async () => {
    const alto = await creaUnita("A1", { managerUserId: Q2 });
    const sotto = await creaUnita("B1", { managerUserId: Q3 });
    expect(sotto.avvisiGerarchiaLivelli).toEqual([]); // da sola non e' sotto nessuno
    const r = await modifica(sotto.organizationUnitId, { parentId: alto.organizationUnitId });
    expect(r.status).toBe(200);
    expect(r.body.parentId).toBe(alto.organizationUnitId); // non blocca
    const a = r.body.avvisiGerarchiaLivelli.filter((x) => x.unitaId === alto.organizationUnitId);
    expect(a).toHaveLength(1);
    expect(a[0]!.responsabileLivello).toBe("CCNL_T_QD2");
    expect(a[0]!.sottopostoLivello).toBe("CCNL_T_QD3");
    expect(a[0]!.motivazione).toContain("CCNL_T_QD2");
    expect(a[0]!.motivazione).toContain("CCNL_T_QD3");
  });

  it("esito opposto: la stessa mossa con un QD1 al posto del QD3 non avvisa", async () => {
    const alto = await creaUnita("A2", { managerUserId: Q2 });
    const sotto = await creaUnita("B2", { managerUserId: Q1 });
    const r = await modifica(sotto.organizationUnitId, { parentId: alto.organizationUnitId });
    expect(r.status).toBe(200);
    expect(r.body.parentId).toBe(alto.organizationUnitId);
    expect(r.body.avvisiGerarchiaLivelli.filter((x) => x.unitaId === alto.organizationUnitId)).toEqual([]);
  });

  it("il responsabile: abbassare di livello chi guida un'unita' con un QD3 sotto avvisa; rialzarlo non avvisa", async () => {
    const alto = await creaUnita("A3", { managerUserId: Q3B });
    await creaUnita("B3", { managerUserId: Q3, parentId: alto.organizationUnitId });
    const giu = await modifica(alto.organizationUnitId, { managerUserId: Q1 });
    expect(giu.status).toBe(200);
    expect(giu.body.managerUserId).toBe(Q1);
    const a = giu.body.avvisiGerarchiaLivelli.filter((x) => x.unitaId === alto.organizationUnitId);
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.every((x) => x.responsabileLivello === "CCNL_T_QD1")).toBe(true);
    const su = await modifica(alto.organizationUnitId, { managerUserId: Q3B });
    expect(su.status).toBe(200);
    expect(su.body.avvisiGerarchiaLivelli.filter((x) => x.unitaId === alto.organizationUnitId)).toEqual([]);
  });

  it("un avviso che c'era gia' non si ripete, e una modifica che non tocca riporto o responsabile non ne porta", async () => {
    const alto = await creaUnita("A4", { managerUserId: Q2 });
    const sotto = await creaUnita("B4", { managerUserId: Q3 });
    await modifica(sotto.organizationUnitId, { parentId: alto.organizationUnitId }); // qui nasce l'avviso
    const nome = await modifica(alto.organizationUnitId, { name: `Prova ${MARCA} A4 rinominata` });
    expect(nome.status).toBe(200);
    expect(nome.body.avvisiGerarchiaLivelli).toEqual([]);
    const stesso = await modifica(sotto.organizationUnitId, { parentId: alto.organizationUnitId }); // riporto invariato: niente di nuovo
    expect(stesso.body.avvisiGerarchiaLivelli.filter((x) => x.unitaId === alto.organizationUnitId)).toEqual([]);
  });

  it("l'assegnazione di un posto: proporre un QD3 in un'unita' guidata da un QD2 avvisa nominando il posto; un QD1 no; la proposta nasce comunque", async () => {
    const alto = await creaUnita("A5", { managerUserId: Q2 });
    const posto = await creaPosto(alto.organizationUnitId, "P5");
    const ko = await assegna(Q3B, posto);
    expect(ko.statusCode, ko.body).toBe(201);
    const b = ko.json() as { approvalRequestId: string; action: string; avvisiGerarchiaLivelli: Avviso[] };
    expect(b.approvalRequestId).toBeTruthy(); // non blocca
    expect(b.avvisiGerarchiaLivelli).toHaveLength(1);
    expect(b.avvisiGerarchiaLivelli[0]!.sottopostoPosto).toBe(`Posto P5 ${MARCA}`);
    expect(b.avvisiGerarchiaLivelli[0]!.sottopostoLivello).toBe("CCNL_T_QD3");
    const ok = await assegna(Q1, posto);
    expect(ok.statusCode, ok.body).toBe(201);
    expect((ok.json() as { avvisiGerarchiaLivelli: Avviso[] }).avvisiGerarchiaLivelli).toEqual([]);
  });

  it("il trasferimento: portare un QD3 in un'unita' guidata da un QD2 avvisa", async () => {
    if (!trasferibile) return console.warn("[hierarchy-levels-modifiche] trasferimento non provato: nessun incarico attivo con contratto");
    const alto = await creaUnita("A6", { managerUserId: Q2 });
    const posto = await creaPosto(alto.organizationUnitId, "P6");
    const r = await suite.app.inject({ method: "POST", url: `/v1/user-position-assignments/${trasferibile.assignmentId}/transfer`, headers: H(), payload: { newPositionId: posto, startDate: "2026-11-01" } });
    expect(r.statusCode, r.body).toBe(201);
    const b = r.json() as { action: string; avvisiGerarchiaLivelli: Avviso[] };
    expect(b.action).toBe("TRANSFER");
    expect(b.avvisiGerarchiaLivelli.filter((x) => x.unitaId === alto.organizationUnitId)).toHaveLength(1);
  });

  it("ADR-0045: nessuna rotta scrive i dati contrattuali (sys_user_contracts resta 'importata')", async () => {
    const r = await suite.app.inject({ method: "PATCH", url: `/v1/users/${Q3}/contract-level`, headers: H(), payload: { level: "CCNL_T_QD1" } });
    expect([404, 405]).toContain(r.statusCode);
  });
});
