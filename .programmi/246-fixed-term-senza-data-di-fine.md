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

- [ ] **F1 — La conversione dei 51** — `fixed_term` con anzianità > 12 mesi diventa `permanent` e
      perde la data di fine. Emendando **il file che crea** l'oggetto dove serve (ADR-0035: la
      catena si ri-applica per intero, una `UPDATE` a valle viene disfatta al giro dopo), con
      giornale di rollback e post-condizione che protegge anche ciò che **non** doveva cambiare —
      i 109 `permanent` restano 109, e le retribuzioni non si toccano (misurate congrue ad agosto
      contro il pavimento CCNL dalla `000311`).
- [ ] **F2 — La scadenza coerente, per i contratti futuri** — un `fixed_term` deve avere una
      `end_date`, e quella data non può superare i 16 mesi dalla data di assunzione. È un vincolo
      sui dati, non un controllo nel codice: dove possibile un `CHECK`, altrimenti una sentinella.
- [ ] **F3 — Le due sentinelle, provate ROSSE** — ① nessun `fixed_term` con anzianità oltre i 12
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
