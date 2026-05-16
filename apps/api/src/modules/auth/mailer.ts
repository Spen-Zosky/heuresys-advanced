/**
 * apps/api/src/modules/auth/mailer.ts
 * Minimal mailer abstraction for password-reset emails.
 *
 * MVP-1 ships with ConsoleMailer (logs a clear DEV-ONLY warning and the URL
 * — useful for local development without an SMTP server) and InMemoryMailer
 * (used by integration tests to assert on what would have been sent).
 *
 * Production must swap in a real implementation (SES / Postmark / SMTP)
 * before launch. The IMailer surface is intentionally minimal so the swap
 * stays trivial.
 */

import type { FastifyBaseLogger } from "fastify";

export interface IMailer {
  sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void>;
}

/**
 * Development mailer: emits a warn-level log containing the reset URL.
 * Pino does NOT redact this URL — by design, so a developer can copy-paste
 * it. Never use this in production.
 */
export class ConsoleMailer implements IMailer {
  constructor(private readonly log: FastifyBaseLogger) {}

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    this.log.warn(
      { toEmail, resetUrl, mailer: "ConsoleMailer" },
      "[DEV_ONLY] Password-reset URL would be emailed to user. " +
        "Production must replace ConsoleMailer with a real SMTP/transactional mailer.",
    );
  }
}

/**
 * Test mailer: stores every send in-memory so integration tests can assert
 * on the URL/email without touching network.
 */
export interface SentEmail {
  toEmail: string;
  resetUrl: string;
}

export class InMemoryMailer implements IMailer {
  public readonly sent: SentEmail[] = [];

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    this.sent.push({ toEmail, resetUrl });
  }

  clear(): void {
    this.sent.length = 0;
  }
}
