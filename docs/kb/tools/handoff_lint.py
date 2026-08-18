#!/usr/bin/env python3
"""
handoff_lint.py — deterministic gate for the handoff/SoT system.

Verifies that the state sources are coherent BEFORE the handoff skill commits + pushes
(design: docs/superpowers/specs/2026-06-20-handoff-rigor-and-hold-lane-design.md §4).
The handoff skill runs this and must not push on a red gate (like a red CI — R3).

10 checks (design §4.2), grouped into a few read-only functions over the working tree:

  D1  STATE disjunction   — .handoff/STATE.md carries no counts outside the Verification block
  D2  SOT internal        — §0 headline migration count == the freshest "## Delta" in the doc
  D3  SOT freshness       — declared migration count == real (ls db/migrations); cited git tags exist
  D4  SOT head            — the latest Delta's cited HEAD sha == git rev-parse HEAD (warn — pre-commit)
  S1  STATE structure     — required sections present, <= MAX_STATE_LINES, 1..4 priorities
  S2  vocabulary          — every register item has a status from the closed vocabulary
  H1  HOLD integrity      — every HOLD item has the 4 required fields (WAIT-INPUT its 2)
  H2  no orphan defer     — no raw DEFER/sospeso/differito in STATE priorities OR in an ACTIVE
                            (non-archive, non-terminal) backlog item — parked work belongs in the
                            tagged HOLD register, not in prose (design §1.3/§4.2/§7)
  A1  atomicity / refs    — the SoT files exist; every #id cited in STATE's actionable sections
                            resolves to the backlog (no dangling/partial handoff)
  A2  loop closed         — every #id STATE marks as closed/done is terminal in the backlog
                            (not still listed as an active item)
  L1  lab inbox drained   — no design-lab delivery left un-ingested (warn; silent where no lab)
  L2  lab trace intact    — every `lab-id:` in the register has its twin in inbox/ingerite/

Exit: 0 = pass | 1 = at least one FAIL (default: blocking gate) | 2 = internal error.
Usage:
    python docs/kb/tools/handoff_lint.py            # gate: exit 1 on any FAIL (design §4.1/§8)
    python docs/kb/tools/handoff_lint.py --warn-only # soft: print FAIL/WARN but exit 0
    python docs/kb/tools/handoff_lint.py --no-db     # skip DB-derived freshness checks (tunnel down)
"""
import argparse
import glob
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# L'id di una voce lo riconosce `programmi.py`, una volta sola: qui serve a T2 per incrociare
# le voci ACTIVE coi piani su disco, e la stessa funzione la usa build_menu.py per derivare
# l'avanzamento. Tre copie della regola sarebbero il difetto che #216 racconta.
import programmi  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
STATE_MD = os.path.join(REPO, ".handoff", "STATE.md")
SOT_MD = os.path.join(REPO, "docs", "kb", "SOT_STATE.md")
BACKLOG_MD = os.path.join(REPO, "docs", "kb", "SOT_BACKLOG.md")
# I piani per voce: e' da qui che `build_menu.py` deriva l'avanzamento (T1/T2).
PROGRAMMI_DIR = os.path.join(REPO, ".programmi")

MAX_STATE_LINES = 70  # STATE.md is the rapid view — keep it short (design §3 says <60; +slack)
STALE_TTL = 3         # a "(non ri-derivato)" count older than this many sessions → FAIL (P9/§11.9)
VALID_STATES = {"ACTIVE", "GATED", "WAIT-INPUT", "HOLD", "INTERRUPTED", "DONE", "FATTO", "WON'T-DO"}
TERMINAL_STATES = {"DONE", "FATTO", "WON'T-DO"}   # never expected in the menu (S3)
HOLD_REQUIRED = ("hold-reason", "decided-by", "hold-since", "reactivation-trigger")
WAIT_REQUIRED = ("input-richiesto", "perche-solo-tuo")
# Un lavoro interrotto senza il punto di ripresa e' un'interruzione dichiarata e persa lo stesso:
# `build_menu.py` lo porta in cima al menu e scrive «resume-from: ?». Lo stato INTERRUPTED non era
# mai stato usato in 200 voci (misurato S1069) e nessun controllo pretendeva niente da lui.
INTERRUPTED_REQUIRED = ("resume-from",)
DEFER_WORDS = ("differit", "sospes", "rimandat", "sessione dedicata", "DEFER ")

