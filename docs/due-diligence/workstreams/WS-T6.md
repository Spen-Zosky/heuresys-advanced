# WS-T6 — Security Posture Audit (Investor Due Diligence)

**Data**: 2026-06-17
**Auditor**: Claude Security Auditor (automated static analysis)
**Scope**: heuresys-advanced @ HEAD `ce26608` (branch main)
**Metodo**: Analisi statica forense avversariale — ogni claim rivalidato con grep/read/bash reali. Postura indipendente: i documenti interni (`WS-H.md`, `3.2_ASVS_MAPPING.md`, `D-13.md`, `DEBT_REGISTER.md`) trattati come rappresentazione del venditore, non come verità. Solo lettura — nessun exploit su prod.

---

## Sintesi

Il core di sicurezza applicativa è **solido e materialmente corretto**. Le affermazioni del venditore su Argon2id, RS256 JWT, refresh single-use con replay detection, CSRF double-submit, SQL 100% parametrico e log redaction sono tutte **confermate con evidenza file:line**. Il codebase mostra una cura insolita per un prodotto pre-revenue: un bug di footgun `z.coerce.boolean()` sul flag `TRUST_PROXY` (avrebbe trasformato `"false"` in `true`, rendendo il rate-limit spoofabile via XFF forgiato) è stato identificato e risolto con un parser dedicato; TOTP at-rest con AES-256-GCM è stato implementato (D-30, commit `00a6d7b`); HSTS è presente in nginx da S993 (`deploy/nginx/www.heuresys.com.conf:39`).

I gap residui identificati da questo audit indipendente sono tutti **classificati Medium o inferiore**, nessuno è un showstopper. Il più rilevante in ottica investor-grade è la **hardcoded test credential** `Admin#PassW0rd!` presente in 20+ file TS committati (incluso lo script live-acceptance di agent-gateway), che — pur essendo credenziale di dati sintetici — rappresenta una bad-practice di secret hygiene inconsistente con i controlli altrimenti forti del progetto. Un secondo gap riguarda `admin/revoke-user` che non scopa il tenant target per i TENANT_ADMIN (perm-gated, non un bypass live, ma un follow-up esplicito documentato nel codice). Il terzo è la mancanza di test adversariali sistematici (injection, brute-force, fuzz) — solo 4 file su 148 toccano queste categorie.

Per un prodotto in fase pre-revenue con dati 100% sintetici (ADR-0023) il rischio operativo è basso. Per la transizione al primo tenant pagante reale, T6-001 (credential hygiene) e T6-002 (revoke-user scope) diventano prerequisiti P1.

---

## Claim del venditore rivalidati

