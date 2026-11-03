/**
 * apps/api/src/modules/tenant-consolidation/repository.ts — AC-9.
 *
 * SQL parametrizzato sul registro del consolidamento (mig `000464`). Il registro è la memoria
 * del lavoro: il ponte delle approvazioni del gateway vive in memoria e scade in 120 secondi,
 * mentre una sessione di consolidamento dura giorni (disegno §4).
 *
 * Il tenant entra sempre come primo filtro e viene dalla sessione autenticata (I5): nessuna
 * funzione qui accetta un identificativo di sessione senza il tenant accanto.
 */
import type { Pool, PoolClient } from "pg";
import type {
  ConsolidationGroup,
  ConsolidationProposal,
  Decision,
  GroupProgress,
  LinkForm,
  TenantConsolidation,
} from "@heuresys/shared";
import type { Proposta, StatoGruppo } from "./engine.js";

export type DbConnector = Pool | PoolClient;

interface RigaSessione {
  tenant_consolidation_id: string;
  tenant_consolidation_tenant_id: string;
  tenant_consolidation_variant_version_id: string;
  tenant_consolidation_trigger: string;
  tenant_consolidation_status: string;
  tenant_consolidation_open_group: string | null;
  tenant_consolidation_started_by: string | null;
  tenant_consolidation_started_at: Date;
  tenant_consolidation_metadata: Record<string, unknown> | null;
}

function mappaSessione(r: RigaSessione): TenantConsolidation {
  return {
    consolidationId: r.tenant_consolidation_id,
    tenantId: r.tenant_consolidation_tenant_id,
    variantVersionId: r.tenant_consolidation_variant_version_id,
    trigger: r.tenant_consolidation_trigger as TenantConsolidation["trigger"],
    status: r.tenant_consolidation_status as TenantConsolidation["status"],
    openGroup: r.tenant_consolidation_open_group as TenantConsolidation["openGroup"],
    startedByUserId: r.tenant_consolidation_started_by,
    startedAt: r.tenant_consolidation_started_at.toISOString(),
    runningGroup: (r.tenant_consolidation_metadata?.["running_group"] ?? null) as TenantConsolidation["runningGroup"],
    lastRun: (r.tenant_consolidation_metadata?.["last_run"] ?? null) as TenantConsolidation["lastRun"],
  };
}

const SESSIONE = `
  tenant_consolidation_id, tenant_consolidation_tenant_id, tenant_consolidation_variant_version_id,
  tenant_consolidation_trigger, tenant_consolidation_status, tenant_consolidation_open_group,
  tenant_consolidation_started_by, tenant_consolidation_started_at, tenant_consolidation_metadata`;

export async function listConsolidations(q: DbConnector, tenantId: string): Promise<TenantConsolidation[]> {
  const { rows } = await q.query<RigaSessione>(
    `SELECT ${SESSIONE} FROM sys.sys_tenant_consolidations
      WHERE tenant_consolidation_tenant_id = $1
      ORDER BY tenant_consolidation_started_at DESC`,
    [tenantId],
  );
  return rows.map(mappaSessione);
}

export async function getConsolidation(
  q: DbConnector,
  tenantId: string,
  id: string,
  perAggiornare = false,
): Promise<TenantConsolidation | null> {
  const { rows } = await q.query<RigaSessione>(
    `SELECT ${SESSIONE} FROM sys.sys_tenant_consolidations
      WHERE tenant_consolidation_tenant_id = $1 AND tenant_consolidation_id = $2
      ${perAggiornare ? "FOR UPDATE" : ""}`,
    [tenantId, id],
  );
  return rows[0] ? mappaSessione(rows[0]) : null;
}

/** La versione del prototipo esiste ed è una versione pubblicata di una variante. */
export async function variantVersionExists(q: DbConnector, id: string): Promise<boolean> {
  const { rows } = await q.query(
    `SELECT 1 FROM sys.sys_blueprint_variant_versions WHERE blueprint_variant_version_id = $1`,
    [id],
  );
  return rows.length > 0;
}

