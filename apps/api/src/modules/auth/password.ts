/**
 * apps/api/src/modules/auth/password.ts
 * Argon2id hashing wrappers + password complexity Zod refiner.
 *
 * Per AUTH_SECURITY_PLAN §3 + ADR-0005:
 *   memoryCost = 64 MiB, timeCost = 3, parallelism = 4, hashLength = 32 bytes.
 */

import argon2 from "argon2";
import { z } from "zod";

export const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_PARAMS);
}

export async function verifyPassword(
  storedHash: string,
  input: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  const ok = await argon2.verify(storedHash, input);
  const needsRehash = ok ? argon2.needsRehash(storedHash, ARGON2_PARAMS) : false;
  return { ok, needsRehash };
}

/**
 * Password complexity policy enforced on creation and reset.
 * Login does not re-validate complexity — users with legacy weak hashes still
 * authenticate (and get rehashed via needsRehash).
 */
export const PasswordPolicy = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .refine(
    (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p),
    { message: "Password must contain upper, lower, digit, and symbol" },
  );
