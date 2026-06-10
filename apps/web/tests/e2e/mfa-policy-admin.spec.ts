/**
 * apps/web/tests/e2e/mfa-policy-admin.spec.ts
 * Admin editor /admin/mfa-policy (MVP-4 §2.5 mandatory-MFA, S982): the first
 * per-tenant config editor. Toggles the policy on the Heuresys System tenant
 * (roleCodes [READ_ONLY]) and restores it OFF in finally — NEVER leave the
 * gate ON for HS (the platformAdmin persona lives there).
 */
import { test, expect, request as pwRequest } from "@playwright/test";
import { storageStateFor, TEST_PASSWORD } from "./fixtures";

const API_BASE = process.env.API_BASE ?? "http://localhost:3001";

test.use({ storageState: storageStateFor("platformAdmin") });

/** API-context login: returns cookie-bound context + csrf for state-changing calls. */
async function apiLogin() {
  const ctx = await pwRequest.newContext({ baseURL: API_BASE });
  const login = await ctx.post("/v1/auth/login", {
    data: { email: "admin@heuresys.com", password: TEST_PASSWORD },
  });
  if (!login.ok()) throw new Error(`API login failed: ${login.status()}`);
  const { csrfToken } = (await login.json()) as { csrfToken: string };
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

  try {
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
    // Restore OFF via API (robust even if the UI flow failed midway).
    await ctx.put(`/v1/mfa-policy/${hs.tenantId}`, {
      data: { enabled: false, roleCodes: null },
      headers: { "x-csrf-token": csrfToken },
    });
    await ctx.dispose();
  }
});
