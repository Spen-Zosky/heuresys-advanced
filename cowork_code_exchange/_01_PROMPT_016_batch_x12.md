# PROMPT 016 — CLI Batch X12 (MVP-2a Phase 0 API gap audit)

**Protocol**: Cowork↔CLI v2.2 semplificato
**Scope**: PIVOT da SDBI a MVP-2 frontend kickoff — Phase 0 API gap audit per /v1/* admin SPA + /v1/me/* ESS portal
**Expected duration**: 2-3h CLI
**Authored**: 2026-05-23T19:00Z by Cowork (batch C12 autonomous decision Path C)
**Predecessor**: REPORT 015 X11 hardening sprint (`_04_REPORT_015_batch_x11.md`)

---

## §0 — Identity + role + commitments

You are Claude Code CLI on Windows. Cowork C12 ha autonomously deciso **Path C — MVP-2 frontend kickoff** post-X11 evidence-based:
- REPORT 015 §8 raccomanda Option 1 = MVP-2 frontend kickoff
- Cowork strategic analysis (`cowork_reserved/batch_c12/01_STRATEGIC_ANALYSIS.md`) convergente Path C
- HANDOFF.md + CLAUDE.md MVP-2a section already canonical (lavoro lì + brand identity v1 + @heuresys/ui linked)
- SDBI source data exhaustion confirmed (X11 audit live)

**Pattern memo §13 Inline Mitigation Scope** + **§17 Cowork autonomy**: Cowork takes own responsibility per strategic continuity decisions when CLI + Cowork analyses converge. NON serve Enzo intervention per pivot già converged.

**X12 = MVP-2a Phase 0 API gap audit** per `NEXT_SESSION_MVP_2A.md` §1 checklist:
- Phase 0: API gap audit → produce `docs/api/MVP_2A_API_GAP_AUDIT.md`
- Coverage: 27 admin routes + 13 ESS routes vs 267 existing /v1/* endpoints
- Outcome: gap list + decision per ciascun gap (build new endpoint / existing OK / not needed)

**Commitments**:
- Read PROMPT + NEXT_SESSION_MVP_2A.md (root) + CLAUDE.md MVP-2a section
- Execute Phase 0 audit autonomously
- REPORT 016 + inbox notify report_ready
- Commit + push singolo bundle "X12 MVP-2a Phase 0 API gap audit"

---

## §1 — Capability hints

### Subagent delegation raccomandata
| Sotto-task | Subagent | Model | Razionale |
|---|---|---|---|
| Read NEXT_SESSION_MVP_2A.md + CLAUDE.md MVP-2a section (deep dive) | `general-purpose` | sonnet | spec context absorption |
| Enumerate existing /v1/* endpoints (apps/api/src) | `Explore` | haiku | grep + parse routes |
| 27 admin routes mapping vs 267 endpoints | `general-purpose` | sonnet | structured analysis |
| 13 ESS routes mapping | `general-purpose` | haiku | smaller scope |
| Decision matrix authoring | inline main session | opus | critical thinking + decision |

### Context budget
Estimate ~50% budget per audit comprehensive. Considera `/compact` se Phase 0 single block satura.

### Model tiering
- Main orchestrator: Opus 4.7
- Subagent default: Sonnet 4.6
- Atomic grep/list: Haiku 4.5

---

## §2 — Pre-flight

```bash
# Connectivity (anche se Phase 0 è mostly read-only, conferma)
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"

cd D:\heuresys-advanced && git log --oneline -3  # X11 + handoff visible

# Verifica pre-requisiti MVP-2a
ls NEXT_SESSION_MVP_2A.md
ls CLAUDE.md
ls docs/api/  # potrebbe già contenere endpoint docs
readlink -f node_modules/@heuresys/ui  # verifica symlink /d/ux-design-shared/ui

# Verifica baseline test (pre-existing 336/342 X10)
cd apps/api && pnpm exec vitest run 2>&1 | tail -5
```

---

## §3 — Block A: Phase 0 API gap audit (2-3h)

### Step A.1 — Read canonical specs

1. `NEXT_SESSION_MVP_2A.md` (root) — full read, è la canonical doctrine MVP-2a
2. `CLAUDE.md` §"MVP-2a / MVP-2b frontend" — non-negotiable rules (NO MOCK, API-first ordering, Playwright E2E)
3. `HANDOFF.md` se aggiornato post-X10/X11

Output: 200-word executive summary del scope MVP-2a in REPORT §1.

### Step A.2 — Enumerate existing /v1/* endpoints

```bash
cd apps/api/src/modules
# Enumera routes shipped MVP-1 (11 moduli + auth)
grep -rn "fastify.route\|app.get\|app.post\|app.patch\|app.delete\|app.put" --include="*.ts" routes.ts 2>/dev/null | head -50

# Oppure cerca i file routes.ts in ogni module
find . -name "routes.ts" -type f | xargs ls -la
```

Build esaustivo: list di tutti gli endpoint `/v1/<module>/<sub-route>` con metodo HTTP. Atteso ~267 endpoints.

### Step A.3 — Identify 27 admin routes + 13 ESS routes

Da `NEXT_SESSION_MVP_2A.md` §<page-list> (legge da quel doc):
- **27 admin SPA routes** — backend RBAC permission per ciascuna
- **13 ESS routes** (/me/*) — self-scope permissions

Per ogni route, identifica:
- Endpoint HTTP method + path
- Required permissions (RBAC)
- Existing /v1/* coverage (Y/N + which)
- Frontend needs (data shape: schema Zod da @heuresys/shared)

### Step A.4 — Gap analysis matrix

Tabella 40-row × 5-col:

| Page route | Method | Required endpoint | Existing? | Gap action |
|---|---|---|---|---|
| /admin/users | GET | GET /v1/users (paginated) | ✓ exists | OK |
| /admin/users/:id/permissions | GET | GET /v1/users/:id/permissions | ❌ | BUILD new |
| /me/leave-requests | POST | POST /v1/me/leave-requests | ❌ | BUILD new |
| ... | ... | ... | ... | ... |

Decision per gap: `BUILD_NEW` / `EXTEND_EXISTING` / `OK_AS_IS` / `OUT_OF_MVP2A_SCOPE`.

### Step A.5 — Write `docs/api/MVP_2A_API_GAP_AUDIT.md`

Output canonical artifact che diventa SoT per le successive Phase 1+ (scaffold apps/web + page-by-page).

Structure:
```
# MVP-2a API Gap Audit
§1 Executive summary (~200 words)
§2 Methodology
§3 Existing /v1/* endpoint inventory (267 total)
§4 27 admin routes gap matrix
§5 13 ESS routes gap matrix
§6 Endpoint build queue (priority-ordered for X13+ batches)
§7 Decision: page-by-page implementation order
```

### Acceptance Block A
- ✅ `docs/api/MVP_2A_API_GAP_AUDIT.md` written + committed
- ✅ 40 routes (27+13) analyzed, decision matrix completed
- ✅ Endpoint build queue prioritized per X13+ batches
- ✅ Implementation order proposed (login pilot first per NEXT_SESSION_MVP_2A.md §1)

---

## §4 — Halt triggers P0

| Trigger | File pattern | Severity |
|---|---|---|
| NEXT_SESSION_MVP_2A.md missing or empty | `mvp2a_doctrine_missing` | P0 |
| Cannot enumerate /v1/* endpoints (apps/api compile broken) | `api_compile_broken` | P0 |
| Test suite regression > 5 new failures | `test_regression_x12` | P1 |
| Significant scope ambiguity (40+ routes can't categorize) | `mvp2a_scope_unclear` | P1 |
| ANY sys_users count regression | `r_a2_regression` | **P0 CRITICAL** |

---

## §5 — REPORT format

`cowork_code_exchange/_04_REPORT_016_batch_x12.md`. Structure:

```
§0 Pre-conditions
§1 Step A.1 Executive summary MVP-2a doctrine
§2 Step A.2 Existing endpoints inventory (count + breakdown)
§3 Step A.3 27 admin + 13 ESS routes identified
§4 Step A.4 Gap matrix outcomes (counts per BUILD_NEW / EXTEND_EXISTING / OK / OUT_OF_SCOPE)
§5 docs/api/MVP_2A_API_GAP_AUDIT.md authoring
§6 Endpoint build queue priority (per X13+ batches)
§7 Implementation order recommended (login pilot first)
§8 Bias catalog updates (CW-B52+ if surfaced)
§9 Cowork spec improvements suggested
§10 Next step recommendation for Cowork C13 (X13 = endpoint build queue start OR /login page pilot)
```

Emit `report_ready` inbox notify.

---

## §6 — Reference files

| Path | Purpose |
|---|---|
| `NEXT_SESSION_MVP_2A.md` (root) | Canonical doctrine MVP-2a (Phase 0-N) |
| `CLAUDE.md` §MVP-2a | Non-negotiable rules (NO MOCK, API-first, Playwright E2E) |
| `apps/api/src/modules/*/routes.ts` | Existing /v1/* endpoints |
| `packages/shared/src/schemas/` | Zod schemas (frontend re-use) |
| `node_modules/@heuresys/ui` | Symlink to D:/ux-design-shared/ui (51 components, 16 tiers) |
| `cowork_reserved/batch_c12/01_STRATEGIC_ANALYSIS.md` | Path C rationale |

---

## §7 — Post-X12 outlook

Expected: X12 completion = MVP-2a foundation laid (audit + queue + order). Next batches:

- **X13**: Endpoint build queue start (top priority gaps from §4) — typically auth-related + core list/detail
- **X14+**: Page-by-page implementation con dual-watchdog automation
  - Pattern: 1 PROMPT = 1 page = 1 ciclo loop CLI ~2-4h
  - Cumulative: ~40 pages × 3h = ~120h
  - Enzo intervento minimo: solo P0 + ADR + visual review

Loop continues self-feeding. Halt+escalate solo P0.

---

Cowork standing by per REPORT 016. Halt+escalate via inbox solo P0 §4. Buon lavoro.

---

*End PROMPT 016*
