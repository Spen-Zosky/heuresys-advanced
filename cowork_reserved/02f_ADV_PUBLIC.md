# Forensic Inventory — `heuresys_advanced.public`

**Snapshot**: 2026-05-20T02:32Z
**Scope**: 0 tables, 2 views (extension metadata only)

---

## §1 — Content

| Object | Type | Source |
|---|---|---|
| `public.pg_stat_statements` | view | extension `pg_stat_statements` 1.10 (enabled Goal 002 mig 000031-piggyback) |
| `public.pg_stat_statements_info` | view | extension `pg_stat_statements` 1.10 |

---

## §2 — Implicazione

`public` schema **non contiene application data** — è solo namespace per Postgres extensions (pg_stat_statements per query performance telemetry).

Provenienza: `CREATE EXTENSION pg_stat_statements;` eseguito on 2026-05-18T22:34:30Z (post-Goal-002 hot-fix).

**Per SDBI**: irrilevante. Lasciare invariato. Non confondere con `heuresys_platform.public` (que ha 582 tables).

---

## §3 — Verification

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';  -- 0
SELECT viewname FROM pg_views WHERE schemaname='public';  -- pg_stat_statements, pg_stat_statements_info
SELECT * FROM pg_extension WHERE extname='pg_stat_statements';  -- version 1.10
```

---

*End of 02f_ADV_PUBLIC.md*
