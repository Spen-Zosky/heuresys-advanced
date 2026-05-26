# _00_DISCOVERY_<NNN>_<slug>.md

**Protocol phase:** DISCOVERY (Cowork-side, facts only)
**Goal ID:** <NNN>
**Slug:** <slug>
**Created:** YYYY-MM-DD, by Cowork
**Predecessor artefacts:** (none — discovery is the first phase)

---

## Scope of discovery

One paragraph: what we need to know in order to write a PROMPT that won't surprise the executor mid-EXEC.

**Hard rule for this phase:** facts only. No plan. No design. No "we should". Just numbers, paths, schemas, vocabularies, file hashes, current state.

---

## Information sources

| Source | Access method | Why we trust it |
|---|---|---|
| `D:\heuresys-advanced\...` | filesystem read | local repo, version-controlled |
| `heuresys_advanced` DB on oracle-vm-default | SSH remote-exec via `sudo -u postgres psql` | DB SoT |
| `legacy_mirror.*` | same | ingested legacy data proxy |
| `D:\evo.heuresys.com\` | filesystem read | source codebase, frozen |

---

## Findings — schemas

(Tables, views, columns relevant to the task. Use `\dt`, `\d+`, `information_schema`.)

| Schema | Object | Type | Notable columns | Row count | Notes |
|---|---|---|---|---|---|

## Findings — vocabularies / categorical values

(Distinct values of any column that drives behavior. E.g., transform codes, status enums, classification scopes.)

```sql
SELECT <column>, count(*) FROM <table> GROUP BY <column> ORDER BY count(*) DESC;
```

| Value | Count | Semantics (verified) | Source code reference |
|---|---|---|---|

## Findings — row counts of interest

| Object | Exact count | Method | Timestamp UTC |
|---|---|---|---|

## Findings — file SHAs (anchor for rollback / drift detection)

| Path | SHA-256 | Size | Mtime |
|---|---|---|---|

## Findings — current state snapshot

(Anything stuck, in-flight, half-done that the PROMPT must account for.)

- ...

---

## Unknowns / open questions

(Things we tried to find out and couldn't. Each unknown must have a proposed mitigation in the PROMPT.)

| Unknown | Why it matters | Proposed mitigation in PROMPT |
|---|---|---|

---

## Discovery acceptance

- [ ] Every fact above has a verified-by command + output + timestamp
- [ ] No "I think" / "probably" / "should be" — only "as of <timestamp>: <value>"
- [ ] Unknowns are listed; for each, a mitigation is proposed for the PROMPT phase

*End of _00_DISCOVERY_<NNN>_<slug>.md*
