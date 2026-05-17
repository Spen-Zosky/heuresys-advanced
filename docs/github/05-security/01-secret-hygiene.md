# 05.1 · Secret hygiene

> Tre meccanismi a strati: **`.gitignore`** (prevenzione locale), **secret scanning** (rilevamento automatico se committi per errore), **push protection** (blocco a livello server). Capirli + applicarli è la base. Una volta committato un secret, **va rotato** — anche se rimuovi il commit.

---

## 1. Concetto

### Il vero costo di un secret leakato

Un secret committato anche per 5 secondi è considerato **compromesso definitivamente**:

1. GitHub indicizza il commit nei propri search index quasi-realtime.
2. I mirror automatici (BetterCode, Sourcegraph, ecc.) clonano in tempi simili.
3. Bot di scanning eseguono migliaia di clone/secondo cercando pattern (AWS keys, GitHub PAT, Stripe key, ecc.).
4. Anche dopo `git push --force` per riscrivere la storia, le copie cached restano.

**Regola**: rotare il secret è obbligatorio. Riscrivere la storia git è opzionale (utile per cleanup ma non sufficiente).

### 3 livelli di difesa

| Livello | Quando agisce | Implementazione |
|---|---|---|
| **1. `.gitignore`** | Pre-stage (locale) | File `.gitignore` con pattern per `.env`, `*.pem`, `*.key`, ecc. |
| **2. Secret scanning** | Post-push (server) | GitHub auto-detect pattern noti (~250 provider). Apre alert. |
| **3. Push protection** | Pre-receive (server) | GitHub blocca il push se rileva secret. Disponibile gratis su tutti i repo public. |

### Pattern detection coperti

GitHub rileva di default ~250 pattern: AWS access key, GitHub PAT, Stripe API key, OpenAI key, Slack tokens, Azure connection string, JWT signature, private key (PEM), Twilio token, ecc.

Lista completa: <https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns>

### Custom patterns

Per repo Enterprise/Advanced Security puoi definire regex custom. Per personal tier: solo i pattern built-in.

---

## 2. Modello mentale

```
   ┌──────────────────────────────────────────────────────────┐
   │                       DEV LOCAL                          │
   │                                                          │
   │   .env  (contains POSTGRES_PASSWORD=...)                 │
   │     │                                                    │
   │     │  git add -A                                        │
   │     ▼                                                    │
   │   .gitignore filtra .env                                 │
   │     │                                                    │
   │     │  (se è in gitignore, non viene staged)             │
   │     ▼                                                    │
   │   git commit + git push                                  │
   │     │                                                    │
   └─────┼────────────────────────────────────────────────────┘
         │
         ▼
   ┌──────────────────────────────────────────────────────────┐
   │                    GITHUB SERVER                         │
   │                                                          │
   │   Push protection: scansiona diff in arrivo              │
   │     │                                                    │
   │     ├─ Match noto pattern? → BLOCCA il push              │
   │     │                                                    │
   │     └─ Pass → accept                                     │
   │                                                          │
   │   Secret scanning (post-push, async)                     │
   │     │                                                    │
   │     ├─ Match → Alert visibile in tab Security            │
   │     │   ├─ Notifica autore + admin                       │
   │     │   └─ (opt) auto-notifica provider per revoke       │
   │     │                                                    │
   │     └─ No match → silent                                 │
   └──────────────────────────────────────────────────────────┘
```

---

## 3. Applicato ai nostri repo

### Stato `.gitignore`

**`heuresys-advanced/.gitignore`** (strutturato bene):
```
# Dependencies
node_modules/

# Build outputs
dist/
build/
.next/
storybook-static/
*.tsbuildinfo

# Environment & secrets
.env
.env.*
!.env.example
.secrets/
*.pem
*.key

# Logs
*.log
npm-debug.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
test-results/
playwright-report/

# pnpm
.pnpm-store/
```

**`ux-design-shared/.gitignore`** (minimal, ~10 righe):
```
node_modules/
package-lock.json   ← causa del primo fail workflow
npm-debug.log*
yarn-error.log*
dist/
build/
.next/
storybook-static/
.env
*.log
```

**Verifica scansione**:
- Entrambi: `.env`, `.pem`, `.key` ignorati. ✅
- `heuresys-advanced` esplicito `.secrets/` directory ignorata. ✅
- `ux-design-shared` no `.secrets/` ma non ne ha bisogno (no auth keys nel design system).

### Secret scanning stato

Per repo public, secret scanning è **attivo by default e gratuito**. Verifica:

```bash
gh api repos/Spen-Zosky/heuresys-advanced --jq '.security_and_analysis'
# Per i public, di solito mostra null o objects con default
```

Per attivare/verificare via Web UI: `Settings → Code security → Secret scanning` (sezione potrebbe variare). Per public, le opzioni "Receive alerts" e "Push protection" sono entrambe attivabili gratis.

### Push protection (raccomandazione: attivare)

Push protection blocca il push se rileva un secret pattern noto. Senza, devi pulire **dopo** che il secret è già su GitHub.

Per attivare:
```
Settings → Code security → Secret scanning → Push protection: enabled
```

(Solo gratis per public repo + Enterprise).

### File potenzialmente sensibili nei nostri repo

```bash
# heuresys-advanced — verifica
git -C /d/heuresys-advanced log --all --pretty=format: --name-only --diff-filter=A | \
  grep -iE '\.env|\.secret|\.key|\.pem' | sort -u
```

Output atteso: `.env.example` (template ok), nessun `.env` reale, nessuna chiave PEM. ✅

```bash
# ux-design-shared — verifica
git -C /d/ux-design-shared log --all --pretty=format: --name-only --diff-filter=A | \
  grep -iE '\.env|\.secret|\.key|\.pem'
```

