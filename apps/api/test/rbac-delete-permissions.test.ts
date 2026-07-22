/**
 * apps/api/test/rbac-delete-permissions.test.ts — #61 G/G2 regression guard.
 *
 * The matrix role×permission is what /admin/roles presents as the source of
 * truth on who can do what. Before this guard, 32 standalone-module DELETE
 * routes ran under their area's `:update` (or `:override`/`:trigger`/
 * `:update_layout`) permission, so the matrix never stated who could DESTROY
 * data — holding "update" silently carried the right to delete.
 *
 * Two invariants, both derived from the real sources (route files and the live
 * grant table) rather than from a hardcoded list that would drift:
 *
 *  1. every standalone module's root `DELETE /:id` is gated by a `:delete`
 *     permission — so a NEW module cannot reintroduce the shortcut;
 *  2. each dedicated `:delete` permission is held by exactly the roles that hold
 *     the permission its routes used to run under — the matrix became explicit
 *     WITHOUT anyone gaining or losing the ability to delete.
 *
 * Deliberately NOT flagged (asserted as the documented exceptions): nested
 * sub-resource unlinks under a parent (e.g. positions `/:id/skills/:skillId`)
 * are edits of the parent's requirement set, not entity deletions, and stay on
 * the parent's `:update`.
 */

import { describe, it, expect, afterAll } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pool, closePool } from "../src/db/client.js";

const MODULES_DIR = join(import.meta.dirname, "..", "src", "modules");

/** Permission → the permission its DELETEs previously ran under (000177). */
const DELETE_TO_SOURCE: Record<string, string> = {
  "enterprise_typing:delete": "enterprise_typing:update",
  "blueprint:delete": "blueprint:override",
  "career_succession:delete": "career_succession:update",
  "skill:delete": "skill:update",
  "seed_acquisition:delete": "seed_acquisition:trigger",
  "bpm_process:delete": "bpm_process:update",
  "gap_analysis:delete": "gap_analysis:update",
  "visualization:delete": "visualization:update_layout",
};

/**
 * De-proxied permissions (000178) → the cross-area permission they replaced.
 * Same contract as the deletes: the matrix became readable, the audience did not
 * move. `tenant_materialization:execute` had no route gate at all (the service's
 * ensurePlatformAdmin was the real check), so its audience is sourced from the
 * PLATFORM_ADMIN-only `tenant:create`.
 */
const PROXY_TO_SOURCE: Record<string, string> = {
  "observability:read": "tenant:create",
  "role_matrix:read": "auth:revoke_user",
  "auth:sessions_read": "auth:revoke_user",
  "tenant_materialization:execute": "tenant:create",
};

/**
 * G2 residuals (000199) → audience source. Same contract again: job_family:*
 * and skill_taxonomy:* had NO honest route gate (service ensurePlatformAdmin
 * was the real check, or worse — the route promised `skill:*` holders a power
 * the service then denied), so their audience is sourced from the
 * PLATFORM_ADMIN-only `tenant:create`. The kpi-template/operating-model codes
 * replace cross-area proxies verb-by-verb.
 */
const G2_RESIDUAL_TO_SOURCE: Record<string, string> = {
  "job_family:create": "tenant:create",
  "job_family:update": "tenant:create",
  "job_family:delete": "tenant:create",
  "skill_taxonomy:create": "tenant:create",
  "skill_taxonomy:update": "tenant:create",
  "skill_taxonomy:delete": "tenant:create",
  "operating_model:read": "enterprise_typing:read",
  "operating_model:update": "enterprise_typing:update",
  "operating_model:delete": "enterprise_typing:delete",
  "organization_unit_kpi_template:read": "bpm_process:read",
  "organization_unit_kpi_template:update": "bpm_process:update",
  "organization_unit_kpi_template:delete": "bpm_process:delete",
  "process_kpi_template:read": "bpm_process:read",
  "process_kpi_template:update": "bpm_process:update",
  "process_kpi_template:delete": "bpm_process:delete",
};

/**
 * Root deletes that legitimately do NOT use a `:delete` permission, with why.
 * Anything else must be justified here rather than silently tolerated.
 */
const JUSTIFIED_EXCEPTIONS: Record<string, string> = {
  me: "self-scope session revocation (I17) — me:sessions:manage",
  users: "revokes a ROLE GRANT, not the user — role:assign",
};

function rolesFor(code: string): Promise<string[]> {
  return pool
    .query<{ role: string }>(
      `SELECT r.auth_role_code AS role
         FROM sys.sys_auth_permissions p
         JOIN sys.sys_auth_role_permissions rp ON rp.auth_permission_id = p.auth_permission_id
         JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
        WHERE p.auth_permission_code = $1
        ORDER BY r.auth_role_code`,
      [code],
    )
    .then((r) => r.rows.map((x) => x.role));
}

