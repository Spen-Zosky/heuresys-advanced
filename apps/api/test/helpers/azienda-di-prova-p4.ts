/**
 * apps/api/test/helpers/azienda-di-prova-p4.ts
 * #206 — L'AZIENDA USA-E-GETTA su cui P4 si prova: costruita da P3, arricchita del PROFILO ATTESO.
 *
 * P3 costruisce da un modello seminato (`seminaModello`, E29: non una banca) — unità, posizioni,
 * competenze, indicatori — e registra ogni riga come `GENERATED`. Ma la costruzione NON produce
 * requisiti di posizione ne' persone (`incumbents: []`, decisione di F2). Qui si aggiunge cio' che
 * P4 deve poter incontrare:
 *
 *   · POS-DG     — DUE requisiti CRITICAL (le due competenze del modello): chi li dichiara
 *                  entrambi e' AMMESSA, chi ne dichiara uno e' AMMESSA_CON_SCOSTAMENTO;
 *   · POS-CAPO   — ZERO requisiti CRITICAL, e OCCUPATA DA UN SEGNAPOSTO (`GENERATED_INCUMBENT`,
 *                  registrato come GENERATED): la verifica e' CIECA, e il segnaposto cede il posto;
 *   · POS-EXTRA  — una terza posizione, UN requisito CRITICAL, vacante, registrata GENERATED.
 *
 * Tutto vive nella transazione del file (D-52): a fine corsa non resta niente sui due tenant di
 * produzione. ⚠ Il segnaposto lo crea la fixture, non P3: dal 2026-08-19 nessuna sorgente viva
 * ne genera (E29), ma lo schema li ammette ancora e la specifica di P4 li nomina — il ramo va
 * provato finche' esiste.
 */
import type { Pool } from "pg";
import { seminaModello } from "./modello-di-prova.js";
import { applyTenantBlueprintApplication } from "../../src/modules/approvals/effects/tenant-blueprint-application.js";
import type { ApprovalRequestRow } from "../../src/modules/approvals/repository.js";

export interface AziendaDiProvaP4 {
  tenantId: string;
  versionId: string;
  posizioni: { dg: string; capo: string; extra: string };
  codici: { dg: string; capo: string; extra: string };
  competenze: { lean: string; sicu: string };
  segnaposto: { userId: string; assignmentId: string; email: string };
}