/** La versione del prototipo in vigore per il tenant: quella dell'attivazione ACTIVE (000463). */
export async function activeVariantVersion(q: DbConnector, tenantId: string): Promise<string | null> {
  const { rows } = await q.query<{ id: string }>(
    `SELECT blueprint_activation_variant_version_id AS id
       FROM sys.sys_blueprint_activations
      WHERE blueprint_activation_tenant_id = $1 AND blueprint_activation_status = 'ACTIVE'
        AND blueprint_activation_variant_version_id IS NOT NULL
      ORDER BY blueprint_activation_effective_from DESC
      LIMIT 1`,
    [tenantId],
  );
  return rows[0]?.id ?? null;
}

/**
 * Apre una sessione. L'indice unico parziale della 000464 vieta due sessioni aperte per lo
 * stesso tenant: il conflitto torna `null` e il servizio lo traduce in 409.
 */
export async function createConsolidation(
  q: DbConnector,
  tenantId: string,
  v: { variantVersionId: string; trigger: string; userId: string | null; openGroup: ConsolidationGroup },
): Promise<TenantConsolidation | null> {
  const { rows } = await q.query<RigaSessione>(
    `INSERT INTO sys.sys_tenant_consolidations
       (tenant_consolidation_tenant_id, tenant_consolidation_variant_version_id,
        tenant_consolidation_trigger, tenant_consolidation_open_group, tenant_consolidation_started_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING ${SESSIONE}`,
    [tenantId, v.variantVersionId, v.trigger, v.openGroup, v.userId],
  );
  return rows[0] ? mappaSessione(rows[0]) : null;
}

