/**
 * #206 T6 + T7 — l'atto che applica una corsa di importazione firmata, e le prove che devono
 * poter fallire (piano P4):
 *
 *   T6 · SABOTANDO il passo del registro, l'INTERA iniezione torna indietro: nessuna persona
 *        nata, la corsa ancora RUNNING, la fonte ancora AVAILABLE. Se restano righe, la
 *        transazione non copre il passo — «il difetto peggiore possibile in questo task».
 *   T7 · dopo una corsa completata: le persone esistono con incarico PRIMARY; il SEGNAPOSTO e'
 *        SUPERSEDED nel registro, DEACTIVATED come utente, incarico ENDED — mai cancellato;
 *        NESSUNA POSIZIONE e' SUPERSEDED (e' il caso controintuitivo: la posizione era giusta);
 *        posizioni e unita' toccate sono CONFIRMED; la fonte e' INGESTED; l'eccezione con
 *        scostamento e' nominata in `sys_seed_approval_decisions`.
 *   ·    ri-applicare la stessa corsa fallisce (l'UPDATE e' guardato).
 *
 * Tutto su un'azienda usa-e-getta costruita da P3 e rollbackata dall'isolamento per file (D-52).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "../src/db/client.js";
import { costruisciAziendaP4, righeDelCliente, type AziendaDiProvaP4 } from "./helpers/azienda-di-prova-p4.js";
import { tenantImportRunsService } from "../src/modules/tenant-import-runs/service.js";
import { applyTenantImportRun, guasti, TENANT_IMPORT_RUN } from "../src/modules/approvals/effects/tenant-import-run.js";
import type { ApprovalRequestRow } from "../src/modules/approvals/repository.js";
import type { ActorContext } from "../src/lib/actor.js";
import { platformAdmin } from "./helpers/actors.js";

const MARCA = `P4E-${Date.now()}`;
let az: AziendaDiProvaP4;
let attore: ActorContext;
let runId = "";
let sourceExportId = "";

function richiesta(): ApprovalRequestRow {
  return { approvalRequestId: "00000000-0000-0000-0000-000000000000", resourceId: runId, resourceType: TENANT_IMPORT_RUN, createdBy: attore.userId } as ApprovalRequestRow;
}

async function contaPersoneVere(): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_users WHERE user_tenant_id = $1 AND user_type = 'STANDARD'`, [az.tenantId],
  );
  return Number(r.rows[0]!.n);
}

async function statoCorsa(): Promise<string> {
  const r = await pool.query<{ s: string }>(`SELECT seed_acquisition_run_status AS s FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_id = $1`, [runId]);
  return r.rows[0]!.s;
}

async function statoFonte(): Promise<string> {
  const r = await pool.query<{ s: string }>(`SELECT source_export_status AS s FROM reference_sync.source_exports WHERE source_export_id = $1`, [sourceExportId]);
  return r.rows[0]!.s;
}

beforeAll(async () => {
  az = await costruisciAziendaP4(pool, MARCA);
  const admin = await platformAdmin();
  attore = { userId: admin.userId, tenantId: admin.tenantId, roles: ["PLATFORM_ADMIN"] };
  const fonte = await tenantImportRunsService.registraFonte(attore, { name: `Estrazione HR ${MARCA}`, rows: righeDelCliente(az, MARCA), metadata: {} });
  sourceExportId = fonte.source.sourceExportId;
  const corsa = await tenantImportRunsService.apriCorsa(attore, { sourceExportId, tenantId: az.tenantId });
  runId = corsa.runId;
  expect(corsa.referto).toEqual({ persone: 5, ammesse: 1, conScostamento: 1, cieche: 1, escluse: 2 });
  // Da Windows il tunnel paga ogni round-trip: costruzione di P3 + atterraggio + validazione
  // misurano ~35 s (S1098), sopra il hookTimeout di 30 s. Sul gemello e in CI il DB e' locale.
}, 120_000);

afterAll(() => {
  guasti.registro = false;
});

describe("#206 T6/T7 — l'atto della corsa firmata", () => {
  it("T6 · SABOTANDO il registro, l'intera iniezione torna indietro", async () => {
    expect(await contaPersoneVere()).toBe(0);
    guasti.registro = true;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(applyTenantImportRun(client, richiesta())).rejects.toMatchObject({ code: "APPLY_EFFECT_FAILED" });
      await client.query("ROLLBACK");
    } finally {
      guasti.registro = false;
      client.release();
    }
    expect(await contaPersoneVere(), "persone nate nonostante il rollback").toBe(0);
    expect(await statoCorsa()).toBe("RUNNING");
    expect(await statoFonte()).toBe("AVAILABLE");
    const seg = await pool.query<{ s: string }>(`SELECT user_status AS s FROM sys.sys_users WHERE user_id = $1`, [az.segnaposto.userId]);
    expect(seg.rows[0]!.s, "il segnaposto e' stato disattivato nonostante il rollback").toBe("ACTIVE");
  });

  it("T7 · senza sabotaggio: le persone entrano, il segnaposto cede, NESSUNA posizione e' SUPERSEDED", async () => {
    const client = await pool.connect();
    let esito;
    try {
      esito = await applyTenantImportRun(client, richiesta());
    } finally {
      client.release();
    }
    expect(esito).toMatchObject({ iniettate: 3, segnapostiSostituiti: 1, escluse: 2 });
    expect(esito.posizioniConfermate).toBe(3);
    expect(esito.unitaConfermate).toBeGreaterThan(0);

    expect(await contaPersoneVere()).toBe(3);
    expect(await statoCorsa()).toBe("COMPLETED");
    expect(await statoFonte()).toBe("INGESTED");

    // ogni persona entrata ha UN incarico PRIMARY ACTIVE sulla posizione dichiarata
    const inc = await pool.query<{ email: string; code: string; start: string }>(
      `SELECT u.user_email AS email, p.position_code AS code, a.user_position_assignment_start_date::text AS start
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
        WHERE a.user_position_assignment_tenant_id = $1 AND a.user_position_assignment_status = 'ACTIVE'
          AND a.user_position_assignment_kind = 'PRIMARY' AND u.user_type = 'STANDARD'
        ORDER BY 1`,
      [az.tenantId],
    );
    expect(inc.rows.map((r) => [r.email.split("@")[0], r.code])).toEqual([
      ["anna.verdi", az.codici.dg], ["bruno.neri", az.codici.capo], ["carla.bianchi", az.codici.extra],
    ]);
    // la data non esistente ('31/02/2024') NON e' entrata come data: l'incarico parte da oggi
    expect(inc.rows[0]!.start).toBe("2021-03-15");
    expect(inc.rows[2]!.start).toBe("2023-09-01");
    expect(inc.rows[1]!.start).not.toBe("2024-02-31");

    // il segnaposto: SUPERSEDED nel registro, DEACTIVATED, incarico ENDED — e ANCORA LI'
    const seg = await pool.query<{ status: string; n_ass: string }>(
      `SELECT u.user_status AS status,
              (SELECT count(*)::text FROM sys.sys_user_position_assignments a
                WHERE a.user_position_assignment_id = $2 AND a.user_position_assignment_status = 'ENDED') AS n_ass
         FROM sys.sys_users u WHERE u.user_id = $1`,
      [az.segnaposto.userId, az.segnaposto.assignmentId],
    );
    expect(seg.rows[0], "il segnaposto e' stato CANCELLATO: ADR-0035 vieta").toBeDefined();
    expect(seg.rows[0]!.status).toBe("DEACTIVATED");
    expect(seg.rows[0]!.n_ass).toBe("1");
    const reg = await pool.query<{ tab: string; status: string; run: string | null }>(
      `SELECT generated_record_origin_target_table AS tab, generated_record_origin_status AS status,
              generated_record_origin_superseded_by_run_id AS run
         FROM sys.sys_generated_record_origins
        WHERE generated_record_origin_target_record_id IN ($1, $2) ORDER BY 1`,
      [az.segnaposto.userId, az.segnaposto.assignmentId],
    );
    expect(reg.rows).toEqual([
      { tab: "sys_user_position_assignments", status: "SUPERSEDED", run: runId },
      { tab: "sys_users", status: "SUPERSEDED", run: runId },
    ]);

    // IL CASO CONTROINTUITIVO: nessuna posizione (ne' unita') e' SUPERSEDED; quelle toccate sono CONFIRMED
    const pos = await pool.query<{ status: string; n: string }>(
      `SELECT generated_record_origin_status AS status, count(*)::text AS n
         FROM sys.sys_generated_record_origins
        WHERE generated_record_origin_tenant_id = $1 AND generated_record_origin_target_table IN ('sys_positions', 'sys_organization_units')
        GROUP BY 1 ORDER BY 1`,
      [az.tenantId],
    );
    const perStato = Object.fromEntries(pos.rows.map((r) => [r.status, Number(r.n)]));
    expect(perStato.SUPERSEDED ?? 0, "P4 sta smontando l'azienda costruita da P3").toBe(0);
    expect(perStato.CONFIRMED).toBeGreaterThanOrEqual(3);

    // E26: l'eccezione con scostamento e' NOMINATA, con cio' che manca
    const ecc = await pool.query<{ rationale: string }>(
      `SELECT d.seed_approval_decision_rationale AS rationale
         FROM sys.sys_seed_approval_decisions d
         JOIN sys.sys_seed_candidate_records c ON c.seed_candidate_record_id = d.seed_approval_decision_candidate_id
        WHERE c.seed_candidate_record_run_id = $1`,
      [runId],
    );
    expect(ecc.rows).toHaveLength(1);
    expect(ecc.rows[0]!.rationale).toContain("Lean manufacturing");

    // le competenze dichiarate sono scritte: la vista di E25 vede lo scostamento di Carla e non quello di Anna
    const gap = await pool.query<{ email: string; mancanti: string; cieca: boolean }>(
      `SELECT user_email AS email, requisiti_critici_mancanti::text AS mancanti, cieca
         FROM sys.v_positions_with_critical_skill_gap WHERE tenant_id = $1 ORDER BY 1`,
      [az.tenantId],
    );
    expect(gap.rows.map((r) => [r.email.split("@")[0], r.mancanti, r.cieca])).toEqual([
      ["anna.verdi", "0", false], ["bruno.neri", "0", true], ["carla.bianchi", "1", false],
    ]);
  });

  it("ri-applicare la stessa corsa fallisce: l'UPDATE e' guardato", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(applyTenantImportRun(client, richiesta())).rejects.toMatchObject({ code: "APPLY_EFFECT_FAILED" });
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    expect(await contaPersoneVere()).toBe(3);
  });

  it("una fonte INGESTED non apre una seconda corsa", async () => {
    await expect(tenantImportRunsService.apriCorsa(attore, { sourceExportId, tenantId: az.tenantId }))
      .rejects.toMatchObject({ code: "SOURCE_NOT_AVAILABLE" });
  });
});
