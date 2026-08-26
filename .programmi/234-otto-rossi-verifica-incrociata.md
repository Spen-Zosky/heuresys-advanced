# 234 — Gli otto rossi di `verifica_incrociata`: cura o riclassificazione, mai il silenzio

> **item**: #234
> **stato**: APERTO
> **aperto**: S1081 (2026-08-25) — emersi togliendo X9c/X8a/X7a e correggendo il display
> della batteria (mostrava l'ultimo allarme come sintesi; ora mostra la riga ESITO)

## La misura di apertura (2026-08-25 — si RIESEGUE alla presa in carico, mai si ricopia)

`python docs/kb/tools/verifica_incrociata.py` → ESITO: 8 verifiche con difetti.

| check | cosa dice | misura | sospetto |
|---|---|---|---|
| X3b | retribuzione anomala vs pari livello | 5/160 | misura statistica, non incoerenza? |
| X3c | contratto attivo senza busta recente | 2/160 | marciume vero (freschezza storia36?) |
| X4a | requisito di competenza non coperto | 667/1434 | misura di business (i gap ESISTONO — è il territorio di #227) |
| X5d | posizione ricoperta senza requisiti formativi | 8/161 | da capire dal file che crea |
| X6a | OKR su reparto inesistente | 5/9 | marciume vero |
| X6b | KPI assegnato non previsto dalla posizione | 42/78 | misura di copertura? |
| X6c | obiettivo senza titolare | 2/2206 | marciume vero |
| X6d | catalogo KPI copre una frazione delle posizioni | 1 | misura di copertura? |

## Regole

Per ogni firma: **misura → leggi il file che crea l'oggetto → causa → cura o
riclassificazione con la ragione scritta accanto al check**. Una riclassificazione a
`tipo="misura"` corregge lo strumento solo se la ragione regge da sé; una cura ai dati
porta le quattro cose di `db-migrations.md`. Mai spegnere per far tornare verde il cancello.

## Fasi

- [x] **F1 Le probabili riclassificazioni** — **FATTA 2026-08-26 (S1081)**: **tre su quattro**
  riclassificate a `tipo="misura"` con la ragione scritta accanto al check, la quarta
  **deliberatamente NON toccata**. Esito misurato: **da 8 difetti a 5**, misure informative da
  3 a 6.
  - **X3b → misura**: la regola è il **boxplot di Tukey** (1,5 × IQR). In qualunque popolazione
    retributiva reale produce fuori-scala — è il suo scopo. E non può distinguere un dirigente
    legittimamente pagato più dei pari da una RAL digitata male: quella distinzione la fa una
    persona guardando le righe. Zero non è l'atteso, quindi non è un cancello
  - **X4a → misura**: **è lo skill gap**, cioè la funzione centrale del prodotto. Pretendere
    zero significherebbe pretendere un'azienda dove nessuno ha niente da imparare. La curatela
    del catalogo sotto è `#227`
  - **X6d → misura**: **lo diceva già la forma della query** — una riga di riepilogo con dei
    conteggi, prima colonna «misura». Il suo `1` era la riga di riepilogo, non una posizione
  - ⚠ **X6b NON riclassificata, ed è una scelta**: «un obiettivo di KPI su una persona la cui
    posizione non elenca quel KPI». Distinguere un obiettivo individuale legittimo da
    un'assegnazione incoerente richiede una **decisione di prodotto** (il KPI segue la persona
    o l'incarico?) che non si deriva dal codice. Resta `DIFETTO` in F2: non si spegne ciò di
    cui non si è certi
- [ ] **F2 Il marciume vero** — i **cinque** rimasti dopo F1: `X3c` contratto attivo senza busta
  recente (2) · `X5d` posizione senza requisiti formativi (8) · `X6a` OKR su reparto inesistente
  (5) · `X6b` KPI non previsto dalla posizione (42, **serve la decisione di prodotto**) · `X6c`
  obiettivo senza titolare (2). Per ognuna:
  file che crea, causa, cura con guardia/post-condizione/rollback, `ci-rehearsal` se tocca
  `db/**`. **fatto =** conteggio a zero o eccezione dichiarata nel check con data e ragione
- [ ] **F3 La corsa che chiude** — `verifica_incrociata` esce **0 o 4** (cieco dichiarato),
  la batteria del cancello mostra il verde, e una chiusura reale non porta più
  `marciume: fallito`. **fatto =** output allegato della corsa e della chiusura
