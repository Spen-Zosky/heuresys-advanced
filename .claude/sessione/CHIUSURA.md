# Chiusura — estensione di progetto per heuresys-advanced

Questo file è caricato automaticamente dalla skill user-level `handoff`. Vale **solo** per questo
progetto (e per i suoi worktree). Contiene ciò che il core generico non può sapere: i nomi dei file di
stato, gli script, l'ordine obbligato dei generatori e la topologia dei cloni.

Il core resta valido in tutto ciò che qui non è nominato. Dove questo file dice «invece», sostituisce.

---

## Fonti di stato di questo progetto

Oltre a `.handoff/STATE.md` (vista rapida, governata dal core), qui esistono tre viste disgiunte:

- `docs/kb/SOT_STATE.md` — snapshot granulare (versioni, conteggi DB/API/web/CI, architettura, milestone).
- `docs/kb/SOT_BACKLOG.md` — backlog aperto (action item).
- `docs/kb/DEBT_REGISTER.md` — debiti tecnici.

Nessun fatto sta in due file. Priorità e domande aperte restano dominio di `STATE.md`; versioni e
conteggi restano dominio di `SOT_STATE.md`.

---

## Passo 0 — Il profilo di chiusura (#217 I5)

La chiusura **non è un rito completo**: è un percorso scelto in ragione di ciò che la sessione ha
prodotto. Enzo, 2026-08-18: *«non adotta strategie sufficientemente smart per selezionare le azioni
strettamente necessarie in ragione delle modifiche generate dalla sessione»*. Chiedilo **prima di ogni
altra cosa**:

```bash
bash scripts/profilo-chiusura.sh                     # leggibile — serve nel messaggio finale
eval "$(bash scripts/profilo-chiusura.sh --eval)"    # per usarlo negli step
```

Tre profili — `documenti` · `codice` · `codice+db` — che governano **quattro** passi: atlante,
armamento, clone del database, lettura dalle macchine.

**Non governano la propagazione.** Il linux-pc resta allineato **sempre** (Enzo, stesso giorno): è
gemello di produzione, runner della CI e macchina della verifica lunga, e un clone indietro è un guasto
silenzioso, non un risparmio. Si adatta il costo, non si salta il passo.

Se lo script non esiste, esegui tutto — nessun profilo significa nessuna scorciatoia, mai il contrario.

---

## Passo A — Rinfresca `docs/kb/SOT_STATE.md` (granulare)

RI-DERIVA i numeri, non fidarti della memoria: conteggi DB via `psql`, lista migration via
`ls db/migrations`, versioni da `package.json`, tag via `git tag`, HEAD via `git rev-parse`. Aggiorna le
sezioni snapshot/stack/DB/CI. Se un conteggio non è ri-derivabile (tunnel giù), marcalo
`(non ri-derivato — tunnel down)`.

---

## Passo B — Allinea i registri d'azione

- `docs/kb/SOT_BACKLOG.md`: marca `✅ DONE` gli item chiusi in questa sessione; **aggiungi i nuovi**,
  inclusi i **flussi interrotti / pending** scoperti oggi.
- `docs/kb/DEBT_REGISTER.md`: marca `RISOLTO` i debiti chiusi; **aggiungi i nuovi**.
- **Rinvii → registro HOLD**: qualunque item parcheggiato per decisione (es. «sessione dedicata») va nel
  `## ⏸ HOLD register` di `SOT_BACKLOG.md` come blocco strutturato (`status: HOLD` +
  `hold-reason`/`decided-by`/`hold-since`/`reactivation-trigger`), oppure `WAIT-INPUT`
  (`input-richiesto`/`perche-solo-tuo`) — **mai** come prosa `DEFER`/`sospeso`. Lo impone
  `handoff_lint.py` (H1/H2/S2).
- **Consolida il journal di sessione** (P4, design §11.4) — solo se `.handoff/session-journal.ndjson`
  esiste: leggilo (più un fratello `.recovered` se il boot ha segnalato una sessione morta senza
  chiusura) e assicurati che OGNI voce `pending`/`decision`/`defer`/`interrupted` sia riflessa in una
  SoT. Poi troncalo (`: > .handoff/session-journal.ndjson`) e rimuovi il `.recovered` — la chiusura
  consuma il journal, come il marker. Durante la sessione i fatti si appendono con
  `bash scripts/journal-append.sh <kind> <ref> <note>`.

---

## Passo C — Rigenera gli artefatti DERIVATI (anti-drift)

Gli artefatti derivati si rigenerano **qui**: prima del lint, prima del commit, e quindi **prima della
propagazione e del deploy**. Un artefatto rigenerato dopo il commit non entra nel commit; uno rigenerato
dopo la propagazione arriva ai cloni **vecchio**.

```bash
python docs/kb/tools/build_index.py    # riscrive docs/kb/INDEX_PATHS.md + index_paths.yaml
python docs/kb/tools/build_atlas.py    # riscrive docs/kb/atlas/ (atlas.yaml + ATLAS.md)
python docs/kb/tools/build_derivati.py # A CASCATA dall'atlante: agent-operations, concepts-corpus, ADR_INDEX (#217 I6)
```

