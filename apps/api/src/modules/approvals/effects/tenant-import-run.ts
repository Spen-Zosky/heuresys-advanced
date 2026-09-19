/**
 * apps/api/src/modules/approvals/effects/tenant-import-run.ts
 * #206 T6 + T7 — L'ATTO: la corsa firmata, le persone vere entrano (Tenant Builder P4, S1098).
 *
 * E26 (Enzo, 2026-08-16): *si firma l'IMPORTAZIONE, non la persona* — «accetto questa corsa, con
 * queste eccezioni elencate». La firma e' la richiesta di approvazione `TENANT_IMPORT_RUN`; questo
 * effetto e' cio' che accade quando la firma arriva, TUTTO NELLA STESSA TRANSAZIONE, con l'idioma
 * di `applyTenantBlueprintApplication`: un UPDATE guardato sullo stato atteso, 0 righe →
 * `APPLY_EFFECT_FAILED`, che fa rollback anche di `markApplied`. Una corsa non lascia mai persone a
 * meta' strada.
 *
 * I passi, e ognuno puo' far fallire l'intero atto:
 *
 *   1. `RUNNING → COMPLETED` guardato: ri-applicare una corsa gia' applicata iniettterebbe le
 *      stesse persone due volte;
 *   2. la guardia sull'azienda RI-VERIFICATA ADESSO (l'approvazione e' asincrona);
 *   3. per ogni candidata non esclusa, la precondizione si RI-VERIFICA al momento
 *      dell'esecuzione, mai ereditata dalla validazione (regola ④b della bonifica): la
 *      posizione dev'essere ancora vacante o occupata dallo stesso segnaposto, la persona non
 *      dev'essere nata nel frattempo. Se la realta' e' cambiata, l'atto si ferma: il referto
 *      firmato non descrive piu' cio' che accadrebbe;
 *   4. l'iniezione (T7): persona STANDARD + incarico PRIMARY ACTIVE + competenze dichiarate;
 *      il SEGNAPOSTO, se c'era, cede il posto — `SUPERSEDED` nel registro, `DEACTIVATED` come
 *      utente, incarico `ENDED`: mai cancellato (ADR-0035);
 *   5. il registro dell'origine: la POSIZIONE e la sua unita' passano a `CONFIRMED` — la
 *      posizione era giusta, ed e' ancora li'. E' il caso controintuitivo del piano: chi
 *      confonde «il provvisorio e' stato sostituito» con «l'impalcatura non serve piu'»
 *      smonta l'azienda che P3 ha appena costruito;
 *   6. le eccezioni nominate (E26): una decisione `sys_seed_approval_decisions` per ogni
 *      persona entrata con scostamento, con la motivazione che elenca cio' che manca;
 *   7. la fonte passa `AVAILABLE → INGESTED` (guardato): e' cio' che chiude l'idempotenza;
 *   8. la POST-CONDIZIONE che protegge cio' che NON doveva cambiare: nessuna posizione
 *      dell'azienda e' `SUPERSEDED`. Se lo e', l'atto torna indietro.
 */
import type { PoolClient } from "pg";
import type { ApprovalRequestRow } from "../repository.js";
import { ConflictError } from "../../../errors/index.js";
import type { TenantImportRow } from "@heuresys/shared";

export const TENANT_IMPORT_RUN = "TENANT_IMPORT_RUN";

/**
 * Punto di sabotaggio dichiarato, per la prova che deve poter fallire (piano T6): si rompe il
 * passo del registro e si verifica che TUTTO torni indietro — nessuna persona nata, la corsa
 * non COMPLETED. Usato SOLO dai test; in produzione vale sempre `false`.
 */
export const guasti = { registro: false };

interface CorsaRow {
  seed_acquisition_run_id: string;
  seed_acquisition_run_tenant_id: string;
  seed_acquisition_run_metadata: Record<string, unknown>;
}

interface CandidataRow {
  seed_candidate_record_id: string;
  seed_candidate_record_validation_status: string;
  seed_candidate_record_payload: {
    rowNo: number;
    riga: TenantImportRow;
    email: string | null;
    positionId: string | null;
    positionCode: string | null;
    e19: string | null;
    hireDate: string | null;
    placeholderUserId: string | null;
  };
  scostamento: string | null;
}

export interface EsitoIniezione {
  iniettate: number;
  segnapostiSostituiti: number;
  posizioniConfermate: number;
  unitaConfermate: number;
  escluse: number;
}

