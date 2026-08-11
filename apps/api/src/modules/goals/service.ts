/**
 * apps/api/src/modules/goals/service.ts
 * Goals CRUD with tenant-only visibility. PLATFORM_ADMIN unfiltered; others own tenant;
 * not-visible -> 404 (no leak). Mirrors modules/engagement-feedback/service.ts.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { localize } from "../../lib/i18n/localize.js";
import type { Locale } from "../../middleware/locale.js";
export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  Goal, GoalListQuery, CreateGoalBody, UpdateGoalBody,
  GoalSubListQuery, GoalTemplate, GoalTemplateListQuery, GoalTimelineEvent, GoalTimelineResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";
import { masksUnderPlatformMandate, maskFields } from "../../lib/scope/mask.js";

/**
 * #124 D4 / ADR-0032 — cosa se ne va da un obiettivo letto sotto il solo mandato
 * piattaforma.
 *
 * Qui il confine e' piu' sottile che altrove, e lo detta l'invariante stesso:
 * **I20 vuole che «riga, soggetto, periodo e STATO» restino visibili**. Quindi
 * gli stati NON si mascherano — ne' `status` sull'obiettivo, ne' `newStatus` su
 * un aggiornamento, ne' `statusUpdate` su un check-in — mentre se ne va il
 * QUANTO: la percentuale di avanzamento, il testo scritto sulla persona, e
 * l'autovalutazione di sicurezza (`confidenceLevel`).
 *
 * Restano intatte due famiglie intere, e non per dimenticanza:
 *  - `alignments` (come un obiettivo si lega a un altro) e `templates`
 *    (il catalogo): sono struttura, non giudicano nessuno;
 *  - `milestones`: titolo, descrizione, data e peso sono la definizione del
 *    lavoro, e il loro `status` resta per I20 — non c'e' nulla da togliere.
 */
const GOAL_JUDGMENT_FIELDS = ["progressPercent"] as const;
const UPDATE_JUDGMENT_FIELDS = ["previousProgress", "newProgress", "content", "attachments"] as const;
const CHECKIN_JUDGMENT_FIELDS = [
  "previousProgress", "newProgress", "notes", "blockers", "nextSteps", "confidenceLevel",
] as const;
const COMMENT_JUDGMENT_FIELDS = ["content"] as const;

/**
 * Il soggetto di una sotto-risorsa e' quello dell'obiettivo PADRE: un check-in
 * non «appartiene» a chi lo scrive, riguarda la persona di cui e' l'obiettivo.
 * `loadReadableGoal` lo ha gia' in mano, quindi non costa una query in piu'.
 */
function mascheraSe<T extends Record<string, unknown>>(
  a: ActorContext, subjectUserId: string | null, righe: T[], campi: readonly string[],
): T[] {
  if (!masksUnderPlatformMandate(a, "EVALUATION", subjectUserId)) return righe;
  return righe.map((r) => maskFields(r, campi)) as T[];
}

// i18n overlay (ADR-0029): swap name/description to the requested locale (fallback = IT in-row).
const GOAL_TEMPLATE_I18N = {
  name: (t: GoalTemplate, s: string) => { t.name = s; },
  description: (t: GoalTemplate, s: string) => { t.description = s; },
};

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function listTenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  return a.tenantId ?? ZERO_UUID;
}
function resolveWriteTenant(a: ActorContext, bodyTenantId?: string): string {
  if (isPlatform(a)) {
    const t = bodyTenantId ?? a.tenantId;
    if (!t) throw new ForbiddenError("PLATFORM_ADMIN must supply tenantId", "TENANT_ID_REQUIRED");
    return t;
  }
  if (!a.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return a.tenantId;
}

/**
 * ADR-0027 F3 + F4-contract (S1018 #26): the per-goal read authorization lives in
 * THIS single helper — every sub-resource read flows through loadReadableGoal.
 * W9/F4 (functional axis) will extend the body with the dual-class row-shape rule
 * (subject≠null → org axis; team/process-bound → functional axis; null+null →
 * tenant-visible) WITHOUT touching routes or call sites.
 */
export async function canReadGoal(a: ActorContext, g: Goal): Promise<boolean> {
  if (!isPlatform(a) && (a.tenantId === null || g.tenantId !== a.tenantId)) return false;
  // A subject-bound goal is org-gated (EVALUATION class); cross-boundary = invisible.
  if (g.subjectUserId && !(await canReadOrgTarget(pool, a, g.subjectUserId, g.tenantId))) {
    return false;
  }
  return true;
}

/** Load a goal the actor may read, or throw 404 (no leak across any boundary). */
async function loadReadableGoal(a: ActorContext, id: string): Promise<Goal> {
  const g = await repo.findGoalById(pool, id);
  if (!g || !(await canReadGoal(a, g))) throw new NotFoundError("Goal");
  return g;
}

/**
 * Merged activity timeline for ONE goal (updates ∪ check-ins ∪ milestones),
 * newest first. Shared by the admin route and /v1/me/goals/:id/timeline (the
 * me module does its own self-authorization before calling this).
 */
export async function buildGoalTimeline(g: Goal): Promise<GoalTimelineResponse> {
  const CAP = 200; // per-goal volumes are small (avg <10 rows/table); hard cap for safety
  const [updates, checkIns, milestones] = await Promise.all([
    repo.listGoalUpdates(pool, g.goalId, CAP, 0),
    repo.listGoalCheckIns(pool, g.goalId, CAP, 0),
    repo.listGoalMilestones(pool, g.goalId, CAP, 0),
  ]);
  const events: GoalTimelineEvent[] = [
    ...updates.items.map((u) => ({ kind: "UPDATE" as const, at: u.createdAt, update: u })),
    ...checkIns.items.map((c) => ({ kind: "CHECK_IN" as const, at: c.createdAt, checkIn: c })),
    ...milestones.items.map((m) => ({ kind: "MILESTONE" as const, at: m.updatedAt, milestone: m })),
  ].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, CAP);
  return { goal: g, events };
}

