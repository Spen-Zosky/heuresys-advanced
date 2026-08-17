/**
 * apps/api/src/modules/tenant-materialization/repository.ts
 * #4 WI-C — raw parameterized SQL. Materializes an archetype's org-units + positions into a
 * target tenant. Every write is tagged with the (already-validated) tenant_id (I5). Idempotent:
 * ON CONFLICT (tenant, code) DO NOTHING. apply runs inside withTransaction (passed PoolClient);
 * plan is read-only (existence counts, no writes).
 *
 * ⚠ `metadata.materialized_from` NON E' IL MARCHIO DI PROVENIENZA (#197, S1067).
 *
 * Questo motore scrive OTTO tabelle e ne marca TRE: `sys_organization_units` (:71),
 * `sys_skills` (:153), `sys_kpi_definitions` (:194). Non marca `sys_positions` (:103),
 * `sys_users` (:223), `sys_user_position_assignments` (:254), `sys_user_skill_evidence`
 * (:304), `sys_user_kpi_evidence` (:317). Ri-verificato riga per riga sul file il
 * 2026-08-17 — 3 su 8.
 *
 * Perche' e' un guaio piu' grande di una copertura parziale: e' un FALSO NEGATIVO
 * SILENZIOSO. Su una riga senza marchio, «non e' stata generata» e «e' stata generata da
 * un pezzo di motore che non marca» sono INDISTINGUIBILI guardando il dato. Un campo che
 * risponde «no» sia quando la risposta e' no sia quando non sa, non e' una fonte.
 *
 * Cosa NON fare (LEGGIMI-PRIMA della consegna P3, §7): estenderlo alle altre cinque. La
 * fonte vera e' `sys.sys_generated_record_origins` — il registro dell'origine della parte
 * 3 (forma decisa in P1 §4.7, prima che questo difetto emergesse). Esiste gia' nello
 * schema ed e' VUOTO (0 righe, misurate il 2026-08-17): il motore non ha ancora costruito
 * niente in produzione, ed e' la ragione per cui questo difetto e' latente e non un danno.
 *
 * Questo campo resta dov'e' come APPUNTO STORICO del motore, non come marchio. Il
 * controllo incrociato di P3 (spec §10.4) deve riportare la differenza fra le due
 * coperture: se non la trovasse, starebbe confrontando una cosa con se' stessa.
 */
import type { PoolClient } from "pg";
import { pool } from "../../db/client.js";
import type { BuildPlan } from "./build-plan.js";

export type DbConnector = typeof pool | PoolClient;

export interface MaterializeCounts {
  orgUnits: number;
  positions: number;
  users: number;
  assignments: number;
  skills: number;
  kpis: number;
  skillEvidence: number;
  kpiEvidence: number;
}

/**
 * Una riga davvero creata, con la tabella e la ragione (#198 T5).
 *
 * I CONTEGGI NON BASTANO, e la differenza non è di comodità: il registro dell'origine deve
 * poter dire, riga per riga, «questa l'ha creata quel fascicolo». Un conteggio dice quante
 * ne sono nate, non QUALI — e su una tabella dove convivono righe generate e righe vere, il
 * numero non permette di ritrovarle. `#197` descrive lo stesso guaio visto dall'altro lato:
 * un marchio parziale rende «non generata» e «non marcata» indistinguibili.
 */
export interface CreatedRecord {
  table: string;
  id: string;
  justification: string;
}

/** Tenant status for the M-1 validation (null = tenant does not exist). */
export async function findTenantStatus(q: DbConnector, tenantId: string): Promise<string | null> {
  const res = await q.query<{ tenant_status: string }>(
    `SELECT tenant_status FROM sys.sys_tenancies WHERE tenant_id = $1`,
    [tenantId],
  );
  return res.rows[0]?.tenant_status ?? null;
}

