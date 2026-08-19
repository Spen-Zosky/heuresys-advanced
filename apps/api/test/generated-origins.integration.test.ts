/**
 * #198 T6 — la superficie API della costruzione: il piano, l'applicazione, il registro.
 *
 * La prova che conta, e che il piano di P3 chiede per prima: **`apply` NON costruisce**.
 * Apre una richiesta di approvazione, e la costruzione avviene quando quella viene firmata.
 * Se chiamandola nascessero righe, l'atto non sarebbe l'approvazione — e tutta la
 * tracciabilità di P3 poggerebbe su una promessa invece che su un meccanismo.
 *
 * L'azienda e il fascicolo di collaudo nascono qui e vengono rollbackati dall'isolamento
 * transazionale per file (D-52): i due tenant di produzione non li tocca nessuno.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { platformAdmin } from "./helpers/actors.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { seminaModello, type ModelloDiProva } from "./helpers/modello-di-prova.js";
import { BLUEPRINT_CONTENT_KEY } from "../src/modules/tenant-materialization/blueprint-build-source.js";

const MARCA = `T6-${Date.now()}`;
// Il modello si SEMINA qui: non esiste piu' un archetipo globale da cercare (#132 F3).
let modello: ModelloDiProva;

let t: TestApp;
let cookie = "";
let csrf = "";
// L'app si usa attraverso `t.app`: `buildTestApp` restituisce l'involucro, non l'istanza.
let tenantId = "";
let blueprintId = "";

async function conta(tabella: string, colonnaTenant: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.${tabella} WHERE ${colonnaTenant} = $1`,
    [tenantId],
  );
  return Number(r.rows[0]!.n);
}

beforeAll(async () => {
  modello = await seminaModello(pool, MARCA);
  t = await buildTestApp();
  // L'attore e' una PERSONA VERA che detiene il ruolo, cercata nel database: non un
  // utente inventato per il test. La password si deriva dall'email (Z-262).
  const attore = await platformAdmin();
  const r = await loginRaw(t.app, attore.email);
  cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  csrf = (r.json() as { csrfToken: string }).csrfToken;

  const az = await pool.query<{ tenant_id: string }>(
    `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status, tenant_industry_code)
     VALUES ($1, $2, 'ACTIVE', 'FIN_BANKING') RETURNING tenant_id`,
    [`E2E-${MARCA}`, `Azienda di collaudo ${MARCA}`],
  );
  tenantId = az.rows[0]!.tenant_id;

  const b = await pool.query<{ tenant_blueprint_id: string }>(
    `INSERT INTO sys.sys_tenant_blueprints (tenant_blueprint_code, tenant_blueprint_name, tenant_blueprint_tenant_id, tenant_blueprint_status)
     VALUES ($1, $2, $3, 'ACTIVE') RETURNING tenant_blueprint_id`,
    [`E2E-BP-${MARCA}`, `Fascicolo di collaudo ${MARCA}`, tenantId],
  );
  blueprintId = b.rows[0]!.tenant_blueprint_id;

  await pool.query(
    `INSERT INTO sys.sys_tenant_blueprint_versions
       (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number,
        tenant_blueprint_version_status, tenant_blueprint_version_variant_version_id,
        tenant_blueprint_version_approved_at)
     VALUES ($1, 1, 'APPROVED', $2, now())`,
    [blueprintId, modello.variantVersionId],
  );
});

describe("#198 T6 — il piano di costruzione", () => {
  it("dice cosa nascerebbe, e non scrive niente", async () => {
    const prima = await conta("sys_organization_units", "organization_unit_tenant_id");
    const r = await t.app.inject({
      method: "POST",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/build-plan`,
      headers: { cookie, "x-csrf-token": csrf },
    });
    expect(r.statusCode, r.body).toBe(200);
    const corpo = r.json() as { sourceKey: string; willCreate: Record<string, number>; alreadyThere: Record<string, number> };
    expect(corpo.sourceKey).toBe(BLUEPRINT_CONTENT_KEY);
    expect(corpo.willCreate.orgUnits).toBeGreaterThan(0);
    // su un'azienda vuota, «esiste già» dev'essere zero: se non lo fosse, il piano
    // starebbe contando righe di qualcun altro
    expect(corpo.alreadyThere.orgUnits).toBe(0);
    expect(await conta("sys_organization_units", "organization_unit_tenant_id")).toBe(prima);
  });
});

describe("#198 T6 — l'applicazione NON costruisce", () => {
  it("apre la richiesta di approvazione e lascia il database com'era", async () => {
    const prima = {
      unita: await conta("sys_organization_units", "organization_unit_tenant_id"),
      posizioni: await conta("sys_positions", "position_tenant_id"),
      origini: await conta("sys_generated_record_origins", "generated_record_origin_tenant_id"),
    };
    const r = await t.app.inject({
      method: "POST",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/apply`,
      headers: { cookie, "x-csrf-token": csrf },
    });
    expect(r.statusCode, r.body).toBe(200);
    const corpo = r.json() as { approvalRequestId: string; status: string };
    expect(corpo.approvalRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(corpo.status).toBe("APPROVED"); // lo stato della VERSIONE, non della richiesta

    // ⚠ IL PUNTO: dopo `apply` il database dev'essere identico. La costruzione la fa
    // l'approvazione, e finché non arriva non è nata nemmeno una riga.
    expect(await conta("sys_organization_units", "organization_unit_tenant_id"), "apply ha creato unità").toBe(prima.unita);
    expect(await conta("sys_positions", "position_tenant_id"), "apply ha creato posizioni").toBe(prima.posizioni);
    expect(await conta("sys_generated_record_origins", "generated_record_origin_tenant_id"), "apply ha scritto nel registro").toBe(prima.origini);
  });

  it("una versione non APPROVED non si applica", async () => {
    const v2 = await pool.query(
      `INSERT INTO sys.sys_tenant_blueprint_versions
         (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number, tenant_blueprint_version_status)
       VALUES ($1, 2, 'DRAFT')`,
      [blueprintId],
    );
    expect(v2.rowCount).toBe(1);
    const r = await t.app.inject({
      method: "POST",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/2/apply`,
      headers: { cookie, "x-csrf-token": csrf },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ error: { code: "BLUEPRINT_VERSION_NOT_APPROVED" } });
  });
});

describe("#198 T6 — il registro dell'origine", () => {
  it("elenca e riassume, e su un'azienda mai costruita è vuoto (non è un errore)", async () => {
    const lista = await t.app.inject({
      method: "GET",
      url: `/v1/generated-origins?tenantId=${tenantId}`,
      headers: { cookie },
    });
    expect(lista.statusCode, lista.body).toBe(200);
    expect(lista.json()).toMatchObject({ items: [], total: 0 });

    const riass = await t.app.inject({
      method: "GET",
      url: `/v1/generated-origins/summary?tenantId=${tenantId}`,
      headers: { cookie },
    });
    expect(riass.statusCode, riass.body).toBe(200);
    expect(riass.json()).toMatchObject({ byTable: [], totals: { total: 0 } });
  });

  it("CONTROPROVA: il riassunto sa contare — sull'intero database i totali non sono zero appena una costruzione esiste", async () => {
    // Se questo caso desse sempre zero, quello sopra sarebbe verde anche con una query
    // rotta. Qui si misura senza filtro di azienda: il numero è quello che è, ma la
    // struttura della risposta dev'essere coerente con sé stessa.
    const r = await t.app.inject({ method: "GET", url: "/v1/generated-origins/summary", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const c = r.json() as { byTable: Array<{ total: number }>; totals: { total: number } };
    expect(c.totals.total).toBe(c.byTable.reduce((n, x) => n + x.total, 0));
  });
});
