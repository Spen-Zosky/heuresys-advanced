/**
 * apps/api/test/blueprint-activation-version.integration.test.ts
 * CONSOLIDAMENTO C4 (000463): LA VERSIONE DEL MODELLO SI FISSA SULL'ATTIVAZIONE.
 *
 * Prima di C4 un tenant attivava una variante, e il suo profilo era la somma di TUTTE le versioni
 * pubblicate: pubblicarne una nuova cambiava tutti i tenant insieme, e due tenant sulla stessa variante
 * non potevano stare su versioni diverse. Qui si prova il contrario, su un modello e due aziende seminati
 * dal test:
 *   - una bozza non si adotta e non si costruisce;
 *   - un'attivazione senza versione nasce sulla PUBLISHED più alta;
 *   - due tenant sulla stessa variante, su versioni diverse, hanno profili diversi;
 *   - il passaggio a un'altra versione è un gesto per tenant, e non accetta versioni di un'altra variante;
 *   - il database rifiuta da sé una bozza scritta senza passare dal servizio;
 *   - lo stesso codice di processo sta in due versioni, non due volte nella stessa (R-58).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { platformAdmin } from "./helpers/actors.js";
import { seminaModello, type ModelloDiProva } from "./helpers/modello-di-prova.js";
import { codiciDelProfilo } from "../src/lib/scope/profilo.js";
import { BlueprintBuildSource } from "../src/modules/tenant-materialization/blueprint-build-source.js";

const MARCA = `C4-${Date.now()}`;

let suite: TestApp;
let cookie: string;
let csrf: string;
let modello: ModelloDiProva;
let v1: string;
let v2: string;
let ruoloSoloV2: string;
let aziendaA: string;
let aziendaB: string;
let attivazioneB: string;
let altraVariante: ModelloDiProva;

const hdr = () => ({ cookie, "x-csrf-token": csrf, "content-type": "application/json" });
const nuovaAzienda = async (codice: string): Promise<string> =>
  (await pool.query<{ tenant_id: string }>(
    `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status, tenant_industry_code)
     VALUES ($1, $2, 'ACTIVE', 'FIN_BANKING') RETURNING tenant_id`,
    [codice, `Azienda di collaudo ${codice}`],
  )).rows[0]!.tenant_id;

beforeAll(async () => {
  modello = await seminaModello(pool, MARCA);
  altraVariante = await seminaModello(pool, `${MARCA}-ALTRA`);
  v1 = modello.variantVersionId;

  // La versione 2 nasce bozza, come la lascia il ricevimento (C3): un ruolo in comune con la 1, uno solo suo.
  v2 = (await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_variant_versions
       (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
     VALUES ($1, 2, 'DRAFT') RETURNING blueprint_variant_version_id AS id`,
    [modello.variantId],
  )).rows[0]!.id;
  const altro = await pool.query<{ code: string; name: string }>(
    `SELECT job_role_code AS code, job_role_name AS name FROM sys.sys_job_roles
      WHERE job_role_tenant_id IS NULL AND job_role_code <> ALL($1::text[])
      ORDER BY job_role_code LIMIT 1`,
    [modello.ruoliDelProfilo],
  );
  if (!altro.rows[0]) throw new Error("il catalogo dei ruoli non ha un terzo ruolo: la prova non può distinguere le versioni");
  ruoloSoloV2 = altro.rows[0].code;
  await pool.query(
    `INSERT INTO sys.sys_blueprint_content_job_roles
       (blueprint_content_job_role_version_id, blueprint_content_job_role_code, blueprint_content_job_role_name)
     VALUES ($1, $2, 'in comune'), ($1, $3, $4)`,
    [v2, modello.ruoliDelProfilo[0], ruoloSoloV2, altro.rows[0].name],
  );

  aziendaA = await nuovaAzienda(`C4A-${MARCA}`);
  aziendaB = await nuovaAzienda(`C4B-${MARCA}`);

  suite = await buildTestApp();
  const attore = await platformAdmin();
  const r = await loginRaw(suite.app, attore.email);
  cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  csrf = (r.json() as { csrfToken: string }).csrfToken;
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM sys.sys_blueprint_activations WHERE blueprint_activation_tenant_id = ANY($1::uuid[])`, [[aziendaA, aziendaB]]);
    await pool.query(`DELETE FROM sys.sys_tenancies WHERE tenant_id = ANY($1::uuid[])`, [[aziendaA, aziendaB]]);
    await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = ANY($1::uuid[])`, [[modello.familyId, altraVariante.familyId]]);
  } catch { /* le righe di prova restano: non nascondono un rosso */ }
  await suite.app.close();
});

