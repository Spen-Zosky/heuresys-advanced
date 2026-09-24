/**
 * apps/api/test/dpo-dossier-mascherato.integration.test.ts — mandato K, D11.
 *
 * IL TERZO STATO: perimetro dell'intero tenant, dati sensibili MASCHERATI.
 *
 * Decisione di Enzo del 2026-09-24 (`esiti/RISPOSTE_ENZO.md`, riga «D11 | 2026-09-24 | A»,
 * opzione A di `esiti/R-2_domanda_masking.md`): **quinta eccezione dichiarata ad ADR-0036
 * §5**. Il DPO apre il dossier di qualunque persona del proprio tenant; `COMPENSATION` ed
 * `EVALUATION` gli arrivano assenti e dichiarate in `masked`, come a `PLATFORM_ADMIN` senza
 * mandato HR (I20, ADR-0032); `PERSONAL` e `SKILL` non sono toccate dal mascheramento.
 *
 * DUE LIVELLI DI PROVA, e la ragione per cui ci sono entrambi. Le prove (a)-(d) chiamano il
 * SERVICE: è lì che il terzo stato vive, ed è dove si vede che a decidere è il perimetro e
 * non il permesso. La (f) chiama la ROTTA: `GET /v1/users/:userId/dossier` è protetta da
 * `requirePermission("user:read")`, che il DPO ha ricevuto con la migrazione `000451`
 * (Enzo, 2026-09-25 — `esiti/RISPOSTE_ENZO.md`, riga «D11-permesso | 2026-09-25 | 1»).
 * La (f) è stata scritta e vista ROSSA prima di quella migrazione — `expected 403 to be 200`,
 * evidenza in `evidenze/D11_prova_f_ROSSA_20260925.txt` — e verde dopo, senza che una riga
 * di `lib/scope/` cambiasse: è la separazione fra il «se» (RBAC) e il «su chi e come»
 * (i domini, ADR-0036) che si vede all'opera.
 *
 * I protagonisti si DERIVANO dai dati vivi, mai per nome: se l'organigramma cambia, la
 * prova sceglie altre persone invece di misurare il caso sbagliato — e se un giorno non
 * esistesse più un soggetto con buste paga e valutazioni, lo dice e fallisce, invece di
 * passare per assenza di casi.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { usersService } from "../src/modules/users/service.js";
import { LIVELLO_VERTICE } from "../src/lib/scope/mask.js";
import type { ActorContext } from "../src/lib/actor.js";
import { loginRaw } from "./helpers/login.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";

const DPO_EMAIL = "dpo@collaudo.invalid";

let t: TestApp;

interface Persona {
  id: string;
  email: string;
  tenantId: string;
  livello: number | null;
  ruoli: string[];
  buste: number;
  valutazioni: number;
}

const attore = (p: { id: string; tenantId: string }, ruoli: string[]): ActorContext =>
  ({ userId: p.id, tenantId: p.tenantId, roles: ruoli } as unknown as ActorContext);

/** Persone attive con ruoli, livello nell'albero delle UNITÀ (ADR-0036) e i dati sensibili che hanno. */
async function persone(): Promise<Persona[]> {
  const r = await pool.query<{
    id: string; email: string; tenant_id: string; livello: string | null;
    ruoli: string[]; buste: string; valutazioni: string;
  }>(
    `WITH RECURSIVE albero AS (
       SELECT organization_unit_id AS ou, 1 AS livello FROM sys.sys_organization_units
        WHERE organization_unit_parent_id IS NULL AND organization_unit_is_active
       UNION ALL
       SELECT o.organization_unit_id, a.livello + 1 FROM sys.sys_organization_units o
         JOIN albero a ON o.organization_unit_parent_id = a.ou WHERE o.organization_unit_is_active
     ),
     livelli AS (
       SELECT upa.user_position_assignment_user_id AS uid, min(a.livello) AS livello
         FROM albero a
         JOIN sys.sys_positions p ON p.position_organization_unit_id = a.ou
         JOIN sys.sys_user_position_assignments upa
              ON upa.user_position_assignment_position_id = p.position_id
             AND upa.user_position_assignment_status = 'ACTIVE'
        GROUP BY 1
     )
     SELECT u.user_id AS id, u.user_email AS email, u.user_tenant_id AS tenant_id,
            l.livello::text AS livello,
            coalesce(array_agg(DISTINCT r.auth_role_code) FILTER (WHERE r.auth_role_code IS NOT NULL), '{}') AS ruoli,
            (SELECT count(*) FROM sys.sys_user_pay_slips ps WHERE ps.user_pay_slip_user_id = u.user_id)::text AS buste,
            (SELECT count(*) FROM sys.sys_performance_reviews pr WHERE pr.review_subject_user_id = u.user_id)::text AS valutazioni
       FROM sys.sys_users u
       LEFT JOIN livelli l ON l.uid = u.user_id
       LEFT JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                                           AND ur.user_auth_role_revoked_at IS NULL
       LEFT JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE u.user_status = 'ACTIVE'
      GROUP BY u.user_id, u.user_email, u.user_tenant_id, l.livello`,
  );
  return r.rows.map((x) => ({
    id: x.id, email: x.email, tenantId: x.tenant_id,
    livello: x.livello === null ? null : Number(x.livello),
    ruoli: x.ruoli, buste: Number(x.buste), valutazioni: Number(x.valutazioni),
  }));
}

