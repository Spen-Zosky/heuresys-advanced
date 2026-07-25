# 07.2 · `Spen-Zosky/heuresys-advanced` — deep dive

> Tutto ciò che riguarda specificamente il repo principale: settings consigliati, secrets necessari quando attiverai il CI, branch model proposto per evoluzione futura, prossimi step prioritizzati.

---

## 1. Identità del repo

| Attributo | Valore |
|---|---|
| Owner | Spen-Zosky (personal) |
| Visibility | public |
| URL | <https://github.com/Spen-Zosky/heuresys-advanced> |
| Created | 2026-05-16 |
| Default branch | `main` |
| Description | Heuresys Advanced HRMS/BPM Platform v5 — pnpm monorepo... |
| Homepage | _(vuoto)_ |
| Topics | _(vuoti)_ |
| License | _(assente)_ |
| Wiki | enabled (vuoto) |
| Issues / PR | enabled (mai usati) |
| Discussions | disabled |
| Pages | disabled |
| Workflow Actions | nessuno |

Fonte verificata 2026-05-17: vedi `01-stato-corrente.md`.

---

## 2. Settings consigliati (gh CLI batch)

Cose che potresti fare in 5 minuti per allineare il repo alle best practice:

```bash
# 1. Topics — discoverability
gh repo edit Spen-Zosky/heuresys-advanced \
  --add-topic hrms \
  --add-topic bpm \
  --add-topic fastify \
  --add-topic nextjs \
  --add-topic postgresql \
  --add-topic typescript \
  --add-topic monorepo \
  --add-topic pnpm

# 2. Wiki — disabilita (uso docs/** invece)
gh repo edit Spen-Zosky/heuresys-advanced --enable-wiki=false

# 3. Discussions — abilita (per future Q&A)
gh repo edit Spen-Zosky/heuresys-advanced --enable-discussions=true

# 4. Merge strategies — solo squash (storia pulita)
gh repo edit Spen-Zosky/heuresys-advanced \
  --allow-merge-commit=false \
  --allow-squash-merge=true \
  --allow-rebase-merge=true \
  --delete-branch-on-merge=true

# 5. Branch protection Tier 1 — anti-accidente (Ruleset)
# Vedi 05-security/05-branch-protection.md per JSON body
```

---

## 3. Secrets futuri (quando attiverai CI)

Servono quando aggiungerai `.github/workflows/ci.yml` + test integration con DB.

| Secret | Scope | Cosa contiene | Rotazione |
|---|---|---|---|
| `POSTGRES_PASSWORD` | repo | Password del Postgres CI (service container o managed) | Ogni 90 gg |
| `JWT_PRIVATE_KEY` | repo | RSA private key per JWT signing nei test | Mai (test-only, può essere generato per run) |
| `JWT_PUBLIC_KEY` | repo | Idem, public | Idem |
| `COOKIE_SECRET` | repo | 48-byte base64 random | Mai (test-only) |
| `TEST_ADMIN_PASSWORD` | repo | Override default `<TEST_ADMIN_PASSWORD>` | Mai (test-only) |

Per il deploy production (se mai):
| Secret | Scope | Note |
|---|---|---|
| `POSTGRES_PROD_URL` | environment `production` | Connection string DB prod |
| `JWT_PROD_PRIVATE_KEY` | environment `production` | NON committare mai. Generata in vault esterno |
| `DEPLOY_SSH_KEY` | environment `production` | Per push a OCI VM |
| `OCI_API_KEY` | environment `production` | Se uso OCI SDK in deploy script |

---

## 4. Branch model proposto

Stato oggi: trunk-based con commit diretti su `main`.

Evoluzione consigliata in 3 stadi:

### Stadio A — oggi (sole-coder)

```
main: ──────────────────────────────►  (commit diretti)
```

OK perché sei sole-coder + memorizzi il context in `HANDOFF.md`/`MEMORY.md`. Niente PR, niente CI gating.

### Stadio B — aggiungi CI gating (quando avrai `ci.yml`)

```
main: ──── CI verde ─── push permesso ──►
            ↓
       fail = blocco
```

Setup:
1. Crea `.github/workflows/ci.yml` (vedi `03-automazione/02-actions-ricette.md`).
2. Aspetta che ci sia un run verde.
3. Crea Ruleset:
   ```
   Target: refs/heads/main
   Require status check: "CI / build-and-test"
   Strict mode: yes
   ```

