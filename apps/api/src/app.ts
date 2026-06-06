/**
 * apps/api/src/app.ts
 * Builds the Fastify app with the canonical plugin order per
 * API_IMPLEMENTATION_PLAN §3.2 + §14.
 *
 * Exported as a function so tests (supertest) can build an isolated app
 * without binding to a network port.
 */

import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import {
  ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestIdPlugin } from "./middleware/requestId.js";
import { authPlugin } from "./middleware/auth.js";
import { tenantContextPlugin } from "./middleware/tenantContext.js";
import { csrfPlugin } from "./middleware/csrf.js";
import { isDatabaseReady } from "./db/client.js";
import { COOKIES } from "./config/constants.js";
import { metricsStore } from "./modules/observability/metrics-store.js";
import { authRoutes } from "./modules/auth/routes.js";
import { mfaRoutes } from "./modules/auth/mfa-routes.js";
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
import { enterpriseSizeBandsRoutes } from "./modules/enterprise-size-bands/routes.js";
import { operatingModelsRoutes } from "./modules/operating-models/routes.js";
import { enterpriseTypingProfilesRoutes } from "./modules/enterprise-typing-profiles/routes.js";
import { blueprintFamiliesRoutes } from "./modules/blueprint-families/routes.js";
import { blueprintVariantsRoutes } from "./modules/blueprint-variants/routes.js";
import { blueprintProcessesRoutes } from "./modules/blueprint-processes/routes.js";
import { blueprintActivationsRoutes } from "./modules/blueprint-activations/routes.js";
import { blueprintOverridesRoutes } from "./modules/blueprint-overrides/routes.js";
import { processKpiTemplatesRoutes } from "./modules/process-kpi-templates/routes.js";
import { organizationUnitKpiTemplatesRoutes } from "./modules/organization-unit-kpi-templates/routes.js";
import { brownfieldSourceExportsRoutes } from "./modules/brownfield-source-exports/routes.js";
import { brownfieldImportRunsRoutes } from "./modules/brownfield-import-runs/routes.js";
import { brownfieldTableMappingsRoutes } from "./modules/brownfield-table-mappings/routes.js";
import { brownfieldWaveExecutorRoutes } from "./modules/brownfield-wave-executor/routes.js";
import { seedAcquisitionRunsRoutes } from "./modules/seed-acquisition-runs/routes.js";
import { seedCandidateRecordsRoutes } from "./modules/seed-candidate-records/routes.js";
import { seedApprovalDecisionsRoutes } from "./modules/seed-approval-decisions/routes.js";
import { meRoutes } from "./modules/me/routes.js";
import { compensationRoutes } from "./modules/compensation/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { analyticsRoutes } from "./modules/analytics/routes.js";
import { observabilityRoutes } from "./modules/observability/routes.js";
import { mentorshipRoutes } from "./modules/mentorship/routes.js";
import { semanticMatchingRoutes } from "./modules/semantic-matching/routes.js";
import type { SemanticMatchingDeps } from "./modules/semantic-matching/service.js";
import type { IMailer } from "./modules/auth/mailer.js";

export interface BuildAppOptions {
  /** Custom mailer for the auth module — tests inject InMemoryMailer. */
  authMailer?: IMailer;
  /** Semantic-matching DI seams — tests inject a non-destructive backfill + a FakeEmbedder. */
  matchingDeps?: SemanticMatchingDeps;
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
  "res.body.token",
  "res.body.refreshToken",
  "*.password",
  "*.hash",
  "*.secret",
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

  // 2. Request id (so every subsequent log/error/response carries it)
  await app.register(requestIdPlugin);

  // 2b. Request metrics — onResponse lifecycle hook feeding an in-memory store.
  //     A lifecycle hook is independent of the 13-step plugin order (§3.2); it is
  //     placed here so it wraps every subsequent route. Metrics must never break
  //     the response, so the whole body is guarded.
  app.addHook("onResponse", async (req, reply) => {
    try {
      metricsStore.record(
        reply.statusCode,
        reply.elapsedTime ?? 0,
        (req.routeOptions && req.routeOptions.url) || req.url,
      );
    } catch {
      /* metrics must never break the response */
    }
  });

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

