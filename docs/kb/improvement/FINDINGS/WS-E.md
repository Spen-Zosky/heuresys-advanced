# FINDINGS / WS-E — Design-system & UX-IX (S-100X-A8)

> Audit forense **read-only** del workstream Design-system / UX-IX (`apps/web` + `apps/showcase` che consumano `@heuresys/ui`). Metodo: ispezione repo (Grep/Glob/Read su `apps/web/src`, `apps/showcase/src`, `apps/web/src/app/globals.css`, `node_modules/@heuresys/ui/src/styles/globals.css`, `apps/web/src/locales/`) + 1 sub-agent read-only di sweep (token/i18n/states/components/a11y) → sintesi main-thread. Evidenza: `path:linea` reali + grep count. **Zero modifiche a codice/CSS/locale/CI**. Niente Playwright/build eseguiti — il censimento a11y è citato dalle SoT (SOT_STATE §2.7 / §0-octodecies, gate `serious=0` incondizionato post-S983). Data: 2026-06-16 (S-100X-A8). Classificazione: `AUDIT_PROTOCOL.md`.
>
> **Caveat di misura (vincolante per i §contrasto)**: i token semantici di `@heuresys/ui` sono dichiarati in **oklch**; le ratio WCAG nei finding sotto sono calcolate su un'**approssimazione sRGB** dell'oklch (la conversione oklch→sRGB non è esatta a mano). Dove cito una ratio borderline (`text-destructive`) la classifico **verify-first** (misurare con axe live, non droppare/cambiare su questo solo calcolo). Le ratio dei token app-level (`--danger`/`--info`/`--success` in hex) sono invece esatte (S982 axe-measured, citate da globals.css).

## Headline (cosa cambia rispetto a WS-C/WS-G/WS-H e ai census a11y storici)

1. **Il quadro UX-IX è strutturalmente MOLTO sano** — va detto subito per non gonfiare i finding: **0 raw-hex** in className/inline-style che stilano elementi UI (i 138 hex totali sono tutti config di chart ECharts/SVG = legittimi); **i18n parity perfetta** (1216 = 1216 chiavi su 7 namespace, script `i18n:check` cablato); **0 `<div onClick>`/`<span onClick>`** non-semantici (zero gap keyboard-a11y da elementi clickabili custom); **a11y gate `serious=0` incondizionato** già shipped (S983, mobile+desktop, 35 route ×3 personas, 0 violazioni di OGNI severità). Le leve reali sono **3, tutte MEDIUM/LOW** e concentrate.
2. **🟡 MEDIUM E-1 — doppio token rosso per gli error state**: il codice mischia `text-destructive` (18 occ / 13 file, di cui **9 su pagine di produzione**) e `text-danger` (53 occ / 27 file) per lo stesso scopo (testo/bordo di errore). **NB importante (evidenza contraria al gotcha storico)**: `text-destructive` **NON è più invisibile** — il gap-fill D3 della lib (`@heuresys/ui/src/styles/globals.css:29-32`) registra `--color-destructive` con un valore reale → l'utility È valida e renderizza rosso. MA è un rosso **library-owned** (`oklch(0.65 0.22 22)` dark) che **NON ha ricevuto il retune AA axe-measured S982** che ha avuto `--danger` (web `globals.css:130` → `#F87171` per AA su card dark). Il memo `reference_apps_web_color_tokens.md` ("`text-destructive` = testo invisibile") è quindi **STALE e da aggiornare**.
3. **🟡 MEDIUM E-2 — `SystemHealthDashboard.tsx` triplo-difetto**: componente da **344 righe con ZERO `useTranslation`** (≈30 stringhe utente hardcoded in EN), **byte-identico duplicato** tra `apps/web/src/components/` e `apps/showcase/src/components/` (entrambi git-tracked), e privo di error/empty state (è un mockup statico montato sulla route di **produzione** `/(authenticated)/system-health` PLATFORM_ADMIN-gated). Fallisce contemporaneamente i criteri §i18n, §dedup-componenti e §live-data-states.
4. **🟢 LOW E-3 — primitive UI generiche definite in-repo** (viola la regola CLAUDE.md "NEVER reusable UI in `apps/web`"): `status-pill.tsx` + `detail-panel.tsx` (FieldGrid) sono primitive presentazionali pure, **duplicate** web↔showcase → candidate naturali alla promozione in `@heuresys/ui`; `data-table-panel.tsx` è borderline (state-machine di lista generica). Tutte hanno doc-comment che le giustifica come "composizione tenant-domain", ma la duplicazione prova che sono UI riusabili.
5. **Asset forti confermati**: `status-pill.tsx` è un **esemplare di disciplina** (documenta ed evita il gotcha `dark:` media-based, usa chip opachi AA THEME-INDEPENDENT); token-discipline ~perfetta (0 hex UI); il contratto semantico token è ben governato (consumer forniscono brand/surface, la lib fa gap-fill dei mancanti via `@theme`); states live-data presenti su ~54/64 pagine; loading 62/64, error 58/64, empty 58/64.

