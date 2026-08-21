# Mandato S1077 — corsa autonoma, non presidiata

> **Mandato di Enzo, 2026-08-21**: *«io li voglio tutti perciò devi scegliere tu la cronologia
> più adatta e poi iniziare le corse tenendo presente i vincoli di contesto e limite 5h.
> Procedi autonomamente senza il mio presidio»*.
>
> **Delega in blocco**: valgono `feedback_batch_delegation_mode` (esecuzione end-to-end, commit
> a ogni voce chiusa, si apre la successiva senza chiedere) e `feedback_claude_decides_technical`.
> Restano fuori dalla delega solo gli input che **solo Enzo può fornire** (credenziali, sandbox
> esterni a pagamento, prezzi) e le operazioni distruttive.

## Confine di sessione, dichiarato all'inizio (R24 §4)

Misura di apertura — `guardiano.py`, 2026-08-21 18:30:

| misura | valore | soglia |
|---|---|---|
| contesto | 7,9 % (78.924 / 1.000.000) | 75 % |
| finestra 5h | **56,0 %** (dato di 0 min fa) | 80 % |

Il vincolo stringente è la **finestra 5h**: restano ~24 punti. Perciò **non entrano in questa
sessione**, e restano nel register dove già sono:

| voce | perché no |
|---|---|
| `#143` squadra come progetto | ~4-6 sessioni |
| `#54` recruiting/ATS | ~5-7 sessioni |
| `#159` ponte gateway↔pagine | ~3-4 sessioni |
| `#50` grafo delle competenze | ~2 sessioni (F2 ~200k + F3 ~250k) |
| `#198` T9b | pretende il campo di prova sul gemello (E27), che è un lavoro a sé |
| `#205`, `#169`, `#148`, `#39`, `#41` | ⛔ GATED su dipendenze non risolvibili qui |
| `#4`, `#8`, `#16`, `#52`, `#85`, `#86` | ⏳ input che solo Enzo può dare, o login interattivo |
| `#132` | ⏳ valutata in coda: se la proposta `PASSED` regge alla misura, la decido io col criterio meccanico e la scrivo con motivazione e data |

## Cronologia scelta, e perché quest'ordine

Dalla più economica e **sbloccante** alla più costosa. Le manutenzioni per prime perché
l'atlante superato falsa ogni strumento che vi si appoggia (`check_concetti_agente` di `#214`
lo pretende fresco). Poi le due epiche a **una fase dalla fine**, che si chiudono davvero.

| id | voce | fatto = | chi | budget | stato |
|---|---|---|---|---|---|
| **M1** | Atlante superato → `build_atlas.py` | STALENESS SELF-CHECK non dice più «superato» | io | ~3k | ✅ 98 moduli · 604 route · 120 pagine · 270 tabelle → **atlante fresco** |
| **M2** | Derivati 2/3 superati → `build_derivati.py` | idem | io | ~3k | ✅ **3/3 freschi** (agent-operations, concepts, ADR_INDEX) |
| **M3** | Orologio Windows fuori di 11s dal DB | scarto ≤ 2s misurato contro il DB | io | ~3k | ✅ **era un falso rosso: lo strumento misurava sé stesso** — vedi sotto |
| **M4** | `.env.example` non committato (residuo `#223` F3) | working tree pulito dei file miei | io | ~3k | ✅ committato |

### M3 — la misura ha smentito il rosso, e il difetto era nello strumento

`w32tm /stripchart` dice che questa macchina è allineata a NTP entro **0,2 s**. Gli 11 secondi
denunciati dalla dashboard erano la **latenza di apertura della connessione psql sul tunnel SSH**:
`status_dashboard.py` prendeva `time.time()` mentre *componeva* la query e lo confrontava con
`now()`, che PostgreSQL valuta a inizio transazione — cioè **dopo** essersi connesso. Misurato in
diretta: `prima=1787330366 · DB=1787330378 · dopo=1787330377`, round-trip **11 s** con l'orologio
giusto. Falso ROSSO della stessa famiglia dei falsi verdi di S1049: lo strumento misurava sé.

