#!/usr/bin/env python3
"""
build_index.py — Genera l'indice dei percorsi di heuresys-advanced.

Sorgente: il repo, via `git ls-files` (l'insieme tracciato è quello autorevole: esclude già
segreti, generati e dati gitignored). Fino al 2026-11-25 lo strumento leggeva anche tre cartelle
di Claude Desktop sul PC Windows, con percorsi assoluti: il lavoro è passato alla VM il
2026-10-22 e quelle cartelle non fanno parte del repo (riordino della documentazione, voce R3).

Output (in docs/kb/), con percorsi relativi alla radice del repo:
  - index_paths.yaml  (machine-readable)
  - INDEX_PATHS.md    (human-readable, raggruppato per categoria)
"""
import hashlib
import os
import subprocess
import sys
from datetime import datetime, timezone

REPO = subprocess.check_output(
    ["git", "-C", os.path.dirname(os.path.abspath(__file__)), "rev-parse", "--show-toplevel"],
    text=True).strip()
OUT_DIR = os.path.join(REPO, "docs", "kb")


def classify(rel):
    """rel = path relativo al repo (separatori '/'). Ritorna (category, status)."""
    r = rel.replace("\\", "/")
    rules = [
        ("docs/architecture/adr/", "ADR", "live"),
        # D-91 ① (S1096): docs/archive/ e' cronaca, non SoT (CLAUDE.md: «Historical records live in
        # docs/archive/ and are NOT SoT»). Senza questa riga cadeva su doc-canonical/live — misurati
        # 79 file d'archivio dichiarati vivi il 2026-09-09. Sta PRIMA di docs/, o non vale.
        ("docs/archive/", "doc-archive", "archive"),
        ("docs/", "doc-canonical", "live"),
        ("apps/api/src/modules/", "api-module", "live"),
        ("apps/api/test/", "test", "live"),
        ("apps/api/src/", "api-core", "live"),
        ("apps/web/tests/", "test", "live"),
        ("apps/web/", "web-source", "live"),
        ("apps/showcase/", "showcase-source", "live"),
        ("packages/shared/src/schemas/", "shared-schema", "live"),
        ("packages/", "shared-pkg", "live"),
        ("db/migrations/", "db-migration", "live"),
        ("db/seeds/", "db-seed", "live"),
        ("db/scripts/", "db-script", "live"),
        ("db/", "db-other", "live"),
        (".github/", "ci", "live"),
        ("cowork_code_exchange/", "cowork-exchange", "archive"),
        ("cowork_reserved/", "cowork-reserved", "archive"),
        ("qa_artifacts/", "qa-artifact", "archive"),
        ("sessioni/", "session", "archive"),
        ("ux-design/", "ux-design-archive", "archive"),
        (".handoff/", "handoff-state", "live"),
        ("tests/", "test", "live"),
        (".claude/", "claude-config", "live"),
    ]
    for prefix, cat, st in rules:
        if r.startswith(prefix):
            # Only real .sql files are migrations: .gitkeep & co. must not inflate the
            # db-migration count vs SOT_STATE §0 (S1014 fix — perpetual +1 drift).
            if cat == "db-migration" and not r.endswith(".sql"):
                return "db-other", st
            return cat, st
    # root-level files
    if r.endswith(".md"):
        return "doc-canonical", "live"
    return "config", "live"


def sha256(path):
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return ""


def git_ls_files():
    out = subprocess.run(["git", "-C", REPO, "ls-files"],
                         capture_output=True, text=True, check=True)
    return [l for l in out.stdout.splitlines() if l.strip()]


def selftest():
    """A esiti opposti: una regola che non sa dire «archivio» e una che non sa dire «vivo» sono
    entrambe rotte, e un solo caso non le distingue."""
    attese = [
        ("docs/archive/HANDOFF.md", ("doc-archive", "archive")),
        ("docs/archive/sottocartella/x.md", ("doc-archive", "archive")),
        ("docs/kb/SOT_STATE.md", ("doc-canonical", "live")),
        ("docs/architecture/adr/0001_x.md", ("ADR", "live")),
        ("docs/archivedX.md", ("doc-canonical", "live")),   # il prefisso e' docs/archive/, non docs/archive
    ]
    rossi = 0
    for rel, atteso in attese:
        got = classify(rel)
        ok = got == atteso
        rossi += 0 if ok else 1
        print(f"  [{'ok' if ok else 'FAIL'}] {rel} -> {got}")
    print(f"  autoprova: {len(attese) - rossi}/{len(attese)}")
    return 1 if rossi else 0


