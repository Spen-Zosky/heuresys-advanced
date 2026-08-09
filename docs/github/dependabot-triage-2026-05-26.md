# Dependabot triage procedure — created 2026-05-26 (S935 SEC base)

**Status**: procedure SHIPPED · **first real execution: 2026-08-09** (cluster Z-230).
**Last triage executed**: **2026-08-09T12:47+02:00** — 5 open PRs classified, see §0.
**Open PRs**: 5 at the 2026-08-09 triage (were 12 at S935 start).

> **What a "triage" is here.** It is the *classification* of every open Dependabot PR into
> one of the four buckets of §1, with the CI state that justifies the call. **Applying** the
> outcome — merge, close, label — is a separate, attended act: merging into `main` arms the
> production deploy watcher, so it is never done from the unattended lane. §0 records what
> was classified and what was deliberately **not** applied.

---

## §0 — Last executed triage: 2026-08-09

Source of truth for this table, re-runnable at any time:

```bash
gh pr list --state open --label dependencies --json number,title -q '.[] | "#\(.number)\t\(.title)"'
gh pr checks <N>          # per-PR CI state
```

| PR | Bump | Kind | CI at triage | Bucket | Applied? |
|---|---|---|---|---|---|
| **#67** | `minor-and-patch` group, 21 updates (next/fastify/vite/playwright/…) | minor+patch | ❌ **`test-integration` fail** (6 other checks pass) | `MERGE_BATCH` | **no** — blocked on red CI, see note (a) |
| **#62** | `fastify-type-provider-zod` 6.1.0 → **7.0.0** | major | ✅ 7/7 pass | `DEFER_MAJOR` | **no** — deferred, §5 |
| **#61** | `typescript` 6.0.3 → **7.0.2** | major (dev) | ❌ **`build-web`, `lint`, `playwright-smoke` fail** | `DEFER_MAJOR` | **no** — deferred, §5 |
| **#60** | `@eslint/js` 9.39.4 → 9.39.5 | patch (dev) | ✅ 4/4 pass | `MERGE_NOW` | **no** — attended act, see note (b) |
| **#58** | `github/codeql-action` 3 → **4** | major (CI action) | ✅ 3/3 pass | `DEFER_MAJOR` | **no** — deferred, §5 |

**Notes taken during this triage:**

- **(a) #67 is not mergeable as-is.** `test-integration` is red. The group carries `next`
  16.2.11 → 16.3.0 and `fastify` 5.10.0 → 5.11.2 together with 19 other bumps: a red
  integration run on a 21-package group needs the failure attributed to a specific bump
  before anything is merged. Do not `@dependabot recreate` it blind — that loses the run.
- **(b) #60 is green and is a dev-only patch**, i.e. a textbook `MERGE_NOW`. It was
  classified but **not merged**: merging is an attended decision (see the box above).
  It is *not* a duplicate of #67 — `@eslint/js` is absent from #67's 21-package list,
  because #60 (2026-07-27) predates the group PR (2026-08-08) and Dependabot does not
  absorb an already-open PR into a later group.
- **No PR was labelled `defer-major`.** The §1 matrix prescribes that label for the
  `DEFER_MAJOR` bucket; the labels on the repo were left untouched by this triage, so
  **§5 below is the only record of the deferral** — do not expect
  `gh pr list --label defer-major` to return anything.

---

## §1 — Triage classification matrix

Dependabot opens one PR per dep upgrade (or one per group, per `.github/dependabot.yml`).
We classify each into one of 4 buckets:

