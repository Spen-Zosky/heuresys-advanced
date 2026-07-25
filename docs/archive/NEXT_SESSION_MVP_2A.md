> ⚠ **STORICO — non è una SoT.** Stato corrente vivo: `.handoff/STATE.md` · Backlog: `docs/kb/SOT_BACKLOG.md` · Debiti: `docs/kb/DEBT_REGISTER.md`. Archiviato S965 (2026-06-05); razionale: `docs/superpowers/specs/2026-06-05-sot-unification-design.md`.

# MVP-2a Admin Web SPA + ESS Frontend — Direttiva autoritativa per la sessione successiva

> **Questo file è il punto di ingresso autoritativo della prossima sessione.** Sostituisce ogni prompt ad-hoc. Il documento contiene: direttiva non-negoziabile, fase di audit, ordine di esecuzione, criteri di accettazione e **il prompt letterale da incollare** all'apertura.

---

## 0. Direttiva non-negoziabile — LIVE DATA E2E

**Vincoli non rinegoziabili per tutto MVP-2a (admin SPA, 23 pagine + 27 route) e MVP-2b frontend (13 pagine ESS):**

1. **❌ ZERO mock, ZERO demo data, ZERO placeholder fixture, ZERO hard-coded `[{name: "John Doe", ...}]`.** Ogni cella, ogni grafico, ogni tabella, ogni form deve essere alimentato da una chiamata reale a `/v1/*` che colpisce il PostgreSQL OCI VM via il pool API.
2. **❌ ZERO endpoint "stubbed", ZERO route Next.js che ritornano JSON statici, ZERO TanStack Query con `initialData` hard-coded.** L'unica eccezione ammessa è l'errore stato vuoto ("Nessun risultato trovato") quando la query REST ritorna lista vuota — e quello stato vuoto è una vera UI di empty state, non un placeholder informativo.
3. **❌ ZERO commit di pagina senza Playwright E2E test verde.** L'E2E test deve: (a) effettuare il login reale, (b) navigare alla pagina, (c) attendere il fetch reale del dato, (d) asserire su contenuti generati dal seed `RTL_BANK_REFERENCE` + 5 test personas, (e) (per pagine con mutation) effettuare la mutation e verificare lo state-change via re-fetch reale.
4. **✅ Ordine OBBLIGATORIO**: API-first → contract verify → frontend. Mai costruire UI prima che l'endpoint corrispondente esista, sia tippizzato in `@heuresys/shared`, e sia coperto da test integration verde in `apps/api/test/`.
5. **✅ Wiring completo a TUTTI i livelli prima del merge di una pagina**: shared schema → API repo/service/route → integration test → frontend types riusati da `@heuresys/shared` → TanStack Query hook → componente che chiama l'hook → Playwright E2E che alimenta tutto il flusso. Se uno solo dei livelli manca, la pagina **non è considerata fatta**.
6. **✅ Correzione + retest cycle**: ogni regressione in qualunque livello (TS, vitest API, Playwright, typecheck shared) blocca il merge della pagina corrente. Non si va avanti finché tutti i test sono verdi su Win locale + tunnel a OCI DB.

**Razionale**: questo MVP è il primo touchpoint con utenti reali (anche se in fase demo interna). Una UI fatta di mock è una UI che mente — agli stakeholder, all'AI agent, ai prossimi sviluppatori. La nostra differenza competitiva (auth + RBAC + tenant isolation + 256 schemi Zod end-to-end + 267 endpoint reali) è invisibile se la UI sopra è una facciata.

---

## 1. Pre-flight obbligatorio (alla prima azione della sessione)

```bash
# A. Working tree + git
cd D:/heuresys-advanced
git status -sb                     # → ## main...origin/main, clean
git log --oneline -3                # → 732e08b, fbb8466, 2f31c80
git pull origin main                # in caso siano arrivati commit altrove

# B. Sibling repo design system
cd ../ux-design-shared
git status -sb                     # → ## main...origin/main, clean
git pull origin main

# C. Tunnel + DB
ssh -fN -L 5433:localhost:5432 oracle-vm-default
netstat -ano | grep "LISTENING.*:5433"  # → TCP 127.0.0.1:5433 LISTENING

# D. Symlink design system attivo
cd D:/heuresys-advanced
readlink -f node_modules/@heuresys/ui
# → /d/ux-design-shared/ui  (o equivalente)

# E. Baseline test API: 182/182 verdi obbligatori per partire
cd apps/api && pnpm test
# → "Tests 182 passed (182)"
```

