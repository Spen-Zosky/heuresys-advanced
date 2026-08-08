/**
 * apps/api/src/app.ts
 * Builds the Fastify app with the canonical plugin order per
 * API_IMPLEMENTATION_PLAN §3.2 + §14.
 *
 * Exported as a function so tests (via app.inject) can build an isolated app
 * without binding to a network port.
 */

import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestIdPlugin } from "./middleware/requestId.js";
import { authPlugin } from "./middleware/auth.js";
import { tenantContextPlugin } from "./middleware/tenantContext.js";
import { localePlugin } from "./middleware/locale.js";
import { csrfPlugin } from "./middleware/csrf.js";
import { isDatabaseReady } from "./db/client.js";
import { COOKIES } from "./config/constants.js";
import { metricsStore } from "./modules/observability/metrics-store.js";
import { observeHttp, enablePrometheus, registry } from "./modules/observability/prometheus.js";
import { authRoutes } from "./modules/auth/routes.js";
import { mfaRoutes } from "./modules/auth/mfa-routes.js";
import { mfaPolicyRoutes } from "./modules/mfa-policy/routes.js";
import { makeMailer } from "./modules/auth/smtp-mailer.js";
import { buildMfaServiceWithMailer } from "./modules/auth/mfa-service.js";
import { tenantsRoutes } from "./modules/tenants/routes.js";
import { usersRoutes } from "./modules/users/routes.js";
import { positionsRoutes } from "./modules/positions/routes.js";
import { organizationUnitsRoutes } from "./modules/organization-units/routes.js";
import { teamsRoutes } from "./modules/teams/routes.js";
import { skillsRoutes } from "./modules/skills/routes.js";
import { kpiDefinitionsRoutes } from "./modules/kpi-definitions/routes.js";
import { jobFamiliesRoutes } from "./modules/job-families/routes.js";
import { jobRolesRoutes } from "./modules/job-roles/routes.js";
import { learningModulesRoutes } from "./modules/learning-modules/routes.js";
import { skillFamiliesRoutes } from "./modules/skill-families/routes.js";
import { skillCategoriesRoutes } from "./modules/skill-categories/routes.js";
import { skillTaxonomyEdgesRoutes } from "./modules/skill-taxonomy-edges/routes.js";
import { skillAliasesRoutes } from "./modules/skill-aliases/routes.js";
import { skillProficiencyLevelsRoutes } from "./modules/skill-proficiency-levels/routes.js";
import { trainingInitiativesRoutes } from "./modules/training-initiatives/routes.js";
import { assessmentMethodsRoutes } from "./modules/assessment-methods/routes.js";
import { assessmentsRoutes } from "./modules/assessments/routes.js";
import { assessmentResultsRoutes } from "./modules/assessment-results/routes.js";
import { learningPathsRoutes } from "./modules/learning-paths/routes.js";
import { learningPathStepsRoutes } from "./modules/learning-path-steps/routes.js";
import { learningGapsRoutes } from "./modules/learning-gaps/routes.js";
import { careerPathsRoutes } from "./modules/career-paths/routes.js";
import { careerPathStepsRoutes } from "./modules/career-path-steps/routes.js";
import { userCareerPlansRoutes } from "./modules/user-career-plans/routes.js";
import { userTargetPositionsRoutes } from "./modules/user-target-positions/routes.js";
import { organizationUnitHistoryRoutes } from "./modules/organization-unit-history/routes.js";
import { successionPoolsRoutes } from "./modules/succession-pools/routes.js";
import { successorCandidatesRoutes } from "./modules/successor-candidates/routes.js";
import { successorReadinessRoutes } from "./modules/successor-readiness/routes.js";
import { positionCareerPathsRoutes } from "./modules/position-career-paths/routes.js";
import { positionSuccessionRelevanceRoutes } from "./modules/position-succession-relevance/routes.js";
import { visualizationGraphsRoutes } from "./modules/visualization-graphs/routes.js";
import { visualizationNodesRoutes } from "./modules/visualization-nodes/routes.js";
import { visualizationEdgesRoutes } from "./modules/visualization-edges/routes.js";
import { visualizationLayoutsRoutes } from "./modules/visualization-layouts/routes.js";
import { visualizationNodeLayoutsRoutes } from "./modules/visualization-node-layouts/routes.js";
import { visualizationStylesRoutes } from "./modules/visualization-styles/routes.js";
import { visualizationExportsRoutes } from "./modules/visualization-exports/routes.js";
import { activityClassificationsRoutes } from "./modules/activity-classifications/routes.js";
import { activityMappingsRoutes } from "./modules/activity-classification-mappings/routes.js";
import { occupationClassificationsRoutes } from "./modules/occupation-classifications/routes.js";
import { enterpriseSizeBandsRoutes } from "./modules/enterprise-size-bands/routes.js";
import { operatingModelsRoutes } from "./modules/operating-models/routes.js";
import { enterpriseTypingProfilesRoutes } from "./modules/enterprise-typing-profiles/routes.js";
import { blueprintFamiliesRoutes } from "./modules/blueprint-families/routes.js";
import { blueprintVariantsRoutes } from "./modules/blueprint-variants/routes.js";
import { tenantBlueprintsRoutes } from "./modules/tenant-blueprints/routes.js";
import { blueprintProcessesRoutes } from "./modules/blueprint-processes/routes.js";
import { blueprintActivationsRoutes } from "./modules/blueprint-activations/routes.js";
import { blueprintOverridesRoutes } from "./modules/blueprint-overrides/routes.js";
import { processKpiTemplatesRoutes } from "./modules/process-kpi-templates/routes.js";
import { organizationUnitKpiTemplatesRoutes } from "./modules/organization-unit-kpi-templates/routes.js";
import { seedAcquisitionRunsRoutes } from "./modules/seed-acquisition-runs/routes.js";
import { seedCandidateRecordsRoutes } from "./modules/seed-candidate-records/routes.js";
import { seedApprovalDecisionsRoutes } from "./modules/seed-approval-decisions/routes.js";
import { meRoutes } from "./modules/me/routes.js";
import { compensationRoutes } from "./modules/compensation/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { analyticsRoutes } from "./modules/analytics/routes.js";
import { addExportHook } from "./lib/export/hook.js";
import { registerOrgGateAssertion } from "./lib/scope/gate.js";
import { notificationsRoutes } from "./modules/notifications/routes.js";
import { observabilityRoutes } from "./modules/observability/routes.js";
import { mentorshipRoutes } from "./modules/mentorship/routes.js";
import { surveysRoutes } from "./modules/surveys/routes.js";
import { engagementFeedbackRoutes } from "./modules/engagement-feedback/routes.js";
import { goalsRoutes } from "./modules/goals/routes.js";
import { okrsRoutes } from "./modules/okrs/routes.js";
import { provenanceRoutes } from "./modules/provenance/routes.js";
import { evidenceRoutes } from "./modules/evidence/routes.js";
import { timeOffRoutes } from "./modules/time-off/routes.js";
import { userTimelineRoutes } from "./modules/user-timeline/routes.js";
import { talentReviewRoutes } from "./modules/talent-review/routes.js";
import { predictionsRoutes } from "./modules/predictions/routes.js";
import { engagementRoutes } from "./modules/engagement/routes.js";
import { semanticMatchingRoutes } from "./modules/semantic-matching/routes.js";
import { insightsRoutes } from "./modules/insights/routes.js";
import { capabilityCompositionRoutes } from "./modules/capability-composition/routes.js";
import { orgHealthRoutes } from "./modules/org-health/routes.js";
import { advisorRoutes } from "./modules/advisor/routes.js";
import { capabilityMaturityRoutes } from "./modules/capability-maturity/routes.js";
import { referenceSyncRoutes } from "./modules/reference-sync/routes.js";
import type { ReferenceSyncDeps } from "./modules/reference-sync/service.js";
import { contentRoutes } from "./modules/content/routes.js";
import { contentMediaRoutes } from "./modules/content/media-routes.js";
import { contentBlueprintLinksRoutes } from "./modules/content-blueprint-links/routes.js";
import { organizationUnitProcessesRoutes } from "./modules/organization-unit-processes/routes.js";
import { approvalsRoutes } from "./modules/approvals/routes.js";
import { leadsRoutes } from "./modules/leads/routes.js";
import { whistleblowingRoutes } from "./modules/whistleblowing/routes.js";
import { gdprRoutes } from "./modules/gdpr/routes.js";
import { publicStatsRoutes } from "./modules/public-stats/routes.js";
import { tenantMaterializationRoutes } from "./modules/tenant-materialization/routes.js";
import type { SemanticMatchingDeps } from "./modules/semantic-matching/service.js";
import type { IMailer } from "./modules/auth/mailer.js";
import { makeSmsSender, type ISmsSender } from "./modules/auth/sms-sender.js";
import { createWebauthnService } from "./modules/auth/webauthn-service.js";