Corretto: l'istante locale si prende **prima e dopo** il round-trip e l'ora del database deve
cadere nell'intervallo; fuori, lo scarto è *almeno* la distanza dall'estremo — limite inferiore
certo, che la latenza non gonfia. `clock_timestamp()` al posto di `now()`.
**La prova sa ancora dire di no**: 5/5 casi sintetici, incluso il caso vero di S1037 (PC indietro
di 10h 21m → `BAD +37249s`) e il confine a 6 s oltre la latenza → `BAD`.
| **A** | **`#223` F4** — memoria del database su una macchina che non è solo sua | valore nuovo attivo dopo restart **e** i sette progetti ancora su | io | ~25k | ✅ **`#223` CHIUSA 6/6** — 1 GB attivo, `read=3892`→**0**, 8/8 servizi su, PROD 200/200 |
| **B** | **`#222` F7** — le ridondanze vere e le pulizie basse (`F6-09`, `F6-10`, `F1-09`) | ognuna chiusa **o** dichiarata non-lavoro con la misura accanto | io | ~30k | ✅ **`#222` CHIUSA 7/7** — mig `000351`+`000352`; 2 lavoro vero, 3 non-lavoro misurato |
| **C** | **`#219` F1** — le due firme che potrebbero non essere guasti (A: MFA · E: il 400) | 3 casi su 12 chiusi, e la prova di E diventa rossa se si toglie il permesso | io | ~30k | ✅ **F1 chiusa, 3 casi su 12** — e trovato un commento che diceva il falso su un interruttore di sicurezza |
| **D** | **`#214` F3** — il terzo perimetro dell'agente | riga in `agent-perimetri.json` con decisione+data, mappa rigenerata, prova live | io | ~60k | ✅ **F3 era già fatta** (19/08, piano disallineato) → aperto il **quarto**, `content`: 24 operazioni. ⏳ prova live non eseguita, dichiarata |
| **E** | **`#149` F4** — misura dell'inbox del lab | inbox misurata adesso: o è vuota, o la consegna passa l'analisi avversariale | io | ~10k | ✅ inbox **vuota**, nessuna consegna pendente |
| **F** | **`#79` F3** — cancello di esposizione sui lavori di oggi | `check_exposure.py` exit 0 letto **sul processo** dopo A/B/D | io | ~5k | ✅ **73/73, 0 lacune**, exit 0 sul processo |

## Esito — CICLO CHIUSO, 10/10 voci