**`build_derivati.py` va SEMPRE dopo `build_atlas.py`, e l'ordine è la sostanza** (#217 I6): due dei tre
artefatti che rigenera — `agent-operations.json` e `concepts-corpus.jsonl` — non derivano dal codice ma
**da `atlas.yaml`**. Rigenerare l'atlante e fermarsi lì lascia indietro i suoi figli, che il giorno dopo
misurano il passato senza saperlo. Misurato il 2026-08-18: `concepts-corpus.jsonl` non aveva 6 concetti
esistenti e ne portava 4 di uno schema ritirato settimane prima.

**`build_atlas.py` gira se `PASSO_ATLANTE=esegui`** (Passo 0). Quando il profilo dice `salta` non è una
scorciatoia: è una **misura** — `atlas_freshness()` ha già verificato che nessuno dei file descritti
dall'atlante è cambiato dopo la sua generazione. Se la misura **non è possibile**, il profilo dice
`esegui`: si degrada verso il lavoro in più, mai verso il silenzio.

**L'atlante NON è opzionale** (Enzo, 2026-08-18): è la SoT interrogabile del progetto, e
`check_concetti_agente.py` si ferma invece di misurare quando è superato. La chiusura è l'ultimo momento
in cui il repo è fermo, quindi è l'unico in cui rigenerarlo ha senso.

⚠ **L'ordine è la sostanza, e l'errore è stato commesso davvero** (S1068): l'atlante era stato rigenerato
*a metà sessione*, poi altri commit hanno toccato i file che descrive, e il boot successivo l'ha trovato
**rosso**. È stato rimediato a mano **dopo** la propagazione — cioè i cloni hanno ricevuto la versione
vecchia.

---

## Passo D — Lint gate (BLOCCANTE)

Da eseguire DOPO i passi A/B (così i conteggi ri-derivati e il registro sono a posto) e PRIMA del commit:

```bash
python docs/kb/tools/handoff_lint.py    # default: BLOCCANTE — exit 1 su qualunque FAIL (design §4.1/§8)
```

10 check: `D1-D4` drift/freshness · `S1-S2` struttura/vocabolario · `H1-H2` integrità HOLD / no-orphan-defer
· `A1-A2` referenziale / loop-closed. Correggi **ogni** FAIL:

- `D2/D3` conteggi stale in SOT_STATE → ri-derivali nel Passo A · `D4` è un warn (sha pre-commit, atteso).
- `H1` campo HOLD mancante → completa il registro · `S2` status non valido → usa il vocabolario chiuso.
- `H2` defer grezzo nelle priorità di STATE o in un item attivo → spostalo nel `## ⏸ HOLD register` con
  un `reactivation-trigger`.
- `A1` `#ref` dangling in STATE → correggi il riferimento o aggiungi l'item · `A2` item marcato chiuso ma
  ancora attivo → rendilo terminale nel backlog.

**Mai pushare su un gate rosso** (R3). Tunnel giù → `--no-db`. Anteprima senza bloccare → `--warn-only`.

---

## Passo E — Commit + push (rebase-safe, design §11.5/P5)

```bash
git add .handoff/STATE.md docs/kb/SOT_STATE.md docs/kb/SOT_BACKLOG.md docs/kb/DEBT_REGISTER.md docs/kb/INDEX_PATHS.md docs/kb/index_paths.yaml
git commit -m "chore: handoff S<N>"
git pull --rebase origin main
python docs/kb/tools/handoff_lint.py    # RI-lint DOPO il rebase; rosso ⇒ fermati, correggi, rifai
git push origin main
```

I path assenti sono no-op. Su conflitto di rebase in STATE/SOT/backlog: risolvilo come parte della
chiusura, fondendo i fatti delle due sessioni — mai `-X ours/theirs`, mai `--no-verify`.

Per misurare i casi «niente da committare / niente da pushare» (che il core impone di dichiarare):

```bash
git status --porcelain -- .handoff/STATE.md docs/kb/   # vuoto ⟹ niente da committare
git rev-list origin/main..HEAD                          # vuoto ⟹ niente da pushare
```

Registra il salto con `bash scripts/close-log.sh step pubblica saltato "<ragione>"`.

---

## Passo F — Propaga ai cloni (full-alignment doctrine)

`scripts/close-propagate.sh` è la **singola propagazione canonica** di chiusura — entrambi i canali
imposti (repo+payload+deploy via `align-clones`, ecosistema Claude via `align-claude-ecosystem`, clone DB
del linux-pc), design §12-§13.

**NON prefissare `MSYS_NO_PATHCONV=1`**: close-propagate lo gestisce per singola chiamata ssh; un export
globale rompe lo staging del path di `jq` di `align-claude-ecosystem` (fix S1000 `936a690`).

```bash
bash scripts/close-propagate.sh --delta --resilient --auto-deploy
```

Fallback se l'orchestratore non c'è:

```bash
MSYS_NO_PATHCONV=1 bash scripts/align-clones.sh all --delta --resilient --auto-deploy
```