Se uno di questi step fallisce: **NON proseguire con MVP-2a, prima sanare**. Tipici fix: ricreare tunnel, `pnpm install`, rigenerare secrets se `.env` corrotto.

---

## 2. Fase 0 — API Gap Audit (PRIMA della UI)

**Obiettivo**: validare che i 267 endpoint esistenti coprono il 100% dei dati richiesti dalle 23 admin pages + 13 ESS pages descritte in `docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md` §11.

**Output atteso**: un file `docs/api/MVP_2A_API_GAP_AUDIT.md` con per ogni pagina:

| Pagina (route) | Dati richiesti | Endpoint(s) usato | Status |
|---|---|---|---|
| `/login` | login + cookie | `POST /v1/auth/login` | ✅ esiste |
| `/dashboard` | KPI tiles per ruolo | `GET /v1/auth/me`, `GET /v1/kpis?...`, … | ✅ esiste / ⚠️ aggregato non disponibile |
| ... | ... | ... | ... |
| `/positions/[id]` (PIP) | view sys_position_intelligence_profiles_v | `GET /v1/positions/:id` (deve esporre il join al view) | ⚠️ verificare shape |
| ... | ... | ... | ... |

**Procedura concreta**:

```bash
# 1. Estrarre la lista di endpoint live dal codice
cd D:/heuresys-advanced/apps/api/src
grep -rEh "app\.(get|post|patch|delete|put)\(\"/" modules/ | grep -oE '"/[^"]+"' | sort -u > /tmp/endpoints.txt
wc -l /tmp/endpoints.txt   # ~267

# 2. Estrarre lista pagine dal FE plan
grep -E "^\| [0-9ESS\-]+ \|" docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md | grep -oE "/[a-z][a-z0-9\-/[\]]*" | sort -u > /tmp/pages.txt
wc -l /tmp/pages.txt       # ~36

# 3. Per ogni pagina, costruire manualmente la riga della tabella
# Riferimento: FRONTEND_IMPLEMENTATION_PLAN.md §6 (Component Inventory per page) elenca
# i dati attesi per ogni componente; mappare ognuno a un endpoint esistente.
```

**Gap-fill obbligatorio prima di iniziare la UI**:
- Se una pagina necessita di un **endpoint aggregato** (dashboard tiles, "PIP completo", "career summary") che oggi non esiste: aprire una mini-milestone API (es. `5.1.24 — dashboard aggregators`) seguendo lo stesso 7-step pattern (shared schema → repo → service → route → integration test → app.ts register → commit atomico).
- Se una pagina chiede dati che richiedono **un nuovo modulo** (es. `compensation_intelligence` che ho deferito): allargare lo scope e completare prima.
- Se una pagina richiede un **filtro/query parameter** non supportato (es. paginazione cursor-based, full-text search): estendere lo schema query Zod + repository raw SQL, aggiungere test, aggiornare l'OpenAPI.

**Exit criteria Fase 0**: tabella audit completa, 0 righe in stato `⚠️` o `❌`, tutti gli endpoint coperti, full suite `pnpm test` in `apps/api` verde dopo eventuali aggiunte.

---

## 3. Fase 1 — Web app scaffold + auth client

Solo dopo che Fase 0 è ✅ verde si scaffolda Next.js. **Ordine obbligatorio**:

### 3.1 — Dipendenze di `apps/web` (commit atomico)

Aggiungere a `apps/web/package.json` (per riferimento puntuale: `docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md` §1):

```json
{
  "dependencies": {
    "next": "15.x",
    "react": "19.x",
    "react-dom": "19.x",
    "@tanstack/react-query": "5.x",
    "@tanstack/react-query-devtools": "5.x",
    "react-hook-form": "7.x",
    "@hookform/resolvers": "5.x",
    "zod": "3.25.76",
    "react-i18next": "15.x",
    "i18next": "23.x",
    "@heuresys/shared": "workspace:*"
    // Nota: NIENTE @heuresys/ui qui — è già al root come link:
    // Nota: NIENTE Radix, Tailwind, framer-motion, ecc. — vivono in ux-design-shared
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "5.7.x",
    "vitest": "2.x",
    "@playwright/test": "1.x",
    "tsx": "4.x"
  }
}
```

`pnpm install` dal root → verificare che il symlink `@heuresys/ui` continua a puntare a `D:/ux-design-shared/ui` e che `@heuresys/shared` continua a essere risolto come workspace.

