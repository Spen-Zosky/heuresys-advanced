# 246 — I contratti a termine assegnati a caso a un terzo dell'organico

> **item**: #246 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: NON AVVIATO · **regola decisa da Enzo il 2026-09-05** (vedi §La regola)
> **nasce-da**: la bonifica di S1087 sui contratti scaduti (mig `000371`). Misurando il parco per
> applicare il rinnovo ricorrente è emerso un secondo fenomeno, **fuori dal punto non verde** che
> quella voce doveva chiudere, e quindi riportato invece che eseguito.

## ⚠ Il titolo di questa voce è cambiato, e la ragione conta

Nella prima stesura si chiamava «i venticinque contratti a tempo determinato senza data di fine»,
e diceva che il difetto erano **25 righe a cui mancava una data**.

**Era una lettura sbagliata, e l'ha smontata Enzo con una domanda sola**: *«25 contratti a termine
su un organico di 158 persone mi sembra assolutamente eccessivo»*. Aveva ragione, e misurando si è
visto che il bersaglio era **il doppio** e di natura diversa.

## Il fatto, misurato il 2026-09-05 in produzione

```
sys_user_contracts:  160 righe · 160 persone distinte · una riga a testa · tutte ACTIVE
  permanent    109   (tutte senza data di fine, com'è giusto)
  fixed_term    51   ← il 32% dell'organico
       di cui   25   senza data di fine
                26   con una scadenza futura
```

**Un terzo dell'organico risulta a tempo determinato.** Nel settore bancario italiano è una
proporzione che non esiste.

E il gruppo che sembrava sano — i 26 «con scadenza», che nella prima lettura avevo classificato
come normali — sta **peggio** dell'altro:

| | senza data di fine | con scadenza futura |
|---|---|---|
| quanti | 25 | **26** |
| anzianità media | 10,2 anni | **12,2 anni** |
| il più anziano | assunto 2004-09-11 | assunto **2005-03-11** |
| quadri direttivi (QD*) | 4 | **6** |

Ci sono persone assunte nel 2005, con vent'anni di servizio e inquadramento da quadro direttivo,
che risultano **con un contratto a termine in scadenza**.

## La causa, e perché nessuno se n'era accorto

Il tipo di contratto è stato **assegnato senza guardare l'anzianità né il livello** — quasi
certamente sorteggiato in fase di generazione dei dati. Non è «manca una data»: è che il campo
`user_contract_type` non ha nessuna relazione con i fatti della persona.

Invisibile per due ragioni che si sommano:

1. **nessuna sentinella guarda quel campo.** `v_incarico_attivo_senza_contratto` cerca chi non ha
   **più** un contratto in vigore; un `fixed_term` senza fine è in vigore per sempre, e uno con
   scadenza futura non è ancora scaduto. Per costruzione, nessuno dei 51 può comparire lì;
2. **il rapporto 51/160 non è mai stato messo su carta.** Un numero che nessuno scrive non è
   sbagliato: è invisibile.

## La regola (Enzo, 2026-09-05) — è la specifica, non un suggerimento

> **Nessun contratto a termine o a tempo determinato può essere assegnato a chi ha più di 12 mesi
> di anzianità. E per ognuno va calcolata la scadenza in modo coerente: dopo 16 mesi un contratto
> deve essere passato a tempo indeterminato.**

Due soglie con due mestieri diversi:

- **12 mesi** — il confine dell'**ammissibilità**: oltre, il tipo `fixed_term` è semplicemente
  sbagliato e va corretto;
- **16 mesi** — il confine della **durata massima**: un contratto a termine non può protrarsi
  oltre, quindi la sua scadenza si calcola entro quel limite dall'assunzione.

### Cosa dice la regola applicata ai dati di oggi

```
a termine, anzianità > 12 mesi  →  51   (da convertire)
a termine, anzianità ≤ 12 mesi  →   0   (nessuno resta a termine)
a termine, anzianità > 16 mesi  →  51
il più recente dei 51           →  20,7 mesi di anzianità
```

