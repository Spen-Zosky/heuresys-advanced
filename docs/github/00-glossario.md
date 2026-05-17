# Glossario

> Termini chiave dell'ecosistema GitHub, in ordine alfabetico. Ogni voce ha (a) la definizione operativa in 1-2 righe, (b) il link alla doc ufficiale per il dettaglio. Quando un termine è introdotto la prima volta in un capitolo del curriculum, viene messo in **grassetto** e linkato qui.

> **Mapping IT↔EN**: i termini sono in inglese (lo standard GitHub) ma quando esiste una traduzione italiana ricorrente la riporto tra parentesi.

---

## A

- **Action** — unità riusabile di codice eseguibile in un `workflow`. Pubblicata sul Marketplace o ospitata in un repo. → [docs](https://docs.github.com/en/actions/sharing-automations/creating-actions/about-custom-actions)
- **Allow forking** — flag a livello repo che abilita altri utenti a creare un fork. Default `true` per repo pubblici. → [docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-the-forking-policy-for-your-repository)
- **Anchor link** — link `#nome-sezione` ai heading di un file Markdown su GitHub. Generato automaticamente da GFM.
- **Artifact** — file prodotto da un `job` di un workflow, scaricabile dalla UI o passabile a un altro job. Vive 90 giorni di default. → [docs](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)
- **Audit log** — registro di tutte le azioni amministrative su un account/organization. → [docs](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)

## B

- **Badge** — immagine SVG dinamica (tipicamente da [shields.io](https://shields.io)) embedded nel README per mostrare build status, license, version, ecc.
- **Branch** — riferimento mobile a una sequenza di commit. Su GitHub esiste sempre un `default branch` (di norma `main`). → [docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository)
- **Branch protection** (regola) — vincolo che blocca push diretti, force-push o richiede review prima del merge su un branch specifico. → [docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)

## C

- **Check run / Check suite** — risultato di un controllo automatico (CI, linter, code scanning) associato a un commit. Visibile come pallino verde/rosso. → [docs](https://docs.github.com/en/rest/checks)
- **CI/CD** — Continuous Integration / Continuous Delivery. Su GitHub si implementa con `GitHub Actions`.
- **Code review** — processo di revisione del codice di un `pull request` da parte di uno o più reviewer.
- **Code scanning** — analisi automatica del codice per vulnerabilità. Engine ufficiale: `CodeQL`. → [docs](https://docs.github.com/en/code-security/code-scanning)
- **Codespaces** — ambiente di sviluppo cloud-hosted con VS Code in browser. Pricing: gratuito 60h/mese per personal account. → [docs](https://docs.github.com/en/codespaces)
- **CodeQL** — engine di analisi statica semantica di GitHub. Linguaggio di query proprietario. → [docs](https://docs.github.com/en/code-security/codeql-cli)
- **Commit** — snapshot del progetto + metadati (autore, data, messaggio). L'unità atomica di git.
- **Composite action** — `Action` scritta come orchestrazione di step shell + altre action, senza scrivere TS/Docker. → [docs](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action)
- **Conventional Commits** — convenzione per messaggi di commit strutturati (`feat:`, `fix:`, `docs:`, ecc.). Usata da `release-please` e simili. → [conventionalcommits.org](https://www.conventionalcommits.org/)

## D

- **Default branch** — branch di riferimento del repo (di norma `main`). Mostrato come HEAD nella UI, è il target naturale dei PR.
- **Dependabot** — bot GitHub che apre PR automatici per aggiornare dipendenze vulnerabili o obsolete. → [docs](https://docs.github.com/en/code-security/dependabot)
- **Deploy environment** — namespace di secrets + variabili + approvazioni associato a un `workflow`. Tipico per stage/production. → [docs](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- **Discussions** — forum integrato nel repo per Q&A, idee, annunci. Distinto da `Issues` per scope (Issues = bug/task; Discussions = conversazione). → [docs](https://docs.github.com/en/discussions)

## F

- **Fine-grained personal access token (PAT)** — token di accesso scoped per repo specifici. Successore dei classic PAT. → [docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- **Fork** — copia indipendente di un repo, tipicamente per contribuire upstream via PR. → [docs](https://docs.github.com/en/get-started/quickstart/fork-a-repo)

## G

- **gh CLI** — terminal client ufficiale GitHub. Espone API REST/GraphQL come comandi `gh <verb>`. → [cli.github.com](https://cli.github.com/)
- **GFM (GitHub-Flavored Markdown)** — superset di CommonMark usato da GitHub: aggiunge task lists, tables, autolink URL, alerts. → [spec](https://github.github.com/gfm/)
- **gist** — snippet di codice/testo come "micro-repo" condivisibile. Single-file o multi-file. → [gist.github.com](https://gist.github.com/)
- **GitHub Apps** — app integrate (vs OAuth apps) con permessi scoped per repo. → [docs](https://docs.github.com/en/apps/creating-github-apps)
- **GitHub Free** — tier gratuito (sia personal che org). Include tutto l'essenziale: repo pubblici/privati illimitati, Actions, Pages, Discussions. Limiti su minuti CI e storage. → [pricing](https://github.com/pricing)
- **GraphQL API** — endpoint alternativo a REST, più flessibile per query complesse. → [docs](https://docs.github.com/en/graphql)

## I

- **Issue** — unità di lavoro/discussione: bug, feature request, task. Ha titolo, body Markdown, label, assignee, milestone. → [docs](https://docs.github.com/en/issues)
- **Issue template** — file Markdown in `.github/ISSUE_TEMPLATE/` che pre-compila il body di nuovi issue. → [docs](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/manually-creating-a-single-issue-template-for-your-repository)

## J

- **Job** — sequenza di step eseguiti su un `runner` come parte di un `workflow`. Jobs possono essere paralleli o dipendere l'uno dall'altro. → [docs](https://docs.github.com/en/actions/using-jobs)

## L

- **Label** — etichetta colorata applicabile a issue, PR, discussions. → [docs](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)
- **LFS (Large File Storage)** — estensione git per file binari grandi (>100 MB). Su GitHub ha quota separata. → [docs](https://docs.github.com/en/repositories/working-with-files/managing-large-files)

## M

- **Marketplace** — catalogo di Action e App pubblicate. → [marketplace](https://github.com/marketplace)
- **Merge** — operazione che integra i commit di un branch in un altro. Modalità: merge commit, squash, rebase.
- **Milestone** — raggruppamento di issue/PR con scadenza opzionale. → [docs](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/about-milestones)

## O

- **OIDC (OpenID Connect)** — protocollo che permette ai workflow GitHub Actions di autenticarsi a cloud provider senza segreti long-lived. → [docs](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- **Organization** — account contenitore di più utenti + repo. Diverso dal personal account (più feature di governance). → [docs](https://docs.github.com/en/organizations)

## P

- **Packages** — registry hosted da GitHub per artefatti (npm, container, Maven, NuGet, RubyGems). → [docs](https://docs.github.com/en/packages)
- **Pages** — hosting statico gratuito per file HTML/CSS/JS/Markdown serviti da un repo. Build da branch o da `workflow`. → [docs](https://docs.github.com/en/pages)
- **PAT (Personal Access Token)** — token alfanumerico che sostituisce la password per autenticazione API/git. Due varianti: classic (deprecata) + fine-grained. → [docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- **Pinned repo** — repo evidenziato sul profilo. Massimo 6.
- **Project (v2)** — board/table/roadmap di issue+PR, anche cross-repo. Successore di Projects classic. → [docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- **Pull request (PR)** — proposta di merge di un branch in un altro, con discussione, review e check automatici. → [docs](https://docs.github.com/en/pull-requests)
- **Push protection** — meccanismo che blocca un push se contiene un segreto rilevato (chiavi API, password). → [docs](https://docs.github.com/en/code-security/secret-scanning/working-with-secret-scanning-and-push-protection)

## R

- **Rebase** — operazione git che riapplica i commit di un branch sopra un altro, riscrivendo la storia. Alternativa al merge.
- **Release** — pubblicazione collegata a un `tag` git, con note, file allegati e checksum. → [docs](https://docs.github.com/en/repositories/releasing-projects-on-github)
- **Repository** — il contenitore primario su GitHub: codice + issue + PR + workflow + wiki + pages. Visibilità: public / private / internal (org-only).
- **Repository topics** — keyword per la discoverability. Massimo 20. → [docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)
- **REST API** — endpoint principale per interagire programmaticamente con GitHub. → [docs](https://docs.github.com/en/rest)
- **Runner** — macchina (cloud o self-hosted) che esegue un `job` di workflow. → [docs](https://docs.github.com/en/actions/hosting-your-own-runners)
- **Ruleset** — sostituto moderno di `branch protection` con regole estensibili e applicabili via pattern. → [docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)

## S

- **Saved replies** — risposte preconfezionate per commenti su issue/PR, utili per rispondere a domande ricorrenti. → [docs](https://docs.github.com/en/get-started/writing-on-github/working-with-saved-replies)
- **Secret** — variabile cifrata accessibile solo dai workflow del repo (o environment). Mai stampata nei log. → [docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- **Secret scanning** — feature di sicurezza che rileva chiavi/password committate (a volte block il push). → [docs](https://docs.github.com/en/code-security/secret-scanning)
- **SemVer (Semantic Versioning)** — convenzione `MAJOR.MINOR.PATCH` per versioni di software. Usato da Releases + npm. → [semver.org](https://semver.org/)
- **Signed commit** — commit con firma crittografica (GPG o SSH). Mostrato come `Verified` nella UI. → [docs](https://docs.github.com/en/authentication/managing-commit-signature-verification)
- **Squash and merge** — modalità di merge che combina tutti i commit del branch in un singolo commit sul target. Ideale per PR feature.
- **Sponsor (GitHub Sponsors)** — programma di funding per developer/maintainer. → [docs](https://docs.github.com/en/sponsors)
- **Status check** — risultato di un check (test, lint, build) richiesto da una `branch protection` rule prima del merge.

## T

- **Tag** — riferimento immutabile a un commit. Usato per marcare release. → [docs](https://git-scm.com/book/en/v2/Git-Basics-Tagging)

## V

- **Visibility** — flag del repo: `public` (chiunque legge), `private` (solo collaborator), `internal` (solo membri org — solo per org Enterprise). → [docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)

## W

- **Webhook** — HTTP POST inviato da GitHub a un URL configurato quando avvengono eventi (push, PR, issue, ecc.). Tipicamente usato per integrazioni custom. → [docs](https://docs.github.com/en/webhooks)
- **Wiki** — pagine Markdown collaborative associate al repo (un altro git repo, in realtà). Spesso sostituito da `docs/**/*.md` + Pages. → [docs](https://docs.github.com/en/communities/documenting-your-project-with-wikis)
- **Workflow** — file YAML in `.github/workflows/*.yml` che descrive una pipeline CI/CD. Triggered da eventi (push, PR, schedule, manuale). → [docs](https://docs.github.com/en/actions/using-workflows)

---

> Il glossario cresce a ogni batch del curriculum. Quando incontri un termine in **grassetto** non presente qui, è un errore di sincronizzazione — segnalalo o aggiungilo.