---

## Gruppo A — Token discipline (hex, `dark:`, `destructive` vs `danger`)

### F-WS-E-1 — Doppio token rosso per gli error state: `text-destructive` (lib-owned, no-AA-retune) coesiste con `text-danger` (app-token AA-retuned)
- Severità: **MEDIUM** | Flag: **QUICK-WIN** (normalizza su `text-danger`) + DOSSIER (verify contrasto)
- Evidenza:
  - `text-destructive|bg-destructive|border-destructive` = **18 occ / 13 file** (`grep -c`), di cui **9 su pagine di produzione**: `dashboard/page.tsx:45,80`, `gaps/page.tsx:68`, `users/[userId]/page.tsx:52`, `tenants/[tenantId]/page.tsx:84`, `positions/[positionId]/page.tsx:54`, `blueprints/[variantId]/page.tsx:99`, `compensation-intelligence/page.tsx:143`, `visualizations/[graphId]/page.tsx:75`; il resto è showcase (forms/sidebar/icons/dashboard-cards/primary-initial-page).
  - `text-danger|bg-danger|border-danger` = **53 occ / 27 file** (lo stesso scopo error/severity, token canonico app).
  - **Validità**: `--color-destructive` È registrato — `node_modules/@heuresys/ui/src/styles/globals.css:30` `--color-destructive: oklch(0.6 0.22 22)` (light) + `:52` `oklch(0.65 0.22 22)` (dark), commento lib `:29` "consumers use `danger`, not `destructive`". Il `@theme inline` di `apps/web/src/app/globals.css:54-57` registra `--color-success/warning/danger/info` ma **NON** `--color-destructive` → la copertura di `text-destructive` viene **solo** dal gap-fill lib (non dal token app). I ref dist `index.mjs:2213/2249` sono `exportTokensCss`/`exportTailwindConfig` del ThemeBuilderWizard (generator di stringhe, NON registrazione live) — non sono la fonte della validità.
  - **Contrasto (approssimato oklch→sRGB, verify-first)**: su card dark `#131720`, `text-danger` `#F87171` = **6.48** (AA pieno, retune S982 `globals.css:130`); `text-destructive` ≈`oklch(0.65 0.22 22)` ≈ **5.2** (passa). Su card light `#FFFFFF`, `text-danger` `#DC2626` = **4.83** (AA); `text-destructive` ≈`oklch(0.6 0.22 22)` ≈ **4.23** (**borderline sotto 4.5** in approssimazione). → potenziale AA-miss in light, da confermare con axe.
