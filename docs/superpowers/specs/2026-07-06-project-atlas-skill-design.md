# Design — skill `project-atlas` (conoscenza operativa + linee di sviluppo)

**Data**: 2026-07-06 (S1016) · **Stato**: APPROVATO da Enzo (intervista brainstorming + 4 sezioni approvate)
**Provenienza**: sessione S1016 ("conoscenza assoluta") + valutazione panel 4-lenti (inventario/invocabilità/manutenibilità/confini) + verifica documentazione `/goal` (Claude Code ≥2.1.139).

## 1. Scopo e perimetro

Skill richiamabile che codifica le fasi CONOSCENZA e PRODOTTO della sessione S1016:
1. **Conoscenza**: atlas cross-layer deterministico + sweep semantico multi-agente + grafo parallelo + sintesi curata.
2. **Prodotto**: Q&A evidence-based → dossier linee di sviluppo → blocchi Action register lint-validati.

**Fuori perimetro** (decisione Enzo): il BUILD degli item (resta governato da CLAUDE.md pattern 7-step + DoD ADR-0026); la chiusura sessione (dominio esclusivo della skill `handoff`).

## 2. Architettura (approccio A approvato — skill unica a dispatcher)

Collocazione: **`.claude/skills/project-atlas/`** nel repo (viaggia con git + align-clones; evoluzione futura a plugin heuresys-plugins quando servirà multi-progetto).

```
.claude/skills/project-atlas/
├── SKILL.md                    # dispatcher + contratto (snello, <150 righe, progressive disclosure)
└── references/
    ├── atlas.config.yaml       # MANIFEST: path SoT per F0, root moduli/route, famiglie sweep,
    │                           #   soglie staleness; sezione `adaptive:` per override auto-appresi (azzerabile)
    ├── planner.md              # derivazione RUNTIME dei target (ls moduli, route groups,
    │                           #   information_schema) + check copertura fail-loud
    ├── sweep-prompts.md        # 6 template per FAMIGLIA (code-chunk / db-live / ops / legacy / wiki /
    │                           #   design-system) — MAI istanze hardcoded (anti-drift, lente manutenibilità)
    ├── model-map.md            # matrice modello×effort per tipo agente (§5)
    ├── curated-template.md     # struttura ATLAS_CURATED + regole merge/staleness della parte semantica
    ├── dossier-template.md     # formato DEVELOPMENT_LINES + conversione register (rimanda a R20 e
    │                           #   handoff_lint — non li ricopia)
    ├── goal-recipes.md         # condizioni /goal misurabili per i modi lunghi (§6)
    └── LEARNINGS.md            # auto-aggiornato: sezione Lezioni (prosa) + run-record YAML (§6)
```

Materiale sorgente già salvato: `docs/kb/tools/atlas-sweep-templates/` (workflow S1016 + digest + 19 frammenti).
Tool riusati (già nel repo): `docs/kb/tools/build_atlas.py`, `build_menu.py`, `handoff_lint.py`, `status_dashboard.py`; skill invocata: `graphify`.

### Modi del dispatcher (routing deterministico)

| Modo | Trigger | Comportamento | Costo |
|---|---|---|---|
| **status** (default a invocazione nuda) | `/project-atlas` | staleness misurata per layer (git log --since per path-glob; psql per DB; mtime wiki) + stato curated + menu modi | ~zero |
| **refresh** | "aggiorna/refresh l'atlas", "aggiorna la conoscenza" | default = **delta** dei soli layer stale (planner runtime); a valle SEMPRE `build_atlas.py` + `graphify --update` (F2+F3 accoppiati) | proporzionale ai layer stale |
| **refresh --full** | esplicito | sweep completo SOLO dietro conferma con stima costo in forma R20 ("~N agenti / ~X token, procedo?") + riga `/goal` pronta | alto, dichiarato |
| **query** | domande evidence-based su sistema/capacità quando `docs/kb/atlas/` esiste; "collaudo" | protocollo **atlas-first**: atlas.yaml → ATLAS_CURATED → Grep/psql SOLO per verificare l'evidenza citata; risposta con evidenza in ≤2 tool call | basso |
| **dossier** | "dossier", "linee di sviluppo", brainstorming prodotto su heuresys | pre-check staleness atlas (rifiuto/warning oltre soglia, anti-D-01) → template → blocchi Action register **preparati e lint-validati**; scrittura/commit secondo le regole del flusso handoff (single-writer preservato) | medio |

