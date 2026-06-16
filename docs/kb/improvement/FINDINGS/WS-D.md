# FINDINGS / WS-D — Frontend (apps/web, Next.js 16 App Router) (S-100X-A7)

> Audit forense **read-only** del workstream Frontend. Metodo: ispezione repo (`apps/web/src/**`: `app/`, `components/`, `lib/api/`, `providers/`, `proxy.ts`, `next.config.js`, `src/locales/`) + conteggi `grep`/`glob` reali (`file:linea`). Cross-check con CLAUDE.md sezioni "MVP-2a/2b LIVE DATA E2E ONLY" + "Design System `@heuresys/ui`". **Zero modifiche a codice/CI/build, nessun build eseguito** (per istruzione — niente `next build`). Data: 2026-06-16 (S-100X-A7). Classificazione: `AUDIT_PROTOCOL.md`.
>
> **Caveat di misura (vincolante per i §index)**: le firme di bundle-weight sono dedotte **staticamente** dal grafo di import (chi importa cosa dal barrel `@heuresys/ui`), NON da un bundle-analyzer reale (no build eseguito). Un import named eager da un barrel con `echarts`/`three`/`d3`/`recharts` come deps è un **segnale forte** di code-split mancato, ma la quantificazione esatta del chunk (KB) richiede `@next/bundle-analyzer` in fase E. I finding distinguono "segnale statico" da "misura confermata".

## Headline (cosa cambia rispetto al seed e alle altre WS)

1. **🟠 HIGH D-1 — code-split dei chart INCOERENTE: 8/12 pagine chart importano `EChartsCard` *eager* dal barrel `@heuresys/ui`, bypassando il wrapper `_charts-client.tsx` (`next/dynamic ssr:false`) che esiste apposta** (misurato). Il file `app/(authenticated)/_charts-client.tsx:15-17` ordina letteralmente *"Import chart components from HERE (never from \"@heuresys/ui\" directly)"*, ma le 8 pagine `analytics/*` fanno `import { …, EChartsCard, … } from "@heuresys/ui"` (eager), tirando `echarts ^6.0.0` (+ il resto del barrel che porta `three ^0.184`, `d3 ^7.9`, `recharts ^3.8`, `@react-three/*`) nel chunk client di ogni pagina senza il `ssr:false`/code-split. Solo **4** pagine (`career-succession`, `compensation-intelligence`, `organization/org-chart`, `visualizations`) usano correttamente il wrapper. In più `visualizations/[graphId]:7` importa `MermaidDiagram` eager dal barrel (altro renderer pesante). **Il pattern corretto È GIÀ in repo** — è un'aderenza disomogenea, non un design assente.
2. **🟠 HIGH D-2 — l'INTERA app `(authenticated)` è client-side (65/66 file `page.tsx`+`layout.tsx` sono `"use client"`; l'unico RSC è uno `system-health/layout.tsx` di gating)**. Ogni pagina business è un client component che fa data-fetch via TanStack Query nel browser; **nessun** Server Component fa il fetch, **nessun** `loading.tsx`/`error.tsx`/streaming RSC, **zero** `Suspense` boundary in tutto `apps/web/src`. È una **SPA dentro l'App Router** — coerente con la doctrine "silent-refresh client-side + cookie HttpOnly" (D-26), ma lascia sul tavolo TTFB/streaming/server-fetch e rende il first-paint dipendente dall'idratazione + N round-trip `/api`. Trade-off cosciente da **DOSSIER**, non bug.
3. **ASSET FORTE — la doctrine LIVE-DATA-E2E-ONLY è rispettata alla lettera**: `grep initialData|placeholderData|keepPreviousData` su tutto `apps/web/src` = **0 hit**; **0** Next.js route handler (`app/**/route.ts`) che ritorni JSON statico; **0** array `MOCK_/DEMO_/SAMPLE_/FAKE_/STUB_` in pagine business; gli unici hit `mock/fixture/hardcoded` sono in `/showcase/*` (brand demo dev-only, esplicitamente ammesso) o in **commenti che documentano la *rimozione* di mock** (`SystemHealthLive.tsx:6` "Replaces the former hardcoded-mock wiring (F7 closure)"). Trovare hard-coded data sarebbe stato un HIGH per doctrine — **non c'è**.
4. **ASSET — il path auth/refresh (D-26) è pulito e non regredito**: `lib/api/fetch.ts` è l'**unico** fetch wrapper (single-flight module-latch + `navigator.locks` cross-tab anti-replay sulla rotazione single-use, refresh `once` su 401, escluso `/login`+`/refresh`); `proxy.ts` (rename Next 16 di `middleware`) passa se c'è `hrx_access` **O** `hrx_refresh` (sessione resumable). Combacia 1:1 con la chiusura `D-26` nel `DEBT_REGISTER.md:34` (commit `fa564fe`). Nessun secondo client `fetch(`/v1`)` fuori dal wrapper.
5. **ASSET — `@heuresys/ui` non duplicato + i18n parità perfetta**: gli 8 file in `apps/web/src/components/` sono **composizioni** documentate di primitive `@heuresys/ui` (DataTable/Card/PageHeader/EmptyState…), non re-implementazioni di primitive base; i 2 senza import `@heuresys/ui` (`detail-panel.tsx` FieldGrid, `status-pill.tsx`) sono composizioni token-driven domain-specific (per `brand-component-contract.md`), non Button/Card reinventati. i18n: **en/it identici su tutti i 7 namespace** (admin 513=513, ess 348=348, analytics 185=185, … totale parità) con `pnpm i18n:check` cablato.

