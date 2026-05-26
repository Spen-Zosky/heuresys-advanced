# _05_REVIEW_<NNN>_<slug>.md

**Protocol phase:** REVIEW (supervisor, async post-mortem)
**Goal ID:** <NNN>
**Slug:** <slug>
**Authored:** YYYY-MM-DD HH:MM:SS+02:00, by Cowork
**REPORT reference:** `_04_REPORT_<NNN>_<slug>.md` (variant: complete | partial)
**Outcome reviewed:** ✅ complete | ⚠️ partial | ❌ failed

---

## §1 — Was the PLAN sound?

Assess whether the PLAN as approved was correctly scoped, sequenced, and budgeted.

- Scope coverage: ...
- Sequencing: ...
- Budget accuracy: ...
- Risk register foresight: ...

**Verdict:** sound | sound-with-caveats | unsound

---

## §2 — Were halts predictable from the PROMPT? Could DISCOVERY have caught them?

(For every halt or scope discovery during EXEC: was it predictable upstream? If yes, why did we miss it?)

| Halt / discovery | Was it in DISCOVERY? | Was it in PROMPT scope? | Could it have been pre-empted? | How? |
|---|---|---|---|---|

---

## §3 — Rule updates proposed

(Each non-trivial lesson goes into `RULE_UPDATES.md` cumulative. Inline here for traceability.)

| # | Lesson | Proposed rule | Severity |
|---|---|---|---|
| 1 | ... | "When X, do Y instead of Z" | should-do |

---

## §4 — Time / turn variance vs estimate

| Metric | Estimated | Actual | Variance | Reason |
|---|---|---|---|---|
| Turns | <PLAN §8> | <EXEC log> | <±N> | ... |
| Wall-clock | <PLAN> | <EXEC> | <±h> | ... |

---

## §5 — Lessons for the bias catalog

(Specific behavioral observations: CLI bias, Cowork bias, user bias. Reference `references/bias-catalog.md` if maintained.)

- CLI-Bx: ...
- CW-Bx: ...

---

## §6 — Channel-side closure

- [ ] STATE updated: `current_phase: CLOSED`
- [ ] events.jsonl final line `{phase: REVIEW, status: closed}`
- [ ] `RULE_UPDATES.md` appended (if applicable)
- [ ] `RISK_REGISTER.md` updated (if new risk materialized)

---

*End of _05_REVIEW_<NNN>_<slug>.md*
