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
  DashboardDataResponse,
  DashboardDetailResponse,
  DashboardScopeKind,
  DashboardWidgetsResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { FORNITORI, chiaveFornitore, type PerimetroBlocchi } from "./blocchi.js";

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

  /**
   * I dati dentro le viste (#142 F3b).
   *
   * Il **se** e il **come** sono già decisi: il permesso di famiglia autorizza l'accesso al
   * cruscotto (stessa condizione, stesso codice di diniego di `getDashboard`), e
   * `modalitaDellaVista` dice per ogni vista se è `open`, `masked` o `denied`. Questo metodo
   * aggiunge solo il **cosa**, e lo aggiunge a una sola delle tre:
   *
   *  · `open`   → il fornitore gira e il contenuto esce
   *  · `masked` → il fornitore NON gira: i valori sono trattenuti, e il perché si dichiara
   *               nominando le classi (ADR-0032 — riga, soggetto, periodo e stato restano
   *               visibili, sono i valori a mancare)
   *  · `denied` → il fornitore non gira e non c'è niente da dichiarare oltre al diniego
   *
   * ⚠ Una vista `masked` non deve nemmeno TOCCARE il database: se la query girasse e poi si
   * buttasse il risultato, basterebbe una svista futura — un log, un conteggio, un campo
   * lasciato passare — perché i valori trapelassero. Non girare è una garanzia strutturale;
   * girare e scartare è una promessa.
   */
  async getDashboardData(actor: ActorContext, code: string): Promise<DashboardDataResponse> {
    const righe = await repo.caricaCatalogoCruscotti(pool);
    const riga = righe.find((r) => r.code === code);
    if (!riga) throw new NotFoundError(`Cruscotto '${code}' inesistente`, "DASHBOARD_NOT_FOUND");

    if (riga.permission_code !== null) {
      const permessi = new Set(userPermissionCodes({ roles: actor.roles }));
      if (!permessi.has(riga.permission_code)) {
        throw new ForbiddenError(`Manca il permesso ${riga.permission_code}`, "FORBIDDEN");
      }
    }

    const domini = await dominiCheApronoUnaSuperficie(pool, {
      userId: actor.userId, tenantId: actor.tenantId, roles: actor.roles,
    });
    // ⚠ IL TIER NON È UNA PRECONDIZIONE DEL SELF-SERVICE, e la prova live me lo ha
    // insegnato con un 500. `scopeTierAndRole` **lancia** (`NoScopeTierError`, #119) quando
    // non riesce a collocare l'attore — ed è giusto che lo faccia, perché una pagina che dice
    // «non hai dati» quando la verità è «non ho saputo collocarti» è peggio di un errore.
    // Ma il Self-Service è il **pavimento universale**: I17 lo garantisce a *chiunque*, e
    // chiederne il tier significa negare a una persona i propri stessi dati per una ragione
    // che non la riguarda. Il caso non era teorico: `antonio.parisi`, che non ha alcun
    // dominio, riceveva 500 sull'unico cruscotto che gli spetta di diritto.
    const soloSe = code === "self";
    const tier: DashboardScopeKind = soloSe ? "TEAM" : (await highestScope(actor)).tier;

    // Il perimetro, nei tre casi che il modello prevede. `platform` è l'unico cross-tenant,
    // e lo è perché il suo permesso di famiglia lo dice — non perché il tier lo consenta.
    const crossTenant = code === "platform";
    const unitaDelPerimetro =
      soloSe || crossTenant || tier === "PLATFORM" || tier === "TENANT"
        ? []
        : await repo.unitaNelPerimetroOrganizzativo(pool, actor.userId);

    const perimetro: PerimetroBlocchi = {
      tenantId: crossTenant ? null : actor.tenantId,
      userId: actor.userId,
      unitaDelPerimetro,
    };

    const blocks = await Promise.all(
      vistePerAttore(riga.blocks, domini).map(async (v) => {
        if (v.access === "denied") {
          return { ...v, content: null, withheldReason: "Nessuno dei tuoi domini apre questa vista" };
        }
        if (v.access === "masked") {
          return {
            ...v,
            content: null,
            withheldReason:
              `Valori trattenuti: ${v.dataClasses.join(", ")} ti è accessibile in forma mascherata. ` +
              "La vista esiste e ti riguarda; i valori richiedono un mandato che non hai.",
          };
        }
        const fornitore = FORNITORI[chiaveFornitore(code, v.code)];
        if (!fornitore) {
          // Una vista dichiarata nel database senza fornitore nel codice: è un difetto di
          // allineamento, e si dichiara invece di uscire come una vista vuota — che sarebbe
          // indistinguibile da «non hai dati».
          return { ...v, content: null, withheldReason: "Vista senza fornitore di dati" };
        }
        return { ...v, content: await fornitore(pool, perimetro), withheldReason: null };
      }),
    );

    return {
      code: riga.code,
      name: riga.name,
      route: riga.route,
      permissionCode: riga.permission_code,
      isActive: riga.is_active,
      scope: { kind: tier, tenantId: perimetro.tenantId, teamPositionIds: [] },
      blocks,
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