### 3.2 — Configurazione Next.js per consumare il design system linkato

`apps/web/next.config.js`:

```js
/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  transpilePackages: ["@heuresys/ui", "@heuresys/shared"],
  // … resto config
};
```

`apps/web/tailwind.config.ts` (Tailwind 4 — riferimento `D:/ux-design-shared/ui/src/styles`):

```ts
import type { Config } from "tailwindcss";
export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../node_modules/@heuresys/ui/src/**/*.{ts,tsx}",
  ],
  presets: [require("@heuresys/ui/tailwind-preset")],  // se esiste, altrimenti import diretto dei token
} satisfies Config;
```

Verifica live-link: `touch ../../ux-design-shared/ui/src/_LINK.txt && ls node_modules/@heuresys/ui/src/_LINK.txt && rm ../../ux-design-shared/ui/src/_LINK.txt` deve funzionare istantaneamente.

### 3.3 — Auth client (cookie + CSRF + silent refresh)

Pattern da implementare per intero **prima** della prima pagina (riferimento `FRONTEND_IMPLEMENTATION_PLAN.md` §9):

- `src/lib/api/fetch.ts` — `fetchApi()` wrapper che attaches il cookie automaticamente (è HttpOnly, lato browser passa solo per same-origin → Next.js proxy `/api/v1/*` → `http://localhost:3001/v1/*`), legge il CSRF token da un cookie/header non-HttpOnly e lo iniettata in `x-csrf-token` su tutte le mutation.
- `src/lib/api/session.ts` — `getSession()` server-side via `GET /v1/auth/me` chiamato in `RootLayout` per pre-popolare il client.
- `src/lib/api/mutations.ts` — `useLogin()`, `useLogout()`, gestione del 401 con redirect a `/login`.
- **E2E test obbligatorio** prima di scrivere altre pagine: Playwright fa login reale come `admin@heuresys.com` / `<TEST_ADMIN_PASSWORD>`, verifica che cookie sia settato, che chiamata a `/v1/auth/me` ritorni l'utente, che logout azzeri la sessione.

### 3.4 — Acceptance Fase 1

- [ ] `apps/web/package.json` con deps reali (Next 15 + TanStack + Hook Form + i18next)
- [ ] `pnpm install` dal root passa senza warning critici
- [ ] `pnpm --filter @heuresys/web typecheck` verde
- [ ] `pnpm --filter @heuresys/web dev` avvia il server su `:3000`
- [ ] Symlink `@heuresys/ui` ancora live (verificato via `readlink -f` e touch test)
- [ ] Pagina `/login` fatta E funzionante con dato reale (no stub)
- [ ] Playwright E2E `tests/e2e/auth.spec.ts` verde:
  1. Apre `/login`
  2. Compila form con `admin@heuresys.com` + `<TEST_ADMIN_PASSWORD>`
  3. Submit → redirect a `/dashboard`
  4. Verifica via XHR intercept che `POST /v1/auth/login` sia stato chiamato e abbia ritornato 200 con body `{ user: { email: "admin@heuresys.com" }, csrfToken: "...", roles: [...] }`
  5. Verifica che cookie `heuresys_access_token` sia HttpOnly+Secure
- [ ] Commit atomico: `feat(web): MVP-2a Phase 1 — Next.js 15 scaffold + auth client (E2E green)`

---

## 4. Fase 2 — Pages page-by-page con E2E live-data

**Ordine consigliato (dalla più semplice strutturalmente alla più complessa)**:

1. `/login` (già fatta in Fase 1, contate come pilota)
2. `/me` (ESS landing — usa `GET /v1/me/profile` + `GET /v1/me/positions` — già esiste)
3. `/me/profile` (con PATCH form)
4. `/dashboard` (richiede aggregator endpoint — se non esiste, lo si crea in Fase 0)
5. `/users` (lista paginata con filtri + role badge)
6. `/users/[userId]` (detail + assignments tab)
7. `/positions` (lista + filter)
8. `/positions/[positionId]` (PIP — view `sys_position_intelligence_profiles_v`)
9. `/skills` (taxonomy tree)
10. `/kpis` (catalogue)
11. `/learning` (catalogue)
12. `/tenants` (registry — solo PLATFORM_ADMIN, RBAC visibile)
13. `/blueprints` (browser)
14. `/visualizations` + `/visualizations/[id]` (React Flow renderer)
15. … resto delle 36 route fino a chiusura

### 4.1 — Loop per ogni pagina (regola d'oro)

