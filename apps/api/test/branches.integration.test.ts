/**
 * apps/api/test/branches.integration.test.ts — B14 (2026-09-10).
 *
 * Le filiali esistevano nel database (6 righe, con `branch_tenant_id`) e non nel prodotto:
 * nessun file di `apps/api/src` nominava quella tabella, e nessun permesso RBAC esisteva per
 * la risorsa `branch`. Eppure c'era un cruscotto `branch` e un ruolo `BRANCH_MANAGER`.
 *
 * LA PROVA CHE CONTA E' IL CONFINE FRA CLIENTI, e sa fallire: se il filtro venisse tolto dal
 * repository, l'elenco di un utente della banca conterrebbe filiali di un altro cliente e il
 * dettaglio di una filiale altrui risponderebbe 200 invece di 404. Gli attesi si ri-derivano
 * dal database vivo, mai da un elenco cablato.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

interface S { cookies: Map<string, string> }
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
let platform: S;
let bankAdmin: S;
let bankTenantId: string;

describe("/v1/branches — B14", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platform = await login(suite, "enzo.spenuso@heuresys.com");
    bankAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
    const t = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    bankTenantId = t.rows[0]!.id;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("senza autenticazione → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/branches" });
    expect(r.statusCode).toBe(401);
  });

  it("un utente della banca riceve SOLO le filiali del proprio cliente", async () => {
    const attese = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_branches WHERE branch_tenant_id = $1`,
      [bankTenantId],
    );
    const r = await suite.app.inject({
      method: "GET", url: "/v1/branches?limit=200", headers: { cookie: ch(bankAdmin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { branchId: string }[]; total: number };
    expect(body.total).toBe(Number(attese.rows[0]!.n));

    // Nessuna delle filiali restituite appartiene a un altro cliente. Se il filtro sparisse,
    // questo conteggio smetterebbe di essere zero.
    const ids = body.items.map((x) => x.branchId);
    if (ids.length > 0) {
      const altrui = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_branches
          WHERE branch_id = ANY($1::uuid[]) AND branch_tenant_id <> $2`,
        [ids, bankTenantId],
      );
      expect(Number(altrui.rows[0]!.n), "filiali di un altro cliente nell'elenco").toBe(0);
    }
  });

  it("chi amministra la piattaforma le vede tutte", async () => {
    const tutte = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_branches`,
    );
    const r = await suite.app.inject({
      method: "GET", url: "/v1/branches?limit=200", headers: { cookie: ch(platform.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(Number(tutte.rows[0]!.n));
  });

  it("il dettaglio di una filiale del proprio cliente → 200", async () => {
    const una = await pool.query<{ id: string }>(
      `SELECT branch_id AS id FROM sys.sys_branches WHERE branch_tenant_id = $1 LIMIT 1`,
      [bankTenantId],
    );
    expect(una.rowCount, "la banca non ha filiali: la prova non discrimina").toBe(1);
    const r = await suite.app.inject({
      method: "GET", url: `/v1/branches/${una.rows[0]!.id}`,
      headers: { cookie: ch(bankAdmin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { branchId: string }).branchId).toBe(una.rows[0]!.id);
  });

  it("una filiale di un ALTRO cliente → 404, non 403 (nessun oracolo)", async () => {
    // Il caso si costruisce e si disfa dentro la transazione del file: la filiale finta nasce
    // sotto un cliente diverso e non resta. Se il filtro fosse tolto, questa sarebbe 200.
    const altro = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code <> 'RTL_BANK' LIMIT 1`,
    );
    expect(altro.rowCount, "non esiste un secondo cliente: la prova non discrimina").toBe(1);
    // ⚠ L'UNITA' DEVE ESSERE SENZA FILIALE, e la prima stesura non lo pretendeva: prendeva la
    // prima con un `LIMIT 1` senza ordine, e `sys_branches_organization_unit_uq` impone UNA
    // filiale per unita'. Esito: verde da una macchina, rosso da un'altra, sullo stesso
    // comando — l'instabilita' che nasce quando una prova NEGOZIA con lo stato che trova
    // invece di dichiarare quello che le serve.
    const ou = await pool.query<{ id: string }>(
      `SELECT ou.organization_unit_id AS id
         FROM sys.sys_organization_units ou
        WHERE ou.organization_unit_tenant_id = $1
          AND NOT EXISTS (SELECT 1 FROM sys.sys_branches b
                           WHERE b.branch_organization_unit_id = ou.organization_unit_id)
        ORDER BY ou.organization_unit_id
        LIMIT 1`, [altro.rows[0]!.id],
    );
    expect(
      ou.rowCount,
      "il secondo cliente non ha un'unita' organizzativa LIBERA da filiali: la prova non puo' "
        + "costruire il proprio caso",
    ).toBe(1);

    const creata = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_branches
         (branch_organization_unit_id, branch_tenant_id, branch_code, branch_city)
       VALUES ($1, $2, $3, 'Citta di prova')
       RETURNING branch_id AS id`,
      [ou.rows[0]!.id, altro.rows[0]!.id, `IT_BR_${randomUUID().slice(0, 8).toUpperCase()}`],
    );
    const id = creata.rows[0]!.id;

    const daBanca = await suite.app.inject({
      method: "GET", url: `/v1/branches/${id}`, headers: { cookie: ch(bankAdmin.cookies) },
    });
    expect(daBanca.statusCode, "una filiale altrui deve essere INTROVABILE, non negata").toBe(404);

    // L'esito opposto sulla stessa risorsa: chi amministra la piattaforma la trova.
    const daPiattaforma = await suite.app.inject({
      method: "GET", url: `/v1/branches/${id}`, headers: { cookie: ch(platform.cookies) },
    });
    expect(daPiattaforma.statusCode).toBe(200);
  });

  it("un identificativo che non esiste → 404", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/branches/${randomUUID()}`,
      headers: { cookie: ch(platform.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });
});
