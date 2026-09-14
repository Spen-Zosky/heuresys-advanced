# Come funziona davvero il controllo degli accessi in Heuresys

Scritto il 2026-09-14 per Enzo (Cowork, sessione `decisioni-250-240`; adottato nel repo dalla CLI in S1100 lo stesso giorno). Ogni numero qui dentro è stato misurato sul database di produzione quel giorno; i numeri cambiano, e quando cambieranno questo documento sarà vecchio — il comando che li rigenera è in fondo, e vale più dei numeri stessi. **Non copiare questi numeri in altri documenti**: qui sono datati e dichiarati tali, altrove diventerebbero cristallizzazioni (⭐ IL PUNTO FISSO del `CLAUDE.md`).

## La cosa da capire per prima: RBAC risponde a una domanda sola

RBAC sta per «controllo degli accessi basato sui ruoli». Nella tua piattaforma risponde a **una** domanda: *questa persona ha il diritto di compiere questa azione?* Per esempio: può leggere le retribuzioni? può cancellare un documento? può far partire una sincronizzazione ESCO?

Non risponde alla domanda successiva, che è altrettanto importante: *le retribuzioni **di chi**?* Un capo reparto e il direttore generale hanno tutti e due il diritto di leggere le retribuzioni, ma non delle stesse persone.

Questa separazione è la scelta architetturale centrale del tuo sistema, e ha un nome nei tuoi documenti: **domini ortogonali** (ADR-0036, invariante I16). RBAC dice **se**; i domini dicono **su chi** e **come**. Tenerli separati è ciò che impedisce alla piattaforma di diventare un groviglio di eccezioni.

## I tre mattoni, e come si incastrano

**Il permesso** è l'unità minima: un diritto elementare, scritto come `risorsa:azione`. Esempi veri, presi dalla tua piattaforma: `content:delete`, `user:update`, `mentorship:create`, `reference_sync:trigger`. Alcuni hanno un terzo pezzo, `:self`, che li limita ai propri dati: `team:read:self`, `document:read:self`. Oggi i permessi sono **231**.

**Il ruolo** è un mazzo di permessi con un nome che significa qualcosa per un essere umano: `HRMS_MANAGER`, `TEAM_LEADER`, `CEO`. Oggi i ruoli sono **14**.

**L'assegnazione** lega una persona a un ruolo, dentro un tenant, con una data di concessione e una eventuale data di revoca — non si cancella un'assegnazione, la si revoca, così resta la storia di chi poteva cosa e quando. Le coppie ruolo-permesso oggi sono **1015**.

Una persona può avere **più ruoli insieme**, e allora i suoi permessi sono l'unione dei mazzi. È esattamente il caso di Valentina Conti, che vedremo alla fine.

## I 14 ruoli, misurati il 2026-09-14

| ruolo | famiglia | permessi | quante persone |
|---|---|---|---|
| `PLATFORM_ADMIN` | funzionale (di piattaforma) | 229 | 2 |
| `TENANT_ADMIN` | funzionale | 201 | 3 |
| `HRMS_MANAGER` | funzionale | 160 | 2 |
| `MANAGER` | gerarchico-operativa | 80 | 9 |
| `BLUEPRINT_MANAGER` | funzionale | 68 | 1 |
| `PROCESS_OWNER` | funzionale | 60 | 1 |
| `USER` | gerarchico-operativa | 56 | 162 |
| `READ_ONLY` | funzionale | 47 | 1 |
| `CEO` | gerarchico-operativa | 47 | 1 |
| `TEAM_LEADER` | gerarchico-operativa | 19 | 36 |
| `BRANCH_MANAGER` | *(nessuna dichiarata)* | 13 | 10 |
| `TEAM_MEMBER` | gerarchico-operativa | 12 | 152 |
| `ORG_DIRECTOR` | funzionale | 12 | 1 |
| `WHISTLEBLOWING_CUSTODIAN` | funzionale | 11 | 1 |

Tre cose si leggono a colpo d'occhio in questa tabella, e valgono più di una spiegazione astratta.

**Il numero di permessi non misura il potere.** `ORG_DIRECTOR` ne ha dodici, eppure è un direttore di organizzazione: il suo potere non sta nel numero di azioni che può compiere, sta in **quante persone** quelle azioni raggiungono. È la dimostrazione pratica che RBAC da solo non basta a descrivere un profilo.

**`USER` ce l'hanno tutti** (162 persone su 164 utenze). Non è un ruolo residuale: è il **pavimento** garantito a chiunque — il portale del dipendente e l'accesso completo ai propri dati. Nei tuoi documenti è l'invariante I17, e ha una conseguenza forte: il permesso su sé stessi batte ogni altro asse. Nessuna gerarchia può togliere a una persona i propri dati.

