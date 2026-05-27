#!/usr/bin/env python3
"""
build_index.py — Genera l'indice dei percorsi dominio heuresys-advanced.

Sorgenti (4 root):
  1. D:\\heuresys-advanced          -> via `git ls-files` (set autorevole tracked, esclude
                                        gia' secrets/generated/PII gitignored)
  2. C:\\Users\\enzospenuso\\Claude Desktop\\heuresys-advanced
  3. C:\\Users\\enzospenuso\\Claude Desktop\\scripts   (solo file heuresys/infra-VM)
  4. C:\\Users\\enzospenuso\\Claude Desktop\\outputs   (dominio-archivio, escl. landing html)

Output (in docs/kb/):
  - index_paths.yaml  (machine-readable; manifest sorgente per Plan 2)
  - INDEX_PATHS.md    (human-readable, raggruppato per categoria)

"Tutti e solo i file dominio, senza esclusioni": le esclusioni applicate sono SOLO
generated/secrets/PII (repo, via gitignore) e file palesemente non-dominio nelle aree
condivise Claude Desktop (converter generici, nose, diag SMB/mac, landing personale).
Ogni esclusione e' elencata in fondo a INDEX_PATHS.md.
"""
import hashlib
import os
import subprocess
import sys
from datetime import datetime, timezone

REPO = r"D:\heuresys-advanced"
CD = r"C:\Users\enzospenuso\Claude Desktop"
OUT_DIR = os.path.join(REPO, "docs", "kb")

# --- Claude Desktop: file dominio inclusi (path relativi a CD) ---
CD_DOMAIN = [
    # workspace Cowork del progetto
    r"heuresys-advanced\sessioni\session_2026-05-26_s937_housekeeping\HANDOVER_CLI.md",
    # scripts heuresys / infra-VM (gli altri sono converter generici / nose / diag -> esclusi)
    r"scripts\deploy-bootstrap-remote.ps1",
    r"scripts\find-oci-cli.ps1",
    r"scripts\s937-ck1-load-ssh-key.ps1",
    r"scripts\session-bootstrap.ps1",
    r"scripts\session-bootstrap.sh",
    r"scripts\test-oci-ssh.bat",
    # outputs: archivio cowork_code_exchange Goal 001/002 + baselines + depot
    r"outputs\baselines\001-db-state-20260518_1710.txt",
    r"outputs\baselines\001-source-shas-20260518_1710.txt",
    r"outputs\baselines\B1_pnpm_test_20260518_173829.log",
    r"outputs\cowork-user-preferences-v4.md",
    r"outputs\depot\forensic-audit-claude-ecosystem_2026-04-22.md",
    r"outputs\depot\scheda-tecnica-v1.1-2026-04-22.md",
    r"outputs\depot\SESSION_REPORT_S2-unification_2026-04-20.md",
    r"outputs\depot\SESSION_REPORT_verifica-pc-windows_2026-04-20.md",
    r"outputs\depot\staging-P0-2026-04-22\CLAUDE.md",
    r"outputs\depot\staging-P0-2026-04-22\feedback_archive_pre_2026-04-22.md",
    r"outputs\depot\staging-P0-2026-04-22\feedback_original_backup_snapshot.md",
    r"outputs\depot\staging-P0-2026-04-22\feedback_self_improvement_system_slim.md",
    r"outputs\depot\staging-P0-2026-04-22\MEMORY-original.md",
    r"outputs\depot\staging-P0-2026-04-22\MEMORY.md",
    r"outputs\depot\staging-P0-2026-04-22\runtime-snapshot-2026-04-22.md",
    r"outputs\depot\staging-P0-2026-04-22\SR_017_history_2026-04-21.md",
    r"outputs\depot\user_preferences_cowork_2026-04-20.md",
    r"outputs\depot\verifica-pc-windows_2026-04-20.md",
    r"outputs\depot\_apply_fixes_20260420_164125.txt",
    r"outputs\depot\_pending_check_20260420_162800.txt",
    r"outputs\GOAL_B_REPORT_2026-05-18.md",
    r"outputs\HANDOVER_CLI_2026-05-26_post_S937.md",
    r"outputs\MIGRATION_STATUS_2026-05-18.md",
    r"outputs\patch-claude-settings.ps1",
    r"outputs\patch-claude-settings.sh",
    r"outputs\README.md",
    r"outputs\_00_DISCOVERY_002_json-extract-lineage-fullscale.md",
    r"outputs\_00_SESSION_HANDOFF_2026-05-18.md",
    r"outputs\_00_STATE_001.md",
    r"outputs\_00_STATE_002.md",
    r"outputs\_01_PROMPT_001_audit_upsert_refactor.md",
    r"outputs\_01_PROMPT_002_json-extract-lineage-fullscale.md",
    r"outputs\_02b_APPROVAL_001.md",
    r"outputs\_02b_APPROVAL_001_v5.md",
    r"outputs\_02_PLAN_001_audit_upsert_refactor.md",
    r"outputs\_02_PLAN_001_v3-bis.md",
    r"outputs\_02_PLAN_001_v4.md",
    r"outputs\_03_EXEC_001a_audit_upsert_refactor.md",
    r"outputs\_03_EXEC_001_audit_upsert_refactor.md",
    r"outputs\_04_REPORT_001a_audit_upsert_refactor.md",
    r"outputs\_04_REPORT_001a_interim.md",
    r"outputs\_05_REVIEW_001a_audit_upsert_refactor.md",
    r"outputs\_SKILL_UPDATE_MEMO.md",
]

