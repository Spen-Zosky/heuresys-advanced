/**
 * apps/api/test/dashboards-f2.integration.test.ts
 *
 * #142 F2 — il modello dei cruscotti: otto famiglie, le viste che le compongono, le classi
 * che ciascuna vista espone, e il permesso proprio di ognuna (mig. `000316`).
 *
 * ⚠ COSA QUESTO FILE NON FA, ed è deliberato: non ri-conta ciò che la migrazione già asserisce
 * nelle sue post-condizioni (8 famiglie, 27 viste, 21 classi). Ripeterlo qui darebbe due
 * dichiarazioni dello stesso fatto in due posti — la forma di divergenza che #142 F2 esiste
 * per togliere. Qui si prova ciò che il SQL non può provare: il COMPORTAMENTO della
 * derivazione, e le affermazioni che la migrazione fa nei propri commenti.
 *
 * Nessun conteggio atteso, nessuna email e nessun nome di ruolo sono scritti a mano: tutto è
 * derivato dal database vivo.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { M1, almenoUnaCellaAperta } from "../src/lib/scope/matrix.js";
import { scopeTierAndRole, type Domain } from "../src/lib/scope/domains.js";
import type { DataClass } from "../src/lib/scope/data-classes.js";
import { roleGrantSize } from "../src/middleware/rbac.js";
import { posizioniNelPerimetroOrganizzativo } from "../src/modules/dashboard/repository.js";
import type { RoleCode } from "../src/config/constants.js";

interface Famiglia {
  code: string;
  permesso: string | null;
  classi: DataClass[];
}

let app: TestApp;
let famiglie: Famiglia[];
let classiDellaVoceDashboard: DataClass[];

beforeAll(async () => {
  app = await buildTestApp();

  const r = await pool.query<{ code: string; permesso: string | null; classi: DataClass[] }>(
    `SELECT d.dashboard_code AS code,
            d.dashboard_permission_code AS permesso,
            coalesce(array_agg(DISTINCT c.data_class) FILTER (WHERE c.data_class IS NOT NULL), '{}') AS classi
       FROM sys.sys_dashboards d
       LEFT JOIN sys.sys_dashboard_blocks b
              ON b.dashboard_id = d.dashboard_id AND b.dashboard_block_is_active
       LEFT JOIN sys.sys_dashboard_block_data_classes c
              ON c.dashboard_block_id = b.dashboard_block_id
      GROUP BY 1, 2
      ORDER BY 1`,
  );
  famiglie = r.rows;

  const d = await pool.query<{ data_class: DataClass }>(
    `SELECT c.data_class
       FROM sys.sys_ui_interface_data_classes c
       JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = c.ui_interface_id
      WHERE i.ui_interface_code = 'dashboard'`,
  );
  classiDellaVoceDashboard = d.rows.map((x) => x.data_class);
});

afterAll(async () => {
  await app.app.close();
  await closePool();
});

describe("#142 F2 — il modello dei cruscotti", () => {
  it("ogni permesso dichiarato da una famiglia esiste davvero nel catalogo RBAC", async () => {
    // Nessuna FK puo' garantirlo: `dashboard_permission_code` e' un codice, non una chiave.
    // Un refuso qui produrrebbe un cruscotto che NESSUNO potra' mai aprire, e nessun errore
    // lo direbbe — la pagina semplicemente non comparirebbe a nessuno, per sempre.
    const codici = famiglie.map((f) => f.permesso).filter((p): p is string => p !== null);
    expect(codici.length).toBeGreaterThan(0);

    const r = await pool.query<{ auth_permission_code: string }>(
      `SELECT auth_permission_code FROM sys.sys_auth_permissions WHERE auth_permission_code = ANY($1)`,
      [codici],
    );
    expect(r.rows.map((x) => x.auth_permission_code).sort()).toEqual([...codici].sort());
  });

  it("il Self-Service e' l'unica famiglia senza permesso — I17, il pavimento universale", () => {
    const senzaPermesso = famiglie.filter((f) => f.permesso === null).map((f) => f.code);
    // Un permesso sul self sarebbe la possibilita' TECNICA di negare a una persona i propri
    // stessi dati. Che nessuno la userebbe non c'entra: I17 dice che non deve esistere.
    expect(senzaPermesso).toEqual(["self"]);
    expect(famiglie.find((f) => f.code === "self")?.classi).toEqual([]);
  });

  it("le classi dichiarate sono solo quelle che M1 conosce", () => {
    const classiDiM1 = new Set(Object.keys(M1.hr_mandate) as DataClass[]);
    for (const f of famiglie) {
      for (const c of f.classi) {
        expect(classiDiM1.has(c), `${f.code} dichiara ${c}, che M1 non ha`).toBe(true);
      }
    }
  });

  it("dichiarare le classi della voce `dashboard` non toglie la voce a NESSUN dominio", () => {
    // E' l'affermazione che la mig. 000315 fa nel proprio commento («la dichiarazione
    // RESTRINGE, quindi e' stata misurata prima: nessuno perde la voce»). Qui si verifica
    // invece di crederle: se un domani qualcuno aggiungesse `COMPENSATION` a quella voce,
    // questa prova diventerebbe rossa e direbbe esattamente chi ci rimette.
    expect(classiDellaVoceDashboard.length).toBeGreaterThan(0);
    for (const dominio of Object.keys(M1) as Domain[]) {
      expect(
        almenoUnaCellaAperta(new Set([dominio]), classiDellaVoceDashboard),
        `il dominio ${dominio} perderebbe la voce dashboard`,
      ).toBe(true);
    }
  });

  it("il cruscotto HR e' l'UNICO che espone la classe economica", () => {
    // Non e' un dettaglio estetico: `COMPENSATION` e' la classe su cui S1060 ha misurato una
    // fuga reale. Se una seconda famiglia la esponesse, la platea di quella fuga
    // raddoppierebbe in silenzio.
    const conEconomico = famiglie.filter((f) => f.classi.includes("COMPENSATION")).map((f) => f.code);
    expect(conEconomico).toEqual(["hr"]);
  });

  it("M1 RESTRINGE ma non decide: sul cruscotto HR il muro e' il permesso, non la matrice", () => {
    // La divergenza fabbricata, nello stile di F7. `team_lead` ha COMPENSATION = none ed
    // EVALUATION = none, ma il cruscotto HR espone ANCHE `PERSONAL`, su cui ha `mask`:
    // quindi M1 da' via libera. Chi lo ferma e' il permesso RBAC, che non ha.
    // La prova serve a impedire che qualcuno, un domani, "semplifichi" togliendo il permesso
    // proprio per famiglia convinto che basti la matrice.
    const hr = famiglie.find((f) => f.code === "hr");
    expect(hr).toBeDefined();
    expect(almenoUnaCellaAperta(new Set<Domain>(["team_lead"]), hr!.classi)).toBe(true);
    expect(hr!.permesso).not.toBeNull();
  });

  it("la sentinella del disallineamento si vede ROSSA su un aggancio incoerente", async () => {
    // Una sentinella mai vista fallire non e' una prova. Qui l'aggancio finto vive dentro una
    // transazione annullata: la produzione non viene toccata, ma la vista viene interrogata
    // sullo stato in cui DEVE parlare.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const iface = await client.query<{ id: string }>(
        `SELECT ui_interface_id AS id FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'system-health'`,
      );
      expect(iface.rows.length).toBe(1);

      // `hr` espone COMPENSATION; `system-health` non dichiara alcuna classe. L'aggancio e'
      // quindi incoerente per costruzione.
      await client.query(
        `UPDATE sys.sys_dashboards SET dashboard_ui_interface_id = $1 WHERE dashboard_code = 'hr'`,
        [iface.rows[0]!.id],
      );
      const drift = await client.query(`SELECT * FROM sys.v_dashboard_class_drift`);
      expect(drift.rows.length).toBeGreaterThan(0);
      expect(drift.rows.every((r) => r.dashboard_code === "hr")).toBe(true);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }

    // ...e dopo l'annullamento la sentinella deve essere tornata muta.
    const dopo = await pool.query(`SELECT * FROM sys.v_dashboard_class_drift`);
    expect(dopo.rows.length).toBe(0);
  });
});

describe("#142 F2 — i due residui del modulo dashboard", () => {
  it("l'etichetta del ruolo si deriva dall'ampiezza reale, e la lista a mano era gia' sbagliata", async () => {
    // La `highestRoleLabel` cancellata metteva BLUEPRINT_MANAGER SOPRA HRMS_MANAGER. Qui
    // l'ordine non e' scritto: si legge dalla mappa RBAC caricata all'avvio.
    const ampiezzaHr = roleGrantSize("HRMS_MANAGER" as RoleCode);
    const ampiezzaBlueprint = roleGrantSize("BLUEPRINT_MANAGER" as RoleCode);
    expect(ampiezzaHr).toBeGreaterThan(0);
    // I22 dichiara HRMS_MANAGER plenipotenziario sui dati business: se un giorno la sua
    // concessione scendesse sotto quella di BLUEPRINT_MANAGER, l'invariante sarebbe da
    // ridiscutere — e questa prova lo direbbe invece di lasciarlo passare.
    expect(ampiezzaHr).toBeGreaterThan(ampiezzaBlueprint);
  });

  it("un ruolo sconosciuto non vince un confronto di ampiezza", () => {
    expect(roleGrantSize("RUOLO_CHE_NON_ESISTE" as RoleCode)).toBe(0);
  });

  it("al tier TEAM l'etichetta e' un DOMINIO, non un ruolo — e il ruolo-pavimento non vince", async () => {
    // Difetto trovato dalla dimostrazione live, non dai test: `cristina.gatti`, che e'
    // BRANCH_MANAGER, usciva etichettata `USER`, perche' il ruolo-pavimento porta 56 permessi
    // contro gli 11 del ruolo che la descrive. Al tier TEAM il perimetro non lo giustifica un
    // ruolo — lo giustifica un dominio — e questa prova impedisce di tornare indietro.
    const capo = await pool.query<{ user_id: string; tenant_id: string }>(
      `SELECT o.organization_unit_manager_user_id AS user_id, o.organization_unit_tenant_id AS tenant_id
         FROM sys.sys_organization_units o
        WHERE o.organization_unit_is_active AND o.organization_unit_manager_user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM sys.sys_user_auth_roles uar
              JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
             WHERE uar.user_auth_role_user_id = o.organization_unit_manager_user_id
               AND uar.user_auth_role_revoked_at IS NULL
               AND r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER',
                                        'BLUEPRINT_MANAGER', 'PROCESS_OWNER', 'CEO'))
        LIMIT 1`,
    );
    expect(capo.rows.length).toBe(1);
    const ruoli = await pool.query<{ code: string }>(
      `SELECT r.auth_role_code AS code FROM sys.sys_user_auth_roles uar
         JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
        WHERE uar.user_auth_role_user_id = $1 AND uar.user_auth_role_revoked_at IS NULL`,
      [capo.rows[0]!.user_id],
    );

    const esito = await scopeTierAndRole(pool, {
      userId: capo.rows[0]!.user_id,
      tenantId: capo.rows[0]!.tenant_id,
      roles: ruoli.rows.map((r) => r.code) as RoleCode[],
    }, "prova-142-f2");

    expect(esito.tier).toBe("TEAM");
    // L'etichetta e' un dominio di M1...
    expect(Object.keys(M1)).toContain(esito.role);
    // ...e NON uno dei suoi codici di ruolo, che e' il difetto preciso corretto qui.
    expect(ruoli.rows.map((r) => r.code)).not.toContain(esito.role);
  });

  it("il perimetro viene dall'albero delle UNITA', non da quello delle posizioni", async () => {
    // Si prende una persona che dirige davvero un'unita' e si confronta il risultato della
    // funzione con la stessa domanda posta in SQL per un'altra strada.
    const capo = await pool.query<{ user_id: string }>(
      `SELECT o.organization_unit_manager_user_id AS user_id
         FROM sys.sys_organization_units o
        WHERE o.organization_unit_is_active
          AND o.organization_unit_manager_user_id IS NOT NULL
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
    );
    expect(capo.rows.length).toBe(1);
    const userId = capo.rows[0]!.user_id;

    const dalCodice = await posizioniNelPerimetroOrganizzativo(pool, userId);
    const daSql = await pool.query<{ position_id: string }>(
      `WITH RECURSIVE mie AS (
         SELECT organization_unit_id AS ou FROM sys.sys_organization_units
          WHERE organization_unit_manager_user_id = $1 AND organization_unit_is_active
         UNION
         SELECT o.organization_unit_id FROM sys.sys_organization_units o
           JOIN mie m ON o.organization_unit_parent_id = m.ou
          WHERE o.organization_unit_is_active
       )
       SELECT DISTINCT p.position_id FROM sys.sys_positions p
         JOIN mie m ON m.ou = p.position_organization_unit_id
        WHERE p.position_is_active`,
      [userId],
    );
    expect([...dalCodice].sort()).toEqual(daSql.rows.map((r) => r.position_id).sort());
    expect(dalCodice.length).toBeGreaterThan(0);
  });

  it("il cambio d'albero non toglie il perimetro a nessuno che possa aprire quelle pagine", async () => {
    // La misura che ha autorizzato il cambio, resa ripetibile: fra chi detiene uno dei tre
    // permessi, nessuno passa da «vedeva qualcosa» a «vede il vuoto».
    const r = await pool.query<{ persi: string }>(
      `WITH abilitati AS (
         SELECT DISTINCT uar.user_auth_role_user_id AS user_id
           FROM sys.sys_user_auth_roles uar
           JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = uar.user_auth_role_role_id
           JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
          WHERE uar.user_auth_role_revoked_at IS NULL
            AND p.auth_permission_code IN ('dashboard:view', 'analytics:view', 'insights:view')
       ),
       vecchio AS (
         SELECT position_owner_user_id AS user_id FROM sys.sys_positions
          WHERE position_is_active AND position_owner_user_id IS NOT NULL GROUP BY 1
       ),
       nuovo AS (
         SELECT o.organization_unit_manager_user_id AS user_id
           FROM sys.sys_organization_units o
          WHERE o.organization_unit_is_active
            AND o.organization_unit_manager_user_id IS NOT NULL
          GROUP BY 1
       )
       SELECT count(*)::text AS persi
         FROM abilitati a JOIN vecchio v USING (user_id)
        WHERE NOT EXISTS (SELECT 1 FROM nuovo n WHERE n.user_id = a.user_id)`,
    );
    expect(Number(r.rows[0]!.persi)).toBe(0);
  });
});
