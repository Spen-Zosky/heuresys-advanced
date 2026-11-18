import { describe, expect, it } from "vitest";
import { vociTemplateKpi } from "./template-kpi";

describe("C4: il modello del KPI si legge senza JSON", () => {
  it("le soglie escono in ordine e la chiave di importazione sparisce", () => {
    const voci = vociTemplateKpi({
      legacy: { kpi_code: "KPI4", source_table: "tenant_job_kpis" },
      stretch_target: "100.00",
      min_acceptable: "70.00",
      target_value: "85.00",
    });
    expect(voci).toEqual([
      { chiave: "min", valore: 70 },
      { chiave: "target", valore: 85 },
      { chiave: "stretch", valore: 100 },
    ]);
  });
  it("un modello senza soglie note resta vuoto", () => {
    expect(vociTemplateKpi({ legacy: { kpi_code: "KPI1" }, note: "x" })).toEqual([]);
    expect(vociTemplateKpi(null)).toEqual([]);
  });
  it("un valore non numerico non si mostra", () => {
    expect(vociTemplateKpi({ target_value: "n/d", min_acceptable: 5 })).toEqual([{ chiave: "min", valore: 5 }]);
  });
});
