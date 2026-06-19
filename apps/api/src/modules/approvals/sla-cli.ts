/**
 * apps/api/src/modules/approvals/sla-cli.ts
 * 3.3 BPM approval-flow slice-3b — scheduled CLI-bypass entrypoint for the systemd timer.
 *
 *   pnpm --filter @heuresys/api approvals:sla
 *
 * Scans overdue PENDING approval steps IN-PROCESS — no HTTP/auth (the scheduler is a
 * clock, not a user) — emitting reminder/overdue in-app notifications and escalating
 * past the threshold. In-app delivery is fully functional without SMTP. Invoked only
 * by heuresys-advanced-approvals-sla.timer (or manually by an operator). Mirrors the
 * notifications digest CLI.
 */
import { pool } from "../../db/client.js";
import { runApprovalSla } from "./sla.js";

export async function runApprovalSlaCli(): Promise<{
  stepsScanned: number;
  remindersEmitted: number;
  escalated: number;
}> {
  const r = await runApprovalSla(pool);
  console.log(JSON.stringify({ cli: "approvals-sla", ...r }));
  return r;
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("sla-cli.ts") || invoked.endsWith("sla-cli.js")) {
  runApprovalSlaCli()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("approvals-sla CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
