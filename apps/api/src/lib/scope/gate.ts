/**
 * apps/api/src/lib/scope/gate.ts — the taxonomy made PRESCRIPTIVE (ADR-0027 F2, D-51),
 * ora estesa all'asse del CLIENTE (B23, bundle 2026-09-09: "il modello esiste già... va
 * esteso all'asse del cliente").
 *
 * Before this file, `data-classes.ts` only classified: every sensitive module hand-wired
 * resolveOrgReadScope/canReadOrgTarget in its service, and NOTHING failed if a new module on a
 * sensitive resource forgot the gate. This closes that hole structurally: an `onRoute` collector
 * reads the RBAC permission of every registered route (exposed by `requirePermission`), and an
 * `onReady` assertion REFUSES TO BOOT if a read route on a SENSITIVE resource (per the taxonomy)
 * does not declare how its person-level exposure is handled via `config.orgGate`.
 *
 * The declaration is a closed set — every value is a conscious, reviewable claim:
 *   "service"   org read-scope enforced in the service layer (resolveOrgReadScope /
 *               canReadOrgTarget — the F3 pattern; covered by the *-scope integration tests)
 *   "catalog"   the route returns resource/structure-level rows only (skill catalog, KPI
 *               definitions, learning modules/paths, position-band profiles) — no person rows
 *   "aggregate" the route returns aggregated/anonymized figures — no per-person rows
 *
 * Self-scope routes (`<resource>:<verb>:self`) are exempt by design: I17 guarantees them and the
 * services pin them to actor.userId. Write verbs are tenant+RBAC-gated (the org axis gates READS
 * — I18). Non-classified resources never enter the assertion (RBAC+tenant only, by design).
 *
 * **Asse del cliente (`tenantGate`, B23)** — stessa popolazione di rotte (read non-self su
 * risorsa sensibile), stesso meccanismo, seconda domanda: *come questa rotta tratta il confine
 * fra clienti?* Prima di questo file il filtro tenant era affidato a ogni servizio scritto a
 * mano (I5: FK + filtro middleware, MAI RLS) — `tenantContext.ts` si limita a depositare
 * `req.tenantId`, non forza nessun filtro. Il valore `"service"` è la dichiarazione che la
 * query nel repository filtra esplicitamente per tenant; `"platform"` è la dichiarazione che
 * la risorsa non ha `tenant_id` ed è legittimamente cross-cliente (oggi un solo caso:
 * `assessment-methods`, catalogo di 5 righe seminate, nessuna colonna tenant). **Confine
 * dichiarato**: questo gate copre le stesse rotte sensibili già governate da `orgGate` — non i
 * 352 punti censiti da B1 (quelli sono verificati sul dato vivo da
 * `sys.v_tenant_boundary_violations_full`, non sulla dichiarazione del codice). Estendere la
 * copertura oltre le risorse sensibili è lavoro futuro, non silenzioso: va dichiarato, non dato
 * per fatto.
 */

import type { FastifyInstance, RouteOptions, preHandlerHookHandler } from "fastify";
import { isSensitiveResource } from "./data-classes.js";

/** Closed set of org-gate declarations a sensitive read route may carry. */
export type OrgGateDeclaration = "service" | "catalog" | "aggregate";

const ORG_GATE_VALUES: ReadonlySet<string> = new Set(["service", "catalog", "aggregate"]);

/** Closed set of tenant-gate declarations (B23) — stessa popolazione di rotte di orgGate. */
export type TenantGateDeclaration = "service" | "platform";

const TENANT_GATE_VALUES: ReadonlySet<string> = new Set(["service", "platform"]);

/** Permission verbs that expose data (the org axis gates reads — I18). */
const READ_VERBS: ReadonlySet<string> = new Set(["read", "view", "list"]);

declare module "fastify" {
  interface FastifyContextConfig {
    /** D-51: mandatory on read routes whose RBAC resource is sensitive (data-classes.ts). */
    orgGate?: OrgGateDeclaration;
    /** B23: mandatory on the SAME read routes — how this route treats the tenant boundary. */
    tenantGate?: TenantGateDeclaration;
  }
  interface FastifyInstance {
    /** D-51: what the org-gate collector saw — test introspection (set by registerOrgGateAssertion). */
    orgGateStats: OrgGateStats;
  }
}

