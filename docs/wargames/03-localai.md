# WARGAME 03 — LOCAL AI, MULTI-MACHINE
**Mission**: fully local, open-source AI setup across the fleet (PC Windows / Mac 2012 / VM OCI ARM). Private by default: nothing to third-party APIs; the VM counts as local (own tenancy). Use cases: RAG doc chat, coding help, first drafts.
**Executor**: Claude Code CLI running ON the target machine (one route per machine; the plan forks at the top).
**Date wargamed**: 2026-07-06 (specs verified same day; releases verified via web recon same day).
**Working dirs (fixed, do not improvise)**: PC `D:\localai\` · Mac `/Users/enzo/localai/` · VM `/home/ubuntu/localai/`

---

## 0. MACHINE FORK — run this first

Identify the machine you are on. Exact check, in order:

1. If `uname` is not available and `$env:COMPUTERNAME` returns `DESKTOP-KH728P2` (PowerShell: `Write-Output $env:COMPUTERNAME`) → **ROUTE PC**.
2. If `uname -s` returns `Darwin` and `sysctl -n hw.model` returns `MacBookPro9,2` → **ROUTE MAC**.
3. If `uname -sm` returns `Linux aarch64` and `hostname -I` contains a 10.x private IP and `systemctl is-active heuresys-advanced-api` returns `active` → **ROUTE VM**.
4. If none match → **ABORT**: wrong machine, flag to Enzo. Do not guess.

Every route ends at §7 VERIFICATION RUNS. Read §1–§2 first regardless of route: the numbers there are your budget.

---

## 1. RECON FINDINGS (verified 2026-07-06 via web + local repo unless marked ASSUMED)

### 1.1 Runtimes

| Fact | Status | Source |
|---|---|---|
| llama.cpp ships rolling build-tagged releases; latest ~b9884 (2026-07-06); Windows, macOS, Linux incl. ARM64 assets | VERIFIED | github.com/ggml-org/llama.cpp/releases |
| llama.cpp **prebuilt** Windows CUDA binaries target compute ≥7.5 only — Maxwell (sm_50, GTX 950M) is NOT in prebuilt CUDA builds | VERIFIED | knightli.com 2026-05-18 prebuilt-binaries article; ai-dock/llama.cpp-cuda arch list |
| llama.cpp **source build** with `-DCMAKE_CUDA_ARCHITECTURES=50` still compiles for Maxwell (CUDA 12 dropped only Kepler 3.7) | VERIFIED | llama.cpp docs/build.md; ggml-org issue #3501 |
| llama.cpp Vulkan prebuilt Windows binary exists and runs on Maxwell-class GPUs (GTX 980M appears in the official Vulkan perf thread) | VERIFIED | llama.cpp discussion #10879; knightli.com GPU benchmark 2026-04-23 |
| Ollama current ~v0.30.x (v0.30.10 cited July 2026); engine synced to llama.cpp b9840; official Linux ARM64 install | VERIFIED | releasebot.io/updates/ollama; localaimaster.com/blog/ollama-version-history; github.com/ollama/ollama/releases |
| Ollama NVIDIA floor: compute capability 5.0+, and CC 5.0–6.2 requires **driver ≥570** | VERIFIED | docs.ollama.com/gpu |
| Ollama still supports Intel x86 macOS (CPU-only, no GPU accel on Intel Macs) | VERIFIED | docs.ollama.com/macos; ollama issue #14001 |
| GTX 950M = Maxwell GM107 = compute capability **5.0**, 2 GB VRAM | VERIFIED (spec sheet, stable) | NVIDIA specs |

### 1.2 Models (July 2026 state)

| Model | Role | Size Q4_K_M | License | Source |
|---|---|---|---|---|
| Qwen3-8B | daily driver (PC, VM) | ~5.0–5.5 GB | Apache 2.0 | sitepoint best-local-llm-2026; hf.co blog open-source-llms |
| Qwen3-4B | fallback (PC, VM), daily (Mac) | ~2.5–3.0 GB | Apache 2.0 | same |
| Qwen3-1.7B | Mac emergency fallback | ~1.1–1.4 GB (ASSUMED size — verify on HF page at download) | Apache 2.0 | Qwen3 family (April 2025 release, stable) |
| Gemma 4 (released 2026-04-02, Apache 2.0: e2b/e4b/12b/26b-a4b/31b, on Ollama as `gemma4`) | optional VM upgrade `gemma4:12b` | ~8 GB Q4 (ASSUMED — check `ollama show`) | Apache 2.0 | ollama.com/library/gemma4; aurigait.com gemma-4 guide |
| nomic-embed-text | embedding (PC, Mac) | 274 MB | Apache 2.0 | morphllm.com/ollama-embedding-models |
| bge-m3 | embedding (VM — multilingual, IT docs) | ~1.2 GB | MIT | same; milvus.io embedding guide 2026 |

Qwen3 is a hybrid-thinking family: benchmarks and drafts must append `/no_think` to the prompt or the model burns tokens thinking and t/s comparisons are garbage.

### 1.3 RAG stack — the license trap (this is a red-team patch, see §9)

- **Open WebUI: REJECTED.** License changed at v0.6.6 (April 2025) to a custom non-OSI license with a branding clause (binding at 50+ user deployments — not our scale, but it breaks the mission's "everything open source" literal requirement); bundled ChromaDB shipped a PostHog telemetry attempt (issue #15613, fixed upstream in chromadb 1.0.15) — telemetry-on-by-default posture is the disqualifier, not an active leak. (Evidence dates/nuance corrected per REVIEW-03 M4; the rejection stands on the non-OSI license clause.)
- **AnythingLLM: SELECTED.** MIT license (github.com/Mintplex-Labs/anything-llm). Telemetry exists but is disabled via `DISABLE_TELEMETRY=true` env or in-app Privacy toggle; docs state nothing is collected when disabled (docs.anythingllm.com privacy page). Desktop app for Windows; Docker image (arm64 available) for the VM.
- **Fallback if AnythingLLM fails anywhere**: `llama-server` built-in web UI for plain chat (no RAG), and RAG deferred to the machine where AnythingLLM works.

### 1.4 The VM production stack (verified by reading D:\heuresys-advanced on 2026-07-06)

- systemd units: `heuresys-advanced-api.service` (Fastify, **port 8013** in PROD — dev default is 3001; health at `GET /readyz`, apps/api/src/app.ts:317), `heuresys-advanced-web.service` (Next.js, **port 3013** in PROD; nginx proxies www.heuresys.com→3013, /api→8013 — deploy/README.md:159,184), plus timers `-scraping`, `-insights`, `-backup`, `-reindex`.
- PostgreSQL 16 on **port 5432, localhost, on the VM** (deploy/README.md:162,188). **5433 is the Windows-side SSH-tunnel port** (README.md:205), not a VM listener — the original recon confused the two.
- ⚠️ AnythingLLM's default port is **3001 — the heuresys API's *dev*-config port (PROD runs on 8013)**. No live collision exists on the VM; remap to 3051 anyway as belt-and-suspenders hygiene. See §9 (the original "collision" rationale was refuted by REVIEW-03 C2; the remap stays).
- Reserved ports on VM: 22, 80, 443, 3013, 8013, 3100, 3200, 5432 — nginx also serves co-tenant production sites `evo.heuresys.com`→3200 and `lalibraiascalza.com`→3100 (deploy/README.md:180). AI stack uses 11434 (Ollama) + 3051 (AnythingLLM), localhost-bound.

### 1.5 Per-machine RAM math (the budget you must not exceed)

**PC — 16 GB, i7-7500U 2C/4T (Kaby Lake: AVX2+FMA yes), GTX 950M 2GB, DDR4 dual-channel (~34 GB/s theoretical)**
- Windows 11 idle + services: assume 5 GB used → ~10 GB safely usable (ASSUMED — Move PC-1 measures it).
- Qwen3-8B Q4_K_M: 5.3 GB weights + ~1.2 GB KV @8K ctx fp16 + ~0.7 GB runtime = **~7.2 GB → fits**. Use 4K ctx (≈0.6 GB KV) as default → ~6.6 GB.
- Qwen3-4B Q4_K_M: 2.7 GB + 0.6 GB + 0.5 GB = **~3.8 GB → comfortable**.
- Qwen3-14B Q4_K_M (~9 GB weights): would fit RAM but at ~1–1.5 t/s on 2 cores — **rejected as unusable**.
- GPU: 2 GB VRAM holds at most ~10–14 layers of 8B Q4. Whether Vulkan partial offload beats CPU-only on a 2015 mobile Maxwell is genuinely uncertain → **measured A/B in Move PC-6, not assumed**.
- Expected CPU-only throughput (2C/4T, ~30 GB/s effective): 8B Q4 ≈ **2–3.5 t/s**; 4B ≈ **4–7 t/s**. Painful but usable for drafts; the VM route is the real daily driver from this machine.

**Mac — 8 GB, i7-3520M 2C/4T (Ivy Bridge: AVX yes, NO AVX2, NO FMA), no dGPU, DDR3-1600**
- macOS 15.7 idle: assume 3 GB used → ~4.5 GB safely usable (Move MAC-1 measures).
- Qwen3-8B Q4_K_M (5.3 GB): **does not fit** alongside the OS without swap thrash. Excluded.
- Qwen3-4B Q4_K_M: 2.7 GB + 0.4 GB KV @2–4K + 0.4 GB = **~3.5 GB → fits, tight**. This IS the Mac daily driver ceiling.
- Qwen3-1.7B Q4_K_M: ~1.3 GB total ≈ **always fits** — emergency fallback.
- No AVX2 → generic prebuilt x86 binaries may crash with illegal instruction, and llama.cpp no longer reliably ships macos-x64 assets → **build from source** (Move MAC-3).
- Expected: 4B ≈ **2–4 t/s**; 1.7B ≈ **5–9 t/s**. Verdict: the Mac is a client. Its real AI power is the SSH tunnel to the VM.

**VM — Ampere A1, up to 4 OCPU / 24 GB, Ubuntu 24.04 ARM64, Neoverse-N1 (NEON + dotprod; NO SVE, NO i8mm)**
- Production stack (Postgres 16 + Fastify + Next.js + timers): assume 4–7 GB resident (Move VM-1 measures — this is THE fork trigger).
- Hard budget for AI: **systemd cap MemoryMax=10G, CPUQuota=300%** (3 of 4 OCPU; 1 OCPU always left to production).
- Qwen3-8B Q4_K_M via Ollama: ~5.2 GB + 1.2 GB KV @8K + overhead ≈ **~7 GB → fits inside the 10G cap** if MemAvailable ≥ 12 GB.
- bge-m3: +1.2 GB when loaded. `OLLAMA_MAX_LOADED_MODELS=2` lets chat+embed coexist: 7 + 1.5 ≈ 8.5 GB < 10G cap. OK.
- `gemma4:12b` (~8 GB weights): ONLY if MemAvailable ≥ 15 GB after production. Gated fork, not default.
- Expected: 8B Q4 on 3 ARM cores ≈ **4–8 t/s** (ASSUMED from community A1 reports — Move VM-8 measures; threshold ≥3.5 t/s).

### 1.6 Assumed (not verified — each has a RECON NEEDED check in §2)
- Current free RAM on each machine at execution time.
- NVIDIA driver version on the PC (Ollama needs ≥570 for CC 5.0; NVIDIA's 580 branch is the last for Maxwell).
- Whether ufw is active on the VM — expected branch: **ufw active** (the project's own `vm-bootstrap.sh` configures ufw, deploy/README.md:159); R10 confirms either way.
- Docker present on the VM.
- VM free disk.
- Mac Wi-Fi interface name (en0 vs en1 on a 2012 MBP).
- Mac SSH alias for the VM in ~/.ssh/config.
- Exact HF GGUF asset names (repos rename; the Moves say "pick the Q4_K_M asset on the page", never a hardcoded filename trusted blindly).

---

## 2. RECON NEEDED — exact checks the executor runs (each is embedded in a Move; listed here for audit)

| # | Unknown | Exact check | Where |
|---|---|---|---|
| R1 | PC free RAM | `Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory,TotalVisibleMemorySize` | Move PC-1 |
| R2 | PC NVIDIA driver + VRAM | `& "C:\Windows\System32\nvidia-smi.exe"` (fallback `C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe`) — read Driver Version and 2048MiB total | Move PC-1 |
| R3 | PC CPU flags (AVX2 confirm) | `Get-CimInstance Win32_Processor | Select-Object Name` → must contain "i7-7500U" (Kaby Lake ⇒ AVX2). Runtime proof: llama.cpp prints enabled SIMD at startup | Move PC-5 |
| R4 | Mac instruction sets | `sysctl -a | grep machdep.cpu` → `features` must list AVX1.0; AVX2 must be ABSENT from `leaf7_features` | Move MAC-1 |
| R5 | Mac free RAM | `vm_stat` (free+inactive pages × 4096) and `sysctl hw.memsize` | Move MAC-1 |
| R6 | Mac Wi-Fi interface | `networksetup -listallhardwareports` → note the device for "Wi-Fi" | Move MAC-1 |
| R7 | Mac→VM ssh alias | `grep -A6 -i "oracle-vm-default\|80.225.82.207" /Users/enzo/.ssh/config` | Move MAC-7 |
| R8 | VM free RAM/CPU headroom | `free -h` (MemAvailable) + `uptime` + `systemctl status heuresys-advanced-api --no-pager | grep Memory` | Move VM-1 |
| R9 | VM free disk | `df -h / /home` → need ≥15 GB free | Move VM-1 |
| R10 | VM firewall state | `sudo ufw status verbose` AND `sudo iptables -L INPUT -n --line-numbers` | Move VM-6 |
| R11 | VM OCI-level exposure | external probe from PC: `Test-NetConnection 80.225.82.207 -Port 11434` must show `TcpTestSucceeded : False` (same for 3051) | Move VM-7 / §7 |
| R12 | Docker on VM | `docker --version && docker info --format '{{.ServerVersion}}'` | Move VM-9 |
| R13 | VM SVE/dotprod flags | `lscpu | grep -o 'asimddp\|sve'` → expect `asimddp`, no `sve` | Move VM-2 |
| R14 | Exact GGUF asset names/sizes | read the HF repo page listed in the Move at download time; the Q4_K_M asset must exist and its size must match §1.5 ±15% | download Moves |
| R15 | Ollama current version at install time | `ollama --version` after install; any v0.30+ acceptable | Move VM-3 |

---

## 3. ROUTE PC — Windows 11, DESKTOP-KH728P2

**Stack**: llama.cpp prebuilt (CPU + Vulkan variants) + llama-server + AnythingLLM Desktop (RAG UI). No Ollama needed here (llama.cpp gives the offload A/B control the mission demands). All PowerShell 5.1-safe, absolute paths.

**PC-1. Baseline recon.**
```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory,TotalVisibleMemorySize
& "C:\Windows\System32\nvidia-smi.exe"
Get-PSDrive D | Select-Object Free
```
- Expected: TotalVisibleMemorySize ≈ 16 GB; FreePhysicalMemory ≥ 8 GB (in KB); nvidia-smi shows GTX 950M, 2048MiB, Driver ≥ 570 preferred (last Maxwell branch is 580) — but any Vulkan-1.2-capable driver is enough for the PC-6 A/B (the ≥570 floor is Ollama's requirement, and Ollama is never installed on the PC — a lower driver is NOT an expectation-miss); D: free ≥ 20 GB.
- Likely failure: `nvidia-smi` not found at either path → cause: driver not installed or very old → counter-move: GPU route is dead, proceed CPU-only (skip PC-6, set `-ngl 0` everywhere); note in report "driver install is Enzo's call, not yours".
- FORK: FreePhysicalMemory < 7,000,000 KB (≈6.7 GiB) → too many apps open; flag it, continue but download only Qwen3-4B (skip 8B until a reboot happens).

**PC-2. Create dirs.**
```powershell
New-Item -ItemType Directory -Force -Path D:\localai\llama-cpu, D:\localai\llama-vulkan, D:\localai\models | Out-Null
```
- Expected: three dirs exist. Failure: D: not writable → cause: permissions/disk → counter-move: use `C:\localai\` (C: has 617 GB free), substitute the path in ALL later commands.

**PC-3. Download llama.cpp binaries (latest release, two variants).**
Open https://github.com/ggml-org/llama.cpp/releases/latest — pick the asset whose name matches `*win*cpu*x64*.zip` (or `*win-avx2-x64*` in older naming) and the one matching `*win*vulkan*x64*.zip`. Download with:
```powershell
Invoke-WebRequest -Uri "<ASSET_URL_CPU>" -OutFile D:\localai\llama-cpu.zip
Invoke-WebRequest -Uri "<ASSET_URL_VULKAN>" -OutFile D:\localai\llama-vulkan.zip
Expand-Archive -Path D:\localai\llama-cpu.zip -DestinationPath D:\localai\llama-cpu -Force
Expand-Archive -Path D:\localai\llama-vulkan.zip -DestinationPath D:\localai\llama-vulkan -Force
```
- Expected: `D:\localai\llama-cpu\llama-bench.exe` and `llama-server.exe` exist (they may sit in a `\bin\` subfolder — check both, adjust paths below accordingly).
- Likely failure: no asset matches the pattern → cause: release asset naming changed again → counter-move: list all assets, pick the x64 Windows zip WITHOUT cuda/hip/sycl in the name for CPU, WITH vulkan for Vulkan; if still ambiguous, take the previous release (b-number minus ~50).
- Do NOT download any `cuda` asset: prebuilt CUDA is compute ≥7.5, the 950M is 5.0 — it will not load kernels (§1.1). Source-building CUDA for sm_50 is possible but is a 1h+ toolchain detour for a 2 GB card; Vulkan gives the same A/B answer cheaper. Only escalate to a CUDA source build if Enzo explicitly asks.

**PC-4. Download models.**
From these HF repos, pick the Q4_K_M `.gguf` (R14):
- https://huggingface.co/Qwen/Qwen3-8B-GGUF → save as `D:\localai\models\qwen3-8b-q4km.gguf` (~5.0–5.5 GB)
- https://huggingface.co/Qwen/Qwen3-4B-GGUF → `qwen3-4b-q4km.gguf` (~2.5–3 GB)
- https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF → the Q8_0 or F16 asset, `nomic-embed-q8.gguf` (~150–300 MB)
```powershell
Invoke-WebRequest -Uri "<HF_RESOLVE_URL>" -OutFile D:\localai\models\qwen3-8b-q4km.gguf
```
- Expected: file sizes within ±15% of §1.5. Failure: 404 → cause: repo renamed → counter-move: HF search "Qwen3 8B GGUF", prefer uploader `Qwen`, then `bartowski`, then `unsloth`; still Q4_K_M. Failure: size wildly off → wrong quant clicked → re-download.

**PC-5. CPU smoke test + benchmark.**
```powershell
D:\localai\llama-cpu\llama-bench.exe -m D:\localai\models\qwen3-8b-q4km.gguf -t 4 -p 512 -n 128
D:\localai\llama-cpu\llama-bench.exe -m D:\localai\models\qwen3-4b-q4km.gguf -t 4 -p 512 -n 128
```
- Expected: startup log shows AVX2 = 1; tg128 result 8B ≈ 2–3.5 t/s, 4B ≈ 4–7 t/s. Record both numbers.
- Likely failure: t/s ≪ 1 → cause: RAM swap (check Task Manager committed memory) → counter-move: close apps, retry; if still <1 t/s, drop 8B from the PC plan, 4B becomes daily driver, note in report.
- Likely failure: crash on load → cause: corrupt download → counter-move: re-download, compare size.

**PC-6. Vulkan partial-offload A/B (the mission's explicit question).**
```powershell
D:\localai\llama-vulkan\llama-bench.exe -m D:\localai\models\qwen3-8b-q4km.gguf -t 4 -p 512 -n 128 -ngl 0,6,10,14
```
- Expected: a table of tg128 per ngl value. The 950M has 2 GB: ngl 14 may OOM (that is data, not failure).
- FORK (decides the PC runtime config): if best Vulkan ngl beats CPU-only tg128 by ≥15% → adopt that `-ngl N` in PC-7. If ≤15% or Vulkan errors (`vk::OutOfDeviceMemoryError`, device not found, driver crash) → **CPU-only route, `-ngl 0`**, permanently. No judgment call: 15% is the line.
- Likely failure: Vulkan device not detected → cause: old NVIDIA driver lacks recent Vulkan → counter-move: CPU-only route, record driver version for Enzo.

**PC-7. Serve.**
```powershell
D:\localai\llama-cpu\llama-server.exe -m D:\localai\models\qwen3-8b-q4km.gguf -c 4096 -t 4 --host 127.0.0.1 --port 8080
```
(Use the vulkan dir + winning `-ngl` if PC-6 said so.)
- Expected: `server listening on http://127.0.0.1:8080`; browsing there shows the built-in chat UI.
- Failure: port 8080 busy → `netstat -ano | findstr :8080`, pick 8081, keep note. Failure: OOM on load → lower `-c` to 2048, or swap to 4B model.

