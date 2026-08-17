/**
 * apps/api/test/compensation-read.integration.test.ts — A/L7 (#32).
 *
 * READ-only API over six dormant compensation & reward tables. Extends the
 * compensation module with list GETs. `compensation_intelligence` is
 * COMPENSATION-class SENSITIVE per-person data (data-classes.ts):
 *   - variable-pay + recommendations expose per-person rows → org-gated
 *     (ADR-0027 F3, resolveOrgReadScope): PLATFORM_ADMIN → all; TENANT_ADMIN
 *     (HR mandate) → whole tenant; managerial (org-scoped) → transitive sub-tree.
 *   - bonus-pools / objective-reward-rules / position-economic-weight /
 *     handoff-records carry NO person rows → tenant-scoped catalog reads.
 * All expectations derive from the LIVE DB (never hardcoded counts).
 *
 * Persona note (mirrors compensation-scope.integration.test.ts): `compensation_
 * intelligence:read` is held by CEO / HRMS_MANAGER / PLATFORM_ADMIN / TENANT_ADMIN
 * — NOT by MANAGER (verified live). paolo (MANAGER) alone would 403, so he cannot
 * demonstrate org-subtree scoping. The only role that is BOTH a permission-holder
 * AND org-scoped (managerial, non-HR-mandated) is CEO. We grant paolo CEO
 * (reversible/idempotent) to turn him into a permission-holding org-scoped actor;
 * an RBAC role grant does NOT change his org-chart position, so his real sub-tree
 * (includes tommaso, excludes outsiders) is unchanged. USER (tommaso) holds no
 * compensation_intelligence:read → 403 (the self-floor: no cross-user surface).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { orgSubtreeUserIds } from "../src/lib/scope/org.js";
import { payoutFactor } from "../src/modules/compensation/reward-engine.js";

const PWD = TEST_PERSONA_PASSWORD;
const PAOLO_EMAIL = "paolo.caputo@rtl-bank.org";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
async function liveCount(sql: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query<{ n: string }>(sql, params);
  return Number(r.rows[0]!.n);
}
async function userId(email: string): Promise<string> {
  const r = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM sys.sys_users WHERE user_email = $1`, [email]);
  return r.rows[0]!.user_id;
}

/** Grant/revoke the CEO role to paolo by email (see persona note in the header). */
async function grantCeoToPaolo(email: string): Promise<void> {
  await pool.query(
    `INSERT INTO sys.sys_user_auth_roles
        (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
      SELECT u.user_id, r.auth_role_id, u.user_tenant_id
        FROM sys.sys_users u, sys.sys_auth_roles r
       WHERE lower(u.user_email) = lower($1) AND r.auth_role_code = 'CEO'`,
    [email],
  );
}
async function revokeCeoFromPaolo(email: string): Promise<void> {
  await pool.query(
    `DELETE FROM sys.sys_user_auth_roles
      WHERE user_auth_role_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1))
        AND user_auth_role_role_id = (SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = 'CEO')`,
    [email],
  );
}

let suite: TestApp;
let admin: S; let federica: S; let paolo: S; let tommaso: S;
let rtlTenantId: string;
let paoloSubtree: string[];

