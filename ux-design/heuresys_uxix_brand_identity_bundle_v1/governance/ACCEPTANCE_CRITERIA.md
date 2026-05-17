# Acceptance Criteria

The UX/IX Brand Identity implementation is acceptable only if all criteria below are satisfied.

## Architecture

- Dashboard shell has Header, Sidebar, Main Content Window and Footer.
- Header and Footer are persistent and full width.
- Header and Footer do not change when Sidebar collapses/expands.
- Sidebar and Main Content scroll independently.
- Sidebar is constrained between Header and Footer.
- Sidebar supports collapse/expand.
- Sidebar supports collapsible tree groups.
- Sidebar collapse state and tree group state are separate.
- Top tabs are optional and used only where appropriate.
- Pages without tabs render directly.

## Header

- Left area includes hamburger menu and Heuresys SVG logo.
- Right area includes language switcher IT/EN.
- Right area includes palette switcher with four small color boxes.
- Right area includes Dark/Light theme switcher.
- Right area includes clickable logged-user SVG/avatar/logo.
- User menu exposes logout.
- Logout returns to authenticated primary initial page, not public landing page.

## Footer

- Left area includes copyright symbol and current year.
- Footer includes clickable Heuresys.com SVG logo.
- Footer includes icon-only SVG links for LinkedIn, GitHub, X/Twitter and Facebook.
- External links use `target="_blank"` and `rel="noopener noreferrer"`.

## Brand identity

- Design tokens exist.
- Palette supports light and dark mode.
- Typography is centralized.
- Icon system is outline-based.
- Icon colors are semantic and token-driven.
- Logo assets are SVG-based.
- Favicon/app icon generation is defined.

## Showcase

- Browser showcase routes exist.
- Shell, header, sidebar, footer, palette, typography and icons are showcased.
- Page types are showcased.
- Product Owner decisions can be recorded and applied.

## Governance

- Decision register exists.
- Accepted decisions are recorded.
- Superseded decisions are not deleted.
- Asset register exists or is planned.
- QA evidence is provided.