async function orgUnitTypeId(client: PoolClient, code: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(code)) return cache.get(code)!;
  const res = await client.query<{ organization_unit_type_id: string }>(
    `SELECT organization_unit_type_id FROM sys.sys_organization_unit_types WHERE organization_unit_type_code = $1`,
    [code],
  );
  const id = res.rows[0]?.organization_unit_type_id ?? null;
  cache.set(code, id);
  return id;
}

/**
 * Costruisce dentro `tenantId` le righe che il PIANO dichiara (#198 T4, E21).
 *
 * Prima riceveva un `Archetype` e ci guardava dentro; ora riceve un `BuildPlan` e non sa da
 * dove viene. Il confine è verificabile in un secondo, e la prova sta nel piano di P3:
 *   grep -n "blueprints\.js" apps/api/src/modules/tenant-materialization/repository.ts
 * Un `grep` è un criterio debole in generale; qui misura esattamente la cosa che conta.
 *
 * ⚠ Il punto è sfuggito di proposito. Scritto senza, questa riga di commento **contiene** la
 * stringa cercata, e la prova troverebbe sé stessa: un rosso permanente su un file sano, che
 * è il modo migliore per insegnare a non guardarla più (`#194`). Trovato eseguendola.
 *
 *   mode 'apply' (dentro una transazione): INSERT ... ON CONFLICT DO NOTHING; `created`
 *     conta le righe davvero inserite.
 *   mode 'plan' (sola lettura): `created` = le righe che VERREBBERO inserite.
 */
