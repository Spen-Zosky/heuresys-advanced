# 255 — La scorecard di due diligence è ferma al 17 giugno: rivalidarla su HEAD e aggiornare i tre documenti

> **item**: #255 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: CHIUSO
> **nasce-da**: censimento Cowork del 2026-09-14 (perdita n. 2 del canale). La rivalidazione dell'8 settembre vive fuori repo (`Claude Desktop\heuresys-advanced\sessioni\session_2026-09-08_dottrina-perimetri-agente\`).

## Il fatto

`docs/due-diligence/SCORECARD.md`, `EXECUTIVE_SUMMARY.md` e `REPORT.md` portano HEAD `ce26608` e data **2026-06-17**; il file più recente della cartella è `workstreams/WS-T6.md` del 25 luglio. Chi apre oggi quei documenti legge una fotografia di tre mesi fa.

## Decisioni già prese (non si ri-chiedono)

- **Il 58/100 NO-GO dell'8 settembre non si copia** nei documenti: è una misura datata, citata come precedente e ordine di grandezza atteso. La voce **rifà** la misura su HEAD.
- Lo strumento è la skill `saas-investor-due-diligence` (`~/.claude/skills/`, fuori repo). **Le correzioni alla skill sono di Cowork con Enzo** (A6 del mandato S1101): questa voce la usa com'è, e se la trova rotta lo scrive nella cronaca invece di ripararla.
- Il verdetto è quello misurato, **qualunque sia**.

## Fasi

- [x] **F1 — Rivalidare i 16 pilastri su HEAD** — FATTO 2026-09-28 · 5 analisti indipendenti (P1-P4, T1-T4, T5-T7, T8-T9, X1-X3), ogni `WS-*.md` riscritto con HEAD `5faa2bc2`, data odierna, evidenza comando+output.
- [x] **F2 — Riscrivere i tre documenti** — FATTO 2026-09-28 · `SCORECARD.md`, `EXECUTIVE_SUMMARY.md`, `REPORT.md` riscritti con HEAD/data nuovi; il precedente del 17/6 resta leggibile in `SCORECARD.md` §Storico. Verificato: `grep -n "2026-06-17" docs/due-diligence/{SCORECARD,EXECUTIVE_SUMMARY,REPORT}.md` → 0 righe (nessun formato data storico letterale usato, solo prosa "17 giugno").
- [x] **F3 — Il confronto con l'8 settembre** — FATTO 2026-09-28 · tabella in `REPORT.md` §11: colonna giugno/oggi misurata per tutti e 16 i pilastri, colonna 8-settembre limitata all'aggregato (58/100, dichiarato non ri-derivabile da questo repo) con nota di onestà metodologica esplicita. Due scarti >10 punti (T3 +14, T8 +17), entrambi con ragione scritta.

## Cronaca
