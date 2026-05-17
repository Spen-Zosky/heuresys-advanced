# heuresys-advanced — Bootstrap su VM OCI

> **Scopo**: replicare l'ambiente completo (API + design system linked + DB + secrets) su `oracle-vm-default` (Ubuntu 24.04 ARM64) clonando dai repo pubblici GitHub. Pensato per **una sessione dedicata** quando si decide di abilitare l'ambiente VM (CI, secondo sviluppatore, demo remoto, build pesanti che non vogliamo su Windows).
>
> **Quando aprire questo runbook**: trigger concreti = (a) serve clonare la pipeline su un'altra macchina, (b) parte un dev oltre Enzo, (c) servono build / Docker su ambiente Linux, (d) si predispone GitHub Actions, (e) demo accessibile da Internet.
>
> **Durata stimata**: 15–25 min di esecuzione + 5 min di verifica. Il grosso del tempo è `npm install` di `ux-design-shared` (Storybook, three.js, mermaid, ecc. richiedono download di ~950 pacchetti).
>
> **Output atteso**: 182/182 integration test verdi sulla VM, modulo `@heuresys/ui` linkato al clone locale di `ux-design-shared`, DB `heuresys_advanced` popolato con seed RTL_BANK + 5 personas, API esecuzionabile via `pnpm dev` su port 3001.

---

## 1. Contesto architetturale

```
                           ┌───────────────────────────┐
                           │ GitHub.com                │
                           │  ├── Spen-Zosky/          │
                           │  │   heuresys-advanced    │  ← origin
                           │  └── Spen-Zosky/          │
                           │      ux-design-shared     │  ← origin
                           └────────────┬──────────────┘
                                        │ git clone
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│ VM oracle-vm-default  (Ubuntu 24.04 ARM64, /home/ubuntu)     │
│                                                              │
│  ~/ux-design-shared/                                         │
│    └── ui/                  ← @heuresys/ui (51 componenti)   │
│        └── node_modules/    ← deps UI installate qui (~950)  │
│                                                              │
│  ~/heuresys-advanced/                                        │
│    ├── apps/api             ← Fastify, 56 moduli, 267 ep    │
│    ├── apps/web             ← Next.js (scaffold)            │
│    ├── packages/shared      ← Zod schemas                   │
│    ├── db/migrations        ← 27 SQL files                  │
│    └── node_modules/                                         │
│        └── @heuresys/ui  ───symlink───►  ~/ux-design-shared/ui
│                                                              │
│  PostgreSQL 16 nativo (localhost:5432)                       │
│    ├── heuresys_platform      (legacy, già presente)         │
│    └── heuresys_advanced      ← da creare via db:create:sh   │
└──────────────────────────────────────────────────────────────┘
```

**Differenze chiave Windows ↔ VM**:

| Aspetto | Windows (corrente) | VM OCI (target) |
|---|---|---|
| Path repo principale | `D:\heuresys-advanced` | `~/heuresys-advanced` |
| Path UI shared (sibling) | `D:\ux-design-shared` | `~/ux-design-shared` |
| PostgreSQL endpoint | `localhost:5433` (via tunnel SSH a OCI) | `localhost:5432` (nativo, no tunnel) |
| Script DB | `*.ps1` (PowerShell) | varianti `*.sh` (`pnpm db:*:sh`) |
| Symlink `@heuresys/ui` | junction NTFS | symlink POSIX (più robusto) |
| Path relativo `link:` | `../ux-design-shared/ui` | **identico** — pnpm normalizza |
| Secrets `.env` + `.secrets/` | quelli generati su Win | da generare fresh (NON copiare cross-env) |
| Storybook | `localhost:6006` | accesso via `ssh -L 6006:localhost:6006` |

---

## 2. Pre-flight checklist (prima di iniziare)

Eseguire i comandi sulla VM (`ssh oracle-vm-default`) e verificare uno per uno:

