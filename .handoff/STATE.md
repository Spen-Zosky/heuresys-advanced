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

1. **`#249` per prima** (~1 sessione) — è il residuo esplicito di questa chiusura: `--verifica`
   dà **22 difetti su 12 piani** (numero da ri-derivare, non da credere), più il presidio che
   manca. F3 è il bersaglio vero: qualcuno deve interrogare quel cancello.
2. **`#219` — il primo giro verde del workflow integrale** (~1 sessione). Il **quinto giro** era
   `queued` alla chiusura (`34043971361`): il runner è uno solo. Si legge con
   `gh run list --workflow=playwright-integrale.yml --limit 3`.
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
deploy. Conseguenza da non fraintendere: `origin/main` è avanti, **VM e linux-pc restano al commit
precedente** e nessun `refs/heads/prod` è stato armato. Il profilo diceva `arma: esegui` — è stato
saltato per decisione, non perché non servisse. Chi riprende propaga prima di misurare le macchine.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py       # menu + salute, un solo giro
python docs/kb/tools/programmi.py --verifica # SENZA pipe: la pipe maschera l'exit code
bash scripts/verifica-deploy.sh             # atteso DISALLINEATO finché non si propaga
gh run list --workflow=playwright-integrale.yml --limit 3
ssh linux-pc 'cat /proc/loadavg'            # prima di ogni corsa E2E: sotto 2
```
