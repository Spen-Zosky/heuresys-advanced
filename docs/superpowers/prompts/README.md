# Mandati — prompt consegnati a Claude Code CLI

Questa cartella conserva i **mandati**: il testo esatto consegnato a Claude Code CLI
all'inizio di un ciclo di lavoro. E' il gemello di `../specs/`, che conserva i **referti**
prodotti da quei cicli.

## Perche' esiste

Fino al 2026-08-07 i mandati vivevano fuori dal repository, in una cartella di lavoro
locale. Chi leggeva un referto non poteva risalire a cosa fosse stato effettivamente
chiesto: se una scelta di CLI fosse iniziativa propria o vincolo ricevuto restava
indecidibile. Un referto senza il suo mandato e' meta' documento.

## Convenzione

- Nome file: `YYYY-MM-DD-<slug>.md`, stessa forma di `../specs/`.
- Ogni mandato dichiara in testa quale referto ha prodotto, con il path relativo.
- Ogni referto in `../specs/` dovrebbe poter essere ricondotto al mandato che lo origina.
- I mandati sono **immutabili**: si conservano come sono stati consegnati, errori
  compresi. Se un mandato conteneva un numero atteso sbagliato, quel numero resta:
  e' esattamente cio' che spiega perche' il referto segnala una divergenza.

## Nota sul protocollo di scambio

`cowork_code_exchange/` e' archivio storico read-only dal 2026-05-27 (S939): non e'
questo il suo successore. Quel protocollo prevedeva cinque passi su file
(PROMPT/PLAN/EXEC/REPORT/REVIEW) perche' CLI lavorava in autonomia e serviva un freno
su file. Oggi CLI lavora in sessione interattiva e il freno e' Enzo, che approva il
piano a voce. Qui si conserva solo il mandato: nessun protocollo, nessuna cerimonia.
