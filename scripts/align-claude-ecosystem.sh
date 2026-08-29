#!/usr/bin/env bash
#
# scripts/align-claude-ecosystem.sh — clone the Windows Claude ecosystem (SoT) onto
# mac-local / linux-pc / oracle-vm-default, keeping remotes idempotent clones of the
# Windows user-level catalog (~/.claude portable subset + claude-mem settings).
#
# Scope (the "portable catalog"):
#   CLAUDE.md, skills/, commands/, statusline-command.sh   → copied verbatim (CRLF-stripped)
#   settings.json                                          → per-OS jq transform (see transform_settings)
#   scripts/session-bootstrap.sh                           → bash bootstrap (replaces the 3 PS hooks)
#   ~/.claude-mem/settings.json                            → path keys rewritten per host; DB NEVER copied
# Never cloned: .credentials.json, ~/.claude.json, projects/, plans/, tasks/, caches,
#   session state, plugins/* (plugins are REINSTALLED natively on each remote).
#
# Usage:
#   align-claude-ecosystem.sh <mac|vm|linuxpc|all> [--dry-run] [--verify] [--delta]
#                             [--resilient] [--skip-plugins] [--skip-smoke]
#                             [--skip-sdks] [--sdks-only] [--rollback <stamp>]
#
# Modes:
#   (default)   align: backup remote ~/.claude (first run: full mv; later: tgz of managed
#               paths), wipe managed paths, push payload, reinstall plugins, claude-mem
#               settings, smoke test (claude -p), verify. Smoke failure → auto-rollback.
#   --dry-run   build staging + show manifest + per-host settings diff; NO remote writes.
#   --verify    no writes; checksum + semantic comparison; drift report under
#               deploy/reports/claude-align/.
#   --delta     skip a host if no payload source changed since .session-align.marker
#               and the host has already been aligned (sentinel present).
#   --rollback <stamp>  restore ~/.claude from ~/.claude.bak-<stamp> (or .tgz).
#
# In `all`, linuxpc is ALWAYS resilient (LAN box may be off — must not fail the run).
# Run from the local Windows PC (Git Bash). Doctrine: deploy/README.md §Claude ecosystem.
set -euo pipefail
# NOTE: MSYS_NO_PATHCONV is set per-ssh-call (rssh) and NOT globally: a global export
# would break native Windows binaries (jq) that rely on MSYS path conversion.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$HOME/.claude"
BOOTSTRAP_SRC="$HOME/Claude Desktop/scripts/session-bootstrap.sh"
CLAUDE_MEM_SRC="$HOME/.claude-mem/settings.json"
REPORTS_DIR="$ROOT/deploy/reports/claude-align"
MARKER="$ROOT/.session-align.marker"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

# --- the portable catalog -----------------------------------------------------------
# reference/ (2026-08-01): il CLAUDE.md rifattorizzato per Opus 5 istruisce a leggere
# ~/.claude/reference/*.md prima di lavorare su PowerShell o di connettersi a una macchina
# remota. Senza questa voce i cloni riceverebbero un CLAUDE.md che punta a file assenti.
# agents/ (2026-08-26, S1081-dream): le definizioni degli agenti della skill project-dream
# (dream-inventory/latent/architecture/market/docs/verifier) vivono in ~/.claude/agents/ sul
# SoT Windows: una skill propagata senza i suoi agenti invocherebbe tipi inesistenti sui
# cloni. La vecchia lettura di agents/ come "lignaggio divergente mac/VM" resta vera per
# hooks/ e output-styles/; per agents/ il clone puro e' quello IDENTICO al Windows.
PORTABLE_PATHS=( CLAUDE.md skills commands reference agents statusline-command.sh )
# wiped on the remote before extract (what makes the clone PURE — the divergent
# mac/VM lineage dirs hooks/ output-styles/ are removed, archived in backup; agents/ is
# wiped and re-extracted from the Windows payload since 2026-08-26):
MANAGED_REMOTE_PATHS=( CLAUDE.md skills commands reference rules agents hooks output-styles statusline-command.sh settings.json scripts )
# restored from the remote's own backup after a first-run full move:
PRESERVE_FROM_REMOTE=( .credentials.json projects settings.local.json history.jsonl todos plans tasks )
# staging blocklist — none of these may ever appear in the payload:
BLOCKLIST_RE='\.credentials\.json|claude-mem\.db|history\.jsonl|stats-cache|installed_plugins\.json|known_marketplaces\.json|\.bak'

# S1015 parity fix: buildwithclaude / claude-code-plugins-plus-skills / n-skills removed —
# dismessi sul SoT Windows (nessun marketplace clone, nessuna enabledPlugins entry); le voci
# stale qui re-installavano su ogni align plugin che Windows non ha più (drift §2/§3 linux-pc).
MARKETPLACES=(
  "claude-plugins-official=anthropics/claude-plugins-official"
  "gmickel-claude-marketplace=gmickel/gmickel-claude-marketplace"
  "thedotmack=thedotmack/claude-mem"
)
# INSTALLATO != ABILITATO. Questa lista governa l'INSTALLAZIONE sui cloni; quali plugin
# siano poi ATTIVI lo decide `enabledPlugins` dentro settings.json, che questo stesso script
# propaga (MANAGED_REMOTE_PATHS + transform_settings). Dal S1030 sei di questi sono `false`
# sul SoT Windows — plugin-dev, hookify, agent-sdk-dev, skill-creator, claude-code-setup,
# ralph-loop (cluster Z-029: authoring/meta, servono a costruire plugin e skill, non a
# lavorare su heuresys-advanced; ~25 fra skill, agent e comandi sempre nel prompt). Restano
# in questa lista di proposito: cosi' un `/plugin` li riaccende all'istante ovunque, invece
# di richiedere un'installazione a freddo sull'host in cui servono.
PLUGINS_TO_INSTALL=(
  commit-commands@claude-plugins-official feature-dev@claude-plugins-official
  pr-review-toolkit@claude-plugins-official code-simplifier@claude-plugins-official
  plugin-dev@claude-plugins-official hookify@claude-plugins-official
  superpowers@claude-plugins-official agent-sdk-dev@claude-plugins-official
  claude-md-management@claude-plugins-official skill-creator@claude-plugins-official
  claude-code-setup@claude-plugins-official chrome-devtools-mcp@claude-plugins-official
  frontend-design@claude-plugins-official
  claude-mem@thedotmack
)

