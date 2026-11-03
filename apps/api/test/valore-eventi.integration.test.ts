/**
 * apps/api/test/valore-eventi.integration.test.ts — F0-3, il test del valore come misura.
 *
 * Prova dal vivo, sulle persone vere di RTL, che una decisione presa da una pagina o da un
 * agente entra nel registro `audit.valore_eventi` con chi, che cosa, su quale oggetto e da
 * dove; che la stessa decisione senza superficie si registra ma NON è tracciabile; che l'uso
 * di una pagina si conta una volta per ora; e che `sys.v_valore_settimana` la restituisce per
 * tenant e per settimana. Ultima prova: ogni rotta del catalogo esiste davvero nell'API, perché
 * una rotta scritta male nel catalogo non conterebbe mai niente e nessuno se ne accorgerebbe.
 *
 * Isolamento D-52: tutto ciò che il file scrive viene annullato alla fine.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { HTTPMethods } from "fastify";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const FEDERICA = "federica.marchetti@rtl-bank.org"; // TENANT_ADMIN di RTL
const PFX = `IT_VAL_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface Evento {
  tipo: string; attore: string; attore_tipo: string; tenant: string;
  superficie_tipo: string; superficie: string | null; codice: string | null;
  oggetto_tipo: string | null; oggetto_id: string | null;
}

/** onResponse gira dopo l'invio: si aspetta la riga invece di supporla già scritta. */
async function attendiEventi(sql: string, args: unknown[], attese: number): Promise<Evento[]> {
  for (let i = 0; i < 40; i++) {
    const r = await pool.query<Evento>(sql, args);
    if (r.rows.length >= attese) return r.rows;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  return (await pool.query<Evento>(sql, args)).rows;
}

const SQL_DECISIONE = `
  SELECT valore_evento_tipo AS tipo, valore_evento_attore_user_id::text AS attore,
         valore_evento_attore_tipo AS attore_tipo, valore_evento_tenant_id::text AS tenant,
         valore_evento_superficie_tipo AS superficie_tipo, valore_evento_superficie AS superficie,
         valore_evento_decisione_codice AS codice, valore_evento_oggetto_tipo AS oggetto_tipo,
         valore_evento_oggetto_id AS oggetto_id
    FROM audit.valore_eventi
   WHERE valore_evento_tipo = 'decisione' AND valore_evento_oggetto_id = $1`;

let suite: TestApp;
let federica: S;
let federicaId: string;
let tenantId: string;
let soggettoId: string;

async function nuovoObiettivo(titolo: string, superficie?: string): Promise<string> {
  const headers: Record<string, string> = {
    cookie: ch(federica.cookies), "x-csrf-token": federica.csrfToken, "content-type": "application/json",
  };
  if (superficie) headers["x-heuresys-superficie"] = superficie;
  const r = await suite.app.inject({
    method: "POST", url: "/v1/goals", headers,
    payload: { title: `${PFX} ${titolo}`, subjectUserId: soggettoId, type: "INDIVIDUAL" },
  });
  expect(r.statusCode).toBe(201);
  return (r.json() as { goalId: string }).goalId;
}

describe("F0-3 — il test del valore: decisioni tracciabili per tenant e per settimana", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    federica = await login(suite, FEDERICA);
    const u = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users WHERE user_email = $1`, [FEDERICA]);
    federicaId = u.rows[0]!.user_id;
    tenantId = u.rows[0]!.user_tenant_id;
    const s = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users
        WHERE user_tenant_id = $1 AND user_id <> $2 AND user_email LIKE '%@rtl-bank.org'
        ORDER BY user_email LIMIT 1`, [tenantId, federicaId]);
    soggettoId = s.rows[0]!.user_id;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("una decisione presa da una pagina è registrata con chi, che cosa, su che cosa e da dove", async () => {
    const goalId = await nuovoObiettivo("da pagina", "pagina:/goals");
    const [e] = await attendiEventi(SQL_DECISIONE, [goalId], 1);
    expect(e).toMatchObject({
      tipo: "decisione", attore: federicaId, attore_tipo: "persona", tenant: tenantId,
      superficie_tipo: "pagina", superficie: "/goals", codice: "obiettivo_assegnato",
      oggetto_tipo: "obiettivo", oggetto_id: goalId,
    });
    const t = await pool.query(`SELECT 1 FROM sys.v_valore_decisioni_tracciabili WHERE oggetto_id = $1`, [goalId]);
    expect(t.rowCount).toBe(1);
  });

  it("la stessa decisione presa da un agente si conta come agente, e l'attore resta la persona", async () => {
    const goalId = await nuovoObiettivo("da agente", "agente:assistente-hr");
    const [e] = await attendiEventi(SQL_DECISIONE, [goalId], 1);
    expect(e).toMatchObject({ attore: federicaId, attore_tipo: "agente", superficie_tipo: "agente", superficie: "assistente-hr" });
  });

  it("senza superficie la decisione si registra ma non è tracciabile; una superficie malformata vale come assente", async () => {
    const senza = await nuovoObiettivo("senza superficie");
    const malformata = await nuovoObiettivo("superficie malformata", "script:import");
    for (const id of [senza, malformata]) {
      const [e] = await attendiEventi(SQL_DECISIONE, [id], 1);
      expect(e).toMatchObject({ superficie_tipo: "api", superficie: null, codice: "obiettivo_assegnato" });
      const t = await pool.query(`SELECT 1 FROM sys.v_valore_decisioni_tracciabili WHERE oggetto_id = $1`, [id]);
      expect(t.rowCount).toBe(0);
    }
  });

  it("una richiesta respinta non è una decisione", async () => {
    const prima = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM audit.valore_eventi`);
    const r = await suite.app.inject({
      method: "POST", url: "/v1/goals",
      headers: { cookie: ch(federica.cookies), "x-csrf-token": federica.csrfToken, "content-type": "application/json", "x-heuresys-superficie": "pagina:/goals" },
      payload: { title: "" },
    });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
    await new Promise((ok) => setTimeout(ok, 300));
    const dopo = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM audit.valore_eventi`);
    expect(dopo.rows[0]!.n).toBe(prima.rows[0]!.n);
  });

  it("l'uso di una pagina si conta una volta per persona, pagina e ora", async () => {
    const pagina = `/goals/${PFX.toLowerCase()}`;
    for (let i = 0; i < 3; i++) {
      const r = await suite.app.inject({
        method: "GET", url: "/v1/goals?limit=1",
        headers: { cookie: ch(federica.cookies), "x-heuresys-superficie": `pagina:${pagina}` },
      });
      expect(r.statusCode).toBe(200);
    }
    const righe = await attendiEventi(
      `SELECT valore_evento_tipo AS tipo FROM audit.valore_eventi
        WHERE valore_evento_tipo = 'uso' AND valore_evento_attore_user_id = $1 AND valore_evento_superficie = $2`,
      [federicaId, pagina], 1);
    await new Promise((ok) => setTimeout(ok, 200));
    const di_nuovo = await pool.query(
      `SELECT 1 FROM audit.valore_eventi WHERE valore_evento_tipo = 'uso' AND valore_evento_superficie = $1`, [pagina]);
    expect(righe.length).toBe(1);
    expect(di_nuovo.rowCount).toBe(1);
  });

  it("la query per tenant e per settimana restituisce le decisioni tracciabili di RTL", async () => {
    const r = await pool.query<{ decisioni_tracciabili: number; da_persona: number; da_agente: number; decisioni_senza_traccia: number; persone_attive: number }>(
      `SELECT decisioni_tracciabili, da_persona, da_agente, decisioni_senza_traccia, persone_attive
         FROM sys.v_valore_settimana
        WHERE tenant_id = $1
          AND settimana = date_trunc('week', now() AT TIME ZONE 'Europe/Rome')::date`, [tenantId]);
    expect(r.rowCount).toBe(1);
    const s = r.rows[0]!;
    // almeno ciò che questo file ha scritto: una da pagina, una da agente, due senza traccia
    expect(s.decisioni_tracciabili).toBeGreaterThanOrEqual(2);
    expect(s.da_persona).toBeGreaterThanOrEqual(1);
    expect(s.da_agente).toBeGreaterThanOrEqual(1);
    expect(s.decisioni_senza_traccia).toBeGreaterThanOrEqual(2);
    expect(s.persone_attive).toBeGreaterThanOrEqual(1);
  });

  it("ogni rotta del catalogo esiste nell'API (una rotta sbagliata non conterebbe mai niente)", async () => {
    const r = await pool.query<{ metodo: string; rotta: string }>(
      `SELECT metodo, rotta FROM audit.valore_rotte_decisione ORDER BY rotta, metodo`);
    expect(r.rowCount).toBeGreaterThan(20);
    const mancanti = r.rows
      .filter((x) => !suite.app.hasRoute({ method: x.metodo as HTTPMethods, url: x.rotta }))
      .map((x) => `${x.metodo} ${x.rotta}`);
    expect(mancanti, "rotte del catalogo del valore che l'API non espone").toEqual([]);
  });
});
