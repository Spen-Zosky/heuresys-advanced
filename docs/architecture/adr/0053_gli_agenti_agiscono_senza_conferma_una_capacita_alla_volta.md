# ADR-0053 — Gli agenti agiscono senza conferma anche in produzione, una capacità alla volta

- **Status**: ACCETTATO il 2026-11-03 da Enzo Spenuso (alle 14:20 UTC, 15:20 ora di Roma, nel thread «Liberare gli agenti IA in produzione»: «Sì, accetto»). L'attuazione procede per capacità, nell'ordine di §2 D6 e §3.
- **Date**: 2026-11-03
- **Redatto da**: Claude Code, thread «Liberare gli agenti IA in produzione»
- **Decided by**: Enzo Spenuso, 2026-11-03 alle 04:39 ora di Roma, sulla scheda «Dove lasciamo liberi gli agenti per vedere fin dove arrivano?» del thread «Ricostruire la visione completa di Heuresys»: «anche in produzione», cioè agenti che scrivono senza conferma sui dati veri di RTL, con due condizioni previe (informativa ai lavoratori e ritorno provato). Alla base, la sua risposta 5 dello stesso giorno: «prima liberiamo i cavalli della AI per capire fino a dove può arrivare, poi decideremo le regole».
- **Percorso accettato**: Enzo Spenuso, 2026-11-03 alle 05:15 ora di Roma, nello stesso thread: «accettato il tuo consiglio di cominciare dalle copie e passare alla produzione per capacità, una alla volta, ciascuna con il proprio ritorno provato». È il percorso che questo ADR rende obbligatorio (D2, D6, §4).
- **Supersedes**:
  - la **regola R-4** della specifica dell'agente di consolidamento (versione 4 del 2026-10-30, `consolidamento/20261030_SPECIFICA_AGENTE_CONSOLIDAMENTO_TENANT.md` nei file del progetto), nella parte «l'agente non scrive mai da solo nei dati del cliente»; resta la parte sul registro delle decisioni;
  - la **regola R-5** della stessa specifica, «niente vale senza una conferma umana, nemmeno gli abbinamenti certi», per le sole capacità attivate in modo libero;
  - **ADR-0040 §5**, nella frase «le scritture restano governate da `agent-perimetri.json` e dal gate di ADR-0033 §5.2», nella parte in cui il gate pretende un'approvazione umana per **ogni** scrittura (strato 3 di `apps/agent-gateway/src/write-gate.ts`). Le regole R1, R2 e R3 di ADR-0040 sulle letture restano intatte.