export async function setStatus(
  q: DbConnector,
  id: string,
  status: TenantConsolidation["status"],
  openGroup: ConsolidationGroup | null,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_tenant_consolidations
        SET tenant_consolidation_status = $2, tenant_consolidation_open_group = $3,
            tenant_consolidation_closed_at = CASE WHEN $2 = 'CHIUSA' THEN now() ELSE tenant_consolidation_closed_at END
      WHERE tenant_consolidation_id = $1`,
    [id, status, openGroup],
  );
}

/* ── le proposte ─────────────────────────────────────────────────────────────────────── */

interface RigaProposta {
  tenant_consolidation_proposal_id: string;
  tenant_consolidation_proposal_consolidation_id: string;
  tenant_consolidation_proposal_group: string;
  tenant_consolidation_proposal_prototype_keys: string[];
  tenant_consolidation_proposal_tenant_keys: string[];
  tenant_consolidation_proposal_outcome: string;
  tenant_consolidation_proposal_method: string;
  tenant_consolidation_proposal_confidence: number;
  tenant_consolidation_proposal_reason: string;
  tenant_consolidation_proposal_round: number;
  tenant_consolidation_proposal_adopted: boolean;
  tenant_consolidation_proposal_depends_on: string[];
  decision_id: string | null;
  decision_value: string | null;
}

function mappaProposta(r: RigaProposta): ConsolidationProposal {
  return {
    proposalId: r.tenant_consolidation_proposal_id,
    consolidationId: r.tenant_consolidation_proposal_consolidation_id,
    group: r.tenant_consolidation_proposal_group as ConsolidationGroup,
    prototypeKeys: r.tenant_consolidation_proposal_prototype_keys,
    tenantKeys: r.tenant_consolidation_proposal_tenant_keys,
    outcome: r.tenant_consolidation_proposal_outcome as ConsolidationProposal["outcome"],
    method: r.tenant_consolidation_proposal_method as ConsolidationProposal["method"],
    confidence: r.tenant_consolidation_proposal_confidence,
    reason: r.tenant_consolidation_proposal_reason,
    round: r.tenant_consolidation_proposal_round,
    adoptedInWorkingCopy: r.tenant_consolidation_proposal_adopted,
    dependsOn: r.tenant_consolidation_proposal_depends_on,
    decision: r.decision_value as Decision | null,
    tenantItems: [],
    prototypeItems: [],
  };
}

/**
 * La decisione valida di una proposta è l'ultima che nessun'altra ha sostituito: le decisioni
 * non si modificano, si sostituiscono (mig 000464 ④), così la storia resta intera.
 */
const ULTIMA_DECISIONE = `
  LEFT JOIN LATERAL (
    SELECT d.tenant_consolidation_decision_id AS decision_id, d.tenant_consolidation_decision_value AS decision_value
      FROM sys.sys_tenant_consolidation_decisions d
     WHERE d.tenant_consolidation_decision_proposal_id = p.tenant_consolidation_proposal_id
       AND NOT EXISTS (SELECT 1 FROM sys.sys_tenant_consolidation_decisions s
                        WHERE s.tenant_consolidation_decision_supersedes_id = d.tenant_consolidation_decision_id)
     ORDER BY d.tenant_consolidation_decision_decided_at DESC
     LIMIT 1) ud ON true`;

const PROPOSTA = `p.tenant_consolidation_proposal_id, p.tenant_consolidation_proposal_consolidation_id,
  p.tenant_consolidation_proposal_group, p.tenant_consolidation_proposal_prototype_keys,
  p.tenant_consolidation_proposal_tenant_keys, p.tenant_consolidation_proposal_outcome,
  p.tenant_consolidation_proposal_method, p.tenant_consolidation_proposal_confidence,
  p.tenant_consolidation_proposal_reason, p.tenant_consolidation_proposal_round,
  p.tenant_consolidation_proposal_adopted, p.tenant_consolidation_proposal_depends_on,
  ud.decision_id, ud.decision_value`;

export async function listProposals(
  q: DbConnector,
  tenantId: string,
  consolidationId: string,
  groups: readonly ConsolidationGroup[] | null,
): Promise<ConsolidationProposal[]> {
  const { rows } = await q.query<RigaProposta>(
    `SELECT ${PROPOSTA}
       FROM sys.sys_tenant_consolidation_proposals p
       JOIN sys.sys_tenant_consolidations c ON c.tenant_consolidation_id = p.tenant_consolidation_proposal_consolidation_id
       ${ULTIMA_DECISIONE}
      WHERE c.tenant_consolidation_tenant_id = $1 AND c.tenant_consolidation_id = $2
        AND p.tenant_consolidation_proposal_superseded_at IS NULL
        AND ($3::text[] IS NULL OR p.tenant_consolidation_proposal_group = ANY($3::text[]))
      ORDER BY p.tenant_consolidation_proposal_group, p.tenant_consolidation_proposal_round,
               p.tenant_consolidation_proposal_confidence DESC, p.tenant_consolidation_proposal_id`,
    [tenantId, consolidationId, groups ? [...groups] : null],
  );
  return rows.map(mappaProposta);
}

export async function getProposals(
  q: DbConnector,
  tenantId: string,
  ids: readonly string[],
): Promise<Array<ConsolidationProposal & { decisionId: string | null; status: TenantConsolidation["status"] }>> {
  const { rows } = await q.query<RigaProposta & { tenant_consolidation_status: string }>(
    `SELECT ${PROPOSTA}, c.tenant_consolidation_status
       FROM sys.sys_tenant_consolidation_proposals p
       JOIN sys.sys_tenant_consolidations c ON c.tenant_consolidation_id = p.tenant_consolidation_proposal_consolidation_id
       ${ULTIMA_DECISIONE}
      WHERE c.tenant_consolidation_tenant_id = $1
        AND p.tenant_consolidation_proposal_id = ANY($2::uuid[])
        AND p.tenant_consolidation_proposal_superseded_at IS NULL
      FOR UPDATE OF p`,
    [tenantId, [...ids]],
  );
  return rows.map((r) => ({
    ...mappaProposta(r),
    decisionId: r.decision_id,
    status: r.tenant_consolidation_status as TenantConsolidation["status"],
  }));
}

export async function insertDecision(
  q: DbConnector,
  tenantId: string,
  v: {
    proposalId: string;
    decision: Decision;
    form: LinkForm | null;
    adr48State: "EREDITATA" | "CONSERVATA" | "PROPRIA" | null;
    reason: string | null;
    userId: string;
    delegationId: string | null;
    supersedesId: string | null;
  },
): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_tenant_consolidation_decisions
       (tenant_consolidation_decision_proposal_id, tenant_consolidation_decision_tenant_id,
        tenant_consolidation_decision_value, tenant_consolidation_decision_form,
        tenant_consolidation_decision_adr48_state, tenant_consolidation_decision_reason,
        tenant_consolidation_decision_decided_by, tenant_consolidation_decision_delegation_id,
        tenant_consolidation_decision_supersedes_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [v.proposalId, tenantId, v.decision, v.form, v.adr48State, v.reason, v.userId, v.delegationId, v.supersedesId],
  );
}

/** L'avanzamento di ogni gruppo della sessione (R-8), contato dal registro e non stimato. */
export async function progress(q: DbConnector, tenantId: string, consolidationId: string): Promise<GroupProgress[]> {
  const { rows } = await q.query<{
    grp: string; linked: number; adopted: number; rejected: number; customized: number; pending: number;
  }>(
    `SELECT p.tenant_consolidation_proposal_group AS grp,
            count(*) FILTER (WHERE ud.decision_value = 'CONFERMATA')::int AS linked,
            count(*) FILTER (WHERE ud.decision_value = 'ADOTTATA')::int AS adopted,
            count(*) FILTER (WHERE ud.decision_value IN ('RIFIUTATA', 'NON_ADOTTATA'))::int AS rejected,
            count(*) FILTER (WHERE ud.decision_value = 'PERSONALIZZAZIONE')::int AS customized,
            count(*) FILTER (WHERE ud.decision_value IS NULL)::int AS pending
       FROM sys.sys_tenant_consolidation_proposals p
       JOIN sys.sys_tenant_consolidations c ON c.tenant_consolidation_id = p.tenant_consolidation_proposal_consolidation_id
       ${ULTIMA_DECISIONE}
      WHERE c.tenant_consolidation_tenant_id = $1 AND c.tenant_consolidation_id = $2
        AND p.tenant_consolidation_proposal_superseded_at IS NULL
      GROUP BY p.tenant_consolidation_proposal_group`,
    [tenantId, consolidationId],
  );
  return rows.map((r) => ({
    group: r.grp as ConsolidationGroup,
    linked: r.linked,
    adopted: r.adopted,
    rejected: r.rejected,
    customized: r.customized,
    pending: r.pending,
  }));
}

/* ── i risultati di un gruppo ────────────────────────────────────────────────────────── */

/**
 * Scrive nel registro ciò che il motore ha prodotto per un gruppo: la copia di lavoro, i giri,
 * le proposte. Le proposte di un giro precedente dello stesso gruppo ancora senza decisione si
 * marcano sostituite (non si cancellano): un rifiuto riapre i giri che ne dipendevano (R-13).
 * Gli identificativi del motore diventano uuid del registro, e `dependsOn` si traduce con loro.
 */
export async function saveGroup(
  q: PoolClient,
  consolidationId: string,
  stato: StatoGruppo,
  tokens: number | null,
): Promise<number> {
  await q.query(
    `UPDATE sys.sys_tenant_consolidation_proposals p
        SET tenant_consolidation_proposal_superseded_at = now()
      WHERE p.tenant_consolidation_proposal_consolidation_id = $1
        AND p.tenant_consolidation_proposal_group = $2
        AND p.tenant_consolidation_proposal_superseded_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM sys.sys_tenant_consolidation_decisions d
                         WHERE d.tenant_consolidation_decision_proposal_id = p.tenant_consolidation_proposal_id)`,
    [consolidationId, stato.group],
  );

  for (const v of stato.prototype) {
    await q.query(
      `INSERT INTO sys.sys_tenant_consolidation_working_items
         (tenant_consolidation_working_item_consolidation_id, tenant_consolidation_working_item_group,
          tenant_consolidation_working_item_prototype_key, tenant_consolidation_working_item_original_name,
          tenant_consolidation_working_item_original_code, tenant_consolidation_working_item_translated_name,
          tenant_consolidation_working_item_translated_round)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_consolidation_working_item_consolidation_id, tenant_consolidation_working_item_group,
                    tenant_consolidation_working_item_prototype_key)
       DO UPDATE SET tenant_consolidation_working_item_translated_name = EXCLUDED.tenant_consolidation_working_item_translated_name,
                     tenant_consolidation_working_item_translated_round = EXCLUDED.tenant_consolidation_working_item_translated_round`,
      [
        consolidationId, stato.group, v.key, v.originalName, v.code ?? null,
        v.translatedInRound === null ? null : v.name, v.translatedInRound,
      ],
    );
  }

  for (const g of stato.rounds) {
    await q.query(
      `INSERT INTO sys.sys_tenant_consolidation_rounds
         (tenant_consolidation_round_consolidation_id, tenant_consolidation_round_group,
          tenant_consolidation_round_number, tenant_consolidation_round_asked, tenant_consolidation_round_adopted,
          tenant_consolidation_round_tokens, tenant_consolidation_round_fuse_tripped)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [consolidationId, stato.group, g.round, g.asked, g.adopted, tokens, stato.fuseTripped],
    );
  }

  // Le proposte già decise restano quelle del registro: il motore le ha ricevute come vincoli.
  const decise = await q.query<{ k: string }>(
    `SELECT array_to_string(p.tenant_consolidation_proposal_prototype_keys, ',') || '|' ||
            array_to_string(p.tenant_consolidation_proposal_tenant_keys, ',') AS k
       FROM sys.sys_tenant_consolidation_proposals p
      WHERE p.tenant_consolidation_proposal_consolidation_id = $1 AND p.tenant_consolidation_proposal_group = $2
        AND p.tenant_consolidation_proposal_superseded_at IS NULL`,
    [consolidationId, stato.group],
  );
  const giaNelRegistro = new Set(decise.rows.map((r) => r.k));
  const chiave = (p: Proposta) => `${p.prototypeKeys.join(",")}|${p.tenantKeys.join(",")}`;

  const uuidDi = new Map<string, string>();
  let scritte = 0;
  for (const p of stato.proposals) {
    if (giaNelRegistro.has(chiave(p))) continue;
    const dipende = p.dependsOn.map((d) => uuidDi.get(d)).filter((x): x is string => !!x);
    const { rows } = await q.query<{ id: string }>(
      `INSERT INTO sys.sys_tenant_consolidation_proposals
         (tenant_consolidation_proposal_consolidation_id, tenant_consolidation_proposal_group,
          tenant_consolidation_proposal_prototype_keys, tenant_consolidation_proposal_tenant_keys,
          tenant_consolidation_proposal_outcome, tenant_consolidation_proposal_method,
          tenant_consolidation_proposal_confidence, tenant_consolidation_proposal_reason,
          tenant_consolidation_proposal_round, tenant_consolidation_proposal_adopted,
          tenant_consolidation_proposal_depends_on)
       VALUES ($1, $2, $3::text[], $4::text[], $5, $6, $7, $8, $9, $10, $11::uuid[])
       RETURNING tenant_consolidation_proposal_id AS id`,
      [
        consolidationId, stato.group, p.prototypeKeys, p.tenantKeys, p.outcome, p.method,
        p.confidence, p.reason, p.round, p.adoptedInWorkingCopy, dipende,
      ],
    );
    uuidDi.set(p.id, rows[0]!.id);
    scritte++;
  }
  return scritte;
}

