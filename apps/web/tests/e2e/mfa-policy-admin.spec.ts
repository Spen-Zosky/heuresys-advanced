/**
 * apps/web/tests/e2e/mfa-policy-admin.spec.ts
 * Admin editor /admin/mfa-policy (MVP-4 §2.5 mandatory-MFA, S982): the first
 * per-tenant config editor. Toggles the policy on the Heuresys System tenant
 * (roleCodes [READ_ONLY]) and snapshot-restores the EXACT pre-test policy in
 * finally (S983 WS-E: the live row may be the REAL mandatory-MFA activation).
 */
import { test, expect, request as pwRequest } from "@playwright/test";
import { completeApiLogin, storageStateFor, API_BASE } from "./fixtures";



test.use({ storageState: storageStateFor("platformAdmin") });

/** API-context login (dual-mode S983 WS-E): cookie-bound context + csrf. */
async function apiLogin() {
  const ctx = await pwRequest.newContext({ baseURL: API_BASE });
  const { csrfToken } = await completeApiLogin(ctx, "enzo.spenuso@heuresys.com");
  return { ctx, csrfToken };
}

test("mfa-policy admin page: list, toggle HS policy on (READ_ONLY scope), restore off", async ({ page }) => {
  const { ctx, csrfToken } = await apiLogin();
  // Resolve the HS tenant id from the live list (never hardcode).
  const tenants = await ctx.get("/v1/tenants?limit=200");
  expect(tenants.ok()).toBeTruthy();
  const hs = ((await tenants.json()) as { items: Array<{ tenantId: string; tenantCode: string }> }).items
    .find((t) => !t.tenantCode.includes("RTL"));
  if (!hs) throw new Error("Heuresys System tenant not found");

  // SNAPSHOT the pre-test HS policy (S983 WS-E / D-23 doctrine): the live DB
  // carries the REAL mandatory-MFA activation — a blanket-disable in finally
  // would silently wipe it. Restore the EXACT row afterwards.
  const beforeList = await ctx.get("/v1/mfa-policy/");
  expect(beforeList.ok()).toBeTruthy();
  const saved = ((await beforeList.json()) as {
    items: Array<{ tenantId: string; enabled: boolean; roleCodes: string[] | null }>;
  }).items.find((p) => p.tenantId === hs.tenantId) ?? null;

  try {
    // Arrange a deterministic OFF starting state for the UI toggle flow
    // (post-flip the live state is enabled+all-roles, which would invert it).
    await ctx.put(`/v1/mfa-policy/${hs.tenantId}`, {
      data: { enabled: false, roleCodes: null },
      headers: { "x-csrf-token": csrfToken },
    });
    await page.goto("/admin/mfa-policy");
    await expect(page.getByTestId("admin-mfa-policy-page")).toBeVisible();
    // Auto-wait on the HS row FIRST: rows render from the policies fallback
    // before the tenants query resolves (the count is racy until then).
    const hsRow = page.locator(`[data-testid="mfa-policy-row"][data-tenant-id="${hs.tenantId}"]`);
    await expect(hsRow).toBeVisible();
    const rows = page.getByTestId("mfa-policy-row");
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
    await expect(hsRow.getByTestId("mfa-policy-status")).toBeVisible();

    // Enable + scope to READ_ONLY only (no E2E persona holds READ_ONLY on HS).
    await hsRow.getByTestId("mfa-policy-toggle").click();
    await hsRow.getByTestId("mfa-policy-all-roles").click(); // all -> selection mode
    await hsRow.getByTestId("mfa-policy-role-READ_ONLY").click();
    await hsRow.getByTestId("mfa-policy-save").click();
    await expect(hsRow.getByTestId("mfa-policy-saved")).toBeVisible();

    // The refetched policy shows enabled + the scoped role (live API readback).
    const list = await ctx.get("/v1/mfa-policy/");
    expect(list.ok()).toBeTruthy();
    const item = ((await list.json()) as {
      items: Array<{ tenantId: string; enabled: boolean; roleCodes: string[] | null }>;
    }).items.find((p) => p.tenantId === hs.tenantId);
    expect(item?.enabled).toBe(true);
    expect(item?.roleCodes).toEqual(["READ_ONLY"]);
    await expect(hsRow.getByTestId("mfa-policy-status")).toHaveText(/attiva|enabled/i);
  } finally {
    // Snapshot-restore the EXACT pre-test policy (never a blanket-disable —
    // the row may be the REAL activation, S982 lesson).
    await ctx.put(`/v1/mfa-policy/${hs.tenantId}`, {
      data: { enabled: saved?.enabled ?? false, roleCodes: saved?.roleCodes ?? null },
      headers: { "x-csrf-token": csrfToken },
    });
    await ctx.dispose();
  }
});
