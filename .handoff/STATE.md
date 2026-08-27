# STATE — vista rapida

> Priorità e domande aperte. I numeri stanno in `docs/kb/SOT_STATE.md`, l'altra metà.

## Last session brief — l'ultima sessione, in breve

**S1082 — la sessione in cui un controllo troppo caro si è rivelato un modo di perdere
difetti, non solo tempo.** Aperta su un mandato esterno (i token di marca alla libreria),
proseguita sul batch `#219 → #234 → #227`, e deviata da una domanda di Enzo che ha aperto la
vena più produttiva della giornata.

**Il filo.** Applicavo una migrazione alla produzione da Windows guardando la catena avanzare per
ottanta minuti, *misurando la lentezza mentre accadeva* senza chiedermi dove convenisse eseguirla.
Alla domanda di Enzo — «perché non lo fai sulla VM?» — la misura ha risposto: **17 secondi**. Da lì
il censimento di ogni controllo che pagava lo stesso pedaggio, e la scoperta che il costo
**nasconde**: la suite API da 37 minuti non si eseguiva, e conteneva un rosso vero invisibile da
settimane.

**Le firme mentono, quinta conferma di fila.** Nessuno dei cinque guasti curati era ciò che la
firma diceva: i due rossi a11y erano un ritiro fatto a metà e una soglia sul filo di un nodo · il
passkey era il terzo caso MFA rimasto senza la condizionalità dei gemelli · il test dei record
cercava una regola in un dominio che ne ha un'altra.

**E un errore mio, disfatto con lo strumento giusto.** La derivazione dei requisiti per il Risk
Manager ha chiuso `X5d` **accendendo `X5a`**: la post-condizione proteggeva ciò che non doveva
cambiare *dentro* la firma curata, non le altre della batteria. Rollback eseguito, stato
ripristinato, migrazione ritirata da tutte e tre le macchine.

## Top priorities — le priorità

1. **`#219` F5e — la corsa che chiude, e il passaggio in CI.** I **tre** guasti di F5d-bis sono
   curati (2 a11y + passkey): l'ultima corsa integrale misurata dava `363 passati · 1 fallito`, e
   quel fallito era il passkey, ora risolto. Serve **una corsa a 0 falliti** e poi il passaggio in
   CI secondo il criterio di `#211` F4.
   ⚠ **PRIMO ATTO DELLA PROSSIMA SESSIONE**: una corsa integrale è stata lanciata a fine S1082 e
   **non è stata letta** (era alla fase 2 di 4). Il suo referto sopravvive alla corsa — è il
   reporter JSON aggiunto da F5b: leggi **`apps/web/esiti-e2e.json`**, non rifare la corsa prima
   di aver guardato lì. Se il file è vecchio o assente, la sequenza è: accendi l'API
   (`cd apps/api && pnpm dev`) · libera la `:3000` da eventuali orfani · `cd apps/web && node
   scripts/e2e-blocchi.mjs`. → `.programmi/219-otto-guasti-suite-e2e.md`
2. **`#234` F2 — resta `X3c`, e la decisione è già presa.** Da 5 difetti a 1. Enzo ha deciso di
   **generare gli stipendi anche per Heuresys** (4 persone, nessun ciclo payroll, contro le 5.638
   buste di RTL). Non entra in una coda: è lavoro dichiarato. Riaperto anche il **Risk Manager**
   di `X5d`, con l'istruttoria migliorata: la derivazione dai pari è possibile ma **non è
   innocua**. → `.programmi/234-otto-rossi-verifica-incrociata.md`
3. **`#227` F2 — gli archi derivabili**, non toccata in questa sessione: 4.332 competenze stanno
   in gruppi che hanno già sorelle collegate. ⚠ La fonte ESCO a monte **non è più consultabile**:
   F2 lavora su ciò che il database già contiene. → `.programmi/227-competenze-isolate-nel-grafo.md`

## Open questions — le domande aperte

1. **Chi ha pushato il 26 agosto alle 18:47?** Due commit di prodotto sono arrivati su `origin/main`
   senza che io eseguissi alcun push, la CI è partita e il sito pubblico è stato ripubblicato. Non
   è un'attività pianificata, non è una sessione CLI parallela, e il diario non registra nulla. Se
   non riconosci l'azione, il progetto ha una regola precisa su chi può pushare qui e qualcosa
   l'ha aggirata.
2. **`#86`** — `claude login` sul solo linux-pc, cinque minuti tuoi. Invariata da S1080.
3. **La chiave di collaudo vive solo su Windows** (`.secrets/collaudo-access.key`): va propagata
   come la chiave madre perché la suite giri con le utenze nuove su CI e linux-pc. La propago?
4. **Il fornitore di proposte non è configurato in produzione** (`RESEARCH_GATEWAY_URL`/`_TOKEN`).
5. **Sulla VM resta una vecchia unit di servizio** (`heuresys-advanced-web.service.dev.bak`),
   inerte ma è configurazione di produzione. Si sposta, si tiene, o si lascia?
6. **Il contratto di `marta.pellegrini@rtl-bank.org` è scaduto il 2026-08-25** e la sua posizione
   resta attiva: va rinnovato o chiusa la posizione. È una decisione sui dati.
7. **Un ritocco al tema di marca ora si fa in `ux-design-shared` e pretende una release** — il
   prezzo del modello. Sblocca la correzione a monte che il register rimandava (badge pieni a
   contrasto insufficiente, S1038): la faccio quando la nomini.

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py            # menu + salute, un giro solo
python docs/kb/tools/guardiano.py                # contesto e finestra 5h
python docs/kb/tools/verifica_incrociata.py      # #234: 1 difetto residuo (X3c)
bash db/scripts/prova-idempotenza.sh             # ⭐ catena x2 + sentinelle SUL GEMELLO (~13 s)
pnpm db:migrate:vm                               # ⭐ applica alla produzione SULLA VM (~17 s)
cd apps/api && pnpm dev                          # ⚠ PRIMA di ogni corsa E2E
cd apps/web && node scripts/e2e-blocchi.mjs      # la corsa integrale, 4 fasi
```