/** Le coppie già rifiutate di un gruppo: il motore non le ripropone (R-13). */
export async function rejectedPairs(
  q: DbConnector,
  consolidationId: string,
  group: ConsolidationGroup,
): Promise<Array<{ prototypeKeys: string[]; tenantKeys: string[] }>> {
  const { rows } = await q.query<{ pk: string[]; tk: string[] }>(
    `SELECT p.tenant_consolidation_proposal_prototype_keys AS pk, p.tenant_consolidation_proposal_tenant_keys AS tk
       FROM sys.sys_tenant_consolidation_proposals p
       ${ULTIMA_DECISIONE}
      WHERE p.tenant_consolidation_proposal_consolidation_id = $1 AND p.tenant_consolidation_proposal_group = $2
        AND ud.decision_value IN ('RIFIUTATA', 'NON_ADOTTATA')`,
    [consolidationId, group],
  );
  return rows.map((r) => ({ prototypeKeys: r.pk, tenantKeys: r.tk }));
}

/* ── chi decide ─────────────────────────────────────────────────────────────────────── */

export interface DelegaDiConsolidamento {
  delegationId: string;
  groups: ConsolidationGroup[];
}

/**
 * Le deleghe CONSOLIDATION in vigore che un utente ha ricevuto da un Direttore HR del suo
 * tenant. Il delegante deve avere OGGI il mandato di decidere (`consolidation:decide`, che la
 * 000465 dà al Direttore): una delega di chi non lo ha più non vale, anche se nessuno l'ha
 * revocata. Il mandato si legge dal permesso, non dal nome del ruolo (ADR-0027, S-5).
 */
