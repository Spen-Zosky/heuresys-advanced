# 05.3 · Code scanning con CodeQL

> **Code scanning** analizza il tuo codice per vulnerabilità di sicurezza (SQL injection, XSS, path traversal, ecc.) e bug di alta qualità. Il default engine è **CodeQL**, sviluppato da GitHub. Gratis sui repo public. Per private serve Advanced Security (Enterprise tier).

---

## 1. Concetto

CodeQL è un'analisi **semantica**: invece di pattern-matching superficiale come la maggior parte dei linter, costruisce un'astrazione del flusso di dati nel codice e fa query strutturate.

Esempio: rileva un SQL injection seguendo il path "input utente HTTP → variabile → concatenazione SQL → execute" attraverso decine di funzioni.

Linguaggi supportati: C/C++, C#, Go, Java/Kotlin, JavaScript/TypeScript, Python, Ruby, Swift.

### Trigger tipici

Code scanning gira via GitHub Actions:
- A ogni push su `main`.
- A ogni PR (mostra alert come comment inline).
- Su schedule (es. weekly per scoprire CVE in librerie).

### Format SARIF

Code scanning consuma file **SARIF** (Static Analysis Results Interchange Format) — standard universale per risultati di static analysis. Significa: non sei legato a CodeQL — qualsiasi tool che emette SARIF (ESLint, Semgrep, Snyk, ecc.) può inviare alert a GitHub.

### Severity levels

| Level | Esempio | Azione consigliata |
|---|---|---|
| `error` (critical) | SQL injection sfruttabile | Fix immediato |
| `error` (high) | XSS reflected | Fix prossimo PR |
| `warning` | Hardcoded crypto key | Pianifica |
| `note` | Best practice violation | Backlog |

---

## 2. Modello mentale

```
                  ┌────────────────────────────────────┐
                  │       SOURCE CODE                  │
                  └────────────────┬───────────────────┘
                                   │ push / PR / schedule
                                   ▼
                  ┌────────────────────────────────────┐
                  │  Workflow: codeql.yml              │
                  │   1. github/codeql-action/init     │
                  │   2. build (autobuild o custom)    │
                  │   3. github/codeql-action/analyze  │
                  │      → emette SARIF                │
                  └────────────────┬───────────────────┘
                                   │ upload
                                   ▼
                  ┌────────────────────────────────────┐
                  │  GitHub Security tab               │
                  │   - Alert dashboard                │
                  │   - PR inline comments             │
                  │   - Tracking risolti vs riapparsi  │
                  └────────────────────────────────────┘
```

---

## 3. Applicato ai nostri repo

### Stato attuale

| Repo | Code scanning |
|---|---|
| `heuresys-advanced` | ❌ non attivo |
| `ux-design-shared` | ❌ non attivo |

Entrambi i repo gravitano su TypeScript + JavaScript, perfettamente supportati da CodeQL. Attivarlo è gratis.

### Setup proposto

Per ognuno dei due repo, file `.github/workflows/codeql.yml`:

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1"   # Lunedì 06:00 UTC

permissions:
  actions: read
  contents: read
  security-events: write

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript]

    steps:
      - uses: actions/checkout@v4

      - name: Init CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: security-and-quality   # opzionale: include query "code quality" oltre security

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Analyze
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

### Categorie di query

Tre packs disponibili (in ordine crescente di rumore):

| Pack | Cosa contiene | Quando usarlo |
|---|---|---|
| `security-extended` (default) | Solo security (~30 query) | Repo dove security è top priority |
| `security-and-quality` | Security + code quality (~100 query) | Default raccomandato per repo "normale" |
| `code-scanning` | Tutto + sperimentali | Audit di sicurezza approfondito |

Override nel workflow:
```yaml
queries: security-extended
```

### Cosa rileverebbe nei nostri repo

Pattern probabili su `heuresys-advanced/apps/api`:
- **SQL injection**: il codice usa raw parametrized SQL (corretto), ma CodeQL verifica string concatenation. Probabile 0 alert qui.
- **Path traversal**: niente file IO da user input — probabile 0 alert.
- **Cryptographic weak random**: se usa `Math.random()` per token, alert. Per fortuna usa `crypto.randomBytes()` — 0 alert.
- **Hardcoded credentials**: se trova qualcosa, è da rimuovere subito.

Pattern probabili su `ux-design-shared`:
- **XSS via dangerouslySetInnerHTML**: se qualche componente lo usa con input utente non sanitizzato.
- **Open redirect**: se usa `window.location = userInput`.

Difficile prevedere prima di runnarlo. Vale la pena attivarlo per scoperta.

### Alert lifecycle

1. CodeQL trova un alert → status `Open` con severity.
2. Mostrato in `Security` tab + comment inline sul PR che l'ha introdotto.
3. Possibili azioni:
   - **Fix nel codice** → al prossimo run, alert chiuso automaticamente (status `Fixed`).
   - **Dismiss as false positive** → status `Dismissed` con reason.
   - **Dismiss as won't fix** → idem ma è un'ammissione di accettazione del rischio.
4. Se l'alert riappare in un PR, è bloccato (se branch protection lo richiede).

---