| Claim | Fonte | Stato | Evidenza | Note |
|-------|-------|-------|----------|------|
| Argon2id 64MiB/3/4 | WS-H | **CONFERMATO** | `apps/api/src/modules/auth/password.ts:16-22` — `ARGON2_PARAMS { type:argon2id, memoryCost:65536, timeCost:3, parallelism:4, hashLength:32 }`; `needsRehash` auto-rotation on login `service.ts:332-334` | Parametri ASVS V2.4.1 corretti e verificati |
| RS256 JWT 15min HttpOnly+SameSite | WS-H | **CONFERMATO** | `app.ts:262-275` — `algorithm:"RS256"`, `expiresIn:"15m"`, `iss`+`aud` set+verified; `tokens.ts:64-70` — `httpOnly:true, secure:bundle.secure, sameSite:"lax"` | Cookie path `"/"` by-design (D-26 proxy traversal, compensating controls documentati) |
| Refresh single-use + replay detection | WS-H | **CONFERMATO** | `tokens.ts:39` — CSPRNG 32-byte `randomBytes`; `errors/index.ts:52` — `REFRESH_REPLAY_DETECTED`; family revoke in `service.ts`; CSRF su `/refresh` (`routes.ts:143`) | Single-flight Web Lock cross-tab implementato in `web/lib/api/fetch.ts` |
| CSRF double-submit | WS-H | **CONFERMATO** | `app.verifyCsrf` su `refresh`+`logout`+`revoke-user` (`routes.ts:143,178,255`); 206 occorrenze `app.verifyCsrf` nei moduli (`grep count=206`); 13/13 write-path MFA routes con `verifyCsrf`; pre-auth routes by-design exempt | 0 vero gap CSRF attivo confermato |
| SQL 100% parametrico | WS-H | **CONFERMATO** | `${...}` nelle query = solo const column-names + clausole parametriche accumulate (`params.push(v); where.push("col = $N")`); `analytics/repository.ts` usa `userScopeClause()` che ritorna `{sql, params}` — template interpola solo il fragment pre-costruito con binding; 0 user-value interpolato raw su 25+ repository campionati | Wave-executor usa `pg-format %I/%L` + int/allowlist-bounded (PLATFORM_ADMIN only) |
| TOTP encryption AES-256-GCM | D-30 | **CONFERMATO** (implementato S994) | `apps/api/src/modules/auth/secret-crypto.ts` — AES-256-GCM, IV 12 random bytes fresh-per-record, authTag 16 byte, self-identifying prefix `enc:v1:`, retro-compat plaintext legacy; `env.ts:98-101` `MFA_ENCRYPTION_KEY` ora consumata (non più inerte) | Key-presence gate: senza key → plaintext passthrough (retro-compat); I 6 secret correnti sono e2e-fixture (plaintext by-design) |
| Log redaction attiva | WS-H | **CONFERMATO** | `app.ts:149-171` `LOG_REDACT_PATHS` — `cookie`, `authorization`, `password*`, `hash`, `secret`, `code`, `otp`, `devOnlyCode`, `refreshToken`; runtime-proven: `auth.integration.test.ts:600-647` asserta sentinel assente + ≥10 `[REDACTED]` | `devOnlyCode` già droppato dal `ConsoleMailer` fallback (F-WS-H1-5 chiuso S989) |
| D-28 trust-proxy fix | DEBT | **CONFERMATO** (RISOLTO) | `apps/api/src/config/trust-proxy.ts` — `parseTrustProxy()` corregge il footgun `z.coerce.boolean("false")===true`; `env.ts:61` usa `z.string().default("false").transform(parseTrustProxy)`; VM `.env` ha `TRUST_PROXY=1` (1 hop nginx, XFF forgiato ignorato) | DEBT_REGISTER documenta che il valore EFFETTIVO era `true` (trust-all = spoofabile) — fix più critico di quanto WS-H stimasse |
| D-26 refresh-cookie path='/' | DEBT | **CONFERMATO** (RISOLTO + residuo accettato) | `tokens.ts:26` `REFRESH_COOKIE_PATH = "/"`, `tokens.ts:32-33` legacy path `"/v1/auth"` clear-on-logout; `proxy.ts` pass-through se `hrx_refresh` presente | Compensating controls: HttpOnly+Secure+SameSite=Lax, TLS, CSRF, single-use rotation+replay |

---

## Finding

### T6-001 — Hardcoded test credential `Admin#PassW0rd!` in 20+ file committati (incluso agent-gateway live-acceptance)
- **Severità**: Medium
- **Tipo**: Secret Hygiene / Credential Exposure
- **Evidenza**:
  - `apps/agent-gateway/scripts/live-read-acceptance.ts:24` — `const PASSWORD = process.env.ACC_PASSWORD ?? "Admin#PassW0rd!";` — fallback hardcoded in script di acceptance che gira contro PROD
  - Stessa pattern: `live-skills-acceptance.ts:37`, `live-write-acceptance.ts:32`
  - `apps/api/test/auth-mfa.integration.test.ts:24`, `apps/api/test/auth-refresh-cookie.integration.test.ts:29`, e 17+ altri file di test: `const PWD = "Admin#PassW0rd!"`
- **Impatto**: Con dati sintetici (ADR-0023) il rischio operativo è contenuto. Il vettore reale è il pattern: uno sviluppatore futuro (o un processo automatizzato) potrebbe riusare la credential in un tenant reale; gli script agent-gateway sono live-acceptance che puntano a PROD. La credential è visibile nel tree a chiunque abbia accesso al repo.
- **GA-blocker**: No (dati sintetici oggi), ma **prerequisito commerciale** al primo tenant reale
- **Remediation**: (a) Agent-gateway scripts: rimuovere il fallback hardcoded — l'script deve fallire loudly se `ACC_PASSWORD` non è set; (b) Test suite: centralizzare in `test/helpers/test-constants.ts` che legge da env (con `.env.test` gitignored); (c) Rotare la credential dei seeded test-persona in ambienti non-dev. Effort ~2h.
- **Ref**: OWASP A07:2021; CWE-798 Use of Hard-coded Credentials
- **Confidence**: Alta

