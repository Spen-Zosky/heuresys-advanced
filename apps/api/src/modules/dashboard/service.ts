/**
 * apps/api/src/modules/dashboard/service.ts
 * Role-gated aggregator: composes the dashboard widgets payload based on
 * actor role tier (PLATFORM / TENANT / TEAM).
 */

import { pool } from "../../db/client.js";
import { scopeTierAndRole } from "../../lib/scope/domains.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import type {
  DashboardScopeKind,
  DashboardWidgetsResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";

// #119 — the PLATFORM/TENANT/TEAM ladder used to be declared HERE, and identically
// in analytics/service.ts and insights/service.ts. Three copies of one rule drift
// independently; the single definition now lives in lib/scope/domains.ts.

/** Number of weekly buckets in the StatsCard sparkline series. */
const DASHBOARD_TREND_WEEKS = 8;

/**
 * #119 — no fallback. The old shape ended in `return "TEAM"`, which rendered an
 * empty dashboard to anyone the hand-written tiers did not match: the page said
 * "you have no data" when the truth was "we could not place you".
 * `scopeTierOf` throws instead, so the condition is visible rather than silent.
 */
function highestScope(actor: ActorContext): Promise<{ tier: DashboardScopeKind; role: string }> {
  return scopeTierAndRole(pool, actor, "dashboard");
}

// #142 F2 — `highestRoleLabel` viveva QUI con otto nomi di ruolo scritti a mano: la SESTA
// lista, quella che il documento dei domini prediceva sarebbe nata a ogni correzione. Era
// gia' sbagliata, misurato sulla mappa RBAC viva del 2026-08-15: metteva `BLUEPRINT_MANAGER`
// (68 permessi) sopra `HRMS_MANAGER` (149), che I22 dichiara plenipotenziario sui dati
// business. Ora l'etichetta arriva da `scopeTierAndRole`, che sceglie fra i ruoli che
// giustificano il tier quello con la concessione piu' ampia — misurata, non ordinata a mano.

export const dashboardService = {
  async getWidgets(actor: ActorContext): Promise<DashboardWidgetsResponse> {
    const { tier: scopeKind, role } = await highestScope(actor);
    const isPlatform = scopeKind === "PLATFORM";
    const isTeamScope = scopeKind === "TEAM" && !isPlatform;

    let teamPositionIds: string[] = [];
    const scopeTenantId: string | null = isPlatform ? null : actor.tenantId;

    if (isTeamScope) {
      // Il perimetro di chi guida: le posizioni incardinate nelle unita' che dirige.
      // Se non dirige nulla il perimetro e' vuoto e il frontend mostra lo stato vuoto.
      teamPositionIds = await repo.posizioniNelPerimetroOrganizzativo(pool, actor.userId);
    }

    const scope: repo.ScopeFilter = {
      tenantId: scopeTenantId,
      teamPositionIds,
      isPlatformScope: isPlatform,
    };

    const [counters, trends, upcomingLearningDeadlines, recentActivity] = await Promise.all([
      repo.getDashboardCounters(pool, scope),
      repo.getDashboardTrends(pool, scope, DASHBOARD_TREND_WEEKS),
      repo.getUpcomingLearningDeadlines(pool, scope, 10),
      repo.getRecentActivity(pool, scope, 10),
    ]);

    return {
      role,
      scope: {
        kind: scopeKind,
        tenantId: scopeTenantId,
        teamPositionIds,
      },
      counters,
      trends,
      upcomingLearningDeadlines,
      recentActivity,
      generatedAt: new Date().toISOString(),
    };
  },
};
