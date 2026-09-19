/**
 * apps/api/src/modules/approvals/effects/position-assignment.ts — Mandato K, G-1 (D4=B, F6).
 *
 * Il gesto "assegna / termina / trasferisci" persona↔posizione, copiato dall'idioma di
 * `applyTenantImportRun`: la firma e' la richiesta di approvazione `USER_POSITION_ASSIGNMENT`
 * (`metadata.action` sceglie fra ASSIGN/TERMINATE/TRANSFER); questo effetto scrive SOLO
 * all'approvazione, tutto nella stessa transazione. Nessuna DELETE mai (I1): terminare un
 * incarico chiude un intervallo (`end_date`), non cancella la riga.
 *
 * Ogni precondizione si RI-VERIFICA al momento dell'esecuzione, mai ereditata dalla proposta
 * (l'approvazione e' asincrona: nel frattempo la posizione puo' essere stata occupata, l'utente
 * disattivato). Le sentinelle che questo effetto rispetta per costruzione (misurate con
 * `chi_sorveglia.py` prima di scrivere, C1): `v_active_primary_assignment_per_user` (mai due
 * PRIMARY ACTIVE per lo stesso utente — TRANSFER chiude la vecchia PRIMA di aprire la nuova,
 * nella stessa transazione) e `v_tenant_boundary_violations` (l'assignment nasce sempre nel
 * tenant di utente e posizione, mai altrove).
 */
import type { PoolClient } from "pg";
import type { ApprovalRequestRow } from "../repository.js";
import { ConflictError } from "../../../errors/index.js";

export const USER_POSITION_ASSIGNMENT = "USER_POSITION_ASSIGNMENT";

/**
 * Punto di sabotaggio dichiarato, per la prova che deve poter fallire (mandato K, G-1, passo
 * 67, "controprova eseguita, non pensata"): chiude la riga vecchia SENZA aprire la nuova, cosi'
 * il conteggio totale resta +0 invece di +1 — il test lo deve VEDERE, non presumerlo. Usato SOLO
 * dai test; in produzione vale sempre `false`.
 */
export const guasti = { transferNonApre: false };

type Action = "ASSIGN" | "TERMINATE" | "TRANSFER";

interface AssignMeta {
  action: "ASSIGN";
  userId: string;
  positionId: string;
  kind: string;
  fte: number;
  startDate: string;
  notes: string | null;
}
interface TerminateMeta {
  action: "TERMINATE";
  assignmentId: string;
  endDate: string;
  notes: string | null;
}
interface TransferMeta {
  action: "TRANSFER";
  assignmentId: string;
  newPositionId: string;
  startDate: string;
  notes: string | null;
}
type Meta = AssignMeta | TerminateMeta | TransferMeta;

function fail(msg: string): never {
  throw new ConflictError(`USER_POSITION_ASSIGNMENT apply failed: ${msg}`, "APPLY_EFFECT_FAILED");
}

function parseMeta(m: Record<string, unknown>): Meta {
  const action = m["action"] as Action | undefined;
  if (action === "ASSIGN") {
    const { userId, positionId, kind, fte, startDate } = m;
    if (typeof userId !== "string" || typeof positionId !== "string") fail("metadata.userId/positionId missing");
    if (typeof kind !== "string" || typeof fte !== "number" || typeof startDate !== "string") fail("metadata.kind/fte/startDate missing");
    return { action, userId, positionId, kind, fte, startDate, notes: typeof m["notes"] === "string" ? m["notes"] : null };
  }
  if (action === "TERMINATE") {
    const { assignmentId, endDate } = m;
    if (typeof assignmentId !== "string" || typeof endDate !== "string") fail("metadata.assignmentId/endDate missing");
    return { action, assignmentId, endDate, notes: typeof m["notes"] === "string" ? m["notes"] : null };
  }
  if (action === "TRANSFER") {
    const { assignmentId, newPositionId, startDate } = m;
    if (typeof assignmentId !== "string" || typeof newPositionId !== "string" || typeof startDate !== "string") {
      fail("metadata.assignmentId/newPositionId/startDate missing");
    }
    return { action, assignmentId, newPositionId, startDate, notes: typeof m["notes"] === "string" ? m["notes"] : null };
  }
  fail(`metadata.action sconosciuta: ${String(action)}`);
}

interface AssignmentRow {
  user_position_assignment_id: string;
  user_position_assignment_tenant_id: string;
  user_position_assignment_user_id: string;
  user_position_assignment_position_id: string;
  user_position_assignment_kind: string;
  user_position_assignment_fte: string;
  user_position_assignment_status: string;
}

