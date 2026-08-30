/**
 * apps/api/test/surveys-scope.integration.test.ts
 *
 * #235 — L'ASSE ORGANIZZATIVO SULLE RISPOSTE AI SONDAGGI DI CLIMA.
 *
 * Il difetto che questo file presidia: fino a S1085 `surveys` non era classificata, quindi le
 * sue rotte read erano gated dal solo RBAC + tenant. Chiunque avesse `surveys:read` leggeva
 * *chi ha detto cosa sul clima aziendale*, anche di persone fuori dalla propria catena — e non
 * c'è una sola risposta anonima: 862 su 862 portano `response_subject_user_id`.
 *
 * La cura (mig `000366` + `orgGate` sulle rotte): la lista è filtrata per allow-list, la singola
 * risposta è gated con `canReadOrgTarget`, e chi non può leggerla riceve **404 e non 403** — un
 * 403 confermerebbe che quella persona ha risposto, cioè metà del dato da proteggere.
 *
 * La prova live di S1085 (`scripts/prova-235-risposte-di-clima.mts`) ha misurato l'effetto su
 * due persone reali: il mandato HR legge 150 risposte su 150, il capo di catena 18 — nessuna
 * fuori dalla sua catena. Questo file rende quella misura **ripetibile**: la prova live dimostra
 * che oggi funziona, il test impedisce che smetta di funzionare senza che nessuno se ne accorga.
 *
 * Gli attori non sono nomi scritti a mano: `attoriDiScena()` li deriva dall'albero delle unità
 * di oggi (#147). Se domani non esistesse più un capo con sottoposti, il file si ferma dicendo
 * cosa manca invece di misurare un caso limite in silenzio.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { attoriDiScena } from "./helpers/attori-di-scena.js";

const ATTORI = await attoriDiScena();
const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_SURVEYSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S {
  cookies: Map<string, string>;
  userId: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { user: { userId: string } };
  return { cookies, userId: body.user.userId };
}

/** Un sondaggio VERO del tenant: non se ne crea uno finto, si usa quello su cui le persone hanno risposto. */
async function unSondaggioDelTenant(userId: string): Promise<string> {
  const r = await pool.query<{ survey_id: string }>(
    `SELECT s.survey_id
       FROM sys.sys_engagement_surveys s
       JOIN sys.sys_users u ON u.user_tenant_id = s.survey_tenant_id
      WHERE u.user_id = $1
      ORDER BY s.created_at
      LIMIT 1`,
    [userId],
  );
  const id = r.rows[0]?.survey_id;
  if (!id) throw new Error("nessun sondaggio nel tenant di questo attore: il caso non e' misurabile");
  return id;
}

/** Una risposta il cui soggetto è `subjectUserId`, marcata col prefisso della suite per la pulizia. */
async function seminaRisposta(surveyId: string, subjectUserId: string): Promise<string> {
  const r = await pool.query<{ response_id: string }>(
    `INSERT INTO sys.sys_engagement_survey_responses (
        response_tenant_id, response_natural_key, response_survey_id,
        response_subject_user_id, response_answers, response_is_complete, response_metadata)
     SELECT u.user_tenant_id, $3, $1, u.user_id, '[]'::jsonb, true, $4::jsonb
       FROM sys.sys_users u WHERE u.user_id = $2
     RETURNING response_id`,
    [surveyId, subjectUserId, `${SUITE_PREFIX}::${subjectUserId}`, JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return r.rows[0]!.response_id;
}

interface Elenco {
  items: Array<{ responseId: string; subjectUserId: string | null }>;
  total: number;
}

let suite: TestApp;
let capo: S;        // MANAGER — perimetro = la sua catena
let hr: S;          // TENANT_ADMIN — mandato HR, tutto il tenant (I20)
let surveyId: string;
let rispostaDelSottoposto: string; // il capo LA DEVE leggere
let rispostaDellEstraneo: string;  // il capo NON la deve leggere

describe("/v1/surveys/:id/responses — #235 l'asse organizzativo sulle risposte di clima", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    capo = await login(suite, ATTORI.capo.email);
    hr = await login(suite, ATTORI.hr.email);
    surveyId = await unSondaggioDelTenant(capo.userId);
    rispostaDelSottoposto = await seminaRisposta(surveyId, ATTORI.sottoposto.userId);
    rispostaDellEstraneo = await seminaRisposta(surveyId, ATTORI.estraneo.userId);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_engagement_survey_responses WHERE response_natural_key LIKE $1`,
      [`${SUITE_PREFIX}::%`],
    );
    await suite.app.close();
    await closePool();
  });

  it("il capo legge la risposta di chi sta nella sua catena", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/surveys/${surveyId}/responses?limit=500`,
      headers: { cookie: ch(capo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as Elenco;
    expect(b.items.map((i) => i.responseId)).toContain(rispostaDelSottoposto);
  });

  it("…e NON quella di chi sta fuori: e' il difetto che #235 e' venuta a togliere", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/surveys/${surveyId}/responses?limit=500`,
      headers: { cookie: ch(capo.cookies) },
    });
    const b = r.json() as Elenco;
    expect(b.items.map((i) => i.responseId)).not.toContain(rispostaDellEstraneo);
  });

  it("la singola risposta dell'estraneo risponde 404, non 403 (un 403 direbbe che ha risposto)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/surveys/responses/${rispostaDellEstraneo}`,
      headers: { cookie: ch(capo.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });

  it("il mandato HR le legge ENTRAMBE: I20 non e' stato ristretto per sbaglio", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/surveys/${surveyId}/responses?limit=500`,
      headers: { cookie: ch(hr.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const ids = (r.json() as Elenco).items.map((i) => i.responseId);
    expect(ids).toContain(rispostaDelSottoposto);
    expect(ids).toContain(rispostaDellEstraneo);
  });

  it("il capo vede STRETTAMENTE meno del mandato HR: il filtro filtra davvero", async () => {
    const [rc, rh] = await Promise.all([
      suite.app.inject({ method: "GET", url: `/v1/surveys/${surveyId}/responses?limit=500`, headers: { cookie: ch(capo.cookies) } }),
      suite.app.inject({ method: "GET", url: `/v1/surveys/${surveyId}/responses?limit=500`, headers: { cookie: ch(hr.cookies) } }),
    ]);
    const nCapo = (rc.json() as Elenco).items.length;
    const nHr = (rh.json() as Elenco).items.length;
    // Non un numero scritto a mano: la relazione fra le due letture, che vale su qualunque dataset.
    expect(nCapo).toBeLessThan(nHr);
    expect(nCapo).toBeGreaterThan(0); // e non zero: una porta murata non e' un cancello
  });
});
