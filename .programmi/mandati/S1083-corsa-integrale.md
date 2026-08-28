# S1083 — Mandato di corsa integrale (Enzo, 2026-08-28)

> **Il mandato, testuale**: «risolvi i quattro rossi e 5 programmi aperti senza voce nel
> register. poi inizia le corse di ciascuna azione elencata in P1, P2 e P3, secondo ordine e
> priorità che ritieni più opportuni. Non fermarti a chiedermi decisioni o consensi (prendile
> tu per me) e procedi automaticamente ed autonomamente tenendo come unico blocco l'eventuale
> raggiungimento/superamento della capienza.»

**Confine di sessione dichiarato all'inizio (R24 §4)**: questa sessione **non chiude** le voci
P1/P2/P3 — il mandato dice *«inizia le corse»*. Ogni voce avanza di almeno una fase con
evidenza live; l'unico arresto ammesso è il guardiano (contesto ≥ 75% **o** finestra 5h ≥ 80%).

**Regola di decisione**: ogni decisione tecnica la prendo io e la scrivo qui. A Enzo non si
chiede nulla. Le decisioni prese sono elencate in coda, numerate `D-S1083-nn`.

---

## Blocco A — i quattro rossi della dashboard + l'eredità

| id | cosa | come si chiude | stato |
|---|---|---|---|
| A1 | derivati 2/3 superati | `build_derivati.py` verde | ✅ FATTO |
| A2 | migrazioni: disco 355 vs applicate 356 | ledger e disco combaciano | ✅ FATTO — mig `000359` |
| A3 | i18n: 2 campi con gap EN | vista di copertura a 0 | ✅ FATTO — mig `000360` |
| A4 | chiusura S1082 `marciume:fallito` | causa nominata, cancello verde o riclassificato | ✅ FATTO — `#234` F2 |
| A5 | 2 corse di chiusura interrotte del 24/08 | rendiconto senza corse orfane | ✅ FATTO |

## Blocco B — i 5 programmi aperti senza voce nel register

| id | programma | esito | stato |
|---|---|---|---|
| B1 | `224-check-non-deterministico-fuso.md` | ✅ già eseguito → archiviato | ✅ FATTO |
| B2 | `225-claude-md-affermazioni-scadute.md` | ✅ già eseguito → archiviato | ✅ FATTO |
| B3 | `226-storia-rtl-scorrevole.md` | ✅ già eseguito → archiviato | ✅ FATTO |
| B4 | `231-consumo-lavori-attivi.md` (7/10) | ✅ è il mandato S1082, concluso → archiviato | ✅ FATTO |
| B5 | `D86-D87-i-due-cancelli-della-chiusura.md` | ✅ entrambi i cancelli esistono → archiviato | ✅ FATTO |

## Blocco C — le corse P1/P2/P3

**Ordine deciso (D-S1083-01)**: prima le voci a una fase dalla chiusura (rapporto
valore/costo più alto e lista che si accorcia), poi quelle a metà, infine le grandi.

| # | voce | fasi | prossima fase | stato |
|---|---|---|---|---|
| C1 | `#219` otto guasti suite E2E | 4/5 | F5 la corsa che chiude la voce | ⏳ |
| C2 | `#234` otto rossi verifica_incrociata | 1/3 | F2 il marciume vero | ⏳ |
| C3 | `#214` adozione agente perimetri | 6/7 | F6 consumo della coda | ⏳ |
| C4 | `#198` Tenant Builder P3 | 9/10 | T9b costruzione in produzione | ⏳ |
| C5 | `#132` Tenant Builder P2a | 7/8 | F7 le due prove | ⏳ |
| C6 | `#169` due segreti | 2/4 | F3 il segreto non è più derivato | ⏳ |
| C7 | `#227` competenze isolate | 1/5 | F2 le derivabili | ⏳ |
| C8 | `#149` consegne lab non verificate | 3/4 | F4 la prossima consegna | ⏳ |
| C9 | `#79` cancello di esposizione | 2/3 | F3 il prossimo lavoro che popola | ⏳ |
| C10 | `#50` grafo competenze | 1/3 | F2 il grafo dai dati che abbiamo | ⏳ |
| C11 | `#159` ponte gateway↔pagine | 1/4 | F2 il ponte | ⏳ |
| C12 | `#143` squadra come progetto | 1/5 | F2 modello dati | ⏳ |
| C13 | `#54` recruiting/ATS | 1/4 | F2 modello dati | ⏳ |
| C14 | `#205` Tenant Builder 2b/2c | 0/3 | ⛔ GATED su `#132` | ⏳ |

---

## Registro delle decisioni prese al posto di Enzo

- **D-S1083-01** — ordine di C: chiusura-vicina prima. Motivo: R24 §5 («la lista si accorcia»)
  e il mandato dice *iniziare* le corse, non chiuderle tutte: massimizzo le voci che
  cambiano stato.
- **D-S1083-02** — il ledger di produzione nomina `000358_…_eredita_dai_pari_della_sua_unita.sql`,
  un file **che non esiste in nessun posto**: né su Windows, né sul gemello, né sulla VM, né in
  git (`git log --all -S` muto), né come oggetto orfano nel DB (31 viste e 16 funzioni `sys.*`
  hanno tutte il loro file). Prova generale sul gemello con i soli 355 file: **VERDE, 26/26
  sentinelle a zero**. → La riga è un **residuo di un'applicazione mai committata** e si
  **rimuove**, con giornale di annullamento. Non si inventa un file per giustificarla: sarebbe
  scrivere codice che nessuno ha mai eseguito.
- **D-S1083-03** — i 17 `sys_skills` che contengono «collaudo» sono competenze **ESCO
  legittime** (testing) e i 3 utenti `@collaudo.invalid` sono le **personas deliberate** del
  2026-08-25: entrambi **falsi positivi**, restano. Stesso criterio di S1042.
- **D-S1083-04** — numeri `000358` bruciato (come `000035` e `000139`, già saltati nella
  catena): le nuove migrazioni sono `000359` e `000360`.