export async function activeConsolidationDelegations(
  q: DbConnector,
  tenantId: string,
  userId: string,
): Promise<DelegaDiConsolidamento[]> {
  const { rows } = await q.query<{ id: string; groups: string[] }>(
    `SELECT d.user_delegation_id AS id, d.user_delegation_groups AS groups
       FROM sys.sys_user_delegations d
      WHERE d.user_delegation_tenant_id = $1 AND d.user_delegation_delegate_id = $2
        AND d.user_delegation_scope = 'CONSOLIDATION' AND d.user_delegation_status = 'ACTIVE'
        AND d.user_delegation_starts_on <= current_date
        AND (d.user_delegation_ends_on IS NULL OR d.user_delegation_ends_on >= current_date)
        AND EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles uar
            JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = uar.user_auth_role_role_id
            JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
           WHERE uar.user_auth_role_user_id = d.user_delegation_delegator_id
             AND uar.user_auth_role_revoked_at IS NULL
             AND p.auth_permission_code = 'consolidation:decide')
      ORDER BY d.user_delegation_starts_on`,
    [tenantId, userId],
  );
  return rows.map((r) => ({ delegationId: r.id, groups: (r.groups ?? []) as ConsolidationGroup[] }));
}

/* ── il vocabolario comune ──────────────────────────────────────────────────────────── */

