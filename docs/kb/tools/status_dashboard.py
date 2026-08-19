#!/usr/bin/env python3
"""
status_dashboard.py — ONE live, re-derived "dove siamo" view for heuresys-advanced.

Born S1007 ("sono al buio"): the documented state had drifted (SOT_STATE §1-§10 stale
vs §0), so reading the docs produced contradictory numbers. This tool never trusts a
cached number: it re-derives everything at run time from the live source of record
(git / gh / psql / curl) and reads the SoT docs ONLY to compare for drift. Run it at
session start, after the boot hook, to see the real health at a glance.

Reuses the existing tooling — it does NOT reinvent parsing/derivation:
  * handoff_lint.py → read/split_sections, real_migration_count, declared_migration_ranges,
                      git_head, current_session, path constants, and the 10 coherence checks.
  * build_menu.py   → register_items, LANES, eval_trigger (backlog lanes + unblock triggers).
  * the canonical DB aggregate is the same count(*) bundle shipped in
    apps/api/src/modules/public-stats/repository.ts; integrity = the 6 STRUCTURAL views in
    db/scripts/validate_database.sh ("0 rows = clean").

Read-only. Exit 0 (it's a VIEW, not a gate). --strict exits 1 if any section is RED.
Usage:
    python docs/kb/tools/status_dashboard.py            # full live dashboard
    python docs/kb/tools/status_dashboard.py --no-db    # skip psql (tunnel down)
    python docs/kb/tools/status_dashboard.py --no-net   # skip git-fetch / gh / curl (offline)
    python docs/kb/tools/status_dashboard.py --md        # emit markdown to stdout
    python docs/kb/tools/status_dashboard.py --strict    # exit 1 if any RED
"""
import argparse
import contextlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import handoff_lint as hl  # noqa: E402
from handoff_lint import (  # noqa: E402
    read, real_migration_count, declared_migration_ranges, git_head,
    current_session, split_sections, strip_code_blocks,
    REPO, STATE_MD, SOT_MD, BACKLOG_MD,
)
from build_menu import register_items, LANES, eval_trigger  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8")  # Italian labels + glyphs on Windows consoles
except Exception:
    pass

DEBT_MD = os.path.join(REPO, "docs", "kb", "DEBT_REGISTER.md")
PROD = "https://www.heuresys.com"
PSQL_BIN = shutil.which("psql") or r"C:\Program Files\PostgreSQL\16\bin\psql.exe"
PSQL = [PSQL_BIN, "-h", "localhost", "-p", "5433", "-U", "heuresys", "-d", "heuresys_advanced", "-tAc"]

# 6 STRUCTURAL validation views (db/scripts/validate_database.sh) — non-zero rows = invariant violation.
STRUCTURAL_VIEWS = (
    "sys.v_orphan_position_assignments",
    "sys.v_tenant_boundary_violations",
    "sys.v_canonical_outside_sys",
    "sys.v_active_primary_assignment_per_user",
    "sys.v_visualization_node_in_canonical_node",
    "sys.v_inbox_resource_consistency",
)
# One round-trip: 10 aggregate counts mirroring public-stats/repository.ts (+ migrations ledger).
COUNTS_SQL = (
    "SELECT (SELECT count(*) FROM sys.sys_users),"
    " (SELECT count(*) FROM sys.sys_positions),"
    " (SELECT count(*) FROM sys.sys_organization_units),"
    " (SELECT count(*) FROM sys.sys_teams),"
    " (SELECT count(*) FROM sys.sys_auth_roles),"
    " (SELECT count(*) FROM sys.sys_auth_permissions),"
    " (SELECT count(*) FROM sys.sys_auth_role_permissions),"
    " (SELECT count(*) FROM sys.sys_skills),"
    " (SELECT count(*) FROM sys.sys_tenancies WHERE tenant_status='ACTIVE'),"
    " (SELECT count(*) FROM sys.sys_schema_migrations);"
)
INTEGRITY_SQL = "SELECT coalesce(sum(n),0) FROM (" + " UNION ALL ".join(
    f"SELECT (SELECT count(*) FROM {v}) n" for v in STRUCTURAL_VIEWS) + ") t;"
# i18n dati (ADR-0029): completezza EN (vista 000207) + anomalie + orfani (000190).
# NB: gate del DB reale — heuresys_ci non carica i dataset (stessa ragione di 000195).
I18N_SQL = (
    "SELECT (SELECT count(*) FROM sys.v_reference_translation_coverage WHERE missing > 0),"
    " (SELECT count(*) FROM sys.v_reference_translation_coverage WHERE missing < 0),"
    " (SELECT count(*) FROM sys.v_reference_translation_orphans);"
)

