/**
 * apps/api/test/users-contract-level.integration.test.ts — #265 F4, PATCH /v1/users/:id/contract-level.
 *
 * Avviso, non blocco: la modifica riesce sempre; la risposta porta l'elenco degli avvisi (vuoto se il livello è in scala).
 * Esiti opposti: livello in scala (nessun avviso) e fuori scala (avviso con motivazione, livello comunque scritto).
 * Il contratto collettivo di prova entra nel tenant RTL sospendendo la sua attivazione corrente e attivandone una di prova:
 * tutto dentro la transazione del file, che il motore di test annulla a fine file.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

let suite: TestApp;
let hr: { cookie: string; csrf: string; userId: string; tenantId: string };
let manager: { cookie: string; csrf: string };
let targetId = "";
let contractId = "";
let senzaContrattoId = "";
const CODICE_FAMIGLIA = `TEST_LIVELLO_${randomUUID().slice(0, 8).toUpperCase()}`;

// Le tabelle dei contratti collettivi di modello nascono dalla migrazione 000454: dove manca (il clone del gemello prima del deploy)
// la prova non può girare e lo dice a voce alta, come hierarchy-levels.integration.test.ts. In CI (catena applicata) gira.
const schemaPresente = (await pool.query<{ ok: boolean }>(`SELECT to_regclass('sys.sys_blueprint_content_ccnl_levels') IS NOT NULL AS ok`)).rows[0]?.ok === true;
if (!schemaPresente) console.warn("[users-contract-level] PROVA NON ESEGUITA: manca sys.sys_blueprint_content_ccnl_levels (migrazione 000454 non applicata a questo database)");

async function accedi(email: string): Promise<{ cookie: string; csrf: string; userId: string }> {
  const r = await loginRaw(suite.app, email, TEST_PERSONA_PASSWORD);
  const b = r.json() as { user: { userId: string }; csrfToken: string };
  return { cookie: r.cookies.map((c) => `${c.name}=${c.value}`).join("; "), csrf: b.csrfToken, userId: b.user.userId };
}

function cambia(who: { cookie: string; csrf: string }, userId: string, payload: Record<string, unknown>) {
  return suite.app.inject({
    method: "PATCH",
    url: `/v1/users/${userId}/contract-level`,
    headers: { cookie: who.cookie, "x-csrf-token": who.csrf, "content-type": "application/json" },
    payload,
  });
}

async function livelloNelDb(id: string): Promise<string | null> {
  const r = await pool.query<{ l: string | null }>(`SELECT user_contract_ccnl_level AS l FROM sys.sys_user_contracts WHERE user_contract_id = $1`, [id]);
  return r.rows[0]?.l ?? null;
}

async function nuovoContratto(userId: string, tenantId: string, livello: string): Promise<string> {
  // start_date nel futuro lontano: è il contratto attivo "più recente" della persona, qualunque cosa abbia già.
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_user_contracts (user_contract_user_id, user_contract_tenant_id, user_contract_start_date, user_contract_ccnl_level, user_contract_status)
     VALUES ($1, $2, DATE '2999-01-01', $3, 'ACTIVE') RETURNING user_contract_id AS id`,
    [userId, tenantId, livello],
  );
  return r.rows[0]!.id;
}

describe.skipIf(!schemaPresente)("PATCH /v1/users/:id/contract-level integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const a = await accedi("federica.marchetti@rtl-bank.org");
    const t = await pool.query<{ t: string }>(`SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_id = $1`, [a.userId]);
    hr = { ...a, tenantId: t.rows[0]!.t };
    manager = await accedi("paolo.caputo@rtl-bank.org");

    const altri = await pool.query<{ id: string }>(
      `SELECT user_id AS id FROM sys.sys_users WHERE user_tenant_id = $1 AND user_id <> $2 AND user_id <> $3 ORDER BY user_email LIMIT 2`,
      [hr.tenantId, hr.userId, (await pool.query<{ id: string }>(`SELECT user_id AS id FROM sys.sys_users WHERE user_email = 'paolo.caputo@rtl-bank.org'`)).rows[0]!.id],
    );
    targetId = altri.rows[0]!.id;
    senzaContrattoId = altri.rows[1]!.id;
    contractId = await nuovoContratto(targetId, hr.tenantId, "CCNL_T_QD1");
    // la seconda persona non ha un contratto attivo: per lei la rotta deve rispondere 404 (e non scrivere niente)
    await pool.query(`UPDATE sys.sys_user_contracts SET user_contract_status = 'TERMINATED' WHERE user_contract_user_id = $1 AND user_contract_status = 'ACTIVE'`, [senzaContrattoId]);

    // un modello di prova PUBBLICATO con tre livelli, attivo per il tenant al posto dell'attivazione corrente
    await pool.query(`UPDATE sys.sys_blueprint_activations SET blueprint_activation_status = 'SUSPENDED' WHERE blueprint_activation_tenant_id = $1 AND blueprint_activation_status = 'ACTIVE'`, [hr.tenantId]);
    const fam = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name, blueprint_family_description)
       VALUES ($1, 'Prova livello', 'Famiglia di prova del test users-contract-level') RETURNING blueprint_family_id AS id`,
      [CODICE_FAMIGLIA],
    );
    const variante = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name, blueprint_variant_description)
       VALUES ($1, 'V', 'Prova', 'Prova') RETURNING blueprint_variant_id AS id`,
      [fam.rows[0]!.id],
    );
    const ver = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_variant_versions (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
       VALUES ($1, 2, 'PUBLISHED') RETURNING blueprint_variant_version_id AS id`,
      [variante.rows[0]!.id],
    );
    const versionId = ver.rows[0]!.id;
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_ccnl (blueprint_content_ccnl_version_id, blueprint_content_ccnl_code, blueprint_content_ccnl_name)
       VALUES ($1, 'CCNL_T', 'Contratto di prova')`,
      [versionId],
    );
    for (const [codice, minimo] of [["CCNL_T_QD1", 40000], ["CCNL_T_QD2", 50000], ["CCNL_T_QD3", 60000]] as const) {
      await pool.query(
        `INSERT INTO sys.sys_blueprint_content_ccnl_levels
           (blueprint_content_ccnl_level_version_id, blueprint_content_ccnl_level_ccnl_code, blueprint_content_ccnl_level_code,
            blueprint_content_ccnl_level_name, blueprint_content_ccnl_level_annual_minimum_eur)
         VALUES ($1, 'CCNL_T', $2, $4, $3)`,
        [versionId, codice, minimo, `Livello ${codice}`],
      );
    }
    await pool.query(
      `INSERT INTO sys.sys_blueprint_activations (blueprint_activation_tenant_id, blueprint_activation_variant_id, blueprint_activation_status)
       VALUES ($1, $2, 'ACTIVE')`,
      [hr.tenantId, variante.rows[0]!.id],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM sys.sys_blueprint_activations WHERE blueprint_activation_variant_id IN (SELECT v.blueprint_variant_id FROM sys.sys_blueprint_variants v JOIN sys.sys_blueprint_families f ON f.blueprint_family_id = v.blueprint_variant_family_id WHERE f.blueprint_family_code = $1)`, [CODICE_FAMIGLIA]);
    await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_code = $1`, [CODICE_FAMIGLIA]);
    await suite.app.close();
    await closePool();
  });

  it("senza sessione la scrittura è rifiutata (CSRF o 401)", async () => {
    const r = await suite.app.inject({ method: "PATCH", url: `/v1/users/${targetId}/contract-level`, payload: { level: "CCNL_T_QD2" } });
    expect([401, 403]).toContain(r.statusCode);
  });

  it("un livello in scala: la modifica riesce e l'elenco degli avvisi è vuoto", async () => {
    const r = await cambia(hr, targetId, { level: "CCNL_T_QD2" });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { contractId: string; livelloPrecedente: string; livello: string; scala: { fonte: string; livelli: string[] }; avvisi: unknown[] };
    expect(b.contractId).toBe(contractId);
    expect(b.livelloPrecedente).toBe("CCNL_T_QD1");
    expect(b.scala.fonte).toBe("ATTIVAZIONI");
    expect(b.scala.livelli).toEqual(["CCNL_T_QD1", "CCNL_T_QD2", "CCNL_T_QD3"]);
    expect(b.avvisi).toEqual([]);
    expect(await livelloNelDb(contractId)).toBe("CCNL_T_QD2");
  });

  it("un livello fuori scala: la modifica riesce lo stesso e la risposta porta l'avviso con la motivazione", async () => {
    const r = await cambia(hr, targetId, { level: "ZZ9" });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { livello: string; avvisi: Array<{ tipo: string; motivazione: string; dettaglio: unknown }> };
    expect(b.livello).toBe("ZZ9");
    expect(b.avvisi).toHaveLength(1);
    expect(b.avvisi[0]!.tipo).toBe("FUORI_SCALA");
    expect(b.avvisi[0]!.motivazione).toContain("ZZ9");
    expect(b.avvisi[0]!.motivazione).toContain("CCNL_T_QD1");
    expect(b.avvisi[0]!.dettaglio).toBeNull();
    expect(await livelloNelDb(contractId)).toBe("ZZ9");
  });

  it("senza un contratto collettivo caricato nel tenant non giudica: nessun avviso e nessun errore", async () => {
    await pool.query(`UPDATE sys.sys_blueprint_activations SET blueprint_activation_status = 'SUSPENDED' WHERE blueprint_activation_tenant_id = $1 AND blueprint_activation_status = 'ACTIVE'`, [hr.tenantId]);
    const r = await cambia(hr, targetId, { level: "ZZ9" });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { scala: { fonte: string; livelli: string[] }; avvisi: unknown[] };
    expect(b.scala).toEqual({ fonte: "ASSENTE", livelli: [] });
    expect(b.avvisi).toEqual([]);
  });

  it("chi non ha il mandato HR riceve 403 e il livello non cambia", async () => {
    const prima = await livelloNelDb(contractId);
    const r = await cambia(manager, targetId, { level: "CCNL_T_QD3" });
    expect(r.statusCode).toBe(403);
    expect(await livelloNelDb(contractId)).toBe(prima);
  });

  it("una persona senza contratto attivo risponde 404", async () => {
    const r = await cambia(hr, senzaContrattoId, { level: "CCNL_T_QD2" });
    expect(r.statusCode).toBe(404);
  });
});
