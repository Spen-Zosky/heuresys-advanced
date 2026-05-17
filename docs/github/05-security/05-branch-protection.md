# 05.5 · Branch protection / Rulesets

> **Branch protection rules** (vecchia versione) e **Rulesets** (versione moderna) sono il meccanismo per imporre regole sui branch: richiedere PR, status check, review, no force-push, no delete. Sono la base di un workflow "safe" e prerequisito di tutta l'automation di security.

---

## 1. Concetto

GitHub ha **2 sistemi paralleli**:

| Sistema | Stato | Usalo per |
|---|---|---|
| **Classic Branch protection rules** | Legacy ma ancora supportato | Setup semplici, retro-compatibilità |
| **Rulesets** | Moderno, raccomandato | Nuovi setup, pattern multi-branch, più granularità |

Per setup nuovi → **Rulesets**. Sintetizzo solo questi.

### Anatomia di un Ruleset

Un Ruleset ha:
- **Name** (es. "Protect main")
- **Target**: a quali branch si applica (specifici, wildcard `release/*`, o all)
- **Enforcement**: `Active` / `Disabled` / `Evaluate` (test-only, no enforce)
- **Bypass list** (opzionale): chi può bypassare la rule (organization admins / specific actors)
- **Rules** (le restrizioni):
  - `Restrict deletions` — blocca `git push --delete`
  - `Block force pushes` — blocca `git push --force`
  - `Require linear history` — blocca merge commit (force squash/rebase)
  - `Require deployments to succeed` — gating su environment
  - `Require signed commits` — vedi `04-signed-commits.md`
  - `Require a pull request before merging`:
    - Number of approvals (0-6)
    - Dismiss stale approvals on push
    - Require Code Owners review (richiede file `CODEOWNERS`)
    - Allow specific actors to bypass
  - `Require status checks to pass`:
    - Lista di check name (es. "CI / build", "CodeQL")
    - Strict mode (richiede check su HEAD del branch, non solo PR)
  - `Require code scanning results` — alert critical non-superati bloccano
  - `Block creations` — blocca creazione branch matching il pattern

### Tier disponibile

- **Free public**: tutte le rule, illimitato.
- **Free private**: solo rule di base (no required reviewers, no Code Owners).
- **Team/Enterprise**: tutto.

I nostri repo public → niente limiti.

---

## 2. Modello mentale

```
                       git push (or PR merge)
                              │
                              ▼
                       ┌──────────────────┐
                       │  Ruleset matches │
                       │  the branch?     │
                       └────────┬─────────┘
                                │ yes
                                ▼
                       ┌──────────────────┐
                       │ Run all rules    │
                       │  - PR required?  │
                       │  - approvals?    │
                       │  - status checks?│
                       │  - signed?       │
                       │  - linear?       │
                       └────────┬─────────┘
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
            ┌──────────┐               ┌──────────┐
            │  ALL PASS│               │  ANY FAIL│
            └────┬─────┘               └────┬─────┘
                 │                          │
                 ▼                          ▼
            push accepted              push BLOCKED
                                       (or PR un-mergeable)
```

---

## 3. Applicato ai nostri repo

### Stato attuale: **nessuna rule attiva**

| Repo | Ruleset | Branch protection legacy |
|---|---|---|
| `heuresys-advanced` | 0 | 0 |
| `ux-design-shared` | 0 | 0 |

Tutti i push diretti su `main` sono permessi. Force push, delete, force squash sopra HEAD, tutto consentito. Per un sole-coder è OK ma rischioso (un `git push --force` sbagliato cancella la storia).

### Proposta progressiva di rule

**Tier 1 — sicurezza minima (raccomandato ora)**

Anche per sole-coder, vale la pena attivare le 2 rule sotto, che proteggono da incidenti del dito:

```
Ruleset: "Protect main from accidents"
Target: refs/heads/main
Enforcement: Active
Rules:
  ✓ Restrict deletions          (blocca git push --delete main)
  ✓ Block force pushes          (blocca git push --force main)
Bypass: nessuno
```

Effetto: tu puoi ancora pushare commit normali, ma non puoi accidentalmente force-push o delete main. Costo: 0 friction quotidiana.

**Tier 2 — quando attiverai CI**

Quando avrai `ci.yml` attivo:

```
Ruleset: "main requires CI"
Target: refs/heads/main
Enforcement: Active
Rules:
  ✓ Block force pushes
  ✓ Restrict deletions
  ✓ Require status checks to pass:
    - "CI / build-and-test"      ← name del job nel workflow
    Strict: yes
Bypass: nessuno
```

Effetto: ogni commit pushato su main richiede CI verde sul HEAD. Per ora il workflow `ci.yml` non esiste, quindi attiva dopo.

**Tier 3 — quando arriverà un secondo dev**

```
Ruleset: "main protected"
Target: refs/heads/main
Enforcement: Active
Rules:
  ✓ Restrict deletions
  ✓ Block force pushes
  ✓ Require linear history    (force squash/rebase, no merge commit)
  ✓ Require a pull request before merging:
    Number of approvals: 1
    Dismiss stale approvals on push: yes
  ✓ Require status checks:
    - "CI / build-and-test"
    - "CodeQL"
    - "Lint"
    Strict: yes
  ✓ Require code scanning results to pass
Bypass: nessuno (o solo admin in emergenza)
```

