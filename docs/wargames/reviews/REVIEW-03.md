# REVIEW-03 — Adversarial review of `wargames/03-localai.md`

**Reviewer**: independent adversarial pass (did not author the plan). Date: 2026-07-06.
**Method**: full read of plan + SUCCESS.md + brief; 13 factual claims spot-checked via live web search; VM-facing claims cross-checked against the actual repo `D:\heuresys-advanced` (deploy docs, nginx conf, `.env.example`, `app.ts`); every command attacked for shell correctness and blind-executability.

---

## VERDICT

**REJECT AS-IS — NOT SAFE TO EXECUTE BLIND.** The PC and Mac routes are genuinely strong (models, sizes, CPU-flag reasoning, Vulkan A/B design all verified correct). But the entire VM route — the fleet's designated "best inference engine" and the only route touching production — is gated on a **factually wrong production port (3001 instead of 8013)**. A blind executor hits a guaranteed dead `curl` at VM-1, and per the plan's own rule ("readyz failing already at baseline → ABORT, do not install AI on a sick host") it aborts the route — or worse, reports production as sick when it is healthy. The celebrated §9 red-team patch ("AnythingLLM's 3001 collides with the production API") is founded on the same error and its verification step can never pass. Safe **after patching**: yes — the fixes are small and textual.

---

## FINDINGS

### CRITICAL

**C1 — Wrong production API port: every readyz gate points at :3001; PROD listens on :8013.**
The plan asserts (§1.4, "verified by reading D:\heuresys-advanced"): *"heuresys-advanced-api.service (Fastify, port 3001, health at GET /readyz)"* and wires `http://localhost:3001/readyz` into VM-1 (BASELINE_READYZ), VM-5 (coexistence watch), VM-9 (production-untouched check), V6 (final integrity PASS), and §8 abort #1.
**Evidence** (repo, absolute paths):
- `D:\heuresys-advanced\deploy\README.md:159` — `bash scripts/vm-bootstrap.sh # API :8013, web :3013, systemd units, ufw`
- `D:\heuresys-advanced\deploy\README.md:184` — `| **3013 / 8013** | **PROD heuresys-advanced** (web next start + API tsup), systemd heuresys-advanced-{web,api} |`
- `D:\heuresys-advanced\deploy\nginx\www.heuresys.com.conf:49` — `heuresys-advanced web (Next.js) :3013 — serves / and /api/* (Next rewrites /api → :8013)`
- `D:\heuresys-advanced\.env.example:13` — `PORT=3001` is the **dev** default, not the VM runtime.
The `/readyz` route itself is real (`apps/api/src/app.ts:317`, verified) — only the port is wrong. The plan's recon read the dev config and never opened `deploy/`.
**Consequence for a blind executor**: `curl http://localhost:3001/readyz` on the VM → connection refused → "readyz failing already at baseline" → ABORT the whole VM route on a healthy host, with a false "production issue pre-existing" flag to Enzo. Mission's centerpiece dies at move 1.
**EXACT PATCH** — global replace in §1.4, VM-1, VM-5, VM-9, V6, §8.1:
```
OLD: http://localhost:3001/readyz
NEW: http://localhost:8013/readyz
```
and in §1.4 replace:
```
OLD: `heuresys-advanced-api.service` (Fastify, **port 3001**, health at `GET /readyz` — apps/api/src/app.ts:317), `heuresys-advanced-web.service` (Next.js, **port 3000**)
NEW: `heuresys-advanced-api.service` (Fastify, **port 8013** in PROD — dev default is 3001; health at `GET /readyz`, apps/api/src/app.ts:317), `heuresys-advanced-web.service` (Next.js, **port 3013** in PROD; nginx proxies www.heuresys.com→3013, /api→8013 — deploy/README.md:159,184)
```
Add a belt-and-suspenders line to VM-1: `sudo ss -tlnp | grep -E '8013|3013'` — expected: both listening on localhost; if 8013 absent, `systemctl cat heuresys-advanced-api | grep -i port` to re-derive the real port before touching anything.

