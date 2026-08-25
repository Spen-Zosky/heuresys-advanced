# Censimento della documentazione — heuresys-advanced

**Data**: 2026-08-25
**Perimetro**: intero repository, sola lettura.

## Comandi di enumerazione

```bash
# Enumerazione primaria (md/mdx/rst/adoc), esclusi meccanicamente node_modules/.next/dist/.git/coverage/playwright-report/.turbo/build
find . -type d \( -name node_modules -o -name .next -o -name dist -o -name .git -o -name coverage \
  -o -name playwright-report -o -name .turbo -o -name build \) -prune -o \
  -type f \( -name "*.md" -o -name "*.mdx" -o -name "*.rst" -o -name "*.adoc" \) -print | sort
# → 11317 file (include graphify-out/ e graphify-db-input/, generati, vedi Esclusioni)

# Elenco definitivo dopo la rimozione delle directory generate aggiuntive trovate
# (graphify-out/, graphify-db-input/, docs/source_bundle/brownfield/extracted/, .cache/)
# → 1237 file: l'universo di lavoro di questo censimento
```

**Conteggio totale enumerato (fase A, primario)**: **11317** file `.md/.mdx/.rst/.adoc` col solo pruning meccanico richiesto.
**Conteggio dopo le esclusioni aggiuntive per generazione automatica** (dichiarate per intero in §Esclusioni): **1237** file — questo è l'universo su cui sono state applicate Fase B (lettura) e Fase D (esclusioni/non-lette-per-volume).
**File letti individualmente e digerito prodotto in questo documento**: **381**.
**File in directory dichiarate NON LETTE PER VOLUME** (11 directory, elencate con comando e conteggio in §Directory non lette per volume): **856**.
381 + 856 = 1237.

Verifica aritmetica dei bucket:
- Mecccanici espliciti nell'incarico (node_modules, .next, dist, .git, coverage, playwright-report, .turbo, build): dichiarati sotto con i loro conteggi reali (node_modules 2627, dist 428, build 2, .next/coverage/playwright-report/.turbo 0 ciascuno) — **non fanno parte** dei due numeri sopra, sono un pruning separato eseguito a monte della prima enumerazione.
- tsbuildinfo (non doc, ma menzionato nell'incarico): 4 file, dichiarati.

## Tabella del censimento completo (Fase A — tutti i 1237 file dell'universo di lavoro)

> path (dalla radice del repo) · dimensione in byte · data ultima modifica (`git log -1 --format=%cd`, o `non-tracciato (mtime filesystem)` se il file non è in git) · primo titolo interno (prima riga `#`, o prima riga non vuota se assente)

| File | Byte | Ultima modifica | Primo titolo |
|---|---:|---|---|
| `.agents/skills/consolida-pagina/references/functional_areas.md` | 1485 | non-tracciato (mtime fs) 2026-04-18 | Aree Funzionali — Reference |
| `.agents/skills/consolida-pagina/SKILL.md` | 15909 | non-tracciato (mtime fs) 2026-07-27 | Consolida Pagina — Skill Operativa |
| `.agents/skills/dashboards-jobs/SKILL.md` | 13486 | non-tracciato (mtime fs) 2026-07-27 | Dashboard Jobs — Skill Operativa Autoaggiornante |
| `.agents/skills/multi-tenant-validator/SKILL.md` | 7624 | non-tracciato (mtime fs) 2026-07-27 | Multi-Tenant Validator |
| `.agents/skills/project-atlas/references/curated-template.md` | 1248 | non-tracciato (mtime fs) 2026-07-06 | curated-template.md — ATLAS_CURATED: struttura e regole di aggiornamento |
| `.agents/skills/project-atlas/references/dossier-template.md` | 2198 | non-tracciato (mtime fs) 2026-07-07 | dossier-template.md — linee di sviluppo: dal brainstorming al register |
| `.agents/skills/project-atlas/references/goal-recipes.md` | 1144 | non-tracciato (mtime fs) 2026-07-06 | goal-recipes.md — condizioni /goal misurabili (Claude Code ≥2.1.139) |
| `.agents/skills/project-atlas/references/LEARNINGS.md` | 2193 | non-tracciato (mtime fs) 2026-07-07 | LEARNINGS.md — auto-aggiornato dalla skill (lezioni + metriche adattive) |
| `.agents/skills/project-atlas/references/model-map.md` | 1408 | non-tracciato (mtime fs) 2026-07-07 | model-map.md — selezione modello×effort per agente (token-optimized, qualita' garantita) |
| `.agents/skills/project-atlas/references/planner.md` | 2998 | non-tracciato (mtime fs) 2026-07-07 | planner.md — derivazione runtime dei target del sweep (anti-drift) |
| `.agents/skills/project-atlas/references/sweep-prompts.md` | 13743 | non-tracciato (mtime fs) 2026-07-07 | sweep-prompts.md — template per famiglia (istanziati dal planner, MAI hardcoded) |
| `.agents/skills/project-atlas/SKILL.md` | 5282 | non-tracciato (mtime fs) 2026-07-27 | project-atlas — conoscenza operativa + linee di sviluppo (heuresys-advanced) |
| `.agents/skills/zero-pending-loop/README.md` | 35244 | non-tracciato (mtime fs) 2026-07-26 | zero-pending-loop — guida di riferimento |
| `.agents/skills/zero-pending-loop/references/adversarial.md` | 4380 | non-tracciato (mtime fs) 2026-07-26 | Review adversarial — tre revisori, tre lenti, mandato di demolire |
| `.agents/skills/zero-pending-loop/references/blast-radius.md` | 8428 | non-tracciato (mtime fs) 2026-07-26 | Raggio d'impatto — le classi e le corsie |
| `.agents/skills/zero-pending-loop/references/bootstrap.md` | 12365 | non-tracciato (mtime fs) 2026-07-26 | Modo `bootstrap` — prima invocazione sul progetto |
| `.agents/skills/zero-pending-loop/references/close.md` | 6355 | non-tracciato (mtime fs) 2026-07-26 | Modi `close` e `report` |
| `.agents/skills/zero-pending-loop/references/driver.md` | 7349 | non-tracciato (mtime fs) 2026-07-26 | Il driver — contratto, interruzione, ripresa |
| `.agents/skills/zero-pending-loop/references/gates.md` | 4412 | non-tracciato (mtime fs) 2026-07-26 | Gate — quali controlli servono, e perche' non si lancia tutto |
| `.agents/skills/zero-pending-loop/references/LEARNINGS.md` | 8064 | non-tracciato (mtime fs) 2026-07-26 | LEARNINGS — cio' che la prossima iterazione non deve ri-scoprire |
| `.agents/skills/zero-pending-loop/references/operations.md` | 6740 | non-tracciato (mtime fs) 2026-07-25 | Modelli, budget, `/goal`, degradazione |
| `.agents/skills/zero-pending-loop/references/protocol.md` | 5850 | non-tracciato (mtime fs) 2026-07-26 | Protocollo di esecuzione di un cluster |
| `.agents/skills/zero-pending-loop/references/selection.md` | 5012 | non-tracciato (mtime fs) 2026-07-26 | Stato su file e selezione del prossimo cluster |
| `.agents/skills/zero-pending-loop/SKILL.md` | 10617 | non-tracciato (mtime fs) 2026-07-27 | zero-pending-loop |
| `.apify/2026-06-03/apify~rag-web-browser__wieGG5J6bXUKBZVas.content.md` | 2029 | non-tracciato (mtime fs) 2026-06-03 | Apify platform documentation |
| `.apify/2026-06-03/apify~website-content-crawler__pTppzPirSPxhYT301.content.md` | 8719 | non-tracciato (mtime fs) 2026-06-03 | Web scraping basics for JavaScript devs | Academy |
| `.apify/README.md` | 2047 | non-tracciato (mtime fs) 2026-06-03 | `.apify/` — Apify Actor run results archive |
| `.claude/rules/api-module-pattern.md` | 5431 | 2026-08-08 | apps/api — struttura e pattern dei moduli |
| `.claude/rules/db-migrations.md` | 4324 | 2026-08-09 | Migrazioni database |
| `.claude/rules/design-system-ui.md` | 1187 | 2026-08-11 | Design System — `@heuresys/ui` |
| `.claude/rules/frontend-live-data.md` | 1520 | 2026-08-11 | MVP-2a / MVP-2b frontend — LIVE DATA E2E ONLY (non-negotiable) |
| `.claude/rules/security-auth.md` | 3109 | 2026-08-09 | Modello di sicurezza — leggi prima di toccare l'auth |
| `.claude/rules/tests.md` | 3155 | 2026-08-09 | Test — Vitest, isolamento transazionale, Playwright |
| `.claude/skills/full-alignment-deploy/SKILL.md` | 7303 | 2026-08-11 | Allineamento cloni e deploy |
| `.claude/skills/project-atlas/references/curated-template.md` | 1248 | 2026-07-06 | curated-template.md — ATLAS_CURATED: struttura e regole di aggiornamento |
| `.claude/skills/project-atlas/references/dossier-template.md` | 2198 | 2026-07-07 | dossier-template.md — linee di sviluppo: dal brainstorming al register |
| `.claude/skills/project-atlas/references/goal-recipes.md` | 1144 | 2026-07-06 | goal-recipes.md — condizioni /goal misurabili (Claude Code ≥2.1.139) |
| `.claude/skills/project-atlas/references/LEARNINGS.md` | 2193 | 2026-07-07 | LEARNINGS.md — auto-aggiornato dalla skill (lezioni + metriche adattive) |
| `.claude/skills/project-atlas/references/model-map.md` | 1408 | 2026-07-07 | model-map.md — selezione modello×effort per agente (token-optimized, qualita' garantita) |
| `.claude/skills/project-atlas/references/planner.md` | 2998 | 2026-07-07 | planner.md — derivazione runtime dei target del sweep (anti-drift) |
| `.claude/skills/project-atlas/references/sweep-prompts.md` | 13743 | 2026-07-07 | sweep-prompts.md — template per famiglia (istanziati dal planner, MAI hardcoded) |
| `.claude/skills/project-atlas/SKILL.md` | 5282 | 2026-07-07 | project-atlas — conoscenza operativa + linee di sviluppo (heuresys-advanced) |
| `.claude/skills/storia36-custodia/SKILL.md` | 5316 | 2026-07-31 | Custodia della storia RTL 36 mesi |
| `.claude/skills/zero-pending-loop/README.md` | 35244 | 2026-07-26 | zero-pending-loop — guida di riferimento |
| `.claude/skills/zero-pending-loop/references/adversarial.md` | 7332 | 2026-08-10 | Review adversarial — tre revisori, tre lenti, mandato di demolire |
| `.claude/skills/zero-pending-loop/references/blast-radius.md` | 8428 | 2026-07-26 | Raggio d'impatto — le classi e le corsie |
| `.claude/skills/zero-pending-loop/references/bootstrap.md` | 12365 | 2026-07-26 | Modo `bootstrap` — prima invocazione sul progetto |
| `.claude/skills/zero-pending-loop/references/close.md` | 6355 | 2026-07-26 | Modi `close` e `report` |
| `.claude/skills/zero-pending-loop/references/driver.md` | 8543 | 2026-08-04 | Il driver — contratto, interruzione, ripresa |
| `.claude/skills/zero-pending-loop/references/gates.md` | 4412 | 2026-07-26 | Gate — quali controlli servono, e perche' non si lancia tutto |
| `.claude/skills/zero-pending-loop/references/LEARNINGS.md` | 8064 | 2026-07-26 | LEARNINGS — cio' che la prossima iterazione non deve ri-scoprire |
| `.claude/skills/zero-pending-loop/references/operations.md` | 6740 | 2026-07-25 | Modelli, budget, `/goal`, degradazione |
| `.claude/skills/zero-pending-loop/references/protocol.md` | 6729 | 2026-08-10 | Protocollo di esecuzione di un cluster |
| `.claude/skills/zero-pending-loop/references/selection.md` | 7422 | 2026-08-09 | Stato su file e selezione del prossimo cluster |
| `.claude/skills/zero-pending-loop/SKILL.md` | 10747 | 2026-08-09 | zero-pending-loop |
| `.codex/AGENTS.md` | 3833 | non-tracciato (mtime fs) 2026-07-28 | Codex — Revisore Capo |
| `.codex-review/adversarial/6de5b8c3-f091-484c-99e4-84c62c0970db_blind-pass_20260728T172354.991Z.md` | 9919 | non-tracciato (mtime fs) 2026-07-28 | Blind pass indipendente — identità, RBAC, interfacce ed esposizione end-to-end |
| `.codex-review/adversarial/6de5b8c3-f091-484c-99e4-84c62c0970db_challenge-pass_20260728T175115.339Z.md` | 10324 | non-tracciato (mtime fs) 2026-07-28 | Challenge pass adversarial finale |
| `.codex-review/adversarial/6de5b8c3-f091-484c-99e4-84c62c0970db_change-ledger_20260728T180500.000Z.md` | 2658 | non-tracciato (mtime fs) 2026-07-28 | Change ledger — assorbimento challenge pass |
| `.codex-review/adversarial/6de5b8c3-f091-484c-99e4-84c62c0970db_change-ledger-addendum_20260728T181100.000Z.md` | 1052 | non-tracciato (mtime fs) 2026-07-28 | Change ledger addendum — chiusura residual blocker |
| `.codex-review/adversarial/6de5b8c3-f091-484c-99e4-84c62c0970db_change-ledger-addendum-v2_20260728T180514.379Z.md` | 1214 | non-tracciato (mtime fs) 2026-07-28 | Change ledger addendum — chiusura residual blocker |
| `.codex-review/adversarial/6de5b8c3-f091-484c-99e4-84c62c0970db_change-ledger-v2_20260728T180514.290Z.md` | 2941 | non-tracciato (mtime fs) 2026-07-28 | Change ledger — assorbimento challenge pass |
| `.codex-review/adversarial/6de5b8c3-f091-484c-99e4-84c62c0970db_final-acceptance_20260728T180648.695Z.md` | 539 | non-tracciato (mtime fs) 2026-07-28 | Adversarial final acceptance |
| `.codex-review/adversarial/6de5b8c3-f091-484c-99e4-84c62c0970db_post-absorption-verification_20260728T175914.468Z.md` | 2294 | non-tracciato (mtime fs) 2026-07-28 | Post-assorbimento verification pass |
| `.codex-review/adversarial/89a3e8f6-ad38-42a6-b52c-6769c979a1dd_adversarial-review_20260728T143752.671Z.md` | 5291 | non-tracciato (mtime fs) 2026-07-28 | Review adversarial — Login, RBAC e accesso alle webapp |
| `.codex-review/adversarial/93564b80-67cf-49eb-af39-37d144aab3d5_adversarial-review_20260814T162428.913Z.md` | 3869 | non-tracciato (mtime fs) 2026-08-14 | Review adversarial — full forensic repository audit |
| `.codex-review/adversarial/93564b80-67cf-49eb-af39-37d144aab3d5_change-ledger_20260814T162458.691Z.md` | 1469 | non-tracciato (mtime fs) 2026-08-14 | Change ledger |
| `.codex-review/adversarial/93564b80-67cf-49eb-af39-37d144aab3d5_final-acceptance_20260814T162709.322Z.md` | 647 | non-tracciato (mtime fs) 2026-08-14 | Final acceptance |
| `.codex-review/adversarial/e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b_blind-pass_20260728T202615.114Z.md` | 13340 | non-tracciato (mtime fs) 2026-07-28 | Blind adversarial pass — audit e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b |
| `.codex-review/adversarial/e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b_challenge-pass_20260728T204555.654Z.md` | 13704 | non-tracciato (mtime fs) 2026-07-28 | Challenge pass post-draft — audit e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b |
| `.codex-review/adversarial/e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b_change-ledger_20260728T204555.654Z.md` | 2772 | non-tracciato (mtime fs) 2026-07-28 | Change ledger — challenge pass e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b |
| `.codex-review/adversarial/e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b_final-acceptance_20260728T210111.760Z.md` | 3780 | non-tracciato (mtime fs) 2026-07-28 | Final acceptance — audit e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b |
| `.codex-review/adversarial/e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b_post-absorption-verification_20260728T205525.038Z.md` | 5947 | non-tracciato (mtime fs) 2026-07-28 | Post-absorption verification — audit e0fcd4ef-9f41-4fdb-b9b2-4b4a409e036b |
| `.codex-review/evidence/89a3e8f6-ad38-42a6-b52c-6769c979a1dd_static-evidence_20260728T143321.633Z.md` | 2846 | non-tracciato (mtime fs) 2026-07-28 | Evidenze statiche — audit accesso webapp |
| `.codex-review/INDEX.md` | 3141 | non-tracciato (mtime fs) 2026-07-28 | Registro Codex Review |
| `.codex-review/reports/2026-07-28-code-review.md` | 4123 | non-tracciato (mtime fs) 2026-07-28 | Code review — 2026-07-28 |
| `.codex-review/reports/codex-readonly-access-implementation_20260728T150157.265Z.md` | 4276 | non-tracciato (mtime fs) 2026-07-28 | Codex read-only access implementation |
| `.codex-review/reports/codex-readonly-access-provisioned_20260728T152744.138Z.md` | 2997 | non-tracciato (mtime fs) 2026-07-28 | Codex read-only access - permanent provisioning |
| `.codex-review/reports/codex-toolchain-self-learning_20260728T160720.976Z.md` | 2898 | non-tracciato (mtime fs) 2026-07-28 | Codex toolchain self-learning — 2026-07-28T16:07:20.976Z |
| `.codex-review/reports/db-api-frontend-field-forensic-audit_DRAFT_20260728T203738.282Z.md` | 16870 | non-tracciato (mtime fs) 2026-07-28 | Audit forense campo-per-campo — DB → API → frontend |
| `.codex-review/reports/db-api-frontend-field-forensic-audit_FINAL_20260728T205055.771Z.md` | 18568 | non-tracciato (mtime fs) 2026-07-28 | Audit forense campo-per-campo — DB → API → frontend |
| `.codex-review/reports/db-api-frontend-field-forensic-audit_FINAL-v2_20260728T205722.007Z.md` | 26688 | non-tracciato (mtime fs) 2026-07-28 | Audit forense campo-per-campo — DB → API → frontend |
| `.codex-review/reports/db-api-frontend-field-solution-proposals_DRAFT_20260728T204000.886Z.md` | 12562 | non-tracciato (mtime fs) 2026-07-28 | Proposte di soluzione — completezza DB → API → frontend |
| `.codex-review/reports/db-api-frontend-field-solution-proposals_FINAL_20260728T205252.325Z.md` | 9805 | non-tracciato (mtime fs) 2026-07-28 | Proposte finali — completezza DB → API → frontend |
| `.codex-review/reports/forensic-access-control-audit_draft_20260728T143321.633Z.md` | 5741 | non-tracciato (mtime fs) 2026-07-28 | Audit forense — Login, RBAC e accesso alle webapp |
| `.codex-review/reports/forensic-access-control-audit_final_20260728T144025.165Z.md` | 7144 | non-tracciato (mtime fs) 2026-07-28 | Audit forense finale — Login, RBAC e accesso alle webapp |
| `.codex-review/reports/forensic-repo-audit-skill-update_20260728T154245.636Z.md` | 2121 | non-tracciato (mtime fs) 2026-07-28 | Forensic repo audit skill - live read-only update |
| `.codex-review/reports/forensic-skill-adversarial_20260728T133537.427Z.md` | 2080 | non-tracciato (mtime fs) 2026-07-28 | Review adversarial — forensic-repo-audit |
| `.codex-review/reports/forensic-skill-adversarial-addendum_20260728T133537.428Z.md` | 592 | non-tracciato (mtime fs) 2026-07-28 | Addendum review adversarial — ASR-015 |
| `.codex-review/reports/forensic-skill-final-validation_20260728T140131.499Z.md` | 1693 | non-tracciato (mtime fs) 2026-07-28 | Validazione finale — forensic-repo-audit |
| `.codex-review/reports/full-forensic-repository-audit_DRAFT_20260814T162254.058Z.md` | 11316 | non-tracciato (mtime fs) 2026-08-14 | Audit forense completo del repository — DRAFT |
| `.codex-review/reports/full-forensic-repository-audit_FINAL_20260814T162458.692Z.md` | 10689 | non-tracciato (mtime fs) 2026-08-14 | Audit forense del repository — FINAL |
| `.codex-review/reports/full-forensic-repository-audit-drift-addendum_20260814T162709.321Z.md` | 829 | non-tracciato (mtime fs) 2026-08-14 | Drift addendum |
| `.codex-review/reports/rbac-db-api-frontend-audit-drift-addendum_20260728T181300.000Z.md` | 1215 | non-tracciato (mtime fs) 2026-07-28 | Addendum di drift — audit RBAC/exposure |
| `.codex-review/reports/rbac-db-api-frontend-audit-drift-addendum-v2_20260728T180414.148Z.md` | 1356 | non-tracciato (mtime fs) 2026-07-28 | Addendum di drift — audit RBAC/exposure |
| `.codex-review/reports/rbac-db-api-frontend-exposure-audit_DRAFT_20260728T175000.000Z.md` | 13735 | non-tracciato (mtime fs) 2026-07-28 | Audit forense RBAC, interfacce ed esposizione DB → API → frontend |
| `.codex-review/reports/rbac-db-api-frontend-exposure-audit_FINAL_20260728T180700.000Z.md` | 14060 | non-tracciato (mtime fs) 2026-07-28 | Audit forense RBAC, interfacce ed esposizione DB → API → frontend |
| `.codex-review/reports/rbac-db-api-frontend-exposure-audit_FINAL-v2_20260728T181000.000Z.md` | 14324 | non-tracciato (mtime fs) 2026-07-28 | Audit forense RBAC, interfacce ed esposizione DB → API → frontend |
| `.codex-review/reports/rbac-db-api-frontend-exposure-audit_FINAL-v3_20260728T180414.082Z.md` | 14732 | non-tracciato (mtime fs) 2026-07-28 | Audit forense RBAC, interfacce ed esposizione DB → API → frontend |
| `.codex-review/reports/rbac-db-api-frontend-solution-proposals_20260728T175200.000Z.md` | 8274 | non-tracciato (mtime fs) 2026-07-28 | Proposte di soluzione — RBAC, route guard ed esposizione DB/API/frontend |
| `.codex-review/reports/rbac-db-api-frontend-solution-proposals_REVISED_20260728T180800.000Z.md` | 7037 | non-tracciato (mtime fs) 2026-07-28 | Proposte di soluzione revisionate — RBAC, route guard ed exposure governance |
| `.codex-review/reports/rbac-db-api-frontend-solution-proposals_REVISED-v2_20260728T180414.145Z.md` | 7209 | non-tracciato (mtime fs) 2026-07-28 | Proposte di soluzione revisionate — RBAC, route guard ed exposure governance |
| `.codex-review/service/access/CLAUDE_INTEGRATION.md` | 2243 | non-tracciato (mtime fs) 2026-08-20 | Claude awareness - Codex read-only audit channel |
| `.codex-review/service/access/README.md` | 2093 | non-tracciato (mtime fs) 2026-07-28 | Codex read-only access broker |
| `.codex-review/service/learning/lessons/python-path-and-pyyaml_20260728T155631.972Z.md` | 1187 | non-tracciato (mtime fs) 2026-07-28 | Lesson - Python path and PyYAML |
| `.codex-review/service/learning/lessons/python-wrapper-stdout_20260728T172835.892Z.md` | 807 | non-tracciato (mtime fs) 2026-07-28 | Python wrapper stdout forwarding — 2026-07-28T17:28:35.892Z |
| `.codex-review/work/forensic-repo-audit-original_20260728T154126.185Z/references/audit-protocol.md` | 3469 | non-tracciato (mtime fs) 2026-07-28 | Protocollo di audit |
| `.codex-review/work/forensic-repo-audit-original_20260728T154126.185Z/references/evidence-and-severity.md` | 2434 | non-tracciato (mtime fs) 2026-07-28 | Evidenza e severità |
| `.codex-review/work/forensic-repo-audit-original_20260728T154126.185Z/references/report-schema.md` | 1332 | non-tracciato (mtime fs) 2026-07-28 | Schema dei deliverable |
| `.codex-review/work/forensic-repo-audit-original_20260728T154126.185Z/references/snapshot-schema.md` | 1568 | non-tracciato (mtime fs) 2026-07-28 | Schema snapshot comparabile |
| `.codex-review/work/forensic-repo-audit-original_20260728T154126.185Z/SKILL.md` | 6058 | non-tracciato (mtime fs) 2026-07-28 | Forensic Repository Audit |
| `.codex-review/work/forensic-repo-audit-update_20260728T153253.272Z/references/audit-protocol.md` | 5124 | non-tracciato (mtime fs) 2026-07-28 | Protocollo di audit |
| `.codex-review/work/forensic-repo-audit-update_20260728T153253.272Z/references/evidence-and-severity.md` | 2434 | non-tracciato (mtime fs) 2026-07-28 | Evidenza e severità |
| `.codex-review/work/forensic-repo-audit-update_20260728T153253.272Z/references/live-readonly-access.md` | 3966 | non-tracciato (mtime fs) 2026-07-28 | Accesso live read-only |
| `.codex-review/work/forensic-repo-audit-update_20260728T153253.272Z/references/report-schema.md` | 1490 | non-tracciato (mtime fs) 2026-07-28 | Schema dei deliverable |
| `.codex-review/work/forensic-repo-audit-update_20260728T153253.272Z/references/snapshot-schema.md` | 2019 | non-tracciato (mtime fs) 2026-07-28 | Schema snapshot comparabile |
| `.codex-review/work/forensic-repo-audit-update_20260728T153253.272Z/SKILL.md` | 7612 | non-tracciato (mtime fs) 2026-07-28 | Forensic Repository Audit |
| `.codex-review/work/forensic-skill-change-ledger_20260728T133537.427Z.md` | 928 | non-tracciato (mtime fs) 2026-07-28 | Change ledger — forensic-repo-audit |
| `.codex-review/work/forensic-skill-design_20260728T132655.631Z.md` | 1045 | non-tracciato (mtime fs) 2026-07-28 | Progettazione skill forensic-repo-audit |
| `.codex-review/work/toolchain-regression_20260728T160700.030Z/SKILL.md` | 172 | non-tracciato (mtime fs) 2026-07-28 | Runtime regression fixture |
| `.codex-review/work/toolchain-regression_20260728T160929.831Z/SKILL.md` | 172 | non-tracciato (mtime fs) 2026-07-28 | Runtime regression fixture |
| `.codex-review/work/toolchain-regression_20260728T172834.611Z/SKILL.md` | 172 | non-tracciato (mtime fs) 2026-07-28 | Runtime regression fixture |
| `.codex-review/work/toolchain-regression_20260728T172930.570Z/SKILL.md` | 172 | non-tracciato (mtime fs) 2026-07-28 | Runtime regression fixture |
| `.codex-review/work/toolchain-regression_20260728T175000.453Z/SKILL.md` | 172 | non-tracciato (mtime fs) 2026-07-28 | Runtime regression fixture |
| `.github/PULL_REQUEST_TEMPLATE.md` | 987 | 2026-05-17 | Summary |
| `.github/SECURITY.md` | 1158 | 2026-05-17 | Security Policy |
| `.handoff/STATE.md` | 3731 | 2026-08-24 | STATE — vista rapida |
| `.programmi/132-ricerca-genera-il-modello.md` | 55169 | 2026-08-20 | 132 — La ricerca genera il modello, e l'archetipo scritto a mano sparisce |
| `.programmi/142-cruscotti-per-tipologia.md` | 14025 | 2026-08-19 | 142 — Cruscotti focalizzati per tipologia di utilizzatore |
| `.programmi/143-squadra-come-progetto.md` | 7941 | 2026-08-15 | 143 — Una squadra è un progetto: serve il modello, non un puntatore al capo |
| `.programmi/148-rendiconto-chiusure-quattro-verbi.md` | 2385 | 2026-08-24 | 148 — Il rendiconto delle chiusure: leggerlo, e decidere se la chiusura va riscritta in quattro verbi |
| `.programmi/149-consegne-lab-non-verificate.md` | 3112 | 2026-08-21 | 149 — Ogni consegna del lab va trattata come non verificata, incluse quelle già ingerite |
| `.programmi/159-ponte-gateway-pagine.md` | 5189 | 2026-08-15 | 159 — Il ponte gateway↔pagine web deve valere per le pagine future |
| `.programmi/169-due-segreti-dalla-stessa-chiave.md` | 3032 | 2026-08-24 | 169 — La password e il secondo fattore nascono dalla stessa chiave: chi ha una ha l'altro |
| `.programmi/181-rilievi-controllo-drift.md` | 6420 | 2026-08-19 | 181 — I sette rilievi sul controllo di drift, e le correzioni entrate in main senza verifica |
| `.programmi/197-marchio-materializzazione.md` | 2673 | 2026-08-18 | 197 — Il marchio `materialized_from` non copre tutte le tabelle che lo stesso motore scrive |
| `.programmi/198-tenant-builder-p3-costruzione.md` | 12469 | 2026-08-19 | 198 — Tenant Builder P3: la costruzione tracciata, ogni riga marcata e riconducibile |
| `.programmi/205-tenant-builder-2b-2c.md` | 4638 | 2026-08-18 | 205 — Tenant Builder 2b e 2c: la coda dei domini ricercabili, e il patrimonio senza le parole di un altro |
| `.programmi/211-suite-e2e-completa.md` | 14498 | 2026-08-19 | 211 — La suite E2E completa: i rossi che non sono guasti del prodotto, e i casi che non girano |
| `.programmi/214-adozione-agente-perimetri.md` | 14181 | 2026-08-24 | 214 — Adozione dell'agente sui perimetri in coda, in ordine di rischio crescente |
| `.programmi/215-stato-impossibile-bande-e-competenze.md` | 5541 | 2026-08-18 | 215 — Lo stesso stato impossibile in altre due tabelle, dove la cura è l'opposto |
| `.programmi/216-passaggio-di-consegne.md` | 7684 | 2026-08-18 | 216 — Il passaggio di consegne fra sessioni: il menu spiega, e l'avanzamento si deriva |
| `.programmi/217-flusso-di-chiusura.md` | 8623 | 2026-08-19 | 217 — Il flusso di chiusura: da rito completo a percorso scelto |
| `.programmi/218-residui-legacy-senza-referente.md` | 16184 | 2026-08-19 | 218 — I residui del legacy senza referente locale: analizzarli tutti, e risolverli uno per uno |
| `.programmi/219-otto-guasti-suite-e2e.md` | 15537 | 2026-08-24 | 219 — Gli otto guasti dietro i rossi della suite E2E integrale |
| `.programmi/220-remediation-dossier-forense.md` | 11289 | 2026-08-20 | 220 — Remediation forense W1 · Messa in sicurezza |
| `.programmi/221-remediation-w2-recuperi.md` | 8321 | 2026-08-20 | 221 — Remediation forense W2 · Recuperi |
| `.programmi/222-remediation-w3-integrita-contenuti.md` | 13897 | 2026-08-24 | 222 — Remediation forense W3 · Integrità e contenuti dei cataloghi |
| `.programmi/223-remediation-w4-pipeline-ruoli.md` | 11051 | 2026-08-24 | 223 — Remediation forense W4 · Pipeline, separazione ruoli, prestazioni |
| `.programmi/224-check-non-deterministico-fuso.md` | 6010 | 2026-08-24 | 224 — Il check che cambia verdetto a seconda di dove lo lanci |
| `.programmi/225-claude-md-affermazioni-scadute.md` | 3130 | 2026-08-24 | 225 — Due affermazioni del CLAUDE.md sono scadute |
| `.programmi/226-storia-rtl-scorrevole.md` | 8265 | 2026-08-24 | 226 — La storia di RTL diventa scorrevole: l'avanzamento va schedulato, e solo dove il database e' quello vero |
| `.programmi/227-competenze-isolate-nel-grafo.md` | 4437 | 2026-08-24 | 227 — Le competenze isolate nel grafo: un terzo del catalogo senza un solo arco |
| `.programmi/228-cancello-a-tempo.md` | 7086 | 2026-08-24 | 228 — Il cancello a tempo: cosa è marcito mentre non guardavo |
| `.programmi/229-eredita-fra-sessioni.md` | 8259 | 2026-08-24 | 229 — L'eredità fra sessioni: rilevare ciò che è stato interrotto, e leggerlo all'avvio |
| `.programmi/230-verifica-quattro-attese.md` | 13437 | 2026-08-25 | 230 — Le quattro voci che aspettavano un input: verificate una per una, e tre non erano quello che dicevano |
| `.programmi/50-knowledge-graph-legacy.md` | 5338 | 2026-08-14 | 50 — D/D4: legacy knowledge graph (`kg_nodes` / `kg_edges`, 139k) |
| `.programmi/54-recruiting-ats.md` | 4487 | 2026-08-14 | 54 — E/E5: recruiting / ATS (cluster `/recruiting`) |
| `.programmi/69-residui-staging-wave1.md` | 5892 | 2026-08-19 | 69 — Bonifica dei residui `staging.wave1_*` nell'advanced |
| `.programmi/79-cancello-di-esposizione.md` | 2941 | 2026-08-21 | 79 — Cancello di esposizione: un dato che nessuna API espone non è nel prodotto |
| `.programmi/92-ciclo-valutazione.md` | 9150 | 2026-08-15 | 92 — Ciclo di valutazione completo (autovalutazione + calibrazione) |
| `.programmi/99-domini-gerarchici-funzionali.md` | 22884 | 2026-08-16 | 99 — Domini gerarchici e funzionali: applicare la definizione |
| `.programmi/D86-D87-i-due-cancelli-della-chiusura.md` | 9905 | 2026-08-24 | D-86 e D-87 — i due cancelli che rompono la chiusura |
| `.programmi/mandati/mandato-consegne-lab-2026-08-16.md` | 11470 | 2026-08-17 | Mandato — eseguire le 7 consegne del design-lab del 2026-08-16 |
| `.programmi/mandati/mandato-S1067-batch-p1p2p3.md` | 13191 | 2026-08-17 | Mandato S1067 — eseguire il maggior numero di azioni di P1, P2 e P3 |
| `.programmi/mandati/mandato-S1068-p3-p1-p2.md` | 18151 | 2026-08-17 | Mandato S1068 — #213 investigata, #214 su `positions`, poi P3 → P1 → P2 |
| `.programmi/mandati/mandato-S1071-ciclo-p1.md` | 13951 | 2026-08-19 | Mandato S1071→S1072 — due difetti subito, poi il consumo di tutto P1 **e P2** |
| `.programmi/mandati/mandato-S1073-prompt-ripresa.md` | 5170 | 2026-08-19 | Mandato S1073 — prompt di ripresa, da copiare nella sessione nuova |
| `.programmi/mandati/mandato-S1074-prompt-ripresa.md` | 4383 | 2026-08-19 | Prompt di ripresa — sessione S1074 |
| `.programmi/mandati/mandato-S1077-corsa-autonoma.md` | 12554 | 2026-08-21 | Mandato S1077 — corsa autonoma, non presidiata |
| `.programmi/mandati/README.md` | 1321 | 2026-08-17 | `.programmi/mandati/` — i piani di CICLO, che non sono programmi di voce |
| `.programmi/README.md` | 3851 | 2026-08-18 | `.programmi/` — le voci che non stanno in una sessione |
| `.programmi/Z251-contesa-database-suite.md` | 16167 | 2026-08-19 | Z-251 — La suite non regge la contesa sul database: un file diverso cade a ogni giro |
| `.storia36/analysis/c2-macchina-stati.md` | 24869 | 2026-07-28 | C2 — Macchina a stati del ciclo performance (dal CODICE) |
| `.storia36/analysis/c2-misura.md` | 13759 | 2026-07-28 | C2 storia36 — Misura dello stato esistente del ciclo performance (RTL Bank) |
| `.storia36/analysis/c3-misura.md` | 4448 | 2026-07-28 | C3 — misura (inline, 2026-07-28; gli agenti sono morti per limite sessione ×2) |
| `.storia36/analysis/c4-codice.md` | 23643 | 2026-07-28 | TASK B — Analisi CODICE cluster C4 (learning / training / certifications) |
| `.storia36/analysis/c4-misura.md` | 12382 | 2026-07-28 | C4 — MISURA cluster formazione (storia36) |
| `.storia36/analysis/conventions.md` | 13113 | 2026-07-27 | storia36 — Convenzioni del repo per i deliverable C0 (Task D) |
| `.storia36/analysis/date-columns.md` | 74314 | 2026-07-27 | Storia36 — TASK B: inventario e classificazione colonne `date`/`timestamptz` dello schema `sys` |
| `.storia36/analysis/shapes-g2-g4.md` | 16142 | 2026-07-27 | Storia36 — Task C: shape esatte e range dati per i check G2–G4 |
| `.storia36/PROGRESS.md` | 91590 | 2026-08-24 | storia36 — stato di esecuzione |
| `.superpowers/sdd/final-fix-report.md` | 1741 | non-tracciato (mtime fs) 2026-06-21 | Final Fix Report — #4 GDPR Privacy Notice |
| `.superpowers/sdd/final-review-fixes-report.md` | 4836 | non-tracciato (mtime fs) 2026-07-07 | FINAL-review fix wave — project-atlas skill |
| `.superpowers/sdd/progress.md` | 5275 | non-tracciato (mtime fs) 2026-07-07 | SDD progress — GTM front-door landing + lead capture (#4) |
| `.superpowers/sdd/task-10-brief.md` | 3632 | non-tracciato (mtime fs) 2026-07-06 | Task 10: Test di accettazione (spec §8) + chiusura |
| `.superpowers/sdd/task-10-report.md` | 2307 | non-tracciato (mtime fs) 2026-06-21 | Task 10 Report — landing E2E (DONE) |
| `.superpowers/sdd/task-1-brief.md` | 4276 | non-tracciato (mtime fs) 2026-07-06 | Task 1: Manifest `atlas.config.yaml` |
| `.superpowers/sdd/task-1-report.md` | 2613 | non-tracciato (mtime fs) 2026-07-06 | Task 1 Report — Manifest `atlas.config.yaml` |
| `.superpowers/sdd/task-2-brief.md` | 3355 | non-tracciato (mtime fs) 2026-07-06 | Task 2: `planner.md` (derivazione runtime + coverage check fail-loud) |
| `.superpowers/sdd/task-2-report.md` | 1368 | non-tracciato (mtime fs) 2026-07-06 | Task 2 Report: project-atlas planner.md |
| `.superpowers/sdd/task-3-brief.md` | 3692 | non-tracciato (mtime fs) 2026-07-06 | Task 3: `sweep-prompts.md` (6 template per famiglia) |
| `.superpowers/sdd/task-3-report.md` | 5352 | non-tracciato (mtime fs) 2026-07-06 | Task 3 Report — sweep-prompts.md (6 template per famiglia) |
| `.superpowers/sdd/task-4-brief.md` | 1802 | non-tracciato (mtime fs) 2026-07-06 | Task 4: `model-map.md` |
| `.superpowers/sdd/task-4-report.md` | 750 | non-tracciato (mtime fs) 2026-07-06 | Task 4 Report: `model-map.md` |
| `.superpowers/sdd/task-5-brief.md` | 1983 | non-tracciato (mtime fs) 2026-07-06 | Task 5: `curated-template.md` |
| `.superpowers/sdd/task-5-report.md` | 716 | non-tracciato (mtime fs) 2026-07-06 | Task 5 Report: curated-template.md |
| `.superpowers/sdd/task-6-brief.md` | 2917 | non-tracciato (mtime fs) 2026-07-06 | Task 6: `dossier-template.md` |
| `.superpowers/sdd/task-6-report.md` | 3070 | non-tracciato (mtime fs) 2026-07-06 | Task 6 Report: GATED Format Fix |
| `.superpowers/sdd/task-7-brief.md` | 1735 | non-tracciato (mtime fs) 2026-07-06 | Task 7: `goal-recipes.md` |
| `.superpowers/sdd/task-7-report.md` | 605 | non-tracciato (mtime fs) 2026-07-06 | Task 7 Report — goal-recipes.md |
| `.superpowers/sdd/task-8-brief.md` | 2513 | non-tracciato (mtime fs) 2026-07-06 | Task 8: `LEARNINGS.md` (bootstrap con lezioni S1016 + schema run-record) |
| `.superpowers/sdd/task-8-report.md` | 687 | non-tracciato (mtime fs) 2026-07-06 | Task 8 Report — LEARNINGS.md Bootstrap |
| `.superpowers/sdd/task-9-brief.md` | 5916 | non-tracciato (mtime fs) 2026-07-06 | Task 9: `SKILL.md` (dispatcher — per ultimo, referenzia tutto) |
| `.superpowers/sdd/task-9-report.md` | 2063 | non-tracciato (mtime fs) 2026-07-06 | Task 9 Report — SKILL.md Dispatcher |
| `.zp/PROGRESS.md` | 5229 | 2026-08-10 | zero-pending — a che punto siamo |
| `.zp/prove/Z-259-contesto.md` | 3635 | non-tracciato (mtime fs) 2026-07-26 | Z-259 — dossier di contesto (fatti già misurati) |
| `.zp/zp_triage.md` | 7744 | non-tracciato (mtime fs) 2026-08-09 | Triage dei cluster zero-pendenze — generato 2026-08-09 su HEAD e75512f3 |
| `AGENTS.md` | 36602 | non-tracciato (mtime fs) 2026-07-27 | AGENTS.md |
| `apps/agent-gateway/README.md` | 1680 | 2026-06-15 | @heuresys/agent-gateway — #9 WI-B (Agent SDK + MCP backend) |
| `audit/BLOCKED-LOG.md` | 199 | non-tracciato (mtime fs) 2026-06-23 | admin — Login blocked |
| `audit/FINDINGS.md` | 14286 | 2026-06-24 | Heuresys Advanced — QA Forense E2E (S1006) |
| `audit/FORENSIC-NOTES-S1006-cli.md` | 13403 | 2026-06-24 | Forensic notes — S1006 continuation (CLI headless batch + code-level) |
| `audit/pages/admin__mfa-policy/core2-TODO.md` | 527 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — admin__mfa-policy [admin] |
| `audit/pages/admin__mfa-policy/core3-TODO.md` | 388 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — admin__mfa-policy [admin] |
| `audit/pages/admin__mfa-policy/core4-TODO.md` | 316 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — admin__mfa-policy [admin] |
| `audit/pages/admin__mfa-policy/core6-TODO.md` | 227 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — admin__mfa-policy [admin] |
| `audit/pages/admin__roles/core2-TODO.md` | 519 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — admin__roles [admin] |
| `audit/pages/admin__roles/core3-TODO.md` | 379 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — admin__roles [admin] |
| `audit/pages/admin__roles/core4-TODO.md` | 312 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — admin__roles [admin] |
| `audit/pages/admin__roles/core6-TODO.md` | 222 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — admin__roles [admin] |
| `audit/pages/analytics__attendance/core2-TODO.md` | 535 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — analytics__attendance [admin] |
| `audit/pages/analytics__attendance/core3-TODO.md` | 396 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — analytics__attendance [admin] |
| `audit/pages/analytics__attendance/core4-TODO.md` | 320 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — analytics__attendance [admin] |
| `audit/pages/analytics__attendance/core6-TODO.md` | 231 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — analytics__attendance [admin] |
| `audit/pages/analytics__compensation/core2-TODO.md` | 539 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — analytics__compensation [admin] |
| `audit/pages/analytics__compensation/core3-TODO.md` | 400 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — analytics__compensation [admin] |
| `audit/pages/analytics__compensation/core4-TODO.md` | 322 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — analytics__compensation [admin] |
| `audit/pages/analytics__compensation/core6-TODO.md` | 233 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — analytics__compensation [admin] |
| `audit/pages/analytics__kpi/core2-TODO.md` | 522 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — analytics__kpi [admin] |
| `audit/pages/analytics__kpi/core3-TODO.md` | 382 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — analytics__kpi [admin] |
| `audit/pages/analytics__kpi/core4-TODO.md` | 313 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — analytics__kpi [admin] |
| `audit/pages/analytics__kpi/core6-TODO.md` | 224 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — analytics__kpi [admin] |
| `audit/pages/analytics__org-network/core2-TODO.md` | 537 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — analytics__org-network [admin] |
| `audit/pages/analytics__org-network/core3-TODO.md` | 398 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — analytics__org-network [admin] |
| `audit/pages/analytics__org-network/core4-TODO.md` | 321 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — analytics__org-network [admin] |
| `audit/pages/analytics__org-network/core6-TODO.md` | 232 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — analytics__org-network [admin] |
| `audit/pages/analytics__overtime/core2-TODO.md` | 531 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — analytics__overtime [admin] |
| `audit/pages/analytics__overtime/core3-TODO.md` | 392 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — analytics__overtime [admin] |
| `audit/pages/analytics__overtime/core4-TODO.md` | 318 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — analytics__overtime [admin] |
| `audit/pages/analytics__overtime/core6-TODO.md` | 229 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — analytics__overtime [admin] |
| `audit/pages/analytics__skills/core2-TODO.md` | 527 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — analytics__skills [admin] |
| `audit/pages/analytics__skills/core3-TODO.md` | 388 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — analytics__skills [admin] |
| `audit/pages/analytics__skills/core4-TODO.md` | 316 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — analytics__skills [admin] |
| `audit/pages/analytics__skills/core6-TODO.md` | 227 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — analytics__skills [admin] |
| `audit/pages/analytics__skills-by-category/core2-TODO.md` | 551 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — analytics__skills-by-category [admin] |
| `audit/pages/analytics__skills-by-category/core3-TODO.md` | 412 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — analytics__skills-by-category [admin] |
| `audit/pages/analytics__skills-by-category/core4-TODO.md` | 328 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — analytics__skills-by-category [admin] |
| `audit/pages/analytics__skills-by-category/core6-TODO.md` | 239 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — analytics__skills-by-category [admin] |
| `audit/pages/analytics__skills-group-share/core2-TODO.md` | 551 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — analytics__skills-group-share [admin] |
| `audit/pages/analytics__skills-group-share/core3-TODO.md` | 412 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — analytics__skills-group-share [admin] |
| `audit/pages/analytics__skills-group-share/core4-TODO.md` | 328 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — analytics__skills-group-share [admin] |
| `audit/pages/analytics__skills-group-share/core6-TODO.md` | 239 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — analytics__skills-group-share [admin] |
| `audit/pages/analytics__workforce/core2-TODO.md` | 533 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — analytics__workforce [admin] |
| `audit/pages/analytics__workforce/core3-TODO.md` | 394 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — analytics__workforce [admin] |
| `audit/pages/analytics__workforce/core4-TODO.md` | 319 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — analytics__workforce [admin] |
| `audit/pages/analytics__workforce/core6-TODO.md` | 230 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — analytics__workforce [admin] |
| `audit/pages/approvals/core2-TODO.md` | 511 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — approvals [admin] |
| `audit/pages/approvals/core3-TODO.md` | 372 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — approvals [admin] |
| `audit/pages/approvals/core4-TODO.md` | 308 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — approvals [admin] |
| `audit/pages/approvals/core6-TODO.md` | 219 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — approvals [admin] |
| `audit/pages/approvals__69137767-5795-47f7-8868-fd8461d68fa4/core2-TODO.md` | 587 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — approvals__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/approvals__69137767-5795-47f7-8868-fd8461d68fa4/core3-TODO.md` | 448 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — approvals__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/approvals__69137767-5795-47f7-8868-fd8461d68fa4/core4-TODO.md` | 346 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — approvals__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/approvals__69137767-5795-47f7-8868-fd8461d68fa4/core6-TODO.md` | 257 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — approvals__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/blueprints/core2-TODO.md` | 514 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — blueprints [admin] |
| `audit/pages/blueprints/core3-TODO.md` | 374 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — blueprints [admin] |
| `audit/pages/blueprints/core4-TODO.md` | 309 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — blueprints [admin] |
| `audit/pages/blueprints/core6-TODO.md` | 220 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — blueprints [admin] |
| `audit/pages/blueprints__b6e81585-8526-410f-bb1b-0138e2cb425f/core2-TODO.md` | 590 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — blueprints__b6e81585-8526-410f-bb1b-0138e2cb425f [admin] |
| `audit/pages/blueprints__b6e81585-8526-410f-bb1b-0138e2cb425f/core3-TODO.md` | 450 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — blueprints__b6e81585-8526-410f-bb1b-0138e2cb425f [admin] |
| `audit/pages/blueprints__b6e81585-8526-410f-bb1b-0138e2cb425f/core4-TODO.md` | 347 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — blueprints__b6e81585-8526-410f-bb1b-0138e2cb425f [admin] |
| `audit/pages/blueprints__b6e81585-8526-410f-bb1b-0138e2cb425f/core6-TODO.md` | 258 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — blueprints__b6e81585-8526-410f-bb1b-0138e2cb425f [admin] |
| `audit/pages/brownfield-adaptation/admin-BUGS.md` | 154 | non-tracciato (mtime fs) 2026-06-23 | BUGS — brownfield-adaptation [admin] |
| `audit/pages/brownfield-adaptation/core3-TODO.md` | 395 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — brownfield-adaptation [admin] |
| `audit/pages/brownfield-adaptation/core6-TODO.md` | 231 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — brownfield-adaptation [admin] |
| `audit/pages/career-succession/core2-TODO.md` | 527 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — career-succession [admin] |
| `audit/pages/career-succession/core3-TODO.md` | 387 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — career-succession [admin] |
| `audit/pages/career-succession/core4-TODO.md` | 316 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — career-succession [admin] |
| `audit/pages/career-succession/core6-TODO.md` | 227 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — career-succession [admin] |
| `audit/pages/compensation-intelligence/core2-TODO.md` | 544 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — compensation-intelligence [admin] |
| `audit/pages/compensation-intelligence/core3-TODO.md` | 404 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — compensation-intelligence [admin] |
| `audit/pages/compensation-intelligence/core4-TODO.md` | 324 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — compensation-intelligence [admin] |
| `audit/pages/compensation-intelligence/core6-TODO.md` | 235 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — compensation-intelligence [admin] |
| `audit/pages/content/core2-TODO.md` | 507 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — content [admin] |
| `audit/pages/content/core3-TODO.md` | 368 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — content [admin] |
| `audit/pages/content/core4-TODO.md` | 306 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — content [admin] |
| `audit/pages/content/core6-TODO.md` | 217 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — content [admin] |
| `audit/pages/content__69137767-5795-47f7-8868-fd8461d68fa4/core2-TODO.md` | 584 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — content__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/content__69137767-5795-47f7-8868-fd8461d68fa4/core3-TODO.md` | 444 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — content__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/content__69137767-5795-47f7-8868-fd8461d68fa4/core4-TODO.md` | 344 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — content__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/content__69137767-5795-47f7-8868-fd8461d68fa4/core6-TODO.md` | 255 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — content__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/dashboard/core2-TODO.md` | 511 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — dashboard [admin] |
| `audit/pages/dashboard/core3-TODO.md` | 372 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — dashboard [admin] |
| `audit/pages/dashboard/core4-TODO.md` | 308 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — dashboard [admin] |
| `audit/pages/dashboard/core6-TODO.md` | 219 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — dashboard [admin] |
| `audit/pages/dev__agent/core2-TODO.md` | 513 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — dev__agent [admin] |
| `audit/pages/dev__agent/core3-TODO.md` | 374 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — dev__agent [admin] |
| `audit/pages/dev__agent/core4-TODO.md` | 309 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — dev__agent [admin] |
| `audit/pages/dev__agent/core6-TODO.md` | 220 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — dev__agent [admin] |
| `audit/pages/engagement/core2-TODO.md` | 514 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — engagement [admin] |
| `audit/pages/engagement/core3-TODO.md` | 374 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — engagement [admin] |
| `audit/pages/engagement/core4-TODO.md` | 309 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — engagement [admin] |
| `audit/pages/engagement/core6-TODO.md` | 220 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — engagement [admin] |
| `audit/pages/engagement__57850d00-c7cd-4f66-8acd-20586bc63eda/admin-BUGS.md` | 216 | non-tracciato (mtime fs) 2026-06-23 | BUGS — engagement__57850d00-c7cd-4f66-8acd-20586bc63eda [admin] |
| `audit/pages/engagement__57850d00-c7cd-4f66-8acd-20586bc63eda/core2-TODO.md` | 589 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — engagement__57850d00-c7cd-4f66-8acd-20586bc63eda [admin] |
| `audit/pages/engagement__57850d00-c7cd-4f66-8acd-20586bc63eda/core3-TODO.md` | 450 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — engagement__57850d00-c7cd-4f66-8acd-20586bc63eda [admin] |
| `audit/pages/engagement__57850d00-c7cd-4f66-8acd-20586bc63eda/core4-TODO.md` | 347 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — engagement__57850d00-c7cd-4f66-8acd-20586bc63eda [admin] |
| `audit/pages/engagement__57850d00-c7cd-4f66-8acd-20586bc63eda/core6-TODO.md` | 258 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — engagement__57850d00-c7cd-4f66-8acd-20586bc63eda [admin] |
| `audit/pages/gaps/core2-TODO.md` | 501 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — gaps [admin] |
| `audit/pages/gaps/core3-TODO.md` | 362 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — gaps [admin] |
| `audit/pages/gaps/core4-TODO.md` | 303 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — gaps [admin] |
| `audit/pages/gaps/core6-TODO.md` | 214 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — gaps [admin] |
| `audit/pages/goals/core2-TODO.md` | 503 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — goals [admin] |
| `audit/pages/goals/core3-TODO.md` | 364 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — goals [admin] |
| `audit/pages/goals/core4-TODO.md` | 304 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — goals [admin] |
| `audit/pages/goals/core6-TODO.md` | 215 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — goals [admin] |
| `audit/pages/insights/core2-TODO.md` | 509 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — insights [admin] |
| `audit/pages/insights/core3-TODO.md` | 370 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — insights [admin] |
| `audit/pages/insights/core4-TODO.md` | 307 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — insights [admin] |
| `audit/pages/insights/core6-TODO.md` | 218 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — insights [admin] |
| `audit/pages/insights__skill-gap/core2-TODO.md` | 531 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — insights__skill-gap [admin] |
| `audit/pages/insights__skill-gap/core3-TODO.md` | 391 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — insights__skill-gap [admin] |
| `audit/pages/insights__skill-gap/core4-TODO.md` | 318 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — insights__skill-gap [admin] |
| `audit/pages/insights__skill-gap/core6-TODO.md` | 229 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — insights__skill-gap [admin] |
| `audit/pages/insights__succession-readiness/core2-TODO.md` | 553 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — insights__succession-readiness [admin] |
| `audit/pages/insights__succession-readiness/core3-TODO.md` | 414 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — insights__succession-readiness [admin] |
| `audit/pages/insights__succession-readiness/core4-TODO.md` | 329 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — insights__succession-readiness [admin] |
| `audit/pages/insights__succession-readiness/core6-TODO.md` | 240 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — insights__succession-readiness [admin] |
| `audit/pages/kpis/core2-TODO.md` | 502 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — kpis [admin] |
| `audit/pages/kpis/core3-TODO.md` | 362 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — kpis [admin] |
| `audit/pages/kpis/core4-TODO.md` | 303 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — kpis [admin] |
| `audit/pages/kpis/core6-TODO.md` | 214 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — kpis [admin] |
| `audit/pages/learning/core2-TODO.md` | 509 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — learning [admin] |
| `audit/pages/learning/core3-TODO.md` | 369 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — learning [admin] |
| `audit/pages/learning/core4-TODO.md` | 307 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — learning [admin] |
| `audit/pages/learning/core6-TODO.md` | 218 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — learning [admin] |
| `audit/pages/learning__training-initiatives/admin-BUGS.md` | 351 | non-tracciato (mtime fs) 2026-06-23 | BUGS — learning__training-initiatives [admin] |
| `audit/pages/learning__training-initiatives/core6-TODO.md` | 240 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — learning__training-initiatives [admin] |
| `audit/pages/me/admin-BUGS.md` | 323 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me [admin] |
| `audit/pages/me/core6-TODO.md` | 212 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me [admin] |
| `audit/pages/me__career/admin-BUGS.md` | 481 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__career [admin] |
| `audit/pages/me__career/core6-TODO.md` | 220 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__career [admin] |
| `audit/pages/me__career__target/admin-BUGS.md` | 339 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__career__target [admin] |
| `audit/pages/me__career__target/core6-TODO.md` | 228 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__career__target [admin] |
| `audit/pages/me__certifications/admin-BUGS.md` | 339 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__certifications [admin] |
| `audit/pages/me__certifications/core6-TODO.md` | 228 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__certifications [admin] |
| `audit/pages/me__documents/admin-BUGS.md` | 484 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__documents [admin] |
| `audit/pages/me__documents/core6-TODO.md` | 223 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__documents [admin] |
| `audit/pages/me__gaps/admin-BUGS.md` | 479 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__gaps [admin] |
| `audit/pages/me__gaps/core6-TODO.md` | 218 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__gaps [admin] |
| `audit/pages/me__handbook/admin-BUGS.md` | 333 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__handbook [admin] |
| `audit/pages/me__handbook/core6-TODO.md` | 222 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__handbook [admin] |
| `audit/pages/me__handbook__69137767-5795-47f7-8868-fd8461d68fa4/admin-BUGS.md` | 371 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__handbook__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/me__handbook__69137767-5795-47f7-8868-fd8461d68fa4/core6-TODO.md` | 260 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__handbook__69137767-5795-47f7-8868-fd8461d68fa4 [admin] |
| `audit/pages/me__inbox/admin-BUGS.md` | 330 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__inbox [admin] |
| `audit/pages/me__inbox/core6-TODO.md` | 219 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__inbox [admin] |
| `audit/pages/me__kpis/admin-BUGS.md` | 329 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__kpis [admin] |
| `audit/pages/me__kpis/core6-TODO.md` | 218 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__kpis [admin] |
| `audit/pages/me__learning/admin-BUGS.md` | 483 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__learning [admin] |
| `audit/pages/me__learning/core6-TODO.md` | 222 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__learning [admin] |
| `audit/pages/me__learning__catalogue/admin-BUGS.md` | 494 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__learning__catalogue [admin] |
| `audit/pages/me__learning__catalogue/core6-TODO.md` | 233 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__learning__catalogue [admin] |
| `audit/pages/me__matching/admin-BUGS.md` | 333 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__matching [admin] |
| `audit/pages/me__matching/core6-TODO.md` | 222 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__matching [admin] |
| `audit/pages/me__positions/admin-BUGS.md` | 334 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__positions [admin] |
| `audit/pages/me__positions/core6-TODO.md` | 223 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__positions [admin] |
| `audit/pages/me__profile/admin-BUGS.md` | 482 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__profile [admin] |
| `audit/pages/me__profile/core6-TODO.md` | 221 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__profile [admin] |
| `audit/pages/me__security/admin-BUGS.md` | 333 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__security [admin] |
| `audit/pages/me__security/core6-TODO.md` | 222 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__security [admin] |
| `audit/pages/me__skills/admin-BUGS.md` | 331 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__skills [admin] |
| `audit/pages/me__skills/core6-TODO.md` | 220 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__skills [admin] |
| `audit/pages/me__skills__self-assessment/admin-BUGS.md` | 348 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__skills__self-assessment [admin] |
| `audit/pages/me__skills__self-assessment/core6-TODO.md` | 237 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__skills__self-assessment [admin] |
| `audit/pages/me__surveys/admin-BUGS.md` | 332 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__surveys [admin] |
| `audit/pages/me__surveys/core6-TODO.md` | 221 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__surveys [admin] |
| `audit/pages/me__surveys__57850d00-c7cd-4f66-8acd-20586bc63eda/admin-BUGS.md` | 520 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__surveys__57850d00-c7cd-4f66-8acd-20586bc63eda [admin] |
| `audit/pages/me__surveys__57850d00-c7cd-4f66-8acd-20586bc63eda/core6-TODO.md` | 259 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__surveys__57850d00-c7cd-4f66-8acd-20586bc63eda [admin] |
| `audit/pages/me__team/admin-BUGS.md` | 329 | non-tracciato (mtime fs) 2026-06-23 | BUGS — me__team [admin] |
| `audit/pages/me__team/core6-TODO.md` | 218 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — me__team [admin] |
| `audit/pages/okrs/admin-BUGS.md` | 475 | non-tracciato (mtime fs) 2026-06-23 | BUGS — okrs [admin] |
| `audit/pages/okrs/core6-TODO.md` | 214 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — okrs [admin] |
| `audit/pages/organization/admin-BUGS.md` | 483 | non-tracciato (mtime fs) 2026-06-23 | BUGS — organization [admin] |
| `audit/pages/organization/core6-TODO.md` | 222 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — organization [admin] |
| `audit/pages/organization__org-chart/admin-BUGS.md` | 344 | non-tracciato (mtime fs) 2026-06-23 | BUGS — organization__org-chart [admin] |
| `audit/pages/organization__org-chart/core6-TODO.md` | 233 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — organization__org-chart [admin] |
| `audit/pages/org-director/admin-BUGS.md` | 333 | non-tracciato (mtime fs) 2026-06-23 | BUGS — org-director [admin] |
| `audit/pages/org-director/core6-TODO.md` | 222 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — org-director [admin] |
| `audit/pages/positions/admin-BUGS.md` | 480 | non-tracciato (mtime fs) 2026-06-23 | BUGS — positions [admin] |
| `audit/pages/positions/core6-TODO.md` | 219 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — positions [admin] |
| `audit/pages/positions__0e51c0bb-f0df-4752-b003-b75a8607ea88/admin-BUGS.md` | 518 | non-tracciato (mtime fs) 2026-06-23 | BUGS — positions__0e51c0bb-f0df-4752-b003-b75a8607ea88 [admin] |
| `audit/pages/positions__0e51c0bb-f0df-4752-b003-b75a8607ea88/core6-TODO.md` | 257 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — positions__0e51c0bb-f0df-4752-b003-b75a8607ea88 [admin] |
| `audit/pages/positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__kpis/admin-BUGS.md` | 374 | non-tracciato (mtime fs) 2026-06-23 | BUGS — positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__kpis [admin] |
| `audit/pages/positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__kpis/core6-TODO.md` | 263 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__kpis [admin] |
| `audit/pages/positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__learning/admin-BUGS.md` | 378 | non-tracciato (mtime fs) 2026-06-23 | BUGS — positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__learning [admin] |
| `audit/pages/positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__learning/core6-TODO.md` | 267 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__learning [admin] |
| `audit/pages/positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__skills/admin-BUGS.md` | 526 | non-tracciato (mtime fs) 2026-06-23 | BUGS — positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__skills [admin] |
| `audit/pages/positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__skills/core6-TODO.md` | 265 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__skills [admin] |
| `audit/pages/processes/admin-BUGS.md` | 485 | non-tracciato (mtime fs) 2026-06-23 | BUGS — processes [admin] |
| `audit/pages/processes/core6-TODO.md` | 219 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — processes [admin] |
| `audit/pages/process-owner/admin-BUGS.md` | 334 | non-tracciato (mtime fs) 2026-06-23 | BUGS — process-owner [admin] |
| `audit/pages/process-owner/core6-TODO.md` | 223 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — process-owner [admin] |
| `audit/pages/seed-acquisition__runs/admin-BUGS.md` | 498 | non-tracciato (mtime fs) 2026-06-23 | BUGS — seed-acquisition__runs [admin] |
| `audit/pages/seed-acquisition__runs/core6-TODO.md` | 232 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — seed-acquisition__runs [admin] |
| `audit/pages/skills/admin-BUGS.md` | 482 | non-tracciato (mtime fs) 2026-06-23 | BUGS — skills [admin] |
| `audit/pages/skills/core6-TODO.md` | 216 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — skills [admin] |
| `audit/pages/system-health/admin-BUGS.md` | 489 | non-tracciato (mtime fs) 2026-06-23 | BUGS — system-health [admin] |
| `audit/pages/system-health/core6-TODO.md` | 223 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — system-health [admin] |
| `audit/pages/tenants/admin-BUGS.md` | 483 | non-tracciato (mtime fs) 2026-06-23 | BUGS — tenants [admin] |
| `audit/pages/tenants/core6-TODO.md` | 217 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — tenants [admin] |
| `audit/pages/tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0/admin-BUGS.md` | 366 | non-tracciato (mtime fs) 2026-06-23 | BUGS — tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0 [admin] |
| `audit/pages/tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0/core6-TODO.md` | 255 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0 [admin] |
| `audit/pages/tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0__enterprise-typing/admin-BUGS.md` | 540 | non-tracciato (mtime fs) 2026-06-23 | BUGS — tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0__enterprise-typing [admin] |
| `audit/pages/tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0__enterprise-typing/core6-TODO.md` | 274 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0__enterprise-typing [admin] |
| `audit/pages/users/admin-BUGS.md` | 326 | non-tracciato (mtime fs) 2026-06-23 | BUGS — users [admin] |
| `audit/pages/users/core2-TODO.md` | 504 | non-tracciato (mtime fs) 2026-06-23 | CORE2 TODO — users [admin] |
| `audit/pages/users/core3-TODO.md` | 363 | non-tracciato (mtime fs) 2026-06-23 | CORE3 TODO — users [admin] |
| `audit/pages/users/core4-TODO.md` | 304 | non-tracciato (mtime fs) 2026-06-23 | CORE4 TODO — users [admin] |
| `audit/pages/users/core6-TODO.md` | 215 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — users [admin] |
| `audit/pages/users__b113459e-5102-4cdd-8f3b-37f654896d9d/admin-BUGS.md` | 519 | non-tracciato (mtime fs) 2026-06-23 | BUGS — users__b113459e-5102-4cdd-8f3b-37f654896d9d [admin] |
| `audit/pages/users__b113459e-5102-4cdd-8f3b-37f654896d9d/core6-TODO.md` | 253 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — users__b113459e-5102-4cdd-8f3b-37f654896d9d [admin] |
| `audit/pages/visualizations/admin-BUGS.md` | 490 | non-tracciato (mtime fs) 2026-06-23 | BUGS — visualizations [admin] |
| `audit/pages/visualizations/core6-TODO.md` | 224 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — visualizations [admin] |
| `audit/pages/visualizations__325ecb42-a79f-4426-93d2-263dc3584ade/admin-BUGS.md` | 528 | non-tracciato (mtime fs) 2026-06-23 | BUGS — visualizations__325ecb42-a79f-4426-93d2-263dc3584ade [admin] |
| `audit/pages/visualizations__325ecb42-a79f-4426-93d2-263dc3584ade/core6-TODO.md` | 262 | non-tracciato (mtime fs) 2026-06-23 | CORE6 TODO — visualizations__325ecb42-a79f-4426-93d2-263dc3584ade [admin] |
| `CLAUDE.md` | 38567 | 2026-08-24 | CLAUDE.md |
| `cowork_code_exchange/.inbox/cli/pending/2026-05-25T00-07-39Z__025__prompt_ready.md` | 1485 | 2026-05-25 | PROMPT 025 ready — X21 DEFER-F /showcase fix (recommended LAST in C19 sequence) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-18T23-10-02Z__002__prompt_ready.md` | 827 | 2026-05-26 | PROMPT 002 ready — json-extract-lineage-fullscale |
| `cowork_code_exchange/.inbox/cli/read/2026-05-19T02-57-15Z__002__approval_ready.md` | 694 | 2026-05-26 | APPROVAL 002 signed — proceed with EXEC |
| `cowork_code_exchange/.inbox/cli/read/2026-05-19T13-09-31Z__002__review_ready.md` | 792 | 2026-05-26 | REVIEW 002 posted — goal CLOSED |
| `cowork_code_exchange/.inbox/cli/read/2026-05-19T13-28-26Z__003__prompt_ready.md` | 928 | 2026-05-26 | PROMPT 003 ready — brownfield-seeding-complete |
| `cowork_code_exchange/.inbox/cli/read/2026-05-19T14-02-10Z__003__plan_amendment_requested.md` | 1174 | 2026-05-26 | PLAN 003 amendment requested |
| `cowork_code_exchange/.inbox/cli/read/2026-05-19T14-14-49Z__003__approval_ready.md` | 812 | 2026-05-26 | APPROVAL 003 signed — proceed with EXEC |
| `cowork_code_exchange/.inbox/cli/read/2026-05-19T23-15-00Z__003__prompt_amended.md` | 5183 | 2026-05-26 | PROMPT 003 amended v2→v3 — Wave 1 scope correction (Option β D2') |
| `cowork_code_exchange/.inbox/cli/read/2026-05-19T23-25-00Z__003__exec_directive_E1.md` | 5671 | 2026-05-26 | Option E1 APPROVED — verbal lock (no PROMPT v3.1) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-21T03-45-00Z__007__prompt_ready.md` | 2596 | 2026-05-26 | PROMPT 007 ready — Batch X4 launch authorized |
| `cowork_code_exchange/.inbox/cli/read/2026-05-21T11-39-00Z__008__prompt_ready.md` | 3668 | 2026-05-26 | PROMPT 008 ready — Batch X5 launch authorized |
| `cowork_code_exchange/.inbox/cli/read/2026-05-21T12-50-00Z__008__exec_directive_cw_b34.md` | 5734 | 2026-05-26 | EXEC DIRECTIVE — Option A approved + X5.B authorization parallela |
| `cowork_code_exchange/.inbox/cli/read/2026-05-21T13-55-00Z__011__prompt_ready.md` | 2764 | 2026-05-26 | PROMPT 011 ready — Batch X7 hardening sprint CW-B35/36/37 + trivials |
| `cowork_code_exchange/.inbox/cli/read/2026-05-21T17-30-00Z__012__prompt_ready.md` | 1951 | 2026-05-26 | PROMPT 012 ready — Batch X8 lightweight hardening (CW-B38 audit + CW-B39 cleanup) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-21T20-40-00Z__013__prompt_ready.md` | 2404 | 2026-05-23 | PROMPT 013 ready — Batch X9 SKILGRO MEGA-BUNDLE (5 blocks in 1 session) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-23T15-00-00Z__014__prompt_ready.md` | 1818 | 2026-05-23 | PROMPT 014 ready — CW-B49 engine fix (split-on-COALESCE bug) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-23T17-45-00Z__015__prompt_ready.md` | 2008 | 2026-05-23 | PROMPT 015 ready — Batch X11 HARDENING SPRINT (NOT new macro-area) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-23T19-00-00Z__016__prompt_ready.md` | 1926 | 2026-05-23 | PROMPT 016 ready — Batch X12 PIVOT MVP-2a Phase 0 API gap audit |
| `cowork_code_exchange/.inbox/cli/read/2026-05-24T14-26-07Z__022__prompt_ready.md` | 3428 | 2026-05-24 | PROMPT 022 ready — Batch X18 MVP-3 Tappa F (@heuresys/ui npm publish + apps/web versioned migration) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-24T14-58-00Z__022__prompt_amended.md` | 3883 | 2026-05-24 | PROMPT 022.1 amended — HALT-022-02 resolved via Path A (preserve all subpath + extend files) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-24T16-45-02Z__022__prompt_amended.md` | 5979 | 2026-05-24 | PROMPT 022.2 amended — HALT-022-03 resolved via Path A clean (tsup external aggressive + bump 0.1.1) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-24T17-08-26Z__022__prompt_amended.md` | 7321 | 2026-05-24 | PROMPT 022.3 amended — Path A* adopted (outExtension fix + bump 0.1.1, CW-B57 WITHDRAWN, CW-B58 mitigated) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-24T17-50-02Z__022__prompt_amended.md` | 4775 | 2026-05-24 | PROMPT 022.4 amended — Path β bisect (Enzo decision post-HALT-022-05) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-24T20-45-22Z__022__prompt_amended.md` | 5677 | 2026-05-24 | PROMPT 022.5 amended — X18 CLOSE Path B+C pragmatic, MVP-3 Tappa F SHIPPED con caveat |
| `cowork_code_exchange/.inbox/cli/read/2026-05-25T00-07-36Z__026__prompt_ready.md` | 718 | 2026-05-25 | PROMPT 026 ready — X19.A Dependabot CVE quick win (RECOMMENDED FIRST in C19 sequence) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-25T00-07-37Z__023__prompt_ready.md` | 902 | 2026-05-25 | PROMPT 023 ready — X19 Brownfield Wave 1 full-47k SQL upsert (recommended SECOND in C19 sequence) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-25T00-07-38Z__024__prompt_ready.md` | 845 | 2026-05-25 | PROMPT 024 ready — X20 MFA login-gating (recommended THIRD in C19 sequence) |
| `cowork_code_exchange/.inbox/cli/read/2026-05-25T02-37-27Z__024__prompt_amended.md` | 3457 | 2026-05-25 | PROMPT 024 amended — X20 GO post X19 accept-residual |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-18T23-15-33Z__002__pending_applied.md` | 439 | 2026-05-26 | Manifest applied — 2026-05-19T01:30:00Z |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T13-10-27Z__000__session_handoff.md` | 1063 | 2026-05-26 | Session handoff — cowork session ending 2026-05-19T13:10:27Z |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T13-49-26Z__003__plan_ready.md` | 1271 | 2026-05-26 | PLAN 003 ready for review — brownfield-seeding-complete |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T14-11-02Z__003__plan_ready.md` | 1438 | 2026-05-26 | PLAN 003 ready for review — brownfield-seeding-complete |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T14-54-21Z__003__exec_progress.md` | 1015 | 2026-05-26 | EXEC 003 progress update |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T15-00-40Z__003__exec_progress.md` | 1398 | 2026-05-26 | EXEC CHECKPOINT post-Items-D+M — 10/10 trigger tests PASS, ready for Item A |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T15-16-22Z__003__exec_progress.md` | 1252 | 2026-05-26 | Item A LOOKUP_FK fallback-only — COMPLETE, full suite 308/308 |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T18-49-10Z__003__exec_progress.md` | 1188 | 2026-05-26 | Item B CAST_* compat-target wrap — COMPLETE, full suite 318/318 |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T22-07-59Z__003__exec_progress.md` | 1357 | 2026-05-26 | EXEC DIAGNOSTIC REPORT Item F — silent-skip root cause + 3 fix paths (P1 recommended) |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T22-17-12Z__003__exec_progress.md` | 2075 | 2026-05-26 | EXEC CLASSB FINDINGS — registry-gap (6 unmapped NOT NULL FK columns), P1 commit 127e1a7 + HALT awaiting Cowork on P-B  |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T22-29-41Z__003__exec_progress.md` | 1421 | 2026-05-26 | EXEC CLASSB SUB-DISCOVERY HALT — registry gap multi-layered, 3 of 6 INFEASIBLE in Wave 1 scope |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-19T23-09-26Z__003__exec_progress.md` | 1505 | 2026-05-26 | EXEC CLASSB SEMANTIC FAIL — #3 course→module lineage = 0 matches; sys_learning_path_steps becomes 4th INFEASIBLE |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-20T00-05-26Z__003__exec_progress.md` | 1683 | 2026-05-26 | EXEC CLASSB UQ-BLOCK HALT — sys_skill_categories joins INFEASIBLE; 5 of 15 targets Goal 004 (CW-B20) |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-20T22-14-12Z__004__report_ready.md` | 363 | 2026-05-26 | Batch X1 Block A completed — REPORT 004 ready |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-21T01-53-26Z__005__report_ready.md` | 382 | 2026-05-26 | Batch X2 completed (3 blocks: A engine ✅, B partial, C SDBI ✅) |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-21T02-43-43Z__006__report_ready.md` | 407 | 2026-05-26 | Batch X3 completed — Block A ADR-0015 ✅, Block B lineage+users ✅, Block C deferred X4 |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-21T04-53-05Z__007__report_ready.md` | 410 | 2026-05-26 | Batch X4 Block A done (CW-B31 effective, ESCO skip, CW-B32 surfaced) — Block B deferred X4.B |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-21T12-19-00Z__008_halt_adr_0016_unexpected_fail.md` | 5589 | 2026-05-26 | HALT — ADR-0016 nullable FK insufficient, sys_esco_occupation_mappings still 0 |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-21T12-24-57Z__008__report_ready.md` | 413 | 2026-05-26 | Batch X5.A done (CW-B32 sys_job_roles 91→202 ✅) + Block B halted on CW-B34 (engine NK filter) |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-21T13-11-49Z__009__report_ready.md` | 1582 | 2026-05-26 | Batch X6.A done — CW-B34 engine patch shipped, ADR-0016 ACCEPTED, all 9 acceptance criteria met |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-21T14-04-34Z__010__report_ready.md` | 1948 | 2026-05-26 | Batch X5.B Block C + Block D shipped — Time/Leave SDBI + sys_users HYBRID (R-A2 PASS) |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-21T16-44-41Z__011__report_ready.md` | 3223 | 2026-05-26 | Batch X7 hardening shipped — CW-B35/36/37 fixes + CW-B38 inline migration + 3 candidate biases |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-21T19-20-05Z__012__report_ready.md` | 2164 | 2026-05-26 | Batch X8 hardening complete — CW-B38 audit clean + CW-B39 cleanup |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-23T14-19-00Z__013__report_ready.md` | 3960 | 2026-05-26 | Batch X9 SKILGRO mega-bundle shipped — A+B+C+D applied, E skipped per spec |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-23T16-16-00Z__014__report_ready.md` | 2495 | 2026-05-26 | Batch X10 CW-B49 engine fix + Wave 1 retry unlock |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-23T18-21-38Z__015__report_ready.md` | 1679 | 2026-05-26 | REPORT 015 ready — Batch X11 hardening sprint consolidation |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-23T19-04-31Z__016__report_ready.md` | 1818 | 2026-05-26 | REPORT 016 ready — X12 MVP-2a Phase 0 API gap audit (v2.0 post-execution validation) |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-24T14-35-08Z__022__halt_npm_not_logged_in.md` | 5114 | 2026-05-24 | HALT P0 — npm whoami E401 Unauthorized (Block A.0 pre-flight) |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-24T14-43-30Z__022__halt_exports_map_subpath_gap.md` | 8849 | 2026-05-24 | HALT P0 — Exports map spec gap: subpath consumers will break post-publish |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-24T15-50-39Z__022__halt_publish_2fa_required.md` | 7751 | 2026-05-24 | HALT P0 — Block C publish 2FA gate (npm E403) |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-24T16-32-00Z__022__halt_dual_package_hazard.md` | 9139 | 2026-05-24 | HALT P0 — Dual-package hazard post Block D.4/D.5 build |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-24T17-05-00Z__022__halt_cw_b57_misdiagnosis.md` | 11238 | 2026-05-24 | HALT P0 — CW-B57 misdiagnosis: tsup auto-externalizes deps by default |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-24T17-25-00Z__022__halt_persistent_build_fail.md` | 9038 | 2026-05-24 | HALT P0 — Persistent build fail across all configurations (Hypothesis A* + B + C + D all CONFUTED) |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-24T18-32-00Z__022__halt_bisect_inconclusive.md` | 12083 | 2026-05-24 | HALT P1 — Bisect inconclusive: NO single-component culprit identifiable via Path β |
| `cowork_code_exchange/.inbox/cowork/read/2026-05-25T01-44-28Z__023__halt_engine_residual_6_targets.md` | 3762 | 2026-05-25 | HALT P1 — X19 Brownfield Wave 1 (engine residual, 6 IMPORT targets) |
| `cowork_code_exchange/.inbox/INDEX.md` | 643 | non-tracciato (mtime fs) 2026-05-26 | Inbox INDEX |
| `cowork_code_exchange/_00_ARCHIVE_READONLY_NOTICE.md` | 555 | 2026-05-27 | ⛔ ARCHIVIO READ-ONLY — cowork_code_exchange |
| `cowork_code_exchange/_00_DISCOVERY_002_json-extract-lineage-fullscale.md` | 28482 | 2026-05-26 | Binary file ./cowork_code_exchange/_00_DISCOVERY_002_json-extract-lineage-fullscale.md matches |
| `cowork_code_exchange/_00_DISCOVERY_003_brownfield-seeding-complete.md` | 9313 | 2026-05-26 | _00_DISCOVERY_003_brownfield-seeding-complete.md |
| `cowork_code_exchange/_00_HANDOVER_CLI_2026-05-26_post_S937.md` | 91224 | 2026-07-25 | HANDOVER A CLI — Stato forense Heuresys Advanced (post S937) |
| `cowork_code_exchange/_00_SESSION_HANDOFF_2026-05-18.md` | 22004 | 2026-05-19 | _00_SESSION_HANDOFF_2026-05-18.md |
| `cowork_code_exchange/_00_SESSION_HANDOFF_2026-05-19.md` | 11080 | 2026-05-26 | _00_SESSION_HANDOFF_2026-05-19.md |
| `cowork_code_exchange/_00_SESSION_HANDOFF_2026-05-20.md` | 18106 | 2026-05-26 | Session Handoff — 2026-05-20 (Cowork side) |
| `cowork_code_exchange/_00_STATE_001.md` | 6040 | 2026-05-26 | Goal 001 — audit-upsert-refactor |
| `cowork_code_exchange/_00_STATE_002.md` | 8301 | 2026-05-26 | Goal 002 — json-extract-lineage-fullscale |
| `cowork_code_exchange/_00_STATE_003.md` | 15180 | 2026-05-26 | Goal 003 — brownfield-seeding-complete |
| `cowork_code_exchange/_01_PROMPT_001_audit_upsert_refactor.md` | 15253 | 2026-05-26 | _01_PROMPT_001_audit_upsert_refactor.md |
| `cowork_code_exchange/_01_PROMPT_002_json-extract-lineage-fullscale.md` | 27599 | 2026-05-26 | _01_PROMPT_002_json-extract-lineage-fullscale.md |
| `cowork_code_exchange/_01_PROMPT_003_brownfield-seeding-complete.md` | 22404 | 2026-05-26 | _01_PROMPT_003_brownfield-seeding-complete.md (v3 — Wave 1 scope correction post-Class-B sub-discovery) |
| `cowork_code_exchange/_01_PROMPT_003_v1.md` | 21047 | 2026-05-26 | _01_PROMPT_003_brownfield-seeding-complete.md |
| `cowork_code_exchange/_01_PROMPT_003_v2.md` | 14409 | 2026-05-26 | _01_PROMPT_003_brownfield-seeding-complete.md (v2 — Wave 1 closure single-focus) |
| `cowork_code_exchange/_01_PROMPT_004_batch_x1.md` | 33514 | 2026-05-26 | PROMPT 004 — CLI Batch X1 (Opt3 Phase 1 BLOCK A — self-contained briefing) |
| `cowork_code_exchange/_01_PROMPT_005_batch_x2.md` | 29103 | 2026-05-26 | PROMPT 005 — CLI Batch X2 (self-contained briefing) |
| `cowork_code_exchange/_01_PROMPT_006_batch_x3.md` | 16541 | 2026-05-26 | PROMPT 006 — CLI Batch X3 (self-contained briefing) |
| `cowork_code_exchange/_01_PROMPT_007_batch_x4.md` | 20584 | 2026-05-26 | PROMPT 007 — CLI Batch X4 (self-contained briefing) |
| `cowork_code_exchange/_01_PROMPT_008_batch_x5.md` | 18755 | 2026-05-26 | PROMPT 008 — CLI Batch X5 (self-contained briefing) |
| `cowork_code_exchange/_01_PROMPT_011_batch_x7.md` | 20435 | 2026-05-26 | PROMPT 011 — CLI Batch X7 (self-contained briefing) |
| `cowork_code_exchange/_01_PROMPT_012_batch_x8.md` | 10949 | 2026-05-26 | PROMPT 012 — CLI Batch X8 (self-contained briefing) |
| `cowork_code_exchange/_01_PROMPT_013_batch_x9.md` | 12862 | 2026-05-23 | PROMPT 013 — CLI Batch X9 SKILGRO (self-contained mega-bundle) |
| `cowork_code_exchange/_01_PROMPT_014_batch_x10.md` | 11719 | 2026-05-23 | PROMPT 014 — CLI Batch X10 (CW-B49 engine fix + Block B/C unlock retry) |
| `cowork_code_exchange/_01_PROMPT_015_batch_x11.md` | 13093 | 2026-05-23 | PROMPT 015 — CLI Batch X11 (hardening sprint consolidation) |
| `cowork_code_exchange/_01_PROMPT_016_batch_x12.md` | 8178 | 2026-05-23 | PROMPT 016 — CLI Batch X12 (MVP-2a Phase 0 API gap audit) |
| `cowork_code_exchange/_01_PROMPT_017_batch_x13.md` | 10623 | 2026-07-25 | PROMPT 017 — CLI Batch X13 (MVP-2a Coverage Hardening Sprint) |
| `cowork_code_exchange/_01_PROMPT_018_batch_x14.md` | 5149 | 2026-05-24 | PROMPT 018 — CLI Batch X14 (MVP-2a Final Live Validation) |
| `cowork_code_exchange/_01_PROMPT_019_batch_x15.md` | 9595 | 2026-05-24 | PROMPT 019 — CLI Batch X15 (MVP-2a E2E Validation against Production Build) |
| `cowork_code_exchange/_01_PROMPT_020_batch_x16.md` | 9421 | 2026-05-24 | PROMPT 020 — CLI Batch X16 (MVP-2a Final Certification + Release Tag) |
| `cowork_code_exchange/_01_PROMPT_021_batch_x17.md` | 6348 | 2026-05-24 | PROMPT 021 — CLI Batch X17 (D + B combo: tag push + showcase contract fix) |
| `cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md` | 15535 | 2026-05-24 | PROMPT 022.1 — AMENDMENT to PROMPT 022 (CLI Batch X18) — Exports map full-preservation + pre-flight consumer scan |
| `cowork_code_exchange/_01_PROMPT_022.2_batch_x18_amendment.md` | 18091 | 2026-05-24 | PROMPT 022.2 — AMENDMENT to PROMPT 022 + 022.1 (CLI Batch X18) — Dual-package hazard fix via tsup external aggressiv |
| `cowork_code_exchange/_01_PROMPT_022.3_batch_x18_amendment.md` | 15473 | 2026-05-24 | PROMPT 022.3 — AMENDMENT to PROMPT 022 + 022.1 + 022.2 (CLI Batch X18) — Path A* (outExtension fix only + bump 0.1.1 |
| `cowork_code_exchange/_01_PROMPT_022.4_batch_x18_amendment.md` | 14075 | 2026-05-24 | PROMPT 022.4 — AMENDMENT to PROMPT 022.x cascade (Path β bisect exports @heuresys/ui src/index.ts) |
| `cowork_code_exchange/_01_PROMPT_022.5_batch_x18_amendment.md` | 14907 | 2026-05-24 | PROMPT 022.5 — AMENDMENT (FINAL X18 CLOSE) — Path B+C pragmatic workaround + MVP-3 Tappa F SHIPPED with documented c |
| `cowork_code_exchange/_01_PROMPT_022_batch_x18.md` | 15051 | 2026-05-24 | PROMPT 022 — CLI Batch X18 (MVP-3 Tappa F — @heuresys/ui npm Publish + apps/web Versioned Migration) |
| `cowork_code_exchange/_01_PROMPT_023_batch_x19_brownfield_wave1.md` | 7851 | 2026-05-25 | PROMPT 023 — CLI Batch X19 (Brownfield Wave 1 full-47k SQL-side upsert) |
| `cowork_code_exchange/_01_PROMPT_024_batch_x20_mfa_login_gating.md` | 9326 | 2026-05-25 | PROMPT 024 — CLI Batch X20 (MFA login-gating — compose mfaService into auth.login + /login UI 2-step) |
| `cowork_code_exchange/_01_PROMPT_025_batch_x21_defer_f_showcase_fix.md` | 10869 | 2026-05-25 | PROMPT 025 — CLI Batch X21 (DEFER-F /showcase Next 15 RSC bundle threshold proper fix) |
| `cowork_code_exchange/_01_PROMPT_026_batch_x19a_dependabot_cve.md` | 5434 | 2026-05-25 | PROMPT 026 — CLI Batch X19.A (Dependabot CVE updates — 2 moderate) |
| `cowork_code_exchange/_01_PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md` | 8187 | 2026-05-26 | PROMPT 027 — SDBI Phase 2 kick-off (MVP-4 stream 2.4, scaling 7-9 macro-aree TRUE GAP) |
| `cowork_code_exchange/_02_PLAN_001_audit_upsert_refactor.md` | 12298 | 2026-05-26 | _02_PLAN_001_audit_upsert_refactor.md (v5 — closure gap fix) |
| `cowork_code_exchange/_02_PLAN_001_v3-bis.md` | 29006 | 2026-05-26 | _02_PLAN_001_audit_upsert_refactor.md (v3-bis — segmented + executor fixes) |
| `cowork_code_exchange/_02_PLAN_001_v4.md` | 24736 | 2026-05-26 | _02_PLAN_001_audit_upsert_refactor.md (v4 — post-evidence scope correction) |
| `cowork_code_exchange/_02_PLAN_002_json-extract-lineage-fullscale.md` | 44083 | 2026-05-26 | _02_PLAN_002_json-extract-lineage-fullscale.md |
| `cowork_code_exchange/_02_PLAN_003_brownfield-seeding-complete.md` | 45352 | 2026-05-26 | _02_PLAN_003_brownfield-seeding-complete.md (v2 — Wave 1 closure) |
| `cowork_code_exchange/_02_PLAN_003_v1.md` | 59884 | 2026-05-26 | _02_PLAN_003_brownfield-seeding-complete.md |
| `cowork_code_exchange/_02b_APPROVAL_001.md` | 4264 | 2026-05-26 | Approval — Goal 001 PLAN v3-bis |
| `cowork_code_exchange/_02b_APPROVAL_001_v5.md` | 5166 | 2026-05-26 | Approval — Goal 001 PLAN v5 (retrofit, post-closure) |
| `cowork_code_exchange/_02b_APPROVAL_002.md` | 4548 | 2026-05-26 | Approval — Goal 002 PLAN v1 |
| `cowork_code_exchange/_02b_APPROVAL_003.md` | 5103 | 2026-05-26 | Approval — Goal 003 PLAN v2 |
| `cowork_code_exchange/_03_EXEC_001_audit_upsert_refactor.md` | 7662 | 2026-05-26 | _03_EXEC_001_audit_upsert_refactor.md |
| `cowork_code_exchange/_03_EXEC_001a_audit_upsert_refactor.md` | 39405 | 2026-05-18 | _03_EXEC_001a_audit_upsert_refactor.md |
| `cowork_code_exchange/_03_EXEC_002_json-extract-lineage-fullscale.md` | 13082 | 2026-05-19 | _03_EXEC_002_json-extract-lineage-fullscale.md |
| `cowork_code_exchange/_03_EXEC_003_brownfield-seeding-complete.md` | 34029 | 2026-05-26 | _03_EXEC_003_brownfield-seeding-complete.md |
| `cowork_code_exchange/_03_EXEC_003_CLASSB_FINDINGS_Item_F.md` | 8437 | 2026-05-26 | EXEC CLASS B FINDINGS — Item F second-pass diagnostic |
| `cowork_code_exchange/_03_EXEC_003_CLASSB_SEMANTIC_FAIL_Item_F.md` | 9071 | 2026-05-26 | EXEC CLASS B SEMANTIC FAIL — INSERT #3 course→module lineage mismatch |
| `cowork_code_exchange/_03_EXEC_003_CLASSB_SUBDISCOVERY_Item_F.md` | 8624 | 2026-05-26 | EXEC CLASS B SUB-DISCOVERY — registry gap is multi-layered |
| `cowork_code_exchange/_03_EXEC_003_CLASSB_UQ_BLOCK_Item_F.md` | 9270 | 2026-05-26 | EXEC CLASS B UQ COLLISION — INSERT #1 also INFEASIBLE; sys_skill_categories joins INFEASIBLE list |
| `cowork_code_exchange/_03_EXEC_003_DIAGNOSTIC_REPORT_Item_F.md` | 10168 | 2026-05-26 | EXEC DIAGNOSTIC REPORT — Item F silent-skip root cause |
| `cowork_code_exchange/_04_REPORT_001a_audit_upsert_refactor.md` | 19570 | 2026-05-18 | _04_REPORT_001a_audit_upsert_refactor.md (final, supersedes interim) |
| `cowork_code_exchange/_04_REPORT_001a_interim.md` | 18522 | 2026-05-18 | _04_REPORT_001a_audit_upsert_refactor.md |
| `cowork_code_exchange/_04_REPORT_002_json-extract-lineage-fullscale.md` | 12781 | 2026-05-19 | _04_REPORT_002_json-extract-lineage-fullscale.md |
| `cowork_code_exchange/_04_REPORT_003_brownfield-seeding-complete.md` | 16873 | 2026-05-26 | REPORT 003 — brownfield-seeding-complete (formal closure post-suspension) |
| `cowork_code_exchange/_04_REPORT_004_batch_x1.md` | 21829 | 2026-05-26 | REPORT 004 — CLI Batch X1 Block A |
| `cowork_code_exchange/_04_REPORT_005_batch_x2.md` | 20824 | 2026-05-26 | REPORT 005 — CLI Batch X2 |
| `cowork_code_exchange/_04_REPORT_006_batch_x3.md` | 15254 | 2026-05-26 | REPORT 006 — CLI Batch X3 |
| `cowork_code_exchange/_04_REPORT_007_batch_x4.md` | 13431 | 2026-05-26 | REPORT 007 — CLI Batch X4 |
| `cowork_code_exchange/_04_REPORT_008_batch_x5.md` | 9671 | 2026-05-26 | REPORT 008 — CLI Batch X5.A (interim, A+B; C+D pending halt resolution + X5.B session) |
| `cowork_code_exchange/_04_REPORT_009_batch_x6a.md` | 12545 | 2026-05-26 | REPORT 009 — CLI Batch X6.A (CW-B34 engine patch — SUCCESS, ADR-0016 ACCEPTED) |
| `cowork_code_exchange/_04_REPORT_010_batch_x5b.md` | 14740 | 2026-05-21 | REPORT 010 — CLI Batch X5.B (Block C Time/Leave SDBI + Block D sys_users HYBRID — BOTH SUCCESS) |
| `cowork_code_exchange/_04_REPORT_011_batch_x7.md` | 16901 | 2026-05-21 | REPORT 011 — CLI Batch X7 (CW-B35/36/37 hardening + CW-B38 surface fix) |
| `cowork_code_exchange/_04_REPORT_012_batch_x8.md` | 10265 | 2026-05-21 | REPORT 012 — CLI Batch X8 (CW-B38 audit verify + CW-B39 cleanup — SUCCESS) |
| `cowork_code_exchange/_04_REPORT_013_batch_x9.md` | 18986 | 2026-05-23 | REPORT 013 — X9 SKILGRO mega-bundle outcomes |
| `cowork_code_exchange/_04_REPORT_014_batch_x10.md` | 9538 | 2026-05-23 | REPORT 014 — X10 CW-B49 engine fix + Block B/C unlock retry |
| `cowork_code_exchange/_04_REPORT_015_batch_x11.md` | 18250 | 2026-05-23 | REPORT 015 — CLI Batch X11 (hardening sprint consolidation) |
| `cowork_code_exchange/_04_REPORT_016_batch_x12.md` | 11914 | 2026-05-23 | REPORT 016 — CLI Batch X12 (MVP-2a Phase 0 API gap audit — post-execution validation) |
| `cowork_code_exchange/_04_REPORT_017_batch_x13.md` | 15557 | 2026-05-23 | REPORT 017 — CLI Batch X13 (MVP-2a Coverage Hardening Sprint) |
| `cowork_code_exchange/_04_REPORT_018_batch_x14.md` | 14594 | 2026-05-24 | REPORT 018 — CLI Batch X14 (MVP-2a Final Live Validation) |
| `cowork_code_exchange/_04_REPORT_019_batch_x15.md` | 11890 | 2026-05-24 | REPORT 019 — CLI Batch X15 (MVP-2a E2E Validation against Production Build) |
| `cowork_code_exchange/_04_REPORT_020_batch_x16.md` | 10916 | 2026-05-24 | REPORT 020 — CLI Batch X16 (MVP-2a Final Certification + Release Tag) |
| `cowork_code_exchange/_04_REPORT_021_batch_x17.md` | 11705 | 2026-05-24 | REPORT 021 — CLI Batch X17 (D + B combo: tag push + showcase contract fix) |
| `cowork_code_exchange/_04_REPORT_022_batch_x18.md` | 46338 | 2026-05-24 | REPORT 022 — CLI Batch X18 (MVP-3 Tappa F) — **PRE_BLOCK_A_HALT_P0 (spec gap)** |
| `cowork_code_exchange/_04_REPORT_023_batch_x19.md` | 5086 | 2026-05-25 | REPORT 023 — CLI Batch X19 (Brownfield Wave 1 full-47k SQL upsert) |
| `cowork_code_exchange/_04_REPORT_024_batch_x20.md` | 6617 | 2026-05-25 | REPORT 024 — CLI Batch X20 (MFA login-gating) |
| `cowork_code_exchange/_04_REPORT_026_batch_x19a.md` | 4557 | 2026-05-25 | REPORT 026 — CLI Batch X19.A (Dependabot CVE — uuid bump) |
| `cowork_code_exchange/_05_REVIEW_001a_audit_upsert_refactor.md` | 20007 | 2026-05-18 | _05_REVIEW_001a_audit_upsert_refactor.md |
| `cowork_code_exchange/_05_REVIEW_002_json-extract-lineage-fullscale.md` | 14658 | 2026-05-26 | _05_REVIEW_002_json-extract-lineage-fullscale.md |
| `cowork_code_exchange/_05_REVIEW_003_brownfield-seeding-complete.md` | 11718 | 2026-05-26 | REVIEW 003 — brownfield-seeding-complete (formal closure verdict, retroactive) |
| `cowork_code_exchange/_05_REVIEW_004_batch_x1.md` | 11127 | 2026-05-26 | REVIEW 004 — Batch X1 Block A + Class B fixes + Wave 1 retry |
| `cowork_code_exchange/_05_REVIEW_005_batch_x2.md` | 14888 | 2026-05-26 | REVIEW 005 — Batch X2 Block A engine + Block B cascade + Block C SDBI pilot |
| `cowork_code_exchange/_99_archive_DRAFT_PROMPT_022_tappa_f.md` | 13093 | 2026-05-24 | DRAFT PROMPT 021 — CLI Batch X17 (MVP-3 Tappa F — @heuresys/ui npm Publish + apps/web Migration) |
| `cowork_code_exchange/_99_DB_INVENTORY_2026-05-20.md` | 28184 | 2026-05-26 | DB Inventory CORRECTED — heuresys cluster (2026-05-20T01:30 GMT+2) |
| `cowork_code_exchange/_SKILL_UPDATE_MEMO.md` | 7627 | 2026-05-26 | Skill Update Memo — `cowork-cli-orchestrator` alignment to protocol v2 |
| `cowork_code_exchange/_templates/_00_DISCOVERY.template.md` | 2343 | 2026-05-26 | _00_DISCOVERY_<NNN>_<slug>.md |
| `cowork_code_exchange/_templates/_00_STATE.template.md` | 1409 | 2026-05-26 | Goal <NNN> — <slug> |
| `cowork_code_exchange/_templates/_01_PROMPT.template.md` | 4574 | 2026-05-26 | _01_PROMPT_<NNN>_<slug>.md |
| `cowork_code_exchange/_templates/_02_PLAN.template.md` | 3872 | 2026-05-26 | _02_PLAN_<NNN>_<slug>.md |
| `cowork_code_exchange/_templates/_02b_APPROVAL.template.md` | 1051 | 2026-05-26 | Approval — Goal <NNN> PLAN v<X> |
| `cowork_code_exchange/_templates/_03_EXEC.template.md` | 2636 | 2026-05-26 | _03_EXEC_<NNN>[<resume>]_<slug>.md |
| `cowork_code_exchange/_templates/_04_REPORT.template.md` | 2491 | 2026-05-26 | _04_REPORT_<NNN>_<slug>.md |
| `cowork_code_exchange/_templates/_05_REVIEW.template.md` | 1891 | 2026-05-26 | _05_REVIEW_<NNN>_<slug>.md |
| `cowork_code_exchange/baselines/INDEX.md` | 5487 | 2026-05-26 | Baselines INDEX |
| `cowork_code_exchange/cli-prompt.md` | 9176 | 2026-07-25 | cli-prompt — Asse professione ISCO-08 + CP2021 (bilingue) — PROPOSTA di implementazione (Cowork → CLI) |
| `cowork_code_exchange/GOAL_B_REPORT_2026-05-18.md` | 12156 | 2026-05-26 | Goal B — Lineage + HANDOFF reconciliation + staging cleanup + stats refresh |
| `cowork_code_exchange/MIGRATION_STATUS_2026-05-18.md` | 67204 | 2026-05-26 | Migration Status — `evo.heuresys.com` → `heuresys-advanced` |
| `cowork_code_exchange/README.md` | 21432 | 2026-05-19 | Cowork ↔ Claude Code CLI exchange directory — v2.2 |
| `cowork_reserved/_ARCHIVE_READONLY.md` | 677 | 2026-05-27 | ⛔ ARCHIVIO READ-ONLY — cowork_reserved |
| `cowork_reserved/00_README_KB.md` | 10407 | 2026-05-26 | Knowledge Base — Forensic Audit + Strategic Reformulation |
| `cowork_reserved/01_DB_PLATFORM_INVENTORY.md` | 21778 | 2026-05-26 | Forensic Inventory — `heuresys_platform` (SOURCE legacy heuresys-evo) |
| `cowork_reserved/02a_ADV_SYS.md` | 12841 | 2026-05-26 | Forensic Inventory — `heuresys_advanced.sys` (TARGET schema) |
| `cowork_reserved/02b_ADV_LEGACY_MIRROR.md` | 8040 | 2026-05-26 | Forensic Inventory — `heuresys_advanced.legacy_mirror` |
| `cowork_reserved/02c_ADV_STAGING.md` | 5388 | 2026-05-26 | Forensic Inventory — `heuresys_advanced.staging` |
| `cowork_reserved/02d_ADV_BROWNFIELD.md` | 8076 | 2026-05-26 | Forensic Inventory — `heuresys_advanced.brownfield` |
| `cowork_reserved/02e_ADV_AUDIT.md` | 4692 | 2026-05-26 | Forensic Inventory — `heuresys_advanced.audit` |
| `cowork_reserved/02f_ADV_PUBLIC.md` | 1183 | 2026-05-26 | Forensic Inventory — `heuresys_advanced.public` |
| `cowork_reserved/04_MIGRATIONS_TIMELINE.md` | 55932 | 2026-05-26 | Migrations Timeline — heuresys_advanced 33 migrations |
| `cowork_reserved/05_EXTRACT_SCRIPTS_FORENSIC.md` | 18898 | 2026-05-26 | Extract Scripts Forensic — Out-of-Migration Genesis |
| `cowork_reserved/06_BROWNFIELD_REGISTRY_DEEP_DIVE.md` | 13102 | 2026-05-26 | Brownfield Registry — Deep Dive |
| `cowork_reserved/07_TRANSFORM_COMPILER_ANALYSIS.md` | 39179 | 2026-05-26 | Transform Compiler + Upsert SQL — Deep Code Audit |
| `cowork_reserved/08_AUDIT_TRAIL_ANALYSIS.md` | 31434 | 2026-05-26 | Audit Trail — Forensic Deep Dive |
| `cowork_reserved/09_LEXICON_DOMAINS_MAPPING.md` | 15187 | 2026-05-26 | CASCADIA Lexicon Domains — Mapping |
| `cowork_reserved/10_GAPS_ANALYSIS.md` | 50678 | 2026-05-26 | Gaps Analysis — Real vs Apparent |
| `cowork_reserved/11_STRATEGIC_REFORMULATION.md` | 24860 | 2026-05-26 | Strategic Reformulation — Evidence-Based Recommendation |
| `cowork_reserved/12_TODO_LIST_GRANULARE.md` | 22608 | 2026-05-26 | TODO List Granulare — Master Plan Post-Audit |
| `cowork_reserved/batch_c1/C1_4_MIRROR_GAP_fix_report.md` | 2266 | 2026-05-26 | C1.4 — Class C MIRROR GAP fix: completed ✅ |
| `cowork_reserved/batch_c1/class_b_diagnostics/00_SUMMARY.md` | 10783 | 2026-05-26 | Class B Diagnostics — Summary |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_blueprint_overrides.md` | 4189 | 2026-05-26 | Class B Diagnostic — sys_blueprint_overrides |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_esco_occupation_mappings.md` | 3568 | 2026-05-26 | Class B Diagnostic — sys_esco_occupation_mappings |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_job_families.md` | 3113 | 2026-05-26 | Class B Diagnostic — sys_job_families |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_job_roles.md` | 2846 | 2026-05-26 | Class B Diagnostic — sys_job_roles |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_learning_path_steps.md` | 3939 | 2026-05-26 | Class B Diagnostic — sys_learning_path_steps |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_position_learning_requirements.md` | 2708 | 2026-05-26 | Class B Diagnostic — sys_position_learning_requirements |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_position_skill_requirements.md` | 4509 | 2026-05-26 | Class B Diagnostic — sys_position_skill_requirements |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_process_kpi_templates.md` | 3536 | 2026-05-26 | Class B Diagnostic — sys_process_kpi_templates |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_skill_aliases.md` | 4165 | 2026-05-26 | Class B Diagnostic — sys_skill_aliases |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_skill_categories.md` | 4227 | 2026-05-26 | Class B Diagnostic — sys_skill_categories |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_skill_learning_mappings.md` | 3712 | 2026-05-26 | Class B Diagnostic — sys_skill_learning_mappings |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_skill_taxonomy_edges.md` | 4822 | 2026-05-26 | Class B Diagnostic — sys_skill_taxonomy_edges |
| `cowork_reserved/batch_c1/cw_b17_patches/CW_B17_PATCH_SPEC.md` | 10022 | 2026-05-26 | CW-B17 Patch Spec — Silent-Skip Audit Class |
| `cowork_reserved/batch_c1/goals_pilot/00_README_GOALS_PILOT.md` | 11683 | 2026-05-26 | SDBI Pilot — Goals/OKRs (Batch C1.8) |
| `cowork_reserved/batch_c1/goals_pilot/01_SOURCE_DISCOVERY.md` | 22099 | 2026-05-26 | Phase 1 — SOURCE DISCOVERY — Goals/OKRs (Batch C1.8) |
| `cowork_reserved/batch_c1/goals_pilot/02_TARGET_SCHEMA_PROPOSAL.md` | 28136 | 2026-05-26 | Phase 2 — TARGET SCHEMA PROPOSAL — Goals/OKRs (Batch C1.8) |
| `cowork_reserved/batch_c1/goals_pilot/04_PHASE3_TEMP_SDBI_DDL.md` | 22168 | 2026-05-26 | Phase 3 — `temp_sdbi.*` mirror DDLs (Goals/OKRs pilot) |
| `cowork_reserved/batch_c1/goals_pilot/05_PHASE5_CONSOLIDATION_PLAN.md` | 19214 | 2026-05-26 | Phase 5 — Consolidation plan: `temp_sdbi.*` → `sys.*` (Goals/OKRs pilot) |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/goal_alignments_sys_goal_alignments.md` | 2192 | 2026-05-26 | Mapping Card — `public.goal_alignments` → `sys.sys_goal_alignments` |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/goal_check_ins_sys_goal_check_ins.md` | 2814 | 2026-05-26 | Mapping Card — `public.goal_check_ins` → `sys.sys_goal_check_ins` |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/goal_comments_sys_goal_comments.md` | 2221 | 2026-05-26 | Mapping Card — `public.goal_comments` → `sys.sys_goal_comments` |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/goal_milestones_sys_goal_milestones.md` | 3056 | 2026-05-26 | Mapping Card — `public.goal_milestones` → `sys.sys_goal_milestones` |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/goal_templates_sys_goal_templates.md` | 3641 | 2026-05-26 | Mapping Card — `public.goal_templates` → `sys.sys_goal_templates` |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/goal_updates_sys_goal_updates.md` | 2702 | 2026-05-26 | Mapping Card — `public.goal_updates` → `sys.sys_goal_updates` |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/goals_sys_goals.md` | 8422 | 2026-05-26 | Mapping Card — `public.goals` → `sys.sys_goals` |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/key_results_sys_okr_key_results.md` | 3220 | 2026-05-26 | Mapping Card — `public.key_results` → `sys.sys_okr_key_results` |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/okr_check_ins_AND_okr_checkins_sys_okr_check_ins.md` | 6768 | 2026-05-26 | Mapping Card — `public.okr_check_ins` + `public.okr_checkins` → `sys.sys_okr_check_ins` (MERGE) |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/okrs_sys_okrs.md` | 4260 | 2026-05-26 | Mapping Card — `public.okrs` → `sys.sys_okrs` |
| `cowork_reserved/batch_c1/P5_heuresys_test_decision.md` | 6184 | 2026-05-26 | P-5 heuresys_test inspection + decision (CORRECTED) |
| `cowork_reserved/batch_c10/forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md` | 9001 | 2026-05-23 | CW-B49 Forensic — Root cause + patch spec |
| `cowork_reserved/batch_c10/loop_watchdog/01_LOOP_WATCHDOG_PROMPT.md` | 8777 | 2026-05-26 | `/loop` watchdog PROMPT autoritativo — Cowork↔CLI session-bounded automation |
| `cowork_reserved/batch_c12/01_STRATEGIC_ANALYSIS.md` | 9221 | 2026-05-23 | Strategic Analysis post-X11 — SDBI capacity exhaustion + pivot options |
| `cowork_reserved/batch_c2/cascade_fixes/00_README_CASCADE_FIXES.md` | 12714 | 2026-05-26 | Batch C2.2 — Cascade Class B Authoring Fixes |
| `cowork_reserved/batch_c2/engine_patches/00_README_ENGINE_PATCHES.md` | 11240 | 2026-05-26 | 00 README — Engine Patches Batch C2.1 |
| `cowork_reserved/batch_c2/engine_patches/CW_B22_PATCH_SPEC.md` | 19631 | 2026-05-26 | CW-B22 Patch Spec — `IS NOT DISTINCT FROM` → `=` optimization |
| `cowork_reserved/batch_c2/engine_patches/CW_B23_PATCH_SPEC.md` | 21025 | 2026-05-26 | CW-B23 Patch Spec — ANALYZE staging tables post-populate |
| `cowork_reserved/batch_c2/engine_patches/CW_B24_PATCH_SPEC.md` | 26313 | 2026-05-26 | CW-B24 Patch Spec — Lineage self-conflict fix (deduplication) |
| `cowork_reserved/batch_c3/sdbi_scale/00_MASTER_INDEX.md` | 11196 | 2026-05-26 | SDBI Scale Plan — 11 macro-aree TRUE GAP — MASTER INDEX |
| `cowork_reserved/batch_c3/sdbi_scale/01_PerformanceReviews.md` | 4075 | 2026-05-26 | Macro-area 01 — Performance Reviews + Calibration |
| `cowork_reserved/batch_c3/sdbi_scale/02_RecruitingHiring.md` | 3408 | 2026-05-26 | Macro-area 02 — Recruiting + Hiring |
| `cowork_reserved/batch_c3/sdbi_scale/03_OnboardingPreboarding.md` | 2302 | 2026-05-26 | Macro-area 03 — Onboarding + Preboarding |
| `cowork_reserved/batch_c3/sdbi_scale/04_SurveysEngagementWellbeing.md` | 3143 | 2026-05-26 | Macro-area 04 — Surveys + Engagement + Wellbeing |
| `cowork_reserved/batch_c3/sdbi_scale/05_TimeLeaveAttendance.md` | 3091 | 2026-05-26 | Macro-area 05 — Time + Leave + Attendance |
| `cowork_reserved/batch_c3/sdbi_scale/06_FeedbackSystems.md` | 2638 | 2026-05-26 | Macro-area 06 — Feedback systems |
| `cowork_reserved/batch_c3/sdbi_scale/07_Mentorship.md` | 2297 | 2026-05-26 | Macro-area 07 — Mentorship |
| `cowork_reserved/batch_c3/sdbi_scale/08_PredictionsML.md` | 2563 | 2026-05-26 | Macro-area 08 — Predictions + ML |
| `cowork_reserved/batch_c3/sdbi_scale/09_CompensationExt.md` | 2755 | 2026-05-26 | Macro-area 09 — Compensation extension |
| `cowork_reserved/batch_c3/sdbi_scale/10_DocumentsSignatures.md` | 2688 | 2026-05-26 | Macro-area 10 — Documents + Signatures |
| `cowork_reserved/batch_c3/sdbi_scale/11_TalentPoolExt.md` | 2758 | 2026-05-26 | Macro-area 11 — Talent Pool ext |
| `cowork_reserved/batch_c4/cross_os_fixes/README.md` | 4931 | 2026-05-26 | Cross-OS Fixes — CW-B28/B29/B30 mitigations |
| `cowork_reserved/batch_c4/esco_cascade/02_sys_esco_occupation_mappings_RETRY.md` | 4375 | 2026-05-26 | sys_esco_occupation_mappings cascade RETRY (post X3 sys_job_roles=91) |
| `cowork_reserved/batch_c4/investigations/01_job_templates_failure_root_cause.md` | 8216 | 2026-05-26 | Investigation — job_templates 140 → 0 upserted (REPORT X3 anomaly) |
| `cowork_reserved/batch_c4/sys_users_sdbi/00_README_SYS_USERS_SDBI.md` | 13523 | 2026-05-26 | sys_users SDBI Extension Pilot — Index |
| `cowork_reserved/batch_c4/sys_users_sdbi/01_SOURCE_ANALYSIS.md` | 18790 | 2026-05-26 | 01 — Source Analysis: legacy_mirror.users + employees_core + employees_pii |
| `cowork_reserved/batch_c4/sys_users_sdbi/02_MAPPING_STRATEGY.md` | 13377 | 2026-05-26 | 02 — Mapping Strategy: legacy_mirror → sys.sys_users |
| `cowork_reserved/batch_c4/sys_users_sdbi/03_PHASE3_TEMP_SDBI_DDL.md` | 12358 | 2026-05-26 | 03 — Phase 3: temp_sdbi.sys_users Mirror DDL + INSERT-SELECT |
| `cowork_reserved/batch_c4/sys_users_sdbi/04_PHASE5_CONSOLIDATION_PLAN.md` | 12372 | 2026-05-26 | 04 — Phase 5: UPSERT into sys.sys_users + Lineage Emission |
| `cowork_reserved/batch_c4/time_leave_pilot/00_README_TIME_LEAVE_PILOT.md` | 14543 | 2026-05-26 | SDBI Pilot — Time/Leave/Attendance (Batch C4.2) |
| `cowork_reserved/batch_c4/time_leave_pilot/01_SOURCE_DISCOVERY.md` | 15316 | 2026-05-26 | Phase 1 — SOURCE DISCOVERY — Time/Leave/Attendance (Batch C4.2) |
| `cowork_reserved/batch_c4/time_leave_pilot/02_TARGET_SCHEMA_PROPOSAL.md` | 24967 | 2026-05-26 | Phase 2 — TARGET SCHEMA PROPOSAL — Time/Leave/Attendance (Batch C4.2) |
| `cowork_reserved/batch_c4/time_leave_pilot/03_PHASE3_TEMP_SDBI_DDL.md` | 19644 | 2026-05-26 | Phase 3 — `temp_sdbi.*` mirror DDLs (Time/Leave pilot) |
| `cowork_reserved/batch_c4/time_leave_pilot/04_PHASE5_CONSOLIDATION_PLAN.md` | 22575 | 2026-05-26 | Phase 5 — Consolidation plan: `temp_sdbi.*` → `sys.*` (Time/Leave pilot) |
| `cowork_reserved/batch_c4/time_leave_pilot/mapping_cards/employee_attendance__sys_attendance.md` | 8058 | 2026-05-26 | Mapping Card — `public.employee_attendance` → `sys.sys_attendance` |
| `cowork_reserved/batch_c4/time_leave_pilot/mapping_cards/employee_overtime__sys_overtime.md` | 5717 | 2026-05-26 | Mapping Card — `public.employee_overtime` → `sys.sys_overtime` |
| `cowork_reserved/batch_c4/time_leave_pilot/mapping_cards/employee_time_off_balances__sys_time_off_balances.md` | 4633 | 2026-05-26 | Mapping Card — `public.employee_time_off_balances` → `sys.sys_time_off_balances` |
| `cowork_reserved/batch_c5/enum_fix/CW_B32_PATCH_SPEC.md` | 9662 | 2026-05-26 | CW-B32 Patch Spec — CAST_ENUM transform + org_level mapping fix |
| `cowork_reserved/batch_c5/x4b_retrigger/README.md` | 5796 | 2026-05-26 | X4.B re-trigger update — Block B unchanged + sequencing |
| `cowork_reserved/batch_c5/xos_lib/README.md` | 4540 | 2026-05-26 | xos_lib — Cross-OS Pipeline Library (CW-B28 mitigation) |
| `cowork_reserved/batch_c6/cw_b34_engine_patch/CW_B34_PATCH_SPEC.md` | 14949 | 2026-05-26 | CW-B34 Patch Spec — Nullable NK UUID columns in WHERE skip filter |
| `cowork_reserved/batch_c7/forensic_cw_b35/01_CW_B35_FORENSIC.md` | 8874 | 2026-05-26 | CW-B35 Forensic — sys_skill_taxonomy_edges.parent_id / child_id IMPORT GAP |
| `cowork_reserved/batch_c7/forensic_cw_b36/01_CW_B36_FORENSIC.md` | 8110 | 2026-05-26 | CW-B36 Forensic — sys_skill_categories.skill_category_family_id MAPPING MISCLASSIFICATION |
| `cowork_reserved/batch_c7/forensic_cw_b37/01_CW_B37_FORENSIC.md` | 7546 | 2026-05-26 | CW-B37 Forensic — sys_skill_learning_mappings.skill_id mixed IMPORT/LOOKUP-BUG |
| `cowork_reserved/batch_c8/cw_b38_generalization/01_CW_B38_GENERALIZATION_SPEC.md` | 5995 | 2026-05-26 | CW-B38 Generalization — Nullable NK UUID + NULLS NOT DISTINCT companion (preventive) |
| `cowork_reserved/batch_c8/cw_b39_forensic/01_CW_B39_FORENSIC.md` | 7751 | 2026-05-26 | CW-B39 Forensic — sys_learning_path_steps.path_id (688 missing) |
| `cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md` | 10523 | 2026-05-23 | ADR-0017 — LOOKUP_FK_2HOP transform (engine extension) |
| `cowork_reserved/batch_c9/cw_b35_phase_bc/01_FORENSIC.md` | 5148 | 2026-05-26 | CW-B35 Phase B+C — sys_skill_taxonomy_edges residual 331 rows |
| `cowork_reserved/batch_c9/sys_learning_modules_forensic/01_FORENSIC.md` | 8665 | 2026-05-26 | Sys_learning_modules canonical re-mapping forensic |
| `cowork_reserved/bias_registry.md` | 29586 | 2026-05-27 | Bias Registry — Single Source of Truth (SoT) |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` | 84124 | 2026-05-25 | Cowork → CLI PROMPT Pattern (memo cross-session) |
| `cowork_reserved/HANDOFF_FRESH_SESSION.md` | 27959 | 2026-05-27 | HANDOFF — Fresh Cowork Session Bootstrap (ARCHIVIO STORICO — vedi redirect sopra) |
| `db/data/esco/README.md` | 2408 | 2026-07-21 | ESCO dataset (v1.2.0, IT) — input di riferimento per l'i18n dei dati |
| `db/data/occupations/README.md` | 1847 | 2026-07-22 | Occupations dataset (ISCO-08 + CP2021, bilingue) — asse PROFESSIONE |
| `db/scripts/_lib/README.md` | 4540 | 2026-05-21 | xos_lib — Cross-OS Pipeline Library (CW-B28 mitigation) |
| `db/scripts/README.md` | 8870 | 2026-08-07 | `db/scripts/` — Database Bootstrap & Operations |
| `db/seeds/rtl-banking-skills/README.md` | 3067 | 2026-08-13 | `rtl-banking-skills` — che cosa sono questi file, e quali si possono rilanciare |
| `db/seeds/rtl-rebuild/README.md` | 7227 | 2026-06-01 | RTL tenant rebuild — WRITE seed set (DRAFT for review) |
| `db/seeds/rtl-rebuild/RETIRED.md` | 2591 | 2026-08-07 | `db/seeds/rtl-rebuild/` — RITIRATO (2026-08-07, S1049) |
| `db/seeds/storia36/README.md` | 4894 | 2026-07-28 | db/seeds/storia36 — seed del programma "36 mesi di storia RTL" |
| `deploy/postgres/README.md` | 3248 | 2026-08-21 | Configurazione del server PostgreSQL di produzione |
| `deploy/README.md` | 15875 | 2026-07-16 | Deploying / running heuresys-advanced |
| `deploy/reports/claude-align/drift-linuxpc-20260820T235512Z.md` | 9010 | non-tracciato (mtime fs) 2026-08-21 | Drift report — linuxpc (linux-pc) — 20260820T235512Z |
| `deploy/reports/claude-align/drift-linuxpc-20260821T002708Z.md` | 9008 | non-tracciato (mtime fs) 2026-08-21 | Drift report — linuxpc (linux-pc) — 20260821T002708Z |
| `deploy/reports/claude-align/drift-linuxpc-20260821T233218Z.md` | 9008 | non-tracciato (mtime fs) 2026-08-22 | Drift report — linuxpc (linux-pc) — 20260821T233218Z |
| `deploy/reports/claude-align/drift-linuxpc-20260824T000605Z.md` | 9008 | non-tracciato (mtime fs) 2026-08-24 | Drift report — linuxpc (linux-pc) — 20260824T000605Z |
| `deploy/reports/claude-align/drift-linuxpc-20260824T005516Z.md` | 9008 | non-tracciato (mtime fs) 2026-08-24 | Drift report — linuxpc (linux-pc) — 20260824T005516Z |
| `deploy/reports/claude-align/drift-linuxpc-20260824T154057Z.md` | 9091 | non-tracciato (mtime fs) 2026-08-24 | Drift report — linuxpc (linux-pc) — 20260824T154057Z |
| `deploy/reports/claude-align/drift-linuxpc-20260824T170512Z.md` | 9091 | non-tracciato (mtime fs) 2026-08-24 | Drift report — linuxpc (linux-pc) — 20260824T170512Z |
| `deploy/reports/claude-align/drift-linuxpc-20260824T172838Z.md` | 9091 | non-tracciato (mtime fs) 2026-08-24 | Drift report — linuxpc (linux-pc) — 20260824T172838Z |
| `deploy/reports/claude-align/drift-linuxpc-20260824T174003Z.md` | 9091 | non-tracciato (mtime fs) 2026-08-24 | Drift report — linuxpc (linux-pc) — 20260824T174003Z |
| `deploy/reports/claude-align/drift-linuxpc-20260824T180054Z.md` | 9091 | non-tracciato (mtime fs) 2026-08-24 | Drift report — linuxpc (linux-pc) — 20260824T180054Z |
| `deploy/reports/claude-align/drift-linuxpc-20260824T204811Z.md` | 9091 | non-tracciato (mtime fs) 2026-08-24 | Drift report — linuxpc (linux-pc) — 20260824T204811Z |
| `deploy/reports/claude-align/drift-vm-20260821T002708Z.md` | 9006 | non-tracciato (mtime fs) 2026-08-21 | Drift report — vm (oracle-vm-default) — 20260821T002708Z |
| `deploy/reports/claude-align/drift-vm-20260821T233218Z.md` | 9006 | non-tracciato (mtime fs) 2026-08-22 | Drift report — vm (oracle-vm-default) — 20260821T233218Z |
| `deploy/reports/claude-align/drift-vm-20260824T000605Z.md` | 9029 | non-tracciato (mtime fs) 2026-08-24 | Drift report — vm (oracle-vm-default) — 20260824T000605Z |
| `deploy/reports/claude-align/drift-vm-20260824T005516Z.md` | 9029 | non-tracciato (mtime fs) 2026-08-24 | Drift report — vm (oracle-vm-default) — 20260824T005516Z |
| `deploy/reports/claude-align/drift-vm-20260824T154057Z.md` | 9112 | non-tracciato (mtime fs) 2026-08-24 | Drift report — vm (oracle-vm-default) — 20260824T154057Z |
| `deploy/reports/claude-align/drift-vm-20260824T170512Z.md` | 9112 | non-tracciato (mtime fs) 2026-08-24 | Drift report — vm (oracle-vm-default) — 20260824T170512Z |
| `deploy/reports/claude-align/drift-vm-20260824T172838Z.md` | 9112 | non-tracciato (mtime fs) 2026-08-24 | Drift report — vm (oracle-vm-default) — 20260824T172838Z |
| `deploy/reports/claude-align/drift-vm-20260824T174003Z.md` | 9112 | non-tracciato (mtime fs) 2026-08-24 | Drift report — vm (oracle-vm-default) — 20260824T174003Z |
| `deploy/reports/claude-align/drift-vm-20260824T180054Z.md` | 9112 | non-tracciato (mtime fs) 2026-08-24 | Drift report — vm (oracle-vm-default) — 20260824T180054Z |
| `deploy/reports/claude-align/drift-vm-20260824T204811Z.md` | 9112 | non-tracciato (mtime fs) 2026-08-24 | Drift report — vm (oracle-vm-default) — 20260824T204811Z |
| `deploy/systemd/solo-linux-pc/README.md` | 2569 | 2026-08-20 | Unit che NON si installano da sole |
| `docs/A11Y_AUDIT_TIER7_2026-05-20.md` | 10555 | 2026-07-25 | A11y Audit — Tier 7 — 2026-05-20 |
| `docs/a11y-manual-checklist.md` | 4740 | 2026-05-17 | Accessibility manual checklist — heuresys-advanced |
| `docs/a11y-tail-items.md` | 8319 | 2026-06-11 | Accessibility tail items (MVP-2a → MVP-3) |
| `docs/api/API_IMPLEMENTATION_PLAN.md` | 46643 | 2026-05-26 | API Implementation Plan |
| `docs/api/MVP_2A_API_GAP_AUDIT.md` | 26657 | 2026-05-29 | MVP-2a API Gap Audit |
| `docs/architecture/adr/0001_monorepo_tool_pnpm.md` | 2756 | 2026-05-16 | ADR‑0001 — Monorepo Manager: pnpm Workspaces |
| `docs/architecture/adr/0002_backend_framework_fastify.md` | 2759 | 2026-05-16 | ADR‑0002 — Backend Framework: Fastify 4 |
| `docs/architecture/adr/0003_db_access_drizzle_plus_raw_sql.md` | 3814 | 2026-06-14 | ADR‑0003 — DB Access: Drizzle ORM + Raw SQL Migrations |
| `docs/architecture/adr/0004_no_docker_native_postgresql.md` | 4180 | 2026-05-31 | ADR‑0004 — Runtime: Native PostgreSQL Only, No Docker |
| `docs/architecture/adr/0005_password_hashing_argon2id.md` | 2505 | 2026-05-16 | ADR‑0005 — Password Hashing: Argon2id |
| `docs/architecture/adr/0006_auth_strategy_jwt_plus_httponly_cookie.md` | 3645 | 2026-05-16 | ADR‑0006 — Auth Strategy: Short JWT + Rotated Refresh + HttpOnly Cookie + CSRF |
| `docs/architecture/adr/0007_frontend_next15_app_router.md` | 3134 | 2026-05-16 | ADR‑0007 — Frontend: Next.js 15 App Router + React 19 + Tailwind 4 + shadcn/ui |
| `docs/architecture/adr/0008_position_intelligence_profile_as_view.md` | 3968 | 2026-05-16 | ADR‑0008 — Position Intelligence Profile: Relational Base + View, not Blob |
| `docs/architecture/adr/0009_visualization_node_layouts_separate_table.md` | 3854 | 2026-05-16 | ADR‑0009 — Visualization: Dedicated `sys_visualization_node_layouts` Table |
| `docs/architecture/adr/0010_postgresql_runtime_location.md` | 5027 | 2026-05-16 | ADR‑0010 — PostgreSQL Runtime Location: OCI VM `oracle-vm-default` (Option B) |
| `docs/architecture/adr/0011_ess_scope_inclusion.md` | 7759 | 2026-05-16 | ADR‑0011 — Employee Self‑Service Portal Inclusion & `self`‑Scope Enforcement |
| `docs/architecture/adr/0012_brownfield_table_mapping_wave_column.md` | 5652 | 2026-05-18 | ADR‑0012 — Brownfield Wave Assignment: Dedicated Column on `table_mappings` |
| `docs/architecture/adr/0013_showcase_sot_policy.md` | 9079 | 2026-07-25 | ADR‑0013 — Showcase SoT Policy: 4‑Level Source‑of‑Truth Layering |
| `docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md` | 21805 | 2026-06-05 | ADR-0014 — SDBI: Semantic-Driven Brownfield Import (complement to ETL brownfield) |
| `docs/architecture/adr/0015_sys_job_roles_nullable_family_fk.md` | 8937 | 2026-06-01 | ADR-0015 — `sys_job_roles.job_role_family_id` nullable FK |
| `docs/architecture/adr/0016_sys_esco_occupation_mappings_nullable_job_role_fk.md` | 14154 | 2026-05-21 | ADR-0016 — `sys_esco_occupation_mappings.job_role_id` nullable FK |
| `docs/architecture/adr/0017_lookup_fk_2hop_transform.md` | 10150 | 2026-05-26 | ADR-0017 — `LOOKUP_FK_2HOP` transform (brownfield-wave-executor engine extension) |
| `docs/architecture/adr/0018_coalesce_uq_class_of_bug.md` | 8867 | 2026-05-26 | ADR-0018 — COALESCE-UQ class-of-bug (split-on-COALESCE) |
| `docs/architecture/adr/0020_wave2_scope_application_level_targets.md` | 13992 | 2026-05-26 | ADR-0020 — Wave-2 scope for application-level targets (CW-B60-B closure) |
| `docs/architecture/adr/0021_ssh_tunnel_automation_and_service_key.md` | 10718 | 2026-05-28 | ADR-0021 — SSH tunnel automation via restricted service-account key (B-31 / CW-B62 closure) |
| `docs/architecture/adr/0023_data_source_doctrine.md` | 8656 | 2026-08-14 | ADR-0023 — Data-Source Doctrine: advanced = structural authority, legacy = canonical no-PII source |
| `docs/architecture/adr/0024_legacy_ingestion_employee_centric.md` | 7652 | 2026-06-01 | ADR-0024 — Legacy ingestion is EMPLOYEE-centric: `sys_user*` ⟸ legacy `employee*` (not `users`) |
| `docs/architecture/adr/0025_sys_skill_categories_nullable_family_fk.md` | 16677 | 2026-06-02 | ADR-0025 — `sys_skill_categories.skill_category_family_id` nullable FK (+ WS-3 activity-classification-mapping investi |
| `docs/architecture/adr/0026_single_production_environment_two_tenants.md` | 7224 | 2026-06-22 | ADR-0026 — Single production-grade environment: RTL Bank & Heuresys are the current production tenants |
| `docs/architecture/adr/0027_two_axis_contextual_authorization.md` | 19683 | 2026-08-10 | ADR-0027 — Two-axis contextual authorization: the organizational chain gates sensitive personal data, the functional c |
| `docs/architecture/adr/0028_ci_enforcement_at_deploy_gate.md` | 5722 | 2026-08-07 | ADR-0028 — CI enforcement point: deploy gate, not branch-protection required checks |
| `docs/architecture/adr/0029_reference_data_i18n_translations_table.md` | 3730 | 2026-07-21 | ADR-0029 — i18n dei dati di riferimento: IT canonico in-row + tabella centrale `sys_reference_translations` |
| `docs/architecture/adr/0030_esco_skill_group_ontology.md` | 3091 | 2026-07-21 | ADR-0030 — Ontologia competenze ESCO come cittadino di prim'ordine (`sys_skill_groups`) |
| `docs/architecture/adr/0031_ess_self_view_computed_intelligence.md` | 2617 | 2026-07-23 | ADR-0031 — Self-view ESS dell'intelligence calcolata (capability + flight-risk) |
| `docs/architecture/adr/0032_platform_mandate_masks_pay_and_evaluation.md` | 6811 | 2026-08-04 | ADR-0032 — The platform mandate stops opening pay and evaluation: `mask` becomes a real state |
| `docs/architecture/adr/0033_generic_tool_catalogue_over_domain_metadata.md` | 18548 | 2026-08-16 | ADR-0033 — Catalogo di strumenti generici sui metadati di dominio, invece di uno strumento per modulo |
| `docs/architecture/adr/0034_migration_chain_is_schema_over_a_data_baseline.md` | 4723 | 2026-08-07 | ADR-0034 — La catena di migrazioni è uno strato di schema e controlli sopra una base di dati, non un ricostruttore |
| `docs/architecture/adr/0035_retirement_amends_the_source_never_deletes_downstream.md` | 3957 | 2026-08-08 | ADR-0035 — Ritirare un oggetto: si emenda la fonte, non si cancella a valle |
| `docs/architecture/adr/0036_hierarchical_and_functional_domains.md` | 10357 | 2026-08-10 | ADR-0036 — Hierarchical and functional domains: the perimeter and the modality are orthogonal |
| `docs/architecture/adr/0037_user_deletion_is_anonymization.md` | 5654 | 2026-08-12 | ADR-0037 — Cancellare una persona significa anonimizzarla; la cancellazione fisica è la revoca di una creazione |
| `docs/architecture/adr/0038_the_database_is_self_sufficient.md` | 5859 | 2026-08-14 | ADR-0038 — Il database è autosufficiente: il brownfield è storia, non una fonte |
| `docs/architecture/ADR_INDEX.md` | 11150 | 2026-08-14 | ADR Index |
| `docs/architecture/brand-component-contract.md` | 7285 | 2026-05-29 | Brand Component Contract — object type → canonical `@heuresys/ui` |
| `docs/archive/BRAND_SESSION_CHARTER.md` | 9345 | 2026-05-28 | Brand Identity v1 — Session Charter |
| `docs/archive/etl-brownfield-ritirato/README.md` | 3716 | 2026-08-13 | ETL brownfield — ritirato, non cancellato |
| `docs/archive/etl-brownfield-ritirato/SDBI_RUNBOOK.md` | 10230 | 2026-08-13 | SDBI Operational Runbook |
| `docs/archive/etl-brownfield-ritirato/seeds-brownfield-tree/wave1/04_column_mappings_report.md` | 3341 | 2026-08-13 | Wave 1 — Column Mapping Seed Report |
| `docs/archive/etl-brownfield-ritirato/seeds-sdbi-template-tree/mapping_card.template.md` | 3059 | 2026-08-13 | Mapping Card — `public.<SOURCE_TABLE>` → `sys.<TARGET_TABLE>` |
| `docs/archive/etl-brownfield-ritirato/seeds-sdbi-template-tree/README.md` | 2502 | 2026-08-13 | SDBI seed-bundle template |
| `docs/archive/GOAL_B_REPORT_2026-05-18.md` | 12156 | 2026-05-28 | Goal B — Lineage + HANDOFF reconciliation + staging cleanup + stats refresh |
| `docs/archive/HANDOFF.md` | 69915 | 2026-07-25 | 🎯 2026-05-31 (cont.) — S953 D2/D3/A — @heuresys/ui token-contract consolidation + publish 0.1.2 |
| `docs/archive/HANDOFF_BRAND.md` | 8564 | 2026-05-28 | Brand Identity v1 — Lane handoff |
| `docs/archive/HANDOFF_S1068.md` | 8124 | 2026-08-18 | Handoff — sessione S1068 (heuresys-advanced, 2026-08-17) |
| `docs/archive/MANDATO_AUTOCOSCIENZA_S1063.md` | 18985 | 2026-08-15 | MANDATO — ciclo di autocoscienza e redenzione |
| `docs/archive/MIGRATION_STATUS_2026-05-18.md` | 67204 | 2026-05-28 | Migration Status — `evo.heuresys.com` → `heuresys-advanced` |
| `docs/archive/modalita-gov-ritirata/2026-08-09-gov-analisi-sicurezza-e-remediation.md` | 12708 | 2026-08-10 | «gov» — analisi di sicurezza del processo e piano di remediation |
| `docs/archive/modalita-gov-ritirata/2026-08-09-gov-fase2-governo-dei-lavoratori.md` | 4875 | 2026-08-10 | «gov» fase 2 — il governo dei lavoratori |
| `docs/archive/modalita-gov-ritirata/2026-08-09-modalita-gov.md` | 26932 | 2026-08-10 | Modalità «gov» — il loop zero-pendenze con più lavoratori |
| `docs/archive/modalita-gov-ritirata/2026-08-09-plancia-gov.md` | 6536 | 2026-08-10 | La plancia diventa la console di volo di gov |
| `docs/archive/modalita-gov-ritirata/2026-08-10-corsa-181-sequenza-prevista.md` | 9033 | 2026-08-10 | Corsa su `#181` — la sequenza, scritta PRIMA di eseguirla |
| `docs/archive/modalita-gov-ritirata/2026-08-10-ritiro-modalita-gov.md` | 10767 | 2026-08-10 | Ritiro della modalità `gov` — tornare a due sole sessioni: `canonical` e `lab` |
| `docs/archive/NEXT_GENERATION_ENTRY_POINT.md` | 48819 | 2026-06-05 | NEXT_GENERATION_ENTRY_POINT — v1.0.0 Consolidation Baseline |
| `docs/archive/NEXT_SESSION_MVP_2A.md` | 22618 | 2026-07-25 | MVP-2a Admin Web SPA + ESS Frontend — Direttiva autoritativa per la sessione successiva |
| `docs/archive/NEXT_SESSION_MVP_CLOSURE.md` | 17414 | 2026-07-25 | Sessione di chiusura MVP-2a/2b — plan operativo |
| `docs/archive/scripts-exhausted/README.md` | 1299 | 2026-07-23 | Script esauriti (archivio G5 — S1028, 2026-07-23) |
| `docs/BOOTSTRAP_EXECUTION_PLAN.md` | 38037 | 2026-06-23 | Bootstrap Execution Plan |
| `docs/BRAND_V1_DEFERRED_REFINEMENTS.md` | 7615 | 2026-07-25 | Brand v1 — Deferred refinements |
| `docs/brownfield/BROWNFIELD_ADAPTATION_MAP.md` | 39762 | 2026-06-23 | Brownfield Adaptation Map |
| `docs/brownfield/BROWNFIELD_EXCLUSION_REPORT.md` | 25110 | 2026-05-16 | Brownfield Exclusion Report |
| `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` | 33262 | 2026-06-23 | Brownfield Import Plan |
| `docs/brownfield/BROWNFIELD_TABLE_CLASSIFICATION_REPORT.md` | 27323 | 2026-06-23 | Brownfield Table Classification Report |
| `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` | 7298 | 2026-06-28 | Employee-Centric Mapping Doctrine — legacy `employee*` ⟹ advanced `sys_user*` |
| `docs/brownfield/ENGINE_STATUS.md` | 1552 | 2026-07-21 | Brownfield ETL engine — status: FROZEN in PROD (D-11, S1023) |
| `docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md` | 7921 | 2026-05-18 | Wave 1 Execution Runbook |
| `docs/brownfield/wave_runners/wave_2_runner.md` | 24340 | 2026-05-29 | Wave 2 Execution Runbook |
| `docs/brownfield/wave_runners/wave_3_runner.md` | 24091 | 2026-05-26 | Wave 3 Execution Runbook |
| `docs/brownfield/wave_runners/wave_4_runner.md` | 22544 | 2026-05-26 | Wave 4 Execution Runbook |
| `docs/ci/self-hosted-runners-setup.md` | 16968 | 2026-07-25 | Self-hosted GitHub Actions runner — OCI VM setup procedure |
| `docs/ci/workflows-overview.md` | 4881 | 2026-05-26 | CI workflows overview (S935 phase F) |
| `docs/cw-b59-true-root-cause-2026-05-26.md` | 11825 | 2026-07-25 | CW-B59 — True root cause analysis (S935 Path A bisect outcome) |
| `docs/db/MIGRATION_IMPLEMENTATION_PLAN.md` | 35204 | 2026-06-23 | Migration Implementation Plan |
| `docs/db/TARGET_SCHEMA_DESIGN.md` | 44048 | 2026-06-23 | Target Schema Design |
| `docs/due-diligence/00_CHARTER.md` | 1482 | 2026-06-17 | DD Charter — heuresys-advanced |
| `docs/due-diligence/01_DISCOVERY.md` | 9030 | 2026-06-17 | 01 — Discovery & baseline — heuresys-advanced |
| `docs/due-diligence/EXECUTIVE_SUMMARY.md` | 5995 | 2026-06-17 | Executive Summary — Due Diligence heuresys-advanced — 2026-06-17 |
| `docs/due-diligence/REPORT.md` | 15164 | 2026-06-17 | Due Diligence — heuresys-advanced — Rapporto completo — 2026-06-17 |
| `docs/due-diligence/SCORECARD.md` | 3817 | 2026-06-17 | Scorecard — heuresys-advanced — 2026-06-17 |
| `docs/due-diligence/SCORECARD_ACQUIRER_RUTHLESS.md` | 6939 | 2026-06-19 | Scorecard ripesata — orientamento ACQUIRENTE "spietato" — heuresys-advanced |
| `docs/due-diligence/workstreams/WS-P1.md` | 8157 | 2026-06-17 | WS-P1 — Product readiness & GA-gap |
| `docs/due-diligence/workstreams/WS-P2.md` | 8614 | 2026-06-17 | WS-P2 — Market & competitive positioning |
| `docs/due-diligence/workstreams/WS-P3.md` | 7629 | 2026-06-17 | WS-P3 — Business model & economics |
| `docs/due-diligence/workstreams/WS-P4.md` | 7855 | 2026-06-17 | WS-P4 — AI/LLM business value |
| `docs/due-diligence/workstreams/WS-T1.md` | 10055 | 2026-06-17 | WS-T1 — Architecture & Multi-Stack Soundness |
| `docs/due-diligence/workstreams/WS-T2.md` | 9373 | 2026-06-17 | WS-T2 — Codebase Quality & Weighting |
| `docs/due-diligence/workstreams/WS-T3.md` | 11925 | 2026-06-17 | WS-T3 — Technical Debt & Antipatterns |
| `docs/due-diligence/workstreams/WS-T4.md` | 14410 | 2026-06-17 | WS-T4 — Technology Fit & Best-Practice Benchmarking |
| `docs/due-diligence/workstreams/WS-T5.md` | 20528 | 2026-06-17 | WS-T5 — Data & DBMS Architecture |
| `docs/due-diligence/workstreams/WS-T6.md` | 16002 | 2026-07-25 | WS-T6 — Security Posture Audit (Investor Due Diligence) |
| `docs/due-diligence/workstreams/WS-T7.md` | 15478 | 2026-06-17 | WS-T7 — AI / ML / LLM audit |
| `docs/due-diligence/workstreams/WS-T8.md` | 14951 | 2026-06-17 | WS-T8 — Operational Readiness & Scalability |
| `docs/due-diligence/workstreams/WS-T9.md` | 14988 | 2026-06-17 | WS-T9 — Verified Functional Correctness (Live E2E) |
| `docs/due-diligence/workstreams/WS-X1.md` | 6915 | 2026-06-17 | WS-X1 — Functional debt (gap funzionali vs promessa di prodotto) |
| `docs/due-diligence/workstreams/WS-X2.md` | 16192 | 2026-06-17 | WS-X2 — Legal / IP / Compliance & Data Governance (peso 5) |
| `docs/due-diligence/workstreams/WS-X3.md` | 13578 | 2026-06-17 | WS-X3 — Execution Risk / Team & Bus Factor + Trasparenza (peso 5) |
| `docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md` | 42751 | 2026-05-16 | Frontend Implementation Plan |
| `docs/github/00-glossario.md` | 13036 | 2026-05-17 | Glossario |
| `docs/github/01-fondamenti/01-cosa-e-github.md` | 8336 | 2026-05-17 | 01 · Cosa è GitHub |
| `docs/github/01-fondamenti/02-account-e-repo.md` | 9730 | 2026-05-17 | 02 · Account e Repository |
| `docs/github/01-fondamenti/03-git-flow.md` | 10078 | 2026-05-17 | 03 · Git flow su GitHub |
| `docs/github/01-fondamenti/04-readme-e-markdown.md` | 10484 | 2026-05-17 | 04 · README e Markdown su GitHub |
| `docs/github/02-collaborazione/01-issues.md` | 9362 | 2026-05-17 | 02.1 · Issues |
| `docs/github/02-collaborazione/02-branches.md` | 9704 | 2026-05-17 | 02.2 · Branches e branching model |
| `docs/github/02-collaborazione/03-pull-requests.md` | 10282 | 2026-05-17 | 02.3 · Pull Requests |
| `docs/github/02-collaborazione/04-projects.md` | 8840 | 2026-05-17 | 02.4 · Projects v2 |
| `docs/github/02-collaborazione/05-discussions.md` | 8280 | 2026-05-17 | 02.5 · Discussions |
| `docs/github/03-automazione/01-actions-fondamenti.md` | 13298 | 2026-05-17 | 03.1 · GitHub Actions — fondamenti |
| `docs/github/03-automazione/02-actions-ricette.md` | 12343 | 2026-05-17 | 03.2 · Actions — ricette riusabili |
| `docs/github/03-automazione/03-secrets-e-variabili.md` | 12693 | 2026-07-25 | 03.3 · Secrets, variables, environments, OIDC |
| `docs/github/03-automazione/04-workflow-storybook.md` | 11198 | 2026-05-17 | 03.4 · Anatomia del workflow `deploy-storybook.yml` |
| `docs/github/04-publishing/01-pages-fondamenti.md` | 10110 | 2026-05-17 | 04.1 · GitHub Pages — fondamenti |
| `docs/github/04-publishing/02-pages-il-nostro-caso.md` | 9935 | 2026-05-17 | 04.2 · Pages — il nostro caso (`ux-design-shared` Storybook) |
| `docs/github/04-publishing/03-releases-e-tags.md` | 10454 | 2026-05-17 | 04.3 · Releases e Tags |
| `docs/github/04-publishing/04-packages.md` | 11208 | 2026-05-17 | 04.4 · GitHub Packages |
| `docs/github/05-security/01-secret-hygiene.md` | 12059 | 2026-05-17 | 05.1 · Secret hygiene |
| `docs/github/05-security/02-dependabot.md` | 12388 | 2026-05-17 | 05.2 · Dependabot |
| `docs/github/05-security/03-code-scanning.md` | 11140 | 2026-05-17 | 05.3 · Code scanning con CodeQL |
| `docs/github/05-security/04-signed-commits.md` | 11380 | 2026-05-17 | 05.4 · Signed commits |
| `docs/github/05-security/05-branch-protection.md` | 11030 | 2026-05-17 | 05.5 · Branch protection / Rulesets |
| `docs/github/06-tooling/01-gh-cli.md` | 9841 | 2026-05-17 | 06.1 · gh CLI |
| `docs/github/06-tooling/02-web-ui-tour.md` | 12203 | 2026-05-17 | 06.2 · GitHub Web UI — tour |
| `docs/github/06-tooling/03-integrazioni.md` | 9388 | 2026-05-17 | 06.3 · Integrazioni — VS Code, JetBrains, mobile, GitHub Desktop |
| `docs/github/07-nostri-repo/01-stato-corrente.md` | 12705 | 2026-07-25 | 07.1 · Stato corrente dei due repo (snapshot) |
| `docs/github/07-nostri-repo/02-heuresys-advanced.md` | 8269 | 2026-07-25 | 07.2 · `Spen-Zosky/heuresys-advanced` — deep dive |
| `docs/github/07-nostri-repo/03-ux-design-shared.md` | 9048 | 2026-05-17 | 07.3 · `Spen-Zosky/ux-design-shared` — deep dive |
| `docs/github/07-nostri-repo/04-interazioni-tra-repo.md` | 12878 | 2026-05-17 | 07.4 · Interazioni tra `heuresys-advanced` e `ux-design-shared` |
| `docs/github/08-roadmap.md` | 9209 | 2026-05-17 | 08 · Roadmap consigliata di adozione |
| `docs/github/branch-protection.md` | 4210 | 2026-05-26 | Branch Protection Rules — canonical configuration |
| `docs/github/dependabot-triage-2026-05-26.md` | 11879 | 2026-08-13 | Dependabot triage procedure — 2026-05-26 (S935 SEC base) |
| `docs/github/README.md` | 7367 | 2026-05-17 | Curriculum GitHub — indice + roadmap di rilascio |
| `docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md` | 31751 | 2026-07-25 | PLAN — #9 Integrazione Agent SDK + layer MCP del plugin `human-resources-plus` (heuresys-side) |
| `docs/integrations/successfactors_heuresys_reconciled_design_2026-05-30.md` | 21636 | 2026-07-25 | SuccessFactors → Heuresys — Design di integrazione riconciliato |
| `docs/integrations/tenant_onboarding_esco_01_coherence_report_2026-06-15.md` | 15649 | 2026-07-25 | Coherence Report — "ESCO multi-pilastro + Skills Group Share" & "Tenant Onboarding (HEU-FLOW-001)" vs repository reale |
| `docs/integrations/tenant_onboarding_esco_02_dbms_population_todo_2026-06-15.md` | 7165 | 2026-07-25 | TODO — Miglior popolamento del DBMS (Tier 1-3) |
| `docs/integrations/tenant_onboarding_esco_03_esco_population_spec_2026-06-15.md` | 9840 | 2026-07-25 | SPEC — Popolamento ESCO (backfill gerarchia skill + import occupation→skill + classificazione) |
| `docs/integrations/tenant_onboarding_esco_04_tenant_onboarding_spec_2026-06-15.md` | 8714 | 2026-07-25 | SPEC — Tenant Onboarding (legame tenant→NACE/size + OU↔processi + motore generativo) |
| `docs/kb/atlas/ATLAS.md` | 10382 | 2026-08-24 | ATLAS — mappa cross-layer heuresys-advanced (GENERATO) |
| `docs/kb/atlas/ATLAS_CURATED.md` | 15456 | 2026-07-05 | ATLAS_CURATED — sintesi semantica del full sweep (NON generato) |
| `docs/kb/COWORK_INBOX.md` | 72693 | 2026-08-08 | COWORK_INBOX — canale proposte Cowork → CLI (write-back single-writer) |
| `docs/kb/DATA_PATTERNS.md` | 17053 | 2026-07-27 | DATA_PATTERNS — registro dei pattern di dati riusabili |
| `docs/kb/db-forensics/F2_DB_CENSUS_2026-07-21.md` | 12512 | 2026-07-21 | Fase 2 — Census forense DB (mandato S1023) · S1024 · 2026-07-21 |
| `docs/kb/db-forensics/F3_SEMANTIC_COHERENCE_2026-07-21.md` | 7927 | 2026-07-21 | Fase 3 — Coerenza semantica dati RTL Bank + piani seeding + chiusura brownfield · S1024 · 2026-07-21 |
| `docs/kb/db-forensics/USER_ROLE_COHERENCE_2026-07-22.md` | 9258 | 2026-07-23 | Audit coerenza per-user (ruolo organizzativo ↔ dati collegati) · S1025 · 2026-07-22 |
| `docs/kb/DEBT_REGISTER.md` | 136170 | 2026-08-23 | DEBT_REGISTER — Debiti / incoerenze rilevati (CLI-owned) |
| `docs/kb/frontend-forensics/F4_SURFACE_CENSUS_2026-07-22.md` | 9325 | 2026-07-22 | Fase 4 — Forense frontend per-superficie · S1025 · 2026-07-22 |
| `docs/kb/full-forensic-audit/AUDIT_FORENSE_heuresys_2026-07-03_151241.md` | 158129 | 2026-07-04 | AUDIT FORENSE READ-ONLY — heuresys-advanced |
| `docs/kb/full-forensic-audit/AUDIT_FORENSE_heuresys_2026-07-20_022239.md` | 14559 | 2026-07-20 | AUDIT FORENSE — heuresys-advanced · 2026-07-20 02:22 |
| `docs/kb/full-forensic-audit/FP_CHECK_VERIFICATION_2026-07-03_151241.md` | 178353 | 2026-07-04 | FP-CHECK VERIFICATION — heuresys-advanced (2026-07-03 15:12) |
| `docs/kb/full-forensic-audit/INDEX.md` | 5756 | 2026-07-20 | INDEX — Audit forensi read-only (full-forensic-audit) |
| `docs/kb/improvement/2026-06-13_heuresys-advanced-100x-kickoff-prompt.md` | 14316 | 2026-06-13 | PROMPT KICKOFF — heuresys-advanced "RELEASE 100X" |
| `docs/kb/improvement/AUDIT_PROTOCOL.md` | 2944 | 2026-06-13 | AUDIT_PROTOCOL — metodo forense del programma 100X |
| `docs/kb/improvement/BASELINE_METRICS.md` | 4947 | 2026-06-13 | BASELINE_METRICS — S-100X-0 (2026-06-13, HEAD `7e5b86d`) |
| `docs/kb/improvement/DOSSIERS/D-01.md` | 16400 | 2026-06-17 | D-01 — Runtime/linguaggio (Node + Fastify) + module codegen |
| `docs/kb/improvement/DOSSIERS/D-02.md` | 14942 | 2026-06-17 | D-02 — Data layer (raw SQL vs query-builder/ORM) + module-repository boilerplate |
| `docs/kb/improvement/DOSSIERS/D-03.md` | 15660 | 2026-06-17 | D-03 — Validazione/contratti (Zod 4 + ftpz6) + shared db-helper extraction |
| `docs/kb/improvement/DOSSIERS/D-04.md` | 17179 | 2026-06-17 | D-04 — Frontend: client-only SPA vs RSC/streaming (first-paint) + chart code-split |
| `docs/kb/improvement/DOSSIERS/D-05.md` | 19034 | 2026-06-17 | D-05 — Design system `@heuresys/ui`: promozione primitive + de-dup web↔showcase + destino `SystemHealthDashboard` |
| `docs/kb/improvement/DOSSIERS/D-06.md` | 15255 | 2026-06-17 | D-06 — Tooling/build (pnpm + tsup/tsc, cache, affected, task-runner) |
| `docs/kb/improvement/DOSSIERS/D-07.md` | 10473 | 2026-06-17 | D-07 — Migration squash-to-baseline |
| `docs/kb/improvement/DOSSIERS/D-08.md` | 19209 | 2026-06-17 | D-08 — CI/CD: runner SPOF + 0 rollback + fork-PR ACE su prod host (public repo) |
| `docs/kb/improvement/DOSSIERS/D-09.md` | 15986 | 2026-06-17 | D-09 — Observability (metrics / tracing / logs / error-tracking / SLO) |
| `docs/kb/improvement/DOSSIERS/D-10.md` | 14701 | 2026-06-17 | D-10 — Architettura applicativa (monolite vs servizi) |
| `docs/kb/improvement/DOSSIERS/D-11.md` | 12653 | 2026-06-22 | D-11 — Brownfield / ingestion engine (wave-executor · transform-compiler · staging · reconciliation registry) |
| `docs/kb/improvement/DOSSIERS/D-12.md` | 15526 | 2026-06-17 | D-12 — AI / embedding (pgvector + Voyage seam + reindex timer) |
| `docs/kb/improvement/DOSSIERS/D-13.md` | 17425 | 2026-06-17 | D-13 — Auth: self-built vs libreria vs managed (IdP) |
| `docs/kb/improvement/DOSSIERS/D-14.md` | 17281 | 2026-06-22 | D-14 — GTM / multi-tenant readiness |
| `docs/kb/improvement/DOSSIERS/README.md` | 2403 | 2026-06-13 | DOSSIERS/ — register decisionale del programma 100X |
| `docs/kb/improvement/DOSSIERS_TRIAGE_S1022.md` | 4935 | 2026-07-20 | TRIAGE DOSSIER D-01..D-14 — esiti registrati (S1022, 2026-07-20) |
| `docs/kb/improvement/EPICS_SPEC_S1022.md` | 6250 | 2026-07-20 | SPEC ESEGUIBILI — 3 epiche GO-BRANCH (D-08 / D-09 / D-14) · S1022 |
| `docs/kb/improvement/FINDINGS/3.2_ASVS_MAPPING.md` | 21057 | 2026-06-16 | 3.2 — OWASP ASVS security-posture mapping (heuresys-advanced) |
| `docs/kb/improvement/FINDINGS/README.md` | 2755 | 2026-06-17 | FINDINGS/ — registro finding per workstream |
| `docs/kb/improvement/FINDINGS/S-100X-0_recon.md` | 5054 | 2026-06-13 | S-100X-0 — Recon trasversale (seed, read-only, 2026-06-13) |
| `docs/kb/improvement/FINDINGS/WS-A.md` | 19278 | 2026-06-16 | FINDINGS / WS-A — Architecture (monorepo, coupling, dead code) (S-100X-A6) |
| `docs/kb/improvement/FINDINGS/WS-B.md` | 25363 | 2026-06-16 | FINDINGS / WS-B — Backend & services (S-100X-A5) |
| `docs/kb/improvement/FINDINGS/WS-C.md` | 27032 | 2026-06-16 | FINDINGS / WS-C — Dati & persistenza (S-100X-A4) |
| `docs/kb/improvement/FINDINGS/WS-D.md` | 23321 | 2026-06-16 | FINDINGS / WS-D — Frontend (apps/web, Next.js 16 App Router) (S-100X-A7) |
| `docs/kb/improvement/FINDINGS/WS-E.md` | 26298 | 2026-06-16 | FINDINGS / WS-E — Design-system & UX-IX (S-100X-A8) |
| `docs/kb/improvement/FINDINGS/WS-F.md` | 34551 | 2026-06-15 | FINDINGS / WS-F — Test & QA (S-100X-A3) |
| `docs/kb/improvement/FINDINGS/WS-G.md` | 31063 | 2026-06-13 | FINDINGS / WS-G — CI/CD & deploy (S-100X-A1) |
| `docs/kb/improvement/FINDINGS/WS-H.md` | 12982 | 2026-06-13 | FINDINGS / WS-H — Application security & supply chain (S-100X-A2) |
| `docs/kb/improvement/FINDINGS/WS-I.md` | 23378 | 2026-06-16 | FINDINGS / WS-I — Documentazione (S-100X-A11) |
| `docs/kb/improvement/FINDINGS/WS-J.md` | 25695 | 2026-06-16 | FINDINGS / WS-J — Config & env (S-100X-A9) |
| `docs/kb/improvement/FINDINGS/WS-K.md` | 21196 | 2026-06-16 | FINDINGS / WS-K — Repo hygiene & footprint (S-100X-A10) |
| `docs/kb/improvement/INTERVIEW_LOG.md` | 2783 | 2026-06-13 | INTERVIEW_LOG — S-100X-0 (2026-06-13) |
| `docs/kb/improvement/MASTER_PLAN_100X.md` | 6157 | 2026-06-13 | MASTER_PLAN_100X — heuresys-advanced "RELEASE 100X" |
| `docs/kb/improvement/TODO_100X.md` | 17021 | 2026-06-19 | TODO_100X — machine-checkable program tracker |
| `docs/kb/improvement/WS-L_PLAN.md` | 14040 | 2026-07-20 | FINDINGS / WS-L — Ecosistema Claude Code (footprint always-loaded, plugin, memoria, hook, costo boot) |
| `docs/kb/improvement/WS-L_TODO.md` | 5265 | 2026-07-20 | WS-L TODO — Ecosistema Claude Code (DESIGN-ONLY, esecuzione gated su go Enzo) |
| `docs/kb/INDEX_PATHS.md` | 338853 | 2026-08-24 | INDEX_PATHS — Indice percorsi dominio heuresys-advanced |
| `docs/kb/integrations/INTEGRATIONS.md` | 8100 | 2026-05-27 | INTEGRATIONS — Tool esterni integrati nel dominio (CLI-owned) |
| `docs/kb/NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md` | 6104 | 2026-07-25 | NEXT SESSION — Forense DB + dati + frontend (KICKOFF) |
| `docs/kb/NEXT_SESSION_EPICS_KICKOFF.md` | 4672 | 2026-07-21 | NEXT SESSION — Residuo epiche GO-BRANCH (KICKOFF) |
| `docs/kb/NEXT_SESSION_FORENSIC_KICKOFF.md` | 6378 | 2026-07-25 | NEXT SESSION — Forensic Review + Finance-Readiness Verdict (KICKOFF) |
| `docs/kb/SOT_BACKLOG.md` | 882628 | 2026-08-25 | SOT_BACKLOG — Azioni da riprendere (CLI-owned) |
| `docs/kb/SOT_STATE.md` | 407321 | 2026-08-24 | SOT_STATE — Snapshot granulare del sistema (handoff-governed, SoT v2) |
| `docs/kb/storia36/AUDIT_FINALE.md` | 106532 | 2026-07-31 | storia36 — Audit semantico finale (Task C12, Step 12.2) |
| `docs/kb/storia36/DOMINIO_FORMAZIONE_OBBLIGATORIA.md` | 15541 | 2026-07-28 | storia36 C4 — Dominio: formazione obbligatoria e certificazioni nel credito italiano |
| `docs/kb/storia36/DOMINIO_PREMIO_VARIABILE.md` | 6734 | 2026-07-28 | storia36 C3 — Dominio: premio variabile e compensation nel credito italiano |
| `docs/kb/storia36/DOSSIER_REGISTRY.md` | 4968 | 2026-07-27 | storia36 — Registro dei dossier (derivato dal grafo FK, mai a mano) |
| `docs/kb/tools/atlas-sweep-templates/sweep_digest_s1016.md` | 60430 | 2026-07-25 | api:c1  {'modules': 10, 'endpoints': 73, 'tables_distinct': 40} |
| `docs/kb/xtras/AUTONOMY_R23_PROJECT.md` | 3602 | 2026-08-09 | Autonomia operativa cross-tool (R23 globale — project enforcement) |
| `docs/kb/xtras/B50_DEFER_UNBLOCK_PACKAGE.md` | 13412 | 2026-07-22 | B-50 unblock-package — 3 DEFER (S981) |
| `docs/kb/xtras/COWORK_ARCHIVE_NOTE.md` | 4449 | 2026-07-22 | COWORK_ARCHIVE_NOTE — Congelamento archivio Cowork & passaggio a SoT CLI-owned |
| `docs/kb/xtras/D4_ORG_UNIT_TEMPLATE_DESIGN.md` | 28821 | 2026-07-22 | D4 — Org-Unit Template Full-Fidelity Design (Wall W2, Option C(i)) |
| `docs/kb/xtras/D6_SDBI_OPTION_B_DESIGN.md` | 29768 | 2026-07-22 | D6 — SDBI Option-B Slice DESIGN: PerformanceReviews + Feedback360 |
| `docs/kb/xtras/DATA_RECONCILIATION_PLAN.md` | 18963 | 2026-07-22 | DATA_RECONCILIATION_PLAN — legacy→advanced full reconciliation (CLI-owned, gated) |
| `docs/kb/xtras/DESIGN_SYSTEM_UI.md` | 5375 | 2026-07-25 | Design System — `@heuresys/ui` (npm-published, post-migrazione X18) |
| `docs/kb/xtras/DUMP_ARCHIVAL_RUNBOOK.md` | 5294 | 2026-07-22 | Dump archival runbook (QW-K3) |
| `docs/kb/xtras/PLAN_S1018_BATCH.md` | 21123 | 2026-07-22 | Programma S1018 — Batch autonomo "livello superiore" (ultracode) |
| `docs/kb/xtras/POST_V1_ROADMAP_DOSSIER.md` | 15472 | 2026-07-22 | POST_V1_ROADMAP_DOSSIER — Direzioni post-v1.0 (decision-ready) |
| `docs/kb/xtras/RBAC_UIX_PERSPECTIVES_PLAN.md` | 12951 | 2026-07-25 | RBAC · UI-interfaces · Perspectives · Per-user prefs — Build Plan (S952→S953) |
| `docs/kb/xtras/RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md` | 33775 | 2026-07-22 | RECONCILIATION WALLS & AI/MATCHING — CONSOLIDATED DECISION DOSSIER |
| `docs/kb/xtras/RESUME_S1018_BATCH.md` | 9852 | 2026-07-25 | RESUME — Batch autonomo S1018 (fresh session restart point) |
| `docs/kb/xtras/RTL_STABILIZATION_PLAN.md` | 6002 | 2026-07-22 | RTL Bank Stabilization — Definitive Plan (B-50 remediation) |
| `docs/kb/xtras/SDBI_PHASE2_CLOSURE.md` | 9686 | 2026-07-22 | SDBI Phase 2 (B-10) — CLOSURE DOC (umbrella terminale) |
| `docs/kb/xtras/SESSION_MODES.md` | 5185 | 2026-08-10 | Session modes — `canonical` and `lab` |
| `docs/kb/xtras/SESSION_START_FORENSICS.md` | 8392 | 2026-07-22 | Session-start forensics — why "avvia sessione" was slow, and what changed |
| `docs/kb/xtras/VISUALIZATION_RENDERERS_CLOSURE.md` | 6258 | 2026-07-25 | Visualization renderers (MVP-3 "tappa B") — CLOSURE DOC |
| `docs/kb/xtras/WAVE2_UNBLOCK_PACKAGE.md` | 11000 | 2026-07-22 | Brownfield Wave-2 unblock-package — source discovery (S981) |
| `docs/MVP_4_ROADMAP.md` | 46971 | 2026-06-23 | MVP-4 Roadmap |
| `docs/preflight-residual-todo.md` | 5528 | 2026-07-25 | Pre-flight residual TODO (post-S935 phase D) |
| `docs/product/BUSINESS_SCOPE_AND_PRD.md` | 19463 | 2026-06-20 | Business Scope & PRD — heuresys-advanced |
| `docs/product/COMPETITIVE_SCORECARD.md` | 6879 | 2026-06-19 | Competitive Scorecard — heuresys-advanced vs alta fascia |
| `docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md` | 10670 | 2026-07-05 | Development Lines — Serie A: esporre i dati dormienti (dossier di brainstorming) |
| `docs/product/DEVELOPMENT_LINES_B_ACTIVATE_DORMANT_CODE.md` | 5198 | 2026-07-05 | Development Lines — Serie B: attivare il codice dormiente |
| `docs/product/DEVELOPMENT_LINES_C_ADMIN_EDITING_UI.md` | 3478 | 2026-07-05 | Development Lines — Serie C: admin editing UI (da console di lettura a strumento di gestione) |
| `docs/product/DEVELOPMENT_LINES_D_WAVE2_LEGACY_DATA.md` | 4899 | 2026-07-05 | Development Lines — Serie D: Wave-2 mirata — i dati legacy che valgono |
| `docs/product/DEVELOPMENT_LINES_E_EVO_VERTICALS.md` | 5242 | 2026-07-05 | Development Lines — Serie E: verticali dal cantiere evo (porting concettuale) |
| `docs/product/DEVELOPMENT_LINES_F_PRESCRIPTIVE_INTELLIGENCE.md` | 4604 | 2026-07-05 | Development Lines — Serie F: intelligence prescrittiva (il layer sopra MLCE, ora sbloccato) |
| `docs/product/DEVELOPMENT_LINES_G_PLATFORM_HYGIENE.md` | 4012 | 2026-07-05 | Development Lines — Serie G: piattaforma & igiene (il valore è affidabilità e costi) |
| `docs/product/FUNCTIONAL_CAPABILITY_LEDGER.md` | 35735 | 2026-08-21 | Functional Capability Ledger — heuresys-advanced |
| `docs/product/LATENT_CAPABILITY_CATALOG.md` | 1266 | 2026-06-20 | Latent Capability Catalog — ASSORBITO nel Functional Capability Ledger |
| `docs/product/README.md` | 3019 | 2026-07-05 | Product Domain — Source of Truth |
| `docs/product/WORKITEM_GAP1_DESIGN_SPEC.md` | 22774 | 2026-06-20 | Gap #1 — Design-Spec esecutivo (Porte Process/Org UI + MLCE + Maturity engine) |
| `docs/product/WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` | 6680 | 2026-06-22 | Work-Item — Gap #1: Porte Process/Org UI + Scorecard prescrittiva |
| `docs/product/WORKITEM_GAP1_PHASE0_VERIFICATION.md` | 8285 | 2026-06-22 | Fase 0 — Verifica building-block (Gap #1: Porte Process/Org UI + scorecard prescrittiva di capability) |
| `docs/security/AUTH_SECURITY_PLAN.md` | 44863 | 2026-07-25 | Authentication & Authorization Security Plan |
| `docs/SHOWCASE_AUDIT_2026-05-20.md` | 16091 | 2026-05-20 | Showcase Audit — 2026-05-20 |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/AI_CODING_AGENT_BOOTSTRAP_PROMPT.md` | 6108 | 2026-05-16 | AI Coding Agent Bootstrap Prompt |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/AUTH_STACK_SPEC.md` | 1699 | 2026-05-16 | Authentication and Authorization Stack Specification |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/BACKEND_API_STACK_SPEC.md` | 1312 | 2026-05-16 | Backend API Stack Specification |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/checklists/ACCEPTANCE_TESTS.md` | 2507 | 2026-05-16 | Bootstrap Acceptance Tests |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/DBMS_BOOTSTRAP_SPEC.md` | 6941 | 2026-05-16 | DBMS Bootstrap Specification |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/FRONTEND_STACK_SPEC.md` | 1491 | 2026-05-16 | Frontend Stack Specification |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/REPOSITORY_STRUCTURE.md` | 1108 | 2026-05-16 | Repository Structure |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/SECURITY_AND_PRIVACY_BOUNDARIES.md` | 1460 | 2026-05-16 | Security and Privacy Boundaries |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/specs/AUTH_POLICY_MATRIX.md` | 1409 | 2026-05-16 | Auth Policy Matrix |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/specs/FRONTEND_ROUTE_MAP.md` | 835 | 2026-05-16 | Frontend Route Map |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/specs/GRAPH_VISUALIZATION_MODEL_SPEC.md` | 1508 | 2026-05-16 | Graph Visualization and Renderable Artifact Model Specification |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/specs/LEARNING_CATALOG_AND_GAP_CLOSURE_SPEC.md` | 1459 | 2026-05-16 | Learning Catalogue, Training Initiatives and Gap Closure Specification |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/templates/README_TEMPLATE.md` | 250 | 2026-05-16 | Company HRMS/BPM Platform |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/TENANT_USER_PROFILE_MODEL.md` | 2342 | 2026-05-16 | Tenant, User, Profile and Evidence Model |
| `docs/source_bundle/extracted_bootstrap/bootstrap_agent/UPDATED_MIGRATION_PLAN.md` | 2813 | 2026-05-16 | Updated Migration Plan |
| `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_ADAPTATION_MAP_TEMPLATE.md` | 1960 | 2026-05-16 | Brownfield Adaptation Map Template |
| `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_AI_AGENT_TASK.md` | 1238 | 2026-05-16 | Brownfield Adaptation Task for the AI Coding Agent |
| `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_EXCLUSION_RULES.md` | 766 | 2026-05-16 | Brownfield Exclusion Rules |
| `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_IMPORT_PIPELINE_SPEC.md` | 1356 | 2026-05-16 | Brownfield Import Pipeline Specification |
| `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_IMPORT_STRATEGY.md` | 1354 | 2026-05-16 | Brownfield Import and Adaptation Strategy |
| `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_IMPORT_WAVES.md` | 1055 | 2026-05-16 | Brownfield Import Waves |
| `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_LINEAGE_MODEL.md` | 753 | 2026-05-16 | Brownfield Lineage Model |
| `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_TABLE_CLASSIFICATION_RULES.md` | 1449 | 2026-05-16 | Brownfield Table Classification Rules |
| `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_VALIDATION_CHECKLIST.md` | 1068 | 2026-05-16 | Brownfield Validation Checklist |
| `docs/source_bundle/extracted_bootstrap/db/migration_skeletons/README.md` | 1303 | 2026-07-25 | Migration skeletons — ARTEFATTO STORICO, non lavoro da fare |
| `docs/source_bundle/extracted_bootstrap/INDEX.md` | 8960 | 2026-05-16 | Banking BPM / HRMS Blueprint — Canonical Process Index |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/00_Enterprise_Typing_and_Blueprint_Configuration.md` | 26516 | 2026-05-16 | Enterprise Typing and Blueprint Configuration |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/01_Current_Accounts_Management.md` | 10755 | 2026-05-16 | Retail Banking Operations |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/02_Payments_and_Transactions_Management.md` | 8595 | 2026-05-16 | Retail Banking Operations |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/03_Cash_Operations_Management.md` | 8375 | 2026-05-16 | Retail Banking Operations |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/04_Deposit_Products_Management.md` | 7914 | 2026-05-16 | Retail Banking Operations |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/05_Lending_and_Credit_Management.md` | 11193 | 2026-05-16 | Lending & Credit Management |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/06_Customer_Relationship_Management.md` | 10786 | 2026-05-16 | Customer Relationship Management |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/07_Compliance_AML_and_Regulatory_Processes.md` | 10876 | 2026-05-16 | Compliance, AML & Regulatory Processes |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/08_Risk_Management.md` | 10962 | 2026-05-16 | Risk Management |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/09_Treasury_and_Finance.md` | 10742 | 2026-05-16 | Treasury & Finance |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/10_Digital_Banking_and_Channels.md` | 10482 | 2026-05-16 | Digital Banking & Channels |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/11_Sales_and_Commercial_Processes.md` | 10525 | 2026-05-16 | Sales & Commercial Processes |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/12_Branch_Operations.md` | 10818 | 2026-05-16 | Branch Operations |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/13_Legal_and_Litigation.md` | 10662 | 2026-05-16 | Legal & Litigation |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/14_HR_and_Internal_Services.md` | 98169 | 2026-05-16 | Retail Banking Operations |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/15_IT_and_Banking_Technology_Operations.md` | 11367 | 2026-05-16 | IT & Banking Technology Operations |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/16_Business_Continuity_and_Security.md` | 10984 | 2026-05-16 | Business Continuity & Security |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/17_AI_Augmented_Banking_Processes.md` | 11015 | 2026-05-16 | AI-Augmented Banking |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/18_KPI_Library_Cascading_and_Assessment_Model.md` | 8897 | 2026-05-16 | KPI Library, Cascading and Assessment Model |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/19_Position_Based_Learning_Path_Management.md` | 8187 | 2026-05-16 | Position-Based Learning Path Management |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/20_Workforce_Intelligence_Gap_Analysis_and_Talent_Weighting.md` | 7777 | 2026-05-16 | Workforce Intelligence, Gap Analysis and Talent Weighting |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/21_Career_Planning_Talent_Mobility_and_Succession.md` | 5580 | 2026-05-16 | Career Planning, Talent Mobility and Succession |
| `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/22_Compensation_Intelligence_and_Objective_Based_Reward_Input.md` | 6756 | 2026-05-16 | Compensation Intelligence and Objective-Based Reward Input |
| `docs/source_bundle/extracted_bootstrap/ISTRUZIONI.md` | 1434 | 2026-05-16 | ISTRUZIONI.md — Idempotent Bundle Usage |
| `docs/source_bundle/extracted_bootstrap/LOGICAL_DATA_MODEL_ADDENDUM.md` | 1828 | 2026-05-16 | Logical Data Model Addendum |
| `docs/source_bundle/extracted_bootstrap/README.md` | 5555 | 2026-05-16 | Company HRMS / BPM Idempotent Blueprint Bundle |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/IDEMPOTENT_SEEDING_RULES.md` | 695 | 2026-05-16 | Idempotent Seeding Rules |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/PROMPT_TEMPLATE_LIBRARY.md` | 378 | 2026-05-16 | Research Prompt Template Library |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/prompts/PROMPT_ATECO_NACE_RECONCILIATION.md` | 735 | 2026-05-16 | Prompt — ATECO to NACE Reconciliation |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/prompts/PROMPT_BANKING_KPI_RESEARCH.md` | 611 | 2026-05-16 | Prompt — Banking KPI Research |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/prompts/PROMPT_CAREER_PATH_RESEARCH.md` | 358 | 2026-05-16 | Prompt — Career Path Research |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/prompts/PROMPT_COMPENSATION_RULE_RESEARCH.md` | 348 | 2026-05-16 | Prompt — Compensation Rule Research |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/prompts/PROMPT_ESCO_OCCUPATION_DISCOVERY.md` | 563 | 2026-05-16 | Prompt — ESCO Occupation Discovery |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/prompts/PROMPT_ESCO_SKILL_EXTRACTION.md` | 467 | 2026-05-16 | Prompt — ESCO Skill Extraction |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/prompts/PROMPT_LEARNING_CATALOG_RESEARCH.md` | 799 | 2026-05-16 | Prompt — Learning Catalogue Research |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/prompts/PROMPT_POSITION_JOB_DESCRIPTION_RESEARCH.md` | 344 | 2026-05-16 | Prompt — Position / Job Description Research |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/SEED_ACQUISITION_ENGINE_SPEC.md` | 1676 | 2026-05-16 | Seed Acquisition and Validation Engine Specification |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/SEED_COMPLETENESS_BACKLOG.md` | 681 | 2026-05-16 | Seed Completeness Backlog |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/SEED_STAGING_AND_APPROVAL_MODEL.md` | 625 | 2026-05-16 | Seed Staging and Approval Model |
| `docs/source_bundle/extracted_bootstrap/seed_acquisition/SOURCE_OF_TRUTH_REGISTRY.md` | 1375 | 2026-05-16 | Source of Truth Registry |
| `docs/source_bundle/extracted_bootstrap/universal_hrms_framework/U01_Position_Centric_HRMS_Architecture.md` | 1142 | 2026-05-16 | Universal Position-Centric HRMS Architecture |
| `docs/source_bundle/extracted_bootstrap/universal_hrms_framework/U02_Position_Intelligence_Profile.md` | 631 | 2026-05-16 | Position Intelligence Profile |
| `docs/source_bundle/extracted_bootstrap/universal_hrms_framework/U03_Skill_Taxonomy_Model.md` | 732 | 2026-05-16 | Universal Skill Taxonomy Model |
| `docs/source_bundle/extracted_bootstrap/universal_hrms_framework/U04_KPI_Cascading_and_Assessment_Model.md` | 8897 | 2026-05-16 | KPI Library, Cascading and Assessment Model |
| `docs/source_bundle/extracted_bootstrap/universal_hrms_framework/U05_Position_Based_Learning_Path_Model.md` | 8187 | 2026-05-16 | Position-Based Learning Path Management |
| `docs/source_bundle/extracted_bootstrap/universal_hrms_framework/U06_Workforce_Intelligence_Gap_Analysis.md` | 7777 | 2026-05-16 | Workforce Intelligence, Gap Analysis and Talent Weighting |
| `docs/source_bundle/extracted_bootstrap/universal_hrms_framework/U07_Career_Talent_Succession_Model.md` | 5580 | 2026-05-16 | Career Planning, Talent Mobility and Succession |
| `docs/source_bundle/extracted_bootstrap/universal_hrms_framework/U08_Compensation_Intelligence_Model.md` | 6756 | 2026-05-16 | Compensation Intelligence and Objective-Based Reward Input |
| `docs/superpowers/analysis/2026-08-06-inventario-substrato-ai-rag.md` | 23472 | 2026-08-07 | Inventario del substrato AI/RAG — ricognizione Cowork del 2026-08-06 |
| `docs/superpowers/analysis/README.md` | 2037 | 2026-08-07 | Analisi — documenti prodotti da Cowork |
| `docs/superpowers/plans/2026-05-28-cross-os-bootstrap.md` | 23825 | 2026-05-28 | Cross-OS Idempotent Bootstrap — Implementation Plan |
| `docs/superpowers/plans/2026-05-28-zod4-ftpz6-migration.md` | 20602 | 2026-05-28 | zod 4 + fastify-type-provider-zod 6 Migration Plan |
| `docs/superpowers/plans/2026-05-29-brand-fidelity-migration.md` | 8583 | 2026-05-29 | Plan — Brand-fidelity migration (real app → canonical UX/IX by object type) |
| `docs/superpowers/plans/2026-06-03-bi-analytics-phase1.md` | 18420 | 2026-06-03 | BI Analytics — Phase 1 (API) Implementation Plan |
| `docs/superpowers/plans/2026-06-03-reconciliation-f0-triage.md` | 14170 | 2026-06-03 | Reconciliation F0 — Triage Implementation Plan |
| `docs/superpowers/plans/2026-06-03-reconciliation-f1-registry.md` | 16721 | 2026-06-03 | Reconciliation F1 — Registry + View + Terminal States Implementation Plan |
| `docs/superpowers/plans/2026-06-05-i18n-monoblock-execution-plan.md` | 12974 | 2026-06-05 | i18n Milestone — MONOBLOCK Execution Plan (Fasi 2–5 + quick-win bundle) |
| `docs/superpowers/plans/2026-06-05-sot-unification.md` | 7837 | 2026-06-05 | SoT Unification Implementation Plan |
| `docs/superpowers/plans/2026-06-06-ai-semantic-matching-p1.md` | 46501 | 2026-07-25 | AI ② Semantic Matching — P1 Implementation Plan |
| `docs/superpowers/plans/2026-06-10-s982-mega-batch.md` | 29472 | 2026-06-10 | S982 Mega-batch Implementation Plan — 8 workstream + full close |
| `docs/superpowers/plans/2026-06-20-goals-okr-module.md` | 70307 | 2026-07-25 | Goals/OKR Module Implementation Plan |
| `docs/superpowers/plans/2026-06-21-gtm-front-door-landing-lead-capture.md` | 40087 | 2026-07-25 | GTM Front-Door Landing + Lead Capture — Implementation Plan |
| `docs/superpowers/plans/2026-06-22-gtm-investor-onepager-and-guided-demo.md` | 46727 | 2026-06-22 | GTM Investor One-Pager + Guided Demo — Implementation Plan |
| `docs/superpowers/plans/2026-07-06-project-atlas-skill.md` | 34833 | 2026-07-06 | project-atlas Skill Implementation Plan |
| `docs/superpowers/plans/2026-07-26-z261-mfa-fixture-secret-rotation.md` | 10047 | 2026-07-26 | Z-261 — Piano di rotazione dei segreti TOTP delle personas |
| `docs/superpowers/plans/2026-07-26-z262-accesso-derivato-tutti-gli-utenti.md` | 7902 | 2026-07-26 | Z-262 — Accesso per tutti gli utenti tramite credenziali derivate |
| `docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md` | 45142 | 2026-08-24 | RTL Bank — 36 mesi di storia: piano di popolamento integrale del DBMS |
| `docs/superpowers/plans/2026-08-07-165-sganciare-il-deploy-e-provare-la-catena-in-locale.md` | 14534 | 2026-08-07 | #165 — Sganciare il deploy dalla chiusura, e provare la catena prima di pushare |
| `docs/superpowers/plans/2026-08-08-batch-interrotti-e-p1.md` | 13573 | 2026-08-08 | Batch delegato — riprendere gli interrotti, poi i cinque P1 |
| `docs/superpowers/plans/2026-08-08-tre-domande-aperte.md` | 10115 | 2026-08-08 | Piano — le tre domande aperte di S1049, risolte |
| `docs/superpowers/plans/2026-08-10-batch-p1-s1053.md` | 15124 | 2026-08-10 | Piano S1053 — batch «#124 + tutti i P1 tranne #76» (R24) |
| `docs/superpowers/plans/2026-08-11-cancello-verifica-s1054.md` | 14188 | 2026-08-11 | Piano S1054 — voce «F»: togliere il freno e rimettere il cancello di verifica in pari (R24) |
| `docs/superpowers/plans/2026-08-11-ciclo-g-124-183-s1054.md` | 13256 | 2026-08-11 | Piano S1054 — ciclo G: «#124 (D4+D6) + #183» (R24) |
| `docs/superpowers/plans/2026-08-11-ciclo-h-clone-linux-pc-s1054.md` | 5951 | 2026-08-11 | Piano S1054 — ciclo H: «sistema il residuo del clone e misura il rinfresco» (R24) |
| `docs/superpowers/plans/2026-08-12-batch-p1-p2-s1055.md` | 5171 | 2026-08-13 | Batch S1055 — #183 + #124 + tutto P2 |
| `docs/superpowers/plans/2026-08-13-batch-p2-completo-s1056.md` | 12615 | 2026-08-13 | Batch S1056 — #182 + tutto il P2 residuo |
| `docs/superpowers/plans/2026-08-14-batch-p1p2p3-s1058.md` | 9088 | 2026-08-14 | Batch P1+P2+P3 + debiti + domande aperte — S1058 (2026-08-14) |
| `docs/superpowers/plans/2026-08-14-batch-s1059.md` | 7371 | 2026-08-14 | Batch S1059 — «parti da D-83 e poi continua con il resto» (mandato di Enzo, 2026-08-14) |
| `docs/superpowers/plans/2026-08-14-s1060-b-f4-residuo-e-lacune.md` | 8189 | 2026-08-14 | Ciclo S1060-B — `#99` F4 (il residuo) + le lacune formative senza nome |
| `docs/superpowers/plans/2026-08-14-s1060-sblocco-deploy.md` | 6082 | 2026-08-14 | Ciclo S1060 — Sbloccare il deploy fermo dal 14 agosto |
| `docs/superpowers/plans/2026-08-14-s1061-batch-integrale.md` | 11712 | 2026-08-15 | S1061 — Ciclo batch integrale: tutto P1 + P2 + P3 + i debiti aperti |
| `docs/superpowers/plans/2026-08-15-92-f6-frontend-valutazione.md` | 3274 | 2026-08-15 | #92 F6 — Frontend del ciclo di valutazione |
| `docs/superpowers/plans/2026-08-18-s1070-rossi-minori-e-217.md` | 6474 | 2026-08-18 | S1070 — I due rossi minori, poi #217 dalla fase I3 |
| `docs/superpowers/prompts/2026-08-06-catalogo-generico-corpus-concetti.md` | 7334 | 2026-08-07 | Mandato — catalogo generico e corpus dei concetti |
| `docs/superpowers/prompts/2026-08-06-substrato-semantico-verifica-e-correzioni.md` | 7124 | 2026-08-07 | Mandato — substrato semantico: verifica, due correzioni, copertura piena |
| `docs/superpowers/prompts/2026-08-07-percorsi-carriera-155.md` | 6017 | 2026-08-07 | Mandato — #155: i percorsi di carriera puntano a posizioni morte |
| `docs/superpowers/prompts/README.md` | 2600 | 2026-08-07 | Mandati — prompt consegnati a Claude Code CLI |
| `docs/superpowers/specs/2026-05-28-cross-os-bootstrap-design.md` | 10117 | 2026-05-28 | Cross-OS Idempotent Bootstrap — Design Spec |
| `docs/superpowers/specs/2026-05-30-rtl-tenant-rebuild.md` | 7459 | 2026-05-30 | SPEC — RTL tenant rebuild from real legacy data (fresh-session execution) |
| `docs/superpowers/specs/2026-05-30-rtl-tenant-rebuild-import-design.md` | 20852 | 2026-05-30 | RTL tenant rebuild — IMPORT-DESIGN PROPOSAL (Phase 2 output, read-only) |
| `docs/superpowers/specs/2026-06-03-ai-semantic-matching-design.md` | 5261 | 2026-06-03 | AI — Semantic Matching Engine — Design Spec |
| `docs/superpowers/specs/2026-06-03-bi-analytics-design.md` | 5478 | 2026-06-03 | BI — Analytics Engine — Design Spec |
| `docs/superpowers/specs/2026-06-03-platform-capabilities-roadmap.md` | 11940 | 2026-06-07 | Platform Capabilities — Discovery & Roadmap (AI · Data-mining · Scraping · CMS · BI) |
| `docs/superpowers/specs/2026-06-03-reconciliation-closure-design.md` | 16467 | 2026-06-03 | Data Reconciliation Closure — bring `sys.*` to a terminal, explicit state |
| `docs/superpowers/specs/2026-06-04-i18n-milestone-design.md` | 8849 | 2026-06-04 | i18n Milestone — Design Spec (IT default + EN) |
| `docs/superpowers/specs/2026-06-05-sot-unification-design.md` | 12828 | 2026-06-05 | SoT Unification — Design Spec |
| `docs/superpowers/specs/2026-06-07-cms-design.md` | 26640 | 2026-07-25 | CMS — Content Management — Design Spec |
| `docs/superpowers/specs/2026-06-07-data-mining-design.md` | 29814 | 2026-06-07 | Data-Mining — In-Platform Scoring Engine — Design Spec |
| `docs/superpowers/specs/2026-06-07-scraping-design.md` | 24053 | 2026-06-07 | Scraping (Official Sources) — External Reference-Data Ingestion — Design Spec |
| `docs/superpowers/specs/2026-06-16-reporting-export-design.md` | 3421 | 2026-06-16 | 3.5 Reporting / Export — design |
| `docs/superpowers/specs/2026-06-17-bpm-approval-flow-design.md` | 28206 | 2026-06-17 | Design Spec — Capability 3.3 BPM Runtime, Slice D: Approval-Flow Runtime |
| `docs/superpowers/specs/2026-06-17-surveys-engagement-ui-design.md` | 24865 | 2026-07-25 | Surveys / Engagement UI mini-milestone — design spec |
| `docs/superpowers/specs/2026-06-18-bpm-approval-slice2-3-design.md` | 6379 | 2026-06-19 | BPM approval-flow — slice-2 (shipped) + slice-3 (design / residuo) |
| `docs/superpowers/specs/2026-06-19-integrazione-llmwiki-hrplus-heuresys-design.md` | 11960 | 2026-06-19 | Disegno di integrazione: llm_wiki + human-resources-plus dentro heuresys |
| `docs/superpowers/specs/2026-06-19-product-sot-consolidation-design.md` | 12849 | 2026-06-19 | Design — Consolidamento della SoT di prodotto (guida-alla-verifica funzionale) |
| `docs/superpowers/specs/2026-06-20-handoff-rigor-and-hold-lane-design.md` | 49439 | 2026-06-21 | Handoff Rigor + HOLD Lane — Design Spec |
| `docs/superpowers/specs/2026-06-21-gtm-front-door-landing-lead-capture-design.md` | 8477 | 2026-06-21 | GTM Front-Door Landing + Lead Capture — Design |
| `docs/superpowers/specs/2026-06-22-gtm-investor-onepager-and-guided-demo-design.md` | 21438 | 2026-06-29 | GTM Deliverables 2 & 3 — Investor One-Pager + Interactive Guided Demo — Design |
| `docs/superpowers/specs/2026-06-30-two-axis-authorization-model-design.md` | 8562 | 2026-07-01 | Two-axis contextual authorization — technical design & phasing |
| `docs/superpowers/specs/2026-07-01-f3-sensitive-modules-map.md` | 30288 | 2026-07-01 | F3 — sensitive-modules map (ADR-0027, generated S1012 - 16-agent workflow 2026-07-01) |
| `docs/superpowers/specs/2026-07-06-project-atlas-skill-design.md` | 10909 | 2026-07-06 | Design — skill `project-atlas` (conoscenza operativa + linee di sviluppo) |
| `docs/superpowers/specs/2026-07-25-delivery-loop-skill-design.md` | 15190 | 2026-07-25 | Design — skill `delivery-loop` (ciclo di vita del work-item: build · ship · triage) |
| `docs/superpowers/specs/2026-07-25-zero-pending-loop-design.md` | 24997 | 2026-07-26 | Design — `zero-pending-loop`: motore + driver per portare heuresys-advanced a zero pendenze in autonomia non presidiat |
| `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` | 125181 | 2026-08-10 | Piano «zero pendenze» — heuresys-advanced |
| `docs/superpowers/specs/2026-07-26-organizational-model-and-role-derivation-design.md` | 14400 | 2026-07-26 | Modello organizzativo e derivazione dei ruoli — blocco di lavoro |
| `docs/superpowers/specs/2026-07-27-claude-ecosystem-harmonization-plan.md` | 122544 | 2026-07-27 | Armonizzazione dell'ecosistema Claude con il context engineering per i modelli Claude 5 |
| `docs/superpowers/specs/2026-08-02-p2-batch-execution-plan.md` | 66350 | 2026-08-03 | Piano di esecuzione — batch P2 + P3 (S1040 →) |
| `docs/superpowers/specs/2026-08-03-consegna-lab-esecuzione.md` | 11963 | 2026-08-03 | Esecuzione della consegna dalla sessione lab — piano R24 |
| `docs/superpowers/specs/2026-08-04-consegne-lab-13.md` | 6091 | 2026-08-04 | Le 13 consegne del lab — piano di esecuzione (S1044) |
| `docs/superpowers/specs/2026-08-04-esecuzione-lab-inbox-e-organigramma.md` | 12917 | 2026-08-04 | Piano di esecuzione — canale lab, ingestione, ricostruzione dell'organigramma |
| `docs/superpowers/specs/2026-08-04-perimetri-test-dopo-ricostruzione.md` | 6063 | 2026-08-04 | I test di perimetro dopo la ricostruzione dell'organigramma — consegna a una sessione dedicata |
| `docs/superpowers/specs/2026-08-05-debiti-aperti-S1045.md` | 11335 | 2026-08-06 | Ciclo S1045 — chiusura dei debiti aperti |
| `docs/superpowers/specs/2026-08-05-perimetri-test-esecuzione.md` | 10806 | 2026-08-05 | #115 — I test di perimetro tornano a descrivere l'organigramma di oggi |
| `docs/superpowers/specs/2026-08-06-catena-migrazioni-stabile-S1045.md` | 10320 | 2026-08-06 | #140 + #141 — la catena di migrazioni smette di disfare il lavoro fatto |
| `docs/superpowers/specs/2026-08-06-chiusura-dottrina-dubbio-e-diario.md` | 7705 | 2026-08-06 | Chiusura sessione — dottrina del dubbio + diario · S1046 |
| `docs/superpowers/specs/2026-08-06-ritrattazione-consegne-lab-e-mfa-produzione.md` | 24584 | 2026-08-06 | S1047 — Ritrattazione delle consegne del lab, poi i secondi fattori di prova in produzione |
| `docs/superpowers/specs/2026-08-06-substrato-semantico-verifica-e-correzioni.md` | 10099 | 2026-08-06 | Substrato semantico — verifica, due correzioni, copertura piena |
| `docs/superpowers/specs/2026-08-07-catalogo-generico-referto-di-programma.md` | 11284 | 2026-08-07 | Dal substrato semantico al catalogo generico — referto di programma |
| `docs/superpowers/specs/2026-08-07-percorsi-carriera-155.md` | 19680 | 2026-08-07 | Referto — #155: i percorsi di carriera puntano a posizioni morte |
| `docs/superpowers/specs/2026-08-13-batch-S1057.md` | 6228 | 2026-08-13 | Batch S1057 — clima+#126, poi sfoltimento governato dal guardiano |
| `docs/wargames/03-localai.md` | 51939 | 2026-07-07 | WARGAME 03 — LOCAL AI, MULTI-MACHINE |
| `docs/wargames/11-heuresys-evidence.md` | 60798 | 2026-07-07 | WARGAME 11 — heuresys-advanced #27 A/L2: evidence layer ("the proofs under the scores") |
| `docs/wargames/12-heuresys-goals-okr.md` | 52288 | 2026-07-25 | WARGAME 12 — heuresys #26 A/L1: the life of goals/OKRs |
| `docs/wargames/13-heuresys-f4-activity.md` | 61528 | 2026-07-07 | WARGAME 13 — heuresys-advanced F4: the functional/activity axis (backlog #24) |
| `docs/wargames/14-heuresys-provenance.md` | 46309 | 2026-07-07 | WARGAME 14 — heuresys-advanced #28 A/L0 · Trust Ledger: read-API over provenance |
| `docs/wargames/15-heuresys-pricing.md` | 50105 | 2026-07-07 | WARGAME 15 — Public pricing page on www.heuresys.com (GTM #4, next deliverable) |
| `docs/wargames/16-heuresys-approval-effects.md` | 47187 | 2026-07-07 | WARGAME 16 — heuresys-advanced #34 B/B3: approval-effect handlers (the first REAL approval flow) |
| `docs/wargames/17-heuresys-wave3.md` | 61884 | 2026-07-07 | WARGAME 17 — Wave-3 residual: L2/L3 multi-industry tenant onboarding (SmartFood 82 + EcoNova 26) |
| `docs/wargames/LEDGER.md` | 11147 | 2026-07-07 | LEDGER |
| `docs/wargames/README.md` | 3790 | 2026-07-07 | Wargames — battle plan eseguibili (2026-07-06) |
| `docs/wargames/reviews/REVIEW-03.md` | 19323 | 2026-07-07 | REVIEW-03 — Adversarial review of `wargames/03-localai.md` |
| `docs/wargames/reviews/REVIEW-11.md` | 18700 | 2026-07-07 | REVIEW-11 — Adversarial review of `wargames/11-heuresys-evidence.md` |
| `docs/wargames/reviews/REVIEW-12.md` | 16643 | 2026-07-25 | REVIEW-12 — Adversarial review del wargame 12 (heuresys #26 A/L1 goals/OKR) |
| `docs/wargames/reviews/REVIEW-13.md` | 20681 | 2026-07-07 | REVIEW-13 — Adversarial review of `wargames/13-heuresys-f4-activity.md` (F4 functional/activity axis) |
| `docs/wargames/reviews/REVIEW-14.md` | 18815 | 2026-07-07 | REVIEW-14 — Adversarial review of `wargames/14-heuresys-provenance.md` |
| `docs/wargames/reviews/REVIEW-15.md` | 16732 | 2026-07-07 | REVIEW-15 — Adversarial review of `wargames/15-heuresys-pricing.md` (GTM pricing page) |
| `docs/wargames/reviews/REVIEW-16.md` | 19103 | 2026-07-07 | REVIEW-16 — Adversarial review of wargame 16 (heuresys #34 B/B3 approval-effect handlers) |
| `docs/wargames/reviews/REVIEW-17.md` | 21298 | 2026-07-07 | REVIEW-17 — Adversarial review of `wargames/17-heuresys-wave3.md` |
| `docs/wargames/SUCCESS.md` | 938 | 2026-07-07 | SUCCESS.md · the definition of properly wargamed |
| `docs/wargames/tasks/03-localai.md` | 3605 | 2026-07-07 | WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on the targ |
| `docs/wargames/tasks/11-heuresys-evidence.md` | 3689 | 2026-07-07 | WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/O |
| `docs/wargames/tasks/12-heuresys-goals-okr.md` | 3404 | 2026-07-07 | WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/O |
| `docs/wargames/tasks/13-heuresys-f4-activity.md` | 3850 | 2026-07-07 | WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/O |
| `docs/wargames/tasks/14-heuresys-provenance.md` | 3335 | 2026-07-07 | WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/O |
| `docs/wargames/tasks/15-heuresys-pricing.md` | 3465 | 2026-07-07 | WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/O |
| `docs/wargames/tasks/16-heuresys-approval-effects.md` | 3467 | 2026-07-07 | WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/O |
| `docs/wargames/tasks/17-heuresys-wave3.md` | 3846 | 2026-07-07 | WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/O |
| `heuresys-advanced-bootstrap-vm.md` | 28281 | 2026-07-25 | heuresys-advanced — Bootstrap su VM OCI |
| `qa_artifacts/_census_CORRECTION.md` | 2322 | 2026-06-01 | DB sanitization census — CORRECTION (S954, 2026-06-01) |
| `qa_artifacts/data_integrity/20260531_s952/_R1_system_health_milestone_spec.md` | 4097 | 2026-05-31 | R1 — system-health live-wire milestone spec (S952) |
| `qa_artifacts/data_integrity/20260531_s952/CODEBOOK.md` | 40559 | 2026-05-31 | Candidate CSV Codebook — `sys.*` Enrichment Proposals |
| `qa_artifacts/dbms_health_2026-06-22/FINAL_REPORT.md` | 11096 | 2026-06-22 | DBMS Health-Check & Live-E2E Coverage — Report forense |
| `qa_artifacts/F0_reconciliation_triage.md` | 120817 | 2026-06-03 | F0 Reconciliation Triage — verified A/B/C/D classification of 65 empty `sys.*` tables |
| `qa_artifacts/F3_bridge_discovery.md` | 15005 | 2026-06-03 | F3 Bridge Discovery — job→position wall, per-source overlap (read-only) |
| `qa_artifacts/F3b_walls_discovery.md` | 10108 | 2026-06-03 | F3 Bridge Discovery — job→position wall, per-source overlap (read-only) |
| `qa_artifacts/inbox-orphan-cleanup-20260707.md` | 2546 | 2026-07-07 | DB cleanup — orphan inbox notifications (2026-07-07) |
| `qa_artifacts/mvp3_full_release_notes_v0.3.2.md` | 9450 | 2026-05-25 | MVP-3 full — Release Notes v0.3.2-mvp3-full |
| `qa_artifacts/runs/20260531_s952_A/_FINDINGS_REPORT.md` | 4683 | non-tracciato (mtime fs) 2026-05-31 | Workflow A — Live E2E Forensic QA Report (S952) |
| `qa_artifacts/s936_outcome_summary.md` | 6859 | 2026-05-26 | S936 follow-up tasks — outcome summary 2026-05-26 |
| `qa_artifacts/s936_pathG_test_outcome.md` | 3967 | 2026-05-26 | S936-1 Path G build test — outcome 2026-05-26 |
| `qa_artifacts/storia36/custodia-2026-07-27.md` | 8429 | 2026-07-27 | storia36 — custodia 2026-07-27 |
| `qa_artifacts/storia36/custodia-2026-07-28.md` | 23327 | 2026-07-28 | storia36 — custodia 2026-07-28 |
| `qa_artifacts/storia36/custodia-2026-07-29.md` | 55233 | non-tracciato (mtime fs) 2026-07-29 | storia36 — custodia 2026-07-29 |
| `qa_artifacts/storia36/custodia-2026-07-31.md` | 56394 | non-tracciato (mtime fs) 2026-07-31 | storia36 — custodia 2026-07-31 |
| `qa_artifacts/storia36/custodia-2026-08-06.md` | 16334 | non-tracciato (mtime fs) 2026-08-06 | storia36 — custodia 2026-08-06 |
| `qa_artifacts/storia36/custodia-2026-08-07.md` | 56879 | non-tracciato (mtime fs) 2026-08-07 | storia36 — custodia 2026-08-07 |
| `qa_artifacts/storia36/custodia-2026-08-08.md` | 56879 | non-tracciato (mtime fs) 2026-08-08 | storia36 — custodia 2026-08-08 |
| `qa_artifacts/storia36/custodia-2026-08-10.md` | 57198 | non-tracciato (mtime fs) 2026-08-10 | storia36 — custodia 2026-08-10 |
| `qa_artifacts/storia36/custodia-2026-08-15.md` | 57198 | non-tracciato (mtime fs) 2026-08-15 | storia36 — custodia 2026-08-15 |
| `qa_artifacts/storia36/custodia-2026-08-21.md` | 57198 | non-tracciato (mtime fs) 2026-08-21 | storia36 — custodia 2026-08-21 |
| `qa_artifacts/v1.0.0_release_notes.md` | 2297 | 2026-06-02 | Heuresys Advanced — v1.0.0 (GA baseline) |
| `qa_artifacts/x13_e2e_coverage_matrix.md` | 9903 | 2026-05-23 | MVP-2a E2E Coverage Matrix — Batch X13 Block A |
| `qa_artifacts/x17_release_notes_v0.2.1.md` | 3874 | 2026-05-24 | v0.2.1-mvp2a-final — MVP-2a acceptance-criteria-complete + live-verified |
| `qa_artifacts/x18_mvp3_release_notes_v0.3.1.md` | 7775 | 2026-05-25 | MVP-3 final — Release Notes v0.3.1-mvp3-final |
| `README.md` | 17160 | 2026-08-16 | Heuresys Advanced — HRMS / BPM Platform v5 |
| `sessioni/session_2026-05-26_forensic-state-of-the-art/FORENSIC_STATE_OF_ART_2026-05-26.md` | 57679 | 2026-07-25 | Forensic State of the Art — Heuresys Advanced HRMS/BPM Platform v5 |
| `sessioni/session_2026-05-26_forensic-state-of-the-art/preflight_baselines/F0_BASELINE_SUMMARY.md` | 4644 | 2026-05-26 | Phase 0 — Baseline Capture Summary |
| `sessioni/session_2026-05-26_forensic-state-of-the-art/PREFLIGHT_PLAN_2026-05-26.md` | 19088 | 2026-05-26 | Pre-flight Plan — Heuresys Advanced 2026-05-26 |
| `sessioni/session_2026-05-26_preflight/NEXT_SESSION_START.md` | 16367 | 2026-05-26 | Next Session Start — istruzioni operative per Enzo |
| `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md` | 15933 | 2026-05-26 | Pre-flight Report — Heuresys Advanced 2026-05-26 |
| `sessioni/session_2026-05-26_s935/S935_SESSION_REPORT.md` | 12149 | 2026-05-26 | S935 Session Report — Sequenza autonoma B → C → E → F → D |
| `sessioni/session_2026-05-26_s937_housekeeping/HANDOVER_CLI.md` | 91224 | 2026-07-25 | HANDOVER A CLI — Stato forense Heuresys Advanced (post S937) |
| `sessioni/session_2026-05-26_s937_housekeeping/NEXT_SESSION_START.md` | 12464 | 2026-05-26 | NEXT_SESSION_START — S937 Housekeeping closure + return to dev |
| `sessioni/session_2026-05-26_s937_housekeeping/S937_SESSION_REPORT.md` | 10627 | 2026-05-26 | S937 Session Report — Housekeeping closure PARTIAL + R23/iii eccezione SSH |
| `START_HERE.md` | 11621 | 2026-05-16 | START HERE — Heuresys Advanced HRMS/BPM Platform v5 |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/assets/icons/custom/README.md` | 352 | 2026-05-17 | Custom Icons |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/assets/README.md` | 1868 | 2026-05-20 | Assets Directory |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/00_context_and_scope.md` | 1402 | 2026-05-17 | 00 — Context and Scope |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/01_dashboard_shell_architecture.md` | 2639 | 2026-05-17 | 01 — Dashboard Shell Architecture |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/02_dom_breadcrumb_and_rendering_model.md` | 2039 | 2026-05-17 | 02 — DOM, Breadcrumb and Rendering Model |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/03_navigation_model_sidebar_tabs_routes.md` | 2707 | 2026-05-17 | 03 — Navigation Model: Sidebar, Tabs and Routes |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/04_autonomous_module_page_contract.md` | 2159 | 2026-05-17 | 04 — Autonomous Module Page Contract |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/05_dynamic_shell_context.md` | 2053 | 2026-05-17 | 05 — Dynamic Shell Context |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/06_header_specification.md` | 9865 | 2026-05-20 | 06 — Header Specification |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/07_sidebar_specification.md` | 10843 | 2026-05-20 | 07 — Sidebar Specification |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/08_footer_specification.md` | 3817 | 2026-05-20 | 08 — Footer Specification |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/09_design_system_and_tokens.md` | 10118 | 2026-05-20 | 09 — Design System and Tokens |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/10_graphic_assets_and_icon_system.md` | 6132 | 2026-05-20 | 10 — Graphic Assets and Icon System |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/11_showcase_and_decision_workflow.md` | 2528 | 2026-05-17 | 11 — Showcase and Decision Workflow |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/12_page_types_to_design.md` | 4642 | 2026-05-20 | 12 — Page Types to Design |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/13_best_practices_for_modern_saas_ui.md` | 8563 | 2026-05-20 | 13 — Best Practices for Modern SaaS UI |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/14_accessibility_responsiveness_quality.md` | 2141 | 2026-05-17 | 14 — Accessibility, Responsiveness and Quality |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/15_implementation_backlog.md` | 2141 | 2026-05-17 | 15 — Implementation Backlog |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/16_system_health_admin_dashboard_patterns.md` | 10490 | 2026-05-20 | 16 — System Health / Admin Dashboard Patterns |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/governance/ACCEPTANCE_CRITERIA.md` | 1995 | 2026-05-17 | Acceptance Criteria |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/governance/ACCESSIBILITY_CHECKLIST.md` | 682 | 2026-05-17 | Accessibility Checklist |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/governance/INTERACTION_REGISTER_TEMPLATE.md` | 4400 | 2026-05-20 | Interaction Register Template |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/governance/QUALITY_GATES.md` | 1305 | 2026-05-17 | Quality Gates |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/governance/VISUAL_QA_CHECKLIST.md` | 985 | 2026-05-17 | Visual QA Checklist |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/ISTRUZIONI.md` | 5600 | 2026-05-17 | Instructions for the Development Team |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/MANIFEST.md` | 3032 | 2026-05-17 | Bundle Manifest |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/prompts/CODING_AGENT_MASTER_PROMPT.md` | 2641 | 2026-05-17 | Coding Agent Master Prompt — Heuresys UX/IX Brand Identity |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/prompts/DESIGN_DECISION_CAPTURE_PROMPT.md` | 634 | 2026-05-17 | Design Decision Capture Prompt |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/prompts/SHOWCASE_GENERATION_PROMPT.md` | 865 | 2026-05-17 | Showcase Generation Prompt |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/README.md` | 2229 | 2026-05-17 | Heuresys UX/IX Brand Identity Bundle v1 |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/showcase/SHOWCASE_REQUIREMENTS.md` | 700 | 2026-05-17 | Showcase Requirements |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/showcase/showcase-routes.md` | 838 | 2026-05-17 | Proposed Showcase Routes |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/templates/ADR_TEMPLATE.md` | 841 | 2026-05-17 | ADR: [Decision Title] |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/templates/ASSET_REGISTER_TEMPLATE.md` | 639 | 2026-05-17 | Asset Register |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/templates/DECISION_REGISTER.md` | 2301 | 2026-05-20 | Heuresys UX/IX Decision Register |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/templates/PAGE_DESIGN_BRIEF_TEMPLATE.md` | 722 | 2026-05-17 | Page Design Brief: [Page Name] |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/templates/PALETTE_DECISION_TEMPLATE.md` | 561 | 2026-05-17 | Palette Decision Record |
| `ux-design/heuresys_uxix_brand_identity_bundle_v1/templates/SHOWCASE_REVIEW_TEMPLATE.md` | 384 | 2026-05-17 | Showcase Review |

## Digesti per file letto, raggruppati per directory

Legenda ruolo: **SoT-stato** · **regola/dottrina** · **ADR/decisione** · **cronaca/archivio** · **prodotto/business** · **esterno-Codex** · **altro**.

### Radice del repo

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `CLAUDE.md` | regola/dottrina | Vincolante di progetto: invarianti I1-I22, DoD live-E2E, metodo di bonifica, comandi canonici, "il punto fisso" (mai cristallizzare misure variabili). Letto per intero via contesto di sistema. | No — aggiornato oggi stesso (git log 2026-08-24/25), autoconsistente con SOT_STATE §0 corrente. |
| `README.md` | prodotto/business | Overview pubblica: stack, monorepo layout, getting-started, roadmap MVP-0→4 chiuse, invarianti sintetici, personas di test con email reali. | No — dichiara esplicitamente di non hardcodare i conteggi volatili; punta a SOT_STATE.md. |
| `START_HERE.md` | cronaca/archivio | Entry-point storico pre-MVP-0 (2026-05-16): 7 doc di priming, Q1/Q2/Q4 (Fastify4/Drizzle/location DB) da decidere, 27 migration previste, roadmap MVP-0 step 5.0.1. | **Sì** — descrive uno stato "planning completo, MVP-0 ready to start" che precede l'intera costruzione (oggi ~350 migration, v1.0.0 GA); Q1/Q2/Q4 risolte da tempo (Fastify5, no-Drizzle, ADR-0010 Option B). |
| `AGENTS.md` | esterno-Codex | Equivalente di CLAUDE.md per Codex (non tracciato in git). Ripete gran parte della dottrina ma con I12 nella formulazione PRE-ADR-0038 ("brownfield = authoritative data source") e RBAC/personas non aggiornati (cita `admin@heuresys.com`). | **Sì** — vedi §Contraddizioni: diverge da CLAUDE.md su I12 e su un utente rimosso dalla migrazione 000295. |
| `heuresys-advanced-bootstrap-vm.md` | cronaca/archivio | Runbook di bootstrap VM datato 2026-05-17: clona `ux-design-shared` come sibling e linka `@heuresys/ui` via `link:`, 27 migration, 56 moduli/267 endpoint, login `admin@heuresys.com`. | **Sì** — descrive il modello `link:` pre-X18 (oggi `@heuresys/ui` è npm-published), conteggi di moduli/migration di due ordini di grandezza inferiori all'attuale; già "non testato sulla VM" alla stesura. |

### `.claude/` — regole e skill

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `.claude/rules/api-module-pattern.md` | regola/dottrina | Pattern modulo API a 7 step, catena 13 plugin Fastify, distinzione FORBIDDEN vs PERMISSION_DENIED (misurata su 532 usi). | No, cross-referenziato e coerente con CLAUDE.md. |
| `.claude/rules/db-migrations.md` | regola/dottrina | Regole migrazioni: idempotenza, prova generale `ci-rehearsal.sh`, ADR-0035 (emenda la fonte), le 4 cose di ogni scrittura di massa, `brownfield` ritirato. | No, coerente e aggiornata (cita mig 000297, S1052). |
| `.claude/rules/design-system-ui.md` | regola/dottrina | `@heuresys/ui` npm-published post-X18, i due NEVER (niente componenti/deps UI locali). | No, coerente col CLAUDE.md attuale (^0.1.9). |
| `.claude/rules/frontend-live-data.md` | regola/dottrina | Dottrina LIVE DATA E2E ONLY per apps/web e apps/showcase: no mock, API-first, wiring completo. | No. |
| `.claude/rules/security-auth.md` | regola/dottrina | Modello di sicurezza auth: Argon2id, JWT/refresh, ruoli (misurati, non a memoria), `admin@heuresys.com` **non esiste più** (mig 000295, misurato S1052). | No — è il documento che segnala la contraddizione altrove (AGENTS.md, HEAD_ADVANCED bootstrap) che lo citano ancora. |
| `.claude/rules/tests.md` | regola/dottrina | Vitest transazionale per-file, Playwright prod-only, wrapper Node22 (D-36), stessa nota su `admin@heuresys.com` rimosso. | No. |
| `.claude/skills/full-alignment-deploy/SKILL.md` | regola/dottrina | Dottrina di allineamento cloni (VM+linux-pc) e deploy; push = autorizzazione per la sessione. | No. |
| `.claude/skills/project-atlas/SKILL.md` | regola/dottrina | Skill per l'atlas cross-layer e le linee di sviluppo prodotto; 4 modi (status/refresh/query/dossier). | No. |
| `.claude/skills/project-atlas/references/curated-template.md` | regola/dottrina | Struttura a 12 sezioni di ATLAS_CURATED.md. | No. |
| `.claude/skills/project-atlas/references/dossier-template.md` | regola/dottrina | Pre-check bloccante su età di ATLAS_CURATED prima di un dossier. | No. |
| `.claude/skills/project-atlas/references/goal-recipes.md` | regola/dottrina | Condizioni `/goal` misurabili senza interpretazione. | No. |
| `.claude/skills/project-atlas/references/LEARNINGS.md` | regola/dottrina | Log auto-aggiornato di lezioni della skill atlas. | No, per costruzione (append-only). |
| `.claude/skills/project-atlas/references/model-map.md` | regola/dottrina | Tabella modello×effort per tipo di agente dello sweep. | No. |
| `.claude/skills/project-atlas/references/planner.md` | regola/dottrina | I target dello sweep si derivano a runtime, mai hardcoded. | No. |
| `.claude/skills/project-atlas/references/sweep-prompts.md` | regola/dottrina | Template dei 19 prompt del full sweep, parametrizzati dal planner. | No. |
| `.claude/skills/storia36-custodia/SKILL.md` | regola/dottrina | Skill di custodia della storia RTL 36 mesi: triage a tre esiti, mai riparazione automatica di righe modificate. | No. |
| `.claude/skills/zero-pending-loop/SKILL.md` | regola/dottrina | Loop autonomo non presidiato verso zero pendenze: seleziona/implementa/verifica/adversarial/committa/decide. | No. |
| `.claude/skills/zero-pending-loop/README.md` | regola/dottrina | Guida di riferimento dell'impianto zero-pendenze; due regole non violabili (prompt non si auto-modificano, mai secondo writer di stato). | No. |
| `.claude/skills/zero-pending-loop/references/adversarial.md` | regola/dottrina | Le tre proprietà della review adversarial a tre revisori. | No. |
| `.claude/skills/zero-pending-loop/references/blast-radius.md` | regola/dottrina | Classi e corsie del raggio d'impatto di un cluster. | No. |
| `.claude/skills/zero-pending-loop/references/bootstrap.md` | regola/dottrina | Modo `bootstrap`: prima invocazione sul progetto. | No. |
| `.claude/skills/zero-pending-loop/references/close.md` | regola/dottrina | Condizioni osservabili di chiusura di una sessione zero-pendenze. | No. |
| `.claude/skills/zero-pending-loop/references/driver.md` | regola/dottrina | Contratto del driver esterno: interruzione, ripresa, continuità. | No. |
| `.claude/skills/zero-pending-loop/references/gates.md` | regola/dottrina | I gate si derivano dallo scope reale toccato, non da una lista fissa. | No. |
| `.claude/skills/zero-pending-loop/references/LEARNINGS.md` | regola/dottrina | Lezioni che la prossima iterazione non deve riscoprire; i numeri per iterazione stanno altrove. | No. |
| `.claude/skills/zero-pending-loop/references/operations.md` | regola/dottrina | Modello/effort/budget per attività, gestione `/goal` e degradazione. | No. |
| `.claude/skills/zero-pending-loop/references/protocol.md` | regola/dottrina | Protocollo di esecuzione di un cluster in 5 passi, 2 verificati da script. | No. |
| `.claude/skills/zero-pending-loop/references/selection.md` | regola/dottrina | Stato su file per la selezione del prossimo cluster: ogni iterazione parte da contesto vergine. | No. |

### `.handoff/`, `.github/`, `db/`, `apps/agent-gateway/`

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `.handoff/STATE.md` | SoT-stato | Vista rapida: ultima sessione (S1079/S1080), priorità correnti (#227 competenze isolate, `verifica_incrociata` rosso, #219 F5), domande aperte, comandi di verifica. | No — riscritta a ogni chiusura sessione, aggiornata a oggi. |
| `.github/PULL_REQUEST_TEMPLATE.md` | regola/dottrina | Template PR standard (area, evidenza di accettazione, note reviewer). | No. |
| `.github/SECURITY.md` | regola/dottrina | Policy di sicurezza pubblica: versioni supportate, come segnalare una vulnerabilità, fuori perimetro. | No. |
| `db/data/esco/README.md` | SoT-stato | Provenienza dataset ESCO v1.2.0 IT/EN, cosa è versionato vs gitignored, script di rigenerazione TSV, loader. | No. |
| `db/data/occupations/README.md` | SoT-stato | Provenienza ISCO-08 + CP2021 (bilingue), file versionati, comando di caricamento, validazione strutturale. | No. |
| `db/scripts/_lib/README.md` | cronaca/archivio | `xos_lib` — libreria bash cross-OS per extract SDBI (CW-B28 mitigation), batch Cowork C5.3, 2026-05-21. | Parzialmente — l'ingestione SDBI da legacy che descrive è now superata dal rubinetto chiuso (ADR-0038), ma il file resta come artefatto tecnico riusabile. |
| `db/scripts/README.md` | SoT-stato | Bootstrap/operazioni DB: due modelli (A localhost, B OCI VM), script reference, `ci-rehearsal.sh` spiegato in dettaglio con misure reali (2026-08-07). | No. |
| `db/seeds/rtl-banking-skills/README.md` | SoT-stato | Stato dei 5 seed one-shot fuori catena migrazioni: 2 già applicati, 1 superato, 5 non verificati in questa sessione. Misurato 2026-08-13. | No, ma segnala esplicitamente i propri limiti di verifica. |
| `db/seeds/rtl-rebuild/README.md` | cronaca/archivio | Piano WRITE seed set datato 2026-05-30, "DRAFT, NOT executed" — ma il tenant RTL è stato ricostruito da allora (S950) e questi seed sono poi stati RITIRATI (vedi file gemello). | **Sì** — il file stesso non è mai stato aggiornato a "RITIRATO", lo status "DRAFT/NOT executed" resta scritto mentre il gemello `RETIRED.md` nella stessa cartella dichiara i seed non più eseguibili dal 2026-08-07. |
| `db/seeds/rtl-rebuild/RETIRED.md` | cronaca/archivio | Dichiara i seed di rtl-rebuild ritirati (2026-08-07, S1049): la migrazione 000283 ha rimosso le tabelle di appoggio `staging.rtl_*`; spiega cosa resta e perché. | No, il documento che aggiorna correttamente lo stato. |
| `db/seeds/storia36/README.md` | SoT-stato | Contratto dei seed storia36 (idempotenza, id deterministici v5, post-condizioni fail-loud), elenco dei cluster C0-C5 con contenuto misurato. | No. |
| `apps/agent-gateway/README.md` | SoT-stato | Backend Agent SDK + MCP (#9 WI-B): layout dei file, stato "mock-first slice" al 2026-06-15, residuo WI-B.2 (bridge HTTP/SSE). | **Sì** — dichiara "mock-first" e "nulla è deployato" ma il progetto memory indica l'agente #9 come "CHIUSO" su abbonamento MAX da tempo; da riverificare contro lo stato attuale del modulo. |

### `docs/architecture/` — ADR e contratto componenti

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `docs/architecture/ADR_INDEX.md` | ADR/decisione | Indice generato (build_adr_index.py) dei 36 ADR con stato/data/descrizione. | No, rigenerato meccanicamente. |
| `docs/architecture/adr/0001_monorepo_tool_pnpm.md` | ADR/decisione | pnpm workspaces scelto su npm/yarn/turborepo/nx. Accepted 2026-05-16. | No. |
| `docs/architecture/adr/0002_backend_framework_fastify.md` | ADR/decisione | Fastify 4 scelto su Express/Hono/NestJS. Accepted (overridable). | Si, descrive Fastify 4; il repo gira oggi su Fastify 5 (README/CLAUDE.md), mai formalmente superseded da un nuovo ADR. |
| `docs/architecture/adr/0003_db_access_drizzle_plus_raw_sql.md` | ADR/decisione | Drizzle+raw SQL. Status: Superseded in part (S989) — la parte Drizzle non fu mai adottata e i pacchetti sono stati rimossi; raw SQL resta in vigore. | No, auto-dichiarato superseded in parte. |
| `docs/architecture/adr/0004_no_docker_native_postgresql.md` | ADR/decisione | PostgreSQL nativo, no Docker sul path canonico (I13); nota 2026-05-31 sulla distinzione source-vs-runtime per il legacy Docker. | No. |
| `docs/architecture/adr/0005_password_hashing_argon2id.md` | ADR/decisione | Argon2id 64MiB/3/4 su bcrypt/scrypt/PBKDF2. | No. |
| `docs/architecture/adr/0006_auth_strategy_jwt_plus_httponly_cookie.md` | ADR/decisione | JWT 15min + refresh 30gg rotazione + CSRF double-submit. | No. |
| `docs/architecture/adr/0007_frontend_next15_app_router.md` | ADR/decisione | Next.js 15 App Router + React 19 + Tailwind4 + shadcn/ui + React Flow. | Parzialmente, la versione dichiarata (Next 15) e' antecedente al bump a Next 16 (B-23, SOT_STATE). |
| `docs/architecture/adr/0008_position_intelligence_profile_as_view.md` | ADR/decisione | PIP come VIEW relazionale, mai blob JSONB (I9). | No, invariato e tuttora applicato. |
| `docs/architecture/adr/0009_visualization_node_layouts_separate_table.md` | ADR/decisione | Tabella dedicata sys_visualization_node_layouts per layout multipli/versionati/lock. | No. |
| `docs/architecture/adr/0010_postgresql_runtime_location.md` | ADR/decisione | Runtime PG su OCI VM (Option B) via tunnel SSH, aperta e chiusa lo stesso giorno (RD-25). | No, tuttora l'architettura attiva. |
| `docs/architecture/adr/0011_ess_scope_inclusion.md` | ADR/decisione | Inclusione ESS come MVP-2b: 13 pagine /me/*, 18 endpoint, 19 permessi self-scope, hard self-scope enforcement. | No. |
| `docs/architecture/adr/0012_brownfield_table_mapping_wave_column.md` | ADR/decisione | Colonna dedicata table_mapping_wave su brownfield.table_mappings. | Si, lo schema brownfield che descrive e' stato ritirato (#164 F4, mig 000297); l'ADR resta storicamente valido ma l'oggetto che governa non esiste piu'. |
| `docs/architecture/adr/0013_showcase_sot_policy.md` | ADR/decisione | Policy SoT a 4 livelli per lo showcase (ui-libreria to web to showcase to GH Pages), con emendamento sul meccanismo di dipendenza. | No. |
| `docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md` | ADR/decisione | SDBI, paradigma complementare all'ETL brownfield deterministico, 6 fasi AI-led. Accepted, pilota Goals/OKR shippato. | Si, l'ingestione dal legacy che descrive e' superata da ADR-0038 (rubinetto chiuso). |
| `docs/architecture/adr/0015_sys_job_roles_nullable_family_fk.md` | ADR/decisione | FK job_role_family_id resa nullable (CW-B26 pattern). | No, effetto strutturale permanente. |
| `docs/architecture/adr/0016_sys_esco_occupation_mappings_nullable_job_role_fk.md` | ADR/decisione | FK job_role_id resa nullable + fix engine per 7645 righe ESCO. | No. |
| `docs/architecture/adr/0017_lookup_fk_2hop_transform.md` | ADR/decisione | Transform LOOKUP_FK_2HOP per risoluzione a 2 salti nel wave-executor. Formalizzato retroattivamente 2026-05-26. | Si, meccanismo dell'ingestione brownfield oggi ritirata (ADR-0038); resta come cronaca tecnica. |
| `docs/architecture/adr/0018_coalesce_uq_class_of_bug.md` | ADR/decisione | Classe di bug split-on-COALESCE nel wave-executor: helper parenthesis-depth-aware, 10 tabelle affette enumerate. | Si, componente dell'ingestione oggi congelata. |
| `docs/architecture/adr/0020_wave2_scope_application_level_targets.md` | ADR/decisione | 3 target riclassificati IMPORT to REFERENCE_ONLY (dati application-level, non da brownfield). | Si, riguarda la classificazione Wave del brownfield, oggi ritirato. |
| `docs/architecture/adr/0021_ssh_tunnel_automation_and_service_key.md` | ADR/decisione | Chiave SSH dedicata no-passphrase, capability-ristretta, per il tunnel automatico 5433 to 5432. | No, meccanismo tuttora attivo. |
| `docs/architecture/adr/0023_data_source_doctrine.md` | ADR/decisione | Status: SUPERSEDED da ADR-0038 (dichiarato nel file stesso). Descrive la dottrina "legacy = fonte autoritativa" oggi cronaca. | No, auto-dichiarato superseded, coerente. |
| `docs/architecture/adr/0024_legacy_ingestion_employee_centric.md` | ADR/decisione | La persona legacy e' employees (207 FK) non users (45 FK); chiave crosswalk LEGACY_EMP::. | No, invariante I14 tuttora citato da CLAUDE.md. |
| `docs/architecture/adr/0025_sys_skill_categories_nullable_family_fk.md` | ADR/decisione | FK nullable + investigazione WS-3 activity-classification-mapping (residuo FK-conflict). | No, effetto strutturale permanente. |
| `docs/architecture/adr/0026_single_production_environment_two_tenants.md` | ADR/decisione | Un solo ambiente ed e' produzione; RTL Bank + Heuresys System sono i tenant correnti, non di test. | Parziale, usa la locuzione no-PII globale/dati sintetici che l'OUTPUT RULE di CLAUDE.md (S1011) ritira come descrittore. Vedi Contraddizioni. |
| `docs/architecture/adr/0027_two_axis_contextual_authorization.md` | ADR/decisione | Status: SUPERSEDED by ADR-0036 (dichiarato). Modello bi-assiale organizzativo/funzionale; la regola cardinale I18 sopravvive. | No, auto-dichiarato superseded, coerente. |
| `docs/architecture/adr/0028_ci_enforcement_at_deploy_gate.md` | ADR/decisione | Enforcement CI al deploy-gate, non ai required-status-check di branch protection (solo-maintainer direct-to-main). | No. |
| `docs/architecture/adr/0029_reference_data_i18n_translations_table.md` | ADR/decisione | i18n dati di riferimento: IT canonico in-row + tabella centrale sys_reference_translations. | No, implementato. |
| `docs/architecture/adr/0030_esco_skill_group_ontology.md` | ADR/decisione | sys_skill_groups come cittadino di prim'ordine; copertura ontologica dichiarata 99,4% (13.952/14.041) al 2026-07-21. | Si, vedi Contraddizioni: .handoff/STATE.md corrente (S1079) parla di 4.464 competenze isolate = 31,8% del catalogo, in forte contrasto col 99,4% qui dichiarato. |
| `docs/architecture/adr/0031_ess_self_view_computed_intelligence.md` | ADR/decisione | Il dipendente vede i propri score calcolati (capability, flight-risk) in forma coach, mai framing rischio fuga. | No. |
| `docs/architecture/adr/0032_platform_mandate_masks_pay_and_evaluation.md` | ADR/decisione | mask diventa il quarto stato di autorizzazione; PLATFORM_ADMIN e' mandato tecnico, non apre COMPENSATION/EVALUATION. | No, assorbito e confermato da ADR-0036. |
| `docs/architecture/adr/0033_generic_tool_catalogue_over_domain_metadata.md` | ADR/decisione | Status: PROPOSED, non implementato — catalogo di strumenti generici per l'agente sui metadati di dominio invece di uno strumento per modulo. | No, coerentemente marcato proposta. |
| `docs/architecture/adr/0034_migration_chain_is_schema_over_a_data_baseline.md` | ADR/decisione | La catena migrazioni e' schema+controlli, non un ricostruttore da zero (misurato: si ferma a 000049 su DB vergine). | No. |
| `docs/architecture/adr/0035_retirement_amends_the_source_never_deletes_downstream.md` | ADR/decisione | Ritirare un oggetto = emendare il file che lo crea, mai solo cancellare a valle (osservato 3 volte in S1049). | No, dottrina attiva citata ovunque. |
| `docs/architecture/adr/0036_hierarchical_and_functional_domains.md` | ADR/decisione | Domini gerarchici/funzionali ortogonali, matrice M1, supera ADR-0027, assorbe ADR-0032. Sei criteri C1-C6. | No, la dottrina attualmente citata da CLAUDE.md I16-I22. |
| `docs/architecture/adr/0037_user_deletion_is_anonymization.md` | ADR/decisione | Cancellare una persona = anonimizzarla; la cancellazione fisica esiste gia' (gdpr/erasure) ed e' la revoca di una creazione errata. | No. |
| `docs/architecture/adr/0038_the_database_is_self_sufficient.md` | ADR/decisione | Il database e' autosufficiente; il brownfield e' storia, non fonte — supersede ADR-0023, emenda I12. | No, la dottrina corrente, coerente con CLAUDE.md. |
| `docs/architecture/brand-component-contract.md` | regola/dottrina | Contratto tipo-di-oggetto to componente ui-libreria canonico, regola d'importazione (CW-B59), protocollo di verifica per pagina. Approved S947. | No, coerente e ancora citata dal design system. |

Nota: la numerazione ADR salta 0019 e 0022 (mai assegnati/mai committati); non risultano file per quei numeri in nessuna directory del repo.

### `docs/product/` — SoT del dominio prodotto

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `docs/product/README.md` | prodotto/business | Mappa dei documenti del dominio prodotto, regola anti-duplicazione T2 (i conteggi vivono solo in SOT_STATE.md). | No. |
| `docs/product/BUSINESS_SCOPE_AND_PRD.md` | prodotto/business | Business scope + PRD: sfida la tesi "Organizational Intelligence", ICP risolto (mid-market EU regolato), gap G1-G6, roadmap Now/Next/Later. | Parziale, il competitor diretto scelto qui e nel COMPETITIVE_SCORECARD e' 365Talents; il contesto operativo di questo censimento dichiara invece Personio come diretto — vedi Contraddizioni. |
| `docs/product/COMPETITIVE_SCORECARD.md` | prodotto/business | Benchmark investor-grade vs 13 vendor (compreso 365Talents come diretto EU); adjudicazione spietata dei 4 differenziatori dichiarati. | Vedi nota sopra su Contraddizioni (competitor). |
| `docs/product/FUNCTIONAL_CAPABILITY_LEDGER.md` | prodotto/business | Guida-alla-verifica: stato verificato live di ogni capability (Implementato/Parziale/Latente/Scoperto/Assente), con evidenza file:line e conteggi al 2026-06-19. | Si, i conteggi live sono dichiarati "evidenza al 2026-06-19" (S998): oltre due mesi fa, in un progetto con altissima cadenza di sviluppo (decine di sessioni successive misurate). |
| `docs/product/LATENT_CAPABILITY_CATALOG.md` | cronaca/archivio | Stub-redirect: il catalogo originale e' stato ritirato il 2026-06-19 e assorbito nel Ledger; il file resta come puntatore. | No, dichiarato esplicitamente come ritirato. |
| `docs/product/WORKITEM_GAP1_DESIGN_SPEC.md` | prodotto/business | Blueprint esecutivo del Gap#1 (Porte Process/Org + MLCE + Maturity): data-model, algoritmi, endpoint, 9 decisioni di scope aperte. Stato: PROPOSTA. | Si, il Gap#1 risulta SHIPPATO (S999, citato da altri doc dello stesso dominio come DEVELOPMENT_LINES_F e ADR-0031) mentre questo file resta marcato "Stato: PROPOSTA". |
| `docs/product/WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` | prodotto/business | Piano esecutivo del Gap#1 con fasi/effort/acceptance (7,5-9 person-week stimate). Stato: proposta. | Si, stesso motivo del file gemello: il Gap#1 e' oggi chiuso end-to-end secondo altri documenti piu' recenti. |
| `docs/product/WORKITEM_GAP1_PHASE0_VERIFICATION.md` | prodotto/business | Verifica Fase 0 dei building-block del Gap#1 (2026-06-19): MLCE e Maturity ASSENTI, PIP/requirements/insights presenti. | Si, MLCE e Maturity risultano poi costruiti (S999) secondo DEVELOPMENT_LINES_F — non e' un errore del documento (era vero il giorno della misura) ma la sua conclusione centrale e' superata. |
| `docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md` | prodotto/business | Dossier di brainstorming: 8 linee (L0-L8) per esporre dati gia' presenti ma non raggiungibili da API; evidenza datata 2026-07-05. Stato: PROPOSTO. | Parziale, evidenza esplicitamente datata; le scelte restano a Enzo e non sono verificabili come eseguite senza incrociare il register vivo. |
| `docs/product/DEVELOPMENT_LINES_B_ACTIVATE_DORMANT_CODE.md` | prodotto/business | 7 linee (B1-B7) per accendere codice gia' costruito ma spento (flag OFF, engine senza dati). Stato: PROPOSTO. | Parziale, stessa natura di evidenza datata. |
| `docs/product/DEVELOPMENT_LINES_C_ADMIN_EDITING_UI.md` | prodotto/business | 4 linee (C1-C4) per portare l'admin SPA da console di lettura a strumento di gestione (83% read-only misurato). Stato: PROPOSTO. | Parziale, stessa natura. |
| `docs/product/DEVELOPMENT_LINES_D_WAVE2_LEGACY_DATA.md` | prodotto/business | 5 linee (D1-D5) di import mirato dal legacy (65 tabelle >1000 righe non coperte da Wave-1). Stato: PROPOSTO. | Si, in aggiunta alla datazione: propone import dal legacy che l'invariante I12/ADR-0038 (2026-08-14, posteriore) vieta esplicitamente ("nessun dato riferito al brownfield deve essere rimesso in circolo"). |
| `docs/product/DEVELOPMENT_LINES_E_EVO_VERTICALS.md` | prodotto/business | 6 linee (E1-E6) di porting concettuale (mai di codice) dai verticali del cantiere evo: whistleblowing, SSO, T&A, payroll, recruiting/ATS. Stato: PROPOSTO. | Parziale, evidenza datata; il porting e' concettuale quindi meno esposto al rubinetto chiuso. |
| `docs/product/DEVELOPMENT_LINES_F_PRESCRIPTIVE_INTELLIGENCE.md` | prodotto/business | 5 linee (F1-F5) sul layer prescrittivo sopra MLCE, dichiarato sbloccato dal Gap#1 (S999). Stato: PROPOSTO. | Parziale, evidenza datata 2026-07-05. |
| `docs/product/DEVELOPMENT_LINES_G_PLATFORM_HYGIENE.md` | prodotto/business | 6 linee (G1-G6) di igiene piattaforma: retention, RBAC, integrita' dati, doc-drift, script esauriti, wiki/grafi. Stato: PROPOSTO. | Parziale, evidenza datata; alcune voci (es. doc-drift CLAUDE.md) risultano gia' assorbite da sessioni successive. |

### `docs/brownfield/` — pipeline di ingestione legacy (ritirata)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `docs/brownfield/BROWNFIELD_ADAPTATION_MAP.md` | cronaca/archivio | Deliverable #4/10: mappatura legacy heuresys_platform to sys.sys_*, 576 tabelle. Vieta la modifica senza rieseguire la catena di ispezione. | Si, descrive l'intera pipeline brownfield/wave, oggi congelata dal rubinetto chiuso (ADR-0038/I12). |
| `docs/brownfield/BROWNFIELD_EXCLUSION_REPORT.md` | cronaca/archivio | Deliverable #7/10: ogni tabella legacy esclusa con motivazione difendibile (84+7 esclusioni su 583). | Si, stesso motivo. |
| `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` | cronaca/archivio | Deliverable #6/10: pipeline end-to-end + 4 wave sequenziali di import. | Si, descrive un piano di import oggi vietato dal rubinetto chiuso. |
| `docs/brownfield/BROWNFIELD_TABLE_CLASSIFICATION_REPORT.md` | cronaca/archivio | Deliverable #5/10: rationale IMPORT/TRANSFORM/REFERENCE_ONLY/EXCLUDE per ogni tabella legacy. | Si, stesso motivo. |
| `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` | regola/dottrina | Mappa operativa che ADR-0024 governa: legacy employees to sys.sys_users, mai legacy users. Canonico, citato da CLAUDE.md I14. | No, la dottrina dei crosswalk resta valida come chiave storica anche col rubinetto chiuso. |
| `docs/brownfield/ENGINE_STATUS.md` | SoT-stato | Stato dell'ETL brownfield: FROZEN in PROD (D-11, S1023), flag BROWNFIELD_ENGINE_ENABLED=false su PROD, riabilitabile per una nuova wave. | Si, vedi Contraddizioni: descrive un percorso di riabilitazione per future wave di import che il successivo ADR-0038 (2026-08-14) preclude in modo esplicito e generale. |
| `docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md` | cronaca/archivio | Checklist operativa Wave 1 (2026-05-18): ADR-0012 chiuso, pre-flight scoping, wave 3-4 gated su human approval. | Si, descrive l'unica wave storicamente eseguita di un processo oggi congelato. |
| `docs/brownfield/wave_runners/wave_2_runner.md` | cronaca/archivio | Runbook Wave 2 (operating model RTL): Status DRAFT, in attesa di sign-off Enzo — mai eseguito. | Si, mai eseguito e oggi precluso dal rubinetto chiuso. |
| `docs/brownfield/wave_runners/wave_3_runner.md` | cronaca/archivio | Runbook Wave 3 (dati sensibili tenant + human approval gates): Status DRAFT, mai eseguito. | Si, stesso motivo. |
| `docs/brownfield/wave_runners/wave_4_runner.md` | cronaca/archivio | Runbook Wave 4 (intelligence avanzata + aggregazione cross-tenant): Status DRAFT, mai eseguito, ultima wave del piano. | Si, stesso motivo. |

### `docs/due-diligence/` — due diligence investor-grade (2026-06-17)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `docs/due-diligence/00_CHARTER.md` | prodotto/business | Mandato DD forense investor-grade (16 pilastri, postura avversariale), HEAD ce26608, data avvio 2026-06-17. | Si, data interna vecchia (oltre due mesi), progetto ad alta cadenza — vedi Contraddizioni sui conteggi. |
| `docs/due-diligence/01_DISCOVERY.md` | prodotto/business | Baseline misurata (75 moduli, 424 endpoint, 130 migration, 193 tabelle sys.*) vs claim del venditore; domande al founder + assunzioni esplicite. | Si, stessa datazione; i conteggi (moduli/migrazioni/tabelle) sono oggi radicalmente diversi (SOT_STATE parla di 352 migrazioni, 231 tabelle a fine agosto). |
| `docs/due-diligence/EXECUTIVE_SUMMARY.md` | prodotto/business | Score globale 61/100, verdetto CONDITIONAL-GO; top forze/rischi/GA-blocker/condizioni di remediation. | Si, stessa datazione — nessun aggiornamento dello score dopo due mesi di sviluppo intenso. |
| `docs/due-diligence/REPORT.md` | prodotto/business | Rapporto completo: punti di forza/debolezza, debito tecnico/funzionale, benchmarking tecnologico, programma di sviluppo verso GA (27-45 person-week). | Si, stessa datazione. |
| `docs/due-diligence/SCORECARD.md` | prodotto/business | Scorecard a 16 pilastri con pesi e contributi, calcolo per esteso, verdetto CONDITIONAL-GO (61/100). | Si, stessa datazione. |
| `docs/due-diligence/SCORECARD_ACQUIRER_RUTHLESS.md` | prodotto/business | Ripesatura avversariale "acquirente spietato": score ricalcolato 45-57/100, verdetto ribaltato a NO-GO come investimento in azienda, forse-SI come acqui-hire. | Si, stessa datazione; inoltre e' una lente dichiaratamente pessimistica, non una DD alternativa. |
| `docs/due-diligence/workstreams/WS-P1.md` | prodotto/business | Pilastro P1 (product readiness & GA-gap): score 58/100, GA tecnica ma non commerciale, zero percorso di acquisizione cliente. | Si, stessa datazione della DD (2026-06-17). |
| `docs/due-diligence/workstreams/WS-P2.md` | prodotto/business | Pilastro P2 (market & competitive): score 44/100, TAM ampio ma difendibilita' quasi nulla, single-developer pre-revenue. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-P3.md` | prodotto/business | Pilastro P3 (business model): score 38/100 Critico, zero monetizzazione implementata, unit economics non calcolabili. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-P4.md` | prodotto/business | Pilastro P4 (AI/LLM business value): score 52/100, insight = euristiche non ML, semantic-matching = AI genuina ma senza moat. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-T1.md` | prodotto/business | Pilastro T1 (architecture soundness): score 72/100, monorepo coerente, CI-runner=VM-PROD come debito principale. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-T2.md` | prodotto/business | Pilastro T2 (codebase quality): score 74/100, 0 IDOR/SQLi, boilerplate ActorContext duplicato 613 volte. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-T3.md` | prodotto/business | Pilastro T3 (technical debt): score 62/100, DEBT_REGISTER curato ma 4 debiti attivi non registrati trovati dalla DD. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-T4.md` | prodotto/business | Pilastro T4 (technology fit): score 65/100, stack moderno ma infra OCI free-tier non enterprise-ready. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-T5.md` | prodotto/business | Pilastro T5 (data & DBMS): dati strutturalmente solidi, 0 ENUM/0 violazioni FK, asset ESCO come punto di forza. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-T6.md` | prodotto/business | Pilastro T6 (security posture): audit forense statico, CSRF/Argon2id/TOTP solidi, nessun exploit su prod. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-T7.md` | prodotto/business | Pilastro T7 (AI/ML robustness): tre strati (semantic matching solido, free-text gated OFF, agent-gateway su abbonamento personale). | Si, stessa datazione; inoltre l'agente #9 risulta oggi CHIUSO su abbonamento MAX (vedi memoria progetto), possibile ulteriore drift. |
| `docs/due-diligence/workstreams/WS-T8.md` | prodotto/business | Pilastro T8 (operational readiness): score 62/100, CI/CD funzionante ma runner unico = VM prod, rollback manuale. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-T9.md` | prodotto/business | Pilastro T9 (verified functional correctness): score 79/100, 75/75 test live verificati direttamente, copertura diretta 75/424 endpoint. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-X1.md` | prodotto/business | Pilastro X1 (functional debt): score 60/100, BPM senza runtime come voce dominante; altri gap storici gia' chiusi nel codice. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-X2.md` | prodotto/business | Pilastro X2 (legal/IP/compliance): score 66/100, IP pulito, AI Act mitigato per design, GDPR operativo assente. | Si, stessa datazione. |
| `docs/due-diligence/workstreams/WS-X3.md` | prodotto/business | Pilastro X3 (execution risk/bus factor): score 58/100, bus factor=1 non mitigato, ma trasparenza eccezionale (il venditore si sottostima). | Si, stessa datazione. |

### `docs/integrations/`

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md` | cronaca/archivio | PLAN per #9 Agent SDK+MCP: WI-A eseguito su go esplicito, WI-B/C/D restano PROPOSED/DO-NOT-APPLY. | Si, l'agente #9 risulta oggi CHIUSO su abbonamento MAX secondo la memoria di progetto; questo piano descrive fasi ancora aperte. |
| `docs/integrations/successfactors_heuresys_reconciled_design_2026-05-30.md` | cronaca/archivio | Design esplorativo NOT-APPROVED per un connettore SuccessFactors, riconciliato con la SoT reale; non e' un workstream tracciato. | No, gia' dichiarato esplorativo e mai approvato. |
| `docs/integrations/tenant_onboarding_esco_01_coherence_report_2026-06-15.md` | cronaca/archivio | Analisi ANALYSIS read-only su ESCO multipilastro + tenant onboarding; auto-annotato S1029: l'asse professione descritto e' oggi in produzione, header originale storico. | No, il file stesso segnala la propria obsolescenza in modo corretto. |
| `docs/integrations/tenant_onboarding_esco_02_dbms_population_todo_2026-06-15.md` | cronaca/archivio | TODO list Tier 1-3 per il popolamento ESCO/onboarding; stesso auto-annotamento S1029. | No, auto-annotato correttamente. |
| `docs/integrations/tenant_onboarding_esco_03_esco_population_spec_2026-06-15.md` | cronaca/archivio | SPEC per backfill gerarchia skill + import occupation-skill; stesso auto-annotamento S1029. | No, auto-annotato correttamente. Usa pero' ancora la locuzione ritirata "tenant TEST". |
| `docs/integrations/tenant_onboarding_esco_04_tenant_onboarding_spec_2026-06-15.md` | cronaca/archivio | SPEC per legame tenant to NACE/size + OU-processi + motore generativo; stesso auto-annotamento S1029. | No, auto-annotato correttamente. Usa pero' ancora "tenant TEST" — vedi Contraddizioni terminologiche. |

### `docs/` — file radice e sottocartelle di planning originario

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `docs/A11Y_AUDIT_TIER7_2026-05-20.md` | cronaca/archivio | Audit statico a11y Tier 7 delle 18 pagine showcase (checklist 14 item), commit 534d54e. | Si, snapshot statico di uno stato di codice di piu' di tre mesi fa. |
| `docs/a11y-manual-checklist.md` | regola/dottrina | 17 item manuali a11y non coperti da axe-core, da eseguire prima di ogni release tag. | No, procedura ancora applicabile. |
| `docs/a11y-tail-items.md` | cronaca/archivio | Registro dei tail item a11y MVP-2a to MVP-3; violazioni scese a zero su desktop+mobile. | No, storia gia' chiusa correttamente. |
| `docs/BOOTSTRAP_EXECUTION_PLAN.md` | cronaca/archivio | Deliverable #1/10 del bootstrap (2026-05-16): "nessun codice scritto finche' l'utente non approva". | Si, descrive lo stato pre-MVP-0, quando il repo aveva 2 commit; oggi ha centinaia di migrazioni e moduli. |
| `docs/BRAND_V1_DEFERRED_REFINEMENTS.md` | cronaca/archivio | Catalogo di rifiniture estetiche deferite dopo brand v1+v1.1 (S925, tag v0.4.0-brand-v1). | No, dichiarato deferito per scelta esplicita dell'utente. |
| `docs/cw-b59-true-root-cause-2026-05-26.md` | cronaca/archivio | Root-cause analysis del bug CW-B59 (showcase disabilitato); banner "STORICO — RISOLTO il 2026-05-27" auto-aggiornato al 2026-07-25. | No, auto-annotato correttamente come cronaca chiusa. |
| `docs/MVP_4_ROADMAP.md` | cronaca/archivio | Roadmap MVP-4 (2026-05-26): Status "DRAFT, awaiting Enzo's review/approval before any P0 stream is opened". | Si, MVP-4 risulta chiuso da tempo (v1.0.0 GA, README lo elenca come CHIUSO) ma il file non porta alcun banner di chiusura come altri documenti analoghi dello stesso periodo. |
| `docs/preflight-residual-todo.md` | cronaca/archivio | TODO residuo post-S935; Status "CHIUSO" (S1030, 2026-07-25), gli item aperti tracciati altrove (Z-173). | No, auto-annotato correttamente come chiuso. |
| `docs/SHOWCASE_AUDIT_2026-05-20.md` | cronaca/archivio | Audit strutturale delle 18 showcase page vs il pattern canonico system-health, commit a30a55a. | Si, snapshot statico di codice di piu' di tre mesi fa. |
| `docs/db/MIGRATION_IMPLEMENTATION_PLAN.md` | cronaca/archivio | Deliverable #3/10: blueprint dei 27 (26 v5 + 1 ESS) migration originarie, contratto di idempotenza, setup PostgreSQL. | Si, descrive 27 migrazioni pianificate contro le oltre 350 applicate oggi. |
| `docs/db/TARGET_SCHEMA_DESIGN.md` | cronaca/archivio | Deliverable #2/10: proposta di schema fisico target sys, dichiarata non immutabile ma vincolante nell'architettura. | Si, stato di planning pre-costruzione, oggi lo schema reale e' cresciuto enormemente oltre la proposta originaria. |
| `docs/ci/self-hosted-runners-setup.md` | SoT-stato | Procedura di setup del runner self-hosted OCI VM; secondo runner (linux-pc-runner) ATTIVO da D-08 F5 S1023. Aggiornato 2026-05-26. | Parziale, aggiornato all'introduzione del secondo runner ma la sua data interna (2026-05-26) e' comunque vecchia rispetto a un'infrastruttura CI che ha continuato a evolvere (vedi DD su CI=PROD, poi mitigato). |
| `docs/ci/workflows-overview.md` | SoT-stato | Panoramica dei 7 workflow CI (6 nuovi S935-F + showcase preesistente) su runner self-hosted, costo/quota. | Parziale, stessa data interna 2026-05-26; il numero di workflow e' probabilmente cresciuto (CLAUDE.md cita piu' pipeline). |
| `docs/api/API_IMPLEMENTATION_PLAN.md` | cronaca/archivio | Deliverable #10/10, refreshed 2026-05-26: 58 moduli/272 endpoint (vs 23/148 originari). | Si, i conteggi (58 moduli) sono molto inferiori agli attuali (98 moduli, 604 route secondo l'atlas generato oggi). |
| `docs/api/MVP_2A_API_GAP_AUDIT.md` | cronaca/archivio | Gap audit MVP-2a v2.0 (refreshed X12, 2026-05-23): 40 route frontend vs endpoint /v1/*; v1.0 sezioni preservate per riferimento storico. | Si, snapshot di uno stato di codice ampiamente superato (272 endpoint vs 604 attuali). |
| `docs/security/AUTH_SECURITY_PLAN.md` | cronaca/archivio | Deliverable #8/10: piano fondativo di auth (11 tabelle sys.sys_auth_*, Argon2id, token model, ruoli, permessi). | Parziale, i meccanismi di base restano validi (Argon2id, JWT) ma i conteggi di ruoli/permessi sono cresciuti molto (oggi 14 ruoli/224+ permessi). |
| `docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md` | cronaca/archivio | Deliverable #9/10: piano Admin/Blueprint Console (23 pagine MVP-2a) + ESS (13 pagine MVP-2b), Next.js 15. | Si, i conteggi di pagine sono molto inferiori agli attuali (98 route page.tsx secondo l'atlas). |

### `docs/archive/` — cronaca dichiarata (non SoT)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `docs/archive/BRAND_SESSION_CHARTER.md` | cronaca/archivio | Charter di sessione brand identity v1 (2026-05-18), stato ACTIVE al momento della stesura. | No, cronaca gia' collocata correttamente in archive/. |
| `docs/archive/etl-brownfield-ritirato/README.md` | cronaca/archivio | Nota di ritiro (#170, S1055): l'attrezzatura wave-1/wave-2 scriveva nello schema brownfield, oggi inesistente. | No, gia' dichiarato ritirato. |
| `docs/archive/etl-brownfield-ritirato/SDBI_RUNBOOK.md` | cronaca/archivio | Runbook operativo SDBI pubblicato 2026-06-04, chiude ADR-0014 §5 criterio 4. | No, gia' collocato in archivio con motivazione. |
| `docs/archive/etl-brownfield-ritirato/seeds-brownfield-tree/wave1/04_column_mappings_report.md` | cronaca/archivio | Report di generazione del seed di column mapping Wave 1 (2026-05-18). | No, gia' archiviato. |
| `docs/archive/etl-brownfield-ritirato/seeds-sdbi-template-tree/README.md` | cronaca/archivio | Skeleton riusabile per una macro-area SDBI, promosso dal pilota Goals/OKR. | No, gia' archiviato. |
| `docs/archive/etl-brownfield-ritirato/seeds-sdbi-template-tree/mapping_card.template.md` | cronaca/archivio | Template di mapping card SDBI Phase 2 (ADR-0014 §3.6). | No, gia' archiviato. |
| `docs/archive/GOAL_B_REPORT_2026-05-18.md` | cronaca/archivio | Report Goal B: lineage + HANDOFF reconciliation + staging cleanup, backup gate PASSED. | No, gia' archiviato. |
| `docs/archive/HANDOFF.md` | cronaca/archivio | Handoff storico multi-sessione (fino a MVP-1/2b, 2026-05-31); banner esplicito "STORICO, non e' una SoT". | No, banner corretto in testa al file. |
| `docs/archive/HANDOFF_BRAND.md` | cronaca/archivio | Lane handoff brand identity v1: collapse a single-repo, pipeline GitHub Pages configurata, non ancora pushata. | No, gia' archiviato. |
| `docs/archive/HANDOFF_S1068.md` | cronaca/archivio | Handoff di sessione S1068 (2026-08-17); banner esplicito "NON e' una fonte di stato". | No, banner corretto. |
| `docs/archive/MANDATO_AUTOCOSCIENZA_S1063.md` | cronaca/archivio | Mandato di autocoscienza/redenzione; banner "ARCHIVIATO S1064, documento storico, NON stato". | No, banner corretto. |
| `docs/archive/MIGRATION_STATUS_2026-05-18.md` | cronaca/archivio | Diagnosi forense read-only evo to heuresys-advanced (v4 protocol), 2026-05-18. | No, gia' archiviato. |
| `docs/archive/modalita-gov-ritirata/2026-08-09-gov-analisi-sicurezza-e-remediation.md` | cronaca/archivio | Analisi di sicurezza del processo "gov" e piano di remediation, 2026-08-09. | No, in cartella dichiarata "ritirata". |
| `docs/archive/modalita-gov-ritirata/2026-08-09-gov-fase2-governo-dei-lavoratori.md` | cronaca/archivio | Fase 2 della modalita' "gov", dopo la quarta corsa presidiata. | No, gia' ritirata. |
| `docs/archive/modalita-gov-ritirata/2026-08-09-modalita-gov.md` | cronaca/archivio | Piano scritto della modalita' "gov" (loop zero-pendenze con piu' lavoratori), item #173. | No, gia' ritirata. |
| `docs/archive/modalita-gov-ritirata/2026-08-09-plancia-gov.md` | cronaca/archivio | La plancia diventa console di volo di "gov" — istruzione di Enzo trascritta. | No, gia' ritirata. |
| `docs/archive/modalita-gov-ritirata/2026-08-10-corsa-181-sequenza-prevista.md` | cronaca/archivio | Sequenza prevista per la corsa su #181, scritta prima di eseguirla. | No, gia' ritirata. |
| `docs/archive/modalita-gov-ritirata/2026-08-10-ritiro-modalita-gov.md` | cronaca/archivio | Decisione di Enzo (2026-08-10): abbandono completo della modalita' gov. | No, e' il documento di ritiro stesso. |
| `docs/archive/NEXT_GENERATION_ENTRY_POINT.md` | cronaca/archivio | Entry-point della sessione di consolidamento v1.0.0; banner "STORICO — non e' una SoT". | No, banner corretto. |
| `docs/archive/NEXT_SESSION_MVP_2A.md` | cronaca/archivio | Direttiva autoritativa per MVP-2a (2026-05-17); banner "STORICO — non e' una SoT". Ancora citata come dottrina live-data E2E dalle regole correnti. | No, banner corretto anche se il contenuto e' ancora referenziato per la dottrina. |
| `docs/archive/NEXT_SESSION_MVP_CLOSURE.md` | cronaca/archivio | Plan operativo di chiusura MVP-2a/2b (2026-05-17), 4 acceptance tail da chiudere. | No, gia' archiviato. |
| `docs/archive/scripts-exhausted/README.md` | cronaca/archivio | Registro degli script one-shot esauriti, spostati (mai cancellati) in archive (G5, S1028). | No, gia' archiviato con motivazione. |

### `docs/kb/` — SoT tecnica (livello top e file principali)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `docs/kb/SOT_STATE.md` | SoT-stato | Snapshot granulare del sistema, riscritto a ogni sessione (2270 righe): narrativa cronologica Delta S963 to S1079bis + sezioni statiche 1-10 (git/stack/API/DB/auth/web/CI/invarianti). Letta la sezione 0 per intero, gli header di tutte le ~130 sezioni Delta, e le sezioni statiche 1-10 per intero. | Si — le sezioni statiche 1-10 (in coda al file) portano dati fermi a S1007 (~2026-06-26), mentre la narrativa in testa e' aggiornata a oggi: il file si contraddice da solo. Vedi Contraddizioni. |
| `docs/kb/SOT_BACKLOG.md` | SoT-stato | Action register (item strutturati #1-#231+, corsie ACTIVE/GATED/WAIT-INPUT/HOLD/INTERRUPTED) piu' narrativa storica "Aggiornamento S###" e sezioni P0-P4. 2695 righe; letti per intero i primi ~130 (item #225/#226/#217/#211/#209) e gli header dell'intero file. | No — file vivo, aggiornato a oggi (item #225/#226 chiusi S1079). |
| `docs/kb/DEBT_REGISTER.md` | SoT-stato | Registro debiti (D-01 to D-87+), quasi tutti RISOLTI con evidenza; 217 righe dense, lette per intero le prime ~100 righe (D-01 to D-40) e la sezione finale (Sintesi scope, D-81 to D-87). | No — attivamente mantenuto, ultimo aggiornamento S1078. |
| `docs/kb/INDEX_PATHS.md` | SoT-stato | Indice generato (build_index.py) di 3202 file dominio, per categoria/status; letta la struttura, i conteggi, un campione della lista file, l'appendice esclusioni. | No, rigenerato oggi (2026-08-24). |
| `docs/kb/DATA_PATTERNS.md` | SoT-stato | Registro dei pattern di dati riusabili (P-01...), con anti-pattern, prova obbligatoria per ogni voce, sezione "restano da verificare". | No. |
| `docs/kb/COWORK_INBOX.md` | SoT-stato | Canale write-back Cowork to CLI: Cowork appende proposte, il CLI le riconcilia e marca [RICONCILIATA]. | No, meccanismo tuttora in vigore. |
| `docs/kb/NEXT_SESSION_FORENSIC_KICKOFF.md` | cronaca/archivio | Mandato forense S1022; banner "ESEGUITO — non ri-eseguirlo". | No, banner corretto. |
| `docs/kb/NEXT_SESSION_EPICS_KICKOFF.md` | cronaca/archivio | Mandato residuo epiche GO-BRANCH S1023; banner "ESEGUITO". | No, banner corretto. |
| `docs/kb/NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md` | cronaca/archivio | Mandato forense DB+dati+frontend S1024-S1028; banner "ESEGUITO", residui confluiti nel register. | No, banner corretto. |
| `docs/kb/xtras/AUTONOMY_R23_PROJECT.md` | regola/dottrina | Specifiche R23 project-level: come modificare file (Edit/Write, mai script Python via heredoc), push scoping, CI, tunnel, test verification. | No, estratta da CLAUDE.md per snellirlo (S1052), tuttora valida. |
| `docs/kb/xtras/DESIGN_SYSTEM_UI.md` | regola/dottrina | Dettaglio completo del design system npm-published post-X18: setup Tailwind/Next, workflow di modifica componenti, storia migrazione. | No. |
| `docs/kb/xtras/COWORK_ARCHIVE_NOTE.md` | regola/dottrina | Congelamento archivio Cowork (S939): cosa diventa read-only, regole post-congelamento, continuita' bias, adozione forzata SoT. | No. |
| `docs/kb/xtras/VISUALIZATION_RENDERERS_CLOSURE.md` | cronaca/archivio | Chiusura terminale del subsystem renderer (MVP-3 tappa B, S968): 9 graph_type a stato terminale, brand-gate sollevato. | No, chiusura dichiarata correttamente. |
| `docs/kb/xtras/RTL_STABILIZATION_PLAN.md` | cronaca/archivio | Piano definitivo di stabilizzazione RTL Bank (B-50 remediation); P0+P1 fatti, P2 invalidato e riaperto come B-51. | Si, descrive una fase superata dal successivo rebuild S950 e dal rubinetto chiuso su ulteriori import legacy. |
| `docs/kb/xtras/RBAC_UIX_PERSPECTIVES_PLAN.md` | cronaca/archivio | Piano di costruzione RBAC/UI-interfaces/Perspectives (S952 to S953): decisioni bloccate, stato "in execution". | Si, l'epica descritta risulta superata dalla sidebar 5-sezioni di S1009 secondo la memoria di progetto. |
| `docs/kb/xtras/SESSION_START_FORENSICS.md` | SoT-stato | Forense su perche' "avvia sessione" era lenta (>20 min), causa=round-doctrine×decode xhigh, fix applicati (2026-07-07). | No, dottrina tuttora applicata (session_start.py). |
| `docs/kb/xtras/SDBI_PHASE2_CLOSURE.md` | cronaca/archivio | Chiusura terminale SDBI Phase 2/B-10: ogni macro-area HRMS portata a stato terminale, B-10b shippato interamente (S996). | Si, l'intera pipeline SDBI e' oggi congelata dal rubinetto chiuso. |
| `docs/kb/xtras/RESUME_S1018_BATCH.md` | cronaca/archivio | Punto di ripartenza del batch S1018; banner "SEQUENZA CHIUSA — non e' piu' un punto di ripartenza" (S1029). | No, banner corretto. |
| `docs/kb/xtras/SESSION_MODES.md` | regola/dottrina | Due modalita' sessione (canonical/lab) che possono girare in parallelo sullo stesso working tree, gate opposto in verify. | No, meccanismo tuttora attivo (citato in CLAUDE.md). |
| `docs/kb/xtras/DUMP_ARCHIVAL_RUNBOOK.md` | regola/dottrina | Archiviazione off-machine dei pg_dump pre-operazione (QW-K3) verso la VM OCI; restore sempre su DB scratch. | No. |
| `docs/kb/xtras/WAVE2_UNBLOCK_PACKAGE.md` | cronaca/archivio | Discovery sorgenti per Wave-2 brownfield (S981): pool/candidati sbloccabili con decisioni PM. | Si, l'intera Wave-2 e' oggi preclusa dal rubinetto chiuso (ADR-0038). |
| `docs/kb/xtras/PLAN_S1018_BATCH.md` | cronaca/archivio | Piano del batch autonomo "livello superiore" (ultracode) nato su VM, poi versionato e ripreso in locale. | Si, superato dal RESUME_S1018_BATCH che dichiara la sequenza chiusa. |
| `docs/kb/xtras/POST_V1_ROADMAP_DOSSIER.md` | prodotto/business | Menu esaustivo di direzioni post-v1.0 (S985, 2026-06-12), 7 agenti, conteggi pinnati per superare drift SoT. | Si, snapshot dichiarato del 2026-06-12, oltre due mesi fa in un progetto ad alta cadenza. |
| `docs/kb/xtras/B50_DEFER_UNBLOCK_PACKAGE.md` | cronaca/archivio | Dossier B-50 (3 DEFER, S981): opzioni A/B/C per branches/succession pools/candidates, effort stimato 5-7h. | Si, riguarda popolamento da fonti legacy oggi precluso. |
| `docs/kb/xtras/DATA_RECONCILIATION_PLAN.md` | cronaca/archivio | Piano di riconciliazione full legacy to advanced; superseded dal ciclo di chiusura S960, poi da B-50 terminal-annotation S972. | Si, dichiarato superseded due volte all'interno del file stesso; oggi ulteriormente superato dal rubinetto chiuso. |
| `docs/kb/xtras/D4_ORG_UNIT_TEMPLATE_DESIGN.md` | cronaca/archivio | Design read-only per Wall W2 (org-unit template full-fidelity), Option C(i) scelta da Enzo; nessuna mutazione eseguita in questo doc. | Si, decisione di design la cui esecuzione dipende da fonti legacy oggi precluse. |
| `docs/kb/xtras/D6_SDBI_OPTION_B_DESIGN.md` | cronaca/archivio | Design SDBI Option-B (PerformanceReviews+Feedback360); gated su sign-off Enzo, nessuna scrittura eseguita nel doc. | Si, stessa natura SDBI oggi congelata. |
| `docs/kb/xtras/RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md` | cronaca/archivio | Dossier consolidato dei muri di riconciliazione + AI/matching, split autonomia CLI/Enzo per ogni decisione. | Si, stessa natura. |
| `docs/kb/atlas/ATLAS.md` | SoT-stato | Atlas cross-layer GENERATO (build_atlas.py) al commit c8a29d30, 2026-08-24: 98 moduli API, 604 route. Non editare a mano. | No, rigenerato ieri/oggi. |
| `docs/kb/atlas/ATLAS_CURATED.md` | SoT-stato | Sintesi semantica curata a mano del full sweep S1016 (2026-07-05, 19 agenti, 193 rilievi); dichiarata NON toccata da build_atlas.py. | Si, i conteggi (83 moduli, 468 route) sono datati 2026-07-05 e il file stesso avverte di aggiornarsi solo con un nuovo sweep — nessun nuovo sweep risulta eseguito da allora. |
| `docs/kb/db-forensics/F2_DB_CENSUS_2026-07-21.md` | SoT-stato | Census forense DB (mandato S1023, S1024, 2026-07-21): completezza funzionale per modulo, moduli vuoti, bilinguismo ESCO completato. | Si, snapshot di piu' di un mese fa in un'area (DB) molto attiva. |
| `docs/kb/db-forensics/F3_SEMANTIC_COHERENCE_2026-07-21.md` | SoT-stato | Coerenza semantica dati RTL Bank + piani di seeding + chiusura brownfield (S1024); org-chart sano, blocchi C/D eseguiti. | Si, stessa datazione. |
| `docs/kb/db-forensics/USER_ROLE_COHERENCE_2026-07-22.md` | SoT-stato | Audit coerenza per-user (ruolo to dati collegati) su standard CCNL reali; correzioni applicate in seed idempotenti. | Si, stessa area (dati RTL) molto attiva da allora. |
| `docs/kb/frontend-forensics/F4_SURFACE_CENSUS_2026-07-22.md` | SoT-stato | Forense frontend per-superficie (S1025, 2026-07-22): 104 route inventariate, italiano confermato lingua di default con test di regressione. | Si, snapshot datato in un'area (frontend) molto attiva. |
| `docs/kb/full-forensic-audit/INDEX.md` | cronaca/archivio | Indice append-only dei due audit forensi read-only (2026-07-03, 2026-07-20) con findings/scorecard. | No, indice append-only, coerente con i propri contenuti. |
| `docs/kb/full-forensic-audit/AUDIT_FORENSE_heuresys_2026-07-03_151241.md` | cronaca/archivio | Audit forense read-only multi-agente (94 agenti): 4 TRUE POSITIVE su 21 finding security-relevant, incl. credenziali admin committate (F-001). | Si, snapshot datato, ma il TRUE POSITIVE F-001 e' gia' dichiarato risolto altrove (D-08/Z-262). |
| `docs/kb/full-forensic-audit/FP_CHECK_VERIFICATION_2026-07-03_151241.md` | cronaca/archivio | Verifica formale fp-check (Trail of Bits) sui 21 finding: 4 TRUE POSITIVE, 17 FALSE POSITIVE. | No, verifica di un momento dato, coerente con l'audit gemello. |
| `docs/kb/full-forensic-audit/AUDIT_FORENSE_heuresys_2026-07-20_022239.md` | cronaca/archivio | Secondo audit forense (2026-07-20): verdetto finance-readiness CONDITIONAL-GO, fan-out multi-agente fallito su session-limit, completato nel main thread. | Si, snapshot datato di oltre un mese. |
| `docs/kb/storia36/DOSSIER_REGISTRY.md` | SoT-stato | Registro dei dossier storia36, derivato dal grafo FK (mai a mano); forma eseguibile in verify-storia36-dossier.sql. | No. |
| `docs/kb/storia36/DOMINIO_PREMIO_VARIABILE.md` | SoT-stato | Ricerca di dominio (Step 3.1, 2026-07-28) su premio variabile/compensation nel credito italiano; ogni parametro del seed C3 cita una riga qui. | No. |
| `docs/kb/storia36/DOMINIO_FORMAZIONE_OBBLIGATORIA.md` | SoT-stato | Ricerca di dominio (Step 4.2, 2026-07-28) su formazione obbligatoria/certificazioni nel credito italiano; stessa regola di citazione per il seed C4. | No. |
| `docs/kb/integrations/INTEGRATIONS.md` | SoT-stato | Strategia di integrazione di 3 tool esterni (graphify tra gli altri) nell'ecosistema Claude del PC; aggiornato S939 (2026-05-27). | Parziale, data interna vecchia (tre mesi) su un'area (tooling) che continua a evolvere. |
| `docs/kb/tools/atlas-sweep-templates/sweep_digest_s1016.md` | cronaca/archivio | Digest grezzo del full sweep S1016 (19 agenti): rilievi puntuali per-cluster su codice/RBAC/design-system, non riassunti altrove. | Si, snapshot di sweep del 2026-07-05, gia' assorbito (dov'era rilevante) in ATLAS_CURATED.md, ma qui restano dettagli non riportati altrove. |

### `.programmi/` — voci multi-sessione del register (vive)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `.programmi/README.md` | regola/dottrina | Spiega perche' esiste la cartella: le voci da 2-8 sessioni hanno un file, unica cosa da leggere per ripartire. | No. |
| `.programmi/mandati/README.md` | regola/dottrina | Distingue i "mandati di ciclo" (fuori dal radar di programmi.py) dai "programmi di voce". | No. |
| `.programmi/132-ricerca-genera-il-modello.md` | SoT-stato | #132, P1, ~8 sessioni, IN CORSO: la ricerca genera il modello del Tenant Builder, l'archetipo scritto a mano sparisce (decisione E29). | No, item attivo, coerente col register. |
| `.programmi/142-cruscotti-per-tipologia.md` | SoT-stato | #142, P1, CHIUSO: cruscotti focalizzati per tipologia di utilizzatore (mig 000271/272). | No, chiuso e coerente. |
| `.programmi/143-squadra-come-progetto.md` | SoT-stato | #143, P1, IN CORSO: una squadra e' un progetto, serve il modello non un puntatore al capo. | No. |
| `.programmi/148-rendiconto-chiusure-quattro-verbi.md` | SoT-stato | #148, CHIUSO S1080: letto il rendiconto delle chiusure, deciso di non riscriverlo in quattro verbi. | No. |
| `.programmi/149-consegne-lab-non-verificate.md` | regola/dottrina | #149, presidio continuativo: ogni consegna del lab va trattata come non verificata, analisi adversarial obbligatoria. | No, presidio attivo per costruzione (non si chiude mai). |
| `.programmi/159-ponte-gateway-pagine.md` | SoT-stato | #159, P2, IN CORSO: il ponte gateway-agente to pagine web deve valere anche per le pagine future; 83/115 idonee. | No. |
| `.programmi/169-due-segreti-dalla-stessa-chiave.md` | SoT-stato | #169, IN CORSO, sbloccata S1079: password e secondo fattore nascono dalla stessa chiave madre — rischio da chiudere. | No. |
| `.programmi/181-rilievi-controllo-drift.md` | SoT-stato | #181, CHIUSO 2026-08-19: 7 rilievi adversarial sul controllo di drift Z-112, tutti risolti in 4/4 fasi. | No. |
| `.programmi/197-marchio-materializzazione.md` | SoT-stato | #197, CHIUSO: il marchio materialized_from non copriva tutte le tabelle scritte dal motore di materializzazione. | No. |
| `.programmi/198-tenant-builder-p3-costruzione.md` | SoT-stato | #198, IN CORSO: Tenant Builder P3, costruzione tracciata, 8/9 task fatti con dimostrazione live, resta T9. | No. |
| `.programmi/205-tenant-builder-2b-2c.md` | SoT-stato | #205, NON AVVIATO: coda dei domini ricercabili del Tenant Builder (2b/2c), tutte e 4 le parti oggi progettate. | No. |
| `.programmi/211-suite-e2e-completa.md` | SoT-stato | #211, CHIUSO: triage dei rossi della suite E2E completa in sei famiglie, nessuna un guasto di prodotto; la suite resta fuori CI. | No. |
| `.programmi/214-adozione-agente-perimetri.md` | SoT-stato | #214, IN CORSO, presidio: adozione dell'agente sui perimetri in coda, ordine di rischio crescente, non si chiude mai. | No. |
| `.programmi/215-stato-impossibile-bande-e-competenze.md` | SoT-stato | #215, CHIUSO: stesso stato impossibile (tenant_id NULL + is_global false) trovato su altre due tabelle, cure opposte applicate. | No. |
| `.programmi/216-passaggio-di-consegne.md` | SoT-stato | #216, CHIUSO: passaggio di consegne fra sessioni, il menu spiega e l'avanzamento si deriva (richiesta esplicita di Enzo). | No. |
| `.programmi/217-flusso-di-chiusura.md` | SoT-stato | #217, CHIUSO S1070, 8/8 fasi: il flusso di chiusura da rito completo a percorso scelto. | No. |
| `.programmi/218-residui-legacy-senza-referente.md` | SoT-stato | #218, CHIUSO: i residui del legacy senza referente locale analizzati e risolti uno per uno. | No. |
| `.programmi/219-otto-guasti-suite-e2e.md` | SoT-stato | #219, P2, IN CORSO, 4/5 fasi: gli otto guasti dietro i rossi della suite E2E integrale, resta F5 (la corsa integrale). | No. |
| `.programmi/220-remediation-dossier-forense.md` | SoT-stato | #220, P1, CHIUSO: capofila del programma #220-#223, remediation W1 messa in sicurezza; fonte/metodo/decisioni per tutti e quattro. | No. |
| `.programmi/221-remediation-w2-recuperi.md` | SoT-stato | #221, P1, CHIUSO: remediation forense W2 recuperi (NACE_REV_2_1 derivato, crosswalk in produzione). | No. |
| `.programmi/222-remediation-w3-integrita-contenuti.md` | SoT-stato | #222, P2, CHIUSO 2026-08-21, 7/7 fasi: integrita' e contenuti dei cataloghi; F6-07 lasciato orfano (poi #227). | No, ma ha generato un residuo orfano poi riparato (#227). |
| `.programmi/223-remediation-w4-pipeline-ruoli.md` | SoT-stato | #223, P2, CHIUSO 2026-08-21, 6/6 fasi: pipeline, separazione ruoli, prestazioni. | No. |
| `.programmi/224-check-non-deterministico-fuso.md` | SoT-stato | #224, P2, CHIUSO S1078: il check custodia dava verdetto diverso a seconda del fuso orario di chi lo lanciava. | No. |
| `.programmi/225-claude-md-affermazioni-scadute.md` | SoT-stato | #225, CHIUSO S1079: due affermazioni scadute nel CLAUDE.md (I16 su resolver, numero cristallizzato nell'allowlist). | No. |
| `.programmi/226-storia-rtl-scorrevole.md` | SoT-stato | #226, CHIUSO S1079: l'avanzamento della storia RTL va schedulato, solo dove il database e' quello vero (D-STORIA-B). | No. |
| `.programmi/227-competenze-isolate-nel-grafo.md` | SoT-stato | #227, NON AVVIATO: 4.464 competenze isolate nel grafo (31,8% del catalogo), residuo orfano di F6-07 dentro #222. | No, item aperto genuino — e' anche la fonte della contraddizione con ADR-0030 (99,4% di copertura dichiarata). |
| `.programmi/228-cancello-a-tempo.md` | SoT-stato | #228, CHIUSO S1079, 6/6 fasi: il cancello a tempo — cio' che marcisce senza produrre un diff, eseguito a ogni chiusura. | No. |
| `.programmi/229-eredita-fra-sessioni.md` | SoT-stato | #229, CHIUSO S1079: rilevare cio' che e' stato interrotto e leggerlo all'avvio (session-id fermo 15 sessioni, corse uccise indistinguibili). | No. |
| `.programmi/230-verifica-quattro-attese.md` | SoT-stato | #230, CHIUSO S1080: le 4 voci WAIT-INPUT verificate una per una, tre non erano quello che dicevano. | No. |
| `.programmi/231-consumo-lavori-attivi.md` | SoT-stato | #231, IN CORSO, aperto S1080: consumare i lavori attivi, la sequenza e le voci non eseguibili in questa sessione dichiarate esplicitamente. | No. |
| `.programmi/50-knowledge-graph-legacy.md` | SoT-stato | #50, P3, IN CORSO: il grafo delle competenze legacy (kg_nodes/kg_edges, 139k) va visto come "dai una vista al grafo che gia' abbiamo" (sys_skill_taxonomy_edges), non come import. | No, coerente col rubinetto chiuso (nessun import previsto). |
| `.programmi/54-recruiting-ats.md` | SoT-stato | #54, P2, IN CORSO: modulo recruiting/ATS costruito sul DBMS attuale (I1: requisition nasce da posizione vacante), nessun import da fonte legacy. | No. |
| `.programmi/69-residui-staging-wave1.md` | SoT-stato | #69, CHIUSO: bonifica dei residui staging.wave1_* nell'advanced, ri-titolato 2026-08-14 dopo che lo spegnimento legacy e' uscito dallo scope. | No. |
| `.programmi/79-cancello-di-esposizione.md` | regola/dottrina | #79, presidio continuativo: un dato che nessuna API espone non e' nel prodotto (regola di Enzo, S1034, retroattiva). | No, presidio attivo per costruzione. |
| `.programmi/92-ciclo-valutazione.md` | SoT-stato | #92, P1, CHIUSO: ciclo di valutazione completo (autovalutazione+calibrazione), 7 passi integrali. | No. |
| `.programmi/99-domini-gerarchici-funzionali.md` | SoT-stato | #99, P1, CHIUSO: applicazione della definizione di domini gerarchici/funzionali (ADR-0036, I16-I20/I22), 10/10 fasi. | No, ma il file segnala una "trappola di numerazione" da leggere per prima. |
| `.programmi/D86-D87-i-due-cancelli-della-chiusura.md` | SoT-stato | D-86/D-87, CHIUSO S1078: due cancelli che rompevano la chiusura (deploy-watch, clone-vm-db), risolti con piano+simulazione scritti prima. | No. |
| `.programmi/Z251-contesa-database-suite.md` | SoT-stato | Z-251, CHIUSO: la suite non reggeva la contesa sul database, un file diverso cadeva a ogni giro; limiti riportati ai valori precedenti. | No, e dichiara esplicitamente i limiti di cio' che NON dimostra. |
| `.programmi/mandati/mandato-consegne-lab-2026-08-16.md` | cronaca/archivio | Mandato per eseguire 7 consegne del design-lab (2026-08-16 sera), rilievi su filtri booleani e specie di dati che convivono gia'. | No, mandato di ciclo gia' concluso. |
| `.programmi/mandati/mandato-S1067-batch-p1p2p3.md` | cronaca/archivio | Mandato S1067: eseguire il maggior numero di azioni P1/P2/P3, con rilievi su coda agente e suite E2E >15 min. | No, mandato di ciclo concluso. |
| `.programmi/mandati/mandato-S1068-p3-p1-p2.md` | cronaca/archivio | Mandato S1068: #213 investigata, #214 su positions, poi P3 to P1 to P2; rilievi su righe di collaudo lasciate in produzione. | No, mandato di ciclo concluso. |
| `.programmi/mandati/mandato-S1071-ciclo-p1.md` | cronaca/archivio | Mandato S1071 to S1072: due difetti subito poi consumo di tutto P1 e P2. | No, mandato concluso. |
| `.programmi/mandati/mandato-S1073-prompt-ripresa.md` | cronaca/archivio | Prompt di ripresa da incollare come primo messaggio della sessione S1073. | No, sostituito dal successivo (S1074). |
| `.programmi/mandati/mandato-S1074-prompt-ripresa.md` | cronaca/archivio | Prompt di ripresa sessione S1074, scritto a fine S1072; sostituisce il precedente eseguito per intero. | No, mandato di ciclo concluso. |
| `.programmi/mandati/mandato-S1077-corsa-autonoma.md` | cronaca/archivio | Mandato S1077 (2026-08-21): corsa autonoma non presidiata, Enzo delega la cronologia e i vincoli di contesto/5h. | No, mandato di ciclo concluso. |

### `ux-design/heuresys_uxix_brand_identity_bundle_v1/` — bundle di specifica design system (2026-05-17)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `ux-design/.../README.md` | regola/dottrina | Handoff operativo per il Development Team: architettura dashboard, navigazione, shell dinamica, asset, codice esempio, governance. | No, ancora citata dalle regole design-system correnti. |
| `ux-design/.../ISTRUZIONI.md` | regola/dottrina | Obiettivo del bundle, stile di comunicazione (inglese, "Development Team"). | No. |
| `ux-design/.../MANIFEST.md` | regola/dottrina | Indice dei documenti del bundle. | No. |
| `ux-design/.../assets/README.md` | regola/dottrina | Asset brand canonici promossi da heuresys-evo (2026-05-19); regole sul logo (mai alterare lo split colore). | No. |
| `ux-design/.../assets/icons/custom/README.md` | regola/dottrina | Regole per icone custom Heuresys-specifiche (currentColor, no stile misto). | No. |
| `ux-design/.../docs/00_context_and_scope.md` | regola/dottrina | Contesto di prodotto e outcome primario del sistema UI/brand. | No. |
| `ux-design/.../docs/01_dashboard_shell_architecture.md` | regola/dottrina | Architettura shell dashboard: header/sidebar/footer persistenti, scroll indipendenti. | No. |
| `ux-design/.../docs/02_dom_breadcrumb_and_rendering_model.md` | regola/dottrina | Definizione DOM e modello breadcrumb contestuale. | No. |
| `ux-design/.../docs/03_navigation_model_sidebar_tabs_routes.md` | regola/dottrina | Gerarchia di navigazione: sidebar solo moduli primari, sottopagine in tab. | No. |
| `ux-design/.../docs/04_autonomous_module_page_contract.md` | regola/dottrina | Ogni pagina progettabile autonomamente, poi collegata via routing e registry centrale. | No. |
| `ux-design/.../docs/05_dynamic_shell_context.md` | regola/dottrina | Elementi shell fissi vs dinamici, risolti da pagina/utente/tenant/permessi/ambiente. | No. |
| `ux-design/.../docs/06_header_specification.md` | regola/dottrina | Struttura obbligatoria dell'header, con riferimenti a componenti bundle/showcase/prototipo. | No. |
| `ux-design/.../docs/07_sidebar_specification.md` | regola/dottrina | Comportamento obbligatorio della sidebar. | No. |
| `ux-design/.../docs/08_footer_specification.md` | regola/dottrina | Footer persistente non-negoziabile: area sinistra fissa (copyright+link+5 social), destra contestuale. | No. |
| `ux-design/.../docs/09_design_system_and_tokens.md` | regola/dottrina | Centralizzazione di palette/temi/tipografia/spacing/radius/ombre/icone nei design token. | No. |
| `ux-design/.../docs/10_graphic_assets_and_icon_system.md` | regola/dottrina | Sistema di asset grafici governati, icone outline monocromatiche da token. | No. |
| `ux-design/.../docs/11_showcase_and_decision_workflow.md` | regola/dottrina | Il sistema showcase come ambiente di governance visiva per revisione/decisione del Product Owner. | No. |
| `ux-design/.../docs/12_page_types_to_design.md` | regola/dottrina | Tutti i tipi di pagina da progettare (non solo dashboard), stesso linguaggio visivo per tutti. | No. |
| `ux-design/.../docs/13_best_practices_for_modern_saas_ui.md` | regola/dottrina | Target di design: SaaS enterprise moderno e premium, mai rumoroso o giocattolo. | No. |
| `ux-design/.../docs/14_accessibility_responsiveness_quality.md` | regola/dottrina | Requisiti di accessibilita', responsivita', manutenibilita', tracciabilita'. | No. |
| `ux-design/.../docs/15_implementation_backlog.md` | regola/dottrina | Backlog di implementazione in fasi (Fase 1 Foundation e seguenti). | No. |
| `ux-design/.../docs/16_system_health_admin_dashboard_patterns.md` | regola/dottrina | Spec dei 14 widget della dashboard PLATFORM_ADMIN, riferimento al prototipo superuser-system-health.html. | No. |
| `ux-design/.../governance/ACCEPTANCE_CRITERIA.md` | regola/dottrina | Criteri di accettazione: architettura, decisioni non cancellate, asset register, evidenza QA. | No. |
| `ux-design/.../governance/ACCESSIBILITY_CHECKLIST.md` | regola/dottrina | Checklist a11y (label controlli icon-only, tastiera, form, breadcrumb). | No. |
| `ux-design/.../governance/INTERACTION_REGISTER_TEMPLATE.md` | regola/dottrina | Template per registrare un nuovo pattern interattivo (append-only). | No. |
| `ux-design/.../governance/QUALITY_GATES.md` | regola/dottrina | Gate di qualita' da eseguire prima dell'accettazione (codice, focus states, contrasto, reduced-motion). | No. |
| `ux-design/.../governance/VISUAL_QA_CHECKLIST.md` | regola/dottrina | Checklist QA visiva per stati shell e tipi di pagina. | No. |
| `ux-design/.../prompts/CODING_AGENT_MASTER_PROMPT.md` | regola/dottrina | Master prompt per l'agente di coding che implementa il bundle. | No. |
| `ux-design/.../prompts/DESIGN_DECISION_CAPTURE_PROMPT.md` | regola/dottrina | Prompt per catturare una decisione UX/IX nel registro. | No. |
| `ux-design/.../prompts/SHOWCASE_GENERATION_PROMPT.md` | regola/dottrina | Prompt per generare le pagine showcase con contenuto HRMS realistico, mai placeholder vuoti. | No. |
| `ux-design/.../showcase/SHOWCASE_REQUIREMENTS.md` | regola/dottrina | Requisiti dell'ambiente showcase come sede di revisione del Product Owner. | No. |
| `ux-design/.../showcase/showcase-routes.md` | regola/dottrina | Elenco delle route showcase proposte. | No. |
| `ux-design/.../templates/ADR_TEMPLATE.md` | regola/dottrina | Template ADR per decisioni UX/IX (con campo "Superseded by"). | No. |
| `ux-design/.../templates/ASSET_REGISTER_TEMPLATE.md` | regola/dottrina | Template registro asset (ID/nome/tipo/sorgente/output/stato/uso/decisione). | No. |
| `ux-design/.../templates/DECISION_REGISTER.md` | regola/dottrina | Registro decisioni UX/IX; regola di non cancellare le superate, solo marcarle. | No. |
| `ux-design/.../templates/PAGE_DESIGN_BRIEF_TEMPLATE.md` | regola/dottrina | Template di brief per la progettazione di una pagina. | No. |
| `ux-design/.../templates/PALETTE_DECISION_TEMPLATE.md` | regola/dottrina | Template di decisione palette (Accepted/Rejected/Needs Review). | No. |
| `ux-design/.../templates/SHOWCASE_REVIEW_TEMPLATE.md` | regola/dottrina | Template di revisione di una pagina showcase, con follow-up. | No. |

### `qa_artifacts/` — output di QA/audit/release

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `qa_artifacts/_census_CORRECTION.md` | cronaca/archivio | Correzione di un census DB errato (S954): pg_stat.n_live_tup e' una stima stale, mai fidarsi senza count(*) reale. | No, lezione metodologica sempre valida. |
| `qa_artifacts/data_integrity/20260531_s952/_R1_system_health_milestone_spec.md` | cronaca/archivio | Spec milestone system-health live-wire (S952): il componente era condiviso prod/showcase con dati 100% mock. | Si, il system-health e' oggi dichiarato "100% live" da SOT_STATE §6 — il gap descritto qui e' stato chiuso. |
| `qa_artifacts/data_integrity/20260531_s952/CODEBOOK.md` | cronaca/archivio | Codebook per interpretare CSV candidate di arricchimento sys.*; banner di provenienza/ADR-0023. | Si, riguarda popolamento da ricerca web/legacy oggi diversamente vincolato (ADR-0038, OUTPUT RULE). |
| `qa_artifacts/dbms_health_2026-06-22/FINAL_REPORT.md` | cronaca/archivio | Report forense DBMS health-check + live-E2E coverage (S1004): census SQL + workflow multi-agente su 73 pagine. | Si, snapshot datato di oltre due mesi in un DB molto attivo. |
| `qa_artifacts/F0_reconciliation_triage.md` | cronaca/archivio | Triage A/B/C/D verificato di 65 tabelle sys.* vuote (S960), sign-off gate prima di F1. | Si, l'intero ciclo di riconciliazione da fonte legacy che governa e' oggi superato dal rubinetto chiuso. |
| `qa_artifacts/F3_bridge_discovery.md` | cronaca/archivio | Discovery del muro job to position: overlap reale per fonte legacy, succession_pools DEAD_END. | Si, stesso motivo (rubinetto chiuso). |
| `qa_artifacts/F3b_walls_discovery.md` | cronaca/archivio | Discovery del muro template to instance per org_unit_kpis: bridge codice trovato solo all'1-4%. | Si, stesso motivo. |
| `qa_artifacts/inbox-orphan-cleanup-20260707.md` | cronaca/archivio | Cleanup di 4 notifiche inbox orfane (2026-07-07), scoperto durante la forense session-start. | No, intervento puntuale gia' chiuso e verificato. |
| `qa_artifacts/mvp3_full_release_notes_v0.3.2.md` | cronaca/archivio | Release notes tag v0.3.2-mvp3-full (2026-05-25): MVP-3 full, 7/7 Tappe. | No, cronaca di rilascio gia' storicizzata. |
| `qa_artifacts/runs/20260531_s952_A/_FINDINGS_REPORT.md` | cronaca/archivio | Report forense live E2E QA (S952, 2026-05-31): 24 pagine, contrasto/tema, network capture. | Si, snapshot datato di uno stato UI molto anteriore. |
| `qa_artifacts/s936_outcome_summary.md` | cronaca/archivio | Outcome dei 3 follow-up post-S935 (2026-05-26). | No, cronaca gia' storicizzata. |
| `qa_artifacts/s936_pathG_test_outcome.md` | cronaca/archivio | Esito PARTIAL del test Path G per CW-B59 (2026-05-26). | No, cronaca gia' storicizzata (il bug e' poi RISOLTO altrove). |
| `qa_artifacts/v1.0.0_release_notes.md` | cronaca/archivio | Release notes v1.0.0 GA baseline: baseline forense-verificata, punto di partenza per lo sviluppo futuro. | No, cronaca di rilascio. |
| `qa_artifacts/x13_e2e_coverage_matrix.md` | cronaca/archivio | Matrice di copertura E2E MVP-2a Batch X13 Block A (2026-05-23), 17 file spec. | Si, snapshot di una suite E2E molto piu' piccola dell'attuale (oggi ~99 spec secondo SOT_STATE). |
| `qa_artifacts/x17_release_notes_v0.2.1.md` | cronaca/archivio | Release notes v0.2.1-mvp2a-final: 124/125 Playwright pass, backend gate sys_users=433. | No, cronaca di rilascio. |
| `qa_artifacts/x18_mvp3_release_notes_v0.3.1.md` | cronaca/archivio | Release notes v0.3.1-mvp3-final: MVP-3 6/6 shipped, 5 batch C18.x. | No, cronaca di rilascio. |
| `qa_artifacts/storia36/custodia-2026-07-27.md` | cronaca/archivio | Report auto-generato da db/scripts/storia36.sh custodia: verify-storia36.sql ROSSO alla prima corsa (triage a tre esiti). Formato identico su tutti i report della serie (10 file, uno per data). Letto per intero questo e il piu' recente (2026-08-21); gli altri 8 campionati sull'header, formato confermato identico. | No, e' l'esito verificato di quella data specifica. |
| `qa_artifacts/storia36/custodia-2026-07-28.md` | cronaca/archivio | Report auto-generato custodia storia36, 2026-07-28. | No. |
| `qa_artifacts/storia36/custodia-2026-07-29.md` | cronaca/archivio | Report auto-generato custodia storia36, 2026-07-29. | No. |
| `qa_artifacts/storia36/custodia-2026-07-31.md` | cronaca/archivio | Report auto-generato custodia storia36, 2026-07-31. | No. |
| `qa_artifacts/storia36/custodia-2026-08-06.md` | cronaca/archivio | Report auto-generato custodia storia36, 2026-08-06. | No. |
| `qa_artifacts/storia36/custodia-2026-08-07.md` | cronaca/archivio | Report auto-generato custodia storia36, 2026-08-07. | No. |
| `qa_artifacts/storia36/custodia-2026-08-08.md` | cronaca/archivio | Report auto-generato custodia storia36, 2026-08-08. | No. |
| `qa_artifacts/storia36/custodia-2026-08-10.md` | cronaca/archivio | Report auto-generato custodia storia36, 2026-08-10. | No. |
| `qa_artifacts/storia36/custodia-2026-08-15.md` | cronaca/archivio | Report auto-generato custodia storia36, 2026-08-15. | No. |
| `qa_artifacts/storia36/custodia-2026-08-21.md` | cronaca/archivio | Report auto-generato custodia storia36, 2026-08-21: entrambe le batterie VERDI, letto per intero (testa e coda). | No, e' il piu' recente della serie. |

### `sessioni/` — deliverable Cowork per sessione (era pre-CLI, 2026-05-26)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `sessioni/session_2026-05-26_forensic-state-of-the-art/FORENSIC_STATE_OF_ART_2026-05-26.md` | cronaca/archivio | Audit forense comprehensive multi-track (Cowork), HEAD 456c36b, ~300 file ispezionati. | Si, snapshot datato di tre mesi in un progetto ad alta cadenza. |
| `sessioni/session_2026-05-26_forensic-state-of-the-art/preflight_baselines/F0_BASELINE_SUMMARY.md` | cronaca/archivio | Cattura baseline Fase 0 (2026-05-26 03:14-03:20), HEAD pre-flight 08a0d11. | No, cronaca di sessione gia' chiusa. |
| `sessioni/session_2026-05-26_forensic-state-of-the-art/PREFLIGHT_PLAN_2026-05-26.md` | cronaca/archivio | Piano pre-flight per risolvere debiti tecnici prima di P0, tag target v0.3.3-preflight-clean. | No, cronaca di sessione gia' chiusa. |
| `sessioni/session_2026-05-26_preflight/NEXT_SESSION_START.md` | cronaca/archivio | Prompt letterali per iniziare la prossima sessione Cowork, post S933 CLOSED, tag v0.3.3-preflight-partial. | No, cronaca di sessione gia' chiusa. |
| `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md` | cronaca/archivio | Report pre-flight S933: 4 fasi shippate + 1 parziale + 4 deferite, prossima sessione 3 P0 immediati. | No, cronaca di sessione gia' chiusa. |
| `sessioni/session_2026-05-26_s935/S935_SESSION_REPORT.md` | cronaca/archivio | Report sessione S935: sequenza autonoma B to C to E to F to D, tag v0.3.4-p0-closed + v0.4.0-mvp4-ready. | No, cronaca di sessione gia' chiusa. |
| `sessioni/session_2026-05-26_s937_housekeeping/HANDOVER_CLI.md` | cronaca/archivio | Handover completo Cowork to CLI post S937: stato forense per operare senza re-discovery. | No, cronaca del passaggio di consegne, gia' avvenuto (S939). |
| `sessioni/session_2026-05-26_s937_housekeeping/NEXT_SESSION_START.md` | cronaca/archivio | Priming per la sessione successiva a S937, ultimo tag v0.4.0-mvp4-ready. | No, cronaca di sessione gia' chiusa. |
| `sessioni/session_2026-05-26_s937_housekeeping/S937_SESSION_REPORT.md` | cronaca/archivio | Report S937: housekeeping closure PARTIAL, eccezione R23/iii SSH documentata, tag v0.4.0a-s937-partial-checkpoint. | No, cronaca di sessione gia' chiusa. |

### `.storia36/` — stato vivo del programma "36 mesi di storia RTL"

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `.storia36/PROGRESS.md` | SoT-stato | Stato di esecuzione del programma storia36: decisioni vincolanti (D-STORIA-B), diario cronologico per cluster C0-C5, ultimo aggiornamento coerente con SOT_STATE. | No, aggiornato in linea con le sessioni piu' recenti. |
| `.storia36/analysis/c2-macchina-stati.md` | SoT-stato | Macchina a stati del ciclo performance, derivata dal codice (2026-07-28). | No. |
| `.storia36/analysis/c2-misura.md` | SoT-stato | Misura dello stato esistente del ciclo performance su RTL Bank (2026-07-28), read-only. | No. |
| `.storia36/analysis/c3-misura.md` | SoT-stato | Misura inline del cluster C3 (premio variabile), 2026-07-28. | No. |
| `.storia36/analysis/c4-codice.md` | SoT-stato | Analisi del codice del cluster C4 (learning/training/certifications), 2026-07-28. | No. |
| `.storia36/analysis/c4-misura.md` | SoT-stato | Misura del cluster C4 formazione, 2026-07-28, read-only su RTL Bank. | No. |
| `.storia36/analysis/conventions.md` | regola/dottrina | Convenzioni del repo per i deliverable C0 (Task D), 2026-07-27. | No. |
| `.storia36/analysis/date-columns.md` | SoT-stato | Inventario e classificazione di 513 colonne date/timestamptz dello schema sys, 2026-07-27. | No. |
| `.storia36/analysis/shapes-g2-g4.md` | SoT-stato | Shape esatte e range dati per i check G2-G4 (eventi pre-hire, parita' buste/presenze, sequenzialita'), 2026-07-27. | No. |

### `.zp/`, `.apify/`, `deploy/`, `audit/` (root)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `.zp/PROGRESS.md` | SoT-stato | Stato del piano zero-pendenze: 46 chiusi su 262, 186 pezzi autonomi restanti, 30 in attesa di Enzo, spesa 9 giri/68.96$ su tetto 120. | Parziale, i conteggi sono un numero variabile non ridatato in questo file — verificare la freschezza al momento della lettura. |
| `.zp/prove/Z-259-contesto.md` | cronaca/archivio | Dossier di contesto per il cluster Z-259, fatti misurati sul DB reale il 2026-07-26, con comando per ricontrollarli. | Si, snapshot dichiarato datato oltre un mese fa. |
| `.zp/zp_triage.md` | SoT-stato | Triage dei cluster zero-pendenze (generato 2026-08-09): 219 aperti, censimento dichiarato "invecchiato ma utile". | Si, il file stesso si auto-dichiara invecchiato (15 giorni al momento della sua stesura, oggi molti di piu'). |
| `.apify/README.md` | regola/dottrina | Convenzione (2026-06-03): ogni run di Apify Actor va persistito qui, mai lasciato nei dataset cloud non nominati. | No. |
| `.apify/2026-06-03/apify~rag-web-browser__wieGG5J6bXUKBZVas.content.md` | esterno-Codex | Copia cache della documentazione pubblica Apify (docs.apify.com/platform), scaricata via Actor rag-web-browser. Documentazione di terzi, non di progetto. | No, contenuto esterno, non soggetto a staleness del progetto. |
| `.apify/2026-06-03/apify~website-content-crawler__pTppzPirSPxhYT301.content.md` | esterno-Codex | Copia cache di un corso Apify Academy (web scraping basics), scaricata via Actor website-content-crawler. Documentazione di terzi. | No, contenuto esterno. |
| `deploy/README.md` | regola/dottrina | Deploy/bootstrap idempotenti per ruolo host, gestione secrets, Node 22 via nvm/fnm, filtro workspace cross-shell. | No. |
| `deploy/postgres/README.md` | SoT-stato | Configurazione server PostgreSQL di produzione (parametri, identita' di connessione), colmata il 2026-08-20 perche' prima non stava scritta da nessuna parte. | No, aggiornato recentemente. |
| `deploy/systemd/solo-linux-pc/README.md` | SoT-stato | Unit systemd che girano solo su linux-pc (mai per deploy automatico), backup-pull.timer verificato attivo il 2026-08-20. | No. |

### `deploy/reports/claude-align/` — report di drift auto-generati (21 file, stesso formato)

Ognuno confronta checksum sha256 del payload Claude fra macchine (Windows staging vs VM/linux-pc); nessuna prosa, solo tabelle di OK/DRIFT per file. Digesto unico valido per tutti i 21, letto un file rappresentativo per intero (`drift-linuxpc-20260820T235512Z.md`).

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `deploy/reports/claude-align/drift-linuxpc-20260820T235512Z.md` | cronaca/archivio | Report drift auto-generato (checksum ecosistema Claude) per linux-pc, 2026-08-20T23:55:12Z. | No, e' l'esito di quel momento. |
| `deploy/reports/claude-align/drift-linuxpc-20260821T002708Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-21T00:27:08Z. | No. |
| `deploy/reports/claude-align/drift-linuxpc-20260821T233218Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-21T23:32:18Z. | No. |
| `deploy/reports/claude-align/drift-linuxpc-20260824T000605Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-24T00:06:05Z. | No. |
| `deploy/reports/claude-align/drift-linuxpc-20260824T005516Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-24T00:55:16Z. | No. |
| `deploy/reports/claude-align/drift-linuxpc-20260824T154057Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-24T15:40:57Z. | No. |
| `deploy/reports/claude-align/drift-linuxpc-20260824T170512Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-24T17:05:12Z. | No. |
| `deploy/reports/claude-align/drift-linuxpc-20260824T172838Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-24T17:28:38Z. | No. |
| `deploy/reports/claude-align/drift-linuxpc-20260824T174003Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-24T17:40:03Z. | No. |
| `deploy/reports/claude-align/drift-linuxpc-20260824T180054Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-24T18:00:54Z. | No. |
| `deploy/reports/claude-align/drift-linuxpc-20260824T204811Z.md` | cronaca/archivio | Report drift auto-generato per linux-pc, 2026-08-24T20:48:11Z. | No, e' il piu' recente della serie linux-pc. |
| `deploy/reports/claude-align/drift-vm-20260821T002708Z.md` | cronaca/archivio | Report drift auto-generato (checksum ecosistema Claude) per la VM OCI, 2026-08-21T00:27:08Z. | No. |
| `deploy/reports/claude-align/drift-vm-20260821T233218Z.md` | cronaca/archivio | Report drift auto-generato per la VM, 2026-08-21T23:32:18Z. | No. |
| `deploy/reports/claude-align/drift-vm-20260824T000605Z.md` | cronaca/archivio | Report drift auto-generato per la VM, 2026-08-24T00:06:05Z. | No. |
| `deploy/reports/claude-align/drift-vm-20260824T005516Z.md` | cronaca/archivio | Report drift auto-generato per la VM, 2026-08-24T00:55:16Z. | No. |
| `deploy/reports/claude-align/drift-vm-20260824T154057Z.md` | cronaca/archivio | Report drift auto-generato per la VM, 2026-08-24T15:40:57Z. | No. |
| `deploy/reports/claude-align/drift-vm-20260824T170512Z.md` | cronaca/archivio | Report drift auto-generato per la VM, 2026-08-24T17:05:12Z. | No. |
| `deploy/reports/claude-align/drift-vm-20260824T172838Z.md` | cronaca/archivio | Report drift auto-generato per la VM, 2026-08-24T17:28:38Z. | No. |
| `deploy/reports/claude-align/drift-vm-20260824T174003Z.md` | cronaca/archivio | Report drift auto-generato per la VM, 2026-08-24T17:40:03Z. | No. |
| `deploy/reports/claude-align/drift-vm-20260824T180054Z.md` | cronaca/archivio | Report drift auto-generato per la VM, 2026-08-24T18:00:54Z. | No. |
| `deploy/reports/claude-align/drift-vm-20260824T204811Z.md` | cronaca/archivio | Report drift auto-generato per la VM, 2026-08-24T20:48:11Z. | No, e' il piu' recente della serie VM. |

### `audit/` (radice, esclusi `audit/pages/` — vedi Directory non lette per volume)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `audit/BLOCKED-LOG.md` | cronaca/archivio | Log di login bloccati durante un audit E2E (admin, 2026-06-23), auto-generato. | No, log puntuale gia' storicizzato. |
| `audit/FINDINGS.md` | cronaca/archivio | Raccolta problemi QA forense E2E S1006 su PROD live, metodo audit-first, MFA disattivato per l'audit (da riattivare a fine lavori). | Si, snapshot di uno stato PROD di due mesi fa; la nota "MFA da riattivare" e' scaduta di contesto se non verificata contro lo stato attuale del flag. |
| `audit/FORENSIC-NOTES-S1006-cli.md` | cronaca/archivio | Note forensi S1006: tail status dei fix (G-01/G-02/skill clean), 2 problemi LIB-BLOCKED su @heuresys/ui, MFA resta disabilitato per decisione Enzo. | Si, stesso motivo: stato PROD/MFA di due mesi fa, non riverificato in questa sessione. |

### `.codex/` — governance di Codex (non tracciato)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `.codex/AGENTS.md` | esterno-Codex | Istruzioni esclusive per Codex: ruolo permanente di Revisore Capo, sola lettura, divieti su modifiche al repository e ai sistemi collegati. | No — non e' materiale mio da valutare per staleness (CLAUDE.md dichiara .codex/ "non e' mio da mantenere"). |

## Esclusioni — elenco integrale (mai aggregato)

Tutte le esclusioni sono meccaniche (generate, dipendenze di terzi, o segreti mai letti per policy di sicurezza). Nessun documento "editoriale" scritto da Enzo o da una sessione precedente e' stato escluso.

| Directory/file | Ragione |
|---|---|
| `node_modules/` (repo-wide) | Dipendenze npm di terze parti. Conteggio reale: 2627 file .md al suo interno. Meccanico esplicito dell'incarico. |
| `dist/` (repo-wide) | Build output compilato/bundle. Conteggio reale: 428 file .md al suo interno (spesso copie di LICENSE/README di dipendenze bundlate). Meccanico esplicito. |
| `build/` (repo-wide) | Directory di build. Conteggio reale: 2 file .md. Meccanico esplicito. |
| `.next/` (repo-wide) | Cache/build Next.js. Conteggio reale: 0 file .md trovati in questo repo al momento del censimento. Meccanico esplicito, dichiarato comunque. |
| `coverage/` (repo-wide) | Output di copertura test. Conteggio reale: 0 file .md trovati. Meccanico esplicito, dichiarato comunque. |
| `playwright-report/` (repo-wide) | Report Playwright generato. Conteggio reale: 0 file .md trovati. Meccanico esplicito, dichiarato comunque. |
| `.turbo/` (repo-wide) | Cache Turborepo. Conteggio reale: 0 file .md trovati. Meccanico esplicito, dichiarato comunque. |
| `.git/` | Interno di git. Conteggio reale: 0 file .md trovati (i messaggi di commit non sono .md). Meccanico esplicito, dichiarato comunque. |
| `*.tsbuildinfo` (repo-wide) | Non e' documentazione (JSON di build incrementale TypeScript) ma menzionato nell'incarico come categoria meccanica: 4 file trovati. |
| `graphify-out/` | Directory GENERATA dal tool `graphify` (grafo di conoscenza da codice+doc), esplicitamente gitignored (`.gitignore:187`). Un file .md per ogni nodo/entita' del grafo: 10049 file secondo l'enumerazione. Non e' nell'elenco meccanico esplicito dell'incarico, ma soddisfa lo stesso criterio (generata, mai editoriale) — dichiarata come deviazione esplicita. |
| `graphify-db-input/` | Directory GENERATA, input dati per lo stesso tool graphify, gitignored (`.git/info/exclude:7`). 11 file .md. Stessa motivazione di deviazione dichiarata di `graphify-out/`. |
| `docs/source_bundle/brownfield/extracted/` | Dump generato dall'ispezione del legacy, gitignored (`.gitignore:37`), esplicitamente citato in CLAUDE.md sotto "What NOT to touch". 21 file .md. |
| `apps/showcase/out/` | Build statico Next.js dello showcase, gitignored (`apps/showcase/.gitignore:4`). 0 file .md trovati al suo interno (contiene .txt/.html di build), dichiarata comunque per completezza. |
| `.cache/` | Cache locale con runtime Node 22 portable + npm/corepack vendorizzati (dipendenza di terze parti), gitignored (`.gitignore:83`). 165 file .md al suo interno (163 dei quali gia' esclusi meccanicamente perche' annidati in un `node_modules/` interno alla cache; le 2 restanti — CHANGELOG.md e README.md del runtime Node — sono anch'esse dipendenza di terzi). |
| `pg_dump_snapshots/` | Snapshot pg_dump pre-operazione, gitignored (`.gitignore:159`). Non contiene file .md (28 file .txt di provenienza, esclusi dal perimetro di tipo file di questo censimento perche' non sono testi documentali in prosa ma metadati di dump). |
| `.secrets/*` | Directory di segreti reali (`accessi.csv`, `dev-access-master.key`, `gov-worker.pass`, `jwt_private.pem`, `jwt_public.pem`, `test_admin_password.txt`, `rollback-000275-fattori-residui-20260806.sql`). Nessun file al suo interno letto, per policy di sicurezza (mai leggere/riportare credenziali). |
| `.zp/zp-panel-chiave.txt` | Presumibile chiave d'accesso a un pannello di servizio (nome esplicito "chiave"). Non letto per policy di sicurezza. |

## Directory non lette per volume

Queste directory NON sono state escluse: sono dichiarate esplicitamente non lette in questa passata per il loro volume, cosi' come previsto dall'incarico ("verra' rilanciata su di essa una seconda passata"). Ogni file della tabella d'inventario completa (Fase A, sopra) resta comunque censito con path/dimensione/data/titolo — solo il digesto di ruolo/contenuto non e' stato prodotto.

| Directory | N. file `.md` | Comando di conteggio | Natura (perche' e' voluminosa e cosa contiene) |
|---|---:|---|---|
| `docs/superpowers/` | 82 | `find docs/superpowers -name "*.md" \| wc -l` | Piani/analisi/prompt/spec di progetto autorati a mano (non generati), datati 2026-05 to 2026-08; e' materiale SoT-adiacente ma numeroso quanto le altre cartelle kb gia' censite per intero. |
| `docs/wargames/` | 27 | `find docs/wargames -name "*.md" \| wc -l` | Esercizio di revisione adversarial (reviews/tasks), LEDGER + note per singolo round. |
| `docs/github/` | 34 | `find docs/github -name "*.md" \| wc -l` | Corso personale di riferimento su GitHub (fondamenti/collaborazione/automazione/publishing/security/tooling), non descrive il prodotto heuresys-advanced. |
| `docs/kb/improvement/` | 39 | `find docs/kb/improvement -name "*.md" \| wc -l` | Programma "RELEASE 100X": audit forense A1-A11 + 14 dossier decisionali (D-01...D-14), materiale storico del ciclo di miglioramento pre-DD. |
| `docs/source_bundle/` (esclusa `brownfield/extracted/`, gia' meccanica) | 74 | `find docs/source_bundle -name "*.md" \| grep -v '/brownfield/extracted/' \| wc -l` | Bootstrap pack v5 originario (extracted_bootstrap/): spec di dominio/schema/blueprint pre-costruzione, materiale fondativo ma di grande volume. |
| `audit/pages/` | 213 | `find audit/pages -name "*.md" \| wc -l` | Snapshot per-pagina di un audit QA (coppie `admin-BUGS.md`/`core6-TODO.md` per ciascuna delle ~106 pagine ispezionate), formato fortemente ripetitivo, generato da uno strumento di audit visivo. |
| `cowork_code_exchange/` | 172 | `find cowork_code_exchange -name "*.md" \| wc -l` | Archivio del protocollo Cowork↔CLI (cicli PROMPT/PLAN/EXEC/REPORT/REVIEW), dichiarato "archivio read-only" da CLAUDE.md, congelato dal 2026-05-27 (S939). |
| `cowork_reserved/` | 100 | `find cowork_reserved -name "*.md" \| wc -l` | KB storica di Cowork (bias_registry, batch_c1-c12, forense F0-F12), dichiarata "archivio read-only" da CLAUDE.md, stesso congelamento S939. |
| `.codex-review/` | 68 | `find .codex-review -name "*.md" \| wc -l` | Superficie di governo di Codex (canale di audit read-only separato); CLAUDE.md dichiara esplicitamente che non e' materiale mio da mantenere. |
| `.agents/` | 24 | `find .agents -name "*.md" \| wc -l` | Copia delle skill di Codex (gemello in-repo di `~/.agents/skills/`); CLAUDE.md dichiara esplicitamente che non e' materiale mio da mantenere. |
| `.superpowers/` | 23 | `find .superpowers -name "*.md" \| wc -l` | Artefatti di un esercizio "spec-driven-development" (task brief/report + diff di review), sessione dedicata separata dal resto del repo. |

## Contraddizioni e sospetti

Ogni voce riporta entrambe le citazioni (o entrambe le date/misure) senza decidere chi ha ragione, come richiesto.

### 1. `AGENTS.md` (radice) vs `CLAUDE.md` (radice) — dottrina del brownfield

`AGENTS.md` (non tracciato in git, mtime non verificabile con precisione ma contenuto non aggiornato da tempo) riporta ancora, come invariante I12:
> "I12 Brownfield/legacy = authoritative DATA SOURCE (not mere enrichment). The legacy heuresys-evo Docker DB ... is the canonical source that populates sys.*; v5 sys.* remains the structural authority and the legacy adapts to it via brownfield.column_mappings."

`CLAUDE.md` (aggiornato 2026-08-24/25) riporta invece, come stessa invariante I12:
> "I12 — ⛔ IL RUBINETTO È CHIUSO (Enzo, 2026-08-14 — supera la formulazione precedente). «Nessun dato riferito al brownfield deve essere rimesso in circolo. Tutto va ricostruito con il DBMS attuale.» Non si importa più nulla dal legacy."

I due file governano lo stesso repository con la stessa numerazione di invariante (I12) e dicono l'opposto sulla liceita' di importare dal legacy.

### 2. `AGENTS.md` vs `.claude/rules/security-auth.md` — esistenza di `admin@heuresys.com`

`AGENTS.md`, sezione Security model, elenca fra le persona di test:
> "admin@heuresys.com (PLATFORM_ADMIN)"

`.claude/rules/security-auth.md` afferma invece:
> "admin@heuresys.com NON esiste più — rimosso dalla migrazione 000295, verificato S1052 ... Era ancora citato qui e in .claude/rules/tests.md, e ha già fatto fallire la custodia della storia RTL per giorni (#153)."

Lo stesso indirizzo e-mail e' dato per esistente in un file e per rimosso (con numero di migrazione e sessione di verifica) nell'altro.

### 3. `docs/architecture/adr/0026_single_production_environment_two_tenants.md` vs `CLAUDE.md` (OUTPUT RULE, S1011) — descrivere il dato come "no-PII"

`docs/architecture/adr/0026_...md` §1 afferma:
> "The data is synthetic case-study data (legacy heuresys-evo + synthetic seeds), so there is never a real-client PII concern (ADR-0023, no-PII global)."

`CLAUDE.md`, sezione OUTPUT RULE, afferma (regola vincolante, S1011, Enzo):
> "the 'no-PII / synthetic / ADR-0023 / safe-to-publish' qualifier is RETIRED as a descriptor. Never append it as reassurance in messages, commits, docs, ADRs or questions; describe a datum for what it IS ... never for what it 'isn't'."

L'ADR-0026 resta "ACCEPTED" (non superseded) e non e' stato riscritto dopo S1011; usa esattamente la locuzione che la regola successiva vieta esplicitamente anche nei documenti/ADR. Stessa locuzione ("tenant TEST" / "no-PII") compare anche in `docs/integrations/tenant_onboarding_esco_03_...md` e `_04_...md`, entrambi con auto-annotazione S1029 che pero' non tocca questo punto terminologico.

### 4. `docs/architecture/adr/0030_esco_skill_group_ontology.md` vs `.handoff/STATE.md` — copertura ontologica delle competenze

`docs/architecture/adr/0030_...md` (2026-07-21), sezione Consequences:
> "Copertura ontologica 99,4%: 13.952/14.041 skill collegate (gruppo o edge); 89 scollegate reali = competenze custom COMP:: senza URI ESCO ... + 70 URI non nel dump v1.2.0."

`.handoff/STATE.md` (2026-08-24, S1079), Top priorities:
> "1. #227 — le 4.464 competenze isolate nel grafo, il 31,8% del catalogo. Era il residuo F6-07 di #222 ..."

Un documento dichiara il 99,4% del catalogo collegato all'ontologia (89 isolate), l'altro (piu' recente) dichiara 4.464 competenze isolate, pari al 31,8% del catalogo. Nessuno dei due file spiega esplicitamente il salto fra le due misure.

### 5. `docs/product/WORKITEM_GAP1_PHASE0_VERIFICATION.md` vs `docs/product/DEVELOPMENT_LINES_F_PRESCRIPTIVE_INTELLIGENCE.md` / `docs/architecture/adr/0031` — stato di MLCE/Maturity

`docs/product/WORKITEM_GAP1_PHASE0_VERIFICATION.md` (2026-06-19, S997), tabella §1 riga 5:
> "capability_score / composition (MLCE) | ❌ ASSENTE | Zero match capability_score/composite_score/composition/mlce in migrations+modules+shared ... absence-check live: 0 tabelle → MLCE da costruire da zero"

`docs/product/DEVELOPMENT_LINES_F_PRESCRIPTIVE_INTELLIGENCE.md` (2026-07-05, S1016), riga di apertura:
> "Il fatto nuovo: il Ledger (2026-06-19) dichiarava VRIO/OHI/Essential-Ranker «bloccati da MLCE assente» — ma MLCE e Maturity engine esistono dal Gap#1 (S999): capability-composition (317 score live) + capability-maturity (L0-L5, 20 OU) + Porte UI /org-director e /process-owner."

I due documenti dello stesso dominio prodotto (`docs/product/`) sono cronologicamente coerenti (il secondo e' successivo e aggiorna il primo), ma nessuno dei due file WORKITEM_GAP1_* (design-spec, phase0-verification, perspectives-and-scorecard) e' stato aggiornato con un banner di chiusura: restano marcati "Stato: PROPOSTA" mentre secondo altri documenti lo stesso Gap#1 risulta chiuso end-to-end.

### 6. Competitor diretto dichiarato nel dominio prodotto vs contesto operativo di questo censimento

`docs/product/COMPETITIVE_SCORECARD.md` §4:
> "In quel segmento i tre asset reali convergono ... e il competitor diretto e' essenzialmente uno (365Talents, EU, ESCO-aligned), non 27."

Il CONTESTO fornito per l'esecuzione di questo censimento dichiara invece:
> "Segmento e competitor scelti: Personio (diretto), Eightfold AI (metro), Zucchetti (coesistente)."

Il documento di prodotto (S997, 2026-06-17) e il contesto operativo di questa sessione (2026-08-25) nominano competitor diretti diversi (365Talents vs Personio) per lo stesso segmento (mid-market EU regolato). Non e' stato verificato se una decisione successiva a `docs/product/` abbia cambiato la scelta, ne' se sia rintracciabile nel register.

### 7. `db/seeds/rtl-rebuild/README.md` vs `db/seeds/rtl-rebuild/RETIRED.md` — stato dei seed di rebuild RTL

`db/seeds/rtl-rebuild/README.md` (2026-05-30), riga 3:
> "Status: DRAFT authored 2026-05-30. NOT executed. These files perform the RTL tenant rebuild ... Execution is a separate, gated, dedicated session."

`db/seeds/rtl-rebuild/RETIRED.md`, stessa cartella (2026-08-07, S1049):
> "# db/seeds/rtl-rebuild/ — RITIRATO (2026-08-07, S1049). Questi seed non sono più eseguibili, ed è voluto ... la migrazione 000283 ha rimosso le 12 tabelle staging.rtl_* vuote. I seed che le leggono non trovano più le relazioni e falliscono."

Il README della cartella non e' mai stato aggiornato con un banner di ritiro (resta "DRAFT / NOT executed", che e' gia' esso stesso stato superato dal rebuild S950 di cui parla il file gemello), mentre il file RETIRED.md nella stessa directory dichiara i seed ritirati e non piu' eseguibili.

### 8. `docs/brownfield/ENGINE_STATUS.md` vs `docs/architecture/adr/0038_the_database_is_self_sufficient.md` / invariante I12 — riabilitazione dell'ingestione

`docs/brownfield/ENGINE_STATUS.md` (S1023, non ridatato con precisione dopo), sezione "Re-enabling for a new import wave":
> "1. On the VM: set BROWNFIELD_ENGINE_ENABLED=true in the repo .env. 2. sudo systemctl restart heuresys-advanced-api ... 3. Run the wave; then set the flag back to false and restart."

`docs/architecture/adr/0038_...md` (2026-08-14) e l'invariante I12 corrente di `CLAUDE.md`:
> "Non si importa più nulla dal legacy. Ciò che manca si costruisce o si deriva dai dati che sys.* già contiene ... un piano che prevede un import è un piano da riscrivere, non da eseguire."

Il primo documento descrive un percorso operativo esplicito per riabilitare l'ingestione dal legacy per una nuova wave; il secondo (piu' recente) vieta in modo categorico e generale qualunque nuovo import dal legacy, senza eccezioni dichiarate per il meccanismo del flag `BROWNFIELD_ENGINE_ENABLED`.

### 9. `docs/kb/SOT_STATE.md` — contraddizione interna fra la narrativa in testa e le sezioni statiche in coda

La sezione "0. Snapshot in una riga" e il log cronologico "Delta S###" (in testa al file, aggiornati a oggi 2026-08-24/25) descrivono lo stato corrente incl.:
> "RBAC 14 ruoli/224 perm/980 map (misurati 2026-08-19) ... 231 tabelle sys.*"

La sezione statica "9. Invarianti non negoziabili" (fine del file, dati fermi a S1007 secondo l'annotazione interna) riporta invece testualmente:
> "I3/I4 schema sys.sys_<plural> (aux: staging/brownfield/audit) ... I12 brownfield/legacy = authoritative no-PII data source (ADR-0023; sys.* = structural authority, no-PII global)"

Lo stesso file elenca lo schema ausiliario `brownfield` come tuttora esistente (superato: ritirato da mig 000297, sezione 4 dello stesso file lo conferma altrove) e ripete la dottrina ADR-0023/no-PII che CLAUDE.md e ADR-0038 dichiarano superata. La sezione "5. Auth/Security" dello stesso file riporta anche "RBAC 12 ruoli × 154 permessi × 681 mapping (S1007)", diverso dal "14 ruoli/224 perm/980 map" della sezione 0. Il file si contraddice al proprio interno fra la parte narrativa (viva) e le sezioni di riferimento statiche (non riallineate).

### 10. Note terminologiche minori (non citate come contraddizioni piene, ma segnalate)

- `docs/architecture/adr/0002_backend_framework_fastify.md` (Accepted) descrive Fastify **4**; README.md e CLAUDE.md correnti dichiarano Fastify **5**. Nessun ADR successivo formalizza il passaggio.
- `docs/architecture/adr/0007_frontend_next15_app_router.md` (Accepted) descrive Next.js **15**; `docs/kb/SOT_STATE.md` §2 dichiara **Next 16** (B-23, bump S969). Nessun ADR successivo formalizza il passaggio.
- `heuresys-advanced-bootstrap-vm.md` (2026-05-17) descrive `@heuresys/ui` consumato via symlink `link:../ux-design-shared/ui`; CLAUDE.md e `docs/kb/xtras/DESIGN_SYSTEM_UI.md` correnti dichiarano il consumo via pacchetto npm-pubblicato dalla migrazione X18 (2026-05), con `link:` esplicitamente citato come superato.

## Lacune dichiarate

- Le date "Ultima modifica" della tabella d'inventario per i file **non tracciati in git** (marcati `non-tracciato (mtime fs)`) sono la data di modifica del filesystem, non una data di commit verificabile — per costruzione meno affidabile (puo' riflettere una copia/allineamento invece di una scrittura originale). Riguarda in particolare `.agents/`, `.codex-review/`, `.codex/AGENTS.md`, `AGENTS.md` (radice) e alcuni file di `qa_artifacts/`/`deploy/reports/`.
- Per le 11 directory dichiarate "non lette per volume" non e' stato prodotto alcun giudizio di ruolo/sospetto per i singoli file: la tabella d'inventario ne riporta comunque path/dimensione/data/titolo per intero.
- Il conteggio "graphify-out/ 10049" e "graphify-db-input/ 11" nella sezione Esclusioni deriva da un grep sul nome della directory nell'elenco enumerato in Fase A e puo' includere un numero minimo di falsi positivi da percorsi che contengono la stringa "graphify-out" senza esservi dentro (es. riferimenti testuali in altri documenti) — non e' stato isolato con un secondo comando di verifica.
- Non e' stato verificato contro lo stato attuale del `.env` di produzione se `MFA_ENFORCEMENT_ENABLED` sia stato riattivato dopo l'audit S1006 (`audit/FINDINGS.md`, `audit/FORENSIC-NOTES-S1006-cli.md`): la nota "da riattivare" resta come scritta nel documento originale, senza verifica in questa sessione (sessione di sola lettura sulla documentazione, non sul sistema vivo).