- Impatto: **UX/consistency** (due rossi diversi per lo stesso significato) + **a11y** (il ramo `destructive` è fuori dal retune AA S982 → non garantito dai gate axe storici, che hanno misurato i token `--danger/--info/--success`) + **DX** (memo `reference_apps_web_color_tokens.md` stale induce in errore)
- Baseline: 18 `destructive` (9 prod) vs 53 `danger`; `--color-destructive` solo lib-gap-fill, fuori dal retune S982; ratio light ≈4.23 (verify).
- Proposta: **QUICK-WIN** (meccanico, zero rischio) = sostituire le 9 occorrenze prod `text/bg/border-destructive` → `…-danger` (token app AA-retuned, governato da S982) per uniformare su un solo rosso semantico governato. **DOSSIER/verify-first**: prima di chiudere, far girare la census axe sulle ~8 pagine toccate (era già `serious=0`; confermare che il cambio resti 0 e che il ramo light di `destructive` non fosse già un moderate sfuggito). **Aggiornare `reference_apps_web_color_tokens.md`**: la voce "`text-destructive` = invisibile" è obsoleta (la lib lo riempie) → riscriverla come "`text-destructive` è valido ma NON-canonico; usare `text-danger`".

### F-WS-E-2 — ASSET: token-discipline ~perfetta — 0 raw-hex su elementi UI; hex solo in config chart (legittimo)
- Severità: INFO | Flag: ASSET
- Evidenza (sweep): `text-[#…]`/`bg-[#…]`/`border-[#…]`/`fill-[#…]`/`stroke-[#…]` arbitrary-value hex in className = **0** in entrambe le app; inline `style={{ color/background:'#…' }}` = **0** (i 24 `style={{…}}` nelle pagine auth sono solo geometria dinamica, es. `insights/page.tsx:119` `width:${pct}%`). I **138** hex totali (77 web .tsx / 61 showcase .tsx) sono **tutti** array colore di chart ECharts/SVG (es. `compensation-intelligence/page.tsx:39-43` `STATUS_COLOR`, `career-succession/page.tsx:112-125` axisLabel/itemStyle, `org-chart/page.tsx:66-67`) o swatch demo (`showcase/palettes/page.tsx`) → legittimi (un chart non ha utility token).
- Proposta: **NESSUNA azione** — disciplina token rispettata; eventuale nota: i `STATUS_COLOR` hex dei chart potrebbero leggere i CSS-var token (`getComputedStyle`) per re-skin su palette-switch, ma è una raffinatezza, non un difetto.

### F-WS-E-3 — ASSET: `dark:` gotcha correttamente evitato + documentato (status-pill è il template)
- Severità: INFO | Flag: ASSET
- Evidenza: `dark:` in `apps/web/src` = **4 occ, tutte in `status-pill.tsx`** e tutte **dentro un commento** che SPIEGA perché NON usarle (`status-pill.tsx:16-23`: "do NOT use Tailwind `dark:` … Tailwind 4's default `dark:` is `@media (prefers-color-scheme:dark)` NOT class-based … S952: an earlier `dark:`-based fix rendered light-green on near-white, ratio 1.22"). Il componente usa chip opachi THEME-INDEPENDENT (`TONE_CLASS` `:24-30`, `bg-*-100 text-*-800`) che leggono AA su entrambe le card. **Nessun uso reale di `dark:`** nel codice → il gotcha `project_tailwind_dark_media_based` è rispettato end-to-end.
- Proposta: **NESSUNA azione** — `status-pill.tsx` è il modello da non regredire (e la prova che il pattern dark-via-`.dark`-class + CSS-var token è applicato).

---

## Gruppo B — a11y TAIL (oltre il gate serious=0 già chiuso)