describe("C4 — la versione del modello si fissa sull'attivazione", () => {
  it("una bozza non si adotta: 409, e non nasce nessuna attivazione", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-activations", headers: hdr(),
      payload: { variantId: modello.variantId, variantVersionId: v2, tenantId: aziendaA, status: "ACTIVE" },
    });
    expect(r.statusCode, r.body).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("BLUEPRINT_ACTIVATION_VERSION_NOT_PUBLISHED");
    const n = await pool.query(`SELECT 1 FROM sys.sys_blueprint_activations WHERE blueprint_activation_tenant_id = $1`, [aziendaA]);
    expect(n.rowCount).toBe(0);
  });

  it("una bozza non si costruisce: il piano si rifiuta prima di leggere il contenuto", async () => {
    await expect(new BlueprintBuildSource(pool, v2).plan()).rejects.toThrow(/bozza/);
  });

  it("senza versione indicata, l'attivazione nasce sulla PUBLISHED più alta", async () => {
    await pool.query(
      `UPDATE sys.sys_blueprint_variant_versions
          SET blueprint_variant_version_status = 'PUBLISHED', blueprint_variant_version_published_at = now()
        WHERE blueprint_variant_version_id = $1`,
      [v2],
    );
    const r = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-activations", headers: hdr(),
      payload: { variantId: modello.variantId, tenantId: aziendaA, status: "ACTIVE" },
    });
    expect(r.statusCode, r.body).toBe(201);
    expect((r.json() as { variantVersionId: string | null }).variantVersionId).toBe(v2);
  });

  it("un altro tenant sulla stessa variante resta sulla versione 1 che ha scelto", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-activations", headers: hdr(),
      payload: { variantId: modello.variantId, variantVersionId: v1, tenantId: aziendaB, status: "ACTIVE" },
    });
    expect(r.statusCode, r.body).toBe(201);
    const b = r.json() as { blueprintActivationId: string; variantVersionId: string | null };
    expect(b.variantVersionId).toBe(v1);
    attivazioneB = b.blueprintActivationId;
  });

  it("i due tenant hanno profili diversi: ciascuno vede la propria versione, non la somma", async () => {
    const a = new Set(await codiciDelProfilo(pool, aziendaA, "job_roles"));
    const b = new Set(await codiciDelProfilo(pool, aziendaB, "job_roles"));
    expect(a.has(ruoloSoloV2), "il tenant sulla versione 2 non vede il ruolo della 2").toBe(true);
    expect(b.has(ruoloSoloV2), "il tenant sulla versione 1 vede un ruolo della 2: le versioni si sommano ancora").toBe(false);
    expect([...b].sort()).toEqual([...modello.ruoliDelProfilo].sort());
  });

  it("il passaggio di versione è per tenant, e solo verso una versione della stessa variante", async () => {
    const fuori = await suite.app.inject({
      method: "PATCH", url: `/v1/blueprint-activations/${attivazioneB}`, headers: hdr(),
      payload: { variantVersionId: altraVariante.variantVersionId },
    });
    expect(fuori.statusCode, fuori.body).toBe(409);
    expect((fuori.json() as { error: { code: string } }).error.code).toBe("BLUEPRINT_ACTIVATION_VERSION_OTHER_VARIANT");

    const passa = await suite.app.inject({
      method: "PATCH", url: `/v1/blueprint-activations/${attivazioneB}`, headers: hdr(),
      payload: { variantVersionId: v2 },
    });
    expect(passa.statusCode, passa.body).toBe(200);
    expect((passa.json() as { variantVersionId: string | null }).variantVersionId).toBe(v2);
    expect(await codiciDelProfilo(pool, aziendaB, "job_roles")).toContain(ruoloSoloV2);
  });

  it("il database rifiuta da sé una bozza scritta senza passare dal servizio", async () => {
    const v3 = (await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_variant_versions
         (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
       VALUES ($1, 3, 'DRAFT') RETURNING blueprint_variant_version_id AS id`,
      [modello.variantId],
    )).rows[0]!.id;
    await expect(
      pool.query(
        `UPDATE sys.sys_blueprint_activations SET blueprint_activation_variant_version_id = $2
          WHERE blueprint_activation_id = $1`,
        [attivazioneB, v3],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("R-58: lo stesso codice di processo sta in due versioni, ma non due volte nella stessa", async () => {
    const ins = (versione: string) => pool.query(
      `INSERT INTO sys.sys_blueprint_process_registry
         (blueprint_process_variant_id, blueprint_process_variant_version_id, blueprint_process_code,
          blueprint_process_name, blueprint_process_ordinal)
       VALUES ($1, $2, 'C4_PROC', 'Processo di prova', 1)`,
      [modello.variantId, versione],
    );
    await ins(v1);
    await ins(v2);
    await expect(ins(v2)).rejects.toMatchObject({ code: "23505" });
  });
});
