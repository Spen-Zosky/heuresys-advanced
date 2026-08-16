/**
 * apps/api/src/modules/dashboard/service.ts
 * Role-gated aggregator: composes the dashboard widgets payload based on
 * actor role tier (PLATFORM / TENANT / TEAM).
 */

import { pool } from "../../db/client.js";
import { scopeTierAndRole, dominiCheApronoUnaSuperficie, type Domain } from "../../lib/scope/domains.js";
import { modalitaDellaVista } from "../../lib/scope/matrix.js";
import type { DataClass } from "../../lib/scope/data-classes.js";
import { userPermissionCodes } from "../../middleware/rbac.js";
import { ForbiddenError, NotFoundError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import type {
  DashboardBlock,
  DashboardCatalogResponse,
  DashboardDetailResponse,
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

/**
 * Le viste di un cruscotto, con la mascheratura già decisa (#142 F3a).
 *
 * LA REGOLA, e sono due cose diverse che vanno tenute diverse:
 *  · il **se** è il permesso RBAC proprio della famiglia (`dashboard_permission_code`);
 *  · il **come** è M1, in TRE stati — `open` / `masked` / `denied` — calcolati da
 *    `modalitaDellaVista`.
 *
 * ⚠ TRE, non due, ed è un difetto che ho scritto e che la prova live ha trovato. La prima
 * stesura usava un booleano derivato da `almenoUnaCellaAperta`, che risponde «questa
 * superficie ti riguarda sì/no» e per farlo tratta `mask` come **aperto**: un
 * `PLATFORM_ADMIN` si vedeva così la vista delle retribuzioni **in chiaro**, mentre
 * ADR-0032 gliela maschera. Il test non se n'era accorto perché era **tautologico** —
 * filtrava i blocchi per `COMPENSATION` e poi asseriva che contenessero `COMPENSATION`.
 *
 * ⚠ `masked` si DICHIARA, non si tace: una vista che sparisce senza spiegazione è
 * indistinguibile da una che non è mai esistita, e chi guarda non può nemmeno chiedersi
 * perché. Una vista SENZA classi resta `open`: non espone dati di persona e M1 non ha voce
 * in capitolo — è il Self-Service, dove mascherare significherebbe negare a una persona i
 * propri stessi dati (I17).
 */
function vistePerAttore(
  blocchi: { code: string; name: string; order: number; dataClasses: string[] }[],
  domini: ReadonlySet<Domain>,
): DashboardBlock[] {
  return blocchi.map((b) => {
    const classi = b.dataClasses as DataClass[];
    return {
      code: b.code,
      name: b.name,
      order: b.order,
      dataClasses: classi,
      access: modalitaDellaVista(domini, classi),
    };
  });
}

export const dashboardService = {
  /**
   * Il catalogo, filtrato a ciò a cui l'attore ha diritto (#142 F3a).
   *
   * Nessun `requirePermission` sulla rotta, e non è una dimenticanza: non esiste UN permesso
   * per «vedere il catalogo». Ogni famiglia porta il proprio, e il Self-Service non ne ha
   * affatto perché I17 lo garantisce a chiunque. La rotta risponde quindi a ogni utente
   * autenticato, e ciò che restituisce è già solo suo.
   */
  async getCatalog(actor: ActorContext): Promise<DashboardCatalogResponse> {
    const permessi = new Set(userPermissionCodes({ roles: actor.roles }));
    const domini = await dominiCheApronoUnaSuperficie(pool, {
      userId: actor.userId, tenantId: actor.tenantId, roles: actor.roles,
    });
    const righe = await repo.caricaCatalogoCruscotti(pool);

    const dashboards = righe
      .filter((r) => r.permission_code === null || permessi.has(r.permission_code))
      .map((r) => {
        const viste = vistePerAttore(r.blocks, domini);
        return {
          code: r.code,
          name: r.name,
          route: r.route,
          permissionCode: r.permission_code,
          order: r.ord,
          isActive: r.is_active,
          blockCount: viste.length,
          maskedBlockCount: viste.filter((v) => v.access === "masked").length,
          deniedBlockCount: viste.filter((v) => v.access === "denied").length,
        };
      });

    return { dashboards, generatedAt: new Date().toISOString() };
  },

  /** Un cruscotto per esteso. Nega con lo stesso codice che userebbe `requirePermission`. */
  async getDashboard(actor: ActorContext, code: string): Promise<DashboardDetailResponse> {
    const righe = await repo.caricaCatalogoCruscotti(pool);
    const riga = righe.find((r) => r.code === code);
    if (!riga) throw new NotFoundError(`Cruscotto '${code}' inesistente`, "DASHBOARD_NOT_FOUND");

    // Il permesso è DINAMICO — dipende da quale cruscotto si chiede — quindi non può stare
    // in un `requirePermission` statico sulla rotta. Il codice restituito resta però lo
    // stesso che quel middleware userebbe: la condizione è identica, e due codici diversi
    // per lo stesso diniego renderebbero il contratto pubblico incoerente.
    if (riga.permission_code !== null) {
      const permessi = new Set(userPermissionCodes({ roles: actor.roles }));
      if (!permessi.has(riga.permission_code)) {
        throw new ForbiddenError(`Manca il permesso ${riga.permission_code}`, "FORBIDDEN");
      }
    }

    const domini = await dominiCheApronoUnaSuperficie(pool, {
      userId: actor.userId, tenantId: actor.tenantId, roles: actor.roles,
    });
    return {
      code: riga.code,
      name: riga.name,
      route: riga.route,
      permissionCode: riga.permission_code,
      isActive: riga.is_active,
      blocks: vistePerAttore(riga.blocks, domini),
      generatedAt: new Date().toISOString(),
    };
  },

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
