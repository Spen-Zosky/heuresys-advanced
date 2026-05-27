# SOT_BACKLOG — Azioni da riprendere (CLI-owned)

> Pendings + azioni nuove/programmate da cui il CLI riprende il consolidamento e lo sviluppo, in autonomia. Sintesi da: handover Cowork S937, `STATE.md`, `MVP_4_ROADMAP.md`, ricognizione forense S939. Debiti tecnici in `DEBT_REGISTER.md`; stato in `SOT_STATE.md`.
> **Aggiornato**: 2026-05-27 (S939).

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
| **B-22** | #6 | react-i18next 15→17 | medio | apps/web i18n; verificare parity check. |
| **B-23** | #1 | next (major) | alto | conflicting + CVE-hold; verificare impatto RSC/showcase (CW-B59 area). |
| **B-24** | #14/#15/#16 | setup-node 6 / action-setup 6 / gh-pages 4 | basso | CI actions; test su workflow showcase + self-hosted. |
| **B-25** | — | **Churn defer-major** | basso | Le 7 PR `defer-major` auto-rebasano e ri-triggerano CI ad ogni move di main → candidata condition `skip defer-major`/paths nei 6 workflow. |
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
| **B-43** | CW-B41 | xos_lib piped psql COPY drops sync su Win Git Bash — library update | `db/scripts/_lib/cross_os_pipeline.sh`. |

## Candidati MVP-4 futuri (da MVP_4_ROADMAP.md — decisione Enzo)

- stream 2.1 Brownfield Wave 2 · 2.5 MFA multi-kind · 2.7 Mobile + WCAG · visualization renderers (React Flow/Mermaid — gated brand, vedi memory `feedback_brand_before_graph_renderers`).

---

**Regola d'ingaggio CLI autonomo**: ogni azione P1+ parte da un mini-piano evidence-based (grep/read reali, non assunzioni) + atomic commit + test verde + aggiornamento di questo backlog e `SOT_STATE.md`. Nessun push senza ok Enzo. Conflitto con invarianti (§9 SOT_STATE) → fermarsi e chiedere.
