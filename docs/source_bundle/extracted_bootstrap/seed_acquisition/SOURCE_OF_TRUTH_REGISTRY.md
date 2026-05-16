# Source of Truth Registry

This registry defines the approved sources the AI coding agent may use for seed discovery, enrichment and validation.

## Governance Rule

AI-generated seed data is never authoritative by itself.

A source-backed candidate may become canonical only after:

```text
candidate generation
→ source evidence capture
→ confidence scoring
→ validation
→ human approval
→ idempotent canonical seed
```

## Authority Tiers

```yaml
source_authority_tier:
  - TIER_1_OFFICIAL_PUBLIC_AUTHORITY
  - TIER_1_OFFICIAL_SUPERVISORY_AUTHORITY
  - TIER_1_OFFICIAL_EU_SOURCE
  - TIER_2_SECTORAL_INSTITUTION
  - TIER_2_HIGH_REPUTATION_PROVIDER
  - TIER_3_COMMERCIAL_PROVIDER
  - TIER_4_AI_SUGGESTED_OR_UNVALIDATED
```

## Machine-Readable Seed File

See:

```text
seed_acquisition/source_registry.seed.json
```

## Usage Rules

1. Official classifications must come from official national/EU sources.
2. CCNL data must come from CNEL and/or recognized sectoral sources.
3. Occupations and skills must first use ESCO, then may be enriched by institutional frameworks.
4. Banking regulatory controls must come from competent authorities.
5. Training catalogue candidates may come from high-reputation institutional or sectoral providers.
6. Every seed record must preserve source URL, retrieval timestamp, source tier, confidence score and validation status.