```bash
# Identità + auth
whoami                              # → ubuntu
gh auth status                      # → "Logged in to github.com account Spen-Zosky"
ssh -T git@github.com 2>&1 | grep -i "success"  # opzionale (se preferisci SSH a HTTPS)

# Runtime
node --version                      # ≥ 20.11
corepack enable                     # abilita pnpm@9.15.0 al primo uso
pnpm --version                      # 9.15.0 dopo il primo `pnpm install`
psql --version                      # 16.x
git --version                       # 2.40+

# Tool secondari (per script bootstrap)
openssl version                     # OpenSSL 3.x
which unzip                         # /usr/bin/unzip (per ispezione brownfield zip)
which jq                            # /usr/bin/jq (gestione JSON nelle verifiche)

# Spazio disco (i due repo + node_modules pesano ~2 GB)
df -h ~                             # almeno 5 GB liberi

# PostgreSQL accessibile sulla VM
sudo -u postgres psql -c "SELECT version();" | head -3
```

Se uno di questi fallisce: **non procedere**, risolvere prima (`apt install`, `corepack enable`, ecc.).

---

## 3. Variabili decisionali (raccolte una sola volta)

Aprire un secondo terminale o un file `.bootstrap-vars` (gitignored) per annotare:

| Variabile | Esempio | Note |
|---|---|---|
| `PG_DB_USER` | `heuresys` | utente PostgreSQL applicativo (NON `postgres`) |
| `PG_DB_PASSWORD` | (scegliere robusta, ≥ 24 char) | mai committare; salvare in password manager |
| `PG_DB_NAME` | `heuresys_advanced` | default consigliato |
| `COOKIE_SECRET` | auto-generato da `openssl rand -base64 48` | 48 byte base64, va in `.env` |
| `JWT_PRIVATE_KEY_FILE` | `.secrets/jwt_private.pem` | RSA 2048 bit, auto-generato |
| `JWT_PUBLIC_KEY_FILE` | `.secrets/jwt_public.pem` | derivato dalla private |
| `TEST_ADMIN_PASSWORD` | `Admin#PassW0rd!` (default OK per dev) | usato dai test integrati |
| `API_PORT` | `3001` | porta dev server API |
| `WEB_PORT` | `3000` | porta Next.js (quando MVP-2a partirà) |
| Hostname API exposed | `0.0.0.0:3001` o `127.0.0.1:3001` | se vuoi esporre verso fuori, fix anche security list OCI |

---

## 4. TODO list (sessione bootstrap)

Da spuntare durante l'esecuzione. Ogni item ha un comando associato nelle sezioni dopo.

- [ ] **T1**. SSH alla VM e check pre-flight (sezione 2)
- [ ] **T2**. Clone `ux-design-shared` in `~/ux-design-shared`
- [ ] **T3**. `npm install --legacy-peer-deps` in `ux-design-shared`
- [ ] **T4**. Clone `heuresys-advanced` in `~/heuresys-advanced` (sibling)
- [ ] **T5**. Copia `.env.example` → `.env`, edita per host=localhost/port=5432
- [ ] **T6**. Crea `.secrets/` + genera chiavi JWT RSA 2048
- [ ] **T7**. Genera `COOKIE_SECRET` e inseriscilo in `.env`
- [ ] **T8**. `pnpm install` (materializza il symlink a ux-design-shared)
- [ ] **T9**. Verifica `readlink -f node_modules/@heuresys/ui` → `/home/ubuntu/ux-design-shared/ui`
- [ ] **T10**. `pnpm db:create:sh` (crea DB + ruolo applicativo)
- [ ] **T11**. `pnpm db:migrate:sh` (27 migration idempotenti)
- [ ] **T12**. `pnpm db:validate` (7 view di validazione strutturale)
- [ ] **T13**. `pnpm db:seed` (RTL_BANK_REFERENCE tenant + 158 personas sintetiche)
- [ ] **T14**. `pnpm db:seed-test-admin` (5 test personas con password nota)
- [ ] **T15**. `cd apps/api && pnpm test` (atteso: 182/182 verdi)
- [ ] **T16**. `pnpm dev` in `apps/api` per smoke check del server runtime
- [ ] **T17**. `curl http://localhost:3001/healthz` e `/readyz` (atteso: 200)
- [ ] **T18**. (opzionale) login test via `curl POST /v1/auth/login` con admin@heuresys.com
- [ ] **T19**. Aggiornamento doc locale: appunta SHA dei due repo al momento del bootstrap nel file `.bootstrap-vars` o in HANDOFF.md locale
- [ ] **T20**. Cleanup eventuali file temp (`.bootstrap-vars` se contiene secrets, va distrutto/spostato in password manager)

