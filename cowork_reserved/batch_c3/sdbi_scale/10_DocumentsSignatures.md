# Macro-area 10 — Documents + Signatures

**Lexicon**: DGOV (Data Governance) extends — document management aspect
**Tier 3 / Rank 10** · **Effort 6-8h pilot** · **Volume ~1363 rows**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `employee_documents` | 1089 | Document attachments per employee (contracts, CVs, IDs, certs) |
| `document_acknowledgments` | 250 | Acknowledgment records (employee acks reading a doc) |
| `signature_requests` | 24 | Pending/completed signature requests |
| `document_categories` | (unknown, verify) | Reference category catalog |
| `document_templates` | (unknown, verify) | Template registry |

**Total importable**: ~1363 rows confirmed.

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_document_categories` | Reference catalog (CONTRACT, ID_CARD, CERTIFICATE, etc.) |
| `sys_employee_documents` | employee_id, doc_category_id, doc_legacy_path (TEXT — blob refs stay legacy, store path as metadata), doc_hash, uploaded_at, uploaded_by_user_id |
| `sys_document_acknowledgments` | doc_id → sys_employee_documents, acknowledged_by_employee_id, acknowledged_at, signature_hash (optional) |
| `sys_signature_requests` | doc_id, requested_to_employee_id, status, requested_at, completed_at, signature_artifact_metadata jsonb |
| `sys_document_templates` (optional) | Template registry |

**Total new sys.* tables**: 4-5.

---

## §3 — FK resolution strategy

- **employee_id**: lm.employees_core (C3.2 ready).
- **uploaded_by_user_id**: lm.users.
- **doc_category_id**: sys_document_categories (within macro-area). Derive from DISTINCT source values.
- **tenant_id**: brownfield.tenant_id_mappings.
- **CRITICAL POLICY DECISION**: file blob references in `employee_documents.file_path` (or equivalent) → NOT portable to advanced. Store ONLY metadata + legacy reference. Flag in mapping_card as DEFER_BLOB.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | MEDIUM (6-8h). Volume moderate, but PII/document policy requires careful disposition + signature workflow has 24 rows of partially-completed state to preserve |
| **Dependencies** | C3.2 users+employees. None cross-area |
| **Risks** | PII in document content (contracts contain salary + personal data) — apply `pii_disposition='TAG_SYNTHETIC'` on metadata-only cols, never extract content; blob refs require explicit DEFER flag |
| **Recommended timing** | Wave 4 (C6 batch), 3rd (DGOV cluster) |

---

## §5 — Recommended order in C4/C5/C6 scale

**C6 batch, 3rd pilot** (DGOV extension, careful PII handling needed).
