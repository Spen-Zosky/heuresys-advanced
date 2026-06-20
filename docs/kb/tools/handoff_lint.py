#!/usr/bin/env python3
"""
handoff_lint.py — deterministic gate for the handoff/SoT system.

Verifies that the state sources are coherent BEFORE the handoff skill commits + pushes
(design: docs/superpowers/specs/2026-06-20-handoff-rigor-and-hold-lane-design.md §4).
The handoff skill runs this and must not push on a red lint (like a red CI — R3).

Checks (pragmatic subset, anchored to the REAL files — the 132KB backlog is mostly
historical archive, so the "every item has a status" rule applies only to the tagged
HOLD/WAIT-INPUT register, not the whole file — see design §4/§7 refinement note):

  D1  STATE disjunction   — .handoff/STATE.md carries no counts outside the Verification block
  D2  SOT internal        — §0 headline migration count == the latest "## Delta" block
  D3  SOT freshness        — declared migration count == real (ls db/migrations) [needs repo only]
  D4  SOT head             — the latest Delta's cited HEAD sha == git rev-parse HEAD (warn)
  S1  STATE structure      — required sections present, <= MAX_STATE_LINES, 1..3 priorities
  H1  HOLD integrity       — every item in the HOLD register has the 4 required fields
  S2  vocabulary           — every register item has a status from the closed vocabulary
  H2  no orphan defer       — STATE "Top priorities" has no raw DEFER/sospeso/differito (use HOLD)

Exit: 0 = pass (or warn-only mode) | 1 = at least one FAIL in --strict | 2 = internal error.
Usage:
    python docs/kb/tools/handoff_lint.py            # warn-only (prints FAIL/WARN, exit 0)
    python docs/kb/tools/handoff_lint.py --strict   # gate: exit 1 on any FAIL
    python docs/kb/tools/handoff_lint.py --no-db     # (reserved) skip DB-derived checks
"""
import argparse
import glob
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
STATE_MD = os.path.join(REPO, ".handoff", "STATE.md")
SOT_MD = os.path.join(REPO, "docs", "kb", "SOT_STATE.md")
BACKLOG_MD = os.path.join(REPO, "docs", "kb", "SOT_BACKLOG.md")

MAX_STATE_LINES = 70  # STATE.md is the rapid view — keep it short (design §3 says <60; +slack)
VALID_STATES = {"ACTIVE", "GATED", "WAIT-INPUT", "HOLD", "INTERRUPTED", "DONE", "FATTO", "WON'T-DO"}
HOLD_REQUIRED = ("hold-reason", "decided-by", "hold-since", "reactivation-trigger")
WAIT_REQUIRED = ("input-richiesto", "perche-solo-tuo")
DEFER_WORDS = ("differit", "sospes", "rimandat", "sessione dedicata", "DEFER ")

# A "count" token in STATE prose that would violate disjunction (design §3.1: STATE = zero
# counts). We look for explicit count shapes, NOT identifiers (SXXX session ids, dates,
# migration filenames are allowed as references; bare "N file"/"N/M"/"N moduli" are not).
COUNT_RE = re.compile(r"\b\d+\s*(?:file|moduli|module|test|endpoint|tabelle|migration)\b"
                      r"|\b\d+\s*/\s*\d+\b", re.IGNORECASE)

FAILS, WARNS = [], []
def fail(cid, msg): FAILS.append(f"{cid}: {msg}")
def warn(cid, msg): WARNS.append(f"{cid}: {msg}")


def read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        return None


def split_sections(md):
    """Return list of (header, body) for each '## ' section; preamble under header ''."""
    out, cur_h, cur = [], "", []
    for line in md.splitlines():
        if line.startswith("## "):
            out.append((cur_h, "\n".join(cur)))
            cur_h, cur = line[3:].strip(), []
        else:
            cur.append(line)
    out.append((cur_h, "\n".join(cur)))
    return out


def strip_code_blocks(text):
    """Remove ```...``` fenced blocks (the Verification commands legitimately carry numbers)."""
    return re.sub(r"```.*?```", "", text, flags=re.DOTALL)