export interface Equivalenza {
  equivalenceId: string;
  group: ConsolidationGroup;
  tenantTerm: string;
  prototypeTerm: string;
  status: "PROPOSTA" | "APPROVATA" | "RITIRATA";
  approvedAt: string | null;
}

export async function listEquivalences(q: DbConnector): Promise<Equivalenza[]> {
  const { rows } = await q.query<{
    id: string; grp: string; tt: string; pt: string; st: string; at: Date | null;
  }>(
    `SELECT platform_vocabulary_equivalence_id AS id, platform_vocabulary_equivalence_group AS grp,
            platform_vocabulary_equivalence_tenant_term AS tt, platform_vocabulary_equivalence_prototype_term AS pt,
            platform_vocabulary_equivalence_status AS st, platform_vocabulary_equivalence_approved_at AS at
       FROM sys.sys_platform_vocabulary_equivalences
      ORDER BY platform_vocabulary_equivalence_group, platform_vocabulary_equivalence_tenant_term`,
  );
  return rows.map((r) => ({
    equivalenceId: r.id,
    group: r.grp as ConsolidationGroup,
    tenantTerm: r.tt,
    prototypeTerm: r.pt,
    status: r.st as Equivalenza["status"],
    approvedAt: r.at ? r.at.toISOString() : null,
  }));
}