**PC-8. AnythingLLM Desktop (RAG).**
Download the Windows installer from https://anythingllm.com (Desktop). Install, then IMMEDIATELY: Settings → Privacy & Data-Handling → disable telemetry (equivalent of `DISABLE_TELEMETRY=true`).
Configure: LLM provider = "Generic OpenAI" → base URL `http://127.0.0.1:8080/v1`, any API key string, model name as reported by llama-server. Embedder = built-in local embedder OR "Local AI" pointing at a second llama-server running `nomic-embed-q8.gguf` with `--embedding` flag on port 8081.
- Expected: a workspace can be created; uploading a doc triggers local embedding (CPU spike, no network).
- Likely failure: AnythingLLM only lists cloud providers in the picker → cause: UI flow changed → counter-move: any "OpenAI compatible / Generic" option with the base URL above; that API surface is stable.
- FORK: if AnythingLLM install fails on Windows 11 Insider (ASSUMED risk, Insider builds break installers) → fallback: llama-server built-in UI for chat + defer RAG to the VM route (§5) accessed from this PC.

**PC-9. SSH tunnel to VM (the heavy-model escape hatch, set up now, used at will).**
```powershell
C:\Windows\System32\OpenSSH\ssh.exe -i C:\Users\enzospenuso\.ssh\oci_recovery_ed25519 -N -L 11434:127.0.0.1:11434 -L 3051:127.0.0.1:3051 ubuntu@80.225.82.207
```
- Expected: command blocks silently (that means the tunnel is up). Test in a second window: `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:11434/api/version` → JSON version (only after ROUTE VM is done).
- Likely failure: `Permission denied (publickey)` → cause: wrong key/agent → counter-move: verify key file exists, try `-o IdentitiesOnly=yes`. Failure: port 11434 already bound locally → an old tunnel or local Ollama → `netstat -ano | findstr 11434`, kill or use `-L 21434:127.0.0.1:11434` and point clients at 21434.