# Esclusioni esplicite nelle aree condivise (NON dominio) — elencate nel report
CD_EXCLUDED = [
    (r"scripts\convert_*.py / nose_convert_all.py", "converter PPTX->MD generici / progetto NOSE"),
    (r"scripts\diag-mac-mount.ps1, fix-smb-access.ps1", "diagnostica SMB/mac infra generica"),
    (r"scripts\Monitor-*.ps1, Start-ResourceMonitor.ps1, MONITOR-CONFIG.md, monitor-logs\\audit.log",
     "monitoraggio risorse globale (non heuresys-specific)"),
    (r"scripts\_apply_fixes.ps1, _pending_check.ps1", "utility generiche cross-project"),
    (r"outputs\depot\enzospenuso-landing.html", "landing page personale, non dominio"),
]


def classify(rel):
    """rel = path relativo al repo (separatori '/'). Ritorna (category, status)."""
    r = rel.replace("\\", "/")
    rules = [
        ("docs/architecture/adr/", "ADR", "live"),
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


def main():
    entries = []  # (abspath, root, rel, category, status, provenance)

    # 1. repo
    for rel in git_ls_files():
        cat, st = classify(rel)
        abspath = os.path.join(REPO, rel.replace("/", os.sep))
        entries.append((abspath, "repo", rel, cat, st, "git-tracked"))

    # 2-4. Claude Desktop dominio
    for rel in CD_DOMAIN:
        abspath = os.path.join(CD, rel)
        relslash = rel.replace("\\", "/")
        if relslash.startswith("scripts/"):
            cat, st = "script", "external-archive"
        elif "depot/staging-P0" in relslash:
            cat, st = "cowork-snapshot", "external-archive"
        elif relslash.startswith("outputs/_0") or "PROMPT" in rel or "PLAN" in rel \
                or "REPORT" in rel or "REVIEW" in rel or "EXEC" in rel or "APPROVAL" in rel \
                or "STATE" in rel or "DISCOVERY" in rel or "SESSION_HANDOFF" in rel:
            cat, st = "cowork-exchange", "external-archive"
        elif "baselines" in relslash:
            cat, st = "qa-artifact", "external-archive"
        else:
            cat, st = "cowork-archive", "external-archive"
        prov = "claude-desktop:" + relslash.split("/")[0]
        entries.append((abspath, "claude-desktop", relslash, cat, st, prov))

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
    yml.append("# 'tutti e solo i file dominio, senza esclusioni' (escl. solo generated/secrets/PII + non-dominio Claude Desktop)")
    yml.append("meta:")
    yml.append(f"  generated_at: \"{ts}\"")
    yml.append(f"  total_files: {len(entries)}")
    yml.append("  roots:")
    yml.append(f"    repo: \"{REPO}\"")
    yml.append(f"    claude_desktop: \"{CD}\"")
    yml.append("  category_counts:")
    for k in sorted(cat_counts):
        yml.append(f"    {k}: {cat_counts[k]}")
    yml.append("  status_counts:")
    for k in sorted(status_counts):
        yml.append(f"    {k}: {status_counts[k]}")
    yml.append("files:")
    for abspath, root, rel, cat, st, prov in entries:
        p = abspath.replace("\\", "\\\\")
        yml.append(f"  - path: \"{p}\"")
        yml.append(f"    root: {root}")
        yml.append(f"    rel: \"{rel}\"")
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
    md.append("> SoT CLI-owned. \"Tutti e solo i file dominio, senza esclusioni\". Esclusi solo: "
              "generated/secrets/PII (repo, via .gitignore) e file non-dominio nelle aree condivise "
              "Claude Desktop (vedi appendice). Gemello machine-readable: `index_paths.yaml`.")
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
    md.append("## Appendice — esclusioni esplicite (aree condivise Claude Desktop, NON dominio)")
    md.append("")
    md.append("| Pattern | Motivo |")
    md.append("|---|---|")
    for pat, reason in CD_EXCLUDED:
        md.append(f"| `{pat}` | {reason} |")
    md.append("")
    md.append("> Repo: esclusioni gestite da `.gitignore` (node_modules, .next, dist, *.tsbuildinfo, "
              ".env, .secrets, *.pem, qa_artifacts/runs/, docs/source_bundle/brownfield/extracted/, "
              "docs/brownfield/_inspection_artifacts/ — PII legacy mai indicizzata/letta).")
    with open(os.path.join(OUT_DIR, "INDEX_PATHS.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")

    print(f"OK: {len(entries)} file indicizzati")
    print("categorie:", dict(sorted(cat_counts.items())))
    print("status:", dict(sorted(status_counts.items())))


if __name__ == "__main__":
    sys.exit(main())
