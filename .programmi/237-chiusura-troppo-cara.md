# 237 — La chiusura costa un quarto di finestra, e non si sa perché

> **item**: #237 · **priorità**: P1 · **stima**: ~1 sessione (F1 sola: ~40k)
> **stato**: NON AVVIATO
> **nasce-da**: Enzo, 2026-08-29, a fine S1083: *«l'handoff è un collo di bottiglia che non abbiamo
> mai risolto adeguatamente. Una chiusura sessione non può e non deve consumare il 25% di una
> finestra di contesto. È urgente trovare soluzioni adeguate, ma non per tentativi ed errori.»*

## Il vincolo di metodo, che viene prima di ogni proposta

**Non per tentativi.** Quindi la prima fase non tocca niente: misura dove va il costo. Ogni cura
proposta prima di quella misura è una scommessa, e questo file ne conterrebbe la cronaca invece
della soluzione — che è precisamente ciò che Enzo non vuole.

## Quello che è già misurato (2026-08-29, fine S1083)

| file riscritto dalla chiusura | byte | ≈ token | quota di 1M |
|---|---:|---:|---:|
| `docs/kb/SOT_BACKLOG.md` | 926.928 | ~232.000 | **23%** |
| `docs/kb/SOT_STATE.md` | 432.938 | ~108.000 | **11%** |
| `docs/kb/DEBT_REGISTER.md` | 136.170 | ~34.000 | 3% |
| `.handoff/STATE.md` | 5.951 | ~1.500 | 0,1% |

- I tre grandi valgono **~37% della finestra** se letti per intero. Non lo si fa — il boot li
  distilla con `session_start.py`, la chiusura fa edit mirati — ma è la misura del peso.
- `SOT_BACKLOG`: **333 byte di riga media**, +5 righe a sessione, **non cala mai**. Append-only
  di fatto: 2.730 → 2.785 righe in dieci chiusure.
- Delta misurato dal guardiano fra l'invocazione della skill `handoff` e la fine di S1083:
  **192.430 token (19,2%)** — ⚠ ma include `#236` F1 e la correzione CI, che sono lavoro vero.
  **La quota della chiusura pura NON è misurata.** È il primo buco da chiudere.

## Le tre ipotesi, da falsificare non da assumere

1. **Il peso dello stato** — edit mirati su file enormi costano comunque, e la crescita è
   illimitata. Nessuno ha mai *tolto* da `SOT_BACKLOG`: 219 item, di cui molti terminali.
2. **La ripetizione** — la chiusura riscrive quattro file, rigenera tre artefatti, gira il lint
   almeno due volte, propaga, verifica. Quante di queste sono necessarie *a ogni* chiusura?
   Il profilo (`profilo-chiusura.sh`) già ne salta alcune; nessuno ha misurato quanto risparmia.
3. **⚠ Il mio stile di scrittura** — commenti nelle migrazioni da 60 righe, programmi con la
   cronaca di ogni decisione, messaggi di commit da 40 righe. Hanno un valore reale (impediscono
   di ri-sbagliare, e in S1083 hanno impedito almeno tre volte di ricominciare un'indagine già
   fatta), ma **nessuno ha mai misurato il costo contro quel valore**. Questa ipotesi è la più
   scomoda e la più facile da saltare: va misurata per prima proprio per questo.

## Fasi

- [ ] **F1 — DOVE VA IL COSTO, misurato dal transcript e non stimato** — il transcript JSONL porta
      i token per turno. Si attribuisce ogni turno di una chiusura a una categoria (scrittura di
      stato · rigenerazione derivati · lint · propagazione · commit/push · verifica) e si ottiene
      la ripartizione vera, su **almeno tre sessioni** perché una sola non fa una regola.
      **fatto =** una tabella «categoria → token → % della chiusura», e la risposta alla domanda
      che oggi non ha risposta: *quanto costa la chiusura pura?* · budget ~40k
- [ ] **F2 — La cura della voce più cara, una sola** — si affronta la prima della tabella di F1,
      non tutte insieme: una cura per volta, con la misura prima e dopo. Se la voce più cara è il
      peso di `SOT_BACKLOG`, la cura è l'archiviazione degli item terminali (219 item, quanti
      terminali? si misura); se è la ripetizione, è il profilo; se sono io, è una regola di
      scrittura. **fatto =** la stessa misura di F1 rifatta, e il numero è sceso · budget ~60k
- [ ] **F3 — Il presidio, perché non ricresca** — qualunque sia la cura, senza un cancello il
      problema torna: `SOT_BACKLOG` è cresciuto per due anni senza che nessuno se ne accorgesse.
      Un controllo al boot che dichiara il peso dello stato e arrossisce oltre una soglia
      **motivata dalla misura di F1**, non scelta a caso. **fatto =** il cancello esiste, ed è
      stato visto rosso · budget ~40k

## Le prove che devono poter fallire

- **F1** — la ripartizione dev'essere **falsificabile**: se sommando le categorie non si ottiene
  il totale che il guardiano misura, la misura è sbagliata e va rifatta. Un'analisi che «torna»
  per costruzione non dimostra niente.
- **F2** — la cura si misura con lo stesso metro di F1, **sulla chiusura successiva**. Se il
  numero non scende, la cura non ha funzionato: si dichiara e si passa alla seconda voce, non si
  cerca una spiegazione al perché avrebbe dovuto funzionare.
- **F3** — la soglia va vista **rossa** almeno una volta, altrimenti è un numero scritto.

## Chiuso quando

Si sa dove va il costo della chiusura, la voce più cara è scesa in modo misurato, e un cancello
impedisce che risalga in silenzio.
