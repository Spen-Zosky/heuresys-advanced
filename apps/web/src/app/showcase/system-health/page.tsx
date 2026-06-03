import { SystemHealthDashboard } from "@/components/SystemHealthDashboard";

/**
 * /showcase/system-health — brand showcase entry.
 *
 * Thin wrapper around the shared <SystemHealthDashboard> component. The
 * showcase chrome (top nav + palette swatches + theme toggle + footer) is
 * visually hidden by the sibling `layout.tsx` (position:fixed inset-0 z-50).
 *
 * Gated by `NEXT_PUBLIC_ENABLE_SHOWCASE` env var via showcase parent layout.
 * For the production route accessible to PLATFORM_ADMIN, see
 * `apps/web/src/app/(authenticated)/system-health/page.tsx`.
 */
export default function SystemHealthShowcasePage() {
  return <SystemHealthDashboard />;
}
