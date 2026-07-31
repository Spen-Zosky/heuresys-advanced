/**
 * apps/web/tests/e2e/users-editing.spec.ts — la scheda persona si può GOVERNARE (#44, linea C1).
 *
 * Fino a qui `/users/[id]` raccontava una persona ma non lasciava cambiare
 * nulla: `PATCH /v1/users/:id` e i tre endpoint dei ruoli esistevano da MVP-1 e
 * nessuna pagina li chiamava, quindi l'unico modo di correggere un dato era il
 * database. Questa prova percorre il ciclo completo dall'interfaccia.
 *
 * Falsificabilità: non verifica che il form "si invii", verifica che il dato
 * sia CAMBIATO DAVVERO — rilegge dall'API dopo il salvataggio e ricarica la
 * pagina. Se la mutazione non arrivasse al database (o arrivasse e la pagina
 * mostrasse ancora il vecchio valore), il test diventa rosso.
 *
 * Scritture reversibili: il valore originale viene ripristinato in `finally`,
 * e il ruolo assegnato viene revocato dalla prova stessa — che è anche il modo
 * di provare la revoca. Nessun residuo sul tenant.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe.configure({ retries: 1 });

/** I cookie della sessione già autenticata, per interrogare l'API come la pagina. */
async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Intestazioni per SCRIVERE via API (ripristini): oltre ai cookie serve il
 * token CSRF nell'header, perché le rotte di mutazione montano `verifyCsrf`
 * (doppio invio: cookie `hrx_csrf` + header `x-csrf-token`). Senza, il
 * ripristino tornerebbe 403 in silenzio e la prova lascerebbe residui.
 */
async function writeHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === "hrx_csrf")?.value ?? "";
  return {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": csrf,
    "content-type": "application/json",
  };
}

/** Cookie + token CSRF SENZA content-type: per DELETE, che non ha corpo.
 *  Dichiarare `application/json` su una richiesta senza corpo fa rispondere
 *  400 a Fastify ("body cannot be empty") — misurato, non supposto. */
async function deleteHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  return {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": cookies.find((c) => c.name === "hrx_csrf")?.value ?? "",
  };
}