# Glyphs (ASCII — safe on any console). OK=green, BAD=red, DOT=neutral count, UNK=unknown.
OK, BAD, DOT, UNK = "[OK]", "[!!]", "[..]", "[? ]"


# --- low-level helpers --------------------------------------------------------------------
def sh(*args, timeout=20):
    # encoding esplicito: senza, Python su Windows decodifica con cp1252 e QUALUNQUE
    # output non-ASCII fa fallire la chiamata con UnicodeDecodeError — che qui viene
    # inghiottito dall'except e riportato come "comando non riuscito". È così che la
    # sezione job-schedulati diceva "VM non raggiungibile" mentre la VM rispondeva
    # benissimo: `systemctl --failed` stampa un pallino U+25CF (S1029).
    try:
        return subprocess.check_output(list(args), text=True, encoding="utf-8",
                                       errors="replace", stderr=subprocess.DEVNULL,
                                       timeout=timeout).strip()
    except Exception:
        return None


def q(sql, timeout=15):
    """One psql round-trip. Returns stripped stdout, or None on any failure (tunnel down)."""
    try:
        return subprocess.check_output(PSQL + [sql], text=True, stderr=subprocess.DEVNULL,
                                       timeout=timeout).strip()
    except Exception:
        return None


def http_status(url, timeout=6):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "heuresys-status"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (fixed https host)
            return resp.getcode(), resp.read(400).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return None, ""


class Section:
    def __init__(self, title):
        self.title, self.rows, self.red = title, [], 0

    def add(self, glyph, text):
        self.rows.append((glyph, text))
        if glyph == BAD:
            self.red += 1
        return self


def superficie_codex():
    """Le voci che il CLAUDE.md dichiara legittimamente non tracciate e NON di Claude.

    Fonte UNICA: `scripts/lib/superficie-codex.txt`, letta anche da `session-boot.ps1`.
    Se il file manca la lista e' vuota, cioe' si torna a contare tutto come sporcizia:
    degradare verso il rumore, mai verso il silenzio.
    """
    p = os.path.join(REPO, "scripts", "lib", "superficie-codex.txt")
    try:
        with io.open(p, encoding="utf-8") as f:
            return [l.strip() for l in f if l.strip() and not l.lstrip().startswith("#")]
    except OSError:
        return []


def e_di_codex(path, voci):
    """Una voce che finisce con `/` copre la cartella e il suo contenuto; una senza `/`
    deve combaciare esattamente — cosi' `.codex-mio-appunto.md` resta sporcizia mia."""
    for v in voci:
        if v.endswith("/"):
            if path == v.rstrip("/") or path.startswith(v):
                return True
        elif path == v:
            return True
    return False


# --- sections -----------------------------------------------------------------------------
def sec_git(no_net):
    s = Section("GIT & SYNC")
    head = git_head() or "?"
    if not no_net:
        sh("git", "-C", REPO, "fetch", "origin", "main", "--quiet", timeout=25)
    ab = sh("git", "-C", REPO, "rev-list", "--left-right", "--count", "origin/main...HEAD")
    behind = ahead = None
    if ab:
        parts = re.split(r"\s+", ab.strip())
        if len(parts) == 2:
            behind, ahead = int(parts[0]), int(parts[1])
    dirty = sh("git", "-C", REPO, "status", "--porcelain")
    nd = ncodex = None
    if dirty is not None:
        righe = [l for l in dirty.splitlines() if l.strip()]
        voci = superficie_codex()
        ncodex = len([l for l in righe if e_di_codex(l[3:].strip().strip('"'), voci)])
        nd = len(righe) - ncodex
    sync = f"ahead {ahead} / behind {behind}" if ahead is not None else "ahead ?/behind ? (no fetch)"
    s.add(OK if (ahead == 0 and behind == 0) else (UNK if ahead is None else BAD),
          f"HEAD {head} · origin/main · {sync}")
    # #217 I8 — il rendiconto delle chiusure viene LETTO. Aveva 269 record e nessuno li
    # guardava: la misura che ha fatto nascere #217 e' uscita da li', ricavata a mano una
    # volta sola. Mostra, non decide (la skill: «rendiconto, non stato»).
    try:
        sys.path.insert(0, os.path.join(REPO, "docs", "kb", "tools"))
        import rendiconto_chiusure as rc
        for stato, testo in rc.righe_boot():
            s.add({"OK": OK, "BAD": BAD}.get(stato, UNK), testo)
    except Exception as exc:
        s.add(UNK, f"rendiconto chiusure: non leggibile ({type(exc).__name__})")
    coda = f" · {ncodex} voci di Codex, attese per contratto" if ncodex else ""
    if nd is None:
        s.add(UNK, "working tree: stato non leggibile")
    elif nd == 0:
        s.add(OK, "working tree pulito" + coda)
    else:
        s.add(BAD, f"working tree DIRTY ({nd} file miei)" + coda)
    return s