**C2 — The §9 "port-3001 collision" red-team patch is founded on a false fact, and its verification can never pass.**
§9.2 and VM-9 claim the AnythingLLM default port 3001 *"collides with the production API"* and mandate the check *"verify production untouched: `curl -s http://localhost:3001/readyz` still answers with the API's JSON, not AnythingLLM"*. On the VM, **nothing listens on 3001** (PROD API is 8013, C1). The 3051 remap is harmless hygiene and should stay, but:
(a) the "verified true (repo recon §1.4)" claim in the red-team record is **false** — SUCCESS.md #7 requires a *survived* red-team pass, and one of its two "successful attacks" verified the wrong thing;
(b) the VM-9 post-check is a **permanently failing verification**: host 3001 answers nothing (with `-p 127.0.0.1:3051:3001` the host side is 3051), so the blind executor concludes production broke and enters the §8 rollback loop on a healthy system.
**EXACT PATCH** — VM-9 NOTE:
```
OLD: NOTE the port trap: AnythingLLM's native port is 3001 = heuresys API. Never map without remapping (§9 patch). Verify production untouched: `curl -s http://localhost:3001/readyz` still answers with the API's JSON, not AnythingLLM.
NEW: NOTE: AnythingLLM's native port is 3001 — the heuresys API's *dev* port (PROD uses 8013). Remap to 3051 anyway to keep 3001 free for tooling. Verify production untouched: `curl -s http://localhost:8013/readyz` returns the API's JSON, and `sudo ss -tlnp | grep 3051` shows only AnythingLLM.
```
And rewrite §9.2's first sentence to: "AnythingLLM defaults to 3001 — the heuresys API's dev-config port; on the VM the PROD API is on 8013, so the real payload of this attack was forcing the recon into `deploy/` where the true port map lives."

### HIGH

**H1 — VM-9 docker networking chain: the primary instruction is guaranteed-fail by the plan's own VM-3, the first counter-move also fails, and the working fallback carries a false security claim.**
- Primary: *"LLM provider = Ollama at `http://172.17.0.1:11434`"*. VM-3 has just forced `OLLAMA_HOST=127.0.0.1:11434` and refuses to proceed until `ss` shows localhost-only. A 127.0.0.1-bound listener is unreachable from the docker bridge at 172.17.0.1 — this is not a "likely failure", it is a certainty the plan itself engineered two moves earlier.
- Counter-move 1: `--add-host=host.docker.internal:host-gateway` resolves to the same bridge-gateway IP — **also guaranteed-fail** against a 127.0.0.1 bind.
- Counter-move 2 (`--network=host` + `SERVER_PORT=3051`) works, but the plan claims *"host networking keeps it on localhost since AnythingLLM binds per SERVER_PORT"* — **false**: `SERVER_PORT` sets the port, not the bind address; AnythingLLM's node server listens on 0.0.0.0, so 3051 lands on all interfaces, protected only by ufw + the OCI security list. The plan's own `ss` re-verify would surface `0.0.0.0:3051`, and there is no counter-move written for that observation — a blind executor is stranded between "re-verify with ss" and an expected value that cannot occur.
**EXACT PATCH** — replace the VM-9 likely-failure paragraph with:
```
Ollama is 127.0.0.1-only (VM-3), so a bridged container CANNOT reach it at 172.17.0.1 or host.docker.internal — do not try. Run host-networked from the start:
docker run -d --name anythingllm --restart unless-stopped \
  --network=host --memory=1500m --cpus=1 \
  -e SERVER_PORT=3051 -e DISABLE_TELEMETRY=true -e STORAGE_DIR=/app/server/storage \
  -v /home/ubuntu/localai/anythingllm/storage:/app/server/storage \
  mintplexlabs/anythingllm:latest
Expected: `sudo ss -tlnp | grep 3051` shows `0.0.0.0:3051` or `*:3051` (AnythingLLM does not honor a bind-address env) — this is ACCEPTED ONLY IF (a) `sudo ufw status` shows no allow rule for 3051, and (b) the VM-7 external probe on 3051 is TcpTestSucceeded:False. If either fails → `docker stop anythingllm`, skip VM-9, RAG lives on the PC via tunnel (F15 path). LLM provider in the UI = http://127.0.0.1:11434 (host-network container shares the host loopback, so the localhost-bound Ollama IS reachable).
```

### MEDIUM

