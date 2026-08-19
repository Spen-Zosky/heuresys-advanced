/**
 * apps/api/scripts/profilo-costo-avvio.mts — Z-251 F2, la misura che precede la cura.
 *
 * Il piano di Z-251 dichiara la causa: «ogni file rifa' i login da zero e Argon2id e'
 * lento per costruzione». Prima di condividere le sessioni bisogna sapere QUANTO pesa
 * ciascun pezzo del rito che ogni file di test ripete, altrimenti si ottimizza il pezzo
 * sbagliato — e' gia' successo in F1, dove la latenza del tunnel sembrava dominare e non
 * dominava.
 *
 * Misura, in ordine, cio' che un file di test paga PRIMA di eseguire il suo primo test:
 *   1. loadRolePermissionCache()  — una volta per FILE (il flag e' modulo-level e con
 *      isolate:true il registry riparte da zero a ogni file)
 *   2. buildApp() + ready()       — una volta per file
 *   3. login completo             — Argon2id + TOTP step-2, N volte per file
 *
 *   tsx scripts/profilo-costo-avvio.mts [ripetizioni]
 */
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "..", "..", "..", ".env") });
process.env.AUTH_LOGIN_RATELIMIT_MAX = "10000";

const N = Number(process.argv[2] ?? "3");
const ms = (t: bigint) => Number(t) / 1e6;

async function cronometra<T>(etichetta: string, f: () => Promise<T>): Promise<[T, number]> {
  const t0 = process.hrtime.bigint();
  const r = await f();
  const dt = ms(process.hrtime.bigint() - t0);
  console.log(`  ${etichetta.padEnd(46)} ${dt.toFixed(0).padStart(8)} ms`);
  return [r, dt];
}

const { loadRolePermissionCache } = await import("../src/modules/auth/cache-loader.js");
const { buildTestApp } = await import("../test/helpers/build-test-app.js");
const { loginRaw } = await import("../test/helpers/login.js");
const { pool } = await import("../src/db/client.js");

console.log("=".repeat(78));
console.log(" Z-251 F2 — quanto costa il rito che ogni file di test ripete");
console.log("=".repeat(78));

console.log("\n[1] loadRolePermissionCache() — una volta per FILE con isolate:true");
const cache: number[] = [];
for (let i = 0; i < N; i++) {
  const [, dt] = await cronometra(`  giro ${i + 1}`, () => loadRolePermissionCache());
  cache.push(dt);
}

console.log("\n[2] buildApp() + ready() — una volta per file");
const build: number[] = [];
const apps: Array<{ app: { close(): Promise<void> } }> = [];
for (let i = 0; i < N; i++) {
  const [a, dt] = await cronometra(`  giro ${i + 1}`, () => buildTestApp());
  build.push(dt);
  apps.push(a as never);
}

console.log("\n[3] login completo (Argon2id + TOTP step-2)");
const app0 = (apps[0] as unknown as { app: Parameters<typeof loginRaw>[0] }).app;
const email = process.env.PROFILO_EMAIL ?? "enzo.spenuso@heuresys.com";
const login: number[] = [];
for (let i = 0; i < N; i++) {
  const [, dt] = await cronometra(`  giro ${i + 1} (${email})`, () => loginRaw(app0, email));
  login.push(dt);
}

console.log("\n[4] una query qualunque sul pool (riferimento round-trip)");
const query: number[] = [];
for (let i = 0; i < N; i++) {
  const [, dt] = await cronometra(`  giro ${i + 1}`, () => pool.query("SELECT 1"));
  query.push(dt);
}

const mediana = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
console.log("\n" + "=".repeat(78));
console.log(" MEDIANE");
console.log("=".repeat(78));
const mCache = mediana(cache), mBuild = mediana(build), mLogin = mediana(login), mQuery = mediana(query);
console.log(`  loadRolePermissionCache   ${mCache.toFixed(0).padStart(8)} ms  x 1 per file`);
console.log(`  buildApp + ready          ${mBuild.toFixed(0).padStart(8)} ms  x 1 per file`);
console.log(`  login completo            ${mLogin.toFixed(0).padStart(8)} ms  x N per file`);
console.log(`  query singola (tunnel)    ${mQuery.toFixed(0).padStart(8)} ms  riferimento`);

for (const a of apps) await (a as unknown as { app: { close(): Promise<void> } }).app.close();
await pool.end();