**Tutti e 51 vanno a tempo indeterminato, e nessuno resta a termine.** Non c'è nessuna scadenza da
calcolare sui dati esistenti: nessun contratto è ammissibile come `fixed_term`.

Il calcolo coerente della scadenza serve comunque, e serve **per il futuro**: quando nascerà un
contratto a termine legittimo — una persona assunta da poco — la sua `end_date` dovrà stare entro
i 16 mesi dall'assunzione, e non potrà mancare.

## Le fasi

- [x] **F1 — La conversione dei 51** — FATTA S1088, mig. 000375, 51 convertiti in produzione, rollback provato — `fixed_term` con anzianità > 12 mesi diventa `permanent` e
      perde la data di fine. Emendando **il file che crea** l'oggetto dove serve (ADR-0035: la
      catena si ri-applica per intero, una `UPDATE` a valle viene disfatta al giro dopo), con
      giornale di rollback e post-condizione che protegge anche ciò che **non** doveva cambiare —
      i 109 `permanent` restano 109, e le retribuzioni non si toccano (misurate congrue ad agosto
      contro il pavimento CCNL dalla `000311`).
- [x] **F2 — La scadenza coerente** — FATTA S1088 (mig. 000376, sentinella invece di CHECK: il vincolo dovrebbe leggere unaltra tabella), per i contratti futuri** — un `fixed_term` deve avere una
      `end_date`, e quella data non può superare i 16 mesi dalla data di assunzione. È un vincolo
      sui dati, non un controllo nel codice: dove possibile un `CHECK`, altrimenti una sentinella.
- [x] **F3 — Le due sentinelle, provate ROSSE** — FATTE S1088, mig. 000376, tre iniezioni verificate e disfatte — ① nessun `fixed_term` con anzianità oltre i 12
      mesi; ② nessun `fixed_term` senza scadenza o con scadenza oltre i 16 mesi dall'assunzione.
      Entrambe raccolte da `db_health`, entrambe **provate rosse** iniettando un caso e
      disfacendolo, come la `000373` ha fatto sulle sue quattro porte: una sentinella mai vista
      rossa non è una prova. ⚠ Attenzione al fatto che una vista `sys.v_*` nuova diventa
      automaticamente sentinella a zero (memoria: `new_sys_view_becomes_sentinel`).
- [ ] **F4 — Il rapporto, scritto** — la quota di contratti a termine sull'organico diventa un
      numero che qualcuno guarda. È la seconda metà della causa: il difetto è sopravvissuto perché
      nessuno l'aveva mai messo su carta.

## Da NON fare

- **Dare una data ai 25 senza fine e fermarsi lì.** Era la prima lettura, ed è sbagliata: lascerebbe
  intatti i 26 che stanno peggio.
- **Convertire senza il giornale di ritorno.** È una scrittura di massa su dati di produzione che
  descrivono il rapporto di lavoro di persone reali.
- **Toccare le retribuzioni.** Non c'entrano con questo difetto e sono già state verificate.

## Chiuso quando

Nessun contratto a termine appartiene a chi ha più di 12 mesi di anzianità, ogni contratto a
termine ha una scadenza entro i 16 mesi dall'assunzione, e due sentinelle a zero — provate rosse —
lo mantengono nel tempo.

---

## ✅ S1088 (2026-09-06) — F1, F2 e F3 CHIUSE IN PRODUZIONE

### La misura, ri-fatta prima di agire

Il piano era del giorno prima, e i suoi numeri erano un'ipotesi. Ri-misurato in produzione
il 2026-09-06:

```
sys_user_contracts ACTIVE:  160 righe
  permanent   109
  fixed_term   51   ·  25 senza data di fine  ·  51 su 51 con anzianità OLTRE i 12 mesi
```

⚠ **Tutti e 51**, non una parte: applicata la regola di Enzo ai dati di oggi, nessuno resta
a termine. Non è un caso limite, è la conseguenza aritmetica del fatto che l'assunzione più
recente fra loro è di anni fa.

### F1 — la conversione (mig. `000375`)