/** One sensitive read route seen by the collector. */
export interface OrgGatedRoute {
  method: string;
  url: string;
  resource: string;
  permissionCode: string;
  orgGate: OrgGateDeclaration | undefined;
  tenantGate: TenantGateDeclaration | undefined;
}

export interface OrgGateStats {
  /** Every sensitive-read route collected at registration time. */
  sensitiveReadRoutes: OrgGatedRoute[];
  /** The subset with a missing/invalid orgGate declaration (boot fails if non-empty). */
  violations: OrgGatedRoute[];
  /** B23: the subset with a missing/invalid tenantGate declaration (boot fails if non-empty). */
  tenantViolations: OrgGatedRoute[];
}

/** Extract the RBAC permission codes attached to the route's preHandlers by requirePermission. */
function permissionCodesOf(route: RouteOptions): string[] {
  const pre = route.preHandler;
  const handlers: preHandlerHookHandler[] = pre === undefined ? [] : Array.isArray(pre) ? pre : [pre];
  const codes: string[] = [];
  for (const h of handlers) {
    const code = (h as { permissionCode?: unknown }).permissionCode;
    if (typeof code === "string") codes.push(code);
  }
  return codes;
}

/** True iff the permission code is a non-self READ on a taxonomy-sensitive resource. */
function isSensitiveReadCode(code: string): { resource: string } | null {
  const parts = code.split(":");
  const resource = parts[0];
  const verb = parts[1];
  if (!resource || !verb) return null;
  if (parts.includes("self")) return null; // I17 self-scope — exempt by design
  if (!READ_VERBS.has(verb)) return null; // writes are tenant+RBAC-gated (I18 gates reads)
  if (!isSensitiveResource(resource)) return null;
  return { resource };
}

/**
 * Wire the collector + boot assertion onto the app. Call it BEFORE registering module routes
 * (onRoute only sees routes registered after the hook). Decorates `app.orgGateStats` so tests
 * can assert the surface was actually collected.
 */
export function registerOrgGateAssertion(app: FastifyInstance): OrgGateStats {
  const stats: OrgGateStats = { sensitiveReadRoutes: [], violations: [], tenantViolations: [] };
  app.decorate("orgGateStats", stats);

  app.addHook("onRoute", (route) => {
    for (const permissionCode of permissionCodesOf(route)) {
      const sensitive = isSensitiveReadCode(permissionCode);
      if (!sensitive) continue;
      const orgGate = route.config?.orgGate;
      const tenantGate = route.config?.tenantGate;
      const entry: OrgGatedRoute = {
        method: Array.isArray(route.method) ? route.method.join(",") : route.method,
        url: route.url,
        resource: sensitive.resource,
        permissionCode,
        orgGate,
        tenantGate,
      };
      stats.sensitiveReadRoutes.push(entry);
      if (orgGate === undefined || !ORG_GATE_VALUES.has(orgGate)) stats.violations.push(entry);
      if (tenantGate === undefined || !TENANT_GATE_VALUES.has(tenantGate)) {
        stats.tenantViolations.push(entry);
      }
    }
  });

  app.addHook("onReady", async () => {
    if (stats.violations.length > 0) {
      const list = stats.violations
        .map((v) => `  ${v.method} ${v.url} — ${v.permissionCode} (data-class resource: ${v.resource})`)
        .join("\n");
      throw new Error(
        `ORG_GATE_MISSING: ${stats.violations.length} read route(s) on SENSITIVE data-class resources ` +
          `lack an org-gate declaration (ADR-0027 F2, D-51).\n${list}\n` +
          `Fix: enforce the org read scope in the service (lib/scope/resolver.ts) and declare ` +
          `config: { orgGate: "service" } on the route — or, if the route provably returns no ` +
          `person-level rows, declare "catalog" / "aggregate".`,
      );
    }
    if (stats.tenantViolations.length > 0) {
      const list = stats.tenantViolations
        .map((v) => `  ${v.method} ${v.url} — ${v.permissionCode} (data-class resource: ${v.resource})`)
        .join("\n");
      throw new Error(
        `TENANT_GATE_MISSING: ${stats.tenantViolations.length} read route(s) on SENSITIVE data-class ` +
          `resources lack a tenant-gate declaration (B23, bundle 2026-09-09).\n${list}\n` +
          `Fix: filter the repository query by the actor's tenant and declare ` +
          `config: { tenantGate: "service" } on the route — or, if the resource provably has no ` +
          `tenant_id column (a platform-wide catalog), declare "platform".`,
      );
    }
  });

  return stats;
}
