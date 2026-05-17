# 13 — Best Practices for Modern SaaS UI

## Design target

Heuresys must look like a serious, modern, premium enterprise SaaS platform. It should feel dynamic and intelligent, but never noisy or toy-like.

## Recommended visual language

- Clear information hierarchy.
- Strong whitespace discipline.
- Subtle borders and surfaces.
- Soft shadows only where useful.
- Controlled radius system.
- Monochrome outline icons.
- Semantic colors for status, not decoration.
- Clean typography.
- Responsive layout.
- Crisp tables and forms.
- Good empty/loading/error states.
- Executive-grade infographics.

## Controlled "wow" factor

Allowed:

- Premium dashboard cards.
- Subtle animated transitions.
- High-quality charts.
- Smart infographics.
- Elegant gradient accents in marketing or hero areas.
- Micro-interactions for menus, tabs, filters and drawers.
- Interactive visual previews in showcase pages.

Avoid:

- Excessive animations.
- Random glowing effects.
- Overuse of saturated colors.
- Decorative icons everywhere.
- Emojis as interface icons.
- Inconsistent illustration styles.
- Dense, unscannable screens.
- Consumer-app gimmicks in enterprise workflows.

## Recommended tool use

The Development Team should use:

- Tailwind CSS for token-driven utility styling.
- shadcn/ui for accessible component foundations.
- Radix UI primitives for menus, dialogs, tooltips and tabs.
- Lucide React for outline icons.
- Framer Motion for controlled micro-interactions.
- Recharts for data visualization prototypes.
- Storybook/Ladle or `/showcase` routes for design review.
- Playwright for visual and interaction testing.

## Component discipline

Do not create one-off local components if a reusable component is needed.

Create shared components for:

- Button.
- Tabs.
- Sidebar item.
- Card.
- KPI card.
- Status badge.
- Status icon.
- Data table.
- Filter bar.
- Empty state.
- Loading state.
- Error state.
- Detail drawer.
- Page header.
- Breadcrumb.

## Data visualization guidance

Charts should be:

- Clear.
- Readable.
- Accessible.
- Consistent with palette tokens.
- Focused on business interpretation.
- Used only where they improve understanding.

## Enterprise UX guidance

For HRMS/BPM pages, prioritize:

- Traceability.
- Explainability.
- Auditability.
- Clear state transitions.
- Permission-aware controls.
- Human validation of AI/rule-generated recommendations.
- Data quality visibility.

## Rule

The interface must be visually impressive through precision, clarity and high-quality composition, not through decorative excess.
