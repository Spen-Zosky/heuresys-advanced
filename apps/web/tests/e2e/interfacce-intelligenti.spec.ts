/**
 * apps/web/tests/e2e/interfacce-intelligenti.spec.ts
 *
 * Il controllo automatico del repertorio interfacce (docs/kb/xtras/INTERFACCE_INTELLIGENTI.md,
 * regole di Enzo del 10/11/2026). Apre le pagine con tabelle come TENANT_ADMIN di RTL e misura le
 * regole che una macchina sa vedere (vedi `interfacce-intelligenti.regole.ts`: R3, R4, R5).
 *
 * È un CRICCHETTO, non una fotografia. `interfacce-intelligenti.debiti.json` elenca, pagina per
 * pagina, i rilievi già noti: sono il lavoro dei blocchi di revisione ancora aperti. Il caso
 * diventa rosso quando una pagina mostra un rilievo che non è nel registro: un difetto nuovo, o
 * una pagina nuova nata senza le regole. Quando un rilievo del registro non si vede più, il caso
 * lo annota («debito-pagato») e il blocco che ha corretto la pagina accorcia il registro nella
 * stessa PR: non è rosso perché i dati del banco possono non contenere il valore che lo mostrava.
 * Il registro quindi può solo accorciarsi. Una pagina nuova con tabelle si aggiunge a PAGINE
 * con il registro vuoto: nasce già con le regole.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";
import { misuraPagina } from "./interfacce-intelligenti.regole";

test.use({ storageState: storageStateFor("tenantAdmin") });

const DEBITI: Record<string, string[]> = JSON.parse(
  readFileSync(join(__dirname, "interfacce-intelligenti.debiti.json"), "utf8"),
).pagine;

const PAGINE = Object.keys(DEBITI);

test.describe("Repertorio interfacce intelligenti (R3, R4, R5) — cricchetto", () => {
  for (const route of PAGINE) {
    test(`${route} rispetta le regole o dichiara il suo debito`, async ({ page }) => {
      await page.goto(route);
      expect(new URL(page.url()).pathname, `sessione morta: chiesta ${route}`).toBe(route);
      // Si aspetta il contenuto, non la rete: una tabella con almeno una riga, o lo stato vuoto.
      await page
        .waitForFunction(
          () =>
            document.querySelector("main tbody tr") != null ||
            document.querySelector("[data-testid$='-empty']") != null,
          undefined,
          { timeout: 30_000 },
        )
        .catch(() => {});
      const misura = await page.evaluate(misuraPagina);
      const attesi = new Set(DEBITI[route] ?? []);
      const nuovi = misura.rilievi.filter((r) => !attesi.has(r));
      expect(
        nuovi,
        `${route}: rilievi nuovi ${JSON.stringify(nuovi)} (registro ${JSON.stringify([...attesi])}). ` +
          `Dettagli: ${misura.dettagli.join(" | ")}. Si corregge la pagina, non si allunga il registro.`,
      ).toEqual([]);
      const pagati = [...attesi].filter((r) => !misura.rilievi.includes(r as never));
      if (pagati.length > 0) {
        // Il debito è sparito: il blocco che ha corretto la pagina lo toglie dal registro.
        test.info().annotations.push({
          type: "debito-pagato",
          description: `${route}: ${pagati.join(", ")} non si vede più, togliere dal registro`,
        });
      }
    });
  }
});