export async function materialize(
  client: PoolClient,
  tenantId: string,
  plan: BuildPlan,
  mode: "plan" | "apply",
): Promise<MaterializeCounts & { records: CreatedRecord[] }> {
  // Le righe create, nell'ordine in cui nascono. In modo 'plan' resta vuoto: non si crea
  // niente, quindi non c'e' niente da registrare — e un elenco pieno in sola lettura
  // sarebbe una bugia comoda.
  const records: CreatedRecord[] = [];
  const typeCache = new Map<string, string | null>();
  const codeToId = new Map<string, string>(); // org-unit code → id (apply: for position FK)
  let orgUnitsCreated = 0;

  for (const ou of plan.orgUnits) {
    if (mode === "apply") {
      const typeId = await orgUnitTypeId(client, ou.type, typeCache);
      const parentId = ou.parentCode ? codeToId.get(ou.parentCode) ?? null : null;
      const ins = await client.query<{ organization_unit_id: string }>(
        `INSERT INTO sys.sys_organization_units
           (organization_unit_tenant_id, organization_unit_code, organization_unit_name,
            organization_unit_type_id, organization_unit_type, organization_unit_parent_id,
            organization_unit_is_active, organization_unit_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, true, jsonb_build_object('materialized_from', $7::text))
         ON CONFLICT (organization_unit_tenant_id, organization_unit_code) DO NOTHING
         RETURNING organization_unit_id`,
        [tenantId, ou.code, ou.name, typeId, ou.type, parentId, plan.sourceKey],
      );
      if (ins.rows[0]) {
        orgUnitsCreated++;
        codeToId.set(ou.code, ins.rows[0].organization_unit_id);
        records.push({ table: "sys_organization_units", id: ins.rows[0].organization_unit_id, justification: ou.justification });
      } else {
        const ex = await client.query<{ organization_unit_id: string }>(
          `SELECT organization_unit_id FROM sys.sys_organization_units
            WHERE organization_unit_tenant_id = $1 AND organization_unit_code = $2`,
          [tenantId, ou.code],
        );
        codeToId.set(ou.code, ex.rows[0]!.organization_unit_id);
      }
    } else {
      const ex = await client.query(
        `SELECT 1 FROM sys.sys_organization_units
          WHERE organization_unit_tenant_id = $1 AND organization_unit_code = $2`,
        [tenantId, ou.code],
      );
      if (ex.rowCount === 0) orgUnitsCreated++;
    }
  }

  const posCodeToId = new Map<string, string>(); // position code → id (apply: for the assignment FK)
  let positionsCreated = 0;
  for (const p of plan.positions) {
    if (mode === "apply") {
      const ouId = codeToId.get(p.orgUnitCode) ?? null;
      const ins = await client.query<{ position_id: string }>(
        `INSERT INTO sys.sys_positions
           (position_tenant_id, position_code, position_title, position_organization_unit_id,
            position_criticality, position_is_active, position_economic_weight)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         ON CONFLICT (position_tenant_id, position_code) DO NOTHING
         RETURNING position_id`,
        [tenantId, p.code, p.title, ouId, p.criticality, p.economicWeight],
      );
      if (ins.rows[0]) {
        positionsCreated++;
        posCodeToId.set(p.code, ins.rows[0].position_id);
        records.push({ table: "sys_positions", id: ins.rows[0].position_id, justification: p.justification });
      } else {
        const ex = await client.query<{ position_id: string }>(
          `SELECT position_id FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code = $2`,
          [tenantId, p.code],
        );
        posCodeToId.set(p.code, ex.rows[0]!.position_id);
      }
    } else {
      const ex = await client.query(
        `SELECT 1 FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code = $2`,
        [tenantId, p.code],
      );
      if (ex.rowCount === 0) positionsCreated++;
    }
  }

  // slice-2b: tenant-scoped synthetic skill + KPI catalog (RBR-SK-* / RBR-KPI-*). Created once per
  // tenant, idempotent via existence-check (the unique index is on COALESCE(tenant,0)+code). The ids
  // feed the per-incumbent evidence below.
  const skillCodeToId = new Map<string, string>();
  let skillsCreated = 0;
  for (const sk of plan.skills) {
    // The natural-key unique index (mig 000189/000196) is on (tenant, lower(trim(name))):
    // post-dedup the surviving row for a name can carry a DIFFERENT code (ESCO:: winner),
    // so the lookup must match by code OR name, and the insert must tolerate a conflict.
    if (mode === "apply") {
      const ex = await client.query<{ skill_id: string }>(
        `SELECT skill_id FROM sys.sys_skills
          WHERE skill_tenant_id = $1
            AND (skill_code = $2 OR lower(trim(skill_name)) = lower(trim($3)))
          ORDER BY (skill_code = $2) DESC
          LIMIT 1`,
        [tenantId, sk.code, sk.name],
      );
      if (ex.rows[0]) {
        skillCodeToId.set(sk.code, ex.rows[0].skill_id);
      } else {
        const ins = await client.query<{ skill_id: string }>(
          `INSERT INTO sys.sys_skills (skill_tenant_id, skill_code, skill_name, skill_kind, skill_is_global, skill_metadata)
           VALUES ($1, $2, $3, $4, false, jsonb_build_object('materialized_from', $5::text))
           ON CONFLICT DO NOTHING
           RETURNING skill_id`,
          [tenantId, sk.code, sk.name, sk.kind, plan.sourceKey],
        );
        if (ins.rows[0]) {
          skillCodeToId.set(sk.code, ins.rows[0].skill_id);
          skillsCreated++;
          records.push({ table: "sys_skills", id: ins.rows[0].skill_id, justification: sk.justification });
        } else {
          const again = await client.query<{ skill_id: string }>(
            `SELECT skill_id FROM sys.sys_skills
              WHERE skill_tenant_id = $1 AND lower(trim(skill_name)) = lower(trim($2))`,
            [tenantId, sk.name],
          );
          skillCodeToId.set(sk.code, again.rows[0]!.skill_id);
        }
      }
    } else {
      const ex = await client.query(
        `SELECT 1 FROM sys.sys_skills
          WHERE skill_tenant_id = $1
            AND (skill_code = $2 OR lower(trim(skill_name)) = lower(trim($3)))`,
        [tenantId, sk.code, sk.name],
      );
      if (ex.rowCount === 0) skillsCreated++;
    }
  }

  const kpiCodeToId = new Map<string, string>();
  let kpisCreated = 0;
  for (const kp of plan.kpis) {
    if (mode === "apply") {
      const ex = await client.query<{ kpi_definition_id: string }>(
        `SELECT kpi_definition_id FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id = $1 AND kpi_definition_code = $2`,
        [tenantId, kp.code],
      );
      if (ex.rows[0]) {
        kpiCodeToId.set(kp.code, ex.rows[0].kpi_definition_id);
      } else {
        const ins = await client.query<{ kpi_definition_id: string }>(
          `INSERT INTO sys.sys_kpi_definitions (kpi_definition_tenant_id, kpi_definition_code, kpi_definition_name, kpi_definition_unit, kpi_definition_polarity, kpi_definition_is_global, kpi_definition_metadata)
           VALUES ($1, $2, $3, $4, $5, false, jsonb_build_object('materialized_from', $6::text))
           RETURNING kpi_definition_id`,
          [tenantId, kp.code, kp.name, kp.unit, kp.polarity, plan.sourceKey],
        );
        kpiCodeToId.set(kp.code, ins.rows[0]!.kpi_definition_id);
        kpisCreated++;
        records.push({ table: "sys_kpi_definitions", id: ins.rows[0]!.kpi_definition_id, justification: kp.justification });
      }
    } else {
      const ex = await client.query(`SELECT 1 FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id = $1 AND kpi_definition_code = $2`, [tenantId, kp.code]);
      if (ex.rowCount === 0) kpisCreated++;
    }
  }

  // slice-2a + 2b: one GENERATED_INCUMBENT placeholder incumbent per position (+ PRIMARY ACTIVE assignment), each
  // with skill evidence (one per archetype skill, deterministic proficiency) + KPI evidence (one per
  // archetype KPI, deterministic measured_value → cross-incumbent ranking). Keying = SYN_, NEVER
  // LEGACY_EMP:: (I14/ADR-0024). Mirrors db/scripts/seed-reference-bank.ts. Idempotent: user via ON
  // CONFLICT (tenant, lower(email)); assignment/evidence via existence-check (no natural unique on the
  // evidence tables; the partial unique sys_upa_one_primary_active_per_user allows one PRIMARY ACTIVE/user).
  const synUsers = plan.incumbents;
  const applyUserIds: (string | null)[] = new Array(synUsers.length).fill(null); // apply: ui → userId (for set-based evidence)
  let usersCreated = 0;
  let assignmentsCreated = 0;
  let skillEvidenceCreated = 0;
  let kpiEvidenceCreated = 0;
  for (let ui = 0; ui < synUsers.length; ui++) {
    const su = synUsers[ui]!;
    if (mode === "apply") {
      const ins = await client.query<{ user_id: string }>(
        `INSERT INTO sys.sys_users
           (user_tenant_id, user_external_code, user_email, user_display_name,
            user_first_name, user_last_name, user_status, user_type,
            user_locale, user_timezone)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', 'GENERATED_INCUMBENT', 'it-IT', 'Europe/Rome')
         ON CONFLICT (user_tenant_id, lower(user_email)) DO NOTHING
         RETURNING user_id`,
        [tenantId, su.externalCode, su.email, su.displayName, su.firstName, su.lastName],
      );
      let userId: string;
      if (ins.rows[0]) {
        usersCreated++;
        userId = ins.rows[0].user_id;
        records.push({ table: "sys_users", id: userId, justification: su.justification });
      } else {
        const ex = await client.query<{ user_id: string }>(
          `SELECT user_id FROM sys.sys_users WHERE user_tenant_id = $1 AND lower(user_email) = lower($2)`,
          [tenantId, su.email],
        );
        userId = ex.rows[0]!.user_id;
      }
      applyUserIds[ui] = userId;
      const posId = posCodeToId.get(su.positionCode);
      if (posId) {
        const existing = await client.query(
          `SELECT 1 FROM sys.sys_user_position_assignments
            WHERE user_position_assignment_user_id = $1 AND user_position_assignment_position_id = $2
              AND user_position_assignment_kind = 'PRIMARY' AND user_position_assignment_status = 'ACTIVE'`,
          [userId, posId],
        );
        if (existing.rowCount === 0) {
          const ass = await client.query<{ user_position_assignment_id: string }>(
            `INSERT INTO sys.sys_user_position_assignments
               (user_position_assignment_tenant_id, user_position_assignment_user_id,
                user_position_assignment_position_id, user_position_assignment_kind,
                user_position_assignment_fte, user_position_assignment_start_date,
                user_position_assignment_status)
             VALUES ($1, $2, $3, 'PRIMARY', 1.000, '2024-01-01', 'ACTIVE')
             RETURNING user_position_assignment_id`,
            [tenantId, userId, posId],
          );
          assignmentsCreated++;
          if (ass.rows[0]) {
            records.push({ table: "sys_user_position_assignments", id: ass.rows[0].user_position_assignment_id, justification: su.justification });
          }
        }
      }
    } else {
      // plan: count what WOULD be created (user/assignment/evidence absent yet).
      const ux = await client.query(
        `SELECT 1 FROM sys.sys_users WHERE user_tenant_id = $1 AND lower(user_email) = lower($2)`,
        [tenantId, su.email],
      );
      if (ux.rowCount === 0) usersCreated++;
      const ax = await client.query(
        `SELECT 1 FROM sys.sys_user_position_assignments a
           JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
           JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
          WHERE u.user_tenant_id = $1 AND lower(u.user_email) = lower($2) AND p.position_code = $3
            AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'`,
        [tenantId, su.email, su.positionCode],
      );
      if (ax.rowCount === 0) assignmentsCreated++;
    }
  }

  // Evidence — set-based to keep round-trips low (matters over the dev SSH tunnel). apply = anti-join
  // INSERT (rowCount = created); plan = anti-join COUNT (would-create). Both fed by the deterministic
  // synthetic matrices (incumbent × archetype skill, incumbent × archetype KPI).
  if (mode === "apply") {
    const seU: string[] = [], seS: string[] = [], seP: string[] = [];
    const keU: string[] = [], keK: string[] = [], keV: number[] = [], keUnit: string[] = [];
    for (let ui = 0; ui < synUsers.length; ui++) {
      const uid = applyUserIds[ui];
      if (!uid) continue;
      const su = synUsers[ui]!;
      // I VALORI ARRIVANO DAL PIANO, non si ricalcolano qui (#198 T4). Prima il motore
      // chiamava `synProficiency(ui, sj)` e `synKpiValue(ui, kj)`: erano la regola di
      // generazione di UNA sorgente, e conoscerla è esattamente ciò che E21 gli toglie.
      for (const ev of su.skillEvidence) {
        const sid = skillCodeToId.get(ev.skillCode);
        if (sid) { seU.push(uid); seS.push(sid); seP.push(ev.declaredProficiency); }
      }
      for (const ev of su.kpiEvidence) {
        const kid = kpiCodeToId.get(ev.kpiCode);
        if (kid) { keU.push(uid); keK.push(kid); keV.push(ev.measuredValue); keUnit.push(ev.unit); }
      }
    }
    if (seU.length) {
      const r = await client.query(
        `INSERT INTO sys.sys_user_skill_evidence
           (user_skill_evidence_user_id, user_skill_evidence_tenant_id, user_skill_evidence_skill_id,
            user_skill_evidence_declared_proficiency, user_skill_evidence_source)
         SELECT t.uid, $1, t.sid, t.prof, 'MANAGER_ASSESSMENT'
           FROM unnest($2::uuid[], $3::uuid[], $4::varchar[]) AS t(uid, sid, prof)
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_skill_evidence e
            WHERE e.user_skill_evidence_user_id = t.uid AND e.user_skill_evidence_skill_id = t.sid)
         RETURNING user_skill_evidence_id`,
        [tenantId, seU, seS, seP],
      );
      skillEvidenceCreated = r.rowCount ?? 0;
      for (const riga of r.rows as Array<{ user_skill_evidence_id: string }>) {
        records.push({ table: "sys_user_skill_evidence", id: riga.user_skill_evidence_id, justification: `${plan.sourceKey}: evidenza di competenza del titolare segnaposto` });
      }
    }
    if (keU.length) {
      const r = await client.query(
        `INSERT INTO sys.sys_user_kpi_evidence
           (user_kpi_evidence_user_id, user_kpi_evidence_tenant_id, user_kpi_evidence_kpi_id,
            user_kpi_evidence_period_start, user_kpi_evidence_period_end,
            user_kpi_evidence_measured_value, user_kpi_evidence_target_value, user_kpi_evidence_unit)
         SELECT t.uid, $1, t.kid, '2024-01-01', '2024-12-31', t.val, 80, t.unit
           FROM unnest($2::uuid[], $3::uuid[], $4::numeric[], $5::varchar[]) AS t(uid, kid, val, unit)
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_kpi_evidence e
            WHERE e.user_kpi_evidence_user_id = t.uid AND e.user_kpi_evidence_kpi_id = t.kid)
         RETURNING user_kpi_evidence_id`,
        [tenantId, keU, keK, keV, keUnit],
      );
      kpiEvidenceCreated = r.rowCount ?? 0;
      for (const riga of r.rows as Array<{ user_kpi_evidence_id: string }>) {
        records.push({ table: "sys_user_kpi_evidence", id: riga.user_kpi_evidence_id, justification: `${plan.sourceKey}: evidenza di indicatore del titolare segnaposto` });
      }
    }
  } else {
    const seEmail: string[] = [], seCode: string[] = [];
    const keEmail: string[] = [], keCode: string[] = [];
    for (const su of synUsers) {
      for (const ev of su.skillEvidence) { seEmail.push(su.email); seCode.push(ev.skillCode); }
      for (const ev of su.kpiEvidence) { keEmail.push(su.email); keCode.push(ev.kpiCode); }
    }
    if (seEmail.length) {
      const r = await client.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM unnest($2::text[], $3::text[]) AS t(email, scode)
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_skill_evidence e
            JOIN sys.sys_users u ON u.user_id = e.user_skill_evidence_user_id
            JOIN sys.sys_skills s ON s.skill_id = e.user_skill_evidence_skill_id
           WHERE u.user_tenant_id = $1 AND lower(u.user_email) = lower(t.email) AND s.skill_tenant_id = $1 AND s.skill_code = t.scode)`,
        [tenantId, seEmail, seCode],
      );
      skillEvidenceCreated = Number(r.rows[0]!.c);
    }
    if (keEmail.length) {
      const r = await client.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM unnest($2::text[], $3::text[]) AS t(email, kcode)
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_kpi_evidence e
            JOIN sys.sys_users u ON u.user_id = e.user_kpi_evidence_user_id
            JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = e.user_kpi_evidence_kpi_id
           WHERE u.user_tenant_id = $1 AND lower(u.user_email) = lower(t.email) AND k.kpi_definition_tenant_id = $1 AND k.kpi_definition_code = t.kcode)`,
        [tenantId, keEmail, keCode],
      );
      kpiEvidenceCreated = Number(r.rows[0]!.c);
    }
  }

  return {
    records,
    orgUnits: orgUnitsCreated,
    positions: positionsCreated,
    users: usersCreated,
    assignments: assignmentsCreated,
    skills: skillsCreated,
    kpis: kpisCreated,
    skillEvidence: skillEvidenceCreated,
    kpiEvidence: kpiEvidenceCreated,
  };
}
