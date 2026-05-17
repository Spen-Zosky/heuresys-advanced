# 03 · Git flow su GitHub

> Riassunto pratico dei comandi git che useresti **su un progetto GitHub-hosted**. Non riscrive `git-scm.com`: cattura il workflow tipico, il legame con il remote GitHub, e i comandi che usi davvero nei nostri due repo oggi.

---

## 1. Concetto

`git` è il version control system. I concetti base:

- Un **commit** è uno snapshot del progetto + metadati (autore, data, message, parent commit). Identificato da uno SHA-1 (es. `aeea62dc`).
- Un **branch** è un puntatore mobile a un commit; nuovi commit avanzano il puntatore.
- Un **tag** è un puntatore immutabile a un commit (di norma per una release).
- Un **remote** è un repo di riferimento (su GitHub o altro server); il nome canonico è `origin`.
- L'**HEAD** è il puntatore al commit corrente (di norma il tip del branch attivo).

Su GitHub, il **remote** è `https://github.com/<owner>/<repo>.git` (o `git@github.com:<owner>/<repo>.git` con SSH). Ogni `git push` aggiorna il remote; ogni `git fetch`/`git pull` scarica le novità.

Operazioni canoniche:

| Operazione | Comando | Cosa fa |
|---|---|---|
| Clone | `git clone <url>` | Scarica un repo + setup remote `origin` |
| Branch | `git checkout -b feature/foo` | Crea + switcha a un nuovo branch |
| Commit | `git add <files> && git commit -m "msg"` | Snapshot atomico |
| Push | `git push origin main` | Spedisci commit al remote |
| Pull | `git pull origin main` | Fetch + merge |
| Fetch | `git fetch origin` | Aggiorna remote refs senza merge |
| Merge | `git merge feature/foo` | Integra commit di un branch in HEAD |
| Rebase | `git rebase main` | Riapplica i tuoi commit sopra `main` |
| Tag | `git tag -a v1.0.0 -m "msg" && git push origin v1.0.0` | Marca commit come release |
| Log | `git log --oneline -n 10` | Lista ultimi 10 commit |
| Stash | `git stash && ... && git stash pop` | Mette via modifiche non committate |

---

## 2. Modello mentale

```
                    ┌──────────────────────────┐
                    │     REMOTE (GitHub)      │
                    │  github.com/owner/repo   │
                    └────────────┬─────────────┘
                                 │  fetch / pull
                                 │  push
                                 ▼
            ┌──────────────────────────────────────────┐
            │            LOCAL REPOSITORY              │
            │                                          │
            │  ┌────────┐   ┌─────────┐   ┌─────────┐  │
            │  │working │──►│ staging │──►│ commits │  │
            │  │  dir   │   │ (index) │   │ (HEAD)  │  │
            │  └────────┘   └─────────┘   └─────────┘  │
            │   (git add)    (git commit)              │
            └──────────────────────────────────────────┘
```

3 stadi locali:
1. **Working directory** — i tuoi file modificati ma non ancora "registrati".
2. **Staging area (index)** — file selezionati con `git add`, pronti per il commit.
3. **Commit / HEAD** — snapshot definito, parte della storia.

Più il **remote** è la 4ª location, fuori dal tuo PC.

Branching mentale:

```
              main:    A──B──C──D──E   (HEAD)
                              \
              feature/x:       F──G    (HEAD se sei su feature/x)
```

Quando fai merge di `feature/x` in `main`, GitHub crea (di solito) un **merge commit** `M` che ha 2 parent (E e G):

```
              main:    A──B──C──D──E─────M  (HEAD)
                              \         /
              feature/x:       F────────G
```

Modalità alternative di merge offerte da GitHub via Web UI:
- **Squash and merge** — combina F+G in un singolo commit S messo sopra E.
- **Rebase and merge** — riapplica F,G sopra E senza merge commit (history lineare).

---

## 3. Applicato ai nostri repo

### Workflow attuale

Entrambi i repo seguono un **trunk-based workflow semplificato**:

- **1 solo branch attivo**: `main`.
- **Niente PR**: i commit vanno direttamente su `main` localmente, poi push.
- **Niente branch protection**: nessuna rule blocca push diretti.
- **Niente CI gating**: i workflow esistenti (`deploy-storybook.yml` su `ux-design-shared`) si eseguono *dopo* il push, senza pre-merge check.

Questo è OK perché sei sole-coder. Quando arriverà un secondo collaborator, il workflow va evoluto (PR + review + branch protection) — argomento del [Batch 2 collaborazione](../02-collaborazione/) e [Batch 5 security](../05-security/).

### Stato dei branch oggi (verificabile)

```bash
# heuresys-advanced
git -C /d/heuresys-advanced branch -a
#   * main
#     remotes/origin/main

# ux-design-shared
git -C /d/ux-design-shared branch -a
#   * main
#     remotes/origin/main
```

Solo `main` esistente. Nessun feature branch. Tutti i commit lineari.

### Commit style usato

Convenzione informale **Conventional Commits** rilassata. Dal log recente:

