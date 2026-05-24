# heuresys-advanced — STATE

**Updated**: 2026-05-24 GMT+2 (X17 close)
**Branch**: `main` — synced through `9b6d962` X15; **X17 commit `65145d1` local, pending push** (also unpushed: `b5d9fa0` Tappa B, `a0d4545` Tappa E-UI — both already pushed in earlier batches, verify with `git log origin/main..HEAD`)
**Last tag**: `v0.2.1-mvp2a-final` (X16 `75baf54`, pushed)

## Last session brief

Pipeline 5-batch in 1 sessione: X13 coverage hardening → X14 dev-mode baseline 73/125 → X15 prod build 118/125 (CW-B54 surfaced) → X16 prod+env 124/125 + tag `v0.2.1-mvp2a-final` annotated pushed → X16b shell-contract hot-fix → Tappa B Mermaid renderer in `/visualizations/[graphId]` → Tappa E-UI `/me/security` TOTP enrollment page + `mfa-enroll.spec.ts` → X17 D+B combo (CW-B52 recurrence detection — D.1+B already done, shipped D.2 release notes + REPORT 021 + HANDOFF refresh). MVP-2a CERTIFIED + MVP-3 5/6 Tappe shipped.

## Top priorities (next session)

1. **Enzo manuale**: `gh auth login` + `gh release create v0.2.1-mvp2a-final --notes-file qa_artifacts/x17_release_notes_v0.2.1.md --title "MVP-2a final certification"` (~5min). Chiude P1 deferred X17.
2. **MVP-3 Tappa F — @heuresys/ui npm publish** (~2-3h). DRAFT PROMPT 022 ready in `cowork_code_exchange/_00_DRAFT_PROMPT_021_batch_x17_tappa_f.md`. 4 decisioni Enzo pending: naming / build target / version / migration. Promote a `_01_PROMPT_022_batch_x18.md` post-decisioni.
3. **Verify push status** — `git log origin/main..HEAD` deve mostrare solo `65145d1` X17 (X16/X16b/Tappa B/E-UI già pushati). Se più ahead = drift inatteso da investigare prima di X18.

## Open questions

- **Tappa F 4 decisioni**: (1) npm name `@heuresys/ui` vs `@spen-zosky/ui` vs `heuresys-ui` unscoped · (2) build target ESM-only vs CJS+ESM dual vs sorgenti TSX · (3) version 0.0.0 → 0.1.0 vs 1.0.0 · (4) apps/web migration link→versioned post-publish.
- **C18 direction post-Tappa-F**: Brownfield Wave 1 full-47k SQL-side upsert (Tappa D residual) vs MFA login-gating completion (Tappa E full scope) vs MVP-4 kickoff.

## Stack snapshot (deltas vs X13 close)

- **Tag**: `v0.4.0-brand-v1` → `v0.2.1-mvp2a-final` pushed (annotated, X16 `75baf54`)
- **Bias catalog**: 53 → **54** (+CW-B54 Playwright dev-mode JIT jitter under parallel-worker contention, mitigated X15 evidence)
- **CW-B52 recurrence**: X12/X13/X17 (pattern strutturale autonomous-flow + Cowork handoff cycles, structural mitigation = HANDOFF refresh as Block-D-obligatory)
- **E2E spec files**: 18 → **19** (+ `mfa-enroll.spec.ts` Tappa E-UI)
- **Literal `test()`**: 56 → **~58** (+2 mfa-enroll); `playwright --list`: 125 → **127+**
- **Playwright effective PASS**: X16 124/125 (99.2%) in 5.1m vs prod build con `NEXT_PUBLIC_ENABLE_SHOWCASE=1` (1 residual fixed X16b `d00c136`)
- **MVP-3 state**: A ✅ · **B ✅** (Mermaid renderer `b5d9fa0`) · C ✅ · D ✅ (47k residual) · E backend ✅ + **UI ✅** (`/me/security` TOTP enroll `a0d4545`) · **F ⏳** (DRAFT ready) · G ✅
- **Apps/web deps**: +1 `qrcode.react ^4.x` (TOTP QR rendering, ESS-specific, no `@heuresys/ui` pollution)
- **Burn-in methodology**: `NEXT_PUBLIC_*` HTTP-smoke canonical test (findstr inadequate, pattern memo §22 candidate)

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log --oneline -3                                            # 65145d1 X17, a0d4545 Tappa E-UI, b5d9fa0 Tappa B
git log origin/main..HEAD --oneline                             # only 65145d1 expected
git tag --list "v0.2.1*"                                        # v0.2.1-mvp2a-final (local + remote)
source .env && PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT COUNT(*) FROM sys.sys_users"  # 433 NO REGRESSION
readlink -f node_modules/@heuresys/ui                           # /d/ux-design-shared/ui (still symlink, post-Tappa-F will switch to versioned)
```

## Resume protocol

1. Read STATE + `cowork_reserved/HANDOFF_FRESH_SESSION.md` §2 for C18 4-option menu.
2. If user picks **A** (gh release create): manual command, ~5min.
3. If user picks **B** (Tappa F): risolvi 4 decisioni in DRAFT PROMPT, promote a `_01_PROMPT_022_batch_x18.md`, execute.
4. apps/api dev `:3001` may still be running from session; verify via `curl /readyz` or kill if interfering.
5. Push `65145d1` X17 requires explicit Enzo authorization.
