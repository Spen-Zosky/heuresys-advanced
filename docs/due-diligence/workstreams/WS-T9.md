# WS-T9 — Verified functional correctness (live E2E)
Agente: Engineering (+data) | Ambiente testato: PRODUZIONE reale (sola lettura — nessun non-prod esiste, ADR-0026) | Data: 2026-09-28 | HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

Rivalidazione della DD 2026-06-17 (score 79/100, Forte). Quella sessione aveva verificato "live" tramite la suite di integration test contro il DB reale via tunnel SSH (75/75 test) più due `curl` isolati contro `https://www.heuresys.com` (health-check e login error-path). Questo ciclo adotta un metodo diverso e più stringente, richiesto esplicitamente perché il progetto non ha un ambiente non-prod (ADR-0026, I15): **login reale con sessione autenticata HTTPS contro la produzione**, esercizio di rotte `/v1/*` in sola lettura, e verifica di un diniego RBAC reale — nessuna scrittura, nessun mock, nessun DB tramite tunnel.

## Copertura

Endpoint esercitati: 9/609 (misurato oggi: `grep -rho "requirePermission(" apps/api/src/modules/*/routes.ts | wc -l` = 609 invocazioni su 111 moduli; il numero "424" della DD di giugno era la cifra dichiarata in `01_DISCOVERY.md`, non ri-misurata da allora — il progetto è cresciuto). · Flussi auth/ruolo: 2 (login riuscito con credenziali derivate + login fallito con credenziali sbagliate; permesso negato su rotta riservata PLATFORM_ADMIN)

## Tentativo di login con una PERSONA reale (documentato, fallito per un motivo legittimo)

Il primo tentativo, come indicato dal mandato, è stato con `federica.marchetti@rtl-bank.org` (TENANT_ADMIN, RTL Bank), password derivata via `apps/api/scripts/derive-access.mjs` (HMAC-SHA256 sulla chiave madre `.secrets/dev-access-master.key`, stesso meccanismo di `apps/agent-gateway/scripts/live-perimetro.ts` e di `apps/api/scripts/verify-derived-login.mjs`).

