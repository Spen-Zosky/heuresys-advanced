# Prompt — Banking KPI Research

## Objective

Generate candidate KPIs for a banking BPM process using approved banking regulatory, supervisory and high-reputation sources.

## Inputs

- process_code
- process_title
- banking_subdomain
- role/position if applicable

## Allowed Sources

- Banca d'Italia
- EBA
- UIF
- official/internal blueprint documents
- approved sectoral sources

## Output Schema

```json
{
  "process_code": "",
  "kpi_code": "",
  "kpi_name": "",
  "metric_formula": "",
  "assessment_method": "",
  "source_urls": [],
  "confidence_score": 0,
  "validation_status": "CANDIDATE"
}
```
