/**
 * apps/api/test/hierarchy-levels.integration.test.ts — #265, il principio gerarchia-livelli.
 *
 * Un modello di prova (famiglia/variante/versione + contratto collettivo con tre livelli) viene scritto nel database e tolto alla fine
 * togliendo la famiglia (il motore porta via il resto a cascata). Avvisa, non blocca: la rotta risponde sempre 200 con la motivazione.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

let suite: TestApp;
let cookie = "";
let versionId = "";
const CODICE_FAMIGLIA = `TEST_GERARCHIA_${randomUUID().slice(0, 8).toUpperCase()}`;

// I contenuti di modello con i contratti collettivi nascono dalla migrazione 000454: su un database che non l'ha ancora (il clone del
// gemello prima del deploy) la prova non puo' girare, e lo dice a voce alta invece di fingere di passare. In CI (catena applicata) gira.
const schemaPresente = (await pool.query<{ ok: boolean }>(`SELECT to_regclass('sys.sys_blueprint_content_ccnl_levels') IS NOT NULL AS ok`)).rows[0]?.ok === true;
if (!schemaPresente) console.warn("[hierarchy-levels] PROVA NON ESEGUITA: manca sys.sys_blueprint_content_ccnl_levels (migrazione 000454 non applicata a questo database)");

describe.skipIf(!schemaPresente)("/v1/hierarchy-levels integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "federica.marchetti@rtl-bank.org", TEST_PERSONA_PASSWORD);
    cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const fam = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name, blueprint_family_description)
       VALUES ($1, 'Prova gerarchia-livelli', 'Famiglia di prova del test hierarchy-levels') RETURNING blueprint_family_id AS id`,
      [CODICE_FAMIGLIA],
    );
    const variante = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name, blueprint_variant_description)
       VALUES ($1, 'V', 'Prova', 'Prova') RETURNING blueprint_variant_id AS id`,
      [fam.rows[0]!.id],
    );
    const ver = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_variant_versions (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
       VALUES ($1, 2, 'DRAFT') RETURNING blueprint_variant_version_id AS id`,
      [variante.rows[0]!.id],
    );
    versionId = ver.rows[0]!.id;
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
      `INSERT INTO sys.sys_blueprint_content_units (blueprint_content_unit_version_id, blueprint_content_unit_code, blueprint_content_unit_name, blueprint_content_unit_type)
       VALUES ($1, 'U1', 'Direzione di prova', 'DEPARTMENT')`,
      [versionId],
    );
    const posti: Array<[string, string, string, boolean]> = [
      ["P_CAPO", "Responsabile di prova", "CCNL_T_QD2", true],
      ["P_PARI", "Collega dello stesso livello", "CCNL_T_QD2", false],
      ["P_SOPRA", "Collega di livello piu' alto", "CCNL_T_QD3", false],
    ];
    for (const [codice, titolo, livello, capo] of posti) {
      await pool.query(
        `INSERT INTO sys.sys_blueprint_content_positions
           (blueprint_content_position_version_id, blueprint_content_position_code, blueprint_content_position_title,
            blueprint_content_position_unit_code, blueprint_content_position_ccnl_level_code, blueprint_content_position_is_unit_head)
         VALUES ($1, $2, $3, 'U1', $4, $5)`,
        [versionId, codice, titolo, livello, capo],
      );
    }
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_code = $1`, [CODICE_FAMIGLIA]);
    await suite.app.close();
    await closePool();
  });

  it("senza sessione risponde 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/hierarchy-levels/check" });
    expect(r.statusCode).toBe(401);
  });

  it("un modello dove il responsabile QD2 ha un collega QD3 produce un solo avviso, con la motivazione", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/hierarchy-levels/check?modelVersionId=${versionId}`, headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { oggetto: string; scala: { fonte: string; livelli: string[] }; avvisi: Array<{ sottopostoId: string; motivazione: string }> };
    expect(b.oggetto).toBe("MODELLO");
    expect(b.scala.livelli).toEqual(["CCNL_T_QD1", "CCNL_T_QD2", "CCNL_T_QD3"]);
    expect(b.avvisi).toHaveLength(1);
    expect(b.avvisi[0]!.sottopostoId).toBe("P_SOPRA");
    expect(b.avvisi[0]!.motivazione).toContain("CCNL_T_QD2");
  });

  it("una versione di modello che non esiste risponde 404", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/hierarchy-levels/check?modelVersionId=${randomUUID()}`, headers: { cookie } });
    expect(r.statusCode).toBe(404);
  });

  it("l'organigramma del tenant si controlla e non blocca: risponde 200 con la scala dichiarata", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/hierarchy-levels/check", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { oggetto: string; scala: { fonte: string }; unitaControllate: number };
    expect(b.oggetto).toBe("TENANT");
    expect(["ATTIVAZIONI", "ASSENTE"]).toContain(b.scala.fonte);
    expect(b.unitaControllate).toBeGreaterThan(0);
  });
});