| Bucket | Action | Criteria |
|---|---|---|
| **MERGE_NOW** | `gh pr merge --rebase --auto` | Patch or minor bump of dev-only or low-risk dep (eslint plugins, types, vitest, playwright). No breaking changes per upstream changelog. CI green. |
| **MERGE_BATCH** | Group merge in one commit | Multiple compatible minor/patch bumps in same dep family. Since the `minor-and-patch` group exists in `.github/dependabot.yml`, Dependabot already batches these into a single PR — this bucket now mostly means "the group PR". Reduces commit noise. |
| **DEFER_MAJOR** | Add label `defer-major`, leave open | Any major version bump. Schedule review for an attended session with a breaking-changes audit. Log the decision in §5. |
| **CLOSE_DUPLICATE** | Close + comment "superseded by #N" | Stale PRs where a later PR bumps the same package to a higher version. Check the group PR's package list before assuming a standalone PR is superseded — see §0 note (b). |

---

## §2 — Pre-merge checks (per PR)

For each `MERGE_NOW` candidate, verify locally before merging via `gh`:

```powershell
# 0. Remote CI state first — cheapest signal
gh pr checks <PR_NUM>

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

## §3 — qs resolution verification

Historic reason: the S935 SEC base pinned `qs` to `>=6.15.2` via a `pnpm.overrides` entry,
and the risk was a *dual resolution* leaving an older `qs` somewhere in the tree.

```bash
pnpm why -r qs
```

⚠️ **Use `-r`.** In this pnpm monorepo `pnpm why qs` without `-r` inspects only the root
workspace and prints **nothing at all, with exit code 0** — which reads exactly like "the
package is absent" when it is in fact present in a child workspace.

**Verified 2026-08-09**: single resolution, **`qs 6.15.3`** on every path — above the
`>=6.15.2` floor. It enters through one chain only:
`@heuresys/agent-gateway → @anthropic-ai/claude-agent-sdk → @modelcontextprotocol/sdk → express 5.2.1 → (body-parser →) qs`.
No application workspace depends on it directly.

**Recovery**, if a dual resolution ever reappears — add a path-specific override:

```json
"pnpm": {
  "overrides": {
    "qs": ">=6.15.2",
    "express>qs": ">=6.15.2"
  }
}
```

---

## §4 — pnpm audit gate

After all merges:

```bash
pnpm audit --audit-level=moderate
```

**Result on 2026-08-09**: `1 vulnerabilities found — Severity: 1 high`.

The single finding is **`brace-expansion` GHSA-rgw5-rvv9-x895** (DoS, unbounded intermediate
arrays), reported on 19 paths that all reach it through the **lint toolchain**
(`eslint-config-next → … → @typescript-eslint/typescript-estree → minimatch@10.2.5 →
brace-expansion@5.0.8`). This is **not an untriaged alert**: it is the known, assessed and
accepted risk tracked as **D-77** in `docs/kb/DEBT_REGISTER.md`, where the advisory's own
version ranges are shown to be stale against the retro-ported fixes, with the advisory
payload executed against each installed line as evidence.

If a *new* finding appears — one that is not already a row in the debt register:

1. Note CVE/GHSA ID + affected package + version range.
2. Check whether upstream has a fix in a newer version → open a manual PR.
3. If no upstream fix exists, or the fix is not applicable, **add a row to
   `docs/kb/DEBT_REGISTER.md`** with the risk assessment and the re-open trigger.
   That register is the single home for accepted security risk on this repo.

> A security alert that cannot be closed is **not an open pendency**, provided the risk is
> accepted in writing. The question to ask is never "are there zero alerts?" — it is
> "does every open alert appear in the debt register?".

---

## §5 — Defer-major decisions log

These rows are the deferral record, and they must **coincide with the open major-bump PRs**.
Re-derive the set with the §0 command and compare: every open PR whose bump crosses a major
belongs here, and nothing else does.

### Currently deferred (as of 2026-08-09)

| PR | Package | Current | Proposed | Rationale | Revisit when |
|---|---|---|---|---|---|
| **#62** | `fastify-type-provider-zod` | 6.1.0 | 7.0.0 | The Fastify↔Zod bridge sits under **every** API route's type provider; a major here changes the schema-to-type contract repo-wide. CI is green, which makes it tempting — but green CI proves the build, not the runtime response shapes. Needs an attended pass with the contract layer in `packages/shared`. | An attended session with budget for a cross-workspace schema review. |
| **#61** | `typescript` | 6.0.3 | 7.0.2 | TS 7 is the native-port compiler. **CI is red on 3 checks** (`build-web`, `lint`, `playwright-smoke`) — the toolchain (typescript-eslint, Next, vitest) is not ready. | `typescript-eslint` and Next declare TS 7 support, and #61's CI turns green on rebase. |
| **#58** | `github/codeql-action` | 3 | 4 | CI action major: changes the CodeQL bundle/runner contract for the security workflow. Low blast radius on the product, but it is the scanning gate itself — a silent downgrade of coverage would not be visible in a green run. | Batched with a review of the CI workflows, attended. |

### Deferrals from the S935 baseline that were since EXECUTED

Kept so the history is not lost — none of these are pending any more (verified 2026-08-09
against the workspace manifests):

| Package | Deferred at S935 | Actual today | Outcome |
|---|---|---|---|
| `zod` | 3.25.76, major 4 deferred | **4.4.3** | **Done** — the 3→4 migration was carried out (`docs/superpowers/plans/2026-05-28-zod4-ftpz6-migration.md`). |
| `next` | 15.5.18, major 16 deferred as "high-risk" | **16.2.11** | **Done** — the 16.x major landed. #67 now proposes the 16.3.0 minor. |
| `react` | 19.2.5 | **19.2.8** | Patch line followed; still no major available. |
| `vitest` | 4.1.6, "major 5.x not yet released" | **4.1.10** | Patch line followed; 5.x still not proposed by Dependabot. |
| `@tanstack/react-query` | 5.62.16 | **5.101.4** | Minor line followed; no major proposed. |

---

## §6 — How to re-run this triage

**There is no apply script.** A PowerShell `dependabot-triage.ps1` was sketched inside this
document at S935 and never implemented — no such file was ever added to the repo. The sketch
has been removed rather than left to look like a tool that exists. The triage is five commands, and the classification is the judgement call
that a script would not make well anyway.

```bash
# 1. What is open, in comparable form
gh pr list --state open --label dependencies --json number,title -q '.[] | "#\(.number)\t\(.title)"'

