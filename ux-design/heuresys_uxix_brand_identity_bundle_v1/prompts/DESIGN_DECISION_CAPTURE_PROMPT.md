# Design Decision Capture Prompt

When the Product Owner selects or changes a UX/IX design choice, create or update the decision register.

For each decision, capture:

- Decision ID.
- Date.
- Category.
- Title.
- Status.
- Context.
- Options considered.
- Final decision.
- Rationale.
- Impacted files/components/tokens.
- Showcase route or screenshot.
- Supersedes.
- Superseded by.

If the decision changes a previous one:

1. Mark the old decision as Superseded.
2. Create a new Accepted decision.
3. Link both decisions.
4. Apply the new decision to code/tokens/assets.
5. Update the showcase label to show the active decision.