### F-WS-E-4 — ASSET con tail residuo cosmetico: a11y gate `serious=0` incondizionato (mobile+desktop) già shipped; nessun nuovo serious/moderate trovato grep-side
- Severità: INFO | Flag: ASSET
- Evidenza (SoT, non ri-eseguito Playwright): `SOT_STATE §2.7` — color-contrast 179 nodi → **0** (`9d48ff5`, 3 ritocchi token), full audit 35×3 = **0 critical/serious/moderate/minor**, gate CI alzato a `serious=0`. `§0-octodecies` (S983) — project Playwright `mobile-a11y` (Pixel 7) census **ZERO violazioni di OGNI severità su 35 route** → gate **incondizionato** (`509cad7`), "§2.7 CHIUSO". Debiti D-27 (`scrollable-region-focusable` /me/certifications + /kpis) RISOLTO (`9e097cb`, `@heuresys/ui@0.1.6`). Grep-side: `<div onClick>`/`<span onClick>` non-semantici = **0** (sweep, entrambe le app); `role=`/`tabIndex`/`onKeyDown` presenti 116× in `apps/web/src` (le interazioni usano `<Button>`/`<a>` di `@heuresys/ui`, keyboard-native).
- Impatto: — (asset)
- Proposta: **NESSUNA azione di fix**. **NOTE verify-first**: l'unico residuo a11y plausibile è quello **innescato da E-1** (se `text-destructive` light fosse un moderate sfuggito — i census hanno misurato `--danger`, non `--color-destructive`) → la census va ri-girata sulle pagine toccate dal QW di E-1. Mantenere il gate incondizionato.

### F-WS-E-5 — aria-label/role hardcoded EN su chart e su EmptyState live (compone E-2/E-6)
- Severità: **LOW** | Flag: QUICK-WIN (parte del fix i18n di E-6)
- Evidenza (sweep): aria-label literali EN su chart showcase (`showcase/charts/page.tsx:36,88,124,158`) — dev-only, basso valore; ma anche su componenti live: `SystemHealthLive.tsx:366-367` EmptyState `title="RBAC matrix unavailable"` / `description="The role-permission map could not be loaded."`, `:397-398` `"No recent self-service audit events"` / `"The audit feed is empty…"` — **stringhe utente EN hardcoded** in un componente che PER ALTRO importa `useTranslation` (7 usi) → incoerenza interna.
- Impatto: a11y/i18n (uno screen-reader in IT legge label EN; le copy EmptyState live non si traducono)
- Proposta: **QUICK-WIN** — instradare le 4 stringhe EmptyState di `SystemHealthLive.tsx` via `t(...)` (namespace `admin`/`common`) + chiavi parity it/en. Le aria-label dei chart showcase: basso valore (dev-only), opzionale.

---

## Gruppo C — i18n parity & hard-coded strings

### F-WS-E-6 — ASSET (parity) con un buco concentrato: 1216=1216 chiavi perfette, MA `SystemHealthDashboard.tsx` ha ~30 stringhe EN hardcoded fuori da i18n
- Severità: **MEDIUM** | Flag: **QUICK-WIN** (i18n del dashboard) — couples E-2
- Evidenza:
  - **Parity perfetta**: 7 namespace it == en, leaf-key per namespace (grep `": "`): admin 458, ess 323, analytics 164, hr 100, blueprints 86, common 65, shell 20 → **1216 = 1216**. Script `i18n:check` cablato (`apps/web/package.json:16` → `scripts/check-i18n-parity.ts`, flatten dot-notation, exit 1 su missing). IT = source, EN fallback IT (`lib/i18n.ts:21-22,71`). **NB census stale**: SOT dice "1108×2×7" (S982) → reale **1216×2×7** (drift +108, doc da aggiornare).
  - **Buco hardcoded**: `apps/web/src/components/SystemHealthDashboard.tsx` (344 righe) ha **0** `useTranslation`/`t(` → tutte le label visibili sono literali EN: nav `:59-60` `"Platform"`/`"System Health"`, `:84` `<span>Database</span>`, `:150-151` `"Acknowledge"`/`"View incident →"`, `:178` `"API uptime · 24h"`, `:204` `"Active tenants"`, `:218` `"Auth integrity"`, incidenti `:257-259` `"GENESIS_DEMO degraded"`/`"RBAC cache rebuild"`/`"Migration 000031 applied"` (+ description/meta EN). È montato sulla route prod `/(authenticated)/system-health/page.tsx` (PLATFORM_ADMIN). Le 64 pagine app-router fuori da system-health sono effettivamente pulite (instradano via `t(...)`).
