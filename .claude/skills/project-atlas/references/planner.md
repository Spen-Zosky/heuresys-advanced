# planner.md — derivazione runtime dei target del sweep (anti-drift)

> I target NON vivono in questa skill. A ogni run si derivano dal repo/DB vivi.
> Un target non derivato = un buco silenzioso nell'atlas: per questo il COVERAGE CHECK e' bloccante.

## 1. PIANO SWEEP (procedura)

Per ogni layer in `atlas.config.yaml → layers` (piu' le `families_static` col probe OK):

1. Esegui il comando `derive` del layer. Esempi attesi (2026-07):
   - api → lista directory moduli (83 a S1016; il numero VERO e' l'output di oggi)
   - web → route groups + count page.tsx
   - db → count tabelle utente live
2. Partiziona i target "code-like" in chunk:
   - `chunk_size = adaptive.chunk_modules_per_agent ?? thresholds.chunk_modules_per_agent`
   - N agenti = ceil(len(targets) / chunk_size)
3. Per ogni chunk/famiglia istanzia il template corrispondente da `sweep-prompts.md`
   riempiendo i segnaposto `{{TARGETS}}`, `{{FRAGMENT_PATH}}`, `{{REPO}}`, `{{ASPETTO}}`,
   `{{LEGACY_TARGET}}`, `{{CURATED_DATE}}`.
4. Frammenti attesi: uno per chunk/famiglia, nello scratchpad di sessione
   (`<scratchpad>/atlas_fragments/<label>.yaml`). Registra la LISTA ATTESA prima di lanciare.
   Convenzione label: api_c1..cN · web_<gruppo> · shared · db_live · ops · legacy_primary ·
   legacy_cantiere · wiki · design_system (esempio storico: docs/kb/tools/atlas-sweep-templates/fragments_s1016/).

## 2. Lancio (sempre via Workflow tool)

- Un solo `parallel()` di tutti i chunk (sono indipendenti); schema di ritorno compatto
  `{fragment_file, counts, notables, summary}` — il dettaglio sta nei frammenti su file.
- Modello/effort per agente: da `model-map.md`. MAI Agent sciolti per il sweep.
- Formato/esempio di script Workflow: docs/kb/tools/atlas-sweep-templates/atlas-full-sweep.workflow.js.
  Se il Workflow tool non e' disponibile nella sessione → STOP e riporta (mai fallback ad Agent sciolti per il sweep).

## 3. COVERAGE CHECK (bloccante, fail-loud)

Dopo il run:

```bash
# lista attesa (dal piano) vs frammenti prodotti
ls <scratchpad>/atlas_fragments/*.yaml
```

- Ogni frammento atteso e assente ⇒ **ERRORE dichiarato** (mai "atlas fresco ma bucato").
- Retry MIRATO: rilancia solo gli agenti dei frammenti mancanti (1 retry; poi riporta il buco a Enzo).
- Verifica interna per layer api/web: somma dei moduli/pagine nei frammenti == count derivato al punto 1.
  Mismatch ⇒ stesso trattamento.

## 4. A valle del sweep (SEMPRE accoppiati)

```bash
python docs/kb/tools/build_atlas.py          # atlas deterministico (2 run: il 2o prova l'idempotenza)
# poi vista parallela:
#   invoca la skill graphify con `--update` sulla repo root
python docs/kb/tools/handoff_lint.py         # exit 0
```

## 5. Delta vs full

- **Delta (default)**: solo i layer con `staleness_probe` > 0 dalla PIU' RECENTE tra: timestamp
  dell'ultimo run-record (LEARNINGS.md) e data in testa ad ATLAS_CURATED.md.
- **Full**: SOLO su richiesta esplicita + conferma R20 + /goal (vedi goal-recipes.md).
