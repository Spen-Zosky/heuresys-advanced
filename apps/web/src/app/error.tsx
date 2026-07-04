"use client";

/**
 * Route-level error boundary (Next.js App Router). Catches render/data errors thrown by any
 * segment under the root layout and shows a recoverable, i18n'd fallback instead of a blank
 * screen. F-008 (forensic audit 2026-07-03: the app had no error boundaries anywhere).
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@heuresys/ui";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    // Surface for diagnosis; a real client reporter can hook in here later.
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-16 max-w-md p-6 text-center">
      <h2 className="text-lg font-semibold text-danger">{t("error.boundaryTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("error.boundaryBody")}</p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground/70">
          {t("error.boundaryRef")} {error.digest}
        </p>
      )}
      <Button className="mt-4" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