export interface BuildAppOptions {
  /** Custom mailer for the auth module — tests inject InMemoryMailer. */
  authMailer?: IMailer;
  /** Custom SMS sender for the SMS_OTP factor — tests inject InMemorySms. */
  smsSender?: ISmsSender;
  /**
   * TOFU v2 enroll-confirm mode override (default: env MFA_ENROLL_CONFIRM).
   * buildTestApp pins "off" so pre-v2 suites keep their behaviour.
   */
  enrollConfirm?: "auto" | "on" | "off";
  /** Semantic-matching DI seams — tests inject a non-destructive backfill + a FakeEmbedder. */
  matchingDeps?: SemanticMatchingDeps;
  /** Reference-sync DI seam — tests inject fixture fetchers (no live HTTP).
   *  Partial: a suite injects only the source(s) it exercises. */
  referenceSyncDeps?: Partial<ReferenceSyncDeps>;
  /**
   * Mandatory-MFA login enforcement (S989 neutralization seam). Defaults to
   * env.MFA_ENFORCEMENT_ENABLED (true). buildTestApp pins true so existing
   * suites are unaffected; the dedicated bypass test passes false. When false
   * the login §3b gate is suspended (dev/test proceeds without a second factor).
   */
  mfaEnforcement?: boolean;
}

