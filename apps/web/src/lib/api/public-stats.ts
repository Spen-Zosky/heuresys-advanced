"use client";
import { useEffect, useState } from "react";
import type { PlatformStatsResponse } from "@heuresys/shared/schemas/public-stats";

/** Fetch the public platform metrics (GTM one-pager live tiles). No auth. */
export function usePlatformStats(): { data: PlatformStatsResponse | null; error: boolean } {
  const [data, setData] = useState<PlatformStatsResponse | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/public/platform-stats", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
      .then((d) => { if (alive) setData(d as PlatformStatsResponse); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);
  return { data, error };
}
