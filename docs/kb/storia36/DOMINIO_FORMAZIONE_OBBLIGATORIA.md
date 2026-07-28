# storia36 C4 — Dominio: formazione obbligatoria e certificazioni nel credito italiano

> Esito della ricerca Step 4.2 del piano (`docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md`,
> Task C4), eseguita 2026-07-28. Stessa regola del C3: **ogni parametro usato dal seed
> C4 DEVE citare una riga di questo documento**; ciò che non è sorgentato qui non entra
> nel seed, e ciò che è convenzione RTL è dichiarato come tale (§6).

## 1. Monte-ore contrattuale — CCNL Credito ABI 23/11/2023

È lo **stesso contratto** già usato dal C3 per le tranches retributive, quindi la
finestra storia36 (2023-08 → 2026-07) ricade interamente sotto la sua vigenza.

- **24 ore annue di formazione obbligatoria** — invariate nel rinnovo: *«Le ore di
  formazione obbligatoria restano 24, ma viene ampliato il numero delle ore di
  formazione aggiuntiva retribuite dalle aziende (da 8 a 13 ore)»*
  ([First CISL — infografica del rinnovo 23/11/2023](https://www.firstcisl.it/2023/11/banche-firmato-il-contratto-con-abi-colombani-contratto-di-svolta-e-innovativo-linfografica/)).
- **37 ore annue retribuite in orario di lavoro** (da 32): *«Aumentate da 32 a 37 le
  ore annue per la formazione retribuita da svolgere durante l'orario di lavoro»*
  ([Toffoletto De Luca Tamajo — rinnovo CCNL Credito](https://toffolettodeluca.it/siglato-il-rinnovo-del-ccnl-credito/)).
- La formazione professionale **è orario di lavoro** a tutti gli effetti
  ([Formarev](https://formarev.com/la-formazione-professionale-e-considerata-come-orario-di-lavoro/)).

→ **Pavimento di monte-ore usato dal C4: 24 h/anno per ogni dipendente**, pro-rata sui
mesi coperti dalla finestra (il 2023 entra da agosto, il 2026 si ferma alla frontiera).
Le 37 h sono il *tetto retribuito in orario*, non una media attesa: non vengono usate
come soglia (userebbero un numero per un significato che non ha).

## 2. Aggiornamento IVASS — 30 ore annue, e la sezione giusta è la **D**

- **Regolamento IVASS n. 40 del 2 agosto 2018** (distribuzione assicurativa e
  riassicurativa): l'aggiornamento professionale periodico è **obbligatorio per tutte
  le sezioni del RUI** (art. 86) e consiste nella partecipazione a corsi di durata
  **non inferiore a 30 ore annuali** (art. 89)
  ([FIASS — Reg. IVASS 40/2018](https://www.fiass.it/regolamenti-ivass/regolamento-ivass-40-2-agosto-2018/),
  [Intermediari Assicurativi — guida all'aggiornamento](https://www.intermediariassicurativi.it/iass-guida-intermediario/guida-formazione-ivass/aggiornamento-professionale-ivass-obbligatorio-per-gli-intermediari-assicurativi.html)).
- ⚠️ **Deroga della sezione E**: per gli intermediari a titolo **accessorio** iscritti
  nella sezione E e per i loro addetti che operano all'interno dei locali, il monte-ore
  scende a **15 ore annue** (stessa fonte). Attribuire 30 ore alla sezione E sarebbe
  citare la norma contro sé stessa.
- **La banca sta nella sezione D**: le banche, gli intermediari finanziari, le SIM e
  Poste Italiane sono iscritte alla **sezione D** del RUI, e i loro addetti alla
  distribuzione assicurativa seguono il regime pieno delle 30 ore. Il dato RTL
  intitolava l'abilitazione «Sez. E»: è stato corretto con
  `repair/2026-07-28_c4_rui_sezione_d_oneshot.sql` (30 righe), altrimenti il pavimento
  di 30 ore poggerebbe sulla sezione sbagliata.
- Le ore possono essere **distribuite liberamente nell'anno** ma devono essere
  documentate e tracciabili (stessa fonte) — è esattamente ciò che rende legittimo
  spalmare le evidenze su più giorni dell'anno.
- **Regolamento IVASS n. 44/2019**: la formazione **antiriciclaggio concorre al
  monte-ore** dell'aggiornamento IVASS, non si somma a parte
  ([FIASS — Reg. 44/2019, formazione obbligatoria AML](https://www.fiass.it/regolamenti-ivass/regolamento-ivass-n-44-2019-antiriciclaggio-formazione-obbligatoria/)).
  Attenzione a cosa NON significa: l'AML **non si somma** alle 30 ore, ma **deve
  esserci**. È un obbligo di *contenuto*, distinto dall'obbligo di *ore*, e per questo
  ha un controllo suo (C4a(iii)) e non si lascia presidiare dal monte-ore.

→ **In RTL Bank i titolari dell'iscrizione al RUI sono 30 utenti attivi**: per loro il
pavimento sale a **30 h/anno** e l'AML resta dentro quel monte-ore (non è un addendo).

## 3. MiFID II — aggiornamento annuale di conoscenza e competenza

- **Delibera CONSOB 20307/2018** (Regolamento Intermediari): il personale che fornisce
  informazioni o consulenza deve mantenere e **aggiornare annualmente** i requisiti di
  conoscenza e competenza
  ([Diritto Bancario — requisiti di conoscenza e competenza MiFID II](https://www.dirittobancario.it/art/requisiti-di-conoscenza-e-competenza-del-personale-degli-intermediari-mifid-ii/)).
- La prassi di settore accorpa l'aggiornamento MiFID e quello IVASS in un unico
  percorso annuale ([ABIFormazione — MiFID e IVASS: aggiornamento annuale](https://www.abiformazione.it/contents/in-primo-piano/2024/mifid-e-ivass-2024-consulenti-e-informatori-finanziari-siete-pronti)).

## 4. Certificazioni EFPA — mantenimento **annuale**

- Le certificazioni EFPA hanno **validità annuale** e vanno mantenute con
  aggiornamento **anno per anno** a partire dall'anno solare successivo al
  conseguimento ([EFPA Italia — come si mantengono le certificazioni](https://www.efpa-italia.it/come-si-mantengono-le-certificazioni/)).
- Requisito: **30 ore di corsi accreditati per anno solare** (livello EFA); per EFP
  30 ore + 8 ore di elaborato (stessa fonte). Il mantenimento comporta anche un
  contributo annuo (€ 158,60 IVA inclusa, entro il 31 dicembre).
- I percorsi da 30 ore sono spendibili per l'aggiornamento annuale di **tutte** le
  certificazioni EFPA e sono costruiti per soddisfare MiFID II (stessa fonte).

→ **In RTL Bank i titolari di «Certificazione EFPA European Financial Advisor
(MiFID II)» sono 27 utenti attivi** (unione con i RUI: **42 utenti**): stesso pavimento
di 30 h/anno, e **rinnovo annuale** del certificato.

## 5. Sicurezza sul lavoro — la cornice non è solo quella del lavoratore

- **D.Lgs 81/08** + **Accordo Stato-Regioni** in vigore dal 17 aprile 2025 (pubblicato
  in G.U. il 24 maggio 2025), che sostituisce e coordina gli Accordi 2011/2012/2016
  ([Consultlario — aggiornamento quinquennale 6 ore](https://www.consultlario.com/pages/blog/aggiornamento-formazione-lavoratori-6-ore-2026.html),
  [ADVANT Nctm — nuovo Accordo Stato-Regioni](https://www.advant-nctm.com/en/news/sicurezza-sul-lavoro-il-nuovo-accordo-stato-regioni-sulla-formazione-in-materia-di-salute-e-sicurezza-dei-lavoratori)).
- L'aggiornamento del **lavoratore** resta **quinquennale, minimo 6 ore**, per tutti i
  livelli di rischio (stessa fonte).
- L'obbligo però **non si esaurisce nel lavoratore**: l'Accordo distingue lavoratori,
  **preposti** (aggiornamento più frequente), **dirigenti**, **datore di lavoro** e le
  figure di emergenza (**antincendio**, **primo soccorso**).

> **Perimetro dichiarato**: il dataset RTL porta un solo schema di sicurezza
> («Sicurezza Base D.Lgs 81/08», INAIL, 42 persone) e il C4 modella soltanto quello.
> Gli obblighi di preposto, dirigente, datore di lavoro e addetti alle emergenze
> **non sono rappresentati** — non perché non esistano, ma perché il dato non li porta
> e assegnarli richiederebbe di inventare una designazione (chi è l'addetto
> antincendio di quale unità?) senza alcun ancoraggio nella sorgente. È una lacuna
> **nota e registrata**, non una svista: chiuderla è materiale per un cluster
> successivo, insieme alla designazione delle figure sull'organigramma.

## 6. Rinnovi: la norma dice **quali**, il dato dice **ogni quanto**

Il rinnovo di una certificazione, nella forma nativa del dato RTL, è una **NUOVA riga**
con lo stesso `(nome, issuer)` e `issued_date` diverso — la chiave naturale è
`(tenant, user, name, issuer, issued_date)`.

### 6.1 Quali schemi sono abilitanti (dalla norma — non deducibile dal dato)

Abilitante = il possesso **in corso di validità** è condizione per svolgere l'attività,
quindi la catena di rinnovi non può interrompersi:

| Schema | Perché è abilitante |
|---|---|
| Iscrizione RUI - Sez. E (**IVASS**) | l'operatività assicurativa presuppone l'iscrizione al RUI e il suo mantenimento (§2) |
| EFPA European Financial Advisor / MiFID II (**EFPA Italia**) | i requisiti MiFID II di conoscenza e competenza vanno mantenuti (§3, §4) |
| Sicurezza Base D.Lgs 81/08 (**INAIL**) | obbligo di legge per ogni lavoratore (§5) |

Tutto il resto — **CFA, FRM, CAMS/ACAMS, AML AICOM, ABA Bank Teller, GDPR DPO (TUV),
Scrum Master, Certificazione Interna Leadership** — è **volontario**: sono titoli di
pregio o di schema privato, e lasciarli decadere è un fatto della vita professionale,
non un difetto del dato. Per questo il controllo C4b **non** pretende «zero
certificazioni scadute», ma «zero *abilitanti* scadute».

> Nota sull'antiriciclaggio: l'obbligo formativo AML è reale e annuale (Reg. IVASS
> 44/2019, §2), ma cade sulle **ore** — non sul possesso del certificato ACAMS/AICOM,
> che resta un titolo volontario. L'obbligo è quindi presidiato da C4a, non da C4b.

### 6.2 Ogni quanto si rinnova (misurato sul dato, non deciso a tavolino)

La cadenza **non** è una tabella scritta a mano: è la **mediana della validità osservata**
per quello schema nelle righe già presenti (`storia36_cert_validity_years`). Misura al
2026-07-28 sul tenant RTL:

| Schema | Validità mediana osservata | Righe |
|---|---|---|
| IVASS · EFPA Italia | **5,00 anni** (uniforme, senza dispersione) | 30 · 27 |
| ACAMS · AICOM · CFA · TUV · Internal · INAIL · GARP · ABA | 2,6 – 2,9 anni (dispersione 0,5 – 4,8) | 22 – 80 |

⚠️ **Punto di attenzione, dichiarato**: il dato RTL modella il RUI e l'EFPA come titoli
**quinquennali**, mentre la norma impone un aggiornamento **annuale**. Non è una
contraddizione e non va «corretta» sul certificato: ciò che è annuale sono le **30 ore**
(§2, §4), presidiate dal pavimento di monte-ore in C4a. Estendere la catena a un anno
avrebbe imposto una convenzione inventata a 57 righe che ne dichiarano già un'altra.

### 6.3 Monotonia della catena

Un rinnovo non può scadere **prima** del titolo che sostituisce. Nel dato di partenza
**23 righe** violano questa proprietà (ACAMS 10, AICOM 5, GARP 5, CFA 3) — rinnovi la cui
scadenza regredisce rispetto al titolo precedente. Sono un difetto reale del legacy e
vengono riparati con la regola derivata dalla riga stessa (*un rinnovo estende la
copertura almeno quanto ha spostato il rilascio*), non con una durata inventata.

### 6.4 L'aula: capienza e durata (convenzioni RTL dichiarate)

- **25 posti** per edizione: è una costante di dominio dichiarata, NON derivata dagli
  iscritti. La differenza non è formale — una capienza calcolata sui presenti rende il
  controllo «partecipanti ≤ capienza» una tautologia che non può scattare. Con una
  capienza fissa, le coorti che non ci stanno generano **edizioni parallele** (A, B, C…),
  che è quello che fa una banca vera con una sala sola.
- **Una edizione = un mese**: il corso d'aula dura una giornata (450 min = 7,5 h) e
  l'edizione raccoglie le giornate d'aula di quel mese.
- **Il corso di ogni edizione è scelto per pertinenza**: fra i moduli d'aula si prende
  quello che copre più competenze richieste dalle posizioni dei partecipanti
  (`sys_position_skill_requirements` × `sys_skill_learning_mappings`), ruotando fra i
  primi cinque per non ripetere sempre lo stesso. Non si manda un cassiere a private
  banking perché è uscito un hash.

## 7. Che cosa significa «ore» in un corso a distanza

Un modulo in autoapprendimento ha una **durata nominale** (300-600 minuti nel catalogo
bancario) e una **data di completamento**. Le due cose non dicono che la persona abbia
speso quelle ore in quel giorno: l'e-learning si studia a spezzoni e si *chiude* in una
data. La durata nominale è ciò che vale ai fini del monte-ore — è la convenzione di
qualunque LMS ed è ciò che rende l'obbligo «documentato e tracciabile» richiesto da
IVASS (§2). Il controllo C4a somma quindi durate nominali di corsi chiusi, non ore
passate alla scrivania; e il C4g pretende soltanto che la *chiusura* cada in un momento
plausibile della giornata lavorativa.

## 8. Traduzione nei parametri del seed C4

| Parametro | Valore | Riga di questo doc |
|---|---|---|
| **Pavimento** verificato dal check, dipendente generico | 24 h/anno (pro-rata sui mesi coperti) | §1 |
| **Pavimento** verificato dal check, iscritto al RUI o titolare EFPA | 30 h/anno (pro-rata) | §2, §4 |
| **Target** che il seed eroga (≠ pavimento) | 37 h/anno pro-rata — le ore retribuite in orario di lavoro | §1 |
| Giornata d'aula | 7,5 h — orario contrattuale 37,5 h/sett su 5 gg, già usato dal C1 | §1 |
| AML dentro il monte-ore **e** obbligo di contenuto a sé | sì, entrambi | §2 |
| Aggiornamento MiFID per chi distribuisce | ogni anno, un modulo dedicato incondizionato | §3, §4 |
| Capienza d'aula · durata edizione | 25 posti · un mese, con edizioni parallele | §6.4 |
| Schemi abilitanti (catena mai interrotta) | IVASS, EFPA Italia, INAIL | §6.1 |
| Cadenza di rinnovo · momento del rinnovo | mediana osservata per schema · nei 30 giorni **prima** della scadenza | §6.2, §6.3 |
| Certificazioni volontarie | non rinnovate | §6.1 |
| Fuso orario degli orari scritti | `Europe/Rome`, lo stesso delle timbrature del C1 | §7 |
