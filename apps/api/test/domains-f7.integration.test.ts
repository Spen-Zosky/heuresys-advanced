/**
 * apps/api/test/domains-f7.integration.test.ts
 *
 * #99 F7 — la visibilità di una voce di menu discende da M1 (ADR-0036 §7), non più dal solo
 * flag `requires_admin`.
 *
 * ⚠ LA TRAPPOLA ATTORNO A CUI QUESTO FILE È COSTRUITO, ed è la stessa di F3.
 * Il contro-oracolo prima/dopo sui 161 attori reali ha misurato un delta di **zero**: nessuno
 * perde una voce, nessuno la guadagna. Quindi **una prova comportamentale sui dati di oggi
 * sarebbe verde in entrambi i casi** — con la derivazione M1 e senza. Non discriminerebbe
 * niente, e passerebbe anche cancellando il codice che verifica.
 *
 * Perciò la prova **fabbrica la divergenza**: compone un attore il cui perimetro viene da una
 * persona che guida una squadra e NON dirige un'unità, con i permessi di chi legge le
 * analytics. M1 dà a `team_lead` `SKILL = read` ma `COMPENSATION = none` e `EVALUATION =
 * none`: la pagina delle competenze gli va offerta, quella delle retribuzioni no — anche col
 * permesso in mano. È il caso che oggi non esiste nei dati e che domani, concedendo un
 * permesso, esisterebbe.
 *
 * Nessuna email, nessun nome di ruolo e nessun conteggio atteso è scritto qui dentro: tutto
 * è derivato dal database.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { meService } from "../src/modules/me/service.js";
import { M1, classiMascherateDa, almenoUnaCellaAperta } from "../src/lib/scope/matrix.js";
import { dominiCheApronoUnaSuperficie } from "../src/lib/scope/domains.js";
import { HR_MANDATED_ROLES } from "../src/lib/scope/resolver.js";
import { MASKED_UNDER_PLATFORM_MANDATE } from "../src/lib/scope/mask.js";
import { RESOURCE_DATA_CLASS, type DataClass } from "../src/lib/scope/data-classes.js";
import type { RoleCode } from "../src/config/constants.js";

interface Persona {
  user_id: string;
  user_email: string;
  tenant_id: string;
  roles: string[];
}

interface VoceClassificata {
  code: string;
  classe: DataClass;
  resource: string | null;
  action: string | null;
}

/** Chi guida una squadra e NON dirige un'unità, non ha mandato HR né è di piattaforma. */
const TEAM_LEAD_PURO = `
  SELECT u.user_id, u.user_email, u.user_tenant_id AS tenant_id,
         array_agg(r.auth_role_code::text ORDER BY r.auth_role_code) AS roles
    FROM sys.sys_users u
    JOIN sys.sys_user_auth_roles uar
      ON uar.user_auth_role_user_id = u.user_id AND uar.user_auth_role_revoked_at IS NULL
    JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
   WHERE u.user_status = 'ACTIVE'
     AND EXISTS (SELECT 1 FROM sys.sys_teams t WHERE t.team_lead_user_id = u.user_id)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_units o
                      WHERE o.organization_unit_manager_user_id = u.user_id
                        AND o.organization_unit_is_active)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur2
                       JOIN sys.sys_auth_roles rr2 ON rr2.auth_role_id = ur2.user_auth_role_role_id
                      WHERE ur2.user_auth_role_user_id = u.user_id
                        AND ur2.user_auth_role_revoked_at IS NULL
                        AND (rr2.auth_role_is_platform
                             OR rr2.auth_role_code IN ('TENANT_ADMIN','HRMS_MANAGER')))
   GROUP BY u.user_id, u.user_email, u.user_tenant_id`;

/** Chi dirige un'unità attiva — il contro-caso, che le stesse pagine deve vederle. */
const CAPO_DI_UNITA = `
  SELECT u.user_id, u.user_email, u.user_tenant_id AS tenant_id,
         array_agg(r.auth_role_code::text ORDER BY r.auth_role_code) AS roles
    FROM sys.sys_users u
    JOIN sys.sys_user_auth_roles uar
      ON uar.user_auth_role_user_id = u.user_id AND uar.user_auth_role_revoked_at IS NULL
    JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
   WHERE u.user_status = 'ACTIVE'
     AND EXISTS (SELECT 1 FROM sys.sys_organization_units o
                  WHERE o.organization_unit_manager_user_id = u.user_id
                    AND o.organization_unit_is_active)
   GROUP BY u.user_id, u.user_email, u.user_tenant_id`;

let t: TestApp;
let teamLeadPuro: Persona | undefined;
let capoDiUnita: Persona | undefined;
/** I ruoli che detengono il permesso di una voce — derivati, mai nominati. */
let ruoliConPermesso = new Map<string, string[]>();
let voci: VoceClassificata[] = [];

/** Un attore col PERIMETRO di `p` e i PERMESSI di `roles`. */
function attore(p: Persona, roles: string[]) {
  return { userId: p.user_id, tenantId: p.tenant_id, roles: roles as RoleCode[] };
}

