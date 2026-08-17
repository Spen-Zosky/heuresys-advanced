/**
 * apps/api/src/modules/approvals/effects/tenant-blueprint-application.ts
 * #198 T5 — L'ATTO: `APPROVED → APPLIED` (Tenant Builder P3, S1067).
 *
 * P1 ha reso il fascicolo definitivo (`#131`: `APPROVED` + fotografia). P3 lo **applica**:
 * dall'azienda descritta all'azienda che esiste, con **ogni riga riconducibile** al fascicolo
 * che l'ha voluta.
 *
 * TUTTO NELLA STESSA TRANSAZIONE, e non è una preferenza di stile. Se il registro
 * dell'origine fallisse dopo che le righe sono nate, resterebbe un'azienda costruita che
 * nessuno può ricondurre a un fascicolo — cioè esattamente il difetto che P3 esiste per
 * chiudere, prodotto dal codice che dovrebbe chiuderlo. L'ordine è quello della specifica
 * §5.1, e ogni passo può far fallire l'intero atto:
 *
 *   1. `APPROVED → APPLIED` con UPDATE **guardato sullo stato atteso**;
 *   2. la guardia sull'azienda **ri-verificata adesso** — l'approvazione è asincrona, e fra
 *      il «sì» e questo istante l'azienda può essere stata sospesa;
 *   3. costruzione del piano ed esecuzione;
 *   4. **una riga di registro per ogni riga creata**;
 *   5. proiezione dell'identità sull'azienda (§5.7).
 *
 * Idioma di `applyTenantActivation`: uno 0-righe su un UPDATE guardato diventa
 * `APPLY_EFFECT_FAILED`, che fa rollback anche di `markApplied`. Un fascicolo `APPLIED`
 * senza la sua azienda non può esistere, e nemmeno il contrario.
 */
import type { PoolClient } from "pg";
import type { ApprovalRequestRow } from "../repository.js";
import { ConflictError } from "../../../errors/index.js";
import { ArchetypeBuildSource } from "../../tenant-materialization/build-source.js";
import { materialize } from "../../tenant-materialization/repository.js";

export const TENANT_BLUEPRINT_APPLICATION = "TENANT_BLUEPRINT_APPLICATION";

/**
 * Punto di sabotaggio dichiarato, per la prova che deve poter fallire (piano T5).
 *
 * La prova chiede: si rompe il passo 4 e si verifica che **l'intera applicazione torni
 * indietro**. Senza un modo di romperlo, quella prova non è eseguibile e resterebbe
 * un'affermazione. È esportato e usato SOLO dai test; in produzione vale sempre `false`,
 * e il test lo rimette a posto in `finally`.
 */
export const guasti = { registro: false };

interface VersioneRow {
  tenant_blueprint_version_id: string;
  tenant_blueprint_id: string;
  tenant_blueprint_tenant_id: string | null;
  build_source_key: string | null;
}

