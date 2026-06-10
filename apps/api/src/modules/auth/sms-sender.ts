/**
 * apps/api/src/modules/auth/sms-sender.ts
 * SMS provider seam for the SMS_OTP MFA factor (MVP-4 §2.5, code-only slice).
 *
 * Mirrors the mailer seam (mailer.ts / smtp-mailer.ts): ConsoleSms for dev,
 * InMemorySms for tests, and a `makeSmsSender` factory that will select a real
 * provider (e.g. Twilio) once one is configured. No real provider ships in this
 * slice — PROD activation is gated on the provider + cost decision (PM).
 *
 * `productionCapable` gates the user-facing surface: when false (ConsoleSms),
 * SMS_OTP is excluded from the enrollment `allowedKinds` and the enroll
 * endpoint returns a typed 404 SMS_NOT_CONFIGURED — codes that only land in
 * server logs would lock real users out, so the kind stays invisible until a
 * deliverable provider exists. (Mirrors the MATCHING_FREETEXT_DISABLED pattern.)
 *
 * SECURITY: the OTP code's only legitimate destination is the user's phone.
 * ConsoleSms logs it ONLY behind the DEV_ONLY warning (same contract as
 * ConsoleMailer); pino redaction (`*.code`) censors accidental field leaks.
 */

import type { FastifyBaseLogger } from "fastify";
import { env } from "../../config/env.js";

export type SmsOtpPurpose = "ENROLL" | "LOGIN";

export interface ISmsSender {
  /**
   * True when this sender can deliver to a real phone. Gates enrollment
   * availability (allowedKinds + enroll endpoint).
   */
  readonly productionCapable: boolean;
  sendMfaOtpSms(toPhone: string, code: string, purpose: SmsOtpPurpose): Promise<void>;
}

/** Development sender: logs the would-be SMS. NOT production capable. */
export class ConsoleSms implements ISmsSender {
  readonly productionCapable = false;

  constructor(private readonly log: FastifyBaseLogger) {}

  async sendMfaOtpSms(toPhone: string, code: string, purpose: SmsOtpPurpose): Promise<void> {
    this.log.warn(
      { toPhone, purpose, sender: "ConsoleSms", devOnlyCode: code },
      "[DEV_ONLY] MFA SMS_OTP code would be sent to phone. " +
        "Production must configure a real SMS provider (SMS_PROVIDER env).",
    );
  }
}

export interface SentSmsOtp {
  toPhone: string;
  code: string;
  purpose: SmsOtpPurpose;
}

/**
 * Test sender: records every send in-memory so integration tests can assert on
 * the code. Production-capable by default (tests exercise the full flow);
 * construct with `new InMemorySms(false)` to exercise the not-configured gate.
 */
export class InMemorySms implements ISmsSender {
  public readonly sentOtps: SentSmsOtp[] = [];

  constructor(public readonly productionCapable: boolean = true) {}

  async sendMfaOtpSms(toPhone: string, code: string, purpose: SmsOtpPurpose): Promise<void> {
    this.sentOtps.push({ toPhone, code, purpose });
  }

  /** Returns the most recently sent OTP code (test seam), or null. */
  lastOtpCode(): string | null {
    return this.sentOtps[this.sentOtps.length - 1]?.code ?? null;
  }

  clear(): void {
    this.sentOtps.length = 0;
  }
}

/** Minimal SMS config shape (subset of the parsed env), explicit for testability. */
export interface SmsConfig {
  SMS_PROVIDER?: string | undefined;
  SMS_FROM?: string | undefined;
}

/**
 * Build the SMS sender for buildApp. No real provider is implemented in the
 * code-only slice: any configured SMS_PROVIDER logs a loud warning and falls
 * back to ConsoleSms (never hard-fails). When a provider lands (e.g. "twilio"),
 * this factory is the single switch point.
 */
export function makeSmsSender(log: FastifyBaseLogger, cfg: SmsConfig = env): ISmsSender {
  if (cfg.SMS_PROVIDER) {
    log.warn(
      { smsProvider: cfg.SMS_PROVIDER },
      "SMS_PROVIDER is set but no real SMS provider is implemented yet (code-only slice) — " +
        "falling back to ConsoleSms; SMS_OTP enrollment stays disabled.",
    );
  }
  return new ConsoleSms(log);
}
