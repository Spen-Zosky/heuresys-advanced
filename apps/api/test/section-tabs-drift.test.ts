/**
 * apps/api/test/section-tabs-drift.test.ts — D-66 anti-drift guard.
 *
 * The S1009 sidebar IA is DB-driven (sys.sys_ui_interfaces) but the 6 merge
 * groups' tab bar (apps/web/src/components/section-tabs.tsx) hardcodes its
 * hrefs: a route rename on either side would silently desynchronize the two.
 * Until the merge groups are modeled in the DB registry (deferred to the
 * frontend forensics mandate — needs label i18n on ui_interfaces), this guard
 * turns the silent trap into a loud one. All expectations are DERIVED from the
 * real sources (the component file, the live DB registry, the Next.js route
 * tree) — no duplicated route list.
 *
 *  1. every group's FIRST tab (the "principale") is an ACTIVE sidebar entry in
 *     sys_ui_interfaces — the sidebar and the tab bar agree on the entry point;
 *  2. every tab href resolves to a real page.tsx under app/(authenticated) —
 *     a page rename/move breaks here instead of 404-ing in production.
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pool, closePool } from "../src/db/client.js";

const WEB_ROOT = join(import.meta.dirname, "..", "..", "web", "src");
const TABS_FILE = join(WEB_ROOT, "components", "section-tabs.tsx");
const APP_DIR = join(WEB_ROOT, "app", "(authenticated)");

interface Group { id: string; hrefs: string[] }

/** Parse MERGE_GROUPS from the component source: `{ id: "...", tabs: [ { href: "..." } ] }`. */
function parseMergeGroups(): Group[] {
  const src = readFileSync(TABS_FILE, "utf8");
  const groups: Group[] = [];
  const groupRe = /\{ id: "([a-z]+)", tabs: \[([\s\S]*?)\] \}/g;
  for (let m = groupRe.exec(src); m; m = groupRe.exec(src)) {
    const hrefs = [...m[2]!.matchAll(/href: "([^"]+)"/g)].map((h) => h[1]!);
    groups.push({ id: m[1]!, hrefs });
  }
  return groups;
}

describe("section-tabs ↔ sidebar registry ↔ route tree (D-66 guard)", () => {
  afterAll(async () => {
    await closePool();
  });

  it("parses the merge groups from the component (sanity)", () => {
    const groups = parseMergeGroups();
    expect(groups.length).toBeGreaterThanOrEqual(6);
    for (const g of groups) expect(g.hrefs.length).toBeGreaterThanOrEqual(2);
  });

  it("every group's principale is an ACTIVE route in sys_ui_interfaces", async () => {
    const groups = parseMergeGroups();
    const res = await pool.query<{ route: string }>(
      `SELECT ui_interface_route AS route FROM sys.sys_ui_interfaces WHERE ui_interface_is_active`,
    );
    const active = new Set(res.rows.map((r) => r.route));
    for (const g of groups) {
      const principale = g.hrefs[0]!;
      expect(active.has(principale),
        `gruppo "${g.id}": principale ${principale} non è una route attiva della sidebar DB-driven`,
      ).toBe(true);
    }
  });

  it("every tab href resolves to a real page.tsx under app/(authenticated)", () => {
    for (const g of parseMergeGroups()) {
      for (const href of g.hrefs) {
        const page = join(APP_DIR, ...href.replace(/^\//, "").split("/"), "page.tsx");
        expect(existsSync(page), `tab ${href} (gruppo ${g.id}): manca ${page}`).toBe(true);
      }
    }
  });
});