export async function applyTenantImportRun(client: PoolClient, request: ApprovalRequestRow): Promise<EsitoIniezione> {
  const runId = request.resourceId;
  if (!runId) throw new ConflictError("La firma non indica quale corsa (resource_id)", "APPLY_EFFECT_FAILED");

  // --- 1. RUNNING → COMPLETED, guardato sullo stato atteso E sulla specie della corsa.
  const corsa = await client.query<CorsaRow>(
    `UPDATE sys.sys_seed_acquisition_runs r
        SET seed_acquisition_run_status = 'COMPLETED',
            seed_acquisition_run_finished_at = now(),
            updated_at = now()
      WHERE r.seed_acquisition_run_id = $1
        AND r.seed_acquisition_run_status = 'RUNNING'
        AND r.seed_acquisition_run_metadata->>'kind' = 'TENANT_IMPORT'
      RETURNING r.seed_acquisition_run_id, r.seed_acquisition_run_tenant_id, r.seed_acquisition_run_metadata`,
    [runId],
  );
  if (corsa.rowCount !== 1) {
    throw new ConflictError("La corsa non e' RUNNING, non e' una corsa di importazione, o e' gia' stata applicata", "APPLY_EFFECT_FAILED");
  }
  const run = corsa.rows[0]!;
  const tenantId = run.seed_acquisition_run_tenant_id;
  const sourceExportId = String(run.seed_acquisition_run_metadata["sourceExportId"] ?? "");
  if (!sourceExportId) throw new ConflictError("La corsa non dichiara la fonte", "APPLY_EFFECT_FAILED");

  // --- 2. la guardia sull'azienda, ri-verificata ADESSO.
  const stato = await client.query<{ tenant_status: string }>(`SELECT tenant_status FROM sys.sys_tenancies WHERE tenant_id = $1`, [tenantId]);
  if (stato.rows[0]?.tenant_status !== "ACTIVE") {
    throw new ConflictError(`L'azienda di destinazione non e' ACTIVE (status=${stato.rows[0]?.tenant_status ?? "assente"})`, "APPLY_EFFECT_FAILED");
  }

  // Chi ha firmato: il passo APPROVED della richiesta. Serve alle eccezioni nominate (passo 6).
  const firma = await client.query<{ decided_by: string | null }>(
    `SELECT approval_step_decided_by AS decided_by FROM sys.sys_approval_steps
      WHERE approval_step_request_id = $1 AND approval_step_status = 'APPROVED'
      ORDER BY approval_step_decided_at DESC NULLS LAST LIMIT 1`,
    [request.approvalRequestId],
  );
  const firmatario = firma.rows[0]?.decided_by ?? request.createdBy ?? null;

  const candidate = await client.query<CandidataRow>(
    `SELECT c.seed_candidate_record_id, c.seed_candidate_record_validation_status, c.seed_candidate_record_payload,
            (SELECT v.seed_validation_result_message FROM sys.sys_seed_validation_results v
              WHERE v.seed_validation_result_candidate_id = c.seed_candidate_record_id
                AND v.seed_validation_result_rule_code = 'E19_CRITICAL_SKILL_COVERAGE'
                AND v.seed_validation_result_status = 'WARNING' LIMIT 1) AS scostamento
       FROM sys.sys_seed_candidate_records c
      WHERE c.seed_candidate_record_run_id = $1 AND c.seed_candidate_record_domain = 'TENANT_PERSON'
      ORDER BY (c.seed_candidate_record_payload->>'rowNo')::int`,
    [runId],
  );

  const esito: EsitoIniezione = { iniettate: 0, segnapostiSostituiti: 0, posizioniConfermate: 0, unitaConfermate: 0, escluse: 0 };
  const posizioniToccate = new Set<string>();

  for (const c of candidate.rows) {
    const p = c.seed_candidate_record_payload;
    if (c.seed_candidate_record_validation_status === "FAILED") { esito.escluse++; continue; }
    if (!p.email || !p.positionId) {
      throw new ConflictError(`La candidata della riga ${p.rowNo} non e' esclusa ma non ha email o posizione`, "APPLY_EFFECT_FAILED");
    }

    // --- 3. la precondizione, RI-VERIFICATA ADESSO.
    const gia = await client.query(`SELECT 1 FROM sys.sys_users WHERE user_tenant_id = $1 AND lower(user_email) = $2`, [tenantId, p.email]);
    if ((gia.rowCount ?? 0) > 0) {
      throw new ConflictError(`${p.email} e' nata nel frattempo: il referto firmato non descrive piu' l'azienda — riapri la corsa`, "APPLY_EFFECT_FAILED");
    }
    const occ = await client.query<{ assignment_id: string; user_id: string; user_type: string }>(
      `SELECT a.user_position_assignment_id AS assignment_id, u.user_id, u.user_type
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
        WHERE a.user_position_assignment_position_id = $1
          AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'`,
      [p.positionId],
    );
    const occupante = occ.rows[0] ?? null;
    if (occupante && occupante.user_id !== p.placeholderUserId) {
      throw new ConflictError(`La posizione ${p.positionCode} e' stata occupata nel frattempo (${occupante.user_type}): riapri la corsa`, "APPLY_EFFECT_FAILED");
    }

    // --- 4. l'iniezione (T7). Prima il segnaposto cede il posto, poi la persona entra.
    if (occupante) {
      await client.query(
        `UPDATE sys.sys_user_position_assignments
            SET user_position_assignment_status = 'ENDED',
                user_position_assignment_end_date = GREATEST(user_position_assignment_start_date, CURRENT_DATE),
                updated_at = now()
          WHERE user_position_assignment_id = $1`,
        [occupante.assignment_id],
      );
      const dis = await client.query(
        `UPDATE sys.sys_users SET user_status = 'DEACTIVATED', updated_at = now()
          WHERE user_id = $1 AND user_type = 'GENERATED_INCUMBENT' AND user_status = 'ACTIVE'`,
        [occupante.user_id],
      );
      if (dis.rowCount !== 1) {
        throw new ConflictError(`Il segnaposto ${occupante.user_id} non si e' potuto disattivare`, "APPLY_EFFECT_FAILED");
      }
      // Il registro: il segnaposto e il suo incarico sono SUPERSEDED, e puntano alla corsa.
      await client.query(
        `UPDATE sys.sys_generated_record_origins
            SET generated_record_origin_status = 'SUPERSEDED',
                generated_record_origin_superseded_by_run_id = $3,
                generated_record_origin_status_changed_at = now()
          WHERE generated_record_origin_tenant_id = $1
            AND generated_record_origin_status = 'GENERATED'
            AND ((generated_record_origin_target_table = 'sys_users' AND generated_record_origin_target_record_id = $2)
              OR (generated_record_origin_target_table = 'sys_user_position_assignments' AND generated_record_origin_target_record_id = $4))`,
        [tenantId, occupante.user_id, runId, occupante.assignment_id],
      );
      esito.segnapostiSostituiti++;
    }

    const riga = p.riga;
    const nome = (riga.first_name ?? "").trim();
    const cognome = (riga.last_name ?? "").trim();
    const display = [nome, cognome].filter(Boolean).join(" ") || p.email;
    const externalCode = `IMPORT::${sourceExportId}::${(riga.external_id ?? "").trim() || `row:${p.rowNo}`}`;
    const persona = await client.query<{ user_id: string }>(
      `INSERT INTO sys.sys_users
         (user_tenant_id, user_external_code, user_email, user_display_name, user_first_name, user_last_name,
          user_status, user_type, user_locale, user_timezone)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', 'STANDARD', 'it-IT', 'Europe/Rome')
       RETURNING user_id`,
      [tenantId, externalCode, p.email, display, nome || null, cognome || null],
    );
    const userId = persona.rows[0]!.user_id;
    await client.query(
      `INSERT INTO sys.sys_user_position_assignments
         (user_position_assignment_tenant_id, user_position_assignment_user_id, user_position_assignment_position_id,
          user_position_assignment_kind, user_position_assignment_fte, user_position_assignment_start_date,
          user_position_assignment_status, user_position_assignment_metadata, origine_dato)
       VALUES ($1, $2, $3, 'PRIMARY', 1.000, coalesce($4::date, CURRENT_DATE), 'ACTIVE',
               jsonb_build_object('tenantImportRunId', $5::text, 'sourceExportId', $6::text), 'IMPORT')`,
      [tenantId, userId, p.positionId, p.hireDate, runId, sourceExportId],
    );
    // Le competenze DICHIARATE dal cliente: solo quelle che il catalogo conosce, come
    // dichiarazione (non verificate). E' cio' che la vista di E25 leggera' domani.
    const codici = [...new Set((riga.skill_codes ?? "").split(";").map((x) => x.trim().toUpperCase()).filter(Boolean))];
    if (codici.length > 0) {
      await client.query(
        `INSERT INTO sys.sys_user_skills
           (user_skill_tenant_id, user_skill_user_id, user_skill_skill_id, user_skill_proficiency, user_skill_source, user_skill_metadata)
         SELECT $1, $2, s.skill_id, 'COMPETENT', 'TENANT_IMPORT', jsonb_build_object('tenantImportRunId', $4::text)
           FROM sys.sys_skills s
          WHERE upper(s.skill_code) = ANY($3::text[])
            AND (s.skill_tenant_id IS NULL OR s.skill_tenant_id = $1)
         ON CONFLICT (user_skill_user_id, user_skill_skill_id) DO NOTHING`,
        [tenantId, userId, codici, runId],
      );
    }
    esito.iniettate++;
    posizioniToccate.add(p.positionId);

    // --- 6. l'eccezione nominata (E26), per chi entra con scostamento.
    if (c.scostamento) {
      await client.query(
        `INSERT INTO sys.sys_seed_approval_decisions
           (seed_approval_decision_candidate_id, seed_approval_decision_approver_user_id, seed_approval_decision_status,
            seed_approval_decision_rationale)
         VALUES ($1, $2, 'APPROVED', $3)`,
        [c.seed_candidate_record_id, firmatario, `Firma della corsa ${runId} (richiesta ${request.approvalRequestId}) — eccezione nominata: ${c.scostamento}`],
      );
    }
    await client.query(
      `UPDATE sys.sys_seed_candidate_records
          SET seed_candidate_record_validation_status = 'APPLIED',
              seed_candidate_record_payload = seed_candidate_record_payload || jsonb_build_object('userId', $2::text),
              updated_at = now()
        WHERE seed_candidate_record_id = $1`,
      [c.seed_candidate_record_id, userId],
    );
  }

  if (esito.iniettate === 0) {
    throw new ConflictError("Nessuna persona e' entrata: una corsa firmata che non inietta nessuno non e' una corsa", "APPLY_EFFECT_FAILED");
  }

  // --- 5. il registro dell'origine: la posizione e la sua unita' sono CONFERMATE dai dati veri.
  if (guasti.registro) {
    throw new ConflictError("guasto simulato nel registro dell'origine (prova di transazionalita')", "APPLY_EFFECT_FAILED");
  }
  const ids = [...posizioniToccate];
  const pos = await client.query(
    `UPDATE sys.sys_generated_record_origins
        SET generated_record_origin_status = 'CONFIRMED', generated_record_origin_status_changed_at = now()
      WHERE generated_record_origin_tenant_id = $1 AND generated_record_origin_status = 'GENERATED'
        AND generated_record_origin_target_table = 'sys_positions'
        AND generated_record_origin_target_record_id = ANY($2::uuid[])`,
    [tenantId, ids],
  );
  esito.posizioniConfermate = pos.rowCount ?? 0;
  const unita = await client.query(
    `UPDATE sys.sys_generated_record_origins o
        SET generated_record_origin_status = 'CONFIRMED', generated_record_origin_status_changed_at = now()
      WHERE o.generated_record_origin_tenant_id = $1 AND o.generated_record_origin_status = 'GENERATED'
        AND o.generated_record_origin_target_table = 'sys_organization_units'
        AND o.generated_record_origin_target_record_id IN (
              SELECT p.position_organization_unit_id FROM sys.sys_positions p WHERE p.position_id = ANY($2::uuid[]))`,
    [tenantId, ids],
  );
  esito.unitaConfermate = unita.rowCount ?? 0;

  // --- 7. la fonte e' ingerita (guardato: una fonte gia' INGESTED non lo diventa due volte).
  const fonte = await client.query(
    `UPDATE reference_sync.source_exports SET source_export_status = 'INGESTED'
      WHERE source_export_id = $1 AND source_export_status = 'AVAILABLE'`,
    [sourceExportId],
  );
  if (fonte.rowCount !== 1) {
    throw new ConflictError("La fonte non era AVAILABLE: la corsa firmata non e' piu' applicabile", "APPLY_EFFECT_FAILED");
  }

  // --- 8. POST-CONDIZIONE: nessuna posizione dell'azienda e' SUPERSEDED. Se lo e', P4 sta
  //        smontando l'azienda che P3 ha costruito, e l'atto torna indietro.
  const smontate = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_generated_record_origins
      WHERE generated_record_origin_tenant_id = $1 AND generated_record_origin_status = 'SUPERSEDED'
        AND generated_record_origin_target_table IN ('sys_positions', 'sys_organization_units')`,
    [tenantId],
  );
  if (Number(smontate.rows[0]?.n ?? 0) !== 0) {
    throw new ConflictError(`${smontate.rows[0]!.n} posizioni/unita' risultano SUPERSEDED: l'importazione non smonta l'azienda`, "APPLY_EFFECT_FAILED");
  }

  await client.query(
    `UPDATE sys.sys_seed_acquisition_runs
        SET seed_acquisition_run_metadata = seed_acquisition_run_metadata || jsonb_build_object('esito', $2::jsonb, 'approvalRequestId', $3::text)
      WHERE seed_acquisition_run_id = $1`,
    [runId, JSON.stringify(esito), request.approvalRequestId],
  );
  return esito;
}
