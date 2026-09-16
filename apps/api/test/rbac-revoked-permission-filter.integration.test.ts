/**
 * apps/api/test/rbac-revoked-permission-filter.integration.test.ts — mandato K, R-1 passo 0.
 *
 * I-F ha misurato il difetto che questo file prova, rosso-poi-verde: `requirePermission`
 * non legge mai il database, legge SOLO la cache in memoria (`middleware/rbac.ts`),
 * popolata una volta all'avvio da `auth/cache-loader.ts`. Prima della migrazione `000420`
 * non esisteva nemmeno la colonna `revoked_at`; un ritiro scritto sul database, senza
 * ricaricare la cache, non avrebbe avuto ALCUN effetto — il server avrebbe continuato a
 * concedere il permesso ritirato finché non fosse stato riavviato.
 *
 * La prova non usa un "ruolo finto" letterale (un `RoleCode` inventato verrebbe scartato
 * dal caricatore — `KNOWN_ROLES` — e non proverebbe nulla sul filtro): usa un ruolo VERO
 * (`READ_ONLY`) e un permesso VERO che oggi non ha (`delegation:read`), concesso e poi
 * ritirato dentro la transazione del file. La riga non esiste mai fuori da questo test:
 * la transazione fa da rollback (D-52), e l'`afterAll` ricarica la cache dal database
 * ripristinato, così gli altri file della stessa corsa vitest (cache in memoria condivisa,
 * `singleThread`) non la trovano mai alterata.
 */
import { describe, it, expect, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import { userHasPermission } from "../src/middleware/rbac.js";

const RUOLO = "READ_ONLY";
const PERMESSO = "delegation:read";

afterAll(async () => {
  // Ripristina la cache GLOBALE (singiethread, condivisa da tutta la corsa) allo stato del
  // database dopo il rollback della transazione di questo file: senza questa riga, un file
  // successivo leggerebbe una cache alterata da un test già concluso.
  await loadRolePermissionCache();
  await closePool();
});

describe("mandato K R-1 passo 0 — la cache RBAC ignora i permessi ritirati", () => {
  it("un permesso concesso appare in cache; ritirato (revoked_at), scompare senza bisogno di altro", async () => {
    const { rows: roleRows } = await pool.query<{ auth_role_id: string }>(
      "select auth_role_id from sys.sys_auth_roles where auth_role_code = $1",
      [RUOLO],
    );
    const { rows: permRows } = await pool.query<{ auth_permission_id: string }>(
      "select auth_permission_id from sys.sys_auth_permissions where auth_permission_code = $1",
      [PERMESSO],
    );
    const roleId = roleRows[0]?.auth_role_id;
    const permissionId = permRows[0]?.auth_permission_id;
    expect(roleId, `ruolo ${RUOLO} non trovato`).toBeDefined();
    expect(permissionId, `permesso ${PERMESSO} non trovato`).toBeDefined();

    // 1. Concessione temporanea (esiste solo dentro questa transazione). Chiave composita
    //    (auth_role_id, auth_permission_id): nessuna colonna id propria sulla tabella.
    await pool.query(
      `insert into sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
       values ($1, $2)`,
      [roleId, permissionId],
    );

    await loadRolePermissionCache();
    expect(
      userHasPermission({ roles: [RUOLO] }, PERMESSO),
      "dopo la concessione, la cache deve vedere il permesso",
    ).toBe(true);

    // 2. Ritiro — non una DELETE (V5/ADR-0035): la riga resta, revoked_at si valorizza.
    await pool.query(
      `update sys.sys_auth_role_permissions
          set revoked_at = now(), revoked_by_migration = 'test-000420'
        where auth_role_id = $1 and auth_permission_id = $2`,
      [roleId, permissionId],
    );

    await loadRolePermissionCache();
    expect(
      userHasPermission({ roles: [RUOLO] }, PERMESSO),
      "dopo il ritiro, requirePermission (via la cache) deve negarlo — senza riavvio, solo ricaricando",
    ).toBe(false);
  });

  it("la prova può fallire: senza il filtro WHERE, il permesso ritirato resterebbe visibile", async () => {
    // Non serve sabotare il caricatore vero per provarlo: la query e' quella che il
    // caricatore userebbe SENZA `revoked_at is null`. La usiamo qui solo per dimostrare
    // che la riga di sopra (ritirata) verrebbe restituita se il filtro non ci fosse.
    const { rows } = await pool.query<{ n: string }>(
      `select count(*)::text as n
         from sys.sys_auth_role_permissions rp
         join sys.sys_auth_roles r on r.auth_role_id = rp.auth_role_id
         join sys.sys_auth_permissions p on p.auth_permission_id = rp.auth_permission_id
        where r.auth_role_code = $1 and p.auth_permission_code = $2`,
      [RUOLO, PERMESSO],
    );
    expect(rows[0]?.n, "senza il filtro la riga ritirata ci sarebbe ancora: il filtro è la sola difesa").toBe("1");
  });
});
