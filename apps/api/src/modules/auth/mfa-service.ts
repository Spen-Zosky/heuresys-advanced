/**
 * apps/api/src/modules/auth/mfa-service.ts
 *
 * MFA service. Today supports TOTP (RFC 6238) via the `otpauth` lib. The
 * factor schema is multi-kind (TOTP/WEBAUTHN/EMAIL_OTP/SMS_OTP) so future
 * kinds plug in here without touching the route or repo layer.
 *
 * The challenge store is in-memory single-process. When the API runs
 * multi-process (PM2 cluster / k8s replicas) replace it with Redis. The
 * interface (`MfaChallengeStore`) is stable so the swap is local.
 *
 * TOTP secrets are encrypted-at-rest (AES-256-GCM) at the repository boundary
 * (QW-SEC6 — modules/auth/secret-crypto.ts + mfa-repository.ts). The service
 * layer always sees the PLAINTEXT base32 (mapRow decrypts on read), so the
 * TOTP build/validate code below is unchanged. Encryption is gated on
 * MFA_ENCRYPTION_KEY presence (non-breaking) and the schema column type
 * (`text`) accepts the enc:v1:… ciphertext without a migration. Legacy
 * plaintext rows are lazily upgraded to ciphertext on a successful read+use
 * (needsRehash-style, best-effort — never blocks verify).
 */

import { randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import * as OTPAuth from "otpauth";
import { pool } from "../../db/client.js";
import { env } from "../../config/env.js";
import { insertLoginEvent } from "./repository.js";
import {
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "../../errors/index.js";
import { hashPassword, verifyPassword } from "./password.js";
import { sha256Hex } from "./tokens.js";
import type { IMailer } from "./mailer.js";
import { ConsoleMailer } from "./mailer.js";
import type { ISmsSender } from "./sms-sender.js";
import { ConsoleSms } from "./sms-sender.js";
import * as mfaRepo from "./mfa-repository.js";

/* --- recovery codes (MVP-4 §2.5) -------------------------------------- */
const RECOVERY_CODE_COUNT = 10;
/** 16 hex chars (64-bit), grouped for readability. */
function generateRecoveryCodePlain(): string {
  const hex = randomBytes(8).toString("hex"); // 16 lowercase hex chars
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}
/** Strip separators + lowercase so display ("ab12-...") and raw ("ab12...") hash identically. */
function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

/**
 * QW-SEC6: metadata.label of the committed demo-grade TOTP fixture factors
 * (the 6 seeded personas). MUST mirror helpers/mfa-fixture-secrets.ts
 * E2E_FIXTURE_LABEL (kept as a literal here — src must not import from test/).
 * These factors are intentionally PLAINTEXT (committed base32 seeds drive PROD
 * smoke / CI / Playwright) and are owned by the controlled bulk-encrypt, so
 * lazy re-encryption (verifyLoginChallenge) explicitly skips them.
 */
const FIXTURE_FACTOR_LABEL = "e2e-fixture";

const TOTP_ISSUER = "Heuresys";
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;
const TOTP_ALGORITHM = "SHA1";
const TOTP_WINDOW = 1; // ±30s tolerance for clock drift

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/* --- EMAIL_OTP policy ----------------------------------------------- */
/** Code lifetime: short window to limit the brute-force surface. */
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
/** Max wrong attempts before the challenge is invalidated (forces re-issue). */
const EMAIL_OTP_MAX_ATTEMPTS = 5;
/** Minimum seconds between two issuances for the same factor+purpose (anti-spam). */
const EMAIL_OTP_RESEND_COOLDOWN_MS = 30 * 1000;

interface ChallengeEntry {
  userId: string;
  expiresAt: number;
}

export interface MfaChallengeStore {
  /** Create a one-shot challenge token; returns the opaque token. */
  create(userId: string, now?: number): string;
  /** Consume + validate. Returns userId if valid, throws if not. */
  consume(token: string, now?: number): string;
  /**
   * Validate WITHOUT consuming. Returns userId if valid, throws if not.
   * Used by EMAIL_OTP resend so requesting a fresh code does not burn the
   * step-2 token.
   */
  peek(token: string, now?: number): string;
  /** Test-only: clear all challenges. */
  reset(): void;
}

export function createInMemoryChallengeStore(): MfaChallengeStore {
  const entries = new Map<string, ChallengeEntry>();

  function sweepExpired(now: number): void {
    for (const [k, v] of entries.entries()) {
      if (v.expiresAt <= now) entries.delete(k);
    }
  }

  return {
    create(userId, now = Date.now()) {
      sweepExpired(now);
      const token = randomBytes(32).toString("base64url");
      entries.set(token, { userId, expiresAt: now + CHALLENGE_TTL_MS });
      return token;
    },
    consume(token, now = Date.now()) {
      sweepExpired(now);
      const entry = entries.get(token);
      if (!entry) {
        throw new UnauthorizedError("Invalid or expired MFA challenge", "MFA_CHALLENGE_INVALID");
      }
      entries.delete(token); // one-shot
      if (entry.expiresAt <= now) {
        throw new UnauthorizedError("MFA challenge expired", "MFA_CHALLENGE_EXPIRED");
      }
      return entry.userId;
    },
    peek(token, now = Date.now()) {
      sweepExpired(now);
      const entry = entries.get(token);
      if (!entry || entry.expiresAt <= now) {
        throw new UnauthorizedError("Invalid or expired MFA challenge", "MFA_CHALLENGE_INVALID");
      }
      return entry.userId;
    },
    reset() {
      entries.clear();
    },
  };
}

export const sharedMfaChallengeStore: MfaChallengeStore = createInMemoryChallengeStore();

/* --- TOTP helpers --------------------------------------------------- */

function buildTotp(secretBase32: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

function verifyTotpCode(secretBase32: string, code: string, now?: number): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = buildTotp(secretBase32);
  const delta = totp.validate({ token: code, window: TOTP_WINDOW, timestamp: now });
  return delta !== null;
}

/* --- EMAIL_OTP helpers ---------------------------------------------- */

/**
 * Generates a cryptographically-strong 6-digit numeric code using the CSPRNG
 * (crypto.randomInt) — NEVER Math.random. Range [0, 1_000_000) zero-padded to
 * 6 digits gives uniform 000000..999999.
 */
function generateEmailOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Mask an email for safe display: keep first char + domain (a***@host). */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 1);
  return `${head}***${domain}`;
}

