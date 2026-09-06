# 234 — Gli otto rossi di `verifica_incrociata`: cura o riclassificazione, mai il silenzio

> **item**: #234
> **stato**: CHIUSO
> **chiusa**: S1085 (2026-08-30) — 3/3 fasi spuntate, `status: DONE` nel register
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
### Indagine S1081 su due delle cinque (l'indagine è essa stessa un deliverable, R24 §2)

**`X6a` — 5 OKR su un reparto che non esiste, e sono DUE nature diverse.** Misurati (su 17 OKR
totali, tutti con `okr_department` valorizzato):

| reparto dichiarato | obiettivo | natura |
|---|---|---|
| `Supply Chain` | «Achieve 100% supplier traceability» | ⚠ **estraneo al dominio**: una banca non ha una supply chain da tracciare |
| `Sales` | «Increase B2B customer base by 40%» | ⚠ **estraneo**: gergo commerciale generico, non bancario |
| `Digital Banking` | «Launch mobile banking app v3.0» | coerente, ma il nome non combacia |
| `Corporate Banking` | «Increase corporate lending by 20%» | coerente, ma il nome non combacia |
| `Finance` | «Reduce operational costs by 12%» | coerente, ma il nome non combacia |

I primi due odorano di **contaminazione** da un altro dataset (`I21` coerenza di industry, e il
criterio già usato in S1042: «nomina un'entità inesistente»). Gli altri tre sono **disallineamento
di nomi** dopo la ricostruzione dell'organigramma: le unità RTL che li coprono esistono ma si
chiamano `DIV-IT` (Divisione IT & Digital), `DIR-DEV` (Sviluppo Software e Canali Digitali),
`DIR-COORD` (Coordinamento Commerciale) — nessuna si chiama «Finance» o «Corporate Banking».
⚠ **`okr_department` è testo libero**, non una FK: è questa la causa a monte, e finché resta tale
il controllo continuerà ad accendersi a ogni rinomina.

**`X6c` — non sono 2 righe, sono 2 COLONNE mai valorizzate.** `sys_goals.goal_owner_user_id` è
vuoto su **tutte le 2.189 righe**, `sys_okrs.okr_owner_user_id` su tutte le 17. E **il codice le
scrive**: l'`INSERT` di `goals/repository.ts:79` e quello di `okrs/repository.ts:71` le
valorizzano. Quindi non sono colonne morte e non è un difetto del codice applicativo: le righe
esistenti vengono da **seed/import storici** che non le hanno popolate. La cura è un backfill —
ma «chi ha assegnato l'obiettivo» è un dato che nessuna fonte porta, quindi va deciso se
ricostruirlo (dal capo dell'epoca) o dichiarare la colonna vuota per le righe storiche.

- [x] **F2 Il marciume vero** — **SENZA BERSAGLIO, misurato 2026-08-30 (S1085)**: la corsa su produzione da' `0 verifiche con difetti, 7 misure informative, 27 pulite`. I cinque erano gia' stati consumati in S1083; questo file era indietro rispetto ai fatti. *(testo originale:)* — i **cinque** rimasti dopo F1: `X3c` contratto attivo senza busta
  recente (2) · `X5d` posizione senza requisiti formativi (8) · `X6a` OKR su reparto inesistente
  (5) · `X6b` KPI non previsto dalla posizione (42, **serve la decisione di prodotto**) · `X6c`
  obiettivo senza titolare (2). Per ognuna:
  file che crea, causa, cura con guardia/post-condizione/rollback, `ci-rehearsal` se tocca
  `db/**`. **fatto =** conteggio a zero o eccezione dichiarata nel check con data e ragione
- [x] **F3 La corsa che chiude** — **FATTA 2026-08-30 (S1085)**: `verifica_incrociata` exit **4** (cieco dichiarato, uno dei due valori ammessi) e `check_marciume.py` exit **0** — «niente e' marcito». Per arrivarci sono caduti tre falsi rossi: due da **tunnel degradato** (74 s per una query banale, 1,48 s dopo averlo ricreato) e uno da **atlante superato** dai cambiamenti di #235.
  la batteria del cancello mostra il verde, e una chiusura reale non porta più
  `marciume: fallito`. **fatto =** output allegato della corsa e della chiusura
