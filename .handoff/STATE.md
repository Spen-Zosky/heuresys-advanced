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

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **Le presenze sono ferme da 8 giorni** — allarme reale di `db_health`, **non** causato dal
   lavoro di S1062: la storia RTL non avanza dal 2026-08-07 e il timer settimanale esegue solo
   la *custodia*, non l'avanzamento. Rimedio: `storia36.sh avanzamento`, **da lanciare sulla VM**
   (database locale) e non da Windows via tunnel. Rinviato per finestra 5h al 76%, non per
   difficoltà · skill `storia36-custodia`
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
