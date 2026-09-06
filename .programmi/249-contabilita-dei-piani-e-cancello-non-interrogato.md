# 249 — La contabilità dei piani va indietro rispetto ai fatti, e il cancello che lo dice non lo interroga nessuno

> **item**: #249 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: IN CORSO
> **avanzamento**: F1 e F2 eseguite in S1090 (2026-09-06) — il cancello locale di fine turno ha
> rifiutato la chiusura su un `programmi` rosso, e la regola del progetto non ammette il
> «pre-esistente». Resta **F3**, il presidio, che è il bersaglio vero della voce
> **nasce-da**: S1090 (2026-09-06). Enzo chiede *«cosa significa 8 programmi aperti senza
> corsia?»*; la misura risponde che erano **tutti falsi allarmi** — cinque item `DONE` nel
> register con il file-piano rimasto indietro, e tre quaderni di sessione contati come
> programmi. La cura di quegli otto lascia scoperti gli altri dodici. Mandato di Enzo nello
> stesso turno: **tutto ciò che resta fuori dal ciclo va fatto nel prossimo**.

## Il fatto, misurato il 2026-09-06 (S1090)

```bash
python docs/kb/tools/programmi.py --verifica    # exit 1 · 22 difetti su 12 piani
```

⚠ **L'exit code si legge senza pipe.** Con `| tail` il conteggio si vede e l'uscita diventa 0 —
un cancello rosso che sembra verde (memoria `pipe_masks_exit_code`, ri-osservata proprio qui).

Il numero **non si cristallizza in nessun documento**: si ri-deriva con quel comando prima di
cominciare. Il 22 di oggi è evidenza datata, non uno stato del presente.

## Perché conta, e perché non è «pulizia»

Il cancello **esiste, funziona ed esce 1** — e **nessuno lo interroga**: non il boot, non la
chiusura, non la CI. Una deriva che nessuno misura si accumula, e infatti si era accumulata fino
a far comparire otto piani chiusi a ogni avvio fra gli orfani. Un allarme che si accende sempre è
un allarme che si impara a non guardare: è il difetto che `#194` è venuta a togliere.

Il bersaglio vero di questa voce **non sono i 22 difetti**: è il presidio che manca.

## Le due specie di difetto, già viste sul vivo in S1090

| specie | come si presenta | cura |
|---|---|---|
| **stato fuori dal vocabolario** | `RE_STATO` accetta `^> **stato**: [A-Z ]+$` e nient'altro. `IN CORSO (S1086)` o `✅ **CHIUSA** — …` cadono su `?`, e un piano con stato illeggibile vale come **aperto** | lo stato torna nel vocabolario, la cronaca passa a una riga sua |
| **spunta senza evidenza** | `[x]` esige una data e più di 20 caratteri **sulla stessa riga**; una cronaca scritta in fondo al file non la soddisfa | l'evidenza si porta accanto alla spunta, presa da dove già esiste |

## Fasi

- [x] **F1 — Ri-derivare l'elenco, non fidarsi del 22** — **FATTO 2026-09-06 (S1090)**: 22 difetti su 10 piani, classificati per specie con un `sed` sull'uscita del cancello — 15 di stato, 7 di spunta nuda.
  *(testo originale:)* — la prima cosa è ri-eseguire il cancello:
      i piani cambiano a ogni sessione, e l'elenco di oggi non è quello di domani. **fatto =**
      elenco corrente in mano, con la specie di difetto accanto a ciascun file
- [x] **F2 — Allineare la contabilità, uno per uno, solo con evidenza già scritta** — **FATTO 2026-09-06 (S1090)**: `programmi.py --verifica` esce **0** — «50 programma/i, nessun difetto», da 29. Ogni spunta porta l'evidenza che già esisteva nel file o nell'archivio; nessuna inventata. ⭐ Le 7 spunte nude avevano **tutte** l'evidenza sulla riga *successiva*: `RE_FASE` legge solo la prima, e i 20 caratteri minimi tagliavano fuori un `— **FATTO 2026-08-28` da 18. E la ri-misura ha scoperto una contraddizione che nessuno cercava: `#246` era `ACTIVE` nel register e finita in `STATE.md` — misurato in produzione, **160 `permanent`, zero `fixed_term`**: chiusa davvero.
  *(testo originale:)* — ⚠ **una
      spunta si allinea solo se l'evidenza esiste già, datata, nel file o nell'archivio.** Dove il
      lavoro non è dimostrabile la fase **resta vuota** e lo si dichiara: allineare la contabilità
      non è dichiarare fatto ciò che non è stato fatto. In S1090 `#227` aveva le mig `000368`/`000369`,
      `#235` la mig `000366` più la prova live, e `#241` V2 è stata **misurata** (`Test (api
      integration)` verde su main) invece che dedotta. **fatto =** `--verifica` esce **0**, oppure
      ogni piano ancora rosso porta la ragione scritta
- [ ] **F3 — Il presidio, che è il motivo per cui la voce esiste** — il cancello va **interrogato
      da qualcuno**: boot, chiusura o CI. Va scelto dove, con la ragione: il boot lo rende visibile
      ma rumoroso, la chiusura lo lega al momento in cui la deriva nasce (una voce si chiude e il
      piano resta indietro), la CI lo rende inaggirabile. **fatto =** il presidio esiste, ed è
      stato **visto scattare** su un difetto vero

## Le prove che devono poter fallire

- **F2** — il verde va letto **senza pipe**, o non è un verde. E un `--verifica` a 0 ottenuto
  allargando le maglie del parser sarebbe un falso verde: il vocabolario e la regola
  dell'evidenza non si toccano per far tacere il cancello.
- **F3** — un presidio che non si è mai visto rosso non è un presidio. Si introduce un difetto
  finto in un piano di prova e si verifica che il presidio lo fermi davvero, poi lo si toglie.

## Chiuso quando

`--verifica` esce **0** (o ogni residuo porta la sua ragione), e la deriva **non può più
accumularsi in silenzio**, perché qualcuno interroga il cancello a ogni giro.
