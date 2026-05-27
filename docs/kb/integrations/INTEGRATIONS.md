# INTEGRATIONS — Tool esterni integrati nel dominio (CLI-owned)

> Analisi + strategia di integrazione **complementare e non-conflittuale** dei 3 tool richiesti, nell'ecosistema Claude di questo PC Windows. Nessuno rompe ciò che già funziona. **Aggiornato**: 2026-05-27 (S939).

## 1. graphify (`safishamsi/graphify`) — knowledge graph da codice+docs

| Aspetto | Valore |
|---|---|
| Stato | ✅ installato — binario `C:\Users\enzospenuso\.local\bin\graphify` (via `uv tool`), skill `C:\Users\enzospenuso\.claude\skills\graphify\SKILL.md` v0.8.14 |
| Ingestion | **In-place, zero copie**: legge da `<path>` ricorsivo. Codice via tree-sitter **AST (no LLM, no API key)**; docs/PDF/img via LLM (skill subagent o `--backend` headless con API key). |
| Output | `graphify-out/` **adiacente all'input** → `graph.json` + `graph.html` + `GRAPH_REPORT.md`. Non-distruttivo sui sorgenti. **Da gitignorare**. |
| Comandi chiave | `graphify update <path>` (AST refresh, cheap) · `/graphify <path>` (skill, full semantic) · `graphify query "<q>"` (BFS su graph.json) · `graphify explain "X"` · `graphify path "A" "B"` |
| Integrazione dominio | Strumento d'elezione per il **codice** (apps/, packages/, db/). Alimentato dall'indice via **symlink-mirror** (Developer Mode ON) → zero copie, zero conflitto col repo. Output gitignorato. |

## 2. LLM Wiki — gist Karpathy (blueprint) → wiki-factory (implementazione)

- **Gist** `karpathy/442a6bf...` = **blueprint concettuale, non codice**. Pattern a 3 strati: *raw sources* (immutabili, curati dall'umano) → *wiki* (pagine MD generate/mantenute dall'LLM) → *schema* (CLAUDE.md, regole). Operazioni: Ingest / Query / Lint. Insight: "the wiki is a persistent, compounding artifact" — l'LLM fa il grunt work (summary, cross-ref, filing) che fa marcire le KB se manuale.
- **Implementazione operativa** = `C:\Users\enzospenuso\wiki-factory` (engine skill `llm-wiki` v1.2.0, funzionante). Vault esistenti in `wiki-space/`: `heuresys-wiki` (157 pagine, VALID), `nose-wiki`. Registry `.wiki-vaults.yaml`.
- **Mapping gist → wiki-factory**: raw sources → `<vault>/raw/`; wiki → `<vault>/wiki/{sources,concepts,entities,syntheses}`; schema → `<vault>/CLAUDE.md`; Ingest/Query/Lint → workflow §2.1/2.2/2.3 della skill. wiki-factory **estende** il blueprint con manifest SHA idempotente, subagent batch, lint 14-check, dimensioni 7-assi, registry cross-vault, export MkDocs.
- **Integrazione dominio (no copie)**: il gist/wiki-factory vuole `raw/` con file fisici. Per ingerire l'indice **senza duplicati** ho esteso la skill con il modo **`source_mode: linked`** (vedi `docs/kb/SKILL_EXTENSION_LINKED_SOURCES.md`): lettura in-place da path assoluti, SHA sul file esterno, nessuna copia/symlink in `raw/`. Vault dedicato `heuresys-advanced-wiki`. Strumento d'elezione per la **prosa** (docs, ADR, planning, SoT).

## 3. andrej-karpathy-skills (`multica-ai/andrej-karpathy-skills`)

- **Cos'è**: un plugin Claude Code (marketplace `forrestchang/andrej-karpathy-skills`) = essenzialmente un `CLAUDE.md` con **4 principi**:
  1. **Think Before Coding** — "Don't assume. Surface tradeoffs."
  2. **Simplicity First** — "Minimum code. Nothing speculative."
  3. **Surgical Changes** — "Touch only what you must."
  4. **Goal-Driven Execution** — "Define success criteria. Loop until verified."
- **Decisione (Enzo S939): reference, NON attivo globale.** Razionale: i 4 principi si sovrappongono per ~95% alle **R1-R23 globali** già consolidate (vedi mappa sotto) + superpowers `verification-before-completion`. Installarlo come plugin globale **ridefinirebbe/duplicherebbe** regole esistenti → conflitto/rumore. Coerente con R18 (plugin nativo > duplicati).
- **Mappa overlap R1-R23**:

