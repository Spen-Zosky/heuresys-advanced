# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-13 (S1057).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1057)

Batch su mandato di Enzo — «costruisci la pagina del clima aggregata a #126, poi sfoltisci
il più possibile, governato dal guardiano» — chiuso a **otto voci**, con un filo che si è
ripetuto fino a diventare il tema della sessione: **quasi ogni voce descriveva qualcosa di
diverso da ciò che il dato diceva davvero**.

La decisione sui sondaggi di clima sembrava aprire una funzione nuova e ne ha scoperta una
**rotta**: nessuna persona poteva rivedere nessuna delle proprie risposte. Le tabelle che
credevo fossero il clima erano un **doppione fermo**, mentre il clima vero stava altrove. Le
nomine del lab erano già entrate nel dato, per un'altra strada. La plancia era già stata
promossa. Un ramo «da decidere» era già deciso. Un seed «da rendere idempotente» non era da
riscrivere: era **superato**, e rieseguirlo avrebbe riportato indietro l'organigramma.

**Il metodo che ha retto, e che è costato tre volte**: le prove viste fallire. Tre volte una
mia prova era **incapace di fallire** — un confine provato contando righe invece che
identità, un 404 che arrivava dalla validazione invece che dalla guardia, e per tre volte un
exit code letto attraverso una pipe. Ogni volta l'ha detto un sabotaggio, non io.

**Il guardiano stesso aveva un difetto**: autorizzava lavori che sfondavano la soglia che lui
impone. Corretto anche nella copia a livello utente, dove sbagliava in ogni progetto.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **Non resta più nulla di breve.** Misurato sul menu rigenerato a fine sessione: ogni voce
   ancora aperta è da una sessione in su — **#123** organigramma-bis (~1), **#50** knowledge
   graph legacy (~2-3), **#92** ciclo di valutazione (~2-3, restano i passi 4-7), **#142**
   cruscotti per tipologia (~3-4), **#143** la squadra come progetto (~4-6), **#54**
   recruiting (~5-7), **#99** domini (~6-8). Aprirne una significa impegnare la sessione a
   quella, non sfoltire.
2. **#159 ha il bersaglio cresciuto** per direzione di Enzo del 2026-08-13: non è più «il
   ponte più una seconda pagina» ma il ponte **più il criterio di idoneità più l'adozione su
   tutte le pagine che lo soddisfano**. Va ristimata prima di aprirla.
3. **Le tabelle ancora scoperte** del cancello di #117 (conteggio in SOT_STATE). Finché la
   classificazione non è chiusa, il cancello **non è agganciato** a `db_health.py`: un rosso
   a riposo insegna a non guardare i rossi.

## Open questions

- **La famiglia `sys_engagement_*` è residuo: si bonifica?** Sei sondaggi in inglese, tutti
  chiusi, l'ultimo del gennaio 2025, che nessuna rotta legge — mentre il clima vero vive in
  `sys_surveys`. L'istruttoria è fatta: **quattro migration** lo toccano (`000077`, `000097`,
  `000113`, `000186`), quindi il ritiro si misura in file da emendare (ADR-0035: ritirare non
  è cancellare). **Non eseguito perché distruttivo** — la decisione è tua.
- **Due responsabili di vertice sono inquadrati QD4 e non Dirigenti** (`matteo.lombardi`,
  Internal Audit; `sara.gallo`, Marketing). Reggono l'unità, quindi la nomina c'è; è
  l'inquadramento a non seguirla — lo stesso caso che #118 ha risolto un gradino più in basso.
- **I due rami `gov/w1-recuperato` e `gov/w2-recuperato` esistono ancora in locale.**
  Cancellarli è sicuro (i tag `archivio/*` li conservano, verificato) ma è distruttivo.

## Verification

```bash
python docs/kb/tools/session_start.py                        # menu + salute, un giro
python docs/kb/tools/guardiano.py --sorveglia                # contesto + finestra 5h (regola OR)
python docs/kb/tools/check_completezza_self.py               # completezza di `self` (C4/I17)
python docs/kb/tools/check_exposure.py                       # cancello di esposizione
python docs/kb/tools/check_no_legacy_ingest.py               # il rubinetto brownfield e' chiuso (ADR-0038)
sh scripts/hooks/hook.sh selftest                            # guardia di sessione
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'   # prova generale
```
