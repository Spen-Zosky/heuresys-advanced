# Referto — #155: i percorsi di carriera puntano a posizioni morte

**Mandato**: `../prompts/2026-08-07-percorsi-carriera-155.md` · **Sessione**: S1048 · **Data**: 2026-08-07
**Stato**: **TUTTI E QUATTRO I TASK COMPLETATI.** Enzo ha autorizzato il 2026-08-07: *«rimappa tutto,
rimuovi le 20 righe e affronta i 47 casi (ma assicurati che sia possibile un rollback completo)»*.
**Esito**: `C5c` verde in tutte e quattro le parti su una corsa reale di `storia36.sh custodia`; zero
percorsi e zero obiettivi su posizioni non attive; rollback integrale collaudato. Dettaglio in §6.

---

## 0. Le due segnalazioni che il mandato mi chiede di fare subito

### (a) Il guasto è più esteso di 207 righe — riportato, non allargato

Il mandato prescrive: *«Se scopri che il guasto è più esteso di 207 righe: riportalo, non allargare
il lavoro di tua iniziativa»*. **È il caso.** Le 207 righe di `sys_position_career_paths` sono metà
del guasto. L'altra metà è su una tabella diversa, **`sys_user_target_positions`**: **97 obiettivi di
carriera su 153 non-rifiutati puntano a una posizione disattivata** (19 posizioni distinte).

La prova che sono due metà distinte, e non la stessa cosa contata due volte: riparando **solo** i
percorsi, la causa «la posizione attuale non è in alcun percorso» va da **130 a 0**, e ne emerge una
seconda, prima invisibile perché mascherata — «la posizione obiettivo non è in alcun percorso»,
**97 casi**, che è l'altra tabella. Nessuna riparazione dei soli percorsi può chiudere C5c(iii).

### (b) Conflitto fra la tua scelta di stasera e il mandato

Hai scelto **#155+#156**. Il mandato #155 vieta esplicitamente il secondo: *«Non toccare il lavoro
AI/RAG: catalogo generico, corpus dei concetti, agent-gateway restano fermi. Questo ciclo è solo
#155»* — e #156 **è** il catalogo generico dell'agente. Non lo risolvo da solo: lo segnalo e mi
attengo al mandato finché non dici tu. Vedi §5.

---

## 1. TASK 1 — Diagnosi

### a) Com'è distribuito il guasto

| | righe | posizioni distinte | percorsi coinvolti |
|---|---|---|---|
| su posizioni **morte** | **207** | 152 | 7 su 7 |
| su posizioni **vive** | 45 | 25 | 7 su 7 |

Non è concentrato: **tutti e 7** i percorsi sono colpiti, in proporzioni diverse
(`Corporate Banking Track` 57 morte / 5 vive è il peggiore, `Software Engineering Track` 1 / 7 il
migliore). Le 45 righe sane non hanno nulla di speciale: sono le posizioni che la ricostruzione
**non ha toccato** — i vertici (`CEO`, `HR Director`, `IT Director`, le `Head of *`) e i ruoli
tecnici (`Software Developer`, `System Administrator`), che infatti sono anche i soli percorsi quasi
intatti.

### b) LA DOMANDA CHE DECIDE TUTTO: la mappa esiste

**Sì, ed è la stessa che ha riparato #112.** La migrazione `000260_reattach_position_requirement_catalogs.sql`
non ha appaiato per titolo — ha usato un criterio **esatto** lasciato dalla ricostruzione stessa:
ogni assegnazione chiusa porta in nota `«chiusa dalla ricostruzione organigramma (fase N)»`, quindi
si sa **chi** occupava la posizione vecchia, e quella persona oggi ha esattamente una posizione
attiva. La mappa è quella persona.

Ri-eseguita ora sul database vivo: **133 coppie vecchia → nuova**, identiche a quelle di `000260`.

### c) Quanto copre

| | righe | posizioni morte distinte |
|---|---|---|
| coperte dalla mappa | **186** | 133 |
| **senza successore** | **21** | 19 |

Le 19 senza successore erano **già vacanti prima** della ricostruzione: nessuno le occupava, quindi
la nota non esiste e un successore non ce l'hanno (è la stessa condizione che `000260` documenta per
le sue 20).

**Zero collisioni**, verificato in due direzioni: nessuna posizione nuova è già nel percorso dove
finirebbe (186/186 spostabili), e nessuna coppia di posizioni morte converge sulla stessa viva nello
stesso percorso (0 gruppi). Lo spostamento non crea duplicati né perde righe.

