/**
 * apps/api/src/modules/auth/webauthn-service.ts
 *
 * WebAuthn / FIDO2 passkey MFA factor. Wraps @simplewebauthn/server v13 for the
 * two ceremonies:
 *
 *   1. Registration (authenticated) — startRegistration mints an unverified
 *      WEBAUTHN factor + returns PublicKeyCredentialCreationOptionsJSON;
 *      verifyRegistration confirms the attestation, persists the credential
 *      (in a transaction with markVerified), and flips the factor to verified.
 *   2. Authentication (login step-up) — startAuthentication returns
 *      PublicKeyCredentialRequestOptionsJSON scoped to the user's credentials;
 *      verifyAuthentication validates the assertion, enforces the signature-
 *      counter monotonicity invariant, and returns the userId.
 *
 * The challenge store is in-memory single-process (mirrors mfa-service's store).
 * For a multi-process deploy (PM2 cluster / replicas) swap it for Redis — the
 * surface here is small (keyed Map with TTL + sweep).
 *
 * RP config comes from env: WEBAUTHN_RP_ID / WEBAUTHN_RP_NAME / WEBAUTHN_ORIGINS
 * (the last comma-split into the expected-origin allowlist). NOTE: WebAuthn
 * requires a secure context — `localhost` is exempt but a plain-HTTP non-localhost
 * origin is NOT — so passkeys are unusable on the current HTTP PROD origin until
 * TLS lands (see env.ts WEBAUTHN_* comment).
 *
 * The authentication ceremony is LIVE (mandatory-MFA #4, S981): /v1/auth/login
 * mints the challengeToken and a verified assertion completes the login via
 * authService.completeMfaLogin in mfa-routes.ts.
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { pool } from "../../db/client.js";
import { ApiError, UnauthorizedError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { withTransaction } from "./repository.js";
import { sharedMfaChallengeStore, type MfaChallengeStore } from "./mfa-service.js";
import * as mfaRepo from "./mfa-repository.js";
import * as webauthnRepo from "./webauthn-repository.js";

/**
 * 400-status error carrying a custom SCREAMING_SNAKE code. ValidationError pins
 * its code to VALIDATION_ERROR; the central errorHandler maps a bare ApiError to
 * status 400 by default, so this subclass surfaces e.g. WEBAUTHN_REGISTRATION_FAILED
 * with a clean 400.
 */
class WebauthnError extends ApiError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

/* --- RP configuration (from env) ------------------------------------ */
const RP_ID = env.WEBAUTHN_RP_ID;
const RP_NAME = env.WEBAUTHN_RP_NAME;
/** Comma-separated allowlist -> the expectedOrigin array for @simplewebauthn. */
const ORIGINS = env.WEBAUTHN_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

/* --- Challenge store (registration + authentication) ---------------- */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
}

/** In-memory challenge store keyed by `reg:<userId>` / `auth:<challengeToken>`. */
function createChallengeStore() {
  const entries = new Map<string, ChallengeEntry>();
  function sweep(now: number): void {
    for (const [k, v] of entries.entries()) {
      if (v.expiresAt <= now) entries.delete(k);
    }
  }
  return {
    put(key: string, challenge: string, now = Date.now()): void {
      sweep(now);
      entries.set(key, { challenge, expiresAt: now + CHALLENGE_TTL_MS });
    },
    /** Validate + REMOVE (one-shot). Returns the challenge, or null if missing/expired. */
    take(key: string, now = Date.now()): string | null {
      sweep(now);
      const e = entries.get(key);
      if (!e) return null;
      entries.delete(key);
      if (e.expiresAt <= now) return null;
      return e.challenge;
    },
    reset(): void {
      entries.clear();
    },
  };
}

/** Outcome of registration verify: verified immediately, or pending the TOFU v2
 *  out-of-band email confirm (first self-owned factor, confirm mode ON). */
export type WebauthnRegistrationOutcome =
  | { factorId: string; kind: "WEBAUTHN"; verified: true; deviceLabel: string }
  | {
      factorId: string;
      kind: "WEBAUTHN";
      verified: false;
      confirmRequired: true;
      emailHint: string;
      expiresInSeconds: number;
    };

export interface WebauthnService {
  startRegistration(input: { userId: string; userEmail: string }): Promise<{
    factorId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>;
  verifyRegistration(input: {
    userId: string;
    factorId: string;
    response: RegistrationResponseJSON;
    deviceLabel: string;
  }): Promise<WebauthnRegistrationOutcome>;
  startAuthentication(input: { challengeToken: string }): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
  }>;
  verifyAuthentication(input: {
    challengeToken: string;
    response: AuthenticationResponseJSON;
  }): Promise<{ userId: string }>;
}