---

## Gruppo A — Server vs Client component discipline & data-fetching

### F-WS-D-1 — Intera app `(authenticated)` client-side: 65/66 page/layout `"use client"`, 0 RSC-fetch, 0 Suspense/streaming
- Severità: **HIGH** | Flag: DOSSIER (trade-off architetturale, decide Enzo)
- Evidenza (misurata):
  - `grep -rl '"use client"' apps/web/src | wc -l` = **78** file su **101** `.tsx` totali (109 `.ts`+`.tsx`).
  - In `app/(authenticated)/`: **65/66** file `page.tsx`+`layout.tsx` sono `"use client"`; l'**unico** RSC è `app/(authenticated)/system-health/layout.tsx` (gating, non-fetch). Tutti gli altri RSC del repo (19) sono pagine `/showcase/*` statiche (brand).
  - `grep -rn "Suspense|React.lazy" apps/web/src` = **0**; nessun `loading.tsx`/`error.tsx` co-locato (glob = 0); **0** Server Action; **0** `fetch` server-side in un RSC (tutto il data-fetch passa per `apiFetch`+TanStack Query nel client — `lib/api/auth.ts`, `lib/api/observability.ts`, e i 65 `useQuery` nelle pagine).
  - Razionale presente in repo: il first-paint di un client component è comunque pre-renderizzato server-side, ma il fetch è client (`AppProviders.tsx` è `"use client"`, QueryClient per-sessione).
