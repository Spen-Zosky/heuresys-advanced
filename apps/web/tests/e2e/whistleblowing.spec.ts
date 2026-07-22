/**
 * apps/web/tests/e2e/whistleblowing.spec.ts — #51 E1 whistleblowing channel
 * (D.Lgs 24/2023).
 *
 * NON-PERSISTENT BY DESIGN: this spec never completes a valid anonymous submit.
 * Unlike the demo/lead flows (purged by global-teardown), a whistleblowing report
 * has no such cleanup hook by design — the channel is meant to be tamper-evident,
 * not casually deletable — so a real POST here would permanently write a report
 * into the live D.Lgs 24/2023 channel. The public-form test only exercises
 * CLIENT-SIDE validation (react-hook-form + zodResolver rejects the submit before
 * any network call fires) and the honeypot's hidden-but-present DOM state.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor, gotoAuthenticated } from "./fixtures";

test.describe("Whistleblowing — public channel (anonymous)", () => {
  test("form renders with 7 categories; a too-short subject is blocked client-side; honeypot stays hidden", async ({ page }) => {
    await page.goto("/whistleblowing", { waitUntil: "networkidle", timeout: 60_000 });
    await expect(page.getByTestId("wb-page")).toBeVisible();
    await expect(page.getByTestId("wb-form")).toBeVisible();

    await expect(page.getByTestId("wb-category").locator("option")).toHaveCount(7);

    const honeypot = page.getByTestId("wb-honeypot");
    await expect(honeypot).toBeAttached();
    await expect(honeypot).toBeHidden();
    await expect(honeypot).toHaveValue("");

    // Isolate the subject-length failure: body gets a valid (>=10 char) value so
    // only "subject" is expected to fail zod validation.
    await page.getByTestId("wb-subject").fill("A");
    await page.getByTestId("wb-body").fill("Corpo della segnalazione con più di dieci caratteri.");

    await page.getByTestId("wb-submit").click();

    // zodResolver rejects before mutationFn ever runs — the form stays mounted
    // (never flips to the wb-success card) and marks the offending field invalid.
    await expect(page.getByTestId("wb-subject")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("wb-form")).toBeVisible();
    await expect(page.getByTestId("wb-success")).toHaveCount(0);
  });

  test("status check on a well-formed but nonexistent code returns not-found (no enumeration)", async ({ page }) => {
    await page.goto("/whistleblowing", { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByTestId("wb-status-input").fill("WB-DOES-NOT-EXIST-0000");
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/whistleblowing/status/") && r.request().method() === "GET"),
      page.getByTestId("wb-status-check").click(),
    ]);
    expect(res.status()).toBe(404);
    await expect(page.getByTestId("wb-status-error")).toBeVisible();
  });
});

test.describe("Whistleblowing — custodian console (live)", () => {
  test.use({ storageState: storageStateFor("custodian") });

  test("console renders the live reports list, or a legitimate empty state", async ({ page }) => {
    await gotoAuthenticated(page, "/whistleblowing-console");
    await expect(page.getByTestId("wb-console-page")).toBeVisible();

    const empty = page.getByTestId("wb-console-empty");
    const firstRow = page.getByTestId("wb-console-row").first();
    await expect(empty.or(firstRow)).toBeVisible({ timeout: 15_000 });
  });
});
