import Link from "next/link";
import { DashboardHeader, HeuresysLogoBadge, HeuresysWordmark } from "@/app/showcase/_ui-client";

export const metadata = { title: "Showcase / Header — Heuresys" };

export default function HeaderShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">UXIX-0002 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Header composition</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Persistent 64px header. Left cluster: hamburger (sidebar launcher) + Heuresys wordmark +
          optional breadcrumb. Right cluster: language switcher (IT/EN), palette dropdown, theme
          toggle, user identity card. Per bundle <code>docs/06_header_specification.md</code>.
          The theme toggle in the right cluster flips light/dark surface live — try it to verify the
          immutable-across-themes contract.
        </p>
        <p className="text-xs text-muted-foreground">
          Source of truth: <code>@heuresys/ui/dashboard/DashboardHeader</code> ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="standard" className="space-y-3">
        <h2 id="standard" className="text-base font-semibold tracking-tight">
          Variant A — Standard (no breadcrumb)
        </h2>
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <DashboardHeader
            user={{ initials: "ES", username: "enzo.spenuso", role: "USER", roleTone: "info" }}
            language="IT"
            logo={<HeuresysWordmark variant="brand" size={24} />}
            logoBadge={<HeuresysLogoBadge>advanced</HeuresysLogoBadge>}
          />
        </div>
      </section>

      <section aria-labelledby="with-breadcrumb" className="space-y-3">
        <h2 id="with-breadcrumb" className="text-base font-semibold tracking-tight">
          Variant B — With breadcrumb
        </h2>
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <DashboardHeader
            breadcrumb={[
              { label: "Workforce", href: "#" },
              { label: "Positions", href: "#" },
              { label: "Catalogue" },
            ]}
            user={{ initials: "ES", username: "enzo.spenuso", role: "USER", roleTone: "info" }}
            language="IT"
            logo={<HeuresysWordmark variant="brand" size={24} />}
            logoBadge={<HeuresysLogoBadge>advanced</HeuresysLogoBadge>}
          />
        </div>
      </section>

      <section aria-labelledby="superuser" className="space-y-3">
        <h2 id="superuser" className="text-base font-semibold tracking-tight">
          Variant C — SUPERUSER (warning role tone)
        </h2>
        <p className="text-xs text-muted-foreground">
          As shown in <code>/showcase/system-health</code>. Role pill rendered in{" "}
          <code>warning</code> tone to mark elevated platform-admin context.
        </p>
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <DashboardHeader
            breadcrumb={[
              { label: "Platform", href: "#" },
              { label: "System Health" },
            ]}
            user={{ initials: "ES", username: "enzo.spenuso", role: "SUPERUSER", roleTone: "warning" }}
            language="IT"
            logo={<HeuresysWordmark variant="brand" size={24} />}
            logoBadge={<HeuresysLogoBadge>advanced</HeuresysLogoBadge>}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Contract</h2>
        <ul className="mt-2 space-y-1 text-sm text-card-foreground">
          <li>Fixed 64px height; never resizes across sidebar collapse</li>
          <li>Left cluster identifies the product (hamburger + wordmark + optional breadcrumb)</li>
          <li>Right cluster controls personal state (language + palette + theme + user card)</li>
          <li>Wordmark uses <code>HeuresysWordmark variant=&quot;brand&quot;</code> — Exo 2 700, BRAND_BLUE body + BRAND_PURPLE &quot;y&quot;, hardcoded across all themes</li>
          <li>Optional <code>logoBadge</code> for the product chip (e.g. <em>advanced</em>, <em>beta</em>, <em>enterprise</em>)</li>
          <li>User menu opens a dropdown with Logout → primary authenticated initial page</li>
          <li>Theme toggle button persists choice to <code>localStorage</code> under <code>heuresys-theme</code></li>
        </ul>
      </section>
    </div>
  );
}
