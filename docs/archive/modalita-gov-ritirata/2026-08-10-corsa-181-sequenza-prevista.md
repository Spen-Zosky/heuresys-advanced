# Corsa su `#181` — la sequenza, scritta PRIMA di eseguirla

**Scritto**: 2026-08-10, S1053 · **stato**: previsione, non resoconto

> **Perché questo file esiste.** Enzo, a metà sessione: *«sono convinto che tu non abbia
> alcun controllo sul funzionamento delle sessioni gov e che procedi per tentativi ed
> errori»*. Aveva ragione su un fatto specifico: ho proposto `Z-251` a un lavoratore per
> tre messaggi di fila senza aver mai letto la sua classe di rischio — è classe D, e
> nessuna corsia la ammette. Misurare **dopo** aver proposto non è controllo.
>
> Questo documento è la risposta in forma falsificabile: dichiaro **prima** cosa farà la
> corsa, passo per passo, con il file e la riga che lo fa accadere. Poi si esegue. Se la
> corsa reale diverge — un cancello che non c'è, un perimetro diverso, un esito non
> previsto — la previsione è sbagliata e si vede senza discutere.
>
> Tutto ciò che segue è **letto dagli script**, non ricordato.

---

## 0. Il vincolo che ho scoperto leggendo, e che cambia l'assegnazione

`gov-lib.sh:95-108` dichiara, in testa alla funzione che declassa le credenziali:

> «Conseguenza di processo, dichiarata: **un cluster che per chiudersi deve SCRIVERE sul
> database non appartiene alla corsia non presidiata.**»

Il meccanismo (`gov_declassa_credenziali_db`, `gov-lib.sh:110-138`): nel `.env` dell'albero
le sole due righe `POSTGRES_USER` / `POSTGRES_PASSWORD` sono riscritte a `gov_worker`, e le
righe `POSTGRES_SUPERUSER*` sono **cancellate**. La garanzia non è un divieto aggirabile: è
`default_transaction_read_only=on` **sul ruolo**, cioè imposto dal DBMS.

**Conseguenza diretta su `#181`**: i 7 rilievi riguardano `drift-check.ts`, che vive come
`globalSetup`/teardown della **suite di integrazione** — e quella suite *scrive* (fixture,
login veri, INSERT). Quindi:

- il lavoratore **può** scrivere il codice e ragionarci sopra;
- il lavoratore **non può** eseguire la suite per provarlo: la sua identità è in sola lettura;
- la suite la esegue **gov**, nel cancello `test` dell'istruttoria, che si impone l'identità
  piena per la sola durata dei cancelli (`gov-chiudi.sh:148-158`), senza toccare il `.env`
  dell'albero.

**Previsione 0** — questa è la più importante e la più facile da smentire: *il lavoratore su
`#181` non riuscirà a produrre da solo una prova eseguendo la suite di integrazione, e se ci
prova otterrà un errore di sola lettura dal database, non un fallimento dei test.*

---

## 1. Cosa succede prima che il lavoratore esista

| passo | dove | cosa fa |
|---|---|---|
| 1.1 | `driver.sh:122-129` | numero di lavoratori: se supero il tetto di config viene **ridotto**, non rifiutato |
| 1.2 | `gov_assegna` — `gov-lib.sh:401-416` | **il driver assegna, il lavoratore NON sceglie**. Senza, N lavoratori chiamerebbero `zp_state prossimo` e otterrebbero tutti lo **stesso** cluster: la selezione è deterministica |
| 1.3 | `driver.sh:399-402` | lucchetto per cluster: se un altro driver ce l'ha già, **lo salta** e lo dice |
| 1.4 | `gov_worktree_prepara` — `gov-lib.sh:154-228` | l'albero di lavoro. Se esiste già, si riallinea **solo se non ha nulla da perdere**: né file non salvati, **né commit propri contati per CONTENUTO** (`git cherry`, patch-id) |
| 1.5 | `gov-lib.sh:213-220` | `git worktree` **non porta i file ignorati**: `.env`, `.env.local`, `.npmrc` e `.secrets/` vengono copiati a mano, altrimenti il lavoratore nasce senza credenziali |
| 1.6 | `gov_declassa_credenziali_db` | l'identità scende a `gov_worker` (vedi §0) |
| 1.7 | `driver.sh:412-416` | **guardia**: se l'albero ha ancora le credenziali di produzione, il lavoratore **non parte** |
| 1.8 | `gov_worktree_pronto` — `gov-lib.sh:229` | serve `node_modules` nell'albero, altrimenti `--prepara-alberi` prima |

**Previsione 1** — l'albero `w1` esiste già da ieri e il suo ramo `gov/w1` ha commit. Se
quei commit sono già in main **per contenuto**, l'albero si riallinea; altrimenti stampa
*«ha lavoro da perdere … lo lascio com'è»* e resta indietro. Da `gov_rientro.py` risultava
`gov/w1` con 0 commit non in main → **prevedo che si riallinei**.

> ✅ **VERIFICATO senza corsa** (2026-08-10): l'albero `D:/heuresys-gov-workers/w1` ha
> **0 file non committati** e **0 commit propri** contati con `git cherry` sul contenuto.
> Entrambe le condizioni di `gov-lib.sh:186-190` sono soddisfatte → **si riallineerà**.
> È la previsione più debole delle tre, perché misurabile in anticipo; la lascio scritta
> perché una previsione che si può controllare prima è comunque una previsione.

