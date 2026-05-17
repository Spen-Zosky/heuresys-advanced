# 06.3 · Integrazioni — VS Code, JetBrains, mobile, GitHub Desktop

> GitHub si integra con i tool che usi tutti i giorni. Niente è strettamente necessario per produttività di base (CLI + Web UI bastano), ma alcune integrazioni rimuovono frizione per task ricorrenti.

---

## 1. Concetto

GitHub espone (a) **REST + GraphQL API**, (b) **OAuth flow** standard, (c) **GitHub Apps** + (d) **GitHub CLI**. Ogni tool integrabile usa una combinazione di questi.

Tools popolari per categoria:

| Categoria | Tool | Trigger di integrazione |
|---|---|---|
| **Editor desktop** | VS Code, JetBrains (IntelliJ/WebStorm), Sublime, Emacs/Vim | Auth via PAT o OAuth |
| **Editor cloud** | github.dev, Codespaces | Auto via account |
| **GUI git** | GitHub Desktop, Sourcetree, Tower, Fork | Auth via OAuth |
| **Mobile** | GitHub mobile (iOS/Android), Working Copy (iOS) | OAuth |
| **Terminal** | gh CLI, lazygit, tig | Auth via gh |
| **Notification aggregator** | Octobox, Pullp | OAuth con scope notifications |
| **CI/CD external** | CircleCI, Travis, Vercel, Netlify | GitHub App install |
| **Chat** | Slack GitHub app, Discord github bot | OAuth + webhook |
| **Project management** | Linear, Jira, Notion | GitHub App + webhook |

---

## 2. Modello mentale

```
                  ┌──────────────────────────┐
                  │      GITHUB              │
                  │  REST + GraphQL + OAuth  │
                  └────────────┬─────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
   ┌──────────┐         ┌──────────────┐       ┌──────────┐
   │  Editor  │         │  GUI client  │       │  Mobile  │
   │ (VS Code,│         │ (GH Desktop, │       │ (GH app) │
   │ JetBrains│         │  Sourcetree) │       │          │
   │  ...)    │         │              │       │          │
   └──────────┘         └──────────────┘       └──────────┘

       Auth: PAT       Auth: OAuth flow         Auth: OAuth
       Use: code edit  Use: commit / merge      Use: review notif
            commit          history view              issue write
            PR mgmt         visual diff
```

---

## 3. Applicato al tuo setup

### VS Code (probabilmente non lo usi — preferenza Notepad++)

VS Code ha estensione `GitHub Pull Requests and Issues` (ufficiale Microsoft) che integra:
- Lista PR + issue nel sidebar.
- Review inline (commento su riga senza aprire browser).
- Checkout branch del PR con 1 click.
- Linked notifications.