---

## 5. Procedura passo-passo (comandi copy-paste)

### 5.1 — Clone dei due repo

```bash
cd ~
git clone https://github.com/Spen-Zosky/ux-design-shared.git
git clone https://github.com/Spen-Zosky/heuresys-advanced.git
```

Sanity check posizione:
```bash
ls -d ~/ux-design-shared ~/heuresys-advanced
# Entrambi devono esistere come SIBLING, stessa directory padre.
```

### 5.2 — Install deps di `ux-design-shared`

```bash
cd ~/ux-design-shared
npm install --legacy-peer-deps      # ~3-5 min, ~950 pacchetti
```

> **Perché `--legacy-peer-deps`**: Storybook 10 (`@storybook/addon-a11y@^10.3.6`) ha un peer-dep clash che npm 10+ rigetta di default. Il flag accetta l'incoerenza in modo sicuro (è un widely-used npm workaround documentato dalla community Storybook).

Verifica installazione:
```bash
ls node_modules/.bin/storybook && ls node_modules/.bin/vitest
# Entrambi devono esistere.
```

### 5.3 — Setup `.env` di `heuresys-advanced`

```bash
cd ~/heuresys-advanced
cp .env.example .env
```

Edita `.env` (vim/nano). Sezione "A" (localhost) — perché sulla VM postgres è già locale:

```dotenv
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=heuresys_advanced
POSTGRES_USER=heuresys
POSTGRES_PASSWORD=<scegli-robust-≥24-char>
POSTGRES_SSL=disable

API_PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Saranno popolate dallo step successivo
COOKIE_SECRET=
JWT_PRIVATE_KEY_PATH=.secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=.secrets/jwt_public.pem
```

### 5.4 — Generazione secrets

```bash
mkdir -p .secrets
chmod 700 .secrets

# JWT RS256 keypair (ADR-0005)
openssl genrsa -out .secrets/jwt_private.pem 2048
openssl rsa -in .secrets/jwt_private.pem -pubout -out .secrets/jwt_public.pem
chmod 600 .secrets/jwt_*.pem

# COOKIE_SECRET (48 byte base64)
COOKIE_SECRET_VALUE=$(openssl rand -base64 48)
echo "COOKIE_SECRET=$COOKIE_SECRET_VALUE"
# → Copia il valore nella riga COOKIE_SECRET= del .env
```

Verifica gitignore (le chiavi non devono mai uscire dalla VM):
```bash
git check-ignore .secrets/jwt_private.pem .env
# Atteso: entrambi i path vengono stampati (sono gitignored)
```

### 5.5 — Install monorepo + materializzazione symlink

```bash
cd ~/heuresys-advanced
pnpm install
# Atteso: "Done in XX s", senza errori; warning su peer deps di Faker/Storybook tollerati.
```

**Verifica symlink** (step critico):
```bash
readlink -f node_modules/@heuresys/ui
# Atteso: /home/ubuntu/ux-design-shared/ui
```

Se invece compare un path dentro `node_modules/.pnpm/@heuresys+ui@file+...`, significa che pnpm ha normalizzato `link:` a `file:` (snapshot). Cause possibili:
- Path errato in `package.json` (deve essere `link:../ux-design-shared/ui`)
- Repo `ux-design-shared` non clonato dove atteso

