/**
 * apps/api/test/chain-threshold-surfaces.integration.test.ts — #99 F4, il residuo.
 *
 * LA REGOLA ESISTEVA, LE SUPERFICI NO.
 *
 * `chain-threshold-pay.integration.test.ts` prova la FUNZIONE `masksTopOfChainPay` e la
 * prova bene. Ma una regola di autorizzazione non vive nella funzione che la calcola:
 * vive nelle porte da cui i dati escono. Misurato il 2026-08-14: la soglia di catena era
 * innestata su **`compensation/service.ts` soltanto**, mentre lo stesso dato — quanto
 * prende un vertice — usciva anche dal **dossier della persona** senza passarci.
 *
 * L'effetto era che la stessa domanda aveva due risposte diverse a seconda della porta:
 * il direttore HR (livello 3) NON vedeva la paga del CEO in `/v1/compensation/*`, e la
 * vedeva aprendo `/v1/users/:id/dossier`.
 *
 * I protagonisti si derivano dall'albero e dai dati, mai per nome: se l'organigramma
 * cambia, questa verifica sceglie altre persone invece di misurare il caso sbagliato — e
 * se un giorno non esistesse più nessun vertice retribuito, lo dice e fallisce, invece di
 * passare per assenza di casi.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { LIVELLO_VERTICE } from "../src/lib/scope/mask.js";
import { usersService } from "../src/modules/users/service.js";
import type { ActorContext } from "../src/lib/actor.js";

let t: TestApp;

interface Persona {
  id: string;
  email: string;
  tenantId: string;
  livello: number;
  ruoli: string[];
  buste: number;
  contratti: number;
}

/** Persone attive con il loro livello nell'albero delle UNITÀ (ADR-0036) e i dati di paga che hanno. */
async function persone(): Promise<Persona[]> {
  const r = await pool.query<{
    id: string; email: string; tenant_id: string; livello: string;
    ruoli: string[]; buste: string; contratti: string;
  }>(
    `WITH RECURSIVE albero AS (
       SELECT organization_unit_id AS ou, 1 AS livello FROM sys.sys_organization_units
        WHERE organization_unit_parent_id IS NULL AND organization_unit_is_active
       UNION ALL
       SELECT o.organization_unit_id, a.livello + 1 FROM sys.sys_organization_units o
         JOIN albero a ON o.organization_unit_parent_id = a.ou WHERE o.organization_unit_is_active
     )
     SELECT u.user_id AS id, u.user_email AS email, u.user_tenant_id AS tenant_id,
            min(a.livello)::text AS livello,
            coalesce(array_agg(DISTINCT r.auth_role_code) FILTER (WHERE r.auth_role_code IS NOT NULL), '{}') AS ruoli,
            (SELECT count(*) FROM sys.sys_user_pay_slips ps WHERE ps.user_pay_slip_user_id = u.user_id)::text AS buste,
            (SELECT count(*) FROM sys.sys_user_contracts c WHERE c.user_contract_user_id = u.user_id)::text AS contratti
       FROM albero a
       JOIN sys.sys_positions p ON p.position_organization_unit_id = a.ou
       JOIN sys.sys_user_position_assignments upa
            ON upa.user_position_assignment_position_id = p.position_id
           AND upa.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_users u ON u.user_id = upa.user_position_assignment_user_id AND u.user_status = 'ACTIVE'
       LEFT JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                                           AND ur.user_auth_role_revoked_at IS NULL
       LEFT JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      GROUP BY u.user_id, u.user_email, u.user_tenant_id`,
  );
  return r.rows.map((x) => ({
    id: x.id, email: x.email, tenantId: x.tenant_id, livello: Number(x.livello),
    ruoli: x.ruoli, buste: Number(x.buste), contratti: Number(x.contratti),
  }));
}

const attore = (p: Persona, ruoli: string[]): ActorContext =>
  ({ userId: p.id, tenantId: p.tenantId, roles: ruoli } as unknown as ActorContext);

let vertice: Persona | undefined;
let hrSottoSoglia: Persona | undefined;

beforeAll(async () => {
  t = await buildTestApp();
  const tutti = await persone();
  // Un vertice che ha DAVVERO qualcosa da nascondere: senza buste o contratto la
  // verifica non guarderebbe nulla.
  vertice = tutti.find((p) => p.livello <= LIVELLO_VERTICE && (p.buste > 0 || p.contratti > 0));
  hrSottoSoglia = tutti.find(
    (p) => p.livello > LIVELLO_VERTICE && p.ruoli.some((r) => r === "HRMS_MANAGER" || r === "TENANT_ADMIN"),
  );
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#99 F4 — la soglia di catena sulle SUPERFICI, non solo nella funzione", () => {
  it("gira su un universo dove PUÒ fallire: un vertice retribuito e un mandato HR sotto la soglia", () => {
    if (!vertice || !hrSottoSoglia) {
      throw new Error(
        "Manca un vertice con dati di retribuzione, oppure un mandato HR sotto la soglia. " +
          "Senza i due protagonisti questa verifica non guarda niente e non va contata fra le superate.",
      );
    }
    expect(vertice.livello).toBeLessThanOrEqual(LIVELLO_VERTICE);
    expect(vertice.buste + vertice.contratti).toBeGreaterThan(0);
    expect(hrSottoSoglia.livello).toBeGreaterThan(LIVELLO_VERTICE);
  });

  it("il dossier di un vertice, letto da un mandato HR sotto soglia, NON porta importi", async () => {
    const d = await usersService.getDossier(attore(hrSottoSoglia!, ["HRMS_MANAGER"]), vertice!.id);

    // (a) le buste paga: la riga resta (periodo, stato), il denaro no.
    for (const b of d.paySlips) {
      const m = (b as unknown as { masked?: string[] }).masked ?? [];
      expect(
        (b as unknown as Record<string, unknown>)["grossPay"],
        `busta ${JSON.stringify((b as unknown as Record<string, unknown>)["period"] ?? "")}: l'importo lordo di un vertice è uscito`,
      ).toBeUndefined();
      expect(m, "la busta deve DICHIARARE cosa ha trattenuto, non tacerlo").toContain("grossPay");
    }

    // (b) i contratti: l'inquadramento resta, la retribuzione annua no.
    for (const c of d.contracts) {
      expect(
        (c as unknown as Record<string, unknown>)["grossAnnualSalary"],
        "la retribuzione annua di un vertice è uscita dal contratto",
      ).toBeUndefined();
    }

    // (c) l'anagrafica del rapporto: lo stipendio non deve esserci.
    const emp = (d.profile as unknown as { employment?: Record<string, unknown> }).employment;
    if (emp) {
      expect(emp["salary"], "lo stipendio di un vertice è uscito dall'anagrafica del rapporto").toBeUndefined();
    }
  });

  it("il vertice legge il PROPRIO dossier per intero — I17 vince sulla soglia", async () => {
    const d = await usersService.getDossier(attore(vertice!, ["USER"]), vertice!.id);
    // Almeno una delle due famiglie deve arrivare intera: è la prova che la soglia non
    // si è mangiata anche il caso che I17 protegge.
    const busteIntere = d.paySlips.every((b) => !((b as unknown as { masked?: string[] }).masked ?? []).includes("grossPay"));
    const contrattiInteri = d.contracts.every(
      (c) => !((c as unknown as { masked?: string[] }).masked ?? []).includes("grossAnnualSalary"),
    );
    expect(busteIntere && contrattiInteri, "la propria retribuzione si vede sempre").toBe(true);
  });
});
