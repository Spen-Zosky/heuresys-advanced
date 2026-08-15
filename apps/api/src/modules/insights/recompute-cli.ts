/**
 * apps/api/src/modules/insights/recompute-cli.ts
 * Cap③ data-mining — scheduled-recompute CLI-bypass entrypoint for the systemd timer.
 *
 *   pnpm --filter @heuresys/api insights:recompute
 *
 * Recomputes all three in-platform insight score slices (flight-risk, succession-
 * readiness, skill-gap) IN-PROCESS against the DB — no HTTP, no auth/CSRF (the
 * scheduler is a clock, not a user). Runs PLATFORM-scoped (all tenants, all subjects)
 * via a synthetic system actor. Each recompute is a bounded delete-then-insert (D-18)
 * → re-running never grows the score tables. The production serving API never runs
 * this; it is invoked only by `heuresys-advanced-insights.timer` (or manually by an
 * operator). Mirrors the reference-sync CLI pattern (sync-cli.ts).
 */
import { pool } from "../../db/client.js";
import { insightsService, type ActorContext } from "./service.js";

const log = (o: Record<string, unknown>): void =>
  console.log(JSON.stringify({ cli: "insights-recompute", ...o }));

// Synthetic system actor: PLATFORM scope (all tenants / all subjects). The NIL-UUID
// userId is never read for PLATFORM scope — buildScope() only resolves a userId for
// TEAM scope (posizioniNelPerimetroOrganizzativo). No FK/audit row references the actor.
const SYSTEM_ACTOR: ActorContext = {
  userId: "00000000-0000-0000-0000-000000000000",
  tenantId: null,
  roles: ["PLATFORM_ADMIN"],
};

export interface InsightsRecomputeCliResult {
  flightRisk: number;
  successionReadiness: number;
  skillGap: number;
}

export async function runInsightsRecomputeCli(): Promise<InsightsRecomputeCliResult> {
  const started = Date.now();
  // Sequential (each scans the DB; serial avoids pool contention and is fast enough).
  const fr = await insightsService.recompute(SYSTEM_ACTOR);
  log({ phase: "flight-risk", scored: fr.scored, modelVersion: fr.modelVersion });
  const sr = await insightsService.recomputeReadiness(SYSTEM_ACTOR);
  log({ phase: "succession-readiness", scored: sr.scored, modelVersion: sr.modelVersion });
  const sg = await insightsService.recomputeSkillGap(SYSTEM_ACTOR);
  log({ phase: "skill-gap", scored: sg.scored, modelVersion: sg.modelVersion });
  const out: InsightsRecomputeCliResult = {
    flightRisk: fr.scored,
    successionReadiness: sr.scored,
    skillGap: sg.scored,
  };
  log({ phase: "done", ...out, ms: Date.now() - started });
  return out;
}

// Run when invoked directly (tsx). Closes the pool so the process exits cleanly.
const invoked = process.argv[1] ?? "";
if (invoked.endsWith("recompute-cli.ts") || invoked.endsWith("recompute-cli.js")) {
  runInsightsRecomputeCli()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("insights-recompute CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