---

## 4. ROUTE MAC — MacBookPro9,2, 8 GB, macOS 15.7 OCLP

**Honest frame**: this machine gets (a) a small on-device model for offline drafts, (b) first-class client access to the VM. It will never run a good daily driver — see §10 verdicts.

**MAC-1. Baseline recon.**
```bash
sysctl -a | grep machdep.cpu | grep -i 'features\|leaf7'
sysctl hw.memsize && vm_stat
networksetup -listallhardwareports
df -h /
```
- Expected: `machdep.cpu.features` contains `AVX1.0`; `machdep.cpu.leaf7_features` does NOT contain `AVX2` (i7-3520M is Ivy Bridge). hw.memsize = 8589934592. Wi-Fi port device noted (likely en0 or en1 on a 2012 MBP). Disk ≥ 10 GB free.
- Likely failure: leaf7 line absent entirely → cause: pre-Haswell CPU has no leaf7 features to report → that CONFIRMS no AVX2; proceed.
- FORK: free+inactive RAM < 3.5 GB → close apps first; if still < 3.5 GB → skip Qwen3-4B, install only Qwen3-1.7B.

**MAC-2. Toolchain via Homebrew (/usr/local, Intel path).**
```bash
export PATH=/usr/local/bin:$PATH
brew install cmake git
```
- Expected: cmake ≥3.2x installs from bottle or source. Likely failure: brew complains macOS 15 x86_64 is unsupported "Tier 3" → cause: Homebrew deprioritizes Intel Sequoia → counter-move: it still works with warnings; if a bottle is missing it builds from source (slow on this hardware, up to 30+ min — acceptable, patience is HIGH).

