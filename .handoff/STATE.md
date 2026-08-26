# STATE — vista rapida

> Priorità e domande aperte. I numeri stanno in `docs/kb/SOT_STATE.md`, l'altra metà.

## Last session brief — l'ultima sessione, in breve

**S1081 — la sessione in cui quasi ogni diagnosi ereditata si è rivelata sbagliata, e l'ultima
riparazione ha scoperto un danno che nessuno stava cercando.** Consumato il ciclo `#231` su
mandato di Enzo («procedi con tutte, decidi tu priorità e sequenza»): chiuse `#169` F2, `#132`
F7, `#227` F1, `#214` F6, `#234` F1, più la fase `F5` di `#219` fino al triage.

Il filo: **misurare ha smentito il registro cinque volte.** La suite E2E non entrava per
un'utenza sparita — falso, le sei persone c'erano tutte: mancava l'API accesa. Le competenze
isolate erano curatela su un terzo del catalogo — falso, sono 30 righe di lavoro vero. Tre degli
otto rossi del cancello erano difetti — falso, erano misure col nome sbagliato, fra cui lo
scostamento di competenze, che *è* la funzione del prodotto.

**La lezione più cara è un errore mio, ripetuto due volte nella stessa ora.** Per curare un 403
ho applicato da sola una migrazione che *ripara cancellando*: ha tolto quattro permessi, come
aveva già fatto la catena interrotta dal deadlock fra le due sessioni parallele. Ritirato,
ricostruito con la catena intera, verificato — 980 mapping, il valore esatto del boot.

## Top priorities — le priorità

1. **`#219` — i tre guasti veri che restano**, ora identificati con precisione: `/privacy` e
   `/brownfield-adaptation` **non renderizzano** (21 e 40 nodi: lo dice la guardia anti-vacuità
   di `F4`, non un'asserzione) + un locator del giro passkey. Poi la corsa a 0 falliti e la CI.
   → `.programmi/219-otto-guasti-suite-e2e.md` · ~1 sessione
2. **`#234` F2 — i cinque rossi veri di `verifica_incrociata`**, con due già istruiti: due dei
   cinque OKR «senza reparto» sono **estranei al dominio bancario** (contaminazione), e la causa
   a monte è che `okr_department` è testo libero. Finché non chiude, ogni chiusura porta
   `marciume: fallito` — posseduto, non spento.
   → `.programmi/234-otto-rossi-verifica-incrociata.md` · ~1-2 sessioni
3. **`#227` F2 — gli archi derivabili**: 4.332 competenze stanno in gruppi che hanno già sorelle
   collegate. ⚠ La fonte ESCO a monte **non è più consultabile** come tassonomia di competenze:
   F2 lavora su ciò che il database già contiene.
   → `.programmi/227-competenze-isolate-nel-grafo.md` · effort da ri-stimare al ribasso

## Open questions — le domande aperte

1. **`#86` — l'ultima voce in «aspetta te»**: `claude login` sul solo linux-pc, cinque minuti
   tuoi. Invariata da S1080.
2. **La chiave di collaudo vive solo su Windows** (`.secrets/collaudo-access.key`). Perché la
   suite giri con le utenze nuove su CI e linux-pc va propagata come la chiave madre
   (`COLLAUDO_ACCESS_KEY_B64` sul runner). Decisione tua: la propago al prossimo giro?
3. **Il fornitore di proposte non è configurato in produzione** (`RESEARCH_GATEWAY_URL` /
   `_TOKEN` nel `.env`, che è tuo). Invariata.
4. **Sulla VM resta una vecchia unit di servizio accanto a quella viva**
   (`heuresys-advanced-web.service.dev.bak`), inerte ma è configurazione di produzione.
   Si sposta, si tiene, o si lascia? Invariata.
5. **Il contratto di `marta.pellegrini@rtl-bank.org` è scaduto il 2026-08-25 e non è stato
   rinnovato**, mentre la sua posizione resta attiva. La storia RTL avanza da sé: va rinnovato
   il contratto o chiusa la posizione — è una decisione sui dati, non un difetto.

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py            # menu + salute, un giro solo
python docs/kb/tools/guardiano.py                # contesto e finestra 5h
python docs/kb/tools/check_marciume.py           # cio' che marcisce senza produrre un diff
cd apps/api && pnpm dev                          # ⚠ PRIMA di ogni corsa E2E: nessuna config la avvia
cd apps/web && node scripts/e2e-blocchi.mjs      # il preflight misura API, porta 3000 e carico VM
```
