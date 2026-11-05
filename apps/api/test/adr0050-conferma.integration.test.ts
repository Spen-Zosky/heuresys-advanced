/**
 * ADR-0050 D5 — prima di leggere per mandato la retribuzione o le valutazioni di un'altra
 * persona, la sessione deve avere una verifica del secondo fattore recente (15 minuti).
 *
 * Attore: governo@ (TENANT_ADMIN, mandato HR) di RTL Bank. Il token «vecchio» è lo stesso
 * token del login con l'ora della verifica spostata indietro di 20 minuti e firmato con la
 * chiave dell'app: è l'unico modo di provare la finestra senza aspettarla.
 *
 * Prova, dal vivo:
 *   - le rotte marcate sono quelle di classe COMPENSATION/EVALUATION con righe di persona;
 *   - sessione appena confermata: la lettura per mandato passa;
 *   - sessione vecchia: 403 STEP_UP_REQUIRED, e nel dossier le due classi trattenute con
 *     `stepUpRequired`;
 *   - la conferma (begin + verify con il codice) riemette il token, e la lettura ripassa;
 *   - un codice sbagliato non conferma, e un'altra persona non può confermare per me;
 *   - il rinnovo del token porta avanti l'ora della verifica senza rinnovarla;
 *   - i propri dati e la catena non chiedono la conferma (I17, I18).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw, totpFor } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";
import { COOKIES } from "../src/config/constants.js";
import { STEP_UP_REQUIRED_CODE, STEP_UP_WINDOW_MINUTES } from "@heuresys/shared";
import { serveConferma, sessioneD5, confermaDentroFinestra, CLASSI_CON_CONFERMA } from "../src/lib/scope/conferma.js";
import { dataClassOf } from "../src/lib/scope/data-classes.js";
import { unCapoConSottoposti, unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";

// Usa il rinnovo del token: le sessioni non si prendono dalla copia condivisa.
senzaCacheDiSessione();

const GOVERNO = "governo@collaudo.invalid";
const SECURITY = "security-admin@collaudo.invalid";
const TARGET = "alberto.colombo@rtl-bank.org";

interface Auth { cookies: Map<string, string>; csrfToken: string }
interface ErrBody { error: { code: string } }

function cookieHeader(a: Auth): string {
  return [...a.cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
function headers(a: Auth) {
  return { cookie: cookieHeader(a), "x-csrf-token": a.csrfToken, "content-type": "application/json" };
}
function conCookie(a: Auth, name: string, value: string): Auth {
  const cookies = new Map(a.cookies);
  cookies.set(name, value);
  return { cookies, csrfToken: a.csrfToken };
}
async function idUtente(email: string): Promise<string> {
  const r = await pool.query<{ id: string }>(`SELECT user_id AS id FROM sys.sys_users WHERE lower(user_email) = lower($1)`, [email]);
  if (!r.rows[0]) throw new Error(`utente assente: ${email}`);
  return r.rows[0].id;
}

describe("ADR-0050 D5 — conferma recente del secondo fattore per le letture per mandato", () => {
  let suite: TestApp;
  let governo: Auth;
  let targetId: string;
  let governoId: string;

  async function login(email: string): Promise<Auth> {
    const r = await loginRaw(suite.app, email, deriveCollaudoPassword(readCollaudoKey(), email));
    if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
    const cookies = new Map<string, string>();
    for (const c of r.cookies) cookies.set(c.name, c.value);
    return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
  }
  function claims(a: Auth): Record<string, unknown> {
    return suite.app.jwt.decode(a.cookies.get(COOKIES.ACCESS)!) as Record<string, unknown>;
  }
  /** Lo stesso token, con l'ultima verifica `minuti` fa. */
  async function invecchia(a: Auth, minuti: number): Promise<Auth> {
    const { iat: _i, exp: _e, ...resto } = claims(a);
    const jwt = await suite.app.jwt.sign({ ...resto, sua: Math.floor(Date.now() / 1000) - minuti * 60 } as never);
    return conCookie(a, COOKIES.ACCESS, jwt);
  }
  const variablePay = (a: Auth) =>
    suite.app.inject({ method: "GET", url: "/v1/compensation/variable-pay", headers: { cookie: cookieHeader(a) } });
  const dossier = (a: Auth, userId: string) =>
    suite.app.inject({ method: "GET", url: `/v1/users/${userId}/dossier`, headers: { cookie: cookieHeader(a) } });

  beforeAll(async () => {
    suite = await buildTestApp();
    governo = await login(GOVERNO);
    targetId = await idUtente(TARGET);
    governoId = await idUtente(GOVERNO);
  });
  afterAll(async () => {
    await suite.app.close();
  });

  it("le rotte marcate sono di classe COMPENSATION o EVALUATION, con righe di persona", () => {
    const rotte = suite.app.confermaD5Stats.rotte;
    expect(rotte.length).toBeGreaterThan(0);
    expect(rotte.map((r) => r.url)).toContain("/v1/compensation/variable-pay");
    for (const r of rotte) {
      expect(CLASSI_CON_CONFERMA.has(r.classe)).toBe(true);
      expect(dataClassOf(r.permissionCode.split(":")[0]!)).toBe(r.classe);
    }
    // le rotte di catalogo e di aggregato restano fuori: non mostrano persone
    expect(rotte.map((r) => r.url)).not.toContain("/v1/compensation/bands");
    expect(rotte.map((r) => r.url)).not.toContain("/v1/compensation/distribution");
  });

  it("il login con il secondo fattore porta l'ora della verifica nel token", () => {
    const sua = claims(governo)["sua"];
    expect(typeof sua).toBe("number");
    expect(confermaDentroFinestra(sua as number)).toBe(true);
  });

  it("sessione appena confermata: la lettura per mandato passa", async () => {
    const r = await variablePay(governo);
    expect(r.statusCode, r.body).toBe(200);
  });

  it("sessione vecchia: 403 STEP_UP_REQUIRED sull'elenco, classi trattenute nel dossier", async () => {
    const vecchio = await invecchia(governo, STEP_UP_WINDOW_MINUTES + 5);
    const r = await variablePay(vecchio);
    expect(r.statusCode, r.body).toBe(403);
    expect((r.json() as ErrBody).error.code).toBe(STEP_UP_REQUIRED_CODE);

    const d = await dossier(vecchio, targetId);
    expect(d.statusCode, d.body).toBe(200);
    const body = d.json() as { stepUpRequired?: string[]; paySlips: Array<{ masked?: string[] }> };
    expect(body.stepUpRequired).toEqual(["COMPENSATION", "EVALUATION"]);
    for (const p of body.paySlips) expect(p.masked?.length ?? 0).toBeGreaterThan(0);

    const fresco = await dossier(governo, targetId);
    expect((fresco.json() as { stepUpRequired?: string[] }).stepUpRequired).toBeUndefined();
  });

  it("i propri dati non chiedono la conferma (I17)", async () => {
    const vecchio = await invecchia(governo, 60);
    const d = await dossier(vecchio, governoId);
    expect(d.statusCode, d.body).toBe(200);
    expect((d.json() as { stepUpRequired?: string[] }).stepUpRequired).toBeUndefined();
  });

  it("la conferma con il codice riemette il token, e la lettura ripassa", async () => {
    const vecchio = await invecchia(governo, 30);
    const begin = await suite.app.inject({ method: "POST", url: "/v1/auth/mfa/step-up/begin", headers: headers(vecchio), payload: {} });
    expect(begin.statusCode, begin.body).toBe(200);
    const { challengeToken, availableKinds } = begin.json() as { challengeToken: string; availableKinds: string[] };
    expect(availableKinds).toContain("TOTP");

    const verify = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/step-up/verify", headers: headers(vecchio),
      payload: { challengeToken, code: totpFor(GOVERNO) },
    });
    expect(verify.statusCode, verify.body).toBe(200);
    expect(verify.json()).toEqual({ confirmed: true, validForMinutes: STEP_UP_WINDOW_MINUTES });
    const nuovo = verify.cookies.find((c) => c.name === COOKIES.ACCESS);
    expect(nuovo).toBeDefined();
    const confermato = conCookie(vecchio, COOKIES.ACCESS, nuovo!.value);
    expect(claims(confermato)["fam"]).toBe(claims(vecchio)["fam"]);
    expect(confermaDentroFinestra(claims(confermato)["sua"] as number)).toBe(true);

    const r = await variablePay(confermato);
    expect(r.statusCode, r.body).toBe(200);

    // la riga di rinnovo della sessione porta l'ora, per il rinnovo successivo
    const riga = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sys.sys_auth_refresh_tokens
        WHERE auth_refresh_token_family_id = $1 AND auth_refresh_token_step_up_at IS NOT NULL`,
      [claims(vecchio)["fam"]],
    );
    expect(Number(riga.rows[0]!.n)).toBeGreaterThan(0);
    const evento = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sys.sys_auth_login_events
        WHERE auth_login_event_user_id = $1 AND auth_login_event_type = 'MFA_OK'
          AND auth_login_event_details->>'purpose' = 'STEP_UP'`,
      [governoId],
    );
    expect(Number(evento.rows[0]!.n)).toBeGreaterThan(0);
  });

  it("un codice sbagliato non conferma, e il tentativo resta nel registro", async () => {
    const vecchio = await invecchia(governo, 30);
    const begin = await suite.app.inject({ method: "POST", url: "/v1/auth/mfa/step-up/begin", headers: headers(vecchio), payload: {} });
    const { challengeToken } = begin.json() as { challengeToken: string };
    const giusto = totpFor(GOVERNO);
    const sbagliato = String((Number(giusto) + 500_000) % 1_000_000).padStart(6, "0");
    const verify = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/step-up/verify", headers: headers(vecchio),
      payload: { challengeToken, code: sbagliato },
    });
    expect(verify.statusCode, verify.body).toBe(401);
    expect(verify.cookies.find((c) => c.name === COOKIES.ACCESS)).toBeUndefined();
    const fallito = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sys.sys_auth_login_events
        WHERE auth_login_event_user_id = $1 AND auth_login_event_type = 'MFA_FAIL'
          AND auth_login_event_details->>'purpose' = 'STEP_UP'`,
      [governoId],
    );
    expect(Number(fallito.rows[0]!.n)).toBeGreaterThan(0);
  });

  it("la sfida di un'altra persona non conferma la mia sessione", async () => {
    const security = await login(SECURITY);
    const begin = await suite.app.inject({ method: "POST", url: "/v1/auth/mfa/step-up/begin", headers: headers(security), payload: {} });
    const { challengeToken } = begin.json() as { challengeToken: string };
    const vecchio = await invecchia(governo, 30);
    const verify = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/step-up/verify", headers: headers(vecchio),
      payload: { challengeToken, code: totpFor(SECURITY) },
    });
    expect(verify.statusCode, verify.body).toBe(401);
    expect((verify.json() as ErrBody).error.code).toBe("MFA_INVALID");
  });

  it("senza sessione la conferma non si chiede", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/auth/mfa/step-up/begin", payload: {} });
    expect([401, 403]).toContain(r.statusCode);
  });

  it("il rinnovo del token porta avanti l'ora della verifica, senza rinnovarla", async () => {
    const fresca = await login(GOVERNO);
    const suaLogin = claims(fresca)["sua"];
    const r = await suite.app.inject({
      method: "POST", url: "/v1/auth/refresh",
      headers: {
        cookie: `${COOKIES.REFRESH}=${fresca.cookies.get(COOKIES.REFRESH)}; ${COOKIES.CSRF}=${fresca.cookies.get(COOKIES.CSRF)}`,
        "x-csrf-token": fresca.csrfToken, "content-type": "application/json",
      },
      payload: {},
    });
    expect(r.statusCode, r.body).toBe(200);
    const access = r.cookies.find((c) => c.name === COOKIES.ACCESS)!.value;
    const rinnovato = suite.app.jwt.decode(access) as Record<string, unknown>;
    expect(rinnovato["sua"]).toBe(suaLogin);
    expect(rinnovato["fam"]).toBe(claims(fresca)["fam"]);
  });

  it("la catena non chiede la conferma (I18), un estraneo sì", async () => {
    const capo = await unCapoConSottoposti(pool);
    const sotto = await unSottopostoOrganizzativo(pool, capo.userId);
    const fuori = await unEstraneoOrganizzativo(pool, capo.userId);
    const tenant = (await pool.query<{ t: string }>(`SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_id = $1`, [capo.userId])).rows[0]!.t;
    const vecchia = sessioneD5("famiglia-di-prova", Math.floor(Date.now() / 1000) - 3600)!;
    expect(vecchia).toBeDefined();
    const attore = { userId: capo.userId, tenantId: tenant, roles: ["MANAGER", "HRMS_MANAGER"] as never, sessioneD5: vecchia };
    expect(await serveConferma(pool, attore, "COMPENSATION", sotto.userId)).toBe(false);
    expect(await serveConferma(pool, attore, "EVALUATION", fuori.userId)).toBe(true);
    expect(await serveConferma(pool, attore, "PERSONAL", fuori.userId)).toBe(false);
    expect(await serveConferma(pool, attore, "COMPENSATION", capo.userId)).toBe(false);
    // senza mandato HR la lettura non passa dal mandato: D5 non c'entra
    expect(await serveConferma(pool, { ...attore, roles: ["MANAGER"] as never }, "COMPENSATION", fuori.userId)).toBe(false);
    // senza sessione: un attore costruito fuori da una richiesta non è governato (confine
    // dichiarato), una richiesta senza sessione per mandato non legge
    const { sessioneD5: _s, ...senzaSessione } = attore;
    expect(await serveConferma(pool, senzaSessione, "COMPENSATION", fuori.userId)).toBe(false);
    expect(await serveConferma(pool, { ...senzaSessione, daRichiesta: true }, "COMPENSATION", fuori.userId)).toBe(true);
  });

  it("la finestra: dentro, fuori, e un'ora nel futuro non vale", () => {
    const adesso = Date.now();
    const s = Math.floor(adesso / 1000);
    expect(confermaDentroFinestra(s - 60, adesso)).toBe(true);
    expect(confermaDentroFinestra(s - STEP_UP_WINDOW_MINUTES * 60 - 1, adesso)).toBe(false);
    expect(confermaDentroFinestra(s + 3600, adesso)).toBe(false);
    expect(confermaDentroFinestra(null, adesso)).toBe(false);
  });
});
