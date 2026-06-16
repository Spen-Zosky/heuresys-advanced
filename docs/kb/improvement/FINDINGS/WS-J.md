# FINDINGS / WS-J — Config & env (S-100X-A9)

> Audit forense **read-only** del workstream Config & env (multi-host). Metodo: ispezione repo (`apps/api/src/config/env.ts` Zod schema = SoT, `apps/api/src/config/trust-proxy.ts`, `.env.example` + `apps/web/.env.example`, `scripts/env-key-merge.sh` + i 8 script bootstrap/deploy `vm-bootstrap.sh`/`provision-linux-pc.sh`/`vm-deploy.sh`/`align-clones.sh`/`sync-gitignored-to-vm.sh`/`dev-bootstrap.sh`/`setup-local-pg.sh`/`clone-vm-db.sh`, `apps/api/src/app.ts` `LOG_REDACT_PATHS`) + `git ls-files`/`git grep` per la secret-hygiene + sub-agent read-only per la topologia per-host. Evidenza: `path:linea` reali. **Zero modifiche a codice/CI/deploy/.env, zero scritture, NESSUN valore segreto stampato** (solo nomi-chiave). Data: 2026-06-16 (S-100X-A9). Classificazione: `AUDIT_PROTOCOL.md`.
>
> **Caveat di scope (vincolante per i §index)**: i `.env` reali (PROD VM, linux-pc, dev PC/Mac) sono **gitignored e non leggibili da qui** — l'audit verifica il *contratto* (`env.ts`), l'*esempio* (`.env.example`), e gli *script* che scrivono i `.env` per-host, NON i valori runtime. Dove un valore runtime è già stato verificato live in una sessione precedente (es. QW-SEC1 S993: VM `.env` ha `TRUST_PROXY=1` + `COOKIE_SECURE=true`) il finding lo riconcilia e si concentra sul **management gap** (chi/cosa *garantisce* quel valore tra ri-creazioni del `.env`), che è l'oggetto di WS-J.

## Headline (cosa cambia rispetto a WS-G F-29, WS-H F-WS-H-1 e al seed)

