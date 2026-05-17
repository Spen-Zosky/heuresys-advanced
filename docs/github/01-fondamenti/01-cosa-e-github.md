# 01 · Cosa è GitHub

> GitHub non è "solo git online". È un'intera piattaforma che integra hosting del codice, collaborazione, automazione, distribuzione e identità developer. Capire i 5 pilastri ti permette di scegliere consapevolmente quali attivare per i tuoi progetti.

---

## 1. Concetto

**git** (lowercase) è il version control system inventato da Linus Torvalds nel 2005: gestisce commit, branch, merge. Funziona offline, in locale, senza nessun server centrale.

**GitHub** (proper noun) è una piattaforma cloud commerciale (di proprietà di Microsoft dal 2018) costruita **sopra** git. Aggiunge:

1. **Hosting** — un remote git accessibile via HTTPS/SSH.
2. **Collaborazione** — Issues, Pull Request, code review, Discussions, Wiki.
3. **Automazione** — GitHub Actions (CI/CD), Dependabot, Code Scanning.
4. **Distribuzione** — Releases, Packages (npm/container/maven), Pages (static hosting).
5. **Identità** — il profilo pubblico developer, gli "social graph" di star/follow/contribuzioni.

Concorrenti diretti: GitLab, Bitbucket (Atlassian), Codeberg, sourcehut. GitHub ha la quota di mercato dominante per progetti open source.

Tier di pricing rilevanti per il nostro caso (sole-coder):

| Tier | Costo | Cosa include (sintesi) |
|---|---|---|
| **GitHub Free** (personal) | $0 | Repo pubblici/privati illimitati, 2000 min Actions/mese, 500 MB Packages, Pages, Issues, PR, Discussions, Codespaces 60h/mese |
| GitHub Pro (personal) | $4/mese | +3000 min Actions, +2 GB Packages, Advanced Insights |
| GitHub Free (org) | $0 | Idem free personal ma su org-level (governance + team) |
| GitHub Team (org) | $4/utente/mese | +Code review tools, +protected branches, +draft PR |
| GitHub Enterprise | $21/utente/mese | SAML SSO, audit log, advanced security, on-prem option |

> **Stato nostro**: `Spen-Zosky` è un account personal con tier Free. Tutto il curriculum è dimensionato su quello che ti dà il tier gratuito.

---

## 2. Modello mentale

```
   ┌────────────────────────────────────────────────────────────┐
   │                       GITHUB (cloud)                       │
   │                                                            │
   │   ┌──────────┐   ┌────────────┐   ┌───────────────────┐    │
   │   │  CODICE  │   │ COLLABOR.  │   │   AUTOMAZIONE     │    │
   │   │  (git)   │   │ Issues/PR  │   │  Actions/Bots     │    │
   │   └────┬─────┘   └─────┬──────┘   └─────────┬─────────┘    │
   │        │               │                    │              │
   │        └───────────────┼────────────────────┘              │
   │                        ▼                                   │
   │          ┌────────────────────────────────┐                │
   │          │       REPOSITORY (1 unit)      │                │
   │          └────────────────────────────────┘                │
   │                        │                                   │
   │        ┌───────────────┼────────────────────┐              │
   │        ▼               ▼                    ▼              │
   │   ┌──────────┐   ┌────────────┐   ┌───────────────────┐    │
   │   │ DISTRIB. │   │ SICUREZZA  │   │     IDENTITÀ      │    │
   │   │ Pages/   │   │ Dependabot │   │   Profilo /       │    │
   │   │ Releases │   │  CodeQL    │   │ Social graph      │    │
   │   │ Packages │   │  Secrets   │   │                   │    │
   │   └──────────┘   └────────────┘   └───────────────────┘    │
   └────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌──────────────────────┐
                  │  CLIENT LOCALI       │
                  │  git, gh CLI, VS     │
                  │  Code, GitHub Desktop│
                  └──────────────────────┘
```

Il **repository** è l'unità centrale. Tutte le altre feature gli orbitano intorno: alcune sono attive di default (codice, Issues, Wiki, Projects), altre vanno abilitate esplicitamente (Pages, Dependabot, Discussions).

---

## 3. Applicato ai nostri repo

| Repo | Tier | Stato | Note |
|---|---|---|---|
| `Spen-Zosky/heuresys-advanced` | Free personal | Public · 88 commit · 2 MB · creato 2026-05-16 | Codebase principale (monorepo pnpm) |
| `Spen-Zosky/ux-design-shared` | Free personal | Public · 4 commit · 234 KB · creato 2026-05-16 | Design system + Storybook pubblicato su Pages |

Entrambi sotto lo stesso account `Spen-Zosky`. Nessuna `Organization` creata. Le implicazioni:

- **Pro**: setup minimo, zero burocrazia di governance, costo $0.
- **Limiti del personal**: niente team-level audit log, niente Code Owners cross-repo automatici, niente SAML SSO. **Per ora nessuno di questi è rilevante** dato che sei sole-coder.

Quando ha senso passare a `Organization` (oggi: no):
1. Quando inizi a collaborare con almeno 1 altro dev stabilmente.
2. Quando vuoi separare l'identità del progetto (`Heuresys`) dalla tua identità personale (`Spen-Zosky`).
3. Quando il progetto attira sponsor / open-source contributor esterni.

---

## 4. Comandi / checklist

Comandi essenziali per orientarti **adesso**:

```bash
# Vedi info di un repo (CLI)
gh repo view Spen-Zosky/heuresys-advanced

# Stato del tuo account
gh auth status
gh api user --jq '{login, name, company, public_repos, followers}'

# Lista i tuoi repo
gh repo list Spen-Zosky --visibility=public --limit 10
```

```bash
# Lista feature attivate su un repo
gh api repos/Spen-Zosky/heuresys-advanced \
  --jq '{has_issues:.has_issues, has_discussions:.has_discussions,
         has_projects:.has_projects, has_wiki:.has_wiki, has_pages:.has_pages,
         allow_forking:.allow_forking, archived:.archived}'
```

Da Web UI, le 4 tab più importanti di un repo:
1. `Code` — file + README.
2. `Issues` — tracking (di default acceso).
3. `Pull requests` — review (di default acceso).
4. `Actions` — CI/CD (mostrato solo se esiste almeno un `.github/workflows/*.yml`).

---

## 5. Trappole comuni

- **Confondere `git` con `GitHub`** quando si descrive un problema. "Ho fatto un push" è git; "Ho aperto un PR" è GitHub. Tieni la distinzione nel linguaggio.
- **Pensare che GitHub Free abbia limitazioni serie**: in realtà per progetti personal/small business copre il 99% dei casi d'uso. Le quote (2000 min Actions/mese) sono molto generose.
- **Creare repo private "per sicurezza"** quando il codice non ha segreti. Public + .gitignore + secret scanning è di norma più sicuro perché beneficia di tutte le feature gratuite (Code Scanning, Pages, Dependabot Advanced).
- **Trattare il primo commit come definitivo** — il primo commit (init) appare per sempre nella storia con quello username/email. Verifica `git config user.{name,email}` prima di committare la prima volta su una macchina nuova.

---

## 6. Per approfondire

- Doc ufficiale GitHub homepage: <https://docs.github.com>
- **About GitHub**: <https://docs.github.com/en/get-started/onboarding/getting-started-with-your-github-account>
- Pricing details: <https://github.com/pricing>
- Files del curriculum collegati: [02-account-e-repo.md](02-account-e-repo.md), [glossario](../00-glossario.md)
