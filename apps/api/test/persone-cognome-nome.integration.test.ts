/**
 * apps/api/test/persone-cognome-nome.integration.test.ts — C12 del giro qa-web 18/11/2026.
 *
 * R1 del repertorio interfacce: ogni elenco che nomina una persona la scrive «Cognome, Nome»,
 * con l'ordine fatto dall'API. Le pagine di retribuzioni, gap, talent review, carriera e
 * versioni dei contenuti mostravano «Nome Cognome» (user_display_name). L'atteso si ricava dal
 * database vivo: cognome e nome della riga di sys.sys_users, mai un valore scritto qui.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { passwordFor } from "./helpers/personas.js";

function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }

interface UserNames { first: string | null; last: string | null; display: string | null }

/** Lo stesso criterio dell'API, scritto qui in TypeScript dalle colonne grezze. */
function atteso(u: UserNames): string | null {
  const parti = [u.last?.trim(), u.first?.trim()].filter((p): p is string => !!p);
  return parti.length > 0 ? parti.join(", ") : u.display;
}

let suite: TestApp;
let cookie: string;
const nomi = new Map<string, UserNames>();

// [url, campo dell'id persona, campo del nome]
const ELENCHI: Array<[string, string, string]> = [
  ["/v1/talent-review/nine-box?limit=100", "userId", "subjectUserName"],
  ["/v1/talent-review/fit?limit=100", "userId", "subjectUserName"],
  ["/v1/talent-review/readiness?limit=100", "userId", "subjectUserName"],
  ["/v1/talent-review/succession?limit=100", "userId", "subjectUserName"],
  ["/v1/compensation/variable-pay?limit=100", "userId", "subjectUserName"],
  ["/v1/compensation/recommendations?limit=100", "userId", "subjectUserName"],
  ["/v1/compensation/reward-gates?limit=100", "userId", "userName"],
  ["/v1/learning-gaps?limit=100", "userId", "userName"],
  ["/v1/learning-gaps/closure-plans?limit=100", "userId", "userName"],
  ["/v1/learning-gaps/analysis-results?limit=100", "userId", "userName"],
  ["/v1/successor-candidates?limit=100", "userId", "userName"],
  // C20: gli obiettivi con lo stesso titolo si distinguono per la persona a cui appartengono.
  ["/v1/goals?limit=100", "subjectUserId", "subjectName"],
];

describe("C12: le persone degli elenchi si scrivono «Cognome, Nome» dall'API", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    // Un mandato HR vero (le utenze di collaudo sono spente in produzione e nel clone).
    const hrQ = await pool.query<{ user_email: string }>(
      `SELECT u.user_email FROM sys.sys_users u
         JOIN sys.sys_user_auth_roles uar ON uar.user_auth_role_user_id = u.user_id AND uar.user_auth_role_revoked_at IS NULL
         JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
        WHERE r.auth_role_code = 'TENANT_ADMIN' AND u.user_status = 'ACTIVE' AND u.user_email NOT LIKE '%@collaudo.invalid'
        ORDER BY u.user_email LIMIT 1`);
    if (hrQ.rows.length === 0) throw new Error("nessun TENANT_ADMIN di persona nel database: la prova non ha chi la esegue");
    const hr = hrQ.rows[0]!;
    const r = await loginRaw(suite.app, hr.user_email, passwordFor(hr.user_email));
    const cookies = new Map<string, string>();
    for (const c of r.cookies) cookies.set(c.name, c.value);
    cookie = ch(cookies);
    const u = await pool.query<{ user_id: string; user_first_name: string | null; user_last_name: string | null; user_display_name: string | null }>(
      `SELECT user_id, user_first_name, user_last_name, user_display_name FROM sys.sys_users`);
    for (const x of u.rows) nomi.set(x.user_id, { first: x.user_first_name, last: x.user_last_name, display: x.user_display_name });
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  for (const [url, campoId, campoNome] of ELENCHI) {
    it(`${url.split("?")[0]}: il nome segue l'ordine cognome, nome`, async () => {
      const r = await suite.app.inject({ method: "GET", url, headers: { cookie } });
      expect(r.statusCode).toBe(200);
      const items = (r.json() as { items: Array<Record<string, unknown>> }).items;
      let verificate = 0;
      expect(items.length, `${url}: la prova ha bisogno di righe vere`).toBeGreaterThan(0);
      for (const it of items) {
        const id = it[campoId] as string | null | undefined;
        const nome = it[campoNome] as string | null | undefined;
        if (!id || !nome) continue;
        const u = nomi.get(id);
        expect(u, `utente ${id} presente nel database`).toBeDefined();
        expect(nome).toBe(atteso(u!));
        verificate++;
      }
      // Un elenco vuoto non prova niente: se la tabella ha righe con persona, ne servono.
      if (items.length > 0) expect(verificate).toBeGreaterThan(0);
    });
  }

  it("le versioni dei contenuti nominano l'autore «Cognome, Nome»", async () => {
    const d = await pool.query<{ version_document_id: string; version_author_user_id: string }>(
      `SELECT version_document_id, version_author_user_id FROM sys.sys_content_versions
        WHERE version_author_user_id IS NOT NULL LIMIT 1`);
    if (d.rows.length === 0) return;
    const { version_document_id: doc, version_author_user_id: autore } = d.rows[0]!;
    const r = await suite.app.inject({ method: "GET", url: `/v1/content/${doc}/versions`, headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: Array<{ authorUserId: string | null; authorName: string | null }> }).items;
    const riga = items.find((v) => v.authorUserId === autore);
    expect(riga).toBeDefined();
    expect(riga!.authorName).toBe(atteso(nomi.get(autore)!));
  });
});
