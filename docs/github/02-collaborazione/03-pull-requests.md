# 02.3 · Pull Requests

> Il Pull Request (PR) è il meccanismo GitHub per proporre modifiche da un branch sorgente verso un branch target, con discussione, review e check automatici prima del merge. È il cuore della collaborazione asincrona su GitHub.

---

## 1. Concetto

Un **Pull Request** è una richiesta di "tirare dentro" (pull) i commit di un branch (`head`) in un altro branch (`base`). Più di un semplice merge:

- **Discussione persistente** — body GFM + comments thread.
- **Diff inline** — vedi line-by-line cosa cambia + suggesti­sci modifiche.
- **Review** — uno o più reviewer approvano/richiedono modifiche.
- **Status checks** — CI/CD verifica automatica (test, lint, build).
- **Linked issues** — `Closes #42` chiude l'issue al merge.
- **Merge strategy** — squash, rebase, merge commit (configurabile).
- **Draft mode** — PR "work-in-progress" non mergeable, utile per feedback precoce.

Un PR è essenzialmente **un'Issue specializzata** + diff git + UI per merge. Condivide numerazione, label, assignee, milestone, project.

### Anatomia di un PR

| Sezione | Contenuto |
|---|---|
| **Title** | Stessa convenzione dei commit (es. `feat(web): MVP-2a Phase 2 batch 5`) |
| **Description** | Cosa cambia, perché, come testare, screenshot |
| **Files changed** | Diff con commenti inline |
| **Commits** | Lista dei commit nel branch |
| **Checks** | Status di CI (verde/rosso/giallo) |
| **Reviewers** | Chi deve approvare |
| **Linked issues** | Issue auto-chiuse al merge |
| **Conversation** | Comments + review threads risolvibili |

### Stati di un PR

```
   draft  ─────►  ready for review  ─────►  approved  ─────►  merged
     │                  │                       │
     │                  │                       └─► request changes  ──► back to ready
     │                  │
     │                  └─► closed (without merge) — abbandonato
     │
     └─► converted to ready for review (manual)
```

---

## 2. Modello mentale

```
       ┌────────────────────────────────────────────────────────┐
       │                  REPOSITORY                            │
       │                                                        │
       │   main:    A───B───C─────────────────M  ◄── merge      │
       │                     \               /                  │
       │   feat/x:            D───E───F  ◄── PR head            │
       │                              ▲                         │
       │                              │  pull request           │
       │                              │  ├ description          │
       │                              │  ├ reviewers            │
       │                              │  ├ checks (CI)          │
       │                              │  ├ comments             │
       │                              │  └ approval             │
       │                                                        │
       └────────────────────────────────────────────────────────┘
```

Il PR esiste finché il branch `head` esiste (anche dopo il merge — viene mostrato in `closed PRs`).

---

## 3. Applicato ai nostri repo

### Stato attuale: **nessun PR mai aperto**

Entrambi i repo: 0 PR open, 0 PR closed. Workflow attuale è **commit diretti su `main`** (vedi `02-branches.md`).

### Quando aprire il primo PR

Tre trigger naturali:

1. **Sperimentare un cambio rischioso** (es. major upgrade React 19 → 20): apri un branch, fai i lavori, apri un PR per "vedere il diff aggregato" prima di mergiare. Niente reviewer richiesti, ma il PR serve come spazio di pensiero.

2. **Documentare una decisione complessa**: il body del PR è un Markdown ricco con motivazioni, alternative considerate, trade-off. Linkato all'eventuale Issue. Diventa parte della storia del progetto.

3. **Aggiungere un secondo contributor**: regola dura — *ogni* change passa da PR.

### PR template (proposta)

File `.github/pull_request_template.md`:

```markdown
## Cosa cambia

<!-- 1-3 frasi: cosa fa questo PR -->

## Perché

<!-- Motivazione / linked issue -->

Closes #

## Come testare

<!-- Step concreti per validare in locale -->

```bash
# es.
pnpm install
cd apps/api && pnpm test -- compensation
```

## Impatto

- [ ] Breaking changes (API contract, schema DB, ENV vars)
- [ ] Aggiunge / rimuove dipendenze
- [ ] Richiede migration database
- [ ] Richiede aggiornamento di documentation (`HANDOFF.md`, `README.md`)

## Checklist

- [ ] Tests aggiunti / aggiornati
- [ ] Documentazione aggiornata
- [ ] Conventional commit message
- [ ] Self-review fatto
```

Questo template appare automaticamente quando crei un nuovo PR. Se ne hai più di uno (es. uno per bug, uno per feature), usa la directory `.github/PULL_REQUEST_TEMPLATE/`.

---

## 4. Comandi / checklist

### CLI day-to-day

