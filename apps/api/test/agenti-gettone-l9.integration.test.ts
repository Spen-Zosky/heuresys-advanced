/**
 * Piano interfacce, lotto L9 — A-1, A-2, A-3, A-5 (ADR-0050 D6, ADR-0051 §6, ADR-0040).
 *
 * Il gettone dell'agente (`POST /v1/auth/agent-tokens`) e il registro delle scritture
 * (`audit.registro_scritture`, migrazione 000477). Si prova che:
 *  - A-1: l'API distingue l'agente dalla persona, e il registro conserva tutti e due;
 *  - D6: il gettone porta i ruoli della persona senza i mandati;
 *  - A-2: il compito restringe i permessi: un agente che può solo leggere non scrive, e il
 *    tentativo resta nel registro;
 *  - A-3: il gettone non tocca l'autenticazione, non si rinnova, scade, e cade con la sessione
 *    della persona;
 *  - A-5: un agente del delegato decide per conto del delegante con una delega vera, e la firma
 *    dice «agente X per conto di Y».
 *
 * Gli attori vengono dall'organigramma vivo (helpers/org-actors.ts); le scene stanno nella
 * transazione del file. Le sessioni sono fresche: il gettone pretende la sessione viva nel
 * database, e quelle della copia condivisa vengono da file le cui righe sono già annullate.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";
import { MANDATE_ROLES } from "../src/lib/scope/mandati.js";
import { AGENT_TOKEN_TTL_SECONDS, type AgentTokenResponse } from "@heuresys/shared";
import { unCapoConSottoposti, unSottopostoOrganizzativo, type Attore } from "./helpers/org-actors.js";

senzaCacheDiSessione();

const AMMINISTRA = "governo@collaudo.invalid";

interface Sessione { cookies: Map<string, string>; csrf: string }
interface Riga {
  attore_tipo: string; persona: string; agente: string | null; compito: string | null;
  jti: string | null; metodo: string; rotta: string; stato: number; dettaglio: Record<string, unknown> | null;
}

let t: TestApp;
let capo: Attore;
let sotto: Attore;

const oggi = () => new Date().toISOString().slice(0, 10);
const fra = (giorni: number) => {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
};

async function accedi(email: string): Promise<Sessione> {
  const r = await loginRaw(t.app, email);
  if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies as { name: string; value: string }[]) cookies.set(c.name, c.value);
  return { cookies, csrf: (r.json() as { csrfToken: string }).csrfToken };
}
const cookie = (s: Sessione) => [...s.cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
/** La sessione dell'agente: i cookie della persona, con il gettone al posto dell'accesso e SENZA rinnovo. */
function dellAgente(persona: Sessione, gettone: string): Sessione {
  const cookies = new Map(persona.cookies);
  cookies.set(COOKIES.ACCESS, gettone);
  cookies.delete(COOKIES.REFRESH);
  return { cookies, csrf: persona.csrf };
}
function chiama(s: Sessione, method: "GET" | "POST" | "PATCH", url: string, payload?: Record<string, unknown>) {
  return t.app.inject({
    method,
    url,
    headers: { cookie: cookie(s), ...(method === "GET" ? {} : { "x-csrf-token": s.csrf, "content-type": "application/json" }) },
    ...(payload ? { payload } : {}),
  });
}
async function gettone(persona: Sessione, corpo: Record<string, unknown>) {
  return chiama(persona, "POST", "/v1/auth/agent-tokens", corpo);
}
/** onResponse scrive dopo l'invio: si aspetta la riga invece di supporla già scritta. */
async function righe(where: string, args: unknown[], attese = 1): Promise<Riga[]> {
  const sql = `
    SELECT registro_scrittura_attore_tipo AS attore_tipo, registro_scrittura_persona_user_id::text AS persona,
           registro_scrittura_agente_codice AS agente, registro_scrittura_agente_compito AS compito,
           registro_scrittura_gettone_jti AS jti, registro_scrittura_metodo AS metodo,
           registro_scrittura_rotta AS rotta, registro_scrittura_stato_http AS stato,
           registro_scrittura_dettaglio AS dettaglio
      FROM audit.registro_scritture WHERE ${where} ORDER BY registro_scrittura_id`;
  for (let i = 0; i < 40; i++) {
    const r = await pool.query<Riga>(sql, args);
    if (r.rows.length >= attese) return r.rows;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  return (await pool.query<Riga>(sql, args)).rows;
}
beforeAll(async () => {
  t = await buildTestApp();
  capo = await unCapoConSottoposti(pool);
  sotto = await unSottopostoOrganizzativo(pool, capo.userId);
}, 60_000);

afterAll(async () => {
  await t.app.close();
});

describe("L9 A-1 e ADR-0050 D6 — il gettone dice chi è l'agente e per conto di chi, senza mandati", () => {
  it("la persona lo chiede per un agente e un compito; porta i suoi ruoli senza mandati, e niente rinnovo", async () => {
    const persona = await accedi(capo.email);
    const r = await gettone(persona, { agentCode: "assistente-hr", task: "prova L9: leggere le mie preferenze" });
    expect(r.statusCode, r.body).toBe(201);
    const g = r.json() as AgentTokenResponse;
    expect(g.agentCode).toBe("assistente-hr");
    expect(g.permissions).toBeNull();
    // A-12: il gettone dice per conto di chi e in quale tenant (il diario del gateway li scrive).
    expect(g.userId).toBe(capo.userId);
    const tenant = await pool.query<{ codice: string }>(
      `SELECT t.tenant_code AS codice FROM sys.sys_users u JOIN sys.sys_tenants t ON t.tenant_id = u.user_tenant_id WHERE u.user_id = $1`,
      [capo.userId],
    );
    expect(g.tenantCode).toBe(tenant.rows[0]?.codice ?? null);
    for (const ruolo of g.roles) expect(MANDATE_ROLES.has(ruolo as never), `il gettone porta il mandato ${ruolo}`).toBe(false);
    const dellaPersona = t.app.jwt.decode<{ roles: string[] }>(persona.cookies.get(COOKIES.ACCESS)!)!.roles;
    const attesi = dellaPersona.filter((x) => !MANDATE_ROLES.has(x as never)).sort();
    expect([...g.roles].sort()).toEqual(attesi);
    expect(r.cookies.map((c) => c.name), "l'emissione ha scritto cookie: il gettone è per l'agente, non per il browser").toEqual([]);

    const claims = t.app.jwt.decode(g.token) as Record<string, unknown> & { exp: number; iat: number };
    expect(claims["sub"]).toBe(capo.userId);
    expect(claims["agt"]).toEqual({ cod: "assistente-hr", cmp: "prova L9: leggere le mie preferenze" });
    expect(claims["fam"], "il gettone non è legato alla sessione della persona").toBe(t.app.jwt.decode<{ fam: string }>(persona.cookies.get(COOKIES.ACCESS)!)!.fam);
    expect(claims.exp - claims.iat).toBe(AGENT_TOKEN_TTL_SECONDS);

    // L'emissione è una scrittura della persona, e il registro dice per quale agente e compito.
    const [riga] = await righe(`registro_scrittura_dettaglio->'gettoneAgente'->>'jti' = $1`, [claims["jti"]]);
    expect(riga).toMatchObject({ attore_tipo: "persona", persona: capo.userId, agente: null, rotta: "/v1/auth/agent-tokens", stato: 201 });
  });

  it("chi chiama con il gettone è l'agente: la persona resta quella del token, e il registro li tiene tutti e due", async () => {
    const persona = await accedi(sotto.email);
    const r = await gettone(persona, { agentCode: "assistente-hr", task: "prova L9: tema" });
    expect(r.statusCode, r.body).toBe(201);
    const agente = dellAgente(persona, (r.json() as AgentTokenResponse).token);

    const chi = await chiama(agente, "GET", "/v1/auth/me");
    expect(chi.statusCode, chi.body).toBe(200);
    const scrivi = await chiama(agente, "PATCH", "/v1/me/preferences", { theme: "dark" });
    expect(scrivi.statusCode, scrivi.body).toBe(200);

    const jti = (t.app.jwt.decode(agente.cookies.get(COOKIES.ACCESS)!) as { jti: string }).jti;
    const [riga] = await righe(`registro_scrittura_gettone_jti = $1`, [jti]);
    expect(riga).toMatchObject({
      attore_tipo: "agente", persona: sotto.userId, agente: "assistente-hr", compito: "prova L9: tema",
      metodo: "PATCH", rotta: "/v1/me/preferences", stato: 200,
    });
  });
});

describe("L9 A-2 — l'agente sotto la persona, per compito", () => {
  it("un compito di sola lettura legge e non scrive, e il tentativo resta nel registro", async () => {
    const persona = await accedi(sotto.email);
    const r = await gettone(persona, { agentCode: "lettore", task: "prova L9: solo lettura", permissions: ["me:preferences:read"] });
    expect(r.statusCode, r.body).toBe(201);
    expect((r.json() as AgentTokenResponse).permissions).toEqual(["me:preferences:read"]);
    const agente = dellAgente(persona, (r.json() as AgentTokenResponse).token);

    const permessi = await chiama(agente, "GET", "/v1/me/permissions");
    expect(permessi.statusCode).toBe(200);
    expect((permessi.json() as { permissions: string[] }).permissions).toEqual(["me:preferences:read"]);
    expect((await chiama(agente, "GET", "/v1/me/preferences")).statusCode).toBe(200);

    const scrivi = await chiama(agente, "PATCH", "/v1/me/preferences", { theme: "light" });
    expect(scrivi.statusCode, scrivi.body).toBe(403);

    const jti = (t.app.jwt.decode(agente.cookies.get(COOKIES.ACCESS)!) as { jti: string }).jti;
    const [riga] = await righe(`registro_scrittura_gettone_jti = $1`, [jti]);
    expect(riga).toMatchObject({ attore_tipo: "agente", agente: "lettore", persona: sotto.userId, rotta: "/v1/me/preferences", stato: 403 });
  });

  it("un compito non chiede più di ciò che la persona ha senza mandati", async () => {
    const persona = await accedi(sotto.email);
    const r = await gettone(persona, { agentCode: "avido", task: "prova L9: oltre", permissions: ["me:preferences:read", "mfa_policy:manage"] });
    expect(r.statusCode, r.body).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("AGENT_SCOPE_EXCEEDS_PERSON");
  });
});

describe("L9 A-3 — il gettone non si rinnova e non sopravvive alla persona", () => {
  it("non tocca l'autenticazione: né rinnovo, né un altro gettone, né la conferma del secondo fattore", async () => {
    const persona = await accedi(sotto.email);
    const agente = dellAgente(persona, ((await gettone(persona, { agentCode: "a3", task: "prova L9: autenticazione" })).json() as AgentTokenResponse).token);
    for (const [method, url] of [
      ["POST", "/v1/auth/refresh"],
      ["POST", "/v1/auth/agent-tokens"],
      ["POST", "/v1/auth/mfa/step-up/begin"],
      ["POST", "/v1/auth/logout"],
      ["GET", "/v1/auth/sessions/current"],
    ] as const) {
      const r = await chiama(agente, method, url, method === "POST" ? { agentCode: "b", task: "annidato" } : undefined);
      expect(r.statusCode, `${method} ${url}: ${r.body}`).toBe(403);
      expect((r.json() as { error: { code: string } }).error.code).toBe("AGENT_FORBIDDEN_AUTH");
    }
  });

  it("scaduto, non vale più", async () => {
    const persona = await accedi(sotto.email);
    const g = ((await gettone(persona, { agentCode: "a3", task: "prova L9: scadenza" })).json() as AgentTokenResponse).token;
    const { iat: _i, exp: _e, ...claims } = t.app.jwt.decode(g) as Record<string, unknown>;
    const scaduto = await t.app.jwt.sign(claims as never, { expiresIn: 1 });
    await new Promise((ok) => setTimeout(ok, 1100));
    const r = await chiama(dellAgente(persona, scaduto), "GET", "/v1/me/preferences");
    expect(r.statusCode, r.body).toBe(401);
  });

  it("chiusa la sessione della persona, il gettone smette di valere subito", async () => {
    const persona = await accedi(sotto.email);
    const agente = dellAgente(persona, ((await gettone(persona, { agentCode: "a3", task: "prova L9: uscita" })).json() as AgentTokenResponse).token);
    expect((await chiama(agente, "GET", "/v1/me/preferences")).statusCode).toBe(200);
    const fuori = await chiama(persona, "POST", "/v1/auth/logout", {});
    expect(fuori.statusCode, fuori.body).toBeLessThan(300);
    expect((await chiama(agente, "GET", "/v1/me/preferences")).statusCode).toBe(401);
  });
});

describe("L9 A-5 — una delega vera, usata da un agente del delegato", () => {
  it("l'agente decide per conto del delegante entro la delega, e la firma lo dice", async () => {
    const capoS = await accedi(capo.email);
    const d = await chiama(capoS, "POST", "/v1/me/delegations", {
      delegateUserId: sotto.userId, scope: "APPROVALS", requestType: "TIME_OFF_REQUEST",
      startsOn: oggi(), endsOn: fra(7), reason: "prova L9: delega usata da un agente",
    });
    expect(d.statusCode, d.body).toBe(201);
    const delegationId = (d.json() as { delegationId: string }).delegationId;

    const admin = await accedi(AMMINISTRA);
    const rq = await chiama(admin, "POST", "/v1/approvals", {
      title: "Ferie di prova L9 A-5", resourceType: "TIME_OFF_REQUEST", approverUserIds: [capo.userId],
    });
    expect(rq.statusCode, rq.body).toBe(200);
    const requestId = (rq.json() as { approvalRequestId: string }).approvalRequestId;
    const stepId = (await pool.query<{ id: string }>(
      `SELECT approval_step_id AS id FROM sys.sys_approval_steps WHERE approval_step_request_id = $1`, [requestId],
    )).rows[0]!.id;

    const sottoS = await accedi(sotto.email);
    const decide = `/v1/me/delegations/approvals/${requestId}/steps/${stepId}/decide`;

    // Un compito che non comprende le approvazioni non decide, nemmeno con la delega.
    const fuoriCompito = dellAgente(sottoS, ((await gettone(sottoS, {
      agentCode: "assistente-hr", task: "prova L9: solo preferenze", permissions: ["me:preferences:read"],
    })).json() as AgentTokenResponse).token);
    expect((await chiama(fuoriCompito, "POST", decide, { decision: "APPROVE" })).statusCode).toBe(403);

    const g = await gettone(sottoS, {
      agentCode: "assistente-hr", task: "prova L9: decidere le ferie delegate", permissions: ["approval:read:self"],
    });
    expect(g.statusCode, g.body).toBe(201);
    const agente = dellAgente(sottoS, (g.json() as AgentTokenResponse).token);
    const r = await chiama(agente, "POST", decide, { decision: "APPROVE", comment: "approvato dall'agente del delegato" });
    expect(r.statusCode, r.body).toBe(200);
    const passo = r.json() as { decidedBy: string; actingDelegationId: string; status: string; approverUserId: string };
    expect(passo).toMatchObject({ status: "APPROVED", decidedBy: sotto.userId, actingDelegationId: delegationId, approverUserId: capo.userId });

    const meta = await pool.query<{ m: Record<string, unknown> }>(
      `SELECT approval_step_metadata AS m FROM sys.sys_approval_steps WHERE approval_step_id = $1`, [stepId],
    );
    expect(meta.rows[0]!.m["decisoDaAgente"]).toEqual({ codice: "assistente-hr", compito: "prova L9: decidere le ferie delegate" });

    const jti = (t.app.jwt.decode(agente.cookies.get(COOKIES.ACCESS)!) as { jti: string }).jti;
    const [riga] = await righe(`registro_scrittura_gettone_jti = $1`, [jti]);
    expect(riga).toMatchObject({ attore_tipo: "agente", persona: sotto.userId, agente: "assistente-hr", stato: 200 });

    const avviso = await pool.query<{ s: string }>(
      `SELECT notification_subject AS s FROM sys.sys_inbox_notifications
        WHERE notification_user_id = $1 AND notification_resource_id::text = $2`,
      [capo.userId, stepId],
    );
    expect(avviso.rows.map((x) => x.s).join(" | "), "il delegante non sa che ha deciso un agente").toContain("tramite l'agente assistente-hr");
  });
});