# 2. CI state for each
gh pr checks <N>

# 3. What a group PR actually contains (before calling anything a duplicate)
gh pr view <N> --json body -q .body | head -40

# 4. The two standing gates
pnpm why -r qs                       # §3
pnpm audit --audit-level=moderate    # §4

# 5. Classify into the §1 buckets, then update §0 and §5 of this file with the date.
```

Applying an outcome, once decided in an attended session:

```bash
gh pr merge <N> --rebase --delete-branch     # MERGE_NOW / MERGE_BATCH
gh pr edit <N> --add-label defer-major       # DEFER_MAJOR
gh pr close <N> --comment "superseded by #M" # CLOSE_DUPLICATE
```

---

## §7 — Related

- `docs/github/branch-protection.md` (S935 SEC base companion)
- `docs/ci/self-hosted-runners-setup.md` — the workflows that produce the merge-gating checks
- `docs/kb/DEBT_REGISTER.md` — **D-77**, the accepted `brace-expansion` risk referenced in §4
- `.github/dependabot.yml` — the live config: weekly npm + github-actions, `minor-and-patch`
  group, `open-pull-requests-limit: 5`, and an `ignore` on `@types/node` majors (the runtime
  is pinned to Node 22)
- `package.json` → `pnpm.overrides`. **Do not copy the list into prose** — it was enumerated
  here as 9 entries while the real count had grown to 25, and `uuid` had become the
  path-scoped `exceljs>uuid`. Re-derive it instead:

  ```bash
  node -e "const o=require('./package.json').pnpm.overrides; console.log(Object.keys(o).length + ': ' + Object.keys(o).join(', '))"
  ```

- CVE-2026-41907 `uuid` (closed in X19.A — `b01c331`); the `qs` pin (closed in `c304b02` +
  the `pnpm.overrides` entry, still in force — see §3)
