# Dependabot triage procedure — 2026-05-26 (S935 SEC base)

**Status**: Procedure SHIPPED and executed. The triage is run by hand with the `gh` CLI. The automation script sketched in the original draft was never implemented; the reference to it has been removed rather than left as a promise (Z-230).
**Last triage executed**: **2026-08-09 — 5 open dependency PRs classified: #67 and #60 to MERGE_BATCH, #62 / #61 / #58 to DEFER_MAJOR**
**Last dependency PR merged**: #53 `next 16.2.9 → 16.2.11`, merged 2026-07-23.
**Dependabot config**: `.github/dependabot.yml` (minor and patch bumps are grouped, which is why a single PR can carry 21 updates).

---

## §1 — Triage classification matrix

Dependabot opens one PR per dep upgrade (minor/patch bumps arrive grouped). We classify each into one of 4 buckets:

| Bucket | Action | Criteria |
|---|---|---|
| **MERGE_NOW** | `gh pr merge --rebase --auto` | Patch or minor bump of dev-only or low-risk dep (eslint plugins, types, vitest, playwright). No breaking changes per upstream changelog. CI green. |
| **MERGE_BATCH** | Group merge in one commit | Multiple compatible minor/patch bumps in the same dep family, or the grouped `minor-and-patch` PR that Dependabot opens by config. Reduces commit noise. |
| **DEFER_MAJOR** | Leave open, record the row in §5 | Any major version bump. Each deferred major must appear in §5 with a rationale and a revisit condition, otherwise the deferral is invisible. |
| **CLOSE_DUPLICATE** | Close + comment "superseded by #N" | Stale PRs where a later PR bumps to a higher version. |

> **The `defer-major` label is not in use.** The original draft told the operator to add it; no open PR carries it (`gh pr list --label dependencies --json number,labels`, 2026-08-09 — every open PR carries `dependencies` only). §5 of this file is the register of deferrals, and it is the only one. If the label is ever introduced, this section and §5 must be reconciled in the same change.

---

## §2 — Pre-merge checks (per PR)

For each `MERGE_NOW` / `MERGE_BATCH` candidate, verify locally before merging:

```bash
gh pr checkout <PR_NUM>
pnpm install                          # re-resolve the lockfile
pnpm typecheck                        # exit 0
pnpm lint                             # exit 0
pnpm test                             # requires the SSH tunnel on 5433 to be up
pnpm --filter @heuresys/web build     # catches Next/React peer-dep drift
gh pr merge <PR_NUM> --rebase --delete-branch
```

CI is the second opinion, not the first: `gh pr checks <PR_NUM>` before merging.

For `MERGE_BATCH`: check out each branch sequentially, accumulate into a single rebase, then merge.

---

## §3 — qs resolution check (post-merge)

Post-S935 SEC base: `qs` must resolve to `>= 6.15.2` everywhere in the tree.

```bash
pnpm why -r qs
```

Verified 2026-08-09: every resolution converges on **6.15.3** — a single version across the workspace, no split resolution. If a `6.15.1` or earlier ever reappears, it will come from a transitive with its own pin; add a path-specific override under `pnpm.overrides` in the root `package.json`.

---

## §4 — pnpm audit gate

After all merges:

```bash
pnpm audit --audit-level=moderate
```

**Expected result is not zero.** As of 2026-08-09 the command reports **1 high — `brace-expansion` (GHSA-rgw5-rvv9-x895 / CVE-2026-14257)**, reachable only through the lint toolchain (`eslint-config-next` → `@typescript-eslint/*` → `minimatch` → `brace-expansion`, 19 paths).

That finding is **known and governed as D-77** in `docs/kb/DEBT_REGISTER.md`: the fix exists on all three installed major lines and the override minimums in the root `package.json` are pinned above the first version proven sane on each line — proven by executing the advisory payload, not by reading changelogs. The GitHub advisory, however, only declares `fixed 5.0.8`, so the back-ported patches on the 1.x and 2.x lines still compare as vulnerable under semver, and the alert cannot be closed by upgrading. Unifying every line onto `^5.0.8` has been measured and rejected — it breaks ESLint.

