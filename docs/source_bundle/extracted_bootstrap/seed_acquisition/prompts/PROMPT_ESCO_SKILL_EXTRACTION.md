# Prompt — ESCO Skill Extraction

## Objective

Retrieve official ESCO skills linked to a validated ESCO occupation URI.

## Inputs

- esco_occupation_uri
- language preferences
- relation type

## Allowed Sources

- Official ESCO API only

## Output Schema

```json
{
  "esco_occupation_uri": "",
  "esco_skill_uri": "",
  "esco_skill_label": "",
  "skill_relation_type": "",
  "confidence_score": 0,
  "evidence_url": "",
  "validation_status": "CANDIDATE"
}
```
