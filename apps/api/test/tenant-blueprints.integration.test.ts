/**
 * apps/api/test/tenant-blueprints.integration.test.ts
 * #131 Tenant Builder P1, T5 — il modulo del fascicolo.
 *
 * Nove casi, tutti sul dato reale. Gli attori si prendono per CARATTERISTICA
 * (`helpers/actors.ts`), mai per nome proprio, e ogni valore atteso si deriva
 * dalla fonte di verita' invece di essere ricopiato: quanti processi ha davvero
 * la versione pubblicata del modello, quale ATECO esiste davvero in catalogo.
 *
 * Il caso che conta di piu' e' l'ultimo. Non prova che il fascicolo funzioni:
 * prova che NON e' raggiungibile da chi non deve vederlo, su tutti e quindici
 * gli endpoint, e con 403 e non 404 — perche' un 404 direbbe «quella risorsa non
 * esiste» a chi non ha nemmeno il diritto di sapere se esista.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { platformAdmin, tenantAdmin } from "./helpers/actors.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
}

const ch = (c: Map<string, string>): string =>
  [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

/**
 * Gli header di una sessione viva: cookie + token CSRF.
 *
 * `content-type` NON si dichiara qui. Dichiararlo sempre fa fallire con 400 le
 * richieste che un corpo non ce l'hanno (DELETE, e le POST il cui schema non
 * prevede body): Fastify prova a interpretare un corpo vuoto come JSON e si
 * ferma prima ancora dei `preHandler`. Quando il corpo c'e', `inject` mette
 * l'intestazione da se'.
 */
function hdr(s: S): Record<string, string> {
  return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken };
}

async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

const PREFIX = `IT_TB_${randomUUID().slice(0, 8).toUpperCase()}`;

/** Il codice dell'errore sta in `error.code`: leggerlo da `code` da' sempre undefined,
 *  e un `undefined` confrontato con la stringa attesa fallisce per la ragione sbagliata. */
const codiceDi = (body: unknown): string | undefined =>
  (body as { error?: { code?: string } }).error?.code;

let t: TestApp;
let admin: S;
let cliente: S;

/** Crea un fascicolo di trattativa e restituisce il suo id. */
async function creaFascicolo(code: string): Promise<string> {
  const r = await t.app.inject({
    method: "POST",
    url: "/v1/tenant-blueprints",
    headers: hdr(admin),
    payload: { code: `${PREFIX}_${code}`, name: code },
  });
  if (r.statusCode !== 201) throw new Error(`creaFascicolo ${code}: ${r.statusCode} ${r.body}`);
  return (r.json() as { tenantBlueprintId: string }).tenantBlueprintId;
}

/** La carta d'identita' con gli id VERI del catalogo, non con uuid inventati. */
async function identitaDi(ateco: string, fascia: string): Promise<Record<string, unknown>> {
  const {
    rows: [c],
  } = await pool.query<{ id: string }>(
    `SELECT activity_classification_id AS id FROM sys.sys_activity_classifications
      WHERE activity_classification_code = $1 AND activity_classification_scheme = 'ATECO_2025'`,
    [ateco],
  );
  const {
    rows: [b],
  } = await pool.query<{ id: string }>(
    `SELECT enterprise_size_band_id AS id FROM sys.sys_enterprise_size_bands
      WHERE enterprise_size_band_code = $1`,
    [fascia],
  );
  if (!c || !b) throw new Error(`catalogo incompleto: ateco ${ateco} / fascia ${fascia}`);
  return {
    industryClassId: c.id,
    sizeBandId: b.id,
    regulatoryIntensity: "HIGH",
    countryCode: "IT",
  };
}

