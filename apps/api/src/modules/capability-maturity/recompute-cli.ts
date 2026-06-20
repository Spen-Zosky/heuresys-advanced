/**
 * apps/api/src/modules/capability-maturity/recompute-cli.ts
 * Maturity scheduled-recompute CLI-bypass entrypoint for a systemd timer.
 *
 *   pnpm --filter @heuresys/api capability-maturity:recompute
 *
 * Derives L0..L5 levels for ALL active tenants IN-PROCESS from the MLCE composite
 * — no HTTP, no auth/CSRF. PLATFORM-scoped via a synthetic system actor. Bounded
 * per-tenant delete-then-insert (D-18). Run it AFTER the MLCE recompute.
 * Mirrors insights/recompute-cli.ts.
 */
import { pool } from "../../db/client.js";
import { capabilityMaturityService, type ActorContext } from "./service.js";

const log = (o: Record<string, unknown>): void =>
  console.log(JSON.stringify({ cli: "capability-maturity-recompute", ...o }));

const SYSTEM_ACTOR: ActorContext = {
  userId: "00000000-0000-0000-0000-000000000000",
  tenantId: null,
  roles: ["PLATFORM_ADMIN"],
};

export async function runCapabilityMaturityRecomputeCli(): Promise<void> {
  const started = Date.now();
  const r = await capabilityMaturityService.recompute(SYSTEM_ACTOR);
  log({ phase: "done", scored: r.scored, modelVersion: r.modelVersion, rubricVersion: r.rubricVersion, ms: Date.now() - started });
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("recompute-cli.ts") || invoked.endsWith("recompute-cli.js")) {
  runCapabilityMaturityRecomputeCli()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("capability-maturity-recompute CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
