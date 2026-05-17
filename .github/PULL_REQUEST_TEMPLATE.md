<!-- Heuresys Advanced PR template -->

## Summary
<!-- 1-3 bullets: what changed and WHY. Focus on intent, not diff. -->

-

## Area
<!-- Tick all that apply -->
- [ ] api (apps/api)
- [ ] web (apps/web)
- [ ] shared (packages/shared)
- [ ] db (migrations / scripts / seeds)
- [ ] design system (@heuresys/ui consumer wiring)
- [ ] tests (vitest / playwright / a11y)
- [ ] docs / handoff / ADR
- [ ] infra / CI / GitHub config

## Acceptance evidence
<!-- Paste short command output or link to test artifacts. -->
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm build` clean (if frontend touched)
- [ ] `pnpm test` (apps/api) green — N/N
- [ ] Playwright E2E green (if web touched)
- [ ] `pnpm exec playwright test a11y.spec.ts` — 0 critical (if UI touched)
- [ ] No secrets committed

## Notes for reviewer
<!-- Anything that helps the reviewer: tradeoffs taken, areas to focus on, regressions to watch. -->

## Closes
<!-- Link issues: Closes #123, Refs #456 -->