```
1. PRE-CHECK: endpoint(s) richiesti esistono in @heuresys/api?
   - SE NO: → tornare a Fase 0 (gap-fill) prima di proseguire.
   - SE SÌ: continuare.

2. PRE-CHECK: schemi Zod per request/response esposti da @heuresys/shared?
   - SE NO: aggiungerli (in ux-design-shared/ui solo se sono primitivi UI;
            in packages/shared se sono contract API).
   - SE SÌ: continuare.

3. SCRIVERE PRIMA il Playwright E2E test:
   - File: apps/web/tests/e2e/<page-name>.spec.ts
   - Test fa: login → naviga alla pagina → asserisce su dati reali del seed
   - Test deve FALLIRE inizialmente (red phase TDD).

4. IMPLEMENTARE la pagina:
   - apps/web/src/app/<route>/page.tsx (server component o client)
   - apps/web/src/app/<route>/queries.ts (hook TanStack Query)
   - Riusare componenti da @heuresys/ui (mai duplicarli).
   - Importare types da @heuresys/shared (mai ridichiararli).

5. ESEGUIRE i 4 livelli di test in ordine:
   a. pnpm --filter @heuresys/web typecheck
   b. pnpm --filter @heuresys/web test           (vitest unit, se applicabile)
   c. pnpm --filter @heuresys/web test:e2e -- <page-name>.spec.ts
   d. pnpm test                                  (regression intero monorepo)

6. ITERARE finché 6.a/b/c/d sono verdi.
   - Se rosso a livello c (E2E) per dati mancanti nel seed:
     opzione 1: estendere il seed in db/scripts/seed-test-admin.ts (preferibile)
     opzione 2: estendere RTL_BANK_REFERENCE seed in db/scripts/seed-reference-bank.ts
     opzione 3: aggiungere fixture seed dedicate al test (apps/web/tests/fixtures/*)
                MA mai mock in production code.

7. COMMIT ATOMICO della pagina, con messaggio standard:
   feat(web): MVP-2a Page N — <route> (E2E green, X assertions on live data)

8. PROSEGUIRE alla pagina successiva.
```

### 4.2 — Criteri di rifiuto pagina (red flags)

Una pagina **non passa** la review se:
- Contiene `const mockData = [...]` o equivalente
- TanStack Query usa `initialData` o `placeholderData` con dati fissi (oltre allo skeleton vuoto)
- Una mutation è solo `console.log("submitted", data)` invece di una chiamata reale
- Il test E2E è skippato (`.skip`, `.only`) o solo testa la presenza di un `<div>` senza verificare contenuto reale dal DB
- Una import da `@heuresys/ui` è stata duplicata copia-incollando il file in `apps/web` (violazione regola CLAUDE.md)
- Manca i18n parity it/en sui nuovi messaggi (script `pnpm i18n:check` deve restare verde)

---

## 5. Fase 3 — Acceptance MVP-2a globale

Prima di chiudere MVP-2a:

- [ ] Tutte le 27 admin routes implementate (FRONTEND_IMPLEMENTATION_PLAN.md §11)
- [ ] Tutte le 13 ESS routes implementate (FRONTEND_IMPLEMENTATION_PLAN.md §11.1)
- [ ] Per ogni route esiste un Playwright spec verde, totale ≥ 40 spec
- [ ] `pnpm i18n:check` verde (parity it/en al 100%)
- [ ] `pnpm test` totale: API ≥ 182 verdi + Web ≥ 40 E2E verdi + Web unit (se presenti)
  - **E2E run cadence** (CW-B54 mitigation, X15 evidence): la suite acceptance va eseguita contro `pnpm start` (warm production build), NON `pnpm dev` (JIT compile + 4-worker contention → ~45 timing fail su 125 test, 1.0h vs 5.3m). Dev mode acceptable solo per debugging single-spec con `--workers=1`. Per showcase tests servono `NEXT_PUBLIC_ENABLE_SHOWCASE=1` burn-at-build OR `NODE_ENV !== "production"`.
- [ ] `pnpm build` di `apps/web` produce un bundle senza errori
- [ ] Smoke test manuale: `pnpm dev` da `apps/web` + `pnpm dev` da `apps/api` → login via browser come ciascuna delle 5 test personas + verifica che la landing redirect rispetti `FRONTEND_IMPLEMENTATION_PLAN.md` §11.2
- [ ] Accessibility audit: ogni pagina passa `axe-playwright` (zero violazioni critical)
- [ ] HANDOFF.md aggiornato con i numeri finali (pagine, E2E spec, route count finale)