### d) Le persone toccate, e il caso nominato

**153 obiettivi non-rifiutati** (96 approvati + 57 in revisione) di **143 persone distinte**; di
questi **130 erano irraggiungibili**. Tutti creati nello stesso mese, 2026-07.

`alberto.colombo@rtl-bank.org` — **confermato**, e istruttivo:

| | |
|---|---|
| posizione attuale | `POS-DIR-COORD-SPCO-1` — Specialista Sviluppo Commerciale (viva, italiana, post-ricostruzione) |
| obiettivo | `POS-TREAS-HEAD` — Head of Treasury (**viva**, ed è già tappa viva di `Corporate Banking Track`) |
| stato | APPROVED |

Il suo obiettivo è sano. Ciò che è rotto è la sua posizione **attuale**: non è tappa di alcun
percorso, perché il percorso punta ancora alla posizione morta che occupava prima. Per lui basta la
riparazione derivabile.

---

## 2. Cosa produce la riparazione derivabile — misurato, non stimato

Simulazione in transazione, poi rollback. Il check chiamato è quello **vero**
(`staging.storia36_check_c5c()`), non una sua riscrittura.

| passo | C5c(iii) obiettivi irraggiungibili | righe su posizioni morte |
|---|---|---|
| oggi | **130** | percorsi 207 · obiettivi 97 |
| dopo lo spostamento dei 186 percorsi | **97** | percorsi 21 · obiettivi 97 |
| + rimozione delle 21 orfane | 97 *(invariato)* | percorsi 0 · obiettivi 97 |
| + rimappatura dei 104 obiettivi | **0** ✅ | percorsi 21 · obiettivi 0 |

E qui il reperto che decide la strategia: **azzerato (iii), scatta (iv)**.

> `ERROR: C5c(iv): 47 obiettivi che non sono una crescita (…) (es. alberto.messina@rtl-bank.org: Securities Dealer → Analista Crediti)`

**C5c(iv) era già rosso prima**, e non lo si vedeva perché (iii) abortiva la funzione prima di
arrivarci. Misurato sullo stato attuale, senza alcuna riparazione: **105 obiettivi non-crescita**
(84 «posizione obiettivo senza titolari» + 21 «non è più in alto»).

**La rimappatura non introduce il difetto: lo riduce da 105 a 47.** Ma non lo azzera, e i 47 che
restano sono esattamente il gruppo di giudizio.

---

## 3. TASK 2 — Strategia, nei tre gruppi che il mandato chiede

### Gruppo A — DERIVABILE: 186 righe di `sys_position_career_paths` → spostare

Un percorso di carriera è un'affermazione **sulla posizione** («questa posizione è una tappa del
percorso X»), esattamente come un requisito. Segue la posizione con la stessa mappa tracciabile di
`000260`, con la stessa giustificazione e lo stesso rischio (nullo: 0 collisioni). Si sposta, non si
copia — per la stessa ragione scritta in `000260`: copiare lascerebbe 186 righe appese a posizioni
spente e ne creerebbe altrettante.

**Nessun giudizio di dominio richiesto.** Chiude la causa «posizione attuale fuori dai percorsi»: 130 → 0.

### Gruppo B — DA RIMUOVERE: 21 righe orfane, con una distinzione

Le 19 posizioni senza successore, e cosa esiste di vivo con lo stesso mestiere:

| mestiere | righe | posizioni vive con lo stesso titolo | già nel percorso |
|---|---|---|---|
| Bank Teller | 6 | **0** | 0 |
| Compliance Officer | 4 | **0** | 0 |
| FX & Money Markets Dealer | 2 | **0** | 0 |
| Marketing Specialist | 2 | **0** | 0 |
| Internal Auditor | 2 | 3 | **0** |
| Securities Dealer | 2 | 2 | **2** (una riga) |
| Investment Advisor · Legal Counsel · Risk Analyst | 3 | **0** | 0 |

Rimuoverle **non cambia C5c(iii)** (misurato: 97 → 97): serve solo a soddisfare la seconda metà del
criterio di chiusura, «zero percorsi su posizioni non attive». Una sola riga è propriamente
*ridondante* (`Securities Dealer` in `Corporate Banking Track`, dove 2 posizioni vive omonime sono
già tappe). Le altre 20 sono **tappe che scompaiono dal percorso**: dopo la rimozione,
`Banking Operations Track` non conterrà più alcun `Bank Teller`/`Cassiere`, e
`Compliance & Legal Track` resterà con una sola tappa viva.

