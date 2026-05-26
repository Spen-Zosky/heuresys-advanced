# CI workflows overview (S935 phase F)

**Updated**: 2026-05-26
**Total workflows**: 7 (6 new in S935-F + showcase pre-existing)
**Runner**: `oracle-vm-default` (OCI VM ARM64 self-hosted) — setup procedure in `docs/ci/self-hosted-runners-setup.md`.

---

## §1 — Workflow inventory

| Workflow | File | Trigger | Runner | Duration (warm) | Gating? |
|---|---|---|---|---|---|
| Typecheck | `typecheck.yml` | push + PR + dispatch | self-hosted oci-vm | <30s | YES |
| Lint | `lint.yml` | push + PR + dispatch | self-hosted oci-vm | <15s | YES |
| i18n parity | `i18n-parity.yml` | push to apps/web/src/i18n + PR + dispatch | self-hosted oci-vm | <5s | YES |
| Test integration | `test-integration.yml` | push + PR (api+db paths) + dispatch | self-hosted oci-vm | <3min | YES |
| Build web | `build-web.yml` | push (web paths) + PR (web paths) + dispatch | self-hosted oci-vm | <2min | YES |
| Playwright smoke | `playwright-smoke.yml` | push + PR + dispatch | self-hosted oci-vm | <10min | YES |
| Showcase deploy | `showcase.yml` (pre-S935) | push to showcase paths | ubuntu-latest (hosted) | <5min | NO (deploy-only) |

All "Gating? YES" workflows are referenced in `docs/github/branch-protection.md` `required_status_checks` list.

---

## §2 — Path-based scoping (R9 token hygiene applied to CI minutes)

Workflows use `paths` and `paths-ignore` filters to skip when irrelevant files change. Examples:

- `typecheck.yml`: skips when only `docs/**`, `*.md`, `cowork_reserved/**`, `cowork_code_exchange/**`, `.handoff/**`, `qa_artifacts/**`, `sessioni/**` changed.
- `test-integration.yml`: skips when only `apps/web/**` or `apps/showcase/**` changed (web changes can't break API integration tests).
- `build-web.yml`: triggers only when `apps/web/**`, `packages/shared/**`, root `package.json`, or `pnpm-lock.yaml` changed.

This keeps cumulative CI minutes near-zero on doc-only commits (which are frequent in this project).

---

## §3 — Concurrency strategy

Each workflow uses a per-ref concurrency group: `<workflow>-${{ github.ref }}`.

- `cancel-in-progress: true` for typecheck / lint / i18n / build-web (fast, cancel-safe — newer push supersedes older).
- `cancel-in-progress: false` for test-integration + playwright-smoke (test suite mid-flight should complete to avoid flaky DB state).

---

## §4 — Failure handling

- **Typecheck/lint fail** → push rejected by branch protection. Fix in next commit; CI auto-retries on push.
- **Test integration fail** → push rejected. Upload `.vitest-cache/` artifact for forensic. Investigate before pushing again. Common cause: DB schema drift between dev and CI (migrate state mismatch).
- **Playwright smoke fail** → push rejected. Upload `playwright-report/` HTML. Common cause: race conditions on test admin seed (CW-NEW-PF-02 chunked test pattern).
- **Build web fail** → push rejected. Common cause post-S935-C: React peer-dep regression (CW-B59) — verify `pnpm.overrides` for react/react-dom still in place.

---

## §5 — Secrets exposed via runner EnvironmentFile (R11)

Workflow YAML must **never** contain literal secrets. The runner systemd unit reads `/etc/heuresys-runner.env` (mode 600, root-owned) which has:

- `POSTGRES_*` (DB credentials)
- `COOKIE_SECRET` (JWT cookie HMAC)
- `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (base64 of `.secrets/jwt_*.pem`)
- `MFA_ENCRYPTION_KEY` (base64 32 bytes)

Workflows reference these via plain `$POSTGRES_USER` / `${{ env.POSTGRES_USER }}` — no `secrets.POSTGRES_USER` (which would require GitHub Secrets registration). The runner-level approach keeps secrets entirely off GitHub infrastructure.

---

## §6 — Manual workflow dispatch

All workflows have `workflow_dispatch: {}`. Trigger via:

```powershell
gh workflow run typecheck.yml
gh workflow run test-integration.yml
# Or via GitHub UI → Actions → <workflow> → Run workflow
```

Useful for re-running after fixing flaky tests or for ad-hoc verification before opening a PR.

---

## §7 — Adding a new workflow

Follow the established template (see any existing `.yml` for pattern):

1. `runs-on: [self-hosted, oci-vm]` (use ubuntu-latest only for deploy workflows that don't need DB).
2. `concurrency` group per-ref.
3. `paths` / `paths-ignore` filters to scope correctly.
4. `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` (the standard 3-step prologue).
5. `pnpm install --frozen-lockfile --prefer-offline`.
6. Actual job steps.
7. Add the workflow's expected status check context to `docs/github/branch-protection.md` `required_status_checks` if it should gate.

---

## §8 — Cost / quota

Self-hosted runner means **zero GitHub Actions minutes consumed** for these 6 workflows. The only GitHub-hosted workflow remaining is `showcase.yml` (deploys to gh-pages); it runs ~5 times/month at <5min each = <25 GH minutes/month — well within free tier.
