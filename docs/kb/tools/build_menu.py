#!/usr/bin/env python3
"""
build_menu.py — P2 (design 2026-06-20 §11.2): generate the session-start action menu from the
canonical Action register (SOT_BACKLOG.md) instead of reconstructing it by hand. The menu becomes
a pure function of the structured state → exhaustive by construction (closes gap #8). The LLM
PRESENTS this output and adds only judgment (impact / aggregability).

Folds in:
  P3 (§11.3) — evaluates reactivation/unblock triggers `{kind: query|file-exists|manual}` and flags
               parked/gated items that became unblockable ("⚡ SBLOCCABILE").
  P9 (§11.9) — annotates each item's age in sessions (from *-since fields vs the current session).

Read-only. Exit 0 always (it's a generator, not a gate).
Usage: python docs/kb/tools/build_menu.py [--show-hold] [--no-db]
"""
import argparse
import os
import re
import subprocess
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")  # glyph/arrow-safe su console Windows cp1252
except Exception:
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from handoff_lint import (read, split_sections, parse_register_items, current_session,  # noqa: E402
                          BACKLOG_MD, STATE_MD, REPO)

PSQL = ["psql", "-h", "localhost", "-p", "5433", "-U", "heuresys", "-d", "heuresys_advanced", "-tAc"]
LANES = ("ACTIVE", "GATED", "WAIT-INPUT", "HOLD", "INTERRUPTED")


def register_items(backlog_md):
    if not backlog_md:
        return []
    secs = split_sections(backlog_md)
    reg = [b for h, b in secs if "action register" in h.lower() or "hold register" in h.lower()
           or "wait-input" in h.lower() or "registro hold" in h.lower()]
    items = []
    for b in reg:
        items += parse_register_items(b)
    return items


def age_in_sessions(it, cur):
    """Item age = current session - the SXXX in any '*-since' field (None if unknown)."""
    if cur is None:
        return None
    for k, v in it["fields"].items():
        if k.endswith("since"):
            m = re.search(r"S(\d{3,4})", v)
            if m:
                return cur - int(m.group(1))
    return None


def _cmp(val, expect):
    m = re.match(r"\s*([<>]=?|=)?\s*(\d+)", expect)
    if not m:
        return False
    op, n = (m.group(1) or ">"), int(m.group(2))
    return {">": val > n, ">=": val >= n, "<": val < n, "<=": val <= n, "=": val == n}.get(op, val > n)


def eval_trigger(text, use_db):
    """Evaluate a reactivation/unblock trigger. Returns (state, detail) where state is one of
    manual | unblocked | blocked | unknown. `{kind: manual}` and free prose → manual."""
    if not text:
        return ("manual", "")
    mq = re.search(r"kind:\s*query.*?sql:\s*[\"']([^\"']+)[\"'].*?expect:\s*[\"']?([<>]=?\s*\d+|=?\s*\d+)",
                   text, re.IGNORECASE | re.DOTALL)
    if mq:
        if not use_db:
            return ("unknown", "query (--no-db)")
        sql, expect = mq.group(1), mq.group(2)
        try:
            out = subprocess.check_output(PSQL + [sql], text=True, stderr=subprocess.DEVNULL, timeout=15).strip()
            val = int(re.search(r"-?\d+", out).group(0))
            return ("unblocked" if _cmp(val, expect) else "blocked", f"{val} vs {expect.strip()}")
        except Exception:
            return ("unknown", "query not evaluable (tunnel down?)")
    mf = re.search(r"kind:\s*file-exists.*?path:\s*[\"']([^\"']+)[\"']", text, re.IGNORECASE | re.DOTALL)
    if mf:
        return ("unblocked" if os.path.exists(os.path.join(REPO, mf.group(1))) else "blocked",
                f"file {mf.group(1)}")
    return ("manual", "")


def _age_tag(it, cur):
    a = age_in_sessions(it, cur)
    return f" · età {a} sess." if a is not None else ""


def _trigger_field(it):
    for k in ("reactivation-trigger", "unblock-trigger"):
        if k in it["fields"]:
            return it["fields"][k]
    return ""


