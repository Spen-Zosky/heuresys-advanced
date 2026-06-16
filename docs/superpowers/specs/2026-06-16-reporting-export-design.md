# 3.5 Reporting / Export — design

**Date**: 2026-06-16 · **Status**: approved (Enzo, CSV+XLSX+PDF) → implemented
**Program**: post-v1.0 S987, ondata-1 capability 3.5 (`reporting/export`).
**Owner of WHAT**: Enzo (approved formats + scope). **HOW**: this doc.

## Context

The platform exposes ~72–85 list endpoints with a uniform `{items, total}` Zod
shape, plus the 9 nested aggregate analytics views. S987 scoped 3.5 as a *generic
exporter* (`?format=csv|xlsx` on the list endpoints; PDF = optional +dep). The
nested analytics views already got a dedicated export endpoint earlier today
(`GET /v1/analytics/:view/export`, commit `69f77fb`) — that handles the
multi-section aggregate shape and is **complementary** to this work.

## Decision

Add a **single global `onSend` hook** that turns any `{items,total}` list endpoint
into a downloadable file when the request carries `?format=csv|xlsx|pdf`.

- **Zero-touch** on the ~85 list routes — the hook runs after the handler, so RBAC,
  tenant scope and filters are already applied; the export only ever contains what
  the caller was authorised to see.
- `format` is read from the **raw URL** (the Zod querystring schemas strip unknown
  keys — verified: 0 strict querystring schemas — so `?format` neither 400s nor
  reaches `req.query`).
- Unknown/absent `format` → silently ignored, normal JSON returned. Non-GET,
  non-200, non-JSON, or payloads without an `items` array → passed through.
- **Formats**: CSV (RFC-4180, reuses `csvCell` from analytics/csv.ts), XLSX
  (`exceljs`, already a dep), PDF (`pdfkit`, new dep — no browser, streaming).

## Architecture

| Piece | File |
|---|---|
| Flat-list serializers (`listToCsv` / `listToXlsx` / `listToPdf`, `unionKeys`) | `apps/api/src/lib/export/serializers.ts` |
| Global `onSend` hook (`addExportHook`) | `apps/api/src/lib/export/hook.ts` |
| Registration | `apps/api/src/app.ts` (step 2c, lifecycle-hook, §3.2-independent) |

- CSV/XLSX render one table: header = union of item keys (first-seen order), one
  row per item; object/array cells → JSON, null/undefined → empty.
- PDF: landscape A4 table; lists are wide & heterogeneous, so columns beyond what
  fits (~80pt each) are dropped with an explicit note ("use CSV/XLSX for the full
  dataset"); cell text truncated per column; rows paginate automatically.
- Filename: `<resource>-<YYYY-MM-DD>.<ext>` derived from the path
  (`/v1/me/skills` → `me-skills-…`).

## Scope & non-goals

- **Scope = the current result**: the export reflects the endpoint's filters +
  pagination. To export everything, request a large page size. (Documented in the
  hook header; acceptable for fase-1.)
- **Not included**: per-page UI download buttons (the exporter is invocable by URL
  today — `/api/v1/<resource>?format=…`); UI wiring is a possible follow-up slice
  if desired. PDF of very wide lists is column-truncated by design.

## Verification

- Unit: `test/export-serializers.test.ts` (CSV escaping/header, XLSX `PK` magic,
  PDF `%PDF` magic, wide-row overflow path, union-key order).
- Integration (live OCI DB): `test/export-list.integration.test.ts` on
  `GET /v1/users` — JSON untouched without `?format`; csv/xlsx/pdf download
  envelopes + magic bytes; unknown format ignored; unauth → 401 (hook no-ops on
  non-200).
- Gate: full API suite, typecheck (src+test), full `pnpm lint`, then live PROD
  verify after deploy.