def sec_ci(no_net):
    s = Section("QUALITY GATES (ultima CI su main — letta, non rieseguita)")
    if no_net or not shutil.which("gh"):
        s.add(UNK, "gh non disponibile / --no-net")
        return s
    raw = sh("gh", "run", "list", "--branch", "main", "--limit", "40", "--json",
             "workflowName,conclusion,status,createdAt", timeout=30)
    if not raw:
        s.add(UNK, "gh run list non disponibile")
        return s
    try:
        runs = json.loads(raw)
    except Exception:
        s.add(UNK, "gh output non parsabile")
        return s
    latest = {}
    for r in runs:
        wf = r.get("workflowName", "?")
        if wf not in latest or r.get("createdAt", "") > latest[wf].get("createdAt", ""):
            latest[wf] = r
    for wf in sorted(latest):
        r = latest[wf]
        concl, st = r.get("conclusion"), r.get("status")
        if st != "completed":
            s.add(UNK, f"{wf:<26} {st}")
        elif concl == "success":
            s.add(OK, f"{wf:<26} success")
        else:
            s.add(BAD, f"{wf:<26} {concl}")
    return s


def sec_prod(no_net):
    s = Section("PROD (www.heuresys.com)")
    if no_net:
        s.add(UNK, "--no-net")
        return s
    code, _ = http_status(PROD + "/login")
    s.add(OK if code == 200 else (UNK if code is None else BAD), f"/login        {code if code else 'timeout'}")
    code, body = http_status(PROD + "/api/readyz")
    ready = code == 200 and ('"ready"' in body or '"ok"' in body or body == "")
    detail = "ready" if code == 200 else (code if code else "timeout")
    s.add(OK if ready else (UNK if code is None else BAD), f"/api/readyz   {detail}")
    return s


def sec_scheduled_jobs(no_net):
    """Esito dei job schedulati su PROD — il canale di consegna degli alert (Z-015).

    Prometheus non può scrapare un one-shot: un timer che fallisce ogni notte non
    compare in nessuna metrica. Dal S1029 ogni unit schedulata ha
    `OnFailure=heuresys-unit-failure@%n.service`, che scrive un registro persistente;
    qui lo leggiamo. È il punto in cui un guasto notturno incontra finalmente un
    lettore: la sessione viene aperta, una dashboard no. Prima di questo,
    `dailyaidecheck` ha fallito ogni giorno per settimane senza che nessuno lo sapesse.
    """
    s = Section("JOB SCHEDULATI PROD (registro OnFailure)")
    if no_net:
        s.add(UNK, "--no-net")
        return s
    # `--plain` toglie il pallino U+25CF davanti al nome: senza, il primo token della
    # riga è il glifo e il nome dell'unit non arriva mai a schermo.
    failed = sh("ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8",
                "oracle-vm-default", "systemctl --failed --no-legend --plain | head -5", timeout=25)
    if failed is None:
        s.add(UNK, "VM non raggiungibile")
        return s
    failed = failed.strip()
    if failed:
        for ln in failed.splitlines()[:5]:
            unit = next((t for t in ln.split() if t.endswith((".service", ".timer", ".mount"))), ln[:60])
            s.add(BAD, f"unit in stato failed: {unit}")
    else:
        s.add(OK, "nessuna unit in stato failed")

    recent = sh("ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "oracle-vm-default",
                "tail -3 /var/lib/heuresys/unit-failures.jsonl 2>/dev/null", timeout=25)
    if recent and recent.strip():
        for ln in recent.strip().splitlines():
            s.add(BAD, f"fallimento registrato: {ln[:110]}")
    else:
        s.add(OK, "registro fallimenti vuoto")

    rules = sh("ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "oracle-vm-default",
               "curl -s --max-time 5 localhost:9091/api/v1/rules "
               "| python3 -c \"import sys,json;d=json.load(sys.stdin);"
               "print(sum(len(g['rules']) for g in d['data']['groups']))\" 2>/dev/null", timeout=25)
    n = (rules or "").strip()
    s.add(OK if n.isdigit() and int(n) > 0 else BAD,
          f"regole di alert caricate in Prometheus: {n if n.isdigit() else 'nessuna'}")
    return s


