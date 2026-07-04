/**
 * apps/api/test/helpers/personas.ts
 * SINGLE SOURCE of the seeded-persona login password for the whole test suite.
 *
 * F-001 (forensic audit 2026-07-03): the password is NOT a committed constant any more.
 * It is read from the environment (`TEST_ADMIN_PASSWORD`) — the same value the seeder
 * (db/scripts/seed-test-admin.ts) writes to the DB. Every machine that runs the suite
 * supplies it via the gitignored `.env`; the suite fails CLOSED if it is unset, so a
 * public/default password can never creep back into the codebase. Rotating the personas'
 * password is then a one-liner: change `.env` + re-run the seeder (no source edit).
 */

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.length === 0) {
    throw new Error(
      `${name} is not set — the test personas' login password is environment-driven (F-001). ` +
        `Add ${name}=<value> to the repo-root .env; it MUST match the value the seeder wrote to the DB ` +
        `(pnpm db:seed-test-admin).`,
    );
  }
  return v;
}

/** The shared login password for every seeded test persona (admin + RTL personas). */
export const TEST_PERSONA_PASSWORD: string = requiredEnv("TEST_ADMIN_PASSWORD");
