/**
 * apps/api/test/barra-laterale-per-funzione.integration.test.ts
 *
 * Mig. 000484 — la barra laterale si ordina PER FUNZIONE (rilievo di Enzo del 2026-11-10, entrato
 * come Valentina Conti: voci senza un criterio, gruppi non funzionali, 16 voci senza icona,
 * «Console» e «Cruscotto» accanto a «Dashboard»).
 *
 * Ciò che resta letterale è il CONTRATTO DI DISEGNO, come le cinque sezioni in
 * `me-interfaces.integration.test.ts`: i tredici gruppi funzionali e il loro ordine. Le voci
 * NON sono elencate qui: si leggono dal registro, così una pagina nuova non richiede di
 * toccare questo file — le basta dichiarare un gruppo, un'icona e un'etichetta coerenti.
 */

import { describe, it, expect } from "vitest";
import { pool } from "../src/db/client.js";

/** I gruppi funzionali, nell'ordine in cui la barra li mostra (blocchi di 100 di `order`). */
const GRUPPI = [
  "dashboards", "organization", "processes", "people", "talent", "skills", "analytics",
  "compliance", "configuration", "me", "me_profile", "me_growth", "me_results",
] as const;
const GRUPPI_PERSONALI = new Set(["me", "me_profile", "me_growth", "me_results"]);

interface Voce {
  route: string; perspective: string; grp: string; ord: number; icon: string | null; label: string;
}

async function vociAttive(): Promise<Voce[]> {
  const r = await pool.query<Voce>(
    `SELECT ui_interface_route AS route, ui_interface_perspective AS perspective,
            ui_interface_sidebar_group AS grp, ui_interface_order AS ord,
            ui_interface_icon AS icon, ui_interface_label AS label
       FROM sys.sys_ui_interfaces WHERE ui_interface_is_active
      ORDER BY ui_interface_order, ui_interface_route`,
  );
  return r.rows;
}

describe("000484 — la barra laterale per funzione", () => {
  it("ogni voce attiva sta in uno dei tredici gruppi funzionali", async () => {
    const fuori = (await vociAttive()).filter((v) => !(GRUPPI as readonly string[]).includes(v.grp));
    expect(fuori.map((v) => `${v.route} → ${v.grp}`)).toEqual([]);
  });

  it("i gruppi si susseguono nell'ordine dichiarato, senza voci intercalate", async () => {
    const voci = await vociAttive();
    const sequenza = voci.map((v) => v.grp).filter((g, i, a) => i === 0 || a[i - 1] !== g);
    // Ogni gruppo compare UNA volta sola nella sequenza ordinata per `order`: se una voce
    // finisse in mezzo a un altro gruppo, il frontend (che ordina i gruppi per la voce di
    // ordine più basso) disegnerebbe comunque bene, ma l'intento dichiarato sarebbe rotto.
    expect(new Set(sequenza).size).toBe(sequenza.length);
    const attesi = GRUPPI.filter((g) => sequenza.includes(g));
    expect(sequenza).toEqual(attesi);
  });

  it("ogni voce attiva dichiara un'icona di lucide in forma PascalCase", async () => {
    const senza = (await vociAttive()).filter((v) => !v.icon || !/^[A-Z][A-Za-z0-9]+$/.test(v.icon));
    expect(senza.map((v) => `${v.route} [${v.icon ?? "∅"}]`)).toEqual([]);
  });

  it("l'area personale (I17) sta tutta e sola nei gruppi personali", async () => {
    const voci = await vociAttive();
    const storte = voci.filter((v) => {
      const personale = v.route === "/me" || v.route.startsWith("/me/");
      return personale !== GRUPPI_PERSONALI.has(v.grp) || personale !== (v.perspective === "PERSONAL");
    });
    expect(storte.map((v) => `${v.route} → ${v.perspective}/${v.grp}`)).toEqual([]);
  });

  it("un termine solo: nessuna voce né dashboard dice «console» o «cruscotto»", async () => {
    const voci = (await vociAttive()).filter((v) => /^(console|cruscotto)\b/i.test(v.label));
    expect(voci.map((v) => v.label)).toEqual([]);
    const d = await pool.query<{ name: string }>(
      `SELECT dashboard_name AS name FROM sys.sys_dashboards WHERE dashboard_name ILIKE 'cruscotto%'`,
    );
    expect(d.rows.map((r) => r.name)).toEqual([]);
  });
});
