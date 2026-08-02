/**
 * apps/api/test/user-timeline.integration.test.ts — D5 (#49).
 *
 * La storia di una persona è dato PERSONALE e in parte retributivo
 * (SALARY_CHANGE / LEVEL_CHANGE / REVIEW_COMPLETED): passa dall'asse
 * ORGANIZZATIVO (I18), mai da quello funzionale. La propria storia è sempre
 * accessibile (I17, /v1/me/timeline).
 *
 * Ogni attesa è derivata dal DB vivo: nessun conteggio scritto a mano.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { orgSubtreeUserIds } from "../src/lib/scope/org.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let federica: S;   // TENANT_ADMIN — mandato HR, vede tutto il tenant
let paolo: S;      // MANAGER — org-scoped sul proprio sotto-albero
let tommaso: S;    // USER — nessun timeline:read, solo la propria storia
let tommasoUserId: string;
let paoloSubtree: string[];

describe("/v1/user-timeline + /v1/me/timeline (D5 #49)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org");

    const u = await pool.query<{ id: string }>(
      `SELECT user_id AS id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      ["tommaso.fiore@rtl-bank.org"],
    );
    tommasoUserId = u.rows[0]!.id;

    const p = await pool.query<{ id: string }>(
      `SELECT user_id AS id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      ["paolo.caputo@rtl-bank.org"],
    );
    paoloSubtree = await orgSubtreeUserIds(pool, p.rows[0]!.id);
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("lists the imported history — the count matches the table", async () => {
    const live = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_user_timeline_events t
         JOIN sys.sys_users u ON u.user_id = t.user_timeline_event_user_id
        WHERE u.user_tenant_id = (SELECT user_tenant_id FROM sys.sys_users
                                   WHERE lower(user_email) = lower('federica.marchetti@rtl-bank.org'))`,
    );
    const r = await suite.app.inject({
      method: "GET", url: "/v1/user-timeline?limit=1",
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(Number(live.rows[0]!.n));
    expect(body.total).toBeGreaterThan(0);
  });

  it("returns events newest-first, with the fields the timeline needs", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/user-timeline?limit=25",
      headers: { cookie: ch(federica.cookies) },
    });
    const body = r.json() as {
      items: Array<{ type: string; occurredAt: string; summary: string | null; payload: Record<string, unknown> }>;
    };
    expect(body.items.length).toBeGreaterThan(1);
    for (let i = 1; i < body.items.length; i++) {
      expect(new Date(body.items[i - 1]!.occurredAt).getTime())
        .toBeGreaterThanOrEqual(new Date(body.items[i]!.occurredAt).getTime());
    }
    // il tipo legacy resta nel payload: il fatto e' ricostruibile
    expect(body.items[0]!.payload).toHaveProperty("legacy_event_type");
  });

  it("filters by type, and the filtered count matches the summary", async () => {
    const summary = await suite.app.inject({
      method: "GET", url: "/v1/user-timeline/summary",
      headers: { cookie: ch(federica.cookies) },
    });
    const s = summary.json() as { items: Array<{ type: string; count: number }>; total: number };
    expect(s.items.length).toBeGreaterThan(0);
    const first = s.items[0]!;

    const filtered = await suite.app.inject({
      method: "GET", url: `/v1/user-timeline?type=${first.type}&limit=1`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect((filtered.json() as { total: number }).total).toBe(first.count);
  });

  it("the date window excludes what falls outside it", async () => {
    const s = await suite.app.inject({
      method: "GET", url: "/v1/user-timeline/summary",
      headers: { cookie: ch(federica.cookies) },
    });
    const bounds = s.json() as { firstEventAt: string; lastEventAt: string; total: number };

    // Una finestra che parte dopo l'ultimo evento non può contenere nulla.
    const dopoLaFine = new Date(new Date(bounds.lastEventAt).getTime() + 86_400_000).toISOString();
    const vuota = await suite.app.inject({
      method: "GET", url: `/v1/user-timeline?from=${dopoLaFine}&limit=1`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect((vuota.json() as { total: number }).total).toBe(0);

    // Una finestra che li abbraccia tutti li contiene tutti.
    //
    // Gli estremi sono allargati di un giorno di proposito. `occurredAt` esce in
    // ISO 8601, che si ferma ai millisecondi, mentre PostgreSQL tiene i
    // microsecondi: rimandare indietro `lastEventAt` COSÌ COM'È come estremo
    // superiore taglierebbe fuori gli eventi il cui istante ha microsecondi
    // oltre il millesimo (misurato: 10 righe su 2664). Nessuna interfaccia
    // filtra una storia al microsecondo — si filtra per giorni — ma chi scrive
    // un client deve saperlo, ed è per questo che sta scritto qui.
    const unGiornoPrima = new Date(new Date(bounds.firstEventAt).getTime() - 86_400_000).toISOString();
    const unGiornoDopo = new Date(new Date(bounds.lastEventAt).getTime() + 86_400_000).toISOString();
    const tutta = await suite.app.inject({
      method: "GET", url: `/v1/user-timeline?from=${unGiornoPrima}&to=${unGiornoDopo}&limit=1`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect((tutta.json() as { total: number }).total).toBe(bounds.total);

    // Controprova: una finestra stretta attorno al solo giorno più recente
    // contiene qualcosa, ma meno del totale.
    const ultimoGiorno = bounds.lastEventAt.slice(0, 10);
    const soloUltimo = await suite.app.inject({
      method: "GET", url: `/v1/user-timeline?from=${ultimoGiorno}T00:00:00Z&limit=1`,
      headers: { cookie: ch(federica.cookies) },
    });
    const n = (soloUltimo.json() as { total: number }).total;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(bounds.total);
  });

  it("a MANAGER sees only their own org sub-tree", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/user-timeline?limit=200",
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ userId: string }>; total: number };
    // Ogni riga restituita appartiene a una persona del suo sotto-albero.
    const fuori = body.items.filter((i) => !paoloSubtree.includes(i.userId));
    expect(fuori).toHaveLength(0);

    // e vede MENO di chi ha il mandato sul tenant: senza questo confronto il
    // test passerebbe anche se il cancello lasciasse passare tutto.
    const tenantWide = await suite.app.inject({
      method: "GET", url: "/v1/user-timeline?limit=1",
      headers: { cookie: ch(federica.cookies) },
    });
    expect(body.total).toBeLessThan((tenantWide.json() as { total: number }).total);
  });

  it("a USER has no timeline:read at all", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/user-timeline",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("but everyone can read their OWN history (I17)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/timeline?limit=200",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ userId: string }>; total: number };
    // Solo la propria: nemmeno una riga di qualcun altro.
    for (const i of body.items) expect(i.userId).toBe(tommasoUserId);

    const live = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_user_timeline_events WHERE user_timeline_event_user_id = $1`,
      [tommasoUserId],
    );
    expect(body.total).toBe(Number(live.rows[0]!.n));
  });

  it("the own-summary agrees with the own-list", async () => {
    const list = await suite.app.inject({
      method: "GET", url: "/v1/me/timeline?limit=1",
      headers: { cookie: ch(tommaso.cookies) },
    });
    const summary = await suite.app.inject({
      method: "GET", url: "/v1/me/timeline/summary",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(summary.statusCode).toBe(200);
    expect((summary.json() as { total: number }).total).toBe((list.json() as { total: number }).total);
  });

  it("asking for someone else's history through the userId filter respects the gate", async () => {
    // paolo chiede esplicitamente una persona FUORI dal suo sotto-albero:
    // il filtro non deve poter scavalcare il cancello.
    const fuori = await pool.query<{ id: string }>(
      `SELECT DISTINCT user_timeline_event_user_id AS id FROM sys.sys_user_timeline_events
        WHERE NOT (user_timeline_event_user_id = ANY($1::uuid[])) LIMIT 1`,
      [paoloSubtree],
    );
    if (fuori.rowCount === 0) return;
    const r = await suite.app.inject({
      method: "GET", url: `/v1/user-timeline?userId=${fuori.rows[0]!.id}&limit=10`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(0);
  });
});
