/**
 * apps/api/test/exposure-gate.integration.test.ts
 *
 * Il CANCELLO DI ESPOSIZIONE (regola Enzo 2026-07-28): un dato che nessuna API
 * espone non e' nel prodotto, e' solo nel database. Alla chiusura di ogni cluster
 * del programma storia36 le lacune di esposizione vanno colmate.
 *
 * Questo file copre i tre endpoint nati da quella regola — le tre tabelle che il
 * programma popolava e che nessun modulo leggeva:
 *   sys_user_professional_experiences      → GET /v1/me/professional-experiences
 *   sys_position_skill_requirement_history → GET /v1/positions/:id/skill-requirements/history
 *   sys_payout_curves                      → GET /v1/compensation/payout-curves
 *
 * Le attese sono DERIVATE dalla sorgente (dottrina no-hardcoded-test-data): il
 * test confronta la risposta con la stessa riga di database, non con un numero
 * scritto a mano.
 *
 * PERCHE' IL FILE SEMINA I PROPRI DATI (correzione 2026-07-28).
 * Le tre tabelle sono popolate ESCLUSIVAMENTE dai seed del programma storia36
 * (`db/seeds/storia36/03_compensation.sql` per le curve, `05_career.sql` per la
 * storia dei requisiti): non esiste sorgente legacy ne' migrazione che le riempia
 * — la reconciliation le classifica NO_SOURCE / app-generated. Sul database della
 * CI (`heuresys_ci`, clone di PROD congelato al provisioning) quei seed non sono
 * girati, quindi le tabelle sono VUOTE: le attese derivate valgono 0 e un test che
 * si limitasse a leggere passerebbe a vuoto — cioe' "per il motivo sbagliato".
 * Percio' ogni test SEMINA una riga reale prima di leggere e pretende di
 * ritrovarla nella risposta. L'asserzione e' falsificabile in ENTRAMBI gli
 * scenari (con e senza storia36): se l'endpoint smettesse di esporre la tabella,
 * o filtrasse per tenant/self-scope in modo sbagliato, la riga seminata non
 * tornerebbe e il test diventerebbe rosso anche a database "vuoto". Le proprieta'
 * sostanziali (curriculum ordinato, variazione che varia davvero, payload non
 * vuoto) restano asserite su TUTTE le righe restituite — quindi dove la storia
 * c'e' davvero (locale/PROD) coprono anche i dati veri del programma.
 * Le semine non lasciano residuo: il file gira dentro UNA transazione annullata
 * alla fine (D-52, `test/helpers/tx-isolation.ts`).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

async function tenantDi(userId: string): Promise<string> {
  const r = await pool.query<{ t: string }>(
    `SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_id = $1`, [userId]);
  return r.rows[0]!.t;
}

/** Semina un'esperienza professionale per una persona e ne restituisce l'id. */
async function seminaEsperienza(userId: string, datore: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_user_professional_experiences (
       user_prof_exp_user_id, user_prof_exp_tenant_id, user_prof_exp_employer,
       user_prof_exp_role_title, user_prof_exp_start_date, user_prof_exp_end_date)
     VALUES ($1, $2, $3, $4, DATE '2019-03-01', DATE '2021-09-30')
     RETURNING user_prof_exp_id AS id`,
    [userId, await tenantDi(userId), datore, "Analista"],
  );
  return r.rows[0]!.id;
}

let suite: TestApp;
let dipendente: S;
let hr: S;

/** id delle righe seminate: la risposta dell'API deve contenerle. */
let espDipendente: string;
let espHr: string;
let posizioneBersaglio: string;
let variazioneSeminata: string;
const CODICE_CURVA = "EXPOSURE_GATE_FIXTURE";

describe("cancello di esposizione — i dati del programma sono raggiungibili dall'API", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    dipendente = await login(suite, "tommaso.fiore@rtl-bank.org");
    hr = await login(suite, "federica.marchetti@rtl-bank.org");

    espDipendente = await seminaEsperienza(dipendente.userId, "Banca Seminata SpA");
    espHr = await seminaEsperienza(hr.userId, "Altra Banca Seminata SpA");

    // --- storia dei requisiti: serve un requisito reale a cui agganciare la variazione.
    // Si preferisce la posizione che ha gia' piu' storia (cosi' dove storia36 e'
    // popolato il test copre ANCHE le righe vere del programma).
    const tenantHr = await tenantDi(hr.userId);
    let req = (await pool.query<{ psr_id: string; position_id: string; skill_id: string }>(
      `SELECT psr.position_skill_requirement_id AS psr_id, psr.position_id, psr.skill_id
         FROM sys.sys_position_skill_requirements psr
        WHERE psr.position_skill_requirement_tenant_id = $1
        ORDER BY (SELECT count(*) FROM sys.sys_position_skill_requirement_history h
                   WHERE h.position_skill_requirement_history_position_id = psr.position_id) DESC,
                 psr.position_skill_requirement_id
        LIMIT 1`,
      [tenantHr],
    )).rows[0];

    if (!req) {
      // Il tenant non ha ancora requisiti di competenza: se ne crea uno reale su una
      // posizione del tenant, scegliendo una coppia (posizione, competenza) libera.
      const coppia = (await pool.query<{ position_id: string; skill_id: string }>(
        `SELECT p.position_id, s.skill_id
           FROM sys.sys_positions p, sys.sys_skills s
          WHERE p.position_tenant_id = $1
            AND NOT EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements x
                             WHERE x.position_id = p.position_id AND x.skill_id = s.skill_id)
          ORDER BY p.position_id, s.skill_id
          LIMIT 1`,
        [tenantHr],
      )).rows[0];
      if (!coppia) throw new Error("nessuna posizione/competenza nel tenant: fixture impossibile");
      const creato = await pool.query<{ psr_id: string }>(
        `INSERT INTO sys.sys_position_skill_requirements (
           position_id, position_skill_requirement_tenant_id, skill_id, required_proficiency)
         VALUES ($1, $2, $3, 'COMPETENT')
         RETURNING position_skill_requirement_id AS psr_id`,
        [coppia.position_id, tenantHr, coppia.skill_id],
      );
      req = { psr_id: creato.rows[0]!.psr_id, position_id: coppia.position_id, skill_id: coppia.skill_id };
    }
    posizioneBersaglio = req.position_id;

    variazioneSeminata = (await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_position_skill_requirement_history (
         position_skill_requirement_history_psr_id, position_skill_requirement_history_tenant_id,
         position_skill_requirement_history_position_id, position_skill_requirement_history_skill_id,
         position_skill_requirement_history_old_proficiency, position_skill_requirement_history_new_proficiency,
         position_skill_requirement_history_old_weight, position_skill_requirement_history_new_weight,
         position_skill_requirement_history_change_reason, position_skill_requirement_history_actor_user_id)
       VALUES ($1, $2, $3, $4, 'BASIC', 'PROFICIENT', 0.500, 0.800, 'fixture cancello di esposizione', $5)
       RETURNING position_skill_requirement_history_id AS id`,
      [req.psr_id, tenantHr, req.position_id, req.skill_id, hr.userId],
    )).rows[0]!.id;

    // --- curva di payout del tenant di chi chiama (non globale: verifica anche il filtro)
    await pool.query(
      `INSERT INTO sys.sys_payout_curves (
         payout_curve_tenant_id, payout_curve_code, payout_curve_name,
         payout_curve_kind, payout_curve_payload, payout_curve_is_global)
       VALUES ($1, $2, 'Curva seminata dal test', 'LINEAR', '{"min": 0, "max": 1.2}'::jsonb, false)`,
      [tenantHr, CODICE_CURVA],
    );
  });
  afterAll(async () => { await suite.app.close(); await closePool(); });

  it("GET /v1/me/professional-experiences restituisce il curriculum di chi chiama, non di altri", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/professional-experiences",
      headers: { cookie: ch(dipendente.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      total: number;
      items: Array<{
        professionalExperienceId: string; employer: string; roleTitle: string;
        startDate: string; endDate: string | null; durationMonths: number | null;
      }>;
    };

    // atteso DERIVATO dalla sorgente, mai un numero scritto a mano
    const src = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_user_professional_experiences
        WHERE user_prof_exp_user_id = $1`, [dipendente.userId]);
    expect(body.total).toBe(Number(src.rows[0]!.n));

    // la riga che esiste nel database E' esposta dall'API: vale anche a tabella
    // altrimenti vuota, quindi il test non puo' passare a vuoto
    const seminata = body.items.find((e) => e.professionalExperienceId === espDipendente);
    expect(seminata).toBeDefined();
    expect(seminata!.employer).toBe("Banca Seminata SpA");
    // la durata e' CALCOLATA dall'endpoint, non letta: 2019-03-01 → 2021-09-30 = 30 mesi
    expect(seminata!.durationMonths).toBe(30);

    for (const e of body.items) {
      expect(e.employer.length).toBeGreaterThan(0);
      expect(e.roleTitle.length).toBeGreaterThan(0);
      expect(e.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (e.endDate) {
        expect(e.endDate >= e.startDate).toBe(true);
        expect(e.durationMonths).not.toBeNull();
      }
    }
    // ordinamento: dalla piu' recente, come un curriculum
    const inizi = body.items.map((e) => e.startDate);
    expect([...inizi].sort().reverse()).toEqual(inizi);
  });

  it("le esperienze sono self-scoped: due persone non condividono nemmeno una riga", async () => {
    const mie = (await suite.app.inject({
      method: "GET", url: "/v1/me/professional-experiences",
      headers: { cookie: ch(dipendente.cookies) },
    })).json() as { items: Array<{ professionalExperienceId: string }> };
    const sue = (await suite.app.inject({
      method: "GET", url: "/v1/me/professional-experiences",
      headers: { cookie: ch(hr.cookies) },
    })).json() as { items: Array<{ professionalExperienceId: string }> };
    const idMiei = new Set(mie.items.map((e) => e.professionalExperienceId));
    const idSuoi = new Set(sue.items.map((e) => e.professionalExperienceId));

    // ognuno vede la PROPRIA riga seminata e NON quella dell'altro: il self-scope
    // e' verificato su dati che esistono di sicuro, non per assenza di dati
    expect(idMiei.has(espDipendente)).toBe(true);
    expect(idMiei.has(espHr)).toBe(false);
    expect(idSuoi.has(espHr)).toBe(true);
    expect(idSuoi.has(espDipendente)).toBe(false);

    expect(sue.items.filter((e) => idMiei.has(e.professionalExperienceId))).toHaveLength(0);
  });

  it("GET /v1/positions/:id/skill-requirements/history racconta come sono cambiati i requisiti", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/positions/${posizioneBersaglio}/skill-requirements/history`,
      headers: { cookie: ch(hr.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      total: number;
      items: Array<{
        historyId: string; oldProficiency: string | null; newProficiency: string;
        skillName: string | null; effectiveAt: string;
      }>;
    };

    // atteso DERIVATO dalla sorgente, per la posizione scelta
    const atteso = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_position_skill_requirement_history
        WHERE position_skill_requirement_history_position_id = $1`, [posizioneBersaglio]);
    expect(body.total).toBe(Number(atteso.rows[0]!.n));

    // la variazione che esiste nel database E' raggiungibile dall'API
    const mia = body.items.find((h) => h.historyId === variazioneSeminata);
    expect(mia).toBeDefined();
    expect(mia!.oldProficiency).toBe("BASIC");
    expect(mia!.newProficiency).toBe("PROFICIENT");

    for (const h of body.items) {
      // una variazione che non varia nulla non e' una variazione
      expect(h.newProficiency).not.toBe(h.oldProficiency);
      // il nome della competenza e' risolto: senza, la storia sarebbe illeggibile
      expect(h.skillName).not.toBeNull();
    }
    const date = body.items.map((h) => h.effectiveAt);
    expect([...date].sort().reverse()).toEqual(date);
  });

  it("GET /v1/compensation/payout-curves espone la regola con cui il premio e' calcolato", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/payout-curves",
      headers: { cookie: ch(hr.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      total: number;
      items: Array<{ code: string; kind: string; payload: Record<string, unknown>; isGlobal: boolean }>;
    };
    const src = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_payout_curves
        WHERE payout_curve_is_global = true
           OR payout_curve_tenant_id = (SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1)`,
      [hr.userId]);
    expect(body.total).toBe(Number(src.rows[0]!.n));

    // la curva del tenant di chi chiama E' esposta: sostituisce il vecchio
    // toBeGreaterThan(0), che dipendeva dal popolamento storia36 e cadeva a zero
    // sul clone CI. Questa asserzione regge con e senza il programma.
    const mia = body.items.find((c) => c.code === CODICE_CURVA);
    expect(mia).toBeDefined();
    expect(mia!.isGlobal).toBe(false);
    expect(mia!.payload).toEqual({ min: 0, max: 1.2 });

    for (const c of body.items) {
      expect(c.code.length).toBeGreaterThan(0);
      // il payload E' la curva: una curva vuota non spiega nessun importo
      expect(Object.keys(c.payload).length).toBeGreaterThan(0);
    }
  });

  it("i tre endpoint rifiutano il chiamante non autenticato", async () => {
    for (const url of [
      "/v1/me/professional-experiences",
      `/v1/positions/${posizioneBersaglio}/skill-requirements/history`,
      "/v1/compensation/payout-curves",
    ]) {
      const r = await suite.app.inject({ method: "GET", url });
      expect([401, 403]).toContain(r.statusCode);
    }
  });
});