/**
 * Single source of truth for the pino redact paths used by the API logger.
 * Exported so the redaction test can build a parallel pino instance with
 * the same config and verify it works at runtime.
 */
export const LOG_REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  "req.body.password",
  "req.body.newPassword",
  "req.body.confirmPassword",
  // MFA second-factor codes carried on request bodies (login step-up +
  // EMAIL_OTP/TOTP/SMS_OTP verify-setup) — must never persist in request logs.
  "req.body.code",
  "req.body.mfaCode",
  // SMS_OTP enrollment destination (PII) — only the masked hint may surface.
  "req.body.phoneNumber",
  "res.body.token",
  "res.body.refreshToken",
  "*.password",
  "*.hash",
  "*.secret",
  // MFA OTP plaintext: redact any `code`/`otp`/`devOnlyCode` key at any depth so
  // an emailed one-time code can never surface in structured log fields.
  "*.code",
  "*.otp",
  "*.devOnlyCode",
] as const;

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: { paths: [...LOG_REDACT_PATHS], censor: "[REDACTED]" },
    },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 1024 * 1024, // 1 MB
    disableRequestLogging: false,
  }).withTypeProvider<ZodTypeProvider>();

  // 1. Type-provider compilers (FIRST — subsequent routes use Zod schemas)
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 1a. Org-gate boot assertion (ADR-0027 F2 prescriptive, D-51) — must precede every route
  //     registration: onRoute only sees routes declared after the hook. Refuses to boot if a
  //     read route on a SENSITIVE data-class resource lacks a config.orgGate declaration.
  registerOrgGateAssertion(app);

  // 1b. OpenAPI/Swagger (R6) — gated OFF by default (env.API_DOCS_ENABLED). Registered
  //     right after the type-provider compilers so its onRoute hook captures EVERY route
  //     declared below (the Zod schemas are converted via jsonSchemaTransform). When the
  //     flag is off neither /docs (UI) nor /openapi.json (spec) exists.
  if (env.API_DOCS_ENABLED) {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: "Heuresys Advanced API",
          description: "Fastify 5 + Zod-typed contract — the /v1/* endpoint surface.",
          version: "1.0.0",
        },
        servers: [{ url: "/", description: "same-origin (behind the /api proxy in the web app)" }],
      },
      transform: jsonSchemaTransform,
    });
    await app.register(fastifySwaggerUi, { routePrefix: "/docs" });
    // Canonical OpenAPI spec endpoint (swagger-ui also serves it at /docs/json).
    // app.swagger() is resolved at request time (after ready) → captures every route.
    // hide:true keeps this meta-route out of the spec it returns.
    app.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());
  }

  // 2. Request id (so every subsequent log/error/response carries it)
  await app.register(requestIdPlugin);

  // 2b. Request metrics — onResponse lifecycle hook feeding an in-memory store.
  //     A lifecycle hook is independent of the 13-step plugin order (§3.2); it is
  //     placed here so it wraps every subsequent route. Metrics must never break
  //     the response, so the whole body is guarded.
  // D-09: turn Prometheus collection ON only when explicitly enabled (prod-safe).
  if (env.PROM_METRICS_ENABLED) enablePrometheus();
  app.addHook("onResponse", async (req, reply) => {
    try {
      const route = (req.routeOptions && req.routeOptions.url) || req.url;
      metricsStore.record(reply.statusCode, reply.elapsedTime ?? 0, route);
      // observeHttp is a no-op unless Prometheus is enabled. route = PATTERN, not
      // the concrete URL, to keep label cardinality bounded.
      observeHttp(req.method, route, reply.statusCode, reply.elapsedTime ?? 0);
    } catch {
      /* metrics must never break the response */
    }
  });

  // 2c. Reporting/export (3.5) — global onSend hook: `?format=csv|xlsx|pdf` on any
  //     {items,total} list endpoint downloads it as a file. Runs after the handler,
  //     so RBAC/scope/filters already applied. No-op without ?format. (§3.2-independent)
  addExportHook(app);

  // 3. Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", env.ADMIN_ORIGIN],
      },
    },
  });

  // 4. CORS for the admin SPA (must precede route handlers)
  await app.register(cors, {
    origin: env.ADMIN_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  // 5. Cookies (parsed for downstream JWT + CSRF plugins)
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
    parseOptions: {},
  });

  // 6. JWT
  await app.register(jwt, {
    secret: { private: env.JWT_PRIVATE_KEY, public: env.JWT_PUBLIC_KEY },
    sign: {
      algorithm: "RS256",
      iss: "heuresys-advanced",
      aud: "heuresys-advanced-api",
      expiresIn: "15m",
    },
    verify: {
      allowedIss: "heuresys-advanced",
      allowedAud: "heuresys-advanced-api",
    },
    cookie: { cookieName: COOKIES.ACCESS, signed: false },
  });

  // 7. Rate limit (defaults; per-route overrides applied in auth module).
  // Keyed on req.ip: rate-limit registers BEFORE the auth plugin (step 8) that
  // decorates req.user, so its onRequest hook always saw req.user === undefined —
  // the `req.user?.userId ??` branch was dead code (F-WS-H-2, removed). The
  // genuine client IP depends on TRUST_PROXY (D-28) behind the nginx proxy.
  await app.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
  });

  // 8. Auth (decorates req.user from JWT cookie when present)
  await app.register(authPlugin);

  // 9. CSRF (decorates app.verifyCsrf for per-route opt-in)
  await app.register(csrfPlugin);

  // 10. Tenant context (depends on req.user from auth plugin)
  await app.register(tenantContextPlugin);

  // 10b. Locale (i18n overlay, ADR-0029): decorates req.locale from
  // x-locale header / NEXT_LOCALE cookie / 'it'. Depends on @fastify/cookie.
  await app.register(localePlugin);

  // 11. Error handler (catches everything that bubbled up)
  app.setErrorHandler(errorHandler);

  // 12. Health endpoints — public, no auth required
  app.get("/healthz", async () => ({ status: "ok" }));

  // D-09: Prometheus scrape endpoint — loopback-only + gated (PROM_METRICS_ENABLED).
  // Deliberately NOT under /v1 (no auth/RBAC): the local systemd collector scrapes
  // 127.0.0.1:<api>/metrics directly (bypassing nginx, which has no /metrics
  // location). Any non-loopback peer, or a disabled flag, gets a plain 404 — the
  // endpoint is never publicly observable.
  app.get("/metrics", { schema: { hide: true } }, async (req, reply) => {
    // Real TCP peer (not spoofable via X-Forwarded). In production req.socket
    // always exists; the req.ip fallback only matters under test injection.
    const peer = req.socket?.remoteAddress ?? req.ip ?? "";
    const isLoopback = peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1";
    if (!env.PROM_METRICS_ENABLED || !isLoopback) {
      reply.code(404);
      return { error: { code: "NOT_FOUND", message: "Not found" } };
    }
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
  });

  app.get("/readyz", async () => {
    const dbReady = await isDatabaseReady();
    return {
      status: dbReady ? "ready" : "degraded",
      checks: { database: dbReady ? "ok" : "fail" },
    };
  });

  // 13. Module routes
  // Build ONE mailer-bound MFA service so EMAIL_OTP sends (enrollment + login
  // step-up) flow through the same mailer the rest of auth uses (InMemoryMailer
  // in tests, the configured transactional mailer in prod). Shared by the auth
  // login flow (mfaService dep) and the MFA management routes (service).
  const authMailer = options.authMailer ?? makeMailer(app.log);
  const mfaEnforcement = options.mfaEnforcement ?? env.MFA_ENFORCEMENT_ENABLED;
  const smsSender = options.smsSender ?? makeSmsSender(app.log);
  const mfaService = buildMfaServiceWithMailer(
    authMailer,
    undefined,
    smsSender,
    options.enrollConfirm,
  );
  // WebAuthn service wired with the TOFU v2 confirm hooks (first self-owned
  // factor -> credential persisted but factor pending the email confirm).
  const webauthnService = createWebauthnService({
    enrollConfirm: {
      required: (userId) => mfaService.enrollConfirmRequired(userId, "WEBAUTHN"),
      begin: (userId, factorId) => mfaService.beginEnrollConfirm({ userId, factorId }),
      recordEnrolled: (userId) => mfaService.recordFactorEnrolled(userId, "WEBAUTHN"),
    },
  });
  await app.register(authRoutes, { prefix: "/v1/auth", mailer: authMailer, mfaService, mfaEnforcement });
  await app.register(mfaRoutes, {
    prefix: "/v1/auth/mfa",
    service: mfaService,
    mailer: authMailer,
    webauthnService,
  });
  await app.register(mfaPolicyRoutes, { prefix: "/v1/mfa-policy" });
  await app.register(tenantsRoutes, { prefix: "/v1/tenants" });
  await app.register(usersRoutes, { prefix: "/v1/users" });
  await app.register(positionsRoutes, { prefix: "/v1/positions" });
  await app.register(organizationUnitsRoutes, { prefix: "/v1/organization-units" });
  await app.register(tenantMaterializationRoutes, { prefix: "/v1/tenant-materialization" });
  await app.register(teamsRoutes, { prefix: "/v1/teams" });
  await app.register(skillsRoutes, { prefix: "/v1/skills" });
  await app.register(kpiDefinitionsRoutes, { prefix: "/v1/kpi-definitions" });
  await app.register(jobFamiliesRoutes, { prefix: "/v1/job-families" });
  await app.register(jobRolesRoutes, { prefix: "/v1/job-roles" });
  await app.register(learningModulesRoutes, { prefix: "/v1/learning-modules" });
  await app.register(skillFamiliesRoutes, { prefix: "/v1/skill-families" });
  await app.register(skillCategoriesRoutes, { prefix: "/v1/skill-categories" });
  await app.register(skillTaxonomyEdgesRoutes, { prefix: "/v1/skill-taxonomy-edges" });
  await app.register(skillAliasesRoutes, { prefix: "/v1/skill-aliases" });
  await app.register(skillProficiencyLevelsRoutes, { prefix: "/v1/skill-proficiency-levels" });
  await app.register(trainingInitiativesRoutes, { prefix: "/v1/training-initiatives" });
  await app.register(assessmentMethodsRoutes, { prefix: "/v1/assessment-methods" });
  await app.register(assessmentsRoutes, { prefix: "/v1/assessments" });
  await app.register(assessmentResultsRoutes, { prefix: "/v1/assessment-results" });
  await app.register(learningPathsRoutes, { prefix: "/v1/learning-paths" });
  await app.register(learningPathStepsRoutes, { prefix: "/v1/learning-path-steps" });
  await app.register(learningGapsRoutes, { prefix: "/v1/learning-gaps" });
  await app.register(careerPathsRoutes, { prefix: "/v1/career-paths" });
  await app.register(careerPathStepsRoutes, { prefix: "/v1/career-path-steps" });
  await app.register(userCareerPlansRoutes, { prefix: "/v1/user-career-plans" });
  await app.register(userTargetPositionsRoutes, { prefix: "/v1/user-target-positions" });
  await app.register(organizationUnitHistoryRoutes, { prefix: "/v1/organization-unit-history" });
  await app.register(successionPoolsRoutes, { prefix: "/v1/succession-pools" });
  await app.register(successorCandidatesRoutes, { prefix: "/v1/successor-candidates" });
  await app.register(successorReadinessRoutes, { prefix: "/v1/successor-readiness" });
  await app.register(positionCareerPathsRoutes, { prefix: "/v1/position-career-paths" });
  await app.register(positionSuccessionRelevanceRoutes, { prefix: "/v1/position-succession-relevance" });
  await app.register(visualizationGraphsRoutes, { prefix: "/v1/visualization-graphs" });
  await app.register(visualizationNodesRoutes, { prefix: "/v1/visualization-nodes" });
  await app.register(visualizationEdgesRoutes, { prefix: "/v1/visualization-edges" });
  await app.register(visualizationLayoutsRoutes, { prefix: "/v1/visualization-layouts" });
  await app.register(visualizationNodeLayoutsRoutes, { prefix: "/v1/visualization-node-layouts" });
  await app.register(visualizationStylesRoutes, { prefix: "/v1/visualization-styles" });
  await app.register(visualizationExportsRoutes, { prefix: "/v1/visualization-exports" });
  await app.register(activityClassificationsRoutes, { prefix: "/v1/activity-classifications" });
  await app.register(activityMappingsRoutes, { prefix: "/v1/activity-classification-mappings" });
  await app.register(occupationClassificationsRoutes, { prefix: "/v1/occupation-classifications" });
  await app.register(enterpriseSizeBandsRoutes, { prefix: "/v1/enterprise-size-bands" });
  await app.register(operatingModelsRoutes, { prefix: "/v1/operating-models" });
  await app.register(enterpriseTypingProfilesRoutes, { prefix: "/v1/enterprise-typing-profiles" });
  await app.register(blueprintFamiliesRoutes, { prefix: "/v1/blueprint-families" });
  await app.register(blueprintVariantsRoutes, { prefix: "/v1/blueprint-variants" });
  await app.register(blueprintProcessesRoutes, { prefix: "/v1/blueprint-processes" });
  await app.register(blueprintActivationsRoutes, { prefix: "/v1/blueprint-activations" });
  await app.register(blueprintOverridesRoutes, { prefix: "/v1/blueprint-overrides" });
  await app.register(tenantBlueprintsRoutes, { prefix: "/v1/tenant-blueprints" });
  await app.register(processKpiTemplatesRoutes, { prefix: "/v1/process-kpi-templates" });
  await app.register(organizationUnitKpiTemplatesRoutes, { prefix: "/v1/organization-unit-kpi-templates" });
  // #164 F3 — le 4 superfici ETL brownfield sono RITIRATE (non piu' congelate).
  // Misurato prima di rimuoverle: rispondevano 404 in produzione, quindi il ritiro
  // non ha tolto nulla a nessuno. ADR-0023 resta la dottrina sulla PROVENIENZA dei
  // dati; qui se ne va lo strumento che li portava, che aveva finito il suo lavoro.
  await app.register(seedAcquisitionRunsRoutes, { prefix: "/v1/seed-acquisition-runs" });
  await app.register(seedCandidateRecordsRoutes, { prefix: "/v1/seed-candidate-records" });
  await app.register(seedApprovalDecisionsRoutes, { prefix: "/v1/seed-approval-decisions" });
  await app.register(meRoutes, { prefix: "/v1/me" });
  await app.register(compensationRoutes, { prefix: "/v1/compensation" });
  await app.register(dashboardRoutes, { prefix: "/v1/dashboard" });
  await app.register(analyticsRoutes, { prefix: "/v1/analytics" });
  await app.register(notificationsRoutes, { prefix: "/v1/notifications" });
  await app.register(observabilityRoutes, { prefix: "/v1/observability" });
  await app.register(mentorshipRoutes, { prefix: "/v1/mentorship" });
  await app.register(surveysRoutes, { prefix: "/v1/surveys" });
  await app.register(engagementFeedbackRoutes, { prefix: "/v1/engagement-feedback" });
  await app.register(goalsRoutes, { prefix: "/v1/goals" });
  await app.register(okrsRoutes, { prefix: "/v1/okrs" });
  await app.register(provenanceRoutes, { prefix: "/v1/provenance" }); // #28 Trust Ledger (S1018)
  await app.register(evidenceRoutes, { prefix: "/v1/evidence" }); // #27 evidence layer (S1018)
  await app.register(timeOffRoutes, { prefix: "/v1/time-off" }); // A/L8 (#33) time-off/leave read
  await app.register(userTimelineRoutes, { prefix: "/v1/user-timeline" }); // D5 (#49) storia della persona
  await app.register(talentReviewRoutes, { prefix: "/v1/talent-review" }); // A/L3 (#29) talent-review 9-box
  await app.register(predictionsRoutes, { prefix: "/v1/predictions" });
  await app.register(engagementRoutes, { prefix: "/v1/engagement" });
  await app.register(semanticMatchingRoutes, { prefix: "/v1/matching", deps: options.matchingDeps });
  await app.register(insightsRoutes, { prefix: "/v1/insights" });
  await app.register(capabilityCompositionRoutes, { prefix: "/v1/capability" });
  await app.register(orgHealthRoutes, { prefix: "/v1/org-health" });
  await app.register(advisorRoutes, { prefix: "/v1/advisor" });
  await app.register(capabilityMaturityRoutes, { prefix: "/v1/capability" });
  await app.register(referenceSyncRoutes, { prefix: "/v1/reference-sync", deps: options.referenceSyncDeps });
  await app.register(contentRoutes, { prefix: "/v1/content" });
  await app.register(contentMediaRoutes, { prefix: "/v1/content" });
  await app.register(contentBlueprintLinksRoutes, { prefix: "/v1/content-blueprint-links" });
  await app.register(organizationUnitProcessesRoutes, { prefix: "/v1/organization-unit-processes" });
  await app.register(approvalsRoutes, { prefix: "/v1/approvals" });
  await app.register(leadsRoutes, { prefix: "/v1/leads" });
  await app.register(whistleblowingRoutes, { prefix: "/v1/whistleblowing" });
  await app.register(gdprRoutes, { prefix: "/v1/gdpr" });
  await app.register(publicStatsRoutes, { prefix: "/v1/public" });

  return app;
}