let dpo: Persona | undefined;
let soggetto: Persona | undefined;
let hrms: Persona | undefined;
let estraneo: Persona | undefined;
let altroTenant: Persona | undefined;

beforeAll(async () => {
  t = await buildTestApp();
  const tutti = await persone();
  dpo = tutti.find((p) => p.email === DPO_EMAIL);
  // Il soggetto deve avere DAVVERO qualcosa da nascondere, stare nel tenant del DPO, e NON
  // essere un vertice: la soglia di catena (terza eccezione di ADR-0036 §5) maschererebbe la
  // retribuzione anche a HRMS_MANAGER, e la controprova (b) non distinguerebbe più i due casi.
  soggetto = tutti.find(
    (p) =>
      dpo !== undefined &&
      p.tenantId === dpo.tenantId &&
      p.id !== dpo.id &&
      p.buste > 0 &&
      p.valutazioni > 0 &&
      p.livello !== null &&
      p.livello > LIVELLO_VERTICE,
  );
  hrms = tutti.find(
    (p) => dpo !== undefined && p.tenantId === dpo.tenantId && p.ruoli.includes("HRMS_MANAGER"),
  );
  // Un estraneo: nessun mandato tenant-wide, nessun ruolo manageriale — il caso di I19.
  estraneo = tutti.find(
    (p) =>
      dpo !== undefined &&
      soggetto !== undefined &&
      p.tenantId === dpo.tenantId &&
      p.id !== soggetto.id &&
      p.ruoli.length > 0 &&
      !p.ruoli.some((r) =>
        ["PLATFORM_ADMIN", "TENANT_ADMIN", "HRMS_MANAGER", "PEOPLE_MANAGER", "MANAGER", "CEO", "DPO"].includes(r),
      ),
  );
  altroTenant = tutti.find((p) => dpo !== undefined && p.tenantId !== dpo.tenantId);
}, 120_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("mandato K, D11 — il DPO legge il dossier del suo tenant, mascherato", () => {
  it("gira su un universo dove PUÒ fallire: DPO, un soggetto con buste e valutazioni, un mandato HR, un estraneo, un altro tenant", () => {
    if (!dpo || !soggetto || !hrms || !estraneo || !altroTenant) {
      throw new Error(
        "Manca uno dei cinque protagonisti (DPO / soggetto con dati sensibili non-vertice / " +
          "HRMS_MANAGER / persona senza mandato / persona di un altro tenant). Senza di loro " +
          "questa verifica non guarda niente e non va contata fra le superate.",
      );
    }
    expect(soggetto.buste).toBeGreaterThan(0);
    expect(soggetto.valutazioni).toBeGreaterThan(0);
    expect(soggetto.tenantId).toBe(dpo.tenantId);
    expect(altroTenant.tenantId).not.toBe(dpo.tenantId);
  });

  /* (a) — la prova del mandato: 200, con retribuzione e valutazioni mascherate e DICHIARATE. */
  it("(a) il DPO apre il dossier di una persona del suo tenant fuori dalla propria catena: la riga c'è, gli importi e i giudizi no", async () => {
    const d = await usersService.getDossier(attore(dpo!, ["DPO"]), soggetto!.id);

    expect(d.paySlips.length, "il soggetto ha buste paga: devono arrivare come RIGHE").toBeGreaterThan(0);
    for (const b of d.paySlips) {
      const riga = b as unknown as Record<string, unknown>;
      expect(riga["grossPay"], "l'importo lordo è uscito al DPO").toBeUndefined();
      expect(
        (riga["masked"] as string[] | undefined) ?? [],
        "la busta deve DICHIARARE cosa ha trattenuto: un campo assente e non dichiarato è indistinguibile da un dato che non c'è",
      ).toContain("grossPay");
      // ciò che NON doveva sparire: il periodo resta, o la riga non serve a niente
      expect(riga["period"] ?? riga["periodStart"] ?? riga["payDate"]).toBeDefined();
    }

    expect(d.performance.length, "il soggetto ha valutazioni: devono arrivare come RIGHE").toBeGreaterThan(0);
    for (const v of d.performance) {
      const riga = v as unknown as Record<string, unknown>;
      const masked = (riga["masked"] as string[] | undefined) ?? [];
      expect(masked.length, "una valutazione letta dal DPO deve dichiarare ciò che è stato trattenuto").toBeGreaterThan(0);
      for (const campo of masked) expect(riga[campo]).toBeUndefined();
    }

    // PERSONAL non è toccata dal mascheramento (mandato D11): la sfera privata arriva.
    expect(
      (d.profile as unknown as Record<string, unknown>)["maskedSections"],
      "PERSONAL non è fra le classi mascherate per il terzo stato: la sfera privata non va tolta al DPO",
    ).toBeUndefined();
  });

  /* (b) controprova: I20 non cambia per chi ha un mandato HR. */
  it("(b) HRMS_MANAGER sullo stesso dossier legge IN CHIARO: I20 non è stato toccato", async () => {
    const d = await usersService.getDossier(attore(hrms!, ["HRMS_MANAGER"]), soggetto!.id);
    const conImporto = d.paySlips.filter(
      (b) => (b as unknown as Record<string, unknown>)["grossPay"] !== undefined,
    );
    expect(
      conImporto.length,
      "il mandato HR deve continuare a vedere gli importi: se questa è vuota, D11 ha rotto I20",
    ).toBeGreaterThan(0);
    for (const b of d.paySlips) {
      expect((b as unknown as Record<string, unknown>)["masked"]).toBeUndefined();
    }
  });

  /* (c) controprova: I19, la catena sorella resta chiusa. */
  it("(c) una persona senza mandato non vede quel dossier: il terzo stato non ha aperto niente a nessun altro", async () => {
    await expect(
      usersService.getDossier(attore(estraneo!, estraneo!.ruoli), soggetto!.id),
    ).rejects.toThrow();
  });

  /* (d) controprova: il perimetro è il SUO tenant, non tutti (la differenza con ADR-0032). */
  it("(d) il DPO NON vede il dossier di una persona di un ALTRO tenant", async () => {
    await expect(
      usersService.getDossier(attore(dpo!, ["DPO"]), altroTenant!.id),
    ).rejects.toThrow();
  });

  /* (f) LA PORTA HTTP — la prova che mancava finché il permesso non è stato deciso.
   *
   * Enzo, 2026-09-25 (`esiti/RISPOSTE_ENZO.md`, riga «D11-permesso | 2026-09-25 | 1»): al DPO
   * si concede `user:read`, il permesso che già protegge questa rotta. Vista ROSSA prima della
   * migrazione `000451` (403 dal middleware RBAC: il permesso non c'era) e verde dopo, senza
   * cambiare una riga di `lib/scope/` — che è esattamente ciò che la separazione fra il «se»
   * (RBAC) e il «su chi/cosa» (i domini, ADR-0036) promette. */
  it("(f) via HTTP: il DPO fa login e apre GET /v1/users/:userId/dossier → 200, con gli importi mascherati", async () => {
    const key = readCollaudoKey();
    const r1 = await loginRaw(t.app, DPO_EMAIL, deriveCollaudoPassword(key, DPO_EMAIL));
    expect(r1.statusCode, `login ${DPO_EMAIL}`).toBe(200);
    const cookies = new Map<string, string>();
    for (const c of r1.cookies) cookies.set(c.name, c.value);
    const cookie = [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

    const r = await t.app.inject({
      method: "GET",
      url: `/v1/users/${soggetto!.id}/dossier`,
      headers: { cookie },
    });
    expect(
      r.statusCode,
      "403 qui vuol dire che il DPO non ha `user:read`: la migrazione 000451 non è applicata su questo database",
    ).toBe(200);

    const d = r.json() as {
      paySlips: Array<Record<string, unknown>>;
      performance: Array<Record<string, unknown>>;
    };
    expect(d.paySlips.length, "il soggetto ha buste paga: devono arrivare come RIGHE").toBeGreaterThan(0);
    for (const b of d.paySlips) {
      expect(b["grossPay"], "l'importo lordo è uscito dalla rotta HTTP").toBeUndefined();
      expect((b["masked"] as string[] | undefined) ?? []).toContain("grossPay");
    }
    for (const v of d.performance) {
      const masked = (v["masked"] as string[] | undefined) ?? [];
      expect(masked.length, "una valutazione letta dal DPO deve dichiarare cosa è stato trattenuto").toBeGreaterThan(0);
      for (const campo of masked) expect(v[campo]).toBeUndefined();
    }
  });

  /* (e) controprova: la prima delle quattro eccezioni già enumerate resta intatta. */
  it("(e) una segnalazione whistleblowing resta invisibile al DPO (isolamento assoluto, ADR-0036 §5)", async () => {
    const key = readCollaudoKey();
    const r1 = await loginRaw(t.app, DPO_EMAIL, deriveCollaudoPassword(key, DPO_EMAIL));
    expect(r1.statusCode, `login ${DPO_EMAIL}`).toBe(200);
    const cookies = new Map<string, string>();
    for (const c of r1.cookies) cookies.set(c.name, c.value);
    const cookie = [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

    const r = await t.app.inject({
      method: "GET",
      url: "/v1/whistleblowing/reports",
      headers: { cookie },
    });
    expect(
      r.statusCode,
      "il DPO non è la custodia: l'isolamento delle segnalazioni non conosce eccezioni, nemmeno la sua",
    ).toBe(403);
  });
});