### T6-002 — `admin/revoke-user` senza scope check del tenant target per TENANT_ADMIN
- **Severità**: Medium
- **Tipo**: AuthZ / Privilege Escalation (latent)
- **Evidenza**: `apps/api/src/modules/auth/routes.ts:248-253` — commento esplicito nel codice: `"TENANT_ADMIN scope filter (own-tenant target) is enforced post-MVP; for MVP-1 the permission grant gates access"`. `requirePermission("auth:revoke_user")` è presente (perm-gate corretto), ma `service.adminRevokeUser()` accetta `targetUserId` arbitrario senza verificare `target.tenantId === actor.tenantId` per i TENANT_ADMIN.
- **Impatto**: Un TENANT_ADMIN di RTL_BANK potrebbe tecnicamente revocare sessioni di un utente del tenant Heuresys System (cross-tenant) se conosce il suo userId. Con 2 tenant sintetici l'impatto è nullo; con tenant reali multipli è un cross-tenant privilege escalation su una route di sicurezza critica.
- **GA-blocker**: **Sì**, per release con tenant reali multipli
- **Remediation**: In `service.adminRevokeUser()`, dopo il lookup del target user, aggiungere: `if (isTenantAdmin(actor) && target.tenantId !== actor.tenantId) throw new ForbiddenError("Cannot revoke user outside own tenant", "CROSS_TENANT_FORBIDDEN")`. Effort ~1h + test.
- **Ref**: OWASP A01:2021 Broken Access Control; ASVS V4.3.1
- **Confidence**: Alta

### T6-003 — `.env.example` con `TRUST_PROXY=false` default — trap per new deploy dietro reverse-proxy
- **Severità**: Medium
- **Tipo**: Config / Security Misconfiguration
- **Evidenza**: `.env.example` — `TRUST_PROXY=false` (verificato: `cat .env.example | grep TRUST_PROXY`). Con `parseTrustProxy("false") = false` (parser corretto), un nuovo deploy che copia `.env.example` alla lettera + nginx proxy = tutti i client condividono un unico rate-limit bucket (req.ip = socket nginx costante). La VM PROD ha l'override `TRUST_PROXY=1` (verificato da D-28), ma la default del file di esempio rimane fuorviante.
- **Impatto**: Un nuovo staging/CI environment o un secondo deploy che usa `.env.example` senza leggere la documentazione ottiene un rate-limit brute-force non funzionale. Non impatta la PROD oggi.
- **GA-blocker**: No
- **Remediation**: Cambiare `.env.example`: `TRUST_PROXY=1  # 1 nginx hop. Use false/0 only for direct (no-proxy) bind.` Effort ~5 min.
- **Ref**: OWASP A05:2021 Security Misconfiguration; ASVS V14.2
- **Confidence**: Alta

### T6-004 — Nessun test adversariale sistematico (injection, brute-force, fuzz)
- **Severità**: Low
- **Tipo**: Gap / Test Coverage
- **Evidenza**: `ls apps/api/test/*.test.ts | wc -l` = 148; `grep -rl "injection|xss|csrf.attack|brute.force|fuzz|pentest|malicious" apps/api/test/ | wc -l` = 4. I 4 file toccano queste categorie incidentalmente, non sistematicamente. Nessun test verifica: SQL metachar nei filtri; header manipulation per bypass rate-limit; file upload magic-byte spoofed; JWT `alg:none` o tampered; CSRF token assente su POST.
- **Impatto**: Il codebase è correttamente implementato (SQLi impossibile by-construction, Zod 415/415, magic-byte sniffing presente), ma l'assenza di test negativi espliciti crea un gap di regression coverage: un futuro refactor potrebbe non essere catturato.
- **GA-blocker**: No
- **Remediation**: Aggiungere `test/security.integration.test.ts` con ≥10 casi negativi: SQL metachar nei parametri filtro, XFF forged con TRUST_PROXY=1, file upload magic-byte mismatch, JWT tampered, CSRF absent → 403. Effort ~3h.
- **Ref**: OWASP Testing Guide WSTG-INPV; ASVS V5.3, V11.2
- **Confidence**: Alta

### T6-005 — HSTS senza `includeSubDomains` (evo.heuresys.com potenzialmente esposto a SSL-strip)
- **Severità**: Low (Info)
- **Tipo**: Hardening / Config
- **Evidenza**: `deploy/nginx/www.heuresys.com.conf:39` — `add_header Strict-Transport-Security "max-age=31536000" always;` — assenza intenzionale di `includeSubDomains`. Il commento nella config stessa lo spiega: `"NO includeSubDomains (evo.heuresys.com may be HTTP-only)"`.
- **Impatto**: Un attaccante sulla rete può eseguire un SSL-strip su `evo.heuresys.com` o altri sottodomini. Non impatta `www.heuresys.com`. Rischio basso finché non esistono sottodomini con sessioni condivise.
- **GA-blocker**: No
- **Remediation**: Aggiungere `includeSubDomains` dopo che `evo.heuresys.com` è dismesso o portato a HTTPS. Effort ~5 min config, decisione operativa.
- **Ref**: ASVS V9.2.2; OWASP HSTS Cheat Sheet
- **Confidence**: Alta

