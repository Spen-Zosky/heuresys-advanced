# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-13 (S1055).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1055)

Batch su mandato di Enzo — «#183 + #124 + tutto P2» — chiuso a **sei voci**, con un filo che
le lega e che vale più del conteggio: **quasi ogni voce descriveva un difetto diverso da
quello reale, e quasi sempre più piccolo**. Il piano è stato smentito dalla misura sei volte
su sei, e ogni volta prima di eseguire, non dopo.

**#183** doveva aggiungere una cancellazione che già esisteva; il difetto vero era un
registro GDPR **cieco su buona parte delle tabelle di appartenenza**, quindi ferie, obiettivi,
sondaggi e squadre non entravano nel fascicolo dell'art. 15 né venivano toccati da una cancellazione —
e il controllo anti-drift **non poteva accorgersene**, perché guardava solo le tabelle col
prefisso `sys_user_`. **#124** dava per «il pezzo più grosso» un lavoro che misura zero: il
volume vero erano **due fughe aritmetiche mai nominate**, uno scatter dove ogni punto è la
retribuzione di una persona (280 posizioni su 299 hanno un solo titolare) e un indice dove il
punteggio individuale si ricava invertendo la media. **#148** chiedeva di rileggere un
rendiconto che non era leggibile: 84 righe su 96 non dicevano di quale chiusura parlassero.
**#170** parlava di tre file, erano trentanove — e il timer che sembrava morto era **vivo e
abilitato sulla VM**. **#127** dava per intoccabili sette migrazioni che invece si
ri-applicano a ogni deploy, e il suo unico caso aperto era **un falso positivo della verifica**,
non un difetto del dato: quella persona una squadra la guida.

**Il metodo che ha retto**: prova generale prima della produzione (rossa **tre volte**, ogni
volta su un difetto vero, incluso uno mio), e ogni prova nuova **vista fallire** con un
difetto iniettato prima di essere creduta.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **Le dieci voci P2 non ancora fatte** del batch — piano-file vivo in
   `docs/superpowers/plans/2026-08-12-batch-p1-p2-s1055.md`, con lo stato riga per riga e le
   misure già raccolte per #147 e #159. **#121 e #128 toccano lo stesso file**
   (`scripts/hooks/session_mode.py`): vanno in fila, mai in parallelo.
2. **#147** — la chiave madre **è già propagata** (impronta identica sui tre computer dal
   26 luglio: il register era stantio). Il residuo vero misurato sono le **email di persone
   scritte a mano nei file di test di scope** (conteggi in `SOT_STATE`), con gli helper già
   pronti che le derivano dal database.
3. **#54 recruiting** resta fuori portata di una sessione singola (5-7): va tagliata a fasi
   prima di entrare in un batch.
4. Due voci aspettano **solo te** — vedi Open questions.

## Open questions

- ~~**#135**~~ — **RISOLTA (Enzo, 2026-08-13): Heuresys è consulenza direzionale.** E il dato
  già lo diceva: la contraddizione citata dalla voce era stata riparata da #144 e nessuno
  l'aveva aggiornata. Resta solo lavoro mio — quel campo non ha vincoli, quindi le due
  dichiarazioni concordano per fortuna e non per costruzione.
- ~~**#159**~~ — **RISOLTA, e il bersaglio è cresciuto**: l'assistente va in **tutte le schede
  idonee**, non in una seconda pagina. Serve quindi definire cosa rende una scheda idonea. La
  pagina della dimostrazione la sceglie Claude: **la scheda di una persona**, perché è dove i
  permessi mordono di più e una falla si vedrebbe lì per prima.
- **#182** — i due rami recuperati (473 righe mai in main): istruire e portare in main, o
  archiviare dichiarandolo?
- **Il ruolo di database `gov_worker`**: si revoca o resta?

## Verification

```bash
python docs/kb/tools/session_start.py                        # menu + salute, un giro
python docs/kb/tools/verify_gate.py check                    # cancello di fine turno
bash scripts/close-log.sh report                             # rendiconto chiusure, ora leggibile
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'   # prova generale, ~26s
cd apps/api && pnpm exec tsx scripts/prova-live-183.mts https://www.heuresys.com/api
```