Fix: correggi posizione cartelle, poi `rm -rf node_modules && pnpm install`.

### 5.6 — Database

```bash
cd ~/heuresys-advanced

# Crea DB + ruolo applicativo (idempotente)
pnpm db:create:sh

# Applica le 27 migration (idempotente, twice-run proven)
pnpm db:migrate:sh

# (opzionale) verifica strutturale via 7 view
pnpm db:validate

# Seed tenant RTL_BANK + 158 personas sintetiche
pnpm db:seed

# Seed 5 test personas con password nota (PLATFORM_ADMIN, TENANT_ADMIN, MANAGER, USER, OUTSIDER)
pnpm db:seed-test-admin
```

Smoke DB:
```bash
psql -h localhost -p 5432 -U heuresys -d heuresys_advanced \
  -c "SELECT count(*) FROM sys.sys_users;"
# Atteso: 163 (158 sintetiche + 5 test personas)
```

### 5.7 — Test suite

```bash
cd apps/api
pnpm test
# Atteso: 182 passed, 0 failed, ~100s
```

### 5.8 — Smoke runtime

```bash
# In una sessione tmux/screen separata (perché pnpm dev rimane in foreground):
cd ~/heuresys-advanced/apps/api
pnpm dev

# In un altro terminale (o dopo background):
curl -s http://localhost:3001/healthz | jq
curl -s http://localhost:3001/readyz | jq

# Login test (cookie scartato, è solo smoke):
curl -s -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@heuresys.com","password":"Admin#PassW0rd!"}' | jq .user
# Atteso: { "userId": "...", "email": "admin@heuresys.com" }
```

---

## 6. Script `bootstrap-vm.sh` (automazione end-to-end)

Da copiare sulla VM e eseguire. Lo script:
- È **idempotente** (re-esecuzione safe se interrotto)
- Usa `set -euo pipefail` (stop al primo errore)
- Stampa progresso a colori
- Chiede conferma prima di operazioni distruttive
- Verifica ogni step prima di passare al successivo
- Genera secrets se non presenti
- **NON** committa nulla (lascia a Enzo / a una sessione successiva)

