# 06.1 · gh CLI

> `gh` è il terminal client ufficiale GitHub. Espone REST + GraphQL API come comandi ergonomici, abilita scripting su qualsiasi operazione (repo, issue, PR, workflow, secret, release, ecc.). Lo abbiamo già usato decine di volte durante le nostre sessioni — qui formalizziamo i pattern più utili.

---

## 1. Concetto

`gh` permette di fare da terminale tutto quello che fai da Web UI di GitHub, più cose impossibili da UI (script bulk, integrazione con altri tool Unix).

### Auth model

```bash
gh auth login              # interactive: scegli web flow o paste PAT
gh auth status             # mostra account autenticati + scopes
gh auth refresh -s read:packages,write:packages   # aggiungi scope
gh auth logout
```

Token storage: gh stores in OS keyring (Windows Credential Manager, macOS Keychain, libsecret su Linux). Niente file plain-text.

### Pattern di comando

```
gh <verb> [object] [target] [flags]
```

Verb categories:
- `auth` — autenticazione
- `repo` — gestione repository
- `issue` / `pr` / `release` — workflow oggetti
- `workflow` / `run` — Actions
- `gist` — gist
- `api` — chiamata REST/GraphQL diretta
- `secret` / `variable` — variables management
- `label` — labels
- `project` — Projects v2 (GraphQL-backed)
- `codespace` — Codespaces
- `org` — Organizations

### Output formats

Tutti i comandi che restituiscono dati supportano `--json` per output parseabile + `--jq` per query inline:

```bash
gh repo view --json name,description,stargazerCount --jq '.name + " (" + (.stargazerCount|tostring) + " stars)"'
```

---

## 2. Modello mentale

```
       Terminal (tu)
            │
            │ gh <command>
            ▼
       gh CLI (binario)
            │
            │ HTTPS
            ▼
       GitHub REST/GraphQL API
            │
            ▼
       Risposta JSON
            │
            │ formatter + --jq filter
            ▼
       Output al terminale
```

---

## 3. Applicato ai nostri repo

Durante questa sessione abbiamo usato `gh` per:
- `gh repo view` — snapshot dei due repo (vedi `07-nostri-repo/01-stato-corrente.md`)
- `gh api` — chiamate dirette per metadata
- `gh workflow run` / `gh run list` / `gh run view` — gestione Storybook workflow
- `gh api -X POST .../pages` — abilitare Pages
- `gh repo create` (storicamente, quando i repo sono stati creati)

### Setup raccomandato per i nostri repo

**Cose di utilità quotidiana**:

```bash
# Aliases utili
gh alias set st 'status -h'         # gh st
gh alias set issues 'issue list --state=open --limit=20'
gh alias set prs 'pr list --state=open --limit=20'
gh alias set runs 'run list --limit=10'
gh alias set live 'run watch'        # gh live <RUN_ID>

# Default repo (quando lavori in una cartella non-git ma vuoi gestire un repo)
gh repo set-default Spen-Zosky/heuresys-advanced
```

---

## 4. Comandi / checklist — il "deck" più usato

### Account / repo

```bash
gh auth status
gh repo list Spen-Zosky --visibility=public
gh repo view Spen-Zosky/heuresys-advanced --web    # apre nel browser
gh repo clone Spen-Zosky/heuresys-advanced
gh repo create new-repo --public --description "..." --homepage "..."
gh repo edit --add-topic typescript --add-topic monorepo
gh repo edit --enable-wiki=false --delete-branch-on-merge=true
```

### Issues

```bash
gh issue create --title "..." --body "..." --label bug,severity/high
gh issue list                                       # open
gh issue list --search "is:open label:bug assignee:@me"
gh issue view 42
gh issue comment 42 --body "..."
gh issue edit 42 --add-label triaged --milestone "v1.0"
gh issue close 42 --reason completed
gh issue reopen 42
gh issue transfer 42 Spen-Zosky/altro-repo
```

### Pull requests

```bash
gh pr create --title "..." --body "..." --base main --draft
gh pr create --fill                                  # auto-fill body con commit messages
gh pr list
gh pr view 42 --comments
gh pr diff 42
gh pr checkout 42                                    # branch locale del PR
gh pr review 42 --approve --body "LGTM"
gh pr merge 42 --squash --delete-branch
gh pr close 42 --delete-branch
gh pr checks 42                                      # status di CI
```

### Workflow / Actions

```bash
gh workflow list
gh workflow view deploy-storybook.yml
gh workflow run deploy-storybook.yml                 # trigger manuale
gh workflow run ci.yml --ref my-branch --field foo=bar

gh run list --limit 10
gh run list --workflow=ci.yml --status=failure
gh run view 12345                                    # dettagli
gh run view 12345 --log                              # log completo
gh run view 12345 --log-failed                       # solo step rossi
gh run watch 12345                                   # follow live
gh run rerun 12345 --failed                          # solo job falliti
gh run download 12345 --name <artifact-name>
```

### Releases

```bash
gh release create v1.0.0 --generate-notes
gh release create v1.0.0 main --title "..." --notes-file CHANGELOG.md --draft
gh release list
gh release view v1.0.0
gh release upload v1.0.0 ./dist/binary.zip
gh release edit v1.0.0 --notes "Updated"
gh release delete v1.0.0 --cleanup-tag
```

### Secrets / Variables

