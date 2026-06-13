# FINDINGS / WS-H — Application security & supply chain (S-100X-A2)

> Audit forense **read-only** del workstream sicurezza applicativa + supply-chain. Metodo: fan-out 5 sub-agent read-only (authz-session · tenant-isolation · injection-validation · secrets-exposure · supply-chain) → sintesi main-thread (AUDIT_PROTOCOL §4). Evidenza: `path:linea` reali + output live `psql`/`pnpm audit`/`gh`. Nessun file/CI/deploy modificato. **Riconciliato con WS-G (A1)**: i finding CI/CD/deploy (fork-PR D-08 MITIGATO S988, runner-SPOF, secret-on-host F-5/6, actions-pinning F-27, SBOM F-28, env-contract F-29) NON sono ri-riportati qui; WS-H copre ciò che WS-G non ha toccato. Data: 2026-06-13 (S988). Classificazione: `AUDIT_PROTOCOL.md`.

## Headline

1. **🔴 HIGH F-WS-H-1 — `TRUST_PROXY=false` (default) dietro il proxy nginx TLS collassa TUTTO il rate-limiting per-IP in un unico bucket.** Il guard brute-force login (10/5min) e il limiter per-email perdono efficacia in PROD a meno che il `.env` PROD (gitignored, non verificabile qui) non faccia override. **Azione: verificare/forzare `TRUST_PROXY=true` nel `.env` VM.**
2. **🟠 MEDIUM F-WS-H-2 — il `keyGenerator` del rate-limit legge `req.user` PRIMA che il plugin auth lo popoli** → la chiave per-utente è dead code, tutto keya su `req.ip` (compone F-1).
3. **🟠 MEDIUM F-WS-H1-1 (supply) — advisory HIGH `esbuild` tenuta APERTA dall'override del repo stesso** (`pnpm.overrides esbuild ^0.25.0` cappa sotto la patch `>=0.28.1`). Dev-only reachability. Risolvibile come quick-win.
4. **Asset confermati forti**: SQL 100% parametrizzato (60 moduli, 0 user-value non-parametrizzato), Zod su 415/415 route input-bearing, 0 mass-assignment, 0 secret in response/log (redaction runtime-proven), 0 secret tracked, error-handler senza leak, **`pnpm audit --prod` = 0 vuln**.
5. **Nota baseline stale**: RBAC live = **11 ruoli / 586 mapping / 133 permessi** (CLAUDE.md dice "8 ruoli / 394" — stale post-R2). Da aggiornare la doc.

---

## Gruppo A — AuthN / AuthZ / session (auth core)

### F-WS-H-1 — `TRUST_PROXY=false` default defeats per-IP rate-limiting behind nginx
- Severità: **HIGH** | Flag: DOSSIER (verificare prima il `.env` PROD reale)
- Evidenza: `apps/api/src/config/env.ts:54` `TRUST_PROXY ... default(false)`; `.env.example:15` `TRUST_PROXY=false`; `app.ts:169` `trustProxy: env.TRUST_PROXY`. PROD = nginx→next→api su `X-Forwarded-For` (`deploy/nginx/www.heuresys.com.conf:43`). Con `trustProxy:false` Fastify ignora XFF → `req.ip` = socket upstream del proxy (costante) → ogni login da ogni client condivide UNA chiave rate-limit.
- Impatto: **sicurezza** — credential-stuffing distribuito throttlato come un solo IP, oppure (rischio inverso) un bucket condiviso può lockare tutti gli utenti legittimi (DoS). Il limiter per-email (5/5min) cappa ancora lo spraying single-account → degradato-non-assente.
- Proposta: Conservativa — `TRUST_PROXY=true` nel `.env` PROD + default `true` quando il deploy reverse-proxy è la norma (con nota). Evolutiva — `trustProxy` come hop-count/CIDR esplicito (`'127.0.0.1'`) anti-spoof XFF.