# A "count" token in STATE prose that would violate disjunction (design §3.1: STATE = zero
# counts). We look for explicit count shapes, NOT identifiers (SXXX session ids, dates,
# migration filenames are allowed as references; bare "N file"/"N/M"/"N moduli" are not).
COUNT_RE = re.compile(r"\b\d+\s*(?:file|moduli|module|test|endpoint|tabelle|migration)\b"
                      r"|\b\d+\s*/\s*\d+\b", re.IGNORECASE)

# An item/line is "terminal" (closed) if it carries any of these markers — such lines may
# legitimately mention a defer word as HISTORY (e.g. "✅ CHIUSO — i 3 DEFER importati").
TERMINAL_RE = re.compile(r"✅|⚪|🏁|~~|\bFATTO\b|\bDONE\b|WON'?T-DO|\bRISOLTO\b|\bCHIUS[OIE]\b"
                         r"|OBSOLETE|SUPERSED|ESEGUIT|RESOLVED|EXECUTED|\bCLOSED\b", re.IGNORECASE)
# A "## " section heading that is an archive/record (not an actionable menu section). Everything
# under it is history → H2 does not scan it.
ARCHIVE_HEADER_RE = re.compile(r"^(?:[✅⚪🟢🏁🔭⏸🗂]|.*(?:Aggiornament|Verifica stato|RESOLVED|register"
                               r"|Programma 100X|DONE))", re.IGNORECASE)
# A bold sub-block "**<emoji> Aggiornamento SXXX …**" inside an active section: from it to the
# next "## " heading is history (the backlog interleaves session records under P-sections).
# Emoji-agnostic: any bold heading whose text contains "Aggiornamento" is a session record.
ARCHIVE_BLOCK_RE = re.compile(r"^\s*\*\*[^*]*Aggiornament", re.IGNORECASE)
DEFER_MAJOR_RE = re.compile(r"defer-major", re.IGNORECASE)  # a CI label, not a deferral
ID_RE = re.compile(r"#(\d+)\b")
CLOSURE_RE = re.compile(r"✅|\bFATTO\b|\bDONE\b|\bRISOLT[OA]\b|\bchius[oie]\b|\bCLOSED\b", re.IGNORECASE)

FAILS, WARNS, SKIPS = [], [], []
def fail(cid, msg): FAILS.append(f"{cid}: {msg}")
def warn(cid, msg): WARNS.append(f"{cid}: {msg}")
def skip(cid, msg): SKIPS.append(f"{cid}: {msg}")


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


def has_defer(line):
    """True if the line carries a raw deferral word that is NOT just the 'defer-major' CI label."""
    probe = DEFER_MAJOR_RE.sub("", line)
    return any(w.lower() in probe.lower() for w in DEFER_WORDS)


def real_migration_count():
    files = glob.glob(os.path.join(REPO, "db", "migrations", "*.sql"))
    nums = []
    for f in files:
        m = re.match(r"(\d+)", os.path.basename(f))
        if m:
            nums.append(int(m.group(1)))
    return len(files), (max(nums) if nums else 0)


def current_session(state_md):
    """Current session number — the first 'SXXX' token in STATE (header/brief). None if absent.
    Shared with build_menu.py (P2/P9)."""
    if not state_md:
        return None
    m = re.search(r"\bS(\d{3,4})\b", state_md)
    return int(m.group(1)) if m else None


