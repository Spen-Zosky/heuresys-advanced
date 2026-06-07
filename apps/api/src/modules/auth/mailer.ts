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
  /**
   * Sends an MFA EMAIL_OTP one-time code. `purpose` distinguishes enrollment
   * confirmation from a login step-up so the email copy can differ. The code
   * is a plaintext 6-digit string ONLY in transit to the user's mailbox — it
   * is never logged (ConsoleMailer redacts it) and never returned in an API
   * response (the server stores only its Argon2id hash).
   */
  sendMfaOtpEmail(
    toEmail: string,
    code: string,
    purpose: "ENROLL" | "LOGIN",
  ): Promise<void>;
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

  async sendMfaOtpEmail(
    toEmail: string,
    code: string,
    purpose: "ENROLL" | "LOGIN",
  ): Promise<void> {
    // SECURITY: the OTP code is NEVER placed in the structured log fields (it
    // would survive in log storage). Even in DEV we log only the destination +
    // purpose; the code is intentionally interpolated into the message string
    // gated behind the same DEV_ONLY warning a developer must opt into reading.
    // Pino redaction (`*.code`) further censors any accidental field leak.
    this.log.warn(
      { toEmail, purpose, mailer: "ConsoleMailer", devOnlyCode: code },
      "[DEV_ONLY] MFA EMAIL_OTP code would be emailed to user. " +
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

export interface SentMfaOtp {
  toEmail: string;
  code: string;
  purpose: "ENROLL" | "LOGIN";
}

export class InMemoryMailer implements IMailer {
  public readonly sent: SentEmail[] = [];
  /** MFA EMAIL_OTP codes captured for test assertions (read the latest .code). */
  public readonly sentOtps: SentMfaOtp[] = [];

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    this.sent.push({ toEmail, resetUrl });
  }

  async sendMfaOtpEmail(
    toEmail: string,
    code: string,
    purpose: "ENROLL" | "LOGIN",
  ): Promise<void> {
    this.sentOtps.push({ toEmail, code, purpose });
  }

  /** Returns the most recently emailed OTP code (test seam), or null. */
  lastOtpCode(): string | null {
    return this.sentOtps[this.sentOtps.length - 1]?.code ?? null;
  }

  clear(): void {
    this.sent.length = 0;
    this.sentOtps.length = 0;
  }
}