- `POST /v1/auth/login` step 1 → HTTP 200, `status=mfa_required` (non previsto dalla DD di giugno, che assumeva `MFA_ENFORCEMENT_ENABLED=false` come unica condizione; da allora federica ha un **fattore TOTP realmente enrollato**, e un utente con fattore attivo lo deve sempre usare, indipendentemente dalla policy di enforcement per ruolo).
- Step 2 (secondo fattore), tentato con `deriveTotpSecret()` dallo stesso modulo → HTTP 401. **Esito atteso e corretto**: dal 2026-09-08 (#169 F3c) il progetto ha smesso di creare fattori TOTP con segreto derivabile dalla chiave madre proprio perché "un segreto derivato dalla stessa chiave della password non è un secondo fattore, è lo stesso fattore contato due volte" — i fattori nuovi usano `segretoTotpCasuale()` (byte casuali, non ricostruibili da nessuna chiave). Non è quindi possibile completare login MFA di una persona reale senza il suo dispositivo fisico, per costruzione.

**Questo NON è un fallimento della prova**: è la prova che il secondo fattore reale di una persona reale non è aggirabile nemmeno da chi ha la chiave madre — esattamente la proprietà che un secondo fattore deve avere. Si documenta come richiesto dal mandato invece di forzare un PASS.

## Login reale usato per l'esercizio: `governo@collaudo.invalid`

Per continuare la verifica live senza un dispositivo MFA fisico e senza scritture di prova su una persona reale, si è usata l'identità **SERVICE con mandato reale TENANT_ADMIN su RTL_BANK** che il progetto stesso prevede per questo scopo (#169 F2, dottrina in `apps/api/scripts/collaudo-access.mjs`): `governo@collaudo.invalid`. Non è una persona fisica, ma è un **account di produzione reale**, con un **mandato vero** (non un ruolo-ombra: ADR-0036), esente da MFA per costruzione (`mfaExempt` implicito, a differenza di `platform-test-admin@collaudo.invalid` che invece lo porta). Password derivata da una chiave separata (`deriveCollaudoPassword`, `.secrets/collaudo-access.key`), diversa dalla chiave madre delle persone — separazione verificata a livello di codice (`collaudo-access.mjs` rifiuta se le due chiavi coincidono).

Script di prova: `C:\Users\enzospenuso\claude_service_workspace\[Scripts]\dd-t9-live-check.mjs`, eseguito da Windows contro `https://www.heuresys.com/api` (nessun tunnel, nessun DB diretto). Esercizio diretto: 8 rotte `GET /v1/*` distinte + 1 tentativo di login con credenziali errate + 1 tentativo su rotta riservata.

## Matrice di verifica

| Stack | Item | Testato? | Esito | Evidenza | Note |
|---|---|---|---|---|---|
| **Auth** | Login persona reale (federica.marchetti) | Sì | **FALLITO (atteso)** | `POST /v1/auth/login` step1 HTTP 200 `mfa_required`; step2 (TOTP derivato) HTTP 401 | Fattore MFA reale non derivabile per costruzione (#169 F3c) — comportamento corretto, documentato come richiesto dal mandato |
| **Auth** | Login credenziali ERRATE | Sì | PASS | `POST /v1/auth/login` (password sbagliata) → HTTP 401 `{"error":{"code":"LOGIN_INVALID","message":"Invalid email or password"}}` | Nessun info-leak (nessun dettaglio su quale campo è sbagliato) |
| **Auth** | Login reale `governo@collaudo.invalid` (TENANT_ADMIN mandato RTL_BANK) | Sì | PASS | `POST /v1/auth/login` → HTTP 200 in 405-1117ms, `status=success`, 3 cookie di sessione ricevuti | Nessun secondo fattore richiesto (identità esente per costruzione) |
| **API** | `GET /v1/users?limit=5` | Sì | PASS | HTTP 200 in 65ms, forma `{items,total}`, `total=167` | Dato reale RTL Bank, non un valore fisso |
| **API** | `GET /v1/positions?limit=5` | Sì | PASS | HTTP 200 in 68ms, `{items,total}`, `total=312` | |
| **API** | `GET /v1/organization-units?limit=5` | Sì | PASS | HTTP 200 in 85ms, `{items,total}`, `total=42` | |
| **API** | `GET /v1/analytics/workforce` | Sì | PASS | HTTP 200 in 80ms, forma `{scope,totalHeadcount,byOrgUnit,byJobRole,generatedAt}` | Aggregazione reale, non un endpoint statico |
| **API** | `GET /v1/tenant-blueprints` | Sì | PASS | HTTP 200 in 50ms, `{items,total}`, `total=1` | Fascicolo di configurazione RTL Bank |
| **API** | `GET /v1/me/profile` | Sì | PASS | HTTP 200 in 49ms, forma `{userId,tenantId,email,displayName,locale,timezone}` | Area personale dell'identità autenticata |
| **API** | `GET /v1/blueprint-processes?limit=5` | Sì | PASS | HTTP 200 in 70ms, `{items,total}`, `total=23` | |
| **API** | `GET /v1/mfa-policy` | Sì | PASS | HTTP 200 in 93ms, `{items,total}`, `total=1` | TENANT_ADMIN ha visibilità sulla policy MFA del proprio tenant |
| **RBAC** | `GET /v1/observability/system-health` (PLATFORM_ADMIN-only, `observability:read`) come TENANT_ADMIN | Sì | PASS | HTTP 403 `{"error":{"code":"FORBIDDEN","message":"Missing permission: observability:read"}}` | Diniego RBAC reale e corretto: `FORBIDDEN` è il codice per "il ruolo non ha quel permesso" (`.claude/rules/api-module-pattern.md`), esattamente il caso qui |
| **Infra** | PROD HTTPS raggiungibile | Sì | PASS | `curl` diretto: `/api/healthz` 200 (2.2s), `/api/readyz` 200 (2.1s), `/` 200 | Tempi più alti del giugno scorso (103ms) — prima richiesta fredda, non ri-misurato a caldo |
| **Observability** | `/metrics` Prometheus | Sì (scoperta collaterale) | **FINDING** | `curl https://www.heuresys.com/api/metrics` → HTTP 200, corpo Prometheus reale | Riportato come F-T8-09 in WS-T8 (esposizione pubblica non voluta); non è un difetto funzionale di T9 ma un effetto collaterale della stessa sessione di sonda live |

## Finding derivati

**T9-001 — Login MFA di una persona reale non è forzabile nemmeno con la chiave madre di derivazione (asset, non difetto)**
- Severità: INFO
- Tipo: Security (positivo)
- Evidenza: `federica.marchetti@rtl-bank.org` ha un fattore TOTP enrollato con segreto casuale (`segretoTotpCasuale()`, non derivabile); il tentativo di completare il login con `deriveTotpSecret()` fallisce con HTTP 401.
- Impatto: Positivo — dimostra che il secondo fattore reale non è bypassabile da chi conosce solo la chiave madre delle password derivate. Impatta la metodologia di questo ciclo di DD (non si può impersonare in sola lettura una persona con MFA reale senza il suo dispositivo), non la sicurezza del prodotto.
- GA-blocker: NO
- Remediation: nessuna — è il comportamento corretto. Per future DD live su persone con MFA reale servirebbe un canale separato di consenso esplicito della persona (fuori scope di questo ciclo).
- Confidence: Alta

**T9-002 — Copertura del campione: 9/609 rotte protette esercitate direttamente**
- Severità: INFO
- Tipo: Test coverage (limite dell'audit, non del prodotto)
- Evidenza: 609 invocazioni di `requirePermission` su 111 moduli (misurato oggi); 9 rotte toccate da questa sessione con richieste HTTP reali contro PROD.
- Impatto: Il campione è piccolo in termini assoluti ma copre 5 aree funzionali diverse (users, positions, org-units, analytics, tenant-blueprints, me, blueprint-processes, mfa-policy) più un diniego RBAC — sufficiente a dimostrare che l'architettura di autenticazione/autorizzazione end-to-end funziona dal vivo, non a certificare ogni endpoint. La CI (`test-integration.yml`, isolata su `heuresys_ci`, off-prod) copre la suite completa a ogni push su `main`.
- GA-blocker: NO
- Remediation: nessuna azione richiesta per questo ciclo; un campione più ampio richiederebbe più tempo di sessione dedicato a sola-lettura su PROD.
- Confidence: Alta

**T9-003 — Diniego RBAC reale verificato con il codice corretto (`FORBIDDEN`, non `PERMISSION_DENIED`)**
- Severità: INFO
- Tipo: Correttezza funzionale (asset)
- Evidenza: `GET /v1/observability/system-health` con un TENANT_ADMIN privo del permesso `observability:read` risponde HTTP 403 `{"error":{"code":"FORBIDDEN","message":"Missing permission: observability:read"}}` — esattamente il contratto documentato in `.claude/rules/api-module-pattern.md` (diniego di middleware = `FORBIDDEN`; diniego di scope a livello di service = `PERMISSION_DENIED`).
- Impatto: Positivo — il modello di autorizzazione a due livelli funziona come documentato, verificato dal vivo su PROD e non solo nei test di integrazione.
- GA-blocker: NO
- Remediation: nessuna.
- Confidence: Alta

**T9-004 — `/metrics` pubblicamente raggiungibile (scoperta durante la sonda live, riportata in dettaglio in WS-T8 come F-T8-09)**
- Severità: MEDIUM (severità e remediation nel dettaglio in WS-T8, non duplicate qui)
- Tipo: Security / Observability
- Evidenza: `curl https://www.heuresys.com/api/metrics` → HTTP 200 con corpo Prometheus reale, durante la stessa sessione di verifica live T9.
- Impatto: Fuori dal perimetro funzionale di T9 (non è un difetto di correttezza applicativa) ma pertinente perché scoperto nello stesso esercizio in sola lettura contro PROD richiesto da questo pilastro.
- GA-blocker: CONDIZIONALE (vedi WS-T8)
- Remediation: vedi WS-T8, F-T8-09.
- Confidence: Alta

## Score del pilastro T9

Score: 82 | Confidence: Alta | Motivazione ancorata alla copertura e agli esiti.

**Perché 82 e non di più**: il campione diretto resta piccolo in assoluto (9 rotte su 609 misurate), e l'identità usata per l'esercizio principale (`governo@collaudo.invalid`) non è una persona fisica — è un mandato reale e provisionato in produzione, ma il mandato del ciclo chiedeva esplicitamente prima una persona vera, e quel tentativo è fallito (per un motivo corretto, non per un difetto). Non tutte le combinazioni di ruolo sono state esercitate (solo TENANT_ADMIN in lettura + un diniego PLATFORM_ADMIN-only).

**Perché 82 e non meno**: a differenza di giugno (dove "live" significava principalmente la suite di integration test via tunnel SSH più due `curl` isolati), qui l'intera catena — login HTTPS reale con cookie di sessione, 8 richieste `/v1/*` autenticate con payload e tempi reali, e un diniego RBAC autentico con il codice-errore corretto — è stata eseguita end-to-end contro la produzione vera, in sola lettura, senza mock e senza tunnel al DB. Il metodo è più stringente di quello di giugno (una sessione autenticata reale contro l'endpoint pubblico, non un `app.inject()` in-process) ed è quello che l'architettura a singolo ambiente (ADR-0026) rende legittimo. La scoperta collaterale di F-T8-09 rafforza, non indebolisce, la credibilità della verifica: è un difetto reale trovato perché la sonda era vera, non uno che un mock o una suite in-process avrebbe potuto rivelare.
