# REPORT 026 — CLI Batch X19.A (Dependabot CVE — uuid bump)

**Goal ID**: 026 · **Slug**: `batch_x19a_dependabot_cve` · **Status**: ✅ COMPLETE
**Executed**: 2026-05-25 (sequenza autonoma C19, batch 1/3)
**Predecessor HEAD**: `37600e1` (descendant of `82a30a1` ✅) · **Duration**: ~25 min

---

## §0 — Scope reale (deviazione dal PROMPT, motivata)

PROMPT 026 prevedeva bump di **2 deps** (uuid + qs). Pre-flight ha confermato che **qs è già fixato** dal commit `c304b02` (`pnpm.overrides` contiene già `"qs": ">=6.15.2"`). Scope effettivo X19.A = **uuid only**.

---

## §1 — Pre-flight (live state)

| Check | Esito |
|---|---|
| HEAD descendant di `82a30a1` | ✅ `37600e1` (`git merge-base --is-ancestor` PASS) |
| `pnpm why uuid` | transitive only via `@heuresys/ui`: `exceljs 4.4.0 → uuid 8.3.2` + `mermaid 11.15.0 → uuid 14.0.0` |
| uuid versions in lockfile (pre) | `uuid@8.3.2` (VULNERABILE) + `uuid@14.0.0` (già safe) |
| `qs` override | già presente (`>=6.15.2`, c304b02) — no-op |
| uuid 11.1.1 su registry | ✅ esiste |
| `exceljs` usato nel source repo? | ❌ NO — `grep -rn exceljs apps/ packages/` vuoto (transitive puro via @heuresys/ui) |

---

## §2 — Fix applicato (critical thinking CW-B58 aware)

**Decisione minima-blast**: override **scoped** invece del global `^11.1.1` prescritto dal PROMPT.

```json
// package.json pnpm.overrides — aggiunta:
"exceljs>uuid": ">=11.1.1"
```

**Rationale della deviazione**:
- Unica versione vulnerabile = `uuid@8.3.2` via `exceljs`. `mermaid → uuid@14.0.0` è già ≥11.1.1 (SAFE).
- Un override **globale** avrebbe forzato anche mermaid → regression risk inutile sul charting (zero beneficio security).
- Scoped su `exceljs` → mermaid intatto, blast radius minimo.
- `exceljs` usa uuid solo per `v4()` (API `{ v4 }` stabile v8→v14) e **non è importato** nel source di questo repo.

**Risoluzione post-`pnpm install`**: `exceljs>uuid >=11.1.1` ha risolto a **14.0.0**, deduplicando con mermaid → **uuid@14.0.0 unica versione** nel lockfile, `8.3.2` eliminato del tutto. Lockfile più pulito di prima (1 versione vs 2).

```
pnpm why uuid (post):
├─┬ exceljs 4.4.0 └── uuid 14.0.0
└─┬ mermaid 11.15.0 └── uuid 14.0.0
```

**CVE-2026-41907 (uuid < 11.1.1) → RESOLVED** (nessuna uuid < 11.1.1 residua).

---

## §3 — Regression matrix (empirical)

| Gate | Comando | Esito |
|---|---|---|
| API typecheck | `pnpm --filter @heuresys/api exec tsc --noEmit` | ✅ PASS (0 errori) |
| Web typecheck | `pnpm --filter @heuresys/web exec tsc --noEmit` | ✅ PASS (0 errori) |
| vitest API | full suite | **336 passed / 1 failed / 5 skipped** = baseline `336/342` esatto → **0 regression** |
| Web build | `NEXT_PUBLIC_ENABLE_SHOWCASE=1 ... build` | ✅ PASS (tutte le route, incl. showcase) |

Artefatti: `qa_artifacts/x19a_vitest_api.txt`, `qa_artifacts/x19a_web_build.txt`.

### §3.1 — Pre-existing failure flagged (NON regression, NON uuid)

`test/skills.integration.test.ts:131` fallisce (1 test): `createdSkillIds` non presenti nella list response. **Verificato empiricamente NON correlato a uuid**:
- I match "uuid" in `skills/repository.ts` sono **cast SQL `::uuid` + commento zero-uuid**, NON import del package npm.
- Re-run isolato: 1 fail / 4 pass **deterministico** (non flaky).
- Pass count = 336 = baseline esatto → il fail era già nel baseline `336/342`.

**Raccomandazione Cowork**: bug pre-esistente di skills-list visibility/pagination, fuori scope X19.A (batch CVE). Candidato a mini-batch dedicato o forensic CW-B60. NON fixato inline per scope discipline + time-box.

---

## §4 — Commit

```
chore(security): X19.A — uuid bump (qs already done in c304b02)
```
File: `package.json`, `pnpm-lock.yaml`, `qa_artifacts/x19a_*.txt`, PROMPT 026, REPORT 026, HANDOFF.
**NO push** (sequenza autonoma = solo commit locali).

§4 PROMPT Block C (Dependabot post-push verify) **deferred** — nessun push autonomo; Enzo/Cowork verificherà gli alert dopo il push.

---

## §5 — Halt status & bias

- **Nessun halt**. P0/P1 non triggerati.
- **CW-B58 awareness applicata**: la prescrizione PROMPT (`^11.1.1` global) era un over-apply potenziale; verifica empirica (versioni reali nel lockfile + uso exceljs nel source) ha guidato a un fix scoped più sicuro. Nessun nuovo bias da catalogare (caso di critical-thinking-as-designed, non un fail Cowork).

## §6 — Next

Procedo a **X19 (Brownfield Wave 1, PROMPT 023)** — batch 2/3 della sequenza C19.

---

*End REPORT 026 — X19.A complete, no halt.*
