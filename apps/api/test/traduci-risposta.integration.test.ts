/**
 * Traduzione del dato nella risposta (ADR-0062) sul database vero.
 * Le attese si ricavano dal database (registro + sys_reference_translations), mai scritte a mano.
 * L'app di prova monta solo cookie, lingua e hook, con una rotta che restituisce un testo
 * italiano come lo restituirebbe un join di un modulo qualunque.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { pool, closePool } from "../src/db/client.js";
import { localePlugin } from "../src/middleware/locale.js";
import { addTraduzioneRisposta, costruisciGlossario, rovescia } from "../src/lib/i18n/traduci-risposta.js";

let app: FastifyInstance;
let it0 = "";
let en0 = "";
let itR = "";
let enR = "";
let ricevuto: unknown = null;

describe("traduzione del dato nella risposta", () => {
  beforeAll(async () => {
    const g = await costruisciGlossario(pool);
    const primo = [...g.entries()].sort(([a], [b]) => a.localeCompare(b))[0];
    if (!primo) throw new Error("glossario vuoto: nessuna traduzione inglese per i campi registrati");
    [it0, en0] = primo;
    const ritorno = [...rovescia(g).entries()].sort(([a], [b]) => a.localeCompare(b))[0];
    if (!ritorno) throw new Error("nessuna traduzione che torni a un testo italiano solo");
    [enR, itR] = ritorno;
    app = Fastify();
    await app.register(cookie);
    await app.register(localePlugin);
    addTraduzioneRisposta(app, pool);
    app.get("/v1/prova", async () => ({ items: [{ id: it0, name: it0, owner: "Rossi, Mario" }] }));
    app.post("/v1/prova", async () => ({ name: it0 }));
    // Il corpo arrivato all'handler si guarda da qui, non si rimanda nella risposta.
    app.patch("/v1/eco", async (req, reply) => {
      ricevuto = req.body;
      return reply.code(204).send();
    });
    app.patch("/v1/riga/:id", async (req, reply) => {
      ricevuto = req.body;
      return reply.code(204).send();
    });
    app.put("/v1/negata/:id", async (_req, reply) => reply.code(403).send({ error: { code: "FORBIDDEN", message: "no" } }));
    app.post("/v1/auth/eco", async (req, reply) => {
      ricevuto = req.body;
      return reply.code(204).send();
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closePool();
  });

  it("il glossario corrisponde a una traduzione registrata nel database", async () => {
    const r = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_reference_translations WHERE locale = 'en' AND text = $1`,
      [en0],
    );
    expect(Number(r.rows[0]?.n)).toBeGreaterThan(0);
    expect(en0).not.toBe(it0);
  });

  it("in inglese il testo italiano diventa la sua traduzione; id e nomi di persona no", async () => {
    const r = await app.inject({ method: "GET", url: "/v1/prova", cookies: { NEXT_LOCALE: "en" } });
    expect(r.json()).toEqual({ items: [{ id: it0, name: en0, owner: "Rossi, Mario" }] });
  });

  it("in italiano, con x-localize: off e fuori dalle letture la risposta non cambia", async () => {
    const itR = await app.inject({ method: "GET", url: "/v1/prova", cookies: { NEXT_LOCALE: "it" } });
    expect(itR.json().items[0].name).toBe(it0);
    const off = await app.inject({ method: "GET", url: "/v1/prova", cookies: { NEXT_LOCALE: "en" }, headers: { "x-localize": "off" } });
    expect(off.json().items[0].name).toBe(it0);
    const post = await app.inject({ method: "POST", url: "/v1/prova", cookies: { NEXT_LOCALE: "en" } });
    expect(post.json().name).toBe(it0);
  });

  it("in inglese una scrittura riporta la traduzione all'italiano canonico; il resto passa com'è", async () => {
    const corpo = { name: enR, id: enR, title: "A brand new English title written on purpose", note: "Testo nuovo scritto dalla persona", n: 3 };
    await app.inject({ method: "PATCH", url: "/v1/eco", cookies: { NEXT_LOCALE: "en" }, payload: corpo });
    expect(ricevuto).toEqual({ ...corpo, name: itR });
    await app.inject({ method: "PATCH", url: "/v1/eco", cookies: { NEXT_LOCALE: "it" }, payload: corpo });
    expect(ricevuto).toEqual(corpo);
    await app.inject({ method: "PATCH", url: "/v1/eco", cookies: { NEXT_LOCALE: "en" }, headers: { "x-localize": "off" }, payload: corpo });
    expect(ricevuto).toEqual(corpo);
  });

  it("le rotte di accesso non ricevono il ritorno: il corpo arriva com'è", async () => {
    const corpo = { name: enR };
    await app.inject({ method: "POST", url: "/v1/auth/eco", cookies: { NEXT_LOCALE: "en" }, payload: corpo });
    expect(ricevuto).toEqual(corpo);
  });

  it("una modifica fatta in inglese va nella traduzione inglese e l'italiano della riga resta", async () => {
    const r = await pool.query<{ entity_table: string; entity_id: string; field: string; it: string; en: string }>(
      `SELECT x.entity_table, x.entity_id::text, x.field, s.skill_name AS it, x.text AS en
         FROM sys.sys_reference_translations x
         JOIN sys.sys_skills s ON s.skill_id = x.entity_id
        WHERE x.entity_table = 'sys_skills' AND x.field = 'name' AND x.locale = 'en'
        ORDER BY x.entity_id LIMIT 1`,
    );
    const riga = r.rows[0];
    if (!riga) throw new Error("nessuna competenza con traduzione inglese del nome");
    const nuovo = `${riga.en} (edited in English)`;
    // invariato: torna all'italiano, nessuna traduzione cambia
    await app.inject({ method: "PATCH", url: `/v1/riga/${riga.entity_id}`, cookies: { NEXT_LOCALE: "en" }, payload: { name: riga.en } });
    expect(ricevuto).toEqual({ name: riga.it });
    // negata: niente traduzione scritta
    await app.inject({ method: "PUT", url: `/v1/negata/${riga.entity_id}`, cookies: { NEXT_LOCALE: "en" }, payload: { name: `${nuovo} (denied)` } });
    await new Promise((ok) => setTimeout(ok, 300));
    const dopoNegata = await pool.query<{ text: string }>(
      `SELECT text FROM sys.sys_reference_translations
        WHERE entity_table = 'sys_skills' AND entity_id = $1::uuid AND field = 'name' AND locale = 'en'`,
      [riga.entity_id],
    );
    expect(dopoNegata.rows[0]?.text).toBe(riga.en);
    // cambiato: l'italiano resta nel corpo, l'inglese nuovo va nella traduzione dopo la risposta
    await app.inject({ method: "PATCH", url: `/v1/riga/${riga.entity_id}`, cookies: { NEXT_LOCALE: "en" }, payload: { name: nuovo } });
    expect(ricevuto).toEqual({ name: riga.it });
    let letto = "";
    for (let i = 0; i < 40 && letto !== nuovo; i++) {
      const t = await pool.query<{ text: string; source: string }>(
        `SELECT text, source FROM sys.sys_reference_translations
          WHERE entity_table = 'sys_skills' AND entity_id = $1::uuid AND field = 'name' AND locale = 'en'`,
        [riga.entity_id],
      );
      letto = t.rows[0]?.text ?? "";
      if (letto === nuovo) expect(t.rows[0]?.source).toBe("MANUAL");
      else await new Promise((ok) => setTimeout(ok, 50));
    }
    expect(letto).toBe(nuovo);
    const italiano = await pool.query<{ n: string }>(`SELECT skill_name AS n FROM sys.sys_skills WHERE skill_id = $1::uuid`, [riga.entity_id]);
    expect(italiano.rows[0]?.n).toBe(riga.it);
  });
});
