# Quality Gates

Run these gates before presenting for acceptance.

## Code quality

- TypeScript check passes.
- ESLint passes.
- Prettier/formatting passes.
- Production build passes.
- No console errors in browser.
- No unhandled React hydration errors.

## UX behavior

- Header remains visible.
- Footer remains visible.
- Sidebar scrolls internally.
- Main content scrolls internally.
- Long sidebar does not push footer off-screen.
- Long main page does not push header/footer off-screen.
- Sidebar collapse changes only body columns.
- Tree groups open/close correctly.
- Top tabs preserve module layout.

## Visual consistency

- Tokens are used instead of hardcoded arbitrary styles.
- Icons are from the selected library or approved custom assets.
- Icon colors use semantic tokens.
- Header, sidebar, footer and pages share the same design system.
- Light and dark modes are consistent.

## Browser showcase

- Showcase routes render.
- Options are distinguishable.
- Current accepted option is labeled.
- Screenshots are captured for key states.

## Accessibility

- Icon-only buttons have aria-labels.
- Menus are keyboard accessible.
- Tabs are keyboard accessible.
- Focus states are visible.
- Contrast is acceptable.
- Reduced-motion preferences are respected where animations are used.
