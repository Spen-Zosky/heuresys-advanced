import { defineConfig } from "tsup";

/**
 * Production bundle for the API (VM = prod environment).
 *
 * `@heuresys/shared` is "source-first" — its package `exports` point to .ts, which `tsx` (dev) can
 * load but plain `node` cannot. So bundle that workspace package IN (noExternal). Everything listed
 * in `dependencies` (fastify, @fastify/*, pg, pg-format, argon2 [native], otpauth,
 * zod, dotenv, …) stays EXTERNAL and is loaded from node_modules at runtime (argon2 is a native
 * .node addon and MUST NOT be bundled).
 *
 * Output: dist/server.js (ESM, node22). Run with `node dist/server.js` (see package.json `start`).
 * NOTE: the bundle sits at a different depth than src/config/env.ts, so the prod systemd unit sets
 * HEURESYS_REPO_ROOT so env.ts can locate .env + .secrets/*.pem (see env.ts).
 */
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  bundle: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  noExternal: [/^@heuresys\//],
  // ESM bundle: esbuild's __require helper uses the GLOBAL `require` if it exists, else throws
  // ("Dynamic require of \"os\" is not supported"). Define a real one (createRequire) so external
  // CJS deps that internally require() node builtins keep working under `node dist/server.js`.
  // (Only `require` — env.ts uses import.meta.url natively, so no __dirname/__filename shim needed,
  // and adding them would collide with bundled modules that declare their own.)
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  // @heuresys/shared is bundled from its TS source (noExternal above). Activate the
  // "development" export condition so esbuild resolves the workspace package to ./src/*.ts
  // (the same path tsx uses in dev) instead of ./dist/*.js. Keeps the prod API bundle
  // source-first and independent of a prebuilt shared/dist — D-58's conditional exports
  // (default -> ./dist/*.js) are consumed ONLY by the Next.js web build (Turbopack).
  esbuildOptions(options) {
    options.conditions = ["development"];
  },
});