describe("#61 G2 — DELETE routes carry a dedicated :delete permission", () => {
  afterAll(async () => {
    await closePool();
  });

  it("every standalone module's root DELETE is gated by a `:delete` permission", () => {
    const offenders: string[] = [];
    let examined = 0;

    for (const mod of readdirSync(MODULES_DIR, { withFileTypes: true })) {
      if (!mod.isDirectory()) continue;
      const routes = join(MODULES_DIR, mod.name, "routes.ts");
      if (!existsSync(routes)) continue;
      if (mod.name in JUSTIFIED_EXCEPTIONS) continue;

      const lines = readFileSync(routes, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i]!.includes("app.delete(")) continue;

        // Root delete only: `/:id` (possibly on the next line for multi-line calls).
        // Nested unlinks like `/:id/skills/:skillId` are parent edits, not deletions.
        const head = lines.slice(i, i + 2).join(" ");
        const path = /app\.delete\(\s*"([^"]*)"/.exec(head)?.[1];
        if (path === undefined || !/^\/:[A-Za-z]+$/.test(path)) continue;

        const block = lines.slice(i, i + 8).join(" ");
        const perm = /requirePermission\("([^"]+)"\)/.exec(block)?.[1];
        if (!perm) continue; // no RBAC gate here → covered by other suites
        examined++;
        if (!perm.endsWith(":delete")) offenders.push(`${mod.name} ${path} -> ${perm}`);
      }
    }

    // A scan that matched nothing would pass vacuously and hide any regression.
    // 32 routes were retargeted by 000177 plus the ones already correct.
    expect(examined, "lo scan non ha trovato route DELETE — parser da aggiornare?").toBeGreaterThan(40);
    expect(offenders, `DELETE senza permesso :delete dedicato:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("each :delete permission is held by exactly the audience of the permission it replaced", async () => {
    for (const [deleteCode, sourceCode] of Object.entries(DELETE_TO_SOURCE)) {
      const [deleteRoles, sourceRoles] = await Promise.all([rolesFor(deleteCode), rolesFor(sourceCode)]);

      // Guard against the assertion passing vacuously if a code is ever renamed.
      expect(sourceRoles.length, `${sourceCode} non ha grant — codice rinominato?`).toBeGreaterThan(0);
      expect(deleteRoles, `${deleteCode} deve avere l'audience di ${sourceCode}`).toEqual(sourceRoles);
    }
  });

  it("each de-proxied permission keeps the audience of the cross-area gate it replaced", async () => {
    for (const [newCode, sourceCode] of Object.entries(PROXY_TO_SOURCE)) {
      const [newRoles, sourceRoles] = await Promise.all([rolesFor(newCode), rolesFor(sourceCode)]);

      expect(sourceRoles.length, `${sourceCode} non ha grant — codice rinominato?`).toBeGreaterThan(0);
      expect(newRoles, `${newCode} deve avere l'audience di ${sourceCode}`).toEqual(sourceRoles);
    }
  });

  it("each G2-residual permission (000199) keeps the audience of its source", async () => {
    for (const [newCode, sourceCode] of Object.entries(G2_RESIDUAL_TO_SOURCE)) {
      const [newRoles, sourceRoles] = await Promise.all([rolesFor(newCode), rolesFor(sourceCode)]);

      expect(sourceRoles.length, `${sourceCode} non ha grant — codice rinominato?`).toBeGreaterThan(0);
      expect(newRoles, `${newCode} deve avere l'audience di ${sourceCode}`).toEqual(sourceRoles);
    }
  });

  it("the G2-residual routes carry their dedicated permissions (old proxies gone)", () => {
    const read = (mod: string) => readFileSync(join(MODULES_DIR, mod, "routes.ts"), "utf8");

    // job-families: mutations must be matrix-gated (they had NO requirePermission at all)
    const jobFamilies = read("job-families");
    expect(jobFamilies).toMatch(/requirePermission\(\s*"job_family:create"/);
    expect(jobFamilies).toMatch(/requirePermission\(\s*"job_family:update"/);
    expect(jobFamilies).toMatch(/requirePermission\(\s*"job_family:delete"/);

    // skill-taxonomy structures: the dishonest `skill:*` gate must be gone
    for (const mod of ["skill-families", "skill-categories", "skill-taxonomy-edges"]) {
      const src = read(mod);
      expect(src, `${mod} non deve più usare skill:*`).not.toMatch(/requirePermission\(\s*"skill:(create|update|delete)"/);
      expect(src, `${mod} deve usare skill_taxonomy:*`).toMatch(/requirePermission\(\s*"skill_taxonomy:/);
    }

    // operating-models / kpi-templates: cross-area proxies must be gone
    const operatingModels = read("operating-models");
    expect(operatingModels).not.toContain('requirePermission("enterprise_typing:');
    expect(operatingModels).toMatch(/requirePermission\(\s*"operating_model:/);

    for (const mod of ["organization-unit-kpi-templates", "process-kpi-templates"]) {
      const src = read(mod);
      expect(src, `${mod} non deve più usare bpm_process:*`).not.toContain('requirePermission("bpm_process:');
    }
    expect(read("organization-unit-kpi-templates")).toMatch(/requirePermission\(\s*"organization_unit_kpi_template:/);
    expect(read("process-kpi-templates")).toMatch(/requirePermission\(\s*"process_kpi_template:/);
  });

  it("no route is gated by a permission from an unrelated area (known proxies are gone)", () => {
    // The proxies 000178 removed must not reappear on these routes.
    const observability = readFileSync(join(MODULES_DIR, "observability", "routes.ts"), "utf8");
    expect(observability).not.toContain('requirePermission("tenant:create")');
    expect(observability).toContain('requirePermission("observability:read")');

    const auth = readFileSync(join(MODULES_DIR, "auth", "routes.ts"), "utf8");
    expect(auth).toContain('requirePermission("role_matrix:read")');
    expect(auth).toContain('requirePermission("auth:sessions_read")');
    // the genuine revoke mutation must KEEP auth:revoke_user
    expect(auth).toContain('requirePermission("auth:revoke_user")');

    // Match the call, not its exact argument list: this route also passes a
    // denial-code override, and asserting the closing paren made the test fail
    // on a legitimate change.
    const materialization = readFileSync(join(MODULES_DIR, "tenant-materialization", "routes.ts"), "utf8");
    expect(materialization).toMatch(/requirePermission\(\s*"tenant_materialization:execute"/);
  });
});
