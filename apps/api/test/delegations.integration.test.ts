/**
 * apps/api/test/delegations.integration.test.ts — #99 F6b.
 *
 * Il quarto dominio funzionale di ADR-0036, con la sua tabella (`000314`). Il punto non è il
 * CRUD: è che **il dominio si accenda dal dato e si spenga quando il dato cambia**, senza che
 * nessuna lista di ruoli intervenga.
 *
 * La tabella nasce vuota — è una funzione nuova, non un residuo — quindi ogni caso qui crea
 * la delega che gli serve e l'isolamento transazionale del file la rollbacka a fine suite.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { loginRaw } from "./helpers/login.js";
import { activeDomainsOf, hasAnyDomain } from "../src/lib/scope/domains.js";
import type { RoleCode } from "../src/config/constants.js";

let t: TestApp;
let cookie = "";
let csrf = "";
/** Chi amministra (ha `delegation:manage`). */
const AMMINISTRA = "federica.marchetti@rtl-bank.org";
/** Due persone reali del tenant, nessuna delle quali è l'amministratore. */
let delegante = { id: "", email: "" };
let delegato = { id: "", email: "" };
/**
 * Un terzo soggetto, usato SOLO dal caso della revoca.
 *
 * ⚠ Serve, e la ragione è stata trovata sabotando: il caso della revoca era scritto sul
 * `delegato` comune e si proteggeva con un `if (nessuna delega attiva residua)`. Ma i casi
 * precedenti gliene lasciano una in vigore, quindi quel ramo non veniva **mai** eseguito: il
 * test passava anche togliendo il controllo sullo stato dalla query del dominio. Una prova
 * che non sa fallire non è una prova.
 */
let delegatoSoloRevoca = { id: "", email: "" };

const oggi = () => new Date().toISOString().slice(0, 10);
const fra = (giorni: number) => {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
};

async function ruoliDi(userId: string): Promise<RoleCode[]> {
  const r = await pool.query<{ code: string }>(
    `SELECT ro.auth_role_code AS code
       FROM sys.sys_user_auth_roles ur
       JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
      WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`,
    [userId],
  );
  return r.rows.map((x) => x.code) as RoleCode[];
}

async function creaDelega(payload: Record<string, unknown>) {
  return t.app.inject({
    method: "POST",
    url: "/v1/delegations",
    headers: { cookie, "x-csrf-token": csrf },
    payload,
  });
}

