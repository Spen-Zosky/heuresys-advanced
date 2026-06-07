/**
 * apps/api/test/smtp-mailer.test.ts
 * Unit tests for the production SMTP mailer. No network: a capturing nodemailer
 * Transport records the outgoing message so we can assert the reset URL / OTP
 * code reach the body, and that the factory selects SMTP vs Console by env.
 */
import { describe, it, expect } from "vitest";
import nodemailer, { type Transport, type SentMessageInfo } from "nodemailer";
import type { FastifyBaseLogger } from "fastify";
import { SmtpMailer, makeMailer } from "../src/modules/auth/smtp-mailer.js";
import { ConsoleMailer } from "../src/modules/auth/mailer.js";

interface Captured {
  from?: unknown;
  to?: unknown;
  subject?: unknown;
  text?: unknown;
  html?: unknown;
}

function capturing(): { mailer: SmtpMailer; sink: Captured[] } {
  const sink: Captured[] = [];
  const transport: Transport = {
    name: "capture",
    version: "1.0.0",
    send(mail, callback) {
      const d = mail.data;
      sink.push({ from: d.from, to: d.to, subject: d.subject, text: d.text, html: d.html });
      callback(null, {} as unknown as SentMessageInfo);
    },
  };
  return {
    mailer: new SmtpMailer(nodemailer.createTransport(transport), "Heuresys <noreply@heuresys.com>"),
    sink,
  };
}

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

describe("SmtpMailer", () => {
  it("password-reset email carries the reset URL", async () => {
    const { mailer, sink } = capturing();
    const url = "https://app.heuresys.com/reset?token=abc123";
    await mailer.sendPasswordResetEmail("user@example.com", url);
    expect(sink).toHaveLength(1);
    const m = sink[0]!;
    expect(m.to).toBe("user@example.com");
    expect(String(m.from)).toContain("noreply@heuresys.com");
    expect(String(m.subject)).toBeTruthy();
    expect(`${String(m.text)}${String(m.html)}`).toContain(url);
  });

  it("EMAIL_OTP enrollment email carries the code + enrollment-flavored subject", async () => {
    const { mailer, sink } = capturing();
    await mailer.sendMfaOtpEmail("user@example.com", "123456", "ENROLL");
    const m = sink[0]!;
    expect(`${String(m.text)}${String(m.html)}`).toContain("123456");
    expect(String(m.subject).toLowerCase()).toMatch(/verif/);
  });

  it("EMAIL_OTP login email carries the code + login-flavored subject", async () => {
    const { mailer, sink } = capturing();
    await mailer.sendMfaOtpEmail("user@example.com", "654321", "LOGIN");
    const m = sink[0]!;
    expect(`${String(m.text)}${String(m.html)}`).toContain("654321");
    expect(String(m.subject).toLowerCase()).toMatch(/access/);
  });
});

describe("makeMailer factory", () => {
  it("returns SmtpMailer when SMTP_HOST + MAIL_FROM are configured", () => {
    const m = makeMailer(noopLog, {
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      MAIL_FROM: "Heuresys <noreply@heuresys.com>",
    });
    expect(m).toBeInstanceOf(SmtpMailer);
  });

  it("falls back to ConsoleMailer when SMTP is not configured", () => {
    const m = makeMailer(noopLog, {});
    expect(m).toBeInstanceOf(ConsoleMailer);
  });
});
