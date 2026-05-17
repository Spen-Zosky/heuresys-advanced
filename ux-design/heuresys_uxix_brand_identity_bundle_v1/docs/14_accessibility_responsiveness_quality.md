# 14 — Accessibility, Responsiveness and Quality

## Accessibility requirements

The Development Team must ensure:

- Keyboard navigation.
- Focus states.
- ARIA labels for icon-only controls.
- Sufficient contrast in light and dark mode.
- Accessible menu, tab and dialog behavior.
- Reduced-motion support where animations are used.
- Screen-reader friendly labels for dynamic controls.
- No critical meaning conveyed by color alone.

## Icon-only controls

All icon-only controls must include accessible labels.

Example:

```tsx
<button aria-label="Collapse sidebar">
  <PanelLeftClose className="h-4 w-4" />
</button>
```

## Responsive behavior

The interface must be tested across:

- Desktop large.
- Desktop standard.
- Laptop.
- Tablet.
- Narrow viewport.

For smaller viewports, consider:

- Sidebar overlay mode.
- Collapsed sidebar by default.
- Condensed header controls.
- Accessible overflow menus.

## Quality gates

Before acceptance:

- TypeScript passes.
- Lint passes.
- Formatting passes.
- Build passes.
- Shell renders without layout overflow.
- Sidebar and main content scroll independently.
- Header and footer remain fixed/persistent.
- Sidebar collapse does not affect header/footer.
- Top tabs work where present.
- Pages without tabs render directly.
- Theme switch works.
- Palette switch works or has a documented mocked showcase behavior.
- Language switch works or has a documented mocked showcase behavior.
- User menu opens and logout route is wired or mocked explicitly.
- Social icons are SVG/icon-only and clickable.
- Accessibility checks pass.
- Browser screenshots are captured for key states.

## Visual QA states

Test:

- Light mode.
- Dark mode.
- Sidebar expanded.
- Sidebar collapsed.
- Long sidebar scroll.
- Long main content scroll.
- Tree group open.
- Tree group closed.
- Header menu open.
- Palette menu open.
- User menu open.
- Footer links visible.
- Content page with tabs.
- Content page without tabs.
- Login page.
- Primary initial page.
- Landing page.

## Rule

A visually attractive UI is not acceptable unless it is also accessible, responsive, maintainable and traceable.
