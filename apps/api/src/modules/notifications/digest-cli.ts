/**
 * apps/api/src/modules/notifications/digest-cli.ts
 * 3.4 notification digest — scheduled CLI-bypass entrypoint for the systemd timer.
 *
 *   pnpm --filter @heuresys/api notifications:digest
 *
 * Sends each opted-in user a digest of their UNREAD in-app notifications IN-PROCESS
 * — no HTTP/auth (the scheduler is a clock, not a user). makeMailer returns a real
 * SmtpMailer when SMTP creds are configured, otherwise a ConsoleMailer (logs intent,
 * no send) — so the digest is a chassis until SMTP is provisioned. Invoked only by
 * heuresys-advanced-notifications-digest.timer (or manually by an operator). Mirrors
 * the insights recompute-cli pattern.
 */
import type { FastifyBaseLogger } from "fastify";
import { pool } from "../../db/client.js";
import { runDigest } from "../../lib/notifications/digest.js";
import { makeMailer } from "../auth/smtp-mailer.js";

// Console-backed logger (no Fastify instance in a CLI run).
const consoleLog = {
  warn: (...a: unknown[]) => console.warn(...a),
  info: () => {},
  error: (...a: unknown[]) => console.error(...a),
  debug: () => {},
  fatal: (...a: unknown[]) => console.error(...a),
  trace: () => {},
  child: () => consoleLog,
} as unknown as FastifyBaseLogger;

export async function runDigestCli(): Promise<{ digestsSent: number; recipients: number }> {
  const mailer = makeMailer(consoleLog); // SmtpMailer if configured, else ConsoleMailer (gated)
  const r = await runDigest(pool, mailer);
  console.log(JSON.stringify({ cli: "notifications-digest", ...r }));
  return r;
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("digest-cli.ts") || invoked.endsWith("digest-cli.js")) {
  runDigestCli()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("notifications-digest CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
