import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const E2E_DOMAIN = "@leads-it.test";

function cookieHeader(cookies: { name: string; value: string }[]) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

let suite: TestApp;
let adminCookies: string;
let adminCsrf: string;

beforeAll(async () => {
  suite = await buildTestApp();
  const r = await loginRaw(suite.app, "enzo.spenuso@heuresys.com", PWD);
  adminCookies = cookieHeader(r.cookies);
  adminCsrf = (r.json() as { csrfToken: string }).csrfToken;
  await pool.query(`DELETE FROM sys.sys_leads WHERE lead_email LIKE $1`, [`%${E2E_DOMAIN}`]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM sys.sys_leads WHERE lead_email LIKE $1`, [`%${E2E_DOMAIN}`]);
  await suite.app.close();
});

describe("/v1/leads (GTM lead capture)", () => {
  it("public POST stores a lead (no auth, no CSRF)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "Mario Rossi", company: "Banca X", email: `mario${E2E_DOMAIN}`, companySize: "250_2000", consent: true },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    const { rows } = await pool.query(`SELECT lead_consent_version FROM sys.sys_leads WHERE lead_email=$1`, [`mario${E2E_DOMAIN}`]);
    expect(rows.length).toBe(1);
    expect(rows[0].lead_consent_version).toBe("2026-06-21-v1");
  });

  it("honeypot-filled POST returns ok but stores nothing", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "Bot", company: "Spam", email: `bot${E2E_DOMAIN}`, consent: true, website: "http://spam" },
    });
    expect(r.statusCode).toBe(200);
    const { rows } = await pool.query(`SELECT 1 FROM sys.sys_leads WHERE lead_email=$1`, [`bot${E2E_DOMAIN}`]);
    expect(rows.length).toBe(0);
  });

  it("missing consent → 400", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "No Consent", company: "X", email: `nc${E2E_DOMAIN}` },
    });
    expect(r.statusCode).toBe(400);
  });

  it("GET as PLATFORM_ADMIN lists leads", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/leads", headers: { cookie: adminCookies, "x-csrf-token": adminCsrf } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { email: string }[]; total: number };
    expect(body.items.some((x) => x.email === `mario${E2E_DOMAIN}`)).toBe(true);
  });

  it("#62 G3 — GET filters (source, q) narrow the list; total = filtered count", async () => {
    // second lead with a distinct source to filter on
    const inv = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "Investor Lead", company: "Fund Y", email: `fund${E2E_DOMAIN}`, consent: true, source: "INVESTOR" },
    });
    expect(inv.statusCode).toBe(200);

    const bySource = await suite.app.inject({
      method: "GET", url: `/v1/leads?source=INVESTOR&q=${encodeURIComponent(E2E_DOMAIN)}`,
      headers: { cookie: adminCookies, "x-csrf-token": adminCsrf },
    });
    expect(bySource.statusCode).toBe(200);
    const b1 = bySource.json() as { items: { email: string; source: string }[]; total: number };
    expect(b1.items).toHaveLength(1);
    expect(b1.items[0]!.email).toBe(`fund${E2E_DOMAIN}`);
    expect(b1.total).toBe(1);

    // q alone matches both suite leads (mario + fund), any status
    const byQ = await suite.app.inject({
      method: "GET", url: `/v1/leads?q=${encodeURIComponent(E2E_DOMAIN)}`,
      headers: { cookie: adminCookies, "x-csrf-token": adminCsrf },
    });
    const b2 = byQ.json() as { items: unknown[]; total: number };
    expect(b2.total).toBe(2);
  });

  it("#62 G3 — GET pagination: limit slices, total stays the filtered count", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/leads?q=${encodeURIComponent(E2E_DOMAIN)}&limit=1&offset=0`,
      headers: { cookie: adminCookies, "x-csrf-token": adminCsrf },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(2); // filtered count, NOT page size

    const page2 = await suite.app.inject({
      method: "GET", url: `/v1/leads?q=${encodeURIComponent(E2E_DOMAIN)}&limit=1&offset=1`,
      headers: { cookie: adminCookies, "x-csrf-token": adminCsrf },
    });
    expect((page2.json() as { items: unknown[] }).items).toHaveLength(1);
  });

  it("GET without auth → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/leads" });
    expect(r.statusCode).toBe(401);
  });

  it("GET as a non-admin (MANAGER) → 403", async () => {
    const m = await loginRaw(suite.app, "paolo.caputo@rtl-bank.org", PWD);
    const managerCookies = cookieHeader(m.cookies);
    const managerCsrf = (m.json() as { csrfToken: string }).csrfToken;
    const r = await suite.app.inject({
      method: "GET", url: "/v1/leads",
      headers: { cookie: managerCookies, "x-csrf-token": managerCsrf },
    });
    expect(r.statusCode).toBe(403);
  });

  // Distinct remoteAddress per POST → separate per-IP rate-limit buckets, so these
  // extra submissions don't trip the 5/min cap shared by the earlier POSTs (the
  // production rate-limit is unchanged; only the test's source IP differs).
  it("public POST with source=INVESTOR stores INVESTOR", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads", remoteAddress: "10.10.0.1",
      payload: { name: "VC One", company: "Fund X", email: `vc${E2E_DOMAIN}`, source: "INVESTOR", consent: true },
    });
    expect(r.statusCode).toBe(200);
    const { rows } = await pool.query(`SELECT lead_source FROM sys.sys_leads WHERE lead_email=$1`, [`vc${E2E_DOMAIN}`]);
    expect(rows[0].lead_source).toBe("INVESTOR");
  });

  it("public POST without source defaults to WEBSITE", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads", remoteAddress: "10.10.0.2",
      payload: { name: "Web One", company: "Co", email: `web${E2E_DOMAIN}`, consent: true },
    });
    expect(r.statusCode).toBe(200);
    const { rows } = await pool.query(`SELECT lead_source FROM sys.sys_leads WHERE lead_email=$1`, [`web${E2E_DOMAIN}`]);
    expect(rows[0].lead_source).toBe("WEBSITE");
  });

  it("invalid source → 400", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads", remoteAddress: "10.10.0.3",
      payload: { name: "Bad", company: "Co", email: `bad${E2E_DOMAIN}`, source: "HACKER", consent: true },
    });
    expect(r.statusCode).toBe(400);
  });

  // #4 W4 — avanzamento dello stato. Prima esisteva la colonna e nessuna superficie
  // sapeva cambiarla: ogni lead restava NEW per sempre.
  describe("PATCH /v1/leads/:leadId — avanzamento dello stato", () => {
    // Le fixture nascono con una INSERT diretta, non dal form pubblico: quello ha un
    // limite di 5 invii al minuto per IP (giustamente), e sei fixture di fila lo
    // farebbero scattare — il test fallirebbe per 429 raccontando un difetto che non c'è.
    async function createLead(email: string): Promise<string> {
      const { rows } = await pool.query<{ lead_id: string }>(
        `INSERT INTO sys.sys_leads
           (lead_name, lead_company, lead_email, lead_source, lead_status,
            lead_consent_at, lead_consent_version)
         VALUES ('Stato Test', 'Banca Y', $1, 'WEBSITE', 'NEW', now(), '2026-06-21-v1')
         RETURNING lead_id`,
        [email],
      );
      return rows[0]!.lead_id;
    }

    it("un amministratore fa avanzare lo stato e la lettura successiva lo conferma", async () => {
      const id = await createLead(`patch${E2E_DOMAIN}`);
      const before = await pool.query<{ s: string }>(
        `SELECT lead_status AS s FROM sys.sys_leads WHERE lead_id = $1`, [id],
      );
      expect(before.rows[0]!.s).toBe("NEW"); // il valore di partenza è quello del prodotto

      const r = await suite.app.inject({
        method: "PATCH", url: `/v1/leads/${id}`,
        headers: { cookie: adminCookies, "x-csrf-token": adminCsrf, "content-type": "application/json" },
        payload: { status: "CONTACTED" },
      });
      expect(r.statusCode).toBe(200);
      expect((r.json() as { status: string }).status).toBe("CONTACTED");

      // Ri-letto dal database, non creduto sulla parola della risposta.
      const after = await pool.query<{ s: string }>(
        `SELECT lead_status AS s FROM sys.sys_leads WHERE lead_id = $1`, [id],
      );
      expect(after.rows[0]!.s).toBe("CONTACTED");
    });

    it("i dati dichiarati dalla persona non sono modificabili da questa superficie", async () => {
      const id = await createLead(`immutable${E2E_DOMAIN}`);
      const r = await suite.app.inject({
        method: "PATCH", url: `/v1/leads/${id}`,
        headers: { cookie: adminCookies, "x-csrf-token": adminCsrf, "content-type": "application/json" },
        payload: { status: "QUALIFIED", email: "altro@esempio.test", name: "Nome Riscritto" },
      });
      expect(r.statusCode).toBe(200);
      // Il consenso raccolto vale su quei valori: riscriverli lo renderebbe una
      // dichiarazione su un dato non più verificabile.
      const { rows } = await pool.query<{ e: string; n: string }>(
        `SELECT lead_email AS e, lead_name AS n FROM sys.sys_leads WHERE lead_id = $1`, [id],
      );
      expect(rows[0]!.e).toBe(`immutable${E2E_DOMAIN}`);
      expect(rows[0]!.n).toBe("Stato Test");
    });

    it("uno stato fuori dall'insieme ammesso → 400", async () => {
      const id = await createLead(`badstatus${E2E_DOMAIN}`);
      const r = await suite.app.inject({
        method: "PATCH", url: `/v1/leads/${id}`,
        headers: { cookie: adminCookies, "x-csrf-token": adminCsrf, "content-type": "application/json" },
        payload: { status: "IN_TRATTATIVA" },
      });
      expect(r.statusCode).toBe(400);
    });

    it("un id inesistente → 404, non un successo silenzioso", async () => {
      const r = await suite.app.inject({
        method: "PATCH", url: "/v1/leads/00000000-0000-4000-8000-000000000000",
        headers: { cookie: adminCookies, "x-csrf-token": adminCsrf, "content-type": "application/json" },
        payload: { status: "CLOSED" },
      });
      expect(r.statusCode).toBe(404);
    });

    it("senza CSRF → 403, come ogni mutazione", async () => {
      const id = await createLead(`nocsrf${E2E_DOMAIN}`);
      const r = await suite.app.inject({
        method: "PATCH", url: `/v1/leads/${id}`,
        headers: { cookie: adminCookies, "content-type": "application/json" },
        payload: { status: "CLOSED" },
      });
      expect(r.statusCode).toBe(403);
    });

    it("una richiesta senza sessione è respinta prima di toccare i dati", async () => {
      const r = await suite.app.inject({
        method: "PATCH", url: "/v1/leads/00000000-0000-4000-8000-000000000000",
        headers: { "content-type": "application/json" },
        payload: { status: "CLOSED" },
      });
      // 403 e non 401: nella catena il controllo CSRF viene PRIMA del permesso, quindi
      // senza cookie è quello a rifiutare. Verificato, non presunto — l'aspettativa
      // opposta era sbagliata e questo test la fissa nella forma reale.
      expect(r.statusCode).toBe(403);
      // e nessuno stato è cambiato: la richiesta non ha raggiunto il livello dati
      const { rows } = await pool.query(
        `SELECT 1 FROM sys.sys_leads WHERE lead_id = '00000000-0000-4000-8000-000000000000'`,
      );
      expect(rows.length).toBe(0);
    });
  });

});
