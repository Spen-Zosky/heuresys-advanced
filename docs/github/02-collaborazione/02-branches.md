# 02.2 · Branches e branching model

> Un branch è solo un puntatore a un commit. Ma le **convenzioni** su come usarli determinano come scala il progetto. Esistono modelli classici (Git Flow, GitHub Flow, trunk-based) — capire quale stai usando aiuta a decidere quando evolverlo.

---

## 1. Concetto

In git, un `branch` è un riferimento mobile a un commit. Tre branch family classiche:

### Long-lived branches
Vivono indefinitamente. Tipici: `main`, `develop`, `staging`, `production`.

### Short-lived branches
Creati per una specifica unità di lavoro, mergiati e cancellati. Tipici:
- `feature/<descrizione>` o `feat/<descrizione>`
- `fix/<descrizione>` o `bugfix/<descrizione>`
- `chore/<descrizione>`
- `hotfix/<descrizione>` (urgente da production)
- `docs/<descrizione>`

### Release branches
Branch temporanei per stabilizzare una release prima di tag. Tipici: `release/v1.0`.

### Branching model più diffusi

| Modello | Descrizione | Quando ha senso |
|---|---|---|
| **GitHub Flow** | Solo `main` + short-lived branch per ogni cambio · PR · merge in main · deploy continuo | Team piccoli/medi, deploy continuo, SaaS |
| **Trunk-based development** | `main` è sempre deployable · commit diretti su main (con feature flag) o branch <24h | Team disciplinati con eccellente CI |
| **Git Flow (classico)** | `main` (prod), `develop` (next), `feature/*`, `release/*`, `hotfix/*` | Software con release periodica (es. desktop, mobile app store) |
| **Trunk + release branches** | `main` + branch persistenti per major (`v1.x`, `v2.x`) | Library SDK con LTS multipli |

Per i progetti GitHub-hosted moderni la stragrande maggioranza usa **GitHub Flow** o **trunk-based**. Git Flow è considerato pesante.

---

## 2. Modello mentale

```
GitHub Flow (semplice, recommended per la maggior parte dei casi):

  main:   A───B───C─────────G───H───I
                   \       /
   feature/x:       D─E─F─/   (merged via PR)


Trunk-based con feature flag:

  main:   A───B───C───D───E───F   (all branches die <1 day)
              ↑       ↑
              dietro feature flag in produzione


Git Flow (più complesso, raramente necessario):

  main (prod):       A───────────M1──────────M2───
                     │            │            │
  release/v1.0:               R1──┘            │
                              │                │
  develop:           B───C───D───E───F───G───H─┘
                         │       │
  feature/x:             X1──X2──┘
                         │
  hotfix/critical:                M1───MH1───MH2  (back to main + develop)
```

---

## 3. Applicato ai nostri repo

### Stato attuale: **GitHub Flow degenerato** (no PR)

Entrambi i repo usano **solo `main`**, niente feature branch, niente PR. È trunk-based + commit diretti.

Branch presenti oggi:
```
heuresys-advanced:
  * main
    remotes/origin/main

ux-design-shared:
  * main
    remotes/origin/main
```

Funziona perché:
1. Sole-coder.
2. CI minimale (solo Storybook deploy su `ux-design-shared`, nessun gating).
3. Commit messages strutturati (Conventional) servono già come "PR description" leggera.
4. Nessun reviewer da coordinare.

### Quando evolvere

Il modello va aggiornato quando si verifica **uno** di questi eventi:

| Trigger | Modello target | Cambia cosa |
|---|---|---|
| Aggiungi un secondo developer | GitHub Flow con PR | Apri tutte le change via PR, anche le tue, per audit + review opzionale |
| Inizi a fare release pubblicate (npm, Docker) | GitHub Flow + tag su main | Tag annotati `v1.0.0`, CHANGELOG generato da Conventional Commits |
| Hai bisogno di deploy gating (CI verde obbligatorio) | GitHub Flow + branch protection | `main` diventa "merge solo via PR + status check" |
| Hai due ambienti (staging + production) con flow separato | Trunk + branch `production` | `production` viene avanzato manualmente, deploy automation gating |

### Naming convention proposta (quando inizierai i feature branch)

```
feat/<short-desc>            es. feat/me-skills-self-assessment
fix/<short-desc>             es. fix/me-positions-column-names
chore/<short-desc>           es. chore/bump-react-19.3
docs/<short-desc>            es. docs/github-curriculum-batch-2
ci/<short-desc>              es. ci/add-eslint-workflow
hotfix/<short-desc>          es. hotfix/login-redirect-loop
release/v<version>           es. release/v1.0
```

Regole:
- minuscolo, dash-separated.
- ≤50 char totali.
- match il prefix con i Conventional Commits (`feat`, `fix`, `chore`, ...) per coerenza.

---

## 4. Comandi / checklist

### Branch operations day-to-day