---

## 2. Il recinto, mentre lavora

- **un ramo per lavoratore**, mai `--detach` (`gov-lib.sh:205-211`): con l'HEAD staccato i
  commit nascerebbero orfani e il lavoro di una corsa sarebbe recuperabile solo dal reflog —
  che è **esattamente ciò che è successo** a `f059a057`, il commit da 5 file e 317 righe
  citato nel commento come caso reale;
- il diario delle azioni vive **fuori** dall'albero (`gov-chiudi.sh:88`), altrimenti sparirebbe
  col riallineamento;
- lo stato del lavoratore sta in `<albero>/.zp/`, e due lavoratori non si vedono **perché
  hanno due alberi**, non per un prefisso sui file (`gov-lib.sh:239-250`).

---

## 3. L'istruttoria — `bash scripts/gov-chiudi.sh 1`

Cinque controlli, in quest'ordine. Ognuno che fallisce aggiunge un **rilievo**; un solo
rilievo rende il verdetto **rosso** (`gov-chiudi.sh:216-221`).

| # | controllo | riga | rosso quando |
|---|---|---|---|
| 1 | **perimetro** | `:67-80` | ha toccato file fuori dal perimetro dichiarato. Conta i commit **e** ciò che è rimasto non committato; `.zp/` e `.handoff/` sono concessi |
| 2 | **diario** | `:84-105` | nessun diario → non c'è modo di verificare cosa ha fatto |
| 3 | **c'è un lavoro?** | `:108-124` | 0 commit e 0 file, oppure **file non committati** («un lavoro non committato non è verificabile né trasferibile») |
| 4 | **cancelli** | `:126-190` | `typecheck`, `lint`, `test` girano **nell'albero**, con `SUITE_LOCK_FILE` forzato a quello del repo (un solo lucchetto, condiviso: protegge il **database**, non la cartella) e con l'identità piena |
| 5 | **evidenze** | `:192-214` | `zp_evidence valida <cluster>` con `ZP_ROOT=<albero>`: rifiuta `echo`/`printf`/`true` come prova e pretende **due livelli diversi** |

E la riga che chiude tutto (`gov-chiudi.sh:242`):

> **«il lavoro resta su `gov/w1`. `gov-chiudi` NON fa merge, per costruzione.»**

Un verdetto verde non dice «portalo in main»: dice «non ho trovato ragioni per non farlo».

**Previsione 3** — sul cancello 5: se il lavoratore produce codice ma non registra due prove
su livelli diversi, il verdetto è **rosso** anche con typecheck, lint e test verdi. È già
successo a `Z-112` alla prima istruttoria, e sarà il punto più probabile di rosso anche qui,
perché §0 gli toglie il modo più naturale di produrre la seconda prova.

---

## 4. Dove prevedo che questa corsa possa rompersi

1. **La prova impossibile** (§0). È il rischio principale, ed è strutturale, non di esecuzione.
2. **`#177` non è mai stato provato sul campo**: `zp_review.py` esiste con 13 prove, ma
   nessun lavoratore l'ha ancora usato. Questa sarebbe la prima volta.
3. **Il perimetro di `#181` non esiste** — ✅ **VERIFICATO, ed è il primo ostacolo concreto**.
   `#181` è una voce del **registro**, non un cluster di `zp.config.yaml`, e `gov_assegna`
   (`gov-lib.sh:401-416`) pesca **solo** dai cluster che `zp_state perimetri --json` mette
   sotto `parallelo`, cioè quelli con `perimetro:` dichiarato. Misurato adesso, corsia
   `safe`, 1 lavoratore: `parallelo: ['Z-123']` — e basta. **Nessun lavoratore può ricevere
   `#181` così com'è.** Va prima creato il cluster in `zp.config.yaml`, con classe e
   perimetro (`apps/api/test/**`, `apps/api/vitest.config.ts` — lo stesso di `Z-112`).

   > ⚠️ **`#181` e `Z-181` sono due cose diverse.** Le voci del registro si numerano `#N`,
   > i cluster del piano `Z-N`, e le due serie **si sono sovrapposte**: `Z-181` esiste già
   > ed è `{classe: C, perche: "schema e dati: sys_notification"}` (`zp.config.yaml:406`).
   >
   > Non è un'osservazione teorica: il primo controllo che ho scritto per verificare questo
   > punto cercava `^  (#181|Z-181):` e ha risposto «trovato», facendomi credere per un
   > istante che `#181` fosse un cluster assegnabile. **Era `Z-181`.** Un'istruzione a un
   > lavoratore che dica «lavora su 181» è un incidente che aspetta solo di accadere.
4. **Il database è occupato** dal cancello di verifica finché non chiude: una corsa lanciata
   adesso falserebbe il proprio esito, ed è la firma di `Z-251`.

---

## 5. Come si legge questo file dopo la corsa

Si confronta riga per riga con quanto è accaduto. **Le previsioni 0, 1 e 3 sono le tre che
possono smentirmi in modo netto.** Se reggono, il controllo sull'impianto è dimostrato; se
cadono, Enzo aveva ragione e questo file è la prova del contrario di ciò che sostiene.
