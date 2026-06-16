# FINDINGS / WS-A — Architecture (monorepo, coupling, dead code) (S-100X-A6)

> Audit forense **read-only** del workstream Architecture. Metodo: ispezione statica del monorepo pnpm (`pnpm-workspace.yaml`, i 5 `package.json` di workspace, `packages/shared/src/index.ts` + `exports` map, `apps/api/src/app.ts`, `apps/*/next.config.js`, `tsup.config.ts`) + grep-count degli importatori reali per ogni dipendenza dichiarata e per ogni `@heuresys/*` boundary. Evidenza: `path:linea` reali + conteggi `grep -r`. **Zero modifiche a codice/CI/deploy, zero scritture DB.** Data: 2026-06-16 (S-100X-A6). Classificazione: `AUDIT_PROTOCOL.md`. Read-only: nessun `pnpm install`/build eseguito.
>
> **Caveat di misura**: i conteggi importatori sono `grep -rEl` su `src`/`test` (file con ≥1 match), non occorrenze. I `@types/*` con 0 src-importer NON sono "dead" (sono type-only, risolti implicitamente da `tsc`) e sono esclusi dai finding dead-dep. `react-dom`/`react` con 0 import diretti in alcuni app sono peer/runtime forniti da Next e NON flaggati.

## Headline (cosa cambia rispetto al seed S-100X-0)

