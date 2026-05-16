# ADR‑0001 — Monorepo Manager: pnpm Workspaces

- **Status:** Accepted
- **Date:** 2026‑05‑16
- **Deciders:** Enzo Spenuso (supervisor) + Development Team

## Context

The repository contains 3 distinct workspaces:

- `apps/api` — Fastify + Drizzle backend.
- `apps/web` — Next.js 15 admin frontend.
- `packages/shared` — Zod schemas + TypeScript types consumed by both.

Plus `db/` (SQL + scripts), `tests/`, `docs/`. We need a workspace manager that:

1. Hoists shared dependencies efficiently to reduce disk + install time.
2. Provides a deterministic lockfile.
3. Lets `apps/api` and `apps/web` import from `packages/shared` without publishing to a registry.
4. Plays well with TypeScript path resolution and modern Node 20 ESM.

## Decision

Use **pnpm workspaces** (pnpm 9+).

- Root file: `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`.
- Lockfile: `pnpm-lock.yaml` committed.
- Internal package references via `"@heuresys/shared": "workspace:*"`.
- Scripts run via `pnpm --filter <name> <script>` (e.g. `pnpm --filter api dev`).
- Node 20 LTS (>= 20.11) required.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **npm workspaces** | Built into Node 18+, no extra tool | Slower install, less deterministic, weaker hoisting | Slower iteration for a 3‑workspace repo with many shared deps |
| **yarn (classic v1)** | Mature, well‑documented | Maintenance mode, slower than pnpm, lock format diverges from npm/pnpm | Not the default ecosystem direction |
| **yarn berry / PnP** | Strict resolution | Plug'n'Play breaks some tooling (TS Server in some editors), niche | Compatibility risk with shadcn/ui CLI |
| **turborepo + npm/pnpm** | Smart task graph | Adds another layer; not needed for a 3‑workspace repo at MVP | Premature complexity |
| **nx** | Powerful task graph + generators | Steep learning curve; opinionated | Premature for MVP |

## Consequences

**Positive:**

- Fast installs (content‑addressable store) and small `node_modules` footprint per workspace.
- Strict resolution avoids accidental dependency leaks between packages.
- Single command can run cross‑workspace builds (`pnpm -r build`).

**Negative:**

- Contributors must install pnpm globally (`npm i -g pnpm`) or use Corepack (`corepack enable`).
- Some legacy CI templates assume npm; we provide pnpm CI examples in MVP‑0.

**Neutral:**

- Lockfile is `pnpm-lock.yaml` (different from npm/yarn). Tools that parse lockfiles (Dependabot, Renovate) support pnpm natively.

## References

- Consumed by: `BOOTSTRAP_EXECUTION_PLAN.md`, `MIGRATION_IMPLEMENTATION_PLAN.md`, `API_IMPLEMENTATION_PLAN.md`, `FRONTEND_IMPLEMENTATION_PLAN.md`.
- See also: ADR‑0007 (frontend stack).