def git_head():
    try:
        return subprocess.check_output(["git", "-C", REPO, "rev-parse", "--short", "HEAD"],
                                       text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return None


def git_tags():
    try:
        out = subprocess.check_output(["git", "-C", REPO, "tag"], text=True,
                                      stderr=subprocess.DEVNULL)
        return set(out.split())
    except Exception:
        return None


# --- checks -------------------------------------------------------------------------------

def check_state(md):
    """D1 (disjunction), S1 (structure), H2 (STATE priorities have no raw defer)."""
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

    # S1 — number of priorities + H2 — no raw defer markers in the priorities prose
    secs = split_sections(md)
    for h, body in secs:
        if "top priorities" in h.lower():
            items = re.findall(r"^\s*\d+\.\s", body, flags=re.MULTILINE)
            if not (1 <= len(items) <= 4):
                warn("S1", f"STATE.md 'Top priorities' has {len(items)} numbered items (expected 1-3)")
            for ln in strip_code_blocks(body).splitlines():
                if has_defer(ln):
                    fail("H2", f"STATE.md priorities carry a raw rinvio marker "
                               f"({ln.strip()[:70]!r}) — formalize it as HOLD in the backlog register")
                    break


def declared_migration_ranges(md):
    """All '000xxx..000yyy' ranges in document order; return list of max (yyy) ints.
    The FIRST is the §0 headline (current snapshot); the LAST sits in the newest Delta."""
    return [int(y) for y in re.findall(r"000\d{3}\s*\.\.\s*`?000(\d{3})", md)]


def check_sot(md, use_db, cur=None):
    """D2 (internal coherence), D3 (freshness vs disk + cited tags + stale-count TTL), D4 (head sha)."""
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

    # D3 (cont.) — every git tag the SOT cites must actually exist (a phantom 'v1.2.0' = drift).
    if use_db is not False:  # repo-only, but skipped under --no-db for symmetry with the contract
        tags = git_tags()
        # Only assert when SOME tags are present: a shallow CI checkout (fetch-depth 1, no tags)
        # has an empty tag set — there we can't claim a cited tag is phantom, so skip.
        if tags:
            cited = set(re.findall(r"`(v\d+\.\d+\.\d+)`", md))
            phantom = sorted(t for t in cited if t not in tags)
            if phantom:
                fail("D3", f"SOT_STATE cites git tag(s) that do not exist: {phantom} "
                           f"(create the tag or fix the reference)")
    else:
        skip("D3", "git-tag existence check skipped (--no-db)")

    # D4 — HEAD cited in the doc vs git (warn: only equal when run pre-commit at handoff)
    head = git_head()
    if head:
        shas = re.findall(r"HEAD\s+\**`?([0-9a-f]{7,40})`?", md)
        if shas and not any(s.startswith(head) or head.startswith(s) for s in shas):
            warn("D4", f"SOT_STATE cites HEAD {shas[0]} but git HEAD is {head} "
                       f"(stale unless this runs pre-commit)")

    # P9 / §11.9 — stale-count TTL: a count in the CURRENT snapshot marked "(non ri-derivato …)"
    # must be re-derived within STALE_TTL sessions — a tunnel-down marker can't live forever.
    # Scope = the snapshot region only (everything before the first Delta/archive section), so the
    # historical "non ri-derivati" records inside old Delta blocks don't false-positive.
    snapshot = re.split(r"(?m)^##\s+(?:.*Delta|.*Aggiornament|[✅⚪🟢🏁🔭⏸🗂])", md, maxsplit=1)[0]
    for m in re.finditer(r"non ri-derivat\w*", snapshot, re.IGNORECASE):
        seg = snapshot[m.start():m.start() + 140]
        sm = re.search(r"S(\d{3,4})", seg)
        if not sm:
            warn("D3", "snapshot has a '(non ri-derivato)' count without a session stamp — mark it "
                       "'(non ri-derivato — tunnel down, SXXX)' so its staleness is bounded")
        elif cur is not None and cur - int(sm.group(1)) > STALE_TTL:
            fail("D3", f"snapshot count '(non ri-derivato)' stamped S{sm.group(1)} is "
                       f"{cur - int(sm.group(1))} sessions stale (> TTL {STALE_TTL}) — re-derive it")


# Un titolo puo' portarsi dietro una parentetica in corsivo — «*(era «vecchio nome»; ri-titolato
# 2026-08-14 perche'…)*» — fra il grassetto e lo stato. La prima stesura pretendeva lo stato
# SUBITO dopo il titolo, e quelle righe non producevano un item: `#50` e `#69`, entrambe ACTIVE,
# erano INVISIBILI al menu (misurato S1069) — `#50` con un programma aperto che il boot stampava
# in una sezione diversa. Il grassetto si chiude sull'ULTIMO `**` prima dello stato, cosi' il
# titolo resta il nome e non si spezza su un grassetto annidato. S5 qui sotto impedisce la
# ricaduta: una riga che dichiara uno stato e non diventa un item e' un FAIL.
RE_ITEM_HEAD = re.compile(r"\s*-\s+\*\*(.+)\*\*[^·]*·?\s*status:\s*([A-Z'\-]+)")
# Il riconoscitore LASCO: cio' che un umano legge come voce del register. Il confronto fra
# questo e RE_ITEM_HEAD e' la misura di quante voci il menu sta perdendo.
RE_ITEM_LASCO = re.compile(r"\s*-\s+\*\*.+?\*\*.*?\bstatus:\s*([A-Z][A-Z'\-]*)")


def parse_register_items(md):
    """Items of the form '- **#id title** · status: STATE' with key: value sub-bullets."""
    items = []
    cur = None
    for line in md.splitlines():
        m = RE_ITEM_HEAD.match(line)
        if m:
            if cur:
                items.append(cur)
            cur = {"title": m.group(1).strip(), "status": m.group(2).strip(), "fields": {}}
            continue
        if cur:
            fld = re.match(r"\s*-\s+(.*)", line)
            if fld:
                # Split on '·' only where a 'key:' follows — a '·' inside a field VALUE is
                # prose (e.g. "F0·F1·F2" in a hold-reason), not a delimiter. A plain
                # split("·") truncated every value at its first '·' (S1014 fix).
                for seg in re.split(r"·(?=\s*[A-Za-zà-ù][A-Za-zà-ù\-]*:\s)", fld.group(1)):
                    mk = re.match(r"\s*([a-zà-ù][a-zà-ù\-]*):\s*(.+)", seg.strip(), flags=re.IGNORECASE)
                    if mk:
                        cur["fields"][mk.group(1).strip().lower()] = mk.group(2).strip()
            elif line.strip() and not line.startswith(" "):
                items.append(cur)
                cur = None
    if cur:
        items.append(cur)
    return items


def is_register_heading(h):
    """The sections build_menu.py reads. Single definition — S3 below compares against
    exactly the same predicate the menu uses, so the two can never disagree."""
    h = h.lower()
    return ("action register" in h or "hold register" in h
            or "wait-input" in h or "registro hold" in h)


def check_register(md):
    """S2 (closed vocabulary), H1 (HOLD/WAIT-INPUT metadata integrity), S3 (items outside)."""
    if md is None:
        fail("H1", f"{BACKLOG_MD} missing")
        return
    secs = split_sections(md)
    reg = [b for h, b in secs if is_register_heading(h)]
    if not reg:
        warn("H1", "SOT_BACKLOG has no tagged Action/HOLD register section "
                   "(design §3.4 / §7 — menu items should live there, structured)")
        return
    items = []
    for b in reg:
        items += parse_register_items(b)

    # S4 — un identificativo, una voce. Il cancello non lo guardava, e il 2026-08-16
    # (#200) il register e' arrivato a portare DUE `#196` e DUE `#198`: l'ingestione
    # di una consegna del lab aveva creato blocchi di *proposta di aggiornamento*
    # riusando il numero della voce da aggiornare. Nessuna delle dieci verifiche se
    # ne accorgeva, e il menu della sessione dopo avrebbe mostrato la stessa voce
    # due volte con contenuti diversi — cioe' due verita' concorrenti sullo stesso
    # numero. Trovato a mano leggendo il file, che e' il modo in cui NON si devono
    # trovare le cose.
    visti = {}
    for it in items:
        m = re.match(r"#(\d+)\b", it["title"])
        if not m:
            continue
        visti.setdefault(m.group(1), []).append(it["title"])
    for numero, titoli in sorted(visti.items()):
        if len(titoli) > 1:
            fail("S4", f"l'identificativo #{numero} apre {len(titoli)} blocchi diversi — "
                       f"un numero, una voce. Titoli: {titoli}")

    # S5 — una riga che DICHIARA uno stato e non diventa un item e' invisibile al menu, e lo e'
    # in silenzio: il conteggio del register scende di uno e nessuno ha un secondo numero con cui
    # confrontarlo. E' cosi' che `#50` e `#69` — entrambe ACTIVE, la prima con un programma aperto
    # che il boot stampava poco piu' sotto — sono rimaste fuori dal menu (misurato S1069). La causa
    # era una parentetica in corsivo fra il titolo e lo stato, cioe' prosa legittima. Il cancello
    # non guarda la CAUSA: confronta cio' che un umano legge come voce (RE_ITEM_LASCO) con cio' che
    # il parser produce, e pretende che i due numeri coincidano. Qualunque forma nuova che il
    # parser non digerisce cade qui, non fra sei mesi.
    lasche = [(n, l) for n, l in enumerate(md.splitlines(), 1)
              if RE_ITEM_LASCO.match(l) and not RE_ITEM_HEAD.match(l)]
    if lasche:
        dove = "; ".join(f"riga {n}: {l.strip()[:70]}" for n, l in lasche[:4])
        fail("S5", f"{len(lasche)} riga/e dichiarano uno status ma NON producono un item del "
                   f"register — sono invisibili al menu (build_menu.py legge gli item, non le "
                   f"righe): {dove}{' …' if len(lasche) > 4 else ''}")

    for it in items:
        st = it["status"]
        if st not in VALID_STATES:
            fail("S2", f"register item {it['title']!r} has invalid status {st!r} "
                       f"(closed vocabulary: {sorted(VALID_STATES)})")
        if st == "HOLD":
            miss = [k for k in HOLD_REQUIRED if k not in it["fields"]]
            if miss:
                fail("H1", f"HOLD item {it['title']!r} missing required field(s): {miss}")
        if st == "INTERRUPTED":
            miss = [k for k in INTERRUPTED_REQUIRED if k not in it["fields"]]
            if miss:
                fail("S6", f"INTERRUPTED item {it['title']!r} senza {miss}: il menu lo porta in "
                           f"cima e non sa dire da dove riprendere — un'interruzione senza punto "
                           f"di ripresa non e' tracciata, e' solo dichiarata")
        if st == "WAIT-INPUT":
            miss = [k for k in WAIT_REQUIRED if not any(k.startswith(f) or f.startswith(k.split('-')[0])
                                                        for f in it["fields"])]
            if miss:
                warn("H1", f"WAIT-INPUT item {it['title']!r} should carry {WAIT_REQUIRED}")
    # S3 — a structured item written OUTSIDE the tagged register is INVISIBLE to the session
    # menu: build_menu.py reads only these sections. Such an item passes every other check,
    # sits in the file looking recorded, and never reaches the menu. That is precisely how
    # #140..#143 — the top priority STATE.md declared — missed the S1045 boot menu, while
    # handoff-lint reported "0 fail". Terminal statuses are exempt: a DONE item living in a
    # historical section is archive, not a menu entry.
    orphans = [it for h, b in secs if not is_register_heading(h)
               for it in parse_register_items(b)
               if it["status"] in VALID_STATES - TERMINAL_STATES]
    if orphans:
        names = ", ".join(o["title"][:60] for o in orphans[:6])
        fail("S3", f"{len(orphans)} non-terminal register item(s) live OUTSIDE the tagged "
                   f"Action/HOLD register and are therefore invisible to the session menu "
                   f"(build_menu.py reads only those sections): {names}"
                   f"{' …' if len(orphans) > 6 else ''} — move the block(s) into the register")

    def _n(st): return sum(1 for i in items if i["status"] == st)
    print(f"  [register] {len(items)} item(s): {_n('ACTIVE')} ACTIVE, {_n('GATED')} GATED, "
          f"{_n('WAIT-INPUT')} WAIT-INPUT, {_n('HOLD')} HOLD, {_n('INTERRUPTED')} INTERRUPTED")


def check_backlog_defer(md):
    """H2 (backlog) — a raw deferral in an ACTIVE backlog item is an orphan: it must be a HOLD.

    Scope (low false-positive on the 130KB historical archive): scan only ACTIVE sections,
    skipping (a) archive '## ' headings (✅/🟢/🔭/⏸/Aggiornamento/…), (b) bold '**🟢 Aggiornamento
    SXXX**' sub-blocks inside active sections, (c) lines already carrying a terminal marker
    (✅/⚪/~~/FATTO/DONE/…) — those mention a defer word as closed history, not as a live park.
    """
    if md is None:
        return
    in_archive_header = False   # under an archive '## ' section
    in_archive_block = False    # under a '**🟢 Aggiornamento**' sub-block (until next '## ')
    for raw in strip_code_blocks(md).splitlines():
        if raw.startswith("## "):
            header = raw[3:].strip()
            in_archive_header = bool(ARCHIVE_HEADER_RE.match(header))
            in_archive_block = False
            continue
        if in_archive_header:
            continue
        if ARCHIVE_BLOCK_RE.match(raw):
            in_archive_block = True
            continue
        if in_archive_block:
            continue
        if has_defer(raw) and not TERMINAL_RE.search(raw):
            fail("H2", f"backlog has an orphan rinvio in an active item "
                       f"({raw.strip()[:80]!r}) — move it to the HOLD register with a "
                       f"reactivation-trigger (design §7)")
            return  # one is enough to block; reporting the first keeps the output actionable


def _state_actionable_ids(state_md):
    """#ids cited in STATE's actionable sections (Top priorities + Open questions)."""
    ids = set()
    for h, body in split_sections(state_md):
        if "top priorities" in h.lower() or "open questions" in h.lower():
            ids |= set(ID_RE.findall(strip_code_blocks(body)))
    return ids


def check_atomicity(state_md, backlog_md, sot_md):
    """A1 — SoT files present + every #id cited in STATE's actionable sections resolves in the
    backlog/SOT (a dangling reference means a partial/incoherent handoff)."""
    if state_md is None:
        fail("A1", "STATE.md missing — the rapid view is mandatory")
        return
    if backlog_md is None:
        return  # minimal project: no backlog to cross-reference
    haystack = backlog_md + ("\n" + sot_md if sot_md else "")
    for cid in sorted(_state_actionable_ids(state_md), key=int):
        if not re.search(rf"#{cid}\b", haystack):
            fail("A1", f"STATE cites #{cid} in an actionable section but it resolves to no "
                       f"backlog/SOT item (dangling reference — partial handoff)")


def check_loop_closed(state_md, backlog_md):
    """A2 — every #id STATE marks as closed/done must be terminal in the backlog, never still
    listed as an active (non-archive, non-terminal) item."""
    if state_md is None or backlog_md is None:
        return
    closed_ids = set()
    for ln in strip_code_blocks(state_md).splitlines():
        if CLOSURE_RE.search(ln):
            closed_ids |= set(ID_RE.findall(ln))
    if not closed_ids:
        return
    # Build the set of #ids that appear as ACTIVE backlog items (non-archive, non-terminal line).
    active_ids = set()
    in_archive_header = in_archive_block = False
    for raw in strip_code_blocks(backlog_md).splitlines():
        if raw.startswith("## "):
            in_archive_header = bool(ARCHIVE_HEADER_RE.match(raw[3:].strip()))
            in_archive_block = False
            continue
        if in_archive_header:
            continue
        if ARCHIVE_BLOCK_RE.match(raw):
            in_archive_block = True
            continue
        if in_archive_block or TERMINAL_RE.search(raw):
            continue
        if re.match(r"\s*-\s+\*\*", raw) or raw.startswith("|"):
            active_ids |= set(ID_RE.findall(raw))
    for cid in sorted(closed_ids & active_ids, key=int):
        fail("A2", f"STATE marks #{cid} as closed but the backlog still lists it as an active "
                   f"item (loop not closed — mark it DONE/terminal in the backlog)")


def check_lab_inbox():
    """L1/L2 — the lab->canonica channel is drained and its tracking is intact.

    L1  a delivery the design-lab deposited in <lab>/inbox/ is still NOT in the register: the
        session would close leaving work invisible to the next boot (that is the very drift
        lab_inbox exists to remove).
    L2  a `lab-id:` in the register has no twin file in <lab>/inbox/ingerite/: the trace is
        broken — either the file was deleted by hand or the id was typed instead of ingested.

    WARN, never FAIL, and by design: the lab lives OUTSIDE the repo. On the clones and in CI
    (state-lint.yml, self-hosted OCI runner) there is no lab at all — `riassunto()` returns ""
    and this check is silent. A directory outside the repo must not be able to block a push.
    """
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import lab_inbox
    except Exception as exc:
        warn("L1", f"lab_inbox not importable ({exc}) — lab->canonica channel unverified")
        return
    if not os.path.isdir(lab_inbox.INBOX):
        return                       # no lab on this machine: total silence (clones, CI)
    registro = read(lab_inbox.REGISTRO) or ""
    pendenti, rotte = [], []
    for c in lab_inbox.consegne():
        if not c["valida"]:
            rotte.append(c["file"])
        elif lab_inbox.stato_nel_registro(c["lab_id"], registro) is None:
            pendenti.append(c["lab_id"])
    if pendenti:
        warn("L1", f"{len(pendenti)} lab deliveries not yet in the register ({', '.join(pendenti[:3])}"
                   f"{'…' if len(pendenti) > 3 else ''}) — run "
                   f"`python docs/kb/tools/lab_inbox.py --ingest` before closing")
    if rotte:
        warn("L1", f"malformed lab deliveries (no lab-id or no ```markdown block): {', '.join(rotte)}")
    # L2 — every lab-id claimed by the register must have its twin among the ingested files
    ingerite = set(os.listdir(lab_inbox.INGERITE)) if os.path.isdir(lab_inbox.INGERITE) else set()
    testi = {f: "" for f in ingerite}
    for f in list(testi):
        try:
            testi[f] = lab_inbox._leggi(os.path.join(lab_inbox.INGERITE, f))
        except OSError:
            pass
    # #129 — confronto ESATTO, non per sottostringa: `lab_inbox.citato()` e' lo stesso
    # predicato usato dal canale, quindi lint e ingestione non possono piu' dissentire
    # su cosa sia «gia' citato». Prima, un id prefisso di un altro risultava gemellato
    # alla consegna sbagliata e la traccia si rompeva in silenzio.
    orfani = [lid for lid in set(re.findall(r"^\s*-\s*lab-id:\s*(\S+)", registro, re.M))
              if not any(lab_inbox.citato(lid, t) for t in testi.values())]
    if orfani:
        warn("L2", f"{len(orfani)} lab-id(s) in the register have no twin in inbox/ingerite/: "
                   f"{', '.join(sorted(orfani)[:3])}{'…' if len(orfani) > 3 else ''}")


# ── T1/T2 — l'avanzamento si DERIVA, non si ricopia (Enzo, 2026-08-18) ────────────
#
# IL DIFETTO CHE QUESTI DUE CONTROLLI ESISTONO PER IMPEDIRE, misurato in S1068.
# `build_menu.py` costruisce il menu di avvio dai **titoli** e dagli **effort**, non dai
# corpi delle voci. In S1068 i corpi sono stati aggiornati con spunte ed evidenze e i
# titoli lasciati intatti: la sessione dopo ha aperto un menu che descriveva difetti
# gia' curati — «35 casi rossi ... Triage: quanti guasti distinti» quando il triage era
# fatto e i rossi erano 18. Poi il rammendo: l'avanzamento e' stato scritto NEL titolo
# («8 task su 9»), che e' la stessa cristallizzazione con un giro in piu' — si stacca
# alla prossima sessione che avanza di un task.
#
# E' il ⭐ PUNTO FISSO del CLAUDE.md applicato al register: **un dato che per sua natura
# varia non si scrive come fatto — si scrive il modo di produrlo.** L'avanzamento di una
# voce varia per definizione. Il posto dove vive derivato e' `.programmi/<id>-*.md`, da
# cui `build_menu.py` legge le fasi di OGNI voce ACTIVE — T2 lo garantisce, ed e' bloccante
# da S1069.
#
# L'effort ha la stessa malattia del titolo e va guardato insieme a lui: «~1 sessione (resta
# il solo T9)» invecchia alla prossima sessione che chiude T9, e il menu lo stampa accanto al
# nome. Le parole sono diverse — qui non si contano fasi, si dice cosa e' fatto — quindi il
# riconoscitore e' un altro.
EFFORT_CON_AVANZAMENTO = re.compile(
    r"\b(?:e'|è)\s+(?:gia'|già)\s+\w+"                    # «è già fatto»
    r"|\b(?:gia'|già)\s+(?:fatt|scritt|collaudat|pront)"  # «già fatto/scritta/collaudata»
    r"|\brest(?:a|ano)\b"                                 # «resta il solo T9», «restano i passi 4-7»
    r"|\bFATTO\b|\bfatt[ao]\s+in\s+S\d+"                  # «il triage è FATTO in S1067»
    r"|\bcurata\s+in\s+S\d+"                              # «① curata in S1068»
    r"|\bF\d+\s+fatta\b",                                 # «il piano ha 8 fasi, F0 fatta»
    re.IGNORECASE)
TITOLO_CON_AVANZAMENTO = re.compile(
    r"\b\d+\s+\w+\s+su\s+\d+"                        # «8 task su 9», «3 tabelle su 8»
    r"|\bfase\s+\d+\s*/\s*\d+"                       # «fase 3/5»
    r"|\bda\s+\d+\s+a\s+\d+\b"                       # «da 35 a 18»
    r"|\b\d+\s+(?:candidati|perimetri|righe|casi)\b",  # «47 candidati», «29 righe»
    re.IGNORECASE)


def check_titoli_derivati(backlog_md):
    """T1 (FAIL): nessun titolo ACTIVE cristallizza un avanzamento.
       T2 (WARN oggi): una voce multi-passo senza piano non puo' mostrare da dove riprende."""
    if backlog_md is None:
        return
    attive = [it for it in parse_register_items(backlog_md) if it["status"] == "ACTIVE"]

    # T1 — bloccante: il titolo e' un NOME, non un contatore. E l'effort e' un COSTO: quando in
    # S1068 i titoli sono stati puliti, l'avanzamento si e' spostato li' («resta il solo T9», «il
    # triage e' FATTO in S1067») — la stessa cristallizzazione con un giro in piu', e il menu la
    # stampava accanto al titolo esattamente come prima. Le due sedi si guardano insieme, o
    # pulire l'una insegna solo a scrivere nell'altra.
    colpiti = [it["title"] for it in attive if TITOLO_CON_AVANZAMENTO.search(it["title"])]
    if colpiti:
        primo = colpiti[0][:70]
        fail("T1", f"{len(colpiti)} titolo/i ACTIVE contengono un avanzamento che invecchia "
                   f"(es. «{primo}…»): l'avanzamento si deriva da .programmi/, il titolo e' un nome")
    sporchi = [(it["title"][:40], it["fields"]["effort"]) for it in attive
               if "effort" in it["fields"] and EFFORT_CON_AVANZAMENTO.search(it["fields"]["effort"])]
    if sporchi:
        t, e = sporchi[0]
        fail("T1", f"{len(sporchi)} effort ACTIVE dichiarano cosa e' fatto o cosa resta "
                   f"(es. «{t}…» → «{e[:60]}…»): l'effort e' un COSTO, l'avanzamento sta nel piano")

    # T2 — OGNI voce ACTIVE ha il suo piano, anche quella che sta in una sessione sola. La prima
    # stesura contava solo le multi-sessione, e ne vedeva 3 su 11 mancanti: il filtro sull'effort
    # lasciava fuori proprio le voci brevi, che sono quelle su cui il menu tace di piu' («~40min»
    # non dice ne' cosa e' fatto ne' da dove si riprende). Il piano non serve a spezzare una voce:
    # e' il posto dove «cosa e' fatto / cosa manca / da dove si riprende» esiste in forma leggibile
    # da uno strumento, ed e' cio' da cui build_menu.py deriva l'avanzamento invece di ricopiarlo.
    # Bloccante da S1069, quando gli undici piani mancanti sono stati scritti: prima era WARN
    # perche' un cancello che nasce rosso e resta rosso insegna a non guardare i rossi (#194).
    try:
        piani = {i for i in (programmi.normalizza_id(f) for f in os.listdir(PROGRAMMI_DIR)) if i}
    except OSError:
        return
    # T3 — nessuna voce ACTIVE puo' finire fuori da tutti e tre i tier del menu. Il menu
    # raggruppa per `priority` confrontandola con "P1"/"P2"/"P3": chi scrive `**P1**` per dare
    # enfasi produce una voce che non compare **affatto** — non in fondo, proprio assente.
    # Colpiva `#217`, `#181` e `Z-251`, tutte e tre P1, cioe' le piu' urgenti (misurato S1069).
    # `build_menu` ora ripulisce il markup; questo impedisce che una forma nuova riapra il buco.
    fuori = [it["title"][:40] for it in attive
             if it["fields"].get("priority", "P2").replace("*", "").replace("`", "").strip().upper()
             not in ("P1", "P2", "P3")]
    if fuori:
        fail("T3", f"{len(fuori)} voci ACTIVE hanno una priorita' che il menu non sa raggruppare "
                   f"(es. «{fuori[0]}…»): finirebbero fuori da tutti i tier, cioe' invisibili")

    senza = [i for i in (programmi.normalizza_id(it["title"]) for it in attive)
             if i and i not in piani]
    if senza:
        fail("T2", f"{len(senza)} voci ACTIVE senza piano in .programmi/ "
                   f"({', '.join(sorted(senza))}): il menu non puo' mostrare da dove riprendono, "
                   f"e l'avanzamento tornerebbe a vivere ricopiato nel register")


def main():
    ap = argparse.ArgumentParser(description="Deterministic gate for the handoff/SoT system.")
    ap.add_argument("--warn-only", action="store_true",
                    help="print FAIL/WARN but exit 0 (soft mode; default is blocking, design §4.1)")
    ap.add_argument("--strict", action="store_true",
                    help="(default) exit 1 on any FAIL — kept for back-compat with earlier callers")
    ap.add_argument("--no-db", action="store_true", help="skip DB-derived freshness checks (tunnel down)")
    args = ap.parse_args()
    use_db = not args.no_db

    try:
        state = read(STATE_MD)
        sot = read(SOT_MD)
        backlog = read(BACKLOG_MD)
        check_state(state)
        check_sot(sot, use_db, current_session(state))
        check_register(backlog)
        check_backlog_defer(backlog)
        check_atomicity(state, backlog, sot)
        check_loop_closed(state, backlog)
        check_titoli_derivati(backlog)
        check_lab_inbox()
    except Exception as exc:  # never let the lint itself crash the handoff silently
        print(f"handoff-lint INTERNAL ERROR: {exc}", file=sys.stderr)
        return 2

    for s in SKIPS:
        print(f"SKIPPED {s}")
    for w in WARNS:
        print(f"WARN {w}")
    for f in FAILS:
        print(f"FAIL {f}")

    blocking = not args.warn_only
    if FAILS and blocking:
        print(f"\nhandoff-lint: {len(FAILS)} FAIL, {len(WARNS)} WARN — blocking (fix before push)")
        return 1
    print(f"\nhandoff-lint OK ({len(FAILS)} fail / {len(WARNS)} warn / {len(SKIPS)} skipped"
          f"{' — warn-only mode, not blocking' if FAILS else ''})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