**MAC-3. Build llama.cpp from source (mandatory — no AVX2 means generic binaries may SIGILL, and upstream macos-x64 assets are unreliable).**
```bash
cd /Users/enzo/localai || mkdir -p /Users/enzo/localai && cd /Users/enzo/localai
git clone --depth 1 https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build -DGGML_METAL=OFF -DGGML_NATIVE=ON
cmake --build build --config Release -j 4 --target llama-bench llama-server llama-cli
```
`GGML_METAL=OFF` because the HD4000 iGPU under OCLP has no usable Metal compute for ggml — CPU is the engine here.
- Expected: build completes (20–60 min on this machine); `./build/bin/llama-bench --help` runs.
- Likely failure: compiler errors on latest master → cause: transient upstream breakage → counter-move: `git checkout` the latest release tag (`git fetch --tags --depth 1 && git checkout $(git tag --sort=-creatordate | head -1)`), rebuild.
- Likely failure: clang too old → `xcode-select --install` first, or `brew install llvm` and pass `CC/CXX`.

**MAC-4. Download models.**
Same HF repos as PC-4 (R14 applies):
```bash
mkdir -p /Users/enzo/localai/models
curl -L -o /Users/enzo/localai/models/qwen3-4b-q4km.gguf "<HF_RESOLVE_URL_4B>"
curl -L -o /Users/enzo/localai/models/qwen3-1.7b-q4km.gguf "<HF_RESOLVE_URL_1_7B>"
curl -L -o /Users/enzo/localai/models/nomic-embed-q8.gguf "<HF_RESOLVE_URL_NOMIC>"
```
- Expected sizes: ~2.7 GB / ~1.3 GB / ~0.2 GB. Failures as PC-4.

**MAC-5. Benchmark.**
```bash
/Users/enzo/localai/llama.cpp/build/bin/llama-bench -m /Users/enzo/localai/models/qwen3-4b-q4km.gguf -t 2,4 -p 256 -n 128
```
- Expected: startup log shows AVX = 1, AVX2 = 0 (proof the build is correct for this CPU); tg128 ≈ 2–4 t/s at the better thread count (record whether -t 2 or -t 4 wins; on 2C/4T HT sometimes hurts).
- Likely failure: `Illegal instruction: 4` → cause: build picked up AVX2 anyway (wrong flags or cross-pollution) → counter-move: rebuild with explicit `-DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=OFF -DGGML_FMA=OFF -DGGML_F16C=ON`.
- FORK: 4B tg128 < 1.5 t/s → 4B is decorative on this Mac; demote to Qwen3-1.7B as the Mac model, note in report.

**MAC-6. Serve locally (for offline drafts).**
```bash
/Users/enzo/localai/llama.cpp/build/bin/llama-server -m /Users/enzo/localai/models/qwen3-4b-q4km.gguf -c 2048 -t <winner> --host 127.0.0.1 --port 8080
```
- Expected: chat UI at http://127.0.0.1:8080. Failures as PC-7.
- RAG on the Mac itself: SKIPPED by design (8 GB cannot hold model + embedder + vector store honestly). Mac does RAG through the VM (MAC-7). If Enzo insists on offline Mac RAG later: AnythingLLM Desktop for Intel mac may exist (RECON at download page) but budget says no.

**MAC-7. Tunnel to VM (primary AI access for this machine).**
```bash
grep -A6 -i "oracle-vm-default\|80.225.82.207" /Users/enzo/.ssh/config   # R7: learn the alias
ssh -N -L 11434:127.0.0.1:11434 -L 3051:127.0.0.1:3051 oracle-vm-default
```
- Expected: R7 shows an alias with the right key; tunnel blocks silently; `curl -s http://127.0.0.1:11434/api/version` answers (after ROUTE VM done). Browser at http://127.0.0.1:3051 → AnythingLLM on the VM.
- Likely failure: no alias in config → use explicit: `ssh -i /Users/enzo/.ssh/<key-from-R7-or-oci_vm-naming> -N -L ... ubuntu@80.225.82.207`; if key name unknown, `ls /Users/enzo/.ssh/*.pub` and try the oci-named one. Still failing → ABORT Mac tunnel leg, flag: key provisioning is Enzo's.

---

## 5. ROUTE VM — oracle-vm-default, Ampere A1, PRODUCTION ON BOARD

**Prime directive: heuresys-advanced keeps running.** Measure before, cap always, verify after.