1. **🟢 ASSET riconosciuto — il contratto env è ALLINEATO post-S993 (QW-3/QW-G3 chiusi)**: la parità `env.ts` ↔ `.env.example` è reale. I 7 var prima mancanti sono ora presenti (commented-default): `MFA_ENROLL_CONFIRM` (`.env.example:170`), `WEBAUTHN_RP_ID/RP_NAME/ORIGINS` (`:178-180`), `SMS_PROVIDER/SMS_FROM` (`:187-188`), `MEDIA_STORAGE_DIR` (`:194`); `COOKIE_SECURE`/`MATCHING_FREETEXT_ENABLED`/`API_DOCS_ENABLED`/`TRUST_PROXY` anch'essi documentati (`:80/:112/:120/:20`). **WS-G F-29 / R09 è chiuso** — re-verificato 1:1, nessun residuo di var contract mancante. (`MFA_ENCRYPTION_KEY`, `VOYAGE_API_KEY`, `SMTP_*` già c'erano.)
2. **🟠 MEDIUM J-1 — footgun `z.coerce.boolean` ANCORA VIVO su 2 feature-flag** (`MATCHING_FREETEXT_ENABLED` env.ts:114, `API_DOCS_ENABLED` env.ts:185). Il progetto ha **correttamente** convertito `COOKIE_SECURE`/`TRUST_PROXY`/`MFA_ENFORCEMENT_ENABLED`/`SMTP_SECURE` a enum-transform esplicito per evitare `Boolean("false")===true`, ma queste 2 restano `z.coerce.boolean()`. Entrambe sono **default-OFF, gate-on-true** (`if (env.MATCHING_FREETEXT_ENABLED)` / `if (env.API_DOCS_ENABLED)`) → un operatore che scrive il letterale `MATCHING_FREETEXT_ENABLED=false` o `API_DOCS_ENABLED=false` nel `.env` (esattamente ciò che `.env.example:112,120` mostra come riga commentata da scommentare per *disabilitare*) **ATTIVA** invece il flag. Per `API_DOCS_ENABLED` significa esporre l'intera superficie `/v1/*` (~407 endpoint) su un origin che il commento dichiara "must not be public" — fail-open di sicurezza.
3. **🟠 MEDIUM J-2 — `TRUST_PROXY=1` su PROD è config NON GESTITA (drift waiting to happen)**: il valore runtime è corretto (QW-SEC1 S993 lo ha verificato live + WS-H F-WS-H-1 chiuso S988), ma **nessuno** degli 8 script bootstrap/deploy setta o ri-asserisce `TRUST_PROXY` (grep su tutti gli `*.sh` = 0 hit fuori da `.env.example`/`.env`/code/docs). `vm-bootstrap.sh:99-100` normalizza solo `POSTGRES_PORT`+`PORT`; `provision-linux-pc.sh:46` scrive 8 chiavi topologia ma **omette `TRUST_PROXY`** anche sul PROD-twin; `vm-deploy.sh` non tocca mai `.env`. Default = `false` (env.ts:61). Se un `.env` PROD venisse ri-creato out-of-band senza quella riga, niente lo correggerebbe — e `env-key-merge.sh` potrebbe perfino *propagare* il `false` del PC (`.env:12`) a un remoto che non ha la chiave. → la robustezza del rate-limit per-IP D-28 dipende da una riga manuale non sotto governance.
4. **🟠 MEDIUM J-3 — denylist `env-key-merge.sh` incompleta**: protegge **solo** `MFA_ENFORCEMENT_ENABLED` (`env-key-merge.sh:33`). Gli altri flag dev-only/security-sensitive che, se assenti sul remoto, verrebbero propagati additivamente dal `.env` del PC NON sono in denylist: `MATCHING_FREETEXT_ENABLED`, `API_DOCS_ENABLED`, `COOKIE_SECURE`, `TRUST_PROXY`. È additive-only (mai overwrite → un `true` PROD esistente è salvo), ma un PROD `.env` *privo* della chiave riceverebbe il valore locale. Couples J-1 (il footgun rende la propagazione di un `=false` ancora più insidiosa) + J-2.
5. **Asset forti confermati**: **secret-hygiene PULITA** (`git ls-files | grep -iE '.pem$|.key$|.secrets/'` = 0 tracked; 0 blocchi PEM reali in file tracciati — i 2 hit `BEGIN PRIVATE KEY` sono la stringa letterale di una recipe pre-commit-grep in 2 handover doc, non key-material; `.gitignore:36-43` copre `.env*`/`*.pem`/`*.key`/`.secrets/`); **`POSTGRES_DB` canonico ovunque** (0 occorrenze di `POSTGRES_DATABASE` negli 8 script — il dual-set è confinato e documentato al SOLO runner CI, `self-hosted-runners-setup.md:97-98,118-119`); **align-clones preserva la topologia per-machine** (`sync-gitignored-to-vm.sh:29` esclude `^.env$`, `env-key-merge.sh:40` additive-only); **`LOG_REDACT_PATHS`** redige cookie/auth/password/hash/secret/OTP a ogni profondità (`app.ts:149-169`).

---

## Gruppo A — Env contract completeness & footgun

### F-WS-J-1 — ASSET: parità `env.ts` ↔ `.env.example` ALLINEATA (QW-3/QW-G3 chiusi, re-verificata 1:1)
- Severità: INFO | Flag: ASSET
- Evidenza: ogni chiave dichiarata in `EnvSchema` (`env.ts:50-186`) ha ora una entry (commented-default dove opzionale) in `.env.example`. Mappa verificata: `NODE_ENV/HOST/PORT/LOG_LEVEL` (`:11-13`), `TRUST_PROXY` (`:20`), `POSTGRES_*` (`:27-33`), `COOKIE_SECRET/ADMIN_ORIGIN` (`:74-75`), `COOKIE_SECURE` (`:80`), `MFA_ENCRYPTION_KEY` (`:87`), `MFA_ENFORCEMENT_ENABLED` (`:97`), `VOYAGE_API_KEY` (`:105`), `MATCHING_FREETEXT_ENABLED` (`:112`), `API_DOCS_ENABLED` (`:120`), `SMTP_*`/`MAIL_FROM` (`:158-163`), `MFA_ENROLL_CONFIRM` (`:170`), `WEBAUTHN_RP_ID/RP_NAME/ORIGINS` (`:178-180`), `SMS_PROVIDER/SMS_FROM` (`:187-188`), `MEDIA_STORAGE_DIR` (`:194`). I 7 var di WS-G F-29 risultano aggiunti (TODO_100X:40,48 QW-3/QW-G3 **DONE** S993).
- Proposta: **NESSUNA azione** sul contract. NB evolutivo (decide Enzo): QW-3 suggeriva un *generatore* `.env.example` dal Zod `env.ts` per rendere la parità self-checking → resta un'opzione DX (oggi la parità è manuale e può ri-divergere al prossimo var aggiunto).

