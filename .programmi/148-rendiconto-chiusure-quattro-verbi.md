# 148 — Il rendiconto delle chiusure: leggerlo, e decidere se la chiusura va riscritta in quattro verbi

> **item**: #148
> **stato**: NON AVVIATO
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

- [ ] **F1 Misurare quanto copre il diario oggi** — quanti giorni, quante chiusure, quanti passi. ⚠ Il diario è **per-macchina e gitignored**: quello di questa macchina non è tutto ciò che è successo. Se la copertura è ancora parziale, si dice e si sposta la data — **non si decide su dati che non ci sono**, che è l'errore che questo gate esisteva per impedire. **fatto =** copertura misurata, e o si prosegue o si ri-fissa la data con la ragione
- [ ] **F2 Leggere il rendiconto** — `bash scripts/close-log.sh report`. Le domande: quali passi si saltano davvero e perché · quali si eseguono sempre · se i quattro verbi proposti descrivono ciò che accade o ciò che si immaginava accadesse. **Indicazione già disponibile** (S1057, da confermare): 78 `eseguito`, **27 `saltato`**, 1 `fallito`, 5 `ignoto`, 3 `fatto`; i più battuti `propaga` (24), `deploy` (23), `clone-db` (19), `arma` (16)
- [ ] **F3 Registrare la decisione, quale che sia** — «riscrivere» o «non riscrivere», con il motivo, **dentro la voce**. Un «non riscrivere» motivato chiude la voce esattamente come un «riscrivere»: è la decisione a mancare, non una delle due risposte

## Chiuso quando

Il rendiconto è stato letto e la decisione (riscrivere / non riscrivere) è **registrata nella voce**.