/**
 * SMS_OTP enrollment is OFF without a production-capable provider → 404 with
 * the precise code SMS_NOT_CONFIGURED (the kind is effectively absent for the
 * caller). Subclasses NotFoundError so the errorHandler maps it to 404, but
 * carries its own stable code (mirrors FreeTextDisabledError).
 */
class SmsNotConfiguredError extends NotFoundError {
  constructor() {
    super("SMS provider");
    this.code = "SMS_NOT_CONFIGURED";
    this.message = "SMS provider not configured";
  }
}

/**
 * EMAIL_OTP enrollment is OFF without a configured SMTP transport (mirrors
 * SmsNotConfiguredError): a code that only lands in server logs would lock a
 * real user out. The kind is hidden from enrollableKinds(); this also guards a
 * direct POST. 404 + stable code so existence isn't leaked.
 */
class EmailNotConfiguredError extends NotFoundError {
  constructor() {
    super("Email provider");
    this.code = "EMAIL_NOT_CONFIGURED";
    this.message = "Email provider not configured";
  }
}

/** Mask a phone for safe display: keep prefix + last 3 digits (+39•••567). */
function maskPhone(phone: string): string {
  if (phone.length < 7) return "•••";
  return `${phone.slice(0, 3)}•••${phone.slice(-3)}`;
}

/** Read the SMS destination from an SMS_OTP factor's metadata (set at enroll). */
function smsFactorPhone(factor: { metadata: Record<string, unknown> }): string | null {
  const phone = factor.metadata?.["phone"];
  return typeof phone === "string" && phone.length > 0 ? phone : null;
}

/* --- Service surface ----------------------------------------------- */

/**
 * Outcome of a setup verification: verified immediately, or (TOFU v2, first
 * self-owned factor with confirm ON) pending an out-of-band email confirmation.
 */
export type VerifySetupOutcome<K extends mfaRepo.MfaKind> =
  | { factorId: string; kind: K; verified: true }
  | {
      factorId: string;
      kind: K;
      verified: false;
      confirmRequired: true;
      emailHint: string;
      expiresInSeconds: number;
    };

export interface MfaService {
  enrollTotp(input: { userId: string; userEmail: string }): Promise<{
    factorId: string;
    kind: "TOTP";
    otpauthUri: string;
    secret: string;
    verified: false;
  }>;
  verifyTotpSetup(input: { userId: string; factorId: string; code: string }): Promise<
    VerifySetupOutcome<"TOTP">
  >;
  listFactors(userId: string): Promise<Array<{
    factorId: string;
    kind: mfaRepo.MfaKind;
    verified: boolean;
    createdAt: string;
    lastUsedAt: string | null;
  }>>;
  deleteFactor(input: { userId: string; factorId: string }): Promise<void>;
  /**
   * Start EMAIL_OTP enrollment: create an unverified factor, generate a CSPRNG
   * code, email it (mailer seam), and store it hashed-at-rest. Returns NO code.
   */
  enrollEmailOtp(input: { userId: string; userEmail: string }): Promise<{
    factorId: string;
    kind: "EMAIL_OTP";
    emailHint: string;
    expiresInSeconds: number;
    verified: false;
  }>;
  /** Confirm EMAIL_OTP enrollment with the emailed code. */
  verifyEmailOtpSetup(input: { userId: string; factorId: string; code: string }): Promise<{
    factorId: string;
    kind: "EMAIL_OTP";
    verified: true;
  }>;
  /** Re-issue a fresh enrollment code (rate-limited cooldown). */
  resendEmailOtpEnroll(input: { userId: string; userEmail: string; factorId: string }): Promise<{
    expiresInSeconds: number;
  }>;
  /**
   * Start SMS_OTP enrollment: store the (E.164-validated) destination on the
   * factor metadata, text a CSPRNG code via the SMS seam, store it hashed.
   * Throws 404 SMS_NOT_CONFIGURED when no production-capable provider exists.
   */
  enrollSmsOtp(input: { userId: string; phoneNumber: string }): Promise<{
    factorId: string;
    kind: "SMS_OTP";
    phoneHint: string;
    expiresInSeconds: number;
    verified: false;
  }>;
  /** Confirm SMS_OTP enrollment with the texted code. */
  verifySmsOtpSetup(input: { userId: string; factorId: string; code: string }): Promise<
    VerifySetupOutcome<"SMS_OTP">
  >;
  /** Re-issue a fresh SMS enrollment code (rate-limited cooldown). */
  resendSmsOtpEnroll(input: { userId: string; factorId: string }): Promise<{
    expiresInSeconds: number;
  }>;
  /** Re-issue the SMS_OTP login code tied to an active challenge token. */
  resendSmsOtpLogin(input: { challengeToken: string }): Promise<{ expiresInSeconds: number }>;
  /**
   * Factor kinds a user may ENROLL right now. TOTP/EMAIL_OTP/WEBAUTHN are
   * always enrollable; SMS_OTP only when the SMS sender is production-capable
   * (codes that land only in server logs would lock real users out).
   */
  enrollableKinds(): mfaRepo.MfaKind[];
  /* --- TOFU v2: out-of-band enroll confirmation ---------------------- */
  /** True when verifying `kind` for `userId` must go through the email confirm. */
  enrollConfirmRequired(userId: string, kind: mfaRepo.MfaKind): Promise<boolean>;
  /** Issue (or re-issue) the CONFIRM_ENROLL code for a pending factor. */
  beginEnrollConfirm(input: { userId: string; factorId: string }): Promise<{
    emailHint: string;
    expiresInSeconds: number;
  }>;
  /** Submit the emailed confirmation code: flips the pending factor to verified. */
  confirmEnroll(input: { userId: string; factorId: string; code: string }): Promise<{
    factorId: string;
    kind: mfaRepo.MfaKind;
    verified: true;
  }>;
  /** Notification + audit for a factor that just became verified (best-effort mail). */
  recordFactorEnrolled(userId: string, kind: mfaRepo.MfaKind): Promise<void>;
  /** Returns null if the user has no verified factors (MFA not required). */
  beginLoginChallenge(userId: string): Promise<{
    challengeToken: string;
    availableKinds: mfaRepo.MfaKind[];
  } | null>;
  verifyLoginChallenge(input: { challengeToken: string; code: string }): Promise<{ userId: string }>;
  /** Re-issue the EMAIL_OTP login code tied to an active challenge token. */
  resendEmailOtpLogin(input: { challengeToken: string }): Promise<{ expiresInSeconds: number }>;
  /** Regenerate the user's one-time recovery codes (returns the plaintext set ONCE). */
  generateRecoveryCodes(userId: string): Promise<{ codes: string[] }>;
  /** Count the user's remaining (unused) recovery codes. */
  countRecoveryCodes(userId: string): Promise<{ remaining: number }>;
}

