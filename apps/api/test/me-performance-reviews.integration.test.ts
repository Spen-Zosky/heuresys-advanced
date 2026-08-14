/**
 * apps/api/test/me-performance-reviews.integration.test.ts — #92 F5.
 *
 * LE PROPRIE VALUTAZIONI, E LA FINESTRA CHE LE RENDE LEGGIBILI.
 *
 * `GET /v1/me/performance` esisteva gia' (F3a) e mostrava **tutte** le valutazioni del
 * soggetto. ADR-0036 §5 elenca pero' fra le quattro eccezioni le **valutazioni non
 * comunicate**, e ne fissa il criterio: `review_shared_at` oppure `review_acknowledged_at`.
 * Una valutazione scritta ma non ancora consegnata non e' un dato che la persona possa
 * leggere dall'area personale — sarebbe scavalcare il colloquio in cui gliela si dice.
 *
 * IL CASO LIMITE ESISTE DAVVERO, ed e' piu' severo di come l'avevo letto. Misurando in
 * fretta avevo concluso «una persona con 2 valutazioni, nessuna comunicata»: contavo solo
 * le righe non comunicate. Quella persona ne ha **quattro**, di cui **due comunicate** —
 * cioe' un MISTO. Meglio cosi': il filtro non deve separare persone da persone, deve
 * separare righe DENTRO la stessa persona, che e' esattamente dove un errore passerebbe
 * inosservato. Gli attori si derivano dal dato di oggi, mai scritti a mano.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

interface Attore { email: string; comunicate: number; totali: number }

let t: TestApp;
/** Chi ha valutazioni COMUNICATE e NON comunicate insieme: deve vedere solo le prime. */
let misto: Attore | undefined;
/** Chi ha almeno una valutazione comunicata: deve vederle. */
let conComunicazione: Attore | undefined;

async function attori(): Promise<{ misto?: Attore; con?: Attore }> {
  const r = await pool.query<{ email: string; comunicate: string; totali: string }>(
    `SELECT u.user_email AS email,
            count(*) FILTER (WHERE r.review_shared_at IS NOT NULL
                                OR r.review_acknowledged_at IS NOT NULL)::text AS comunicate,
            count(*)::text AS totali
       FROM sys.sys_performance_reviews r
       JOIN sys.sys_users u ON u.user_id = r.review_subject_user_id
      WHERE u.user_status = 'ACTIVE'
      GROUP BY u.user_email
      ORDER BY u.user_email`,
  );
  const righe = r.rows.map((x) => ({
    email: x.email, comunicate: Number(x.comunicate), totali: Number(x.totali),
  }));
  return {
    misto: righe.find((x) => x.comunicate > 0 && x.totali > x.comunicate),
    con: righe.find((x) => x.comunicate > 0),
  };
}

async function cookieDi(email: string): Promise<string> {
  const r = await loginRaw(t.app, email);
  return r.cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ");
}

beforeAll(async () => {
  t = await buildTestApp();
  const a = await attori();
  misto = a.misto;
  conComunicazione = a.con;
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#92 F5 — /v1/me/performance: le proprie valutazioni", () => {
  it("gira su un universo dove PUÒ fallire: esiste chi ha valutazioni comunicate E non comunicate", () => {
    if (!misto) {
      throw new Error(
        "Nessuna persona con valutazioni sia comunicate sia non comunicate: il filtro " +
          "non ha controesempi e questa verifica sarebbe cieca. Va dichiarato, non ignorato.",
      );
    }
    expect(misto.totali).toBeGreaterThan(misto.comunicate);
    expect(misto.comunicate).toBeGreaterThan(0);
  });

  it("chi ha un MISTO vede solo le comunicate — il filtro separa dentro la stessa persona", async () => {
    const r = await t.app.inject({
      method: "GET",
      url: "/v1/me/performance",
      headers: { cookie: await cookieDi(misto!.email) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    // Le altre esistono nel database ma non gli sono state consegnate: l'area personale
    // non è il posto dove scoprirle prima del colloquio.
    expect(body.total).toBe(misto!.comunicate);
    expect(body.items.length).toBe(misto!.comunicate);
    expect(body.total).toBeLessThan(misto!.totali);
  });

  it("chi ha valutazioni comunicate le vede — e sono esattamente quelle comunicate", async () => {
    const r = await t.app.inject({
      method: "GET",
      url: "/v1/me/performance",
      headers: { cookie: await cookieDi(conComunicazione!.email) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ periodEnd: string | null }>; total: number };
    expect(body.total).toBe(conComunicazione!.comunicate);
    expect(body.items.length).toBe(conComunicazione!.comunicate);
  });

  it("l'ordine è dal più recente: la valutazione di quest'anno sta in cima", async () => {
    const r = await t.app.inject({
      method: "GET",
      url: "/v1/me/performance",
      headers: { cookie: await cookieDi(conComunicazione!.email) },
    });
    const items = (r.json() as { items: Array<{ periodEnd: string | null }> }).items;
    if (items.length < 2) return; // niente da ordinare: non è un fallimento
    const date = items.map((x) => x.periodEnd ?? "");
    expect(date).toEqual([...date].sort().reverse());
  });

  it("senza autenticazione non si legge nulla", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/me/performance" });
    expect(r.statusCode).toBe(401);
  });
});
