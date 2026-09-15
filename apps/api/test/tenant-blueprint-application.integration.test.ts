/**
 * #198 T5 — l'atto che applica un fascicolo, e la prova che la transazionalità non sia finta.
 *
 * Il criterio del piano è duplice: *«un fascicolo applicato ha `applied_at` valorizzato **e** il
 * conteggio del registro coincide con le righe realmente create»*. E la prova che deve poter
 * fallire è precisa: **si sabota il passo 4 (registro) e l'intera applicazione deve tornare
 * indietro** — fascicolo di nuovo non applicato, nessuna riga creata. Se l'azienda restasse
 * costruita con il fascicolo non applicato, la transazionalità sarebbe una parola.
 *
 * Tutto gira su un'azienda usa-e-getta creata qui e rollbackata dall'isolamento transazionale
 * (D-52): nessun residuo sui due tenant di produzione.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "../src/db/client.js";
import { seminaModello, type ModelloDiProva } from "./helpers/modello-di-prova.js";
import {
  applyTenantBlueprintApplication,
  guasti,
} from "../src/modules/approvals/effects/tenant-blueprint-application.js";
import type { ApprovalRequestRow } from "../src/modules/approvals/repository.js";

const MARCA = `T5-${Date.now()}`;
// Il modello si SEMINA qui: non esiste piu' un archetipo globale da cercare (#132 F3).
let modello: ModelloDiProva;

let tenantId = "";
let versionId = "";
let blueprintId = "";

/** La richiesta di approvazione, ridotta a ciò che l'effetto legge davvero. */
function richiesta(resourceId: string): ApprovalRequestRow {
  return { resourceId, resourceType: "TENANT_BLUEPRINT_APPLICATION" } as ApprovalRequestRow;
}

async function contaGenerate(): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_generated_record_origins
      WHERE generated_record_origin_tenant_id = $1`,
    [tenantId],
  );
  return Number(r.rows[0]!.n);
}

async function contaUnita(): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1`,
    [tenantId],
  );
  return Number(r.rows[0]!.n);
}

/**
 * Una versione APPROVED nuova, legata all'azienda di collaudo.
 *
 * Serve perche' i casi NON devono dipendere dall'ordine: applicare consuma lo stato
 * (`APPROVED` -> applicata), quindi un caso che riusasse la versione di un altro
 * fallirebbe per il motivo sbagliato — ed e' successo, la prima volta che ho scritto
 * questa batteria.
 */
async function versioneApprovata(numero: number): Promise<string> {
  const v = await pool.query<{ tenant_blueprint_version_id: string }>(
    `INSERT INTO sys.sys_tenant_blueprint_versions
       (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number,
        tenant_blueprint_version_status, tenant_blueprint_version_variant_version_id,
        tenant_blueprint_version_approved_at)
     VALUES ($1, $2, 'APPROVED', $3, now())
     RETURNING tenant_blueprint_version_id`,
    [blueprintId, numero, modello.variantVersionId],
  );
  return v.rows[0]!.tenant_blueprint_version_id;
}

beforeAll(async () => {
  modello = await seminaModello(pool, MARCA);
  // `tenant_industry_code` è NOT NULL e senza default: un'azienda senza settore non esiste
  // (I21 — i dati che derivano dal settore devono essergli coerenti). `FIN_BANKING` è quello
  // dell'archetipo usato qui, quindi la fixture nasce già coerente invece che «qualsiasi».
  const t = await pool.query<{ tenant_id: string }>(
    `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status, tenant_industry_code)
     VALUES ($1, $2, 'ACTIVE', 'FIN_BANKING') RETURNING tenant_id`,
    [`E2E-${MARCA}`, `Azienda di collaudo ${MARCA}`],
  );
  tenantId = t.rows[0]!.tenant_id;

  const b = await pool.query<{ tenant_blueprint_id: string }>(
    `INSERT INTO sys.sys_tenant_blueprints (tenant_blueprint_code, tenant_blueprint_name, tenant_blueprint_tenant_id, tenant_blueprint_status)
     VALUES ($1, $2, $3, 'ACTIVE') RETURNING tenant_blueprint_id`,
    [`E2E-BP-${MARCA}`, `Fascicolo di collaudo ${MARCA}`, tenantId],
  );
  blueprintId = b.rows[0]!.tenant_blueprint_id;

  // La versione di variante del modello seminato dichiara la sorgente: è il campo che T1 ha
  // aggiunto, ed è ciò che rende la costruzione parametrica invece che cablata (E21).

  const v = await pool.query<{ tenant_blueprint_version_id: string }>(
    `INSERT INTO sys.sys_tenant_blueprint_versions
       (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number,
        tenant_blueprint_version_status, tenant_blueprint_version_variant_version_id,
        tenant_blueprint_version_approved_at)
     VALUES ($1, 1, 'APPROVED', $2, now())
     RETURNING tenant_blueprint_version_id`,
    [blueprintId, modello.variantVersionId],
  );
  versionId = v.rows[0]!.tenant_blueprint_version_id;
});