---

## 6. Memoria istituzionale — cose già fatte (NON ripetere)

Per la prossima sessione, ricordare che:

- **Backend API**: completo. 267 endpoint, 56 moduli business + auth + ESS. NON aggiungere endpoint senza un gap reale dimostrato dall'audit Fase 0.
- **Shared schemas**: 256+ Zod schemas in `@heuresys/shared`. Riusare, mai ridichiarare.
- **Design system**: 51 componenti in `@heuresys/ui` (linked live). Riusare, mai duplicare.
- **Auth/CSRF/RBAC**: complete. La UI consuma cookie + CSRF token via il pattern già documentato.
- **DB seed**: `RTL_BANK_REFERENCE` (158 personas + 158 positions + assignments) + 5 test personas con password nota `<TEST_ADMIN_PASSWORD>`. Tutti i Playwright login usano queste credenziali.
- **Tunnel SSH a OCI**: necessario per ogni `pnpm dev`, `pnpm test`, `pnpm test:e2e`. Riaprire se chiuso.
- **GitHub remote**: `Spen-Zosky/heuresys-advanced` (public) + `Spen-Zosky/ux-design-shared` (public). Push richiede sempre autorizzazione esplicita di Enzo.
- **CLAUDE.md sezione Design System**: regole non-negotiable per evitare duplicazione UI.

---

## 7. 📋 PROMPT LETTERALE per la prossima sessione

Copiare il testo che segue (tra le linee `=== BEGIN ===` e `=== END ===`) e incollarlo come primo messaggio nella sessione fresh di Claude Code CLI in `D:\heuresys-advanced`.

