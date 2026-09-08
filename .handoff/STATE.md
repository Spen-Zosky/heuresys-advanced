# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1093 (2026-09-09). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Mandato «tutte le voci P1→P3 e i gated in autonomia». Poi Enzo ha contestato un difetto di fondo —
*«i risultati sono aleatori, non verifichi la catena degli oggetti che tocchi»* — e ha chiesto tre
rimedi **come regole definitive**. Infine: risolvere le PR Dependabot. Piani in `.programmi/S1093-*.md`.

**Chiuse**: `#169` F4 · `#214` F6 (undicesimo perimetro, in produzione) · `#79` F3 · `#149` F4 ·
`#198` gate confermato · la CI rossa · le 4 PR Dependabot. **La chiave API di S1088 è ruotata.**

## ⭐ Il reperto: cinque «verdi» che significavano «non ho guardato»

Una sola famiglia in cinque forme, ed è la risposta alla contestazione: un commento che diceva «quel
ramo non si percorre mai» (falso in CI) · un conteggio che misurava la **portata** invece della
**proprietà** · job CI `CANCELLED` scambiabili per verdi · il cancello che si dichiara verde dopo un
commit senza aver eseguito i test · un esito di suite perso in silenzio.

**E le regole non bastano: ho rifatto lo stesso errore quattro volte mentre scrivevo il rimedio**
(segreto in chiaro · file di piano senza fasi · `DELETE` sul database della CI mentre girava · mappa
dell'agente non rigenerata). L'unica volta in cui il danno si è fermato subito è quella in cui una
**guardia automatica** si è rifiutata. Serve che qualcosa dica di no, non che io ricordi.

## Regole nuove, vincolanti (`CLAUDE.md` §«LA CATENA, NON IL PEZZO»)

**C1** censisci chi sorveglia un oggetto prima di toccarlo (`chi_sorveglia.py`) · **C2** la prova
generale copre **tutto** `db/` · **C3** un seed porta a uno **stato dichiarato** · **C4** una prova
distruttiva gira su una **copia**, e un database di collaudo condiviso **è** un oggetto condiviso.
C1 sta anche nel `CLAUDE.md` globale. Ognuna ha una suite che la pretende.

## Top priorities

1. ⚠⚠ **`D-88` — il cancello si dichiara verde su contenuto che non ha misurato.** Guarda le modifiche
   *non committate*: committare fa svanire l'obbligo di verifica. E un `[BLOCCO]` del lucchetto **esce
   0**. Finché regge questo, ogni regola scritta oggi poggia su un controllo che può mentire.
2. **`#54` F4** — frontend `/recruiting` + E2E. ⚠ `sys_candidates` ha **1 riga**, non zero.
3. **`#143` F4/F5** — API progetti/squadre col confine I18.

▸ Poi, in ordine: `#159` F2 (il ponte gateway↔pagine) · PR `#85`, che ha solo bisogno di un
`@dependabot rebase` (per la `#86` è già chiesto).

⭐ Prima di pianificare: `.programmi/S1093-ricognizione-10-voci-LEGGIMI.md` — 13 agenti hanno misurato
sul campo le 10 voci e i tre gate, con la decomposizione fino al comando. ⚠ È una consegna, quindi
**non verificata** finché non la si misura (`#149`).

## Open questions

- ⏳ **SOSPESA (Enzo, 2026-09-08)**: dove custodire la chiave del collaudo.
- **Enforcement MFA** — ora ha il suo numero: **159 utenti su 164** hanno un fattore il cui segreto è
  casuale e non è mai stato consegnato. Accenderlo oggi chiuderebbe fuori il 97%. Precondizione: un
  percorso di ri-enrollment.
- **`#205` F1**: da quali siti la piattaforma accetta di imparare.
- ⛔ **Serve un tuo sì**: **29 processi `node` orfani** tengono la RAM a 0,9 GB su 15,9. Hanno ucciso la
  verifica **tre volte**; `test-api` **non è eseguibile qui** — NON MISURABILE, non verde.
- ⚠ **NON SPIEGATO**: perché il segreto TOTP *in chiaro* venisse rifiutato dal login. Cifrarlo ha reso
  verde la CI (misurato); il meccanismo no, e non l'ho inventato.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/chi_sorveglia.py --selftest   # C1: lo strumento sa ancora discriminare?
python docs/kb/tools/verify_gate.py selftest       # C2: il router instrada cio' che deve
bash scripts/verifica-deploy.sh                    # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
python docs/kb/tools/db_health.py                  # sentinelle, atteso exit 0
```