Effetto: ogni push su `main` deve passare CI. Push di un commit che rompe i test → fallisce.

### Stadio C — workflow PR-based (quando arriverà 2° dev)

```
feat/x: ──────────► PR aperto ──► review + CI ──► squash merge ──► main
main:                                              ↓
                                                resa lineare
```

Setup:
1. Stadio B già attivo.
2. Ruleset aggiornato:
   ```
   ✓ Require PR before merging
     Approvals required: 1
     Dismiss stale approvals on push
   ✓ Require linear history
   ✓ Require status check (CI)
   ```
3. Aggiungi `.github/pull_request_template.md`.
4. Aggiungi `CODEOWNERS` se vuoi auto-request review.
5. Documenta in `CONTRIBUTING.md`.

Effetto: niente più push diretti su `main`. Tutto via PR.

---

## 5. Workflow CI proposto (preview)

File `.github/workflows/ci.yml` (riferimento dettagliato in `03-automazione/02-actions-ricette.md`):

```yaml
name: CI

on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:

permissions: { contents: read }

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    name: Build + typecheck + test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: heuresys_advanced
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - name: DB migrate
        run: pnpm db:migrate:sh
        env:
          POSTGRES_HOST: localhost
          POSTGRES_PORT: 5432
          POSTGRES_PASSWORD: testpass
      - name: Seed
        run: pnpm db:seed-test-admin
      - name: Typecheck
        run: pnpm typecheck
      - name: Test API
        run: pnpm --filter @heuresys/api test
```

Tempo stimato: ~5 min (install pnpm 88 deps + 28 migration + 203 vitest).

---

## 6. Prossimi step prioritizzati

| Priorità | Step | Effort | Rationale |
|---|---|---|---|
| P0 | Aggiungi 5-8 topics | 2 min | Discoverability immediata |
| P0 | Aggiungi LICENSE (anche "All rights reserved" inline) | 5 min | Default "no permission" è confusionale |
| P1 | Crea Ruleset Tier 1 (block force push + delete) | 3 min | Anti-incidente del dito |
| P1 | Abilita Dependabot Alerts + Security updates | 1 click | Gratis, alta sicurezza |
| P2 | Crea `.github/dependabot.yml` con Version updates | 10 min | Per ricevere PR di update settimanali |
| P2 | Crea `.github/workflows/ci.yml` (anche solo typecheck) | 15 min | Primo CI verde |
| P2 | Crea `.github/workflows/codeql.yml` | 5 min | Free security scan |
| P3 | Disabilita Wiki | 1 click | Pulisce la UI |
| P3 | Abilita Discussions (per future) | 1 click | Niente attivo finché non serve |
| P3 | Setup signed commits (SSH) | 15 min | Cosmetic ma professional |
| P4 | Quando MVP-3 chiude: tag `v1.0.0` + GitHub Release | 5 min | Marca milestone pubblico |

P0 sono le cose "perché no?". P1 sono le cose alta-sicurezza zero-effort. P2 sono setup automation. P3 sono nice-to-have. P4 sono triggered da eventi specifici.

---

## 7. Cose che NON consiglio di fare ora

- **Pages**: il backend richiede un DB live. Pages = solo static. Per pubblicare la SPA `apps/web` serve anche un backend pubblico — out of scope ora.
- **GitHub Packages**: niente da pubblicare ora. Il design system vive nell'altro repo.
- **Organization**: i 2 repo stanno bene sotto `Spen-Zosky`. Crea un'org solo se aggiungi un contributor o vuoi separare l'identità `Heuresys`.
- **Branch protection Tier 2/3**: solo trunk-based con CI è il giusto livello per sole-coder. Aggiungi PR-required + Code Owners solo quando arriverà un secondo dev.
- **Custom domain Pages**: niente Pages → niente custom domain.
- **GitHub Sponsors**: out of scope (richiede setup payment + audience).

---

## 8. Per approfondire

- `07.1` [`01-stato-corrente.md`](01-stato-corrente.md) — snapshot tecnico verificabile
- `07.3` [`03-ux-design-shared.md`](03-ux-design-shared.md) — deep dive sull'altro repo
- `07.4` [`04-interazioni-tra-repo.md`](04-interazioni-tra-repo.md) — come i 2 repo si parlano
- `08` [`../08-roadmap.md`](../08-roadmap.md) — sequenza temporale consigliata per attivazione feature