- Impatto: UX/i18n (un PLATFORM_ADMIN in IT vede un dashboard tutto in EN su una route di produzione) + il fatto che la parity 1216=1216 **non cattura** questo buco (le stringhe non sono mai entrate nei locale file)
- Baseline: parity 1216=1216 (script attivo); ~30 stringhe utente hardcoded concentrate in 1 file prod (`SystemHealthDashboard.tsx`) + ~5 in `SystemHealthLive.tsx` (E-5).
- Proposta: **QUICK-WIN** = estrarre le ~30 stringhe di `SystemHealthDashboard.tsx` in chiavi `admin`/`shell` it+en (la parity script garantisce simmetria). **MA** vedi E-2: il componente è anche un mockup statico duplicato → la soluzione completa è decidere se è una pagina prod reale (allora i18n + sostituirlo con dati live via `SystemHealthLive`) o demo (allora spostarlo sotto `/showcase` e toglierlo dalla route auth). **Aggiornare il census i18n** in SOT (1108→1216).

---

## Gruppo D — Component placement & duplication (regola "no reusable UI in apps/web")

### F-WS-E-7 — Primitive UI generiche in `apps/web/src/components/` + duplicazione web↔showcase (viola la regola Design-System)
- Severità: **LOW** | Flag: DOSSIER (promozione a `@heuresys/ui`) + QUICK-WIN (de-dup)
- Evidenza (sweep + `git ls-files`):
  - **Duplicati git-tracked** (NON generati — verificato `git ls-files apps/showcase/src/components/` li elenca; solo `app/showcase/**` route è generata da `sync-showcase.sh`, NON `components/`): `status-pill.tsx`, `detail-panel.tsx`, `SystemHealthDashboard.tsx` (344 righe) esistono **byte-identici** in `apps/web/src/components/` E `apps/showcase/src/components/`.
  - **Primitive generiche** (presentazionali pure, candidate `@heuresys/ui`): `status-pill.tsx` (StatusPill/StatusBadge/`statusTone()` — chip + euristica status→tone, zero domain); `detail-panel.tsx` (FieldGrid — `<dl>` token-styled per detail page, zero domain). `data-table-panel.tsx` (EntityTable/DataTablePanel — state-machine lista loading/error/empty su `DataTableWithCrossHair`) = **borderline** (la cosa più riusabile del repo).
  - **Legittimamente domain-specific** (restano in `apps/web`): `ContentMediaPanel.tsx` (upload FormData+CSRF+proxy, `@heuresys/shared` types), `language-switcher.tsx` (i18n+API persist), `preferences-applier.tsx` (session/API, render null), `SystemHealthLive.tsx` (query `/v1/*`+RBAC).
- Impatto: footprint/DX (manutenzione doppia: un fix a `status-pill`/`detail-panel`/`SystemHealthDashboard` va replicato a mano in 2 file — il commento di `showcase/globals.css:7` "this file is a mirror, any change must be reflected here" conferma il pattern manuale) + violazione regola governance
- Baseline: 3 file duplicati byte-identici (di cui 1 da 344 righe); 2-3 primitive generiche in `apps/web`.
- Proposta: **DOSSIER** (decide Enzo, tocca `@heuresys/ui` = repo `ux-design-shared` + publish npm): promuovere `StatusPill` + `FieldGrid` (+ valutare `DataTablePanel`) in `@heuresys/ui`, poi consumarli in entrambe le app → elimina la duplicazione e rispetta la regola. **QUICK-WIN interim** (se la promozione npm è deferred): far sì che `apps/showcase` importi le primitive da `apps/web` via un path condiviso O che `sync-showcase.sh` copi anche `components/` (oggi NO) → almeno una sola fonte. **Couples E-2** (`SystemHealthDashboard` va comunque ripensato: i18n + live-data, non un mockup duplicato su route prod).