### F-WS-J-2 — `z.coerce.boolean` footgun residuo su `MATCHING_FREETEXT_ENABLED` + `API_DOCS_ENABLED` (default-OFF, gate-on-true → fail-OPEN)
- Severità: **MEDIUM** | Flag: **QUICK-WIN**
- Evidenza: `env.ts:114 MATCHING_FREETEXT_ENABLED: z.coerce.boolean().default(false)` e `env.ts:185 API_DOCS_ENABLED: z.coerce.boolean().default(false)`. `z.coerce.boolean()` applica `Boolean(x)` → **qualunque stringa non-vuota, incluso `"false"`, diventa `true`** (lo stesso footgun che `env.ts:56-61,81,120,147` documenta ESPLICITAMENTE come la ragione per cui `COOKIE_SECURE`/`TRUST_PROXY`/`SMTP_SECURE`/`MFA_ENFORCEMENT_ENABLED` usano enum-transform). Consumo gate-on-true confermato: `semantic-matching/service.ts:149 if (!env.MATCHING_FREETEXT_ENABLED) throw FreeTextDisabledError`; `app.ts:192 if (env.API_DOCS_ENABLED) { …register swagger… }`. **Il footgun è raggiungibile dall'UX di `.env.example`**: `:112 # MATCHING_FREETEXT_ENABLED=false` e `:120 # API_DOCS_ENABLED=false` invitano l'operatore a scommentare una riga `=false` per *tenere il flag off* — ma quella riga letterale `false` lo **accende**.
- Impatto: **sicurezza/robustezza** — `API_DOCS_ENABLED=false` (scommentato) pubblica Swagger UI `/docs` + `/openapi.json` (~407 endpoint) sull'origin prod, contro il commento `:117-118` "keep OFF on a public prod origin"; `MATCHING_FREETEXT_ENABLED=false` attiverebbe il primo dipendency query-time esterno (Voyage) sul serving path. Classe fail-open: l'unico modo *sicuro* per spegnerli è **non avere la riga** (assenza → default false), comportamento contro-intuitivo.
- Baseline: 2 flag `z.coerce.boolean` su 6 boolean-like totali (gli altri 4 già blindati enum-transform).
- Proposta: **QUICK-WIN** (additivo, zero-rischio, pattern già nel file): convertire le 2 a `z.enum(["true","false"]).default("false").transform(v => v === "true")` (identico a `MFA_ENFORCEMENT_ENABLED` env.ts:151-154). **Gate**: un test che setta `API_DOCS_ENABLED="false"` → `env.API_DOCS_ENABLED === false` (oggi sarebbe `true`); `pnpm test` API verde; `pnpm typecheck` verde. Mecccanico, regression-risk LOW (test coverage esistente sul gate Swagger/free-text).

### F-WS-J-3 — ASSET: i 4 boolean security-critical usano enum-transform esplicito (footgun già neutralizzato dove conta di più)
- Severità: INFO | Flag: ASSET
- Evidenza: `COOKIE_SECURE` (`env.ts:82-85`), `SMTP_SECURE` (`:123-126`), `MFA_ENFORCEMENT_ENABLED` (`:151-154`), `TRUST_PROXY` (`:61` via `parseTrustProxy`, `trust-proxy.ts:20-27` gestisce `"false"`/`""`→false + hop-count + CIDR) — tutti con parse esplicito e commento che cita il footgun. `parseTrustProxy` è la generalizzazione corretta (boolean|number|string anti-spoof XFF).
- Proposta: **NESSUNA azione** — è il pattern di riferimento; F-WS-J-2 va portato allo stesso livello.

---