def main():
    ap = argparse.ArgumentParser(description="Generate the session-start action menu (design §11.2).")
    ap.add_argument("--show-hold", action="store_true", help="list HOLD items instead of just the count")
    ap.add_argument("--no-db", action="store_true", help="don't run psql trigger queries")
    args = ap.parse_args()
    use_db = not args.no_db

    backlog, state = read(BACKLOG_MD), read(STATE_MD)
    cur = current_session(state)
    items = register_items(backlog)
    by = {lane: [] for lane in LANES}
    for it in items:
        by.setdefault(it["status"], []).append(it)

    out = []
    out.append(f"## Menu azioni (generato — build_menu.py" + (f", sessione S{cur}" if cur else "") + ")")
    out.append("")

    # INTERRUPTED — top (work in flight to resume)
    if by["INTERRUPTED"]:
        out.append("### ▶ INTERRUPTED — riprendi (lavoro in volo)")
        for it in by["INTERRUPTED"]:
            rf = it["fields"].get("resume-from", "?")
            out.append(f"- **{it['title']}**{_age_tag(it, cur)} — resume-from: {rf}")
        out.append("")

    # ACTIVE — tiered by priority
    actives = by["ACTIVE"]
    for tier in ("P1", "P2", "P3"):
        rows = [it for it in actives if it["fields"].get("priority", "P2").upper() == tier]
        if rows:
            out.append(f"### {tier} — ACTIVE")
            for it in rows:
                eff = it["fields"].get("effort", "")
                doc = it["fields"].get("doc", "")
                extra = " · ".join(x for x in (eff, doc) if x)
                out.append(f"- **{it['title']}**{_age_tag(it, cur)}" + (f" — {extra}" if extra else ""))
            out.append("")

    # GATED — visible with blocker, flagged if its unblock-trigger now fires (P3)
    if by["GATED"]:
        out.append("### ⛔ GATED — bloccato da una dipendenza tecnica")
        for it in by["GATED"]:
            blk = it["fields"].get("blocker", "?")
            tstate, det = eval_trigger(_trigger_field(it), use_db)
            flag = "  ⚡ **SBLOCCABILE ORA** (" + det + ")" if tstate == "unblocked" else ""
            out.append(f"- **{it['title']}**{_age_tag(it, cur)} — ⛔ {blk}{flag}")
        out.append("")

    # WAIT-INPUT — dedicated tray
    if by["WAIT-INPUT"]:
        out.append("### ⏳ WAIT-INPUT — aspetta un tuo input")
        for it in by["WAIT-INPUT"]:
            inp = it["fields"].get("input-richiesto", "?")
            out.append(f"- **{it['title']}**{_age_tag(it, cur)} — {inp}")
        out.append("")

    # HOLD — pull lane: count summary only, unless --show-hold. P3: flag any that became unblockable.
    holds = by["HOLD"]
    unblockable = []
    for it in holds:
        tstate, det = eval_trigger(_trigger_field(it), use_db)
        if tstate == "unblocked":
            unblockable.append((it, det))
    if holds:
        out.append(f"### ⏸ HOLD — {len(holds)} azioni in corsia pull (gestione separata)")
        out.append('Fuori dal menu per scelta — scrivi *"mostra hold"* per l\'elenco, o *"riprendi #<id>"*.')
        for it, det in unblockable:
            out.append(f"- ⚡ **{it['title']}** — il reactivation-trigger ora è soddisfatto ({det}) → riattivabile")
        if args.show_hold:
            for it in holds:
                hr = it["fields"].get("hold-reason", "")
                out.append(f"  - **{it['title']}**{_age_tag(it, cur)} — {hr}")
        out.append("")

    # P9 — health summary (anti-accumulation)
    nonterminal = sum(len(by[l]) for l in LANES)
    stale = [it for lane in ("HOLD", "WAIT-INPUT", "INTERRUPTED") for it in by[lane]
             if (age_in_sessions(it, cur) or 0) > 20]
    out.append(f"_health: {nonterminal} item non-terminali"
               + (f" · {len(stale)} fermi >20 sessioni (candidati WON'T-DO)" if stale else "")
               + (f" · {len(unblockable)} HOLD sbloccabili" if unblockable else "") + "._")

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