export async function costruisciAziendaP4(pool: Pool, marca: string): Promise<AziendaDiProvaP4> {
  const modello = await seminaModello(pool, marca);
  const t = await pool.query<{ tenant_id: string }>(
    `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status, tenant_industry_code)
     VALUES ($1, $2, 'ACTIVE', 'MANUFACTURING') RETURNING tenant_id`,
    [`P4-${marca}`, `Azienda di prova P4 ${marca}`],
  );
  const tenantId = t.rows[0]!.tenant_id;
  const b = await pool.query<{ tenant_blueprint_id: string }>(
    `INSERT INTO sys.sys_tenant_blueprints (tenant_blueprint_code, tenant_blueprint_name, tenant_blueprint_tenant_id, tenant_blueprint_status)
     VALUES ($1, $2, $3, 'ACTIVE') RETURNING tenant_blueprint_id`,
    [`P4-BP-${marca}`, `Fascicolo P4 ${marca}`, tenantId],
  );
  const v = await pool.query<{ tenant_blueprint_version_id: string }>(
    `INSERT INTO sys.sys_tenant_blueprint_versions
       (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number,
        tenant_blueprint_version_status, tenant_blueprint_version_variant_version_id, tenant_blueprint_version_approved_at)
     VALUES ($1, 1, 'APPROVED', $2, now()) RETURNING tenant_blueprint_version_id`,
    [b.rows[0]!.tenant_blueprint_id, modello.variantVersionId],
  );
  const versionId = v.rows[0]!.tenant_blueprint_version_id;

  // La costruzione di P3, con l'effetto vero: e' cosi' che nascono le righe GENERATED.
  const client = await pool.connect();
  try {
    await applyTenantBlueprintApplication(client, { resourceId: versionId, resourceType: "TENANT_BLUEPRINT_APPLICATION" } as ApprovalRequestRow);
  } finally {
    client.release();
  }

  const pos = async (code: string) => {
    const r = await pool.query<{ position_id: string; ou: string }>(
      `SELECT position_id, position_organization_unit_id AS ou FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code = $2`,
      [tenantId, code],
    );
    if (!r.rows[0]) throw new Error(`la costruzione non ha creato la posizione ${code}`);
    return r.rows[0];
  };
  const dg = await pos(`POS-DG-${marca}`);
  const capo = await pos(`POS-CAPO-${marca}`);
  const skill = async (code: string) => {
    const r = await pool.query<{ skill_id: string }>(
      `SELECT skill_id FROM sys.sys_skills WHERE skill_tenant_id = $1 AND skill_code = $2`, [tenantId, code],
    );
    if (!r.rows[0]) throw new Error(`la costruzione non ha creato la competenza ${code}`);
    return r.rows[0].skill_id;
  };
  const lean = await skill(`SK-LEAN-${marca}`);
  const sicu = await skill(`SK-SICU-${marca}`);

  // La terza posizione: vacante, un requisito CRITICAL, registrata come GENERATED dal fascicolo.
  const extra = await pool.query<{ position_id: string }>(
    `INSERT INTO sys.sys_positions (position_tenant_id, position_code, position_title, position_organization_unit_id,
                                    position_criticality, position_is_active, position_economic_weight)
     VALUES ($1, $2, 'Responsabile qualita''', $3, 'HIGH', true, 0.500) RETURNING position_id`,
    [tenantId, `POS-EXTRA-${marca}`, dg.ou],
  );
  const extraId = extra.rows[0]!.position_id;
  await pool.query(
    `INSERT INTO sys.sys_generated_record_origins
       (generated_record_origin_tenant_id, generated_record_origin_target_table, generated_record_origin_target_record_id,
        generated_record_origin_blueprint_version_id, generated_record_origin_status, generated_record_origin_metadata)
     VALUES ($1, 'sys_positions', $2, $3, 'GENERATED', '{"justification":"fixture P4: terza posizione"}')`,
    [tenantId, extraId, versionId],
  );

  // Il profilo atteso (E19): DG pretende entrambe le competenze, EXTRA una, CAPO nessuna.
  await pool.query(
    `INSERT INTO sys.sys_position_skill_requirements
       (position_id, position_skill_requirement_tenant_id, skill_id, required_proficiency, weight, criticality)
     VALUES ($1, $4, $5, 'PROFICIENT', 1.000, 'CRITICAL'),
            ($1, $4, $6, 'COMPETENT',  0.800, 'CRITICAL'),
            ($2, $4, $5, 'COMPETENT',  0.700, 'CRITICAL'),
            ($3, $4, $6, 'BASIC',      0.500, 'MEDIUM')`,
    [dg.position_id, extraId, capo.position_id, tenantId, lean, sicu],
  );

  // Il segnaposto su CAPO, come P3 li faceva prima di E29: utente GENERATED_INCUMBENT, incarico
  // PRIMARY ACTIVE, entrambi registrati GENERATED.
  const segEmail = `capo.stabilimento@${marca.toLowerCase()}.segnaposto.invalid`;
  const su = await pool.query<{ user_id: string }>(
    `INSERT INTO sys.sys_users (user_tenant_id, user_external_code, user_email, user_display_name, user_first_name, user_last_name,
                                user_status, user_type, user_locale, user_timezone)
     VALUES ($1, $2, $3, 'Capo stabilimento (segnaposto)', 'Capo', 'Stabilimento', 'ACTIVE', 'GENERATED_INCUMBENT', 'it-IT', 'Europe/Rome')
     RETURNING user_id`,
    [tenantId, `SYN_CAPO_${marca}`, segEmail],
  );
  const segUserId = su.rows[0]!.user_id;
  const sa = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_user_position_assignments
       (user_position_assignment_tenant_id, user_position_assignment_user_id, user_position_assignment_position_id,
        user_position_assignment_kind, user_position_assignment_fte, user_position_assignment_start_date, user_position_assignment_status)
     VALUES ($1, $2, $3, 'PRIMARY', 1.000, '2024-01-01', 'ACTIVE') RETURNING user_position_assignment_id AS id`,
    [tenantId, segUserId, capo.position_id],
  );
  const segAssignmentId = sa.rows[0]!.id;
  await pool.query(
    `INSERT INTO sys.sys_generated_record_origins
       (generated_record_origin_tenant_id, generated_record_origin_target_table, generated_record_origin_target_record_id,
        generated_record_origin_blueprint_version_id, generated_record_origin_status, generated_record_origin_metadata)
     VALUES ($1, 'sys_users', $2, $4, 'GENERATED', '{"justification":"fixture P4: segnaposto"}'),
            ($1, 'sys_user_position_assignments', $3, $4, 'GENERATED', '{"justification":"fixture P4: incarico del segnaposto"}')`,
    [tenantId, segUserId, segAssignmentId, versionId],
  );

  return {
    tenantId, versionId,
    posizioni: { dg: dg.position_id, capo: capo.position_id, extra: extraId },
    codici: { dg: `POS-DG-${marca}`, capo: `POS-CAPO-${marca}`, extra: `POS-EXTRA-${marca}` },
    competenze: { lean: `SK-LEAN-${marca}`, sicu: `SK-SICU-${marca}` },
    segnaposto: { userId: segUserId, assignmentId: segAssignmentId, email: segEmail },
  };
}

/** Le cinque righe del cliente che coprono ogni esito di P4, per l'azienda costruita qui sopra. */
export function righeDelCliente(az: AziendaDiProvaP4, marca: string) {
  const dom = `${marca.toLowerCase()}.cliente.invalid`;
  return [
    // 1 — DG: dichiara ENTRAMBE le competenze critiche → AMMESSA
    { external_id: "E001", email: `anna.verdi@${dom}`, first_name: "Anna", last_name: "Verdi", position_code: az.codici.dg,
      hire_date: "2021-03-15", is_active: "S", skill_codes: `${az.competenze.lean};${az.competenze.sicu}` },
    // 2 — CAPO: zero requisiti CRITICAL → CIECA; occupata dal segnaposto → cede il posto;
    //     '31/02/2024' DEVE entrare nell'atterraggio e uscire NOMINATA dalla validazione
    { external_id: "E002", email: `bruno.neri@${dom}`, first_name: "Bruno", last_name: "Neri", position_code: az.codici.capo,
      hire_date: "31/02/2024", is_active: "S", skill_codes: null },
    // 3 — EXTRA: ne manca uno → AMMESSA_CON_SCOSTAMENTO, con l'elenco
    { external_id: "E003", email: `carla.bianchi@${dom}`, first_name: "Carla", last_name: "Bianchi", position_code: az.codici.extra,
      hire_date: "01/09/2023", is_active: "S", skill_codes: `${az.competenze.sicu}` },
    // 4 — senza email → ESCLUSA
    { external_id: "E004", email: "  ", first_name: "Dario", last_name: "Rossi", position_code: az.codici.dg,
      hire_date: "2020-01-01", is_active: "S", skill_codes: null },
    // 5 — seconda persona sulla DG → ESCLUSA (una posizione, una persona)
    { external_id: "E005", email: `elena.gialli@${dom}`, first_name: "Elena", last_name: "Gialli", position_code: az.codici.dg,
      hire_date: "2022-06-01", is_active: "S", skill_codes: `${az.competenze.lean}` },
  ];
}