async function assign(client: PoolClient, tenantId: string, meta: AssignMeta): Promise<void> {
  const utente = await client.query<{ user_status: string; user_tenant_id: string }>(
    `SELECT user_status, user_tenant_id FROM sys.sys_users WHERE user_id = $1`,
    [meta.userId],
  );
  if (utente.rowCount !== 1 || utente.rows[0]!.user_tenant_id !== tenantId) fail("l'utente non esiste piu' in questo tenant");
  if (utente.rows[0]!.user_status !== "ACTIVE") fail("l'utente non e' ACTIVE: la proposta non descrive piu' la realta'");

  const posizione = await client.query<{ position_tenant_id: string }>(
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`,
    [meta.positionId],
  );
  if (posizione.rowCount !== 1 || posizione.rows[0]!.position_tenant_id !== tenantId) fail("la posizione non esiste piu' in questo tenant");

  if (meta.kind === "PRIMARY") {
    const gia = await client.query(
      `SELECT 1 FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_user_id = $1
          AND user_position_assignment_kind = 'PRIMARY' AND user_position_assignment_status = 'ACTIVE'`,
      [meta.userId],
    );
    if ((gia.rowCount ?? 0) > 0) fail("l'utente ha gia' un incarico PRIMARY attivo: usa TRANSFER, non ASSIGN");
  }

  await client.query(
    `INSERT INTO sys.sys_user_position_assignments
       (user_position_assignment_tenant_id, user_position_assignment_user_id, user_position_assignment_position_id,
        user_position_assignment_kind, user_position_assignment_fte, user_position_assignment_start_date,
        user_position_assignment_status, user_position_assignment_notes, origine_dato)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, 'NATIVO')`,
    [tenantId, meta.userId, meta.positionId, meta.kind, meta.fte, meta.startDate, meta.notes],
  );
}

async function loadActive(client: PoolClient, tenantId: string, assignmentId: string): Promise<AssignmentRow> {
  const r = await client.query<AssignmentRow>(
    `SELECT user_position_assignment_id, user_position_assignment_tenant_id, user_position_assignment_user_id,
            user_position_assignment_position_id, user_position_assignment_kind, user_position_assignment_fte,
            user_position_assignment_status
       FROM sys.sys_user_position_assignments
      WHERE user_position_assignment_id = $1`,
    [assignmentId],
  );
  if (r.rowCount !== 1 || r.rows[0]!.user_position_assignment_tenant_id !== tenantId) fail("l'incarico non esiste piu' in questo tenant");
  if (r.rows[0]!.user_position_assignment_status !== "ACTIVE") fail("l'incarico non e' piu' ACTIVE: la proposta non descrive piu' la realta'");
  return r.rows[0]!;
}

async function terminate(client: PoolClient, tenantId: string, meta: TerminateMeta): Promise<void> {
  const riga = await loadActive(client, tenantId, meta.assignmentId);
  const upd = await client.query(
    `UPDATE sys.sys_user_position_assignments
        SET user_position_assignment_status = 'ENDED',
            user_position_assignment_end_date = $2,
            user_position_assignment_notes = coalesce($3, user_position_assignment_notes),
            updated_at = now()
      WHERE user_position_assignment_id = $1
        AND user_position_assignment_status = 'ACTIVE'
        AND user_position_assignment_start_date <= $2::date`,
    [riga.user_position_assignment_id, meta.endDate, meta.notes],
  );
  if (upd.rowCount !== 1) fail("la chiusura non e' andata a buon fine (guardia CHECK date o stato cambiato nel frattempo)");
}

async function transfer(client: PoolClient, tenantId: string, meta: TransferMeta): Promise<void> {
  const riga = await loadActive(client, tenantId, meta.assignmentId);
  const posizione = await client.query<{ position_tenant_id: string }>(
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`,
    [meta.newPositionId],
  );
  if (posizione.rowCount !== 1 || posizione.rows[0]!.position_tenant_id !== tenantId) fail("la nuova posizione non esiste piu' in questo tenant");

  // Prima si chiude la vecchia riga: cosi' non esiste mai un istante con due PRIMARY ACTIVE
  // per lo stesso utente (v_active_primary_assignment_per_user), nella stessa transazione.
  const chiusa = await client.query(
    `UPDATE sys.sys_user_position_assignments
        SET user_position_assignment_status = 'ENDED',
            user_position_assignment_end_date = $2,
            updated_at = now()
      WHERE user_position_assignment_id = $1
        AND user_position_assignment_status = 'ACTIVE'
        AND user_position_assignment_start_date <= $2::date`,
    [riga.user_position_assignment_id, meta.startDate],
  );
  if (chiusa.rowCount !== 1) fail("la chiusura del vecchio incarico non e' andata a buon fine (guardia CHECK date)");

  if (guasti.transferNonApre) return; // sabotaggio dichiarato: chiude senza aprire (solo test)

  await client.query(
    `INSERT INTO sys.sys_user_position_assignments
       (user_position_assignment_tenant_id, user_position_assignment_user_id, user_position_assignment_position_id,
        user_position_assignment_kind, user_position_assignment_fte, user_position_assignment_start_date,
        user_position_assignment_status, user_position_assignment_notes, origine_dato)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, 'NATIVO')`,
    [tenantId, riga.user_position_assignment_user_id, meta.newPositionId, riga.user_position_assignment_kind,
     riga.user_position_assignment_fte, meta.startDate, meta.notes],
  );
}

export async function applyPositionAssignment(client: PoolClient, request: ApprovalRequestRow): Promise<void> {
  const tenantId = request.tenantId;
  if (!tenantId) fail("la richiesta non ha un tenant");
  const meta = parseMeta(request.metadata);

  if (meta.action === "ASSIGN") await assign(client, tenantId, meta);
  else if (meta.action === "TERMINATE") await terminate(client, tenantId, meta);
  else await transfer(client, tenantId, meta);

  // POST-CONDIZIONE: nessun utente con due PRIMARY ACTIVE nel tenant appena toccato (protegge
  // cio' che NON doveva cambiare — la stessa sentinella di produzione, in transazione).
  const doppi = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM (
        SELECT user_position_assignment_user_id
          FROM sys.sys_user_position_assignments
         WHERE user_position_assignment_tenant_id = $1
           AND user_position_assignment_kind = 'PRIMARY' AND user_position_assignment_status = 'ACTIVE'
         GROUP BY user_position_assignment_user_id
        HAVING count(*) > 1
     ) x`,
    [tenantId],
  );
  if (Number(doppi.rows[0]?.n ?? 0) !== 0) fail("post-condizione violata: un utente risulta con due incarichi PRIMARY attivi");
}
