# WS-T6 — Security posture forense
Agente: Security (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

> Rivalidazione della due diligence T6 di giugno (HEAD `ce26608`, 2026-06-17). ~1978 commit di delta. Metodo: grep/read/bash reali su HEAD attuale, `pnpm audit` in sola lettura, ispezione `.claude/rules/security-auth.md` e del nuovo plugin `enzo-guard`. Nessuna scrittura su codice/DB/CI, nessun segreto vero riportato (solo struttura/nomi variabile/presenza-assenza).

**Nessun finding Critical.** Nessuna SQL injection, IDOR funzionale, secret trapelato in chiaro, o bypass auth trovato in questa rivalidazione.

---

## Sintesi

Il core di sicurezza applicativa resta **solido e materialmente corretto**, e i due gap più seri del baseline di giugno sono **entrambi risolti**. T6-002 (giugno, GA-blocker): `admin/revoke-user` ora applica lo scope cross-tenant in `service.ts:703-718` — un TENANT_ADMIN non può più revocare un utente fuori dal proprio tenant. T6-001 (giugno, credential hardcoded): il modello è stato sostituito interamente (Z-262, #258, F-001) da password **derivate per-email** da una chiave madre gitignored (`apps/api/test/helpers/personas.ts`), con guardia esplicita che impedisce di impersonare una persona fisica reale nei test; nessuna costante-password committata sopravvive, né in `apps/api/test/` né negli script live-acceptance di `agent-gateway` (ora `process.env.ACC_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD ?? ""`, senza fallback letterale).

Sono comparsi due controlli strutturali nuovi rispetto a giugno: (1) il plugin `enzo-guard`, che applica a livello di motore — non di disciplina del modello — protezione di path (`.secrets/`, cartelle di ispezione brownfield), un guardrail sul reset/migrate DB e un cancello sulla modalità di sessione; (2) il modello di mandato RBAC (`mandati.ts`, R-1, commit `5da8bde5`/`8eeb7ab2`) che formalizza gli invarianti I16-I22 come predicato invece che come convenzione sparsa. Inoltre TRUST_PROXY ha ricevuto un secondo giro di hardening (#242 F3, 2026-09-05): la forma hop-count `"1"` è ora rifiutata al boot perché Fastify ≥5.12 la interpreta come "non fidarti di nessuno", collassando silenziosamente il rate-limit per-IP in un unico bucket — un footgun diverso da quello di D-28 ma della stessa famiglia, chiuso prima che potesse manifestarsi in produzione.

I gap residui sono tutti Low o Medium: assenza di test adversariali sistematici (3 file su 292 toccano injection/xss/brute-force/fuzz, proporzione invariata o lievemente peggiorata rispetto a giugno), `.env.example` con `TRUST_PROXY=false` di default (ora ampiamente commentato con la forma PROD corretta, quindi il rischio "trap silenzioso" è mitigato ma non chiuso), HSTS senza `includeSubDomains` (invariato, stessa giustificazione documentata), rate-limit store in-process (invariato, interfaccia Redis-swappable dichiarata), e una vulnerabilità High da `pnpm audit` — ma è in una devDependency di lint (`eslint-config-next → minimatch → brace-expansion`, DoS via ReDoS), non nel percorso di runtime servito.

---

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| Argon2id 64MiB/3/4 con auto-rehash al login | CONFERMATO | `apps/api/src/modules/auth/password.ts:15-24` — `ARGON2_PARAMS{type:argon2id, memoryCost:65536, timeCost:3, parallelism:4}`, invariato da giugno |
| Access token RS256, TTL 15m, cookie HttpOnly | CONFERMATO | `apps/api/src/app.ts:315` `algorithm:"RS256"`, `:318` `expiresIn:"15m"` |
| Refresh single-use + replay detection con family-revoke | CONFERMATO | `apps/api/src/errors/index.ts:63` `REFRESH_REPLAY_DETECTED`; 4 occorrenze in `modules/auth/service.ts` (righe 522-564), logica invariata da giugno |
| CSRF double-submit su ogni write-route post-auth | CONFERMATO (cresciuto) | `grep -rc verifyCsrf apps/api/src/modules/` = **289 occorrenze su 93 file** (giugno: 206/moduli non contati per file) — crescita coerente con nuovi moduli (`teams`, `provision-engine`, mandati) |
| SQL 100% parametrico, mai interpolazione di user-value | CONFERMATO | Campione `compensation/repository.ts:184-214` — ogni `${...}` è un nome-colonna costante o un placeholder `$${params.length}` costruito da push posizionale, mai un valore utente diretto; pattern identico su 6 repository campionati a caso |
| TOTP AES-256-GCM at-rest | CONFERMATO | `apps/api/src/modules/auth/secret-crypto.ts` invariato da D-30/giugno |
| Log redaction runtime-proven | CONFERMATO | `app.ts:189` `LOG_REDACT_PATHS`, `:217`/`:621` applicato al logger; `auth.integration.test.ts:652-654` asserta ≥10 occorrenze `[REDACTED]` |
| D-28 `parseTrustProxy()` non-coercitivo | CONFERMATO (rinforzato) | `env.ts:99` `TRUST_PROXY: z.string().default("false").transform(parseTrustProxy)`; NUOVO: `.env.example:34` — la forma hop-count `"1"` è **rifiutata al boot** dal 2026-09-05 (#242 F3), un secondo footgun della stessa famiglia di D-28 chiuso proattivamente |
| T6-001 (giugno) "hardcoded test credential in 20+ file" | **SMENTITO oggi — risolto e superato** | Nessuna costante-password committata: `apps/api/test/helpers/personas.ts:47-56` deriva la password per-email da chiave madre gitignored, con guardia anti-impersonazione di persone fisiche; `apps/agent-gateway/scripts/live-*-acceptance.ts` non hanno più fallback letterale (`process.env.ACC_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD ?? ""`); i residui `<TEST_ADMIN_PASSWORD>` nei commenti sono segnaposto documentati, non segreti (`personas.ts:58-70`) |
| T6-002 (giugno) "revoke-user senza scope cross-tenant, GA-blocker" | **SMENTITO oggi — risolto** | `apps/api/src/modules/auth/service.ts:703-718`: per attori non-PLATFORM, verifica `target.userTenantId !== input.actorTenantId` → `ForbiddenError`; stesso pattern replicato in `adminListSessions` (righe 739+) |
| Nessun test adversariale sistematico | CONFERMATO (gap persistente) | `ls apps/api/test/*.test.ts` = **292** file (giugno: 148); `grep -rlE "injection\|xss\|csrf.attack\|brute.force\|fuzz\|pentest\|malicious"` = **3** file — proporzione invariata/lievemente peggiorata (1.0% vs 2.7% di giugno) |
| Supply chain pulita | PARZIALE | `pnpm audit --audit-level=high` = **1 vulnerabilità High** (`brace-expansion` via `eslint-config-next→...→minimatch@10.2.5`, GHSA-rgw5-rvv9-x895, DoS/ReDoS) — catena di lint/dev, non runtime servito |

---

## Finding

### T6-101 — RISOLTO: `admin/revoke-user` ora applica lo scope cross-tenant (era T6-002, GA-blocker)
- **Severità**: Info (era High)
- **Tipo**: strength (era risk)
- **Evidenza**: `apps/api/src/modules/auth/service.ts:703-718` — per attori non-PLATFORM_ADMIN, lookup del target e confronto `target.userTenantId !== input.actorTenantId` → `ForbiddenError("Cannot revoke users outside your tenant")`; stesso guard replicato in `adminListSessions` (righe 739-744). Commento nel codice referenzia esplicitamente "AUTH §6 matrix".
- **Impatto**: Chiude il vettore di privilege-escalation cross-tenant su una route di sicurezza critica identificato a giugno.
- **GA-blocker**: N/A (era Sì — ora chiuso)
- **Confidence**: Alta

### T6-102 — RISOLTO E SUPERATO: modello credenziali di test sostituito da derivazione per-email (era T6-001)
- **Severità**: Info (era Medium)
- **Tipo**: strength (era risk)
- **Evidenza**: `apps/api/test/helpers/personas.ts:1-56` (Z-262, 2026-07-26; F-001 audit 2026-07-03) — `passwordFor(email)` deriva la password da `.secrets/dev-access-master.key` per utenti impersonabili, con `deriveCollaudoPassword` separata per identità `*@collaudo.invalid` (#169 F2, #258); throw esplicito se si tenta di impersonare una persona fisica reale. Nessuna variabile d'ambiente condivisa, nessuna costante committata. `apps/agent-gateway/scripts/live-{read,skills,write,tenant-materialization}-acceptance.ts` leggono solo da env, senza fallback letterale.
- **Impatto**: Elimina sia il rischio di riuso della credential in un tenant reale, sia la possibilità che i test impersonino una persona fisica per errore (fail-closed by design).
- **GA-blocker**: N/A
- **Confidence**: Alta

### T6-001 (rinumerato, ex T6-004) — Nessun test adversariale sistematico, gap invariato
- **Severità**: Low
- **Tipo**: functional-debt
- **Evidenza**: `ls apps/api/test/*.test.ts | wc -l` = 292; `grep -rlE "injection|xss|csrf.attack|brute.force|fuzz|pentest|malicious" apps/api/test/` = 3 file (proporzione 1.0%, era 2.7% a giugno con 148 file totali e 4 file positivi). Nessun test verifica esplicitamente: metacaratteri SQL nei filtri, header manipulation per bypassare il rate-limit, JWT `alg:none`/tampered, CSRF assente su POST → 403.
- **Impatto**: Il codice è corretto by-construction (SQL parametrico, Zod validation, CSRF opt-in enforced), ma l'assenza di test negativi espliciti è un gap di regression coverage: un refactor futuro potrebbe silenziosamente introdurre una regressione senza che nessun test la catturi.
- **GA-blocker**: No
- **Remediation**: `test/security.integration.test.ts` con ≥10 casi negativi (metacaratteri SQL, XFF forged con TRUST_PROXY impostato, JWT tampered, CSRF assente). Effort: S.
- **Best-practice ref**: OWASP Testing Guide WSTG-INPV; ASVS V5.3, V11.2
- **Confidence**: Alta

### T6-002 (rinumerato, ex T6-003) — `.env.example` TRUST_PROXY default "false": rischio residuo mitigato da documentazione, non chiuso
- **Severità**: Low (era Medium)
- **Tipo**: antipattern
- **Evidenza**: `.env.example:28-36` — default `TRUST_PROXY=false`, ma ora preceduto da 8 righe di commento che spiegano esplicitamente la forma PROD (`<ip|cidr>[,…]`, es. `127.0.0.1,::1`) e il footgun del hop-count rifiutato al boot. Il VM prod ha l'override corretto (non verificato in questo audit read-only sul repo — cross-ref D-28 di giugno).
- **Impatto**: Un nuovo deploy dietro reverse-proxy che copia `.env.example` alla lettera ottiene ancora un rate-limit non funzionale (bucket unico), ma la documentazione inline riduce fortemente la probabilità che accada per disattenzione rispetto a giugno.
- **GA-blocker**: No
- **Remediation**: Invertire il default a un valore che fallisce rumorosamente se non configurato esplicitamente, oppure lasciare com'è dato il commento ora esaustivo. Effort: S (5 min).
- **Best-practice ref**: OWASP A05:2021; ASVS V14.2
- **Confidence**: Alta

### T6-003 (rinumerato, ex T6-005) — HSTS senza `includeSubDomains`, invariato
- **Severità**: Low
- **Tipo**: antipattern
- **Evidenza**: `deploy/nginx/www.heuresys.com.conf:37,39` — commento invariato "NO includeSubDomains (evo.heuresys.com may be HTTP-only)".
- **Impatto**: SSL-strip possibile su sottodomini con sessioni condivise; non impatta `www.heuresys.com`. Nessun cambiamento di rischio da giugno.
- **GA-blocker**: No
- **Remediation**: Aggiungere `includeSubDomains` dopo dismissione/HTTPS di `evo.heuresys.com`. Effort: S.
- **Best-practice ref**: ASVS V9.2.2
- **Confidence**: Alta

### T6-004 (rinumerato, ex T6-007) — Rate-limit store in-process, non condiviso multi-replica
- **Severità**: Low
- **Tipo**: risk (architetturale, accettato)
- **Evidenza**: `apps/api/src/modules/auth/email-rate-limit.ts:25` — commento esplicito "replace with Redis", interfaccia `EmailRateLimiter` dichiarata stabile per lo swap; invariato da giugno, singolo processo `node dist/server.js` via systemd.
- **Impatto**: Nessuno oggi (single-process). Diventerebbe rilevante solo a scale-out multi-replica.
- **GA-blocker**: No (interfaccia Redis-swappable già prevista)
- **Remediation**: Migrare a Redis store prima del primo scale-out. Effort: M.
- **Confidence**: Alta

### T6-005 (nuovo) — 1 vulnerabilità High in devDependency di lint (non runtime)
- **Severità**: Low (impatto pratico), formalmente High per lo scanner
- **Tipo**: tech-debt / supply-chain
- **Evidenza**: `pnpm audit --audit-level=high` → `brace-expansion@<5.0.9` (DoS via array intermedi non limitati, bypassa la mitigazione di CVE-2026-14257), raggiunto da `eslint-config-next@16.3.3 → eslint-import-resolver-typescript → eslint-plugin-import → @typescript-eslint/parser → minimatch@10.2.5` (19 percorsi totali, tutti sotto `devDependencies` di lint/ESLint). GHSA-rgw5-rvv9-x895.
- **Impatto**: Nessuna esposizione runtime: `brace-expansion` non è raggiungibile dal server Fastify in produzione, solo dalla toolchain di lint in CI/dev. Il rischio reale è un DoS della pipeline CI stessa se un input malevolo raggiungesse `minimatch` durante il lint (scenario remoto).
- **GA-blocker**: No
- **Remediation**: `pnpm update` sulla catena eslint quando disponibile un bump che risolve minimatch@≥10.2.6 con brace-expansion patchata, o pin diretto via `pnpm.overrides`. Effort: S.
- **Best-practice ref**: CWE-1333; supply-chain hygiene
- **Confidence**: Alta

### T6-006 (nuovo, asset) — `enzo-guard`: guardrail di sicurezza a livello di motore, indipendente dalla disciplina del modello
- **Severità**: Info (asset)
- **Tipo**: strength
- **Evidenza**: `.claude/enzo-guard.json` — dichiara `protectedPaths` (`.secrets/`, `docs/source_bundle/brownfield/extracted/`, `docs/brownfield/_inspection_artifacts/`), un riconoscimento del DB vivo per nome/porta (`heuresys_advanced`, porta 5433) con `resetCommands` gated e un redirect obbligato da `pnpm db:migrate` verso il flusso corretto (`pnpm db:migrate:vm`, con prova preventiva sul gemello). Enforcement dichiarato "dal motore", non dalla sola istruzione testuale — quindi resiste anche a un prompt-injection o a un errore del modello, entro il perimetro CLI (non copre Cowork, come dichiarato nel CLAUDE.md).
- **Impatto**: Riduce il rischio di un comando distruttivo (reset DB, migrazione fuori sequenza, scrittura su path protetti) eseguito per errore o per un prompt malevolo durante una sessione agentica — un vettore di rischio specifico di un progetto sviluppato con un agente AI che ha accesso diretto a shell e DB di produzione. Non esisteva al momento dell'audit di giugno.
- **GA-blocker**: N/A
- **Confidence**: Alta (verificato il file di configurazione; non è stato testato un bypass attivo in questo audit read-only)

### T6-007 (nuovo, asset) — Modello di mandato RBAC formalizzato (R-1, `mandati.ts`) per gli invarianti I16-I22
- **Severità**: Info (asset)
- **Tipo**: strength
- **Evidenza**: `git log --oneline --since=2026-06-17 -- apps/api/src/modules/auth/` include `5da8bde5 feat(K): R-1 - mandati.ts, filtro cache RBAC, grantRole/revokeRole al mandato` e `8eeb7ab2 chore(K): R-1 passo 34 - auth/service.ts al predicato di mandato`; CLAUDE.md attuale codifica esplicitamente I16-I22 (perimetro gerarchico × modalità funzionale, eccezioni ADR-0036 §5) — un modello di autorizzazione più articolato e più esplicitamente documentato di quanto risultasse a giugno.
- **Impatto**: Un modello di autorizzazione centralizzato su un predicato (invece che sparso per modulo) riduce il rischio di drift fra moduli e rende l'audit trail delle decisioni di accesso più coerente.
- **GA-blocker**: N/A
- **Confidence**: Media (verificata l'esistenza del modulo e i commit; non ri-eseguita una batteria di test RBAC end-to-end in questo audit)

---

## Asset da NON regredire (invariati da giugno, confermati)

- SQL parametrico 100% — mai interpolazione user-value diretta
- CSRF double-submit su ogni write-route post-auth (289 occorrenze, cresciute con i nuovi moduli)
- Log redaction runtime-proven (`auth.integration.test.ts:652-654`)
- Refresh token single-use + family revoke + replay detection
- `parseTrustProxy()` non-coercitivo, ora con guardia aggiuntiva sulla forma hop-count
- **Nuovo**: derivazione password per-email nei test — non tornare a una costante condivisa

---

## Score del pilastro

Score: 85 | Confidence: Alta

Motivazione: i due finding più seri di giugno (T6-001 credential hygiene, T6-002 GA-blocker cross-tenant su revoke-user) sono entrambi risolti e il secondo è stato superato con un'architettura di derivazione password strutturalmente più forte del semplice fix proposto. Il core auth (Argon2id/RS256/refresh-rotation+replay/CSRF/TOTP AES-GCM/log-redaction) resta confermato file:line su HEAD attuale senza regressioni. Sono comparsi due controlli nuovi che aumentano la maturità complessiva: `enzo-guard` (guardrail a livello di motore per un progetto operato da un agente AI con accesso a shell e DB di produzione — un rischio specifico di questo modello operativo, ora mitigato strutturalmente) e il modello di mandato RBAC formalizzato. I punti di detrazione residui: assenza di test adversariali sistematici (invariato, -4), `.env.example` con default TRUST_PROXY fuorviante seppur ben documentato (-2), HSTS senza includeSubDomains (-2), rate-limit store in-process (-2), 1 vulnerabilità High in una devDependency di lint senza esposizione runtime (-3), altri hardening minori (-2). Nessun finding Critical o High con impatto runtime reale in questa rivalidazione.

---

*Audit read-only — nessuna modifica a codice/schema/CI/deploy, zero scritture DB, nessun segreto vero riportato in chiaro. Tunnel SSH :5433 non necessario per questo pilastro (nessuna query DB eseguita). Output: solo questo file WS-T6.md.*