---

## Gruppo E — Heuristic/UX states (live-data doctrine)

### F-WS-E-8 — Loading/Empty/Error: ~54/64 pagine complete; gap concentrati su `me/*` (error) e detail/form (empty, spesso N/A)
- Severità: **LOW** | Flag: QUICK-WIN (i ~5 error-gap reali)
- Evidenza (sweep, delegation-aware — le list-page delegano i 3 stati a `data-table-panel.tsx`): copertura **loading 62/64 · error 58/64 · empty 58/64**; **all-three ~54/64**.
  - **Mancano error-state (6, di cui ~5 azionabili)**: `me/career/page.tsx`, `me/inbox/page.tsx`, `me/page.tsx` (ha loading `:84` + empty ternary `:90/:102`, **no `isError`**), `me/skills/page.tsx` (loading `:41` + EmptyState `:46`, **no isError**), `organization/org-chart/page.tsx` (loading `:122`, no error), `system-health/page.tsx` (mockup statico).
  - **Mancano empty-state (6, per lo più N/A)**: `me/page.tsx`, `me/profile/page.tsx` (form — empty N/A), `positions/[positionId]/page.tsx` (detail — N/A), `users/[userId]/page.tsx` (detail — N/A), `tenants/[tenantId]/enterprise-typing/page.tsx`, `system-health/page.tsx`.
  - **Mancano loading-state (2, marginali)**: `dev/agent/page.tsx` (streaming console, N/A), `me/handbook/[id]/page.tsx` (fallback testo `title={doc?.title ?? t("common:loading")}` `:78`).
  - Pagina più debole: **`me/page.tsx`** (manca sia error sia empty) e **`system-health/page.tsx`** (manca error+empty perché monta un mockup statico → ricade in E-2).
- Impatto: UX/robustezza (su un fetch fallito quelle pagine `me/*` non mostrano un error-state → schermo vuoto/parziale invece del messaggio; viola "real empty-state UI when the live API returns empty" della dottrina live-data)
- Baseline: 54/64 all-three; ~5 error-gap reali (`me/career`, `me/inbox`, `me/page`, `me/skills`, `org-chart`).
- Proposta: **QUICK-WIN** = aggiungere il ramo `isError` (pattern già usato ovunque: `gaps/page.tsx:67-70` `… : gaps.isError ? <…text-danger… data-testid="…-error">{t("…error")}</…> :`) alle ~5 pagine `me/*`+`org-chart`, con chiave i18n parity it/en e `data-testid` per E2E. I detail/form empty-gap sono N/A (nessun concetto di lista-vuota) → non azionare.

---

## Quick wins (QW-E*) — CLASS-A estraibili (indipendenti, low/zero rischio)

- **QW-E1** — normalizza il rosso error: 9 occorrenze prod `text/bg/border-destructive` → `…-danger` (token app AA-retuned S982) [F-WS-E-1]. **Gate**: census axe sulle ~8 pagine toccate resta `serious=0` (e nessun nuovo moderate light); `pnpm i18n:check` e build web verdi; visual checkpoint (rosso invariato/migliore). + aggiornare `reference_apps_web_color_tokens.md` (voce stale).
- **QW-E2** — i18n di `SystemHealthDashboard.tsx`: estrarre ~30 stringhe EN in chiavi `admin`/`shell` it+en [F-WS-E-6]. **Gate**: `pnpm i18n:check` verde (1216→~1246 simmetrico); 0 `useTranslation`-free literal residui nel file; render IT mostra label tradotte. (Se si sceglie la via E-2-radicale = spostare a /showcase, questo QW decade.)
- **QW-E3** — i18n delle 4 EmptyState di `SystemHealthLive.tsx` via `t(...)` [F-WS-E-5]. **Gate**: parity verde; le copy si traducono in IT.
- **QW-E4** — error-state branch sulle ~5 pagine `me/*`+`org-chart` (pattern `isError` di `gaps/page.tsx`) [F-WS-E-8]. **Gate**: ogni pagina ha un ramo `isError` con `data-testid="<x>-error"` + chiave i18n parity; E2E (login persona ESS, forza errore) asserisce l'error-state.
- **QW-E5** — de-dup interim delle 3 primitive duplicate (`status-pill`/`detail-panel`/`SystemHealthDashboard`) facendo importare showcase da un'unica fonte O estendendo `sync-showcase.sh` a `components/` [F-WS-E-7]. **Gate**: `git` mostra 1 sola fonte per ciascuna; build showcase verde. (La promozione a `@heuresys/ui` resta DOSSIER.)

