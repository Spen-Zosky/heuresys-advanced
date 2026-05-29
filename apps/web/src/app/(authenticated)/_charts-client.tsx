"use client";

/**
 * apps/web/src/app/(authenticated)/_charts-client.tsx
 *
 * Client-only re-export of the heavy chart components from @heuresys/ui, each
 * wrapped in `next/dynamic({ ssr: false })`. `EChartsCard` pulls in echarts,
 * whose class-based init crashes Next's server-side prerender ("Class extends
 * value undefined" / CW-B59) and fails `next build`. The authenticated pages
 * are "use client", but a client component is still prerendered on the server
 * for the initial HTML — so rendering EChartsCard server-side would crash.
 * `dynamic(..., { ssr: false })` defers the barrel import to the client and
 * skips the server render, keeping the build safe.
 *
 * Import chart components from HERE (never from "@heuresys/ui" directly) inside
 * the (authenticated) chart pages. The `{ ssr: false }` must be an inline object
 * literal — the SWC plugin static-analyses it and rejects a hoisted variable.
 */

import dynamic from "next/dynamic";

export const EChartsCard = dynamic(
  () => import("@heuresys/ui").then((m) => ({ default: m.EChartsCard })),
  { ssr: false },
);
