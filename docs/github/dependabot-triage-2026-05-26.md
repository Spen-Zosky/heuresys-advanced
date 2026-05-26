# Dependabot triage procedure — 2026-05-26 (S935 SEC base)

**Status**: Procedure SHIPPED; first execution deferred to Windows host (requires `gh` CLI + repo admin).
**Last triage executed**: TBD post-script-run.
**Open PRs at S935 start**: 12 (per PREFLIGHT_REPORT §4 Phase 5 backlog).

---

## §1 — Triage classification matrix

Dependabot opens one PR per dep upgrade. We classify each into one of 4 buckets:

| Bucket | Action | Criteria |
|---|---|---|
| **MERGE_NOW** | `gh pr merge --rebase --auto` | Patch or minor bump of dev-only or low-risk dep (eslint plugins, types, vitest, playwright). No breaking changes per upstream changelog. CI green. |
| **MERGE_BATCH** | Group merge in one commit | Multiple compatible minor/patch bumps in same dep family (Radix, eslint, tanstack). Reduces commit noise. |
| **DEFER_MAJOR** | Add label `defer-major`, leave open | Any major version bump (zod 3→4, next 15→16, react 19→20, vitest 4→5). Schedule review for next sprint with breaking-changes audit. |
| **CLOSE_DUPLICATE** | Close + comment "superseded by #N" | Stale PRs where a later PR bumps to a higher version. E.g. next-15.5.18 PR closed when next-15.5.19 PR opened. |

---

## §2 — Pre-merge checks (per PR)

For each `MERGE_NOW` candidate, verify locally before merging via `gh`:

```powershell
# 1. Checkout the dependabot branch locally
gh pr checkout <PR_NUM>

# 2. Re-install lockfile
pnpm install

# 3. Full workspace gates
pnpm typecheck      # exit 0
pnpm lint           # exit 0
pnpm test           # api integration tests pass (requires SSH tunnel 5433 active)

# 4. Web build (catches Next/React peer-dep drift)
pnpm --filter @heuresys/web build    # exit 0

# 5. If all green → merge
gh pr merge <PR_NUM> --rebase --delete-branch
```

For `MERGE_BATCH`: checkout each branch sequentially, accumulate into a single rebase, then merge.

---

## §3 — qs dual-resolution verification (post-merge)

Critical post-S935 SEC base: ensure `qs` resolves cleanly to `>=6.15.2` across the tree (CVE-2026-XXXX-qs mitigation).

```powershell
pnpm why qs
```

Expected output: all `qs` resolutions converge to `6.15.2` or later. If any pin `6.15.1` or earlier remains, investigate (likely an `axios`/`got` transitive that has its own `qs` pin).

**Recovery**: if dual-resolution persists, add specific transitive override:

```json
"pnpm": {
  "overrides": {
    "qs": ">=6.15.2",
    "axios>qs": ">=6.15.2"   // example specific path
  }
}
```

---

## §4 — pnpm audit gate

After all merges:

```powershell
pnpm audit --audit-level=moderate
```

Expected: `found 0 vulnerabilities of moderate severity or higher`. If any remain:

1. Note CVE ID + affected package + version range.
2. Check if upstream has a fix in a newer version → open manual PR.
3. If no upstream fix → document in `docs/github/known-vulnerabilities.md` with risk assessment and mitigation timeline.

---

## §5 — Defer-major decisions log (S935 baseline)

Major bumps deliberately deferred from S935. Each has a one-line rationale + revisit-by date.

| Package | Current | Available | Rationale | Revisit by |
|---|---|---|---|---|
| zod | 3.25.76 | 4.4.3 | API breaking changes (default error format changed, `z.union` tuple shape). Need cross-workspace schema audit + test rewrite. | MVP-4 stream 2.4 (SDBI Phase 2 — natural amplitude for schema work). |
| react | 19.2.5 | (none planned) | Already at latest stable. | n/a |
| next | 15.5.18 | 15.6.x patch | Patch bump OK via Dependabot; major bump 16.x see CW-B59 Path E (high-risk, deferred). | DEFER-F closure + S936+. |
| vitest | 4.1.6 | 4.x patch | Patch bumps OK. Major 5.x not yet released. | When 5.0 GA + ecosystem mature. |
| @tanstack/react-query | 5.62.16 | 5.x patch | Patch OK; major 6.x not yet announced. | n/a |

---

## §6 — Apply script

```powershell
# scripts/dependabot-triage.ps1
# Walks open dependabot PRs, classifies each by labels + auto-merges
# the MERGE_NOW bucket. Closes duplicates. Adds defer-major labels.
#
# Pre-req: gh auth login completed with admin:org + repo scopes.

param([switch]$DryRun)

$prs = gh pr list --label "dependencies" --state open --json number,title,headRefName,labels | ConvertFrom-Json

foreach ($pr in $prs) {
    $isPatchOrMinor = $pr.title -match "(bump|update).+from\s+(\d+\.\d+\.\d+).+to\s+\2"
    $isMajor = $pr.title -match "from\s+\d+\.\d+\.\d+\s+to\s+(\d+)\.\d+\.\d+" -and `
               $Matches[1] -ne ($pr.title -split "from\s+")[1].Split(".")[0]
    # ... (full classification logic, see template in §1)

    if ($DryRun) {
        Write-Host "Would handle PR #$($pr.number): $($pr.title)"
        continue
    }
    # Actual gh pr merge / gh pr close / gh pr edit --add-label calls go here.
}
```

(Full implementation deferred to Windows host; this doc is the procedure spec. Adapt logic to actual PR titles after `gh pr list`.)

---

## §7 — Related

- `docs/github/branch-protection.md` (S935 SEC base companion)
- S935 phase F CI workflows (provides gating CI checks for status_checks contracts)
- `package.json` `pnpm.overrides` (current overrides: vite, postcss, esbuild, qs, uuid, react, react-dom, @types/react, @types/react-dom)
- CVE-2026-41907 uuid (closed in X19.A — `b01c331`); CVE-XXXX-qs (closed in c304b02 + pnpm override pin)