- Impatto: **perf** (TTFB non sfrutta l'RSC streaming; first-meaningful-paint = idratazione + N round-trip `/api` seriali/paralleli; nessun dato in HTML iniziale) + **DX** (no error/loading boundary RSC → ogni pagina re-implementa loading/error in-component, vedi `data-table-panel.tsx:72-97`)
- Baseline: 65/66 authenticated client; 0 RSC-fetch; 0 Suspense; 0 loading.tsx/error.tsx.
- Proposta: **DOSSIER** — è un trade-off cosciente (SPA-in-App-Router allineata a cookie-auth + silent-refresh client-side, dove un RSC-fetch dovrebbe inoltrare i cookie HttpOnly server→server). Opzioni: (a) **conservativa** — lasciare client-side ma aggiungere `loading.tsx`/`error.tsx` per-route e qualche `Suspense` boundary per migliorare UX percepita senza toccare l'auth model; (b) **evolutiva** — RSC per le pagine read-mostly non-mutanti (liste/detail) con fetch server-side via cookie-forwarding (richiede che `/v1/*` accetti il cookie da un server-fetch Next), tenendo client le pagine mutanti; (c) **radicale** — fetch-on-server universale con un layer di forwarding cookie. **Decide Enzo** (impatta il security model auth). **Verify-first**: misurare TTFB/LCP reale (Lighthouse) di 2-3 pagine liste prima di stimare il guadagno.

### F-WS-D-2 — ASSET: QueryClient config sano (staleTime 30s, no refetchOnWindowFocus, retry 0) + un solo QueryClient per-sessione
- Severità: INFO | Flag: ASSET
- Evidenza: `providers/AppProviders.tsx:12-24` — `new QueryClient` lazy via `useState(() => …)` (no cache condiviso server/client su HMR), `defaultOptions.queries = { staleTime: 30_000, refetchOnWindowFocus: false, retry: 0 }`, `mutations.retry: 0`. `retry:0` è corretto col silent-refresh (il 401 lo gestisce `apiFetch`, non un retry cieco di TanStack). Le hook per-modulo affinano lo staleTime dove serve (`auth.ts`: me 30s, permissions/interfaces/preferences 60s).
- Proposta: **NESSUNA azione** — config coerente con la doctrine.

### F-WS-D-3 — ASSET: refetchInterval usato con parsimonia e visibility-gated (solo inbox)
- Severità: INFO | Flag: ASSET
- Evidenza: `grep refetchInterval|setInterval apps/web/src` → **1 sola** occorrenza: `me/inbox/page.tsx:65-66` `refetchInterval: INBOX_POLL_MS` + `refetchIntervalInBackground: false` (commento `:34`: polling 30s solo a tab visibile). Nessun altro polling; nessun `setInterval` raw nelle pagine.
- Proposta: **NESSUNA azione** — pattern corretto (no polling di background, no battery/quota drain).

---

## Gruppo B — Bundle weight (heavy deps, barrel, code-split)

### F-WS-D-4 — Code-split chart incoerente: 8/12 pagine importano `EChartsCard`/`MermaidDiagram` eager dal barrel invece del wrapper `_charts-client.tsx`
- Severità: **HIGH** | Flag: **QUICK-WIN**
- Evidenza (misurata):
  - Il wrapper esiste: `app/(authenticated)/_charts-client.tsx:22-25` `export const EChartsCard = dynamic(() => import("@heuresys/ui").then(m => ({default: m.EChartsCard})), { ssr: false })`; docstring `:15-17` *"Import chart components from HERE (never from \"@heuresys/ui\" directly)"*.
  - **Eager (bypass)**: 8 pagine `analytics/*` fanno `import { Badge, EChartsCard, … } from "@heuresys/ui"` — `analytics/{attendance:5, compensation:6, org-network:5, overtime:5, skills:5, skills-by-category:5, skills-group-share:5, workforce:5}`. Più `visualizations/[graphId]/page.tsx:7` `import { …, MermaidDiagram, … } from "@heuresys/ui"` (eager).
  - **Corretto (dynamic)**: solo 4 — `career-succession`, `compensation-intelligence`, `organization/org-chart`, `visualizations/page.tsx:11 import { EChartsCard } from "../_charts-client"`.
  - Le deps che il barrel porta dietro (`node_modules/@heuresys/ui/package.json`): `echarts ^6.0.0`, `echarts-for-react ^3.0.6`, `three ^0.184.0`, `@react-three/{fiber,drei}`, `d3 ^7.9.0`, `recharts ^3.8.1`. `next.config.js` ha `transpilePackages: ["@heuresys/ui","@heuresys/shared"]` ma **NESSUN** `optimizePackageImports` per il barrel → la tree-shaking del barrel non è assistita.
- Impatto: **perf/footprint** (le 8 analytics-page caricano echarts eager nel chunk client; senza `ssr:false` il render server-side del client-component prova anche a prerenderare il chart — è proprio il crash "Class extends value undefined / CW-B59" che il wrapper documenta di evitare; che il build non fallisca oggi va verificato con un build, ma il rischio + il peso eager sono reali)
- Baseline: 8 pagine eager + 1 `MermaidDiagram` eager vs 4 pagine via wrapper; 0 `optimizePackageImports`.
- Proposta: **QUICK-WIN** (meccanico, ~1h) — sostituire `import { …, EChartsCard, … } from "@heuresys/ui"` con `import { EChartsCard } from "../../_charts-client"` (path relativo per profondità) nelle 8 analytics-page; aggiungere `MermaidDiagram` (e ogni renderer pesante: `ForceGraph`/`three`-based) al wrapper `_charts-client.tsx` e instradare `visualizations/[graphId]` da lì. **Gate**: `next build` verde + nessun warning "ssr false"/prerender-crash; i chart restano funzionanti negli E2E `analytics/*` (Playwright prod); idealmente `@next/bundle-analyzer` mostra echarts NON nel chunk iniziale delle analytics-page. **Bonus DOSSIER** (low): valutare `experimental.optimizePackageImports: ["@heuresys/ui","lucide-react"]` in `next.config.js`.

### F-WS-D-5 — NOTE: barrel-import di `lucide-react` (26 file) + `@heuresys/ui` (58 file) senza `optimizePackageImports`
- Severità: **LOW** | Flag: NOTE (verify-first)
- Evidenza: `grep -rc 'from "lucide-react"' apps/web/src` = **26** file (il layout `(authenticated)/layout.tsx:16-38` importa ~22 icone in un solo statement); `grep -rc 'from "@heuresys/ui"' apps/web/src` = **58** file. `lucide-react` e `@heuresys/ui` sono barrel: senza `optimizePackageImports`, Next/Turbopack può includere più del necessario a meno che la tree-shaking del bundler non lo risolva da solo (per `lucide-react` di solito sì in prod build, ma è non-garantito senza la config).
- Impatto: footprint (modesto; `lucide-react` tree-shake bene in pratica, ma è verify-first)
- Baseline: 26 file lucide-barrel, 58 file ui-barrel, 0 optimizePackageImports.
- Proposta: **NOTE** — aggiungere `experimental.optimizePackageImports: ["lucide-react", "@heuresys/ui"]` è low-risk e additivo; va però **misurato** con bundle-analyzer prima/dopo (non assumere il guadagno). Lega a QW della F-WS-D-4.

### F-WS-D-6 — ASSET: `_charts-client.tsx` + `showcase/_ui-client.tsx` sono il pattern di code-split CORRETTO già in repo
- Severità: INFO | Flag: ASSET
- Evidenza: `_charts-client.tsx` (authenticated) e `showcase/_ui-client.tsx:31-43` (13 componenti brand wrappati in `dynamic(..., { ssr:false })`) isolano i componenti pesanti del barrel dal prerender server, con docstring che spiega il "Class extends value undefined" (CW-B59) e il requisito dell'object-literal inline per lo SWC plugin. `showcase/layout.tsx:7-9` documenta che le pagine showcase consumano SOLO da `_ui-client` per non tirare three/echarts/d3/recharts in server page-data collection.
- Proposta: **NESSUNA azione** — è il template da estendere (vedi F-WS-D-4); non regredire.

---

## Gruppo C — Auth/refresh path (D-26) & proxy

### F-WS-D-7 — ASSET: fetch wrapper unico + silent-refresh single-flight + Web Lock cross-tab (D-26 non regredito)
- Severità: INFO | Flag: ASSET
- Evidenza: `lib/api/fetch.ts` — unico wrapper `apiFetch`; refresh su 401 `refreshOnce()` (`:79-92`) = module-latch single-flight **+** `navigator.locks.request("hrx_refresh_rotation", …)` cross-tab (`:82-86`) così il perdente della race usa il token già ruotato (no replay → no hard-logout); `:138` esclude `/v1/auth/login` e `/v1/auth/refresh` dal retry; CSRF injected sui non-GET da `csrfStore` (`:119-122`). `proxy.ts:24-33` passa se `hrx_access` **O** `hrx_refresh` (resumable). Combacia con `DEBT_REGISTER.md:34` D-26 ✅ RISOLTO (`fa564fe`); `git log -- fetch.ts proxy.ts` mostra il fix come ultimo commit sui due file. Nessun `fetch("/v1` o `fetch("/api/v1` fuori dal wrapper (a parte `attemptRefresh` interno, by-design).
- Proposta: **NESSUNA azione** — verificato non-regredito; mantenere `apiFetch` come unico ingresso.

### F-WS-D-8 — NOTE: `proxy.ts` autorizza sulla SOLA presenza del cookie (non validità) — by-design, ma è una superficie da non dimenticare
- Severità: **LOW** | Flag: NOTE (design-aware, no fix)
- Evidenza: `proxy.ts:24-27` controlla `cookies.has(ACCESS_COOKIE) || cookies.has(REFRESH_COOKIE)` — **presenza**, non validità (commento `:4-12` lo motiva: un refresh-cookie presente = sessione *resumable*, il silent-refresh client minta l'access al primo fetch; redirigere sul solo access mancante = hard-logout a 15 min). La vera enforcement è API-side (`requirePermission`) + il client redirige su `SessionExpiredError`. `PUBLIC_PATHS` include `/showcase` (gated separatamente in `showcase/layout.tsx`).
- Impatto: nessuno reale (l'authz forte è server-side); è solo una nota: un cookie scaduto-ma-presente fa passare il middleware → la pagina si carica e il primo `/api` fallisce → redirect client. UX corretta, non un bug.
- Proposta: **NOTE** — comportamento corretto e documentato; nessuna azione. Citato per completezza del security-surface review (cross-ref WS-H).

---

## Gruppo D — UI primitive duplication & i18n

### F-WS-D-9 — ASSET: nessuna primitiva `@heuresys/ui` reinventata in `apps/web` — gli 8 component sono composizioni governate
- Severità: INFO | Flag: ASSET
- Evidenza: `apps/web/src/components/` = **8** file, tutti composizioni domain-specific:
  - `data-table-panel.tsx` (EntityTable/DataTablePanel) compone `DataTableWithCrossHair`+`Badge`+`Button`+`EmptyState`+`ErrorState`+`PageHeader` da `@heuresys/ui` (docstring `:9-22`: "Built purely from @heuresys/ui primitives; lives in apps/web as tenant-domain composition").
  - `ContentMediaPanel.tsx`/`language-switcher.tsx`/`SystemHealthDashboard.tsx`/`SystemHealthLive.tsx`/`preferences-applier.tsx` importano tutti da `@heuresys/ui`.
  - I 2 senza import `@heuresys/ui` — `detail-panel.tsx` (`FieldGrid`, definizione `<dl>` token-styled) e `status-pill.tsx` (`StatusPill`/`StatusBadge`, chip semantico token-driven) — sono **composizioni token-driven** documentate (`brand-component-contract.md`), non re-implementazioni di Button/Card/Input. `status-pill.tsx:24-30` usa classi Tailwind raw `bg-green-100/text-green-800` ma con razionale AA-contrast esplicito `:14-23` (chip semantico theme-independent, NO `dark:` per il bug S952 ratio 1.22).
- Proposta: **NESSUNA azione** — disciplina Design System rispettata (CLAUDE.md "NEVER create reusable UI components in apps/web"). Se `FieldGrid`/`StatusPill` venissero riusati anche fuori apps/web, sarebbero candidati a salire in `ux-design-shared`/`@heuresys/ui`, ma oggi sono giustamente domain-composition.

### F-WS-D-10 — ASSET: i18n en/it parità perfetta su 7 namespace + check cablato
- Severità: INFO | Flag: ASSET
- Evidenza: `src/locales/{it,en}/` = 7 namespace ciascuno; conteggio chiavi en==it su **tutti**: admin 513=513, ess 348=348, analytics 185=185, hr 117=117, blueprints 102=102, common 78=78, shell 27=27. `lib/i18n.ts:20-22` IT = default + locale sorgente completa, EN fallback a IT; namespace per area (parallel extraction). `package.json:16` `i18n:check → tsx scripts/check-i18n-parity.ts` cablato. `useTranslation` usato in **69** file (copertura larga).
- Proposta: **NESSUNA azione** — mantenere `pnpm i18n:check` in CI (cross-ref WS-G: il workflow `i18n-parity` esiste).

---

## Quick wins (QW-D*) — CLASS-A estraibili (indipendenti, low/zero rischio)

- **QW-D1** — instradare le 8 pagine `analytics/*` + `visualizations/[graphId]` (`MermaidDiagram`) attraverso il wrapper `_charts-client.tsx` (`next/dynamic ssr:false`) invece dell'import eager dal barrel `@heuresys/ui` [F-WS-D-4]. **Gate**: `next build` verde (nessun crash prerender / warning ssr); Playwright prod `analytics/*` + visualizations restano verdi (chart renderizzano con dati reali); idealmente bundle-analyzer conferma echarts fuori dal chunk iniziale analytics. **Solo file-edit di import, zero cambio logica/contratti.**
- **QW-D2** — `experimental.optimizePackageImports: ["lucide-react", "@heuresys/ui"]` in `next.config.js` [F-WS-D-5]. **Gate**: `next build` verde + `@next/bundle-analyzer` mostra una riduzione (o ≥ pari) del chunk vendor; nessuna regressione visiva negli E2E. **Verify-first**: misurare prima/dopo, non assumere il guadagno.

> Tutti i QW restano **doc-only in questa fase A** (read-only). Sono candidati per la fase E (esecuzione) su go di Enzo, su branch, con i gate sopra.

---

## ASSET confermati (NON regredire senza dossier)

- **LIVE-DATA-E2E-ONLY rispettata**: 0 `initialData/placeholderData/keepPreviousData`, 0 route-handler JSON statico, 0 mock/sample array in pagine business; i soli mock sono `/showcase` (dev-only) o commenti di rimozione (F7) [Headline 3].
- **Auth/refresh D-26 pulito**: `apiFetch` unico wrapper, single-flight + Web Lock cross-tab anti-replay, `proxy.ts` resumable — non regredito vs `fa564fe` [F-WS-D-7].
- **QueryClient sano** (staleTime 30/60s, no refetchOnWindowFocus, retry 0 col silent-refresh) [F-WS-D-2]; **polling parsimonioso** (solo inbox, visibility-gated) [F-WS-D-3].
- **Code-split pattern corretto già in repo** (`_charts-client.tsx` + `showcase/_ui-client.tsx`, `dynamic ssr:false`) [F-WS-D-6] — da estendere, non sostituire.
- **0 primitive reinventate** in apps/web (8 component = composizioni governate di `@heuresys/ui`) [F-WS-D-9].
- **i18n en/it parità perfetta** su 7 namespace + `i18n:check` cablato [F-WS-D-10].

---

## Baseline Frontend (misure reali — aggiorna `BASELINE_METRICS.md`)

| Metrica | Valore reale | Comando/Fonte |
|---|---|---|
| File `.tsx` (apps/web/src) | **101** (`.ts`+`.tsx` = 109) | `find apps/web/src -name "*.tsx" \| wc -l` |
| File `"use client"` | **78/101** | `grep -rl '"use client"' apps/web/src \| wc -l` |
| `(authenticated)` page/layout client | **65/66** (unico RSC = `system-health/layout.tsx`) | `find … + head -3 grep` |
| Pagine `page.tsx` totali / authenticated | **85** / **64** | `find apps/web/src/app -name page.tsx` |
| `Suspense` / `React.lazy` / `loading.tsx` / `error.tsx` | **0 / 0 / 0 / 0** | `grep -rn "Suspense\|lazy"` |
| `initialData` / `placeholderData` / `keepPreviousData` | **0 / 0 / 0** (doctrine OK) | `grep -rn` |
| Next route handlers (`route.ts`) | **0** (nessun JSON statico) | `find app -name route.ts` |
| Mock/fixture/hardcoded in pagine business | **0** (soli hit = /showcase dev-only + commenti F7) | `grep -rniE "mock\|fixture\|hard-?coded"` |
| `useQuery`/`useMutation` files | **65** files con query | `grep -rl "useQuery"` |
| Chart pages: eager barrel vs dynamic wrapper | **8 eager** (+1 `MermaidDiagram`) vs **4** via `_charts-client` | `grep EChartsCard` |
| `optimizePackageImports` | **0** (solo `transpilePackages`) | `next.config.js` |
| barrel-import files: `@heuresys/ui` / `lucide-react` | **58 / 26** | `grep -rc 'from "…"'` |
| Component dir (apps/web/src/components) | **8** (tutte composizioni `@heuresys/ui`, 0 primitive reinventate) | `ls components/*.tsx` |
| i18n parità en/it | **perfetta** su 7 namespace (admin 513=513, ess 348=348, …) | `grep -c ':' locales/{en,it}/*.json` |
| fetch wrapper | **1** (`lib/api/fetch.ts`, single-flight + Web Lock) | ispezione |

**Insight chiave**: il frontend è **disciplinarmente sano** — la doctrine LIVE-DATA-E2E è rispettata al 100% (0 mock/initialData/route-statici), il path auth D-26 è pulito, i18n è in parità, e il Design System non è duplicato. Le 2 leve a maggior impatto sono entrambe di **architettura/perf**: (1) il **code-split chart incoerente** (8/12 pagine bypassano un wrapper `next/dynamic` *che esiste già* → echarts/three eager) — QUICK-WIN meccanico; (2) l'**intera app è client-side senza RSC-fetch/Suspense** — trade-off cosciente legato al cookie-auth model, materiale da DOSSIER, decide Enzo.

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Dossier (richiedono decisione Enzo):**
- D — **RSC vs client architettura** (app interamente client-side; opzioni loading/error boundary → RSC-fetch read-mostly → fetch-on-server universale; impatta auth model) [F-WS-D-1].
- D — **optimizePackageImports + bundle-analyzer baseline** (misurare il peso reale del barrel prima di policy) [F-WS-D-5].

**Quick-wins CLASS-A** (eseguibili su go, gate espliciti sopra): QW-D1 instradare i chart via `_charts-client` (8 analytics + MermaidDiagram) · QW-D2 `optimizePackageImports` verify-first.

**Note (verifica, non fix):** `proxy.ts` autorizza su presenza-cookie (by-design, authz forte è API-side) [F-WS-D-8]; barrel-import lucide/ui senza optimize → misurare con analyzer [F-WS-D-5].

**Asset da NON regredire**: LIVE-DATA-E2E (0 mock/initialData) · auth D-26 (single-flight + Web Lock) · QueryClient config · code-split pattern `_charts-client`/`_ui-client` · 0 primitive reinventate · i18n parità.

---

*Audit S-100X-A7 — read-only, ispezione repo + conteggi grep/glob. Nessun build eseguito, nessuna modifica a codice/CI/build. I finding qui confluiscono nel registro dossier 100X — decisione per-finding di Enzo. Cross-ref: WS-G (i18n-parity workflow; D-08 runner) + WS-H (security: proxy authz-on-presence F-WS-D-8 + cookie path D-26) + DEBT D-26 (RISOLTO, verificato non-regredito) / D-27 (a11y DataTable, upstream `@heuresys/ui@0.1.6`).*