def main():
    if "--selftest" in sys.argv:
        return selftest()
    entries = []  # (abspath, root, rel, category, status, provenance)

    for rel in git_ls_files():
        cat, st = classify(rel)
        entries.append((rel, "repo", rel, cat, st, "git-tracked"))

    # ordina per category poi path
    entries.sort(key=lambda e: (e[3], e[2]))

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # --- index_paths.yaml ---
    cat_counts = {}
    status_counts = {}
    for _, _, _, cat, st, _ in entries:
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        status_counts[st] = status_counts.get(st, 0) + 1

    yml = []
    yml.append("# index_paths.yaml — indice percorsi dominio heuresys-advanced (CLI-owned SoT)")
    yml.append(f"# generato: {ts} da docs/kb/tools/build_index.py")
    yml.append("# tutti i file tracciati dal repo; percorsi relativi alla radice")
    yml.append("meta:")
    yml.append(f"  generated_at: \"{ts}\"")
    yml.append(f"  total_files: {len(entries)}")
    yml.append("  roots:")
    yml.append("    repo: '.'")
    yml.append("  category_counts:")
    for k in sorted(cat_counts):
        yml.append(f"    {k}: {cat_counts[k]}")
    yml.append("  status_counts:")
    for k in sorted(status_counts):
        yml.append(f"    {k}: {status_counts[k]}")
    yml.append("files:")
    for abspath, root, rel, cat, st, prov in entries:
        # single-quoted YAML scalars: backslashes are literal, only ' needs doubling
        p = abspath.replace("'", "''")
        r = rel.replace("'", "''")
        yml.append(f"  - path: '{p}'")
        yml.append(f"    root: {root}")
        yml.append(f"    rel: '{r}'")
        yml.append(f"    category: {cat}")
        yml.append(f"    status: {st}")
        yml.append(f"    provenance: {prov}")
    with open(os.path.join(OUT_DIR, "index_paths.yaml"), "w", encoding="utf-8") as f:
        f.write("\n".join(yml) + "\n")

    # --- INDEX_PATHS.md ---
    md = []
    md.append("# INDEX_PATHS — Indice percorsi dominio heuresys-advanced")
    md.append("")
    md.append(f"**Generato**: {ts} · **Tool**: `docs/kb/tools/build_index.py` · **Totale file dominio**: **{len(entries)}**")
    md.append("")
    md.append("> Generato: tutti i file tracciati dal repo (`git ls-files`), con percorsi relativi alla "
              "radice. Gemello machine-readable: `index_paths.yaml`. La mappa per argomento è il wiki, "
              "`docs/wiki/index.md`.")
    md.append("")
    md.append("## Conteggi per categoria")
    md.append("")
    md.append("| Categoria | File |")
    md.append("|---|---|")
    for k in sorted(cat_counts):
        md.append(f"| {k} | {cat_counts[k]} |")
    md.append(f"| **TOTALE** | **{len(entries)}** |")
    md.append("")
    md.append("## Conteggi per status")
    md.append("")
    md.append("| Status | File |")
    md.append("|---|---|")
    for k in sorted(status_counts):
        md.append(f"| {k} | {status_counts[k]} |")
    md.append("")
    md.append("## File per categoria")
    md.append("")
    cur = None
    for abspath, root, rel, cat, st, prov in entries:
        if cat != cur:
            cur = cat
            md.append(f"\n### {cat}\n")
        md.append(f"- `{abspath}` · *{st}* · {prov}")
    md.append("")
    md.append("## Esclusioni")
    md.append("")
    md.append("> Esclusioni gestite da `.gitignore` (node_modules, .next, dist, *.tsbuildinfo, "
              ".env, .secrets, *.pem, qa_artifacts/runs/, docs/source_bundle/brownfield/extracted/, "
              "docs/brownfield/_inspection_artifacts/ — PII legacy mai indicizzata/letta).")
    with open(os.path.join(OUT_DIR, "INDEX_PATHS.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")

    print(f"OK: {len(entries)} file indicizzati")
    print("categorie:", dict(sorted(cat_counts.items())))
    print("status:", dict(sorted(status_counts.items())))


if __name__ == "__main__":
    sys.exit(main())