```bash
# Lista branch
git branch                  # locali
git branch -r               # remote
git branch -a               # tutti
gh api repos/Spen-Zosky/heuresys-advanced/branches --jq '.[].name'

# Crea e switch (1 comando)
git checkout -b feat/issues-template-bug-form

# Switch a branch esistente
git switch main             # nuova sintassi (git ≥2.23)
git checkout main           # alternativa classica

# Push iniziale di un branch nuovo
git push -u origin feat/issues-template-bug-form

# Elimina locale + remote
git branch -d feat/foo                       # locale (verifica merged)
git branch -D feat/foo                       # locale (forza)
git push origin --delete feat/foo            # remote
gh api -X DELETE repos/owner/repo/git/refs/heads/feat/foo   # remote via API

# Rinomina branch corrente
git branch -m nuovo-nome
git push -u origin nuovo-nome
git push origin --delete vecchio-nome

# Rinomina branch default (es. master → main, una tantum)
git branch -m master main
git push -u origin main
gh repo edit --default-branch main
git push origin --delete master
```

### Sincronizzazione

```bash
# Fetch da remote (no merge)
git fetch origin
git fetch --all --prune     # ripulisce ref di branch eliminati su remote

# Pull con strategia
git pull --rebase origin main      # preferito per evitare merge commit di pull
git pull --ff-only origin main     # fail se richiede merge (safer)

# Configurazione persistent
git config --global pull.rebase true
git config --global fetch.prune true
```

### Merge strategies su PR (Web UI / CLI)

| Strategy | Cosa fa | Quando usarla |
|---|---|---|
| **Create a merge commit** | Crea `M` con 2 parent | Mai per nostri progetti (storia rumorosa) |
| **Squash and merge** | Combina tutti i commit del PR in 1 | Ideale per PR di feature work (1 PR = 1 commit logico in main) |
| **Rebase and merge** | Riapplica commit del PR sopra main | Quando ogni commit del PR è già atomico e vuoi storia lineare |

GitHub permette di disabilitare le strategy che non vuoi. Per i nostri repo (quando attiverai i PR) raccomandato: solo `Squash` + `Rebase`, disabilita `Merge commit`.

```bash
gh repo edit Spen-Zosky/heuresys-advanced \
  --allow-merge-commit=false \
  --allow-squash-merge=true \
  --allow-rebase-merge=true \
  --delete-branch-on-merge=true
```

L'ultimo flag (`delete-branch-on-merge`) elimina automaticamente il branch sorgente dopo il merge — riduce rumore.

### Checklist "evolvere da trunk-direct a GitHub Flow"

Da fare quando arriva il secondo dev / quando vuoi audit migliore:

1. [ ] Abilita branch protection su `main` (vedi Batch 5).
2. [ ] Disabilita `Allow merge commit` (solo Squash + Rebase).
3. [ ] Abilita `Auto-delete head branches on merge`.
4. [ ] Definisci una naming convention (vedi sopra).
5. [ ] Documenta in `CONTRIBUTING.md`.
6. [ ] Aggiungi PR template (`.github/pull_request_template.md`).
7. [ ] Configura required status checks (CI workflow deve passare prima del merge).

---

## 5. Trappole comuni

- **Branch divergente**: `git status` dice "Your branch and 'origin/main' have diverged". Significa che tu hai commit locali e origin ha commit nuovi che non conosci. Risolvi con `git pull --rebase` (mai `git push --force` su un branch shared!).
- **Force push su branch shared**: distrugge il lavoro degli altri. **Mai** su `main`. Su feature branch personale è OK ma usa sempre `--force-with-lease` (verifica che lo stato remoto sia quello che ti aspetti).
- **Stale branch**: branch che vivono per mesi e divergono molto. Soluzione: piccoli PR + merge frequente, oppure rebase regolari del feature branch su `main`.
- **Branch creato dal commit sbagliato**: hai branchato da `main` prima di pullare le novità. `git rebase origin/main` riallinea senza dover ricreare il branch.
- **Merge accidentale di main in feature branch**: trasforma il merge in feature branch in un mostro multi-parent. Soluzione: `git reset --hard origin/feat/x` se non hai ancora pushato, oppure rebase.
- **`git checkout <file>`** invece di `git restore <file>` distrugge le modifiche locali al file senza warning. Su git ≥2.23 usa `git restore` esplicito.
- **Confusione `main` vs `master`**: GitHub ha rinominato il default a `main` nel 2020. Vecchi repo possono ancora avere `master`. Verifica con `git symbolic-ref refs/remotes/origin/HEAD`.

---

## 6. Per approfondire

- **GitHub Flow** (di GitHub): <https://docs.github.com/en/get-started/using-github/github-flow>
- **Trunk Based Development** (libro online): <https://trunkbaseddevelopment.com/>
- **Git Flow original article** (Vincent Driessen, 2010): <https://nvie.com/posts/a-successful-git-branching-model/>
- **Atlassian comparison**: <https://www.atlassian.com/git/tutorials/comparing-workflows>
- File curriculum: [03-pull-requests.md](03-pull-requests.md) · [05-security/05-branch-protection.md](../05-security/05-branch-protection.md) `🚧 in arrivo`