**M1 — Port/topology map of the VM is wrong beyond the API: Postgres and co-tenant sites.**
§1.4: *"PostgreSQL 16 on port 5433 (.env.example:28)"* and *"Reserved ports on VM: 3000, 3001, 5433, 22"*. Reality: on the VM Postgres listens on **5432 localhost** (`deploy/README.md:162,188`); 5433 is the **Windows-side tunnel port** (`README.md:205`). And the VM is not a two-tenant box: nginx also serves `evo.heuresys.com→3200` and `lalibraiascalza.com→3100` (`deploy/README.md:180`) — two more production sites the "production watch" never mentions. No AI port collides (11434/3051 are clear), so this is not fatal, but a plan that got the reserved-port list wrong once already cannot afford a second stale map.
**PATCH** §1.4: `Reserved ports on VM: 22, 80, 443, 3013, 8013, 3100, 3200, 5432. AI stack uses 11434 (Ollama) + 3051 (AnythingLLM), localhost-bound.` Add to VM-1 expected: "`sudo ss -tlnp` shows no listener on 11434/3051 before install."

**M2 — Abort condition 5 triggers on "VM shows ≠4 OCPU" but no move ever measures the core count.**
VM-1 checks `free`, `uptime`, `df`, `lscpu | grep -o 'asimddp\|sve'` — the grep discards everything except two flags. A blind executor can never observe the ≠4-OCPU trigger. Also, `CPUQuota=300%` on a downsized 2-OCPU shape would hand the AI stack 150% of the machine.
**PATCH** — add to VM-1: `nproc` → expected `4`; FORK: `nproc` = N ≠ 4 → abort per §8.5 (brief promised 4 OCPU); if Enzo later approves a smaller shape, CPUQuota = (N−1)×100%.

**M3 — V5 privacy test (PC): the fallback offered "if admin is refused" also requires admin.**
`Disable-NetAdapter` needs an elevated shell (plan says so) — but the offered alternative `New-NetFirewallRule` **equally requires elevation**, so the branch "if refused → firewall rule" dodges nothing. A non-admin executor has no executable path through V5-PC.
**PATCH** — append to V5-PC: "If no elevated shell is available at all: run V3 while capturing `netstat -bno 1` / Resource Monitor for llama-server.exe → PASS = zero outbound connections from the process during generation; else mark V5-PC `blocked-on-Enzo: needs admin shell` — do not skip silently."

**M4 — Open WebUI rejection: right verdict, overstated/mis-dated evidence.**
Verified: the license DID change at v0.6.6 with a branding clause (docs.openwebui.com/license; HN/Lobsters debate) — but the change is **April 2025**, not "community backlash Nov 2025", and the branding clause binds only **50+ user deployments**, which Enzo's single-user fleet never hits. The ChromaDB/PostHog telemetry issue #15613 is real (opened July 2025) but was an upstream ChromaDB bug **fixed in chromadb 1.0.15** — "caught POSTing telemetry" overstates a failed-send error loop. The rejection still stands on the mission's literal "everything open source" clause (non-OSI license), so no route change — but §1.3/§9.1 should carry the accurate dates and the 50-user nuance, or the red-team record fails SUCCESS #7 on evidence quality a second time.
**PATCH** §1.3: "license changed at v0.6.6 (April 2025) to a custom non-OSI license with a branding clause (binding at 50+ users — not our scale, but it breaks the mission's 'everything open source' literal requirement); bundled ChromaDB shipped a PostHog telemetry attempt (issue #15613, fixed upstream in chromadb 1.0.15) — telemetry-on-by-default posture is the disqualifier, not an active leak."

### LOW

**L1 — PC-1 expects "Driver ≥ 570"** — that floor is Ollama's requirement for CC 5.0–6.2 (docs.ollama.com/gpu, verified) and Ollama is never installed on the PC. An executor seeing driver 552 would record a spurious expectation-miss; llama.cpp Vulkan needs only a Vulkan-1.2-capable driver. Patch: "Driver ≥ 570 preferred (last Maxwell branch is 580); any Vulkan-1.2 driver is enough for the PC-6 A/B."
**L2 — F4 defines 7 GB as 7,000,000 KB** (= 6.67 GiB). Harmless because the number is explicit, but say "≈6.7 GiB" to stop a pedantic executor from recomputing.
**L3 — §1.6/R10 says "OCI Ubuntu images usually use iptables, ufw maybe absent"** — the project's own `vm-bootstrap.sh` configures **ufw** (`deploy/README.md:159`). R10's check catches it either way; update the prior so the expected branch is "ufw active".
**L4 — MAC-3 first line** `cd X || mkdir -p Y && cd Y` re-runs `cd` twice on success (left-assoc `||`/`&&`); harmless, works in both branches — noted, no patch required.