> Tutti i QW restano **doc-only in questa fase A** (read-only). Candidati per la fase E (esecuzione) su go di Enzo, su branch, con i gate sopra. **Ordine consigliato**: QW-E1+QW-E4 (rischio nullo, alto valore UX) → QW-E2+QW-E3 (i18n) → QW-E5/DOSSIER (tocca `@heuresys/ui`).

---

## ASSET confermati (NON regredire senza dossier)

- **Token-discipline ~perfetta**: 0 raw-hex su elementi UI (138 hex = tutti config chart legittimi) [F-WS-E-2]; contratto semantico token governato (consumer brand/surface + lib gap-fill via `@theme`).
- **`dark:` gotcha evitato e documentato** in `status-pill.tsx:16-23` (template del pattern dark-via-`.dark`-class + CSS-var token; nessun `dark:` reale nel codice) [F-WS-E-3].
- **a11y gate `serious=0` incondizionato** (mobile Pixel-7 + desktop, 35 route ×3 personas, 0 violazioni di OGNI severità) [F-WS-E-4]; **0 `<div/span onClick>`** non-semantici (no gap keyboard-a11y).
- **i18n parity perfetta 1216=1216** su 7 namespace + script `i18n:check` cablato (exit-1 su missing) [F-WS-E-6]; 64 pagine app-router (fuori system-health) instradano via `t(...)`.
- **Live-data states presenti su ~54/64 pagine** (loading 62 · error 58 · empty 58); delega pulita a `data-table-panel.tsx` per le liste [F-WS-E-8].
- **Componenti domain legittimi** (`ContentMediaPanel`/`language-switcher`/`preferences-applier`/`SystemHealthLive`) correttamente in `apps/web` (API/CSRF/RBAC/i18n-bound) [F-WS-E-7].

---

## Baseline Design-system & UX-IX (misure reali — aggiorna `BASELINE_METRICS.md`)

| Metrica | Valore reale | Comando/Fonte |
|---|---|---|
| Raw-hex su elementi UI (className/inline) | **0** | sweep `text-[#…]`/`style={{color:'#…'}}` |
| Hex in config chart (legittimo) | **138** (77 web / 61 showcase .tsx) | sweep hex literal |
| `text/bg/border-destructive` | **18 occ / 13 file** (9 su pagine prod) | `grep -c` |
| `text/bg/border-danger` (token canonico) | **53 occ / 27 file** | `grep -c` |
| `--color-destructive` registrato | sì, **solo via lib gap-fill** (`@heuresys/ui/src/styles/globals.css:30,52`), NON nel `@theme inline` app | Read |
| `dark:` reali nel codice | **0** (4 occ = tutte in commento di `status-pill.tsx`) | `grep` |
| i18n parity | **1216 = 1216** (7 ns: admin 458/ess 323/analytics 164/hr 100/blueprints 86/common 65/shell 20) | grep `": "` + `check-i18n-parity.ts` |
| Census i18n SOT (stale) | dichiarato 1108×2×7 → reale **1216×2×7** (+108 drift) | SOT_STATE §0-... |
| Stringhe utente hardcoded (prod) | ~**30** in `SystemHealthDashboard.tsx` (0 `useTranslation`) + ~5 in `SystemHealthLive.tsx` | Read + grep |
| Pagine auth con loading/error/empty | **~54/64** all-three (loading 62 · error 58 · empty 58) | sweep delegation-aware |
| Error-state mancante (azionabili) | **~5** (`me/career`,`me/inbox`,`me/page`,`me/skills`,`org-chart`) | sweep |
| Componenti duplicati web↔showcase (git-tracked) | **3** (`status-pill`, `detail-panel`, `SystemHealthDashboard` 344 LOC) | `git ls-files` + sweep |
| Primitive generiche in `apps/web/components` | **2-3** (`status-pill`, `detail-panel`, borderline `data-table-panel`) | sweep |
| `<div/span onClick>` non-semantici | **0** | sweep |
| a11y gate | `serious=0` **incondizionato** (mobile+desktop), 35×3 = 0 di ogni severità | SOT §2.7 / §0-octodecies |

