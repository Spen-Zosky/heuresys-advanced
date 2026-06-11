/**
 * scripts/codemods/s983-mfa-loginraw.mjs
 * S983 WS-E E2 — retrofit the per-file `login()` helpers of the API
 * integration suite to the shared dual-mode `loginRaw` (helpers/login.ts).
 *
 * Range-anchored: ONLY the two statements inside `async function login(...)`
 * that perform the raw inject + status assert are replaced with a delegation
 * to `loginRaw(app, email, PWD)` — the per-file return-shape extraction
 * (cookie map / csrfToken / userId) is untouched, so every call-site keeps
 * its exact behaviour on a policy-OFF database and becomes TOTP-capable on a
 * policy-ON one.
 *
 * Files that do not match the uniform pattern are reported as MANUAL and not
 * touched. Idempotent: a re-run finds no pattern and changes nothing.
 *
 *   node scripts/codemods/s983-mfa-loginraw.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = "apps/api/test";
const DRY = process.argv.includes("--dry");

// Suites with bespoke login flows (MFA state-machine assertions, auth
// internals) — handled by hand in E2c, never by the codemod.
const MANUAL_SKIP = new Set([
  "auth.integration.test.ts",
  "auth-mfa.integration.test.ts",
  "auth-mfa-mandatory.integration.test.ts",
  "mfa.integration.test.ts",
  "mfa-enroll-confirm.integration.test.ts",
  "mfa-policy.integration.test.ts",
  "mfa-recovery-codes.integration.test.ts",
  "mfa-sms.integration.test.ts",
  "webauthn.integration.test.ts",
]);

// The 2 uniform statements inside the login() body:
//   const r = await <app>.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: <PWD> } });
//   if (r.statusCode !== 200) throw new Error(`...`);
const INJECT_RE =
  /const (\w+) = await ([\w.]+)\.inject\(\{\s*method: "POST",\s*url: "\/v1\/auth\/login",\s*payload: \{ email, password: (\w+) \},?\s*\}\);\s*\n\s*if \(\1\.statusCode !== 200\)[^;\n]*;/g;

const IMPORT_ANCHOR = /^(import .*from "\.\/helpers\/build-test-app\.js";)$/m;
const IMPORT_LINE = 'import { loginRaw } from "./helpers/login.js";';

const results = { modified: [], manual: [], unmatched: [], skipped: [] };

for (const file of readdirSync(TEST_DIR).filter((f) => f.endsWith(".test.ts")).sort()) {
  const path = join(TEST_DIR, file);
  const src = readFileSync(path, "utf8");
  if (MANUAL_SKIP.has(file)) {
    results.manual.push(file);
    continue;
  }
  if (!src.includes('url: "/v1/auth/login"')) {
    results.skipped.push(file); // no login at all (e.g. pure-unit files)
    continue;
  }
  if (src.includes('from "./helpers/login.js"')) {
    results.skipped.push(file); // already migrated (idempotent re-run)
    continue;
  }

  let replaced = 0;
  let out = src.replace(INJECT_RE, (_m, rv, appExpr, pwdVar) => {
    replaced++;
    return `const ${rv} = await loginRaw(${appExpr}, email, ${pwdVar});`;
  });

  if (replaced === 0) {
    results.unmatched.push(file);
    continue;
  }
  if (!IMPORT_ANCHOR.test(out)) {
    results.unmatched.push(`${file} (no build-test-app import anchor)`);
    continue;
  }
  out = out.replace(IMPORT_ANCHOR, `$1\n${IMPORT_LINE}`);

  if (!DRY) writeFileSync(path, out, "utf8");
  results.modified.push(`${file} (${replaced} site${replaced > 1 ? "s" : ""})`);
}

console.log(`MODIFIED (${results.modified.length}):`);
for (const f of results.modified) console.log(`  ${f}`);
console.log(`UNMATCHED → manual review (${results.unmatched.length}):`);
for (const f of results.unmatched) console.log(`  ${f}`);
console.log(`MANUAL-BY-DESIGN MFA/auth suites (${results.manual.length}):`);
for (const f of results.manual) console.log(`  ${f}`);
console.log(`SKIPPED no-login/already-migrated (${results.skipped.length})`);
if (DRY) console.log("(dry run — nothing written)");
