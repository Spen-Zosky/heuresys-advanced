/**
 * apps/web/tests/e2e/role-badge.spec.ts — il ruolo mostrato e' quello giusto.
 *
 * Regressione del difetto trovato dalla dimostrazione del C12 (storia36): il
 * badge dell'intestazione prendeva `roles[0]`, il primo ruolo che l'API
 * restituiva. Poiche' l'invariante I17 da' a chiunque almeno `USER`, una
 * amministratrice di tenant (`federica.marchetti`: USER, TEAM_LEADER,
 * TENANT_ADMIN, CEO) veniva presentata come **«Dipendente»** mentre il titolo
 * della stessa pagina diceva «Amministratore tenant».
 *
 * La prova NON fotografa un'etichetta attesa: interroga l'API per sapere quali
 * ruoli ha davvero la persona, calcola quale dovrebbe prevalere con la stessa
 * regola del prodotto, e verifica che sia quello mostrato. Se domani a federica
 * cambiano i ruoli, il test resta valido.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";
import { primaryRoleOf } from "../../src/lib/role-precedence";
import itShell from "../../src/locales/it/shell.json";

const ETICHETTE = (itShell as { roles: Record<string, string> }).roles;

for (const persona of ["tenantAdmin", "employee", "manager"] as const) {
  test.describe(`intestazione — ruolo mostrato (${persona})`, () => {
    test.use({ storageState: storageStateFor(persona) });

    test("mostra il ruolo di precedenza maggiore fra quelli della persona", async ({ page }) => {
      await gotoAuthenticated(page, "/me");

      // i ruoli VERI di chi ha fatto login, dall'endpoint reale
      // API_BASE arriva senza il prefisso di versione (fixtures.ts lo toglie)
      const me = await page.request.get(`${API_BASE}/v1/auth/me`);
      expect(me.ok()).toBeTruthy();
      const ruoli: string[] = (await me.json()).roles ?? [];
      expect(ruoli.length).toBeGreaterThan(0);

      const atteso = ETICHETTE[primaryRoleOf(ruoli)];
      expect(atteso, `manca l'etichetta i18n per ${primaryRoleOf(ruoli)}`).toBeTruthy();

      // il piede di pagina porta il ruolo dell'identita' corrente
      await expect(page.locator("footer")).toContainText(atteso!, { ignoreCase: true });

      // e se la persona ha un ruolo amministrativo, non puo' essere presentata
      // con l'etichetta di semplice utente
      if (ruoli.some((r) => r !== "USER" && r !== "READ_ONLY" && r !== "TEAM_MEMBER")) {
        const etichettaUtente = ETICHETTE["USER"]!;
        if (atteso!.toLowerCase() !== etichettaUtente.toLowerCase()) {
          await expect(page.locator("footer")).not.toContainText(etichettaUtente, {
            ignoreCase: true,
          });
        }
      }
    });
  });
}