## Gruppo B — Per-machine topology safety (env-key-merge + multi-host)

### F-WS-J-4 — denylist `env-key-merge.sh` protegge SOLO `MFA_ENFORCEMENT_ENABLED`; altri 4 flag dev-only/security possono propagare additivamente
- Severità: **MEDIUM** | Flag: **QUICK-WIN**
- Evidenza: `env-key-merge.sh:33 local denylist=" MFA_ENFORCEMENT_ENABLED "` (`:39` skip). Il merge è additive-only (`:40 if ! grep -q "^${key}=" "$target"`) → un `true` già presente sul PROD è salvo, ma una chiave **assente** sul remoto riceve il valore del `.env` locale. NON denylistati: `MATCHING_FREETEXT_ENABLED` (dev default false, env.ts:114), `API_DOCS_ENABLED` (dev-only docs, env.ts:185), `COOKIE_SECURE`, `TRUST_PROXY`. Vettore di propagazione: `align-clones.sh:128-129` chiama `env-key-merge.sh` per ogni host (mac/vm/linuxpc). NB l'esposizione di `COOKIE_SECURE`/`TRUST_PROXY` è reale perché **`vm-bootstrap.sh` NON le scrive** (`:99-100` setta solo `POSTGRES_PORT`+`PORT`) → sul VM canonico la loro presenza dipende interamente dal `.env` out-of-band; se mancasse, il merge appenderebbe il valore del PC (`.env:11-12` → `COOKIE_SECURE` assente/`TRUST_PROXY=false`).
- Impatto: **sicurezza/robustezza** — combinato con J-2 (footgun) un `MATCHING_FREETEXT_ENABLED=false` o `API_DOCS_ENABLED=false` propagato a un PROD privo della chiave **accenderebbe** il flag in produzione.
- Baseline: 1 chiave in denylist; ≥4 candidate mancanti.
- Proposta: **QUICK-WIN** (1 riga): estendere `denylist` a `" MFA_ENFORCEMENT_ENABLED MATCHING_FREETEXT_ENABLED API_DOCS_ENABLED COOKIE_SECURE TRUST_PROXY "`. **Gate**: il test D-19 esistente (`ENV_MERGE_LOCAL=1`, `run-shell-tests.sh`) esteso con un sorgente che contiene quelle chiavi → added-count non le include; merge su un target che già le ha = 0 overwrite. Regression-risk LOW (script ha già il test-harness). Couples J-2 (idealmente entrambi nello stesso fix). **Verify-first** raccomandato: confermare che nessuna di queste sia legittimamente attesa via merge (oggi sono tutte per-machine/manual → safe da denylistare).

### F-WS-J-5 — `TRUST_PROXY=1` su PROD non è scritto/ri-asserito da alcuno script (config drift waiting to happen) [riconcilia WS-H F-WS-H-1]
- Severità: **MEDIUM** | Flag: DOSSIER (couples WS-H D-28) / QUICK-WIN (assert in bootstrap)
- Evidenza: grep `TRUST_PROXY` su tutti gli `*.sh` → 0 hit fuori da `.env.example:20`/`.env:12`/`apps/api/src/config/*`/docs. Nessuno scrive la chiave: `vm-bootstrap.sh:99-100` (solo `POSTGRES_PORT`/`PORT`), `provision-linux-pc.sh:46` (8 chiavi topologia, `TRUST_PROXY` **omessa** anche sul twin), `vm-deploy.sh` (non tocca `.env`). Default = `false` (`env.ts:61`). Riconciliazione: il valore RUNTIME è corretto e già chiuso come finding di sicurezza — WS-H F-WS-H-1 = **D-28 RISOLTO S988**, QW-SEC1 = **DONE S993** (VM `.env` verificato live `TRUST_PROXY=1` + `COOKIE_SECURE=true`, TODO_100X:55). Il residuo WS-J è **gestionale**: nulla *garantisce* `=1` tra ri-creazioni del `.env`; couples J-4 (un merge potrebbe propagare il `false` del PC se la chiave sparisse).
- Impatto: robustezza (config-management) — non un bug live, ma un drift-vector sul controllo brute-force per-IP.
- Baseline: 0 script settano TRUST_PROXY; valore PROD = manuale-only.
- Proposta: **QUICK-WIN** = far ri-asserire a `vm-bootstrap.sh`/`provision-linux-pc.sh` `TRUST_PROXY=1` (o hop-count/CIDR esplicito) come fa per `PORT`/`POSTGRES_PORT` (set-or-replace), così il PROD topology è script-managed e idempotente. **Gate**: post-bootstrap `grep '^TRUST_PROXY=' .env` = `1` sui due PROD host; un test smoke che un XFF forgiato non evade il login-limiter. **DOSSIER** se invece si preferisce cambiare il default `env.ts` a `1` "quando dietro reverse-proxy" (decisione architetturale, couples WS-H). Decide Enzo tra le due.

