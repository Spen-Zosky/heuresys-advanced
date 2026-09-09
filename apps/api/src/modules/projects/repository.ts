/**
 * apps/api/src/modules/projects/repository.ts
 * SQL parametrizzato grezzo su sys.sys_projects + sys.sys_project_members (`#143` F4).
 *
 * ⚠ Nessun `leadUserId` in nessuna query, ed e' voluto: il capo di un progetto e'
 * un'APPARTENENZA con `project_member_role = 'LEAD'` (F2, mig `000363`). Una colonna che
 * duplicasse quel fatto ricreerebbe le due divergenze che F2 ha misurato e sciolto.
 */
import type { Pool, PoolClient } from "pg";

import type {
  Project,
  ProjectCreateBody,
  ProjectMember,
  ProjectMemberUpsertBody,
  ProjectUpdateBody,
} from "@heuresys/shared";

type Eseguibile = Pool | PoolClient;

/** Le colonne del progetto piu' il conteggio dei membri CORRENTI (finestra che copre oggi):
 *  contare anche le appartenenze chiuse direbbe quante persone sono passate, non quante ci
 *  lavorano — due domande diverse, e questa e' la seconda. */
const COLONNE = `
  p.project_id, p.project_tenant_id, p.project_code, p.project_name,
  p.project_purpose, p.project_objective, p.project_organization_unit_id,
  p.project_status, p.project_starts_on, p.project_ends_on,
  p.project_progress_pct, p.project_origin_team_id, p.project_metadata,
  p.created_at, p.updated_at,
  (SELECT count(*) FROM sys.sys_project_members m
    WHERE m.project_member_project_id = p.project_id
      AND m.project_member_starts_on <= CURRENT_DATE
      AND (m.project_member_ends_on IS NULL OR m.project_member_ends_on >= CURRENT_DATE)
  )::int AS member_count`;

interface RigaProgetto {
  project_id: string;
  project_tenant_id: string;
  project_code: string;
  project_name: string;
  project_purpose: string | null;
  project_objective: string | null;
  project_organization_unit_id: string | null;
  project_status: string;
  project_starts_on: Date | string | null;
  project_ends_on: Date | string | null;
  project_progress_pct: string | number | null;
  project_origin_team_id: string | null;
  project_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  member_count: number;
}

/** `date` di Postgres arriva come Date o stringa a seconda del driver: si normalizza a
 *  `YYYY-MM-DD`, che e' cio' che lo schema dichiara. */