- Entrambi i canali devono girare su ogni host **raggiungibile**; un canale fallito su host raggiungibile
  è **fail-loud**, non uno skip silenzioso (design §13.3). Host irraggiungibile → skip+warn, non blocca.
- Legge il marker `.session-align.marker`; deploya VM/linux-pc solo se i commit hanno toccato
  `apps|packages|db|scripts|deploy`; consuma il marker.
- Opt-out deploy: `HEURESYS_CLOSE_NODEPLOY=1`.
- Riporta cosa è stato propagato, gli host saltati e ogni `marketplace_sha DRIFT` (versioni plugin —
  aggiornamento manuale di Enzo per macchina, design §13.2).

---

## Passo G — Leggi dalle macchine (S1054)

**Vale se `PASSO_VERIFICA=esegui`** (Passo 0). Nel profilo `documenti` non c'è nessun deploy di cui
leggere l'esito, e chiedere comunque produrrebbe `NON-VERIFICATO` — che non è informazione, è rumore che
somiglia a un allarme.

`close-propagate.sh` chiama già `scripts/verifica-deploy.sh` in coda: **non rilanciarlo a mano**, serve
solo leggerne l'esito.

L'ultimo atto non è un'azione ma una **lettura**: «armato» è ciò che ho fatto io, «deployato» è un fatto
che vive sulle macchine. Vocabolario chiuso, da riportare **testualmente**, mai tradotto in «tutto ok»:

**DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO**

Subito dopo l'armamento lo stato normale è **IN-VOLO** (la CI dura 20-30 minuti): non è un problema e non
si aspetta (#165). `CI-ROSSA` e `DISALLINEATO` sono guasti veri da nominare; `NON-VERIFICATO` significa
«non ho potuto guardare», che non è «a posto». Più tardi: `bash scripts/verifica-deploy.sh`.

---

## Passo H — Il messaggio finale, con il profilo

**Apri col profilo** (#217 I5), poi l'esito, poi i passi saltati **con la ragione**, presi testualmente da
`profilo-chiusura.sh`:

> *Chiusura profilo `documenti`. Stato aggiornato, commit e push fatti, cloni allineati. Saltati:
> armamento (niente da portare in produzione), clone-db (nessun file su `db/(migrations|seeds)/`),
> lettura dalle macchine (non c'è nessun deploy da verificare), atlante (misurato fresco).*

Il rendiconto è già su disco: `scripts/close-log.sh` scrive `.handoff/close-log.ndjson` (per-macchina,
gitignored) e `align-clones.sh` / `close-propagate.sh` vi registrano da soli le proprie decisioni, quindi
il diario NON dipende dal fatto che il modello si ricordi di scriverlo. Aggiungi i passi che solo la
skill conosce (`registra`, `verifica`, `pubblica`) e leggi l'insieme con `bash scripts/close-log.sh report`.

Il diario è **rendiconto, non stato**: nessuna decisione lo legge, e se sparisce la chiusura resta
corretta.

---

## Passo I — L'ultima riga: si può uscire con `/exit`? (Enzo, 2026-08-29)

```bash
bash scripts/posso-uscire.sh          # 0 = USCITA SICURA · 1 = ATTENDI · 2 = NON-VERIFICATO
```

| sopravvive a `/exit` | muore con `/exit` |
|---|---|
| deploy e clone **armati** (timer systemd) | i task in background della CLI |
| backup, storia36, ogni timer sulle macchine | gli `ssh` in primo piano |
| | gli script locali lanciati da qui |

Verdetto **testuale**, stesso vocabolario chiuso degli altri passi:

- **`USCITA SICURA`** → *«Puoi uscire con `/exit`: non si perde niente. Deploy e clone armati proseguono
  senza questa sessione.»*
- **`ATTENDI`** → non basta dire di aspettare: **nomina i task in volo uno per uno** e dichiara come
  avviserai. Lascia il task in background, e alla notifica **rilancia `posso-uscire.sh`** e comunica il
  nuovo verdetto. L'attesa è tua, non dell'utente.
- **`NON-VERIFICATO`** → «non ho potuto guardare», e di' cosa manca (di norma la directory dei task, che
  si passa con `--tasks`).

⚠ **Un lavoro remoto armato non è MAI un motivo per aspettare** (#165, #236). Se il verdetto dice
`ATTENDI`, è per qualcosa che gira **qui**.

Lo strumento esclude se stesso dal conteggio e, se non riesce a riconoscersi perché l'output è rediretto,
**lo dichiara** invece di indovinare.

---

## Vincoli specifici di questo progetto

- Push **diretto su main**, nessuna PR (repo mono-contributore).
- Il prossimo avvio non legge solo `STATE.md`: esegue il protocollo `## Session start` del `CLAUDE.md`,
  che aggrega STATE + backlog aperto + debiti aperti + roadmap di `SOT_STATE` in un menu per fasce di
  priorità. La chiusura deve registrare **tutto ciò che è affrontabile**, o quel menu sarà incompleto.
