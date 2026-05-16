# ADR‑0007 — Frontend: Next.js 15 App Router + React 19 + Tailwind 4 + shadcn/ui

- **Status:** Accepted
- **Date:** 2026‑05‑16

## Context

`FRONTEND_STACK_SPEC.md` specifies Next.js + TypeScript + Tailwind + shadcn/ui + React Hook Form + Zod + TanStack Query. We need to fix versions and pick App Router vs Pages Router, plus a graph renderer for the visualization module.

## Decision

- **Next.js 15** (App Router, React 19 RSC support).
- **React 19** — server components for the admin shell layout, client components where needed (forms, tables, dialogs, graph).
- **Tailwind CSS 4** (latest).
- **shadcn/ui** — production‑ready primitives copied into `apps/web/src/components/ui/`.
- **TanStack Query v5** — data fetching, cache, optimistic updates.
- **React Hook Form** + `@hookform/resolvers/zod` — form state with shared Zod schemas from `packages/shared`.
- **React Flow** (`@xyflow/react`) — primary visualization renderer (org chart, process flow, career path, learning path, skill gap map, succession map, KPI cascade, position intelligence map, enterprise blueprint map).
- **Mermaid** — fallback / export for KPI cascade text rendering.
- **vitest** + **@testing-library/react** + **playwright** — testing layers.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **Pages Router (Next 14 style)** | More mature ecosystem in mid‑2025 | Falling behind on RSC + streaming SSR; future‑facing tools assume App Router | App Router is the future direction; greenfield project |
| **Vite + React Router** | Lighter; faster HMR | No built‑in SSR; admin shell benefits from RSC layouts; smaller plugin set | We want SSR for the admin shell (auth gating, fast first paint) |
| **D3 + custom canvas for graph** | Maximum control | High implementation cost; ergonomics poor | React Flow covers 95% of our needs; D3 only for one‑off custom views |
| **Material UI / Mantine** | Mature, rich components | Bundle size; design tokens lock‑in; less Tailwind‑friendly | shadcn/ui + Tailwind gives more flexibility without runtime CSS overhead |

## Consequences

**Positive:**

- Server components reduce client bundle; admin shell streams from the server with auth pre‑checked at the layout level.
- Tailwind 4 + shadcn/ui = no runtime CSS‑in‑JS overhead; tokens live in `tailwind.config.ts`.
- TanStack Query v5 covers all data ops with optimistic updates and pagination.
- React Flow gives us native pan/zoom, drag, mini‑map; layout edits update only `sys.sys_visualization_node_layouts` coordinates.

**Negative:**

- React 19 is bleeding edge as of the bootstrap date; minor breakages possible. Mitigation: pin exact patch versions, monitor release notes.
- App Router learning curve for contributors used to Pages Router: documented in `FRONTEND_IMPLEMENTATION_PLAN.md`.

**Neutral:**

- The bundle is moderate (`~200–300 KB` gz expected for the admin app). Acceptable for an internal admin tool.

## References

- Consumed by: `FRONTEND_IMPLEMENTATION_PLAN.md`.
- See also: ADR‑0002 (Fastify), ADR‑0006 (auth client).
