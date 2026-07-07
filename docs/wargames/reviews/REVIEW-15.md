# REVIEW-15 — Adversarial review of `wargames/15-heuresys-pricing.md` (GTM pricing page)

| | |
|---|---|
| **Reviewer** | Independent adversarial reviewer (Fable 5), did NOT author the plan |
| **Date** | 2026-07-06 |
| **Repo evidence** | Read-only recon on `D:\heuresys-advanced` (mounted), same S1016 snapshot the plan was fought on |
| **Verdict** | **PASS-WITH-PATCHES** |

**Verdict: PASS-WITH-PATCHES.** The plan's recon is the most accurate I have reviewed in this batch — every headline factual claim survived verification, most with exact file:line precision. The 000153 delayed-detonation red-team catch is REAL and correctly patched. What keeps it from a clean PASS: two MEDIUM gaps in fork F-B leave the executor judgment calls (SUCCESS #3/#8) exactly at the mission's declared center of gravity — the "numbers as data" promise.

---

## 1. SPOT-CHECK OUTCOMES (12 claims + 11 secondary — 0 wrong)

| # | Plan claim | Verified evidence | Outcome |
|---|---|---|---|
| S1 | 000153 tail DO-block raises on `lead_source NOT IN ('WEBSITE','INVESTOR','DEMO')`, hardcoded 3-value list | `db/migrations/000153_lead_source_enum.sql:21-27` — exact: `SELECT count(*) INTO n_bad FROM sys.sys_leads WHERE lead_source NOT IN ('WEBSITE','INVESTOR','DEMO'); IF n_bad <> 0 THEN RAISE EXCEPTION` | ✅ EXACT |
| S2 | `migrate.sh` replays the FULL chain on every run/deploy → detonation scenario real | `db/scripts/migrate.sh:40-45` — unconditional `for f in "${files[@]}"` over ALL `db/migrations/*.sql`, `psql -v ON_ERROR_STOP=1 -1 -f`, audit table is upsert-only (no skip-applied logic). A live PRICING row + unedited 000153 ⇒ RAISE EXCEPTION ⇒ chain aborts at 000153 on the next deploy. Precedent confirmed: D-38 row (`DEBT_REGISTER.md:48`) — deploy S996 aborted at 000078 for an S995 change, fix commit `ac4b723` = scoped-assert edit of the OLD migration. | ✅ REAL — the plan's headline catch is genuine |
| S3 | Census: exactly 6 files hardcode the source values (scope apps/packages/db) | grep `INVESTOR` `*.{ts,tsx,sql}`: within apps/packages/db exactly the 6 named files. Whole-repo adds only `qa_artifacts/schema_snapshot_{before,after}.sql` (generated snapshots, inert — outside the plan's declared scope). | ✅ TRUE in declared scope |
| S4 | i18n namespace declared in BOTH `lib/i18n.ts:32` and `check-i18n-parity.ts:17`; forgetting the script = silently unchecked | `apps/web/src/lib/i18n.ts:32` `NAMESPACES` (exact line); `apps/web/scripts/check-i18n-parity.ts:17` own `NAMESPACES` const (exact line) — the script iterates ONLY its own list, so a new ns absent from it is never compared. V3's count-delta criterion is valid: the script prints `✓ Parity OK (N keys × …)` at :73. | ✅ EXACT — trap + counter both real |
| S5 | Public-page EN = `NEXT_LOCALE` cookie, no `/en` route | `i18n.ts:29` `LOCALE_COOKIE = "NEXT_LOCALE"`, `:66-74` `detectLocale()` cookie→env→"it". No locale routing anywhere in `app/`. Cookie-before-goto works (client-side detect at hydration). | ✅ EXACT |
| S6 | Zero cross-links in the GTM family | grep `href="/(investors\|demo)"` over `apps/web/src` → no matches | ✅ TRUE |
| S7 | `proxy.ts:16` `PUBLIC_PATHS` (7 entries), `isPublic()` special-cases `/` at :19; only web-middleware change needed | `apps/web/src/proxy.ts:16,19` — exact, including prefix-match `startsWith(\`${p}/\`)`. grep `PUBLIC_PATHS` elsewhere in src/tests → nothing (no duplicate allowlist). | ✅ EXACT |
| S8 | `lead-form.tsx:11` union `"WEBSITE" \| "INVESTOR" \| "DEMO"`, honeypot `website`, all labels from `landing` ns, testids as listed | `apps/web/src/components/lead-form.tsx:11` exact; honeypot at :75; `useTranslation("landing")` :12; testids match | ✅ EXACT |
| S9 | POST /v1/leads public, no CSRF, rate-limit 5/60s at `routes.ts:21`; registered `app.ts:436`; `service.ts:26` defaults WEBSITE | `apps/api/src/modules/leads/routes.ts:21` `rateLimit: { max: 5, timeWindow: 60 * 1000 }`, no preHandler on POST; `app.ts:436` exact; `service.ts:26` `source: input.source ?? "WEBSITE"` exact. `csrf.ts:20-49` opt-in decorator confirmed. | ✅ EXACT |
| S10 | D-42 per-IP live precedent at DEBT_REGISTER:52 (7 POSTs → #1-3 200, #4-7 429) | `docs/kb/DEBT_REGISTER.md:52` — exact row, exact numbers, RISOLTO S1002 | ✅ EXACT |
| S11 | 000153 is the ONLY migration asserting lead_source values | grep `lead_source` over `db/migrations` → only 000152 (creates column, asserts `leads:read` role mapping — NOT source values) + 000153. Assert web = 1 file. F-A T2 threshold cannot mis-fire on today's tree. | ✅ TRUE |
| S12 | `LeadResponseSchema.source` is `z.string()` → admin GET needs no change | `packages/shared/src/schemas/leads.ts:39` exact | ✅ EXACT |

**Secondary claims verified**: leads test blocks at :88-96/:98-106/:108-114 (±3 lines, content exact incl. `"HACKER"`→400 and per-POST `remoteAddress`); playwright base config `testDir ./tests/e2e`, `workers:1`, `fullyParallel:false`, `retries:1`, globalTeardown purges `%@leads-e2e.test` (`global-teardown.ts:84`); investors/demo spec pattern verbatim as described (E2E_RUN_ID email, anonymous, success-card assert); migrations 167 files max `000169`; 000142 floor-assert lesson at :38-44; SOT_BACKLOG #4 "candidato: pricing page (serve numeri prezzi/tier)" + `/privacy` stub deferral at **line 27 exactly**; 9 workflow files; GTM 2026-06-22 spec+plan docs exist; root `package.json:35` i18n:check / `:60` eslint-plugin-i18next; 10 locale namespaces; 60 E2E specs; 189 API test files; `landing.spec.ts` asserts hero/wedges/login only (no link-absence assertion — Move 12 safe); D-45 at DEBT_REGISTER:56.

**Trivial drift found (non-material)**: landing `page.tsx` is 58 lines, not 63; demo `LeadForm` at :52, not :53; smoke-suite invocation at `playwright-smoke.yml:186`, not :174. All inside the plan's own "±5 line drift" tolerance and re-derive doctrine.

---

## 2. FINDINGS

### F1 · MEDIUM — `TierPrice` type cannot represent two answers RN-1 itself offers Enzo (Q3 "a scaglioni", Q4 "both+discount")
**Evidence**: Plan Move 9 defines `TierPrice = { amount: number; …; unit: "PER_EMPLOYEE_MONTH" | "PER_TENANT_MONTH" | "FLAT"; billing: "ANNUAL" | "MONTHLY" } | null`. RN-1 Q3 offers Enzo "a scaglioni di dipendenti (LT_50/50_250/250_2000/GT_2000)" and Q4 offers "both + discount %". Neither is expressible: `billing` holds ONE value (no monthly+annual pair, no discount %), `unit` has no band-tiered shape. F-B's core promise — "flipping C→N later = edit this one file… No layout change" (Move 9 Expect) and "numbers are a config fill, not a relayout" (F-B route C) — is FALSE for 2 of the option sets the plan itself puts on Enzo's table. Q4="both" implies a monthly/annual toggle = new UI, unspecified. A blind executor receiving "both, 15% annual discount" has no route: improvise (violates the mission's center of gravity) or stall.
**Patch (exact text to add to Move 9, after the code block)**:
> **Representability guard**: the `TierPrice` shape above covers Q3 ∈ {per-employee, per-tenant, flat} × Q4 ∈ {annual-only, monthly-only}. **Trigger**: if Enzo's answers include Q4="both" (dual billing ± discount) or Q3="a scaglioni" (band-tiered pricing) → do NOT improvise the rendering: (1) extend the config type in the same file (`prices: { billing: "ANNUAL"|"MONTHLY"; amount: number }[]` + optional `bands: { size: LeadCompanySize; amount: number }[]`), (2) add ONE amendment section to the design doc (Move 3 file) specifying the toggle/band rendering (billing toggle = two-button group over the grid, `pricing-billing-toggle` testid; bands = rows inside the card), (3) re-run V1-V3 + the Move 13 digit assertion per rendered state. This is a bounded, in-mission amendment — not a new fork.

### F2 · MEDIUM — Route-C total-silence path is self-contradictory + contains a judgment call (SUCCESS #3/#8 violation)
**Evidence**: RN-1 Q1 default = "3 tier scaffold, tutti contact-us". A4 = "If even route C's tier NAMES **feel like invention** (Q1 unanswered AND Q5 unanswered), ship a single 'contact us' card". Two conflicts: (a) on total silence, RN-1 says 3 cards, A4 says 1 card — a blind executor cannot resolve which wins; (b) "feel like invention" is exactly the kind of judgment call SUCCESS #3 bans; (c) under the 3-card default the executor must INVENT three tier names (there is no Enzo-authored copy) — marketing copy invention on the one axis the mission declares "Enzo's authority, full stop". Note the knock-on: Move 13's `tier-<firstId>` testid and Move 8's `tiers.<id>.*` key tree depend on which mode ships.
**Patch (exact text)** — replace A4's second sentence and RN-1 Q1's default:
> RN-1 Q1 default if withheld: "**single contact-card mode** (see A4 rule)".
> A4 (replace "If even route C's tier NAMES feel like invention…"): "**Deterministic rule, no judgment**: at Move 9, if Q1 is unanswered → ship **single contact-card mode**: `TIERS = [{ id: "contact", price: null }]`, name key `tiers.contact.name` = a neutral non-claim ('Parliamone' / 'Talk to us'), no feature bullets, LeadForm CTA unchanged. If Q1 IS answered (tier count N) but Q5 is not → N cards, names ONLY if Enzo named them, otherwise neutral positional names ('Tier 1..N') flagged `DRAFT — pending Enzo` in the design doc; feature bullets omitted. Tier names containing positioning claims (e.g. 'Enterprise', 'Pro') are Enzo-authored copy — never generated. This rule OVERRIDES the RN-1 Q1 scaffold default."

### F3 · LOW — Move 13 / V8 run the `setup` project (5 real logins + MFA + locale PATCH) as a hidden dependency of an anonymous spec
**Evidence**: `playwright.config.ts:80-88` — pricing.spec matches the `chromium` project which has `dependencies: ["setup"]`; `auth.setup.ts` performs 5 real persona logins (+ TOTP + PATCH `/v1/me/preferences`). Running `pnpm exec playwright test tests/e2e/pricing.spec.ts` therefore triggers all 5 logins per iteration — against the 10/5min login rate-limit the plan itself flags as an S1016 lesson (§1.5) **without giving the counter-move**; in V8 it does this against PROD www (precedent exists — SOT_BACKLOG #4 records "9/9 E2E verdi su www" S1011 — so it works, but it burns half the prod login budget per attempt and PATCHes prod personas' locale).
**Patch (exact text)**: in Move 13 Expect and V8, change the command to `pnpm exec playwright test tests/e2e/pricing.spec.ts --project=chromium --no-deps` (the spec is anonymous — no storageState needed; `--no-deps` skips the 5-login setup). Add to Move 13 Failure list: "**Failure 3**: setup project 429s on login (rate-limit 10/5min after repeated iterations). **Cause**: default project dependency running auth.setup you don't need. **Counter**: `--no-deps` as above; if you omitted it, wait 5 min."

### F4 · LOW — Red-team §7 "minutes apart" supporting claim is wrong for prod-build runs; the margin is 4-of-5, not comfortable
**Evidence**: S985 prod full suite = 200 tests in 9.6 min (~3 s/test, `DEBT_REGISTER:31`). demo/investors/landing/pricing spec files are lexically adjacent with ~2 tests each: the 4 lead submits can land within one 60 s window — the conclusion (4 ≤ 5) still holds, and one `retries:1` double-fire makes 5 = cap. The plan's verdict is right; its justification ("separated by whole spec files, minutes apart") is not. Any FIFTH GTM surface (or 2 flaky retries) busts the cap in full runs.
**Patch (one line in §7)**: replace "minutes apart" with "seconds-to-tens-of-seconds apart in prod build (~3 s/test, S985), worst case 4 submits + 1 retry = 5 ≤ 5 — at the cap: the NEXT GTM surface must stagger (per-spec `waitForTimeout` before submit or distinct email-domain limiter review)".

### F5 · LOW — Move 6 should pin the distinct `remoteAddress` explicitly
**Evidence**: `leads.integration.test.ts:88-96` — the INVESTOR case uses `remoteAddress: "10.10.0.1"` to get its own rate-limit bucket; the comment block at :85-87 explains why. "Mirroring :88-95" implies copying it, but a blind executor may strip what looks like noise. (Today it happens to survive without it — the default bucket holds only 3 POSTs — but that is luck, not spec.)
**Patch**: in Move 6 Action, append: "include a distinct `remoteAddress: "10.10.0.4"` exactly like the :90 pattern (per-IP bucket isolation, comment at :85-87)."

### F6 · INFO — CI does not guard the migration chain
`test-integration.yml` contains no migrate step (grep: zero matches). Move 15's Failure branch ("if CI's migrate step replays the chain") is hypothetical — harmless as written (it's conditional), but the executor should know the chain is proven ONLY by V4 local twice-run + the Move 16 VM deploy; a green CI says nothing about 000153/000170.

### F7 · INFO — Census scope is correct but fragile phrasing
Whole-repo grep for `INVESTOR` returns 8 files (adds 2 generated `qa_artifacts/schema_snapshot_*.sql`). The plan's Move 1 command is correctly scoped (`apps packages db`), so the "expect 6" holds — but if the executor greps repo-wide out of zeal, 8 ≠ 6 could trigger confusion. Optional hardening: note "(a repo-wide grep adds 2 inert `qa_artifacts/schema_snapshot_*.sql` — generated, ignore)".

**No CRITICAL and no HIGH findings.** Notably, the fork F-A machinery (T1/T2/T3), the Move 5 three-part atomic change (000170 + 000153 widening + Zod), the fresh-DB chain-order reasoning (000153 3-value ADD stays, name-guard no-ops after 000170), the twice-run semantics, the additive-CHECK deploy-window safety (D-45 inverse), and V9's deliberate in-mission detonation probe (real PRICING row on prod BEFORE close, so a missing 000153 edit explodes inside this mission's horizon, not a future session's) are all sound and verified against the real files.

---

## 3. BLIND-EXECUTABILITY ATTACK SUMMARY

- **"Ship without numbers" mode**: structurally sound (price-as-data, null→contact-us) EXCEPT the F1 representability hole and the F2 silence contradiction — both patched above. With the patches, a C→N upgrade is a config+i18n fill for the covered answer space and a bounded, specified amendment for the uncovered one; no rework of layout.
- **Every other guess point is closed**: file paths, key names, testids, email pattern, cookie mechanics, commit messages, migration number derivation, teardown, gates — all literal and verified to exist.
- The plan's own weakest-point admission (#8: executor must actually run the Move-1 census) is fair and mitigated (numbered move + ABORT A2).

## 4. INDEPENDENT 8-POINT GRADE (vs SUCCESS.md)

| # | Standard | Grade | Note |
|---|---|---|---|
| 1 | Expected observation per move | **PASS** | Concrete, verified signals (count deltas, constraint defs, HTTP codes) |
| 2 | Failure + cause + counter per move | **PASS** | Grounded in real debt classes (all cited D-rows verified); Move 13 missing the setup-dependency counter (F3, patched) |
| 3 | Every fork has a trigger, no judgment calls | **PASS after patches** | F-A/F-C/F-D observable; F-B leaks two judgment calls (F1 unrepresentable answers, F2 "feel like invention") — the two MEDIUMs |
| 4 | RECON NEEDED with exact settling check | **PASS** | RN-1…RN-7 all carry literal commands or "Enzo's written reply"; Q1-Q8 covers the brief's full question list + currency + nav scope |
| 5 | Abort conditions | **PASS** | A1-A7 observable; A4 wording fixed by F2 patch |
| 6 | Verification spelled out | **PASS** | V1-V11 with pass criteria incl. the brief's 3 named live checks; V8 command amended per F3 |
| 7 | Red-team pass recorded | **PASS** | Failed attack + succeeded attack + welded patch; the succeeded attack (000153 detonation) is INDEPENDENTLY CONFIRMED real (migrate.sh mechanics + D-38 precedent). Failed-attack justification corrected per F4 (conclusion stands) |
| 8 | Executable blind | **PASS after patches** | F1+F2 were the only points where a mid-tier executor must invent or ask; everything else is literal |

**Independent grade: 8/8 with the F1-F5 patches applied; 6/8 as-written** (points 3 and 8 fail on the F-B gaps until patched).

## 5. VERDICT

**PASS-WITH-PATCHES.** Apply F1 and F2 (mandatory — they sit on the mission's declared hard constraint, "numbers = Enzo's authority"), F3-F5 (cheap, one-line each), F4/F6/F7 notes optional. The migration-detonation analysis — the plan's riskiest and most valuable claim — is verified correct end-to-end: `migrate.sh` really replays the full chain with `ON_ERROR_STOP=1`, 000153's tail assert really hardcodes the 3-value list, a live PRICING row really detonates it, and the D-38/`ac4b723` scoped-edit precedent really exists at DEBT_REGISTER:48. No finding invalidates the plan's structure; nothing needs re-wargaming.
