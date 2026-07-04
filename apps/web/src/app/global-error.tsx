"use client";
/* eslint-disable i18next/no-literal-string -- global-error REPLACES the root layout, so the
   i18n provider is not mounted; the fallback text is intentionally hardcoded (last-resort UI). */

/**
 * Root error boundary (Next.js App Router). Unlike error.tsx it REPLACES the root layout
 * (including <html>/<body>), so it must be fully self-contained — no design-system imports,
 * no i18n context, no theme tokens (the failure may be in any of those). Inline styles only.
 * F-008 (forensic audit 2026-07-03: the app had no error boundaries anywhere).
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="it">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f19",
          color: "#e5e7eb",
        }}
      >
        <div style={{ maxWidth: "28rem", padding: "2rem", textAlign: "center" }}>
          <h2 style={{ color: "#F87171", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Errore imprevisto
          </h2>
          <p style={{ fontSize: "0.9rem", opacity: 0.85 }}>
            Si è verificato un errore critico. Ricarica la pagina o riprova più tardi.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.375rem",
              border: "1px solid #374151",
              background: "#1f2937",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