export async function applyTenantBlueprintApplication(
  client: PoolClient,
  request: ApprovalRequestRow,
): Promise<void> {
  const versionId = request.resourceId;
  if (!versionId) {
    throw new ConflictError(
      "L'applicazione del fascicolo non indica quale versione (resource_id)",
      "APPLY_EFFECT_FAILED",
    );
  }

  // --- 1. APPROVED → APPLIED, guardato sullo stato atteso.
  // Il `WHERE … = 'APPROVED'` non è una formalità: senza, ri-applicare un fascicolo già
  // applicato ricostruirebbe l'azienda una seconda volta e il registro conterebbe due
  // origini per le stesse righe.
  const applicato = await client.query<VersioneRow>(
    `UPDATE sys.sys_tenant_blueprint_versions v
        SET tenant_blueprint_version_applied_at = now()
      WHERE v.tenant_blueprint_version_id = $1
        AND v.tenant_blueprint_version_status = 'APPROVED'
        AND v.tenant_blueprint_version_applied_at IS NULL
      RETURNING v.tenant_blueprint_version_id,
                v.tenant_blueprint_version_blueprint_id AS tenant_blueprint_id,
                (SELECT b.tenant_blueprint_tenant_id FROM sys.sys_tenant_blueprints b
                  WHERE b.tenant_blueprint_id = v.tenant_blueprint_version_blueprint_id) AS tenant_blueprint_tenant_id,
                (SELECT vv.blueprint_variant_version_build_source_key
                   FROM sys.sys_blueprint_variant_versions vv
                  WHERE vv.blueprint_variant_version_id = v.tenant_blueprint_version_variant_version_id) AS build_source_key`,
    [versionId],
  );
  if (applicato.rowCount !== 1) {
    throw new ConflictError(
      "La versione non è APPROVED, o è già stata applicata",
      "APPLY_EFFECT_FAILED",
    );
  }
  const versione = applicato.rows[0]!;

  // --- 2. la guardia sull'azienda, ri-verificata ADESSO.
  const tenantId = versione.tenant_blueprint_tenant_id;
  if (!tenantId) {
    throw new ConflictError(
      "Il fascicolo non è legato a un'azienda: non c'è nulla da costruire",
      "APPLY_EFFECT_FAILED",
    );
  }
  const stato = await client.query<{ tenant_status: string }>(
    `SELECT tenant_status FROM sys.sys_tenancies WHERE tenant_id = $1`,
    [tenantId],
  );
  const statoAzienda = stato.rows[0]?.tenant_status;
  if (statoAzienda !== "ACTIVE") {
    throw new ConflictError(
      `L'azienda di destinazione non è ACTIVE (status=${statoAzienda ?? "assente"})`,
      "APPLY_EFFECT_FAILED",
    );
  }

  // --- 3. il piano e la costruzione. La sorgente la dichiara il fascicolo (E21): una chiave
  //        ignota non ripiega su un archetipo qualsiasi, fa fallire l'atto.
  const chiave = versione.build_source_key;
  if (!chiave) {
    throw new ConflictError(
      "La versione non dichiara una sorgente di costruzione (build_source_key)",
      "APPLY_EFFECT_FAILED",
    );
  }
  const sorgente = ArchetypeBuildSource.fromKey(chiave);
  if (!sorgente) {
    throw new ConflictError(`Sorgente di costruzione sconosciuta: ${chiave}`, "APPLY_EFFECT_FAILED");
  }
  const piano = await sorgente.plan();
  const esito = await materialize(client, tenantId, piano, "apply");

  // --- 4. una riga di registro per ogni riga creata.
  if (guasti.registro) {
    throw new ConflictError(
      "guasto simulato nel registro dell'origine (prova di transazionalità)",
      "APPLY_EFFECT_FAILED",
    );
  }
  if (esito.records.length > 0) {
    const tabelle = esito.records.map((r) => r.table);
    const ids = esito.records.map((r) => r.id);
    const ragioni = esito.records.map((r) => r.justification);
    const reg = await client.query(
      `INSERT INTO sys.sys_generated_record_origins
         (generated_record_origin_tenant_id, generated_record_origin_target_table,
          generated_record_origin_target_record_id, generated_record_origin_blueprint_version_id,
          generated_record_origin_status, generated_record_origin_metadata)
       SELECT $1, t.tab, t.rid, $2, 'GENERATED', jsonb_build_object('justification', t.perche)
         FROM unnest($3::varchar[], $4::uuid[], $5::text[]) AS t(tab, rid, perche)
       ON CONFLICT (generated_record_origin_target_table, generated_record_origin_target_record_id)
       DO NOTHING`,
      [tenantId, versionId, tabelle, ids, ragioni],
    );
    // Il conteggio deve coincidere con le righe create. `ON CONFLICT DO NOTHING` esiste per
    // l'idempotenza tecnica, non per tollerare una perdita: se il registro ha scritto MENO
    // righe di quante ne sono nate, qualcuna resta senza origine — ed è il difetto che
    // questo atto esiste per impedire, quindi si ferma tutto.
    if ((reg.rowCount ?? 0) !== esito.records.length) {
      throw new ConflictError(
        `Il registro dell'origine ha scritto ${reg.rowCount ?? 0} righe su ${esito.records.length} create`,
        "APPLY_EFFECT_FAILED",
      );
    }
  }

  // --- 5. proiezione dell'identità sull'azienda (§5.7, R5 di P1). Il fascicolo è
  //        l'AUTORITÀ sull'identità; `sys_tenancies` e la carta d'identità ne sono
  //        proiezioni. P1 lo aveva stabilito e aveva dichiarato che la proiezione si scrive
  //        in P3: qui si scrive.
  //
  //        La carta d'identità porta gli stessi campi della versione, quindi la proiezione è
  //        diretta (id → id) e l'upsert è sull'unico per azienda.
  await client.query(
    `INSERT INTO sys.sys_enterprise_typing_profiles
       (enterprise_typing_tenant_id, enterprise_typing_industry_class_id, enterprise_typing_size_band_id,
        enterprise_typing_operating_model_id, enterprise_typing_regulatory_intensity,
        enterprise_typing_employee_count, enterprise_typing_revenue_eur, enterprise_typing_country_code,
        enterprise_typing_assessed_at)
     SELECT $2, v.tenant_blueprint_version_industry_class_id, v.tenant_blueprint_version_size_band_id,
            v.tenant_blueprint_version_operating_model_id,
            -- il campo e' NULLABLE sulla versione e NOT NULL sulla carta, col default 'MEDIUM'.
            -- Passare NULL esplicito NON attiva il default della colonna: lo si scrive qui, ed
            -- e' il valore che lo schema stesso dichiara, non un'invenzione di questo effetto.
            coalesce(v.tenant_blueprint_version_regulatory_intensity, 'MEDIUM'),
            v.tenant_blueprint_version_employee_count, v.tenant_blueprint_version_revenue_eur,
            v.tenant_blueprint_version_country_code, now()
       FROM sys.sys_tenant_blueprint_versions v
      WHERE v.tenant_blueprint_version_id = $1
     ON CONFLICT (enterprise_typing_tenant_id) DO UPDATE
        SET enterprise_typing_industry_class_id   = excluded.enterprise_typing_industry_class_id,
            enterprise_typing_size_band_id        = excluded.enterprise_typing_size_band_id,
            enterprise_typing_operating_model_id  = excluded.enterprise_typing_operating_model_id,
            enterprise_typing_regulatory_intensity = excluded.enterprise_typing_regulatory_intensity,
            enterprise_typing_employee_count      = excluded.enterprise_typing_employee_count,
            enterprise_typing_revenue_eur         = excluded.enterprise_typing_revenue_eur,
            enterprise_typing_country_code        = excluded.enterprise_typing_country_code,
            enterprise_typing_assessed_at         = now(),
            updated_at                            = now()`,
    [versionId, tenantId],
  );

  // Su `sys_tenancies` i due campi non sono id ma CODICI, e il raccordo passa dall'ATECO:
  // la versione porta una classificazione di attività, `sys_industry_codes` la lega al
  // codice di settore che il tenant espone. `coalesce` è deliberato: se il raccordo non
  // esiste, l'identità resta quella che era. Una proiezione che AZZERA un'identità perché
  // non ha saputo tradurla farebbe più danno del non proiettare — e I21 è presidiato
  // (`sys.v_tenant_industry_incoerente`), quindi un valore sbagliato qui si vede.
  await client.query(
    `UPDATE sys.sys_tenancies t
        SET tenant_industry_code = coalesce(
              (SELECT ic.industry_code
                 FROM sys.sys_tenant_blueprint_versions v
                 JOIN sys.sys_activity_classifications ac
                   ON ac.activity_classification_id = v.tenant_blueprint_version_industry_class_id
                 JOIN sys.sys_industry_codes ic
                   ON ic.industry_ateco_code = ac.activity_classification_code
                WHERE v.tenant_blueprint_version_id = $1),
              t.tenant_industry_code),
            tenant_size_band = coalesce(
              (SELECT b.enterprise_size_band_code
                 FROM sys.sys_tenant_blueprint_versions v
                 JOIN sys.sys_enterprise_size_bands b
                   ON b.enterprise_size_band_id = v.tenant_blueprint_version_size_band_id
                WHERE v.tenant_blueprint_version_id = $1),
              t.tenant_size_band),
            updated_at = now()
      WHERE t.tenant_id = $2`,
    [versionId, tenantId],
  );
}