/** TOFU v2 hooks provided by the MFA service (app.ts wires them; the bare
 *  shared singleton has none and keeps the pre-v2 immediate-verify path). */
export interface WebauthnEnrollConfirmHooks {
  required(userId: string): Promise<boolean>;
  begin(userId: string, factorId: string): Promise<{ emailHint: string; expiresInSeconds: number }>;
  recordEnrolled(userId: string): Promise<void>;
}

export interface WebauthnServiceOptions {
  /** Login-step challenge store (shared with mfa-service so peek/consume agree). */
  loginChallengeStore?: MfaChallengeStore;
  /** TOFU v2 out-of-band confirm hooks (from the MFA service). */
  enrollConfirm?: WebauthnEnrollConfirmHooks;
}

export function createWebauthnService(
  options: WebauthnServiceOptions = {},
): WebauthnService {
  const loginChallengeStore = options.loginChallengeStore ?? sharedMfaChallengeStore;
  const enrollConfirm = options.enrollConfirm;
  const store = createChallengeStore();

  return {
    async startRegistration({ userId, userEmail }) {
      // Create the (unverified) WEBAUTHN factor up-front. The credential row is
      // persisted only once the attestation verifies (verifyRegistration).
      const factor = await mfaRepo.insertMfaFactor(pool, {
        userId,
        kind: "WEBAUTHN",
        secret: null,
      });

      const existing = await webauthnRepo.findCredentialsForUser(pool, userId);
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: userEmail,
        // userID must be a Uint8Array; the userId UUID string is stable + unique.
        userID: new Uint8Array(Buffer.from(userId, "utf8")),
        attestationType: "none",
        excludeCredentials: existing.map((c) => ({
          id: c.credentialId,
          transports: parseTransports(c.transports),
        })),
        authenticatorSelection: {
          userVerification: "preferred",
          residentKey: "preferred",
        },
      });

      store.put(`reg:${userId}`, options.challenge);
      return { factorId: factor.factorId, options };
    },

    async verifyRegistration({ userId, factorId, response, deviceLabel }) {
      const expectedChallenge = store.take(`reg:${userId}`);
      if (!expectedChallenge) {
        throw new UnauthorizedError(
          "No active WebAuthn registration challenge",
          "MFA_CHALLENGE_INVALID",
        );
      }

      // Guard: the factor must belong to this user and be a WEBAUTHN factor.
      const factor = await mfaRepo.findMfaFactorById(pool, factorId);
      if (!factor || factor.userId !== userId || factor.kind !== "WEBAUTHN") {
        throw new WebauthnError(
          "WEBAUTHN_REGISTRATION_FAILED",
          "Unknown or mismatched WebAuthn factor",
        );
      }

      let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
      try {
        verification = await verifyRegistrationResponse({
          response,
          expectedChallenge,
          expectedOrigin: ORIGINS,
          expectedRPID: RP_ID,
        });
      } catch {
        // A malformed/tampered attestation throws — surface as a clean 400.
        throw new WebauthnError(
          "WEBAUTHN_REGISTRATION_FAILED",
          "WebAuthn registration verification failed",
        );
      }

      if (!verification.verified || !verification.registrationInfo) {
        throw new WebauthnError(
          "WEBAUTHN_REGISTRATION_FAILED",
          "WebAuthn registration could not be verified",
        );
      }

      // v13 shape: registrationInfo.credential = { id, publicKey, counter, transports }.
      const { credential, aaguid, credentialBackedUp } =
        verification.registrationInfo;

      // TOFU v2: when this is the user's FIRST self-owned factor and the
      // confirm mode is ON, persist the credential but keep the factor
      // UNVERIFIED until the out-of-band email confirm (mfa enroll-confirm).
      // verifyAuthentication filters on factor.verified, so a pending
      // credential can never authenticate.
      const needsConfirm = enrollConfirm ? await enrollConfirm.required(userId) : false;

      await withTransaction(async (client) => {
        await webauthnRepo.insertWebauthnCredential(client, {
          factorId,
          userId,
          credentialId: credential.id,
          // publicKey is a Uint8Array_; store as a Node Buffer (bytea bind).
          publicKey: Buffer.from(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports ?? [],
          aaguid: aaguid ?? null,
          deviceLabel,
          backupEligible: credentialBackedUp,
          backupState: credentialBackedUp,
        });
        if (!needsConfirm) {
          await mfaRepo.markMfaFactorVerified(client, factorId);
        }
      });

      if (needsConfirm && enrollConfirm) {
        const c = await enrollConfirm.begin(userId, factorId);
        return {
          factorId,
          kind: "WEBAUTHN" as const,
          verified: false as const,
          confirmRequired: true as const,
          ...c,
        };
      }

      if (enrollConfirm) await enrollConfirm.recordEnrolled(userId);
      return { factorId, kind: "WEBAUTHN" as const, verified: true as const, deviceLabel };
    },

    async startAuthentication({ challengeToken }) {
      // peek (non-consuming): the token survives to the verify call.
      const userId = loginChallengeStore.peek(challengeToken);
      const credentials = await webauthnRepo.findCredentialsForUser(pool, userId);
      // TOFU v2: only credentials whose factor is VERIFIED may authenticate —
      // a pending-confirm credential (registered but unconfirmed) is excluded.
      const verifiedFactorIds = new Set(
        (await mfaRepo.listVerifiedMfaFactorsForUser(pool, userId)).map((f) => f.factorId),
      );
      const usable = credentials.filter((c) => verifiedFactorIds.has(c.factorId));
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: "preferred",
        allowCredentials: usable.map((c) => ({
          id: c.credentialId,
          transports: parseTransports(c.transports),
        })),
      });
      store.put(`auth:${challengeToken}`, options.challenge);
      return { options };
    },

    async verifyAuthentication({ challengeToken, response }) {
      // consume (one-shot): a wrong assertion burns the login token (mirrors
      // verifyLoginChallenge — step 1 re-mints on the next attempt).
      const userId = loginChallengeStore.consume(challengeToken);
      const expectedChallenge = store.take(`auth:${challengeToken}`);
      if (!expectedChallenge) {
        throw new UnauthorizedError(
          "No active WebAuthn authentication challenge",
          "MFA_CHALLENGE_INVALID",
        );
      }

      // The credential id is response.id (base64url; rawId is the same value).
      const credentialId = response.id ?? response.rawId;
      const cred = credentialId
        ? await webauthnRepo.findCredentialByCredentialId(pool, credentialId)
        : null;
      if (!cred || cred.userId !== userId) {
        throw new UnauthorizedError(
          "Unknown WebAuthn credential",
          "WEBAUTHN_AUTH_FAILED",
        );
      }
      // TOFU v2 guard: a credential whose factor is still pending the
      // out-of-band confirm must NOT authenticate (no existence leak: same
      // error as an unknown credential).
      const factor = await mfaRepo.findMfaFactorById(pool, cred.factorId);
      if (!factor?.verified) {
        throw new UnauthorizedError(
          "Unknown WebAuthn credential",
          "WEBAUTHN_AUTH_FAILED",
        );
      }

      let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
      try {
        verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge,
          expectedOrigin: ORIGINS,
          expectedRPID: RP_ID,
          credential: {
            id: cred.credentialId,
            publicKey: new Uint8Array(cred.publicKey),
            counter: cred.counter,
          },
        });
      } catch {
        throw new UnauthorizedError(
          "WebAuthn authentication verification failed",
          "WEBAUTHN_AUTH_FAILED",
        );
      }

      if (!verification.verified) {
        throw new UnauthorizedError(
          "WebAuthn authentication could not be verified",
          "WEBAUTHN_AUTH_FAILED",
        );
      }

      // Signature-counter monotonicity (clone / replay defence). Reject ONLY when
      // the stored counter is non-zero and the new one does not advance. Allow the
      // 0/0 case — authenticators that don't implement a counter (e.g. Touch ID)
      // legitimately keep both at 0.
      const { newCounter } = verification.authenticationInfo;
      const storedCounter = cred.counter;
      if (storedCounter > 0 && newCounter <= storedCounter) {
        throw new UnauthorizedError(
          "WebAuthn signature counter regression",
          "WEBAUTHN_COUNTER_REGRESSION",
        );
      }

      await webauthnRepo.updateCredentialCounter(pool, cred.credentialId, newCounter);
      await mfaRepo.markMfaFactorUsed(pool, cred.factorId);
      return { userId };
    },
  };
}

/** Parse the stored JSON-array transports string back into the typed union. */
function parseTransports(json: string): AuthenticatorTransportFuture[] | undefined {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as AuthenticatorTransportFuture[];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export const sharedWebauthnService: WebauthnService = createWebauthnService();