```bash
# Crea PR (dopo aver pushato il branch)
gh pr create \
  --title "feat(web): add /me/skills/self-assessment form" \
  --body "Closes #42" \
  --base main \
  --head feat/me-self-assessment

# Crea PR draft (work-in-progress)
gh pr create --draft --title "wip: experimental approach to X"

# Crea PR e apri in browser
gh pr create --web

# Lista
gh pr list                              # open
gh pr list --state all --limit 20
gh pr list --author @me
gh pr list --label area/api
gh pr list --search "review-requested:@me"

# View
gh pr view 42                           # CLI
gh pr view 42 --web                     # browser
gh pr view 42 --comments                # con commenti

# Diff
gh pr diff 42

# Checkout locale del branch del PR
gh pr checkout 42

# Review
gh pr review 42 --approve --body "LGTM!"
gh pr review 42 --request-changes --body "Needs more tests"
gh pr review 42 --comment --body "Question: why this approach?"

# Merge
gh pr merge 42 --squash --delete-branch
gh pr merge 42 --rebase --delete-branch
gh pr merge 42 --merge  --delete-branch  # con merge commit, sconsigliato

# Close senza merge
gh pr close 42 --delete-branch
```

### Magic words per linking

Nel body o nei commit message:

```
Closes #42         → chiude issue #42 al merge
Fixes #42          → idem
Resolves #42       → idem
Refs #42           → solo link, niente auto-close
Related to #42     → idem, semantic
owner/repo#42      → cross-repo reference (no auto-close cross-repo)
```

### Review meccanica

In una review:
- **Comment** — commento singolo, non blocca/sblocca.
- **Approve** — sblocca il merge (se branch protection lo richiede).
- **Request changes** — blocca il merge finché non viene "resolved" o dismissato.

Commento inline su una riga di diff: clicca il `+` accanto al numero di riga nel diff view. Puoi anche **suggerire modifiche** con un code block speciale ` ```suggestion `:

````markdown
```suggestion
const max = 100; // era 50
```
````

Il PR author può accettare la suggestion con 1 click — diventa un commit nel branch.

### Draft PR

Crea un PR in modalità draft quando:
- Stai ancora lavorando ma vuoi feedback su una direzione.
- Vuoi attivare la CI senza essere "merge-ready".
- Vuoi un placeholder per linkare progress.

Trasforma in ready quando: pulsante `Ready for review` nella UI o `gh pr ready 42`.

### Checklist "buon PR"

- [ ] Title in Conventional Commits format
- [ ] Body con sezioni "Cosa", "Perché", "Come testare"
- [ ] Linked issue (`Closes #N` se applicabile)
- [ ] Diff piccolo (idealmente ≤500 righe; ≤200 ideale)
- [ ] 1 PR = 1 cambio logico (no "feat + refactor + chore" insieme)
- [ ] CI verde prima di richiedere review
- [ ] Self-review fatto (ri-leggi il tuo diff prima di pubblicarlo)
- [ ] Commit message sensati (no `wip`, `fix`, `oops`)

---

## 5. Trappole comuni

- **PR giganti** (>1000 righe diff): nessuno fa una review seria. Splitta in PR sequenziali.
- **PR senza description**: forza il reviewer a indovinare. Anche 3 righe "what + why" sono meglio di niente.
- **Branch divergente da main**: prima di chiedere review, `git rebase origin/main` per portarti sull'ultima `main`. Risolvi conflitti tu, non il reviewer.
- **Auto-merge attivato per sbaglio**: GitHub ha un'opzione "auto-merge when all checks pass". Se la abiliti e poi i check sono verdi, **mergi anche se non sei pronto**. Usa con cautela.
- **Squash merge con messaggio default**: GitHub propone un messaggio = "title + lista PR commits". Spesso non è il messaggio che vuoi nel main log. Modifica prima di confermare.
- **`Closes #42` nel commit ma branch su altro repo**: il magic word funziona solo se il PR merge nel `default_branch` del repo dove vive l'issue. Cross-repo non auto-chiude.
- **Review dimenticate**: PR che giacciono giorni perché il reviewer non riceve notifica. Soluzione: ping `@user` esplicito + setup notifiche email aggressive.
- **Resolved conversation senza fix**: chi apre una review thread può marcare "Resolved" un commento anche se l'issue non è stata realmente affrontata. Convenzione: solo l'autore del commento dovrebbe risolverlo.

---

## 6. Per approfondire

- **About pull requests**: <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests>
- **Reviewing PRs**: <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews>
- **PR templates**: <https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository>
- **Suggesting changes**: <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/incorporating-feedback-in-your-pull-request>
- File curriculum: [01-issues.md](01-issues.md) · [02-branches.md](02-branches.md) · [05-security/05-branch-protection.md](../05-security/05-branch-protection.md) `🚧 in arrivo`
