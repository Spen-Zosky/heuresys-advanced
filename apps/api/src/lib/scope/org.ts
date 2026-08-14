/**
 * apps/api/src/lib/scope/org.ts — F0 of the two-axis authorization model (ADR-0027).
 *
 * The ORGANIZATIONAL axis: the org-chart reports-to chain, traversed TRANSITIVELY
 * (the old `getManagerTeamUserIds` walked it one hop only). This is the axis that
 * gates SENSITIVE personal data (I18/I20): a user may see another user's
 * PERSONAL/COMPENSATION/SKILL/EVALUATION data only if that user is in their
 * organizational sub-tree.
 *
 * FONTE DELLA CATENA — #99 F3 (2026-08-14). Era `sys_positions.position_reports_to_position_id`,
 * l'albero delle POSIZIONI. ADR-0036 dichiara canonico l'albero delle UNITÀ
 * (`organization_unit_parent_id` + `organization_unit_manager_user_id`): il perimetro
 * gerarchico dice *su quali persone*, e chi dirige un'unità dirige il suo sottoalbero (I19).
 *
 * MISURATO PRIMA DI CAMBIARE, sui dati reali (2026-08-14, 161 attori, 43 unità attive):
 * i due alberi producono **lo stesso identico perimetro** — 649 accessi prima, 649 dopo,
 * 0 guadagnati, 0 persi, 161 attori su 161 invariati. Il passaggio non allarga e non
 * restringe l'accesso di nessuno: allinea la fonte alla definizione.
 *
 * Conseguenza sulla PROVA: un test comportamentale sui dati di oggi sarebbe verde con
 * entrambi gli alberi, cioè non proverebbe nulla. La verifica di F3 inietta una divergenza
 * in transazione (sposta il riporto di una POSIZIONE senza toccare l'unità) e pretende che
 * il perimetro NON si muova — se seguisse ancora le posizioni, si muoverebbe.
 *
 * `UNION` (non UNION ALL) così un ciclo malformato nell'albero dedup-a e la ricorsione
 * termina invece di avvitarsi.
 */

import type { Pool, PoolClient } from "pg";

export type DbConnector = Pool | PoolClient;

/**
 * User ids in the actor's organizational sub-tree — their transitive reports — INCLUDING self.
 * This is the allow-list for reading another user's SENSITIVE data (the cardinal rule, I18/I20):
 * `target ∈ orgSubtreeUserIds(actor)` ⟺ actor may see target's sensitive data via the org axis.
 * Self is always present even when the actor holds no position.
 */
export async function orgSubtreeUserIds(q: DbConnector, actorUserId: string): Promise<string[]> {
  const res = await q.query<{ user_id: string }>(
    `WITH RECURSIVE my_units AS (
       -- le unità che l'attore dirige in prima persona
       SELECT o.organization_unit_id AS ou_id
         FROM sys.sys_organization_units o
        WHERE o.organization_unit_manager_user_id = $1
          AND o.organization_unit_is_active
     ),
     subtree AS (
       SELECT ou_id FROM my_units
       UNION
       SELECT o.organization_unit_id
         FROM sys.sys_organization_units o
         JOIN subtree s ON o.organization_unit_parent_id = s.ou_id
        WHERE o.organization_unit_is_active
     )
     SELECT DISTINCT upa.user_position_assignment_user_id AS user_id
       FROM sys.sys_user_position_assignments upa
       JOIN sys.sys_positions p ON p.position_id = upa.user_position_assignment_position_id
       JOIN subtree s ON s.ou_id = p.position_organization_unit_id
      WHERE upa.user_position_assignment_status = 'ACTIVE'
     UNION
     SELECT $1::uuid`,
    [actorUserId],
  );
  return res.rows.map((r) => r.user_id);
}

/**
 * User ids ABOVE the given user in the org chart — their transitive managers (NOT including self).
 * The mirror of {@link orgSubtreeUserIds}; useful for "who may see MY sensitive data".
 */
export async function orgAncestorUserIds(q: DbConnector, userId: string): Promise<string[]> {
  const res = await q.query<{ user_id: string }>(
    `WITH RECURSIVE my_units AS (
       -- le unità in cui la persona è incardinata dalla sua posizione
       SELECT p.position_organization_unit_id AS ou_id
         FROM sys.sys_user_position_assignments upa
         JOIN sys.sys_positions p ON p.position_id = upa.user_position_assignment_position_id
        WHERE upa.user_position_assignment_user_id = $1
          AND upa.user_position_assignment_status = 'ACTIVE'
          AND p.position_organization_unit_id IS NOT NULL
     ),
     ancestors AS (
       -- la propria unità inclusa: chi la dirige sta sopra di me anche se siamo nella stessa
       SELECT ou_id FROM my_units
       UNION
       SELECT o.organization_unit_parent_id
         FROM sys.sys_organization_units o
         JOIN ancestors a ON o.organization_unit_id = a.ou_id
        WHERE o.organization_unit_parent_id IS NOT NULL
     )
     SELECT DISTINCT o.organization_unit_manager_user_id AS user_id
       FROM sys.sys_organization_units o
       JOIN ancestors a ON a.ou_id = o.organization_unit_id
      WHERE o.organization_unit_manager_user_id IS NOT NULL
        AND o.organization_unit_manager_user_id <> $1
        AND o.organization_unit_is_active`,
    [userId],
  );
  return res.rows.map((r) => r.user_id);
}

