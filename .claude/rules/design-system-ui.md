---
paths:
  - "apps/web/**"
  - "apps/showcase/**"
  - "packages/**"
---

# Design System — `@heuresys/ui`

Reusable UI/UX components live in **`@heuresys/ui`**, an npm-published versioned lib derived from `ux-design-shared`, consumed as a normal dep (not `link:`) since migration X18. Full setup, the modify-a-component workflow and the migration history → `docs/kb/xtras/DESIGN_SYSTEM_UI.md`.

## Regole (le due NEVER stanno anche nel `CLAUDE.md` di radice)

- **NEVER** create reusable UI components in `apps/web`, `apps/showcase` o `packages/*` di questo repo. Vanno nel repo `ux-design-shared`.
- **NEVER** aggiungere UI runtime deps (Radix, framer-motion, recharts, ecc.) ai `package.json` di questo repo. Appartengono a `@heuresys/ui` e arrivano come transitive deps.
- Un componente genuinamente heuresys-advanced-specific (es. widget tenant-aware che usa schemi Zod da `@heuresys/shared`) vive in `apps/web/src/components/` — e anche allora, componi primitive di `@heuresys/ui` invece di reimplementarle.
- React peer: `@heuresys/ui` dichiara React via `peerDependencies`; `apps/web` / `apps/showcase` installano la versione concreta. Evita il crash "due React istanze".