### F-WS-H-2 — rate-limit `keyGenerator` reads `req.user` before the auth plugin runs → per-user keying dead
- Severità: **MEDIUM** | Flag: DOSSIER
- Evidenza: `app.ts:263-267` registra `@fastify/rate-limit` (step 7) con `keyGenerator: req => req.user?.userId ?? req.ip`; il plugin auth che popola `req.user` è step 8 (`app.ts:270`, hook `onRequest` `middleware/auth.ts:77`). Il rate-limit valuta la key nel proprio `onRequest` → ordine di registrazione → `req.user` sempre `undefined` → keya sempre `req.ip`.
- Proposta: Conservativa — togliere il ramo `req.user` (fuorviante) O spostare la registrazione rate-limit dopo l'auth plugin (ri-validare l'ordine 13-step). Compone con F-1.

### F-WS-H-3 — 4 moduli skill-taxonomy senza `requirePermission` sulle route (authz solo service-layer)
- Severità: **MEDIUM** | Flag: DOSSIER (consistency/defense-in-depth, NON un bypass live)
- Evidenza: `skill-aliases/`, `skill-categories/`, `skill-families/`, `skill-taxonomy-edges/` routes.ts → GET+POST+PATCH+DELETE con `preHandler:[app.verifyCsrf]` ma MAI `requirePermission`. L'authz è nei service (`ensurePlatformAdmin()`/`authorizeWriteOnSkill()`). Reads intenzionalmente aperte (catalogo). **0 path di mutazione non-guardato** (verificato end-to-end). Ma viola l'invariante CLAUDE.md "requirePermission su ogni route" → un audit RBAC grep-based concluderebbe falsamente che sono unprotected; un futuro refactor del service potrebbe droppare l'unico check.
- Proposta: aggiungere `requirePermission(...)` ai preHandler (service-check come belt-and-suspenders) + test READ_ONLY→403.

### F-WS-H-4 — `/v1/matching/search` (Voyage billable) + `/reindex` senza rate-limit per-route
- Severità: **MEDIUM** | Flag: DOSSIER
- Evidenza: request-time embedding (chiamata esterna Voyage, billable) + reindex (full backfill) senza limiter per-route oltre il globale 600/min.
- Proposta: rate-limit dedicato stretto sulle 2 route costose.

### ASSET (Gruppo A)
JWT RS256 + cookie HttpOnly/Secure/SameSite + refresh single-use rotation + replay family-revoke + CSRF double-submit + Argon2id — **core corretto**. D-26 widened-scope refresh cookie (`/`) **adeguatamente compensato** (single-use rotation, replay, CSRF, HttpOnly, TLS). Le **8 write-route senza CSRF sono tutte by-design** (pre-auth login/password-reset + login step-up con `challengeToken` come prova, nessun cookie ambient da forgiare). **0 vero gap CSRF; 0 route con NÉ guard NÉ service-authz.**

---

## Gruppo B — Injection & input validation

### ASSET — SQL injection: 0 user-value non-parametrizzato (headline)
- Evidenza: 60 moduli, raw SQL `$1,$2`; `${...}` nelle query solo per column-name const, mai user-input. Il wave-executor (unico dynamic-SQL) usa identifier **integer/allowlist-bounded** + `pg-format` `%I`/`%L` + trust-boundary contract `srcExpr` (`brownfield-wave-executor/{upsert-sql.ts:312,299; transform-compiler.ts:164-236}`), write-path `brownfield_adaptation:approve` = **PLATFORM_ADMIN only** (live-verified); l'unico input tenant-supplied è il `wave` int-bounded.
### ASSET — Zod 415/415 route input-bearing validate (type-provider); le route schema-less sono input-free o cookie-authed.

