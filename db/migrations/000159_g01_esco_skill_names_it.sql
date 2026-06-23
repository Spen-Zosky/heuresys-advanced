-- ============================================================================
-- 000159_g01_esco_skill_names_it.sql
-- Fix G-01 (audit S1006), slice 4/N: the ESCO skill names. 13185 skills
-- carried English ESCO preferred labels while the UI is Italian. Their Italian
-- preferred labels were pulled from the official ESCO API (resource/skill,
-- language=it) and are loaded here IT-canonical (Enzo's decision). Bulk-loaded via
-- COPY into a temp table, then an idempotent UPDATE join on skill_id (re-run only
-- touches rows whose name still differs). Skills whose IT label couldn't be
-- resolved keep their EN name (a small remainder; re-runnable from the fetcher).
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.esco_it_labels;
CREATE TEMP TABLE esco_it_labels (skill_id uuid, it text);
COPY esco_it_labels (skill_id, it) FROM stdin;
000d6122-d262-472a-8a08-245be8688367	gestire stand nei parchi divertimenti
0004df36-f7fb-40fc-9b42-10cec6da01f0	schede di circuiti stampati
000f85f4-e0bf-4cef-904c-041c066dd8e1	scarica elettrica
000c8899-3491-45b5-bd28-11e1dbf5ecf7	controllare i prezzi indicati sul menu
001709ca-f12b-4167-ad02-bea7e4d9764d	macchine per la produzione di calzature
001d1a36-29aa-4929-9f4f-c3a047589d55	pianificare le attività di laboratorio
0029b102-c43a-4765-a1c9-8c278405fa82	immagazzinare lo sperma per l’uso futuro sul bestiame
000e55d9-57dc-45aa-b410-55c0328be4eb	gestire l’inventario di magazzino
001e2d6f-7ff2-4d14-aee0-e81e60f5e3a7	fissare le merci secondo gli ordini di lavoro
00284f5a-a537-416a-96fb-137679096a83	condurre prove antincendio
002cdf46-f93b-4c98-bdad-48e616f40fe5	garantire la conformità ai requisiti legali
003831fc-8743-466d-9a34-3d1b4ae155f5	riparare i pozzi
003b3126-8237-4034-8b6c-2b8200aa5a08	normativa sugli spettacoli di combattimento
00413af3-6c95-4f14-8041-421deeec243b	orientare la conversione
003dcbf0-b348-4082-835f-f748bcc6fb9d	applicare la gestione dei casi
004210af-7982-4acb-a715-216603f949e8	garantire il rispetto delle norme di legge
004b2264-9cc7-4408-97a8-da7ef26ced63	leggere i pittogrammi
003b9a74-6904-4306-a765-1c013eca108f	tipi di processi di fabbricazione di metalli
0052db19-242b-496e-ba2c-9d2917aafe74	decifrare i testi scritti a mano
0043cb6a-d380-49af-8398-65c6117ca671	riparare i piccoli graffi del veicolo
0055b336-ceb7-4866-82b3-e2fd74c32681	legare i filamenti in fibra di vetro
00691c62-63d8-4a42-bb97-198c0ecf80b0	tipi di adesivo per piastrelle
00774ce9-f74c-43cf-b858-28949cf747c8	riscaldare i metalli
006edc25-76e2-4ecd-808a-9261cd5a5b17	pianificare l’illuminazione di scena
007a3d84-803b-405e-bc0a-6aade1c816b7	norme in materia di emissioni
0079d616-d1a9-47f3-8dbd-d59113a2cb40	tipi di seghe troncatrici
00892f35-8221-421c-810c-60985171421a	usare una programmazione orientata agli oggetti
008d9a3e-5d4d-4ee0-a6c4-1c76f907bd35	collaudare dispositivi wireless
008db4c8-a964-44d3-9b55-678ade8209c0	pignoramento
008fc778-1ff3-48b2-96c5-af1381d13279	acconciare i capelli
008a116f-f658-4042-9c5a-db70c0ab8d27	scuole filosofiche di pensiero
00979c85-3faa-4994-9987-750f1e7d0ab7	smontare le apparecchiature elettroniche
009a23a9-1044-4be3-a46d-8b147ecde0e1	preparare dati visivi
009e5893-65b5-4c88-b1ca-e5b00c7449b3	gestire il rilascio di software
00b26444-05a8-4fed-94a7-6ad567c279ca	croato
009af418-7583-41e9-9dc1-17246ea8b047	fissare il carico sulle navi
00af94a6-8c0f-401f-8d9c-79b70f6bc27e	approfittare delle opportunità di apprendimento nel campo delle scienze veterinarie
00b66f01-6157-4ec4-acb6-c9a1ad669e10	gestire le fonti di informazioni
00be3c7a-8dbf-4ea6-9c76-a13577dff403	controllare la temperatura
00c1abe7-e39b-475b-a399-a47d8575ae63	utilizzare la memoria geografica
009f3af5-eda8-453e-8a69-59d418916226	gestire gli impianti di trattamento dei rifiuti
00c6829c-7486-4d66-b1f2-7c894d714db1	creare prototipi di calzature in 3D CAD
00c74afc-f45d-4954-827a-c01703d78bc7	manutenere i macchinari di lavorazione della plastica
00c8b6ca-bcb3-418b-822a-226be0d74508	elaborare le partiture per orchestra
00c78d23-4b71-4bf1-bc56-774960e97127	essere addetto a macchine di pressatura
00c9253b-bd9c-43c2-8a95-934499d2a3b2	materie prime per profumi
00ceb0e1-651d-4104-8175-103b5dfd9be3	ispezionare le turbine eoliche
00ce5434-874f-4a42-95b8-207c08caa5ad	interagire verbalmente in slovacco
00d06df7-3f74-463b-8144-e4a9b5cf04ca	ginecologia e ostetricia
00cf3ca2-2068-4275-a894-a6b771c8ab8f	applicare le cure incentrate sulla persona
00d6c207-8ad8-45dd-b8ba-d93327a2330e	ispezionare il casinò
00ee1d59-3293-498c-8039-a19c660c39de	guidare i tram
00d37346-af46-475e-9b08-e9c4a2fba507	raccogliere le informazioni per sostituire parti
00d3686e-3bba-4896-ad41-0a476f2699cb	valutare il volume del legname abbattuto
00eb7d0f-fa42-4246-ab7c-9ce13ed30723	azionare una dentatrice
00dc17af-15df-48e3-ac71-ac7e727c5694	islandese
00f62879-d96e-4613-ac69-8e87f38af976	progettazione di esibizioni negli zoo
00f76054-593a-4c8d-b1bb-4b659167b49c	controllare la gestione del benessere degli animali
00ffcdb5-a9ab-49e8-91a5-85f1cae03e40	parti di macchine per il soffiaggio di materie plastiche
00fc6463-16a5-400a-8a79-3ada6da2b47b	elaborare il piano di marketing e delle vendite
01027d5b-1c8a-4c5a-8d1d-4d93d7bb38c2	gestire l’allevamento di capre
00f9b0e1-fd51-49b8-b3dd-6435530c2a7d	Octopus Deploy
0105e068-ee7f-4e5b-b8c6-f9f993d03822	effettuare audizioni
0128f594-a8a9-4039-9e88-79f85446bd5a	preparare le etichette delle prescrizioni
01283f50-af9a-4507-bf7b-c27509c61c19	utilizzare l’inglese marittimo
0119c6e6-d65a-4c15-b47a-0f279bc2851c	tipi di macchine per la stampa su pellicola
0119a207-ffb8-4e6b-ae64-f3376b0463ca	estrazione di informazioni
012c5c7b-8abd-4d3a-9c74-fddf099f0736	recitare per un pubblico
012ecb0b-32ad-4a4f-a6ba-7dc5cd7a46ba	modelli di qualità dei processi TIC
013ffafc-88e6-4a7b-bb40-330ea7ea8ce5	fornire le strategie di diagnosi differenziale
014d38f7-49b2-496c-82ed-4d4b6ce78ddd	costruire il piano di lavoro del ponteggio
0140e07f-e76a-4cbd-8d3d-664ab9b59bd0	pianificare analisi geotecniche sul campo
01533960-1238-439f-b97f-e5818be0fc74	ispezionare il carico
015c7160-6e24-42a5-8c40-d0a7c88d1483	preparare un farmaco secondo la prescrizione
015e911e-0731-4ab6-86cf-e5652bb538b1	migliorare l’interazione con il cliente
015c9f39-6c87-42fb-9ab0-6cdcfc87b79a	esaminare le scene del crimine
01158d89-a68b-4579-95ad-ab198b5f28d3	comunicare istruzioni verbali
016017ef-09c0-4364-b8bf-3c7b4ffb4a0f	preparare le buste paga
015eb2b8-4887-4dbd-8b99-36618249cf83	apparecchiature di strumentazione
015f9819-4866-4779-9e89-e1e37439dc6a	organizzare la stazione dei vigili del fuoco
016cc147-3cd6-42c4-b2ab-0aa8bb3733c6	unire i rulli
01694e35-7ba6-4394-8bfe-9a0cf1e34290	elaborare gli ordini del negozio online
017414ff-876b-4768-8a0d-51e80b2e49f4	conoscere i diversi tipi di chiusa e il loro funzionamento
017d46a6-d130-4b66-b061-bac57e3c79d2	prodotti audiovisivi
017878ba-e171-4f64-9ef7-9c34f46cfff0	chirurgia dell’apparato digerente
01733e95-5a4d-4be7-89ca-b69a53829ec6	gestire i documenti relativi alla produzione
01749adb-b376-4498-92ff-80b0f972509a	cooperare a livello interprofessionale
017ebb53-111f-415c-9f9f-1b71d8a25903	prelevare i campioni di pesce per la diagnosi
01868456-8d84-4e8a-bd24-368ee2b89825	preparare la base per la soletta
01868773-4116-4960-b716-832871a9baf2	produzione di articoli confezionati di tessuti
01899bad-1967-46a2-b5e4-70cf6e2d0a7a	azionare l’attrezzatura per gli scavi edili
018a5264-bd8f-4f73-84d5-0c94be618a95	applicare il processo decisionale all’assistenza sociale
018da8a1-675a-4d54-a84c-c47b682f1346	dimostrare fiducia
019233cb-d686-4fbe-8582-1a2d4e1a552a	interpretare le registrazioni dei potenziali evocati
018f0bca-157b-46b2-bd0d-4296340d4d03	negoziare i contratti di prestito
0192cb79-7863-4520-9883-0d8982e446ad	settore dei carichi
0192fa96-9358-444f-8dd3-371b94f96edb	processi di flottazione della schiuma
019643df-1250-4ef8-8c09-f2dde1f8dab4	salute pubblica
019316aa-3904-4367-b3ab-0706f41645ae	latino
01944e06-292b-4f97-92ab-83daaa980c4c	estrarre i prodotti dalle conchiglie
01a702ce-95b5-4a4a-9988-45b3a9eec408	insegnare i principi della farmacia
019ba0f5-b40a-49eb-ad43-9364f00acc3e	guidare gli altri
01ad4f9a-d4c1-4ebd-872c-a5254ae7cf72	azionare le attrezzature per l’estrazione del gas
01a71fb3-63c1-41cf-a4e7-ba5b3abd4eb3	accogliere gli spettatori
01be3cfd-b648-4847-afa9-64967db3f6a7	scrivere le proposte per la concessione di offerte di beneficenza
01bf4140-28ef-4464-b21d-52f9e83741e3	rimuovere i calchi finiti
01b434e7-d774-4146-8e5c-95550815c95a	controllare componenti di semiconduttori
01d19412-8426-416f-9510-d7a3dd48ad49	valutare la pericolosità del reo per la società
01d80611-c1c5-40f3-9f7d-3bc4a68bccf2	trasferire un farmaco
01d82af7-896e-4dcd-a0f9-84135b378040	pattugliare le aree
01c1b66e-89ef-4723-90d2-1de95cb16e2f	intervistare le persone
01d271dc-6f3f-4621-a39c-38f417685b82	valutare la qualità degli abiti
01ea01bc-04f5-42e6-8ac0-0614dc742bfe	tipologia
01f5033b-1d2d-4afc-a98c-a00bf9e5922f	gamma di alcolici
01dd4090-9919-4750-bdb2-0597ac874c15	offrire consulenza agli studenti
01f859d3-e126-4569-a18a-c5f03d7a0622	calcolare il funzionamento dei punti di sostegno
0204c0a1-3e7f-4bc6-ae38-0ed3b0e89cc0	valutare i livelli di nicotina nelle foglie di tabacco
02065167-2e16-4538-8507-75e8b81160d6	mantenere la segnaletica orizzontale leggibile
02099ab4-3235-40ad-a77d-290169931499	ispezionare gli impianti di trasformazione di prodotti alimentari
01f9cf0a-72e1-4aec-ad44-26882e8ffef1	evoluzione delle prassi di esecuzione nella tradizione della danza praticata
01ddecfa-2986-4797-8cfa-7cc400f31fca	eseguire l’evacuazione dell’aeroporto in caso di emergenza
020c6c22-0dd4-492c-be2b-1394a64ca45c	gestire le questioni finanziarie dei clienti
02191950-20a9-49c1-a625-3f9e35cfb576	monitorare la sicurezza dei pozzi
02158a14-ef14-47d0-b815-2ad2699b51f2	effettuare i test neuropsicologici
021df9bb-3021-4e2f-afe3-4d70bff2baf1	presentare i nuovi dipendenti
0223e791-7f18-4f51-b345-fa5a4217d175	caratteristiche dei servizi
0209f21e-af5a-4bf3-9539-e6d33dbd6f14	ispezionare i lavori di muratura
02251bb2-e9a2-4593-a8f6-e1d287187392	utilizzare sistemi di distribuzione delle chiamate
022dea9d-139b-41fb-9b4e-3e093a68e9b7	sostenere le persone che chiamano in emergenza in difficoltà
02392c78-7e21-4352-887e-922cc4c2fe13	fisica forense
024456d2-e15e-4e17-8a77-44238bd1c1a6	applicare trattamenti di conservazione
0234cd02-9a74-405c-85d4-b282f727785f	condurre audit ambientali
024588e6-e3d4-4201-8b1d-c6ca2f9b5e8e	supervisionare la pigiatura dell’uva
02484657-b9f1-4ed0-99f4-3c70941ff048	riparare i macchinari di lavorazione del legno
0225b086-5e9b-4a6e-bd5e-adf144381505	offrire consulenza ai clienti sull’installazione di materiale audiovisivo
024f81a5-8877-48ac-ad3b-19e0acae77d7	effettuare gli esami forensi
024d970c-20c5-4370-82d2-3faf46f97af5	consentire ai pazienti di sperimentare con le opere d’arte
0258d116-0d4a-4379-9e83-906e26e7e5fd	gestire i rifiuti raccolti
024ff731-cddb-4b60-97eb-70395db38ae1	comprendere il turco scritto
026583c6-c241-4b30-b068-85a1d8fe6775	sviluppare i programmi di mobilità
02655af4-f4c6-4ac5-a3d5-8a0505aea972	eseguire operazioni da bordo a terra
02605e06-2089-4592-a3a7-5226282a0da7	riferire sullo sviluppo sociale
02748613-3253-4c26-800f-1ef828ac1ec6	scienza odontoiatrica
025cb970-b4d2-4d07-8a24-5f9f5a86a200	favorire il rispetto delle norme di salute e sicurezza dando l’esempio
02820cd3-aa82-49f5-9ba0-5ad329ee3c2f	conservare il latte crudo
02685334-5142-4c22-8705-127d2386014f	monitorare le prestazioni del servizio aeroportuale
028c6c42-9944-45e1-af43-780c911223fb	pay-per-click
028390a4-4f3e-4f5e-967b-511af7557628	sviluppo psicologico umano
028284eb-1a42-43ba-9c78-2559c53050d9	mantenere scorte di materiali veterinari
029e991c-ee0d-49a3-9988-3eeb72b52b89	rimuovere il materiale di coibentazione vecchio
027d0252-cbb8-4416-a72e-fecc07c47472	manipolare i prodotti chimici per il suolo e le piante
02a6a9b1-06bb-456c-ab95-4869bd3ee561	progettazione architetturale
02c89724-75e7-4f09-b627-ce1c01ab0da2	riesaminare i casi processuali
02c909bc-a164-46f3-9dcb-98e828aa02cd	effettuare le operazioni per il trasporto di pesce
02bb8fe0-bbe5-4b03-ab13-c5691ea64488	caricare la frutta e la verdura raccolte
02ab047d-711f-4323-89ee-7c748bf7b962	adattarsi a nuovi materiali di progettazione
02d3cf59-29f5-49ce-b114-c0d08b79f419	adeguare i prezzi del carburante alle procedure aziendali
02b15d7d-eee2-4ae6-9c24-4a6dd3ad194b	offrire consulenza ai clienti sulla progettazione d’interni
02dd1637-bb08-4e53-95f4-4b71470d47cd	controllare i documenti di viaggio
02dad9d2-9036-4a52-b585-0a761de21bcf	scienza del suolo
02e7d99a-88b1-4f52-ba9d-3569c10b17a1	azionare la gru a torre
02dba34a-8dd8-48fa-a8e6-232c15f4ba39	garantire la sicurezza della mostra
02dc665b-7cfb-465f-ab6b-e1315bbe1361	offrire consulenza ai pazienti sui trattamenti per la fertilità
02ea55d7-79d1-4602-bc92-123a924830ee	gestire le apparecchiature per l’ispezione di merci
02febd28-6ce8-4b27-9b9b-43af01429bb6	comprendere il romaní scritto
030639b2-ef7e-48c9-bd71-c2dbd8d8c18e	manutenere i macchinari di avvolgimento di tubi isolanti
02f0b728-8ec0-4f2f-914d-3c6c1b38e850	mantenere i sistemi di comunicazione interni
030803e9-6a82-4e9f-a81a-813aa77bc111	disturbi dell’autoconsapevolezza
0308eeda-2f48-4cc3-a00d-9254ec39fdd5	controllare la salute dei dipendenti
032539b7-1011-4e30-b2e0-8f9758052201	azionare convogliatori a tramoggia pneumatici
0322ac51-8d45-449f-a3fa-922c2bd21bce	lavorare a questioni psicosomatiche
032f90bd-f86b-4bd7-a577-0376877a165a	offrire consulenza ai clienti sulla fotografia
032eb90f-c108-4964-8277-e69167e01416	mantenere i contatti tra la direzione del teatro e il gruppo teatrale
033003f8-41ac-42c6-906b-033f88307b66	controllare il flusso di aria
0320bdc4-08e0-492e-9045-724c81ad3492	effettuare ricerche nelle banche dati
03379b25-9cb6-4091-b414-8b623469306d	gastroenterologia
03364691-c437-4df9-bcad-cda2cc79abe7	misurare il flusso di acqua
033e1525-055f-4c66-a948-374b443773ff	accessori per cavi elettrici
0340b100-436b-4687-8db6-80e587fba661	discutere dell’anamnesi dell’assistito
03467305-f86f-4ed6-9142-2fe4ccd39895	gestire la sistemazione delle opere d’arte nella galleria
0340eb73-d7a2-4c27-9e1a-8ab82c7ab68b	trattare il pezzo in pietra lavorato
03495529-aa9a-466e-a1e8-48a55010a1bf	nanoelettronica
032db4f3-2d87-4999-85d5-fea22e815e5d	utilizzare le tecniche di elaborazione dei dati
033453d6-4bff-4de8-a746-e62fc6415eb6	fornire informazioni sul trattamento preliminare
0353aaab-b987-453c-9c61-8b262493c66c	pianificare spostamenti delle trivelle
0365a066-e2ed-4233-a9cb-d7c7779d8770	calcolare il costo del rivestimento
034c10b8-05e6-4d8c-a8ee-c32efcb1ece3	interagire con altri attori
03580267-df6a-48c0-8708-1c6fe2278d47	accertare i fatti
034f78cf-c030-415d-8281-7bcaa190f8ab	garantire il rispetto delle normative riguardanti le infrastrutture di gasdotti e oleodotti
0369aede-901e-4369-af98-30338c4974e6	impostare il tamburo per la gomma
0373c9ad-03e6-4dcf-93e2-6621a66654b2	preparare il caffè
034baf1c-50a6-4757-bf35-73820e59848e	mantenere i contatti con i colleghi
0375cc48-ef3c-4ce0-a7c8-2614e318fc73	fornire assistenza per le emergenze
036fcd47-cbcc-43b9-a132-a6a2527b19c0	governare le navi nei porti
03765ffa-5726-4323-8441-a5c05f1f49d2	neonatologia
037a3398-e122-4a74-a42d-656501359353	antropologia
037e30b4-aaa5-4746-b734-7b68e49e6f98	utilizzare seghe a nastro
03883205-ed7d-439e-be5c-9eb53eed3bc1	effettuare la manutenzione di attrezzature per la lotteria
0388d11e-3dd3-4a06-b04b-b54944703d7c	utilizzare sistemi di distribuzione globale
03a1bb76-0f49-4079-a43f-919666bb2b9b	gestire le controversie finanziarie
03a30071-2e77-4e16-9982-d8830d8b20b5	caricare circuiti elettrici sui wafer
0388a760-82ce-48da-a965-23bbb2fc2d51	apparecchiature informatiche
03a86e65-041b-40be-a93d-44b474b59bb7	ispezionare il legno piallato
03b02664-a4da-4caa-931b-68aa5f3ca2a2	individuare l’origine dei documenti dattiloscritti
03bb4d05-9b61-413c-8bdb-4ac431181a0f	programmare interventi di manutenzione alle macchine a intervalli regolari
03bb954a-5c95-4158-b5a6-43f0ec5b38a2	settore degli articoli ortopedici
03be1129-1179-404c-9f20-eaaccb7a11a3	acquistare o vendere valute estere
03ccef0a-5cb3-49c4-8616-76664287d0b0	eseguire l’analisi finanziaria sulle strategie di prezzo
03d355d4-c5e0-4715-bbe3-06752d54dd79	stabilire politiche di inclusione
03b1d471-7a4d-4045-a4c7-ab9f5b9a7f82	gestire il sistema informativo radiologico
03d5541a-e2ad-4d52-a0c9-f46dc0326e07	mappatura geologica
03d77b26-cc74-4b03-8302-c370a3697c07	gestire i radiofarmaci
03d9b217-f8b3-46cc-949a-5c6df1cea89a	installare un impianto di subirrigazione
03e71503-922e-4ac5-bf3e-da3c83cbd7d8	procedure di pulizia del treno
03e4f908-d005-45f0-9313-22979b14cba0	instaurare relazioni di lavoro efficaci con altri giocatori sportivi
03eb9dd5-f52c-4568-83cd-040e8fa6a338	produrre strumenti odontoiatrici
03fc1b47-929e-42b1-86a9-139c29bf753e	comportamento specifico della razza di cavalli
03f66c7a-ee72-46e1-9beb-672ad3a796b5	fabbricare i farmaci
04066bd2-61db-47b0-8b4a-9ffd8cd05efc	eseguire le operazioni di carico e scarico
040be1ed-a151-46e7-8ede-f4c23c5d80e3	impatto delle tecnologie digitali
040f692e-2bcf-4fdf-9809-bda5def9f208	astropsicologia
041612fe-926f-46ac-9e27-1c77a11f1958	ancore utilizzate nel trasporto per vie navigabili interne
0415fa61-8ed1-489f-9b14-e8bbffd494e1	Internet delle cose
0419a754-359d-4be3-ad79-1d737cebe693	applicare lo smalto sulle unghie
0417dfc7-54b4-430b-84a3-8cb672d24695	effettuare la manutenzione delle reti
041dc255-b28a-47e6-96ab-231e1220e9c0	ciclo di vita di un prodotto TIC
041871d5-a6e3-4e38-9e57-4a65b544b98e	valutare la pulizia delle aree
0419c7c6-7488-47ad-ad8b-2c2638debe16	spolverare
0421d321-eb5c-4e6e-bacf-9895f0b6470d	carpenteria
04280149-cd4e-4ac0-863f-9626d5c04d95	imballare il carbone
041ec0a5-61af-44a8-8412-9f0ac311de26	verificare la conformità dei contratti
041b6052-0665-4958-9b22-7007eff6222e	Groovy
04292fad-3a86-4e06-91da-b64205679e65	decidere in merito all’erogazione di fondi
0438ccfa-9d6d-41e8-9d5f-c9f08cc328a0	posare i profili divisori del pavimento alla palladiana
042ad5fc-5870-4653-9993-67150caa55d6	calcolare il prezzo del totalizzatore
0440f543-8d31-4c81-9ff0-a7a8b33c307e	scrivere in vallone
043f2bd5-5c04-4da9-8b7d-f5523848119a	ordinare i prodotti
043e6120-acfc-4591-aff6-12c42cf2febb	logistica militare
042d6ecf-652e-43ad-9263-0ede1bfffaa2	monitorare le macchine automatiche
0442e10a-55bc-447f-9ead-51d86c8f51cb	insegnare fisica
0446816d-b14c-4d51-8594-b313f3231948	applicare i principi diplomatici
044155ab-e9da-4f69-960d-9ef4c1a18546	coordinare le prove
04453847-8c3a-4c02-b946-a174fff0edf2	sviluppare le strategie in materia di silvicoltura
04472128-5707-4930-a621-062bfe610f65	svolgere commissioni per conto dei clienti
04656c77-85a1-4f37-86ed-0f4e596686d1	mantenere le tradizioni dolciarie regionali
044cf66d-ba83-4f1c-9616-b4879efe2246	coltivare le colture da biomassa
0462ba56-ba54-4977-a971-089d2de2aef1	progettare un impianto a energia solare
04421a8f-ffeb-46db-ae5a-37719e4ba9a5	svolgere operazioni accurate di trasformazione alimentare
0456393f-609b-41ab-b7a5-eaa6ae31629c	coordinare le procedure di gestione dei rifiuti
047fd4a5-f1fc-4c1d-a83e-b7a0102f7e99	gestire gli articoli donati nel negozio di seconda mano
04808d28-e2bc-435f-b12c-24a1109cbcf9	organizzare le riparazioni delle attrezzature
046cdbbf-09db-4736-9e60-234741bcb455	monitorare gli standard di qualità della produzione
046efdeb-1663-4158-b6c7-63114e0e3f4b	effettuare una ricerca storica
048160a8-ca8a-4a52-b552-65d03047ef41	monitorare l’area delle casse
0493e0f0-e766-4291-b57a-1b21d9eef653	creare la base per prodotti
048ee36c-90f6-4102-a41f-15bfcbc9a4fe	installare l’elettronica per auto
049f3c3b-e394-4a14-aa20-4b2455d981cf	disarmare le mine terrestri
0498b32a-2d52-4f39-84d8-c87777511531	analizzare la concorrenza nel settore del noleggio
0497f88a-b979-4088-ab34-fbab5ea90e1e	tecnologia di laminazione metallica a caldo
0494afbc-6d65-4dd4-8692-9f6b4b909c36	suonare gli strumenti musicali
049f6ede-94ef-49f8-b0bf-cea321b95e77	installare il materiale pubblicitario
04b20304-7b48-432f-a0e0-ee10b8ac02dd	leggere le etichette dei bagagli dopo l’accettazione
04b8d864-68f2-4c13-a59b-6c865fce3dad	offrire consulenza ai superiori sulle operazioni militari
04cc8be0-6b0d-4eaa-9acc-f70070822472	svolgere un’interpretazione bilaterale
04a64a10-d3d8-486b-b45f-559c69047a1d	gestire le attività di pulizia
04a95828-1f93-4290-81c5-99ce20c3c1e0	CAD per calzature
04b76343-c06c-4062-a278-474c0b843853	sviluppare uno stile di coaching
04ba6da2-55cd-4d78-84c9-a74bfb8f980c	molare il vetro
04c7423e-ffb9-4c35-9a9d-1f735592e630	regolamenti per il trasporto internazionale
04ccefd6-6465-4ff8-babd-0a089f4ba61e	effettuare le attività di sghiacciamento
04d19508-927d-4a10-a81b-365979646d8d	tenere un inventario dei prodotti a base di carne
04ccb8a4-5e8d-412d-bcc5-1829ce62ba8c	pianificare la manutenzione della flotta su strada
04d9b999-143c-4d30-ad94-3a1d43585094	politica governativa
04e17dd6-81e7-448a-bfe0-f5f6ac111655	installare i ponteggi
04db6af6-ca27-450b-a95c-69b7cde10ec6	analizzare le tendenze del mercato energetico
051255e0-eb86-4291-9896-d7a09f77abd3	studiare i livelli di vendita dei prodotti
04f01c75-9096-4982-9220-c9cbbaeef252	fornire ai clienti informazioni sulle riparazioni
05197415-9fb2-4ecd-8901-359f7afeaec4	trasferire le bare
04fb24cd-0caa-4db6-9923-95928af3fa7e	programmazione informatica
051bcbae-8f21-44ba-9137-388c94814a50	orologi elettrici
051589d2-d899-4717-b5ac-52f4a78c297b	offrire consulenza ai clienti sui tipi di fiori
052d0cb0-48bd-4b5f-88c9-d650b3319fab	rilevare i malfunzionamenti dei sistemi di controllo del treno
0535f894-48a6-4493-9a3b-915cc23e6582	rinviare gli assistiti ad altri operatori
051d1aa1-e6be-4bed-b3c4-b62834ebb42f	abbinare le merci agli imballaggi adeguati secondo le procedure di sicurezza
05386baf-8fc8-40f0-bac0-258e5fa70a50	interventi psicologici
0535247e-3bea-4a92-ab23-f5a22e7bda09	offrire consulenza ai clienti sugli veicoli a motore
053a24e8-7806-4384-a6e1-d615c473dd0f	minacce alla sicurezza
053f2817-a63c-4bb7-9644-61724aad14e5	teoria dei sistemi
054d68ba-b687-438e-945f-64962d76bcdf	utilizzare un agitatore di lamiere
054f515a-0bf3-47a9-95a7-d95fde8f47f8	creare mappe tematiche
054dbad9-253a-4077-9c78-0af61a4fc3fa	eseguire la manutenzione delle attrezzature per le comunicazioni radio
0550e48d-3280-4b4c-bf9f-f79a36ba5a80	fornire una consulenza farmaceutica specialistica
054ecc8a-9fc6-49c9-ba88-2365f28d847b	cooperare con i direttori delle pompe funebri
0556ebed-7fb5-4dba-a278-f4b5e4ee27b9	installare le attrezzature per l’erogazione dei servizi di pubblica utilità
0564eb98-1f63-4467-9e0a-c3bebf692caf	gestire i pazienti edentuli
05659f0c-3d1f-4348-ba34-00b62023252b	metodi di collaudo elettrico
0565d38b-4bc6-41e0-b618-f4736ba8ca5f	preparare le proiezioni finanziarie
05602437-5afd-433d-a073-be5e0b000317	guidare le prove degli artisti
05764c9d-8019-4411-a3a1-dcb359ae186e	gestire l’acqua piovana
05875af6-5f9c-4721-b2dd-ff069ca4226d	tipi di musicoterapia
0576a074-1b25-4dd1-a944-e1918637ccba	implementare software anti-virus
0581786c-65b0-48f4-8832-f44bd9409a5b	selezionare le attrezzature fotografiche
0589828c-01eb-45ae-88cb-ea05204951cf	prodotti per capelli
0588ebf1-4f96-4784-b523-9ed369eb285d	fornire assistenza alle persone disabili per consentire loro di partecipare alle attività della comunità
0590741c-0185-4795-b15b-38ff6023a8f9	diagnosi di problemi di salute mentale
05562a5d-cab4-4378-834e-9ba6e4cd70fc	Maltego
05a24e6a-c1ba-48bc-ad98-454f9315236c	archiviare i documenti
05b27bdf-3d41-483f-aceb-5b48c8bcbe5b	Islam
058d5dd6-4bc6-4129-9c59-fc6cbf0c472c	supervisionare il piano operativo ferroviario quotidiano
05ae1b68-9ee4-42e6-a733-54376d48d4ac	analizzare le informazioni sulla forma fisica personale
05b96c4d-1efa-4073-9085-ee81bb9c3aec	ingegneria dell’usabilità
05b651f3-32d9-423f-ace5-3f0aef5f8097	adattare il lavoro durante il processo creativo
05cacf66-a917-40ac-a760-013ff3a92db8	controllare la testa portautensile
05cd1112-74c5-4a5e-8b89-4414b7e501bc	politiche idriche
05d0f9c7-561a-4690-be58-df7d5e9e4a46	politiche del settore minerario
05d11c9b-156b-4213-bd20-d0382cdecdc7	fotoincisione
05d35d6f-f660-4984-a8dd-727a083a8266	sorvegliare la macchina piallatrice
05e048e4-15d7-4e45-a317-89f1419cd626	organizzare le visite alle proprietà immobiliari
05e7aa68-d026-4a02-a7a0-bee98f0b81b8	hindi
05f03b68-3b79-42e8-8de9-fa99faab8a7f	stimare il consumo di acqua
05f852db-47eb-42ca-8676-a95ac7741af3	riparare le biciclette
05f9d685-0f70-4109-84b2-4775742fb654	galvanizzare il pezzo metallico
05fa138e-553d-45a6-80a5-c3c5a8a7fe33	sistemi microelettromeccanici
05fc359d-8929-4e0a-bbb1-aae93768d621	diagnosticare un’ipoacusia
05ff76cf-57a6-4226-9592-76c8e2f16bc7	sorvegliare il miscelatore di colore
06000c8d-c083-4623-a83a-5f6fec86ab9e	trasferire la domanda di energia
061931da-bb44-4917-ab9c-5cc724d6b8fb	analizzare sostanze chimiche
06056abc-49ad-40b4-a8c5-76ae6794f9a2	elettrodomestici
0609dc3e-8b9b-4e0c-9d3e-c2de80552a7a	preparare le relazioni di volo
06277cd6-2c57-4fc2-bb01-960a0a2f9bfb	svolgere le procedure di diagnostica per immagini
0624fff8-8f34-4bab-b556-cda6f5624ee7	eseguire la manutenzione sulle attrezzature installate
0606d104-7046-4618-8be4-64b8b8d2169b	fornire materiali didattici
062fca3b-3afc-40c4-960f-7360b15affaf	controllare le vasche di sviluppo delle pellicole
06357485-f01c-4833-9715-52dd9223c900	fornire assistenza nel trasporto di animali
062aeaea-30f8-4ad6-9cef-155e73eb85b4	soddisfare i requisiti legali per le operazioni di immersione
06394e4a-8720-47cd-ba1d-54a7e4570f93	interagire verbalmente in giapponese
06377758-5a08-450e-b16f-47ca5fe0129c	istruire i dipendenti sulla protezione dalle radiazioni
063b0e2c-c0bf-473f-a898-038fc0e6a898	tecniche di carbonatazione
064d8fcb-63bb-4082-8d4f-cb73080a07cc	sviluppare i servizi di chiropratica
0646e12b-20d6-4816-86b6-b3616e78bbf6	interagire verbalmente in cinese
064896c5-4ab4-426f-99e3-ecf21bf94077	inglese aeronautico
064f68a0-17b6-4c75-bdbd-c783f5b1f5d5	sistemi di riscaldamento domestico
066417d6-9915-43fe-9ff4-a046a3a33334	preparare i documenti per la scansione
0654bf16-cd00-43e5-9aec-80f15965314d	Pentaho Data Integration
06322f14-b371-4957-a412-7acc85268946	leggere il contatore di energia elettrica
0654af5f-cc03-4155-abc2-bda64baca212	consigliare i clienti sulla manutenzione degli occhiali
0668c34c-2965-4deb-bbfd-925af377a79e	guidare la macchina del legname
06678bd1-5c9f-4a8f-9601-3449afb7d359	fornire assistenza nello sviluppo di pratiche per il benessere dei dipendenti
06765e2e-3bd4-4a30-ad55-4af49b8b07c8	applicare rivestimenti vetrosi
066bf1e3-226f-4c08-9a62-77b53bcf1b32	gestire il rischio di guasto all’illuminazione
06800086-3ada-4c5a-a21e-47f502ff2325	individuare i comportamenti dei pazienti
067990db-8518-4a4f-b9ea-3fed60ba5a1a	comunicazione interprofessionale in campo psicosociale
0685486b-182c-4124-a849-705d2d07d108	attuare attività di esercizio fisico per animali
068208ae-9f16-4afa-b82e-f769637acb19	comprendere il bengalese scritto
0681ac03-761a-4a1b-988b-a6d030aee78f	provvedere ai pezzi di ricambio dei veicoli
0688441c-1f4b-4b85-9ecb-5c35d231ad59	comprendere il bihari parlato
069b2cb2-2ff0-4b4a-9cb8-4c9675d5d794	classificare candele
069d91c5-612e-40eb-a48f-50d77c548ed7	FBGA
069f4224-dfb3-4ff3-9624-60538e491a68	analisi di newsletter
06a9d6bd-d068-46ea-b5ce-fe05a467e9cf	azionare i veicoli a fune terrestri
06c03220-c06a-4939-b499-464864a4866e	eseguire l’analisi del liquido cerebrospinale
06bb73e9-0da1-4f5f-9277-49cada915776	far fronte a richieste impegnative
06c7b46f-3610-41c3-ba04-f7338e62057c	contenuto di umidità del legno
06c82fc7-992d-46a9-a46a-1d4b4245d529	attività di sommelier
06c629a1-f109-405f-a690-4b3687ce76b1	seguire le procedure di sicurezza durante i lavori in quota
06dd6bfd-1655-44d8-9e9a-4e1b75345d4b	estetica circense
06d9ea54-2b55-43b0-911d-ec684a829cdf	monitorare il calibro
06ddf57d-5935-4bd7-aee1-c76459b2fb9c	alimentare materie prime all’interno dei macchinari dello stabilimento
06d7d4eb-df40-4165-b036-729ddee4ae4d	fornire assistenza ai clienti nel provare gli articoli sportivi
06e08b03-3c24-431f-9ee4-fbd7719a2fdc	installare i montanti di ringhiere
06e638aa-0cb6-4e69-859f-c6620fc406df	diritto penale
06e5272c-fa1f-4b68-8fac-0c5ee97d5445	gestione della documentazione TIC
06e42d90-94d2-4536-9aa0-143e63f6ad2e	marcatura
06ef5805-6cd2-45ab-b950-1c5aa4d15f8c	inserire le strutture delle anime
06eed23a-7dd7-4f3e-b4cf-edb39794ec4e	farmacologia
06f73b01-448c-4f00-8d5f-705a17649a08	controllare la sala giochi
06fd7cd0-2ec9-4978-b061-c7f0b6b83eb5	applicare un rivestimento tramite conversione al cromo a un componente metallico
06fc0121-c32b-4ee3-a551-752dd518e4ce	calcolare il peso medio delle sigarette
06fe173a-c99e-4d37-a383-cc9211e55d1e	fornire le cure di stabilizzazione in caso di emergenza
070350b9-bfb0-495f-9243-04877dd16fb5	fornire i servizi di dog walking
0707f106-5c60-4c79-a6ad-8332159300bd	gestire la localizzazione
07087843-6e15-4a75-a609-8336526c037a	combinare immagini in diretta
0718eaed-2ff9-4294-ab86-13a41cdc895d	documentazione relativa alla produzione di carne
07027302-0ea6-4ab7-8b77-ef963a5e7feb	sostituire componenti difettosi
071cc7d6-ba6c-408a-813c-89a57528e892	riparare le vetrate
07191877-8809-4873-ab34-deead27765d0	insegnare i principi economici
07260e29-9734-4881-b044-1d8a82dc3c57	determinare quali materiali utilizzare per il set
0728c8f9-4746-4595-accf-9750340ad7fe	tipi di strabismo
0728aca9-c748-4f12-bd5e-9f14e1f9defb	garantire il rispetto del regolamento ferroviario
072f914e-359b-4ccd-b313-3b641a383d2f	assistenza infermieristica specialistica
073ca430-3daa-4a28-b1d6-77f6816d754a	legge elettorale
073cad30-e3a5-4994-9051-74f261353aae	ricercare nuovi ingredienti per alimenti
07475e2b-7118-4b24-a890-053626e05daa	materiali per la fabbricazione di bambole
0749b736-854b-4ebe-a90c-c18610c5f9b6	preparare la carne da usare in un piatto
07614d74-6030-4806-a3c6-503a5be53c77	trattamento dello strabismo
0759ae60-2ebd-480f-9034-0b1c801b856a	fornire assistenza in caso di anomalie della gravidanza
07562692-8d37-421b-99f1-22963d042219	implementare un firewall
07711bff-e0e3-47c0-b56f-a6bf99d83558	distribuire i volantini
0768ede4-446a-4611-8d0f-e3e8e984b8db	eseguire l’insufflaggio di perle isolanti nelle intercapedini
07794a1f-91df-42bc-8eca-19ff5427b34d	utilizzare gli strumenti per l’ornamento del corpo
077d6071-4498-4aad-a811-ba2f376deff9	produzione di posate
077871b2-d428-4546-8f32-dc1c526c7c43	ruolo dei tecnici sanitari di laboratorio nel sistema sanitario
0778c3ee-44f7-4299-8aa9-dd02b81b326b	politica
077dae27-8cb9-4523-a6f4-4254611c9fb4	ottemperare alle disposizioni legali
077e47d3-988c-4b8d-b7f2-17c4d850e6da	pianificare attività di produzione artistica
07852b0b-0257-4ebb-b773-bcbdf4910c15	gestire le pompe di trasferimento di sostanze refrigeranti
0783d15e-ec75-4304-82b8-eae87132778f	esaminare il sistema di ventilazione
07838b60-6c03-414e-8ad3-e0039b589a9f	selezionare i manoscritti
0792084b-0f8c-49a3-a793-5c6039bb8e32	gestire il piano di pulizia del veicolo
079af331-448e-45bd-88be-74908ddaea98	insegnare il controllo del traffico aereo
07941931-4d83-4bb1-917a-90b5fe7dee7c	sostenere i volontari
079c333e-6b97-40b8-9a09-ab22b5cf2cb0	norme relative alle munizioni
07a7a213-b217-481a-b19b-f2861afa428b	interagire verbalmente in portoghese
0792a2e5-abfc-4971-a618-8e348a8de9e5	pulire e igienizzare le attrezzature dell’azienda agricola
07aa1882-2934-45f7-b1ea-b1d2d7b59a0c	utilizzare i sistemi di riconoscimento vocale per applicazioni di magazzino
07ad6345-c655-4450-82d7-ac92d7f47cb2	creare concetti di giochi d’azzardo
07ad9f4d-14ef-4ee2-b072-f85b43c97878	misurare con precisione le operazioni di trasformazione alimentare
07b90f6c-d43d-493d-8545-27a12fbed304	manipolare il gesso
07b350db-9d0b-4866-ae04-4df28dad503f	gestire gli aspetti patrimoniali del marchio
07b929f0-0dcc-4c46-8929-871202d78163	affilare gli strumenti da taglio
07b83fb1-8816-4e4a-a428-d1b358e196ad	yiddish
07b9e121-06b7-430a-9812-65095338bb59	conservare nuovi mezzi di comunicazione
07bef11e-bbba-4f12-9fc8-b8870f4e000c	monitorare le registrazioni postvendita
07bc79fe-b1fb-47b9-9288-bd0779b35090	utilizzare una lancia per l’applicazione della tecnologia del calcestruzzo proiettato
07cefa07-3cdd-4475-971e-ba7aeaba42a6	utilizzare una cabina di sabbiatura
07c055ae-9a96-46e4-9b34-b4c99bdcedbc	sviluppare le competenze personali
07d10624-af52-4458-a231-423c4b3a2c5b	regolare il flusso delle sostanze nelle condotte
07da7362-59fa-4213-9a5d-fa7982f6f6e8	buone pratiche di fabbricazione
07daff69-ce53-47ec-af78-727c26325824	applicare le misure sanitarie
07dd77da-f36d-49fc-9be6-13cd32baf225	requisiti operativi per le immersioni
07df7c3d-1a1e-4c09-8e87-83e32bec620d	sorvegliare i generatori elettrici
07e6afd5-555a-45d5-ac91-285423f4e678	calcolare la produttività della fabbricazione di calzature e prodotti di pelletteria
080074d0-beb1-4cfc-983e-c64ec924337e	ispezionare le capsule
07e9edcb-0c5c-460b-99ab-8fed4dcfe245	MATLAB
080408e6-452d-47e5-b089-99a7f25e0ee2	utilizzare la macchina cippatrice
07fb3c20-baae-415f-9b9c-f0df957f6c6c	monitorare la qualità dei prodotti dolciari
07eccd3e-4edd-4955-9b1a-129167fd8703	lavorare con il direttore della fotografia
0809c818-00cd-4d7d-b60e-c0e496449cb8	sistemi di biofiltro
081338ee-42ac-4663-8778-84aad1a1cffa	aspetti ambientali del trasporto su vie navigabili interne
080b2ccb-e677-465e-b39f-e90b17fe4502	studi medici
0812b2e6-75d0-4662-a275-88920f49df40	registrare gli animali d’affezione
08167aa9-3b01-4bf4-bf1b-e3291b6b25e6	biologia evolutiva
0821d3e8-d8e6-4cdb-abeb-274352f39586	vendere i contratti di servizio per gli elettrodomestici
082c027e-f813-430d-803f-38f0c2000c5c	potare siepi e alberi
082d1ad9-381f-4e1c-9a28-fd075e108925	garantire il rispetto della costituzione
0830da04-9a35-488e-8677-3a65f096452c	personalizzare software per sistemi di azionamento
083812c7-5304-409f-99a4-6c7182bbb516	condizione delle strade locali
083960e9-cbd3-403e-9435-6d1716ff9f1b	kazako
0832a0db-01ab-4ca4-9f2d-768bdcaa1e15	manipolare il pesce catturato
083fdfcc-bc36-42df-8d1d-6d3e2913b821	analizzare i requisiti di larghezza di banda di rete
0847dfd7-98fd-49ce-93a1-cfd2e42e890f	leggere la mano
0839310b-9b79-4d9e-b87e-ec1c98d3f500	Common Lisp
0849026d-90b3-4f9d-bdf3-b3b45d273694	fornire formazione in loco negli impianti di acquacoltura
084a40bd-bcd1-4ef0-aff7-dc92dbae199a	acquistare i materiali per l’automobile
084a8c6f-1d6f-4855-9993-9c8c83029eb4	stenografia
084d5ac3-5e61-4500-aac6-2bdb703d3e90	raccogliere le informazioni sul tasso di crescita
0862ba05-841e-434b-8da2-55a6828439bc	biomeccanica
085d8c6a-4bda-40c5-9985-513abeae533f	tecniche di demolizione
086ad433-3237-442c-b6f8-2c8deebefd12	installare il limitatore di velocità dell’ascensore
084d0568-385f-4f28-83f7-45d098b76ec6	organizzare le informazioni sulla disponibilità del gruppo
08649bf0-c8b9-481f-b891-b8ef7cc79ffa	procedure operative treno
085c3f49-1021-41dc-88ff-b5de76975ffd	lavorare in un ambiente multiculturale nell’assistenza sanitaria
086e5f88-afca-4146-bbab-479ca3a73a98	creare materiale di sensibilizzazione
0873c0b2-6ba7-4746-8889-a1e8aeb5d0a1	rimuovere sostanze gommose da liquidi
087c918b-5edc-4576-b05a-b1e110b419e4	sviluppare i piani relativi al trasferimento di cure
0870a7f0-0f6c-44ca-ac64-9fa3cba5e18e	tipi di rete metallica
088770e9-94b7-44c2-96c5-7309cbddb391	processi di prestampa
08821780-16e8-48bd-b798-916855a624dd	risolvere problemi di localizzazione e navigazione utilizzando strumenti GPS
088f2b93-fdec-4f12-9f2f-be75506162c2	lavorare con un gruppo circense
08943f35-c8df-4a58-bfc5-7539042c83f0	composizione dei prodotti alimentari
088bd3d3-45fb-4dab-9ae5-54e31fbb15e7	analizzare la resistenza allo stress dei prodotti
088ca271-0975-4bc6-a73a-a14d40702857	lavorare nell’ambito di squadre di perforazione
089625ee-523e-4bc0-bf78-0d259e995ac0	utilizzare gli impianti pesanti di acquacoltura
088f777c-5721-4b31-9c50-876102fee5ca	sorvegliare l’attrezzatura per l’erogazione dei servizi di pubblica utilità
0899195e-17f6-4916-8bf3-c0849a13e5a7	eseguire il controllo dell’erosione
08871ef4-1445-4486-b70e-d911bd839e9b	creare i rapporti di ispezione dei camini
089989e1-dc41-4a2e-8632-5de422627516	specializzarsi in un genere musicale
08ababbe-d90f-4355-aff1-092a7a6ffff9	progettare i sistemi di raccolta dell’energia dei parchi eolici
08a2ab5b-d4d6-49f8-88a9-3ad4ff6c73d6	proprietà fisico-chimiche del cuoio in crosta
08b43a7e-836f-4283-8e82-0ea98252e5b7	fisiologia del lavoro
08bae992-20a2-40fd-a451-09c3fb5f453f	effettuare la manutenzione delle cime
08ca36a9-518a-47b0-b335-ebc496b49b0a	regimi alimentari legati a motivazioni religiose culturali e allergie
08c75906-1e1a-468b-8060-2ddaf118af01	fornire consulenza sul settore sanitario ai responsabili delle politiche
08cccf32-8843-43ff-a9ba-ab7611dd6f05	essere addetto ai tubi flessibili
08da065b-1a1c-422e-a7d0-b63b30901086	principi di stivaggio delle merci
08b947ac-2401-42fb-872f-66e8830155b3	SAP R3
08c827b5-c6f1-4685-b709-9fca4adeb7e4	creare forme musicali
08f8e2ff-8808-4d4e-bf9b-1f340cf4ca0b	pianificare la strategia pubblicitaria
08f06ff6-3e5a-4b26-9436-dcf5f9c47bab	utilizzare una macchina per la stampa flessografica
08fba8f0-d0ca-42f8-a991-6ba1dababe21	ricoprire le cuciture con mastice
08fa77dc-bc91-4f87-baae-972b0fe3e3cc	utilizzare attrezzatura di laboratorio
0907f0dc-c560-4f42-8b5b-eb3eb8c77dfd	mezzi di stampa
0914556b-d8fe-4305-a71a-bc43d77310ac	interpretare dimensioni geometriche e tolleranze
090f061f-8d7d-4656-b596-6bd6d73c17e2	sviluppare il programma del corso
0916f78c-9033-4b51-83f1-b0cccb73ae68	studiare il comportamento umano
0927bfbb-92ba-4ef2-b3ab-5b4e4f45089d	controllare la qualità dello smalto
0934c0ea-7c3b-4c79-b54f-a001ac9ca506	effettuare la manutenzione dei tetti
094b6ed5-486b-4da4-8348-193475c1eb66	piattaforme hardware
092874f4-8ad5-40e9-9f7a-ac64ea42a13c	analizzare il mercato della formazione
08ffe429-98aa-42e9-87cc-74167d7a72b4	analizzare i dati ecologici
0950bb28-dcec-46ca-a755-5d829cee1941	processo di fermentazione delle foglie di tabacco
0919e487-38b5-4273-93fc-2d0e23b44436	fornire informazioni ai visitatori di siti turistici
094baff0-f9ae-4ed0-86b9-25a0fa8b04e8	gestire i problemi di helpdesk
095712ac-7a14-4b15-bca2-881e4a933bf4	controllare le finanze di un casinò
095d2bb8-1458-4b77-9121-f6a53358a7f7	stabilire se un’impresa è avviata
096bd0ae-0e96-4427-8107-9fb16cbc488d	partecipare alle registrazioni musicali
096d4ec4-047b-46a9-ab86-eb4c4a9cf44e	lavorare in modo indipendente nella paesaggistica
0971937f-93e3-4ef4-b4d7-c606322c3039	comprendere il rumeno scritto
0975ef78-33f9-4f26-b363-8d0c6a9817fe	individuare tendenze tra i dati geografici
097196dd-d485-4a18-b525-99d087529ae9	gestire le norme di sicurezza del trasporto marittimo
095bf965-ee09-4bbf-b455-0ac33a5c9124	fornire assistenza ai visitatori della foresta
098b1519-380f-4972-93bf-efb9d9a989a6	manutenere la camera del vuoto
098b2146-6245-4686-a89b-f042afff2e64	proteggere i componenti del pezzo durante la lavorazione
09635dc2-2a03-44b8-974b-a2a200b6033b	applicare gli standard di qualità nell’attività di spazzacamino
098cd018-6309-4924-9e29-841ce064aae7	azionare le attrezzature meccaniche delle navi
098d17fb-c130-49b2-9e54-0525a27f263d	fornire le perizie nel contesto della psicologia clinica
098d15c8-95bf-4660-a6b6-10d9eb694c5d	gestire le sostanze infiammabili
097e8d2d-a8cd-4216-ba8e-1972fd42675b	Canvas (sistemi di gestione dell’apprendimento)
09931b9a-9dae-49bd-84a8-9ca4e1a48e5a	essere addetto a martelli di forgiatura
09a2d309-78d0-4f20-9ae8-c1fc2f255acf	maneggiare l’attrezzatura sospesa
0998323b-5df2-4f1b-b5fe-d247bfa4ba4b	utilizzare i pannelli di controllo della cabina di pilotaggio
0996f157-c732-4620-9ae0-34c22f2887e9	gestire una unità di lavoro sociale
09900d6f-348b-4f2b-9f27-57d2a54ba1dd	pianificare le campagne pubblicitarie
09a5c602-c6d7-4c2a-b1db-f2f7b471221b	consigliare il personale medico
09ae89e6-fc73-41bf-b44f-4eeb4e9df45e	Puppet (strumenti per la gestione della configurazione software)
09b37377-b982-43f3-a607-7a109ee69ccd	fare attenzione alla segnaletica marittima
09c2a612-77aa-482b-863f-30fa49f32cf1	norme per il piano di studi
09c75d7f-57dc-42c9-9355-e95d7ac796fc	riparare orologi
09d07cb9-2e8c-4024-8354-14a1e3db6d86	principi stabilità della nave
09e60a8d-d43f-474e-bc1a-ed5250739e1d	categorie di prodotti di gioielleria
09d1fc16-de68-45eb-8f25-0ca6583a1ae8	preparare il ristorante per il servizio
09ab9bde-3b8b-43a0-8339-6abcfa64719e	fornire assistenza alle famiglie in situazioni di crisi
09cb9532-89e4-44ba-8b7c-5cf8a0cec7e2	mantenere condizioni di lavoro sicure negli spettacoli
09e94ede-cafb-4439-a2b9-ba42c3298331	effettuare massaggi a donne in gravidanza
09c693db-d7a5-42a3-8e19-4667c0ae966e	fornire informazioni sui beni immobili
09f76217-986b-4cd8-bf0e-98b2ae0ce09f	officiare i matrimoni
09e9adfe-d92c-4d3a-bae4-3631c95c0c89	produrre complementi in tessuto
0a04d896-8193-486e-9387-d4447571a7ad	diritto societario
09fcfe42-b4a0-464f-af27-bf160b518034	sistemi elettrici aeroportuali
0a0697bf-48c8-4e2b-a391-45f5bccd87da	controllare la costruzione del vano ascensore
0a0e8463-b140-4cbd-8c2b-a832813f4142	processi e tecniche di pre-cucitura per la fabbricazione di calzature e prodotti di pelletteria
0a08fe9c-3e78-4f62-b579-2f831c94f848	ottimizzare la produzione
0a143217-1bbe-4e90-8c12-40046846ac8f	produrre componenti per arpa
0a06a603-ec4e-4af7-b61d-6937e15f9a14	prendere decisioni operative indipendenti
0a1e59b2-d16e-4b8e-9ad5-e5cb304ab5db	comprendere il tedesco scritto
0a20b3bb-b41b-439c-9673-f86dc718e511	azionare il teodolite
0a228e7c-b286-4382-9325-0877f9bde851	fornire assistenza chiropratica alle donne in stato di gravidanza
0a209d79-084d-4405-83fc-fa39038f1417	illustrare i menu
0a2ae30d-cb38-4521-be20-4faee526d3a4	offrire consulenza sulla manutenzione dei mobili
0a36d9b1-763f-4ed4-89c1-34bb7a63f04a	utilizzare il software di gestione del noleggio
0a42df7f-b62c-4eea-b042-b099d5055a50	fratturazione idraulica
0a27d297-e94d-473f-b0b0-87f3128e1a7a	mettere in atto processi di controllo qualità dei dati
0a3c103e-eb5d-47b9-b3fb-66bf3c926407	tenersi aggiornati sulle acconciature di tendenza
0a4bca14-3ed3-44f8-b445-ca58fa90a235	insegnare i principi del settore ricettivo
0a4c15e4-03ae-42ea-99f5-b15deedf2b64	supervisionare le procedure penitenziarie
0a5272b7-5c8f-4e71-a176-ed73f45aeb53	differenziare il miele a seconda dell’origine
0a3fe01b-e64a-441f-afee-dcb438480c70	valutare i rischi comportati dalle attività di estrazione
0a5535b3-9da3-4d91-ab0f-f73e74f7b9b1	compilare i moduli
0a56580c-9841-4dde-93cf-232ad9e114dc	motivare chi pratica uno sport
0a5bab4b-69ec-4a2c-b1cb-c495d626bfd3	coordinare le norme tecniche per l’interoperabilità globale
0a632716-40f1-4c64-a94d-43b09b506a18	tenersi aggiornati sulla pratica professionale della danza
0a646331-9576-4ad8-a6fb-01f767137ecd	fornire gli alimenti e le bevande
0a649c25-3135-461e-a1cb-bdb2c26a20a6	svolgere allenamento fisico
0a79d239-0c2a-442f-83ca-b98834568dae	mantenere i contatti con i responsabili dei canali di distribuzione
0a70ee7b-9cf3-4f6e-9223-0db3f69d8dd8	comunicare con i giovani
0a7c3f47-864f-4d18-bb4e-4b74ccf8a0b6	far funzionare un totalizzatore
0a7bcb03-3503-4dc4-a517-3e4a12adbf27	definire i materiali degli oggetti di scena
0a7c792e-64fa-42d8-bd7b-aa74e09e9abb	componenti degli articoli di pelletteria
0a7642f8-f92a-4b6c-99d3-ee2c2ea4d7f2	proporre le apparecchiature di telecomunicazione ai clienti
0aa0b66b-bfe2-4a40-b3dc-f5bdb71e0b1b	comprendere il limburghese scritto
0a822245-ffdf-4f57-97d7-2504198fc16e	comprendere il giavanese scritto
0a9db9b2-b7c2-4813-baa6-f244d3efda9b	ricevere dichiarazioni giurate
0a975088-9175-4660-87aa-f6df1b3bf5ee	mezzi di contrasto
0a96b9e7-2cf9-4d8b-b947-b889a757f34e	valutare le esigenze terapeutiche del paziente
0aa4ad4d-323a-483b-a69c-b485949d03a7	lanciare le scialuppe di salvataggio
0aa464e6-4358-4f54-a979-20ec0d58271c	gestire i test sulla qualità dell’acqua
0aaf7437-5e11-45e3-9cff-ce7a6d25e754	trattenere i trasgressori
0aa71cb7-4fa0-4e2a-bf05-61de64f6f000	individuare i problemi di condensa
0acb0a21-f4ec-4bb5-b5a8-03432b005a4e	prendere le ordinazioni di cibo e bevande dei clienti
0ad3ad3c-4767-48ba-aafd-d80a6ec938da	tipi di tessuto
0acfced2-bfcb-4bd0-99ac-57845f03331f	trasferire la cera
0ad72da0-cda8-451f-8e48-149202c961c1	diritto del lavoro
0ac785ba-8ea4-40c8-be53-c4f3c2462049	gestire i progetti di ricerca e sviluppo
0ad7528d-c729-4b92-b89b-f250a9b097d7	lavare i piatti
0ade1545-c6a2-46c4-897f-e45242230690	scrivere le descrizioni delle posizioni lavorative
0adfd275-c4a3-4a37-8695-78f5c7ae55fb	gestire la frustrazione
0adb66e7-007c-4e13-ada6-484a03114265	installare le attrezzature per le gru
0af1f3fe-62d3-4b9c-9996-c53f3a148da9	svolgere le ricerche sul mercato immobiliare
0ad646d9-0350-4692-bfc9-d92b00e36e4b	Capture One
0af5e718-9acd-42c8-96a5-c63855104aeb	promuovere un’organizzazione sportiva
0afb2032-9f2c-4bfc-bb3c-e6ff7329b329	spiegare i tipi di disturbi della coagulazione
0b01e595-d44e-45f1-8384-a34ae83138f5	valutare le esecuzioni
0afd9841-d3bf-48fe-84fe-32a3d5e2c4bd	tipi di molle
0b135467-8f3f-4481-9ec3-030c8ed4a9fc	gestire i fabbisogni di articoli di cancelleria
0b02c07f-0e51-41e6-8dd0-741732974189	schema di progettazione dell’UI del software
0b0ea55f-af2b-4eea-aaf9-ccaace098faf	fornire assistenza alla squadra dei rilievi forestali
0b164522-f189-4f3a-a5d5-baa9e4d13fac	irrigazione fertilizzante
0b1934bf-bfdc-4005-b759-7cacc8c83e74	comprendere l’estone scritto
0b094315-3e89-47c5-922e-2b26d19c7969	tracciare le rotte di navigazione delle spedizioni
0b19717a-9c37-47fd-8fbd-35539e4058d6	Azionare i sistemi di lavaggio dello zucchero
0b1d65a6-2a43-4d47-a340-8de89cdeef9f	fave di cacao tostate
0b2713f3-502e-4edc-bbdf-fe44f0050475	registrazione di incidenti e infortuni
0b1a05ad-5148-4de8-ad8c-5d9fd8a78899	condurre una valutazione sensoriale
0b2b4781-effd-4adb-9460-6d88012af4f1	controllare la pressione dell’acqua
0b2cc2cf-d51c-4982-8e5c-08a74be90aa4	utilizzare macchinari di precisione
0b305388-c039-4e71-bb5c-403d2c1b0fc2	fornire le cure veterinarie al bestiame
0b3c03b8-d8fa-4a96-8cfc-6c809a3d85fa	organizzare mostre zoologiche
0b1ffcaa-dc9f-4abd-ad69-36a9452b40ed	comunicare con i visitatori del parco
0b3ef6d0-c08c-4055-829b-6184b82536bd	interpretare carte 2D
0b59ca87-5f25-4f21-a9be-6986be19d2b1	gestire i servizi di navigazione aerea
0b6eee89-0d6a-479b-af41-e16f96db9896	pianificazione dosimetrica
0b5eb94b-7fd2-41b9-85fe-85b22251fdd6	comprendere il berbero scritto
0b7c15b5-b628-4279-b53a-e8ccfe171038	gestione dei fornitori
0b708df0-dfb6-4d12-b57f-81181234fb0d	fornire aiuto spirituale
0b8506cf-9a52-4fd4-91f9-2dfbf810ec6c	gestire i rifiuti della cattura dei pesci
0b8ad99d-1e15-4255-8794-dd7f0586f676	parassitologia
0b790a1f-75a0-4762-b6e3-fb3959205596	utilizzare i sistemi informatici per la corrispondenza
0b768477-0c5b-4609-9806-e0610b2b1709	collaudare attrezzature minerarie
0b97faaf-3edf-47b0-a46e-cf8b2cb3757f	coinvolgimento dei cittadini nell’assistenza sanitaria
0b8cd308-51a0-421a-a7b4-ed713d3c0a11	effettuare la manutenzione delle imbarcazioni a motore
0b9d5bb4-e9ca-42fe-850b-b64249e78f89	endoscopia
0b9be501-136e-4e3c-9c54-d620e3a235bc	usare metodologie di progettazione centrata sull’utente
0b9647d6-4615-43f2-92d6-ad509eb238ee	imballare i prodotti in pietra
0ba84742-d026-4499-b6bb-7c7de97f7fd0	stordire gli animali
0ba89892-4355-48bd-9acf-a376aef8c7cc	concetti di strategia aziendale
0bb7407b-823f-4909-b3ab-1ac948a015f5	controllare la produzione di carne di selvaggina per il consumo umano
0bbaa38d-0f5f-41ac-9b4d-dd72237b835e	sistema sanitario
0bb5d5c6-f0eb-497b-b683-ce030f9bc0d9	gestire la documentazione di spedizione
0bc13e1b-022c-42d4-b066-90c1b37e1663	gestire le prove
0bbb7c0e-8889-4747-8af9-fee6f229031a	fornire consulenza per il trattamento nel contesto della psicologia della salute
0bc2d105-edc6-43cb-b559-eaad4c75ab1b	trasformare le impronte della bocca in modelli
0bd1c57c-57cf-4269-aa38-00457db8512b	ideare i progetti di gioielli
0bd6e4f6-9091-4690-bed0-477f2e333c5d	programmazione in tempo reale
0be755f5-d7dc-474b-8c2e-1e1f7f03fa8c	parti di laminatoio
0be543ba-6e5a-487a-89c8-862e70e61ece	promuovere la salute oculare
0bc726b2-ee8e-4954-93be-feb773f96d66	sviluppare idee per programmi radiotelevisivi
0bedf119-37e4-4180-b5b4-554bd022ffb7	essere addetto a macchine cucitrici automatiche
0be3f2f6-9d8e-4f82-bf14-db5b2e58081c	condurre valutazioni della qualità dei contenuti
0bfd4069-8d46-4bc7-a8da-f61a9ea60b0d	creare programmi di allenamento per rischi per la salute
0c0444ed-3dbe-4f81-8147-20a77c78f073	sostenere i servizi trasfusionali
0c0e3693-f76f-4135-ae3d-e36053003fd8	organizzare eventi di degustazione di vini
0c0518ac-da9b-4033-b778-a5d752649af3	preparare le attrezzature di terapia dell’animale
0c086995-397c-4c28-948e-c971457cf5ae	fissare lame di coltello
0c0ed4b1-ed42-4d16-8319-28636e05fa90	curare gli alberi
0bace24d-45a1-4e8a-9702-26dc2c440f57	strumenti per il penetration test
0c12a7f8-1212-440f-8d6a-c60ca5af82bd	gestire la contabilità
0c1612c7-6659-4b5f-a4ea-decb75e455ec	dimostrare spirito imprenditoriale
0c19e830-96e2-4352-9c99-b13365404b7d	progettare sistemi elettrici
0c19cb07-a4c8-498b-8d7f-edd4900573c8	sorvegliare il motore del compressore
0c202a74-8901-4ab5-bf50-2bdcecdb65ce	tecnologia sanitaria
0c2223e8-f824-4697-b81c-bd94d37e24f7	sviluppare processi biocatalitici
0c29357c-5fc7-4a6c-95e3-9097e4bd18dc	terapia ormonale oncologica
0c1de89c-08a2-4d2f-9ce5-7632af5389f3	monitorare la concorrenza del proprio settore nel commercio elettronico
0c1702e1-0730-4ef6-a4f0-dc8d258e78b7	supervisionare i costumisti
0c3ace46-b576-43b3-bf5b-ba9c7dd91cae	effettuare le analisi del marchio
0c401111-c199-4415-b8e3-a89a1acebd89	normativa fiscale
0c49dd7d-0375-4f85-ba17-5895eff1ef9c	valutare la gestione degli animali
0c4caf00-f13b-4a4f-a511-5ac5dceadb80	costruire le conchiglie
0c57929b-2df9-4aa8-a43f-3f2058177367	promuovere la comunicazione all’interno dell’organizzazione
0c6925f2-043b-470d-9164-fe78b063475f	diritto doganale
0c6b3bb2-4a80-4074-bd32-6c9a3e345037	preparare i NOTAM per i servizi presso il terminal dell’aeroporto
0c6f72ad-f7b6-4392-85a1-035b5dc995e9	utilizzare strategie di apprendimento
0c43633c-a279-49df-a0f7-d129c219ec62	fornire informazioni sul consenso informato degli assistiti
0c72748b-2246-46fd-9052-03931e9b4df0	ritagliare pellicola fotografica
0c7d9a22-849f-4492-a6fa-1226da24ae57	posare la membrana impermeabile
0c77d62c-941d-42c8-a01f-f51f480896bc	macchine da stampa per serigrafia
0c790835-3589-4f71-a204-123cddb84a06	fornire istruzione nel settore dello sport
0c7f12b1-4066-46cf-af6d-1e0c96a195a4	vuotare i cassonetti per la raccolta dei rifiuti
0c806dbd-8400-4bef-8e78-2e6ccbc00c0d	pasti pronti
0c8e4aa8-2fbe-479f-98bc-5edabe61bb86	usare le tecniche di autodifesa
0c8ef705-7bd2-4a1c-9c4c-73bf8871789c	finanza pubblica
0c9638eb-ccd7-4d83-b475-af6dc58f3d6a	periodo post partum
0c966cfe-4878-4adb-9468-c8e8cdbbc370	mescolare le sostanze chimiche
0c926ff2-e629-4747-8b66-d64b473bf79c	biologia molecolare
0c97a092-585c-4051-b82a-ce70ec7ab4c6	operazioni del servizio bevande
0c9a1f2b-365e-419e-a640-2ed223384007	effettuare le attività di sicurezza con un cane
0c90adc9-dc84-41b2-b381-76d12f854fc8	risolvere i problemi nel gioco d’azzardo attraverso mezzi digitali
0c9ab07b-084e-40fb-a098-8743ba9c3888	effettuare test didattici
0c9d0758-0ff7-44e5-9d3f-ab7250e86985	prendere decisioni in materia di paesaggio
0c9f732b-9847-4bf6-833c-66ffe5a4638d	procedure di collaudo di microsistemi
0ca85b8b-9e22-4051-ba5c-507f8ecc6420	tenere traccia delle spedizioni
0ca9ee60-d66d-463a-a885-6f4dcc7c13e6	flusso di lavoro basato su file
0caf7237-bf56-4f47-83e8-61c9ebbd5d8e	programma di selezione genetica
0cb0a6a7-2f62-4dbe-8cdc-ac932e1053dd	organizzare l’ambiente sportivo
0c9d4d27-bc97-4bba-bf28-310fa8db0b1c	interpretare i risultati degli esami ematologici
0cb2d0e4-f85a-4f4f-a658-49163e8319d1	aggiustare graffi di minore entità
0cb65e54-4f10-4ac5-b35a-88fac413bca2	scrivere in russo
0cb7cd1c-6768-4847-8422-2baee713bb09	utilizzare le macchine a raggi X
0cde0b13-8d2d-4fdf-afe2-9914aded8865	leggere i piani di stivaggio
0cccf55f-6ad0-4fac-8c56-22129b0cc71c	interrogare i proprietari di animali in merito alle condizioni degli animali
0cdd17d8-e69d-4761-a108-d0c3eb906154	disegnare bozzetti di immagini di set
0cc1bfec-fea0-4084-8597-06f3f5cc96df	fornire consulenza in merito allo sviluppo della miniera
0cde15f9-418a-47e4-b5b7-47d52a275f68	utilizzare le apparecchiature di scansione dei codici a barre
0ce3107b-5c29-4e8b-b0b7-2b7862aaa8ce	utilizzare apparecchiature per il posizionamento della SMT
0ce0eae5-fb61-412a-aa55-e4daaf8c5e57	fornire sostegno all’apprendimento
0cecbd4c-51fe-41e8-96f8-294bf9844704	comunicare nel contesto di assistenza infermieristica specializzata
0cee8341-7639-4dda-aba6-bef052fb6127	marcare i rulli
0ce708c3-b44a-4a6c-9c47-6260c30c6dd6	scrivere in telugu
0cf7e5cb-f4ff-4e3c-a3d1-dc122e58b78b	pensare in modo proattivo per garantire le vendite
0ceee1bb-a49f-41f4-8d97-3fa750a454f6	redigere la documentazione relativa ai lotti di prodotti
0cf8a5a3-db1e-4f68-a3ba-8cc6baccafd5	specie vegetali
0cfd0a07-4021-448c-9f46-83047197373d	teoria musicale
0cfe4132-ba8e-436c-927a-8309cfb5fadd	preparare la relazione sul sondaggio
0d06d378-4c22-4234-a992-af6c216d321f	effettuare la rotazione delle scorte
0cf3eda3-445d-419c-87d8-ba1fc82c3f0a	sviluppare le relazioni di statistica finanziaria
0d08852b-ae0b-4e22-95dc-481ecf9b190f	aprire conti bancari
0d104230-b6c2-4066-9394-ddd4f9439fc1	gestire azioni correttive
0d386dba-d79d-4e57-935b-c82adb331b77	insegnare i principi della tecnologia dei trasporti
0d0f4690-06bb-462d-9f34-9918a055588d	ricevere informazioni chiave sui progetti
0d27dd75-0c3f-4785-8ae1-d86f6bb4992e	bulbi per sprinkler automatici
0d27db8c-3fba-4e45-a7d9-e79ebad76704	effettuare la manutenzione delle centraline di irrigazione
0d299f60-7d06-4226-a753-95b09ecbc6c0	tipi di combustibile
0d45297e-3d38-410f-9a22-a44b9175a899	utilizzare gli strumenti matematici per la gestione dei veicoli
0d6eac7b-51f7-42fc-aa09-64f4aa67eb69	coltivare le colture destinate agli esperimenti di monitoraggio
0d6abccd-fa3c-452a-b25e-c70aa556463a	applicare sistemi di taglio a macchina per la produzione di calzature e articoli di pelletteria
0d733722-67cb-439a-941d-940bc96d7dd7	installare sistemi pneumatici
0d5babb3-c447-44e0-ab4f-d0a8da3d383a	fornire un sostegno per l’autogestione
0d7b34a2-6764-46f1-8140-b7539216fe0b	metafisica
0d7f58e1-8a11-459e-9861-0a1fbd5ef3a8	preparare la preforma delle pietre preziose
0d6415ab-7142-46b0-9731-ea6451bf66df	creare dessert innovativi
0d73b022-2b92-4ee7-bc6c-00e99a59cecc	gestire la manutenzione degli esterni
0d73a401-2ce0-4c4a-bfe8-6ae4f29a2eaa	consigliare i clienti sugli orologi
0d8236e4-1e6a-469a-9303-87031a72ecc9	interpretare le regole di giochi sportivi
0d8377f1-ed3b-4e99-88a7-ca1753d12ac9	addestrare i futuri militari in merito alle loro attività e ai loro doveri nelle forze armate
0d90e825-cda5-4b37-8bec-b779e9524b60	adattare gli oggetti di scena
0d93377f-3029-4e30-afe6-2efb732e5564	moderare un dibattito
0d9632f3-f407-426d-8fc5-f09673821bfd	utilizzare le attrezzature specializzate nei casi di emergenza
0d895145-cd25-47ca-92b2-ca69f3c8454a	mantenere un registro delle attività
0d99015c-f0b0-4d2f-801e-d12341295c09	fornire informazioni in ambito umanitario
0da1dcca-ccc6-4765-8b62-1ec585d561ea	utilizzare la macchina per la cucitura di carta
0d9770de-de3e-4f09-ae93-d46af7ff8abc	rispettare le preferenze culturali
0da45566-513e-4f4b-99d6-5c3248890b50	effettuare i trattamenti ortottici
0da69d8f-5c18-4bb2-94e8-7b4bad547e56	tenersi aggiornati sulle politiche del produttore
0dabe299-813b-45e5-bcda-28f77ce4d0c2	eseguire la saldatura con metallo sotto protezione di gas attivo
0db524a6-6144-4714-b22f-78254c8e87a6	verniciare con la vernice spray
0db2cf74-783c-4fd7-aec3-97f556f32e1d	controllare i segni vitali dei pazienti
0dbb7f5b-1ad7-4f87-8532-7e73844c9f49	supervisionare i lavori
0da77d5d-4d43-4166-bc7a-dace6fbbdbb7	CoffeeScript
0dc3effc-ba6f-4566-a16d-fa671a20771a	macchine per movimentare i materiali da costruzione
0dc9be00-8aa5-4533-b783-bc9a39af7fff	gestire l’allevamento di insetti
0dc9dff7-f98c-48cd-a46a-97555c4194f2	testare l’acutezza visiva
0d92a96e-b52b-431a-8ee5-1126ba3d05ed	mantenere in condizioni idonee le attrezzature di manutenzione aeroportuale
0dd8ad47-43ec-4752-9cdc-ece9f7157f09	disturbi alimentari
0dcefa14-ffc1-43a9-9796-b2b50db217fc	posizionare il motore sul banco di prova
0dd2c777-e997-4dd8-94ba-c180aac84baf	aiutare il programmatore a definire una visione artistica
0dc76829-2814-450d-bab4-bfb08f4aa661	esercitare la propria responsabilità professionale
0dca6d0a-ad91-4462-8f89-8050ba67429f	valutare le proprie competenze nella conduzione di attività artistiche
0dde5024-b9be-4440-8b14-db18d67b333e	mantenere la temperatura della fornace
0de8ddcb-24bb-401c-9cc7-a36c340d3095	eseguire la chiarificazione dell’olio tramite bollitura
0dde2c82-6cf6-4734-948a-a0b38496a1c8	stabilire i prezzi delle voci del menu
0def962e-3821-4637-9728-4bb3313c307b	utilizzare strumenti per attività di estrazione
0de4c197-947f-4067-920d-e3daaa8c6ecd	classificare i pesci giovani
0df0795b-5230-41af-97a2-28a86f31d64b	lavorare in una scuola professionale
0de05f04-7670-4131-894f-d01e271fb822	fornire informazioni sulle turbine eoliche
0e0c84d6-2b8b-4430-8965-9e7afe30bd35	coordinare la preparazione di nuovi siti
0df31ad6-c56b-47de-b495-bd03301d2efb	applicare la formula del sapone
0e10e89c-d6f3-4a18-bd2c-8e6ec4afc404	rispettare le misure di sicurezza in una sala da gioco
0e1df634-10d8-40c0-8f96-621e828dbe18	insegnare i metodi di comunicazione
0e27aea2-277d-41b3-b4c7-46ec56922a32	effettuare la manutenzione dei macchinari per la somministrazione dell’anestesia
0e27cac3-c938-40ba-9221-5b3221735db4	progettare il posizionamento dell’hardware TIC
0e0d49e6-bcd7-4488-9f75-24333e09313c	sviluppare i piani di efficienza per le spedizioni marittime
0e23018d-e3b5-4636-800a-0de150dd3cff	misure di salute e sicurezza nel settore della pulizia
0e2915a8-870c-495d-862f-9d89d1203c2d	dare lezioni di volo
0e339731-a640-4736-ac16-5668e0228fbf	comprendere il catalano parlato
0e3540a5-5d1d-407a-9ec2-45fccbf73906	gestire i tempi nei processi di fusione
0e42e7a8-bc9e-4048-9995-89f3c39e63e7	azionare il misuratore di biogas
0e44ece0-2733-4e98-b9a8-44a8f3282975	istruire lo staff di vendita in merito al sistema espositivo creativo
0e54ff9a-0990-426b-af45-3c9660d8eae7	saldare sott’acqua
0e4f70b8-582f-484a-b617-86b0af71ced4	comunicare le aspettative delle azioni di combattimento
0e46030d-9735-4815-a9bb-97e6e0673081	applicare le regole di giochi sportivi
0e49e5db-c80d-4055-a70b-a6064e9dd91c	collaudare hardware
0e47e6a5-4f21-4b21-90ff-9ff56c6b01dd	offrire consulenza sulla raccolta di legname
0e5985ac-a506-431a-bb0f-61a9ceb01778	requisiti giuridici per operare nel settore della vendita al dettaglio di automobili
0e59c144-47f6-43d3-b5bf-36abe3693a53	utilizzare le pompe per lo spegnimento degli incendi
0e60e6c5-bc32-4af3-a0a9-d714f4f401fd	custodire macchinari di costruzione degli stampi
0e7a73fe-e4b3-494b-b7e0-537ff07b45ba	valutare la risposta alle radiazioni
0e7f8542-73ee-44ec-a929-5183827ea1fe	pulire le unità di trasformazione petrolifera
0e8824ce-5b65-412d-955c-e26cede6035b	analizzare i piani di traffico stradale
0e82f592-e93d-4b34-a294-071806de55c7	monitorare l’utilizzo di attrezzature militari
0e90f6ca-c283-4558-bfee-6ee128cae661	produrre componenti per pianoforte
0e8babba-c5aa-43c7-995f-2fd0dbe5bda3	redigere proposte legislative
0e89679a-7300-4445-b1e3-d6d3fc183e28	analizzare campioni di alimenti e bevande
0e9ea856-6cdd-477c-8aa6-cc41327b07c6	comprendere il marathi scritto
0ea59c3d-5f99-4d0b-aabd-4c84b10eeb83	lavorare in un ambiente sportivo professionale
0ea0d4ba-9383-43dd-8cab-0fb0664bee2a	essere addetto a piallatrici per metallo
0e9f8afc-c9f3-4763-b82c-ef4465d26f2c	elettronica
0e998409-2be5-4aef-8202-7e0a1c99b8f2	pianificare eventi multiprogramma
0ea675d4-9dcc-41ad-941d-f7639936fb2b	essere addetto a macchine di produzione della carne
0eb71c6e-5121-47e5-8c9b-1acf68ec8920	comprendere l’azerbaigiano parlato
0eb262de-48f5-4771-9690-3c5ebd7259bd	manipolare i metalli
0ea6ca6f-f697-47a1-abe7-37aedafa4443	statistica
0eba4de4-113d-44ed-939b-86ce4f4ea2c2	lavorare in una squadra basata sul territorio
0edb4d4d-054e-488c-ae3f-a5a5e6520d99	valutare la necessità di cura delle zampe dei bovini
0ed91fd2-ad6c-499f-bebc-9c113036d2d6	tipi di carta
0eeb1ae6-9938-4174-a3f8-e6127d2b959a	rischi a bordo
0ed24828-8246-47d1-bd7f-a320c387b194	fornire coaching ai dipendenti
0eef1507-7633-4826-ba15-c6cce35fea05	riparare le strutture laminate
0efbb6c2-18d8-4025-aef7-f9f7205e9322	tenere in ordine i documenti doganali
0eef902f-4342-4d79-b13c-49a6276aa568	controllare a distanza il ciclo di produzione
0ee793b4-fbe3-4370-bf35-ba31998291b9	assistere i clienti
0efe35a7-8561-4532-946b-06bcc267582a	associazioni di giardini zoologici
0ef4e5e8-64d2-4aff-b859-9eac73d710c6	collaborare con i colleghi
0f012c78-c45a-4ef5-9ee2-8ea96ad24e4f	catturare i pesci vivi
0f09aeb6-0fbd-43b4-9314-c03e193be1be	riparare i dispositivi dotati di serrature
0f06cdc4-41ff-4433-a97d-f75f732de7be	analizzare le esigenze per i traslochi
0f15d488-f59b-4910-85d5-48796780ab3b	sorvegliare la macchina che tratta la fibra di vetro
0f196377-ea78-4e8d-bffb-eb7b4ca5b94d	preparare i NOTAM per i piloti
0f1c999f-9a70-44d2-888a-11b5b838a974	occuparsi degli ospiti con bisogni speciali
0f207b64-51eb-4ff3-87a2-f003102db02f	utilizzare i modelli informatici specializzati per le previsioni meteo
0f2588ee-ee28-4c30-85a9-367e4c30d617	attività promozionali
0f20702f-a537-40f7-a48d-77c7944eb2b0	etiopatia
0f25bcde-81b1-4b61-a301-d40b6a0dc7bd	oggetto di coaching
0f26ea28-dcae-4a55-afa9-9932ce622253	ispezionare i cereali non trattati per accertare la presenza di insetti
0f28b285-4804-49c8-b288-61c4f6317afe	leggere le sceneggiature
0f2ea416-b847-4d9f-8d7c-f5c22622d6cc	seguire gli allenamenti di clienti in condizioni di salute controllate
0f38ef3b-17c8-446d-a8b6-a603236d0105	tenere i contatti tra il cliente e i vari servizi di trasporto
0f3aa6a9-9720-4b87-9e4e-0f8af77d24e0	assemblare componenti elettrici
0f3931b8-f857-41a1-b621-a036f302089d	gestire i clienti difficili
0f3dd6fe-8297-4a7b-a81e-f6537a0d43bf	partecipare a riunioni
0f42c2a0-df20-49f0-bc08-464c45cdb36a	proprietà funzionali degli alimenti
0f51dcb4-d484-42c3-b5d1-f8c955d5e468	liberare i siti di perforazione
0f5834ff-dd74-4193-a5e8-c924c828c2c5	concludere gli accordi commerciali
0f64cbed-9114-4959-87d8-98678f9c8582	effettuare la manutenzione degli impianti di acquacoltura ubicati in acqua
0f5998b6-679c-444a-9bfb-dfaa9dd364de	gestire i sistemi software per la gestione delle richieste e la pianificazione
0f6f8965-5af6-46fb-b0a5-5faa1653eec2	regolare le lastre di vetro
0f624dd0-826e-438d-ad4c-34e430dcc363	utilizzare strumenti di back-up e di recupero
0f6201da-501d-4940-8e27-ec3d2a7cc380	analizzare le tendenze di acquisto dei consumatori
0f7495aa-dd0f-40cb-b74c-e4bc83954e44	decorare strumenti musicali
0f7f0433-b313-40a3-8560-4599b7ec1cc4	partecipare ai test di gioco
0f6f8c12-95ed-4e58-b26c-6d4956dce4df	vendere orologi
0f8577f0-513e-44ce-bab2-bf5cf2409ded	monitorare gli istituti di credito
0f97095b-29e9-4bbc-bb61-dab7181cf9bb	contribuire al processo di riflessione del programmatore
0f9a55b9-fe06-40da-b14c-d058a18e6572	gestione delle cartelle cliniche
0f9c0fb6-18db-4cc0-90fd-db1dcde1ab5e	biciclette elettriche
0fac2ec4-19e5-4aa5-98eb-e8daa03fdcf9	organizzare le risorse della biblioteca
0fa36d20-7563-4ce3-af39-218cde99c385	pedagogia
0fb68777-e684-40ce-953f-24fafb41ccf5	rappresentanza del governo
0fba4ea9-873c-4c58-9e1e-32dab3cee634	preparare gli ingredienti chimici
0fbb6ece-9b05-49d1-951f-a52a290d51c9	insegnare i principi della musica
0fccf87e-7205-45c2-a122-52ecb55b106a	costruire cornici per quadri
0fd5e455-83ef-4bd5-8169-4fc4c1503131	smantellare i ponteggi
0fcffc80-7fa3-42bb-a700-739301fc6a1c	sostenere le questioni dei consumatori negli stabilimenti produttivi
0fd64fca-5c82-429a-9460-68b62e0fa1a6	processo di stampa per serigrafia
0fc7e850-bde4-48d4-bf24-ddd76b06c5a8	provvedere alla pulizia del bar
0fe28d83-2af5-42c7-bb0f-2b5aeb0fb0e1	concludere il rapporto psicoterapeutico
0fef9632-05c6-45db-95b6-18ed328b458c	imballare il sapone
0ffc97c3-23ac-4e6f-adf5-693ac078bb19	utilizzare l’apparecchiatura di comando a distanza
0ff33349-3d1a-42b9-8e0a-b76d394fc1bf	eseguire l’avvolgimento dei fili
1001a419-982d-4fc2-968e-874d067842fb	rapporto tra edifici, persone e ambiente
100782fe-1a45-4335-a35d-78bb45493636	collegare le attrezzature alle teste dei pozzi
1010c2b2-3044-4ef3-9324-1d4c9209ee5a	mixare registrazioni a piste multiple
100c3c19-c7e0-4dac-b929-8dbad674e33d	ispezionare lo stadio sportivo
10212e6f-a4b1-471b-8fcf-5c0df91cfdde	trasportare oggetti
10217898-46a9-4f04-b7bd-c609de548d7c	concordare le modalità di riparazione
10120967-988d-489a-8e1f-19a5299c6aee	adattarsi ai cambiamenti nel settore silvicolo
10271e57-dd7d-46ad-98e1-0e3ca6b84794	sviluppare la propria capacità fisica in modo da praticare uno sport ai massimi livelli
102e3644-38a1-4af6-991a-c08271107bbe	ispezione ottica automatica
10336dde-8131-41eb-bfbb-c011eac23a19	tipi di orologio
1018509e-d09c-4c1f-91ef-4100521105a4	valutare i dipendenti
10355c0a-349e-4334-aac9-5a0735128308	approvare i disegni tecnici
10359810-281a-4b72-bc08-04df06344c5f	formare le guide
103c9a5b-22c9-4894-acf3-47e470e10b5e	evacuare le persone dagli immobili
10465b77-773a-4b5e-9976-e6c46afdcc9e	tipi di massaggio
104a9fc3-1b81-450f-9f81-3ec5eb3bebff	dare un seguito alle sovvenzioni assegnate
104c6e4f-c5c1-417e-8742-5d65fa8656a3	vendere la merce di seconda mano
1048968e-beb1-4afd-bafa-1ff5dc4edd93	prevenire i problemi sociali
105e2f71-f53a-4297-9d01-97f2a2023260	rispondere alle richieste di servizio logistico di tutto il mondo
104d1dca-bddc-42d5-ab04-83a259b725df	dimostrare un atteggiamento professionale basato sui principi di Pilates
10629601-016a-4078-97b0-aad53a9a7e46	valutare i piani ambientali a fronte dei costi finanziari
106890d0-1838-43ea-a0ca-db74b58983ea	manovrare pesanti attrezzature mobili da costruzione
106db356-f09f-4734-8008-292dcf44b11f	lessicografia teorica
106ae348-9683-43a5-a938-5d7868b69acf	elaborare politiche di produzione
10703b90-6c51-4fb1-baaa-3a6456a50b5c	effettuare la manutenzione del sistema di sospensione degli artisti
107b1089-ae1d-4b02-b966-1f995dc823ca	trasmettere le informazioni tra un turno e l’altro
109bf302-0d4b-4fab-bdf2-b82f1fb3cbe3	sviluppare programmi di formazione aziendali
1087ad73-94f6-458e-837f-8c6b010d2591	gestire l’interazione tra pozzi
108644b0-e659-44ad-814d-08f31910f74d	installare apparecchiature di comunicazione elettronica
109c21c2-904d-464e-9500-21d117b6f71c	monitorare l’economia nazionale
10d78af4-9288-444e-81b4-2e1b2635c935	aggiungere tecniche di eloquio alla registrazione dei materiali audio
10d768b8-d640-4767-be89-3ae7021c858b	parlare del proprio lavoro in pubblico
10bdc15e-aabe-4130-9743-5336e9de2523	garantire la pulizia dell’area di lavoro
10d7df7c-beec-4f2b-9453-d523ad627918	tariffe internazionali
10d7b7f0-18c0-42a9-8369-a52770994634	prendere decisioni con urgenza
10d852ef-d869-4228-97b8-d163c7eff9c6	testare il trucco
10ddc764-3e54-4598-b0a2-77d129d30afa	scrivere la valutazione dei rischi relativi alla produzione di uno spettacolo
10e877bf-6e5a-4273-8ba5-05c298d7f82a	marketing di rete
10eec393-4cd0-434e-9a99-c7661927737d	indagine di opinione
10e1caa6-e1a9-4a7e-b9f0-3e9784e0e2db	Grovo
10ef7e59-4754-45f9-ae10-8e5ebf3117e4	legislazione sanitaria
10f664c6-4f26-43b8-9b6f-66776578910c	chirurgia vascolare
0eeb7088-4916-425d-b081-f63121182945	fare traduzione a vista
10f25531-62bf-4b5c-b624-799653176e08	migliorare i processi aziendali
110ac15f-2296-4ff8-9984-8883f801e0cd	gestire i saldi di fine stagione
110ae8da-e24e-486e-9e21-48c6ae076a74	trattamento termico
110e3a5a-b42c-4d5d-8817-5466ba7a8cde	adattare livelli di produzione
1110b4a3-13db-4515-a29c-0351a5551b4d	comprendere il curdo parlato
1123eeba-e2a3-45bf-a372-7f95450d6865	utilizzare le pinze manuali
1120b4f4-4b2c-4d5d-a152-d791efcc7ab5	tenere le sedute di gruppo sulla nutrizione
113b091e-75f2-4391-8a53-0140ed76e70f	installare monitor per il controllo dei processi
11314fb2-33dd-4b2d-bf94-b207406dc82a	inserire sacche all’interno dei palloni sportivi
112a3502-6533-4c26-99dc-871556d5b24e	gestire il trasporto di contanti
113bca54-d6e3-4e11-ae03-d352d6be3500	monitorare le operazioni delle macchine per la pulizia
114022d6-395f-468e-b1fc-a733b85c4867	effettuare la manutenzione delle attrezzature per la selvaggina
11556b69-477e-4257-af08-cb5514a64fa0	eseguire processi di carbonatazione
115d3adc-57b3-4923-a5a1-2dc6bfbb97b5	produzione di attrezzature da ufficio
11566f9f-d989-4c59-813e-4102c55c6c80	eseguire i backup
115e45f7-5c04-4eee-8db8-1f1cd9b89f04	comprendere l’italiano scritto
1161eeee-1cc8-43ac-828e-edcc6bb47eeb	eseguire il taglio manuale per le tomaie delle calzature
11624cc3-dbb8-4c95-8052-0461056d3448	trattare i disturbi neurologici
1166807c-2b64-42b9-9c02-e33b88e67f0b	materiali usati per gli stampi
11645181-669e-4df6-89bc-e6e2bee9d804	valutare il valore nutrizionale degli alimenti per animali
11706296-a1cc-4992-b818-5ed7a1d392e2	inserire le cinghie incollate
1173b1c8-7285-4ad7-b169-f9fa481c12ef	gestire l’allevamento di rettili
11584866-9f5d-414c-84af-055909c7ad40	eseguire valutazioni della vulnerabilità della sicurezza
1171607f-b031-440c-b93e-64a1b8dbc4b7	eseguire le previsioni statistiche
116d5a7a-d3e2-4963-b1d9-9af5bdef29a1	conferire con colleghi della biblioteca
1175bf47-253f-4c98-b0f7-c9d3f7749153	stabilire delle regole per la gestione degli oggetti di valore
1178e11d-0a4e-4196-bd62-07136a5c5b8d	armeno
1187ca6a-2134-41c5-b3e7-35264629878b	preparare le indicazioni stradali
11790e6f-da9d-4cec-a3ba-7ab3d02ae12f	convertire le fibre tessili in nastro cardato
118ac2f4-1f4e-4419-bd18-6e9744132e99	raccogliere la posta
0f85f64b-1e5b-4023-a4e7-9536ddc94d63	studi di genere
119507dc-efa9-4d86-8e54-d4f4800b94b6	osservare i regolamenti in materia di materiali banditi
119414b1-6458-4942-8cef-5096766f53f4	sincronizzare il parlato con i movimenti delle labbra
11abc3eb-e9e4-47af-9a66-17f9dff9396a	WebCMS
11add944-c47c-4c2e-af0e-2000cae0a428	venereologia
11a88735-6e37-4a48-bb3f-80619df82965	informare i clienti sulla protezione ambientale
11af3f02-19f6-42cf-8e8e-4851c6829059	caricare i prodotti per la spedizione
11aff1ed-b496-4809-b5a2-cdb6ee31714b	sorvegliare le attrezzature per il trattamento dei rifiuti
11c170f7-7788-4f4b-8ae0-cb62dbf47339	posare i blocchi in pietra
11bec6ef-da9d-4eb9-bb73-f1078c68cb1d	insegnare nell’ambito della formazione complementare
11bfd744-7ed7-478b-860a-0a4c0b3c9a0f	eseguire le procedure specializzate per i suini
11c0fe98-07ae-4bf8-9c94-3ab7446aa804	applicare il processo decisionale clinico alla pratica avanzata
11ba29b1-c35f-4f53-ac13-34d2a1424dc1	elaborare piani per la fornitura dell’acqua
11caa07a-d1a5-4e88-aaf6-01c2af7a92cd	definire le regole firewall
11c95b55-1b13-41ba-be7a-e14b21255216	sistemi di aviazione senza equipaggio
11c706f1-a94c-4ac7-a71e-11f044478737	interagire verbalmente in danese
11e25024-7d57-422d-9acd-378d77068747	movimenti di raspatura
11e64c99-8ddf-46c4-aa59-9ac9ede8f8a5	sorvegliare il funzionamento delle apparecchiature
11cc1234-350a-4c1d-ba03-9d570e75684b	leggere i manoscritti
120cf15d-8b8d-4760-9905-04745d1e4911	applicare le procedure per garantire che il carico sia conforme alle normative doganali
11f27d3a-f683-4498-9f81-dfa4863c11d4	effettuare la manutenzione dei set del teatro
1208ecc9-e0a5-4749-aa02-00ab1d03106f	utilizzare le tecniche di piegatura del metallo
1205c945-4a98-4c34-84c6-3274712f18fc	linguaggio di interrogazione resource description framework
120eba7f-011e-464e-8dc9-93ccc2dabe9f	riferire al capo squadra
11f87807-2774-4342-b31f-de388e44d6a6	innovare nel settore TIC
1219930e-e728-4075-8386-de77510e1681	inviare i campioni biologici al laboratorio
121b85af-a0cf-4b6e-99eb-c3c1b7999b91	controllare i flussi di vapore
12154a0a-583c-4563-aa8a-f05afd26a391	applicare uno strato di copertura ai prodotti alimentari
1217b6d4-2029-4c90-98d1-0f253c683045	appurare le necessità relative alle attrezzature
121fe698-a4b6-4a60-953e-a435d61191ec	assemblare microelettronica
12288718-63bf-437b-b5a6-4674050704fe	acquistare i veicoli da vendere nella concessionaria
122f642c-2f2f-4dcf-935c-9f5e95350493	fornire documentazione per l’utente
123693c9-bcff-49bd-8de6-fc4958129433	archeologia
12237e3c-1086-4e80-be90-39872b59076f	seguire le istruzioni di manovra ferroviaria
12308b8b-3824-4a09-8089-52e40059e068	controllare la salute dei fruitori dei servizi
12375ac9-153a-4927-9666-19207827dee9	gestione delle acque piovane
123f6023-6b4f-46c2-8dd1-69220af85b85	effettuare la manutenzione della spazzatrice stradale
124ab271-7877-4d9b-b3d7-aaac0aaf4ceb	metodi di produzione di prodotti da forno
124bb14a-767d-470e-a91e-6ae4aa4bdc58	salute e sicurezza sul posto di lavoro
1255999b-d5bf-4733-ba29-aef69e224ff4	eseguire le simulazioni
125ba13a-7b48-4e08-8346-df0df3127e87	azionare le spazzatrici stradali meccaniche
123b6425-f572-47e6-b5c1-b9b1fe74b89a	misurare il tempo di lavoro impiegato nella produzione di calzature e prodotti di pelletteria
125d6858-c64a-4105-82dc-acc08c01b8f4	manipolare gli elementi scenici durante le prove
12621bee-9add-4c24-bf21-cd556ab794ef	pratiche culturali di macellazione animale
125ee97e-f0d5-4029-9772-8f01f7e3c2b9	tecnica below the line
12702d76-0907-4d43-97f8-58cb2948b9fd	propagare le piante
127ed4c0-dc4c-40ba-a1c3-2506eabc9dbc	garantire la sicurezza degli spettatori all’ingresso e all’uscita
126d31dd-0725-488b-9784-0487d288db8a	proporre le sequenze musicali
1286a2c7-61e8-470e-96ac-4e534e2de373	preparare i pazienti per le procedure di diagnostica per immagini
12893fe9-85a2-4bd9-9d06-c5cce915204c	testare gli apparecchi dentali per accertarne la conformità
1283ee0f-5523-4e89-b00d-a65902db50e4	assistere nella ricerca scientifica
128a01cf-84e9-4283-b32f-d4d3b2a2919b	effettuare la manutenzione delle apparecchiature di rimozione della neve
128a77bc-0633-496d-9704-09c78441862c	tenersi aggiornati sulle tendenze del settore del design
128d601b-745e-4496-9fe9-4f2432de8f54	testimoniare nel corso di udienze
129745c3-65f7-4864-8eb2-1b04720561ad	monitorare i macchinari pesanti
12a8136f-2e1c-4907-bff3-48fd8ac0d727	radar di sorveglianza
12ae0823-b2e3-4ce1-91b5-0703213aef21	creare strategie di apprendimento legate al sito culturale
129af9b5-75ab-4a4f-a4f9-cd0b85353df7	tenere le relazioni con i genitori dei minori
12b77f3e-3831-49c6-aafc-f5658e71e987	tipi di impianti di stoccaggio
12b5a9c3-a89f-4364-9747-b391de9df469	utilizzare software di presentazione
12b79d89-c4e3-4405-ad2f-524dfab970d3	garantire la farmacovigilanza
12bfcdb8-6951-4c66-abfd-5d4804a8e8aa	gestire l’approvazione di un sistema installato
12b8c9c3-5b71-4288-845b-d5cea7ca5254	preparare la macchina per la stampa offset
12c244c7-4971-4650-91c5-b0adb9482111	comprendere lo spagnolo scritto
12c2ad26-d630-401a-b3b7-a6025daa31ca	studiare le tecniche artistiche
12bf7f7e-3f5d-44c2-8d9a-f6e16672aed8	offrire consulenza a clienti sulle possibilità tecniche
12c4bab7-1ecc-4481-a404-301192648d9f	elaborare le tattiche militari
12c343fa-8377-4fb5-bbe8-5969fca7d281	insegnare a scrivere
12c70eb6-4944-4874-b17d-f653a10084f8	effettuare indagini riguardanti il traffico di stupefacenti
12ce3344-a0e3-49bd-b1ba-07669b408795	valutare la stabilità delle imbarcazioni
12cbc43f-80fd-4eb2-842c-82d6bb53ccdd	promuovere i diritti dei fruitori dei servizi
12cd7c57-3e1b-4c95-bddc-65d20e46e680	dimostrare diplomazia
12d47b47-054c-48d3-822e-b58f70f76ec7	svolgere le attività di pulizia rituali
12d64654-c510-4252-8c8b-72bd7fc708d3	concentrarsi sul servizio
12d9c39e-ee48-4e25-8738-d3a9e3cb2d19	insegnare i principi della lotta antincendio
12db7d2e-1a16-4895-b3c6-8c14ab7e470f	utilizzare una srotolatrice
12d4528f-384e-403c-b614-72d584d79fba	pulire i tubi delle spillatrici di birra
12d16123-e4f8-44d0-a1b6-8f61589449ef	fornire consulenza sulle strategie di comunicazione
12e6cbab-6223-479a-a011-27971cd07c1a	acquistare le forniture
12ea00ca-80eb-436e-b7de-a2988af6f9b6	diritto internazionale
12e628d3-2461-49f3-9ef4-459610b83292	prevedere le future necessità della rete TIC
1301b316-91b4-4c3b-be99-4b89e2151ab9	ottica
12ec445d-8bc6-434e-b766-4f1cc5dbf3b9	ciclo di vita dello sviluppo di sistemi
130292c9-6840-476f-98dd-dcd72a250fb4	comprendere il georgiano parlato
12f2517a-ac85-438f-ab04-ee9fa6a75f4d	valutare la situazione dei fruitori dei servizi sociali
1317586c-7f4e-4518-a274-d9a45cf76ee4	offrire consulenza sulle strategie di orientamento in aula
13246802-4255-4703-90d7-1f9f452effcd	mescolare foglie di tabacco
131dc19c-3390-4d82-8507-361d9e51bf2b	verificare il grado di assorbimento
131b4f13-d3a0-4b1c-8b94-b7f9cce1c32d	progettare oggetti di scena in miniatura
131e27ae-7e4e-452f-9ff8-936894b98212	sistemi di controllo
1327ae3d-7f8a-47d0-bd96-18666ad47d57	trasformare i disegni in incisioni
133d3ef0-0719-4b89-b92b-66385d01b193	utilizzare attrezzature di incisione
1332cc60-c7eb-4e72-8692-875d7daed691	formare disegni ornamentali
133b8e8e-fb4c-4612-a15c-7b4544e08d14	utilizzare strumenti manuali per la realizzazione di catene
13408673-8125-4fd8-b314-9e2f401c82e6	garantire sicurezza entro l’area di produzione
1339a85b-27ab-4c1f-9f8c-23ab108a2c23	pianificare l’organizzazione dello spazio
1342eb1a-6823-4e14-86b5-28cded63191f	offrire consulenza sull’immagine pubblica
134b70aa-c470-489f-a56d-5b2ebb32648f	gestire il suono dal vivo
13456160-c5c7-474c-a364-f773f38b842e	somministrare i trattamenti ai pesci
134c732d-aa76-485a-8eb6-0cc4040b619e	attrezzature per equitazione
134db0f4-7d8c-48e1-a444-6012b933d6da	intraprendere le procedure per soddisfare i requisiti di volo degli elicotteri
134bc04f-ba5a-482d-b5d9-95f95e98e812	alimentare la macchina
13589992-4f87-42c8-b616-0c4b7b94895f	preparare relazioni tecniche
136a66ef-c662-42d5-a530-66078f9ec567	interagire verbalmente in bosniaco
136d80ed-5ae1-4531-87b2-a90308517b2f	attuare le procedure di miglioramento delle operazioni aeroportuali
136ab705-ef49-4bc8-95ab-e0f41ba3b8da	utilizzare attrezzatura per controlli non distruttivi (CND)
134fa446-b838-4c0c-82b8-eb5157a175bd	tenere i rapporti con i fornitori
137c7989-9e95-4600-a3dd-99874a6cdbc6	utilizzare gru mobili
13848f5d-aba3-4ba5-a66d-2279c5c62e26	finlandese
1384c125-b162-43a2-b2cb-0ec2008f4ffe	collaborare con fornitori specializzati per le operazioni presso i pozzi
13880957-845b-44b2-a4ce-86eac99947d5	applicare le strategie di intervento psicologico
1387ef9e-29b5-474e-a830-3e70ca13ac7f	preparare i materiali promozionali sulla nutrizione
13739496-2995-4fe3-93fa-d7c8957d66a5	garantire il rispetto delle norme ambientali
1384528f-2973-467c-8304-9e11b6fe9fbd	prestare assistenza ai passeggeri con disabilità
1391ea56-2ef6-46a5-a6c7-b53a950b1f79	modificare i calchi del corpo umano creati dal vivo
139402ff-26dc-434a-a365-527b6720e878	preparare schede tecniche sui pozzi
139556e4-1b3b-4e0b-9f7d-a611ff26b6cc	metodi di visualizzazione del tempo
139b7944-dd2e-4fa3-9fec-02b04ce96463	valutare i pazienti in seguito a un intervento chirurgico
13853f43-55bf-40ae-8ec2-46cb96609f6d	implementare un processo di assistenza cliente TIC
13994dc1-9e4d-4d33-9154-4c4004c1b6da	preparare i siti per la semina di erba
13a13add-e80b-4957-b5d9-e19d2d24e001	utilizzare convogliatori vibranti nella produzione alimentare
13c1e445-c7f8-4f13-a62e-397163285773	eseguire i controlli necessari prima di spostare l’aeromobile sulla piazzola
13a7e9be-cdee-4710-8806-15707cd3f6e6	consultare il punteggio sull’affidabilità creditizia
13bfb25a-0bc2-462b-91a9-0f70c336d553	essere addetto a martelli picconatori idraulici
13b56adc-436f-4cab-a015-c3043b21f22b	regolare il traffico
13a2bf5f-ab37-4168-98e6-e5e5bc99b41e	ispezionare la pulizia dell’aeromobile
13cad7b2-6695-4574-b08e-9820d9b39fab	influenza dei venti e delle correnti sulle manovre navali
13c9c023-5593-4e62-ad35-cc9693de22ca	progettazione grafica
13c97e75-23d9-4452-9c11-344298cf7c4b	eseguire le operazioni pre-volo
13c8606a-c14f-4cb0-a7f8-6713b429806e	sloveno
13cff1ed-f047-4737-94e3-0162bdcb4673	lavare la biancheria
13b41634-5d50-455c-a462-fd2f0cf10da4	determinare i programmi di manutenzione delle attrezzature aeroportuali
13d7a858-e967-4b9f-bfed-09f4c5b04d22	sviluppare programmi sanitari per l’acquacoltura
13d3f0dd-b502-4e44-b5d8-5b08c8619789	riproduzione del bestiame
13db4490-10ac-4e0e-93c9-329f624da56a	piantare le piante verdi
13dc30d7-851d-454d-950f-b6a21be9ba3b	installare le prese elettriche
13df0203-0617-4c2e-b668-cf3f3250817d	gestire il controllo degli ostacoli
13e944b3-82f2-46a7-88bb-8d24ebec242d	energia nucleare
13f8052f-7ad9-4411-b0e5-067a253026a9	elaborare materiale informativo turistico
13ed27d3-6048-4cc1-ae48-c9c37af11ff6	italiano
13db7654-6280-431a-b5d1-9284432de79f	fornire assistenza per le procedure veterinarie di diagnostica per immagini
13dc7bc3-e5e3-4dcf-97d7-d50a96785734	rimuovere pezzi non adeguati
140283d1-69e0-4f43-abde-817fab00d6ff	algoritmi
14070435-3ccf-4d27-9478-66050e7c311d	prodotti termali
141c3693-4714-49f4-b817-c9202a875b2f	gas combustibile
14135ac7-472a-41fa-9581-34b73f25f7cc	comprendere l’ucraino scritto
141cd129-6caa-492a-a4d8-a041f203593f	togliere gli ormeggi delle navi
1424fb00-4a0f-45c6-8a25-90aca329509d	calcolare le commissioni
14081243-39aa-48b8-9e79-97d4946e16a3	selezionare gli oggetti per il prestito
1429b7d2-787b-480d-b1ee-ed4d904babc5	rispettare le norme di sicurezza durante le guardie in macchina
14342250-9ea7-4eb1-8535-65c77669fdbf	misurare le temperature nel serbatoio del petrolio
14280439-5815-43f3-b1cf-c6b9896d8bbd	calcolare il quantitativo di materiale necessario per l’opera edile
1435fd11-6817-4dca-af8a-04eace583a35	sviluppare le attività educative
14399665-dbc8-42af-9b0b-89567f6c8a81	utilizzare un sistema di controllo dei movimenti sul palco
14491261-fb70-46e1-ba39-06e0452f0961	informare in merito ai rifiuti pericolosi
144383eb-c20d-4ccf-91d9-a53c740da666	tarare apparecchiatura di laboratorio
14366a7f-9038-406a-b8d4-0125aa46548a	fornire informazioni sulle opzioni di permuta
1454e561-9166-4e3d-98aa-de28a5f9f688	azionare il cannello per ossitaglio
14531e99-f115-407d-8a9e-e3d7ddfd97f7	architettura dell’informazione
1443b855-446d-4651-bf45-37b1e590de1f	intrattenere relazioni pubbliche
14597dac-b622-4d65-86ff-ce494b36dcc2	mantenere un inventario della foresta
146219cc-e484-4d4c-81f0-42a42c2b5743	ispezionare le costruzioni offshore
143e52cb-d479-4853-b493-cca5d12784e0	valutare il comportamento animale
146121a3-2811-4a47-a62d-57dc877ea615	reclutare un rappresentante degli studenti
146687e1-df72-42a3-b145-fd30eeb164e4	nuovi veicoli sul mercato
1471aad1-781c-4637-9786-4c930c72f91b	offrire consulenza sull’inquinamento da nitrati
14717826-3255-437f-b07a-65b70557c030	Tedesco
144e1e16-5282-478c-9b10-6c0b5e711c53	convalidare le materie prime utilizzando attrezzature appropriate
146f8145-2aab-4628-b9ad-a18aa0792a09	prevenire l’inquinamento marino
14972aa6-3685-4d86-a96c-b415661fcc4d	manutenere orologi
147c0cdd-1f75-48b6-9078-f6f099ee4b2d	gestire i rifiuti dell’impianto di estrazione
148d40dd-85f1-43ee-b217-f1aaf24bf88d	rispettare le procedure in materia di salute e sicurezza nell’edilizia
14a3d040-53cb-42c6-944d-831690f9318a	verificare la conformità degli impianti degli edifici
14991159-0054-4f7f-b903-e113fb215b0c	eseguire ricerche sugli utenti del sito web
14a75bbd-deba-4cd4-9fba-10c761c8c9c8	tecniche vocali
14a94949-d7b5-42ab-9746-c75bfa916902	utilizzare le apparecchiature di comunicazione
149d3c3a-84a7-4cbf-8ee2-11f458a4a380	organizzare i pacchetti di lavoro sociale
14c7bddd-0d1d-4892-a01a-22b3d41113be	fabbricazione di materassi
14b9974e-0a17-448c-bd77-c1be04110de5	prelevare i campioni di sangue
14c3655b-6b8d-48f9-893a-1efcfa858449	adattare una sceneggiatura
14b4353d-bccf-4d40-9859-f808fbce10f7	valutare la qualità dei servizi
14d155ec-70c3-4a50-99b8-02927e568408	critica delle fonti
14d93a9f-e109-4c8f-b405-1432ac767364	usare macchine per la produzione tessile
14cdd3ee-cf48-4d3d-9d29-6a7119e447cb	monitorare la pianificazione dello spazio aereo
14db9731-e770-459b-a229-d8ebea4b0f2c	assegnare le chiavi
14ed17f3-1a70-4cb8-8cfe-eb351d338752	usare la programmazione concorrente
14decf2d-275a-4b12-b851-4449970a2b4e	gestire i servizi degli immobili
14e44132-0256-407f-8693-74a96980d616	spagnolo
14b5f998-3c21-4ef2-ae49-e2d2f6704763	pianificare la sostituzione dei veicoli
14ef171b-199a-42c8-83a8-86c49e26ca1c	individuare le nuove opportunità di riciclaggio dei rifiuti
14e15a4f-899a-4cf0-855b-1f2096b5d18f	decontaminare gli interni di un’ambulanza
14f4ba47-bafa-4d2e-9b2d-b2108f2a3be7	eseguire le operazioni di classificazione dei pesci
14ea2d2c-567b-43b2-90aa-7c6298741bd6	applicare strategie di insegnamento
14fd4f5f-980b-4763-9291-32824b5a2ed5	gestire le situazioni di assistenza in casi di emergenza
14ff88dd-c9c8-4bbd-86c7-24cc8308a235	adoperarsi per l’inclusione sociale
14fc93b2-74f5-44f5-b538-c401a501001e	monitorare le procedure di fatturazione
150a640a-aa61-4c01-882c-317983c3354c	testare l’alcalinità
1501eedb-7513-44b1-a048-9e9a388b05d3	utilizzare macchine per il taglio delle fustelle
151513cd-3e21-4197-bac1-ada75e55942d	azionare la smussatrice
15247b4c-c969-4d69-806c-304f95e251bc	sardo
151d147f-69a4-4e3e-a5a2-0aa1305462a3	utilizzare le tecniche di depilazione
15289b39-8ace-4006-901b-3ad7c7bf97e5	parti di macchina saldatrice a fascio elettronico
15181eaf-a87a-4784-9f62-a2734ce2d3f2	stuccare il pavimento
152ca525-32f6-478a-8159-b08d86bd9d13	impatto dei cambiamenti climatici
152b4457-d761-46db-9341-fe14a43d5ada	offrire consulenza ai clienti sulle restrizioni alle esportazioni
152ea734-4f28-48f6-9372-9327ef0ca08d	frenatura della locomotiva
14ef71c0-8bc3-4c2b-a3d5-c97154c97350	comunicare in merito all’impatto ambientale delle attività minerarie
153115f7-78fd-42b7-894f-b426cbe833f5	registrare i dati del trasmettitore
15320d36-68eb-4a4e-8c7d-15e14278b81d	assemblare macchine fotografiche
1536c7d2-f488-47bf-aeba-b4ec317d0c3d	promuovere un’immagine positiva dell’assistenza infermieristica
1537f6cd-6008-4255-862d-391aa2b6c413	scrivere in italiano
15393cf4-bec1-4097-9fd0-7a66324391e2	programmare un’unità di controllo per ascensori
152c8945-bacd-476b-9f80-045ad12b9f4f	controllare la qualità dei prodotti lungo la linea di produzione
154a080b-9073-44d9-8e9b-f593895996ee	distinguere i tessuti
15504df1-65e9-490a-8f13-2d33ed06a996	classificare le foglie di tabacco
153d48e7-e84b-4223-8ade-fce91570925f	rispettare i requisiti normativi sui cosmetici
154eb443-d9a0-4cff-a893-7ee324d36cc2	interpretare gli alberi genealogici
1550c730-1466-4841-88bf-cd2f35505246	cambiare le etichette degli scaffali
1543fbb9-5c77-4bfd-a0ba-1329a9dbe4d7	valutare la qualità dell’arte
155af13c-e4bb-4f1d-b4ed-5a00122c7f48	tutelare la vita privata dei fruitori dei servizi
155de353-7338-434a-bfcb-8f56b1d6f12f	utilizzare i macchinari di avvolgimento di tubi isolanti
155ea5c1-e148-4844-91c9-9cc7b59f3dcf	configurare una registrazione di base
155d1bdd-6ef4-4c07-b79a-8b094e7a6dc7	guidare le persone verso le aree di attesa
156ee607-5d3d-40c2-9f20-33d231b41d71	insegnare le lingue
156f3300-d6e7-484f-b579-dcfcad7b62d0	attuare un piano di marketing per le calzature
1592b796-c760-4737-a4f6-7254823b81d6	processi di controllo del credito
15a48b99-dfd4-4a47-a387-e96848161d8d	tecniche di piegatura dei metalli
158b6e39-6715-46ec-9704-b92c8403ed85	offrire consulenza ai proprietari di cavalli sui requisiti di mascalcia
1585eaa7-97aa-4de4-b496-2fbbe757dc2a	VBScript
15ab0ce5-4a8d-44c4-8218-fa532a9d013c	misurare gli alberi
15aebc14-5972-4448-9b62-659f3d1e9fec	utilizzare utensili di tornitura
15ac2e96-4147-43ca-95ad-631d2f8af4d2	applicare i metodi di conclusione delle sessioni di musicoterapia
15a50637-17e2-415d-a027-85b13ec0b4ba	agire da mentore per i singoli dipendenti
15af26a5-3dcb-42c5-b963-8a3d0e627709	precisione di tiro
15c1cc56-6f2f-4301-bcac-e6a400a079a0	controllare l’apparecchiatura dei tavoli
15b0d5ba-40d8-45d7-b099-b0ef7f66aeb4	mantenere un inventario delle parti delle giostre
15c1457f-fa8a-4250-b5b1-c27118c449f9	principi generali di legislazione alimentare
15b0c686-3180-4460-b8c4-c903fbd61504	informare sui malfunzionamenti dei servizi igienici
15ddae06-efd3-4ba3-b2e7-951681e444b7	predisporre l’infrastruttura temporanea per cantieri
15deba15-61c3-4759-820d-054eadb13a9f	preparare i prodotti a base di carne per la spedizione
15e635fd-c0c0-4a6d-b40b-2a85b43858a4	gestire le garanzie del materiale digitale
15eb13c2-a272-4056-aa42-bf44b354a49a	utilizzare i software di previsione delle vendite
15e8fd40-bf0b-4d6b-a067-219eb8e61d4a	polacco
15fbce2b-0ff4-4565-8714-5769c4de7267	prestiti alle imprese
15e48f28-08b8-44fc-86e8-7139c6393c5e	pulire componenti ottici
160987df-77f5-43f2-b9d0-ad829395ab11	educare il pubblico in materia di fauna selvatica
15de1d5f-24ed-4433-abe0-9be375a5332f	coordinare le attività di costruzione
161aadcc-b9ef-4ab6-b682-9cf2a7de8827	manipolare lo sperma congelato
160d1a6c-4467-4f0d-b752-25e18e93d011	regole dei giochi da casinò
160e10c0-5982-42c0-a522-9382bfdd6a02	rischi associati ai pericoli fisici, chimici e biologici rappresentati da alimenti e bevande
161b0689-51e5-42e7-b386-34c9eafd60de	effettuare una valutazione della fisioterapia
161ccc5b-606d-4208-975d-0568e43bb94c	acquisizione di sostanze chimiche per la colorazione
16226207-1359-4220-adff-7155105bbd17	aviazione militare
1624cfb8-65d9-4990-856e-38b3af574efc	biologia
1624ea3d-c81b-458f-8374-734fc05bd71d	fornire elettricità
16038789-6a0b-49b5-8076-c087e7445af3	gestire i bilanci
1629c4d7-cc00-45ce-804d-8a7b1cf303e9	assemblare giocattoli
1620e07e-a523-42cc-901b-2f9ab03e0bc4	stimare la quantità di vernice
162a0336-8497-4c79-a432-678e7075eba1	gravidanza
1643c9a9-840b-408c-8d4d-e0cd4c56b9c6	uve da essiccare
162ad6d7-c884-4dca-a3bd-e4b24a77249b	cabine di manovra
16563a8f-be7f-4e92-9e57-3331558fa786	attuare i piani di emergenza per le fuoriuscite di pesci
16641481-ce31-4676-b262-560dc937951b	fornire servizi di trasporto privato
167499c9-083f-4632-8376-7d6b25b3b58a	disturbi della comunicazione
1677169a-bb63-4219-9310-9b0212315662	svolgere indagini interne
16382951-5082-4306-b463-54a8075ccacf	fornire consulenza infermieristica sull’assistenza sanitaria
1669e4de-8d36-4c14-98ef-c1b0c5446e56	sorvegliare i centri di riciclaggio
1664a31c-3799-472b-8e7b-d59a10a6372f	fornire il primo soccorso agli animali
1683ac57-aa1f-4117-b0f1-e5c2b82acd13	tenersi aggiornati sulle innovazioni diagnostiche
167e94b6-ae35-4b3b-a2d6-3e8f9c9bf5ee	informare gli assistiti sulla nutrizione
1688f83c-1d0d-40f3-bec0-3d5ebedc2966	influenza del trattamento adiuvante in radioterapia
1684746d-3861-4151-b7b4-c4f22cc62cf5	sviluppare le politiche in materia di concorrenza
1688ea4b-b9fa-4777-a313-c6c1782dee90	comunicare i requisiti dell’imbarcazione
168ca32b-4d46-46db-bc44-49ec21b289a8	adottare le misure necessarie per ripristinare le superfici pavimentate negli aeroporti
169052e7-b232-41bd-bcc4-e650c2ac2e73	rifornire gli scaffali
169f1037-6b4e-45b4-8a0e-b183e741be4c	prodotti di legno
1693dcc4-3693-4b16-ad18-b6295f80b59b	letteratura
169c9238-57c3-41dc-bb1e-165825ad2755	comporre una scaletta musicale
16928c90-4943-4949-8685-de7ed363eae4	mantenere la disciplina degli studenti
16ad3a5a-613e-4ce3-b5ee-da1ed34f600b	teoria del lavoro sociale
16b2b856-405b-417d-91f2-408cf1cec3fb	progettare il piano di conclusione della musicoterapia
16b40eb2-b615-4377-8140-92e3f1da2602	applicare tecniche ingegneristiche di convalida
16b788ed-24e3-4fba-8e68-1d0eb2092d5a	misurare la densità dei liquidi
16b79eb6-d42e-4d01-96f7-0b6fc6b3527b	condensare le informazioni
16aeb26a-e52a-4e97-9816-22da3466cf44	contribuire alle decisioni strategiche sanitarie di alto livello
16b9374c-666b-41f3-9177-83390dc25a8b	tecniche della progettazione ferroviaria
16baec23-add4-45eb-8ff0-252211ca9811	fissaggio tramite funi
16c489a1-5f8d-48f8-964c-7216d4aaaaf6	montare pendoli
16cffcd2-be98-44f9-9b42-e737b3303126	Android (sistemi operativi per dispositivi mobili)
16cf1fbf-e25f-4397-8d6f-90006a2da811	contribuire alla continuità dell’assistenza sanitaria
16c85b9e-0290-440d-8d46-1a661523fa28	fornire formazione tecnica
16dc8ff2-cf8b-4429-93a8-00b7b064b163	utilizzare gli impianti di riscaldamento dell’acquacoltura
16dc1c1f-4c7b-4d34-b92c-58ae95009b66	eseguire l’analisi commerciale
16e76335-c166-4e24-9682-9a0fc6a9a307	rivedere i questionari
16db79e9-73e9-4ea3-abd7-03336d481123	sviluppare il linguaggio coreografico proposto
16ea62bc-fad7-477c-9109-434b4a1456f3	cure palliative
16eaf902-c8a3-41e8-8fab-276522c13ffe	verificare la conformità alle politiche del governo
16e97eb1-5fa9-46be-aaab-76840452d8a1	garantire l’uniformità dello stampo
16eda0b8-79da-4803-900a-3bbb3f8c2d12	manutenere i meccanismi di guida del veicolo
16f5a5ec-c6e1-4b1d-987e-2e9a4e3c27c8	collaborare alla formulazione delle politiche
16f9d5ca-924d-4448-b76e-29e48a372672	sviluppare le strategie per le relazioni pubbliche
16ffca9e-cec3-49cb-bc1c-1db0ae23f6e3	casi di emergenza
1713b759-ae42-49ba-8f28-774c31b48270	tecniche di chiromanzia
1731305a-b7f5-4307-8f09-bca3210494e6	lavorare con il team di produzione video e cinematografica
16f4077a-265a-4b8c-b728-e82232390f62	osservare le riprese
1724b989-7792-469f-b45f-cb5803632b39	presentare offerte commerciali per riparazioni o manutenzione
17379b20-bf20-4090-868c-be4e4e0495bf	contribuire a proteggere le persone da eventuali danni
173a568e-e827-4ace-a690-31c01bba33ae	stampa su macchine di larghe dimensioni
173e4901-c374-416a-9908-9ff6f088c0b4	comprendere lo sloveno scritto
1737c210-b982-47d4-93d2-1e5c5fe07205	redigere le relazioni di produzione
1734bb3b-a448-4d2d-93e2-252cc236935c	valutare l’immersione con la squadra di immersione
1745fcaf-f9e5-4782-8b39-b845fa786281	applicare le procedure dell’aeronautica militare
1740484a-29b4-474c-af94-df93406e9ba1	obiettivi curricolari
174907ee-36a6-47bd-b3c5-83c849e2e07e	gestire gli animali per la raccolta dello sperma
1749a82a-8908-441d-8169-e97a4cb9387f	reagire rapidamente ad imprevisti
174d4161-c384-431c-b37a-9d0a007404df	prestare soccorso negli incidenti stradali
174fa3d9-66c6-4c2d-aba4-3cf5f8ac4d91	definire l’identità del marchio
17514f61-e444-497c-99e8-bb9ba114e5c2	effettuare le prenotazioni
17555ed8-8cc9-4819-9ae7-2598b982fa18	garantire che le operazioni di immersione rispettino il piano previsto
1756a855-f37b-4e28-b39b-d42ef2818dd9	raccogliere le informazioni sull’imballaggio della spedizione
175f5054-a17b-4377-99b3-420374606ec3	conservazione della scena del crimine
17604dd7-5687-4a74-8397-65f7948dd583	coordinare i passeggeri
175831ef-00ba-4d3a-a2aa-913fad032df2	impiegare le lingue straniere nell’erogazione delle cure
1763f27d-8f1a-4c67-a243-bf5c1b6e082c	impegnarsi nella ricerca fisioterapica
1763d23a-fb67-43a1-8dc2-32c5b0196336	installare l’arredo urbano pubblicitario
17658bc6-389b-47f5-a994-41e7c008e315	gestire la produzione di fluidi nell’ambito della produzione di petrolio
1775651f-9168-45b4-b907-06bec2af6700	coordinare gli ordini provenienti da vari fornitori
1771f8cc-7feb-4a3d-a4cb-d8abd69f360b	sviluppare gli standard di informazione
176c2edc-1688-4181-8831-58d5fcd5c645	gestire la pressione delle scadenze di produzione
177b4566-f7e9-42ca-91f1-ab8ee33e3b55	processo di fermentazione delle bevande
1774cf10-9bba-42b5-852a-e2c2ba7fa5ba	stabilire relazioni commerciali
177e35f4-2434-425b-9e46-07a66f27ddc0	gestire le rocce sterili
17834038-9c7d-4d61-a8f9-528207dfc622	reumatologia
178a8eca-33d7-42e7-a7a6-d9fa25e50b00	stimare con precisione le ore di lavoro
179167ef-4f9e-472f-aae7-6fcde551449f	controllare gli ingredienti in polvere
1793bb32-87d8-4609-bd09-336cb8e0d747	sviluppare il catalogo dei prodotti
178e2def-7333-4345-8e48-612c4871ed11	rispettare i principi di autodifesa
17918077-e34a-4693-93e8-d18e145be80e	ingegneria optomeccanica
17a669a4-76fa-4758-ae89-eb304979d19d	tecniche letterarie
17bd90d7-c99a-40ec-ab6c-9ba2d58697ee	rischi di cancro
17c5b985-f50d-44fc-9961-44b1baa5bbbf	eseguire le indagini sul credito
17b3be31-bdfb-4403-b371-17145d664987	riconoscere la reazione dei pazienti alla terapia
17d612bc-ed4d-42bb-85be-34813af0d16e	teoria degli insiemi
17bc5669-1e42-4060-81a3-11698108c850	configurare le attrezzature fotografiche
17dd9c24-c06c-4a50-91ab-615786947406	occuparsi di macchine burattatrici
17eb2e7c-6472-48cf-a6cb-c5713249d8b0	psicologia dell’emergenza
17f61473-1a43-42e9-937c-a20d9166adcd	installare le pompe di calore
18025ac7-4c5b-4bf3-ad6d-26f36ed5bf23	eseguire i test per rilevare sostanze illecite
17f9a17a-e988-4b06-bc1d-59e0634b5e2a	dirigere solisti ospiti
1814116d-2d9a-4605-bc57-a056d162705d	sistemi di allarme
180ec4e9-17f5-4806-9093-64fd0f71841c	utilizzare le attrezzature per le procedure di venipuntura
180cb855-d357-4129-9a59-4d545b7d9380	scrivere in urdu
180c7fee-d445-4195-b7b6-7215430af50f	tipi di invalidità
18170a42-293f-4b32-953f-2b0917214c78	reperire il numero di un giornale, di una rivista
18163721-b32d-46cd-a84d-abbeadd650e6	essere addetto alle ventole dei macchinari
181f4df4-efef-4426-97b2-1625d2cc42c4	tipi di percussioni
1830af9b-a651-4224-970e-ecdc6df8398a	fabbricare cinghie
182ca6c3-1880-437e-bf79-8f912be8a883	fornire assistenza per la ricomposizione del corpo dopo l’autopsia
18254547-3af4-4a0a-b1f0-83195d2ae18c	avviare il contatto con gli acquirenti
181f75c7-6dd7-4df7-a7f3-281e1386a886	fare circolare le informazioni
183e4420-f533-4f69-a3fa-c1770f62fbd2	partecipare in qualità di osservatore a diversi tipi di audit nel settore alimentare
183301a2-0a9f-4b2d-991a-dcb066e4f798	MarkLogic
18391c8b-3045-41a9-90a7-30e8f76895d8	offrire consulenza sul miglioramento della qualità del vino
1840f66a-1e91-45d8-ad69-c2043550e091	tipi di cioccolato
18567411-3d84-4d50-86b5-445a52be785a	elaborare teorie di criminologia
184fd301-8f1b-48db-a487-31dd31c4616d	mantenere i rapporti con gli istituti di benessere degli animali
1868c4c3-0af0-4ce7-8d67-218d47552037	misure fitosanitarie
1858276f-2218-4109-addb-83a0065654a3	preparare gli strati di gomma
1869574a-a868-4d68-a2e6-412e265e09b4	pianificare le attività di manutenzione
186ad3a4-9ee6-41de-8478-c8399eb942c6	limitare l’accesso alla scena del crimine
186f1735-f5bb-4c9b-b9a3-03596a0f914b	riscuotere i danni
18773c95-1a83-487e-a262-9dc1e8e29f6d	chimica farmaceutica
1871fa75-9f7e-4ef9-b509-d1c88a8fde00	misurare caratteristiche elettriche
186f433d-6e8f-4eae-a07b-48e0e2e2bbe0	scrivere le relazioni di routine
188716cd-ad81-4824-84b4-f041214c0869	intraprendere le procedure per soddisfare i requisiti di volo degli aeromobili
188ec8a5-bbc3-4eea-be50-881d2d772f6d	mettere in pratica i principi derivanti dalla conoscenza del comportamento umano
18850275-9268-4cee-9a16-cbe8c135471e	individuare il rischio di inondazioni
188fc69a-3559-4a14-98ad-921ed1148eba	fornire la tutela alle persone
189b44ab-2edd-47d3-877b-13990b166366	pesare gli animali per la produzione alimentare
189de05f-d826-458d-98bd-764ab953fc25	rilasciare certificati per prodotti di origine animale
1891841a-2a83-410c-815e-ff0998e5f8db	smaltire i rifiuti di origine medica
18ab5bf6-e82b-46f8-a62f-38ffce6263bf	elaborazione di contenuti digitali
18a521b8-5d72-4f63-8cfd-50396883d8ec	manipolare le sostanze chimiche per l’incisione
18a9b088-2697-4e93-b17d-e013c61a81fb	navigare sulle vie navigabili interne europee
18afbe80-ddf6-4d8c-be2d-6750e50245b7	rilevatore di irregolarità delle ruote (wheel impact load detector)
18cb0f37-5116-416b-bbe4-36889e19b054	scrivere in latino
18cc97b4-a3d5-43bf-a89d-5f8372c4234c	sorvegliare i lavori di manutenzione
18cd6c16-a557-4bc1-bad0-776f295188a4	utilizzare le lingue straniere per effettuare ricerca sanitaria
18d11941-2459-4dbd-b10b-a7a6e6812079	norme di produzione del gelato
18e764b8-4061-4c4c-9f0f-02cc1d59e0e2	gestione del marketing
1744aa05-3e3b-42ae-bc6a-5292112e3da3	effettuare la manutenzione delle attrezzature di incisione
18fb977c-bed8-4ead-a288-81706f97cdf5	utilizzare apparecchiature di macellazione
18eaa49b-301f-49fd-9120-e844cd3b2d5a	comunicare con gli hotel le compagnie di autobus e i ristoranti
18f74fb0-382d-44ed-a104-4020d0b36bb8	parole chiave in contenuti digitali
18f74d96-3b9e-4e4b-9a37-3974cba30d41	identificare le esigenze e le risposte tecnologiche
19021244-025a-47c2-93cd-8f5a4d79806a	offrire una consulenza sulla responsabilità sociale e su questioni di sostenibilità
190dcace-fd3e-4bed-a391-7d91814530dd	elaborare i dati
191b5d68-1d3b-489d-b921-765956de614c	operare un processo di trattamento termico
1920c0fd-9984-4616-a1ca-67703b6445ff	valutare le esigenze dei visitatori del sito culturale
1921aed3-4d23-4946-a0c1-6083c0952d2c	scrivere in basco
1921e8fc-bc42-4ce9-8555-e21a42bd8c7f	elettroterapia
192c3714-77e1-4296-8653-5f18b136c561	controllare i campioni della produzione di carta
193b32ea-ebd0-48fa-b25a-44c3178d9e94	comprendere l’occitano parlato
193cb62c-941e-4c03-aef7-19991d96e8d8	valutare i programmi trasmessi
19415162-f437-4c62-83ed-035a3d846dfc	partecipare agli eventi
194608fe-ec87-4074-86e7-da1889be291c	manutenere il ponte tubi
177c361c-8e0b-436a-b1f1-fc96b7597625	applicare la gestione delle crisi
1948a043-af93-44bd-9a77-dadfcf08da37	utilizzare la pressa dei proiettili
1949918e-9575-49ce-b212-3b082d3ed39e	organizzare l’immagazzinaggio delle parti
19517db3-953a-4941-987f-04fc92d1b762	educazione sessuale
1952e130-8376-4adc-aa8e-7a6688245970	programmi di aiuti finanziari agli studenti
195274c3-d767-4501-b91c-c4f7a5733baf	strategie di vendita
1957690b-3320-4434-9539-922e02e9e65c	rifinire i giunti in malta
1957c885-e2d6-42f1-b452-99acd09e4000	ispezionare gli scarichi
19567fa4-2ae3-436a-bdc6-754eb221fea8	preparare i giovani all’età adulta
195d6aaa-fa79-4dea-9eb9-c2ccc8b171dc	tipi di potatura
19607a3d-c401-404e-b6df-f7922c8ce49f	essere addetto a macchine per elettroerosione (EDM)
196d6218-0218-4569-bcb1-d12cdf2b4ff1	prendere in considerazione i fattori ambientali nell’assistenza a lungo termine per gli animali
196a7952-7c4d-4ec2-8d2a-9611f49f71bf	utilizzare una macchina per mescolare la pasta di legno
197785d1-deb7-43d8-8698-86a5e2d9d48a	gestire la torre di controllo aeroportuale
1961b3c3-36a5-451b-bd2c-4cf5db121c26	comunicare utilizzando linguaggio non verbale
197e8a6d-bfea-423b-a941-7af67bafc18d	effettuare ricerca sulle tecnologie di telerilevamento
19826475-1d8b-4c36-a0ae-82786363076c	preparare le relazioni di inventario
19853e85-5de3-48cd-8714-d7334aa66da1	Chef (strumenti per la gestione della configurazione software)
1998a64e-9f0f-4744-aa20-7e32c4831943	garantire il raffreddamento delle attrezzature
19783b93-6375-4cb7-b66d-a0ab6c59b124	applicare le norme e i regolamenti aeroportuali
198115e4-767b-4765-9349-cd09d30f6d3b	valutare i progetti di sviluppo della miniera
199c2dbc-70b6-465f-94dc-847a14ea2f4c	fornire la legittimità giuridica per il trasferimento di beni
19b042f1-0268-4215-824c-a9f897c9f55b	comprendere il persiano scritto
19ae2638-79b6-47bf-8168-e9cd4d5becb3	fermare i veicoli che superano i limiti di velocità
198df262-934d-445d-b357-19c62c95a9a3	stimare i costi dell’azienda agricola
19b39827-2267-4838-b608-71c8711ba033	lavorare utilizzando i modelli di comportamento psicologico
19b730fb-dc6a-4ae5-9c9c-4e8eaca0a4ce	mantenere i contatti con i dattilografi
19ba0eb7-954a-4562-96ab-b2b20cf8f934	creare modelli di processi aziendali
19c78bd4-1c30-4b96-a376-3222dbf270ed	servizi di directory
19cdd291-1d78-4c95-806f-70d0ec9c6029	sistemi aziendali TIC
19e2c721-2016-4644-88ef-adc9b1a93090	conoscenza delle specie di selvaggina
19e08bc0-6d8c-44ef-a779-1de6a83996f1	aggiustare lo scivolo di rotolamento
19e62bd2-b5b7-44e8-a95e-6eccdb807a66	aiutare a prevenire l’isolamento sociale
19d043d4-c1dc-4797-a0e5-eb15f3331c56	garantire la sicurezza del database
19e6b947-382c-41e9-8451-976b45910cc3	valutare i programmi di educazione
19f08377-f2be-417f-b137-3ba246067805	scienze della Terra
19e72e3f-c82e-4d6e-bf8e-005c0e5640e5	norme di sicurezza
19f70464-d835-438e-9a31-58bd96c2ac39	caratteristiche del vetro ottico
19f7f014-c1ca-47b2-bc4a-7a69a8f5bee2	definire l’universo visivo della propria creazione
19fe4d4f-be68-4b25-a627-2ee3975de9b3	sistemi di supporto decisionale
1a0e1abc-8526-4e2d-9fc4-552dd063036b	compilare un inventario dettagliato della collezione
1a14e318-c050-4210-8817-8aff574e660a	tradurre concetti linguistici
1a128ce2-463d-4922-96be-d98c1224a784	Xcode
1a1ff965-2f98-4200-8778-d74074229bf6	eseguire gettate di calcestruzzo per fabbricare coperture di celle elettrolitiche
1a214dfb-8a7a-4cb1-b917-d58f79891fef	monitorare la corretta movimentazione del prodotto
1a0e253b-cd4e-46be-af59-cd327cc62880	fornire le informazioni ai passeggeri
1a3134da-64a7-4b4a-bd76-4d0d8d2b9672	predisporre i manicotti e i cappucci per pali
1a3874e0-0847-4b13-a956-be6b47ef3d38	seguire il programma di gestione dell’animale specificato dal cliente
187a7fc2-e491-45b6-8695-74598383744d	coordinare i turni di produzione delle forme
1a490d6c-4c46-42f9-bf66-2d00808ec285	realizzare cordone intrecciato ornamentale
1a4dcf82-37b3-4bf8-ab5c-e0d80db18279	ideare una specifica progettazione d’interni
1a4ef353-54d6-487d-b184-5c53c787af18	riabilitazione su base comunitaria
1a5d92ff-16ad-463e-b4cc-0265004367fb	preparare condimenti per insalate
1a586426-2934-4a58-af9e-d55889358ae5	gestire gli atleti
1a51e7db-f2c4-45db-adf7-fbf0ac137133	azionare le apparecchiature d’imballaggio
1a5173b6-70dd-45bd-96f4-bc30a029ad52	creare oggetti in ceramica a mano
1a93bc81-1a11-4c0d-8499-d866588b6146	costruire sistemi di raccomandazione
1aa0a733-1a34-413e-b665-c75d1cef3b94	esaminare i campioni di cellule al microscopio
1a4e5e7c-7dd4-470e-bd90-5c537dca2e12	analizzare le esigenze di risorse tecniche
1a9c36a0-6d16-4fd5-8fe0-dd1ff5bf53ce	scrivere ricette culinarie
1aa31e33-2eaf-4bd2-826c-fc6768ee411a	storia
1ab5e77c-9886-4a39-9606-cfbfee107192	gestire un’occlusione
1ab7a452-fe98-4131-bdc4-c91da5642901	classificazione europea delle vie navigabili interne
1ad1d6b1-a461-42af-9bcd-567c705c899f	preparare le apparecchiature e le strutture aeronautiche a scopi di addestramento
1aca3b77-b228-4b47-95d9-418ddc8cbf48	selezionare gli elementi di design
1ad2e825-d0f7-4044-b461-40bd8bb897cf	effettuare la manutenzione delle attrezzature meccaniche
1ad642a2-acca-4bb4-acab-a71da1b70f54	formare il personale sulla birra
1adc3838-4ded-461c-ad49-6f4743cdfff6	commentare le bozze
1adcfee9-6404-48de-bad2-515f5a205636	effettuare la manutenzione delle unità di finitura
1ae010d5-693d-4888-9562-15dd78206333	sviluppare codici exploit
1ae7eb28-f983-4b04-8db5-59f0dd0f75b8	essere addetto alle macchine per la produzione lattiero-casearia
1aec4657-4a8d-40a6-863a-47659e44e300	monitorare lo stato di salute dei pesci
1aef7a44-0165-407e-b340-59b666efb86f	riparare cornici per mobili
1af1e92d-dd60-4f42-9706-028de4317106	strumentazione chirurgica
1af84ae4-3284-4145-aa4b-06586dd0fd66	installare climatizzatori
1b01385e-b129-4cd8-9131-e59f18091173	utilizzare attrezzature e strumenti matematici
1b049e7c-1485-4efb-995a-fb96aaa1937a	verniciare le superfici
1b15557b-f860-49fa-bafb-d7ca0cc384bf	addestramento militare
1b17dea0-0bef-4958-9100-0b9b0a430a1c	processo di ammostatura
1afc193b-095b-4fed-adc9-7936bd3df09d	WhiteHat Sentinel
1b1ac648-f809-46c1-8644-85625a24ad6b	normativa sulla sicurezza degli ascensori
19813e47-7712-425e-8002-379c0ee770dd	mantenere i contatti con il personale docente
1b1e73cf-5bc7-454f-a7ec-d4d8ace3220e	effettuare la manutenzione dell’impianto per il trattamento delle acque
1b24f2f5-4920-41a8-8846-5df98d80e9a9	azionare una serie di attrezzature per attività di estrazione sotterranee
1b2679ac-f110-4b6d-af45-6210d3e1687d	assemblare munizioni
1b27663c-dbad-4a1a-8b7d-bb51458216a8	associare la macinatura del caffè alla varietà di caffè
1b2ace52-b2f9-4ff8-99ac-20941d6fa78e	essere addetto a macchine di colorazione di prodotti tessili
1b2fad43-d23f-4697-bcf9-4fcb0859696f	eseguire ricerche bibliografiche
1b30ed51-117c-4431-af0e-1ebbdbada473	riparare gli animali imbalsamati
1b33dfb4-c805-43f7-ac9e-e516b96a7246	preparare gli pneumatici per la vulcanizzazione
1b2f805f-55a0-4aa4-8bb3-2fba5c3abaf4	gestire i piani di evacuazione di emergenza
1b340041-8be9-46e2-b48b-30f0d3d3a1a7	realizzare fori negli stampi
1b35c432-701b-4103-b728-9af4062a1bd1	distribuire le carte
1b43133c-344d-43c5-8953-c9741f0abefd	fotografia radiologica
1b4979ba-5e05-4f53-a2f8-c09562de6045	riempire sacchi
1b4d0e7c-2c48-41f2-aa05-124380b719fb	applicare metodi scientifici
1b4c7864-81f1-4a64-83d1-a93d47cee781	allineare il contenuto alla forma
1b4f1567-efbe-4022-9bdf-676a04ac5683	sviluppare un processo di produzione di opere teatrali
1b4f820a-2b7a-4be8-a872-7268dfb2b7ef	dare segnali di azione durante un’esibizione
1b556e74-db92-4d18-9146-09c561432ae4	sostenere i fruitori dei servizi sociali alla fine della vita
1b65f834-30d0-4e41-9d2b-f552cff59d73	informare i responsabili delle politiche sulle sfide relative alla salute
1b61bcb1-eb87-4de0-b3ce-b3132df82a7f	regolamentazione doganale per i passeggeri
1ab0a9d3-8167-4e60-948e-bd6cb8937842	ordinare forniture elettriche
1b689a7c-4583-4aaf-87d4-9dc6ed0a6da1	riparare la pellicola fotografica
1b6c71b6-9596-420d-b677-c23cf64b2fd4	polimerizzare il pezzo in materiale composito
1ac5ef1b-17b2-4935-9952-332e2c062f00	mantenere l’ordine durante un’udienza in tribunale
1b785cf5-2c06-4805-b677-1a430e29f814	fornire assistenza domestica
1b7b0ac2-b6b7-4cba-a3d7-c76e07854278	fermentazione su scala industriale
1b7e6e62-ca95-4767-b677-dd4af541f44d	documentare i risultati delle analisi
1b7dcb81-620b-4bd5-99da-d40e3f9eb8f1	pianificare gli obiettivi a medio e lungo termine
1b83b697-0d5f-4aa2-bd5f-71a749eef36b	insegnare abilità matematiche di base
1b8583e2-378a-4cab-be1d-b5091cd6cfbf	applicare le procedure di sicurezza in laboratorio
1b8c35b5-6817-4d77-b96b-2de7b99b058a	assemblare le biciclette
1ba1c1da-6b1f-491a-a41b-671fff26f455	utilizzare i macchinari per la silvicoltura
1b453e63-d573-4a6e-be9a-f0797be480b6	interagire con un pubblico
1ba8a55d-3f60-4971-804e-3c3894d98e46	confezionare un costume
1ba8e043-32aa-4840-8b1d-2ff8d434d05f	tenere un catalogo della collezione
1bae1d79-f2f5-4978-9d55-1af41bcd6763	diagnosticare i disturbi del linguaggio
1bafe8b5-80be-4526-b425-15c2deac6ab3	processi dell’ufficio operazioni
1bb4847a-1b70-4555-ac3b-5c342d8fb1be	ispezionare i sistemi di silos
1bb905c4-f678-4316-b4eb-39f794bcc2b6	documentare le operazioni di rilevamento
1bbad476-4cf5-44d7-8ce9-0cf0e9bedf38	ricerche giuridiche
1bcbac81-e7f1-4548-940c-c83239b27b54	etichettare le cinghie
1b77fde0-96f0-45ab-a83a-e034163f25ab	sviluppare applicazioni di elaborazione dei dati
1bcfaa2c-ca76-4934-a9f1-abafd8f5bbc9	svolgere servizi di interpretazione giurata
1bcc0555-a9b8-415a-9c0d-13c2ceb320f6	organizzare la manutenzione degli aeromobili
1b7fcc07-2a86-4593-a2af-e4576153f8db	macchine elettriche
1bd45905-80e4-419f-9b81-d91999958b91	otorinolaringoiatria
1b78c440-310c-4246-bb47-577279807fcd	aggiustare il programma di produzione
1bd66cd5-8c8f-41e3-8c1a-b03d3efe043b	organizzare le prove costumi
1bea4408-31a0-4912-85ab-7dad4ea94263	comprendere il linguaggio fisico di uno spettacolo dal vivo
1bdf3e8f-6b1e-491e-abe4-d1e460e8f4e8	terminologia veterinaria
1bdd15a7-1389-461c-9675-c74603b203d8	fare le pulizie dopo un evento
1bf62cc7-18be-4ed4-b324-c32c5eb57177	teoria letteraria
1c0539c0-058c-449e-9e4b-d78fe0d87680	aggiungere additivi al tabacco
1c0869a5-eb2c-4385-bf3f-c195c7f93b49	attrezzature di addestramento per l’equitazione
1b9c60de-e7d3-4a6c-b364-b01b356fdf33	caratteristiche dei diamanti
1bfdbca7-7b89-45e8-bc2d-e4d8c0b91c12	ematologia biologica
1c142c98-61dd-4863-aa88-2d129391eb0f	individuare i colli di bottiglia
1ba5e85f-e20c-42f9-9a25-34abb84af4e1	azionare la cubettatrice
1c0ae4cd-efc6-44cf-b66b-36e5bbf6aa70	creare profili criminali
1c44c042-dc07-4d9c-aacc-8d38fbca7a35	processo di anodizzazione
1c390865-b415-4730-b2df-b546daecc780	prescrivere gli esercizi
1c1fa7a5-f15b-47f2-84fb-f0ae5e3caf88	promuovere il cambiamento sociale
1c4eed37-78f3-474c-aff5-64621ee4e79f	gestire il processo di richiesta di indennizzo
1c52c717-b75b-47d1-a846-7202a34f9101	gestire i fondi fiduciari
1c663bbb-9c0e-4191-a29d-6d2b7f872fb4	inviare gli atti di citazione
1c515a14-f66f-4dda-84a0-4e743d28b07a	attuare i piani di efficienza per le operazioni logistiche
1c5340fe-097a-43e7-934d-620902b60557	riferire i danni degli edifici
1c59c563-d275-48b5-ba90-b19878035ad1	effettuare i calcoli elettrici
1c6700ec-2b13-41cb-8cb0-8d8e9ab3c21c	effettuare la manutenzione delle macchine per l’estrusione
1c6871d5-f3d8-4720-9538-c30c94a0e5a7	promuovere i programmi di sicurezza sociale
1c69118a-ffa0-468f-a118-0b5f4f66f4ae	applicare il primo intervento
1c6c8546-dd3f-4b6d-8ebe-af8f359bb415	valutare l’impatto psicologico dei problemi di linguaggio
1c6b60be-f0c1-4126-a242-e7fcb16a332b	definire una visione artistica
1c6daa8b-8a49-4e7c-9fbf-ac614e3ca51b	utilizzare telescopi
1c6feae0-6e2d-4040-8488-c9872443198c	georgiano
1c831d8a-ac0e-409e-a1f0-f482a8d6fd9c	ispezionare il lavoro di rilegatura
1c833a56-6332-4d86-9a4e-3c075d3da782	interagire verbalmente in punjabi
1c83dd93-0b11-446d-9ea6-84d19f83324b	installare le periferiche audiovisive
1c8f94b9-f10d-46e9-912c-38307133cd12	raccogliere i rifiuti domestici
1ca6d425-1464-4922-94aa-1ea089128405	disinfettare le superfici
1cc208e2-efda-4feb-a861-e792eaff4295	normative sull’esposizione alla contaminazione
1ccc8bd2-4f3b-4613-9cb8-7d4c5252d9c4	disassemblare dispositivi mobili
1c91b21a-befe-4740-adab-a81167f326fd	valutare la pratica nella psicoterapia
1cd3a3e1-f202-431e-aba7-b531b4000d12	fare le veci del responsabile di miniera
1cd2dc64-ae2f-499a-bb6a-e40a6435a961	presentare gli argomenti in modo persuasivo
1cd695c0-dba9-4425-af72-ad98b610c33d	ispezionare le condizioni di sicurezza della miniera
1cd5860f-ee08-411a-a4cb-f8bcc3e7e6ad	sistemi di controllo della qualità
1cd80988-37ed-46de-82a1-613f8a22489d	utilizzare le tecnologie di monitoraggio del trasporto ferroviario
1ce69d3b-9753-4689-82e6-26de6689acf8	scambiare contratti a termine su merci
1cdd4802-0c8f-4416-8fd9-47cafb5fc3bd	osservare i manuali di laboratorio
1ce8f68f-aeed-4744-a815-634cb9cc2e12	promuovere l’erogazione di informazioni per la prevenzione del cancro
1cec77c7-4251-476b-99a7-e25f2a36364b	materiali ad uso alimentare
1cf1a4cf-339a-4b24-b9f5-c6a36f69a9d2	sorvegliare la macchina che appone il marchio sulle cinghie
1d05c0f6-8664-447c-8e42-85a635aa491c	utilizzare le macchine di stenotipia
1cec2d0a-dee6-42ec-b76b-d8643f5e27e1	eseguire le esercitazioni per garantire la sicurezza
1cfa7e40-d57a-4a65-b16a-b66cfd8c9098	implementare un piano in materia di sicurezza TIC
1d1681b2-efc4-413b-b6ba-2c005b556a3f	interagire verbalmente in maltese
1d0e8ddc-4c24-4dbc-874d-d1f1b8cf7a4e	eseguire la manutenzione giornaliera sui macchinari della nave
1d1256e6-d099-460e-8ef1-3934f39979ad	sviluppare l’immagine di una produzione
1d1b5b63-1273-4cad-9669-575fc7b724c6	preparare i pazienti per un intervento chirurgico
1d1bcefd-baba-4f21-b75d-37f0c67ab5c0	controllare la stabilità dei materiali
1d1c40e6-b3de-43da-b67b-a22e36b4d05d	eseguire gli studi di instradamento di gasdotti e oleodotti
1d370620-46cc-43b5-bf87-16bc00b994a9	tecniche di compattazione
1d376cfd-9717-40e5-a144-6c20b3a25b77	materiali hardware
1d1fea85-7f04-4cef-ac98-4735bc4464ac	ispezionare i materiali per il lavaggio a secco
1d2c3ced-77bb-4014-b0a3-8ea8f640aea5	condurre una ricerca relativa alla salute
1d48e679-fcdc-40d1-bf6e-3654bed9451c	valutare le operazioni ferroviarie
1d528de1-3bd3-42c7-9610-9b14737a6b1e	metodi di trasporto delle merci
1d4f2a69-5689-492a-93a8-e53671736728	determinare la sequenza del carico delle merci
1d209998-43df-4e66-a0ef-158caddccd5e	fornire osservazioni agli insegnanti
1d4dac7d-b373-4c08-9297-80713ffeb46d	preparare la scena per lo spettacolo
1d531c59-8552-40c5-95ae-10a2a7f07252	condurre una ricerca ecologica
1d5438dc-e1db-4f6a-a8c4-b7737b105d6f	embriologia
1d592cca-791a-45fd-b837-3fe7ac5d7007	specie animali
1d7294fd-4ee9-40a6-b1fa-1179ebeba1ea	utilizzare gli strumenti del serraturiere
1d6a4bb6-dcb7-4ea4-8ae3-919667efc380	esporre il materiale della biblioteca
1d7bbe9d-a0f5-4358-9d2e-8c5f06185602	fornire consulenza agli addetti alla trasformazione alimentare
1d5d1387-4f16-4580-abae-c752908d6f16	verificare difetti di saldatura
1d86c834-8abb-40d3-a677-021a9d82ff34	vendere i capi d’abbigliamento ai clienti
1d81a0c4-54a4-4c25-9943-eee2da5f32fe	limburghese
1d70b0dc-8ae5-41a9-bd63-956634c1bbeb	formare il personale odontotecnico
1d8ecac4-0226-450e-9c60-10ba6e19eb46	utensili per la lavorazione del legno
1d6d8923-e252-4f02-a1f5-184303066460	intraprendere uno sviluppo professionale continuo nel lavoro sociale
1d9584fb-38aa-478f-b337-6f298a2e060c	rispettare le liste di controllo
1d9d579b-3fdb-4045-a8bd-c08ef4a6697a	posizionare la draga
1da0ac9e-ded6-48eb-bfac-a50e85b26f71	utilizzare solventi
1da2bd30-29b7-49a3-9f03-267806edc9fa	contribuire a praticare l’innovazione nella sanità
1dabc75d-b242-43d6-87e9-c9aedb70e9cc	rischi di contaminazione di alimenti preparati per animali
1daecd20-86cf-49eb-b3c4-11c74a5cce71	montare gli espositori
1db52488-ed38-4edf-bcb3-e0b630ca629c	produrre la calce spenta
1dbff5e2-f1be-4666-87f3-b0c766d83786	idroterapia
1dc260f5-5928-4fdd-bd26-201ca5965cd4	monitorare le strutture geotecniche
1db5fc2e-8206-4cf4-b138-7a08bd8f45dc	concludere un progetto rispettando il bilancio
1dd6d1e4-a3cd-4777-9a99-e8be8709531e	fare offerte alle aste al rialzo
1dc4ac60-2498-4e74-b26f-1b3fc2264d49	analisi dei dati web
1dd86a2d-d177-4083-bf25-fc007960cb77	vendere arredamenti
1dd9d2f5-5a54-4b5d-80d0-551b3a458f6a	fabbricare tessuti
1de6ceb4-5686-48d6-8545-aa7bfbf8a700	tenere traccia dei cambiamenti durante la modifica dei testi
1df80c31-3e65-4b95-9960-e8808331a27a	ideologie politiche
1de66c38-918d-4915-937b-27367089d566	comunicare le variazioni di prezzo
1df4fa44-9f2c-4da1-bce8-2ff855cdd046	tecniche di social media marketing
1df82df6-0ec9-4bd9-834f-98479199b1cc	setacciare le fave di cacao
1dfc850b-f454-4e74-ba57-7ce29bfa96b1	produzione di articoli casalinghi in metallo
1dfe22cd-8e3e-48a6-aaf8-64973f6e27fd	garantire la salute e la sicurezza del personale
1e0e72ef-8b6b-4c2a-9fb3-818695ea1a24	gestire la produzione delle colture
1e06330e-6b71-41cb-85b8-e8c578c5a637	ispezionare le lastre di vetro
1e0600d6-dc3d-40e6-8bd8-461672926985	Sakai
1e04736f-0411-4dfe-a919-1d8ab417c506	gestire la banca dati dei donatori
1e12517b-753c-4825-a88b-29cba1fe9248	negoziare con le parti interessate nel settore dei servizi sociali
1e138aae-39ca-45a7-b6c3-1fd1e8a01094	supervisionare gli studenti di fisioterapia
1e18246a-7015-4926-97c4-0f5beafd8336	effettuare le perquisizioni corporali
1e1e0796-511b-4dfe-b080-b5aa13ce6037	lavorare con un gruppo di danza
1e1f5c86-65c0-4276-98b0-d5d255eab6b1	informatica forense
1e21ad69-798e-48d0-84f5-a36842ef7e44	comunicare con i mezzi di comunicazione
1e2218e6-3967-4c10-88a4-320bcb409cea	definire la visualizzazione di concetti
1e221bfa-50f7-4aec-ad62-48840a9f134c	valutare le esigenze di riabilitazione dell’animale
1e36089f-4403-49c6-9b4c-c7f1c48fdbbc	eseguire le riparazioni di montature
1e371510-0a0c-4462-815e-bfdc2e249b22	conoscenza dell’ambiente in cui avviene il trasporto
1e33f98c-cc10-469c-a02b-e73296f06c8d	fissare le riunioni e gli incontri
1e2f25d8-9878-422c-8913-eadb70f8ac66	controllare il processo tessile
1e26d24f-9538-4aee-8487-cb7829416dda	sostituire componenti di grandi dimensioni
1e386d01-0bd0-4ae8-9499-0a1de98ac2ae	fissare il carico nella stiva
1e376f11-8531-4d69-9941-87c4fec280e7	centrale medica di smistamento
1e3ede09-4cd0-433e-814d-05ee46ff4c50	gestire i reclami
1e5678b0-d69e-463e-a47e-138a99c3642a	rimuovere dal mandrino il pezzo in lavorazione realizzato con filamento composito
1e4a9032-7936-49f5-b175-b95c60aa5fcb	lavorare con la rete sociale degli assistiti
1e5710ae-3bbc-42db-94b9-c7cc78eb9c29	insegnare numeri circensi
1e57242d-0eb0-4b97-b94e-2d68a4548b3c	riparare gli elettrodomestici
1e572ab0-9018-46be-8bf7-b0ff9469c6d8	assumere uno stile di guida prudente
1e5ad29c-6d44-41e3-be47-c69007f29869	prevedere il sistema di misurazione finanziaria
1e685230-33fe-4680-9fb3-98992727f313	installare componenti di automazione
1e69c490-51e2-428a-be54-e8c5cc65e3f2	gestire gli standard per lo scambio dei dati
1e6967a3-34f2-4d01-abd0-1e63a7b34296	componenti di pannelli di controllo
1e6331c1-b6a3-4d8c-a449-ea0d8fed7f40	progettare dispositivi medici
1e71c4d9-6786-4247-b9c4-e1e0fdb0ddfd	verificare le specifiche di prodotto
1e80ab69-0cdc-452d-a44c-cf3265b4fec4	strumenti di misurazione di precisione
1e8b2f8a-4924-4e05-b3af-5723f1597f50	capacità di carico degli aeromobili
1e93be23-2a5f-448d-a49a-47a7854ad98e	controllare i serbatoi di stoccaggio del combustibile
1e7a12b6-ba90-4eb9-8b6f-a0e48a79cf2a	dimostrare empatia nei confronti dello studente
1e79dfb0-d6f2-445f-9268-2aa2b1556a21	incoraggiare gli allievi di danza a migliorare
1e966459-1cb8-4a6c-9a0b-f4318f04fe04	preparare campioni di calzature
1e990cef-caa1-4e2e-a77c-c0e2921a9ab9	garantire l’imballaggio delle parti
1ea13a5a-1fb4-4c4d-a25b-2519812aebc6	vendere snack
1eaea9cb-0018-415f-a664-3ea22c1cd93d	alimentazione del bestiame
1e9eb377-379f-4b3f-96b1-9b279a43df20	progettare componenti di ingegneria
1ebb9e95-81e5-41e0-9e23-adad60584891	stabilizzare il pH degli amidi
1eb7ac3b-7b72-4df1-973e-f9ed1aa909e6	insegnare la comunicazione
1ec85cc6-393a-4715-a8d3-7e2f1901d6d8	utilizzare i sistemi di pompaggio
1ec9fd70-7eb6-4c4d-a0a1-44f15f09e717	fornire assistenza nell’organizzazione di funerali
1ec7a42e-7da0-4dcf-b837-5ad75a71b6c1	negoziare con le parti interessate
1ecb8467-9954-48ec-851d-860012dd39a3	fibre ottiche
1ecdb6fe-58e9-4431-a394-2c9829f5f881	statistiche mediche
1ed605fc-2a79-437f-9d1e-5b8c81553adf	lavare il pesce eviscerato
1ed9aa3a-6855-4fa8-8dc9-556cb308ec2f	legislazione in materia di inquinamento
1ef278a3-f8d8-4670-b933-eebbbcfc7998	rinforzare il calcestruzzo
1ed812f8-d106-4849-b47a-bf26469666a8	monitorare le apparecchiature per scaricare la farina
1ed96920-872d-4d38-8dfd-2423fafc26f3	calcolare i costi di progettazione
1ef33760-74f0-4199-8244-232f42f59760	sviluppare una rete artistica
1ef7223d-a0df-4746-a0a2-643b212d0f6b	piegare i tessuti
1ef90455-af2b-4ab9-827d-d63bf7b5d83c	rispettare le normative edilizie
1ef39df5-a830-4821-a0a7-bf0ce6a393f8	pianificare gli eventi
1efa7bee-9649-45ab-8a50-62a81d4e5669	politica alimentare
1ef5619a-0818-4589-8190-b945a909b052	sostenere i testimoni
1edbfad8-c612-40ad-998a-c7da2c6eb0c8	stabilire norme di polizia veterinaria
1efca22c-a7c8-4b52-b7ba-d35b243f1bbc	eseguire le misurazioni di parti di manufatti
1f05f06d-fec6-44df-9ce9-20d1a64aacda	trasportare i visitatori
1f05ac25-6624-408e-95d8-95d25dd87449	controllare i prodotti di abbigliamento
1f03b1f0-7153-4c4e-8020-ec9c3b7ddcaf	ObjectStore
1efd50b9-9372-4eae-b773-0a43dada50e1	controllare il flusso degli oli
1f194b43-4cd0-49cb-8f29-03fdcfb3f768	utilizzare tecniche di accesso impiegando corde
1f1ad4bd-9cdb-47fc-bcb9-3689d48118d6	completare struttura animale
1f0d0544-77a3-4f5c-85d5-991b9fbfd4ce	abbinare il sito alle esigenze degli artisti
1f14e2e7-dc84-497c-a593-3199e22ee38a	individuare i disturbi di apprendimento
1f269c25-3cec-422e-8557-70a6fab7cb59	comprendere il persiano parlato
1f07e1e9-6bc2-442b-9d43-901e917e3837	mantenere i sistemi di controllo delle scorte
1f2bc2aa-1b64-4f65-bd41-52a856bbf6da	conoscenza degli ecosistemi di acqua dolce
1f3213ad-a0e2-41d1-b46e-e38758b9371a	gestire il bestiame
1f33631f-399c-4bc7-8e93-bfc6760c07a6	praticare mosse di danza
1f473621-e52c-4dcc-801b-51e95f61322f	limitare il carico per evitare danni
1f300139-ca87-4a58-8ec6-010b6af0f0e6	gestire forniture ottiche in ingresso
1f67ca3a-0f5d-4bf8-be13-2c40d9d2b5f8	marche di tabacco
1f747b4c-75d8-46c9-9be3-ad50e6afd2e4	cinesiterapia
1f6dd660-2f17-4904-973e-6406daa7580a	gestire i processi di trasferimento e sostituzione di un sistema legacy TIC
1f7261e3-c4b8-46db-902e-930016d756da	mantenere la qualità dell’acqua di acquacoltura nei vivai
1f751e35-769c-428d-ac02-81ed41d33f83	storia del tabacco
1f746169-0207-439d-b35a-5b8ee8c2085d	valutare le esperienze di apprendimento preliminari degli studenti
1f76f8b3-4598-4e7c-a621-a1b5a554c340	mantenere le condizioni adeguate per l’immagazzinamento dei farmaci
1f7a909d-478e-479f-b9e2-ab6778150784	agopressione
1f7ec625-e443-4fa2-b778-38c9a7af4388	utilizzare il forno a legna
1f80f38b-0693-475e-8b29-0a1a12dfec2b	applicare le vernici colorate
1f799c26-3337-43cc-beea-81926f8d2ea3	materiali termoplastici
1f83a288-2e1b-4c98-953a-6c40e5e29235	prodotti per bevande
1f9a11ad-3b37-445f-8e4c-c0179db25190	gestire i rifiuti ordinari
1fa11671-dedc-452a-a869-2a48c70d6cc4	quadro per un sistema di gestione della sicurezza
1fa278b0-1adf-4cdc-b744-f5a6d174289b	monitorare il cantiere
1fa3ff77-497c-44c2-a0fe-dc20a8ca3bb8	traduzione automatica
1f9e596f-e424-432f-ac7b-c7811dc78499	fornire farmaci veterinari sotto la supervisione del veterinario
1fad8e0c-0bdd-480f-b349-8fde92cbcb6a	creare registrazioni sugli animali
1fb16403-b5b7-43ae-8c4f-9b14783f2976	fornire informazioni sulla diagnosi prenatale di malattie genetiche
1f8c307a-35ee-447d-a6c6-f9c97258edb2	trasformare le idee in notazione musicale
1fbb351c-4923-40bc-8e7d-c82bdc6aee83	redigere legende
1fbbb0d6-3ecb-4381-93a7-bacc699a7fcc	regolare la reazione chimica
1fbd86b9-6355-472b-9da3-fedf6ffec597	essere addetto ai serbatoi di acidulazione
1fc42f47-bdcc-435f-ad68-5886d8634c87	modificare i negativi
1fc51c3d-3be2-4d54-b4b6-216982ffa768	tipi di fornitura ortopedica
1fc30e30-3c03-47f6-87d4-392d4e5f8f37	psicologia pediatrica
1fc0ba25-2964-4b87-9ed9-92bf53a908ec	definire le componenti creative
1fc9129f-abf7-44ae-896f-2ef18627e42a	gestire le domande di sovvenzione
1fcd3b71-1a31-40da-9771-d330da7fe21a	effettuare la manutenzione dei sentieri boschivi
1fd42394-da5d-4731-a69c-04fb5ee523de	stabilire processi di dati
1fd4df6b-93ce-423d-9ed9-91e16c25a251	usare la mappa dell’esperienza utente
1fe26199-d054-4aa3-900a-36a6f311d90c	eseguire la manutenzione degli occhiali
1fe3aba5-36c3-4652-b259-00a139980717	modelli di architettura software
1fdc33da-5a1f-472e-8e80-118a92db1499	condurre le indagini di polizia
1ff03886-4050-493f-9b0b-b8a8eb5fe8f3	offrire consulenza sulla sicurezza
1fe60cab-eb71-41a1-8faa-e6bbc474102e	stabilire standard elevati di gestione delle collezioni
1ff25265-55f9-4739-8071-07589166c3f8	ambiente per cure palliative
1ff40f0f-f93b-4112-aee3-418feff939e3	poligrafia
201065da-d266-44da-bb2b-a66567293fba	applicare un trattamento anticorrosivo al pezzo metallico (parkerizzare)
1ff23ec7-c216-43f4-9de1-f0741c5cc322	aggiustare progetti di ingegneria
2025d679-8f73-42a6-b574-c30ade2cce97	normative sul trasporto degli animali
201dd463-c003-403e-9f29-bc732ffde31c	coordinare le attività di acquisto
2017f98d-36f5-44ef-af55-3d198c929124	verificare l’attuazione del piano di sicurezza
2034f7fc-cac4-45dd-b227-f61f396979a5	gestire la sperimentazione progressiva per la realizzazione dei prodotti
20323597-9e5b-4845-893d-84b7aa553699	gestire più pazienti contemporaneamente
2044dfa6-b82f-4ddd-b232-220baa8e0942	sostenere i giovani coinvolti in aggressioni sessuali
204f7277-4843-4bcd-9451-adbfae05abf1	dare forma alle candele
2042ebe5-5051-4388-b5fb-55d58fab001a	utilizzare software di organizzazione personale
2056b7fe-56b1-47cb-b91c-f8a4e0339f91	realizzare disegni precisi
20564e87-36da-4513-b828-6a5f9ebdb1a2	interpretare le specifiche di progettazione elettronica
20459aa8-0427-4eb4-942e-8170e5bb5dee	gestire le risorse per fini didattici
205111ce-5035-4198-83aa-2c91069fe0d1	svolgere simulazioni di laboratorio
20572c91-8ae6-4e2a-9059-99bf42176dc6	movimentare blocchi di pietra
2055810e-3b07-4cc4-916e-db1c1a0a4f3d	degustare vini
205a36e4-12f6-4546-a7ca-5f1540d56c8e	realizzare il disegno per il taglio
205c7f36-3bbb-4fd4-af86-aa42c96f2df7	definire gli orientamenti per la sottoscrizione dei crediti
206573c2-b7d6-4bca-9529-f812e796e2f9	retorica
206f0800-aa5d-451c-b880-d6c9849d1495	riconfezionare le attrezzature mediche dopo la sterilizzazione
2070152f-3891-4104-8c66-b947e8257b38	garantire il rispetto delle norme in materia di sicurezza
2078eda5-fb82-42ef-9546-584dc5039b1f	azionare le attrezzature marittime di sollevamento
20773c29-5641-472f-ae69-b3dc5a342f93	tecnologie di saldatura metallica
206ff7ca-7910-4bad-9d48-ec421567e8c4	ABBYY FineReader
2089f22a-11dc-488a-827c-76a7ff816e13	norme per l’esportazione di beni a duplice uso
208332fc-21f3-4996-a30e-2bb1cbb58dc5	fornire ai pazienti consulenza per le calzature
208b264a-d0e1-4ef6-bbb3-47003dde2da2	assicurare che le vie di fuga siano sgombre
2093b123-8073-4ac3-9090-52766fca1741	far funzionare la troncatrice
2098d5ec-0630-4ee8-9256-3004aba25f3b	metodi di insegnamento delle lingue
20a24af7-d5f5-407e-8405-29f7a84422e8	fornire informazioni mediche di routine
20a4d4e1-7d5f-445a-bb05-09ca96a057c6	attuare i piani per la gestione delle aree erbose per lo sport
20a4fb85-8588-4f52-a38e-ee770d7eb2a4	servire i vini
20bb7596-9182-4228-92d3-97703cf94219	costruire strutture per i set
20ce265e-99c2-4d20-b355-9b90dce931ff	tutela della maternità
20cb9503-3e2a-45c9-81d4-d43f8c8f2aec	metallurgia
20c4fa78-f4f1-49a7-8394-a64975bf9430	offrire consulenza ai vivai
20e3ba7c-4721-4696-ac7d-c4dbb1deadd3	modello open source
20d9e904-83aa-4a14-a4a8-862bc635b21c	sgombrare i luoghi degli incidenti
20e990f7-603d-4b90-98ee-7ad66993727a	tipi di pompe per calcestruzzo
20e5e8e8-f811-4155-b256-c15094e9e7ff	definire politiche di sicurezza
20ec8f63-6ef1-4c55-97aa-b99813d12e2d	effettuare la manutenzione delle attrezzature tecniche della nave secondo le istruzioni
20d1258f-88e1-492e-9571-2cfced67851e	comunicare con i professionisti del settore bancario
2103b134-a3a8-430f-9626-1efc8c285750	scavare il terreno con attrezzature meccaniche
20eef4cb-8202-4f93-8391-30b33e293feb	effettuare la pianificazione delle risorse
211271c2-f52b-4ead-9021-9f995836221c	gestire i diversi materiali ceramici
2118fc8f-a6d3-441b-94c7-6477be2061fe	interpretare la meteorologia marittima
210f98ac-b59b-46d3-93ee-a244d47804a7	reagire ad eventi imprevisti all’aperto
214c4661-ae65-415f-bc62-4ec15a6f0e70	impartire le lezioni di nuoto
21211d4c-27ff-4851-b40d-cd2e9614061f	mercato immobiliare
214708c4-72b2-403f-a796-29fe892a2702	determinare il carico delle gru
214f66a0-6651-4b26-8920-4c4276c7a3b9	monitorare le forniture da cucina
214f968d-5840-4526-ad39-7082ca68e9e5	interpretare carte 3D
214ed248-4bcc-4247-9ab8-bbec157446b9	classificare la pasta di cellulosa
2169f5ad-1681-4626-bedb-3f53a720e567	smantellamento
21510035-df8b-4a8d-a3d7-0c99e383e330	utilizzare pompe idrauliche
216a0c8b-96e6-46b1-ba34-ae53c20e8f9b	ergonomia nella progettazione di calzature e articoli di pelletteria
21727597-f99c-4e10-9630-f3491f248607	controllo dei parassiti nelle piante
2174857a-d8a8-4a41-aa31-57b3c7e8e7d6	coordinare le attività di fabbricazione
2188f092-8117-4c63-9309-bc02d3ab4c9c	influenzare il comportamento di voto
21a37586-4bca-40fd-9f12-d92c4d6a63a3	prevedere i servizi di catering
21a3c214-3f31-4c0f-a41f-d9db782d764c	parametri di prestazione del sistema globale di navigazione satellitare
21971ec4-3242-4c5b-9ff7-5c4be2387275	interagire verbalmente in olandese
21b71f3b-8ce7-40ae-82b3-27d12a1eb6f4	verificare le parti del veicolo al momento della consegna
21a414b9-2820-4ccc-a885-a1ac16659825	analizzare le tendenze culturali
21bcae86-4d87-4e0d-87c0-be4d49687529	definire il contratto di vendita all’asta
21bfe400-90b0-4872-9a16-48529a2b36fd	pubblicare istruzioni per le operazioni di perforazione
21c70c83-320a-4b91-8f77-a7d6dc793867	insegnare i principi dell’applicazione della legge
21cd282b-3e72-464a-8505-7ed99431ab60	gestire i prodotti dell’azienda agricola
21d44481-779c-4939-81fe-f56d22c1b327	caratteristiche delle sostanze chimiche utilizzate per la conciatura
21c1b0ec-b7a9-47a1-b777-f160105ed523	eseguire i processi di raffreddamento dei prodotti alimentari
21dcb88b-a6c1-476c-8262-73e36a40de9b	danzaterapia
21eb955b-1e0e-4bd1-b2e6-1f473f82193b	personalizzazione di massa
21acb721-6797-458c-9436-d4b941f0bbb5	pulire gli interni del veicolo
21d690fd-0e69-448e-804c-5f890454652b	fornire istruzione specializzata per alunni con bisogni educativi speciali
21f45cb4-8453-45e2-a1e7-8274fc566187	analizzare i campioni geochimici
21ff47c5-fd05-4b29-9cf5-85c7b2133566	assumere risorse umane
21fd3b74-9ca9-4504-a404-c1034017c402	collaudare schede di circuiti stampati
220a338b-5a9f-430b-b0fe-a7e71ec1d9cb	consegnare fertilizzanti
22086e3a-8bca-44ae-a40c-531959571652	utilizzare un minatore continuo
2221150e-985e-4b01-b798-cf74c9f6d06e	frantumare i semi
222336bd-602e-4ed2-b461-51c8bd9172df	offrire consulenza sui farmaci agli assistiti
22281d28-4683-4a21-a225-f0f86fd978b5	lavorazione meccanica delle mandorle
222430b0-72c1-4c31-b0be-fcecb959bc4e	ingegneria industriale
222a18f3-54c2-4dc0-bab2-f083668ec3ee	utilizzare le comunicazioni del servizio mobile aeronautico
222d0c8a-6bac-4254-ad01-f1fb0177166c	supervisionare le operazioni di scommessa
222e3044-ddb7-414a-b86a-69127bd9338b	svolgere più attività contemporaneamente
22290d17-bcf3-4c67-9bfc-9d6aaf5ecbe6	mantenere un portfolio artistico
22352886-f03b-44c3-b55d-bed30f397e33	sviluppare strategie per la gestione dei rifiuti pericolosi
22395fc7-d5c7-4d3c-a5b8-f80ae2f5aa4c	promuovere le vendite all’asta
223c6e6c-46b8-414a-a5c2-9aa734602c09	rilevare i difetti delle rotaie
22508ab6-3aed-4b7f-afa0-3c59d3df95e5	effettuare i servizi musicali militari
2239ccad-0f43-4272-8327-183b8d064e3c	compilare le statistiche per fini assicurativi
22518791-63ae-446d-90cd-deb499beed16	redigere abstract
2238a421-7aea-4ede-9230-d4454c38018b	gestire l’impresa di produzione
2257cc6e-fff9-412d-ad53-8004e76b8d77	pianificare una logistica della filiera per le calzature e gli articoli di pelletteria
2257f873-649f-402b-bcec-53d205c67768	convincere i clienti ad acquistare prodotti e servizi aggiuntivi più costosi
225d2a52-d4d6-4c8c-a0b4-73ba635a308f	esaminare l’area prevista per l’esplosione
225dfd26-cfda-4e8e-91c5-6a657d7c5bf1	proteggere il telaio delle finestre
2269ceda-a774-421c-bc7a-4e1d384c191f	tipi di macchina per pressatura
225f7a77-f888-44d2-a4cd-1c0eee04e2d7	autore e le licenze relativi a contenuti digitali
22760b0b-43d6-44b6-a847-f2d8e13d333e	lancio in orbita di satelliti
22772de5-cb70-4f44-9693-3c6b7c992e1c	imporre sanzioni pecuniarie
227b6d8d-a06e-49c0-a191-f8253d1cc676	fornire un riscontro sulle prestazioni lavorative
227dcf51-6d2e-46dc-ab06-6ac7ebbd2e63	sicurezza negli edifici industriali
227f2721-0b43-4122-a8aa-4cb0b652231a	applicare un adesivo per pavimenti
2282090a-6e65-46fc-8e3d-307b14085412	dirigere il posizionamento delle ancore
2279c59d-5b7e-44ff-8c86-554e7f42b777	completare le registrazioni sui trasferimenti dei pazienti
22816c67-f5c1-4ef4-87ad-3d8adc950dde	specifiche del software
228517e0-79e6-4bcc-874b-3bd4564d4f3a	distinguere tra categorie di legname
228ab02a-3637-4d5f-8828-85bbbf9d63da	gestire l’amministrazione del contratto di locazione
228ae218-25a9-4c0a-adc5-1a95d23dcad2	tipi di apparecchiatura audiologica
228d0993-3109-4f45-baa5-5402b8263b57	garantire la sicurezza nei centri di detenzione
228dc5c0-93cc-401b-9f8e-fd7588d2701e	operazioni di controllo del traffico aereo
22a91114-bb35-4342-a852-666c8835cdd4	avvolgere il metallo
229a73a3-e954-46b2-8a65-1591e181081f	chirurgia odontostomatologica
22a4b2c3-1799-4d99-8867-3a8b5d4467a6	tipi di pallet
2295e8bc-9f7d-4a91-ba4e-e0fcc9bbfd85	leggere schemi di ingegneria
2296216b-043a-44cf-9593-e1e79788e202	scienze della produzione animale
22bdb355-8f2d-4bff-9af6-0e4a783bd41b	verificare la consistenza della vernice
22b2025b-79a6-47ec-9728-9867e2e11d5f	consigliare i pazienti su condizioni di miglioramento della visione
22c7ff99-6edc-4885-a0db-72d8db329833	offrire consulenza agli esponenti politici sulle procedure elettorali
22d595ff-fd38-45a5-ab2e-78e0969063cf	predisporre un inventario installazioni fisse
22e2e3ae-cec5-4050-afe2-517b8b41987e	disegnare i cartamodelli dei costumi
22e3384c-f8f1-4244-8d62-752162c387e0	prodotti chimici agricoli
22f12327-bab3-4b9e-8483-8d5076c215af	curare il cerimoniale
22c1d2bc-5297-40ff-9a1c-2b847eaf0c18	tenere un archivio del lavoro svolto con i fruitori dei servizi
22f2cb9a-afc4-4fee-9e19-f4d2256d6fa7	sviluppare i materiali didattici sulla musicoterapia
22f52087-7424-48f4-a4fa-bb212739de99	effettuare la manutenzione di strumenti musicali
22fada48-bb1f-4c06-b4b5-e57ba04bab4c	applicare la gestione del rischio nelle attività sportive
22fb9a0a-2bde-4979-a4e1-f0f162e278f9	detenzione minorile
22f155f4-930e-44d3-bea3-082ee0463865	smaltire rifiuti alimentari
2300d03e-433c-4c90-b493-af9761f759a0	utilizzare tecnologie per migliorare le proprietà del vino
2319168a-e009-47b9-849a-91b5ef3b0104	posare il materiale isolante
23284fe9-3ab1-4dc6-bfb2-9220c3c087bf	tipi di plastica
230bcf62-3b47-4305-beb2-6ed9d052ac1f	manutenere il mulino a martelli
212521e8-3399-41f4-81c6-2a11506e9aea	posare per una creazione artistica
232f5686-e17c-45df-bc45-55ea8766b480	riattare i ripiani del forno
23341e79-b1d0-4bc2-bc96-971f271a3566	produzione di plancton
233ae328-ea90-46be-93a4-6ab7c35e50c8	disturbi delle funzioni vitali
23354d26-51ab-4144-9419-bf00b3eebb2b	gestire i programmi di formazione aziendale
233c7084-e0fd-4463-a47a-352005087b2f	metodologia della ricerca scientifica
233f0a14-a44c-4962-aa1d-5053e7ecde8a	microorganismi patogeni negli alimenti
23495107-c169-45b2-a62e-145db94b06ec	assegnare le tariffe dei taxi
2350c078-802a-4e76-a33d-c64285c292e8	calcolare il tasso di crescita delle risorse acquatiche
2350b5bd-b84a-48d0-9713-44bf1025a5ac	trasferire dati esistenti
2357ca5a-090d-4982-b26d-f163e271add3	facilitare lo sviluppo psicologico dell’assistito
2377644f-14bf-4d96-936e-4d6470b710a8	valutare la situazione finanziaria del debitore
236065b4-afdb-41f2-9ab1-d78a8e9622f1	valutare la resa di gas potenziale
237dbfaf-49ff-4e7d-accf-009ea024dfaa	gestire le macchine per il lavaggio delle bottiglie
238445aa-9518-433f-ac94-dbb778d3b384	posare le tubature
238a11ba-43cb-43dc-afb9-2fa4523a33d7	eseguire i controlli delle attrezzature tranviarie
23963497-ee8e-4610-b9ab-a8beed405d1b	costruire oggetti di scena
2391a607-1076-402d-bbeb-84a583e000fb	offrire consulenza sulle relazioni pubbliche
23975916-e0f0-41b0-8859-b9b73c988b9d	eseguire un programma di allenamento sportivo
23959580-e2d8-4883-93d3-16364f773753	utilizzare linguaggi di interrogazione
239aec95-00d4-4573-80a6-b230b2bfc8ca	teoria architetturale
239ccfd2-b1b5-492a-86e5-62eb7113a685	utilizzare la livella telescopica
23a53678-d410-4dcd-af42-c530f9aaf67a	preparare le offerte di credito
23a570eb-31e0-44e9-89e7-d2d2dc606298	riscuotere l’importo stabilito per il servizio guardaroba
23aaa37b-d320-49aa-9976-9e3a46930369	conoscenza del funzionamento dell’azienda
23b5a501-37ea-4a6b-9f16-94c6804f84d9	trasfusione di sangue
23cfae7b-b90f-4f64-8e27-efc2e0f88471	preassemblaggio di suole per calzature
23d10fe2-9dfb-49ad-a2b3-274f18775369	organizzare le risorse per l’autosalone
23db3678-f529-450e-8771-4d30a636869c	seguire la ricerca in materia di bisogni educativi speciali
23de379a-60dd-407d-8464-4490b9885b79	eseguire le procedure diagnostiche del veicolo
23e1667d-6d1b-4e1a-8569-5a8292011937	creare tavole di stile
23dcfe73-55f5-4f8e-9bba-53c371eb8248	sviluppare i piani di sicurezza per le emergenze
23e05312-f364-40ca-bf34-7d9916d31c02	Edmodo
23edbc33-ce86-4d52-affa-8b82fef6fd1a	psichiatria
23ee0198-6fb8-42b7-ba9e-824170101b67	scienze medico-biologiche e mediche legate all’odontoiatria
23ee65e5-5409-4262-bc85-47f9d92223d0	utilizzare schemi di progettazione software
2403802e-16eb-44a9-b3d3-b74b696d6fab	autorizzare l’occupazione dei binari ferroviari
24008e1a-c02d-4265-a58b-5f6494830adb	fornire assistenza per le procedure veterinarie di diagnostica
2405edec-0bd9-4cf1-89d9-fbe7e14a2507	identificazione e classificazione dei pesci
2410984b-46cc-4295-a7d0-3a7be93cda9f	presentare gli articoli durante la vendita all’asta
24149491-adc0-443a-8279-079077f058fb	consigliare i clienti sui servizi di trasloco
241de07c-499e-478d-89d9-58e610a103a3	impartire i corsi di sofrologia
2421108f-41da-49e2-b420-60e01ce6acb0	promuovere i programmi educativi
2423ce8c-3163-45dd-9e56-67129cbe8bae	utilizzare strumenti manuali per la lavorazione dei fili
24296005-6e5b-47da-a59c-ede6da40842c	comprendere il finlandese parlato
24249c5f-4631-4f14-97bc-704549736559	tenere il guardaroba pulito
242bc670-1d81-42c3-8c29-fdcb385ad1d3	legislazione europea in materia di controllo delle armi da fuoco
2429f59a-c254-48c2-86f5-46c13e3f4293	taglie degli articoli di abbigliamento
22aa1089-31bb-476c-97a8-bbc6f5fc706e	analizzare i prodotti più venduti
242fe72c-4ef7-4b4e-a317-4484273e8d16	sistemi elettrici del veicolo
2439d43a-f002-4b64-b6ef-03a586b1c861	valutare le sedute di arteterapia
2436460a-ed0c-4e70-8f87-7615c1bfa62c	fornire assistenza a differenti utenti aeroportuali
2440b7f5-aef9-48e0-b564-0da6617a0639	analizzare i requisiti aziendali
24416d39-9a12-42bf-a6cf-5a6fbcd1f3c5	asepsi chirurgica
24477cd4-9e8f-405d-8acf-f34cb5cdf7ad	progettare dighe
24436949-ba53-4c27-88b4-1c42a343803d	interagire verbalmente in romaní
24433670-35db-4514-aab2-4d5940e25d67	occuparsi dei corrieri
244b1ce8-1ea8-45bc-a268-0a51df2d9120	produrre disegni tessili
244dc6b4-3fd5-4293-96af-8166c82f02ff	verificare la correttezza delle informazioni
2457cda6-5c4e-4af7-a510-b1e0ca669800	verificare i documenti fiscali
2458872f-2aff-47dd-940f-bb99dea15af2	aggiornare il personale sul menu del giorno
24592799-0d85-4671-8f2f-52ddc5cecd77	chiarificare gli oli per decantazione
2460b1a7-30ef-4cb0-ad71-245af080a006	metodi di cattura dei pesci
247139ec-c688-4d5f-910e-2c1fdb06c060	riparare i macchinari da taglio
232e46d5-10a5-494b-bc10-05e4e7c3dbcc	azionare i comandi del tram
2474c2b5-8865-4174-96b7-29a8fd99abb6	strategie di pianificazione di capacità TIC
24723b33-5c35-4bab-8d3d-a65215477817	occuparsi della gestione energetica delle strutture
2477311f-622e-40cd-affa-593a3996cc75	riparare i giocattoli
246d2838-214a-4a43-b34b-5a00c4f62359	tenere i contatti con le aziende di trasporto
24782bed-ae1c-4b57-b835-c4c70e163b40	Cristianesimo
2478997a-d6c0-4848-b6f4-8547371e609a	funzionamento di dispositivi di sollevamento
247e6630-f804-469e-b999-130d8d0942aa	sforzarsi di fornire un servizio clienti di alta qualità
24813368-641a-4746-9d72-3c97a87f45fb	interagire verbalmente in lituano
24878f27-a683-4908-9771-40f3beedda2b	determinare la commerciabilità delle merci di seconda mano
248b11c2-233d-4b57-83f9-d6e99e891d5f	tipi di macchine cippatrici
248a1f09-e052-4129-97f2-5043ba131399	rimuovere la neve
249b6898-28c7-43cf-b532-2bd43b7c02b1	evitare l’adesione del pezzo fuso allo stampo
249c50d9-11ed-4715-a538-c83179731b8f	gestire il trauma del paziente
248c41fa-c1da-4b0f-9f7e-d7ded020228e	applicare un rivestimento alla carta
24a026df-9f8a-4ed5-afbe-aae8cb65b483	creare illuminazione artificiale
24a14f5f-7f3c-440f-b41c-f091aa8f6f81	lavare gli oli
24a935ee-24a5-429c-b7a0-e076334d4e4c	gestire i titoli
24a9c02b-c864-4d24-8a4e-cc3d95b97d48	piantare secondo le istruzioni
2495f7d5-3188-4b61-ad8c-aa27aeb4c57e	C#
24aa1c11-79bd-45cb-89f6-ecbc1213963f	metriche software
24aa1e55-3592-4512-9ad8-fa590ad3b8bc	comprendere l’armeno scritto
24ab4324-3ea2-4960-b982-961fe27ef865	effettuare la manutenzione di attrezzature di illuminazione
24b67d7d-63c1-40dc-a5d5-1d038c690016	fornire servizi di intimità fisica
24b1559c-d24d-4eb4-b8b2-228716b5f9c2	utilizzare il dialetto
24b6dec5-d991-42d2-a772-d374277d9d3b	negoziare il valore patrimoniale
24ba3c38-cebb-4e1f-9e5c-ebf903f1b0cb	azionare la motosega
24bf2ba5-262e-4484-b801-c8a8838e117c	LESS
24c06acd-5596-42cb-8582-0b12adfce405	aspetti chimici dello zucchero
24c35624-b46a-4640-9076-5166e5a383cd	tipi di violini
24b8ac86-30c9-4848-a75a-ef086372b368	motivare i dipendenti
24c90495-8be9-49b7-a3f4-bd98aba709eb	monitorare l’alimentazione della tbm
24be4944-d31f-4e13-bf41-ec94709ed3fd	gestire le comunicazioni online
24cc748c-865e-4244-a9fe-905225f9cd93	supervisionare il personale della galleria d’arte
24d1d853-5b34-4025-b9fd-ca1feafbf3d3	materiali metallici per galvanoplastica
24da6eac-2a0f-4ea1-8787-98a5fa01e874	immergere la pellicola in acqua
24db4346-6cca-42c3-b1ed-8ebfcfe604b1	organizzare i viaggi del personale
24f0449a-eb08-4ca5-891e-108dd2452bd7	comprendere l’italiano parlato
24e6d91e-05df-4abc-a9fe-a2a16030a4d5	applicare le normative sulla sicurezza sul lavoro in campo veterinario
24f4c624-f79d-4462-8c11-4008dcf71bc8	eseguire operazioni di magazzino
24f6be6f-5628-4fe3-86cb-d2ed3864527c	valutare le problematiche delle infrastrutture di telecomunicazione
25002740-ab52-4b15-b7ad-fba28cff6db4	trasportare campioni di sangue
24fd9b3e-4930-4a72-bc10-c07ae4ccccb7	eseguire gli interventi nelle strade nel contesto del lavoro sociale
25073e58-39b0-4e51-884a-31cfbff92e32	gestire il ciclo di sviluppo degli imballaggi dal concetto al lancio
25091cb7-f5b2-4d7b-b96c-8fabfbd21c34	collegare i carrelli ai veicoli ferroviari
2511f503-5183-4cf1-838a-12219072f41b	evoluzione delle previsioni economiche
24e27258-3418-4ec4-bca4-62a4868d657d	stabilire l’orientamento dei pannelli solari
25288e93-4e66-4e94-87aa-f7107bf09af2	comprendere il lituano parlato
25185228-c943-4e3d-b2fd-7750e4b52543	eseguire il trattamento delle acque reflue
2526f163-6fa7-4378-863c-353ea015e1dc	additivi negli alimenti per animali
25311e94-3f80-491f-99c8-52f8100afc58	descrivere la situazione finanziaria di una regione
2540e347-1283-4005-996a-5a34f1f58581	insegnare i principi della letteratura
25476fb6-11f4-488f-8b69-f679a07f06f1	controllare la resistenza dei materiali
252fb6bf-d947-4616-a1b5-f115a2098124	supervisionare le attività di vendita
25491c07-476e-4395-ade3-1b428bc62ba4	partecipare all’organizzazione di esercitazioni di emergenza
2557a24e-518c-45d9-b352-b40bb19b4136	comunicare accensioni irregolari
256cf001-1011-4177-8884-95ab37230735	coordinare i gruppi tecnici nelle produzioni artistiche
2562a5af-b9ad-4078-b130-10ce1fc69da6	finire le pallottole
256b310b-7cc6-4051-b8b7-3e8f7a65f75f	assemblare componenti di strumenti musicali
257526ee-a4f1-490d-a87f-6d7fe8f31fb5	mercato assicurativo
2577ee56-c7ef-4def-b349-f093028278d1	pensare in modo creativo
257a8be1-7a0f-49b2-8b97-22e71d50b75a	garantire la refrigerazione dei cibi lungo la filiera alimentare
25871249-b911-4121-8bbc-fefb935b7a6d	utilizzare la levigatrice
257947a4-1f44-47ad-b019-01e312bfcbbe	manutenere apparecchiature robotiche
258ec50a-ba80-4fff-aadd-f61cf8eadc53	assistere gli studenti nell’uso della biblioteca
258f2c62-289c-40d9-938c-61568fffd6b5	efficienza energetica
25991741-be84-4683-95d0-b2b7ef17e2fa	consumo di elettricità
2426a836-e605-4f07-8180-6d58de107ac4	tenere un registro delle operazioni in fornace
25b167f9-882c-49ee-9e0c-ac2dc71c0ca4	integrare le richieste dei clienti in merito all’edificio nel progetto architettonico
25c59079-79b7-48e0-b0bc-cb359404649c	analizzare le procedure elettorali
25a6eb52-073c-419b-a132-f9d750df3210	fornire orientamento professionale
25b55b6b-7b03-4602-a93e-197b50d4582a	Java (programmazione informatica)
25d5c71f-21ba-4d7a-8f4b-6b75ab94ac6f	comunicare le riparazioni delle macchine da miniera
25d87043-1133-44ff-96db-60a3bc3d9296	fornire informazioni ai pazienti sulle malattie infettive contraibili in viaggio
25eb576e-8c85-49ca-a1b7-16a95be2d887	torah
25e55c3e-5c72-4dbd-8809-6c6a2640b467	redigere annunci dettagliati per la ricerca di attori
25eb6a1c-1837-4319-9701-18da41b7411d	interagire verbalmente in bengalese
25f1c7d8-fde6-4de2-a01e-8be2a14846ac	creare quaderni di lavoro teatrali
25eeb506-25db-4b15-87b2-b2ec34d9e33e	sviluppo incrementale
25f7f91c-f275-4e9d-8c08-a7f1f1e59b62	gestire la pressione derivante da circostanze inaspettate
25d06651-55b1-4d21-96bc-0368edacd865	progettare reti di computer
25f4ef54-b87a-40a0-baf5-a31e9276d727	creare un modello della planimetria del pavimento
25fc24ca-6035-46a3-9861-c61242aa7e37	progetto dello stabilimento alimentare
25f36040-2683-4efc-a029-13dd6c1503aa	monitorare le procedure di titolarità
25bf16fd-8044-4485-b455-50b732323e44	spiegare le regole del bingo
261348f2-84e7-4976-acf8-68b55ed3f9f1	comprendere il turco parlato
261364e9-e8c3-4e41-8572-e80662639cae	insaporire foglie di tabacco
261e65c6-4034-4661-a7af-d7c4092e4190	spiegare ai pazienti il fondamento molecolare di una malattia
2622a281-46eb-4558-bda8-8dc7d64eb1a6	principi di selezione del bestiame
2623aedb-801e-4802-92f8-54ad73a3448c	livelli di test per il collaudo di un software
2623d494-4590-47a0-b4e2-877adbe97743	generare rapporti di riscontro
26234d78-8a79-481c-b955-43ad40850c35	promuovere la consapevolezza ambientale
2626437f-a5c2-4e54-a404-a99761caac45	guidare le esperienze di movimento
263de11b-7f0a-477e-ab6b-f38738e3643e	scrivere una trama
263f6da6-b3ac-45ce-93aa-399880c576eb	biomedicina
264da484-8b4c-4966-ba22-3d5df7527e6c	eseguire le operazioni di alimentazione
26509735-d343-44ce-bbeb-5964376e9d02	monitorare le assenze del personale
265d0112-58fc-48a7-92e4-922e1d0d4a55	conferire alla gestione aziendale un’impostazione proattiva che anticipi gli sviluppi futuri
2638da3b-c8dc-44f4-afd4-b115f06d8f58	riparare le apparecchiature di comunicazione a bordo delle navi
265d49fc-b0eb-4219-802c-903e995ff16b	linguistica
26536d8a-6bb9-4812-8147-dc2d2e4b513b	interpretare i testi religiosi
2666c5ea-5547-4d28-be74-3b3c38382c15	disturbi sessuali
266a49d9-bcf3-4e5c-bfb5-845d36eb06a5	pianificare lo sviluppo delle risorse idriche
26677ad3-992a-4822-a532-1d17d4335a74	applicare i fondamenti dell’assistenza infermieristica
266acedf-356b-44be-94e1-a0f83ade17fa	analisi aziendale
268a679c-09b5-4b91-8428-e1f51092f689	raffinare oli commestibili
268e9c03-fbe5-4813-a088-98881fd7b44d	mammologia
26878592-91ad-436e-99e4-ee6de6878dad	disegnare i bozzetti dei costumi
26908928-54f8-4c9a-b22d-895a7eddb85d	riscaldare i metalli per gioielli
269432f3-9af2-4917-8dd0-1138c79794c4	classificazione del debito
269663a1-d881-4e3a-9596-64fee79b0217	tecniche di fabbricazione di bambole
269c359c-6fa7-4bff-a57c-41ad61dfc7bc	massaggio linfodrenante manuale
26add89a-72a1-419b-9c60-9402ff2d9a1b	comunicare con le parti interessate per anticipare gli aumenti della domanda di trasporto
26ac68e2-3f10-4848-8456-519f65d7b8b9	variazioni di colore della tostatura
26c22f3f-0f95-471a-adcf-1ce6afe7b626	impiantare i mezzi per i trattamenti di brachiterapia
26abec5d-3c43-45c1-bd4b-24d02a4d3897	determinare la struttura del magazzino delle calzature
26d4659f-e4b2-428d-9e01-9b96c2f2453d	preparare gli strumenti odontoiatrici per la sterilizzazione
26beb81d-bb84-4efe-8128-343eb41258f5	intelligence di segnali elettronici
26d997bd-f186-4685-88eb-ae8026c7109c	gestire l’allevamento di tacchini
26e84e6b-3a0a-4459-8e0e-fdb144018628	azionare macchine per mescolare la gomma
26ebd79f-fe51-4e3b-b1fc-2ef7ca6a51af	sviluppare procedure di collaudo elettronico
26ed95d9-5975-4d7b-b3ef-74b9f1cef563	supervisionare i gruppi musicali
270466e0-6871-4afb-817d-899851eef816	industria farmaceutica
27072c7d-5126-4ee4-8d05-ed7c2b739934	fornire una diagnosi fisioterapica
26eff55e-621b-48ef-a3e9-2add27a027dc	risolvere i problemi operativi di trasporto
27131755-84f2-41f9-b690-dda3016cad8c	presentare una domanda per un finanziamento pubblico
27123a7b-2059-438e-8bdd-475bee90c857	politiche del settore energetico
27162c7b-6b64-4ce3-9d4e-6a24519d117a	usanze culturali nella preparazione dei cibi
271f7921-c0b5-4812-81ad-d0fa3c28ea2d	definire il programma delle riprese cinematografiche
271af664-8a42-4c7a-9c30-c2196186e307	mantenere le attrezzature da cucina alla giusta temperatura
272031e1-e3d4-478a-82f3-493a94b7af65	utilizzare le attrezzature della nave
271f9a2a-0458-4e01-8aad-19c202998d4c	costruire campi da golf
25b14f24-870a-4ebe-aca1-2463fa0c32a0	stampaggio per soffiaggio
27308166-5d55-428a-97a1-109025cb7c4b	strategie di ingresso nel mercato
2741f852-36fe-4c70-96ec-818ba3e8000d	verificare il funzionamento dell’ascensore
27478545-b893-44d0-925d-bffaaa426948	condividere le buone prassi con tutte le filiali
274426aa-0f9a-4924-862b-cd88fac3ec4f	gestire i sistemi degli uffici
275a6dc7-3ca4-4fe0-8532-bda5898d17a6	tenere le sessioni di musicoterapia di gruppo
275a1ebd-1ead-436c-b911-caf40e1492a3	sviluppare una relazione terapeutica collaborativa
275f9431-e080-4f2d-9cd8-d70fc48254dc	riutilizzo delle acque
27657f3d-8ae1-4e25-ae52-013c10ec9ed1	svolgere compiti di vedetta durante le operazioni marittime
27714514-cbb2-417a-b907-3e1febd8089f	organizzare i raccolti
278c3af7-c61e-459b-a6b4-79c93ad097ff	controllare parabrezza danneggiati
2723eb8f-9dc0-483d-a97e-6f339a54713a	analizzare i dati per le decisioni politiche nel commercio
27675b45-77fc-4941-bcd5-fa463ac0c2f3	misurare i volumi dei serbatoi
27916d43-179d-4c20-8233-8a53e8de93ca	tipi di veicoli per la raccolta dei rifiuti
279a7cec-69d0-46d5-972c-a2f2c2c20cc4	effettuare l’accettazione del bagaglio
2794bfde-23c4-400a-81b3-1fd2f570fdbc	definire i requisiti tecnici
2793707a-d8fe-4e61-ad28-cdcef838d4a3	sviluppare le idee musicali
27abe68f-5e9f-46ff-b175-f93dfad10ea4	sviluppare piani di e-learning
27a8f482-cb45-437c-a8ea-24a2bee98778	diritto della proprietà intellettuale
27b4af5c-f1e5-4d1b-aa42-d7d8ea1eb4de	integrare i principi di allenamento
27b01f6c-6d42-4989-bffe-62fcf608fab1	regolare la velocità delle navi nei porti
27bec7d2-ecb5-4209-89a7-6e874b7eea46	etica sportiva
27ad8f2e-6f6c-4c75-9610-f29a4b2dcfd1	comunicare i materiali di produzione difettosi
27c6abd5-c7d3-4fef-afc3-3bfc0f110677	mantenere la pulizia dei servizi igienici
27cc721b-453e-41f4-92d2-ccf160622957	condurre una ricerca qualitativa
27ce7046-2b0f-404c-baf7-25654f996ef3	pulire i componenti durante l’assemblaggio
27d39b61-5536-4930-ae7b-92aed9cae505	garantire la coerenza delle traduzioni in molteplici lingue di arrivo
27d3cc60-5b18-4b02-ab02-13f73b38e79d	utilizzare macchine molitrici
27dc866d-3e91-4f74-92b5-06880c3c6fa1	valutare le esigenze aziendali
27dd8d40-eec8-4559-8c4a-56212a7508f6	controllare i livelli di nicotina a sigaro
27ddb069-4045-4df8-944c-fda1aa6e548b	produrre contenuti digitali
27cc7fe4-00a8-43cf-932d-4b04472a1013	sostituire gli oggetti di scena
27e869ec-60fb-4320-8b07-11051ab3f615	politiche del turismo
27fb8f41-04db-4f27-a850-a93eddfcf5e6	spostare gli stampi riempiti
27e87a3a-c7a9-4091-99c7-90ac09100d36	addestramento di giovani equidi
27de0c3c-586f-40ec-aee7-30c25b0752a6	gestire le richieste dei clienti relativamente al carico
280826df-b311-4228-8f97-2715b5e9de30	prestare assistenza nelle controversie
280aa3ae-c90b-46ef-8975-f8850881ba46	eseguire gettate per fabbricare sezioni in calcestruzzo
280e880c-8712-4f69-95e8-f62f13686434	modificare i testi medici dettati
28112592-a4d3-4b66-a406-790568f87e78	creare storyboard fotografici
2811cb77-0999-4d5b-99f7-a86766124269	utilizzare attrezzature per la separazione del minerale grezzo
27ff99dc-85bb-4d6f-9375-b3899dd54d91	utilizzare strumenti di misurazione elettronica
281c3f74-61a7-4be5-a22f-7b551c0f60af	coordinare la vendita di legname
281c574b-919e-4992-97f0-9966968ddfdf	individuare le merci danneggiate prima della spedizione
281f0425-aceb-453e-bbf7-a5f1e10bdad5	controllare i campi
28174ab6-7177-4eea-b14e-54d459b28bb1	verificare la pulizia della sala da pranzo
281f11fc-bdc2-4b4d-b5fd-ce0bb81ebfd9	manutenere il sistema frenante
2824900d-f62c-4be1-966b-b039186352b8	monitorare il benessere degli animali
28247ecf-9560-4b17-816a-af2a691f9409	applicare le misure ambientali per il trasporto su strada
28266d02-c437-484f-b533-f6a4b2e5b9fa	azionare il battipali
282a3eff-98e6-477d-b319-3ca0f8c7d473	scrivere in irlandese
282ccca4-befa-4de6-ad0a-111f8be1a478	monitorare il processo di miscelazione degli oli
28377aa1-2fd6-4369-b940-c2ec75415852	fornire informazioni relative all’animale per i procedimenti giudiziari
283df3fa-82e7-4584-88ff-b0b4a316e1f8	gestire i sistemi di ricircolo
282b9da7-2ce9-4f40-a4c0-c021b38a84c4	lavorare a un sito di scavo
28466dc1-3aa7-452e-8348-201f3a1a3823	verificare la capacità del suolo di sostenere il carico
284185dd-34d8-4524-a840-c9c2461ad71d	fornire le informazioni sul contesto storico
284a4a92-204a-4b33-bd6c-5fb0b40a5099	analizzare la legislazione
284c8ef9-6cc3-494f-81ff-86e6c1545078	preparare prodotti lattiero-caseari ad uso gastronomico
28557dc5-ff9e-4a8f-a9ee-25a68897c074	progettare prototipi ottici
2851f86a-dd02-4e34-9655-ad6761236de2	decorare mobili
28564c3d-91cb-4ead-abcc-03302a800b0a	sostituire i denti della fresa
285b9184-4210-4612-b85f-a11f8942b937	parti di macchina sabbiatrice
2857d14c-1f97-48ea-9b55-baf90845501f	componenti ottici
2863db8d-e6f0-44b5-b462-35400794daa0	supervisionare la gestione dell’archivio
2867851a-bb83-4825-916c-a30f669d0945	offrire consulenza su esercizi di riabilitazione
286e910e-aa27-41e1-bc77-35b888061378	essere addetto a macchine sbavatrici
28691099-89f2-42b6-9d50-63043cdcc75e	pianificare gli spazi commerciali
2884db4d-6eb5-4ac7-bc30-0bb53b03e812	prezzi dei minerali
28756668-06d7-443d-aa32-9723d33e49fe	prevenire il riciclaggio di denaro nel gioco d’azzardo
2885e6a7-2a1f-4611-ac00-ef7cbff510a5	principi di architettura del paesaggio
288a10b5-9cbe-4ae4-9ea0-86884d60b432	mantenere l’inventario degli strumenti
288d368f-4c84-41c5-b977-e79f512c1cac	creare la sagoma trapezoidale
289e8da2-0abd-457f-9cb6-9db83fdeb0f9	calcolo distribuito
288a319e-673f-4078-99ec-ad7316c06c81	interpretare i test psicologici
28a30088-3424-4702-a2d4-612a4dfd4c0e	assicurare la cooperazione tra la produzione, l’unità costumi e l’unità trucco
28a0c7b5-8e9d-46b0-909d-c0695dd26368	rivedere la documentazione relativa ai sistemi di controllo della qualità
28b5f644-f513-41d2-a4c3-f0eec456626d	programmare le forniture del centro di incubazione
28b81442-4153-4687-b419-b1ca2c2acb05	prendersi cura degli animali d’affezione in attesa di vendita
28b9f85d-6f65-4253-87f3-bad0a809c32b	preparare una sessione di allenamento per l’esibizione
28bbb223-25a9-4ac5-96ef-e0d8227a85d4	contattare gli scienziati
28b943b2-96f1-4240-9aa5-195ccd170731	raccogliere dati sperimentali
28c24d89-e560-4c81-a079-af4339692b05	conservazione del legno
28c5d3ca-0b9c-4541-9235-06d206efb1de	eseguire il marketing mediante posta elettronica
28cdce84-1fff-4745-8f44-aa3fad4730c9	legge in materia di imposta sul valore aggiunto
28cb0f6b-c6df-4d39-8281-ec48a877f97d	condurre un esame protesico del paziente
28e1aa94-60ed-4e25-9586-a56cd1408dcd	manutenere i serbatoi
28e51bae-d458-4d67-8fd0-2f0602b3e7e7	dispositivi di sicurezza e protezione
28e72069-5cc9-4678-a703-b2649d59dba0	seguire le rigide procedure operative dei passaggi a livello
28e85110-f146-457a-95d6-26529934502f	analisi delle esigenze di apprendimento
28e74b94-ab9c-4721-8039-4223d7cd95f3	gestire i rischi di spedizione
280b68a3-3e85-4b4d-a086-938686de55ee	pulire le attrezzature da catering
28e89e77-4190-484a-9f94-4abe53cbb775	individuare la causa di uno squilibrio nutrizionale
281e1239-df47-4489-a0bd-ef8384d3e4e7	gestire i sistemi di determinazione del prezzo della logistica
28eaa655-7f36-4ded-88ee-f15e5e77d94b	preparare il bestiame per l’inseminazione artificiale
28efac36-cbef-4d1a-b630-19e9e9883198	regolamenti aeroportuali in materia di ambiente
28ebf5b8-87ab-4d5b-a846-f26a6aa06d1b	gestire le licenze dei veicoli aeroportuali
28f0fa06-b428-4363-80b4-16bca67df86e	affrontare circostanze impreviste nel settore dell’ospitalità
28fa8505-3b1c-453f-a043-13959c5e0d0a	criminologia
28ee1c8e-c474-4797-a201-5ca00c52ffa3	consigliare i clienti sui prodotti del legno
28fd5c41-f1a8-4c65-bf11-80861ca1dc5a	seguire le procedure in caso di allarme
2900de1f-7bac-492f-bc08-f2a22892bb02	mantenere standard operativi
2850efa5-caaa-403a-b3ec-fa16c099fb7f	coltivare il luppolo
28fdd81f-2f87-42ad-aae6-8fc7d425352b	fornire ai pazienti servizi odontoiatrici amministrativi post-trattamento
290f45e6-6e76-4ec7-bd7e-9b0fe7afa89c	fornire istruzioni durante le sessioni di musicoterapia
29065a35-4b0c-45d9-a873-adf3b9ce14c1	armonizzare i movimenti del corpo
29165697-afa2-47e2-aae5-8d718948a6d6	coordinare le azioni del piano di marketing
292551e9-7a41-43a7-81e1-b59da78f5fe7	scrivere in cinese
290953fc-26ee-459d-9216-8228d9558978	pulire il petrolio sversato
2926c627-07c3-42b0-bcfd-200198c7837f	essere riservati
29273bdc-e6b2-4c87-99a5-d6455dbb217a	progettare computer grafica
292baef9-519f-456b-bab6-88691ac3bc27	sviluppare le campagne
292c17f6-439e-4e3a-8106-60f9edbe22b3	assemblare batterie di automobili
293736bb-95dd-4859-99e1-75dce3ab64ad	diagnosticare le malattie del sistema vascolare
29402199-e192-4de8-afdb-bacfe807d177	gestire la documentazione per le merci pericolose
2934f20c-e86e-428e-b7b9-30ec2a13cbea	coordinarsi con i dipartimenti creativi
293a3004-eb01-45d4-b0a3-d9171bb7f4cb	registrare il chilometraggio e i consumi di carburante
2942be98-0687-40ae-874f-47ad46f250c1	correggere le prestazioni sul lavoro dell’assistito
293a8509-586b-4db8-87c5-c92f4eea1be6	qualità degli articoli di pelletteria
2951b40d-5a54-47e3-bc70-92794cb80568	preparare prototipi di produzione
2955ef2b-2d1d-4c81-a498-e37fedec1717	sviluppare le tecniche di coltivazione della vite
2949860e-677a-4949-a97a-f9d0535e5b31	redare relazioni sullo stato delle opere d’arte
29437f02-b362-411c-b358-f085a7cb6d41	assicurare le ispezioni degli immobili
295729ba-3320-44e0-a067-a3281082e9e0	proteggere le aree naturali
294b343d-31ab-469d-98ce-377ce47089bc	rispettare le scadenze per la preparazione delle azioni legali
29631f37-e264-42e7-a180-a67aa5d5a3e0	predisporre la sala visite per il trattamento radioterapico
29692f59-4a77-408d-935f-838ca407a9e4	attuare i regimi di alimentazione dei pesci
288d3a69-5aed-40ee-8e42-b346191abaac	utilizzare il controllo climatico
2960788d-5acd-4d04-b808-3d6657c26bfb	fornire informazioni sull’acquisto di animali
296f3338-cb05-477c-a219-121c0ea189b0	supervisionare le attività in piscina
296e8236-3e42-495f-826d-5e4e4c0e56b2	amministrare la logistica multimodale
297996fd-4211-4d66-9a27-2bea508b8771	garantire la manutenzione dei veicoli ferroviari
297b7793-2fd1-4e13-a430-e05b07c316ca	logistica del trasporto multimodale
2989aaab-3cb7-4263-aa43-3bcaedc245e7	offrire consulenza sulle procedure per il rilascio di licenze
299101fc-d2d0-407e-bd5c-796160bf72e3	utilizzare apparecchiatura di perforazione
29937ef8-5db0-49ef-aa58-2e41e7a89542	applicare i metodi della musicoterapia
29878b13-ed1d-4f38-bc77-453f7c236566	determinare la struttura del magazzino dei prodotti di pelletteria
2999e324-db4f-4ee0-b0a4-ed5d189fd6b2	negoziare gli accordi di lavoro
29a33b96-dd2c-43e4-8398-7ee1dd5c95c0	valutare la natura delle lesioni nei casi di emergenza
298e2a72-bfef-475e-8ce1-6d495255eda1	dare un seguito agli ordini dei clienti
2999eeb2-be54-40cb-b927-d39a5f7b4057	valutare i rischi patrimoniali dei clienti
29b97e9e-cc71-486d-915d-68ccdbc11a40	gestire i messaggi ai fini della fabbricazione di capi di abbigliamento
29bf1841-90a3-48a9-ba75-2c987100d732	creare immagini con carta e penna
29c867e9-da60-48ea-ad53-ae4e662353bf	gestire i finanziamenti governativi
29ba0fe7-c1be-4a75-bac3-5929032652ac	utilizzare strumenti online per collaborare
29d64a2f-7291-40d6-837a-43b63cf8138c	salute e sicurezza nel settore tessile
29ccc961-cf0e-4fba-9984-cb29a2956584	scegliere uno strato primario adatto
29e79a30-19c4-418e-82c3-7b36e66d7be7	elaborare gli ordini dei clienti
29df4a26-afaf-4414-a25a-02b4b3e30911	assumere il più elevato livello di responsabilità nel trasporto su vie navigabili interne
29f5c4dc-c235-4802-97a2-9567f06af7d1	fornire assistenza alla comunità
29fc21e4-3c79-43a2-9066-350786478795	regolare le macchine per la lavorazione della gomma
29fdbfb7-958d-4dd5-a8c3-69b565cf72d4	interferire con le comunicazioni del nemico
29fcd7b6-c307-48e2-943c-e6bbc14ea1ee	riparare i macchinari di avvolgimento di tubi isolanti
2a0829d5-7b50-4328-8ad4-6b69911984e7	tagliare le lastre
2a1f5ca7-3529-4601-bb44-25420900334d	fornire assistenza all’opera missionaria
2a023ad6-ae33-467e-b3e8-2b856188f5ad	interagire con i clienti nella silvicoltura
2a25d985-c6a4-4f01-81d8-485a75f48cd7	valutare i beni pignorabili
2a29d87e-1000-4983-9ea7-6cd3f4ee5d4b	pubblicizzare una collezione d’arte
2a21b306-ecf7-4e02-8dd8-e253fd67f4cf	indirizzare il cliente nella scelta dei prodotti
2a35a12e-4c76-4a22-98d2-09d43a5e15f2	consumo energetico TIC
2a3defa9-7917-4de3-8245-c1a885405b5e	regolare il proiettore
2a4b273b-36b0-47f7-b862-b62c7fee4987	dimostrare i giochi
2a2e8e3f-4ee2-4a58-896f-bf2d1e72443d	terminologia del bingo
2a58c9ac-e560-4374-9dd8-b06ec1d9720a	tipi di serra
2a64c9f8-0699-419f-ad1e-b03af6e7fa75	inserire le strutture delle conchiglie
2a5ec464-601f-430e-965c-2ddb27327354	processi di musicoterapia
2a63efb5-a392-433c-bef0-899dd11d08f7	ottenere informazioni sullo stato di salute dell’assistito
2a6a3290-4720-4f13-8558-a6edcb9efcbc	levigare wafer
2a654087-9f5d-4765-a7a5-734b6354b690	KDevelop
2a6e241b-17be-4e8e-94d1-973175591396	accompagnare gli studenti durante una gita scolastica
2a6ecc25-ef22-4883-acea-cc24088f6732	descrivere le scene
2a842396-0a48-40f6-8db9-a38c9bc330b2	legislazione sulle piattaforme petrolifere
2a6fcc76-7210-4e4e-9bd7-b99baec442e6	processi di innovazione
2a758073-c206-4f7d-9d04-76ec84c762e6	schemi circuitali
2a865be7-6c4e-4245-ad85-2277d9a8e294	eseguire controlli alle macchine idrauliche
2a88222a-9f4d-428c-b940-3918513262f4	installare il sistema di protezione antighiaccio
2a86ff70-84e2-4eb9-aca9-d5d485aa70b1	elaborare i programmi di formazione
2a8cbc2e-0db0-44c3-b939-2d25bb443371	elaborare un programma di dimagrimento
2a8f6384-eae5-4301-9240-370867b1e7ec	tecniche pubblicitarie
2a94a85e-cb79-4d1a-856e-08af4d881301	installare dispositivi di sicurezza
2a9434a8-12c8-462a-9709-f4035ac17b20	mantenere i contatti con i funzionari sindacali
2a8f606f-4c64-4943-a965-d0d12097ec24	condurre prove chimiche sui metalli di base
2aa8d0e2-8e59-40d9-b353-447a3df5046f	classificare i materiali di biblioteche
2aa9494b-2204-4332-a774-16f947d7d802	rivedere bozze
2a9f7096-aab7-4411-a5cb-d21df62bdffe	registrare le modifiche alla coreografia
2ab8728c-7311-4e98-8deb-56f60e709c91	azionare una lavacentrifuga
2ac0d7f7-6172-475f-8244-ac4a1f7724f2	identificare tipi di abrasivi
2ac4c6cc-a36a-45e8-a4f8-82f733027b3f	trasportare i pazienti assegnati
2abf2201-5c90-4e47-936b-4ae66b0dfcad	effettuare le operazioni di segnalazione in modo sicuro ed efficace
2ac158ae-324f-4afd-9ce2-dcb4b47d5b98	curare le risorse della biblioteca
2ac801ea-136c-4183-a645-0a16ca2dc8f2	gestire i contratti di servizio nell’industria di perforazione
2ac14413-07e1-4abf-8962-0ef09a50a18d	analizzare il rischio finanziario
2acacb3e-6fa1-4f72-9019-7afe7b842baa	utilizzare una fresa da miniera
2ace8f6b-3494-4cd7-b662-b39ae3c60af0	fisica
2ae0a35f-fc5b-4df9-8c5e-5aacc26f50a2	ricercare le procedure fiscali
2ae64601-a961-41f1-89b0-34e2f9b857c4	gestire le malattie trasmissibili
2ae1716f-ba14-4d9c-bec1-9bb9ccedb43d	esprimere le raccomandazioni in materia di nutrizione ai responsabili delle politiche pubbliche
2aded2b0-e3e4-492b-ac6f-6532155d8d0a	eseguire i rilevamenti per l’installazione di gasdotti e oleodotti
2aab35f5-feb8-4168-8062-12c30270bf1c	eseguire attività di ricerca su utenti TIC
2aea3ce1-5275-41fb-81d8-b5f826821ab7	tipi di piegatrici
2aea0b06-44d8-475b-9412-bae4b197b7c8	identificare i punti deboli nell’interazione con i clienti
2aeabacc-680f-42aa-bd53-aa4a68eba025	scortare gli imputati
2b0e0fda-c0a6-4b53-8e3c-f611751d5048	processo di produzione di film
2b115fe5-5f92-48d1-b511-a46408a92a80	istopatologia
2b0f74d4-b58b-4eea-94ee-4434bb8d6c1b	dimostrare un atteggiamento professionale nei confronti dei clienti
2b107beb-3288-4f2b-89e4-6b3999f1128f	supervisionare la produzione del suono
2b11a2cf-5f39-4672-8cba-09569fa29a67	applicare il colour grading
2b09b003-96f9-42fb-8af5-699d54f1d738	effettuare la manutenzione delle attrezzature di segnalazione ferroviaria
2b009fb0-eb53-4d61-948d-a3bec7271743	offrire consulenza ai clienti sull’acquisto di elettrodomestici
2b1b10b4-44a5-4056-ba2c-90594209b303	riparare le attrezzature di vela
2b1760c6-4bff-4fee-b911-1bd9dc9cc060	gestire l’igiene animale
2b3226e4-c3ba-47f4-9764-2a055fc967c0	monitorare i conflitti politici
2b397969-c949-46ca-9125-badef78a61a2	invecchiare le bevande alcoliche in cisterne
2b36d950-7546-4e6b-b35e-452a48dc59fd	industria dell’intrattenimento
2b35e88c-5db7-423d-9359-850ecbbb7145	controllare le comunicazioni di viaggio
2b4d8b1f-5d6d-4285-ba21-4fcf5d833ffe	analizzare la migrazione irregolare
2b4d845c-8fe6-48bd-83cf-013429180e3f	creare nuovi concetti
2b52ad37-2c4c-4c28-962f-e75b23b96bcb	diritto delle imprese
2b5cc28a-2d2d-4015-aa2b-df31dcf4ed6e	dimensioni delle scanalature
2b5e2f68-88cc-4f1d-87d6-1f802577b987	ingegneria dei trasporti
2b572713-3a9b-4d14-b742-7755008f5427	lavorare con gli autori
2b695571-f1c5-4d6e-82e6-d4387c91912b	strumenti di architettura del paesaggio
2b6180a1-d1fe-45bc-bdc7-8b30b623d795	fornire informazioni sulla gestione di casi di avvelenamento
2b821ab6-588d-43d4-89a1-e92776bf6870	gestire la suinicoltura
2b760a96-d23a-48de-b663-b429de577c24	generatori elettrici
2b7b1d64-d67e-483f-b4cd-22a12feb8f85	sviluppare i regimi pensionistici
2b7d18f8-08ab-4a45-a885-383ebd620d0e	fare la toelettatura ai cani
2b8b2aa9-f1ec-41a0-ae93-1bc411664d40	assistere le persone bloccate in spazi ristretti
2b8db378-5153-4f8a-a4e6-92cd857c6dcb	utilizzare i sistemi di allarme ferroviario
2b9489bd-7b8e-432e-8a92-12fa91fb48b9	design industriale
2ba0ce5e-e6eb-4478-89a8-a5ac806c2519	fornire assistenza al check-in
2b9e39bb-26cd-42d9-9691-fa266d670d6e	usare le attrezzature da bar
2bc25be4-1b19-4975-9998-801734d0685f	specializzarsi in un’area della storia
2bba77c6-57b9-4386-8524-56ae8f2928fe	pianificare i menu
2bcfb6b7-08fb-489b-b665-fc66e205a7df	fornire consulenza ai clienti sulle nuove attrezzature
2bb56737-ed5c-4fc7-ade5-12aafbe6707d	gestire i ritardi nelle restituzioni
2bdd3224-f55c-4c91-8896-a65451f508bb	partecipare alle prove di abiti
2bd5a399-58f4-4459-a893-5d45ac1781c5	preparare gli effetti scenici
2b9a8c1a-b64e-4ce9-a23c-eb083f0b330c	elaborare un piano di ripristino del sito della miniera
2bdd653e-ef5f-4a9b-b274-17c42059adfa	contesti socio-culturali in cui sono tenuti gli animali
2bca8492-3075-4c13-bca7-c3a294c1aca8	sistemare le giunzioni della moquette
2bdf47b6-bff4-44bb-a4b7-fe4244f94a2a	utilizzare una console di mixaggio audio
2bdd9119-81fd-4a77-ae96-4a0496b1f879	elaborare una strategia traduttiva
2bf1ceab-35b7-46e3-bf90-417148a4f729	omeopatia
2be90ca3-e9ca-428c-92bf-19921f952bc9	mantenere i contatti con le organizzazioni sportive
2bfaec8e-c34c-4338-985f-c5636498f37f	guidare ad alte velocità
2c0c74ea-5b82-49a8-bbeb-b6559f8d2846	processi di lavorazione a macchina con abrasivi
2bfa38ab-171b-42f0-833f-a7deec1b992b	individuare gli obiettivi dei clienti
2c0eb4f8-6587-4e14-a66e-14a37e14c19d	interagire verbalmente in albanese
2c13b4d0-78f8-4ea0-95c0-c2b2dd1fec6f	supervisionare le operazioni del campeggio
2bf5ba9d-6146-49a2-b9a1-3669f47f6c3b	gestire la capacità della flotta
2c1bccb3-f551-4116-a6f1-23ae43ec9a6b	comprendere la situazione dell’animale
2c29ec82-7872-4049-bb70-9fd23da73808	accogliere richieste speciali relative ai posti a sedere
2c242c96-1850-47cf-b82e-b9d399b10338	acquisizione di animali
2c217dc5-a316-4753-b1d1-2ae01cb7301a	software per la gestione di collezioni
2c1ffb96-5a39-498e-8837-1e805cc99b1f	rifornire le cabine degli ospiti
2c1f3131-ec57-4317-878c-3820cc0c8b62	applicare le politiche aziendali
2c33d587-d5ff-4405-bb2d-7be565393b90	politiche dei casinò
2c35bbe8-f19f-49c9-a729-9a20d71cf93d	dermatologia
2c390520-a593-4672-9bb4-1a6d60fa8697	tecnologie di incisione
2c3ecc5b-212b-4ac1-9efd-f5ed1f6e1a3d	comprendere l’hindi scritto
2c41bd47-27d8-4db9-ad3b-74ea98d64af0	utilizzare attrezzature per la lavorazione della carne
2c3db7d8-f88f-41c4-9935-e0af3d200ec4	somministrare la radioterapia
2c428240-04fe-4196-b9ae-50f26cf5cae0	topografia
2c4bab15-1658-4655-a808-4bfd2bc86b8c	essere addetto a filatoi
2c509cb0-c124-4838-89b8-dfa130a561f8	sensori di rottura del vetro
2c39acbf-ff1f-4282-af21-8412010f6a74	gestire i reclami di gioco
2c512f1d-15d4-4e8e-81eb-715d8acb729d	pianificazione strategica
2c51cddd-354f-4f8b-894c-fb308163f6a5	tecniche di applicazione delle lenti a contatto
2c631361-c2f3-46cf-8ec2-61f61b283152	ricerca di mercato
2c5fead4-e280-45fd-a825-2be2bc6d2652	accettare le proprie responsabilità
2c594785-63ee-44a0-beb2-4273fc70e56f	processo di macinazione di cereali per bevande
2c6789b5-9bd7-4d08-9f2a-4910ed2ab703	agire discretamente
2c6cd1f6-9971-4d6c-85b5-657aa7ddee70	essere addetto a presse raddrizzatrici
2c6bd823-3786-4e05-b40a-a948c5732ded	gas naturale
2c763587-f5f1-4b35-816f-681f3ffd9215	controllare le consegne alla ricezione
2c8210f7-d916-4e2f-a845-4e33b94004d5	promuovere il lavoro dei giovani nella comunità locale
2c8640aa-2067-4d86-8ac4-4d1919711650	climatologia
2c892d28-238e-4531-af88-c36d2d13fa0b	immunoematologia
2c911032-e3f9-4df8-b4fb-e6a0b7814da7	vendere biciclette
2c90d0c6-33ae-43dd-a7ba-ff4105ae62a8	supervisionare il personale odontoiatrico
2cab46f3-90f2-4235-b946-8498656eaf2d	sviluppare le ortesi per i piedi
2cac7816-195e-4e8a-8aea-8eec6964945f	effetti collaterali del trattamento di radioterapia
2caf4fc0-f72b-4f76-bcfe-7fd8f8499d27	fornire assistenza agli studenti internazionali
2cbf5c93-b0e6-44ad-b32d-8e1fbb2441a0	interagire verbalmente in curdo
2cc1fd63-edba-4a59-a11b-15c9f4b01b3a	applicare le tecniche dell’ergoterapia
2cddea6e-0ffb-4dfc-9d11-411e768301e4	manutenere le macchine da miniera
2cc101a7-ce54-4471-9321-f3098898e876	MDX
2cdfa0ef-68b6-4a43-a688-6766d0a5c885	proporre i capi di abbigliamento in base alla taglia del cliente
2cdf8319-ddf2-471f-bfab-e8ae2cb66caf	fornire una formazione all’assistenza infermieristica specializzata
2ce66502-b707-4e47-94e9-0a2bbc6c4b3a	supervisionare gli spostamenti di artefatti
2ce15ca5-ec8b-4d8c-8e7f-d93d8b460f2d	insegnare il linguaggio dei segni
2cec322b-dc82-41a7-8904-09fd628ac5f9	etichettare i campioni per il laboratorio medico
2d05b4ff-2498-4cc5-b1e3-fbadec2c107d	radar
2d028a15-ca85-491e-8499-972b53d06416	negoziare l’onorario dell’avvocato
2cfd5a5e-9146-4ab8-a091-a2ece241809b	appalti elettronici
2cd01f77-6712-4cf5-ac54-580f1a4fef13	mantenere le registrazioni scritte del carico
2d082f8c-43f8-4898-8c8a-a348a2167d8f	intervistare i mutuatari
2d13e0ee-4879-4c02-8c8f-04f50d1aed45	definire la configurazione degli strumenti
2d0af08e-f962-4073-8724-0bf810bb2140	diritto dell’occupazione
2d1403c1-1779-4db3-94c0-ba34e1231134	valutare le informazioni spaziali
2d1f0c8d-5509-437e-8013-60e2fe367352	proteggere le superfici durante i lavori di costruzione
2d35917e-5663-4577-86d0-3240d21d02a7	applicare i regolamenti riguardanti i motori delle navi
2cec7439-36b0-4a74-9941-27b36336a955	Aircrack (strumenti per il penetration test)
2d3cd3f8-387d-4d7f-9216-b690f54d02c2	eseguire uno studio di fattibilità
2d3990ef-1538-4e97-8885-c53817373d55	vendere i servizi di formazione del personale informatico
2d361ead-5a61-4719-9385-422cda3eba8a	coordinare le attività di trasporto per l’importazione
2d3a56b0-53ad-4ff7-84c9-a3614ea9dc13	calcolare il quantitativo di carico su una nave
2d3f6438-9651-40bb-a85f-d41a3b49507c	combustibili fossili
2d4de5b5-9357-453e-91e6-98655a94de4f	usare il microfono
2d5c4cc7-fee0-4f0b-8758-67c7004b62e0	competenza in materia di formazione professionale
2d48c217-8215-48b7-9b56-3dea84e8fca5	lavorare in una squadra di pesca
2d5dd905-fd6f-489b-a00f-ac6ea7a69a66	identificare le lacune nelle competenze digitali
2d5bf183-8eff-4112-8573-635ef2b9eeaa	adattare i costumi
2d613e8f-4e69-4ed3-be6d-c50812379a50	pianificare le misure attenuative degli incidenti ferroviari
2d642eac-6e0f-4069-8967-35bb7c4df38d	sviluppare un quadro artistico
2d763100-0518-4fd6-a89b-e78e9b0074ef	comprendere il punjabi scritto
2d76fe38-21fb-452b-b4fe-a7a5bc4f1743	preparare la camera del forno
2d66dbca-7816-4d01-9478-8edb7048663d	pensiero sistemico
2d7b791b-fad0-4e0b-a35e-a684fd2be508	biologia animale
2d7e7fca-a8cf-4c81-8017-9a08c1c966eb	sviluppare una collezione di calzature
2d93437b-51b4-42b9-a4c6-2495fd85fe4c	utilizzare le tecniche di riscaldamento degli alimenti
2daaf2c8-c0dd-4bb1-bddc-7bf18467ef38	infiggere pali di legno
2daa1944-1135-4fdc-a4bf-231c57f864a5	eseguire test ICT
2db023ee-d6e3-48c0-9f4d-89219c43dc28	ceco
2db45a50-42df-43ac-a2d7-2089fdac789c	reagire con calma in situazioni di stress
2daa597f-88bb-4d05-9a1d-4d0f1f234d95	controllare le aree di parcheggio per mantenere la sicurezza
2dc45d2b-91f1-4fea-8993-21b17eafa930	analizzare le colture cellulari
2dbdc4ab-b2e2-4d4b-86b3-c61f3cb4d045	conservazione delle foreste
2dcfd064-44f3-45f4-8e62-c015fe19ac2c	pianificare l’attività di toelettatura per cani
2dc5b402-b982-49d3-a8b9-baaaba4ce99e	dirigere la preparazione del cibo
2ddd42ea-70f2-48d7-a7b1-74d25aeda21c	promuovere l’adozione degli animali
2dcef5cf-b486-409c-a3b9-3be31bf40b95	calcolare la pressione di irrigazione
2de0dad1-10be-41ea-bb51-f5d4aa70f4f6	progettare sensori
2deaf1e9-0b74-484d-bbf0-666697ae4884	valutare le domande di licenza
2def8329-0da5-461d-a21d-846ebb745c4e	neurofarmacologia
2dee74ce-40ef-48d1-8c1d-967ee753e283	legislazione in materia di sicurezza in miniera
2dfbc711-7a37-46a5-aa48-6366f19cd9f9	eseguire la fermentazione delle mele
2ded8b5a-17ac-47a5-bc2e-95bad9b955ce	assemblare i componenti
2dfbda73-655a-44db-a0ad-1f2f82357e41	gestire esplosivi nel rispetto delle norme di legge
2e017498-50d6-4a56-b179-3663b4aadeca	preparare i discorsi
2e014d8a-c6fb-4dc1-a12f-72720eaeaf09	stabilire i progetti di programmi annuali per le navi
2de79875-1bf1-4b0a-ba38-1af179564b6d	sviluppare strategie di risanamento ambientale
2e127e58-f0a6-44ab-91d4-77f33712931f	gestire gli oggetti smarriti
2e0f04ef-ab65-4e20-9bed-d0fb49aa64cc	calcolare la pedata e l’alzata dei gradini
2e11a31d-2ef4-4109-92e3-eba066ebc45f	installare luci automatizzate
2e1e9a9f-d98d-48e0-9024-3b7e5c07c00f	marcare un pezzo metallico mediante punzonatura
2e06460e-7b81-4944-91bf-13d72ab0e240	individuare le necessità dei clienti
2e3ddf02-d4a7-4c1f-8fef-edfc53c19013	neuropatologia
2e3cde51-77c1-4f9c-9fc9-1bc530f9c180	effettuare la manutenzione del suolo
2e438504-ac25-47f5-bb37-75a53ef8dbb9	minimizzare i costi di spedizione
2e3ebb9a-4540-4d6a-a662-477211bba1a6	lavorare in un team di trasporto ferroviario
2e4878de-1a13-48df-b9d1-50f20821a86a	garantire il rispetto delle misure di sicurezza negli aeroporti
2e2ceed3-1ed6-4336-896c-fc1fa5bd494c	promuovere l’architettura d’interni sostenibile
2e4dea0f-762d-4624-a3ac-d0ecf69cd4be	consegnare i volantini
2e27cad7-e443-43d7-b934-9caf3ee4e2c9	pianificare attività artistiche di gruppo e individuali
2e62ca6d-7a40-438f-abd1-877c4cfb2099	impatto dei fattori geologici sulle attività minerarie
2e6bca63-2053-41e4-81cb-353d09d13b3e	installare i corrimano
2e70d393-b48c-4a39-980e-a255f89e9bbc	idrografia
2e57074e-55c6-4a81-b4e6-61641cdf6738	vendere i prodotti di ottica
2e5b585a-4dab-4863-8078-00f9277e854c	calcolare il peso dell’aeromobile
2e827213-9add-4b67-bb9c-a60d7fbb36db	contribuire a pubblicazioni specializzate
2e8192f2-9e1e-4870-a171-6f301a6f3a74	essere motivati a vendere
2e7a3487-991c-4d54-beca-05382f26e6c6	utilizzare il controllo pirotecnico
2e83c9fb-854b-4b1c-b26a-1ca8ca82c677	rivedere le certificazioni per il trasporto di merci pericolose
2e73f0d3-e793-43a8-b3d9-3083d744f2ec	offrire consulenza sulla gestione dei rischi per la sicurezza
2e87cf05-141e-442a-b264-60942b07469a	tipi di strumenti ottici
2e8a4de9-e1d9-461e-a6ce-2fc792bb01ac	preparare gli strumenti per gli spettacoli
2e9c0291-7644-46bb-8efa-5a879c54f615	direct inward dialing
2ea4d4ea-2b9b-4a27-b360-209f9d6d512f	gestire l’assistenza clienti
2ea6187f-28f2-4e31-95e7-de34ed882d6d	monitorare il servizio di gasdotti e oleodotti
2e98fb22-57bd-4886-b320-934aad7185a5	controllare i forni a gas per la tostatura del malto
2e97912b-a747-4160-b11b-5814142c9be1	comunicare aspetti tecnici ai clienti
2eae4397-65b7-4f83-9319-de02ce3fcf0a	seminare il terreno
2ea2a6d9-ca98-455b-a7fc-58e0e2a99ada	mantenere aggiornati i servizi di gestione delle informazioni aeronautiche
2e934f9c-37c5-467f-9db6-ab52b0e3242e	Smalltalk (programmazione informatica)
2eb39734-e8de-4a08-bacf-adbb36efccee	psicologia
2eb4a2a1-2f7b-48ce-b39a-94ce666dfbf0	riparare un mulino a martelli
2ebdae45-c0f9-4b8e-aba9-2c23fc144514	scaricare il contenuto in una vasca
2ec8bc65-2412-451b-85e7-d89fc6d05758	osservare i caricatori delle merci
2ec4355b-432b-4758-89e0-87e80470a7a4	componenti per calzature
2ec21184-046d-4b3d-b166-dcb170ac5c81	LDAP
2ecec4b7-54bf-4837-84b5-75a42996eeb9	assemblare stampi
2ed4dcc9-90de-40be-b401-4ba7e4beef04	effettuare la manutenzione delle attrezzature del centro di incubazione
2ee5e694-4390-44ee-9947-1e3c869c3543	comprendere il francese parlato
2ee8cd20-611f-440a-a60b-251239a13a1b	progettare firmware
2ee970d0-6207-449d-8a30-fb2c12f2bc16	architettura paesaggistica
2ef37068-4f76-40a7-bf6b-e441d966cd0d	modellazione 3D
2efa922d-c618-4f1c-8008-d30d19894438	condurre gli accertamenti preoperatori
2f03f4d2-6204-48b6-9454-c2489340b430	tipi di cartucce
2ef6fc05-73d9-4b30-b1ef-329a92b9af47	meccanica dei fluidi
2efa9ff1-986c-4275-8d91-fa0d653aecbe	eseguire le ispezioni di sicurezza sulle apparecchiature di irrorazione
2f15d13c-e3b4-4bf1-a17b-5edb25e15968	garantire la sicurezza del gregge
2f1c9df8-472e-49ae-bbad-ffd49bf76cef	assegnare i codici ai prodotti
2f1f7bbb-b60d-4636-84b9-de75380f1fd6	ammettere metalli di base nella fornace
2f25b0b6-de58-45bf-9083-9596b340a2dc	insegnare chimica
2f228b34-94f6-4837-910c-7b76b1c6f3a3	condurre presentazioni pubbliche
2f289516-90e0-46c7-98e5-01760ba450e0	taglio del vino
2f25f983-0388-47fa-8398-8ee1413c98d5	insegnare le tecniche del servizio assistenza clienti
2f2d38ee-2607-4928-9803-95ceca76d233	progettare sistemi informativi
2f379559-8b94-4207-87f2-d849c7be776c	maneggiare le lastre di vetro rotte
2f37ee7e-0315-4fcb-9b8f-94054f64ac3a	vendere gli pneumatici
2f3a5a97-c30e-4040-8be5-9e28ec27ff92	individuare difetti nel materiale
2f4fb711-284b-42ce-adea-07ff00fc7520	componenti di strumenti odontoiatrici
2f4e0756-22de-45f8-9ecf-45136d747e90	azionare una turbina a vapore
2f33b16d-1397-4b06-b847-e667dad47c99	software di editing grafico
2f430f33-1956-4a64-b39d-a8b0b9962878	analizzare i dati relativi alle operazioni petrolifere
2f5b637e-519a-4b93-8363-6c808cf64810	fornire consulenza genetica
2f550bf4-90c5-464b-b19c-4692e982b8c3	rendimento energetico degli edifici
2f5822c4-53cc-436f-b5ee-c52b6aadc03e	mantenere l’ordine e la pulizia di suoli interni ed esterni
2f66aecf-87a1-40e0-be47-fbab562badac	scienze di laboratorio
2f6f153c-cede-46a3-9215-443416ff1e53	produrre abiti da uomo
2f773608-2796-4b7a-afc7-0ef81b53a7f0	abbinare i veicoli ai percorsi
2f75ed28-2515-4bea-8c1e-6a33fe66e0e3	commercio internazionale
2f622fd8-46f6-472e-8123-ceecde85e84f	manutenere le parti delle anime
2f81bd73-4c7d-4799-ab32-a634f44fcdc1	sviluppare nuove tecniche di saldatura
2f813178-3a89-4408-a5e0-8278e627b645	dispositivi medici
2f8aba25-3da7-4d46-b428-fb30404d2d53	installare organi
2f85e1f3-54b5-48d8-9b4f-1042096883b9	eseguire i test di routine dell’olio lubrificante
2f8b4564-e517-4c37-bee7-661e056f2091	relazioni sui risultati delle corse
2f8c3661-82bb-4473-9746-e85b98833f46	caricare i pallet
2fa09d6d-0466-4cbf-91be-c83d8987c830	legislazione sugli articoli pirotecnici
2f969bbc-ad94-4c94-b30c-b1c2e0647a5f	scegliere il tipo di trattamento disinfestante
2f99b1cf-3923-4d69-9fc1-d92d3bf8fe48	scrivere in olandese
2fa2dfc8-b58f-444a-b6c2-4ea206ec8773	ottenere il malto dai cereali
2f53bca7-c82e-4e5c-9553-f4e9f603d826	analizzare le caratteristiche dei prodotti alimentari al loro ricevimento
2fb03a0e-0778-4edd-8e85-ed47a11c3ca3	definire corpi celesti
2faeeb5d-29e9-485c-8138-623f76903c88	gestire la banca dati degli iscritti
2f9dd538-5c9f-488b-86e3-9be9b5fd47db	programmare la manutenzione dell’impianto elettrico aeroportuale
2fb5dd0c-aa43-4e03-97fe-c26287c17257	accendere i bruciatori del gas ausiliari
2fba36f4-30b5-46dc-96f0-a2ad055fcaa6	industria degli articoli di ferramenta
2fc5b9ac-27fc-4064-acd7-22749e80d4fb	imballare frutta o verdura
2fa8b73a-0038-42c8-b889-51202fd4124d	installare le attrezzature di trasmissione
2fc86380-638b-4e1c-a9f7-57ed585a90fa	lavorare in condizioni esterne
2fdfb640-68f2-4b11-b43e-2cbe2941bb85	materiali da stampa
2fd7e244-258d-4dd1-ae70-a800875817cd	aerodinamica
2fcf1d7c-4fe6-48ee-a54d-385310ec10a3	impartire formazione sui casi di emergenza
2fe71165-d121-4c77-8f38-525e2d4b7c13	parti della pistola a spruzzo anticorrosiva
2feb818f-5e93-4895-8536-11413b17b446	montare le strutture capriate
2fe2f414-62a5-4889-bcab-8fa1e52fcf3d	meccanica dei treni
3006cbc2-e3a7-4634-a0dc-62528d5ed1f9	salire sulle automotrici
300dbc23-f0b9-4ef8-9be3-57b0ba89594d	danese
300da4b3-563a-4859-99cb-b9fb2836f983	praticare l’idroterapia
2ff8758f-22d8-4c13-87a6-b6d485d54637	gestire il rischio finanziario
2ffb1dbd-3905-4702-b077-aebab54c61d0	produzione di strutture metalliche
300f8030-fd8a-4ec8-9e4d-1967844be025	preparazione per il parto
301ce0dc-cab3-4b14-87a7-eabab506bab4	tradurre la colonna sonora
301ab185-6f03-47b3-95e9-083ebe1490cb	fabbricazione di mobili
3022493f-cc61-4a8e-a19f-976ee66a7094	sequenze numeriche
3020f17c-316e-47b2-8b73-7aa28239c8f6	eseguire i controlli di routine delle operazioni di volo
30329f09-fd69-447f-b60e-a8eae8eaecd0	offrire consulenza ai clienti sull’abbinamento di bevande alcoliche e cibi
303ab12c-d61e-4f4f-bc78-2309a9b3dabe	compilare dati GIS
30504c82-c3da-43d4-b165-77a97912de04	eseguire una revisione del codice TIC
30542b91-c437-4b2a-ba2a-9f30df534212	attrezzature per la fabbricazione di calzature
305ce6da-2dc4-423d-9a98-9fc69cfc7288	iniettare schiuma liquida
3048231a-9dcd-4444-89ff-91e2b86da4ee	Adobe Illustrator
3063f680-b74f-41f6-97f9-9dba86f9f0e3	mantenere la disponibilità di pezzi di ricambio
3065fbd8-5763-45ce-a8c4-05b3b5bcd65f	rispettare le regole di guida dei filobus
30559238-0930-4c11-83a3-2ef50ed94059	esibirsi per un pubblico giovane
30710e88-9abd-48c5-b2c6-9922f3d464c3	garantire una realizzazione di viaggi priva di incidenti
306bde35-7987-401c-9b5f-bca4d856a399	effettuare l’accettazione dei passeggeri
306ab0f8-4bba-468e-a54a-603e7c6dd4d9	testare le prestazioni delle centrali elettriche
30751b1c-bb95-412f-8379-c58a3a0c69eb	analizzare il contesto TIC di un’organizzazione
30826475-389b-408d-9e77-2fd0d4f6d195	controllare il flusso di pietra calcarea
308081ca-34b5-4d61-a7ef-0beeb46410ab	selezionare i modelli di incisione
308380f1-e315-4e6c-8d98-215f9a4d18b5	utilizzare gli strumenti delle scienze della terra
308666d5-98e7-432e-8e07-c49294ddb090	supervisionare le attività del sistema informativo clinico
3088972a-a0b6-4f92-a813-554c207a621c	selezionare le misure di controllo dei pericoli
309afac6-a247-4c2a-9fae-e1f8da729463	partecipare ai giochi per distribuire i giocatori
30a69a33-bf32-4fcd-b803-c409bdb263b2	risoluzione di problemi mediante strumenti digitali
30a6d345-95e6-447a-a434-c6526b019e97	monitorare gli interventi all’aperto
30a417ca-fe40-4742-ae4f-6d3fabb7b718	dirigere un’équipe nel settore alberghiero
30a7ff1f-deea-4147-9a21-4d6a4c197e91	riconoscere i rischi che presentano le merci pericolose
309b4cb5-b53f-406b-b6fb-2c8d0a9242c6	fornire informazioni ai visitatori
30ab9de5-fde1-4c69-8f47-48d5dce00267	interagire con le parti interessate dell’aeroporto
30abc30f-344f-406c-81e4-8bd1ff90dc0d	mercato degli elettrodomestici
30c0cf2f-dd26-4ac2-a6c1-8680a9180a32	grafici di carico delle gru
30b52316-10ed-4cca-bef0-6ca0fdea6f60	fornire consulenza sui problemi di fabbricazione
30bd213a-878a-44c9-ba84-3cad9651f6aa	fornire informazioni nell’ambito dell’immigrazione
30c937db-60eb-48b7-983e-f24601774a21	caratteristiche dei metalli preziosi
30c11d0e-5520-43ec-99dc-b1b1ecb07172	manutenere gli stampi
30d5e3a1-a9d1-471e-8fd5-a53339e9be2c	confrontare le offerte degli appaltatori
30d6c6a4-13dc-4ccb-965d-cb257551c3a2	monitorare gli accessi degli ospiti
30c4cb35-475b-43e4-8a77-0651339bc512	controllare le condizioni ambientali di lavorazione
30dbd8a6-694c-4a32-881f-2361dea53ff9	coordinare l’amministrazione di una organizzazione sportiva
30e4fe87-3a71-48a5-af0e-f07ba0756458	comprendere l’ungherese scritto
30e01e6e-1268-4ce1-9286-ee8562b5cba2	profumi e cosmetici
30ccc509-62ec-4011-8489-6e09913f4e52	riferire sugli incidenti connessi alla sicurezza nell’aeroporto
30e8547c-8f13-45aa-b835-08e103c22fc2	installare gli scaldacqua solari
30ed4914-42d2-407b-bb4f-e748b0818413	applicare tecniche di estrusione
30ee5618-4554-4a79-ae90-c0cafe748bf0	elettroencefalografia
30e921da-8ff6-41a4-92ab-ea614011c5d5	lavare i veicoli
3105c2fc-ae28-4560-97be-1e7f53f484ec	gestire le procedure di abbattimento degli animali
3107b6e6-6990-4633-9a93-c53ab57163e0	rilevare l’andamento dei prezzi
310a239e-47e7-444a-9914-9677b9346aa0	raccogliere dati di mappatura
31092e38-6aac-4cee-a49e-5cf48adf69d5	smaltire la fuliggine raccolta spazzando
310a9b62-b033-478c-8d88-a24e49007182	essere addetto a macchine patinatrici
3117e65a-4f3d-418b-b38b-343c98036ed5	attuare i piani di immersione
31191e68-fc52-4410-a6c6-760d5c62bb23	pulire il miscelatore
311fa0b7-6915-4892-b749-de62a886f26c	promuovere la sensibilizzazione della comunità
3110a24c-cb5b-4a2b-aee7-3f8a63c136e6	utilizzare macchine roditrici
31038870-5edf-4960-8d0b-497db98622a1	individuare la fonte di un’infestazione
3118e22a-0246-4be3-876c-9bf1d9c0746f	porre le domande relative ai documenti
312205db-2cc0-4f55-822b-73fee4524b64	Ansible
31308cd6-98cd-42be-bb19-d24868eb2799	accordare gli strumenti sul palco
31331216-88c7-4c01-95af-7f1081a252ee	valutare le idee musicali
31349d6e-caa5-4dad-8a59-a36b818d4155	creare un piano di conservazione della collezione
31310123-399d-4b18-9cf3-38987aeec081	gestire l’organizzazione del magazzino
312bdec0-a9a3-442a-8b1f-bc34a1a994d0	SAS language
3143ec0e-104b-41ba-8869-0b3c9cac1956	insegnare il braille
313aa153-b434-4e9a-af6b-f0229414874f	effettuare la manutenzione alle macchine agricole
3143f4a2-51ad-4be7-ab46-0b3432ff2074	WordPress
313eeeb2-0fb3-41cf-a8d1-9dbed4d17940	R
314c3e01-022d-49fd-9ac3-02e5d78b5004	utilizzare gli interventi psicoterapeutici
3143370c-9035-4b3f-9bf6-58621f995d38	presentare il menu delle bevande
3151c31f-18a2-4007-aa6e-da41a9a4bf0f	azionare le spazzatrici stradali a motore
315c56a3-5e07-4bc3-b5a1-b8387505ac93	utilizzare programmi di stampa a colori
315e1077-8cb5-4750-8820-fd2672df3362	immunoterapia
31622dc9-cb1a-4f93-a86c-e87cd023ead8	interpretare i tarocchi
31570453-8d46-4f76-abac-9e583f332f13	pianificare un evento di marketing per le campagne promozionali
3166957c-d8a2-425a-bf3e-e8e01ccf05e7	pericoli per la salute e la sicurezza in ambienti sotterranei
3146dfa0-ee61-4a34-b3e3-a3889a6a21e8	eseguire il controllo qualità alla trasformazione degli alimenti
31680808-5181-4c23-bf68-0856da4d7565	valutare l’impatto psicologico dei problemi di udito
31682172-c961-4282-83ed-efe2b289845e	principi di pianificazione per interventi di musicoterapia
316b1407-ff51-468a-905c-73121f9e4223	riconoscimento vocale
316e9efd-e9bd-44d0-928c-92b8b432f95d	pulire gli impianti fognari
318566cd-0d05-468b-9989-42fbc1cc9918	offrire consulenza sulla protezione del suolo e dell’acqua
3185d9f1-2b87-4256-ba51-657695556e96	fornire un trasporto in sicurezza
3170b2a4-bee9-47ec-bd82-162a54081f08	rivestire le cinghie trapezoidali con il tessuto
3192f6dc-1720-43ca-957e-84ed009c3a9a	mescolare i materiali delle mine delle matite
3196e223-ce88-44ee-b8d6-d043c4f28738	eseguire procedure odontoiatriche negli equini
317a4701-453d-40b0-91f1-3bd292fa08a7	pianificare attività di produzione presso lo stabilimento alimentare
3189ea9b-4b6f-427e-8482-091ae7f56996	contribuire alla tutela dei minori
319c456d-5493-4a7a-8cbe-ba773ada76a4	geofisica
319e4512-e977-409d-a1b9-5c21bd641ccc	gestire i tempi nelle attività delle fornaci
31a0241d-377e-4351-bfd6-fe4f684dc08c	analisi finanziaria
31a490ce-4003-46aa-a761-3944e794b174	gestire gli impianti di macinazione degli estratti vegetali
31a28d58-4781-4701-99b0-c3df91f95438	ortografia
31a7760a-0e6c-4a6e-b233-0795fb0ac85e	installare porte ad apertura automatica
31b6b4f4-ec37-470e-aed7-c46bb064a1d9	norme del terminal aeroportuale
31b2e371-191d-4041-817d-f9606dcff707	studiare disfunzioni del sistema immunitario
31b0946f-13e6-4c5e-aa36-204ec4983911	creare un piano pubblicitario per i mezzi di comunicazione
31b9161a-ffcf-4726-bbbe-45d0e89027f6	offrire consulenza sulle finanze pubbliche
31c05a42-6b6b-4f7d-86ed-35988a90fe16	convincere i clienti con alternative
31cd174b-702a-4984-93e6-6af4571e45ed	gestire la macchina inscatolatrice
31c1100b-2910-4e9e-be70-378ac7e26aa5	preparare gli stampi assemblati per la finitura
31cfe1ae-fd08-4994-b45b-a912ac697bce	comprendere l’irlandese scritto
31dd8ad7-723c-47d0-95d9-5696259989b2	esaminare i campioni nel contesto della dermatologia
31ddfc11-2038-4799-a7cb-49786199cace	tassonomia degli organismi
31d889fe-2c4a-4790-8f5d-bbe2f584b5d6	contribuire a campagne di salute pubblica
31def159-dbbe-4896-acc3-3b7864daf9d4	condurre ricerche sulla flora
31bd230b-9c9f-49b1-9531-ff3c0330ffcb	ispezionare i lotti di prodotto
31d1fbc3-fb71-4e15-bb73-acf5ae5f5d82	effettuare la manutenzione dell’attrezzatura per il dragaggio
320f7944-2525-4268-ad21-4c4fcd312bf3	trasferire la vetrina
31e144f5-43c7-4ff6-bb06-cc9d96d02b87	applicare tecniche di pre-assemblaggio ai fondi delle calzature
31e048bc-e159-4a77-901e-778155e772e7	controllare lo smaltimento delle sostanze radioattive
320fd024-c049-4234-ae67-f03db439eb8a	fornire le relazioni sulle osservazioni meteorologiche di routine
3216833c-b759-4f5d-aaaf-e440f94ec072	software framework per dispositivi mobili
321a2a9c-29c6-4667-82be-0805dc0d0e0e	chimica dello stato solido
32111be2-6323-46f6-bc04-0b0b10e4279f	cuocere al forno
321e372e-5cf1-4f76-b65e-10fdbf4d1b0c	posizionare il vetro sui ripiani del forno
32207694-0773-4019-b02f-7dc1a07fb869	restare aggiornati sugli eventi locali
322eff65-8f96-4fd3-bb4c-383d7b6c6beb	monitorare la contabilità
3239a27b-09d4-404d-945d-b5ab3ccbf0fc	sottoporre le miscele di lattice al processo di lavorazione
323a7813-b95b-49d7-af41-36ce814bae7f	supervisionare le operazioni di costruzione della miniera
322c626c-0b35-435e-a7f0-476db59bc9d3	comunicare in merito a questioni relative ai minerali
3229c53a-4abd-4f37-9d0f-38ca72568c8c	controllare l’idoneità delle bottiglie a fungere da imballaggio alimentare
32430d19-eeac-4af0-9e72-02becb50d1bc	cucinare pietanze a base di carne
323fc161-c4a1-463d-a6c2-5fc3a5c47190	assemblare unità elettroniche
323e8c4c-d4d6-408b-8805-1f72a1234a0e	coordinare le attività di governo nelle istituzioni straniere
32432652-4f46-418c-b8b5-0f9404d1c830	rilegare libri
324b9371-5be3-4332-b652-5d302cbb9354	osservare le attività di insegnamento
32544d7f-cbe5-408f-ac0c-cb5ef7f01885	tenere conto di vincoli edilizi nei progetti architettonici
32529522-8ff5-4c2e-9685-b013ba34e5a4	presentare le strutture dell’azienda agricola
325a2aac-43df-4ccd-b7a4-af6075c23f9c	tagliare le lenti per occhiali
325adf83-53a9-4ed1-bcd2-8ae3b29fa990	curare le opere d’arte per le esposizioni
3261554d-e5ea-4280-82d2-5f2ca2b3163a	utilizzare seghe circolari
32621e51-8b2f-47c3-8f21-1e71cab2a8b1	revisionare lavori di traduzione
32658bfa-3a02-4a9f-916b-ac0b0b8ed939	eseguire le operazioni di bilancio
326aa714-688b-4722-88d2-0a6f1cbc1dc6	concretizzare il concetto artistico
32730bfc-c7ac-47fe-be70-11a3ab2365ff	analizzare le comunicazioni trasmesse
3275733b-e5ea-4924-9f50-05566244ac23	facilitare il processo di guarigione legato a una violenza sessuale
32777867-6829-4a0d-8c36-310123fa6666	rivestire l’interno degli pneumatici
32875c15-54a5-477e-851d-3c82dc21408d	ornitologia
3293402b-8ad4-4c6e-a40b-34798a3d3e3d	smontare le macchine
328bce1e-1070-43e7-b032-ba93f12fb425	gestire un gruppo multidisciplinare coinvolto nella cura di pazienti
329e5b2e-95db-417b-a8cc-be9716ff1498	installare le attrezzature tecniche di scena
32a498cc-65f3-4b05-b456-95950c7c39a2	declamare
32a88a15-00d2-4194-9432-fd6a0fff967b	elargire le sovvenzioni
328e05de-b766-4d82-846c-98c6e82efb65	utilizzare un mezzo d’opera
3296e1e6-2096-4f33-a99f-b3a0a50701f1	terminologia giuridica
32aa6912-592b-4851-9a6e-dd5d3ce42786	meccatronica
32aac261-1842-4ce4-9606-fcbae1cbce10	ricevere le autorizzazioni pertinenti per l’uso di esempi audiovisivi registrati
32b3fc2a-ba2d-4841-b553-c84cdccc7011	azionare la palla da demolizione
32b56cec-a14e-4630-b63f-9b5d57db6065	induismo
32bbe0b7-f8f3-41bc-98d9-0ffa192a9304	principi di orticoltura
32afa62c-3e61-4954-bf83-0fa1dfe4a24c	integrazione di sistemi TIC
32bfcc68-9dbf-4812-8f2d-ffd567a18d6b	tenersi aggiornati sul prodotto
32c51fb5-af52-40d6-becd-fd8bc99ac196	insegnare i principi di guida dei treni
32d3d335-7d38-4788-93a6-696f50955e5a	antichità classica
32d7e807-5010-4c90-a727-984a2b1e1ab9	creare cerniere tubolari
32d3056d-9d91-4b9b-93e2-7525d5e0f693	selezionare il materiale per i modelli
32c682f3-8de0-41d1-ad2c-ce17c57c27c3	piattaforme di lavoro online
32c67815-54f0-4c69-a9a0-8719ffb6abdb	pubblicizzare un prodotto
32d903b8-b2df-4a32-81db-8456d8c5e72c	decidere in merito alle domande di assicurazione
32d96002-b11e-4774-91bd-7aaf9974ad2b	trasferire i prodotti dopo la cottura in forno
32dbef7c-d2ca-4aa3-b9bc-30d9042ca607	analizzare le informazioni del fornitore sulle parti del veicolo
32de63f3-0694-4612-800f-58fa44e3bd46	postediting
32df7f3b-ced6-48a1-92a2-d16a1412268a	indagare sugli infortuni sul lavoro
32daf06e-87ec-438a-882a-8125b3eab940	analizzare le prove giuridiche
32eddfb7-74fb-401d-8855-a6384c46d643	effettuare la manutenzione del sito paesaggistico
32eb497c-6787-4859-bf48-9bdf53a684ed	disegni di parti di autoveicoli
32e242ae-074a-4a89-8573-d0b959ccb83a	fornire analisi sul settore della psicologia della salute
32f203f4-faf7-48cc-bd00-13c50a1602d2	produrre sezioni di cornice
32eacf67-5eab-40ae-99db-1b1ef713aece	usare software di taglio dei campioni
32e7e35e-507a-48e0-a02e-ad3dda339af6	controllare animali in stato di sofferenza
32f458fc-c7de-4bed-8553-8ab88fe655a3	spiegare i fini dell’intervista
32f248f7-f493-4539-8196-b8f9797925b4	vendere i prodotti
330475d4-0b7b-426f-a6e6-65f912d2f473	fornire le strategie di valutazione della salute psicologica
3305196e-9561-4e2f-b628-4f06b4755f1b	prendere le decisioni cliniche
3315ff55-dd8a-4812-b2a2-1cde831dacf8	progettare le specifiche di backup di un database
33104512-b6be-4297-9ec5-453655a935ce	differenziare i rifiuti
3316e8fa-e48b-4796-b1c3-4eab213de170	applicare la psicologia del gioco
330a393f-771a-4446-9741-31b670368b01	rimuovere i materiali contaminati
3318e34a-0b50-4dc5-9489-b35625aa0193	comprendere l’albanese scritto
332882de-1701-46ba-92f6-382b2c44889b	vendere l’hardware
33266c4e-7b74-48a3-831e-42bd125e5692	ricevere i clienti dello studio veterinario e i loro animali per gli appuntamenti
33374218-c22e-4b1e-8ac8-a2477c53a155	uroginecologia
3348c64d-cb17-4f64-9fb4-845ad3b77373	montare lancette di orologi
332da090-1b99-4891-b2e3-fe1c212b38b3	sviluppare una rete professionale
3363e8fb-0ac0-4e9f-a8e9-6afd4a60a0ed	disegni di progetto
3352c146-8075-4e3d-9700-e810c5c11806	indagare sugli incidenti che coinvolgono gli animali
3335c1b2-e0c5-4911-a4a4-13d067d079a5	guidare una squadra nella gestione delle risorse idriche
33793fb6-c17d-4185-bf67-ab4e33143c77	fornire assistenza per le procedure di vaccinazione
3359bb07-8ccb-4f17-a600-4c94a719a542	mantenere un archivio amministrativo presso lo studio veterinario
33716520-6bce-4325-a4c6-754532e4ef60	ispezionare cavi
33809d04-c36e-43f7-8959-be2208a2f4ea	tagliare disegni ornamentali
338e51f1-9159-4587-adb7-100669793362	preparare gli ordini di lavoro per il laboratorio ottico
33907c35-586c-4ef4-a3df-6a5a4b6848b4	eseguire la detonazione degli esplosivi in sicurezza
3397e751-fb85-47c0-8b24-38a1a111f7b5	sistema di codifica dei prodotti
33917895-b0ae-4463-a790-61f4cfaa71b1	monitorare le campagne politiche
33bfe7e1-f54f-4c0d-99d7-c82ec0308cea	finire i dispositivi protesico-ortesici
33acdc9c-5114-4db2-b326-d554691b176a	progettare prototipi
33c9e8da-066c-43b5-8036-b12eb6d829e7	unire con staffe gli oggetti in lamiera
33c0e819-e286-46a1-a655-f3f6bfdb6373	osservare le precauzioni di sicurezza durante la stampa
33c12b25-5978-4c3e-9303-6300d53193dc	aspirare i detriti presenti sulle strade
33ca977e-85dd-45ff-ba9d-ae2f6adfa33b	contrassegnare il legname
33a99eb4-463a-4ca3-a69b-6e4b7b7c74c0	garantire la sicurezza degli studenti
33d2f7ed-c91c-4d03-af62-98e2d52841ee	condurre un consulto omeopatico
33d6d017-2825-4748-920c-161d4d1bcc25	comprendere l’islandese parlato
33dc82ba-e00d-4042-895d-8987ad553354	lavorare con utensili da fabbro manuali
33dc91f8-f3d6-4d4c-904d-c0b17ce66e81	strumenti ottici
33d54212-1430-4070-9c88-214e58959315	rimuovere virus o malware da un computer
33e58254-d49f-47ad-bc0e-c0839bf41536	valutare gli studenti
33ea74cd-400a-447c-aeee-c6ae296bc700	apporre il marchio sulle compresse
33fbb4f5-6211-4207-8adf-26e66dd5fa2a	informazioni sui luoghi di interesse
33fbdf7d-074d-47cc-9141-357ec7ca07a6	ispezionare la segnaletica stradale
33e76375-9c8f-435b-a61f-629b80ad2887	eseguire la manutenzione ordinaria di motori navali
33f97a9d-b34b-4302-bb35-ed3e671c1448	gestire i dati del contratto di viaggio
34083401-1243-468b-bc66-f41b17e033c0	abbinare la birra agli alimenti
342a0390-f42f-4e84-b969-f7bbe7e82465	pianificare le aree sportive
3432032f-b05c-412c-922b-41e696e375d9	SAP Data Services
340575d8-a00c-4914-929b-c67489c0ec52	tenere i seminari di sviluppo professionale continuo
34143b2c-2386-44f8-98b1-a39a1f98a853	monitorare la temperatura nei processi di produzione di alimenti e bevande
34384653-4d36-449c-aeec-bcd28682d4c1	trattare le carie
344312b6-8848-4b75-83b2-fcbc5348afa9	assegnare i posti ai clienti in base alla lista di attesa
343d351d-3235-419d-bcb3-93ad1996254e	affrontare i problemi meccanici dell’aeromobile
34499231-4164-4862-80bb-b04076ca3f36	tipi di materiale per giocattoli
344c2658-f5ed-4048-b721-320b687a790a	analizzare questioni di sicurezza
344e71c6-9e90-4013-ba42-a438beb87df9	far rispettare i valori aziendali
345c4e2c-0dc3-4cbd-8b44-bcb6e376fe93	operare all’interno di mattatoi
341af307-6b9c-40b7-9e84-2aabed34ffe5	fornire informazioni sulla progettazione delle mostre
3451baa5-1558-41a8-9676-d879963b7bfa	gestire l’operazione di alleggio
34530706-d11c-4dd7-8cc3-f9bd1a416500	progettare tecnicamente un sistema audio
345d7e48-b6aa-41ac-8d1e-dd583e00fc47	correnti d’acqua
3468da64-b05a-46c0-bd29-745428a820d1	oratori pubblici del passato
34696cc2-82a1-465c-a45f-ddda88d01391	regolamenti di salute e sicurezza
3483cc9f-49df-4a30-84e0-d07e7838e221	selezionare il materiale da lavorare
346eb103-3c24-4aea-ba07-ca0225e48063	fornire informazioni sulla natura e la sua tutela
347d108d-5812-470b-a1fc-7cfa9485bb60	riesaminare i contratti completati
3485d70c-eaf3-46f4-a96f-78ffac33bdaa	monitorare i processi di congelamento
349d671d-c2b5-4ca6-8bd6-94af9c15eac7	contribuire alle operazioni di sentina e di zavorra
34892c6d-d013-4799-ab59-d49a9e762e96	schemi orientativi
34a211f2-36b8-4148-9c0f-932ac90d76dc	coordinare il reparto taglio per la fabbricazione di calzature
349ba3dc-21db-4166-a87b-9ece490daac3	valutare l’assetto delle imbarcazioni
34a5b282-85e4-4187-a1e2-fc36e2cc596f	effettuare la sabbiatura tra gli strati
34a5d230-ceb5-4cd3-9c86-c58688ad7bd1	mantenere i sistemi di ricircolo
34b017cf-b002-42e0-ae5e-b96be6e2dbec	eseguire le attività successive alla rifilatura dello zoccolo
34b37356-a8ea-4d71-bcee-9ab99477ec7e	essere addetto alle macchine di confezionamento
34b6abb9-157d-4ca7-b803-25ae36003947	scrivere dialoghi
34b32c58-3d1c-4f6a-8172-c41b8b6e2f78	pianificare strategie di marketing digitale
34be5dc6-c04e-476c-ae5f-0bb101efd6bf	esami di guida
34c71caf-8fca-40fa-b664-67ea2089620a	preparare gli oroscopi
34c4962f-0aa5-4234-a34e-cb9ad8e4f00e	riparare i difetti degli stampi
34c63f07-fd63-4276-8e17-6a38caba57e3	preparare le relazioni di spedizione delle merci
34cc2736-efa6-469b-b0da-a20d63732275	partecipare alle manovre della nave
34d2f24a-7aad-4011-850e-2b5dd76b3545	classificare le richieste di risarcimento
34f0327c-481c-45d9-ba44-281594fdb989	comprendere lo spagnolo parlato
34f35a9f-2865-44a9-8dca-43c3d66b4f34	sollevare pile di carta
34f3de6f-8f4e-4475-9af0-7af01b89967a	utilizzare i macchinari per la bordatura
34f55a2a-b5ca-4ed0-ba6c-6b471ab9b1bb	gestire l’amministrazione dell’istituto di istruzione
34f023d7-5953-4211-b256-1d9473f4c2af	negoziare con le principali parti interessate nel settore della vendita al dettaglio automobilistica
3500ad3f-3c8e-4c40-8b59-9e3131ac8d1e	organizzare le attività presso le strutture
3513b87c-a55f-403b-8851-12fc07987e08	gestire i programmi di accesso
35016bee-e2b2-40af-b262-265ca3135656	diagnosticare la morte cerebrale
35134f7c-0605-4405-a2fd-33f0a0345b1e	installare i meccanismi per garantire la purezza dell’acqua
35178c7d-c448-49c9-a52c-6464095e33d8	controllare le malattie degli alberi
350868c2-efcf-4c18-9cf7-f1ffc68c8402	offrire consulenza ai clienti sull’uso di prodotti dolciari
351a0fc4-2302-4fbe-8bb5-6050a0acf7e4	negoziare l’acquisizione dell’area
352e8fc4-86bd-4684-8170-e79956b3f382	preparare la zona bar
3526913c-32fa-42de-b27b-f7c3d3775174	approvare il design delle confezioni
35222088-78ba-4361-b364-0f259422eb2d	prescrivere un trattamento psicoterapeutico
3537644e-9816-4552-9fe3-aa958ce03a9f	comunicare informazioni durante un gioco sportivo
35380764-9533-466f-b402-cd593f2a6f7b	materiali per strumenti musicali
354177c3-f458-4639-b8e7-3f43f1a9fd27	applicare le procedure di controllo della qualità per i test biochimici
353ca38f-68e7-427f-9e5d-24d84b542803	utilizzare attrezzature con variatori di luminosità
353bdefb-63c9-4eef-b008-21268e7d97ce	comportarsi in modo responsabile
3541de18-feae-41ad-9041-4f5bb4dfa846	impostare controlli delle attrezzature
35428dd5-6453-430c-acba-d2cc157b8a1a	fornire servizi di pet sitting presso le abitazioni dei proprietari
354bd7b6-ce79-400d-ac58-f4f7a8c8a5fd	semiconduttori
3543d31a-78f3-4d6f-806c-1e4d45cc55bf	utilizzare piegatrici
354c465d-c8e9-448a-aa05-8552bc105f91	serrature elettroniche
35488ae5-b3ca-46f0-a932-20f04aa8e860	fornire informazioni sui rischi dell’abuso di droga e di alcool
354cbe9b-057b-4696-8d44-31caaf4ee9a2	spruzzare la soluzione sulle lastre
354f3784-9aef-47cf-b460-6e5d40550905	determinare la posizione del taglio
354e73d0-f635-4945-b3a2-f4e9931c47da	supervisionare il gruppo di logopedisti
3555e139-41f9-4484-920a-8881181847a4	ingegneria civile
355b9770-feba-49c4-9b39-6acd7286f252	gestire gli animali da lavoro
355645a1-0861-4609-8c6a-a3fd04806238	adeguare la capacità del sistema TIC
3552c8c6-b51f-4569-bf46-d5083d9a649b	garantire la trasparenza delle informazioni
355e0fed-b1a6-489d-a3dd-056d10248839	promuovere la campagna politica
355ffbcc-cfba-4bc2-9c43-f938a3e54db7	tecniche di trucco
355c1dda-7b9a-41a6-9d1d-7b819c707fdc	gestire le risorse esterne
3568cf61-98f3-4df7-b012-34cac511a550	aiutare nella scelta dell’abbigliamento
356ad3a2-b79b-4c77-9458-4ed77a9acc55	usare presse per balle
35691053-af5a-4d4c-975f-29fd0f2746fc	preparare visite turistiche guidate
3568872a-2840-472f-90c1-f2b509e7b722	fornire consulenza giuridica per partecipare ai mercati finanziari
356a238b-8539-47de-8862-3073636dc73d	riferire su eventi turistici
356b84c9-37ed-4618-aa88-69e944c84b62	impostare controlli scanner
3570e00d-923d-4b66-8772-6b55d235f174	presiedere una riunione
35799f48-6dbd-49c7-99e1-ff411bc01e2c	creare nuove sequenze di combattimento
356e7d8b-89f6-4405-a01b-dbab7f120f51	conservare l’attrezzatura da cucina
3580f6db-57ec-4bb6-ae08-b3499f2b42de	interagire verbalmente in yiddish
358794bc-f3f0-4b26-80d0-f064c2f60679	determinare la percentuale delle dimensioni dei frammenti contenuti nelle sigarette
3581891d-5abf-41ef-9b40-e15aa2d74cc9	riferire in merito ai fatti
3599b4e7-4a56-4dfa-ae19-1d0441dd8d45	normative in materia di pesca
359f3601-9a34-460a-99b6-6efcd5af2189	spurgare
359dc702-92b0-4ed0-9628-6c159a411c40	metodi di incisione laser
35a72996-4cad-42ed-8cb9-d93071e8a414	assicurare il trasporto sicuro di denaro
35af00d1-f28a-4a15-9797-38769ab7635a	seguire i segnali d’entrata
35b5f40a-18d5-4c64-ad6b-b3243f7ac4bf	configurare apparecchiature elettroniche
35b42d0e-eaa3-46eb-a182-cb1d645cb061	applicare tecniche di stampa idrografica
35ace305-2670-435b-a835-ac9ed06e3aff	argomentazione di vendita
35bee42c-9aff-414a-b436-a20f6d02dc61	terapia energetica
35d49a25-569f-4c75-a675-7cd24f862c39	regolare la tensione del filamento
35bfeb7b-f7a0-4d6d-b78d-e688dce9e6b5	gestire i processi della gara d’appalto
35eb7cc5-1d0b-497a-b2d7-e77a5fefc4b3	preparare i pazienti per le visite
35ed5c3c-27eb-4a62-9c2c-ab0d2f556b75	sorvegliare il sistema di scarico
35ee0789-a530-44ac-a6f4-6e6d04c5ac9f	quadro di comando delle draghe
35f02b02-1d5f-4ed6-b80f-76baf271e95e	tecniche di potatura
35eec5ca-c3e0-4339-b122-f2b3e6143565	applicare i sistemi di gestione della qualità
35f639e7-68f5-408c-88ee-77e11171320f	promuovere la parità di genere nei contesti aziendali
35f8375e-5504-4029-9e79-3fe5d222d241	preparare le prove
360d71cc-18b3-40c7-b48f-d5ec0246bb54	avvolgere i filamenti per nastri
35feced2-c424-44ad-8ca8-9d1687cf4958	utilizzare le lingue straniere nei servizi sociali
3600135c-9c41-443d-b0e4-8f0818d4c29c	camuffamento
360fd2af-21e9-4806-87d0-3ecd96ca853c	monitorare il comportamento dei clienti
3618af44-2a83-411d-8333-e14e770bec4b	richiedere l’eccellenza agli artisti
3612b263-824d-486e-be93-52ee779d5f58	aromatizzare i vini
3619e2fe-a8ee-42bd-8177-b61967906901	definire i bilanci di progetti artistici
36260741-6dae-41db-8860-48a40a9cddc5	effettuare la manutenzione degli impianti di stoccaggio
36182ba0-7725-4869-bbef-ad2a68e849a6	gestire gli appuntamenti
3460adb2-b7df-4e85-aace-d6c624c2822b	posizionare il cartongesso
3628a271-3ac5-40d9-a1bf-5ea2202a8aed	offrire consulenza sulla cure di fine vita
36410643-d469-49fb-8dc2-9a34157f3faa	utilizzare strumenti per la riparazione delle colate
363778a0-1c10-4079-b6bd-7c68ded18b4c	sofrologia
363138b7-05af-44d2-93d8-e7363612e0e5	lavorare in gruppo
36315e26-96bc-4f6d-80c6-cb6aee2f3761	scansionare foto
3643abdd-569f-484f-8be7-5858d0f928e7	offrire consulenza per gli incontri
36499d34-0644-460e-8319-5c68ca083b02	classificare gli alimenti
3651d3e4-6e45-4b5b-9f36-ba7cbfbe420c	condizionare i riproduttori
36584576-4b00-4aed-8901-e5b009e1badc	selezionare il bestiame
36618e34-dd95-4518-a03e-8adf53bac552	stampa offset
365cbfdb-58ed-4198-8cbe-5e8e4bd56c7a	gestire le operazioni del magazzino
3666340b-1fd4-4dad-b43c-c951ae3a5e14	eseguire l’assegnazione ai conti
3665df86-d673-4890-a99b-7d4fb0627038	imparare il materiale coreografico
366300ec-4a88-46ca-983a-3b81d2f8abed	installare attrezzature di sicurezza dell’imbarcazione
3661ab98-622b-4706-9c40-12721e990653	fornire raccomandazioni sui fertilizzanti per i fiori
364e6685-774a-4cbc-b553-075e3b95b8e4	Adobe Photoshop
3666b668-58c1-4d9d-b4d2-98575ce52269	fornire assistenza alle persone nelle zone contaminate
366713e0-fd1f-4e5b-aefa-f0aa0e1da5e6	predefinire i set in miniatura
366d7148-ba19-4cc3-b8df-7416ad95c8a1	combinazione di consistenze
3671c156-7c10-4ea7-a11d-7aea86f96a20	liquidi di batterie
366a4e4a-e4e1-43db-87ea-016c036cc8b2	collaborare con gli esperti dell’industria
366ae6dd-8b71-4005-82f5-854936e8c209	competenza giurisdizionale finanziaria
3677ba91-6272-43ed-8a5c-a9789b6b0dad	implementare il piano di ripresa del sistema TIC
36830f08-257a-4f50-aa55-21b296ea808a	eseguire gli acquisti in incognito
367717ce-ba80-4689-b0ad-d4a703ee5e23	eseguire controlli di sicurezza alimentare
3689c5bf-b1c1-47e1-ad64-4b506f5f7e1d	controllare la salute della foresta
36766789-c7d8-4c7a-b602-23e050bb1509	eseguire misurazioni geofisiche elettriche
3684013a-d2bb-4870-9eba-ba4daecffcef	valutare le caratteristiche del caffè
3691c8bc-5759-4212-a2bb-a034ad9ca57a	sistemi di taglie standard per l’abbigliamento
369337b4-8750-453c-aec3-f5a944216004	tipi di viti
368e7fd7-69ae-495c-bcda-fd57dccca159	collaborare con gli addetti al trasporto dei prodotti
36a78f85-c8aa-437d-adc0-3c0cb2405f64	meteorologia
36a9eeda-153c-4c98-9e6c-cbb4b9b4e36d	punjabi
36a77f66-fc66-4ec9-9e69-9d431066f326	leggere mappe
36a2f514-3efd-42ae-a1df-c51d9517460f	leghe di alluminio
36b0da29-426a-45ec-a4cd-b7cfc7ef73a3	individuare difetti nel cemento
36bd7b9c-0724-4db5-ac61-fd6614e00965	processi dell’ufficio legale
36c97708-7b96-4eec-babb-ee752314b02c	fornire una diagnosi chiropratica
36c65788-d652-4d76-9572-9d927c3a9670	svolgere le attività post-esame
36bf6c92-fce9-49a8-977e-5b4a50b03755	dimostrare le caratteristiche dei prodotti
36b826de-5968-483b-a241-54160b46d3ec	etichettare i campioni di sangue
36ce696e-3c81-4695-96ee-85692f6be2eb	preparare le risorse per le attività di carico
36dabc98-31b0-43a3-af5b-36e895ea039e	funzioni delle attrezzature di coperta
36d0a01b-32d3-4bce-9d59-3a194a896ebd	laminazione con fibra di vetro
36e1e3b7-9d4b-43f7-92b3-1af5efd87f0a	sistemi di qualità per la fabbricazione farmaceutica
36ed9f9e-d8b6-4606-9e89-9fb5d8058a26	effettuare la manutenzione delle imbracature di sospensione
36ef90b8-8076-40e9-8dc8-6179c3d8c398	formare gli investigatori sul campo
36e73aad-c928-4414-90a6-dc29086d636c	valutare la resa di petrolio potenziale
36efea85-72a1-4626-937a-73f8593489a0	processo di rivestimento a immersione
36f12e12-8a65-4473-843a-9f32d8d6d847	leggere libri
36e3985f-02ea-4c6a-b2a6-e721c345cc4f	supervisionare gli studenti durante lo svolgimento di servizi sociali
37038760-f443-4ef7-933f-40e1df1c1379	assumere il controllo dei pedali
36f21204-1bf1-4ae3-97ba-438fbcf34f92	creare componenti di strumenti musicali
370b4127-be6b-4562-8833-6a2760c7dfea	gestire le risorse del deposito ferroviario
371053d7-7388-4876-8df9-7ed59999e05d	progettare corsi online
3710df70-7cb9-422f-9767-b1b322988c76	specificare i componenti di progettazione del paesaggio
3711bd75-a7b5-4258-a525-4b399edc8ca2	offrire i servizi finanziari
3721b7bc-8c27-4410-ba0d-3d9157e1b82c	gestire il processo di svezzamento larvale nella fase di vivaio
37233dc8-f437-456a-ab2d-7130e5f45b7e	installare gli impianti parafulmine
37276491-9859-4e01-b0a0-7191d0f49d42	filosofia della matematica
37198baa-3a7b-4c04-99f9-c23be51de56b	rispettare le misure di sicurezza delle centrali nucleari
3736428a-d920-4211-9996-7bead4f02089	fornire servizio di interpretazione di sostegno
37400070-91ce-4486-ac1d-67bbc8785ff5	vendere i giochi e i giocattoli
374476c1-bb0c-49bc-bf96-a58094f05f39	creare storyboard
372fc662-8e06-486e-9992-ebe9f09e7bf4	cucire gli abiti di marionette
374101de-48f6-4d3d-8729-dd72dc24dfe6	sviluppare i servizi di collegamento dati per la navigazione
3744376f-cee0-41a9-99a2-64d3c4882107	comunicare con la giuria
3744fdd3-cfc1-4f7c-934b-b6276aee2e45	carne e prodotti a base di carne
37529aef-00ee-4930-a557-7c8a2ba7fe23	gestire le reti della gabbia
374ca8c9-e08f-4149-82a0-eb5ae715ea02	fornire servizi di assistenza sanitaria ai pazienti nel conteso della medicina specializzata
3757ce3f-7176-4057-856f-52fab42635c5	testare il tenore di umidità
3762d6e7-38e6-4edd-8935-0c39571a8fb0	produzione di funi intrecciate ad uso industriale
3755a451-97f4-454b-8634-0dab4f935ff7	utilizzare i test della personalità
375f9126-2a3b-423c-a0d2-19272ec73dca	organizzare eventi speciali
376d70de-ceb7-4ac2-a2f5-a963976286c8	applicare tecniche di brasatura
376746e8-6dc4-4a20-9b37-7a1384f9f1be	attuare le misure di tutela ambientale
3774f482-373e-4f15-a16e-299116831c4a	preparare le attrezzature di coperta
3779582e-cd44-402d-881d-2a16033074de	guidare i veicoli a due ruote
3771c8c5-580b-43b5-a16a-c707803c3533	adottare le misure necessarie a seguito delle ispezioni agli impianti ferroviari
378bbe2d-6018-4f07-8282-6f1f68d9c56b	creare dipinti originali
377a8989-b5a6-4820-ab4e-c7d4e3ecb8e6	analizzare le informazioni relative alla storia creditizia e alla capacità di rimborso di potenziali clienti
376e65e8-5eda-47f2-9793-2001808b8a53	pianificare le procedure di salute e sicurezza
3782524e-70c3-49b8-b74a-ca77b5a7253e	creare piani di apprendimento individuali
3791ca56-dc81-475d-93f6-012d3b7e87e9	urolitiasi delle vie urinarie
379df85c-4f59-424e-a05f-27e83a060ebe	scritture contabili
379e2b2c-0390-49fc-a6c5-1138754f6ab4	utilizzare gli strumenti della segnaletica
37ab0bf1-3335-467f-b871-93f8db0c6432	pulire il camino
37b0252f-8fba-423d-b78a-ad90e757742d	norvegese
37b0bd25-658a-4bc5-ac13-ccf51c8510f1	ispezionare gli impianti di produzione
37b6bd3f-0f02-4d4c-b0a0-cf22d1aeff19	coinvolgere i compositori
37bab6cd-ea2c-48ae-aa4c-2b7ebbe70614	sorvegliare le impastatrici di argilla
37bf14ff-ddac-41fc-9a68-309f5adbca59	analizzare i sistemi di istruzione
37c7db43-f432-4c65-aa42-06f9a9926868	verificare la presenza di oggetti danneggiati
37da814f-2f5d-4024-af68-fda5f7ed0996	utensili meccanici
37d3ce70-e4cd-44b5-8f42-b5af9704f3b0	applicare la terapia sistemica
37c74f53-1017-429a-ba06-214db105c6fa	coordinarsi con il reparto di manutenzione del tram
37da5e56-d8a0-43a4-97db-f31ef9e3b2e8	rilevare i malfunzionamenti dei motori
37d41471-c4d9-466f-ad2e-02c0a5115ef5	SPARQL
37f4b186-2b54-46d0-97d2-0ebc20694bb5	individuare gli oggetti di scena
37f1a913-cb9c-4e40-a835-061188957469	discutere dell’end-point di un intervento terapeutico
37eef9f2-b177-417e-bbff-b9aacd4d557d	stendere la carta sulla forma
37fa7836-3bbc-4716-bc5f-5b42f94a66d2	partecipare alle vendite all’asta dei veicoli
380133a8-6d97-44a9-a014-0bb61d4e4124	creare modelli
37db235b-7a78-4dfa-b0ee-f8f5f7a861b0	scrivere le relazioni sui test neurologici
38030fb6-4f8c-492e-a1bd-4c92f48b28ae	treni cantiere
380538c1-b215-46ec-9a1c-74339390a5e1	gestire l’allevamento di pollame
38050170-f1dd-4b99-b49b-15e6b64a7520	tecniche di laboratorio
3808411d-8f0f-4a86-9551-ace550bc00d9	rispondere alle mutevoli circostanze di navigazione
38164b17-7283-42f8-8934-68f0e484d033	audioprotesi
38289f38-0408-4b08-bd74-8d78a3c39b30	utilizzare strumenti di computer-aided software engineering
38114c09-a7ca-4cac-a53d-c7527c4017db	documentare la propria prassi di lavoro
3831c0a5-5677-4912-9c52-571b2b3113af	inchiodare le tavole di pavimentazione
382df05b-c89d-42b4-b0cf-9a01bd738c6e	pneumatica
381bc2da-4872-4f0f-8171-668e7f77d314	creare file digitali
383dcc37-25cc-4c52-85ed-8ee8a384c4ed	defibrillazione
383e9214-32ea-49fd-b24a-26c647c4a1b6	eseguire ricerche sulla produzione di bestiame
38490028-7b5d-4d25-ab0f-6029876fd516	disegnare tessuti da realizzare mediante tessitura in catena
384fcb3c-73f6-4bf8-b5c6-8111c38ac5f3	fornire le risorse per i servizi di toelettatura animali
384bcdba-09ce-4009-bcce-874e4e18ec04	selezionare gli ingredienti della lacca
384a85f3-a6cc-47f2-90c0-073e779b8e03	individuare i materiali da costruzione dai blueprint
3856370b-2926-4b82-899e-af3d8c3ecbaf	insegnare psicologia
3860736a-aa86-4760-bd52-3503855f9f91	adattare gli esercizi di allenamento fisico
3865ae5a-00e1-4038-aa60-6f0bf17b6f46	conservazione in contenitori ermetici
3867f8ba-6155-4c80-b40d-eba0411000e8	occuparsi del mulino a sfere
3866eb01-4347-437b-bd2d-ed2da900a364	essere addetto a macchine per l’estrazione di amido dal mais
38721e32-2f3c-463a-b797-9b19ef27ff67	utilizzare una macchina laminatrice
389000d7-db24-4dc8-87ee-1769319eefae	discutere delle rappresentazioni
389c2e53-aace-44f8-b97f-387af30150fd	stabilire il posizionamento del marchio
3888cc76-c9a4-4643-a79a-dc7a072f2799	anatomia umana
389374bd-241f-4768-840a-f3feb4bdaebe	seguire le istruzioni del direttore
3895e44b-cce7-44c8-be1f-df650783a99d	pesare gli ingredienti della vernice
38a52ac7-d0ab-41d9-a0c7-801346e6996c	condurre prove su campioni di suolo
3897edfb-0afd-4b4b-a585-01d2b2b6e285	assistere gli studenti con le attrezzature
38a9ea8c-46f0-4977-b4d8-879d5bbb69fa	valutare le misure di psicologia clinica
38a8438a-3337-4328-9d75-292a59e0b3e2	supervisionare la sicurezza alle porte di accesso presidiate
38aaf410-4690-4e3d-849a-c8b57c4f5ea6	analizzare le immagini a raggi X
38b8df79-b02f-4da7-8f38-8e050bbdb11b	gestire i problemi di umidità degli edifici
38c39103-91a3-40e4-834b-cdb9cdb08915	smontare gli apparecchi guasti
38b64919-6201-4d61-8a1d-1cf256ad00f9	installare i soffitti tesi
38b73a26-fe00-4f19-80b3-a238e3f41718	interpretare i dati di laboratorio nella genetica medica
38c9bb0d-14a8-4015-9e50-31911a9e8db0	trasmettere gli ordini di prodotti floreali
38ea842d-0cc9-4d45-9747-86b7475ac99b	istologia
38c4d9c0-4f20-40cd-8c79-72b2048a5f7f	ispezionare il comportamento dei prodotti
38f54ee0-28e7-4958-a8f5-4b7136210c3f	utilizzare la navigazione radar
38ecfc9f-7e65-41ef-b960-54a78e1cb8aa	massimizzare il ricavato delle vendite
3900a43c-bdf7-4f81-b8d3-2f8c15528913	svolgere i rituali religiosi
39002252-c469-4c1e-ae85-9b1a8c6c3600	chimica analitica
38fa14cb-810c-40ab-acb6-8d5bdf443474	sintetizzare le informazioni finanziarie
3918ac2e-752c-4656-8937-ffc5a901fc0b	eseguire le analisi delle vendite
391b1390-0054-47e0-8601-d83916894e40	vendere pacchetti turistici
38d4c259-3374-4335-953d-9830018202cb	collaborare con i dirigenti
391b4fa4-3700-4da0-9c3c-46c2a4c2e614	valutare l’affidabilità dei dati
391bc32f-436e-4878-a76b-6a51bb554880	essere addetto a macchine punzonatrici CNC
3925e2ec-aaaf-4622-9000-24005842f21c	installare le attrezzature audio
391d8a55-f139-47ae-b131-44b193a99189	prendere le decisioni di investimento
392962ee-4671-4f36-8995-61559ce29710	strategie per la gestione dei casi di violenza sessuale
39245956-decd-471b-a9d5-588318422e4b	effettuare il finissaggio dei fusti
392d27b1-df63-4085-9b9b-a849fe4c0014	negoziare le questioni di salute e sicurezza con terze parti
3932a798-bd28-4b8a-ac9d-494c8c07c979	mantenere le relazioni con le agenzie governative
39415d0f-131c-4bf1-b7bc-855a4f43413b	condurre attività di ricerca partecipativa
3947d358-0596-4148-b9e6-19b60936d517	metriche di costo
3938241c-3aec-44e4-9d92-f00a7fd89e7e	garantire la soddisfazione del cliente
393f98e8-6ef4-42a3-b16e-62f78825aa70	utilizzare i dispositivi di comunicazione
394927f8-9e71-4fdc-bbc0-cb872eb8ef01	completare i fogli di rendicontazione dell’attività
3949d300-d154-41bd-a459-d576f3059bf5	inviare nuovamente le attrezzature difettose alla linea di montaggio
39560564-19d2-472b-8b21-4520e6e05593	assicurare la fornitura di risorse per l’attività fisica
3952ca0d-aab2-4a6f-906e-d12c21da05db	effettuare la manutenzione dell’hardware della rete informatica
395b9059-7014-4b8f-9672-80c7eaccdd6b	mercato dell’elettricità
396a0f03-4e9f-40c6-a3a6-8b31a045c903	sviluppo personale
3965a7d1-3c8b-4e7f-b2b0-536b58141a66	garantire il corretto uso delle apparecchiature da panetteria
39718a7c-9fa4-447f-8416-4839c29380aa	svolgere operazioni preliminari di estrazione di olio
39751ac6-7b1f-4fb5-af90-1dc8231dd113	pulire le zampe del cavallo
39737b2c-3d91-4bbc-b724-534acebb44fb	effettuare la manutenzione della sala macchine della nave
39792f94-964f-42b7-b56b-7575b37510e7	riparare i dispositivi protesico-ortesici
3987b39a-ea49-4a5d-afb2-ee3c85ed1be0	sostenere le persone ad adattarsi a una disabilità fisica
39863ebe-a6f2-4cac-b90c-1cf00deadc0d	tenere la piscina pulita
399e789c-ca1b-4a47-adf0-178f29b23750	eseguire le ispezioni di sicurezza
39a154c3-4cb2-4438-8d89-86f4c34200d4	manualità
3988d728-4c56-4682-9215-24f1b3143627	fornire formazione sullo sviluppo tecnologico aziendale
39961be4-ed3e-4eda-b3fb-66320629d832	gestire la logistica delle riprese in esterni
39a479b6-f1c3-42d5-9fb6-b67a2fdbf58b	reclutare gli addestratori di animali
39a188d1-f9ee-4004-9bad-6c0ef063940c	lavorare nell’ambito di squadre di fabbricazione
39acd762-4114-486a-94ac-8f7e98f9ac10	condurre l’analisi microbiologica della filiera alimentare
39bfc2c5-df08-4d48-8c11-03d7ec8c147c	prendersi cura della fauna selvatica
39c1c4eb-1f81-48b3-94d0-01599437d3e2	sviluppare i piani gestione della salute e del benessere dei pesci
39b0d6c8-8a2c-4c79-939f-e762b6ef0255	lavorare in équipe nel settore alberghiero
39c70742-27e4-4ab7-be76-c491dcffc90d	materiali del dispositivo protesico-ortesico
39c722ba-fd4b-4d07-8cfc-5b2c34e7446c	parti di macchina roditrice
39aaab08-0738-4535-8f00-f9be28313e87	compilare le relazioni sulla segnalazione ferroviaria
39caa28c-19d5-422f-8084-bbc2b45a9b14	labiolettura
39c9ac23-aa2b-4c0f-bfe7-9a7f9b8ed8d9	azionare la benna a polipo
39c766d7-b7fd-4595-bdf6-fc591877babe	addestrare le guardie
39cbd3af-f80b-436c-9ee8-d1497d398098	utilizzare una pistola a spruzzo per vernice
39c4184e-3c37-4794-b04f-bcd77278e5ff	controllare le risorse e i materiali
39cb1229-18fa-4063-ab97-38f6d95d653e	sostenere i fruitori dei servizi a utilizzare ausili tecnologici
39e413e2-4292-4f15-aa10-60160daefb3c	vendere i fiori
39e97d28-4316-4eb0-8cab-0f3b46af3ffe	simulare problemi di trasporto
39e77ec7-58ed-447f-9efc-287d976c1418	effettuare missioni religiose
39e876d9-1d42-4370-ac21-7015e508fec5	installare sistemi di bleed air
39f18e4d-9a0f-447a-8fca-b87167201fee	scrivere in armeno
39d59dbb-11b0-4e5d-af85-2668e435cf24	GIMP (software di editing grafico)
39f7314c-fc1d-4eb2-98ad-60b9b2c6cbfe	analizzare campioni di lattice
39fc13bc-a11c-4244-874e-a2fb1018c0fa	definire il programma di una produzione
3a06b1aa-3fe8-46c1-b70b-464d6603ad29	utilizzare le apparecchiature ottiche
3a03efee-9f98-4176-b32c-cd87f9567ddb	contestualizzare il lavoro artistico
3a0c0ab0-73ea-4797-b533-edcb095eb4da	attrezzatura per impianti di fabbricazione
3a150800-4c05-429e-80c6-8690f6a3407d	controllare la validità dei certificati delle navi
3a1d8d50-b3cd-4476-924f-7bf97a830e53	regolare la pressione degli pneumatici
3a20995c-0e82-41c9-b120-adaf541940e3	trasformare i prodotti dell’azienda agricola all’interno dell’azienda stessa
3a227d71-73bf-4ee2-92bd-1bfc90d2a356	insegnare i principi delle arti
3a2880f0-74b7-47fa-8230-0ee40da618d0	sorvegliare il processo di raccolta
3a285f49-3b07-4847-b01e-c076eae14174	tecnologie di erosione metallica
3a302b85-388a-49a4-9733-38f8be6e8d43	tradurre in simultanea la lingua orale
3a47e6c3-7c0a-44ca-8f78-eb06efe48213	applicare un massaggio profondo dei tessuti
3a34e3dc-815b-4a61-939f-5e98e5e02288	svedese
3a3315ed-85d4-487d-b242-0d54bf71536b	tenere un comportamento affidabile
3a366df1-b531-4867-857c-c10279af9921	installare componenti interni del mezzo di trasporto
3a4c5349-0962-4837-9ab1-f0015a9fdf5f	definire la strategia tecnologica
3a577876-6cd0-4371-827e-f5462ecb0927	utilizzare gli strumenti di radionavigazione
3a5e6198-3647-4986-8cb4-d9c82bfbf6bd	preparare sezioni di mappe geologiche
3a60144c-dae3-41e3-b56a-39ae62888f30	promuovere un ambiente di allenamento sano
3a6d1925-f1ec-4eff-b390-bc069639e30f	eseguire una tonometria oculare
3a63479d-85de-41d7-95ad-c0850ff95300	mantenere i cataloghi degli articoli di antiquariato
3a70f0dc-12e6-43a3-a086-84b23ab83f9d	installare apparecchiature meccatroniche
3a834059-67f2-45e8-a90f-700416138c2a	tipi di documentazione
3a7d4f99-ff61-4bff-9ff9-a2039256e6a0	essere addetto a macchine roditrici
3a859749-e86a-49ca-bf45-55378247a101	conformarsi ai requisiti di produzione
3a615f08-8956-4293-a508-899cd60c1c61	discutere di proposte di ricerca
3a98afa3-3340-4b62-8dbf-ea03eede1eea	preparare i radiofarmaci
3aa2e982-bdbd-402b-a986-3ccbb4eefbcb	condurre valutazioni ambientali del sito
3aae1269-df77-4762-87ce-4714d0cafd60	garantire la sicurezza della proprietà privata
3ab40c57-803a-4293-aa88-12239140750b	sistemi di allevamento del bestiame
3ab10abc-ac0b-403a-bd3a-31774263bfdd	azionare la macchina per il getto del calcestruzzo
3ab52e97-4689-40d1-bc59-11bc0bc012a6	cooperare con gli editori
3aa58d15-d904-4fcd-91af-5f37aef8c8db	organizzare l’ordine de prodotti dei clienti
3abd73b8-5905-44dd-87a9-918f3e21d303	gestire le strutture del casinò
3abfc721-6112-4c52-b685-55a7f2b7c86a	strategia di esternalizzazione
3ac4523a-2f6a-41a5-aa09-52319df47116	controllare la produzione dei veicoli a motore
3ac78921-140f-4097-8cfc-1d873fa177b4	azionare il compressore stradale
3ac980c2-4569-4169-aaba-afbb6e164b46	interpretare i requisiti tecnici
3acdc10b-db90-4276-bf3e-3a7cd21eb312	garantire la conformità normativa riguardo alle attività di distribuzione
3ac62844-232c-4d1f-b681-d7bbc9beb1e6	rispondere alle mutevoli situazioni nell’assistenza sanitaria
3acdceae-6188-4c72-954a-17385d50c160	elaborare previsioni per un’attività commerciale
3ad017e3-011a-4e17-9797-655220a6ae02	filosofie di miglioramento continuo
3adfa0f1-1908-418d-9bc7-cde08c8aae76	tipi di polimeri
3adf2e5f-605b-48cc-a44b-261f9fa2c093	disabilità visiva
3ae87cb5-3d63-4a6b-b408-be80f0cdb800	preparare la superficie allo smalto
3af3c945-ca08-4c17-92f2-002994ee9630	progettare percorsi dei pozzi
3aeabad8-4153-4cc1-a190-948c55d20cc6	controllare la salute dell’albero
3aedfa34-1300-4498-ac17-2ce53bdfcc04	preparare le tombe
3af84de3-a787-4bce-b305-0a7c2147cb12	essere addetto a macchinari di essiccazione
3af8f483-295d-44f0-ac72-bfe3f65799d1	creare alberi semantici
3af5c0ac-837d-48dd-9756-f8cb99068b5c	monitorare gli autisti
3af5d865-7a16-4e40-ab10-6df1494ced15	partecipare al processo creativo in qualità di artista
3afa1c89-44f5-4b44-8404-d5c48062bc76	ispezionare le unità di produzione del sapone
3af58d42-aba6-4b1f-a7e9-2d6efaa0ea61	condurre una ricerca su argomenti legati all’udito
3adfe938-1626-45c6-a56f-0301f600aa67	valutare la qualità dell’acqua della gabbia
3afee141-704b-4417-acd0-30d01b90ae97	azionare la centrifuga per tappeti
3b11f951-744c-42b6-a996-a684eaa71341	curare i rapporti con laboratori di genetica
3b1f0645-f1dd-49b2-94f2-310bb9dd35e5	posizionare i musicisti
3b1114d2-5e55-4261-906a-411e54b0c668	proteggere le informazioni sensibili del cliente
3afc9e01-d899-4d80-bcb3-50f8e5d9339e	individuare nicchie di mercato
3b21b8fd-6433-45e6-9049-4aa5a0c05b33	negoziare i titoli
3b1fbb88-068c-4509-a995-6675b3bd4264	valutare gli altri
3b27c297-bd79-4bc6-abda-676297e817b0	fornire addestramento animale
3b28d132-6551-4746-bf16-dd2e7293f81a	garantire il pieno funzionamento dei macchinari dello stabilimento alimentare
3b2ae49a-7aad-447b-8690-3622518e85df	stabilire la causa del danno
3b2e019f-3391-44c7-b13e-d25b27e81beb	garantire il buon andamento delle operazioni a bordo
3b30330e-daac-4e50-a7cf-b809fdbb4854	inserire le cariche nei fori di perforazione
3b2bbdfb-e4d0-46e2-8d2c-db11a82f232e	leggere le istruzioni relative alla mansione
3b3380f5-2749-4ccc-b074-05d1b4ced553	organizzare il peso dei carichi secondo le capacità di sollevamento delle attrezzature
3b313d55-b120-4d45-aff9-22c64c04b863	Microsoft Access
3b37a914-6c03-4616-b73e-d8a85543e308	creare immagini all’infrarosso
3b3d39e8-4273-43bf-bfad-11f126f2578a	effettuare le attività di lavaggio a pressione
3b3afc11-0ada-4edb-8023-bd06bda69e1c	classificare il legname
3b2f1e73-a77e-4322-a2bd-061ab20fd9c6	offrire consulenza ai clienti sulla manutenzione delle calzature in cuoio
3b3fb7f1-fe8d-4c3c-8974-a9ec794a15f2	qualità dei prodotti ittici
3b3f41d0-86fe-41dd-b9cc-96c3421dcf63	nutrienti dei dolciumi
3b531c01-94ad-465a-aefe-7e081332e83d	comprendere il gallego scritto
3b4deec7-9065-4a58-955a-6d1ead929a7d	dimostrare curiosità
3b63692c-e115-4b5b-b943-790025509d71	migliorare i soprassuoli
3b4a9d32-0aa8-401f-a56c-ac8b087f791b	controllare i progressi dei pazienti in relazione al trattamento
3b6929b2-672d-4185-8ce7-b6436f14e45a	azionare macchine per l’estrusione della gomma
3b640bd4-2dd9-4110-9738-c1ec953d1e1e	rispettare il codice di pratica agricolo
3b3d60c6-d431-4d40-969b-22ef0dfebe0b	mantenere in buone condizioni l’attrezzatura pesante da costruzione
3b7014ce-5121-4a9e-af53-1fec83c53b70	far fronte agli stimoli inusuali nelle strutture mortuarie
3b80ef61-5b9b-4785-8456-a073762f5c61	gestire i fondi pensione
3b7fedd5-c70b-41cd-8ab2-7c014cff563a	scrivere in sanscrito
3b725135-337b-44d1-ac50-af8bd9622ca3	offrire consulenza sul controllo delle malattie del bestiame
3ba686e4-9171-4da3-91f3-44f4793dfcf6	pianificare i pozzi petroliferi
3ba992d5-b6aa-474e-aa89-0b13d37c700f	lavare le fibre
3ba99452-c74e-4093-9366-e36c0663eced	gestire gli habitat a beneficio della selvaggina
3bada199-0dea-421f-9beb-f3e02f435cdd	sollevare pesi pesanti
3bac4db0-1e1b-4132-ad9c-3f9888eccbd7	stimare la durata del lavoro
3baf2c70-d43a-43c8-9d88-bf6924b1d484	offrire consulenza ai clienti sulla manutenzione degli strumenti ottici
3bbc6027-ef56-4708-b1d3-81661585c73f	progettare i dispositivi medici di supporto
3bbd1528-01b6-4c77-bc0e-b54174298846	verificare i rulli
3bbdbd66-d669-47cc-b466-de37774c561c	condurre i controlli di sicurezza aeroportuale
3bd3fb9e-5ddd-425f-b81f-e5538f275575	trasmettere gli ordini di articoli di carta stampata
3bd13ff9-904b-46d0-a641-3eccba9b9013	regolare la vulcanizzatrice
3bd021b9-2133-4aee-8a32-cf2e61a26ef5	negoziare i contratti per servizi di biblioteca
3bd0c9d8-da43-4ac0-9717-ae8e147057c2	sviluppare suite di test TIC
3bd6e213-f81b-4000-a055-08a0c1e22f16	fornire assistenza per la manutenzione della nave
3be99777-e0b1-4376-876d-d01e542d3646	sorvegliare gli oggetti personali dei clienti
3bdec743-ccc4-4f2a-aebf-a4aef55bcfaa	fornire il primo soccorso
3be7557b-55b9-451d-b746-fed13ceacd39	negoziare nei casi giudiziari
3beeb477-3542-4eb7-8387-d02c2edd518e	normativa portuale
3bf187f2-f84a-47e0-b958-6b0b60ead237	tecnologie dell’apprendimento
3bf36269-b9a2-4ce2-9bcd-bcceb03e7e4c	legislazione farmaceutica
3be9a013-5d8e-4cc7-9752-ebb996eb659f	fornire educazione sanitaria
3bf4a7df-13e8-4888-98fe-dc0a477abbfa	manuali di macchine da miniera elettriche
3bf9f2ac-d96b-499f-96fa-02df694606b5	gestire la flotta in base alle operazioni pianificate
3bfc56ad-81f3-4f62-a5d8-9479d774ab28	tutelare gli interessi del cliente
3bffbcc7-535e-4c42-ad1b-5eae843591bb	utilizzare i macchinari di lavorazione della plastica
3c0587fc-5144-40d3-8feb-1b59d8904e17	applicare strumenti di riferimento incrociato per l’identificazione del prodotto
3c0c3a1f-97bb-4ddb-b031-7e03529a4e7a	trasporto a fune
3c09b21a-baa0-47bf-8d47-3a78c83fe7ac	documentare gli incidenti di sicurezza nel negozio
3c0cc624-3dd8-4d18-8c9d-02a9afe061d5	preparare miscele di colori
3c0cf9dc-f810-46c3-99b1-f227afeefa85	tendenze del mercato nelle attrezzature sportive
3c115083-b9f3-46de-aa5a-4fdabe771dd2	catalizzatori per fertilizzanti
3c134470-d297-4b14-b0ee-154ffedf4905	tecniche di recitazione
3c16346b-a042-4ba8-ab11-bf992f6f63f1	verificare la fattibilità
3c23d876-6faf-4eca-89b5-c822fb1a4511	geochimica
3c2a1877-8fdb-4d56-9744-974467e03cbb	inviare personale di emergenza
3c2aed99-5b35-40a7-9fe2-3f9987bef4cf	sistemi di classificazione
3c300cbb-76ff-4b58-bca1-cbd3d628b38d	stimare i danni
3c306348-59bc-4009-98f3-4ac10065848d	supervisionare l’apprendimento orale delle lingue
3c38306d-ef60-4f44-8f59-a98712cd29a9	insegnare i principi dell’energia
3c40db1f-93bc-4a1e-b7a1-7d01a1a67a56	utilizzare le tecniche di medicina nucleare
3c4b175b-233d-456c-8eaf-71132b211b7d	creare empatia con la famiglia della donna durante e dopo la gravidanza
3c4d6ec0-8483-4b43-97bd-0e8294c6e653	preparare pizze
3c546794-abbf-4c75-9b2b-375de9be8b85	preparare canapè
3c533266-58c7-4200-badf-f3ebce000ba3	regolamenti sul trasporto dei passeggeri
3c56acf7-fd61-4674-83c1-ecbb663b0f20	utilizzare un sistema di telecinema
3c33ca65-3bed-4cd1-a08b-d0527e426535	gestire i sistemi tecnici di sicurezza
3c5c46fd-353b-44c0-bde7-333dac91f6ba	operare in aree di crisi
3c571e06-3aa4-4564-a6f7-18b409cd1240	aggiungere ingredienti alla produzione alimentare
3c5813da-d352-4345-b7c6-cc100d48fef8	negoziare con i proprietari degli immobili
3c63fc4c-b91e-45cd-848b-7bd9ee40f4ee	controllare l’inserimento di dati
3c7e58d0-3c4a-4b60-b712-b1ff46d21773	allineare l’antenna alla parabola di ricezione
3c7567d2-6322-40bf-9be9-3d97444dc896	coordinare i servizi ferroviari
3c695bb7-a756-4ebe-8460-0a1b96ad7389	fornire un feedback sulle prestazioni
3c6d0dc0-c984-4e60-b677-b8b8f0f46de3	effettuare la manutenzione delle attrezzature di scena per il movimento orizzontale
3c8f43b5-0e86-4d69-a8ae-37e652b7bfbb	utilizzare gli accessori per il sartiame
3c94d667-58df-4567-9a2e-fa9165e61f37	leggere gli spartiti musicali
3c94fd80-962d-45c1-8581-bae7695f2fff	preparare le previsioni per il decollo e l’atterraggio
3c86892b-4d8c-47bd-b762-01ffe8bc1530	effettuare le animazioni all’aperto
3c974fec-c4e0-450e-8980-df6b854384da	leghe di metalli preziosi
3ca13f7d-a2aa-4b91-ae6e-298a3c6987b4	integrare principi di ingegneria nel progetto architettonico
3c9fab47-d4b5-4501-9acd-f38e921c7257	ottenere i permessi per un evento
3ca4422b-30b6-4f77-8dbe-aa29a1f013af	vendere le munizioni
3ca77be5-a691-4636-a26a-e0e41e382cbd	gestione dell’interruzione ferroviaria
3ca4893e-5aaa-4fcb-9b8d-0ac4a0e81530	relazioni cliniche
3ca30389-e5ea-4cd4-a9c7-52c5d02c0f09	valutare le proprie abilità nella danza
3cba19e6-3228-4606-b53a-ade80531c075	riporre gli acquisti nei sacchetti
3cbdfb06-7060-4dd2-b190-f40264c11185	gestire le petroliere oceaniche
3cc63f0e-9daf-4425-8d4e-781daecc0db9	irrigare il terreno
3cd88fae-9261-4679-8b24-5cb28cb3db0b	uso sicuro degli antiparassitari
3cc2368d-b125-49ad-a7c3-60ef205a8af5	utilizzare gli strumenti meteorologici per prevedere le condizioni meteorologiche
3cc3c160-d9ab-4e5c-b954-ab1d76a0b9b2	stimare il bilancio preventivo per la progettazione d’interni
3cdaccbb-b7df-41b0-8da6-f833329b9e1c	supervisionare l’equipaggio
3cdd2b22-d867-4cbf-ae96-02260ba9e280	ispezionare i cantieri
3ce202d7-8d41-464c-b4ce-81c8e86ccd76	fornire preventivi dei prezzi
3cdcdebb-306e-49b3-a6bd-4cfae0af9c88	garantire la legalità del gioco
3cdfb484-d804-41e0-9286-45a7bd7b74df	creare rapporti di infortunio
3ced6836-ad61-4897-8530-93284c27fa07	terminologia
3cf4e941-7d4b-4cf1-876b-e47cdf1cd548	insegnare scienze spaziali
3cfeb392-b5ed-43ca-b221-eb4537a85eb9	seguire le istruzioni del fabbricante nell’uso delle attrezzature aeroportuali
3cfcd506-d8ad-4c78-87db-cdf3e6e72afb	assistere nella gestione dell’istruzione
3d0cd879-04e0-4680-8749-f7827629f645	acque locali del porto
3d00f49b-8b3a-4c3f-a7b9-21b0cfb1ac12	controllare l’utilizzo delle attrezzature per esterni
3d079058-3562-4b94-8cbc-3de0f3e03d4b	trasmettere i resoconti forniti dai passeggeri
3d2d8c93-dc6d-4d08-a34a-7199834a29a9	pianificare operazioni sulle trivelle
3d0f6124-b855-4164-80cf-dbdbe13aee05	controllare il processo di vinificazione
3d3ddd71-3594-43f8-81ad-67d5e1541fa9	analizzare l’applicabilità giuridica
3d32285b-dcd5-4d1b-bef7-562072364bfb	installare un impianto fotovoltaico
3d3e2323-86cf-46f5-90a0-302d2b046f0f	comprendere il bosniaco scritto
3cf7a7c8-aaf2-4005-8615-4fccc833b183	pulire i veicoli stradali
3d216161-2ea5-424e-a317-d7f897b78b21	archiviare le cartelle cliniche degli assistiti
3d481389-d73c-4725-b776-7501bc2ea93c	utilizzare le apparecchiature di asciugatura dei veicoli
3d4a44b1-b119-41bf-b597-c41b13653a61	reagire agli incidenti nelle sessioni di musicoterapia
3d4a850a-c22d-4f8e-ac9f-84947c757de8	utilizzare l’ecoscandaglio
3d4f709e-ad56-488e-91a6-43a9c06ceb84	effettuare esami
3d507e1d-ba2e-48d3-ab21-4a2ed9d7e0cb	processi di produzione dell’amido
3d8056ff-ac35-4d8a-9c66-2d17ef379743	offrire consulenza ai clienti su tecniche artigianali
3d5c838e-be7d-4861-9073-2ff84da96a43	preparare le polizze di carico
3d7f8387-860a-49a8-b508-bc05cb783dcc	norme giuridiche sul gioco d’azzardo
3d81ffbd-d99e-46ae-a018-dbe13eda255d	spingere la barra dell’aria della vasca di anodizzazione
3d402f1e-aaf1-4504-acf5-d0228af36426	analizzare i chicchi di caffè verdi
3d8a7dca-cb5f-4131-9ff1-a6056e561534	lavare i costumi
3d98e6f9-421d-43b1-a72b-bbae3338a97e	tipi di levigatrici
3d990d7c-ceb4-4bb6-b70d-343cb964007a	gestire le strutture del gioco
3d983d6e-1e37-484e-8c14-1781251ef052	interpretare i segnali luminosi del traffico utilizzati nell’infrastruttura tranviaria
3d9b7d76-a148-4034-aaa6-d20e1fc20395	assumere dipendenti
3da66f0d-cce2-462d-9931-d0709ff7c817	fornire informazioni sugli esiti del trattamento chiropratico
3da4bc52-dc5a-47b0-b9eb-06e81f39bf7a	tipi di serbatoi da immersione
3da0601b-ec56-42cd-b748-3629ba6a97ac	riferire le letture dei contatori
3da8ccfd-53c7-4a81-a5e5-6c5c81d02373	mantenere il testo originario
3da5adc3-8a48-48d9-93f6-f1d8fdafeee0	usare apparecchiature di diagnostica automobilistica
3dafee7e-9b4a-4b52-8f40-aa1d65fecde3	manutenzione di prodotti in pelle
3db1e8dd-2641-46f8-9186-ae597abcdb01	collocare le cinghie trapezoidali sulla cremagliera
3db64264-08ad-4a8d-a77e-0bdb428710e1	coordinare i lanci di nuovi prodotti alimentari
3db7a626-9ee0-4007-9976-58d2668e1d34	collaborare con gli ingegneri
3dc24446-00b4-4329-b798-bfe1038654ad	sistemi di taglio automatico per calzature e articoli di pelletteria
3dca003c-f48c-45a2-bef0-bd991f2c55e9	essere addetto a macchine per il taglio al plasma
3dce2393-8622-46d1-9f3a-44d4585c214a	preparazione alla genitorialità
3dc3fd79-e407-4dc1-b338-565374f29c01	lavorare in un team aereonautico
3dcb5a39-a1ed-49da-ad57-eaac1b4d64d8	rispondere alle attivazioni dei sistemi di allarme antifurto
3dd14dd3-4155-4fcb-b498-5db82ce19d19	utilizzare presse, essiccatori e sistemi di controllo
3dd25e07-4bb3-4286-a070-26a11b9375ad	amministrare il patrimonio del debitore
3de776e3-6e9c-4713-b453-26314f07ab2c	tecnologia delle macchine di filatura
3dee1627-d689-4915-b291-a216413cb55d	usare adesivo in uretano per fissare i parabrezza
3de3201f-e3ae-450b-87e5-67d8e1f12d5b	rinviare i fruitori dei servizi a risorse della comunità
3dea3b4b-733a-4d89-9fce-87e51056e9ad	gestire l’inventario di una cantina vinicola
3de8d241-c835-4ed8-a286-f11bd207febf	eseguire l’analisi dei dati di sicurezza
3ded8639-d7bb-42ed-ac42-3421612ceb38	Scratch (programmazione informatica)
3df31ea8-c385-42d5-8b55-c7a6c2fcb437	COBOL
3df802d3-4e76-48a2-8842-adfb74563b2d	lavorare in un gruppo di restauro
3df7ee6d-919d-4881-a777-155428754557	ispezionare l’aeromobile in termini di aeronavigabilità
3dfebba7-6c01-4e79-ab69-1faa1ce9c848	riferire al capitano
3e0045c1-1967-4764-bbd3-04ad968ddb24	pulire le linee di erogazione della bevanda
3e04e80b-078a-404c-a2ba-1f20ae27dd14	creare le calzature ortopediche personalizzate
3e016667-f62a-409d-abb8-03ff4a7550a9	fornire assistenza nella somministrazione di anestetici veterinari
3e099fac-4ab1-4d2e-8536-5c620f42a886	materiale sintetico
3e0b61c6-0fde-4f51-96c5-2587630fb828	manutenere il sistema di sterzo del veicolo a motore
3e0cba8c-9375-43b0-917c-ea327c772e99	coordinare eventi
3e10ac20-a6b9-448a-a397-32c570b353e7	alimentare il bestiame
3e0d6da0-4e27-4c98-b709-c6ae375bc02f	partecipare a colloqui scientifici
3e1b4345-3e52-46b8-83d9-b331d6a03ba5	migliorare i testi tradotti
3e18b24e-3f5a-4d92-b2d8-43be71dd9d53	azionare i macchinari pesanti da costruzione senza supervisione
3e22e92e-ab37-4fb1-b926-c7a3a490cd3e	tipi di metalli
3e2699a5-f4cb-4f24-84a7-d4f487ab0a77	diritto dei consumatori
3e2f1c57-a0a8-4a74-bf13-63691ebbceb8	definire i dettagli amministrativi degli eventi
3e3b593c-c7b5-4a4f-acf4-c9dffc1aaf13	fasi di elaborazione del lutto
3e3dadf3-b971-480a-a0b3-9e1b84eec300	valutare le proprietà
3e4595d4-2b55-4139-bab5-271d30404f13	preparare le attrezzature per la pesca
3e3ec63e-0626-4337-890d-efc7fe853e2f	tipi di filo
3e4a2346-80e3-45a3-8ee3-8a18a172223f	creare un ambiente di lavoro nel quale gli interpreti possono sviluppare il loro potenziale
3e4c97cc-9f0c-4233-b83b-c92a1776bfa4	difendere i diritti umani
3e4f1284-ff61-44ad-8459-d7ce7f28a938	effettuare la manutenzione di macchinari di centrali elettriche
3e507e8e-0f58-450c-8371-2e7c89610628	maneggiare gli oggetti fragili
3e579f34-61c8-4e77-a74c-5e53ccc93fb1	gestire le operazioni nelle strutture sanitarie
3e554e72-d73c-4fd6-be46-fc14954120dc	determinare i cambiamenti climatici storici
3e60703b-a49d-42e5-80fe-71a1af2b9adb	Ajax Framework
3e608eb4-511e-4608-b406-38bbe22ccc27	verificare le dichiarazioni dei redditi
3e57e9f8-3271-4595-851e-0884072b26e4	gestire gli archivi digitali
3e6a123e-c088-466d-86b9-6c0282442d35	campagne politiche
3e2f1825-ff37-4ced-9736-606d93f11b45	Nessus
3e719d6f-69fd-42a9-bf4d-32864ced133c	scegliere un approccio psicoterapeutico
3e709497-aabb-41e0-9e87-d1df6620fd8f	monitorare l’andamento del mercato internazionale
3e75253d-48f9-460c-aad4-bc7221c7cf66	lavorare gli organi del bestiame
3e76beb8-ef92-4d3d-b02f-a96cd6be25a2	governance di internet
3e76d036-e4a8-4f76-b3e0-e7da35b7ae77	installare l’illuminazione
3e761a23-4080-4efe-8dc6-8d8b03fea7ab	calcolare i costi delle operazioni di riparazione
3e78c218-d526-4450-9c95-a6c2de353ca2	modalità somatiche integrate
3e84364f-2ab1-492c-b8f1-47b6cc25fe07	scrivere in inglese
3e97fd55-f687-45e9-a475-f78ef7cf004a	tipi di tram
3ea2b5d1-2b3a-47f6-9461-ece1985f9fd2	effettuare interventi chirurgici veterinari
3e8144e9-cd52-4963-86aa-45b8faa7077e	gestire il laboratorio di produzione alimentare
3e9c1cbd-12da-4e2c-98e1-3b1dd0f01fca	industria editoriale
3e8c2e41-e0a6-49e8-a5d4-df3c8801d1e8	tenere un archivio relativo al veicolo
3eae455d-2f93-4ea7-a11c-8bc5414da98c	preparare la cenere di soda
3eae921c-384d-4a3b-866c-1a142d4685b9	tipi di teste a forare
3eae179a-7412-4d5d-8a6e-5f14ae631d8c	utilizzare un jumbo di perforazione
3e958dba-3941-4d84-b792-c24d4f7165fa	eseguire la manutenzione del veicolo
3ebf7511-7606-4a54-b194-d3a969d28e29	definire i percorsi per la raccolta dei rifiuti
3ecf115b-4f88-42d5-87a2-63dc0b1e5b21	predisporre la gru a torre
3ed65664-6e8c-4035-8581-5f8b1634752d	turco
3ed05ffc-67e5-4489-959d-7003577028a5	rimuovere la rilegatura dai libri
3ec91558-916c-4059-81a5-18677f99eb81	offrire consulenza sulla gestione dei conflitti
3edab334-e1b0-49d4-8971-76c64a9691fb	negoziare i diritti d’uso
3ea8eafb-9067-4435-b1d5-3633396d79ba	gestire sistemi di raccolta dei dati
3ee8b097-b537-40c5-9445-b463df495214	pianificare il personale nel contesto della risposta alle emergenze
3eef86ce-00df-4c7f-a190-226d7533c19d	posizionare i rulli di raddrizzamento
3ef1478e-4e4a-4ce2-a9a3-78aea651d34c	prevenire le modifiche indesiderate alla progettazione del suono
3ef9a8c1-36a6-4d81-b624-91e79f194df2	restaurare gli orologi antichi
3f023331-f080-4a41-9681-13a9cbf0d111	comprendere il cinese scritto
3f0c13ec-b11d-49a0-a6a9-4bac6366fb5c	aiutare nel posizionamento delle lapidi
3f0c44cc-f14a-49b4-bf50-cbcd28cf683e	fornire i bozzetti pubblicitari
3f1fa2df-d86e-4282-86d0-4f235ea886f1	scrivere in norvegese
3f1a4a2b-b16f-46ab-8f73-0710f75f2f33	servizio clienti
3f2c65a5-e786-47f0-a5bb-b52a116bb0f7	ancore utilizzate nel trasporto marittimo
3f22b2b6-abd4-49e8-a307-8d3faa1b0ff9	produzione di piccole componenti metalliche
3f25499c-a84b-41ca-9cea-62ff4644c9e8	individuare i requisiti di servizio
3f2cacf0-3027-4e4e-b1e9-47d1c176f805	biomeccanica dello sport
3f2ed6be-2687-41ba-9933-df504845f820	navigazione astronomica
3f04191e-25ae-492b-84e9-fa37da878174	attuare le disposizioni di controllo del veicolo nelle aree lato volo
3f36d57e-f0c4-4971-9e62-973b416f1d04	distinguere tra i tessuti maxillo-facciali
3f3a442e-7278-48da-88e8-74f81521238c	stabilire le strategie di importazione ed esportazione
3f371d63-af35-41cf-9fa6-17ad69ebca39	levigare la superficie del vetro
3f546ea2-9c29-4c9d-85f5-e710f8d742fd	configurare i generatori
3f42c37d-01eb-4f2e-8067-167f3685adbd	sostituire gli asciugamani
3f412f1f-8c5d-4821-b71f-5c9eeb5f6b78	recuperare i beni
3f3158a0-d2b7-4dc0-a9e5-42743d7dbede	rispettare le differenze culturali nella preparazione di mostre
3f5a0837-fc8e-46dd-8463-94d01c738172	demolire in modo selettivo
3f3bdf41-f514-40a4-a664-9f096dfe5fd5	lavorare in un gruppo che si occupa di trasformazione alimentare
3f6db582-502c-4e4f-ab61-23d05ceb5d8f	conformarsi alle norme dell’ispezione veterinaria
3f6e9250-ef3d-40d2-b0ba-b575b0654adf	affrontare le questioni che bloccano il progresso accademico
3f6edf82-0e9b-4a66-94b0-5be8c86e695b	controllare i biglietti dei passeggeri
3f67c73a-9475-47d3-b73e-ccf4cac5f838	azionare le apparecchiature di segnalazione del treno
3f60d1da-694b-40bc-b69f-bb7f2d34d631	principi di gestione aziendale
3f5f746a-6322-4c40-bbff-2c017c6e338a	eseguire le ricerche di mercato
3f779ac2-c39c-4077-bf5c-3f2651ee7a13	eseguire i collaudi del veicolo
3f74e9de-106f-48a7-bec8-629045e06945	programmare la pesca
3f7e3539-3568-4e30-afc0-831c0e31ec15	gestire i canali di vendita
3f7aab29-a4ac-40e5-a887-296f7e56b1eb	effettuare la manutenzione dell’attrezzatura per lo smistamento dei rifiuti
3f92fe13-190d-49e1-ab73-ec02470cec95	suggerire modifiche
3f99e871-2927-4d13-a570-8a2d93706075	pulire i rotoli di inchiostro
3f9e7e12-d13a-47c6-8cad-e9c0efb9f83c	snowboard
3fa0b826-927a-4e18-ade5-78ca600bfbff	chimica delle batterie
3f934925-089d-40aa-af44-0df7e390c006	gestire la consegna delle materie prime
3f824d09-accc-4f3b-b29a-8c11407a61c2	Scala
3fa6b30a-4ecb-4386-853c-84033f941e86	trasmettere gli ordini degli ingredienti di panetteria
3faaa0bb-2652-4511-9f4d-559a661e7806	scambiare il denaro per fiche
3fabfbdd-66c1-4d91-81fc-33cedf4011d7	sorvegliare le macchine per le miscele infiammabili
3fa84585-9769-42bd-89c7-0791b1c93e56	sviluppare le adeguate misure di salute e sicurezza conformemente alle risorse disponibili
3fa9e7bd-a764-415e-a26d-3f5603231191	effettuare la manutenzione dell’attrezzatura per la produzione di sapone
3fa1c534-9b67-456a-9f48-28218928da90	apparecchiature elettroniche e di telecomunicazione
3fae5da8-c52f-4e89-bf37-09617f1b27a3	processo di maltazione
3fc3fb64-c0c3-4e85-9d3b-7cba4cb37fe6	svolgere attività di raccolta fondi
3fc40451-20b1-4bdf-899f-a1bcb973e883	macedone
3fac0abe-e853-4ec8-b077-698eba6e5849	tenere il tempo con precisione
3fdd47bc-b49e-40f1-9658-1f8038a0d3c1	chirurgia maxillo-facciale
3fe2f197-a809-4c4e-92bc-aa165a08bf3e	effettuare le attività di rilevamento per l’edilizia
3fdeb63b-ce50-4325-bc57-df786f35685b	concessione di pubblico servizio
3fc3ee40-8439-4e66-9794-fdaa1cbe4d0f	abbattere gli alberi
3fd73d20-bd11-4ceb-8577-37329c5d11c5	gestire le riconversioni
3fd82aa7-d8ef-4713-a215-8957d51bd7b5	approvare una campagna pubblicitaria
3ff0d331-6a5f-4e26-95a4-09b7a6119b16	analizzare gli aspetti psicologici di una malattia
3ff9e7c9-071b-4326-b951-9340280b944c	cantare
3fe590fa-5e0a-4383-8ccc-c6cb8b57ae9f	presentare esempi durante l’insegnamento
3ffde177-a903-4d0d-b24f-ea454852a5d4	essere addetto a macchine per il taglio laser CNC
3fe38ec3-bfbf-4882-9023-6e7cd31358b9	utilizzare attrezzature per l’omogeneizzazione degli alimenti
40196f72-b315-4abd-9ded-5b643f68f2ca	creare un piano di volo
4018445d-179b-4574-9341-91ba1a52caf4	comunicare con i beneficiari
4025f1cf-ff20-4fef-9c0e-42e753f507da	dispositivi di protezione individuale
40298ba5-a9fb-4a59-ab78-1c41d53ec700	disturbi comportamentali
402c41eb-c2cb-4799-94b8-ff9d57a9383f	interagire verbalmente in malese
40389be3-376c-4738-89ee-15ebcfa58329	controllare i sistemi di alimentazione
3fe9d22b-9c97-4d4b-84d8-3ac03796a7a7	ridurre l’impatto ambientale dei progetti di gasdotti e oleodotti
40318d32-1637-4184-a10b-1cb986ca7f4b	considerare l’impatto sociale delle azioni sui fruitori dei servizi
4044602c-beef-462b-8100-66f44466ab29	montare ingranaggi di orologi
4050f3cb-bac2-4e4c-b9ee-d82744ca252c	garantire l’attuazione delle misure di mitigazione della subsidenza
4066462d-da4b-4d07-8867-127713a5f5e5	colorazione dei capelli
40683722-a0de-498e-be69-16bf57522812	norme editoriali
406be767-e2bb-4c84-9fa6-69855d71b6c3	tipi di oli per trapano
4065392e-24fd-476d-9317-c36eb01c1b43	promuovere la salute mentale
407c1562-65a2-4376-8e60-9654f4023293	gestire i sistemi di assistenza all’aeromobile
40768de1-b754-4da3-8b89-6c0a9a05c7bd	analizzare le procedure per il riciclo
407d043b-cec3-4007-99b1-e89723596b98	invecchiare mobili artificialmente
4071d0f8-e329-4362-bc49-f5c50ec6984c	provare i veicoli a motore in condizioni difficili
405bb73b-00f5-40bf-aec4-e7787da25014	gestire gli obiettivi a medio termine
407acda6-3b22-4a92-93a3-285f9cccf218	sviluppare i nuovi prodotti da forno
407f6bdf-fe6a-42a7-9686-9f62f1af2617	incoraggiare i comportamenti sani
407fa35d-9a24-4942-a585-4ef4e42585e0	sorvegliare l’attrezzatura per lo scambio ionico
408e9ee7-7c62-4d3f-bbb9-b73fc1ab6a79	supervisionare la manutenzione delle attrezzature militari
408264a5-e011-4291-a163-9360028074a6	strumenti per la lavorazione dei metalli
4088b6fa-65e8-4a0e-9454-e57fe2143e92	standard di accessibilità TIC
4092254e-ba2c-42c4-aeb9-45cbf5a3a64a	sviluppare le politiche per i programmi nutrizionali
409d8671-69c8-445c-b55a-9d92533ad470	scrivere canzoni
40937305-0ab2-4609-a2d4-efc853fa4015	organizzare l’esposizione dei prodotti
40b25c9b-4774-4223-b014-5a11eca02753	organizzare la valutazione del personale
40b07a6a-97d1-4724-8342-4a13e6edfec6	partecipare a sfilate di moda
409b4ff0-4b40-4789-9843-e5fcfe984613	anticipare i cambiamenti nella tecnologia delle auto
40b351c0-553d-47e6-bdf7-47360d39d92f	guidare i tubi di perforazione
40cc2e7c-cd6f-405a-ac58-0dcedf4b43c8	adattare pratiche efficienti di trasformazione alimentare
40cf21f4-fc2e-4bb5-8597-43a4bc7d3695	rimuovere le casseforme del calcestruzzo
40a9f396-9934-4923-a5ee-c55622fec9e6	diritto commerciale
40bad83c-e643-42c4-8a6d-0f0a3c20f8dd	insegnare nella scuola materna
40d67396-4967-42be-971a-fba1ce11ca1a	promuovere la salute nelle cure specialistiche
409e3e93-9ee8-4598-9f63-c3c38b3a62bd	determinare la causa della morte
40a83b60-ccaf-4f69-b22e-7e169fd1e622	anomalie del software
40e47954-ed58-46da-a679-54a8022faa74	valutare la necessità di cura delle zampe dell’equide
40eb888e-3adb-4a10-a10c-4a7249afac41	monitorare il rifornimento degli scaffali
40f63010-a86d-4bc0-8b9a-c2605b82e9dc	prevenire le attività fraudolente
40d2e742-476b-4a28-ab31-f67ffc120f25	progettare le campagne di sensibilizzazione
410da238-119c-4fe4-96d9-2886399f7e10	acquistare materie prime
4113894d-9ffe-4f8d-a3df-b7419f5b15ab	importare beni di base
4114f6a5-3754-4d47-a4a5-1fbe2ad9273e	eseguire una riabilitazione della vista
4116fd6a-2139-423e-9820-366978602586	effettuare valutazioni del rischio della psicoterapia
410840dd-c63c-4e47-8470-41e6cee63bfc	assistere i clienti nella trasformazione personale
41179b62-c755-4bf3-9947-3bcfe0a2539f	posizionare i pazienti sottoposti a interventi
411b15f2-4e0e-478c-a02a-1223e9547bb5	ingegneria ambientale
4119c4f7-1846-4ada-8931-3c7b7baa9c01	suonare musica in un ensemble
411d6b85-b212-4fbb-abbc-f74efb00e3f4	stenografare
41236ffc-6cfc-4204-836d-25d5a8b19718	supervisionare il processo di riabilitazione
411df2db-9f7a-4c7f-9cdd-9856ad7a2d3c	trasferire i disegni e i modelli sul pezzo da lavorare
413289ed-a4e0-48fb-ae07-b3a243979d32	utilizzare i macchinari da taglio
412413c3-5d21-43dd-a7ea-e01baca28d26	medicinali per automedicazione
413e58f4-c8f3-4bf2-9fa6-6d4faab46d0e	garantire la preparazione del prodotto
4141dd00-18d7-47a5-8c3c-ced6aadcb3bf	montare le attrezzature di sostegno circensi
4145e5b9-76d2-4fc0-9c7b-82e5efbc3aac	praticare l’eutanasia sugli animali
414742ce-6777-4b05-9fa5-d28f5504066f	effettuare la manutenzione dei costumi
4141e02b-ce96-465d-b03c-eda1d0eb8798	seguire la corrispondenza con i richiedenti la licenza
4146d3a5-b01e-4d3f-bfd0-f89f6956c920	meteorologia aeronautica
414f97d3-5c1b-4d7a-99c4-c3efc79adaa9	stabilire le politiche di gioco
415df3a3-31c3-4789-a44d-38b74a42b53b	principi di irrigazione
41680ce0-b8b2-4a96-9fc8-1c8d6d294f1a	tecnologie di finitura dei pellami
4153d2c2-2ac6-4d9c-8ae1-65bf3d80a365	utilizzare gli strumenti digitali
4152e87a-cda6-4795-9e2a-59f957657e8f	supervisionare la manutenzione ordinaria degli impianti di illuminazione aeroportuali
417547f1-bcdf-407d-b864-fc5297cd4d48	effettuare consultazioni sulla presentazione della birra
417ae36d-5eff-4a0c-ab51-371397eca095	licenziare i dipendenti
417d4e5b-2501-4962-846f-ac734cdc79d6	DevOps
419b4e7a-3360-450c-9516-83ea58b5b285	scrivere in estone
419e44c4-71ef-4af9-a8a4-35b46bb5d86f	gestire sistemi amministrativi
418f6749-4407-4ae5-b462-f89b4c507079	utilizzare gli strumenti per il controllo alimentare
41aa4ef1-8d1f-4a5d-97a5-cc489c548a43	sistemi di controllo di volo degli aeromobili
41ae2247-d202-4e37-bc11-8e1353dbe1d0	gestire gli obiettivi di allenamento
41bda733-6f0a-43f5-bdfd-15e5ffffed14	laser
41c6df9d-b6c1-4e55-aa62-0c1075fd64da	controllare la manutenzione e la riparazione di guasti di minore entità
41bdcd6b-1d3d-46c6-be96-c7121f4a194a	controllare i serbatoi di stoccaggio utilizzati per il trasporto delle merci mediante condotte
41ccde22-13c8-4417-958c-9268b66bd719	informatica verde
41d191e8-ca89-4c00-adbb-4c0d0e3fe00e	insegnare l’ergonomia sul posto di lavoro
41b6d028-5122-4af2-8d77-d3118e6cee66	C++
41da27fb-f861-45ea-a2d4-31d3325d181c	utilizzare una macchina per la stampa su pellicola
41d5d4d4-606c-4ed9-98de-e4b2bf2736b7	affrontare i problemi con atteggiamento critico
41dbe871-281a-4506-8c26-805321a4c96c	effettuare la manutenzione di costruzioni in movimento sul palcoscenico
41d6f618-d624-45d0-b8e0-9b43c7261893	individuare soluzioni per la risoluzione dei problemi
41e3912b-dd39-4102-8af7-0f819d367d5d	creare i mosaici
41db904a-0cde-44dc-b1e9-630f55e98de9	utilizzare nuove tecnologie nella produzione alimentare
41e4ecb9-020f-4a90-b53d-4c517ecb5947	valutare le condizioni dell’animale
41e935f6-7f5c-4146-b052-e28aa8743be1	norme sulle apparecchiature elettroniche
41ee2d91-7ab4-4165-8386-fdd6113c934d	regolamenti di contabilità
42068026-e55c-4834-82cb-da53ab780ca9	buone pratiche per il backup di sistema
41fd7377-beaf-4092-bb3d-2e355fd9b996	promuovere la politica per l’occupazione
41fe62cb-ac38-428d-9503-7477bc9964ba	farmacoterapia applicata
4209ce53-d6a0-40d7-8878-70eac50f7fc4	ingegneria della micromeccatronica
420f9e75-10bc-4e56-9a3b-01a0987c1415	salute riproduttiva
421ddc4c-873e-4ffa-a669-0569de73aa8d	allontanare i giocatori che barano
4213c5b7-7b8d-44db-976b-786c968d27a0	risolvere i problemi nel settore dell’assistenza sanitaria
4221acfa-44b8-469a-93ee-e51e0d200582	ematologia
422f9d52-0156-45ed-bcdb-7ba521b2d625	elaborare descrizioni di elementi web
4224093f-a3f0-44fc-9971-360702c8fef6	formare insegnanti e formatori sulle metodologie e-learning
42255f1d-11bc-4636-b252-1cf7756b1580	applicare la termoterapia
42298cbe-458a-45f3-8aa6-dd7d0f710a51	verificare la conformità delle lenti
423404a2-e25a-4fb5-8496-02b0652595e8	effettuare ricerche sulle tecniche di saldatura
423468d3-3ae8-4be2-9bc4-cbe17365833e	gestire sistemi di qualità delle calzature
42381292-8e5e-46f0-8f40-546c35972453	comprendere il gujarati scritto
423cd004-342f-4d68-b559-95e0e04738e4	insegnare i principi della navigazione
423d0059-6610-44e9-bd2c-3ec520980adc	discutere il piano di dimagrimento
4249887a-120e-41d3-a55f-b51cc253a121	interpretare il diritto
423baea3-f13a-4b3a-a0a4-424ce05c3c29	raggiungere gli obiettivi di vendita
424a19ef-a1df-4de5-a611-429d650ca73d	testare le query TIC
42609aa2-0369-4303-bf3e-f95641b85c5b	oceanografia
424f4502-8fda-45f4-ba7c-65bb8a01b139	organizzare le strutture per il personale d’ufficio
425e13ee-c590-4b70-aa41-30eb578d29af	applicare la gestione dei rischi alle opere d’arte
42526d5c-97ff-427a-9132-29afa16b0777	gestire gli ordini di lavoro dei componenti metallici
4264eb0a-056a-47f9-b136-628fc80b9d96	norme in materia di apparecchiature elettriche
4251d2ff-7459-48aa-a840-5882cab55208	posare i pannelli per controsoffitti
426fbf73-b5a6-4710-a3cc-98651083664e	sviluppare un programma di riabilitazione
426e191e-bdf5-46e0-893e-151b2e25af5d	pratiche di macellazione halal
42710bbc-c021-4790-9987-51cd121724d7	asportare il materiale in eccesso
42795371-3684-4053-be05-83d9dfbd9bfb	comprendere il bielorusso scritto
427d2713-6c94-4429-b4c6-9c24cc954e0f	partecipare alle registrazioni di musica in studio
4295d24d-71b2-43b0-851b-c16a85f20240	esaminare le problematiche di conservazione
4286be54-f0a7-4bab-af58-3df11819c94d	eseguire il condizionamento delle foglie di tabacco
42813faa-a36f-4ba5-92ab-fb590d3be1ba	dirigere gli esaminatori dei sinistri
4283ba12-7709-4811-9537-f6f4579f3c1a	gestione di un’azione legale
4291f5a6-0b6f-4835-b944-e27b5fdbeed2	processi aziendali
429745d0-053e-468b-b416-046936417c4d	navigare con piccole imbarcazioni
42a03604-d5d1-4326-b2f0-bc1c18c9c49e	assumere autisti di autobus
42a6b3a2-2f1c-43a0-b72f-3805e466b12b	progettare un ponteggio
42ac7044-6be5-4901-a0d8-5e7a511bf293	valutare dati, informazioni e contenuti digitali
42b92427-ecbc-40f7-bb04-9b392adecf08	tenere traccia delle attività di riparazione
42b022d3-5508-4181-98f3-419733f6607d	usare tecnologie delle macchine di tessitura
42b26921-fc6d-4661-8fad-dd8cdc71fe6d	pulire le strutture da campeggio
42a18efa-b5e0-47d2-9fb5-810935c8c62a	garantire la comunicazione efficace nei servizi di traffico aereo
42c70a62-a962-4b88-a85a-590c858320ae	fissare con viti e tassellare i listelli di parquet
42ca4906-3995-4a7c-875e-4595ca9665df	elaborare definizioni
42cfd375-f69d-4851-b6d4-998acbfa79a0	sorvegliare la pressa a coclea
42d1f463-1057-41da-b3ac-ecc40697f0bd	supervisionare la produzione artigianale
42eb23c1-464b-4694-8206-c19e2c59f564	classificare il legno ingegnerizzato
42e8a79b-f8b1-4f2a-a9c3-f882a4d24299	redigere la politica di programmazione artistica
42debec9-f8a7-47e6-985d-136575663908	gestire le risorse finanziarie dei servizi connessi ai veicoli
42f3be64-32b2-4b79-9c7e-6ae8cbf9347b	individuare azioni preventive
42f056d7-37ef-4f6a-b27a-171429a0d718	usare attrezzatura di prova
42f6b8b7-5692-44aa-b986-89ca4e9f0ab7	azionare le pistole per spruzzare vetroresina
42f60070-5fc0-4aef-808d-9a98f1579d5c	processi di galvanoplastica
42d1ae1e-2e95-4f7e-ac4e-69562edcdc70	ancorare le navi in porto
42f9e739-0431-4240-90ea-63708c4dac27	valutare il lavoro dei dipendenti
430082a5-5538-4644-881f-3a05d5b75b17	effettuare una valutazione del rischio dell’idoneità fisica
430315ee-b6a1-4514-93c0-3435f0b6ba16	studiare la migrazione dei pesci
43067338-0d06-4071-a463-1c8c4327984a	proporre le risoluzioni delle controversie
430b1324-fc7d-4318-9e23-f50dc851fd8e	istruzioni delle operazioni di aerodromo
430ebdd5-c54e-46fe-9f7b-739c8dac4802	cambiare la batteria dell’orologio
43153265-1fd9-44ff-b008-b7978841f137	anatomia dentale
430994c6-f22e-468a-ab6d-3b8226ee9f24	preparare accordi di licenza
4311c562-953e-468f-8b00-335e34a9f9f1	applicare le scienze radiologiche della salute
4317e7b7-f90f-47cb-869d-8af70727907a	gestire contenuti online
431814ca-6d02-44a7-a932-0caafb1faab6	documentare il restauro
4316834a-ef4c-4ae5-98dc-b798c2d8d8f5	pianificare il taglio della moquette
43219d97-62a0-4b9d-b94c-10d4c060e298	produzione di animali da latte
4321c0f0-5650-48b3-bae4-26cde72781bd	studiare iscrizioni antiche
43225f43-3471-40f7-92aa-214bbc36860d	aviation system block upgrade (ASBU)
4333f705-b216-48f0-8d6d-16d36119e349	strategie per la gestione dei casi di abuso sugli anziani
4338e1e5-c005-4052-b8a8-e1d0ebc9ecd1	gestire le esigenze degli eventi
432f60a9-e004-44b9-842f-55a28e1fda29	gestire la logistica elettronica per le apparecchiature audio
433a4d1a-8d5a-475e-9c2c-faa9e3e815ee	gestire le attività di raccolta fondi
4337642c-479c-4ac2-8ebd-54782bc6914b	gestire le transazioni finanziarie
434493ce-65ba-4dee-9b01-c0abaead9835	parti di macchina per stampaggio a iniezione
4342a0db-f640-4060-9b2f-80a3266bf852	assistere nella raccolta di campioni ematici
4343567b-2771-412a-8bb7-6f8e93820dfc	valutare le prestazioni del personale nel lavoro sociale
4351583a-48b8-48f3-81d9-0a83a22551ef	insegnare l’elettrotecnica
434dc0e9-2da8-4858-be38-9f4c4c004840	lavorare in modo indipendente nelle vendite
43631107-5d8f-4a7f-9772-afd046699174	attività ricreative
43718831-7cd7-4131-832d-4d12a68fa021	sensori di fumo
43458b94-049f-420d-a610-0e748fee2e81	ispirare l’entusiasmo per la danza
4367b5ca-a88b-431b-9ff5-9e09b8a777d9	utilizzare rulli di compressione
437f482c-965d-43c1-b799-47e1d489cc4c	coordinare l’ambiente della serra
4395b584-e568-4a81-b197-ccb4a41537fa	essere addetto a telai per tessitura
43903c10-ef87-4f0e-ac97-bb62b187cde1	promuovere il libero scambio
439a416e-73d8-4ae0-b7ee-1e670a083133	essere addetto alle apparecchiature di raffinazione dello zucchero
4388a35c-64a0-49c0-981b-4293dbea5404	addestrare gli animali e le persone a lavorare insieme
43a816d2-8830-4618-99c0-6e57da5cea51	individuare indicatori di problematiche legate al gioco d’azzardo
4390002c-43df-4d8f-a851-41ce377c5c30	adattare un progetto artistico in base al luogo
43a80fb4-9490-4b4f-89a3-393c9934c74e	collegare i tubi in polietilene reticolato
439bb4da-c729-47a8-a060-4173733ba6ab	calibrare sistemi elettromeccanici
43a945e9-8060-4455-a67a-a555ccffe03b	legislazione in materia di sicurezza del patrimonio pubblico e privato
43b3bfc0-957e-43f6-bd66-953c52c66419	materiali per dispositivi medici
43b28590-1d60-4d76-aee5-468d7ffe5751	garantire la sicurezza durante le operazioni alla rete elettrica
43bfc604-d982-4229-a563-3c2e92c1f1a0	gradi di macinazione del caffè
43c7c15a-f987-4849-8dd7-a504d2abb29b	occuparsi del funzionamento della pressa
43c184d9-489a-4a4d-be83-4fa2074104d5	mostrare i campioni di pavimenti e rivestimenti
43c2a6b1-6102-4d85-85e4-a4820e966ae5	produzione di porte in metallo
43ceb5ad-a126-46d2-840d-c013b82304ae	procedure di collaudo di dispositivi medici
43cd1944-b8f8-4a8d-b215-fc3d70625d70	suonare il pianoforte
43cff6be-86d6-4e20-95bb-da3a64fa8385	negoziare la risoluzione delle controversie
43d791fd-3477-4fff-a841-6c62e69c3a37	preparare salse e zuppe
43cb928f-d961-478e-8fca-d1a08d7e4dd5	comunicare informazioni sulle attrezzature della miniera
43e497e0-24e2-4360-8aab-e93edf512867	separare le materie prime
43db67d9-5fc3-4448-87b4-f52bb7d17343	gestire le macchine timbratrici dei sigari
43dfd022-6f12-4400-b45f-88cfffe64299	valutare le conoscenze TIC
43e1c296-8c06-492e-887c-393961efba1e	analizzare i campioni di produzione
43e65080-2fa0-4682-b29a-1d54c37b2ebd	creare calchi del corpo umano dal vivo
43e6d30f-1b48-426b-8206-6b2dfceed807	produrre componenti per clavicembalo
43e9a035-0a13-4723-8af8-8ec1f8ab4909	coordinare la lotta antincendio
43eed4b9-3dad-4aff-aedf-e1edfab42dda	alimentare le tramogge
43f80fba-ef53-4b10-97a5-2c15507f610e	osservazione dei partecipanti
43f84a3e-1ffe-44a2-ac89-e7aae92b5838	controllare i punti di riordino
440bf7fd-c974-459f-8995-75ebe14dcdf0	verificare il potenziale di vendita della merce di seconda mano
43fce01b-ed9a-46bd-a6bb-0945c6a0e9fa	pubblicare ricerche accademiche
44028cf0-298d-4d85-b97f-c86989f72603	scrivere in azerbaigiano
440ef873-658c-46cd-9f88-e2d4acb8f418	componenti elettronici
441b11fe-c018-473c-9767-37514dcd100e	eseguire le procedure di medicina nucleare
441cdda7-b6eb-476a-b67c-6723846f0639	tipi di carta da parati
44201387-8fd5-4101-a84c-bd9f92481621	controlli auto
4428651f-35c6-475c-98c6-f4acc8270c55	monitorare le prestazioni di sistema
441dba9f-1c30-420a-8988-9c4f14aca8c1	pulire superfici particolari a mano
44340688-291e-4ec8-bc05-1fa5bac07289	processi di eliminazione degli acidi grassi liberi
443b32dc-68fa-4f48-b6e9-252dce5d8562	assemblare batterie
443d015a-e788-4a85-bc1c-3f896271a1d1	sviluppare un lavoro coreografico
445859f1-4ae9-40d3-b35c-87c10a3d33ac	automazione degli edifici
444ce631-1a0f-45e9-895a-bd876bbe848e	parti di vasca per rivestimento a immersione
444ab6f6-bbb9-4932-b713-6bd6b937a075	addestrare gli attori all’uso delle armi
445e09f7-7325-448c-bc76-f14d0111ba17	controllore logico programmabile
445fb411-5a46-4936-ae1b-1c97058aa446	condurre operazioni di prova sui prodotti tessili
445fe884-ca64-4c87-8e64-77a0eac46775	informare i gruppi degli orari di arrivo e partenza
44655eb4-3f27-48c1-a8af-281b87b8aa4c	processi dell’ufficio di gestione della strategia
447f0915-998b-4351-875a-e9a94cc2a787	tipi di oli essenziali
446bb636-6cec-4126-9129-0f727b2c4193	elaborare i piani di trattamento chiropratico
44a11d0e-676e-46bc-8854-4409e688ad53	eseguire l’analisi delle foreste
44a2f206-04a2-45d9-b255-db12cfc643b8	stimare il valore degli strumenti musicali
4484d618-a20a-4b77-9bbf-f6e0ca291988	correggere le anomalie dell’articolazione temporomandibolare
44a51c61-c499-4d44-8097-cf8a5d80e291	gestire un server multimediale
44a839a9-e0fa-4cd1-a4b2-45ed8d99a97c	gestire la cassa
44b01fe3-40e7-4da6-a6ef-689516bbc90f	assemblare dispositivi di telecomunicazione
44b36ace-4aeb-4f17-9826-79f330fc1f0b	lavorare in ambienti freddi
44bdfc71-bc25-4f4e-8256-5bcbdc1a6113	eseguire la pianificazione delle giacenze
44b7053a-6d03-4a0c-9628-c9c206394105	lavorare in gruppi sanitari multidisciplinari
44aac3c0-82ce-467d-9758-0e53bdb97e70	gestire il personale di mediazione
44c3ae1c-6ba4-4694-8e5f-5faef5d37bc8	tecnologia through-hole
44d5f9b5-92cf-4fec-a8ad-b37e76c69462	negoziare tariffe turistiche
44e1c43c-b3eb-4e0a-9f2c-73d5aff20db7	installare software
44e53783-0e6e-41f1-9833-10eebc772d47	modellare sistemi elettromeccanici
44f2598b-0498-4e84-86ee-b5dd53847f30	floricoltura
44f8396e-1cfb-454b-ae28-c6b58f05a19a	riparare gli impianti idraulici
44f0d6e2-fe3e-4cb5-8a15-b6d9196fd3ab	fornire informazioni sui corsi di formazione
4500df36-7419-40f3-b1fe-978c1197d4bb	applicare i programmi di assistenza per i minori
450110b3-082d-469c-89bc-91b847a49587	trasformare i detriti dei lavori sugli alberi
450784ff-4dd4-442a-aa3d-82a6f2cb2579	mungere gli animali da latte
45115c14-3602-4cfd-95c5-7a0553560434	supervisionare i residenti dell’unità medica
4512741d-7f61-4834-92b9-9e31a02d9775	neerlandese
4513ad45-905e-41be-9392-5b610cf887e8	malattie infettive
451775be-2349-4c35-9e05-b804338c47ce	riparare gli utensili a motore
4518e17e-7874-4a4e-b118-12e90e2ee444	dimostrare specializzazione in una tradizione di danza
452f55d8-984b-4e3e-8ec2-de864a856a3d	identificare le esigenze energetiche
4526060c-aa78-4782-93c1-68a6f38af7c0	controllare gli sviluppi della scena artistica
4531bad6-879b-48ba-800a-9a0c9c5536cc	codice deontologico dei giornalisti
4533eb6a-208f-4062-94b4-a09a1231f922	greco
453493ac-0a49-4d07-ae10-664e55141d62	prendersi cura dei neonati
45359dc7-1a82-4ce2-9858-02d7495633d2	lavare la pietra
453ca7dc-9e03-4763-998a-ab6dd3e0dcc1	sviluppare gli strumenti promozionali
4541c3ed-2db7-4d24-9880-ca351c3151c7	gestione parco veicoli
45445f51-f44d-4b25-82f9-68ef806e5578	utilizzare gli strumenti per la costruzione e la riparazione
454ae732-b525-42ab-82a5-04c230854757	tendenze nel settore dei giochi e dei giocattoli
455852a2-5c4b-4d4c-82d8-b60cd6c28202	gestire l’umidità dei semi
455adedd-8ef8-4693-ad68-722f9d23d4db	fornire servizi di assistenza ai clienti di un centro sportivo
45586465-48ed-4331-92d3-558736d78945	utilizzare apparecchiature di taglio
456d4913-b6b2-4bd3-9c5b-cc904ae93f30	manutenere le presse idrauliche
457a12f1-c218-4357-9a99-fef987fcf0cb	varietà di miele
45820d00-24d0-4b8e-97ff-d81debf8fcfb	applicare le competenze cliniche specifiche del contesto
458e5103-72cd-4b9c-982d-c9c6de7d1263	fornire consulenza sulle questioni climatologiche
457e84a8-950b-40fd-a015-b4906ed65da4	preparare i rendiconti relativi ai carburanti venduti presso la stazione di servizio
45916676-8ec1-4d64-a48a-32bc45321b73	retorica
459346f7-8df2-4bfa-96ae-f5c797ad9a38	coordinare le operazioni portuali
4543561e-b04e-432f-a8e1-25b7ec7d85f8	condurre prove alimentari
45af2bb9-419c-41c5-b9dd-899ce40e979e	tecniche per il cracking di idrocarburi
459da9c5-5d59-4f8e-add4-cf1522794758	insegnare scienze della comunicazione
45a33a51-8b6b-49c0-92a6-7f4a570994f4	configurare la testa dell’estrusore
45b3c7e6-dc2f-47a3-86dc-644d2bd2a610	sviluppare le pratiche per gestire efficacemente i club sportivi
45bbcb57-ffbc-45c6-9cd2-9690087cb253	creare prototipi artigianali
45b85e17-cd6f-40ae-a849-66e45c224e66	azionare la stiratrice automatica
45ca26de-94f0-479a-a7c6-743ee190ab98	promuovere la sostenibilità
45b45625-73f7-41a9-a364-36abf1f33981	misure di protezione relative ai prodotti chimici per piscine
45d37b17-605e-4aea-ae41-33a2b21d23cc	controllare gli allestimenti di mostre
45bf3a8a-6d8c-47dd-8c9b-b2e4a658fa91	controllare le proprietà fisiche dei prodotti tessili
45df1ef1-9d2e-4ba4-a2ce-ae06befc4911	dare la forma alle unghie
45d3c850-c016-42a7-be3e-5c78f7a907ac	condurre le ricerche sui processi climatici
45dc890a-7eaf-42f6-844c-f587f7ffa8d2	gestire la separazione dei prodotti nell’industria dello zucchero
43cad1d5-6fd0-440a-a9eb-8e93f573a27a	nutrizione
45d4534d-55bc-4e3a-8cc4-2365594c35f6	pianificare le politiche di gestione degli immobili
45def1ea-c437-4a49-8480-cb39c2f10bd2	tenere un archivio delle operazioni di riciclaggio dei rifiuti
45e0e2d8-d1da-4974-8b89-ca764656a427	applicare la produzione avanzata
45e2bf93-bc17-4477-abca-8e2937601dae	scrivere in lettone
45eb47fd-e695-427f-b27a-54230b42c940	chimica
45efc20e-c579-4044-9525-333c2625284b	sistemi di alimentazione computerizzati
45f41f5c-7599-434e-8d4d-2c4a3205e9ba	diagnosticare le immunodeficienze ai pazienti
45e507e1-7b22-47cd-b874-ce6f757e22fe	istruire i pazienti sui dispositivi di supporto
45fdfaa5-bcbb-49b8-a226-779d4e4cc0ee	studiare le falde acquifere
45feabd9-7794-4e21-b943-ac18be4761e8	interpretare le procedure diagnostiche pertinenti per la chirurgia vascolare
460265b8-e78b-4708-9943-1ec43337920e	mantenere l’ordine sulle scene di incidenti
46104c6a-0987-471d-b302-ef907e064527	ingegneria genetica
461f5c77-d501-42f1-a486-8a6c589392c8	mettere in atto strategie di denominazione
461e99fc-e242-4aec-bca4-5f739d39bb71	supervisionare i tecnici di ripresa
46273679-38a3-400a-ba1d-39ae2a3d215e	assicurare la buona gestione di cliniche veterinarie
4630aa17-8ce7-4587-bcea-8dbab71ec536	requisiti giuridici nel settore sociale
4627c488-68a1-4b6c-b3c7-915c64f2eb51	offrire consulenza sullo stile di arredamento
463aa26e-b2ea-421f-9b75-fd007395a9b2	preparare gli ingredienti per la vernice
4646675c-28c5-4198-8338-d6d0dee722e1	trasferire il pesce
46499dfa-2400-4155-8e06-5fbc858a4d4d	tradurre tag
464eb390-7a2c-45f3-9eb7-f0feda8f1e60	sorvegliare il forno fusorio
464d2d27-9631-42a4-b03e-69ae0127cd00	tipi di circuiti integrati
4650e8fa-edb4-4ee5-8722-fa534630a633	bosniaco
465bbd3d-e646-49d7-86a8-98dbbbc511a0	tempratura del vetro
4678d0b0-25ae-465e-b9f5-ebd89a29e95c	usare attrezzature per la serigrafia per i tessuti
4668a611-889c-4ecf-83b2-0361876f0282	pianificare operazioni di taglio del legno
467ff9d3-8122-4723-8871-a40dfb4a1dad	negoziare i diritti di pubblicazione
467f2891-1752-4128-b7d9-2fb5292e68c9	sviluppare banche dati geologiche
46862a8c-8d78-494d-87a9-65293cc6ac2f	interpretare gli elettromiogrammi
46b4f6c1-c7c5-4ef2-80f8-b3804bf9400b	procedure della scuola dell’infanzia
46a80135-1e7b-4b66-90d2-b9ff9534a9f2	comprendere l’irlandese parlato
46b5c01e-eb92-4d19-a609-c2bb5d5a1fb4	elaborare le richieste di indennizzo in ambito medico
46a1f073-199c-4aed-9944-0df5280d9af0	pulire l’arredo urbano
46b5e75a-7586-4b6a-b894-4db10860f006	suddividere gli articoli tessili
4690b448-b214-4a05-8eb3-53161dd4bade	sostituire la lama di taglio nella macchina
46bfd5cf-742b-484b-a882-584233d5349e	agganciare paranchi a catena
46cdbe8a-12a8-4f2e-9791-79c4f09c5c21	cucinare piatti a base di verdure
46bfbb52-ec47-4b37-99fe-2a99f5faa56e	gestire vertenze contrattuali
46dafab6-eb32-492e-a8f3-d100676376fc	controllare il flusso del traffico
46e4e604-d3e5-436a-a631-175fd367fadd	azionare le apparecchiature di misurazione ottica
46dad64d-ae87-4e72-8151-5cf5e033cfaf	rispondere alle emergenze nucleari
46e56bcf-3f83-4ef2-be35-843d446a1772	ottenere l’approvazione dei fogli di presenza
46f70043-b89f-4e50-bb67-0241a3c79170	scrivere in giapponese
4700c68d-7975-4db4-b4a9-65024c833bc7	lettura del labiale
4700c48b-2fcb-41e2-a071-d734cf2af19a	controllare la vegetazione
46fb034e-ee53-4063-a047-8648fddfda91	azionare la lavastoviglie
46f0e62c-0ec7-4a2d-b38b-896beafe3677	gestire le emergenze veterinarie
47035c25-991e-4d82-a308-c86b0099ad20	sistemi meccanici
470425aa-96e6-41ed-9dbf-7d6988f9428d	trattare i bulbi floreali
470856a9-b1fe-42db-8e07-a27596abb3ce	preparare le attrezzature anestetiche veterinarie
470b33a6-32c0-4218-95ba-5e7d207f5766	aiutare gli assistiti a sviluppare la percettività sociale
471399d0-859e-453f-9b1d-0d14777f9ff1	appendere gli animali
471ccd49-9034-428e-8a41-b1b708b59ece	aggiungere sostanze diluenti alla vernice
472a457c-248a-42a9-af15-05f2ddc9d3f1	comprendere il danese parlato
473b9215-588e-423f-bc00-a3095b970677	eseguire il monitoraggio terapeutico dei farmaci
47398580-c9b1-4117-b7ce-c24caf221cd4	gestire l’allevamento di struzzi
4742410f-b091-496f-a6ef-2105931a0490	tipi di pietre per incisione
47205cf1-3df0-447f-b93e-e349579d5cd1	fornire consulenza in casi di emergenza
474a4371-7dde-42f5-96df-571ea6da6734	lingue moderne
4749c3bf-68fc-4cf7-a2d3-2fbb65dc4470	interazione uomo-computer
474f3a0d-8735-47e7-86e1-f6f3fe1a9c33	software di montaggio audio
47512319-6274-4f52-ab0a-8abc3221de33	norme sulle apparecchiature ottiche
4751a5ae-7f99-4b37-9ece-1d8b8ccd2682	applicare le norme relative alla vendita di alcolici ai minori
475fc98d-7709-4125-9f38-3eb687431667	scienze comportamentali
4752d91a-4dd1-4e42-a276-b8bace797a7e	formule e tecniche di disidratazione dei cereali
4771935d-6b24-4111-9b4a-d95ab3ba0282	immagazzinare le merci con precisione
47649712-ec75-4bc0-a333-b564326858ce	progettare sistemi di fabbricazione dei farmaci
47732808-b028-4307-be2e-a0171ee0af3d	ideare gli oggetti in vetro colorato
4781d3bf-358b-449e-aedd-d10f6e6c68e7	chimica organica
47996c0a-8d43-4ab8-badd-288ae48f6d9d	utilizzare le attrezzature di diagnostica per immagini
47974a5f-7b61-40fc-908e-b75c6a68b368	riesaminare i dati delle previsioni meteorologiche
477c9823-2404-49dd-b065-abda4f1f9f37	garantire il benessere degli animali durante il trasporto
47a26114-ebc0-4a27-a6f4-e771ac60d2a4	azionare le attrezzature di illuminazione
479c72b2-b993-41f5-a751-ae982c2348b9	meccanica dei velivoli
47a48c96-1303-4427-949e-f7558a5be8c2	prodotti fertilizzanti
47a7bcbe-e1e4-447f-aa8d-229ddc8953ea	sostenere i fruitori dei servizi sociali danneggiati
47adcade-a1de-4a84-96de-0ac04ecebb5b	comprendere il giapponese scritto
47a4343c-a1e0-46ae-b32d-0175753a2a2b	riprodurre documenti
47b1f5ac-7c07-431d-b83c-40d4f677e2d4	mercato TIC
47b295f9-4f57-4798-be32-d9eccac8bc90	codici di zonizzazione
47b15c75-fea0-461e-80f0-a6d917cd5216	promuovere il benessere degli animali
47c02fb8-95d3-4b7d-9d0f-725eec05dc2c	applicare la legge sull’immigrazione
47c88326-4951-4d4f-b439-7e16d74dacd4	tenere le macchine oleate per garantirne il funzionamento costante
47c93386-5c86-4717-ad28-1686c2f5d119	piantare gli alberi
47cb6769-a3ec-45bb-af56-20fbdd97e684	azionare una macchina di verifica e conteggio del denaro
47cb2aca-61bd-47ab-a5b3-4cfcb1b3b1c9	definire i requisiti termici
47d20797-d2f8-4287-9344-8e7c50acf977	pianificazione dei treni
47ceabea-61d0-4361-b05f-6030b92a7d92	contare il denaro
47de0623-05be-4c68-9baf-62b15fdc1fb4	versare il calcestruzzo
47de734a-66a9-4f71-bf5b-23bdc482a864	effettuare i controlli di sicurezza
47c631ca-f878-408e-bb26-477c0a5e8c29	controllare la qualità di un progetto con una prova
47dfcda8-a82f-4cae-afb2-e22f8bc11697	assicurare la giusta atmosfera
47f0b6f9-d98f-462a-9110-9385d097ac65	primo soccorso veterinario
47e75b5d-dc41-4abc-9725-d93c77f42f7e	utilizzare i sistemi GPS
47f2a401-d716-452e-927d-ca378e84116d	tipi di zuccheri
47f7e00a-d11c-4e18-9606-5a19e86d5d19	utilizzare le tecniche di stampaggio
47e18016-c4dd-4767-8337-40380053a300	eseguire estrazioni di dati
47fa9ad2-1221-40d9-8702-9e12a07bf0c9	standard di sicurezza TIC
47ffc34a-0bc2-4485-b50f-00a94ea4b735	preparare lo smalto
47fda26c-2cf1-47b2-872a-6b912b056bc8	educare i dipendenti sui rischi professionali
480b50ef-12fe-402c-9b48-f7d6285c712d	analizzare la densità del cacao macinato
480c0f3a-5b83-4b77-a255-289bb0c6fb65	verificare l’identità dei visitatori
481d8f16-c987-4ba0-8608-25390656c950	effettuare l’amministrazione delle strutture mortuarie
481e95d0-1ecb-4b9e-9a4e-a2b579a23435	principi di funzionamento dei dispositivi elettronici
45ee4e18-9212-4b59-a418-e64f9da95ddc	monitorare il nastro trasportatore
48264a78-6b0a-4bb0-9d4d-57542586aa0c	fornire le attrezzature sportive
48318236-4631-4651-98c3-ac57c9271157	ispezionare le rotaie utilizzando veicoli per l’ispezione dei binari
483abfba-a195-4c71-9461-afe439843714	amministrazione di istituti d’istruzione
48353b94-f5bc-4d3d-98e7-76beb56d5451	interagire con gli utenti per individuare le loro esigenze
4842ad08-4006-44b9-aaab-295d5e9175ff	fissare i dispositivi di sicurezza
482a05ca-0570-4622-81ba-1fdfea4eee04	stabilire buoni rapporti con persone provenienti da ambienti culturali diversi
48445440-5240-4028-a570-6ad5eb783a65	coordinare la sicurezza
483da3d1-f603-4303-a337-61162d918160	gestire l’area di attesa dell’ambulatorio veterinario
48738f1d-f10a-4b2a-9362-df5c86985ab7	trascrivere le composizioni musicali
48786e8b-a581-4079-a256-0efca1eac10d	analizzare i reclami in merito a modalità di gestione rifiuti improprie
4844bf42-84cc-4654-8348-b38439e13ae8	impegnarsi a perfezionare la propria esibizione negli spettacoli musicali
486ba8d0-6f06-41da-b7fb-1ceb32c912c4	tingere le parrucche
486509b3-36a7-4925-b65d-2140b329703e	eseguire rapidi cambi di trucco
487a39da-7559-4508-8885-a3334df5200b	raccogliere informazioni sulle tendenze relative ai veicoli
487e57e4-3dd2-4e4c-8a67-70e4b847d3f0	individuare questioni legate ai GIS
487bab27-31d3-4921-9f94-1a92a3242744	parti di macchina rullatrice per filetti
4883be62-2906-4920-a1a5-c134081c05f1	alimentare le tramogge per il carbone
4880e46f-d59d-412d-a74c-66557dfb3fd3	yoga
487784ca-bd9e-4d4d-a91e-fc688031ae1e	manutenere la banca dati
48844204-dfcd-4d8c-a046-44d60f634812	comprendere l’urdu scritto
4891b1d8-9516-452c-aafe-8dac7b5e6d30	applicare un rivestimento ottico
4884999b-f564-43c1-a1db-464c1fd2a306	prestare assistenza nelle operazioni di soccorso marittimo
48931379-2669-4094-b9ca-31302b4ad7ea	comprendere il serbo parlato
48846251-f8c1-4a2f-ab9f-62af952727ce	far rispettare le norme di igiene negli ambienti agricoli
48964962-682f-4c1a-bda6-9c61fa3d4b90	riparare le armi da fuoco
4890cde7-6f34-4966-b9dc-e949d550f82b	essere pienamente cosciente di tutti gli aspetti legati alla sicurezza
48a6850b-0655-47ac-a92d-f1fb12152dc6	convertire i diversi formati audiovisivi
48ae0259-87e2-4766-ae23-d88f60d1eef8	gestire lo stress
48c3c118-2d8e-490b-b2f3-b2123aebf6f5	prestare assistenza nelle funzioni religiose
48b89a37-a57c-4645-9cc2-408a74707636	svolgere un audit energetico
48b97f54-e849-4d61-95b7-de185f299c0a	comunicare ai clienti modifiche e cancellazioni delle attività
48d899af-7529-47a6-a561-18a2a4313ada	regolamenti sul benessere dei pesci
48e39ecb-b639-4a91-8cab-f1ef5b529ee9	colori del malto tostato
48d66a70-e2d1-4fdf-88a1-9bb93d936198	gestire i rischi commerciali
48e8dd50-1275-4e30-a9df-f120a485d0d9	promuovere la tutela dei giovani
48f72467-ab8d-4cff-bde5-7b92265e2d24	operazioni delle affiliate
4901d6d1-c524-4064-a445-b107adeded82	gestire i nutrienti
49069af5-bc3f-484e-b472-5c4b5d0f36cc	sistemi di ricircolo
48eebe8d-d90d-4a6b-9965-45ccefa2629b	ordinare le forniture
4906cee2-9f11-4441-b68a-609502f93c02	fornire l’assistenza postnatale
49072174-c3f1-4498-acaa-eca303ec02e4	interagire verbalmente in urdu
490e635f-cf49-4e43-b034-d36acfab05e6	utilizzare attrezzi manuali
490aa4f1-903f-4977-be4e-3a32e57e23fb	coordinare il reperimento di organi per i trapianti
490fa4fb-38c9-486a-9260-f6dcba4b96a9	microelettronica
491c5c4e-44de-483f-bdaa-d224a2b91835	fornire assistenza completa ai pazienti affetti da patologie chirurgiche
492b6018-9873-4446-be22-6e0e4944cfb9	smontare i motori
4925d544-f9d3-4f94-96da-e53896e118df	monitorare i processi di distillazione
491c944f-0f8a-4952-827b-1cb19c25e515	produzione di bidoni in acciaio e contenitori simili
492ba879-0fd0-4691-9d0d-6833b6265943	gestire la movimentazione del carico
492da840-3844-439a-a22e-90bc1af6ea30	dispositivi optoelettronici
4932968a-4e6d-4e08-bf06-0942b5df6aca	individuare i veleni
493e6d22-c03f-47ca-80dd-f836b34c4435	sviluppare le strategie di coinvolgimento di visitatori
4940ca40-fe03-45aa-818d-7c26205e8ffc	gestire le tecniche di attenuazione del rischio di cambio
4926346d-3663-49c9-8419-ac2a70987092	APL
4953bf91-3295-4991-aba7-103c8f3b8d20	normative in materia di trasporto mediante condotta
495579f6-d07d-45d0-84e7-21e9f01f9b2b	raccogliere le risorse acquatiche
49562880-cd0d-4392-b8cf-05dbbcfd6183	presentare la domanda per finanziamenti alle biblioteche
4968a611-5d2d-424f-b977-9568c49c10b4	gestire la chioma
4961f81b-237b-48ba-9b8a-02e26ebcb99f	riservatezza delle informazioni
4967accb-5276-423d-9f48-6109ca770dc3	scrivere in malese
498093e8-00f3-4978-872d-6cef95697c9b	rimuovere la ruggine dai veicoli a motore
497aa303-710d-441d-89f6-bfda659789f4	collaborare con professionisti
4981f9f3-33f7-4362-b603-3f2cd5640971	formare i membri dell’equipaggio
497fdd56-b120-4475-b2fb-9da11781bd92	utilizzare i pannelli di controllo ferroviario
498b558b-f995-4dbd-ab8d-51370fa9461a	modello di business
49654629-44eb-4d41-bded-c18397cabe05	garantire la qualità dei servizi di gestione delle informazioni aeronautiche
498c6af1-14ee-462d-80e7-34e9907c96aa	attrezzature da ufficio
496f93f1-7323-406b-81df-b1765ffc420c	valutare la produzione in studio
49910985-208a-45f1-8279-e96a909429b6	eseguire il restauro della tappezzeria di auto d’epoca
498c11fb-04e0-44b3-944a-058923b0148d	manutenere il sistema di controllo del processo di dissalazione
4992d46c-ab96-498b-869d-1a2128699f10	supervisionare il personale infermieristico
49a4d6af-c935-4f5d-8909-2b2f07381554	creare le linee guida del marchio
499db138-6944-4c9c-b785-430f88c6693a	gestire correttamente lo smaltimento di prodotti chimici
49b03159-5c07-413c-b554-7e2a87090e0c	analisi delle tendenze
49b44217-0867-4f00-b0a7-45db26c74826	effettuare la manutenzione della serra
49a8c3bb-6774-4ebe-8013-60a815b14c22	lavorare in modo indipendente come artista
49c20e75-a508-495a-8221-fd0e99d68e89	utilizzare tecniche specifiche di scrittura
49c3df27-51e5-4a1e-a3c6-12810fe3a0ff	promuovere il conservatorio
49c32e97-c52c-4417-9834-1aa8c8e3a52d	mostrare empatia
49ca223c-9e3f-47eb-9a26-49aae5d3a35d	tagliare i bordi delle pagine
49ce7000-b6a0-4f61-8a1d-b82036083e94	sistemi integrati
49bd841f-e261-443b-8bea-e6c05bf92f92	fornire le relazioni sulle analisi costi-benefici
49dddde9-20b4-425c-ba4a-923a60b981c7	pianificare processi
49e1c831-ef62-4d4d-97fb-3badafd77cd1	biosicurezza relativa agli animali
49b77ae8-d696-4410-9471-35513d8ff8a4	analizzare i megadati
49ded40f-3c50-443d-9674-59600e1032c7	tenere in considerazione la visione artistica
4a006d85-4389-4a52-a6e5-79b06f701ade	leggi che disciplinano la somministrazione di alcolici
4a01e8d7-092a-41c5-815e-95005cd8d3e9	preparare i pazienti per il trattamento odontoiatrico
49ef9816-cd43-4224-9885-6b7768b54eae	preparare la corrispondenza per i clienti
4a059840-69e0-4be0-bbbb-5999fedbd6b5	analizzare la qualità delle cure
49d68eeb-5ac2-40a8-b451-51d8c0977add	analizzare i dati della scansione del corpo
4a06126b-1070-42ac-a54b-ce7b1d4a320e	sviluppare la bibbia della sceneggiatura
4a0788ce-31a7-455b-9f38-0e8057950156	controllare la documentazione dei veicoli ferroviari
4a0b8160-edc3-4c6b-8ea0-7219d973ad60	appoggiare le dimissioni dei pazienti da trattamenti fisioterapici
4a0e050d-a408-4fd4-a758-71458bd8d709	progettare sistemi di flusso dei pozzi
4a109ba7-7611-41e0-9691-a64161ddabb8	prendere decisioni diplomatiche
4a2c9676-feb9-4934-9c84-169ca00842cd	elmintologia
4a2496b3-56e3-45f8-b7c9-e6c5ecd54138	caricare le autocisterne
4a292577-93ce-45c0-a241-9eb7b4b1c1e6	documentare le prove
4a3e2d13-459d-4b70-b617-309f8b6420c6	dietetica
4a44b262-6f70-4316-b40f-0a7794a406b4	misure psicologiche nella cooperazione con altri professionisti della salute
4a33ad3c-45be-4b36-9244-0ed2ebd232bb	provare movimenti artistici in sospensione
4a4d6545-f110-43fc-b903-a57581072674	raccogliere gli ordini dei prodotti agricoli
4a46f1d3-da1d-47d2-a6f7-8b88c30a7376	legislazione ambientale
4a45aec2-7a7b-418c-b0db-99de64ff1f40	digitare sui dispositivi elettronici
4a5928b0-08e1-4739-a654-ace2854b3a9c	tossicodipendenza
4a6ab980-d7a9-4d8f-9b23-442f4ee2897a	raccogliere i materiali di riferimento per opere d’arte
4a755d81-4290-4301-b025-a6a1c22d32e6	pignoramento
4a5a0c2d-dff0-4255-ae70-33370cac1e67	valutare l’ambiente degli animali
4a80138f-3747-455e-ad00-01d471a304fc	utilizzare una pressa di goffratura manuale
4a7fae07-00fd-43c4-b30c-e394e84a448f	gestire il legname
4a814863-3ecd-49c6-b0da-76368032f5c4	gestire le richieste di informazioni degli utenti della biblioteca
4a8584f7-b5db-4c6f-a68f-8e7ede579c92	eseguire gettate per fabbricare anelli in calcestruzzo
4a85c750-783e-4034-b198-8ad570e48c48	tipi di materiale per intonacatura
4a85f807-376a-46fc-8837-a30aaba78762	sviluppare le strategie aziendali
4a918e20-8193-4071-a857-5324787814ef	geometria del binario
4a992bc4-36ce-46c5-ad88-0f9da46511b0	vietare le telecamere e le fotocamere
4aa0aab5-7354-4496-ba54-3cda2bf5d561	test sensoriali quantitativi
4a978c97-1dfe-4694-b1d8-c913ecfaaee2	calcolare il costo dei consumi energetici e idrici e del gas
4a9c0f3c-c5cc-4a26-a01f-202e89c0f1cd	assistere gli autori
4a9c98dd-8f09-466d-bfd3-fa762db70269	svolgere le attività di contabilizzazione dei costi
4aa0b883-cfc1-42f3-b17d-295e6d2263ff	ideare le procedure per il trasferimento di merci specifiche
4aab2d84-6e0d-401c-aac9-f79aaa5908db	garantire l’approvvigionamento adeguato della farmacia
4aae4c0b-08c4-41b4-8c44-968f7500debc	operazioni di molitura
4aab2e2b-d746-469a-826f-222f15a33ff2	preparare prodotti da forno
4abe6251-09db-4437-8404-f49e2dc1453c	grafica in movimento
4ab424b1-0bd3-4b2d-9dce-c767503ce500	assicurare la precisione delle incisioni a bulino
4abf7936-b422-4f9a-8109-fa41486a9be5	algoritmizzazione di processi
4ac74310-a3aa-4bcb-9715-3b33ef484f02	utilizzare l’arte in un contesto terapeutico
4ab98157-1e19-45c5-bea3-d1bcd5d46d2c	creare un’atmosfera di lavoro volta al miglioramento continuo
4ae48e3a-6418-4e86-b5bd-a465cf521b7c	influenzare i legislatori
4ac98901-a52b-4e1b-a04c-48705963d1cc	garantire il rispetto delle operazioni doganali
4ad47a8d-17bb-4558-8a25-0815c4b648f4	analizzare le prestazioni finanziarie di un’impresa
4ae83083-315a-4426-bcbb-37a96c08da91	applicare tecniche di metallurgia di precisione
4ae32b17-c9d9-405e-b591-9d657904e0ef	gestire i processi di estrazione dei succhi di frutta
4ae947bf-a9d5-4345-af5c-53a5acaf5786	valutare le prestazioni delle operazioni ferroviarie
4aec74c3-dec8-46f9-b123-31949dc67449	applicare il massaggio sportivo
4aef5ff9-e318-4af1-901c-8191bbff2338	pilotare una nave per servizi medici di emergenza
4af1fdcc-5323-435c-b216-aff5f0312b90	azionare veicoli corazzati da combattimento
4af5fc5c-eb66-4be4-b689-fb3e01214274	anticipare le esigenze di movimentazione per la spedizione
4aef95fa-b6ec-4ea1-9aef-cda7eb5919fe	misurare il pH
4af83ffd-1062-4cc9-9e6c-6fbf2e0315b4	salvaguardia e conservazione degli alberi
4b0146f1-80ee-4784-bd08-b1b4f12d9315	individuare le caratteristiche fisiche dell’esecutore
4b0f1607-e470-42c2-b217-f93595c6cda4	ridurre al minimo l’impatto ambientale sulla zona circostante
4b02c75b-42f3-4b4f-8f56-5c5cd0cc2e17	tecnologia a montaggio superficiale (SMT)
4b11feca-b337-49de-bd4d-bc6ae83ccadd	riscuotere i canoni di locazione
4b019b43-de9b-4d4c-9e07-a84dcae45a44	utilizzare le apparecchiature radio
4b161723-12c0-4d6a-bd9e-6ac61ededcf8	sanscrito
4b1bc390-1c9e-4192-b4c8-7a44f9076f06	tecniche di saldatura
4b34a68e-091f-45df-b369-d601bab8656d	interagire verbalmente in catalano
4b2a2706-7d45-4612-bb3d-ebdee70b2e90	calibrazione dei pesci
4b1e1135-18b5-4e06-8874-a76971cfbc5b	eseguire i processi di produzione nel centro di incubazione
4b386371-afbb-4f9e-a74b-a2cc424e7951	eseguire i collaudi sui veicoli aeroportuali
4b4f6d22-1575-410f-b6dc-422968990684	sviluppare il linguaggio fisico
4b40546b-e685-4f3b-b2c2-22ab631debd2	applicare principi di tecnologia alimentare
4b4f6209-73fb-4b79-b221-a9033c03e42c	attrezzatura da campeggio
4b4eaf93-96cd-426f-9c06-df5c5d97a216	specie acquatiche
4b61ca99-cd4b-4da1-9048-bcc6c103909d	mescolare l’inchiostro
4b591d9d-e0ce-40ad-87be-94e6d734f533	supervisionare la cantina
4b55d95d-94c8-44ce-9e24-06a0644b99c4	organizzare conferenze stampa
4b5beb30-7638-4a69-b28c-a8212946f8ee	osservare gli standard di igiene personale
4b4fe5c8-349e-458a-9e12-3e4c4f7d9b00	applicare tecniche di pre-assemblaggio alle tomaie delle calzature
4b624363-de96-41c5-8e17-08f8b03bff9f	notazione musicale
4b671956-2faa-4bfe-8d6b-9c5ea5bc7928	acquistare diritti musicali
4b71ee5e-9182-4ffa-a624-2e5848637f0e	comprendere lo slovacco scritto
4b70fe6c-37cb-49f0-ad28-3eda85325b8b	utilizzare strumenti manuali di rettifica
4b73f1dc-5039-4ce9-b64c-94dac3185580	riparare il cablaggio
4b76ac90-5271-4e5a-a333-70ac60e40337	oftalmologia
4b796973-7be6-457f-91cc-263201872292	gestire la casa d’aste
4b8c9431-04b7-4bc7-92dc-bd2eaa5563dd	controllare la qualità delle uve
4b9844b8-4746-4155-9cd3-65ee1adb6202	installare la piattaforma petrolifera
4b9cf6b1-0efe-4091-80a7-550aa4afaad3	controllare gli arrivi dei treni
4b9095ce-7e3a-4e09-9045-e80375c827f9	mantenere le relazioni con i rappresentanti locali
4b9d5859-6e77-4556-b818-f55ca5041f77	eseguire il controllo della qualità nei laboratori di microbiologia
4ba3fa5b-1158-487f-ac8c-c5bb5fdeac66	dimensioni dei pallet
4babf50a-a325-4f1c-973c-faf9305b0f90	scrivere in punjabi
4baaf7b9-c863-439e-ab3f-b4ce2f445b95	psicofarmacologia
4baf2ad8-d77f-434f-bc22-925929904399	classificare i libri
4bb1f4a2-4134-4845-a313-88b1cb330005	azionare il giragiare
4bc8996c-0cbb-4b23-b01d-401718489629	creare giunti in legno
4bcb10bd-6c6c-47ad-b537-2a0a993d5f7c	eseguire un intervento di chirurgia cutanea
4bd81ba2-f634-4f70-a224-279f9cecaf80	creare strutture musicali
4bda34f4-f731-4895-ae72-12ebf08e7f27	tipi di frullini
49f4beb5-7907-4ac5-8366-721af2b67a75	offrire consulenza sulla catena di approvvigionamento di prodotti dell’acquacoltura
4bf3a193-8b1a-41fd-9714-cdfbed1b5bb6	utilizzare il tribometro
4bce6019-72ad-4461-be5f-72f4933891be	ambienti per lo sviluppo di software
4be4d0b2-62fb-42a9-9596-b30aed866386	sorvegliare i tunnel di essiccazione
4c088ba4-f157-47fa-a45e-3e18cea1dcbd	effettuare la manutenzione del pavimento alla palladiana
4c020ddf-41df-4007-b2d9-eace06bca5b6	eseguire misurazioni geofisiche elettromagnetiche
4c08aaa2-4932-4011-a191-6326ff518f80	scrivere in maltese
4bf3ac95-bf08-417d-8f5a-909cfadb13f4	eseguire la verifica di campioni di materiale edile
4c241e36-f93f-4eae-94e5-52786e89e076	effettuare la perquisizione corporale
4c23558a-96a2-49d3-bd45-e2cd61b682eb	installare i piani di cottura
4c24aaf0-270c-4e35-a7b9-88ecb1a89edb	tenere lezioni di studi religiosi
4c2c51be-16d0-4887-b9b6-8b953b7b4473	educazione sanitaria
4c265aa5-cf20-4577-a8b5-b4eab4d10fb0	ampliare la rete di fornitori
4c2ea931-1864-4318-aec5-daf49fffdd47	sostenere un designer nel processo di sviluppo
4c331388-c20c-451a-a97a-d7b59aaa8e8e	informare il beneficiario delle procedure e degli obblighi in caso di concessione di una sovvenzione
4c3385dd-b38e-4ced-b8bb-07279d1f5685	condurre i cambiamenti nei servizi di assistenza sanitaria
4c33fc91-6b1e-42f3-97a5-923a48a9f18f	metodi di raccolta delle piante
4c373ca2-a25f-4e23-a393-d5b99c256c46	offrire consulenza ai clienti sulla conservazione di frutta e verdura
4c3c6e24-9e17-424f-b0e8-f52205858595	prendersi cura degli anziani
4c47cf32-ae59-4c92-82bb-4371dd032b77	prendersi cura del gregge
4c4850a2-09f5-4720-b63c-edb700fa1da9	logica dei giocatori
4c3d4fc4-dd19-4e83-b901-919fa913aabb	promuovere l’uso di energia sostenibile
4c4de379-fa18-4f50-8db9-1ecaa9f33488	realizzare sottotitoli
4c54c8a3-f230-4a16-95f3-e031fcf12316	unire i frammenti musicali
4c5575a0-afbd-4cda-8e72-f989dcc8ad6d	sopravvivere in mare in caso di abbandono della nave
4c6071e2-270b-4197-ae7a-a08afb5e5723	essere addetto alle macchine di miscelazione delle spezie
4c5f1106-ec52-4236-8a84-7825c846f543	fornire sostegno agli insegnanti
4c609ca6-562e-465e-85a9-dab65e902e6f	tecniche di sondaggio
4c5e5e01-ed7e-4cf9-9b4d-6d54927c9146	fornire informazioni sulla manutenzione delle lenti a contatto
4c656eb3-6061-4c6d-bfd2-30e2bc5e73a7	fasi alcaline dei processi di raffinazione per gli oli commestibili
4c739480-bd2a-4820-8f80-d1a5be53a7bc	gestire le partenze degli ospiti
4c61d2c5-f96d-41c4-ad05-7a0368929a41	osservare un codice deontologico per le attività di traduzione
4c639d10-8f51-4aef-be19-d7c36c65677d	interrogare le parti nell’ambito di indagini sul benessere degli animali
4c879833-714c-4edd-a2cc-0ddfa6e3d4c8	comprendere il vallone parlato
4c7f2112-3e9c-43e6-bb87-b3565d2f07a8	comunicare i risultati del pozzo
4c8d2ced-488b-44b0-a812-c9d1472273d6	patologie del piede
4c9746cc-3302-4a6b-8fef-337ea04e3279	produrre campioni tessili
4ca06783-ca12-4192-b37f-e6c9b61b7d4c	gestire i favi
4c83c2ed-fd8e-4988-8614-276499f3d86d	applicare le strategie di insegnamento di Steiner
4ca6848a-68bf-4670-a745-7ba66fc6966f	comprendere il croato scritto
4ca9bdc5-70cd-49f7-acb2-362e47450895	fornire un trattamento non chirurgico nell’ambito di procedure cosmetiche
4cb26b28-ef24-4cd7-8be9-bb9b80e00ab5	tecniche di marketing digitale
4cb40b9d-7432-4163-a9c0-5eb1c30b2405	farmacognosia
4cb0800e-1137-4e60-8a39-6e7a85f14ae1	utilizzare le attrezzature per la pulizia della canna fumaria
4cd05eeb-29bb-48b3-b954-2e6fbe32be36	controllare l’allineamento dei mattoni
4cb60e99-0aaa-4117-baf2-2544046d4bac	effettuare tutte le esercitazioni del piano di emergenza
4ce1ea7d-aca7-4fb0-a929-8df08bd7e7a4	energia solare
4cf43bc2-c8b5-4610-a02f-3c794d2dacee	ispezionare le attrezzature antincendio
4ce41337-c46d-49f4-831d-d1b18f760eb4	controllare la conservazione della natura
4cc2ce9b-7233-4b82-86f5-c478956c4575	leggere i dati operativi della nave
4cfb532f-715b-4692-b535-88b6e10bb2d2	monitorare la risanatrice
4d00709b-a8cb-4bf9-b2ae-ca2e809609c5	sviluppare le politiche sull’immigrazione
4d0070f8-19ab-4b1e-8ba1-1f94e40c652f	gestire il materiale aziendale immagazzinato
4cf80a10-a681-412b-9e9b-1ad7965349c2	provare macchine di sviluppo fotografico
4d0626e2-f8a0-4f31-8d84-30687f9b6181	applicare l’isolante in schiuma
4d098556-0513-4349-a748-c033f1332225	processo di produzione del gelato
4d0c887e-7356-4c3a-84ac-151822e242b4	prevedere i terremoti
4d0f99f2-d2d5-4f17-9669-0ae0b5bf3fd6	seguire i clienti durante le sedute di sofrologia
4d205cbe-b9e8-4255-b339-f0c84a1ce1a9	tenersi aggiornati sulla materia
4d278843-174a-466c-9150-52b2ec02f020	monitorare le tendenze di crescita dell’aviazione
4d26aff4-08be-433c-b678-95b2b37e2f48	Unreal Engine
4d1e25d0-1762-4015-b66b-f745243a7593	negoziare i contratti di compravendita
4d45c8d1-e00e-4e06-8703-fa8158a38881	sterilizzare i serbatoi di fermentazione
4d4f59fa-b48a-4cbb-baf9-8904a545d9b8	eseguire traduzioni giurate
4d5fcecf-c6d6-45e3-8231-916adae14fb8	preparare prodotti di pasticceria
4d526f0c-cad6-476a-8252-ae70803a201f	offrire consulenza ai clienti sui prodotti di audiologia
4d61ca73-50ba-41b9-bf1f-395309a8e1ba	depositare le richieste di indennizzo presso le compagnie di assicurazione
4d5fcbdb-ee78-4d15-9f90-4357ce749c0e	tenere i contatti con gli utenti del porto
4d6e50a2-17ad-4bb5-b2d4-856870e02c70	analizzare la propria esecuzione
4d74699f-7971-4231-9df0-2b2308f11b1a	sistemi d’installazione dei pannelli solari
4d763e0a-41d5-4ea7-bd4b-4f6332e02ab8	effettuare la manutenzione delle macchine per la cromatografia
4d879cc8-ecfe-47b3-b77e-8e4433386939	analgesici
4d7698f3-19ff-469f-a342-5136af02ce37	medicina tradizionale cinese
4d7ada38-56a0-42bb-83cf-089f6c53e231	eseguire la decorazione di veicoli
4d7b2d3a-f6c0-4fe7-8be4-487740baaec6	servizi sanitari psicologici
4d981707-d034-4f45-ae10-47df238a1cdd	attuare la strategia di trasporto
4d88b472-eaff-43af-8581-d36c979f46d0	contaminazione radioattiva
4d99d657-0894-4818-8e3d-6274a551d232	processi dell’ufficio marketing
4d98a143-8339-4f72-a901-ab8a0020063d	effettuare degustazioni di caffè
4d9e59e9-00dc-457c-b57c-67d924d34e37	eseguire piccole riparazioni degli impianti negli edifici
4dab4b1f-4ae7-4e35-ba76-7849f922e661	processo di estrazione dell’amido dal mais
4da45e9c-28f9-4a91-aaec-7756da441568	misurare l’efficacia del servizio fornito
4db4b6cf-8d15-4bdf-a550-f5673fa8c491	macchinari per l’industria tessile
4dbe3155-ea7a-4287-bf69-3b22f800f1ec	proprietà di rivestimento delle condotte
4dc2aae9-5add-431a-b02f-ed1699313642	applicare i metodi di cattura dei pesci
4dc08d61-7991-41b2-aa35-5371628efd4e	allineare componenti
4dc5a813-d1da-4926-8c87-2340027ace50	gestire la vendemmia
4c0b9a5b-2579-4f88-9865-65151eef79c2	attuare le strategie di riduzione del rischio
4dd6ac3c-cd48-4e95-b78f-c5835c2423c5	neurologia
4dd7b964-eb52-43c2-a3e4-970c505796c8	creare procedure documentate
4dcd7199-a7c8-4c97-96b0-eba00de01fa1	struttura dell’informazione
4dd7fd19-1d72-48f8-b439-9ff60b7e8464	trasferire i disegni e i modelli
4de15b8b-425c-4831-9ba1-0837deee79bc	alimentare la macchina che produce scaglie di sapone
4db67c4a-5d40-4583-af6f-4c62e46b1d1a	caricare le merci sulle navi
4decdb46-a8f0-4a01-b66b-1cfe10a161c8	favorire il processo di offerta
4df27c7d-6148-4ab2-84f2-ce25908a2a62	applicare tecniche di lavorazione dei metalli
4df433fe-69d6-4f9a-ae0b-abe3c20f454e	preparare i documenti di garanzia per le apparecchiature di audiologia
4ddd2eb0-051a-4938-b540-c61f8668cf47	calibrare strumenti meccatronici
4dfc2d78-6082-4a13-acdc-15587e252116	rappresentare l’organizzazione
4dfa020d-7bfa-4ace-9631-c6f014e01134	stare in allerta
4dfe8124-8a7b-4385-9bab-e5544a5d544e	trasferimento di proprietà
4e02f49b-18e8-4f7d-88cb-c5ace493e3b5	creare nuove ricette
4e16783f-87ef-4e8a-a5bd-a771c5409b54	sviluppare il business plan dell’avannotteria
4e054a7e-cfed-40d5-950e-bc8f76f3ca45	applicare le norme sulla salute e sulla sicurezza durante la manipolazione degli animali
4e1a739f-5e4b-4f13-ae81-ad1a7c148caa	laccare le superfici in legno
4e16d811-d5ed-4cbf-bbc8-9139e26b2e1e	alimentare la macchina per la lavorazione delle fibre di vetro
4e2437d4-cc55-40d7-bad5-fe70fab24746	mantenere la crescita delle piante
4e16a0a7-cf1c-41f4-96c9-fccf1ac2dae1	seguire le procedure dettagliate per il trasloco di suppellettili specifiche
4e26f834-9ea1-4eac-bd67-e24c0109c0ea	politica europea di sicurezza alimentare
4e28cc42-d448-41a0-aee5-95ea86b9f29a	tipi di pneumatici
4e2d93e1-8c8a-47b9-a912-19cdbce148eb	nanomateriali
4e4afe9c-3f9f-4096-a80f-4bc1cf8ead6c	determinare il centro di gravità del carico
4e38ded4-7daa-4f27-8c7b-faebbe826d5a	analizzare i testi da illustrare
4e474b19-9eac-4de1-a071-1cc135d70588	utilizzare seghe a telaio
4e528794-4826-464f-bc77-06152ff25664	comprendere le esigenze degli animali
4e53bcfd-ddd1-4184-af3d-7a7b383aff5e	regolare i dispositivi di comando del bruciatore
4e54d003-045f-437b-899b-de69a6cb1c73	applicare materiale di flusso
4e54d5cc-e2c9-4caf-b860-2d601fe4e8f6	manutenere le presse idrauliche di forgiatura
4e551210-d236-4883-8174-083010544f0d	valutare i potenziali conflitti per l’utente finale
4e5a3093-c5f4-4a0d-89b1-e863a04f8307	ripulire le tubazioni
4e55cbf0-6fec-4681-847f-35a66866769b	pianificare un programma di istruzione sportiva
4e638b8b-d6d1-4c79-b6c4-2e30f383b3b0	ambiente software di sviluppo integrato
4e657b97-f750-4354-97ed-beffc507d860	medicina dello sport e dell’esercizio fisico
4e69eacb-b7ed-4322-bceb-f80965659572	usare le tecnologie digitali in modo creativo
4e6cd66a-e0a9-443f-893e-215774240013	collaborare con i professionisti dell’istruzione
4e70d15c-73d9-4f54-a225-dd14e9c443e0	materiali da costruzione ecosostenibili
4e7ccb66-2bf4-4d86-ac85-13bc2f4a01bb	dermatologia e venerologia
4e78631e-faf3-425f-90f2-409ebd610c44	tenersi aggiornati sulle tendenze del settore informatico
4e7535a8-eb8d-4257-889a-32cf5ec0da30	preparare le relazioni d’ispezione relative ai servizi igienico-sanitari
4e9a4ce0-3cfa-41d4-95b7-66b266d2cd7e	decorare articoli tessili
4e9de48f-8981-4fd4-b324-d6ed2d01b533	installare guarnizioni di gomma
4e9f1abe-0a69-4b46-8f78-b80ee72ee03e	insegnamento speciale
4ea317f3-0f46-4c21-a1e7-fa1b2bbcb0be	fornire cure per gli occhi a domicilio
4ea39224-4210-406e-a90e-05fb4b81205e	tenere la documentazione relativa alle protesi dentarie
4ea8f3a9-8cbb-46bf-ae69-bf29e8e22775	anatomia dei pesci
4d5bfd33-fb2f-4273-b1a8-b73dc95fe64b	preparare contenitori per la distillazione delle bevande
4ebffe05-2f1f-43d0-81b8-b8d489da06bf	trascrivere i dialoghi
4eb61157-c1a9-4676-bad9-b81a26af8114	applicare tecniche di analisi statistica
4ecb0b9d-d26a-4d05-897e-39a9f8c66779	supervisionare gli operatori di sostegno all’ufficio medico
4e9f73c3-b327-40ff-9220-12d0974d3fcc	pulire le pompe del calcestruzzo
4ed7dfc0-f128-4f32-917f-85d7ee8fcc76	somministrare sedativi agli animali
4ed24cee-aeac-4ea1-83fb-d0df7823e89f	spostare i ciocchi
4ed8f53e-57e2-4d2b-bd99-c1b08d36f2f7	creare gioielli
4ed92843-a774-42a2-9159-46866556b6ba	mercato del lavoro
4eda14a4-57af-4c9b-b028-763e77da3790	metodi di analisi delle prestazioni TIC
4ee0e5d6-a4e5-4148-bfdd-408ced397d3c	tipi di termosaldatura
4ed84ada-1941-4415-b76a-e539a3f6f2dd	programmazione web
4ee10574-563f-4ad4-af73-9759221f7d04	aggiungere colture di fermenti lattici alla produzione di alimenti
4ee686e2-554b-4170-9cab-58c8420ed59a	verificare il programma
4ef0332e-c013-45eb-ae9e-1bc49b01ae1a	effettuare un esame obiettivo in un caso di emergenza
4ef94576-a5f8-4329-8bec-3d825da31a12	astrologia oraria
4eef5883-eab9-4819-a97c-861e926bd991	sviluppare strategie di ripristino post-alluvionale
4f04cfd1-3314-4945-9ead-5435b1c32019	stabilire gli indicatori chiave di prestazione (KPI) del processo di produzione
4f131edc-c9a4-418d-bdd4-f8997822f6b2	manovrare gli autocarri pesanti
4f08c32d-eda3-44d3-b158-c49e456bdbe7	osservare procedure igieniche durante la trasformazione degli alimenti
4f095121-b41f-4305-93e6-3d20e02da9f4	analizzare i modi per ridurre il tempo di viaggio
4f205c52-cea9-4ca2-8bc9-41396fe25d7e	trascrivere testi
4f313a3d-a5ee-478e-b7cc-dafc4d0652a2	utilizzare le attrezzature per la pesca
4f207e3c-0fb7-4b66-8ed6-f7d7dee2ac1d	usare tecniche tessili per prodotti realizzati a mano
4f3a0655-eb5e-4ba8-9370-1745b2c5f792	effettuare la manutenzione delle apparecchiature di pulizia
4f4c3040-a5da-4cf3-896c-73b0768f856e	digitare a tastiera cieca
4f4e0c40-df0d-4803-995b-833f3cf08ca0	diagnosticare i disturbi del sistema urogenitale
4f4d8d12-92c5-41b0-a772-d9844fa56965	gestire le scorte di materiali di consumo
4f5d745c-6ab4-4c57-80bb-234764a0013e	individuare i miglioramenti di processo
4f5e4806-72b8-4bd5-8b0e-39f591aaf822	applicare elettroliti a catodi e anodi
4f471385-9e49-474b-a5e2-eafb3049a8ef	valutare i feedback dei clienti
4f6234e4-8760-4021-a45e-c2626b0d24d5	utilizzare la macchina per la piegatura della carta
4f690eda-92a1-4a3d-af2f-78cc4d45e560	gestire i reagenti chimici
4f6e7e4d-7b24-4cca-9b0f-d5c958684b88	gestire i coltelli per le operazioni di taglio
4f7cacf0-09c3-4a2b-8c4d-ed956a1a0847	tecniche della costruzione ferroviaria
4f664e48-b54f-4096-8ef3-20e1cc3a410f	collaudare le apparecchiature di segnalazione ferroviaria
4f80ed23-f259-444f-80f9-9c81b975e6ab	usare il linguaggio di descrizione dell’interfaccia
4f88995c-2b36-430a-a18b-c939967518b7	utilizzare strumenti di taglio per alimenti
4f89ad02-444e-41fd-b4ff-29794f58c9f7	materiali per calzature
4f8368ce-2392-4aec-bdca-6427c1cbf08c	sostenere l’accesso del pubblico alle mostre
4f9f7858-f9d9-4762-8ff2-ae895afaadfc	essere addetto a nastri trasportatori nel settore della produzione alimentare
4f9ce0d0-1c4d-4e68-95a2-e9fe89971563	mantenere un design responsive
4f9d31c3-02c7-4fa6-a78f-c0bd22d4c860	utilizzare strumenti di costruttori di orologi
4f9ec709-88e3-4da2-a2e1-9d452f793f68	tipi di estrattori di miele
4f931666-524d-45b8-b0e3-f48d0c9e39ee	comunicare con il personale infermieristico
4f9fe3de-4fdb-472b-b206-b753bd040307	eseguire gli esercizi per le esibizioni artistiche
4fa8f1c0-8f58-4c1d-9a89-25b31cf8d74a	tennis
4faf01a8-8410-410d-9eb4-4b288f9f3121	eseguire le radiografie dentali
4fa5a2f7-160e-43a2-9085-24d103e18a49	redigere il piano per l’illuminazione
4fb34ae7-99a5-4921-b414-e9ca20ce5394	mantenere i contatti con le autorità locali
4fb595b4-39a5-4b82-9315-f1b3237a29a0	selezionare i materiali per gli apparecchi ortodontici
4fb38997-9cf9-42f7-bd95-16d314539c12	gestire le foreste
4fc2e0ab-de19-4d63-b642-9433a5ab0daa	smistare il materiale rotabile nelle stazioni di manovra
4fc30be6-8c07-4837-9fa0-128eb25f299a	mercato editoriale
4fc8497f-1bd7-4487-ad39-dac110023b3e	riparare gli articoli di pelletteria
4fce8922-7879-4869-8a8a-b7cb7ca814a4	utilizzare la fisioterapia per il trattamento degli animali
4fcc44f1-c260-41fb-a47e-135767fce3c8	adattare il gioco sviluppato al mercato
4fcf4205-a1e4-4617-8a30-e7ca85f5d869	offrire consulenza sulle polizze assicurative
4fd4ffe2-c74d-48c1-86e2-077642597607	disegnare progetti
4fdc8876-abb8-4feb-a1e4-42a771361e3b	caricare materiali all’interno della fornace
4fdf9054-cb22-46c0-b897-9db224fa206f	utilizzare segnali manuali durante le procedure di trasporto
4febc781-9857-4a44-a4d5-386781ba5cd2	registrare elettronicamente le informazioni delle chiamate di emergenza
4fe4f970-9f50-45de-b2ec-306d0475e802	eseguire le ricerche di base sulla tematica di uno scritto
4ff62105-c991-4181-8eec-3c1301366b56	creare modelli di abiti
4ff6b491-13ab-4d7b-a42e-1ad1a8b811cd	produzione di oggetti di uso quotidiano
4ff6f3b2-18cb-4cab-b212-7bfc1cca9111	sviluppare un business case
4ffaa62d-25f1-4a6a-be57-626570610a1a	allevare galline
4ff85e6f-892c-4bf5-a453-7bfa4c707bf2	perorare la cause dei fruitori dei servizi sociali
5004cabb-1712-41a3-93f6-22ef20bc19d5	installare le vetrate strutturali
50000d5c-25d8-4061-909c-91bd5fdb43ac	offrire consulenza sulle acconciature
500fc8c9-6f93-408b-a546-75f7be5061b4	estrarre succhi
50095937-0afe-4e4b-925c-c7ebd5921464	esaminare i fondi fiduciari
5013c9cd-16da-498f-806b-32ec5d896691	preparare contenitori per la fermentazione delle bevande
501b925b-ee19-4602-af6d-f21a1066a6e0	produzione di utensili
500e8fd0-30c3-44dd-bcf8-9b58dcd5896b	sviluppare la politica ambientale
5021a5fd-56b6-4dba-933e-f6a648695d7f	effettuare la manutenzione di dispositivi protesico-ortesici
5023ce96-5f00-465a-9c85-1896197b6495	cura del neonato
5029bb6c-5876-48a6-bd1a-30f53750e7f4	adeguatezza nutrizionale dell’assunzione di alimenti
5028cd8d-213e-42bb-b682-c85a16ca63c6	scrivere in lituano
502dd29e-2745-45c4-89f0-3408a3ff9d3b	gestire gli iscritti
503d756e-3901-4bf3-868b-e31c01c93a1c	progettare il rivestimento in piastrelle
502ad8e2-e9d9-4185-9ffb-a127d9876b07	contestualizzare gli avvenimenti
5039c638-c489-4192-b358-61825ac9a14b	monitorare la linea di produzione
503f9cb6-8fad-41a8-a5ca-a14eb92beece	imprimere il disegno del circuito sui wafer
504a5b42-1be0-42f3-97ce-0cc4e9b7d818	depilare
5052098f-583c-4c7e-9397-a9dcbb60d346	intonacare
50524e9d-dd0d-4901-9f8c-390945a08067	analizzare il succo di mele per la produzione di sidro
50567c20-6128-4fc4-867e-886b9e07cf76	progettare attrezzature scientifiche
505dccee-80de-43d4-bcd8-cb3adf3dd47a	gestire l’accesso al caveau
5056e9f8-b3a6-469a-91d1-a9c858e58e65	condurre un’intervista di ricerca
50667419-afc9-49f1-b22b-d2904d51721e	composizione digitale
50608308-aee9-4e63-b701-2710d0271ed9	logistica verde
50685c32-93d4-41ca-8937-36337b38e2e8	livellare la superficie del terreno
507491c2-1024-45a5-97d6-d01497db529d	tecniche di gestione antiparassitaria
50759e9f-4c85-44b5-a239-64ed83142169	soddisfare i requisiti delle entità giuridiche
507a1e77-0235-41a8-a382-73baa2559881	azionare le attrezzature per l’estrazione dell’idrogeno
506ac47d-1f07-4815-a96f-e77d2f1aa33a	ingegneria elettrica
507b9bc5-0354-4b3c-880c-cdde4922bdc8	commerciare in strumenti musicali
507f1b09-2fea-4d43-b12d-e8c7bb4579e4	vendere souvenir
507f76a6-c121-4358-afcd-b5060692fc7d	sviluppare miglioramenti ai sistemi elettrici
507c07d8-cd6c-4378-bfb1-619f0054c43d	indurire il tabacco all’aria
508a9c91-5824-4793-aca4-1a9e8482c025	valutare il rischio di danni per gli assistiti
508de505-3592-4f61-bd90-5b3324ff6c6f	preparare le bare per la cremazione
509df454-2262-467c-82a6-1a2a6087399f	comprendere lo yiddish parlato
50a179a3-7af5-4d08-a6f9-1964a8cdddfe	tenere il registro degli azionisti
509e5171-a3ce-4367-85b0-98a76f136a0f	ordinare le forniture per servizi di anestesia
50ab81d3-eda7-46d7-8771-385f6d238a9a	controllare la qualità del vino
50adc5b1-9b8b-425f-b85d-69127d59a18a	controllare le forniture elettroniche
509dd335-4946-494f-a397-84c485face0c	identificarsi con gli obiettivi aziendali
50b7924d-ac66-436e-a73d-ecd41de06e68	analizzare le proprie competenze
50b4a431-6a30-475f-9210-36e267c143b4	creare bordure di piante
50b37566-f1fa-4a64-9d2f-32b69c159760	rimuovere la neve dalle aree operative dell’aeroporto
50c44c60-2032-4dce-97ea-31936720722b	guidare in aree urbane
50d111c4-0f29-4692-99b1-b592cff7338e	sviluppare strategie per la protezione da radiazioni
50bd5844-2866-41b5-8cf9-a57d765a22f8	trasferire l’ossigeno
50d80641-786c-4bdf-97de-b7466c351609	materiali tessili
50d9e527-4c88-4a57-abc4-b3ba7a99f655	tipi di sedute di psicoterapia
50dddc51-5c2a-4fd8-9526-4223645d4d3f	gestire le richieste di indennizzo
50fdb219-0d71-4167-9a8b-4bba0d3035c5	assemblare finestre
4de9bd87-1f66-42ba-946e-10486125e20d	sviluppare i piani di produzione agricola
51085ac8-7cfd-46b4-a894-97498000bfba	cagliatura del formaggio
5111a10f-fa84-4273-a4a3-87018e794369	selezionare le opere d’arte dei membri del personale
51110175-4efa-45f1-9807-4cec2dd15b08	elaborare teorie scientifiche
510ca712-be49-4900-82f6-1a2e8aa77421	tipi di presse per forgiatura
5114f9af-ce84-432e-b9b0-cfac5a20a9aa	individuare i mercati potenziali per le imprese
511c82c8-737c-4e62-9c4b-09255f952c5e	procedure di collaudo elettronico
511d3448-8181-4aa9-9150-0c6c24b8a46c	promuovere il passaparola tra i clienti di centri sportivi
5114d4ee-87e9-4c5b-b762-f219c2181061	definire i criteri di qualità della produzione
5121e6d1-ebf4-4db4-b08e-95b68144c8ae	convertire le valute
5121d6d7-659b-4bb2-a6d6-a0b57eb91441	essere addetto a macchine per la marcatura laser
512b951a-ed85-4d07-b5cb-57e988040bce	usare le tecniche di taglio dei capelli
511cfcae-1f0e-47f6-a940-6349e84588de	effettuare la manutenzione di sistemi di sicurezza delle strutture
511e02ec-7e74-4ce7-bfc3-728260ba7fa5	organizzare le informazioni operative tecniche dei veicoli
5132c1db-cf32-4013-94b5-974114b2fe4f	misurazione tessile
51309fa0-c852-41ab-a4c7-6bb0a78e2700	offrire consulenza su questioni personali
514272ae-b563-45b9-b805-8d8037421e0f	riparare i cavi elettrici sotterranei
513f83d7-519e-4d9d-a923-2fde071e5c3a	misurare l’area dello spettacolo
514b55a5-b95a-4bb6-b76a-92c916455dae	corrispondenza delle navi con le rotte marittime
51468f6e-5953-4ca7-97bc-2e9aa76e6510	dirigere le operazioni di distribuzione
514ddffc-5a55-483c-a866-c71d3fb202a7	svolgere la negoziazione politica
51522aab-4eb1-4365-bb85-4b210ac400fa	preparare ed eseguire le regolari esercitazioni di sicurezza
51563fb2-fae8-4deb-bb4e-e448c7a54ff6	praticare la vigilanza
5158f331-ad50-4c76-a1aa-c2f2720bf172	sviluppare effetti per oggetti di scena
5153b8f0-eace-45e3-882f-1946980199dc	gestire il suono in sala prove
5159cef9-dc6a-4676-8029-88a70767fd11	effettuare la manutenzione dell’attrezzatura di trasmissione
5160b782-7b2e-448e-b3af-ee52f5c8a6f6	essere addetto a presse
516d3e4d-8be0-429f-a478-683549e158b7	proteggere gli alberi
51709213-c1ee-43a5-94e7-0f107ac16ffe	metodi per la generazione di energia geotermica
5175ae74-5e23-473f-8be1-4b5e97ec421d	versare il composto nei sacchetti di gomma
516da6b7-939f-4662-8982-27cd4abd30b4	montare gli apparecchi dentali
517892b8-42e6-4523-b6a0-ffffc6da0f27	valutare gli eventi
50071b21-b6a1-4cbb-a6c3-ffc2c9d8505a	analizzare il rischio sismico
5189ef89-641a-4ed1-a0aa-2b98c03ca53f	eseguire prove di controllo del latte
518e5125-8a8d-4dad-8a76-ca6db321a4ed	assemblare parti in plastica
518dd29d-00cc-4f69-9b0d-b2bac2f6789e	fornire sostegno all’apprendimento nell’assistenza sanitaria
5189c6a1-fd25-42fd-8b7c-2c500a5237d3	praticare l’umorismo
5193926a-47a5-4ba8-a34f-fd3ad34aa8b9	prodotti da costruzione
5194239c-0b27-4cb9-8c85-bc57012a72f1	allestire mostre fotografiche
51a77697-7d9a-43b9-9bb9-cb17932b54e1	completare una dichiarazione iniziale sullo stato delle risorse
51999a63-95c8-425c-a133-d2229518c97c	raccogliere i dati finanziari
51ab4dbe-0350-40d3-8284-4c4c7ee0da80	ispezione veterinaria ante mortem
51a81eea-2eff-4da3-9fd2-cf07ac8c40d1	aderire ai principi di salute, benessere e sicurezza
51b46c7d-ec2d-45de-ac36-04db018d86be	aggiustare la tenuta stagna dei componenti della pompa
51bf2baf-bfb0-45cf-85b2-4dbf177b98e8	utilizzare stampi per ottenere determinate forme di impasto
51c937e9-60bd-4ec4-b108-4e275076fd36	presentare durante le trasmissioni dal vivo
51cf2244-580a-4b5c-ba68-14c20ff620b5	creare mappe strategiche
51cc53bd-313e-498f-8f55-ef00bb114964	eseguire l’analisi dei rischi
51cfe12e-be05-4003-9274-adbc39f983d4	componenti di batterie
51d75a79-0bb1-42db-a105-57c4e458722c	studiare le società umane
51df6d5c-d49f-49b0-8d13-df59ed150145	sostenere la salute
51ce2790-c505-4bd2-9e5b-2af2f0181208	utilizzare i sistemi di informazione geografica
51e35cb7-88e6-4218-8a17-384cba441043	considerare i vincoli del trasporto marittimo
51e0e5b6-76c9-447a-920b-7811b818fea7	etichette degli alimenti
51e4b7f7-fddd-4a90-a2de-63026e290a3d	utilizzare apparecchiature di pompaggio
51e5f485-b7ee-4f55-9090-b4f5ea749a99	sviluppare studi di trasporto urbano
51ea77c5-e455-4f66-9f89-7db35b126ebd	fornire consulenza sulla carriera
51f73def-0370-449c-acd5-89a3f731b41d	database
51fd2771-de04-4eb5-b223-d9c8fd71f38b	saturare il tappetino in vetroresina con una miscela di resina
51ee05f7-6169-4893-be2c-b103f5bdd54f	seguire le procedure di controllo delle sostanze pericolose per la salute
5208760d-b992-49d6-bc38-7ed83d2440e1	diritto di famiglia
5215e133-2382-4314-a52d-cc00ec869ef4	esigenze degli utenti del sistema TIC
521b1299-b434-46ee-92a5-9a1b6138ee2b	ungherese
521c3267-5d1c-4d02-a5e8-824aa9e0d5c7	HeroEngine
521c3406-a90c-435c-b380-1e28d581abc2	istruire l’equipaggio in merito alle attrezzature tecniche a terra
521c8a73-4a4b-4b11-9370-29eb5dc7c781	essere addetto ai serbatoi di immersione
522105bd-8c63-4cb9-95d0-f89595fce877	riempire le fughe tra le piastrelle
522acbe3-9033-43f9-a927-b5a5b8baaf72	valutare le informazioni nel campo dell’assistenza infermieristica veterinaria
5230267c-32ea-44f5-a8af-e72b372c21c6	ingredienti per la produzione del gelato
52261648-59ee-48cf-8bb3-c50b8d527baf	fornire la consulenza tecnica ferroviaria
52306281-abbe-407c-a8c5-7eec50aef71c	setacciare la polvere
52439b67-e85c-4556-b320-ba0579235afe	migliorare le capacità degli studenti di sostenere esami
52481249-9837-426d-8fbe-617739daf23e	coordinare l’assegnazione dei radar modo S ai codici dell’interrogatore
52484b12-0a42-4d2c-8f15-cd2100b007ee	terminologia medica
5242aa0d-8cba-4fcb-bbfa-a7ca78c1b858	fornire istruzioni sulla cura degli animali
524907c0-744d-45d0-848f-7b4dcd457e6a	distinguere i vari tipi di nave
524bbeef-2109-44d7-84a6-bcf3271f3cca	musicoterapia applicata
5248e8ae-5ef0-4a8f-8ac4-8f7c4222c496	immergere le pietre preziose in liquido chimico
5250bec7-1a32-453e-b1db-52d87d80553b	utilizzare la tecnologia a luce pulsata intensa
52580bb0-edd7-4b11-aded-cdb5c1879f95	gestire gli escrementi
525bba94-5993-47a3-b9db-2d724b2cc30e	trarre le conclusioni dai risultati delle ricerche di mercato
525cee8d-18e6-4667-9172-055e36e05f57	gestire le prenotazioni
5258ccff-537a-4346-8be6-c7ffa1f3aa2b	controllare le operazioni di pompaggio nella produzione petrolifera
525ec578-7cbf-4c57-833b-32361e1ffd6d	sviluppare politiche energetiche
525f6c63-a535-45ab-a745-cb4ec504e51c	interpretare la comunicazione non verbale
526e52e1-2e0b-4f9f-95e0-89e0c84482ec	fornire servizi di beneficenza
527ea4fe-feb6-4948-b1f2-6d64cba1da9c	sciacquare i capi di abbigliamento
529055b4-19b7-4805-9336-c6150f836dd0	migliorare la sicurezza dei medicinali
5287312d-5564-449a-a52a-487dc425ba30	raccogliere i prodotti del tabacco finiti
526fda6a-86ce-44ea-9711-3b34ed1b96f2	Perl
529f089e-0866-4efa-a255-99739f6b84ab	sviluppare le attività artigianali
52afc3a0-daef-47b5-b37c-4d66cd3c1aa3	ottenere sponsorizzazioni
52a3d3e6-b3f9-4d10-912e-edefc06b6d48	scavare pozzi
52c0c93a-8202-42e6-a882-b0d40f384676	applicare gli interventi di arteterapia
52b0840c-aa05-4d99-a20f-43b148582244	coordinare le spedizioni dei rifiuti
52c25782-fe02-4c6b-af2b-2964b91c32bb	settore dei giochi e giocattoli
52c26b41-1567-4903-a49c-d2b862e4e275	interpretazione vocale
52c6265d-3ac1-4ade-bc64-6ddd166dcf8d	valutare le prestazioni nell’ambito di eventi sportivi
52c2aa8b-547d-4a54-b18c-7f789cb8cda8	adottare precauzioni di salute e sicurezza al momento del ritiro
52e03ca9-9201-476e-941e-9fd1563b956a	stripping della stampa
52c9fab1-6b44-4c2a-a0a8-fb9d7c7bcd71	mostrare compassione ai congiunti del defunto
52f359a4-c429-4d25-982e-ee758c7cd706	utilizzare le tecniche di modificazione del corpo
52e73853-a3a2-4b51-a58c-b9ddf669bcea	allergie alimentari
530b204a-df0e-4295-a295-920e75d92598	configurare il sistema di controllo della documentazione
52f76d9e-d74c-49c8-a8a8-1c1e03f0ef01	mantenere i pascoli
530bcad5-25be-40aa-ba8b-b4f51c4c044c	neuro-oftalmologia
517a3025-a82a-4223-93a7-b64713bbd0e6	gestire l’assegnazione dei servizi turistici
51b005e9-8cc1-4bae-8192-a6b7b91b2378	chimica dei pellami
5314f5c8-0d54-421c-88a0-2df23356c2b5	tipi di goffratura
5326f844-2e2c-4b71-a361-89f0c4fbfc20	scienza clinica
530e26a0-7b8a-4ced-acd8-44c05b68e913	monitorare le condizioni della lavorazione
5317bec4-aa43-4a87-87e8-ace23b8f3286	formare il personale della reception
532ba6bf-11bf-4608-a40c-06753116369a	stabilire rapporti con i fornitori di attrezzature sportive
533035b7-a02b-4877-a896-2c58341ab2bb	progettare l’architettura aziendale
5327f2e4-f7b8-451f-a9a3-ab0f0564c8aa	standard del World Wide Web Consortium
533233c2-eed8-4f24-8a13-a4969975f91f	presentare la proposta di legislazione
533f5235-f2ab-46ea-a619-45e3ecee0f2c	sviluppare strategie a favore dei passeggeri
5342c649-488d-4a70-aa19-92917c36c7a7	pianificare le riprese
534f7cec-5596-4d68-adf6-b9ddbdd98f2d	tipi di forno
53419066-f913-44cb-9a03-645a8c674693	patologia forense
5349dce5-f657-4ddc-be28-c2784233862b	effettuare la manutenzione delle strutture di sostegno
5309c2cd-8573-4269-b056-d9c6dd3cd2f7	applicare le norme di salute e sicurezza
534545d4-97c2-4ab3-90a9-019b988d7c09	fornire il pronto soccorso medico a bordo di navi
5358f4ec-e9a7-46c5-8263-76c89554a307	analizzare la scenografia
535ace62-1e18-4cbd-abb5-9c5777dc5154	selezionare le mandorle sgusciate
535d9b38-6eef-4f4f-8976-362a38e62eb9	patologia
5360309b-dd05-4562-a256-35322b1a350f	terminologia chiropratica
5355d55c-5c05-40ea-b98b-2890101f6d7d	adattare gli esercizi di Pilates
536b3f79-ee7f-41fa-9a89-d9c3ba623979	pianificare la destinazione delle risorse
5368ae17-78a5-42ac-ab45-b05e31dab7e9	valutare la dipendenza dei clienti da droga e alcool
536e8eb3-cfa6-443e-bed5-bba7f756d60f	effettuare i controlli di routine dei macchinari
5376a97a-b088-4ce6-8a0a-a65cd38e9433	creare effetti speciali
5383fb19-a72f-4862-84b1-7fc9af27c3b8	fertilizzanti naturali
5388eaa2-3d58-4e1b-b0d0-b87c9b1464a9	sviluppare nuovi impianti
53820294-95d9-4ac0-a9ad-c3bae50fb86f	identificare difetti di essiccazione
537d824d-987a-4152-a101-8dbafa19e7b3	Visual Basic
537f2732-7f4e-47e5-9503-6c0139d8b68e	riparare le apparecchiature elettriche del veicolo
538a6441-08e6-47f9-9d6f-fab5dfeaeb89	progettare il telaio
538a9fd8-942f-4e10-a199-4773f57f5b4a	interagire verbalmente in lettone
538ece6d-1538-4008-8c72-04332a7f9ad9	effettuare la manutenzione dei miscelatori di sostanze chimiche
5393f9b8-d60d-4e28-9f6e-724d61d6d604	azionare i pannelli di controllo
53972148-08f7-4df4-b3b5-fe73902819bd	assicurare il posizionamento del paziente per l’intervento chirurgico
53939971-21cf-45b0-99e2-89bf6924e12f	assistere gli studenti nell’apprendimento
539abec0-cb7b-40d2-8a4a-48f4452e4b89	tecnologia delle macchine da maglieria
539e86fd-dd7c-46f4-a003-d717fd8054a4	gestire il servizio ristorazione
539f123e-d5ac-4951-ab5e-6de4cc5f558f	ingredienti di panetteria
53a2b47a-7efb-4cfa-a960-c1e5bdb3b6e6	coordinarsi con altri servizi di emergenza
53a2a4c2-de9b-4526-9423-cafc1ffd3363	tipi di rivetti
53aa80df-4575-4077-8403-d131ad9c6cbc	studi islamici
53ab1d09-6bfb-4708-a543-26b112a2985b	dirigere i complessi musicali
53b02de7-d4c0-482a-8ff3-a418040cb9c7	comportamento di socializzazione degli adolescenti
53a9cf58-9105-4b3f-9fb9-ac4bc7297bdf	valutare le proposte artistiche
53b57f46-a414-40ac-b7d0-db2797919826	comprendere il rumeno parlato
53b8beb5-fb1e-402f-a61e-9aa7ffced194	coordinare musica e scene
53baa3dd-b87d-4c2c-a200-94a592e51a7f	applicare i metodi di valutazione nella musicoterapia
53b86c0e-44e7-453a-b0b5-aa6aa098b7f4	segnalare apparecchiature guaste e pericoli
53d0be1e-5574-4632-92a3-aa0ec5cc3490	creare mappe catastali
53d42821-7596-459e-a394-a2b880a5b77c	Occuparsi del pollame
53dea1a8-4853-4409-ad8d-4185b5161791	gestire un’agenda del personale
53ef10f0-25ab-466f-bc42-72351f8936ec	istruire il personale in merito alle esigenze di navigazione
53f39a29-aea0-4b2e-b584-eaf3f44e18f5	svolgere le indagini di laboratorio
53e342b3-5cde-46ba-bd14-1afd66d53757	analizzare gli pneumatici usurati
53f3c825-1d50-4f20-aa73-1714ebe12887	sistemi di irrigazione
53f69e28-00a0-40c0-901e-288841fb21dc	fare la ceretta
53f76e27-7afb-4900-a966-914a1bc66f53	gestire le risorse umane
53f95654-ac4d-4bf6-93d9-cf2bf31c1aa3	integrare le linee guida della sede nelle operazioni locali
53f9bd62-4397-474e-9fe6-12d2e082b701	maneggiare bombole di gas
53f9e501-9982-46bf-a695-46af861f3d77	creare figure di creta
53fd8e91-2dc4-48fa-8cb7-c64840e6c2dc	utilizzare sistemi di gestione di database relazionali
53faf830-159b-4625-9de8-1b2595df20df	riparare dispositivi mobili
540e8022-a87f-4d2d-9ce2-84e293aa08c9	parti di macchina di saldatura a punti
5411d485-8674-46e9-a552-49e7c5f4d145	offrire consulenza sul miglioramento della qualità dell’uva
54076347-0de2-44ec-8038-b93461138048	supervisionare il controllo della qualità
541b09ac-7241-46f9-993e-10890a5c7de0	contattare gli agenti di artisti
542701b4-058c-4d04-b383-13ca1f862d64	prendere decisioni in materia di gestione della silvicoltura
5424a288-ff63-47d6-8166-0eec359951ff	colorare vetro
542bb47b-f93e-4c8c-b5a6-050332a1e0c4	formare la miscela per lo stampo
542975e7-9cf9-4f82-ab7a-0b59b789fd79	utilizzare il riverspeak per comunicare
542b301b-75c7-43c6-b3d5-392c961b69e2	analizzare le tendenze economiche
540e44a5-7ab9-45d4-bf1e-f18e0b486d85	effettuare l’analisi dei dati della nave
5432581b-1de3-4ecd-84a1-40f1c52d577a	controllare il flusso delle fibre di vetro
5432d1b4-dd8a-404d-b889-3249ce6e7c4a	tritare carne
543408f6-63fd-4d35-b009-f7cf56b7f7b8	comprendere l’arabo scritto
5436530a-acc8-4146-824f-a84bdcd5937a	visitare i fornitori
543bab75-7e46-495e-b609-52f8d013af19	specifiche dell’hardware
543ae5c5-a443-4024-9920-e69aac6976c9	interpretare i test diagnostici urologici
5449a3c5-6565-4724-bacf-c8cec8a36d43	tipi di manti di asfalto
544c5691-be58-4cb2-9bbf-2153e072531f	batimetria
543e52cc-0289-4069-b905-327fbe8b2a10	rafforzare lo stampo del manichino
5451bb68-7f1e-4f12-8e3e-dc8ed08f98a1	malattie dell’apparato respiratorio
54509f7b-ebcc-4e25-9c77-695118c8ce42	scrivere in yiddish
5452f0df-5fb1-4203-ba6c-1385ab250201	rimuovere il tartaro, la placca e le macchie
54573a02-08d0-4b9e-afd5-11274ad33285	interpretare le planimetrie
5454d464-f1f8-4ce6-8d68-79499db25d5b	fungere da moderatore nei negoziati
5451cbe6-888f-486c-9e81-d5186ea7de4e	motori di ricerca
545ae411-4f42-40cc-acb6-c4c6c259d14c	svolgere gli esami del sangue di routine
5461af50-3dfd-40cd-af3b-8b639fd3b743	eseguire il controllo dei sedimenti
545ea221-9ee4-49fb-9b12-78ea6773cece	preparare le trasmissioni
545fd72a-6c14-4b7b-a154-86dca73a46fc	selezionare i copioni
5474bc80-1493-4214-9b0e-ba67bd844d6b	sorvegliare i livelli delle radiazioni
5482a8f0-8b46-42c6-9527-49e53167bcea	fisiologia degli animali
53571a29-9e50-42c6-9993-c79ebd6a75ac	organizzare la prevenzione delle ricadute
548b42d9-63ee-4b10-8f5f-3e79efa71b9c	aiutare i clienti con le biglietterie self-service
548d740a-4a59-45ba-a63d-59f6e9859434	Vagrant
549210d7-a4aa-42e6-bf90-fc017efbc9d4	utilizzare le attrezzature di ossigenazione
5497bc99-e3c2-465b-90bf-23ffcb4a3d45	pianificare un’improvvisazione coreografica
5497b798-adf9-452e-8567-12f670efbf14	nutrire gli animali d’affezione
54798403-6a36-4e4c-9a31-ffdd819ab3a8	ottimizzare la fruibilità della flotta
549a9055-03e3-4bf9-a5aa-b38ae60993dc	regolamenti edilizi
549b42bf-32b1-48f3-8255-67841064f804	controllo dell’infezione
549e7fef-2082-4d65-bd0c-13b7795f5821	svolgere le attività di perito contabile
54b04666-6fdc-4652-9785-405a19e40b6b	elaborare procedure in caso di difetti
54b32930-79db-4aee-9701-6445b9b8b253	termodinamica
54b94042-288f-4177-8cd1-ed4823587bda	mantenere leggibile la segnaletica
54b781af-bfec-4ec4-91ac-b6e7a1f3bbf8	offrire consulenza sulle prestazioni della sicurezza sociale
54bd60fe-6825-4207-9dc7-b870f39c3bab	interpretare le informazioni aziendali
54be4c4f-c761-41c9-8552-eff950d86734	Mantenere la sicurezza delle navi e delle attrezzature di emergenza
54c26be8-89c7-4255-bf45-5ea02cc2588b	conservare i dati relativi al funzionamento del veicolo
53a518c4-6c77-4a05-8817-8f6c07939658	applicare le norme in materia di produzione del tabacco
54bfcbcc-c719-459d-b2f4-ec75b67c6c2f	normalizzare dati
54c7f769-0972-4898-871c-d7716dccbee0	curdo
54dbb81d-4342-45d5-a739-f74e0bb99d18	esaminare gli animali
54d58da1-f02b-41f2-994a-ff2c97228bf4	tecniche artigianali
54da3499-5a98-4d71-b515-f941ee17cafc	costruire le forme
54dc51e6-9079-4eef-83bd-06130de219d0	preparare pacchetti di viaggio
54db2eb6-cb5b-485b-a22e-f86c32404424	redigere materiale didattico
54e497b3-6d0a-47c9-9121-7648d746da7e	neutralizzare i liquori zuccherati
54df205e-03fa-45a3-8728-8fb7a08d3160	tenersi aggiornati sul panorama politico
54e4bda7-1a05-41d0-afe9-b97102dfc6bc	riservare la merce per i clienti
54e7536f-feec-422a-8e05-0c75175e9665	azionare rettificatrici piane
54ec79a8-d29e-4446-8495-b77af6029ff0	produzione di gioielli
54edb06b-b7cb-4d02-8946-94649b643dcd	capacità finanziaria
54f2de34-48a5-4378-bbd1-9d290014bc70	insegnare le arti
54ee6686-d647-4869-ba94-a30b0b3fcc98	sistemi di gestione di database
54f5acf8-f45b-414c-9a1a-d73de9502ff0	supervisionare lo smaltimento dei rifiuti
54f5464a-bb00-4ba6-a3bb-92026134e4de	lavorare in modo efficiente
54f30301-6a2c-4bdd-8896-b6d810f6d33a	eseguire la manutenzione dei server TIC
55004db4-94d5-47c9-ba7d-84b8e641ef4d	gestire le risorse
55050007-85a8-4841-9550-c1f099804e9e	installare macchinari
550744da-9bb2-4762-9366-9e5f65f143a6	tenere i registri genetici
550f3d62-d550-4dbc-aa18-fb40d7ef870c	valutare i vettori
551181e4-1297-41dd-8178-388ec4b03ad7	documenti giuridici relativi all’acquacoltura
551174d8-7564-4a62-add9-60f135adccb6	comprendere il polacco parlato
551216fa-1443-4607-852d-5203dad81ae5	migrazione
55177411-bcad-4b9b-baf0-9c9713958de6	modellare prodotti elettromagnetici
551f77f3-d05d-4333-afbd-86baf56250c4	correggere le deformità dentofacciali
551d53a3-ab21-4450-aae9-00ca2b8dc614	adottare un atteggiamento rilassato
552e2d70-981d-4ac8-99a8-85b95528b766	applicare a pennello mastice di gomma
55457a07-93a0-4488-892a-7486c9ec6786	ascoltare le testimonianze
55241be3-84b5-4f92-8415-d43c2add9b59	consigliare gli sportivi sull’alimentazione
55547916-79a8-4f24-8b48-1b897fb196cc	sviluppo storico delle scuole psicoterapeutiche
5554f567-9e52-44c8-b19a-7ee0bb740998	pietra dimensionale
5561acb1-fcdb-4ef3-abbf-fad4d4937d5d	eseguire le procedure cosmetiche
555bec7e-a484-4b5c-b772-28c1df996916	fornire sostegno di base ai pazienti
55690996-a8ac-436a-8873-633ae39816e3	interpretare i dati attuali
556744a8-58ca-44f0-97b8-a692f753a77b	gestire la parte amministrativa relativa alla professione di giornalista o scrittore
5576a5cf-8f36-4061-95f2-970c1e1f88cf	interagire verbalmente in ceco
55766eef-7f52-456d-8d9d-8169e816af15	usare software CAD per le suole
55817484-91ab-4712-b742-9fc1bdc388e7	tipi di sistemi di allarme
558571de-32fa-4898-9f21-6cd62e8aad1e	controllare gli scivoli per l’ardesia
55997f78-af62-460d-bf2c-0c6c0f39547f	elettromagneti
55988495-58db-48c5-a2eb-8367df93d57e	gestione di un progetto agile
55a12b5d-fef2-4412-aa72-7b194140c664	coordinare le spedizioni di materiali riciclati
55a5dcae-c8bb-4191-9e46-8ee6f025e93f	sostenere la positività dei giovani
55b31a7f-5fba-4eb3-853e-bf538f152805	pubblicizzare un impianto sportivo
55b24f73-d05b-4c7d-97ad-b2e0b39c98a9	determinare la qualità dell’incisione a bulino
55b3c9d8-4758-4988-96b6-6f176bfe1c4f	controlli fisici sui pellami
55c2a910-e4b2-4c59-bdc2-6869a0860858	lucidare le scarpe
55cc92d8-2a89-494b-8770-234539b35d9b	determinare la paternità dei documenti
55b79a8f-7311-42b3-959b-809fb106c8c9	negoziare condizioni con i fornitori
55d0c787-a54c-478b-9d7b-84eb078a6f0e	offrire consulenza su stili di vita sani
55cb8d18-64ea-4f20-8528-6f0e2ee7a932	operare in un ambiente ITIL
55d468bb-b3cf-4aa8-94a1-abb4d6dff23f	utilizzare le tecniche di pittura
55ddfe01-4451-4640-952d-94286509ff3e	mantenere l’inventario delle forniture per ufficio
55d6513a-46f3-4b29-b976-6704474464c9	eseguire le operazioni militari
55d695db-0b68-46e4-ba44-e2d89fe9e533	individuare la natura dei problemi di apprendimento
55df7827-1d27-4320-a6c5-2f3e4cc46141	modellare microelettronica
55e92f9a-5c42-42b5-acae-954ec133436c	promuovere le buone abitudini per evitare disturbi della comunicazione
55f4136b-e4e3-4e01-b8c4-9bc69f3b0a49	tecniche di misurazione sismica
55f415e1-b7ab-4e92-8f11-53ce7b552e96	effettuare ispezioni sul posto di lavoro
55fd7d6c-7c5a-4400-80cc-6f54812ed570	monitorare la tostatura
560827c0-99cc-4894-aaf7-f148aea5a560	neoplasia
55fc943d-f668-465e-bc7e-203e1e60a46a	eseguire la pulizia in loco
560e8aee-da49-4c83-b70f-c300a26e207c	norme in materia di igiene alimentare
548dcae2-e01b-49a0-ad1a-016ad51b6a45	applicare politiche di utilizzo dei sistemi TIC
5628c79a-ad1b-4ee8-a478-1789efbd5576	configurazione dell’hardware della sala del totalizzatore
560e150b-1efa-4aa7-b71f-08810f08d122	offrire consulenza sui sistemi di gestione del rischio ambientale
56295071-5a5b-4db6-a15d-f5164601d4a9	tagliare tessuti
5628b3c4-261b-4dc1-b8ad-3894776e402c	verificare i sistemi di ritenuta di sicurezza dell’attrazione
562d2524-1cdc-4300-a7fb-97f532fa9596	interagire verbalmente in turco
56351924-9891-44b0-9514-340d3d7d1d8d	installare i sensori sui binari ferroviari
562dfee1-dd72-4bec-a162-54218218337d	montare una finestra
563d7d3a-0c94-4146-8c56-e8ab27e6548a	definire le politiche di progettazione di rete TIC
564395b5-4e89-4048-b7ea-875d8152272e	droni per sopralluoghi sulle coperture dei tetti
563c0167-4ad4-45fb-9c47-863669d2acac	normative internazionali in materia di importazione ed esportazione
56481631-eef4-48cd-8d59-5ca144ace0df	scienze infermieristiche
565a21e4-cdd3-4c27-a4f0-03b3b99eeba4	infilare il filo
56585025-b35c-4019-b7c7-9434d12e27ac	effettuare un esame post mortem generale sugli animali
564cdbec-3571-461d-9fee-01152f67b93d	collaborare con progettisti
5663328c-0097-42d8-b994-2612c987772f	principi di assicurazione
56445c8b-efbc-4267-8713-65a2d6d7e993	gestire la logistica militare
567b521b-b92e-4842-ab63-12a47d0dbd77	regolamentazione della sosta
56873f2e-9af1-40ce-a17b-75c0f6267525	vittimologia
56843f04-6ad9-4196-971c-8bc96d5e7f20	mantenere affilati gli attrezzi manuali
56956541-ec7a-4323-afd7-2b3e199a6261	sviluppare concetti di sicurezza
5687ec3a-df1b-4dff-ae33-16a3a23d5314	fissare il rivestimento
56944ce1-9c3e-445b-b434-aed1641a6e59	analizzare l’impatto di un farmaco sul cervello
56843397-afa1-400a-861f-b9838606c531	mantenere un archivio delle inseminazioni di animali
56960941-1b68-45d0-bb31-41a58cca5d26	gestione della garanzia della qualità delle chiamate
5687a90a-b7d5-42af-980e-974f1f3a5c8c	OpenEdge Advanced Business Language
56a1de3d-3c92-41c7-ab74-f9531bd91186	produrre articoli confezionati da indossare all’interno
56a63d87-fdb9-421d-845e-c6d12fac5d53	posare la barriera di sicurezza e il bordo di contenimento
56ab4749-52a6-4cb3-8884-5bfdfa3a886c	misurare lo stato di salute nutrizionale utilizzando strumenti adeguati
5699dfc4-e1ae-40c4-abd4-774852e32611	saldare in condizioni iperbariche
569a9acd-e957-4a28-aec6-435143ca3fee	supervisionare la configurazione delle luci di scena
56b6cc3a-8fad-456f-b1b2-8c8b3770ebda	preparare bevande calde
56c381e5-16a3-4d92-b69b-0b13a058dcbc	studiare le udienze
56c8c98e-b252-4453-9dda-8320e224150c	regolare un proiettore
56ab5252-1171-43d3-ad89-ae332233b07a	eseguire la manutenzione ordinaria di locomotive
56cc289d-d36d-4f52-b837-940b62413a12	utilizzare gli spessori
56a96e31-74da-4425-9c53-2bb45523fd92	coordinare gruppi tecnici
56dca4dd-65f8-4463-aad3-d94f87b53c99	moderni sistemi di segnalazione ferroviaria
56d9b6ed-ff7a-4b40-853d-ebeb80055569	comprendere l’azerbaigiano scritto
56dd00e4-d7a8-4e9a-a40b-454cbe7bd48f	diritto della sicurezza sociale
56cdfb04-4e41-479d-b3f6-373bc21338b3	mantenere i contatti con le agenzie pubblicitarie
56ca825a-b875-4ba1-92a0-32c0bb77ace7	selezionare la musica per lo spettacolo
56df7765-92d4-4366-9e9a-a92c8e29090f	preparare i modelli per la determinazione dei prezzi in base ai costi
56dd806f-eee6-4eac-84d0-d14d19f1b564	collaborare con il personale tecnico nelle produzioni artistiche
56e16caa-49ec-4ae8-8eb3-8f06d4331727	utilizzare i dispositivi di misurazione d’attrito sulla superficie pavimentata
56e70c51-8179-4866-a312-1365f0e35a58	smaltire i fanghi di depurazione
56e21408-9c38-4998-be26-72aa59c9bc6a	convertire in un oggetto animato
56e7e263-d7e4-4154-bc41-5f39782bc2f3	preparare i luoghi di svolgimento delle cerimonie
5551027f-a5a0-4995-85b7-e8ff4bc5370a	pianificare un calendario
56edd34d-ecca-405e-a538-c2107aaf2d0f	effetti delle radiazioni sul corpo umano
56ee1328-45d2-462c-b8d4-8e653734c697	valutare i fabbisogni in termini di risorse di progetto
56f03aea-04ff-40c5-b6fc-013b51561c34	applicare la pittura corporea
56f569d5-22ac-41b4-a469-5b0c29329d6a	curare le piante
56df18c0-2590-47be-9754-a716fc0f67fa	sviluppare il workflow delle TIC
56f9c4f9-d9da-460b-ac08-a1455acde43f	utilizzare una pialla manuale
56f900c5-1f0c-43ee-86dc-cd3605291036	valutazione dei rischi e delle minacce
56ff2e59-9ec2-4aba-a7d5-27830f293f30	interpretazione di tribunale
5703a41b-d62a-4fdc-b9e3-bd3d9af0947d	saper accedere alle informazioni relative alle tariffe di spedizione
56f5cf03-7364-491a-afaf-7a10cdf803cf	fornire consulenza ai clienti sulle sigarette elettroniche
5713570d-4386-4493-857f-096489a11d48	essere addetto a macchine per il taglio del metallo
571279b7-eb69-4e9d-b31d-4e64f16bb7cd	ingredienti dei prodotti alimentari
5709b44a-fb67-4004-8494-ecbc26580126	esaminare i modelli e le impronte dentali
57268783-b205-46fe-9920-ad6540b13d55	impianti di macinazione
571c5993-74d3-496d-9728-76a2a7fe1b82	tipi di lime
572fb960-cefc-46c1-8081-e6ccd49a4df9	allestire l’area del tornio
573a5326-d815-4e72-9310-69a0de903057	essere addetto a macchinari per l’estrazione dell’olio
5735b28d-4ce6-4fa8-88b7-cf7536d0b263	linguaggio dei fogli di stile
5732bcfd-b82e-481a-a553-6156f560a864	gestione basata su processi
573ef5fa-eb3a-49c7-9abf-0adcb8f0f9ee	procedure di emergenza per parchi divertimenti
573af1ff-9414-4883-997c-b6ff8c6e563c	stabilire buone relazioni di cooperazione
57411d0b-6ea3-46b3-98a5-2fe3095191c6	creare un prototipo di scultura
5743da52-1383-4bd6-bdb9-e453f5f5970c	posizioni per procedure chirurgiche
574269f1-4017-446e-8e29-15a93abf3877	applicare l’agopuntura
57495489-cb81-4325-9090-62c0645fc2fc	fornire assistenza ai fisioterapisti
574a6ef8-8e48-43a0-bf83-dec62168e12c	posare gli strati di fondo
574e51af-423d-41c9-8f13-9276f85ae7da	micologia medica
575350e3-689b-4daf-8fbe-22459f55fc50	tipi di macchia
572c711d-70aa-4973-ba2b-e092481e74cf	gestire le attività di carico e scarico della nave
575ed001-06fa-414d-bf0b-cd402f09705c	supervisionare i progetti per la conservazione di edifici storici
575dbd40-3976-4071-866f-e3357fc916d3	Lettone
57636684-c9db-4b62-82f0-26a40f06f08e	PostgreSQL
5768398b-2259-465e-a8f5-b9784f4fd9e6	organizzare i servizi in loco
576a7f82-945a-4153-9b92-ed9cd0ce3eef	garantire il rispetto dei regolamenti portuali
5776d656-d127-4cc9-8739-a6f013fe6a9d	misure igienico-sanitarie per la produzione in vivaio mediante acquacoltura
577744ca-24a6-4751-88f6-ba734792f738	effettuare ricerche regolari in materia di aviazione
576f7385-81a7-4cf5-846c-17f4beeba3e2	regole di giochi sportivi
577a0c9c-f904-45a5-b6b5-9bd7d6e33d60	eseguire le pulizie di strade in emergenza
57826020-90b1-4223-9298-591b033d6729	evacuare le persone da posizioni elevate
578e5653-04bb-4d6f-9cee-ef34795b38ad	aggiustare i gioielli
5787b1d1-1af2-4f86-8660-d07e3c3ac5b3	applicare il trucco permanente
578b4bb0-1ba2-4b9e-a0bc-7e9d1919af6f	tenersi al passo della trasformazione digitale dei processi industriali
5783a256-c592-4478-a5b3-9457c74bc299	garantire una corretta pressione del gas
579363c4-ea5a-41a7-b14b-cdf79a4b44e0	sicurezza informatica
57972b8b-8c0a-4477-801f-7cc6d8b5d219	fornire assistenza al giudice
579b29aa-2138-4ed3-8d4b-3a50c1afc303	operazioni relative alle prove di un pozzo
579c0af6-e128-44df-8243-2d30df2aadd4	studiare le pubblicazioni e la letteratura in un determinato campo
57a8bca0-9a2f-47ce-9930-1d419ad0bbfd	tendenze nel settore dei videogiochi
57a0eea8-25b6-4551-ba3f-1d03680d43a5	veicoli per il trasporto degli equidi
57b3ec8b-aee5-469c-87cf-c8682a1aa9d2	diagnosi delle prestazioni
57b0fc4e-09ad-4447-8780-2510063bf6f5	mantenere la banca dati del magazzino
57b40ced-350e-4e0d-8ec9-8787baf5c4b2	consultare il gruppo in merito al progetto creativo
57b4ce0a-1db1-4eaf-9364-bb859967ef98	fornire assistenza per l’identificazione dell’albero
57b8c888-9485-4006-aab6-100c1beeaec4	comprendere lo svedese parlato
57bbf023-538b-474e-873e-8d6efad0118c	scienze sociali
57b9f0b8-6cd9-4b8d-b461-0216eefa8b79	evitare inceppamenti di carta
57bff8a0-2f4b-430d-906a-912b88e42bee	comprendere il bosniaco parlato
57c0d62b-5743-46bd-a8c3-048dfc97e5d0	promuovere le relazioni con i vari tipi di vettore
57d11bef-bc14-4862-9749-e0621941c5bc	comprendere l’ebraico scritto
57bebfbf-8778-4bf3-b87a-dd6e83901e58	analizzare le reti delle imprese di trasporto
57d7c88f-905f-4db1-b5f6-7f75142d6ad8	principi internazionali d’informativa finanziaria
57ddc6fd-06e7-42d4-b20b-f641f2f4f99e	pianificare i programmi di allevamento
57e217ee-ea09-418c-99fb-5989c9414f81	manutenere sistemi elettronici
57e07d8e-5338-4034-b03d-dc9fd8d03c54	elementi delle prestazioni degli strumenti
57e0e474-42eb-4c1f-b930-efeb8872cbf8	dimostrare competenze a livello interculturale
57e5f0e3-7fff-4c70-9c7e-849c805b9de6	dare seguito a infrazioni agli standard di sicurezza
57f8e4b5-a16d-4b3c-b731-bbc26ac9f151	gestire le conoscenze aziendali
57f95fb7-34fb-4442-9c49-53583a7ef15b	metodi di essiccazione
580e46aa-1584-4a4e-bd04-7d2ba2d2c5a9	predisporre invitanti esposizioni degli alimenti
58155d21-bc17-4aec-b800-28d95354088d	interagire verbalmente in italiano
57f0eba5-8e8a-410a-adf6-5a93cce78a82	stampare il marchio di fabbrica sulle cinghie trapezoidali
581bf851-bbeb-48df-a922-f083391b107a	effettuare la diagnostica dei sistemi di alimentazione
581759e7-d055-4a1c-8555-de2914e5dd36	utilizzare i banchi di prova
581d291f-617f-4f66-a100-53c62edb0c99	eseguire l’acquisto di parti
583b6280-c51f-44fb-ba65-a82f1660e130	tipi di materiale per il letto di posa
582bef06-096a-41ce-b267-e9e32e1f5dcc	prendere decisioni in merito al benessere dell’animale
583cc198-2171-42ba-865d-209eb2e12969	aspirare le superfici con un aspirapolvere
583cf093-93c4-4f80-8b16-6e8a1324989b	filosofia Montessori
5847d3de-5bc9-46c6-9df5-ac157a5c5cee	diagnostica psicologica
5845af4b-f622-483b-acda-df3c212386f4	tenersi professionalmente aggiornati
584b88b0-1db0-401a-bade-25c7ff769889	stesura dei tessuti nel settore della moda
5842c24a-334b-4960-b529-43518a10a32f	prodotti ortofrutticoli
584c0d81-e79f-4d2a-bfb1-34a8bb2308bc	utilizzare gli strumenti diagnostici per le riparazioni elettroniche
5850efcf-7b72-44e2-9ba6-112d4f573b2c	scuoiare animali
5855900c-13c2-4d8f-ad5a-1a28b019405e	gestire il processo di stampa offset
5859974b-10ac-4378-8ac4-9cc4ed14b787	ingegneria biomedica
5859653a-432a-46db-8f39-c9b260e58a89	seguire il piano aeroportuale di controllo della neve
585a8749-9445-4828-a27b-4c987461a90d	cucire indumenti da lavoro protettivi
585e8002-3668-4e46-b393-3206d80f5448	adattare il lavoro al luogo
5851f7a3-d63c-49bb-a5a9-02531e94dabd	stabilire standard per le strutture produttive
586317e1-a33f-4e8f-bdbd-fcb79bb1d3b3	fisioterapia manuale ortopedica
586d7a75-d149-415a-a570-60b2bdcf0c95	legare le foglie di tabacco in mazzi
5865f237-84bd-45ef-89b1-17621abeeb9c	interpretare le esigenze di illustrazione
58760486-eb96-4b94-aac9-94741a2f1cbb	preparare le sacche per la terapia endovenosa
586f4d2d-7d4c-4d0a-ae6c-d733421455e5	sostenere gli studenti dotati
588223f8-e841-4bbf-9431-0f081e2f9137	effettuare le ricerche appropriate per adeguare le proprie attività alla comunità di destinazione
5895a8f9-3673-43d5-b4d3-0dfb1cb56709	effetto del contesto sociale sulla salute
5886aee2-29ea-4aa9-88ed-e76984b3cf8e	applicare politiche di organizzazione del sistema
589b1ff1-fceb-4a8d-8e2e-df5bc8b8df35	fornire una preparazione al parto
5896da9e-1c87-4c68-acb0-3699186187da	influenzare i responsabili delle politiche su questioni relative a servizi sociali
5876c7ce-2369-45a3-84d8-38f18ba5b4f9	valutare i parametri ambientali sul posto di lavoro per la produzione alimentare
58a34d9c-fff1-43f3-82e5-30753c3065a1	acquistare gli oggetti di scena
58a28ba4-6af1-4812-b1d9-7d5da7309b9a	registrare gli insegnamenti tratti dalle proprie sessioni
58aee09c-d2f1-40fc-82f7-9bb494f4b180	trattare i prodotti di legno resi
58a5dbbe-5276-4f39-a950-66f0a5e62501	coltivare il plancton
58b1e570-4b1a-4a44-a931-2a3b24f0149c	produrre articoli di pellicceria
58c057ef-080a-48df-b049-161616ea887c	assumere i battitori
58bdbd99-0a01-4058-9ca2-cc7705b95736	utilizzare una sabbiatrice
58b1533a-4438-4b77-909b-6eeedcff2527	informare i clienti dei benefici di uno stile di vita sano
58cf8749-2bdd-4bed-adc4-a044a31fb74a	manifesto di carico ed elenchi di una nave
58c54351-45d5-4a7c-b0b1-2b1f2e150443	ordinare i materiali da costruzione
58c6edc1-a2e2-4e2e-bba2-49ae20aa144f	gestire progetti TIC
58db5499-77f8-4e66-bad6-bdde78f4f36e	tagliare su misura il materiale isolante
58d7bbbf-b40e-4a08-8909-1b0356de46af	mantenere un archivio di informazioni personali
58d93389-bb49-4df8-80b9-ef29c6770b38	effettuare la manutenzione dei distributori automatici
58da2607-8d70-4f29-820d-a1515e1554c1	offrire consulenza in materia marittima
58cb79fc-cefb-4734-9053-bf5e9e25f9f0	gestire i servizi di sicurezza esternalizzati
58db7956-653f-4504-a778-667593961b9d	combinare molteplici campi di conoscenze
58e29a22-1c52-4dc4-b653-46d5ef47c9c0	impiegare tecniche di valutazione per anticipare l’impegno traduttivo
58e3af88-2d73-4dd3-87d7-5aec0d5c4a54	gestire il testo del suggeritore
58e9060f-b94f-41f4-9baf-23dd0f67f8c3	contribuire alla registrazione di prodotti farmaceutici
58fd8c1a-9594-4d2c-ba72-63bc537e3971	partecipare allo sviluppo di nuovi prodotti alimentari
58fffa29-d613-4992-b30b-0029293e8082	utilizzare pompe
58e65be8-191f-42c0-9d2a-99aafafbe6c9	aggiungere le lastre di argilla ai lavori in ceramica
591166dc-fc32-4e96-ae4d-fb29db52c09d	prevenire il deterioramento di gasdotti e oleodotti
59191a57-274c-4cbb-9437-1b25244291b9	ingegneria di precisione
59128fe6-03c1-4f31-8082-93b6ceae2f83	usare software 2D CAD per l’industrializzazione di modelli di calzature
5908bc47-e825-4c3d-9fa5-6819b92ec869	giocare con i bambini
591a7d84-4db0-41c7-b9f0-70f10b66db12	pianificare la gestione del prodotto
591632bb-dfbb-4d67-8ec3-8de21611a6e8	gestire il materiale promozionale
592abaff-7832-4f8d-bccf-5a1effd22dc7	svolgere le indagini finanziarie
592cbe86-d681-4198-abf7-da4cdfbbc02d	utilizzare macchine per il montaggio a inserimento
5929f345-1c20-4157-8ed7-6933c22e83e7	protocollare la corrispondenza
5920fa74-1b05-4bf6-bbc0-acf8dd759d40	tenere la contabilità
592fd838-fe72-4610-a83d-01fdf2f1810a	gestione di un progetto Prince2
593ff6b8-09fb-4f8c-ad1c-271e8121a6e9	controllare la pulizia delle attrezzature
594058ed-9b1e-4ea7-9627-403df63d2f03	insegnare l’astronomia
594899f2-7d52-42c5-bae9-5dc037aa7dd1	comportamento dei viaggiatori aerei
5950f6d6-b74f-4ae2-9484-380848c3c15e	immagazzinare i rulli
5959a008-1613-4d8a-8bb3-295b780c77c5	eseguire le procedure di sicurezza per le piccole imbarcazioni
595c6dd7-6270-433e-bf6f-106c0d6e3c11	trasferire le sostanze chimiche
59517d47-4b35-4d8a-b34c-dc954f307550	interrompere le operazioni di immersione se necessario
596d5f66-81a9-4616-885e-b03c03d4b9c8	offrire consulenza sui piani delle lezioni
596e565f-241e-4ab2-a9c4-83f06a03a8fb	motivare i sostenitori
5971dd3d-22d5-4c98-be80-4899a71d590a	essere aggiornati sui social media
596afdee-9106-455f-a5af-adc0c5f1bcc4	adattarsi ai cambiamenti nel marketing
59791294-20ea-4aa6-945f-3c8c626b44ee	sviluppare le pellicole
597f12a5-3377-44d4-b19c-eb93a770e0f4	tecniche di chiusura della ferita
598cb161-cc64-4710-afef-40e05c429286	interagire verbalmente in francese
596fcd89-d7b8-4cee-989c-5755a6391a96	effettuare ricerca sul passato in fonti registrate
598dacef-53d7-4ae2-843f-96486679dfeb	rimuovere il cotone dalla pressa per balle
5996f7fa-6122-434c-8d44-3ed910524978	elaborazione di pareri psicologici clinici
59877e29-7963-4359-adf4-7e345cea11e4	manutenere le macchine da miniera elettriche
598ea270-d02c-4521-b51d-07a223772409	guidare una squadra nel settore dei servizi della pesca
599bdb67-b79f-4f93-b830-d652a552ba7b	progettare una call to action digitale
5997816a-dd77-4ad6-94f5-a76d1daeefe9	mantenere i contatti con i coltivatori
599a5916-0bd4-49c5-9f81-f863adf116f7	creazione di spirito di gruppo
599c1ac7-c8f3-4aff-a247-1aaa813c8265	effettuare la manutenzione delle attrezzature di silvicoltura
59a941e2-9cdf-495b-b37f-1e5099226acf	effettuare le dimissioni gestite dall’infermiere
59a151f7-fd56-4acd-bf45-92b550d9af0e	controllare i pagamenti
59abdd3f-a3fe-4388-8528-a48acb701e6f	selezionare le mele
599e5eae-5a7d-41d6-bcc0-b630afee3c3c	chimica del legno
59ad74c4-273c-4c34-8d84-528ef5b57558	trasformare i prodotti ittici
59b355be-d401-48a0-b003-c55ac8655647	utilizzare sistemi ICT
59bfcb84-23bf-4153-93ce-bcbe662a7ab7	tipi di satellite
59c4e14a-8278-4cb5-8c88-47effed58494	eseguire la saldatura al gas inerte di tungsteno
59b62007-a6bb-4faa-afbf-a6bf8ac75384	gestire la biancheria in giacenza
59c1fc21-29e3-44c0-ba8e-63d999a802b7	proteggere i dispositivi ICT
59cf2798-7ace-409f-901a-d199146113c5	eseguire piccoli interventi di sartoria
59d0bac4-53d9-4298-a181-a4ed41a17b79	utilizzare le attrezzature per la respirazione
59cd8b86-f607-49e8-b8de-f785ae1d2574	azionare la rettificatrice per rotaie
59d5ab38-3429-44bc-b5c2-f7a595c9ee38	applicare il protocollo HACCP (Hazard-Analysis and Control of Critical Points)
59d7261b-a4bf-4f1b-9c92-2fb332292ab9	consultarsi con il montatore del suono
59e29417-1fb4-464b-819e-3a07db62c963	anticipare la manutenzione dell’impianto
59e3183f-7043-4854-a37a-4d9540f93b97	fornire assistenza per l’imbottigliamento
59ebacba-83de-45bc-bacb-0d2fed441ec3	comprendere il gallego parlato
59c7134a-9205-4da1-901f-340663d7951c	portare a termine la vendita attiva
59dd3ee7-4c3b-4ef8-93ed-2e545c21ad9a	politiche del settore delle comunicazioni
59ebdf09-8209-4e55-b5a1-47260947fd90	effettuare la manutenzione delle attrezzature per la movimentazione dei materiali
59da939a-2790-4909-bda1-b39724e1c557	progettare circuiti integrati
59fdc473-ab35-49ab-9db7-01947504e7ee	tecniche tessili
59c8053c-1927-4991-95e4-91edec458d0e	ispezionare la coibentazione
5a07f799-bf6a-4e79-a652-241aca106b3a	effettuare la manutenzione della zona di ricevimento
5a05ac5e-aff3-442f-a047-8351cbd7a4c5	impastare il calcestruzzo
5a02fcbb-26c5-40ed-831e-44fe8cff730a	supervisionare il personale delle agenzie di scommesse
5a0c008b-ba72-48e6-aa7b-edff18277308	effettuare sondaggi pubblici
5a09d548-15d1-4661-bf5e-b3a47cf4e2cd	attuare provvedimenti di risanamento ambientale
5a0edb4e-c297-4a71-aef7-baaed9dedb1a	grani di sabbiatura
5a05420f-1a49-4f28-9eb7-7ffc9fc939d8	assistere i visitatori
5a140d97-1ff5-432c-ba4e-f61b938356c1	sviluppare le risorse educative
5a1701dd-ef10-4a68-ba1d-8c1eebc2fa3f	terminologia tecnica
5a1fd4b7-4d92-4af1-b983-f6ba40dddf9e	smontare l’attrezzatura
5a2570e9-da39-4f25-a287-fa1e85db2a29	tecniche di decorazione della casa
5a293e56-cf5e-45c2-a454-7583801b3c1a	applicare i supporti per la correzione della colonna vertebrale
5a32b1d0-3405-490d-8bb1-aac90c53dd52	avviare una linea di forme per il cioccolato
5a1fe2e6-d814-4a1e-801a-fe4a81d87f83	analizzare gli spartiti
5a2d78e9-96b3-4ad6-808c-364e5e505540	comprendere il malese parlato
5a4677f3-0d99-4ae5-9f32-1ff14f5f9c24	attuare processi sui minerali
5a3a6b00-2cd3-4a07-87ed-82d2a316a3b9	gestire il tempo
5a52572b-687c-4df9-a4b1-d10f3fdd6fad	torce al plasma
5a477cae-ad65-4ccc-bdbe-01373b858cab	articoli disponibili per la vendita all’asta
5a5ee5ae-7c18-4b7a-848c-bff5c7723e0f	esaminare i rating di credito
5a674b67-4e03-448e-8259-4e037f9280f9	esibirsi dal vivo
5a70980b-84b5-42cc-9fcf-f91ae386a7d5	valutare i bilanci
5a832e55-fd29-4a21-a1e5-ef890930dc60	sistema di difesa
5a74ccd4-1e95-4c48-b0ba-b30202524277	garantire il rispetto degli standard organizzativi TIC
5aa2703e-9362-44fc-8ff5-622b1d6f1416	formare gli ingegneri minerari
5aa05b06-0c69-43d1-8cb1-5fe5dd1e8582	preparare i campioni di latte
5a8f9c43-16d4-4e85-bafc-0c1b13aec10f	prescrivere esami diagnostici per fisioterapia
5a3a67ac-750b-45cf-8d6b-3fbf5fc89fb7	istruire la brigata di cucina
5aa502b6-f814-410a-ae58-e5309d2a119b	processi di distillazione del petrolio greggio
5aac99ff-b3f2-4d48-9ff8-f4044180b9d4	produrre componenti per organo
5aacd38d-dbed-463b-ae4d-46252c84c797	applicare conoscenze veterinarie specialistiche
5ab41a1a-de27-4891-aa16-9a133467b5fb	utilizzare un digestore
5aa34a3b-fb5b-4fb8-a44d-c2f73452416a	preparare le relazioni di audit finanziario
5aaabbf7-1328-4e2b-8aa4-9d5f473d1f84	gestire i fornitori di servizi logistici di terze parti
5ac53948-7b5b-4f39-a327-0b76e652ef6b	comunicare con le parti interessate
5abee743-aed4-4cfd-b9d2-cdf7ba2797ec	offrire consulenza ai pazienti in relazione alle preoccupazioni familiari
5abf5b33-9b6b-4bea-af8e-d1e3f3a07b51	gestire i sistemi di produzione
5ac6df8e-5869-4d2e-972e-79d44bc7e987	manutenzione delle macchine per la produzione di calzature
5ac733a7-d9a6-4347-802a-8c3c34e9a774	rilevare un crimine finanziario
5ad19be5-7365-4b43-bf8d-bccc0d89771d	studiare i prezzi dei prodotti del legno
5ac750a5-142a-49d9-b630-458e657946fe	definire il profilo editoriale
5ac00e0a-dc24-4dec-a805-6b3451cd2ed3	gestire i dati del sito di estrazione
5ad5dad1-ea85-416c-af4f-402972412ad3	filtrare la vernice
5aee208e-91f1-4bb5-9f22-b756cb0ca117	applicare la psicoterapia ipnotica
5adbba87-6789-40b0-87c5-8a44058279fb	selezionare i fornitori di servizi per eventi
5ae47813-d404-486d-b20a-9181f04012c9	tecnologia di produzione di abbigliamento
5af08529-5645-42bf-bac0-c78251e405e9	condurre una ricerca sulla medicina della riproduzione
5af68383-6ad0-49d7-8a50-bd8e9759c237	astrologia
5b022587-932b-464f-9114-7637e1178fb1	valutare la necessità di nuove tecnologie agricole
5b065c03-d403-4701-8092-6f2fc06d4427	insegnare scienza alimentare
5afabb05-0ffc-4851-82fc-9f947fcb2267	lavorare con gli specialisti di un sito culturale
5b06ad5a-9951-4e00-9307-b06fff201f7f	sostituire i pallet pieni
5b09ffec-a5c2-4993-a7a8-0670605fe4c9	controllare forniture elettriche
5b0cbda6-e482-4bc1-9c12-1d64b8746a21	fornire informazioni precise sulle rotte
5b0d6985-7373-4f90-93e5-cab339556813	riferire gli errori di chiamata
5b1e6b79-9538-4e8e-b2b0-324d8bf15806	gestire i serbatoi di stoccaggio
5b1f614f-4f65-47ad-b600-b47ba5c80868	anticipare la revisione della flotta
5b21a4c4-c3f6-4370-8822-03128c8a1e31	analizzare i costi di trasporto
5b2d1544-1caa-442b-b899-fac4984132a4	decorare le unghie
5b2db212-f2b6-4de6-a25a-23df3119ec84	gestire il dipartimento universitario
5b35280e-5df6-4cc5-a8a2-4fb96a0ccb2a	controllare la gomma vulcanizzata
5b3bc1fa-5c99-48c1-b668-46916b1df655	eseguire la riparazione della tappezzeria
5b3a48d2-d065-444a-8004-b1d0c5d9238b	selezionare gli articoli per la vendita all’asta
5b3cae89-9dba-4341-ab44-4cbfb7c0c1d9	pulire gioielli
5b269b8d-5940-4c74-a967-ca0fc07a4d56	monitorare gli sviluppi della normativa
5b467ed5-2458-48d8-9f7d-7e63ac5229b0	controllare i cassieri
5b573f16-292c-4a4a-9cbb-72cd5254621c	utilizzare un microscopio
5b579de5-f04d-4e33-a1f9-cfc9f826a5a7	sviluppare un concetto di progettazione
5b5c3ea3-68eb-4cfb-a5c1-4a272649fc17	gestire gli aspetti finanziari di un’impresa
5b43bb96-0c7a-4339-9dfd-4b93f96dd19c	eseguire calcoli per i rilevamenti
5b67530c-b914-455b-b439-06521d789872	creare le animazioni
5b5b3489-393b-42af-a6dd-8e788366ec9d	esaminare i documenti di un prestito ipotecario
5b7ecbb1-2d46-4166-97aa-2b2501e0fe3b	modellare forme di cioccolato
5b6ce9e1-e7a2-40d8-8336-f403a6e68ef4	categorie di giochi e giocattoli
5b8259c9-1360-4808-a88b-80d84babb0f0	principi delle microonde
5b8580a3-b417-43c8-b905-e3422ddb4da9	curare l’aspetto degli alimenti
5b8b5f3a-8b0d-431d-b151-aaaaec221c5e	vendere gli articoli ortopedici
5b97d2da-514d-4f25-855f-194e3df8cc15	ingegneria alimentare
5ba114f2-78bd-4db9-a4ec-95f0f2d89eeb	creare biglietti di auguri
5b8b63c7-14db-4fa6-afbb-3f80378a2a83	effettuare le prove della pressione del camino
5ba7cde1-bfb5-4b0d-8949-a30a9918a117	monitorare il clima dell’organizzazione
5b861249-2b95-4625-a005-dbdf547960df	calcolare le probabilità
5ba40fa8-d288-4c6d-81b6-aaee2c34065b	offrire consulenza su questioni relative agli alberi
5ba189d7-c689-4ca2-b775-b58d8df44713	mantenere i registri
5baacf3e-8811-41f7-ab1f-c98755cf009e	lavorare con utensili da fabbro elettrici
5bb7b3d4-0d12-413b-8586-3acaebaaa2de	aiutare gli interpreti a interiorizzare il materiale coreografico
5b872bc3-f805-4005-9ba5-4fe018a222a0	eseguire le indagini relative all’inquinamento
5bc1130a-2d9b-47b7-84a7-1c8092a3128d	caricare i film
5bb6cd83-cbb2-4b22-9534-143e25a8db03	convenzione internazionale per la prevenzione dell’inquinamento causato da navi
5bbf7476-f8b7-457f-88a2-88ef70181a0e	negoziare con i fruitori dei servizi sociali
5bd049ce-1cef-48b1-bcc3-5b23bc18b5c2	applicare il rivestimento in tessuto
5bdd2096-e127-483c-b89d-7f5c818c7163	composizione meccanica dei tram
5bf21ccd-221d-4e98-9b08-f98cc73bd0e6	riparare i tergicristalli
5bf3e631-4da5-49f3-9671-60b805a8f418	tecniche di commercializzazione del marchio
5bfa8695-69db-4101-8fc0-b7854ccccdc6	produrre componenti per percussioni
5bff3b40-0423-4e16-9bab-571de6d4937e	garantire che i binari rimangano privi di ostacoli
5c05aeb9-3ead-4f56-a03a-7ea226f84794	lavorazione di metalli preziosi
5c124584-1222-4607-a7c9-26ca802fda5e	eseguire i controlli di sicurezza
5c23f35e-bc8f-4c6d-9f87-1f72fc63a40d	prescrivere i prodotti sanitari
5bd774e6-32f9-477c-bf8f-5df2df8a5392	raccogliere i dati
5bff3c55-8b5a-4da5-9169-36c8253f13fb	utilizzare sistemi di supporto alle decisioni
5c14480b-edab-4f67-811a-1ad324c6a7e2	miscelare cascami di gomma
5c26dcc3-0e39-4773-9a78-e926aaa1b263	assemblare sensori
5c27b3da-3614-4c50-8c5c-0a00fbe9b64e	ingegneria delle telecomunicazioni
5c28e6cd-640e-4e5b-aa82-429d3792ddd3	ispezionare le merci da spedire
5c48aeff-7622-453c-804e-97fdc3cc900b	discipline cliniche in odontoiatria
5c482584-2806-48fb-99fc-97fc4fd33b73	trasformare i prodotti lattiero-caseari
5c471f86-98b2-46fa-b95a-170e6624ed4b	gestire i pagamenti nel settore dell’odontoiatria
5c4e1a7b-5a22-460c-ad55-fca336a81ecb	sostenere il benessere dei minori
5c48af77-4a3e-4072-8aea-84cadcc46ef6	separare i frammenti di tabacco sfuso per dimensioni
5c2cab3c-eed0-4616-b4e0-f6516c77978b	controllare i parametri ambientali
5c5334eb-43a0-4795-b578-fd0e3bdbdc1d	tipi di intreccio di rete metallica
5c5dba4d-6625-44b8-b995-79d6d2da4c00	apparecchiature di diagnostica automobilistica
5c5915c7-6644-42be-a501-25444c6dfe3c	ingegneria informatica
5c653f71-a4b6-4fa8-a67a-9f2fb6d03b03	diritto costituzionale
5c6f32a9-3773-4ca3-b758-538d59f6e8c6	gestire la ventilazione dei forni
5c768cf5-4489-4690-b5cb-ec4c5a3f1c3f	scrivere in islandese
5c66d503-0844-4895-8982-2610c007b4b0	posare i blocchi termoisolanti
5c8c82d7-ea31-4bf1-9952-c526de4b7d24	utilizzare una macchina rilegatrice
5cabcf55-c747-4428-b7ca-4fba048956b5	interagire verbalmente in bulgaro
5c9e003b-c021-44b0-835e-208a79333282	raccogliere embrioni
5cb53fb8-e4bf-47a9-925a-d7249139141d	diritto delle assicurazioni
5c93801d-5f1b-4072-b2da-b7fee0b019fb	trattare i dati quantitativi del settore turistico
5cb5cbbe-f244-43e9-ade9-b89aba22129d	prevenire gli incendi a bordo
5cba8625-ca08-49ff-aab5-946183725485	essere addetto a rullatrici per filettature
5cae7db9-8c1a-4908-a393-d2acf6a5e98c	normative nazionali in materia di movimentazione delle merci
5cbbcf66-eb8f-4485-b3c9-1dcf85f10385	controllare i requisiti di produzione
5cc15d40-e12c-4505-ac65-3b70c2d3f82c	firmware
5cc2791f-90af-48d1-b9ad-b7acd4e076de	estrarre il ceduo
5cc2a218-22f9-4fd5-8760-4919d8a42251	possedere l’alfabetizzazione visiva
5cc33055-70b5-4022-9db1-e79ec93cbc0c	installare i sistemi di riscaldamento a legna
5cc3de58-4b98-47de-9c9e-db7a4d8601cd	relazioni pubbliche
5ccd72c8-a699-43a4-aa37-7df545a43195	somministrare trattamenti agli animali
5ccfc7bf-372a-4f7f-a709-4f4fa6629995	ottenere le licenze per l’utilizzo di foto
5ccf931e-83e6-4978-9754-c2538d876063	spiegare le caratteristiche degli elettrodomestici
5cd6791d-9565-458b-ba0d-7e28ecc1d7f5	cibernetica
5cd7e6f6-9aac-468c-ad33-700543d1ca6c	ristabilire l’ambiente naturale dopo i tentativi di perforazione
5cdb47d0-a797-4852-8183-ac6773764138	tecnologie di scansione del corpo umano in 3D
5ce3143e-ad56-4604-9c1a-abaabe86c313	contrassegnare le differenze di colore
5cef5c81-b9ed-4a7e-9313-a86b97537922	utilizzare i programmi di stivaggio
5cec383c-bf24-4984-84ab-56af1f66a913	preparare il sito per la costruzione
5cf87491-8933-4dc9-b2e8-f58d368b374a	ingredienti degli alimenti per animali
5cf3a578-0a47-4a71-b20a-00e97063e04b	raccogliere campioni per l’analisi
5d023177-2c01-4448-b6af-8a3157c4c3b5	vari tipi di sabbia
5d089c1d-76c1-47cb-a1a4-13355e441c4f	utilizzare carne separata meccanicamente
5d059f5e-4338-4d6c-8498-cee00ba4c41e	eseguire il bunkeraggio
5d12aeb6-6a03-49c2-88f9-7baddf484187	ricostruire gli pneumatici
5d1428ce-adcb-4b87-859a-9ff92b1eabc4	armamenti militari
5d0917f6-fd28-42a9-8eb1-7db51c751859	organizzare la sicurezza dei beni per la vendita all’asta
5d15811e-7e8d-430e-8706-5d5fd5d81977	supervisionare le attività di distribuzione del gas
5d12b968-c97a-49df-8d88-f07adffd012b	redigere le relazioni sulla situazione
5d1bf5ea-85db-443c-bc1e-27d7cb540701	fornire servizi di sviluppo della comunità
5d20bbaf-d4f9-4854-a562-ec83f8696070	strategia di crowdsourcing
5d16c7cf-408b-4ddc-a58b-e5aff9df95e6	preparare i rendiconti degli acquisti
5d339771-9827-45b6-840d-4afae5852af4	applicare le tecniche di saldatura alluminotermica
5d1f67d2-7f82-4372-b5db-b63a352d5aad	comprensione del prodotto
5d4417e4-d164-4d9e-aa17-50ab37add3bd	principi di produzione agricola
5d3c3b8a-bb40-4f33-bc98-4423c2a017e6	contribuire a determinare il contesto nel quale verrà presentato il lavoro
5d3fbdde-a968-46be-8d3a-8c261a9073bf	progettare tessuti
5d41082c-cf20-46b8-a665-0d7dca734eaa	gestire le relazioni con gli studenti
5d499dd3-c190-474f-87dc-86a0105454d9	cucinare prodotti lattiero-caseari
5d5d7322-93cf-4bb8-bd69-42b3baa9de69	controllare l’ambiente acquatico di produzione
5d4c0b82-c685-46ca-9a9c-51354d687a86	utilizzare le tecniche di comunicazione
5d613b55-cc2d-4665-b5b3-f15feac872ae	organizzare un sistema di gestione del magazzino
5d55c5c9-e110-4fb7-be30-38cb5f89ee57	conservazione chimica
5d77d053-af2f-419c-9154-f0a05afc565c	monitorare gli sviluppi nell’industria tessile
5d8bf4e0-41cb-41ab-93d6-6188c6c27074	installare illuminazione delle attrezzature di trasporto
5d89a4ec-1c97-4a7f-a8cb-7694c354ea1d	gestire i livelli di carbonatazione
5d8c6bb1-6591-4051-b57a-125edf1502f6	fare una presentazione dal vivo
5d947dff-2d26-4b2b-8504-eb505d3bd264	delegare le attività
5da4e3ce-078c-4f2f-ad53-4b933dd993c6	somministrare i radiofarmaci
5dae1244-50e8-4137-a2e8-2b047f689904	manutenere le anime
5d8d6819-0560-4c92-8842-78cf4dbf49e8	IBM WebSphere
5db006c9-2115-4e4f-be4e-b97c1ff37254	programmi di educazione organizzati a livello locale
5d7e4938-b462-4444-a571-28e3cc48f666	eseguire analisi metallurgiche strutturali
5db9a526-d0e7-4f73-ac58-f4a14d1eaf3f	montare i mobili prefabbricati
5db7a66c-ae62-4d04-b522-037deae4293a	ispezionare gli istituti di istruzione
5d6611e8-691b-4ef6-9e5a-e7d239685769	fornire consulenza sulle questioni ambientali connesse all’attività mineraria
5dce1177-74f0-427d-89e2-270f0d889561	esercitare la supervisione degli arrivi e delle partenze delle navi in porto
5dbf83fb-b6d2-4994-84a0-7a9a3819b496	stabilire l’idoneità dei materiali
5dd2ea28-b703-4979-bc6f-ad8970a2e711	maneggiare sostanze chimiche
5ddd69ba-3d09-4846-9fee-85834d9e28a7	collaudare l’imballaggio
5ddf1662-26fb-40bf-989e-ba45c8500701	intuire i bisogni degli acquirenti per pianificare la vendita dei prodotti in negozio
5dd80322-4477-4106-943a-de2e8077dc50	valutare la qualità delle competizioni sportive
5ddea78e-6133-4ba0-ab65-b059b2e8218a	manutenere sensori
5de55542-dbcb-4fdf-8f87-a50b786c4c65	negoziare l’acquisto di prodotti e servizi turistici
5de83c59-e3cd-4ba6-ba2d-ab66dde71e46	fornire l’assistenza per l’interruzione di una gravidanza
5de109a5-b9ec-4cb8-bcdd-53d8a9e192e6	principi di ingegneria meccanica
5dee9a46-dcca-4ba6-9251-e9acea7d5df3	contributo delle piante alle condizioni climatiche e sanitarie al coperto
5dce4cd2-9a58-45ad-bd41-bdb3737842f7	riparare l’impianto elettrico della nave
5dfbf7a2-7399-4ec7-9008-dfd9f18d531c	supervisionare la manipolazione degli animali nelle attività veterinarie
5e0556b0-cb42-4065-8892-75ca877ee61c	produzione di accessori in metallo per porte
5df5b850-5211-4d89-bfe0-67d884b80aad	animali vivi
5e07ad4b-7834-4e38-976a-6af0da3ef732	gestire le attività dello stabilimento
5e0a56d3-576c-42f0-9903-1c2b51ce6d8c	gestire le operazioni di cattura dei riproduttori
5e09067b-a7c6-47d8-976f-21130a148452	utilizzare uno scavatore
5e0dc926-f10c-4b52-a140-0c79fbc8f9c5	metodi di attivismo
5e0c4a8d-b2d7-47c3-a02c-67f3188b0bd3	identificare i guasti dei contatori
5e281d96-32d6-4557-92a4-5066b6e3b124	trasferire le merci liquide
5e201bdd-02db-443b-88b7-12aaab0c7d83	utilizzare i sistemi informatici per scopi commerciali
5e2b8848-14ac-419c-83fc-c8c31d985c44	sorvegliare i macchinari per lo sbiancamento della cera
5e2e5472-42ea-414e-996d-bfb5c807d9dd	gestire i fiumi e i torrenti
5e2eacca-f237-47cc-a6bf-e60e5ada3414	utilizzare le attrezzature tecniche per la sterilizzazione
5e3812d6-f9fa-4d6f-bd69-df24b6a68290	comprendere la struttura di uno spettacolo dal vivo
5e38f3eb-dc0a-4e00-b571-189a06acb4e2	tipi di macchine ricalcatrici
5e36038c-f7b9-49bb-8f62-0644a926425e	dimostrare competenza tecnica nel proprio stile di danza
5e3b1883-157e-48f5-9536-e9d6f9211a89	creare rappresentazioni visive di dati
5e4a92e9-5abc-4665-8dfe-e909f40029a8	aggiornarsi con le norme
5e3b7fb3-e3ac-4a46-b198-f1c5772ec269	scienze vinicole
5e527ede-1082-473a-87c8-348773f18759	macinare i rifiuti di plastica
5e482f38-49a7-46cb-ad74-8d45edd3a95e	dirigere il tubo del calcestruzzo
5e532a44-7bc7-4a4b-af16-ca1c3d3de23f	fornire assistenza agli iscritti
5e65d64b-5b89-4060-b826-3e72fc0349a6	garantire la corretta segnalazione durante la manutenzione ferroviaria
5e7341cf-fffb-4ba9-93f0-7e7f2d319cff	garantire l’uniformità delle conchiglie
5e768dcb-2a96-48ef-a1b0-076dbb388327	esaminare i bilanci
5e7d4293-8360-439e-aeac-e00977e45163	assumere musicisti di accompagnamento
5e7c4a24-7784-44fd-8232-04a038f34b58	fornire consulenza ai clienti sulla manutenzione dei prodotti ottici
5e82ce38-1420-4ead-b278-17c74d4ad310	data warehouse
5e8a430b-776a-4987-9529-5f5710a343ae	posare nudo
5eb203ce-688b-4f07-8349-63d230630a07	coordinare programmi educativi
5e94a164-db04-43db-8e4a-b071bb4df188	ispezionare le attrezzature industriali
5e9e9817-906c-4ebd-b47f-9f07da10bff6	processi di produzione delle viti
5ebd0baf-2c6c-4f84-9b5d-08c21730624d	occuparsi del benessere dei detenuti
5ebc5815-9800-41f4-8f89-25980385b382	acquistare prodotti alberghieri
5ebe4353-781a-4ed0-aea1-ff49305ce321	metodi di collaudo hardware
5eb6ffe7-0dc9-491e-96c2-57f7a11ee9d6	collaborare con gli esperti di geologia
5ceac13d-c8e9-4e28-8bb1-a3f347a29985	adattare i set
5ed2e577-dfac-4374-98f0-f1dffa459ff4	applicare l’olio da massaggio
5ed7c73b-9fa0-4b46-b7a1-b174daceaec0	modellazione orientata ai servizi
5ecb53a2-d348-4621-a087-1f48c393ed93	scrivere una sceneggiatura
5eca8363-5ef0-4328-827c-dd68693239ec	conservare i risultati di cassa
5ef3e05c-bd52-40a0-9ca8-4b0be4717667	utilizzare la pressa rotativa
5eefbc56-4dd6-4c5f-a3fc-309a17f136e5	svolgere una ricerca clinica nel settore della radiografia
5ef28f0e-98c8-4af6-8474-6fab28050586	applicare tecniche di rifinitura per calzature
5ef6365b-de06-464a-ba52-f5aaedf626c6	analizzare le attività del call center
5ef9eed2-08d9-4452-8bbf-f1c91dca7e17	terapia respiratoria
5efa8a13-b419-45a0-9f91-3c1d79d1ef34	metodi di trasporto
5efe9da6-6ca5-437c-973e-46d08f153e30	collaudare apparecchiatura elettrica
5f02c1ad-a8cd-4811-a781-13f4fb024036	gestire le squadre addette alla perforazione
5f166f50-6346-4003-ae07-2ce80d57d313	tecniche biomediche
5f17e785-fe5b-4dda-a9da-2a5e00c400a2	requisiti legali dei prodotti TIC
5f0957bc-8326-41ac-a62e-76fc2fde1e42	utilizzare detergenti chimici
5f021188-74aa-4ee9-8479-0b4b141694b8	guidare le navi verso il molo
5f27b3a0-495c-4cec-aad2-f821b871d353	posare gli specchi
5f47c95f-e066-4d54-b976-c7640cce1272	preparare il materiale per una presentazione
5f493dc8-9a12-4abf-b36a-34da52b2baa8	trapianto
5f1a8e63-8107-4efb-8bec-98b2e9083081	consigliare i clienti sulla scelta di specialità gastronomiche
5f3b9677-4a90-49e4-a2e1-9a886a3d7039	valutare il comportamento alimentare delle larve
5f4b112a-e911-4b53-90b8-f22d3f593e88	tenere traccia dei pagamenti delle spedizioni
5f4c0ade-724e-421d-9b88-980f2d6876d1	Cisco
5f532533-4d0c-4f86-b43a-b3f3a58c6490	saldare giunti a camme in piombo
5f537423-aacf-4141-a09d-d5442b45c40f	gamma di prodotti delle imprese ferroviarie
5f6323f7-0bb0-4393-a42b-3e8f05150e26	ingegneria delle strumentazioni elettriche
5f7c7492-97ec-4524-818b-6107d576eeb1	essere addetto a macchine per la stampa su tessile
5f7cd0b3-421a-4465-ab17-7ecb2bf8b506	comprendere il kazako parlato
5f80c1ef-812d-460c-9e79-48b10b3f10d1	imballare gli articoli fragili per il trasporto
5f8c1f7a-8415-4751-b3dc-82ffde1d09a3	effettuare la manutenzione dei sentieri
5f81f91b-5884-4aef-a81f-f7d1d099785d	tester per batterie
5f7b9329-3e0f-4154-80c9-5462a2cc2a7f	offrire consulenza ai clienti sui tipi di apparecchiatura informatica
5f861d0f-d7a8-455f-ad07-e522310c5517	utilizzare macchinari di trivellazione per la produzione
5fa39673-6fc1-4509-bcc3-6d3d0e4f2f10	montare i video-filmati
5fa22035-91ce-4c57-aff7-4d530ea8674d	medicinali
5fa39999-bc84-4b6f-8684-044b1f5f9d6a	gestire progetti di sviluppo dei contenuti
5fb1dc3f-4562-4fe4-82bd-bbd63d20637f	sistemi di coltivazione dei crostacei
5fb1d032-5c36-4bcd-b521-a6f844c2fddb	utilizzare i sistemi di comunicazione marina
5fb2bc62-d8b2-48d5-82e9-d7dd99ece5fd	assistere i beneficiari delle sovvenzioni
5f9ed5ac-bcfa-40d7-a140-b3dc48e07f3a	collaborare con le parti interessate nell’offerta di attività artistiche
5fbbf0f3-daec-40f1-846b-1f3a8ad655c1	manipolazione dell’uva da tavola
5fbf40fe-6566-4706-828c-92a505c6c592	eseguire le procedure necessarie prima del decollo
5fc06b9f-5aca-4588-ba61-ed52464748b8	produrre cristalli di semiconduttori
5fc7b2ef-c651-4bba-8ebc-0bf4e4a24f61	olfatto
5fc81d52-4c45-43d7-898e-99fea1d6e947	sviluppare le tematiche di eventi
5fcc7922-9d55-4bf1-83c4-09ad58b9daca	diagnosticare le malattie genetiche
5fcf6f3d-3ab7-42da-bb8f-9f55ff83a23e	gelatinizzare frutta
5df3bdd4-2cce-4e56-bc4f-a3c3b6897b4d	fotografia commerciale
5fdd6145-5f17-417f-83b0-b79d1303e122	psicopatologia
5fe5f1e2-db53-47e3-acbb-c7e81a303813	utilizzare un sistema di comunicazione complesso
5fde17b6-7dd1-4963-9289-e9d73582a387	comprendere il francese scritto
5fd87f0c-44a1-4d1d-a83a-4490e2dcacea	osservare il comportamento anomalo del pesce
5fe88a3b-8a4d-472b-a79a-c25502af6912	riparare i tralicci
5fe644e0-8487-4fbe-9e80-adcf97d34504	attuare obiettivi a breve termine
5ff938d0-a2d1-41c6-ba1d-1dda64af389e	comprendere lo sloveno parlato
600ceff8-09d1-4ee8-a414-49179f17fd86	sensori a infrarossi
5ffca45e-810f-4bbf-bff4-5a916673d554	ispezionare la nave
600d1a88-937a-4d88-af03-afb798186a6f	biosicurezza delle risorse acquatiche
600e06d9-7bb1-48f4-8b03-a51b9908983d	utilizzare l’ecografia ostetrica
600a254d-b96b-4ff5-b140-761c3b1d9f16	suggerire che si effettui la manutenzione dei pozzi
60121b9b-b02f-4fb6-b375-d3d213f4faac	sviluppare politiche di prodotto
602855e3-30f5-471b-8a00-ecfecf205b74	utilizzare gli incentivi motivazionali nella consulenza per le dipendenze
6029e6f7-e8a4-47c6-989d-68455054b78b	indagare sui casi di falsificazione
601fbf35-abbc-4d94-9b82-b70b2ae7ca73	gestire le procedure di test sulle sostanze chimiche
602b47c3-c93e-4453-9f26-0c6e936109c4	gestire l’allocazione delle risorse di volo
603103f5-9d8b-4035-8ac7-8a7d572d0465	trasferire petrolio
6015b942-97da-4474-a012-6ba8a792a157	selezionare le aperture della macchina fotografica
603d953d-ad47-4d9d-a019-c6d000584292	incidere un modello
602d43ad-16d3-482e-8be0-8edadc67e1dc	adattare i progetti esistenti a circostanze mutate
60400391-8ece-469c-8806-7e50b6171095	valutare i dati raccolti per migliorare il programma di attività artistiche
6040ae9e-d23c-42c6-be43-967c9146e579	gestire le comunicazioni nel settore della trasformazione alimentare
6044920b-747b-432e-bd08-1ac55f7ad2af	utilizzare i sistemi di comunicazione ferroviaria
606b57a4-6feb-452a-8427-46311a37765a	gestire la distribuzione del tempo nel settore turistico
6040fcf2-fc06-4462-8fd7-2e1bb9d9f5ad	fornire consulenza sulle riparazioni dell’infrastruttura ferroviaria
5ec1171a-6454-41b2-820a-643fa515a1a6	architetture hardware
6077e1b6-d0b3-4ef8-b9cc-e2c4f700d8e5	caratteristiche dei vini
607be3de-20cb-42af-a225-77f9689cff39	guidare l’analisi di uno spettacolo registrato
60758037-9dd5-47ba-9c1f-ed965a551dbb	risolvere i problemi del sistema TIC
60807c0f-7f02-4154-8f80-e8221941b0a0	applicare tecniche di assemblaggio per la fabbricazione di calzature con fondo incollato
60845169-2728-44ba-82e3-18d73fb70ccf	utilizzare una macchina perforatrice
6083f29b-6da2-4fef-8b6d-10f1a951a36e	processi di valutazione
608a6284-311f-47f2-901c-84513eed6a3a	sviluppare metodi di migrazione automatica dei dati
608d16ee-df32-4686-95f7-14022de35d31	trattare i disturbi del linguaggio
6091724a-c139-46a5-bf69-aeb002da11a0	raccogliere le opinioni dei dipendenti
60920356-7f45-49f1-822c-069ca3fbfef3	individuare i fattori che causano alterazioni agli alimenti durante la conservazione
60930637-1f85-41ff-9379-43b5bd98e159	zoonosi
60a376f9-2288-4cc6-a94e-a76cf36de356	proporre gli alimenti per gli animali d’affezione
60ad52d9-7c47-486d-b31f-a0f28a4d4bce	organizzare l’irrigazione
60ae63a0-673a-469d-8ea1-ca01969204b3	gestire la struttura ricreativa
60bc11c9-bd54-49ee-b4b1-6338ca46905f	preparare il cantiere
60b1be23-0b1b-46aa-8d53-da05d6a03512	immobilizzare l’attrezzatura pesante da costruzione
60c00b41-bf40-497c-8205-d4f45e2f0b28	preparare le attrezzature per la stampa dei tessuti
60cdf200-ad98-4e76-9c24-4263ef6e3b17	metodi di trascrizione
60d6de24-6e66-42fd-94e0-0e8da88036e1	diritto ferroviario
60db6492-c8ec-4ca9-b51b-5e10961c1f35	eseguire le operazioni di acquisto nel commercio di legname
60dccfa1-63c9-4e6c-9301-666970364dc4	esaminare atti criminali
60fd2f7d-9852-4162-9fdf-a01320b25dd2	far prestare giuramento
60ea8914-91e1-46e0-8cff-4084e24ac76e	facilitare la partecipazione del pubblico
610510a8-044d-4ef2-a832-c6013ef140f1	tipi di laminatori
6100df2a-6894-42f3-9673-3e60b1365268	offrire consulenza sui disturbi della comunicazione
6108812b-c22e-4529-ab55-1d92a62a9fd0	tipi di presse
6116785d-9103-48c1-aa0e-6ae9ae530676	ricevere le merci
61235ed3-0548-44a6-8815-613abdb5929e	soccorrere animali
61285ecf-ebba-4889-a362-546e7a605026	lubrificare i motori
6120cdd1-d60b-4c9c-aadd-3ca0361bd9f1	ricevere il materiale edile
612a23c6-668b-4cd0-a5f7-aceb726e71da	tipi di cassaforma per calcestruzzo
612726d4-2f98-4b7b-add4-dd85a1696649	garantire il controllo della qualità nell’imballaggio
612cfa63-cc87-4814-a8f5-dced89ef8018	gestire le entrate
6134b285-02f5-4187-946a-9775fceacf6f	utilizzare dispositivi di stampa a monogramma
61316137-b6cf-4781-a196-2f0f74185582	utilizzare apparecchiatura di saldatura
61350866-5006-4e0d-b8ec-ed2f965906fc	garantire che i prodotti soddisfino le prescrizioni di legge
5fcca29f-797b-4802-8f3c-5f87b9e6d401	monitorare le operazioni di registrazione dell’estrazione
6158507a-b8ae-4ee1-8bef-a4ed78110489	storia naturale
615c29ee-1203-4cab-9283-5671a9c66129	eseguire prenotazioni
614713ec-287c-4d10-8eb1-f57405617969	condurre analisi di controllo qualità
6160489a-c94b-4e1b-88a8-b150af2d9e5d	gestire forni industriali
6164f3d5-228c-4a95-8bde-36f2fb7c8225	analizzare le tracce ematiche
616a4a22-82e6-4879-8ea6-132c086af65f	spruzzare gli antiparassitari
6170ca2c-c381-4151-b22f-69af93c8aa90	comprendere l’inglese scritto
61704dad-3339-4d2b-8f3b-15e336e99aa4	offrire consulenza sul rafforzamento della sicurezza
617504ca-31b5-455f-a419-ce0f326a986c	trattare le unghie dei pazienti
61724e61-497e-4f7b-82aa-ead7fc840b73	Shiva (sistemi di creazione di videogiochi)
6176a659-2388-4ec9-9adf-5c831c4b6793	parti di pistola a spruzzo per vernice
617a34a6-90ba-4bb0-9092-848bdaf982cb	ricercare le nuove procedure fotografiche
6171bb71-3dfa-4cc0-9e70-20413d9a89ae	fornire informazioni sulla biblioteca
617b627d-b06f-4c27-afd8-9191e9f99863	deterioramento dei prodotti ittici
618748dc-bc77-4f71-b7d9-8d2ba9457b0d	effettuare la manutenzione di attrezzature di illuminazione automatizzate
618a20f0-91ee-4277-adc8-7f70717d4084	eseguire le indagini relative alla contaminazione
618d33c7-34f1-451a-8e21-1860ee38825b	riferire in merito agli esami radiologici
618ed6e4-a450-488c-b7ae-6d69c61452d9	gestire la logistica dei prodotti medicinali
604c8985-d685-410b-971d-0dc2741b041f	essere addetto ad asciugatrici per prodotti tessili
6191b336-f451-4686-900b-c29455c7159e	fotonica
61a92c78-beb0-4c4e-823a-224e85ebde89	vendere le apparecchiature audiovisive
61a273ad-b150-4454-b478-9a79c7087676	montare le attrezzature per l’esibizione
61a97c75-67bd-4ea1-a441-09f60d14a59d	eseguire acrobazie
607c30c6-5de8-4f8f-b635-543086d6efed	eseguire il repertorio per scopi terapeutici
61a98ee3-92f6-458c-8b11-73096dcbc545	preparare pasti semplici a bordo
61aa21b8-5db5-4a46-83a0-d3204657ede9	valori storico-artistici
61b32f65-1268-4fb1-a7be-08221f02b5f1	ammortamento
61b6254e-ab72-43e9-a3c0-04c1e0c71c6e	metodologie di valutazione nella pratica paramedica
61b94c63-6a53-4394-accc-2e8e7181d4ec	applicare l’abbronzatura a spruzzo
61bb7f0f-b2e4-4971-890c-122bc84511fa	gestire i sistemi di rifornimento
61c6a70e-98c7-413b-9d7e-1f3e876a3c75	stabilire un rapporto con il cliente
61cc8103-723b-4098-8c5a-ee1de816514f	produrre un piano finanziario
61c3a929-7711-4923-aaf2-a4735a9fe0b3	coordinare i turni di produzione delle anime
61d8813e-7418-4710-aa7e-6944ae3491b3	stimare la redditività
61e012a3-35bf-4556-bead-02fd74a385b8	valutare pietre preziose
61e925cc-efb2-4d9e-9f28-bc1341e3503d	esercitare l’adeguata gestione
61eb5fcd-c708-429c-bbad-339eadcf28c5	riabilitare una dentatura usurata
61edd31a-1fd4-44e2-8c13-5c7f94205c6d	comprendere il sardo scritto
61fd0b68-2b6d-4bb4-b045-61dfffbda6d9	rappresentare una produzione artistica
61f85205-d8b5-4f1b-bfec-f2a45b18ee34	pulire le macchine per la produzione di alimenti e bevande
61fd1e82-ffd5-4120-b3fb-7b9e24556a9c	contribuire allo sviluppo di sistemi biometrici
6202f453-ff09-444f-bace-fcef894ff7a3	coordinare abbigliamento e accessori
620ed996-87f0-45f5-91cc-40244e3860c3	sviluppare metodologie di valutazione dei fornitori
61ff7f5a-c577-435c-a185-0ffc147165c7	controllare la profondità del foro di perforazione
621a24ed-81af-4be8-84b3-ecb1655b6b13	utilizzare le pompe per i prodotti
6221c16e-a017-48f1-8d56-c38d1b44cc2e	principi di progettazione
6211304f-f48d-475e-b760-5cb1aa83ed40	fornire assistenza ai clienti nella scelta di registrazioni musicali e video
62226932-a194-4c7d-85cc-e5e0014cc283	realizzazione di lastre da stampa
6225a669-3d07-47c3-b534-7ad4f371e8a6	piantare i vigneti
62226bb3-9997-4077-bcb9-ffb2a90840ab	determinare il prezzo del servizio assistenza clienti
6225c7ea-6328-40d8-81ad-a459ceb6c228	fornire consulenza sull’uso del suolo
62366273-a1ae-4c13-8f45-c7cef97edd2e	raccogliere organismi acquatici
62486047-44d6-4c07-8428-7855858ff098	considerare gli aspetti ergonomici del trasporto urbano
6251a148-69af-4546-9bf2-e818482ee08b	attrarre i giocatori
625423a7-6994-447e-8bd2-cd96a344fc34	supervisionare il trasferimento dei bagagli
6257e0de-7636-46c0-bef6-7beeebc8e85d	scrivere gli oroscopi
625664f3-c2a1-4313-813c-1e741df5545e	utilizzare canali di comunicazione diversi
625b100a-c939-4ccf-9e41-1ee404bddec1	rigovernare l’area di servizio
625ea08a-92d9-4a77-9f61-a53e8a064f45	norme di qualità delle banche dati
62645a18-b135-4eee-9a84-b36c142428b2	biostatistica
61766c6a-64dc-42cc-8aeb-c606bfd5a3c7	somministrare farmaci specifici per agevolare l’allevamento
626fffcc-4cbb-4632-b582-7513c95a2d2c	svolgere operazioni accurate di produzione del tabacco
62661300-9bee-411e-8825-dc957200c7d1	consigliare i clienti sugli accessori d’abbigliamento
6276e2f2-3a5f-4327-ae59-b9b2a00726c6	utilizzare tecniche osteopatiche per migliorare la salute degli animali
61802631-107a-4c6a-8262-048fc54db169	fornire informazioni sugli effetti del parto sulla sessualità
6273eab1-d894-4128-87e2-28017f4131a1	eseguire un’ispezione pedonale
627e4fdf-4a36-44ea-b187-375ad6477ed1	fissare gli elementi di protezione ai pali di legno
618e41b8-f508-44b0-8494-70286675c971	pianificare gli spettacoli musicali
6286a1c2-82fb-41f5-8204-c85c41d7e264	principi di equitazione sicuri
628830e8-5bea-470f-b1ec-f8b588837bc4	compilare le relazioni di valutazione
6289b8e6-3b0d-4166-a6eb-a95e86b4cf6d	mercati per le modalità di trasporto
628b8c17-e8a6-478b-b009-4d29ddd6e1aa	assistere alle esibizioni
629bf87e-4049-4842-9dd1-b8339c9b12c0	valutare le proposte di programmi umanitari
6290c5cb-248d-4db8-923c-459d304c31bc	insegnare la lettura rapida
629bfa21-e3bc-4c65-955e-c3bda65697dc	gestire i macchinari per la produzione di attrezzature da pesca
62c9ee7e-38bd-4b0c-81a9-cdeb5b05c0f0	usare software di controllo degli accessi
62efb681-4f6b-46b9-a0eb-54fad2e946a5	gestire l’allevamento di cavalli
62f76e5e-ffdf-4433-969a-362bdc2a51e3	utilizzare i software di cromatografia
62dd9e8a-cd19-41c5-97a8-847c5081e445	qualità delle calzature
62f3daff-d44c-4f6a-8bc8-c4e01f36ee20	modificare abbigliamento
62fbf8f8-c930-4dcc-a11b-c020e9322982	azionare i veicoli ferroviari
630a65a6-c571-429f-a820-a2bebf912006	impostare la durata del ciclo di pressatura
6316e93c-8f8e-432e-b315-02201deba66c	tecniche di scrittura
6311b5a5-0e88-4283-babd-09ce4dd914c6	gestire i prestiti
6321bbf2-4063-402a-8980-870e2e5e397d	utilizzare sistemi di apprendimento automatico
631a3dba-e8d9-445f-bd05-1336674ae54f	illuminazione 3D
63232a10-0313-4e10-8441-8bb8dce551fb	memorizzare le istruzioni di assemblaggio
6327c86e-a072-488a-aee9-45631dd2c16f	attuare i piani d’azione per l’ambiente
633483e4-6354-4192-a23b-d072d554c8d8	rispettare il codice di condotta del commercio di legname
6334c692-8b37-4bc9-8a6b-5340dd120acd	garantire la sicurezza della nave
633f686a-8688-4d41-bdcf-b824fbab15a8	collaborare mediante le tecnologie digitali
63454906-2166-4f58-aa50-582bf4208c8d	assistenza ai disabili
634886b8-22e1-4ed9-8d7a-4a2620150d30	sviluppare un piano di massaggio personalizzato
623c7fa8-70b5-4957-8148-96167c7159f2	acustica
63576837-2d17-46fe-8852-08eb34fe5fb0	gestire le finanze di impianti sportivi
634a2470-4056-4591-9a1b-f23334bde846	valutare le esigenze di produzione per pianificare un programma di produzione
635cf6e4-e671-49c7-b4b5-176514ca2bf9	anamnesi dei problemi psicoterapeutici del paziente
6368bcd9-fa93-4ef5-8ab0-d51b855ee3b5	guidare lo svolgimento di esercizi di disaster recovery
636ff9e6-f002-478d-896e-a9a7c913cad9	garantire la ventilazione necessaria durante la lavorazione
63729374-6221-4692-b092-16d8cf0153e8	elettronica di potenza
6372992c-1016-48e9-be47-9bd253bc39df	determinare le caratteristiche dei depositi di minerali
63782439-2936-474c-905c-cb5dc25824e8	installare gli inverter
637a6f00-d1ac-4e9f-920c-8fc80fdb0a16	fabbricare tessuti a maglia ultrafine rasata
6270389c-8a2c-40e8-a292-986eb7dd844d	ispezionare l’attrezzatura di perforazione
637d7ebb-de83-45ac-b80a-6fee961e6836	formare prodotti in gomma
6380a144-455b-4011-acaa-315d02e5cb55	romaní
627ddd6e-448e-47d2-a404-78c4d300f486	mercati verticali
6390a302-dcfc-4fec-9fd9-681090b0c1eb	conservare un inventario degli alimenti in produzione
6387c591-3815-43b7-b290-5c93086998bd	sterilizzare l’ambiente di lavoro
637e45c0-6928-40e2-a075-59f7d1abf2d0	gestire il personale chiropratico
6394e4d7-d0ee-4780-b1f4-5d20eda862db	russo
6398df4f-fc90-4565-af71-eec255b2dedf	documentazione professionale nell’assistenza sanitaria
63999215-d581-4511-878a-2aeb49f01370	attuare strategie di vendita
63a81429-5e4d-44bb-afa1-cb0572e05d08	affrontare le questioni del traffico aereo
6399728f-4bba-4f38-8edc-b526096bc113	contribuire a definire il calendario delle prove
63ad2bd1-4afc-4bf9-9376-6c5dcb131b4d	prodotti floreali e piante
63ab6994-35ca-43b8-81b6-11e8406cacf1	tipi di imballaggi utilizzati nelle spedizioni industriali
63b1ef23-5782-49fb-91a0-b13760820111	azionare le locomotive da manovra
63ae4c24-e214-47a3-a520-6d7dbeee9f7d	condurre attività di formazione su questioni ambientali
6302c960-9cf9-4850-ac76-2cebc600fe47	valutare la nutrizione degli animali
63bc4937-8946-4ade-b759-795b2985e2be	mantenere registri di sistema
63c0a2ee-c361-47af-a8e7-29019ec06911	gestire le transazioni finanziarie della stazione di servizio
63bc5259-e6da-4296-9ca8-c7f1aa6faf09	definire i metodi di pittura dei set
63cea640-6a8b-4c3a-be10-f5a5ed30fd0f	essere addetto a macchine per il finissaggio tessile
63c49546-4fc8-45c4-8fcc-13fbeac6cf66	FileMaker (sistemi di gestione di database)
63e1d2ba-58d0-4388-966b-8019b360e000	scrivere in greco
63cd8e57-8090-4320-814a-ab3efa678ec7	analizzare le strategie di filiera
63e7e129-7921-4c83-b8e2-6cc627b99333	riparare strumenti odontoiatrici
63e93ab3-9cf5-44d8-947e-46c91db98974	offrire consulenza ai clienti sull’utilizzo di veicoli
63ecd3f9-d96a-4a3a-ab78-bec894a54043	normative per la protezione degli occhi
63f8b902-861b-4ca9-b0d7-dfba604402c4	ispezionare gli pneumatici riparati
63f1e59e-c151-48fc-aa1b-6fcc997d2284	eseguire le ispezioni HACCP per gli organismi acquatici
63fdd913-d241-4d62-bc33-2e1e9b47f898	stuccare il cartongesso
634522e1-052f-46d0-bf07-d9a3aee81046	studi giuridici
63f24d5d-91db-4517-b617-f74290c980ba	rispettare il capitolato del contratto
640a233e-40af-4fc4-9581-d165f3f35f6a	tecnologia di finitura a spray
6409aa2b-3d26-4f93-814c-454568cd2900	arrampicarsi sugli alberi
6414cd67-d1cf-43c3-a900-349b04b17ddc	ripulire il bosco
641a4550-3df3-48ef-873f-0969011f73d3	analizzare immagini
6425706d-7444-47c8-be2d-a3e839ea82c8	informare i clienti sulle offerte speciali
642693f1-66aa-4cdb-a056-76ca3cc452cb	genetica
643b5704-699d-4bb8-9e69-68f59dc8e90e	mantenere le caratteristiche dell’acqua specificate
6430223d-23e1-43e3-bb6e-a8dcc96d06d0	tecniche di gestione delle problematiche TIC
643e27ab-a6d2-462f-b8e4-6aced5c497d9	modificare gli impianti di distribuzione dell’energia elettrica
64488d05-44a3-4848-bbd7-da1eb62f0b8e	analizzare le tendenze della catena di approvvigionamento
64529b01-a10d-492a-8c3c-305a8d7ae707	essere addetto alla macchina di agitazione
6448d1cf-0372-4b90-8b46-82c5ff84f151	gestire i gruppi di vendita
6460f17e-eab9-4d75-83eb-8592445daa00	pericoli dell’attività di segnalazione o di manovra
64612d4b-6e03-4655-bfee-e0434a1a3c29	strategie per gli spazi verdi
646d287f-d577-4445-b570-f4b72e8ff7d5	Rage (sistemi di creazione di videogiochi)
63706076-5e4b-4796-be9c-f17e3a1fea66	preparare i materiali in gomma
64722f2f-11c1-4e5b-a6ad-3ba3e20ec17f	sviluppare le strategie di generazione di entrate
647b12c4-60c6-4b84-8fc5-e590ba76bddf	registrare musica
647e97b8-c3a1-43fc-a8ce-c75542813cc2	tenere corsi ESOL
64898612-86aa-450b-93f2-abfdcd0f32a5	indirizzare i clienti per i loro acquisti
64804058-a8e1-4dec-b21e-096c6954426d	preparare la frutta da usare nelle bevande
6492cc78-0304-4b1d-91dd-6292df4ae702	supervisionare la manutenzione del sito
648a9cfc-fe7f-46bb-93d1-e5f0d7fa94de	usare un generatore di segnale
6497d07f-8995-4f8a-ac34-82a4889502fd	tostare il malto
6494e94a-ef43-423d-b425-76244ce37d2c	seguire un’istruzione
64992a08-071f-4961-b14e-737e63d361a2	monitorare le attività bancarie
649e8918-e0a6-43b3-bd23-2bb5c9a7e067	installare cablaggio a bassa tensione
64a32c23-6396-464f-923f-283c3b59e752	guidare l’autopompa in condizioni di emergenza
64a8c5f3-0d30-42b0-b063-1c79589e86a4	dare forma al cioccolato
63ef946a-d88d-46e4-af6d-29e9d7015cd8	determinare la composizione dell’immagine
64a97cc4-748c-4abf-a645-06188f24cb9d	principi di ingegneria
64a9cd02-bdc0-44b3-8490-0e1be9330625	coltivazione biologica
64b5dc77-b145-4b25-ad3e-ea614432c93f	definire i metodi di fabbricazione dei costumi
64b74fa8-fc2e-43f0-82db-0e65f8692a43	gestire le forniture dell’azienda agricola
64b7746c-ed88-4adc-a86d-a627aa24b0a8	completare dispositivi medici
64b8e8c2-cf5d-49af-bc98-20a242c83554	intermodalismo
64bfdb94-2722-4bf0-97dd-c31678bca760	assemblare parti di gioielli
64c76c79-061b-409e-ae86-1cc5743bf573	coordinare le missioni di aiuto umanitario
64c7b9a3-9ace-4275-a3a0-975d31bad3f7	collegare il circuito dell’esplosione
641171db-40d6-4325-a7f4-055465759630	LINQ
64d52dc0-e6db-4048-a49a-95a5abbd0ec1	azionare la ruspa
64d31c9f-87aa-445f-bef4-9ae2b934d48a	configurare una registrazione a più piste
64d45f41-2a45-4cbb-8f12-09e59df6ff41	scrivere in greco antico
64dc3651-8dec-4d9b-8665-41e8bbabe5a4	calcolare le concentrazioni chimiche
64dc59be-5352-4f43-aa34-cc01b512782d	comunicazione elettronica
64e621d6-2f0f-4d67-b5b7-346902667669	utilizzare le attrezzature per il giardinaggio
64e7bbe1-4836-4e3c-8bad-4771f5954e0c	tipi di genere letterario
64eb204e-1358-4e95-9001-571fddd6feda	ispezionare i luoghi di lavoro
64ef6e5b-209d-46c2-8df7-a37e5bbf0ed7	preparare la documentazione per le spedizioni internazionali
6502b6ad-f869-430e-972f-9d4c3518d662	interagire verbalmente in montenegrino
6506b3a0-8e86-4529-ab43-0578f60b7ecc	utilizzare veicoli di emergenza
651219f8-2d79-48b1-9336-c1418d65e556	contribuire ai progressi nell’assistenza infermieristica specializzata
65132ae6-4062-483e-9102-9fdd03ab5871	eseguire operazioni di scrambling
65117f23-95d7-4e2d-acb6-c700cf1663b4	verificare la qualità della carta
651f97e7-f624-4de2-b4fb-6d815965dd55	sedimentologia
652068f6-c28c-48c4-99e6-0ab2eb3bb684	software di riconoscimento ottico dei caratteri
6521c1fe-d455-4e0c-b6f2-6f7841f29e3d	sorvegliare il forno a tunnel
6521b2e2-8814-4e0e-bb07-959b4c635cd1	effettuare la manutenzione dei serbatoi dell’acqua
652e3a1e-c95b-4c51-aad7-ddab9b90c351	propagazione delle piante
6539f5d4-ff5d-4354-9adb-205e1f9fa0f4	provvedere alla manutenzione di macchine e attrezzature per bevande analcoliche
65445db3-7c36-4872-b66b-2bf82af8a046	produzione di barili di legno
65467eb5-9b70-4a54-888a-cda9501c1315	rivedere progetti di costruzione
6479570e-022e-4292-a764-5d55b25811f3	comprendere il vallone scritto
6548368c-e02d-4e08-81fe-bbd95a5f6f1e	gestire una carriera artistica
654a0dc6-3397-42ab-87d9-422f51d0677d	partecipare alle riunioni di progettazione
654dcf35-8a73-4571-9106-8162472ffc92	rifornire i servizi igienici
654fb23d-bdb8-4eb1-8f6f-af239499cc3d	effettuare diagnosi veterinarie
655791ff-df54-4fe3-bae8-bc5d5fcc452c	tecniche di decontaminazione
656d38e2-1cc8-453d-a45d-b93ab703b9b7	rendiconti d’esercizio
657073e8-dc7b-4d7c-9b21-a4e421f88f1f	tagliare i montanti della scala
649c88bf-a1ef-4eda-b2c9-4b1b96a33066	caratteristiche dei rifiuti
6569247f-6570-4168-9704-626597b039b7	registrare i dati relativi al ciclo di maltazione
6571fa3a-980c-4178-a6c1-add723f57bf7	fornire i risultati dei test al personale medico
65754f45-536b-47bd-97ee-324df5822b35	ossidazione
65781d61-f321-4b94-9504-ab0518ffee18	sorvegliare le macchine che tagliano le lastre di cemento
657a0afd-47da-490d-81b7-b4ecb6e50d2b	coordinare i controlli pre-esibizione
657de21f-7da2-4814-b398-251566b5aafa	vendere i prodotti postali
657f2e7e-b159-4c8d-8e8b-e40406b604b4	predisporre un ambiente confortevole per gli animali
6582453f-40b1-4ee9-9fa0-c51760f76c14	rispondere alle richieste di informazioni per iscritto
65881a5b-3daa-4f91-b60e-699a19721194	aderire agli orientamenti dell’organizzazione
658a1758-1133-4476-8b3e-4da8390531dc	applicare i sistemi di tracciabilità
6589fa88-c957-4f01-ae80-35139d7846e3	migliorare il flusso di lavoro della produzione
65951fa5-2d4d-42d9-8d91-4e718f112ea1	fornire assistenza nella logistica militare
6592efe6-646f-4586-b4fd-c946714be54d	compilare spartiti musicali definitivi
659e713d-58ef-45ab-98d2-572da0593829	interagire verbalmente in estone
659c71bb-70e7-411e-af2c-b377099f67fe	regolamento sui prodotti da costruzione
65a07f57-3713-4a17-8c5b-8791be27bfc7	installare i martinetti a pompa per ponteggi
65a696cb-01d7-401f-9c5a-7ab304488e30	valutazione dei tassi di crescita
65ac4df6-a001-49d3-8b1e-c3e5a49d6c24	svolgere le indagini ambientali
65b89fd6-be3c-4c84-a1fc-a29833523dbb	CAD per la produzione di abiti
65b8fe20-e9e5-4c3d-8fba-12c5fcf4f360	eseguire la damaschinatura
65bc1b13-78d6-40eb-9b4d-65e7d090bc95	controllare l’apertura e la chiusura delle porte del treno
64fb4a45-6b91-4c3c-8543-f337504942c3	utilizzare le apparecchiature di gestione del tappeto erboso
65bffd1b-676a-4b7b-b9be-073ff8d6e702	farmacocinetica
65cdbee5-29e2-401d-a376-2ff93e324370	cavo di giunzione
65d1f9c7-9d76-4179-97b9-08a650d36ba0	preparare la sala macchine per il funzionamento
65d97f0d-3764-4689-9994-c159c4413a7f	utilizzare tecniche di chiropratica animale
65e1b253-8d4c-40a5-89ac-dc221976da85	ingegneria mineraria
65e091b0-9d30-4cb9-9f7b-eb60430bddaa	essere addetto a macchine per il taglio a getto d’acqua
65e4ca4e-0cb9-4791-bbdb-a4f41750276f	azionare la macchina per pali rotoinfissi
65e3322d-07df-4e74-9b30-f50abd380b63	sorvegliare la macchina che impasta l’asfalto
65f2e2fd-f61c-44aa-b2eb-5aa90c35c49e	lingue classiche
653ad1ce-a470-454d-a915-3bd5231d4248	arredi medicali
65f3142d-3502-4b71-8d10-87c9a2077f24	produrre relazioni basate su registrazioni relative agli animali
65f652e0-2de1-4cef-b548-c8fca5414513	specie di bestiame
652fd8fd-c9f2-4685-9fe5-33af05910b89	formare i dipendenti su temi legati alla sicurezza in miniera
65dc47ff-57e4-4ef5-baaa-effcc314cb8c	testare l’accessibilità di sistema per utenti con esigenze particolari
6606bccf-5958-4f05-9120-d509493b1163	vendere prodotti per capelli
66022140-a33c-475b-858c-1e002e3e26e4	minuterie di fantasia
660de83d-7f5a-4248-8ee0-438cc23040d3	adottare le misure di emergenza in gravidanza
6603b955-acab-421c-9049-e88090628d39	impartire corsi di Pilates
661120f2-8a62-42e3-a922-a14780a75197	industria dei mobili
6612c363-2717-46eb-b0fd-8fe7f5d44ca3	contribuire a creare materiale coreografico
66139f54-aff1-42b9-bf3b-e0615b369ddd	organizzare l’ingresso nelle attrazioni
660e7019-6daa-45e8-a3ad-6e4be0b97957	Oracle WebLogic
66159498-1405-4cad-8aae-91d6f16d22bf	esprimere creatività nella realizzazione di gioielli
6625059b-2283-43d9-93c4-1a9d30d1b850	interagire verbalmente in occitano
662b7815-45b8-4e21-a629-7f9047cbd19a	somministrare anestetici agli animali
662a74a3-031d-4449-a99c-29da7cb96696	fornire esperienza tecnica
663fbf42-9114-4e67-986b-c470f5eb3d62	informare in merito ai regolamenti
6637ea78-3c9b-40b1-9928-29c5a59c0342	Oracle Application Development Framework
664d25ff-2d63-4ebd-9b4a-036610b218d2	utilizzare armature semoventi
6664dfe7-f4a9-42bf-9f38-a2585f03baef	comprendere il catalano scritto
665fa964-0908-4d5c-a2c3-3b4abd9ee031	valutare l’igiene negli ambienti industriali
66528a2f-8747-4408-ae6b-d3fb6b19c2cd	scrivere relazioni connesse al lavoro
6661ff65-1111-4c11-96c7-d4b1472d478a	valutare il gruppo di sostegno del programma di attività artistiche
6668df13-6c26-4b38-a5d7-8034fae6718e	effettuare la manutenzione delle strutture di sostegno circensi
6671449a-6620-459d-9796-2acde61d6dda	medicina nucleare
667d03cb-a91a-49b5-a3f3-7ad6d4179693	ebraico
6674db15-f3be-4f80-9c7c-8cc865890865	settore dell’acquacoltura
66793bff-b5b8-44bf-91aa-d365f8d7a274	carne halal
66798b76-ca83-4f82-ba20-9e2fbc711904	mescolare ingredienti alimentari
66830890-3f6f-4e53-a528-39c1b44aa0de	golf
668186f4-ac3f-4bbb-9afa-476d30b66cc0	affrontare le questioni di genere nel fornire consulenza per la pianificazione familiare
66846db3-b935-4c63-95f3-d005179d7b09	migliorare la visibilità di un sito web
6683c5c2-8812-42a5-b429-490ee1698224	produrre componenti di strumenti musicali a fiato
66887c27-c1ee-45c2-9627-302a680d92ed	monitorare l’estinzione del coke
66988488-23a8-422e-8511-be534a576755	effettuare la manutenzione del guardaroba
668e8515-ca10-40b5-a0af-d4e5dea95b3a	comprendere il ceco scritto
66ac62fd-340a-46a5-b79d-ae17005a9780	processi di marcatura laser
66889a69-2fd9-48f1-9e84-acb76252221b	definire le regole organizzative
66a12aee-8308-4ef3-a14b-c7bfb8c9967e	organizzare in formato tabulare i risultati di un’indagine
6690ca9c-5fcd-486e-aff3-b8e56947a4fc	effettuare la visita chiropratica
66bda63a-eb15-4dbc-8f11-fed5349094f6	mantenere la concentrazione per lunghi periodi
669adde9-bf6b-463e-8ccf-654f8d8c3a3c	utilizzare la tecnologia forense
66c0d930-bf62-4c35-ba79-e26f52c900f6	geografia
66bdc1c6-aa0d-4b0a-b525-39d6914acfdd	preparare bevande alcoliche
66c118b7-1b48-4574-88ef-3a306ca7d008	sviluppare i nuovi prodotti
66ca6e8a-2d20-49dc-a681-74dd67fad3d9	ripristinare strumenti musicali
66ccf49d-2116-4932-bc4f-539d36684d54	garantire la conformità con i tipi di armi
66cfee3e-2117-422c-be42-a2147d1f15ba	valutazione del rischio per la pulizia dei vetri
66d1f697-b0e3-4c36-b504-42fabfd3f7c2	avere intelligenza emotiva
66d35cc5-081f-40cb-ba8d-1e236fee9042	tecniche di illuminazione
66de5fe6-1a1a-46e0-8c92-a5857d2e6641	definire la strategia relativa agli account cliente
66dca2ef-1005-4761-9d01-c99f5518802c	interpretare i segnali stradali
66e6ff77-fe5a-4c41-8842-045a140ba862	realizzare prodotti intrecciati
67062e54-e6e1-4723-beac-6e8e94aba4c6	preparare le bombole di gas compresso
67027f08-f62a-4820-a594-51aecadc35b2	mantenere un archivio informatizzato del traffico ferroviario
66fd2266-7d5f-482c-9798-24b2365611a8	offrire consulenza sulle preoccupazioni legate all’alimentazione
66ebcd44-1edf-430a-980b-1a4cd3084771	scrivere relazioni sulle indagini ferroviarie
67102176-eda6-4493-9231-c249bbf07f07	pianificare il processo di ricerca
670fd7cd-146c-4203-aa43-9253e2d7d726	determinare la struttura cristallina
670ffa95-2e04-4e0b-9826-3d6c29403bad	sistema di rilevamento del surriscaldamento delle ruote
67119690-fdaa-4549-b845-b47704a95348	usare sistemi di controllo computerizzati
67138daf-db49-4c58-84c0-407d48e615bd	fornire assistenza ai soccorritori paramedici
67184d3c-3fe2-4bee-8042-48198f88baee	fare ampi e numerosi viaggi internazionali
671b95af-ee86-45bc-bab8-e1f2d898a40c	installare i telai per vetri
673338bd-ba34-4b16-8718-833809148358	processo di affinamento del mosto
67216abf-651f-4163-990f-3c0421a9a75b	utilizzare le pompe per vino
673ea6be-e5e7-4b9e-ab28-34e3b1899042	neuropsicologia
673d5b2d-5e47-4e0d-84a5-cec4ebc1ca8d	preparare le armi di scena
6743e099-8543-458b-a608-b3a91cf4c048	scrivere in svedese
6740efc0-358d-427d-b1e7-fd233b64e94e	utilizzare interfacce specifiche delle applicazioni
67471a02-e4b8-41f9-8922-fa76c14c17a5	comprendere il vietnamita parlato
674b0b7e-8abf-4a80-8e62-984d418bf4dd	orologi meccanici
6764fb34-1041-4da0-948d-891c909068b2	personalizzare bozze
6754d174-eecd-4d5d-927b-3e8d1b736a2b	posare il calcestruzzo
6764afa0-acbf-48e4-8728-23cac6abbbe1	certificare la firma di documenti
6776ba6a-1a72-4eae-815d-72c4e020470f	elaborare le richieste dei clienti in conformità al regolamento REACH 1907 2006
6778fe05-d25d-42a0-9902-31f05e529b08	garantire la sicurezza del negozio
67854b91-44ca-445b-a47e-e195da833469	supervisionare il lavoro di un gruppo di interesse
6791f150-af23-42fd-b280-73217e4de431	asciugare il mantello del cane per l’ulteriore trattamento
67825e06-69fb-435c-a25b-3fa54f909378	tenersi aggiornati sulle normative doganali vigenti
6795d401-2dd1-456d-8263-5012d4f0f1e5	comparare le previsioni di produzione con i risultati effettivi
679b9bba-4e8b-4e4c-88f2-2346916cb3da	verificare le scritture contabili
65f041ed-2d6d-438f-8033-46194cb1ecb8	levigare le pietre preziose
67a67fa7-0bb7-46da-bef5-d2545fee2245	tipi di formato audiovisivo
67a0ecdc-94ed-4555-b86f-eac8b6bd9d0a	registrare i dati di fatturazione degli assistiti
67ac9c88-50ff-4cc8-bf66-2ca2b25ac4ae	registrare la nascita
67b2be23-2236-4054-8b57-529aac93bf18	azionare i paranchi
67b4be42-860a-4fc4-853d-74559f62f99d	effettuare gli interventi preventivi di medicina interna
67ba352d-90ea-469e-baee-ccfc3b30f5be	montare gli elementi scenici su un palco
67caa5ae-f7ad-4882-b40f-7b74953e5056	eseguire un controllo di processo automatizzato
67cd4a19-dc6a-4927-aa9f-c935f2c822e0	essere addetto a macchine rettificatrici orizzontali
67e3f75c-f5c7-404b-a4fd-7c6c9c53db30	trigonometria
67ea317c-83a9-4c60-bed9-1bf58ab50764	garantire che il veicolo sia pronto per il ritiro
67ea5323-a378-4c9b-baf3-1746e85319ca	controllare gli scarichi solidi dalle centrifughe di olio
67e6bc63-70bf-498b-aac4-eb6b2f4b6c20	manovrare in cabine di manovra con pannello a LED
67eb80ab-ad84-4f0a-b90a-a24e0677c82b	tecnologia di produzione di calzature
67fa16f1-3835-48fa-89bd-02516294a8ab	morfologia
67fad3ef-5494-4ffe-b9c5-6889265825e7	ispezionare le strutture in calcestruzzo
67fbfb4d-c1ce-4599-ac70-4dcfc1fa5fe7	mantenere i contatti con i funzionari statali
67fdd835-563c-4b9c-aeba-e6c4ccf9345e	raccogliere i capi per il servizio di lavanderia
67fe3a14-1899-4280-b7fe-ca7a4429703b	fotografare scene del crimine
6802768c-b070-4c3d-8599-c03cc15e353f	settore dell’edilizia
680cf113-f478-4966-915b-90014045bb8a	installare contatori elettrici
6811a1dc-99e1-4c69-9e1d-4f5060443670	sensibilizzare l’opinione pubblica su questioni importanti per la comunità locale
680dfb2f-b677-4f5a-8c60-c5978a760420	firmare le dichiarazioni dei redditi
68124084-0391-4593-a9d6-c0e54f4585cd	applicare nastri in tessuto
681f0c9a-7f33-4c03-95fd-3a41ba9b1752	pubblicizzare le assicurazioni di viaggio
683511e9-4424-45a7-b28a-57d6e219af49	effettuare la sorveglianza di sicurezza sotto copertura
682a4a0c-06e5-43c3-93a6-a40d5f1053a8	tenersi al passo con l’evoluzione della lingua
68361c6d-6d29-4bf4-af18-a5b670c6ddad	svolgere progetti di ricerca sull’energia marina
6838c1ee-7537-4d07-b12b-032fe673cc8a	registrare i risultati delle indagini sui ponti
68396ae7-3ee9-4123-b03f-16e8f94d78ca	azionare l’unità per l’installazione di elementi di fissaggio sulle traversine
684129ba-08c6-4565-99a5-5f760c414822	concimi di sintesi
683f7539-f8cd-4589-9b53-49695dd0c52d	separare i prodotti derivati dal cacao pressato
683e0a37-0395-48ae-b815-965bb14166bb	gestire l’inventario
68435090-134d-4927-bef9-861707f3b9bb	fasi di sviluppo normale
6862b616-09fa-4923-af3d-2bc1242f9301	comprendere il bielorusso parlato
686217dc-946a-4a0d-8576-0075ea5c66d1	monitorare la consegna della merce
6863e3d4-d284-4c6a-b625-69720a253e7a	comunicare con i laboratori esterni
6867dc82-6d09-46b5-bf6e-7e0c7e46648c	affrontare gli effetti collaterali della menopausa
686c5d48-5d47-4e82-b846-a0eb05b20b3d	utilizzare il documento dei servizi di traffico aereo
686e0f83-c699-45cf-9f05-79466d7feff5	concimare le vasche di acquacoltura
686e27b3-fc65-498c-9b19-b341ce194513	tecniche di sterilizzazione
6877f277-bc2f-4b08-be3b-80495c0f645d	commerciare le imbarcazioni
687ae1ee-914c-4f53-a16c-86d72ad13c58	informatica
66b635dd-d4f5-4695-82dc-78bcb90d4094	scrivere in curdo
687e8f62-930b-475f-ac12-d6737b37b2bd	studi religiosi
688da5c3-fada-41e5-a734-3b5890dfce2f	insegnare la guida dei veicoli a motore
688ebb02-4a33-4900-9396-e2777cf8f454	metodi dei gruppi di pari
68933218-94a8-43e7-9bf4-8133c8e24644	sistema di pesatura dinamica
68a5fb5b-13f1-4829-a3a9-e7c45e4906e1	persiano
68b0801d-b2b4-430c-bfe4-3889533a586a	formazione dell’opinione pubblica
68aa4b9c-462d-48c1-956c-b53bf1c93a57	interpretare dati relativi alla produzione alimentare
68b1e4e1-446b-4c5b-9acc-3f568a711af2	elaborare strategie per l’accessibilità
68b59bba-3a71-480c-bae0-345efd89be7e	sfilettare il pesce
68ba67b3-992f-4a65-9c64-c49adf85f270	gestione di un progetto lean
68cc4f1d-6f2d-4b45-a597-922df8704236	fornire servizi di scorta
68be1b35-25c2-4d2d-9340-38f3ee3fdd4f	selezionare i pazienti che necessitano di fisioterapia
68d2cbc3-3608-4b40-8d92-ae0af2f651a4	controllare lo sviluppo delle larve
68d12193-d2d5-41ad-b64f-3755adba77b9	individuare i problemi di salute mentale
68d7deda-6c66-4981-81fd-da27045f7e8c	gestire le reazioni avverse ai farmaci
68dc167f-528c-4ac0-83aa-e1cea9b8d37a	eseguire la pianificazione dei prodotti
68dd3545-d433-403a-961d-fd2d80918842	fornire un trattamento medico antitumorale
68e53daa-2bdb-463a-8280-c486b392c262	ingegneria finanziaria
68e92de8-c2d5-4da6-a14a-e99845ea2fe3	creare mobili originali
68ea733e-ce63-428e-b425-695ae3062b1c	analisi delle notizie
68eece9d-e4f3-44e3-8fa6-1f9c3debb196	gestire sistemi di videocamere a circuito chiuso
68edbf90-4c46-4012-9d8d-13362fedaf09	stabilire un rapporto con i media
68f711f8-e927-4e70-a921-1e29fccda6b5	gestire l’impianto di trasformazione dei minerali
68f87640-f2cb-4900-b926-7a070e91dfbf	creare una visualizzazione dello scenario
68f97a54-e85b-414b-ac9c-8e688b0685d1	Apache Maven
68fc0a96-61a2-4511-91db-c158ec9e4481	controllare la fermentazione
6906159a-48ea-4b57-9f5b-6a3835aa9ac8	apparecchiature di trasmissione
690858e0-cb57-4a64-ac12-449e1adae6e3	fornire le informazioni ai volontari
690df4be-49c2-4ecf-8e95-47d65ac536eb	riparare danni di minore entità ai parabrezza
690f3900-38d8-408a-b047-1e8abde8eeaf	politiche ambientali relative alle TIC
690db85c-9b47-4f67-81be-df69308a7f6c	comunicare i risultati della produzione
69113fd6-b82c-440e-8118-5065c77aba15	legislazione alimentare
679c54e1-a41c-4156-8fb8-08ef64d5638d	Nexpose
6925dc35-aff1-43d4-a6cc-66b0e7c9a567	fornire consulenza su questioni edilizie
692010f3-06d2-422a-8d8c-b681eb52a984	etica dell’occupazione propria all’assistenza sanitaria
692d6270-1935-47c9-82ec-1a6b36abb0f5	montare meccanismi di orologi
692ed348-64ad-43e2-93d9-9b9330194317	esaminare il costo dei beni di antiquariato
6932855b-b063-4bcc-a706-eb11144fd74c	conservare e tenere aggiornate le specifiche alimentari
692fa346-25a6-40fa-bf61-b96a79617a48	scienze cliniche veterinarie
69336ceb-3dfb-4591-9525-efbcf5948213	utilizzare il sistema elettronico di gestione delle cartelle cliniche
67f187cc-bbc9-4f1c-9cfa-46956f64e634	supervisionare il personale educativo
6935c260-3cc7-4e99-b45c-5fd791b691fc	supervisionare gli spostamenti dei passeggeri
6936c112-039d-4506-a2ba-6c3d636b0054	tipografia
693ce1fa-2e1c-4b3c-8fed-f1564018f665	lavorare con l’azoto bollente
69369232-6c78-4b9f-a73c-5aed85b11cb4	registrare le informazioni del paziente trattato
69414379-c54f-4c96-bcf9-15eb551df45d	software interaction design
6947021b-0ae4-4866-8420-b95f7f7866b3	compiti amministrativi in ambiente medico
6949ec59-5d13-4998-a44a-e7eb551ba25a	gestire il ricavato dell’ospitalità
694cefc6-36ae-47bf-984f-f818dbf0c391	disposizioni di polizia in materia di navigazione interna
6956af5d-ba56-4f2a-8b97-cc0a68771fa4	azionare i mezzi di movimentazione delle merci in magazzino
6958df2e-33c7-4499-8e79-975212261953	ingegneria dei ponti
695e0b50-334f-4daa-a2d9-8048ae2b1415	applicare le strategie di esportazione
695ff7e1-0e0f-4766-b09f-77944ee0c9a3	Schoology
696ab357-502a-4463-9757-17c9148cf910	specifiche per la produzione casearia
697a9188-06d0-466f-b8de-d9c6bbe41b51	anestesia, rianimazione e terapia intensiva
6974dba0-15b8-4f6d-995d-2e98f0d10b6e	sviluppare strategie per risolvere i problemi
68704bad-10b9-448b-b7a6-612203d46611	sviluppo di prodotti farmaceutici
6986f674-84a3-485d-b671-22a18c0e0948	risolvere i casi difficili di assegnazione ai conti
699940c3-cd1e-4474-9414-2815d18ba87a	gestire le aziende lattiero-casearie
69903133-9875-406b-902c-131e7672429f	assegnare i compiti per casa
699a9b34-6b85-43f7-89ec-456e5326f7b8	supervisionare una sceneggiatura
699c614c-820c-472b-8e46-535d208e5cae	vendere i contratti di manutenzione del software
69b3aba5-61dd-4508-84ec-0573a928d8a4	dispositivi ortesici
699edb41-a8aa-48c1-a187-2a3a38340127	ispezionare il prodotto della stampa
69bde3e4-75e7-4894-8875-0b203da10297	interpretare la lingua orale parlata da due parti
69b67ecf-e34f-4234-9b52-a13e2b3a3911	effettuare la manutenzione delle attrezzature agricole
69c6be1f-1142-4859-a030-42960b76f743	incoraggiare i fruitori dei servizi sociali a preservare la propria indipendenza nelle loro attività quotidiane
69b75399-0fe0-4fe5-bd12-18ac63daef62	lavare il vetro
69c6d1c2-3b26-4eb2-a9b3-b4ecd00917a1	cambiare le modalità di lavoro della tbm
69c991c3-3438-47bc-8415-1ee65e821e3e	elaborare i programmi di fidelizzazione
68d0002b-3962-410d-a208-831469101e06	promuovere l’equilibrio tra riposo e attività
69d889c5-3d72-4817-ac91-4317bd935b97	formulare un intervento dietetico
69dbdd80-5eac-4e72-9ad2-ce7738d54718	acquistare macchinari meccanici
69dc1b25-7e8b-48f6-893e-a6190c40d50b	comprendere il serbo scritto
69e7233b-ada7-427e-afe4-16d2952c3c07	parassiti e malattie
69dcaa9e-67cd-49b8-a53e-0b815748c084	maneggiare con cautela il filo metallico in tensione
69e32698-0500-4755-86a8-eaab26c0c2d1	NoSQL
69ef81ca-b1c1-4f18-9f57-bf020dd1182a	elaborare un progetto di brevetto
69f06dbc-db15-49b6-9f9c-08f4a49a657e	tecnologie di rivestimento metallico
69fed443-b659-4cff-b72e-d4084e87ef5a	Buddismo
69fd78a9-ce6e-4d71-b62c-c09116470575	sviluppare vaccini
6a053153-e0f8-40cd-a97b-d00b86585ce8	strategie di determinazione del prezzo
6a05cbcb-2d1f-4f5b-b40c-0d4afaf2d11b	elaborare materiale didattico per le campagne
6a0efbd9-96cc-4071-ba89-fa07394055e7	rintracciare le persone
6a05011b-0c18-41a1-bb1c-0f7bfc20cc37	pulire le parti delle navi
6a1ae1f2-f33c-4b48-b477-9600d3a766a8	inviare un’ambulanza
6a29b25f-c6ee-417f-b8ba-f3c306abe990	lavorare in modo indipendente per la preparazione di mostre
6a2172e1-b4a4-4f96-b471-82e339c4e98f	consigliare i clienti sulle possibilità di ornamento del corpo
6a31ae89-e174-4b2d-9b49-1ea1d56c4c89	salvare sistemi e dati digitali
6a35e4ff-d7af-4606-9cae-6910e5aff4b1	fornire servizi di auto con conducente di elevata qualità
6a37ba52-a510-46c4-98d5-b3e5d2fd7d26	progettare il pavimento
6a39be58-e3fc-4ce5-8282-af2f4c90bc17	norme del settore dell’aviazione e pratiche raccomandate
6a38d55e-b0b3-4608-9088-3d2e8201e636	integrare contenuti in supporti di output
6a3a7f13-4b55-431a-9269-546808514251	assemblare le macchine
6a44b8d1-9eae-4192-9231-6b7dd1780693	essere addetto a presse meccaniche di forgiatura
6a46170e-fd7b-4f39-8fb1-a0e4134bc1e0	banche dati di musei
6a46abec-168b-4ad8-922f-d81dfb18f8e4	modellare personaggi 3D
6a47cee2-233b-4272-b856-21cda39b7148	transcreazione
6949324a-b122-49ba-ac38-1d5f7136b6d7	selezionare i materiali artistici per creare le opere d’arte
6a5d70f8-5424-42c3-b3ba-4c6ad1c46ef9	preparare i pasti dietetici
6a633703-6517-4c17-ab69-d95cf60487fb	controllare la produttività forestale
6a639dee-7874-4972-a995-84c735d8b982	archiviazione dati
6a63b048-ba6f-4acc-899f-cf0bceb39f37	proteggere la selvaggina
6a6665ed-ac9c-4362-948f-f3351bdb3a5f	Gamemaker Studio
6a6741cf-b1bc-47c3-b0d4-0cda0f5d7f30	installare le telecamere
6a81bc6b-057b-493f-8a3b-ac855ac75804	gestire la classificazione dei dati TIC
6a82eceb-a24f-4e8f-95a1-85cf0b0dd7f8	riparare le protesi
6a8cfa4d-b9af-4aa1-a3af-92165f02865c	immobilizzare i pazienti per interventi di emergenza
6a937e83-b243-4adc-aa6d-6256bd3e0b90	separare la nitroglicerina dagli acidi
6a8e11ba-c064-4a92-8c79-8fc2b87a6863	fornire consulenza sull’efficienza energetica degli impianti di riscaldamento
6a9397f4-b60e-4b2e-afa9-24bfa03c2351	eseguire i massaggi
6aa7fb62-c778-4460-be44-ebc3b670f79e	neurochirurgia
6aaafc2b-0822-45dd-bc43-4d53ca49b2ac	pulire gli spazi pubblici
6a98d2ec-b41a-47dc-b440-4efc770f331e	azionare i processori di segnali audio
6abb231a-18f4-4e19-af90-189c132cc5a6	verificare il rispetto delle norme sui veicoli ferroviari
6ac2f9ef-898d-4899-894a-ae1cfb5aa996	sviluppare le politiche di difesa
6ac4e309-cf84-4329-8251-9e1f5a690139	radiologia
6ac9c041-6256-44ab-a564-bba9405fc334	creare modelli master
69fc6dbc-2898-4d90-bb30-eb7c201c1128	discutere con il paziente delle opzioni per le cure dentarie
6acc4ef1-cf95-45d8-99a1-de979f746150	installare strutture temporanee per accogliere il pubblico
6acc84e6-36b6-4265-8b9e-1ee47f7f11ff	applicare le misure di prevenzione delle malattie dei pesci
6acdc92b-991d-4c2e-906c-ed14ac60d950	analizzare i progressi verso gli obiettivi
6a2a1555-db53-4c6c-801a-a013cec3bd37	preparare gli esami per i corsi di formazione professionale
6ae5939f-9fde-44b0-a2aa-57e413a3e778	eseguire test di recovery software
6adfe0ac-4d88-4da7-9bf2-411f0a7719bc	lavorare con ambienti di apprendimento virtuali
6ae8c315-4890-44b4-af68-2187172ea4ee	effettuare le ispezioni
6adbe917-5e2a-4641-84df-590b604f533e	praticare i movimenti in sospensione
6aeff969-a412-4e63-abe5-6a80e9fd0350	gestire le risorse della biblioteca non restituite
6af6efe6-62c4-48ba-b412-388f07d05127	assistere i servizi di emergenza
6af1838e-7c2f-414d-aa8a-65f4d6bf9441	effettuare le ispezioni di sicurezza a bordo
6aedc5a3-166c-458c-a538-472b4e421ca5	lavorare in sicurezza con le macchine
6b0260d4-f463-42ad-9947-296e017a0676	rispettare le normative sulla sicurezza al lavoro
6a3c2e24-8930-45e9-894b-8d468f43e49a	condizioni per l’esercizio professionale della psicologia della salute
6b091a56-2277-41fc-a8cb-e4e8f74d7bbe	negoziare miglioramenti con i fornitori
6b0b2375-eeb7-4148-afdf-e05484f6f754	reperire nuovi clienti
6b150788-077b-446a-8ab2-7ca7f2ace546	mappare l’interno della terra
6b182714-ba89-418d-bbf0-40cacf9ed003	tracciare le consegne di caffè
6b20e815-2e23-4e7c-9ee9-2677b7ceb6d8	crimpatura
6b23a215-cfd8-4f5c-87ef-a9d94c142687	esami clinici in dietetica
6b2ce67b-82a8-4298-b277-e45751e02a2e	applicare tecniche di cucitura
6b384ae3-35bd-4fe6-8628-ea59067bfe7a	aggiustare le apparecchiature di produzione
6b33eb2f-a51c-473c-beea-3d74296b091f	rischi legati all’installazione di strutture pubblicitarie in zone elevate
6b344094-b674-4829-9a26-188a010c9d58	elettronica di consumo
6b3d2d58-9520-4df4-88d4-0f1539d139be	riassumere storie
6b411b8d-3961-4e9c-8d08-48a8e27a0692	sviluppare piani strategici per i servizi di fisioterapia
6b431b55-3402-4bb5-96e1-357adc5adc9b	progettazione della disposizione del negozio
6b466196-9203-4627-a5ef-c4f0f4a8b2fd	creare modelli per prodotti tessili
6b4ad29d-5a61-4084-8745-b4a2d7c3ad51	maneggiare il materiale da scansionare con sicurezza
6b4c7b17-6797-4500-8865-3d069ed81e12	attività di baby-sitter
6b500eec-a065-4ad2-9544-d6566abf7bb2	comunicare il piano di produzione
6b501288-f48e-47fd-9fda-856d84369401	manipolare le lenti a contatto
6b56c16e-6c78-4de2-9b41-f63568ef0207	produrre articoli a maglia
6a755102-830f-423e-a5e5-69c2f11a8771	gestire la redditività
6b6361f3-faf9-4a36-beb2-2b671b630d69	fornire l’assistenza prenatale
6b65aa93-111e-4c7c-9c87-6cb7127de80f	pianificazione delle attività di marketing per il settore calzaturiero e della pelletteria
6b65eb2e-0ea2-4ada-a180-ccbdd9c4e2b2	fornire assistenza per i progetti di arredamento con piante da interno
6b6f1c84-0f15-4718-989f-dc14a49713a5	trainare un trattore utilizzando la presa di potenza
6b71b276-4bf7-4689-aaf8-36b4ed767679	piazzare una scommessa
6b7dc17d-9843-4e7d-8eb9-edd60a55f7f5	scrivere proposte di ricerca
6b7f6e50-fc7f-47e3-8117-6fc53bd29641	utilizzare le tecniche di valutazione clinica
6b8640b5-48b0-4d76-b9c4-0ef3db9132d4	valutare i piani di indennità
6b881a74-c33f-4076-9b9b-2a5bd7b92616	diagnostica psichiatrica
6b897c57-09b2-4308-87ec-7e000a00d01c	modificare i suoni registrati
6b89aebe-127e-485d-b017-b05c864dde99	gioco d’azzardo online
6b98a1e9-442b-4fb5-8543-45910eb803ca	preparare decorazioni per bevande
6b110a57-25cd-4960-8d1f-c91aeb55b2fc	ingegneria antincendio
6b1f25a5-46c2-4fad-be99-500bef433527	valutare la gravidanza animale
6b9ad739-80b2-42bd-905a-2ebbf96997fd	cercare siti per i parchi eolici
6b9981b1-0b2b-4f10-ba9d-80925c968d34	supervisionare il bilancio dei servizi prestati negli immobili
6b9be594-4a35-44e2-8512-b4dd5a3157f8	tipi di pelle
6b9f6bde-f2d3-4e45-8cd7-f01ce0ed53b0	meccanica delle imbarcazioni
6ba2c285-649d-4f1d-8cc2-d9bc0564e20a	testare i sistemi di sospensione degli artisti
6ba3d25b-5b17-4d09-8bdb-ca96b167d62d	creare narrazioni animate
6b43ca04-0cf0-44c6-a503-a9b7dce808ce	procedure relative alle diverse aree di navigazione aerea
6bb99bcc-7268-4ab4-aea8-8bb1adb0d775	cucire i tessuti
6bb2dbcc-080d-4665-bbf3-4fabb72a8033	applicare tecniche di controllo della qualità alle calzature e agli articoli di pelletteria
6bbcc6bf-a384-41c8-b212-57569eff637e	processi di recupero dello zolfo
6bbf3dd0-b7f8-496e-b9b8-f3ea4af584ad	impostare la testa lama
6bbd9664-2db1-411b-b70b-d7bb8226eb24	eseguire piccole riparazioni dei veicoli
6bc1ba2c-cdc8-4a3e-94ae-eaf5aef317b9	monitorare le statistiche del settore dei mezzi di comunicazione
6bc0ba4e-39ac-4ec6-af00-054b14263474	collaborare con le autorità preposte ai servizi mortuari
6bc91416-d0c9-465b-9a1f-be66102c53dd	controllare i documenti ufficiali
6bd07a2f-82e3-4a7f-bce7-9f8b15ac1eac	eseguire le operazioni di controllo delle piante infestanti
6bd8fdd5-e10c-4d78-a8c9-195d3596d99d	gestire un allevamento di lumache
6bdc5f75-7757-420d-af56-05fbc37b20fb	contribuire alla organizzazione di eventi scolastici
6bde0545-f106-413c-9d0b-dffe5f6faee4	confezionare sistemi microelettromeccanici
6be2a7b8-27b8-496b-9b6a-17edad17f10f	applicare le medicazioni
6be30f1d-ef11-4989-9386-cbce3c37a94a	tenere i libri sociali
6bec4685-d1f0-40be-97f2-69c37d868e82	raccogliere componenti di pannelli di controllo
6becbf57-47de-4576-a3d1-2f54a013ff0d	partecipare alle attività civiche mediante le tecnologie digitali
6bf1ad8e-8817-449f-b1d9-a8fe06f2734e	creare nuovi progetti paesaggistici
6bee8dc2-3d52-4fb6-923c-19d443c6871d	LAMS
6bf3c837-fea4-4d19-b38a-c34913e921bd	individuare il talento
6b5f5dde-8e86-4a6b-983c-9f64e8baa71a	tenere le sedute di terapia
6bf420dc-322a-4d4b-bad9-09a4be719dd4	soddisfare requisiti tecnici
6c215d95-b8fb-4517-bf75-df9c4a025652	supervisionare le prestazioni sul lato volo
6c1851c8-6314-46ec-afea-e1eaaee1d34d	fornire assistenza ai clienti dello studio veterinario
6c224346-e90a-40da-81b8-4eff1f013a29	tecniche immunodiagnostiche
6c07d3a7-80ee-4b1d-b7c1-50e08659accc	correggere i clienti durante l’allenamento
6c28e7c9-4580-4774-828c-30151f170acd	valutare l’assistenza infermieristica
6c33c3ab-abc0-4d40-a680-16cb4d7b5a36	collaborare con esperti tecnici in merito a opere d’arte
6c426c7c-ecbe-43b5-8ed4-de3ed5051848	seguire il codice deontologico relativo ai servizi di trasporto
6c42f302-c3d6-40e1-9b51-83425c55d7c2	ispezionare i carrelli elevatori
6c47e473-92e9-45d7-84a4-f43a16638392	organizzare la registrazione dei partecipanti a un evento
6ba69a17-fac5-4365-be93-54c9b0deba05	svolgere le cerimonie religiose
6c555472-42b8-489a-992c-dbf2419eb4b0	utilizzare una macchina per la stampa offset
6c55af8b-517b-4eac-b877-c7e79a1e2588	filtrare liquidi
6c608d84-1ea4-42c1-9117-24c66e9cfce9	codifica delle informazioni cliniche
6c61e4e4-88d8-441f-9222-390425484f1d	tipi di sbiancante
6c634792-5902-4a4e-8d65-f7505c95f0ea	server proxy
6c6c09e1-510a-4b2e-8d9a-e84f6af3b1eb	marketing mix
6c6eef7e-9d1f-4347-8e08-a7ec449c9cfd	ingegneria inversa
6c7a101e-822b-4ef9-ac45-d8b56c225526	legislazione sull’edilizia residenziale pubblica
6c80c8d2-befa-45b5-82d6-cd65426308a2	assistenza infermieristica basata su dati probanti
6c8e920a-6da1-46cb-8bd3-53b09b39ca49	delimitare l’area
6c8e3521-7c10-4323-a227-9fa5268f247b	supervisionare le operazioni precedenti all’assemblaggio
6c8eec55-e4a4-42c0-bf42-c15de7be34e8	eseguire gli esperimenti scientifici nello spazio
6c90aa54-56e5-4705-a788-36002c346dec	osservare l’alimentazione della macchina
6c93578d-21ee-4667-9788-56081aa28781	organizzare i cavi
6c9822a5-3663-4394-9836-331658f314c6	lavorare con solisti
6c3376c8-247d-48d7-ac43-48d4f9ca1d1e	implementare tecniche di data warehouse
6ca79e01-6891-440e-b5c2-7b743372f94e	individuare le violazioni elettorali
6caf56fd-f1c6-4972-af93-3facf7dba566	condurre ricerche prima del rilevamento
6cb95743-44cd-4501-a3a8-826a8db9f9ff	bordatura
6cbfa7f6-9d33-45fc-bcbc-8964b3f8cbc4	utilizzare software specifici di analisi dei dati
6cd0d9d8-c82b-4ed7-a1d5-b4e201e2dbac	predisporre i programmi dei forni
6ccb9eab-d1ad-4bcf-9061-3605444eaa8b	gestire i sistemi di controllo delle operazioni di trasporto basate su computer
6c501e46-712b-469a-94bb-68c65b880c97	comprendere l’inglese parlato
6cd73970-8727-4ad2-82ce-604b52cf3a79	utilizzare calchi di parti del corpo
6cde67c9-8d0d-46fb-a897-c569efba23d5	gestire le procedure di miglioramento delle operazioni portuali
6ce35fc1-514a-4439-a9cc-50af7c3addc4	librerie di componenti software
6ce89224-403a-41f1-9310-6a68d6b79b5b	scrivere titoli
6ceab4fc-7e8b-454d-b658-bae058672fdc	sviluppare il progetto del prodotto
6ced26b7-020f-4ef3-a900-e64af55349b4	dimostrare competenza interculturale nell’ambito dei servizi alberghieri
6d05612b-3e30-4ab9-be28-93fdc1db8005	monitorare la cattura di pesci vivi
6c03c961-06ed-4d34-9374-12b06067586a	partecipare alle fiere del libro
6d0d0123-2e47-4dc4-be4e-d9757ee93342	versare le capsule vuote
6d0dabfa-65d3-4462-bd61-eca01c59890b	valutare i livelli di umidità nelle foglie di tabacco
6d110ffb-f413-4209-95d3-774e7513f394	misure di igiene sul luogo di lavoro
6c38e1d3-09ba-4e52-939f-87ba20b918b0	intrappolare gli animali
6d1638b0-aeb9-4208-87ab-d8820f697cac	installare interruttori automatici
6d1b1ce8-8e38-484d-a63a-0d60f7d8fea8	anatomia dell’apparato muscolo-scheletrico
6d17bb77-6688-4f0d-9f6f-2ade6df562ce	partecipare alla formazione del personale sanitario
6ce8e097-05d2-4c65-8996-d1d3d66659b2	legge antidumping
6d06b5d2-f794-455a-a370-231061ee6dde	prendere le ordinazioni dei clienti in auto
6d1e5524-2f5b-4594-862b-43c4e6b01e22	garantire il funzionamento della ferrovia durante le riparazioni
6d0c2a11-a1c1-4bc4-8f0b-6733e7316c1a	sistemi di asilo
6d2e57e5-e43e-4e94-b65c-9beb109002f0	chirurgia del piede
6d2a4381-1178-4e72-916d-8cc23f395691	meccanica
6d30a1a6-06c4-4343-b8be-bd647dfc2e58	gestire le fusioni e le acquisizioni
6d2c752d-efa1-4f2b-ae21-5e7af8c9d173	eseguire l’analisi dei dati online
6d44788c-df13-41a1-ae2f-7a8e1fb45533	archiviare la documentazione relativa al lavoro
6d340b67-fe2b-402a-a321-197e7ad32f83	prodotti del tabacco
6d4977af-d8c1-4903-941f-c363721a9bd8	aggiornare le istruzioni sulle procedure
6d5d7501-229f-46a1-b24c-aa0c413c35f2	selezionare i tipi di stampi
6d4992b8-e35f-4520-ad80-95e77f7f8d80	leggere schemi di montaggio
6d33f180-79b7-454d-bdac-7cd1b8c643c1	fornire servizi di interpretazione durante i tour
6d68788f-8744-4ef2-8cfc-1eaec759fd14	governare la nave secondo l’ordine al timone
6d6a2c2d-6917-4e8d-847a-3e5e5fae7bc3	produrre preparati in gelatina a base di carne
6d6d5fa8-f47f-431e-80f4-c9c5be8344df	eseguire le riparazioni di veicoli provvisorie
6d68d0c3-74e7-4a9f-bc16-9e1b1e4fc310	riparare i gioielli
6d5ea2d2-05fb-4158-a957-af6cbaf5ddec	analizzare i dati sul gioco d’azzardo
6d743919-e4f1-48fa-a702-6ae8763a8336	processi di trasferimento del calore
6d79a056-6cf3-4426-82df-924f0c10101e	vendere i servizi
6d7c300d-d13b-4fbc-8f59-3b4dfe165397	preparare gli animali per l’anestesia
6d79b5f6-6338-40d0-a801-9fd4e03b1bf7	individuare modelli statistici
6d864108-6073-4372-90fc-674ceb8adad5	regolare il flusso del tabacco trinciato
6d7f6de0-234d-4f5a-be73-cf94f3c3e469	offrire consulenza sulla salute mentale
6d8fc2bd-6b3b-43c6-825a-8bdbfced353b	gestire la sicurezza del sistema
6d90f627-8f8a-4028-a2f5-d306cc320ddc	sviluppare le politiche fiscali
6d91f1c4-2540-4227-ad98-ee49afc05372	controllare i tour di visitatori
6d7c5128-4ae1-4d3d-97c1-0dfea72143e2	mantenere la banca dati delle tariffe di trasporto merci
6d92ca8b-a099-4f7e-ab04-241b28bbb9d2	utilizzare macchine per la pulizia dei cereali
6d9bf549-9829-438b-8056-3eabbffcab86	combinazioni di sapori
6da015ca-648e-4c33-8836-ff2011dc0070	sviluppare diverse strategie di iscrizione
6d953f4f-bce4-4fb3-9f69-1c411362aab4	testare i campioni chimici
6d9da468-da20-4406-934b-380987e3ea3a	fornire una consulenza in ambito sociale
6da28b55-a4b9-42bc-bfc9-ca4517f3bf65	massimizzare l’efficienza delle operazioni della gru
6dae3acb-fe7d-448e-9939-91441369c3bf	sostituire i fusti
6dae4581-8899-41ec-b189-79fbe9a9fa78	pompare la vernice
6db97c31-f169-4d52-88b7-ff94a1574226	redigere manuali
6db55564-39c9-44ad-a2d5-3fda2a9d499f	selezionare gli stili di illustrazione
6dbe08b9-cbb8-47a0-84ef-a25ef8d73e2f	igiene e medicina preventiva
6dba520a-d3c9-4887-b3af-fd4bb6118463	Synfig
6dcb1921-3ff0-4ff9-b439-9c2df460710b	gestire il trattamento delle acque
6dbf67ad-afa7-465f-ad20-97eb7ca79f48	fornire informazioni sulle caratteristiche geologiche
6dcb32ef-1ead-4e04-a7a2-da25f83a931a	Frostbite (sistemi di creazione di videogiochi)
6dcf806f-d08f-45b2-a50a-aa1d7736b4aa	tutelare i diritti del dipendente
6dcbe74e-e705-4136-b601-1015f237b5ed	eseguire manualmente la pulizia delle strade
6ddcbc64-7cef-40b8-873c-0ac139cfa754	esaminare una struttura sanitaria
6de51978-656a-434f-a04d-4d9dd3a0829a	distribuire le pensioni
6de9ba5e-f867-4192-ac09-9da006184f07	giudaismo
6dec82c0-8f75-4581-906f-b5d9e3dd826a	varietà di mele
6c9719db-3446-4894-ad2d-46ba0f3d0e0f	riparare i motori
6df481c4-7cb5-4cbc-a5a5-f86b65f44a76	azionare l’autobetoniera per calcestruzzo
6df8f6a3-bc19-48ee-a562-67b23dad47ad	eseguire l’inseminazione artificiale del bestiame
6dfa066c-ae63-4122-b316-f6c160faa1de	segnalare i difetti nei camini
6dfa9987-909c-489a-86c7-3f45f44adeff	metodi di consultazione
6df87590-0870-403a-be2f-ad788d777a97	lavorare in maniera ergonomica
6e066a68-a4a7-440e-9c31-c0a06abbb4cf	crittografia TIC
6e092c59-3074-41e5-b8ba-847578a9eb15	valutare il processo di produzione farmaceutico
6e0caec7-a0b9-46ab-a3af-63b77108ba61	preparare l’arte digitale per la fotografia principale
6e0f0646-3072-4761-b925-da8643f198cb	configurare il sistema di ormeggio delle gabbie in acquacoltura
6e182d35-023c-4a5a-85a6-a6ee1597f4df	applicare gli stress test per valutare la solidità degli istituti di credito
6d1c84d4-9203-4fa2-9d46-7fa017dfef97	scaricare il cemento
6e1ca838-6478-4956-ad7f-3eee98c16f25	polimerizzazione
6e19dc8f-4f8b-4371-ba77-f12fbe58dc8d	garantire che i contenuti della spedizione corrispondano ai documenti di spedizione
6e21e113-d056-4faa-ae78-5f5e19726b6e	decidere in merito alle domande di prestito
6e2b77f2-2cd1-4f66-ab9f-e8966ab00ec7	progettare chiuse
6e36836c-7eae-4b82-85fb-a66376f62088	sezionare carcasse animali
6e3f7098-5643-428c-9d79-9de54db42638	disegnare bambole
6e39b8b7-875b-4268-80c4-66052ae5de7e	gestire gli incidenti gravi
6e4e5ef7-d05c-448a-8a28-27e47d29d7ae	progettare i programmi di addestramento per animali
6e493b17-aa90-46a0-8dce-3f5eac537a76	eseguire la gestione del rischio finanziario nel commercio internazionale
6e4f3469-279e-468a-9dd8-9fda98e1993d	sviluppare materiali educativi digitali
6e4f96db-cbe9-4873-b2eb-b1c5a2126d1a	mantenere documentazione e scritture contrattuali
6e52cc2a-3001-4b09-a805-348dafc23977	creare reti nel settore della scrittura
6e534341-ccbe-4dac-a8f9-30d8d3a27af1	manipolare gli oggetti per creare illusioni
6e53e57c-d268-418b-9ad0-491e11e824b4	valutare le misure di psicologia della salute
6e5f9d46-9db9-405b-9478-1c78640fe68f	azionare il trapano a mano
6e546435-af7d-44c7-a42d-d6fbd2e48963	coordinare le politiche ambientali aeroportuali
6e5fc104-b101-41ba-88d3-d55badd95865	fornire tecnologia assistiva
6e64f3ee-7c95-4ddb-9357-0369802950d2	tenere note sulle posizioni degli artisti e degli attrezzi in scena
6e6a4fcb-ec5f-402e-b190-afd7ec3dcce3	processi biochimici di produzione del sidro
6da2d488-31da-4e86-88bf-4a2871f0dd65	microrganismi patogeni
6da27bc0-75ab-49dc-adaa-34c863e0f393	raccogliere i campioni biologici dei pazienti
6e6c20e0-d339-49ea-a172-243e85985d14	rispettare il codice etico dell’organizzazione
6e6c4e3c-32f8-43a0-8ffd-e486c8584184	confezionare gli acquisti dei clienti
6e703257-7f76-40f9-87e7-fa01bd51cde4	comprendere l’occitano scritto
6e879eef-38cd-4dc7-90a8-c3288114b40b	offrire consulenza sui metodi di insegnamento
6e351303-2da9-414d-997a-2fc2a5d9e1f2	utilizzare i macchinari di lavorazione del legno
6e9767fb-271d-455c-9daa-e2d06235d7cc	applicare un rivestimento alle apparecchiature elettriche
6e4153d3-83f2-47bf-80a0-7297bb93ebfa	collezioni d’arte
6ea0ad31-c84f-4f2d-8fe4-0c43410fd70d	resistere alla decompressione
6ea1f36b-eb82-460e-97b1-01e477d337fc	dinamiche umane in relazione alla sicurezza della struttura alberghiera
6ea49024-3004-4a95-bcaf-954f3b935536	verificare le deformità nei pesci vivi
6ea4f96d-94b1-48ba-88c3-67f07655a3c3	gestione dei media sociali
6ea7b455-a258-4e61-be6f-62693cc992a7	svolgere le valutazioni legali
6ea9c3b4-1c61-46f1-8b1a-a805d47b1dd5	agriturismo
6eaa29e2-b659-42e7-9e76-0a7867c23cc1	capelli
6eb7e124-6866-4f8b-bf02-cfe07ee087a8	urdu
6e693d8b-96b1-40af-88fb-eaf998770c48	sviluppare forti attitudini nello sport
6ebab48d-7968-4a96-9a94-d923b0173db0	verificare le spedizioni
6ec39a5e-43ed-4c6c-a657-0c125a20d6b0	sorvegliare le barilatrici
6ebb8569-ff90-4b6d-96d3-a919e736ac2a	negoziare le condizioni di acquisto
6ecc44d4-f783-4e4a-89a3-3a94e6ad0053	classificare i chicchi di caffè
6ecf5b31-3a95-4f16-a258-4cb7e6a1ec8c	creare smalti specifici
6edb6dfb-010c-4ca4-98e6-5ded590c5046	radiobiologia
6ed5aab3-6930-48cd-9f0f-9b58927345fc	utilizzare lamiere al carbonio
6ee84e53-ac3c-4afe-abef-1136531d4951	condurre una ricerca sulle tendenze del design
6ef3e7dc-fcbd-49fc-9b93-6b9f9118fb49	consultare, cercare e filtrare dati, informazioni e contenuti digitali
6ef52bc6-ad3b-4310-af61-675b4cc5291b	fornire consulenza al settore alimentare
6e814fe4-35bb-4650-addb-f72777072045	preparare la superficie per la posa di pavimenti in legno di latifoglie
6ef70e97-3a77-406a-a705-1cf40e30148b	liquido idraulico
6e826799-35ea-4a4b-a5e1-dc17895c2aa9	effettuare la manutenzione degli impianti idraulici
6f007d87-f5d7-4d6a-bde5-ca2efbb70ae1	creare disegni in AutoCAD
6f044b28-5c5a-4c36-adf4-bd46f4ca3af2	perforare mezzi stampati
6f11bde8-6e94-49af-929e-813f19e5a44d	gestire gruppi di turisti
6e93ab8f-f7ff-4c86-a521-48279808bc84	offrire consulenza sulla politica fiscale
6f076910-16ae-433f-8c33-827f4282c311	fornire assistenza ai clienti
6f19e68e-5358-46c9-85e8-31b64264746a	lucidare la pietra a mano
6f1e49d8-dd89-4214-8ecb-284f176d027d	creare effetti con il trucco
6f22370f-2bcb-4bbe-89de-afafd48ee924	cura centrata sulla persona
6f1d0302-67b5-414f-93cc-d239627de5fd	gestire il rendimento
6f366e13-0d3e-45fb-9737-dcc899412a8a	utilizzare l’intuizione nel prenotare progetti
6f3d86eb-400d-4b50-8ae7-965e29c4da40	guidare squadre addette alla perforazione
6f1fdb71-b957-4ffb-9c5a-4f1c2adae2af	eseguire lo unit testing di un software
6f48cfcf-6abf-43e2-820c-7ca82d218103	promuovere il trasporto pubblico
6f3e56d5-c669-42c2-856a-b3a3f7f301d5	seguire il codice deontologico dei giornalisti
6f5a6eed-a91b-45b1-8b76-c5624e4404c4	preparare i documenti di garanzia per gli elettrodomestici
6f60ca3c-7553-44d2-a52a-2d07f7856ced	assegnare le fatture
6f762b7f-f482-4efa-9e04-5340f06d5c4f	partecipare al casting
6f6f9075-975f-4550-8e9f-770319e91900	progettare le sequenze di sospensione
6f694011-ae5d-4619-9b8b-cb419befe422	fornire consulenza in merito ai materiali da costruzione
6f77535c-4a65-431e-91b1-a6b8200d5363	processi di addolcimento del gas acido
6f7b8682-e179-4161-86d9-5d2341f037a4	controllare la sicurezza di parchi divertimenti
6f8676b8-fdb1-442e-990f-384dc4196df8	comprendere il bihari scritto
6f58042c-ef1a-48b6-9afe-0bb8f534c15a	registrare i dati di produzione ai fini del controllo di qualità
6f8f360d-7fdf-4bbf-b8da-e4dab68f0ba1	garantire l’aderenza al piano di studi
6f97c102-1347-4c2d-a22b-fe9a58ab50ee	Occuparsi di macchine per la produzione di catene
6f838463-f15f-4dd6-8999-762e7b40184d	redigere le proposte di progetti artistici
6f954535-98c4-44d5-9b4f-565d5844ff07	utilizzare i sistemi informatici e le banche dati agricoli
6f9bf928-5a97-45d8-b712-67edc4d63204	creare piani tecnici
6fa1b05c-98ec-4d57-99c0-94a253583c21	conservare il vino in condizioni adeguate
6fb46723-831e-4cb9-bd29-44706596488a	gestire i canali di distribuzione
6fb4cabd-6e40-4dde-b794-5144fca5a636	micologia
6e97da8e-8041-4430-b3d7-a7acbd1f827b	utilizzare banche dati
6fb75b18-c55c-450b-9ee5-c93fd7a5fa53	fornire consulenza farmaceutica
6fba581a-6ffd-49f8-a568-18b3e61b6181	vini frizzanti
6fc5312c-0dd5-46bd-b968-8d51e41987a4	drammaturgia circense
6f9dd742-ddb4-413f-a2ea-c999019fdcce	raccogliere informazioni sull’idoneità fisica dei clienti
6fdc86ef-9cdb-46cb-b539-feddb5064fc2	riscuotere i diritti di licenza
6fd39471-9757-422c-b369-20d0f6dd76be	riferire sugli incidenti di distribuzione del carburante
6fdbca74-6cf6-49a6-8b21-adef3cc124d5	ottimizzare i parametri dei processi di produzione
6fd75266-be4e-44d9-9c48-ea5c4f731e77	tenere un archivio dei debiti del cliente
6fe60381-61a8-4f54-96bf-ce74c6ae6d32	mantenere un ambiente di lavoro sicuro e igienico
6fea27df-b737-4974-b49f-bb6809541290	servizi di esperti in psicologia clinica
6fed0d09-e516-42fe-8053-99c576edcda4	scienza del lavoro
6fee495b-8af7-4b29-80f5-61926468b4fe	condurre giochi d’azzardo
6ff9695f-f856-4b2d-815d-86f3cb4de767	valutare le prestazioni dei collaboratori dell’organizzazione
6ff9a4fe-cd9d-4b07-9cb6-1eb68313a243	pianificare gli effetti pirotecnici
6ffdbcb6-c393-46cd-b89d-054e799a75e7	regolare le valvole delle bombole
6ffc3c54-7b93-4fcb-984f-f8c9dad7ebf9	gestire le operazioni della cantina
6ffb0c2a-f641-41ec-82e5-a818006a84ff	adattare gli stili di leadership nel settore sanitario
7003d2c8-65ec-4e82-9f69-37f801056cdb	guidare le attività della giuria
6ffe1fab-c085-49a8-9a0d-b6afdd40521c	prevedere tendenze economiche
7002409a-79d0-4fc7-96d1-c2739151f4d3	mantenere aggiornate le competenze sui sistemi di irrigazione
70151626-8332-4467-adbe-65ab65989a79	infrastruttura ferroviaria
700ed9c8-a731-4b9e-971c-fa4388503703	trasporto internazionale su strada di merci pericolose
700818f4-ee06-4f62-80b1-c756925d137e	incoraggiare i clienti che hanno fruito della consulenza a esaminarsi
70199331-f304-4785-8aeb-8fd4abde4a05	applicare la gestione dei rischi per attività all’aperto
701a071d-5fc8-4eeb-8a9a-fb011b2c8265	fornire informazioni sul clima interno all’organizzazione
701d0cb9-1d36-4dd7-bf8a-d421ea6a1104	garantire l’uniformità dell’anima
702267a0-d5dd-4465-a354-42b45ddb7b22	effettuare la manutenzione delle attrezzatura per la diagnostica per immagini
702c4891-ac13-4c50-9cae-b2bdda2cb041	gestire le risorse nella produzione alimentare
70272702-f84e-4352-9749-24238ae1167c	tingere legno
702d8222-d4ef-4c26-877a-7dffb2c14648	applicare la psicoanalisi
703a7360-c291-4d81-9be7-6a707adbfed6	utilizzare un sistema di disidratazione a vuoto
703d58d5-edc1-4c19-9a10-dadfd88610df	gestione della liquidità
7040c080-2ac7-4374-b684-aa1ebf4db58d	generi musicali
70459e64-d9df-4f7a-9b67-e4f31889dbc9	norme di sicurezza per i magazzini
6efc622c-5a28-4246-beb3-fbd8c3c32171	sostenere le persone con disabilità uditive
705235a7-92f4-49b4-ab40-7e52ae451642	promuovere l’omeopatia
704ac496-5067-4ebc-81ec-ebaa699a7d0b	immagazzinare gli acidi esausti
7055bdb7-001e-49e0-a93b-c1dcd11ecb28	calcolare il periodo ottimale per l’inseminazione
7058af78-9185-4925-a01a-6bf8708c818c	trattare le patologie mediche degli anziani
70675307-4ec9-412f-87be-e8ccc7b7200b	scrivere in marathi
7069dc27-314f-4cf2-98ea-fdf44677eac3	industria della pesca
707241ef-80f1-4956-8539-8e5273e74f38	vulcanizzazione a freddo
7075fc52-7333-438e-a9df-ddb33de41679	sviluppare il piano di studi
707b3c42-b6b4-48e9-a4de-cd4ed1562c1e	rivolgersi a un pubblico
7083248a-4f11-4587-959c-9ae9b94ad1ba	installare il sistema di amplificazione sonora
708c7d96-5d75-47d4-9954-08f9eae0e2a0	preparare una relazione sul rilevamento
708eebcb-cc12-4c4c-8334-7b4d23400bf9	installare i lucernari
70996790-3113-44ff-abb4-db1288933b72	monitorare i lavori per gli eventi speciali
7095d298-8dc1-46bc-9d7f-3a2e940fe3ec	manutenere l’apparecchiatura di distillazione
709f7aa8-f7e2-47d1-b2a4-071c165a3491	manipolare i prodotti ittici
70a3a909-3318-4d6b-89f1-9b071a369b25	principi delle telecomunicazioni
70a52ae7-af9d-4455-835a-176081001b5d	gestire le procedure di una scuola secondaria
70a8e95b-19a4-4124-a50b-f3e9b59cb94f	utilizzare gli strumenti per la riparazione di giocattoli
70aa340a-c16f-443f-9326-f40bf3b9b452	praticare il canto
70b367bf-1bf5-4e98-b400-e9da2b3a5167	azerbaigiano
70b281d7-3ffe-42ea-9b9e-8adfae395fc5	fornire assistenza nello svolgimento di esercizi fisici
70b4e3af-66cf-4568-ae35-c0e892d35a94	posizionare il montante
70b54736-393a-4c31-a692-23cd28b42774	ortottica
70b7fc7c-16d9-4f26-901e-5b1c125f1a28	tipi di corde
70bcad71-2262-4979-9483-0d86958ffcb4	attrezzatura per attività subacquee
6fc89253-1aff-4b01-ae57-d2b49bd90108	monitorare le operazioni del sistema di pompaggio
70c1eca6-0ea2-4138-af15-38f53c60f086	sviluppare i programmi di riciclaggio dei rifiuti
70c4e64b-1d21-47d1-b679-d1d92035252e	cera d’api
70d9fd15-4932-47f7-9347-0a57a0b4b050	sorvegliare le vasche di coagulazione
70d125c2-00ab-45de-a9ce-fb08d7ade355	discutere le richieste di risarcimento
70e4a2a0-03d8-42e2-b07e-17962df88f93	petrologia
70e620e3-7fc0-4407-8a84-e8d6bac5fb65	serbo
70e7b6bc-45b3-4f62-8778-05d26663e2fc	congiungere elementi in legno
6ffa5cc0-b073-4c95-b038-8b002edb18ea	ottimizzazione della qualità e della durata del ciclo
70ea9668-c8b0-495c-abf4-36bb43d95a59	autismo
70e8c627-430f-473d-b760-7dbf832f1b71	mantenere il piano di continuità operativa
70ee1698-83f2-4cd2-83f9-4094d0b1ed64	memorizzare grandi quantità di informazioni
70e6b869-a190-41be-b5af-3567fa155f6a	gestire i sistemi di controllo della nave
70f8d545-ebfa-4151-9a61-b7f0fb4750fd	intrattenere le persone
71029832-878f-4a9b-a3cd-29b15d35c31e	mantenere standard di lavoro
70f7cb4d-e052-466d-8c75-011ffe4fcfd2	essere addetto a macchine saldatrici a fascio elettronico
7105c12a-053d-4fcd-a768-539c9658bf2d	occuparsi delle vigne
71110805-a289-47e6-9deb-84e683337b04	sviluppare una collezione di articoli di pelletteria
70f9b705-8be8-4f46-88f8-035c89abcb90	produrre file elettronici
7116861d-fd09-44d4-afe5-fb1a0cd9c620	reiki
711224da-b1f3-4497-91ef-c2f875fb9af6	utilizzare il tracciatore a filo con gesso
711a4d4c-9270-4e33-a488-8436c6f4c3fb	adottare una politica rispettosa dell’ambiente nella trasformazione degli alimenti
711af326-a823-4121-8115-ca62808e35bc	valutare i costi operativi
711bb4c2-7eeb-45b9-a79c-3030eafb25cb	gestire le offerte dai potenziali spedizionieri
711c93d9-a522-4da3-9cd7-caca3586d265	comprendere lo yiddish scritto
712a2088-2450-426f-9c97-ee3e63141693	rianimazione
711cf771-88de-4a78-9444-936cc0370d90	eseguire la manutenzione generale sugli esterni della nave
712ccb06-a657-4ea6-aa4c-c48528c63d3e	offrire consulenza ai clienti sull’installazione di elettrodomestici
713ae211-611f-45c4-b59c-ec8fa413680e	gestire i programmi di risposta umanitaria
7146be8b-63da-447e-befb-0b963da0eda4	utilizzare aste telescopiche alimentate ad acqua
713b16f4-0a81-4304-ba1f-b14b266e27e2	sviluppare un piano di prevenzione della salute e sicurezza per il trasporto stradale
70383bf5-8b09-4570-a298-008d76006bee	tenere traccia degli stadi di avanzamento del lavoro
71475739-f414-4b9d-af8a-375798b89443	regolamenti di embargo
714a0e1a-f868-4150-9472-96f5cb338ef0	metodi di creazione di bozze
715a7b21-7c5f-4d03-a958-e1f17dd8108e	gestire lo schieramento delle truppe
7155421f-0de7-4a03-922e-0903005b1a0c	norme di polizia sanitaria per la distribuzione di prodotti di origine animale
716cd21e-759d-43da-a8eb-5ae8d865f641	monitorare il rispetto degli accordi di licenza
706e944f-81b0-4db3-9ca8-d66506c83a50	materiali compositi
717364df-187b-4825-aa73-e8a7a82ba58c	progettare sistemi di controllo
717ec0d8-333d-4d4d-b722-8521b0b782d7	acquistare componenti di sistema
71813f84-099e-4d96-98f6-f7792ef057d2	azionare un proiettore
717a03d0-8302-4102-8490-8a15abcf5965	Salt (strumenti per la gestione della configurazione software)
7188ada5-5a52-4bc8-8202-b10a08901b1c	processi dell’ufficio vendite
71927bdc-069f-4bd3-a13c-11b7bccd3156	utilizzare il software per la gestione delle relazioni con i clienti
719d0f1c-4e67-437a-a280-bdea4900d730	azionare le turbine a gas
7190078a-0bb5-4a34-872b-f46848eb15e9	lavorare a turni
71aa6db1-a2b8-4e08-b1c3-2d7b92d342f5	esaminare la zona d’installazione della linea elettrica
71a50434-1e8c-449b-b9ad-d2eaab0a9b92	fornire consulenza sul rating di credito
71aa6ff0-59a0-487b-83d2-7ba8479847cc	fare da mentore ad altri professionisti della sanità
71a08639-b649-4fa6-9778-993718106061	ispezionare la documentazione dell’aeromobile
71ba99f8-ffb4-4132-bdd2-8434d7107408	manipolare il carico
71b9bbcd-011e-432c-b6d2-ac5e1db44220	pulire le facciate degli edifici
71b90e69-1fa7-4051-af08-183ef9dfc638	supervisionare i tecnici delle luci
71bfcd92-c454-4b78-9e92-c0f60e6a3647	produzione di impianti di riscaldamento
71c35fb7-121d-4705-ab7f-36efad1650ec	garantire la protezione dei dati nelle operazioni di aviazione
71cc255d-becc-4396-9ed8-f0f6fc3b06ce	prospettiva isometrica
71cc5017-9422-4fb9-a0d3-4f3df248ac01	controllare la programmazione
71cdd487-250a-4301-8b76-9852105c6b33	riabilitazione
71d5c5b7-1c03-4a6e-829d-11f6cc58c76d	macchine utensili
71c5227b-4a2f-4f86-af72-7381be1ac47b	attenersi alla pianificazione della produzione
71d62c0a-7f76-46dd-a087-232fc7288381	determinare le azioni di politica monetaria
71dad920-c491-45b3-9cbf-e8abd7ed5442	utilizzare apparecchiature sismiche
71dd9cea-7dca-489b-9cf6-9df129464c7d	gestire la stalla
71ded1af-6d4f-4d47-94b7-1fd8287bdb95	mettere a fuoco le attrezzature di illuminazione
71e04eff-618c-4f8d-97c0-3b6b35efd7ff	creare personaggi di videogiochi
71e6ffef-4cb4-48f8-a17d-b5256dc56578	pensare cibo e bevande in modo creativo
71ee9c84-8330-4de1-ac1c-3510fdcb7970	regolamenti architettonici
71f7cc07-b280-412b-92bc-664720abea94	componenti dei semi oleaginosi
71f38469-4fd6-41e4-96b4-23384f23e11d	supervisionare gli alimenti nell’assistenza sanitaria
71fc3892-ea8b-4e0d-8c59-ad61794c0de4	coordinare le operazioni di trasporto merci su strada
7200c550-6045-4951-acb9-635b9f6d2a14	coinvolgere i volontari
72035730-5d61-442b-b533-38eb93ba92f3	comprendere il limburghese parlato
72031991-18ee-4b55-8a8f-571bd4e915d2	contribuire alla formulazione delle procedure penitenziarie
720b521a-9b52-412e-99d4-ae155ee1f967	preparare i pezzi per l’incisione
72046f3e-d9d7-49c6-8e68-ff098a68cf19	utilizzare i sistemi radio di gestione delle chiamate dei taxi
70fa47cb-fa6e-42a5-9f1b-6964fc33b61a	attuare le procedure di sicurezza nelle aree lato volo
720d5759-4493-472f-9392-0b40ae073c7a	misurare il corpo umano per capi di abbigliamento
7217d168-9e7d-44e1-8ea4-e5ab3b9da381	definire i movimenti delle attrezzature di sostegno
722a0113-b17a-4093-ac91-902a2c8e81bf	comprimere il tessuto gommato
7219e29a-ceab-4c10-a7d8-135e846c095f	guidare gli spazzaneve
722d904c-df36-4d9f-a444-b926776e0fae	ordinare i materiali per la manutenzione e riparazione dei veicoli
722f2b80-c20e-4117-8076-cb6977bd3a4d	rilasciare documenti ufficiali
72317ae8-0e42-4a40-ab31-5b13599b4798	Istruire in merito all’uso di audioprotesi
72330284-33d0-4a20-acc3-6a862e32b468	vendere i prodotti di antiquariato
72381e5e-d35c-447f-a017-310777f2425d	utilizzare il freno a mano
723e61e4-81a7-479c-9ce1-eb9f1285040b	protezione dagli elementi naturali
72371e8d-0c5b-4847-b17e-e6439d7ecc49	incoraggiare gli studenti a riconoscere i loro successi
72455696-c602-43f7-991e-1324262ad8ca	offrire consulenza sullo sviluppo del piano di studi
7249696f-1499-47f1-b488-ac57c87fb48f	fornire istruzione per le attività all’aperto
7249c777-e3cf-467f-a51d-b63e3fe19293	interagire con i fornitori di assistenza sanitaria
724c6799-1bbf-413f-bb1e-b937401a7f25	analizzare i processi aziendali
71611126-9199-4d75-86ab-f13cca18170a	effettuare la manutenzione del tappeto erboso e dell’erba
72642b7f-086c-4703-9b2b-12c4fe3abf45	politiche del settore agricolo
715be8fd-1b92-4009-bf1b-740a19a2f28d	fornire sessioni di coaching artistico
7261de1d-51bc-45c0-aa51-bdbef97426ef	applicare la gestione del numero complessivo dei casi da esaminare
7257abc9-8fa5-41e7-a411-7877785cd781	coordinare gli orari dei voli
7264b463-1553-4c21-ba20-608ee866f375	trattamenti ortopedici alternativi
726ff92a-2f38-4e24-84e8-eefc4d702ae5	contribuire a documentare il lavoro artistico in tutte le fasi
7266e1fe-65fb-4809-82c4-4df0173c6466	disturbi otorinolaringoiatrici
727bdc8e-521d-402c-8340-2433c473b361	ludoterapia
726d9504-c325-464f-b0a8-87f4b5d63962	nuotare
7274ba7a-d2e9-498b-9ed9-ccbde4999009	garantire le ispezioni di sicurezza annuali
7282c8d6-48c7-4e0e-88da-15d16b3ed545	processo di creazione di calzature
72868cf7-8e75-4c96-85e5-fea1796e0338	gestire un servizio di hosting e-mail
72824d18-2b2b-452f-a0eb-c0801df64fa8	tenere i registri sulla raccolta dei rifiuti
728bb908-cb15-4651-b30b-a08b5c4c7053	controllare i movimenti dell’animale
728c2a8b-deda-432a-bf29-3805bdbb8fb9	collaborare con il personale infermieristico
7296c794-4bd2-4c81-b3d0-6ae87e939604	predisporre l’acciaio per il cemento armato
7298452a-ac4d-461d-90ad-49530e59de51	anatomia equina
728c623e-5786-48a8-a3f5-b68eacdf8ce4	fornire informazioni
72a0c607-7d00-4bb2-a2d9-ea251f62dd25	gestire il funzionamento di piattaforme di lavoro aeree
728d265b-4574-40cb-a219-e9381096a9c1	sostenere i comportamenti positivi
72a9da24-87de-473d-8339-fb77304f1c50	fornire istruzioni sull’uso di attrezzature speciali per le attività quotidiane
72b5dae0-668b-420c-a00b-cce0290e26c5	applicare le buone prassi cliniche
72b855ec-8404-43c9-a255-ec207e035c82	individuare le opportunità per la determinazione dei prezzi
72ba2024-443d-425a-a4a8-480b9ac96a91	teorie della personalità
72c77270-68f2-46ab-82ae-9828e829e183	promuovere l’azienda
72c76883-e35b-435d-80ac-3d799de539fc	preparare le persone a sostenere un colloquio di lavoro
72c92176-7b02-44a0-bf06-c2a3293b35df	registrare le spese
72c89026-9cfe-4c56-9b48-b1c5d42e7991	pulire l’esterno del veicolo
72bb350f-6983-4036-8493-eecd0b023a4a	registrare i dati delle prove
72cdc5d5-4ec6-4f82-a0d5-e0253a8f90a3	usare sistemi ingegneria basati su computer
72ce8f3e-9d36-40f8-9c10-303dcb56fb0e	creare modelli di dati
72d3f14f-24cf-4ca1-b9a5-d99cfa79dcb6	provvedere alla sistemazione definitiva delle spoglie di un animale
72e003b8-cf90-43ad-8d84-cd16db39c2a7	opzioni intermodali
72f066ef-0849-4419-92a8-c8d0644512c6	realizzare gli studi tossicologici
72ee11a3-8306-4f4d-aeb4-1d5575558f40	circuiti integrati
72f5dfdd-bc3d-4e48-b413-007208ba4d76	effettuare la manutenzione del prato
72ef8a6c-e80f-4061-88d0-88c6b478ba8a	studiare la popolazione umana
72f840cd-e435-4e01-abc2-3b3970b33dce	progettare uno spettacolo musicale
7302afe8-d8e2-4b7d-8d0b-751c8f3f76d3	collocare le scale d’imbarco negli aeroporti
72fad6ea-68d7-4c9c-854c-a5b3d32c9474	posare il pavimento in laminato
73094315-3b9e-4961-b580-90724d86f033	raccomandare le audioprotesi
730e2256-7532-408c-8dcb-f00ed07ff6f7	eseguire le attività di ricerca strategica
73106a59-233c-4665-a544-7459767297e9	determinare il sesso dell’animale
731469bd-8a79-4f47-86ec-b200b6092ef7	utilizzare i palloni di sollevamento
7315f7d5-b01c-4aeb-aca0-99ceaec9df51	regolare la velocità di taglio
7316e22b-4cfe-492d-bafe-4a948b8f8ec1	diagnosticare i sintomi di malattia degli animali acquatici
731a8341-841e-404a-a645-b55088c192a5	imprese in partecipazione
731b0db2-b394-4972-bb10-c73f9677a2d8	metodi di collaudo di schede a circuito stampato
732d7ed7-4b61-4a9e-83d0-4732e5961aec	gestire il catasto
7336c136-bd78-41cb-9e82-3562feb4eab5	terapia psicomotoria
7346e9d4-d6c4-4ae4-a131-90390a379627	utilizzare gli strumenti specializzati nelle riparazioni elettriche
7339c319-8ce5-431f-9312-6be3ce42a0c4	redigere i contratti di rendimento energetico
731dac82-b34c-47c6-abbd-aafb90de8cc9	effettuare colloqui per selezionare i membri del gruppo artistico
7356d190-4f8b-4c8c-81cb-62912e4d554b	software di sottotitolaggio
734ed6d8-0bcc-4fcb-92d5-452a40b42aae	girare il legno
720cabb0-6394-4510-9778-2a0c65e36ea4	leggere le coreografie
73651827-4683-426a-af37-daeceab3c143	regolare i tubi di alimentazione
7356c91e-4478-419f-8f10-d9ccc8f301a6	ispezionare l’asfalto
73570dc2-9cb1-4822-92d6-9127f95c1be6	rispettare le specifiche del manuale dell’aerodromo
7366f764-e953-492e-b1ec-ea5c31228317	usare manuali di riparazione
73679e5f-84e8-4acd-a4f6-cb18e59e5194	metodi analitici nelle scienze biomediche
737593c7-ac51-4d86-a6c8-9e86f56a9627	avvolgere i filati alle bobine
7369cf8d-37be-4bae-8f47-1046d8a3db98	stili delle scatole
7376712b-536c-4d75-af73-fbd184ed145b	sistemare la merce nel veicolo per il trasporto
7381503e-5045-48c2-a5c2-e3085801673f	eseguire riparazioni di minore entità alle attrezzature
7382b0b2-0910-4277-86a0-75a53d5c90ea	controllare gli sviluppi della tecnologia utilizzata per la progettazione
737d8d45-6092-48c4-8170-53a6005644fc	offrire consulenza agli agricoltori
7385da90-9116-4dfc-9329-0a3b0e01fb40	diritto pubblico
738b219b-a8fe-4cf8-b939-318d02c320de	potenziare reti fognarie
7386230c-7126-4f10-850e-3fea30895a2a	microbiologia e virologia
7399471e-36a4-4bde-bb4b-beb9fb710ee0	individuare le mine terrestri
739252cb-af43-4993-b726-3a80ee39450b	combattimento con spada
73a0488a-3010-4dc4-95d9-fad621cb0038	disturbi ortopedici
73924a85-b25f-490c-90ff-99190cb48de4	definire obiettivi di marketing misurabili
739ca5e6-85fb-4953-b507-46e325cad0f9	preparare gli animali per la chirurgia veterinaria
73ba6121-5253-477e-980d-a30ee390d8bc	valutare tecnologie per la traduzione
73b1f65e-ebce-4d1f-a05e-e1c828f5891b	stabilire obiettivi di garanzia della qualità
73a1d717-4f5b-44de-b39c-926801637fe5	fornire informazioni sulla gravidanza
73be06b2-0275-49c5-8af4-c8f8a0bb7dee	realizzare un modello fisico del prodotto
73c27c53-5b61-4003-b838-139b601544e3	manipolare i materiali di dispositivi protesico-ortesici
73c84991-e0cf-4132-83a1-b8181d0bc437	fornire sostegno psicologico clinico in situazioni di crisi
73c3508d-2693-4a8d-b789-4a8ee2d1073c	educare alla prevenzione delle malattie
73cc9535-435e-462d-bb3a-2fe9c963422c	pianificazione dell’ingresso nel mercato
73d52b77-b4bf-4f22-a4cd-e74cd5653054	aiutare i pedoni ad attraversare le strade
73d7bfae-2aed-4802-ab5a-ac1c58707352	promuovere la musica
73db08cd-5982-4624-96ad-9f5071ca07ed	tamil
73dd3c82-3c2b-41e5-a8a8-3558acec7d8e	fornire informazioni sul benessere degli animali
73df7e2c-463f-4e5b-8e6b-623a3a34bfa5	gestire le risorse fisiche
73f94043-cc07-438e-bf56-7d150c8e3744	rispettare la normativa sui servizi sociali
73fc8c8d-f8aa-4c3c-a5e1-5c0bb949b34e	sviluppare contenuti digitali
73e67c4f-3919-4de9-8819-969cb98b9bb9	utilizzare software CAM
72cd9c78-b2e0-49c5-82cb-bde9b4cd9276	regolare le trasmissioni video
73ff6481-833a-4381-b1e7-e40c5e0a5427	chirurgia
73fdb38f-534c-41b8-ae8d-c69f340bcdc5	gestire le attività lavorative dei sub-fornitori
741978eb-34f9-4cd8-96ec-84877dc7d694	gestire archivi
740253d2-26bc-4392-b7ce-9268699e1fc9	ricablare gli strumenti musicali elettronici
741b0763-b983-40c3-ac9b-addc56156d5d	parcheggiare i veicoli dei clienti
7304e8be-f566-4a61-b657-26af159278ce	installare il totalizzatore
741cbac7-eed5-43c5-bcb8-0dde6bfcc47c	sviluppare le politiche riguardanti le questioni religiose
741f802e-7730-4292-abce-624485e76fd9	collaborare con il gruppo di coaching
7448c95c-fabf-4bfd-b9a8-18eddeaae3ff	eseguire la potatura a mano
744dc842-e917-49f6-9896-5269669c1a6d	cablare i sensori di sicurezza
744e8723-33f8-4d08-b1e8-1a9aa831a43f	eseguire la lavorazione dei metalli
744d96eb-d6fb-440a-8776-0fa583f35281	selezionare i costumi
743de152-8b04-4e05-a3bd-9beb11e263ab	offrire consulenza ai clienti
74899b02-805b-4bd8-8737-e4d863ae0438	applicare la tecnologia through-hole manualmente
7470074a-5d63-48a5-bb77-2c3e2d5e00dc	rimuovere la cera dai favi
74872fbb-462e-4e44-8d42-e5a0a8cfe295	osservare norme di sicurezza in contesti industriali
74728248-bcdb-4db5-acaa-25ab2479c3ab	verificare la continuità narrativa e fotografica
7491086f-d44d-47e7-b3ac-b637b0933a2a	sistemi di distribuzione del combustibile
7497f20f-4069-414f-86e0-e6164cbe8258	facilitare l’essiccazione dei pezzi rivestiti
74995173-a2d9-4833-8eb1-162a46146222	aspirazione con ago sottile
74a05d65-54a1-4ab9-8e45-f9e7256bcbbb	conformità alle norme di governance delle informazioni
74abd464-bd9a-4293-874a-4d5577f2c82e	riparare i prodotti di argilla
74accb3b-be2e-41dc-b14b-b28f7633c7c0	obiettivi di controllo per le informazioni e la relative tecnologie
749901be-5816-41dd-8dea-5fa4ce5f970b	tenere i contatti con le squadre di gestione della logistica
74962177-6281-4af6-a671-bab4d84b7daa	garantire il comfort dei passeggeri
74c4333c-b6ac-493b-9b65-67069dd68674	settore delle telecomunicazioni
74bea269-88e7-4cd5-8b8d-8d0140ab07d3	azionare le leve
74c2111f-c0e3-4172-9ae7-7c78d55bf916	analizzare le operazioni della nave
74bdf211-4ff1-44b1-b65c-a14fcbbd8f5e	gestire i dati degli assistiti
74d1216b-b14c-47fc-8958-8440848fad9b	promuovere un sito culturale nelle scuole
74d0496f-c1f2-48fc-b9c9-f3a20bde668c	preparare le spedizioni puntualmente
74d5f188-601e-4ad9-b9bc-71c330070f56	legislazione in materia di agricoltura
74d80de1-ca7a-4bf7-85f3-488f743a6215	effettuare consultazioni sulle bevande single malt
74c7925a-18d8-4a5d-a297-9d91d87d7d72	informare i clienti sulle tariffe dell’energia elettrica
74dee75d-1920-48fc-aa63-3f7f9287600d	sottoscrizione del credito immobiliare
74e69919-5d49-4112-9380-182a82f41bb8	essere addetto a macchine per la produzione di molle
74e803b2-9aaa-4d2b-816b-eac95b0d5239	gestire le attrezzature professionali di chiropratica
74e91389-e6ca-49c1-bf2c-0600abd734d3	lavorare la ceramica cruda
74e1da9f-b288-41ba-8476-2b14bd4f2a0f	Assembly (programmazione informatica)
74f08eef-40a3-4e1c-a3e0-803ef5dad088	parti di macchina patinatrice
74f99c01-4a7e-45dd-8f7c-9961d615b2ce	organizzare un repertorio
74fcbc55-1695-4546-910b-dba46be69d1d	seguire la ricetta
74fd2daf-cf04-45aa-822b-f7ebabaa0381	pratica radiografica basata su dati probanti
7503e441-db6c-47cb-939c-7fd44b3880c1	coordinare il lavoro degli iscritti
73babe32-f79e-4cc9-b645-50e523334d00	tenere la documentazione di consegna del veicolo
750504f8-cd37-4131-a5b2-b3c8dfc652f2	analizzare i requisiti di imballaggio
750757aa-0710-4cdd-9a80-9a7c2fb00433	determinare la fattibilità produttiva
7509a1a8-0eec-4e38-8c14-2f61b99c83ee	ricercare il mezzo di comunicazione idoneo
75132cf7-0e13-4f70-b0a0-ee56cac9df66	rimedi omeopatici
752b55cb-02a6-4bcf-9e52-9d9fc11f07cf	azionare i tamburi
7516c0b0-f062-4450-b059-e0b2d8147ce0	progetti a favore della fauna selvatica
752d181b-44da-4578-ae49-bfca8e8c877a	realizzare prodotti in tessuti non-tessuti
754ed33c-bbe6-48ba-8a09-a8959b38f21a	affrontare i pericoli potenziali degli aerodromi
754f3317-0785-4213-b053-fe2b653bb2cf	supervisionare un progetto di costruzione
7540a543-21fe-4376-a56e-73af2d2a4a6d	comunicare con i residenti locali
7555a1dd-943d-456e-8938-e2707f0bc35c	trascrizione da nastro
7560d04e-b16d-4a69-bee0-9d162c525333	eseguire ricerche sul campo
756a4c69-c3ac-427b-aaff-3501004131ba	settore dei rivestimenti murali e dei rivestimenti per pavimenti
7569e697-7f56-40bd-bfd8-91d213b0e3df	applicare la teoria dei sistemi TIC
756d845f-6d82-4226-9fab-6a83f1b70cfd	verificare se sono presenti difetti nelle automotrici
756a554f-f257-4751-ad93-507c9b90974b	selezionare la pressione di nebulizzazione
757cc625-d1be-4d0a-afe4-bc0df3e262e0	condurre una ricerca nutrizionale
7574cae8-354a-4548-9e43-a2b14e81b830	manovrare l’autobus
757db882-00fd-47c2-a135-fbcfc3e566fd	caffè, tè, cacao e spezie
758a126d-2ca1-42aa-9dc0-bba2968c007c	zooterapia
75881ebc-93c1-4391-8aa4-d9f313887d7c	analizzare le tendenze nel settore alimentare e delle bevande
758a3c45-a666-4869-ad3e-8d46e82fd1c8	caricare il legname su un trattore articolato
758c00ab-dfbd-41c3-92b5-d29b4f648c5c	posare i blocchi di gesso
75a13caa-7f98-4bdc-93be-005471c433e5	effettuare la manutenzione delle attrezzature elettriche
75a66d0c-e395-4723-80af-8c81f36b64c1	redigere un testo professionale
75ac426c-d8a9-4556-a610-9829d1905b58	applicare sigillanti in gomma
75a34f75-564e-43ae-a722-32eb11127cd1	definire i metodi di costruzione degli oggetti di scena
75b1adfe-7314-4355-8fc5-ec37cb81705e	norme di qualità delle attrezzature oftalmiche
75c5c552-a35b-48ac-a9bf-cd83065a7f4a	arricchimento ambientale per gli animali
75c69fee-ea92-41a2-8cb4-b9e6f6361031	funzionalità dei macchinari
75c34835-e535-4362-918b-87d674b4afd0	smaltire rifiuti di saldatura
75d7fcdd-a7f6-4e50-b1cd-3f9988d7627e	elettroformare
75e399fa-1058-463d-8d1c-53a3047870b1	realizzare le fondamenta della torre di perforazione
75e6fba7-fcce-4ede-a548-0b1d24805e71	biosicurezza in laboratorio biomedico
75ea3a16-89b5-4b42-b068-1d7d1294e06d	gonfiare palloni sportivi
76036e31-70dc-40a2-b369-96180f28a0ae	prevedere il carico di lavoro
75fe35dc-2d2b-45ab-be67-9f358913558f	garantire conformità alle specifiche
7607e51b-5767-4080-b8f3-3e58662c58f1	valutare l’interazione degli utenti con applicazioni TIC
760fa5a1-cd81-4017-9c9e-03d7641c7643	tecniche di agopuntura
761d1abf-cd8e-4bcb-a3fb-da9538bdad9d	tagliare la carta da parati secondo le misure
76202c13-7ab1-4b24-a92f-48dbe0225227	tipi di doccia
74ca4a4a-85b2-40b4-9fc4-9110e23a26d9	sorvegliare le vasche dopo un processo di nitrazione
76328c98-98d4-4693-a237-c6555661c1bd	utilizzare la macchina per l’avvolgimento della carta
762e4178-db41-47ba-8f56-0e58ecb7a897	distribuire le informazioni tecniche sul funzionamento dei veicoli
7637f5b2-314c-4460-acda-b311360cbbc4	pianificare la presenza in occasione di eventi professionali
763e00c0-702a-4686-ba07-3831e5d2f208	compilare piani sulle prestazioni del bacino
7640ff82-7581-4591-bb8a-0d5975a88ba8	gestire i medicinali veterinari autorizzati
76489717-cdac-401c-aac1-72d22819b0c0	gestire l’ispezione delle apparecchiature
76500c95-6eab-453f-9585-21e42e0d4c06	lavorare con un gruppo artistico
76521855-184a-4852-b06c-63aa4053857a	supervisionare i progetti di paesaggistica
766d27ec-9af4-435d-adcb-c8025dd2e148	interagire verbalmente in sloveno
76746b56-20b3-40aa-afbe-07b7e5db752b	condizioni di conservazione degli emoderivati
73918ba2-4042-47a2-8301-1b08743dcba4	gestire l’input di stampa
76763b96-5ba3-4530-9731-042e18a36943	scrivere il profilo delle persone
7677d7a2-5489-45d5-a35c-475c4d00efbb	trattamento a valle della birra
767ce770-6780-48f0-b2ad-994afbff96ac	utilizzare le attrezzature di imballaggio
7552f9bc-ed21-47a9-b671-c198c7019aae	lavorazione boschiva
768079a0-2f7b-4286-ad3d-a0ba54763f07	lavorare con i tecnici addetti alle riprese
7681ed39-eec5-4ed2-a627-d476e4ae94f3	ritrattamento nucleare
7682755b-a9fc-49d7-a25c-3c3493c06e9a	eseguire l’ottimizzazione del processo
768c0a19-e544-4c91-b53f-d0c021daec04	restare al passo con le tendenze del mondo del vino
76990f8b-96b0-4533-ac52-793e0c4dc5d2	fornire indicazioni sull’etichettatura degli alimenti
769a9048-60cd-4f32-86ea-af69f6c6f4f8	sviluppare i programmi ricreativi
76a5f17f-f23b-4108-a6ab-1e5172f9648a	fornire indicazioni agli ospiti
76ade523-6cce-4e19-b4c9-3454de00e65d	chimica dei colori dei pellami
75c040ca-e95e-4df1-8df9-4e813fec5ec7	applicare la gestione diplomatica delle crisi
76afbec8-9331-457a-8c84-3b96648ff30a	analizzare i dati su larga scala nel settore sanitario
76b1af87-7817-468d-bc0e-711ddc5ed247	istruire gli altri
76b43d46-bd64-4580-84b5-e5bcb35be565	creare campioni di calzature
76b6aed7-9978-450b-8b30-ae4ca609594f	aggiustare la macchina per la cucitura di carta
76b8f81a-ff62-47cd-837a-41d04bde00cf	programmare un impianto di allarme domestico
76b9c375-e7d2-477d-bbcf-d88d35c02b1a	consultare gli studenti sui contenuti di apprendimento
76bbf7a0-4b47-4903-aa10-5de0738e6c39	teoria dei vincoli
76cc4956-c376-43eb-89ff-9e7507656bb7	controllare le valvole
76d3a715-5742-40d5-aa9f-509aa92f94e2	gestire l’iscrizione
76d7dc0a-a0f8-4da5-a46b-542b1f4fefaf	installare servizi TV via cavo
76132306-52fa-4da2-87d8-2b9fb52a5d4d	utilizzare un caricatore frontale
76daad3d-90ba-49ef-b39e-e0161769c618	fascioterapia
76e2bf1e-8a26-49fd-a897-5defeebfe8f4	decidere il tipo di test genetici
76e39dad-63b5-4f8b-8965-19c9a0dae749	monitorare il personale addetto all’azionamento dei motori
76d85697-abdb-4644-b7aa-a3e63b6d9ed0	affrontare le situazioni di intervento di pronto soccorso
76e3a753-6737-4349-b410-5039945cd0ad	comunicare con i fornitori di servizi sanitari utilizzando le lingue straniere
76fc01b0-2a8b-469a-b37d-c1a563fb4641	pianificazione della comunicazione pubblicitaria
76ed2e78-1fc8-4c2f-9103-a599fd93e592	consigliare i clienti in relazione all’assortimento di prodotti ittici
76fe1018-710f-4f75-a1d5-3662206b4d32	applicare le norme di sicurezza
7704beb6-49c3-4d72-90e3-08e309f6ac5b	accatastare i pallet vuoti
7706ca4a-1601-4d67-880d-595debd975c8	preparazione di pesce e frutti di mare
7708fc10-5310-4358-a3d7-b57bbe19c778	sviluppare tecniche di biorisanamento
770b6062-1fef-4c82-a432-5508d4e6a924	istruzioni del fabbricante per gli elettrodomestici
770e2be2-794f-4b5e-b114-9d11a18df8f0	istruzioni del fabbricante per i materiali audiovisivi
771128d0-ff68-4fdf-ae06-76fd89b4bacb	sviluppare gli itinerari di spedizione
771b07d8-3609-4a9c-b885-e57b8ea41367	iOS
772f0090-5162-4328-8d45-944f3d9d72f5	acclimatare il legname
766e2411-4b88-43b3-bac7-815527a7f215	sistemi di informazioni geografiche (GIS)
77309201-3138-4680-9cc3-b7333748bcd9	mantenere la fiducia dei fruitori dei servizi
7742bf59-2e97-4588-ac78-e45882b52d1a	tecnologia a intreccio
774d5e22-8e64-49c7-991c-9c45dcb8f3c5	installare hardware
775030d8-69f7-49de-9f99-92d018de484c	impostare tolleranze
77543538-a041-42c6-8e1b-c45b6cb7bb0f	distinzioni nei metodi di costruzione delle navi
7758a6f5-4733-4d1a-824f-6904605aa210	fare da tutor agli studenti
7759f010-822a-4a31-abfc-bf076fa3c98f	prendere le ordinazioni per pubblicazioni speciali
775a844a-f712-4668-9136-e8d36210a1e5	trattamento di metalli ferrosi
775ebb33-72c6-43cf-bcb2-0e3e0e2be26f	effettuare le analisi di controllo
7689109c-8ac9-43f7-88a2-636e37ead998	gestire il controllo delle infezioni nelle strutture
769f94d8-4fa6-4da6-9514-3d2984b8c0fd	interagire verbalmente in norvegese
775f1224-224b-4221-9aa0-6aa10b3d4ab3	anatomia della bocca
775fe179-8b96-4f5e-85b5-dbf6d2250993	osteologia
77619238-7dff-4267-8a96-dead10f4392a	controllare la compatibilità dei materiali
7766d262-7688-443c-b212-545383e5ef24	assistenza sanitaria di base
776fb841-1492-47ff-b869-d3ce5566837b	trasferire i bagagli
777008e7-4ac8-4ea0-bebd-cd88a676e3dd	leggere il contatore del gas
778143b4-c81e-4462-92ce-ea18aa83dbcf	produrre i materiali per il processo decisionale
7780e909-a73d-427f-8145-b87d8167ebde	riferire sul processo di voto
778d0308-aa93-4254-b208-306a3f64659c	quadri elettrici di sicurezza
7782101c-4fbf-46e5-a7c3-ef5a53f75fea	rintracciare le transazioni finanziarie
77920824-fac3-412d-858e-dbf02e2672ef	monitorare le proposte di politiche
77924d9e-9f72-41e3-8370-42d062f92ab2	movimentare le merci pericolose
778e6566-a3bc-42fc-9d6e-62bd5162b78e	seguire il codice etico per le pratiche biomediche
77939279-b834-41f7-90ca-eaed9c589bd3	formare gli operatori all’utilizzo delle macchine da miniera
77a2d55d-0985-4f0c-9328-253c6afc560e	tagliare gemme
77af541b-fb3d-4aa3-8d73-ffcc723b7dd2	sincronizzare le attività delle stazioni di pompaggio
77adb0ff-e4a4-4d3e-a630-e75f145abfb1	interpretare i risultati medici
779de1fe-9934-482c-89f4-53b956594d54	preparare prodotti speciali a base di carne
77b4dadd-db0f-48de-a746-6b29d30425ba	giavanese
77d44091-f086-4028-9f5c-feb49d4a0e4e	conio
77daa2f8-291c-4e55-a64f-68173e310d57	analizzare le politiche degli affari esteri
77d5132c-f720-4d7d-9f7c-a934a0224463	comunicare mediante l’uso di interpretazione nei servizi sociali
77dafb21-c6e5-48d1-8a05-37d94a0e06da	tradurre lingue straniere
77e1d4ab-de0c-4f0d-a7ff-927c3b0fdbe9	galvanotecnica
77e6aa69-cf1d-40e0-907d-1af56e131b89	fissare i listelli rinforzanti di legno sui componenti dell’imbarcazione
77ea409d-5100-4318-b57c-68faea51a61d	utilizzare le apparecchiature di rilevamento di metallo
77e03333-de3e-46b2-80df-1cdd609a0fe0	aggiustare la macchina per la fabbricazione di borse di carta
77eb68fe-e3c1-40c7-988a-518a13e8f5c1	eseguire esperimenti chimici
77eefa00-f687-4446-874e-25ac3b608ea2	nutrire gli animali
77ef1c6b-8476-4253-9a67-bf842b18dae6	legislazione sulla farmacovigilanza
77eb22c1-ca9c-43e0-a2db-b40085ef29c4	riparare l’impianto elettrico dei veicoli
77f4fd47-99c6-4807-96b0-0f3e45d21163	essere addetto a macchine per l’intreccio di fili metallici
77f03cc8-35ac-4e37-bf98-44b3d8532af9	partecipare alle gare d’appalto
77f5444f-71ec-401c-ad8a-0df997ef8ea6	sorvegliare gli impianti delle centrali nucleari
7805a96f-40d7-4007-bdfc-71a78dda76d8	riempire la caldaia
77f59c03-247d-4bb4-8a9d-c0363bbb5eab	applicare rappezzi
77ff0508-fb39-4c49-819d-b6b7b7235f1d	supervisionare progettazione e stampa di pubblicazioni turistiche
780fcea6-8621-4783-934c-e250f3dc6d9b	selezionare gli animali per la terapia
781d3451-1c15-4331-8260-dad80b89a835	applicare i regolamenti dell’aviazione militare
782181de-a988-4a11-b5d5-a579d5be7af0	coinvolgere i passanti in una conversazione
7829854c-769c-4227-88e7-39fb5235d3c8	gestire le comunicazioni visive
783a630f-268a-4d70-8448-badd4c11e5b6	creare contatti per mantenere un flusso di notizie
783b3283-cbab-4674-8bd5-e235333d3933	principi di produzione delle colture agricole
781262dd-fcff-4232-bf62-f45286405c02	valutare i dati genetici
783dae5e-dc92-462d-ae43-a206419ff0bc	componenti hardware
783dfd94-3284-4afe-9df1-2f9361f9c50a	monitorare le operazioni di verniciatura
7842772c-10f0-4c25-83fe-580d20c52ca5	sviluppare procedure di collaudo di dispositivi medici
78491121-0e40-49a8-97af-597dcc892703	consigliare i piloti di aeromobili in condizioni pericolose
785ea97f-6254-44dc-a832-4d93cfd93abc	effettuare la manutenzione dei contenitori di acquacoltura
7860e718-371e-4991-99c8-3ff9ca0e5512	imbalsamare i corpi
7860dcc1-4abd-4e0e-ae24-ebb468b5e73d	fornire consulenza ai tecnici
78748d34-d449-4951-be86-e81e31fb8b45	garantire la competitività dei prezzi
7874f5fc-749c-4906-bdea-a531bb032ff4	mettere in evidenza i problemi medici
7705914a-5db9-49db-904e-2e618fbe993e	tipi di ascensori
788fc2a0-bd0e-40f6-b999-d59f697d2209	utilizzare un seguipersona
789603b8-6821-4261-a986-e92da5434a8f	valutare l’attuazione delle procedure di sicurezza
78920a61-76f1-4936-b6ac-93db5972cd7b	insegnare linguistica
7899434d-1198-408e-89c3-aba210c171e3	potare le piante
789eba3c-5cb1-42c5-9c5f-95169d7ba51e	coordinare i trasporti
78a2b07d-3b01-45ab-97a1-a8cda1dc32e0	valutare le possibilità di attività all’aperto
771c2b1a-7aae-4096-8b46-76c15ab28716	progettare set in miniatura
78a9a92a-d0bd-4238-8393-79a34aec2acc	effettuare la manutenzione degli impianti di depurazione per l’allevamento di molluschi
78c69fdb-5dea-410d-bc4c-d108c34ce704	collaborare con gli architetti
78af05fb-95fd-4ce6-b226-74a5d311affd	garantire la collaborazione tra reparti
78a40f77-7225-4fbf-8877-10101a367ac9	Lisp
78cc0cf3-e587-40bc-906c-7655f111c50b	instradamento delle chiamate
78cbfd35-4257-47b9-a726-80b0e0faa2d0	mettere a fuoco le luci di scena
78ce9d52-ccfe-437c-88f2-71b9eafa18a2	effettuare una rilevazione dei cespiti
78ce7a28-701c-47b9-ae6f-f676fc2d8a22	pre-macinare le granelle di cacao
78d1bb61-2e5d-4cda-8e6b-6c4b7c534b63	valutare i requisiti dei ferri di cavallo
78d3acb5-2a17-4630-8135-20198caab549	utilizzare gli attrezzi tradizionali
78d5ba2c-d90c-47cb-bf1c-f66bc56c7f53	istruzione degli adulti
78d75c42-1696-4e57-9d8e-5378cabf2dae	verificare i campioni di petrolio
78dbf3ba-1f1e-44d5-aaac-069463b91b08	creare pacchetti SCORM
78d812ec-3110-4002-8bdc-237ab3a00265	analizzare le relazioni scritte connesse al lavoro
78e0e1b4-c855-4838-beff-b2b7eee5407c	posizionare i prodotti del tabacco nelle macchine
78dfd1d8-15ac-4a93-9db6-a3c7e6263bd4	utilizzare le apparecchiature marittime di comunicazione
78e1f4a5-256a-4f6b-9963-5c8e14768e45	monitorare i movimenti della merce
78f382f3-e86a-4655-ab67-44f1fb5a070f	comprendere gli ordini di lavoro sulla piattaforma
78f47c78-c5ad-4af1-a2fc-d55bff65c28d	scrivere in sloveno
78f49ef0-19dd-499f-b8d6-598eb13921bc	effettuare la manutenzione della postazione odontoiatrica e della zona operatoria
78f9f2f9-0c99-4f70-8230-1da375cd0b01	orecchio umano
79005249-a58c-4522-975f-93008045962f	suonare musica da solista
790c607d-cffb-41bc-988f-437b9a233471	sviluppare prototipi software
791178a0-486d-4378-9e01-4d17841a995e	trasferire i blocchi di pietra
79121da1-2fa9-45c4-90b6-0e5cb91a2717	redigere testi pubblicitari
7919115a-d1c8-44b9-8475-0cb9daf34a4d	selezionare le tattiche per una partita di calcio
791a989e-830c-4e53-8200-24d3a8978051	creare piani di protezione delle colture
7922c731-7445-44f7-8e6b-80f167d2dace	insegnare abilità aziendali
79266546-a4fa-478f-9270-0343dc776910	osservare il programma di lavoro della produzione
78603fcb-a9f6-44dc-b9a3-c77fb4ed9a09	etichettare i prodotti alimentari
792829fd-80ec-4be6-bce6-6cd5a0f35ace	lavorare in una squadra che opera lungo la catena di montaggio
7870ffa4-3cd0-4b67-b1b2-8c25ba9c361b	sostanze chimiche di base
7931026a-8002-4c32-aa7e-bee20ea93762	verificare i danni al veicolo
792861fe-f7c1-4f00-b9d9-6255a52d0ee4	garantire che i treni circolino secondo l’orario prestabilito
79307654-7311-4efe-9d7a-f19c871be5f2	vie di navigazione nazionali
7933308e-7943-43ab-ada0-86f4664d033d	scrivere in tono colloquiale
79334753-aa9e-4541-a143-8df6e5ecbac5	sviluppare strategie per la gestione dei rifiuti non pericolosi
793413f1-b9d9-42aa-855e-079e9e6a3708	applicare i principi di sostenibilità nell’assistenza sanitaria
793d40d5-0aec-45c6-8d6c-fa1d06119ffc	eseguire audit TIC
7940d78a-9a76-4f1c-9ad8-e1102f9f1e1f	creare immagini in movimento
7944f3d8-cba6-4c03-a7b0-7ecb1dd6eb5f	tecniche di stampa
7953bf97-fae6-43cf-b7f3-bde5583a10e2	indagare sugli incidenti stradali
794c7a3a-5fda-49f7-9545-1685f4698977	guidare il gruppo di odontoiatri
794ebe85-4fbe-45f9-98b3-09b6fa0318fc	sviluppare un piano di programmazione
7956b6ca-d0af-4dda-b5fa-eceba8a8631e	partecipare a un’attività di mediazione artistica
7957fdaf-e2ea-48d8-91df-e7b9e34c62e5	progettare le condotte con differenti soluzioni di rivestimento
7959655c-0f59-423b-b266-e4b17d66f60b	tracciabilità nell’industria alimentare
795ccc1b-3276-4419-9450-0c8e7ee08a26	monitorare i prodotti alimentari macinati
78d5981d-2d3c-46ef-8998-57f834b67d71	recitare in motion capture
795d4d14-161b-4974-9399-a86de3afa4ae	tendenze di sviluppo in radiografia
7963f5b8-742d-4a2d-a33b-206ce93212c5	rimediare ai danni delle alluvioni
7965cfbe-dacc-4258-987d-6d9aaefd96ee	creare un piano generale aeroportuale
795d3d88-3423-4265-9bc9-504a91e01238	sostituire lo stampo
79781b93-de06-4952-8dd5-e25d3f884997	utilizzare il software di controllo del latte
797b944c-904d-42f1-9b4a-fe8fc280b34e	classificazione dei campioni
79848ff7-d9e0-4ef7-95a3-328ff24f0d02	eseguire le procedure di venipuntura
7988fa79-0e0a-4d0e-941c-843b9e39a54b	interagire verbalmente in kazako
798a6301-43f0-4082-ad21-75a6a09e044b	manutenere microelettronica
798ca1ea-6ffd-4809-bb16-11fd2ffda61d	lavorare con drammaturghi
79897843-66b4-46b1-9198-beaa03163e78	gestire il personale addetto alla musica
797ddc24-b9bb-4a01-8eb6-39361940bf52	fornire coaching al personale per l’esecuzione dello spettacolo
7995cba9-f2f2-43a7-9f02-ece12cfe2cf2	analizzare i fascicoli dei sinistri
799bbe71-f8fb-417a-b7ce-7207cb8a9ab2	gestire le riserve di valuta
78e7a516-0e56-4b13-865d-107104d433d9	ispezionare la fabbricazione degli aeromobili
799ee1f8-4668-426d-a29c-4ada8dfe197f	percorsi geografici
799ffd27-265a-4819-b7bd-85776e69a6fc	rimuovere il manto stradale
79a2cc95-11f4-47a7-9b29-65a9cfed8a93	progettare le esperienze dei clienti
79b3f671-82a5-44c0-9fd2-997547f1b619	gestire la flotta di navi
79b9fe28-6ab5-45b3-9d03-c18963838872	valutare il costo di prodotti software
79bbf272-d712-4b5d-8b6c-37c6459174df	ispezionare la fabbricazione del materiale rotabile
79b35b64-cd7b-4fb3-8524-14ef442a70de	fornire consulenza per l’interruzione di gravidanza
79da5ae6-71ee-4b5b-903f-4d0b39fd97ee	modellare sistemi elettrici
79c19d37-c756-466d-b276-0db332fb6715	concentrare fanghi di cellulosa
79d7a9bd-84bc-4ef0-bdae-2f6a0886cdf7	tenere l’inventario dei prodotti per la pulizia
79ea729f-762c-4bf1-a398-97188d799180	pulire le scene del crimine
79e2e03e-795e-40e0-8892-f30ce99d193c	reagire in modo flessibile in caso di problemi nell’ambito della trasformazione alimentare
79f1ed2e-9b9c-49e0-bb75-2be66b8c62c1	conservare la documentazione sul processo creativo
79f07808-742a-4e5b-a39a-5ce766f23817	scrivere relazioni relative alla segnaletica
79fcadcc-617c-4962-aaaa-f5f1084d1a44	inserire i prodotti del tabacco nelle macchine con i relativi materiali
79faee3b-c8fb-469e-a5da-35a8b6442662	insegnare i testi religiosi
7a003129-b27d-4ea0-9a3a-a9b88fc115c6	controllare la macchina per la posa dei binari ferroviari
7a0f7fe3-d5fa-49c7-b5a5-e27b0e2d4815	marcare il pezzo lavorato
7a1a919a-dcf1-4bee-bb2f-d5747b838e93	rilasciare licenze
7a130d25-e896-4419-b44c-ab7d682901db	tradurre in consecutiva la lingua orale
7a1bb53a-3738-4f87-935b-7b9f40e71c25	promuovere i prodotti dell’azienda agricola
7a1b1d87-c2ee-4d14-afe2-81a6253d20c3	compiere un decollo e un atterraggio
7a216d48-0406-49b4-8063-9d89ea5c4297	autorizzazioni relative alle sostanze controllate
7a28d528-3867-4819-ac4d-a184924592fd	valutare le condizioni dell’oggetto
7a353cad-5107-4d54-b4b4-360af73beb81	soddisfare requisiti estetici
7a280504-66e0-44d4-98aa-e17ecc15ac31	mantenere l’inventario di prodotti per la pulizia dei veicoli
7a338dc6-c6f2-4b15-908f-17f7cd1d6606	determinare la capacità produttiva
7a424a2b-d4a5-46b8-b22c-0d0e9f277ac9	controllare il bestiame
7a4cd690-f984-40ab-8485-d3f32e42cc78	far muovere le marionette
7a4732b6-381e-46bd-af12-094fcaceb595	valutare i livelli di fermentazione delle foglie di tabacco
7a4e617d-bbee-43a5-ae0a-9163dac32987	pedicure estetica
7a52adc3-daab-47ec-811c-d72812e66aa9	lavorare in sicurezza con le armi di scena
7a6172de-73a0-46a0-88a3-d9273668fbed	implementare software anti-SPAM
7a6c5fd8-54a6-44db-b7ba-4a151a00e23c	interagire verbalmente in greco
7a738c0b-cc1c-4c81-8d50-5666a53028a2	controllare i giochi
7a750709-38c8-4d7d-8cae-41e069efb2ac	odontostomatologia
7a69b542-d608-4370-b913-cca2d19692e7	collaudare l’aggiornamento dei sistemi di gestione delle informazioni aeronautiche
7a732b3f-92b9-4396-b1dc-aa9af4d2ddea	area regione e offerta turistica
7a7bec3b-e2a5-4f26-83ca-12906c30f8cf	avviare le misure per preservare la vita
7a7c66fd-8cee-48e3-9f98-eda9600d1f5e	terminologia relativa al rigging
7a8085df-7315-44a6-b36a-75e727f1bf86	realizzare prodotti di base non-tessuti
7a884245-d086-41bf-9bc7-a5603a046a9a	legge sull’istruzione
7a90de4f-6b8e-4902-8862-537d504419b6	confezionare i prodotti
7a8e7aae-ae1c-4a4c-90c6-12c673cd391e	gestire l’impatto ambientale delle attività
7a91162a-f982-4066-b24e-2a53d675d45f	applicare politiche di sicurezza ICT
7a997595-b6ac-46ff-a4d9-6892b2c3aea4	prenotare il carico
7a9e7d3f-3663-4e2c-a599-3fa9ee24a1d5	risolvere i problemi di spedizione
7a9a8097-fbb6-4939-84fe-61aec0e06d0c	promuovere le politiche agricole
7a9c6b3c-0b7b-4708-9ea1-7b51a31352c2	rimuovere la pellicola fotografica dalla macchina
7aa3c6ba-275f-4010-9837-ff2944d5c179	fornire una terapia per l’apparato visivo
7aabade4-f682-4b43-9274-8dbfddd8798d	monitorare l’impatto sociale
7aa50302-0ee7-4376-ae33-6f0cb8657404	tradurre le innovazioni chimiche in termini pratici
7ab52e50-ad51-40c7-adea-f19fc347bd69	calcolo dell’energia alimentare
7ab8176a-0ffb-4087-87ed-d22ee553aae1	utilizzare attrezzature per carotaggio
7aae2863-eefa-427d-b831-e33bea5eae80	zucchero, cioccolato e prodotti dolciari
7ac82275-d8f0-4cb2-a7dd-516890e53ca6	dispensare le lenti correttive
7acf81a5-4e85-4b13-abd5-fa94432fac08	supervisionare le distinte di versamento
7acaeca1-8209-4fc1-a157-0fcbec8784a2	storia della teologia
7adc93f3-6038-4ffd-990c-f526cd541689	interagire verbalmente in armeno
7adde3ca-14f4-41cd-af2b-067c2309ff70	eseguire i test diagnostici per le allergie
7ae495fe-3096-482b-bb41-958294107407	funzionamento elettrico dei filobus
7ad652c3-0441-431a-9def-f575957ae8e9	pesare parti di carcasse animali
79927b6d-8459-4c0a-9367-bdfd3032cf06	sistemi di creazione di videogiochi
7aed39ed-8bce-49f5-8e06-1c5b42e7e7ea	emettere gli ordini di acquisto
7ae6f89b-5c93-46fb-9a44-d5e383013caf	processi di ingegneria
7af55a04-2437-48f0-a268-fc6ad746d1c2	gestire lo sviluppo professionale personale
7af9bcae-3464-4cf7-afa2-3cbfb475b6a3	negoziare i servizi di logistica
7afafb25-3832-4f6f-9568-309891a69576	conoscere i regolamenti riguardanti i consolidatori
78d21a57-c1a9-4e67-a53e-c4c682add324	valutare i dati scientifici concernenti i medicinali
7b000892-c54d-4d1e-8957-5aa9478980cc	entomologia
7b0311ce-34b1-43fa-bb13-508e37a6c45a	immagazzinare i prodotti
7b0c85f8-9c6a-4fc1-aecf-7e84da07354b	installare i dispositivi dotati di serratura
7b0faeb4-223b-4b5b-b280-b6febec51a37	tecniche di rimozione dei graffiti
7b00ca6b-1144-44ae-a2f8-e39af56a7a85	mantenere i contatti con le agenzie di benessere degli animali
7b1257f2-96ba-43b5-a50d-14b838d8a60b	valutare il livello di essiccazione delle foglie di tabacco in base al colore
7b19da33-cdf0-47c6-9c9b-a1b8e31fcffe	scrivere in spagnolo
7b2db4cc-cb92-48f3-90eb-b4d6709d4e79	mitigare lo spreco di risorse
7b3c6268-b572-464f-912c-f812ccc254cf	eseguire gli interventi di chirurgia pediatrica
7b24b66c-3dc8-4eb7-97a5-9aa2e6898751	elaborare politiche di controllo di malattie trasmissibili
7b1f47ff-af10-4e98-b671-cbef6d88e3ab	seguire norme di qualità nell’ambito dell’interpretazione
7b3f14ee-2ffa-408c-91af-2845333270b9	determinare gli esami di diagnostica per immagini da eseguire
7b408e4f-1bf1-42ab-9483-d5afe6008f6b	comprendere il coreano parlato
7b45bc58-9f94-4cf8-827e-cc7db3181dcd	eseguire il trattamento prescritto dai medici
7b59723a-adfc-499b-80d5-de53189dc51b	classificazione delle informazioni
7b6af364-bc1e-4b9b-bbba-7f7f25e827ab	analizzare diversi tipi di acqua
7b6394b6-6329-47b3-ba90-888c69c71e0c	utilizzare tecniche artigianali autentiche
7b7516d3-b9da-4dba-a353-2de9cec14a25	creare ricette di bevande da estratti vegetali
7b66b973-4a96-49cd-8c8a-f12e73378e85	analizzare i dati dei controlli
7b783c96-3108-4c7a-808e-02062845403d	perdita dell’udito
7b5a12ef-b7f8-4377-86ac-ce349254f4e6	pulire i distributori automatici
7b78108d-1130-4259-bdbc-4daea10f1ef5	dare consigli agli altri
7b8d1bf1-7fe7-4e5a-838e-d0f4f53a165b	classificazione del gruppo sanguigno
7b7f4427-8232-47b5-b70f-f7b6bf437ee7	determinare la data di uscita
7b8f52c3-c0e3-43ba-9262-febaee5ee12c	testare la purezza dell’ossigeno
7b96ad9a-0f33-4f3f-a5b4-75a19923399e	sviluppare le strategie competitive nello sport
7b93c9dd-0d37-400b-ab93-e5f8dee2b416	mantenere l’inventario dei componenti delle rotaie
7b9d34d7-f1aa-400b-ae4b-7dba32cd09e4	principi dei motori a combustione
7ba08520-1375-4c8f-bdc0-d9a4d59ba81a	eseguire l’elettrolisi
7ba5aaf3-7b21-40b5-a404-2230dd02518f	insegnare geografia
7ba87ffb-663c-47a4-9213-85ddbfbc7186	pulire la gabbia di mascalcia
7ba3edf9-d3b2-4b8f-bbe2-7e301c7e4fb7	offrire consulenza su questioni abitative
7babd800-959e-479e-86fb-06c4a0475e1c	utilizzare una macchina tipografica
7bbd2779-15a5-437f-aa12-f9c186fd9917	analisi degli investimenti
7bb2391a-1eb8-4bba-83e5-c47bb01ee554	applicare il processo decisionale scientifico all’assistenza sanitaria
7bbc6329-05e8-4d7c-8330-96fac15f1294	tecniche di pronuncia
7bc05a7c-1765-485c-b678-d24b3434b768	accogliere gli ospiti
7bd29bdc-fceb-4557-af38-016f6de46d70	riconoscere i segnali del gioco compulsivo
7bcf51af-aa58-415c-a0d1-a9a012068e7f	forgiare il metallo su un’incudine
7bc223fd-fc8c-4ae4-a3db-6d7a1d551a6a	lavorare in modo indipendente nell’agricoltura
7bd48dcf-daa5-4057-8927-0ff9f1a32143	progettare rete di ventilazione
7bd98696-f22b-4923-97bb-ad8a93c96087	gestire gli ordini di legname
7bdd8558-4515-48ce-9f18-df165926a5b6	individuare le cartelle cliniche dei pazienti
7bda34f5-6a66-4b46-bb68-858daf7af799	versare il metallo fuso nelle anime
7be2b35d-150b-4be5-a73d-83a20526c716	preparare i dessert
7be09694-b1c2-48e3-a6a3-fcb3352240a5	disegnare bozze del design
7be3131d-dc5c-4c41-8d1a-6218527e37db	alchilazione
7bf5a850-bcf1-4baf-9e30-a40b06cf8fee	ingessare gli arti inferiori
7bfef1f1-9c86-437a-93a5-015616a6470c	operare i pazienti affetti da malattie toraciche
7bfc3e01-1e98-42ac-b8b4-30f24541ac72	infiggere pali in lamiera
7c0e4050-30a5-4b01-9210-0ab9440749bc	effettuare la manutenzione delle attrazioni di parchi divertimenti
7c013614-6599-4a54-9262-e529e8694387	istruire gli utenti di biblioteche
7c10b8c7-48ee-4804-b4bb-7ef31d9b8c15	utilizzare una fresa da scavo
7c11c312-8a4a-4403-93ef-4a8541adccbc	ingegneria ottica
7c1b1952-6fcb-408f-81b2-cde8259ab081	utilizzare una macchina per la produzione di buste
7c1f8ce7-820c-4538-a5f7-344c7ad2b6f0	regolamenti in materia di sostanze
7c2e5423-e2f8-4fb6-ab96-3ba4b85035b7	adattare le cornici ai quadri
7c31f919-7cfb-4a66-be83-7e3161266811	smagnetizzare gli orologi
7c404e05-f84e-48f5-be1d-084457141b71	aggiornare le competenze linguistiche
7c3469ec-1ade-4539-9620-8de4e8800f72	flessografia
7c48b37d-10c3-4769-a673-15b8164a87ee	garantire la sicurezza del magazzino di stoccaggio
7c537efe-0d21-4681-9d76-1f5e06dab1c9	processi di fusione
7c3ea975-c7a0-48e3-8b53-10bc6a5f7fe7	Objective-C
7c543cda-aebb-4195-86c0-4484d070288f	sismologia
7c576974-f587-4304-99dd-08fb596533ed	tecnologia primitiva
7c59024b-995e-42f4-835f-7bdbede1cc47	processo di purificazione del grasso animale
7c5dd227-e7c2-4b33-8471-ea6eb60e519b	preparare pasta
7c64ec56-f947-4974-adfd-5f24f7aef832	sviluppare un linguaggio coreografico
7c6f9e81-ee10-4312-a2f3-ed05ef6d7168	mantenere la pulizia della zona delle casse
7c701004-cf09-4207-9f90-5a25681436aa	installare gli interruttori elettrici
7c7f0462-6c4a-48d6-ad15-f1e866d0b160	gestire i vettori
7c892d65-47fb-4ce5-8f67-b3aa5dd02798	disegnare la costruzione del set
7c8f4744-dd7f-4df4-8e7e-ad5e97fc94a5	eseguire i preparativi per lo specialista in malattie dei pesci
7c84a27b-d199-437d-8bea-031965a23b5a	installare l’ascensore
7c92b4f4-256c-401d-afff-bfc41090da82	fornire sostegno per il calcolo finanziario
7c9073b9-405b-42c1-bbc1-d2527fb15604	applicare metodi per la fabbricazione di calzature e articoli di pelletteria
7c96d074-a232-488c-9f4b-6bbe5b9f7254	preparare proposte di estrazione
7c99703d-d664-4552-a992-9164483cad86	infrastruttura TIC
7ca3fd64-3ee0-4b7c-a60b-441ef852790a	progettazione dell’avannotteria
7ca5f76c-3844-450f-a3f0-726ba7b62612	realizzare prodotti di pasticceria a base di cioccolato
7ca6ba6c-0703-4561-8184-88423102c824	categorie di videogiochi
7caeb52e-6ae1-42eb-bfea-d89acce7e01c	creare mappe climatologiche
7cabf72c-f983-4376-8fc2-e472859d4664	preparare le sostanze chimiche per l’incisione con acquaforte
7cba23f5-a36a-440c-b7d9-f19db5096b6e	pianificare le operazioni di trasporto
7cc62e51-f6b0-4a37-8709-f48be65b9e41	valutare le risorse per i programmi ricreativi
7cc8c75b-b5c3-415c-ad18-81c2a78efcef	gestire le prove su strada
7cba2298-832c-472b-b3e2-d08afa427338	applicare strategie di insegnamento interculturali
7cc9d7f1-822a-4e86-a400-8c9d276d49cd	disegnare bozzetti degli oggetti di scena
7cdf7ed7-3e1a-476f-add5-5cad274bc68d	teoria di ingegneria del controllo
7ce40cef-2fe9-46db-aff8-8bb950e1f7b8	parto
7ce8b17b-9d67-4fac-9f0a-e50abc9bc7c6	primo soccorso
7cd83589-1fa4-4915-930b-c5a5c72bdb0a	tenere rapporti con i clienti
7cec7d26-729c-4e0c-9ad8-b28df2da3741	preparare prodotti cosmetici
7b7c5858-b656-42c2-b165-e21c2a5323f2	separare l’inchiostro
7cefebdb-fd5c-43a9-8688-803333438889	fusioni e acquisizioni
7cedb751-60db-4433-90f7-5f6f1f8b0134	fissare la gru
7cf69422-7dce-48dc-ab96-1d2b279d5ddc	valutare lo sviluppo dei giovani
7d0a3e71-c7ee-4816-8ceb-d80f5a654b10	creare materiali per la formazione
7d16ae6f-e43c-4cb9-9659-3751bd856693	sviluppare metodi di purificazione dell’acqua
7d074dd2-1705-4dd0-a836-afb413e37936	gestire il personale addetto alla fisioterapia
7d230c21-2725-4f87-90c2-5d1288654154	controllare la produzione di uova
7d28e898-cc80-4b96-8d32-457576d1b476	controllare una gravidanza
7d287ae9-91cb-468b-b296-fd2d50f3d8d7	eseguire studi e indagini sul campo
7d2836f1-8003-4cc0-884f-2e9849104d66	gestire le circostanze difficili del settore minerario
7d412760-83d3-4774-ade6-ea2e99cbeb1e	effettuare ricerche sui profumi
7d3b97a4-9415-4d1d-ada2-bb70cc1035e5	mediazione sociale
7d3b888b-ddec-4306-8a4b-419635342a8a	fare la guida per le escursioni a piedi
7d49bbfa-5645-4b43-8309-3e6875141899	utilizzare gli strumenti per la cura dei capelli
7d4aba42-aa3a-4f30-80c1-eba76aa5208f	creare parrucche
7d519bc1-c116-4a73-af37-4dc3e01af87d	assemblare bombe
7d5670ec-fb7a-4d0b-bbfc-a30fbdf97e5b	mantenere lo spessore del legno
7d5b92b2-b3bd-4406-9998-3d2a40755b81	monitorare le operazioni presso i pozzi
7d5e4ae5-1633-48da-8fa5-04579c044a6d	completare le procedure amministrative
7d63079f-21df-49ad-a9b5-5d8e213c7661	ordinare gli elementi in legno secondo il piano di costruzione
7d5d3b83-305a-498c-a721-83794107a690	negoziare con i fornitori per il materiale visivo
7d66c2d4-61df-44f2-8805-637204cca409	pressare il sapone e ridurlo in fogli
7d68655e-c158-455e-af2b-cab10a0a4792	prescrivere l’assistenza infermieristica avanzata
7d6b9cf7-2195-48c9-83b8-ba4293801aa1	ottenere i permessi per le armi in scena
7d82ff26-1f01-4889-8166-1a767acfe860	assicurare la corretta esecuzione del contratto e il seguito
7d6cad38-82a7-4858-a679-44562dba8363	individuare una nicchia artistica
7d8315af-cae2-4260-ba01-dc80b49f7469	creare disegni tecnici per le calzature
7d86baad-587c-46be-b3e7-de2b7d8df1a5	addestrare i cani da caccia
7d90fdca-4ed9-4cf8-9fa0-e488600a1bd6	verificare il mezzo di trasporto di merci pericolose
7c5079fc-9122-4ac5-b039-bb62709dbc64	scrivere in rumeno
7d941de0-a246-4098-80d0-0b486684e091	ispirare l’entusiasmo per la natura
7d9aa78d-1764-41c6-8bfe-75870482429f	seguire le procedure di segnalazione degli eventi avversi
7db28569-f588-49af-8d59-9d01ba7564d6	ordinare le attrezzature
7daea8b0-766f-44af-8909-bc03b71584f4	garantire il rispetto delle norme di spedizione
7dc041f5-6999-48d8-88cc-6d6b743633f3	Convenzione relativa alla creazione di una Organizzazione marittima internazionale
7db69ab7-2984-4d8b-a061-6c7aa2bff7bb	patologia clinica
7db29f82-f135-475f-9292-1611c4304adf	misurare il livello di raffinazione dello zucchero
7dbf11b5-3a27-4a48-b167-bf2663413b8b	Absorb (sistemi di gestione dell’apprendimento)
7dc94fb3-925c-4186-bafe-6fffdc268bd7	leggere gli schermi 3D
7dc83cfa-2fa8-4cdc-8c80-dd5d10f613d5	condurre una valutazione di impatto dei processi TIC nelle imprese
7dcfb274-f27a-4800-ae24-8bb47959605e	urologia
7dd15347-ad77-4c82-a986-795e6a3699f5	controllare la flora e la fauna selvatica
7dcbfac5-94c1-40ec-a242-b6bf47cfa8e8	interpretare i test diagnostici nella otorinolaringoiatria
7dd5d7dd-fd32-44e2-aa75-cf56530ef28e	eseguire i massaggi shiatsu
7ddae4ed-2d11-4049-a805-83acc2d0e076	predisporre le luci di scena
7dd1c895-f62a-4bc3-b766-8c40a3795a66	e-tailoring
7de9ab5f-35a8-4233-b696-e8ec9946d67f	controllare la qualità dell’acqua
7df24902-4180-4a99-a810-a602c53bddc1	principi di produzione agronomica
7df3a042-82ea-4c84-86ef-378d72d8c5d4	conservare i campioni di latte con mezzi chimici
7deabd1f-bdcc-4793-a9c2-1d7ee28847f1	applicare le tecniche di risoluzione dei problemi al servizio sociale
7df55435-7fdc-49e3-a685-f4c3136c03d2	metodi di esame oftalmologico
7df6fda8-b082-4d79-8d74-9d90b7e02c87	sorvegliare la macchina per lo stampaggio a compressione
7dfaf34d-fdcd-40b8-9608-8b7f7d3a3d15	azionamenti elettrici
7dfb41d3-4782-4d8e-83bf-446659926b57	applicare la normativa in materia di pubblicità
7e08a7a2-a436-4b1d-81db-f33b439a5400	controllare la sollevatrice di rotaie
7e157e40-fa95-4dcf-ba48-8f7f49611e51	indagare sulle applicazioni della sicurezza sociale
7cc09cb6-b0b3-4aec-9f3f-1dbe35fe22e2	scrivere in bengalese
7e1a9829-15e8-46a7-b473-8e1b56432a58	cure intensive
7e0d06b7-9649-4f48-a734-3d1aa4f6b9aa	software per la pianificazione della produzione mediante acquacoltura
7e1e881e-7ea7-444e-b9bf-8ae15870cd91	lavorare nel rispetto della propria sicurezza
7e2bc60f-4be2-4189-9483-cd16d22dd65d	svolgere le regolari attività di ufficio
7e207d57-4f68-40b8-9276-ab5a2c8d6f29	programmare l’uso dei tavoli da gioco
7e2f0e9d-8090-4bbe-bbf0-b88f0aeb6f58	accompagnare i visitatori nei luoghi di interesse
7e334fc8-5b7f-4464-87fe-ca32a981f1a5	processi di produzione dei condimenti
7e34edb4-793d-4ed6-90d1-a5c7f9925617	individuare gli oggetti di valore
7e31bf53-106f-436c-a112-a6299d6418fc	effettuare le ispezioni di sicurezza aeroportuali
7e387958-2948-41ad-b70f-6b8994adb84e	promuovere il dialogo nella società
7e475d98-42e4-49f0-bd65-0ad0fb2af7e1	cacciare gli animali
7e357217-f1c9-41ac-9bff-54db02c62bf0	supervisionare il lavoro del personale addetto alle pulizie
7e45dc48-0da9-44bc-8ec0-ea5e08c8d71f	meccanica dei filobus
7e4a467d-3e34-4f78-b0b6-6f7d972f5e5c	manutenere i macchinari
7e4ef087-f4a1-4f6a-9e4b-7f2396761c89	texturing 3D
7e577d8f-1762-4d7b-8dd7-525757fbe845	insegnare biologia
7e5e92c4-3ed8-4bf7-a015-86e2d5cd80d0	principi di progettazione di sistemi di contenimento
7e683eca-8310-4d50-9c6a-7a0fbeac3c21	industria dei materiali da costruzione
7e524601-a6ff-4569-9c41-49da75f3b488	fornire una diagnosi osteopatica
7e62bfef-2d09-4614-b843-debba082c8af	codice della strada
7e759bf5-52c3-42bf-9dfd-87eeec76481e	aggiustare la macchina rotocalcografica
7e7562c5-d957-4042-ad9a-e66064b5210d	condurre lavoro sul campo
7e7acd2e-4ce5-4277-9851-f5e4b9e2ac86	valutare i banchi di pesce
7e77363e-1419-41c8-a937-d10159621beb	supervisionare il personale
7e799713-da1e-41f6-81f1-c39a19def699	illustrare ai clienti i menu dedicati ad eventi e occasioni speciali
7e88b52d-303f-4437-8cce-7a81d20e1e89	posizionare parti di carcasse in celle frigorifere
7e963692-2ce0-449d-a04e-bae3c2c86aff	eseguire attività di ricerca sulle infrastrutture aeroportuali
7e9e9f45-9faa-4a85-8f4c-d77b924ddd62	applicare l’aromaterapia
7e9727ea-e67d-47d1-9358-6fe5a33785da	utilizzare le tecnologie di sanità mobile e sanità elettronica
7ea85966-fe94-4022-ac2e-80596ad6b991	sviluppare la strategia di indagine
7e9fa226-73d5-4027-977b-ce3c60dc5a9c	resistere alle alte temperature
7ea9a458-7694-414c-9823-aed3338be8b5	rispettare lo scadenzario
7eafab05-3960-4067-8898-b277e039ed57	confrontare i prodotti assicurativi
7eb1399b-3375-4f24-b89d-8055d14a5364	normativa sui diritti d’autore
7eb229f8-c20f-4180-8177-9510a19fbde2	misurare la concentrazione della distillazione
7ebaa664-7efa-44f3-a856-ec07f1705712	stimolare l’immaginazione degli artisti
7ec1f9d1-c4ae-442e-9cce-62d80587e489	organizzare eventi musicali
7ec4fd02-69f1-46df-867c-af584213ff01	eseguire missioni di ricerca e salvataggio
7ed2a737-db41-4edc-8035-5d0334bee5ea	controllare forniture ottiche
7ed0a991-8026-460e-8556-5c4b311e9c2f	riparare i macchinari di termosaldatura
7ec88162-c314-4120-b950-51a3969da593	Python (programmazione informatica)
7ed66d52-f664-4d17-95cf-b0706a910648	fornire assistenza infermieristica per gli animali ricoverati
7ee0411f-cae5-4901-9d74-d5fec4e1b42d	modificare voci di dizionario
7ee30872-cda0-411e-9eba-f911052f5baa	ridurre i puntini
7ee14ed7-9f0b-461b-8c12-980b13765177	gestire le linee guida per gli utenti dell’archivio
7ee5b810-b69e-4163-b6f2-076d1cc42da1	tipi di trattamenti di aromaterapia
7eed023d-c7e8-41d6-b6ae-a4feb8d0489d	localizzare fossili
7ef58a97-28af-421c-ba66-2c6a39c284f1	ingegneria acustica
7f033f26-1576-46f0-a80f-a4c6980774a6	contabilità
7f03c490-ab5a-4ac9-8c53-0ef7d8ea5fbe	soddisfare le esigenze della comunità di destinazione con le proprie abilità
7f0b014d-74c5-4539-821f-029dee2dca73	progettare banchine
7f13fb2f-de22-43e8-9cdd-b0b724d66031	insegnare storia
7f15a014-a827-4c14-8ec0-844d82bd6eee	consigliare i clienti sulla preparazione di frutta e verdura
7f1725aa-9656-4366-933d-a06beb10b6b4	geologia
7f17e1ac-6f8b-447b-a665-c5d09e294b1e	consumo di acqua
7f17ec53-5bdc-4ae0-b011-107205687ca4	prevedere tendenze demografiche
7f17ff88-7615-4278-97fc-38305f82ce70	tagliare la moquette
7f236787-6f6e-424b-b653-3c37efc63eaa	eseguire la manutenzione su attrezzature e macchinari della gabbia
7f253ced-9b69-4b66-9e29-0f7b28ce916c	coordinare il catering
7f27f59c-04bc-49b1-a361-557ccfca5645	tipi di spazzole
7f2f2b85-ec0d-4d53-bd49-06b9cc4312bf	controllare l’attuazione del piano di studio
7f31cd89-f8ea-4d6a-a2ab-4b57eb544537	applicare tecniche di impaginazione e produzione di prodotti editoriali
7e8220a9-52ad-409f-b41d-37910676e5f1	gestire piani di calibrazione periodici
7e92ff2d-cda4-4a71-8688-8d0c7214d208	coordinare la ricerca forestale
7f36e2f6-27f6-40f7-b0e1-1bb3b5a32e13	estone
7f470d87-7942-4625-88e9-c6d4951a2545	ispezionare i canali di drenaggio
7f5839a9-c907-4acc-a3a1-879a52508b81	proteggere i clienti importanti
7f611f65-bf75-4d81-ad09-960763c2dc89	utilizzare strumenti manuali per la realizzazione di prodotti del tabacco
7f6b915f-1975-4b4f-9f56-831e0b3c8bd7	valutare le caratteristiche di qualità dei prodotti alimentari
7ede7022-7f16-4a19-9ecc-3519b9c6e874	controllare i biglietti in tutte le carrozze
7f73a157-8f7c-47ff-af75-9d7c4d0efa34	svolgere un audit tecnico in loco
7f75b5de-5f80-4e30-82cc-ef96e19fa930	riconoscere gli indicatori di uno studente dotato
7f773e92-5400-4962-a015-2217e967ee3b	rilevare le impronte digitali
7f78b520-8704-4916-ad12-d31f54ee9ea7	comunicare con gli inquilini
7f7b725b-6e2d-4213-9c12-0bdef2842eef	arredamenti d’ufficio
7f7e6d52-c1d1-4110-a05a-4566a3cce2cd	preparare le materie prime per la produzione di fibre sintetiche
7f959b09-ef0a-41b9-a743-b7b69251ff53	effettuare la manutenzione dei reattori nucleari
7f90022d-bd11-4522-b931-269038cb4fbc	monitorare i sensori fissi dei binari
7f07bbb2-5e58-4f85-9348-dd7da8304dce	meccanica delle biciclette
7f9a6c98-93e2-4f02-87df-582d4571f8cf	controllare la produzione del centro di incubazione
7fad4e18-ae79-4b86-9497-346f7a97eb34	studi cinematografici
7fade3c1-26e4-47ed-aa99-4a62dd034bb8	utilizzare tecniche di interrogazione
7fb7772f-9d22-45f1-94d6-b76f367a2877	esercitare l’autocontrollo
7fb874f0-0086-4507-ba3e-39746e15b162	interagire verbalmente in marathi
7fbb9283-05e5-4422-8613-51bcbba0410b	controllare i piani di foraggio del pascolo
7fb937c4-c657-4bc5-9835-5d85bf0d2b2d	rivedere le prime stesure di documenti effettuate dai responsabili
7fc26476-b49d-43da-b8d5-86cb4e5c6f46	procedure per spazzare in sicurezza le strade trafficate
7fc843df-f569-4158-92fa-5a9fc4bb52ab	calcolare le consegne di petrolio
7fc8dca5-4eec-4fe8-a4e7-d6f4d04e6f50	tagliare le piastrelle
7fd583eb-952c-47a7-b72e-650fea2a49d0	rivestire schede di circuiti stampati
7fc92f34-0a0f-440e-b2fd-36694b7d9e96	essere imparziali nei casi di mediazione
7fdf6b01-efd5-4bba-8414-659fb3d4b690	tipi di laser
7df44ca0-69d1-4786-b34b-0fe345034cd9	Microsoft Visual C++
7fe004a1-017e-4634-8266-efd41f80c604	installare le caldaie
7fe15545-d5dc-40e7-9eda-a1f52264b0c7	caricare in un computer le sequenze senza tagli
7fe274c8-0b28-4543-8bb0-3d8b139fa0fe	garantire il passaggio dalla postazione dotata di metal detector
7fe4bfb3-9f74-44e2-a119-1ab640b2556d	scrivere speakeraggi
7fe7700c-f2ad-4a6b-90bb-8d0b793b185f	prendersi cura delle esigenze fisiche di base dei bambini
7fe04264-4b97-41eb-b197-8e9a0b176ee5	trattare il legno
7ff219fd-484b-4244-b73e-a1df52e5b79d	utilizzare strumenti per la lavorazione dei metalli
7ff93808-06f2-4069-933b-e1d5f65fa258	effettuare la manutenzione ordinaria del veicolo
7fe9ddfa-9495-4dfc-9741-5cbc1bbba43b	fare sgomberare il bar all’orario di chiusura
7fffd0b6-60cd-4c2f-87af-511c85829f5e	tenere un archivio relativo alle motociclette
7ffa0e87-badc-4d62-87c8-4c7ceada81f7	interpretare i dati di distribuzione delle chiamate automatiche
800076b0-929e-44be-b6e9-57eff0b41690	processo di filtraggio
801139c4-e759-4c5b-8c29-9e92aace29c9	controllare la produzione dello stabilimento
80139b25-e154-401f-bba5-233e542bd325	prescrivere le lenti correttive
802bdc97-5be4-4b4b-92cd-92a863b30054	insegnare scienze politiche
802eec00-f7ee-4a3c-8dd6-d941af17bd09	applicare lubrificanti lucidanti
8034f19e-5c77-46a3-97f6-2be52ed86483	utilizzare i vassoi dell’incubatoio
8033a9fa-621f-4d2e-9a0c-5321272d21d6	eliminare le macchie
803dd017-b9ec-4e47-b7be-f81ad1cc97a6	svolgere le attività di sicurezza negli ospedali
7f3cf84c-5e15-49e1-af45-24b02b772b51	tecniche di riscossione debiti
803efc4a-f421-4580-91cd-2dd52277edc7	sviluppare i prodotti per il settore del turismo
80435d71-70b1-4c4c-b107-8ed24368dfd0	processi eseguiti con la burattatura
8048d7e3-c5be-4d3f-a4d4-64077ce75ed5	interpretare in lingua in occasione di trasmissioni dal vivo
7f4e1a9f-3bbb-4fb5-9cd6-c39b18a7948b	collaborare con gli esperti di attività estrattive
80576248-2887-4c67-bf3d-ee4420f62049	disaggregare il piano di produzione
805c3a98-e365-4d13-a382-addd0c1ec289	promuovere uno stile di vita sano
805addaa-257a-4b91-832f-788e79fd6e13	offrire consulenza sulla gestione del personale
80613341-ee87-4b4e-b59b-89498b802fd6	supervisionare i progetti di sviluppo immobiliare
80618932-dfdd-452d-bf2e-3bdb6ecc1e9f	controllo delle malattie delle piante
803fd175-03e6-44fb-ab79-97ee08d59043	AJAX
80644adc-a354-431b-88a9-461d186a084c	preparare i bilanci contabili di verifica
80645761-0006-4e76-aac9-110935c2c290	realizzare le teste dei fusti
80654b4a-9201-4eba-98c0-879e10d4d2ef	effettuare le ispezioni di garanzia della qualità sulle operazioni relative al carburante
807166bb-ecdc-472c-8898-ea9cd7e8132d	preparare le salse da utilizzare nelle pietanze
8071ff4c-3e91-41ba-a6ca-e1e0de01d64a	essiccare il tabacco con metodi flue-cured
80a099de-f073-4994-a7fd-72b2b1a9d8df	fare la notazione di danze diverse
80824f8b-5461-4d0a-9c51-1685d209fd79	aggiungere i componenti al computer
8096cd67-89e8-44ec-aeb6-30a0e3af9629	mercato dell’energia
80b3344f-a329-4fa5-8a37-6fb8d30350db	componenti per ponteggi
80b11409-321b-4fff-8604-22c21af5c244	gestire i programmi finanziati dal governo
80c80dad-a568-443b-8607-7ab944eb1454	assistere gli studenti con la loro tesi di laurea
80a6bfdd-8e98-4706-b1f1-5bd1f9025859	gestire la disponibilità del personale per ogni turno di gioco
80c786da-a722-4010-bd26-e0fd751e86ba	decidere il tipo e il livello di scorte
80cc3cc2-1b68-4d2c-9b71-954044c83689	monitorare la documentazione relativa alla produzione alimentare
80dbb4dc-1043-41c0-ae1d-f680520d8025	digitare documenti privi di errori
80cd4cd6-ff49-45cd-92d0-396c5d7367de	applicare le strategie di insegnamento di Freinet
80e4e5bb-0920-4b24-95b4-8099430b9b96	gestire la vendita degli spazi di stoccaggio delle merci
80edf856-8d02-45ea-8319-73b40c61dcd9	sistema elettrico dell’imbarcazione
80e82cc4-860b-4f5a-a4c0-2be10d705769	sviluppare un approccio artistico alla propria interpretazione
8109aa36-76a6-49f4-a165-6258c1c13547	utilizzare macchine pesatrici
80f32df5-f407-4ae4-a43e-f6c72769f08a	lavorare con un’ampia varietà di personalità
80fed5eb-56b3-4aab-add2-dfd7c4185ec9	rispettare le priorità di gestione per mantenere integri gasdotti, oleodotti e altre condotte
810ffca4-dd2e-4860-af0e-fb3e66fe75e1	pesare le spedizioni
813022d8-4b5f-4574-9060-d711f8986dc0	garantire la sicurezza delle specie minacciate d’estinzione e delle aree protette
812f210f-adcf-4796-9e51-da0acad7a887	organizzare seminari sulla ricerca di lavoro
8115231a-9878-41c8-a7e7-5c743bdffa40	reagire all’evoluzione nel settore della pesca
812eacb1-e641-4dfc-a914-74ab07669b3d	sabbiare la superficie
8131f760-0a0e-4566-93bb-5ed2c27d09ea	sviluppare sistemi di classificazione
81457347-db3e-4a0c-8be8-2e4e0ce4f23e	ricamare tessuti
7fafc801-5d3d-4eab-a36d-19f265b509f0	installare le termostufe
81371ba4-c7ab-4d9e-8136-70ecf7426adf	condurre le attività di ricerca nel settore dell’infermieristica
81497423-0eb5-4693-ae18-7ed341e58fc7	garantire la fertilità del suolo
8156a536-1a91-4c3e-9c25-b3027a7ce691	monitorare le tendenze sociologiche
814f0869-fdf6-4e74-870c-565919b2fd35	fondere metallo per gioielli
81628964-5523-4991-a484-e1710711a005	tipi di aeromobile
816aa488-d15a-46a1-901a-07c9b2e20654	materiali termici
81664f44-6f68-48e6-8294-c5c7a497a45c	preparare le tabelle di marcia per i progetti di sviluppo dei gasdotti
8173e2a9-4af0-4e60-8f57-85ed6e985373	fermentazione in scala di laboratorio
8177ea7b-8b11-4de2-9671-227a4de6f66b	prodotti di cristalleria
81774437-4a9e-44f8-a279-3206f13b5b9c	disegnare schizzi per sviluppare articoli tessili
81863262-bcaf-4d05-9401-b67ae012c67f	effettuare gli esami obiettivi
81906034-24de-4076-b769-7342fbc1445d	installare hardware per il legno
818ca0c1-ea25-4fcb-9e40-64d2a7053939	manipolare il rame
817b0b71-573b-40c7-8bb5-7e05cc5edf97	effettuare la manutenzione dello spazio di lavoro
819e38ee-6de4-4e06-94a9-934022aef687	guide di stile per la redazione
8192671d-7c0d-4326-9790-2d177fcf75c8	strategia in materia di sicurezza delle informazioni
818a5ebd-b2a9-49f1-ba6b-92230dc2b833	valutare informazioni
81a7a9ef-c116-4e7b-8807-f242bcaef13d	operare un adattamento culturale del testo
81aa0e16-05b2-4651-bad6-71e1b2e6c7a8	montare componenti ottici nei quadranti
81ad6bf6-5530-43d0-aa2f-2971ec144216	definire la politica di credito
81abad10-3f99-43b9-ae2d-224af07d911d	sostenere il personale infermieristico
81b3506c-833c-466b-9195-540506545f2a	prevenire i problemi tecnici delle attrezzature di scena
81b02e4b-c508-4108-a411-8bca6f781fbe	condurre lo sviluppo tecnologico di un’organizzazione
81be37c7-1090-45fd-8753-2fd3ea32dda4	supervisionare lo sviluppo di software
81b9f82e-5337-409f-8121-8c72a24bc164	gestire le attività in modo indipendente
81c1d5ee-3a28-4cfd-87d7-c7da4f014b84	tagliare i rami secchi degli alberi
81d075d6-b992-4b4a-90e3-55ac7c493b28	teorie di musicoterapia
81ccc3ab-bf23-4fbd-b2a3-6a1823de5c82	elettromagnetismo
81ddd16d-7b5e-414d-82ba-d5f46ca6315f	azionare attrezzature per la produzione di vernice
81e6dbb3-17c5-43db-9d31-2e373a85b90f	operazioni in coperta
81bf00c0-8583-4d52-a4fb-07ca154f0141	elaborare piani delle attività di marketing per il settore calzaturiero e della pelletteria
81f2a4cf-632d-45a6-9d7f-d1658087374b	sorvegliare i miscelatori di fertilizzante
81fbd9af-11e4-4024-bdb0-8932c54ac53b	coibentare un edificio
82002487-6d6d-4e1a-994b-005a33bc3c1e	metodi di consulenza
82059190-ace6-4fd4-ae64-0273929c6174	eseguire i calcoli di navigazione
8219f5bf-44d1-45c8-a383-0b194b8fa190	pulire parti del corpo di animali
821f6b75-109d-48a8-bf73-d48e72af92ad	microassiemaggio
8216bdd0-e9d9-4ff7-bd9a-b03bab1b66f6	garantire la disponibilità delle attrezzature
8225eb3c-9b5e-4730-b0dd-8c3e1476b2ee	modellare i depositi di minerali
822b024e-b2f9-4f8e-9b07-3b0a18b06186	lavorare con basi di mistella
822bb13d-8c77-4868-b8b0-ae84f862a830	utilizzare un sistema di estrazione (LHD)
822c8136-0c26-43dd-adff-4d127322bfdb	stimare il tasso di occupazione delle camere d’albergo
8233d2a4-3e75-4be1-bfda-62eecefb2ef0	prelevare i campioni durante un’autopsia
82461287-fe37-400a-9dd2-fc4fd793c940	applicare metodi di tostatura diversi
823b362a-34a4-431d-b1bd-3de8332c4849	sviluppare banche dati terminologiche
82549d58-25e2-4d4a-ae3b-5c9df9f8fb97	redigere volantini
82671b71-b2f6-42c6-a82b-56807172be89	gallese
8269baab-863a-46f8-b418-a2a39d84dc13	testare i prodotti cosmetici
8232488e-49b2-44d0-9f71-c2dff989cb2d	pulire il motore del veicolo
826ea5a5-e1bb-4f8c-ab84-34224c57ef5c	allenare artisti per l’esibizione nella propria disciplina di combattimento
82703365-b79f-4a5e-8e78-e2b60f8ca79d	fornire consulenza in materia di produzione di birra
82736962-9de0-4010-b79f-a4716a5c4d36	malattie dell’apparato cardiovascolare
827c6e61-b2a3-47ce-b402-1dc40fc7356b	azionare le apparecchiature di controllo del sistema tranviario
827df3b8-f704-4d7d-9ee3-dd637b57fa09	consultare le tariffe di spedizione
82855cd1-2366-4eb9-9b91-c8b3a3de1a3d	essere addetto a filatoi a doppia torsione
8285703f-1d8f-419c-9208-9e92c9a29f69	installare la segnaletica stradale temporanea
82955041-3381-49d3-ad76-2f5587b51d61	metodi di laboratorio nelle scienze biomediche
829a42af-9b57-4615-b2e2-7d282fb582e4	fornire le cure palliative
829f1bcf-f79a-4286-a06a-03b1a0b4ac34	offrire consulenza ai clienti sulla conservazione dei prodotti a base di carne
82a1efb7-1750-4db9-820b-5eb04c0e6329	animare forme organiche 3D
82b0cc8b-637a-4048-9592-b7cc36e8287b	dirigere le attività artistiche
82aba9cd-e74c-40a1-bc85-77c8a7847c5f	sviluppare avvisi sulla sicurezza TIC
82b57fc8-9266-43e1-8f2c-adbbb9ddbd1f	conservare un inventario di laboratori degli alimenti
82b59772-2152-40e3-bc32-a7f7e7cb9e9e	preparare le relazioni sulla situazione creditizia
82bed4e7-c07f-4a92-8808-c493798311b0	lessicografia pratica
82c24e46-02d3-4062-af0e-a6d7adeb7e8e	elaborare i dati dei rilevamenti raccolti
82c39c6c-6a78-4119-a6a0-aaf9ce38d4c5	calcolare i preventivi per i servizi riguardanti i dispositivi di sicurezza
82cef1ec-4d1f-48eb-869a-fab2148e28e6	manipolare la plastica
82d20020-1f0b-4e6c-bb2e-4ebb13f69a52	creare prototipi di soluzioni user experience
82d669ac-0f2b-426a-bba6-3affe56011d3	energia idroelettrica
82d599f1-e345-4c34-b2af-a9e450b2db5e	studiare immagini dei radar
82d79d5d-cf31-44a6-83eb-2317f72800d7	idraulica
82d8d20b-283a-403b-af55-420dedd4afea	moralità
82f7f57c-072d-44e5-80ee-7960546c03bd	forme di sostegno psicosociale
82f8f313-aad7-4272-a0de-309cde89077b	supervisionare il personale del casinò
82fdf59a-a5d3-4491-b0fd-60bdcece828a	tenere un archivio delle consegne di merce
830d0514-f231-47a2-8530-a471861df7ca	risorse turistiche di una destinazione da sviluppare
830f3341-7ae4-430a-93a4-ba1404b99309	progettare le attrezzature per l’erogazione di servizi di pubblica utilità
83030e6c-317c-4bf5-b256-9c39d2c1904a	fornire assistenza ai passeggeri
8317bdd9-75d7-4e19-b1a2-cd559f51d01e	sorvegliare l’impianto di aria riscaldata
83181132-3f64-4d06-b2db-13b15630339a	usare tecniche tradizionali di fabbricazione dei tappeti
831815b4-d68a-4427-b9b5-4bfd356ad852	coltivazione del luppolo
8325c256-3314-4e9f-83bb-97fb10bb112a	scrivere in ceco
832cad08-d016-405c-a9e1-b452b14a051c	somministrare gli anestetici ai pazienti
82030a1e-47f1-46d6-a794-e9acc527a838	Taleo
8330677f-2d2a-4c78-9c45-904567b0af3a	mescolare gli ingredienti con il lattice
8334c849-8c97-4238-98e3-0e45487415ae	tipi di condotta
833abe30-5f17-4088-9a0a-2fe8fbc31d82	metodi di asciugatura del legname
833d4f0f-0034-461d-bb25-23a246a70d57	conservare i campioni di pesce per la diagnosi
833ec809-3587-4bde-b553-99dbccb484a0	utilizzare materiali sostitutivi
833f3b5e-d87e-4db0-86e3-fecbe28cf85d	processo di fermentazione del vino
833b058f-4712-49e0-98df-98272717daab	fornire supporto agli assistiti affinché diventino autonomi nelle attività quotidiane
833fbb37-ef45-4cc8-af81-91bf3be55c94	effettuare la manutenzione delle cromature di un’imbarcazione
8350271c-203d-4f73-9c10-8c2c3cc124d5	identificare le proprietà nutrizionali degli alimenti
8353ac23-4ba1-4c85-b42f-a89399eb5cfb	tipi di lame da taglio
82688179-da12-4eaf-9135-021c27ae45ea	tecniche di corrispondenza incrociata per le trasfusioni di sangue
83420160-87b9-4179-bf57-698e234eb955	gestire le attività di promozione della salute
835e7ea3-9944-4cf8-a86c-77fa3fea65e5	controllare regolarmente le attrezzature di sostegno
83803dd9-01e8-4925-b068-7706857c699a	eseguire le attività di controllo delle malattie e degli organismi nocivi
836ceae4-cb53-4d8e-b385-5b7a49d961dd	psicologia dello sviluppo
83729a27-0215-49a1-8dc3-7b197653d1cf	pianificare i turni dei dipendenti
838e65e3-35ce-4458-9e9d-0e3bb678ff1f	eseguire l’analisi dei dati
83a9582c-2271-4552-9e1d-9dbc8f43e3a8	comprendere il maltese scritto
83b8c9cc-1388-4677-89b2-9dbdf8d6062f	etichettare componenti
83a949ee-0569-4077-b292-19e61590e015	valutare le attività all’aperto
83c0a668-91dc-4633-a33c-35a83c0e914a	cinetica
83c40e47-146f-4c9c-a84a-d23f9aed7f3d	fisica delle radiazioni nell’assistenza sanitaria
83cad197-27f2-4129-916e-89769bcfc4da	riempire le vasche di miscelazione
83cdadcb-3f58-45e7-819e-f0610e61d386	redigere le procedure contabili
83ce4cc8-8971-462b-98bb-7b809c5eae6a	riflettere criticamente sui processi di produzione artistica
83d5f2b3-6b13-49f7-a030-9bcd6686d996	scienza alimentare
83e48aac-9c12-4817-82a1-de9bab2ed3ce	applicare metodi e tecniche di musicoterapia diversi
83e5dba4-8351-40bf-9534-13816bdd3101	pattinaggio su ghiaccio
83e71e1d-b043-45fd-9193-4c896e150949	effettuare una visita neurologica
83e734ad-fdc7-4890-9d7f-33fe465eba3a	medicina complementare e alternativa
83e8e1a9-2e6a-45d6-97dc-b41e8f0272da	istruire gli animali per fini terapeutici
83e8f378-e4ad-45a2-aeb6-c012add6a731	saper utilizzare la gomma per la ricostruzione degli pneumatici
82c3f881-6476-4485-8980-1b604ab8e744	coordinare le attività delle parti interessate volte a promuovere la destinazione
83eea1dc-3412-41bf-ab5d-f2fff4c7f6e7	macerazione di prodotti ortofrutticoli
83edea3e-cebf-432a-a42f-b4b59b54b43e	analizzare i sondaggi del servizio clienti
83f801f8-ffcc-483d-b325-4ae0d29f959e	studiare gli spartiti musicali
83f4a3d7-e6a8-4078-b183-fe4a27aed6e5	utilizzare un escavatore da dragaggio
840fe010-84b2-4ada-90b9-162f52541818	prezzo consigliato dal fabbricante
840c7df5-1027-4802-a1af-e3f2d6f769f9	azionare il vibroinfissore per pali
84123f7d-99cd-4efa-8cea-143277309f02	principi contabili nazionali generalmente accettati
8418e179-90a1-4d63-bfff-3bbc73322dff	prestare assistenza relativa ai macchinari della nave
8419fa75-f096-4d1a-8a52-8c2c86e78e10	saldare componenti su un circuito elettronico
842416b7-e148-4302-9889-d008e639f2bb	calibrare strumenti elettronici
84243135-39e4-404e-a201-3610d2d8646c	creare disegni originali
842516b0-a475-4bbc-953e-de13dd16f322	lavorare in gruppi multidisciplinari legati alla cure di emergenza
8425f206-db48-4b48-8ea6-077708373273	elaborare glossari tecnici
84282fdd-e49d-4327-abb8-fdfc24ef0b39	tecniche di combattimento militare
843975e8-f26f-4390-bbc3-c9a9557c8b72	attrezzature di illuminazione aeroportuale
843f3ebd-f34c-4b97-a89a-dd2d1454e7f9	registrare materiali audio
8443aa7f-e969-4864-afc0-68c7a79eedd8	collaborare allo sviluppo di strategie di marketing
844a6742-5b58-4e59-b5e8-03e33b44bfbf	tolettare gli animali
844f0bd8-7f13-4bea-94a1-5cca21b1ddf8	preparare i pezzi per l’incisione con acquaforte
843db1d4-8f94-4059-a118-75899dc7604b	pesare la frutta e la verdura
831dfac9-9900-4b28-9f55-8a39fbbf46ca	condurre indagini sul rimboschimento
84561b2d-b62d-46d0-895f-6b602bd550b1	costruire modelli predittivi
8459b414-d84e-42e1-b9a4-51a5277cbda7	seguire le notizie
84533f36-8356-4d79-8dab-4575ab00072b	gestire macchine di virtualizzazione TIC
84668a20-9bb1-4e4d-8327-8bfc6c0262bc	insegnare i principi delle arti applicate
8462a68d-f612-4e88-ae63-8612a5607fdb	riassemblare i motori
8471d4cc-e052-4a93-9b46-d944d69b4a6d	comprendere i limiti di bilancio
8466b0bf-e9c7-4a0f-b03b-eb9d8f4cff95	stabilire obiettivi di trasporto
846aa1e9-d733-4e5e-824b-54ae4a27bf84	garantire la qualità delle foglie di tabacco
8473a700-4dc6-4c25-ac4d-0361bb736cb3	scrivere le relazioni sui rischi
848a3529-1efc-48a8-84f1-34ac89500360	sorvegliare la fornace da calce
848707e6-48d5-4816-871f-df443df073e3	insegnare le procedure dell’aereo all’equipaggio
848d59cd-491f-4847-ab04-6108a75f93c1	analizzare i commenti di selezionate tipologie di pubblico
849c34dc-4f83-4099-a6c9-81fcd632578f	tipi di processi di rettifica cilindrica
849c64d6-fba1-4d3f-bf5c-aaba173f7708	spruzzare i pannelli di prova
847d6809-4242-4d30-ae2e-6d24b6e95685	THC Hydra
84b42e43-5b1c-4272-9425-cff49057756b	evitare la contaminazione
83952ce7-1c13-4047-9d3b-36f10e27bac3	cucire le segnature
84a5e56d-ca7c-49bc-b08b-22dd27ebbe21	sostenere le persone durante i cambiamenti di nutrizione
84a45c82-7829-4b05-8980-69af06f2cec3	lavorare in maniera organizzata
84b579c9-85bb-47ad-af71-3878e478da37	storia della moda
84c4c58c-d486-459b-98d2-3293902f1f02	preparare le dosi di un farmaco in base alle esigenze del paziente
84ba0cd0-d483-4c3c-bb58-3ed9439e0cdf	ordinare i veicoli
84ba03a4-ad97-43c3-9c58-d9521cb80604	uso legale della forza
84c7fc34-a8ba-47df-b69c-22459621074f	principi di intelligenza artificiale
84c91578-aa6e-40ac-8987-3784955fdd89	eseguire prove di penetrazione di liquidi
84ccc097-4342-4527-b3d4-1155f603bbd3	telugu
84c8ffc2-34e5-4bfc-abde-e9efd9c4ed32	software di trasporto relativo a un sistema ERP
84d24081-1bc4-4300-8418-33d742af5cd2	eseguire le attività postvendita
84e0b4be-c3f4-4d0b-ba90-61b1e9e82837	gesti delle mani
84d89651-ea43-46b1-a8de-fdb2a15e3a31	fare ricerca scientifica
84e5110f-5359-474a-8b0c-c25493291594	occuparsi della gestione delle identità nei sistemi TIC
84e13990-5384-45c4-ad58-1856a3299b8e	studiare le fonti dei mezzi di comunicazione
84f55875-8aa1-4ea1-a233-6ad7be671b50	effettuare la manutenzione degli impianti di allarme antincendio
84f9aeed-c9ea-4fe3-b0b1-46bb3f3be440	scaricare le miscele
84fbd394-afc8-473e-96a3-1d7f3819f94a	classificazione dei medicinali
84fcebc0-9788-46f5-9540-227abaa803c0	comprendere il telugu scritto
85014d2b-4083-473a-9772-2f4b76c2a3e2	realizzare creazioni alimentari artistiche
8510b205-48bb-422b-83f9-c9e69faa6bf9	imposte catastali
850842f8-1a98-457d-a4a6-0314402217aa	fornire i servizi sociali in comunità culturali diverse
8517e952-bdb2-4992-94af-6cbe50cc1b7f	tenere traccia dei siti di spedizione
851b2799-a498-4d46-b4e6-01bc53486624	saldatura di elementi in plastica
852a58e8-4dbe-4b16-85f5-c658727e626f	offerte del mercato del lavoro
852dd048-9057-4baa-a622-551584909080	impatto dei fattori meteorologici sulle attività minerarie
8534bf38-7311-407e-8277-b4c29ad9c6de	sistemi di assistenza visiva negli aeroporti
852efe11-e2de-4be8-a187-8dd3dde0b105	determinare l’affidamento di un minore
8535b332-2d61-4445-bc27-518bf107cdf6	gestire le scorte di legname
853b14d1-a1a6-42fc-962b-acf6c9bdf1c9	applicare la configurazione del protocollo internet
85421f6f-b5f4-4d4b-b310-c9a9cb038447	raccogliere i dati relativi agli assistiti in cura
854ba271-65d7-4345-b53f-c43357c69342	responsabilizzare le persone, le famiglie e i gruppi
848b94fb-0ea6-4d3a-913e-dba967173312	stabilire una rete educativa
8556168d-f71f-4cde-9070-727b84018f19	selezionare i cantanti
855cdb51-7833-4362-a2b6-23f6ad632865	condurre una ricerca quantitativa
84cd6c53-86b8-40ba-92a4-6d10b9d0b4b0	pianificare lo stoccaggio di prodotti
8562a8c0-5064-4323-be8f-5a30271ee863	collaborare con gli ingegneri incaricati di effettuare le prove presso i pozzi
85642843-d056-42f9-8ad1-e0cdb485967e	lucidare le protesi dentarie
84d6079f-6910-4b8d-9350-0eb86dd787b5	eseguire un giro di prova
85671c39-3553-42a9-9c08-f84f839d8f7c	effettuare la manutenzione delle attrezzature di gestione del tappeto erboso
856f4ef0-7f3e-4141-8918-072675e3807e	identificare il cliente
856f7d21-bbee-435c-afa4-d5a53ad51b8c	gestire le risorse in studio
85726667-b061-4aa9-bbbb-9ce8451c2a04	pianificare la produzione
85707bbc-7e09-4fa4-a90d-9cd08d50514c	mettere insieme un gruppo artistico
85766fc6-8b5f-489e-a5c4-b45eb0aec5fe	recitare il dialogo del copione
8586c201-5889-4175-975b-b70de1b9bfe3	dimostrare i fondamenti tecnici degli strumenti musicali
8584ef89-b745-4e20-a69b-fbb5d2992267	testare i prodotti medicinali
8589659d-c24f-4036-9210-6813a1dd0880	rispettare le porzioni standard
858ae0c4-ddda-48b5-9738-02bd1826c5ad	sviluppare i sistemi di classificazione delle professioni
8592c6b1-5eb2-4591-a963-2ef7d05afc1c	installare i serbatoi d’acqua
8594a1dc-91d9-47ea-977d-b0a01dafad04	organizzare una mostra
85a12d46-230d-4e39-a34c-d0ef99887a80	azionare le attrezzature per la purificazione dell’acqua
8541119f-3910-46ba-9e98-caca8fe3037c	cesellare il foro filettato
85affb9c-0709-4d2d-b936-49af47b3e055	manipolare il legno
85a65366-01de-4f15-8b33-4ecb872b57df	monitorare il mercato obbligazionario
85b1c52b-3912-47de-91c9-6035a64cd437	compilare il diario di lavorazione
854ebb26-7b98-486e-95a6-959a8ffb944d	legge quadro del settore ferroviario
85b860e8-1dda-45ea-a492-78c04b7b88a0	esame della rifrazione oculare
85be065c-6a2b-4851-a7e6-5272dba88d73	tipi di terme
85c1aa43-99b0-43f4-b79e-9497d71f5223	dischi in vinile
85c52cba-9f03-43c0-a0fc-50d240f4c724	rispettare i formati di pubblicazione
85c5b62e-f409-472c-9d6a-0720ce83d041	interagire verbalmente in croato
85cce2e1-8eb3-4666-a3be-c95ae8605c01	azionare gli impianti di cremazione
85cf1c14-c5de-4967-ba8c-e50336a51565	usare session border controller
85d0f137-ea3e-4ab8-8156-f8aafefe21f8	insegnare la tecnica della traduzione
85cf8247-39dd-4a9b-bf45-2e8058e0a286	negoziare il prezzo degli oggetti d’antiquariato
85da2db0-2016-4a65-9a51-639bdba92ffa	comprendere il gallese parlato
85d2b107-3dd3-4686-8feb-99e9e6a50440	supervisionare il controllo di qualità delle giacenze
85df7c7b-0bcc-4f4f-878b-32f1497fcfab	prendersi cura dei cavalli
85dc7cc6-5582-4b5c-92ff-cd2d112798ba	costituzione chimica delle mele
855dc719-b3f7-4aed-afc4-c3b5e2ab79b9	gestire i resoconti sulle buste paga
85ea1308-5d4f-4755-9e96-61ffb4b598f0	alimentare l’impastatrice di fertilizzanti
85f0af74-5ed0-4021-8fc5-3381e8afed34	preparare le ordinazioni relativi a cibi e bevande
85f3f551-8bb4-40d1-bd76-64e537d3beec	prevenire l’asciugatura prematura
85f3eee8-6946-4d7d-8a59-d0a9037c5e01	garantire la manutenzione dell’attrezzatura
85fb7252-c64c-4932-ac4a-b4a836f91987	assicurare la continuità delle acconciature degli artisti
85fb7ead-306d-428d-8ee3-0b4e69044ee5	mantenere un archivio del centro di incubazione
86017b74-71be-4883-a583-374acf6cfded	coprire con il tetto di paglia
860642c0-230f-4338-ab1c-bd7846776bf9	fornire assistenza nelle procedure veterinarie generali
860b563f-251f-4c2f-a115-d10a14862ced	programmare firmware
860ce5b6-ef13-425e-bd30-7401256e7a4a	presentare una mostra
8610cc34-78d6-46ed-992a-e4f197d333cf	utilizzare apparecchiature di assemblaggio ottico
8604f31a-b670-4e92-adf2-e69918b20096	Metasploit
86112f4b-d280-48f9-83f8-50efb7722050	riparare l’impianto di ventilazione
8611a1da-2c5e-4b2c-9316-f55aaf5e2816	individuare gli abusi di droghe e di alcool
8612fd4e-a008-4305-918f-f018204e2e16	aiutare i clienti con problemi tricologici
862dc3d1-3598-40d0-a1e4-f880b568d4dc	creare uno schema dell’impianto elettrico
8633ce92-da14-46d4-8f49-13d4cf415baf	usare le tecniche di guida avanzate
862de2a7-5bee-4745-ba1f-7183b0009daa	garantire l’utilizzo efficiente dello spazio di magazzino
863879bb-a270-4210-b729-7238c3128587	eseguire un’endoscopia
86341150-6396-4b81-88bb-d408b8bbfc2a	dirigere i progetti di assetto paesaggistico architetturale
858fcc95-76b9-4c4a-912c-a08296a03504	prodotti ittici, crostacei e molluschi
8638f1ad-4e58-4106-8915-3f25e549d7dd	mantenere la riservatezza dei dati degli assistiti
8643616b-b27d-444f-83cd-0174d74f8af5	prodotti lattiero-caseari e olio commestibile
86485c1e-6a06-49fc-95e3-1c0990192b87	preparare il documento di autorizzazione alle operazioni di volo
864643ad-2235-4c1a-81b1-a96c70021be7	verificare le autorizzazioni dei piani di costruzione
864f7b59-c19e-47f9-9445-bb067b8a7fb5	installare sistemi idraulici
86510bf6-46f5-4ef0-b8ee-f460ad624279	fornire consulenza sulle procedure di fallimento
8663e61b-430d-43c7-9ae8-d93a8090dad7	tagliare prodotti metallici
8655ba57-0c53-4903-b70c-d410a1aad30a	effettuare la manutenzione delle attrezzature di allevamento
86680875-40f3-45dd-b7c7-2775e936a6f9	assistenza infermieristica veterinaria per animali ospedalizzati
8676b9e3-43ec-4e67-bbd8-064298c5106b	processi di taglio manuale per la pelle
866e69d8-6569-4f51-bb60-a1d9fb8b2bf6	usare il software CADD
86733d95-eca5-45d7-84a8-f8823fdeeed4	tenere un archivio delle giacenze
85b49a19-dc78-4b31-99f4-00f9a530631e	filo di guarnizione
868b28b1-452b-45bd-b518-8f402e660517	azionare gli estintori
86899f22-ef5a-4b7c-8108-4636a18678b3	sciogliere la cera
8679e4c2-ee50-48ae-974b-8b6f0c6eab20	comunicare utilizzando il sistema globale di soccorso e sicurezza in mare
868f453d-5f98-4806-a1df-6653989a919e	Engrade
8691e06c-f10d-4057-8e7b-da1eac764466	installare le stufe a gas
869cc9b1-6e6d-4617-be73-2e917d691609	comprendere il cinese parlato
86a007de-2dda-43d2-a15e-1eca18d9a3b5	fornire i servizi radio nelle emergenze
869bf204-f5ea-431a-a498-da663108e5d9	amministrare sistemi TIC
86a40f8a-29d9-4080-8896-01bf2e2e1f39	progettare dispositivi di sicurezza
86a753a9-d99d-4f70-a269-c214e91b8ff3	sviluppare le politiche di postvendita
86b69cde-7f96-4b1d-b684-11ba51da1517	scrivere le istruzioni di emergenza per la movimentazione di merci pericolose
86a3c8a0-1de5-4627-958d-2e66d622d009	tipi di elettronica
86c1127b-6211-40d0-9cf0-7bab589ae49c	elaborare le prenotazioni
86c41439-6944-4cb2-9bd8-acd9dc1ab44e	fabbricare filati di base
86c0c83e-6d2f-4a38-94cf-1912128d6c64	supervisionare i visitatori speciali
86be0315-96d0-40e9-ba0d-069dd00f6b50	creare personaggi 3D
86c8c052-c16b-4cf4-a4e4-40d16ab025f1	lavorare da ponteggi mobili sospesi
85daf0a5-a06e-4264-abbc-1af857a6b577	organizzare il deposito delle merci
86c4998d-8037-4184-95a8-a19318e3a64e	responsabilità sociale delle imprese
86cb5722-4a96-442c-9f1f-fdd16e106fc4	macchinari
86d12dc5-ade8-46e3-a0c7-bfc1c9897616	ispezionare gli impianti per eventi
86d3e48c-af40-4066-9d52-e2fe77dc04d2	manutenere il sistema di sospensioni
86e66f62-683e-429c-9a02-e6af75ac3e15	posare la copertura a manto impermeabile continua
86e83192-5f83-4653-a883-5cf43af825f7	effettuare la manutenzione delle attrezzature di giardinaggio
86e2653a-22ae-4437-b5c2-1c0f6ec58ba6	realizzare a mano intonacature ornamentali
86e9062f-081e-45d4-9166-31e01d81a39c	comunicare aspetti commerciali e tecnici in lingua straniera
86f55094-34d4-4b0e-b020-758b7f82ccbf	scalare le copie
86ed7427-dbc2-4c3b-a3da-ebcd54b34ed7	applicare le procedure di radioprotezione
86f5bb13-5a8f-4c18-aebe-1a3ec8bf79eb	sovrintendere alla stampa di pubblicazioni turistiche
86f86622-7f09-4bfa-b426-06d8372a6803	componenti robotici
870f1ab6-33be-44f7-a62c-7a5f47f4132b	effettuare le prove su strada
871718b2-c6d1-46e9-94cf-b40b4e807f6a	effettuare una valutazione psicologica
85fb7915-ed83-4d22-b779-c8db708f2e59	parlare lingue diverse
870c9d15-fc84-4aa1-98f9-0c8d2478d5fa	riferire sulle sovvenzioni
87232d42-5c82-41f8-a7f2-987e9dd0b992	pianificare
8729beb4-c4b3-4f84-8aa2-748b7ae82797	tecnologie di sabbiatura
87313e0b-8f8a-439c-8acb-6efca9d38a0a	processi di isomerizzazione di idrocarburi
87314388-8a80-4dac-896c-628f6adbbf9d	regole del volo a vista
87240e98-3fa4-4452-a084-f0739ef8ee59	effettuare la revisione dei conti
87332f29-44b0-447e-9dee-9f043c3aec7c	preparare il terreno
873bb7b6-6463-423c-8844-617ea82d52ed	lavorare con i realizzatori di oggetti di scena
87455bd4-ed6e-46f2-a2f3-d483924f5380	tingere candele
873bd386-3e14-4484-ad6f-2924f60f717b	utilizzare tecniche di cottura
874deac6-5484-40c1-83ef-7488c199b850	processo dei semi oleaginosi
874f66a2-af49-47c7-a490-ff5e8f3561be	temperare il cioccolato
874cfa17-990e-4e7a-af04-7abc016223e5	ricercare siti di lancio satellitare
875c1554-f341-431a-a7c9-aa663431bf36	progettare sistemi elettromeccanici
877dc97c-bc00-4387-bee9-255dd636541d	gestire il centro di controllo elettronico integrato nel treno
875e890f-0620-4cc6-8e27-c3498e42f81d	effettuare la manutenzione delle strutture per l’edilizia
877df1d7-a5b7-4a59-98ce-fe4590afeb5b	contribuire all’istruzione in medicina
8762f6e2-0dae-4efa-80b8-3a1d5b767e22	usare centrifughe
877b1702-c4d0-4acd-bb79-ad4585b22162	scrivere gli spartiti musicali
8788b778-fc8b-400d-bfcf-243774c2a39c	risistemare il mobilio
87824a57-f5ec-4021-b453-c60fea085d02	neurofisiologia clinica
8786379a-a77c-412e-860d-1f57be78be0f	negoziare la vendita di beni di base
879c13ab-1605-4444-8f91-5b45d552f864	individuare le violazioni della politica
879514b7-791f-473f-b2ce-edfdc1e26c09	addestrare i cani
87a628a1-4b71-41d2-875d-667bccce08f0	attrezzature per l’acquacoltura
87ac274c-1fb7-49c9-86c0-2131874e854a	produzione di attrezzature sportive
87b7a800-1e5c-4f67-a7b4-38ce3da73a7f	comprendere il curdo scritto
87c272ff-f252-4f43-9324-f1fa0130e8ab	garantire efficienza in termini di costi nella produzione alimentare
87c5ac60-627c-427f-978e-97d46eb21734	imbottiture per tappezzeria
87c89ecd-1ac9-4d9e-b1cb-57735480c521	applicare le pratiche antioppressive
87d0055e-a1f3-49b7-82b4-e2b16478e4a5	nanotecnologia
87d08014-c44e-4c5f-b3f1-78fffc6563aa	vendere i pavimenti e i rivestimenti
86d3f3c5-4b3d-4939-8672-7d61ca9cf0f1	assicurare il rispetto delle specifiche di progettazione dei gioielli
87e287df-2ecf-4a65-9285-7d457af6364e	riempire la macchina per la trasformazione della gomma
87e9c581-1922-437a-98da-50f5267c1948	utilizzare sistemi di gestione termica
871f7c94-5b3e-4a6f-9ed2-4e508c25a1ad	valutare lo spettacolo nel suo complesso
87e9f1a1-87dc-4592-8497-4ef757090871	contenuto delle direttive di aeronavigabilità
87f925be-a9c8-4976-8488-7c4900ad7b37	sistemi di dati dell’assistenza sanitaria
87f10995-f40f-4ce0-af2a-df9d56e2e291	rispettare il tempo previsto in base alla profondità dell’immersione
8800d9aa-1088-41ff-b91a-4ed6228958aa	produrre componenti di violini
88078175-cba9-4ce7-9455-c15837712f34	definire gli obiettivi di salute
8800edee-e9ea-4e5e-a89f-64bccefa9d39	effettuare la manutenzione dei motori elettrici
8809a74c-a81b-4df5-9dbb-5684015592df	stabilire una comunicazione con culture straniere
87823af5-8286-40be-ba3d-cfc2a7f4c7cb	formare gli spazzacamini
88152898-4937-45d4-b488-79b93ff40271	ricercare nuovi metodi di cottura
881658e4-ed76-4f2f-bee1-af7f5634390a	consumo di gas
88166019-6a95-4c17-8089-70f8f27cad80	comprendere l’arabo parlato
8791fd09-cfc5-4ed9-9ccd-92596b7216d9	garantire la sicurezza delle informazioni
88190a78-2e4d-4e36-b888-584a636e6bd5	promuovere un corso di istruzione
88228401-4d67-4331-9a7d-739e4f9977b6	caratteristiche dei prodotti
881b5140-a962-4cd0-9646-f3b91b9f53c9	addestrare gli artisti nei movimenti in sospensione
88302bb8-5fb5-409e-9551-5e2773a04cf6	sostenere i fruitori dei servizi sociali a vivere a casa
882f0ce6-543c-47c4-92a9-16ac860a4027	gestire il personale di sicurezza
88303e36-a4d6-4c27-8fd4-61accfc11f8a	interrogare le persone
8836b25e-9111-472b-ba23-112e20f3570b	gestire le operazioni della lotteria
87c1b36b-bcbf-4c9a-b66b-d4a1d16de605	Effettuare l’esportazione di prodotti di base
88347167-aea6-4567-886e-dd151531e262	fornire assistenza ai pazienti nella riabilitazione
88418c69-280c-4109-9cd1-a7d7ed7544ef	operazioni di magazzinaggio
884a2db7-fcae-4373-bd9f-bd9505a022c2	scrivere in montenegrino
884a65d2-b0e1-4119-a20c-87daeafb640c	GameSalad
884d1517-a352-4099-9a3b-2c9a3a490ec9	vendere i tessuti
88595122-2f3a-47ed-8cdb-bc3a9f565fa6	organizzare la restituzione delle auto a noleggio
885ce34e-a833-4e89-8bef-5941399b797a	monitorare le attività di un evento
8859999d-1fcb-4983-b086-3216628ec005	applicare le regole di grammatica e ortografia
885da7db-4e7f-484a-9822-c8822992db14	preparare le relazioni sulle ricerche di mercato
885e1a53-da97-4366-87ef-403fb2d562e2	gestire il ciclo di acquisto
88650c54-e072-4024-a089-8db4dc003fd8	aggiungere profumo
8865ad32-ad2c-4dce-8e72-01489c4f800c	restaurare le armi da fuoco vecchie
88710f3f-ce9b-4633-8d86-6a723c496a7f	gestire le forniture
8874cc38-1ee2-4d6e-9e63-4526483285a0	modellare sistemi ottici
8860a7bb-79cf-4876-ad1f-dcd239659eac	individuare i concetti innovativi nell’imballaggio
887b9794-33f4-4bdb-afdc-3ae4b65d0558	comprendere il romaní parlato
888303a1-d911-4319-b6ac-9a908f31010d	riscuotere le quote dei visitatori
8871443d-2a4c-452e-821f-73f32fdadb13	approvare le relazioni per progetti artistici
888cf47b-6461-4053-9494-c1c99ac3d9f0	greco antico
888d4ea2-5b6d-4f8e-92bb-d6fd4971f14e	provare il ruolo
87e16317-84bd-4180-9813-961fecb8448e	controllare il flusso di nitroglicerina
8890cf7a-d6db-4f94-ada0-dcf4c4408ba6	definire le priorità delle emergenze
888330f5-9dd1-4e79-9386-5281c3c580c2	utilizzare i sistemi informatizzati di gestione della manutenzione
889199f0-1162-413d-bea4-209be3fcd3b4	effettuare la manutenzione degli impianti a energia solare
88a096df-3fd7-4028-b607-3d4a741cbb2c	supervisionare le operazioni quotidiane della biblioteca
888e4be6-c3aa-473c-a1f3-32961e9691b2	impegnarsi per far crescere l’azienda
88a49404-df9b-4c50-a6c7-015f4c7645eb	tagliare i tessuti
88a45959-1283-454a-93ab-40f1a6238ed9	Source (sistemi di creazione di videogiochi)
88a83dbb-ab2b-45f9-ac0d-2a2acb0bdf57	registrare il decesso
88ad23b5-f0f2-4c98-b0a5-6e0d0dfc0b8f	studiare una collezione
88bc75b7-946e-4c51-8614-5ec77166c093	ispezionare le strutture di smaltimento rifiuti
88bcae76-023a-4c6c-bda2-eb6df7614afd	cuocere la superficie
88be6d1c-e292-4323-a0bb-8ad58dfb95a8	scaricare le attrezzature
88b50408-139e-4f9c-90ae-b8c8cf107a87	saldare componenti elettronici
88ac25af-caec-4ea2-814b-14b33628c77a	TypeScript
88c487da-3570-4625-8420-e333afacd0d8	guardare prodotti video e cinematografici
88c511d8-342e-4076-a179-2848d056a017	adesivi
88ca00f6-42b7-4e69-90b9-a1513c534482	cucire indumenti da materie tessili
88e1dc42-f710-434b-825a-46a3c21a07ad	attività di una società holding
88ddba30-03f3-419b-a9e4-8b75e087ed8c	ispezionare la superficie della pietra
88c18bcc-20c2-4e18-b2fc-aab3bf31117e	controllare la soddisfazione dei clienti di un casinò
88f0a973-363a-489e-b566-dd3a97af34ff	gestire le informazioni nell’assistenza sanitaria
88ed296a-0de0-4102-814b-9b2c9b3d5382	prodotti per uso domestico
88f67e71-7561-4569-8947-cdd91a639ea5	azionare la soffiatrice per l’essiccazione
88f3b780-67cc-4ce6-a787-cd902ac1f6c2	individuare le esigenze di formazione
88f8d3e4-420b-442d-ad98-3ddca00bc6af	teologia
88fe2216-771e-4c85-9fba-28717cf900b9	produzione di contenitori metallici
89042f3f-710f-4bef-ba79-4c548405f5c8	crioconservazione
890874b5-9947-4868-bb82-df9c26201b4a	estetica
8905f1bb-5b17-449a-97c3-c64f816383ea	comunicare giudizi analitici
8917f9ac-6490-4393-bd52-3e2f7e3ed83f	prescrivere un trattamento per le lesioni muscolo-scheletriche
8914fac5-a218-4fef-ad0b-6734f1807f0c	gestire i rifiuti
89208acf-29b4-4be8-a08c-91ca5c76ec92	offrire assistenza ai cittadini nazionali
8919122e-9369-41a5-a080-9aa6593f327b	stabilire le priorità di gestione nelle reti di gasdotti e oleodotti
8919fe6d-3f14-4dca-9309-aec168fbf4b3	comunicare con la comunità di destinazione
8921792e-d48d-4347-8bf3-0ce9be70c586	trattare gli animali eticamente
8929d439-3f2e-45a8-a4d4-202f22475123	considerare i criteri economici nel processo decisionale
892b04fe-f42a-4b68-a7a7-7109a9514e1c	condurre una valutazione dettagliata degli standard di qualità
8930db72-37de-48ae-804b-ce6ec5ddb398	impatto ambientale del turismo
892fa1a5-f130-4e9f-a8b0-8cafb2b9f8c9	individuare le esigenze della clientela
893d36a4-afcf-4876-a004-9df6a0b903c3	capacità di carico del veicolo
893562ab-0c49-4a7d-9c68-217825a12346	storia dell’arte
893ea9a4-6030-4d37-a8ad-a9473e9e52e3	gascromatografia
894379af-d380-46ca-b351-7bea109f2ed5	bestiame
8947337c-00a2-41a8-8b5d-839816fc9a1d	mostrare capi campione
894885fc-0887-40ae-9947-3304fcd76424	gestire i permessi per le risorse del territorio
895a6bf1-edba-490b-beb3-6c61fe6cd5e3	ritirare gli elettrodomestici guasti
89598e11-904f-4be7-b0c0-bcb90033ad83	valutare il progetto
8960c3c6-6d80-43f4-ba42-2cec459fffb1	ingredienti cosmetici
896c7685-43e8-46f0-b75b-7b357e0a8ac3	discernere una comunicazione scritta
896fb512-fcc4-4961-9eb9-eec708736aaa	pulire le incrostazioni
8964e1ee-9d6b-414e-b0fd-6e91059b46d8	effettuare la manutenzione dei locali di stabulazione degli animali
89751f40-e71b-4aa8-967c-222e3a6075b1	analizzare le esigenze logistiche
897d7c7a-d8cc-4b8b-b3b0-b4b76cdf56c0	mantenere i contatti con gli ingegneri
898400da-877d-4279-ad0d-0c36c94a8dca	individuare i modelli di comportamento nel sito web
8987c84d-435a-4454-96b1-000615a88770	offrire consulenza sulla gestione dei rischi
898b6d96-78dd-4571-9644-f40441aebc52	rimuovere il rivestimento
8990f634-841f-4a73-bee6-b50d419bea84	sovrintendere al sistema di gestione ambientale
899e104d-695e-4734-a041-d8e91899b83a	garantire la conformità con le normative di acquisto e di appalto
89a700a0-1120-481b-99a8-be3b8c58070a	comunicare informazioni veterinarie specializzate
898bb4d1-b699-4e62-b7c0-cb7859eaa86e	offrire consulenza ai clienti su gioielli e orologi
89c5188d-4abf-499e-b77a-cfea65460591	redigere specifiche tecniche
89b9086e-7a21-47e8-833d-14aadbea222e	elaborare informazioni qualitative
89cb4c70-74b2-4035-b102-f2fd9bba1662	sociologia applicata alla scienza paramedica
89cce57c-d814-4d6e-8058-cb4154dc73e3	riparare l’impianto di riscaldamento
89dc2253-2ec4-4fa1-8c8d-2312f60dc358	stabilire regolari procedure di sicurezza del sito
89e3a004-4f24-4d80-91a3-2f926083dd76	ridurre al minimo i rischi professionali nella pratica odontoiatrica
89de2678-ed72-4bef-ac56-a71c6ccdc746	preparare frutta e verdura per la fase di pre-trasformazione
89ec94f6-c4f7-4cdd-ac7c-05229f177324	eseguire i lavori relativi ai calcoli in agricoltura
89ee3c59-340b-4ea7-8feb-47f28bbdc454	utilizzare i moderni ausili elettronici per la navigazione
8a0562f7-62a5-4d21-b668-fe1291c40375	allevare pesci destinati all’alimentazione
89f76733-63db-450f-b6ec-6ce301a08b20	sviluppare modelli utilizzando sistemi CAD
8a058a48-d761-4850-a1f1-4dc666edce40	installare sistemi di tubazioni e di scarico
8a028fc2-488f-4080-86d2-eb6b4945e240	riparare i difetti delle conchiglie
8a0f01ce-54bd-4914-8153-a5d16a84060d	pietre preziose
8a15c577-d920-47ca-9017-377ae0c55e96	diagnosticare le patologie muscoloscheletriche
8a1c8538-9b43-419d-9a17-47e596c213d6	preparare lo stampo per la formatura sottovuoto
8a2ba4b0-5846-4fe4-b4e9-dd32016c6b8e	normative sulla rimozione dell’amianto
8a2079e3-e25d-41d7-a405-c1f80d4bd234	gestire il corredo funerario
8a30756f-6cd6-4c61-978f-6fb0d5ab2f5f	garantire l’integrità dello scafo
8a37bb70-0330-478f-8e2a-4126018d1e44	creare superfici levigate in legno
8a392b7b-ecb8-428f-a5fb-2099c9c8a65c	gestire il trattamento per i pazienti affetti da HIV
8a3b7a85-65b2-4737-98a5-37a1ccaef99a	condurre i test di screening oncologici
88e58292-0c8a-48f5-9d4d-bdbed92c3a71	proporre miglioramenti alla produzione artistica
8a4c587d-d224-4dd0-a93e-c74d6701f4d6	essere addetto a macchine foratrici
8a43a385-6a9c-4d56-b93f-11642e0304c1	annotare i dati delle persone che entrano ed escono
8a5de5b4-4384-4c1f-afc5-4a4011406ef3	verificare parametri di sistema a fronte di valori di riferimento
8a624f9d-22c1-404c-ba0a-b61ff3663f41	pulire le attrezzature
8a687487-3287-4520-9b6f-fc22db699cdf	esercitare il controllo sulle spese
890a756c-d8c3-47f4-a2cc-58d638cff413	tornitura del legno
8a78b2cd-fb4c-4186-87a0-e2eb61e90bce	insegnare nella scuola primaria
8a7abbca-4df2-435d-8871-cf21690b044e	completare le procedure di transazione relative ai veicoli restituiti
8a85f476-56ac-4e29-8f92-c179b296fb2c	riferire sulle anomalie degli interni degli aerei
8a86fb4a-6f34-49ed-8230-dc8f58e3091a	coordinare la cura degli animali abbandonati
8a8102a0-7aef-4cdf-bb6c-c63f416890ff	favorire lo sviluppo del personale
8a8830ba-9364-4d39-bb49-793e9a4bfa3d	affari esteri
8a93ba09-69de-4265-8f4f-b897a5c5c773	condurre i parti spontanei
8a95316e-6c13-4132-89f6-33267bd2a0d6	far emergere il potenziale artistico degli interpreti
8a976bb3-c760-4d63-9d16-417c12921b4a	tecnologia di monitoraggio degli impianti di un edificio
8aa016aa-e9a8-45f2-a205-199cdca1057a	creare programmi di trattamento personalizzati
8aa2f1e1-7877-4ff1-aae5-7b83c4a37f95	effettuare le procedure di avvio di una piccola imbarcazione
8aa93fb0-f10c-400a-968c-f2f493c1090b	asfaltare
8ab2ba21-509a-412b-882b-d2cba894cfb8	fornire assistenza infermieristica per gli animali in convalescenza
8ab046ed-d7e4-43f1-98c1-633a19db2e9a	preparare agli incontri
8ab9261d-b488-40ce-9dd9-93bbd7cc6273	monitorare l’uniformità dello zucchero
8ab96047-17d1-4709-9f04-b88bb811a661	aggiustare le apparecchiature di rilevamento topografico
8ab9a5bd-c08a-4a75-acbb-0d825095a1d4	descrivere l’esperienza artistica
8aba47c4-6235-4061-9556-4880e10a85f3	reazioni chimiche della tostatura delle fave di cacao
8ab5ef4b-0aa0-441e-8a56-3a560cbb3dae	stimare i costi di restauro di oggetti antichi
8ac27035-d3a4-4c25-910f-c1dfae255666	insegnare le competenze alfabetiche come pratica sociale
8ac762aa-acf1-4f52-a120-f8e78a963de0	ecografia ostetrica
8ad4d380-f2c1-4ec5-a87d-3119c4c36cd8	preparare l’assetto del veicolo
8aea015e-09de-4e22-b338-9c1a1d58877c	conservazione architetturale
8aed5d1f-1cfc-4a6e-aebf-e05f376e9f1c	versare i preparati medicinali
8aedbbb0-25c5-4947-b93b-8965fcef9366	manutenere i forni industriali
8b01841a-cc76-4b35-a7ce-a4f57e74f23e	processo di produzione del latte
8af53abc-680f-44bd-a177-75d69ba17335	selezionare le riprese video
8b036d50-631c-4f25-ad99-aa81a23fa8d5	mantenere le proprietà di rivestimento delle condotte
8b043ffd-f921-41d2-8884-fa3c8dbfdf21	gestire il processo di richiesta modifiche TIC
8b08a851-2454-4933-bd06-21265f6daa20	offrire consulenza sulla movimentazione delle opere d’arte
8b0bea95-d1f8-4abb-927c-97f8cddd37b6	individuazione delle frodi
8b0e6dee-387b-4d3f-8de6-bcf4604e5060	gestire i piani per lo stoccaggio di sottoprodotti organici
8b15d6e1-f535-472c-b430-882563d3ef53	uso di attrezzature speciali per le attività quotidiane
8b1d7414-2353-4a41-bc30-b9634c918d08	aggiungere sostanze chimiche per la chiarificazione delle bevande
8b101003-9648-4138-b2fa-504271a7b83c	mantenere le banche dati della logistica
8b2339d1-2521-44c9-a7b1-b13eb2bc2bd9	azionare un’idropulitrice
8b1fd44a-03a1-45e6-b6f3-66b76d84beed	valutare il carattere
8b25acf5-cf98-4c5d-8678-b1d45dd99761	progettare microelettronica
8b27c948-bb93-4b88-a394-9c25420d538c	eseguire le differenti rifiniture
8b2ebbe7-99c7-4c1d-9a2d-08307ca9886f	sorvegliare il compostaggio
8a114661-7055-4f93-a033-3ebfc7099638	utilizzare le informazioni meteorologiche
8b398bc5-e729-48e2-a588-d7d6c81c1d8a	praticare sport estremi
8b3cc771-5783-45b4-aab1-b4be416551d3	tollerare odori forti
8b42423d-b689-41c7-991b-af507a1fcb3b	offrire consulenza ai pazienti su come migliorare l’udito
8b425dfb-b989-4e1f-b8b5-fc249d2b81dd	corrente elettrica
8b4a31d5-7f33-4ab9-a51d-eba4e644b048	preparare i locali
8b51feac-2cb8-4b97-9433-d259c4031ae2	tipi di condimenti
8b69549b-d3c5-49fa-b0ef-ec69d0d287b4	lavorare in una squadra edile
8b5fa136-f33f-401a-ab8b-60b651fa548c	indossare dispositivi di protezione adatti
8b698ba1-b127-4a02-b897-0d9053ae99fb	ottenere i permessi per strumenti pirotecnici
8b6d7b8a-dc8c-49f4-adfa-4b0802be8fb1	applicare l’assistenza infermieristica alle cure a lungo termine
8a4dae64-89ea-4835-a714-7723b96eef09	scrivere relazioni tecniche riguardanti gli alberi
8b713be6-9836-4747-a4ef-9cac1f4e859b	interpretare le prescrizioni
8b752886-7f97-4ae6-bf03-ab76454de4a4	manipolare i prodotti forestali
8b7b5676-c6e2-4ae7-913b-f4900ac2d319	gestione sicura dei farmaci
8b7fec75-371c-4b22-9109-5754176e59a5	mettere in sicurezza l’area di lavoro
8b83d158-0b8c-46ca-be68-725b94a3289b	strumenti da idraulico
8b82bdc1-89fd-4eb7-a23a-a7c9ef2f71d4	rischi associati all’esercizio delle attività di pesca
8b95a7c6-c524-4fd4-944d-01ba93d6cbbf	essere addetto alle attrezzature per la produzione di alimenti preparati per animali
8b98be09-9727-4991-aeb2-e45cac45f06b	supervisionare la gestione degli animali
8ba302a9-7335-4535-a1b3-aa41d9cd3d05	usare sistemi di taglio automatici per la produzione di calzature e articoli di pelletteria
8ba9e39f-2296-41bc-b2e4-6df255a1064d	supervisionare le operazioni quotidiane di informazione
8bb0345a-1479-4f54-bd83-f8765b54dc71	promuovere il progetto di infrastrutture innovative
8bb3ba5a-8038-43c2-88f1-7b1db212f334	trattare con il pubblico
8bb527d2-8be2-42f8-bffa-e31540840603	applicare la terminologia TIC
8bbbfb40-2a75-4203-85b3-7a5c4ef7e7e7	tecniche di immaginografia
8bc28220-9e4c-4d8c-86bd-cb82c93022c1	calcolare i salari
8bc30e12-dc9d-450a-bedc-f0f2d6ac6c3a	software CAM
8bcb6452-833d-41bc-a22f-800e31c86379	interagire verbalmente in macedone
8bdaa47d-07ba-4910-a437-f4d311dfcef8	usare suite di software per la creatività
8bcd1f3f-16cf-400b-84e1-b0255d03534a	eseguire la manutenzione della macchina
8bdc5f88-f31b-4a34-b7b2-ad8b407cbba6	vendere prodotti ittici
8be09cc6-163b-4c55-a53d-269746df144f	eseguire la produzione di formaggio
8be15b60-ec5e-4ed7-bae3-643b865b63b7	individuare i meccanismi di sostegno per sviluppare la propria attività professionale
8be31855-ce37-48e9-94d6-56e60bc877c2	settore dei trasporti marittimi
8be6162f-1963-43b8-bd5a-0367fce8f449	indagare sugli incidenti marittimi
8bec00aa-5f47-48fb-ae35-0b46b9816654	leggi sul trasporto di merci pericolose
8bf5b52c-cc75-4f98-990d-4849d38fe6c7	legislazione del lavoro
8bfb2b6d-603d-4af2-9c34-397e37768c64	cartografia
8bfcac19-f1a5-48a7-b9a7-bdb2d64db130	verificare i veicoli per la vendita
8c03af6d-1ffd-41f4-a7be-0af54307f5fb	effettuare un’anestesia locale nell’ambito di cure dentarie
8c03ead8-c00b-4317-8d66-43ad16220948	calcolare le tariffe orarie
8b0fba5d-4de2-4e31-9047-39c63cbb2ae7	monitorare la politica aziendale
8c18b167-3412-4c67-bf23-5750c74d3615	prepararsi a utilizzare piccole imbarcazioni
8c12ae66-b531-473c-b1b1-ee13e8287102	prevenire danni all’interno di una fornace
8c17417b-53cd-4865-ab7d-3b133b7f33d4	condurre attività educative
8c1b2dbf-65ef-4ff1-82d1-6522a6b52405	vocabolario circense
8c1bc4e9-a57c-49dc-abdb-86f65e9d92b0	gestire il sistema di allarme
8c1e4384-cb28-4019-98fc-638eb8b2f939	coordinare le operazioni di manipolazione del pesce
8c1ecd76-bbf4-4fae-be36-299bc3001776	principi Steiner
8c1fabcc-05d0-4882-9e29-e92dba263ff1	utilizzare un frontifocometro
8c232f79-46f6-4be4-a32f-7a31b015bdf3	normative di sicurezza elettrica
8c2f33de-6778-4329-b0d5-92fb74df92da	manutenere apparecchiature di taglio
8c40aecf-9d1b-432d-87e1-88b66a753677	gestire la documentazione cartacea
8c41b8e3-8e0c-412e-aee3-afe57d9bf4d4	personalizzare i pacchetti di viaggio
8c4a7913-4294-45c7-8aae-fa0e468b1d95	emettere deroghe
8c45b1b1-8770-4c03-8e4e-cf80200741ba	esigenze degli adulti più anziani
8c515825-bada-49b8-97d7-e38f8a22a040	applicare tecniche di assemblaggio
8b4e5a06-caa7-4d14-b7a4-d12a972d078b	elettrochimica
8c4ade50-a729-4e06-a54d-7721f7e318e6	pulire le macchine dai materiali di scarto
8c53ada4-ab85-4616-b33e-eda7968bea4b	processo di locazione finanziaria
8c5ad5ec-533f-42b5-b389-2925a4e9046f	tecniche di conservazione
8c63c484-7b80-41b8-bcf9-66a69562c5fc	interagire mediante le tecnologie digitali
8c547d77-5664-47c0-8ff9-c718a641da01	promuovere il rispetto dei diritti umani
8c660773-898a-4af2-ae1e-d7e9180d2c99	gestire il nulla osta di sicurezza
8c64f804-da82-4f1c-9ce7-c435d70470c0	SPARK
8c87a73c-bdae-4520-9ab5-2fe0bfca128b	differenziare i tipi di pacchetti
8c8764e6-c6c3-4704-8dd6-d2b662d65fff	politica ambientale
8c89d2c0-ae01-408e-b060-717b749afd85	acquistare la frutta e verdura
8c898954-8647-44cd-9ac7-7e18bf36a344	norme sulla produzione del tabacco
8c8d2f02-6a34-4519-94f5-8498845c7de8	offrire consulenza su fertilizzanti e diserbanti
8c8f362d-5c8e-44a4-a20a-bce817dabc92	igienizzare l’area della cantina
8c952796-eca7-4169-8a8a-6c34d54b4ddb	processo di produzione ottica
8c985419-ef6b-4423-a286-a52a38bfe9de	individuare le informazioni riguardanti le potenziali comunità destinatarie di attività artistiche
8c99a525-8683-4c2b-bd27-2ae61646b617	elaborare ricette di sidro
8ca1ed84-57f4-412a-8089-c5cf12485371	navi da pesca
8bd1c83d-8e4f-4958-96ee-57884e77ca43	eseguire la manutenzione preventiva dell’aeroporto
8c9f7891-b2da-4467-a799-36ce051133dc	vendere i prodotti di telecomunicazione
8ca3e532-577d-4f07-af7e-29a1a370eb54	marathi
8ca7f21e-f1cf-4098-b737-2e37305c0881	negoziare i prezzi per il trasporto di merci
8ca95af8-cd31-4bdf-b607-6cb5c6f92e9b	rilevare difetti nelle bottiglie
8ca909b1-3dcb-4f72-9942-2cd74f517a48	controllare i pesci trattati
8cae747b-1893-4e21-a4d2-64d59734a430	ispezionare visivamente i binari ferroviari
8cb1f595-cf6e-4478-aa48-571d27357143	selezionare le attività di restauro
8cb2cf70-fc09-488f-b901-30f298b1301e	gestire la consegna di mobili
8cb2eeca-a38f-4c02-8091-548c6877458e	simulare concetti di progettazione meccatronica
8bed7949-2f7c-4d63-b2da-fdfb658dfaa0	essere addetto a macchine di estrazione del miele
8cb82fd2-5174-4612-92e2-e6296d7fbfce	riscaldare la lacca
8cb616f0-9cbd-4218-bd90-695f1629bd4d	tollerare lo stress
8cbea376-05ff-4762-be4d-526dd828a347	tecniche di pulizia
8cc0643e-b58d-44ce-9508-e85aa5f3163a	progettare gli eventi musicali che coinvolgono i pazienti
8cc9e0f1-d39b-4190-9278-f5ee5c621128	programmare l’esecuzione delle acconciature
8ccbe63b-f809-4bf0-8b34-d9bc61c14a53	gestire il processo di stampa flessografica
8ccd5331-1f45-488a-9344-15abb4f5d14a	tipi di sanitari e accessori da bagno
8cd1dd64-a781-4d0b-9bf9-3e92adc64ee3	allergie
8cbb7777-145f-4436-a313-e39235731aed	ispezionare il calcestruzzo fornito
8cd29778-80cb-4f2f-af9a-ee411e5efe94	malese
8cd6c224-e585-4742-a1cf-514e176dd7ed	irlandese
8cda13f8-8aab-4cf8-a55c-94563ff05145	apparecchiature di accesso elettronico all’edificio
8cd8acac-062b-49b5-ad56-9a78bee5a77d	prendere decisioni legislative
8ce2d45f-b8f1-4c7c-9480-302f74d700f5	svolgere le mansioni di segreteria
8cea319e-ecd8-4cda-a345-6d5ef1a3d171	azionare le pompe per il sapone liquido
8cfa17d1-b106-4f56-8629-f4af09bc8c64	posizionare le cinghie trapezoidali sulla intagliatrice
8d08ab2f-9238-4813-b3d8-bdc2478b7892	specifiche di anodizzazione
8d17b871-9bf8-4f20-b374-ecac5a731055	utilizzare le economie di scala nei progetti
8d123419-6aa2-42a4-9b7c-f2de65bbd7a8	prendere decisioni fondamentali relativamente alla trasformazione degli alimenti
8cf170d0-22a6-4ea8-a00a-b8a275774c4c	monitorare il livello delle giacenze
8c27a4ee-e993-4af1-95af-78b5f992419a	modificare le immagini digitali in movimento
8d227282-7740-45d7-89ef-273ae25302e1	esaminare l’impostazione della pubblicità
8d2d1696-b31b-4e4c-9b75-33bf5fc69f9b	facilitare il coinvolgimento dell’assistito in attività utili per il conseguimento dei suoi obiettivi
8d1b3633-d80e-4069-a0e2-b7ae26691f4d	creare oggetti in ceramica
8d255ad8-ce5f-4dbf-8368-f90907d0243c	tipi di piani cottura
8d1aef17-16c5-4871-95e2-5462e397a3be	eseguire test d’integrazione
8d2e4b89-444f-43d5-98b1-80f36e92fbf2	gestione del portafoglio nella produzione tessile
8d32e789-47c4-445c-8834-c44eeb23d805	pianificare la pendenza delle superfici
8d339f7e-7eb4-49f1-bbbd-c95717d980fc	legislazione sul trasporto dei rifiuti
8d32cf1e-6539-436f-b184-f00e30b0e33e	assicurare la manutenzione dell’arredo pubblicitario
8d37c5e0-72a2-4303-a39b-f6347cade4a2	sviluppare le strategie di acquacoltura
8d4376c4-7092-4386-89b2-720695d40504	introdurre lo sperma
8d528d16-3bfa-4962-b4ea-7f0ebd3e48ad	controllare lo stato nutrizionale di una persona
8d5aede1-66fe-4a8d-9369-e3354fa18b8d	usare la programmazione automatica
8d4257b3-7202-41c1-bde2-f0f43ee3dfb4	utilizzare un sistema di controllo di un paranco a catena in uno spettacolo
8d5fec78-a9f2-4035-9084-fe9de39a3939	gestire l’habitat acquatico
8d6023e5-805f-47c7-a98b-405c790ae22a	effettuare la manutenzione delle attrezzature tecniche
8d3c325d-984d-4812-8a60-426fcef0969c	sviluppare un progetto di community online
8d63a7a1-98f1-446d-a449-3ce5daf91ec6	eseguire la gestione del rischio nelle operazioni ferroviarie
8d632814-2642-4ce6-9615-cebcce856fd5	usare il marketing nei media sociali
8d669e0f-c4de-4aa5-8c01-41439c24b84c	testi biblici
8d694d14-2677-44d2-bb1c-60fe7ece6260	utilizzare la pressa per serigrafia
8d6efe97-48b3-4683-bf4b-54e6c4202737	gestire il funzionamento dei propulsori
8d7524d8-ba68-40cb-afa6-84a3a9d699e6	fornire un’assistenza professionale di tipo infermieristico
8d781dc4-b8aa-495a-90b6-847051023015	mescolare bevande
8d675930-08cc-490e-85ce-e1d5ea31edc0	offrire consulenza ai clienti sul tipo di attrezzature sportive per scopi specifici
8d81c4e2-2e7b-47bb-9c88-951e1444f737	gestire i sistemi elettrici della nave
8c817f31-130a-4bc7-a84f-1022e2d23f64	effettuare la manutenzione dei variatori di luminosità
8d81d7b5-fe5a-41c7-b37e-67b540574478	lavorare sugli effetti dell’abuso
8d95da8f-c341-41ca-9e77-63bd9419ff92	trasmettere gli ordini di articoli di abbigliamento
8d9006b2-ddf6-4763-9eda-e08c4f5cd08b	norme di sicurezza comuni dell’aviazione
8d95daea-61c8-472f-9877-01ba3f119d14	intelligence forense
8d8a6e15-bf0c-4721-a185-e10466dcc04f	sostenere le economie locali
8d84a84b-e443-4643-aff9-3534c8e847d3	applicare regole di base per la manutenzione delle macchine per la fabbricazione di prodotti di pelletteria e calzature
8daff2ee-b69a-4213-bad1-dd05c669ce12	dimostrare la funzionalità di giochi e giocattoli
8d9b352a-cda3-4861-ae9e-9e3dcfd19f01	sviluppo a cascata
8d9da140-b1b2-4097-92a3-e1d3e487b73f	gestire campioni di dati
8dc04357-62c5-466a-b76a-dec48342f09c	illustrare le caratteristiche delle camere
8d9f1087-165c-4e5d-b9a3-ac22a4704247	sistemi di commercio elettronico
8dc2b128-7f76-4e5b-bb3c-79e45170c9cf	organizzare una valutazione dei danni
8dc5a6d6-e033-4443-8e8a-0083089c8699	ispezionare le bombole
8dba7e38-1318-49fb-b368-c5f12a9ac48c	diffondere le informazioni aziendali generali
8ddbd62b-54ab-41fe-9948-30bc8d129605	reperire le sovvenzioni
8df1d861-9d11-408d-9504-c178fcbc7f4e	BlackBerry
8de357c8-f82e-4d99-badd-ace09530d429	modificare i disegni di tessili
8df39501-81f4-42e5-ac64-89568bc3460f	meccanoterapia
8dfd9190-4eb8-4e58-aa8b-7448892d2df7	rispondere alle emozioni estreme delle persone
8dff3e99-8eb5-4ac5-9c5a-b90fcaf09667	insegnare i principi del marketing
8e166921-3efd-4c62-96ea-f3afc3d66d7d	effettuare la manutenzione dell’infrastruttura ferroviaria
8e23c74a-5d5b-45cd-a8b2-c448e43d29cd	raccogliere le forniture per i visitatori
8e06ff41-5baa-4a92-bbc0-ad8ae839d1da	mantenere i contatti con i politici
8e26fde0-8497-475f-98ea-ff55c12d3404	diserbanti
8e26dd11-84d3-4c16-b51b-47192d0fbb0f	amministrazione di ufficio
8e25145f-2b64-416b-9336-0a387d408370	calcolare l’imposta
8e4abeac-d8d6-42de-b2f1-aeaae26419d4	accordare gli strumenti musicali a tastiera
8e4b19ec-5de8-42e2-a33a-e679ba1cf05a	utilizzare una fornace per il trattamento termico
8e5d32d9-0094-43f8-bdaa-404e8cec7994	fornire assistenza a un gruppo di pazienti con caratteristiche specifiche
8e58987b-7e1e-43e8-88ca-e9b34d3c4378	gestire il trasferimento in massa di materie prime
8e561d56-80fc-4564-874f-5e5cdda1e697	arricciare i capelli
8e503e0d-7aaa-4271-bf14-6ec30052e788	monitorare le riparazioni dei veicoli
8e23f4c9-ca2b-4dde-b072-fe3f11ece6fd	comunicare i programmi alle persone interessate
8e699094-3e85-4a47-83d5-223ec35331ce	raffreddare il pezzo in lavorazione
8e6f3268-0956-4050-b702-3c16d810c13b	acquistare le attrezzature automobilistiche
8e705322-b061-448c-9f96-e8ebf7648652	documentare l’avanzamento di un progetto
8e633117-25ca-4bd1-b111-a1868d27bfea	intraprendere una verifica clinica
8e8848ad-d579-46ac-bf11-6bb1a5672788	inserire dispositivi negli oggetti di scena
8e88b35a-a424-44fd-9506-a07592ed7a64	disegnare i bozzetti del trucco
8e89657e-c00e-4b93-9003-b38992d0e256	moderare un forum
8e8f1d3b-5483-453d-9a1d-919680c2bcfa	modificare i calchi per le protesi
8ea56ca2-cb63-456b-a775-8c2de3e63e40	metodi diagnostici in laboratorio medico
8e9790ac-517b-4015-b366-a47789975958	memorizzare informazioni
8e8a7f2f-6e9a-44ea-bb2f-f138260f675f	trasferire le informazioni mediche
8ea7860b-beaf-4c04-aaa9-de36aa58d988	registrare gli atti
8eb83470-79ae-4efc-9422-6db9f8019604	progettare la discarica della miniera
8eaada30-feea-4cf0-a14c-7498d0247033	prendere decisioni giuridiche
8eba91ca-80f6-4486-a657-96fca0d5d475	coordinare le componenti del lavoro
8ec37ac8-12d6-44f9-94f7-7f181d1942e1	gestire i combustibili
8ec4a696-7339-4994-a192-ddfa1c0f6a5e	storia delle culture
8eb5d18e-5e5e-4daf-b69b-9dc725bd8a94	garantire il rispetto delle convenzioni contabili
8ecc655a-d5d7-4f00-9ca8-f9968ad04db1	manutenere i macchinari di lavorazione del legno
8ee86890-63bf-4d66-823f-26519898844a	preparare l’imposizione
8ec7a92d-a16e-4457-954b-13e7ca8af5f3	effettuare la manutenzione degli impianti solari termodinamici
8edd5ae4-3bf9-4bf4-b0b0-8cf049a7795b	fornire assistenza per la stesura del testamento
8eccba72-018d-4708-ab67-abee46b61e8e	fisiologia dell’udito
8eea3c4d-9524-4852-92e8-2e36c1f0209a	creare tassonomie nel settore delle scienze naturali
8ef16193-6352-472d-a406-25b3623ffc3d	somministrare un trattamento radioterapico
8ef92e3c-85bf-49cb-b3c7-a96b34823e87	mantenere i contatti con i gestori di sale cinematografiche
8ef2fa09-0096-454e-ba8c-73a8584b4235	ingegneria meccanica
8ef68273-9e6d-4636-8dbe-a7096425f02e	organizzare un gruppo di discussione sulla qualità
8f0223e1-7b1e-4781-82bd-60653bafb3d6	verificare le informazioni sulle prescrizioni
8efa7846-6afc-43e7-8a46-31b754f112eb	valutare i dati forensi
8f1458ab-3aa7-452b-8d71-839c0aeb6302	scrivere la storia di un videogioco
8f07c6f0-0520-435b-8533-fb2312d391ef	cercare innovazioni per le pratiche in uso
8f1aed89-2533-4e62-8d5f-4cadc66346a3	lavorare in sicurezza con i materiali pirotecnici in un ambiente da spettacolo
8f189eed-7d8d-4fae-9642-3c99833f870c	controllare gli sviluppi educativi
8f2623c0-71a7-403c-96c8-de5c80335a71	gestire il bilancio del programma di riciclaggio dei rifiuti
8f2f56de-db1b-48ba-939f-ede1fb1e76f0	tipi di catene
8f240597-7c26-41a9-9dd3-d91ff3e80d87	comprendere il russo parlato
8f352fed-e27b-48f1-99b5-1aec2aa8ccd6	applicare le norme di sicurezza per le piccole imbarcazioni
8f394eef-58f7-4a25-a20b-9a5175c9abcc	lucidare gli interventi di odontoiatria conservativa
8f362437-6819-4b37-9967-37b72a5240a8	comprendere il greco antico scritto
8f3be0f3-c33f-42a1-9b01-3592f3809a6c	caricare le attrezzature
8f428ec4-3995-46b9-ba8b-d9273115bf3b	installare le scossaline
8f42c598-b172-4d98-ad98-69ea8dde0da0	fornire consigli sulla gestione dei prodotti argillosi
8f4bd4e4-aa00-484a-8f72-1d2909076ad9	capacità di carico delle macchine
8f635288-4d06-41ca-acf4-f29ac3bcad4e	progettare operazioni di rigging e sollevamento
8f86bee9-99e4-4eb0-92ba-d41928d33fe2	utilizzare le macchine cuore-polmone
8f8458c7-8aad-439d-a0b5-1eb0455a72e7	preparare l’esposizione di piante artificiali
8f70a8e7-df69-4f48-86c6-0568a7b42e33	stimolare l’indipendenza degli studenti
8f521e65-808d-42a1-bc51-e02d74b3c3bc	fornire assistenza ai minori con bisogni speciali in contesti educativi
8f72b3d1-cd6a-49b7-8f13-2a2ce2dc405b	tenere registrazioni delle presenze
8f88b75b-bf5b-4a9a-8ed4-cf65f4118945	tecniche di spruzzatura della vernice
8f8c1a09-4db5-4f7b-ab93-9f866d1a2f76	fornire assistenza nelle indagini di polizia
8f90ec23-6f97-4fc2-9509-84e25b3b78fd	elaborazione analitica online
8fa2724d-1f30-49df-88b1-1215c3dd5b45	aprire una pratica di risarcimento
8fa8ed1b-db5d-4d3a-b9a3-b03944379577	effettuare gli interventi di chirurgia orale ricostruttiva
8f999dae-6cae-4781-bdab-43ba7fa91718	registrare il peso dei gioielli
8fa279f3-aa77-4987-bafc-c2bc7836005a	insegnare i principi aziendali
8fa6a851-4a74-4906-946b-4d90e178d77e	valutare i programmi del sito culturale
8fb3e191-3cbf-4e23-95cc-1fae3eb61c26	seguire una formazione professionale continua nelle operazioni di pesca
8fb06120-f6e2-4764-b05d-e4aa71c6cc38	creare modelli di set
8fc9e53b-49ba-4a4b-918c-f8719fc2046d	storia della filosofia
8fcfd6a4-0f5f-4fbf-883c-6a3b99adc360	valutare il livello delle capacità dei dipendenti
8fd5bf97-c5bd-4557-a967-e17b89d3726d	stivare le merci
8fd5cf6a-376d-493a-851a-77c4a7a9ba1d	progettare spazi aperti
8fdafe39-76e2-4b2b-9bfc-c9c7d638c3df	sviluppare le politiche organizzative
8fed4c41-3d9f-40f6-801e-741a2ad169e1	comprendere il marathi parlato
8fde651e-55aa-4d64-b044-f25ac9d50cbd	valutare i cani
8ffa5c22-3695-4679-af66-d8ae8cc834de	interagire verbalmente in coreano
8ffb6e60-e4e1-40c6-8639-af07d7029a1d	massaggio terapeutico
9016eaca-75f0-4c7b-a91f-ece3d5892b23	avvolgimento a caldo
901d8b4e-8727-4942-898e-25991e995eb3	eseguire indagini sulle esigenze dei passeggeri
90194cd3-b0da-4fb9-8117-6ddd89671bb7	sistemi giuridici del settore delle costruzioni
9009e80d-3772-4da5-b3fd-59617eee30ea	disegnare articoli di pelletteria
9002505c-88d1-4d00-9fec-6822a9313b6b	utilizzare la macchina per la fabbricazione di borse di carta
9044c470-12ba-4fef-be96-0510aa2c9597	mescolare l’impasto dell’adesivo
904c4d8d-efe4-4fa4-9cf5-5c9c799ae61c	eseguire l’Edge Crush Test
904e8801-5a9b-49c5-b606-8232e6e0465d	selezionare gli animali per l’addestramento
904d8dbe-fe65-4c10-80d9-ac2f2f2fa3eb	pulire il miele dal polline
9051d608-f95c-452b-864a-4c58aadde607	eseguire un’esofagoscopia
90582495-233e-4c35-9062-314b6b29e162	gestire l’utilizzo dello spazio
906b80a7-9914-497c-9241-cf754023a28d	sviluppare processi di produzione alimentare
906b6c25-b889-44cb-8ef6-37f17f76c4e1	fornire consulenza nel settore della psicologia della salute
907a2cf7-4c49-4c54-9907-677bd43c2e0f	gestire il personale socio-sanitario
90605e0f-aeda-4a81-868e-67f7a1aa33ab	smaltire i rifiuti non pericolosi
907bb8a6-59ec-4ede-8eee-9c4f700c91f4	gestire gli aspetti della gestione dello spazio aereo
908cd577-2e63-4183-8ed6-6a73eef38732	prendere in carico i pazienti inviati da altri professionisti
9081fd37-e470-40cb-9328-c947a86f0806	controllare le fatture relative a un evento
908b9d6e-f304-46e5-95bd-d296401f839c	scrivere in polacco
909af5b9-0504-41cc-bbe3-5eda52283e88	sorvegliare il locale di asciugatura del materiale pirotecnico
90a7fd75-1a97-4c8a-a106-737e02e6f2df	tecnologie di formatura metallica
90c4f7c3-6654-4530-859f-6b5fbd3dc369	analizzare i comportamenti nocivi per la salute
90ba5dd4-ffce-443e-a761-477f382fb2ff	alimentare i riproduttori
90dca942-1cb5-4555-9671-3a0d6b5ab3dd	consegnare la corrispondenza
90df0ff0-2a13-466f-94f9-39f5cb2b79bc	JavaScript Framework
90e052c8-1e04-4db6-a79a-8fde6b53a896	mettere a disposizione una persona di accompagnamento dei bambini impegnati sul set
90bba5e2-fd6b-4fa9-ab63-dc42d7804976	considerare le zone umide nello sviluppo del progetto
90d0ea5b-9f0c-4f98-bcbe-364ca0ca9418	manovrare la tbm
90d77398-3a32-46e7-9547-d6c7f9f57c03	ascoltare attivamente gli atleti
90df24c2-c0bb-4045-af01-f26edb53bc34	consigliare i legislatori
90e72c3c-5986-4284-8631-4789576d5cb8	procedure radiologiche
90e770ba-229c-4f7b-8124-16d705307f90	essere addetto alle macchine di pressatura del cacao
90ea45ae-aaf6-4f81-a814-d0725a4b5618	proporre gli articoli ortopedici ai clienti secondo la loro condizione
90f57b86-cf1b-44f9-ae71-c2a5632bdb56	autenticare documenti
90f4fc8c-f6f6-4c52-91e2-4bb17e4059ad	interpretare la comunicazione non verbale del cliente
90fb084c-656c-426d-8736-e180bd7152ba	audit interno
91036151-fc90-47be-bb61-a7f703265343	sicurezza in ambito TIC
910f4c8f-9fcd-4ecb-9900-7bd9ac1ba2bc	posare l’adesivo per la moquette
91101fac-d76b-4654-9137-cc2ead774b40	controllare i costi di produzione
91127ded-4ca9-4425-ad01-30a1fae70cd2	interpretare in lingua in occasione di conferenze
9111ad0f-1821-4504-8167-7ae0f93c22ba	applicare le decorazioni ai drink
9120d1e4-7bce-4ded-bf82-8e52ad2e280c	sviluppare le opportunità per progredire nello sport
91174ea3-a2a1-4469-a259-cd6575958384	tecniche di audit
910aac58-1a29-445c-9f4b-5d88d4a86533	scaricare le forniture
91211fd9-33df-4747-8eaa-d9be55ecaca1	svolgere i patch test
91189c8f-e60f-4526-be1c-a33161e6b9bb	produrre le relazioni sulle vendite
9124b8ad-3b72-4474-b18a-59775c7a42a6	contestualizzare la collezione
9146e526-6b3c-4771-912c-b1e2e7557a6e	interessarsi alle operazioni quotidiane dell’azienda
914fe0f5-5aff-4715-844d-68d8459cd5b1	abbinare gli attori ai ruoli
9137d2aa-6b77-4f99-bd3c-5b5f0c1a3bbd	maneggiare la sega in modo sicuro
9150881b-275a-4a03-b809-0e0fd10c54e2	installare sistemi per pozzi di scarico
915304b0-c48c-4b54-8967-65e0fd918f75	eseguire la preparazione di prodotti
9151cdb8-1e98-4c92-91f3-277a2cebc064	difficoltà di apprendimento
915d62db-f5b1-4f99-ae31-b5a489cb0f33	metodi di inventario del combustibile
9166bb17-2547-466f-8ee2-b2c19e24579c	dispositivi elettro-ottici
91574a37-6754-4405-9636-0175328e0ada	sostituire un rubinetto
916dcf7e-fa8a-4fcf-a264-215e6e02c8c9	rispettare la riservatezza ed essere discreti nei servizi di accompagnamento
91690eb9-293b-40f1-8ce6-f6ad3da4b7fa	aree geografiche rilevanti per il turismo
9174f0d1-f605-4149-ba77-0e5fb41db149	utilizzo delle attrezzature sportive
916b55d5-baaf-4d23-b149-6c7d3137c66f	dichiarare la produzione di pesce catturato
9175fd83-afd3-4d6d-9998-89b2e8742f28	praticare la terapia della Gestalt
91799c44-93ae-4358-91d0-079359584bef	composizione dei prodotti di panetteria
9186c1d9-1299-45f6-9efa-0e9c1fcf876a	comprendere il basco scritto
919ac0c1-4594-4ccd-b344-0a2303996544	struttura della patente di guida
9181b7f5-7791-4ac3-be9f-ef44d85565af	garantire la sicurezza degli ingressi
919e5cd9-726f-49a4-b267-def83baa6c00	preparare il bilancio del casting
919973cd-7af7-46e8-8150-7f9708ab3d0d	testare gli effetti pirotecnici
91a5e76f-5519-404a-acdb-f83dd3adaad6	strumentazione di una centrale elettrica
91a7ef9d-12da-4d8d-b72a-75d5b9d08d7f	sviluppare politiche di controllo delle zoonosi
91ad9fa1-ea9b-4da2-8cf5-a887c895aa1d	ispezionare le attrezzature per l’acquacoltura
91bfc307-754d-4589-8395-65691098c9e8	sviluppare prodotti farmaceutici
91c3bd79-e993-4c8f-a8d9-33d562049e3f	progettare sistemi ottici
91ac6b37-ca66-462d-95bc-09834850246e	verificare la presenza di anomalie nell’impianto elettrico del veicolo
91c4d3f5-155b-4bf9-b711-49aaf098da31	creare candele tramite immersione degli stoppini
91d63fde-6ebd-4658-a43b-83338019473c	rispettare la riservatezza
91db8afd-46d3-4995-8c40-65e7d9dd6660	unire strati di gomma
91cfd3bd-5199-42cc-8dbf-499bb94b6f15	gestire le aree di parcheggio degli aeromobili
91e55fa4-b672-4d40-b10b-954b23820918	gestire l’ufficio paghe
91ecea9e-e0ed-4ed8-9022-50ab2276060f	smistare i carichi in uscita
91fcf56f-9879-41e8-af96-8e4d2b1db16a	chirurgia generale
91fec511-4c6a-4588-ba3e-d0ac9a84a926	regolare le audioprotesi
91f3e149-5979-4b75-9ff2-234351fecc30	dirigere l’utilizzo di attrezzature pesanti da costruzione
92045dbd-cec6-452a-a849-c1380b7e27c7	tipi di spazzole per sbavatura
92036694-3d55-4f53-85a2-72008b0eea96	intraprendere le procedure per soddisfare i requisiti di volo degli aeromobili di massa superiore a 5 700 kg
92087713-a8d5-4a1e-a4ab-6ddc2a9a2af5	utilizzare i macchinari di termosaldatura
8fccf8f7-0444-4464-af76-84c9a3c39a5d	geriatria
920c680e-236e-4634-90a0-ece77283f706	gestire la produzione di risorse acquatiche
9206c9a5-e5d8-41f8-ae09-dd25dd8a8da7	svolgere le consultazioni sulle patologie
92126f17-5cbd-48cd-aed1-22d14021cc4f	determinazione del prezzo delle parti
920afaf5-f1e3-478c-ba58-c2cfd08ddafc	spostare il legno trattato
921291b2-d0ed-4846-ac8b-a1f9e5f3427b	strategia editoriale
92186998-4120-4201-9f7c-f1eec5ed0585	selezionare l’attrezzatura per il pozzo
9220db1a-6e65-4c1a-b78d-4ef175f1135c	lubrificare le ruote del materiale rotabile
92244594-ebca-4eef-b783-611aedb2b334	manutenere dispositivi medici
922a7dea-77c5-46dc-896a-71272a57886a	governare le navi
92318cb9-334d-41ed-9015-081a793abbdf	garantire la conformità con regolamenti e normative di manutenzione
923967c4-b181-42a6-ae7f-6725131521f6	prodotti di legname
924c16d2-330d-4b08-ad5a-332e046cd374	decorare i prodotti di pasticceria per eventi speciali
92528f3e-f12a-4ed6-aba9-1504756a9a3a	effettuare i test virologici
925b1ba8-6d9f-4774-8898-ed963cedc8d6	azionare le apparecchiature audiologiche
925fac2c-fc93-401f-8ccc-514d358d16f6	maneggiare la pietra calcarea a temperature elevate
9263f283-47fc-4d56-8d55-b7c61c6c4496	installare l’elettronica di consumo
9272b044-5610-41f6-81e1-d42a2951c38c	utilizzare la pianificazione incentrata sulla persona
9275e5b2-805a-4079-badc-61ada702fa91	servire la birra
92533ec4-4e32-41bd-84cd-dc9ac0c0db91	organizzare i documenti aziendali
9262d5e7-16fd-4483-912b-58d8b69499b2	diagnosticare i problemi dei veicoli
9280e437-8a90-4870-81f1-53f59de96e46	termini di cancellazione dei fornitori di servizi
92855357-8030-4edd-be64-1b33549ec44a	immagazzinare le scaglie di sapone
9282ab18-44a3-4e60-9b16-822841cabf03	montenegrino
92773851-b738-4b26-9f92-b739620b63f3	controllare le normative in materia di sicurezza degli alimenti
92841fb4-8b1e-4414-b370-b5094a517ac0	vendere l’elettronica di consumo
9286c0a4-838c-492d-bc75-b63e3f2b5b94	essere addetto a macchine di rivettatura
928dfbe8-83f7-48b7-b967-96712ce0d860	realizzare gli strumenti e le forniture del maniscalco
929a3c62-c2b6-40a0-b414-9cecb8ecb4ea	scrivere in francese
92a5159c-cc62-4460-ab91-bb9cf4943e65	buona pratica di laboratorio
92977573-f95b-4c9d-9e73-4ab6a87580e3	condurre le visite per l’affidamento
92a1d76d-0e66-4de9-8207-b585e435e414	impostare controlli macchina
92a7d83b-eac8-437f-b239-382570abcf76	eseguire la revisione delle sceneggiature
92a01710-9c6f-45a0-977e-8bef66dd4337	pulire le superfici
92a93ac3-81f4-4cdf-8936-e157e11f9dff	creare una struttura rimata
92af3fd9-f8ac-43cc-aada-c791c91a3c26	ortopedia e traumatologia
92ade6fd-f3ed-407f-a60e-7b5f22d580ae	alimentare la macchina che miscela l’argilla
92b1992e-50c3-4ff2-91f6-3d9045dea771	utilizzare la terapia fotodinamica per il cancro
92bbcf98-9108-49f0-90a9-105253581125	insegnare i principi dell’elettronica e dell’automazione
92d14fcf-f1a6-4e7e-b0d5-8b6e2c69b8af	comunicare durante lo spettacolo
92acbc31-71db-48f1-9aa5-caa63915c3dc	pulire le superfici in vetro
92dfe691-700f-4002-97b6-8eaf57548ddf	installare rivestimenti per pavimenti
92e5fd6e-81c2-4343-994c-bd8c0083bad2	confrontare i valori delle proprietà immobiliari
92f0fa63-869a-45bf-a3da-f6329111aa7a	preriscaldare il carrello del forno
92efcb79-9b6a-40c1-bef7-06417045cce4	manutenere i macchinari router
92e6de5b-74a6-4a8b-a404-defa5f3b8f5a	selezionare le attrezzature ausiliarie per la fotografia
92e9382a-f27c-45d9-b6ab-54d39a05860e	sviluppare gli elementi visivi
92f48be1-2163-445d-b0c3-f1c37aaaa344	definire le scene di videogiochi
92f4bbb9-4718-48c0-90b3-abafb2464202	preparare le palle di argilla
93034943-813d-4e6a-b55e-b8e7d9c7ea38	individuare i meridiani energetici
9303f5a8-d79a-4f07-8f94-319bf330a493	adottare un intervento di crisi
92f88f9d-8fa0-425c-8b2d-a96474931cfc	custodire le armi di scena
930600ea-7de8-419d-970f-753cf510eed3	effettuare la tracciabilità dei prodotti a base di carne
9315f560-df52-4077-853b-b3a6bef4d29f	utilizzare macchinari per l’applicazione di chiodi
931cccfc-7f4e-4c11-9941-22518e52f400	promuovere le attività che stimolano le abilità motorie
9314a292-238c-4047-955c-2b8b0aff275a	seguire le istruzioni verbali
931c9a7f-2166-4f8f-bd87-7d3f087055d8	procedure per le azioni risarcitorie
93249b57-fe3d-455f-92d5-acc08407c121	manutenere hardware informatico
93257af1-546f-4087-8a2c-6883152e4394	Hadoop
932c56d3-80bf-4910-9c72-0d9e2c362898	svolgere una prova nella macchina per la produzione di sigarette
932f6244-778d-47f9-8dfc-259ffdb119ae	utilizzare una pistola termica
9326cf36-a6fc-47c1-ad8d-61c3b24eccf0	installare le macchine da miniera elettriche
9311a8ae-322e-44da-ae9c-48786e6479e9	documentare le azioni di sicurezza
93365997-3aa6-4cc0-938e-31b7da963b55	gestire il flusso di cassa
9348a0ad-40ee-45ed-b6b3-1a34665ef670	progettare schede di circuiti stampati
9340854f-edb9-41aa-9f2a-562656b43088	utilizzare i terminali di pagamento elettronico
9356b952-cac5-4998-a41f-1209be4c1fb1	costruire gabbie per cemento armato
9349417e-7321-4069-b5a9-a961c618d262	prevenire i problemi tecnici delle attrezzature di sospensione
9357e8e3-d59f-490b-b329-625265c32c43	consultarsi con i clienti aziendali
934b42b7-d756-41ab-a120-e1694876e470	dimostrare la funzionalità di videogiochi
935f11e5-1001-496c-8f4c-778b30bf5540	effettuare la manutenzione degli oggetti di scena
935f09de-16be-45cb-b8b6-8baa8bde3e53	requisiti in materia di sicurezza delle merci trasportate mediante condotta
93632970-bd6e-474a-8d09-948c23a317bf	interagire verbalmente in bielorusso
935f21f6-49d6-4d90-8826-21db1668d80e	pianificare gli accordi postvendita
93677978-9053-43b9-8c6f-be0041f32fca	sviluppare prodotti chimici
937acdee-66ad-40a4-b921-f92153c706fd	perle coltivate
937f482d-32fe-488b-88a9-42c405c5ccff	meccanica di precisione
936c8b7c-f9a5-478c-a8ed-1ff33e541943	MySQL
937ca910-bf87-49f1-b7e7-202196a89d8b	individuare le risorse umane necessarie
9381ebb6-cb85-490c-a584-684048f41dfe	sorvegliare i macchinari che producono scaglie di sapone
9385d57d-1b09-47ec-801f-930dd040e055	attrezzature di proiezione
9385e097-5984-431f-b26d-8eccc972fa53	effetti psicologici della guerra
9387c2e1-052c-4bd1-8447-7cde29f857b6	scrivere in turco
938b1644-b740-4181-a8e4-48d3302a4b64	applicare le norme relative alla salute e sicurezza dei prodotti di panetteria
939166c4-b9a4-4821-a3e9-a19c68362b07	mantenere i contatti con le celebrità
93a8ff14-722a-4f5e-aada-c36d6bfa0d4e	gestire i pazienti con malattie acute
93a52de0-39fa-4541-a069-02e65a0c253d	supervisionare le squadre addette all’orticoltura
938be3d6-cbe9-4f7f-9c84-107995f81e3f	interpretare gli elettroencefalogrammi
93acd546-09d4-44f9-85ee-1a1c1dc1c80e	creare schizzi architettonici
93ae72b6-ce2a-408a-8ac4-676e8034c909	supervisionare il gruppo di audiologia
93aed3bf-b315-4809-ab3c-76d2ef6f0021	pianificare la produzione di calzature
93b1629a-ebb3-49cd-84ca-c1cd5d98d4a4	vendere i biglietti per un parco divertimenti
93c10bc1-d633-4544-920f-d74d6f2d34e7	fornire assistenza durante il rifornimento di carburante dei veicoli
93c14164-e59b-41e2-a465-0e1534a7e6d6	organizzare i programmi pubblici di salute orale
93bf8ba8-9257-4702-ba3c-2e3f3a224e10	gestire gli eventi sportivi
93cbb0be-b2be-4ede-a0e8-292e3dc4bcb8	raccogliere i rifiuti industriali
93c6a14f-31f3-4061-ab7b-36eab1971a03	trasformare i sottoprodotti di origine animale
93dda65b-36f5-46de-8d60-e3ea8e8bb928	prodotti detergenti
93d93e03-b77b-4795-88d4-2ab879e526b1	installare i sistemi di irrigazione
93e013ae-b446-4fef-9a1b-da48e49fecb5	essere addetto a macchine trafilatrici
93f15b34-35cc-47e7-bf1a-8a08609d10dc	individuare la progressione di una malattia
93edec6d-919e-496a-b539-37f59308cb22	manutenere apparecchiature meccatroniche
93f44915-30f9-4272-b421-6ba124b6ea50	mescolare il materiale per il pavimento alla palladiana
940075fd-3c7c-4206-9621-a5fc0535890d	usare sistemi di traduzione assistita da computer
93f79225-9d7c-4c76-b554-4aea35d6e9be	personalizzare le armi da fuoco
93f7e65d-5509-469a-b239-6de770ef647e	fare funzionare le giostre dei parchi divertimenti
93fb230d-5864-451b-a992-6151b3a26067	utilizzare apparecchiature di brasatura
93f3c444-eb07-445b-8ca2-d486ba7bb86a	Apache Tomcat
941c50d9-56cf-4ca7-ad39-d11824dcd0c3	tradurre tipi diversi di testi
941afc46-38f1-487e-83d0-2cf2d733e07d	disturbi dell’equilibrio
94236c43-1f9e-41de-8db0-b285a7292114	materiali degli articoli di pelletteria
9421ec9b-6711-46cc-bef5-c8ae37425ab0	riconoscere i segni della corrosione
942898d5-8613-499d-a808-ce390a9b023a	azionare il martinetto di sollevamento idraulico
9424ac76-8fc4-4aa8-8d5f-8e490d0890f2	interagire in modo sicuro con gli animali
9438db31-97de-4e7b-ba5d-5a01096468d2	tradurre le parole chiave in testi completi
9431588d-36cb-4f81-bdb4-15c61e43f5df	sviluppare strategie di emergenza elettrica
94475615-f21a-42d7-8e43-58be4085dad7	metodi di costruzione
9457ae5a-9a38-448b-82ed-d6dccc0d6f97	installare l’unità di controllo per ascensori
9447fef7-7061-4be6-abfb-94df8898be26	sorvegliare il forno per la colorazione del vetro
944565fa-be3f-47e3-a98b-b914c23f898a	imbonire i partecipanti a una vendita all’asta
9460db3f-6eba-47e4-8015-4f35d7d9e21d	alimentare i cilindri
94432334-4f6a-4101-aa25-89e8085a73f9	fornire osservazioni agli artisti
946c815e-c86f-4081-8c70-9b8fad884fec	gestire le risorse acquatiche
94745e54-b860-41ac-bc6f-34dfabe4e47d	utilizzare gli utensili per incidere il vetro
947c4a95-2139-4a5d-be14-89b56334fe59	installare gli elementi in legno nelle strutture
94616b2e-7f69-4fa3-93f0-4be897be9e51	installare i sistemi di riscaldamento a pavimento e a parete
94852834-162f-43ba-ba42-39b1882046fe	curare la documentazione di notifica degli incidenti
948478a7-8cb7-4059-90f4-f5bcf34b86ee	valutare i risultati dell’ispezione alimentare in negozio
94898750-aa37-4c56-ae2b-be2bb34120a6	riparare i macchinari per la bordatura
94a70e82-417b-42aa-a9b6-6f966a571318	essere addetto a graffatrici con punti metallici
94aafd2e-d377-4736-8d5e-a5c1e113aa93	sorvegliare le procedure di incenerimento
94a47b05-48ef-4375-8571-f4294e792a76	contribuire alla realizzazione dell’intento della direzione artistica
94b3c2db-1a44-4076-b732-73e77d2e284b	fornire le attrezzature necessarie per l’attività di estrazione
94911999-f158-45c0-9b56-23ad7ceeb4c6	fornire informazioni sui prodotti finanziari
948fc0c4-205e-453f-bc93-c840d545ab57	posizionare i veicoli per la manutenzione e la riparazione
94b6a599-5e01-4930-bdeb-5ed6a70ff339	garantire l’operatività del veicolo
94b4b454-c876-4b5e-b5ad-aae3ad750c6b	raccogliere dati sul clima
94bda2d8-4993-4b1d-879a-891f3797902d	Andare a cavallo
949536a4-aaed-4d60-b05a-ac6866cdf6c3	compilare i dati per le pubblicazioni di navigazione
94bdf627-a620-423d-92d3-a25714e4bd73	applicare le linee di condotta in materia di stupefacenti sul posto di lavoro
94b85a83-4431-43af-b16d-350f5dab1181	installare l’impianto elettrico in un autoveicolo
94c3f0f0-d8ce-4d55-9a33-d956dd13c837	comprendere il lettone parlato
94c60200-50cb-4751-97ae-d59c842587ba	preparare le funzioni religiose
94d91bc6-bb33-4b85-ad0b-44d850a2baa1	sviluppare i programmi di lavoro per le aree naturali
94d54d69-4823-4699-8bc5-37c0424da21c	settore alimentare e delle bevande
94e1664f-414e-4908-9f9f-414786597824	partecipare al comitato accademico
94e514c9-e1e4-4dc5-8eee-8ae0ce88fd2a	accessori per strumenti musicali
94d142f0-9895-45bf-b86c-521076b8f0cb	N1QL
94e49a75-da72-4d53-a001-00c2de76be10	elaborare una strategia di gestione degli animali
95090e23-830e-4c2f-865b-fad51f88e65e	oncologia medica
94e8ea95-aaa7-4eee-939d-915d4e3bf73a	modello ibrido
94f39878-d204-4f6f-98b5-6f76b607e06f	verificare la precisione degli strumenti chirurgici
9526768e-8d90-4166-86c6-a253672ff28f	smaltire rifiuti non alimentari all’interno del settore alimentare
951359a6-3665-4a24-beaa-5e75951f51d5	e-learning
951e6e0b-38f2-46ca-8c23-0659b7f87520	calcolare le dimensioni dell’incisione
95002dd8-d5b8-443b-826c-8f04c2dd83e4	assumersi la responsabilità di mantenere un ambiente sicuro sulla nave
95121523-8bd0-4372-8648-0042a38d42d7	fornire ai clienti informazioni sui prezzi
95122882-bae4-4bd8-995c-026d6a92183a	azionare la pompa per il trasferimento del lattice
952f4b22-7951-4f17-8886-db692298d729	sostenere i fruitori dei servizi sociali in relazione a specifiche esigenze di comunicazione
952b8255-4cff-4f73-8fd7-ec86c2f7e0b1	gestire le scorte di carburante
953e623f-0e4a-4da1-9ee2-f8ba2dcac44f	fotogrammetria
953cf980-a7ad-4ebc-85cb-039bad4d9358	considerare i fusi orari nell’esecuzione dei lavori
954a61b5-ce81-45a3-8688-f31b9e31bca5	tipi di pietra da costruzione
9544acba-6ad6-4fac-bc64-1165cd6766b0	gestire la qualità dell’aria
953172dc-5c1d-46c0-a438-a1501f2deb22	effettuare la manutenzione delle macchine sabbiatrici
9549c812-4ffa-43bd-bfa3-abaa7cda6c61	creare i giochi d’azzardo
954e67e7-370a-46e8-8fdd-e1ba531e0261	eseguire la manutenzione e la pulizia della nave
955121ac-b844-4bdc-a6ec-752b0b9bad2a	utilizzare setacci per estratti vegetali
9554f09d-4738-4b56-a3d5-d5eb9a244390	ottica quantistica
95624fd2-d8a2-4021-b17b-d1fc5befc07f	sostenere il consenso informato
9566de3b-e2b4-49e6-b304-b635b8630ff0	gestire sistemi di strumentazione
95691582-6051-4edd-b5ba-c2a75b84acc7	gestire il controllo degli organismi nocivi e delle piante infestanti
9582a90e-59a4-4579-b423-7554eec9ae31	vendere prodotti e servizi assicurativi
9584a615-ca5a-40da-8b4c-167771f4419e	tecniche di rilassamento
9589653c-4441-4d73-b6be-3eee3ec425cf	utilizzare le attrezzature dell’azienda agricola
957689a0-e0c6-46e9-b7b3-134ac5d07f36	condurre le ricerche di mercato nel settore della gioielleria
958e0cd8-033b-4db7-a3d0-968916d77f57	insegnare matematica
9596f87b-ae8c-49dc-b728-8b34e31fdcd5	montare casse di orologi
959a1e02-70d2-4bd8-87b4-d5d366aa08ba	lavare i capelli
957f2e1c-8d29-4a74-a74c-98e6531a5cb8	proporre soluzioni TIC ai problemi aziendali
9598901a-dd1a-4e76-9cc7-d3149ea14b92	valutare i problemi del vigneto
959fa84f-c36c-4995-9640-b33d35603439	agire contro le violazioni di sicurezza alimentare
959f6666-9e8e-43b0-8f97-3a794a1d3a82	garantire adeguate condizioni igienico-sanitarie
95b7747a-318c-482e-828b-4132285096fa	preparare il piano di trattamento per l’arteterapia
95b97cef-1ba2-4f33-bdc8-f03a32e2798f	installare unità di servizio per i passeggeri
95ac39b1-c02e-4f90-a902-c12c94d4e1ed	provvedere alla manutenzione di forniture e attrezzature da campeggio
95a4ea11-bb04-42f7-ad5d-39f41ac16316	garantire il rispetto delle norme di sicurezza durante il trattamento di malattie infettive
95bf9f4e-2b8d-40f1-a495-c42be255e832	fabbricare i cosmetici
95cf915e-7f9b-4fe0-b7c0-a103608027d1	preparare disegni esecutivi dettagliati per l’arredamento di interni
95b5a577-16e9-493f-b776-93005bdf7e81	educare il pubblico in materia di sicurezza antincendio
95d27c5f-1ade-4e63-a6f2-bf2a98117e8e	costruire macchine
95d8288d-f175-495f-8c2c-b1da7d63dc13	geografia locale
95d829ab-dbd1-47ba-9b53-d13816af933a	trasmettere tramite protocollo Internet
95d8ad4f-d208-4f6b-ace4-fe8149afb54f	proteggere la zona circostante durante la pulizia della canna fumaria
95d6c9bb-bf1c-43d1-8f6e-533662f24826	utilizzare i sistemi di comunicazione portuale
95e1ea41-d103-48ad-8173-00b24ba116e9	fornire informazioni sulle medicine
95e68049-2cba-4eb2-9c3e-ae2abb894347	creare ambienti 3D
95ee88bc-8e02-47b7-b711-34a49d5de93f	psicofisiologia
95ee32c9-b341-4116-95ae-561c521e9016	spruzzatori di diserbanti
95e44fdc-85f8-4078-a5e9-33cd4845bf11	intraprendere un’attività di ricerca chiropratica clinica
95f65d13-4757-46a8-aaea-0846b87f5756	informatica medica
95f845a3-694c-42d2-b44f-de88d334fcad	guidare i veicoli
95f1ef67-3b2a-4253-a791-b8e5f5084adc	risolvere i problemi tecnici
9608911c-4080-4e30-bd17-72bc5cff5502	pulire i pavimenti degli edifici
95fc6abb-55d0-466d-b239-b0e60dca13dc	utilizzare i sistemi informatici di bordo
96104e42-7866-4d3e-8634-0c4a1fbf6ed0	rispondere alle domande in merito al servizio di trasporto ferroviario
96129e0f-2e8e-4c45-8ea1-e55850f7f749	viticoltura
961381b0-91d5-4558-a018-6904c1812b8a	gestire la produzione di calzature o articoli di pelletteria
9619f390-80cf-41df-a843-23ba01b885e2	progettare sistemi microelettromeccanici
9615dcd2-9d34-482e-9654-77bb80d8522f	aree geografiche
961b1fc4-c366-4e11-88d7-d92e8d1b3b4d	legge sull’immigrazione
9620fb9b-afeb-4662-9843-81500ef4b8a0	procedure di recupero degli animali
9621db3d-be1b-4451-b1d6-5e139e97797d	preparare materiali tipo vimini per l’intreccio
9622dc74-b79a-4226-be25-8027d9d4a021	usare le lingue straniere negli scambi internazionali
961ccbe5-86c1-423e-9224-71225f1481af	sviluppare i nuovi prodotti dolciari
9623a3c8-305a-4f70-80b5-d8f30f94d376	fisiologia umana
962594a9-5b71-496e-9641-b4a5d65ee67d	controllare le spese
963b7dc2-051f-4fc2-9081-0626418c151e	regolare i processi di fermentazione
963458f6-1de8-4947-bd2b-1c7eb83a8420	immunologia clinica
9642321e-4931-40bd-9287-3f47b589ef86	medicina interna
96591ad0-add9-4e2c-a115-a670b1ec8556	eseguire i controlli richiesti dalle convenzioni internazionali
9642e95d-d9a1-4c6d-84ce-8e0bc77e87a6	acquistare i generi alimentari
96504805-4764-4150-aeab-74fbc7c82fb3	adattare le composizioni
96628048-6383-4b20-a9f7-6d9664659fcc	installare accessori per veicoli
96623dfb-e24b-4c17-aa41-b783d39f1294	segni di malattie veterinarie
9667d292-96d8-4373-ab0d-f5b75a9e6614	perorare le cause di altri
96705418-038c-416d-aa03-90b55619bef9	gestire i pazienti con bisogni speciali
966cb97b-8a42-4cb7-85ff-e91e3e265f4a	garantire gli standard di garanzia della qualità per i veicoli
96741eda-5030-487d-9069-436c1db81d0e	acquisire le licenze per l’uso di armi
967132ce-a0e6-466a-8bea-322dc08a4628	rimuovere la carta da parati
967ee9de-0643-491b-b383-e346d34e52c9	valutare il fabbisogno energetico
9670ede0-0728-4aa1-820c-53c58375551a	collaudare microelettronica
96840287-4f2d-4e8a-aadd-4caf812104ce	lavorare con diversi gruppi destinatari
96841070-33bb-4c38-a0b7-be5aabd32f7c	organizzare gli eventi di campionamento per la vendita al dettaglio
968c9020-9907-4718-8526-70eb20c800f3	utilizzare gli strumenti della parapsicologia
96869a68-1ed7-4148-974d-834c63463656	assistere nello sviluppo di procedure operative standard lungo la filiera alimentare
96957573-9807-4a22-8293-634d0cc05a2d	chirurgia toracica - cardiochirurgia
969a795d-e514-40dc-88b8-9eb4ae20ae03	salvaguardare la qualità artistica dell’esibizione
96999469-17ab-44e0-a19c-57ac00147179	gestire banca dati meteorologica
967a3966-b104-4abb-a722-c7fb7cc23802	ingrandire negativi
968ae116-d613-4681-a8f5-131eee024024	effettuare una valutazione psichiatrica di un minore
96744314-10de-41ca-8d75-47ae4e5763c0	riesaminare le procedure di gestione della distribuzione
96a0143e-5cde-4a2d-b20c-e2595ea44726	adattarsi al tipo di mezzo di comunicazione di massa
96a1fa13-160e-40fc-96e7-474a1ea9dfde	dimensioni della carta
96b008a5-2238-4069-8053-6d86d60916d7	promuovere la comunicazione tra le parti
96be5834-24f5-4643-9e30-594c8798177a	selezionare gli episodi pilota delle serie TV
96b8b7fa-5514-481f-83a8-d35f22b75c6a	fornire consulenza sulla scelta del sito
96bb423f-6135-4b99-aff4-075692d3ac77	consultare il produttore
96c03199-bbfe-4bac-aaa4-1e973a50e555	stili di regia personali
96c2d079-e034-4be5-9991-6773987ec8cf	valutare i pericoli impliciti nelle operazioni relative agli alberi
96c70fdc-414d-4bcd-a56a-6595bb3138b3	elettro-ottica
96a02bb9-fd78-4278-8d67-70c2b265281d	PHP
96ca370d-3011-47ec-bc70-3f34ee0c21af	sistemi antincendio
96c50093-77a7-45ee-a91f-a0d63bf30096	mantenere un archivio dei documenti del museo
96ca5a51-2399-49c5-a463-9a283d1467c5	tenere la banca dati dei prezzi stabiliti
96d1a54c-e674-4de4-a15d-b98a996aa7e1	contribuire al processo di riabilitazione
96d39840-ce97-4b21-9adf-6e5f3d3171a9	rispondere alle chiamate di emergenza
96e16587-1086-4267-a8d1-e0f65c03b9e2	tagliare la guaina di coibentazione per edifici
96d47507-9594-41d5-a964-fe585bb8e876	tenere lezioni
96de21ae-698e-422b-a5bc-5a847f8b3d4a	individuare i rischi delle attività navali
96f0f0a0-17c5-4368-9710-985e82cace30	spiegare l’utilizzo degli articoli per animali domestici
96e36b5b-7433-4fbc-8377-baeb5316feec	mantenere i contatti con i finanziatori
96e6d22a-6f28-4f69-81c8-50b8cf4fc901	mescolare le vernici per veicoli
96efe02e-34b5-46b3-ad56-48956979ce67	insegnare i principi della tecnologia di laboratorio medico
96f5b688-e5b0-4684-85c6-105568534b46	stimare il valore di orologi
96f5c046-b000-42bc-88bf-8c9692959b33	tipi di giuramenti
96f69e67-637e-4923-936e-b028a172d400	utilizzare le macchine per la lavorazione di frutta e verdura
96f92ae5-14b9-4ff8-94da-130b36b51965	sistemi di credito
97102508-dd86-4f7e-bc58-16a283f561f4	supervisionare i sistemi di circolazione
971c9fbc-27e1-419b-9616-f17fb5e84dcf	essere addetto a macchine laminatrici a caldo
96f574cf-dca7-4001-921b-5c08647696ac	cercare gli esterni adatti
9712cbc1-cd59-4eb3-abf2-24957b8fee42	spettrometria di massa
972421d7-b7eb-4849-b8c9-a6c12079168b	metodi di indurimento delle foglie del tabacco
973a75d7-f310-410f-bab7-377483d0851e	caratteristiche dei volti
97486d52-fb2a-4c6d-aff9-91ad81f11ba2	metodi storici
974ad71c-a4b3-42d4-ba24-7da48f02abaf	scrivere in giavanese
973a274b-90c9-4cc9-87d5-94d85f86bff3	adattarsi ai cambiamenti nei piani di sviluppo tecnologico
975dac4c-c2f1-4c8c-b12c-676c3ec5b930	illustrare ai clienti le varietà di tè e caffè
97637ec2-b1cc-42ac-84d7-5af218a35998	occuparsi delle delegazioni commerciali
97644712-0bef-45bb-aeb9-0487da94fe64	segmentazione della clientela
976181af-014d-40e5-bfa7-461d6c538ebf	selezionare la confezione adatta per i prodotti alimentari
97722383-d42c-4879-9f09-52cd8667e8e7	posare le tegole a sovrapposizione
977aaef2-5815-47ab-ba36-f9dabb31a6e1	tipi di frese per pialle
9772a208-7eab-4352-a636-3dc905e2a3ab	parti di macchina ricalcatrice
9783f90f-a224-491c-a84c-9df314feb837	analizzare la capacità produttiva del personale
9784658e-a4de-4bac-bb64-a774734fd685	osservare il paziente durante un trattamento odontoiatrico
978b1c09-ceee-4b50-88ba-c08cd63d9a08	andatura delle imbarcazioni a vela
978b2bbe-3f92-42f6-8c0e-d656808b3f3a	occuparsi dell’accettazione dell’ordine
97a81c16-70a3-4a58-b67a-e0c441854d85	sistemi delle unità d’appoggio per attività subacquee
979ebd98-d43a-4823-909e-c3249b9a7f06	presiedere le riunioni del consiglio
97a9dd63-086f-42d9-b06a-16b12bbc83f7	occuparsi della gestione della biancheria
97ab385d-9084-40c4-b4a8-def5ff84aed6	contribuire a coordinare le attività promozionali
97b22cc9-aad1-464c-9e35-591cb9622b61	passare gli strumenti odontoiatrici
97c0c6a0-e6ca-478f-8eb6-f4d7b5888492	interpretare le interfacce di comunicazione grafica
97c48229-5490-4dab-bdf8-75aa055c7eef	svolgere indagini subacquee
97ca4118-7b17-40d6-b210-d684d8526fb9	applicare la biologia della pesca alla gestione della pesca
97cb94f4-f9e1-4b23-bc59-7343cf80811d	realizzare fori nelle anime
97ca2e6f-647b-4952-9bbe-542a3e5915af	osservare norme di qualità nell’ambito della traduzione
97cbf4c9-82e9-431d-95d3-ba4a3b101487	strumenti industriali
97ce4ac9-4c6e-420a-9a94-be57db236292	implementare una rete virtuale privata o VPN
97e5a7e1-5899-484c-a720-ac954075c6b1	riparare la lamiera
97e5498c-7a20-4d36-bf68-ec8439d25dae	coordinare la produzione di energia elettrica
97d0a56f-7ef9-4e15-a80e-e70325f9f3a8	raccogliere il feedback dei clienti sulle applicazioni
97f41857-4498-4d41-bc75-84e59cfa1751	pratiche di macellazione kosher
97e9b5a6-8d5f-40a5-8369-140ae7eac45f	interpretare i segnali stradali del tram
97fdd61a-a345-4037-b21c-7000d311013c	sviluppare le politiche agricole
97fa1eb8-1c3f-455f-992d-5b0ae1c9603c	fornire consulenza sul risanamento ambientale
97fb121b-5b70-4ac1-97f7-382f21c96634	comunicare tramite telefono
97fe6547-d37c-415a-bdc3-c81feab9b166	offrire consulenza su acquisizioni
980fe7f1-6be9-4fb3-a31d-0ea6227f2dfd	effettuare la manutenzione del terreno della vigna
9806f970-3b85-406d-9e17-05f975da43db	applicare un approccio olistico all’interno dei servizi sociali
98042391-6157-4a75-8779-7012a24b55b3	proporre i prodotti ottici personalizzati ai clienti
98175b16-d4d9-460c-972c-7ecf22c5759a	assistere nella conduzione di rilevamenti geofisici
9809c815-36cd-4790-be3a-e7603cc02598	applicare le procedure di pulizia dell’illuminazione aeroportuale
98183328-114c-4f95-b615-ebcf0e1d1c01	costruire le relazioni internazionali
98135ea0-0553-4b2e-8bd5-a89f3dc4ab77	prevedere le quantità di produzione
982ae9fd-ccad-4e36-8832-4f47b91bdb6a	scrivere in hindi
983197dd-3d72-45d3-a0dc-b4279c7d718e	rilasciare permessi
982c7cf5-582c-40ae-aec1-5863fbdc2a8a	prodotti dell’abbigliamento e calzature
982d7a5d-255d-4ab0-b881-f3f86d2cd896	gestire le catene di approvvigionamento nel contesto medico
983ce79d-ba5e-47d3-9840-af2c3f9b606a	riempire le incisioni
983ac2b1-d5e2-46fa-8c39-bba854d25a02	seguire il programma di lavoro
983d3ef1-f017-4089-bfd2-dc6aaad794db	attività di vendita
983ed60c-b61a-40fc-b91a-3e0b0f3d0717	rispettare le norme di sicurezza ferroviaria
98430254-5838-4ba0-a96f-a7e7ff5423b4	leggere articoli
983fdd16-e43f-4ba8-a34d-b9918258d378	ispezionare le apparecchiature delle gru
9844bc03-3dfe-4f58-8a30-a6cbe6068d3c	usare la programmazione script
984ec8fe-173a-476f-bebd-a140842a66cf	montare i cartelli
985264cb-0dae-46bc-b2ec-428592ce8cb4	tenere compagnia
98561894-72f1-47cf-8c58-5c9fb6b448d2	affrontare le questioni di salute pubblica
985ec51a-83ae-498e-8993-a8032014f472	segnare la pietra in lavorazione
9860b968-616a-4b4e-aa05-43777cb1f784	calcolare tolleranze di restringimento durante i processi di fusione
9862c054-ee6d-48a0-871f-4757d4de7be1	determinare l’incremento della percentuale di flusso
9861c610-df9c-4d19-a275-9273e05864b1	usare tecniche di disegno manuale
9864d532-7f76-418a-9e45-f9ef19a62ce4	sviluppare documentazione conforme ai requisiti di legge
987097a3-091b-4e06-9948-8886f76af650	preparare piatti pronti
98768be4-6e38-421e-8f40-d6c381101365	formare i professionisti religiosi
9878d015-7f02-4e5c-9684-6d8ebbb702ba	gestire i pozzetti
9864ad5c-d6bc-4bab-9a5e-41c69e4e941d	eseguire la manutenzione preventiva dei veicoli antincendio
96f879d6-863b-4cc5-9d0b-d9f671265746	riparare gli articoli ortopedici
987ac923-34a5-42de-ad65-e1184f753493	utilizzare gli strumenti di misura
987b2e27-c026-4047-922f-a8a99faf9024	gestire l’integrazione semantica dei dati TIC
987f4a81-7e2d-4566-a9bf-eec2f850ca4d	utilizzare gli strumenti di rimozione della polvere dai mobili
98818831-7587-45de-89d3-667f2fc68f20	parti in metallo della levigatrice
98867d32-e438-4a4a-972b-bcfffff4538d	operazioni portuali
989613b4-2ba5-4349-9ad6-0abf469a08f7	sessuologia
98a02798-904b-4cad-805a-74156626e13c	concedere le sovvenzioni
98969753-e404-4110-b461-2374b8ec5240	valutare i materiali della biblioteca
98a5a661-6184-46bc-81e4-31f5bcac8b91	imballaggio idoneo per merci pericolose
98912ec5-ebcf-49ba-91b4-8050518eee3a	individuare rischi sul posto di lavoro
98a8e4d3-6e94-4ca0-bdb0-da0131b042e7	manicure cosmetica
98a8fdc0-13be-4abc-b75e-5e38f088be7e	conservare campioni dei dischi
98ab94bf-9b6b-4e68-9481-4771878c27fb	costruire i ponteggi
977246f5-28df-4be2-bff8-9c3877a495c6	prodotti chimici
98ca497f-a5e2-41b6-ad68-b0cbb876429b	riesaminare la documentazione della nave
98bff0c7-e8ea-476b-bcca-0901ee237903	comprendere il polacco scritto
98dad570-4c14-45af-b838-aa918105655a	tenere registrazioni dei fogli
98e2b335-9485-43c0-912d-c5bf33a3ebc7	microprocessori
98ec9fcd-ff5d-4873-b2ac-5d914a0b25dc	distribuire materiale informativo locale
98f40a7b-c471-475a-8a68-d61622c311da	sintetizzare pubblicazioni di ricerca
98f49460-e04c-43c2-858d-6cab1668dcd5	ispezionare i documenti del vettore
98fe5e06-f275-4306-b9e9-0d7665b72b12	supervisionare le operazioni del pozzo
98f957e2-4d7e-4262-ab34-63bf3842300f	utilizzare attrezzature per il taglio del legno
991c3fc8-ba19-4285-be20-014c471edf38	modellazione scientifica
9933132e-a976-4024-adc8-8cd8d50dfdb3	costruire le dighe
991dba27-c655-4109-ae5c-a1a56541f0fb	industria cosmetica
9926690f-b0b9-45c9-9358-014fb9e8068a	XQuery
9939222e-944c-4c99-a516-dc86987d36a7	etica della condivisione del lavoro attraverso i social media
9943af58-047e-488a-970e-8f68a3d65d7d	monitorare le condizioni degli animali ricoverati
99485b79-e74b-4e53-b4a2-60902e5420d6	spolverare l’attrezzatura
9939f748-3260-495c-8c4f-781dbef6a0f2	eseguire il controllo di processo nel settore dell’abbigliamento
99440490-b99b-4c23-acea-18d46d5bab99	effettuare una valutazione del rischio per i fruitori dei servizi sociali
995d7f2a-65c9-4ca2-bea7-d96910182d21	tendenze socio-economiche nel proprio settore
9968ffdd-ab0b-4866-88d5-c7bf59cbd51c	trasformare il miele raccolto
996b1d2a-eaec-4ab1-abe1-290e60faa92f	vagliare i clienti
996b494d-ab5a-4e11-bfa7-fc4332d5c084	gestire i metodi di pagamento delle merci
9971621e-93fa-4361-9274-6dfb2f18985f	occitano
997437b2-7501-460b-8cee-3ea6ae145012	applicare le normative in materia di vendita di bevande alcoliche
9975cda2-2989-4443-b446-efc8298875f8	analizzare il rischio assicurativo
997d7422-7ac2-4444-a6ca-853691c9c3d3	coordinare le attività di perforazione
9981d630-4447-4314-a4f6-ce516c80cbad	controllare le colture
9980af9d-a18f-4b65-aa31-620384449151	neurologia comportamentale
9986ee9c-1a7c-4ce1-949f-7c5ed757270d	citopatologia
997f7745-0a70-4ce7-832b-36153b75ebe6	trasmettere i messaggi via radio e telefono
9983ab0e-a903-4307-bbe9-65ca6b64545d	endocrinologia e malattie del ricambio
998b351a-2af6-4a86-a38b-9308fbfb8727	rimuovere l’alcol dalle bevande alcoliche
9998c85d-c829-40ed-a8fa-0ed7da853157	cinese
998a9a5f-cfcc-4164-bfb2-70b1c9d2beba	assicurare la qualità degli alimenti
9988cccb-ce92-4299-8f3f-aaa16ceb07df	garantire la sicurezza nel locale per le attività sportive
998bf02b-a08f-4799-b874-70cad0689ac8	garantire il rispetto dei piani di distribuzione del gas
99a326d8-3d25-49ff-b52d-85bd69d0a96d	sorvegliare la pressa a secco
99a737ed-51ce-4708-b77c-8cf4dfd1f785	fornire gli interventi psicologici alle persone affette da malattie croniche
99a6ea51-455d-47be-b392-d4ff6b5c026f	produrre relazioni sul sistema di illuminazione aeroportuale
99a8b7c9-fc01-4002-9e8d-3dceafe671e3	interagire verbalmente in sardo
99ad3526-bf1f-4b82-aefa-db772da48261	normativa sulle scommesse
99adc782-3aab-40bd-9049-56db84d700f1	utilizzare la terapia laser per le patologie della pelle
99b5ba46-ca3f-4b4e-8fa5-bd0ac46ea5c3	indurire foglie di tabacco
99adc166-de98-441a-9a29-d182d60f1313	fornire informazioni sui programmi di studio
99b988b4-5475-4a18-9e41-f7af6a0ac1dd	allegare i giustificativi contabili alle transazioni contabili
99be606b-f964-4e74-afb2-e68824102abb	fissare standard di sicurezza
99c752d1-bdbd-4571-84c2-241d00610792	garantire la conformità ai requisiti di sicurezza IT
99ddd89d-7dd4-4947-b9ec-37fba4041cb1	scienza fisica applicata alla pratica paramedica
99dda6e0-56c1-4102-9382-4a314034fe2c	monitorare la superficie di vendita per motivi di sicurezza
99d480ab-e482-4a00-ac1e-7be46c34941e	offrire una consulenza sulla pedagogia della musica
99e493dc-ea4e-4f97-b2b9-4aeb3da9ee2f	lavorare i fanghi dell’amido
99e2f98a-f8be-4722-b117-99efa6625b64	distribuire i segnali di controllo
99e56f9f-ce4c-4c6a-a285-947de5740968	installare i contenitori per la raccolta differenziata
99ead901-05e5-4185-9a7d-1734bd224b97	leggere i piani delle luci
99effa08-63ee-4d2f-83d2-b4f299648458	comunicare in materia di benessere dei giovani
99eeb64f-a3e3-42a8-aafd-978fb074f153	stoccaggio di rifiuti pericolosi
99df02b7-3175-4ab3-9396-d1c3da55e4d5	posizionare un’asta di ancoraggio
99f0ae50-e099-4419-8dfd-23277b9412df	formulare raccomandazioni di prezzo
99f5bd8f-7e01-4075-916e-0b643965bf8e	condurre studi sulle popolazioni ittiche
99fa5ead-19fb-449c-8191-0389a5ae0777	aggiornare le licenze
99fdbdec-6e63-4476-ad16-9ae42079fa49	controllare le prestazioni del veicolo
9a08a714-e480-486b-994a-0c02ae3007fd	programmare l’uso delle strutture ricreative
9a0cf817-3138-4034-be78-1abfd1005c7a	intervento in caso di crisi
9a0f8af2-1548-4cc5-ab1b-531099493e69	effettuare le operazioni di rifornimento di combustibile per l’aviazione
9a09c294-1fca-467e-b532-adb6565ada99	analizzare i campioni di sangue
9a0630a3-33d3-4c1a-b561-1efec60252b8	individuare difetti sulle pelli non lavorate
9a1150d0-4b10-4778-be04-dc6c04ca8b8e	modellazione orientata agli oggetti
9a236455-b50e-4d8e-b5ce-da8b0efe778d	effettuare operazioni di infiltrazione
9a1d0311-c7f2-452b-92dc-d6980f6c03f5	effettuare una biopsia
9a1b6c4e-1762-4726-9d77-17e3b9731ec3	compilare le registrazioni portuali
9a1a1119-1bba-4074-ae4c-438f7be08dd9	collaudare componenti ottici
9a29840b-b964-405f-b3ed-77b95bbb4e9f	psicologia scolastica
987709c2-ed6a-4ac7-a3f9-4ebe7af48f79	effettuare la manutenzione delle parrucche
9a2b366e-4084-485f-9dd4-92198c0740b6	fumare sigari
9a3a12af-9ad2-42a5-a566-ab8b9c15928b	vie di navigazione internazionali
9a31c0cc-77cb-4c15-9baa-e0d466934aeb	evoluzione animale
9a438e9c-80e1-4fc7-9893-16e88a2d47be	programmi di sicurezza sociale del governo
9a44f64b-4d88-4474-8dee-b7bce4562000	educare all’igiene orale e alla prevenzione delle malattie
9a442a8b-c89e-4c99-af9c-cb810ea8e193	tipi di controsoffitto
9a49c1a2-3dfb-4dc9-9b4b-bdb245ef792c	fabbricare le protesi dentarie
9a4efa07-ee5f-4b32-87ab-62803fea4a07	inglese
9a529002-add5-4398-92eb-ce185fb4e6f0	conservare i campioni
9a50dc11-29c3-46be-9939-debe480b51b9	gestione dei costi
9a4d00c3-d89f-4486-847a-710ca6f08e0c	fornire consulenza in materia finanziaria
9a52ce30-5e60-409f-813f-10fd48a46163	valutare i documenti storici
9a5a3461-99b7-47bc-8640-9570b2fe1d4d	processi di trafilatura in metallo
9a5e0161-58cb-4522-ad99-d202329b5a63	tipi di utensili da tornio
9a583436-f553-4e63-867f-d8a593f4a851	effettuare un follow-up in seguito a un intervento chirurgico sui pazienti
9a6002d6-554e-4bb2-9e52-f817c1fae043	leggere il contatore dell’acqua
9a626a61-e702-4893-810d-b7ef59bea02e	verificare i principi di ingegneria
9a5b0ffd-4fe8-4ddb-b259-038461306be3	condurre i colloqui nel contesto dei servizi sociali
9a628558-016f-4842-a805-4e2e497a10f4	elaborare i menù dei drink e i listini prezzi
9a681dde-de65-4ea6-ade2-9f460a7e43a4	architettura storica
9a65bc4e-4f99-4e06-af04-202fa777660e	garantire la salute e la sicurezza dei visitatori
9a69406a-c646-45e6-b29b-c722942cb64b	organizzare il palco
9a6a2d98-b8db-40c1-89e8-18cd4283a077	sorvegliare la macchina per l’estrusione dell’argilla
9a6abf59-b3ba-4730-ad1c-20d757a7ae6f	componenti di orologi
9a70f12e-28bd-4bda-b5b0-b556fdd4417a	azionare il posizionatore del tallone
9a6e7591-2484-4a3b-b6de-58b076698bac	eseguire un’ecografia
9a73e376-8ba5-477e-85bc-00e9c50936f0	intraprendere un esame sanitario
9a75edfd-d0ad-451f-a3b1-a1080f67a736	utilizzare motori per trivelle
9a768368-de66-4edb-9945-1cac3749a034	tipi di fibra per rinforzo polimerico
9a78033b-f7a3-4037-9908-e9cef042a1e6	progettare circuiti in CAD
9a78f864-cc4f-4634-be9e-c057e3de19b4	procedura legislativa
9a8499ad-1598-490d-9fea-adce1620dade	valutare il periodo di allattamento
9a89202a-f15f-4916-8619-706e052d5663	pulire wafer
9a892574-cb9b-4f88-8e44-7bd6439f8f14	fornire un servizio di doposcuola
9a9b83c2-bde4-46b6-af4c-724227771ff5	studiare il flusso del traffico
9a9dd641-90b5-44c2-9afd-2b57c79ca54f	politica interna di gestione del rischio
9aa6b5e1-1d9c-45e3-8239-88a879d6416c	pulire le carcasse
9aa7abd7-6fa8-4c64-bb0b-f69fe8a117e9	valutare le possibilità di attuare i miglioramenti
9aa7644a-4c4f-4129-a198-a631020b6869	applicare uno strato di rivestimento a un modello
9ab123ac-0517-44f3-b922-8caf99a3c2a3	scommessa a totalizzatore
9aa289d0-5ad7-4173-9406-3b0d32b04a0e	monitorare la temperatura nei processi che prevedono l’uso di farine
9ab2d0c3-db37-47ac-bd2a-f061c220883b	attrezzature di apprendimento Montessori
9ab4f1f9-0b46-4dbc-8d99-0d4e8159672e	processi degli articoli stampati
9add8d31-5ed6-4e04-abc6-d6ccda20c278	pulire gli essiccatori
9abd60d3-697b-4869-b099-530178271b1e	immagazzinare la merce
9ac85d68-5d45-46d0-a509-ce60aa465d22	garantire il rispetto dei contratti di garanzia
9ae0345b-a908-4b12-b0f1-ce22bbe6cab0	applicare l’assistenza infermieristica
9aec90f8-2a18-4552-96a0-c52a62c4978f	utilizzare una bullonatrice per tetto
9afb7484-0b06-4b45-92bf-ae055cecebbd	parti fisiche della nave
9afdfd63-f6fc-4637-939d-5220adeec473	bevande alcoliche
9affa0ec-b52f-4cf3-a444-bf07dfd4527d	registrare i visitatori
9b0776f9-b05c-4d21-b921-ef932a767186	controllare il trasferimento del petrolio
9b128598-abcb-44c7-9ada-ebd4ba685d06	garantire la tenuta dei registri delle attività di estrazione
9ac4379b-e83f-435b-a98e-f4adb491e02c	JavaScript
9b16f111-b3bb-4c0d-985c-8d6c2dab4f64	esaminare i capi campione
9b16faf6-089d-4918-9fb4-ea8c1d9f9a8a	saper valutare gli spazi fisici
9b2b1624-b1ab-4cb9-9de2-3ca4a08c11f3	varietà ittiche
9b2808f4-e49c-4d82-ab3a-6192343a1a18	stoccaggio dei cibi
9b2cca5e-6a72-4de4-8721-75a1f1567797	utilizzare lame per intaglio legno
9b1e4275-827c-4176-b1da-898db8a7cce0	informare i clienti sul tipo di alimentazione elettrica dei prodotti
9b30713a-9eb2-4d53-afe9-fde8a00ecb33	metalli e prodotti metalliferi
9b3a6e73-b093-49a7-b213-43ee49685fe9	eseguire le operazioni di pesca
9b3cccfc-bcc0-430c-b375-a2d07b4c0905	sostenere gli altri rappresentanti nazionali
9b489231-5707-4003-8a8b-5142b7988009	sviluppare le politiche economiche
9b44140a-a6ff-4826-98a9-38f2a7ded12e	cura neonatale
9b4dc798-bc45-41fa-b474-48bc562c4fae	normative di sicurezza antincendio
9b5d6c15-cc8e-4b37-9f78-59c1cdc29335	psicosociologia
9b518be1-b897-4759-9a58-c8d45d83f40f	gestire le relazioni psicoterapeutiche
9b5382cb-7cfb-46e5-bad6-21fb020141ca	consultare il sistema di sostegno dello studente
9b5bcb0b-d6b7-4f97-90bc-c2bb8977937d	individuare i dispositivi di sorveglianza
9b6ea6cc-f657-4bb7-9280-1f3eb2f789e9	selezionare le foto
9b70d750-6c3f-42ab-a7a1-10073026899a	routing di rete TIC
9b745841-5c1c-41f6-a4d9-a146ef1e64cc	preparare le schede alla saldatura
9b75417f-ec27-4152-b969-cf26ef4a7772	utilizzare una macchina che realizza lastre laser
9b7fa56d-644d-474a-8adf-4eb4b7a7cea1	industria dei prodotti per animali di affezione
9b7f649c-9b02-4cb7-8c7f-f8ee2ef7a6a1	prevenire problemi di salute e sicurezza
9b77b823-bdcb-41f9-8f8c-618aac429e92	gestire il benessere animale
9b835a18-4a3f-4a9f-a4a6-9b2f20f54870	tipi di macchina per rivettatura
9b81c49e-c402-4d22-97e5-cf8e9549f877	preparare i programmi di audit per le navi
9b8986f6-dc32-433c-9e2c-cda71615153f	pianificare le sessioni di musicoterapia
9b96b52a-bf9d-433c-9fb4-fee782562964	regolare il livello di cottura dell’argilla
9b90f05f-e84b-4acb-839e-af743f1e2941	essere addetto a macchine di riempimento del latte
9b9c19fa-d1ec-4870-a583-3b2b0f3d9e99	sviluppare i programmi di sicurezza sociale
9ba60b38-1ffd-4d60-aec9-bdeb909db3bb	supervisionare le squadre di produzione di frutta
9ba32ef1-a715-41c9-9a00-3afdf04968bb	offrire consulenza clinica ai membri di un gruppo
9b967244-9c02-43f6-b2b6-7d0af492b1ac	comprendere concetti artistici
9bb16f8f-22de-4bad-b0c9-6125e8f77560	igiene in ambiente di assistenza sanitaria
9bb51467-b3ce-4953-b595-82bc0afa5946	monitorare il mercato delle opere d’arte
9bb8432d-b8bd-4195-aa06-99343f3fc9f2	garantire la longevità della coreografia
9bbbdacb-eac2-4b26-9cde-c2004eba5212	caratteristiche della locazione finanziaria
9bc09066-d8c4-466a-b9d4-0c73b0cffcc7	gestire le macchine tappatrici
9bc0d3c3-96ee-443e-88f9-6db1df44ad0e	valutare lo stato dell’imbarcazione
9bc5abf5-c67a-4164-b726-423538857e08	gestire l’adozione degli animali
9bc5594b-4bcb-41fa-8034-23ec56211229	compilare il listino prezzi del bar
9bc6c905-18b2-44c1-b52d-6a5f89c8fad5	condurre una ricerca su temi legati al linguaggio parlato
9bc6cf91-cd39-4770-b532-604cce6e2a64	gestire l’attuazione delle politiche di governo
9bcb2073-aef8-4648-abe1-0ed454afc54f	eseguire i controlli di sicurezza annuali previsti dalla legge
9bcbc932-635a-4719-a603-8884ce373137	aiutare a controllare il comportamento dei passeggeri in situazioni di emergenza
9bce4af8-07ca-480c-96c5-429feeb701d2	riempire le bombole
9bdc59a0-d4e5-4ef5-af1b-22c02461ffb6	logopedia
9be1022c-ad2e-4be7-97fb-50c2935e63a6	aggiustare le attrezzature sportive
9be34347-9b23-4e43-a940-930fd0ac9534	interpretare le intenzioni artistiche
9be4eb24-2ac8-4e77-9635-cb509df1f0c6	applicare strati di resine di plastica
9beb00d8-184d-41c6-a8c1-e4bb659f0626	effettuare una pianificazione computerizzata della radioterapia
9be36510-6740-4fd1-9c08-24bf6ba21135	tecniche di moderazione online
9be765f8-b3ad-4818-b22a-1ce45dae1f3c	SEO
9bf814f5-a7b8-44b3-a2cc-941d06e7c82b	valutare il tipo di rifiuti
9bff6425-b2a4-4dee-848a-3bfc522e793c	carne kosher
9c024f26-2c8c-4128-a10e-151b65a4354f	lavare le biciclette
9c0442ca-ed88-42d1-97ac-67efa81d4234	impegnarsi nella ricerca chiropratica
9c0620b7-4045-42d0-8bcc-ef98f3dc1734	utilizzare la cassa d’afflusso
9bf91ebd-f7b3-474b-b730-81c8c73e5fb4	aggiornare il bilancio
9c08a74f-48a1-4804-81c1-f4120e6ba254	applicare metodi di pre-insegnamento
9c0f63a4-f185-4801-9fe5-4930c6655c71	mantenere un coinvolgimento non emotivo
9c15d440-45ab-4839-aa07-aae1e80ab456	consultare i professionisti del settore
9c155e22-67e1-42e6-bca5-2aae0eca5f25	redigere le relazioni delle riunioni
9c1c28c1-47ba-4473-bca4-2469c108ab4f	smistare gli ordini completati
9c1f76bf-6a72-4fbb-b728-afe2f8436aa9	garantire il corretto stoccaggio dell’acqua
9c24ce2b-4141-4501-9344-2c2b21fc465d	applicare tecniche di saldatura
9c25905a-4c13-4163-864c-ca963a633688	migliorare le condizioni della merce di seconda mano
9c27a13c-5a15-413f-a354-c8e40903861f	utilizzare le tecnologie geospaziali
9c119ae6-d7b8-4c6a-923d-da847526d14f	redigere relazioni di analisi dello stress
9c297a9f-9a3f-41b3-9f26-652baa32761a	radiofarmaci
9c333b5d-ed96-4a8a-806b-67b81a910efa	applicare tecniche di saldatura a punti
9c353367-e1e1-4a1f-9f35-668c1b268d98	contribuire a coordinare le attività artistiche
9ab988f3-61fa-45f2-a53a-9ad24b1a0b8b	rimuovere il pezzo lavorato
9c40dd62-2e73-4822-ba5f-7d58fbeb363a	estrarre l’acido grasso
9c374066-58a9-4e1b-9c94-5923fe94fc5b	intraprendere un’attività di ricerca nel contesto della genetica medica
9c424d93-8b68-4f7b-89af-27fc11bf6367	azionare un motore a vapore fisso
9c442783-870a-40e2-934a-53c9c477aa33	individuare i segnali elettronici
9c44fa50-c3c3-40b7-9268-511eefc6ea7b	zoologia applicata
9c43dd84-a2af-4d28-a059-367674cd600a	applicare le strategie di importazione
9c45bd7d-5d93-4489-ba7c-950ae199538b	eseguire un riesame durante il trattamento
9c50526c-1e0e-4a3b-9968-17cde349c2d2	gestire l’ispezione dei processi chimici
9c637aae-d140-4d5d-b1be-600144ee6672	lavorare in camera subacquea a tenuta stagna
9c637f26-282e-4d44-a491-82e670ba64ec	allergologia ed immunologia clinica
9c5942b0-6344-4678-b56e-f1a255ecda3f	studiare la musica
9c665312-dedd-45b4-8032-19846743f278	metodi di data mining
9c707e64-e401-4b96-a5fb-34a375a3641b	svolgere le ricerche sulla storia familiare
9c78955e-0860-40da-ae8d-19b251856d77	preparare gli ordini da spedire
9c5d5566-f527-477f-b423-e711762bfc67	testare le attrezzature fotografiche
9c799adf-befb-4b2f-84db-8452c0f6ec94	business intelligence
9c85fd84-8eb8-4fe2-951d-31bbfc4a2a64	selezionare gli elementi per una composizione
9c7b744a-44de-4014-b557-72ce0a173e30	verificare le notizie
9c869572-d064-47e6-876f-281bfc4e9369	interagire verbalmente in tedesco
9c799cda-db3f-4e09-b22b-43aaf8c4fe30	valutare i servizi di informazione utilizzando parametri metrici
9c78ce48-00f7-4df4-a1b8-6e0cb2560c3e	fornire informazioni sulle pompe di calore geotermiche
9c91bd14-2b75-4c48-ad6c-d82b1ebb2a3d	vendere gli accessori per animali d’affezione
9c997731-cfc4-4d6d-9dba-c4c898a70195	sostenere le vittime di violazioni dei diritti umani
9ca68df5-9246-4fb5-bba1-aaa4f8cbd13f	varietà di formaggio
9c89068c-e817-471b-9846-53c43335ff43	Pascal (programmazione informatica)
9b79fda2-fd4f-4b05-8eac-baa60573e844	insegnare i principi della progettazione architettonica
9cabf7d6-8314-4427-9e41-7d0bca39ee97	effettuare la manutenzione dei sistemi di irrigazione
9cb20078-268e-4f2c-bde1-4019328f3bfb	creare il design front-end di un sito web
9c99249c-d5ea-414e-84c0-841f5d2c06c2	guidare il personale
9cb45c49-1267-4064-9085-aa718820b7fa	telecomunicazioni marittime
9caf7a1b-8db8-4088-b3b3-41faaf1a41c0	essere addetto a macchine rettificatrici CNC
9cd64e0f-d61f-497e-8b0a-9ffb2feb088d	digitare rapidamente
9cc6a360-0aa5-4909-99f8-84f765be1e4e	norme sui dispositivi medici
9cea7dc4-a506-40af-b92a-25a5a843b508	medicina fisica e riabilitazione
9ca6cc64-c801-4d08-b1aa-6e661168b093	garantire la privacy delle informazioni
9cd66b3d-a327-4e01-a992-ba85439288ab	misurare la profondità dell’acqua
9cb8d8cb-6e9a-4af5-a656-ffe10c5c3d87	aggiungere rotoli di argilla ai lavori in ceramica
9cef7f0a-31f5-4998-b802-7d1c0df0c44f	abbinare le persone
9cf24f13-0d41-400b-a716-84ab519c92e5	tipi di vino
9d0017cc-118b-4d5f-b575-f8b763db47cb	gestire le iscrizioni
9cf3b7fe-0ae8-4fe9-afe2-1706422c718e	fornire le ricevute degli acquisti effettuati
9d01ed79-d3a7-46b3-b8ae-fc7861796d88	coinvolgere i fruitori dei servizi e i loro assistenti nella pianificazione delle cure
9d03f443-861b-4757-94bc-f055a2f1710b	adottare le misure di prevenzione delle malattie
9d02551a-6549-4365-b7a8-b64d153fac7d	pulire schede di circuiti stampati
9d036d1a-f8b8-4d13-9d6c-2f88148823cd	interagire verbalmente in bihari
9d07a276-0634-4eef-a35b-0a72049c36ab	posizionare l’attrezzatura di incisione
9d0d9311-a49b-4baf-9851-50a70b59e902	coordinare le comunicazioni a distanza
9d181256-84bf-43d9-b160-52cbc22b1bf9	applicare uno strato protettivo
9d0d1494-f4e9-4f1f-858f-fa65ef885883	tipi di media
9d1df3b1-9ef0-4744-9a2a-0ee405b0e4b0	processo di fermentazione degli alimenti
9d101536-6547-4ec9-9c68-d156189c920d	gestire lo stress nell’organizzazione
9d27b3bf-9d06-414b-92a4-1aaf4228467b	concetti psicologici
9d2920b1-4431-4061-8ff6-4bca4f0b2685	utilizzare chiavi
9d3abd21-3047-4928-97da-57b5a4cce205	supervisionare le udienze giudiziarie
9d29795a-02ca-42b0-8949-e3c8fce72c78	presentare lo storyboard
9d3ca42b-3092-47a8-98b4-a6de768419e7	leggere il calorimetro
9d3e07e5-7998-4159-8eed-43fa36a272d2	scrivere in coreano
9d408e8b-349d-4afa-b99f-419724122a7f	rilevare difetti di prodotto
9d405111-594e-4e69-89bd-f06a37a10ba8	effettuare la manutenzione dei macchinari a bordo delle navi
9d52c7b3-5fff-4b75-9808-e613ebebdb7e	fornire i prodotti acquatici secondo le specifiche del cliente
9d52697e-353b-4a83-a12e-1a91d081c553	procedure della scuola post-secondaria
9d65d793-d0d0-45ce-9e20-fc18c7fae9a0	utilizzare apparecchiature industriali
9d716168-3715-400d-9c7c-eec1c7273149	addestrare gli animali
9d49450d-3464-4409-a4ab-5b81768a4fa1	fornire informazioni sui pannelli solari
9d750b24-89f9-424a-b244-71bad3e562ee	garantire la sicurezza sulle navi
9d8a3ef6-8566-490a-952e-d3e9d92ae8eb	usare scanner 3D per l’abbigliamento
9d8a40ec-1896-45fc-85db-3cf1c1affcb8	modellare l’argilla
9d7cb49c-cf9f-439c-aed5-4c3978a2f7a4	fornire un orientamento sociale telefonicamente
9d9d335c-2188-44ab-8d82-2548fb5f9da8	effettuare manutenzione delle centrali a biogas
9da5d878-fdda-4b93-ac1f-1e9c6fe0af36	vulcanizzazione a caldo
9da88b83-0e4b-4ea6-a1c8-4fe94a38d089	monitorare le centrifughe
9d9eecca-de01-43cc-8e1f-774ee70a8dc3	pensare in modo analitico
9dabe10f-8954-4692-b72f-f85e28d8a7b5	eseguire le procedure di apertura e chiusura
9d50db17-feb1-4697-a62e-142e1ee65123	Cain and Abel (strumenti per il penetration test)
9db1fcf0-b379-4927-981e-ffcabb8093a9	mettere in funzione il carro attrezzi
9db8f548-cb98-492c-93fa-7d54efe964d9	monitorare le specifiche dei rivestimenti
9db968e4-48bb-4fa6-ba7e-53ee1efbbe96	monitorare la produzione della miniera
9db13138-4edd-4f02-b34b-82082b5589a8	metodi di finanziamento
9db97637-d143-4575-80ba-afc9717a8fa9	storia del cioccolato
9dbbc52b-5389-43a0-8970-cb57e8460ad8	neuroanatomia
9da46ecf-f3db-4bb2-b96f-67c32d6aabcf	gestire le metriche di un progetto
9dc82007-138d-4998-9db5-9cdad1d1bf61	medicina tropicale
9dd745c3-488b-4cad-b0d1-8243516a67bf	eliminare i contaminanti dalle piste aeroportuali
9dc46c8c-5306-4fc7-baf2-ecdcba55d9a3	misurare la temperatura della fornace
9dd82849-8ff4-4186-8010-87ffb0e1fb3f	analizzare le questioni
9dd8d0b5-1f79-4c49-ace7-7131731f4cad	progettare l’interfaccia digitale dei giochi d’azzardo, delle scommesse e delle lotterie
9df1d9f5-275d-4ebc-b6f5-6ae0c5cb95eb	teoria del massaggio
9de547bf-19a1-4fa4-b23c-2ff11b1237ca	installare le porte
9dfff543-f8ad-4f7f-9e90-7b8fb86c958b	critica letteraria
9dd8cf7b-a34d-41d1-b0ff-bbd3c1411d8e	ASP.NET
9df2adda-09c0-453f-9128-c9216c7fe861	determinare la progressione delle malattie oculari
9dfd2f81-e307-4666-a450-eca172c9420b	elettromeccanica
9e064f73-8e6f-468d-9942-52aff91f5646	tipi di materiale isolante
9e04ceb0-3265-4c6e-9ce3-241c5f011a2c	controllare i tassi di mortalità dei pesci
9e165252-f574-4b01-a0a8-241ed580339e	metodi di consulenza psicologica
9e10166a-d6d1-49b6-a0ad-2265d299f673	studio dei lepidotteri
9e17acb8-8065-40da-86e0-0e14ae89bc99	prevenire i danni alle infrastrutture pubbliche
9e18a527-df6c-484f-a8ba-2d34f1960b2c	fornire assistenza nella somministrazione di fluidi agli animali
9e244f4d-d144-496b-a949-6be7038300ed	compilare documenti giuridici
9e215d53-8a80-4dbc-a685-f93ae48cd4cf	preparare le pellicole per le lastre da stampa
9e2489ed-98e9-43d8-bd39-a26f157b8911	fare da allenatore durante una competizione sportiva
9e166923-de89-4835-8c33-d92a3018f21f	colare il calcestruzzo sott’acqua
9e2f54a8-b46d-44ba-8124-ae625974a940	elaborare ricette di colorazione tessile
9e19ec44-7d7b-4f10-a865-df1bcad8b82c	tenere i contatti con le parti interessate in ambito ferroviario in relazione alle inchieste sugli incidenti
9e33f513-f152-4400-998a-d6995df30ac2	segnalare le riparazioni di maggiore entità degli edifici
9e40b4fa-c91a-48ce-9f5a-9e1508286408	fornire gli aiuti umanitari
9e379201-c038-435b-be35-b3fdd935871a	contribuire allo sviluppo di una coreografia creativa
9e413d5c-445b-4f0d-9a3e-86b28d861594	manipolare le piume
9e45f53e-eac8-48c8-97e6-f3e9ecb96391	rischi associati al carico di merci pericolose
9e4946e3-d9ef-4ed9-bf2b-540cc2fc4e69	gestire informazioni personali sensibili
9e51f4a3-d2b7-4b13-abac-41e2f3193a4a	presentare le bevande in modo invitante
9e4a4464-39cf-4a52-9375-0d1ad944f70b	effettuare la manutenzione di paranchi a catena
9e52c292-1ac9-4465-9f44-707057ae93cf	valutare i clienti
9e4aa8f7-c3bf-4a80-9a5a-befa6703fb56	utilizzare le chat in Internet
9e5b4a4a-5fe8-4af9-82b9-e84af1ea6483	collegare i dati di tutte le divisioni aziendali interne
9e64a6f4-adb6-4d3b-b817-b3fa932c0c8a	progettare componenti metallici
9e5bbf95-fb62-4757-b51c-077f8652be30	seguire i codici di buona pratica industriale per la sicurezza aerea;
9e6113cd-2db7-488a-a94a-7d417acea13a	gestire la strategia di trasporto aziendale
9e6db497-40d8-4bd7-adc8-1776baa53b97	affrontare i trasgressori
9e74e1e5-6e3b-47eb-b343-5c3543d473bb	prelevare i riproduttori
9e67a92a-3496-44ca-ae67-db93af7e1657	supervisionare il lavoro del personale in vari turni
9e791b60-b16e-4057-979e-b005003b18a8	tipi di propellenti
9e856d11-1175-4e48-ac72-91614f2673fd	eseguire procedure di trattamento delle acque
9e94f9d5-ea29-4a54-b06c-4a6e54e3a188	coordinare il servizio di manutenzione e riparazione nel settore automobilistico
9e8d0565-2be9-4bd3-b375-f47092dd61d3	navigazione a bussola
9e952a00-cd60-45e1-a17f-c63c7c07c547	condurre la carrozza
9e9ad23c-4422-4a01-925b-8be9fb5432e1	software di sistema di analisi statistica
9e9ed6be-605b-4203-acdc-4e77fbda0a4e	preparare una proposta legislativa
9eb19ea3-dc29-4ec4-8884-4b21b43f8e18	ideare le coreografie
9ec3f7a7-d64d-4966-a8fc-278b1652454a	leggere le punzonature
9eb76029-368b-4507-8232-0a84691a6be2	ispezionare gli alberi
9ec092a8-e7dd-4183-834a-d77c5a0722de	parassitologia medica
9ec7b555-cd95-4570-903f-d66b96ce1f41	effettuare la manutenzione dell’ambiente di allenamento
9ecda29d-150f-446f-8754-82b1bc20d82d	anticipare i problemi prevedibili sulla strada
9ece6913-aaf4-4b33-9130-36191941d746	eseguire l’imballaggio di calzature e articoli di pelletteria
9edaa287-b5c0-4d93-9365-71ebc542dbab	biometrica
9ed00cfe-f649-45a8-8e29-ab767a320d5c	intrecciare ceste
9ee5ac3a-da36-44fe-ab0a-e16de380673a	gestire gli aiuti umanitari
9ee4cec5-ecb9-4212-b7e5-9381e3daf95f	giornalismo
9ee38b80-9f3f-49a6-bd44-c7df1f8a2fe1	comprendere il basco parlato
9ef7f88f-a655-46ae-9093-f6e552d37f1d	monitorare il portafoglio prestiti
9f0123b5-0062-4e47-9dd5-e6a3ed6f20a4	eliminare i liquidi pericolosi
9efcfe6f-8f5d-4969-8a1e-beccb981bfcc	gestire la qualità del suono
9ef52f65-3e67-4763-9d68-64b88d895ce4	stimolare la creatività nel gruppo
9ef4f062-a0b9-48e8-9e83-738f63f86fca	valutare l’attuazione del protocollo HACCP negli stabilimenti
9f0be8d2-32d4-4717-8372-146041e0f45f	lavorazione del vetro
9f02a0ac-d88b-40a6-8d89-6d6f754e1b81	CryEngine
9f02ecb8-1b3f-42be-9c09-53a31f5087f9	procedure della scuola primaria
9f0f1c54-f061-4782-8a47-252642ba8706	prestare assistenza nella movimentazione di carichi pesanti
9f1f9629-4736-49d2-946a-b1be6e87bddb	gestire gli impianti di trasmissione dell’energia elettrica
9f168cc8-a302-4d81-90ab-cb99fad60eb0	riferire sull’attività professionale
9f26600c-83ea-4218-a3f5-93363d2d415d	scavare i fossati per i canali di fognatura
9f221a34-6315-4a0f-a17b-1e6df798fd91	addestrare le truppe militari
9f26ed89-e711-4fbc-9a26-7b9d2d60ec70	lavorare con i tecnici delle luci
9f27f8d1-ca10-4ade-8b6c-eb9d1a054cdc	titoli
9f29521e-9061-421d-a0c7-a1e571a369dd	tenere l’inventario dei pesticidi
9f2a8e1c-2c63-4f5e-b9d3-20ea370e8fd9	indurre la deposizione delle uova di specie allevate in acquacoltura
9f2c0be4-6e8a-4b37-933b-2d19aabe1044	attività bancarie
9f28dc97-fe9d-4944-95a3-bb0274a859e2	maneggiare l’attrezzatura di sicurezza e sorveglianza
9f2cff13-245d-4859-8e99-f64b144fb493	storia degli stili di danza
9f2cb260-471d-40b0-bad5-34286775ea19	sviluppare procedure di lavoro
9f2e5e11-8300-42ec-a547-0b09457ae5e5	interagire verbalmente in vallone
9f389f47-6349-402d-8266-f95ca16851b2	riesaminare gli approcci di trattamento con la musicoterapia
9f387f7b-4c43-472f-99c7-b5a197405add	pesare i materiali
9f394433-f84f-423c-a3f7-e71a615e664f	misurare l’inquinamento
9f2cecc9-ce14-4142-bf59-8ce3d98cbe14	comunicare con le strutture per il trattamento dei rifiuti
9f3aa6e8-7941-4d0f-a31e-e07858979726	definire il triage dei clienti
9f3d72d4-3ecf-4e6d-be3a-71896130f04c	scrivere in portoghese
9f4b384a-9d48-49b5-b164-d3235083c7d1	effettuare un’analisi nutrizionale
9f46420c-ba0b-4b85-a802-4818ba815734	classificare i campioni per l’abbigliamento
9f51a7cc-64fa-420e-8f54-aab7075ca3c7	mantenere la produzione di avannotti nella fase di vivaio
9f4c4db5-571e-432e-911b-3404e6a8fe5f	sviluppare le idee creative
9f4df062-3a17-4c08-b840-8ab0c6d4524b	analizzare il concetto artistico sulla base di azioni sceniche
9f521237-5bdd-4750-b1fd-be75dca3ef41	sostenere i migranti nell’integrazione nel paese di accoglienza
9f622c3f-d48e-480c-8396-4646d881ea56	gallego
9f50cdec-804d-4a58-9457-e7bb3c0646de	raccogliere dati per scopi forensi
9f6338cc-923c-4c73-a070-a1aa3c45f6ce	trattamento cosmetico della pelle
9f66fbf3-7f68-412d-9594-5fe41ec2fb32	mercato turistico
9f7c4af8-020e-4aa4-bdba-ef0d72611807	guidare i veicoli nelle processioni
9f6803eb-1de2-4835-9bee-5ee6c27cce13	offrire consulenza sui diritti del consumatore
9f7ffad8-5dca-4b80-9530-3b943816e1a8	metodi di diagnosi differenziale
9f7c4015-2a9d-4908-9305-80444b09af0e	gestire le officine aeroportuali
9f7f3b09-f70b-4abe-96c8-1b1b0a474107	strumenti di debug TIC
9f74dcf9-a3c1-43dd-95f7-4bbd2e195c2b	riesaminare i dati medici del paziente
9f82fc8f-2646-4df9-95bb-5f8f962971b0	tenere l’amministrazione professionale
9f8c9212-96d8-40d3-993b-7fc4b9c92743	vendere cosmetici
9f9f01df-ecb8-4410-a59e-890c5f816dd8	sviluppare sistemi di strumentazione
9f856900-6c3a-4939-9a62-2a12465ea2d0	eseguire la riparazione di motocicli
9fa3db14-5940-4cc5-af15-553f28e59139	interpretare diagrammi elettrici
9f8b2b7b-c2fd-4289-800d-8872931363be	preparare i mobili all’applicazione di vernice
9fa5ebac-0651-4d78-95c0-ff6dafa3a540	eseguire le procedure terapeutiche di chirurgia vascolare
9fa43b2a-87c6-4589-9b5d-983a386385f4	applicare le ricette di colorazione in modo corretto
9fa9a37e-85c6-4bbc-8fe8-e2558702b141	tecnologie di call center
9e3b0f9f-c2d9-44f1-963d-9300c1c2a2af	selezionare la piastra che conferisce la forma al sapone
9fada210-3168-416b-adf2-68c5ebdf2cd7	disabilità uditiva
9fae629b-65eb-4170-9d48-e7df771b4074	incontrarsi con i clienti per fornire servizi giuridici
9fbe362d-3427-4ac7-be71-aa0070ab4c04	installare le piattaforme di scena
9fc279c1-3415-4231-9120-d5b3f2527915	collaudare le prestazioni del sistema informatico aeroportuale
9fcd956d-9dad-4092-8fdc-fcb4dedc3f0d	utilizzare le tecniche di abbinamento dei colori
9fca9b23-2f4b-476e-8909-cfb2e639ee92	caricare i rulli nel proiettore
9fdb3255-90cd-4c70-bfa1-2969b22e264c	ingegneria dello scafo della nave
9fdf60d4-a097-4dea-b6ca-a5301424c4df	gestire la flotta aziendale
9fe34e80-fec4-43c2-9e50-52bc5da8991e	assistere ai rilevamenti idrografici
9fc99774-efda-497d-b89f-0674b1eda1a9	rispondere ai reclami dei visitatori
9ff48dc0-aa22-40e5-b5e4-f780c1bdfccc	tipi di cellulosa
9ff4a8ab-768d-4ef5-9b9e-c24e51356040	psicosomatica
9fe4cf6c-5a54-438a-8200-4af93fd3e538	fornire presentazioni sul turismo
9ffc5b1f-282a-4773-bd0a-f91174d8bf08	confezionare gli articoli in pelle
9ffec6bf-9363-4a80-822d-b57a90c08a6e	valutare le potenzialità dell’imbarcazione
9ff4ad6e-33c0-4744-b759-6ef5496db383	infiggere pali di acciaio
9ffb7ed7-a015-485e-bba4-4caafd548a84	fornire informazioni sugli aspetti giuridici del dispositivo medico presentato
a0107c2b-3c0c-4e14-8bca-aa3fcb730ded	Joomla
a00ea685-c5dd-4d89-9b83-9c74f687522c	effettuare la manutenzione delle attrezzature del teatro
a01a0556-bb25-41ed-8ec1-f396baabccec	progettare l’attrezzatura per la testa del pozzo
a002d172-2878-496a-9119-6c2e3e85023a	ispezionare i prodotti estrusi
a01d22f6-c143-427a-b362-7b37e7352aaf	interagire verbalmente in tamil
a0209dee-925a-42e5-81fe-7fda3b071c09	gestire gli attrezzi da cucina in base alle necessità
a022435a-d97d-4297-8758-0a6d7a679604	rispettare i programmi di gestione dei pericoli connessi alla fauna selvatica
a0248afa-b3b0-4366-81ca-f0f24f60796a	azionare apparecchiature di taglio
a0229ed2-d73b-4a51-a7a3-965033302e92	eseguire la procedura di attivazione dei successivi livelli
a038e6c0-4c4d-4264-af84-8eb5ed8ac932	studiare foto aeree
a03f1ff9-b967-458f-9514-c21a8607af1e	fattori geologici nella costruzione di un aeroporto
a04075a3-ba1c-4e1d-be41-e5fa544fc565	limitare il traffico sul ponte
a03677eb-4eb0-41d3-aafb-389d047ac1c5	trasferire i messaggi alle persone
a03ffce0-f6ab-42d4-928a-39baab106719	periodizzazione
a050d576-b493-4cef-8ca9-100330aa4646	regolamenti in materia di passaggi a livello
a05a4b17-d3ce-4129-8326-3a9690af0a38	gestire le società quotate
a05f6c95-059a-4700-8c09-1a0d6f61b895	registrare la corrispondenza
a0559ece-17ff-4126-a68e-0625b4fffe2e	assistere gli atleti a mantenere la forma fisica
a05f264d-b523-4a25-b151-c4e7a27ec47f	riparare i macchinari router
a0603ccf-9aee-4f00-810b-6719b12dcc25	condurre gli studi di farmacologia clinica
a066067f-50ea-4137-9554-03e8bb3ab829	mettere in sicurezza i locali
a067ab5f-de5a-470e-9338-741c18aff881	fornire assistenza per le domande di prestito
a06b5207-5259-402c-9404-773672fe3185	amministrare i materiali ai macchinari per la produzione di bustine da tè
a072efd1-8fb9-4167-8a50-585d344fe85a	utilizzare apparecchiature di telerilevamento
a0719705-1a24-4357-af1f-045671e40047	tingere il legno
a07942a5-85e7-4b73-8b56-abe4b0fed987	impartire formazione in materia di supervisione della gestione della qualità generale
a0872809-ee4e-4640-9b4c-6f0e8d0c5bf6	tecniche di diagnostica clinica per immagini
a080bacb-7e5a-4a18-9849-feaebded328c	pianificare processi di produzione
a08fa4b2-f2c7-4cc4-b383-8aeb21b3fc7a	distinzione degli impianti di illuminazione dell’aerodromo
a0950544-16f0-4112-a5b1-ffc5a08c295e	installare le attrezzature per le immagini
a081fad9-7aca-4d36-8b55-3be37924fca4	prodotti farmaceutici
a0973bcd-d642-4ab2-b965-921473ff845e	meccanica dei materiali
a096662d-fdf1-453f-9e3f-3d83c0f44044	miscele di asfalto
a0951bb7-a8b4-48fe-bd30-0ad357916285	fornire assistenza alle vittime
a0aa6b76-c8a1-4ab1-a5ef-ef35e24a71e8	malattie degli animali di affezione
a0b05b8e-d703-435b-a1e1-c90180979f70	tradurre requisiti concettuali in visual design
a0abcfa4-168d-4cf3-b65b-f21e90b489e4	utilizzare le tecniche di cucito manuali
a0ac5b25-abdb-408c-be94-0568857703ee	prodotti tessili, prodotti tessili semilavorati e materie prime
a0b5954f-3d7b-4882-a097-4f0a7fdb1add	partecipare a procedimenti giudiziari rabbinici
a0b59a09-d96a-47e5-8b75-ce648768aacc	reagire a situazioni di emergenza durante uno spettacolo dal vivo
a0bdca35-97da-46bf-9038-64fbcecf4ac6	equilibrare gli pneumatici
a0c884f0-c661-4f48-ad82-c36dbcb55c3c	fornire assistenza al dentista durante lo svolgimento delle cure dentarie
a0c0c19f-c1ea-4c53-89a3-62d9631d6927	monitorare la ricerca in materia di TIC
a0ca2cf6-3aaa-4c8b-a914-63ee194e1a14	auto-promuoversi
a0ca8e91-e4f1-42f7-bba1-056c19094cc6	materie prime adatte a bevande alcoliche specifiche
a0cc0455-6859-4366-a7c9-2b46dd376b02	catena del freddo
a0de9d2b-0104-4401-84d6-00116ce5d887	trasmettere gli ordini di articoli informatici
a0dce814-862c-4d2e-9f6a-eccf4ce14ca4	lavorare in una squadra forestale
a0d4a5bf-54ad-4048-9127-95f0b4594721	decidere la tecnica di trucco
a0bff23f-286f-4035-b234-f16ebc3db3a5	registrare i dati personali dei clienti
a0f45e7f-2ae6-4f9d-89d2-079c9f000305	controllo statistico della qualità
a0f6e4d8-a895-47d5-a058-a9ec7d73184c	utilizzare attrezzature per la riduzione dimensionale del minerale grezzo
a10185b8-15ed-4d25-b653-7281955cc290	fornire consulenza su questioni architettoniche
a0fd0d79-f27b-4165-9e82-c0bf4b0f9293	fornire informazioni sugli obblighi fiscali
a10ff86d-7762-473c-8af8-3edf6a83df7d	praticare discipline circensi
a11202a2-0dbf-4403-a689-2c7e490ff53e	gestione di collezioni
a115ec75-44b2-44d5-b616-77af7861a3c3	elaborare le politiche turistiche
a1203b34-3d1e-48ea-adad-7a8f2e80b0aa	analizzare gli studi sui trasporti
a11ce210-c81f-4c89-b794-195800f3244a	sorvegliare l’uso del terreno all’interno del parco
a1217498-75ff-4d8c-9181-1a99fd11f533	misurare la viscosità delle sostanze chimiche
a1267417-fbe2-430b-a4b0-85cd420c69d6	progettare nuovi tipi di imballaggio
a12ae856-fded-441b-a119-1506c5334b64	preparare la serigrafia
a0e06785-3dc7-4fa4-8dab-277c37b6c6fb	utilizzare materiali per i controlli sui prodotti lattiero-caseari
a12b9afc-cb0e-4062-92b7-0694aa6970e4	lavorare in un gruppo con i fruitori dei servizi sociali
a138cca5-0415-4c1c-972a-865d2d598f5e	controllare le malattie forestali
a138529d-ca05-4a6f-b685-3017e9584745	posizionare l’intelaiatura di sostegno
a1419bb9-4f33-4396-a70b-86e12fc03588	tipi di vasche da bagno
a13c0f0e-3eb8-45f5-aa00-83c5ea7da4ec	preparare le operazioni per i lavori di emergenza sugli alberi
a1192a16-0ac9-457e-b8d5-bd2fdfd69573	dare istruzioni al personale ospedaliero
a14970dc-dd05-4e08-af02-89a91719e93e	pianificare il pilotaggio
a1369b07-fdd6-4e8e-95d7-017aaeed1529	azionare le attrezzature per la pulizia dei pavimenti
a150a199-96eb-484b-b3a0-ca4fee7e7ac2	utilizzare le attrezzature necessarie all’attività di estrazione
a163b3ad-c67e-4765-b085-083ac69db636	gestire le procedure di distribuzione idrica
a15ba609-d3ae-4b7d-bb71-031b15be3d95	ottimizzare la scelta di soluzioni TIC
a16aac43-5475-4551-b70d-04ee5fd63dd3	prodotti cosmetici
a170642a-f96c-4320-989d-083913f61539	promuovere un evento
a1571671-f5c5-42d2-99eb-a3b2b81d140a	infiggere pali di calcestruzzo
a179a09c-37f3-4dca-bfdd-16ed40998731	interagire verbalmente in berbero
a17300d3-4081-44a4-a7fd-c7cbcc659f4d	sviluppare i programmi relativi alla flora e fauna selvatica
a17b5b3c-8175-4b72-8e9f-33230737ebe6	eseguire prove di laboratorio
a1856246-b43d-4bf7-8983-c7d0d9fe0912	inchiostri per serigrafia
a17ffbe2-bea3-4da8-b9d3-170f5660e2b0	rispettare le specifiche di fabbrica nella riparazione del motore
a1950fda-c7fb-4ef7-b60a-a52feeaaa233	comprendere il danese scritto
a196ee0d-c310-4609-a307-25d6b3ddf669	controllare gli effetti di un farmaco
a19c52e0-cb4b-4b02-bbca-e88553046951	fornire assistenza tecnica informatica
a1a71e8f-6359-4f33-8bd4-7447c82e44b1	allestire l’acquario
a1a6a180-5153-41e7-9ad1-0a9621676a1a	cinematografia
a19d38e4-2f33-43f0-83fa-cee3bb20d427	individuare le esigenze organizzative non rilevate
a1ac5f3c-69f0-4190-a6cc-e39beb47f720	scienze veterinarie fondamentali
a1b04102-09fa-4bda-bf4a-ccea7546a109	reperire nuovi contratti regionali
a1c33b8c-79a3-412e-9b59-b670d017411e	garantire il benessere degli studenti
a1a21260-e348-4426-a980-6abcae89c63b	gestire le norme di sicurezza del trasporto per vie navigabili interne
a1c87697-26bf-4654-bd83-7275c575381e	controllare la cottura in forno
a1c07a94-3477-43e7-85ab-c61613eb578e	attuare i sistemi di gestione della sicurezza
a1b68c42-52af-43a2-a6c5-c40a746d3d5f	condurre ricerche bibliografiche
a1beaae8-60b0-4759-94aa-a90fefcb071f	sostenere lo sviluppo di attività sportive nell’istruzione
a1cef3ff-db3b-49e3-b882-23b48a980f9c	assegnare le buste paga
a1ded61c-d091-4583-8bab-879235023cfa	verificare la salute del bestiame
a1d589e8-89f2-4d42-9fef-2ea41d5da6ca	fornire le registrazioni relative al caso
a1dd4468-9a07-42e8-9c5e-ad5b6d8df17e	presentare le opere d’arte preliminari
a1d1a8bc-3d21-485d-a819-40d5ee83dc66	utilizzare software per fogli elettronici
a1e55375-eaf4-44a7-bc94-8a9193b0a177	applicare le scoperte più recenti in materia di scienza dello sport
a1f3a16c-8482-4793-a3b3-a9a9680db85e	rete stradale cittadina
a1f61ba1-5311-49a2-a29d-b17f00be8852	processi di frazionamento del gas naturale liquido
a1edb184-9723-4f77-bb7f-2f86747529b6	individuare i rischi negli impianti di acquacoltura
a20c5cac-48a1-4dce-98c2-8331287ab628	comprendere il norvegese scritto
a1fff556-a79e-4441-b8b9-cb69658be28b	biosicurezza
a218afbf-60e0-47cf-8012-f86b590ccd09	creare fanghi di cartiera
a1f0f26c-b727-4a32-b54d-9a43da0f9dc2	ispezionare tetti
a20e9379-d579-405e-ac72-0135d0b07660	mantenere la stabilità della nave in relazione al peso dei passeggeri
a1f65021-3ce6-4968-a191-c73f60417d4e	condurre controlli delle apparecchiature degli stabilimenti produttivi
a21a00e7-85d5-46e2-8170-1874c2878384	attrezzature per lotteria
a220eafc-08b1-48a0-b8e0-8e22e32664e4	preparare la superficie per l’intonacatura
a21afe9f-f393-4ab9-819b-94ac7d791286	predisporre i veicoli da verniciare
a22509bb-894a-41ed-9685-6bf7bc6e2a20	controllare gli articoli pirotecnici in giacenza
a226fe49-b578-452a-9f05-1a530db2671a	analizzare la locomozione animale
a2305b7f-0e96-4f59-b97b-41cddb1cad5b	comprendere il sardo parlato
a23173b1-6c2b-4f03-8e50-ed96ce912594	documentare la ricerca sismica
a235069c-c9c1-4033-aa5c-e620b01ac361	partiti politici
a2477f58-e107-494f-b415-d8a26c49d950	arabo
a252a890-1ef6-424c-8d2b-629004b74bd7	progettare programmi di perforazione
a252a987-7735-483a-a83f-5f9abac2e7ad	sostenere lo sviluppo nei bambini delle competenze personali di base
a26211bd-8b5d-4024-a9dc-1be8e00604a7	rivestimenti vetrosi
a2627f76-5647-425c-b6d3-e37f6f1166e9	negoziare le condizioni per le produzioni artistiche
a263e8f8-6663-4112-955b-452ee792a6db	impiegare le specifiche tecniche paramediche nelle cure prestate al di fuori del contesto ospedaliero
a2662249-02e1-4c33-904a-a71d643d3e67	essere addetto a macchine avvolgitrici
a25a7eba-fd86-4461-b43f-b987f1e0268f	scrivere le relazioni su aspetti relativi alla sicurezza
a277127f-f877-4a1c-b28d-d0f20cac67e2	vendere materiali veterinari
a2667657-57d9-41a9-8f30-8a9cb66cd17e	istruire i clienti sull’utilizzo di munizioni
a2773087-5911-43a9-95c2-bcebedf009de	valutare i rischi connessi alle azioni di combattimento
a26ef35c-1043-4e74-a9b5-f097fb2b4533	dare seguito alle richieste degli utenti in linea
a2843e22-5639-42b2-86ef-2108b2cb3cb6	selezionare lo sperma per l’inseminazione artificiale di animali
a284bb59-8ace-47dc-ae97-664653f55948	gestione finanziaria
a28bd8a6-542a-4891-8ae2-caae4b8cbe9c	interpretare i dati relativi alle estrazioni
a265aec0-e9fa-4a14-8a29-6b11efb20010	raccogliere dati geologici
a29382c2-aa74-48b3-9d7f-46b4c927cc8f	produzione di prodotti del tabacco non da fumo
a2a1e45f-6377-478e-91f9-064878cf9373	pulire gli interni dei treni
a2a42997-94e3-470d-b125-0a4cd9f6e015	gestire la posta raccomandata
a29e5b2b-d804-48aa-a466-504524fda1c7	utilizzare attrezzature per estrazione da fronti lunghi
a2aab09a-d555-4ad1-bf18-a423773a003d	installare le grondaie
a2b2c95d-0b13-4ed2-8eef-ff2ec3346425	estetica della stanza
a2b30502-a3e7-457c-aef3-840952dbb12f	installare i forni
a2a9c8bc-b86e-405f-ae53-a216eed7f84e	lavorare in condizioni inclementi
a2b9abe8-836b-4ce2-81df-38e69e4a9079	disegnare filati
a2c18692-1d44-4da9-8079-cfb938a7a2d3	scrivere in georgiano
a2b3f113-fdd2-4eb4-8da5-01c724f9c794	misurare lo spazio interno
a2d0756f-2efd-4fea-87cf-67e17e732f2c	processo di passivazione elettrolitica
a2d03367-127f-4823-a5a9-db0aa5549824	giustizia riparatoria
a2d22558-919f-4695-a6c8-e793f51e233b	eseguire le modifiche della presentazione visiva
a2cb757b-1fd9-4631-a100-feeb5caf38f3	gestione delle interazioni tra farmaci
a2dd15b5-83c1-41ec-9d27-ee8fd899d71d	tecnologia di trasporto marittimo
a2f538da-deac-4461-a3a4-b1e0e6c8d4ec	comprendere l’armeno parlato
a2ddc82f-72e2-4bb9-9632-30fba114ec0a	forgiatura a freddo
a2ff77de-ae98-4aae-a612-b77268f5bec0	individuare i bisogni educativi
a2fa86a4-4576-48f3-9bc1-abf96e74ff74	marchi commerciali
a2e6b57e-8c7f-4d66-9126-1095c80c7a78	mantenere i contatti con gli sponsor di eventi
a2f5cabc-cfea-482c-b14c-9a34fa508847	riscrivere gli spartiti musicali
a305cf6d-a8f4-4f3b-ba2f-7081daa2c8e9	processo di pultrusione
a3089dc6-e01d-4ef6-95e0-a4f8b6692928	utilizzare una macchina per fotounità
a30aac73-51f6-495d-9647-b031ff1a897f	robotica
a30bbde7-f9ca-4b3e-8aef-4f227c0957f6	convalidare i risultati delle analisi biomediche
a317c45a-b427-4435-932d-a0e0fb7bcc52	soddisfare i requisiti degli organismi di rimborso della previdenza sociale
a32d0343-2417-492e-bd54-00d55df3e4d5	attuare la gestione strategica
a315d240-3100-40c0-baff-0e4c2b9ebe96	gestire condizioni lavorative impegnative durante le attività di trasformazione degli alimenti
a331f7fa-6132-49ac-a8d6-9eeef8f4f9a6	utilizzare macchina per il taglio delle impiallacciature
a3459338-b3e3-4d0c-8164-ebe01141351f	eseguire i piani di volo
a31e59e3-21e3-475b-a23a-43d775a6ab4a	effettuare lo studio di fattibilità sull’area da edificare
a33f5ead-943b-4322-a8e1-3347c9ddcb88	utilizzare le cartelle cliniche elettroniche nell’assistenza infermieristica
a359ef76-ade9-4857-9d9e-d8f1443b125e	stuccare i fori dei chiodi nelle assi di legno
a3541dbf-b022-47c8-a818-60724be769c9	riferire sulla gestione generale di un’impresa
a35cf695-57d1-496c-9f4a-3fed6122ef31	supervisionare la pianificazione delle attività estrattive
a351b8a7-c337-4b00-9d35-bb1dfd391c58	utilizzare stampanti digitali
a361d5d9-9298-4f84-b71d-58553b41b3a5	produrre immagini scansionate
a3684272-b5c6-492d-ad3e-799f925ba8b8	tipi di stampa scritta
a35ad03e-ed58-454c-baab-e53ed0765464	valutare la qualità del suono
a36c4a59-87a9-427e-b45d-ad6dda610242	eseguire il piano di marketing
a3685a4c-5738-4a9e-b635-e3b957a01107	organizzare le consegne della corrispondenza
a372641d-daf3-4954-b184-35de22d2e899	fare i letti
a37503dd-2f01-4a13-9f61-a3845c84f1da	teorie di sceneggiatura
a37c1245-e92d-4132-ad52-0b87dd002039	monitorare il comportamento dello studente
a38142b8-3557-4613-9e8d-c8cac8e0b6e5	processi del reparto contabilità
a34c8a95-126b-41d5-aacb-bb33fb1af2e2	Samurai Web Testing Framework
a3824239-ce9a-49fa-bb7c-ce1beb2650cd	applicare le norme relative allo stoccaggio del combustibile
a3856dbd-4073-437a-b8da-3aa1f7510a47	interagire verbalmente in georgiano
a38cc965-c53d-4e16-a85f-5279b070dd1b	lotta antincendio negli impianti di acquacoltura
a384f45b-de86-4c87-9a1e-bfbc70da5828	sorvegliare l’area di ricreazione
a3927d17-bec9-48ac-9b6e-e11135add4b3	controllare la lista d’attesa
a39aa9fe-9741-4672-9f8e-274fe1e5e83e	esaminare le strutture civili
a395b15c-c796-4f4b-9e76-d3add78e5814	attrezzi da pesca
a3976434-c3ff-43ad-b8fb-1e4f390b2c3d	utilizzare seghe da tavolo
a3a6fc4e-3fc0-48db-9ffc-39676ccdd7f2	utilizzare macchinari per la lavorazione dei fili
a3b57eb7-ae7d-4176-8441-30d7de196eff	fornire servizi agro-turistici
a3b78e2a-3360-4130-a915-a0926dc5ac92	progettare gli interblocchi di segnalazione di linea
a3b7e246-5ad8-4677-ad02-024273304a0c	legge in materia di stampa
a3aec4e9-42ba-4dcd-a682-ca2b09bfc74b	coordinare le attività in uno studio di registrazione audio
a3b82f23-4663-4f52-876f-24ab9f9c3a44	pianificare il lavoro dei dipendenti per la manutenzione dei veicoli
a3ba2562-ea69-43c7-8a34-541c75be8afb	applicare i processi di gestione del rischio
a3c89353-7d9b-4a2e-b948-c76c07467834	supervisionare i sistemi di biofiltro
a3c788e3-2f02-4fcb-b644-db84398762eb	tendenze nel settore dell’arredamento
a3cb88cd-96d9-4b0e-9b8b-93bbb1994531	tagliare i teli di gomma
a3b98d64-81fd-4dba-8ccc-2f6c1e9496a0	coordinare le attività degli spazzacamini
a3cd3c5a-f8dc-4b42-9f86-ea9892988f2a	preparare i fogli di gomma
a3dadc2d-359b-419c-b3b1-fe6b423c9fb2	sistema europeo di controllo dei treni (ETCS)
a3deb9bf-e39c-4c3b-9f79-64d3fa4d8131	utilizzare le piccole imbarcazioni
a3e276a2-c6d4-4f5f-9d73-7882ba99230c	codice militare
a3da1999-7fb9-40b0-af86-571ca1e0059e	stuccare il pavimento alla palladiana
a3db9e88-f47a-49dd-8b0f-2de4cae2ba77	prevenire i problemi tecnici degli elementi scenici
a3e20c00-686e-4c9a-a112-f13c549515ac	scrivere in bulgaro
a3e8970a-9798-4703-84f2-5e382b96ab0d	tecnologie di lucidatura metallica
a3f56a7d-3289-4c11-aaa0-20421c7a1eab	utilizzare apparecchiature dentali equine
a3eb8de2-86d3-4187-939d-972efef1a5ba	ispezionare le merci pericolose in conformità dei regolamenti
a3f840e3-49e7-4959-9fd9-712663ad23e7	assemblare le parti fabbricate di gasdotti e oleodotti
a3f20f94-e782-4562-b98c-826bffdd363f	gestire un gruppo
a3f65e4f-83be-4a6e-bf78-b5c692c0ec11	ispezionare i lavori di tinteggiatura
a3fa8218-b977-4c59-a8b7-e8d2fa22dd70	spiegare le scritture contabili
a40210b6-d548-4973-9674-ccac9df2ca3e	verificare la funzionalità delle componenti essenziali dei veicoli aeroportuali
a405e064-9623-41dc-95e7-e290802cd2bc	spostare le attrezzature necessarie per l’attività di estrazione
a408f38e-9eed-49e4-bec6-630670318460	fissare gli accessori alle piastrelle
a40c4270-4e39-4a39-95fa-c4f4e8cf5f1f	sistema globale di sicurezza e soccorso in mare
a40ed582-fd0a-4537-a5ec-ff4c59399034	fondere metallo
a4186fb5-5b2d-4379-8584-e16d7765483a	valutare lo sperma
a418281e-4e47-4870-8d5c-6dcd672d3bc8	gestire il gioco d’azzardo
a420740e-3303-460a-8127-d795352431fc	Sorvegliare le centrifughe
a422d3a4-2f84-4138-b69b-971a01aab9b5	tipi di nave marittima
a41e8c81-4ce9-4bca-b4ce-60a478fa368f	presentare un artista a potenziali committenti
a42417bc-343e-48d6-9cef-d2a17f371be7	redigere distinte base
a41594b3-4dee-4990-b914-9f7e945deea4	Adobe Photoshop Lightroom
a430f3a2-152a-4130-b6f6-c9733203d9b2	comprendere il latino scritto
a435c3a9-84df-4f5a-9656-149d6e2aa4bb	caratteristiche dell’interfaccia ruota-rotaia
a44022ae-e3fa-4c15-9784-e6716a6066ea	gestione delle relazioni con i clienti
a432704e-1a69-4a4e-870f-5af54518d80e	garantire la sicurezza e l’incolumità delle persone
a441cfba-4720-4d0a-80c6-7e853d7c8b52	fare la manicure
a447cb9d-3421-48f9-9bf0-e330a16bc9fa	neuropsichiatria infantile
a441cda1-1980-4a37-9e70-e7979e128bc8	condurre prove di performance
a44038f0-41d9-4f8e-aa40-533862ae6b71	calcolare i costi di produzione
a450b820-df4e-4701-b8ee-9b907c8a1c3a	tecnologia di diagnostica per immagini
a451e06d-42b6-4a53-9e61-a93a69108635	applicare le strategie di marketing
a463152f-165e-4d8f-be5c-d4a3ec595cdc	truccare gli artisti
a4641a12-93d7-4a91-ac79-1b780a68531b	azionare le gru
a469304a-2db9-47b6-85af-76791f82f027	promuovere giochi specifici in un casinò
a46144ed-baac-4347-a4ac-10b1bc0ed0a3	sorvegliare la macchina che riveste le cinghie trapezoidali
a46d474e-f85e-42fa-9508-52deaf6a3c18	medicina preventiva
a479d1ee-81ee-4457-ae82-f6cdf3c37480	raccogliere i dati biologici
a4726a9e-2e45-47c7-9d20-0e939dbef76d	fornire informazioni sull’impresa sociale
a4812494-e526-4bab-8f55-067e45464093	tendenze nel settore tessile
a469af51-12db-4c43-aad3-48f6afcbf81f	predefinire i costumi
a490eca0-a1d7-42b0-a173-d11df2ad6716	garantire la sicurezza delle auto parcheggiate
a48b16b4-d5ed-4dee-855c-305712e99a08	decantare vini
a493e6ce-4573-49cc-9d7e-534f65530899	regolare la miscela della vernice
a4869a25-c722-4704-b0b7-9ae7ab360ac8	controllare la chimica dei pellami
a4741756-3d9c-4e9b-bd0a-9815da88fead	mettere in collegamento i reparti manutenzione del veicolo e operazioni
a4a6b90c-4187-40c2-8d35-73e019b34e1d	monitorare la pesca
a4c07cf3-22cb-47e1-911e-09daa612228d	alimentare la macchina di pultrusione con la fibra di vetro
a4c084b5-debc-4868-b202-b64bb13944b0	modificare le immagini
a4a0a63d-b239-4b52-bc27-059094df692a	formulare valutazioni in materia di salute, sicurezza e ambiente
a4c62cc5-595a-4780-bf5b-13c28b510f1a	disegnare bozzetti di disegni e modelli su pezzi da lavorare
a4bfe32d-48fd-40ec-9760-75a193674b1c	preparare relazioni di produzione
a4cb75ad-6196-4edb-9f57-fe3af720fb2b	programmazione di sistemi TIC
a4d7290a-8940-4900-a52d-0e5ad6566edb	formare una fascia continua
a4c76f6a-8437-47e7-bc07-c0d9e60238f4	partecipare alle attività di verifica delle cartelle cliniche
a4da791d-2380-4d01-b7a6-5ce31d12d13d	individuare le minacce di terrorismo
a4e16a59-e370-4580-b747-7c6a6333be5c	comunicazione
a4e4a8ed-d4c2-4bdf-aa9f-f429a23dea76	principi di elettricità
a4e6e2f0-d207-4aca-8f72-0fd1cc76087d	lavorare in squadra in ambienti pericolosi
a4eae317-73e9-48e1-969a-7c131051492d	redigere le norme per il servizio di mediazione
a4e77246-8000-4522-aafc-7e7338f356cb	sviluppare piani per la distribuzione del gas
a4e512d4-b259-4d02-967a-8443cbd89d8c	valutare l’intervento di chiropratica
a4f14cce-4ddd-4a92-a776-6403de757ad8	preparare disegni di montaggio
a4f37dc8-573d-4133-8234-dfd2c525a4db	attività alberghiere
a4e38c6d-9c4e-4606-a0b4-288516aa4c5c	raccogliere dati TIC
a4f320a5-0d62-4f8c-b4e5-9068a55473e9	gestire gli impianti per un evento
a4fc1790-71ca-4373-a0b0-e10ae7eeb9b1	essere addetto a macchine laminatrici a freddo
a4fb44db-1895-47bd-8b16-0389ff426928	gestire le biblioteche digitali
a4fcfa43-13e8-4469-bfb8-d6d333b4e1c0	offrire consulenza sulle decisioni giuridiche
a5014677-06ef-4b78-a826-23b9df1710f5	incisione per sabbiatura
a503421d-9655-4afb-95c7-f8dfccd5ea20	addestrare l’equipaggio navale
a51246b2-c537-460b-a03d-41cf7b17b9b9	fornire assistenza per l’automedicazione
a515ba4a-5a14-4cf7-aa76-597f2fccbf4e	utilizzare uno spargitore
a515e9b5-de83-4ce9-964a-d70310d56861	effettuare la manutenzione dell’impianto idrico
a51ea10a-0f85-4196-a041-0134665d8462	medicina del lavoro
a52931b4-2196-416c-896f-44b4d8217325	legislazione nazionale in materia di antiparassitari
a53657f8-d289-47f0-a5cd-24a000306f7a	azionare la macchina di rilevamento dei difetti del binario
a51aabd9-eff1-4181-a704-270fab310908	individuare le risorse tecniche necessarie per ricostruire un lavoro
a539fe93-e2b7-450e-998d-5728b2170f57	monitorare le prestazioni dei canali di comunicazione
a53a8c04-27c5-4c46-a291-832f48195388	eseguire il neuromonitoraggio intra-operatorio
a52f8396-ae2f-4864-adb0-40dbc1415f45	assumere personale
a54d5e3f-5298-4bc2-9d48-d9b0b8cc1581	stabilire le strategie per la gestione dei pagamenti
a54d85c4-e765-4633-abc4-07a7748b74e9	fornire le valutazioni oggettive delle chiamate
a5527d76-df97-4fa5-a06f-9f0fa5a7c5a3	tagliare il filamento
a559d6cc-2a7c-4596-a9b4-bb763c188282	gestire database
a55a263d-d532-43d1-b625-666f5debab4d	organizzare la piantagione di alberi
a569d755-8071-4193-97c2-84ac9a019b66	valutazione dei parametri psicologici
a5683582-2eb7-4e05-8550-6a3d1d5ac27e	calcolare i dividendi
a56c266c-abe1-4725-8601-f4b7076ca611	usare apparecchiature di identificazione delle pietre preziose
a5760df0-2c5b-4402-8f25-1df99bcc418c	gestire i processi postvendita per conformarsi alle norme aziendali
a56a9bf9-e5f3-42af-ac56-2204d749fad3	sostenere l’attuazione di sistemi di gestione della qualità
a578bb87-f3b4-428b-aa30-ea3651dbfe7e	analizzare i bozzetti dei costumi
a580f0a1-3408-42e3-b84f-1b039e8d83d6	valutare la capacità degli adulti più anziani di prendersi cura di sé stessi
a592d671-d777-4a9d-9e25-211ba85946c6	monitorare le condizioni che influenzano il movimento del treno
a59be578-4442-4826-a910-538b7348096b	individuare le specie di acquacoltura
a57d25a2-8ccb-44e0-a306-f2b5a0539f5a	collaudare sensori
a5a87512-82e4-401b-b4df-cbd1c614fc76	completare le schede di valutazione delle chiamate
a5a0cb5d-c503-446b-8045-5f34a6baf4b6	utilizzare i materiali artistici per disegnare
a5ad7258-f36f-4d5f-98bc-53d878181781	preparare pezzi da congiungere
a5b09b1c-a195-4cf5-a9ce-68b9b567d7ff	monitorare i costi dei pozzi
a5be5a90-aeb0-42f2-a6a8-6d61ec9496b9	gestire le ammissioni degli studenti
a5b50c5c-2ace-48e9-a5d2-4f0a2797d66a	aggiustare le piastre di piegatura
a5cbae3f-a6f7-429f-b0a0-b876ddbaac96	esaminare la conformità del progetto alle normative
a5bc7c0f-80d0-4be3-95d6-1c5d1a228a75	diffondere le comunicazioni interne
a5d5b5b2-e8bc-4afe-a742-87f21abdd9d3	aggiornare i messaggi sui display
a5c187a5-06d6-46e5-aaf5-66b3cadc74ef	trattare le buste
a5d54633-9a7c-4815-a74c-f523686a7f7b	supervisionare le attività artigianali
a5da061a-7a84-48fd-881e-dea53f7e3868	insegnare nella scuola secondaria
a5de00c6-2538-4d6e-8171-a4e84dda35d0	servire bevande
a5f3cba4-cbed-4f60-8dd6-a07cd6060708	comparare i contenuti della spedizione con la lettera di vettura
a5f81ae4-13cc-4290-b817-79a450184558	sostenere i minori che hanno subito traumi
a5b0953e-9b1e-4800-9c99-e836b23d3ccf	gestire i progetti di costruzione ferroviari
a5f8595e-9f8b-494d-8b82-19ceccf886be	sviluppare procedure di collaudo di sistemi microelettromeccanici
a5f9db88-1d64-421b-9119-bc34c6d74106	vendere attrezzature da ufficio
a6024408-9cfb-4cf9-89f5-c68e80f1f51c	apparecchiature speciali per emergenze
a5ffbdda-acc6-479d-bd2a-bc4b2b8b12f5	osservare i nuovi sviluppi negli stati esteri
a607f05a-7e94-48d0-a3a1-849bac39ddf2	eseguire la puja
a60d35ad-32a0-4495-8b18-c2b7fc7b1ff7	analizzare i cereali macinati
a6102c86-318e-4d68-bdb3-7ccc4464fbd9	eseguire lo screening per le malattie infettive
a612bb55-70ae-4e7f-bf42-0955972b7a3f	infusione endovenosa
a6163ee8-e9fc-40ba-9556-5b295ea0c5e3	creare lo stampo per la formatura sottovuoto
a6175ac3-58e1-4f2a-924f-ff8ffbffdbe8	elaborare programmi di valutazione della formazione dei pozzi
a61d51c7-394b-449f-980e-417e65df231a	scanner di microchip
a6172ebc-2b9e-4a9e-b4bc-cbd00834d74d	raccogliere informazioni tecniche
a6191783-013d-40ca-a637-394a978944c5	calcolare il costo del debito
a620ad59-d2e8-4e8e-8e0c-e541d1b09407	eseguire la pre-miscelazione delle foglie di tabacco
a6553b38-ad95-4d3d-8b6c-d65872bb36b8	trasformare il legname usando macchine manuali
a6458eff-0314-4109-b6ed-a5a909f159c5	valutare le risorse minerarie
a63e7bb3-8421-4614-a33a-d0e6f3adbdb2	determinare le condizioni di un prestito
a6575852-7091-4941-a766-91bf5104d745	acquisizione di immagini in movimento
a657e93f-d402-486f-9aa8-a72dd354037c	requisiti di un’architettura ITC
a63f60ae-003f-4e5b-a389-375e254f28d1	correggere i testi
a65b1929-14a2-4ca0-a1bb-1203e064edf0	riparare dispositivi TIC
a66326a5-0515-4492-a3bf-34c6da5ff4b4	stimolare il personale a raggiungere gli obiettivi di vendita
a6633c9f-e84a-438f-8298-394352944cac	eseguire la smaltatura
a664db18-93e4-4c25-a6c7-e97807d8a9e8	esaminare la conformità dei documenti
a667019a-8f51-4a68-85b0-5f4d51c8a2fc	STAF
a66c912a-db5a-4d5c-97ea-152a0af75e71	negoziare l’accesso all’area
a66bb8fe-2ae0-4560-96fb-cb5a88749fa4	principi del lavoro di gruppo
a66cafe1-e8a5-4a5b-961a-3d9a2f509189	offrire consulenza in merito alle attrezzature della miniera
a66e74b5-6af5-4a2a-95f2-86230651d779	assistere nell’installazione del sistema audio
a683dc78-d7ac-432f-adb8-313da3439172	assertività
a680e740-923d-42c0-94e2-387347758a3d	controllare i prezzi delle vendite promozionali
a6665015-3710-468a-853e-9cf1ac4155cc	garantire la sicurezza nel trasporto aereo internazionale
a6880921-4daa-444b-8a96-5bd0fbd0e880	inchiostrare piastre di stampa
a6970475-af6f-4423-9829-24d5c0a55762	conservare i tabulati telefonici
a69dc417-89ed-4cef-846a-e7abd406eaf5	controllare il movimento dei treni
a699aa62-03a6-4428-8557-798e91767b5d	trasmettere gli ordini di elettrodomestici
a6ab0d7d-3926-4f92-9f2b-bef5e9c3ca69	notificare al supervisore
a6b3277e-ebe6-49ca-832e-a7d815f07982	relazionarsi in maniera empatica
a6c55d30-4df2-49e6-a3f0-8103404e785c	utilizzare strumenti di rilevamento
a6b45206-d9f2-413d-890e-b1d8c0853182	sostituire le macchine
a6cd4c5c-7d67-4f84-8640-3ad28a22a82a	movimentare le bombole
a6d173c5-ce9e-4372-b451-03a0415eef2a	analizzare l’ingegneria di perforazione
a6b3b9a1-7174-453b-acce-3d23b593129a	applicare le competenze tecniche di comunicazione
a6e7e2ae-cf95-483f-95e7-9792255d4591	sostanze usate per rivestimenti
a6f39001-cae9-4bde-9f58-ea3918add79f	scrivere in gujarati
a6f8a3ed-c708-4f6e-a2a3-fd9855f2b938	azionare un impianto di produzione di biogas
a6f82530-6016-4791-97c2-c0cbacba2fe7	osservare il comportamento umano
a6feaf85-3c2e-439e-ba31-9c6c2c8b9212	effettuare la manutenzione delle attrezzature per fisioterapia
a703c63c-e5e2-447c-93c6-38661143bbf3	comporre piani di stivaggio
a7093448-8c60-4f12-b381-9ab4f35c9b78	fornire istruzioni su come configurare correttamente le attrezzature
a71b2a9e-9c6a-4875-a851-c46845537d90	identificare i danni degli edifici
a71986d6-d465-4f66-ba93-9b0a247337a6	offrire consulenza sulla prevenzione delle infestazioni parassitarie
a71c5b3f-59c9-4d33-b797-b6f15f9833f8	analisi di fluidi corporei
a705d97f-841a-4709-8ab3-7d35845acc19	effettuare una valutazione della salute
a71cbf8c-a767-4cd3-92ba-fa12fbfeeee4	consegnare la zona di preparazione di alimenti al turno successivo
a7305069-3eb3-4be7-ae6d-67379e674e7d	macchinari per l’estrazione, l’edilizia e l’ingegneria civile
a7319bba-4d37-49eb-b81e-a4584cd311c2	metodi di sorveglianza
a721fb86-9bf6-4cee-a827-86d1a09a3d9b	gestire le emergenze odontoiatriche
a7261a18-ce8f-48e5-a452-050305c8e815	eseguire le attività di ricerca meteorologica
a736af78-dcc4-4489-8093-7bceb32d80c9	supervisionare lo scavo
a73aa75f-35d1-4666-b41c-a07df6c8d505	forme di taglio delle pietre preziose
a743769b-0a7b-43f3-b3fa-28c67253778c	praticare la scherma
a744a837-b055-4237-971d-539a53f0a2ac	valutare le priorità di riparazione
a73fafa0-0952-4aec-871c-7d15beac0996	utilizzare gli strumenti da gioielleria
a755ba4e-2e66-4384-8dd9-521beeebadf0	processi di distillazione a vuoto
a7474f22-7db1-4fde-9cb5-13d87c41e226	allestire il dispositivo di controllo di una macchina
a758c0f8-d411-4dc4-8ae7-7cdb5fa5684b	consultare il personale tecnico
a757a51e-aaeb-43e1-a713-054f594f9492	raccogliere le risorse per la salute e la sicurezza
a7539a2c-f1e5-48ac-9500-ba621d725e57	configurare sistemi TIC
a76586fd-34a3-417b-8a92-b9bd5a2bba13	sviluppare programmi per trattenere i dipendenti
a75d069f-17ca-491c-bd9c-6c1ef37fcd68	pompare la cera
a767ff3f-4205-4c2d-8953-d1573f7c7f95	azionare le apparecchiature di trasmissione
a770fc3c-cee4-4acc-8ec0-8a9a4f311124	controllare le condizioni di salute del paziente
a76ea4d4-2706-413a-a894-572afe3d7da0	collaborare a un progetto energetico internazionale
a78452f9-7198-4f04-928a-a028cf79b242	applicare il nastro adesivo
a78ebf28-94f1-4a2c-8ef3-99f2d5e07cf5	gestione del manto erboso
a7633280-9a50-42b0-b7fe-162a250234c3	raccogliere dati con sistemi GPS
a7a8de14-7645-4edc-bf5e-08be1d829d4b	scarico di rifiuti raccolti
a798fd13-7d62-4fa9-9415-1d23d9a694a1	controllare le malattie dei pesci
a79e7f6e-c324-48df-85ff-bd3c7f12526c	utilizzare i materiali ecologici
a79bfe70-9629-495d-8c0a-3592259edaa8	pianificare attività di produzione
a7b4977d-413b-498d-b0f3-187d4daf8a51	progettare modelli in scala
a7ae3186-8de0-4f3f-a977-622bda5c8e9e	strumenti per l’automazione dei test TIC
a7b6a4a1-c05a-4243-af66-03bad0fd7684	medicina d’emergenza-urgenza
a7b1320f-a926-4036-8df1-7cf5a3df7372	orologi e prodotti di gioielleria
a7b93a67-7a86-438f-9d22-b0675ce7be6c	alfabeto manuale
a7b97862-c0b8-4e9b-a341-e76ce8978b93	commercializzare gioielli
a7c839c6-ff33-461e-b206-a958b144b979	medicina fisica
a7d09c72-a83d-4d2a-9724-42888250249d	principi ecologici
a7d46a93-5cb8-48a8-83b2-5643727550d8	effettuare operazioni calorimetriche
a7cf0954-7c31-4243-97ce-bb62b76ef6b4	garantire il rispetto dei requisiti da parte del prodotto finito
a7dee465-7e8e-4aeb-a3a3-e1fe8bfebcf3	fornire una terapia di intervento precoce per i neonati
a7d5ed85-c4e3-4e54-bf51-9fa93c4a7822	utilizzare software per il disegno tecnico
a7e4855f-76f5-4ed1-ba75-40679aeb6688	causare esplosioni in sequenza
a7e64ff5-7318-4a83-9905-35c08382af85	effettuare la manutenzione delle attrezzature dei veicoli di soccorso di emergenza
a7fb96d4-bf9d-4be2-892c-8ccaea61f920	utilizzare gli strumenti oftalmici
a7e7f53d-7108-4145-99b7-f208ea71b153	tatuare i clienti
a7fe08e1-1fe0-4f6b-b433-80e08d9086df	trasportare le attrezzature da ufficio
a80130e6-2fcb-4ff6-8211-2149c5faebbf	raccogliere il legname
a804bbec-d9c8-4177-8597-a54c5f34ded0	posizioni animali
a7ff817d-f0b4-4e92-ab22-5096cf4a8d0f	ispezionare il vetro nel forno
a8065ae7-7f1c-406a-8bce-f8969c1a7ad9	monitorare gli sviluppi della produzione
a80b0d72-15d6-46b2-946f-1d1b5e9830bc	interagire verbalmente in ungherese
a81f5fdf-c742-4d5d-83ba-cf6f36e1be53	essere addetto allo sbiancatore
a81f7f83-2203-4785-a7b3-51b1a6a2e7ca	pulire i mobili imbottiti
a820e198-199d-47d5-94a3-f5636fd9c467	eseguire il merchandising incrociato
a82b6f5a-69e5-4b43-a52b-17343b2f3fe9	criteri di qualità per impianti di stoccaggio
a83943e7-8fa1-435d-9970-1c68ec3b8efb	gestire un comportamento aggressivo
a80f0a66-8ae1-4ccf-8936-d4a4d754c6aa	valutare l’impatto della raccolta sulla fauna selvatica
a837c9f1-390e-40c5-a012-21e875515e64	monitorare le tendenze tecnologiche
a83f6650-2f39-4a1e-a5d3-1a28b1bc8b20	processi di sviluppo contenuti
a843323e-9df8-49f9-8acf-ed8dcb8ac318	tecniche di coking del petrolio
a84c88a3-b4dd-48a3-ba17-66eee0a8568d	utilizzare separatori per la farina
a84ec9d0-9f7e-4356-a46f-78f3746703b6	valutare la contaminazione
a8504fe9-6b33-4315-a106-7d97700f7187	preparare i materiali per le procedure odontoiatriche
a848c711-389a-43a1-85c7-325b1c8c1d99	gestire le situazioni difficili nelle operazioni di pesca
a85588c4-dc6c-4111-ab58-7ec4189543ec	SAS Data Management
a85e7a81-935d-4f3a-870f-58eab29b3923	presentare le prove
a862947c-594d-44df-bdf5-4fe1025b6f21	gestire le attrezzature per la raccolta di larve
a860ee4e-b0b2-48ea-8260-51e774728aa0	uso di attrezzature di trasporto
a85ec4c0-80bc-4d19-8f0e-dfec2466f915	valutare la possibilità di far lavorare una persona con un animale, verificando se la persona e l’animale sono compatibili
a84fec90-47fb-49f3-9731-e8dee53922ba	registrare i progressi degli assistiti in relazione al trattamento
a86949c8-3c59-4877-933f-9b071a75b1e2	mettere a disposizione un ambiente psicoterapeutico
a86a009e-0217-47dd-afd0-bee4f6ecb081	aspetti chimici del cioccolato
a87c104f-db7f-463e-a61e-57027a70ff36	monitorare le prestazioni degli appaltatori
a881b204-cb69-46b2-a2b0-826063003fb7	preparare i motori principali per le operazioni di navigazione
a6d4a819-3f86-4bef-a9b8-0676932ea626	JSSS
a88cf1e3-09f1-4090-93ee-a2122e722ffc	prescrizioni legislative relative alle navi
a88c20be-f710-4db3-976e-30502ae7eeb1	ridistribuire il denaro scommesso
a89ca8ad-e8db-4e6b-acb5-9ddf22debf4f	preparare gli zoccoli dell’equide
a8a075a6-a7f3-4a68-a300-f77b09722fa6	operatori del settore degli aiuti umanitari
a8a1d596-e72a-40aa-8e29-3797f1ff5740	processi di rimozione dei contaminanti gas
a891f885-a674-45af-9d10-4c1ba7268ad1	lavorare in modo indipendente nei servizi di silvicoltura
a8a4a3dd-a871-4661-822d-ba6c0914a32d	sottoporre a test di soddisfazione le fragranze
a89ca61c-7fce-41e2-a0a0-5a1647b15a77	fornire informazioni sulla sentenza di un organo giurisdizionale
a8ab1fcb-878e-4299-84bb-5c0e200a6623	urbanistica
a8af08b7-d476-4c65-95f8-4aa0bdd21685	preparare la base per il pavimento alla palladiana
a8b0562a-311e-4dce-b060-af6600462b3f	utilizzare un bulldozer
a8b75f6a-5156-4c15-8a13-6de336c329ce	teoria dell’elettronica analogica
a8c94ecf-b8c0-4e24-921a-097586cb9547	lavorare in un ambiente multiculturale nel settore della pesca
a8cd82f3-c528-4ca1-9f29-37fec6db67b0	principi di psicoterapia
a8c99283-0c76-496a-9454-58c96fb37b9b	seguire le istruzioni di segnalazione
a8ca35cc-6db1-42d3-a140-afb981dd0be2	configurare le attrezzature di proiezione
a8d1400f-82c4-47eb-bf59-0e2d91e8dfb1	elaborare accordi di licenza
a8d5209c-8718-4a69-aea9-17be6786737e	tipologia di parti di carne
a8e5afa2-a862-42cb-9877-81ab0cfeae23	mantenere i contatti con i soci
a8e0cc61-1ba4-4357-bd84-86c2c48c4917	assistere ai trial clinici
a8f8698f-df24-4da3-b460-01364e7809ce	controllare il mixaggio dal vivo
a8f97eeb-6c21-40a1-90aa-3afb3a17f690	eseguire gli interventi di immersione
a919c8c9-d4b2-4a81-8ae5-760adcde62f0	processi di produzione di alimenti e bevande
a900bfc0-922d-4761-8fd0-f304e5e888e0	effettuare il primo intervento antincendio
a9240e22-739b-465f-b9c9-98be0ca811ff	creare contatti con negozianti
a8ef40a8-a3d7-4afa-8c20-31ecf47773a5	controllare la qualità dei prodotti lungo la linea di produzione tessile
a932fd6c-b110-4648-b617-07c9ef368128	consultare il cliente dello studio veterinario
a93a3a70-1ba8-4a09-aa21-a41c6eba0960	creare menu per eventi
a93ae8b7-3d59-4a13-aa6f-b3d6813c5e60	monitorare il processo di produzione vinicola
a940c4db-43f2-4dba-a51e-5e680bf93c39	epidemiologia
a940aa8a-3819-40db-8160-71bf6ee4fa4f	offrire consulenza sul miglioramento della sicurezza
a9524914-320a-48d6-8b48-270dacb7e80b	trattare fibre sintetiche
a950854d-b049-4423-81fb-ee9f5c57957e	eseguire la manutenzione di sistemi TIC
a95436eb-bc64-4630-8662-daaa955cd3e8	diagnosticare le malattie tropicali
a9565a7b-c365-4ffd-83b0-11eea04ba621	rimuovere il vetro dalle finestre
a95d4c46-b596-4c08-9875-af7eb5afea72	effettuare la manutenzione dei sistemi di sicurezza
a95a729f-2804-4de0-9c6d-8e17d1553de2	supervisionare il montaggio video e cinematografico
a9638f9c-cece-4975-9ab9-67f8ced4798a	manutenere apparecchiature di collaudo
a9666a98-375d-45e9-b329-bd62f229c165	preparare e decorare prodotti di pasticceria per eventi speciali
a97154c1-1aec-49e3-b5a4-fb595065eaca	linguaggio dei segni
a96bf76b-522f-4e32-95e1-f2b6604bd0fe	industria calzaturiera
a975f9a3-9491-4ec4-8c38-8563e5fedc39	utilizzare il software di pianificazione della produzione
a97debff-07a8-418f-adab-4512197cf715	pianificare i menu dei pazienti
a98327b8-2916-43c1-a014-d2ac5c567643	effettuare una diagnosi della salute orale
a98635dd-5ae2-4a4d-a6b0-98f00389b80e	controllare la resistenza all’usura dei materiali
a97ac237-e883-4f70-a737-e1b8c248a911	interpretare informazioni tecniche per lavori di riparazione elettronica
a9993e11-e139-4fc6-9887-26ff73a83030	posare i mattoni
a991deb3-a537-4f8e-9284-9ad5ba22e87e	logica
a9a0f687-ca6a-4568-bbc2-3c45776873c3	analizzare lo stile, la gestualità, il ritmo e l’intonazione dell’attore straniero
a98c5818-019f-4ac3-94fd-52b92aeb9615	seguire le istruzioni scritte
a9a12d6a-40a9-4a10-9a23-986c90c7daaf	sviluppare un calendario del progetto
a9a55f7e-5ecd-4a45-aff7-304125b88c15	operazioni del servizio ristoro
a9a82134-973c-4b9d-8485-6314c4f7499a	preparare le attrezzature per le operazioni di navigazione
a801e983-099f-4c78-a837-374dd3fc1a64	essere addetto a torni
a9ba7332-9d26-47a5-85d6-9d8442080051	chirurgia d’urgenza
a9bd2751-924c-4daf-bc15-58171d6159ae	partecipare alle plenarie del Parlamento
a9bb3707-63ac-4ce0-ad05-31d576ae90cc	storia dell’arte di strada
a9bfe54a-6828-49a5-9c13-3eeaa3a33bc3	industria tessile
a9bf0bda-92b7-403c-b238-35821e27c344	bilanciare le esigenze personali dei partecipanti con quelle del gruppo
a9c0552b-ddbc-4b9a-a343-12785ddfdfd6	informare i clienti sulle modificazioni del corpo
a9c52f18-950d-43ee-aef0-f91be1ff1c5d	calcolare il rapporto di trasmissione
a9d35446-da85-4400-9e0e-a35aa0e5a21b	eseguire gli interventi di igiene dentale
a9d936fc-098a-4e84-805f-ec5acaf9e296	manipolare i cavalli durante le procedure dentistiche
a9d8fc20-3c7f-4d00-a5cf-533ab756431c	ingegneria del traffico
a9c58442-2254-4208-89e0-7d435e9440e2	garantire condizioni adeguate nelle cantine vinicole
a9dbb72b-d237-4ba6-b830-46c29e1978d7	rifornire il bar
a9dfdf05-a145-4b0e-8079-a6f9f6f1d16f	gujarati
a9ead5b0-e72c-497f-af68-87f0dfce1ec2	effettuare gli esami di neurofisiologia clinica
a9f54764-1652-40b6-9613-be77a9707304	garantire il rispetto delle normative sulla protezione dalle radiazioni
a9e101c9-6fe7-4218-b30c-92885369bcc8	risolvere i guasti delle attrezzature
a9f8c115-623b-4382-8fe1-a20f08295872	progettare l’illuminazione
a9e35598-1bd3-417e-8ce3-be46f9f980ff	leadership infermieristica
a9f9fd7d-bea6-4560-9bcf-d38619dd33f1	convincere in merito alle merci da vendere
a9fbe524-e0bb-4aad-88cc-c7c427879ae0	ideare oggetti di scena
a9e0590e-e2cb-4d77-8d62-0660ae0b9112	determinare le azioni operative di sicurezza del treno
aa0c0c48-c786-46a2-9bf3-bc1c9e6fe3b1	verificare le carrozze
aa128a79-c0d8-4193-864f-a9fa39c8da9f	manuali di macchine da miniera meccaniche
aa1430f5-f633-4195-96f2-187e0c182058	comprendere l’estone parlato
aa1a6e33-2cfa-4615-b7c6-754e82c96364	assicurare il funzionamento del veicolo
aa14842f-fcfc-4233-9184-2cfe9bcd26df	analizzatori automatici in laboratorio medico
aa03207b-3c48-4c90-9573-92f3820136d8	effettuare controlli sui dipendenti
aa1bf306-9e80-4845-a270-72c567f164b0	tenere il passo con le tendenze correnti in materia di psicoterapia
aa233f24-3485-4f43-8193-93ec679becd0	rimuovere la vernice
aa26179e-bace-4b6a-88d9-274065f7d5b9	applicare un rivestimento adesivo per pareti
aa31a629-4f78-454e-9b80-1e2f67e24d40	combinare la tecnologia aziendale con l’esperienza degli utenti
aa3ccbe5-1149-4070-9da0-1213901e9777	fisiologia dell’esercizio fisico
aa3b2789-4a33-4303-8f14-b4e5a1082cc8	tipi di pannelli fotovoltaici
aa2cd220-c49a-4139-8042-f0c5d6a2a561	gestire il tempo nella paesaggistica
aa3d2519-4168-4b80-8bd6-b3d5e8e2b11d	gestire la logistica dei materiali promozionali
aa41e440-915f-4c0b-a49c-b77d37e7834a	possedere capacità dirigenziali
aa479b31-0d8d-4858-90aa-a82e84ac39ca	applicare il processo di sviluppo alla progettazione di calzature
aa4a49a6-8395-43ea-8259-8ce50905558e	principi diplomatici
aa4dc470-f53b-4df9-98e9-9ef60f90e81f	comprendere il finlandese scritto
aa50bb34-ebbb-40bc-af01-b2dfef86c262	creare sistemi di drenaggio aperti
aa52e689-e784-4bdc-b37e-4325ecf0b026	applicare gli standard e le pratiche dell’orticoltura
aa5d51cf-06fe-415b-9351-fd1fb2b51e73	ascoltare le argomentazioni giuridiche
aa58e37c-0310-4246-bba1-4d6e3527b922	individuare le nuove opportunità commerciali
aa4ae169-8f77-4e85-98d5-e49540b18159	avere conoscenze informatiche
aa6d1481-4817-4253-96e1-a53817c5f479	insegnare sociologia
aa746484-38cc-475b-a31d-57144f957a48	utilizzare espressioni regolari
aa5ec84a-aaa4-4458-8268-4f018d761a34	tutelare i dati personali e la privacy
aa78c8b5-7416-420a-bb4a-305d7f84ba69	regolamenti in materia di aviazione civile
aa83f71c-5c9d-49b9-b69b-4e431254892b	saldare i macchinari della miniera
aa7eecc2-b7cf-4d4a-894d-39c9d97dbd01	gestire il tempo nella silvicoltura
aa842030-876b-42ff-9715-b9b4c8a2658e	negoziare le condizioni con i fornitori
aa897d8d-239b-4feb-9862-780c4b2a6fe4	chuchotage
aa8d9879-b598-4668-aa22-89d67d2e8bb0	ascoltare i resoconti delle parti in lite
aa92ed24-cd3b-4fe5-bcf5-f6f08ac0e1dc	funzionalità dei videogiochi
aa9f18c5-b880-49ae-a04e-301f6f06120e	effettuare la manutenzione delle apparecchiature audio
aaaa759e-0874-4e0a-bac9-ef880a45af80	installare gli sprinkler antincendio
aab89f53-1241-4a03-aba8-6c67a00f5e7f	industria della carne
aabb11be-e0d4-4b55-b7a5-dd9b956bd4f6	effettuare interviste
aac651bd-bc80-4302-9e72-8227d3237459	formulare i questionari
aace3002-bfff-4f7b-8743-4931aae48a63	valutare destinazioni turistiche
aabbdbe0-ff6e-497e-b522-4c3760023c6e	gestire le strategie di sensibilizzazione
aa870d7d-d74f-4c3b-b04e-e3b0a28c8ff6	sistemi di classificazione delle pietre preziose
aa7503e0-fe66-47c3-90f9-16a431a6430b	creare una rete di contatti con i fornitori di servizi turistici
aace8328-d247-46ac-b679-2a95d7f1b549	fisiologia dell’equilibrio
aa9262a0-518f-4d43-b7da-e7eac117b208	immunologia molecolare e cellulare
aacfebed-cf39-4ca0-af8b-d85db41de710	integrare e rielaborare i contenuti digitali
aad98d3e-c173-41b3-8430-068c17b53b26	comunicare con gli spedizionieri
aae4d7c0-5804-43d3-9b8f-69eb28975c0f	controllare il latte
aadccdb5-a102-48bd-8d30-7986e14aa349	assemblare apparecchiature optomeccaniche
aae0960d-f1c7-432d-b894-965f71cfc567	contribuire a definire il calendario degli spettacoli
aaf2f343-8cc5-448e-8a24-6288f986c61f	comportarsi in modo cortese con i giocatori
aaf0814a-8242-4499-a2fe-46fb2577700a	fornire informazioni sui contratti di locazione
aaf595a6-d9e7-4cff-85ad-25682910118a	prendere decisioni in materia di gestione del bestiame
aaf71132-2ca3-4d8a-8f7a-33d22cc248a1	gestire i flussi d’acqua e i bacini
aafd5a6d-fb9b-413c-97b5-cb227ef67d50	monitorare le pratiche di identificazione degli animali
ab002650-4de4-460b-82fd-fa1f677e0bdc	utilizzare pozzetti
ab144482-ec2a-4867-82e6-e8f3624ad02c	ingredienti potenzialmente dannosi
ab19dbfc-2f80-4dad-a1cb-42342d022b83	cucire materiali di carta
ab193aa9-9e32-4806-934e-7186fea80fc7	garantire il rispetto dei regolamenti dell’aviazione civile
ab252663-4cc5-49db-902a-a988b6acbf35	progettare gli strumenti di analisi del lavoro
ab2bb1a3-832b-4a70-9b53-50f41390120c	fornire concetti di psicologia della salute
ab2bc62d-5fc9-4ee4-ad3f-68731a11c573	assistere alla lettura della sceneggiatura
ab401c92-2e0c-4cdf-a7d1-ba96ab06aedc	controllare il vagone che compatta la massicciata
ab2c1c2e-617a-4b0e-841a-698d29c5c0fc	riparare componenti elettronici
ab1f6b30-425a-42aa-88f0-c1d60cf0718a	Swift (programmazione informatica)
ab4f288b-fd90-4381-8d33-6e9bcf071e7c	mantenere informato chi ha presentato una domanda di sovvenzione
ab51e43a-886d-41fe-8a85-2c830759ab43	assistere gli ospiti in partenza
ab3cc00e-b0ff-4678-9be8-90a326dc50d9	consigliare migliorie al prodotto
ab42da1d-fafd-4eaa-b33a-95b559563452	coordinare le attività di trasporto per l’esportazione
ab5d8482-f40a-4071-b01f-de0ba87ccc4e	somministrare i farmaci in caso di emergenza
ab6116c2-7557-4e60-b4a1-3c7256ca6348	smantellare le pompe del calcestruzzo
ab63a579-08c5-43fc-bfb7-1de936dd33c4	garantire condizioni di salute e sicurezza durante la produzione
ab645430-da41-48ff-829d-0539137410d6	officiare le unioni civili
ab7c7fa5-ac4c-414c-a888-11282e25a3aa	fornire una valutazione psicologica clinica
ab683846-1276-4234-b3c7-5831ac1b586a	riabilitazione di tutti gli apparati
ab655be6-dd6a-4577-bda8-509ea683251e	controllare gli inventari dei liquidi
ab6b9c27-9ada-4eed-9c3b-d039f72b1206	fornire informazioni su un parco divertimenti
ab6e534e-9b22-4b5a-bf8d-916b64af570a	installare struttura a molle
ab84aae8-21ea-47a9-b9ad-9a39fb15bf68	imballare i prodotti del legno
ab711c97-d47e-46f2-893c-71881c1ac4a2	gestire documenti digitali
aba90d33-73e8-47af-b470-de3ac5205da1	progettare programmi di formazione relativi al lavoro con animali destinati agli individui e agli animali
abb4c97f-6732-4c86-aa90-02303b065471	radiochimica
abbd2a98-98ad-4f05-a62f-52be0eb5bab7	raffreddare le candele mediante immersione in acqua
abc10df4-c2ff-48d3-bda3-b817d43c9972	eseguire la sabbiatura del legno
aba58c54-cb4c-4758-aa42-b3bf8fc32c72	utilizzare le analisi per scopi commerciali
abba9e67-77b8-4f94-8004-ec6e5f8c195d	psicologia cognitiva
abaa67a2-91f8-4d70-8543-d102fd5e5b20	reagire a situazioni di emergenza in miniera
abc10e6f-e908-4c0d-bee1-77fbb8fc3cde	analizzare le richieste di informazioni di utenti della biblioteca
abe64465-9326-4c00-a847-5ee62c3e484e	tenere l’inventario delle parti
abe2d8c8-d2c4-4dd5-b748-0f7bca178671	verificare la precisione dell’incisione
abdde15c-2d2e-4e34-968c-2e7f5148ac2d	supervisionare le operazioni di assemblaggio
abe68ea1-df38-4c31-8513-1a9126e987d5	elaborazione del linguaggio naturale
abf1a4e1-754c-4d2b-89b8-7f397cc98883	biodiesel
abf40325-c607-40d8-ab50-3b844d7a1488	attenersi alle istruzioni del controllo del traffico aereo
abf8cf14-9c98-46b5-b9c6-826a319f1476	monitorare le misure di sicurezza
abfc6cc9-908f-4865-92de-79b65f51ba3a	ormeggiare le navi
ac095150-30d1-4e65-a688-cf9a702328ee	utilizzare un sistema di comunicazione di emergenza
abfdaa9d-df8c-495e-adeb-d029c4f20c46	condurre una ricerca scientifica
abfb2f19-a228-4a08-afb7-dd4e33893d73	smaltire rifiuti pericolosi
ac0b4278-9961-44cb-9a82-7609cd9c5e79	creare un modello virtuale del prodotto
ac1dcc34-5bab-48d3-8a6a-59425b6ef0bf	allestire le piattaforme di perforazione
ac1e5afa-fb1e-4900-be65-aabe956b1556	medicina intensiva
ac0e6cef-0d3a-49d3-87cc-d487536188fd	ispezionare il lavoro inciso
ac2b3a74-45f3-41f5-a31d-ef356eea50d9	organizzare uno spettacolo creativo
ac2bd197-8994-4044-a01e-5577d5c12304	burattatura a umido
ac1d29ed-3aef-4d5f-ba4a-fa6781694a25	sviluppare i materiali didattici sull’arteterapia
ac13c03b-cfb6-424b-9db0-6440f33ebc8c	calibrare strumenti ottici
ac21e044-f8e4-4a8b-9d00-e12c4787f570	calibrare strumenti di precisione
ac302c83-aa42-4ba9-b744-b8e5e98bc5ed	supervisionare le procedure di una vertenza giudiziaria
ac32bb81-7568-4586-9d71-82b73d62cf03	indurire il sapone
ac3c9136-06db-42e1-a68f-9775f9af886a	manufatti ceramici
ac42c927-22f8-4331-be9c-ebde7b44d343	individuare i processi di reingegnerizzazione
ac46ee88-5d77-4878-ada2-47f88269c0c4	segnare le informazioni delle planimetrie sul palcoscenico
ac4aa152-b591-479b-9bf8-38afc7953287	minacce alla sicurezza delle applicazioni web
ac54a33d-f8bc-4fd7-8354-a2b598833ac7	tecniche per l’individuazione dei requisiti aziendali
ac495de2-4bcf-4c78-ab88-5754c2c2e336	effettuare la manutenzione delle attrezzature di gioco
ac5fb41b-a0d1-42ad-82c1-015cc4492d3e	gestire la situazione finanziaria del negozio
ac6349a3-a07d-4e70-9e06-e031f255707a	utilizzare le attrezzature di sicurezza in edilizia
ac65f58e-11ce-4917-952f-d99445ac8bae	processi di produzione della carta
ac6a8316-c290-4192-984f-743d022c4274	primo intervento
ac6a38b6-c445-417e-8558-321faa451883	merci trasportate dai magazzini
ac796b4b-4500-4c45-912b-d1037f0e80e9	applicare il fertilizzante
ac6c6ae1-efcb-4671-a934-d61a4147d903	supervisionare la manutenzione di impianti sportivi
ac6d7748-9527-490c-b4a5-bafd6b701ec5	misurare la qualità della chiamata
ac7be174-90aa-4a66-9581-025c4b718f2d	ergonomia
ac8e1db0-4d63-4d26-84a6-7993805bf057	applicare i metodi di valutazione della musicoterapia
ac9e732b-2c8a-478a-833f-5591d93ab88a	optomeccanica in cavità
ac7669c6-2bba-4378-8de9-286c4d390c86	usare strumenti di misurazione del suono
aca15238-b219-44d9-a02f-6b2a64476a56	utilizzare le tecniche terapeutiche di comunicazione
acae8f39-f2f3-488f-8cbd-ecfc0d5e19e7	utilizzare una macchina per la rimozione della farinetta di frumento
aca1df13-f9cb-4673-be53-6c455d5dfe4c	individuare la musica con potenziale commerciale
acb19aa7-1209-4fde-9101-844e88fdc824	preparare il letto di posa per il vetro
ac918144-9c58-4701-91e7-2d16e13bb4fb	gestire un progetto di ingegneria
acaa0f20-2bad-463e-831c-4f45ab2ae6f8	gestire la pianificazione dell’aviazione
acc164ef-d3ff-48f2-8db1-29efd13cb96b	valutare l’erogazione del trattamento radioterapico
acc2fe4d-2395-4f3a-bc3f-04b9de34c84b	determinare le sfumature di colore
acc76c2c-9ff1-4ade-8d6d-fa896620cf8c	scrivere in albanese
acd3c307-4951-43ac-b736-37bdce0f2e90	azionare le attrezzature di movimentazione delle ceneri
acd231ce-af4e-4a27-8db8-99c99eb00293	eseguire le procedure di laboratorio per la fertilità
acd8346a-f67a-458b-b566-a2cb56407b0a	integrare le scoperte scientifiche nella pratica della musicoterapia
accf5ae6-78b6-470e-b722-6a4283610a7a	condurre prove sul prodotto
acda27c2-786d-4e4a-9f57-56d96afc933b	eseguire i lavori di manutenzione sui binari
acdacd62-794a-4238-80f1-b59fbc719d80	collegare le teste dei pozzi petroliferi
acde6006-3c75-4c47-9783-b6988b4b60c1	fisica nucleare
ace24ea2-5f9c-4f47-b005-57e18e64e649	dare seguito ai risultati di laboratorio
ace28951-04ae-4356-8235-24b534838f21	preparare gli ortaggi da usare in un piatto
acde5143-5c54-4de1-b40f-7ceb3842917c	scrivere entro una scadenza
acee5dff-1803-409f-8c97-522ad81db1f6	pianificare le quotidiane operazioni navali
ace6c00a-b2ea-427a-819d-d7dcebac237a	segnalare un comportamento pericoloso
aceed96e-a1e5-42fc-812a-37906bea766a	metalli preziosi
ace799ac-08ec-46a6-b0d8-b06e36196b35	comunicare con gli operatori addetti alla raccolta dei rifiuti
acf332d7-2a4c-4e3b-b3f1-c9dba89a65e4	assemblare fasci di cavi
ad09e63f-6b35-4cd6-aee8-1fe779d86aba	disposizioni di sicurezza aeroportuale
ad0ec6d7-1fe8-4fcd-9f7a-0fde83af5ca2	ispezionare il personale
ad0287f0-ee88-4f3c-b139-bf24a8c16125	scrivere in ebraico
ad19910e-1fb7-4c05-80d9-4bee87af3b37	neuropsichiatria
ad177aa5-2579-48ad-9295-babd9f5c1201	applicare le politiche finanziarie
ad230c02-7e29-4410-948a-05552d41d9ec	regolare le attrezzature meccanizzate
ad254eb2-1ef0-459d-81a1-25a0bbaa15c8	garantire la manutenzione dei treni
ad26224b-501e-43ec-9983-54dff4c8a103	utilizzare gli impianti di trattamento delle acque reflue sulle navi
ad28b58e-534e-4b07-8102-b40551d9ed2f	azionare una caldaia
ad2bb469-d89a-4dea-a515-f4d103f2e0ed	tecnologie dei tessuti
ad351971-faed-49f9-bacc-baf793a139e3	seguire lo stile del quotidiano
ad37346b-366d-4126-a27f-fe981caee720	supervisionare gli impianti di acquacoltura
ad3c5997-6adb-4a94-8ed9-5b97eb797460	relazionarsi con le lobby contrarie alle attività estrattive
ad3c01ba-f299-4973-aa9e-0b9410c03079	gestire lo sviluppo professionale nello sport
ad50bdaf-3716-4099-9f32-5d2393fe852b	utilizzare la telecamera sonda per tubazioni
ab8c1efe-80e2-49ea-9668-1658051ce7ce	mirare a costruzioni architettoniche armoniche
ad537f2a-a1ca-49a9-b9cb-b64eb89edf71	individuare destinazioni turistiche
ad53ca56-2d4e-4248-9928-3c4101611a4b	produrre ingredienti
ad558776-6d44-4f00-ac04-0b6e11650d44	micromeccanica
ad571dbf-3932-413b-9615-857ffc0bbddd	controllare i pazienti durante un intervento chirurgico
ad587a75-19c3-43a1-9a48-57cf0b167d17	fornire assistenza agli eventi di presentazione del libro
ad603cbb-1131-447f-9fee-7d0e183c256e	condividere mediante le tecnologie digitali
ad60db23-d39f-4d97-8bc6-cc9d6c5c2afc	merci nel trasporto marittimo
ad6eed8e-41b4-4d0b-8663-7d3c541e6ff8	insegnare nell’università
ad443b01-dd8d-45fc-82a6-41e3796cd9a0	ridurre l’impatto ambientale della produzione calzaturiera
ad67b8ba-bf46-4c76-ac55-8a528a975a4d	seguire il codice deontologico del settore turistico
ad6934bd-c923-4941-964b-db8885733e20	pulire le aree di lavoro delle terme
ad7178c4-cabc-4512-86ff-4c087867444c	attuare i piani d’azione sulla biodiversità
ad725637-9c97-4ce7-9604-72ffbe95aeda	realizzare immagini radiografiche
ad7ada9b-96a9-4800-953c-24547bccdbae	prestare servizi postvendita
ad7d1303-d449-4256-987f-56ce39c5f34f	sviluppare il progetto del negozio
ad780bb1-8301-461a-9bb9-71715113916f	preventivare le esigenze finanziarie
ad7c2f6b-afbe-4a4f-9d8c-7f36bbd8746e	utilizzare una macchina collazionatrice
ad807e7d-eb9b-4de7-bfe6-4d8e06879985	analizzare sistemi TIC
ad8405b4-12d8-4d3a-bbf2-6ddf449a8a2a	eseguire operazioni di finitura sui giocattoli
ad8c3ee4-12ee-4047-9ead-5f4fcaad20bf	sigillare i giunti di espansione
adaaa826-abd9-4723-9745-dfa0f55713c1	motivare gli altri
adb0abe5-5b16-49ce-b443-41f6754beb06	riparare le biciclette elettriche
adb37b30-b260-4a6e-9921-3a6460264e42	materiali tipo vimini
adb16566-eb4d-4f42-85ac-a3a13b683c3e	gestire la documentazione per gli alimenti preparati per animali
adb63183-58df-4657-b8a5-8ce0292bf0d6	fissare la copertura di un tetto
adba7658-2046-4a5d-924a-4020f24f67b5	prestare attenzione ai dettagli
adbd5bbe-58d5-4d57-a9ba-4477fc7a695e	configurare una lavagna luminosa
adc00db9-a389-4577-bda0-9dabe43ba529	comprendere il gallese scritto
add364b7-e390-4e4a-83d2-5cb5d7522254	meccanica quantistica
adb441ba-54ac-4f4e-9daa-fd96d69e2bbd	fornire informazioni sui servizi offerti nell’immobile
add4be30-aa83-4b00-9175-17f53c705b87	fornire assistenza agli utilizzatori di strumenti elettrici
adcbc364-c1b8-4d8e-8ee9-e4a7a2fd4952	utilizzare gli strumenti per la rimozione della neve
adda37e8-08e7-4662-af61-22fc1179ae24	applicare la normativa silvicola
adacb744-b40c-414d-91e8-099c1eb38d26	Backbox (strumenti per il penetration test)
ade7a742-b17f-4b6f-9dc1-fd0def1add2e	controllo della qualità totale
aded611d-2fd2-44ad-a53e-8f93550a2c43	essere addetto a macchine fresatrici CNC
adda23de-ab8d-46b3-8777-bf291ec179d6	coordinare attività tecnologiche
adfdea53-bb68-424e-91c2-8c2144b8f4a1	strutturare una colonna sonora
adfb3678-7711-45d6-a391-b32c22d57a51	iridologia
ae11a525-b6b1-4c8d-be25-0899318ca40d	mantenere sufficienti materiali di scorta per le ambulanze
ae15d6e1-a7fd-4621-8b59-06e50f4a683b	pedagogia teatrale
ae193cbc-491f-46d8-9cb6-c8aef5275cd9	sviluppo rapido di applicazioni
ae180c5b-c9b7-46a8-97f4-d9b4b1283577	sviluppare modelli di previsione meteorologica
ae1b7953-4a1c-43c4-9ac3-06ad832ba523	comunicare i problemi ai colleghi più anziani
ae1c7204-10f6-4357-af34-ce3b57801240	valutare l’ergonomia del posto di lavoro
ae2b0e00-adf7-484f-9590-670e1350bf3a	definire le esigenze in termini di strutture di sostegno per gli spettacoli circensi
ae03c0d2-8a76-4606-a1bc-bdf6ff8b9ba3	eseguire i cambi di costume
ae211d29-dccb-47e1-b9c1-3c9bf5fca235	programmare i segnali di azione sonori
ae34f13a-aab1-4ce2-999b-5a19b6ec21e2	ingegneria aerospaziale
ae3a71a8-3c84-47db-a2d2-b941a1909a00	trasportare gli ausili per il lavoro di raccolta
ae36affe-b2f2-4912-a398-aa79ea1a3beb	gestire la negoziazione di titoli
ae3d0cc0-1a47-493d-bf50-9eee85ecc160	collaudare la forza frenante dei treni
ae46e57e-4376-43ef-9bd8-96794da80037	gestire l’ospitalità nel gioco d’azzardo
ae4e2664-d6f7-4872-b4a2-8f0a2b3ca3eb	tipi di assicurazione
ae525c11-2069-4772-a67a-72caaaca600d	eseguire i body piercing
ae424309-38e6-47f4-92dd-c547e09bdda5	calcolare il tasso di premio
ae482300-67d3-43e1-90fd-23cdf5f33dac	fornire assistenza a domicilio alle persone disabili
ae57ddb6-b0b8-4101-a954-e1dd6c90b302	gestire la produzione e la distribuzione dei materiali turistici promozionali
ae59e4fc-55d7-4070-9223-8b6e172b0b4b	implicazioni dell’inquinamento urbano
ae73e234-de2c-4ab2-8085-1740168042e6	virologia
ae62d768-4332-4c92-8d26-e9c908a56ffc	rimuovere i negativi della pellicola dalla macchina per la lavorazione
ae76872f-9f45-42b5-87dc-9313f7c2e434	mantenere l’inventario degli articoli noleggiati
ae679b28-4192-459f-a873-543b244770d0	analizzare i prestiti
ae841070-e8c3-4607-8f0d-7b33c55b11ce	applicare processi diversi di disidratazione di prodotti ortofrutticoli
ae841cfc-d34c-45c0-bd99-720e189b633d	sciacquare la pellicola fotografica
ae8433da-919b-48d1-bff5-0b52a47940d7	prestare assistenza nella fase di decollo e atterraggio
ae841e87-00d8-4e49-baa1-de5fd6efbf10	indagare sulla stabilità del suolo
ae870155-3bd5-4dff-9612-fdf40aac062a	collaudare i circuiti
ae920aa5-fea6-4f77-917d-4a0e415d1ec0	recensioni di libri
aea4d00f-970e-427f-bc8d-1f6774e91308	usare librerie software
aeafc3c9-4eed-4470-b4e5-3799eff0fccd	tipi di macchine raddrizzatrici
aeaad21c-bb9f-4b13-b51b-b6dc329f50db	sociologia
ae8d25a8-f12e-46f6-b680-a858585d4549	misure per contrastare gli attacchi informatici
aeb5ba10-36b5-4c61-9fce-5795bb2e872f	monitorare l’ambiente del museo
aeb5dddb-cf27-4704-9550-67636632ce64	applicare l’agricoltura di precisione
aeb724c2-702b-42f0-b75a-009bca30e032	tendere le cinghie
aeb9f2b9-ac06-4a18-81e1-db5c194d8c46	lavorare con assistiti che stanno assumendo farmaci
aebdfede-58c8-4786-a260-11f08ce55aa6	trasferimento del rischio
aec8424d-f07b-4b9a-b371-1d50af114ea6	sorvegliare il compressore
aece4ed8-9587-4ef8-a847-6f99d793de7b	controllare le finanze di programmazione
aed1d140-3517-4041-9ffd-2f2c2ac4b7fa	supervisionare l’immagazzinamento del carico
aed2aae6-c58e-4823-8419-0dc2cb5cb251	far esplodere lavori di muratura
aec807bb-b3be-4f2e-9084-0c54270bc76d	definire la coreografia
aed3a901-02ae-4bef-a02c-8fdc03f1beae	pianificare il sistema di ormeggio della gabbia di acquacoltura
aee714b2-451a-4f93-b0b1-7c0d6c3d8185	sviluppare servizi di fisioterapia
aef6a3ea-70fe-4a9c-826e-e5b23a0c7ff5	sistemi di controllo ibridi
af08006a-96ed-46c7-b974-ad2a45d0874d	resine di plastica
aee992b9-acdc-4e51-816d-e29812c38145	misurare i materiali
aeff1f20-dba1-4dfe-89d6-6a5a07012343	attrezzare la macchina con strumenti adatti
af087b88-015d-4e8a-b5a3-9d6c3fa341ed	ispezionare l’aeromobile in modo esaustivo
af0c6733-e798-4084-aeac-5ffc63dfd663	disturbi psichiatrici
af0b949b-9006-43ad-8d4b-a4bfd9a77dea	fare disegni tecnici di capi moda
af0ce859-a558-4e6f-8759-3c9f66338712	proprietà fisico-chimiche delle pelli
af153c2a-2f30-4436-bd02-c159ce0321c0	problemi del piede
af11b839-b955-4eb6-a241-6f62cf7dd5bb	gestire l’esperienza dei clienti
af17a4fe-ab05-4cd7-98bd-6415815f984e	software astrologici
af0e91ee-177c-40de-9566-334ab8a9aa73	sviluppare procedure di collaudo dei materiali
af1b4750-3968-4bbd-acdb-1bb1e9350872	tecnologia stealth
af21c7f8-86d5-40a4-b10e-6df8a64c5da8	sostenere la positività dei fruitori dei servizi sociali
af24d61c-40eb-4091-ad2d-04ae646b5660	parti di macchina avvitatrice
af20d9ce-c970-40df-a252-f366d0d66f2a	applicare tecniche di pre-cucitura
af28471f-6f62-49c5-bde8-97f8e3f8b140	anatomia patologica
af2a41b9-c548-42a3-b8b6-b755f2ea905f	limitare l’accesso dei passeggeri a specifiche aree a bordo
af2bf577-7011-4af2-a24f-cfbd7532d4a2	praticare le attività sportive
af33b695-3164-4a04-96cd-a1fd33510cb4	gestire la rotazione delle scorte
af375025-3ff8-499b-adc5-2c0b7128f2e0	gestire le sedute abbronzanti presso il centro estetico
af39924d-3911-4d57-866a-8d973b82c959	effettuare prove di miscele alcoliche
af363446-8739-452a-83d4-28d8edc14763	monitorare i costi della piattaforma petrolifera
af3b89e7-0651-4ef2-89b7-6293519b7e39	monitorare l’area di immagazzinaggio
af429ee8-6e10-40ca-913e-3dfec5811bef	condurre un’asta
af4229c9-d3d2-40ef-b572-80bedb3445e9	uso di tecnologie digitali
af439d6c-2206-49e8-8e23-fae4efeb82ac	annunciare le attrazioni di un parco divertimenti
af6fc6ae-0ce9-46c5-806f-2a7b4010e06e	posare le solette
af54e481-7360-4222-b386-508b4f5bd737	sviluppare sistemi di risparmio energetico
af7da83c-4f8c-4b09-9d34-c3b703e5bddb	utilizzare una macchina frantumatrice
af7b3a01-e028-4b85-9f23-46b8883b3aed	immunologia
af80769f-8eec-4ff1-ac38-0c7af8e654be	essere addetto a macchine per l’estrusione a caldo
af811e03-6ba9-4d7a-92ba-2cb70bd24790	analizzare i processi che influenzano l’erogazione di assistenza sanitaria
af8ddee0-d3a0-4e2b-a6f1-9d9965662df8	restaurare opere d’arte usando metodi scientifici
af910dc3-b9dc-4afd-ae2d-b5f32bb3e6d5	Project Anarchy
af93d9fe-75fb-4956-b1b8-bfe8a6f04acd	eseguire l’aggancio del vagone
af8f8c9b-192b-40a4-839b-5c33f555e688	gestire le risorse per lo sviluppo aeroportuale
af91a225-86c2-4ec0-9188-9ff483797d34	gestire la documentazione relativa alle giacenze di magazzino
af801eed-231c-4552-8ce0-5fe881d1fdb4	selezionare il metallo d’apporto
af93ef88-7a63-4e5a-8ca8-fc32c9aaf1ac	eseguire la manutenzione delle apparecchiature elettroniche
af97da61-5a37-4abd-b852-27af01f03c57	tecniche di assicurazione
af99bc1b-f643-435f-a308-46096fe3641b	confrontare i cereali tostati rispetto a un campione standard
af98334b-eed8-41e4-9be2-4e0849aed792	programmare un controller CNC
afa12883-171a-4245-9f6a-2b3cac77e5d8	sistemi di birrificazione moderni
afa8c358-669c-46b7-bb8d-b8f676f24fda	evacuare le persone dalle aree alluvionate
afaae3f2-e416-48e8-807a-31e9ef89c94f	testare i modelli emotivi
afa3f199-3c98-4403-a49c-9fba741d20d5	analizzare le immagini al telescopio
afa4c0de-7f62-4834-961d-33dcc45c3f64	mixare il suono dal vivo
afc255c0-7861-4681-923c-e8aedc8eb2cc	definire le aree geografiche di vendita
afaf7fe0-ddcf-4112-b345-52842624095f	tecniche microscopiche
afc44aac-8778-49ae-b41a-f4e5a9a9f6fa	cromatografia a permeazione di gel
afc9db06-75ca-480d-9ef9-27127c25ecbb	mantenere il significato del discorso originale
afc85a16-7d25-4b86-9c6e-41487d607fa6	gestire il fondo per le piccole spese
afd14752-6d2e-4378-8292-70d8d10b42fd	utilizzare macchine per saldatura a onda
afaf340c-6cf1-4419-928d-04d4ecab0cd3	comunicare con i clienti
afe9f5a1-8ba2-4da8-b647-48f544f7f198	gestire impianti di rilevamento di contaminazioni da metalli
afdfa4a3-1135-4c5d-a4b4-049b85c6cabb	garantire la fruibilità delle attrezzature di protezione
afe66a11-2139-4e92-9bb3-9980fb9d06ee	condurre ricerche di mercato nel settore delle calzature
afecb683-3e7d-41e5-b24b-c49d38da8683	attrezzature audiovisive
afee7b29-48f6-4974-b9ad-b0e97edd06f1	acquistare i cavalli purosangue
afef1555-0a79-43c3-8476-c4ee6ebd75c1	fare da mentore ai giovani
afedb0b2-4a03-4eba-8ddf-84802bd48382	creare diagrammi di database
afeebe09-d6b9-4bfd-b6bf-0d26a47cb39f	gestire il calendario delle attività
aff9ea1d-8363-4fe1-b495-65a147ef9abf	levigare i bordi del vetro
aff39fbc-2b2b-42b6-9ebe-f5a92a785a0d	sostenere i fruitori dei servizi sociali nella gestione delle abilità
affed3ce-a5cb-4b4c-9dd0-17e2766b7822	definire gli incontri
b00c5232-9226-49cb-b3a5-fc5fb4ec9ef1	registrare reperti archeologici
b0102049-0d0c-41f3-b70b-897b3b9d5893	usare sismometri
b0124cad-1443-43fc-85fb-1b8e678d92b9	interagire verbalmente in telugu
b011e405-14a9-4aaa-add6-f05975f81f60	gestire la realizzazione dei costumi
b02e7a00-0833-4f1e-9180-5bebe84ce018	presentare una causa
aff963dc-829d-45e9-bc33-dcc74efb89b2	analizzare i dati sperimentali di laboratorio
b02e09c1-c7ee-4553-94fc-97060c90fefb	tradurre i concetti dei requisiti in contenuti
b022f7cd-1a82-4947-b01e-4859beb3fbb6	fornire consulenza in materia di conservazione dei cibi
b045d9d3-de89-43c6-b600-68a0716d5bd3	utilizzare strumenti di coibentazione
b0379ebf-1cd3-413b-ba54-c4beac749d3b	effettuare l’attività di auditing nell’aviazione
b040adff-0648-4016-aa5c-ff834beaa84b	prendere decisioni aziendali strategiche
b045caab-81f1-482a-8811-9e6d9ffac418	selezionare le gemme per i gioielli
b04819e7-76b6-4868-a165-9ebba987c234	assaggiare le fave di cacao
b04ccf45-a9c3-4c81-ad03-404677a8d1a1	spostare gli animali
b055ccb1-098f-4fc4-bf57-1d05c9dd2d70	elaborare promozioni speciali
b0482ea5-065c-4fa7-b225-b68767be0003	interagire con gli assistiti
b048f7f9-e186-49a4-ad02-3ec116fc9b07	seguire dettagliatamente i processi di fusione
b05aaab8-3b70-47a7-945e-b484d1ac6ff3	comprendere il greco scritto
b067382b-b8df-49ed-ab74-75b75fed99f3	valutare i fattori di rischio
b0681bb3-356c-4df7-a4d6-0048d0c82738	promuovere lo sport nelle scuole
b06aac16-1d94-4cb3-a2e8-65893a2af828	documentare la produzione artistica
b06ae9b0-3ee1-429d-875d-e9f27ec5b0a4	misure preventive contro i parassiti
b078385c-71c4-423a-bca8-84af4060d826	conservare il raccolto
b0a14e24-8089-40b5-984b-7f1a7b43cd92	procedure di pulizia auto
b0778d90-b09d-4f2d-8ed7-c7c663d708b9	lavorare in modo sicuro con materiali a temperature elevate
b05c3bfd-4e08-47c4-adf4-50ebc225df25	identificare i rischi per la sicurezza TIC
b099e733-e524-4047-99be-dd79633cd059	gestire le lamentele dei clienti
b09c0a0e-4d53-48a1-8a26-116913b3b3b3	ordinare le forniture ottiche
b0a541a5-f6c6-45d4-8ffc-14374aab72b1	organizzare le attività del campo
b0aaade6-eb1b-4e3d-aac3-cc8a804f4c9c	effettuare il controllo d’inventario con precisione
b0a5f864-bc15-4a22-a380-751a2da6feba	insegnare la danza
b0b83325-5d86-4c7c-8cc5-d3f940f70851	prevenire i focolai di malattie trasmissibili nella comunità
b0ca8fa3-a84b-4e70-87e7-e62a36dd8172	selezionare la frutta e la verdura
b0b8fe78-96b3-464e-84d1-722c7f235d44	metodi di addestramento del cane guida
b0bad923-763b-414b-b31e-b43f3838dcf7	gestire i coltelli per le operazioni di trasformazione della carne
b0e04054-24e0-4823-90e2-2ed77a6ea8a9	promuovere i programmi di esercizio fisico
b0d30736-f960-4ec0-bf92-1961e6d86290	riparare i macchinari di lavorazione della plastica
b0edeac2-606a-4424-a64f-c8388954ba35	vendere biglietti
b0f8bc2c-cc20-4c28-8ee9-3724282d781b	insegnare i principi del primo soccorso
b0fa3ff7-881d-4bbb-b468-c89ad0a226b4	prevedere le vendite su diversi periodi di tempo
b0feef9f-ff0b-499c-98dd-ad6350ef6f08	monitorare le operazioni nell’industria della pelletteria
b10a9cc9-3bc0-4c51-a55c-1846d04bcd29	esaminare la merce
b10cab5e-0f72-4906-b4d0-3a7169b9b583	verificare la presenza di connessioni non autorizzate
af95cdbd-9936-4af3-a8cf-726a34a1359f	ispezionare le attrezzature per il lavoro in quota
b108e590-2f7b-4a37-b7d1-ac4d96603847	valutare la qualità delle fave di cacao
b1186fc2-87f0-4a94-abc4-f89d428fe8b5	verificare il suono
b118d6b9-df75-4969-99f6-3e18e1b07d27	coordinare la collaborazione tra i settori pubblico e privato nel turismo
b118c32d-2041-4006-b280-c5d28f2d3c47	individuare le parti richieste dai clienti
b11c825e-2e20-45e5-a97a-f3b3091f39d5	diagnosticare l’assistenza infermieristica avanzata
b11d45ad-7844-4cfe-ad3f-6da55142cebe	insegnare i principi del turismo
b12f3314-860d-4911-aeed-873eeb43de51	sviluppare i piani di gestione per ridurre i rischi nel settore dell’acquacoltura
b118fff1-ef6a-49df-a175-af6c3f34093a	gestire la biosicurezza veterinaria
b1436e02-9a33-4884-8823-608bf46eb554	gestire i blancher
b1353ef2-cc78-4da1-b98d-d0d02eaad624	creare un pezzo da eseguire
b14e4881-ff54-4c49-ac78-7f30f4a63588	pubblicità esterna
b150d40e-467e-4555-a2d6-c3022d5c3eea	seguire le procedure di lavoro
b1533850-4216-4b8e-97af-34137a1afced	biologia della pesca
b14a2a26-5a2d-4667-9531-0b8b3f3ebf6a	pulire le strutture e le attrazioni del parco divertimenti
b15712b8-f354-4dd5-bada-eb21f5767328	gestione della pesca
b1661443-ddc1-4275-b075-f6dd51bb26ce	effettuare la manutenzione dei locali adibiti alla produzione
b1649dbd-bea1-41f3-a7e7-760425f8a756	comportamento del cane
b1656210-9edf-4bf0-975e-51a378d78f67	produzione di abbigliamento per bambini
b1668c90-10af-4f82-ba36-0aacaaa2d60d	coinvolgere il personale artistico
b16a3eb9-d264-43c1-b120-61eea17c9669	installare la gru
b16b1d91-ba83-4795-b97f-9c25cba70227	eseguire la fermentazione per impilatura delle foglie di tabacco
b16e4a8e-59b2-4bb9-977f-ffba02f46e3d	tipi di contenitori
b170c731-273f-448c-b403-cae5071e5004	rete stradale nazionale
b180a861-9d23-4911-b1a4-072a352014fd	far funzionare i macchinari navali
b16f9b87-fdff-4ea5-88e1-5708cb81ee0e	fornire consulenza sulla pianificazione fiscale
b180d926-0c79-40eb-b1f5-02c46ffec345	effettuare la manutenzione delle armi di scena
b18d0584-5fbc-4dcb-a402-1ca54bd51491	fornire consulenza legale
b19a1e52-e7ea-48c5-8a81-88c0cfaa2718	organizzare gli spazi del laboratorio
b19b1d34-7ec3-458c-a3e0-b4ea54cce72e	eseguire l’audit degli appaltatori
b19dce1f-3811-48f3-85f9-ca05a80e12a9	pensare in modo proattivo
b1aa40ef-771e-4d50-bc12-0d434ac43b19	costruire le anime
b1a84cad-12fe-4ca6-8529-0cdee1a0fa69	condurre esperimenti su animali
b1a88811-f61f-4d65-8941-a66f48c6a259	sintonizzare il suono sul palco
b1b14d75-7815-4df4-9de8-7a5cfa9828e7	prevedere le tendenze dei dividendi
b1a66cb3-a10c-4250-9507-aeb2e723e613	riparare le linee elettriche aeree
b1bf3fdf-f2d6-4433-954b-c49355a9fb48	gestire una carriera sportiva
b1d6ccc5-6f48-45ab-829c-d14a6778b7a5	fornire i servizi di riabilitazione per i casi di ictus
b1cc213a-3961-4592-9da1-b7896e154ee1	gestire le situazioni di stress
b1b3eed4-7f57-44a0-8de5-6510f675dbd1	collaudare hardware informatico
b1e0aaa9-665e-49a0-b2c6-2548d8744283	aggiornare il libretto di navigazione
b1ece362-a344-4b26-8858-0d45ec806e27	interagire verbalmente in ebraico
b1e74177-b988-4efd-a668-4201a71a7967	tarare l’inceneritore di rifiuti
b1ee2773-7485-47fe-ad5f-5fe5960d1983	scrivere in arabo
b1f216bf-a1d2-43b0-b2be-c14471d21b8d	selezionare i metodi di abbattimento degli alberi
b1f411ae-c7f2-4997-98e7-74c8c3f19dcb	rinviare i fruitori dei servizi sociali
b1f983af-c15f-4cc3-b5a9-ac416dd5efda	monitorare le attrezzature
b1fa7740-d1bb-4c76-88a3-94f29ab2ec23	tecniche di movimento
b1fc020f-689d-419b-af10-158131729a52	analizzare i tassi di disoccupazione
b204dbbc-d6c9-423e-bfa7-41c63850bd5d	applicare le tecniche di brunitura
b2077e25-3384-4e69-ade1-14c8ee1d233b	verificare la sicurezza della distillazione
b20b8e7d-76f9-47ce-8bcd-0ad8ce14b653	creare la formula di fragranze
b207aa89-1d4c-43b6-a4d5-97bfc81697b4	fornire consulenza sulle procedure di gestione dei rifiuti
b20e1aca-e0fa-4c6b-9b27-6a1a14b6ad07	utilizzare torce per saldatura ossiacetilenica
b2177d87-8875-4f9f-964d-c0d05d0601ba	albanese
b21809fa-2a18-448e-95d7-334828128310	strumenti di tappezzeria
b208fe0b-3811-4cea-9e7a-73d9a2cadf87	coordinare le comunicazioni in caso di emergenza durante le attività minerarie
b21c00b0-4047-410e-ab3e-f207d7c47228	elaborare budget
b21df3fa-dd27-494b-9a8f-bf9eda90d94e	gestire le questioni etiche nel contesto dei servizi sociali
b2216a2d-c012-4c8d-a706-e8421363eb1c	forza centrifuga
b221a64e-f4c2-4eca-a34f-52ab6cf3bc58	controllare orologi
b22c72c8-b4b8-4443-9bee-8bc7242980cc	costruzione di navi per navigazione interna
b23f800b-0740-4cb9-8196-79654e98d3f0	installare le serrature
b23c783d-2504-4540-92f4-bf73f72a10ef	redigere un contratto immobiliare
b23d9603-f283-4428-b041-4a798332c015	prevenire gli incidenti domestici
b2463056-9ccb-4792-afdc-a0d5ccd28997	bilanciare i requisiti di progetto rispetto alle preoccupazioni in materia di salute e sicurezza
b24c44a7-4d20-4f9b-87e9-6d09282241e6	adattare lo stile di vita per praticare uno sport ai massimi livelli
b24d1736-74bb-4532-a2c5-24d093566262	ideare marionette
b2509cae-da61-488f-9201-95e00588f378	tecnologie chimiche nelle fabbricazioni metalliche
b26a7e15-784c-4130-9d8a-7c5401ce7e65	utilizzare macchinari di stampa
b2590434-b525-4c56-b5eb-dd8059e194ac	effettuare la manutenzione delle attrezzature audiovisive
b26f39b8-37ce-4f31-8fd6-46dc4a3bf299	coltivare le piante
b275f3e7-6c1b-4835-987d-150a995c92aa	montare le foto
b27b76ff-9f19-43d5-a483-7584b7e35622	sensori
b2852575-ae5e-44fe-8d4f-f23480ce446e	utilizzare il trapano a colonna
b28fc5af-49ed-4e3d-b58b-d2407b69034b	gestire i progetti di architettura del paesaggio
b28a0dc1-eb68-4559-aaf1-dd3e9b095f6a	installare dispositivi di comunicazione elettronica sui treni
b2848ab3-e3d6-410b-9dfd-4a3bf3af1776	condurre una ricerca sui costumi
b0abb922-2b0c-49a4-9488-a669268cd06e	definire la strategia di integrazione del sistema
b2970432-ad4f-4a8f-a418-4f235566c6cc	valutare le esigenze di conservazione
b29b9be7-00d4-4f04-a4cc-c38f20f23a73	facilitare l’accesso alle informazioni
b2a25e75-2400-4dfe-9ce9-da95f831039c	gestire la cassa del gioco
b2a3b6fc-9328-4b8c-b898-8dd8c1e1f103	diagnosticare cardiopatie
b2a2eeff-a20a-4528-9d8b-f6ccfb50fe08	organizzare eventi culturali festival ed esibizioni
b2a4c5fa-3eea-47b6-b9f7-ba7d83e9dd5d	essere addetto a presse di punzonatura
b2b31e72-ecdc-41c7-9403-969eca366393	autonomia del paziente
b2b3b12d-1674-4fca-b856-4884e2182866	comprendere l’ucraino parlato
b2bdf345-047c-4a4b-8a02-8051b7536761	bihari
b2c87705-a440-44f9-aae9-6c1faa7ebf63	donazione di sangue
b2cec263-ce68-4280-bf58-ddb6a80c862d	gestire gli ambienti clinici
b26a2292-c069-4958-ac2a-7c4bbb301be7	analizzare i dati ambientali
b2cfd305-53f8-42bd-87f9-734a6ac0359d	impartire gli ordini di battaglia
b2d2e745-6cef-4465-bf74-5e5530f2d757	installare i controsoffitti sospesi
b2d0bc9c-55f9-4788-9957-e1f917e63409	analisi dei rischi e controllo delle criticità
b2f964fe-888f-4eb0-98b9-64b8d1182692	biotecnologia nel settore dell’acquacoltura
b302e60d-cb05-4936-8e70-ac4be8460731	monitorare le macchine cippatrici
b3055a44-23b7-4613-871b-05fb6f33f80d	insegnare principi del parlare in pubblico
b30cfc71-cb9c-40da-ac47-c0676d1e2f79	impatto delle politiche sull’offerta di attività sportive
b30ebd17-b2c9-49b4-a714-cd1c41131f9c	contribuire al processo di riflessione del coreografo
b2ff1fa7-a425-4383-8406-e51018435f6c	redigere articoli scientifici
b305da9a-3210-4329-b2f4-6f37645cd781	ispezionare la qualità della vernice
b30f5293-c91c-4033-8c82-bdff1941ac96	riconoscere la presenza della carie del legno
b306adec-625d-4571-9e8f-b748db192982	interpretare le registrazioni grafiche della macchina per il rilevamento dei difetti ferroviari
b319e859-87c2-45f1-b8e0-3442004b35b5	applicare le abilità tecniche appropriate per praticare uno sport ai massimi livelli
b3111e79-568d-499e-9498-c31e4fba5e60	verificare le specifiche formali TIC
b3207cde-70bc-4bed-b455-432d0b2eceac	sviluppare i piani di trattamento osteopatico
b329f1fb-1f56-4c30-ba4e-274be15e40be	versare il metallo fuso negli stampi
b3295ddc-65d5-40ad-8707-5f3e524003be	offrire consulenza ai clienti sulle restrizioni alle importazioni
b3335bf8-35d4-4fd8-92a7-da34e98a7f30	pulire gli attrezzi utilizzati per verniciare
b33bc847-aaad-4b9a-87c6-d2e0e3e9ce49	tecniche per la realizzazione delle coperture dei tetti
b334fcd1-4922-4ad1-ab5f-85b92a095fa1	utilizzare apparecchiature di sollevamento
b3522002-88da-448f-8dd8-7fcd49cd0f1d	effettuare la manutenzione dei sistemi di sprinkler
b3508420-70ec-449d-bf50-6f91cdefb759	standard dei pellet
b34af6f3-3d54-494c-84f5-9a544f4f202b	gestire la programmazione degli spettacoli in vari siti
b34c6019-66f8-41ef-8a83-89025c593eda	Jenkins (strumenti per la gestione della configurazione software)
b3386d8a-56ba-4ac9-a630-f4b1411e8e22	Ruby (programmazione informatica)
b3526978-c8fd-4624-b9dd-59973fcf697a	coordinare la flotta di trasporto
b355c567-a50d-4867-a48f-ea2a4fc0f164	interagire verbalmente in giavanese
b359aa7e-9048-4725-bbae-f1ad3037dc9f	usare software di grafica 3D
b36468f8-2d4c-40df-846d-8c9c2d707eb8	disporre i fogli della stampante
b3670ee1-dc40-4379-a92e-0df41ce0a2e3	coordinare le missioni di salvataggio
b3692747-837d-4c6a-bdbc-6ad412c1fce9	applicare la colla per carta da parati
b359c1d5-a4b6-4f67-a643-86f0330c5efe	SQL
b36420d2-0876-4c23-9718-b400bcac1b20	ricercare nuove idee
b36a9cba-f0dc-4f8e-81b9-2e53b71b2740	comunicare i risultati delle prove agli altri reparti
b36bf417-d041-4424-92bf-ebe81582b02d	processi e tecniche di assemblaggio per la fabbricazione di calzature a lavorazione Goodyear
b36e6419-59fb-47a6-aab6-afc36663efe0	assegnare i numeri agli effetti personali dei clienti
b36f7a66-d24e-420e-a090-e73905ca96fb	analizzare in laboratorio i campioni prelevati da animali
b3726d08-b5f4-4daf-a2b3-6623aeaa28c0	gestire l’uso di additivi nella produzione alimentare
b377e860-dd2b-4bb7-8867-3ca8c4e012bd	caricare materiali pesanti su pallet
b37fe52f-d5c6-4883-89ed-9829f760c6d2	condurre ricerche geotermiche
b37ee98f-5a66-4b53-ba86-9130db098311	ispezionare le macchine
b3aecc4d-f3bf-4b40-b4de-bae1c6df025e	garantire il controllo delle porzioni
b396c52c-30a2-4d97-925a-ab8f69a61c38	creare script per la produzione artistica
b38dbf92-1111-4389-b2d0-c5a66dbd60a6	integrare le linee guida del comitato per la sicurezza marittima nelle ispezioni
b3a65b45-b22b-48f4-9a73-5f9001b33217	ispezionare i tetti per individuare l’eventuale fonte di contaminazione dell’acqua piovana
b3b12ac9-ea25-4db5-a07c-3eaa1fcdb55e	trattamenti enzimatici
b3b31fee-95ec-4f3c-a6b8-d246571b1992	utilizzare strumenti di localizzazione
b3b72c36-011c-406c-a0a5-8abd88f9ccc5	supervisionare le operazioni contabili
b3b88507-d0a5-4016-9eab-0e5d93001805	analizzare la qualità delle prestazioni relative alle chiamate
b3bd5813-d0a6-4107-bb0b-7db5b5594215	fornire assistenza sanitaria chiropratica pediatrica
b3bbbf6a-d67e-4332-95b7-3d34cb23a433	applicare il pensiero strategico
b3af1a23-1c4a-4f25-b67e-1d832a005449	standard di qualità
b3bef320-5257-42e0-b60d-4feee56bcb72	garantire il rispetto degli orari di volo
b3bf2908-b083-45d7-b444-f5e3d2e46600	intervenire per ridurre lo stato nutrizionale subottimale delle persone
b3cab46d-609b-4983-ba5e-3fb447e8d320	scommesse
b3db66ce-b605-42de-a677-6521826d0754	indagare sugli incidenti aerei
b3d2f625-ddca-4c77-bfc5-9caf814d500e	gestire i tempi nelle operazioni di trasformazione alimentare
b3d58318-706c-4cc3-a3a3-a06afe174786	Cuocere al forno prodotti di pasticceria e confetteria
b3df95dc-8560-49f8-8f7d-11caff4856d3	gestire la logistica
b3ee1235-bb90-40fd-881f-14c7d084202b	coordinare le pattuglie
b3f11453-fdca-4466-8446-97e59d995fb6	dipingere il set
b3f1205d-d071-4ab3-b0be-7b1f40b6a6b5	strumenti di sviluppo di database
b3f5e4ff-701d-4984-9aa0-e2211581243f	software CADD
b3f97e0c-d809-466b-9c6b-8e2faf4c5b5f	effettuare la manutenzione dell’attrezzatura per le immersioni
b3fc063f-5931-4474-90df-49a1158c706b	sostenere le procedure di formazione nel settore della pesca
b4039690-e272-4a36-bef8-f6151d8266e9	progettare sistemi di trasporto
b3ff6e03-de7a-4970-8587-bf405bb91261	preparare il bagno di resina
b403c0a2-b5bc-4b07-8fef-ade0c7bf2381	fornire i servizi di accompagnamento
b40a224e-c9c2-4cc3-bc72-2690719b82d1	produrre articoli di pasticceria
b4109134-988a-40db-96c3-1dd253cd8aea	utilizzare i dizionari
b40e176c-ca4a-4093-bf9f-15ebc11bab9f	monitorare le certificazioni di aeronavigabilità
b40bb144-e62b-44bf-b420-9907ce0a9e1b	seguire le norme di sicurezza nelle operazioni di pesca
b4191e46-9cfc-430e-bb64-d00e32a89823	gestire le operazioni portuali
b41ba40d-21c9-461e-891f-676f1350493f	scienze biomediche
b428cb6c-d0c0-4bfb-b349-5f7a902636c6	regolare la consistenza delle soluzioni chimiche
b41d70d8-40a4-4ecc-9b5c-b93dd36bff25	utilizzare le attrezzature per l’analisi chimica
b42c9e34-25d8-467b-b2bd-26bbebdd7551	testare i modelli comportamentali
b433cf45-392c-4656-84a8-b4f392019f2d	gestione del salone
b434e23c-2fcd-439f-ae34-2d5564a9eaff	dimostrare imparzialità
b43125bf-5943-43a6-8b41-1676e093343f	gestire le operazioni di manutenzione
b441f900-6c07-4012-9902-7fb52000c175	applicare tecniche di ingegneria inversa
b4443d18-0fde-43f4-9dca-82f2f056b879	differenziare la sfumatura di colore
b445fe6b-0ae0-4849-a539-bae8ef1d5f14	effettuare il monitoraggio del feto prima del parto
b4384654-ebc6-4aa5-8319-8d464d7cb44e	pulire mobili
b44df59a-8908-48a8-a244-a9bc5c9add37	comprendere l’olandese parlato
b451a677-d60c-4da3-9873-93bc28257d8c	leggi sui minerali
b454ff8d-4fa8-4fcb-8da4-1253ebdf1593	eseguire manovre di volo
b4600b12-0279-40fa-b9ae-8d8ae450d784	effettuare la manutenzione delle vasche di acquacoltura
b45c2452-9010-4471-8130-41fbe5b0ed9a	analizzare i testi teatrali
b46b1b43-a6a7-4ab8-895f-47abea56730d	monitorare lo spostamento di merci
b464d001-b263-452d-b7b1-afac64954123	gestire i contratti
b478033e-6c77-4b3b-a21f-b42c98710da0	tecniche di valutazione aziendale
b4679c0f-a489-4aff-896b-50ca8e63fe63	applicare norme di buona fabbricazione (GMP)
b47938aa-93a0-4c5e-be40-64935ddc7756	tecniche di taglio dei capelli
b485bc2b-9ab9-4df0-8520-1332bb1aba83	risarcimento legale per le vittime di reati
b4871840-1923-4ace-9baa-b48c30e958d6	costruire giardini verticali
b489cb40-18e6-426e-ab8c-ed315b433c15	acconciature
b48b316a-b379-43b0-a24a-41f79184432f	mantenere i contatti con i revisori contabili
b4a978d3-b032-4989-b6db-a9a86f1aa34e	adeguare l’impegno allo sviluppo dell’impresa
b4a5327c-3fe8-4c74-a378-33c335ccff13	fare uno screening dei clienti prima di consentire la partecipazione alle attività di fitness
b4bc8168-4fe5-4983-8484-22f287db0e69	manutenere i macchinari per la bordatura
b4bd93ea-65c2-4e6a-a1a1-4ae9d81ce144	fisiologia endocrina
b4c43cdc-1200-406a-a866-a3530186f7b4	tenere il passo con le innovazioni nel settore alimentare
b4c38bee-8d17-4977-ba5a-a7b541e23e17	eseguire il montaggio video
b4d64f2e-71c7-4bd9-be65-df0d23de2e8e	preparare le istruzioni di lavoro
b4dc7bab-f0e1-48a3-a732-9a33681d5c89	controllare il carico di lavoro
b4d71f83-c640-43b5-8815-8fb56def2d66	tipi di scatole
b4ddf3fe-14c1-46c3-a3d0-6c0895faabeb	sviluppare i piani aziendali
b4e14e6b-be3e-44b6-a16b-b31cfb731a15	gestire le risorse delle sale macchine
b4e32d2c-427d-4a3b-8deb-de1cad160b2e	curare barba e baffi
b4ed200e-b301-4c55-bcd1-dbbec3d396b3	ispezionare i pozzi d’acqua
b4e47aae-16e5-4d59-84dc-dd660a59139a	offrire consulenza ai clienti sull’utilizzo di prodotti per la cura degli animali domestici
b4f1ae90-30af-48d2-971d-964499af85fe	essere addetto a macchine per l’estrusione a freddo
b4e80845-4c01-4b61-8ee4-89d259820492	applicare le norme in materia di produzione di alimenti e bevande
b5081d9a-6400-4371-9296-364b8f2f9e42	ecologia acquatica
b4ff8914-62df-412c-a82e-793aac7705a4	collaudare optoelettronica
b4fee8c7-124b-402b-996a-083e8062a41b	gestire le attrezzature di sicurezza
b5093052-783b-4dd0-ba10-9fae8cb0eff2	tagliare i tessuti gommati
b51a15db-cc2c-4d88-9014-50d897e20857	informatica sanitaria
b51e06c7-3763-449c-9fa4-43df2c141e33	organizzare riunioni genitori-insegnanti
b5275fa0-6aa7-4323-bfb9-a7cc2297f033	aggiustare la tenuta stagna delle parti del motore
b51c3a42-ef87-4150-a50d-d1241c38d982	mantenere le piste aeroportuali sgombre da ostacoli
b52ee703-048f-481d-872d-3072a1607d14	fornire assistenza nel trapianto di reni
b5347512-a48d-4052-97f9-6d7e0e60ccaf	abilitare l’accesso ai servizi
b536d1f8-7285-45d7-9b9b-4467e74e6959	studiare l’acquisizione delle lingue
b547cb8b-52eb-41f1-92fa-1d9d6bcb7568	standard di taglio delle buste
b5453a58-b59d-4498-beea-7be0f3d075a5	tenere un archivio dei trattamenti
b5520cbe-8d10-4787-918c-6ad82e3f4ab6	gestire l’alta tensione per l’illuminazione aeroportuale
b552c5f5-42b1-4da9-b396-1f9a4de4e062	regolamenti internazionali per la movimentazione delle merci
b3a7ccad-c5a3-4357-8d46-8eff6d68a038	individuare collegamenti interdisciplinari con altre materie
b5545714-787d-449a-b34a-113e4840cd17	rispettare gli impegni
b55ad4ba-e0e3-4f58-8066-347e9ff710ad	rimuovere i detriti
b563214b-8ddc-444c-a9b8-272cff15341c	impostare i fine corsa
b56fb891-cdb9-4517-8a08-0df807091ccb	eseguire la gestione dei rischi connessi al magazzinaggio
b569a321-1260-47ce-bd3a-6df3fdb83a1b	gestire gli incendi boschivi
b5727ca1-06e9-42e5-9df6-5c3f786c836d	gestione della catena di approvvigionamento
b56e7bb3-fb18-4c27-b0cb-a9b356ea99a7	creare la documentazione commerciale per l’importazione e l’esportazione
b55bb4e2-848b-4f9c-aa0c-cd194983fa86	misurare il tonnellaggio della nave
b575ac87-6519-4953-9282-cd373be58c98	gestire le richieste di indennizzo assicurativo di gioielli e orologi
b5777aa7-b696-4275-9443-b554a8ede257	ecologia forestale
b5791021-6aff-48fa-88c5-d3850f8ab33b	gestione dei dispositivi mobili
b57e5a6b-aac9-4957-90ec-93266f7a3eec	adattare l’istruzione al mercato del lavoro
b5824a21-a38b-457c-b4d8-050bd0b06c36	farmacoterapia
b57afe11-0454-477a-9780-4eafc6ed1b76	preservare la qualità dei sistemi TIC
b586788a-6855-4468-a25a-0e8de7b226ee	giapponese
b577ccc5-1453-4f7a-9930-4d026596251a	fornire un’assistenza ai visitatori di parchi divertimenti
b59fd071-870b-4ecc-b7eb-86d6efeade4d	esame protesico-ortesico
b598347c-4b33-4e2b-b249-1a4eb99e9d09	preparare i tubi di rame da utilizzare come condotte del gas
b5a0b66f-aefa-4133-ad8c-cee1bc6b3d7a	rispettare le norme di tenuta delle registrazioni nella chiropratica
b58784c8-c8f5-4070-958e-9ffdcfc3a786	fornire informazioni sulla valutazione del carato
b5a2f588-f525-42ce-955a-1583b4f2e7db	utilizzare le apparecchiature di riscaldamento dell’acqua
b5a7d6a5-3227-453a-bc1b-2e5ddc7241af	malattie comuni dei bambini
b5a9b85f-e9b9-4664-a64f-1c223dfffcf2	rispettare le prescrizioni oculistiche
b59ed4dc-5dbf-4f49-a019-3a0c0a90f463	tradurre concetti artistici in progetti tecnici
b5aa1fc1-fc2f-494a-b34e-c8779975a06e	organizzare le battute di caccia
b5aec5f7-da7f-4544-8fdf-958858080938	regolare la temperatura di liquefazione
b5cf4c6e-e02c-47bd-b324-2b971c301821	gestione dei conflitti
b5d0a342-eb09-4d90-ab93-7eb9082b31ae	installare barriere di schiuma sulle saldature
b5b14f6b-c38f-48e2-aaa9-bf9aca79546e	utilizzare una macchina per la modellatura della cellulosa
b5b0817a-83d5-4566-bdb1-262858e9395b	dare istruzioni sulle misure di sicurezza
b5b69bc8-079d-4a4f-bcd3-f6c1d522028b	collaudare apparecchiatura di strumentazione
b5d17a08-24e3-4aec-954a-3470d29fbabd	tenersi aggiornati sulle innovazioni in diversi settori di attività
b5d7e9a1-7a9d-49ef-9778-7891f8149ed4	produzione di prodotti del tabacco da fumo
b5e365ca-55f9-4b12-bb92-83a64b38fd75	fornire assistenza a uno psicologo
b5ddd847-ad0a-40f7-a4bd-7629df8d55f7	estrarre materiali dalla fornace
b5ec25cd-7672-46f8-a553-7d25733e73e6	azionare le apparecchiature video
b5e414bc-da9d-4914-b9fa-d3365e01cabe	dispositivi di segnalazione del tempo
b5d9fbfc-0d5b-4e14-82fe-1994e2b94230	garantire il rispetto dei criteri di divulgazione delle informazioni contabili
b5f69442-a854-4a83-8646-b7394691800f	aggiornare il firmware
b5fe1bcc-1d9a-4243-aae6-8df065880592	elaborare ricette di produzione
b5ff2300-45cf-4b3a-83d4-8107c7f08ab0	mescolare i materiali di trattamento
b6049189-769a-40c8-bd23-9ccde88c66d5	tecniche di interfaccia
b60574e2-0843-4579-8b3c-8618b61ffb62	gestire l’allevamento di oche
b6081def-5477-4c6c-9c90-cbc42f3f1a05	redigere istruzioni architettoniche
b601e318-cf82-4d06-b34d-4441a1d9840c	fornire ai clienti informazioni sull’ordine
b6095a57-ec66-4668-9f4d-5272d022117e	realizzare soffitti a cassettoni
b60d919e-6217-44e0-9575-e51a5b04710f	rifinire i costumi
b60ab79d-dd21-482c-905d-1025c199c4aa	assumere il personale di post-produzione
b60a4407-ef08-42a8-b932-37fe08221c96	garantire la gestione efficiente dei bagagli
b481cab2-aa93-458e-b09b-4adc38c9ae13	effettuare la manutenzione dei sistemi di condizionamento d’aria
b6195169-7c3b-4659-bdd6-8720de230682	responsabilizzare i fruitori dei servizi sociali
b62b9fa7-222a-48a3-9db1-6bffb2cc1c98	utilizzare le macchine sabbiatrici
b62a7c68-9cc3-466c-9885-e4129e18723b	effettuare la manutenzione di macchine rotanti
b62f8dec-ef2a-4346-8b64-ac77ad91dc6f	creare le composizioni floreali
b60ffc91-ed0a-4540-be08-28669f8a0ae7	riparare il corpo del velivolo
b63445c4-d620-4257-a947-c6a0980adb9c	mantenere l’equilibrio nei mezzi di trasporto
b6269bbb-7369-4065-8086-613c4f136f99	preparare il contenuto delle lezioni
b63df46a-6c34-4f0d-ba48-610a1988b5b0	utilizzare la lama
b62e6ca1-6713-4a2c-8e76-801d03e324c4	adattarsi alle esigenze creative degli artisti
b64fc627-84ed-4d8d-9851-b4e564313e10	praticare tecniche di massaggio sugli animali
b65ff497-b750-4ad4-bb96-c7c45c315e63	levigare i manufatti in argilla
b64667ea-d8db-44eb-8cd7-7d7debee699c	intraprendere le azioni di sicurezza durante la navigazione
b65edd13-5542-4341-9198-341f7b4232d6	preparare le composizioni floreali
b6531ee7-91a7-4f5e-bd96-7205ebe788d7	analizzare il patrimonio arboreo
b668658d-4acc-4016-9ed5-c06838b0970f	meccanismi delle serrature
b66d0259-76a0-42be-af05-fa87958f8e06	eseguire confezioni regalo
b66f2a13-786a-4919-8537-54ab8d506595	gestire i sistemi idrici di bordo
b67a2caa-232f-4aaf-8dcb-fab4eef04bd5	mantenersi allenati alla danza
b6869732-c710-45f4-af98-644cc656077f	legislazione sul trasporto stradale
b68c4c18-f8e2-457b-8dbd-cd36f2a6540d	calcolare i risultati dei giochi
b6713422-ff41-4148-bf68-d236bb67de19	istruire il personale in merito alle procedure di qualità
b686d0e2-8dda-45ab-9773-f34c33f80251	antiparassitari
b6712a6c-d51d-4e21-98e9-f682ed870c32	dirigere le ispezioni
b696d464-1713-49e2-a065-6117a5e023b6	predisporre i segnali di pericolo intorno al punto dell’immersione
b69bb498-556a-46eb-896b-540dd6489d37	eseguire processi di pastorizzazione
b69bc563-059d-46eb-adb0-a94d215c8925	selezionare i bicchieri di vetro in cui servire le bevande
b6996f07-d9eb-4b19-aafe-54fa18bcceed	tipi di seghe da tavolo
b693a60d-f537-44f4-84ea-c9d819f2a06f	CA Datacom/DB
b6a17f7d-57cf-44ac-bb72-0c63a60a86d2	interagire verbalmente in limburghese
b6ca9ba9-769f-4235-93f7-d7e1b72c2880	riparare componenti di batterie
b6b8790b-3f23-413a-b01c-23c965bcdda7	tenere un archivio delle vendite
b6d4c34c-4dec-45bd-9994-0c675af699b6	installare motori delle attrezzature di trasporto
b6cdf46c-a574-41c2-842e-ee26776b6c6b	posizionare la slitta trasversale del tornio
b6e481a6-d768-4c38-ac91-a7375a88148d	attuare i piani di emergenza aeroportuali
b6e58050-5268-48ae-b35d-37533d5d1345	preparare le attrezzature per la raccolta
b6e8ee4f-34e8-4c0a-9f2f-8f930ce5a38c	alimentare l’impastatrice di calcestruzzo
b69d0293-e28d-4283-8397-fc6873da45fd	attuare il sistema di verifica della sicurezza delle aree lato volo
b6ea9271-e43e-4d68-9df8-5b3f9cb314a1	ordinare funzionari religiosi
b6f04980-b838-48af-982c-b919690d76e4	biolisciviazione
b6f1bfd8-a8a9-43e3-ba0e-bd93158161c8	utilizzare un mulino a martelli
b6f6334d-8a2b-4241-8a68-38f5f7c52bef	regolare le proprietà di taglio
b6ef48c2-9508-4a66-8e38-d84aaee48404	elaborare contenuti
b6f6b112-bd3c-41a2-ac5a-5224b161962f	misurare la piattezza di una superficie
b6fdf712-54f0-45e8-9092-74dcfb5d60e2	funzionamento delle centrali geotermiche
b6f68f4b-c439-4aaf-b1e5-c6f290470976	eseguire prove sui modelli per l’individuazione di sostanze inquinanti
b6f8480b-f350-4f77-b33e-7fdce62cf854	riparare le macchine di lavorazione dei pannelli di legno
b6ff8d05-d4d9-4930-8c01-5c853d6485b6	mercato azionario
b7037cf9-af78-42fa-ba2b-f87cb2a9161f	valuta estera
b704ebd4-b7b7-40a4-89fa-f7a3eba66895	tagliare le chiavi
b6fa99b9-c808-4303-9f6a-fc547a074aea	offrire consulenza sulla nutrizione e sul suo impatto sulla salute orale
b716739e-e882-4dbf-92f4-953c4388bba1	effettuare la manutenzione degli ambienti di lavoro nell’ambulatorio veterinario
b71e732a-e0a6-4c60-8e73-7e1a745f2a41	istituire i fondi di investimento
b71a4689-16bf-47f7-a6b2-94eb88787932	controllare i tubi di aspirazione
b7222fd0-5bc3-4316-b96b-12393accf01b	tecniche di pratica in arteterapia
b72c327e-9613-404b-81b8-498846d92e73	fornire un servizio di neurologia chiropratica clinica
b7426a12-2836-4453-9abb-dc9ef489f1bb	offerta pubblica
b72a00b4-19be-451f-a46d-0604fda55dd5	gestire l’assegnazione dei tragitti degli autobus
b7327bcc-7aa2-45a6-b98e-b552fab233ca	installare le apparecchiature elettriche nelle imbarcazioni
b7225bb7-b413-4a74-bcd1-55486460e855	eseguire i calcoli matematici per la gestione degli antiparassitari
b7485e35-0bb6-431a-9645-44206b46b9f4	gestire il dolore acuto
b753bcca-2a51-439e-b10b-51d2ec94ad8b	svolgere compiti tecnicamente impegnativi
b749b718-1998-440a-a744-4d5fd4cca94f	utilizzare le tecniche di depilazione con filo
b75553a8-c010-411c-ae4e-d23b0eb040e3	immagazzinare le colture
b756d98f-5c59-4d2c-9c78-e1fb87dfcd9e	principi di costruzione edilizia
b76b72d2-e97e-49e1-b2de-98a0f208167e	far defluire l’acqua di lavaggio
b77877e2-3c5d-42e5-bd14-d7ae14ba08be	monachesimo
b7495bce-fe12-4688-b8fd-c4968742e30d	garantire il rispetto delle norme in materia di rifiuti
b775dfae-80cf-43ba-87ba-2cfca4659c27	guidare una squadra nei servizi forestali
b75dc037-e7a0-438b-be8e-d6c4a662d81f	promuovere l’inclusione
b79140f0-e95b-4917-8c29-b28f38cf9b50	preparare gli oli
b7946a9c-745a-4493-ac99-167a21e263b8	eseguire esplorazioni geologiche
b79159b8-f792-4821-b2fc-de84cadfb6ca	installare gli stampi nella pressa
b781eddb-7108-4b66-9c8e-25047af45202	offrire una consulenza su prestiti di opere d’arte per esposizioni
b7964a99-45cb-4a6b-bed6-705897ae0edb	presentare le argomentazioni giuridiche
b796a191-7fb2-4756-8e40-0e24db1f13d8	eseguire l’impastatura dei prodotti alimentari
b79d4040-cb72-4881-b4c7-a1decb0979de	prodotti in pelle e cuoio
b79fb859-d37b-4157-b5bf-f88bde501664	mantenere lo spessore del vetro
b7a09ffb-c480-4b59-99eb-d2b8ad793db4	applicare tecniche di cromatografia liquida
b7a503e5-50fe-4ba6-b656-c4af7145d8a2	classificare i prodotti audiovisivi
b7b75da2-772d-448b-a68f-bd21218df861	gestire il gioco d’azzardo online
b7ae6228-e87e-4c36-800d-ef75ec860155	articolare le proposte artistiche
b7c01a92-5c18-46fb-904c-62ed205b1c1b	gestire un centro culturale
b7a13bbb-5fd2-477a-bdab-e66bc479ca0b	fornire informazioni sulla fornitura dell’acqua
b7d6f960-a550-4a1a-aad9-2a17681e2e44	principi giornalistici
b7d6f1f8-571c-4777-816b-1358daff4050	determinare gli stipendi
b7d989b6-7e68-4451-932c-51ac2ad8ffef	preparare la pietra per la levigatura
b7d32953-83fb-41d8-99a8-fd3237265a9c	analizzare una sceneggiatura
b7a7dc57-7a93-497a-8a88-e3520c7fccd2	gestire il bilancio della scuola
b7ec1d47-54ca-4a1f-8e42-b465e447af58	modellare dispositivi medici
b7fa0c20-fa16-415c-a760-40442196533a	raccogliere i dati dei clienti
b7e9acee-5b9f-4d99-8ef4-26c27e9e4955	parti di macchina punzonatrice
b7e7ac2c-9933-4f6a-abf9-b431467a340d	ispezionare le tubazioni
b7dfb5ee-c1de-44c2-bb9a-72f1a62b0802	formare il personale medico sulla nutrizione
b80ee18f-81e0-4b48-834a-0e752bb9e81c	offrire consulenza sui trattamenti abbronzanti
b7ffe817-01df-4890-a99a-f2f912d12441	effettuare la manutenzione delle attrezzature della gabbia di acquacoltura
b7fe3f69-f588-41db-970f-ca8f0310c767	Eclipse (ambiente software di sviluppo integrato)
b8103ab6-358c-4c5e-be3c-556bac1bce0c	normativa sulla sicurezza TIC
b8118ba2-91f4-40dc-98e8-280b9267b16d	controllare il lavoro quotidiano
b8225d8d-85db-4d54-be96-33fe85c5df2c	trasferire l’attrezzatura per la granulazione
b82e3151-2df9-4d80-a364-73b828949754	definire i rischi di incendio
b848f6b5-5c41-4ac9-a78d-071c82c684af	pulire le camere
b8362028-17a0-4525-9dcf-1da24bd918ee	supervisionare la qualità degli alimenti
b84902e6-45c1-4ef2-aa94-cebc7ec3bada	teoria dell’arteterapia
b84fd8bc-9d51-480c-b0e2-d9b32128e9a1	strumenti musicali
b85823c6-ff1b-4eb1-b0bc-1fbc4be4c5d6	monitorare gli sviluppi nel settore alimentare
b8430475-4d6a-4906-bb70-79cf560b3abd	garantire la qualità della busta
b85fc4c1-423a-4049-ad07-acf1202e23a6	scrivere in persiano
b85a4289-9103-4b03-8668-126ae310ebe8	risolvere i problemi legati alla formulazione dei cosmetici
b862419d-0928-4dfd-9859-15e3e343088f	terapia Vojta
b86ff0b1-78c2-478e-add3-8c4a37f157c7	individuare le esigenze del mercato per la documentazione
b869f88b-1f02-4e84-973c-9aebf3603f65	testare le procedure di trasmissione dell’energia elettrica
b87dc711-492b-425b-9a6d-93bdc8bb00f4	stabilire gli obiettivi di vendita
b881a5f6-fd99-483e-ad1b-c2c7d935afd0	ordinare forniture elettroniche
b8728059-a895-4524-a696-51c8f33e8c42	descrivere il sapore di vini diversi
b890f888-6ae1-4273-b551-af7965fb4566	fasci di cavi
b888431a-354f-41ff-b83f-2235252d71c9	mantenere le attrezzature di taglio in buone condizioni
b89cd2c3-4466-4702-bc49-1e17ff7ebfb1	preparare gli impianti di trattamento del pesce
b89d2293-cc25-4c26-b47d-d7075662f1d4	controllare i progressi terapeutici
b89dc01f-7091-4aca-819a-3e604ccf3041	eseguire finiture al legno
b8a9e4f9-3b6f-414b-87af-26764a1a7398	ferrare i cavalli
b8af6aa3-1b70-4517-8776-b51c7dd05d0a	istruire i proprietari di animali
b8b26f07-bf47-48dd-8a4e-ea8117b001e5	adattarsi al cambiamento
b8c1d174-3732-43e2-8541-e6472a3713c1	insegnare abilità di sopravvivenza
b8c3b750-e7e8-498a-ab4f-09da6aa58921	gestire i camionisti
b8dc7f2b-7f4a-44a4-8101-f000da6bc359	cambiare le vetrine
b8eff36d-4dea-43d0-8548-b2d0fbfcff47	utilizzare una macchina scortecciatrice
b8e2b889-be86-4916-b17a-9f2e9452ce36	confezionare pesce
b8e5b198-50e6-40fc-813d-0c927c0f1d0b	monitorare la sicurezza degli edifici
b8f2a50f-5c71-4eb1-986b-d9c30c880568	lavorare su superfici irregolari
b8f85af7-225b-4d80-befc-80a632372f57	realizzazione di prodotti in filo elettrico
b90414ce-a3ef-4098-b908-8490777204dc	varietà di fave di cacao
b8f6db29-8fb4-4066-84ec-30bb59d616ef	utilizzare strumenti per fili elettrici
b90d61e8-af30-419b-ba87-345a4df5b478	disegnare oggetti da realizzare
b7196ae9-8f93-4ac9-b791-0fc46df4bdb1	preparare le scialuppe di salvataggio
b919f716-8b46-46c5-8fe5-ead53d98b4c7	saper utilizzare un’incapsulatrice
b91a5028-ed36-403a-a82e-a6b43c838455	sviluppare le politiche commerciali
b928f0f8-afcc-47c0-b7b9-b9f7f23d63f3	gestire i conti bancari aziendali
b914524d-7560-4f5f-92a6-3afddd9bc03f	smaltire rifiuti di alimenti preparati per animali
b92975f9-bc5c-4068-b08d-7062df80158d	fornire assistenza per l’emostasi
b92d10fe-abc6-4808-8f07-1906b828fbd8	produrre bozze prestampa
b932fa3d-a9e3-41ae-a1fd-3a6d9db1b9e7	transizione professionale in una carriera nel settore delle arti
b934b751-9df9-4aa7-8aed-82e7811bc9f3	ortesi
b9385d43-65e8-474a-b1d9-b494c85cfd4f	sviluppare procedure di produzione delle bevande
b93af13e-08a6-4968-af59-802293383d58	audiologia
b93e296f-ff8a-490f-8b8a-06a777adbb68	creare modelli
b9306bbc-09cb-4666-a00c-c4eabef46daf	gestire un’azienda con estrema cura
b940d5ee-adb4-48a9-946a-a2b2d817ecf2	creare struttura animale
b94329a3-9330-4ed3-9c59-d0b532e08dd7	alimentare la macchina per la fabbricazione di specchi
b9404506-d5c3-4c41-aa94-dffdfe6a6440	mantenere le relazioni con i proprietari degli immobili
b944fcd1-0aeb-456c-a16e-9827ef0889d7	produrre fibre sintetiche
b94588d9-0aee-4c70-810f-5e10ead43f7d	organizzare il ritiro
b945aadc-65ce-42a4-ad85-6ffcbf30f2a8	ispezionare carcasse animali
b9497b74-de66-45c5-9eb1-4affec793b29	Installare gli impianti sanitari
b93bee28-333a-42f9-95da-beecb468ae46	analizzare le possibilità di percorso nei progetti di gasdotti e oleodotti
b9522fdf-836a-4314-8dd5-29a231642a99	OmniPage
b953b71a-9d69-4027-a554-b01224e7c58e	identificare le malattie comuni delle specie acquatiche
b95349f6-f9e0-4b46-8438-9c73c0c0711b	controllare i campioni biologici ricevuti
b9592d1d-0651-46f0-abeb-cc194cc4dd90	gestire il reparto creativo
b95b448c-87dc-40d7-acb2-565f035ae29b	sviluppare software basati su memorie di traduzione
b958c98f-2863-43a4-a9ff-c20bab296122	promuovere i diritti umani
b9640ef5-17e0-4f5c-a2e4-7254e1b0379b	ortodonzia
b960638a-e168-446a-a7ca-4be84f114a34	normative sulla sicurezza nell’ambito dell’energia elettrica
b9812a9a-e092-4ae3-8ef1-b20328a7351e	lavorare in gruppi di istruttori di fitness
b98ba8b7-6b9f-4f93-8211-fbc476955ede	post-elaborare le immagini mediche
b98bd024-f7b7-4102-a7a2-93850b6b3674	consultare fonti iconografiche
b98da83b-e8bd-405f-ad5c-0395943b9048	trasmettere gli ordini di prodotti ortopedici
b9915427-bbb6-4429-a353-1e0325797969	configurare le attrezzature multimediali
b992271b-4793-4514-bd5b-a93efe04be19	realizzare rendering di immagini 3D
b97d2a54-aed5-4521-9932-92b3a41f526f	stimare il costo di manutenzione di gioielli e orologi
b9961b80-be18-48b2-a784-2629c4083819	preparare il materiale per le coperture
b9985396-f53e-413c-81f7-542978f902d5	processo di produzione vinicola
b9a239c2-93d8-4bce-8757-e8e98f26d747	test ICT
b9997cb3-7fb7-474c-8a11-399881712f97	fornire istruzioni agli operai montatori per il montaggio delle strutture di sostegno circensi
b9ba49af-c7a3-46c6-9997-d0dca7238e9c	installare gli elettrodomestici
b9a6e2d7-977e-4112-a67a-133bce9678a5	gestire le crisi sociali
b9bedb3a-ae8c-48be-b943-699cd0070bd8	gestire il trasporto delle opere d’arte
b9d1167c-975a-4df7-966b-c413f0110bb8	promuovere la consapevolezza sociale
b9dd24ff-c37c-40cb-a822-3d03e6989004	raccogliere informazioni sui prodotti
b9d594fd-ef24-4ca5-be89-5141d138180d	eseguire le procedure di codifica clinica
b9d5b2c9-9137-4410-afaf-0473e78f26da	rispettare le normative in materia di alcool
b9e0275b-68f2-464c-ad48-ff5493f8c19b	lavorare con le sostanze chimiche
b9b351df-3ae5-430f-aec2-811320343385	rendere la legislazione trasparente per i fruitori dei servizi sociali
b9e1b795-a7b6-417e-97ab-8d0ea0759e4a	sviluppare le politiche per l’occupazione
b9e3463f-ac45-419d-b466-4ed96be53063	controllare i bollitori su fiamma aperta
b9e39e33-0810-4bd1-b4b4-bfc22a7d0809	mettere la colla sulle tele
b9e9f211-26d3-430a-aa9a-8435d5b13acf	prescrivere la terapia fisica per gli animali
b85cfe3e-49b8-41e0-8c24-499ffe3dcb35	manutenzione di munizioni
b9ff3a0c-f7eb-4992-b427-97e5e58d8278	aggiustare il voltaggio
b9ff7ef3-0c90-4fd9-9784-0c1af801f952	catalano
ba037aa9-5f90-47ec-801f-25a0dc77ff0a	gestire la salute e la sicurezza
ba065a33-eaff-44df-b1dc-d8d262eccb43	gestione di progetti TIC
ba0ad009-c0c4-4726-b45d-b4452e1e83cd	organizzare l’assistenza domiciliare per i pazienti
b9ee1cdd-dd09-4b3d-b1a1-b912d9bfcedf	individuare i desideri del cliente
ba0938e7-ca7e-4f47-960c-20aab12843dd	pubblicizzare nuove uscite di libri
ba0b351f-4807-4d9e-89cd-cdf45e6946c5	stampi
ba0b1a45-0d6c-444a-8ade-f6f2e5e88626	tenersi aggiornati sulle più recenti soluzioni di sistemi informativi
ba0b3302-2cfd-4e0d-8470-42f819a54b6f	fornire le strategie di trattamento per le sfide per la salute umana
ba0cbd86-f8a2-447e-9b29-9be99332793f	lucidare i mobili
ba13bc16-ed5b-4388-8cf2-e3cfd7d91218	individuare i servizi disponibili
ba228aae-8b2f-4c1a-93b0-49a5a617c4be	eseguire misurazioni di gravità
ba206ae1-3394-46fa-93c3-d7debadb281d	supervisionare le operazioni di pulizia
ba3fb076-388e-4ddf-bf4b-0af5d4a5b123	essiccare foglie di tabacco
ba490915-baa2-4462-b99d-ee8fdd8c51d7	preparare i materiali di origine animale per la realizzazione di setole da spazzola
ba44bf86-2ec4-452a-b829-4d9806e7a7bd	analizzare i risultati delle prove del latte
ba492807-62f8-4d5a-abc2-d58397881b1a	progettare un impianto per il trattamento del gas naturale
ba451ffa-d032-42fe-a8e3-7645ea9e9197	applicare le norme di sicurezza ferroviaria
ba43b88a-d176-4dc4-81f2-d197b292a64f	eseguire le ispezioni delle rotaie
ba3d980e-8ae3-4174-87fa-8e54fa314bfc	verificare le condizioni del camino
ba4b082f-d10e-4462-96e1-1315c6a371a7	congiungere lenti
ba4f69ea-7e00-4a30-92c4-0808dad97c2f	raccogliere informazioni sul tema dello spettacolo
ba508c5f-8254-4647-a6f1-3cc1b1370854	coordinare la vendita di video e film
ba49cf34-5f56-4c77-a045-fa175b09a00d	somministrare i mezzi di contrasto
ba4cd9a7-a5ac-4b3e-92b4-cd528177193d	calcolare le indennità
ba54fc58-11f3-498f-8e43-e70946d53178	assemblare apparecchiature di misurazione
ba62ecc9-5f7b-446a-be53-21957db54fb1	azionare le apparecchiature per la trasformazione dei materiali da riciclare
ba6f8121-b350-4631-8804-677b80a99d05	fabbricazione del master disc
ba75cd82-4ba0-4a0d-8a6d-e0f8b01ee264	garantire il rispetto delle norme sull’assistenza sanitaria
ba6d68de-a7de-4cd1-a756-c89991320253	Teradata Database
ba71844c-1493-4a2c-98a6-77cfad1eb5c5	assicurare la garanzia della qualità per i prodotti farmaceutici
ba68c024-8c8f-456f-bdbb-1c1855df73dd	controllare la qualità delle materie prime
ba793916-0721-4e1e-a3af-781d6aa481a3	analizzare i campioni ittici per la diagnosi
ba7cd36b-2b01-4f80-9777-4212e47cfec4	parti di macchina per galvanoplastica
ba7fb0ad-4cb1-4535-a1e6-7c43c12a6794	avere una buona dizione
ba827934-4ef1-4c60-bd87-52e57815f8b0	Havok Vision
ba8310e4-0e42-4bc3-8624-1a234435297a	materiali da paesaggistica
ba83f4ce-8244-4593-af70-190e4e78ac2c	organi animali a sangue caldo
ba8856e8-b421-491d-bbd7-b9bc4ce272a1	garantire la conformità dei materiali
ba903424-e2f4-4a66-9f02-f79c94270fc6	gestire i bioreattori
ba80185e-0b86-4e1a-b84c-87ed8ba78d7e	utilizzare i dispositivi di protezione individuale
ba989348-5265-4698-979e-17825c1a0a16	ingegneria della superficie
ba9f6363-4859-421d-b0f9-edcb4190efb4	prelievo di sangue nei bambini in tenera età
baaaaf75-219f-4c30-9bca-88e3169c2a30	modellare il flusso delle acque di falda
baad77bb-f76f-4a9c-8e5a-a4962d387bc3	distinzione tra tipi di seghe
ba9f7bb5-c7f4-4157-9d46-7a49026c82e4	elaborare le strategie per le emergenze nucleari
ba937509-47bf-488c-8d5d-0c3c6ab53ffb	stabilire un contatto con i potenziali donatori
babbb6f3-c8a1-4d92-bfa4-ee8805b4027d	gestire i dilemmi etici in relazione ai test genetici
bac76c4f-a0f8-4fbd-9c63-1bfb141767dc	effetti dell’allevamento e della coltivazione sulle risorse acquatiche
bad7752d-8e25-48d8-a1a3-d9c0dc0658bf	progettare un impianto per l’energia elettrica
bad8eb62-3afc-4373-92f8-f7c4d920e2f1	consigliare l’abbigliamento appropriato
bad46e5f-7f5d-4718-ae1a-437299a7575b	effettuare una svalutazione dei beni
badd612f-2d69-4197-8cc4-80024bbc2c66	gestire le attrezzature per la lavorazione della carne nelle celle frigorifere
bae5c217-4467-4ba8-93ff-4f054ff70c5a	valutare l’impatto visivo degli espositori
bae8e12e-39de-42d7-8295-d97102e2a3e9	trasporto di materiali pericolosi
baec28c5-2afb-4dfb-a12f-b1379288167b	parlare il dialetto
bafe7cc0-7133-471b-98bb-dda6c0322270	applicare la scienza motoria alla pianificazione del programma di esercizio fisico
bb02e2bc-baee-4acc-bd37-dd5e085a2fe5	analizzare i liquidi corporei
baf9895a-86e2-4b4f-af8c-895c949ffe3e	diritto commerciale specifico
bb078b1c-d46a-47a6-a815-88e7ee4f8803	ingredienti per la produzione della birra
baf6e6df-214e-4187-a365-374780569619	rispettare le procedure operative standard
bb0e414f-6a49-45e0-a536-37fba273096c	impostare la velocità di funzionamento delle macchine di produzione
bb246e70-28f4-4f21-8882-8b461a805a8b	creare politiche di sensibilizzazione legate al sito culturale
bb25e06a-7c55-48c1-a4d0-d1d486f3537c	macroeconomia
bb13e14b-0bae-4ee2-9cd0-43beb8a48560	fornire informazioni sul gioco d’azzardo
bb25f544-a2d6-4be4-b372-f5a41a164ed4	promuovere le attività religiose
bb0e0ee5-9843-4620-85db-275223a55189	analizzare gli schemi di prenotazione
bb30ae00-47df-4533-8527-717547db81cb	determinare il tipo di pelle
bb2ad654-051b-40bb-a655-663b37c9efc9	comprendere il maltese parlato
bb40e2a6-0c0f-4c0d-877c-46e24d574b07	partecipare ad eventi turistici
bb42d491-7791-48ee-9b05-2297224296fc	gestire i materiali da costruzione
bb4761af-e7ce-42d9-b431-01ae9d19c773	nutrizione delle persone sane
bb44c25a-e61c-4a13-87dc-b2bc7d2a4159	programmare la produzione mineraria
bb4f6c9c-0530-4c6e-a845-10992f8796f9	applicare le specifiche tecniche manuali di chiropratica
bb4dca5f-bba9-4538-8e0f-758b06941be6	utilizzare modelli teorici di marketing
bb5b46fe-17aa-4a32-9562-86af158b6663	comprendere il russo scritto
bb5fcc18-d6cd-44e7-93e8-6953f5956907	progettare sistemi elettronici
bb61e2d4-a4e8-4e93-b1bb-ac027026b425	assegnare i compiti ai lavoratori agricoli
bb759562-a64f-4c85-909d-8d5658be9084	gestire gli effetti scenici
bb76d860-8f96-4d93-a344-5e67bc908e7c	politiche dell’organizzazione
bb7c8d14-bf3b-4bd6-8b28-e5fb0234f5b3	organizzare il trasporto dei clienti
bb6a2c8c-f5ae-48f9-9824-a5e11a2e8263	mantenere i contatti con i partner culturali
bb54b179-e36a-49ff-938b-5b8d24a010d9	indossare attrezzature protettive contro il rumore sul luogo di lavoro
bb7f8781-c905-4948-89d9-2689018bb4f4	condizioni per l’esercizio professionale della psicologia clinica
bb7f9aa2-2267-4054-9a78-61b4d588d8bd	descrivere il sapore di birre diverse
bb8edb5f-486b-44f1-b435-be687f6fcf29	fissare parti di motore
bb867fba-b7db-41d6-aac8-e235ccbc13a8	attenersi alle norme dei programmi di sicurezza nazionali ed internazionali
bb8fd96d-3a6e-4b35-b765-6150aee5d7e9	catturare l’attenzione della gente
bb8b5ce4-9e16-4fc5-a2e0-9e47a3566d84	concettualizzare le esigenze degli assistiti
bb917f0c-e000-4c4f-aeb9-319916aa4b33	biomarcatori
bb9483be-aece-43bf-ac85-425868d7a128	preparare campioni di articoli di pelletteria
bba68934-aab1-4bff-8958-5a96ae7f926d	supervisionare le attività di magazzino a valore aggiunto
bba731b1-6666-45e1-9ea7-a73594c60aa5	installare il sistema di filtraggio dell’acqua
bba3dc46-90e3-497e-a2a8-e669a19c4758	registrare le informazioni sulla lavorazione del legno
bbb43936-56c1-43df-b742-8378da61905b	rispondere alle richieste di preventivi
bbb2c638-5667-4df3-a695-95008cffc1a4	Drupal
bbc3edf8-49b1-4d82-923f-f8d6cbda6d10	sviluppare i piani di formazione di sensibilizzazione
bbd3e30b-f5cb-4468-9a4e-49de211abb79	rilevare microorganismi
bbb1683e-f80d-4f55-82f8-541d357f78e5	spelare cavi
bbf2a5b8-f78e-4c2f-91f7-f47ef04bdf47	scienze politiche
bbf0641f-207b-49b7-988c-e2e0e5c80827	evitare arretrati nella ricezione delle materie prime
bbd65c7f-4e88-4cf8-936d-d4cbf412075c	accettare le osservazioni sull’esecuzione artistica
bbd6071b-f549-49e0-bd97-45140544f91c	monitorare la conservazione degli ingredienti
bbf6441a-0aff-4507-bda3-283e3caebdbb	attrezzature tecniche per la produzione agricola
bbf68b00-fe65-4dfc-aacb-c07d947eb4d1	gestire i reclami dei dipendenti
bbfa8e43-67f5-4431-ba60-ba3ed070232a	sviluppo agile
bbfc2380-258c-4c1b-8d8a-ed8c22362a40	guidare le gru
bc05efa0-c240-4500-b43a-874615f35df5	ispezionare il materiale
bc14c68d-d1e9-4f8b-b32c-0feecb5e26fe	coordinare il reparto di preparazione al montaggio per la fabbricazione di calzature
bc136dde-5bc5-4b3a-a20a-ddde518d6e6b	documentare ogni aspetto di un evento
bc161dd2-287b-4a4d-acb5-352da20799f8	censimento nazionale della popolazione
bc157454-b74b-4f1d-b475-6ff4621f5b01	compilare le liste dei vini
bc1a6a80-f61b-456f-9ad2-9cf04c23818d	montare la pellicola fotografica in una macchina di sviluppo
bc1d4487-3e0b-4e8b-8292-c9d7f2b4c5e5	stare al passo con le tendenze
bc197841-23df-4afb-9713-e1a7b7e7bd06	comunicare le misure di salute e sicurezza
bc263125-a193-429b-87bf-17b5b4f89778	salvaguardare la salute delle piante
bc37155b-5b15-4a3b-b7f9-d56a700504b2	tipi di materiale per il confezionamento
bc416963-a41c-4081-a14f-db531d530684	gestire l’immagine del negozio
bc42a1eb-1041-4a00-a32a-a53986243d44	tecnologia di stampa dei tessuti
bc465878-71dd-4d28-9088-ad7255008599	fornire proposte per la ricerca di informazioni importanti per l’azienda
bc2e6ad3-d850-4eab-869a-1bfb307e797f	SketchBook Pro
bc49715f-ba50-4701-a76f-338e27635910	garantire il rispetto delle procedure dell’aerodromo
bc4f72a9-a318-4653-8563-27b882e7ba0b	realizzare finiture del calcestruzzo
bc463768-91fb-4ba0-af13-dec0866ff53c	selezionare la musica
bc4fbcee-9173-463f-92ed-c83cc927d958	utilizzare un alimentatore per rottami a vibrazione
bc5211b2-9dd3-4bc5-ae30-02dadcf6c7f6	dirigere l’installazione della cabina dell’ascensore
bc55f128-f899-419f-bcda-dc6e225b4af8	preparare i contratti di prestito
bc55636e-9a2d-4cd9-a926-55acfcad7d4d	informare i clienti sulle varietà di tè
bc5a2162-6cd7-4bdb-b292-cb09b1510141	essere addetto alle macchine di produzione dei dolciumi
bc6167ff-e68c-4d09-a1f6-44119af45462	tipi di turbine eoliche
bc781116-0ea1-4d5b-bb35-408b773eb1a3	insegnare i principi del diritto
bc6abb60-cf71-48b9-9d39-54ae4c304aaa	implementare strumenti di diagnostica di rete TIC
bc763130-00f1-4737-acab-ae6dafa664a6	condurre una ricerca clinica
bc6b7557-8a74-4ed3-95b0-a3c88240e1fc	eseguire audit di qualità
bc66f86a-3963-4259-8711-26f93e723e30	utilizzare i sistemi per ufficio
bc802e41-3bcd-4d2c-a51f-dc4c0768bba3	integrare i principi di allenamento di Pilates
bc80709e-25ae-4425-9c7d-58efc68581b6	garantire l’esecuzione della pena
bc9d4fa3-9133-4f14-80b6-6bef5ff39b18	selezionare gli ingredienti adatti
bc8f7508-3e64-4b96-b4dd-25f3474261d2	usare sistemi radio bidirezionali
bca05ba0-ea94-43ef-9a5a-0fef582b82e7	effettuare la misurazione delle prestazioni
bca37cdd-4ea7-4bdb-97f7-356acd410483	sorvegliare le macchine intagliatrici
bca6ed00-9834-4cac-acc5-97410075b176	riscrivere un articolo
bc95d020-b74c-4038-ac98-a60edf3a01b1	dare seguito ai reclami
bca92cf1-51b5-4fb8-8b6e-5d94eaee62fc	gestire pacchi e consegne
bcb31614-af1f-42f6-82fb-550236a53af7	scoprire nuovi attori e persone di talento
bcbbe92d-0cc5-42d5-9ac6-8abc2e940904	installare piastre di goffratura
bccb4f7d-a479-48d2-863c-458a8ee41b46	offrire consulenza su articoli di merceria
bcce888c-4ffe-4096-ac8f-498f046a5f70	pulire gli impianti di acquacoltura
bccf1c0c-563d-4cb3-8b7e-ab190dadca51	conservare i negativi
bcd388eb-9f2d-49e8-93b4-56bf270f1c67	pulire i condotti uditivi dei pazienti
bcada0cf-dd90-42c6-9bfa-09548cc461dd	comunicare i risultati del trattamento
bcd7207c-7321-4f9c-9230-e2514daf255a	fornire servizi in modo ineccepibile
bcdab823-1e0a-4129-817f-23c906787aab	utilizzare il software CAD
bcebac85-27b6-48d9-95f9-86ee52140b22	garantire il rispetto delle norme di acquacoltura
bce48ae0-3b92-4626-8439-b4bc311773d4	offrire consulenza ai clienti su come curare gli animali
bce0d3f9-7fe2-4a83-b1f2-4715ba63653a	ispezionare la qualità dei prodotti
bced472c-d9a3-42b5-81c0-00a2c7e28d4d	valutare il pericolo nelle zone a rischio
bcee83fc-422c-405c-801b-9dec9f110d24	tecniche di recupero dati TIC
bcf25378-3b68-4cd4-8bbe-61afdfbd7711	chirurgia plastica, ricostruttiva ed estetica
bcf6e2b8-9cae-4f7d-bc81-1fda4c2530d4	alimentare la cisterna di miscelatura della cellulosa
bcf50712-798e-4cf0-8627-c2c738899309	metodi di ricerca e di indagine
bb709ec3-b27f-4ead-b5fc-102c90d3a0a0	redigere i documenti di riferimento per lo spettacolo
bd0a4b89-acff-4cb5-996a-390284d6794f	utilizzare le apparecchiature fotografiche
bd05c227-eef2-4c0f-8c17-0c5421d21486	misure di protezione contro l’introduzione di organismi nocivi
bcffd961-9387-48cf-b458-2139d80d9727	eseguire cambi rapidi di acconciatura
bd01f9a1-45b1-4be5-a9b9-50a6d16cf510	consigliare lo stile di abbigliamento
bd0f22fb-7c55-4af5-8258-e72b7a5e2079	definire l’architettura software
bd125a1c-d201-402b-9a51-5df0c6195e54	combustibili destinati alle navi
bd11109c-2b2c-4ebd-b639-2f7eb6787f26	lavorare a stretto contatto con i gruppi di informazione
bd18d43c-a5ec-4af9-9edb-05818971346f	acquistare uno spazio pubblicitario
bd20f97f-b95d-437f-a9b7-4dedbb1f109a	organizzare l’allenamento
bd2c85e0-0b9c-483c-a572-67bc3e5de2bd	parti di pressa idraulica
bd24d789-1659-4a6a-98a6-5ce3bc636fc8	studiare le tematiche
bd41dc11-1120-4d43-8178-97c237444c09	foniatria
bd4261de-c7c3-441c-8593-4f61d89ff5d3	caratteristiche delle attrezzature sportive
bd48818a-0385-4429-a1dc-6e8308821a91	selezionare la fonte di registrazione
bd301da1-d3a6-4900-a6df-8db02d705447	Jboss
bd55a7eb-586c-428c-88cd-dada906cc171	progettazione paesaggistica
bd500883-edcc-4320-ae56-ff59010e618d	sviluppare le attività culturali
bd56f615-7ddd-41d8-9a77-8efaae1aab47	riflessione
bd4c4e93-35a1-4e17-be04-a64ddea08146	individuare i miglioramenti della catena di approvvigionamento e metterli in relazione con i profitti
bd606ae6-b3d8-4e2b-861b-5515d86a541c	partecipare alla preparazione della vite
bd622008-17c9-4f73-a636-9a6e9a08b52d	valutare i livelli di zucchero nelle foglie di tabacco
bd5b3685-a034-4d35-bd79-6fd45eb360cd	utilizzare una telecamera
bd63fee1-9ff1-47a9-9f9c-6998f41812c7	effettuare uno screening dei pazienti per i fattori di rischio di una malattia
bd66db80-a4dc-43b2-8545-ea4b0a763320	interagire verbalmente in galiziano
bd692fcf-be2f-464b-a7e2-ceced9a5ffcd	processi di idrogenazione per oli commestibili
bd73fed5-848f-46ae-9823-4eafe6ef73c5	pediatria
bd781240-f517-4781-928f-a5f4df6bd38b	rischi per la sicurezza legati alla rimozione della neve
bd842112-f1a1-4ba7-b651-d86868877846	vendere i materiali da costruzione
bd84440d-c68d-47d8-ae22-509d98af48cc	installare sistemi antighiaccio elettrotermici
bd885f98-39b0-4771-ab5e-4a40ec5b675a	eseguire la miscelazione dei prodotti alimentari
bd89e304-f4e0-4188-a195-78650ca7bf9b	individuare le caratteristiche delle piante
bd8fad42-1fdc-429f-b7db-6397116582a7	partecipare agli allenamenti sportivi
bd967125-6956-43bc-9f75-3d0754549339	azionare la torcia per il taglio al plasma
bd9348e0-d862-4a34-9e5b-29a7fab85c65	essere addetto alle macchine di produzione delle sigarette
bd996802-0b52-49e8-bf3a-653892f1dd7e	sviluppo psicologico dell’adolescente
bd9abab4-12f0-4d48-bcc8-af75ff0ea981	servire pietanze ai tavoli
bd9d4b15-a49c-4bec-842f-877c8b1e9b98	gestire un casinò
bda2ac4e-b6e6-4d65-8b17-9a81993902ba	sviluppare un repertorio per le sessioni di musicoterapia
bda6fe0e-db4f-46be-8356-6ec9c2741e38	utilizzare torce per taglio ossiacetilenico
bdb8cf88-5d04-4219-b214-bfccf0837fef	registrare la proprietà aziendale
bdb7bcb5-b000-422b-b2a2-7cf671116cdb	garantire l’applicazione della legge
bdb16462-e4c0-4779-a9a1-af12b8b9cf9a	fornire formazione sui sistemi TIC
bdaade52-c6b6-4990-b0ba-3679cce57502	esaminare le condizioni degli edifici
bdb09498-9ffb-4cd3-986e-290cb87d3e62	gestire il dipartimento della scuola secondaria
bdc74c4c-d84f-47d7-b62a-b6c0b7b18bb8	installare le condotte per il convogliamento di aria condizionata di raffreddamento o riscaldamento
bdcb6afd-b019-4c21-a092-a8fcdcb4f368	rumeno
bdcba3be-6f7c-4b04-b339-4d527dc0d0d0	organizzare l’assistenza in caso di avaria del veicolo
bdd1e0ad-d9ec-4324-90ac-691058c2b3ae	manipolazione corda
bdcfe013-2171-4ba4-a18f-213d2f684df2	verificare i campioni di amido
bdd40ec3-c14d-4fc4-8f5b-055454ffb26c	esaminare il legname
bdd8e2d1-9c4a-420a-b707-da24a31fc87d	principi di insegnamento Montessori
bdd7227f-c7a7-45df-94b6-13f3bcdae0cc	progettare edifici
bde1e3ba-8cad-4ada-9616-dec4f9c1a136	utilizzare i dispositivi salvavita
bde90356-364f-4eae-98f9-50cd42b08346	sviluppare software di reporting
bde43c3f-6451-4d08-abe6-4d695d08716e	sostituire i dispositivi difettosi
bdec056a-57fd-4bb7-a8cc-e543f70db9d3	applicare l’opaco
bdf1d558-83c8-4bf0-a215-54f96e88b5c8	monitorare le macchine timbratrici
bddee1cd-f067-4484-9614-9080fc6e26d7	attuare le misure per prevenire i rischi per la sicurezza derivanti dalla rimozione della neve
bdfbabef-7b06-4373-ada1-392fd5b71c0a	effettuare un follow-up sul trattamento degli assistiti
bdfd5046-87cd-4f55-8ab2-371e2606048f	ingegneria della strumentazione
bdfccbce-0840-46db-a28a-a0fcfd55b679	educare alla prevenzione degli infortuni
be076183-b669-4545-bd6f-25f18cd9b657	assicurare il rispetto delle leggi sul gioco
bdf61bce-fa93-404a-b0e5-54b0a0426988	individuare i rischi per la sicurezza aeroportuale
be078dca-fb6e-4c85-bfcd-a72d01454cbf	analizzare le adesioni dei soci
be134d9d-4200-4c9f-971c-6a99471ece32	illustrare i processi artistici
be166576-9593-4917-b70c-c08d1775cae0	screening cervicale
be199c7d-36f8-4769-b9f6-fbd6ca210d4b	scrivere in slovacco
bc9ae6c3-69c6-42d9-803d-352e8e77b8a4	gestire la sicurezza operativa sui treni
be0fcd72-5b4b-4501-8798-416289eb06c0	definire un approccio alla propria disciplina di combattimento
be223c27-9cd6-403a-aa18-280b27f2b767	scrivere in gallese
be2c914f-08df-46cb-ae04-913569a0af6a	gestire la posta
be2dacfe-6ba8-4206-a26a-14c1241f7071	francese
be3f9f3c-cd7f-47c6-8899-8234e547660b	creare il catalogo della vendita all’asta
be23f93d-4a90-4f24-97a0-b1aed60b1099	determinare la velocità della talpa
be4479df-ace0-4a91-a45f-778a02ce453b	software CAE
be3657ea-45c9-427c-9f10-a3e8cf8cf23d	eseguire l’analisi dei bisogni dei clienti
be528179-dda4-4758-befb-72623aba326c	applicazione della legge
be46967f-603b-4085-a86f-61353fb116a8	misurare i livelli di luce
be491b2a-64d1-4cde-a4e1-ae4cbb27e9c5	fluidodinamica computazionale (CFD)
be60db6c-3eea-41bd-86c8-eda716655e3f	ispezionare la fabbricazione dell’imbarcazione
be75fcb0-c07e-46fd-97e2-129a7ad4067f	citologia clinica
be806b2f-72e3-47b0-88aa-95c684709787	essere addetto a macchine per incisione CNC
be83e8ef-5633-4ee0-9f44-b5dcdf247c60	tecnologia informatica
be8ea014-f466-4c41-8b7f-07aa267ff368	garantire la circolazione costante di tram
be8fa0e5-44a7-48ab-8eea-2d85d8aa80b6	sviluppare movimenti codificati
be76bed0-162b-4a9f-a4b7-d5f3a34104f7	progettare le azioni per le campagne
be8cff9d-d312-442b-a7c8-1de9b9429a95	condurre prove di pressatura
be910f8c-cb9f-4da1-9f00-78d1b5d7401b	linguaggio di modellazione unificato
be9187be-f50d-4b82-b473-7483e6d1ebb3	tosare la lana
be995677-15e6-4e90-b083-b0ad0ffe5b47	mantenere un archivio professionale
be9e3d90-bc88-4e52-a352-4ae47b9eacca	sorvegliare la macchina per lo stampo a iniezione
bea2ee67-f331-49e7-b756-a047a2dd88e3	tagliare i materiali utilizzati per i pavimenti resilienti
be90b6b2-bdc2-4f57-b116-7ff21f5ad19e	prestare assistenza ai passeggeri fornendo le informazioni sugli orari
be9a033b-5cff-4d7b-882e-14be78fb27f7	adottare un approccio innovativo nel settore delle calzature e degli articoli di pelletteria
bebb536e-6e59-4f9e-b6a3-b63d02c867a7	collaborare con coreografi
beacb175-3ed2-49c0-997f-d15b9be41fc6	supervisionare la pianificazione dei sistemi di sicurezza
bebedad5-e82b-4f70-9f42-4060fb0f4581	coordinare gli sforzi ambientali
bec72919-355b-4c26-b6a2-e6c2f482e017	redigere le domande di permesso di costruire
bec39ce0-a9a7-4351-9137-863b92f5f504	elettricità
bec84a69-282b-4add-ae2c-b34d63d8846e	tipi di macchine perforatrici
becac877-3b63-4f3d-bcb1-ec599192cbb8	consultarsi con il gruppo di progettazione
becc2ec1-47b3-407e-af9c-e91ad8694ba4	regolare la pressione del vapore
becfb775-deff-4b29-9673-180594b290a8	monitorare le operazioni delle macchine
bed14ba6-98d5-460c-8377-1273e7bb0226	pianificare i servizi termali
bec956fa-9d5f-41b2-abfd-68d1a4016ccb	parcheggiare in parallelo gli autoveicoli
bee364ae-3e03-4827-87ea-bfbd56a22b50	principi di animazione
bf0bb539-087e-4459-8cc6-22c119a2790e	erpetologia
bf20e43e-5c28-4f04-8fff-3ce2b673d4c1	bollitura del mosto
bf115c8e-55db-4ad4-9af7-5db8aaf735a5	gestire la selezione del bestiame da allevamento
bf176dcf-d1d3-4cd8-b08c-8a205425b415	selezionare i punti di agopuntura
beff134e-9aa1-4b13-853b-3d2b8eb35c43	Oracle Data Integrator
bf22ce41-f1a4-46e8-82cb-71b3e264d445	ricercare fonti storiche in archivi
bf2bd5c4-ae57-4af7-8e61-c9bbb423543b	gestire la ventilazione della miniera
bf295ea1-e1a7-409f-9154-e688eb2f43f1	creare un piano di sicurezza preventiva per il negozio
bf3a2982-e2dd-45af-9c69-faf0e598fcc2	effettuare la manutenzione delle strutture del centro di incubazione
bf3832f8-6178-45e1-9ad4-7973efbbee73	gestire i metadati dei contenuti
bf4626d5-dd39-4aea-b1cf-b6d93153a2f9	regolamento relativo allo scarico di materie prime in mare
bf45cd9a-e1b1-4349-ac29-264938847bbe	SA8000
bf44efcf-238d-49d4-a7c9-792b49f2b12d	supervisionare l’intrattenimento degli ospiti
bf41f7e4-12a5-4391-a85b-4caa7b94881b	posizionare trapani
bf47dd8f-6bda-40f5-becc-3213070858c7	protocolli di comunicazione TIC
bf4e0feb-ff9a-44ef-9941-79270728f523	occuparsi delle strutture del campeggio
bf5290e8-b45d-4459-bc36-ee6607fdeed7	simulazione di rete TIC
bf542705-9721-4deb-9591-ce2443043209	principi di fertilizzazione
bf566a8d-9ab0-4e98-b63d-c986ce09b191	verificare gli argomenti
bf5671bc-e94c-428b-9dd1-22ed7cfe6e6b	regolare gli occhiali per adattarli ai clienti
bf5b7636-0b8b-487a-a8c1-666233eaaa30	utilizzare gli strumenti software per la modellazione di siti
bf5d2f40-f979-4595-988e-ac5ab34698c5	proteggere la biodiversità
bf6320e0-a1d2-4f0b-b79f-135f28da14a4	addestrare cavalli giovani
bf6125eb-a65e-4158-8ac9-d3beef4b757d	fornire tappezzeria personalizzata
bf6472a1-7b7d-45a9-9b8b-7b1172d7843a	patologie podologiche e ortesiche
bf677746-c6b7-4a47-bf51-674d877201b2	utilizzare gli storyboard
bf678c61-f61d-4f32-815f-4a06b9f58b8a	insegnare i principi della progettazione e delle arti applicate
bf6c024e-d899-46d4-aaed-58df6a60ad10	valutare i potenziali genitori affidatari
bf6c29a9-ee8c-41e1-9b50-fdbb5dba7b7d	gestire le giacenze della cantina
bf694ae5-abf4-42ae-a6a3-2e5f16ebf780	offrire consulenza in materia di paesaggistica
bf6c9324-3bc9-4425-98cb-e53f6fd531c7	gestire un’organizzazione sportiva
bf6ef291-0ed5-4dc9-b91a-597c22a00f37	eseguire prove di stress fisico sui modelli
bde5c0cc-41f5-4b45-8748-25135081d4e7	gestire i prodotti sensibili
bf7bf553-b8e6-41b0-83f5-f4868ece9c5f	monitorare le operazioni marittime
bf7058b2-51f9-4b53-b1d3-d1e059183559	improvvisare la musica
bf84c796-0863-47ed-8949-1c95b725a465	centrare lenti
bf70e125-e38b-4c70-90a5-366bebe7919a	assicurare la conformità alle politiche
bf844fa9-2b39-4745-8865-6b0f8d07380b	impiegare le strategie pedagogiche per facilitare il coinvolgimento creativo
bf87b798-41f7-4d18-9c8d-06aff56de484	rispettare le normative agrarie
bf8c7de6-89a6-4389-a25b-760e4b5ee9f3	guidare le macchine agricole
bf8cbfbc-b849-4feb-a8f0-7045d280808a	attaccare i cavalli alla carrozza
bf91dcd8-833e-4281-94e5-c9bebce0411f	rivestimenti per il vetro
bf963bec-ba50-4216-907a-6935bc6528bf	correggere movimenti potenzialmente dannosi
bf9337c5-1842-4e7a-b649-ff5b282adf6d	informazioni in materia di competizioni sportive
bf9ab8a8-5c35-4c77-8eb7-910eb0cbe35b	ucraino
bfb44637-4655-4b75-9d35-4f42df22dbc8	applicare il concetto di uso flessibile dello spazio aereo
bfb102c2-3e56-4f31-8ce3-fdef01421fb7	assemblare i fusti
bfc3d3c1-8b29-4f64-8768-38344cfa6147	sorvegliare la soffiatrice
bfbeb484-d4e4-486e-9669-6274b5b509a8	valutare gli esiti clinici di interventi di igiene dentale
bfc9a5b7-238e-4977-b78b-bd8b57a1ac34	produzione di imballaggi in metallo leggero
bfa49418-3edf-4a38-a546-663dd99cb8c8	indagare in caso di reclami dei clienti
bfc94c1c-fa97-4bb5-84e9-15338f33305f	elaborare ricette di birre
bfc9f278-c0fa-42a7-8921-85afa859e96f	utilizzare un escavatore a ruota con benna
bfb706b7-9082-43b3-8cc0-e93b1fe3a903	manutenere le piastre di stampa litografica
bfd6e135-0529-4870-a33a-6f175810ec28	utilizzare setacci per spezie
bfdf331c-c6d3-476e-a553-3515abdd5fa3	azionare le barriere ai passaggi a livello
bfe00b57-7820-4a35-8779-755c3e45d639	cooperare con il personale adeguato per stabilire la merce da esporre
bff08da9-4952-40d1-b17a-8a49aea9d2c6	inserire rafforzamento nello stampo
bfdd737f-2490-4d8d-9200-bddea7ddf45d	stimare i costi di installazione di dispositivi di telecomunicazione
bff9f2a0-d8fd-48ed-b08e-35e19d662439	utilizzare la lima per la sbavatura
bff0dcbc-9d02-4d58-9a89-8ba5be2e5eaa	filtrare i vini
bffd411b-12c2-4d47-85f8-ba5603754281	utilizzare le tecniche di illustrazione digitali
bffd9dc3-ee72-4c72-84a9-d49944616bef	tagliare l’argilla
c00dea6a-4d6f-43cb-a36c-faeafb7a6cff	criticare altri scrittori
c010aee7-cdca-49ab-b590-78decaeee07c	contribuire a chiarire come interagiscono i vari componenti dell’opera
bfffd9f8-12a5-4671-bc99-9e4104aece51	sviluppare una politica alimentare
c0136fec-d540-4860-ad91-0595e0602abd	controllare le richieste di sovvenzione
c0111b68-ec03-426a-9068-a49ca836fb30	fornire assistenza nella ricerca di lavoro
c013cabf-e4fd-45c1-9b92-c05ad628a13f	linguistica forense
c0171ffc-4ae2-42a4-8eff-b2ce6ad35dcb	gestire gli studenti di ergoterapia
c02193cf-3313-4dc0-905c-1b722a357c12	progettazione della casa energetica
c02d3e03-8483-4098-a524-8efb025ec924	assemblare prodotti
bfcd7b59-f518-41d4-a485-5e88ff0ad390	scienze della comunicazione
c0307069-0c95-45a5-a74e-8a3a8ebc6a49	tecniche di promozione delle vendite
c01951d6-e6a6-4afa-b61d-49bf00fa0796	attrezzature agricole
c0234542-f9f7-497e-8888-2b55fe607749	rispettare i piani di fornitura dell’acqua
c035d8f9-404e-48e9-aee6-d25222a4b051	biofisica
c03c2a5e-3d56-4348-b587-3038cc04d645	utilizzare le attrezzature per la paesaggistica
c0486c51-e9d1-4fb8-b545-58c61d243ab4	impostare un robot automatico
c04426ea-8ffc-4e32-83de-15961d185fb2	chimica dei polimeri
c03e488d-1db9-497b-98ac-5bdc2a119dab	microbiologia del latte fresco
c039dbce-7fa8-4740-a3ca-37ef640fb5ac	preparare i programmi per le mostre
c0407d62-4672-45f5-a68d-3ea79c5cfa60	risolvere i conflitti
c04c1f77-8b56-4739-af65-834b368ccb19	instradare la corrispondenza ai vari reparti aziendali
c04cc704-6db3-4fc2-b170-e933536062c5	allestire attrezzature per la produzione alimentare
c059358d-e596-43e9-9054-f5899bc44147	storia delle acconciature
c04e3019-48e9-4c51-8ff2-4201892a0c21	vernice industriale
c05ec2d1-b242-461b-9c27-67d0fde993d6	preparare un kit di emergenza
c05c9eea-d004-43a9-862a-9038c96b0a14	creare relazioni con concorrenti sportivi
c060c50c-fc52-4055-bbe0-91d5ece5b3b7	interagire verbalmente in russo
c0629616-d447-475a-b7f8-09cc8ae9f6b6	favorire l’accesso al mercato del lavoro
c06cca45-1f7c-4e14-99fa-0304e7404366	fornire assistenza ai fruitori dei servizi sociali con disabilità fisiche
c06b3ebe-63cc-4e41-b30b-ed50bd1c3e39	elaborare strategie di comunicazione
c073ffa1-fe3b-4161-9876-142f6e895afe	approvare la progettazione di aree di parcheggio degli aeromobili
c075fc7d-1a94-4dcb-8bed-6dae3091f261	ambiente operativo aeroportuale
c0779cda-03ee-4818-b3d3-5ff599ecf4a9	trasferire materiale audiovisivo non tagliato su un computer
c076d966-7857-4968-bf91-3942e0668ea1	controllare i pazienti durante il trasferimento in ospedale
c086653b-c68e-4d37-ab82-2b7f3dfb3924	azionare i rulli
c084d250-6288-4318-b5c8-0e87a24ca032	previsioni finanziarie
c0a0a553-f591-4b38-a822-f91930e154dc	guidare un elicottero in condizioni di emergenza
c0894176-cfa3-4c00-9b75-4fed841e20c1	utilizzare una stozzatrice per cartone ondulato
c0a210c5-0250-4b21-91c1-57c47e234e47	verificare le spese del governo
c08771ab-1d15-47f8-a0ba-feeaa145c7e5	consulenza centrata sul cliente
c0a7a7b0-feb2-4f0c-b13d-48621c66d5e4	scattare le foto
c0b855df-65ad-4e0d-b558-f43664a85ade	sviluppare i programmi di lavoro
c0c0e98b-7bd2-4557-a012-14ca28a6656f	progettare imballaggi
c0a7f474-1cec-439f-9832-2849cf304b9d	applicare le competenze matematiche
c0cabcf0-b8a7-48d5-b230-0c2224cb0933	creare il wireframe di un sito web
c0b5a25f-cbaf-4842-b304-02c646dfdd84	offrire consulenza ai clienti sulle opzioni di finanziamento per i veicoli
c0d05ef1-66d5-4c9f-af1a-4d4b0a3c1b04	tagliare digitalmente le sequenze filmiche per il montaggio
c0d63f85-ce11-4fb1-a250-41510df92a05	pressione dell’acqua
c0d8b6bb-4194-4e34-ad18-2d80b8911175	procedure di odontoiatria estetica
c0e1e0cf-b06a-45a9-8b9c-33ca51d37cd8	gestire i test
c0e4da55-fe6a-4ecc-ab78-d333667dc174	manutenere i macchinari di montaggio delle calzature
c0cfe2d4-2c27-4302-b6f2-b08f1398ed84	preparare le attrezzature pirotecniche
c0d7cac2-099a-4391-9918-6aa9ea4ff454	controllare i parametri di lavorazione
c1020fe1-d41c-4c9c-9b66-012e2abee9f2	convertire scarabocchi in schizzi virtuali
c0f85a15-12d8-48da-b1cc-c5c666819d5b	vendere i prodotti lubrificanti di raffreddamento per i veicoli
c0e5e807-bc59-491f-ae16-8c0b09c7c540	redigere una relazione di classificazione delle pietre preziose
c10cf0fa-9ef8-492a-9b6f-a93c2742af46	elaborare strategie di trattamento dei pazienti
c1087aa7-3ccf-41ef-b25a-2aaa420be0e3	dispositivi di commutazione
c10ddf27-6e77-4a98-bb40-f0c42e881ca7	tecnologia di finitura dei tessuti
c11acbc1-b946-4878-9a98-fcc2a866c68e	controllare gli odori provenienti dalla produzione di alimenti preparati per animali
c1257356-3b36-46e7-a12e-9e340a4b9746	immagazzinare il pesce nella stiva
c116205d-5235-42ac-a047-7af8388bd341	manutenere l’apparecchiatura di perforazione
c1274c42-ae66-4b5a-a032-cb88b14ff2b5	interagire verbalmente in polacco
c12d3428-1c3e-411c-8ef8-5a75d03ffb11	usare la programmazione funzionale
c1304f7f-c814-4d53-a582-b46ec7c02d09	scrivere in ucraino
c1361894-83ce-40c1-8787-46502a09e69c	spazzolare i tappeti
c13250f6-7055-4971-bd8f-9f2e66b14da3	rappresentare l’istituzione religiosa
c13945bd-5d34-42ba-8244-8c3df6816f5b	levigare parti di gioielli grezze
c132dc0d-3953-4a02-ac70-f0c168b22a8f	studiare le tendenze nell’artigianato
c144a614-917a-48e1-abfd-ee061bb1c693	effettuare un’autopsia
c14bddc6-a469-44c3-9717-8a3cccb10588	verificare le entrate del governo
c14d35aa-0050-4724-8133-1185629fbb5f	storia letteraria
c157b1e6-c7f4-45f3-a491-85224718bcba	riesaminare il piano dei servizi sociali
c168f699-52c8-484b-bb10-e00e33069d4a	requisiti giuridici relativi ai servizi mortuari
c169f759-86ea-4084-8cc1-9add2e84dfe3	esaminare il neonato
c16e0682-d731-40d1-b672-67b3f63b50ee	tipi di cere
c13eb0cf-1d9b-44b1-a183-80bd43a1b5a6	dirigere un gruppo artistico
c174b234-2c4e-4ecc-aa81-6eaa105ac5cd	pedagogia sociale
c178a23e-c9fe-4c55-9009-1663655db24f	interagire verbalmente in inglese
c184c446-93e5-4d1c-a77e-caf87f6c614e	installare le coperture metalliche
c185a537-968a-4c90-bfcf-713f8b208c6c	sterilizzare le attrezzature mediche
c18dc800-da24-4901-b562-2778c5d2478b	tipi di vie navigabili
c18add1d-0c55-4919-a61f-3f80f3e41aa2	strutturare informazioni
c1984355-6aa4-490e-b51a-eb2a602b124c	utilizzare apparecchiatura di distillazione
c181397c-b097-4192-8e5c-2d66acc53fbc	mantenere un archivio degli interventi di manutenzione
c198afc1-2a8a-4867-b33d-884f77efc87c	eseguire la conservazione forense di dispositivi digitali
c199e4af-769c-49dc-93a7-f76f112ed10a	eseguire istruzioni di lavoro
c19b168b-e258-440c-b76b-4e01d80cf561	gestire il caveau di una banca
c19ddc16-2a9a-47e8-a289-4d5fbbd47966	gestire la localizzazione di software
c1a8a4b4-6a85-4348-8448-268cf205877c	diagnosticare le malattie dell’orecchio, del naso e della gola
c1ae9e19-a691-4964-b0e3-786fdb57e170	installare il sistema operativo
c1b4ab88-37c8-47cb-887c-1ec91b32bdd9	principi di pratica paramedica
c1b36963-b061-4774-9809-4468270f1940	istruire il pubblico
c1bd39e5-467e-4a99-b4c5-500760e5af8b	redigere specifiche di progettazione
c1b399ba-2d68-4e9b-9d15-294a435e0028	utilizzare macchinari di ispezione ottica automatica
c19e510b-97bd-4906-bacf-a94f195fccd1	controllare le sostanze chimiche ausiliarie
c1bf01ab-f476-4257-ab83-bc4870bc5856	pagamenti tramite carta di credito
c1bf9a56-9f98-4c73-9125-ce37ee29094c	elaborare le relazioni sugli infortuni a fini di prevenzione
c1c51742-aa8a-4922-aa2b-7cfb37218022	tecniche di indagine
c1c1de40-d4a9-495e-9e8f-dcbc2d0c07ad	gestire le attività agrituristiche
c1cb17c7-c819-49e0-b3e8-6061a3237d98	paleontologia
c1cd2234-eae3-4776-bb08-28c087ae0a42	controllare la manutenzione dei terreni
c1d4dd4a-4957-4608-a93f-61b42a9f15f5	interpretare i dati geofisici
c1d6661d-2257-457c-8478-ced7d2605a89	applicazioni di vernice
c1e097d3-f71c-419b-8e92-04da5783145b	preghiera
c1e36b8a-df82-4388-a57e-8f34b08f5012	individuare le anomalie
c1ed07c5-5ec6-4c29-b2a9-8c7373bb4efa	sviluppare i progetti di sistemi audio
c1f584d4-a4e4-450e-9f44-46c988a2c2c6	supervisionare il controllo di organismi nocivi e malattie
c1f7efda-2d18-4772-b1b1-c4fa2b5a58c2	incastonare le pietre nei gioielli
c1f966c0-93ed-46e6-8c33-ed60fe015831	posizionare strumenti di lavoro essenziali
c1fd7ab8-77e3-468a-9a82-a65e50bdbd60	conduttività termica dei metalli
c2005019-1cdf-447e-8bd2-3ed6db6e6ad8	analisi del paesaggio
c2000682-bba3-4b50-ad34-1ebecd717014	rispettare le norme sulla sicurezza e sull’igiene insieme alla normativa rilevante in merito al tema alimentare
c208da12-d953-4914-8a87-46d9c8011ef5	utilizzare i sistemi di verifica dei trattamenti
c20305c2-64cf-4a33-9f9b-140b97e20bd2	controllare la conformità dei parametri ai progetti di costruzione
c20515f2-7324-4747-9a1f-a39eb6c14d48	documentare le interviste
c212c81b-168f-49da-b35f-7ab2bbb4caaf	completare la lavorazione delle fibre sintetiche
c200599c-b981-4854-a412-123b1f44b66e	interpretare le immagini mediche
c2149494-b599-4647-b272-d92359a6e80d	identificare i requisiti di legge
c21a810d-2b9e-4b53-99a7-4b31d8033e9d	interpretare testi tecnici
c21ac3fb-a441-49e0-be46-fdc7de3f670d	pianificare voli di prova
c21b486e-6a2d-483a-955a-50defeb338b4	gestire le operazioni di accoglienza
c21fe27c-c784-438b-a525-44e6861f647d	tagliare i mattoni
c23118f6-23aa-4a50-a66f-232798a32155	preparare i carrelli di servizio
c22398de-c79a-47df-ab76-4c698b09a913	pianificare il lavoro di squadra
c22aa6ad-28b4-48bd-8d40-4a8044cc30da	seguire le istruzioni di controllo delle scorte
c22d8c22-8af4-49a2-9cf8-cbbaf2fa864d	scienza attuariale
c22351db-3110-4440-a9cc-030c74b2ea5a	far fronte a circostanze gravose nel settore della pesca
c2320422-f532-4a9c-b663-4b52bb6de8be	interagire verbalmente in finlandese
c24c72df-2831-4d39-8347-e6e754cf66d7	scavare fossili
c2345a73-dbd5-4c15-b501-a777ad7515e2	stabilire le politiche di utilizzo
c23e770a-5ce7-4345-a8a9-6a17dfbda5a2	gestire il portafoglio
c25a9522-c970-4e4d-bedf-0a02443a7b7f	consigliare il direttore del museo
c265126f-f5f3-48fe-9634-6294896cc76c	ingegneria di potenza
c0a4b23c-22c5-4b7a-b0a1-3784dc345c29	caccia di animali
c26a4794-a8f6-402a-b1af-2ffa8fa25e70	elaborare orientamenti di produzione
c26f706c-52c3-459a-937a-1410d4c8b42b	effettuare la manutenzione dell’attrezzatura dell’aerodromo
c2719200-2e79-42e5-bced-52bd98078256	supervisionare i sensori e i sistemi di registrazione del velivolo
c27fa5b0-3d0e-49e7-87a1-f12dadfaa988	determinare il valore di rivendita degli articoli
c2844390-d38b-4571-8542-f4fdfa076e26	patologie trattate con l’agopuntura
c27238ba-038a-4cb6-9e81-6038e0f3d625	fornire consulenza sulle violazioni del regolamento
c284d299-d88d-4cc6-860e-fdcc4df8aa4d	regolamento relativo alle aree sterrate degli aeroporti
c289e4df-7f2b-4fe1-8203-6aa201af2d45	organizzare le prove
c28a246f-df18-427e-85f9-ccc2e84785c9	trasferire il sapone viscoso
c28f9285-966f-42e9-af5a-0864ffb95d85	effettuare ricerca sui miglioramenti delle rese agricole
c2881147-861b-471d-a6e8-b9871578cf51	rispondere alle chiamate in arrivo
c285aa80-ba58-47b1-84ce-1f5dea92cdbc	fornire assistenza pratica nello svolgimento di campagne di marketing
c292e3b5-24ce-4399-b5f5-575ee1e2d1ed	verificare le attrezzature per immersioni
c2938990-17f6-4903-a0e8-9c0745a9dca9	mescolare la colla per la carta da parati
c2a1d921-d37d-41eb-8247-389ccbe9bbc7	utilizzare il neuroimaging funzionale
c29e6a2d-cdd5-4741-9ea6-a9d51cd23195	tipi di piastrelle
c2b808ae-7625-4b1e-af83-cf48bb570cca	tagliare foglie di tabacco
c2bce3b5-9aea-4f43-9066-e771e268f0de	stabilire la priorità delle richieste
c2c2373f-5717-409e-9a71-bc34d84353bb	progettare strumenti musicali
c2ccfff3-b04a-4b64-b4fb-04439a4b3b62	tipi di chitarre
c2c7b720-5cbf-4355-be47-a8d4cd3be0a7	azionare un’asciugatrice
c2cfaf0f-6d26-43e4-8dec-18484ad41e11	sviluppare i piani relativi alla dimissione del cliente
c2e1af89-1dca-4828-b731-0b4047a3bde8	interpretare i risultati degli esami medici
c2f98be0-8fce-4ecb-bfa0-691b6334f7e4	fauna selvatica
c3070d66-fe6e-406b-be82-58fb106ca9f2	effettuare le transazioni finanziarie
c2fa5575-fd44-433c-b7aa-2a9eab6f4d26	stoccare rifiuti differenziati
c303225d-82ee-4326-8b3a-52063fb603c1	fornire assistenza per la nascita dell’animale
c304c6bf-0b8e-4ebc-935c-224aff60bba6	interpretare le foto aeree del legname
c30b6889-00ec-44a9-8d77-1a6d5a829d0f	coordinare i sostenitori
c31043c4-8726-4fcf-aced-7daab22d858e	sistemi elettrici utilizzati nel settore dei trasporti
c311636d-12c1-45fe-b8f3-71ab965ea050	ritardi nello sviluppo
c3137ceb-2a4c-4a03-8998-eaa3e2d1c85b	essiccare il legno
c30bbdba-a419-44e4-94f4-8c5970978d74	disegni tecnici
c2f26684-e7a5-4d68-af1d-4adb36cd2c9b	comunicare in modo professionale con i colleghi in altri campi
c33523b5-4c0e-47d3-9cda-91a06c69df68	cercare di conservare la composizione dell’acqua
c319ae5d-5bef-4318-831c-909d293522e0	ideare concept per videogiochi
c32bb971-1db6-48ac-874f-2ec15beab23c	insegnare a gestire una casa
c33740ab-9809-48c1-8438-480bdeaf4fb6	eseguire gli ordini di spedizione delle parti
c336a5a0-bb46-4744-89a3-9dc29a1d21fd	fornire documentazione sul collaudo del software
c33c5dd4-81a9-49ca-a2fa-86750ff97d51	fornire documentazione
c35ae238-d082-4c86-b06d-f41cdb75f808	adattarsi a ruoli diversi
c35dbb12-b5d4-4025-88ad-7968da8fbcee	legislazione europea in materia di antiparassitari
c34686a8-2067-4728-813d-c8ddcc9e12c6	comunicare i piani aziendali ai collaboratori
c34bae02-c933-4d7e-8cf8-75da615555a3	analizzare le informazioni della banca dati di gasdotti e oleodotti
c3672903-8323-4382-953a-caf761f9d86b	verificare l’elenco dei partecipanti
c377e4dc-5c2c-4ea3-9a7b-c055df528dc2	gestire l’habitat
c3712fea-8726-435e-95ab-664fc52a554e	estrarre i prodotti dagli stampi
c37e1ce2-3a87-4201-af89-443ddbcf69ba	collaborare a fasi di processo linguistico
c36b17c5-249d-4a56-b102-2eca330f37a9	comprendere l’albanese parlato
c378da5b-d4a5-4e82-8358-711bc6db6d97	mantenere lo sviluppo personale nel contesto della psicoterapia
c3a32867-74fa-4d9f-8915-fa9d072dc604	manipolare l’acciaio inossidabile
c38c0e6e-7189-41bf-a4a5-a168732cb71b	gestire il tempo nella produzione agricola
c38d159d-c8b7-4abf-8a55-83bfd10acc8d	parti di pressa per forgiatura meccanica
c3a3cbc1-9e86-4a0e-9701-f4532e5ae005	collaudare semiconduttori
c3a1c8bd-cf01-4aa8-96db-2fdabffae6bb	creare una relazione finanziaria
c3a96a19-c1a9-4ba3-b7b4-a6190b1fcb12	creare protocolli per lavorare in sicurezza
c3ae4976-108e-491e-a8b3-0dfd7cc9d4ed	approvvigionamento di apparecchiature di rete TIC
c3b2293e-609e-4a49-baf5-7c60f8b68593	preparare una sessione di allenamento
c3b44ad8-80f2-4f9b-a31d-1fb1983da50b	trattare disturbi endocrini
c3b45e8d-97eb-402e-80b4-79db2dc48d54	processi farmaceutici
c3afa36d-19af-4b27-8f92-0e5162680e81	effettuare la manutenzione delle attrezzature
c3b05122-a4cf-4f8c-a61f-db41446baa4a	occuparsi dell’assistenza clienti
c3b55533-557f-4743-bd18-c6e835cda078	costituire le équipe di un’organizzazione sulla base delle competenze
c3b6c6f4-d2e9-4a0f-85ce-95174ebb831e	materiali per la progettazione di interni
c3b673a5-ef52-49ce-8616-70a43a9062d2	posizionare le cinghie trapezoidali sulla macchina rivestitrice
c3bb3640-a040-47e8-8e3b-edf1d420f188	produzione di diversi pasti pronti refrigerati
c3c2f372-0ebe-4a97-a019-537596488e49	controllare le risorse finanziarie
c3ccec62-8808-4a51-b4db-a8030dbadc9c	lingue straniere per le carriere internazionali
c3c9fbb2-c08d-422a-a712-75910d083dc4	formare il personale sulla garanzia della qualità delle chiamate
c3cf614a-7808-4422-be71-2e387cae6a9e	posare le tegole a innesto
c3d23930-bfd8-4a20-9dd8-156fb767ac34	vendere i biglietti del treno
c3c8e892-0207-4045-8132-054cc85cf73a	ispezionare le operazioni marittime
c3e92d0a-fbf5-4508-a268-a29b19317b58	tenere un archivio dell’interazione con il cliente
c3e720e1-4d48-4412-96ec-9db6f3586811	monitorare i costi della miniera
c3de14f8-d447-4b3e-be0a-f610a4c96b8f	processo di stampa 3D
c3eed659-7f00-4e88-a869-352cc6f9b18b	valutare gli studenti che svolgono lavoro sociale
c3fc7808-42c7-42e3-87eb-8befe92742a3	sviluppare le strategie di irrigazione
c4020b5d-1d1e-420f-a27f-ce1dc33338fc	coordinare le cure
c4046d37-92a7-45af-abaf-3b55132383ce	scrivere in berbero
c4125176-2a0b-4fde-8bf6-3f55cc43c1dd	usare tecnologie di macchine per la lavorazione di tessuti rasati
c412a93e-34b3-4f47-86f6-a04f308222ac	essere addetto a macchine rettificatrici cilindriche
c41f3379-d1fa-43e7-868a-61d3d7f55b81	comprendere il telugu parlato
c3ea6371-a63b-48f9-bc35-e4a305267f48	rifinire i bordi della moquette
c426abfa-ff31-4c61-a01d-2084c6924f5d	motori elettrici
c42831fc-6519-4825-ba47-743f8820b619	radiodiagnostica
c428d700-e59f-4e16-91af-f7399bc5defc	sostenere le vittime minorenni
c43004b0-fef1-4fd4-bff8-7f1d3191a942	botanica
c430c248-6ac6-4a1c-9a0d-32aede878d9a	gestire una piccola o media impresa
c4258154-a283-477a-8489-32156990670d	fornire consulenza psicologica clinica
c436e22d-5da3-41fe-a6ea-559e02efe83a	teorie psicologiche
c4403371-b150-45ad-a11a-d936f759baa5	metodologie di progettazione software
c42fcd4c-fb3d-4982-9fd9-2ed6b48c3088	manutenere i fusti
c4490b52-4b2a-4f7f-9153-e6d6cdb48bb5	preparare le uova e i prodotti lattiero-caseari da usare nelle pietanze
c447dc3f-e38c-4c7b-b508-edc3a28dc487	effettuare la manutenzione degli impianti elettrici del veicolo
c44bc887-3da0-41b5-b043-bf7f6fc98918	politiche dei trasporti
c44f2cb8-d3c4-496a-b11d-380bebe3accd	tecniche di barberia
c4554f4c-290b-4050-9a95-d3056bbe26b8	posare davanti a una macchina fotografica
c45541a2-4c78-412f-b833-2dba4adbe680	individuare gli errori contabili
c458377a-9727-4872-849f-47170f9d6d35	eseguire la gestione di eventi
c4579cbe-c5bf-45a0-9703-1f355e60c347	formati multimediali
c45b8e49-b492-4cb7-a69c-316c11022af4	azionare i veicoli a fune aerei
c46014b7-569f-4620-bae7-4707a63c8b4b	rimuovere i predatori
c45f4d07-9c4e-42b3-80ca-d330e990e757	utilizzare lo scalpellino
c45b708d-ae53-420f-b770-aa430ac90ef6	gestire il cambiamento
c467eccf-d011-41f4-b380-3bb7242c8b91	vendere i veicoli
c4609c37-442c-4cdb-87ee-6cf009812733	tipi di chicchi di caffè
c4695ac1-49d0-4cbd-941b-60ef298a916a	adattare la pratica al contesto delle cure d’emergenza
c469cd6a-136a-4bcf-8239-c3b920949278	raccogliere le colture
c4773032-8061-49cd-b0c3-1e9c35473562	procedure pre-volo per i voli IFR
c470c4f0-b90e-4bcf-9a6f-4edf21f8db89	lavorare con i veterinari
c48834ad-81f3-4de9-be55-a72293410621	utilizzare i sistemi contabili
c486d44a-c534-43c8-b7e2-bf219c59065e	controllare il processo di essiccatura del prodotto finito
c478135f-d9c3-4769-a685-48d2be6add65	tenere un archivio delle transazioni finanziarie
c47f2ce0-99c6-4d54-aa46-11921d2c553d	effettuare la manutenzione degli strumenti odontoiatrici di laboratorio
c475c1f8-3698-4fc6-800f-904ff13ff01f	mantenere la qualità dell’acqua della piscina
c48834b0-dda8-439b-84d5-2094d03b3c44	spiritualismo
c49eb735-25e4-4779-8fdb-ee66f1ccead9	installare motori per tapparelle
c4a42ce7-51d7-457e-a18d-44dbaa863c10	fornire educazione sulla vita familiare
c494f2c8-d01f-43fc-9845-4b7df04389a7	utilizzare le lingue straniere nel settore alberghiero
c4ad4b91-02b5-48ff-a4e0-621e5f731c20	promuovere l’educazione psicosociale
c497c0cb-3ced-49c4-8b43-4fd1139c34e5	diffondere le informazioni sui voli
c4afcb2e-6db9-4a65-9e45-a75198280693	prestare assistenza nell’esecuzione delle ispezioni di volo
c4cbfb2e-7b8f-473d-bb2e-82eaba23f193	calcolare le quote per le scommesse
c4c0b7ae-cdc9-4158-8f00-88bf02864cf2	maltese
c4dc09fc-2ac7-4eaf-9c2d-9e7f2caf4083	partecipare alla manutenzione della vite
c4c2202a-4aa5-4d4e-9b57-69800160bfab	costruire i tetti di legno
c4caa3f2-0117-435b-802f-9138877b4f7f	offrire consulenza sulla preparazione di alimenti dietetici
c4cb7439-dd37-4f7d-8d59-16165c2e8c1c	fornire consulenza sul consumo di energia elettrica, gas e acqua
c4e11516-3190-4446-b2f1-1fc0735a487f	somministrare l’immunoterapia
c4dd94d9-88fe-42f7-b04e-ac71acc53a91	bioetica
c4ec502a-df74-42a6-bb30-cd0352e52e2b	gestire un archivio
c4e27d86-1b43-4a34-aa89-4fb43bf1a7b2	negoziare con le agenzie di collocamento
c4f6318b-b54b-450c-8db9-a3d9b4fc1fe6	elaborare programmi di intrattenimento
c4f47609-e3be-4d6b-ab35-99947c7fedc3	utilizzare la vendita incrociata
c4f7f619-1004-4a22-8943-fb1e9309b8b1	gestire il bilancio di una unità sanitaria
c4fcc914-c822-459d-a607-5de718cbccae	condurre una ricerca sull’assistenza infermieristica avanzata
c50151df-5a68-44bb-b1a3-be7b6839641b	compilare elenchi di biblioteche
c4f32346-2157-493d-9aca-e9ec40a433d4	gestire il rischio clinico
c5192225-5a0b-42ee-a09e-b5866dc0c000	paleoclimatologia
c519f877-a9bc-4ca1-8611-73f58704d4ff	norme sulla tassazione degli alcolici
c521909d-851e-44a8-a079-7d5f895439d3	eseguire la manutenzione sulle locomotive
c5261a5d-902d-461f-a12c-c56d3113ad0c	lavorare all’interno di comunità
c5409b14-ad0a-46a9-b76a-a83e3661ef50	analizzare i piani economici
c5017c74-9794-49eb-a73a-fb6f4e4fca6c	lavorare con un gruppo di sostegno nel programma delle attività artistiche
c541bf1e-6b73-48ff-a75e-d83a506913d2	applicare le procedure di controllo della segnalazione
c51e41a8-89c5-43c8-a8fe-d68657b04130	gestire le scorte di risorse tecniche
c5425555-2373-4b76-ac10-6b74e834f8f1	verificare i disegni architetturali in loco
c54e025e-2a17-4e27-aae7-204cc0e51bb5	acquistare macchinari elettrici
c55374de-f472-409d-9fe7-87812aefe04a	caratteristiche del caffè
c55667b9-e0c9-4e9c-8f6d-6ff8de1bae67	supervisionare l’instradamento della spedizione
c5501d3f-3e6c-47f5-9478-f7fa1883a4c2	riferire in merito ai danni alle finestre
c55d4dfc-3627-457f-9f83-583c626ca188	gestire l’inventario di un monte di pietà
c5525115-9e7e-42be-a12d-137d9127884b	utilizzare i sistemi di archiviazione per applicazioni di magazzino
c55e46e1-da4f-4d0d-b551-655e71957d38	bruciare i fusti
c55e0c3c-edc7-42e0-bd68-05bd99718c0e	mantenere l’archivio delle sepolture
c563e97b-66fd-4644-a64f-d142c73095af	correggere i dati
c55e9205-faea-41fc-baa2-57817af40544	essere un modello nelle attività artistiche
c571cbc8-e510-4aa4-aae5-80cf9e0eba0d	eseguire le modifiche al telaio
c57d0880-2916-473b-ab5f-31bf1bae6bc6	utilizzare gli strumenti ortodontici
c5748138-44ec-4d22-a31a-a72f11130f9d	supervisionare il trattamento delle acque di scarico
c5689839-38a1-487e-9cc8-5940bc60501d	seguire pratiche di lavoro ecosostenibili nel settore veterinario
c58322e1-19f4-47cf-a1ff-2d562697be7a	utilizzare attrezzi manuali di rivettatura
c56abba9-a044-4d3f-b3d1-0354dce51fe5	pulire l’area adibita alla preparazione di alimenti
c5984ad6-669d-402e-aa7b-6ddbeceda994	valutare le relazioni sulle interviste
c58ab894-1178-41e2-9434-17f832388cff	mescolare i cereali in base alla ricetta
c59f1f58-24a0-450e-9c84-666961882bc7	lavorare sotto supervisione in un contesto di trattamento
c58f1b0a-580c-437f-8a30-3ff028f452d3	ispezionare l’eventuale presenza di danni in giochi e giocattoli
c5a24b64-3e8b-4119-8edc-3610423cf18b	progettare elettromagneti
c5abd75b-d90a-44ca-b8cc-4543a4e2ef25	prestare assistenza per la navigazione
c5b2c0de-f8dc-468b-97df-89e7a26ddf6a	gestire il sistema di controllo del processo di dissalazione
c5acf509-f3b0-4eeb-9fe1-808c280e68df	pianificare il processo dei servizi sociali
c5c2b070-30d9-442a-9645-d2c6d467b2ac	insegnare geoscienza
c5b3e2a6-c332-478b-aa6b-2770f0730776	acquistare oggetti d’antiquariato
c5ee9e92-2458-420a-9932-af285b436a0c	approfondire le idee
c5f00004-a86f-499c-a388-e0631c303ccd	utilizzare un dispositivo fonditore
c6092599-b184-4ded-927c-540190b0bb80	ricerca e sviluppo nel settore dei tessuti
c6138733-25e8-4f4a-af51-0e37408722fc	amministrare i contratti
c6171527-ea06-448e-af0a-ca42bb6f12d7	installare un sistema settico
c6268d1a-68d8-45b5-84bb-0eec29035668	distinguere gli accessori
c62916dc-25da-4bf5-a908-2c05f545c9c1	gestire i progetti di costruzione dei ponti
c618304a-3cd6-46c5-8cc3-ef40a1972f88	bevande
c5b150fc-7330-4eeb-9a45-9147ec677774	indentificare le necessità degli utenti TIC
c620a7b3-dc61-45fb-b885-d98d6f63b53b	memorizzare i copioni
c6316bfe-2072-4af6-8d46-a4c5cbba154d	assistere i clienti di un centro sportivo
c6317aa1-9464-4f38-90b0-44bb5f8be09c	shiatsu
c629aed5-5773-4e12-aea1-58c7cc919728	tenere un archivio delle prescrizioni mediche per ogni cliente
c6405372-2fee-4eb6-9121-3700f4ded885	comprendere l’ebraico parlato
c6382438-8f45-4d28-b086-682f45bbc0ed	principi di bilancio
c64925e6-1159-4ea5-90c7-8d69a7b80918	coordinare il reparto montaggio per la fabbricazione di calzature
c64e4488-b7ed-44af-aece-29c9a1e53140	eseguire una proiezione
c64e7747-741f-43b5-aa1d-d46d53b8fcd2	componenti di impianti di climatizzazione
c64ef558-59a6-4169-afbb-502e149f722b	impastare la malta
c64aa4ec-753c-4a47-a913-f3cdc3cc42d1	valutare la credibilità del cliente
c64f43f3-0f9e-4887-97d9-f0fbbb9ec4b7	gestire le incertezze
c654b469-e88f-46bb-81e0-5f163f9d68b5	contenere gli incendi
c654fed9-a8a0-4033-b5b1-3f9526d87117	valutare il potenziale di produzione del sito
c65e26b3-cdc8-4d2b-a3b0-0014c823df39	distribuire i pasti ai pazienti
c651e289-de42-4904-bbd2-0b4374117e64	ispezionare il legname
c65b9126-b09f-475b-b21c-8277680cb4ba	attuare la pianificazione strategica
c662e2af-f0e4-440c-8708-0b5e720cc286	condurre un esame di massima dei tessuti
c65ee114-3a41-4d55-ba99-4754563565d9	macinare le pietre per il pavimento alla palladiana
c667b83a-f328-4f67-b433-e95b96a4c5f6	progettare hardware
c66a1234-403c-4f41-a626-e620b5533e92	preparare i materiali necessari per la pulizia dei vetri
c66fa645-e8e5-4675-a584-3fc165008209	custodire gli oggetti di un archivio
c6730d17-3c41-461f-b487-84f79202b565	indurre il cliente ad effettuare i rimborsi
c67419f5-2302-4ea6-acf3-db494e0209cd	registrare i dati delle bombole
c678e2af-4d40-4008-873c-0938ce175720	inserire la ricevuta dell’inventario del caffè
c6799997-01ff-471d-8627-369b535fb72c	normativa sugli zoo
c67431b5-2ebb-4957-923f-19c3acae71a3	diradare gli alberi
c67bc6fc-097b-47fa-b71a-690f495e2352	chiamare i testimoni
c67c7b8f-b5cd-4d93-b79f-8583806ac3f3	creare specifiche di progetto
c68a0782-11df-49cb-8739-daf3b90dcdcd	organizzare le operazioni all’interno della stazione di servizio
c68c5827-8226-4fe5-8ed7-aa77c347ef04	sviluppo fisico del bambino
c680bc7a-70df-47ce-9ac3-7d8caeeeb555	fornire informazioni sulla pianificazione familiare
c6800353-a028-4e9b-a26d-7f670d3f4ca1	prendere in considerazione le condizioni atmosferiche
c691eba4-7d29-4a1b-a97d-c04beb63e24d	eseguire simulazioni di prevenzione
c6943a23-2e33-4378-9e11-4ed6a93f1253	preparare i piani di studio per corsi di formazione professionale
c68e0b2e-231b-4612-91ae-6e23b63754d6	formare i dipendenti
c6a2c136-58af-43e0-88c9-9a47fcd7261c	politiche di qualità TIC
c6a6d38b-a478-4ffc-9113-6b37dc415ce0	tipi di macchine rotanti
c69c6892-4af3-4d4a-ade0-a6cf3f39ccec	disegnare schizzi per sviluppare articoli tessili tramite software
c6a75a50-6009-45af-b489-c4965e2ad7bf	contenere le persone che presentano una minaccia per gli altri
c6ab1851-1eca-4fdc-9243-ede19a44369c	indagare sui crediti esigibili
c6bf711e-cfa3-41f7-a44a-ec5c41811372	installare le linee elettriche
c6c2c3b8-2889-4803-8bd6-6746f308de66	usare la modellazione poligonale
c6c33ce1-8d74-4fef-b51a-bbdab3abb78c	assicurare il rispetto dei requisiti di inserimento dati
c6bcaa06-d5e0-43da-b454-9dba25a3e61d	cucire tende
c6cb515f-9d7c-41b4-ade2-7a5a9e1a110d	demolire i fabbricati
c6c6aa8d-de50-48a6-a068-259f5906f830	essere addetto alle apparecchiature per prodotti di pasticceria
c6cb5481-c444-4487-9842-224b8d7e6794	fornire input ai collaboratori per guidarli nel loro lavoro
c6c692ae-6ae5-4316-b3a4-4c2c4e6f2f61	consultarsi con il direttore di produzione
c5145fd3-bb4d-4201-9f06-05da8d274cb7	Haskell
c6dc31b0-7670-4150-880d-c64a00021b6c	fissare il parquet
c6db71c3-aea5-4917-95bb-cfa7311ffa3a	utilizzare macchinari per la realizzazione di modelli
c6d8ff04-5d6d-43e4-b059-7313d4e40414	coordinare i turni
c6d1c821-0c67-4057-9058-869ed3cc42f2	proporre i cosmetici ai clienti
c6d97a66-9ac5-42b3-9fe5-0c4dd220093d	individuare i mercati di destinazione per i progetti
c6dd90e9-777d-4953-94ff-66495e030363	costruire le chiuse di un canale
c6c3a241-226a-4b6b-92d4-fe6ec255b57c	sperimentare l’uso di sostanze chimiche nei bagni per lo sviluppo fotografico
c6e8aa2c-3785-477c-bc53-89e84f473e58	sviluppare un ciclo di trattamento a lungo termine per i disturbi del sistema endocrino
c6eb6683-2e0f-4ad0-92e9-68bff14b4504	rischi di sicurezza della rete TIC
c6e5c0c7-bb2c-450d-afff-57741927461c	effettuare la manutenzione delle attrezzature per la cattura dei pesci
c6f2c14e-3c37-4a57-be53-6e90fc8e07a0	abbinare gli stampi ai prodotti
c706d8f9-1076-4acc-95b5-19b3cae457d1	promuovere un comportamento responsabile da parte del consumatore
c70621a5-fa2e-420d-a3f2-4832318c8fc3	politiche aziendali nel settore delle lotterie
c6fefba6-1685-4904-942c-e8baa55b3119	verificare l’eventuale presenza di difetti nel materiale esaminato
c709e167-adfe-4a09-a9f8-81ceb2b84fcd	identificare i rischi esterni per l’integrità di un ponte
c70b55fc-8dd0-496a-a59c-8493a2656982	comprendere il kazako scritto
c70d7b87-6d02-438f-920b-70abce1ca082	progettare interfacce di componenti
c70be940-7ca6-4fef-b51a-2c871cc30e08	definire i concetti di esecuzione dello spettacolo
c7142d99-2ea0-4000-af7e-8ba203ead8b9	tollerare di rimanere seduti per lunghi periodi
c712dbdd-84f5-402b-b093-964a7cdc4869	verificare l’esattezza dei prezzi dei prodotti esposti
c7150085-2be5-4e53-9adc-196aba099b2c	contattare gli oratori per un evento
c721e0d2-1083-4331-b26c-0d5668f32e1b	sviluppare le istruzioni di assemblaggio
c7240b58-c466-4dd8-8efa-f6ec5efcbbb0	controllare le partenze dei treni
c723347c-248e-473d-ba5a-91e463aef8f9	segnali stradali
c728be8d-99c3-47b3-abce-c9812f2bd137	riconoscere le anomalie a bordo
c72036d4-c283-43f2-ba2a-c5f69e2d9130	garantire che le stoviglie siano pronte all’uso
c72a6c41-1466-4cbc-ba1c-9c1b8ef19c5f	processi per prenotazioni di viaggio
c7299a43-eb77-4a4c-82ef-d3581b96b397	misurare i metalli da riscaldare
c72c7506-dc4c-46ad-b2e3-e0109da81cdb	rimuovere le scaglie dal pezzo in metallo
c735d3c7-05b2-47cf-b1e4-f75adc3a39bd	dimostrare le procedure di emergenza
c747e1cb-5eb8-44b1-83b4-58deb83192a1	riempire la vasca con ingredienti specifici
c73f50df-4ef5-4997-aec6-b52721217377	integrare componenti di sistema
c7580787-8d4a-4468-8a54-3f20e1f53ebb	comprendere il montenegrino parlato
c76c2603-52c1-402c-80a2-b11ff315a3d9	comprendere il georgiano scritto
c742d619-63df-4302-97ee-b6b6098157c6	collaudare strumenti odontoiatrici
c780cac2-d653-49fb-aaff-1eb2016f0a5e	sgorgare gli scoli
c78fcc4a-ff85-4b48-8145-67e90e390e79	utilizzare gli strumenti specializzati nell’otorinolaringoiatria
c78ad8e1-ad26-423f-99de-ab7621dae224	interagire verbalmente in arabo
c7900b06-bccf-4004-80b2-ad545f0d95d5	posare i segmenti di galleria
c796f4e3-a454-489c-93ec-4a8ac14b1950	utilizzare una navetta
c7a268b7-0784-40c4-b780-901344948623	alimentare la macchina che mescola l’ardesia
c79c3cac-a361-4d8a-8377-2f7db761c4ba	programmare le produzioni artistiche
c79f2c4c-044e-4ee5-8f56-a52bddd71c6d	tecniche contabili
c7acd90a-6b47-4145-8225-fe1bec5597ed	utilizzare cilindri di asciugatura della carta
c7a4d72d-a1fb-4e72-bcb3-606b993c2190	valutare i progressi dei clienti
c7ada921-cdee-406e-bcbf-e223e52f0106	svolgere le attività di sollecito
c7aea5c6-78c5-436b-936e-7ac576dc6271	sviluppare un portafoglio di investimento
c7b0f0b9-7e0f-412a-8dd6-d32e152df6ca	supervisionare la manutenzione degli impianti termali
c7b580e4-ccba-4a77-a11f-436f46f2027c	predisporre il letto di posa delle tubazioni
c7b70b59-ae91-4527-8874-21ad79e85e1f	leggere testi preredatti
c7cab364-d104-46f7-9dde-8624524dfd11	acquisire la licenza per la vendita di prodotti del tabacco
c7bd09e6-8825-4cde-b93b-5a5da0358ac8	comunicare con gli operai
c7cf4b06-f89b-4648-952a-8c0c1cf275f6	istruire il personale in merito alle procedure di sicurezza
c7d3f82f-2eda-4839-a5da-265a02008474	progettare gli impianti per i pozzi di scarico
c7d3f243-52a7-4ad6-857f-f46311c95aa6	creare diagrammi di flusso
c7d6f648-1e3e-493d-a1d7-98eb9e3bc1b4	eseguire le operazioni standard di acquacoltura per la salute dello stock
c7dacbcf-ea27-452a-861e-4683546ab25f	monitorare le attività di manutenzione dei veicoli
c7eed15f-00de-4ce0-bb83-2bebf248749a	insegnare i principi dell’ingegneria
c7fad2ab-facc-4f66-b481-02f8310693c2	prescrivere un farmaco
c7e22048-ae56-4257-bcbc-d902f5c6eb5c	valutazione della qualità dei dati
c7f4346b-dec9-4340-ab1b-9386558e9178	essiccare il tabacco al sole
c8049c7f-1c7d-4ebe-90a9-fcbcf7065cc9	gestire i fascicoli dei sinistri
c80a5d30-ed66-4235-9115-78b876933d86	procedure giudiziarie
c8046744-8232-494c-bfa1-4bfb45d56eb2	garantire la salute e la sicurezza del personale che si immerge
c81102a5-f8c2-4fd9-a3b9-d8e92ed6b24c	utilizzare i dispositivi per la navigazione
c81aaa8d-58cb-4320-9c2e-821ca491dbd7	utilizzare le attrezzature di cattura del pesce
c81a9209-5e61-49a9-9a05-e067b42d267e	utilizzare apparecchiature di misurazione scientifica
c81ea9ce-ebf2-4abb-a4c4-0578ddbfc40e	creare titoli per i contenuti
c8200fb7-ba3e-4fa3-9a8a-5e122cc811fe	programmare il lavoro secondo gli ordini in arrivo
c821cc2f-3ee2-4b69-980d-4da14a80062d	rivestire gli interni dei mezzi di trasporto
c8256431-8f39-4abc-87dd-7139602f2b3b	garantire l’assenza di effetti pericolosi degli additivi alimentari
c8250a78-b331-4afe-87cd-b884251dd24f	fungere da referente in caso di incidente con le attrezzature
c830c039-c008-438a-9a36-e223d78c9354	supervisionare il lavoro sulla pianificazione della progettazione
c83a71f0-ec11-4d2b-9a5f-1401c2d32954	sviluppare un programma di coaching artistico
c83c82fd-24d6-47f2-8ede-2fb286d56780	eseguire test di sistema
c8427574-cd49-432d-8a5a-685e6416a34e	entrata in servizio del progetto
c8439f66-4505-441e-b647-658b69464c90	plasmare la cultura aziendale
c83d5d1c-36cd-4c0f-bdbd-7a14057bc149	pianificare la riabilitazione fisica di animali
c8499893-4f43-4fb2-ac9d-ba1217da08e0	definire confini
c84f2ac1-8c06-4256-8942-19885b9a39ae	fornire sostegno geofisico
c8561843-d0b1-436f-978f-038ce5267339	modelli di dati
c872362e-782b-463e-a31e-21a1168db7ff	definire un approccio artistico
c8781e7e-10f5-4282-8970-b4cc4610d295	monitorare le operazioni di imballaggio
c87ad502-d40d-4bac-87c4-367c4fda2262	pianificare l’assistenza infermieristica
c878c4e4-cd95-4172-bdf3-47fcea78dac4	sviluppare strategie di sicurezza delle informazioni
c87dfafa-b10b-4778-958b-f844c209302e	manutenere le macchine di lavorazione delle lastre di legno
c89598c3-a340-4ead-aa5f-cc09c9ec2f20	riscuotere il prezzo del biglietto
c8a7db28-ad1c-4138-b35b-18b0f8b7eed3	fissare le pedate e le alzate
c8969019-30a6-4e9d-9013-466f6212a448	gestire i servizi di assistenza per gli ospiti
c8a8b8c4-daaa-42a6-83f2-f4b83e188f7c	visitare i fabbricanti
c8a8de41-874f-4d7b-8671-7faff9c891af	preparare le dichiarazioni dei redditi
c8b1d177-66c5-4aef-8491-daa9e8edc363	redigere le polizze assicurative
c8b446ca-9309-415a-b4e8-5e9a86785385	occultismo
c8b8b37d-8faa-4480-923b-f9778751e53a	costruire modelli di gioielli
c8cafc0d-8841-4b9c-9efd-2b0d007e24b7	Unity (sistemi di creazione di videogiochi)
c8d12a18-6d36-4fe8-aadf-cc6d81945ef5	garantire la funzionalità dei sistemi di illuminazione aeroportuale
c8c0d21f-b179-4e53-a295-bd9df13c0fc8	redigere le relazioni sulle ispezioni antiparassitarie
c8d658d2-2524-45dd-8d6f-3817a3604421	comprendere il croato parlato
c8d163e9-2213-4e55-a201-c2b4715a443b	aderire al piano di lavoro del trasporto
c8d2dde8-4a6a-43a1-8b70-d335723fb8a5	gestione delle risorse umane
c8d35a2a-1c28-4bac-b5a7-7aa46dba93eb	sistemi operativi per dispositivi mobili
c8e29e33-d977-4f29-a009-af755096dee6	attenersi alla norma OHSAS 18001
c8ecaa77-859c-4200-aab4-6d34d003fbd7	processi di recupero del gas naturale liquido
c8e33c8f-4d2e-48e9-bfa5-cd5e1884040e	tecniche di produzione delle candele
c8f613dd-7ebe-4576-b6c3-eed20e4dc148	dimostrare l’impegno a favore della democrazia
c8fd7e89-f102-4fed-9bcf-a458f95dcdd7	diritto fallimentare
c907b56f-95a2-47da-a83c-f16a308cb003	rendere identificabili i capi di abbigliamento
c9044304-8bca-4ba1-9948-7e2dd7f1cb1d	mantenere un archivio di informazioni cliniche veterinarie
c90a3ccf-2556-424b-8109-2b98d82a5d04	esigenze delle vittime di reati
c7c036c7-41e2-428b-b8be-43d51056c370	utilizzare strumenti per lo sviluppo di contenuti
c8f4f098-6eb9-4b70-bfaf-a738d2de4874	rimuovere prodotti difettosi
c912d41f-ab97-4f75-a234-9ae7143aa62c	legare strati di gomma
c9113e90-7a2d-4067-830d-bc00047df053	medicina ayurvedica
c90ecd17-6e67-4c32-9612-7772e0063582	attuare la gestione del rischio TIC
c90d4bb2-2df2-43c3-886d-a8d6d16b56d0	svolgere le attività di pulizia in ambiente esterno
c914b83c-9d2f-4d48-9033-b86292c157b7	orchestrare la musica
c915c5cc-1a27-4934-bfb2-2764434bb84d	utilizzare le risorse ICT per assolvere ai compiti
c92a4a42-8b5e-4083-ad3d-d58b3a06eca9	cucinare i frutti di mare
c92ea007-ffc9-4393-bf48-52be6be87e9d	ripristinare il colore naturale dei denti
c943c38e-95a4-4bb1-8e23-fa71a7a7d7df	utilizzare le attrezzature degli ambienti di essiccazione
c93a0efb-f5d0-41e2-9afb-6549a2bad9d5	impegnarsi con le parti interessate in ambito ferroviario
c93c7b17-8a0e-43fd-949c-557f5cf4d037	offrire campioni gratuiti di cosmetici
c94badef-dd23-43d2-a155-b6abd65cdc5d	utilizzare la psicoeducazione
c952716f-7747-4b72-904b-bea61aa5534a	individuare documenti falsi
c94dfdb7-4895-4664-a1de-73a84b7f01ef	podologia
c94ad47d-3724-44ea-8dcc-f1530feb7ed4	garantire la qualità della legislazione
c95de376-513a-4891-895b-bfede04c7c70	rimuovere i depositi dalla vernice
c9698b62-4da2-4082-92e8-22783039921d	versare il lattice durante il processo produttivo
c9549b55-0680-4c3a-9aac-200e9ceb4b82	gestire un progetto artistico
c958d7c2-22b9-4899-9db1-6b18a825c4df	gestire i problemi dei minori
c976e5b2-f501-482a-b47b-59b10daab12a	fornire consulenza per le chiamate di emergenza
c98f93c2-f196-4cd4-a732-b2bb7d7d5d21	utilizzare il sistema di propulsione della nave
c9847365-52d1-4c58-9009-6271a6d85581	progettare l’interfaccia utente
c97a267a-eca0-4ad7-a677-65533cf20363	sviluppo di prototipazione
c969af6a-3d81-4b66-820d-0b5b1be507a5	Microsoft Visio
c99c68a5-f032-4de6-92fa-58998f2d2057	gestire i bilanci per i programmi dei servizi sociali
c9a06fd0-446c-46cf-8fa4-a6b5c31fd8a1	tecniche di rappresentazione visiva
c99f9ff6-6edf-42e5-89fa-1e113586b293	fornire assistenza online
c9a13311-bfa5-4a50-bc73-9ac87c7bafcb	essiccare la carta manualmente
c9a3f3f2-fa8a-4e6b-9bd1-34f62da2e966	letteratura comparata
c9959887-1fb8-491a-b98a-cbd73c8a128a	utilizzare i sistemi di controllo della circolazione sulle vie navigabili
c9abf5f6-3c2d-49b3-b58d-944c1f87393e	tipi di membrane
c9b989a8-50f1-4085-a503-6d1d6607d155	monitorare le elezioni
c9b7d62b-5e5b-4235-9c18-62a2a7b665f6	assemblare unità meccatroniche
c9b710f7-d36d-4533-bcab-4a131a55ea3a	monitorare le attrezzature di sorveglianza
c9c428dd-3bf1-4f37-ab3c-b8241b48167d	grafici di distribuzione del carico per il trasporto delle merci
c9c5012b-c31c-458e-bdd2-80c0d4cd47e8	gestire i clienti
c9c83267-a06f-43a5-baf0-8e0b0ad4352e	tipi di moquette
c9c5bf59-c90d-4cd9-8d66-e55a803fd3ac	agronomia
c9d13e22-ab0c-4a5f-98c1-57f1695d711e	anticipare le potenziali carenze
c9d3dd75-fb40-4675-bd0c-98afbb5b570b	collaudare la macchina di rilevamento dei difetti delle rotaie
c9cd2bde-6d43-482e-937c-920c7313550e	promuovere la gestione sostenibile
c9d76344-3a7b-4a15-b646-31f509e52795	garantire la privacy degli ospiti
c9d87a35-efe2-4cee-9e26-89f0898c2b89	raggruppare i tessuti
c9ddad67-9696-4fd1-a764-9567141c9bca	creare movimenti in volo
c9e3079e-f218-4150-84bd-488262b6463c	fornire una diagnosi dietetica
c9d46ca1-b8d2-4ab5-a28a-0b00d874be67	gestire i piani di emergenza della nave
c9f6b9a8-095d-48a5-9a2b-f2ecadc1b9a5	produrre campioni
c9e4e15f-64ac-4bec-a476-2d4f0a4eb77b	normative in materia di silvicoltura
ca045c65-0659-4747-93c0-415960b40b48	similitudine
ca0470fd-cc48-47ab-83f4-171527054147	usare tecnologie di preparazione della trama
ca0efa4f-7cbe-4193-a896-1053e9c30d57	materiali tradizionali di calafataggio
ca108e9e-8bbf-43cc-b90f-12deacc78a91	modelli di progettazione didattica
ca125adc-ff35-47df-895f-776b339b9749	fabbricare le parti metalliche
ca15876f-213e-4b43-b592-7a1c44d1953d	lavorazione dei metalli
ca17bc38-19c3-41ec-b503-15a076165e6d	teorie di ergoterapia
ca1beb51-5608-4a8f-b03d-f9549246a92a	elaborazione di modelli di processi aziendali
ca1689fb-7749-41e5-949a-95567772b49f	garantire la manutenzione degli impianti di distribuzione di carburante
ca26a0db-4671-47b0-9f27-9294ed68a2eb	diritto internazionale dei diritti umani
ca2b4dd8-5b11-4451-a458-339c3867923d	tipi di dispositivi di stampa manuali
ca2e0aea-ecac-4155-bae8-186fe5b8f415	installare i rivestimenti per facciate
ca30d066-e4a1-40ec-8eb3-801cf765e2d6	sviluppare software statistici
ca4778b1-fc9a-4727-a632-bc5d66d44bdf	condurre le visite alle celle mortuarie
ca35f672-1c63-48a1-803c-ea6bc1e9dae7	analizzare i resoconti dei passeggeri
ca49dd30-8cc6-47f6-8267-f99a7b389d22	fornire attrezzature sportive ai clienti
ca2fc663-d338-4952-bb5d-328a89d9df99	gestire i conflitti
ca4a0321-991c-473c-8406-6c742c04efd7	adattarsi alle differenti condizioni climatiche
ca3c166b-ced4-4e4e-86cd-1b5f0539bb95	applicare le procedure di sicurezza durante i lavori in quota
ca4c88ed-1168-4b7c-8bb4-c88a4878698d	trasportare il materiale edile
ca51e7a9-31aa-44a2-a427-bd93a6504fa9	installare contenitori
ca4b5cab-c1cf-4e9b-b006-7522b4a4dbea	sviluppare i metodi per l’integrazione coreografica
ca63ab66-bbf6-4db6-bcf3-62eca253cb47	effettuare le procedure invasive cardiovascolari
ca5a197e-9b24-45ed-9c3b-5fdf31a44090	interagire verbalmente in serbo
ca6709fc-a8b5-4514-9192-813c15f1fd99	manutenere strumenti odontoiatrici
ca654319-2433-42ac-895e-f185ce41accf	fornitori di componenti software
ca66eef5-f888-444e-80d2-a79b5c250f5c	impaginazione e produzione editoriale
ca6d6c61-acb0-42c6-ad0e-7b7c76706189	risposta alle emergenze sanitarie
ca7366ef-8154-4c82-af1d-be740a54688f	antropologia forense
ca71fd15-cf87-4474-b6ce-57cebf0fe479	indagare sulle violazioni dei diritti umani
ca833be5-cc41-412f-afc7-ebd643ec3e3a	norme per la gestione delle giacenze
ca833e94-c87f-40a8-9847-aedd4651c825	stare di vedetta sulla nave
ca829a7a-1427-47c1-a781-514d31e073d8	controllare il piano di gestione ambientale dell’azienda agricola
ca863c1e-90cf-4f0d-932e-7ac8ab36ac78	eseguire lavori ad alto rischio
ca8890eb-4514-4e38-bc3b-dd564d499f29	negoziare compromessi
caa02e19-eb83-4fba-a81f-4dfcd0c313c8	processi di pressatura
ca9a10b2-7240-467d-81fb-182d562bbbe5	principi della catena di approvvigionamento
ca991667-8af3-4143-997b-f2104b30b127	eseguire la manutenzione ordinaria delle macchine di taglio del legno
caa13dab-23ea-4bc3-b013-37fff86692e2	facilitare le opportune strutture compositive nella danza
caa8b154-9212-4019-8a91-a6df4af1129c	varietà di amido
cab0c42a-ff41-410c-8573-6b13b2afec53	usare attrezzatura di verniciatura
cab38969-c0da-4168-b966-6274a048cd35	manutenere sistemi microelettromeccanici
cac3aeae-3e8d-4766-bc97-0dc476ec3240	trasformare la carne
cab630e5-c92a-47be-afd9-bba90f05c001	microbiologia clinica
cac046d6-90f5-4df3-ab53-29607575f270	sorvegliare le macchine per la lavorazione della ceramica
cac1eba1-6490-4908-a2bd-ba0234e00b63	utilizzare particolari tecniche di pittura
cacaa851-4c09-4d8c-8f30-7d9c6c384a84	regolamenti per la rimozione dei rifiuti
cad4f1b4-c5ee-4eb5-a5e2-ccda1834e735	azionare gli scambi ferroviari
cacd513f-f5e9-4c9a-80df-16714096d299	gestire il sistema di pianificazione standard delle risorse aziendali
cad407dd-19d5-4e1e-bd16-fb554f88dc0b	installare pompe per il calcestruzzo
cae22be0-5395-4a6a-92b0-c7f781f8915e	applicare la gestione delle frequenze
cadc943c-632c-4882-b4d1-35a9cccfd9af	installare un impianto solare termodinamico
cafb0e6c-de4d-4abc-a215-9af17b87039c	vendere il software di gioco
cafc00c8-861a-47b2-a06e-892fefaea8d1	provare materiali
cb163b87-1db8-4ccb-a16b-a868f389a3a9	controllare la crescita delle larve
cb05850f-64ec-4ae6-84a3-78a505dac11c	cooperazione multiprofessionale nell’assistenza sanitaria
caed00e1-8a1d-410d-9f5c-1b68cdfa7ea4	essere gentili con i passeggeri
cb1b359c-8fb6-49be-a430-c932ef8bafda	caratteristiche fisiche delle ferrovie
cb22682e-b86e-4199-9a8b-0e8198a0ec72	realizzare mock-up architettonici
cb1de717-6f22-43a9-a116-29cf6670f276	tipi di rifiuti pericolosi
cb228e1b-68dd-44cb-86c6-84b383d612ad	gestire il piazzale della stazione di servizio
cb0a7487-20ac-4974-8ae0-39a2833733ae	essere addetto a macchine di miscelazione dell’olio
cafcde88-3a60-46bc-889d-74dc8a95608e	cerare le superfici di legno
cb23f1b1-c495-4e14-b9fc-3a76d3442e5f	interagire verbalmente in vietnamita
cb2a85eb-137f-4e6b-8051-681b56584b28	inserire le strutture dello stampo
cb283e54-e67f-4bba-af2a-dfd4a4cc6767	consigliare i clienti
cb30e5bd-6504-48ae-9fa6-fdca1ed08d14	realizzare impianti di irrigazione a goccia
cb31cc6b-6b3e-4a33-bdeb-b376de583691	essere addetto alle padelle scoperte
cb2a3201-9cfc-4cc7-a2bf-a767526be61d	impiegare le tecniche di presentazione delle portate
cb2afcc9-8ad2-45a3-86a5-91ed0a33d703	definire norme di qualità
cb3b4871-d840-4276-9603-4bfbf0085df2	svolgere le analisi dell’attività del paziente
cb371a2e-7d73-4069-9491-3ab004882617	fornire consulenza in merito alla geologia per l’estrazione mineraria
cb25c545-df3b-4add-8718-5a54722e6f3a	eseguire la gestione del progetto
cb3f437a-1d8c-4c0f-bbc5-2d7eb261091b	installare le attrezzature di ventilazione
cb4a3f80-e033-42dc-a915-281d6db5e220	creare un regime dietetico
cb4adf97-8b32-4302-8129-d14068fd11e6	gestire i programmi di competizione sportiva
cb4db69b-b3ca-47f4-bf5d-f559b74d469e	realizzare corde di archi
cb4984bc-c6c6-4f11-a337-bccc419e233a	aggiustare la taglierina
cb4f948d-d693-4425-838b-f8cc6068eeb9	fornire assistenza per la gestione dei fondi
cb6eb09a-cc19-4418-bf2d-fd36751a1e27	attuare la corporate governance
cb723cc1-b714-4b6e-a5cb-56197d33a3f5	osteopatia
cb6ddade-4720-43b2-bacb-6a58d6f8bba8	tenere registri farmaceutici
cb5a6138-f606-4cb3-9b7b-9b590b585d78	scrivere le relazioni sui casi di emergenza
cb71f89e-ac80-4da0-a823-1fcad0101ee2	riparare l’impianto meccanico della nave
cb737682-1540-443d-ac32-70b2c38313e1	rispondere alle emozioni estreme degli assistiti
cb840f08-061a-4a51-bb08-223656d07dd7	integrare i fondamenti strategici nelle prestazioni quotidiane
cb8802b0-e4e3-4f0a-8b2f-48e74f7ad4ec	limiti del cavo di rete TIC
cb89e885-c74b-4ec5-bc87-7f863585a6ff	reprografia
cb89d0dc-2d8f-4e0a-8b08-217a6afab433	pianificare i lavori di manutenzione degli edifici
cb92305f-4255-4610-bf21-776ee3fef13a	chiedere l’autorizzazione per installare una bancarella
cb599590-c6ca-4d10-88b9-07681dcb6d39	partecipare ad aspetti tecnici della produzione
cb9b34e4-bb3b-48c0-8c05-424048f36ac2	prevedere i prezzi dell’energia
cb9d7880-1da6-49ea-912a-edc4970bad8f	fornitori di componenti hardware
cbae501d-e335-420a-a056-c730cb3e3951	liquidi infiammabili
cb85ec25-e764-4ba6-98a2-890cd41938c8	fornire consulenza sanitaria
cbafdcc8-53e7-4c5d-b3bf-4b75964f2c81	levigare le superfici con bavature
cbb9c2ac-08c7-4ca2-9f32-6dd9927c977e	osservare le tendenze dei prodotti alimentari
cbba7e0e-79cb-4fdf-948f-249f6c29189d	essere addetto a macchine di maglieria
cbbfdd46-7df4-4a20-8bd9-4ae755d266e6	regolare la combustione del gas
cbbd6a1d-e051-43ec-9588-b282f4212add	memorizzare il copione
cbcd0df0-09a8-4195-b657-6a4090a77522	eseguire le misurazioni relative alla silvicoltura
cbc4d23e-d4ba-4784-819c-8a198bd2c94e	individuare gli indicatori chiave di prestazione
cbcc8291-9534-4761-9646-878a889e7bad	applicare alcool isopropilico con cautela
cbd5e1fb-544f-446c-8ba6-f89004f8ae5f	tradurre la strategia in azioni e obiettivi
cbd9c149-435d-477a-a865-1c28fdbe377e	gestire i rapporti con gli artisti
cbdd9f49-51a3-4428-8294-642691606fd8	strumenti di assistenza
cbdadc90-bb5d-4ae5-911a-830f90789c7c	gestire le conseguenze neuropsichiatriche di ictus
cbd957e5-dc2a-4d85-90c6-2483a61c5b0a	lavorare con un insegnante vocale
cbced2d1-aef8-4d13-b839-7d6ca11c2c78	individuare gli alberi da abbattere
cbe1c04a-1768-4b6a-92cb-1c36c3d10add	perfusione clinica
cbdff508-1d68-476d-99ec-9f28ad2f8228	leggere le relazioni sugli zoo
cbe8824c-120a-44ef-a2a8-b169e0db31e7	etnolinguistica
cbf07648-33f9-4aa6-aed0-d3cf8eea94a4	elaborare i dati dalle sale di controllo ferroviario
cbfc316e-ab24-47ae-b2d9-1384610c2cca	installare le balaustre
cbfb5e79-5f37-43a1-af14-3bd84795dd1c	promuovere la salute e la sicurezza
cbf6daad-302e-4cb6-b639-7e5f1d929408	valutare la qualità del vigneto
cc04a402-50bf-4973-8074-3c8d9c51d84c	realizzare abiti su misura
cc0e5840-2650-4eeb-bd93-623f3f10eded	alimenti preparati per animali
cc1ae0cc-117f-4f9b-89e4-93d5d24ca395	gestire il sito web
cc1f8658-e1e4-46ca-ae13-4d1c0cbe8c80	auricoloterapia
cc076a41-11aa-46f2-9e0a-58fa49a97b2e	spiegare i tecnicismi finanziari ai clienti
cc07b37e-a2b8-4304-a56f-abc12ee2a89e	effettuare i controlli di garanzia della qualità sui carichi degli aeromobili
cc203426-690a-444d-ab98-84ce2c5fa5da	gestire il programma di comunicazione dei dati di volo
cc2852f7-deaa-4fc2-917b-1418ac139bfd	processi e tecniche di assemblaggio per la fabbricazione di calzature a lavorazione California
cc37fccc-4b2b-4b80-9e0d-2adff51b5a5f	trattare i disturbi del cuoio capelluto
cc39e3a3-e28d-4261-8110-cc993029efca	sorvegliare l’erogazione di carburante
cc2eddfd-3991-4639-9030-3b97a5e2a1a9	esporre le bevande alcoliche
cc43a8c5-a1c1-46a4-9be8-b1109632d7bd	eseguire la sabbiatura delle pietre preziose
cc3b7ebd-f1c8-44a5-81d6-31fe7ed96134	rilevare i neologismi
cc52eb94-618c-434f-86f6-c0e7a75710e3	controllare i terreni
cc5c9ea3-75da-4d59-bc0e-2f4d45ce1c13	partecipare a eventi sportivi
cc4d5254-fdad-4231-bcb7-410ab963b18d	proporre i giornali ai clienti
cc5b8752-6207-47df-97f2-f10777ad2ac9	preparare le strutture di contenimento
cc6e2389-86af-42cd-b906-6acf21e3c4ec	tarare i motori
cc6e7c53-ae74-44b8-9acd-f56bed0fe361	stagionatura del formaggio
cc74409a-7ad1-488d-a5ad-a5fa94025455	lituano
cc6010c9-15d0-429f-8001-95d2872a30f5	rispondere alle domande dei clienti
cc854dcb-9766-4ad2-a71c-fc40e750ba2e	processi di addolcimento del petrolio
cc82ceea-5660-4575-b8e4-37b8bc315e84	classificare le impiallacciature
cc82c716-2047-4422-b9cf-b661f5ca8095	sorvegliare il trasferimento del cemento mediante sollevamento
cc3f52d9-6eef-4fe1-b616-3fa1a1bc413c	BlackArch
cc867427-e6cb-43da-ac91-acf68867a9e2	raccogliere campioni da animali per scopi diagnostici
cc664554-6f7e-49ce-b88a-21745ee92d53	fornire assistenza per le operazioni di ancoraggio
cc8ed2c1-f787-4dc8-9cf5-dac25b2311ab	classificare il frumento da macina
cc8b177c-3a6a-452f-9642-9477d263eb97	educare il pubblico in materia di sicurezza stradale
cc9887dd-e165-482d-8d15-10f3060a7ef8	valutare i progressi del gruppo artistico
cc9207c5-7b33-42a0-90ec-9deaba27db89	reazioni allergiche ai cosmetici
cc95f88e-b18a-4615-ab45-2081edcc42db	monitorare la sicurezza dei passeggeri nell’area di stazionamento
cc9fb554-6f83-4b51-98f6-e47eee308be9	regole di sicurezza per piscine
cca05bd2-4c2a-4740-adc8-1b0286fbfdb8	tecnologia ecologica di incubazione nell’acqua
cca1958e-1773-4f72-bc35-8b06b964d5f1	parti di presse per lo stampaggio a compressione
cca32034-0d66-44f2-8d65-344346a372bb	effettuare un follow-up sul piano di assistenza nutrizionale
cca35b1f-7c7d-44c6-a050-f892a9e18241	corano
cca7e4d1-79e2-4955-8be7-80fe5ece7368	applicare le tecniche di diagnostica per immagini
cca36e4c-f413-42fc-8572-7989838235ac	rimuovere il tetto di copertura
cc8ab5e7-9c8a-4dab-aad6-968e2cb17443	garantire il rispetto della scadenza fissata per il completamento del progetto di costruzione
cca88e20-1f31-4355-9fc9-54fa3a806166	affiggere le targhe commemorative
cca8d8c1-bfd1-44e3-b358-9372a3d79597	tai chi
ccab6a27-abda-40e0-877d-bbbebd5b7449	valutare programmi di intrattenimento
ccb2ecae-bd19-45c4-b509-d9af501f9cf4	studiare i rapporti tra le quantità
ccb71b14-d00f-4597-b3b5-af3bf2eb5c04	assistere il docente
ccb798c5-495c-4934-a588-dfc5ccb0c789	forare le piastrelle con il trapano
ccc49fbe-38fe-47de-bb4f-3823506bd7ff	fornire un’assistenza all’operatore multimediale
ccb98b03-2ea3-4bdc-8ee4-834dce01a280	proteggere i fruitori vulnerabili dei servizi sociali
ccda316b-a13f-4199-933f-f915ce0b2fe8	effettuare le visite di chiropratica
ccd6f344-b94c-4f43-8c85-6da0679299bb	applicare le tendenze della moda alle calzature e ai prodotti di pelletteria
ccd2d468-514a-4132-96eb-2e18496d1f64	principi di marketing
ccdaf27c-2b98-473f-899a-10e1d620735d	scrivere in ungherese
cce5e492-530c-432d-b535-6ed4072d7089	eseguire una rilegatura a spirale manuale
cce48d95-3fd3-4986-b851-14ea110a03d8	congiungere metalli
ccecd174-0821-48d4-ac69-95ea6b05b3d6	redigere le note per le prove
cceda61e-3864-4da5-9c49-c10835da61f3	ipertensione endocranica
ccfc18e8-b42b-4b55-a2a2-2451578960e2	verificare le qualifiche dell’equipaggio addetto al trasporto su vie navigabili
cd01d457-c874-4d7a-865d-c758f40445f0	aggiungere sostanze chimiche alla produzione di amido
cd0d708f-fae7-4aef-b1b9-2d44eb6fedc1	meccanica del suolo
cd0b7d8c-51de-416e-92fb-315ef54a8246	condurre ricerche sulla fauna
cd3103b4-97e7-4e69-a576-d2cd1cf69bab	sorvegliare la stampatrice di sapone
cd009cb2-d5b3-4fa9-be63-9d28caf20ff1	fornire informazioni sulle caratteristiche dei prodotti
cd283da4-002e-4330-8561-8d8d1408a957	insegnare la scienza medica
cd24e111-700c-4e56-9523-4cc3530009d1	calcolare il valore di gemme
cd3ab27c-151b-4033-89d2-64d86f258d5a	trattare i gas residui
cd4036c1-f5c6-4053-8025-f4cd93d7b62e	essere addetto a macchine trafilatrici di filo
cd40de6a-1e48-4dc1-830c-7b6bde03b20e	contesto giuridico per la musica
ccbaf81e-5dc3-4480-971b-ca1e9a2ee896	Parrot Security OS
cd46b1d3-467f-4895-82d1-239e0e266040	pianificare programmi per i giovani
cd43a8de-39ae-40e0-9db5-d93b92bde593	id Tech
cd465bff-0c05-4bb2-9b36-f06af019966b	rispondere alle domande dei pazienti
cd55fa0c-34c7-42fd-8f48-a4ebc04652bf	immagazzinare i materiali pirotecnici
cd6ea19d-20d7-4a93-9afd-87dc280b0377	gestire la restituzione dei beni noleggiati
cd6248c8-9024-4d66-aa04-c8051a1194b8	lavorare sotto supervisione e in sicurezza con i sistemi elettrici mobili
cd715f1a-9c0d-400d-882a-4f82f8494492	stimare il costo dei materiali da costruzione
cd74cdde-70e0-4ee4-a337-e4f521185617	gestire la produzione di vino
cd824b3f-e61e-4234-a147-852f2065320c	teorie dello sviluppo della personalità
cd82767f-2649-4a04-bc43-47911b88246b	riflessologia
cd8d2ed4-f364-4798-9dfb-480a66ce554c	comprensione del cliente
cd8ef5e9-3089-4ed2-8f7b-e531de110646	supervisionare gli assistenti fisioterapisti
cd90fca1-4c57-4dce-ab9d-f4d177167a32	posizionare una piattaforma di appoggio
cd94c17a-1a82-44e0-9f17-b0f0ed3c2004	posizionare le piastre di appoggio
cd6f8d5c-8070-4e79-bc5b-f949e9526008	supervisionare la gestione del marchio
cd72f967-eef6-44bf-819e-844de0bc7552	utilizzare le pompe negli impianti di acquacoltura
cd7f1663-71d7-4d7a-9350-8b2ec61b84c4	manutenere i macchinari da taglio
cd95595d-c0d1-4d71-997f-e49c8ad66c7d	sicurezza negli edifici commerciali
cd930da2-e61c-40c9-b8cc-5755cf84f877	pianificare la realizzazione di articoli di pelletteria
cd7a3158-6551-49c8-ab18-861e2cdadcc8	pulire la biancheria per la casa
cd97d45c-8030-42b1-8e25-45479ec8cbed	azionare gli strumenti di pulizia e manutenzione
cd995dec-b70c-4daf-89c3-6aa4f4f51cd7	applicare le procedure operative della marina
cd9d9eaa-eca5-48d2-9369-cbc767e5e276	scrivere in tedesco
cd993e8e-0373-4871-9b63-e343a1ce8ac9	analizzare i bisogni assicurativi
cd999249-6a08-421c-bcf0-694bb81c816c	settore dei maniscalchi
cd9fee3d-e83a-4bc5-a07c-01f6ef60c66a	gestire gli atleti in tournée all’estero
cdcf606c-7fb1-4266-878b-a90a7f4df182	monitorare le richieste dei clienti
cdc06166-608d-4b11-adb7-3929caae7c7c	procedure di flebotomia pediatrica
cd978d16-47ab-4c9e-b071-c9acde1450ad	valutare l’impatto ambientale
cdde98c3-886c-4816-9775-9d680c8222c9	sviluppare gli obiettivi in termini di informazioni organizzative
cdc8633e-9103-4c0c-a27b-b0eab62f7fb9	definire le priorità giornaliere
cde02c97-a2e5-4034-95c0-16654482d9e5	rimuovere l’impasto in eccesso
cdf14d49-250f-4bfe-97c0-2a659bfe86e7	agire come rappresentante con procura
cde70878-44e0-4376-bdc4-7f820f605722	trasportare le piattaforme di perforazione
cdf9eca5-d834-43a6-8ce5-739051b77fe6	usare tecnologie di finissaggio a macchina dei prodotti tessili
cdf94e91-7fef-4734-9580-9dd4b1b4c757	tecnologie emergenti
cda67a38-a005-4d1b-94ae-e2d5fccfb234	organizzare il trasporto dei gruppi di turisti
ce012e6c-0bf4-42b3-9762-e38dcdfa135f	linguaggi di interrogazione
ce0ae9c6-8dd8-446a-b4ab-eca0505d3a1b	gestire il cambio di inquilini
ce139758-b9fd-4e36-ae11-aeb77eeedff9	manutenere apparecchiature ottiche
ce18d6a7-a58f-48a9-9215-aa25bcf51cc1	testare il calcestruzzo
ce1e5a72-bf76-47aa-95de-1bb2a58aa3b4	possibilità di sviluppo negli interventi di musicoterapia
ce2c4f95-3e87-49ab-b55e-1bb0b828423b	gemmologia
ce2f02ac-72aa-4a40-8363-81b551f75d42	gestire la produzione di fluidi nei gas
ce0144e3-ef08-4a2f-9aa4-f93aacf02633	risultati del rapporto di analisi
ce325297-369f-4864-bf51-5a59e2ebc4e4	eseguire gli interventi di chirurgia plastica ricostruttiva
ce1b91e1-6e04-4cb9-bd77-bfff2d9a4803	aggiustare la pialla
ce3a9a21-f615-43fa-b288-6e96147284de	tipi di fibre tessili
ce4bf932-a34f-439d-90eb-ec1c72a8afb7	colour grading
ce507176-83cb-4d7c-9e8f-a7e5571bcf04	collegare avvolgimenti di armature
ce3c8fe6-4bb7-4ac9-bf44-f958fd842f32	valutare l’impatto del programma di lavoro sociale
ce515979-cc79-4610-b387-fab8463b01cb	supervisionare le cremazioni
ce48c434-a018-4e44-b1c1-bdfb42feb21f	pianificare le attività artistiche educative
ce45ea54-f519-4714-a079-d227ab85906a	offrire consulenza sugli atti legislativi
ce5367f0-3414-4f5f-979f-1f367a8b3d7b	ispezionare la costruzione delle navi
ce5d10ff-598d-4181-97fd-13dfb3c0a823	trasferire i disegni sul metallo
ce52163a-9528-44fd-99f4-3c2f7a25853e	incoraggiare il team building
ce5ea90a-5f08-4cdd-9476-3275242f780a	analizzare le esigenze della comunità
ce6b27b9-6c1a-4eef-9129-1b3e46065ebf	sorvegliare le macchine di formatura del vetro
ce7727e9-d9dc-4cd3-9252-667beae8617c	fornire istruzioni durante le procedure ortodontiche
ce89c0e1-398b-4788-b8a0-cc50b4bcd872	collaudare sistemi microelettromeccanici
ce8d0f55-a82c-4fae-a5bb-f74323048135	rispettare le regole del traffico
ce8a0acd-4e9a-4065-a7d6-d8ea9b7cf661	processi e tecniche di assemblaggio per la fabbricazione di calzature con fondo incollato
ce6ab109-60c4-4d20-9d96-78961c4cc68b	applicare la mappatura digitale
ce8eadcd-b00d-4b7c-a624-70e74dc7d230	approccio basato su dati probanti in medicina generale
ce917624-497b-46f5-a62a-002cb4455e68	essere a proprio agio in ambienti non sicuri
ce7144cd-e964-4386-9b85-c1953760b603	adattare le tecniche di combattimento allo spettacolo
ce8e3df9-6368-4c01-8dc3-88ceb144dec7	pianificare i futuri requisiti di capacità
cea67b34-565b-478e-acf8-ff87f82572b4	essere addetto ai forni di panetteria
ce8e4a0a-e7f9-4505-953e-14c80050cd7f	effettuare la titolazione di filati
cea6f6e8-f52a-40f4-90d6-a33aa0b6b4e1	tagliare i perni che bloccano il pezzo in lavorazione sul mandrino
ceb1866e-bf14-4a11-ba8d-1adc355c47da	assicurare il compagno di cordata
ceb92dec-a63d-4094-a0c5-b6ef761fa938	preparare la vendita all’asta
ceb36602-e544-4fa3-a729-272e5337ae64	attrezzature di sicurezza della nave
ceb8a0e0-f90e-4f12-b138-ffbfd44d086a	misure di trattamento psicologico
ceb92f88-06f7-45f8-a80b-b803031fbe1d	metodi di rilevamento
ceb9f770-4519-4e34-9ac0-995ecab521af	rivedere i documenti giuridici
ceb3eaaa-127a-47ae-a271-7aba4516e4cd	fornire assistenza alla produzione di documentazione di laboratorio
ceb95353-0810-406b-bd1a-b7092c3e1847	eseguire i compiti tecnici con estrema attenzione
cee99877-4c4d-42e6-80ef-360751c61b8c	scrivere in croato
ced9777d-64fd-47bc-be58-1cad757057e3	collaborare con i professionisti del mondo degli animali
cedea464-e5fb-48c6-9aa9-54795f2e87ef	applicare i principi del lavoro socialmente equo
cec15667-913a-49f0-af9a-fa59f5ce4036	garantire la sicurezza degli assistiti
ceeed99a-c2a7-41ed-a361-ec18c42d10c3	optoelettronica
cef363a2-5cc9-4acc-b729-98eedd2f6f54	trattare i problemi di russamento
cebd2e2c-e7ba-4a89-9f40-f972eb1a49d5	lavorare in un team logistico
cefc506f-3aa8-40c5-8284-8640d35ca5c0	scrivere in limburghese
cef8b533-1b54-4105-a9b7-1f5983ab058e	requisiti meccanici per i veicoli nelle aree urbane
cf06f7fc-8991-43f3-b0b8-71207d252cc5	convertire i nastri cardati in filo
ceeeae47-c505-47dc-99da-70534784fc6e	ispezionare i cavi elettrici sotterranei
cf0c3127-ee27-4d0f-abd4-0e861ca67475	scaricare le merci
cf154ce8-e060-470f-8369-7b1c07fc3e0a	accendere un fuoco
cf0b21b8-11dd-425a-b11d-b674984e2066	osservare le procedure di valutazione dei materiali al loro ricevimento
cf1e26e5-4912-4c5f-b22b-2b265b288d68	diagnosticare le anomalie delle strutture dentali e facciali
cf2238a0-c72b-426e-a3d6-63a27e9af392	materiali utilizzati per la fabbricazione di gres
cf232aa4-d400-4926-9814-ba575af238ee	eseguire la saldatura con metallo sotto protezione di gas inerte
cf31396d-6da7-45c5-80df-a0dc7607ca93	manutenzione e riparazione
cf29e69e-aa56-487e-b7f9-300e501128a7	specializzarsi nella conservazione e nel restauro di specifici tipi di oggetti
cf321981-d5a4-470a-8f21-ba7d07509aa8	tossicologia
cf348a04-6f84-4a9e-accb-b70ab16e1341	usare sistemi di ticketing TIC
cf36137a-b304-478b-ab36-48316dad14eb	trasmettere tecniche commerciali
cf3870cb-c0e2-420e-bc9e-ebd7461e113f	eseguire un trapianto di cellule staminali
cf3284ab-6111-4ac5-9fac-a08467eb1383	elaborare le istruzioni impartite
cf38f4dc-571a-4ad7-b89f-92f734fb10c4	scrivere in danese
cf3b1416-dad2-4238-a7e4-f0bd75720818	elaborare un piano strategico di marketing per la gestione delle destinazioni
cf3e1624-556d-44c0-b59e-1b8919642265	eseguire la scansione di negativi
cf41b0c4-faf3-4f46-b43f-0335adad5c37	mantenere la qualità dell’acqua di acquacoltura
cf55486d-b31b-4157-b4e5-f6d2b385ca0c	individuare i requisiti del lavoro
cf4ad4bd-f726-4268-a92e-bde255bbc17d	progettare interfacce di applicazioni
cf5a9e50-79f6-47e6-b10b-f7dfa4bb44a4	valutare le proprie competenze in materia di coaching artistico
cf55e359-d235-44dd-9c00-9d3bb8c8027b	fornire consulenza TIC
cf5b2d9f-b534-4867-b6ba-d832a03e8ea7	aggiornare il giornale di viaggio
cf64ecb0-c57b-4946-944c-b3ae5f0104fb	controllare la biglietteria
cf5dd8ec-4755-44ca-a32d-ffd2ed9914b4	selezionare le attrezzature necessarie per la movimentazione
cf6de3bd-7b80-4cd1-b495-7204611edc37	riparare i modelli
cf70b5e7-73f0-4648-8338-7ecff78f80f0	post-produzione audio
cf71ce40-4115-43e1-aeec-122344e3052c	sostituire i pneumatici
cf6d02d2-e78a-42c8-ab50-57f61d932e54	costruire relazioni nella comunità locale
cf89be64-9b3d-487d-a894-a05602f1d991	applicare tecniche di nebulizzazione
cf73a7bd-9c53-44cd-bdac-8428638b4de8	preparare una sessione di allenamento di Pilates
cf951b96-30c7-42a6-8d8e-4d94e6ec15fb	processo di produzione dei veicoli
cfa8d8fc-f8a1-4dea-82c7-afcf1aa67509	garantire la disponibilità di materiale presso i punti vendita
cf9f70f5-a7ed-4a7b-b1ac-00da2bbc3ed8	controllare la produzione
cfac0cb7-9b3e-4d16-8ac7-cf68a4360900	cellule staminali
cfbe25fc-9330-431b-a3e3-b844612edfdd	ristrutturare impianti ed edifici
cfb22a95-37d0-4083-b41f-f22f5c1dab3e	ottenere le informazioni finanziarie
cfafc9bc-12d4-498d-8d46-cf77faef8a58	prodotti di cascami e rottami
cf9a669c-6a57-4f45-90b0-71a1d6975152	fornire assistenza nella pianificazione della programmazione della produzione
cfc6c52c-9231-4010-91d2-68a8f77c6cb7	produrre archi per violini
cfd5f2dc-a4f0-42e2-bb1e-7d8b7950a1bd	attuare il piano operativo dell’azienda
cfd88db7-a6f4-426c-bc03-7ae1dd4a0d46	ecosistemi
cfe39e44-5a21-4049-945f-fc6c17015750	produzione di rubinetti e valvole
cfca9a65-f6bf-442c-b7ad-18baf3523ac8	fornire informazioni sui servizi mortuari
cfdc6234-7c54-4691-b38f-94b9b9b613b9	esprimersi fisicamente
cfe179dc-5900-4d82-a20b-b3ed6dc08281	monitorare il rispetto delle norme di commercializzazione UE per gli ortaggi
cfe8b432-7d78-49ac-82c1-5ca52c213924	utilizzare apparecchiature audio
cff2ab37-4abb-4821-ab90-69f0e02bf83e	sorvegliare i bambini
cfface4f-243f-4d56-818b-ef25ee84198e	supervisionare tutti gli aspetti del programma di viaggio
cfeba8ce-de93-49fb-aa54-2877458576ce	software CAD
cff470bb-e643-40e3-abf2-f8df0e0c0c33	installare i materiali antigelo
cffbf547-0e1c-407c-b606-93916d358ee6	spegnere gli incendi
cfe5db48-4bc7-4ca3-9491-2a65985d7dbb	produrre i dati statistico-finanziari
d008d7c2-652e-408c-ba26-9b12b9bb94a6	svolgere i preparativi per le procedure di diagnostica per immagini
d014bdfc-59dc-46da-bfe5-d1a26d598ad0	proteine
d00e2cd9-11b4-4e7c-af35-11d27b10f343	rilevare continuamente le condizioni meteorologiche
d01fdf60-c321-4dd4-991a-5c447c1ddefe	osservare i corpi celesti
d032597f-3efd-4d61-bc49-faa3a48027c6	infrastruttura software di e-learning
d02eed19-1284-47f6-a332-095c90b7e28d	consultarsi con l’editore
d0360121-5fb9-47ea-aecb-e51ec7f4a052	controllare la capacità del miscelatore
d046b238-e724-488d-8c6c-44e8d226eb42	semantica
d04d3443-de96-4177-8278-a8d0241d4cfb	gestire la segregazione e l’accatastamento dei tronchi
d04b1bea-f632-4f85-9552-c9612e664ac0	prevenire i problemi tecnici degli strumenti musicali
d04ad5a8-7cd4-43e3-ada3-a7bae09e8848	dimostrare doti di direzione nei casi di attuazione dei servizi sociali
d0528ce6-844d-4170-b7cc-7f436ea61b53	determinare l’idoneità diagnostica delle immagini medicali
d051e301-d215-4659-aed8-ad79a10c03da	informare in materia di norme sanitarie
d05b5a2f-617b-44c8-86e6-369d7a9443a7	progettare la conformazione spaziale delle aree esterne
d057c356-6146-48df-9745-0c68a16c90e5	calcolare i pagamenti dei risarcimenti
d068a7d6-307d-4db0-9449-1674b86fc198	procedure di asta pubblica
d061c69c-0772-4e56-abc5-ce9d4ecb7b4a	gestire i bicchieri di vetro
d06777e8-990e-4eb1-87fe-95e0b43096a2	sistema riproduttivo degli animali
d06bbd80-f662-4fd1-935b-537ed3e4edc1	giochi d’azzardo
d06cb3b3-eb57-4f21-b4fb-3507b6107881	concentrarsi sui passeggeri
d070d9ef-bc66-443d-a6f6-77cc4643e42c	composizione delle diete
d06db2cb-02cc-4377-9e08-87210a482892	eseguire una visita clinica dentale
d0774c07-9e9b-46ac-8ed8-5e1409a40c98	gestire la rimozione dell’aeromobile dismesso
d0747205-978b-4403-bc66-369ac6bd5ab1	costruire prototipi elettronici
d0884482-5c32-41ba-bbc5-65e285128da1	selezionare l’argomento
d0922ee6-c997-4ec4-8008-7905a3d65f6f	esaminare le gemme
d08d1649-29c7-4b7f-9141-9af4956265b7	sintonizzare i sistemi audio senza filo
d095afbc-4fc5-481a-a5f1-a42c33946052	fornire un’assistenza nella pianificazione delle strutture per biblioteche
d09767d7-3f2c-45dd-a19c-ec2ce0e381da	essere addetto a macchine avvitatrici
d0937e2a-51b8-46e0-a918-a2221d899ca8	utilizzare sostanze chimiche deinchiostranti
d0a035f4-77a2-473e-9ff4-8369ddd4938c	assemblare fossili
d09987c5-5750-40ee-bb61-3f39392675e1	comunicare con i fruitori dei servizi sociali
d0a0bbdd-8f3d-48cf-997f-34aa25f6776d	manovrare e caricare una piccola imbarcazione
d0a9fac1-01ef-462f-b390-f4f468dad754	sviluppare i modelli
d0a768ee-1897-4768-afd1-5a6c51bbfc3a	trasportare i cavalli
d0aa6859-3284-41d0-b4ed-fa51cc958a11	principi di fermentazione del lievito
d0ae7f71-1597-4a0f-b678-e5bc413ded03	psichiatria forense
d0a214f2-aef9-4b04-b9ea-fab4dd88664f	tenere i contatti con gli esperti ferroviari
d0c7184a-aede-48ca-85e6-1e46a5d2e3c8	effettuare la manutenzione delle attrezzature di proiezione
d0ca63ea-4eab-434f-9996-bde91ac5be5c	standard di qualità applicabili ai prodotti di acquacoltura
d0c6f0e6-d96a-41d0-a388-f310971956e0	lavorare in sicurezza con le sostanze chimiche
d0c17a20-cee2-4e74-ae2c-126184d7243f	valutare le procedure di restauro
d0d7b449-bb9b-4919-a0bf-d12d3b6b637a	rappresentare gli interessi nazionali
d0d39307-f1ba-46b7-b051-b05f398e39f5	controllare le attività
d0dfc785-6d6f-48c6-b2c3-de51888d4f22	prendere decisioni in materia di propagazione delle piante
d0e85d18-d0ba-4c75-a7e1-fc0fe88601c0	azionare una pistola di colla a caldo
d0e03b38-fde9-40df-b47f-53247c77f2bf	satelliti geostazionari
d0e2fbf8-8d2c-4d49-8d9f-6df32bdabcf5	sviluppo a spirale
d0f64272-ee50-4cfa-abc1-09629f7a73a7	partecipare al controllo dell’inventario delle forniture mediche
d104f9e2-7556-4a43-b12b-f9792795a0ec	sviluppare le strategie di cooperazione internazionale
d0ff2f5f-156f-4752-9282-3d301a3ff1b5	archeobotanica
d0f5d397-6871-493d-9173-2656683fd553	risolvere i guasti informatici
d0f52726-bdf8-49d4-a2c0-12aabe94cb10	elaborare procedure operative standard nella filiera alimentare
d1122e14-0c52-4ec4-9ffc-45ddc004cf7b	essere addetto alle macchine di confezionamento della carne
d114fbaf-120e-42be-9563-05c063a6783d	scale di temperatura
d101fedc-3c10-4d35-9fd5-9c665f0764ac	eseguire calcoli matematici analitici
d114613a-5904-4a2d-946d-3709cb36c066	gestire la cantina dei vini
d11682db-84ad-4ecf-b20e-c7e24dd97cb5	tecnologie cloud
d119ec76-4cfc-4fd1-8d1c-a6310033b2fb	lavorare autonomamente all’interno di un servizio di un processo di produzione alimentare
d11b2fea-376b-4e9b-9276-f984826bfd5a	mantenere le prestazioni di un database
d11be660-9d62-4c78-a90f-5442b85f43ca	attraccare e fissare le cime alla banchina
d12e5428-fd98-412a-b54b-141019d8911b	acquistare le armi di scena
d11c4f53-abc8-40a9-a9af-208cedbf1871	codice di procedura civile
d1333c68-5155-4c15-bf84-9b1b2905eb3d	chirurgia pediatrica
d1391cd7-3461-4c15-902c-543b315ce535	origine di grassi e oli nella nutrizione umana
d148dca8-7ce8-41d1-818b-e0d0fe669883	ricercare le attività all’aperto
d152d3de-e3e2-44ce-b2c1-f6e9a48d9a17	comunicazione relativa all’ipoacusia
d155a71d-9278-4326-ab1f-bfb1a2d31071	processi di deinchiostrazione
d14b82b3-e099-4e3d-a51c-677935d80bf9	adattarsi ai cambiamenti su una barca
d14bd514-37a7-4a9d-8ab0-e5364579a2e1	stabilire le relazioni di aiuto con i fruitori dei servizi sociali
d15d3e2f-cfc1-4887-9f01-6e48be46d3b8	utilizzare tecnologia di essicazione del tabacco
d1564616-73fd-474b-bdbb-a830908ebf56	offrire consulenza ai clienti sulla preparazione di bevande
d1641aad-c565-4ca4-a771-0f0f11262a26	pesare la merce
d16129a0-c29d-4b0f-a234-e80c946b1bb9	lavorare in un team di trasporto su vie navigabili
d1809ee8-9b7d-4912-b985-ace1d4c64b35	riempire gli stampi
d1855404-c656-4f1f-9acd-9d0599f22652	comunione immobiliare
d18a41d7-d367-452f-9e4b-754163b98673	individuare la capacità personale dell’assistito
d18c6bbd-e0d7-48a2-aed1-517fe2624ec7	processi di saldatura a fascio elettronico
d19666d7-602b-49d2-be1a-e3d9ceddc330	dati non strutturati
d1b62beb-65b1-4fa8-9afb-1fd720e476eb	pianificazione aeroportuale
d1c8f471-d419-4f52-8c08-c0d1e0ad4bf2	preparare una seduta di sofrologia
d194608c-4e16-4db4-8964-356f4b4d75b5	controllare i parametri sensoriali di oli e grassi
d198b4e4-0312-442f-a6df-81b7ed8b7a89	post-elaborazione di fotografie
d1d660dc-3910-449d-ad4e-d4df4b7863cb	gestire la comunicazione relativa all’esercizio fisico
d1d2cc53-48bb-46e5-8e6a-645e5e5b028a	alimenti vegetali ricchi di amido
d1a19e5d-dec7-4361-81f7-ea0fce2ee241	fornire ai clienti servizi assistenza
d1e1490f-457a-4c7b-82c3-f518b2fe3388	slovacco
d1e297db-350a-4bd7-a5ef-c2873d1d4979	costruire un tetto verde
d1f31fa7-b7e2-4792-bfd8-3d41fa7b4a0b	biologia dei parassiti
d1e0d132-8838-427f-aac7-cafdfebc4786	gestire le operazioni di parcheggio veicoli
d1ec4494-97c9-4cde-8eee-0bd6f1ba2b15	monitorare la bobina di carta
d1e3a841-d329-4dec-84a0-fb3e8701c7b0	valutare l’idoneità dei vari tipi di metalli per applicazioni specifiche
d1f76e7d-a829-4c6a-9389-2b4c7a3fe1f6	proporre le calzature ai clienti
d20b1d0c-de30-45e9-863c-258d342cc7e0	comprendere il tamil parlato
d21be696-86a8-420e-ad31-e2d5abd4e5a9	interagire verbalmente in spagnolo
d1fbce2b-c9c6-4a6c-9dcf-9b65baff90ef	mantenere i contatti con il personale di sostegno didattico
d22e87de-4208-44a1-9ebc-a1234b65dfe3	sviluppo di spartiacque
d225610a-b4ce-4993-878c-90338d15426c	integrare le strategie di marketing con la strategia aziendale globale
d22b358e-eb45-4be5-befd-079985466d52	adattare l’insegnamento al gruppo di destinatari
d237a62d-8096-4cc6-9183-ff4056adf9ef	vestire gli attori
d22fe967-b1d4-47d9-aa4b-e375c3fd18d6	diritto immobiliare
d24829d8-6a06-4ffc-ae3d-e724d79e1bc1	applicare i diserbanti prescritti
d236c14a-fd0c-49b2-8538-2d237870fd56	pesare la quantità di foglie a sigaro
d24e3b58-e12c-4019-81e2-273ecba62993	rispettare gli standard di prelievo
d2549405-92ce-432b-a327-8ca16fe56111	azionare un ingrassatore
d2553fbb-a8ca-4287-9adf-468f3b5acbd2	effettuare un follow-up sui pazienti infartuati
d2901c45-26d0-4547-871f-0a35b0a6a13a	offrire consulenza ai clienti sull’utilizzo di materiale sanitario
d26e1f32-3782-4bdb-a2f3-1a6c7665147f	monitorare la meteorologia aeronautica
d273bf09-a9a8-4e47-804b-76601cb60ff4	eseguire le riparazioni dei tettucci apribili di veicoli convertibili
d2978fa8-2f8a-425c-95fa-595f03934ab7	metodologie di vendita TIC
d271cf55-463e-4bc3-9a15-82a742ffe8ad	individuare i difetti dell’infrastruttura della condotta
d29a2722-b59d-425c-8459-263f48588ee3	pulire i negativi
d291607f-8320-408e-b998-862afd9b3ee1	lavorare in modo efficace con altre organizzazioni connesse agli animali
d29e5d6c-b553-43e2-b6e1-ac52b93ca0fe	comprendere il lettone scritto
d29ed55b-a96c-47fd-a44e-646a756361f4	garantire i requisiti speciali per le merci in magazzino
d2a03ea9-f9aa-4516-92b8-f98fa806c7ac	conservare le materie prime alimentari
d2a79b78-33d2-4745-830a-e389055a2798	fabbricare filati testurizzati
d2ac6ccb-9b62-4e9f-8641-12ebb7dbe890	analisi grafologica
d2ab430c-4e03-482e-9837-c77268d26a98	effettuare la manutenzione delle attrezzature di acquacoltura
d2b466af-0ff5-4806-93b3-444ff022e718	processi dell’ufficio finanziario
d2b87858-f187-49cf-8c11-2073d3e64f26	monitorare i bagni galvanici
d2a73019-7cd6-4fc5-8462-f3763f69b533	adattare l’insegnamento alle capacità dello studente
d2bab464-5c37-48fd-96db-e5c513115982	cause di danni alle superfici asfaltate negli aeroporti
d2c066d5-9f32-437d-b91e-9a08800579a9	dimostrare la volontà di apprendere
d2c525ab-df23-484c-8458-23722f88fceb	gestire l’impatto ambientale
d2d8e5fd-46a0-4e89-927e-fa292a1f4d50	essere addetto a macchine ricalcatrici
d2cf3269-c02c-4d6c-8cef-c2cb31edd6de	dirigere gli operatori fotografici
d2d9148f-0023-4d04-bd6a-a79f5ccd42d5	condurre una ricerca sul genoma
d2d0947a-e03d-4b3c-93c5-d3584c5136b4	analizzare i processi di informazione
d2e70bea-f753-4c75-9c3c-3a50739f122f	coordinare la produzione artistica
d2edc8e3-9fd0-4778-86a7-a1d03623fa1e	pianificare a livello territoriale
d2e9e939-b089-4ecf-927a-065debb770d7	processi di fabbricazione
d2ea7a56-b2d2-4e8e-96d4-51f0b178f37e	assistere i clienti con esigenze particolari
d2f795e1-3626-4459-bbcb-2cc12dfb8968	azionare le attrezzature per la silvicoltura
d2e8d5f2-4f59-4482-b93d-d3a79a312723	controllare l’uva
d3072c42-b3bf-4024-ae66-4522e5396550	ragguagliare gli ufficiali di giustizia
d30d73eb-ab9f-4c8d-a290-9d7e841a7aaf	comprendere la dimensione emotiva di uno spettacolo
d31c0f0c-ff8d-418d-bcd8-f1438983e086	analisi di mercato
d31c2f1f-cb78-471e-814c-feacc4bf43a6	normativa ambientale nel settore agricolo e forestale
d323eb14-45e5-4731-883c-9e83ebdd9861	fornire linee guida per lo sviluppo di contenuti
d32661e1-b2ff-4cf3-9e3a-b2dec0ab2986	dimostrare la musicalità
d2f40398-796c-4a97-a90f-070beebc7de6	offrire consulenza sulla produttività del bestiame
d3227d82-e70b-4b43-9ba6-ef8046859653	formare i rivenditori
d314a746-a744-4143-b7da-9e985d552920	istruire i dipendenti per aumentare l’efficienza operativa
d32a381c-f578-4f30-bce3-37af20c4d56c	utilizzare macchinari agricoli
d32c8b48-9845-417b-894a-8d98f315e14f	eseguire le riparazioni delle audioprotesi
d33e22c8-622b-49e4-afe0-399960d87fff	preparare i campioni di prodotti chimici
d32d648b-e923-4ac9-a8c5-85c271ecf4f9	lucidare la verniciatura ultimata
d3513036-7897-42dd-9cf4-a975e59f5698	mantenere l’inventario delle operazioni aeroportuali
d35959c9-75b1-4d66-b6ac-24004a986eec	gestione dati di prodotto
d379797a-0fa9-452d-84a2-e9acd6fe8a69	gestire la diversificazione delle operazioni marittime
d35b1218-76d3-40ba-be2c-43a13701dd18	garantire il rispetto delle norme ambientali nell’ambito della produzione alimentare
d361fd80-91bd-40e1-88a2-7a79ebe3cb64	pulire i mobili in marmo
d37ef6f7-06bb-4d51-a869-2bc0ed2da780	controllare i dati
d374565f-a2ee-47c1-9859-70d6bb5b22ab	empatizzare con l’assistito
d385d042-7241-453f-b0cf-19296823d023	sostenere i fruitori dei servizi nello sviluppo di abilità
d3622cee-20b3-448f-a1e8-1b05ef76e252	utilizzare apparecchiature di misurazione di precisione
d38f8a42-f12a-4af9-a5dc-7ed683008b46	suggerire le battute agli artisti
d39b151b-d6dc-4e2f-b7cd-8f061531e0a7	prodotti per la cura dei mobili
d3a540aa-2fed-4f05-9dd2-1502ea42894e	processi di gioielleria
d3a748df-8c6d-4f9e-8a96-eefa3f164114	utilizzare i macchinari di salvataggio della nave
d3aa93ae-67ac-44db-a760-3455e558379f	rilevatore del moto di serpeggiamento dei veicoli ferroviari
d3a97edb-f76e-4108-879b-cd2390a6e2f1	gestire le richieste di nuovi articoli
d3b1993d-77d0-459b-a355-99d59adbfef5	scrivere in catalano
d3c3497e-8d33-495f-b1eb-45205749f85a	convertire in pelle gli interni di un veicolo
d3b88a04-f744-4850-a459-7cad91595dae	movimentare il carico
d3cce0ca-d536-46f0-a9b9-1028085e055b	azionare le attrezzature di emergenza
d3ce1f20-9a82-46bb-8a51-7d07760da3b2	gestire dati
d3d529e7-270f-4b56-873f-a5024e3ba4b9	vendere utensili elettrici
d3d539e3-a851-4b58-9ceb-7d48e920d95d	comunicare su questioni interdisciplinari in materia di etichettatura degli alimenti
d3da01fe-a2e4-4a60-864a-b6508c982be9	gestire le infezioni nosocomiali
d3dde3b1-6902-41cf-8404-e80eeb9c53d5	rinnovare la prassi artistica
d3d00950-9360-4ef0-a7ad-cf2f1b4d1eca	radioprotezione
d3ebf537-f3e8-4cf1-9780-efc109511266	comprendere il norvegese parlato
d3c99eb1-699f-488f-b2d2-70013d422f5e	utilizzare le apparecchiature tradizionali di misurazione della profondità dell’acqua
d3ee3b46-be1c-4d19-a5cf-f27d6e74c823	garantire il rispetto permanente dei regolamenti
d3efa1a6-7cf0-4999-bf2c-b1c6ea636d22	condurre prove sull’abuso di farmaci
d3e95920-f2f0-426e-9615-d2ea901a78db	redigere una relazione di taratura
d4003065-c881-4541-a9f4-6ea784116ea5	pulire la superficie del legno
d3f54eca-05a0-4b71-a52b-1df9e00169a2	analizzare i sistemi di informazione
d40f8c56-3d07-4203-9172-a03964235b43	utilizzare gli strumenti di marcatura tipici dei magazzini
d41893ca-7493-41e7-b953-56cd05db0ccd	dimostrare la conoscenza degli standard di imballaggio
d407e6da-8fb7-40fd-9182-b2bb8ac74419	riferire i reclami dei clienti relativi ai servizi igienici
d41ad5f8-2d60-41e0-a509-e775cd7522d3	pulire le zone incise
d43e580b-d982-4175-be44-a233865a9328	offrire consulenza sulla nutrizione minerale delle piante
d4411f7e-1cea-4262-abaf-cd6fb0497b6b	costituzione chimica dell’uva
d4374b34-da8d-4584-88a7-0ec01a165f45	offrire supporto ai responsabili
d447b5f4-6707-46fc-bff7-ccdc40895624	preparare eventi di formazione per gli insegnanti
d4208276-1867-4453-b10c-c021ea8af5e9	scrivere relazioni sulle locazioni finanziarie
d4401893-5201-4b9d-9dcc-7ffac470e573	formare il personale sulla gestione del magazzino
d44b6aac-c4dc-405d-9815-9be17a4d6c9f	gestire il libro mastro generale
d44ded0c-6781-48e2-b3ef-329b88889f51	tipi di berta
d44f4ecb-9d16-4dd5-b10f-7db31716c668	esaminare la documentazione finanziaria relativa alle merci
d451a919-5f51-46e8-952b-f88994d8154f	gestire un archivio edilizio
d450aafd-a7fa-4e24-bed3-9dc97df1742b	stimare lo stato della pesca
d4540850-8985-40cd-a5b2-40cf562d2439	effettuare la manutenzione di apparecchiature industriali
d4604035-d037-478f-b7ab-47569c562f95	cura degli animali giovani
d44f9100-c109-4fff-aeef-211bda65d6c2	osservare i ciocchi
d46ccdc6-bb13-4de1-b856-15ad020a8d77	riconoscere gli articoli contraffatti
d465f52e-9727-4cee-ac48-0870c76ee5b7	pulire le attrezzature petrolifere
d474ec01-2827-4c48-9e87-50529b1e531f	tenere il pezzo metallico nella macchina
d47ceacb-b241-46c2-9e0e-93ccd4331dd0	sensori reed
d47fc151-77cd-4502-9e59-a96258ed55c5	rimuovere i manifesti
d484417e-56e1-4960-b5c5-d733ba75f70b	tingere i capelli
d48754d2-f961-43e6-89ad-234d5dd27ac2	creare un piano di produzione alimentare
d480ae94-49a5-4b5e-ac59-ad63be240b5b	regolamenti di importazione ed esportazione di sostanze chimiche pericolose
d4939943-1444-41eb-902a-2e78b65ced6b	controllare il bilancio di un ente di beneficenza
d490b55c-3f1f-457e-b5e7-07472babbc29	schiacciare l’uva
d496d44a-5753-4d17-98cb-cadd62cd9e07	redigere relazioni tecniche
d49cfac1-5723-40a2-b96f-7251abe7f007	disegnare abbigliamento
d4aafeee-b279-4d51-bdaf-0ea1bb70e343	tipi di pensione
d4ab29c6-2f30-424c-8791-0545493f6049	gestire le licenze di importazione ed esportazione
d4998a9a-f1e2-446e-b720-618d9b6e6c24	condurre le truppe militari
d4c6524e-a124-4d87-9c1e-be05c8a298eb	sorvegliare il forno di ricottura
d4c8838b-4ea5-492a-8a7c-8f5642326507	ecologia
d4c93301-8b92-4dd5-b550-6b22c2320e21	effettuare le operazioni di navigazione
d4c9e5e6-fd82-4ca9-a2ea-0c7efbe7f0c9	utilizzare un ondulatore
d4d4c43f-75ad-406d-9318-8e7e2f7ef51d	trasformare il look dei clienti
d4d5a0bf-d568-45e4-a1e5-9e987906a881	vestire i defunti
d4e506d6-7250-443d-8f79-4d3fb86425da	tanatologia
d4cdc341-0b9e-4700-b586-66569f84d8f6	formare il personale sui programmi di riciclaggio dei rifiuti
d4bff21b-3449-4c4f-bdb1-43530befad58	valutare l’impatto delle attività industriali
d4e1daa7-0ec1-405f-9e07-9909266420ac	organizzare le operazioni dei servizi delle case di riposo
d4eb3172-6879-4a8c-9cd7-cd598f1905d3	comprendere il macedone parlato
d4e9d903-3c40-4b2b-bcd0-ce736178a323	assemblare robot
d4e51a54-4694-4b57-b1c4-d6e662eb6627	essere addetto alle vasche di deinchiostrazione
d4e9cf57-677e-40f9-8493-0d304c1cc85f	fornire consulenza sulla manutenzione dell’attrezzatura
d4f8c8bc-600e-4d35-a748-9cbbceca60da	recitare improvvisando
d50702d1-21f4-4303-b5bb-b681ff1c0d0e	sviluppare progetti di software
d504572d-3a2b-4b05-bc76-877cebc24ade	divulgare le informazioni sulla normativa fiscale
d5129763-6666-49c2-aa77-bf11a7018583	metodologie di project management TIC
d5015286-caed-41c3-aaef-66cbca397ca4	riparare apparecchiature ottiche
d5089533-a6ae-4a7e-868d-0c6755d05ea1	fornire informazioni veterinarie professionali al pubblico
d522c55b-bc4e-42bc-b61c-bc9c90668659	praticare le arti marziali
d522f573-77d8-4edd-ac8d-571b9993727a	effettuare le indagini ambientali
d52ae489-c1f7-4849-bf59-f1fb47283ae5	diagnosticare i disturbi mentali
d52c65ab-3d46-46f2-95c7-ff1ae4961c4c	progettare attrezzatura sismica
d52a40ab-26bb-42f6-bf2b-ad92b77af1d2	definire la strategia di comunicazione e media
d5283fdf-74c7-4259-ad33-e098dd276752	adattare le priorità
d5373787-9293-4300-9d56-e2457ed63ac7	lavorare in modo indipendente nei servizi di noleggio
d5386a59-bc02-42c0-9074-ed08836e23fd	fornire assistenza ai fruitori dei servizi sociali nella formulazione di reclami
d530ae56-8d7a-44ab-8d2c-85d6d76f3db7	fornire informazioni ai clienti sui prodotti del tabacco
d54b783b-fdba-41e2-991f-4f57dd75e506	praticare gli arresti di emergenza
d544a978-a97e-4d7f-8f1c-b34c6b39e9ac	uso di polveri per operazioni di forgiatura
d543b18f-4aed-4d18-8380-2c64fb047c66	supervisionare il carico delle merci
d54fd2ea-1d67-4d56-8a96-7c32ef36df1c	cibi e bevande sul menu
d558d37f-49f7-4881-8055-3a36b11230a6	offrire consulenza sulle modifiche ambientali
d55bfcb0-d30c-4853-9356-14bd8416e7f1	mantenere la nutrizione del terreno delle piante
d56000d4-fd6f-42e9-ab71-34a8fc42fa48	fornire consulenza per la gestione della rabbia
d5662877-8ef5-4873-908d-41d4d52e84e5	condurre uno studio approfondito degli stili di birra di tutto il mondo
d57ef1aa-49e4-424d-ae4e-d28132461faf	ribobinatura a freddo
d5662233-b9c4-4db2-8065-4592f4257961	organizzare il lavoro dei dipendenti nella stazione di servizio
d56e970d-e242-4464-8d49-91d1a2ab0fcb	installare rivestimenti delle pareti
d581894e-01b5-4d85-a493-f21fed8e6e7b	Azionare attrezzature per la lavorazione del pesce
d5838b3a-5707-4acb-a535-f54b05cc03e2	insegnare la teoria della guida
d581f738-56e6-4d98-a511-41464294905e	metalogica
d5888cf8-e736-4dd6-a365-2d737acd99c5	raccontare una storia
d58d7d90-108b-4abe-8db8-581464e140db	grafite
d56e60f8-fbc3-45e1-8009-009a8a0f41e7	definire i ruoli del gruppo di sostegno per il programma delle attività artistiche
d59b6115-ab2d-4b36-af9c-583cadbf1f4c	fornire sostegno in materia di ingegneria petrolifera
d58f1b33-1c64-43d4-af8a-240f2d41fa16	configurare le strategie di determinazione del prezzo
d59dc6b0-1c5e-4c4a-aefb-e5ab85ae15af	azionare la macchina traccialinee
d5aba7ac-edb1-4f66-aa8a-ccbd3ed56c25	valutare i rischi del trasporto
d5ba27d2-79c8-441a-9f9b-6e50e15d3b27	fornire assistenza per il cambiamento della rete della gabbia
d5c2739e-dd8b-4fe5-a523-c56c77322762	tecnologia delle macchine di produzione di tessuti non tessuti
d59cd708-c6f3-46e1-a9f7-6b3d7958278a	registrare i difetti delle rotaie
d5a8e60b-a655-4440-872d-054f92d1a842	presentare report
d5cc0ba7-9a3a-4074-bb5d-1243d18d9a6c	tradurre testi
d5e2b625-9678-413c-8a4c-5bface09cfd2	costruire i recinti
d5e6f79c-38ba-4172-9176-17c6c542d80e	scaldare il supporto per la formatura sottovuoto
d5f756c3-1325-4257-9e4c-6aa3bccac76f	fornire assistenza agli audiologi nello screening
d60f414d-15f1-4782-90d8-b2c5a3ca771f	collegare i tubi delle bombole a gas
d5f00b07-9ba1-419e-a257-bb1da123c0ee	analizzare i dati dei clienti
d5f5f622-a876-40f3-b02a-656e73f31011	gestire i volontari
d6101082-feaa-415c-85c4-11888fd4c795	prevenire la perdita di calore del forno
d614d2d2-467d-4b1f-aeaf-32e33b8f155b	applicare la strategia di coinvolgimento del cliente
d61a0ed8-12de-4584-a0fe-69ed9fb46c26	addestramento di animali
d622d69a-436f-4c05-9b02-4058cb8c47f5	comunicare aspetti relativi all’esibizione
d6240d7b-2f5d-41ba-9821-1bdf712adf97	assemblare sistemi elettromeccanici
d62355e8-d555-4f3e-af89-3f558291346c	lavorare in collaborazione con i fruitori dei servizi sociali
d633df17-294b-47c4-bb53-884d5418c56c	analisi chimica dell’acqua
d62f7849-2afb-474d-ae6a-a3a015d8666d	consultazione
d63b1c26-dcaf-4245-9a3b-3a6d5e7f66b8	controllare la normativa nel settore dei servizi sociali
d5b0a913-3c5a-4798-955f-13273122b71c	utilizzare carrelli elevatori
d6475c59-4bda-480b-a8a9-85bb44a324f7	manovrare le vele di un’imbarcazione
d635bf2b-353d-42ae-8e71-f6e1ec7f045c	attrezzare il vano corsa dell’ascensore
d63dd234-baef-4079-9779-e32744bee104	analizzare i dati scientifici
d64ecfb2-395f-4ca0-ba1b-0b0e52bc886f	vendere i beni per la casa
d65943bb-c67b-478b-b7ca-9d9814496f1b	interagire verbalmente in hindi
d6629278-264c-484a-bf02-340254b1f292	eseguire un intervento chirurgico agli occhi
d618c18f-aa5a-48be-acbe-8162c9141704	analizzare i dati per le pubblicazioni aeronautiche
d64ab40f-2212-45e0-8e7b-f5ef3c45376f	collaborare per discutere i piani di trattamento in psicoterapia
d6646558-4635-4bf3-a72c-50a91bf29f96	dirigere le funzioni logistiche per i cicli di vita dei prodotti
d66b66a7-67b1-4e30-870c-f8773313f649	eseguire le medicazioni di ferite
d678d0d8-d5f1-41c9-95fa-0220953df58e	gas di scisto
d68b4b93-2f22-4176-a0b9-aaab7842a6b0	valutare le possibilità di copertura
d6926c8f-3d04-4ebc-ad25-15dfe0e417c4	eseguire le analisi al computer di strutture geotecniche
d6a23894-b467-494b-8853-a5173a2353e3	garantire la salute e la sicurezza dei clienti
d6a6932e-6e68-4ef9-9af7-0da605e60604	gestire le operazioni di stoccaggio
d692a373-e666-4ce1-b28a-a657c26482d0	software industriali
d68fc922-9975-45c5-a580-77f9ab6c0fc2	collaudare le operazioni dell’infrastruttura di gasdotti e oleodotti
d6af881d-b356-4e1b-b95d-d82dbf53e5c5	coordinare tour di esibizioni
d6bbb753-1103-4ad9-8f09-f72e592b0d7a	costruire dispositivi pirotecnici
d6c28fd7-cd26-48cc-b1c3-c26e7caf9a3c	produzione di armi e munizioni
d6cb8f57-55d7-4be8-aa58-074baec45347	insegnare i principi del giornalismo
d6c7aa83-4397-49bd-a650-1cd720358e5e	garantire che la nave sia conforme ai regolamenti
d6cdd4c3-97f8-44c5-803b-f76c17b08d0c	guidare autocarri con macchine cippatrici
d6cf5557-9fa0-495c-9305-5572807b30a6	gestire i reclami degli spettatori
d6c7632a-0a2e-4f8c-ad78-f7a07d3028ba	convertire documenti da formato analogico a digitale
d6d17f26-1402-429a-b500-b8721850afda	diagnosticare i motori difettosi
d6d460e1-abda-42b1-b774-170227c0f76f	testare i dispositivi protesico-ortesici
d6b7d17c-0486-4823-86b4-9f473cd0dba8	eseguire le riparazioni e la manutenzione di carrozzerie
d6d808dc-dd9b-487c-a381-6150f826bf87	comunicare in modo efficace nel settore sanitario
d6de96fb-6abd-413a-9595-429ebeab3085	valutare il ciclo di vita delle risorse
d6d8a04f-656e-4e4f-bb14-8d7e0c89946b	effettuare l’analisi del lavoro
d6e19adf-a48e-46ed-b435-1ff3c04701b1	soccorrere i bagnanti
d6e39476-b009-4175-8ec6-99758d55ecc8	estrazione di dati
d6e20138-0693-4ecc-a2ca-f585b9d6f6ee	monitorare l’erogazione dei servizi
d6ed3291-ab39-4ca0-83dc-b809b21cf146	rispettare le norme di sicurezza durante le guardie in navigazione
d703353f-1a0d-4831-8e6a-4995cf358fd7	tenere un libretto della produzione
d6f7dc4a-55e4-4f9f-90ca-801ba37af9ef	tipi di vetrata
d6f2cff4-e2d2-401a-b8a2-163f67bfa273	rivedere i piani di costruzione di strutture per il trattamento dei rifiuti
d70371b6-63f7-4382-98cf-0534ab84a44e	aggiungere sostanze chimiche al fluido di perforazione
d706fae9-0d36-4dd0-899e-5447a5e12cc7	aromi alimentari
d7204129-1fbf-45ea-9b58-87b5cecaf57a	utilizzare un sostegno a T
d7230e21-1d00-4835-bbed-5d0258734bb9	caratteristiche della vendita all’asta
d7230729-fc12-4a27-9a4d-244afda3e198	psicoacustica
d709c0cb-8153-43b6-a93f-4bb1cb6a9f99	comunicare i risultati delle prove
d71387e6-4a5a-4fa3-b686-384205121caf	comunicare le regole della casa
d725a941-24d7-4b32-8e0b-167b9708468b	posare il condotto fognario
d72c7e4c-301a-4f90-a124-7195a7b5e050	produrre valori bollati
d734fec9-6ab4-4c1b-a72e-fd9c20e11b9f	eseguire i trattamenti radioterapici
d72d79e5-1b17-4970-935e-e2182be57512	sistemi di gestione dell’apprendimento
d738625b-ece9-4228-8bf2-69b00bcde497	utilizzare una macchina per il controllo della cellulosa
d7386523-6541-4c57-bbd5-6c9ece68d18e	comprendere l’urdu parlato
d7313728-966b-41d4-a7fb-7c9f5b743d9a	mantenere un archivio dei trattamenti di acquacoltura
d72fb86d-fb76-4dff-a48d-5c613630cb18	formulare regole di gioco
d73d712b-6ab5-4166-b266-7476e3ac2106	controllare la valutazione
d73ee380-75d5-40b9-9df7-9249e9cf8886	preparare la carne per la vendita
d738f2fa-abaf-45dc-ab79-27155fa7a7c4	identificare fornitori
d73f56c7-bbf0-48e8-918f-9dd5867c7e50	coordinare la movimentazione del carico
d745c3b4-8670-43ce-9bff-070d3a6a078e	eseguire i compiti amministrativi delle piccole imbarcazioni
d746d9c4-3e7f-4d4c-bace-2a4d67be42a7	insegnare filosofia
d7501285-11fc-4d84-9cdc-682b88016de4	predisporre gli elementi di una scena di un film di animazione
d755be76-b1af-493b-a42b-ed46a1798237	organizzare i prestiti tra biblioteche
d7468394-8b78-4489-95f6-4a2491d79645	controllare le condizioni in cui avviene il processo chimico
d75093db-12fc-4ee7-ba72-7321233af4a6	utilizzare il sistema content-type
d74c1430-44f5-41ba-9c83-228ebe4f6bef	informare i supervisori
d75baaeb-403f-45d4-84cd-c7240e242b0c	disegnare digitalmente le disposizioni delle scene
d7585c84-023e-48c0-8630-8121b972c07b	utilizzare il laser per la depilazione
d762055b-60d8-4202-ae02-b4f09ad9b0c2	registrare l’esito della psicoterapia
d771ed67-f81c-4b6c-ba92-ad4061147c81	trunking
d7648865-ea2a-42e8-b0db-50afb5e2da6d	verificare i motori del treno
d77fc186-12dc-4449-b49d-9965ea4884a5	rimuovere i parabrezza
d77d6f5b-a4cd-487a-8a81-a19b95a36aea	applicare l’epidemiologia veterinaria
d796d7f2-e9f5-49c7-b1aa-5c203ebc3597	vendere elettrodomestici
d78d9a3a-b897-4b0d-80c0-2d264f715c6d	dispositivi optomeccanici
d785c6d4-be26-4028-86e8-eff24136a90d	legislazione in materia di salute, sicurezza e igiene
d79b5f15-e13b-41c6-a5eb-2c88d6e8bc1a	adattare il registro della voce al materiale audio
d79e3774-ea0b-4943-bdf5-bc9ef67fba43	effettuare la scansione di un animale per individuare un microchip
d79e784a-b136-4000-b586-d18046f05218	marketing di canale
d7a379dc-6e39-42d3-b2ba-751b7a545f06	occuparsi delle persone rinviate per i test genetici
d7abf513-5fea-4773-9419-6fff2d8cae22	riparare le scarpe
d7ab2e58-fad5-43d9-a56a-4948dc353df8	trasferire la vernice
d77cefb5-1746-403a-a2e9-f76f896b232a	scrivere la documentazione relativa a un database
d799ade9-538b-47ab-bb07-6b114b352bfd	integrare gli interessi degli azionisti nei piani aziendali
d7be0862-1a99-4565-b266-575fc9339f12	dare istruzioni sulle operazioni delle navi cisterna
d7d2cec2-9b70-4b2f-aefa-4f73a9e913b7	tecnologia dell’imballaggio
d7ca692a-ab51-4ff2-af4e-c0adba083573	terapia Bobath
d7c90ade-b8ea-4d18-b7d9-03a82c93fb9d	collaborare con bibliotecari di biblioteche della musica
d7d123eb-2c75-452f-ae4c-4fa447ec7227	selezionare il canale distribuzione ottimale
d7d7bcaf-1191-4da3-a8e6-412d0e60d24f	manutenere i macchinari di termosaldatura
d7de9fff-d049-4bd3-824b-61ed183bdb29	utilizzare le attrezzature speciali di ausilio per l’udito svolgere dei test
d7dedd1d-aedd-47a9-a6d1-582251ea7e3c	trasferire le scaglie di sapone
d7d4d0cd-a9b3-4cf4-bf4c-ad6254610f9d	monitorare lo scarico delle merci
d7e1e783-738c-4918-8a50-323fa5f254be	configurare le attrezzature in modo tempestivo
d7daa099-99c2-4d03-bfbb-37a2076f85c6	garantire la sicurezza degli impianti elettrici mobili
d7ead92f-178d-456f-b21d-168ac196e611	scrivere in tamil
d7ed1d3f-5f8b-4886-9d31-4db14c173e94	valutare i servizi sanitari all’interno della comunità
d7e32473-d39c-4c9f-abbf-0e5e24b3ceb6	pulire il sistema di ventilazione
d7ed7c32-7063-4ee3-8f83-8afc0589cc11	microeconomia
d7efc56b-7f89-4261-ac24-98bb240b0f75	mutui
d7eab14e-8fa1-499a-a120-31dc8c9e8106	addestrare gli animali per scopi professionali
d7f385ae-357f-43ef-98c4-b48e7bc2645f	avvolgere cavi
d805f0a5-4a43-463a-a4b4-d9920f9faae2	rimuovere le bolle d’aria dalla vetroresina
d7f703d0-a30e-4b7e-b361-302446400f28	chimica tessile
d813bb24-2bda-4f34-83e1-5d5931b5d01c	ideare gli spettacoli di marionette
d82ab7c9-61ff-4a5e-90ee-2899ae52f25f	leggere i piani dei circuiti ferroviari
d8365cf4-ca78-4d86-b764-608edc5c8caa	eseguire un trapianto di midollo osseo
d8230d69-05b1-460c-86f1-f811e5b2c172	garantire l’alimentazione elettrica del sistema tranviario
d82c7856-0b9e-4084-809f-c156e9a2492d	adattare il lavoro dei progettisti al luogo dell’esibizione
d8077356-845f-45fa-b6fb-e27ea59c153b	elaborare strategie in materia di salute e sicurezza per le attività estrattive
d80e8433-8548-4081-b541-efc921c3102e	segnalare gli incidenti di inquinamento
d83cdee5-45ba-4787-a770-8fd539e52038	ottenere le licenze pertinenti
d84d8b84-1244-40e5-80e6-cf4bdbe2a964	verificare la conformità alle normative sui rifiuti pericolosi
d8444e26-8180-4cbc-beac-ae6ae54d44c5	consigliare i clienti sulla preparazione di prodotti a base di carne
d85386d4-4e9e-4b29-9018-3d490ef3bcaa	prevenzione dell’inquinamento
d86de510-d76c-407c-ad2b-2753e9a33750	utilizzare una pellettatrice
d8702f19-5ca9-45e7-844b-f764bac6fd36	impostare il layout del contenuto digitale
d8693c84-d9ca-4e28-b518-db064b775e93	definire le politiche organizzative
d878e1be-cc45-4650-a4e4-aa210e9cdb06	utilizzare un sistema di controllo dei movimenti automatici sul palco
d872a044-2bfc-4494-a4f8-a32f9da4e6d9	elaborare i metodi di valutazione per la musicoterapia
d887a542-6ad4-400e-9015-7c4bcc2dea8f	tipi di aghi per incisione
d88f4d70-3408-4853-95bf-85090498554c	archiviare documentazione scientifica
d889bde5-ddd2-4fb7-8c6c-5639414d5e9a	offrire consulenza sui servizi funebri
d898a670-a076-4e51-b8ca-1f7af0ce684c	creare immagini digitali
d888a7f4-6934-430f-aa13-4644ca573f32	fornire informazioni sul finanziamento dell’istruzione
d8a25984-827c-42f7-a99b-c5f5fb33ab70	soddisfare i clienti
d8945409-b2d1-4f60-82ce-6f89016640f6	gestire le informazioni di progetto
d8b19334-0b4f-4518-8b5a-e3cb2ce6ae0d	definire la struttura aziendale
d8b88416-0ee9-4a7e-b5da-d814b0ca3e54	dirigere i direttori dei reparti dell’azienda
d8b95fba-6ac9-4e28-aab3-81083e13045e	utilizzare un forno per la ceramica
d8c5a25f-ef39-4612-97ee-10cc634dccbc	aiutare i clienti a prendere decisioni durante le sessioni di consulenza
d8c639d4-9d5c-4edd-9bd7-4cc983ae101d	fornire un trattamento parodontale
d8c0cac5-c8ef-469a-9249-117672404a68	adattare lo spettacolo ad ambienti diversi
d8c821d7-a8c9-4cea-9376-7b222b817579	prestare attenzione alle possibili alterazioni dovute all’anodizzazione
d8ccad74-ca8b-4364-acbe-8260049da0aa	antropometria cinetica
d8d0344f-ff8c-4fbf-80f4-4b8f5e92a7aa	offrire una pratica clinica avanzata in fisioterapia
d8cd128b-9f08-42a8-a918-074ecc841c25	supervisionare gli spostamenti dell’equipaggio
d8d14a39-4e1c-45bd-8613-f26ea8e4f71f	mescolare le erbe nelle cisterne
d8e608d7-7f6a-4215-b5a9-5bed3c0d70ed	trattamento di rifiuti pericolosi
d8f58297-5ecc-46ef-903a-2f81a03bc82f	intagliare materiali
d8f19f10-00f2-49cd-af15-165e401c9dc2	promuovere le politiche per la salute e la sicurezza nei servizi sanitari
d8f63422-91fe-44c8-a293-b98875acd45e	eseguire la goffratura in senso inverso
d8f9562d-074d-46d1-b57d-a52aea1c42c0	assemblare apparecchiature di strumentazione
d8fa787f-0649-4b81-8bae-7a10b0c1e2dc	ricollocamento
d8f75352-c4d3-4f93-b743-ec3b4208af4a	comprendere il gujarati parlato
d8ff5261-4809-42df-92b4-81c8afc83dc3	fornire programmi di allenamento individuali
d90dfe3f-9cbf-4e68-a85d-7e8fc69fb905	prestare assistenza ai passeggeri in situazioni di emergenza
d8ac15df-7771-4f47-b2ae-4af3f00275f6	coordinare lo staff
d92d5abd-ffd4-4eba-85aa-cf11748aae1a	pulizia di imballaggi riutilizzabili
d946db55-ab2a-4840-a13e-acc81912bb9f	chimica inorganica
d94969c8-4703-421e-9c44-f5d5022f6b58	riparare i difetti delle anime
d933db3e-fc59-4166-8fff-8451633d170b	decidere la tecnica di creazione delle parrucche
d917ff46-38ff-4365-8260-634222acf2e9	garantire la qualità dei servizi meteorologici+H40
d94b54de-0443-4fd4-b27e-2e68ecf576aa	scrivere in finlandese
d94d9d32-c565-4098-a65c-8539db924a11	riscaldare la colla marina
d94e3aa7-91b2-44e4-802a-3bbba05d7e9c	effettuare la manutenzione di gioielli e orologi
d94e8b3b-cf33-4933-b7d4-92ce23c7e175	riparare le lenti
d9520765-a0a1-4f1f-bd27-41173fb3a384	infezioni alimentari
d953b5c4-4611-4bfa-9583-7418dd05b7b8	far funzionare il sistema informatico di gestione della concessionaria
d9508b0a-dbfa-4af7-bd70-1faf157217c6	funzionamento dei diversi motori
d95d459e-0fb6-4ebd-921d-4880a457c3bc	organizzare le risorse per la produzione artistica
d96f794a-6956-401c-986e-572bf4dd3cc2	numerologia
d98b8682-e22d-4380-b5f7-a1ea03769de4	asolatura
d97835ba-9052-4c94-b67b-03e1d421ca57	migliorare processi chimici
d96e4cd6-2d7c-4d7d-a2a3-d3bf6633ee2a	mantenere i contatti con le autorità di sicurezza
d999e10d-6c1f-48fd-90ba-b79f7f53bb42	indagare sulle restrizioni alla concorrenza
d953a03b-8bc6-4a07-8a51-90655dc8e480	gestire il personale geotecnico
d9ab4b2b-c67a-4c8c-b832-ae6e3946e45f	tipi di frecce
d9b6554b-402c-472d-9b7f-0dc77a709b73	valutare la qualità dei cereali per la produzione di birra
d9c1589b-4793-4457-8df5-e0d3d6fbb017	meccanica dei veicoli a motore
d9c4c973-a15c-4ae1-a8a6-3a4d013f64e5	progettare orologi
d9bbe972-cb77-4e44-9140-6fe739e737b4	segnalare l’interazione di un farmaco al farmacista
d9c76b79-3056-4a0d-981e-13bbf195e24c	rispettare il codice etico degli affari
d9c788f2-d08c-4bbe-a2c9-50c54749210a	accordare gli strumenti musicali a corda
d9cbcfa6-1974-4bc4-ade8-15cd854a404d	utilizzare i fotoreattori
d9cc4464-a761-43db-ae71-b5ba1f6586b6	valutare l’integrità strutturale della nave per l’uso marittimo
d9ce8e28-f112-4f51-8aeb-1034b4e9b2b1	applicare le procedure di manutenzione dell’illuminazione aeroportuale
d9d82f1b-9629-4688-9f61-a6a67d2a96ef	processo di produzione del cioccolato dal cacao
d9dfd5ba-fb23-4b6e-8a61-955e83e08011	elaborare concetti di marketing urbano
d9d63d4d-a954-433d-ac35-0b1281ed66a8	revisionare il processo di sviluppo dell’organizzazione
d9e22dcb-c8f2-42d6-8f5d-ee0e19d4c5c4	diritto contrattuale
d9c9a443-7e3f-480a-9d7f-bac4922ef65d	Erlang
d9ff0b9e-35f8-4cca-8dd8-80a36f434d84	comprendere lo svedese scritto
da01f617-9ed0-466d-9b57-2a6d2ca6a9f4	preparare modelli di prova
da028b02-2ff1-43ba-8066-cdd4c66f207f	gestione di progetto
d9d3a4e4-5186-4a19-b470-082da92ac7b4	utilizzare la musica secondo le esigenze dei pazienti
da063354-3680-45ce-ac4f-d5cb5a2b08eb	fornire consulenza in merito alla produzione della miniera
d9ed7f70-b92d-4472-8ca7-450e324db304	gestire i processi del flusso di lavoro
da0b4af2-a33f-486b-921a-824002d7fcd7	gestire le apparecchiature dei sistemi di ricircolo
da0dbf4b-8a00-40e6-b927-6e8d74e8926b	prevenire l’inquinamento del mare
da095ba0-3137-4551-976d-9734a2e2ae1b	manutenere l’attrezzatura di laboratorio
da1dfd89-1667-4c11-9480-ccb727444406	predisporre tavoli
da19b365-874a-446f-a8a6-86f933341b4f	etica
da27de17-aec5-4277-960c-262daf6ab8c4	usare linguaggi di markup
da35f203-a0af-4dd4-8d4a-81f916db069a	audiometria
da3d3645-cc1b-43a1-95c1-88ee82a2c693	sviluppare gli archivi di intelligence militare
da3d9638-67e6-4eac-93c2-58b2dfa22142	utilizzare un centralino telefonico aziendale
da3ed48e-2a03-49ab-b4e6-57d6cc3e3002	trasferire i pazienti su e da ambulanze
da40c0d8-a511-4ad8-a38b-79dbc93d6e70	modellare un oggetto in metallo laminato
da4ad501-9031-45b8-8a92-9e507cd7409b	utilizzare il filtraggio biologico
da3f6f25-da14-4ced-9ec1-afd3d601a2f0	individuare le minacce alla sicurezza
da516e79-8b9a-443c-9c5a-9d9e99f97d65	prodotti chimici per piscine
da4e0afb-59b5-4525-bbbe-6d6308d6b9bb	effettuare la manutenzione dell’attrezzatura per la rimozione dei rifiuti
da52681b-158e-4786-94b2-470d4cf76c2f	utilizzare attrezzatura per la levigatura del metallo
da45f57b-e5d0-413f-b4c2-239bbcac18c9	fornire informazioni sulle caratteristiche dei dispositivi medici
da5446e0-1226-4259-9889-6ba07ea568b0	trasmettere gli ordini di materiali tessili
da55900d-0f2c-4f4e-b2bc-35a82bf9e034	utilizzare le attrezzature agricole
da58832f-7477-4c59-91b6-ec9499549e4a	utilizzare diversi tipi di estintore
da5d0ebd-782f-4243-b3ac-fafee7231777	comprendere l’olandese scritto
da60a3df-3e41-4267-a768-9815b27efa56	creare marionette
da692e7d-8cbc-45ca-89be-2106f5f17636	determinazione del prezzo di mercato
da745a46-1517-4769-bfd7-7b252157e3ef	sci
da816345-d11a-4479-8e43-864259898557	sviluppare i programmi sportivi
da710d50-39e7-42d6-8751-30577fce4e4e	utilizzare strumenti informatici
da5f6232-efa5-4599-99d5-a087dca68ff7	garantire il rispetto dei piani di distribuzione dell’energia elettrica
da74e847-2425-46a8-b0db-26fd22d6b302	offrire consulenza ai pazienti su come migliorare i disturbi del linguaggio
da774935-4c06-4d44-bc29-884cb28163d2	eseguire procedure di prova sulle acque
da861098-30af-4797-ac49-45b8ef955fda	fornire un riscontro sullo stile di comunicazione del paziente
da8816e7-18c0-4f66-9892-bc10aab2306f	gestire la documentazione della spedizione
da86b895-4686-498d-be48-615a530f279a	valutare le prestazioni del motore
da89b209-fa60-49c3-bd8d-f941609b9fbb	compilare il bilancio annuale
da9769c0-95e6-4322-a882-ea9960604c90	collaudare unità elettroniche
daa6ca0c-84df-4a2e-954f-ee8e890a680e	dipingere disegni decorativi
daa60e02-7c0a-42e8-82ed-72ed0a950db0	tecniche di disegno manuale
dab253f6-c24f-4e66-8448-a9febafb1452	stimare le esigenze della produzione artistica
daa70741-61c6-4991-8a4d-973a07504ddb	effettuare un’ottimizzazione del motore di ricerca
dac06cd3-623c-468f-a501-75ba17d5bd47	definire criteri di qualità dei dati
dacbc2de-8e36-4c4f-9dc1-ddee189aa11a	posare le lastre di calcestruzzo
dad01449-fdc2-4482-8b49-13a6601ea9c6	configurare i seguipersona
dad0b6fb-614f-425e-9cb3-b21c1dc1d843	scrivere in sardo
daceb34e-beb0-46cd-b3d9-9ddfc0b65311	utilizzare un programma informatico di stenografia
daf0e4e1-b537-4c9b-b205-1aa713f4831a	mozzare le code
dad0efa8-1927-4205-a5f6-aef41dc35e2e	tecnologia di tintura
daef187b-2e4b-4d7e-b8b4-0155f7bf420d	creare software per testare i giochi
dad71986-0890-4a68-b22b-72f554966464	coordinare la formazione del personale dei trasporti
daf11242-0161-46b0-836a-f5e20cdef951	conferire con il personale dell’evento
db02239d-d1af-455f-aa75-00bc8367feaf	visualizzare le informazioni sulle scommesse
db178741-0890-4ea2-b2c0-7e7580f6ea8b	applicare le politiche sulle pratiche sanitarie
db0b6aad-746b-48b3-a3ed-276e3048bc85	riparare le apparecchiature sul posto
daf76a57-4f60-4e24-ab9a-b4902e902bff	seguire le istruzioni per effettuare le pulizie
db15728d-16f4-44c4-96dc-53f3b88d32e8	preparare il piano pubblicitario per la fiera campionaria
db16f54c-cc08-4151-8444-9b28ce76027b	motivare il personale addetto alle pulizie
daa30334-55fc-4ca9-b0a5-fe9719ff8298	John The Ripper (strumenti per il penetration test)
db18ef42-99c1-4865-8262-3c17c6b35b85	sviluppare un piano di audit
db329a1c-5bff-4d23-adf1-d04d9b4fd075	scrivere le prescrizioni per un farmaco in odontoiatria
db36e673-3b75-4d0d-ac16-333a9d652e43	utilizzare il sistema di ricircolo del centro di incubazione
db3f3286-8025-44a2-86ae-e205b24af07b	gestire le strutture di produzione
db4462e4-7262-434e-9b46-2d468e5dd8bb	disegnare le disposizioni delle scene
db50c5fd-f88c-4fd7-af81-c54c66431353	osservare gli assistiti
db49aebc-b7d0-4020-b51b-a4bc5705e789	riesaminare il processo di assicurazione
db59568b-9853-4813-88a3-72058e42384b	preparare il piano di trattamento del pesce
db68379f-f4f3-403c-9b11-777a46822f96	vendere i libri
db278110-b4df-4b47-ace2-e1e9524c3676	creare contenuti informativi online
db687d1f-a6c8-4ff3-a6c3-199afce46c2b	moderna teoria di portafoglio
db6847a7-83a2-4755-b3db-fdc1cdadb8a9	esplosivi
db81df0a-6c0a-46f4-817b-c3691e2a113d	registrare suoni a piste multiple
db7b3daa-1a3d-4a68-9cef-db94fc52c950	scrivere in romaní
db74df05-314b-457a-8a5c-a4cdbbf7ba2c	gestire le attività all’aperto di un gruppo
db9492a3-891a-4eca-baab-8b539ea27d83	utilizzare le attrezzature per la disinfezione dell’acqua
db867321-c67e-46a2-bba5-3b6c6bbc3f42	scrivere i sottotitoli
db98fb4b-efe3-4e90-b4a0-57006f212956	vendere i prodotti per dimagrire
db9f5bbf-095b-4a8a-a4fc-f50cb9dacbdd	svolgere una terapia di coppettazione
db606777-ac23-4ab5-93be-a8c9039c5801	valutare le influenze ambientali sulle zampe dei bovini
dbb17910-5af2-4334-8d84-eaf53803d959	percorsi del treno
db9a12ce-38d3-435b-81dc-ff210ea533d0	gestire forniture elettriche in ingresso
dba49c01-829d-4188-9cd7-78bc4d98349a	Moodle
dba65065-8164-4667-9bcc-e5e35d0f8f07	supervisionare i sistemi di rete della gabbia
dba64547-c425-417c-8410-ebcb062f24fa	sviluppare nuovi prodotti alimentari
dbb1f2b9-4bc2-4b46-bbd9-c0c632e517a2	berbero
dbb2a647-d51c-41a1-8d0a-352c445f6d6b	sviluppare driver di dispositivi TIC
dbb06260-449a-46f0-b148-ece6eec4230d	redigere relazioni di audit
dbb361a8-4767-437c-8151-86ac0a792bbc	adottare un approccio olistico nelle cure
dbb33a0f-d2d8-401d-b110-9267ce95e1c2	soddisfare gli standard della pratica nei servizi sociali
dbc62e38-1540-412e-997d-8f810fa1aabe	installare radiatori
dbb3c9c6-14dd-4c51-becb-5da3bd3fb651	programmi di allevamento di animali
dbc0a25f-a238-4048-9972-f68eba09380f	salvaguardare la reputazione della banca
dbb7fbfb-3623-4701-ae7d-3fb8ae139ff1	avviare il contatto con i venditori
dbc80f49-32a1-463d-b75c-db7971b7e127	fornire assistenza per cavalli
dbcc4e98-22fd-4ae1-8c11-fdf94cc18eea	mantenere i contatti con i membri del consiglio
dbcf74c7-ab71-4868-a3b9-7493f202ee12	dimostrare la funzionalità di prodotti software
dbd4abfb-c8d4-4a8d-abd1-9c2795486bbd	imbottire giocattoli
dbd1f11f-a130-43d6-88be-be4a5e48b915	sviluppare progetti culturali
dbce4a33-73c2-4433-89b8-f3ac206b5b8a	raccomandare le ortesi
dbe32dbf-16de-423e-b99f-57e7163ed827	dispensare i farmaci
dbe7a2a6-40a2-48aa-9e87-a199c218dc88	comprendere il tedesco parlato
dbf4e7b2-b4a9-4b54-93e1-143a15807c67	organizzare la depurazione dei molluschi
dbff8510-5f62-45be-96e7-37396fd79a3f	fabbricare rivestimenti tessili per pavimenti
dbfc76a5-3049-4e8a-a293-3bdfd305ae2f	normativa sulle corse ippiche
dc0c0c1c-533f-4b20-b828-83bb02c0118e	cooperare con gli istituti di istruzione
dc0fa6b4-576d-4060-8d4f-e6bd0ed78492	controllare le attrezzature sportive
dbf920c0-b45b-41dd-a03f-05a33e9b025f	monitorare lo sviluppo del settore bancario
dc214aa1-56bc-409a-9dcc-0c257ccfc3e8	guidare i veicoli per la raccolta dei rifiuti
dc219a3c-2966-472a-8bfc-579ab6e8f03d	azionare le macchine di lavaggio a secco e stiratura
dc30ab33-b3f8-400c-8951-c72c86446523	sviluppare programmi di viaggio e noleggio
dc324a11-48cb-4ef6-8db4-3c255e1c30ed	sviluppare protocolli di ricerca scientifica
dc37cc4d-7ae5-4382-a4b1-a32b37852107	gestire le attrezzature di classificazione
dc26c45b-91b3-4fd2-a160-e3dd7adb5481	gestire i contratti relativi alle attività di perforazione
dc40ebd4-b109-4699-b91c-91140da2656f	apporre le etichette dei prezzi
dc42d70b-2cfb-4a0d-9f9c-ecd683469708	prescrivere la terapia topica
dc5be271-eb54-4435-b68e-e3d82f22e778	macchina continua flessografica a banda larga
dc63baa5-1829-4e42-827b-cdda8ea94bfc	conservare le risorse idriche
dc48d4f0-2130-4033-a011-7ea2eedd9dd0	effettuare la manutenzione della zona di gioco
dc7101ac-8f14-4d9a-aa80-ef25e278a184	sviluppare i piani di organizzazione per la vendita online
dc666a44-fe3a-4d9c-9ff3-e01f8b0c8b23	consultare organizzatori di mostre
dc69f42a-137b-45e4-8996-07414196ead8	applicare convenzioni di codifica TIC
dc7d4f8d-271e-43bd-afad-1f56656fb86a	fotografia
dc825480-a11f-4323-909a-ac198875aef6	macchina continua flessografica a banda stretta
dc7777b2-60e4-4a15-98fa-fe412cc2e045	supervisionare le attività di distribuzione dell’energia elettrica
dc80de52-43ec-4caa-b84c-4111f9a7e8ba	componenti meccanici di veicoli
dc87582e-7219-490d-af7d-8d2762cf27eb	modellare hardware
dc8fbaa0-db2f-4c95-b629-d9b649b2913b	rilevamento topografico
dc94b92c-41e7-4a4c-944b-4b0502de4f84	comprendere il punjabi parlato
dc9ae07c-cdce-4876-bef1-7ef93c1a260c	preparare l’ambiente per la chirurgia veterinaria
dc800841-f549-4205-ba21-d4bf9c31d2a0	stimare il valore di gioielli e orologi usati
dcb2683b-60f2-4e90-85a7-b3a58789eecf	eseguire una stimolazione magnetica transcranica
dca36f26-1317-4f41-a274-6e3a2bfb6cf9	comprendere il bulgaro scritto
dca8175d-d258-44d8-9f67-01a22d719d27	coordinare le operazioni presso il pozzo petrolifero
dcbc92e3-e80b-4c59-8f0e-dc20ae795a41	trasportare il cemento
dc9c91c1-7f90-4dba-931d-5d16cb287f00	interagire verbalmente in islandese
dcbc1ce5-1ae1-452d-be2e-13d123820ccc	garantire la conformità dell’aeromobile al regolamento
dcc0100f-484a-45c6-8f6b-7f310519e682	tecniche di cucitura delle calzature
dcbd7915-4df6-47f8-9390-a042688ee81d	agire con senso degli affari
dcc7b600-8bf0-4efe-9b70-a0663caacf60	guidare un’ambulanza in condizioni di emergenza
dcc1d8c2-9328-4089-a793-4fe9ed3df397	tecniche di respirazione
dccd4fc5-9f21-4342-9e97-83e3b0717375	sviluppare procedure di collaudo meccatronico
dcbec939-1f47-4e77-9ade-d55cc1a74da7	monitorare l’infrastruttura di sorveglianza aeroportuale
dcd75641-2102-4feb-850f-47d3a40c30da	gestire le vendite di vino
dccef316-c45e-4081-8e0e-ff3796057821	gestire il materiale per gli imballaggi
dcd69cb1-4a42-4403-be0d-3a2d67a928ca	vendere i dolciumi
dcd91be4-e219-4f9f-b2fe-2ec10b630ed6	applicare norme sulla gestione dei materiali infiammabili
dcd92c57-4c64-4c5e-a199-594b3dff1ad0	prototipazione nel settore dell’abbigliamento
dcda9da7-2380-41df-b652-303e9f3160af	creare zone verdi nei cimiteri
dcddf65b-3a17-427c-b526-9c0a8cb65176	svolgere una ricerca sul lavoro sociale
dce488f7-a006-4904-9a18-a16e17ead007	supervisionare la gestione di un istituto
dcdc632f-56dd-4876-bf6b-748bd188fcf6	effettuare calcoli legati all’attività lavorativa
dce39d02-ddbb-42b6-81a5-fc78f3a788e6	effettuare la manutenzione della macchina per la stampa su pellicola
dcd9b0ee-e758-4535-923b-261ea8d37f05	verificare la qualità del vino
dcee453c-16e2-41af-9516-22d3050c0dd5	scrivere in macedone
dcef97c4-9227-43b0-9ddf-dccbfba0d26a	telemarketing
dce80016-75c8-4939-a5ad-50d232283fbc	Codenvy
dcef01cb-4979-4d68-a0b1-eb3827883f23	eseguire improvvisazioni musicali nella terapia
dcf1bac6-4413-4ee8-9eb7-a37727744a7b	microsensori
dcf89a37-09e4-4e5c-b39c-fc4d0723eabf	gestire un allevamento di bestiame
dcf78282-3fea-410f-be6e-a895ee8eb3d9	garantire la salute e la sicurezza del personale dell’acquacoltura
dcfe73d5-c292-40a7-9fab-4e94c3a5b295	sorvegliare il miscelatore di insetticidi
dcfb643a-f2d2-456e-8b7c-3d5876992348	monitorare la qualità della cellulosa
dd158625-2f80-4af6-8aa0-1c4c4c7e11a0	verificare le scadenze dei farmaci
dd149a30-b9ea-422e-9340-eddd91e060c8	identificare i danni nei luoghi pubblici
dd1f0074-70ab-4604-9b22-4395a9fda3fe	analizzare i problemi di salute all’interno di una determinata comunità
dd22663b-fc12-4ed8-a15b-0f42602aefe8	processi di trafilatura a freddo
dd22f12f-6abe-4307-ae4f-b6d6af99f913	comprendere il tamil scritto
dd27f360-d28f-45eb-89dc-60aacb036e5d	individuare la qualità delle cure dietetiche professionali
dd42b5fb-8bd1-4e3f-961b-bbef6524de3a	montare i pannelli fotovoltaici
dd441329-3177-45f0-903d-021ca04636a7	eseguire i cambi rapidi
dd23793e-bad7-4486-bc60-d2d5af2b0220	seguire gli orientamenti clinici
dcf9b9f2-3165-49b7-b2ed-5a676db4dadc	ispezionare le materie prime per lavorazione di alimenti per aumentare la massa muscolare
dd4cba43-d73d-4eeb-935c-2774b13facf0	riscaldare materiali
dd4e4679-a579-4305-81f8-8c6061531edc	eseguire le visite ortopediche
dd5c0f86-d4bd-4a80-9aa4-34d98a18c5e5	effettuare la manutenzione delle protesi
dd56b8a8-e19d-413c-81f2-71471dacd1a5	documentare la collezione del museo
dd5647fa-891d-4d9a-a73a-79c4c396a76a	utilizzare software di elaborazione testi
dd6641f8-e37c-4db3-9f97-ddc7c121b1fb	comprendere il portoghese parlato
dd6ebe5c-4dc5-4d15-aeeb-4c7928bece69	gestire le opere d’arte
dd66bd2d-1b53-466e-8d56-050501ed718b	calcolare le vendite di carburante presso le pompe
dd5ed495-a506-431b-8466-3647d1c299dd	pianificare le ispezioni per la prevenzione delle violazioni igienico-sanitarie
dd70da5f-d6be-4297-b4db-83edb23b668d	processi di forgiatura
dd6c9de1-6b69-48bd-8e6d-0cba760b4613	processi di filtraggio delle bevande
dd7104ef-e994-47ea-af8c-4fc381847081	posare un pavimento alla palladiana
dd7c670d-ffb6-4846-b854-04216b56b32f	alcool combustibili
dd7fa1e7-3dc1-4e76-b87f-1ef79caac4e1	garantire il controllo tecnico delle ambulanze
dd971994-5b69-4966-ad88-c5b7fc905657	tecnologia dei pellami
dd8d2566-a441-41e2-a346-2b78a6d64933	presentare richiesta di brevetto
dd817c41-b6ee-4753-86d7-2b107590db3d	stabilire il calendario e il programma per le campagne
dd95f319-1cef-43fc-9edf-8fc8c35931c8	completare prodotti in plastica
dd85ff6d-3884-456a-92e4-be98820b077d	Litmos
dd990ac1-e55a-4ff2-bc25-95717aacc969	dare lezioni teoriche a piloti
dda3e3af-71fc-4c7c-914f-8e21fcb05cb5	contribuire allo sviluppo di una struttura immobiliare per lo sport
dda84979-9c90-4aa2-8546-8389cd224efc	terapia cognitivo-comportamentale
dd9ba288-4706-4515-861f-5f4bd27027c9	valutare i rischi per gli anziani
dda95ccf-7e9a-4072-851a-a8529200a34b	organizzare il controllo doganale
ddac1df7-b35a-4e17-acec-325be2876d80	utilizzare lo scalpello pneumatico
ddaa38a3-dcc1-4c42-be30-291b57246d37	far fronte a circostanze difficili nel settore veterinario
ddb332a8-0fa8-4828-a6b3-e92c09b48c0d	ricercare i prezzi di mercato degli oggetti d’antiquariato
ddc07f4c-bbb9-45d7-bf1d-d3ebd1329b74	studiare le relazioni tra i personaggi
ddc5051f-ff9a-4880-9cad-7421e4bf98e5	elaborazione del segnale
ddb63061-c090-4809-a4d6-131062aa629b	valutare la qualità del legname abbattuto
ddaec3ae-7b0a-480d-8716-fdb7d53b94b8	progettare soluzioni di failover
ddc8efa5-6bd4-49be-a703-d0c74e0530da	diagnosticare i sintomi psichiatrici
ddb5558a-a7d6-45a2-a63f-b8403ab5cf38	ordinare i materiali per i servizi di audiologia
ddca8aa4-187c-407c-a57a-79e8abaefe2a	abbinare i testi delle canzoni all’atmosfera della melodia
ddcaa116-42d1-4124-9d57-d041891e844d	utilizzare il filtro a tamburo
dde0c09b-2767-44c3-8bfd-266a880b275e	tradurre la lingua parlata
dddec64d-4b31-453b-84ce-a8ab51256fc1	percepire il contesto
ddea1f30-1b36-4c28-8367-6cf1badbc8fc	interagire verbalmente in rumeno
ddd4a854-b7e8-4a44-8eb6-7591e49e3ed3	utilizzare lo spazio pubblico come risorsa creativa
ddf0c29f-4941-4beb-b3bf-bd2d67eb4e70	svolgere i dibattiti
ddf71ca9-617d-4040-ab21-9d309d598120	assemblare vetrate isolanti
ddf10b1f-2043-4f9c-9f5d-cf8d523fa7fb	aggiustare le impostazioni di taglio delle buste
ddfe6734-9966-4765-9e50-c55c0e7c8572	pianificare i regimi alimentari delle risorse acquatiche
ddf47128-2776-4079-8fea-b0011da8d502	garantire la legalità delle operazioni aziendali
ddf76ee7-a19b-4a0a-a261-ab6b35db839e	utilizzare le lingue straniere nel settore turistico
de008873-8139-4fd3-a84e-c8dae2be2170	utilizzare lo scanner
de01c06c-52b0-4493-b801-5d1d3f650879	protezione dei dati
de1727d1-801e-45de-8f77-ac13774eb0f9	tenere corsi di alfabetizzazione ESOL
de0828b9-a5c6-41f8-86f8-e89707316dcf	guidare i veicoli follow-me
de1d744a-5b1a-4240-92e9-cd4e597b0813	determinare gli itinerari delle autocisterne
de1e6c3e-d0dd-41ad-8866-73e2f593b2f4	applicare le tecniche di restauro
de25b46c-4191-4db0-a03c-96c0a84e1b44	pianificare le procedure per le operazioni di carico
de2ef175-69cc-4163-8be9-a748ecbd807b	diritto della concorrenza
de31ea6c-17a5-446b-9689-45b7dc54f7cb	organizzare alloggi trasporti e attività
de35dd4c-ac9d-4843-aca4-e5881462dd8c	diagnosticare l’assistenza infermieristica
de3e2790-3e05-4282-8d57-b1d6fadeab50	usare l’integrazione tra computer e telefonia
de43f5ba-60bd-4d9f-a406-a4ad64297356	terapia comportamentale
de54f996-bda8-4100-b660-d0e63f9fd3aa	separare i metalli dai minerali
de578d5a-c057-48b9-9575-94a658eef379	operazioni di mungitura
de2b5d77-bdf1-4413-8794-c36744fe76f5	spiegare le caratteristiche delle periferiche del computer
de5521e9-0e84-4f49-a4b3-ef3d1de6e357	preparare i pasti per i voli
de3c62e9-b638-4956-8eec-69157d98a91e	principi di comunicazione
de5b84ab-a3e6-454d-ad83-56084361b112	pulire i box
de5323fe-144d-4415-8628-9ca9ed26463e	controllare le condizioni di trasformazione della gomma
de66b5eb-e3b8-47c0-afce-2ead32eae30e	utilizzare attrezzature per lo stivaggio in sicurezza
de78a84f-c09e-4118-b456-f15e82e06a43	applicare una sostanza antibatterica sui denti
de6e768e-e750-41ba-9ca3-1b081b8d4f0e	giustizia sociale
de7f2a86-bc38-4032-9f11-44f57d83c398	annotare i numeri di targa dei trasgressori
de5da04b-2a8e-4e4d-8555-d9910e938299	programmare e smistare i conducenti
de70177d-bfaf-4744-9e54-0b62efad02ea	progettare il completamento di un pozzo per la produzione petrolifera
de94d90e-d49c-4007-ba44-0276e1b7b2a0	verificare la circolazione del petrolio
de95fe8c-9985-4dae-a550-fd9e5caa884e	filosofia
de91c885-7d0d-49a0-99cd-5a2b93a00e3f	accogliere gruppi di turisti
de98b1f8-fe86-4da4-94ac-edc37ba3f0b6	analizzare le specifiche del software
de9a15e6-07d7-4eb1-a710-a9015ca6d0ee	formulare un piano di trattamento
de8be840-3240-440c-b474-d722da91b1b1	leggere i contratti relativi agli interventi di manutenzione del suolo interno ed esterno degli immobili
de9f6483-0e3a-4997-ad2d-1ddf97690d53	negoziare contratti con i fornitori di servizi
dea3978e-c27d-4e53-9df8-2dc3d9b20ae5	usare tecnologie di tessitura in catena
deb3bd71-1655-4c9b-8fd4-de5c7949ad86	comprendere il giavanese parlato
dea40b3d-14a0-4b55-b5b8-f4b256a61d3c	supervisionare il personale farmaceutico
deaf7d36-c6ca-4389-bff7-6af8e5dd1379	meccanismi di sicurezza per ascensori
dec1b6db-0309-40dc-93b3-f1d7cfabca4b	gestire numerosi progetti
decc1c72-baff-4c2b-a6a7-1fddb0010bd8	supervisionare il personale addetto agli eventi
deb40fc2-51ed-467b-951e-98f96ee8d48b	supervisionare i dipendenti degli stabilimenti di produzione alimentare
ded277cc-2e1b-4353-b37f-b63dfaca5444	azionare l’opercolatrice
ded4a3a5-7b4e-44a7-b568-10cda4f1da74	rispondere alle chiamate di emergenza per riparazioni
dedafac5-f724-44ef-b6cd-bc701cfeb84c	utilizzare il software del sistema per la gestione dei contenuti
dedd08ee-f679-4698-ba27-1d56ab474d38	tenere un archivio cronologico delle offerte
dedc71da-bcf3-48a9-a6d6-b8c65442925f	interpretare con un processo creativo i concetti dello spettacolo
dedaf23e-729d-4511-9f05-ee0b3cb1e33e	controllare gli orari dei treni
def34928-a560-49b3-9bf1-5fb25a58e49b	fornire prodotti personalizzati
def7ab3a-3d4d-4fd8-8e12-8d5db28de281	gestire gli attivi nelle strutture ricettive
deee66c5-ac43-45ca-b14a-ca497064b6b6	prevenire i problemi tecnici delle attrezzature di illuminazione
defd01a6-4bb0-4699-99b2-d89f1b4d9bef	utilizzare la pressa per dischi
df04ebdc-bc60-4a86-8d1e-27277a8433fe	affezioni dentarie degli equidi
def98742-cec3-440c-9d74-7877dab1a06b	interpretare i dati sismici
df0906db-2dda-4562-b42f-a7b2fc8f47eb	controllare i rifiuti consegnati
df0b4f27-a048-433d-b122-e1fd03e4829e	partecipare a gare d’appalto della pubblica amministrazione
df0a46bc-c2ef-48f1-aff5-7ef72d721bc7	adattare le risposte al feedback
df20a39e-f80a-40c6-94c2-7da357fff5c1	organizzare la manodopera
df20a536-0ed6-4247-a5f7-85cdae4270a1	regolare le biciclette
df2e76a8-632a-4dc6-905d-4e882c05d71a	legge procedurale
df1b64cd-c6db-4ead-8acd-85c355ceb7d5	comprendere la dimensione concettuale di uno spettacolo dal vivo
df1af9c1-09d1-4f74-8809-b76ae1aee039	applicare il colour grading alle immagini in digital intermediate
df385382-16ee-4f91-aa58-e5afba798dbe	sensori di macchine fotografiche digitali
df5089f9-6916-4d47-828b-355592296400	intubazione
df5a06ae-5bb6-4bb5-a35e-bebb6b3e89d7	equitazione
df462524-4495-4ab2-b14f-c78b2fdb1d67	scrivere didascalie
df38b510-b5ad-4ffe-a6c3-ab75ea6a9637	omogeneizzazione degli alimenti
df5da208-b8ca-4b4a-9b6e-3e263f8f80c8	dimostrare le abilità tecniche durante gli interventi di neurochirurgia
df5a81ef-93ef-45ee-830f-d8b33ec4cec2	monitorare le macchine di riempimento
df631bc8-12b2-4016-ac8e-8fc3c641c905	sicurezza alimentare per la carne di selvaggina
df51e398-501b-43e7-b60b-c3597aa37068	svolgere un consulto podologico
df5a9704-4d06-4833-a0d2-4b3f2b8697d1	industria dell’abbigliamento
df663d81-3296-4380-a650-c9bd5f5b3b97	utilizzare pinze di forgiatura
df6e68ab-9d0d-4524-a889-23c18eece618	promuovere i prodotti finanziari
df72d277-4c3a-4f8e-8bad-22978c78577f	confrontare i calcoli dei rilevamenti
df5a6772-8751-4097-98ec-5154697f07ec	comunicare con i passeggeri in modo chiaro
df75092f-9ac6-4ca6-8dc0-2a89fc6bc0ea	operazioni della marina
df811364-f8e4-4c25-ae01-9a153b80c245	verificare la legittimità della richiesta
df86f6f1-f3b6-473e-851f-2efba1b8f497	riparare le tubazioni
df821202-d61c-488e-abe8-8cb273b361d9	manipolare i materiali odontoiatrici
df8e3705-da55-43f5-9594-f8f932768144	seguire le istruzioni del direttore artistico
df9312fe-f5f5-439f-b703-932c327604d1	montare quadranti di orologi
df92d9aa-a257-4e5c-904b-5a8af6b6335a	fornire consigli sulle invenzioni
df99d17d-e6b2-4be4-9bc9-e32fa5ced3af	lucidare le superfici della pietra
df8a1e2f-859f-4196-b6ca-c6cbeae11d68	coinvolgere il pubblico emotivamente
df9fe4fa-7e01-4515-a2f5-ea71ea8042a3	diagnosticare le malattie respiratorie
df9cdf39-e1e9-4e09-bbef-b31b0876fbdc	guidare i clienti di parchi dei divertimenti
dfbafeac-c09d-4392-8ee1-04cbcfb92c40	resilienza organizzativa
dfab9ba0-fba4-456e-907e-b5bf2c0717bd	usare software basati su memorie di traduzione
dfbc00c2-45ed-430b-a16f-1023cdc5213c	utilizzare uno specifico software di progettazione
dfc1372f-5a2b-439f-85cb-f7ac0df3bd11	applicare le abilità tattiche appropriate per praticare uno sport ai massimi livelli
dfbc6855-dbf9-4544-aefb-4359c1b69586	prestare attenzione ai dettagli relativi a cibi e bevande
dfbf7481-5ba6-452f-bde0-f1b649aecc62	fornire consulenza sulle fragranze
dfd34b0f-aeea-4584-9a6e-0e39b6fb2ab1	guidare prototipi di veicoli a motore
dfc39f3d-17dd-48c4-8886-345cb0fd4ff9	garantire la regolare manutenzione dell’attrezzatura da cucina
dfe01943-c522-4747-82e6-48443ef7d244	condurre una ricerca di base per gli spettacoli
dfe503f5-a87d-418d-b79c-e174b3484212	elaborare i moduli d’ordine con le informazioni del cliente
dfdb1c3a-f252-454e-b107-bffb6921bedd	tenere l’inventario della biblioteca
dfeb00a1-7465-493c-b055-9474edc817a2	gestione degli impianti nell’organizzazione
dfd0c8b0-fb28-4074-a581-3b0640347808	negoziare con gli artisti
dfe8f8ea-0d81-4519-a1a2-d5e274ead285	tagliare fili
dff71514-ffbc-42af-bbcc-bddad1516ac5	fabbricare i dispositivi protesico-ortesici
dffd8db1-c86e-4aac-90ff-64bb15fcc7bf	parti di macchina rettificatrice per piani
dffc0975-986c-47e6-b6ae-9573b1737825	utilizzare una pistola sparachiodi
dff52b3c-56ad-4273-8db1-485ea35aa8cf	attenersi ai questionari
e0071146-c31f-4d06-8448-55f26b8a731e	parti di smerigliatrici cilindriche
e004f286-8f55-43b6-862b-db002fa103af	fornire consulenza sulla conservazione
e00fcda5-30c9-4339-ac5c-4b2300352dfa	sviluppo di politiche per gli affari esteri
e00a3a8f-c941-40a8-86df-f57ed4231529	fornire consulenza in merito alla sostituzione dei ponti
e0099b07-f59b-410f-9992-53ef14c6bef3	seguire le istruzioni dei dentisti
e0170e8d-7ed4-4448-bc80-2048e8795873	sistemi di segnalazione relativi alla vigilanza dei dispositivi medici
e00d0467-0ee1-48c6-94dd-9553dc0299f0	considerare il minimo dettaglio nella creazione di gioielli
e012a197-6176-4f84-8beb-9866e5bd9322	garantire una corretta visualizzazione del sito operativo
e01c6536-6415-4827-8bb6-abe72ba5855b	inserire stoppini
e01eac82-2775-4a5c-843d-02c76257ac9e	informare in merito alle normative in materia di riciclo
e0344702-9eba-4c3f-9ab9-808b95090e3a	tagliare i denti
e01d4372-5eb0-4c63-ad24-9f5f2f6780de	condurre le attività di formazione su apparecchiature biomedicali
e027d9c4-c4e8-4361-951e-79ed07d55d45	mobilio, tappeti e sistemi di illuminazione
e0393ec7-2e44-41e0-a7b8-bc5aecab70d0	dermatopatologia
e047148f-44de-4a71-92f3-b56428d4406f	controllo di processo statistico
e0254bab-b7b6-4d64-b3b4-ce58be5d9285	ordinare la personalizzazione di prodotti ortopedici per i clienti
e046be1c-c6a9-496c-aa07-be5ee1bf2d26	pianificare le missioni del satellite spaziale
e0517b06-e633-40a8-9aef-1124082e80da	effettuare la manutenzione della segnaletica stradale
e05f9ee4-afbb-4d02-b75a-fbcb6e49f34d	logistica
e05c6e70-cc49-4b06-9de7-86616a8c8693	fornire consulenza sulla prevenzione dell’inquinamento
e061beba-1838-40d2-8a24-fe7ab593fb94	TripleStore
e065904c-9935-4ff9-845c-22a608174046	conservazione dei cibi
e06cf77c-fd9e-4847-bc0f-fb94e0c86bcf	parti di macchina limatrice
e05a97c3-4008-4fc9-a7d8-000fa8005455	pulire la gabbia
e081da93-0bed-4a30-8c27-6bcd0c93f10e	utilizzare le attrezzature per il peschereccio
e0820a16-11c5-465c-af2d-88f75b387bca	abrasivi per sabbiatura
e088fab1-3da6-404b-a44e-512f05e1e668	fornire comunicazioni sui piani di ormeggio
e07e6421-61a5-4271-b2f9-71d01397c756	ispezionare le uova di pesce
e082b9c5-5542-4d18-a086-0db1fad7700a	comprendere il ceco parlato
e0897409-704d-45fd-be1d-812f4ae9f7b7	essere addetto a macchine limatrici
e08b10fe-ddce-4aa9-836c-ea2c944bbd33	tenere in ordine le camere
e09a2fb4-863d-41b8-b0a2-dd87a24f7d60	offrire consulenza sulle cause di malattia della coltura
e097dc22-6d81-4c96-a48e-606a886c6f43	mantenere uno storico dei crediti dei clienti
e09bf1fc-80bd-4699-ab40-9316acd1078f	effettuare la manutenzione delle apparecchiature della gru
e0918b22-f5b1-4f76-a7b7-0809c2fc4a33	Prolog (programmazione informatica)
e0a16991-c749-4b2c-a4ef-576cf10e406e	condizioni per l’esercizio professionale della psicoterapia
e0a05e70-b03c-45e6-8ece-d5d46f47054d	istruire il personale sulla gestione dei rifiuti
e0a1fea8-1c88-4f0e-ac18-87e166b0f615	norme sulla segnaletica stradale
e0ad2a70-41fe-4251-8331-f866d5f784cf	geodesia
e0aab103-c2b4-422f-86f6-59f46e2a9cf8	assistere nell’ambito di programmi sanitari rivolti ai dipendenti
e0b7dd30-bc39-446a-ba6c-748763dd26c2	vendere gli oggetti d’arte
e0cc789e-670f-417e-87dc-852b1d5d2727	micro-ottica
e0b8194a-351e-41d1-9ec5-4bdaa7c31beb	comprendere il sanscrito scritto
e0b64b93-be08-47ce-a9fb-415276cb5a0c	tenersi aggiornati sulle tendenze nel settore dell’abbigliamento e dei tessuti
e0c277d0-8113-4fb0-9b45-54f3bfd26d1b	metodologie di assicurazione della qualità
e0cec45a-6197-4782-ab8e-94fd282bfb0f	pianificare operazioni in miniera
e0d1c0b3-443f-44bd-9f26-afe7caa4458d	analisi probatoria
e0df00d4-ca68-4dbb-8360-62d47d2e01b8	trattare i casi di malocclusione
e0de2a2e-0fa8-4169-9c4e-5d587a8dbc07	evitare la manutenzione non pianificata della nave
e0deb525-4012-47c4-ba8f-531d19b6aa27	distribuire i programmi presso la sede dell’evento
e0eba691-30f8-4b5a-ba70-2eae5797085f	gestire forniture elettroniche in ingresso
e0e5e593-8028-48b9-92e8-35f41b05385b	trattare l’esposizione della polpa dentale
e0ea6c9c-f27d-4dce-9142-85570aa1ffcd	offrire consulenza sullo sviluppo economico
e0f26271-8977-4442-b1cb-2242f388a275	controindicazioni
e0f4cf03-6d78-4ff9-a06e-efdfdd7f6ed9	impilare il legname
e0fa9962-0853-4c6c-b715-e262fa8316d2	principi di controllo delle esportazioni
e0fb47fe-8baa-47f4-8157-c41cac18c914	utilizzare strumenti di precisione
e1047812-41c1-4ef7-9b46-6fb02a4f9fb1	preparare la forma di stampa
e10b9974-8e45-4ac3-90c7-1de0750864e1	comprendere il coreano scritto
e10ab645-d632-4b13-8e48-fc5d3bff4de4	lavorare indipendentemente
e11022c3-59b6-4528-97ed-588dc8c32e6d	gestire gli affari giuridici individuali
e116479c-3f98-4dc3-9ad3-4ec52a0e2301	valutare le caratteristiche dei prodotti tessili
e0ec0a68-3104-4b6f-b85c-77985c5beb49	provare i movimenti di macchina
e0fe1c4b-75d1-42e9-a9d7-247f06aa8a69	legare cavi
e120d66b-7193-4696-8298-065e032e1ee3	strategie operative per le risposte alle emergenze
e123ae9c-1766-4e08-9732-a5141d0ef260	impiegare tecniche traduttive
e11d31ef-1f19-4836-a6a6-cab9c4f73b07	rispondere all’emergenza energia elettrica
e12cd00e-018b-4eca-ba36-8bd7d007d5f5	filtrare oli commestibili
e12f0c9f-8ecd-4555-b73a-3fc70210421e	Calcio
e12edeff-b16d-410c-96a5-720160147e7d	attrezzature di bonifica post alluvione
e1279f9b-6c57-4c3b-b435-99f5a9469ccd	gestire il trasporto degli animali
e127d13d-f7cb-46f4-8fa7-007254c7e169	tenere pulito il negozio
e132c0d6-ea83-4a57-814f-b509a00eb233	disegnare tessuti a maglia ultrafine rasata
e1345e99-4d95-4900-9159-8e6996a435d2	guardare le scene
e13581e8-7749-4a33-9b87-ceae714c43f0	immunopatologia clinica
e136640c-fdbb-4248-bd98-9a6c29f1ecc2	stampa digitale
e13897a9-d959-4e9f-9131-8b5337fae7c3	trattare le domande
e136cd8b-3ea7-48d9-b714-db244cc024e4	applicare la carta da parati
e13dafb9-b05f-46db-96f4-2354a6dd688f	gestire l’ufficio per le relazioni con i clienti
e1471daf-ed73-4a09-9972-ae81d6e6dcbe	cucinare pesce e frutti di mare
e1485e8f-4923-4d48-b48f-694978cc08c9	promuovere la parità di retribuzione
e147464a-e26e-4fd6-b8fb-debe64fadd44	anatomia animale per la produzione alimentare
e14ee223-ae38-4541-8022-54f7409f9615	gestire gli ausili di accesso alle informazioni
e14e6bc4-ee37-40d5-9bf6-05e5680d56ac	interagire verbalmente in basco
e14aff92-14fa-4182-8c23-e39e76056de3	provare con altri attori
e15f3d34-02eb-40fb-b415-c74ab7e651a9	nutrizione sportiva
e15a7fa4-08a7-4cee-bd3f-605c6de3466d	sostenere le esigenze degli assistiti
e1654086-45f1-4907-8e18-9b5a41434ca7	progettare le turbine eoliche
e15afdc0-3ed5-46df-8e39-a4bcdd76927f	installare una pompa per l’acqua
e168782c-4c6f-4eaf-9ddd-5e157da4868b	utilizzare il registratore di cassa
e1743e0a-f6cc-4a19-852d-2f44e0a0bfc0	misurare l’impatto di una specifica attività di acquacoltura
e1783733-ae0c-4632-bd3e-7c99d46ae78b	usabilità dell’applicazione
e17a1775-59c7-40fe-900e-ee48755a33dc	installare le tubazioni in PVC
e180cbfe-72e0-45b9-b72a-d19d33972db2	distribuire i campioni di prodotto
e17be275-056b-4af2-86b5-5f1c61c8bfac	elementi costitutivi del miele
e181507a-c45f-42fd-8271-9f458c7449d1	produrre le impronte per le audioprotesi
e18d57b3-bda1-4e66-87e9-af4bcc842806	ginnastica facciale
e18cc34f-2ef5-4229-884e-361f62992552	gestire le attività di acquisto
e1b63f46-4436-47d4-985b-c0a6af44b8c1	vendemmiare
e192cccb-2eeb-47f6-9470-e5b8a925bab3	preparare panini
e1836139-b7b6-48d4-8c85-07b65211486f	garantire un livello di preparazione costante per gli audit
e1c2987b-b2ee-4d5d-8565-75f3547b2a79	energia
e1bda00d-22a5-4aac-ab2a-977544f199c6	ascoltare attivamente
e1c4a7f5-8ab3-49c0-a654-cb2a19a1d469	sostenere i fruitori dei servizi sociali nella gestione dei loro affari finanziari
e1b51d5e-ad80-4e31-8802-fc7258dc3db2	fornire informazioni sui finanziamenti governativi
e1d13fbd-abea-4c87-a784-bc4d6401e880	assemblare le armi da fuoco
e1d351c3-fee7-4927-a816-5bb974807b9c	manutenzione di aree naturali
e1d36f09-c056-495e-9970-d65f6be135d5	caricare le merci da trasportare
e1da00c4-56e3-4269-92e3-6cde0b00d598	predefinire gli oggetti di scena
e1cb9db5-0d5d-4176-9733-b62be8be9cb6	offrire consulenza sui potenziali rischi per la sicurezza derivanti dagli impianti di riscaldamento
e1d9cd61-b703-4ecd-a417-2ce3adb21075	partecipare a riunioni editoriali
e1dacd8a-cc31-4fa8-acc3-31317e4ac703	verificare la conformità della costruzione
e1dd9071-1b69-4fe7-8dea-d6abcf515d8b	impianti per il riscaldamento industriale
e1e957f5-6c67-48ad-85c9-14dda0e90f15	creare schizzi
e1e146e9-c978-45e5-bfab-6b4f9905fe54	cromatografia liquida ad alta pressione
e1fbbdb7-dc3c-43f0-9e2a-af0a8b014c3d	eseguire le operazioni pubblicitarie per i veicoli
e1f89409-ecfd-4bb3-8293-7303685fb0da	processi di imballaggio
e20b740b-b62b-4d9f-9f0b-aaf510172b3d	utilizzare le macchine utensili
e21277cb-a174-41c2-9c2f-97f9a5c874e3	pianificare registrazioni audiovisive
e208456a-969b-4f53-9168-0ef135a81317	prevenire gli incendi negli ambienti per spettacoli
e2149e9d-f276-4ccc-89f9-ca5d53587f38	sviluppare piani di gestione della selvaggina
e2161661-4eb0-4236-a93f-6dfe8a16a08a	eseguire controlli di qualità precedenti all’assemblaggio
e21f138c-62ff-47b0-b8ff-e807b878ebc5	biochimica clinica
e22ff9b4-57a5-4321-8a68-92acdf4800da	trasferire le giacenze
e2361a6f-0114-4ae9-bca7-c928a5cd9c28	utilizzare la mola abrasiva
e2313f57-7835-4070-bcb3-dbc19a8077e0	progetti culturali
e211b053-d4bb-4586-a63e-c4608faaad4c	rispettare le precauzioni sanitarie e di sicurezza nelle pratiche di assistenza sociale
e23916dc-19cb-4ddf-bd3a-fe1881cbc7dd	controllare la folla
e23dac0f-9370-4dfd-a28a-46c1a6739771	tipi di digestori
e24b0b43-54f6-4d57-af57-49e9f177d809	aggiungere sostanze indurenti alla vernice
e24f6051-147e-4b8f-84c6-a7aba7d6c3ac	regolamenti di magazzinaggio
e252fecf-ae51-4aa4-8165-b9eb6aaa3e1d	interagire verbalmente in irlandese
e257bb4c-ac66-4584-bd6c-dc3171f7c214	processi di sabbiatura con abrasivi
e24f83cf-1d43-470f-9c4b-b38144073985	utilizzare i codici per comunicare con i tassisti
e2590bc8-c093-441c-af52-8bfad9d7864f	sviluppare un concetto pedagogico
e2662890-6728-4474-9be6-c8f83b04407b	stili di nuoto
e2422a23-aab6-4ddf-b0e5-6b71e6fbc977	fornire un riscontro costruttivo
e266305a-4b68-4060-9f59-5857b06ffc73	modificare gli elementi scenici durante lo spettacolo
e26af7fa-fa38-4f28-ac7e-6676ffd5dc15	realizzare stili di piegatura
e26f01da-591a-440c-affa-c73b4e7c1a0a	ingegneria meccanica applicabile ai semi oleaginosi commestibili
e27022c2-557d-4421-8fef-6dd6fadb88b4	conservare i dati dei clienti
e275ee9e-6f58-4279-b85e-5fa429b83328	trattamenti a temperatura ultra-alta
e27db719-bdd5-4392-b76e-410aae272d45	interagire verbalmente in persiano
e279b690-a518-46e0-81f4-e8f71f7b81b3	economia
e28b909d-a0cb-4e28-98f5-6d47a3533b86	svolgere prove di laboratorio sulle calzature e sugli articoli di pelletteria
e28fc185-6812-4192-badc-f80c842db6b5	conservare i prodotti
e2902c92-9f39-47d3-8b1d-c5f0ced7c867	gestire il sangue
e27faab4-61dc-4a45-8255-928e606813bc	fornire consulenza agli architetti
e292e803-3606-4d8f-aaa8-67dd30e58b7c	strumenti di estrazione trasformazione e caricamento dei dati
e29da371-120c-4684-962a-a197ec6d70e7	garantire la salute e la sicurezza nei servizi di accompagnamento
e2ad5439-c6f4-4fec-92b9-4d2220571d59	trasportare tubi
e29cdc9c-f107-415a-8b7b-a291de7886b7	tenere un archivio delle promozioni
e294fcef-8808-41f4-b910-d8022b25af65	personalizzare il programma sportivo
e2b387d1-83e0-48ea-936e-975ef94bf332	IBM Informix
e2ba4d78-692c-487b-8c66-61cd4de1e0ba	standard per l’e-learning basato sul web
e2c40262-1294-4746-9173-627618d72295	gestire il dolore degli animali
e2cd64e8-2d90-46e8-b858-f48616c0a5ca	promuovere i servizi di gestione degli immobili
e2ccc675-d7ad-42ff-ab5d-6d80c62d76df	sostituire le lame
e2d050e4-697e-47bb-ad06-662e130ea53b	somministrare i farmaci prescritti
e2df489e-4149-4740-8309-5220b239492e	posare piastrelle per pavimenti resilienti
e2d2b3bd-fc55-4e55-867f-a6dfa7455380	normativa sul benessere degli animali
e2df2810-431d-4566-a996-798a7717d93b	dimostrare l’uso di hardware
e2dd8a25-29ad-439d-a990-123796ee4b31	IBM InfoSphere DataStage
e2f0928b-7ac5-4dce-9619-69efd0ac3a39	sviluppare processi per la separazione dei componenti
e305889f-4ae8-4304-b9ae-2c2c3a837b49	valutare i rischi e le implicazioni di un progetto
e308d0dd-d83f-4b31-87f7-4f8258797702	applicare un rivestimento a legante fosfatico a un componente metallico
e2d9cc1e-04ba-40db-9340-57e57522a58e	riferire al responsabile del gioco
e2f447eb-325d-4150-a739-840d15795541	controllare il comportamento alimentare
e30c01ae-f737-4be6-8abb-c917bde3ef38	preparare il sottofondo stradale per la pavimentazione
e314842e-41c1-4bcc-8342-d645966bf3d2	trascrivere registrazioni audio
e310e6ea-0d3d-4b34-8f3f-c17b5e477a9d	lavorare con i compositori
e2f7c461-9ffb-4a0f-b6c5-b5b5b1714520	offrire consulenza ai clienti sui libri in vendita
e324339a-633a-478a-a24e-0719c73e57aa	produzione di articoli di pellicceria
e3257d85-ca12-4c84-b469-5c44262d6665	supervisionare le procedure di apertura e chiusura del negozio
e3288981-0e85-4fe9-9fb5-4eace8ba0511	montare componenti di pannelli di controllo
e316881c-8cc8-416e-bd23-8f93f238ecaf	ispezionare l’attrezzatura pesante per l’attività estrattiva di superficie
e330b8d2-5685-4a8e-ac73-82d35c10ab65	stabilire l’origine delle pietre preziose
e33057bf-6f1d-478d-af43-caa5d5d28275	metodi di controllo
e3386c6a-8f7e-4ecb-9ac6-306e5c0f75ec	installare macchinari per l’estrazione
e337e87b-f098-442d-88e7-e2b4f71fa59b	processi di produzione degli articoli di pelletteria
e347a340-7567-434e-8877-07be60b8f7d5	effettuare misurazioni legate all’attività lavorativa
e3609fdc-b99d-4ef0-82a4-d5cbe3bbb27c	comunicazione tramite metodo cued speech
e366df4a-4729-40d2-9b09-80394fb67460	garantire il rispetto dei requisiti di sicurezza della gabbia
e3663c07-0c1d-47a8-ad06-0fae9118d6ac	trasferire i pazienti
e356efa2-e104-4513-a727-37f04984c12f	cucire biancheria intima
e34e8b4f-c688-4c44-ab59-1858213a249c	applicare i concetti di gestione dei trasporti
e3728c0a-039c-45fe-af7f-a2cd9ecea78e	eseguire gli interventi di microchirurgia ricostruttiva
e36863a9-e508-49a8-833c-81d16c77d2f5	eseguire un lavoro manuale in autonomia
e3625059-282e-4e48-81fc-bb226c2e40a7	analizzare la resistenza allo stress dei materiali
e381efa3-6fa2-43ce-9570-894f87a75030	installare i profilati da costruzione
e36bc4e4-0d7e-471f-b87e-a35ef3b71ee3	neurofisiologia degli animali
e3818ae9-919f-4c16-bbf5-a35a467b0b76	definire i materiali dei costumi
e386b6b2-d266-45fd-b0cc-ffe661e31e63	smistare i carichi in entrata
e38c4dfb-625d-440e-b0d4-bc7db7de79e0	potere di rifrazione
e39d7aab-61bb-4d65-88a3-55050f5b899c	fornire assistenza ai senzatetto
e39324bf-1721-4ee4-91d9-86922b435452	gestione dei rifiuti
e39c8563-010e-4e36-a4c7-d8a32472274c	controllare l’utilizzo delle risorse nella produzione
e373525f-7b1a-4c2b-ae88-0e689e1f1c7f	consultare le fonti di informazione
e38e1cc7-d48d-48c9-a124-279b5fdaa45d	fornire assistenza nelle questioni di amministrazione personale
e3aee03f-4563-4d05-aa40-ac7b1fde8928	ispezionare i sistemi fognari
e3a65c63-8b05-42c6-9c87-c8fa3d4af3f5	fornire assistenza per i progetti di paesaggistica
e3ab5c66-324f-4b80-83e4-53756e2ad8c4	effettuare la verifica ispettiva dopo la restituzione dei veicoli a noleggio
e3bae987-86b1-4d1d-accf-65a0acf3a856	interagire verbalmente in azerbaigiano
e3d13075-f2a8-4be9-84c1-22838c399530	fonetica
e3b8d195-ab18-40ad-b70d-fb0147d6f214	utilizzare una fornace
e3cba167-0325-46e1-8d7b-a54c44f885d8	ispezionare i campi agricoli
e3a6de60-476c-4e8c-aed3-0ca26ede7568	applicare le tecniche organizzative
e3d2afaf-f753-403f-a767-cc0372478c61	progettare schemi di database
e3d95b96-3ede-4b0d-8b78-3f47f40b5363	effettuare la manutenzione degli inceneritori
e3e9bcf3-eee7-4b34-8e47-001ae3a19ade	fornire informazioni sulle gravidanze a rischio
e3eeabdf-878b-4748-a0ac-c143c7f6b129	tenere i rapporti con i medici
e3f01903-7281-49f3-be74-8cc8649690da	considerare l’impatto delle caratteristiche del materiale sui flussi di gasdotti e oleodotti
e3f3664e-b626-4dd8-8e60-90fafdf4e768	fornire un sostegno psicologico ai pazienti
e3d346b0-980e-42d3-acab-6f202db4daea	aggiustare la macchina per la stampa su pellicola
e3b0b30e-680f-4bd3-8bcd-e6767f34abee	interpretare i regolamenti di trasporto per vie navigabili interne
e3f6a22c-6663-42ff-9d47-0b820da4440c	tecniche di composizione floreale
e3f5ae1f-92c6-4685-af1e-8957140202ed	strumenti per sistemi di gestione delle reti
e3fac8f2-730e-4768-9e3d-f7acf94ad858	annunciare i numeri del bingo
e405690a-34f0-4d8c-ab01-ec1cf9e635d2	lavorare in un ambiente internazionale
e409028d-1e89-4be6-8473-7f83d89990b4	promuovere il lavoro di gruppo tra studenti
e40ab284-2dfc-4ff8-9950-da0a91b684ec	sviluppare le reti di comunicazione con i siti di spedizione
e3f0c707-356d-4ddc-906f-ce16ec31da7e	monitorare le deviazioni nella produzione di latte
e414e5e3-1a0a-4c0b-be5d-2f832e7b3631	gestione aziendale agricola
e4096e05-e368-4c6f-8710-ae9583d41437	etichettare i campioni
e41f3a20-f143-46fb-bc6b-b620a0438713	valutare gli assistiti trasferiti
e420265b-0367-4056-a7c1-5793daa2cab2	comprendere l’hindi parlato
e423062a-c218-4a0d-9578-4c13490b8a74	svolgere gli esami ortottici specializzati
e427bd19-86fe-4133-ac6b-3d7a5ea74b0d	coordinare l’equipaggio della nave
e422ab15-bcf5-4474-add5-675856745364	prelevare i pesci morti
e42cf162-f7e5-4ef7-bf64-b7a23193714c	interagire verbalmente in ucraino
e4310821-0a33-46f0-9c86-1a5571e75069	impiegare le tecniche di indagine degli habitat
e4251d32-9f4b-4dd0-a084-3046eed14657	gestire i motori e gli impianti della nave
e424a5f3-8db0-4b33-a6c9-ffe3eb02ed28	organizzare eventi di orientamento accademico e professionale
e42bd1b9-8f4d-40a2-8312-5ef69507e2be	proteggere le piante durante gli interventi antiparassitari
e4332755-71ed-42c9-b099-8fcc68d9aed9	offrire consigli sulle destinazioni di viaggio
e3f704bc-6378-4efd-a4e9-8485925bbd8a	contribuire a redigere la scheda tecnica per lo spettacolo
e432e8e4-c15f-4cad-8220-f5b5455d1bd6	identità digitale
e43691fe-e905-4f42-95d3-f23c29880b7b	grammatica
e4373e53-1d2c-45dd-a879-8c5fa5a2c558	educare in materia di gestione delle emergenze
e44ea350-0ab8-41a2-ae8f-48692fa50406	condurre gli studi ambientali aeroportuali
e44d425e-dba2-4a9b-a71c-e6782d790746	garantire il controllo della temperatura per frutta e verdura
e43dda10-b524-4ca8-9061-8b4aca427ce2	usare software CAD per forme per calzature
e441f335-be77-4b30-bc33-f1b98cb2c375	sviluppare le relazioni terapeutiche
e442600d-2624-4513-8f96-19237e890a12	supervisionare i combattimenti degli artisti
e4570732-14c9-459d-a1e2-56f01bb634c8	regolamenti internazionali per prevenire le collisioni in mare
e45ce393-387e-478c-9495-bbc63549c268	essere addetto a macchine per foratura CNC
e4649d9f-eba7-462b-9154-1d9ea6eb10b4	progettare l’aspetto fisico dei giochi
e47dbf5d-ccde-44ab-aced-6db933658583	essere addetto a macchine saldatrici a fascio laser
e47f60aa-5f28-4947-93bb-7308a85fbc80	modello di esternalizzazione
e4855d8f-ceb0-4db9-8894-1b9456aeffcd	MOEM
e480e7c9-b893-4f48-a282-b67bf31f29c7	riparare i pannelli della porta
e481098e-26dc-4a3f-86f4-e434c08e67e9	guidare il processo di pianificazione strategica del marchio
e48d4973-a473-414f-94ed-c2160dbfecc7	valutare la conservabilità dei prodotti alimentari
e483673f-9b1f-4eef-94eb-4250a4f5a140	caricare gli animali per il trasporto
e4b425b2-6b60-43c2-9e79-9dd7e3a8e063	utilizzare le zavorre
e4af141c-097f-4a74-877d-082501affe84	fare previsioni sul futuro andamento del business
e48f8fcc-32ef-49cb-8e48-61de3f814f41	osservare i sintomi della malattia dei pesci
e49a09fd-03a9-48df-85e9-66e53d332ca5	analizzare le tendenze del mercato finanziario
e4b9427f-cd91-4bbd-abd5-d2c692e2fa0f	processi di sbavatura
e4b7fabf-26fd-4284-bcf3-7e7cc1a19eb5	insegnare i principi dell’insegnamento
e4cedc50-8ceb-42c7-b742-80001e1f7bae	preparare l’area adibita alla preparazione del caffè
e4c0a57b-3072-4868-acf8-e14ff069203a	soddisfare le aspettative del pubblico
e4cf824d-4d51-4dd7-b31a-5d6bc28408a6	stendere il calcestruzzo
e4cfb498-4826-4a84-a512-f780843b4166	storia del computer
e4e0d35c-cfd2-4940-8d57-96b6531e3602	preparare la superficie per la verniciatura
e4e170d2-932d-4931-963d-10e070254805	prevenire gli infortuni sul lavoro
e4df04ba-dcb6-4803-b41f-5e9240f5966b	determinare gli obiettivi degli eventi
e4e67d58-398a-4ddd-8781-b3511e554f42	rispettare gli standard operativi per le navi
e4e8d764-c67a-409c-92a7-ef8448a59541	azionare l’attrezzatura per il taglio laser
e4ef0f72-2284-4562-b8d3-65e9efccbf7e	pugilato
e4de3140-2055-4623-a791-dedc7f2ab2a4	utilizzare le armi da fuoco
e50a123b-00f0-46a2-8c96-a3a73d915bf8	prototipo di qualità di una foglia di tabacco
e511864a-c4de-490c-b47b-53987385e6cd	usare la cera per correggere le imperfezioni
e50f1ae1-4e39-4369-9355-3351433918cf	Oracle Warehouse Builder
e5123452-1eff-4cae-84a3-2f77bc871bab	completare le procedure amministrative riguardanti gli iscritti
e4fc2a90-2ccd-41be-b984-d7f6a5f54677	gestire la qualità dei pellami durante l’intero processo produttivo
e52285bd-8179-474b-88df-627aeb280aa5	posare le piastrelle
e5320f81-d797-43a9-8327-8f348da3253a	selezionare le foglie di tabacco
e52b703b-83d2-48f4-afd3-18daccf6dfae	tecniche di intreccio di materiali tipo vimini
e536c048-34f0-4d7c-a67b-bea1aec3b91b	tecniche di depilazione
e539851c-5fbc-4533-854b-97a78b6c495d	strumentazione di controllo della TBM aa
e543e4de-e46c-43db-acf0-9b7b2dfa01ba	sartoria
e55110be-2709-4a99-a25f-add5da518b27	post-trattamento di alimenti
e53ad844-c5f9-4e21-91f3-f1300c54bdb9	segnalare gli incidenti di gioco
e54f537a-a6ab-4185-86c7-82e3d318b90e	cambiare il filtro del sapone
e53be7e0-2934-441a-96b9-74149f4002ed	adattarsi alle situazioni mutevoli
e5612697-ac44-405b-a45c-8cce627fef24	asciugare pellicola fotografica
e579551d-4a5c-4a32-9919-9e7642c49182	utilizzare attrezzatura a ultrasuoni
e51d0f5d-9623-4327-b2f4-ea595ea7ae3a	aggiornare i risultati del progetto durante le prove
e561b847-e721-489a-9013-a85bf46a7714	fungere da mentore per i colleghi
e55f76c8-10c6-42be-af85-fe5dcc8ef285	eseguire test del software
e57defad-cbf6-4438-9cd1-2052f3ed2f6f	riparare parti di carta danneggiate
e58644d1-97e0-4354-b0eb-748754193d9d	stabilire le strategie commerciali nell’autosalone
e5867b24-1c4f-4397-b04c-3ffbec013eee	struttura del suolo
e57a4f31-b4ce-4644-b233-0b33fabfcf1c	rispettare la normativa relativa all’assistenza sanitaria
e58d58ea-3945-420b-95d3-2ba358bb1a9f	gestire le apparecchiature intermodali
e597bc96-015c-4be6-980d-a49c1692a158	fornire i documenti necessari
e587fea1-0dc6-413c-931f-c53a673ad18c	ricercare l’eccellenza nella realizzazione dei prodotti alimentari
e58fdaba-9386-418c-a831-8623664fc011	eseguire i trattamenti dell’acqua
e594e99c-9448-4d24-95e2-2e71d8b9daca	selezionare le lenti intraoculari per l’intervento chirurgico
e59d00d3-fffc-4cc7-993f-5eb3d8c3075d	rimuovere le sostanze contaminanti
e59e2daf-8948-4232-96bf-8a77b1a025d9	adattare gli interventi di fisioterapia
e5a6d6d8-18b8-4726-a024-510b638c1b12	ottimizzare i risultati finanziari
e5a1a382-93ae-4e32-a92c-aaaeccc2ba58	utilizzare la macchina continua
e59ee881-952a-4cd1-aeb6-56cb6e0e1294	valutare il rischio all’aperto
e5a10940-4a27-4b40-9c3f-63f7c9b2ec83	dare il segnale di azione ai presentatori
e5b4e5f6-0dbf-4cf4-9901-36bf72ce7a3d	studiare i ruoli dalle sceneggiature
e5bc7e73-b344-4f51-bfff-fa5dd26988fc	sviluppare i prodotti finanziari
e5ba1b2e-24f2-4415-b128-75ae6b3064d3	SQL Server
e5c001b1-b171-4b00-8916-d5b3833ff238	minacce ambientali
e5ca2c60-c425-4d83-951c-ac0d16bf7044	creare profili di gusto di caffè
e5c572ff-4b03-4b9c-9ca9-f34a7228b529	partecipare a programmi scolastici sulle biblioteche
e5ce3744-35eb-477c-a131-e3b5119897e3	raccomandare misure connesse al mercato
e5d1bf9f-8eb8-44a1-99ae-7f83ad0d7697	studiare i canali di comunicazione per diversi datori di lavoro/contraenti
e5d2cafc-339b-491b-9559-3c96a747e424	preparazione di alcolici
e5dffb0f-91f3-4884-b0dd-2e5879611d67	testare i materiali immessi nel processo produttivo
e5d9f826-da4b-4a2d-b810-ee52ef5e7dba	controllare le scorte di attrezzature biomedicali
e5d7e5bc-533c-40bb-b244-0ef0f169255a	IBM InfoSphere Information Server
e5cf8ce9-2560-424e-b69a-795cf9132511	adeguare i piani di distribuzione dell’energia elettrica
e5e34bb8-8d62-41c8-862b-b49749c0f3e8	condurre una ricerca psicologica
e5e14796-a280-4502-b19e-7b0283d92f5a	scrivere in bihari
e5ec1aed-d43b-4100-860f-c1052fac6d3e	progettare sistemi di centrali elettriche
e5f5374a-3c1d-4511-88cc-9b2f29dd1cfe	assegnare gli armadietti
e5fd9351-1457-4e19-8913-ee0b18230737	definire la struttura fisica di un database
e5fa2241-3f38-49e9-bf0e-496d5a1501c5	raccogliere le cellule riproduttive
e606fd6f-d57e-4510-94d3-84fc21879928	seguire le misure di sicurezza negli zoo
e6083fae-1a66-4aeb-8c0f-8b032926c891	crimpare fili
e613ecf7-b678-405c-b324-d03b70909a58	animazione di particelle
e6155ef6-ec39-4884-ab9b-0b7cf8652453	Standard IPC
e60d0a18-5a74-434a-8b31-af4a105d66b4	risolvere i problemi di un sito web
e61b2a03-8896-482c-a6e2-24a9574d296e	eseguire la fermentazione in forno delle foglie di tabacco
e5f34a3e-48b3-4c54-858a-d801bfb41adc	sviluppare l’identità professionale nel lavoro sociale
e620a446-9cd6-4330-b9f8-f375f906416b	allevare selvaggina
e626aea1-5705-4179-8893-b4b8c592660e	eseguire gli impacchi con bendaggio
e619a4cb-48f9-44db-be84-5c82d2bdb2aa	eseguire le prove di conversione
e623fc45-92c0-4ae9-8140-9e4274e7db4e	effettuare la manutenzione delle piastrelle per pavimenti
e61efcde-fe9f-4cff-bd76-04dca8cea765	verificare la qualità di frutta e verdura
e63af0ef-5c4d-4c20-9fce-7ea358417456	utilizzare i sistemi di controllo
e640ec6f-02d8-462b-be2b-bddd5bc4ae88	commercializzare i prodotti dell’azienda agricola
e6433dee-f63f-4ab3-9a63-37d0d7be849a	tenere un registro delle operazioni di trivellazione
e643cace-9d72-4cbb-a314-ba3afe7fc026	tipi di munizione
e64353e0-f6df-49c1-a31a-d75e5bca3140	fornire diagnosi nel contesto della psicologia della salute
e64e53e2-cd0e-4d46-8954-dabf6dd62036	creare una mappa di texture 3D
e64766b3-f8c7-45a2-acd4-eba040cf2ced	regolare le macchine di misurazione
e6533684-721a-4279-abf3-82d88952bd21	individuare i benefici per la salute dei cambiamenti in ambito nutrizionale
e65f9e3d-62b2-4e37-a831-02e3af70fa0b	rappresentare i membri di gruppi di interesse speciale
e6589c8e-2f77-449b-a617-46d4b0f55091	studiare le opere d’arte
e648bdbe-b877-4275-9cf8-131e05202bb5	valutazione del rischio del prodotto
e6741984-5873-446d-8ea4-023a08aacf1a	macchine per impaginazione
e66a43c5-6217-4483-95b2-ef39dc876748	valutare la durezza degli oli
e68365a8-5d0d-4f17-85d0-2d3cdba3d8e4	analizzare le modifiche logistiche
e699b421-2623-453d-9ed6-2b7ec45977f9	effettuare la manutenzione delle centrali elettriche
e683fcb9-9db4-4465-b552-c83114fc13e0	integrare misure nei progetti architettonici
e68c6ed6-f909-49a8-827f-b7033691e1e3	fornire informazioni sulla forma fisica
e69afdb5-4694-4e0a-84f2-52c8e315d272	offrire consulenza sulle politiche degli affari esteri
e6a0193a-64d4-4485-a7f7-d3d39f6188b3	utilizzare macchine per il sottovuoto
e69e1afd-d542-44c2-a0af-2e15bf45d677	effettuare la manutenzione di attrezzature fotografiche
e6b94616-ed62-401f-8df7-a1d4db53d6fe	lavorare con i professionisti della pubblicità
e69d1813-e352-4aad-a0fe-4f290c36872d	politiche aziendali
e6937df2-0f9b-4a1c-a931-af8d346c81e4	raccomandare le attrezzature audiovisive ai clienti
e6d84186-3e85-422e-9a21-69ca10a66ae0	cinesiologia
e6c9c643-a53a-4db7-bb08-eba8fadf07ae	offrire consulenza sui conti bancari
e6cdb6d5-3406-480a-bab7-6e0b0f382a1a	Oracle Relational Database
e6d44126-c969-4bbf-a878-9996e8ae7f8f	ispezionare le infrastrutture dell’area lato volo
e6e37692-c9e7-48a1-83c9-1388ba8d9b65	analizzare il piano di studi
e6e89994-3d95-410e-a7b0-19acd656f1fd	sviluppare piani architettonici
e6ed7e20-d788-44f1-a781-6eaf0ba33aee	utilizzare i sistemi critici della nave
e6ea2ee6-cff3-4eb6-b6c2-8e8e5f86b1f1	registrare i dati di produzione
e6f1119a-c804-4069-90b8-4220f978a86d	monitorare l’uso dell’attrezzatura da cucina
e6f99aad-436e-4afc-84a2-8db9fdb80479	terapia familiare
e6f56add-7789-44bd-8289-d993bcea8cf9	coordinare gli itinerari delle navi
e6fee39a-f72e-4342-b5ab-5dccb8479ff1	tutela dei minori
e6ff7b46-e994-4f29-85d8-97aaa5495407	impilare le merci
e7089436-9f8f-45d7-b472-58eb3e269ab6	installare ripetitori di segnale
e709100d-327c-406a-abe3-63033e52396f	consultare le risorse tecniche
e712965b-6940-4744-b86f-3e8c3e9202fe	selezionare gli interpreti musicali
e715597f-1ec7-4a9d-ac45-53933206d5a4	posare gli intarsi
e7188762-0d1a-4f10-933a-c4d40b832f96	dispositivi protesici
e737153e-8a61-426a-bd8b-afff6cc53f36	usare la programmazione logica
e737bb80-231b-4718-91a7-2e2dee7f7fa2	intervistare focus group
e7460fd3-d713-4b3f-adfe-786e9ce13d70	essere addetto a macchine trafilatrici di tubi
e747d2c3-498d-4ad0-a0b4-a707269641fc	tradurre le formule in processi
e7493916-62a8-443c-96df-a8d562237280	gestire dati, informazioni e contenuti digitali
e74cbdd4-33d1-4f3a-8027-d5385d743086	offrire una consulenza sulla tutela della natura
e74d0aee-1b7f-4901-a763-50627c4dfc65	presentare la domanda per finanziamenti esterni per l’attività fisica
e753114e-6e7f-4eeb-8259-1218db56ea9c	assistere le celebrità
e7573f6e-4c6e-4a2a-b990-8dd3fad1ee72	documentare le giacenze di costumi
e7609764-a286-434a-8e84-9565ded5d522	processi di disidratazione degli alimenti
e7640bc6-583d-436c-a787-c17900e9d1ce	collaudare sistemi elettromeccanici
e7645bf4-3385-41bd-a099-5a9edf8dfbeb	adattarsi alla nuova tecnologia utilizzata nelle automobili
e76eaef6-f128-4b6b-87c7-da6eb9df3b48	fissare articoli in gomma
e6a8a1e0-f969-45cb-8246-9a38e399a168	riesaminare i portafogli di investimento
e7750463-c597-4100-b26a-1b5c8f170d54	sviluppare test software automatici
e76f01a9-0fa8-43ac-b5d6-c6fb5f9e14fb	fornire istruzioni al personale
e7754134-78a4-4286-8041-38b4a302f9c1	supervisionare la logistica dei prodotti finiti
e6e152fd-35d4-4927-a22f-06fad73fe4b2	fornire informazioni sui prodotti assicurativi
e77ab68d-134c-46e3-9c43-11fb37139b92	creare il montaggio preliminare
e777a8de-3385-4ebb-b8ee-2bc9130b6ea0	selezionare la musica per l’allenamento
e782cc93-fc9f-48b5-87ca-e742b2a453f6	conservare i prodotti della pressatura del cacao
e77c08a7-1888-4be6-9aac-7fb8a7011084	bilanciare le risorse del database
e7840ceb-4a2d-4e0d-a519-190faac625a5	eseguire il debug di un software
e78d0055-b51d-41ff-ba1b-0edacbb07766	monitorare gli artisti
e785ec1b-6fde-43db-9ac0-c525c16d15ea	valutare i livelli di idrogenazione degli oli commestibili
e78d7f66-d0c9-4180-a937-c31b46181202	applicare tecnologie di asciugatura in forno alimentato da legna
e78e3ea9-63fc-4e27-ba30-33033d55cf94	trasformare i prodotti orto-frutticoli
e707323f-936a-4ec8-b00a-e8522f7d0393	conservare i registri delle attività estrattive
e7908670-3275-40c6-99f9-47658c333a69	installare i dispositivi tagliafuoco
e7930ae5-9b6f-4834-8181-6596c7eb70af	misurare la frutta o la verdura
e79dab30-7ef5-4ac4-a7bf-fb83b729ed99	rinviare un paziente all’oftalmologia
e7a3b6ec-ce19-41a4-8ce2-c843644c7dcf	interagire con i pregiudicati
e7a27802-3bcc-4031-8824-e9b3f8de3246	manipolare materiali per dispositivi medici
e7ab51ba-4c17-4442-a327-a245b6058cbc	scrivere in vietnamita
e7b01192-428f-4a18-92ca-a3a87d0a2fa5	tipi di vernice
e7b19c3a-a0fd-4416-b950-49da6164b0b5	principi di leadership
e72089e1-dd62-4cb6-b101-c95cf2ae18bc	reperire alloggi per studenti
e7a5d9ff-dfa1-4c62-9662-7a6225092250	guidare un gruppo
e7b971c6-ba61-4fbe-a06c-76a514f4f9bc	ballare
e7bb2758-2ac6-4f28-8cef-2968abc95201	parcheggiare i veicoli
e7ba9fe8-65fb-4150-a74b-f32c57b6750f	Informatica PowerCenter
e7bd04c4-de57-44a4-b22d-a93abdc9f319	comprendere il lituano scritto
e7bd2c8a-3055-422a-bfca-fdc0353ec938	processi di calafataggio
e7ba708e-7e6f-41c1-a872-19f9f9da8254	negoziare i contratti con i fornitori di servizi per eventi
e7c704b4-0807-49e8-8865-a9dc9bd761d7	tipi di orzo
e7cdca51-4d68-415d-91b2-fe107a777aac	configurare stabilimenti per il settore alimentare
e7ceaf59-9f38-4b3a-9710-9aca33f40dc9	fornire consulenza sulle procedure di domanda di licenza di pilota
e7d98233-f2f2-4b15-9411-02146bb4cd90	scala dei tempi geologici
e7d5135f-fdc9-4692-892c-db6e8f9ac49b	incoraggiare l’assistito a praticare l’automonitoraggio
e7d774cd-6e61-4571-9ae5-bc6b2a445283	stimare il valore di beni usati
e7e49107-848d-4d36-a948-1c6b0fb72add	ideare itinerari turistici personalizzati
e7e7e12b-38f3-4ca5-9085-19e493b2268d	utilizzare i composti per la lucidatura
e7e827b9-8e30-4b5a-948f-38f1c16f6ba1	gestire gli incidenti
e7f192fa-32de-4991-98c8-ac3acb04c9e0	riparare parti di mobili
e7f7cdb2-9e78-4719-b36f-28a537003ae6	selezionare i tipi di conchiglie
e7eb3371-a3a0-4345-b999-a3d7a60974b5	porre le domande in occasione di eventi
e80307bb-24ba-40b0-94a3-6f82b3feec08	neurofisiologia
e7feb67f-6f8c-4ee5-afad-74f8e767f473	garantire il caricamento delle merci secondo il piano di stivaggio
e7f5576b-5fdf-482a-b4d6-f451a290bf8f	ingrandire o ridurre incisioni con acquaforte
e80c0ce0-069d-4ecf-ba07-99efa19e0b81	sistemi di sportello automatico
e80e9662-1058-47d1-a175-b145ef5c2f5c	comprendere il montenegrino scritto
e821e202-ccac-4b8a-85ca-2a038e19cf32	guidare un’ambulanza in condizioni non di emergenza
e81834a9-8fac-42eb-ad54-9eb0ff2fb363	regole dei giochi
e817a6a2-082f-4665-a9b9-baaa27b81a2f	condurre studi sulla mortalità dei pesci
e827387b-3448-459e-b844-31e324905b3e	operazioni dell’aeronautica militare
e823b578-d26c-41df-8109-0ebb5ac7c4ad	orientamento, navigazione e controllo
e832c204-8dfa-4a74-b040-e0281669ef4a	brevetti
e83150e7-2441-43ff-bd7b-45602f4ff281	gestire tutte le attività di ingegneria di processo
e82d9662-4259-42fb-b96d-ddc4a1e44782	promuovere gli imballaggi sostenibili
e83a9d7b-b9c1-4fe3-8cf3-e439fde8ef4a	creare cornici per mobili
e843b6f7-8f57-4cd8-86bd-550437fa6226	creare opere d’arte
e84a4378-d800-4ce0-9d63-1e8c8f604c96	patologia del sistema riproduttivo femminile
e83e25c9-0596-4b4d-923d-eee2725dab67	modalità di interpretazione
e8485fae-2120-4514-9c46-47ee70fb12e4	fattori umani relativi alla sicurezza
e8332826-d0bd-4bfd-80dc-d41960706ac3	stimolare i processi creativi
e85b13db-1f67-4fc3-b7a7-2e3815e1bd5b	creare disegni 2D
e8667fef-1f14-4f63-9d37-21cfa2ca6173	sviluppare procedure di collaudo
e8751e3b-bf9f-4864-a132-07f21521345d	essere addetto a macchine per galvanoplastica
e86b0905-32be-41d0-8908-9ce267464968	gestire piani di disaster recovery
e8759ced-d8d2-4cfe-b820-b00fb687d284	ispezionare le sale macchine
e876e427-c8e4-4a01-8004-d7e3a47afdd3	leggere una scheda tecnica
e87658cd-e02b-45fe-aa2c-b0adf09e2459	azionare il disgiuntore
e87efae1-7103-4f97-88b1-3ee5acde578e	applicare le normative sulle operazioni di trasporto merci
e8803173-3b22-4758-a0c2-bb8f023bee13	benessere degli animali
e88b5122-c468-4590-a23a-0ffc9d137383	trasporre musica
e8793a78-169c-4318-a1c6-4bf640ac06eb	tenere registri di farmacia
e896076e-1785-4183-b6d8-b975e4bb2331	diritto dei media
e8962e44-d920-416a-9fc3-c880b9285bfe	tipi di motore per veicoli
e899685b-2130-44aa-8014-d46591e29bb4	adottare misure per la gestione delle sostanze infiammabili
e89f3438-1883-4bf6-9ccc-d668828f0255	calcolare i livelli di acquisto delle materie prime
e8a19337-9ebc-475d-b919-f73fa8b45796	archivio delle cartelle cliniche
e8b3fcb0-7b8f-4ce5-af66-8f1a291bc84a	gestire le comunicazioni con le autorità governative competenti nell’industria alimentare
e8b23e6b-f66c-4a29-b33a-f5ddb7775f54	dimostrare consapevolezza interculturale
e8c2da39-8831-4265-b699-7e59086e0cc8	tipi di carico
e8c0cdb2-518f-4807-a16e-e8ad3aa96b49	mercati finanziari
e8ab1f50-8a7a-49e0-84c7-cb2662e1d4fd	stimare i costi della raccolta
e8c6beb6-e9bd-47f9-bea4-b84db0d7b85d	tecniche di brasatura
e8c4f7b9-7830-4eec-83b0-6c043c47545a	definire i diversi stadi di luminosità
e8cae297-8581-431b-9f0f-ef0641915e9b	fornire informazioni sui tassi di interesse
e8d5f3da-786b-4c39-9cf8-1a1f7ba41839	ottenere i permessi per l’utilizzo degli spazi pubblici
e8c79b6d-d0f2-4112-b9c8-6017c749da01	pulire gli spazi angusti
e8d9d221-0277-4a31-8e69-dd1d365062d5	insegnare scienze veterinarie
e69e3e1e-72af-498f-9070-2aa81decd9b1	installare i vetri senza telaio
e8ebbe65-1bff-4c97-b96a-1161dcbf345b	pratiche culturali di separazione delle parti animali
e8e7ae34-a569-4d88-93ae-582cb1d517e3	applicare tecniche di intreccio per mobili in materiali tipo vimini
e8f4bd8e-fa3b-4760-abbd-5e1e3fb95a2e	procedure di assicurazione della qualità
e8fb6129-9046-4143-a118-720d8c7a0429	citogenetica dei tessuti
e8fd0c58-92b0-408f-8a08-87e7339b4840	gestire ordini multipli contemporaneamente
e912ea49-cb4e-4908-b2ae-5469f2a2572c	tipi di motore a vapore
e91a1841-361e-405a-9c61-96bfbbf28c9e	vendere il legname trasformato in un ambiente commerciale
e8f8da89-ed4f-4a49-a281-f7f5ccfea10a	valutare l’impatto ambientale nelle operazioni di acquacoltura
e927a8dc-4ef2-4ca8-ad49-d280a6efa6a4	processo di produzione delle bevande
e9271622-3dae-43de-a4d1-f87d38a66049	condurre l’analisi dei rischi alimentari
e927f6c6-864f-472d-80e3-144274eff64e	tipi di stampaggio
e92c8e42-8deb-4ee4-8851-427c9327279f	rimuovere il torsolo dalle mele
e9319a0b-379b-4ef0-a71e-bacb86ceaae2	processi chimici
e9355181-f919-4694-9915-030532df224a	applicare le competenze di chiropratica clinica allo sport
e9351a72-6a6a-4fb0-a3f8-61d3eaa7b2c2	comunicare in un contesto esterno
e93dfc8a-f546-4694-ad4b-b074a64dc9ed	funzioni dell’imballaggio
e93e2e94-39f5-4093-9ccc-738805b74d2a	apparecchiatura di laboratorio
e9407fe3-2f47-4b02-ae1f-3d99bb9e1e3a	partecipare alle sessioni di allenamento
e94c111b-b250-4cb3-9803-1f03026b7389	comprendere il macedone scritto
e94e3bdf-34e6-4228-b9cb-6858c829a4a3	interagire verbalmente in gujarati
e959fdf9-2069-4bca-9b64-b6d7a8577a5c	elaborare contenuti multimediali
e95cfc5b-db1d-467f-a8ec-5315cf05fcf7	processo di coking
e95f91eb-9e66-481a-b8b8-3f7089e4020d	eseguire la legatura delle barre di acciaio per il cemento armato
e965d917-8d1b-447c-9d6d-cdf8258d3786	elaborare processi di gestione dei rifiuti
e9662a4e-aef5-42a0-9f05-12a856b4c17d	utilizzare gli strumenti finanziari
e9672f1d-a202-4589-9769-74acd73db964	tagli del legno
e87a686c-93a3-447d-b9e8-529597cae33e	eseguire la manutenzione del velivolo
e96c03f9-46ca-446b-9384-ccb9e8bbf424	produrre pasti pronti
e89e6dfa-ba8e-40ce-a91f-ea5a8cea1ad9	trovare un sostituto per il direttore di scena
e9826b84-280c-4ea5-a9c8-3f2626f350a3	gestione della rabbia
e98ad04c-ed59-46ba-b231-252bc3151e2a	supervisionare i dipendenti sul funzionamento delle pompe di carburante
e98b603c-207a-41e9-b22a-0a8e56aef91e	gestire le procedure di prova sui minerali
e98ce8ee-174a-4521-9a5d-b70eb9598a8c	gestire gli eventi ippici
e9926688-08eb-4258-8bb1-ef8ece7fe057	collaborare con gli addetti all’assicurazione qualità
e99c5e75-69ea-4ae7-a3bd-842c6daa2d1b	elaborare soluzioni per contrastare comportamenti dannosi
e9a07320-c13d-4ab4-93fe-b28e0c6be62e	presentare proposte progettuali dettagliate
e9a15a7a-71ca-448a-9c3b-d7de016a7bc9	effettuare operazioni di miscelatura
e9a3804e-6aee-4e7b-8295-85c94a05c32b	ambiente naturale sintetico
e9a21a13-5e51-4a02-816e-57d5937f9a56	gestire la sala macchine della nave
e90e20c4-cb6c-4220-b1ac-a8bc95fe1016	utilizzare una pressa di goffratura elettrica
e9b0da94-0f62-4ac3-9e7c-79fd02b12fe8	procedure di prova
e9b0df6e-af21-472c-be47-e9400a2b38a5	bollire acqua
e9a7bee2-f1c3-4643-b605-896decf5550c	gestire il personale dello zoo
e9b58cd7-6800-4622-a919-83e5068e51c8	adattare gli esami dell’udito
e9b4f6fe-a88b-4447-bad4-67402919b3d9	prendere decisioni
e9baad13-e93a-414c-8cde-feafa4a7c872	tecniche teatrali
e9bbc65a-3864-4bc9-ba7c-4aea5308d422	applicare l’adesivo per piastrelle
e9bbc0b2-dd18-4cff-980b-681c576a128b	ML (programmazione informatica)
e9ca60ba-65d0-49f0-87cc-ddaac1e53452	attuazione delle politiche di governo
e9350ee9-4078-4651-a046-4fb3ce891977	QlikView Expressor
e9c70a37-f014-44cb-9fe0-616d187e717f	supervisionare il servizio di lavanderia per gli ospiti
e9d49bb2-a6ca-400e-8af1-72995b1742d6	valutare il prezzo delle azioni
e9df6d7c-30b8-4058-8bfb-e6e9ad6dc458	redigere la valutazione dei rischi
e9cb5803-e644-4a3b-9ad5-88d2df6218fd	contattare i clienti
e9e38661-9431-4393-951e-081e38908e18	adottare un approccio centrato sulla persona nelle arti
e9e6d265-0d9f-4d71-80c6-3bc97a5b823f	utilizzare macchine utensili
e94bbe00-d002-4fcc-94bd-64019adaf043	verificare i veicoli finiti per il controllo di qualità
e9ce4c1c-f793-4947-8318-b37e9e2ef8bf	elaborare strategie di bonifica del sito
e9f7962d-f64c-4e45-9d94-2cbb2ca666e1	effettuare la manutenzione delle attrezzature del laboratorio protesico-ortesico
e9ff936f-7a2b-4f71-ac9d-637526c400eb	assemblare optoelettronica
e9f1af59-195d-424d-8977-fc2cb7f67a8e	tecniche di intervista
e9ec70b9-3960-4785-ab43-2a634fcfa024	ispezionare le linee elettriche aeree
e9f8cedd-59bd-44a0-8104-86bf8b8e5a0e	calcolare le quantità di materiali
ea0408d2-fe95-4413-944e-2d377e2dcad2	elaborare specifiche di tessuti tecnici
ea17d6cb-0f4b-4d0b-ae19-4ed9ae48a987	scuole di musicoterapia
ea0e0616-5c07-4f2e-9261-bf7f29de83ac	effettuare una polisonnografia
ea20bf2e-e59b-4aa7-9001-0fdd4924d174	manipolare i materiali tipo vimini
ea1c6840-40a7-4a1f-9120-062fcd918495	riparare l’impianto di allarme
ea143d2c-f536-4197-a268-b1ba72bd2444	garantire la sicurezza dell’hotel
ea22420f-8b6a-4434-bebb-8a4bd1f3ee9b	condurre ricerche chimiche di laboratorio sui metalli
ea2edd9c-5b35-4a9e-9ce7-05a21fac482a	progettare infrastrutture per miniere di superficie
ea3bc1d5-66d4-4a20-97b8-aff7d2e8e9e7	redigere i messaggi di posta elettronica aziendali
ea33f4ad-6bf3-4f3f-a9e7-3b1be8438cae	definire i metodi di costruzione dei set
ea37bfee-b157-40b6-9d3e-40bba0ebb168	dirigere il cast e la troupe
ea334fca-0c06-41b2-9b28-b24cc90d13ad	lavorare con il team di pre-produzione
ea470e85-fdb3-490a-a3fd-7f8a8274c4ba	sistemi di ventilazione
ea4cf1cd-2ffc-4056-ba71-e90ce6eed3fa	effettuare la manutenzione delle autobetoniere
ea3da10a-1ab1-4511-b3ea-c7fce061ef79	osservare le norme aziendali
ea566407-e84d-4e75-a31b-07da88dae492	gestire le diverse tecniche di cottura della ceramica
ea538bd8-f5a1-4a28-a942-8b2401befe7a	formulare un modello di concettualizzazione di un caso per la terapia
ea5526ec-be29-4f32-a9e0-e4e8542a9cd7	assemblare sistemi microelettromeccanici
ea5a0d45-39ca-427e-8f29-3a42099c34d1	spettro elettromagnetico
ea6535ce-eff0-4d03-ad5d-384463d8ea47	ricostruire i documenti modificati
ea5f1718-cc27-4b27-bdf3-83190013de0f	trattamento di metalli non ferrosi
ea6e0bc2-73fa-4bdb-9135-ac22ef737253	gestire i bagagli degli ospiti
ea6e01ce-96c7-4716-b892-3bdc2ce2bc26	CSS
e96b769e-02b0-42c4-bc39-fd2f231a1642	impiantare microchip in animali
ea6e4214-bdd2-49d1-a91a-662935f04386	fornire consulenza sul miglioramento dell’efficienza
ea6fdbe2-24ae-4317-a0f5-1f400ad4da43	usare il software CAE
ea7982a8-f4d9-4ce0-a446-b4b7ed875feb	principi di sicurezza alimentare
ea764d91-fb99-432d-8ac5-fba6308a6686	utilizzare microsoft office
ea84a646-ffae-4375-af42-38bf71a8158e	utilizzare apparecchiature tester per batterie
ea8b623f-b4ff-4d80-bd33-116f20c8fd32	regolare i forni di polimerizzazione
ea850229-3606-42a6-b939-4d796c384d50	fornire la formazione sulla sicurezza a bordo
ea944f47-855c-4a90-a53d-046375fb68b5	tipi di serbatoi in continuo
ea8cf664-4cae-498a-9c0d-91e77e6a1a3b	fornire consulenza in merito all’ispezione dei ponti ai proprietari terrieri
ea9e7bc3-7bf7-4ac5-8bc0-667e346a6c8f	certificare l’esecuzione delle procedure veterinarie
eaa84bfe-4626-4bcd-8aa0-3c866bfe867a	supervisionare le attrezzature
eaa5c298-dcf2-4aaa-ac73-344dca76b3c7	mantenere operative le comunicazioni
eab2b39f-89a2-4cf9-8931-f198ef26df57	tecniche di marketing dei tessuti
eab6bddd-ce45-4921-8015-0c2a06d5783f	eseguire la riparazione di veicoli
eab65051-e6e7-4c07-a9bc-57ac70602901	controllare i tassi di crescita delle specie di pesci allevati
eac50567-7753-46c1-925c-b60f1bd4f2be	vallone
eaaaec7f-225c-455a-aaa9-3e711892eb99	effettuare la manutenzione delle attrezzature del laboratorio medico
eadce971-0fb7-4612-826d-08dcfb0dce56	organizzare le revisioni contabili
ead43500-2999-46a6-b584-1c07a387c2f1	manutenere apparecchiature elettromeccaniche
eadd1870-0d2d-41de-90b6-42fe1e23bc6d	studiare le culture
ead1ba1b-9e82-40a3-ba2d-a11960c74797	pulire le navi
eae86193-f250-4d80-925e-3dec8e834232	rete tranviaria
eaeb8806-8ce6-450a-9e99-4e812f022dd5	misure sanitarie e di sicurezza nei trasporti
eaf2162a-fa8d-4636-84fe-75caedd65583	usare software CAD per i tacchi
eaf77ff2-c4c3-4bd3-90d9-6407ccea55de	macellare animali
eaf316f8-d33a-48ee-b083-d3263bca4d23	offrire consulenza sull’organizzazione dell’offerta di servizi sociali
eafaf79a-b5fb-44d4-b030-5646d0482a2b	malattie di origine alimentare
eb019281-8618-4074-8bbf-1818eb336a9e	gestire la cura dei pazienti veterinari nella fase del ricovero
eafffc04-f6bc-46b1-82d7-7c1faf972a1e	trattare i rimborsi
eafb9ea0-74c4-44f7-9c6e-8e953020bd06	registrare la quantità di legname
eb09cf95-c432-4861-9ba4-bf97459581aa	coordinare le campagne pubblicitarie
eb0dff5d-86f5-417d-9185-2b7169b46830	tecniche di musica per film
eb1a680b-0b0b-4d0d-9798-918435dec61b	utilizzare le tecniche per aumentare la motivazione dei pazienti
eb051f36-9dd4-46d4-8f0b-e11e21591ada	gestire la classe di allievi
eb1c7e8b-3fd7-4c2a-a881-0e001883fd9e	balneoterapia
eb1f7d5c-3a69-4a26-8b9c-140e9bf7b323	linea di produzione dell’industria conserviera
eb26dee1-15f6-4b3e-ac0f-3e52adb36584	essere addetto alle macchine di pulizia del cacao
eb2b2722-264b-4fe9-b945-8823980506c0	controllare il termometro della vasca
eb2dfe36-71b2-45c4-89fd-1fc0fdfc016d	offrire consulenza ai clienti sulle biciclette
eb200306-204e-4047-803d-fb0aed32422b	attuare le strategie efficienti in termini di costi per la movimentazione delle merci sulle navi
eb300df3-68a0-4d14-9faa-3a6858f6f44e	neuroanatomia degli animali
eb30bdf2-8fab-49ed-aade-bdf3ab2deffc	preparare il bilancio annuale dell’aeroporto
eb316c09-53a0-436b-be52-1ee706fbbf33	controllare il processo di stagionatura del calcestruzzo
eb3ae1d9-9efd-46ec-bf59-6aed46da0add	provocare i pazienti utilizzando l’arte
eb3f365a-b602-4f32-8ecf-731680a15350	conservare le piante del sito minerario
eb4d54c9-db81-4a76-b3ce-3d832dce5ddc	far fronte alla paura del palcoscenico
eb4e10da-35d6-4b78-982c-7aa0d2a3300d	comprendere il materiale da tradurre
eb507fac-3cd5-4cc7-ae18-eb03d710f277	provvedere ai permessi
eb542b47-d5ad-49a7-8162-22d84e570255	mantenere la configurazione di sistema per una produzione
eb569c9e-61d7-4d32-8b9d-b4483133672e	innovazione in campo infermieristico
ea3f4075-65c7-47a8-901e-0ff0ea0659fc	effettuare una ricerca per fini aziendali
eb61ec76-f6b5-468a-82e8-f5aca599170f	comprendere il giapponese parlato
ea5a65b6-65af-4da9-b644-fd3a78187425	gestire i motori di secondo livello
eb64e3b1-5496-43c6-aa5b-9e92910eaae8	controlli non distruttivi (CND)
eb675f1f-a025-431c-8f97-a9b6aa252ff8	sostanze illecite
eb698eb4-7c1e-4b64-b475-ca3ebfcc1968	processo dei blancher (blancherizzazione)
eb7bb948-480c-4de3-bc4b-b44eb78bb0b6	allevare materiale ittico in avanotteria
eb6ec778-2612-475f-bdbd-2c1d32f73387	tecniche di scavo
eb810377-6029-45ee-a453-f2e626cb8f70	ideare decorazioni floreali
eb80f280-9b3a-4a91-9806-de676e3c71db	tecnologia farmaceutica
eb823f21-95e4-49d1-8d1a-7bb2ff75fe0c	supervisionare il personale odontotecnico
eb881563-437c-4c0d-8582-f689452a6dc8	mantenersi aggiornati sugli sviluppi nel proprio settore di competenza
eb9056e9-7b77-4b15-a0be-1db86150d336	eseguire le procedure di manutenzione per l’assistenza a terra
eb93ff30-1bdf-4620-8071-ee16d882d348	utilizzare i macchinari router
eb9618f6-4209-4a42-9a52-7103e2f0d8c9	gestire il magazzinaggio di grano
eb9a2672-e25a-4ef3-8394-bbf4b874fbcb	utilizzare il sistema di sorveglianza del bacino
eba65e13-073d-4bb0-bf1b-ef12af39a02a	riparare strumenti musicali
ebaa5e4e-6800-4175-9152-8b4a3e93a8b8	tassazione internazionale sui prezzi di trasferimento
ebb0b63b-ffe3-41a5-b4e7-925a30873713	chirurgia dentale, della bocca e maxillo-facciale
ebb13353-b527-4ff9-a68d-b3956c3047c1	offrire consulenza ai clienti sulle audioprotesi
ebb50fa7-e3fc-40b3-94b7-c7587b273b45	utilizzare le attrezzature di sicurezza per la verniciatura
eb1c0f40-2d3b-486b-8533-a8fa19374991	aeronomia
ebc1a84f-d84d-41c2-b0ad-b7c5bf05fb56	affrontare i cambiamenti nella domanda operativa
ebc2c416-7910-47f3-b94e-c4dc1e867dcc	impostare i parametri della stanza di essiccazione
ebdbea27-c962-409d-9a8d-9d3d9c1f472c	eseguire prove sul petrolio
ebeb6223-94b3-4fde-90f5-ff569ef69456	produzione di generatori di vapore
ebf38c2b-8d57-453a-a685-4a9862bfbc48	petrolio
ebf1d13b-6f65-4039-b84a-47bf5db5de7f	utilizzare una console per le luci
eb37b29a-a79c-449f-936f-998869a40cc1	selezionare la vetroresina
ec026147-17be-4a7e-9e4c-1fba36e427ef	mescolare gli aromi delle bevande alcoliche in base alla ricetta
eb3e0686-ba0b-4819-af37-36d6178b85eb	configurare le attrezzature per la cattura del pesce
ebf46e27-c3e2-4055-8db6-bb15c12e18f0	sorvegliare la qualità video
ec0ed85c-66bd-4860-aa32-a9ac7cfa5d88	rilevare i malfunzionamenti del binario ferroviario
ec0675fa-8049-46b4-9375-441d298f7496	monitorare il mercato azionario
ec199091-a758-4239-bec7-1b49658d90a3	garantire l’integrità della corrispondenza
ec137214-e48d-45e1-b378-7d65085babb0	preparare studi tecnici in ambito ferroviario
ec1b7fc4-5b7c-4e06-8884-af2b958df14a	controllare la presenza di ostruzioni
ec2a85b3-1353-4a9c-a385-aed37f4d2dd2	azionare le apparecchiature radar
ec2d13fa-90c2-41cc-9914-e68b96bc3e6f	supervisionare le attività di laboratorio
ec2ea817-a4f0-4c19-b0f6-235bc7bcd1e9	coordinare l’esecuzione di un’esibizione
ec2f23ed-c491-4849-a73b-b0d0e18c27ab	stirare i prodotti tessili
ec33f68c-ac01-44bd-a87e-0cd108e10b71	allestire macchine per la lavorazione di tessuti rasati
eb574ff1-30a3-46f0-9ef3-6d0d23205ac4	controllare il materiale di scavo
ec34694f-b41e-4342-95dc-3acb97bf38d3	procedure universitarie
ec39061a-a230-486e-b206-f576ece4973d	effetti dei pesticidi sulle materie prime alimentari
ec3c187f-487f-40d1-8529-a2335472f3d4	espellere le capsule riempite
ec54e072-d4af-4be3-8477-f5ddf6d3a0fd	comprendere il malese scritto
ec568384-e08d-4b47-8840-2579c24ef142	prevedere i rischi organizzativi
ec69f099-a86f-49d9-bc93-c1f6e29f48f9	prescrivere gli esercizi per condizioni di salute controllate
ec6f7a35-d3a5-48cd-9c23-28bfd2b0298a	manutenere le parti delle conchiglie
ec6d36ac-f48e-4d0d-9d98-6ec1a007ba3b	mantenere i contatti con gli esperti del settore
ec8a0849-b9f9-4080-b404-809d395eede2	elettrostimolazione in agopuntura
ec868947-9a70-4650-999d-048f67f7bba3	valutare la campagna pubblicitaria
ec8a4d45-5593-44a5-b19a-ec0a34944ec6	ingegneria dell’automazione
ec835f98-db68-4bbb-8984-2c69aa08a419	gestire il personale agricolo
ec8fd7af-b700-4862-98b3-f103b16143eb	mantenere un’alta qualità delle chiamate
ec991c67-3d22-4cac-8374-be5d1539f359	valutare la zoppia nei cavalli
ec9ab6ef-46d2-48f3-8821-d2d7002d9541	replicare i problemi software dei clienti
eca40162-7838-4522-b857-88193c096e51	sviluppare un motore grafico virtuale
ec9c0df3-9e43-43f3-93f9-83c5c3b204aa	smontare il set di prova
eca4cd9d-b0b9-48f8-81b5-098ada552929	scrivere in serbo
eca843bc-454a-484e-a215-78905e6e499b	produrre copie di oggetti di valore
ecaa6177-8e4b-48f1-9ac5-abf275835b0f	parti di macchina sbavatrice
ecb41a33-f2e8-4bbe-a7ad-c54f5e79fb96	piani di contenimento delle fuoriuscite di esemplari
ecc70097-7c5a-40a7-bf52-6659bc404bed	aggiornare il giornale di bordo
ecc9edaa-978d-45ef-94fd-f4643bd3bc62	interpretare le richieste di esami di diagnostica per immagini
ecd4df65-ee51-462e-a591-fcb35e45b397	riparare le protesi dentarie
eccc02cd-ca08-4cae-b523-15a2bddf431b	rispettare gli obblighi di legge
ecdb6c65-8d71-407a-9ef0-7b646d394600	demografia
ecdb2c79-6759-49c0-9c9d-3654e8f9a871	piani di cablaggio elettrico
ebb49160-9b17-4e1a-9eae-272ff8fed945	tenere traccia dei ritardi dei treni
ecf7876e-f594-4d9d-af67-9bad81b3c5b1	componenti optomeccanici
ece4b043-3b67-4ba1-a914-33b531ee392f	progettare procedure per il trattamento dei rifiuti dell’impianto
ecffdd8d-60a4-4dc2-b9cb-8fbe3331ae76	progettazione del paesaggio
ed070639-bc4a-4591-b061-ae8b3ab45ffa	realizzare prodotti personalizzati
ed130be2-e765-4e67-8926-876a37ee0c7a	eseguire le indagini sugli incidenti ferroviari
ed131a2c-ebd6-4f36-9c58-e8402a0f92c7	sorvegliare le operazioni di granulazione
ed0cb11c-6e07-4fe0-b3cc-a1bd74ddab3f	supervisionare le attività di manutenzione negli aeroporti
ecda5fbd-36b9-46dd-9988-7248950d25eb	Kali Linux
ed132c4a-df6e-4640-bba3-3d20ef0bff91	presentare il piano di pubblicazione
ed13665e-a856-4b62-91dd-dc6940354cc4	assemblare parti di un modello
ed16434f-98d0-4653-a2b2-d7ca30f1018e	gestire il coordinamento tra i reparti della struttura alberghiera
ed1bf688-af9e-4c47-8408-d3628989a53e	utilizzare gli attrezzi a mano per i lavori forestali
ed1702b9-2ebd-49c9-82af-9ce3aaf17614	fornire formazione online
ed168f00-fc37-4ca9-a9b4-3ef3e7c9e1b2	offrire consulenza ai clienti sui sistemi di cucitura
ed22aa5a-27a9-48d0-afc1-8946697f7e13	sviluppare sistemi di produzione di uva passa essiccata sulla vite
ed25115a-bd52-454d-a1ab-5be5a6aa0fbd	valutare ogni fase del processo creativo
ed218048-eed0-4119-bf58-c051c0850b0a	essere addetto a torni CNC
ed2535b0-b680-4a8d-a0a1-6fdff9f36f51	basco
ebf3dcf8-294c-426b-850e-e93e67f9fa45	supervisionare i trattamenti di ortottica
ed3761fc-7631-4836-a795-2e1ee69cb356	masterizzazione audio
ed468344-6cf4-4d72-b517-7f0e821df7c6	sviluppo iterativo
ed46b990-1384-43bb-a9ae-a0459f48a8f9	legame tra stili di danza e musica
ed494bdc-bacb-425f-b224-e4768ed8c6ae	controllare i biglietti all’ingresso della sede dell’evento
ed5373bb-9533-4fa0-a036-becffc4fa893	pianificare gli appuntamenti commerciali presso i clienti
ed4db2d0-84cd-45b0-9223-2edb31a9af67	garantire il benessere animale durante i processi di macellazione
ec0c5934-0354-4560-bb22-abdcae06ffb3	montare cavi di alimentazione al modulo elettrico
ed55d5df-946e-4045-be53-e3359bbc52b5	trattare i tessuti di veicoli
ed5a0eac-025d-466b-b255-c8dfc1120ad4	supervisionare le operazioni di gioco
ed641eb5-b04b-41cd-9294-30f006f37d04	gestire gli impianti di macinazione
ed6f66cc-7282-48de-8fdb-c6b1561c8276	astrologia elettiva
ed67fc45-1213-4d9d-816c-acc31c60e4e4	fornire osservazioni sull’evoluzione delle circostanze
ed8b79e9-1d84-409e-b50d-8d9179668625	codice di comportamento ai fini di una pesca più responsabile
ed84deab-d1bd-42d8-a009-08a0f63a706d	coordinare la gestione dei fanghi di depurazione
ed778411-9ba6-49eb-ba84-fccaa9e2a9a6	preparare i percorsi di trasporto
ed69f114-556d-43a4-bfb5-bb2e63bd4461	analizzare i processi produttivi per migliorarli
eda573bf-e2b3-4878-a419-dd54ff6e9c43	installare dispositivi di monitoraggio dei movimenti delle rocce
ed92cd7c-f020-4fa5-a3a7-961ed382c49c	gestire gli ambienti di produzione di bestiame controllati meccanicamente
eda670e9-8943-4a7b-8bfe-fd4c1fd928b0	agevolare l’accordo ufficiale
edb40cb4-175c-477f-a2c0-4fd82d6b5c6e	valutare i contenuti di marketing
edc047f6-e0ac-4a06-abe9-65eace0fd03f	fornire assistenza negli interventi di chirurgia dell’epilessia
edc03faa-0ab5-4c1c-b98f-97539e89bef5	parti di macchina burattatrice
edc8069c-b920-490c-9870-a6af34301165	manipolare il vetro
edbde978-55a0-4cac-a4d4-00406144afb6	garantire una corretta temperatura del metallo
edcf591a-88a9-4396-9fc2-463b9af439a9	trasferire la calce viva
edd158d4-100a-4a1b-9119-cc53ff8e10f9	eseguire lavori in quota su alberi mediante funi
edd5fd28-ecb3-4b19-ac57-66e115f26534	allumina ceramica
ede02ec5-37cf-488f-bff5-31b041cd4777	comprendere il greco parlato
eddf50f1-8284-4ede-8a16-d460755e1ec6	applicare la massoterapia
ede85e05-f38f-4c43-a0ba-0865712542e7	rispettare le norme di sicurezza durante l’esecuzione di operazioni forestali
edeba155-9104-4f4c-959a-6a86e75b9714	gestire gli scarti
eded6e1b-a0fa-4050-919f-e5b2d64121d2	tecnologia di laboratorio medico
edf29e0c-ec90-4752-a719-4d803bad3a36	psicologia della salute
edf2ebea-5d94-4781-831c-278ee15c7412	eseguire prove sulle materie prime
edf6e6e6-269d-46c3-96b7-3f406131035d	preassemblaggio di tomaie per calzature
edf7f639-330b-4ef1-835e-f92a2e5faf9e	individuare reperti archeologici
edfd1f89-13e4-4b9d-bea1-17ac66421c13	raccogliere i materiali di riferimento
ee0e1faa-68fc-4ebb-88e7-ef8f43ac6a4d	elaborare strategie di miglioramento
ee17fec0-942c-4558-aed8-6cc67fd70e97	effettuare la manutenzione delle attrezzature per la chiropratica
ee1a0a38-a19c-405f-86fd-939a9e6bbd8c	mescolare i materiali di stampaggio e fusione
ed1e708c-1e0e-42a4-ab75-2d70111c6071	assegnare i veicoli in base alle esigenze
ee1df88c-1b2b-4f22-b194-60d1973771b3	controllare le operazioni di registrazione
ee26b461-f423-475c-8e33-9a5c54c94e0b	impedire i danni dei dispositivi elettrici di bordo
ee2a3016-087b-43e0-9110-b25062c2a5d9	operazioni di sminamento
ee31fc0b-cbf7-4f82-a69d-30c03efc96e5	installare batterie delle attrezzature di trasporto
ee3334a9-73a3-4673-aca3-5df2e4640f9e	algebra
ed788424-8fc1-4c88-a424-1131bf9a1c73	utilizzare uno spappolatore
ee3687f1-a766-42bd-bbf1-5830af2397cd	trasportare le risorse fisiche all’interno dell’area di lavoro
ee530e1e-76c9-49e7-981e-6f16abd9bf00	monitorare il flusso della gomma
ee559b85-ea32-47b8-8621-34bd94649fb5	pianificare il collaudo del software
ee55a2f8-b0a2-4459-a538-21496fa9a387	impedire il contrabbando
ee3bc21f-c305-4b61-aff0-469cf2d2549c	stimare i costi delle forniture necessarie
edd7ac97-6cea-48b3-8ab4-aa1f6c721b7a	supervisionare gli studenti di chiropratica
ee573080-4aa2-4e4a-9fe1-9abe1538aa0c	gestire le attrezzature dell’impianto di estrazione
ee56fb95-b6b1-42c3-a883-b87b7814dde9	rispettare i principi di protezione dei dati
ee64efb1-69d7-4cf8-b1a6-892e2f70e064	creare set in miniatura
ee6938d4-f0f8-4195-b3c9-152e0e2e6922	eseguire una pianificazione strategica nell’industria alimentare
ee6438b8-9652-4f81-9396-cf4ef329b6da	riparare le attrezzature industriali
ee6feef3-53ae-46b0-8f53-31f185b8c5c2	azionare il martello pneumatico
ee79a27a-2109-4b35-8f01-b096ce09e903	determinare i fattori di esposizione del paziente
ee7c6303-08cd-49d8-9a33-ceb389cd171c	Brightspace (sistemi di gestione dell’apprendimento)
ee0e4c26-28d8-4a50-9d69-6770e82966b7	spostare le conchiglie riempite
ee8a9893-ceca-42a3-b3ee-5b449bb1a0eb	argentatura
ee7dee84-5d3e-4c66-8bfb-e3f47256a4fe	garantire la conformità con gli standard relativi a salute sicurezza e igiene
ee9b85d0-f97f-44cc-918b-0e110b047fe5	applicare tecniche di imaging 3D
ee8ce9e7-9f7a-489b-9f61-dcc5585f5564	comprendere il bengalese parlato
ee162e37-46d0-405b-853d-498092955dcd	fornire una terapia neuromuscoloscheletrica
ee9e9842-2f86-4f9c-b6cf-3ef3151f7858	far funzionare i giochi
ee9e9a58-9bb3-4063-8cfb-62cdf0a0f522	alimentare il nitratore
eea20fee-7bde-4a3d-925b-b0dbcf2db833	prevenire i problemi relativi al raccolto
eed03af6-542e-4675-83ac-295f8df85d9d	utilizzare le tecniche di preparazione degli alimenti
eec85833-428a-4eea-baa3-09e7eb20130a	coordinare i servizi di beneficenza
eece3a32-6623-4020-b548-d11a3f1ba9c7	produzione di abbigliamento
eed171d4-1b1d-46c1-8987-8c8edef0f872	analizzare le minacce potenziali contro la sicurezza nazionale
eebdab3c-f343-4475-8833-43cf0f04cba2	norme in materia di urbanistica
eed2a3b6-9f81-4795-86e3-738268718965	fissare lo pneumatico allo stampo
eede1044-f1f1-4850-b075-b31eee2348ba	reclutare nuovi iscritti
eed520e1-4ccf-41cc-80dd-361abed4d866	fabbricare prodotti di abbigliamento
eedb0b8f-c49d-41ff-9a10-be794c8c278b	posare il materiale termoisolante
eee9d419-0b8a-497e-8e62-cf6e136a226b	applicare gli standard di qualità nei servizi sociali
ef0f85f5-9317-4c1b-b54e-ac50ee89035f	elaborare procedure di manutenzione preventiva per gli strumenti
ef130921-25d8-40ba-ad4e-6e171073664c	gestire i finanziamenti esterni
ef166c72-8d24-4c2d-a997-31b4c78ec46f	raccogliere informazioni sui turisti
ef1b4d84-13c4-47c2-976c-e630882dce7a	conversione della biomassa
ef18a689-a5f3-4119-8a6d-d23adf53c9d9	organizzare le audizioni
ef13fd25-f87b-4f87-aa3a-499eca6a3845	fornire assistenza agli utenti della piscina
ef297017-5139-423b-94d6-0aab4102278c	tecniche di taglio
ef2d92cc-59da-4ace-b2ce-155b4e54142d	requisiti degli imballaggi dei prodotti
ef40e5bf-35ec-4049-9ed9-f19eb5efb482	usare tecniche di maglieria manuale
ef4be316-32d4-43de-977f-bcff51cc18fd	pratiche di gestione del patrimonio culturale
ef47137e-1a96-4e87-8ca5-08ffa5598586	riabilitazione professionale
ef4d8d03-71f6-4027-b449-5ce182b643b3	mercato del gas
ef4e1e36-7fee-4e1b-8751-123a8397b538	preparare pietanze flambé
ef4e142d-0ae6-430f-b3e9-6aefde54f454	aiutare i clienti ad affrontare un lutto
ef50b507-3790-4bfa-8e91-011ac5651314	rispondere alle richieste di informazioni
ef58eb3d-bba5-4c07-8e1c-9e9b0381a95c	sviluppare strategie operative di applicazione della legge
ef62f3cc-ad9d-4b83-80a9-0a8c3d45e056	rendere le armi da fuoco più precise
ef609955-5bdd-4052-b00c-60bb808be9d5	onorare gli impegni nell’ambito dell’ospitalità
ef60feae-33d0-414a-bda7-3dc30b80c076	offrire consulenza ai clienti sull’utilizzo dei cosmetici
ef60873e-8ef0-4ef2-b8f4-eeb7c7ff6d3f	promuovere la salute dei piedi
ef69377a-8e99-4f54-889f-f0ac08883b5a	conferire su un’opera d’arte
ef6b490b-91de-48f5-a0b8-aa08a6bb1fdd	essere addetto a lavatrici di materie tessili
ef74dc49-753a-4b06-ba99-726da709e004	attenersi ai regolamenti del traffico sulle vie navigabili interne
ef770f5e-317e-47e0-bef8-8cefac30e24a	spruzzatori di antiparassitari
ef813d21-12a7-4045-a369-c32b3bf6134d	tecnologia audio
ef820b41-1fd6-4e7a-9a9e-53c78c899a82	effettuare i controlli di professionalità del volo
ef77bf56-f658-450c-8de3-977c3b894ec0	garantire la precisione dei dati aeronautici
ef88571a-b743-4b51-b038-9b252f5fd89b	applicare primer
ef954585-da23-4389-8559-7da4c37b6724	azionare le pompe per calcestruzzo
ef9744bb-ca47-4f82-bde2-99f202a2bace	utilizzare apparecchiature di distillazione
efa32988-fcb7-4970-af5f-156be30513e5	rappresentare i clienti dinnanzi agli organi giurisdizionali
efa095f9-39b4-483c-926c-a1615d2454a6	offrire consulenza sulla selezione del personale di sicurezza
efad32b3-c103-466a-8a22-9fe6d75a35f9	applicare a pennello solvente
efaf7112-b190-4b6c-a652-89c2065826ff	ispezionare lo stock ittico
efb9ac31-813a-47fd-a3b0-0eb7b838c135	sviluppare i piani di gestione
efb78ccc-eaa6-48b2-807b-c11fc3327400	garantire una gestione adeguata dei documenti
efccc67c-b519-45c0-84e6-f52388efac44	essere addetto ai gassificatori di bevande
efca5f4c-1316-445d-a887-708729d2160d	tenere un registro delle misurazioni dei rilevamenti
efc34013-7079-4b04-b6ea-7a2206ec5c20	controllare l’orario dei taxi
efd035d8-3ccf-4b53-b088-05d105c7dd46	applicare le tecniche di carico delle merci nei container
efd107ad-dfec-4138-b332-30892bd0186b	mescolare la vernice
efda44ea-3c8f-474d-bc32-c1deee098694	resine sintetiche
efd6d1ca-d367-49f2-8732-e10ecf097ad5	applicare politiche di sicurezza delle informazioni
efda9c99-a325-43cb-b2ad-7f526e995af8	interpretare i bilanci d’esercizio
efde808a-02a9-4f83-aca3-2aab6a00990b	utilizzare le attrezzature specialistiche
efe498a8-c679-4568-a908-8105b05ea95d	allineare i software alle architetture di sistema
effc82b8-6e93-425a-9849-a25e350b4672	insegnare strategie di lettura
eff0a62f-1995-4ab5-9dab-c089748f983e	tecniche di prelievo del sangue
effd7bac-5da7-4138-b68a-021aee526d6f	applicare metodi statistici del processo di controllo
f003c0a5-faea-4e63-ab7f-48989516ea89	applicare sanzioni ai soggetti che violano il codice di norme igienico-sanitarie
f003c3fd-22f9-427f-9d8d-dbeee778ba1b	ordinare le scorte di materiali per la cura dell’auto
f005a4a4-3cd9-4c93-a06e-6bff71945806	settore della musica e dei video
f00b0f2f-ca03-4bba-b294-edd0906ee4f4	segnalazioni manuali indirizzate agli aeromobili
f00ac743-987d-498a-9e86-b3e736280c21	lenti fotografiche
f014b810-e7d3-444f-ab0a-a5838651c0e2	effettuare una citometria a flusso
f018a682-246f-48af-9d35-c74204d34389	mantenere lo storico degli orari dei taxi
f01c17b4-8a5a-4ccd-9460-7549608b89e1	applicare misure psicologiche per promuovere la salute
f01b01c6-96c7-4301-8825-afe144fea02c	matematica
f023c4c3-cae4-41c1-a304-da542f301779	nefrologia
f02640ce-aeca-4dc2-a273-81c1c3108a07	lavorare in una squadra di paesaggistica
f0284a54-e99d-4eb2-b179-4b01f237f21f	coordinare le attività operative
f02dd9cd-4b50-4b01-b26a-6ded7c814266	svolgere i preparativi per le procedure di medicina nucleare
f03c28c7-9d4f-402c-a334-cb1b2014b1e4	tipi di corrosione
f04b6dae-2f54-4bcf-8f24-11b8e534ac91	informare i conducenti sulle deviazioni
f04ccdae-71bc-447e-bc61-dde640dfa548	consegnare gli oggetti di scena agli attori
f04c8571-30f0-4cc8-8f46-f8e6c93f12de	bengalese
f0526fb6-0aea-498a-bc9b-cd6e35b32414	scrivere in gallego
ee1b2f6b-dd55-4faa-89e6-938ae1630f71	cinesiologia applicata
f04e65fc-275b-4785-b1a8-af1fcd7d2d57	raccogliere i dati generali degli assistiti
f054062f-b586-4a25-9fd5-930188e6dc3d	valutare la formazione
ef384238-4c15-419c-b4b1-9e72ce0bb597	smaltire rifiuti di taglio
f054b21a-37a7-4d45-8ebd-2eca84ef3f70	struttura organizzativa
f05cc1a7-f508-435b-a8c4-cab13d946aab	mobile marketing
f0677adc-e06a-43d5-b9f2-1f90991f5c68	utilizzare lo scalpello da muratore
f06b8324-76da-4959-9a7e-922e634b6424	tipi di tubazione
f07295ad-a259-4a2e-9a16-64ddaff870c1	coordinare i programmi del sistema audio
f07a9f93-f266-41c9-a220-20ad6ccc82f6	garantire il rispetto della normativa aziendale
f089af99-cbfe-4cd1-935c-6dd391093185	pulire i container industriali
f07b1ff8-1cb0-4cfe-bfd3-75d8bc9e3284	svolgere le mansioni di pulizia
f0a76796-6a1e-40c4-b863-e8c29b2663ae	fornire consigli sui marchi commerciali
f0994d58-733b-4314-a5f0-e27197eb113f	principi di gestione di un progetto
ef83d117-b065-489b-88bc-2a0d72e2c693	creare le pubblicità
f08f672d-f664-4645-a44c-f29b3caeb21e	raccomandare i libri ai clienti
f0b31f3e-f0ba-449b-aefc-3ead76c047b6	organizzare la partecipazione a manifestazioni locali o internazionali
f0bbf5eb-b3ed-4f6c-b63c-0a66b06ae2d1	software per ufficio
f0ab9c6d-965a-474c-9352-ca470c42ec4c	esaminare i reclami relativi alla protezione dei consumatori
f0ae5f67-5c56-40bd-aadf-82ff3f2866c5	rispettare le scadenze
f0be99d0-0228-4c9d-9380-c91f096e85e5	manutenere i macchinari per l’estrazione di petrolio e di gas
f0bf06e6-c55d-4986-b07e-4a977b7a1dd3	gestire i fabbisogni di attrezzature da ufficio
f0c59451-3098-4710-8dab-40075709ea49	gestire gli indicatori chiave di prestazione dei call center
f0d2a0ef-4f9a-41bc-87e5-225227b842d4	conservare le risorse naturali
f0cd8f17-3dc3-4253-8b90-ef1cab6b5f23	comunicare con gli altri che sono significativi per i fruitori dei servizi
f0cbf44c-4669-421a-bbde-dbfa70873054	valutare il danno alla coltura
f0e5bc48-eddf-47f8-8cae-b0f0c0b87a50	prodotti da forno
f0d854f8-ff91-4d90-8493-ab956f58c6d2	trovare le comparse adeguate
f0e64deb-3b7b-480b-866f-e85f2e3dc021	istituto dell’obbligazione
f0f90986-8507-49a1-b576-9b9afabbf2be	proporre progetti all’artista
f0e7f7ff-c92d-4ef8-b72d-ba009b3c586d	selezionare i percorsi di visita
f102a677-2039-4c8c-a7d5-c20adfab5295	pulire gli pneumatici
f0fdae2c-37c3-4fd4-95f1-522aae264692	definire le modalità di cooperazione
f1051692-50b3-4330-97a0-dc1dec4ea61c	collaudare i dispositivi medici
f1092472-fb81-4939-8633-52a94f9ee335	utilizzare le tecniche di illustrazione tradizionali
efef71ce-973a-4c97-9ffc-554a872a10b9	pianificare attività per i giovani
f10dac56-1f64-42aa-930a-8e52f40a1659	offrire consulenza sulle strategie processuali
f10e81f9-ce27-4da9-b04c-e3d3c4ba7fa0	sistemi multimediali
f11337ab-c8a0-40c3-bc39-68982677178a	offrire consulenza in materia di investimenti
f119fcb6-4e2e-40e3-a280-1946dd042014	gioco d’azzardo responsabile
f116021d-8658-43e6-898d-c96c0e4bee17	utilizzare software di pianificazione delle attività della miniera
f11c9228-c0db-4dd0-8d4b-22751db0c402	ricoprire le cuciture con pece calda
f11ec680-304d-4c1c-af98-74e7edef4b71	tagliare cristalli in wafer
f12cda2f-8c57-4287-9c4d-dd9840da0448	procedure di prevenzione incendi
f12a8f51-77ac-4d8d-9858-190995cf4f03	analizzare proposte tecniche TIC
f136336d-6991-4b87-8e28-e7fe111fea41	negoziare i diritti di sfruttamento
f120ea97-e94d-46af-a24a-2c3b891c49ae	offrire consulenza ai clienti sui materiali da costruzione
f1381511-84b1-4686-8079-2ea6b3a1b39f	bulgaro
f13de3b5-1cf9-4253-90a7-7ac99c4f7122	comportamento animale
f13dab72-cc68-42b4-9ceb-5883761651d1	mantenere gli standard di igiene personale durante le attività di pulizia
f148d623-7189-4d2d-9f1a-1eb12cf26b93	condurre rilievi sottomarini
f143ec2e-a9b2-462b-8510-0db9a7ceeebb	dare consigli sugli accoppiamenti tra alimenti e vino
f1538035-6958-42b8-9ab8-186c7a439756	regolamentazione delle licenze
f1572cce-bf00-4ae6-8e58-93632aae0daa	ricevere i pazienti rinviati affetti da patologie oculari
f150f50b-23ca-4059-aed4-be7dee7a3ee2	consigliare i clienti sulla conservazione dei prodotti di panetteria
f16d14c7-790b-4a4b-a0f4-3175f5b39231	sviluppare le idee progettuali in modo cooperativo
f183894a-697b-4f48-995a-fd96d3a5c9b3	vendere i prodotti software
f17985ce-c3ce-409e-99f3-0df68d178388	sviluppare le soluzioni a questioni di informazione
f18189c5-9dde-42ca-8d8f-1eacf8b6be34	gestire la qualità
f184ee75-bb32-41c9-9cec-e11b8196a7d4	scrivere in bosniaco
f1887968-be19-4506-a129-50831c78912c	sviluppare le strategie di allevamento in acquacoltura
f18589d2-2c35-476d-b6ef-b10eb35820b4	assistere gli utenti di sistemi TIC
f195307e-4d35-4e08-9b62-dcbf58d969e1	controllare le malattie del bestiame
f1916869-0c69-4109-8f58-f9666d4d9f64	aggiustare gli indicatori di temperatura
f199d298-c94d-49d1-a0df-6446adb9d5c7	condurre l’analisi fisico-chimica dei materiali ad uso alimentare
f19aa322-d09c-4086-9a30-8de9b2c2aff7	trasportare il pesce
f1aed3bd-e9d6-4a27-97c6-b94bd456a42d	geocronologia
f1af3d2b-c757-4fc6-8e72-be8a1eae74b5	teoria della probabilità
f1b0bf88-34af-4f9f-9eb9-cf6108c53992	svolgere le attività di pulizia in modo rispettoso dell’ambiente
f1b2d2ab-c302-4890-846c-f4b69d6cc003	varietà di prodotti botanici
f1b3bbb7-113c-4db9-b0ba-250812831ada	parti di un tornio
f1b1d9d5-ca1e-41d6-a184-3c238196ca72	sviluppare procedure di collaudo ottico
f1b5600b-b329-40ad-be13-f7561c86b1a8	piegare le doghe
f1c5f871-df7b-4ef5-8661-83ae192dd109	piegare fili metallici
f1c1403a-5498-410a-9bef-a7dd24e17fd6	preparare le attività di audit
f1ca4ddf-dc33-4e3f-8c20-f9ca5e86aef6	Portoghese
f1d59035-7b6d-4228-a22b-a828fa83da3c	azionare le attrezzature per la produzione di esplosivi
f1ddd4a8-2504-49dc-9506-7964c4b230b6	eseguire gli esami oculari completi
f1ca1496-704a-4e30-899f-f0f6863ae039	predisporre documenti sulla costruzione
f1e7e0cc-a751-446b-8f5c-707924a35b92	norme sui prodotti di origine animale
f1d90a54-f546-4fba-8cd7-4cd5014dc571	analizzare le miscele granulari
f1eb2c20-0937-4c23-95ee-aa8f049ef3ab	sostenere la gestione delle materie prime
f201f207-83ea-4408-bf97-2fc373050f78	rimuovere la stearina dai grassi
f1f75192-5e40-4afa-ae19-cfc10b272089	controllare la documentazione commerciale
f1fca7c1-bb0d-4f8b-8ef4-c210222506e9	effettuare le ispezioni subacquee dei ponti
f203d0d4-87f2-4357-a765-da5cea68c963	raccogliere campioni
f2064011-bea9-402d-8f39-7cf01689d68c	individuare le esigenze degli artisti
f2090f7c-2e66-428f-a0ca-ecc8383acf5f	promuovere la parità nelle attività sportive
f21060e5-fed0-4478-be7b-9b3e676ea089	supervisionare la presentazione dei veicoli in concessionaria
f210edcb-c50f-429b-823c-09e802c99dbb	sviluppare i piani di efficienza per le operazioni logistiche
f21490d2-6575-45a6-9c29-a7a7ebe31039	cooperare per risolvere questioni di informazione
f216193b-4122-4ab9-8f33-8db0aea60dff	delegare le cure di emergenza
f20a958b-c99e-47a8-81be-a05dcb4d0ca7	usare software per la conservazione dei dati
f2170602-b266-4889-99cc-e88ca30bd814	processi di birrificazione
f222a90b-a076-4729-b23e-611940d10138	valutare la fattibilità finanziaria
f2283fc9-280e-4680-a102-b01bcafe3751	prescrivere i trattamenti connessi alle procedure chirurgiche
f22ee4c0-6e12-4411-b45d-f8ae559d1fed	fabbricare tappeti
f22f3aa6-94d0-4dcc-b0b4-ab36eb539da7	lucidare i parabrezza
f2326a4e-6745-4204-bed4-c408b617b010	eventi sportivi
f246dd88-dc88-45e3-83f2-cab8473fd6a5	utilizzare la pialla a spessore
f23b28c0-6d7d-4e16-8d6b-0f5a3a8d6a37	contrattare i prezzi
f23b5d81-c7e4-47cd-baa2-2d9bcee80307	riparare le attrezzature per le gru
f0bbcb54-2a86-48ab-8f26-b9ae51f0ae16	eseguire la fecondazione
f24ca513-ea0a-4846-be08-082c0b0a9267	eseguire le tracce nelle pareti
f25083cd-560f-425d-bb2f-aeea05f6afcf	presentare domande di impiego o formazione
f254618d-ad02-4092-8ce9-44608126105a	ispezionare il corpo del velivolo
f267899b-874b-4567-aadc-1ea49763020e	acquistare nuovi articoli per la biblioteca
f25f4c80-431e-4a8f-8880-2efa43e6ab66	OpenEdge Database
f2616e6e-6454-4e3c-b955-81e8ec5871ca	refrigeranti
f25dee19-3764-45e6-8d5b-2a6a941d029f	preparare l’ambiente di lavoro personale
f26e60db-45b7-40b3-9abc-c5069b5d334a	fissare le lamiere
f26eacf5-ab65-4db8-8da5-73ca5b6ac0f6	supervisionare lo scarico delle merci
f26b96e0-0ae9-4cbc-808d-bd304fc57f95	lavorare con i servizi elettronici a disposizione dei clienti
f271a5ff-1974-45dd-bba6-9c06a6ead523	riscrivere un manoscritto
f2759c9a-73f4-4ef4-af14-53b7a8a63881	calcolare le dimensioni delle parti
f28ad3a7-9061-458a-8cf9-31f6e4c41677	utilizzare il software di stampa
f27fb9ea-4ce5-46e1-b172-e09d03b4b365	questioni difficili nel settore tessile
f28c90e4-ee1c-48c2-ac15-8f81a8d1dc9a	fornire assistenza al chirurgo veterinario come strumentista
f293a305-9fff-4103-bbae-df7645298e8a	garantire l’accreditamento legale per le operazioni dei vettori
f2971cb5-6203-417c-90eb-c8a5b7017414	progettare componenti di automazione
f298ca85-c9f4-432e-aaaa-2f81cd9c43e4	dirigere i subappaltatori aeroportuali
f2a1dd10-270d-4587-b3c4-3864df80a93f	nutrizione degli animali
f2aad1cf-ccaf-4c14-9067-9e8eef516be4	ideare un piano di comunicazione online del marchio
f2b8eb92-4651-4f40-b3f2-ea50ec9120d2	individuare le problematiche emergenti nel settore umanitario
f2b9dbf3-c300-4e19-874d-02c5176d7bae	trasferire i laterizi
f2ba8752-9e11-4ddb-bcf7-4567f65542e0	offrire consigli cosmetici
f2c4dd48-b13d-4a23-8663-5e871f4c3f79	varietà di uva
f2c53da8-3fab-4d09-a27c-8fef17170b69	aggiungere colore
f2d7495f-c200-47e9-bbc9-9d8b8cc3baa9	gestire la salute e il benessere del bestiame
f2d8ba3d-465c-4b63-b117-dcb86d335a0c	osservare la materia
f2d9cb11-cd5b-486a-affd-e640226adb65	garantire che veicoli siano dotati di sistemi di sicurezza
f2e51828-dc7f-43ab-b616-4b6a161bf736	sviluppare i programmi di sicurezza alimentare
f2e6b61f-7cf8-49f9-856b-5118870c7a82	gestire le finanze del gioco d’azzardo
f2e6e8d1-ef74-41f0-b521-77656370e0b4	partecipanti al mercato
f2e719b9-6b17-4775-ac72-900d249197e4	utilizzare la pressa per pannelli di legno
f2e9afac-62c8-4fd3-928e-363dc000f1db	cura del prato
f2eb3dac-1993-4b39-bd5c-bbb8d9dbc821	trasformazione energetica
f2f04a10-6565-4539-a9d2-e06548bdfcc0	vendere le calzature e la pelletteria
f2f19c9c-258a-454e-aaec-3b0f267c296b	supervisionare la sicurezza dei lavoratori
f2f687ae-dc90-48ad-b496-c5be01221883	guidare auto automatiche
f2149cc1-abae-4089-b0ab-31a4404918de	utilizzare le tecniche tradizionali per il taglio della pietra
f2f9b3a7-5f7f-4fba-b7d7-53a4321b374f	gestire i farmaci dei pazienti
f301f7f3-42ee-4b4e-946e-0f306b0be765	comunicare l’esito dell’esplosione
f3055eb5-ee07-4871-8730-ae4a37a52d9b	accettare le ordinazioni del servizio in camera
f30bf3e7-2a8a-4bb5-ad26-ca76c1805246	assemblare tessuti di grandi dimensioni per esterni
f30913a3-87e6-42d0-931d-4540741473cd	gestire i cambiamenti dei sistemi TIC
f3184795-cb4c-4938-9479-c632cb44d87c	rispettare la terapia ittica
f31e9ee1-0b1b-4149-a269-3aa726667788	assistere alle prove
f3275e86-d4cf-46a3-a5ac-a23f5c109240	installare luci
f28b1d22-43f9-4403-88a5-21c421b4a93d	ricevere i curriculum degli attori
f32a81d5-7e29-44a4-8355-0bad2bcef463	gestione del rischio
f3271a47-23a3-4e8f-8691-43512a758685	creare soluzioni a problemi
f28d435d-9171-4268-9900-50599c39c862	offrire consulenza sulle caratteristiche dei veicoli
f32aba7a-bf29-431f-9a33-788a7f3989b1	processi di lavorazione del legno
f32c097a-00fa-47e5-a65b-a263d6c8db69	ideare gli schemi paesaggistici
f3310ce4-c453-40e6-ae2f-b85488a25b29	trascrivere i dati medici
f2998b6e-2684-40b4-9e86-88ccbe90e8b4	tipi di punte di trapano
f336f838-c80a-43f7-bd7b-bb092e79feb7	gestire un trauma utilizzando mezzi chirurgici
f32c39a1-0aa7-4f41-b89a-94f8569753cc	utilizzare la documentazione tecnica
f3372e04-61ce-4d6d-86e8-ef3c76077cde	tecnologie dell’energia rinnovabile
f3386782-aafd-43e0-a142-dc9f3cc46553	creare acconciature
f33bf662-880f-44ed-811a-fd653a69477b	risorse alimentari naturali
f345db85-9b67-4308-bf3b-8ee5a22a786a	utilizzare una pistola a spruzzo anticorrosiva
f349bbab-c426-41db-9dab-db20fb9648b7	norme in materia di igiene degli alimenti per animali
f352e015-0369-44ee-a71b-36c9374d80ce	produrre componenti per chitarra
f349adc3-db81-412f-bbc9-c141e852890b	utilizzare le analisi termiche
f35e6fdb-73fc-4167-8136-ee1f9afe6380	procedure penitenziarie
f35fb07f-f144-4640-901d-c5ec2c4147d3	gestire l’illuminazione di uno spettacolo
f36ab645-62ff-4583-b1ae-33606d1aa7da	monitorare il processo di pelatura delle mandorle
f36e3b27-ad05-45d3-af2d-9796539dd878	scrivere in bielorusso
f37409c8-3b69-4d01-abc0-c1200140de56	testare le pale delle turbine eoliche
f383de9d-893f-4179-b314-72c69d01125a	formulare diete di alimenti per animali
f3516b86-1b35-469f-b780-48bbc7562120	educare alla riservatezza dei dati
f38806fd-0ff5-4e5f-b89f-ae6b6dfb1735	setole
f2ce8d6e-6d30-4524-95c3-2f0e0f4dc2a9	gestire i test dei prodotti
f377aa22-77b9-4367-9d8d-d8dcde530b63	eseguire il controllo della saldatura
f388977f-567d-4623-a58e-a5672883c2f3	sviluppare procedure di taratura
f3893ba6-e159-4480-8018-6f4585f64f87	essere addetto a macchine di anodizzazione
f38f81fc-f5f7-4145-ad92-5b6fe526d913	funzionamento delle centrali elettriche a combustibili fossili
f39787f2-eae2-45f6-ad05-4c73d6ed75a9	selezionare i nuovi articoli da acquisire per la biblioteca
f397a627-4091-4dcd-96a2-f5252f7b269a	utilizzare la fresatrice per legno
f398baae-c9a9-42ae-8894-3382ad5d8301	restare aggiornati sulle tendenze dei pasti consumati fuori casa
f39eb937-997c-4e0b-a5f6-6c06308b5a41	Fitoterapia
f3a6ac9d-7a09-4b7e-a03b-05177a9e8eb7	elaborare i pagamenti
f3c55899-6f0f-41f3-96a8-2a95e16853ad	coordinare il rinnovamento della struttura alberghiera
f3a40c98-1c3c-4bb4-967c-5da40c0c34bd	applicare le strategie di insegnamento di Montessori
f3b8c9d6-81bc-4406-a60b-8c327be310d8	seguire il codice etico del gioco d’azzardo
f3bdbcb3-3bef-470b-af4f-e6c966263067	gestire l’architettura dei dati TIC
f3c912b9-6f27-4a81-9818-1208e1721628	condurre ricerca scientifica in osservatorio
f3ccc1e9-fc83-4eb9-b3db-213d8983f2e5	requisiti di sicurezza della rampa
f3e6bc9a-7f07-4d6c-b575-f37646adb4c4	tenersi aggiornati sulle novità librarie
f3e4e0f9-3b42-4421-8a33-7583f557a046	biotecnologia
f3d6886b-468d-4cee-9eda-5bb21b522335	puntare a una produzione alimentare improntata al miglioramento nutrizionale
f3d38946-0744-4b99-8037-a0b3810b452e	pulire il magazzino
f3e9f408-129e-4ee0-80eb-e0f2b029f354	valutare la documentazione relativa agli ingredienti trasmessa dai fornitori
f3f2e08b-3981-4610-ac8c-7f4ac056ce00	individuare fossili
f3f06ddb-f9a8-47de-adcf-c8c58488aa80	organizzare le informazioni
f3efcc7b-dcd5-485a-ad7f-e083a076f6f2	misurare i fogli di carta
f3f84b34-dfd7-445d-acf0-d284ac3b46f0	valutare i rischi del fornitore
f3fb1ca5-3dc1-476c-990d-54ff3771dc9b	gestire l’uso dei vaccini
f408b1e4-5707-4c9f-97c3-0701fd0509a8	analizzare i fattori interni delle imprese
f415c416-cc4a-45b0-98e2-e65f1ae9a2ad	misurare i parametri di qualità dell’acqua
f426c7d2-0460-4067-84a0-edd9d85ff2db	provvedere alla manutenzione delle scale mobili
f4164fea-ad02-457c-a58a-600e72be1fe6	effettuare la manutenzione degli impianti fotovoltaici
f4130c78-81f2-4f4d-b0c5-e53b811346b3	controllare la qualità delle trasmissioni
f4227384-03e5-49ca-9df4-ac8da9914602	utilizzare gli strumenti di rifilatura dello zoccolo
f435126a-41a8-44de-8a57-2bddbae986e4	assistere il cliente
f43181e3-9998-4040-8591-8f1a83d672b3	riscuotere le imposte
f4408987-bf30-4c29-aea1-be983869f4fa	insegnare antropologia
f44d7142-adac-4003-8367-06c41773e0bb	installare le scossaline per finestre
f47e9a38-f16a-4ede-adfe-61e0d926c2bb	promuovere la pubblicità di un evento
f4841ecf-64e0-410e-9beb-3c7f87ed131b	celebrare le funzioni religiose in chiesa
f443a3ed-aead-48b3-9bf5-b5a2500b649c	ispezionare i materiali da costruzione
f4857a30-eba9-45fe-8d21-8f5c1b522e5d	tecnologia per l’automazione
f48e225b-7d0c-40fd-b79b-298e08e50987	coreano
f48eb517-a74d-41c9-8398-9f90ead3d524	essere addetto alle sgranatrici di mandorle
f491910e-0116-4559-8e05-a8f4636ffb81	applicare la politica di rischio del credito
f496dc2b-5785-4a21-93c7-cf56ce3d7f12	registrare il tempo di lavorazione dei gioielli
f49c47f3-2396-479d-9862-b32f86ae9976	eseguire le procedure di depurazione dei crostacei
f4a85691-dfab-4b96-8ea4-e43991c8518a	creare i progetti per l’ingegneria di gasdotti e oleodotti
f4b4df91-4877-4154-9ace-fd7f365f7a4b	DB2
f4b0826b-64fe-46fc-b5a5-48cedb17cdc5	offrire consulenza sui metodi di apprendimento
f4b71e70-1169-4076-baef-5b2e72757336	impostare profili di colore
f4b59de7-d121-45e2-ae42-bfd1d3d9d60a	componenti del motore
f4c7f9d8-f694-453f-81b1-cf5a65d4d1dd	studi sulla comunicazione
f4ce0924-ff3b-47bd-abc1-7c720f7a91d4	garantire la conformità alle norme in materia di inquinamento acustico
f4b97378-a327-47c0-ba8c-998fb77bc382	registrare i dati dei test biomedici
f4d4c8c3-2e8b-4bb8-80ae-b2bef6c4ceb6	riferire le notizie in diretta online
f4da7da5-7ecf-4c5a-b5f0-4bfd53a46362	effettuare la manutenzione dell’azienda agricola
f4e3a4c3-7b31-43c8-8fbc-c25b21840783	sviluppare alimenti preparati per animali
f4e3f6a0-1409-47ab-9c95-8bc4b8099ed9	posare il cordolo del marciapiede
f4eb970e-d24f-4d39-ab99-605a1f48e698	gestire la prevenzione dei furti
f4efb53d-09ba-4055-a2f7-67fbe1366aad	trattamento psicologico clinico
f4f2b979-5fdf-4ed0-8ea8-c612c890e2f2	pianificare le capacità TIC
f4f3a830-8ace-40b1-bd2d-a85c87d6fa72	addestrare i cavalli
f4f90d3b-ca93-433e-b50d-e3b92556e83f	ispezionare l’attrezzatura pesante per l’attività estrattiva sotterranea
f42fd822-06b6-4409-b895-ba57d3b6e7c5	analizzare gli incidenti in miniera
f43d2f39-25b6-4d92-8e86-376bf3c35605	indossare indumenti da camera bianca
f5093db8-dc90-4a6c-bd25-fc2de52f6c55	affrontare le condizioni di lavoro difficili
f509f497-f853-4e70-b1c8-524ec03400eb	integrare nuovi prodotti in produzione
f4844bc9-a1bf-4dcd-8ffe-7a96cafd6824	diagnosticare i problemi dell’apparato visivo
f50c57cc-28b7-462a-81aa-23807430a305	azionare gli impianti a propulsione diesel
f50eb55f-eb34-4d3e-ba08-7fff1aab5433	valutare l’assistenza infermieristica specializzata
f5138864-35ce-43d5-8982-d21a5e7af7e1	rettificare gli alcolici
f50cde76-0faa-432f-81f9-11b5ba468a76	OWASP ZAP
f513ec84-f9c7-4dc5-b959-d83993ada3aa	fornire istruzioni terapeutiche
f5143e63-2b13-472d-8319-d49062c3dff5	effettuare i conteggi di fine giornata
f517656d-9508-4cb1-ba0d-c5c2f8d9b912	analizzare il testo prima della traduzione
f519d5ee-0924-47e7-8d90-c98bb8e62d82	comportarsi in modo paziente
f520890f-3173-4ab3-afd1-a1321f64676c	insegnare metodi di comunicazione interculturale
f4d21244-836a-462f-8777-ba4b7392b86f	gestire gli arretrati
f51e920c-3cee-4ed8-988b-cf6c6afda783	installare le attrezzature portatili per riprese in esterni
f52226ca-5238-4270-b3aa-5e719b8900ba	promuovere le attività sportive nel contesto della salute pubblica
f52169f6-b9eb-42be-98e8-0980c2bdb354	utilizzare i movimentatori telescopici
f5309124-5280-4176-907a-141603d60166	fornire un’assistenza farmaceutica specialistica
f53826dd-b127-466c-b3e9-a447c47476ad	eseguire una visita ginecologica
f5318b3d-6e6b-4442-974d-e317f8e55bcf	coinvolgere gli ospiti nelle attività di intrattenimento
f5399a49-a1b4-4c45-a9f3-13a171bc75e6	controllare le strutture di sostegno circensi prima dello spettacolo
f53b4a05-08f1-426c-9b25-8b68f2c50dea	monitorare le infrastrutture
f53cea17-10a0-4999-8e1c-b85b65604929	misurare l’usabilità dei software
f53d0c31-e7f2-4045-ba27-f193c76d81ba	insegnare informatica
f544f087-e64b-4983-9e36-833bf7089a4d	sincronizzare l’audio con le immagini
f54050f3-9772-487e-878b-57fcfab089d6	intervenire con azioni sul palco
f54e2992-d4b5-47a9-8857-baa077e3244d	tecniche di elaborazione fotografica
f54e54d9-4f66-4735-ba0b-b40e63ca723b	imprimere motivi o codici sui prodotti refrattari
f55940be-6f3a-4f09-83a8-d1307a215710	pianificare l’approvvigionamento di apparecchiature meteorologiche
f55e9ef2-f9c4-4303-91ea-484e7ac1b47f	gestire le aspettative dei partecipanti
f55f1002-5ea3-4459-92e7-ab145437cd19	selezionare i metalli per i gioielli
f4f9477b-9594-41d9-ba4e-7d12b1ac88ec	immergersi con attrezzatura subacquea
f573d2f1-2fe0-4d54-b98d-4afe23cf9367	definire gli stadi di luminosità con luci automatiche
f575f7b3-418e-46b5-a3c4-07d8b93ec521	utilizzare strumenti per creare mosaici
f5781951-f276-4cfd-97d5-1476f2ba0d2c	riproduzione mediante acquacoltura
f5845b04-e1bd-463c-91ed-7bca30388423	preparare le pareti per la carta da parati
f579e704-e4a0-425b-b46e-bdb47bccade7	ricercare le tendenze nella scultura
f589e814-9262-4792-b740-503393f4cd88	coordinare la vendita di selvaggina
f591e82b-55bc-4029-9407-66c946b0e929	seguire le procedure di sicurezza aeroportuali
f5931d10-f1cf-44ef-9499-7e278f2b7af1	metrologia
f51192c6-b96d-4850-a75b-3d5f58ec71ca	standard di sicurezza alimentare
f5a2dbad-ddc7-415c-be18-5a451d89bfd6	installare le attrezzature da ufficio
f5b2d237-edfa-493a-8a11-6a08ce9e9470	condurre prove sul modello
f5b70d94-679b-4c79-a9b4-b3e69fe0e96c	progettare un’abitazione
f469c6a0-8a97-4f35-aeef-31c20b19d043	insegnare i principi del lavoro sociale
f5c5a35f-13cb-43a1-806d-7a88137776f1	gestire la costruzione delle strutture di produzione dei farmaci
f5c7af62-785b-4bc8-97ab-9f9431ef28f7	varietà di foglie di tabacco
f5bcd4e4-96da-44e2-98f5-62bbddf8255e	usare software per la riproduzione audio
f5d8ec80-3fe9-4b6e-9105-f8f60ddd8d74	normative sulla somministrazione di farmaci
f5dd6bc2-23b4-4954-ad43-b399bd2e08d1	far rispettare le regole del parco
f5d77b23-f1ab-4de0-bb0c-4ff3d7112b00	montare il set di prova
f5efd3f1-eb99-439c-ad32-488a4b311d34	gestire dati quantitativi
f5f3b9a1-e450-493e-a242-fa54c6f8f927	occuparsi della scrittura di contenuti
f5ecf793-531d-42f8-a946-6661ad14753b	applicare fili sul pannello di controllo
f5f52b41-3468-4aa7-b730-c0b9fdfa202a	gestire i processi di distribuzione e installazione dei sistemi TIC
f60744b8-db24-480a-a965-0a3335438c60	comprendere l’islandese scritto
f6128454-4f4b-44ab-9a92-a3d33eada617	componenti del sistema di riscaldamento, ventilazione, condizionamento e refrigerazione
f612e076-ab5d-4e01-a12d-7aaebc22ec17	tagliare il vetro
f6150143-7db7-43cc-9223-44f28004d186	analizzare le previsioni meteorologiche
f61b000c-64ca-4e8d-8d56-f6fa8f131a37	realizzare un’opera di drenaggio
f62497bc-b6fa-498c-b86c-862271a16c26	traduzione non visionata
f62da121-9d76-467a-8590-1cfd94ce1a17	ricercare la propria comunità di destinazione
f6280fdb-233c-4edb-9675-5c9268bcc06b	riparare le macchine rotanti
f62e4b26-910f-406f-94fc-bfebf6d0e95f	forgiatura a caldo
f62e32b8-1625-4ab1-b83f-972d548c2f32	ABAP
f6350a1a-b221-47bf-b64a-6e05a6e58228	gestire l’allevamento di ovini
f539045f-78ea-41db-8775-b03d6712961d	consigliare i vini
f63a3c0b-417a-42ed-8b31-64235f0e81b9	modellare il set
f64152d0-1bb6-453f-819a-2eb2ea4efa03	tendenze della moda
f64b31ab-c899-46b0-b23c-b74491b8ac32	decidere la quantità di esplosivi necessaria
f6516da3-c39e-4e34-89bc-11eb755aba62	comprendere l’ungherese parlato
f659c9f6-cff9-42e0-852c-94932cd9a470	ideare i sistemi nebulizzatori
f55d6b76-b3f8-48bd-874b-899aa579654f	eseguire l’analisi di sistema
f6653031-74bc-4531-a7f7-fb95393ccc6f	storia dello sport
f660c88c-1d5e-4bc5-8a8a-7f7b68222ce0	valutare l’impatto ambientale sulle acque di falda
f671969b-69c4-43c0-a0f5-8ae32a33ddb1	interagire verbalmente in gallese
f67d07e7-acbc-4d2e-ad87-f8eb49231308	applicare tecniche diverse di sollevamento
f67ddaab-a3f6-422d-b5c6-83d36075a8b5	evitare lo strappo delle fibre durante la lavorazione del legno
f6803d73-9802-459c-8e82-3eca810976d5	motivare i clienti ad allenarsi
f6824708-e3f2-4d53-b2b6-45ed39ab12ed	tecnologia di realizzazione di tessuti tufted
f6829a24-8418-4a47-86ec-326dfb97f4e1	gestire le domande di prestito
f594fc3e-3f08-4d79-90dd-a4b812cc00a3	supervisionare le organizzazioni religiose
f68540ba-463a-4777-b5b5-afd8fb0623a3	sviluppare materiali formativi per la fabbricazione di sostanze biochimiche
f6866196-a393-40ad-8e80-08e7304e8c3b	termoidraulica
f686e45a-90eb-4cc4-bffa-9e14d403aa36	sociologia dei media
f68a0754-4b7f-48d0-868f-4c7aa40e0fa0	controllare il flusso di materia utilizzata nel trattamento degli oli
f68b1c7b-33ed-4fba-94a2-ce7cccabb892	applicare le norme relative alla vendita di tabacco ai minori
f68f1d5d-9e7a-4255-890c-e4d16e804a7e	interagire con il consiglio di amministrazione
f69876c1-0e9e-4458-88a4-d2ac8ae536e2	politiche commerciali
f6a1b043-fe75-4e16-9e13-dfddc82d6f72	fornire un collegamento all’alimentazione da barre collettrici
f698cab6-5c9e-4420-a765-8402012d855b	installare parabrezza
f6ab4eb5-0ec6-4154-806e-ab6c6f474d4c	effettuare una valutazione del rischio genetico
f6acff51-0648-4dc7-9213-3a2f16ac3b4c	veicoli per il trasporto degli animali
f6b1637a-dac2-45e7-af06-69626b2d9fb0	utilizzare filtri per disidratare l’amido
f6b0b28b-d8e2-4653-afac-05b6bdd8f364	lavorare nell’ambito di squadre di produzione tessile
f6231d72-94e2-453d-9ba5-d92f09349fa1	tagliare il pezzo in lavorazione formato sottovuoto
f6c735cf-4f1d-4032-a29d-76dac05e8ce8	bielorusso
f6d380fa-5528-476d-82b1-d19c274ad408	tossicità alimentare
f6d1db0e-6e2d-4872-b0f5-71fc1746c42a	garantire la qualità visiva del set
f6d99260-e6da-4eeb-91c1-574af0986cf5	rispettare le normative sulla sicurezza elettrica
f6e97595-bb65-4990-b6bd-f36e12555539	ispezionare le caratteristiche della miscela
f6e37413-a570-4138-a85b-02c09efe01e1	sviluppare linee di produzione
f6c11020-6aa8-48d4-ba92-9d90fb91a7db	utilizzare i metodi di analisi dei dati logistici
f6f3a716-61f3-4173-a1ef-9b009811948f	linguistica computazionale
f701cd3c-6541-454b-833e-4ad5427177c8	organizzare gli spazi per lo spettacolo
f70f2924-ae63-4be5-bc57-cd96e9b97c37	utilizzare la tranciatrice per lamiere
f6f6bb05-df69-4340-a2a2-9b05bf8c64fc	contribuire a servizi di fisioterapia di qualità
f7273b4a-17ba-4538-bb4e-1126331676ac	prodotti lattiero-caseari
f713b1e3-490b-406c-905e-e7012bc42a4c	preparare un inventario dei beni
f65886d1-b137-4d76-a8ae-af8387eb2d8b	accompagnare le persone
f7328653-98bf-43e5-ad98-0c8a9411ffa0	comprendere il portoghese scritto
f728ba4b-49b0-493b-b4ae-512227bcf946	riconoscere le anomalie citologiche
f7384429-36fd-4c6b-b7a1-32441fe62652	migliorare la fruibilità da parte dell’utente
f7336a1f-d61d-425a-99b1-121a9a4d528e	condurre rilievi topografici
f73dcc8f-4540-49f4-ae18-a58c0fc2ffce	preparare le domande di finanziamento statale
f73deaff-1044-4123-ac0e-9755d1e65790	comporre musica
f742e493-51ef-4109-a9ff-2aa01a552dee	offrire consulenza sull’addestramento degli animali d’affezione
f7547af0-586a-4011-820c-ad0792085465	fare da mentore alle persone
f77b46b9-0500-4dbd-b71a-4f814bc7f380	impedire il taccheggio
f754229f-55eb-453f-9844-e416310f2fb1	progettare mappe personalizzate
f785a203-0d80-4997-8a58-661e82c2e3c4	insegnare odontoiatria
f77b93e9-b17f-4b9a-93aa-19770a6d4e60	posizionare etichette per dischi
f7885b21-340f-4ab0-a93d-67e0eb0919bd	ricercare gli ordigni esplosivi
f77ee9b1-a975-4bc7-a268-775206e673bf	gestire dati per questioni legali
f758118a-d83e-4fec-bac2-caf791a756d8	fornire informazioni sui farmaci
f78b9c03-9164-4436-89bd-943b7289fb88	tingere i tessuti
f79460f7-e799-4fd2-9aa2-1f0faf8061fb	promuovere la galleria d’arte
f78deb43-c735-4f60-8bb0-8d862e6dfd09	condurre indagini ecologiche
f667691c-6ebd-4676-919c-913b0a6f534f	mantenere funzionali i sistemi di scarico aeroportuali
f79a43ba-1218-4b58-85e6-55732075d734	software di authoring
f7a38449-0043-4e30-a244-9828140ba519	spostare i corpi
f7a1e542-a400-4004-88cb-874ac47190e0	ampliare la presenza regionale in negozio
f7a92ac7-6801-4213-9b7c-3370b093075e	gestione del traffico aereo
f7cdf96f-c5dc-4879-8cd7-0f6830bd3728	regolare le barre raschianti
f7c96eab-8426-4920-ae7f-f5e6cdd9a227	comprendere la terminologia finanziaria
f7c71ff5-e46a-4a39-a5b9-71431f2738de	offrire consulenza sui prodotti a base di legname
f7e773ee-73ae-420b-bbd4-c050ef8788e9	settore degli informatori scientifici
f7e74c64-c5ec-43ef-9204-1387393e235b	fornire istruzioni ai clienti sull’uso delle attrezzature da ufficio
f7fbc884-40c0-4ea8-bd71-1fd47035c2ae	creare l’inventario dei prodotti farmaceutici
f7c11aad-6f9f-46a1-bef2-9f9dba9c99a3	gestire il tempo nelle operazioni di pesca
f7fd490e-a403-43e5-b9c2-5d729e90eb81	imbarcare i passeggeri dell’aeromobile
f7ff2a6c-e709-41ff-ada4-7cac38e25ee6	installare le tubazioni metalliche del gas
f80aa510-efb5-4b9b-a561-bf36caa58c74	strategia di internalizzazione
f80a2dd6-5e41-4922-a025-c9644b81941c	gestire persone difficili
f80bd071-4642-4706-947a-d72f32d75e52	gestire l’orario di servizio del treno
f80e7660-c26f-49f2-99d9-afe09e124922	condurre uno studio approfondito dei vini di tutto il mondo
f80ec91a-47a7-447d-ad31-ed0ae95acd6e	eseguire l’analisi chimica dell’acqua
f80f74d0-335c-45b2-8e23-77a181c30120	riparare dispositivi medici
f8120cde-a5aa-4d1a-80c0-347692eedc8e	psicanalisi
f814564b-c863-4991-8d34-f3d622ed9d18	riesaminare le procedure di chiusura
f81c8f6a-2e93-493a-ac32-cbb5779488d8	conformarsi alle norme sull’esportazione in paesi diversi
f82ce2f2-2807-4f47-bc02-bcb5ac08131f	creazione della cartella clinica dentale
f830e539-1174-49f6-9849-f39efa98d9ff	stimare i costi di ripristino
f83271cd-f2d5-45db-a037-895b8803afa6	testare la purezza del gas
f835d26d-035b-4429-acc5-c365c8e6c2e0	obesità
f7868abc-4b33-4084-ab5e-c82f98b766dd	realizzare il kit di stampa per i media
f78a3b18-fdcd-48f6-9e04-149a89dedc38	macchine fotografiche
f8458047-7db8-4f3b-a79c-934e61395e40	calcolare l’esposizione alle radiazioni
f840ddd9-2391-4d9b-a543-ddfa937a07d1	mantenere le attrezzature di magazzino
f8487319-1c92-4553-b1ef-44b14a844006	rappresentare i membri del sindacato
f84fa823-45df-4c7c-815c-52dfcef273b9	utilizzare i macchinari per dare forma a diversi materiali
f8505709-257a-45eb-ae65-68c432b7210a	produrre dispositivi medici
f85dbfe4-2848-4cef-a996-cec0a9f2a392	letteratura della musica
f7fd3ef0-248a-4c37-bd2d-a51d6fea18c1	diritto farmaceutico
f861bf58-c191-4f0b-91e2-75ae41e9a454	impiegare le tecniche di trattamento cognitivo-comportamentale
f8651c09-9efd-4774-9614-079b20dba39c	azionare la calandra
f8709b2c-3e38-4d22-9a1a-bfbb93966e37	promuovere le attività ricreative
f8713dcd-48cc-4a69-8124-071da9cd338c	principi di insegnamento Freinet
f8748eb4-3639-45d2-ac50-c4608c99e0a2	filtrare il vino
f80ca7f0-252b-4ca2-ab3f-f5134efa2ac1	comprendere lo slovacco parlato
f879682c-0a16-4f2c-bdeb-f3370f2a4b4c	sostenere lo sport nei mezzi di comunicazione
f879c2f7-078f-4b8c-8b7d-7a3094e524da	ferramenta, prodotti per l’idraulica e gli impianti di riscaldamento
f879e37d-2059-4ca4-b1d6-3a3e3f1e317d	concludere una vendita all’asta
f87c72a9-7b5f-4eb9-bdcd-11d05b0bde3f	prodotti finanziari
f8872776-4989-43f4-9523-33c03226c357	sviluppare metodi estrattivi alternativi
f88198f2-efbf-4541-8d34-ea0bc9e0b4e0	promuovere eventi presso il sito culturale
f894bf81-07d2-40a1-9519-55f0f9883d2e	gestire sistemi di introduzione del malto
f8980d38-71b9-429c-9c7d-76f595e2a680	tostatura del caffè
f89ad652-9b1a-4119-8458-fffb34111251	utilizzare un impianto di lavaggio
f8114fdd-1be3-46d6-a0e0-05169c253cf0	offrire consulenza sugli incontri in linea
f89ee68d-8180-4078-b8dd-64fa8d403667	verniciare gli pneumatici
f8a89f4b-037c-46fe-bf0a-ff790d0b7adb	tecnologia di trasmissione
f8a985ec-8edd-4c5e-a1c7-526b7bc78c19	raccogliere le misure degli artisti
f8aa84b8-b917-4f3c-bd8b-3915639b9e98	rimuovere parti di pesce
f8aa396d-bf46-4578-b05d-c31193c7937b	ispezionare i ponteggi
f8ace923-42b4-4d42-bc0e-08768668b7df	effettuare la manutenzione dei sistemi di controllo delle attrezzature automatizzate
f8b4040e-7fef-41e4-b1cb-5d657ca79a01	pianificare la spedizione dei prodotti
f8b41316-42be-46a7-b121-a8a125cce2df	terapia nell’assistenza sanitaria
f8bd1648-fa90-494a-8b92-5837afac819c	mantenere la sicurezza delle macchine
f8c01a86-17c5-43bf-803c-ce2bde406e41	vendere i libri accademici
f8c07ee0-4c94-442a-af27-398852f2ec46	anatomia degli animali
f8c6608b-ee91-4f5c-8d42-f17f9467dce5	sviluppare apparecchiature di misurazione
f8c27d66-e3b6-4d1e-9430-ea942e1e56cb	ispezionare le attrezzature di servizio a bordo
f8c7630e-63ff-4f77-a5d6-02b234db6e49	gestire l’allevamento di conigli
f8c848eb-3809-4661-851f-48c57114d1f7	eseguire una broncoscopia
f8c85d3d-713f-41a4-b163-051834d8ab8c	prodotti per la cura delle piante
f8cc1a07-bb70-4aa4-9512-b7e228682595	integrare dati TIC
f838df64-0140-4883-ba86-4b1372f5f1e1	garantire l’orientamento del cliente
f8ced033-e4ba-4197-85fa-7b544a89e534	assemblare parti metalliche
f8d47dc3-0ead-4ef1-9e15-a83cf8b7befa	adattare lo stile di comunicazione al destinatario
f8dede68-e2f8-475e-8004-a534370d1a4e	spiegare la qualità dei rivestimenti
f8d34eaf-c3b6-402b-95d2-e97e6fe079df	dare ai clienti consigli sulla manutenzione dei pavimenti in parquet
f8de3373-b1e6-4ed8-aa33-920a2f773e80	azionare gli apparati a leve ferroviari
f8e1b4a9-eb2e-4e77-9ff3-a12321c4a8a5	effettuare la pulizia dei canali di scolo delle strade
f8fd0407-0f01-41f6-acab-8b70d4cdf490	testare la miscela di nitroglicerina
f8e95012-2524-4a63-b732-7eed7bcf674b	monitorare le prestazioni delle apparecchiature meteorologiche
f8fd0935-7de8-4bbf-830f-38f4bbbfd6bf	utilizzare un sollevatore telescopico
f9002486-aeae-4f00-812c-8fa1b8a28fd9	prestare assistenza al pilota nell’esecuzione dell’atterraggio di emergenza
f908ba37-0cf2-4ee0-a13e-ea2aac61820b	prevenire il furto
f90a374e-d930-49c1-a81f-b2026cd05061	imprenditoria
f9024ee8-a1cc-4a5f-b946-c56b4512dea3	garantire la corretta etichettatura dei prodotti
f9263487-34e4-4a84-adf4-ddb11c7cef14	preparare gli alimenti per lattanti
f923169b-a26a-4b54-bb55-0d61b9eebe80	controllare gli organismi nocivi
f9298bb8-a679-4a55-b156-7f5c62aac491	uso del territorio in ambito aeroportuale
f930a56b-3a50-4292-90f5-b1b9907b7f93	gestire il funzionamento del gioco d’azzardo
f930cdb3-44a3-4a63-a0ba-2f2754b3f34d	rifinire le sezioni in calcestruzzo
f932a03f-629c-464a-b42d-3a2080d6459f	emettere le fatture di vendita
f93fb6ba-4f7a-4a49-8654-b66d8b4ad271	individuare le caratteristiche della musica
f93be68e-21a3-4222-a43d-ada3772882ed	imballare le apparecchiature elettroniche
f9350feb-622f-4053-bedb-bad47da4d288	utilizzare apparecchiature per la trasmissione a distanza
f943741b-b485-4c46-9f2d-0a676cfc83ee	comprendere il vietnamita scritto
f93fca1b-b901-463e-9b4d-a12750b46191	aiutare i bambini a fare i compiti
f94c4644-a3d8-421a-ab69-887b2e088eef	tralicci
f9466809-04cf-4976-918c-a96c8375cc4a	redigere i comunicati stampa
f8505e21-6e9d-4758-b424-75bfaf22c1a2	identificare i punti deboli del sistema TIC
f94b02f9-7735-4baf-a4d8-ab3b18a601eb	collaudare le strategie di sicurezza
f959136b-4a6a-4ff0-b08a-782a4cdc1406	utilizzare internet per aumentare le vendite
f967675e-a405-430c-9e35-3aa88066de79	segnalare le questioni ambientali
f96ee81c-ff78-4be6-8db2-60bfc8c04bd6	fornire informazioni relative a oggetti d’antiquariato
f96a5cce-9bc7-46cc-b346-cee39e4effc1	assicurare la coerenza degli articoli pubblicati
f959fa96-bb63-456c-9c29-2b1f40b6b3bc	interpretare i dati scientifici per valutare la qualità delle acque
f971df54-1059-4f63-8d49-228737a26534	lucidare l’argenteria
f97e3d49-14b8-4d90-bc3c-5055288d8ef8	Applicazione della normativa sulla sicurezza sul lavoro in campo veterinario
f98928bd-1e5d-46ad-b095-b52c2a9d6c32	trattare i disturbi di deglutizione
f9897225-c9ab-4914-8a96-e5c9cc445dac	monitorare le indagini sul campo
f9aba81b-1b72-4525-a46c-63825cc8fce0	eseguire la manutenzione del sistema di telefonia
f99c0e6b-e2de-4f57-af9f-544ab45db3c1	WizIQ
f991f27e-1de8-4d73-bfcf-4ee1d1589fcb	fornire informazioni turistiche
f9b12aae-3449-427d-8c82-b8e950b165f3	modellare sensori
f9ba1841-0563-4570-9928-873c876ae218	stoccare materiali contaminati
f9c32ec7-045e-4e2f-8d1f-036051ef9950	sviluppare le nuove tecniche di diagnostica per immagini
f9c4e3d9-f7b7-4e0d-b48a-5f0729ade6d3	gestire l’allevamento di anatre
f9cc0a55-4910-4452-88c6-0de0d82ba935	creare programmi di miglioramento del suolo e delle piante
f9c095fd-d879-4950-a1ec-6ac6b9543a4b	utilizzare strumenti meteorologici
f8afb808-8f88-4f70-b549-8ffb6736fa09	norme in materia di transazioni commerciali internazionali
f9d17e8c-611a-43c4-93a5-3ec4aadef6d1	preparare i documenti attestanti la conformità
f9d14947-5fff-40f7-b791-6e97dc8c7154	utilizzare la taglierina
f9d55022-cde8-4d33-b74a-d5d5cdb6489c	assistere gli studenti con la loro iscrizione
f8ac39fb-2e99-4128-a336-c26bb4f4143b	gestire la qualità della luce per lo spettacolo
f9d5aa7f-3e72-4172-9785-02fe7a1715a6	comunicare informazioni matematiche
f9de5a46-c570-4223-bc72-6239ae87bc57	migliorare l’erogazione del servizio ferroviario
f9ee1c93-b41d-4434-b732-fa20ab1253e0	anticipare le esigenze logistiche per le operazioni portuali
f9e7410e-b60c-40cd-8ced-cce8a2770226	affiggere i manifesti pubblicitari
f9e96083-4997-44e6-b5d8-11ae2576722a	produzione di articoli per assiemaggio in metallo
f9f5c701-83fe-42d9-bbe7-2fbffe835169	garantire l’attuazione delle pratiche di guida sicura
f9f75bf0-65f4-4f54-8dcb-836ca4725ef5	azionare la livellatrice
fa00da28-8640-421f-8709-422c6c85fd42	prevedere la domanda di prodotti
f9fa2b15-a764-4e4c-9c65-1075ddbb1e24	raccogliere le statistiche sulle cartelle cliniche
fa00dab3-4ee1-4060-9304-f4143e74c753	componenti di apparecchiature elettriche
fa015125-0c6b-49d1-8b53-d52b3787ad1c	preparare i fascicoli riguardanti le indagini relative all’animale
fa04587c-e596-4a60-8501-5cfae3b9edc1	regolare gli impianti cocleari
fa016dfa-ee93-431d-9ff5-eefb4b5441e2	calcolare i costi per il trasferimento degli embrioni animali
fa0e9b97-8334-4a9b-915e-e6561e729bb2	piattaforme di assistenza per sistemi TIC
fa11b570-02e6-401b-80d6-7c4ff7a71dc9	legislazione in materia nucleare
fa0f841c-421d-4dae-b703-6994a6f941c0	valutare le necessità di informazione
fa047ae8-85a3-4bd6-8ea6-69f49575fdbf	posare la moquette
fa1322bb-3924-40ed-b517-13d37c6bed1b	gestione del personale
fa188e15-a8d9-47ad-bf69-a922c51a32c2	finanziamento di progetto ferroviario
fa1a1844-6a0a-4be7-ad7e-ba4d34e048dc	assemblare schede di circuiti stampati
fa19c8fe-3d55-40b8-8a62-291c70a57200	offrire consulenza sui progetti di irrigazione
fa292419-27ea-4766-b771-bb2c63561f0c	costruire la muratura del giardino
fa2aff87-f801-452c-a80f-8e8caf1b47ad	comunicare con il reparto assistenza clienti
fa340a64-d843-47eb-966e-c41a86b71834	smontare e immagazzinare l’attrezzatura per gli spettacoli
fa323d31-2e90-4ba8-849b-2748d0211e9e	pianificare azioni di edilizia pubblica
fa344198-c54b-4ab7-9827-78743cafb7ba	seguire le strategie di scommessa
fa36c900-abe5-4d7d-92f3-2b605c0dc887	strategia di commercializzazione dei contenuti
fa38b51f-176c-48fd-9eac-e1f9a2afec3a	chimica della carta
fa4a3f05-469d-454f-ac0f-4bc539f41df9	sviluppare melodie originali
fa4bb12d-700d-4e48-94a0-b95d35aff4da	gestire i pazienti oncologici acuti
fa48166d-9bb6-4217-afdf-873fa236a5ac	produrre contenuti per brochure turistiche
fa4ce945-1b7b-4927-b76a-90bcb3538891	misurare e analizzare la pressione sanguigna
fa4e8e43-f9a1-44ce-a553-4dd673c1a54c	organizzare progetti per rispondere alle esigenze educative
fa5003c7-b134-4884-a9d6-3dec3278491d	realizzazione di prodotti derivati del tabacco
fa52bace-4aec-40e9-8c4d-93f221efbc29	tenersi aggiornati sull’attualità
fa60bd04-48b4-48d4-8bcb-4a8e37d8edad	gestire i progetti di pesca
fa61aa00-fb39-4282-b906-904706f214b1	consultarsi con le parti interessate sull’attuazione di una produzione
fa66fbcc-1c32-4ad8-a731-52a252291930	dirigere gli operatori addetti alle attrezzature necessarie per l’attività di estrazione
f94cb07e-880a-42e8-aa97-5411b0848c76	individuare i temi di ricerca
fa6df8b0-94bc-4c69-ad96-18f94937eef1	utilizzare attrezzatura per il riscaldamento del metallo
fa73b257-483b-4373-a5e3-eb77fff9cd35	effettuare le videotorascopie
fa782a27-5116-4cf7-9f6e-9f1be45261c4	aggiustare i processi di essiccatura ai prodotti
fa7e3a8e-041b-427c-87e4-8651bade8d00	preparare le materie prime
fa7924b4-d549-4eb7-8f12-fa8c5b8c5692	gestire la distribuzione di materiale turistico promozionale
fa820cbb-5235-46b1-b23e-32cec198b052	interagire verbalmente in svedese
fa838c17-1ca8-4e64-b083-03247654b270	controllare il pezzo in movimento all’interno della macchina
fa848cd2-1099-4147-9846-80e330c1d867	diritto civile
fa9217a9-4e6d-44ea-bd04-82cd19e00843	trasferire gli embrioni animali
fa92af95-fbd6-4133-be65-3b796f8f3ed2	diritto in materia di trasporto aereo
faab2e22-1a2a-4776-98f4-e2b1d890b1fe	far rispettare le norme sul consumo di alcolici
fab11749-5b2b-4782-9e9c-525d61c42f96	tipi di veicolo
fab9426a-8a8f-4f2e-9280-fb904eb8cee3	radioterapia
fab98b41-35a8-457a-a0be-f43a819a9095	preparare i rendiconti d’esercizio
fac26b6c-2b74-4dbc-a24c-ffcdc3675c34	organizzare i servizi a domicilio per i pazienti
fac6633b-baa0-48b0-877d-1b4a2b4893a0	storia degli strumenti musicali
fac89acf-e4b7-4b87-afc1-a5fbde9c0c95	proporre attività per il tempo libero
fac914be-fa5d-47ad-ab7f-8f1e1da3d531	controllare il cantiere
fad0e314-6f5f-4b35-b93d-a603c5b251ae	normativa sulla pubblicità
fad21f51-34c0-415f-8be3-da0dbc1fb15b	tipi di sprinkler
f9f72f29-3bfa-46f5-940a-9e90b7f1e43a	esibirsi in uno spazio pubblico
fad5beff-bade-48c4-9d70-39a9b3a45df7	prodotti alimentari di origine animale
fad8916e-64f8-4ce9-819a-2d9058e3b211	burattatura a secco
fadd0f2b-9102-433b-aa86-7436f26faa0f	principi di assistenza infermieristica
fad86222-5f54-4ac7-bb7e-20254fa7b20a	gestire le attrezzature pesanti
faef14de-8610-4c54-85bb-0f8492e36cc1	materiali per la fabbricazione di porcellane
faef4a34-6bdf-4b0e-a1d3-4cadb35cdd4a	ingegneria automobilistica
fae1881f-fab8-4170-8121-52b36c66b767	effettuare l’audit del sistema HACCP
faefc294-3d35-4f0e-9a61-083cb9ba2032	individuare i comportamenti sospetti
faf04ebc-4db8-4b73-9c6c-1b4165c63ce4	reindirizzare le telefonate
faefd346-7592-4771-adcf-148dccd25338	risolvere le problematiche legate ai conti bancari
faf3ee45-cecd-4737-9bca-5cf66bbfc1c6	manipolare la gomma
faf66566-9aee-4975-a030-c62c45cb00f8	movimentare il terreno
faf6ba9e-3fe1-471f-a8e4-afd05c502948	modificare le fotografie
faf9e145-8ea3-4a8c-949e-95ad18962435	monitorare l’arrivo delle attrezzature da cucina ordinate
fb02ebcd-32d7-4f9c-8355-31c346552c9c	adattare il peso della merce alla capacità dei veicoli di trasporto
fa31c676-db30-4031-9e18-c8b0fa6aed61	fornire assistenza nella somministrazione di farmaci agli anziani
fb0c324b-53b0-4fc3-a3d1-bf8b72fccf16	caratteristiche delle piante
fb0fef67-5d92-40a3-8865-5bd4b31db5a0	montare le strutture a tenda
faf729ef-1fa7-488b-88ee-6400131fe328	impilare le borse di carta
fb0d8829-5575-4d0d-8ea2-20e2d8aa1f3e	leggere le etichette con le indicazioni di lavaggio dei capi di abbigliamento
fb108c07-513d-483f-808a-ec8d8e4f796c	supervisionare i corsi pratici
fb22d314-17a3-4e72-bb61-f581585384e7	attività all’aperto
fa4b18de-4af5-48f0-a7c3-54951ad81eed	migliorare i paesaggi
fb223011-4fa8-488f-8357-8a84dfbaae35	fornire consulenza sul valore di una proprietà immobiliare
fb3b24fd-c61a-485c-9381-85f3cdd29a1f	strumenti di monitoraggio per la gestione ambientale
fb3bffce-5822-4f1a-9aac-d36de5a84abd	essere addetto al sistema di purificazione dell’aria
fb2caf2c-95ee-4035-b180-4582355e154a	prevedere la produzione di legname
fb3c1a0d-e8c7-49b3-a9f1-078baa92b59a	effettuare la manutenzione delle fosse biologiche
fb479029-d7a6-4061-adda-334b0c8c2b35	comprendere il bulgaro parlato
fb515dc5-1a4e-4b92-991d-e0f56e103807	eseguire il trattamento viso
fb55bd9b-3e29-47d1-81fc-3f5a971a7f0d	belle arti
fb584d53-e115-4ce3-a9f8-13dc51b6648b	coloranti alimentari
fb6fb057-77a3-4441-aa5a-c65578cd42e1	creare sculture
fb650a7a-7ea6-4373-a7dd-20bbfc1a7b7c	adeguare lo spessore dell’argilla
fb7a5701-a491-4d2a-bf60-7cc9916dca05	semplificare la comunicazione nella gestione marittima
fb853575-122e-4bfe-b2e9-bf1a0d5468f7	varietà di birra
fb7d607a-9626-492e-ad76-74c24a0a1ae5	linguaggio del corpo
fb8da0ee-c5cc-4c1b-99d4-8a657f62ac6e	processi dell’ufficio risorse umane
fb94d2b4-9355-4d32-80f9-b8cbf91905a8	padroneggiare le regole della lingua
fb9674ce-d0be-4922-be67-cbf43acc2069	processi di estrusione
fb93e443-8cbf-4518-9081-34ffa865580f	protezione del consumatore
fb9ad47b-ef5e-4aef-ab6e-28157ebc9d92	gestire il portafoglio del licenziatario
fb9d612f-0526-4848-92b8-fe4e5d5cdeac	sistemi di riempimento tubi
fb31bee2-a0fa-4783-9139-130953dccb5f	pesare le materie prime al loro ricevimento
fba326c0-678e-437b-b302-df44f462af99	supervisionare i lavoratori della silvicoltura
fbb7bc3e-efaa-4118-a1b2-126c8ce9425b	allevare il bestiame
fbbd9839-abbd-4db8-9d99-0568b1497e61	conservare le foreste
fbb967bd-9447-4abe-b0f3-c6eab5c449b0	gestire le finanze personali
fba83be0-e141-4e9e-acea-888a00c8e8c3	gestire le questioni di sicurezza legate ai farmaci
fbba8745-8e5e-44d8-8dcb-ed8010b7c0b0	agire da consulente esperto nel settore della danza
fbbe3b1f-bc0f-438d-b27d-fd33eff99f28	Sass
fa75f601-da90-4539-aa9d-d9b0db61bc66	lavorare con il team di montaggio cinematografico
fbcf84c4-581b-4a05-a70c-cd6d2da4d0aa	SQL Server Integration Services
fbe020a4-d060-41f8-ad82-38316a06ec4f	coordinare la comunicazione all’interno di un gruppo
fbdf5066-f13b-4bfa-a3fd-e28a59298564	ispezionare le infrastrutture aeroportuali
fbe5de8a-2b12-490c-812f-5076079e2e47	trascrivere i verbali d’udienza
fbcdebf5-3734-4342-b444-6173929b45c6	tipi di materiali per ceramiche
fbd0942b-4f9d-4a26-9c36-1cbfe81c2c73	geomatica
fbeff3e5-24b4-408b-96e8-638493e130b2	visitare le fiere commerciali
fbf3a37e-212a-44d9-a26e-71566a97225d	condurre prove di umidità del caffè
fbffd16c-a92e-4ab4-8aa4-c7478b39618d	hardware di rete TIC
fc0b0c32-417d-46c7-aafb-02fadc3dc056	movimentazione di merci pericolose
fbf95541-50ef-473b-8eba-c25a224ef2ef	garantire la sicurezza negli stabilimenti alberghieri
fc0c3aa9-5c1c-4969-9286-05b51aa98394	attrezzature di apprendimento per bisogni speciali
fc0f2875-4d83-4415-8cbe-389fe65f1919	progettare le attrezzature termiche
fc11bc92-ccce-4242-ae69-0c1bb07f548c	genealogia
fc194ba9-e0d2-4032-aefd-28329e12e880	manutenzione di macchine da stampa
fc1a3161-140c-4e3d-bf96-ed109dee8f7b	raffreddare materiali
fc1b0465-c345-49e6-9767-32d2490c479f	svolgere le attività sui mercati finanziari
fc280086-180c-4440-af4c-026a7eca8f51	chiedere i rimborsi
fc20f43b-d1fd-48f6-a95a-49023899b5be	coordinare le attività trasversali al settore camere dell’albergo
fc2781c7-ec6e-4223-bd6c-922a245b4bf7	pianificare l’utilizzo di armi in scena
fc2b877f-3b29-459a-9054-37d72d10b227	rispettare gli standard di qualità relativi alla pratica sanitaria
fc2e2e0a-ad09-4f90-9115-72dac53e8d93	parcheggiare i veicoli nel deposito
fc401e12-4462-4a54-b0e5-46fdd304148b	supervisionare gli espositori della merce
fc4129f4-91bd-4025-b3f8-071208a7c89e	realizzare dispositivi di protezione individuale tessili
fc4bd7a5-8dce-464d-9059-fbfa75d87650	vendere le parti di ricambio del veicolo
fc52c7d5-185c-484a-aa87-49501b63e352	creare le mappe di rischio
fc5d3f2e-b806-415e-ac90-4218657b90d6	principi di tracciamento
fc552111-a259-4fc4-97a4-59cf003c5a1f	assumere la responsabilità della gestione di un’impresa
fc66ad71-544a-4c2f-897d-868238589644	scrivere in kazako
fc68f7c2-fdde-40d2-92c9-8472e4de2601	richiedere permessi di lavoro
fc62f1a6-ec36-4a69-859b-f266991be26a	accogliere i clienti del ristorante
fc68514e-6767-43e4-a177-332fb12b1deb	supervisionare le attività extracurricolari
fc6d9d54-a098-4ac1-bcc3-dd7da290fe0d	mantenere sistemi di circolazione
fc6ef5d5-d41e-479a-8a5b-af1f92b697e9	marcare i pesci migranti
fc803e8d-da48-4c85-ab57-b32fa31b9533	preparare la documentazione sanitaria
fc7d4f53-4a53-493f-aa20-4452bde08a7e	installare gli oggetti in scena secondo programma
fc9bf604-703c-4df0-8219-38eb417e814b	redigere un comunicato meteorologico
fc730106-2918-4b12-86f4-4629c20c83b3	agire da portavoce di una società
fc9c1c1d-2ef7-4efb-8573-24e60310e659	modellare il mantello di un cane
fc75862e-eadd-4a70-a268-476911035fc7	facilitare lo sbarco in sicurezza dei passeggeri
fcae5dad-4886-4564-92b0-6507817f4acf	applicare tecniche di saldatura ad arco
fca1ea81-7e87-47d6-8503-6fd8fbb22b3d	prevedere come affrontare il comportamento indesiderabile degli animali
fcb6514e-c2a2-4841-8bbd-a29ca2314805	gestire i progetti per l’utilizzo di sottoprodotti organici
fcb8a0b2-58ee-4b2c-bbea-2f49200d82c6	stimare le distanze
fcbe0526-fce0-4100-9208-7d306cabf955	processi di produzione
fcc3cd66-07c2-4f5f-959e-e8ac3d31626e	strumenti per la gestione della configurazione software
fcc64263-3ed6-4836-a6ea-2a9636eb0485	comprendere il berbero parlato
fcd5dbd3-d91f-4c77-a996-afb04b8bffd5	comunicare e collaborare mediante mezzi digitali
fcd1502a-4ec5-40c5-83e1-f8385c68e09e	selezionare le produzioni artistiche
fcdc0441-3c43-4541-81c1-c2f3d1980b34	monitorare le procedure di sicurezza nelle operazioni di magazzino
fce67300-d775-4755-85d4-4f3e670f2b80	valutare le violazioni degli accordi di licenza
fce8ccfe-99b4-44e7-92d2-7458094c2d2e	preparare miscele per bevande
fcecec10-90c7-4360-9848-09b368cb9205	azionare vari tipi di attrezzature per la manutenzione del prato
fcebd1bc-9e08-4db1-a8ed-a0ed9c20f77b	diritti delle vittime di reati
fcf477f4-88d5-45d7-81e8-9655815d7971	gestire la consegna ai serbatoi e la vendita di carburanti
fcf0d926-225a-410c-b39e-c69a9060c65b	individuare imperfezioni nei metalli
fcf474ce-7a41-4691-af01-d4196b649b76	supervisionare la costruzione di sistemi fognari
fcf512c8-2570-436b-a551-6c720dfc21eb	essere addetto alle macchine per la produzione di vino
fcf7c560-0772-4419-86ee-cfdd4196afb0	materie prime agricole, semi e mangimi
fcfff9a4-3bce-495c-8bde-7a7df346ec55	esaminare l’area dopo l’esplosione
fd04be7c-6c82-4e72-a811-dfca63b1f7cf	scrivere in occitano
fd10add8-cc4f-42c1-9647-1958a10fe3e5	installare attrezzature elettriche ed elettroniche
fd1286e4-1fe7-4341-abc3-30e64cf35bf8	produzione di pompe e compressori
fd1b78b0-e495-49dc-b139-68772149c8ee	stabilire il prezzo del prodotto
fd1e3dd7-51ce-4127-a235-787cf341403d	insegnare l’alfabetizzazione digitale
fd21d71b-c6ad-49a6-8474-201355e3f673	gestire gli impianti di trasmissione del gas
fd2477c4-ecf3-4ada-b66c-a3efd5181e93	applicare un trattamento psicologico clinico
fbf76af3-0615-4a02-a302-0867e392b32c	monitorare le tendenze nell’arredamento di interni
fbf9aed9-6a35-49a4-83db-13287960bf2d	tenere lezioni di allenamento in modo sicuro
fd4386fb-cabc-44f5-9ca3-3205008344ef	raccogliere le informazioni finanziarie sulle proprietà immobiliari
fd4893e2-0d2b-4df7-9a11-ef74cbe89d55	epatologia
fd5976d2-aa4d-4810-9109-2729780cc51e	produrre utensili personalizzati
fd5bfcd0-b726-47ee-a218-6de1e5df7a75	effettuare la manutenzione delle macchine del vigneto
fd616aad-b2be-4ba1-915a-02c6170207a6	controllare l’evoluzione dei fatti a bordo in caso di emergenza
fd8092f3-7ced-42f7-94cd-499916e3f159	effettuare le ispezioni di sicurezza antincendio
fd86e58e-a131-4f03-9a53-1931f12ee1ae	gestire gli aspetti tecnici della produzione viticola
fd87af9c-b7d1-44cc-92d3-c043272d5282	conservare i prodotti ittici
fd8eddb0-2808-4e6b-b907-d49902127a7d	leggere blueprint
fd93d6b9-f847-4f43-8aab-87f6e78242af	prestare servizi in modo flessibile
fd96caba-2157-4050-8eaa-1ef1fe9112c7	essere addetto a levigatrici
fda93c68-d362-47dd-8784-6c237cb0d2b1	fornire servizi di assistenza sanitaria ai pazienti nel conteso della pratica della medicina generale
fda9f812-19ec-4833-9393-b7df460e286f	creare rapporti GIS
fdaf8060-ff95-43b0-8f83-52fcd08ee508	utilizzare i programmi per computer per migliorare le abilità dei pazienti
fdb39c82-32d0-41c8-a57e-a4aacb63d731	eseguire la cagliatura del formaggio
fdac9404-f7f8-44fd-8f2e-d682467e9728	fornire informazioni sugli effetti della fisioterapia
fdb7ca4d-04f5-4875-9393-93694478e0ec	soddisfare gli obiettivi di produttività
fdbce725-b58d-4b9a-b951-e31a1d5090ca	condurre una video-telemetria
fdbf2971-cfed-4216-856d-15e083b7f89b	tipi di impiallacciature
fcd3cdbb-7bbc-4067-b238-91cb2e95bbcd	medicina dell’adolescenza
fdc0e384-1892-42be-bd46-7fd364bca84b	utilizzare gli strumenti per la riparazione di scarpe
fdc5133b-b487-417e-8d58-b0188adf50fd	seguire le tendenze del mercato delle attrezzature sportive
fdd1c072-f7fb-41c3-9e40-88c50e90867f	insegnare i principi dell’assistenza infermieristica
fdd651b5-519c-4724-8778-0077b0513b9b	applicare il trattamento presmacchiatura
fdd676eb-0755-4599-9503-9bfcb315de7a	effettuare le analisi occupazionali
fdd839da-71df-40ea-b496-8b2a758b5ffe	azionare le attrezzature per la movimentazione dei materiali
fde8ab85-0870-4443-a3c1-56f99f737301	sviluppare i piani di distribuzione dell’energia elettrica
fdeebb8d-c2b1-491e-8e9f-96e31dc80b49	gestire le operazioni di una cooperativa di credito
fcfb772d-d512-4960-b1ad-235f0b4d5044	organizzare la vendita di prodotti vivi
fe036085-3beb-4baa-aba1-85ff53c52340	gestire i resi
fdf9c55e-714d-4cbe-8d5a-0cc733e4fbac	supervisionare i dottorandi
fe044654-3710-415b-9cbf-966ef723eee9	processi di disidratazione dei gas
fe050432-1645-4b79-aa03-a9123e8552b3	rimuovere la colla in eccesso
fe121b14-4651-4501-a676-ca97e3f7e330	insegnare archeologia
fe08dcf9-7fd5-445b-b4e9-c00eb343a93e	supervisione delle persone
fe14c215-4718-42c4-a5ce-67c7d25887c2	effettuare la demarcazione
fe21daa7-5d66-4f9b-b361-27ff50358105	regolamenti sindacali
fe39c979-a9e7-4efd-8d56-1bb7ffe189d6	eseguire la manutenzione di attrezzature per l’acquacoltura
fe3c6675-324b-4c28-b585-f1084b04a21d	effettuare il marketing mediante dispositivi mobili
fe2b11d2-91bc-49b0-bb72-e290b64168b8	creare gli insiemi di dati
fe43b54b-8495-447d-895e-c19697f20a9c	sistema cardiovascolare
fe4976e2-5f26-4b76-aaed-e64c4a3afa18	attrezzatura lavori in quota
fe4b2c51-8143-4584-92b1-cdb1ae05a261	creare il calendario per i mezzi di comunicazione
fe5715da-71c4-4b8c-ad10-d21319972473	tecniche di dermatochirurgia
fe580f0d-0480-4062-bc8d-16fd2dcab9af	monitorare i satelliti
fd399b4a-a7c2-44eb-a9b8-903fed84285b	stampare dischi in vinile
fe5e234b-0763-45fd-b6f0-cbe9faed92bb	verniciare i ponti della nave
fe636e28-9957-433f-880a-6dcc03a2f008	effettuare la manutenzione delle vasche per la viticoltura
fe6b724f-6416-4d1b-b45c-c5dd15214c8d	valutare le sessioni di musicoterapia
fe7e2d06-04bc-40ff-bb03-65d9ba08f3e8	somministrare i farmaci per problemi di vista
fe6e33c4-7649-4a33-a6fe-410bf71509a2	utilizzare il pannello di controllo della giostra
fe8342b8-8eb4-419e-a7cb-24a372c38221	astronomia
fe900881-c2fc-42ca-96b2-56703a2ec0be	tipi di fibre modellate
fe845180-450b-48ae-a870-7de74b05e7a4	gestire i prestiti per le mostre
fe9e5685-e675-4647-96ab-94d09610e1ba	regolamenti in materia di tranvia
fe997d41-36e0-46b7-be18-38575ff360a5	utilizzare apparecchiature di saldatura
fea9b6be-07bc-408e-91f6-20379f19440d	norme di geometria del binario
feb69f94-cf4a-4662-8a87-96e314820548	tecniche di rilegatura
feac8bd3-dfc6-4f0c-b8a0-43579cc6e49a	gestire il feedback
feb6dc3f-3d06-45d9-a4d5-5ec11deaff0e	stabilire le vendite promozionali
feac9bd3-35da-4bed-853b-1530e0e81a23	individuare le lacune di abilità
febb0f65-2ec9-40b4-995e-ffbdf232a57f	gestire le commissioni di licenza
feceb332-113d-4d1e-a6a2-91b4371ee2fe	fornire assistenza alla madre durante il travaglio
fed80431-3d5a-4571-b07d-3f9edd5e9bb1	condurre studi di mercato
fec47f37-9073-4606-8bf6-301836a9a677	seguire le norme d’igiene nelle operazioni di pesca
fee01744-12a8-4a54-9240-3b6073f5c50b	istruire sulle reazioni allergiche agli anestetici
fee175c5-ae13-4b58-ac62-f2976cb12676	fornire materiali da costruzione personalizzati
fef3068c-735b-4221-8254-d752823e35c5	posare la cassaforma per il calcestruzzo
fef3416d-bd30-4be2-9659-ea0d5ed8f01c	assistere gli utenti dell’archivio nelle loro ricerche
fef0877b-e404-4b5b-af0b-fbc8db696e25	utilizzare apparecchiature TIC nelle attività di manutenzione
fefa85dd-e775-4ac9-99af-e7ba082f1067	mantenere un registro dei passaporti
ff005018-8810-4ebf-9f55-59a60e25eb48	gestire l’ansia dei pazienti
ff024e09-422c-4809-823a-d07a26d2f6f2	gestire le reazioni avverse all’anestesia
ff027034-3a72-4099-8bea-4a3ad8aa91a3	offrire consulenza sulla conformità alle politiche di governo
ff0695e8-1355-4185-8b49-b3ab0e96d9de	impresa sociale
ff0807e0-8212-4541-9673-c7620073cf9f	lattazione
ff0a5feb-130b-4870-905b-5ae609fc35b6	recitare per diverse riprese della stessa scena
ff0e38e8-7432-430a-bcbc-681edfc23fc0	tecnologia di telerilevamento
ff0bc078-5da5-445f-a037-4cf72640d6aa	biochimica clinica
ff140602-ef32-493b-a3ef-f8100358c926	ideare i concetti di spettacoli di magia
ff1cb6d9-0a7a-40fe-8a00-4a9f29becb9a	formare il personale sulle caratteristiche del prodotto
ff1c0078-96f9-474f-bd35-f9601d112388	effettuare la manutenzione del forno
fdeddc4c-8170-43a5-af70-3aa46baf7d73	utilizzare macchine per fabbricazioni metalliche
ff29c670-bbdc-43dd-89dc-923d2381162c	selezionare le attrezzature di acquacoltura
ff28fbce-edf1-4ad8-a5cf-cd35e441b128	collaudare unità meccatroniche
ff337925-f7e4-48ba-be76-a122f1af98ae	promuovere i propri scritti
ff3b99b2-8691-48dd-8728-d694e2ad53a8	regolamenti in materia di trasporto di merci pericolose
ff3c4548-9cca-4c45-8e10-d8e5919d23e5	separare gli elementi instabili nell’acqua
ff3e0bcd-9fae-438a-a1ad-96b1496bde2b	geometria
ff4223f3-9a67-4ef0-9f8f-5f6d96d046f9	criteri di qualità per la produzione di mangimi
ff4f132e-51e8-44a1-af82-091901420cab	seguire gli orari di raccolta dei rifiuti per il riciclaggio
ff5732bf-c533-46c1-baf3-7b523aedd7a4	raccomandazioni di sicurezza in materia di giochi e giocattoli
fe0a3178-9d08-4112-896c-eabeaf1b428c	utilizzare le tecniche di consulenza
ff5f47e8-58d4-44de-bb1c-9c471d8ee680	tecniche di accordatura
ff61ca40-ec8e-4514-89dd-ec796465371d	addestrare l’equipaggio dell’aeronautica militare
ff67a7e5-b7ca-4ec1-9f58-9132444c392b	applicare i codici di condotta veterinari professionali
ff67b7e6-f646-44d9-b8d0-db85babf8d60	genetica medica
ff6999a3-865f-4395-976f-21b1ab45d5d6	compilare i manuali di certificazione aeroportuali
fd00a4aa-9eac-475c-8117-c3d60034ac72	promuovere l’attività fisica nella comunità
ff70485e-5d36-4439-977a-055f0c81fc14	monitorare i fluidi di perforazione
ff700916-684d-4d26-adca-37eadbc7e573	effettuare un’autovalutazione
ff7455a7-7469-4f71-98ed-fde8373c852e	deployment
ff7923de-20c0-4351-9bf5-ac3aba6f6557	pressare la carta manualmente
ff60659d-bb04-4f09-96ef-f2b263994945	Wireshark
ff7a5f78-55f3-4644-8135-af34ac3ce8cd	gestire l’ufficio per i servizi sui mezzi di comunicazione
ff7c62b6-0901-48db-8324-c6cae7d33684	diagnosticare le malattie reumatiche
ff8235ae-4e91-48f3-88b2-41047d974540	vendere le armi
ff832e6a-2dbc-45b1-8aa5-cf2396c9cb88	disabilità motoria
ff7df0f6-084f-4a26-bd82-495aae2e446f	fornire consulenza sulla manutenzione delle macchine
ff87a914-6af4-4de9-85f3-a05921f506f5	segnalare l’area dell’esplosione
ff885cb3-7915-4a67-861e-e2742f83e9de	tecnologie di taglio
ff8b485a-be19-4c99-894d-7aab381e6706	rivedere lavori di traduzione
ff925be3-0d8a-433e-860a-ef16d8854521	epigrafia
ff930249-19b7-4f9d-a585-c58b3da060d3	applicare un trattamento preliminare ai pezzi
ff9a4ab7-d822-48c7-b77a-9af024ad9e18	temperatura della torcia per processi di lavorazione dei metalli
ff965a23-48a1-4d91-84be-c8bd8cf1290a	tecniche di rifinitura per calzature
ff9ef3f1-abd0-43f4-a510-2337d71284c1	gestire l’allevamento di cani
ffa993e9-0e23-4d82-a1b5-7375ca0b3233	commissionare la costruzione del set
ffaaca4c-42b2-453d-9200-be3633f4a226	schemi degli impianti elettrici
ffae2bb9-3ee4-47d0-af06-ce5906efe04e	monitorare le operazioni della flotta di veicoli
ffb2834a-8823-4b59-8494-aa4a07c3a4fd	fornire la consulenza legale sugli investimenti
ffbebc8f-48f9-4303-9527-9ae15930c880	vietnamita
ffc0d722-836c-44e8-845d-902a49f4bf11	gestire il trasferimento dei ciocchi
ffc199b5-0bec-4ae5-8864-ee44ed1f1b07	analizzare il consumo energetico
ffc3c30b-c3bb-4646-8c82-763afbe64f17	garantire la longevità delle azioni di combattimento
ffd35484-fef4-41bd-b573-8e440ff922b9	parti della cabina di manovra
ffd8955a-c0f6-4838-b0f2-d4180920056d	ricercare nuovi trattamenti per i disturbi di natura ematica
ffdb0fc4-f3f7-4e3c-bde5-1a55c85b04ce	gestire i processi
ffdd7010-2b87-47df-992e-5942d1894c56	utilizzare hardware ICT
ffda669b-8086-4d59-a2b2-1279bf107976	fornire informazioni sui servizi scolastici
ffde06a8-5556-4183-82be-6495fd95ed98	lettura automatica contatore
ffdf09e7-b2fd-4072-80fd-f50d4e563a05	studiare le produzioni teatrali
ffece9e3-8eff-457f-b836-fe0d15a46750	inserire setole
ffea8907-3439-4b3b-8c78-91858893568d	analizzare i fattori esterni delle imprese
fff99935-ba5b-4c29-9e93-57a7798524b6	segmento terrestre
fffd48e5-c50e-406b-961d-448c710ca740	gestire procedure di emergenza
ff173b11-7b09-4810-9cfc-b6d6cdb20fae	assemblare il prodotto finale
ff635cf8-abfc-4213-ad91-406eb673855f	gestire la ricezione di materie prime per gli alimenti per animali
ff9f6840-1501-4fc9-85f8-762ba4df7f7e	tenersi aggiornati sulle novità video e musicali
ffb06bec-834d-447d-a9df-76fc59fd2903	decidere il nome dei profumi
\.

UPDATE sys.sys_skills s
   SET skill_name = e.it
  FROM pg_temp.esco_it_labels e
 WHERE s.skill_id = e.skill_id
   AND e.it IS NOT NULL AND e.it <> ''
   AND s.skill_name <> e.it;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_temp.esco_it_labels;
  RAISE NOTICE '000159: ESCO skill names translated to IT from % loaded labels (G-01 slice 4).', n;
END $$;

DROP TABLE IF EXISTS pg_temp.esco_it_labels;