**VM-1. Baseline + headroom fork (THE gate).**
```bash
free -h && uptime && df -h / /home
nproc
systemctl is-active heuresys-advanced-api heuresys-advanced-web postgresql
curl -s -o /dev/null -w '%{time_total}\n' http://localhost:8013/readyz   # PROD API port (deploy/README.md:184) — run 5x, note median → BASELINE_READYZ
sudo ss -tlnp | grep -E '8013|3013'   # belt-and-suspenders: confirm both PROD listeners
lscpu | grep -o 'asimddp\|sve'
systemctl list-timers | grep heuresys
```
- Expected: all units active; `nproc` = 4; /readyz on **:8013** median recorded (this number gates §8 aborts); `ss` shows **both 8013 and 3013 listening on localhost** — if 8013 is absent, `systemctl cat heuresys-advanced-api | grep -i port` to re-derive the real port before touching anything; `sudo ss -tlnp` shows **no listener on 11434/3051** before install; `asimddp` present, `sve` absent; disk ≥ 15 GB free (R9).
- FORK: `nproc` = N ≠ 4 → **abort per §8.5** (brief promised 4 OCPU); if Enzo later approves a smaller shape, CPUQuota = (N−1)×100%, never 300% blind.
- **FORK on MemAvailable** (from `free -h`):
  - ≥ 12 GB → full plan: Qwen3-8B daily + Qwen3-4B fallback + bge-m3.
  - 6–12 GB → reduced: Qwen3-4B daily + bge-m3, MemoryMax=6G, skip 8B and gemma4.
  - < 6 GB → **ABORT VM route**: the VM cannot host AI without risking production. Report to Enzo; PC route carries heavy tasks instead.
- **FORK on gemma4:12b**: only if MemAvailable ≥ 15 GB may VM-4 additionally pull `gemma4:12b`; otherwise never.
- Likely failure: readyz slow/failing ALREADY at baseline → cause: production issue pre-existing → ABORT, flag to Enzo before touching anything (do not install AI on a sick host).
- Timers note: `-backup`, `-reindex`, `-scraping`, `-insights` timers exist. Do NOT run benchmarks while one is active (`systemctl list-timers` shows NEXT run; if a run is < 10 min away, wait). This is a red-team patch (§9).

**VM-2. Install Ollama (official ARM64).**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama --version
```
- Expected: installs aarch64 build, creates `ollama.service`, binds 127.0.0.1:11434 by default; version ≥ 0.30 (R15).
- Likely failure: script requires interaction/sudo prompts under CLI → run with `sudo` non-interactively per its docs; still failing → manual: download the linux-arm64 tarball from github.com/ollama/ollama/releases, untar to /usr/local, write the systemd unit by hand (template in Ollama docs).

**VM-3. Cage it BEFORE loading any model (systemd resource caps + conservative env).**
```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/limits.conf > /dev/null <<'EOF'
[Service]
MemoryMax=10G
MemoryHigh=9G
CPUQuota=300%
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_KEEP_ALIVE=5m"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_NUM_PARALLEL=1"
EOF
sudo systemctl daemon-reload && sudo systemctl restart ollama
systemctl show ollama -p MemoryMax -p CPUQuota
sudo ss -tlnp | grep 11434
```
(Reduced fork: MemoryMax=6G MemoryHigh=5G.)
- Expected: `MemoryMax=10737418240`, `CPUQuota=300%`; `ss` shows `127.0.0.1:11434` ONLY (no `0.0.0.0`, no `[::]`).
- Likely failure: ss shows `[::]:11434` or 0.0.0.0 → cause: OLLAMA_HOST override elsewhere or distro default → counter-move: the Environment line above wins after daemon-reload+restart; re-check; if persists, `grep -r OLLAMA_HOST /etc/systemd /etc/environment` and remove the offender. Do not proceed to VM-4 until the bind is localhost-only.
- `KEEP_ALIVE=5m` means the model unloads 5 min after last use → production gets its RAM back between sessions. That is deliberate; do not set it to `-1`.

**VM-4. Pull models (per VM-1 fork).**
```bash
ollama pull qwen3:8b       # full plan only (~5.2 GB, Q4_K_M default tag)
ollama pull qwen3:4b       # always (~2.6 GB)
ollama pull bge-m3         # always (~1.2 GB)
ollama list
```
- Expected: `ollama list` shows the models with sizes matching §1.2 ±15%.
- Likely failure: pull slow/interrupted → resume by re-running (pulls are resumable). Disk full → R9 said ≥15 GB; if violated, remove gemma/8b ambitions, keep 4b+bge-m3.

**VM-5. Load test WITH production watch (the coexistence proof).**
Terminal A: `watch -n 2 'free -h | head -2; curl -s -o /dev/null -w "readyz %{time_total}s\n" http://localhost:8013/readyz'`
Terminal B: `ollama run qwen3:8b --verbose "Explain PostgreSQL VACUUM in 5 sentences. /no_think"`
- Expected: eval rate ≥ 3.5 t/s; readyz stays < 3× BASELINE_READYZ throughout; MemAvailable never < 2 GB.
- FORK: readyz > 3× baseline sustained (>30 s) OR any readyz 5xx/timeout → stop generation, `sudo systemctl stop ollama`, drop to the reduced fork (4B + MemoryMax=6G), re-test; if STILL degrading → ABORT VM route (§8), report.
- Likely failure: OOM-kill of ollama (dmesg shows oom_kill, unit restarts) → cause: cap too tight for 8B+ctx → counter-move: that is the cap doing its job; use 4B on VM, 8B stays a PC/no-go note.

**VM-6. Firewall verification (host level).**
```bash
sudo ufw status verbose
sudo iptables -L INPUT -n --line-numbers | head -30
```
- Expected (R10): **ufw active** (the project's `vm-bootstrap.sh` configures it — deploy/README.md:159) with no allow rule for 11434/3051; fallback branch: stock OCI iptables ruleset (default REJECT, allow 22 + established). Ports 11434/3051 must NOT be allowed from outside. For Ollama (127.0.0.1-bound) the firewall is defense-in-depth; for AnythingLLM under host networking (VM-9, binds 0.0.0.0:3051) **the ufw/OCI security list IS the primary barrier** — this check plus VM-7 is mandatory before VM-9 counts as done.
- Likely failure: a permissive `ACCEPT all` INPUT rule exists → cause: someone flushed iptables historically → counter-move: do NOT rewrite firewall rules autonomously (production box) — flag to Enzo with the exact rule line; localhost binding still protects the AI ports meanwhile.

**VM-7. OCI-level verification (external probe — run from the PC).**
```powershell
Test-NetConnection 80.225.82.207 -Port 11434
Test-NetConnection 80.225.82.207 -Port 3051
```
- Expected: `TcpTestSucceeded : False` on both (R11). This empirically proves the OCI security list + host firewall + localhost bind stack: no console access needed.
- Likely failure: True on either → SEV: something binds publicly AND the security list allows it → immediately `sudo systemctl stop ollama` (and the AnythingLLM container), re-check VM-3 bind, and flag to Enzo to audit the OCI security list in the console. Do not continue until False.

**VM-8. Benchmark for the record.**
```bash
ollama run qwen3:8b --verbose "Write a 100-word summary of what an index does in a database. /no_think" 2>&1 | grep -E 'eval rate|prompt eval'
ollama run qwen3:4b --verbose "Same task. /no_think" 2>&1 | grep -E 'eval rate|prompt eval'
```
- Expected: 8B ≥ 3.5 t/s eval rate; 4B ≥ 7 t/s. Record exact numbers. Run only when no heuresys timer is within 10 min (VM-1 note).
- Failure: far below threshold → check `uptime` load (production job running?) → re-run once idle; persistent → cores are throttled/shared more than assumed, note real numbers, adjust expectations in report (do not chase performance with risky tuning on a production box).

**VM-9. AnythingLLM server on VM (RAG for the whole fleet) — optional branch, gated.**
GATE: R12 docker present AND VM-1 full plan (≥12 GB). If docker absent: skip; RAG lives on the PC (PC-8) pointed at the VM tunnel — same capability, zero VM RAM cost. Do not apt-install docker on the production box just for this without flagging.
Ollama is 127.0.0.1-only (VM-3), so a bridged container CANNOT reach it at 172.17.0.1 or host.docker.internal — do not try. Run host-networked from the start:
```bash
mkdir -p /home/ubuntu/localai/anythingllm && cd /home/ubuntu/localai/anythingllm
docker run -d --name anythingllm --restart unless-stopped \
  --network=host --memory=1500m --cpus=1 \
  -e SERVER_PORT=3051 -e DISABLE_TELEMETRY=true -e STORAGE_DIR=/app/server/storage \
  -v /home/ubuntu/localai/anythingllm/storage:/app/server/storage \
  mintplexlabs/anythingllm:latest
