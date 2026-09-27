import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Z-123: `rbac-cache-boot-retry.test.ts` prova solo la funzione
// `loadRolePermissionCacheWithRetry` in isolamento, con un loader iniettato a mano:
// non prova che `server.ts` la chiami davvero. Se qualcuno la sostituisse con un
// loader non-retrying (o un `pool.query` diretto), quella suite resterebbe verde.
// Qui si spia l'export reale e si importa `server.ts` (che chiama `start()` al
// caricamento del modulo), così un cambio della wiring fa fallire QUESTO test.
//
// Rilievo adversarial confermato (lente correttezza, severita' alta, S1115): verificare solo
// che la funzione sia stata chiamata non basta — una wiring che le passa un SECONDO argomento
// (un loader cablato/fittizio al posto del default reale, che e' l'unico a interrogare
// sys.sys_auth_role_permissions) resta verde, perche' il mock ignora ogni argomento extra.
// Fix: si asserisce anche CON QUALI argomenti e' stata chiamata (toHaveBeenCalledWith), non
// solo che sia stata chiamata — un secondo argomento la fa fallire.

const cacheLoaderMock = vi.hoisted(() => ({
  loadRolePermissionCacheWithRetry: vi.fn(),
}));
vi.mock("../src/modules/auth/cache-loader.js", () => cacheLoaderMock);

const appMock = vi.hoisted(() => ({
  listen: vi.fn(),
  close: vi.fn(),
  log: { info: vi.fn(), fatal: vi.fn(), warn: vi.fn() },
}));
vi.mock("../src/app.js", () => ({ buildApp: vi.fn(async () => appMock) }));

// config/env.js NON si mocka: test/helpers/setup.ts (condiviso da tutta la suite) legge le
// chiavi vere nello stesso file di test (misurato: MFA_ENCRYPTION_KEY mancante). Non serve
// comunque: `app.listen` e' un mock, quindi non apre mai una porta reale.
//
// db/client.js e inbox-stream.js si mockano SOLO su closePool/closeInboxListener (importOriginal
// preserva `pool` per setup.ts). Rilievo adversarial confermato (lente isolamento-sicurezza,
// S1115): i due test di questo file installano sul PROCESSO REALE i listener SIGINT/SIGTERM
// veri di server.ts mentre process.exit e' mockato; un segnale esterno arrivato nella finestra
// del test avrebbe chiuso per davvero il pool DB condiviso con tutta la suite (closePool) senza
// che il processo terminasse (exit mockato) — un varco, non un'ipotesi. Mockare i due effetti
// lo chiude: anche innescato per davvero, lo shutdown non tocca piu' niente di condiviso.
vi.mock("../src/db/client.js", async (importOriginal) => ({
  ...(await importOriginal()),
  closePool: vi.fn(async () => undefined),
}));
vi.mock("../src/lib/inbox-stream.js", async (importOriginal) => ({
  ...(await importOriginal()),
  closeInboxListener: vi.fn(async () => undefined),
}));

async function importServerFresh() {
  vi.resetModules();
  await import("../src/server.js");
  // start() è async e non esportata: un giro di microtask per lasciarla arrivare
  // al primo await (loadRolePermissionCacheWithRetry) prima delle asserzioni.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe("Z-123 — il boot usa DAVVERO il loader con retry, non un doppio silenzioso", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    cacheLoaderMock.loadRolePermissionCacheWithRetry.mockReset();
    appMock.listen.mockReset().mockResolvedValue(undefined);
    appMock.close.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });

  it("chiama l'export retrying prima di aprire la porta, e apre la porta quando risolve", async () => {
    cacheLoaderMock.loadRolePermissionCacheWithRetry.mockResolvedValue({
      rolesLoaded: 1,
      mappingsLoaded: 1,
      unknownRolesSkipped: [],
    });

    await importServerFresh();

    expect(cacheLoaderMock.loadRolePermissionCacheWithRetry).toHaveBeenCalledTimes(1);
    // Esattamente app.log, nessun secondo argomento: un loader cablato al posto del
    // default reale farebbe fallire questa riga (rilievo adversarial correttezza).
    expect(cacheLoaderMock.loadRolePermissionCacheWithRetry).toHaveBeenCalledWith(appMock.log);
    expect(appMock.listen).toHaveBeenCalledTimes(1);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("non apre la porta se il loader retrying fallisce definitivamente", async () => {
    cacheLoaderMock.loadRolePermissionCacheWithRetry.mockRejectedValue(
      new Error("retry esaurito"),
    );

    await importServerFresh();

    expect(cacheLoaderMock.loadRolePermissionCacheWithRetry).toHaveBeenCalledTimes(1);
    expect(cacheLoaderMock.loadRolePermissionCacheWithRetry).toHaveBeenCalledWith(appMock.log);
    expect(appMock.listen).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