**Le due famiglie di ruoli** (`functional` e `hierarchical_operational`) sono la traccia in tabella dei due domini ortogonali: i ruoli funzionali dicono *che mestiere fai*, quelli gerarchico-operativi *che posto occupi nella catena*.

## Il secondo asse: su chi, e quanto in chiaro

Ottenuto il permesso, il sistema si pone la seconda domanda, e la scompone in due.

**Su quali persone.** La risposta viene dall'albero delle **unità organizzative** — chi dirige quale unità, e quali unità stanno sotto quale altra. È lì che il sistema cammina per decidere il perimetro, e non nell'albero delle posizioni: la differenza sembra sottile ma è stata una correzione vera, fatta il 14 agosto. Chi sta a capo di una catena vede tutto ciò che le sta sotto, a ogni livello, **e niente delle catene sorelle** — anche se è un dirigente e l'altra persona è un impiegato semplice. Il vertice vede tutto perché la sua catena *è* l'azienda, non per un'eccezione che gli è stata concessa.

**Quali dati, e in che forma.** Qui c'è la parte che quasi nessun sistema ha, e che nel tuo è centrale: i dati sono divisi in **classi** (per esempio: dati personali, retribuzione, competenze, valutazioni) e per ogni combinazione di mestiere e classe è dichiarato **come** si vedono. Gli stati possibili sono quattro:

| stato | cosa vuol dire |
|---|---|
| `edit` | lo vedi e lo puoi cambiare |
| `read` | lo vedi e basta |
| `mask` | **sai che esiste, ma il valore è coperto** |
| `none` | per te non esiste |

Il terzo è quello che fa la differenza. Un sistema normale ha solo «vedi» e «non vedi»; il tuo ha anche «vedi la riga, il soggetto, il periodo e lo stato, ma non la cifra». Serve a chi deve amministrare senza dover leggere: è il caso di `PLATFORM_ADMIN`, che è un mandato **tecnico** e non HR, e per questo retribuzioni e valutazioni gli arrivano coperte su tutta la superficie, dossier compreso.

## La regola d'oro: il sensibile passa solo dalla catena organizzativa

Di tutte le regole, questa è quella da ricordare se se ne ricorda una sola.

I dati sensibili di un'altra persona — chi è, quanto guadagna, come è stata valutata, che competenze ha — si raggiungono **soltanto** risalendo la catena organizzativa che porta a lei. Essere nella stessa squadra non basta. Lavorare allo stesso processo non basta. Avere un ruolo importante altrove non basta.

È il motivo per cui il tuo modello regge alla domanda difficile: *«un capo progetto può vedere lo stipendio di chi lavora nel suo progetto?»* No, se quella persona non gli riporta organizzativamente. La sua autorità è funzionale, non gerarchica, e il sensibile passa solo dalla gerarchia.

L'unica deroga è per mandato esplicito: i ruoli **HR** (`TENANT_ADMIN`, `HRMS_MANAGER`) tengono l'accesso sensibile su tutta l'azienda cliente perché è il loro mestiere. `HRMS_MANAGER` in particolare è **plenipotenziario sui dati business del tenant**: CRUD completo, per mandato tuo esplicito.

## Le quattro porte chiuse anche agli onnipotenti

Nemmeno il mandato HR apre tutto. Restano quattro eccezioni dichiarate:

1. **Le segnalazioni whistleblowing** — isolamento assoluto: solo il custode, nemmeno la piattaforma.
2. **Le categorie particolari di dati** — una classe tenuta deliberatamente vuota e presidiata.
3. **Le retribuzioni dei vertici** — protette da una soglia sulla catena.
4. **Le valutazioni non ancora comunicate** — finché non sono state condivise con l'interessato, non si leggono.

Il primo punto non è un proposito: **è misurabile**. Sui 231 permessi della piattaforma, `PLATFORM_ADMIN` ne possiede 229. I due che non ha sono esattamente `whistleblowing:read` e `whistleblowing:manage`, e appartengono a un solo ruolo, `WHISTLEBLOWING_CUSTODIAN`, che ha una sola persona. La regola più delicata del sistema è verificabile con una query di tre righe — ed è così che dovrebbe essere ogni regola importante.

## Il caso concreto di oggi: le due HR manager di RTL Bank

Serve a vedere i due assi che lavorano insieme, su persone vere.

