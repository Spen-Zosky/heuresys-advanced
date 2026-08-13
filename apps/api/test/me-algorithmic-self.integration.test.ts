/**
 * apps/api/test/me-algorithmic-self.integration.test.ts
 * Ciò che un algoritmo dice di me, e che fino a ieri non potevo vedere:
 * /v1/me/predictions · /v1/me/mentor-matches · /v1/me/pulse-checks
 *
 * #126 — Enzo, 2026-08-04: le predizioni e gli abbinamenti mentore sono VISIBILI
 * all'interessato; successioni e raccomandazioni retributive no (quelle restano fra
 * le esclusioni motivate del cancello di #117, categoria [PIANO]).
 * Enzo, 2026-08-13: anche le rilevazioni che la persona ha scritto di suo pugno.
 *
 * IL CONFINE CHE QUESTI TEST PRESIDIANO, e che è la parte facile da sbagliare:
 * `sys_mentor_match_scores` ha DUE lati. Dal lato allievo è «con chi mi conviene
 * imparare»; dal lato mentore è una graduatoria di persone assegnate a me, con
 * punteggio. Il primo è dato dell'interessato, il secondo no — e la differenza sta
 * in quale colonna si filtra.
 *
 * Gli attesi si ricavano dal database vivo: nessun numero cablato qui dentro.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { passwordFor } from "./helpers/personas.js";

interface Sess { cookies: Map<string, string>; userId: string }
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Sess> {
  const r = await loginRaw(t.app, email, passwordFor(email));
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const b = r.json() as { user: { userId: string } };
  return { cookies, userId: b.user.userId };
}
async function uno<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const { rows } = await pool.query<T>(sql, params);
  return rows[0];
}

let suite: TestApp;
let emailConPredizioni = "";
let predizioniAttese = 0;
let emailAllievo = "";
let abbinamentiAttesi = 0;
let emailConPulse = "";
let pulseAttesi = 0;

describe("/v1/me — ciò che un algoritmo dice di me (#126)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const p = await uno<{ email: string; n: string }>(
      `SELECT u.user_email AS email, count(*)::text AS n
         FROM sys.sys_model_predictions p
         JOIN sys.sys_users u ON u.user_id = p.prediction_subject_user_id
        GROUP BY 1 ORDER BY count(*) DESC, u.user_email LIMIT 1`);
    emailConPredizioni = p?.email ?? ""; predizioniAttese = Number(p?.n ?? 0);

    const m = await uno<{ email: string; n: string }>(
      `SELECT u.user_email AS email, count(*)::text AS n
         FROM sys.sys_mentor_match_scores mm
         JOIN sys.sys_users u ON u.user_id = mm.match_mentee_user_id
        GROUP BY 1 ORDER BY count(*) DESC, u.user_email LIMIT 1`);
    emailAllievo = m?.email ?? ""; abbinamentiAttesi = Number(m?.n ?? 0);

    const pc = await uno<{ email: string; n: string }>(
      `SELECT u.user_email AS email, count(*)::text AS n
         FROM sys.sys_pulse_checks c
         JOIN sys.sys_users u ON u.user_id = c.pulse_check_subject_user_id
        GROUP BY 1 ORDER BY count(*) DESC, u.user_email LIMIT 1`);
    emailConPulse = pc?.email ?? ""; pulseAttesi = Number(pc?.n ?? 0);
  });

  afterAll(async () => { await suite?.app.close(); await closePool(); });

  it("l'universo di prova non è degenere", () => {
    // Senza questa guardia, un database svuotato renderebbe verdi tutte le asserzioni
    // «la persona vede N righe» con N = 0.
    expect(predizioniAttese).toBeGreaterThan(0);
    expect(abbinamentiAttesi).toBeGreaterThan(0);
    expect(pulseAttesi).toBeGreaterThan(0);
  });

  it("vedo le predizioni calcolate su di me, col modello che le ha prodotte", async () => {
    const s = await login(suite, emailConPredizioni);
    const res = await suite.app.inject({
      method: "GET", url: "/v1/me/predictions", headers: { cookie: ch(s.cookies) },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json() as {
      total: number;
      items: { type: string; value: number | null; modelName: string | null; computedAt: string | null }[];
    };
    expect(b.total).toBe(predizioniAttese);
    // Il punteggio non esce nudo: la data esce sempre, e il posto per il modello c'è
    // nel contratto. Che oggi il modello sia vuoto NON e' una scelta di questa rotta:
    // e' un difetto del DATO, misurato il 2026-08-13 — tutte le 468 predizioni hanno
    // `prediction_model_id` NULL, mentre in `sys_predictive_models` i modelli sono 4 e
    // attivi. Registrato come debito; qui si asserisce il contratto, non si cementa il
    // buco (se un giorno il collegamento tornera', questa riga restera' vera).
    expect(b.items.every((i) => "modelName" in i)).toBe(true);
    expect(b.items.every((i) => i.computedAt !== null)).toBe(true);
  });

  it("le predizioni su di me sono SOLO mie: il totale coincide con quello del database", async () => {
    const s = await login(suite, emailConPredizioni);
    const res = await suite.app.inject({
      method: "GET", url: "/v1/me/predictions", headers: { cookie: ch(s.cookies) },
    });
    const b = res.json() as { total: number };
    const tot = await uno<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_model_predictions WHERE prediction_subject_user_id = $1`,
      [s.userId]);
    expect(b.total).toBe(Number(tot?.n ?? -1));
    // e non è il totale di tutti: se lo fosse, la rotta perderebbe i dati di 155 persone
    const globale = await uno<{ n: string }>(`SELECT count(*)::text AS n FROM sys.sys_model_predictions`);
    expect(b.total).toBeLessThan(Number(globale?.n ?? 0));
  });

  it("come allievo vedo i miei abbinamenti; il lato mentore resta chiuso", async () => {
    // Questo test e' stato riscritto dopo che un sabotaggio NON lo ha fatto fallire:
    // filtrando sul lato sbagliato restava verde. La causa sta nel dato — chi compare
    // come allievo compare anche come mentore, ed esattamente UNA volta per parte, quindi
    // CONTARE le righe non distingue i due lati. Si confrontano le identita', non i totali.
    const s = await login(suite, emailAllievo);
    const res = await suite.app.inject({
      method: "GET", url: "/v1/me/mentor-matches", headers: { cookie: ch(s.cookies) },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json() as { total: number; items: { matchId: string }[] };
    expect(b.total).toBe(abbinamentiAttesi);

    const { rows: daAllievo } = await pool.query<{ id: string }>(
      `SELECT match_id AS id FROM sys.sys_mentor_match_scores WHERE match_mentee_user_id = $1`,
      [s.userId]);
    const { rows: daMentore } = await pool.query<{ id: string }>(
      `SELECT match_id AS id FROM sys.sys_mentor_match_scores WHERE match_mentor_user_id = $1`,
      [s.userId]);
    const restituiti = new Set(b.items.map((i) => i.matchId));
    const attesi = new Set(daAllievo.map((r) => r.id));
    const vietati = new Set(daMentore.map((r) => r.id));

    // La persona di prova deve stare su ENTRAMBI i lati, altrimenti la prova non prova
    // nulla: senza righe da mentore, filtrare sulla colonna sbagliata sarebbe invisibile.
    expect(vietati.size).toBeGreaterThan(0);
    expect([...attesi].some((id) => !vietati.has(id))).toBe(true);

    expect([...restituiti].sort()).toEqual([...attesi].sort());
    for (const id of restituiti) expect(vietati.has(id)).toBe(false);

    // La posizione in classifica e l'identificativo del mentore non escono dal contratto.
    for (const i of b.items as unknown as Record<string, unknown>[]) {
      expect(i).not.toHaveProperty("recommendationRank");
      expect(i).not.toHaveProperty("mentorUserId");
    }
  });

  it("rileggo le rilevazioni che ho scritto io", async () => {
    const s = await login(suite, emailConPulse);
    const res = await suite.app.inject({
      method: "GET", url: "/v1/me/pulse-checks", headers: { cookie: ch(s.cookies) },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json() as { total: number; items: { moodScore: number | null }[] };
    expect(b.total).toBe(pulseAttesi);
    expect(b.items.length).toBe(pulseAttesi);
  });

  it("senza sessione le tre rotte non rispondono", async () => {
    for (const url of ["/v1/me/predictions", "/v1/me/mentor-matches", "/v1/me/pulse-checks"]) {
      const res = await suite.app.inject({ method: "GET", url });
      expect([401, 403]).toContain(res.statusCode);
    }
  });
});
