# Prompt — ESCO Occupation Discovery

## Objective

Given an internal position title and industry context, identify candidate ESCO occupation labels and URIs.

## Inputs

- position_title
- job_family
- industry_context
- language: EN/IT
- role description

## Allowed Sources

- Official ESCO API / ESCO portal only

## Output Schema

```json
{
  "position_code": "",
  "position_title": "",
  "esco_occupation_uri": "",
  "esco_preferred_label": "",
  "isco08_code": "",
  "confidence_score": 0,
  "evidence_url": "",
  "validation_status": "CANDIDATE"
}
```
