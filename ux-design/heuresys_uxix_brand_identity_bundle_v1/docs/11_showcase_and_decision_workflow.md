# 11 — Showcase and Decision Workflow

## Purpose

The Development Team must create browser-rendered showcase pages so the Product Owner can review, compare and approve UX/IX and brand identity choices.

The showcase is not optional. It is the decision environment.

## Required showcase routes

```text
/showcase
/showcase/shell
/showcase/header
/showcase/sidebar
/showcase/footer
/showcase/palettes
/showcase/typography
/showcase/icons
/showcase/page-types
/showcase/dashboard-cards
/showcase/forms
/showcase/tables
/showcase/charts
/showcase/landing-page
/showcase/login-page
/showcase/primary-initial-page
```

## Showcase page requirements

Every showcase page must:

- Render in the browser.
- Use realistic Heuresys content.
- Avoid empty placeholders.
- Show multiple states where relevant.
- Show light and dark mode where relevant.
- Show expanded/collapsed states where relevant.
- Include notes or labels for each option.
- Capture or support screenshots for review.

## Candidate design workflow

For each material decision:

1. Build candidate A.
2. Build candidate B where meaningful.
3. Build candidate C only when useful, not for artificial variety.
4. Present in browser.
5. Capture user preference.
6. Record the decision.
7. Apply it to design tokens/components.
8. Mark previous decisions as superseded when changed.

## Decision register

Every decision must include:

- Decision ID.
- Title.
- Category.
- Status.
- Decision date.
- Decider.
- Context.
- Options considered.
- Final decision.
- Rationale.
- Impacted files/components/tokens.
- Showcase route or screenshot reference.
- Supersedes/superseded-by links.

## Reversible decisions

Do not delete older decisions. A changed decision becomes `Superseded` and points to the new active decision.

Decision states:

```text
Proposed
Accepted
Superseded
Rejected
Needs Review
```

## Examples of decisions to record

- Main palette.
- Dark theme behavior.
- Typography family.
- Header composition.
- Sidebar width expanded/collapsed.
- Sidebar tree behavior.
- Footer composition.
- Icon library.
- Icon semantic color mapping.
- Card style.
- Table density.
- Chart style.
- Login page design.
- Landing page design.
- Primary initial page design.

## Architectural statement

The showcase system is the visual governance environment for Heuresys UX/IX. The Development Team must use it to produce browser-reviewable alternatives, capture Product Owner decisions, apply approved choices and preserve a traceable history of superseded decisions.