⚠️ **Questo è un effetto di prodotto, non solo pulizia**: un percorso che perde il gradino d'ingresso
non è più un percorso. Lo segnalo qui invece di eseguirlo in silenzio.

### Gruppo C — GIUDIZIO DI DOMINIO: 104 obiettivi su 19 posizioni morte → **decidi tu**

La mappa copre **tutte e 19**. Tecnicamente potrei rimappare tutto e chiudere (iii). **Non lo faccio,
e non perché manchi il dato: perché la semantica è diversa.** La mappa dice *«chi occupava X oggi
occupa Y»*. Applicata a un obiettivo diventa *«chi aspirava a X ora aspira a Y»* — che non è la
stessa affermazione. Un percorso segue la posizione; un'aspirazione appartiene alla persona.

L'elenco, ordinato per persone coinvolte. La colonna «tiene il mestiere?» è **la mia lettura, da
confermare**, non un dato del database:

| posizione obiettivo (morta) | diventerebbe | persone | tiene il mestiere? |
|---|---|---|---|
| Risk Manager | Risk Manager | **21** | ✅ identico |
| Line Manager - Operations | Responsabile Direzione Pagamenti | **14** | ❌ altro mestiere |
| Bank Manager | Direttore di Filiale | 11 | ✅ è la traduzione |
| Bank Manager | Direttore di Filiale | 7 | ✅ è la traduzione |
| Securities Dealer | Direttore di Filiale | 6 | ❌ altro mestiere |
| Investment Advisor | Consulente Clientela | 5 | ✅ plausibile |
| Bank Teller | Cassiere | 4 | ✅ è la traduzione |
| Financial Analyst | Analista Monitoraggio Crediti | 4 | ✅ plausibile |
| Investment Advisor | Consulente Clientela | 4 | ✅ plausibile |
| Chief Risk Officer | Responsabile Direzione Risk Management | 3 | ✅ plausibile |
| Financial Analyst | Analista Crediti | 3 | ✅ plausibile |
| Financial Analyst | Analista Bilancio e Segnalazioni | 3 | ✅ plausibile |
| Financial Analyst | Consulente Clientela | 3 | ❌ analista → commerciale |
| Head of Commercial Banking | Responsabile Direzione Istruttoria ed Erogazione | 2 | ⚠️ dubbio |
| IT Director | Responsabile Direzione Antiriciclaggio | 2 | ❌ altro mestiere |
| Operations Director | Direttore Divisione Crediti | 2 | ❌ altro mestiere |
| Bank Teller → Cassiere · Investment Advisor → Consulente Clientela | | 3 | ✅ traduzioni |

**Il criterio che suggerirei** (non applicato): rimappare **solo** dove la posizione nuova conserva il
mestiere — identità di titolo, traduzione italiana dello stesso ruolo, o stessa famiglia
professionale. Dove il mestiere cambia (`Line Manager - Operations` → `Pagamenti`, `IT Director` →
`Antiriciclaggio`, `Securities Dealer` → `Direttore di Filiale`), la rimappatura **fabbricherebbe
un'aspirazione che la persona non ha mai espresso**. Lì le strade oneste sono due: riportare
l'obiettivo alla posizione viva che meglio rappresenta *quel* mestiere, oppure azzerarlo e far
ri-esprimere l'aspirazione.

**Ordine di grandezza**: ~28 persone su 143 cadono nel gruppo «mestiere diverso o dubbio». La
maggioranza (~115) è nel gruppo derivabile. **Non è quindi una decisione di prodotto che blocca
tutto** — ma è una decisione, e sono le 28 persone a cui il prodotto mostrerebbe un traguardo che
non hanno scelto.

### Il residuo che nessuno dei tre gruppi copre

Anche eseguendo A + B + C per intero, **C5c(iv) resta rosso con 47 obiettivi** (da 105). Sono
obiettivi «non di crescita» per ragioni che **non discendono da #155**: 21 «non è più in alto» — la
persona punta a una posizione al suo stesso livello o più in basso — e il resto «posizione senza
titolari». Il criterio di chiusura del backlog nomina C5c**(iii)**; ma `storia36.sh custodia` esegue
`storia36_check_c5c()` per intero, quindi **la batteria resterà rossa** finché anche (iv) non è
affrontato.

Questo è il punto in cui il criterio di chiusura scritto nel backlog e la realtà divergono, ed è
giusto che lo decida tu, non io.

---

## 4. Le tre domande — risposte di Enzo (2026-08-07)