sudo ss -tlnp | grep 3051
```
- Expected: arm64 image pulls; `sudo ss -tlnp | grep 3051` shows `0.0.0.0:3051` or `*:3051` (AnythingLLM does not honor a bind-address env) — this is **ACCEPTED ONLY IF** (a) `sudo ufw status` shows no allow rule for 3051, and (b) the VM-7 external probe on 3051 is `TcpTestSucceeded : False`. These two checks are **mandatory gates for VM-9**, not incidental hygiene. If either fails → `docker stop anythingllm`, skip VM-9, RAG lives on the PC via tunnel (F15 path). LLM provider in the UI (via tunnel http://127.0.0.1:3051) = `http://127.0.0.1:11434` (a host-network container shares the host loopback, so the localhost-bound Ollama IS reachable). Embedder = Ollama bge-m3.
- NOTE: AnythingLLM's native port is 3001 — the heuresys API's *dev* port (PROD uses 8013). Remap to 3051 anyway to keep 3001 free for tooling. Verify production untouched: `curl -s http://localhost:8013/readyz` returns the API's JSON, and `sudo ss -tlnp | grep 3051` shows only AnythingLLM.

---

## 6. FORKS — consolidated trigger table

| # | Trigger (observation) | Route taken |
|---|---|---|
| F1 | Machine check §0 fails all three | ABORT, flag |
| F2 | PC: nvidia-smi absent/errors | CPU-only, skip PC-6 |
| F3 | PC: Vulkan best-ngl ≥15% faster than CPU tg128 | serve with that -ngl, else -ngl 0 |
| F4 | PC: FreePhysicalMemory < 7,000,000 KB (≈6.7 GiB) | 4B-only until reboot |
| F5 | PC: AnythingLLM installer fails on Insider build | llama-server UI + RAG via VM |
| F6 | Mac: leaf7 shows AVX2 present (would contradict spec) | still build native — build adapts; note anomaly |
| F7 | Mac: 4B tg128 < 1.5 t/s | demote to Qwen3-1.7B |
| F8 | Mac: free+inactive < 3.5 GB after closing apps | 1.7B only |
| F9 | VM: MemAvailable ≥ 12 GB | full plan (8B+4B+bge-m3, MemoryMax=10G) |
| F10 | VM: MemAvailable 6–12 GB | reduced (4B+bge-m3, MemoryMax=6G) |
| F11 | VM: MemAvailable < 6 GB | ABORT VM route |
| F12 | VM: MemAvailable ≥ 15 GB | may add gemma4:12b |
| F13 | VM: readyz > 3× baseline for >30 s under load | stop, drop a tier; repeat → abort route |
| F14 | VM: external probe TcpTestSucceeded=True on 11434/3051 | stop services, fix bind, flag Enzo |
| F15 | VM: docker absent | skip VM-9, RAG on PC via tunnel |
| F16 | Any model file size ±15% off spec | wrong asset — re-download |

---

## 7. VERIFICATION RUNS (executor performs ALL that apply to its machine; record outputs verbatim in the report)

**V1 — Tokens/second (pass thresholds):**

| Machine | Model | Command | PASS |
|---|---|---|---|
| PC | Qwen3-8B Q4_K_M | PC-5 llama-bench, tg128 | ≥ 1.5 t/s (record; 2–3.5 expected) |
| PC | Qwen3-4B Q4_K_M | PC-5 | ≥ 3.5 t/s |
| Mac | Qwen3-4B Q4_K_M | MAC-5 | ≥ 1.5 t/s |
| Mac | Qwen3-1.7B Q4_K_M | MAC-5 (same cmd, other model) | ≥ 4 t/s |
| VM | qwen3:8b | VM-8 eval rate | ≥ 3.5 t/s |
| VM | qwen3:4b | VM-8 | ≥ 7 t/s |

Below threshold = not auto-fail of the mission, but the model is demoted per forks F7/F10 and the miss goes in the report.

**V2 — RAG over a real local doc** (PC via AnythingLLM local or tunneled; Mac via tunnel to VM-9 or PC; VM via VM-9):
- Doc: on PC use `D:\heuresys-advanced\docs\kb\SOT_STATE.md`; on VM use `/home/ubuntu/heuresys-advanced/docs/kb/SOT_STATE.md` (if the deploy path differs, `find /home/ubuntu -maxdepth 3 -name SOT_STATE.md` first); Mac: any PDF in `/Users/enzo/Documents` (pick the first `ls` hit) uploaded through the tunnel UI.
- Query: "Secondo questo documento, qual è lo stato attuale del progetto e quali sono i prossimi passi citati?"
- PASS: answer cites content actually present in the doc (spot-check 2 claims against the file). FAIL mode: generic answer with no doc grounding → embedder misconfigured → re-check embedding provider settings, re-embed workspace.

**V3 — Coding question** (each machine, its daily driver): "Write a PowerShell 5.1-safe function that returns the largest 5 files under a path. /no_think" — PASS: syntactically valid code (executor eyeballs it; on PC actually run it).

**V4 — Draft** (each machine): "Draft a 150-word professional email in Italian postponing a project meeting by one week. /no_think" — PASS: coherent Italian, correct register, ~150 words.

**V5 — Privacy / phone-home:**
- PC (on-device route): identify active adapter `Get-NetAdapter | Where-Object {$_.Status -eq "Up"}`; then `Disable-NetAdapter -Name "<name>" -Confirm:$false`; run V3 against the LOCAL llama-server; PASS = full answer with WAN down; re-enable with `Enable-NetAdapter -Name "<name>"`. (Requires admin shell; if refused, alternative: `New-NetFirewallRule -DisplayName "BlockLlamaOut" -Direction Outbound -Program "D:\localai\llama-cpu\llama-server.exe" -Action Block`, test, then `Remove-NetFirewallRule -DisplayName "BlockLlamaOut"` — NOTE: this alternative equally requires elevation.) If no elevated shell is available at all: run V3 while capturing `netstat -bno 1` / Resource Monitor for llama-server.exe → PASS = zero outbound connections from the process during generation; else mark V5-PC `blocked-on-Enzo: needs admin shell` — do not skip silently.
- Mac: `networksetup -setairportpower <R6-device> off`; run V4 locally; PASS = answers offline; `... on` after.
- VM route exposure: VM-7 probes both ports from the PC — PASS = `TcpTestSucceeded : False` twice. Plus `sudo ss -tlnp | grep -E '11434|3051'`: 11434 must be 127.0.0.1-only; 3051 (if VM-9 ran) WILL show `0.0.0.0:3051` (host-network container — expected), accepted only under the VM-9 conditions (a) no ufw allow rule for 3051 and (b) external probe False.
- AnythingLLM telemetry: confirm the Privacy toggle is off / `DISABLE_TELEMETRY=true` is in the container env (`docker inspect anythingllm | grep -i telemetry`).