async function codiciVisibili(a: ReturnType<typeof attore>): Promise<Set<string>> {
  const res = await meService.getInterfaces(a);
  const out = new Set<string>();
  for (const persp of res.perspectives) for (const i of persp.interfaces) out.add(i.code);
  return out;
}

beforeAll(async () => {
  t = await buildTestApp();

  const { rows: vociRows } = await pool.query<VoceClassificata>(
    `SELECT i.ui_interface_code AS code, dc.data_class AS classe,
            i.ui_interface_required_resource AS resource, i.ui_interface_required_action AS action
       FROM sys.sys_ui_interface_data_classes dc
       JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
      WHERE i.ui_interface_is_active`,
  );
  voci = vociRows;

  // ⚠ Solo ruoli NEUTRI: che portino il permesso senza portare un mandato. I mandati sono
  // role-shaped (ADR-0036 §2.5) e aprono le classi da soli — un attore composto con
  // `HRMS_MANAGER` avrebbe `hr_mandate`, cioè `COMPENSATION = edit`, e il caso da provare
  // sparirebbe. È l'errore in cui questo file è caduto alla prima stesura: il test era rosso
  // e il codice aveva ragione.
  const mandati = [...HR_MANDATED_ROLES, "WHISTLEBLOWING_CUSTODIAN"];
  for (const v of voci) {
    if (v.resource === null || v.action === null) continue;
    const { rows } = await pool.query<{ code: string }>(
      `SELECT DISTINCT r.auth_role_code AS code
         FROM sys.sys_auth_roles r
         JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = r.auth_role_id
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE p.auth_permission_code = $1
          AND NOT r.auth_role_is_platform
          AND r.auth_role_code <> ALL($2::text[])`,
      [`${v.resource}:${v.action}`, mandati],
    );
    ruoliConPermesso.set(v.code, rows.map((r) => r.code));
  }

  const { rows: tl } = await pool.query<Persona>(TEAM_LEAD_PURO);
  teamLeadPuro = tl[0];
  const { rows: cu } = await pool.query<Persona>(CAPO_DI_UNITA);
  capoDiUnita = cu[0];
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#99 F7 — la voce di menu discende dalla matrice", () => {
  it("gira su un universo in cui PUÒ fallire", async () => {
    expect(voci.length, "nessuna voce dichiara una classe — la derivazione non ha su cosa agire")
      .toBeGreaterThan(0);
    expect(voci.some((v) => v.classe === "COMPENSATION"),
      "nessuna voce espone COMPENSATION: il caso discriminante non esiste").toBe(true);
    expect(voci.some((v) => v.classe === "SKILL"),
      "nessuna voce espone SKILL: manca il contro-caso positivo").toBe(true);
    expect(teamLeadPuro, "nessuno guida una squadra senza dirigere un'unità").toBeTruthy();
    expect(capoDiUnita, "nessuno dirige un'unità").toBeTruthy();

    // Il perimetro dei due soggetti deve essere DIVERSO, o il confronto non prova nulla.
    const dTl = await dominiCheApronoUnaSuperficie(pool, attore(teamLeadPuro!, teamLeadPuro!.roles));
    const dCu = await dominiCheApronoUnaSuperficie(pool, attore(capoDiUnita!, capoDiUnita!.roles));
    expect(dTl.has("team_lead"), "il soggetto scelto non risolve team_lead").toBe(true);
    expect(dTl.has("line_management"), "il team lead 'puro' dirige anche un'unità").toBe(false);
    expect(dCu.has("line_management"), "il capo di unità non risolve line_management").toBe(true);
  });

  /**
   * IL CUORE. Stesso permesso, perimetri diversi → pagine diverse. Se la derivazione M1
   * sparisse dal service, il team lead vedrebbe anche le retribuzioni e questo test va rosso.
   */
  it("nega al capo-squadra le classi che M1 gli chiude, e gli lascia quelle che gli apre", async () => {
    const compensation = voci.filter((v) => v.classe === "COMPENSATION");
    const skill = voci.filter((v) => v.classe === "SKILL");
    let provati = 0;

    for (const v of compensation) {
      const ruoli = ruoliConPermesso.get(v.code) ?? [];
      if (ruoli.length === 0) continue; // nessun ruolo detiene il permesso: caso non costruibile
      provati++;
      const visti = await codiciVisibili(attore(teamLeadPuro!, ruoli));
      expect(visti.has(v.code),
        `${v.code} espone COMPENSATION e M1 dà 'none' a team_lead: non va offerta`).toBe(false);
      // …e lo STESSO permesso, su chi guida una catena, la apre. Senza questa metà, un
      // `return false` incondizionato passerebbe il test.
      const vistiCapo = await codiciVisibili(attore(capoDiUnita!, ruoli));
      expect(vistiCapo.has(v.code),
        `${v.code} non arriva a chi dirige un'unità: M1 gli dà 'mask', non 'none'`).toBe(true);
    }

    for (const v of skill) {
      const ruoli = ruoliConPermesso.get(v.code) ?? [];
      if (ruoli.length === 0) continue;
      provati++;
      const visti = await codiciVisibili(attore(teamLeadPuro!, ruoli));
      expect(visti.has(v.code),
        `${v.code} espone SKILL e M1 dà 'read' a team_lead: va offerta`).toBe(true);
    }

    // Senza questa riga il test passerebbe a vuoto il giorno in cui nessun ruolo neutro
    // detiene più quei permessi: ogni caso verrebbe saltato dal `continue` e il verde
    // direbbe «provato», mentre non è stato provato niente.
    expect(provati, "nessun caso costruibile: il test non ha verificato nulla")
      .toBeGreaterThan(0);
  });

  /** I17 — il pavimento universale non passa da M1, e non deve mai passarci. */
  it("non sottopone a M1 nessuna voce dell'area personale", async () => {
    const { rows } = await pool.query<{ code: string }>(
      `SELECT i.ui_interface_code AS code
         FROM sys.sys_ui_interface_data_classes dc
         JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
        WHERE i.ui_interface_perspective = 'PERSONAL'`,
    );
    expect(rows.map((r) => r.code),
      "una voce personale ha una classe: sparirebbe dal menu di chi non ha domini — I17 violata",
    ).toEqual([]);
  });

  /** Una lista vuota di classi è un'affermazione («non espone dati di persona»), non un buco. */
  it("lascia visibile ciò che non espone dati di persona", () => {
    expect(almenoUnaCellaAperta(new Set(), []),
      "una voce senza classi sparirebbe: i cataloghi diventerebbero irraggiungibili").toBe(true);
    expect(almenoUnaCellaAperta(new Set(["team_lead"]), ["COMPENSATION"])).toBe(false);
    expect(almenoUnaCellaAperta(new Set(["team_lead"]), ["COMPENSATION", "SKILL"]),
      "basta UNA cella aperta fra tutte le classi esposte").toBe(true);
  });

  /** La duplicazione ritirata: `mask.ts` non dichiara più, deriva. */
  it("deriva da M1 le classi mascherate sotto mandato tecnico", () => {
    const daM1 = classiMascherateDa("platform_mandate");
    expect([...MASKED_UNDER_PLATFORM_MANDATE].sort()).toEqual([...daM1].sort());
    expect(daM1.has("COMPENSATION")).toBe(true);
    expect(daM1.has("EVALUATION")).toBe(true);
    expect(daM1.has("PERSONAL"),
      "PERSONAL risulta mascherata: M1 dice 'edit', qualcuno ha cambiato la cella").toBe(false);
  });

  /**
   * IL CANCELLO CONTRO LA DERIVA. Una voce la cui resource è classificata person-level DEVE
   * dichiarare almeno quella classe. Senza questo, fra sei mesi una pagina nuova nasce senza
   * dichiarazione e M1 smette di avere voce in capitolo — cioè si torna a `requires_admin`.
   */
  it("esige la classe su ogni voce la cui resource è person-level", async () => {
    const { rows } = await pool.query<{ code: string; resource: string; classi: string[] | null }>(
      `SELECT i.ui_interface_code AS code, i.ui_interface_required_resource AS resource,
              array_agg(dc.data_class) FILTER (WHERE dc.data_class IS NOT NULL) AS classi
         FROM sys.sys_ui_interfaces i
         LEFT JOIN sys.sys_ui_interface_data_classes dc ON dc.ui_interface_id = i.ui_interface_id
        WHERE i.ui_interface_is_active
          AND i.ui_interface_required_resource IS NOT NULL
          AND i.ui_interface_perspective <> 'PERSONAL'
        GROUP BY i.ui_interface_code, i.ui_interface_required_resource`,
    );
    const mancanti: string[] = [];
    for (const r of rows) {
      const attesa = RESOURCE_DATA_CLASS[r.resource];
      if (attesa === undefined) continue; // resource non person-level: nessun obbligo
      if (!(r.classi ?? []).includes(attesa)) mancanti.push(`${r.code} (${r.resource} → ${attesa})`);
    }
    expect(mancanti,
      "queste voci hanno una resource person-level e non dichiarano la sua classe",
    ).toEqual([]);
  });

  /** La matrice è totale: 10 domini × 7 classi, nessuna cella dimenticata. */
  it("dichiara ogni cella di ogni dominio", () => {
    const classi: DataClass[] = ["PERSONAL", "COMPENSATION", "SKILL", "EVALUATION",
                                 "ACTIVITY", "CREDENTIAL", "SPECIAL_CATEGORY"];
    for (const [dominio, riga] of Object.entries(M1)) {
      for (const c of classi) {
        expect(riga[c], `M1[${dominio}][${c}] non è dichiarata`).toBeDefined();
      }
    }
    // SPECIAL_CATEGORY è `none` per OGNI dominio (ADR-0036 §5): classe vuota e presidiata.
    for (const [dominio, riga] of Object.entries(M1)) {
      expect(riga.SPECIAL_CATEGORY,
        `${dominio} apre SPECIAL_CATEGORY: l'eccezione dichiarata da ADR-0036 §5 è saltata`,
      ).toBe("none");
    }
  });
});