/**
 * Default mailer for the MFA service singleton. The auth/mfa routes inject the
 * real DI mailer (InMemoryMailer in tests, the configured transactional mailer
 * in prod); this fallback only fires if the service is built with no mailer.
 * It is a ConsoleMailer bound to a minimal console-backed logger so the module
 * has no init-time dependency on a Fastify instance.
 */
function defaultMfaMailer(): IMailer {
  const consoleLog = {
    warn: (...args: unknown[]) => console.warn(...args),
    info: () => {},
    error: (...args: unknown[]) => console.error(...args),
    debug: () => {},
    fatal: (...args: unknown[]) => console.error(...args),
    trace: () => {},
    child: () => consoleLog,
  } as unknown as ConstructorParameters<typeof ConsoleMailer>[0];
  return new ConsoleMailer(consoleLog);
}

/**
 * Default SMS sender for the MFA service singleton (mirrors defaultMfaMailer):
 * a ConsoleSms bound to a minimal console-backed logger — not production
 * capable, so SMS_OTP stays unenrollable unless buildApp injects a real sender.
 */
function defaultSmsSender(): ISmsSender {
  const consoleLog = {
    warn: (...args: unknown[]) => console.warn(...args),
    info: () => {},
    error: (...args: unknown[]) => console.error(...args),
    debug: () => {},
    fatal: (...args: unknown[]) => console.error(...args),
    trace: () => {},
    child: () => consoleLog,
  } as unknown as ConstructorParameters<typeof ConsoleSms>[0];
  return new ConsoleSms(consoleLog);
}

/** Self-owned kinds: the enrolling party controls the channel, so the first
 *  enrollment needs an out-of-band confirm (TOFU v2). EMAIL_OTP is already
 *  out-of-band by design (the code travels to the account email). */
const CONFIRM_KINDS: ReadonlySet<mfaRepo.MfaKind> = new Set(["TOTP", "WEBAUTHN", "SMS_OTP"]);

export interface MfaServiceOptions {
  challengeStore?: MfaChallengeStore;
  /** Mailer used to deliver EMAIL_OTP codes. */
  mailer?: IMailer;
  /** Sender used to deliver SMS_OTP codes. */
  smsSender?: ISmsSender;
  /**
   * TOFU v2 out-of-band enroll confirmation mode. Defaults to env
   * MFA_ENROLL_CONFIRM ("auto" = on only with a real, non-Console mailer).
   * buildTestApp pins "off" so the pre-v2 suites keep their behaviour; the
   * dedicated confirm suite passes "on".
   */
  enrollConfirm?: "auto" | "on" | "off";
  /** Overridable clock for tests. */
  now?: () => number;
}

