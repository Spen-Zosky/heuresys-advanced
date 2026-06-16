/**
 * Unit (no-DB): EMAIL_OTP enrollability must be gated on a real mail transport,
 * exactly like SMS_OTP is gated on a production-capable SMS sender. Without an
 * SMTP backend the OTP code only lands in server logs, so offering EMAIL_OTP
 * would let a real user lock themselves out. MFA stays fully operable on
 * TOTP + WEBAUTHN with no email backend at all.
 *
 * Aspect-1 workaround (S993): "no SMTP provider for mail/MFA".
 */
import { describe, it, expect } from "vitest";
import { createMfaService } from "../src/modules/auth/mfa-service.js";
import { makeMailer } from "../src/modules/auth/smtp-mailer.js";
import { ConsoleMailer, InMemoryMailer, type IMailer } from "../src/modules/auth/mailer.js";
import type { ISmsSender } from "../src/modules/auth/sms-sender.js";
import type { FastifyBaseLogger } from "fastify";

const noopLog = {
  warn() {},
  info() {},
  error() {},
  debug() {},
  fatal() {},
  trace() {},
  child() {
    return noopLog;
  },
} as unknown as FastifyBaseLogger;

const smsOff = { productionCapable: false } as unknown as ISmsSender;

describe("EMAIL_OTP enrollability gated on a real mail transport (anti-lockout)", () => {
  it("hides EMAIL_OTP when the mailer cannot deliver (ConsoleMailer / no SMTP)", () => {
    const svc = createMfaService({
      mailer: { productionCapable: false } as unknown as IMailer,
      smsSender: smsOff,
    });
    expect(svc.enrollableKinds()).toEqual(["TOTP", "WEBAUTHN"]);
  });

  it("offers EMAIL_OTP when the mailer can deliver (SMTP / InMemory in tests)", () => {
    const svc = createMfaService({
      mailer: { productionCapable: true } as unknown as IMailer,
      smsSender: smsOff,
    });
    expect(svc.enrollableKinds()).toContain("EMAIL_OTP");
  });

  it("InMemoryMailer is production-capable (keeps the EMAIL_OTP suites green)", () => {
    expect(new InMemoryMailer().productionCapable).toBe(true);
  });

  it("makeMailer → ConsoleMailer (not production-capable) when SMTP is unconfigured", () => {
    const m = makeMailer(noopLog, {});
    expect(m).toBeInstanceOf(ConsoleMailer);
    expect(m.productionCapable).toBe(false);
  });

  it("makeMailer → production-capable SmtpMailer when SMTP_HOST + MAIL_FROM are set", () => {
    const m = makeMailer(noopLog, {
      SMTP_HOST: "smtp.example.com",
      MAIL_FROM: "no-reply@example.com",
    });
    expect(m.productionCapable).toBe(true);
    expect(m).not.toBeInstanceOf(ConsoleMailer);
  });
});