def real_migration_count():
    files = glob.glob(os.path.join(REPO, "db", "migrations", "*.sql"))
    nums = []
    for f in files:
        m = re.match(r"(\d+)", os.path.basename(f))
        if m:
            nums.append(int(m.group(1)))
    return len(files), (max(nums) if nums else 0)


def git_head():
    try:
        return subprocess.check_output(["git", "-C", REPO, "rev-parse", "--short", "HEAD"],
                                       text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return None


# --- checks -------------------------------------------------------------------------------

def check_state(md):
    if md is None:
        fail("S1", f"{STATE_MD} missing")
        return
    lines = md.splitlines()
    if len(lines) > MAX_STATE_LINES:
        warn("S1", f"STATE.md is {len(lines)} lines (> {MAX_STATE_LINES}) — keep the rapid view short")
    low = md.lower()
    for needle in ("last session brief", "top priorities", "open questions", "verification"):
        if needle not in low:
            fail("S1", f"STATE.md missing required section: '{needle}'")

    # D1 — counts outside the Verification fenced block
    no_code = strip_code_blocks(md)
    # drop the Verification section heading body lines that are inside ``` already removed;
    # scan the prose that remains
    offenders = []
    for ln in no_code.splitlines():
        s = ln.strip()
        if not s or s.startswith(("#", ">")):
            continue
        offenders += COUNT_RE.findall(s)
    if offenders:
        sample = ", ".join(repr(o.strip()) for o in offenders[:5])
        warn("D1", f"STATE.md carries {len(offenders)} count-like token(s) outside Verification "
                   f"(disjunction: counts belong in SOT_STATE). e.g. {sample}")

    # S1 — number of priorities (look at the 'Top priorities' section)
    secs = split_sections(md)
    for h, body in secs:
        if "top priorities" in h.lower():
            items = re.findall(r"^\s*\d+\.\s", body, flags=re.MULTILINE)
            if not (1 <= len(items) <= 4):
                warn("S1", f"STATE.md 'Top priorities' has {len(items)} numbered items (expected 1-3)")
            # H2 — no raw defer markers in the priorities prose
            for w in DEFER_WORDS:
                if w.lower() in body.lower():
                    warn("H2", f"STATE.md priorities contain raw rinvio marker '{w.strip()}' "
                               f"— formalize as HOLD in the backlog register")
                    break


def declared_migration_ranges(md):
    """All '000xxx..000yyy' ranges in document order; return list of max (yyy) ints.
    The FIRST is the §0 headline (current snapshot); the LAST sits in the newest Delta."""
    return [int(y) for y in re.findall(r"000\d{3}\s*\.\.\s*`?000(\d{3})", md)]


def check_sot(md):
    if md is None:
        warn("D2", f"{SOT_MD} missing (granular view absent — ok in minimal projects)")
        return
    _, real_max = real_migration_count()
    ranges = declared_migration_ranges(md)
    if not ranges:
        warn("D3", "SOT_STATE: no '000xxx..000yyy' migration range found to verify freshness")
    else:
        head_max = ranges[0]      # §0 headline (first occurrence in the doc)
        doc_max = max(ranges)     # freshest count present anywhere in the doc (counts grow monotonically)
        # D3 — §0 headline freshness vs disk (the canonical "current" count)
        if head_max != real_max:
            fail("D3", f"SOT_STATE §0 headline declares max migration 000{head_max:03d} but disk "
                       f"has 000{real_max:03d} — re-derive the headline at handoff")
        # D2 — §0 headline must reflect the freshest count present in the doc (else it's stale
        #      vs a more recent Delta block)
        if head_max != doc_max:
            fail("D2", f"SOT_STATE internal drift: §0 headline 000{head_max:03d} vs freshest in-doc "
                       f"000{doc_max:03d} — the headline was not updated to the latest Delta")

    # D4 — HEAD cited in the doc vs git (warn: only equal when run pre-commit at handoff)
    head = git_head()
    if head:
        shas = re.findall(r"HEAD\s+\**`?([0-9a-f]{7,40})`?", md)
        if shas and not any(s.startswith(head) or head.startswith(s) for s in shas):
            warn("D4", f"SOT_STATE cites HEAD {shas[0]} but git HEAD is {head} "
                       f"(stale unless this runs pre-commit)")


def parse_register_items(md):
    """Items of the form '- **#id title** · status: STATE' with key: value sub-bullets."""
    items = []
    cur = None
    for line in md.splitlines():
        m = re.match(r"\s*-\s+\*\*(.+?)\*\*\s*·?\s*status:\s*([A-Z'\-]+)", line)
        if m:
            if cur:
                items.append(cur)
            cur = {"title": m.group(1).strip(), "status": m.group(2).strip(), "fields": {}}
            continue
        if cur:
            fld = re.match(r"\s*-\s+(.*)", line)
            if fld:
                # one sub-bullet may carry several "key: value" segments separated by ·
                for seg in fld.group(1).split("·"):
                    mk = re.match(r"\s*([a-zà-ù][a-zà-ù\-]*):\s*(.+)", seg.strip(), flags=re.IGNORECASE)
                    if mk:
                        cur["fields"][mk.group(1).strip().lower()] = mk.group(2).strip()
            elif line.strip() and not line.startswith(" "):
                items.append(cur)
                cur = None
    if cur:
        items.append(cur)
    return items


def check_register(md):
    if md is None:
        fail("H1", f"{BACKLOG_MD} missing")
        return
    secs = split_sections(md)
    reg = [b for h, b in secs if "hold register" in h.lower() or "wait-input" in h.lower()
           or "registro hold" in h.lower()]
    if not reg:
        warn("H1", "SOT_BACKLOG has no tagged HOLD/WAIT-INPUT register section "
                   "(design §3.4 / §7 — parked items should live there, out of the menu)")
        return
    items = []
    for b in reg:
        items += parse_register_items(b)
    for it in items:
        st = it["status"]
        if st not in VALID_STATES:
            fail("S2", f"register item {it['title']!r} has invalid status {st!r} "
                       f"(closed vocabulary: {sorted(VALID_STATES)})")
        if st == "HOLD":
            miss = [k for k in HOLD_REQUIRED if k not in it["fields"]]
            if miss:
                fail("H1", f"HOLD item {it['title']!r} missing required field(s): {miss}")
        if st == "WAIT-INPUT":
            miss = [k for k in WAIT_REQUIRED if not any(k.startswith(f) or f.startswith(k.split('-')[0])
                                                        for f in it["fields"])]
            if miss:
                warn("H1", f"WAIT-INPUT item {it['title']!r} should carry {WAIT_REQUIRED}")
    print(f"  [register] {len(items)} parked item(s) parsed "
          f"({sum(1 for i in items if i['status']=='HOLD')} HOLD, "
          f"{sum(1 for i in items if i['status']=='WAIT-INPUT')} WAIT-INPUT)")


def main():
    ap = argparse.ArgumentParser(description="Deterministic gate for the handoff/SoT system.")
    ap.add_argument("--strict", action="store_true", help="exit 1 on any FAIL (gate mode)")
    ap.add_argument("--no-db", action="store_true", help="skip DB-derived checks (reserved)")
    args = ap.parse_args()

    try:
        check_state(read(STATE_MD))
        check_sot(read(SOT_MD))
        check_register(read(BACKLOG_MD))
    except Exception as exc:  # never let the lint itself crash the handoff silently
        print(f"handoff-lint INTERNAL ERROR: {exc}", file=sys.stderr)
        return 2

    for w in WARNS:
        print(f"WARN {w}")
    for f in FAILS:
        print(f"FAIL {f}")

    if FAILS and args.strict:
        print(f"\nhandoff-lint: {len(FAILS)} FAIL, {len(WARNS)} WARN — strict mode → blocking")
        return 1
    print(f"\nhandoff-lint OK ({len(FAILS)} fail / {len(WARNS)} warn"
          f"{' — warn-only mode, not blocking' if FAILS else ''})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