afterAll(() => {
  guasti.registro = false; // che il test passi o no, il punto di sabotaggio si richiude
});

describe("#198 T5 — l'applicazione del fascicolo", () => {
  it("SABOTANDO il registro, l'intera applicazione torna indietro", async () => {
    const unitaPrima = await contaUnita();
    const registroPrima = await contaGenerate();

    guasti.registro = true;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(applyTenantBlueprintApplication(client, richiesta(versionId))).rejects.toThrow(
        /guasto simulato/,
      );
      await client.query("ROLLBACK");
    } finally {
      client.release();
      guasti.registro = false;
    }

    // Il punto della prova: NON deve essere rimasto niente. Se le unità fossero state create
    // e il fascicolo fosse tornato APPROVED, avremmo un'azienda costruita da un fascicolo che
    // dichiara di non averla costruita.
    expect(await contaUnita(), "sono rimaste unità di un'applicazione fallita").toBe(unitaPrima);
    expect(await contaGenerate(), "sono rimaste righe di registro").toBe(registroPrima);
    const v = await pool.query<{ applied: string | null }>(
      `SELECT tenant_blueprint_version_applied_at AS applied FROM sys.sys_tenant_blueprint_versions WHERE tenant_blueprint_version_id = $1`,
      [versionId],
    );
    expect(v.rows[0]!.applied, "il fascicolo risulta applicato dopo un fallimento").toBeNull();
  });

  // Mandato K, I-A passo 13 (S1103): una personalizzazione del cliente (override) inserita PRIMA
  // dell'applicazione deve esserci ancora DOPO, identica. La prova gira dentro l'isolamento
  // transazionale per file (D-52): copia usa-e-getta per costruzione, niente resta sul database.
  // Le due `it` sono in coppia attorno all'applicazione pulita qui sotto: la prima semina, la
  // seconda misura. Se la rigenerazione toccasse gli override, la seconda sarebbe ROSSA.
  let overrideId = "";
  it("K I-A/13 — prima dell'applicazione: nasce un override del cliente su un processo del modello", async () => {
    const p = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_process_registry
         (blueprint_process_variant_id, blueprint_process_variant_version_id, blueprint_process_code,
          blueprint_process_name, blueprint_process_ordinal, blueprint_process_is_optional, blueprint_process_metadata)
       VALUES ($1, $2, $3, $4, 1, false, '{}'::jsonb) RETURNING blueprint_process_id AS id`,
      [modello.variantId, modello.variantVersionId, `PROC-K13-${MARCA}`, `Processo di prova K I-A/13 ${MARCA}`],
    );
    const a = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_activations
         (blueprint_activation_tenant_id, blueprint_activation_variant_id, blueprint_activation_status,
          blueprint_activation_effective_from, blueprint_activation_metadata)
       VALUES ($1, $2, 'ACTIVE', current_date, '{}'::jsonb) RETURNING blueprint_activation_id AS id`,
      [tenantId, modello.variantId],
    );
    const o = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_overrides
         (blueprint_override_activation_id, blueprint_override_process_id, blueprint_override_inclusion,
          blueprint_override_rationale, blueprint_override_metadata)
       VALUES ($1, $2, 'OUT', 'mandato K, I-A passo 13: deve sopravvivere alla rigenerazione', '{}'::jsonb)
       RETURNING blueprint_override_id AS id`,
      [a.rows[0]!.id, p.rows[0]!.id],
    );
    overrideId = o.rows[0]!.id;
    expect(overrideId).not.toBe("");
  });

  it("senza sabotaggio: applica, costruisce e registra OGNI riga creata", async () => {
    // Niente BEGIN qui: l'isolamento transazionale per FILE (D-52) avvolge già tutto e
    // rollbacka a fine file. Aprirne un'altra a mano interferisce coi savepoint dell'helper.
    const client = await pool.connect();
    try {
      await applyTenantBlueprintApplication(client, richiesta(versionId));

      // il fascicolo è applicato — e «applicato» sono DUE cose, non una. Questa asserzione
      // ne guardava una sola (`applied_at`), e per una sessione intera l'effetto ha lasciato
      // lo stato su `APPROVED` senza che niente lo notasse: il difetto è emerso alla prima
      // costruzione vera (T9, S1069), dove un'azienda appena costruita mostrava un fascicolo
      // ancora «approvato». Un test che verifica metà di un criterio duplice — e l'intestazione
      // di questo file lo dichiara duplice fin dalla riga 4 — copre il difetto invece di vederlo.
      const v = await client.query<{ applied: string | null; stato: string }>(
        `SELECT tenant_blueprint_version_applied_at AS applied,
                tenant_blueprint_version_status AS stato
           FROM sys.sys_tenant_blueprint_versions WHERE tenant_blueprint_version_id = $1`,
        [versionId],
      );
      expect(v.rows[0]!.applied, "applied_at non valorizzato").not.toBeNull();
      expect(v.rows[0]!.stato, "lo stato è rimasto indietro rispetto alla data").toBe("APPLIED");

      // …le righe esistono…
      const unita = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1`,
        [tenantId],
      );
      expect(Number(unita.rows[0]!.n)).toBeGreaterThan(0);

      // …e OGNI riga creata ha la sua origine. Il conteggio del registro deve coprire le
      // righe nate in tutte le tabelle, non solo in una.
      const reg = await client.query<{ tab: string; n: string }>(
        `SELECT generated_record_origin_target_table AS tab, count(*)::text AS n
           FROM sys.sys_generated_record_origins
          WHERE generated_record_origin_tenant_id = $1
          GROUP BY 1 ORDER BY 1`,
        [tenantId],
      );
      const perTabella = Object.fromEntries(reg.rows.map((r) => [r.tab, Number(r.n)]));
      expect(perTabella.sys_organization_units).toBe(Number(unita.rows[0]!.n));
      expect(Object.keys(perTabella).length, `registrate solo: ${Object.keys(perTabella)}`).toBeGreaterThan(3);

      // e ogni riga di registro porta la ragione che la giustifica
      const senzaRagione = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_generated_record_origins
          WHERE generated_record_origin_tenant_id = $1
            AND coalesce(generated_record_origin_metadata->>'justification', '') = ''`,
        [tenantId],
      );
      expect(Number(senzaRagione.rows[0]!.n), "righe di registro senza giustificazione").toBe(0);
    } finally {
      client.release();
    }
  });

  it("K I-A/13 — dopo l'applicazione: l'override c'è ancora, identico, con i suoi padri vivi", async () => {
    const o = await pool.query<{ inclusione: string; ragione: string; attivazione: string | null; processo: string | null }>(
      `SELECT o.blueprint_override_inclusion AS inclusione, o.blueprint_override_rationale AS ragione,
              a.blueprint_activation_id::text AS attivazione, p.blueprint_process_id::text AS processo
         FROM sys.sys_blueprint_overrides o
         LEFT JOIN sys.sys_blueprint_activations a ON a.blueprint_activation_id = o.blueprint_override_activation_id
         LEFT JOIN sys.sys_blueprint_process_registry p ON p.blueprint_process_id = o.blueprint_override_process_id
        WHERE o.blueprint_override_id = $1`,
      [overrideId],
    );
    expect(o.rows.length, "l'override e' sparito con la rigenerazione").toBe(1);
    expect(o.rows[0]!.inclusione).toBe("OUT");
    expect(o.rows[0]!.ragione).toContain("passo 13");
    expect(o.rows[0]!.attivazione, "l'attivazione padre e' stata cancellata (CASCADE)").not.toBeNull();
    expect(o.rows[0]!.processo, "il processo padre e' stato cancellato (CASCADE)").not.toBeNull();
    // e il registro del generato non ha marchiato l'override come proprio: e' del cliente
    const reg = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_generated_record_origins
        WHERE generated_record_origin_target_table = 'sys_blueprint_overrides'`,
    );
    expect(Number(reg.rows[0]!.n)).toBe(0);
  });

  it("un fascicolo GIÀ applicato non si riapplica (l'UPDATE è guardato)", async () => {
    const propria = await versioneApprovata(99);
    const client = await pool.connect();
    try {
      await applyTenantBlueprintApplication(client, richiesta(propria));
      // secondo giro: lo stato non è più quello che l'UPDATE guardato pretende
      await expect(applyTenantBlueprintApplication(client, richiesta(propria))).rejects.toThrow(
        /non è APPROVED, o è già stata applicata/,
      );
    } finally {
      client.release();
    }
  });
});
