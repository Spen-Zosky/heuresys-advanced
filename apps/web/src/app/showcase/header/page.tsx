import Link from "next/link";
import { LogoCandidateAFull } from "@heuresys/ui/brand/candidates";

export const metadata = { title: "Showcase / Header — Heuresys" };

function HeaderMock({
  variant,
  theme,
}: {
  variant: "standard" | "with-breadcrumb";
  theme: "light" | "dark";
}) {
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
      <div className="flex h-16 items-center justify-between border-b px-6"
        style={{ borderBottomColor: isDark ? "#1F2937" : "#E2E6EE" }}>
        <div className="flex items-center gap-4">
          <button aria-label="Toggle sidebar" className="inline-flex h-9 w-9 items-center justify-center rounded border"
            style={{ borderColor: isDark ? "#374151" : "#D1D5DB" }}>
            <span aria-hidden>≡</span>
          </button>
          <LogoCandidateAFull className="h-7 w-auto" />
          {variant === "with-breadcrumb" ? (
            <nav aria-label="Breadcrumb" className="ml-2 flex items-center gap-1.5 text-xs opacity-80">
              <span>Workforce</span>
              <span aria-hidden>/</span>
              <span>Positions</span>
              <span aria-hidden>/</span>
              <span className="font-medium">Catalogue</span>
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border px-2 py-1 text-xs font-medium"
            style={{ borderColor: isDark ? "#374151" : "#D1D5DB" }}>IT · EN</button>
          <div className="flex items-center gap-1 rounded border px-2 py-1"
            style={{ borderColor: isDark ? "#374151" : "#D1D5DB" }}>
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#2563EB" }} />
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#06B6D4" }} />
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#7C3AED" }} />
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#F59E0B" }} />
          </div>
          <button aria-label="Toggle theme" className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: isDark ? "#374151" : "#D1D5DB" }}>◐</button>
          <div className="flex items-center gap-2 rounded-full border py-0.5 pr-3 pl-0.5"
            style={{ borderColor: isDark ? "#374151" : "#D1D5DB" }}>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: isDark ? "#1E40AF" : "#DBEAFE", color: isDark ? "#FFFFFF" : "#1E40AF" }}>ES</span>
            <span className="text-xs">Enzo Spenuso ▾</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeaderShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">UXIX-0002 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Header composition</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Persistent 64px header. Left cluster: hamburger (sidebar launcher) + Heuresys logo (full
          variant) + optional breadcrumb. Right cluster: language switcher (IT/EN), palette 4-box,
          theme toggle, user menu with avatar. Per bundle <code>docs/06_header_specification.md</code>.
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Variant A — Standard</h2>
        <HeaderMock variant="standard" theme="light" />
        <HeaderMock variant="standard" theme="dark" />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Variant B — With breadcrumb</h2>
        <HeaderMock variant="with-breadcrumb" theme="light" />
        <HeaderMock variant="with-breadcrumb" theme="dark" />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-base font-semibold tracking-tight">Contract</h2>
        <ul className="mt-2 space-y-1 text-sm text-[var(--card-foreground)]">
          <li>Fixed 64px height; never resizes across sidebar collapse</li>
          <li>Left cluster identifies the product; right cluster controls personal state</li>
          <li>Palette + theme switchers are at most 1 click away</li>
          <li>User menu opens a dropdown with Logout → primary authenticated initial page</li>
        </ul>
      </section>
    </div>
  );
}