### F-WS-J-6 — Provisioning asimmetrico VM vs linux-pc + `COOKIE_SECURE=false` esplicito sul "PROD twin"
- Severità: **LOW** | Flag: NOTE
- Evidenza: `provision-linux-pc.sh:46` scrive 8 chiavi (`POSTGRES_HOST=localhost`, `POSTGRES_PORT=5432`, `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8013`, `PUBLIC_HOST=<LAN>`, **`COOKIE_SECURE=false`**, `ADMIN_ORIGIN=http://<LAN>:3013`); `vm-bootstrap.sh:99-100` ne scrive **2** (`POSTGRES_PORT`, `PORT`). Due "PROD" box con disciplina di provisioning diversa. `COOKIE_SECURE=false` sul twin è **difendibile** (servito plain-HTTP sulla LAN, come la VM demo era `:80` documenta), ma è una divergenza PROD-vs-PROD reale vs la VM canonica `COOKIE_SECURE=true` (dietro nginx TLS, QW-SEC1). Inoltre `WEBAUTHN_*` non è settato da alcuno script → sul twin LAN eredita i default dev (`WEBAUTHN_RP_ID=localhost`, env.ts:176) = passkey inutilizzabili se il `.env` sorgente non porta valori LAN; e una redeploy `align-clones.sh:145` di linuxpc rilancia `vm-deploy.sh` con `PUBLIC_HOST` default = IP pubblico VM (`vm-deploy.sh:19`) → può bakeare il `NEXT_PUBLIC_API_BASE_URL` sbagliato nel bundle del twin (provision usava la LAN, `:62`).
- Impatto: robustezza/DX — il twin è ISOLATO da align-clones per dottrina (`reference_linux_pc_prod_twin`), quindi l'impatto reale è basso oggi, ma è un'incoerenza da registrare.
- Baseline: VM 2 chiavi scritte / twin 8 chiavi scritte; `COOKIE_SECURE` divergente; `WEBAUTHN_*`/`TRUST_PROXY` non gestiti su nessuno dei due.
- Proposta: **NOTE** — documentare la divergenza COOKIE_SECURE come scelta cosciente (twin plain-HTTP LAN) e, se mai linux-pc entrasse in align-clones (`reference_linux_pc_prod_twin` lo dà come futuro), allineare `vm-bootstrap.sh`/`provision-linux-pc.sh` allo stesso set di chiavi (incl. TRUST_PROXY da J-5 + WEBAUTHN_* LAN). Decide Enzo; bassa priorità mentre il twin resta isolato.

---

## Gruppo C — Runtime contexts (.env.example blocchi A/B/C)

### F-WS-J-7 — ASSET: i 4 runtime context sono documentati e coerenti col runtime attivo (Option B)
- Severità: INFO | Flag: ASSET
- Evidenza: `.env.example` blocca i 3 DB-runtime ADR-0010 — **Option B ACTIVE** (OCI VM via tunnel :5433, `:22-37` non commentato), **Option A FALLBACK** (localhost :5432, commentato `:39-51`), **Option C FUTURE** (OCI Managed, SSL=require, commentato `:53-64`). Il 4° "context" è il deploy PROD reale (VM nativo :5432) gestito dagli script bootstrap (Gruppo B), non un blocco esempio. La decisione attiva (RD-25 Option B) è marcata `:5`. `apps/web/.env.example` (separato) copre il proxy Next (`NEXT_PUBLIC_API_PROXY_BASE_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_DEFAULT_LOCALE`) → coerente, niente segreti.
- Proposta: **NESSUNA azione** — il template tri-blocco è chiaro e con i caveat giusti (Option C "Cost not verified", "SSL mandatory"). NB minore: il blocco Option B usa `POSTGRES_PORT=5433` (tunnel dev) — corretto per il PC dev ma non è il valore PROD (:5432, scritto da bootstrap); il commento `:5` lo chiarisce.