def sec_db(no_db):
    s = Section("DATABASE (ri-derivato live :5433)")
    if no_db:
        s.add(UNK, "--no-db")
        return s, {}
    files, mx = real_migration_count()
    counts_raw = q(COUNTS_SQL)
    if counts_raw is None:
        s.add(UNK, "psql non raggiungibile (tunnel :5433 giù?)")
        return s, {}
    vals = counts_raw.replace("\n", "|").split("|")
    try:
        (users, positions, ou, teams, roles, perms, maps, skills, tenants, applied) = (int(v) for v in vals[:10])
    except (ValueError, IndexError):
        s.add(UNK, f"output psql inatteso: {counts_raw!r}")
        return s, {}
    live = dict(users=users, positions=positions, org_units=ou, teams=teams, roles=roles,
                permissions=perms, maps=maps, skills=skills, tenants=tenants,
                migrations_applied=applied, migrations_disk=files, migration_max=mx)
    s.add(OK if applied == files else BAD,
          f"migration   disco {files} (max 000{mx:03d})  {'==' if applied == files else '!='}  applicate {applied}")
    integ = q(INTEGRITY_SQL)
    if integ is None:
        s.add(UNK, "viste integrità non valutabili")
    else:
        nviol = int(re.search(r"-?\d+", integ).group(0))
        s.add(OK if nviol == 0 else BAD,
              f"integrità   6 viste strutturali = {nviol} righe in violazione")
    i18n = q(I18N_SQL)
    if i18n is None:
        s.add(UNK, "i18n dati non valutabile (viste 000190/000207 assenti?)")
    else:
        try:
            gaps, anoms, orphans = (int(v) for v in i18n.replace("\n", "|").split("|")[:3])
            s.add(OK if gaps == 0 and anoms == 0 and orphans == 0 else BAD,
                  f"i18n dati   coverage EN: {gaps} campi con gap · {anoms} anomalie · {orphans} orfani")
        except (ValueError, IndexError):
            s.add(UNK, f"i18n dati: output psql inatteso: {i18n!r}")
    s.add(DOT, f"utenti {users} · posizioni {positions} · OU {ou} · team {teams} · tenant ACTIVE {tenants}")
    s.add(DOT, f"RBAC {roles} ruoli · {perms} permessi · {maps} mapping · skill {skills}")
    # Scarto d'orologio fra QUESTA macchina e il database.
    # Perché è qui (S1037): il PC era indietro di 10 ore e 21 minuti e nessuno se
    # n'era accorto. Il sintomo è arrivato molto dopo e travestito — 14 test rossi
    # su MFA, con una scadenza «precedente» alla creazione, perché l'applicazione
    # calcola le scadenze con l'orologio locale e il database registra col proprio.
    # Un dato scritto con un orologio sbagliato non si riconosce guardandolo.
    skew = q("SELECT round(extract(epoch FROM now()) - extract(epoch FROM %s))::text"
             % f"to_timestamp({time.time():.3f})")
    if skew is None:
        s.add(UNK, "scarto d'orologio non valutabile")
    else:
        try:
            d = int(float(skew.strip()))
            if abs(d) <= 5:
                s.add(OK, f"orologio   allineato col database (scarto {d:+d}s)")
            else:
                s.add(BAD, f"orologio   QUESTA macchina è fuori di {abs(d)}s ({d:+d}) rispetto al database "
                           f"— le scadenze calcolate qui saranno sbagliate; su Windows: Start-Service W32Time; w32tm /resync")
        except ValueError:
            s.add(UNK, f"scarto d'orologio: output psql inatteso: {skew!r}")
    return s, live