Setup:
1. Install VS Code (se non l'hai).
2. Install extension: `GitHub.vscode-pull-request-github`.
3. Login: `View → Command Palette → "GitHub: Sign in"`.
4. Tab GitHub nel sidebar sinistro.

Se preferisci Notepad++ + vim, ignora questa sezione. CLI + browser bastano.

### JetBrains (WebStorm / IntelliJ)

Plugin: `GitHub` (pre-installato in WebStorm). Funzionalità:
- Sync git + GitHub via singolo login.
- `VCS → Git → GitHub → Create PR` direttamente da IDE.
- Annotations vedi autore + linkify a commit GitHub.

Non rilevante se non usi JetBrains.

### GitHub Desktop (GUI)

Client desktop ufficiale di GitHub. Cross-platform (Mac, Win, Linux beta).

Pro:
- Visualizza diff con un'UI più ricca di `git log` testuale.
- Stash + cherry-pick + revert + branch switch — tutto con click.
- Integrato direttamente con github.com (login, fork, clone).

Contro:
- Lento su repo grandi (10k+ file).
- Niente merge conflict resolution (apre editor esterno).
- Niente terminal access — devi switchare comunque.

Per chi: developer "git-light", o per quick visual review prima di commit.

Setup:
1. Download da <https://desktop.github.com/>.
2. Sign in con GitHub account.
3. Repo che hai clonato in locale appaiono automaticamente.

### GitHub mobile (iOS/Android)

App ufficiale free. Use case principali:
- **Notifiche push** per review request, mention, CI fail.
- **Review PR on-the-go** (vedi diff, commenta, approvi). Niente editing complesso però.
- **Issue triage** veloce in attesa al bar.
- **Code browse** read-only.

Auth: stesso GitHub account. Setup ~1 min.

Per chi è abituato a notifiche browser: utile per "on-call style" monitoring senza essere davanti al PC.

Download: <https://github.com/mobile>

### `github.dev` (browser-based VS Code)

Già menzionato in `02-web-ui-tour.md`. Recap: tasto `.` su qualsiasi repo GitHub → VS Code in browser. Workflow:

1. Edit file.
2. Commit + commit message direttamente da VS Code.
3. Push automatico.

Limit: niente terminale, niente node/npm/pnpm. Solo edit + commit. Perfetto per fix di tipo / typo / config minimo, senza clone locale.

### Slack / Discord integration

Per chi usa team chat:
- Slack: app `GitHub` ufficiale, slash command `/github subscribe owner/repo` per ricevere notifiche di issue, PR, deploy nel channel.
- Discord: bot `GitHub` simili (configurabile via webhook).

Per sole-coder: overkill. Email/UI bastano.

### CI/CD esterni (Vercel, Netlify, etc.)

Sostituti di GitHub Actions per **frontend deploy**:
- **Vercel**: auto-deploy preview per ogni PR (Next.js molto integrato).
- **Netlify**: auto-deploy + form handling + Functions.
- **Cloudflare Pages**: alternativa free con generous limiti.

Per il nostro `apps/web` (quando pronto a deploy): Vercel è candidato naturale dato che è Next.js 15. Setup: 1-click "Import from GitHub". Vercel commenta automaticamente i PR con il preview URL.

### Notification managers

Se ricevi >10 notifiche GitHub/giorno, considera:
- **Octobox** (<https://octobox.io>): UI dedicata per triage notifiche, archivia/snooze.
- **Pullp**: dashboard PR cross-repo.
- **Hubrise**: simile.

Per ora: 0 notifiche al giorno → non serve.

---

## 4. Comandi / checklist

### Setup VS Code GitHub extension (opzionale)

```bash
# CLI install
code --install-extension github.vscode-pull-request-github

# Auth
# Apri VS Code → Ctrl+Shift+P → "GitHub: Sign in"
```

### Setup GitHub Desktop (opzionale)

```bash
# Windows
winget install GitHub.GitHubDesktop

# Mac
brew install --cask github
```

### Browser bookmarks utili

```
Inbox notifiche:     https://github.com/notifications
Profile mio:         https://github.com/Spen-Zosky
Repo nostri (pin):   https://github.com/Spen-Zosky/heuresys-advanced
                     https://github.com/Spen-Zosky/ux-design-shared
Storybook live:      https://spen-zosky.github.io/ux-design-shared/
Marketplace:         https://github.com/marketplace
Status page:         https://www.githubstatus.com
```

### Mobile setup

1. App store → cerca "GitHub" → install.
2. Sign in con `Spen-Zosky` account.
3. Push notification setup: Settings → Notifications → toggle "PR review requested" + "Issue assigned" + "CI status".

### Checklist scegli integrations

- [ ] Editor: VS Code GitHub extension (se usi VS Code).
- [ ] GUI: GitHub Desktop (se vuoi visual diff senza imparare git log).
- [ ] Mobile: GitHub mobile (se vuoi notifiche push).
- [ ] Browser: `github.dev` con `.` per quick edits.
- [ ] CI esterno: Vercel quando deploy apps/web.
- [ ] Slack/Discord: ignora per ora.
- [ ] Notification manager: ignora per ora.

Minimum viable setup per sole-coder: nessuna integration aggiuntiva. CLI + browser bastano. Aggiungi solo quando senti il bisogno.

---

## 5. Trappole comuni

- **VS Code GitHub extension chiede PAT classic**: meglio fine-grained. Verifica scope minimo (`repo`, `read:user`).
- **GitHub Desktop e gh CLI auth separati**: ognuno ha il suo token. Cambio password GitHub richiede re-auth in entrambi.
- **Mobile notifications overlap con email**: GitHub manda email + push per default. Mute uno dei due via `Settings → Notifications`.
- **`github.dev` stato perso al refresh**: lavorando senza commit, un refresh del browser perde gli unsaved. Salva spesso (committa).
- **Vercel/Netlify env vars separate da GitHub Secrets**: il deploy bot legge env vars dal **loro** dashboard (Vercel/Netlify), non dai secret GitHub. Setup separato.
- **GUI client e `gh` non in sync su state locale**: `gh pr checkout` modifica HEAD; il GUI client non lo capisce subito (refresh manuale).
- **Estensione VS Code troppi alert**: l'extension chiede review confirmation a ogni PR aperto. Sotto Settings, riduci.

---

## 6. Per approfondire

- **VS Code GitHub PRs extension**: <https://github.com/microsoft/vscode-pull-request-github>
- **GitHub Desktop**: <https://desktop.github.com>
- **GitHub mobile**: <https://github.com/mobile>
- **github.dev docs**: <https://docs.github.com/en/codespaces/the-githubdev-web-based-editor>
- **JetBrains GitHub plugin**: <https://www.jetbrains.com/help/idea/work-with-github-pull-requests.html>
- **Slack GitHub app**: <https://slack.github.com/>
- **Vercel + GitHub**: <https://vercel.com/docs/concepts/git/vercel-for-github>
- File curriculum: [01-gh-cli.md](01-gh-cli.md) · [02-web-ui-tour.md](02-web-ui-tour.md)