/** Fascicolo con identita' compilata e modello ancorato, piu' un processo su cui decidere. */
async function fascicoloAncorato(
  code: string,
): Promise<{ blueprintId: string; processId: string; variantVersionId: string }> {
  const blueprintId = await creaFascicolo(code);
  await t.app.inject({
    method: "PATCH",
    url: `/v1/tenant-blueprints/${blueprintId}/versions/1/identity`,
    headers: hdr(admin),
    payload: await identitaDi("64.19", "M"),
  });
  const prop = await t.app.inject({
    method: "GET",
    url: `/v1/tenant-blueprints/${blueprintId}/versions/1/model-proposal`,
    headers: hdr(admin),
  });
  const proposta = prop.json() as { available: boolean; variantVersionId?: string };
  if (!proposta.available || !proposta.variantVersionId) {
    throw new Error(`fascicoloAncorato ${code}: nessun modello proposto — ${prop.body}`);
  }
  const variantVersionId = proposta.variantVersionId;
  const pin = await t.app.inject({
    method: "PUT",
    url: `/v1/tenant-blueprints/${blueprintId}/versions/1/model`,
    headers: hdr(admin),
    payload: { variantVersionId },
  });
  if (pin.statusCode !== 200) {
    throw new Error(`fascicoloAncorato ${code}: ancoraggio fallito ${pin.statusCode} ${pin.body}`);
  }
  const {
    rows: [p],
  } = await pool.query<{ id: string }>(
    `SELECT blueprint_process_id AS id FROM sys.sys_blueprint_process_registry
      WHERE blueprint_process_variant_version_id = $1
      ORDER BY blueprint_process_ordinal LIMIT 1`,
    [variantVersionId],
  );
  if (!p) throw new Error(`fascicoloAncorato ${code}: il modello ancorato non ha processi`);
  return { blueprintId, processId: p.id, variantVersionId };
}

