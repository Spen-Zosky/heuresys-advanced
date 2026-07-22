"use client";

/**
 * apps/web/src/components/enum-badge.tsx — translated drop-ins for the raw
 * StatusPill/StatusBadge call sites (census F4 S1026, cluster 1).
 *
 * @heuresys/ui's StatusPill/StatusBadge are purely visual: whatever string
 * they receive is what the user reads, and `statusTone()` infers the color
 * from known RAW substrings. So the tone MUST be computed on the raw enum
 * value while the text shown is the translated label — these wrappers do
 * exactly that split. App-specific composition, not a new UI primitive.
 */

import { StatusPill, statusTone, type StatusTone } from "@/components/status-pill";
import { useEnumLabel } from "@/lib/enum-labels";

export function EnumStatusBadge({ domain, value }: { domain: string; value: string | null | undefined }) {
  const label = useEnumLabel();
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  return <StatusPill tone={statusTone(value)}>{label(domain, value)}</StatusPill>;
}

export function EnumStatusPill({
  domain,
  value,
  tone,
}: {
  domain: string;
  value: string | null | undefined;
  tone?: StatusTone;
}) {
  const label = useEnumLabel();
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  return <StatusPill tone={tone ?? statusTone(value)}>{label(domain, value)}</StatusPill>;
}