Quattro cose, come impone il metodo di bonifica §4: la **guardia** che ri-seleziona le righe
al momento dell'esecuzione (mai ereditate dalla misura scritta nel commento); il **giornale**
— riusato `staging.contratti_scaduti_undo` della `000311`, che ha già il campo `migrazione`,
invece di crearne un secondo che sarebbe una seconda verità; le **post-condizioni** che
proteggono anche ciò che *non* doveva cambiare (nessuna retribuzione mossa, i `permanent`
cresciuti esattamente dei convertiti); il **rollback dichiarato**.

⚠ **E il rollback dichiarato per primo era FALSO.** Avevo scritto di riusare
`contratti_scaduti_ripristina_ric('000375')` — ma quella funzione **pretende** un tag della
forma `RIC-YYYYMMDD` e avrebbe rifiutato il tag. Una via di ritorno che non funziona è
peggio di non averne una: la si scopre nel momento esatto in cui serve. Aggiunta la variante
generale `staging.contratti_ripristina_migrazione(tag)`; quella della `000371` resta intatta.

🔬 **Il rollback è stato ESEGUITO, non solo dichiarato**: sul clone del gemello ha
ripristinato **51 righe** e riportato lo stato a `fixed_term 51 (25 senza fine) / permanent
109` — identico alla misura di partenza. Poi ri-applicata.

### F2 + F3 — le due sentinelle (mig. `000376`)

**Perché non un `CHECK`**, e la ragione è di sostanza: entrambe le regole confrontano una
colonna di `sys_user_contracts` con la data di assunzione, che vive in un'altra tabella — un
vincolo non può leggerla. E l'ammissibilità dipende da `current_date`: una condizione che
cambia da sola nel tempo renderebbe invalida domani una riga valida oggi, facendo fallire
ogni `UPDATE` successivo.

- `sys.v_contratto_a_termine_fuori_ammissibilita` — a termine oltre i 12 mesi di anzianità;
- `sys.v_contratto_a_termine_durata_incoerente` — senza scadenza, o oltre i 16 mesi.

🔬 **Provate ROSSE dentro la migrazione stessa**, su un contratto vero e non su un caso
costruito: tre iniezioni (tipo sbagliato · scadenza troppo lontana · scadenza assente), ognuna
verificata, poi disfatte. Se una vista non vedesse il proprio caso, la migrazione **fallisce**
invece di dichiararsi verde.

### L'esito, letto dalle macchine

```
prova generale (ci-rehearsal, heuresys_ci)   VERDE · 349 migrazioni · sentinelle 33/33 a zero
                                                     (erano 31: le due nuove entrano da sole)
produzione, dopo pnpm db:migrate:vm          contratti a termine: 0
                                             v_contratto_a_termine_fuori_ammissibilita:  0
                                             v_contratto_a_termine_durata_incoerente:    0
                                             giornale 000375: 51 righe, ritorno disponibile
```

⚠ **La prova generale da sola NON bastava, e va detto**: sul database della CI la `000375`
ha convertito **0** contratti, perché quel clone non ha i dati importati da script (memoria
`ci_clone_lacks_script_imported_data`). Ha provato che la catena regge, non che la migrazione
faccia il suo lavoro — quella prova è stata fatta sul clone del gemello, che è 1:1 con la
produzione.

### E il seed che creava il difetto è stato emendato

`db/seeds/rtl-rebuild/15_user_contracts.generated.sql` porta le 51 righe fuori regola: è ciò
che le **crea**, e senza emendarlo un rebuild futuro le ricreerebbe da zero (ADR-0035). La
regola è applicata in coda al seed invece che dentro le 51 `INSERT`, così le righe generate
restano la fotografia fedele del legacy — che è il loro scopo — e la regola vive in un punto
solo.

### Cosa resta

**F4** — il rapporto: la quota di contratti a termine sull'organico come numero che qualcuno
guarda. È la seconda metà della causa («il difetto è sopravvissuto perché nessuno l'aveva mai
messo su carta»), ma il presidio meccanico ora c'è: le due sentinelle sono in `db_health` e
diventano rosse da sole.