Output atteso: niente. ✅

---

## 4. Comandi / checklist

### Setup `.gitignore` per progetto nuovo

```bash
# Genera template (Node + IDE comuni)
curl -s "https://www.toptal.com/developers/gitignore/api/node,visualstudiocode,intellij" > .gitignore

# Aggiungi le tue righe (env, secrets, ecc.)
cat >> .gitignore <<'EOF'

# Project secrets
.env
.env.local
.env.*.local
.secrets/
*.pem
*.key
EOF

git add .gitignore
git commit -m "chore: gitignore"
```

### Audit dei secret in repo esistente

```bash
# 1. Grep nei file tracked per pattern sospetti
git ls-files | xargs grep -lE "BEGIN PRIVATE KEY|password\s*=|aws_access_key|api[_-]?key" 2>/dev/null

# 2. Grep nei messaggi di commit
git log --all --grep="password\|secret\|key" --oneline

# 3. Grep nei diff completi (lento)
git log --all -p | grep -iE "password\s*=|sk-[a-z0-9]{20,}"

# 4. Usa tool dedicato (gitleaks)
# Install: brew install gitleaks (Mac) / scoop install gitleaks (Win)
gitleaks detect --source . --verbose
gitleaks detect --source . --log-opts="--all" --verbose  # tutta la storia
```

### Bonifica di un secret leakato (post-commit)

```bash
# Step 1: ROTARE IL SECRET IMMEDIATAMENTE
# Es. revoke il GitHub PAT, ruota la AWS key, change la password DB.
# Questa è LA cosa più importante. Tutti gli altri step sono cosmetici.

# Step 2 (opzionale): rimuovi il file dalla storia
# Usa git-filter-repo (più moderno di git filter-branch)
pip install git-filter-repo
git filter-repo --invert-paths --path .env

# Step 3: force push
git push --force --all

# Step 4: avvisa i collaborator di re-clonare il repo
# Step 5: chiudi gli Alert in Secret scanning come "Revoked"
```

⚠️ Note importanti:
- **Force push su public repo riscrive la storia condivisa**. Tutti i fork esistenti restano con i vecchi commit.
- **Mirror/caches** di GitHub (e di terze parti) possono ancora avere il segreto. La rotazione è l'unica vera bonifica.

### Verifica push protection blocca un secret di test

```bash
# Crea un commit di test con un fake AWS key (formato valido ma fake)
echo "AKIAIOSFODNN7EXAMPLE" > test-secret.txt
git add test-secret.txt
git commit -m "test: should be blocked"

# Prova il push
git push origin HEAD
# Atteso: "remote: error: GH013: Repository rule violations found for refs/heads/main."
# Atteso: "remote: - GITHUB PUSH PROTECTION"

# Cleanup (no push)
git reset --hard HEAD~1
```

### Configurare GitHub Apps webhook per alert dedicati

Per ricevere notifiche Slack/email su Alert secret scanning:
```
Settings → Notifications → Code security → ✓ Secret scanning alerts
```

Oppure setup webhook su `secret_scanning_alert` event con relay verso Slack/Discord.

### Checklist secret hygiene

- [ ] `.gitignore` aggiornato per `.env`, `*.pem`, `*.key`, `.secrets/`.
- [ ] `.env.example` committato come template (con valori placeholder, mai reali).
- [ ] Secret scanning ✓ attivo (Settings → Code security).
- [ ] Push protection ✓ attiva.
- [ ] Notifications ✓ abilitate (alert via email).
- [ ] Audit storico con gitleaks o `git filter-repo --analyze`.
- [ ] Per ogni secret committato in passato: rotato? alert risolto?

---

## 5. Trappole comuni

- **`.env` in gitignore ma già committato**: gitignore non rimuove file già tracciati. Soluzione: `git rm --cached .env && git commit`.
- **Lock file con credenziali**: alcuni lock file (`yarn.lock` con private registry) contengono URL con token. Audit dopo `yarn install` su nuova macchina.
- **`docker-compose.yml` con password inline**: pattern frequente. Sposta in `.env`.
- **`.npmrc` con `_authToken=` committato**: tipico errore. Usa `_authToken=${NPM_TOKEN}` (env var) e mai inline.
- **`config.json` con API keys**: anti-pattern Java/Python. Tieni config separate (filename con `.local` o `.private`).
- **CI secret leakato in log** (es. `echo $TOKEN`): GitHub maschera `${{ secrets.X }}` ma se manipoli (base64, slice, ecc.) il derivato non è mascherato. Vedi `03-secrets-e-variabili.md`.
- **Stessa password riusata in più posti**: una rotazione richiede coordinazione cross-repo/cross-service. Usa password manager per scoprire i posti che dovrai aggiornare.
- **`.gitignore` solo nel root**: se hai sub-directory con `.gitignore` proprio (e.g. workspace pnpm), verifica entrambi.
- **GitHub Pages hostando un sito che expose path con secret**: es. una pagina HTML che fa `fetch('/secret-config.json')` — quel JSON è pubblicamente leggibile. Tutto ciò che Pages serve è public.

---

## 6. Per approfondire

- **About secret scanning**: <https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning>
- **Push protection**: <https://docs.github.com/en/code-security/secret-scanning/working-with-secret-scanning-and-push-protection>
- **Supported patterns**: <https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns>
- **Removing sensitive data**: <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository>
- **gitleaks**: <https://github.com/gitleaks/gitleaks>
- **git-filter-repo**: <https://github.com/newren/git-filter-repo>
- File curriculum: [02-dependabot.md](02-dependabot.md) · [03-code-scanning.md](03-code-scanning.md) · [03-automazione/03-secrets-e-variabili.md](../03-automazione/03-secrets-e-variabili.md)