```
feat(api): MVP-2a Phase 2 batch 11 — closing pages (admin/roles, …)
docs(handoff): MVP-2a feature surface CLOSED — 42/42 pages live, …
ci(storybook): drop npm cache directive — package-lock.json is gitignored
```

Pattern: `<type>(<scope>): <descrizione>` + body multi-paragrafo + opzionale `Co-Authored-By:` footer.

I `<type>` usati: `feat`, `docs`, `chore`, `ci`, `fix`, `test`, `refactor`. Lo `<scope>` riflette l'area: `api`, `web`, `db`, `handoff`, `storybook`, ecc.

Questo stile abilita (in futuro):
- Generazione automatica di CHANGELOG via `release-please` o simili.
- Filtering del log per area (`git log --grep "^feat(web)"`).

---

## 4. Comandi / checklist

### Comandi day-to-day che già usi

```bash
# Stato corrente
git status -sb                       # short branch view
git log --oneline -n 10              # ultimi 10 commit
git log --left-right --count origin/main...main   # ahead/behind
git diff HEAD~1                      # cosa è cambiato nell'ultimo commit

# Routine commit
git add <files>                      # OPPURE git add -A per tutto (attento ai secret)
git commit -m "<msg>"                # con heredoc per multi-line nel CLAUDE.md
git push origin main                 # autorizzazione esplicita per ogni push (regola progetto)
```

### Comandi utili meno usati

```bash
# Cosa cambierebbe se pull-assi adesso?
git fetch origin
git log HEAD..origin/main --oneline  # commit da pullare

# Vedi chi ha toccato cosa
git blame <file>
git log --follow <file>              # storia di un file (anche dopo rename)

# Cerca nei messaggi di commit
git log --grep "MVP-2a" --oneline
git log --all --source -- <file>    # branch in cui file è stato toccato

# Annulla un commit non ancora pushato
git reset --soft HEAD~1              # mantieni le modifiche staged
git reset HEAD~1                     # mantieni come unstaged
git reset --hard HEAD~1              # ❗ butta tutto — destructive
```

### Comandi GitHub-specific tramite gh CLI

```bash
gh repo clone Spen-Zosky/heuresys-advanced
gh repo view --web                   # apre il repo nel browser
gh pr create --draft                 # crea PR (vedremo nel batch 2)
gh release create v1.0.0 --notes "..."  # crea release (batch 4)
```

### Checklist "primo push su un repo nuovo"

1. `git init` (se locale) oppure `git clone <url>` (se remote already).
2. Verifica `git config user.{name,email}` — `gh auth status` per verificare il PAT/SSH.
3. Crea `.gitignore` **prima** del primo commit (per non committare `node_modules/`, `.env`, ecc.).
4. Aggiungi `README.md` minimale.
5. `git add -A && git commit -m "chore: initial commit"`.
6. `git remote add origin <url>` (se locale).
7. `git push -u origin main` — il `-u` setta `main` come upstream tracking.

---

## 5. Trappole comuni

- **`git push --force` su main**: riscrive la storia remota — chiunque ha già pullato il vecchio main ora ha conflitti. Su `main` di un public repo è quasi sempre un errore. Su feature branch personali è normale (rebase + push --force-with-lease).
- **Commit con secret nel diff**: anche se rimuovi il file in un commit successivo, il segreto resta nella storia. Soluzione: `git filter-repo` o `bfg-repo-cleaner` per rimuoverlo, **ma il segreto va comunque rotato**.
- **Pull con merge invece di rebase** crea merge commit "rumorosi" tipo `Merge branch 'main' of github.com:...`. Per evitare: `git config --global pull.rebase true` oppure `git pull --rebase`.
- **Branch creato dal commit sbagliato** (es. ti dimentichi di pullare prima): `git rebase origin/main` riallinea il tuo branch sulla testa di main remote.
- **Detached HEAD** dopo `git checkout <commit-sha>`: stai navigando un commit specifico senza essere su un branch. Tutti i nuovi commit "spariranno" non appena fai checkout altrove. Per "salvare" la posizione: `git checkout -b nome-temporaneo`.
- **`git add .` vs `git add -A`** in directory diverse: `.` aggiunge dalla cwd in giù; `-A` aggiunge da tutto il repo. Su Windows con percorsi misti, è facile sbagliare. Preferisci sempre `git status` prima di `git commit`.

---

## 6. Per approfondire

- **Pro Git** (libro gratuito di riferimento): <https://git-scm.com/book/en/v2>
- **GitHub git docs**: <https://docs.github.com/en/get-started/using-git>
- **Conventional Commits**: <https://www.conventionalcommits.org/>
- **Atlassian git tutorials** (visualmente eccellenti): <https://www.atlassian.com/git/tutorials>
- File del curriculum: [04-readme-e-markdown.md](04-readme-e-markdown.md) · [02-collaborazione/02-branches.md](../02-collaborazione/02-branches.md) `🚧 in arrivo` · [05-security/04-signed-commits.md](../05-security/04-signed-commits.md) `🚧 in arrivo`
