import { TopTabs } from "@/components/dashboard/TopTabs";
import { positionsTabs } from "@/modules/positions/positions.tabs";

export default function PositionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
        <p className="text-sm text-muted-foreground">
          Manage position catalogue, role requirements, skills, KPIs and criticality.
        </p>
      </div>

      <TopTabs tabs={positionsTabs} />

      <div>{children}</div>
    </section>
  );
}