def _snapshot(sot_md):
    r"""La §0: dall'intestazione «## 0. …» alla PROSSIMA intestazione, qualunque sia.

    ⚠ LA VERSIONE PRECEDENTE TAGLIAVA NEL POSTO SBAGLIATO, e non era un dettaglio.
    Cercava `^##\s+(?:.*Delta|…)`: su `### Delta S1067` il motore consuma `##`, poi
    pretende uno spazio e trova un terzo `#` — nessun match. Undici intestazioni di
    delta erano invisibili, e la «§0» diventava **79.979 caratteri, il 20,9% del
    file** invece dei **12.885 (3,4%)** della sezione vera.

    Non era un rischio teorico: il 2026-08-19 il controllo su RBAC-map era VERDE
    mentre la §0 dichiarava `959 map` contro i `980` del vivo — verde perché `980`
    compariva nei delta storici (piu' un match parassita dentro `3.980`).

    Qui il taglio non prova a indovinare quali intestazioni siano delta: prende la
    PRIMA intestazione di qualunque livello dopo la §0. Una sezione nuova non puo'
    quindi allargare la zona per sbaglio.
    """
    m = re.search(r"(?m)^##\s+0\.", sot_md)
    if not m:                      # nessuna §0 dichiarata: si degrada al vecchio taglio,
        return sot_md              # che e' largo — meglio largo che vuoto, qui.
    resto = sot_md[m.end():]
    fine = re.search(r"(?m)^#{1,6}\s", resto)
    return sot_md[m.start(): m.end() + (fine.start() if fine else len(resto))]


# ── C2 — un numero si cerca CON IL SUO CONTESTO, mai nudo ────────────────────────
# `\b2\b` ha 7 occorrenze nella §0 ristretta e 44 in quella larga: il controllo sui
# tenant non poteva diventare rosso NE' PRIMA NE' DOPO aver ristretto la zona. Era
# verde per costruzione, cioe' non era un controllo. Ogni metrica dichiara quindi le
# parole che qualificano il suo numero; il numero vale solo se una di quelle parole
# gli sta accanto.
# Ogni metrica dichiara la forma in cui il suo numero e' scritto: `{n}` e' il valore vivo.
# ⚠ NON basta «il numero e la parola sono vicini»: provato il 2026-08-19 con una finestra di
# 44 caratteri, `tenant=3` e `tenant=26` risultavano VERDI lo stesso, perche' in un paragrafo
# da 12.600 caratteri la parola «tenant» capita accanto a qualunque cifra. Il numero deve
# essere ATTACCATO alla parola che lo qualifica — «980 map», non «980 da qualche parte
# vicino a map». Tre metriche hanno il numero prima, `skill` lo ha dopo.
CONTESTI = {
    "users":   r"{n}\s+(?:persone|utenti)",
    "maps":    r"{n}\s+map",
    "tenants": r"{n}\s+tenant",
    "skills":  r"skill[^.;]{{0,24}}?{n}",
}


def _numero_qualificato(snap, numero, forma):
    """Il numero compare nella forma che lo qualifica?

    `forma` e' un template con `{n}`: si interpola il valore vivo e si cerca. Una sola
    occorrenza basta — in un paragrafo lungo lo stesso numero ricorre per ragioni diverse,
    ma ne serve UNA scritta nel modo giusto.
    """
    return re.search(forma.format(n=numero), snap, re.I) is not None


"""I percorsi che l'atlante DESCRIVE. Se nessuno di questi e' cambiato dopo la sua
generazione, l'atlante e' ancora vero — anche se HEAD e' avanzato di venti commit di
documenti."""
ATLAS_YAML = os.path.join("docs", "kb", "atlas", "atlas.yaml")
ATLAS_SOURCES = ("apps/api/src/modules", "apps/web/src/app",
                 "packages/shared/src/schemas", "db/migrations")


def atlas_freshness():
    """L'atlante e' un artefatto GENERATO: superato = il codice che descrive e' cambiato dopo.

    Enzo, 2026-08-16: «l'atlante deve essere sempre aggiornato e mai fermo a qualcosa di
    superato o incompleto». Questo lo rende una misura invece di un proposito.

    ⚠ Il confronto NON e' `commit == HEAD`, e la differenza e' tutto: HEAD avanza a ogni
    commit, anche di soli documenti, quindi quel test sarebbe rosso quasi sempre — un
    allarme che suona senza motivo insegna a non guardarlo (la lezione di #194, dove un
    falso ROSSO su una produzione sana e' costato piu' di nessun allarme). Qui la domanda
    e' l'unica che conta: *dei file che l'atlante descrive, ne e' cambiato qualcuno?*
    """
    if not os.path.isfile(ATLAS_YAML):
        return UNK, "atlante assente → python docs/kb/tools/build_atlas.py"
    commit = None
    with io.open(ATLAS_YAML, encoding="utf-8", errors="replace") as fh:
        for _ in range(12):  # `meta:` sta in testa; non si legge un file da 400KB per una riga
            line = fh.readline()
            if not line:
                break
            m = re.search(r"generated_from_commit:\s*(\S+)", line)
            if m:
                commit = m.group(1).strip('"')
                break
    if not commit:
        return UNK, "atlante senza commit di origine → rigenerarlo"
    try:
        changed = subprocess.check_output(
            ["git", "diff", "--name-only", commit + "..HEAD", "--"] + list(ATLAS_SOURCES),
            stderr=subprocess.DEVNULL).decode().split()
    except Exception:
        return UNK, "atlante: impossibile confrontare %s con HEAD" % commit[:8]
    if changed:
        return BAD, ("atlante SUPERATO: %d file di sorgente cambiati dopo %s "
                     "→ python docs/kb/tools/build_atlas.py" % (len(changed), commit[:8]))
    return OK, "atlante fresco (da %s, nessun sorgente cambiato dopo)" % commit[:8]