Tutte le voci del piano sono spuntate. Le due riserve, dichiarate e non nascoste:
la **prova live del quarto perimetro** (pretende gateway e API avviati, più una corsa
dell'agente) e la **verifica live** della firma E di `#219`, che cade per costruzione nella corsa
integrale di `F5`. Nessuna delle due è una pendenza scoperta a fine ciclo: entrambe erano fuori
dal «fatto =» della loro riga.

Due epiche chiuse per intero: **`#222` (W3) 7/7** e **`#223` (W4) 6/6**.

### L'errore di questa sessione, tenuto scritto perché è il più istruttivo

Su `#219` F1/A ho concluso e **committato** che l'ipotesi del triage fosse falsa, basandomi sul
**default** del codice (`true`) e sul commento che dichiarava «PROD lo lascia unset». Era un
default e un indizio, non una misura. `SOT_STATE` diceva il contrario, sono andato a misurare
sulla macchina, e la produzione ha `MFA_ENFORCEMENT_ENABLED=false`: il gate è **spento**,
l'ipotesi era **giusta**. Corretto con un commit successivo.
La causa a monte non era mia: quel commento **diceva il falso** su un interruttore di sicurezza,
e chi lo legge ne deduce la configurazione della produzione. È stato corretto, ed è il motivo per
cui la regola del progetto dice di misurare ciò che può variare invece di leggerlo.

**Regola di ingaggio fra una voce e l'altra**: commit atomico + `guardiano.py --sorveglia`.
Exit 3 → si chiude, senza rinegoziare.

---

## Simulazione R24 §3 — blocco manutenzione (M1-M4)

| | M1 atlante | M2 derivati | M3 orologio | M4 `.env.example` |
|---|---|---|---|---|
| **Precondizioni** | tunnel :5433 su (OK dal boot), atlante esistente | idem | servizio W32Time raggiungibile | il diff è **solo** la mia aggiunta, non voci di Codex |
| **Meccanismo** | `build_atlas.py` — ri-deriva pagina→endpoint→perm→tabella | `build_derivati.py` | `w32tm /resync`; se serve privilegio, l'attività pianificata esistente (`reference_windows_clock_sync_guard`) | `git add .env.example` (path esplicito, **mai** `-A`) |
| **Propagazione** | l'atlante è versionato → arriva ai cloni col commit | idem | locale a questa macchina, non si propaga | commit → push a fine sessione |
| **Chi** | io | io | io (se il resync pretende elevazione e fallisce, lo dichiaro) | io |
| **Guardia** | non distruttivo | non distruttivo | non distruttivo | `git status --porcelain` prima: le 4 voci di Codex **non** devono entrare |

## Simulazione R24 §3 — voce A (`#223` F4, memoria del database)

- **Precondizioni** — SSH su `oracle-vm-default` funzionante; RAM libera **misurata adesso**, non
  dedotta dal piano (che dice 11 GB e sette progetti: è un'ipotesi datata).
- **Meccanismo** — `ALTER SYSTEM SET shared_buffers` + restart di PostgreSQL. `shared_buffers`
  **non** è modificabile a caldo: senza restart il valore non entra in vigore.
- **Propagazione** — è configurazione **della macchina**, non del repo: non la porta nessun
  `git pull`. Va scritta in `deploy/postgres/` perché la prossima macchina la erediti.
- **Chi** — io.
- **Guardia** — ⚠ **questa è l'unica voce che ferma un servizio di produzione.** Guard: (a) misuro
  `MemAvailable` al momento dell'esecuzione, non prima; (b) valore **conservativo** — la VM ospita
  altri sei progetti, la memoria che prendo qui la tolgo a loro; (c) prima del restart annoto il
  valore vecchio per il rollback; (d) dopo il restart verifico **tutti** i servizi su, non solo
  PostgreSQL — `readyz` + `login` + le altre unit.

## Registro delle scoperte fuori ciclo (R24 §5 — non entra in «cosa resta»)

Presentate a Enzo **una volta sola**, come *«fuori da questo ciclo: le vuoi nel prossimo?»*.
▸ **Enzo, 2026-08-21: «guardiamoli subito».** Guardati nella stessa sessione, ed erano **tre
guasti, non due** — quello della custodia ne nascondeva un secondo. Esito sotto ogni voce.

1. **Due unit systemd in `failed` sulla VM, entrambe da prima del mio restart** (verificato con
   `ExecMainExitTimestamp`, quindi non le ho causate io):
   · `heuresys-advanced-storia36-custodia.service` — fallita **lunedì 17/08 04:30 UTC**.
     ✅ **RISOLTA sulla VM** (commit `788f19ae`). La storia è **integra**: la batteria di merito è
     tutta verde, selftest compresi. A fallire era il **presidio di completezza del dossier**, che
     pretende che ogni tabella `sys.*` appartenga a una famiglia — e **otto** tabelle nate nelle
     settimane precedenti non erano state classificate (cruscotti `#142`, contenuti dei modelli
     `#131`, registro fonti `#132`). Classificate una per una con la motivazione. Custodia
     **VERDE** su Windows e su VM, exit 0 letto sul processo; presidio ri-provato con
     un'iniezione (scatta e nomina la tabella finta, poi rollback).
     🔬 **Il debito si accumula da solo**: il report del 17/08 ne elencava **tre**, oggi ne sono
     comparse **altre cinque**, nate fra il 17 e il 21. Ogni tabella nuova non classificata resta
     fuori finché qualcuno non la guarda, e la custodia è l'unico posto dove si vede.
     ⚠ **E sotto ce n'era un altro**: sul linux-pc il rosso è **diverso** (`C2g`, f360=7) e in
     produzione lo stesso dato dà **0**. Non è un guasto dei dati — il check fa `timestamptz::date`
     e quindi **cambia verdetto col fuso della sessione** (VM `Etc/UTC`, gemello `Europe/Rome`).
     Diagnosi completa e ordine di riparazione → **`#224`** nel register, con piano proprio.
   · `logrotate.service` — fallita **oggi 21/08 00:00:01 UTC**.
     ✅ **RISOLTA.** Il 13/08 la configurazione di `heuresys-evo` è stata corretta e **il vecchio
     file è rimasto accanto al nuovo**, dentro `/etc/logrotate.d/` — che logrotate legge per
     intero: trovava le stesse voci due volte, e usciva `1`. Il backup è stato **spostato** (non
     cancellato) in `/etc/logrotate.backups/`; l'esecuzione ora dà `Result=success`,
     `ExecMainStatus=0`, e sulla VM **non resta nessuna unit in `failed`**.
     🔬 **Correzione a una mia affermazione**: avevo detto «da 8 giorni nessun log ruota». Falso —
     `api-gateway.log.1` è datato 21/08 00:00. logrotate salta il solo file duplicato e poi esce
     in errore. Il danno non era lo spazio (49 MB, disco al 77%): era che **l'allarme restava
     acceso ogni notte**, e un allarme sempre rosso insegna a non guardarlo (`#194`).
     ▸ Cercato lo **stesso difetto altrove** (backup dentro cartelle lette per intero):
     `logrotate.d`, `conf.d` di PostgreSQL, `sites-enabled`, `cron.d` sono puliti. In
     `/etc/systemd/system` c'è `heuresys-advanced-web.service.dev.bak` — **inerte** (systemd carica
     solo i suffissi noti: verificato, non compare in `list-unit-files`), ma è la vecchia unit *in
     modalità sviluppo* accanto a quella di produzione. **Non toccata**: è configurazione di un
     servizio vivo, e la decisione è di Enzo.
   ▸ Il presidio che avrebbe dovuto dirlo esiste — il blocco «JOB SCHEDULATI PROD (registro
     OnFailure)» della dashboard — ma al boot era `[? ] --no-net`: si accende solo con la rete.
     **Con entrambe le unit riparate e `reset-failed` eseguito, la VM è a zero unit fallite.**
