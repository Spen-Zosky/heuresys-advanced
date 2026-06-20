/**
 * apps/api/src/modules/capability-composition/recompute-cli.ts
 * MLCE scheduled-recompute CLI-bypass entrypoint for a systemd timer.
 *
 *   pnpm --filter @heuresys/api capability:recompute
 *
 * Recomputes the capability composite for ALL active tenants IN-PROCESS — no HTTP,
 * no auth/CSRF (the scheduler is a clock). Runs PLATFORM-scoped via a synthetic
 * system actor. Each recompute is a bounded per-tenant delete-then-insert (D-18) →
 * re-running never grows the score/lineage tables. Mirrors insights/recompute-cli.ts.
 */
import { pool } from "../../db/client.js";
import { capabilityCompositionService, type ActorContext } from "./service.js";

const log = (o: Record<string, unknown>): void =>
  console.log(JSON.stringify({ cli: "capability-recompute", ...o }));

// Synthetic system actor: PLATFORM scope (all active tenants). The NIL-UUID userId
// is never read for PLATFORM scope. No FK/audit row references the actor.
const SYSTEM_ACTOR: ActorContext = {
  userId: "00000000-0000-0000-0000-000000000000",
  tenantId: null,
  roles: ["PLATFORM_ADMIN"],
};

export async function runCapabilityRecomputeCli(): Promise<void> {
  const started = Date.now();
  const r = await capabilityCompositionService.recompute(SYSTEM_ACTOR);
  log({ phase: "done", ...r.scored, modelVersion: r.modelVersion, ms: Date.now() - started });
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("recompute-cli.ts") || invoked.endsWith("recompute-cli.js")) {
  runCapabilityRecomputeCli()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("capability-recompute CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