1. **Gruppo C** → rimappare **tutto**, non solo dove il mestiere si conserva.
2. **Gruppo B** → rimuovere le righe orfane comunque.
3. **C5c(iv)** → affrontare i 47 in questo ciclo.
4. **Condizione trasversale** → *«assicurati che sia possibile un rollback completo»*.

Come sono stati eseguiti i 47 senza inventare corrispondenze: **non si è scelto a intuito**. Si è
ri-derivato il bersaglio con la regola che li ha generati (`05_career.sql:184-211`) applicata
all'organigramma di oggi. Reperto che lo rende lecito: **tutti e 164 gli obiettivi portano
`metadata->>'storia36' = 'C5'`** — sono dato generato, non aspirazioni scritte da persone
nell'applicazione; e seed e check pretendono **le stesse tre condizioni**, quindi non c'è alcun
giudizio discrezionale da esercitare. Misurato: **44 persone su 44 hanno un bersaglio valido, zero
senza candidato**, quindi nessun obiettivo è stato cancellato per mancanza di alternativa. Le 3
righe rimosse sono doppioni: persone con due obiettivi rifiutati che ri-derivano allo stesso
bersaglio (il seed ne prevede **uno per persona**).

---

## 5. Il rollback — costruito, poi collaudato, e due volte visto fallire

`SELECT staging.storia36_155_rollback();` riporta il database allo stato di partenza leggendo il
giornale `staging.storia36_155_undo` (358 righe). Il collaudo confronta l'**impronta md5 di ogni
riga di ogni colonna** delle due tabelle prima dell'andata e dopo il ritorno.

Il collaudo ha trovato **due difetti veri, prima che toccassero la produzione**:

| # | difetto | come si è manifestato | correzione |
|---|---|---|---|
| 1 | l'archivio indicizzava per chiave primaria, ma §5 **ricalcola le chiavi**: due voci collidevano e `ON CONFLICT DO NOTHING` ne scartava una in silenzio | ritorno a **162 righe invece di 164** | l'archivio è un **giornale ordinato** (`passo` + `undo_id`), si disfa **a ritroso, riga per riga** — un `UPDATE` set-based non ha ordine e qui perde righe |
| 2 | il trigger `sys_utp_set_updated_at` riscrive `updated_at = now()` a ogni UPDATE, annullando il ripristino degli orari | righe giuste (164), **digest diverso** | il trigger si sospende per la durata del ritorno; se qualcosa solleva, la transazione annulla anche la sospensione |

Esito finale, con **controprova**: entrambe le tabelle tornano identiche (`sys_position_career_paths`
252 righe digest `9eec1161…`, `sys_user_target_positions` 164 righe digest `92edf452…`), e sporcando
**una sola riga** l'impronta cambia (`9eec1161…` → `28229d5a…`) — il confronto sa vedere le
differenze, quindi il verde significa qualcosa.

---

## 6. TASK 3 e 4 — eseguiti

**Migrazione**: `db/migrations/000277_realign_career_paths_and_targets.sql`, marcata `@migrate: once`
(§3 e §5 cancellano righe: senza il marcatore la catena, che gira a ogni deploy, trasformerebbe
«rimuovi ciò che non è una crescita» in una regola permanente che un domani mangerebbe un obiettivo
legittimo scritto da una persona vera). Applicata con `bash db/scripts/migrate.sh` → *«273 migrations
applied, 2 skipped»*.

| misura | prima | dopo |
|---|---|---|
| percorsi di carriera | 252 | **231** |
| … di cui su posizioni spente | **207** | **0** |
| obiettivi | 164 | **161** |
| … di cui su posizioni spente | **104** | **0** |
| obiettivi irraggiungibili — `C5c(iii)` | **130** | **0** |
| obiettivi non-crescita — `C5c(iv)` | **105** | **0** |
| archivio del ritorno | — | 358 righe |

**Custodia** (`bash db/scripts/storia36.sh custodia`, referto
`qa_artifacts/storia36/custodia-2026-08-07.md`): **`C5c` verde in tutte e quattro le parti** — è il
criterio di chiusura scritto nel backlog, ed è soddisfatto.

**Suite dei moduli toccati**: `career-paths`, `career-path-steps`, `position-career-paths`,
`user-target-positions`, `user-career-plans` (+ scope), `me-career-tabs`, `positions`,
`position-succession-relevance` → **9 file, 51 test, tutti verdi**.

### L'unico rosso residuo della batteria NON discende da #155 — provato, non asserito