```
=== BEGIN PROMPT MVP-2A SESSION ===

Sono Enzo Spenuso. Riapro `heuresys-advanced` in `D:\heuresys-advanced\` su Windows.

CONTESTO: MVP-1 completo (5.1.3..5.1.23) + MVP-2b backend completo (ESS /v1/me/*).
267 endpoint live, 182/182 integration tests verdi al commit `732e08b`. Repo
pubblico su https://github.com/Spen-Zosky/heuresys-advanced. Sibling repo
design system pubblico su https://github.com/Spen-Zosky/ux-design-shared
linkato via pnpm `link:../ux-design-shared/ui` (live symlink, verificabile
via `readlink -f node_modules/@heuresys/ui`).

OBIETTIVO SESSIONE: avviare MVP-2a Admin Web SPA + MVP-2b frontend ESS,
seguendo la doctrine autoritativa documentata in
`D:\heuresys-advanced\NEXT_SESSION_MVP_2A.md`.

VINCOLI NON-NEGOZIABILI (estratti dalla sezione 0 del file sopra, leggere
il file per intero):

  1. ZERO mock data, ZERO demo fixture, ZERO placeholder hard-coded.
  2. ZERO endpoint stubbed; ogni pagina chiama un endpoint reale
     /v1/* che colpisce PostgreSQL sulla VM OCI via tunnel 5433.
  3. ZERO commit di pagina senza Playwright E2E test verde che esegue
     login reale + asserzioni su dati seed reali (RTL_BANK_REFERENCE +
     5 test personas, password <TEST_ADMIN_PASSWORD>).
  4. Ordine OBBLIGATORIO: API-first → audit gap → fill gap (TDD style) →
     scaffold web + auth client → page-by-page con E2E live-data.
  5. Wiring completo a TUTTI i livelli prima del merge di una pagina:
     shared schema → API route con integration test → frontend hook →
     componente da @heuresys/ui → Playwright E2E.
  6. Correzione + retest cycle obbligatorio: nessun avanzamento finché
     typecheck + vitest API + Playwright E2E + i18n parity sono verdi.

ORDINE DELLA SESSIONE OGGI (eseguire seriamente, in questa sequenza):

  Step 1 — Leggere in ordine:
    a. NEXT_SESSION_MVP_2A.md (questo file)  ← bibbia operativa
    b. CLAUDE.md                              ← invariant + regole shared UI
    c. HANDOFF.md                              ← stato live
    d. docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md §11 + §11.1 + §11.2
       (lista pagine, route binding, landing redirect per ruolo)
    e. docs/api/API_IMPLEMENTATION_PLAN.md §5 (roster moduli) + §6.5 (me)
    f. docs/architecture/adr/0011_ess_scope_inclusion.md
       (vincoli hard-self-scope ESS)

  Step 2 — Pre-flight obbligatorio (NEXT_SESSION_MVP_2A.md §1):
    - git status pulito
    - tunnel SSH 5433 UP
    - symlink @heuresys/ui → /d/ux-design-shared/ui
    - pnpm test (apps/api) = 182/182 verdi

  Step 3 — Fase 0 API Gap Audit (NEXT_SESSION_MVP_2A.md §2):
    Produrre `docs/api/MVP_2A_API_GAP_AUDIT.md` con riga per ognuna delle
    27 admin route + 13 ESS route, colonna "Endpoint usato" + "Status".
    Identificare endpoint mancanti (probabilmente aggregator per dashboard,
    eventualmente compensation_intelligence non shippato).
    Output: tabella audit + lista gap. NON aprire la UI finché ogni riga
    è ✅.

  Step 4 — (Solo se Fase 0 emerge gap) Fase 1.5 Fill gaps:
    Per ogni endpoint mancante, applicare il pattern 7-step canonical
    (shared schema → repo → service → route → integration test →
    register app.ts → commit atomico). Verde a 182+N tests prima di
    proseguire.

  Step 5 — Fase 1 Web scaffold + auth client (NEXT_SESSION_MVP_2A.md §3):
    - Aggiungere deps reali a apps/web/package.json (Next 15, TanStack,
      Hook Form, i18next, NIENTE Radix/Tailwind che vivono in
      @heuresys/ui).
    - next.config.js con transpilePackages: ["@heuresys/ui", "@heuresys/shared"]
    - tailwind.config.ts che scanna node_modules/@heuresys/ui/src
    - Implementare fetchApi() wrapper, useLogin/useLogout, gestione CSRF.
    - Implementare pagina /login (pilota) con form reale.
    - Playwright E2E auth.spec.ts verde.
    - Commit atomico.

  Step 6 — Fase 2 Pages page-by-page (NEXT_SESSION_MVP_2A.md §4):
    Procedere nell'ordine indicato nella §4 del documento. Per ogni pagina
    applicare il loop §4.1 (scrivere prima E2E, poi implementare, poi
    iterare fino a verde). Commit atomico per pagina.

REGOLE DI AUTONOMIA (richiamo da memoria CLAUDE.md):
  - Commit locali su main: pre-autorizzati.
  - git push: SOLO se Enzo lo richiede esplicitamente.
  - --no-verify, --force, --force-with-lease: vietati senza richiesta.
  - DROP DATABASE / rm -rf path non-temp / git reset --hard: richiedono
    conferma esplicita.
  - Massima completezza per ogni step (feedback_maximize_completeness):
    no half-finished pages, no "TODO: implement later" lasciati in produzione.

REPORT INIZIALE atteso da Claude al primo turno:
  - Conferma in 4-6 righe di:
    a. Pre-flight (step 2) tutto verde
    b. Riepilogo gap audit (step 3): N pagine, M gap identificati
       (anche se 0 — esplicitarlo)
    c. Piano dei prossimi 2-3 commit atomici
    d. Domande di chiarimento (solo se davvero necessarie — preferire
       feedback_maximize_completeness)

Procedi.

=== END PROMPT MVP-2A SESSION ===
```

---

## 8. Materiali di riferimento (link diretti)

- **Doctrine + plan** (questo file): `D:/heuresys-advanced/NEXT_SESSION_MVP_2A.md`
- **FE pages roster**: `docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md` (§11 admin, §11.1 ESS, §11.2 redirect)
- **API roster**: `docs/api/API_IMPLEMENTATION_PLAN.md` (§5 moduli, §6.5 me)
- **ESS self-scope vincoli**: `docs/architecture/adr/0011_ess_scope_inclusion.md`
- **Auth flow**: `docs/security/AUTH_SECURITY_PLAN.md` (§3 Argon2id, §4 JWT+refresh+CSRF, §6 RBAC matrix)
- **Design system regole**: `CLAUDE.md` sezione "Design System — CENTRALIZZATO in `D:\ux-design-shared`"
- **VM bootstrap** (se serve replicare altrove): `heuresys-advanced-bootstrap-vm.md`

---

**Versione**: 1.0  
**Data**: 2026-05-17  
**Autore**: documento generato a chiusura sessione MVP-1/MVP-2b backend (commit `732e08b`).  
**Successore**: la sessione MVP-2a stessa produrrà `docs/api/MVP_2A_API_GAP_AUDIT.md` come deliverable della Fase 0.