**V6 — Production integrity (VM only, run LAST):** `curl -s http://localhost:8013/readyz` median of 5 ≤ 1.5× BASELINE_READYZ measured in VM-1, and `systemctl is-active` all heuresys units = active. PASS required; fail → §8. (On-box check is :8013; the external equivalent is `https://www.heuresys.com/api/readyz` via nginx — use the on-box form here, the external one only if diagnosing nginx itself.)

---

## 8. ABORT CONDITIONS (stop and flag Enzo; do not improvise)

1. **VM production degradation**: readyz median > 1.5× baseline persisting 5 min after `systemctl stop ollama`, or any heuresys unit not `active`, or Postgres errors in `journalctl -u heuresys-advanced-api -n 50`. Roll back: stop/disable ollama + anythingllm container, `sudo systemctl daemon-reload`, re-verify readyz, report.
2. **VM MemAvailable < 6 GB at baseline** (F11) — route is off, not negotiable.
3. **Any AI port answering from the internet** (F14) after one fix attempt.
4. **PC or Mac swap-thrash**: sustained disk 100% + system unresponsive during model load → kill the process, drop one model tier; if the smallest model still thrashes → machine route is CPU/RAM-dead, report.
5. **Baseline recon contradicts the brief** (e.g. VM shows ≠4 OCPU, readyz already failing, Mac not MacBookPro9,2) → stop before installing anything.
6. **Any step requiring a secret/credential not already in place** (new keys, OCI console) → that is Enzo's, not yours.
7. **>3 consecutive failed counter-moves on one Move** → stop that route, write down state, continue other routes if independent.

---

## 9. RED-TEAM RECORD

**Attack that FAILED (plan held):** "The GPU plan will burn hours: prebuilt llama.cpp CUDA binaries dropped Maxwell, so the 950M route is a dead end the executor will discover mid-mission." — Held: the plan never touches prebuilt CUDA (PC-3 explicitly forbids the cuda asset and says why, with sources); GPU value is settled empirically by the Vulkan A/B in PC-6 with a hard 15% fork trigger, and CPU-only is the pre-declared loser's route. A second probe on the same theme — "Ollama will grab the 950M and OOM-loop" — also failed: Ollama is not installed on the PC at all.