### 🟡 F-WS-H1-6 — file upload: caps/allowlist/nosniff reali, ma manca il magic-byte sniffing
- Severità: **MEDIUM** (defense-in-depth) | Flag: QUICK-WIN (~1h, additivo)
- Evidenza: corretto = 10 MiB cap (transport+service), allowlist `{png,jpeg,webp,gif,pdf}` (SVG escluso anti-XSS), `nosniff`+`attachment`+filename-sanitize sull'admin download, rate-limit 60/h (`content/media-{routes,service}.ts`). Gap = l'allowlist controlla **`file.mimetype`** (Content-Type client-dichiarato), mai i byte reali; il MIME dichiarato è persistito ed echeggiato come download `content-type`; il path ESS pubblico serve immagini **`inline`** (`me/routes.ts:233-235`) → un file `image/png` con byte diversi è servito inline col tipo (within-allowlist) influenzato. `nosniff`+SVG-escluso tengono basso il rischio pratico.
- Proposta: Conservativa/QUICK-WIN — sniff dei magic-number in `media-service.upload` (PNG/JPEG/GIF/WEBP/PDF), reject se byte≠dichiarato, store del MIME sniffato. Evolutiva — `file-type` + quota per-tenant. Radicale — AV/CDR out-of-band.

### ASSET — 0 mass-assignment: Zod strict objects (0 `passthrough/catchall`), SET per-colonna esplicito; solo `metadata` free-form → JSONB parametrizzato.

---

## Gruppo C — Secrets & data exposure

**Headline: NESSUN secret/credential raggiungibile in una response client o in un log applicativo (pino).**
- ASSET F-WS-H1-1: error-handler → solo `{code,message,requestId}`, mai stack/SQL/internal; `INTERNAL_ERROR` statico; `TenantBoundaryViolation`→404 anti-enumeration (`middleware/errorHandler.ts:110-114`).
- ASSET F-WS-H1-2: log redaction `LOG_REDACT_PATHS` completa + **runtime-proven** (`app.ts:139-167` + test `auth.integration.test.ts:600-647` asserisce sentinel assente, ≥10 `[REDACTED]`).
- ASSET F-WS-H1-3: credential hash (verify-only argon2) + TOTP secret **mai serializzati** (doppio gate: service mapper droppa + Zod response schema strippa).
- ASSET F-WS-H1-4: token via cookie **HttpOnly**; login body = solo `{status,user,roles,csrfToken}`; tutti i token-material storati hashed (solo `auth_mfa_factor_secret` non-hashed, per necessità TOTP).
- 🟢 **F-WS-H1-5 (LOW, DOSSIER)** — `defaultMfaMailer()` fallback lega `ConsoleMailer` a un **raw `console`** (bypassa la redaction pino) e logga `devOnlyCode` (OTP plaintext) (`mfa-service.ts:317-327`, `mailer.ts:63-67`). **LOW non HIGH**: irraggiungibile nel server live (`buildApp` inietta sempre un mailer pino-backed, `app.ts:297-299`). Proposta: droppare `devOnlyCode` dal field strutturato, o far throware `MAILER_NOT_CONFIGURED` il fallback.
- ASSET F-WS-H1-7: 0 secret nel tree (`git ls-files` pulito), `.env` untracked, `.env.example` PEM = placeholder, JWT keys da `.secrets/` gitignored. Corrobora WS-G:213.
- cross-ref F-WS-H1-8 → WS-G F-29 (`COOKIE_SECURE` default `NODE_ENV==='production'`; PROD HTTPS S962 → deve avere `COOKIE_SECURE=true`).

---

## Gruppo D — Supply chain (npm/pnpm tree; WS-G coprì le GitHub Actions)

**Headline: 1 alert Dependabot aperto (esbuild, dev-only) · `pnpm audit --prod` = 0 vuln · `pnpm audit` (incl dev) = 1 HIGH (lo stesso esbuild).**