describe("fascicoli di configurazione", () => {
  beforeAll(async () => {
    t = await buildTestApp();
    const a = await platformAdmin();
    admin = await login(t, a.email);
    const {
      rows: [rtl],
    } = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    if (!rtl) throw new Error("il tenant RTL_BANK non esiste piu': il test non ha piu' un cliente");
    const c = await tenantAdmin({ tenantId: rtl.id });
    cliente = await login(t, c.email);
  });

  afterAll(async () => {
    await t.app.close();
    await closePool();
  });

  it("crea un fascicolo senza azienda — una trattativa", async () => {
    const r = await t.app.inject({
      method: "POST",
      url: "/v1/tenant-blueprints",
      headers: hdr(admin),
      payload: { code: `${PREFIX}_TRATTATIVA`, name: "Trattativa senza azienda" },
    });
    expect(r.statusCode).toBe(201);
    expect((r.json() as { tenantId: string | null }).tenantId).toBeNull();
  });

  it("un amministratore di tenant non vede nemmeno l'elenco", async () => {
    const r = await t.app.inject({
      method: "GET",
      url: "/v1/tenant-blueprints",
      headers: hdr(cliente),
    });
    expect(r.statusCode).toBe(403);
    // `FORBIDDEN` e non `PERMISSION_DENIED`: e' il codice che `requirePermission`
    // emette per un permesso mancante su 520 rotte delle 532 che esistono
    // (misurato). Le 12 eccezioni portano codici del tipo `*_ADMIN_ONLY`, e
    // nessuna usa `PERMISSION_DENIED`. Dare a questo modulo un codice tutto suo
    // spezzerebbe un contratto uniforme per allinearlo a una riga di piano.
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("una decisione senza motivazione è rifiutata", async () => {
    const { blueprintId, processId } = await fascicoloAncorato("MOTIVAZIONE");
    const r = await t.app.inject({
      method: "PUT",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/processes/${processId}`,
      headers: hdr(admin),
      payload: { inclusion: "OUT", rationale: "   " },
    });
    expect(r.statusCode).toBe(400);
  });

  it("togliere la decisione riporta al modello", async () => {
    const { blueprintId, processId } = await fascicoloAncorato("RITORNO");
    const base = `/v1/tenant-blueprints/${blueprintId}/versions/1`;
    const messa = await t.app.inject({
      method: "PUT",
      url: `${base}/processes/${processId}`,
      headers: hdr(admin),
      payload: { inclusion: "OUT", rationale: "affidato a un fornitore esterno" },
    });
    expect(messa.statusCode).toBe(204);

    const conDecisione = await t.app.inject({
      method: "GET",
      url: `${base}/processes`,
      headers: hdr(admin),
    });
    const prima = (conDecisione.json() as { items: ProcessoLetto[] }).items.find(
      (p) => p.processId === processId,
    );
    expect(prima?.inclusion).toBe("OUT");

    const del = await t.app.inject({
      method: "DELETE",
      url: `${base}/processes/${processId}`,
      headers: hdr(admin),
    });
    expect(del.statusCode).toBe(204);

    const dopo = await t.app.inject({
      method: "GET",
      url: `${base}/processes`,
      headers: hdr(admin),
    });
    const poi = (dopo.json() as { items: ProcessoLetto[] }).items.find(
      (p) => p.processId === processId,
    );
    // R1: silenzio significa «come dice il modello», non «escluso».
    expect(poi?.inclusion).toBeNull();
    expect(poi?.rationale).toBeNull();
  });

  it("propone il modello dalla carta d'identità di una banca media", async () => {
    const blueprintId = await creaFascicolo("PROPOSTA_BANCA");
    await t.app.inject({
      method: "PATCH",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/identity`,
      headers: hdr(admin),
      payload: await identitaDi("64.19", "M"),
    });
    const r = await t.app.inject({
      method: "GET",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/model-proposal`,
      headers: hdr(admin),
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { available: boolean; variantVersionId: string; processCount: number };
    expect(body.available).toBe(true);
    // L'atteso si deriva dal dato reale, non si ricopia: quanti processi ha
    // davvero la versione pubblicata di quel modello.
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_blueprint_process_registry p
        WHERE p.blueprint_process_variant_version_id = $1`,
      [body.variantVersionId],
    );
    expect(body.processCount).toBe(Number(rows[0]!.n));
  });

  it("per un settore senza modello lo dice, e non ripiega", async () => {
    const blueprintId = await creaFascicolo("NIENTE_MODELLO");
    // Un ATECO manifatturiero, scelto dal catalogo reale: nessuna famiglia di
    // blueprint lo copre oggi.
    const { rows } = await pool.query<{ code: string }>(
      `SELECT activity_classification_code AS code
         FROM sys.sys_activity_classifications
        WHERE activity_classification_code LIKE '20.%'
          AND activity_classification_scheme = 'ATECO_2025'
        ORDER BY 1 LIMIT 1`,
    );
    expect(rows[0]).toBeDefined();
    await t.app.inject({
      method: "PATCH",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/identity`,
      headers: hdr(admin),
      payload: await identitaDi(rows[0]!.code, "M"),
    });
    const r = await t.app.inject({
      method: "GET",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/model-proposal`,
      headers: hdr(admin),
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      available: boolean;
      reason: string;
      availableCombinations: unknown[];
    };
    expect(body.available).toBe(false); // R4: si dice, non si ripiega
    expect(body.reason).toBeTruthy();
    expect(body.availableCombinations.length).toBeGreaterThan(0);
  });

  it("non si sottomette senza modello ancorato", async () => {
    const blueprintId = await creaFascicolo("SENZA_MODELLO");
    await t.app.inject({
      method: "PATCH",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/identity`,
      headers: hdr(admin),
      payload: await identitaDi("64.19", "M"),
    });
    const r = await t.app.inject({
      method: "POST",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/submit`,
      headers: hdr(admin),
      payload: {},
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("BLUEPRINT_MODEL_NOT_PINNED");
  });

  it("una versione approvata non si modifica", async () => {
    const { blueprintId } = await fascicoloAncorato("APPROVATA_FERMA");
    await pool.query(
      `UPDATE sys.sys_tenant_blueprint_versions v
          SET tenant_blueprint_version_status = 'APPROVED'
         FROM sys.sys_tenant_blueprints b
        WHERE b.tenant_blueprint_id = v.tenant_blueprint_version_blueprint_id
          AND b.tenant_blueprint_id = $1`,
      [blueprintId],
    );
    const r = await t.app.inject({
      method: "PATCH",
      url: `/v1/tenant-blueprints/${blueprintId}/versions/1/identity`,
      headers: hdr(admin),
      payload: { employeeCount: 200 },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe(
      "BLUEPRINT_VERSION_NOT_EDITABLE",
    );
  });

  it("nessuno dei 15 endpoint è raggiungibile da un amministratore di tenant", async () => {
    const uuid = "00000000-0000-4000-8000-000000000000";
    const base = `/v1/tenant-blueprints`;
    // Il corpo, dove serve, e' VALIDO di proposito. Con un corpo storto la
    // risposta sarebbe 400 — perche' Fastify valida lo schema PRIMA dei
    // `preHandler` — e il caso sarebbe verde senza aver mai messo alla prova il
    // permesso. Stessa ragione per cui il token CSRF si passa buono.
    const endpoints: Array<[string, string, Record<string, unknown> | undefined]> = [
      ["GET", base, undefined],
      ["POST", base, { code: "NON_DEVE_NASCERE", name: "Non deve nascere" }],
      ["GET", `${base}/${uuid}`, undefined],
      ["PATCH", `${base}/${uuid}`, { name: "Non deve cambiare" }],
      ["POST", `${base}/${uuid}/link-tenant`, { tenantId: uuid }],
      ["GET", `${base}/${uuid}/versions/1`, undefined],
      ["POST", `${base}/${uuid}/versions`, undefined],
      ["PATCH", `${base}/${uuid}/versions/1/identity`, { employeeCount: 1 }],
      ["GET", `${base}/${uuid}/versions/1/model-proposal`, undefined],
      ["PUT", `${base}/${uuid}/versions/1/model`, { variantVersionId: uuid }],
      ["GET", `${base}/${uuid}/versions/1/processes`, undefined],
      [
        "PUT",
        `${base}/${uuid}/versions/1/processes/${uuid}`,
        { inclusion: "IN", rationale: "non deve essere registrata" },
      ],
      ["DELETE", `${base}/${uuid}/versions/1/processes/${uuid}`, undefined],
      ["POST", `${base}/${uuid}/versions/1/submit`, undefined],
      ["GET", `${base}/${uuid}/versions/1/diff?against=MODEL_LATEST`, undefined],
    ];
    expect(endpoints).toHaveLength(15);
    for (const [method, url, payload] of endpoints) {
      const r = await t.app.inject({
        method: method as "GET",
        url,
        headers: hdr(cliente),
        ...(payload === undefined ? {} : { payload }),
      });
      // 403 e non 404: il diniego deve arrivare PRIMA che si sappia se la
      // risorsa esiste, altrimenti l'esistenza trapela dal codice di stato.
      expect(`${method} ${url} → ${r.statusCode}`).toBe(`${method} ${url} → 403`);
    }
    // Il fascicolo che la POST avrebbe creato NON deve esistere: un 403 che
    // arriva dopo la scrittura non e' un diniego, e' un incidente raccontato
    // male. Senza questo controllo il caso passerebbe lo stesso.
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_tenant_blueprints
        WHERE tenant_blueprint_code = 'NON_DEVE_NASCERE'`,
    );
    expect(rows[0]?.n).toBe("0");
  });

  /**
   * E24 (#199) — il legame fascicolo↔azienda e' PERMANENTE.
   *
   * Il caso e' scritto su cio' che oggi RIESCE, non su cio' che gia' fallisce:
   * `linkTenant` aggiornava senza guardare il valore precedente, quindi un
   * fascicolo gia' legato si spostava con una chiamata sola. Se il passo (3)
   * risponde 200, la guardia non c'e' — ed e' la ragione per cui questo caso
   * esiste in questa forma.
   *
   * I due dinieghi NON sono lo stesso, e il caso li tiene separati apposta:
   * `BLUEPRINT_TENANT_ALREADY_LINKED` dice che l'azienda di DESTINAZIONE ha gia'
   * un fascicolo (il problema e' la', ed e' rimediabile scegliendone un'altra);
   * `BLUEPRINT_LINK_IS_PERMANENT` dice che e' QUESTO fascicolo a essere gia'
   * legato (il problema e' qui, e non e' rimediabile). Un client che li confonde
   * propone all'utente la correzione sbagliata.
   *
   * Gli id delle aziende si leggono dal database, mai scritti a mano.
   */
  it("E24 — un fascicolo gia' legato non si stacca piu'", async () => {
    const {
      rows: [libera],
    } = await pool.query<{ id: string; code: string }>(
      `SELECT t.tenant_id AS id, t.tenant_code AS code
         FROM sys.sys_tenancies t
        WHERE NOT EXISTS (SELECT 1 FROM sys.sys_tenant_blueprints b
                           WHERE b.tenant_blueprint_tenant_id = t.tenant_id)
        ORDER BY t.tenant_code LIMIT 1`,
    );
    const {
      rows: [occupata],
    } = await pool.query<{ id: string; code: string }>(
      `SELECT t.tenant_id AS id, t.tenant_code AS code
         FROM sys.sys_tenancies t
         JOIN sys.sys_tenant_blueprints b ON b.tenant_blueprint_tenant_id = t.tenant_id
        ORDER BY t.tenant_code LIMIT 1`,
    );
    if (!libera || !occupata) {
      throw new Error(
        "il caso non e' misurabile: servono un'azienda senza fascicolo e una con " +
          `(trovate: libera=${libera?.code ?? "nessuna"} occupata=${occupata?.code ?? "nessuna"})`,
      );
    }

    const blueprintId = await creaFascicolo("E24_PERMANENTE");
    const lega = (tenantId: string) =>
      t.app.inject({
        method: "POST",
        url: `/v1/tenant-blueprints/${blueprintId}/link-tenant`,
        headers: hdr(admin),
        payload: { tenantId },
      });

    // (1) la prima firma di un fascicolo mai legato: E24 non la vieta
    const prima = await lega(libera.id);
    expect(`prima firma → ${prima.statusCode}`).toBe("prima firma → 200");

    // (2) verso un'azienda che un fascicolo ce l'ha gia'. Il 409 arriva anche
    // oggi, ma per la ragione sbagliata (violazione di unicita' sulla
    // DESTINAZIONE): quello che si misura qui e' il CODICE, non lo stato.
    const versoOccupata = await lega(occupata.id);
    expect(versoOccupata.statusCode).toBe(409);
    expect(codiceDi(versoOccupata.json())).toBe("BLUEPRINT_LINK_IS_PERMANENT");

    // (3) IL CASO CHE OGGI PASSA: ri-firmarlo sulla STESSA azienda. Nessun indice
    // unico lo intercetta — e' la stessa riga — quindi qui non c'e' altra rete
    // che la guardia. Un 200 significa che la guardia non e' stata applicata.
    const dinuovo = await lega(libera.id);
    expect(`ri-firma → ${dinuovo.statusCode}`).toBe("ri-firma → 409");
    expect(codiceDi(dinuovo.json())).toBe("BLUEPRINT_LINK_IS_PERMANENT");

    // (4) e il legame originale e' rimasto quello: un diniego che avesse comunque
    // scritto sarebbe un incidente raccontato male
    const {
      rows: [dopo],
    } = await pool.query<{ tid: string | null }>(
      `SELECT tenant_blueprint_tenant_id AS tid FROM sys.sys_tenant_blueprints
        WHERE tenant_blueprint_id = $1`,
      [blueprintId],
    );
    expect(dopo?.tid).toBe(libera.id);
  });
});

interface ProcessoLetto {
  processId: string;
  inclusion: string | null;
  rationale: string | null;
}