/** La mappa che il giro zero usa: solo le equivalenze APPROVATE di un gruppo. */
export async function approvedVocabulary(q: DbConnector, group: ConsolidationGroup): Promise<Map<string, string>> {
  const { rows } = await q.query<{ tt: string; pt: string }>(
    `SELECT platform_vocabulary_equivalence_tenant_term AS tt, platform_vocabulary_equivalence_prototype_term AS pt
       FROM sys.sys_platform_vocabulary_equivalences
      WHERE platform_vocabulary_equivalence_group = $1 AND platform_vocabulary_equivalence_status = 'APPROVATA'`,
    [group],
  );
  return new Map(rows.map((r) => [r.tt, r.pt]));
}

export async function setEquivalenceStatus(
  q: DbConnector,
  id: string,
  status: "APPROVATA" | "RITIRATA",
  userId: string,
): Promise<boolean> {
  const r = await q.query(
    `UPDATE sys.sys_platform_vocabulary_equivalences
        SET platform_vocabulary_equivalence_status = $2,
            platform_vocabulary_equivalence_approved_by = CASE WHEN $2 = 'APPROVATA' THEN $3::uuid ELSE platform_vocabulary_equivalence_approved_by END,
            platform_vocabulary_equivalence_approved_at = CASE WHEN $2 = 'APPROVATA' THEN now() ELSE platform_vocabulary_equivalence_approved_at END
      WHERE platform_vocabulary_equivalence_id = $1 AND platform_vocabulary_equivalence_status <> $2`,
    [id, status, userId],
  );
  return (r.rowCount ?? 0) > 0;
}

/* ── il giro in corso ───────────────────────────────────────────────────────────────── */

/**
 * Prende il turno di un giro: riesce solo se nessun altro giro della sessione è in corso. Il
 * segno sta nel metadata della sessione, così si vede dalla pagina e sopravvive a un riavvio
 * (un giro interrotto da un riavvio resta segnato e si libera con `releaseRun`).
 */
export async function claimRun(q: DbConnector, tenantId: string, id: string, group: ConsolidationGroup): Promise<boolean> {
  const r = await q.query(
    `UPDATE sys.sys_tenant_consolidations
        SET tenant_consolidation_metadata = tenant_consolidation_metadata
              || jsonb_build_object('running_group', $3::text, 'running_since', now())
      WHERE tenant_consolidation_tenant_id = $1 AND tenant_consolidation_id = $2
        AND tenant_consolidation_status = 'GIRI'
        AND tenant_consolidation_metadata->>'running_group' IS NULL`,
    [tenantId, id, group],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function releaseRun(q: DbConnector, id: string, esito: Record<string, unknown>): Promise<void> {
  await q.query(
    `UPDATE sys.sys_tenant_consolidations
        SET tenant_consolidation_metadata = (tenant_consolidation_metadata - 'running_group' - 'running_since')
              || jsonb_build_object('last_run', $2::jsonb)
      WHERE tenant_consolidation_id = $1`,
    [id, JSON.stringify(esito)],
  );
}

export async function pendingInGroup(q: DbConnector, consolidationId: string, group: ConsolidationGroup): Promise<number> {
  const { rows } = await q.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM sys.sys_tenant_consolidation_proposals p
       ${ULTIMA_DECISIONE}
      WHERE p.tenant_consolidation_proposal_consolidation_id = $1 AND p.tenant_consolidation_proposal_group = $2
        AND p.tenant_consolidation_proposal_superseded_at IS NULL AND ud.decision_value IS NULL`,
    [consolidationId, group],
  );
  return rows[0]?.n ?? 0;
}
