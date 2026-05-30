/**
 * apps/web/tests/e2e/me-pages.spec.ts
 *
 * Live-data E2E for all 10 ESS pages under /me/* — each page calls a real
 * /v1/me/* endpoint and asserts the response renders. Uses storageState
 * for the employee persona (tommaso.fiore, USER role, primary assignment to a
 * real POS-* position in RTL_BANK tenant — rebuilt from legacy).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("employee") });

test.describe("MVP-2a ESS pages — live data", () => {
  test("/me/profile loads + saves a no-op PATCH", async ({ page }) => {
    await page.goto("/me/profile");
    await expect(page.getByTestId("me-profile-page")).toBeVisible();
    await expect(page.getByTestId("me-profile-email")).toContainText("tommaso.fiore@rtl-bank.org");
    await expect(page.getByTestId("profile-displayName")).toBeVisible();

    // Trigger a mutation by touching the displayName field (toggle a suffix)
    const dn = page.getByTestId("profile-displayName");
    const initial = await dn.inputValue();
    await dn.fill(`${initial}`);
    // Force submit by appending and removing a char so isDirty becomes true.
    await dn.fill(`${initial} `);
    await dn.fill(initial);
    // displayName equals initial — isDirty resolves to false; skip submit.
    // Test that GET works (form rendered) and PATCH endpoint exists by hitting:
    const patchResp = await page.request.patch("/api/v1/me/profile", {
      headers: { "x-csrf-token": await page.evaluate(() => {
        const m = document.cookie.match(/(?:^|; )hrx_csrf=([^;]*)/);
        return m && m[1] ? decodeURIComponent(m[1]) : "";
      })},
      data: { displayName: initial },
    });
    expect(patchResp.status()).toBe(200);
  });

  test("/me/positions shows the employee's real primary assignment", async ({ page }) => {
    await page.goto("/me/positions");
    await expect(page.getByTestId("me-positions-page")).toBeVisible();
    await expect(page.getByTestId("me-positions-count")).toContainText(/\d+\s+assegnazioni/);
    const rows = page.getByTestId("me-position-row");
    await expect(rows.first()).toBeVisible();
    // Rebuilt real positions are coded POS-<pernr|id>; the synthetic TEST_SUB_POS no longer exists.
    await expect(rows.first()).toContainText("POS-");
  });

  test("/me/skills renders (empty state OK if no evidence yet)", async ({ page }) => {
    await page.goto("/me/skills");
    await expect(page.getByTestId("me-skills-page")).toBeVisible();
    await expect(page.getByTestId("me-skills-count")).toContainText(/\d+\s+evidenze/);
  });

  test("/me/learning renders (empty or with rows)", async ({ page }) => {
    await page.goto("/me/learning");
    await expect(page.getByTestId("me-learning-page")).toBeVisible();
    await expect(page.getByTestId("me-learning-count")).toContainText(/\d+\s+percorsi/);
  });

  test("/me/gaps renders", async ({ page }) => {
    await page.goto("/me/gaps");
    await expect(page.getByTestId("me-gaps-page")).toBeVisible();
    await expect(page.getByTestId("me-gaps-count")).toContainText(/\d+\s+aperti/);
  });

  test("/me/kpis renders", async ({ page }) => {
    await page.goto("/me/kpis");
    await expect(page.getByTestId("me-kpis-page")).toBeVisible();
    await expect(page.getByTestId("me-kpis-count")).toContainText(/\d+\s+obiettivi/);
  });

  test("/me/career renders", async ({ page }) => {
    await page.goto("/me/career");
    await expect(page.getByTestId("me-career-page")).toBeVisible();
    await expect(page.getByTestId("me-career-count")).toContainText(/\d+\s+obiettivi/);
  });

  test("/me/certifications renders", async ({ page }) => {
    await page.goto("/me/certifications");
    await expect(page.getByTestId("me-certifications-page")).toBeVisible();
    await expect(page.getByTestId("me-certifications-count")).toContainText(/\d+\s+certificazioni/);
  });

  test("/me/documents renders (live-list, may be empty)", async ({ page }) => {
    await page.goto("/me/documents");
    await expect(page.getByTestId("me-documents-page")).toBeVisible();
    await expect(page.getByTestId("me-documents-count")).toContainText(/\d+\s+documenti/);
  });

  test("/me/inbox renders", async ({ page }) => {
    await page.goto("/me/inbox");
    await expect(page.getByTestId("me-inbox-page")).toBeVisible();
    await expect(page.getByTestId("me-inbox-count")).toContainText(/\d+\s+notifiche/);
  });
});
