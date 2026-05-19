import Link from "next/link";

export const metadata = { title: "Showcase / Footer — Heuresys" };

function FooterMock({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: isDark ? "#0F1828" : "#FFFFFF",
        borderColor: isDark ? "#1F2937" : "#E2E6EE",
        color: isDark ? "#E5E7EB" : "#0F1828",
      }}
    >
      <footer
        className="flex h-11 items-center justify-between border-t px-6 text-xs"
        style={{ borderTopColor: isDark ? "#1F2937" : "#E2E6EE" }}
      >
        <div className="flex items-center gap-4 opacity-80">
          <span>© 2026 Heuresys</span>
          <a className="underline-offset-4 hover:underline" href="https://heuresys.com" target="_blank" rel="noopener noreferrer">
            heuresys.com
          </a>
          <span aria-hidden className="opacity-50">·</span>
          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider"
            style={{ borderColor: isDark ? "#374151" : "#D1D5DB" }}>dev</span>
          <span className="rounded-full border px-2 py-0.5 text-[10px]"
            style={{ borderColor: isDark ? "#374151" : "#D1D5DB" }}>v0.3.0-brand-v1</span>
          <span className="opacity-60">tenant: RTL_BANK_REFERENCE</span>
          <span className="opacity-60">↻ refreshed 14:02</span>
        </div>
        <div className="flex items-center gap-3">
          <a aria-label="LinkedIn" href="https://linkedin.com/company/heuresys" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100">in</a>
          <a aria-label="GitHub" href="https://github.com/heuresys" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100">gh</a>
          <a aria-label="X (Twitter)" href="https://x.com/heuresys" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100">x</a>
          <a aria-label="Facebook" href="https://facebook.com/heuresys" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100">fb</a>
        </div>
      </footer>
    </div>
  );
}

export default function FooterShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">UXIX-0003 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Footer composition</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Persistent 44px footer. Left: copyright + clickable <code>heuresys.com</code> link + dynamic
          chips (environment, version, tenant, last data refresh). Right: 4 social icons (LinkedIn /
          GitHub / X / Facebook) icon-only with <code>aria-label</code>, <code>target="_blank"</code>,{" "}
          <code>rel="noopener noreferrer"</code>. Per bundle <code>docs/08_footer_specification.md</code>.
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Light surface</h2>
        <FooterMock theme="light" />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Dark surface</h2>
        <FooterMock theme="dark" />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-base font-semibold tracking-tight">Dynamic chip taxonomy</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <th className="pb-2">Chip</th>
              <th className="pb-2">Source</th>
              <th className="pb-2">Refresh</th>
            </tr>
          </thead>
          <tbody className="divide-y text-[var(--card-foreground)]">
            <tr><td className="py-2 font-mono text-xs">dev / staging / prod</td><td>NODE_ENV / Vercel env</td><td>build-time</td></tr>
            <tr><td className="py-2 font-mono text-xs">v0.3.0-brand-v1</td><td>package.json + git tag</td><td>build-time</td></tr>
            <tr><td className="py-2 font-mono text-xs">tenant: RTL_BANK_REFERENCE</td><td>useTenantContext()</td><td>on tenant switch</td></tr>
            <tr><td className="py-2 font-mono text-xs">↻ refreshed HH:mm</td><td>useLastDataRefresh()</td><td>per TanStack Query invalidation</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
