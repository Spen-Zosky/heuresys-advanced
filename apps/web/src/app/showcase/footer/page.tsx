import Link from "next/link";
import { DashboardFooter } from "@/app/showcase/_ui-client";

export const metadata = { title: "Showcase / Footer — Heuresys" };

export default function FooterShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">UXIX-0003 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Footer composition</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Persistent 44px footer. Left area is FIXED across every Heuresys surface: copyright +
          clickable <code>heuresys.com</code> link + 5 outlined social icons in canonical order
          (LinkedIn → GitHub → Discord → Facebook → X), all <code>icon-only</code> with{" "}
          <code>aria-label</code>, <code>target=&quot;_blank&quot;</code>,{" "}
          <code>rel=&quot;noopener noreferrer&quot;</code>. Right area is context-specific via{" "}
          <code>rightSlot</code>. Per bundle <code>docs/08_footer_specification.md</code>.
        </p>
        <p className="text-xs text-muted-foreground">
          Source of truth: <code>@heuresys/ui/dashboard/DashboardFooter</code> ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="default" className="space-y-3">
        <h2 id="default" className="text-base font-semibold tracking-tight">
          Variant A — Minimal (login / landing surface, no rightSlot)
        </h2>
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <DashboardFooter />
        </div>
      </section>

      <section aria-labelledby="dashboard" className="space-y-3">
        <h2 id="dashboard" className="text-base font-semibold tracking-tight">
          Variant B — Tenant dashboard (env + version + tenant + refresh)
        </h2>
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <DashboardFooter
            rightSlot={
              <>
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] uppercase tracking-wider">dev</span>
                <span aria-hidden="true" className="text-border">·</span>
                <span className="font-mono text-[10px]">v0.3.0-brand-v1</span>
                <span aria-hidden="true" className="text-border">·</span>
                <span>tenant: RTL_BANK_REFERENCE</span>
                <span aria-hidden="true" className="text-border">·</span>
                <span>↻ refreshed 14:02</span>
              </>
            }
          />
        </div>
      </section>

      <section aria-labelledby="system-health" className="space-y-3">
        <h2 id="system-health" className="text-base font-semibold tracking-tight">
          Variant C — System Health (build info + runtime location + pool + tunnel)
        </h2>
        <p className="text-xs text-muted-foreground">
          As shown in <code>/showcase/system-health</code> canonical. Live status indicator with{" "}
          <code>pulse-dot</code> animation on the tunnel state.
        </p>
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <DashboardFooter
            rightSlot={
              <>
                <span>v5.0.0-mvp3</span>
                <span aria-hidden="true" className="text-border">·</span>
                <span>OCI VM eu-milan-1</span>
                <span aria-hidden="true" className="text-border">·</span>
                <span>pg 16 · pool 18/50</span>
                <span aria-hidden="true" className="text-border">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
                  tunnel 5433
                </span>
              </>
            }
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Dynamic chip taxonomy (right slot)</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2">Chip</th>
              <th className="pb-2">Source</th>
              <th className="pb-2">Refresh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-card-foreground">
            <tr><td className="py-2 font-mono text-xs">dev / staging / prod</td><td>NODE_ENV / Vercel env</td><td>build-time</td></tr>
            <tr><td className="py-2 font-mono text-xs">v0.3.0-brand-v1</td><td>package.json + git tag</td><td>build-time</td></tr>
            <tr><td className="py-2 font-mono text-xs">tenant: RTL_BANK_REFERENCE</td><td><code>useTenantContext()</code></td><td>on tenant switch</td></tr>
            <tr><td className="py-2 font-mono text-xs">↻ refreshed HH:mm</td><td><code>useLastDataRefresh()</code></td><td>per TanStack Query invalidation</td></tr>
            <tr><td className="py-2 font-mono text-xs">pg 16 · pool 18/50</td><td><code>GET /v1/system/pool</code></td><td>5s polling on system-health</td></tr>
            <tr><td className="py-2 font-mono text-xs">tunnel 5433 + pulse</td><td>SSH tunnel health probe</td><td>10s polling on system-health</td></tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Contract</h2>
        <ul className="mt-2 space-y-1 text-sm text-card-foreground">
          <li>Fixed 44px height; never resizes across sidebar collapse</li>
          <li>Left area immutable: © year + heuresys.com link + 5 social icons (LinkedIn / GitHub / Discord / Facebook / X)</li>
          <li>Social icons are <code>icon-only</code> with <code>aria-label</code>, <code>target=&quot;_blank&quot;</code>, <code>rel=&quot;noopener noreferrer&quot;</code></li>
          <li>Right area is context-specific via the <code>rightSlot</code> prop</li>
          <li>Token-driven: <code>--border</code>, <code>--background</code>, <code>--muted-foreground</code> respond to palette + theme switch</li>
        </ul>
      </section>
    </div>
  );
}
