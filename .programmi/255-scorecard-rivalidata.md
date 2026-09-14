# 255 — La scorecard di due diligence è ferma al 17 giugno: rivalidarla su HEAD e aggiornare i tre documenti

> **item**: #255 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: NON AVVIATO
> **nasce-da**: censimento Cowork del 2026-09-14 (perdita n. 2 del canale). La rivalidazione dell'8 settembre vive fuori repo (`Claude Desktop\heuresys-advanced\sessioni\session_2026-09-08_dottrina-perimetri-agente\`).

## Il fatto

`docs/due-diligence/SCORECARD.md`, `EXECUTIVE_SUMMARY.md` e `REPORT.md` portano HEAD `ce26608` e data **2026-06-17**; il file più recente della cartella è `workstreams/WS-T6.md` del 25 luglio. Chi apre oggi quei documenti legge una fotografia di tre mesi fa.

## Decisioni già prese (non si ri-chiedono)

- **Il 58/100 NO-GO dell'8 settembre non si copia** nei documenti: è una misura datata, citata come precedente e ordine di grandezza atteso. La voce **rifà** la misura su HEAD.
- Lo strumento è la skill `saas-investor-due-diligence` (`~/.claude/skills/`, fuori repo). **Le correzioni alla skill sono di Cowork con Enzo** (A6 del mandato S1101): questa voce la usa com'è, e se la trova rotta lo scrive nella cronaca invece di ripararla.
- Il verdetto è quello misurato, **qualunque sia**.

## Fasi

- [ ] **F1 — Rivalidare i 16 pilastri su HEAD** — un `WS-*.md` per pilastro aggiornato con HEAD, data e le evidenze (comando + output), pesi invariati salvo ragione scritta. **fatto =** ogni score della scorecard nuova ha un ancoraggio in un `WS-*.md` con data ≥ quella della sessione.
- [ ] **F2 — Riscrivere i tre documenti** — `SCORECARD.md`, `EXECUTIVE_SUMMARY.md`, `REPORT.md` con HEAD e data nuovi; il precedente del 17 giugno resta leggibile in `docs/archive/` o come sezione storica datata. **fatto =** `grep -n "2026-06-17" docs/due-diligence/{SCORECARD,EXECUTIVE_SUMMARY,REPORT}.md` trova solo la citazione storica.
- [ ] **F3 — Il confronto con l'8 settembre** — una riga per pilastro: giugno · settembre (fuori repo) · oggi, con la ragione di ogni scarto sopra 10 punti. **fatto =** la tabella è nel REPORT e nessuno scarto è senza ragione.

## Cronaca
