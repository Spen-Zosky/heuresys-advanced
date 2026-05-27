# SOT_BACKLOG — Azioni da riprendere (CLI-owned)

> Pendings + azioni nuove/programmate da cui il CLI riprende il consolidamento e lo sviluppo, in autonomia. Sintesi da: handover Cowork S937, `STATE.md`, `MVP_4_ROADMAP.md`, ricognizione forense S939. Debiti tecnici in `DEBT_REGISTER.md`; stato in `SOT_STATE.md`.
> **Aggiornato**: 2026-05-27 (S939; + verifica stato evidence-based pre-resolution).

## ✅ Verifica stato 2026-05-27 (evidence-based, pre-resolution)

> Accertamento reale di ogni item aperto (grep/read/DB/gh), per ripartire informati. Nessun fix applicato qui (solo D-12 migrate.sh chain + 000044 reclass eseguiti come task isolato approvato, vedi DEBT_REGISTER).

| Item | Stato verificato | Evidenza | Scope residuo reale |
|---|---|---|---|
| **B-01 / D-01** | ✅ **FATTO** 2026-05-28 | CLAUDE.md §"What this is"+architecture+migrations allineati a MVP-4 (Fastify 5, ~58 moduli, web shipped, 43 mig, +showcase, puntatore SoT viva); README header→state S940 + 43 mig. README NON era a MVP-1 (solo CLAUDE.md). | — |
| **B-02** | 🟢 quasi fatto | `docs/kb/tools/sync.sh` + `graphify-out/` presenti | verificare vault wiki esterno `heuresys-advanced-wiki` |
| **B-03 / D-08** | ✅ FATTO | `docs/kb/COWORK_ARCHIVE_NOTE.md` + SoT docs/kb completa (SOT_STATE/BACKLOG/DEBT_REGISTER/INDEX_PATHS/COWORK_INBOX/integrations/tools) | — |
| **B-10** | 🟡 APERTO (intatto) | ADR-0014 **PROPOSED**; `000036_temp_sdbi_schema.sql` presente; **source HR assente da legacy_mirror, platform 0-row** → i dati esistono nel dump `heuresys_platform_0507` (VM `/home/ubuntu/heuresys-evo/backups/local/`, ~367MB i primi maggio) | piano CLI-owned; per dati: restore dump→mirror legacy_mirror→SDBI; legato zod4 |
| **B-20** (#3) | 🔴 APERTO | `zod 3.25.76`; ~101 file, heavy `.datetime()`/`z.record()`/`z.coerce` | upgrade alto rischio, accoppiato B-21 |
| **B-21** (#5) | 🔴 APERTO | `fastify-type-provider-zod 4.0.2` | accoppiato a zod4; compiler/transform breaking 4→6 |
| **B-22** (#6) | ✅ **FATTO** 2026-05-28 | `react-i18next 15.4.0→17.0.8` + `i18next 23.16.8→26.3.0` (peer richiedeva i18next≥26.2). Uso basilare (init+Provider+useTranslation), 0 plural keys → smooth. typecheck+i18n parity+build web verdi. | chiude PR #6 |
| **B-23** (#1 next) | ⚪ **STALE/CHIUSO** | nessuna PR `next` aperta; `next@15.5.18` | **rimuovere dal backlog** |
| **B-24** | 🟢 **quasi fatto** | `checkout/setup-node/action-setup` già **@v6** (#14/#15 chiuse); resta solo `peaceiris/actions-gh-pages@v3` in showcase.yml | solo **PR #16** gh-pages 3→4 |
| **B-25 / D-09** | ✅ **FATTO** 2026-05-28 | condition `if: !contains(...labels...'defer-major')` aggiunta ai 6 workflow `pull_request`; push a main non impattato; YAML validato | — |
| **B-30** | 🟢 aperto (infra) | solo OCI VM runner | backup runner Windows |
| **B-31** | 🟡 aperto (infra) | — | ssh-agent persistence cross-session |
| **B-40** (CW-B39) | ⚪ **rivalutato** | `sys.sys_learning_path_steps` **VUOTA (0 righe)**; le 688 righe null `learning_path_step_path_id` erano source/staging-side | forensic source-side solo se si persegue |
| **B-41** (CW-B45) | deferito | — | SDBI Phase 4 |
| **B-42** (CW-B50) | 🟢 **reclass FATTO** | 3 target = REFERENCE_ONLY (via 000044/D-12, 2026-05-27) | resta solo "correct target authoring" (deferito) |
| **B-43** (CW-B41) | ✅ **FATTO** 2026-05-28 (validazione funzionale gated a B-10) | `xos_restore_legacy_mirror` ora dump→tempfile→`psql -f` (no pipe) nei 2 step DDL+DATA; applica il workaround validato REPORT 010 §5.a. bash -n + smoke + mktemp cross-OS OK | run reale gated a B-10 (lib non esercitata da script attivi) |
| Dependabot **alerts** | ✅ 0 aperti | `gh api .../dependabot/alerts` | — |

**Sintesi per la fresh session**: realmente da fare = **B-01** (P0 doc drift), **B-10** (SDBI, intatto), **B-20+B-21** (zod4 accoppiato), **B-22** (i18next), **B-24→solo #16** (gh-pages), **B-31/B-43** (infra/lib), **B-42** (target authoring). **Chiusi/stale**: B-01/D-01 (fatto 2026-05-28), B-03/D-08 (fatto), B-23 (stale), B-26 (risolto), D-12 (risolto), **D-04 root cleanup + B-25/D-09 defer-major CI skip (fatti 2026-05-28)**. **Da chiarire**: B-02 (vault esterno), B-40 (source-side), B-41 (Phase 4).

## P0 — Consolidamento immediato (questa fase, prima di nuovo sviluppo)

| ID | Azione | Effort | Note |
|---|---|---|---|
| **B-01** | Rimediare doc drift `CLAUDE.md` + `README.md` (stato MVP-1 → realtà MVP-4) | ~30-45min | Vedi `DEBT_REGISTER.md` D-01. Bloccante per onboarding corretto di sessioni future. |
| **B-02** | Completare Plan 2 (integrazione LLM-Wiki + graphify, ingestion indice) | in corso | Skill linked-sources + vault `heuresys-advanced-wiki` + grafo. |
| **B-03** | Congelare archivio Cowork + pubblicare policy bias post-Cowork | ~15min | `COWORK_ARCHIVE_NOTE.md`; numerazione CW-B continua in `docs/kb/`. |

## P1 — Sviluppo programmato (deciso da Enzo)

| ID | Azione | Effort | Entry point |
|---|---|---|---|
| **B-10** | **MVP-4 stream 2.4 — SDBI Phase 2** (Semantic-Driven Brownfield Import, kickoff) | ~6-10h | `cowork_code_exchange/_01_PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md` (archivio); contesto `_00_HANDOVER_CLI_2026-05-26_post_S937.md`. Migration base `000036_temp_sdbi_schema.sql`. **NB**: legato a zod4 (B-20). Riformulare il PROMPT 027 come piano CLI-owned diretto (non più protocollo Cowork). |

## P2 — Dependabot / dipendenze (audit breaking-changes)

| ID | PR | Pacchetto | Rischio | Note |
|---|---|---|---|---|
| **B-20** | #3 | zod 3→4 | alto | Legato a stream 2.4; tutta la contract layer (`packages/shared` + fastify-type-provider-zod). Audit + migration dedicata. |
| **B-21** | #5 | fastify-type-provider-zod 4→6 | alto | Accoppiato a zod4 (B-20) — valutare insieme. |
| ~~**B-22**~~ | #6 | ~~react-i18next 15→17~~ | medio | ✅ **FATTO 2026-05-28**: +i18next 23→26 (peer). 3 file consumatori, uso basilare, 0 plural keys. typecheck+parity+build web verdi. |
| **B-23** | #1 | next (major) | alto | conflicting + CVE-hold; verificare impatto RSC/showcase (CW-B59 area). |
| **B-24** | #14/#15/#16 | setup-node 6 / action-setup 6 / gh-pages 4 | basso | CI actions; test su workflow showcase + self-hosted. |
| ~~**B-25**~~ | — | ~~**Churn defer-major**~~ | basso | ✅ **FATTO 2026-05-28**: condition `if: !contains(github.event.pull_request.labels.*.name, 'defer-major')` sui 6 workflow `pull_request`. Le PR defer-major non triggerano più CI sul runner singolo; push a main intatto. |
| ~~**B-26**~~ | #78 | ~~`tmp` <0.2.6 path-traversal~~ | — | ✅ **RISOLTO S939** (`6aa0b79`): transitivo via exceljs → pnpm override `exceljs>tmp >=0.2.6` → 0.2.7. NON era un major deferito. |

## P3 — Infra / robustezza

| ID | Azione | Note |
|---|---|---|
| **B-30** | Backup runner Windows | DEFERRED da S935-F; oggi solo OCI VM runner. Ridondanza CI. |
| **B-31** | ssh-agent persistence cross-session (CW-B62) | Eliminare il manual-launch passphrase: service-account key dedicata CI no-passphrase (richiede ADR per security trade-off) OR documentare flusso stabile. |

## P4 — Bias residui ereditati (da bias_registry.md, ora archive)

| ID | Bias | Stato ereditato | Azione |
|---|---|---|---|
| **B-40** | CW-B39 | nk_missing learning_path_step path_id 688 rows — pending forensic | Valutare in SDBI Phase 2/Wave 2. |
| **B-41** | CW-B45 | source-vs-target CHECK delta — pending engine improvement | SDBI Phase 4. |
| **B-42** | CW-B50 | reclass IMPORT→REFERENCE_ONLY; correct target authoring deferred | Batch dedicato (era C13). |
| ~~**B-43**~~ | CW-B41 | ✅ **FATTO 2026-05-28**: xos_lib ora file-based (dump→tempfile→`psql -f`), no pipe. bash -n+smoke+mktemp cross-OS OK. Validazione funzionale gated a B-10 (lib non ancora esercitata). | `db/scripts/_lib/cross_os_pipeline.sh`. |

## Candidati MVP-4 futuri (da MVP_4_ROADMAP.md — decisione Enzo)

- stream 2.1 Brownfield Wave 2 · 2.5 MFA multi-kind · 2.7 Mobile + WCAG · visualization renderers (React Flow/Mermaid — gated brand, vedi memory `feedback_brand_before_graph_renderers`).

---

**Regola d'ingaggio CLI autonomo**: ogni azione P1+ parte da un mini-piano evidence-based (grep/read reali, non assunzioni) + atomic commit + test verde + aggiornamento di questo backlog e `SOT_STATE.md`. Nessun push senza ok Enzo. Conflitto con invarianti (§9 SOT_STATE) → fermarsi e chiedere.