```bash
#!/usr/bin/env bash
# heuresys-advanced bootstrap su VM OCI — riproduce l'ambiente Windows
# Vedi heuresys-advanced-bootstrap-vm.md per il contesto.

set -euo pipefail
IFS=$'\n\t'

# ------------------------------------------------------------------
# Configurazione (sovrascrivibile via env var prima del lancio)
# ------------------------------------------------------------------
: "${HOME_BASE:=$HOME}"
: "${UX_REPO:=https://github.com/Spen-Zosky/ux-design-shared.git}"
: "${HEU_REPO:=https://github.com/Spen-Zosky/heuresys-advanced.git}"
: "${UX_DIR:=$HOME_BASE/ux-design-shared}"
: "${HEU_DIR:=$HOME_BASE/heuresys-advanced}"
: "${PG_DB_NAME:=heuresys_advanced}"
: "${PG_DB_USER:=heuresys}"

# Colori
C_BLU='\033[1;34m'; C_GRN='\033[1;32m'; C_YEL='\033[1;33m'; C_RED='\033[1;31m'; C_RST='\033[0m'
log()   { printf "${C_BLU}▸${C_RST} %s\n" "$*"; }
ok()    { printf "${C_GRN}✓${C_RST} %s\n" "$*"; }
warn()  { printf "${C_YEL}!${C_RST} %s\n" "$*"; }
fail()  { printf "${C_RED}✗${C_RST} %s\n" "$*" >&2; exit 1; }

confirm() {
  read -r -p "$1 [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || fail "Annullato dall'utente."
}

# ------------------------------------------------------------------
# 0. Pre-flight
# ------------------------------------------------------------------
log "Pre-flight checks"
command -v git >/dev/null    || fail "git non installato"
command -v node >/dev/null   || fail "node non installato"
command -v npm >/dev/null    || fail "npm non installato"
command -v openssl >/dev/null|| fail "openssl non installato"
command -v psql >/dev/null   || fail "psql non installato (postgresql-client)"
corepack enable 2>/dev/null  || warn "corepack già abilitato o non disponibile"

NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
[[ "$NODE_MAJOR" -ge 20 ]] || fail "Node ≥ 20.11 richiesto (trovato $(node -v))"
ok "Pre-flight ok (Node $(node -v))"

# ------------------------------------------------------------------
# 1. Clone ux-design-shared
# ------------------------------------------------------------------
if [[ -d "$UX_DIR/.git" ]]; then
  log "ux-design-shared già clonato — pull ultimo main"
  git -C "$UX_DIR" pull --ff-only origin main
else
  log "Clone ux-design-shared in $UX_DIR"
  git clone "$UX_REPO" "$UX_DIR"
fi
ok "ux-design-shared HEAD: $(git -C $UX_DIR rev-parse --short HEAD)"

# ------------------------------------------------------------------
# 2. Install deps di ux-design-shared
# ------------------------------------------------------------------
if [[ -d "$UX_DIR/node_modules" && -f "$UX_DIR/package-lock.json" ]]; then
  log "ux-design-shared/node_modules esiste — skip npm install (rerun: rm -rf $UX_DIR/node_modules)"
else
  log "npm install --legacy-peer-deps in ux-design-shared (3-5 min, ~950 pkg)"
  (cd "$UX_DIR" && npm install --legacy-peer-deps)
fi
ok "ux-design-shared deps installate"

# ------------------------------------------------------------------
# 3. Clone heuresys-advanced
# ------------------------------------------------------------------
if [[ -d "$HEU_DIR/.git" ]]; then
  log "heuresys-advanced già clonato — pull ultimo main"
  git -C "$HEU_DIR" pull --ff-only origin main
else
  log "Clone heuresys-advanced in $HEU_DIR"
  git clone "$HEU_REPO" "$HEU_DIR"
fi
ok "heuresys-advanced HEAD: $(git -C $HEU_DIR rev-parse --short HEAD)"

# ------------------------------------------------------------------
# 4. .env (interattivo se mancante)
# ------------------------------------------------------------------
cd "$HEU_DIR"

if [[ -f .env ]]; then
  log ".env già presente — skip (rimuoverlo se vuoi rigenerarlo)"
else
  log "Configura .env"
  cp .env.example .env

  read -r -s -p "  PG_DB_PASSWORD (per ruolo $PG_DB_USER, ≥ 24 char): " PG_PWD
  echo ""
  [[ ${#PG_PWD} -ge 24 ]] || warn "Password < 24 char — accettata ma considera rigenerarla"

  # Patch .env per host locale
  sed -i.bak \
    -e "s|^POSTGRES_HOST=.*|POSTGRES_HOST=localhost|" \
    -e "s|^POSTGRES_PORT=.*|POSTGRES_PORT=5432|" \
    -e "s|^POSTGRES_DB=.*|POSTGRES_DB=$PG_DB_NAME|" \
    -e "s|^POSTGRES_USER=.*|POSTGRES_USER=$PG_DB_USER|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG_PWD|" \
    .env
  rm -f .env.bak
  export PGPASSWORD="$PG_PWD"   # per i comandi psql successivi
  ok ".env configurato"
fi

# ------------------------------------------------------------------
# 5. Secrets (JWT + COOKIE)
# ------------------------------------------------------------------
mkdir -p .secrets && chmod 700 .secrets

if [[ ! -f .secrets/jwt_private.pem ]]; then
  log "Genero JWT keypair RS256"
  openssl genrsa -out .secrets/jwt_private.pem 2048 2>/dev/null
  openssl rsa -in .secrets/jwt_private.pem -pubout -out .secrets/jwt_public.pem 2>/dev/null
  chmod 600 .secrets/jwt_*.pem
  ok "JWT keys generate"
else
  log "JWT keys già presenti — skip"
fi

if ! grep -q "^COOKIE_SECRET=..*" .env; then
  log "Genero COOKIE_SECRET (48 byte base64)"
  COOKIE_VAL=$(openssl rand -base64 48)
  sed -i.bak -e "s|^COOKIE_SECRET=.*|COOKIE_SECRET=$COOKIE_VAL|" .env
  rm -f .env.bak
  ok "COOKIE_SECRET impostato"
else
  log "COOKIE_SECRET già impostato — skip"
fi

# ------------------------------------------------------------------
# 6. pnpm install (materializza il symlink a ux-design-shared)
# ------------------------------------------------------------------
log "pnpm install (root monorepo)"
pnpm install

LINK_TARGET=$(readlink -f node_modules/@heuresys/ui)
EXPECTED="$UX_DIR/ui"
if [[ "$LINK_TARGET" == "$EXPECTED" ]]; then
  ok "Symlink verificato: node_modules/@heuresys/ui → $LINK_TARGET"
else
  fail "Symlink ERRATO: $LINK_TARGET (atteso: $EXPECTED). Controlla layout cartelle."
fi

# ------------------------------------------------------------------
# 7. Database (idempotente)
# ------------------------------------------------------------------
log "DB create/migrate/seed"
pnpm db:create:sh
pnpm db:migrate:sh
pnpm db:seed
pnpm db:seed-test-admin
ok "DB pronto"

USERS_COUNT=$(psql -h localhost -p 5432 -U "$PG_DB_USER" -d "$PG_DB_NAME" -tA \
  -c "SELECT count(*) FROM sys.sys_users;")
ok "sys.sys_users count: $USERS_COUNT (atteso ≥ 163)"

# ------------------------------------------------------------------
# 8. Test suite
# ------------------------------------------------------------------
log "Esecuzione test integration suite (~100 s)"
(cd apps/api && pnpm test) || fail "Test falliti — investigare prima di proseguire"
ok "Tutti i test verdi"

# ------------------------------------------------------------------
# 9. Riepilogo
# ------------------------------------------------------------------
echo ""
ok "Bootstrap completato."
echo ""
echo "  ux-design-shared:    $UX_DIR   ($(git -C $UX_DIR rev-parse --short HEAD))"
echo "  heuresys-advanced:   $HEU_DIR  ($(git -C $HEU_DIR rev-parse --short HEAD))"
echo "  Symlink UI:          node_modules/@heuresys/ui → $LINK_TARGET"
echo "  DB:                  $PG_DB_NAME @ localhost:5432 (utenti: $USERS_COUNT)"
echo "  API dev start:       cd $HEU_DIR/apps/api && pnpm dev"
echo "  Smoke endpoint:      curl http://localhost:3001/healthz"
echo ""
warn "Ricorda: .env e .secrets/ sono LOCALI a questa VM. Mai committare, mai rsync verso altre macchine."
```

