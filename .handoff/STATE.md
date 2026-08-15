# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-15 (S1062).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1062 «Canonica Notturna»)

Mandato aperto: *«esegui in piena autonomia P1+P2+P3, per i bloccanti decidi tu»*. Chiusa
**`#99` F7**, che era la radice: la visibilità di una voce di menu ora **discende dalla
matrice dei domini** invece che da un flag scritto a mano.

**Il lavoro vero è stato scoprire due volte che il piano aveva torto, e scoprirlo misurando.**
La derivazione «pura» descritta dal piano avrebbe **regalato a 109 persone** le voci di
governo — perché essere compagno di squadra apre l'anagrafica in forma ridotta, e tradotto in
visibilità di pagina diventava «puoi aprire la gestione utenti». È lo stesso difetto da 109
persone già evitato in F6a, rientrato dalla finestra. E `requires_admin` **non è eliminabile**
come M3 sperava: esistono pagine amministrative che non espongono alcun dato di persona.

**Due difetti sono emersi dalla regola, non da una ricerca**: un cancello di sicurezza che
pretendeva un presidio solo per diligenza di chi l'aveva scritto (e nulla sarebbe fallito
togliendolo), e una pagina di governo offerta a 109 dipendenti per lo stesso difetto già
corretto sulla console delle segnalazioni.

**Correzione di rotta di Enzo, ed era giusta**: avevo lanciato la suite completa su Windows,
che lo standard di S1054 esclude. Misurato in diretta il perché — **135-165 ms per query**
attraverso il tunnel, con vitest al 22% di CPU perché aspetta la rete. Spostata sul linux-pc:
**verde in 17,7 minuti** contro 55+ senza arrivare in fondo.

**Poi, su richiesta, la storia RTL è stata avanzata sulla VM** (database locale, non via
tunnel): presenze, assenze, richieste di ferie e approvazioni derivate portate a ieri, e
`db_health` è tornato **tutto nei limiti**. Il rosso che ne è emerso non era l'orologio come
sembrava: due dirigenti non avevano **mai** avuto la formazione sicurezza obbligatoria, pur
essendo inquadrati dal 2003 e dal 2009 mentre nove colleghi identici ce l'avevano. Riparato.
La riparazione ha però fatto emergere `#189`, un difetto dello strumento stesso.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. ⭐ **MANDATO DI ENZO — ciclo di autocoscienza e redenzione** (S1062, non eseguito: la
   finestra 5h ha raggiunto **82%** mentre veniva assegnato, e la regola impone di fermarsi).
   **Va eseguito per intero, con contesto pieno, PRIMA della chiusura della sessione in cui
   lo si affronta.** Le quattro parti, testuali:
   *(a)* rileggere **tutti** i documenti del progetto — `CLAUDE.md`, i `README.md`, i vincoli,
   le regole in `.claude/rules/`, gli **ADR**, la `docs/kb/`, le **memorie**, i **transcript di
   sessione**, i contenuti di **claude-mem** e qualunque cosa istruisca su come lavorare;
   *(b)* rianalizzare **tutti gli errori delle ultime 10 sessioni dipesi da negligenza o
   mancato rispetto delle regole** — non i difetti tecnici, ma le mie inadempienze;
   *(c)* **rinforzare i meccanismi** che impediscono di ricommetterli;
   *(d)* **verificare** la capacità reale di autoapprendimento dagli errori e di autocorrezione
   **stabile** — cioè che la correzione regga nel tempo, non solo subito dopo il richiamo.
   ⚠ **Materiale già in mano da S1062**, da non ri-cercare: in questa sessione ho violato lo
   standard S1054 (suite lunga lanciata su Windows invece che sul linux-pc) e sono stato
   corretto da Enzo, non dai miei controlli — il che è già un dato per la parte *(d)*.
2. **`#189` — la riparazione della storia36 non arriva in fondo** (~1-2h): un seed invoca una
   funzione di verifica che le batterie creano *dopo* di lui, quindi `--repair-missing` si
   spezza a metà e la regola del twice-run non è eseguibile su quel modo. Trovato eseguendolo
   in S1062, invisibile prima perché quel seed lo tocca solo quel modo · register `#189`
2. **Verificare com'è finito il deploy armato**: `bash scripts/verifica-deploy.sh`. Questo giro
   porta in produzione la migrazione `000315` e la nuova derivazione della sidebar.
3. **`#142` F2 — modello dei cruscotti**, ora **sbloccata** da F7 (~180k). Leggere prima i tre
   reperti annotati nel register: la derivazione **restringe e non concede**, il permesso per
   cruscotto serve ancora, e nel modulo `dashboard` ci sono due residui da correggere lì
   (una lista di ruoli a mano; lo scope TEAM ancora sull'albero delle posizioni) · `.programmi/142-*.md`

## Open questions

- **Due decisioni di Enzo sbloccano lavoro già pronto** (la terza, `#143`, è stata decisa in
  S1062 col mandato): *(a)* si apre il ciclo di valutazione dell'azienda? · *(b)* `#156`, quale
  superficie aprire per prima all'agente, fra le **83 schede idonee**.
- **`#169` — separare password e secondo fattore**: indagata in S1062 e **non eseguita di
  proposito**. `deriveTotpSecret` è usato da **19 file** (prove live, acceptance del gateway,
  E2E, helper di login): separare i segreti riprogetta il modo in cui *tutta* la suite fa
  login, e la trappola è già scattata una volta. Reperto che cambia la soluzione: l'impianto
  di **esenzione MFA esiste già nel database ed è vuoto** — è quella la strada.
- **`D-69`**: la condizione di riapertura si è verificata. Smontare l'ETL è ~3-4h, nessuna urgenza.
- **La prova generale del database non esegue la suite di test**: una guardia che vive in un
  test le sfugge per costruzione. Vale la pena spostare quel controllo dentro la catena?

## Verification

```bash
python docs/kb/tools/session_start.py            # menu + salute, un colpo solo
python docs/kb/tools/handoff_lint.py             # cancello di coerenza, bloccante
python docs/kb/tools/programmi.py --verifica     # atteso: 7 programmi, nessun difetto
python docs/kb/tools/db_health.py                # atteso: 1 allarme (presenze) finché non si avanza la storia
bash scripts/verifica-deploy.sh                  # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
```

⚠ **La verifica lunga si esegue sul linux-pc, non qui** (standard S1054, ri-misurato in S1062):
```bash
ssh linux-pc 'source ~/.nvm/nvm.sh; nvm use 22; cd ~/heuresys-advanced/apps/api && pnpm exec vitest run'
```