/**
 * True iff the user is the explicit manager of at least one organization unit
 * (`organization_unit_manager_user_id`) — i.e. responsabile di Divisione / Direzione / centro
 * di costo / unità organizzativa. One of the two signals of an explicit managerial role that
 * Enzo's F1 constraint requires before the organizational sub-tree scope applies (the other is
 * an RBAC managerial role; see resolver.ts MANAGERIAL_ROLES).
 */
export async function isOrgUnitManager(q: DbConnector, userId: string): Promise<boolean> {
  const res = await q.query<{ hit: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM sys.sys_organization_units
        WHERE organization_unit_manager_user_id = $1
          AND organization_unit_is_active
     ) AS hit`,
    [userId],
  );
  return res.rows[0]?.hit ?? false;
}

/**
 * True iff `targetUserId` is in `actorUserId`'s organizational sub-tree (self counts).
 * The boolean form of the cardinal-rule check used by the sensitive-data gate in F3.
 */
export async function isInOrgSubtree(
  q: DbConnector,
  actorUserId: string,
  targetUserId: string,
): Promise<boolean> {
  if (actorUserId === targetUserId) return true;
  const res = await q.query<{ hit: boolean }>(
    `WITH RECURSIVE my_units AS (
       SELECT o.organization_unit_id AS ou_id
         FROM sys.sys_organization_units o
        WHERE o.organization_unit_manager_user_id = $1
          AND o.organization_unit_is_active
     ),
     subtree AS (
       SELECT ou_id FROM my_units
       UNION
       SELECT o.organization_unit_id
         FROM sys.sys_organization_units o
         JOIN subtree s ON o.organization_unit_parent_id = s.ou_id
        WHERE o.organization_unit_is_active
     )
     SELECT EXISTS (
       SELECT 1
         FROM sys.sys_user_position_assignments upa
         JOIN sys.sys_positions p ON p.position_id = upa.user_position_assignment_position_id
         JOIN subtree s ON s.ou_id = p.position_organization_unit_id
        WHERE upa.user_position_assignment_user_id = $2
          AND upa.user_position_assignment_status = 'ACTIVE'
     ) AS hit`,
    [actorUserId, targetUserId],
  );
  return res.rows[0]?.hit ?? false;
}

/* ── #99 F4 — il qualificatore «soglia di catena» ──────────────────────────── */

/**
 * A che PROFONDITÀ sta una persona nell'albero delle unità: 1 è la radice (l'azienda),
 * 2 le divisioni, e così scendendo. `null` se non è incardinata in alcuna unità attiva.
 *
 * Serve al qualificatore di cella «soglia di catena» (ADR-0036 §5, terza eccezione al
 * mandato HR): la retribuzione dei vertici è visibile **solo a pari livello o superiore**.
 * Non è una gerarchia di ruoli — è la stessa struttura da cui nasce il perimetro (F3),
 * letta in profondità invece che in ampiezza.
 *
 * Se una persona occupa più posizioni, vale la PIÙ ALTA: il livello è una proprietà della
 * persona, e chi siede in una divisione non la perde per un incarico secondario più in basso.
 */
export async function chainLevelOf(q: DbConnector, userId: string): Promise<number | null> {
  const res = await q.query<{ livello: number | null }>(
    `WITH RECURSIVE albero AS (
       SELECT organization_unit_id AS ou, 1 AS livello
         FROM sys.sys_organization_units
        WHERE organization_unit_parent_id IS NULL AND organization_unit_is_active
       UNION ALL
       SELECT o.organization_unit_id, a.livello + 1
         FROM sys.sys_organization_units o
         JOIN albero a ON o.organization_unit_parent_id = a.ou
        WHERE o.organization_unit_is_active
     )
     SELECT min(a.livello) AS livello
       FROM albero a
       JOIN sys.sys_positions p ON p.position_organization_unit_id = a.ou
       JOIN sys.sys_user_position_assignments upa
            ON upa.user_position_assignment_position_id = p.position_id
           AND upa.user_position_assignment_status = 'ACTIVE'
      WHERE upa.user_position_assignment_user_id = $1`,
    [userId],
  );
  const l = res.rows[0]?.livello;
  return l == null ? null : Number(l);
}
