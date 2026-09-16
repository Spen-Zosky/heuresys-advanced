# R-0 passo 35 — misura di partenza (ri-misurata, non copiata da I-G)

Data: 2026-09-16, sessione S1104. Fonte: `esiti/I-G.md` (2026-09-15), ogni riga ri-verificata
oggi con `rg` e `q.py`.

## Le 24 porte, file:riga

| modulo | porte | sito nel codice | verificato oggi |
|---|---|---|---|
| `tenants` | 2 | `service.ts:70,75,101` (`isPlatformAdmin(actor)`) | confermato: righe 70/75/101, invariate da I-G |
| `tenant-import-runs` | 2 | `service.ts:37,41` (`canReadRun`), `service.ts:136` (lista) | confermato |
| `tenant-blueprints` | 7 | `service.ts` — parametri `_a: ActorContext` ignorati su `list` (~110-120), `getById` (122), e altri metodi di lettura; **7 `app.get(` in `routes.ts`** (righe 47,74,112,149,172,253,274) | confermato: 7 GET, nessun filtro di cliente in nessuna |
| `tenant-materialization` | 1 | `service.ts:58` (`repo.findTenantStatus(pool, body.tenantId)`, nessun controllo su chi chiede) | confermato |
| `blueprint-activations` | 2 | `service.ts:18,24,34` (`isPlatform(actor)`) | confermato |
| `blueprint-overrides` | 2 | `service.ts:19,24` (`isPlatform(actor)`) | confermato |
| `content-blueprint-links` | 3 | `service.ts:26-27` (oggi `haMandatoPiattaforma(a)` — R-1 ha sostituito il nome del predicato, non la logica: `tenantId: isPlatform ? null : a.tenantId` diventa `tenantId: haMandatoPiattaforma ? null : a.tenantId`, stesso «null = tutti») | confermato, con nota: R-1 ha già toccato questo sito oggi (cambio nome, non logica) |
| `provenance` | 2 | `service.ts:16` (`if (isPlatform(a)) return undefined`) | confermato |
| `generated-origins` | 2 | `service.ts:21` (`if (isPlatform(a)) return undefined`) | confermato |
| `observability` | 1 | `repository.ts:30` `getTenantFleet(pool)` — nessun parametro attore, nessun filtro: **3 `app.get(` in `routes.ts`** (system-health, slow-queries, request-series), solo la prima (system-health) espone dati per-cliente | confermato |
| **totale** | **24** | | |

Non filtrati per natura, esclusi da R-0 (confermato da I-G, non ridecisi qui): `blueprint-families`/
`-processes`/`-variants` (catalogo di piattaforma, nessuna colonna cliente); `leads` (prospect,
non hanno `tenant_id`).

## Il punto unico — non esiste, R-0 lo costruisce

Nessuna delle 24 porte consulta un resolver comune: ciascuna ripete `isPlatform(actor)` (o
`haMandatoPiattaforma`/`isPlatformAdmin`, sinonimi locali) nel proprio `service.ts`/`repository.ts`.
R-0 lo costruisce in `apps/api/src/lib/actor.ts`: `perimetroClienti(actor): Set<string> | undefined`.

## Tabella utente↔più clienti — non esiste

Ri-misurato oggi: nessuna tabella `%user_tenant%`/`%tenant_user%`/`%platform_user%` nei quattro
schemi applicativi (`sys`, `staging`, `reference_sync`, `audit`). `sys_users.user_tenant_id` è
`NOT NULL`: anche `PLATFORM_ADMIN` appartiene a un cliente "di casa" (Heuresys System) — la
sua vista di "tutti i clienti" non viene da un `tenant_id` nullo, viene dal ruolo. R-0 parte da
zero, come previsto da D9: crea `sys.sys_platform_user_tenant_assignments` (migrazione 000421).

## Verdetto

SBLOCCA R-0: 24 porte confermate, punto unico da costruire in `actor.ts`, nessuna tabella
riusabile. Procede ai passi 36-38.
