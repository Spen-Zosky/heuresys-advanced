# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-16 (S1065).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

⚠ **Prima di lavorare su `#196` `#197` `#198` `#199`** (Tenant Builder P3 e ciò che le sta attorno):
leggi `D:\heuresys-design-lab\2026-08-16--LEGGIMI-PRIMA-consegna-tenant-builder-p3.md`. Sono
**un corpo solo**, non quattro voci indipendenti: contiene la sequenza con le sue ragioni, gli errori
già trovati, cosa è già verificato e come, e cosa non fare. Voce `#208` nel register.

## Last session brief (S1065 «Tre decisioni, e ognuna ha aperto una porta che non era quella»)

**Tre domande aperte hanno avuto risposta, e nessuna si è chiusa dove sembrava.** `#193`
(organigramma visibile a chi lavora in azienda) non era una riga di configurazione: dichiarare
la classe rende la resource *sensibile*, e l'asserzione D-51 al boot avrebbe preteso un cancello
su rotte che la decisione apre a tutti — **l'app non sarebbe partita**. `#156` è cambiata di
forma a metà: la direzione *«ovunque porti valore aggiunto»* l'ha trasformata da «quale
perimetro» a «in che ordine», e lo strumento in una **coda di adozione**. Il ciclo di
valutazione è aperto in produzione con il login di chi ha il mandato HR, e **lasciato in
bozza**: dichiarare aperta l'autovalutazione senza la schermata sarebbe un segnaposto.

**Il filo è che le prove hanno vinto contro di me cinque volte** — prova generale, un test già
esistente, e due CI rosse di cui **una aveva torto**: era un oracolo che duplica la logica del
servizio e accusava il prodotto. **E un cancello scritto stamattina si è attivato contro chi
l'ha scritto**: l'atlante superato di nove giorni, meccanizzato su direzione di Enzo, mi ha
fermato due ore dopo. Dettaglio nel register (`#193` · `#156` · `#195`).

⚠ **Una regressione in produzione, causata e riparata in pochi minuti**: il cancello di verifica
applica le migrazioni, e ha portato la `000317` in produzione mentre girava ancora il codice
vecchio. Misurata con un login reale — 117 persone senza l'organigramma — rimossa la riga,
ri-misurato, ripristinato. Torna col deploy, che porta anche il codice.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **`#142` F3b — i dati dentro le viste**: sono **27 viste** e il progetto vieta i segnaposto —
   o tutte, o nessuna; la modalità di ciascuna è **già decisa** da `modalitaDellaVista`, F3b la
   legge e non la ricalcola · `.programmi/142-cruscotti-per-tipologia.md`
2. **`#143` F2 — modello dati «una squadra è un progetto»**: oggi `sys_teams` non sa dire scopo,
   obiettivo, date né avanzamento · `.programmi/143-squadra-come-progetto.md`
3. **`#159` F2 — il ponte gateway↔pagine web** (nessuna migrazione)

*(dietro, e pronte: `#156` collegare `hrx_entity_query` — resolver fatto, resta l'allowlist; e
l'**autovalutazione** di `#92`, che il ciclo in bozza rende dimostrabile.)*

## Open questions

- **Si apre davvero il ciclo di valutazione?** È creato in **bozza** (`RTL-2026-ANNUAL`, periodo
  e scadenze decisi da Enzo — dettaglio in `SOT_BACKLOG` `#92`). Farlo avanzare mette tutta
  l'azienda davanti a un compito: è un atto aziendale, e va fatto quando la schermata
  dell'autovalutazione esiste.
- **`/users` è governata al contrario di `/organization`** (`requires_admin=true`) sulla stessa
  materia: dopo `#193` la contraddizione è più visibile — è la stessa domanda, per i colleghi.
- ~~`#193` organigramma~~ e ~~`#156` primo perimetro~~: **decise il 2026-08-16**.
- **`#169`** separare password e secondo fattore (l'esenzione MFA esiste già, vuota: è la strada)
  · **`D-69`** riapertura verificata, nessuna urgenza.

## Verification

```bash
python docs/kb/tools/session_start.py               # menu + salute, un colpo solo
python docs/kb/tools/check_pagine_raggiungibili.py  # NUOVO: ogni pagina ha una porta?
python docs/kb/tools/check_istruzioni.py            # le istruzioni combaciano col reale?
python docs/kb/tools/handoff_lint.py                # cancello di coerenza, bloccante
bash scripts/verifica-deploy.sh                     # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
```

⚠ **La verifica lunga si esegue sul linux-pc, non qui** (standard S1054):
```bash
ssh linux-pc 'source ~/.nvm/nvm.sh; nvm use 22; cd ~/heuresys-advanced/apps/api && pnpm exec vitest run'
```