  // 7. Rate limit (defaults; per-route overrides applied in auth module)
  await app.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.user?.userId ?? req.ip,
  });

  // 8. Auth (decorates req.user from JWT cookie when present)
  await app.register(authPlugin);

  // 9. CSRF (decorates app.verifyCsrf for per-route opt-in)
  await app.register(csrfPlugin);

  // 10. Tenant context (depends on req.user from auth plugin)
  await app.register(tenantContextPlugin);

  // 11. Error handler (catches everything that bubbled up)
  app.setErrorHandler(errorHandler);

  // 12. Health endpoints — public, no auth required
  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async () => {
    const dbReady = await isDatabaseReady();
    return {
      status: dbReady ? "ready" : "degraded",
      checks: { database: dbReady ? "ok" : "fail" },
    };
  });

  // 13. Module routes
  await app.register(authRoutes, { prefix: "/v1/auth", mailer: options.authMailer });
  await app.register(mfaRoutes, { prefix: "/v1/auth/mfa" });
  await app.register(tenantsRoutes, { prefix: "/v1/tenants" });
  await app.register(usersRoutes, { prefix: "/v1/users" });
  await app.register(positionsRoutes, { prefix: "/v1/positions" });
  await app.register(organizationUnitsRoutes, { prefix: "/v1/organization-units" });
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
  await app.register(enterpriseSizeBandsRoutes, { prefix: "/v1/enterprise-size-bands" });
  await app.register(operatingModelsRoutes, { prefix: "/v1/operating-models" });
  await app.register(enterpriseTypingProfilesRoutes, { prefix: "/v1/enterprise-typing-profiles" });
  await app.register(blueprintFamiliesRoutes, { prefix: "/v1/blueprint-families" });
  await app.register(blueprintVariantsRoutes, { prefix: "/v1/blueprint-variants" });
  await app.register(blueprintProcessesRoutes, { prefix: "/v1/blueprint-processes" });
  await app.register(blueprintActivationsRoutes, { prefix: "/v1/blueprint-activations" });
  await app.register(blueprintOverridesRoutes, { prefix: "/v1/blueprint-overrides" });
  await app.register(processKpiTemplatesRoutes, { prefix: "/v1/process-kpi-templates" });
  await app.register(organizationUnitKpiTemplatesRoutes, { prefix: "/v1/organization-unit-kpi-templates" });
  await app.register(brownfieldSourceExportsRoutes, { prefix: "/v1/brownfield-source-exports" });
  await app.register(brownfieldImportRunsRoutes, { prefix: "/v1/brownfield-import-runs" });
  await app.register(brownfieldTableMappingsRoutes, { prefix: "/v1/brownfield-table-mappings" });
  await app.register(brownfieldWaveExecutorRoutes, { prefix: "/v1/brownfield/wave-executor" });
  await app.register(seedAcquisitionRunsRoutes, { prefix: "/v1/seed-acquisition-runs" });
  await app.register(seedCandidateRecordsRoutes, { prefix: "/v1/seed-candidate-records" });
  await app.register(seedApprovalDecisionsRoutes, { prefix: "/v1/seed-approval-decisions" });
  await app.register(meRoutes, { prefix: "/v1/me" });
  await app.register(compensationRoutes, { prefix: "/v1/compensation" });
  await app.register(dashboardRoutes, { prefix: "/v1/dashboard" });
  await app.register(analyticsRoutes, { prefix: "/v1/analytics" });
  await app.register(observabilityRoutes, { prefix: "/v1/observability" });
  await app.register(mentorshipRoutes, { prefix: "/v1/mentorship" });
  await app.register(semanticMatchingRoutes, { prefix: "/v1/matching", deps: options.matchingDeps });

  return app;
}
