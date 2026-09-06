# S1089 — piano di sessione

> **mandato di Enzo**: «esegui 3, 4 e la rivalutazione di `#169`».
> **confine dichiarato all'inizio**: il guardiano al via misura contesto **60,2 %**, residuo
> **147.522 token** alla soglia. Le tre voci ci stanno con margine; **non** si apre nient'altro,
> e in particolare non `#143`/`#159`/`#54`, che a questo residuo si lascerebbero a metà.
> **ordine**: costo crescente, così se il margine si stringe ciò che resta fuori è il più grande
> e non il più piccolo.

## Tabella dei deliverable

| id | cosa | chi | fatto significa | stato |
|---|---|---|---|---|
| A | **`#169`** — il blocco su `#219` è caduto davvero? | io | verdetto scritto: sbloccata, oppure il gate ha una ragione **nuova** e la si nomina | ⬜ |
| B | **`#246` F4** — la quota di contratti a termine diventa un numero che qualcuno guarda | io | il numero è esposto dove qualcuno lo vede, e la sua fonte è una query non un valore scritto | ⬜ |
| C | **`#219`** — il passaggio in CI | io | scelta una delle tre strade, motivata dai numeri, ed eseguita; oppure dichiarato perché nessuna è percorribile oggi | ⬜ |

## Simulazione — le cinque domande

**A — `#169`.** *Precondizioni*: la suite dev'essere misurabile, ed è la condizione che il gate
nomina — oggi 369 passati e 0 falliti. *Meccanismo*: leggere il testo del gate e le fasi F3/F4
di `#169`, non ricordarle. *Propagazione*: se cade, l'item cambia status nel register e rientra
nel menu. *Chi*: io. *Guardia*: il gate va riletto **per intero** — se F3 «rompe la suite», il
fatto che la suite sia verde oggi non basta: bisogna vedere *cosa* romperebbe.

**B — `#246` F4.** *Precondizioni*: i dati sono bonificati (0 a termine) e due sentinelle
presidiano. *Meccanismo*: il numero non si scrive, si **deriva** — ⭐ IL PUNTO FISSO. *Propagazione*:
se è una vista, entra da sé in `db_health` e dev'essere **informativa**, o renderà rossa la prova
generale (memoria `new_sys_view_becomes_sentinel`). *Chi*: io. *Guardia*: una vista che *misura*
non è una sentinella; va dichiarata tale o resta fuori dalla batteria.

**C — `#219` CI.** *Precondizioni*: i tre ostacoli sono già misurati (solo smoke · tetto 30 min ·
`heuresys_ci` senza i dati). *Meccanismo*: la scelta fra le tre strade è **tecnica** e la prendo io,
ma dev'essere motivata da numeri, non da preferenza. *Propagazione*: tocca `.github/workflows/`,
quindi la prova è un giro di CI vero — non basta che il file sia scritto bene. *Chi*: io.
*Guardia*: portare in CI una suite che lì produce rossi non-guasti sarebbe **reintrodurre** il
difetto che `#219` esiste per togliere: se nessuna strada regge oggi, si dichiara invece di forzare.

## Registro delle scoperte fuori ciclo

*(si presentano una volta sola a fine sessione; non entrano in «cosa resta»)*