### F-WS-J-8 — ASSET: `apps/web` env è separato, pubblico-only, zero segreti (NEXT_PUBLIC_*)
- Severità: INFO | Flag: ASSET
- Evidenza: `apps/web/.env.example:1-12` → solo `NEXT_PUBLIC_*` (API proxy base URL, app name, default locale) + istruzione "Copy to `.env.local` (gitignored)". `.gitignore:37-38` copre `.env.local`/`.env.*.local`. Nessuna credenziale lato client (corretto: i `NEXT_PUBLIC_*` finiscono nel bundle browser).
- Proposta: **NESSUNA azione**.

---

## Gruppo D — Secret hygiene

### F-WS-J-9 — ASSET: zero segreti reali nel tracked tree; `.gitignore` copre `.env*`/PEM/key/.secrets
- Severità: INFO | Flag: ASSET
- Evidenza: `git ls-files | grep -iE '.pem$|.key$|.secrets/|id_rsa|id_ed25519|.p12$|.pfx$'` → **0** (NO_TRACKED_SECRET_FILES). I soli `.env*` tracciati sono 3 `.env.example` (root, `apps/web/`, un template bootstrap legacy). `git grep 'BEGIN .*PRIVATE KEY'` (escl. `*.example`/`docs`) → 2 hit, **entrambi falsi positivi**: la stringa letterale `BEGIN PRIVATE KEY` dentro una recipe pre-commit-grep in `cowork_code_exchange/_00_HANDOVER_CLI_2026-05-26_post_S937.md:398` e `sessioni/.../HANDOVER_CLI.md:398` (nessun base64 key-material, verificato). `.gitignore:36-43` = `.env`/`.env.local`/`.env.*.local`/`.env.production`/`*.pem`/`*.key`(con `!*.key.example`)/`.secrets/`. Le chiavi JWT sono lette da `.secrets/jwt_{private,public}.pem` (gitignored) via `env.ts:33-48,207-208`, mai inline nel repo.
- Proposta: **NESSUNA azione**. NB: la riga `!*.key.example` (`.gitignore:42`) è un allow-listing volutamente sicuro (consente di tracciare template `.key.example` senza esporre `.key` reali) — corretto.

