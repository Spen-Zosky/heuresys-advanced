/**
 * apps/api/test/consolidation-runs.integration.test.ts — il registro delle corse del modello (mig 000489).
 *
 * Che cosa si prova, con attori presi dal dato (un Direttore HR, una persona senza mandato):
 *   · la cartella delle consegne si legge per manifesto, e l'istante della corsa viene dal suo codice;
 *   · una corsa entra nel registro una volta sola (le corse doppie non si rifanno);
 *   · una sessione aperta su una corsa la lega, la porta IN_CONSOLIDAMENTO e ne diventa la prima;
 *   · il primo giro di un gruppo scrive i risultati iniziali, i successivi non li toccano;
 *   · aprire una sessione nuova chiude quella aperta solo se lo si chiede;
 *   · rendere definitiva una corsa sposta l'attivazione del tenant e supera la definitiva di prima;
 *   · solo il Direttore rende definitiva una corsa.
 * Il caricatore (processo figlio) non si lancia qui: scrive fuori dalla transazione del file, e ha le
 * sue prove (`db/scripts/pacchetto/prova-c3.sh`). L'isolamento transazionale annulla tutto a fine suite.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { tenantConsolidationService as svc } from "../src/modules/tenant-consolidation/service.js";
import {
  accogliConsegna,
  consegne,
  consegneDisponibili,
  inizioDalCodice,
  registraCorsa,
  risultatoIniziale,
} from "../src/modules/tenant-consolidation/corse.js";

let direttore: ActorContext;
let estraneo: ActorContext;
let versioneA = "";
let versioneB = "";
let cartella = "";
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);

async function ruoliDi(userId: string): Promise<RoleCode[]> {
  const r = await pool.query<{ code: string }>(
    `SELECT ro.auth_role_code AS code FROM sys.sys_user_auth_roles ur
       JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
      WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`,
    [userId],
  );
  return r.rows.map((x) => x.code) as RoleCode[];
}

async function codiceDi(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
}

/** Una variante nuova con una versione in bozza: il modello di una corsa di prova. */
async function versioneNuova(codice: string): Promise<string> {
  const fam = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name)
     VALUES ($1, 'Famiglia di prova del registro') RETURNING blueprint_family_id AS id`,
    [`PROVA_REG_${codice.toUpperCase()}`],
  );
  const v = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name)
     VALUES ($1, $2, 'Banca di prova') RETURNING blueprint_variant_id AS id`,
    [fam.rows[0]!.id, codice],
  );
  const vv = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_variant_versions
       (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
     VALUES ($1, 2, 'DRAFT') RETURNING blueprint_variant_version_id AS id`,
    [v.rows[0]!.id],
  );
  return vv.rows[0]!.id;
}

function scriviConsegna(radice: string, code: string, n: number, hash: string, il: string): void {
  const d = path.join(radice, code, String(n));
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "manifesto.json"), JSON.stringify({
    prototipo: code, versione: n, contratto: "heuresys.prototipo.pacchetto/0.3",
    impronta: { algoritmo: "sha256-json-canonico", valore: hash }, consegnatoIl: il,
  }));
  fs.writeFileSync(path.join(d, "pacchetto.json"), JSON.stringify({
    meta: { creatoIl: "2026-10-10T03:24:18.031Z" }, contesto: { descrizione: { it: "Banca di prova" } },
  }));
}

beforeAll(async () => {
  await loadRolePermissionCache();
  const d = await pool.query<{ user_id: string; user_tenant_id: string }>(
    `SELECT u.user_id, u.user_tenant_id FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'consolidation:decide' AND u.user_status = 'ACTIVE' AND u.user_tenant_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur2 JOIN sys.sys_auth_roles r2 ON r2.auth_role_id = ur2.user_auth_role_role_id
                         WHERE ur2.user_auth_role_user_id = u.user_id AND ur2.user_auth_role_revoked_at IS NULL AND r2.auth_role_is_platform)
      ORDER BY u.user_id LIMIT 1`,
  );
  const dir = d.rows[0];
  if (!dir) throw new Error("nessun utente con consolidation:decide");
  direttore = { userId: dir.user_id, tenantId: dir.user_tenant_id, roles: await ruoliDi(dir.user_id) };
  const e = await pool.query<{ user_id: string }>(
    `SELECT u.user_id FROM sys.sys_users u
      WHERE u.user_tenant_id = $1 AND u.user_status = 'ACTIVE' AND u.user_id <> $2
        AND EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles ur
            JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
            JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
           WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
             AND p.auth_permission_code = 'consolidation:read')
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles ur
            JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
            JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
           WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
             AND p.auth_permission_code = 'consolidation:decide')
      ORDER BY u.user_id LIMIT 1`,
    [direttore.tenantId, direttore.userId],
  );
  estraneo = e.rows[0]
    ? { userId: e.rows[0].user_id, tenantId: direttore.tenantId, roles: await ruoliDi(e.rows[0].user_id) }
    : { userId: direttore.userId, tenantId: direttore.tenantId, roles: [] };
  // le sessioni aperte del tenant si chiudono qui dentro: l'indice ne ammette una sola
  await pool.query(
    `UPDATE sys.sys_tenant_consolidations SET tenant_consolidation_status = 'CHIUSA'
      WHERE tenant_consolidation_tenant_id = $1 AND tenant_consolidation_status IN ('GIRI', 'IN_CONFERMA')`,
    [direttore.tenantId],
  );
  versioneA = await versioneNuova("p20261010010521tst");
  versioneB = await versioneNuova("p20261111020000tst");
  cartella = fs.mkdtempSync(path.join(os.tmpdir(), "consegne-"));
  scriviConsegna(cartella, "p20261010010521tst", 2, H1, "2026-11-14T03:44:54.076Z");
  scriviConsegna(cartella, "p20261111020000tst", 1, H2, "2026-11-14T05:00:00.000Z");
  fs.mkdirSync(path.join(cartella, "p20261212000000xyz", "1"), { recursive: true }); // senza manifesto: non è una consegna
});

afterAll(async () => {
  fs.rmSync(cartella, { recursive: true, force: true });
  await closePool();
});

describe("registro delle corse del modello", () => {
  it("legge le consegne per manifesto, la più recente prima, e data la corsa dal suo codice", () => {
    expect(inizioDalCodice("p20261010010521tjb")).toBe("2026-10-10T01:05:21.000Z");
    expect(inizioDalCodice("p2026xx")).toBeNull();
    const c = consegne(cartella);
    expect(c.map((x) => `${x.code}#${x.packageVersion}`)).toEqual(["p20261111020000tst#1", "p20261010010521tst#2"]);
    expect(c[1]).toMatchObject({ description: "Banca di prova", executedTo: "2026-10-10T03:24:18.031Z", packageHash: H1 });
  });

  it("una corsa entra nel registro una volta sola, e l'elenco delle consegne la segna", async () => {
    const t = direttore.tenantId!;
    const c = { code: "p20261010010521tst", packageVersion: 2, packageHash: H1, description: "Banca di prova",
      executedFrom: "2026-10-10T01:05:21.000Z", executedTo: "2026-10-10T03:24:18.031Z" };
    const id1 = await registraCorsa(pool, t, c, versioneA, direttore.userId);
    const id2 = await registraCorsa(pool, t, c, versioneA, direttore.userId);
    expect(id2).toBe(id1);
    const disp = await consegneDisponibili(t, cartella);
    expect(disp.configured).toBe(true);
    expect(disp.items.find((x) => x.code === "p20261010010521tst")?.runId).toBe(id1);
    expect(disp.items.find((x) => x.code === "p20261111020000tst")?.runId).toBeNull();
    // già nel registro: accoglierla di nuovo non lancia il caricatore e restituisce la stessa corsa
    const gia = await accogliConsegna(t, direttore.userId, "p20261010010521tst", 2, cartella);
    expect(gia.runId).toBe(id1);
    expect(await codiceDi(accogliConsegna(t, direttore.userId, "p20261010010521tst", 2, null)))
      .toBe("BLUEPRINT_RUN_DELIVERIES_UNAVAILABLE");
    expect(await codiceDi(accogliConsegna(t, direttore.userId, "p20261010010521tst", 9, cartella)))
      .toBe("BLUEPRINT_RUN_DELIVERY_NOT_FOUND");
    const [prima] = await svc.runs(direttore);
    expect(prima).toMatchObject({ runId: id1, status: "CARICATA", consolidations: 0, inUse: false, initialResults: {} });
  });

  it("la sessione aperta su una corsa la lega, e solo il primo giro di un gruppo scrive i risultati iniziali", async () => {
    const run = (await svc.runs(direttore)).find((r) => r.code === "p20261010010521tst")!;
    const s = await svc.start(direttore, { trigger: "RICHIESTA", runId: run.runId });
    expect(s.runId).toBe(run.runId);
    expect(s.variantVersionId).toBe(versioneA);
    const r0 = { tenantItems: 10, prototypeItems: 12, proposals: 14, matches: 8, certain: 5, gaps: 4, customizations: 2,
      ms: 61_000, at: "2026-11-14T06:00:00.000Z" };
    await risultatoIniziale(pool, s.consolidationId, "ORGANIZATION", r0);
    await risultatoIniziale(pool, s.consolidationId, "ORGANIZATION", { ...r0, proposals: 99, ms: 1 });
    const dopo = (await svc.runs(direttore)).find((r) => r.runId === run.runId)!;
    expect(dopo).toMatchObject({ status: "IN_CONSOLIDAMENTO", firstConsolidationId: s.consolidationId, consolidations: 1 });
    expect(dopo.initialResults.ORGANIZATION).toEqual(r0);

    // una sessione è già aperta: senza chiederlo la nuova è rifiutata, chiedendolo la vecchia si chiude
    expect(await codiceDi(svc.start(direttore, { trigger: "RICHIESTA", runId: run.runId }))).toBe("CONSOLIDATION_ALREADY_OPEN");
    const s2 = await svc.start(direttore, { trigger: "RICHIESTA", runId: run.runId, closeOpen: true });
    expect((await svc.get(direttore, s.consolidationId)).status).toBe("CHIUSA");
    // la seconda sessione non è la prima: i suoi giri non toccano la misura di partenza
    await risultatoIniziale(pool, s2.consolidationId, "SKILLS", r0);
    const ancora = (await svc.runs(direttore)).find((r) => r.runId === run.runId)!;
    expect(ancora.firstConsolidationId).toBe(s.consolidationId);
    expect(ancora.initialResults.SKILLS).toBeUndefined();
    expect(ancora.consolidations).toBe(2);
  });

  it("rendere definitiva una corsa sposta l'attivazione del tenant e supera la definitiva di prima", async () => {
    const t = direttore.tenantId!;
    const idB = await registraCorsa(pool, t, { code: "p20261111020000tst", packageVersion: 1, packageHash: H2,
      description: null, executedFrom: null, executedTo: null }, versioneB, direttore.userId);
    const runA = (await svc.runs(direttore)).find((r) => r.code === "p20261010010521tst")!;

    expect(await codiceDi(svc.makeDefinitive(estraneo, runA.runId))).toBe("PERMISSION_DENIED");
    // un modello senza ruoli né cruscotti svuoterebbe il profilo del tenant: si rifiuta
    expect(await codiceDi(svc.makeDefinitive(direttore, runA.runId))).toBe("BLUEPRINT_RUN_NOT_ACTIVATABLE");
    for (const v of [versioneA, versioneB]) {
      await pool.query(
        `INSERT INTO sys.sys_blueprint_content_job_roles (blueprint_content_job_role_version_id, blueprint_content_job_role_code, blueprint_content_job_role_name)
         VALUES ($1, 'PROVA_RUOLO', 'Ruolo di prova')`, [v]);
      await pool.query(
        `INSERT INTO sys.sys_blueprint_content_dashboards (blueprint_content_dashboard_version_id, blueprint_content_dashboard_code, blueprint_content_dashboard_name)
         VALUES ($1, 'self', 'Cruscotto di prova')`, [v]);
    }

    const a = await svc.makeDefinitive(direttore, runA.runId);
    expect(a).toMatchObject({ status: "DEFINITIVA", inUse: true });
    const stato = await pool.query<{ s: string }>(
      `SELECT blueprint_variant_version_status AS s FROM sys.sys_blueprint_variant_versions WHERE blueprint_variant_version_id = $1`,
      [versioneA],
    );
    expect(stato.rows[0]!.s).toBe("PUBLISHED");

    const b = await svc.makeDefinitive(direttore, idB);
    expect(b).toMatchObject({ status: "DEFINITIVA", inUse: true });
    const tutte = await svc.runs(direttore);
    expect(tutte.find((r) => r.runId === runA.runId)).toMatchObject({ status: "SUPERATA", inUse: false });
    // una sola attivazione ACTIVE per il tenant, sulla versione della corsa definitiva
    const att = await pool.query<{ v: string }>(
      `SELECT blueprint_activation_variant_version_id AS v FROM sys.sys_blueprint_activations
        WHERE blueprint_activation_tenant_id = $1 AND blueprint_activation_status = 'ACTIVE'`,
      [t],
    );
    expect(att.rows.map((x) => x.v)).toEqual([versioneB]);
    // le porte di ricompensa seguono il tenant sulla variante nuova (la 000400 le pretende)
    const porte = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reward_gate_completeness`,
    );
    expect(porte.rows[0]!.n).toBe(0);
    // il registro parte dalla corsa caricata più di recente
    expect(tutte[0]!.modelLoadedAt >= tutte[tutte.length - 1]!.modelLoadedAt).toBe(true);
  });
});
