# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1090 (2026-09-06). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief — l'ultima sessione, in breve

Sessione breve, nata da una domanda: *«cosa significa 8 programmi aperti senza corsia?»*. La
misura ha risposto che erano **otto falsi allarmi** — cinque voci chiuse da giorni con il
file-piano rimasto indietro, e tre quaderni di sessione contati come programmi. Curati tutti e
otto, e curata la causa: il quaderno di sessione non è più censito come programma.

Il filo: **un allarme che si accende sempre è un allarme che si impara a non guardare**. E il
cancello che lo diceva — `programmi.py --verifica`, exit 1 — funziona da sempre e **non lo
interroga nessuno**: né il boot, né la chiusura, né la CI. È diventata `#249`.

⚠ Ri-osservato sul vivo: `| tail` **maschera l'exit code**. Un cancello rosso letto attraverso
una pipe sembra verde.

## Top priorities — le priorità

> ⭐ **Mandato di Enzo per la sessione successiva (S1090)**: *processare **tutte** le voci P1, P2 e
> P3 in sequenza automatica, decisa da me e dichiarata all'inizio, senza presentare il menu e
> senza aspettare una scelta.* Il guardiano governa il taglio, non la volontà: alle soglie si
> interrompe comunque. Il mandato si esaurisce con quella sessione.

1. **`#249` F3 — il presidio** (~1 sessione). F1 e F2 sono state **eseguite in questa chiusura**:
   il cancello di fine turno ha rifiutato la chiusura su un `programmi` rosso, e la regola del
   progetto non ammette il «pre-esistente». `programmi.py --verifica` è passato da **29 difetti a
   0** — «50 programma/i, nessun difetto». Resta il bersaglio vero: **nessuno interroga quel
   cancello** (non il boot, non la chiusura, non la CI). Oggi ha fermato la chiusura *per caso*,
   perché i file instradati erano cambiati.
2. ~~**`#219`**~~ — **CHIUSA il 2026-09-06**: la suite integrale gira in CI ed è verde. Non è
   più una priorità; la sezione dedicata più sotto tiene le tre lezioni che restano.
3. **`#169` F3a** (~1-2 sessioni). ⚠ **Serve una decisione tua**: le utenze di collaudo coprono
   `PLATFORM_ADMIN`, `TENANT_ADMIN` e `USER`; restano scoperti *manager*, *outsider* e
   **custodian**. Per la custodia whistleblowing (isolamento assoluto, ADR-0036 §5) va deciso se
   un'utenza di servizio possa portarne il mandato. È sicurezza, non tecnica.

## Open questions — le domande aperte

- ⭐ **Da quali fonti la piattaforma accetta di imparare com'è fatta un'azienda?** — il registro
  ne porta **una sola**. Tre voci ferme qui (`#198`, `#205`, il ponte di `#132`).
- **La ricerca semantica sul gemello è accesa** e ogni corsa integrale costa **due chiamate a
  pagamento** al fornitore di embedding. Va bene, o la si rispegne lì?
- ⚠ **Una chiave API è transitata nell'output di un comando** in S1088 (mai scritta in un file).
  Quella del fornitore di embedding è da ruotare, per prudenza.
- **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082.

## ⚠ Questa chiusura NON ha propagato né deployato

Richiesta esplicita di Enzo: commit e push, **senza** allineamento dei cloni e **senza** armare il
deploy. Il profilo diceva `arma: esegui` — saltato **per decisione**, non perché non servisse.

Conseguenza da non fraintendere: **VM e linux-pc restano indietro** e nessun `refs/heads/prod` è
stato armato. `origin/main` invece è avanzato — anche per il push della sessione parallela di
`#219` (fino a `4e9d6d34`): il codice è pubblicato, **non** propagato. Chi riprende propaga prima
di misurare le macchine, e `verifica-deploy.sh` dirà `DISALLINEATO` fino ad allora — è l'atteso,
non un guasto.

## `#219` — CHIUSA, e le tre lezioni che restano

**La suite integrale gira in CI ed è verde** (corsa `34060405061`, `success`, 35 minuti):
367 passati · 0 falliti · 80 non eseguiti, **tutti dichiarati**, su 447 contati su 447.
La cronaca dei **nove giri, nove cause** sta in `.programmi/219-otto-guasti-suite-e2e.md`
§S1090 e non si ricopia qui. Le tre lezioni che valgono oltre la voce:

1. **`systemctl show` può confermare una cosa falsa.** Dichiarava l'origine giusta; il
   processo vivo ne aveva un'altra. Fra i drop-in, un `EnvironmentFile` successivo vince, e
   `systemctl show` **non ne mostra il contenuto**. Si legge dal processo:
   `ssh linux-pc 'strings /proc/<pid>/environ | grep NOME'`.
2. **Gli elenchi chiusi di origini sono tre**, non uno — `ADMIN_ORIGIN` (CSRF),
   `WEBAUTHN_ORIGINS` (passkey), la destinazione **compilata** del proxy. Un ambiente nuovo li
   fa fallire tutti: si cercano tutti, non quello che si è rotto per primo.
3. **Un verdetto che non può mai essere verde è rotto.** 367 passati, 0 falliti, e rosso per
   80 salti tutti dichiarati: è l'allarme che suona sempre (`#194`), e fa sparire il rosso
   vero nel rumore.

⏭ **Restano fuori, dichiarate**: la ricerca semantica **spenta in CI**
(`E2E_RICERCA_SEMANTICA=0`) perché ogni ricerca è una chiamata a pagamento — accenderla è una
**decisione di costo tua**; e il workflow **manuale**, perché il runner è **uno solo** e serve
anche lo smoke di ogni push. Renderlo automatico è una decisione successiva.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py        # menu + salute, un solo giro
python docs/kb/tools/programmi.py --verifica # SENZA pipe: la pipe maschera l'exit code
python docs/kb/tools/handoff_lint.py         # coerenza dello stato, bloccante
bash scripts/verifica-deploy.sh              # atteso DISALLINEATO: S1090 non ha propagato
bash scripts/posso-uscire.sh                 # ⚠ l'ssh e' contato per MACCHINA, non per sessione
gh run list --workflow=playwright-integrale.yml --limit 3
ssh linux-pc 'cat /proc/loadavg'             # prima di ogni corsa E2E: sotto 2
```