```bash
gh secret set DEPLOY_TOKEN
gh secret set JWT_PRIVATE_KEY < .secrets/jwt.pem    # da file
gh secret list
gh secret delete DEPLOY_TOKEN

gh variable set API_BASE_URL --body "https://..."
gh variable list
```

### Labels

```bash
gh label list
gh label create bug --color d73a4a --description "..."
gh label edit bug --color ff0000
gh label delete bug
gh label clone Spen-Zosky/heuresys-advanced --repo Spen-Zosky/ux-design-shared   # copia label da repo a repo
```

### Projects v2 (GraphQL)

```bash
gh project list --owner Spen-Zosky
gh project create --owner Spen-Zosky --title "Roadmap"
gh project view 1 --owner Spen-Zosky
gh project item-add 1 --owner Spen-Zosky --url https://github.com/.../issues/42
gh project item-list 1 --owner Spen-Zosky
```

### Gist

```bash
gh gist create file.txt --public --desc "..."
gh gist create file1.txt file2.txt --public
gh gist list
gh gist view <ID>
gh gist edit <ID>
```

### API diretta

```bash
# REST
gh api repos/Spen-Zosky/heuresys-advanced
gh api repos/Spen-Zosky/heuresys-advanced/commits/aeea62d
gh api -X POST repos/Spen-Zosky/heuresys-advanced/issues -f title="..." -f body="..."

# Pagination
gh api repos/Spen-Zosky/heuresys-advanced/issues --paginate

# JQ filter
gh api repos/Spen-Zosky/heuresys-advanced --jq '.description, .topics[]'

# GraphQL
gh api graphql -f query='
  query {
    viewer {
      login
      repositories(first: 5) { nodes { name } }
    }
  }
'

# Headers extra
gh api repos/.../pulls/1 -H "Accept: application/vnd.github.diff" > pr.diff
```

### Scripting esempi

**1. Lista di tutti gli alert Dependabot critici**

```bash
gh api repos/Spen-Zosky/heuresys-advanced/dependabot/alerts \
  --jq '.[] | select(.security_vulnerability.severity == "critical") | {package: .dependency.package.name, advisory: .security_advisory.summary}'
```

**2. Bulk update di label**

```bash
for label in bug enhancement docs question; do
  gh label edit "$label" --color "0e8a16" --repo Spen-Zosky/altro-repo
done
```

**3. Generare un summary cross-repo**

```bash
for repo in heuresys-advanced ux-design-shared; do
  echo "=== $repo ==="
  gh api repos/Spen-Zosky/$repo --jq '"Stars: " + (.stargazers_count|tostring) + " · Forks: " + (.forks_count|tostring) + " · Open issues: " + (.open_issues_count|tostring)'
done
```

**4. Crea repo + push + abilita Pages in 1 script**

```bash
gh repo create my-new-repo --public --description "..."
cd my-new-repo
git init
git add . && git commit -m "initial"
git remote add origin https://github.com/Spen-Zosky/my-new-repo.git
git push -u origin main
gh api -X POST repos/Spen-Zosky/my-new-repo/pages -F build_type=workflow -F 'source[branch]=main'
```

### Checklist setup gh CLI su macchina nuova

- [ ] `winget install GitHub.cli` (Windows) / `brew install gh` (Mac) / `apt install gh` (Linux).
- [ ] `gh auth login` → web flow.
- [ ] `gh auth status` per verifica.
- [ ] `gh repo set-default` se lavori spesso da fuori cartella git.
- [ ] Configura aliases utili (vedi sopra).

---

## 5. Trappole comuni

- **Token scope mancante**: errore `HTTP 403: Resource not accessible by integration`. Rimedio: `gh auth refresh -s <scope>` (es. `read:org`, `write:packages`).
- **`gh repo clone` clone HTTPS**: per push con SSH, dopo clone aggiusta `git remote set-url origin git@github.com:owner/repo.git`. Oppure `gh repo clone --ssh`.
- **Pagination silenziosa**: senza `--paginate`, `gh api .../issues` ritorna solo i primi 30. Per bulk, `--paginate`.
- **`--jq` rigoroso**: jq fail su null. `gh api ... --jq '.foo.bar // "fallback"'` per safe-extract.
- **`gh project` non supporta tutte le operazioni**: alcuni Projects v2 setup richiedono `gh api graphql` diretto (manipolazione field values).
- **`gh pr create` da branch unstaged**: se hai modifiche non committate, alcuni comandi (es. `gh pr create --fill`) possono usare lo stato sbagliato. Committa prima.
- **`gh secret set` interattivo** salta se input non-TTY (CI): usa `gh secret set NAME --body "value"` o `< file`.
- **GitHub Enterprise**: `gh` di default punta a `github.com`. Per GHE: `gh auth login --hostname <enterprise.url>` + tutti i comandi `--hostname`.

---

## 6. Per approfondire

- **gh manual** (auto-generato): <https://cli.github.com/manual/>
- **gh GitHub**: <https://github.com/cli/cli>
- **Awesome gh CLI**: <https://github.com/cli/cli/blob/trunk/docs/working-with-us.md>
- **`gh api` deep dive**: <https://docs.github.com/en/github-cli/github-cli/quickstart>
- **jq cheatsheet**: <https://devhints.io/jq>
- File curriculum: [02-web-ui-tour.md](02-web-ui-tour.md) · [03-integrazioni.md](03-integrazioni.md)
