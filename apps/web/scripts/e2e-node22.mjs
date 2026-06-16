#!/usr/bin/env node
/**
 * apps/web/scripts/e2e-node22.mjs — D-36 fix-proper (option b).
 *
 * Playwright 1.61.0 crashes at import-time on Node >=23
 * (`TypeError: context.conditions?.includes is not a function`), killing every
 * spec including auth.setup. 1.61.0 is the LATEST STABLE Playwright release, so
 * bumping the dependency (option a) is not available — the only fix is to run the
 * Playwright CLI under a Node 22 runtime when the host Node is incompatible.
 *
 * This wrapper:
 *   - on Node <=22 (CI runners, Mac/VM via nvm) → transparent passthrough, no download.
 *   - on Node >=23 (e.g. Windows host Node 24) → locates a Node 22 runtime and runs
 *     Playwright (and its webServer children) under it.
 *
 * Node 22 discovery order:
 *   1. $E2E_NODE22_BIN  — explicit path to a node binary.
 *   2. project cache    — <repo>/.cache/node22/node-v22.*  (gitignored).
 *   3. auto-download    — pinned/$E2E_NODE22_VERSION or latest v22.x LTS portable
 *      from nodejs.org into the cache (idempotent; Expand-Archive on Windows, tar on *nix).
 *
 * Usage:  node scripts/e2e-node22.mjs <playwright-cli-args...>
 *   e.g.  node scripts/e2e-node22.mjs test --config=playwright.prod.config.ts
 *         node scripts/e2e-node22.mjs test me-matching.spec.ts
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, delimiter } from "node:path";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(HERE, ".."); // apps/web
const REPO_ROOT = resolve(WEB_DIR, "..", ".."); // repo root
const CACHE_DIR = join(REPO_ROOT, ".cache", "node22");

const require = createRequire(join(WEB_DIR, "package.json"));
// @playwright/test's exports map doesn't expose ./cli.js as a subpath, but its
// package.json is exported — resolve the package dir from there and join the bin.
const PW_CLI = join(dirname(require.resolve("@playwright/test/package.json")), "cli.js");

const args = process.argv.slice(2);
const isWin = process.platform === "win32";
const major = Number(process.versions.node.split(".")[0]);
const NEEDS_22 = major >= 23; // PW 1.61 import-time crash on Node >=23 (D-36)

/** Run the Playwright CLI under `nodeBin`; prepend `pathDir` so webServer children inherit Node 22. */
function runAndExit(nodeBin, pathDir) {
  const env = { ...process.env };
  if (pathDir) env.PATH = pathDir + delimiter + (env.PATH ?? "");
  const r = spawnSync(nodeBin, [PW_CLI, ...args], { stdio: "inherit", cwd: WEB_DIR, env });
  process.exit(r.status ?? 1);
}

function nodeBinIn(dir) {
  return isWin ? join(dir, "node.exe") : join(dir, "bin", "node");
}

function findCachedNode22() {
  if (!existsSync(CACHE_DIR)) return null;
  for (const name of readdirSync(CACHE_DIR)) {
    if (!name.startsWith("node-v22.")) continue;
    const dir = join(CACHE_DIR, name);
    const bin = nodeBinIn(dir);
    if (existsSync(bin)) return { dir, bin };
  }
  return null;
}

async function latest22Version() {
  const res = await fetch("https://nodejs.org/dist/index.json");
  if (!res.ok) throw new Error(`nodejs.org dist index HTTP ${res.status}`);
  const list = await res.json();
  const v = list.find((e) => e.version.startsWith("v22."));
  if (!v) throw new Error("no v22.x in nodejs.org dist index");
  return v.version;
}

async function provisionNode22() {
  const version = process.env.E2E_NODE22_VERSION ?? (await latest22Version());
  const osTag = isWin ? "win" : process.platform === "darwin" ? "darwin" : "linux";
  const ext = isWin ? "zip" : "tar.gz";
  const base = `node-${version}-${osTag}-${process.arch}`;
  const url = `https://nodejs.org/dist/${version}/${base}.${ext}`;
  mkdirSync(CACHE_DIR, { recursive: true });
  const archivePath = join(CACHE_DIR, `${base}.${ext}`);
  console.log(`[e2e-node22] downloading ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  writeFileSync(archivePath, Buffer.from(await res.arrayBuffer()));
  console.log(`[e2e-node22] extracting ${base}.${ext} into ${CACHE_DIR} ...`);
  const ex = isWin
    ? spawnSync(
        "powershell",
        ["-NoProfile", "-Command", `Expand-Archive -Path '${archivePath}' -DestinationPath '${CACHE_DIR}' -Force`],
        { stdio: "inherit" },
      )
    : spawnSync("tar", ["-xzf", archivePath, "-C", CACHE_DIR], { stdio: "inherit" });
  if (ex.status !== 0) throw new Error(`extraction failed (status ${ex.status})`);
}

// ── main ──
if (!NEEDS_22) {
  console.log(`[e2e-node22] Node ${process.versions.node} is Playwright-compatible — running directly.`);
  runAndExit(process.execPath, null);
} else if (process.env.E2E_NODE22_BIN && existsSync(process.env.E2E_NODE22_BIN)) {
  console.log(`[e2e-node22] Node ${process.versions.node} → using $E2E_NODE22_BIN`);
  runAndExit(process.env.E2E_NODE22_BIN, dirname(process.env.E2E_NODE22_BIN));
} else {
  let cached = findCachedNode22();
  if (!cached) {
    console.log(`[e2e-node22] Node ${process.versions.node} incompatible with Playwright 1.61 — provisioning Node 22 portable...`);
    await provisionNode22();
    cached = findCachedNode22();
    if (!cached) {
      console.error("[e2e-node22] provisioning failed — no Node 22 found in cache after extract.");
      process.exit(1);
    }
  }
  console.log(`[e2e-node22] running Playwright under ${cached.bin}`);
  runAndExit(cached.bin, isWin ? cached.dir : join(cached.dir, "bin"));
}
