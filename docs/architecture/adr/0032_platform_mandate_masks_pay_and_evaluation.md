# ADR-0032 — The platform mandate stops opening pay and evaluation: `mask` becomes a real state

**Status**: ACCEPTED
**Date**: 2026-08-04
**Author**: CLI session (S1044)
**Decision authority**: Enzo Spenuso (decision taken 2026-08-04)
**Amends**: **I20** (organizational prevalence — the list of mandate-holding roles)
**Builds on**: ADR-0027 (two-axis contextual authorization), I5 (never RLS), I17 (universal ESS floor), I18 (sensitive data is organizational-only)
**Register item**: #124

---

## §1 — Context

### §1.1 — The system could only say yes or no

Authorization had **two** outcomes: the caller reads the value, or the caller gets
`403`. The domain matrix that came out of the domain-definition work needs **four** —
`edit`, `read`, `mask`, `none` — and `mask` had no implementation anywhere in the
codebase. That is not a cosmetic gap: it is why the matrix stayed a document. Eight
cells were marked `mask`, and not one of them could be expressed.

On a person's data the binary is wrong in **both** directions. Denying everything to a
manager who has to coordinate is too much; handing them a home address is too little.

### §1.2 — Enzo's decision of 2026-08-04

> *The technical administrator stops seeing salaries and evaluations, but still knows
> they exist.*

"Still knows they exist" is the operative half. It rules out `none`: hiding the rows
would tell the administrator that nothing is there, and diagnosing a payroll handoff
means being able to see that July's record **is** there. So the row survives and the
field goes.

### §1.3 — The conflict this ADR resolves

**I20** reads, verbatim before this ADR:

> HR-mandated roles (`PLATFORM_ADMIN`, `TENANT_ADMIN`, `HRMS_MANAGER`) keep tenant-wide
> sensitive access by explicit mandate, not via the axes.

Enzo's decision removes `PLATFORM_ADMIN` from that guarantee for two of the four
sensitive classes. Because I20 is a non-negotiable invariant, the change cannot be made
by editing code — it needs this record.

The substance of the resolution is that the list conflated **two different mandates**.
`TENANT_ADMIN` and `HRMS_MANAGER` hold an **HR** mandate: reading an employee's pay is
part of the job the role exists to do. `PLATFORM_ADMIN` holds a **technical** mandate —
it is cross-tenant, it exists to operate the platform, and nothing in operating the
platform requires reading what a named person earns. Grouping the three together was a
shortcut, and the decision unpicks it.

## §2 — Decision

1. **The platform mandate alone no longer opens `COMPENSATION` and `EVALUATION`.**
   The fields carrying money and judgment are withheld; the row, its subject, its
   period and its status remain.
2. **`TENANT_ADMIN` and `HRMS_MANAGER` are unaffected.** I20 stands for the HR mandate.
   An actor holding an HR mandate *alongside* `PLATFORM_ADMIN` reads unmasked: the read
   is authorized by the HR mandate, and the platform mandate is not the operative one.
3. **`PERSONAL` and `SKILL` are NOT included.** Enzo named salaries and evaluations.
   Widening the decision silently would be inventing one. The separation of professional
   from private identity is a different change — splitting the `IDENTITY` class in two —
   and it needs no masking at all.
4. **I17 wins over everything.** A person always reads their own pay, whatever roles
   they hold. Self-scope is checked before the mandate.

## §3 — How `mask` is implemented

`apps/api/src/lib/scope/mask.ts`, between the service (which has already read the true
value) and the Zod response serializer. Five constraints, each with its reason:

| Constraint | Why |
|---|---|
| Mask in the **API**, never the frontend | Masking in the client means the true value already crossed the network. The mask would be theatre. |
| Mask per **field**, not per row | Hiding the row is `none`, which is a different cell of the matrix. |
| The masked value is **declared** | `0` or `null` is a lie: the client cannot tell "you may not see this" from "there is nothing here". The field is **absent** and its name is listed in `masked`, so the UI can say *«nascosto per il tuo profilo»*. |
| **Stable and non-invertible** | Same row, same actor, same outcome. No order-preserving truncation. Absence is the strongest form of both — no residue to difference against, nothing left to sort by. |
| **Aggregates follow the data** | Hiding individual salaries while publishing the mean of a three-person unit is an arithmetic leak. |

Explicitly **not** done: no masking in the database (the same row serves actors with
different rights, and a view per domain multiplies views by domains), and **no RLS** —
invariant **I5** excludes it project-wide.

`payload` on a compensation recommendation is masked **whole** rather than field by
field: it is an untyped record and it demonstrably carries pay data (measured
2026-08-04 — all 116 rows hold `legacy.increase_percent`). A partial mask over an open
record cannot be verified, and an unverifiable mask is the cosmetic kind.

## §4 — Evidence

Live HTTP, the **same row** read by two actors (2026-08-04):

```
GET /v1/compensation/recommendations   row 05b4abb1… — Elisa Martini, 2025-04-01, REJECTED

admin@heuresys.com          (PLATFORM_ADMIN)  → no amountEur, no narrative, no payload,
                                                 "masked": ["amountEur","narrative","payload"]
federica.marchetti@…        (TENANT_ADMIN)    → "amountEur": 1064.92, payload with increase_percent
```

`apps/api/test/compensation-mask.integration.test.ts` asserts on the **raw response
body**, not the parsed object, so a value surviving in a sibling field or inside the
payload fails the test. Falsification verified: with the mask made cosmetic (fields left
in place, `masked` still declared) the suite went red on **54 true amounts** found in
the body; restored, 4/4 green.

## §5 — Consequences

- **I20 is amended** in `CLAUDE.md`: the mandate list keeps `TENANT_ADMIN` and
  `HRMS_MANAGER`; `PLATFORM_ADMIN` is called out separately as a technical mandate that
  does not open `COMPENSATION`/`EVALUATION`.
- **Not yet applied to every EVALUATION surface.** The class spans nine resources
  (`assessment`, `kpi`, `goal`, `okr`, `career_succession`, `predictions`, `insights`,
  `evidence`, `talent`). `COMPENSATION` is done end to end; EVALUATION is tracked on
  #124 and is the reason that item is not closed.
- **Aggregates are not yet gated.** Constraint 5 is stated here and honoured on the
  per-person read; endpoints that average over a masked class still need the same gate
  or suppression. Also tracked on #124.
- **The frontend does not yet render the state.** The contract carries `masked`, so the
  UI can distinguish "withheld" from "absent"; showing it is follow-up work.
