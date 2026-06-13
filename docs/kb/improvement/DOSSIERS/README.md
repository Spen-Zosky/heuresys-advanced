# DOSSIERS/ — register decisionale del programma 100X

> Un file per dossier (`D-NN_<slug>.md`), **compilato nella fase di consolidamento (S-100X-C)** dopo gli audit, e **deciso da Enzo**. Template in `../AUDIT_PROTOCOL.md`. Ogni dossier presenta ≥1 opzione conservativa, ≥1 evolutiva, ≥1 radicale (nessun contratto pubblico/invariante pre-escluso — intervista #2).

| ID | Oggetto | Lean misurato (S-100X-0) | Stato |
|---|---|---|---|
| D-01 | Runtime/linguaggio (Node + Fastify) + module codegen | status quo asset; generator scaffold evolutivo | PENDING |
| D-02 | Data layer (raw SQL vs builder/ORM) | **stay raw + drop drizzle** | PENDING |
| D-03 | Validazione/contratti (Zod4+ftpz6) + shared db-helper extraction | sano; estrai `withTransaction` | PENDING |
| D-04 | Frontend client-only vs RSC/streaming | opportunità reale (first-paint) | PENDING |
| D-05 | Design system `@heuresys/ui` | disciplina pulita; evoluzione lib | PENDING |
| D-06 | Tooling/build (pnpm + tsup/tsc, cache, affected) | task-runner/affected | PENDING |
| D-07 | Migration squash-to-baseline | baseline GA + delta separati | PENDING |
| D-08 | **CI/CD: runner SPOF + 0 rollback** + **🔴 fork-PR ACE su prod host (public repo)** | **alta leva — ora security-priority** (drop PR-trigger self-hosted + require-approval · cgroup/ephemeral · DB CI separato · LAST_GOOD+vm-rollback+pg_dump pre-deploy · required-checks+deploy-gate · runner off-prod). Audit A1 ✅ `FINDINGS/WS-G.md` (30 finding) | PENDING (audited) |
| D-09 | Observability (no `/metrics`) | prom-client → OTel | PENDING |
| D-10 | Architettura applicativa (monolite vs servizi) | monolite sano | PENDING |
| D-11 | Brownfield/ingestion engine (riconciliazione 0 stati aperti) | keep/freeze/extract | PENDING |
| D-12 | AI/embedding (pgvector + Voyage seam + reindex timer) | astrai provider / timer R7 | PENDING |
| D-13 | Auth self-built vs libreria vs managed | hardened asset; mantieni salvo esplosione SSO/SCIM | PENDING |
| D-14 | GTM/multi-tenant readiness | aggancia `POST_V1_ROADMAP_DOSSIER §3.1` | PENDING |

**Sotto-dossier emersi dal recon** (possono restare sezioni dei sopra o file propri): D-B test-pyramid+parallelism · D-C e2e session model · D-3docs consolidamento · D-6scripts multi-host unification.

**Quick-wins** (NON sono dossier — CLASS-A eseguibili su go): vedi `TODO_100X.md` §Quick-wins (QW-1..QW-5).
