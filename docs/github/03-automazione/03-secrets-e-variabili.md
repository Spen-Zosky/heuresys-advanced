# 03.3 · Secrets, variables, environments, OIDC

> Tre meccanismi per passare configurazione + credenziali ai workflow: **secrets** (cifrati, sensibili), **variables** (chiari, non-sensibili), **environments** (namespace di entrambi con approvazioni opzionali). OIDC è il pattern moderno per autenticarsi a cloud provider senza secret long-lived.

---

## 1. Concetto

### Secrets

Variabili cifrate gestite da GitHub. Disponibili nei workflow come `${{ secrets.NAME }}`.

Caratteristiche:
- **Mai loggati**: GitHub maschera automaticamente i secret nei log (`***`).
- **Cifrati at rest** con libsodium; decifrabili solo dal runner durante l'esecuzione.
- **Scope** a tre livelli:
  1. **Repository secrets** (visibili a tutti i workflow del repo).
  2. **Environment secrets** (visibili solo a workflow targeted a quell'environment).
  3. **Organization secrets** (per org account, condivisi cross-repo).

### Variables

Come i secrets ma in **chiaro** (non cifrate, visibili nei log se stampate). Usati per config non-sensibile.

```yaml
env:
  API_BASE_URL: ${{ vars.API_BASE_URL }}
```

Stesso scope dei secrets (repo / environment / org).

### Environments

**Namespace** di secrets + variables + protection rules. Tipici: `staging`, `production`, `preview`.

Caratteristiche:
- **Protection rules**:
  - Required reviewers (max 6) — manual approval prima di poter deployare.
  - Wait timer — delay tra trigger e esecuzione (per cancel di emergency).
  - Deployment branches — solo certi branch possono deployare in questo env.
- **Deployment history** — UI di tracking per env.
- **Status URL** — link visibile nella UI quando il deploy è in progress/done.

```yaml
jobs:
  deploy-prod:
    environment:
      name: production
      url: https://heuresys.com
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying with $API_KEY"
        env:
          API_KEY: ${{ secrets.PROD_API_KEY }}
```

### OIDC (OpenID Connect)

Pattern moderno per autenticarsi a cloud provider (AWS, GCP, Azure, OCI) **senza secret long-lived**. GitHub Actions diventa un OIDC identity provider; il cloud trustea il token JWT short-lived emesso dal workflow.

Vantaggi:
- No `AWS_ACCESS_KEY` da rotare.
- Token valido solo per la singola esecuzione.
- Trust granulare per repo/branch/environment.

Esempio AWS:

```yaml
permissions:
  id-token: write           # serve per OIDC
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-role
          aws-region: eu-west-1
      - run: aws s3 ls
```

Il setup richiede su AWS: creare un OIDC provider + IAM role con trust policy che accetta token GitHub Actions del tuo repo.

---

## 2. Modello mentale

```
   ┌──────────────────────────────────────────────────────────┐
   │                  GITHUB                                  │
   │                                                          │
   │  Repo secrets/vars  Env secrets/vars (production)        │
   │       │                       │                          │
   │       │                       │  approvazione richiesta? │
   │       ▼                       ▼                          │
   │  ┌─────────────────────────────────────────────┐         │
   │  │             WORKFLOW                        │         │
   │  │   ${{ secrets.FOO }}                        │         │
   │  │   ${{ vars.BAR }}                           │         │
   │  │   id-token: write  → JWT short-lived ──────►│         │
   │  └─────────────────────────────────────────────┘         │
   │                                       │ JWT              │
   └───────────────────────────────────────┼──────────────────┘
                                           ▼
                              ┌─────────────────────────┐
                              │ Cloud Provider          │
                              │ (AWS / GCP / Azure)     │
                              │ Trust policy → assume   │
                              │ short-lived role        │
                              └─────────────────────────┘
```

---

## 3. Applicato ai nostri repo

### Stato attuale

| Repo | Repository secrets | Variables | Environments |
|---|---|---|---|
| `heuresys-advanced` | 0 (nessun workflow attivo) | 0 | 0 |
| `ux-design-shared` | 0 (workflow Storybook usa solo `GITHUB_TOKEN` di default) | 0 | 1 implicito: `github-pages` (creato automaticamente da `actions/deploy-pages`) |

### Secrets che servirebbero per attivare un CI completo su `heuresys-advanced`

Quando attiverai il workflow `ci.yml` con test integration contro DB:

| Secret | Scope | Cosa contiene |
|---|---|---|
| `POSTGRES_PASSWORD` | repo | Password per il Postgres CI (service container) |
| `JWT_PRIVATE_KEY` | repo | RSA key per generare JWT nei test (oppure si rigenera per run) |
| `COOKIE_SECRET` | repo | Secret 48-byte per i cookie session |
| `TEST_ADMIN_PASSWORD` | repo | Override del default `Admin#PassW0rd!` se diverso in CI |

Per ora **nessuno** è in CI perché `.env` locale + tunnel SSH coprono lo sviluppo. Quando il CI partirà, va deciso se replicare la VM OCI o usare Postgres service container con seed locale.

### Secrets per release npm di `ux-design-shared` (futuro)

Per pubblicare `@spen-zosky/ui` su npm (GitHub Packages):

| Secret | Scope | Cosa contiene |
|---|---|---|
| `NPM_TOKEN` o (meglio) `GITHUB_TOKEN` con `packages:write` | repo | Token publish |

GitHub Packages usa di norma `GITHUB_TOKEN` automatico — niente secret manuale.

### Environments proposti (per uso futuro)

`heuresys-advanced`:
- **`staging`**: deploy automatico su push su `main`. Protection: nessuna.
- **`production`**: deploy manuale (`workflow_dispatch`). Protection: required reviewer (te stesso), deployment branches: solo `main` + tag `v*`.

`ux-design-shared`:
- **`github-pages`** (esistente, gestito da `actions/deploy-pages`).
- **`npm`** (per release): protection con required reviewer.

---

## 4. Comandi / checklist

### Repository secrets — CLI

```bash
# Lista (mostra solo i nomi, non i valori)
gh secret list --repo Spen-Zosky/heuresys-advanced

# Crea/aggiorna
gh secret set POSTGRES_PASSWORD --repo Spen-Zosky/heuresys-advanced
# poi inserisci il valore al prompt (non appare nei log shell)

# Da file (per chiavi PEM)
gh secret set JWT_PRIVATE_KEY < .secrets/jwt_private.pem

# Elimina
gh secret delete POSTGRES_PASSWORD --repo Spen-Zosky/heuresys-advanced
```

### Variables — CLI

```bash
gh variable set API_BASE_URL --body "https://api.heuresys.com" --repo Spen-Zosky/heuresys-advanced
gh variable list --repo Spen-Zosky/heuresys-advanced
gh variable delete API_BASE_URL --repo Spen-Zosky/heuresys-advanced
```

### Environments — Web UI (CLI limitato)

```
Settings → Environments → New environment → "staging"
  → Required reviewers: @Spen-Zosky
  → Wait timer: 0 minutes
  → Deployment branches: Selected branches → main
  → Environment secrets: DEPLOY_KEY
  → Environment variables: STAGING_URL
```

Via gh CLI puoi solo listare/leggere:
```bash
gh api repos/Spen-Zosky/heuresys-advanced/environments
gh api repos/Spen-Zosky/heuresys-advanced/environments/production/secrets
```

### Usare un secret nel workflow

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST https://api.heuresys.com/deploy \
            -H "Authorization: Bearer $TOKEN"
        env:
          TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

⚠️ **Mai** in stringa interpolata diretta:
```yaml
# SBAGLIATO — secret nel run script, mascherato ma facilmente leakable
- run: curl -H "Authorization: ${{ secrets.DEPLOY_TOKEN }}" ...

# GIUSTO — secret in env var, GitHub mask + non appare nel comando
- run: curl -H "Authorization: Bearer $TOKEN" ...
  env:
    TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

### OIDC setup AWS (esempio)

1. Su AWS, crea OIDC provider:
   ```
   Provider URL: https://token.actions.githubusercontent.com
   Audience: sts.amazonaws.com
   ```

2. Crea IAM role con trust policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringLike": {
           "token.actions.githubusercontent.com:sub": "repo:Spen-Zosky/heuresys-advanced:*"
         },
         "StringEquals": {
           "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
         }
       }
     }]
   }
   ```

3. Nel workflow:
   ```yaml
   permissions:
     id-token: write
     contents: read
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: aws-actions/configure-aws-credentials@v4
           with:
             role-to-assume: arn:aws:iam::ACCOUNT:role/github-actions-role
             aws-region: eu-west-1
   ```

Pattern identico per GCP (`google-github-actions/auth`) e Azure (`azure/login`).

### Checklist secrets management

- [ ] Lista secret necessari per repo.
- [ ] Usa secret separati per staging vs production (environment-scoped).
- [ ] Documenta i secret nel README (nome + scopo, **mai** valore).
- [ ] Setup rotation periodica (≥1 anno).
- [ ] Audit periodico (`gh secret list` → quali ancora servono?).
- [ ] Prefer OIDC sopra secret long-lived dove possibile.

---

## 5. Trappole comuni

- **Secret leakato in log custom**: GitHub maschera `${{ secrets.X }}` ma se manipoli il secret (base64, split, ecc.), il derivato non è mascherato. Usa `::add-mask::` directive:
  ```bash
  ENCODED=$(echo $SECRET | base64)
  echo "::add-mask::$ENCODED"
  ```

- **PR da fork con secret**: per default, PR da fork **non hanno accesso ai secret** (security against malicious contributors). Usa `pull_request_target` con cautela se serve.

- **Variable vs Secret quando non serve**: regola di pollice — se la stringa è OK in un Issue pubblico, è Variable. Altrimenti è Secret.

- **`GITHUB_TOKEN` con scope sbagliato**: il token automatico ha permission che dichiari in `permissions:`. Se ometti, il default cambia per repo (Settings → Actions → Workflow permissions). Sempre dichiarare esplicitamente.

- **Environment senza protection rule = solo namespace**: Environment "production" senza required reviewers + deployment branches è inutile per audit. Aggiungi sempre almeno 1 protection.

- **OIDC trust policy troppo aperta**: `sub: "repo:Spen-Zosky/*"` permette a qualsiasi repo tuo di assumere il role. Restringi a `sub: "repo:Spen-Zosky/heuresys-advanced:ref:refs/heads/main"` se possibile.

- **Secret in `.env.example`**: il file `.env.example` deve avere solo placeholder (`POSTGRES_PASSWORD=changeme`), mai i valori reali. Errore comune.

- **Secret in matrix expansion**: come per i secret in `run:`, anche `matrix.foo` con secret risulta loggato. Workaround: tieni i secret fuori dalla matrix, accedili sempre via `secrets.X`.

---

## 6. Per approfondire

- **Secrets**: <https://docs.github.com/en/actions/security-guides/encrypted-secrets>
- **Variables**: <https://docs.github.com/en/actions/learn-github-actions/variables>
- **Environments**: <https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment>
- **OIDC overview**: <https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect>
- **OIDC AWS guide**: <https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services>
- **Security hardening for GitHub Actions**: <https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions>
- File curriculum: [02-actions-ricette.md](02-actions-ricette.md) · [04-workflow-storybook.md](04-workflow-storybook.md) · [05-security/01-secret-hygiene.md](../05-security/01-secret-hygiene.md)
