# STATE — vista rapida

> Priorità e domande aperte. I numeri stanno in `docs/kb/SOT_STATE.md`, l'altra metà.

## Last session brief — l'ultima sessione, in breve

**S1082 — i token di marca escono dal repo ed entrano nella libreria, e a schermo non cambia
niente: dimostrato, non promesso.** Sessione su mandato esterno (prompt da Claude Desktop, fuori
register), due cicli chiusi per intero.

Il tema di marca viveva in `apps/web`, copiato nello showcase dal sync. Ora vive in
`@heuresys/ui/theme` e arriva ai prodotti con una release: con più consumatori, una modifica di
marca deve raggiungerli tutti. Il file locale resta al suo posto **svuotato**, punto di estensione
per gli scostamenti di `apps/web`, col nome che la libreria prescrive.

**Il metodo è la parte che vale.** Fotografato il CSS emesso *prima* di toccare qualsiasi cosa: a
valle di **entrambi** gli interventi gli hash coincidono ancora con quella baseline. E ha pagato
subito — un token risultava «assente» dopo il lavoro, ma lo era identicamente prima: senza la
misura preventiva avrei diagnosticato una regressione inesistente.

**Le verifiche prescritte dal mandato erano difettose**, e in tre modi che producevano un verde
falso: cercavano il CSS dove su Next 16 non sta (prova **cieca**), una pipe mascherava l'exit code
(prova che non poteva **fallire**), un valore atteso era sbagliato in partenza. Il difetto in più
è mio: il censimento per il rename girava con uno strumento che **salta i file gitignored** —
cioè proprio dove un rename morde.

## Top priorities — le priorità

*Invariate: questa sessione non le ha toccate.*

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
6. **Da oggi un ritocco al tema di marca si fa in `ux-design-shared` e pretende una release** —
   il prezzo del modello. Sblocca la correzione a monte che il register rimandava (badge pieni a
   contrasto insufficiente, S1038): la faccio quando la nomini.

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py            # menu + salute, un giro solo
python docs/kb/tools/guardiano.py                # contesto e finestra 5h
python docs/kb/tools/check_marciume.py           # cio' che marcisce senza produrre un diff
cd apps/api && pnpm dev                          # ⚠ PRIMA di ogni corsa E2E: nessuna config la avvia
cd apps/web && node scripts/e2e-blocchi.mjs      # il preflight misura API, porta 3000 e carico VM
```