def sec_drift(no_db, live, sot_md, state_md):
    """Live vs documented (§0). Authoritative: migration headline + handoff_lint + atlante."""
    s = Section("STALENESS SELF-CHECK (live vs SOT_STATE §0)")
    # Authoritative #0 — l'atlante e' la SoT interrogabile del progetto (S1016): se e'
    # superato, ogni strumento che ci si appoggia misura il passato senza saperlo.
    s.add(*atlas_freshness())
    # Authoritative #1 — migration headline declared in §0 vs disk (the count handoff_lint gates on).
    if not no_db and live:
        declared = declared_migration_ranges(sot_md)
        dmax = declared[0] if declared else None
        if dmax is None:
            s.add(UNK, "§0 non dichiara un range migration")
        else:
            s.add(OK if dmax == live["migration_max"] else BAD,
                  f"migration max: live 000{live['migration_max']:03d}  vs  §0 000{dmax:03d}")
    # Authoritative #2 — run the project's own coherence engine in-process.
    # NB (Z-030, misurato S1030): al boot questo e' il SECONDO passaggio del lint — il primo lo fa
    # scripts/session-boot.ps1 come hook. La duplicazione e' voluta e costa ~0.4 s (handoff_lint
    # --warn-only: 375/395/815 ms; session_start.py completo: 4.2 s). In-process qui e' obbligatorio:
    # `pnpm status` gira anche senza hook, e dopo un'edit ai file di stato un verdetto in cache
    # sarebbe stale proprio quando serve fresco. Vedi il commento gemello in session-boot.ps1.
    hl.FAILS.clear(); hl.WARNS.clear(); hl.SKIPS.clear()
    try:
        with contextlib.redirect_stdout(io.StringIO()):  # check_register prints a summary — mute it
            hl.check_state(state_md)
            hl.check_sot(sot_md, not no_db, current_session(state_md))
            hl.check_register(read(BACKLOG_MD))
            hl.check_backlog_defer(read(BACKLOG_MD))
        nf, nw = len(hl.FAILS), len(hl.WARNS)
        s.add(OK if nf == 0 else BAD, f"handoff_lint coherence: {nf} FAIL / {nw} WARN")
    except Exception as exc:
        s.add(UNK, f"handoff_lint non eseguibile: {exc}")
    finally:
        hl.FAILS.clear(); hl.WARNS.clear(); hl.SKIPS.clear()
    # #217 I6 — gli artefatti DERIVATI invecchiano come l'atlante, e nessuno li guardava.
    # Misurato il 2026-08-18: `concepts-corpus.jsonl` non aveva 6 concetti esistenti e ne
    # portava 4 di uno schema RITIRATO settimane prima. Stessa domanda dell'atlante — non
    # «quanti giorni ha», ma *le sue fonti sono state toccate dopo?*
    try:
        sys.path.insert(0, os.path.join(REPO, "docs", "kb", "tools"))
        import build_derivati as bd
        esiti = bd.stato()
        vecchi = [a for a, e, _d in esiti if e == "superato"]
        ciechi = [a for a, e, _d in esiti if e == "cieco"]
        if vecchi:
            s.add(BAD, f"derivati: {len(vecchi)}/{len(esiti)} superati → python docs/kb/tools/build_derivati.py")
        elif ciechi:
            s.add(UNK, f"derivati: {len(ciechi)}/{len(esiti)} NON MISURABILI (mai committati)")
        else:
            s.add(OK, f"derivati: {len(esiti)}/{len(esiti)} freschi (agent-operations, concepts, ADR_INDEX)")
    except Exception as exc:
        s.add(UNK, f"derivati: non misurabili ({type(exc).__name__})")
    # La §0 porta davvero i numeri vivi? Ora la domanda e' posta sulla sezione VERA e
    # con il contesto: «980 accanto a "map"», non «980 da qualche parte nel 21% del file».
    if not no_db and live:
        snap = _snapshot(sot_md)
        for label, key in (("utenti", "users"), ("RBAC-map", "maps"),
                           ("tenant ACTIVE", "tenants"), ("skill", "skills")):
            present = _numero_qualificato(snap, live[key], CONTESTI[key])
            s.add(OK if present else BAD,
                  f"{label}: live {live[key]} "
                  f"{'presente in §0' if present else 'NON in §0 → drift'}")
    return s