- **Non tocca**: ADR-0033 §5.2 (la classificazione di una chiamata per metodo risolto, con «non risolta ⇒ negata»), ADR-0036 §5 (le eccezioni), ADR-0045 (dati importati), ADR-0046 (perimetro del tenant), ADR-0048 (personalizzazioni), ADR-0050 D6 (gli agenti non portano mandati), ADR-0035 (ritirare non è cancellare).
- **Builds on**: ADR-0052 (la copia ripristinabile), ADR-0050 D6 (l'agente dichiara per chi agisce), ADR-0040 (l'agente legge ciò che legge la persona), regola trasversale di Enzo del 2026-10-31 (Heuresys è una piattaforma agentica, AI driven).
- **Contesto di prodotto**: `docs/product/VISIONE_INTEGRATA_HEURESYS_20261103.md`, sezione 1bis, risposta 5 (PR #154).

> **In parole semplici.**
> 1. Un agente può scrivere da solo, senza che una persona confermi, anche sui dati veri di un tenant.
> 2. Non tutto insieme: si libera **una capacità alla volta** (per esempio «collegare le unità organizzative al prototipo»), per un tenant alla volta.
> 3. Prima di liberarla servono tre cose, tutte: i lavoratori del tenant sono stati informati, tornare indietro è stato **provato** su una copia, e ogni scrittura dell'agente dice chi l'ha fatta e per conto di chi.
> 4. Il Direttore HR del tenant, ed Enzo per la piattaforma, possono spegnere una capacità in un gesto e annullare ciò che ha fatto.
> 5. Restano chiuse le cose che la legge riserva a una persona: le decisioni che producono effetti su un singolo lavoratore (assunzione, promozione, valutazione, retribuzione, fine del rapporto).

---

## §1 — Contesto

Oggi nessun agente di advanced scrive senza una persona. Il gate del gateway (`apps/agent-gateway/src/write-gate.ts`) lascia passare da solo le letture fino alla soglia di persone distinte (ADR-0040) e chiede un'approvazione umana per ogni scrittura, con esito «negato» se l'approvazione non arriva. L'agente di consolidamento propone e il Direttore HR decide (specifica, R-4 e R-5): il 1/11 il primo giro su RTL ha prodotto 40 proposte e il 2/11 la Direttrice HR le ha decise tutte, 40 su 40 confermate (registro `sys.sys_tenant_consolidation_decisions`, sessione `77b96bd7`).

Quelle regole le ha volute Enzo, e hanno fatto il loro lavoro: hanno permesso di costruire l'agente senza rischio. Il 3/11 Enzo ha deciso di cambiare direzione: prima si vede fin dove arriva l'IA, poi si scrivono le regole, e l'esplorazione avviene anche in produzione. Il thread della visione aveva raccomandato una «zona libera» fatta solo di copie; Enzo ha scelto la produzione, e alle 05:15 ha accettato il percorso per arrivarci: **prima le copie, poi la produzione, una capacità alla volta, ciascuna con il proprio ritorno provato**. Questo ADR traduce quella scelta in un modo di lavorare che si possa controllare e disfare.

Due fatti delimitano la scelta e non dipendono da essa:

- **La legge 132/2025, art. 11** (in vigore dal 10 ottobre 2025): il datore di lavoro informa i lavoratori, e le loro rappresentanze, sull'uso di sistemi di IA. È la prima delle due condizioni di Enzo.
- **Il GDPR, art. 22**: una persona ha diritto a non essere sottoposta a una decisione basata unicamente su un trattamento automatizzato che produca effetti giuridici o la incida in modo analogo. È la ragione scritta in testa a `write-gate.ts` (strato 3). Un ADR non la può sospendere; può solo stabilire dove passa il confine. L'AI Act tratta selezione, promozione, assegnazione di compiti e valutazione come sistemi ad alto rischio (Allegato III, punto 4), con obblighi dal 2 dicembre 2027.

## §2 — Decisione

**D1 — L'unità è la capacità.** Si libera una capacità, non un agente e non un modulo. Una capacità è dichiarata in un registro e porta:

- un nome e una versione (per esempio `consolidamento.organizzazione.collega`, v1);
- l'agente che la esercita;
- l'elenco **chiuso** delle operazioni di scrittura che può usare, preso dall'atlante (concetto, operazione, metodo), così che il gate la riconosca con lo stesso meccanismo di ADR-0033 §5.2 e non dal nome dello strumento;
- i gruppi di dati che tocca e quelli che non tocca;
- il suo modo di tornare indietro (D3);
- un tetto di volume per giro (righe scritte), oltre il quale l'agente si ferma.

Una capacità si attiva per un tenant alla volta, in uno di due modi: `CONFERMA` (com'è oggi: l'agente propone, una persona decide) o `LIBERA` (l'agente scrive da solo). Il modo predefinito è `CONFERMA`. Il passaggio a `LIBERA` è un gesto per quel tenant e quella capacità, registrato con chi l'ha fatto e quando.

**D2 — Tre condizioni previe, tutte, prima del modo `LIBERA`.** Il registro rifiuta l'attivazione se ne manca una.

1. **L'informativa** (legge 132/2025, art. 11). Per il tenant esiste un'informativa pubblicata, con data, versione e testo, che nomina la capacità: che cosa fa l'agente, su quali dati, che scrive senza conferma, chi lo sorveglia e come si chiede di annullare. Il datore di lavoro è il tenant; per RTL Bank, finché non ha un Direttore HR che decide per sé, la pubblica Enzo come piattaforma, come la specifica del consolidamento prevede per le conferme. Una capacità nuova richiede un'informativa aggiornata.
2. **Il ritorno provato.** Su una copia usa-e-getta della produzione la capacità gira in modo `LIBERA`, poi si torna indietro con il suo meccanismo (D3), e si confrontano tutte le righe delle tabelle toccate prima del giro e dopo il ritorno: devono coincidere. L'esito (comando, output, data) è il riferimento che il registro pretende. In più, prima della prima attivazione in produzione si fa la copia ripristinabile di ADR-0052 (`bash scripts/copia-fase.sh copia <nome>` e `prova`).
3. **Il registro «per conto di».** Ogni scrittura dell'agente lascia una riga che dice quale agente, quale capacità e versione, in quale giro, **per conto di chi** (ADR-0050 D6: la persona che ha attivato la capacità nel tenant, o quella che ha avviato il giro), quale oggetto, il valore prima e il valore dopo. La quota di scritture attribuite deve essere il 100%: una scrittura senza attribuzione è un difetto che spegne la capacità.

**D3 — Tornare indietro è parte della capacità, non un'aggiunta.** Ogni scrittura in modo `LIBERA` è annullabile una per una e per giro intero. Il meccanismo si dichiara nella capacità ed è uno dei due che il progetto già usa: un giornale `staging.*_undo` con il valore precedente (ADV/CLAUDE.md, scritture di massa), oppure, dove la storia non si sovrascrive già per costruzione, una riga nuova che sostituisce la precedente (come `tenant_consolidation_decision_supersedes_id`). Una capacità che non sa dire come si annulla una sua scrittura non può essere `LIBERA`. Annullare è un gesto del Direttore HR, di un suo delegato o di Enzo, e viene registrato anch'esso.

**D4 — Il freno resta in mano alle persone.**

- **L'interruttore**: il Direttore HR del tenant (`HRMS_MANAGER`) ed Enzo come piattaforma riportano una capacità a `CONFERMA` con un gesto, con effetto dalla chiamata successiva dell'agente.
- **Il tetto di volume** (D1): superato, l'agente si ferma e chiede, come fa oggi la soglia delle persone distinte sulle letture.
- **Lo spegnimento da sé**: una scrittura senza attribuzione, un'operazione fuori dall'elenco della capacità o un errore nel registrare il valore precedente riportano la capacità a `CONFERMA` e lo segnalano.
- **Il riepilogo**: ogni giorno in cui una capacità `LIBERA` ha scritto, il Direttore HR e Enzo trovano in una pagina che cosa ha fatto, con il comando per annullare. È la stessa forma di riepilogo unico che Enzo ha chiesto per i thread il 2026-10-23.

**D5 — Che cosa resta chiuso anche in modo `LIBERA`.** Non per prudenza, ma perché lo stabilisce la legge o un invariante che solo un altro ADR può cambiare:

- le decisioni che producono effetti su un singolo lavoratore: assunzione, promozione, assegnazione per tratti personali, valutazione, retribuzione, sanzione, fine del rapporto (GDPR art. 22; AI Act, Allegato III, punto 4). Su questi l'agente può preparare e proporre, e la decisione resta di una persona;
- le eccezioni di ADR-0036 §5 (whistleblowing, categorie particolari, retribuzione dei vertici, valutazioni non comunicate), i dati importati (ADR-0045), le voci personalizzate dal tenant (ADR-0048), tutto ciò che sta fuori dal perimetro del tenant (ADR-0046);
- la cancellazione fisica: un agente ritira marcando, non cancella (ADR-0035; specifica del consolidamento, «una voce rifiutata resta, marcata»);
- i mandati: un agente non riceve mai un ruolo di mandato (ADR-0050 D6), e il suo perimetro resta al più quello della persona per cui agisce (ADR-0040 R1).

**D6 — L'ordine.** Ogni capacità percorre sempre gli stessi due tempi, senza saltarne uno: prima gira in modo `LIBERA` su una copia usa-e-getta della produzione (la zona libera), con il suo ritorno provato lì; solo dopo passa alla produzione. Si comincia dalle capacità che descrivono la struttura e non le persone, nell'ordine dei gruppi del consolidamento (specifica, R-6): organizzazione, posizioni e ruoli, competenze, processi, indicatori e obiettivi. La prima candidata è il consolidamento dell'organizzazione su RTL Bank: l'agente collega da sé le unità del tenant al prototipo. È la capacità con più storia misurata (il giro del 1/11 e le decisioni del 2/11), quindi quella in cui si vede meglio la differenza fra ciò che l'agente avrebbe deciso e ciò che ha deciso la Direttrice HR. Ogni capacità successiva si libera solo dopo che la precedente ha girato in produzione senza annullamenti di massa. Le soglie di fiducia sotto le quali l'agente si ferma e chiede sono un parametro della capacità, fissato all'attivazione e scritto nel registro; non stanno in questo ADR, perché vanno misurate.

## §3 — Che cosa cambia nel codice (attuazione, non in questo ADR)

L'attuazione si fa a passi, ognuno con un commit e una dimostrazione dal vivo. Nessuno parte prima che questo ADR sia accettato.

| passo | che cosa | dove |
|---|---|---|
| A1 | il registro delle capacità e delle attivazioni per tenant (modo, informativa, riferimento al ritorno provato, chi, quando); campi categorici `varchar + CHECK` (RD-08) | migrazione nuova in `sys.sys_*`, con i permessi per `HRMS_MANAGER` e `PLATFORM_ADMIN` |
| A2 | il registro «per conto di»: nel diario del gate (`audit.agent_gateway_decisions`, mig. `000452`) la capacità, la versione, il giro e il «per conto di»; un esito nuovo `allow-write-autonomous` accanto a `allow-write` | `apps/agent-gateway/src/audit-sink.ts`, migrazione nuova |
| A3 | il gate: se l'operazione risolta sta nell'elenco di una capacità `LIBERA` per quel tenant e sotto il tetto, la scrittura passa senza ponte di approvazione; altrimenti tutto come oggi, e «non risolta ⇒ negata» non cambia | `apps/agent-gateway/src/write-gate.ts` |
| A4 | l'informativa: testo, versione, data di pubblicazione per tenant, visibile ai lavoratori nel portale ESS | modulo ESS (ADR-0011) |
| A5 | la prima capacità, consolidamento dell'organizzazione: la decisione presa dall'agente si registra in `sys.sys_tenant_consolidation_decisions` con `decided_by` uguale alla persona per conto di cui agisce (la colonna pretende un utente, e D6 di ADR-0050 dice che è giusto così) e un riferimento alla capacità; il ritorno è la riga che la sostituisce | `apps/api/src/modules/tenant-consolidation/` |
| A6 | interruttore, riepilogo giornaliero e pagina di annullamento | pagina del Direttore HR |

## §4 — Come si verifica che sia fatto

Per ogni capacità, prima di dichiararla `LIBERA` in produzione:

1. su una copia usa-e-getta della produzione: giro in modo `LIBERA`, ritorno, conteggio di tutte le righe delle tabelle toccate uguale prima e dopo (comando, output, data);
2. la copia ripristinabile di ADR-0052 fatta e provata;
3. l'informativa pubblicata nel tenant e leggibile da un lavoratore che fa login (dimostrazione con una persona reale del tenant, come chiede ADV/CLAUDE.md);
4. in produzione, il primo giro: 100% delle scritture con «per conto di», il riepilogo del giorno leggibile dal Direttore HR, un annullamento di una singola scrittura eseguito e verificato;
5. l'interruttore provato: riportata la capacità a `CONFERMA`, la chiamata successiva dell'agente passa di nuovo dal ponte di approvazione.

## §5 — Alternative scartate

- **Solo la zona libera** (datastore, banco dimostrativo e copie usa-e-getta): era la raccomandazione del thread della visione. Enzo ha scelto di arrivare alla produzione, e ha accettato che la zona libera resti il primo tempo obbligatorio di ogni capacità (D6; §4, punto 1).
- **Tutti gli agenti liberi insieme, con un solo interruttore**: non si saprebbe quale capacità ha prodotto un errore, e il ritorno sarebbe uno solo, per tutto. Scartata.
- **Libertà senza registro «per conto di»**: una scrittura che non si sa chi ha fatto non si può spiegare a una persona né annullare con sicurezza. Scartata.
- **Liberare anche le decisioni sulle singole persone**: lo vieta il GDPR, art. 22; non è una scelta che un ADR possa fare.

## §6 — Rischi

- **Un errore dell'agente scrive sui dati di produzione di RTL Bank.** Il danno è limitato dal tetto di volume, dall'elenco chiuso delle operazioni e dai gruppi di dati della capacità, e si ripara con il ritorno provato. Il rischio residuo è un errore che nessuno nota: per questo c'è il riepilogo giornaliero.
- **Il costo del modello cresce**, perché l'agente lavora senza aspettare. Oggi si usa l'abbonamento di Enzo (specifica, R-11); il tetto di volume limita anche questo.
- **Le regole arrivano dopo l'esplorazione**, per scelta di Enzo. Questo ADR non le anticipa: fissa solo il modo di liberare e di tornare indietro. Le regole per i clienti veri si scrivono con un ADR successivo, sulla base di ciò che le capacità liberate avranno mostrato.
