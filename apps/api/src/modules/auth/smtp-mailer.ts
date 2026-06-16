/**
 * apps/api/src/modules/auth/smtp-mailer.ts
 * Production SMTP mailer (nodemailer). Provider-agnostic: works with any SMTP
 * server (Amazon SES SMTP, Postmark, Mailgun, Gmail relay, self-hosted Postfix).
 *
 * The factory `makeMailer` selects SmtpMailer when SMTP_HOST + MAIL_FROM are
 * configured, otherwise it returns the dev ConsoleMailer — so an unconfigured
 * environment never hard-fails on a missing mail backend (no regression vs the
 * previous ConsoleMailer-always wiring).
 *
 * SECURITY: the EMAIL_OTP code is placed in the email body (its only legitimate
 * destination) but is NEVER logged. SmtpMailer holds no logger and nodemailer's
 * sendMail does not log the payload — the code only ever travels to the SMTP
 * server. (Mirrors the IMailer contract documented in mailer.ts.)
 */
import nodemailer, { type Transporter } from "nodemailer";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../../config/env.js";
import { ConsoleMailer, type IMailer } from "./mailer.js";

const APP_NAME = "Heuresys";

export class SmtpMailer implements IMailer {
  /** A configured SMTP transport really delivers → EMAIL_OTP is safe to enroll. */
  readonly productionCapable = true;

  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: toEmail,
      subject: `${APP_NAME} — Reimposta la tua password`,
      text:
        `Hai richiesto la reimpostazione della password.\n\n` +
        `Apri questo link per impostarne una nuova:\n${resetUrl}\n\n` +
        `Se non hai richiesto tu il reset, ignora questa email.`,
      html:
        `<p>Hai richiesto la reimpostazione della password.</p>` +
        `<p><a href="${resetUrl}">Imposta una nuova password</a></p>` +
        `<p style="color:#888">Se non hai richiesto tu il reset, ignora questa email.</p>`,
    });
  }

  async sendMfaOtpEmail(
    toEmail: string,
    code: string,
    purpose: "ENROLL" | "LOGIN" | "CONFIRM_ENROLL",
  ): Promise<void> {
    const subject =
      purpose === "ENROLL"
        ? `${APP_NAME} — Codice di verifica email`
        : purpose === "CONFIRM_ENROLL"
          ? `${APP_NAME} — Conferma il nuovo metodo di verifica`
          : `${APP_NAME} — Codice di accesso`;
    const intro =
      purpose === "ENROLL"
        ? "Conferma il tuo indirizzo email inserendo questo codice di verifica:"
        : purpose === "CONFIRM_ENROLL"
          ? "Stai attivando un nuovo metodo di verifica in due passaggi. Conferma con questo codice:"
          : "Usa questo codice per completare l'accesso:";
    await this.transporter.sendMail({
      from: this.from,
      to: toEmail,
      subject,
      text: `${intro}\n\n${code}\n\nIl codice scade tra 10 minuti. Se non sei stato tu, ignora questa email.`,
      html:
        `<p>${intro}</p>` +
        `<p style="font-size:24px;font-weight:bold;letter-spacing:3px">${code}</p>` +
        `<p style="color:#888">Il codice scade tra 10 minuti. Se non sei stato tu, ignora questa email.</p>`,
    });
  }

  async sendMfaFactorEnrolledNotice(toEmail: string, kind: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: toEmail,
      subject: `${APP_NAME} — Nuovo metodo di verifica aggiunto al tuo account`,
      text:
        `Un nuovo metodo di verifica in due passaggi (${kind}) è stato aggiunto al tuo account.\n\n` +
        `Se non sei stato tu, contatta subito il tuo amministratore e reimposta la password.`,
      html:
        `<p>Un nuovo metodo di verifica in due passaggi (<b>${kind}</b>) è stato aggiunto al tuo account.</p>` +
        `<p style="color:#888">Se non sei stato tu, contatta subito il tuo amministratore e reimposta la password.</p>`,
    });
  }

  async sendNotificationDigest(toEmail: string, unreadCount: number): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: toEmail,
      subject: `${APP_NAME} — Hai ${unreadCount} notifiche non lette`,
      text: `Hai ${unreadCount} notifiche non lette nel tuo spazio. Accedi per consultarle.`,
      html: `<p>Hai <b>${unreadCount}</b> notifiche non lette nel tuo spazio. Accedi per consultarle.</p>`,
    });
  }
}

/** Minimal SMTP config shape (subset of the parsed env), explicit for testability. */
export interface SmtpConfig {
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: number | undefined;
  SMTP_SECURE?: boolean | undefined;
  SMTP_USER?: string | undefined;
  SMTP_PASSWORD?: string | undefined;
  MAIL_FROM?: string | undefined;
}

/**
 * Build the mailer for buildApp: a real SmtpMailer when SMTP_HOST + MAIL_FROM
 * are configured, otherwise the dev ConsoleMailer (no hard-fail on a missing
 * backend). `cfg` defaults to the parsed env; tests pass an explicit config to
 * exercise both branches without mutating process.env.
 */
export function makeMailer(log: FastifyBaseLogger, cfg: SmtpConfig = env): IMailer {
  if (cfg.SMTP_HOST && cfg.MAIL_FROM) {
    const transporter = nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT ?? 587,
      secure: cfg.SMTP_SECURE ?? false,
      ...(cfg.SMTP_USER
        ? { auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASSWORD ?? "" } }
        : {}),
    });
    return new SmtpMailer(transporter, cfg.MAIL_FROM);
  }
  return new ConsoleMailer(log);
}