def sec_context():
    """Le due misure che decidono se si continua — contesto e finestra di 5 ore.

    Enzo, 2026-08-13: la stima a impressione non e' affidabile e va sostituita, non
    solo vietata; e al contesto va affiancato il limite delle 5 ore, per fermarsi PRIMA
    di sbatterci contro invece che dopo. Il `guardiano` legge i token che l'API ha
    riportato nel transcript e la percentuale che Claude Code passa alla riga di stato.

    Sta qui perche' una regola che vive solo in un resoconto non viene riletta: al boot
    i numeri si vedono da se', in ogni sessione.

    Cio' che non si puo' misurare si dichiara NON MISURABILE. Mai un ripiego stimato:
    un numero inventato qui e' peggio di nessun numero, perche' sembra una misura.
    """
    s = Section("GUARDIANO — contesto e finestra 5h (misurati, non stimati)")
    try:
        import guardiano
        m = guardiano.misura(None, None)
        m5 = guardiano.misura_5h()
        v = guardiano.sorveglia(m, m5)
    except Exception as exc:                                    # noqa: BLE001
        s.add(UNK, f"non misurabile ({type(exc).__name__}) — NON stimare a impressione")
        return s

    if m.get("ok"):
        fr = m["frazione"]
        s.add(BAD if fr >= guardiano.STOP_CONTESTO else (DOT if fr >= 0.60 else OK),
              f"contesto {m['percento']:.1f}% · consumato {m['contesto']:,} · "
              f"residuo {m['residuo']:,} su {m['finestra']:,}")
    else:
        s.add(UNK, f"contesto non misurabile: {m.get('errore', '?')}")

    if m5.get("ok"):
        sette = m5.get("sette_giorni_pct")
        coda = f" · 7 giorni {sette:.0f}%" if isinstance(sette, (int, float)) else ""
        s.add(BAD if m5["frazione"] >= guardiano.STOP_5H else (DOT if m5["frazione"] >= 0.60 else OK),
              f"finestra 5h {m5['percento']:.1f}%  (dato di {m5['eta_min']:.0f} min fa{coda})")
    else:
        s.add(UNK, f"finestra 5h non misurabile: {m5.get('errore', '?')}")

    if v["cieco"]:
        s.add(BAD, "GUARDIANO CIECO: nessuna delle due misure disponibile. Non e' un 'tutto bene'.")
    elif v["chiudi"]:
        s.add(BAD, f"⛔ SOGLIA RAGGIUNTA — {' e '.join(v['motivi'])} → {guardiano.PROCEDURA}")
    else:
        s.add(DOT, f"si continua · soglie {guardiano.STOP_CONTESTO:.0%} contesto / "
                   f"{guardiano.STOP_5H:.0%} finestra 5h (regola OR)")
    s.add(DOT, "il contesto e' un PAVIMENTO: il turno in corso non e' ancora nel transcript")
    return s


def sec_backlog(no_db):
    s = Section("BACKLOG (Action register)")
    items = register_items(read(BACKLOG_MD))
    by = {lane: [it for it in items if it["status"] == lane] for lane in LANES}
    unblockable = 0
    for it in by["GATED"] + by["HOLD"]:
        trig = it["fields"].get("reactivation-trigger") or it["fields"].get("unblock-trigger") or ""
        if eval_trigger(trig, not no_db)[0] == "unblocked":
            unblockable += 1
    glyph = BAD if by["INTERRUPTED"] else DOT
    s.add(glyph, " · ".join(f"{lane} {len(by[lane])}" for lane in LANES)
          + (f"  ⚡ {unblockable} sbloccabili" if unblockable else ""))
    return s