---

## SPOT-CHECK OUTCOMES (13 claims, live web + repo, 2026-07-06)

| # | Plan claim | Outcome | Source |
|---|---|---|---|
| 1 | llama.cpp prebuilt CUDA min CC 7.5, Maxwell out | **CONFIRMED** | [knightli.com b9196 analysis](https://knightli.com/en/2026/05/18/llama-cpp-windows-cuda-vulkan-gguf/), [ai-dock/llama.cpp-cuda](https://github.com/ai-dock/llama.cpp-cuda) (CC 7.5+ arch list) |
| 2 | Vulkan prebuilt runs Maxwell; 980M in perf thread | **CONFIRMED** (980M @ ~23.9 t/s tg128, 7B Q4_0) | [llama.cpp discussion #10879](https://github.com/ggml-org/llama.cpp/discussions/10879) |
| 3 | Ollama ~v0.30.x July 2026, Linux ARM64 official | **CONFIRMED** (v0.30.8 June 12; v0.30.10 cited; engine synced to llama.cpp b9840) | [releasebot.io/updates/ollama](https://releasebot.io/updates/ollama), [localaimaster version history](https://localaimaster.com/blog/ollama-version-history) |
| 4 | Ollama NVIDIA floor CC 5.0+, driver ≥570 for 5.0–6.2 | **CONFIRMED** | [docs.ollama.com/gpu](https://docs.ollama.com/gpu) |
| 5 | Open WebUI v0.6.6+ non-OSI license w/ branding clause | **CONFIRMED, dates/nuance off** (Apr 2025 change; clause binds 50+ users) — see M4 | [docs.openwebui.com/license](https://docs.openwebui.com/license/), [HN thread](https://news.ycombinator.com/item?id=43901575) |
| 6 | Open WebUI bundled ChromaDB PostHog telemetry issue #15613 | **CONFIRMED, overstated** (failed-send bug, fixed chromadb 1.0.15) | [open-webui#15613](https://github.com/open-webui/open-webui/issues/15613) |
| 7 | AnythingLLM MIT + `DISABLE_TELEMETRY=true` + default port 3001 | **CONFIRMED** (all three) | [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm), [docs.anythingllm.com cloud-docker](https://docs.anythingllm.com/installation-docker/cloud-docker) |
| 8 | Qwen3-8B Q4_K_M ~5.0–5.5 GB | **CONFIRMED** (5.03 GB) | [Qwen/Qwen3-8B-GGUF](https://huggingface.co/Qwen/Qwen3-8B-GGUF) |
| 9 | Qwen3-4B ~2.5–3.0 GB / Qwen3-1.7B ~1.1–1.4 GB (ASSUMED) | **CONFIRMED** (2.5 GB / 1.11 GB) | [Qwen/Qwen3-4B-GGUF](https://huggingface.co/Qwen/Qwen3-4B-GGUF), [unsloth/Qwen3-1.7B-GGUF](https://huggingface.co/unsloth/Qwen3-1.7B-GGUF) |
| 10 | nomic-embed-text 274 MB / bge-m3 ~1.2 GB on Ollama | **CONFIRMED** | [ollama.com/library/nomic-embed-text](https://ollama.com/library/nomic-embed-text), [ollama.com/library/bge-m3](https://ollama.com/library/bge-m3) |
| 11 | i7-3520M: AVX yes, AVX2 no (F16C rebuild flag valid) | **CONFIRMED** (Ivy Bridge: AVX+F16C, AVX2 is Haswell+) | [TechPowerUp i7-3520M](https://www.techpowerup.com/cpu-specs/core-i7-3520m.c1084), [cpu-world](https://www.cpu-world.com/CPUs/Core_i7/Intel-Core%20i7-3520M%20(PGA)%20Mobile%20processor.html) |
| 12 | Qwen3 `/no_think` soft switch; `gemma4:12b` tag on Ollama | **CONFIRMED** (both; gemma4 library live with e2b/e4b/12b/26b/31b) | [QwenLM discussion #1329](https://github.com/QwenLM/Qwen3/discussions/1329), [ollama.com/library/gemma4:12b](https://ollama.com/library/gemma4:12b) |
| 13 | VM 8B expectation 4–8 t/s, threshold ≥3.5 | **CONFIRMED-realistic** (A1 4-OCPU community: ~5–8 t/s Ollama 7B Q4; note CPUQuota=300% = 3 cores → expect the low end) | [Oracle A1 Llama3 blog](https://blogs.oracle.com/ai-and-datascience/post/introducing-meta-llama-3-on-oci-ampere-a1), [tiffena.me A1 comparison](https://tiffena.me/blog/local-llm-inference-ampere-a1-linux/) |
| — | **"port 3001 = PROD API on VM" (§1.4, §9.2)** | **REFUTED** — PROD API :8013, web :3013, Postgres :5432 | `D:\heuresys-advanced\deploy\README.md:159,184,162,188`; `deploy\nginx\www.heuresys.com.conf:16,49` |

Command-level audit not repeated in table: PS 5.1 syntax on PC route clean (absolute paths, no PS7-isms, no bare cmd.exe; `Invoke-WebRequest`, `Get-CimInstance`, `Test-NetConnection`, `Expand-Archive` all 5.1-native); SSH key path matches `C:\Users\enzospenuso\.ssh\oci_recovery_ed25519` → `ubuntu@80.225.82.207` per the global SoT; Mac route zsh/`/usr/local` correct; `llama-bench -t 2,4` and `-ngl 0,6,10,14` comma-lists valid; systemd drop-in syntax (`MemoryMax=10G`, `MemoryHigh=9G`, `CPUQuota=300%`, `Environment=`) valid for Ubuntu 24.04 cgroup-v2; 10G cap vs 24 GB total with 4–7 GB production resident leaves ≥7 GB slack — arithmetic sound *given* the 24 GB shape (see M2 for the smaller-shape hole).

---

## INDEPENDENT GRADE vs SUCCESS.md

| # | Criterion | Grade | Why |
|---|---|---|---|
| 1 | Expected observation per move | **FAIL (VM route)** | VM-1/VM-5/VM-9/V6 state observations that cannot occur on a healthy system (readyz on :3001). PC/Mac routes: pass. |
| 2 | Failure+cause+counter per move | **PARTIAL** | Structure is exemplary, but VM-9's counter-move chain contains two guaranteed-fail steps and ends on a false expectation (H1). |
| 3 | Every fork has a trigger | **PARTIAL** | Triggers are admirably numeric, but F13 keys on BASELINE_READYZ which is unmeasurable at the wrong port, and abort-5's ≠4-OCPU trigger is never measured (M2). |
| 4 | RECON NEEDED marked with exact check | **PARTIAL** | R1–R15 is genuinely good; but the single most consequential unknown (the PROD port) was stamped VERIFIED on a bad repo read instead of being fenced with a live check. |
| 5 | Abort conditions | **PARTIAL** | Seven, well-chosen — abort #1 fires spuriously as written (wrong port). |
| 6 | Verification spelled out | **PARTIAL** | V1–V5 are concrete and passable; V6 (the one PASS-required check) is broken as written. |
| 7 | Red-team pass recorded | **FAIL** | Recorded, yes — but one of the two "successful attacks" (§9.2) verified a false fact, and the review standard is *survived* a red-team pass, not *performed* one. |
| 8 | Blind-executable | **FAIL (VM route) / PASS (PC, Mac)** | PC/Mac would run end-to-end blind. The VM route dead-ends at move 1 and mis-flags production. |

**Independent score: 3/8 hard passes as written** (2 with strictness on criterion 3) vs the plan's self-graded 8/8. After the C1/C2/H1/M1–M3 patches, criteria 1–6 and 8 flip to pass and the score becomes 7/8 (criterion 7 needs the §9 record rewritten honestly, per the C2 patch, to reach 8/8).

---

## TOP 3 DANGERS

1. **C1** — every production-safety gate on the VM curls a port nothing listens on (:3001 vs :8013): the blind executor aborts the flagship route and falsely reports production sick.
2. **C2** — the plan's proudest red-team patch verifies a collision that doesn't exist, and its "production untouched" check can never pass → §8 rollback loop on a healthy host.
3. **H1** — VM-9's docker instructions walk the executor through two engineered-to-fail steps, then land on a fallback whose stated security property ("keeps it on localhost") is false — 3051 opens on 0.0.0.0 with only ufw/OCI between it and the internet.

**Safe after patching: YES** — all criticals are textual (port numbers, one docker run block, one honest rewrite of §9.2); no architectural rework needed. The PC and Mac routes and the model/quantization/threshold layer are verified sound and should ship as-is.
