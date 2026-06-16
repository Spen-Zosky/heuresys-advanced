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
  /**
   * True when this mailer can really deliver to a user's inbox (SmtpMailer with
   * SMTP_HOST+MAIL_FROM configured / InMemoryMailer in tests). False for the dev
   * ConsoleMailer, whose "emails" only land in server logs. Drives EMAIL_OTP
   * enrollability: offering EMAIL_OTP without a real transport would lock real
   * users out (codes they never receive) — mirrors ISmsSender.productionCapable.
   */
  readonly productionCapable: boolean;
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
    purpose: "ENROLL" | "LOGIN" | "CONFIRM_ENROLL",
  ): Promise<void>;
  /**
   * Security notification: a new MFA method was added to the account (TOFU v2).
   * Best-effort — callers must not fail the enrollment if this send fails.
   */
  sendMfaFactorEnrolledNotice(toEmail: string, kind: string): Promise<void>;
  /**
   * 3.4 notification digest: a periodic summary of unread in-app notifications.
   * Best-effort (the scheduler must not fail on a send error). Gated on SMTP creds
   * in production (SmtpMailer); ConsoleMailer logs it; InMemoryMailer captures it.
   */
  sendNotificationDigest(toEmail: string, unreadCount: number): Promise<void>;
}

/**
 * Development mailer: emits a warn-level log containing the reset URL.
 * Pino does NOT redact this URL — by design, so a developer can copy-paste
 * it. Never use this in production.
 */
export class ConsoleMailer implements IMailer {
  /** Logs instead of delivering — NOT a real channel, so EMAIL_OTP stays off. */
  readonly productionCapable = false;

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
    purpose: "ENROLL" | "LOGIN" | "CONFIRM_ENROLL",
  ): Promise<void> {
    // SECURITY (F-WS-H1-5): the OTP code is NEVER logged — not as a structured
    // field nor in the message string. The earlier `devOnlyCode: code` field was
    // redundant (pino `*.devOnlyCode` redacted it in the live server anyway) yet
    // it leaked the plaintext OTP through the raw-console fallback mailer
    // (defaultMfaMailer, which bypasses pino redaction). Dropped. We log only the
    // destination + purpose; the code is read from the DB challenge / InMemoryMailer
    // in tests. Pino `*.code`/`*.otp`/`*.devOnlyCode` redaction stays as defense.
    void code; // never logged — see above
    this.log.warn(
      { toEmail, purpose, mailer: "ConsoleMailer" },
      "[DEV_ONLY] MFA EMAIL_OTP code would be emailed to user. " +
        "Production must replace ConsoleMailer with a real SMTP/transactional mailer.",
    );
  }

  async sendMfaFactorEnrolledNotice(toEmail: string, kind: string): Promise<void> {
    this.log.warn(
      { toEmail, kind, mailer: "ConsoleMailer" },
      "[DEV_ONLY] 'New MFA method added' notice would be emailed to user.",
    );
  }

  async sendNotificationDigest(toEmail: string, unreadCount: number): Promise<void> {
    this.log.warn(
      { toEmail, unreadCount, mailer: "ConsoleMailer" },
      "[DEV_ONLY] Notification digest would be emailed to user.",
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
  purpose: "ENROLL" | "LOGIN" | "CONFIRM_ENROLL";
}

export interface SentFactorNotice {
  toEmail: string;
  kind: string;
}

export interface SentDigest {
  toEmail: string;
  unreadCount: number;
}

export class InMemoryMailer implements IMailer {
  /** Tests assert on captured mail, so EMAIL_OTP must stay enrollable. */
  readonly productionCapable = true;

  public readonly sent: SentEmail[] = [];
  /** MFA EMAIL_OTP codes captured for test assertions (read the latest .code). */
  public readonly sentOtps: SentMfaOtp[] = [];
  /** "New MFA method added" notices captured for test assertions (TOFU v2). */
  public readonly sentNotices: SentFactorNotice[] = [];
  /** Notification digests captured for test assertions (3.4). */
  public readonly sentDigests: SentDigest[] = [];

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    this.sent.push({ toEmail, resetUrl });
  }

  async sendMfaOtpEmail(
    toEmail: string,
    code: string,
    purpose: "ENROLL" | "LOGIN" | "CONFIRM_ENROLL",
  ): Promise<void> {
    this.sentOtps.push({ toEmail, code, purpose });
  }

  async sendMfaFactorEnrolledNotice(toEmail: string, kind: string): Promise<void> {
    this.sentNotices.push({ toEmail, kind });
  }

  async sendNotificationDigest(toEmail: string, unreadCount: number): Promise<void> {
    this.sentDigests.push({ toEmail, unreadCount });
  }

  /** Returns the most recently emailed OTP code (test seam), or null. */
  lastOtpCode(): string | null {
    return this.sentOtps[this.sentOtps.length - 1]?.code ?? null;
  }

  clear(): void {
    this.sent.length = 0;
    this.sentOtps.length = 0;
    this.sentNotices.length = 0;
  }
}