beforeAll(async () => {
  t = await buildTestApp();
  const login = await loginRaw(t.app, AMMINISTRA);
  cookie = (login.cookies as { name: string; value: string }[])
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  csrf = (login.json() as { csrfToken: string }).csrfToken;

  const r = await pool.query<{ user_id: string; user_email: string }>(
    `SELECT u.user_id, u.user_email
       FROM sys.sys_users u
      WHERE u.user_status = 'ACTIVE'
        AND u.user_email <> $1
        AND u.user_tenant_id = (SELECT user_tenant_id FROM sys.sys_users WHERE user_email = $1)
      ORDER BY u.user_email
      LIMIT 3`,
    [AMMINISTRA],
  );
  const a = r.rows[0];
  const b = r.rows[1];
  const c = r.rows[2];
  if (!a || !b || !c) throw new Error("servono tre persone del tenant: la prova sarebbe cieca");
  delegante = { id: a.user_id, email: a.user_email };
  delegato = { id: b.user_id, email: b.user_email };
  delegatoSoloRevoca = { id: c.user_id, email: c.user_email };
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#99 F6b — la delega, e il dominio che ne deriva", () => {
  it("il dominio NON è acceso prima che una delega esista", async () => {
    const d = await activeDomainsOf(pool, {
      userId: delegato.id, tenantId: null, roles: await ruoliDi(delegato.id),
    });
    expect(d.has("delegation"), "il dominio è acceso senza alcuna delega: da dove?").toBe(false);
  });

  it("conferita una delega in vigore, il dominio si accende — e SOLO per chi la riceve", async () => {
    const r = await creaDelega({
      delegatorUserId: delegante.id,
      delegateUserId: delegato.id,
      startsOn: oggi(),
      endsOn: fra(30),
      reason: "prova di integrazione #99 F6b",
    });
    expect(r.statusCode, `creazione: ${r.statusCode} ${r.body.slice(0, 300)}`).toBe(201);
    const creata = r.json() as { delegationId: string; isInForce: boolean; status: string };
    expect(creata.isInForce, "una delega che comincia oggi non risulta in vigore").toBe(true);
    expect(creata.status).toBe("ACTIVE");

    const delDelegato = await activeDomainsOf(pool, {
      userId: delegato.id, tenantId: null, roles: await ruoliDi(delegato.id),
    });
    expect(delDelegato.has("delegation"), "chi riceve la delega non ha il dominio").toBe(true);

    // Il verso opposto: conferire una delega non dà il dominio a chi la conferisce.
    const delDelegante = await activeDomainsOf(pool, {
      userId: delegante.id, tenantId: null, roles: await ruoliDi(delegante.id),
    });
    expect(
      delDelegante.has("delegation"),
      "chi CONFERISCE la delega ha acquisito il dominio: il lato è invertito",
    ).toBe(false);
  });

  it("revocata la delega, il dominio si spegne", async () => {
    // Soggetto DEDICATO: l'unica delega che avrà è questa, quindi dopo la revoca il dominio
    // deve spegnersi senza «se». Con il soggetto condiviso il caso si auto-saltava.
    const creata = (await creaDelega({
      delegatorUserId: delegante.id, delegateUserId: delegatoSoloRevoca.id, startsOn: oggi(),
    })).json() as { delegationId: string };

    const prima = await activeDomainsOf(pool, {
      userId: delegatoSoloRevoca.id, tenantId: null, roles: await ruoliDi(delegatoSoloRevoca.id),
    });
    expect(prima.has("delegation"), "il dominio non si è acceso: il caso partirebbe cieco").toBe(true);

    const rev = await t.app.inject({
      method: "POST",
      url: `/v1/delegations/${creata.delegationId}/revoke`,
      headers: { cookie, "x-csrf-token": csrf },
      payload: { reason: "fine prova" },
    });
    expect(rev.statusCode, `revoca: ${rev.statusCode} ${rev.body.slice(0, 200)}`).toBe(200);
    expect((rev.json() as { status: string }).status).toBe("REVOKED");
    expect((rev.json() as { isInForce: boolean }).isInForce).toBe(false);

    const dopo = await activeDomainsOf(pool, {
      userId: delegatoSoloRevoca.id, tenantId: null, roles: await ruoliDi(delegatoSoloRevoca.id),
    });
    expect(dopo.has("delegation"), "il dominio resta acceso dopo la revoca").toBe(false);
  });

  it("una delega FUTURA non accende nulla: la finestra conta", async () => {
    const r = await creaDelega({
      delegatorUserId: delegante.id, delegateUserId: delegato.id,
      startsOn: fra(10), endsOn: fra(20),
    });
    expect(r.statusCode).toBe(201);
    expect(
      (r.json() as { isInForce: boolean }).isInForce,
      "una delega che comincia fra dieci giorni risulta già in vigore",
    ).toBe(false);
  });

  it("i due vincoli di dominio sono rifiutati con un messaggio, non con un 500", async () => {
    const seStesso = await creaDelega({
      delegatorUserId: delegante.id, delegateUserId: delegante.id, startsOn: oggi(),
    });
    // 422 e non 400: la richiesta è ben formata (Zod la accetta), è il DOMINIO a rifiutarla.
    expect(seStesso.statusCode, "delegare a se stessi è stato accettato").toBe(422);
    expect((seStesso.json() as { error: { code: string } }).error.code).toBe("DELEGATION_SELF");

    const finestra = await creaDelega({
      delegatorUserId: delegante.id, delegateUserId: delegato.id,
      startsOn: fra(10), endsOn: fra(2),
    });
    expect(finestra.statusCode, "una finestra che finisce prima di cominciare è passata").toBe(422);
    expect((finestra.json() as { error: { code: string } }).error.code).toBe("DELEGATION_WINDOW_INVALID");
  });

  it("I17 — ciascuno vede le PROPRIE deleghe dai due lati, senza alcun mandato", async () => {
    await creaDelega({
      delegatorUserId: delegante.id, delegateUserId: delegato.id, startsOn: oggi(),
    });

    const suo = await loginRaw(t.app, delegato.email);
    const suoCookie = (suo.cookies as { name: string; value: string }[])
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const r = await t.app.inject({
      method: "GET", url: "/v1/me/delegations", headers: { cookie: suoCookie },
    });
    expect(r.statusCode, `area personale: ${r.statusCode} ${r.body.slice(0, 200)}`).toBe(200);
    const body = r.json() as { granted: unknown[]; received: unknown[] };
    expect(body.received.length, "chi ha ricevuto la delega non la vede fra le proprie").toBeGreaterThan(0);
    expect(Array.isArray(body.granted)).toBe(true);
  });

  it("NON-REGRESSIONE — ricevere una delega non apre il menu amministrativo", async () => {
    // La delega dice cosa PUOI FARE al posto di un altro, non su chi puoi guardare: se
    // aprisse il menu di governo, basterebbe una delega di approvazioni per vedere le
    // superfici amministrative del tenant.
    await creaDelega({
      delegatorUserId: delegante.id, delegateUserId: delegato.id, startsOn: oggi(),
    });
    const ruoli = await ruoliDi(delegato.id);
    const domini = await activeDomainsOf(pool, { userId: delegato.id, tenantId: null, roles: ruoli });
    expect(domini.has("delegation")).toBe(true);

    const apre = await hasAnyDomain(pool, { userId: delegato.id, tenantId: null, roles: ruoli });
    const perAltraVia = ["line_management", "team_lead", "process_owner", "hr_mandate", "platform_mandate"]
      .some((d) => domini.has(d as never));
    expect(
      apre,
      "la delega da sola apre il menu amministrativo",
    ).toBe(perAltraVia);
  });
});