## 3. Planner runtime (anti-drift — correttivo obbligatorio dal panel)

I target del sweep NON vivono nella skill. A ogni run:
- chunk API = `ls apps/api/src/modules` partizionati per budget (dimensione calcolata, non fissa);
- web = route groups da `ls apps/web/src/app`;
- shared = subpath exports da `packages/shared/package.json`;
- DB = information_schema live;
- famiglie non derivabili (legacy, wiki, design-system) = lista corta in `atlas.config.yaml` con **probe di esistenza** prima del lancio.

**Check di copertura fail-loud**: target derivati vs frammenti prodotti — ogni mismatch è errore bloccante con retry mirato sul solo target mancante. Mai atlas "fresco ma bucato" silenzioso.

## 4. Orchestrazione: agenti, tool, MCP, skill collegate

- Subagenti SOLO via **Workflow tool** (pipeline/parallel, cap concorrenza, structured output schema) — mai Agent sciolti per il sweep. Frammenti scritti su file dagli agenti; al main loop tornano solo summary+notables (igiene contesto).
- psql via Bash sul tunnel :5433 (batch UNION ALL + retry su drop — pattern `build_atlas.py`); SSH remoto con `MSYS_NO_PATHCONV=1` + nvm (riferimento alla memoria `reference_remote_ssh_deploy_ops`, non ricopiata).
- Skill collegate: **invoca** `graphify` per la vista parallela (F3); **rispetta** `handoff` come unico writer di SOT_STATE/BACKLOG (il modo dossier prepara e valida, non governa il commit di stato); il modo dossier **soddisfa** il requisito superpowers:brainstorming per il lavoro creativo di prodotto heuresys (dichiarato nella description — niente attivazione in cascata).
- **Da NON usare** in questo flusso: Windows-MCP / chrome-tools per file ops (i tool nativi bastano); nessun nuovo file di stato (regola CLAUDE.md "never spawn a new state file"): atlas = **derived view, not SoT** — i conteggi puntano a SOT_STATE.

## 5. Model-map (token-optimization con qualità garantita)

| Attività | Modello | Effort | Razionale |
|---|---|---|---|
| Inventari meccanici (ops, liste, mtime, probe) | haiku | low | estrazione senza giudizio |
| Sweep semantico code/web/shared | sonnet | low | file:line affidabile al minor costo |
| DB live + legacy (SQL/SSH, precisione) | sonnet | medium | query esatte, zero allucinazioni |
| Sintesi curated + verify adversariale | modello di sessione (fable/opus) | high | il giudizio non si delega in giù |
| Modi query e dossier | main loop, zero subagenti | — | l'atlas esiste apposta |

Fallback dichiarato: in dubbio → eredita il modello di sessione. **Mai downgrade silenzioso su task di giudizio.** Promozioni/demozioni adattive solo via meccanismo §6, loggate.

## 6. Self-learning (livello approvato: learnings + metriche adattive) e /goal