1. **Il monorepo ora ha 5 workspace, non 4**: `apps/agent-gateway` (`@heuresys/agent-gateway@0.1.0`, aggiunto S992 dopo il recon) è entrato in scope. È un servizio Agent-SDK **standalone** che parla a heuresys via HTTP `/v1` (non via import), MA è **fuori dalla pipeline build/lint/CI** — manca `build` e `lint` negli script e ha **0 riferimenti nei workflow**. Boundary process-level pulito, governance di pipeline incompleta. [F-WS-A-3]
2. **🟡 Le 78 subpath exports di `@heuresys/shared` sono DEAD SURFACE al 100%**: il `package.json` dichiara 78 entry `./schemas/<module>` ma **0 (zero)** import nel repo le usa — tutti i **256** import passano dal barrel root `@heuresys/shared`. Il commento in `index.ts:3-5` raccomanda i subpath "per tree-shaking", ma nessuno li adotta. 78 entry di manutenzione/drift per beneficio nullo. [F-WS-A-1]
3. **Dead/mis-declared deps confermate e nuove**: `drizzle-orm`/`drizzle-kit` **rimossi** (R08 chiuso, 0 in ogni package.json — verificato). NUOVE: `@tanstack/react-query-devtools` (web, **0 usi** ovunque), `supertest` + `@types/supertest` (api, **0 usi** — l'harness usa `app.inject()`, 110 call). **`pino` è MIS-CLASSIFICATO**: è in `devDependencies` ma importato a runtime (`import { pino }`) da 2 file `src/` — funziona in prod solo perché il bundle tsup lo include (devDep bundled), una dipendenza di logging dovrebbe essere `dependency`. [F-WS-A-2]
4. **Cross-package coupling = PULITO (asset forte)**: `web`/`showcase` importano `@heuresys/api` **0 volte** (nessun import di internals API); `api` importa `@heuresys/ui` **0 volte** (rispetta la regola Design System); `shared` è un **leaf** (0 import di sibling `@heuresys/*` — gli unici "hit" sono doc-comment); **0 dipendenze circolari**. `@heuresys/ui` consumato correttamente (npm-published `^0.1.6`, `transpilePackages` + Tailwind 4 `@source` su dist). [F-WS-A-4 / F-WS-A-5]
5. **0 moduli orfani in `api`**: 75 module-dir, tutti con `routes.ts` registrato in `app.ts` (77 `app.register` perché alcuni moduli registrano più route-group, es. self-scope `me`). Nessuno schema/repo/service scollegato dalla pipeline route. [F-WS-A-6]

---

## Gruppo A — Dead surface & dead/mis-declared deps

### F-WS-A-1 — `@heuresys/shared`: 78 subpath exports dichiarate, 0 usate (tutti i 256 import dal barrel)
- Severità: **LOW** | Flag: **QUICK-WIN** (verify-first)
- Evidenza (grep live):
  - `packages/shared/package.json:9-325` dichiara `.` + **78** entry `./schemas/<module>` (es. `./schemas/auth:14`, `./schemas/users:34`, … `./schemas/organization-unit-processes:322`).
  - Import reali nel repo: **256** dal barrel root (`from "@heuresys/shared"`) in `apps/api/src` + `apps/web/src`; **subpath `@heuresys/shared/schemas/*` = 0** (`grep -rhoE "@heuresys/shared/schemas/[a-z-]+" apps packages db scripts` → solo 1 hit, che è il **doc-comment** `index.ts:4`, non un import).
  - Parità verificata: 78 export dichiarati == 78 file su disco (`src/schemas/*.ts`) == 78 voci nel barrel `index.ts` → **0 export rotti, 0 file fuori barrel, 0 file fuori export-map**. La superficie è coerente, solo **inutilizzata**.
- Impatto: footprint/DX (78 entry da mantenere allineate a ogni nuovo schema — drift-magnet; il barrel le rende già tutte raggiungibili) — nessun impatto perf/runtime (il barrel re-esporta tutto, `transpilePackages`+tsup `noExternal` bundlano comunque la sorgente).
- Baseline: 78 subpath exports · 0 importatori subpath · 256 importatori barrel.
- Proposta: **QUICK-WIN doc-only ora**. Due opzioni a scelta di Enzo: (a) **rimuovere le 78 subpath entry** dal `package.json` lasciando solo `.` (il barrel copre il 100% degli usi reali) — riduce la superficie di manutenzione; (b) **mantenerle come API pubblica intenzionale** se si prevede consumo esterno (es. il plugin `human-resources-plus`/agent-gateway in futuro). **Verify-gate** per (a): `pnpm -r typecheck` verde post-rimozione (deve restare verde perché 0 import le usa) + `pnpm build` di shared/api/web verde. Non toccare il barrel.

### F-WS-A-2 — Dead deps (`react-query-devtools`, `supertest`/`@types/supertest`) + `pino` mis-classificato come devDep ma importato a runtime
- Severità: **LOW** (dead) / **MEDIUM** (`pino` classification) | Flag: **QUICK-WIN**
- Evidenza (grep live, file-with-match su `src`+`test`):
  - **`@tanstack/react-query-devtools`** (`apps/web/package.json:24`) — **0 usi** in tutto `apps/web` (`grep -rn "ReactQueryDevtools\|react-query-devtools" apps/web` = 0, nessun import statico né lazy). Pura dead dep.
  - **`supertest`** (`apps/api/package.json:56`) + **`@types/supertest`** (`:54`) — **0 usi** in `apps/api/test`. L'harness usa `app.inject()` (Fastify light-my-request) — **110** call site (`grep -rln "\.inject(" apps/api/test` = 110). Il seed S-100X-0 e CLAUDE.md citano "supertest" ma il codice reale non lo importa: documentazione stale + dep morta.
  - **`pino`** (`apps/api/package.json:55`, **devDependencies**) — importato a **runtime** come valore: `apps/api/src/modules/brownfield-wave-executor/engine.ts:15 import { pino } from "pino"` + `…/upsert-sql.ts:29` (stesso). È un logger standalone per contesti non-Fastify (CLI/engine, vedi commento `engine.ts:10-14`). `tsup.config.ts` tiene **external** tutto ciò che è in `dependencies` e bundla il resto → essendo `pino` un **devDep**, finisce **bundled** in `dist/server.js`: funziona in prod ma per accidente (deviazione dall'intento "tutti i runtime-dep external"). Classificazione corretta = `dependencies`.
- Impatto: footprint (2 dead dev-dep + 1 type-pkg) + **robustezza/correttezza** per `pino` (un runtime-import da devDep è una landmine: se mai si togliesse pino dal bundle o si splittasse il logger in un pacchetto a deps-external, il prod romperebbe; oggi mitigato dal bundling).
- Baseline: 3 dead entry (`react-query-devtools`, `supertest`, `@types/supertest`) · 1 mis-classified (`pino` dev→runtime).
- Proposta: **QUICK-WIN** (meccanico, basso rischio): (1) rimuovere `@tanstack/react-query-devtools` da `apps/web` (+ qualsiasi provider mai montato); (2) rimuovere `supertest` + `@types/supertest` da `apps/api` + correggere la menzione "supertest" in CLAUDE.md/seed (l'harness è `inject()`); (3) **spostare `pino` da devDependencies a dependencies** in `apps/api/package.json`. **Verify-gate**: `pnpm -r typecheck` + `pnpm --filter @heuresys/api test` verdi; `pnpm --filter @heuresys/api build` (tsup) produce `dist/server.js` e `node dist/server.js` boota (pino ora external/dichiarato → install lo fornisce). **NB**: `@faker-js/faker` (`apps/api/package.json:48`) ha 0 import in `apps/api/src`/`test` MA **è usato** da `db/scripts/seed-reference-bank.ts:31` (che gira sotto il workspace api via `tsx`) → **NON è dead**, è un boundary-loose corretto (script DB che vive sotto api). Lasciare.

---

## Gruppo B — Cross-package coupling & boundary discipline (asset)

### F-WS-A-3 — `apps/agent-gateway`: boundary process-level pulito ma FUORI dalla pipeline build/lint/CI
- Severità: **MEDIUM** | Flag: DOSSIER (governance) / **QUICK-WIN** (aggiungere build+lint)
- Evidenza:
  - Nuovo 5° workspace (`apps/agent-gateway/package.json:2` `@heuresys/agent-gateway@0.1.0`, type module), coperto da `pnpm-workspace.yaml:2` glob `apps/*`. 9 file `src/` + 4 script live-acceptance + 5 test.
  - **Boundary**: importa `@heuresys/shared` **0 volte**, `@heuresys/api` **0 volte** — parla a heuresys via **HTTP** (`src/heuresys-client.ts` è un `fetch`-client al `/v1`, cookie-JWT + CSRF, vedi `:1-50`). Nessun import inverso: `grep "@heuresys/agent-gateway"` fuori da se stesso = **0**. È un servizio standalone, non una libreria del monorepo. Boundary corretto (mirror di un consumer esterno tipo il plugin `human-resources-plus`).
  - **Gap pipeline**: gli script sono solo `typecheck`/`test`/`dev` (`package.json:8-10`) — **manca `build` e `lint`**. I task root (`package.json:14-17`) fanno `pnpm -r --filter="@heuresys/*" run <task>`; pnpm **skippa** silenziosamente i pacchetti privi dello script → `pnpm build` e `pnpm lint` **non toccano agent-gateway**. In più: **0 riferimenti** in `.github/workflows/` (`grep -rln agent-gateway .github/workflows` = 0) → nessun gate CI (typecheck/test/lint) gira su questo servizio a ogni push.
  - Trade-off coscienza: non riusa il contratto Zod di `@heuresys/shared` → ridefinisce le proprie shape request/response (`Session`, `FetchLike` in `heuresys-client.ts:16-35`). Accettabile per un client HTTP disaccoppiato, ma è duplicazione di contratto da tenere d'occhio.
- Impatto: robustezza (un servizio che tocca auth/CSRF/human-in-the-loop write-gate non ha gate CI né è coperto da `pnpm build`/`lint` → regressioni silenziose) + DX.
- Baseline: 5° workspace, 0 build/lint script, 0 CI reference, 0 import cross-package (HTTP-only).
- Proposta: **QUICK-WIN**: aggiungere `"build"` (tsup, come api — esiste già un `dist/`) e `"lint": "eslint src"` ad `agent-gateway/package.json` così entra in `pnpm build`/`pnpm lint`. **DOSSIER** (decisione Enzo): aggiungere un job CI (typecheck+test) per agent-gateway nei workflow self-hosted (couples WS-G — il runner unico, valutare costo-coda) + decidere se il contratto HTTP debba riusare schemi `@heuresys/shared` o restare deliberatamente disaccoppiato.

### F-WS-A-4 — ASSET: cross-package coupling pulito, 0 dipendenze circolari, `shared` è un leaf
- Severità: INFO | Flag: ASSET
- Evidenza (grep live):
  - `web`/`showcase` → `@heuresys/api`: **0** (nessun import di internals API; il web parla all'API via fetch). `web` → `@heuresys/shared` 26 file / `@heuresys/ui` 60 file; `showcase` → `@heuresys/ui` 5 file, `@heuresys/shared` 0 (coerente: showcase **non** dichiara shared come dep).
  - `api` → `@heuresys/ui`: **0** (rispetta la regola "no UI nel backend"); `api` → `@heuresys/shared` 231 file; `api` → `@heuresys/web`/`showcase`/`agent-gateway`: **0**.
  - **`shared` è un leaf perfetto**: `grep "@heuresys/(api|web|ui|agent-gateway)" packages/shared/src` → solo **doc-comment** (`auth.ts:4-5`, `me-preferences.ts:9-20`, `mfa*.ts`, `role-codes.ts`), **0 import reali**. Nessun ciclo `shared↔api` o `api↔web`.
- Proposta: **NESSUNA azione** — la disciplina di boundary del monorepo è un asset. Mantenere shared come leaf (solo `zod` come dep) e api senza UI deps.

### F-WS-A-5 — ASSET: `@heuresys/ui` consumato correttamente (npm-published, transpilePackages, Tailwind 4 @source)
- Severità: INFO | Flag: ASSET
- Evidenza:
  - Dep npm-published (NON `link:`): root + `apps/web` + `apps/showcase` package.json = `"@heuresys/ui": "^0.1.6"` (post-X18, coerente con CLAUDE.md Design System).
  - `apps/web/next.config.js:4 transpilePackages: ["@heuresys/ui", "@heuresys/shared"]` (shared incluso perché i suoi `exports.default` puntano a `.ts` source-first); `apps/showcase/next.config.js:11 transpilePackages: ["@heuresys/ui"]`.
  - Tailwind 4 CSS-first: `apps/web/src/app/globals.css:15 @import "@heuresys/ui/styles"` + `:30 @source "../../node_modules/@heuresys/ui/dist/**/*.{js,mjs}"` (scansiona il build output della lib per le utility class) — nessun `tailwind.config.*` (corretto per TW4). Showcase idem (`globals.css:9`).
  - **0 primitive UI ridefinite in-repo** (coerente con seed: gli 8+ componenti web sono composizione tenant/RBAC su `@heuresys/ui`).
- Proposta: **NESSUNA azione** — consumo conforme alla dottrina X18. Quando si aggiorna `@heuresys/ui`, ricordare il bump in **3** package.json (root/web/showcase) per coerenza.

### F-WS-A-6 — ASSET: 0 moduli orfani in `api` — 75 module-dir tutte registrate in `app.ts`
- Severità: INFO | Flag: ASSET
- Evidenza: `ls apps/api/src/modules | wc -l` = **75** module-dir; ognuna con `routes.ts` è importata in `apps/api/src/app.ts` (loop "routes.ts non referenziato in app.ts" → **0 orfani**). `grep -cE "app.register\(.*Routes" app.ts` = **77** (>75 perché alcuni moduli registrano più route-group, es. `me` self-scope + admin). Nessuno schema/repository/service scollegato dalla catena route.
- Proposta: **NESSUNA azione** — il module-pattern 7-step (CLAUDE.md) garantisce che ogni modulo a disco sia wired. (Il pattern ~50-60% scaffolding del seed R14 resta materiale codegen, non un orfano.)

---

## Quick wins (QW-A*) — CLASS-A estraibili (indipendenti, low/zero rischio)

- **QW-A1** — rimuovere le dead/mis-declared deps: drop `@tanstack/react-query-devtools` (web), `supertest` + `@types/supertest` (api), e **spostare `pino` da devDependencies a dependencies** (api) [F-WS-A-2]. **Gate**: `pnpm -r typecheck` verde + `pnpm --filter @heuresys/api test` verde (110 inject-test invariati) + `pnpm --filter @heuresys/api build` produce `dist/server.js` e `node dist/server.js` boota con pino risolto; `pnpm --filter @heuresys/web build` verde.
- **QW-A2** — aggiungere `build` (tsup) + `lint` (eslint src) ad `apps/agent-gateway/package.json` così entra in `pnpm build`/`pnpm lint` root [F-WS-A-3]. **Gate**: `pnpm build` ora include agent-gateway (output `dist/`) senza errori; `pnpm lint` lo copre; nessun altro workspace regredisce.
- **QW-A3** — (verify-first) rimuovere le **78 subpath exports** inutilizzate da `packages/shared/package.json` lasciando solo `.`, OPPURE documentarle come API pubblica intenzionale [F-WS-A-1]. **Gate**: `pnpm -r typecheck` resta verde (0 import subpath le usa) + `pnpm build` shared/api/web verde. Scelta drop-vs-keep = decisione Enzo (dipende dal consumo esterno previsto).
- **QW-A4** — correggere la doc stale: CLAUDE.md/seed citano "supertest" per i test, ma l'harness reale è `app.inject()` [F-WS-A-2]. **Gate**: doc-only, nessun gate runtime.

> Tutti i QW restano **doc-only in questa fase A** (read-only). Candidati per la fase E (esecuzione) su go di Enzo, su branch, con i gate sopra.

---

## ASSET confermati (NON regredire senza dossier)

- **Cross-package coupling pulito**: 0 import web→api-internals, 0 import api→ui, 0 cicli, `shared` leaf [F-WS-A-4].
- **`@heuresys/ui` consumo conforme X18** (npm-published `^0.1.6`, transpilePackages, Tailwind 4 @source su dist) [F-WS-A-5].
- **0 moduli orfani**: 75/75 module-dir registrate in `app.ts` [F-WS-A-6].
- **drizzle FULLY removed** (R08 chiuso): 0 in ogni package.json, 0 importatori — verificato.
- **Parità shared coerente**: 78 export-map == 78 file disco == 78 barrel (0 export rotti) [F-WS-A-1].
- **agent-gateway boundary HTTP-only** (0 import cross-package, parla via `/v1`) — disaccoppiamento corretto, il gap è solo di pipeline [F-WS-A-3].

---

## Baseline Architecture (misure reali — aggiorna `BASELINE_METRICS.md`)

| Metrica | Valore reale | Comando/Fonte |
|---|---|---|
| Workspace pnpm | **5** (api, web, showcase, agent-gateway, shared) | `pnpm-workspace.yaml` + `ls apps packages` |
| `@heuresys/shared` subpath exports | **78** dichiarate · **0** importate (tutti 256 dal barrel) | `package.json exports` + `grep schemas/` |
| Subpath-export parità | 78 export == 78 file == 78 barrel (0 rotti/0 fuori) | `comm` declared/ondisk/barrel |
| Dead deps confermate | `react-query-devtools` (web,0) · `supertest`+`@types/supertest` (api,0) | `grep -rln` su src/test |
| Mis-classified dep | **`pino`** devDep ma runtime-import (`engine.ts:15`,`upsert-sql.ts:29`); bundled da tsup | `package.json:55` + grep import |
| drizzle | **0** in package.json, **0** importatori (R08 chiuso) | `grep drizzle` |
| web→api internals import | **0** | `grep @heuresys/api apps/web/src` |
| api→@heuresys/ui import | **0** (regola Design System rispettata) | `grep @heuresys/ui apps/api/src` |
| Dipendenze circolari | **0** (`shared` leaf, hit = doc-comment) | `grep @heuresys/* packages/shared/src` |
| api module-dir / registrate | **75** / **77** `app.register` (0 orfani) | `ls modules` + `grep app.register` |
| api `@heuresys/shared` import | 231 file · web 26 · showcase 0 · agent-gateway 0 | `grep -rl` |
| agent-gateway pipeline | **0** `build`/`lint` script · **0** CI reference · HTTP-only boundary | `package.json` + `grep .github` |
| `transpilePackages` | web `[ui, shared]` · showcase `[ui]` | `next.config.js:4`/`:11` |
| TS/TSX src files | api 275 · web 109 · showcase 27 · agent-gateway 9 · shared 79 | `find apps/*/src` |

**Insight chiave**: l'architettura del monorepo è **strutturalmente sana** — boundary cross-package puliti (0 import web→api, 0 api→ui, 0 cicli, shared leaf), `@heuresys/ui` consumato conforme X18, 0 moduli orfani, drizzle eliminato. Il debito è tutto a **bassa severità di footprint/governance**: (1) 78 subpath exports dead surface (drift-magnet, 0 usi); (2) 3 dead deps + `pino` mis-classificato dev→runtime (correttezza fragile, oggi mascherata dal bundling tsup); (3) il nuovo `apps/agent-gateway` è fuori da `pnpm build`/`lint`/CI pur toccando auth/CSRF/write-gate. Nessun finding HIGH/CRITICAL lato architettura.

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Dossier (richiedono decisione Enzo):**
- D — **governance pipeline agent-gateway**: aggiungere job CI + decidere se il contratto HTTP riusa `@heuresys/shared` o resta disaccoppiato [F-WS-A-3] (couples WS-G runner unico).
- D — **subpath exports policy**: drop le 78 (barrel-only) vs mantenerle come API pubblica per consumer esterni (plugin/agent-gateway) [F-WS-A-1].

**Quick-wins CLASS-A** (eseguibili su go, gate espliciti sopra): QW-A1 dead-deps + pino reclass · QW-A2 agent-gateway build+lint script · QW-A3 drop/keep subpath exports (verify-first) · QW-A4 fix doc supertest→inject.

**Asset da NON regredire**: coupling pulito (0 web→api / 0 api→ui / 0 cicli / shared leaf) · `@heuresys/ui` X18-conforme · 0 moduli orfani · drizzle removed · agent-gateway boundary HTTP-only.

---

*Audit S-100X-A6 — read-only, ispezione statica monorepo + grep importatori. Nessuna modifica a codice/CI/deploy, zero scritture DB. I finding qui confluiscono nel registro 100X — decisione per-finding di Enzo. Cross-ref: S-100X-0 recon (R08 drizzle → chiuso/verificato; R14 module scaffolding → codegen, non orfano) + WS-G (agent-gateway CI job couples il runner unico).*