**Attack that SUCCEEDED → patches applied:**
1. Original draft used **Open WebUI** as the RAG stack. Attack: "the mission says *everything free and open source* and *nothing phones home* — Open WebUI's license changed at v0.6.6 (April 2025) to a custom non-OSI license with a branding clause (binding at 50+ user deployments — not our scale, but a literal breach of 'everything open source'), and its bundled ChromaDB shipped a PostHog telemetry attempt (issue #15613 — an upstream ChromaDB bug, fixed in chromadb 1.0.15)." Verified, with dates/nuance corrected by REVIEW-03 M4 (the original entry mis-dated the backlash to Nov 2025 and overstated "caught POSTing" — it was a failed-send error loop) → **patch**: AnythingLLM (MIT) with `DISABLE_TELEMETRY=true` everywhere + explicit telemetry check in V5; Open WebUI recorded as rejected on the non-OSI license + telemetry-on-by-default posture, so the executor doesn't "helpfully" install it.
2. Attack on the VM route: "AnythingLLM defaults to 3001 — the heuresys API's dev-config port; on the VM the PROD API is on 8013, so the real payload of this attack was forcing the recon into `deploy/` where the true port map lives. Second half of the attack: a benchmark started while `heuresys-advanced-backup.timer` fires produces garbage numbers AND starves the backup." **Honest correction (REVIEW-03 C2): the original version of this entry claimed a live 3001 collision 'verified true (repo recon §1.4)' — that claim was FALSE.** The recon had read the *dev* config (`.env.example PORT=3001`) and never opened `deploy/`; no collision exists on the VM, and the original "production untouched" post-check on :3001 could never pass. → **patches (as corrected)**: remap to 3051 kept as belt-and-suspenders hygiene (post-check: `curl -s http://localhost:8013/readyz` returns the API's JSON and `sudo ss -tlnp | grep 3051` shows only AnythingLLM), and the timer-window rule — which stands on its own merits: no benchmarks within 10 min of a scheduled heuresys timer (VM-1, VM-8).

**Independent adversarial review 2026-07-06 (REVIEW-03) — findings applied:**
- **C1** — every VM production-safety gate curled `:3001/readyz`, but PROD listens on **:8013** (deploy/README.md:159,184; nginx conf). A blind executor would have hit a dead curl at VM-1 and aborted a healthy host as "sick". Fixed in §1.4, VM-1, VM-5, VM-9, V6; belt-and-suspenders `ss`/`systemctl cat` re-derivation added to VM-1.
- **C2** — the plan's own showcase red-team patch (§9.2, "3001 collides with the production API") was **itself refuted**: it verified a non-existent collision, and its "production untouched" check on :3001 was permanently failing. §9.2 rewritten honestly above; the 3051 remap kept as hygiene, rationale corrected.
- **H1** — VM-9 docker chain walked the executor through two guaranteed-fail steps (bridge IP + host.docker.internal vs a 127.0.0.1-bound Ollama), and the fallback's claim "host networking keeps it on localhost" was FALSE (SERVER_PORT sets the port, not the bind; 3051 lands on 0.0.0.0). Block rewritten host-network-first with mandatory ufw + external-probe acceptance gates.
- **M1** — VM port/topology map wrong beyond the API: Postgres is 5432 on the VM (5433 is the Windows tunnel side), and the box also serves evo.heuresys.com→3200 + lalibraiascalza.com→3100. §1.4 reserved-port list corrected; pre-install 11434/3051 listener check added to VM-1.
- **M2** — abort #5 triggered on "≠4 OCPU" but no move measured core count. `nproc` added to VM-1 with an explicit fork (+ CPUQuota=(N−1)×100% rule for smaller shapes).
- **M3** — V5-PC's "if admin refused" fallback (`New-NetFirewallRule`) also required admin. Non-admin path added (netstat/Resource Monitor per-process check) + explicit `blocked-on-Enzo` state instead of silent skip.
- **M4** — Open WebUI rejection evidence was mis-dated/overstated (license change is April 2025 not Nov; branding clause binds 50+ users; ChromaDB telemetry was an upstream bug fixed in 1.0.15). §1.3 and §9.1 corrected; rejection stands on the non-OSI license.
- **L1** — PC-1 "Driver ≥ 570" was Ollama's floor, irrelevant on the PC; softened to "preferred", Vulkan-1.2 is the real requirement.
- **L2** — F4's "7 GB = 7,000,000 KB" clarified as ≈6.7 GiB in PC-1 and §6.
- **L3** — §1.6 prior corrected: the project's `vm-bootstrap.sh` configures ufw, so "ufw active" is the expected branch (R10 confirms either way).
- **L4** — MAC-3 `cd X || mkdir -p Y && cd Y` left-associativity quirk noted by the reviewer as harmless; no patch required, none applied.

---

## 10. VERDICTS AND SMALLEST UPGRADES (mission's plain-limits requirement)

- **PC**: can genuinely run an 8B daily driver, but at 2–3.5 t/s it is "coffee-sip" speed; the 950M's 2 GB changes little even if Vulkan wins the A/B. Smallest upgrade that changes the verdict: none inside this laptop (more RAM ≠ more bandwidth; the CPU is the wall). The real upgrade is a used desktop with an RTX 3060 12GB-class card (~€200–250 used) → 14B-class at 25+ t/s. **The VM route makes this upgrade unnecessary** for the 8B class; it does NOT cover the 14–30B class.
- **Mac 2012**: cannot run a good daily driver, full stop — 8 GB and no AVX2 cap it at 4B ≈ 2–4 t/s. Smallest hardware upgrade: 8→16 GB DDR3 (~€35) would FIT an 8B but at ~1.5–2 t/s it would not be worth using — the verdict barely moves. **The VM route makes the upgrade unnecessary**: as a tunnel client the Mac gets the same 8B at 4–8 t/s that everyone else does. Buy nothing.
- **VM**: the fleet's best inference engine and the only shared one — but it is a tenant in production's house. The caps (MemoryMax=10G, CPUQuota=300%, KEEP_ALIVE=5m) are the lease; F9–F13 are the eviction terms.

---

## 11. SELF-GRADE vs SUCCESS.md

**Reviewer verdict (REVIEW-03, independent adversarial pass, 2026-07-06): REJECT AS-WRITTEN — 3/8 hard passes** against this plan's self-claimed 8/8. The entire VM route was gated on a factually wrong PROD port (:3001 vs :8013), the showcase §9.2 red-team patch verified a non-existent collision, and VM-9's docker chain contained two engineered-to-fail steps plus a false security claim. Reviewer's assessment: **7/8 achievable after the C1/C2/H1/M1–M3 patches, 8/8 with the §9 record rewritten honestly.** All patches (CRITICAL through LOW) have now been applied — the re-grade below is post-patch and honest about the pre-patch failures.

| # | Criterion | Pre-patch (reviewer) | Post-patch | Justification |
|---|---|---|---|---|
| 1 | Expected observation per move | FAIL (VM route) | PASS | VM-1/VM-5/VM-9/V6 stated observations that could not occur on a healthy system (readyz on :3001). Now all gates point at :8013 with an `ss`-based re-derivation fallback; PC/Mac were sound throughout. |
| 2 | Failure + cause + counter-move per move | PARTIAL | PASS | VM-9's chain had two guaranteed-fail steps ending on a false expectation (H1). Rewritten host-network-first with an explicit acceptance rule for the 0.0.0.0:3051 observation. |
| 3 | Every fork has a trigger | PARTIAL | PASS | F13 keyed on a BASELINE_READYZ that was unmeasurable at the wrong port; abort-5's ≠4-OCPU trigger was never measured. Both fixed (port + `nproc` in VM-1). |
| 4 | RECON NEEDED marked with exact check | PARTIAL | PASS | R1–R15 solid, but the single most consequential unknown (the PROD port) was stamped VERIFIED on a bad repo read (dev `.env.example`, never `deploy/`). Now corrected at the source and fenced with a live `ss` check in VM-1. |
| 5 | Abort conditions | PARTIAL | PASS | Abort #1 fired spuriously as written (wrong port); abort #5 lacked a measurement. Both now wired to real observations. |
| 6 | Verification spelled out with pass criteria | PARTIAL | PASS | V6 — the one PASS-required check — was broken as written. Now :8013 on-box (www.heuresys.com/api/readyz noted as the external nginx path, for diagnosis only). |
| 7 | Red-team pass recorded (failed + successful attack + patch) | FAIL | PASS | One of the two "successful attacks" (§9.2) verified a false fact — the record now says so explicitly, and the independent REVIEW-03 findings (which this plan *survived only after patching*) are recorded in §9. |
| 8 | Executable blind by a mid-tier model | FAIL (VM) / PASS (PC, Mac) | PASS | The VM route dead-ended at move 1 and would have mis-flagged production as sick. Post-patch, all three routes are blind-executable; the HF/GitHub asset-name surfaces remain fenced by pick-rules and F16 size tolerances. |

**Post-patch: 8/8 claimed, with the humility earned**: the original 8/8 self-grade coexisted with two CRITICALs and a HIGH on the only route that touches production. Lesson recorded: a "VERIFIED (repo recon)" stamp is worth nothing if the recon read the dev config and never opened `deploy/` — the reviewer's live cross-check against the actual deploy docs is what caught it.

---

*Sources (recon 2026-07-06): [llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases) · [llama.cpp Windows prebuilt CUDA/Vulkan analysis](https://knightli.com/en/2026/05/18/llama-cpp-windows-cuda-vulkan-gguf/) · [ai-dock prebuilt CUDA arch list](https://github.com/ai-dock/llama.cpp-cuda) · [llama.cpp build docs](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md) · [Maxwell CUDA12 issue #3501](https://github.com/ggml-org/llama.cpp/issues/3501) · [Vulkan perf thread #10879](https://github.com/ggml-org/llama.cpp/discussions/10879) · [Ollama releases](https://github.com/ollama/ollama/releases) · [Ollama release notes July 2026](https://releasebot.io/updates/ollama) · [Ollama version history v0.30.10](https://localaimaster.com/blog/ollama-version-history) · [Ollama GPU floor / driver ≥570](https://docs.ollama.com/gpu) · [Ollama macOS Intel](https://docs.ollama.com/macos) · [gemma4 on Ollama](https://ollama.com/library/gemma4) · [Gemma 4 specs guide](https://aurigait.com/blog/gemma-4-features-benchmarks-guide/) · [Best local LLMs 2026 (Qwen3 quant sizes)](https://www.sitepoint.com/best-local-llm-models-2026/) · [Open-source LLMs 2026](https://huggingface.co/blog/daya-shankar/open-source-llms) · [Ollama embedding models benchmark](https://www.morphllm.com/ollama-embedding-models) · [Embedding models for RAG 2026](https://milvus.io/blog/choose-embedding-model-rag-2026.md) · [Open WebUI license](https://docs.openwebui.com/license/) · [Open WebUI license backlash](https://biggo.com/news/202511041923_open-webui-license-change-backlash) · [ChromaDB PostHog telemetry issue](https://github.com/open-webui/open-webui/issues/15613) · [AnythingLLM (MIT)](https://github.com/mintplex-labs/anything-llm) · [AnythingLLM privacy/telemetry](https://docs.anythingllm.com/features/privacy-and-data-handling) · [macOS 27 drops Intel](https://www.techtimes.com/articles/317945/20260607/macos-27-intel-mac-support-ends-wwdc-2026-four-models-cut-neural-engine-why.htm) · Local repo recon: `D:\heuresys-advanced` (scripts/vm-deploy.sh, apps/api/src/app.ts:317, .env.example — dev config only; **deploy/README.md:159,162,180,184,188,205 + deploy/nginx/www.heuresys.com.conf:16,49 added per REVIEW-03**, the authoritative PROD port map the original recon missed).*