**Installazione + esecuzione**:
```bash
ssh oracle-vm-default
cat > ~/bootstrap-heuresys.sh    # incolla il contenuto sopra, poi Ctrl+D
chmod +x ~/bootstrap-heuresys.sh
~/bootstrap-heuresys.sh
```

---

## 7. Suite di verifica post-bootstrap

Da eseguire dopo il completamento dello script, per validare end-to-end:

```bash
cd ~/heuresys-advanced

# A. Repo git in sync con origin
git status -sb                              # → "## main...origin/main" senza divergenze
git -C ../ux-design-shared status -sb       # → idem

# B. Symlink valido
[[ "$(readlink -f node_modules/@heuresys/ui)" == "$HOME/ux-design-shared/ui" ]] \
  && echo "OK symlink" || echo "KO symlink"

# C. Hot link funzionante (touch del file in source → visibile nel symlink)
touch ../ux-design-shared/ui/src/_BOOTSTRAP_TEST.txt
ls node_modules/@heuresys/ui/src/_BOOTSTRAP_TEST.txt && echo "OK live-link"
rm -f ../ux-design-shared/ui/src/_BOOTSTRAP_TEST.txt

# D. DB raggiungibile
psql -h localhost -p 5432 -U heuresys -d heuresys_advanced -c "\dt sys.sys_users"

# E. Test suite (riconferma)
cd apps/api && pnpm test

# F. API runtime
pnpm dev &                                  # background
sleep 5
curl -sf http://localhost:3001/healthz && echo "OK healthz"
curl -sf http://localhost:3001/readyz  && echo "OK readyz"

# Login flow E2E
LOGIN_RESP=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@heuresys.com","password":"Admin#PassW0rd!"}')
echo "$LOGIN_RESP" | jq -e '.user.email == "admin@heuresys.com"' && echo "OK login"

kill %1 2>/dev/null                         # ferma il dev server
```

