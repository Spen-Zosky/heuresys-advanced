# Prompt — Learning Catalogue Research

## Objective

Identify candidate learning modules and training initiatives that close a skill gap for a position.

## Inputs

- position_title
- skill_gap
- required_proficiency_level
- industry_context
- country_context
- regulatory_sensitive flag

## Allowed Sources

- approved source_registry entries
- institutional/sectoral training providers
- official regulatory training references
- internal training catalogue where available

## Output Schema

```json
{
  "learning_module_title": "",
  "learning_objective": "",
  "target_skill": "",
  "target_proficiency_level": "",
  "delivery_mode": "",
  "estimated_duration_hours": 0,
  "certification_linked": false,
  "source_urls": [],
  "confidence_score": 0,
  "validation_status": "CANDIDATE"
}
```
