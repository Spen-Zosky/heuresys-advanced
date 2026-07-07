WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on the target machine) runs the brief below later. Your job is the route it will follow.

Recon first, read-only: the machine specs below (already gathered), and the current releases of every tool you plan to recommend.

Then fight the mission on paper, move by move, and write it to wargames/03-localai.md:

- every move states its expected observation, exactly what you should see if it worked
- every move carries its most likely failure, the cause it signals, and the counter-move
- every fork gets a trigger, if you observe X, take route B
- assumptions recon could not settle get marked RECON NEEDED with the exact check that settles it
- end with abort conditions, and the verification runs the executor must perform with what pass looks like for each

Write it so the executor can run the brief end to end without asking a single question.

=== THE MISSION BRIEF (the executor's orders, not yours) ===

I want a fully local, open source AI setup, private by default, nothing leaves my machines. This is a MULTI-MACHINE wargame: the plan forks per machine, and the executor takes the route for whichever machine it runs on. My fleet (specs verified 2026-07-06):

1. **PC Windows** (primary, DESKTOP-KH728P2): Windows 11 Pro Insider, Intel i7-7500U (2C/4T @2.7GHz), 16 GB RAM, NVIDIA GTX 950M 2GB (Maxwell — old CUDA compute 5.0) + Intel HD 620, disks C: 617GB free / D: 474GB free. Shell PowerShell 5.1 (PS7 available).
2. **Mac** (mac-local, 192.168.1.4): MacBook Pro Mid-2012, i7 2.9GHz dual-core, 8 GB RAM, no dGPU, macOS 15.7 via OpenCore Legacy Patcher, Homebrew at /usr/local (Intel path), 447GB disk. Docker Desktop installed. Weak: editing/SSH machine.
3. **VM OCI ARM** (oracle-vm-default, 80.225.82.207): Oracle Free Tier eu-milan-1, Ubuntu 24.04 ARM64 (Ampere), up to 4 OCPU / 24 GB RAM. No GPU. Accessible from PC and Mac via SSH (keys in place) and SSHFS from Mac. NOTE: already runs the heuresys-advanced production stack (PostgreSQL 16, API, web) — the AI setup MUST NOT starve it; budget RAM/CPU explicitly and set the fork trigger on available headroom.

My use cases: private doc chat (RAG over local documents — embedding model required), coding help, first drafts of emails/docs/reports. Patience for tinkering: HIGH. "Private" means my-control: the VM counts as local (my tenancy), but nothing goes to third-party APIs.

Per machine, pick the runtime justified against the hardware (llama.cpp / Ollama / LM Studio or alternatives — current releases, verify ARM64 support for the VM), the exact models with exact quantizations that fit the memory (one daily driver, one small fast fallback, one embedding model), context length and offload settings (the 950M 2GB: measure whether partial offload beats CPU-only before committing). For the VM, include a cross-machine access route (SSH tunnel from PC/Mac to the VM's inference server, bound to localhost, never exposed publicly).

Verify end to end per machine: test prompt on each model with tokens/second measured; each use case exercised once (one RAG query over a real local doc, one coding question, one draft); confirm nothing phones home — works with WAN blocked for on-device routes, and for the VM route confirm the inference port is not internet-exposed (check OCI security list + ufw).

Everything free and open source. Be plain about limits: if a machine cannot run a good daily driver, say so and name the smallest upgrade that changes it (and whether the VM route makes the upgrade unnecessary).
