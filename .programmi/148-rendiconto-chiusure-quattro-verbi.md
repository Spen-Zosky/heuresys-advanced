# 148 — Il rendiconto delle chiusure: leggerlo, e decidere se la chiusura va riscritta in quattro verbi

> **item**: #148
> **stato**: CHIUSO
> **chiuso**: S1080 (2026-08-25) — decisione registrata: non si riscrive
> **sbloccata**: S1079 (2026-08-24) — il blocco era «⛔ `GATED` **fino al 2026-08-20**», cioè una
> **data**, non un ostacolo. È passata da quattro giorni. Nessuno strumento poteva accorgersene:
> un gate che scade col tempo non produce alcun diff, e il cancello locale guarda solo il diff.
> Il menu mostrava «⛔ ?» perché la ragione del gate non sta in un campo che il generatore legge.

## Cosa si decide

Se la chiusura di sessione vada riscritta nei quattro verbi `registra · verifica · pubblica ·
propaga`. In S1046 la riscrittura fu **rinviata di proposito**, e per una ragione onesta: la
statistica che la giustificava **non reggeva** — 148 commit «handoff S» su 108 sessioni mescolano
correzioni da un minuto (`S954`) e riprese, quindi non misuravano ciò che sembravano misurare.

Il gate serviva a **raccogliere dati veri** dal diario `.handoff/close-log.ndjson`, che allora
copriva 7 giorni su 14.

## Fasi

- [x] **F1 Misurare quanto copre il diario oggi** — FATTO 2026-08-25 · **435 passi, dal 2026-08-06 al 2026-08-24 = 19 giorni** (quando la voce fu rinviata copriva 7 giorni su 14). Copertura sufficiente: si prosegue, la data non si sposta. ⚠ Resta vero che il diario è per-macchina e gitignored: questi sono i passi di *questa* macchina
- [x] **F2 Leggere il rendiconto** — FATTO 2026-08-25 · `bash scripts/close-log.sh report` + misure diritte sul file. **L'indicazione S1057 era da confermare e va corretta**: non 78/27/1/5/3 ma — su tutti i 435 passi — **316 `eseguito` · 81 `saltato` · 18 `ignoto` · 13 `fallito` · 6 `fatto` · 1 `ci-rilanciata``**. I passi per frequenza: `deploy` 70 · `propaga` 65 · `arma` 61 · `clone-db` 60 · `apertura` 60 · `verifica-deploy` 41 · `verifica` 27 · `registra` 26 · `pubblica` 21 · `marciume` 2 · `chiusura` 2. **Due reperti, ed entrambi contano più della rinomina** — sotto
- [x] **F3 Registrare la decisione** — FATTO 2026-08-25 · **NON SI RISCRIVE in quattro verbi.** Motivo misurato, sotto

## La decisione: non si riscrive, e il perché è nei numeri

I quattro verbi proposti erano `registra · verifica · pubblica · propaga`. **Non descrivono ciò
che accade.**

La chiusura reale è dominata dal **rilascio**: `deploy` (70) + `arma` (61) + `clone-db` (60) +
`verifica-deploy` (41) = **232 passi**, contro i **74** di `registra`+`verifica`+`pubblica` messi
insieme. Nei quattro verbi il rilascio non ha un nome suo: finirebbe schiacciato dentro `propaga`,
che è già il verbo più ambiguo dei quattro. Rinominare così **nasconderebbe** la metà più pesante
del lavoro invece di descriverla.

È lo stesso errore che fece rinviare la decisione in S1046, in forma nuova: allora la statistica
mescolava cose diverse sotto una stessa etichetta, e non misurava ciò che sembrava misurare. Una
tassonomia che comprime 232 passi in un verbo e ne dà tre a 74 fa esattamente quello.

**Il verbo che mancherebbe è `rilascia`** — e questo dice che il problema non era il numero dei
verbi ma quali. Non lo introduco: nessuno l'ha chiesto, e la voce chiedeva di decidere sui
quattro, non di progettarne cinque. Se un giorno la chiusura andrà riscritta, si parte da qui.

## I due reperti che valgono più della rinomina

**① 60 `apertura` contro 2 `chiusura`.** Per quasi tutta la vita del diario una corsa **non
registrava il proprio completamento**: impossibile distinguere una chiusura finita da una
abbandonata. Il passo `chiusura` compare **2 volte in 435**, entrambe del 24 agosto — è stato
introdotto ieri, insieme a `marciume`. È la correzione che permette al boot di oggi di dire «2
chiusure interrotte»: prima quel dato non esisteva.

**② 127 corse su 169 hanno un solo passo.** Sono aperture che non hanno fatto nulla — otto di fila
il 24 agosto fra le 19:56 e le 19:58, a tre secondi l'una dall'altra, tutte sullo stesso commit.
Chi conta le «corse» del diario per misurare le chiusure sbaglia di un fattore quattro. ⚠ Nominato
qui una volta sola: **non entra in «cosa resta»** di questa voce, che chiedeva una decisione sui
verbi e l'ha avuta.

## Chiuso quando

Il rendiconto è stato letto e la decisione (riscrivere / non riscrivere) è **registrata nella voce**.
