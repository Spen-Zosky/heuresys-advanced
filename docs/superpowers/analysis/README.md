# Analisi — documenti prodotti da Cowork

Questa cartella conserva le **indagini e gli inventari prodotti da Cowork** (Claude Opus,
sessioni interattive con Enzo) su questo repository: ricognizioni, misure preliminari,
valutazioni di opzioni architetturali.

E' la quarta sorella del ciclo di lavoro:

| cartella | chi produce | cosa contiene |
|---|---|---|
| `analysis/` | Cowork | indagini, inventari, valutazioni **preliminari** |
| `prompts/` | Cowork | i mandati consegnati a CLI |
| `plans/` · `specs/` | Claude Code CLI | piani ed esiti misurati sulla macchina |

## Gerarchia di autorita' — leggere prima di citare

1. **`docs/kb/`** e' la fonte di verita' viva del progetto, di competenza di CLI.
2. **`../specs/`** contiene misure eseguite sulla macchina, con comandi e output.
3. **`analysis/` viene per ultima.** Questi documenti sono ricognizioni fatte da Cowork
   con accesso parziale: leggono il codice e interrogano il database, ma non possono
   accendere i servizi, eseguire le suite o provare le ipotesi sul campo.

**Cio' che sta qui non prevale mai su un referto.** Dove divergono, vince `specs/`.
Nella pratica e' gia' successo: l'inventario del 2026-08-06 conteneva due letture
sbagliate che il referto dello stesso giorno ha corretto misurando.

## Perche' conservarli comunque

Un mandato in `prompts/` porta numeri e affermazioni. Senza il documento che li ha
prodotti, quelle affermazioni non hanno origine consultabile e nessuno puo' verificare
da dove venissero. Questi file servono a **spiegare perche' un mandato dice cio' che
dice**, non a essere consultati come verita' corrente.

## Convenzione

- Nome file: `YYYY-MM-DD-<slug>.md`, come nelle cartelle sorelle.
- Ogni documento dichiara in testa: cosa e' stato verificato e come, cosa **non** e'
  stato verificato, e quali punti risultano **superati** da referti successivi.
- Le correzioni si aggiungono in coda con la data: non si riscrive il testo originale.
  Un'analisi corretta a posteriori nasconderebbe l'errore invece di documentarlo.
