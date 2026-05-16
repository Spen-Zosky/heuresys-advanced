# Brownfield Import and Adaptation Strategy

## Purpose

This document defines how the Development Team must reuse useful data and structures from an existing legacy Heuresys DBMS export without altering the new Company HRMS/BPM target architecture.

The old DBMS is not the target schema.

The old DBMS is a **brownfield enrichment source**.

## Core Principle

```text
New architecture remains canonical.
Old DBMS becomes a source of reusable catalogues, mappings and candidate data.
```

The Development Team must not copy the old schema into the new DBMS.

Instead:

```text
old db-export.zip
  → brownfield staging
  → adaptation map
  → candidate transformed records
  → validation
  → approval
  → canonical sys.sys_* tables
```

## Required Schemas

The target PostgreSQL DBMS should use:

```text
sys          canonical target architecture
staging      temporary import / raw normalized staging
brownfield   old DBMS source mirror and adaptation metadata
audit        import logs, lineage and validation results
```

Only `sys.sys_*` tables are canonical application tables.

## Mandatory Rule

No record from the old DBMS may be inserted into canonical `sys.sys_*` tables until it has:

1. source lineage;
2. adaptation mapping;
3. validation status;
4. approval status;
5. deterministic natural key;
6. idempotent upsert strategy.
