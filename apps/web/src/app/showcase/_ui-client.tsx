"use client";

/**
 * apps/web/src/app/showcase/_ui-client.tsx
 *
 * Client-only re-exports of the @heuresys/ui components used across the
 * /showcase routes, each wrapped in `next/dynamic` with `ssr: false`.
 *
 * Why: @heuresys/ui is a single-barrel package — importing ANY component pulls
 * the whole index, which eagerly evaluates heavy class-based libraries
 * (three / @react-three, echarts, d3, recharts) at module load. During the
 * Next build's server-side page-data collection those classes hit a CJS/ESM
 * interop edge ("Class extends value undefined" / "d.createContext is not a
 * function", CW-B59) and the /showcase build fails. `dynamic(..., { ssr: false })`
 * defers the barrel import to the client, so it is never evaluated during the
 * server build — the showcase pages render their static shell + hydrate the
 * components client-side. Showcase pages are interactive brand demos with no SSR/
 * SEO requirement, so client-only rendering is acceptable.
 *
 * Server components (the showcase layout + pages, which keep `metadata` exports)
 * cannot call `dynamic(..., { ssr: false })` directly — hence this dedicated
 * client module. Import showcase UI primitives from here, never from
 * "@heuresys/ui" directly, inside the /showcase segment.
 *
 * NB: next/dynamic options must be an inline object literal (`{ ssr: false }`) —
 * the SWC plugin static-analyses it and rejects a hoisted variable.
 */

import dynamic from "next/dynamic";

export const AuditFeed = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.AuditFeed })), { ssr: false });
export const DashboardFooter = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.DashboardFooter })), { ssr: false });
export const DashboardHeader = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.DashboardHeader })), { ssr: false });
export const DashboardShell = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.DashboardShell })), { ssr: false });
export const DashboardSidebar = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.DashboardSidebar })), { ssr: false });
export const DataTableWithCrossHair = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.DataTableWithCrossHair })), { ssr: false });
export const HeuresysLogoBadge = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.HeuresysLogoBadge })), { ssr: false });
export const HeuresysMark = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.HeuresysMark })), { ssr: false });
export const HeuresysWordmark = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.HeuresysWordmark })), { ssr: false });
export const KPIStrip = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.KPIStrip })), { ssr: false });
export const PaletteDropdown = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.PaletteDropdown })), { ssr: false });
export const StatusIcon = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.StatusIcon })), { ssr: false });
export const ThemeToggle = dynamic(() => import("@heuresys/ui").then((m) => ({ default: m.ThemeToggle })), { ssr: false });