**Insight chiave**: il design-system / UX-IX è **strutturalmente sano** (0 hex UI, `dark:` evitato+documentato, i18n parity perfetta, a11y serious=0 incondizionato, 0 clickable-div). Le 3 leve reali sono tutte **consolidamento/consistency**, non bug: (1) **doppio rosso** `destructive`/`danger` da unificare sul token AA-governato — con la **correzione del memo storico** ("`text-destructive` invisibile" è STALE, la lib lo riempie); (2) **`SystemHealthDashboard`** triplo-difetto (hardcoded EN + duplicato 344-LOC + no error/empty state su route prod); (3) **primitive generiche duplicate** da promuovere in `@heuresys/ui`. Tail minore: ~5 error-state `me/*` mancanti.

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Dossier (richiedono decisione Enzo):**
- D — **promozione `StatusPill`/`FieldGrid` (+`DataTablePanel`?) in `@heuresys/ui`** + de-dup web↔showcase (tocca `ux-design-shared` + publish npm) [F-WS-E-7].
- D — **destino di `SystemHealthDashboard`**: pagina prod reale (→ i18n + live-data via `SystemHealthLive`) vs demo (→ spostare sotto `/showcase`, togliere dalla route auth) [F-WS-E-2/E-6].
- D/verify — **contrasto light di `text-destructive`** (≈4.23 approssimato): confermare con axe se è un AA-miss prima/durante QW-E1 [F-WS-E-1].

**Quick-wins CLASS-A** (eseguibili su go, gate espliciti sopra): QW-E1 normalizza rosso su `text-danger` + fix memo · QW-E2 i18n `SystemHealthDashboard` · QW-E3 i18n EmptyState `SystemHealthLive` · QW-E4 error-state ~5 pagine `me/*` · QW-E5 de-dup interim 3 primitive.

**Note (verifica/doc, non fix):** aggiornare `reference_apps_web_color_tokens.md` (voce `text-destructive` STALE) [F-WS-E-1]; aggiornare census i18n SOT 1108→1216 [F-WS-E-6]; ri-girare census axe dopo QW-E1 [F-WS-E-4].

**Asset da NON regredire**: token-discipline (0 hex UI) · `dark:` evitato+documentato (`status-pill`) · a11y serious=0 incondizionato · i18n parity 1216=1216 + script · live-data states 54/64 · 0 clickable-div · componenti domain legittimi in `apps/web`.

---

*Audit S-100X-A8 — read-only, ispezione repo + 1 sub-agent sweep. Nessuna modifica a codice/CSS/locale/CI. I finding qui confluiscono nel registro dossier 100X — decisione per-finding di Enzo. Cross-ref: WS-H (F-WS-H-3 skill-taxonomy authz + le note doc-stale) per il pattern "memo/doc da aggiornare"; il gotcha storico `text-destructive`-invisibile risulta **SUPERATO** dalla lib (gap-fill D3) → memo da correggere; nessun overlap con WS-C/WS-G (DB/CI).*
