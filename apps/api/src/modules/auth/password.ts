/**
 * apps/api/src/modules/auth/password.ts
 * Argon2id hashing wrappers — server-only crypto. The Zod password policy
 * (PasswordPolicy) lives in @heuresys/shared so the frontend can validate
 * forms with the same rules.
 *
 * Per AUTH_SECURITY_PLAN §3 + ADR-0005:
 *   memoryCost = 64 MiB, timeCost = 3, parallelism = 4, hashLength = 32 bytes.
 */

import argon2 from "argon2";

export { PasswordPolicy } from "@heuresys/shared";

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