# SDK parity (opzione C, 2026-06-12): the Anthropic SDKs are part of the ecosystem on
# every machine, equalized at runtime to the versions INSTALLED on the Windows SoT
# (npm -g / pip). claude-code-sdk is the deprecated predecessor of claude-agent-sdk
# and gets pruned wherever found.
NPM_SDKS=( "@anthropic-ai/claude-agent-sdk" "@anthropic-ai/sdk" )
PIP_SDKS=( anthropic claude-agent-sdk )
PIP_PRUNE=( claude-code-sdk )

# --- host configs ---------------------------------------------------------------------
mac_cfg()     { HOST=mac-local;         RHOME=/Users/enzo;  NVMUSE=default; FOREIGN_RE='C:\\\\Users|/home/(enzo|ubuntu)'; }
vm_cfg()      { HOST=oracle-vm-default; RHOME=/home/ubuntu; NVMUSE=22;      FOREIGN_RE='C:\\\\Users|/Users/|/home/enzo'; }
linuxpc_cfg() { HOST=linux-pc;          RHOME=/home/enzo;   NVMUSE=22;      FOREIGN_RE='C:\\\\Users|/Users/|/home/ubuntu'; }
rssh()        { MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes "$@"; }
reachable()   { rssh -o ConnectTimeout=8 "$1" 'exit 0' 2>/dev/null; }
# /usr/local/bin in PATH: on the mac the non-interactive SSH PATH would otherwise resolve
# pip3 to the CommandLineTools Python 3.9 (too old for claude-agent-sdk) instead of the
# /usr/local/bin python3 3.14; harmless on the Linux hosts.
nvm_pre()     { printf 'export NVM_DIR="$HOME/.nvm"; set +e; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; nvm use %s >/dev/null 2>&1; set -e; export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"; ' "$NVMUSE"; }

log()  { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31m[FATAL]\033[0m %s\n' "$*" >&2; exit 1; }

# --- args -----------------------------------------------------------------------------
TARGETS_ARG=""; DRY=0; VERIFY_ONLY=0; DELTA=0; RESILIENT=0; SKIP_PLUGINS=0; SKIP_SMOKE=0; SKIP_SDKS=0; SDKS_ONLY=0; ROLLBACK_STAMP=""
expect_stamp=0
for a in "$@"; do
  if [ "$expect_stamp" = 1 ]; then ROLLBACK_STAMP="$a"; expect_stamp=0; continue; fi
  case "$a" in
    mac|vm|linuxpc|all) TARGETS_ARG="$a" ;;
    --dry-run)      DRY=1 ;;
    --verify)       VERIFY_ONLY=1 ;;
    --delta)        DELTA=1 ;;
    --resilient)    RESILIENT=1 ;;
    --skip-plugins) SKIP_PLUGINS=1 ;;
    --skip-smoke)   SKIP_SMOKE=1 ;;
    --skip-sdks)    SKIP_SDKS=1 ;;
    --sdks-only)    SDKS_ONLY=1 ;;
    --rollback)     expect_stamp=1 ;;
    *) die "unknown arg: $a" ;;
  esac
done
[ -n "$TARGETS_ARG" ] || die "usage: align-claude-ecosystem.sh <mac|vm|linuxpc|all> [--dry-run|--verify|--delta|--resilient|--skip-plugins|--skip-smoke|--rollback <stamp>]"
[ "$expect_stamp" = 0 ] || die "--rollback requires a <stamp> argument"

# --- local preflight --------------------------------------------------------------------
preflight_local() {
  command -v jq >/dev/null        || die "jq missing locally"
  command -v sha256sum >/dev/null || die "sha256sum missing locally"
  [ -f "$SRC/CLAUDE.md" ]         || die "$SRC/CLAUDE.md missing"
  [ -f "$SRC/settings.json" ]     || die "$SRC/settings.json missing"
  [ -f "$SRC/statusline-command.sh" ] || die "statusline-command.sh missing"
  [ -d "$SRC/skills" ]            || die "$SRC/skills missing"
  [ -d "$SRC/commands" ]          || die "$SRC/commands missing"
  [ -d "$SRC/reference" ]         || die "$SRC/reference missing (atteso dal CLAUDE.md post-Opus5)"
  [ -f "$BOOTSTRAP_SRC" ]         || die "session-bootstrap.sh missing at: $BOOTSTRAP_SRC"
  [ -f "$CLAUDE_MEM_SRC" ]        || die "claude-mem settings missing at: $CLAUDE_MEM_SRC"
  resolve_sdk_specs
}

# Resolve the SDK versions installed on the SoT — remotes are equalized to THESE.
NPM_SPECS=""; PIP_SPECS=""
resolve_sdk_specs() {
  local p v
  for p in "${NPM_SDKS[@]}"; do
    v="$(npm ls -g --depth=0 --json 2>/dev/null | jq -r --arg p "$p" '.dependencies[$p].version // empty')"
    if [ -n "$v" ]; then NPM_SPECS="$NPM_SPECS $p@$v"; else warn "SoT npm SDK not installed: $p — skipped"; fi
  done
  for p in "${PIP_SDKS[@]}"; do
    v="$(pip show "$p" 2>/dev/null | awk '/^Version:/{print $2}')"
    if [ -n "$v" ]; then PIP_SPECS="$PIP_SPECS $p==$v"; else warn "SoT pip SDK not installed: $p — skipped"; fi
  done
  [ -n "$NPM_SPECS$PIP_SPECS" ] && echo "[sdk] SoT specs:$NPM_SPECS$PIP_SPECS"
}

