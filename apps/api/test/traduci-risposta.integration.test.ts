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
});
