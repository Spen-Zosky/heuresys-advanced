# Branch Protection Rules — canonical configuration

**Updated**: 2026-05-26 (S935 SEC base)
**Branch**: `main`
**Status**: ACCEPTED (canonical — apply via GitHub UI or `gh api` script, see §3)

---

## §1 — Purpose

Protect `main` from accidental destructive changes while preserving Cowork/CLI autonomy for shipping work. Aligns with R12 (git safety cross-project) of CLAUDE.md and supports CI gates that come online with S935 phase F (CI workflows + dual self-hosted runners).

---

## §2 — Required rules on `main`

The following rules are enforced via GitHub branch protection at `Settings → Branches → Add rule → Branch name pattern: main`.

| Rule | Setting | Rationale |
|---|---|---|
| Require a pull request before merging | **OFF** (preserve autonomy) | Cowork+CLI ship directly to main per workflow. PR gate would block autonomy contract. |
| Require status checks to pass before merging | **ON** | Once CI workflows online (S935 phase F), checks become gating. Specific checks listed below. |
| Required status checks (S935 phase F+) | `typecheck`, `lint`, `i18n-parity`, `test-integration`, `build-web`, `playwright-smoke` | All must report success on the commit before push acceptance. |
| Require branches to be up to date before merging | **ON** | Forces rebase if behind origin/main. Prevents stale-state pushes. |
| Require linear history | **ON** | No merge commits on main. All commits are fast-forward (rebase or atomic commit). Aligns with current commit log style (atomic features). |
| Require signed commits | **OFF** (defer) | Useful for prod org; deferred until Cowork+CLI gpg-sign setup is documented. |
| Include administrators | **ON** | Even admin pushes go through CI gates. R12 hardening. |
| Restrict who can push to matching branches | **OFF** (single-owner repo) | Owner: spen-zosky. Future team setup → restrict to team. |
| Allow force pushes | **OFF** | R12 hard rule: never `git push --force` on main. |
| Allow deletions | **OFF** | Main is canonical; never deleted. |

---

## §3 — Apply script (via `gh` CLI)

```powershell
# scripts/setup-branch-protection.ps1
# Requires: gh CLI authenticated with admin scope on repo.

$repo = "Spen-Zosky/heuresys-advanced"
$branch = "main"

$body = @{
    required_status_checks = @{
        strict = $true
        contexts = @(
            "typecheck",
            "lint",
            "i18n-parity",
            "test-integration",
            "build-web",
            "playwright-smoke"
        )
    }
    enforce_admins = $true
    required_pull_request_reviews = $null  # OFF — autonomy preserved
    restrictions = $null
    required_linear_history = $true
    allow_force_pushes = $false
    allow_deletions = $false
    required_conversation_resolution = $false
    lock_branch = $false
} | ConvertTo-Json -Depth 5 -Compress

$body | & gh api -X PUT "/repos/$repo/branches/$branch/protection" --input -
```

**Pre-apply check**: ensure the 6 status check contexts will actually exist (post S935 phase F workflows). If not yet, omit `required_status_checks` for now and add them incrementally as workflows ship.

---

## §4 — CODEOWNERS (deferred)

When team scales beyond single owner, add `.github/CODEOWNERS` mapping ownership per area:

```
# Backend
apps/api/  @backend-team

# Frontend
apps/web/  @frontend-team

# Brownfield engine
apps/api/src/modules/brownfield-wave-executor/  @data-platform-team

# Migrations
db/migrations/  @data-platform-team @backend-team
```

Branch protection rule "Require review from Code Owners" can then be enabled to enforce review per area without blocking autonomy on non-owned files.

---

## §5 — Audit & verification

```powershell
# Verify current protection state
gh api "/repos/Spen-Zosky/heuresys-advanced/branches/main/protection" | jq .
```

Expected output keys: `required_status_checks`, `enforce_admins.enabled = true`, `allow_force_pushes.enabled = false`, `allow_deletions.enabled = false`, `required_linear_history.enabled = true`.

---

## §6 — Related

- CLAUDE.md (R12 git safety cross-project)
- `docs/github/dependabot-triage-2026-05-26.md` (S935 SEC base companion doc)
- S935 phase F CI workflows (`.github/workflows/*.yml`)