export function createMfaService(
  optionsOrStore: MfaServiceOptions | MfaChallengeStore = {},
): MfaService {
  // Back-compat: a bare MfaChallengeStore may still be passed positionally.
  const options: MfaServiceOptions =
    typeof (optionsOrStore as MfaChallengeStore).create === "function"
      ? { challengeStore: optionsOrStore as MfaChallengeStore }
      : (optionsOrStore as MfaServiceOptions);

  const challengeStore = options.challengeStore ?? sharedMfaChallengeStore;
  const mailer = options.mailer ?? defaultMfaMailer();
  const smsSender = options.smsSender ?? defaultSmsSender();
  const nowMs = options.now ?? (() => Date.now());
  // TOFU v2 confirm mode: "auto" resolves ON only when the mailer can really
  // deliver out-of-band (a ConsoleMailer-only environment must not block
  // enrollments on codes that land in server logs).
  const confirmMode = options.enrollConfirm ?? env.MFA_ENROLL_CONFIRM;
  const enrollConfirmOn =
    confirmMode === "on" || (confirmMode === "auto" && !(mailer instanceof ConsoleMailer));

  /** Resolve the user's email + tenant (notification + audit destinations). */
  async function getUserContact(
    userId: string,
  ): Promise<{ email: string; tenantId: string | null } | null> {
    const u = await pool.query<{ user_email: string; user_tenant_id: string | null }>(
      `SELECT user_email, user_tenant_id FROM sys.sys_users WHERE user_id = $1`,
      [userId],
    );
    const row = u.rows[0];
    return row ? { email: row.user_email, tenantId: row.user_tenant_id } : null;
  }

  /**
   * Channel-agnostic OTP issuance core: enforce the resend cooldown, generate
   * a CSPRNG code, store it HASHED, and hand the plaintext to `deliver` (the
   * only place the code ever travels). Returns the TTL in seconds.
   */
  async function issueOtpCode(args: {
    userId: string;
    factorId: string;
    purpose: mfaRepo.MfaOtpPurpose;
    deliver: (code: string) => Promise<void>;
  }): Promise<number> {
    const existing = await mfaRepo.findActiveOtpChallenge(pool, args.factorId, args.purpose);
    if (existing) {
      const age = nowMs() - existing.createdAt.getTime();
      if (age < EMAIL_OTP_RESEND_COOLDOWN_MS) {
        const retryAfter = Math.ceil((EMAIL_OTP_RESEND_COOLDOWN_MS - age) / 1000);
        throw new TooManyRequestsError(
          "Please wait before requesting a new code.",
          "MFA_OTP_RESEND_COOLDOWN",
          retryAfter,
        );
      }
    }
    const code = generateEmailOtpCode();
    const codeHash = await hashPassword(code);
    const expiresAt = new Date(nowMs() + EMAIL_OTP_TTL_MS);
    await mfaRepo.issueOtpChallenge(pool, {
      userId: args.userId,
      factorId: args.factorId,
      purpose: args.purpose,
      codeHash,
      expiresAt,
    });
    await args.deliver(code);
    return Math.floor(EMAIL_OTP_TTL_MS / 1000);
  }

  /** Issue (or re-issue) an EMAIL_OTP code — emails the plaintext via the mailer seam. */
  async function issueEmailOtp(args: {
    userId: string;
    userEmail: string;
    factorId: string;
    purpose: mfaRepo.MfaOtpPurpose;
  }): Promise<number> {
    return issueOtpCode({
      userId: args.userId,
      factorId: args.factorId,
      purpose: args.purpose,
      deliver: (code) => mailer.sendMfaOtpEmail(args.userEmail, code, args.purpose),
    });
  }

  /** Issue (or re-issue) an SMS_OTP code — texts the plaintext via the SMS seam. */
  async function issueSmsOtp(args: {
    userId: string;
    phone: string;
    factorId: string;
    purpose: mfaRepo.MfaOtpPurpose;
  }): Promise<number> {
    return issueOtpCode({
      userId: args.userId,
      factorId: args.factorId,
      purpose: args.purpose,
      // SMS OTP purposes never include CONFIRM_ENROLL (confirm goes out-of-band
      // via email); narrow for the SMS sender contract.
      deliver: (code) =>
        smsSender.sendMfaOtpSms(args.phone, code, args.purpose as "ENROLL" | "LOGIN"),
    });
  }

  /* --- TOFU v2 internals ---------------------------------------------- */

  /** True when verifying `kind` for `userId` must pass the out-of-band confirm:
   *  mode ON + self-owned kind + this would be the user's FIRST verified factor. */
  async function requiresEnrollConfirm(
    userId: string,
    kind: mfaRepo.MfaKind,
  ): Promise<boolean> {
    if (!enrollConfirmOn || !CONFIRM_KINDS.has(kind)) return false;
    const verified = await mfaRepo.listVerifiedMfaFactorsForUser(pool, userId);
    return verified.length === 0;
  }

  /** Issue the CONFIRM_ENROLL email code for a pending factor; returns hint + TTL. */
  async function beginConfirm(
    userId: string,
    factorId: string,
  ): Promise<{ emailHint: string; expiresInSeconds: number }> {
    const contact = await getUserContact(userId);
    if (!contact) throw new NotFoundError("User");
    const expiresInSeconds = await issueEmailOtp({
      userId,
      userEmail: contact.email,
      factorId,
      purpose: "CONFIRM_ENROLL",
    });
    return { emailHint: maskEmail(contact.email), expiresInSeconds };
  }

  /** Notification email (best-effort) + MFA_FACTOR_ENROLLED audit event. */
  async function notifyFactorEnrolled(userId: string, kind: mfaRepo.MfaKind): Promise<void> {
    const contact = await getUserContact(userId);
    if (!contact) return;
    await insertLoginEvent(pool, {
      userId,
      tenantId: contact.tenantId,
      type: "MFA_FACTOR_ENROLLED",
      ip: null,
      userAgent: null,
      details: { kind },
    });
    try {
      await mailer.sendMfaFactorEnrolledNotice(contact.email, kind);
    } catch {
      // Best-effort by design: the factor IS verified; a mail-backend outage
      // must not fail the enrollment (the audit event above is the durable record).
    }
  }

  /**
   * Verify an EMAIL_OTP code against the active challenge for a factor+purpose.
   * Enforces: TTL (server-side expiry), single-use (consumed_at), max-attempts
   * lockout (invalidate on exhaustion), constant-time-ish hash compare (argon2).
   * Returns true on success (and consumes the challenge); throws on hard
   * failures (expired/locked); returns false on a plain wrong-code attempt.
   */
  async function consumeEmailOtp(args: {
    factorId: string;
    purpose: mfaRepo.MfaOtpPurpose;
    code: string;
  }): Promise<boolean> {
    if (!/^\d{6}$/.test(args.code)) return false;
    const challenge = await mfaRepo.findActiveOtpChallenge(pool, args.factorId, args.purpose);
    if (!challenge) {
      // No active code (never issued, already consumed, or replay of a used one).
      throw new UnauthorizedError("Invalid or expired code", "MFA_OTP_INVALID");
    }
    // TTL check (server-side; never trust the client).
    if (challenge.expiresAt.getTime() <= nowMs()) {
      await mfaRepo.consumeOtpChallenge(pool, challenge.otpId);
      throw new UnauthorizedError("Code expired", "MFA_OTP_EXPIRED");
    }
    // Lockout check BEFORE compare (defense-in-depth; the column also caps at 5).
    if (challenge.attemptCount >= EMAIL_OTP_MAX_ATTEMPTS) {
      await mfaRepo.consumeOtpChallenge(pool, challenge.otpId);
      throw new UnauthorizedError("Too many attempts; request a new code", "MFA_OTP_LOCKED");
    }
    // Constant-time-ish compare via argon2.verify (no early-return string compare).
    const { ok } = await verifyPassword(challenge.codeHash, args.code);
    if (!ok) {
      const attempts = await mfaRepo.incrementOtpAttempt(pool, challenge.otpId);
      if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
        await mfaRepo.consumeOtpChallenge(pool, challenge.otpId);
        throw new UnauthorizedError("Too many attempts; request a new code", "MFA_OTP_LOCKED");
      }
      throw new UnauthorizedError("Invalid code", "MFA_OTP_INVALID");
    }
    // Success → single-use consume.
    await mfaRepo.consumeOtpChallenge(pool, challenge.otpId);
    return true;
  }

  return {
    async enrollTotp({ userId, userEmail }) {
      const secret = new OTPAuth.Secret({ size: 20 }).base32;
      const factor = await mfaRepo.insertMfaFactor(pool, {
        userId,
        kind: "TOTP",
        secret,
      });
      const totp = buildTotp(secret);
      // OTPAuth's toString() emits `otpauth://totp/Heuresys:label?secret=...&issuer=Heuresys`.
      // We override `label` to the user email so the authenticator app shows a
      // recognisable account name.
      totp.label = userEmail;
      const otpauthUri = totp.toString();
      return {
        factorId: factor.factorId,
        kind: "TOTP" as const,
        otpauthUri,
        secret,
        verified: false as const,
      };
    },

    async verifyTotpSetup({ userId, factorId, code }) {
      const factor = await mfaRepo.findMfaFactorById(pool, factorId);
      if (!factor) throw new NotFoundError("MFA factor");
      if (factor.userId !== userId) {
        // Don't leak existence cross-user; surface as NotFound.
        throw new NotFoundError("MFA factor");
      }
      if (factor.kind !== "TOTP") {
        throw new ValidationError({ kind: factor.kind }, "Factor is not a TOTP factor");
      }
      if (!factor.secret) {
        throw new ValidationError({ factorId }, "Factor has no secret");
      }
      if (!verifyTotpCode(factor.secret, code)) {
        throw new UnauthorizedError("Invalid TOTP code", "MFA_TOTP_INVALID");
      }
      // TOFU v2: first self-owned factor with confirm ON → possession is proven
      // but the factor stays UNVERIFIED until the out-of-band email confirm.
      if (await requiresEnrollConfirm(userId, "TOTP")) {
        const c = await beginConfirm(userId, factorId);
        return {
          factorId,
          kind: "TOTP" as const,
          verified: false as const,
          confirmRequired: true as const,
          ...c,
        };
      }
      await mfaRepo.markMfaFactorVerified(pool, factorId);
      await mfaRepo.markMfaFactorUsed(pool, factorId);
      await notifyFactorEnrolled(userId, "TOTP");
      return { factorId, kind: "TOTP" as const, verified: true as const };
    },

    async listFactors(userId) {
      const factors = await mfaRepo.listMfaFactorsForUser(pool, userId);
      return factors.map((f) => ({
        factorId: f.factorId,
        kind: f.kind,
        verified: f.verified,
        createdAt: f.createdAt.toISOString(),
        lastUsedAt: f.lastUsedAt ? f.lastUsedAt.toISOString() : null,
      }));
    },

    async deleteFactor({ userId, factorId }) {
      const removed = await mfaRepo.deleteMfaFactor(pool, factorId, userId);
      if (!removed) throw new NotFoundError("MFA factor");
    },

    /* --- EMAIL_OTP enrollment ---------------------------------------- */
    async enrollEmailOtp({ userId, userEmail }) {
      // Anti-lockout: refuse EMAIL_OTP enrollment when no real transport exists
      // (hidden from enrollableKinds(); this guards a direct POST).
      if (!mailer.productionCapable) throw new EmailNotConfiguredError();
      // Create the (unverified) EMAIL_OTP factor. No secret is stored on the
      // factor row — the per-attempt codes live hashed in the challenge table.
      const factor = await mfaRepo.insertMfaFactor(pool, {
        userId,
        kind: "EMAIL_OTP",
        secret: null,
      });
      const expiresInSeconds = await issueEmailOtp({
        userId,
        userEmail,
        factorId: factor.factorId,
        purpose: "ENROLL",
      });
      return {
        factorId: factor.factorId,
        kind: "EMAIL_OTP" as const,
        emailHint: maskEmail(userEmail),
        expiresInSeconds,
        verified: false as const,
      };
    },

    async verifyEmailOtpSetup({ userId, factorId, code }) {
      const factor = await mfaRepo.findMfaFactorById(pool, factorId);
      if (!factor) throw new NotFoundError("MFA factor");
      if (factor.userId !== userId) {
        // Don't leak existence cross-user; surface as NotFound.
        throw new NotFoundError("MFA factor");
      }
      if (factor.kind !== "EMAIL_OTP") {
        throw new ValidationError({ kind: factor.kind }, "Factor is not an EMAIL_OTP factor");
      }
      await consumeEmailOtp({ factorId, purpose: "ENROLL", code });
      // EMAIL_OTP enrollment is already out-of-band (the code travelled to the
      // account email) → never needs the extra TOFU confirm.
      await mfaRepo.markMfaFactorVerified(pool, factorId);
      await mfaRepo.markMfaFactorUsed(pool, factorId);
      await notifyFactorEnrolled(userId, "EMAIL_OTP");
      return { factorId, kind: "EMAIL_OTP" as const, verified: true as const };
    },

    async resendEmailOtpEnroll({ userId, userEmail, factorId }) {
      const factor = await mfaRepo.findMfaFactorById(pool, factorId);
      if (!factor || factor.userId !== userId) throw new NotFoundError("MFA factor");
      if (factor.kind !== "EMAIL_OTP") {
        throw new ValidationError({ kind: factor.kind }, "Factor is not an EMAIL_OTP factor");
      }
      const expiresInSeconds = await issueEmailOtp({
        userId,
        userEmail,
        factorId,
        purpose: "ENROLL",
      });
      return { expiresInSeconds };
    },

    /* --- SMS_OTP enrollment (code-only slice) -------------------------- */
    async enrollSmsOtp({ userId, phoneNumber }) {
      if (!smsSender.productionCapable) {
        // Typed 404 mirrors the MATCHING_FREETEXT_DISABLED pattern: the kind is
        // invisible until a deliverable provider exists (codes that only land
        // in server logs would lock real users out).
        throw new SmsNotConfiguredError();
      }
      // Destination lives on the factor metadata (masked in every response);
      // per-attempt codes live hashed in the challenge table, like EMAIL_OTP.
      const factor = await mfaRepo.insertMfaFactor(pool, {
        userId,
        kind: "SMS_OTP",
        secret: null,
        metadata: { phone: phoneNumber },
      });
      const expiresInSeconds = await issueSmsOtp({
        userId,
        phone: phoneNumber,
        factorId: factor.factorId,
        purpose: "ENROLL",
      });
      return {
        factorId: factor.factorId,
        kind: "SMS_OTP" as const,
        phoneHint: maskPhone(phoneNumber),
        expiresInSeconds,
        verified: false as const,
      };
    },

    async verifySmsOtpSetup({ userId, factorId, code }) {
      const factor = await mfaRepo.findMfaFactorById(pool, factorId);
      if (!factor) throw new NotFoundError("MFA factor");
      if (factor.userId !== userId) {
        // Don't leak existence cross-user; surface as NotFound.
        throw new NotFoundError("MFA factor");
      }
      if (factor.kind !== "SMS_OTP") {
        throw new ValidationError({ kind: factor.kind }, "Factor is not an SMS_OTP factor");
      }
      // consumeEmailOtp is channel-agnostic (factor+purpose scoped challenge rows).
      await consumeEmailOtp({ factorId, purpose: "ENROLL", code });
      // TOFU v2: possession of the phone is proven, but the first self-owned
      // factor still needs the out-of-band EMAIL confirm when the mode is ON.
      if (await requiresEnrollConfirm(userId, "SMS_OTP")) {
        const c = await beginConfirm(userId, factorId);
        return {
          factorId,
          kind: "SMS_OTP" as const,
          verified: false as const,
          confirmRequired: true as const,
          ...c,
        };
      }
      await mfaRepo.markMfaFactorVerified(pool, factorId);
      await mfaRepo.markMfaFactorUsed(pool, factorId);
      await notifyFactorEnrolled(userId, "SMS_OTP");
      return { factorId, kind: "SMS_OTP" as const, verified: true as const };
    },

    async resendSmsOtpEnroll({ userId, factorId }) {
      const factor = await mfaRepo.findMfaFactorById(pool, factorId);
      if (!factor || factor.userId !== userId) throw new NotFoundError("MFA factor");
      if (factor.kind !== "SMS_OTP") {
        throw new ValidationError({ kind: factor.kind }, "Factor is not an SMS_OTP factor");
      }
      const phone = smsFactorPhone(factor);
      if (!phone) throw new ValidationError({ factorId }, "Factor has no phone destination");
      const expiresInSeconds = await issueSmsOtp({ userId, phone, factorId, purpose: "ENROLL" });
      return { expiresInSeconds };
    },

    async resendSmsOtpLogin({ challengeToken }) {
      // Validate the token WITHOUT consuming it (mirrors resendEmailOtpLogin).
      const userId = challengeStore.peek(challengeToken);
      const factors = await mfaRepo.listVerifiedMfaFactorsForUser(pool, userId);
      const smsFactor = factors.find((f) => f.kind === "SMS_OTP");
      const phone = smsFactor ? smsFactorPhone(smsFactor) : null;
      if (!smsFactor || !phone) {
        throw new UnauthorizedError("No SMS_OTP factor for this challenge", "MFA_OTP_INVALID");
      }
      const expiresInSeconds = await issueSmsOtp({
        userId,
        phone,
        factorId: smsFactor.factorId,
        purpose: "LOGIN",
      });
      return { expiresInSeconds };
    },

    enrollableKinds() {
      return [
        "TOTP",
        // EMAIL_OTP only with a real transport — without SMTP the code lands in
        // server logs and a real user enrolling it would lock themselves out
        // (mirrors the SMS_OTP provider gate just below). TOTP + WEBAUTHN keep
        // MFA fully operable with no email backend at all.
        ...(mailer.productionCapable ? (["EMAIL_OTP"] as const) : []),
        "WEBAUTHN",
        ...(smsSender.productionCapable ? (["SMS_OTP"] as const) : []),
      ];
    },

    /* --- TOFU v2: out-of-band enroll confirmation --------------------- */
    enrollConfirmRequired(userId, kind) {
      return requiresEnrollConfirm(userId, kind);
    },

    async beginEnrollConfirm({ userId, factorId }) {
      const factor = await mfaRepo.findMfaFactorById(pool, factorId);
      if (!factor || factor.userId !== userId) throw new NotFoundError("MFA factor");
      if (factor.verified) {
        throw new ValidationError({ factorId }, "Factor is already verified");
      }
      if (!CONFIRM_KINDS.has(factor.kind)) {
        throw new ValidationError({ kind: factor.kind }, "Factor kind needs no confirmation");
      }
      return beginConfirm(userId, factorId);
    },

    async confirmEnroll({ userId, factorId, code }) {
      const factor = await mfaRepo.findMfaFactorById(pool, factorId);
      if (!factor || factor.userId !== userId) throw new NotFoundError("MFA factor");
      if (factor.verified) {
        throw new ValidationError({ factorId }, "Factor is already verified");
      }
      if (!CONFIRM_KINDS.has(factor.kind)) {
        throw new ValidationError({ kind: factor.kind }, "Factor kind needs no confirmation");
      }
      await consumeEmailOtp({ factorId, purpose: "CONFIRM_ENROLL", code });
      await mfaRepo.markMfaFactorVerified(pool, factorId);
      await mfaRepo.markMfaFactorUsed(pool, factorId);
      await notifyFactorEnrolled(userId, factor.kind);
      return { factorId, kind: factor.kind, verified: true as const };
    },

    recordFactorEnrolled(userId, kind) {
      return notifyFactorEnrolled(userId, kind);
    },

    async beginLoginChallenge(userId) {
      const verified = await mfaRepo.listVerifiedMfaFactorsForUser(pool, userId);
      if (verified.length === 0) return null;
      const challengeToken = challengeStore.create(userId);
      const availableKinds = [...new Set(verified.map((f) => f.kind))];
      // For EMAIL_OTP factors, issue + email a code now so it is in the user's
      // inbox by the time the second step prompts for it. (TOTP needs no send.)
      const emailFactor = verified.find((f) => f.kind === "EMAIL_OTP");
      if (emailFactor) {
        const u = await pool.query<{ user_email: string }>(
          `SELECT user_email FROM sys.sys_users WHERE user_id = $1`,
          [userId],
        );
        const userEmail = u.rows[0]?.user_email;
        if (userEmail) {
          // Cooldown failures here must NOT block the login challenge from being
          // offered (a recent code is still valid) — swallow the cooldown signal.
          await issueEmailOtp({
            userId,
            userEmail,
            factorId: emailFactor.factorId,
            purpose: "LOGIN",
          }).catch((e) => {
            if (!(e instanceof TooManyRequestsError)) throw e;
          });
        }
      }
      // Same pre-send for SMS_OTP factors (destination lives on the factor metadata).
      const smsLoginFactor = verified.find((f) => f.kind === "SMS_OTP");
      if (smsLoginFactor) {
        const phone = smsFactorPhone(smsLoginFactor);
        if (phone) {
          await issueSmsOtp({
            userId,
            phone,
            factorId: smsLoginFactor.factorId,
            purpose: "LOGIN",
          }).catch((e) => {
            if (!(e instanceof TooManyRequestsError)) throw e;
          });
        }
      }
      return { challengeToken, availableKinds };
    },

    async verifyLoginChallenge({ challengeToken, code }) {
      // NOTE: consuming the challenge token is single-use — a wrong code here
      // burns the token. The /login route re-mints a token on the next attempt
      // (step 1 is re-issued), and for EMAIL_OTP the underlying emailed code
      // survives across token re-mints (it is tied to the factor, not the token)
      // until its own TTL / attempt budget is exhausted.
      const userId = challengeStore.consume(challengeToken);
      const factors = await mfaRepo.listVerifiedMfaFactorsForUser(pool, userId);
      if (factors.length === 0) {
        throw new UnauthorizedError("No MFA factors registered", "MFA_NOT_ENROLLED");
      }

      // 1. Try each verified TOTP factor first (synchronous, no DB write).
      //    Constant-time-ish: validate ALL secrets to avoid a factor-enumeration
      //    timing oracle.
      let matchedFactor: mfaRepo.MfaFactorRow | null = null;
      for (const f of factors) {
        if (f.kind === "TOTP" && f.secret && verifyTotpCode(f.secret, code)) {
          if (!matchedFactor) matchedFactor = f;
        }
      }
      const expectMatched = matchedFactor !== null;
      timingSafeEqual(Buffer.from([Number(expectMatched)]), Buffer.from([Number(expectMatched)]));
      if (matchedFactor) {
        await mfaRepo.markMfaFactorUsed(pool, matchedFactor.factorId);
        // QW-SEC6 lazy re-encryption: a successfully-used factor whose secret is
        // still legacy-plaintext gets upgraded to enc:v1: ciphertext (when the
        // key is present). Best-effort — a failure here must NEVER fail a valid
        // login, so it is fully swallowed (mirrors password needsRehash).
        //
        // EXCEPTION — the committed e2e-fixture factors (metadata.label =
        // "e2e-fixture") are deliberately kept PLAINTEXT: their base32 seeds are
        // committed (helpers/mfa-fixture-secrets.ts) so PROD smoke / CI /
        // Playwright complete TOTP step-2 deterministically, and they are the
        // exact rows the controlled one-time bulk-encrypt (db:encrypt-totp)
        // owns. Lazy-upgrading them here would mutate live shared-DB rows that
        // the currently-deployed (plaintext-expecting) PROD still reads → skip.
        const isCommittedFixture = matchedFactor.metadata?.["label"] === FIXTURE_FACTOR_LABEL;
        if (!matchedFactor.secretWasEncrypted && matchedFactor.secret && !isCommittedFixture) {
          await mfaRepo
            .reencryptFactorSecret(pool, matchedFactor.factorId, matchedFactor.secret)
            .catch(() => {});
        }
        return { userId };
      }

      // 2. No TOTP match — try the EMAIL_OTP factor against its active LOGIN
      //    challenge. consumeEmailOtp enforces TTL / single-use / lockout and
      //    throws typed errors (MFA_OTP_EXPIRED / MFA_OTP_LOCKED) or returns
      //    false on a plain wrong code.
      const emailFactor = factors.find((f) => f.kind === "EMAIL_OTP");
      if (emailFactor) {
        const ok = await consumeEmailOtp({
          factorId: emailFactor.factorId,
          purpose: "LOGIN",
          code,
        });
        if (ok) {
          await mfaRepo.markMfaFactorUsed(pool, emailFactor.factorId);
          return { userId };
        }
      }

      // 2b. No EMAIL match — try the SMS_OTP factor the same way (the challenge
      //     machinery is channel-agnostic: rows are factor+purpose scoped).
      const smsFactor = factors.find((f) => f.kind === "SMS_OTP");
      if (smsFactor) {
        const ok = await consumeEmailOtp({
          factorId: smsFactor.factorId,
          purpose: "LOGIN",
          code,
        });
        if (ok) {
          await mfaRepo.markMfaFactorUsed(pool, smsFactor.factorId);
          return { userId };
        }
      }

      // 2c. No OTP match — try a single-use recovery code (high-entropy backup).
      //     The length-16 guard keeps short 6-digit OTPs off the recovery path.
      const normalized = normalizeRecoveryCode(code);
      if (normalized.length === 16) {
        const burned = await mfaRepo.consumeRecoveryCode(pool, userId, sha256Hex(normalized));
        if (burned) return { userId };
      }

      // 3. Nothing matched. Use TOTP-specific code only when the user has no
      //    OTP-channel factor (back-compat with the existing TOTP test);
      //    otherwise surface the generic OTP-invalid code.
      throw new UnauthorizedError(
        "Invalid code",
        emailFactor || smsFactor ? "MFA_OTP_INVALID" : "MFA_TOTP_INVALID",
      );
    },

    async resendEmailOtpLogin({ challengeToken }) {
      // Validate the token WITHOUT consuming it (resend must not burn the step-2
      // token). We peek via a non-consuming check by re-using the userId binding.
      const userId = challengeStore.peek(challengeToken);
      const factors = await mfaRepo.listVerifiedMfaFactorsForUser(pool, userId);
      const emailFactor = factors.find((f) => f.kind === "EMAIL_OTP");
      if (!emailFactor) {
        throw new UnauthorizedError("No EMAIL_OTP factor for this challenge", "MFA_OTP_INVALID");
      }
      const u = await pool.query<{ user_email: string }>(
        `SELECT user_email FROM sys.sys_users WHERE user_id = $1`,
        [userId],
      );
      const userEmail = u.rows[0]?.user_email;
      if (!userEmail) throw new UnauthorizedError("User not found", "MFA_OTP_INVALID");
      const expiresInSeconds = await issueEmailOtp({
        userId,
        userEmail,
        factorId: emailFactor.factorId,
        purpose: "LOGIN",
      });
      return { expiresInSeconds };
    },

    async generateRecoveryCodes(userId) {
      // Recovery codes bypass the second factor → only meaningful once a factor is enrolled.
      const factors = await mfaRepo.listVerifiedMfaFactorsForUser(pool, userId);
      if (factors.length === 0) {
        throw new ValidationError("Enroll an MFA factor before generating recovery codes", "MFA_NOT_ENROLLED");
      }
      const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCodePlain);
      const hashes = codes.map((c) => sha256Hex(normalizeRecoveryCode(c)));
      await mfaRepo.replaceRecoveryCodes(pool, userId, hashes);
      return { codes };
    },

    async countRecoveryCodes(userId) {
      return { remaining: await mfaRepo.countUnusedRecoveryCodes(pool, userId) };
    },
  };
}