| Principio Karpathy | Già coperto da |
|---|---|
| Think Before Coding | R1 (pensa prima, modo più semplice) + R9 (gestione incertezza, no-hallucination) + R14 (anti-bias, cerca evidenza contraria) |
| Simplicity First | R1 (>3 step → ripensare) + R8 (token hygiene) |
| Surgical Changes | R12 (delega/diff mirati) + diff-before-apply (CLAUDE.md global) |
| Goal-Driven Execution | R5 (test-before-claim) + superpowers verification-before-completion + R20 (feasibility evidence-based) |

- **Net-new ≈ marginale**: il framing esplicito "transform imperative tasks into verifiable goals + loop until verified". Già operativamente coperto, ma utile come promemoria. **Nessuna azione**: documentato qui come reference; se in futuro si vuole il loop-goal esplicito, si aggiunge a R5 (non si installa il plugin).

## 4. Principio di non-conflittualità (garanzia)

- graphify: tool esterno read-only sui sorgenti; output gitignorato → **zero impatto** su build/CI/repo.
- llm-wiki linked-mode: **estensione additiva** della skill (modo opt-in); i vault esistenti `physical` invariati → **zero regressione**.
- karpathy-skills: non installato → **zero modifica** all'ecosistema regole.
- Verifica end-to-end post-integrazione: `pnpm typecheck`/`lint`/build verdi + CI verde (vedi `SOT_STATE.md §7`).

## 5. Usage — come interrogare wiki + grafo (sessioni future)

**Artefatti generati (tutti FUORI dal repo, per tenerlo pulito):**
- Wiki: `C:\Users\enzospenuso\wiki-space\heuresys-advanced-wiki\` (28 pagine ingerite: 24 sources ADR+SoT, 2 concepts, 2 entities — modo linked, zero copie).
- Knowledge graph: `C:\Users\enzospenuso\wiki-space\heuresys-advanced-graph\src-mirror\graphify-out\graph.json` (8543 nodi, 10074 edge, 797 community; mirror di 864 symlink dall'indice).

**Query LLM-Wiki**: `cd C:\Users\enzospenuso\wiki-factory && claude` → "start wiki session heuresys-advanced-wiki" → query/lint/ingest.

**Query graphify** (PATH: `C:\Users\enzospenuso\.local\bin`):
```bash
G="C:/Users/enzospenuso/wiki-space/heuresys-advanced-graph/src-mirror/graphify-out/graph.json"
graphify query "<domanda>" --graph "$G"
graphify explain "requirePermission()" --graph "$G"
graphify path "rbac.ts" "auth/service.ts" --graph "$G"
```

**Re-ingest incrementale (quando l'indice cambia):**
1. `python docs/kb/tools/build_index.py` (rigenera indice)
2. `python docs/kb/tools/build_linked_manifest.py` (rigenera subset prosa) → poi wiki "ingest" (delta via `compute_delta_linked.py`, solo nuovi/modificati per idempotenza SHA)
3. `python docs/kb/tools/build_graph_mirror.py && graphify update <mirror>` (AST incrementale)

**Ingestion wiki**: ✅ **completa** — **63/63 sorgenti prosa di dominio ingerite** (19 ADR + 44 doc-canonical: SoT, planning, brownfield, api, db, ci, security, frontend, vm). Escluso il corso GitHub generico `docs/github/**` (34 file, non-dominio — resta in indice + graphify). Delta wiki = 0 (allineato all'HEAD).

### Sync & automazione (R15)
- **`docs/kb/tools/sync.{sh,ps1}`**: re-allinea tutto all'HEAD — rigenera indice + manifest prosa + mirror symlink + `graphify update` (AST, cheap) + report delta wiki. `--graph-only` salta il report wiki.
- **`docs/kb/tools/reconstruct_linked_manifest.py`**: ricostruisce `manifest.yaml` del vault dalle pagine (frontmatter `source_path`), idempotente, no-race con ingestion parallela.
- **Hook git opt-in**: `docs/kb/tools/install-hooks.sh` installa `post-commit`/`post-merge` che lanciano `sync.sh --graph-only` in background → il **knowledge graph resta allineato a ogni commit**. L'ingestion wiki (LLM) resta manuale (`compute_delta_linked` segnala i delta). Disinstalla: `install-hooks.sh --uninstall`.
- **Path frontmatter**: i `source_path` nelle pagine wiki usano **forward-slash** (validi YAML + compatibili Windows/Read) per evitare l'ambiguità di escape dei backslash.