function soloData(v: Date | string | null): string | null {
  if (v === null) return null;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

function mappa(r: RigaProgetto): Project {
  return {
    projectId: r.project_id,
    tenantId: r.project_tenant_id,
    code: r.project_code,
    name: r.project_name,
    purpose: r.project_purpose,
    objective: r.project_objective,
    organizationUnitId: r.project_organization_unit_id,
    status: r.project_status as Project["status"],
    startsOn: soloData(r.project_starts_on),
    endsOn: soloData(r.project_ends_on),
    // `numeric` torna stringa dal driver pg: senza questa conversione lo schema Zod
    // rifiuterebbe un valore che il database ha scritto correttamente.
    progressPct: r.project_progress_pct === null ? null : Number(r.project_progress_pct),
    originTeamId: r.project_origin_team_id,
    metadata: r.project_metadata,
    memberCount: r.member_count,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export interface FiltroProgetti {
  tenantId?: string;
  /** Restringe ai progetti di cui questa persona e' membro: e' l'asse funzionale. */
  memberUserId?: string;
  status?: string;
  current?: boolean;
  limit: number;
  offset: number;
}

export async function listProjects(
  db: Eseguibile,
  f: FiltroProgetti,
): Promise<{ items: Project[]; total: number }> {
  const dove: string[] = [];
  const val: unknown[] = [];
  if (f.tenantId !== undefined) {
    val.push(f.tenantId);
    dove.push(`p.project_tenant_id = $${val.length}`);
  }
  if (f.memberUserId !== undefined) {
    val.push(f.memberUserId);
    dove.push(`EXISTS (SELECT 1 FROM sys.sys_project_members m
                        WHERE m.project_member_project_id = p.project_id
                          AND m.project_member_user_id = $${val.length}
                          AND m.project_member_starts_on <= CURRENT_DATE
                          AND (m.project_member_ends_on IS NULL
                               OR m.project_member_ends_on >= CURRENT_DATE))`);
  }
  if (f.status !== undefined) {
    val.push(f.status);
    dove.push(`p.project_status = $${val.length}`);
  }
  if (f.current === true) {
    dove.push(`(p.project_starts_on IS NULL OR p.project_starts_on <= CURRENT_DATE)
               AND (p.project_ends_on IS NULL OR p.project_ends_on >= CURRENT_DATE)`);
  }
  const clausola = dove.length ? `WHERE ${dove.join(" AND ")}` : "";

  const conteggio = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_projects p ${clausola}`, val);

  val.push(f.limit, f.offset);
  const righe = await db.query<RigaProgetto>(
    `SELECT ${COLONNE} FROM sys.sys_projects p ${clausola}
      ORDER BY p.project_name ASC
      LIMIT $${val.length - 1} OFFSET $${val.length}`, val);

  return { items: righe.rows.map(mappa), total: Number(conteggio.rows[0]?.n ?? 0) };
}

export async function findProjectById(db: Eseguibile, id: string): Promise<Project | null> {
  const r = await db.query<RigaProgetto>(
    `SELECT ${COLONNE} FROM sys.sys_projects p WHERE p.project_id = $1`, [id]);
  const riga = r.rows[0];
  return riga ? mappa(riga) : null;
}

export async function findProjectByCode(
  db: Eseguibile, tenantId: string, code: string,
): Promise<Project | null> {
  const r = await db.query<RigaProgetto>(
    `SELECT ${COLONNE} FROM sys.sys_projects p
      WHERE p.project_tenant_id = $1 AND p.project_code = $2`, [tenantId, code]);
  const riga = r.rows[0];
  return riga ? mappa(riga) : null;
}

export async function loadProjectMembers(db: Eseguibile, id: string): Promise<ProjectMember[]> {
  const r = await db.query<{
    project_member_user_id: string;
    project_member_role: string;
    email: string | null;
    full_name: string | null;
    project_member_starts_on: Date | string;
    project_member_ends_on: Date | string | null;
    is_current: boolean;
  }>(
    `SELECT m.project_member_user_id, m.project_member_role,
            u.user_email AS email,
            nullif(trim(concat_ws(' ', u.user_first_name, u.user_last_name)), '') AS full_name,
            m.project_member_starts_on, m.project_member_ends_on,
            (m.project_member_starts_on <= CURRENT_DATE
             AND (m.project_member_ends_on IS NULL
                  OR m.project_member_ends_on >= CURRENT_DATE)) AS is_current
       FROM sys.sys_project_members m
       LEFT JOIN sys.sys_users u ON u.user_id = m.project_member_user_id
      WHERE m.project_member_project_id = $1
      ORDER BY (m.project_member_role = 'LEAD') DESC, full_name ASC NULLS LAST`, [id]);

  return r.rows.map((x) => ({
    userId: x.project_member_user_id,
    role: x.project_member_role as ProjectMember["role"],
    email: x.email,
    fullName: x.full_name,
    startsOn: soloData(x.project_member_starts_on) ?? "",
    endsOn: soloData(x.project_member_ends_on),
    isCurrent: x.is_current,
  }));
}

/** Se questa persona partecipa ADESSO al progetto (finestra aperta): e' il predicato
 *  dell'asse funzionale, e un'appartenenza chiusa non lo soddisfa. */
export async function userInProject(
  db: Eseguibile, projectId: string, userId: string,
): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM sys.sys_project_members
      WHERE project_member_project_id = $1 AND project_member_user_id = $2
        AND project_member_starts_on <= CURRENT_DATE
        AND (project_member_ends_on IS NULL OR project_member_ends_on >= CURRENT_DATE)
      LIMIT 1`, [projectId, userId]);
  return r.rowCount === 1;
}

/** Se questa persona GUIDA adesso il progetto. Il capo si legge dall'appartenenza: non
 *  esiste nessuna colonna da interrogare, ed e' la decisione di F2. */
export async function userLeadsProject(
  db: Eseguibile, projectId: string, userId: string,
): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM sys.sys_project_members
      WHERE project_member_project_id = $1 AND project_member_user_id = $2
        AND project_member_role = 'LEAD'
        AND project_member_starts_on <= CURRENT_DATE
        AND (project_member_ends_on IS NULL OR project_member_ends_on >= CURRENT_DATE)
      LIMIT 1`, [projectId, userId]);
  return r.rowCount === 1;
}

export async function insertProject(
  db: Eseguibile, tenantId: string, body: ProjectCreateBody, actorId: string,
): Promise<string> {
  const r = await db.query<{ project_id: string }>(
    `INSERT INTO sys.sys_projects
       (project_tenant_id, project_code, project_name, project_purpose, project_objective,
        project_organization_unit_id, project_status, project_starts_on, project_ends_on,
        project_metadata, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,coalesce($7,'ACTIVE'),$8,$9,coalesce($10,'{}'::jsonb),$11,$11)
     RETURNING project_id`,
    [tenantId, body.code, body.name, body.purpose ?? null, body.objective ?? null,
     body.organizationUnitId ?? null, body.status ?? null,
     body.startsOn ?? null, body.endsOn ?? null,
     body.metadata ? JSON.stringify(body.metadata) : null, actorId]);
  return r.rows[0]!.project_id;
}

export async function updateProject(
  db: Eseguibile, id: string, body: ProjectUpdateBody, actorId: string,
): Promise<void> {
  // `coalesce($n, colonna)` invece di comporre la SET a pezzi: il body e' parziale, e questa
  // forma lascia intatto cio' che non e' stato mandato senza costruire SQL variabile.
  // ⚠ Conseguenza dichiarata: un campo non si puo' riportare a NULL da qui. Nessuno dei
  // campi tocca una decisione, quindi il caso non serve; se servisse, va una rotta sua.
  await db.query(
    `UPDATE sys.sys_projects
        SET project_name = coalesce($2, project_name),
            project_purpose = coalesce($3, project_purpose),
            project_objective = coalesce($4, project_objective),
            project_organization_unit_id = coalesce($5, project_organization_unit_id),
            project_status = coalesce($6, project_status),
            project_starts_on = coalesce($7, project_starts_on),
            project_ends_on = coalesce($8, project_ends_on),
            project_metadata = coalesce($9, project_metadata),
            updated_at = now(), updated_by = $10
      WHERE project_id = $1`,
    [id, body.name ?? null, body.purpose ?? null, body.objective ?? null,
     body.organizationUnitId ?? null, body.status ?? null,
     body.startsOn ?? null, body.endsOn ?? null,
     body.metadata ? JSON.stringify(body.metadata) : null, actorId]);
}

export async function updateProgress(
  db: Eseguibile, id: string, pct: number, actorId: string,
): Promise<void> {
  await db.query(
    `UPDATE sys.sys_projects
        SET project_progress_pct = $2, updated_at = now(), updated_by = $3
      WHERE project_id = $1`, [id, pct, actorId]);
}

/** Chi guida ADESSO il progetto, o `null`. Serve a dare un errore parlante prima che sia
 *  l'indice unico parziale a fermare la scrittura con un messaggio da database. */
export async function currentLead(
  db: Eseguibile, projectId: string,
): Promise<string | null> {
  const r = await db.query<{ project_member_user_id: string }>(
    `SELECT project_member_user_id FROM sys.sys_project_members
      WHERE project_member_project_id = $1 AND project_member_role = 'LEAD'
        AND project_member_ends_on IS NULL
      LIMIT 1`, [projectId]);
  return r.rows[0]?.project_member_user_id ?? null;
}

/**
 * ⚠ NIENTE `ON CONFLICT`, e non e' una svista: misurato sullo schema vivo il 2026-09-09,
 * `sys_project_members` **non ha** un vincolo unico su (progetto, persona). Ne ha uno
 * PARZIALE, `sys_project_members_one_open_lead_idx`, che impone **un solo LEAD aperto per
 * progetto** — un vincolo diverso e piu' interessante. Un `ON CONFLICT (project, user)`
 * sarebbe morto a runtime con «no unique or exclusion constraint matching».
 *
 * Quindi: si aggiorna l'appartenenza APERTA se c'e', altrimenti se ne apre una. Il
 * chiamante lavora dentro una transazione, cosi' i due passi non si separano.
 */
export async function upsertMember(
  db: Eseguibile, projectId: string, userId: string, tenantId: string,
  body: ProjectMemberUpsertBody, actorId: string,
): Promise<void> {
  const agg = await db.query(
    `UPDATE sys.sys_project_members
        SET project_member_role = $4,
            project_member_starts_on = coalesce($5::date, project_member_starts_on),
            project_member_ends_on = $6,
            updated_at = now(), updated_by = $7
      WHERE project_member_project_id = $1 AND project_member_user_id = $2
        AND (project_member_ends_on IS NULL OR project_member_ends_on >= CURRENT_DATE)`,
    [projectId, userId, tenantId, body.role, body.startsOn ?? null, body.endsOn ?? null, actorId]);
  if ((agg.rowCount ?? 0) > 0) return;

  await db.query(
    `INSERT INTO sys.sys_project_members
       (project_member_project_id, project_member_user_id, project_member_tenant_id,
        project_member_role, project_member_starts_on, project_member_ends_on,
        created_by, updated_by)
     VALUES ($1,$2,$3,$4,coalesce($5::date, CURRENT_DATE),$6,$7,$7)`,
    [projectId, userId, tenantId, body.role, body.startsOn ?? null, body.endsOn ?? null, actorId]);
}

/** Chiude l'appartenenza invece di cancellarla: la finestra temporale esiste per sapere
 *  «chi c'era quando», e una DELETE butterebbe via proprio quel dato (F2). */
export async function closeMember(
  db: Eseguibile, projectId: string, userId: string, actorId: string,
): Promise<boolean> {
  const r = await db.query(
    `UPDATE sys.sys_project_members
        SET project_member_ends_on = CURRENT_DATE, updated_at = now(), updated_by = $3
      WHERE project_member_project_id = $1 AND project_member_user_id = $2
        AND (project_member_ends_on IS NULL OR project_member_ends_on > CURRENT_DATE)`,
    [projectId, userId, actorId]);
  return (r.rowCount ?? 0) > 0;
}