def sec_debts():
    s = Section("DEBITI TECNICI (DEBT_REGISTER)")
    md = read(DEBT_MD)
    if md is None:
        s.add(UNK, "DEBT_REGISTER.md assente")
        return s
    terminal = re.compile(r"RISOLT|non-issue|gestit|chiarit|monitor|WON'?T|OBSOLETE", re.IGNORECASE)
    opens, red = [], 0
    for ln in md.splitlines():
        if not ln.lstrip().startswith("|"):
            continue
        if not re.search(r"^\s*\|\s*\*?\*?D-\d+", ln):
            continue
        # Stato = ULTIMA cella della riga: il match whole-line assolveva righe
        # aperte la cui prosa cita "risolto"/"monitor" (falso-terminale su D-57).
        cells = [c.strip() for c in re.split(r"(?<!\\)\|", ln) if c.strip()]
        status = cells[-1] if cells else ""
        if terminal.search(status):
            continue
        opens.append(ln)
        if "🔴" in ln:
            red += 1
    if not opens:
        ndebts = len(re.findall(r"^\s*\|\s*\*?\*?D-\d+", md, re.MULTILINE))
        s.add(OK, f"0 debiti aperti ({ndebts} registrati, tutti terminali)")
    else:
        s.add(BAD if red else DOT, f"{len(opens)} debiti aperti ({red} 🔴)")
        for ln in opens[:6]:
            m = re.search(r"\bD-\d+\b", ln)
            s.add(BAD if "🔴" in ln else DOT, (m.group(0) if m else "D-?") + " — aperto")
    return s


def sec_decisions():
    s = Section("DECISIONI IN ATTESA DI TE")
    items = register_items(read(BACKLOG_MD))
    waits = [it for it in items if it["status"] == "WAIT-INPUT"]
    state = read(STATE_MD) or ""
    openq = []
    for h, body in split_sections(state):
        if "open question" in h.lower():
            openq = [l.strip() for l in strip_code_blocks(body).splitlines()
                     if re.match(r"\s*(?:\d+\.|[-*])\s+\S", l)]
    if not waits and not openq:
        s.add(OK, "nessuna decisione in attesa")
        return s
    for it in waits:
        inp = it["fields"].get("input-richiesto", "?")
        s.add(DOT, f"WAIT-INPUT · {it['title']} — {inp}")
    for ln in openq[:4]:
        s.add(DOT, f"open-Q · {re.sub(r'^\s*(?:\d+\.|[-*])\s+', '', ln)[:90]}")
    return s


# --- render -------------------------------------------------------------------------------
def render(sections, as_md):
    cur = current_session(read(STATE_MD) or "")
    title = f"HEURESYS — STATUS DASHBOARD{f' · S{cur}' if cur else ''}"
    out = []
    if as_md:
        out.append(f"# {title}\n")
        for sec in sections:
            out.append(f"## {sec.title}")
            for g, t in sec.rows:
                out.append(f"- `{g}` {t}")
            out.append("")
    else:
        bar = "═" * 84
        out.append(bar)
        out.append(f" {title}")
        out.append(" (infra tunnel/pgpass/DB-reachable già nel BOOT hook — qui lo stato derivato)")
        out.append(bar)
        for sec in sections:
            out.append("")
            out.append(sec.title)
            for g, t in sec.rows:
                out.append(f"  {g}  {t}")
        out.append("")
        out.append(bar)
    total_red = sum(sec.red for sec in sections)
    verdict = f"verdetto: {total_red} RED" if total_red else "verdetto: tutto verde"
    out.append(verdict if as_md else f" {verdict}   ·   `--md` per markdown, `--strict` per exit-code")
    print("\n".join(out))
    return total_red


def main():
    ap = argparse.ArgumentParser(description="Live re-derived project-status dashboard (S1007).")
    ap.add_argument("--no-db", action="store_true", help="skip psql (tunnel down)")
    ap.add_argument("--no-net", action="store_true", help="skip git-fetch / gh / curl (offline)")
    ap.add_argument("--md", action="store_true", help="emit markdown to stdout")
    ap.add_argument("--strict", action="store_true", help="exit 1 if any section is RED")
    args = ap.parse_args()

    sot_md = read(SOT_MD) or ""
    state_md = read(STATE_MD) or ""
    db_sec, live = sec_db(args.no_db)
    sections = [
        sec_context(),
        sec_git(args.no_net),
        sec_ci(args.no_net),
        sec_prod(args.no_net),
        sec_scheduled_jobs(args.no_net),
        db_sec,
        sec_drift(args.no_db, live, sot_md, state_md),
        sec_backlog(args.no_db),
        sec_debts(),
        sec_decisions(),
    ]
    total_red = render(sections, args.md)
    return 1 if (args.strict and total_red) else 0


if __name__ == "__main__":
    sys.exit(main())