- Fine invocazione refresh/dossier → append a `LEARNINGS.md` di un **run-record YAML**: data, modo, layer, agenti, token stimati, esito coverage, errori/gotcha, durata. Sezione **Lezioni** in prosa sopra i record.
- Il run successivo legge le metriche e **adatta i parametri**: dimensione chunk (sforamenti → chunk più piccoli), modello per famiglia (frammenti scartati dal coverage → promozione a sonnet, loggata), cadenza probe staleness.
- **Guard-rail**: ogni adattamento (a) registrato con il perché nel run-record, (b) reversibile (default in `atlas.config.yaml`, override in sezione `adaptive:` azzerabile), (c) template/prompt MAI auto-modificati — cambiano solo per mano umana o proposta esplicita a Enzo (R15).
- **/goal** (built-in Claude Code ≥2.1.139, valutatore esterno su condizione misurabile): `goal-recipes.md` fornisce la riga pronta per i modi lunghi —
  - refresh full: `build_atlas.py esce 0 due volte con diff vuoto ∧ coverage check 0 target mancanti ∧ handoff_lint.py esce 0`;
  - dossier: `il file DEVELOPMENT_LINES_<X>.md esiste ∧ ogni linea ha evidenza datata+webapp+effort ∧ handoff_lint.py esce 0`.
  La skill propone la riga (l'attivazione del comando è dell'utente) e la usa comunque come contratto di uscita interno in autonomia.

### Error handling / degradazione
- Tunnel giù → output marcato `[non verificato: DB]`, mai numeri stale spacciati per freschi (pattern status_dashboard).
- Spend-limit a metà sweep → salvataggio frammenti completati + pending-file + item GATED nel register (lezione S1016 codificata).
- Agente fallito → denunciato dal coverage check, retry mirato sul singolo target.
- Known issues pre-caricati in LEARNINGS (rate-limit login 10/5min, MSYS path-mangling, cp1252, ls dotfiles) — niente ri-diagnosi.

## 7. Description e frontiere (anti mis-trigger — dal panel lente confini)

Trigger positivi: "atlas", "aggiorna/refresh la conoscenza", "mappa operativa del progetto", "dossier", "linee di sviluppo", "collaudo atlas", riferimenti a `docs/kb/atlas/` o `DEVELOPMENT_LINES_*`.
Frontiere negative LETTERALI nella description: NON per bug-hunting/audit forense (→ `full-forensic-audit`) · NON per QA E2E o piani release (→ `forensic-100x-kickoff`, `web-qa-audit`) · NON per due diligence investor (→ `saas-investor-due-diligence`) · NON per chiusura sessione/riscrittura SoT (→ `handoff`) · NON per topologia/BFS pura (→ `graphify`) · il modo dossier è la variante evidence-based project-scoped che soddisfa superpowers:brainstorming per il prodotto heuresys.

Vincoli ereditati per riferimento (mai ricopiati): R20 effort quantificati · DoD live E2E (ADR-0026) · OUTPUT RULE S1011 · no path assoluti nei file versionati · single-writer register · I1-I21 dove pertinenti.

## 8. Piano di test (accettazione della skill)

1. Invocazione nuda → `status` con staleness reale misurata (confronto manuale a campione).
2. `query` sulle 3-5 domande del collaudo S1016 → evidenza corretta in ≤2 tool call ciascuna.
3. `refresh` delta con un layer reso artificialmente stale → ri-sweep del SOLO layer, coverage verde, atlas+grafo rigenerati.
4. `dossier` dry-run su una serie esistente → blocchi register byte-compatibili col formato canonico, `handoff_lint.py` verde.
5. Frontiere: 3 frasi-esca ("trova i bug", "chiudi la sessione", "fai la due diligence") NON attivano la skill.
6. LEARNINGS: dopo i test 1-4 esiste ≥1 run-record completo e un adattamento simulato è reversibile azzerando `adaptive:`.

## 9. Effort e rischi

- **Effort**: ~5-7h in 2 tranche — T1 core (SKILL.md + references + config, ~3-4h), T2 test di accettazione + bootstrap LEARNINGS (~2-3h). Regression risk: **basso** (nessun runtime di prodotto toccato).
- **Rischi residui e mitigazioni**: mis-trigger (description con frontiere, test #5) · costo full-sweep (doppio gate + /goal) · drift prompt (planner runtime + coverage check) · doppia fonte di stato (atlas dichiarato derived-view; conteggi→SOT_STATE) · curated stale accanto ad atlas fresco (pre-check staleness nel modo dossier + marcatura data nel curated).
