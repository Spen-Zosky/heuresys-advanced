# Prompt — ATECO to NACE Reconciliation

## Objective

Given an ATECO code and enterprise description, identify the best corresponding NACE code using official correspondence first and semantic best-fit only when necessary.

## Inputs

- ATECO code
- ATECO version
- enterprise description
- country
- products/services
- operating model

## Allowed Sources

- ISTAT ATECO
- Eurostat NACE
- official correspondence tables

## Output Schema

```json
{
  "source_ateco_code": "",
  "target_nace_code": "",
  "mapping_type": "EXACT|BROADER|NARROWER|PARTIAL|SEMANTIC|MANUAL",
  "mapping_method": "OFFICIAL_CROSSWALK|SEMANTIC_MATCH|HUMAN_OVERRIDE",
  "confidence_score": 0,
  "evidence_urls": [],
  "validation_status": "CANDIDATE"
}
```