export const goalsService = {
  async listGoals(a: ActorContext, query: GoalListQuery) {
    // ADR-0027 F3: filter the list by the actor's organizational read scope.
    const scope = await resolveOrgReadScope(pool, a);
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    const page = await repo.listGoals(pool, listTenantFilter(a), query, userIdAllowList);
    // #124 — pre-check a costo zero, poi il soggetto vero riga per riga: un
    // obiettivo senza soggetto (`subjectUserId` null) e' un obiettivo aziendale,
    // non giudica nessuno, e resta in chiaro.
    if (!masksUnderPlatformMandate(a, "EVALUATION", null)) return page;
    return {
      ...page,
      items: page.items.map((g) =>
        g.subjectUserId && masksUnderPlatformMandate(a, "EVALUATION", g.subjectUserId)
          ? maskFields(g, GOAL_JUDGMENT_FIELDS)
          : g,
      ),
    };
  },
  async getGoal(a: ActorContext, id: string) {
    const g = await loadReadableGoal(a, id);
    return g.subjectUserId && masksUnderPlatformMandate(a, "EVALUATION", g.subjectUserId)
      ? maskFields(g, GOAL_JUDGMENT_FIELDS)
      : g;
  },
  async createGoal(a: ActorContext, body: CreateGoalBody) {
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertGoal(pool, tenantId, body);
  },
  async updateGoal(a: ActorContext, id: string, patch: UpdateGoalBody) {
    await loadReadableGoal(a, id);
    const updated = await repo.updateGoalPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Goal");
    return updated;
  },
  async deleteGoal(a: ActorContext, id: string): Promise<void> {
    await loadReadableGoal(a, id);
    await repo.deleteGoal(pool, id);
  },

  // ── #26 (S1018): goal-life sub-resource reads — all gated by loadReadableGoal ──
  async listGoalUpdates(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    const g = await loadReadableGoal(a, goalId);
    const page = await repo.listGoalUpdates(pool, goalId, q.limit, q.offset);
    return { ...page, items: mascheraSe(a, g.subjectUserId, page.items, UPDATE_JUDGMENT_FIELDS) };
  },
  async listGoalCheckIns(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    const g = await loadReadableGoal(a, goalId);
    const page = await repo.listGoalCheckIns(pool, goalId, q.limit, q.offset);
    return { ...page, items: mascheraSe(a, g.subjectUserId, page.items, CHECKIN_JUDGMENT_FIELDS) };
  },
  async listGoalMilestones(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    await loadReadableGoal(a, goalId);
    return repo.listGoalMilestones(pool, goalId, q.limit, q.offset);
  },
  async listGoalComments(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    const g = await loadReadableGoal(a, goalId);
    // Private comments: author-only, unless the actor reads tenant-wide (all|tenant
    // org scope — HR mandate/platform). Subtree managers do NOT see others' private
    // notes: a private comment is author-audience, not chain-audience.
    const scope = await resolveOrgReadScope(pool, a);
    const includePrivate = scope.kind === "all" || scope.kind === "tenant";
    const page = await repo.listGoalComments(pool, goalId, a.userId, includePrivate, q.limit, q.offset);
    return { ...page, items: mascheraSe(a, g.subjectUserId, page.items, COMMENT_JUDGMENT_FIELDS) };
  },
  async listGoalAlignments(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    await loadReadableGoal(a, goalId);
    return repo.listGoalAlignments(pool, goalId, q.limit, q.offset);
  },
  async listGoalTemplates(a: ActorContext, query: GoalTemplateListQuery, locale: Locale = "it") {
    const res = await repo.listGoalTemplates(pool, listTenantFilter(a), query);
    await localize(pool, locale, "sys_goal_templates", res.items, (t) => t.templateId, GOAL_TEMPLATE_I18N);
    return res;
  },
  async getGoalTimeline(a: ActorContext, goalId: string) {
    const g = await loadReadableGoal(a, goalId);
    const linea = await buildGoalTimeline(g);
    // #124 — il mask sta QUI e non dentro `buildGoalTimeline`, che e' condiviso
    // con `/v1/me/goals/:id/timeline`: quella e' la propria linea del tempo, e
    // per I17 non va mascherata mai. Un mask piu' in basso l'avrebbe rotta.
    if (!g.subjectUserId || !masksUnderPlatformMandate(a, "EVALUATION", g.subjectUserId)) return linea;
    return {
      goal: maskFields(g, GOAL_JUDGMENT_FIELDS),
      events: linea.events.map((e) =>
        e.kind === "UPDATE" ? { ...e, update: maskFields(e.update, UPDATE_JUDGMENT_FIELDS) }
        : e.kind === "CHECK_IN" ? { ...e, checkIn: maskFields(e.checkIn, CHECKIN_JUDGMENT_FIELDS) }
        : e,
      ),
    };
  },
};