### F-WS-H1-1 (supply) — advisory HIGH `esbuild` tenuta aperta dall'override del repo
- Severità: **HIGH → effettiva MEDIUM** (dev-only) | Flag: QUICK-WIN
- Evidenza: `esbuild >=0.17.0 <0.28.1` HIGH (GHSA-gv7w-rqvm-qjhr, RCE via `NPM_CONFIG_REGISTRY` all'install). Risolto `>=0.28.1` (pubblicato). Repo bloccato a `esbuild@0.25.12` da `package.json:62 pnpm.overrides "esbuild":"^0.25.0"` (aggiunto in `0f2c848` per chiudere il PRECEDENTE alert #33, ora cappa sotto la patch). esbuild **non** è dep diretta di nessuna app; vettore = install poisoning CI/dev only. Dependabot alert #79 `scope:runtime` = falso positivo della classificazione lockfile.
- Proposta: QUICK-WIN — override → `^0.28.1` (o **rimuovere** l'override) + `pnpm install` + audit. **Meglio**: vedi F-WS-H1-2 (rimuovere drizzle-kit elimina ogni path esbuild).

### F-WS-H1-2 (supply) — `drizzle-orm` (prod) + `drizzle-kit` (dev) DEAD
- Severità: **LOW** | Flag: QUICK-WIN (verify-then-remove)
- Evidenza: `drizzle-orm@0.45.2` (`apps/api/package.json:35`, **prod dep**) → unico import `db/client.ts:11` → `export const db = drizzle(pool)` **mai importato** (0 consumer; 0 uso della query-builder API; i `db.query<>()` sono node-postgres su `DbConnector`, false friend). `drizzle-kit@0.31.10` (dev) → **nessun `drizzle.config.*`**, è il **solo carrier dell'esbuild HIGH (F-1)**. Fully dead.
- Proposta: QUICK-WIN — rimuovere `client.ts:11`+`:47` + drop `drizzle-orm`/`drizzle-kit` → **risolve anche F-1** (elimina la superficie esbuild). Verify `pnpm build`+`test`+`audit`→0.

### F-WS-H1-3 (supply) — patch-lag su 2 runtime dep (next 16.2.7→.9, nodemailer 8.0.10→.11)
- Severità: **LOW** | Flag: QUICK-WIN (Dependabot le PR-erà) — nessun CVE aperto, ma sono i 2 pacchetti runtime esposti.

### ASSET F-WS-H1-4 — lockfile tracked + `--frozen-lockfile` ovunque + override per lo più difensivi (qs/uuid/tmp CVE-pin); 0 risoluzioni sospette (git/http/tarball); l'unico override problematico è esbuild (F-1).

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Quick-wins CLASS-A estraibili (indipendenti, ~ore):**
- QW-H1: rimuovere drizzle-orm/drizzle-kit dead-deps → chiude l'unico alert Dependabot (esbuild) + taglia ~20 path esbuild [F-WS-H1-1/2].
- QW-H2: magic-byte sniffing su media upload [F-WS-H1-6].
- QW-H3: rate-limit `keyGenerator` fix (togliere il ramo dead `req.user`) [F-WS-H-2].
- QW-H4: `requirePermission` sulle 19 route skill-taxonomy (pattern-restoring) [F-WS-H-3].
- QW-H5: drop `devOnlyCode` dal ConsoleMailer fallback [F-WS-H1-5].
- QW-H6: rate-limit per-route su `/matching/search` + `/reindex` [F-WS-H-4].

**Azione config (verifica PROD `.env`, NON in repo):** `TRUST_PROXY=true` + `COOKIE_SECURE=true` sul VM [F-WS-H-1 / WS-G F-29].

**Doc-fix:** CLAUDE.md RBAC baseline "8 ruoli/394 mapping" → **11 ruoli / 586 mapping / 133 permessi** (stale post-R2).

**Asset da NON regredire**: SQL parametrizzato (60 mod) · Zod 415/415 · 0 mass-assignment · 0 secret in response/log (redaction runtime-proven) · 0 secret tracked · error-handler no-leak · `pnpm audit --prod`=0 · lockfile/frozen-install hygiene.

---

*Audit S-100X-A2 — read-only, 5 sub-agent (761k token) + sintesi main-thread. Nessuna modifica a codice/CI/deploy. Prossimo: S-100X-A3 (workstream successivo del programma 100X). I finding sicurezza qui (F-WS-H-1/2/3/4, F-WS-H1-1/2/5/6) confluiscono nel registro dossier del programma — decisione per-finding di Enzo.*