`C5g: 27 successori che non riportano alla posizione né ne fanno il mestiere altrove` (es.
`andrea.greco@rtl-bank.org → Compliance Officer`). Non si vedeva prima perché `C5c` abortiva la
batteria — la stessa dinamica per cui `C5c(iv)` era invisibile dietro `C5c(iii)`.

**Prova che è preesistente**, eseguita con il rollback appena costruito: `C5g` conta **27 casi sullo
stato attuale** e **27 casi dopo aver eseguito `storia36_155_rollback()`**, cioè sullo stato
precedente alla migrazione. Identico prima e dopo ⇒ non causato da `000277`. Il mandato prescrive di
riportarlo separatamente e non allargare il lavoro: → **item nuovo nel register**.

---

## 7. La verifica LIVE ha trovato un difetto che i test verdi non vedevano

La Definition of Done del progetto (ADR-0026) vieta di chiudere su un test verde e pretende una
dimostrazione live con una persona reale. Fatta — e ha pagato.

**Login reale su PROD come `alberto.colombo@rtl-bank.org`**, `GET /v1/me/career-paths`:

```
fromPositionTitle: "Securities Dealer"      ← incarico CHIUSO nel 2020
paths: []                                    ← nessun percorso
```

La sua posizione attuale è `Specialista Sviluppo Commerciale`. **La query dell'endpoint filtrava
`kind = 'PRIMARY'` ma non lo stato, con un `LIMIT 1` privo di `ORDER BY`**: restituiva
un'assegnazione qualsiasi fra quelle mai avute, chiuse comprese
(`apps/api/src/modules/me/repository.ts`, due punti: `loadMyCareerPaths` e la query del profilo).

**Difetto preesistente, che il riallineamento ha smascherato**: finché le posizioni disattivate
avevano ancora percorsi attaccati, la pagina mostrava *qualcosa* e nessuno se ne accorgeva; tolti
quei percorsi, è rimasta vuota. **Riguarda 140 persone su 163** — chiunque abbia cambiato posizione.
Gli altri moduli (`analytics`, `insights`, `dashboard`, `org-health`, `capability-composition`)
filtrano correttamente: verificato, il difetto è isolato in `me`.

**Test visto fallire prima del fix** (`me-career-tabs.integration.test.ts`):
`AssertionError: expected 'Securities Dealer' to be 'Direttore di Filiale'`. Il test include la
guardia che lo rende falsificabile — pretende che la persona abbia almeno un incarico chiuso,
altrimenti passerebbe anche col difetto.

**Dimostrazione live dopo il fix**, login reale in due passi (password + TOTP) sull'API collegata al
database di produzione:

```
passo 1 — mfa_required
passo 2 — success | ruoli: ['USER', 'TEAM_MEMBER']
=== GET /v1/me/career-paths ===
  parte da : Specialista Sviluppo Commerciale     ← la posizione VERA
  percorsi : 1
     - Corporate Banking Track (VERTICAL) | tappe: 5
```

`Corporate Banking Track` è esattamente il percorso in cui vive `Head of Treasury`, il suo obiettivo:
il traguardo che il prodotto gli mostrava come irraggiungibile ora è raggiungibile, **e si vede dalla
sua pagina**.

⚠️ **Il fix dell'endpoint NON è in produzione**: il mandato vieta il push, quindi il commit resta
locale e PROD continua a servire il codice precedente finché non autorizzi il deploy.

---

## 8. Cosa resta vero e va ricordato

- **Due percorsi hanno perso il gradino d'ingresso**: nessun `Cassiere`/`Bank Teller` è più tappa di
  `Banking Operations Track`, e `Compliance & Legal Track` resta con una sola tappa viva. È
  l'effetto autorizzato del gruppo B, non un difetto — ma è un fatto di prodotto, non di pulizia.
- **`000260` non era annullabile** («reversibile solo dallo snapshot»): `000277` lo è, e la
  differenza è che conserva la provenienza. Vale come precedente per la prossima migrazione che
  sposta righe.

---

## Appendice — comandi delle misure

Tutte le query sono in `<scratchpad sessione>/diag155{,b,c,d,e,f}.sql`. Le due che contano:

- **la mappa**: identica al blocco `mappa_pos` di `db/migrations/000260_reattach_position_requirement_catalogs.sql:51-70`
- **la prova**: `BEGIN; UPDATE …; SELECT staging.storia36_check_c5c(); ROLLBACK;` — chiama il check
  reale già presente nel database, non una sua copia.