### T6-006 — Agent-gateway `delete process.env.ANTHROPIC_API_KEY` — pattern di igiene fragile
- **Severità**: Low (Info)
- **Tipo**: Secret Hygiene
- **Evidenza**: `apps/agent-gateway/src/server.ts:44` — `delete process.env.ANTHROPIC_API_KEY;`. Il pattern è corretto come riduzione della superficie (la key non è più leggibile dopo il boot via `process.env`), ma non è un controllo forte: la key è già stata letta in memoria da tutti i moduli che la importano prima del `delete`.
- **Impatto**: Minimo — l'agent-gateway gira localmente su abbonamento MAX (non key esterna). Il pattern rimane come anti-modello documentato per team futuri.
- **GA-blocker**: No
- **Remediation**: Commentare con una nota che chiarisca la portata del controllo, o usare secret injection dedicata se l'agent-gateway dovesse servire clienti reali.
- **Ref**: CWE-312; ASVS V2.10
- **Confidence**: Media

### T6-007 — Rate-limit store in-process — no shared-state su multi-replica (residuo accettato)
- **Severità**: Low (architetturale)
- **Tipo**: Scalabilità / Anti-Automation
- **Evidenza**: `apps/api/src/modules/auth/email-rate-limit.ts:22-27` — Map in-process per il per-email limiter; `@fastify/rate-limit` default store in-process. Corretto per la singola istanza `node dist/server.js` attuale (systemd unit, 1 processo).
- **Impatto**: Se/quando l'API scala a più repliche, il per-IP e per-email rate-limit diventano non-condivisi → ogni replica conta separatamente → efficacia ridotta di N×. Nessun rischio oggi.
- **GA-blocker**: No (single-process documentato; interfaccia Redis-swappable già prevista)
- **Remediation**: Predisporre la migration a Redis store prima del first scale-out. Effort ~4h.
- **Ref**: ASVS V11.x residuo accettato
- **Confidence**: Alta

---

## Showstopper

**Nessuno showstopper identificato.**

Nessun finding è Critical. Nessuna SQL injection attiva, IDOR funzionale, secret trapelato in response/log, o bypass auth trovato. I finding T6-001 e T6-002 sono classificati come **prerequisiti commerciali** (bloccano il GA commerciale al primo tenant reale, non l'investimento).

---

## Score del pilastro

- **Score**: 78/100
- **Confidence**: Alta
- **Banda**: **Forte** (75–89)
- **Motivazione**: Il core auth è un asset genuino (Argon2id/RS256/refresh-rotation+replay/CSRF/MFA multi-factor — ASVS L1 sostanzialmente pieno + L2 TOTP at-rest implementato), SQL 100% parametrico su 75 moduli, log redaction runtime-proven, tutti i finding HIGH/MEDIUM da WS-H chiusi prima dell'audit. I 22 punti di detrazione rispetto al massimo: credential test hardcoded in 20+ file committati (−5), revoke-user cross-tenant scope gap aperto (−4), nessun test adversariale sistematico (−3), `.env.example` TRUST_PROXY default fuorviante (−3), HSTS senza includeSubDomains (−2), altri hardening minori (−5). Il codebase riflette un developer singolo con disciplina di sicurezza insolita; le pratiche da team professionale (zero credential in tree, suite security testing, full tenant isolation su ogni route admin) completerebbero il quadro.

---

## Asset da NON regredire (per futuri sprint)

I seguenti controlli sono **PASS live** e non devono essere modificati senza revisione:

- **SQL parametrico 100%** — mai interpolazione user-value diretta; usare sempre `$N` binding
- **Zod 415/415** — ogni route input-bearing validata; nessun `passthrough/catchall`
- **Log redaction runtime-proven** — `LOG_REDACT_PATHS` + test `auth.integration.test.ts:600-647`; non rimuovere il test
- **Refresh token single-use + family revoke** — non modificare il path rotation senza test E2E `session-refresh.spec.ts`
- **CSRF double-submit su ogni write-route post-auth** — 206 occorrenze; ogni nuovo modulo deve avere `app.verifyCsrf`
- **`parseTrustProxy()` non `z.coerce.boolean()`** — il footgun è documentato in 4 variabili env; non regredire su booleani coercitivi per flag env

---

*Audit WS-T6 — read-only / static analysis. Nessuna modifica a codice, CI, deploy o DB. Tutti i finding hanno evidenza concreta file:line. Prossimo passo raccomandato: T6-002 revoke-user scope fix (~1h) prima del primo tenant reale; T6-001 credential hygiene cleanup (~2h) prima di condividere il repo con investitori esterni.*
