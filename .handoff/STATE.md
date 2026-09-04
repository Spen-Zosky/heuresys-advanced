# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1086 (2026-09-04). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief — l'ultima sessione, in breve

Sessione lunga, in autonomia delegata. Il filo conduttore, non cercato: **tre catene di lavoro
erano ferme per diagnosi sbagliate**, e sotto ognuna c'era un difetto vero e piccolo. La
produzione era indietro di tre giorni per una CI rossa che erano due guasti distinti — un test
che fissava una decisione già superata, e un server di sviluppo dimenticato su una porta. E le
voci del Tenant Builder dichiarate «bloccate su un input che solo Enzo può dare» non lo erano:
il fornitore di ricerca è un nostro servizio, e l'unica fonte approvata del sistema era
**invisibile** perché un codice di settore era finito nella colonna del dominio.

Chiuse `#241`, `#243`, `#239`, `#132` (con F7), `#245`, più `#242` F1 e il settimo perimetro
dell'agente. Zero PR Dependabot aperte. Produzione **DEPLOYATO**.

## Top priorities — le priorita'

1. **`#198` T9b — la costruzione vera in produzione** (~1 sessione). **Sbloccata**, ma non
   pronta: se rifatta oggi produrrebbe *un'altra banca*, l'errore già chiamato «grossolano». Va
   rifatta col modello che nasce dalla ricerca — che ora funziona (`#132` F7 verde) — invece che
   con l'archetipo cablato.
2. **`#205` — la coda dei domini ricercabili** (~1 sessione). Il gate su `#132` è caduto. ⚠ La
   sua F1 ha un punto che **non si decide misurando**: la prova R2 («esiste una fonte ammessa che
   ne parla») presuppone una corrispondenza fra tabella e dominio che oggi non esiste, e quel
   piano vieta di scrivere a mano un criterio.
3. **`#219` — il triage dei falliti della suite E2E** (~1-2 sessioni). Invariata: la corsa parla
   con due API diverse, e finché è così nessun 403 è interpretabile.

## Open questions — le domande aperte

- **La 3001 è del datastore?** Enzo lo ha ipotizzato e poi detto «non so chi occupa cosa».
  Misurato: il datastore usa la **5435**, la mappa del repo riserva la 3001 alla CI, e su Windows
  non è in ascolto. Se va **riallocata** è una decisione che tocca i workflow E2E: non presa.
- **`#242` F2/F3/F4** — la migrazione di `trustProxy` alla forma per indirizzo. F1 è chiusa e ha
  rovesciato il segno della voce: non c'è un difetto da riparare, c'è un comportamento
  **verificato buono da preservare** prima di poter salire a fastify ≥ 5.12.
- ⚠ **L'allineamento dell'ecosistema Claude e' ROTTO, e la causa e' fuori da questo repo**:
  `align-claude-ecosystem.sh:39` cerca `session-bootstrap.sh` in `~/Claude Desktop/scripts/`, ma
  quella cartella e' stata riorganizzata il 2026-09-04 alle 16:42 (lavoro della sessione
  datastore). L'unica copia trovata e' in `~/personal_scripts/remoto/`, **datata 2 agosto**:
  NON l'ho ripuntata li' — propagare un bootstrap vecchio a tutte le macchine sarebbe peggio del
  guasto. Serve sapere dove quel file deve vivere adesso. Il canale repo (`align-clones`) e'
  andato a buon fine; il deploy e' stato armato a mano, perche' il canale fallito e' la
  sincronizzazione della configurazione Claude e non tocca cio' che va in produzione.
- **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082.
- **`PROVA-F7-ALFA` è tornato sul gemello** (lo ricrea la prova di `#132` F7). In produzione è
  stato rimosso su decisione di Enzo; sul clone è un artefatto di prova, non un residuo.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py       # menu + salute, un solo giro
bash scripts/verifica-deploy.sh             # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
python docs/kb/tools/mappa_porte.py --intrusi   # 3001/8790 devono essere libere a riposo
python docs/kb/tools/check_marciume.py      # deve dire «niente e' marcito»
```
