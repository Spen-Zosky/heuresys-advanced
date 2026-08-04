# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-04 (S1043 — organigramma ricostruito, prestazioni degli strumenti, test di perimetro sospesi).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1043)

**Sessione lunghissima, chiusa in modo minimale su richiesta di Enzo.** Tre blocchi: il canale
lab→canonica installato e subito produttivo, la ricostruzione dell'organigramma di RTL Bank portata
in produzione, e un lavoro di prestazioni nato da una domanda di Enzo sul perché le chiusure fossero
lente.

**Il filo conduttore è un difetto di forma che si ripete**: *asserire un numero invece di un
principio*. Sei migrazioni si rompevano su un ri-percorso completo perché dicevano «esattamente 25
mansioni», «esattamente 10 Direzioni», «i totali valgono 1678» — e **cinque le aveva scritte questa
sessione**. Un'uguaglianza esatta sembra il controllo più rigoroso possibile e invece non dimostra
«il lavoro è riuscito»: dimostra «nessuno ha più toccato niente».

**Quattro volte una spia ha scoperto un danno appena fatto**: le 133 posizioni nuove nascevano senza
mansione, lo scioglimento di due unità lasciava appese due squadre con 41 persone dentro, i 39
mestieri nuovi esistevano solo in italiano, e l'albero delle posizioni si era spezzato in quindici
tronconi (perimetro della CEO da 157 persone a 17). Nessuna sarebbe emersa rileggendo il lavoro.

**Un errore di metodo, dichiarato**: per riprodurre la CI ho rieseguito le migrazioni **sul database
di produzione** invece che su un clone. Il filo ha retto (161 assegnazioni, nessuna persona persa) ma
ha lasciato tracce, tutte richiuse.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Organigramma RTL**: ricostruito e in produzione. Sette regole strutturali su sette a zero.
- **#92 ciclo di valutazione**: passi **2 su 7** chiusi (schema+permessi, ingestione calibrazioni).
- **#115 — perimetri nei test**: **SOSPESO da Enzo**, consegnato a sessione dedicata.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md`.

## ⚠ Top priorities (next session)

1. **#115 — i test di perimetro** descrivono l'organigramma di ieri. Il prodotto NON è rotto: i ruoli
   delle persone nominate a mano si sono invertiti. Soluzione già scritta e provata su nove file ·
   `docs/superpowers/specs/2026-08-04-perimetri-test-dopo-ricostruzione.md`.
2. **#116** — 28 persone su 45 atterrano su un cruscotto che non possono vedere, e 27 sono i
   responsabili nominati ieri: è uno strascico diretto del lavoro di questa sessione.
3. **#92 passi 3-7** — da qui in avanti è codice applicativo (API lettura, scrittura, ESS, frontend, E2E).

## Open questions (autorità *cosa* = Enzo)

- **La CI è rossa** e i commit locali NON sono pushati: la sessione è stata chiusa senza push su
  richiesta. Il rosso è quello di #115, diagnosticato e non un difetto di prodotto.
- **Due cataloghi tacciono**: 8 posizioni apicali senza requisiti formativi, 119 su 161 senza
  indicatori. Riempirli significa decidere contenuto di prodotto.
- **Quattro OKR nominano un reparto inesistente**, fra cui `Supply Chain` in una banca (tocca I21).
- **`admin@heuresys.com`**: utenza di servizio, unica persona attiva senza posizione.
- WAIT-INPUT: **#8** Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85** `AGENTS.md` ·
  **#86** `claude login` su VM e linux-pc.

## Verification (next session)

```bash
python docs/kb/tools/session_start.py              # menu + salute + sentinelle in un round
python docs/kb/tools/db_health.py                  # atteso: "tutto nei limiti"
python docs/kb/tools/verifica_incrociata.py        # ora 3,4s invece di 46
git log --oneline origin/main..HEAD                # 4 commit locali da valutare
```