---

## 8. Troubleshooting

### Symlink risolto come snapshot (no live-link)

**Sintomo**: `readlink -f node_modules/@heuresys/ui` ritorna un path dentro `node_modules/.pnpm/@heuresys+ui@file+...` invece di `~/ux-design-shared/ui`.

**Causa**: pnpm ha tradotto `link:` a `file:` (succede quando il path nel `package.json` non risolve, o quando i due repo non sono sibling).

**Fix**:
```bash
# Verifica package.json
grep "@heuresys/ui" ~/heuresys-advanced/package.json
# Atteso: "@heuresys/ui": "link:../ux-design-shared/ui"

# Verifica layout fisico
ls -d ~/ux-design-shared ~/heuresys-advanced
# Entrambi devono esistere come sibling

# Reinstalla pulito
cd ~/heuresys-advanced && rm -rf node_modules pnpm-lock.yaml && pnpm install
```

### `npm install` fallisce con peer-dep error in ux-design-shared

**Sintomo**: errore tipo `Could not resolve dependency: @storybook/addon-a11y@^10.3.6 ... ERESOLVE`.

**Fix**: aggiungi sempre `--legacy-peer-deps`. È il workaround documentato Storybook 10:
```bash
cd ~/ux-design-shared && npm install --legacy-peer-deps
```

### `pnpm db:create:sh` fallisce con "permission denied" su PostgreSQL

**Sintomo**: il tuo utente Linux non ha grant per creare DB.

**Fix**: lo script usa il super-user `postgres`. Verifica:
```bash
sudo -u postgres psql -c "SELECT 1;"      # deve funzionare
# Se non funziona, abilita peer auth oppure dai grant esplicito:
sudo -u postgres psql -c "ALTER USER ubuntu CREATEDB CREATEROLE;"
```

### Test integration falliscono con "connection refused"

**Sintomo**: i test cercano DB ma fallisce TCP a localhost:5432.

**Fix**: postgresql.conf non ascolta su localhost.
```bash
sudo -u postgres psql -c "SHOW listen_addresses;"
# Se vuoto o 'localhost' assente, edita /etc/postgresql/16/main/postgresql.conf:
# listen_addresses = 'localhost'
sudo systemctl restart postgresql
```

### Sessione test si blocca su query lente

**Sintomo**: il test suite supera i 200 s o si blocca.

**Causa probabile**: la VM ARM64 free-tier è meno potente di Windows. Comportamento accettato.

**Mitigazione**: per dev attivo conviene tenere Windows come primary; usare VM per CI / demo / sync.

### Risorse VM esaurite durante `npm install` di ux-design-shared

**Sintomo**: OOM kill, swap exhausted, errori `EMFILE`.

**Fix**:
```bash
# Limita la concorrenza npm
cd ~/ux-design-shared
npm install --legacy-peer-deps --jobs=2

# In alternativa: usa pnpm anche per ux-design-shared (più frugale)
rm -rf node_modules package-lock.json
pnpm install                          # più leggero, store condivisa
```

---

## 9. Workflow quotidiano post-bootstrap

### Sync Windows → VM (caso normale)