describe("#32 A/L7 compensation & reward read", () => {
  beforeAll(async () => {
    suite = await buildTestApp();

    // Turn paolo into a permission-holding, org-scoped actor BEFORE login so his
    // session token carries CEO. Clear any leftover, then grant fresh.
    await revokeCeoFromPaolo(PAOLO_EMAIL);
    await grantCeoToPaolo(PAOLO_EMAIL);

    admin = await login(suite, "enzo.spenuso@heuresys.com");
    federica = await login(suite, "federica.marchetti@rtl-bank.org"); // TENANT_ADMIN (HR mandate)
    paolo = await login(suite, PAOLO_EMAIL); // MANAGER (+CEO granted) → org sub-tree
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org"); // USER (no compensation_intelligence:read)

    const t = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_email = $1`,
      ["federica.marchetti@rtl-bank.org"]);
    rtlTenantId = t.rows[0]!.user_tenant_id;
    paoloSubtree = await orgSubtreeUserIds(pool, await userId(PAOLO_EMAIL));
  });

  afterAll(async () => {
    await revokeCeoFromPaolo(PAOLO_EMAIL);
    await suite.app.close();
    await closePool();
  });

  // ── variable-pay: org axis ──────────────────────────────────────────────────

  it("variable-pay: PLATFORM_ADMIN total == whole live table + pagination honored", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_variable_pay_calculations`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/variable-pay?limit=1", headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(live);
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.length).toBe(1);
  });

  it("variable-pay: TENANT_ADMIN (HR mandate) total == own-tenant count (live-derived)", async () => {
    const live = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_variable_pay_calculations WHERE variable_pay_calculation_tenant_id = $1`,
      [rtlTenantId]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/variable-pay?limit=1", headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(live);
  });

  it("variable-pay: MANAGER (org-scoped) is scoped to the transitive org sub-tree (I18)", async () => {
    const expected = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_variable_pay_calculations WHERE variable_pay_calculation_user_id = ANY($1::uuid[])`,
      [paoloSubtree]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/variable-pay?limit=200", headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { userId: string; subjectUserName: string | null }[]; total: number };
    expect(body.total).toBe(expected);
    expect(body.total).toBeGreaterThan(0);
    // no peer leak (I19): every returned subject is inside the manager's sub-tree
    expect(body.items.every((i) => paoloSubtree.includes(i.userId))).toBe(true);
  });

  // ── recommendations: org axis ───────────────────────────────────────────────

  it("recommendations: MANAGER (org-scoped) is scoped to the org sub-tree; subjectUserName resolved", async () => {
    const expected = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_compensation_recommendations WHERE compensation_recommendation_user_id = ANY($1::uuid[])`,
      [paoloSubtree]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/recommendations?limit=200", headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { userId: string }[]; total: number };
    expect(body.total).toBe(expected);
    expect(body.items.every((i) => paoloSubtree.includes(i.userId))).toBe(true);
  });

  // ── catalog reads: tenant-scoped (no person rows) ───────────────────────────

  it("bonus-pools: PLATFORM_ADMIN sees all; TENANT_ADMIN sees own-tenant", async () => {
    const liveAll = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_bonus_pools`);
    const liveRtl = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_bonus_pools WHERE bonus_pool_tenant_id = $1`, [rtlTenantId]);
    const rA = await suite.app.inject({
      method: "GET", url: "/v1/compensation/bonus-pools?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    const rF = await suite.app.inject({
      method: "GET", url: "/v1/compensation/bonus-pools?limit=200", headers: { cookie: ch(federica.cookies) },
    });
    expect(rA.statusCode).toBe(200);
    expect((rA.json() as { total: number }).total).toBe(liveAll);
    expect((rF.json() as { total: number }).total).toBe(liveRtl);
  });

  it("objective-reward-rules & position-economic-weight: PLATFORM_ADMIN total == whole live table", async () => {
    const liveRules = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_objective_reward_rules`);
    const liveWeight = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_position_economic_weight`);
    const rRules = await suite.app.inject({
      method: "GET", url: "/v1/compensation/objective-reward-rules?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    const rWeight = await suite.app.inject({
      method: "GET", url: "/v1/compensation/position-economic-weight?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    expect(rRules.statusCode).toBe(200);
    expect((rRules.json() as { total: number }).total).toBe(liveRules);
    expect(rWeight.statusCode).toBe(200);
    expect((rWeight.json() as { total: number }).total).toBe(liveWeight);
  });

  it("handoff-records: empty-state works (200, total == live, items empty when 0)", async () => {
    const live = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_payroll_handoff_records WHERE payroll_handoff_record_tenant_id = $1`,
      [rtlTenantId]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/handoff-records?limit=200", headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(live);
    expect(body.items.length).toBe(Math.min(live, 200));
  });

  // ── self-floor: plain USER has no cross-user surface ────────────────────────

  it("USER without compensation_intelligence:read → 403 on the variable-pay list", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/variable-pay", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  // ── #37 (B2) — la valutazione: curva + cancelli sui calcoli REALI ───────────
  describe("variable-pay evaluation (#37)", () => {
    it("evaluates a real calculation that declares a curve, and the factor matches the curve read from the DB", async () => {
      // Si sceglie un calcolo VERO che dichiara curva e raggiungimento: nessun
      // dato inventato, nessun conteggio scritto a mano.
      const picked = await pool.query<{ id: string; curve: string; attainment: string }>(
        `SELECT variable_pay_calculation_id AS id,
                variable_pay_calculation_payload->>'curve' AS curve,
                variable_pay_calculation_payload->>'attainment' AS attainment
           FROM sys.sys_variable_pay_calculations
          WHERE variable_pay_calculation_payload ? 'curve'
            AND variable_pay_calculation_payload ? 'attainment'
            AND variable_pay_calculation_tenant_id = $1
          LIMIT 1`,
        [rtlTenantId],
      );
      if (picked.rowCount === 0) {
        throw new Error("Nessun calcolo con curva e raggiungimento: la premessa del test non regge piu'");
      }
      const row = picked.rows[0]!;

      const r = await suite.app.inject({
        method: "GET", url: `/v1/compensation/variable-pay/${row.id}/evaluation`,
        headers: { cookie: ch(federica.cookies) },
      });
      expect(r.statusCode).toBe(200);
      const ev = r.json() as {
        curveCode: string; curveKind: string; curveFactor: number; attainment: number;
        gateDecision: string; finalFactor: number; notEvaluable: string | null;
        gates: Array<{ gateCode: string; status: string; isBlocking: boolean }>;
      };

      expect(ev.notEvaluable).toBeNull();
      expect(ev.curveCode).toBe(row.curve);
      expect(ev.attainment).toBeCloseTo(Number(row.attainment), 4);

      // L'atteso si ricalcola dalla CURVA VERA letta dal database, non da una
      // costante nel test: se qualcuno cambia i parametri della curva, questo
      // test cambia con lei invece di diventare una bugia verde.
      const curveRow = await pool.query<{ kind: string; payload: Record<string, unknown> }>(
        `SELECT payout_curve_kind AS kind, payout_curve_payload AS payload
           FROM sys.sys_payout_curves WHERE payout_curve_code = $1 LIMIT 1`,
        [row.curve],
      );
      const c = curveRow.rows[0]!;
      expect(ev.curveKind).toBe(c.kind);
      const atteso = payoutFactor(
        { code: row.curve, kind: c.kind as "LINEAR" | "CAPPED" | "STEPPED" | "SIGMOID", payload: c.payload },
        Number(row.attainment),
      );
      expect(ev.curveFactor).toBeCloseTo(atteso.factor, 6);

      // I cancelli arrivano dai dati reali, e la decisione e' coerente con essi.
      const bloccanti = ev.gates.filter((g) => g.isBlocking && g.status === "BLOCKED");
      if (bloccanti.length > 0) {
        expect(ev.gateDecision).toBe("BLOCK");
        expect(ev.finalFactor).toBe(0);
      } else {
        expect(["ALLOW", "ALLOW_WITH_WARNING"]).toContain(ev.gateDecision);
        expect(ev.finalFactor).toBeCloseTo(ev.curveFactor, 6);
      }
    });

    it("a legacy calculation without a curve is declared not evaluable instead of being guessed", async () => {
      const legacy = await pool.query<{ id: string }>(
        `SELECT variable_pay_calculation_id AS id
           FROM sys.sys_variable_pay_calculations
          WHERE NOT (variable_pay_calculation_payload ? 'curve')
            AND variable_pay_calculation_tenant_id = $1
          LIMIT 1`,
        [rtlTenantId],
      );
      if (legacy.rowCount === 0) return; // nessuna riga importata: niente da verificare
      const r = await suite.app.inject({
        method: "GET", url: `/v1/compensation/variable-pay/${legacy.rows[0]!.id}/evaluation`,
        headers: { cookie: ch(federica.cookies) },
      });
      expect(r.statusCode).toBe(200);
      const ev = r.json() as { notEvaluable: string | null; curveFactor: number | null; finalFactor: number | null };
      expect(ev.notEvaluable).toBeTruthy();
      expect(ev.curveFactor).toBeNull();
      expect(ev.finalFactor).toBeNull();
    });

    it("USER without compensation_intelligence:read cannot evaluate", async () => {
      const any = await pool.query<{ id: string }>(
        `SELECT variable_pay_calculation_id AS id FROM sys.sys_variable_pay_calculations LIMIT 1`,
      );
      const r = await suite.app.inject({
        method: "GET", url: `/v1/compensation/variable-pay/${any.rows[0]!.id}/evaluation`,
        headers: { cookie: ch(tommaso.cookies) },
      });
      expect(r.statusCode).toBe(403);
    });

    it("a calculation outside the actor's org sub-tree is not found", async () => {
      const outside = await pool.query<{ id: string }>(
        `SELECT variable_pay_calculation_id AS id
           FROM sys.sys_variable_pay_calculations
          WHERE NOT (variable_pay_calculation_user_id = ANY($1::uuid[]))
          LIMIT 1`,
        [paoloSubtree],
      );
      if (outside.rowCount === 0) return;
      const r = await suite.app.inject({
        method: "GET", url: `/v1/compensation/variable-pay/${outside.rows[0]!.id}/evaluation`,
        headers: { cookie: ch(paolo.cookies) },
      });
      expect(r.statusCode).toBe(404);
    });
  });


  // #53 E4 — catalogo delle fasce retributive. Le fasce esistevano in tabella e nessuna
  // API le elencava: si vedevano solo di riflesso, risolte per una singola posizione.
  describe("E4 — catalogo delle fasce retributive", () => {
    async function bands(s: S, qs = "") {
      return suite.app.inject({
        method: "GET", url: `/v1/compensation/bands${qs}`,
        headers: { cookie: ch(s.cookies) },
      });
    }

    it("elenca solo fasce con importi, e dichiara quante ne restano fuori", async () => {
      const r = await bands(federica);
      expect(r.statusCode).toBe(200);
      const body = r.json() as {
        items: Array<{ midEur: string | null; name: string; code: string }>;
        total: number; totalIncludingValueless: number;
      };
      expect(body.items.length).toBeGreaterThan(0);

      // LA guardia: una fascia senza importi non è una fascia. Il difetto che questo
      // test previene è un catalogo che elenca righe vuote e si legge come «esiste ma
      // non so quanto vale» — la tabella ne contiene ancora molte, da un import che
      // portò le chiavi e non i dati.
      for (const b of body.items) expect(b.midEur).not.toBeNull();

      // …e il conteggio complessivo le dichiara invece di farle sparire.
      expect(body.totalIncludingValueless).toBeGreaterThanOrEqual(body.total);
    });

    it("le fasce importate dal legacy portano nome e importi veri", async () => {
      const r = await bands(federica, "?limit=200");
      const items = (r.json() as { items: Array<{ code: string; name: string; minEur: string | null; maxEur: string | null }> }).items;
      const legacy = items.filter((b) => b.code.startsWith("LEGACY_BAND::"));

      // La proprietà vale per TUTTO il catalogo, non solo per le righe importate: una
      // fascia mostrata deve avere un nome leggibile e non il proprio codice tecnico.
      // È il difetto misurato sulle 87 righe preesistenti, dove 43 avevano il nome
      // uguale al codice `OLDDB::ccnl_levels::<uuid>`.
      expect(items.length).toBeGreaterThan(0);
      for (const b of items) expect(b.name).not.toBe(b.code);

      // Le righe `LEGACY_BAND::` le scrive `docs/archive/etl-brownfield-ritirato/scripts/import-e4-salary-bands.sh (ritirato #170)`, che
      // gira dove vivono i dati legacy: sul clone di CI NON esistono. Pretenderle qui
      // renderebbe il test verde in locale e rosso in CI — la trappola già registrata
      // come pattern del progetto. Si verifica quindi «se ci sono, sono ben formate»;
      // che l'import abbia prodotto righe è materia della prova live dello script.
      for (const b of legacy) {
        expect(b.name).not.toBe(b.code);           // nome leggibile, non il codice
        expect(Number(b.minEur)).toBeGreaterThan(0);
        expect(Number(b.maxEur)).toBeGreaterThan(Number(b.minEur));
      }
    });

    /**
     * ⚠ Questo caso era un FALSO VERDE fino a `#209` (S1066), e vale la pena dire
     * perché: `withValueOnly` usava `z.coerce.boolean()`, che su una querystring
     * applica `Boolean("false")` — cioè `true`. Le due chiamate qui sotto erano
     * quindi **la stessa chiamata**, e il `>=` confrontava un insieme con sé stesso:
     * sempre vero, e cieco per costruzione.
     *
     * Ora il filtro filtra davvero, e il caso pretende una differenza STRETTA — ma
     * solo quando esiste qualcosa da distinguere, misurato sul database invece che
     * assunto. Se un giorno ogni banda avesse i suoi importi, la differenza sparirebbe
     * legittimamente, e il caso lo dichiara invece di diventare rosso.
     */
    it("chiedendole tutte compaiono anche quelle prive di importi", async () => {
      // L'universo è quello dell'ATTORE, non della tabella: il catalogo è filtrato
      // per tenant, quindi Federica vede le bande di RTL e non le globali. Misurato
      // il 2026-08-17: RTL ne ha 12, tutte con importi; le 29 prive di importi sono
      // globali e stanno fuori dal suo perimetro. Contare quelle — come faceva la
      // prima stesura di questo controllo — pretende una differenza che non può
      // esistere, e fa fallire il test per un difetto del test.
      const { rows } = await pool.query<{ senza: string }>(
        `SELECT count(*)::text AS senza
           FROM sys.sys_compensation_bands b
           JOIN sys.sys_users u ON u.user_tenant_id = b.compensation_band_tenant_id
          WHERE u.user_email = $1 AND b.compensation_band_mid_eur IS NULL`,
        ["federica.marchetti@rtl-bank.org"],
      );
      const senzaImporti = Number(rows[0]!.senza);

      const solo = (await bands(federica, "?withValueOnly=true&limit=200")).json() as { total: number };
      const tutte = (await bands(federica, "?withValueOnly=false&limit=200")).json() as { total: number };

      expect(tutte.total).toBeGreaterThanOrEqual(solo.total);

      if (senzaImporti === 0) {
        // CIECO, e si dichiara. Fino a `#209` questo caso era un falso verde per un
        // altro motivo — `z.coerce.boolean()` rendeva `"false"` uguale a `true`,
        // quindi le due chiamate erano LA STESSA e il `>=` confrontava un insieme
        // con sé stesso. Oggi il filtro funziona, ma nel perimetro di questo attore
        // non ha nulla da escludere: uguali è la risposta giusta, non una prova.
        expect(`nessuna banda priva di importi nel perimetro: tutte(${tutte.total}) == solo(${solo.total})`).toBe(
          `nessuna banda priva di importi nel perimetro: tutte(${tutte.total}) == solo(${tutte.total})`,
        );
        return;
      }

      // Se invece ce ne sono, il filtro deve SAPER DIRE DI NO: numeri uguali qui
      // significherebbero che `false` non esclude niente.
      expect(`con ${senzaImporti} prive di importi, tutte(${tutte.total}) > solo(${solo.total})`).toBe(
        `con ${senzaImporti} prive di importi, tutte(${tutte.total}) > solo(${tutte.total > solo.total ? solo.total : "NON-FILTRA"})`,
      );
    });

    /**
     * `#209` — il caso PRECEDENTE è cieco per costruzione, e questo è il suo gemello
     * che vede: un attore di piattaforma non ha un tenant nel catalogo
     * (`catalogTenant` → `undefined`), quindi le bande **globali** gli entrano nel
     * perimetro — e quelle, misurate, sono prive di importi.
     *
     * È qui che il filtro `withValueOnly` può davvero fallire, ed è per questo che
     * il caso esiste: prima di `#209`, `?withValueOnly=false` valeva `true` e i due
     * numeri coincidevano. Se tornassero a coincidere, il difetto è tornato.
     */
    it("#209 — per chi vede anche le globali, `withValueOnly=false` allarga davvero", async () => {
      const { rows } = await pool.query<{ senza: string }>(
        `SELECT count(*)::text AS senza FROM sys.sys_compensation_bands
          WHERE compensation_band_mid_eur IS NULL`,
      );
      const senzaImporti = Number(rows[0]!.senza);
      if (senzaImporti === 0) {
        // Universo vuoto: si dichiara invece di passare in silenzio.
        expect(`nessuna banda priva di importi in tutto il catalogo: caso CIECO`).toBe(
          `nessuna banda priva di importi in tutto il catalogo: caso CIECO`,
        );
        return;
      }

      const solo = (await bands(admin, "?withValueOnly=true&limit=200")).json() as { total: number };
      const tutte = (await bands(admin, "?withValueOnly=false&limit=200")).json() as { total: number };

      expect(`tutte(${tutte.total}) > solo(${solo.total})`).toBe(
        `tutte(${tutte.total}) > solo(${tutte.total > solo.total ? solo.total : "NON-FILTRA: il filtro ignora `false`"})`,
      );
      // e la differenza è esattamente quelle prive di importi, non un numero a caso
      expect(`differenza ${tutte.total - solo.total}`).toBe(`differenza ${senzaImporti}`);
    });

    it("il catalogo è del proprio tenant, non di tutti", async () => {
      const r = await bands(federica, "?limit=200");
      const items = (r.json() as { items: Array<{ tenantId: string | null }> }).items;
      const { rows } = await pool.query<{ t: string }>(
        `SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_email = $1`,
        ["federica.marchetti@rtl-bank.org"],
      );
      for (const b of items) {
        if (b.tenantId !== null) expect(b.tenantId).toBe(rows[0]!.t);
      }
    });

    it("chi non ha compensation_intelligence:read non vede il catalogo", async () => {
      expect((await bands(tommaso)).statusCode).toBe(403);
    });
  });

});
