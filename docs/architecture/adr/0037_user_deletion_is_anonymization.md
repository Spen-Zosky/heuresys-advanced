# ADR-0037 — Cancellare una persona significa anonimizzarla; la cancellazione fisica è la revoca di una creazione

**Status**: Accepted (S1055, 2026-08-12)
**Contesto**: `#183` (mandato di Enzo del 2026-08-10) · migrazione `000304` · complemento di `000186` (registro GDPR), `000295` (paternità vs appartenenza) e `000303` (la storia delle approvazioni sopravvive)
**Autorità della decisione**: Claude (decisione tecnica, `feedback_claude_decides_technical`)

## Il fatto, misurato prima di decidere

La voce `#183` dichiarava: *«la disattivazione esiste, la cancellazione no»*, e proponeva di
convertire a `SET NULL + tombstone` le FK che bloccano. **La misura del 2026-08-12 ha smentito
l'inquadramento su tre punti.**

**1. La cancellazione esiste già, ed è completa.** `DELETE /v1/users/:id` disattiva
(`users/routes.ts` → `service.deactivate` → `repository.deactivateUser`, che porta
`user_status` a `DEACTIVATED`); `POST /v1/gdpr/users/:userId/erasure` esegue la cancellazione
vera in **una** transazione, con una guardia che pretende la disattivazione prima
(`409 SUBJECT_STILL_ACTIVE`), una strategia dichiarata per ogni tabella, e
l'**anonimizzazione della riga radice**. Nessuna cancellazione fisica di `sys.sys_users`
esiste nel sorgente dell'API. Ciò che mancava non era il meccanismo: era **la policy scritta**
e il rimedio all'utente creato per errore.

**2. Convertire le FK bloccanti non sbloccherebbe nulla — toglierebbe la sola protezione.**
Misurato: **0 utenti su 161** sono oggi cancellabili fisicamente; ognuno ha almeno
un'assegnazione di posizione. Le 9 `RESTRICT` + 1 `NO ACTION` non sono un ostacolo alla policy:
**sono la policy**, applicata dove non si può aggirare.

**3. Il difetto vero era altrove, ed era più grave.** Delle **71 FK di appartenenza** verso
`sys_users`, **27 non erano nel registro** `sys_gdpr_data_map`. Poiché la radice è
`ANONYMIZE` e non viene mai cancellata, né `CASCADE` né `RESTRICT` scattano mai da soli:
una tabella fuori dal registro **non viene toccata dalla cancellazione, non compare nel
rendiconto e non entra nel fascicolo dell'art. 15**. Dentro quelle 27: 7.567 check-in
obiettivi, 2.105 richieste di ferie, 1.886 saldi, 948 assegnazioni sondaggio, 178
straordinari — di persone reali.

**E il controllo che avrebbe dovuto accorgersene non poteva fallire.** Il test anti-drift
filtrava `LIKE 'sys.sys_user\_%'`: vedeva solo le tabelle col prefisso, e nessuna delle 27
ce l'ha. Era verde, e sarebbe rimasto verde con qualunque numero di tabelle scoperte.

## La decisione

**A. Per una persona con storia, cancellare significa anonimizzare.** La riga radice resta
e viene anonimizzata; le tabelle a valle seguono la strategia dichiarata nel registro. Non
esiste, e non va introdotta, una via che rimuova fisicamente una persona che ha prodotto
storia operativa.

**B. La cancellazione fisica esiste come *revoca di creazione*, non come alternativa.**
`DELETE /v1/users/:id/purge` — rotta **distinta** dalla soft, permesso `user:delete`,
vietata su sé stessi (`SELF_PURGE`) — rifiuta con `409 USER_HAS_HISTORY` appena esiste
**una sola riga** in una delle tabelle che trattengono, dicendo **quali** sono. È il rimedio
all'utente creato per errore, e nient'altro.

**C. Le FK bloccanti non si toccano.** Restano `RESTRICT`/`NO ACTION`. Il controllo
applicativo esiste per dare un errore comprensibile, non per sostituirle: se sbagliasse,
il database rifiuterebbe comunque. Verificato iniettando il difetto — con il guard rotto la
risposta diventa `500` da violazione di vincolo, e **la persona non viene cancellata**.

**D. Il guard si deriva dal catalogo, mai da un elenco.** `findBlockingHistory` interroga
`pg_constraint` a ogni chiamata. Un elenco scritto a mano invecchierebbe in silenzio alla
prima migrazione che aggiunge una tabella — che è esattamente come sono nate le 27 scoperte.

**E. Il perimetro del registro è l'APPARTENENZA, non il nome della tabella.**
`ON DELETE SET NULL` = **paternità** (chi ha creato: sopravvive al soggetto — regola già
scritta in `000295`), fuori dal registro. `CASCADE`/`RESTRICT`/`NO ACTION` = **appartenenza**
(dati della persona), dentro il registro, con classe, strategia e motivazione scritte.

**F. La cancellazione amministrativa non è un percorso separato.** È la disattivazione,
seguita eventualmente dall'erasure GDPR. Un terzo percorso significherebbe una terza
implementazione delle strategie di ritenzione: la peggiore duplicazione possibile su questa
materia.

## Cosa resta aperto, dichiarato

**La disattivazione non revoca le sessioni vive.** `deactivateUser` aggiorna solo lo stato.
La finestra però è limitata e misurata: login e rinnovo del token pretendono entrambi
`user_status = 'ACTIVE'`, quindi il residuo è al massimo la vita di un token di accesso —
**15 minuti**. Si accetta consapevolmente; chiuderla richiederebbe di invalidare le sessioni
dal modulo users, che oggi non conosce l'autenticazione.

## Conseguenze

- Il registro GDPR passa da 56 a **83 righe**; il fascicolo dell'art. 15 di ogni persona
  comprende ora ferie, straordinari, obiettivi, sondaggi, squadre e valutazioni.
- Il controllo anti-drift verifica l'appartenenza su **ogni** schema: prima di `000304` è
  stato **visto rosso** con i 27 nomi, e verde dopo.
- Delle 27, **14 si conservano** (retribuzione, ferie, valutazioni, registri di
  accountability) e **13 si cancellano** (preferenze, notifiche, appartenenze funzionali,
  punteggi algoritmici). Ogni riga porta la propria motivazione; le quattro scelte che non
  discendono dal nome della tabella sono argomentate nell'intestazione di `000304`.