# Equalize the remote's global SDKs to the SoT versions; prune deprecated packages.
# pip fallback --break-system-packages covers PEP 668 (Ubuntu 24.04, Homebrew python).
sdk_stage() {
  if [ -z "$NPM_SPECS$PIP_SPECS" ]; then warn "[sdk] no SoT specs resolved — stage skipped"; return 0; fi
  rssh "$HOST" "$(nvm_pre)"'
    for s in '"$NPM_SPECS"'; do
      npm i -g "$s" >/dev/null 2>&1 && echo "[sdk][npm] $s OK" || echo "[sdk][npm][WARN] $s FAILED"
    done
    for s in '"$PIP_SPECS"'; do
      if pip3 install --user --upgrade --quiet "$s" >/dev/null 2>&1 \
         || pip3 install --user --break-system-packages --upgrade --quiet "$s" >/dev/null 2>&1; then
        echo "[sdk][pip] $s OK"
      else echo "[sdk][pip][WARN] $s FAILED"; fi
    done
    for p in '"${PIP_PRUNE[*]}"'; do
      if pip3 show "$p" >/dev/null 2>&1; then
        if pip3 uninstall -y "$p" >/dev/null 2>&1 || pip3 uninstall -y --break-system-packages "$p" >/dev/null 2>&1; then
          echo "[sdk][pip] pruned deprecated: $p"
        else echo "[sdk][pip][WARN] prune failed: $p"; fi
      fi
    done'
}

# --- staging ----------------------------------------------------------------------------
# STAGE/payload/...                 -> extracted into remote ~/.claude
# STAGE/claude-mem-settings.json    -> pushed to remote ~/.claude-mem/settings.json
# STAGE/MANIFEST.sha256             -> checksums of payload (relative paths)
STAGE=""
cleanup() { [ -n "$STAGE" ] && { rm -rf "$STAGE"; STAGE=""; }; return 0; }
trap cleanup EXIT