Effetto: niente più push diretti su main. Tutto via PR + approvazione + CI verde + scan pulito.

### `CODEOWNERS` file

Per Tier 3, `Require Code Owners review` richiede `.github/CODEOWNERS`:

```
# Tutti i file richiedono review di Spen-Zosky
*  @Spen-Zosky

# Path specifici hanno owner specifici (con 2+ dev)
/apps/api/  @backend-lead
/apps/web/  @frontend-lead
/db/        @dba-lead
/docs/      @Spen-Zosky
```

Quando un PR tocca un path con owner, GitHub auto-requesta la review di quella persona.

---

## 4. Comandi / checklist

### Creare un Ruleset via Web UI

```
Settings → Rules → Rulesets → New ruleset → New branch ruleset
  Name: "Protect main"
  Enforcement status: Active
  Target branches:
    + Include default branch
  Rules: spunta quelle desiderate
  Save changes
```

### Tramite REST API (gh CLI)

```bash
# Tier 1: minimum protection
gh api -X POST repos/Spen-Zosky/heuresys-advanced/rulesets \
  -F 'name=Protect main from accidents' \
  -F 'target=branch' \
  -F 'enforcement=active' \
  -F 'conditions[ref_name][include][]=refs/heads/main' \
  -F 'rules[][type]=deletion' \
  -F 'rules[][type]=non_fast_forward'
```

> `non_fast_forward` blocca force push. `deletion` blocca delete. La sintassi -F è limitata; per ruleset complessi è più semplice un body JSON via `--input`.

```bash
# Lista
gh api repos/Spen-Zosky/heuresys-advanced/rulesets --jq '.[] | {id, name, enforcement}'

# View specifico
gh api repos/Spen-Zosky/heuresys-advanced/rulesets/<ID>

# Disable temporaneamente
gh api -X PATCH repos/Spen-Zosky/heuresys-advanced/rulesets/<ID> \
  -F 'enforcement=evaluate'

# Delete
gh api -X DELETE repos/Spen-Zosky/heuresys-advanced/rulesets/<ID>
```

### Branch protection classic (alternativa)

```bash
gh api -X PUT repos/Spen-Zosky/heuresys-advanced/branches/main/protection \
  -F 'required_status_checks=null' \
  -F 'enforce_admins=false' \
  -F 'required_pull_request_reviews=null' \
  -F 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

Più semplice ma legacy. Preferire Rulesets per setup nuovi.

### Test di una rule

Prima di attivare `Active`, usa `Evaluate` mode:

```
Enforcement: Evaluate
```

Il push procede ma viene loggato come "would have been blocked". Vedi i log in `Settings → Rules → Rulesets → Insights`.

### Checklist branch protection

- [ ] Crea Ruleset Tier 1 (block force-push + deletion) ora.
- [ ] Verifica funziona: `git push --force` deve fallire.
- [ ] (Quando attiverai CI) Aggiungi `Require status checks`.
- [ ] (Quando arriverà 2° dev) Aggiungi `Require PR` + approvals.
- [ ] (Opzionale) `CODEOWNERS` file in `.github/` per auto-request review.
- [ ] (Opzionale) `Require signed commits` quando hai signing setup.
- [ ] Documenta le rule in `CONTRIBUTING.md`.

---

## 5. Trappole comuni

- **Rule che blocca te per sbaglio**: se `enforce_admins: true` la rule vale anche per gli admin. Lascia `false` finché non sei sicuro.
- **Bypass list dimenticata**: senza bypass, anche l'admin owner del repo è vincolato. Setup almeno te stesso in bypass per le rule "soft" (es. `Require PR`).
- **Status check name mismatch**: il nome del check **deve combaciare esattamente** quello mostrato nella tab `Actions`. Es. il job `build-and-test` in workflow `ci` apparirà come "CI / build-and-test". Sbagliarlo = il check non viene mai considerato "passato".
- **Strict mode + branch divergente**: con `strict: true`, il PR richiede che il branch sia aggiornato con `main` prima del merge. Se main avanza durante la review, devi rebase il PR.
- **`Require linear history` + GitHub merge commit**: incompatibili. Disabilita "Allow merge commit" sulla repo (settings/Pull Requests).
- **Rule wildcard troppo aggressiva**: `refs/heads/*` blocca **tutti** i branch incluso feature branch. Limita a `refs/heads/main` + `refs/heads/release/*`.
- **Code scanning required ma alert pre-esistenti**: se attivi `Require code scanning results to pass` con alert "open" già esistenti, **tutti i merge sono bloccati**. Fixa o dismissi gli alert prima.
- **Required signed commits su contributor senza GPG**: blocca tutti i loro PR. Documenta in CONTRIBUTING + assistili nel setup.

---

## 6. Per approfondire

- **About Rulesets**: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets>
- **Creating a ruleset**: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository>
- **Available rule types**: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets>
- **CODEOWNERS syntax**: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners>
- **Legacy branch protection** (per confronto): <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>
- File curriculum: [02-collaborazione/02-branches.md](../02-collaborazione/02-branches.md) · [03-pull-requests.md](../02-collaborazione/03-pull-requests.md) · [03-code-scanning.md](03-code-scanning.md) · [04-signed-commits.md](04-signed-commits.md)