### F-WS-J-10 — ASSET: `LOG_REDACT_PATHS` redige i secret nei log a ogni profondità (cookie/auth/password/hash/secret/OTP)
- Severità: INFO | Flag: ASSET
- Evidenza: `app.ts:149-169` redige `req.headers.cookie`/`authorization`, `req.body.{password,newPassword,confirmPassword,code,mfaCode,phoneNumber}`, `res.body.{token,refreshToken}`, e i wildcard `*.password`/`*.hash`/`*.secret`/`*.code`/`*.otp` (a qualsiasi profondità); cablato `:177 redact: { paths: [...LOG_REDACT_PATHS], censor: "[REDACTED]" }`. `env.ts` non logga mai valori (il warn `:194-203` su MFA_ENCRYPTION_KEY logga solo l'assenza, nessun valore). `env-key-merge.sh` cancella il `.env` temp dopo il merge (`:73`) per secret-hygiene.
- Proposta: **NESSUNA azione** — è disciplina log corretta; mantenere la lista in sync quando nuovi body-field portano secret.

---

## Quick wins (QW-J*) — CLASS-A estraibili (indipendenti, low/zero rischio)

- **QW-J1** — convertire `MATCHING_FREETEXT_ENABLED` (env.ts:114) + `API_DOCS_ENABLED` (env.ts:185) da `z.coerce.boolean().default(false)` a enum-transform esplicito `z.enum(["true","false"]).default("false").transform(v => v === "true")` (identico a `MFA_ENFORCEMENT_ENABLED` env.ts:151-154) [F-WS-J-2]. **Gate**: test con `API_DOCS_ENABLED="false"` → `env.API_DOCS_ENABLED === false` (oggi `true`); idem `MATCHING_FREETEXT_ENABLED="false"`; `pnpm test` + `pnpm typecheck` verdi; `/docs` non registrato quando la riga è `=false`.
- **QW-J2** — estendere la denylist di `env-key-merge.sh:33` a `" MFA_ENFORCEMENT_ENABLED MATCHING_FREETEXT_ENABLED API_DOCS_ENABLED COOKIE_SECURE TRUST_PROXY "` [F-WS-J-4]. **Gate**: il test D-19 (`ENV_MERGE_LOCAL=1` via `run-shell-tests.sh`) con un source contenente quelle chiavi → non compaiono nell'added-count; merge su target che le ha già = 0 overwrite. Da fare con QW-J1 (coppia footgun + propagazione).
- **QW-J3** — far scrivere/ri-asserire `TRUST_PROXY=1` (o hop-count/CIDR) a `vm-bootstrap.sh` + `provision-linux-pc.sh` come già fanno per `PORT`/`POSTGRES_PORT` (set-or-replace idempotente) [F-WS-J-5]. **Gate**: post-bootstrap `grep '^TRUST_PROXY=' .env` non-`false` sui PROD host; smoke che un XFF forgiato non evade il login-limiter. (Alternativa DOSSIER: default `env.ts` a trust-proxy quando reverse-proxy — decide Enzo.)

> Tutti i QW restano **doc-only in questa fase A** (read-only). Candidati per la fase E (esecuzione) su go di Enzo, su branch, con i gate sopra. QW-J1+QW-J2 sono naturalmente accoppiati.

---

## ASSET confermati (NON regredire senza dossier)

- **Contract `env.ts`↔`.env.example` allineato** (QW-3/QW-G3 chiusi S993; 7 var aggiunti; WS-G F-29 chiuso) [F-WS-J-1].
- **4 boolean security-critical** (`COOKIE_SECURE`/`SMTP_SECURE`/`MFA_ENFORCEMENT_ENABLED`/`TRUST_PROXY`) blindati enum-transform/`parseTrustProxy` [F-WS-J-3].
- **Topologia per-machine preservata da align-clones**: `sync-gitignored-to-vm.sh:29` esclude `^.env$`, `env-key-merge.sh:40` additive-only [F-WS-J-4 controprova].
- **4 runtime context documentati** (A/B/C DB + deploy PROD via script), Option B active marcata RD-25 [F-WS-J-7]; **`apps/web` env pubblico-only** [F-WS-J-8].
- **Secret-hygiene pulita** (0 tracked PEM/key/.env; 2 falsi positivi `BEGIN PRIVATE KEY`; `.gitignore` corretto con `!*.key.example`) [F-WS-J-9]; **`LOG_REDACT_PATHS`** completo [F-WS-J-10].
- **`POSTGRES_DB` canonico** ovunque (0 `POSTGRES_DATABASE` negli 8 script; dual-set confinato al runner CI) — couples WS-G F-29 (risolto).

---

## Baseline Config & env (misure reali — aggiorna `BASELINE_METRICS.md`)

| Metrica | Valore reale | Comando/Fonte |
|---|---|---|
| Var nel contract Zod (`env.ts`) | **30** chiavi (NODE_ENV…API_DOCS_ENABLED) + JWT priv/pub da file | `env.ts:50-186` |
| Parità `env.ts`↔`.env.example` | **allineata** (7 var aggiunti S993; 0 residui) | diff manuale + TODO_100X:40,48 |
| Boolean-like flag `z.coerce.boolean` (footgun) | **2** (`MATCHING_FREETEXT_ENABLED`, `API_DOCS_ENABLED`) | `grep z.coerce.boolean env.ts` |
| Boolean-like flag enum-transform (sicuri) | **4** (`COOKIE_SECURE`/`SMTP_SECURE`/`MFA_ENFORCEMENT_ENABLED`/`TRUST_PROXY`) | `env.ts:82,123,151,61` |
| denylist `env-key-merge.sh` | **1** chiave (`MFA_ENFORCEMENT_ENABLED`) — ≥4 candidate mancanti | `env-key-merge.sh:33` |
| Script che settano `TRUST_PROXY` su PROD | **0** (valore live=1 manuale, QW-SEC1) | grep `*.sh` |
| Chiavi `.env` scritte da `vm-bootstrap.sh` | **2** (`POSTGRES_PORT`,`PORT`) | `vm-bootstrap.sh:99-100` |
| Chiavi `.env` scritte da `provision-linux-pc.sh` | **8** (incl. `COOKIE_SECURE=false`) | `provision-linux-pc.sh:46` |
| `POSTGRES_DB` vs `POSTGRES_DATABASE` negli script | `POSTGRES_DB` ovunque; `POSTGRES_DATABASE` = 0 (solo runner CI doc) | grep 8 script + `self-hosted-runners-setup.md:118-119` |
| Runtime context `.env.example` | **3** DB-block (A fallback / **B active** / C future) + deploy PROD via script | `.env.example:22-64` |
| Segreti reali nel tracked tree | **0** (PEM/key/.env*/.secrets; 2 falsi positivi `BEGIN PRIVATE KEY` in handover doc) | `git ls-files`/`git grep` |
| `LOG_REDACT_PATHS` | cookie/auth/password×3/code/mfaCode/phoneNumber/token×2 + `*.{password,hash,secret,code,otp}` | `app.ts:149-169` |

**Insight chiave**: il contratto env è **strutturalmente sano** (parità env.ts↔.env.example chiusa, secret-hygiene pulita, redaction completa, topologia per-machine preservata da align-clones). Le 3 leve residue sono tutte di **fail-open / config-drift**, tutte QUICK-WIN low-risk: (1) **footgun `z.coerce.boolean`** su 2 feature-flag dove `=false` *accende* il flag (API_DOCS_ENABLED = esposizione superficie /v1/* su prod) [J-2]; (2) **denylist env-key-merge incompleta** → un dev-flag potrebbe propagare additivamente a un PROD privo della chiave [J-4]; (3) **TRUST_PROXY=1 PROD non gestito da script** → drift-vector sul rate-limit per-IP, riconcilia WS-H F-WS-H-1 (runtime già OK, manca la governance) [J-5]. J-2+J-4 sono accoppiati e vanno chiusi insieme.

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Dossier (richiedono decisione Enzo):**
- D — **TRUST_PROXY governance** [F-WS-J-5]: assert-in-bootstrap (QW-J3) vs cambiare il default `env.ts` quando dietro reverse-proxy — couples WS-H F-WS-H-1 (D-28, runtime già RISOLTO; il residuo è gestionale).
- D (minore) — **simmetria provisioning VM↔linux-pc + COOKIE_SECURE divergente** [F-WS-J-6]: rilevante solo se linux-pc entra in align-clones (oggi ISOLATO per dottrina).

**Quick-wins CLASS-A** (eseguibili su go, gate espliciti sopra): QW-J1 enum-transform sui 2 flag footgun · QW-J2 estensione denylist env-key-merge (coppia con QW-J1) · QW-J3 assert TRUST_PROXY nei bootstrap.

**Note (verifica, non fix):** asimmetria provisioning + WEBAUTHN_* non gestito sul twin LAN [F-WS-J-6]; opzione generatore `.env.example` dal Zod env.ts per parità self-checking [F-WS-J-1 NB].

**Asset da NON regredire**: contract allineato · 4 boolean security blindati enum-transform · topologia per-machine preservata (align-clones additive + `.env` excluded) · 4 runtime context documentati · secret-hygiene pulita + LOG_REDACT_PATHS · POSTGRES_DB canonico.

---

*Audit S-100X-A9 — read-only, ispezione repo (env.ts SoT + `.env.example` + 8 script + env-key-merge + app.ts) + git secret-scan + sub-agent topologia per-host. Nessuna modifica a codice/CI/deploy/.env, zero scritture, nessun valore segreto stampato. I finding qui confluiscono nel registro dossier 100X — decisione per-finding di Enzo. Cross-ref: WS-G F-29/QW-G3 (env-contract → CHIUSO S993, riconciliato) + WS-H F-WS-H-1/D-28 (TRUST_PROXY runtime RISOLTO S988; WS-J copre il management gap residuo) + WS-C F-WS-C-4 (auth-housekeeping.sh QW-C2 letto, fuori scope env ma legge `.env`).*