| | Valentina Conti | Maria Colombo |
|---|---|---|
| ruoli | `HRMS_MANAGER` + `ORG_DIRECTOR` + `TEAM_LEADER` + `USER` | `HRMS_MANAGER` + `USER` |
| unità che dirige | Divisione Risorse Umane e Organizzazione | Ufficio Amministrazione del Personale |
| a chi riporta l'unità | Direzione Generale | alla divisione di Valentina |
| livelli sopra di lei | 2 | 3 |
| sottoalbero | 3 unità, 6 posizioni | 1 unità, 2 posizioni |

**Sul primo asse sono uguali**: entrambe hanno `HRMS_MANAGER`, quindi entrambe possono, sui dati business, tutto ciò che quel mandato consente — su tutte le 158 persone di RTL Bank, con le quattro eccezioni di cui sopra.

**Sul secondo asse sono diverse**, e la differenza conta per gli *altri* ruoli di Valentina: il suo `ORG_DIRECTOR` e il suo `TEAM_LEADER` agiscono sulla sua catena, che è più alta e più larga di quella di Maria — la quale, di fatto, le riporta.

La morale, che è il punto di tutto il documento: **per sapere cosa vede una persona non basta guardare il suo ruolo, e non basta guardare il suo posto nell'organigramma. Servono tutti e due, e si moltiplicano invece di sommarsi.**

## Postilla del 2026-09-14, poche ore dopo: le due osservazioni qui sotto sono state lavorate — e applicate

Enzo ha chiesto di trasformare la query del whistleblowing in una sentinella e di sistemare `BRANCH_MANAGER`. Entrambe le cose vivono ora nella migrazione `db/migrations/000414_un_ruolo_chiave_dichiara_la_sua_famiglia_e_il_whistleblowing_ha_una_guardia.sql`, scritta e provata a vuoto da Cowork; **applicata in produzione dalla CLI in S1100 (stesso giorno)** dopo la prova generale sul gemello (`ci-rehearsal.sh`, due passate, verde). Da quel momento `BRANCH_MANAGER` è `hierarchical_operational` e la sentinella è la cinquantesima a zero. La tabella dei 14 ruoli qui sopra fotografa lo stato **prima** dell'applicazione.

La sentinella si chiama `sys.v_whistleblowing_fuori_dal_custode` ed è **bloccante**: pretende zero righe, cioè nessun ruolo diverso dal custode può portare un permesso `whistleblowing:*`. Se un giorno si accende, la cura non è allargarla — si revoca la concessione, oppure si cambia l'isolamento con un ADR nuovo.

`BRANCH_MANAGER` viene dichiarato `hierarchical_operational`, e non per analogia: tutte e dieci le persone che lo portano dirigono un'unità, e tutte e dieci quelle unità sono di tipo `BRANCH`.

Quindi le due righe che seguono raccontano com'era, non com'è.

## Due osservazioni, registrate e non lavorate

**`BRANCH_MANAGER` non ha una famiglia dichiarata.** È l'unico dei quattordici: tutti gli altri sono `functional` o `hierarchical_operational`, lui ha il campo vuoto, e le persone che lo portano sono dieci. Non rompe niente oggi — la famiglia è una classificazione, non un cancello — ma è una riga che, letta fra sei mesi, non dirà da che parte sta. Vale un minuto di qualcuno.

**I numeri di questo documento invecchiano.** Sono veri il 2026-09-14 e falsi appena qualcuno aggiunge un permesso. Per rigenerarli:

```
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f docs/kb/xtras/misura-rbac.sql
```

Il file `misura-rbac.sql` sta in questa stessa cartella (`docs/kb/xtras/`) e produce anche la tabella delle famiglie, la porta del whistleblowing e i permessi che mancano a `PLATFORM_ADMIN`. La regola che vale più dei numeri è quella che hai scritto tu nel CLAUDE.md del progetto: un dato che può variare si misura prima di prenderlo per buono, e non si cristallizza in un documento — si scrive il comando che lo produce.

## Dove sta scritto tutto questo, nelle tue fonti

| cosa | dove |
|---|---|
| i due assi, la matrice dei domini, le quattro eccezioni | ADR-0036 (supersede ADR-0027) |
| `PLATFORM_ADMIN` è tecnico, non HR; il quarto stato `mask` | ADR-0032, invariante I20 |
| il pavimento garantito a ogni persona | invariante I17 |
| il sensibile solo dalla catena organizzativa | invariante I18 |
| il principio della catena e delle catene sorelle | invariante I19 |
| `HRMS_MANAGER` plenipotenziario sui dati business | invariante I22 |
| l'albero delle unità come fonte del perimetro | invariante I16, correzione del 2026-08-14 |