# MSYS path conversion mangles POSIX-looking values (args AND env vars) passed to the
# native jq.exe — so the transforms run jq with MSYS_NO_PATHCONV=1 and a cygpath'd input file.
transform_settings() {  # $1 = RHOME
  MSYS_NO_PATHCONV=1 jq --arg home "$1" '
    .env = ((.env // {})
            | del(.CLAUDE_CODE_GIT_BASH_PATH)
            + {CLAUDE_AUTOCOMPACT_PCT_OVERRIDE:"65", BASH_DEFAULT_TIMEOUT_MS:"180000"})
    | .hooks.SessionStart = [{matcher:"startup|resume|clear", hooks:[
        {type:"command",
         command:("bash " + $home + "/.claude/scripts/session-bootstrap.sh \"$CLAUDE_PROJECT_DIR\"")}]}]
    | .statusLine.command = ("bash " + $home + "/.claude/statusline-command.sh")
    | .additionalDirectories = []
  ' "$(cygpath -m "$SRC/settings.json")"
}

transform_claude_mem_settings() {  # $1 = RHOME
  MSYS_NO_PATHCONV=1 jq --arg home "$1" '
    .CLAUDE_MEM_DATA_DIR = ($home + "/.claude-mem")
    | .CLAUDE_MEM_TRANSCRIPTS_CONFIG_PATH = ($home + "/.claude-mem/transcript-watch.json")
  ' "$(cygpath -m "$CLAUDE_MEM_SRC")"
}

build_stage() {  # $1 = RHOME — builds STAGE for one host
  STAGE="$(mktemp -d)"
  local P="$STAGE/payload"
  mkdir -p "$P/scripts"
  for item in "${PORTABLE_PATHS[@]}"; do cp -a "$SRC/$item" "$P/$item"; done
  cp -a "$BOOTSTRAP_SRC" "$P/scripts/session-bootstrap.sh"
  # drop backup junk; strip CRLF from text files (S979 lesson)
  find "$P" \( -name '*.bak' -o -name '*.bak.*' -o -name '*.bak-*' \) -exec rm -rf {} + 2>/dev/null || true
  find "$P" -type f \( -name '*.sh' -o -name '*.md' \) -exec sed -i 's/\r$//' {} +
  chmod +x "$P/statusline-command.sh" "$P/scripts/session-bootstrap.sh"
  transform_settings "$1" > "$P/settings.json"
  jq empty "$P/settings.json" || die "transformed settings.json is not valid JSON"
  transform_claude_mem_settings "$1" > "$STAGE/claude-mem-settings.json"
  jq empty "$STAGE/claude-mem-settings.json" || die "transformed claude-mem settings is not valid JSON"
  # assertions: no CR left in shell files, no blocklisted names in the payload
  if grep -rl $'\r' "$P" --include='*.sh' >/dev/null 2>&1; then die "CR characters survived staging"; fi
  if find "$P" | grep -E "$BLOCKLIST_RE" ; then die "blocklisted file leaked into staging"; fi
  ( cd "$P" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum ) > "$STAGE/MANIFEST.sha256"
}

# --- remote operations --------------------------------------------------------------------
# Auth invariant: the remote's own credentials/state files must still be PRESENT and
# non-empty after the align. Byte-stability is the WRONG check: the claude CLI rewrites
# ~/.claude.json on every invocation and refreshes the OAuth token in .credentials.json
# (observed live during the 16 plugin installs). We never stage credentials (BLOCKLIST
# assert), and the smoke test is the functional auth proof.
auth_presence() {
  rssh "$HOST" '
    f="$HOME/.claude/.credentials.json"
    [ -s "$f" ] && echo credentials=present || echo credentials=MISSING
    [ -s "$HOME/.claude.json" ] && echo claude.json=present || echo claude.json=MISSING'
}

# --------------------------------------------------------------------------------------
# #236 F4 (S1084) — LA FINESTRA IN CUI L'HOST E' A META', E CHI SE NE ACCORGE.
#
# Questo script NON e' armabile su systemd come il clone (#236 F2), e la ragione e'
# strutturale, non pigrizia: l'orchestratore gira QUI e il payload — il catalogo
# `~/.claude` di Windows — E' la fonte di verita'. Un timer sul remoto non avrebbe da
# dove prendere cio' che deve installare. Si dichiara invece di fingere.
#
# Cio' che si puo' togliere e' il DANNO SILENZIOSO. `backup_remote` fa backup **e wipe**
# dei managed paths; poi vengono push del payload, plugin, claude-mem, SDK. In mezzo c'e'
# una finestra di minuti in cui l'host ha un `~/.claude` incompleto. Lo script sa gia'
# ripararsi quando un PASSO fallisce (`rollback_host` su push fallito, su file di auth
# sparito, su smoke rosso) — ma non puo' ripararsi se a morire e' la SESSIONE che lo
# esegue: un SIGHUP non lascia nessuno a chiamare il rollback.
#
# Percio' un marcatore: si scrive PRIMA del wipe e si toglie solo a corsa conclusa (o
# dopo un rollback riuscito). Se resta li', quell'host e' stato lasciato a meta' — e
# `scripts/verifica-cloni.sh` lo dichiara `INTERROTTO` invece di dire ALLINEATO leggendo
# una sentinella vecchia. Porta con se' il comando di rollback, perche' chi lo trova
# deve poter agire senza ricostruire lo stamp a memoria.
INCORSO_FILE='$HOME/.claude/.ecosystem-align.INCORSO'
segna_incorso() {
  rssh "$HOST" "mkdir -p \"\$HOME/.claude\" 2>/dev/null; printf '%s\n' \
    'stamp=$STAMP' 'host_sorgente=$(hostname)' 'iniziato=$(date -u +%Y-%m-%dT%H:%M:%SZ)' \
    'rollback=bash scripts/align-claude-ecosystem.sh $1 --rollback $STAMP' \
    > \"$INCORSO_FILE\"" 2>/dev/null || true
}
togli_incorso() { rssh "$HOST" "rm -f \"$INCORSO_FILE\"" 2>/dev/null || true; }

backup_remote() {  # sets BACKUP_KIND=full|incr — runs the backup + wipe of managed paths
  local managed="${MANAGED_REMOTE_PATHS[*]}" preserve="${PRESERVE_FROM_REMOTE[*]}"
  if rssh "$HOST" '[ -f "$HOME/.claude/.ecosystem-align.json" ]'; then
    BACKUP_KIND=incr
    # Use an array (not a space-joined string) so that "tar ... ${to_tar[@]}" is
    # properly word-split in BOTH bash (Linux/VM) AND zsh (macOS login shell).
    # Unquoted $var word-splitting is disabled in zsh by default (SH_WORD_SPLIT off),
    # so "tar ... $existing" would pass the whole string as one argument on Mac.
    rssh "$HOST" "set -e; cd \"\$HOME/.claude\"
      to_tar=(); for p in $managed; do [ -e \"\$p\" ] && to_tar+=(\"\$p\"); done
      (( \${#to_tar[@]} )) && tar -czf \"\$HOME/.claude.bak-$STAMP.tgz\" \"\${to_tar[@]}\" || true
      rm -rf $managed"
  else
    BACKUP_KIND=full
    rssh "$HOST" "set -e
      [ -d \"\$HOME/.claude\" ] || mkdir -p \"\$HOME/.claude\"
      mv \"\$HOME/.claude\" \"\$HOME/.claude.bak-$STAMP\"
      mkdir -p \"\$HOME/.claude\"
      for p in $preserve; do
        [ -e \"\$HOME/.claude.bak-$STAMP/\$p\" ] && cp -a \"\$HOME/.claude.bak-$STAMP/\$p\" \"\$HOME/.claude/\$p\" || true
      done"
  fi
}

push_payload() {
  tar -C "$STAGE/payload" -czf - . | rssh "$HOST" '
    set -e; mkdir -p "$HOME/.claude" && tar xzf - -C "$HOME/.claude"
    chmod +x "$HOME/.claude/statusline-command.sh" "$HOME/.claude/scripts/session-bootstrap.sh"'
  # sentinel + manifest for traceability
  local msha; msha="$(sha256sum "$STAGE/MANIFEST.sha256" | cut -d' ' -f1)"
  rssh "$HOST" "cat > \"\$HOME/.claude/.ecosystem-align.manifest\"" < "$STAGE/MANIFEST.sha256"
  printf '{"stamp":"%s","sourceHost":"%s","backup":"%s","manifestSha":"%s"}\n' \
    "$STAMP" "$(hostname)" "$BACKUP_KIND" "$msha" \
    | rssh "$HOST" "cat > \"\$HOME/.claude/.ecosystem-align.json\""
}

reinstall_plugins() {
  local mp_pairs="${MARKETPLACES[*]}" plugins="${PLUGINS_TO_INSTALL[*]}"
  rssh "$HOST" "$(nvm_pre)"'
    command -v claude >/dev/null 2>&1 || { echo "[plugin][FATAL] claude CLI not in PATH"; exit 9; }
    MPLIST="$(claude plugin marketplace list 2>/dev/null || true)"
    for pair in '"$mp_pairs"'; do
      name="${pair%%=*}"; repo="${pair#*=}"
      # match by registered name OR source repo: the CLI derives the canonical name from
      # the marketplace manifest (e.g. flow-next for gmickel/gmickel-claude-marketplace)
      if printf "%s" "$MPLIST" | grep -qE "($name|$repo)"; then
        echo "[mp] $name already present"
      else
        out="$(claude plugin marketplace add "$repo" 2>&1)" && echo "[mp] $name added" \
          || echo "[mp][WARN] add $repo failed: $(printf "%s" "$out" | head -2 | tr "\n" " ")"
      fi
    done
    fails=0
    for p in '"$plugins"'; do
      out="$(claude plugin install "$p" 2>&1)" && { echo "[plugin] $p OK"; continue; }
      if printf "%s" "$out" | grep -qi "already"; then echo "[plugin] $p already installed"
      else echo "[plugin][WARN] $p failed: $(printf "%s" "$out" | head -2 | tr "\n" " ")"; fails=$((fails+1)); fi
    done
    echo "[plugin] install failures=$fails"' || {
      local rc=$?
      [ "$rc" = 9 ] && { warn "claude CLI missing on $HOST — plugin stage skipped"; return 1; }
      warn "plugin stage ended with rc=$rc on $HOST"; return 1; }
}

reapply_enabled_plugins() {
  # D-40: `claude plugin install` (reinstall step) re-enables EVERY plugin in the remote
  # settings.json, clobbering the Windows enabledPlugins (e.g. a deliberately-disabled
  # `claude-mem@thedotmack: false`). Re-apply the Windows enabledPlugins onto the remote —
  # Windows values WIN (right operand of jq `+`) — leaving extraKnownMarketplaces (CLI-managed)
  # untouched, so the disabled state survives EVERY align (durable, not a manual per-machine fix).
  local win_enabled
  win_enabled="$(MSYS_NO_PATHCONV=1 jq -c '.enabledPlugins // {}' "$(cygpath -m "$STAGE/payload/settings.json")")"
  [ -n "$win_enabled" ] && [ "$win_enabled" != "null" ] && [ "$win_enabled" != "{}" ] || return 0
  rssh "$HOST" "
    set -e
    f=\"\$HOME/.claude/settings.json\"; [ -f \"\$f\" ] || exit 0
    tmp=\"\$(mktemp)\"
    jq --argjson win '$win_enabled' '.enabledPlugins = ((.enabledPlugins // {}) + \$win)' \"\$f\" > \"\$tmp\" && mv \"\$tmp\" \"\$f\""
}

setup_claude_mem() {
  rssh "$HOST" "set -e; mkdir -p \"\$HOME/.claude-mem\"
    [ -f \"\$HOME/.claude-mem/settings.json\" ] && cp -a \"\$HOME/.claude-mem/settings.json\" \"\$HOME/.claude-mem/settings.json.bak-$STAMP\" || true
    cat > \"\$HOME/.claude-mem/settings.json\"" < "$STAGE/claude-mem-settings.json"
}

# Smoke = does a headless session START (settings parse, hooks run, auth works)?
# Tools are disabled (--tools "") so the session cannot act on the remote, and the
# assertion is on startup/auth, NOT on the exact reply text (non-deterministic: hook
# bootstrap output may legitimately steer the model's wording).
# Returns: 0 = OK | 2 = auth failure (401 — orthogonal to alignment, must NOT roll back:
# rolling back cannot fix auth and restoring stale OAuth credentials over rotated ones
# is precisely what bricks them) | 1 = startup failure (settings/hook breakage → roll back).
smoke_test() {
  local out rc=0
  # prompt via stdin: --tools is variadic and would swallow a positional prompt argument
  out="$(rssh "$HOST" "$(nvm_pre)"'cd "$HOME" && printf "Health check: reply briefly." | claude -p --tools "" 2>&1')" || rc=$?
  if printf '%s' "$out" | grep -qiE 'failed to authenticate|invalid authentication|401'; then
    warn "[smoke] AUTH failure on $HOST (claude login needed) — alignment itself is kept"
    return 2
  fi
  if [ "$rc" = 0 ] && [ -n "$out" ]; then
    echo "[smoke] OK — session started, auth valid (reply: $(printf '%s' "$out" | head -1 | cut -c1-60)...)"
    return 0
  fi
  warn "[smoke] FAILED on $HOST (rc=$rc) — last output lines:"
  printf '%s\n' "$out" | tail -5 >&2
  return 1
}

rollback_host() {  # $1 = kind, $2 = stamp
  local kind="$1" stamp="$2"; "${kind}_cfg"
  log "[$kind] ROLLBACK to $stamp"
  # Credentials are FORWARD-ONLY: the CLI rotates OAuth tokens, so the newest
  # .credentials.json (the active one) must survive the rollback — restoring a stale
  # copy from a backup permanently bricks auth (lesson: VM 401, 2026-06-12).
  rssh "$HOST" "set -e
    if [ -d \"\$HOME/.claude.bak-$stamp\" ]; then
      CRED_KEEP=\$(mktemp); cp -a \"\$HOME/.claude/.credentials.json\" \"\$CRED_KEEP\" 2>/dev/null || CRED_KEEP=''
      rm -rf \"\$HOME/.claude.rolledback\"
      mv \"\$HOME/.claude\" \"\$HOME/.claude.rolledback\"
      mv \"\$HOME/.claude.bak-$stamp\" \"\$HOME/.claude\"
      if [ -n \"\$CRED_KEEP\" ] && [ -s \"\$CRED_KEEP\" ]; then cp -a \"\$CRED_KEEP\" \"\$HOME/.claude/.credentials.json\"; rm -f \"\$CRED_KEEP\"; fi
      echo '[rollback] full restore done, newest credentials preserved (failed state kept in ~/.claude.rolledback)'
    elif [ -f \"\$HOME/.claude.bak-$stamp.tgz\" ]; then
      cd \"\$HOME/.claude\" && rm -rf ${MANAGED_REMOTE_PATHS[*]} && tar xzf \"\$HOME/.claude.bak-$stamp.tgz\"
      echo '[rollback] incremental restore done'
    else
      echo \"[rollback] no backup found for stamp $stamp\" >&2; exit 1
    fi
    [ -f \"\$HOME/.claude-mem/settings.json.bak-$stamp\" ] && cp -a \"\$HOME/.claude-mem/settings.json.bak-$stamp\" \"\$HOME/.claude-mem/settings.json\" || true"
  # #236 F4 — dopo un rollback riuscito l'host NON e' piu' a meta': ha uno stato
  # coerente, quello di prima. Lasciare il marcatore lo farebbe dichiarare INTERROTTO
  # per sempre, cioe' un allarme su un host gia' riparato — lo stesso difetto che R2 di
  # S1084 ha tolto dal rendiconto delle chiusure.
  # ⚠ Il ripristino `full` rimette al suo posto un `~/.claude` che il marcatore non l'ha
  # mai avuto, ma quello `incr` no: li' il file resterebbe. Si toglie in entrambi i casi.
  togli_incorso
}

# #60 G1 (S1028): retention N-ultimi sui report locali (gitignored) — la dir
# accumulava senza policy (108 file al momento del fix). Tiene i 20 più recenti.
prune_reports() {
  local keep=20
  [ -d "$REPORTS_DIR" ] || return 0
  ls -1t "$REPORTS_DIR" 2>/dev/null | tail -n +$((keep + 1)) | while IFS= read -r f; do
    rm -f "$REPORTS_DIR/$f"
  done
}

# --- verify ---------------------------------------------------------------------------------
verify_host() {  # $1 = kind ; returns 0 if clean — writes drift report
  local kind="$1"; "${kind}_cfg"
  build_stage "$RHOME"
  mkdir -p "$REPORTS_DIR"
  prune_reports
  local report="$REPORTS_DIR/drift-$kind-$STAMP.md" issues=0 mem_drift=0
  {
    echo "# Drift report — $kind ($HOST) — $STAMP"
    echo
    echo '## 1. Payload checksums (sha256 -c against Windows staging)'
    echo '```'
  } > "$report"
  # settings.json is excluded from the byte comparison: the remote CLI legitimately
  # appends marketplace registrations to it (semantic comparison in section 2 instead).
  local sha_out
  sha_out="$(grep -v ' \*\?\./settings\.json$' "$STAGE/MANIFEST.sha256" | rssh "$HOST" 'cd "$HOME/.claude" 2>/dev/null && { if command -v sha256sum >/dev/null 2>&1; then sha256sum -c - 2>&1; else shasum -a 256 -c - 2>&1; fi; }' || true)"
  printf '%s\n' "$sha_out" >> "$report"
  echo '```' >> "$report"
  local bad; bad="$(printf '%s\n' "$sha_out" | grep -cv ': OK$' || true)"
  if [ "$bad" != 0 ]; then issues=$((issues+1)); echo "**MISMATCHES: $bad**" >> "$report"; fi

  echo '## 2. settings.json semantic diff (expected transform vs remote, modulo extraKnownMarketplaces which the remote CLI manages)' >> "$report"
  local sdiff
  sdiff="$(diff -u <(jq -S 'del(.extraKnownMarketplaces)' "$STAGE/payload/settings.json") <(rssh "$HOST" 'cat "$HOME/.claude/settings.json" 2>/dev/null' | jq -S 'del(.extraKnownMarketplaces)' 2>/dev/null) 2>&1 || true)"
  if [ -z "$sdiff" ]; then echo 'OK — semantically identical' >> "$report"; else { echo '```diff'; printf '%s\n' "$sdiff"; echo '```'; } >> "$report"; issues=$((issues+1)); fi

  echo '## 3. CLI / plugins / claude-mem / purity' >> "$report"
  local checks
  checks="$(rssh "$HOST" "$(nvm_pre)"'
    echo "claude_version=$(claude --version 2>/dev/null | head -1 || echo BROKEN)"
    PL="$(claude plugin list 2>/dev/null || echo LIST_FAILED)"
    for p in '"${PLUGINS_TO_INSTALL[*]}"'; do
      base="${p%%@*}"
      printf "%s" "$PL" | grep -q "$base" && echo "plugin_ok=$base" || echo "plugin_MISSING=$base"
    done
    for d in hooks output-styles; do [ -e "$HOME/.claude/$d" ] && echo "purity_FAIL=$d present"; done
    [ -e "$HOME/.claude/agents" ] || echo "purity_FAIL=agents MISSING (portable since 2026-08-26)"
    [ -f "$HOME/.claude/.ecosystem-align.json" ] && echo "sentinel=present" || echo "sentinel=MISSING"
    jq -r "\"mem_datadir=\" + (.CLAUDE_MEM_DATA_DIR // \"ABSENT\")" "$HOME/.claude-mem/settings.json" 2>/dev/null || echo "mem_datadir=NO_FILE"
    if [ -f "$HOME/.claude/plugins/installed_plugins.json" ]; then
      grep -cE '"'"'$FOREIGN_RE'"'"' "$HOME/.claude/plugins/installed_plugins.json" | sed "s/^/foreign_paths=/"
    else echo "foreign_paths=NO_REGISTRY"; fi
    for s in '"$NPM_SPECS"'; do
      ver="${s##*@}"; pkg="${s%@$ver}"
      npm ls -g --depth=0 "$pkg" 2>/dev/null | grep -q "@$ver" && echo "sdk_npm_ok=$s" || echo "sdk_npm_MISSING=$s"
    done
    for s in '"$PIP_SPECS"'; do
      pkg="${s%%==*}"; ver="${s##*==}"
      v="$(pip3 show "$pkg" 2>/dev/null | awk "/^Version:/{print \$2}")"
      [ "$v" = "$ver" ] && echo "sdk_pip_ok=$s" || echo "sdk_pip_MISSING=$pkg have=${v:-none}"
    done
    for p in '"${PIP_PRUNE[*]}"'; do
      pip3 show "$p" >/dev/null 2>&1 && echo "sdk_pip_DEPRECATED_PRESENT=$p"
    done
  ' 2>&1 || true)"
  { echo '```'; printf '%s\n' "$checks"; echo '```'; } >> "$report"
  printf '%s\n' "$checks" | grep -qE 'plugin_MISSING|purity_FAIL|claude_version=BROKEN|sentinel=MISSING|sdk_npm_MISSING|sdk_pip_MISSING|sdk_pip_DEPRECATED_PRESENT' && issues=$((issues+1))
  printf '%s\n' "$checks" | grep -q "mem_datadir=$RHOME/.claude-mem" || issues=$((issues+1))
  local fp; fp="$(printf '%s\n' "$checks" | grep -oE 'foreign_paths=[0-9]+' | cut -d= -f2 || echo '')"
  [ -n "$fp" ] && [ "$fp" != 0 ] && issues=$((issues+1))

  # 4. Plugin marketplace SHA parity (Opzione C, design §13.2): make plugin-version drift VISIBLE.
  #    The CLI has no version pin and `claude-plugins-official` is non-git, so we compare the git
  #    HEAD of each git-backed marketplace (Windows SoT vs remote). DRIFT here is INFORMATIVE, NOT a
  #    verdict failure (Enzo updates plugins manually per machine) — it does not bump $issues.
  echo '## 4. plugin marketplace SHA parity (Opzione C — drift visible, manual update by Enzo)' >> "$report"
  {
    echo '```'
    drift=0
    for d in "$SRC/plugins/marketplaces"/*/; do
      [ -d "$d/.git" ] || continue
      nm="$(basename "$d")"
      lsha="$(git -C "$d" rev-parse HEAD 2>/dev/null || echo NONE)"
      rsha="$(rssh "$HOST" "git -C \"\$HOME/.claude/plugins/marketplaces/$nm\" rev-parse HEAD 2>/dev/null" || true)"
      [ -n "$rsha" ] || rsha=MISSING
      if [ "$lsha" = "$rsha" ]; then echo "marketplace_sha $nm: OK (${lsha:0:10})"
      else echo "marketplace_sha $nm: DRIFT win=${lsha:0:10} remote=${rsha:0:10}"; drift=$((drift+1)); fi
    done
    echo "marketplace official: non-git (plugin version not SHA-verifiable — manual update)"
    [ "$drift" != 0 ] && echo "NOTE: $drift marketplace(s) drift — informativo, update manuale Enzo (not a verdict fail)"
    echo '```'
  } >> "$report"

  # 5. Project memory tree parity (design §13.3/§13.6). The per-project Claude memories travel
  #    on the OTHER channel (align-clones → sync-memory-tree), but the idempotence verdict must
  #    still SEE them — else "ecosystem idempotent" stays partial. Memory DRIFT IS blocking (§13.5).
  #    RESILIENT (D-41): the remote ALWAYS prints a `MEMCOUNT=` sentinel; if the ssh/command yields
  #    no sentinel (slow LAN box, transient timeout — observed on the Mac), mark it SKIP, not a
  #    false `remote=0` DRIFT. A genuine missing dir prints `MEMCOUNT=0` → real drift.
  echo '## 5. project memory tree (canale align-clones/sync-memory-tree — count parity, resilient)' >> "$report"
  {
    echo '```'
    local lmem="$HOME/.claude/projects/D--heuresys-advanced/memory"
    local lc rline rc
    lc="$( [ -d "$lmem" ] && ls -1 "$lmem" 2>/dev/null | grep -c . || echo 0 )"
    rline="$(rssh "$HOST" '
      d="$(find "$HOME/.claude/projects" -maxdepth 1 -type d -name "*heuresys-advanced*" 2>/dev/null | head -1)"
      if [ -n "$d" ] && [ -d "$d/memory" ]; then echo "MEMCOUNT=$(ls -1 "$d/memory" 2>/dev/null | grep -c .)"; else echo "MEMCOUNT=0"; fi
    ' 2>/dev/null | grep "^MEMCOUNT=" | tail -1)"
    if [ -z "$rline" ]; then
      echo "project_memory: win=$lc remote=? SKIP (host non risponde al check — non un DRIFT)"
    else
      rc="${rline#MEMCOUNT=}"
      if [ "$lc" = "$rc" ]; then echo "project_memory: win=$lc remote=$rc OK"
      else echo "project_memory: win=$lc remote=$rc DRIFT"; mem_drift=1; fi
    fi
    echo '```'
  } >> "$report"
  [ "$mem_drift" = 1 ] && issues=$((issues+1))

  echo >> "$report"
  if [ "$issues" = 0 ]; then
    echo "## VERDICT: CLEAN — $kind is an effective clone of the Windows catalog" >> "$report"
    log "[$kind] verify CLEAN ($report)"
  else
    echo "## VERDICT: DRIFT — $issues issue group(s), see sections above" >> "$report"
    warn "[$kind] verify found drift ($issues issue groups) — $report"
  fi
  cleanup; STAGE=""
  [ "$issues" = 0 ]
}

# --- align orchestration -----------------------------------------------------------------------
SKIPPED=""
align_host() {  # $1 = kind
  local kind="$1"; "${kind}_cfg"

  if ! reachable "$HOST"; then
    if [ "$RESILIENT" = 1 ]; then warn "[$kind] $HOST unreachable — skipped"; SKIPPED="$SKIPPED $kind"; return 0
    else die "[$kind] $HOST unreachable (use --resilient to skip)"; fi
  fi

  # #236 F4 — UN HOST LASCIATO A META' NON SI SALTA MAI, nemmeno in `--delta`.
  #
  # DIFETTO TROVATO DALLA PROVA (2026-08-29, S1084), non ragionato a tavolino: dopo aver
  # ucciso un allineamento a meta' corsa, il giro successivo con `--delta` avrebbe SALTATO
  # quell'host — perche' la condizione guardava «payload invariato + sentinella presente»,
  # e la sentinella c'e' anche su un host incompleto (la scrive `push_payload`, prima
  # della fine). Cioe' il rimedio consigliato da `verifica-cloni.sh` avrebbe lasciato la
  # macchina rotta esattamente com'era, dicendo «skip» con l'aria di aver fatto il lavoro.
  #
  # Il marcatore ha la precedenza sulla sentinella qui come li': e' l'unico dei due che
  # sa distinguere «finito» da «cominciato».
  if [ "$DELTA" = 1 ] && [ -f "$MARKER" ]; then
    local changed
    changed="$(find "$SRC/CLAUDE.md" "$SRC/skills" "$SRC/commands" "$SRC/statusline-command.sh" "$SRC/settings.json" "$BOOTSTRAP_SRC" "$CLAUDE_MEM_SRC" -newer "$MARKER" 2>/dev/null | head -1)"
    if [ -z "$changed" ] && rssh "$HOST" '[ -f "$HOME/.claude/.ecosystem-align.json" ]'; then
      if rssh "$HOST" '[ -f "$HOME/.claude/.ecosystem-align.INCORSO" ]'; then
        warn "[$kind] delta: nessun cambiamento, MA l'host porta un allineamento lasciato a meta' — NON lo salto"
      else
        log "[$kind] delta: no ecosystem changes this session + already aligned — skip"; return 0
      fi
    fi
  fi

  log "[$kind] staging payload (RHOME=$RHOME)"
  build_stage "$RHOME"

  if [ "$DRY" = 1 ]; then
    log "[$kind] DRY-RUN — payload manifest"
    awk '{print "  " $2}' "$STAGE/MANIFEST.sha256" | sort | head -60
    echo "  ... ($(wc -l < "$STAGE/MANIFEST.sha256") files total)"
    log "[$kind] DRY-RUN — settings.json diff (remote -> staged)"
    diff -u <(rssh "$HOST" 'cat "$HOME/.claude/settings.json" 2>/dev/null' | jq -S . 2>/dev/null) <(jq -S . "$STAGE/payload/settings.json") | head -120 || true
    log "[$kind] DRY-RUN — planned destructive actions"
    if rssh "$HOST" '[ -f "$HOME/.claude/.ecosystem-align.json" ]'; then
      echo "  incremental: tgz-backup + wipe of: ${MANAGED_REMOTE_PATHS[*]}"
    else
      echo "  FIRST RUN: mv ~/.claude -> ~/.claude.bak-$STAMP ; preserve: ${PRESERVE_FROM_REMOTE[*]}"
    fi
    echo "  plugin reinstall: ${#PLUGINS_TO_INSTALL[@]} plugins, ${#MARKETPLACES[@]} marketplaces (skip=$SKIP_PLUGINS)"
    cleanup; STAGE=""; return 0
  fi

  log "[$kind] auth presence (pre)"
  local auth_pre; auth_pre="$(auth_presence)"
  echo "$auth_pre" | sed 's/^/  /'

  # #236 F4 — il marcatore va scritto PRIMA del wipe, non dopo: fra i due c'e' proprio la
  # finestra che si vuole rendere visibile. Scriverlo dopo lascerebbe scoperto il caso in
  # cui la sessione muore durante il backup stesso.
  segna_incorso "$kind"
  log "[$kind] backup + wipe managed paths"
  backup_remote
  echo "  backup kind: $BACKUP_KIND (stamp $STAMP)"

  log "[$kind] push payload"
  if ! push_payload; then
    warn "[$kind] payload push FAILED — rolling back"
    rollback_host "$kind" "$STAMP"; die "[$kind] aligned aborted, rolled back to $STAMP"
  fi

  if [ "$SKIP_PLUGINS" = 1 ]; then
    log "[$kind] plugin stage skipped (--skip-plugins)"
  else
    log "[$kind] reinstall plugins (native, fixes foreign-path registries)"
    reinstall_plugins || warn "[$kind] plugin stage incomplete — re-run or check verify report"
    # D-40: reinstall re-enables every plugin; re-apply the Windows enabledPlugins (SoT) so a
    # deliberately-disabled plugin (e.g. claude-mem=false) stays disabled on the clone.
    reapply_enabled_plugins || warn "[$kind] enabledPlugins re-apply incomplete (D-40)"
  fi

  log "[$kind] claude-mem settings (fresh per-machine DB preserved)"
  setup_claude_mem

  if [ "$SKIP_SDKS" = 1 ]; then
    log "[$kind] SDK stage skipped (--skip-sdks)"
  else
    log "[$kind] SDK parity (npm + pip pinned to SoT, prune deprecated)"
    sdk_stage || warn "[$kind] SDK stage incomplete — re-run with --sdks-only"
  fi

  log "[$kind] auth presence (post) — files must not have disappeared"
  local auth_post; auth_post="$(auth_presence)"
  echo "$auth_post" | sed 's/^/  /'
  if printf '%s' "$auth_post" | grep -q MISSING && ! printf '%s' "$auth_pre" | grep -q MISSING; then
    warn "[$kind] AUTH FILE DISAPPEARED — rolling back"
    rollback_host "$kind" "$STAMP"; die "[$kind] auth integrity violated, rolled back"
  fi
  echo "  auth files intact (functional proof follows in smoke test)"

  if [ "$SKIP_SMOKE" = 1 ]; then
    log "[$kind] smoke test skipped (--skip-smoke)"
  else
    log "[$kind] smoke test (headless claude -p)"
    local smoke_rc=0; smoke_test || smoke_rc=$?
    if [ "$smoke_rc" = 1 ]; then
      warn "[$kind] smoke test FAILED (startup) — rolling back to $STAMP"
      rollback_host "$kind" "$STAMP"; die "[$kind] align aborted, rolled back (failed state in ~/.claude.rolledback)"
    elif [ "$smoke_rc" = 2 ]; then
      warn "[$kind] smoke inconclusive: auth needs 'claude login' on $HOST — alignment kept"
    fi
  fi

  cleanup; STAGE=""
  # #236 F4 — l'host non e' piu' a meta': da qui in poi un'interruzione non lascia uno
  # stato misto, perche' payload, plugin, claude-mem e SDK sono gia' posati. Il `verify`
  # che segue e' una LETTURA e non cambia niente, quindi il marcatore si toglie prima:
  # tenerlo fino a dopo il verify farebbe dichiarare INTERROTTO un host sano se la
  # sessione muore mentre legge un rapporto.
  togli_incorso
  log "[$kind] verify"
  verify_host "$kind" || warn "[$kind] post-align verify reported drift — inspect report"
  log "[$kind] DONE (backup: $BACKUP_KIND @ $STAMP)"
}

run_target() {  # dispatch one kind through the requested mode
  local kind="$1"
  if [ -n "$ROLLBACK_STAMP" ]; then rollback_host "$kind" "$ROLLBACK_STAMP"; return; fi
  if [ "$SDKS_ONLY" = 1 ]; then
    "${kind}_cfg"
    if ! reachable "$HOST"; then
      if [ "$RESILIENT" = 1 ]; then warn "[$kind] unreachable — sdk stage skipped"; SKIPPED="$SKIPPED $kind"; return 0
      else die "[$kind] $HOST unreachable"; fi
    fi
    log "[$kind] SDK parity (sdks-only)"
    sdk_stage
    return
  fi
  if [ "$VERIFY_ONLY" = 1 ]; then
    "${kind}_cfg"
    if ! reachable "$HOST"; then
      if [ "$RESILIENT" = 1 ]; then warn "[$kind] unreachable — verify skipped"; SKIPPED="$SKIPPED $kind"; return 0
      else die "[$kind] $HOST unreachable"; fi
    fi
    verify_host "$kind" || true
    return
  fi
  align_host "$kind"
}

preflight_local
case "$TARGETS_ARG" in
  mac)     run_target mac ;;   # on-demand only — RETIRED from `all` (S1007: Mac SIGILL/plugin failures)
  vm)      run_target vm ;;
  linuxpc) run_target linuxpc ;;
  all)     run_target vm; RESILIENT=1 run_target linuxpc ;;
esac

log "ecosystem alignment complete (mode: dry=$DRY verify=$VERIFY_ONLY delta=$DELTA${SKIPPED:+ skipped:$SKIPPED})"