```bash
# Su Windows: push delle modifiche
cd D:/heuresys-advanced && git push origin main
cd D:/ux-design-shared  && git push origin main

# Sulla VM: pull
ssh oracle-vm-default
cd ~/heuresys-advanced && git pull origin main && pnpm install  # solo se lockfile cambia
cd ~/ux-design-shared  && git pull origin main
# Se ux-design-shared ha aggiunto npm deps:
cd ~/ux-design-shared && npm install --legacy-peer-deps
```

### Sync VM → Windows (sviluppi sulla VM)

```bash
# Sulla VM: commit + push
cd ~/heuresys-advanced && git add . && git commit -m "..." && git push origin main

# Su Windows: pull
cd D:/heuresys-advanced && git pull origin main && pnpm install
```

### Far girare API + Storybook accessibili da Windows

```bash
# Su Windows: tunnel SSH multi-porta verso la VM
ssh -L 3001:localhost:3001 -L 6006:localhost:6006 oracle-vm-default

# Sulla VM (nella sessione SSH aperta):
cd ~/heuresys-advanced/apps/api && pnpm dev &       # API → http://localhost:3001 da Windows
cd ~/ux-design-shared/ui && npm run storybook       # Storybook → http://localhost:6006
```

---

## 10. Considerazioni di sicurezza specifiche VM

- **Mai committare `.secrets/` o `.env`**: il `.gitignore` li copre, ma verifica sempre con `git check-ignore`.
- **JWT keys**: ogni ambiente (Win, Mac, VM) deve avere coppie proprie. Non condividerle via rsync/SSH copy. Sono di fatto credenziali server-side.
- **OCI security list**: se esponi l'API sulla porta 3001 verso Internet (NON consigliato in dev), apri la porta nella security list OCI + abilita TLS via nginx reverse proxy o equivalente.
- **Backup `.env`**: salva il valore di `POSTGRES_PASSWORD` in un password manager locale. Senza, il ripristino del DB sarà doloroso.
- **Rotazione COOKIE_SECRET**: invalidare tutte le sessioni → rigenera + restart API.

---

## 11. Apertura sessione dedicata — checklist iniziale per Claude

Quando si aprirà la sessione bootstrap-VM dedicata, far leggere a Claude:

1. Questo file (`heuresys-advanced-bootstrap-vm.md`)
2. `CLAUDE.md` (per le invariant + commands canonici)
3. `HANDOFF.md` (per lo stato corrente del repo)
4. La sezione "VM OCI" del CLAUDE.md globale di Enzo

Poi prompt iniziale tipo:

> *"Sono Enzo. Apri sessione bootstrap su `oracle-vm-default`. Riferimento operativo:* `heuresys-advanced/heuresys-advanced-bootstrap-vm.md`. *Procedi con la TODO list T1..T20. Variabili decisionali in:*  `[da raccogliere]`. *Conferma alla fine con la verifica suite della sezione 7."*

---

## 12. Riferimenti

- **Repo heuresys-advanced**: https://github.com/Spen-Zosky/heuresys-advanced (SHA at-time-of-bootstrap: da aggiornare)
- **Repo ux-design-shared**: https://github.com/Spen-Zosky/ux-design-shared (SHA at-time-of-bootstrap: da aggiornare)
- **CLAUDE.md sezione "Design System"**: regole d'integrazione `@heuresys/ui` (paragrafo aggiunto nel commit `fbb8466`)
- **ADR-0010**: scelta runtime OCI VM via tunnel (per Win) / locale (per VM stessa)
- **ADR-0011**: ESS scope inclusion (rilevante quando MVP-2b andrà testato sulla VM)
- **`docs/api/API_IMPLEMENTATION_PLAN.md`**: 13-step plugin chain Fastify (utile se serve debug runtime sulla VM)

---

**Ultima revisione**: 2026-05-17  
**Stato**: ready-to-execute, non testato sulla VM (sarà la sessione bootstrap stessa a validare i passi).
