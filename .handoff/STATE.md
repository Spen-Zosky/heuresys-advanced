# STATE — vista rapida

*Ultimo aggiornamento: S1101 (2026-09-14, sera — due mandati). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Due mandati di Cowork nella stessa sera (`.programmi/S1101-…` e `S1101b-…`, entrambi CHIUSI). **Primo**: il canale
`COWORK_INBOX.md` era fermo dall'8 agosto; ora è dichiarato in un punto solo del `CLAUDE.md`, ha una sentinella
nella dashboard di avvio (`check_canale_cowork.py`), e le cinque decisioni perse hanno un posto — **ADR-0040**
(l'agente legge ciò che legge la persona; freno sull'uso, in persone distinte), `#214` in HOLD, `#251`-`#254`
(freno e apertura), `#255` scorecard, `#256` cancello fra clienti (M5 era già fatta), `#257` chi ripara e chi
popola (adottato). **Secondo**: il contratto condiviso è esaustivo; 13 rotte dichiarano la risposta, 4 form
derivano i limiti dal contratto, e `/me/career/target` perdeva dati in silenzio — corretto. Scoperto misurando:
i test che entrano come Enzo non possono più farlo (`#250` gli ha dato il suo secondo fattore) → **`#258`**, P1.

## Top priorities

1. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): al prossimo rinfresco del clone il
   cancello locale `test-api` diventa rosso su ogni tocco ad `apps/api/`. Prima di tutto il resto.
2. **`#251` — il contatore di persone distinte** (~1 sessione): l'unico pezzo nuovo del freno; F1 sceglie quale
   delle tre misure genera le soglie (`docs/kb/xtras/soglie-agente-persone-distinte.sql`). `#252` subito dopo.
3. **`#159` F3 — la prima pagina idonea monta `AgentPanel`** (~150k): invariata da S1100.
4. **`#198` — le due scoperte di S1098 prima di T9b**: modello non costruibile (132 competenze senza categoria) e
   R6/R7 di `v_organization_unit_integrity`. Senza, nessuna azienda vera nasce — `#206` T9 aspetta.

▸ Poi: `#253` (diario in tabella) · `#257` (chi ripara e chi popola — adottato da Enzo, registro derivato) · `#255` (scorecard su HEAD) · `#205` F2 (il lettore apre solo HTML) · `#256`
(mezza sessione di misura) · `#76` F3 · `#149` F4 e `#79` F3 (continuativi).

## Open questions

- **La regola globale in `~/.claude/CLAUDE.md`** («se il progetto ha `cowork_code_exchange/`, invoca la skill del
  protocollo») contraddice questo progetto, che ha la cartella congelata. La parte di progetto è fatta (sezione
  «Il canale Cowork ↔ CLI»); **la parte globale è tua**: il testo dovrebbe dire «leggi il canale che il CLAUDE.md
  del progetto dichiara».
- **A6 — le correzioni alla skill `saas-investor-due-diligence`** (`~/.claude/skills/`, fuori repo): affidate a
  Cowork con te, non a una voce del register.
- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY`.
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta (le corse di `#205` girano solo col modello su
  Windows). Vuoi ri-loggare le due macchine?
- **Igiene fuori repo**: `$CLAUDE_SCRATCH` vuoto nella Bash della CLI (log finiti in `C:\Git\` in S1100); i file
  `webapps-*.md` in `~/.claude/sessioni/attive/`; le copie `~/scp-aside-<ts>` su gemello e VM. Mai cancellati senza
  il tuo sì.
- **Cowork non raggiunge più Linux via SSH** dal 2026-09-08: la prova generale delle migrazioni scritte da Cowork la
  fa sempre la CLI.

## Verification

```bash
python docs/kb/tools/session_start.py                        # atteso: #251-#258 nel menu, #214 fra gli HOLD, riga CANALE [OK] 0
python docs/kb/tools/check_canale_cowork.py --selftest       # atteso: selftest verde (7 casi)
python docs/kb/tools/handoff_lint.py                         # atteso: 0 FAIL
python docs/kb/tools/programmi.py --verifica                 # atteso: nessun difetto
python docs/kb/tools/aggiorna_numeri_sot.py --check         # atteso: exit 0 (§0 allineata)
python docs/kb/tools/db_health.py                            # atteso: tutto nei limiti, 50 sentinelle a zero
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f docs/kb/xtras/soglie-agente-persone-distinte.sql   # le tre misure delle soglie (ADR-0040 §3)
bash scripts/verifica-deploy.sh                              # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