So the gate reads: **1 high, and it must be that one.** Any *other* advisory, or any change in the path that reaches it, is a new finding — triage it and add a row to `docs/kb/DEBT_REGISTER.md`. Do not "resolve" D-77 by relaxing the override minimums; those minimums are what keeps a `pnpm install` from silently landing on a vulnerable version.

---

## §5 — Deferred majors

### Currently deferred

Verified against `gh pr list --state open --label dependencies` on 2026-08-09. Every open major bump appears here; nothing else is deferred.

| PR | Package | Bump | Rationale | Revisit when |
|---|---|---|---|---|
| **#62** | `fastify-type-provider-zod` | 6.1.0 → 7.0.0 | The type provider sits between Fastify 5 and the shared Zod contract layer, so a major touches how every route's schema is wired. Needs a typecheck sweep across `apps/api` plus a green integration run before it can be trusted. | The API contract layer is otherwise quiet — merging it next to unrelated route work makes a failure impossible to attribute. |
| **#61** | `typescript` | 6.0.3 → 7.0.2 | Compiler major across a workspace that runs `strict` plus `noUncheckedIndexedAccess`, `noUnusedLocals` and `noUnusedParameters`. New inference in a major routinely surfaces errors in code that never changed. | Budget exists for a full `pnpm typecheck` + `pnpm typecheck:test` sweep and for fixing whatever it surfaces, in its own commit. |
| **#58** | `github/codeql-action` | 3 → 4 | CI-only, but it changes the action that produces the security signal in `.github/workflows/codeql.yml`. A silent behaviour change here degrades scanning without failing anything. | It can be merged on its own and observed for one full CodeQL run, rather than inside a batch. |

### Deferrals from the S935 baseline — all resolved

The original table deferred five packages. None of those deferrals is still live; the repo moved past every one of them, which is precisely why this document had gone stale (Z-230).

| Package | Deferred at | State on 2026-08-09 |
|---|---|---|
| zod | 3.25.76, major 4.x deferred | **Superseded** — the workspace is on `4.4.3`. |
| next | 15.5.18, major 16.x deferred as high-risk | **Superseded** — the workspace is on `16.2.11`. |
| react | 19.2.5, "already latest" | Moved on to `19.2.8` by patch bumps. |
| vitest | 4.1.6, major 5.x "not yet released" | Moved on to `4.1.10`. Still no 5.x. |
| @tanstack/react-query | 5.62.16, major 6.x "not yet announced" | Moved on to `5.101.4`. Still no 6.x. |

---

## §6 — Running the triage

There is no script. The original draft carried a `param()`/`foreach` sketch presented as a file that does not exist in the repo, which made the procedure look automated when it never was. The triage is four commands:

```bash
# 1. what is open, and how old
gh pr list --state open --label dependencies --json number,title,createdAt

# 2. is CI green on the one you intend to merge
gh pr checks <PR_NUM>

# 3. merge the low-risk ones (after the §2 gates)
gh pr merge <PR_NUM> --rebase --delete-branch

# 4. close a superseded duplicate, naming its successor
gh pr close <PR_NUM> --comment "superseded by #<N>"
```

Anything classified `DEFER_MAJOR` in step 1 gets a row in §5 in the same sitting. A deferral that is not written down is indistinguishable from a PR nobody looked at — that is the failure mode this document exists to prevent.

---

## §7 — Related

- `docs/github/branch-protection.md` — S935 SEC base companion.
- `docs/kb/DEBT_REGISTER.md` — where a surviving advisory becomes a tracked debt (D-77 for `brace-expansion`).
- `.github/dependabot.yml` — grouping and schedule.
- `.github/workflows/codeql.yml` — the scanning workflow that PR #58 would upgrade.
- Root `package.json`, `pnpm.overrides` — the security pins live there and are **not** duplicated here on purpose: the previous revision of this file carried a hand-copied list that had drifted (it named `uuid` as a direct override when it is scoped as `exceljs>uuid`, and omitted a dozen entries added since). Read the file. Note the two shapes it uses: per-major keys (`brace-expansion@1`, `@2`, `@5`) where the lines cannot be unified, and path-scoped keys (`exceljs>uuid`) where only one consumer is being pinned.
- CVE-2026-41907 uuid (closed in X19.A — `b01c331`); qs (closed in `c304b02` + override pin).
