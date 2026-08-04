# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-04 (S1044 — le 13 consegne del lab: sei chiuse, una a metà, sei da fare).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1044)

**Batch delle 13 consegne del lab, eseguito nell'ordine imposto da Enzo.** Sei chiuse, una a metà
con il pezzo difficile fatto, sei intatte. Piano con lo stato riga per riga:
`docs/superpowers/specs/2026-08-04-consegne-lab-13.md`.

**Il filo conduttore è un difetto di forma che si ripete**: *decidere da un elenco di nomi invece che
da una proprietà*. L'atterraggio dopo il login guardava i ruoli e non il permesso; il menu
amministrativo guardava sette nomi e dimenticava il CEO; tre servizi copiavano la stessa scala e
finivano in un fallback silenzioso. Un elenco non resta giusto: va modificato a ogni ruolo nuovo, e
non fallisce niente quando ci si dimentica.

**Due decisioni retributive applicate dopo averle mostrate a Enzo**, come chiesto. **Lo stato `mask`
esiste**: il sistema non è più binario, e ha richiesto un ADR perché emenda un invariante.

**Tre errori miei, trovati rompendo il codice apposta e non rileggendolo**: un test che contava tutte
le voci di menu e passava anche con la lista cablata rimessa; una verifica che segnalava come fuga la
propria dichiarazione; un tipo di unità prescritto dalla consegna e rifiutato da due regole del
progetto. **Una premessa smentita dalla misura**: le squadre duplicate erano 24 e ~150 persone, non
«2 unità e 2 persone» — misurato prima di toccare e portato a Enzo.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **13 consegne del lab**: chiuse `#116` `#118` `#119` `#120` `#122`; a metà `#124`; da fare
  `#117` `#121` `#123` `#125` `#126` `#127` `#128`.
- **#115 — perimetri nei test**: ancora consegnata a sessione dedicata. Sei rossi verificati
  pre-esistenti (con `git stash`, non supposti).
- **#92 ciclo di valutazione**: passi **2 su 7** chiusi.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md`.

## ⚠ Top priorities (next session)

1. **#127 + #123** — stabilizzazione post-ricostruzione e lettura di `organigramma-bis.html`: vanno
   insieme perché la seconda assorbe la prima per dichiarazione propria. ~1 sessione.
2. **#124 residuo** — lo strato 1 (separare identità professionale e privata) chiude 6 celle su 8
   senza alcun meccanismo nuovo: è il pezzo a maggior valore rimasto. ~1 sessione.
3. **#115** — i test di perimetro descrivono l'organigramma di ieri. Il prodotto NON è rotto ·
   `docs/superpowers/specs/2026-08-04-perimetri-test-dopo-ricostruzione.md`.

## Open questions (autorità *cosa* = Enzo)

- **Nessun push in S1044**: non autorizzato in sessione. La CI resta rossa da prima (è #115).
- **Due responsabili di direzione senza posizione di comando** (`alice.costa`, `pietro.gallo`):
  reggono un'unità occupando una posizione tecnica. Creare le due posizioni è lavoro di struttura.
- **Un capo filiale deve vedere il cruscotto?** Se sì, la correzione è dargli `dashboard:view` nella
  mappa RBAC — la navigazione seguirà da sé (deciso di NON presumerlo in `#116`).
- **Due cataloghi tacciono**: 8 posizioni apicali senza requisiti formativi, 119 su 161 senza
  indicatori. Riempirli significa decidere contenuto di prodotto.
- **Quattro OKR nominano un reparto inesistente**, fra cui `Supply Chain` in una banca (tocca I21).
- WAIT-INPUT: **#8** Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85** `AGENTS.md` ·
  **#86** `claude login` su VM e linux-pc.

## Verification (next session)

```bash
python docs/kb/tools/session_start.py              # menu + salute + sentinelle in un round
python docs/kb/tools/db_health.py                  # atteso: "tutto nei limiti"
python docs/kb/tools/verifica_incrociata.py --famiglia X1 --famiglia X2 --famiglia X3
git log --oneline origin/main..HEAD                # commit locali da valutare per il push
```
