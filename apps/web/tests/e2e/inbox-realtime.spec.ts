/**
 * apps/web/tests/e2e/inbox-realtime.spec.ts — #38 B6.
 *
 * LIVE-DATA-E2E-ONLY: la prova che l'intera voce esiste per dare. Un dipendente tiene
 * aperta la sua posta in arrivo; un amministratore invia una notifica dall'API reale
 * (`POST /v1/notifications`); la notifica deve comparire **senza ricaricare la pagina**
 * e ben prima dei 30 secondi del vecchio sondaggio.
 *
 * È anche l'unico posto dove si verifica che il flusso SSE attraversi il **proxy Next**
 * (`/api/*` → API): un proxy che accumula la risposta è il modo tipico in cui SSE
 * funziona nei test di integrazione e tace in produzione. Nessun test lato API può
 * accorgersene, perché lì il proxy non c'è.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, PERSONAS, API_BASE, passwordFor, totpFor } from "./fixtures";

test.use({ storageState: storageStateFor("employee") });
test.describe.configure({ retries: 1 });

/** Sessione API di un amministratore che può inviare notifiche (`notification:create`). */
async function adminSession(request: import("@playwright/test").APIRequestContext) {
  const email = PERSONAS.tenantAdmin.email;
  let res = await request.post(`${API_BASE}/v1/auth/login`, {
    data: { email, password: passwordFor(email) },
  });
  let body = await res.json();
  if (body.status === "mfa_required") {
    res = await request.post(`${API_BASE}/v1/auth/login`, {
      data: { email, password: passwordFor(email), challengeToken: body.challengeToken, mfaCode: totpFor(email) },
    });
    body = await res.json();
  }
  expect(body.status).toBe("success");
  return body.csrfToken as string;
}

/** L'identificativo del destinatario, letto dalla sua stessa sessione: nessun UUID scritto a mano. */
async function employeeUserId(page: import("@playwright/test").Page): Promise<string> {
  const res = await page.request.get("/api/v1/auth/me");
  expect(res.status()).toBe(200);
  const me = await res.json();
  return me.userId as string;
}

test.describe("#38 B6 — la posta in arrivo si aggiorna da sola", () => {
  test("una notifica inviata ora compare senza ricaricare la pagina", async ({ page, request }) => {
    await page.goto("/me/inbox", { waitUntil: "domcontentloaded", timeout: 60_000 });
    // La pagina dev'essere carica e il flusso aperto prima dell'invio, altrimenti si
    // starebbe misurando un normale caricamento iniziale.
    await expect(page.getByTestId("me-inbox-page")).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(2_000);

    const userId = await employeeUserId(page);
    const csrf = await adminSession(request);
    const subject = `E2E SSE ${Date.now()}`;

    const t0 = Date.now();
    const sent = await request.post(`${API_BASE}/v1/notifications`, {
      headers: { "x-csrf-token": csrf },
      data: { userIds: [userId], subject, body: "prova di consegna in tempo reale", priority: "MEDIUM" },
    });
    expect(sent.status()).toBe(200);
    expect((await sent.json()).emitted).toBeGreaterThan(0);

    // NESSUN reload: se la pagina si aggiorna, è perché l'evento è arrivato.
    await expect(page.getByText(subject)).toBeVisible({ timeout: 20_000 });
    const elapsed = Date.now() - t0;

    // Il punto della voce: molto prima dei 30s del sondaggio che sostituisce. La soglia
    // è larga rispetto ai tempi osservati perché il ripiego a 60s non può salvarla —
    // se il flusso non funzionasse, questo test scadrebbe.
    expect(elapsed).toBeLessThan(20_000);
  });

  test("il flusso attraversa il proxy senza essere accumulato", async ({ page }) => {
    await page.goto("/me/inbox", { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Un proxy che accumula consegna gli header e poi tace: la connessione risulta aperta
    // e muta. Si legge quindi il PRIMO pezzo del corpo — è ciò che distingue un flusso
    // vivo da una connessione appesa. Non si può usare `request.get`: aspetterebbe un
    // corpo che per definizione non finisce mai.
    const probe = await page.evaluate(async () => {
      const ac = new AbortController();
      const res = await fetch("/api/v1/me/inbox/stream", { signal: ac.signal });
      const headers = {
        contentType: res.headers.get("content-type"),
        buffering: res.headers.get("x-accel-buffering"),
      };
      const reader = res.body!.getReader();
      const first = await Promise.race([
        reader.read().then((x) => new TextDecoder().decode(x.value ?? new Uint8Array())),
        new Promise<string | null>((r) => setTimeout(() => r(null), 8_000)),
      ]);
      ac.abort();
      return { status: res.status, ...headers, first };
    });

    expect(probe.status).toBe(200);
    expect(probe.contentType).toContain("text/event-stream");
    expect(probe.buffering).toBe("no");
    // Il commento di apertura scritto dal server: se il proxy accumulasse, sarebbe null.
    expect(probe.first).not.toBeNull();
    expect(probe.first).toContain(":");
  });
});