## 4. Comandi / checklist

### Setup via Web UI

```
Settings → Code security → Code scanning → Set up
```

GitHub propone un wizard con il workflow YAML pre-compilato. Accetta il default → push del workflow → primo run automatico.

### Setup via gh CLI

```bash
mkdir -p .github/workflows
# Salva codeql.yml come sopra
git add .github/workflows/codeql.yml
git commit -m "ci: enable CodeQL code scanning"
git push
```

Primo run parte automaticamente al push.

### Vedere risultati

```bash
# Lista alert
gh api repos/Spen-Zosky/heuresys-advanced/code-scanning/alerts \
  --jq '.[] | {number, state, severity: .rule.severity, rule: .rule.id}'

# Singolo alert
gh api repos/Spen-Zosky/heuresys-advanced/code-scanning/alerts/1
```

Web UI: `Security` tab → `Code scanning`.

### Tool alternativi che emettono SARIF

Setup ESLint + SARIF reporter:

```yaml
- name: ESLint with SARIF
  run: |
    npm install --save-dev @microsoft/eslint-formatter-sarif
    npx eslint . --ext .ts,.tsx --format @microsoft/eslint-formatter-sarif --output-file eslint-results.sarif
  continue-on-error: true

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: eslint-results.sarif
    category: eslint
```

Idem per Semgrep:
```yaml
- uses: returntocorp/semgrep-action@v1
  with:
    config: p/security-audit
- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: semgrep.sarif
```

### Custom CodeQL query

Per writing custom query (avanzato), serve installare CodeQL CLI:

```bash
# Mac
brew install codeql

# Crea query file
cat > my-query.ql <<'EOF'
import javascript

from CallExpr c
where c.getCalleeName() = "eval"
select c, "Avoid eval"
EOF

# Esegui
codeql database create db --language=javascript --source-root=.
codeql query run my-query.ql --database=db
```

Le query custom sono inserite nel pack via `queries:` nel workflow.

### Checklist code scanning setup

- [ ] Crea `.github/workflows/codeql.yml` (template Web UI o copia sopra).
- [ ] Decidi query pack: `security-and-quality` raccomandato.
- [ ] Schedule weekly per pickup CVE in deps.
- [ ] Commit + push → primo run.
- [ ] Audit primi alert: chiudi false positive, fixa veri bug.
- [ ] (Opzionale) Aggiungi ESLint/Semgrep come secondo scanner SARIF.
- [ ] Branch protection: aggiungi `CodeQL` come `Required status check` (PR rosso se introduce alert critical).

---

## 5. Trappole comuni

- **Autobuild fallisce su monorepo**: il default `autobuild` non capisce bene pnpm workspaces. Override esplicito:
  ```yaml
  - uses: pnpm/action-setup@v4
    with: { version: 9 }
  - run: pnpm install --frozen-lockfile
  - run: pnpm typecheck
  ```
  Skip `autobuild`, fai tu i setup step.

- **Alert su file generato** (`dist/`, `coverage/`): aggiungi a `paths-ignore`:
  ```yaml
  - uses: github/codeql-action/init@v3
    with:
      languages: javascript-typescript
      paths-ignore: |
        dist/
        coverage/
        node_modules/
        **/*.test.ts
  ```

- **Run troppo lento** (>15 min): se il codebase è grande, CodeQL può richiedere 20-60 min. Mitigation:
  - `timeout-minutes: 30` per fallire fast.
  - Riduci a `security-extended` (meno query) se hai accettato code quality non-critical.

- **Falsi positivi ricorrenti**: per false-positive del codice tuo (non bug in CodeQL), aggiungi inline suppression:
  ```typescript
  // codeql[js/some-rule-id]
  doSomethingThatLooksScaryButIsNot();
  ```
  Oppure dismissi via Web UI con reason.

- **Alert su test code**: i test usano spesso pattern "scary" (eval-like, hardcoded mock secret). Escludi `**/*.test.ts` da scan.

- **Branch protection blocca merge per alert non-tuo**: se attivi `CodeQL` come required status check, un alert pre-esistente blocca tutti i merge finché non fixi. Per onboarding meno traumatico: enable scan senza marcarlo "required" inizialmente.

- **SARIF size limit**: GitHub accetta max 25MB SARIF + 1000 result per upload. Repo enormi (10k+ file) possono superarlo.

- **CodeQL su PR da fork**: il workflow gira con `pull_request:` ma con permission limitate (no `security-events: write`). Risultato: scan parte ma upload fail. Mitigation: `pull_request_target:` (con cautela), o solo enable scan sui PR interni.

---

## 6. Per approfondire

- **About code scanning**: <https://docs.github.com/en/code-security/code-scanning>
- **CodeQL queries**: <https://codeql.github.com/codeql-query-help/>
- **Configuring CodeQL**: <https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning>
- **CodeQL CLI**: <https://codeql.github.com/docs/codeql-cli/>
- **SARIF spec**: <https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html>
- **Awesome SARIF tools**: <https://github.com/microsoft/sarif-tutorials>
- File curriculum: [02-dependabot.md](02-dependabot.md) · [05-branch-protection.md](05-branch-protection.md)