export const sharedMfaService: MfaService = createMfaService();

/**
 * Build an MFA service bound to a specific mailer (and optionally an isolated
 * challenge store). Used by buildApp so the EMAIL_OTP sends go through the same
 * mailer the rest of auth uses (InMemoryMailer in tests, the configured
 * transactional mailer in prod). Tests can additionally pass a fresh challenge
 * store to isolate token state.
 */
export function buildMfaServiceWithMailer(
  mailer: IMailer,
  challengeStore?: MfaChallengeStore,
  smsSender?: ISmsSender,
  enrollConfirm?: "auto" | "on" | "off",
): MfaService {
  return createMfaService({
    mailer,
    ...(challengeStore ? { challengeStore } : {}),
    ...(smsSender ? { smsSender } : {}),
    ...(enrollConfirm ? { enrollConfirm } : {}),
  });
}

/** Test-only export: build a service against an injectable challenge store. */
export const MFA_INTERNAL = {
  createInMemoryChallengeStore,
  verifyTotpCode,
  generateRandomFactorId: randomUUID,
  generateEmailOtpCode,
  maskEmail,
  EMAIL_OTP_TTL_MS,
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_RESEND_COOLDOWN_MS,
  /** QW-SEC6: exposed so a parity test asserts it never drifts from the test
   *  helper E2E_FIXTURE_LABEL (the lazy-re-encrypt skip relies on the match). */
  FIXTURE_FACTOR_LABEL,
};