test.describe("scheda persona — anagrafica e ruoli si modificano dall'interfaccia", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("modifica l'anagrafica, la rilegge dal database e la ripristina", async ({ page, request }) => {
    const cookie = await cookieHeader(page);

    // La persona la sceglie l'elenco vero, non una costante nel test: se il
    // tenant cambia, il collaudo continua a valere (regola no-hardcoded-test-data).
    const lista = await request.get(`${API_BASE}/v1/users?limit=1&search=antonio.parisi`, {
      headers: { cookie },
    });
    expect(lista.ok(), "elenco utenti non raggiungibile").toBeTruthy();
    const items = (await lista.json()).items as Array<{ userId: string }>;
    expect(items.length, "nessun utente trovato per il collaudo").toBeGreaterThan(0);
    const userId = items[0]!.userId;

    const prima = await request.get(`${API_BASE}/v1/users/${userId}`, { headers: { cookie } });
    expect(prima.ok(), "anagrafica non leggibile").toBeTruthy();
    const originale = (await prima.json()) as { timezone: string | null };
    const nuovoFuso = originale.timezone === "Europe/Madrid" ? "Europe/Lisbon" : "Europe/Madrid";

    try {
      await gotoAuthenticated(page, `/users/${userId}`);
      await expect(page.getByTestId("user-detail-page")).toBeVisible({ timeout: 45_000 });

      // il pannello esiste ed è in scrittura (TENANT_ADMIN ha user:update)
      await expect(page.getByTestId("user-identity-editor")).toBeVisible();
      await expect(page.getByTestId("user-identity-form")).toBeVisible();

      // il form arriva precompilato col valore reale, non vuoto
      await expect(page.getByTestId("user-edit-timezone")).toHaveValue(originale.timezone ?? "");

      await page.getByTestId("user-edit-timezone").fill(nuovoFuso);
      const [patch] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes(`/v1/users/${userId}`) && r.request().method() === "PATCH",
        ),
        page.getByTestId("user-edit-save").click(),
      ]);
      expect(patch.status(), "il salvataggio non è stato accettato dall'API").toBe(200);
      await expect(page.getByTestId("user-edit-saved")).toBeVisible({ timeout: 15_000 });

      // PROVA VERA #1: il database ha il valore nuovo (non solo il form)
      const dopo = await request.get(`${API_BASE}/v1/users/${userId}`, { headers: { cookie } });
      expect((await dopo.json()).timezone, "il fuso non è stato scritto sul database").toBe(nuovoFuso);

      // PROVA VERA #2: ricaricando la pagina il valore nuovo è quello mostrato
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("user-edit-timezone")).toHaveValue(nuovoFuso, { timeout: 30_000 });
    } finally {
      // ripristino: la prova non lascia il tenant modificato
      const ripristino = await request.patch(`${API_BASE}/v1/users/${userId}`, {
        headers: await writeHeaders(page),
        data: { timezone: originale.timezone },
      });
      expect(ripristino.ok(), "ripristino del fuso non riuscito: il tenant resta modificato").toBeTruthy();
    }
  });

  test("assegna un ruolo e lo revoca, verificando entrambe le volte sull'API", async ({ page, request }) => {
    const cookie = await cookieHeader(page);

    const lista = await request.get(`${API_BASE}/v1/users?limit=1&search=antonio.parisi`, {
      headers: { cookie },
    });
    const items = (await lista.json()).items as Array<{ userId: string }>;
    expect(items.length, "nessun utente trovato per il collaudo").toBeGreaterThan(0);
    const userId = items[0]!.userId;

    // Un ruolo che la persona NON ha già: altrimenti l'assegnazione è un no-op
    // e la prova non proverebbe nulla.
    const attualiRes = await request.get(`${API_BASE}/v1/users/${userId}/roles`, { headers: { cookie } });
    expect(attualiRes.ok(), "ruoli non leggibili").toBeTruthy();
    const attuali = ((await attualiRes.json()).items as Array<{ roleCode: string }>).map((g) => g.roleCode);
    const daAssegnare = ["READ_ONLY", "TEAM_MEMBER", "USER"].find((c) => !attuali.includes(c));
    expect(daAssegnare, "la persona ha già tutti i ruoli candidati: scegline un altro").toBeTruthy();
    const ruolo = daAssegnare!;

    await gotoAuthenticated(page, `/users/${userId}`);
    await expect(page.getByTestId("user-roles-editor")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("user-roles-grant")).toBeVisible();

    try {
      await page.getByTestId("user-role-select").selectOption(ruolo);
      const [post] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes(`/v1/users/${userId}/roles`) && r.request().method() === "POST",
        ),
        page.getByTestId("user-role-grant").click(),
      ]);
      expect(post.status(), "assegnazione non accettata dall'API").toBe(201);

      // il ruolo compare in tabella…
      await expect(page.getByTestId(`user-role-${ruolo}`)).toBeVisible({ timeout: 15_000 });
      // …e sull'API, che è l'unica autorità
      const dopoGrant = await request.get(`${API_BASE}/v1/users/${userId}/roles`, { headers: { cookie } });
      expect(((await dopoGrant.json()).items as Array<{ roleCode: string }>).map((g) => g.roleCode)).toContain(ruolo);

      // revoca dall'interfaccia — è insieme il ripristino e la prova del terzo endpoint
      const [del] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes(`/v1/users/${userId}/roles/`) && r.request().method() === "DELETE",
        ),
        page.getByTestId(`user-role-revoke-${ruolo}`).click(),
      ]);
      expect(del.status(), "revoca non accettata dall'API").toBe(204);

      await expect(page.getByTestId(`user-role-${ruolo}`)).toHaveCount(0, { timeout: 15_000 });
      const dopoRevoke = await request.get(`${API_BASE}/v1/users/${userId}/roles`, { headers: { cookie } });
      expect(
        ((await dopoRevoke.json()).items as Array<{ roleCode: string }>).map((g) => g.roleCode),
        "il ruolo risulta ancora assegnato dopo la revoca",
      ).not.toContain(ruolo);
    } finally {
      // rete di sicurezza: se la revoca dall'interfaccia non fosse avvenuta,
      // la prova non lascia comunque il ruolo appeso alla persona.
      const finali = await request.get(`${API_BASE}/v1/users/${userId}/roles`, { headers: { cookie } });
      if (finali.ok()) {
        for (const g of (await finali.json()).items as Array<{ grantId: string; roleCode: string }>) {
          if (g.roleCode === ruolo && !attuali.includes(ruolo)) {
            await request.delete(`${API_BASE}/v1/users/${userId}/roles/${g.grantId}`, {
              headers: await deleteHeaders(page),
            });
          }
        }
      }
    }
  });
});
