-- ============================================================================
-- 000162_g01_esco_skill_names_it_llm.sql
-- Fix G-01 residuo (audit S1006 tail): the 817 ESCO skills whose ESCO URIs
-- are stale (HTTP 404 in the current ESCO classification → no official IT label)
-- translated to Italian via LLM (Enzo decision = LLM-assisted fallback). Bulk-loaded
-- via COPY into a temp table + idempotent UPDATE join on skill_id.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.esco_llm;
CREATE TEMP TABLE esco_llm (skill_id uuid, it text);
COPY esco_llm (skill_id, it) FROM stdin;
00123a27-c25b-4ab9-9632-6d215115fd57	meccanica computazionale
0080cdfd-7460-4ae4-883c-3ec42af1e6c7	gestire dati trovabili, accessibili, interoperabili e riutilizzabili
012f0b5d-ea0a-4c96-9b9a-5685c452335f	incubazione d'impresa
014499f8-0886-4a67-9303-b8630fb4dbae	modelli di business basati su blockchain
015c60f7-2fb2-44be-90c3-eace5c6f615f	computo metrico estimativo
02470877-f244-422e-90d0-16a482a6430a	definire le specifiche per l'abbigliamento
02e12625-e4d0-4f2c-90bb-ee307475da26	strumenti di videoconferenza
03871d86-dcad-4f23-bb5f-d6ca598dfe52	applicare conoscenze scientifiche, tecnologiche e ingegneristiche
03ed9dea-66a5-4122-af6b-8e48bf4ad3f7	progettare misure di efficienza energetica passiva
040fe34b-1169-4dbe-a721-9d92fa01b4f1	normative sull'accesso ai documenti
04337752-92b8-4f11-bc8e-fc1d74a8771f	valutare l'onere amministrativo
04eb4cbb-7bff-4d62-a69e-4ee48c8f66e8	tipi di legno
05130e96-9a98-4bea-ae94-4965fac5790e	prevenire problemi tecnici con i sistemi di integrazione multimediale
0551a197-853c-412f-a94d-68b18a473e95	ricerca operativa
057cb530-dc3d-4eaa-9941-a599f1c41bc5	GitHub Actions
0592408b-f73b-4d05-83ca-69457917b3cf	realizzare prodotti sostenibili
060675e1-acf4-4750-a7f8-7227fbadc935	chimica verde
0628b5fa-9037-4967-9274-4ac6e064aa58	principi di mining della blockchain
064ed40e-6b9b-4903-a63a-7aa301b6c3a4	sviluppo iOS
06a49464-81f0-49df-a836-e38751916f7d	installare dispositivi smart
06a7c3a8-836d-42fe-ab36-140913c5dd04	blockchain
06c22ccc-722b-417d-8c25-b42e81f7b901	promuovere il trasferimento di conoscenze
06c2b5b1-3642-4f42-b661-7d89da29cff9	test di usabilità
083f082f-c274-4d45-8e45-7a2a87420974	preparare i pezzi per la post-lavorazione
08ed6285-6ca3-4fd2-a493-2d9cb0d88cc7	affrontare i rischi individuati
09575001-05cc-4a4f-ab40-c98781c9e2d5	progettare un sistema di raffrescamento solare ad assorbimento
09893410-0398-4554-821c-b9981edb8d47	vulnerabilità delle tecnologie a registro distribuito
09b60154-d906-4e45-b45e-142ae12e405e	mobilità come servizio
0a061f38-64a7-4f7e-8b14-90b7fe508183	ispezionare generatori a corrente di marea
0a805b78-2862-44d5-a594-1172870e7896	progettare un sistema di integrazione multimediale
0ab4531a-22c7-46b5-9c46-1bb30796e13f	comprendere il lussemburghese parlato
0b54f053-15ab-4a73-b1b0-c3132398b5df	preparare l'area di impianto
0b7e11f7-99b5-4ac0-acd2-d4ac24ed101a	utilizzare sensori per il rilevamento di parassiti
0bfe4281-f284-4428-8b04-efb870c74732	sistemi di bike sharing
0c223dcc-991c-4b60-a77a-59ea90e67476	educazione tecnologica
0c6ca5c3-8167-42da-af94-e1241b25778e	definire le politiche di rischio
0c91e53a-ff91-44b4-916b-b278beb43752	configurare sistemi di produzione additiva
0c974ebb-5c31-422f-9f05-d3e7372ed262	design pattern per blockchain
0cb27f0c-5f76-496a-884c-6011eb754f17	tecniche di coaching
0ce44d57-8823-478b-941f-303b780b5d6e	pianificare misure per la salvaguardia del patrimonio culturale
0d09c76a-09c8-414b-ac38-7cb358bc869d	manutenere turbine eoliche
0d0b88e6-cc26-499e-acb9-06d4593c3417	organizzare informazioni, oggetti e risorse
0d50dbc5-a3ed-4098-9784-ab42fb97dead	valutare architetture blockchain
0dcad00d-edd7-4c27-beac-e84e9be009da	tecnologia navale
0e54642c-f495-417b-968b-13dc075da211	tecnologie sostenibili
0f85ffdb-0768-48e6-8e73-74c5e60abe1b	metodi Six Sigma
0fd89a7b-fc9f-482e-b8da-c7704a7a4d5d	eseguire simulazioni energetiche
1011bbba-2953-426a-b689-cf5788f82680	garantire la parità di genere sul luogo di lavoro
10364040-dddc-49c7-a43e-b12f7328b77e	sviluppare con servizi cloud
1039f6b0-7f4a-447d-8725-8d257b6b46e3	identificare i bisogni informativi dei giovani
105afa80-6bc2-4d77-9324-fcaf5630662a	arti digitali
10fe616d-5b6e-4752-8fa7-1c968b17482e	tecnologie di microgenerazione energetica
111d92b0-ebc1-4a8e-b290-4da4409548f9	UML
11235556-ba6f-4cdc-b4ea-8068304d6f99	sistemi di riscaldamento elettrico
11bc9923-c2f0-4ccb-a8af-d09e3a8479d0	indicatori chiave di rischio
127f5606-e12d-4093-8433-3d3584e9be36	costruzioni e impianti offshore
12ce802c-1091-4401-b184-6415a9ec67cb	eseguire rendicontazione e valutazione contrattuale
130a9a99-3fd1-4066-b63c-887445bd0a41	idrologia
136fa3b3-f7d1-41d4-a143-a1bb5f4f8a3b	implementare la pianificazione dei percorsi nei servizi di smart mobility
13fa1d13-b968-4e9c-8933-37bbbeb4852a	neuroscienze
1419fb3d-5f4d-41b7-a478-212e59bd2b40	eseguire calcoli idrodinamici
1422531c-46b8-45db-a7cd-3f668763549a	testare l'elettronica di potenza
143e270b-e02f-4456-a29f-9d38931e334b	dimostrare lealtà
14a5eaf3-c5ba-4130-975c-7e4c409f8f90	analisi delle reti sociali
150b60ea-3172-4ceb-b5d1-f2368559494a	API GraphQL
16c4a8d6-540f-4c27-90cc-7cc24716930e	delineare gli organi a rischio
170bb578-678b-4125-b76a-1de16d47e526	eseguire la riduzione della dimensionalità
170e72f1-f632-4735-8d24-3257b53c4088	valutare le attività di ricerca
17440155-b592-431f-8133-fd8255994603	progettare sistemi di acqua calda
17722d51-4766-4ccb-bcff-3ef83cf83c60	tennis da tavolo
1777af75-d012-41d5-a111-08a14bad6aa3	gestire programmi di volontariato
1781b993-3275-453b-b68e-1b266c3de0c6	pensare in modo innovativo
17893307-bdb6-4ef8-b810-26ccd3085609	tecnologie vehicle-to-everything
17915176-75ed-4620-905a-1f8204cd2743	calcolo quantistico
17d1dcbb-0b87-4d0a-abb7-83e9576099c4	Power BI
184772e3-8f6a-4cd0-bc8e-824c3aa6a65e	produrre componenti in manifattura additiva metallica
1868d7bd-a725-4fde-a992-e93cb027eb4c	sviluppare una rete professionale con ricercatori e scienziati
18c51277-e800-467c-8e6e-f9d00b4e3310	organizzare servizi informativi
18e73317-202f-4d07-85e1-0bc9d35116c6	lean manufacturing
195bd881-3da1-4994-8aa1-447c4b05eb8d	regolamenti dei Fondi strutturali e di investimento europei
1a5f6420-b424-484c-8575-e1f411974f69	fornire dispositivi di protezione contro le malattie infettive
1a67f5af-f446-4336-b2a7-3e5405ad9baa	condurre ricerche sul web
1a9902c8-5c85-42b3-9eb4-969315d04bd3	esercitare diritti e responsabilità
1adeac65-c785-4f4a-aa79-af18ce281342	interagire professionalmente in contesti di ricerca e professionali
1ae2999b-5566-4df4-a958-a21d8be566b0	garantire l'accessibilità delle infrastrutture
1b5104cb-5af2-4814-aa2c-aa5a9b5c8916	model based system engineering
1bdb7f25-59f1-459f-9202-894de4a2fe8e	utilizzare tecniche di interrogazione per la valutazione
1c899726-4a08-4f60-8431-86e30292afb4	personalizzare le metodologie di progetto
1ce7828b-026b-4190-b57d-71cc80b19a54	terminologia blockchain
1ceb164f-8416-4749-9952-ebe0bac91e1f	progettare database nel cloud
1d5294eb-b053-4187-be6a-cd935d0e0f0e	ingegneria della sicurezza
1e1e3fa7-6d72-4354-976b-1afc5c0de031	gestire condizioni di salute croniche
1e6f34a6-6da3-40a6-9c3f-322b0c25f443	Terraform
1ed10fc2-a854-40c9-8266-053134ecd2dc	applicare standard di qualità nell'interazione con i candidati
1f4417c3-759a-4b10-9e3b-6b86e244e422	eseguire uno studio di fattibilità sull'energia da biogas
1f620755-d29e-4f5a-b434-6348aa801b5e	gestione dei fornitori
1f68af24-697f-4a26-818f-ce48be7c0e76	formulare conclusioni
1fd8073d-1ec6-4fbf-9ee0-4ba20fe233ab	improvvisare
20351f72-bd83-4bf4-b3ea-2cf12133a0ed	cognitive computing
204c7cf6-72c2-4855-8efe-e287acbd3993	definizione degli obiettivi
2051431a-03ba-4352-be8d-6ad320f3760a	integrazione europea
205b54e7-a74c-4523-af32-3a56eacbb74a	progettazione di sistemi basati su blockchain
211924b1-ccac-441b-b9d0-551e4f699361	progettazione di sistemi di emissione per riscaldamento e raffrescamento
216d2567-f69e-4a2b-8280-eabb12955c57	fornire consulenza informativa ai giovani
217a0480-bf33-471e-876f-683ad9952218	microestrazione in fase solida
2223994b-be54-42c9-96b3-c7495075bae4	amministrazione di rete
2258ff9e-b8f3-41ef-b446-ff7b87a24f2c	tipi di pompe di calore
22736f45-39a3-49d5-b287-b8be61b6ed74	applicare il blended learning
228dd470-a776-4001-a3bc-1d7c179fe95b	aiuto umanitario
22ed4191-0971-4690-a811-25d59bc73aa7	condurre uno studio di fattibilità sulla cogenerazione
23459325-1803-4e0a-a669-30f54173fdc1	deep learning
23ee5d5c-23d3-46dd-96d3-c21ce8b06e48	progettazione di soluzioni di retrofit edilizio
23f5b5b3-9131-4f96-a0e2-401abaec3b9b	sviluppare soluzioni di compounding green
24d3d8b1-d918-4332-be52-9dd861eded1d	progettazione di reti intelligenti
25115858-a0a1-40e2-8f8b-db527f8796b8	gestire la pianificazione degli approvvigionamenti
252f9ab8-5249-4bcb-bebc-acd083ab2381	eseguire operazioni di rifinizione della pelle
25946b14-6ae2-42b6-8aa9-b635835580df	tipi di forma (calzature)
25d92200-4bf6-4131-b71d-1e5142dde6b5	eseguire misurazioni dosimetriche
260dbe80-bb84-44eb-8af0-4e63f4979f0e	applicare i protocolli di distanziamento sociale
262e14b9-174f-4c9d-be83-4a3751b90ef1	selezionare tecnologie sostenibili nella progettazione
263f3fae-7c58-4e85-a516-10398aafc35f	business analytics
26b5dca4-e2c9-41a0-a7d9-97742a5620af	sistema di raffrescamento solare ad assorbimento
26e6dc4d-12c6-4a67-8359-7c1c7d2699a1	sottoprodotti
2701af11-221e-4634-aca2-29963c343d45	dispositivi di micromobilità
271e95e7-348b-4f12-affe-17c77c735f2f	progettazione del modello di interazione
273bd103-9dcd-4503-884e-6a74b5f3969f	ingegneria di produzione
27e53f36-28fb-40cd-9e17-92d481dbf754	consigliare i clienti sulle tecnologie per la smart home
28684796-d5d5-49c0-9222-1aa5ac1607d3	tipi di badge digitali
2901aca9-3bad-415b-aa09-b97359766b77	sviluppo backend
29b63fed-fb03-43f3-8a17-a07d53a2f578	individuare opportunità di innovazione basate su blockchain
29f27974-1b71-4735-9b01-5e96d21abe3a	buon governo
2a1bc897-5cfa-48db-99e2-61f399f2abb6	redigere la documentazione di progetto
2a234c34-be16-49e7-92b5-b1693fa3516e	alfabetizzazione mediatica e informativa
2a5ba236-6606-41e5-af06-52ded001c048	framework Scrum
2ad1d869-9be3-4406-aa34-ee6ca935c952	progettazione di spazi per esigenze religiose
2b04c310-aaa4-4d34-a491-5b975fb5da53	promuovere lo sviluppo della capacità di valutazione
2b63dbe8-0fb1-4a40-9877-32d44a9dfce3	comunicazione aziendale
2c2d0b9a-a20a-457c-99c9-725191016e30	gestire la conservazione del patrimonio naturale e culturale
2c36930e-41d5-4c77-9e5f-7b52305f1cf4	supervisionare la caratterizzazione dei filati
2cb980f8-2ad3-45f7-89f8-fd69d22a8986	standard di gestione ambientale
2d302409-c076-4018-b1a2-830efd2dc1d8	materiali di installazione sostenibili
2d7ebac5-cf83-4555-8e18-1beb153fadb5	progettazione della tenuta all'aria degli edifici
2dbd7b13-d778-4b0e-8776-fe7bbee78cb3	condurre uno studio di fattibilità sul riscaldamento elettrico
2e05c5d3-9dee-480f-b403-4ca628b82898	valutare l'impronta ecologica dei veicoli
2e1525a4-ded9-4d15-8dbe-a001071a07c5	coinvolgere le comunità locali nella gestione delle aree naturali protette
2e8f8041-865a-4e49-81c1-257b43cf6367	fornire istruzioni sulle tecnologie per il risparmio energetico
2ed8587c-716d-43a8-860f-ce988aa4046f	formazione dell'immagine
2ef1f5f7-c4e4-46f8-9c98-e57062fb22b2	costruzione a tenuta d'aria
2f098068-90f8-4335-baae-75f48620e6f6	manutenzione predittiva
2f63aac0-5411-4791-85c9-198ed9e44b4e	progettare un impianto di riscaldamento elettrico
2f8950c6-7cd6-407f-b59d-0777e21ca08d	eseguire la guida per immagini nella radioterapia
2f8d44e3-c05e-41f8-9c51-e9f139f61dde	gestire le relazioni con gli stakeholder
2fe209c9-a20d-4802-a4ec-c8de469a4a7b	principi del lavoro con i giovani
2ff721ae-4320-4237-9694-a647bc27e6e4	ricostruire la teoria del programma
2ffc26d9-bf95-483c-b0dd-353252f138e9	software di trading
306a39a4-be52-4077-a22e-f7cae16994fc	tecniche di autenticazione degli alimenti
308dd2e6-47f1-431c-8b26-b773953669c6	tecnologie self-service nel turismo
314f1db8-33e2-4dff-ad97-490dc9f10d11	skateboard
31a12938-bdcb-4f19-8cb5-3632c570c59a	spostare oggetti
32266c28-2521-4b33-9905-91af1eb1af24	Scrum Master
323e8415-73da-485f-9ab9-a3d2988bc30f	accettare critiche e indicazioni
3277d1e1-d1bb-4583-8416-7e167daccb63	mostrare determinazione
327c1b8c-a9dd-4e90-bb3c-24b925e1a58b	psicolinguistica
3295351b-25b0-46b1-b785-aa41cda4c642	percolazione
3308671b-f188-4d7a-8cec-b1a3aa2d6752	software di visualizzazione dei dati
339059db-f2eb-43ff-a2d4-4015f0feb235	apprendimento organizzativo
34454c80-72e0-497a-9680-0c2be894f9ac	scrivere in lussemburghese
351fb7da-8b79-4715-a13e-9ca273b948ff	raccogliere dati di cyber difesa
35fea10a-650f-43d0-ae90-1021abf9083c	letteratura scientifica
3672b3fb-d8c2-41fa-86b6-763af8d8ee69	amministrazione Linux
369035f7-994e-410e-bdad-9df77ac69c79	standard di edilizia sostenibile
36f37599-47c8-4bd0-b050-edb703056819	tecnologia del digital twin
377b51b1-7f2d-4823-a14d-ecfd44632add	pilotare droni nell'ingegneria civile
379f07ba-582d-438b-aea7-61e04ea9b15f	fornire informazioni sull'idrogeno
38633bb7-06ff-4a9e-ac9e-dd8c75d7580c	progettare strategie operative ibride
38775dab-174b-4f5d-a4dd-c95bf8bc7637	rispettare il principio ALARA
395289e9-603d-404f-b0bc-34fffd427bd5	valutare il consumo energetico dei sistemi di ventilazione
39914898-98e8-4e31-bfda-e78d2651152d	stima dello stato
39d11d73-c9ba-4637-9b64-43cfca04be35	riconoscere le aree di applicazione della blockchain
39ea8aa6-fc08-4ddd-87df-a1b3527f4baa	densitometria
3a1832d6-bda9-4013-8b0e-fbd4b5e413c2	eseguire uno studio di fattibilità sulle pompe di calore
3a3096ad-41d2-4084-bdb8-bc2780db3e23	utilizzare software open source
3a6da6e3-912c-48ae-8f7b-cc673a6b5a6c	standard di rete
3ad6782e-3054-44e0-bb3c-bf90cd9b6dc5	teleriscaldamento e teleraffrescamento
3adeaa71-80a6-4f86-86fc-455cc815d829	agricoltura conservativa
3ae84ed7-4d21-4e78-a9db-98bc9552e9f6	problem solving
3b820909-622f-497e-8f27-00e074261dcf	promuovere un'alimentazione etica
3b84e028-fa7b-4c15-8d27-c03faa361ea8	inglese accademico
3bc8031c-f921-4c64-a925-f462f48fa9ec	adattarsi alle esigenze fisiche
3c2e85a8-1eb1-4e78-bca5-cff40cfb9a58	biologia sintetica
3c6810a8-6444-40bf-a248-3e34061ad8a2	verificare la misurazione del fascio laser
3ca7dc91-8e14-41bf-a60e-3fff8ba4c290	identificare i problemi
3cf9aa28-63db-4aa7-ae4e-f346bf964498	tipi di lubrificanti
3d846328-190d-4d04-8527-6fc9fbe10c8b	spettroscopia
3d9c72b7-b3cd-4ff9-97cd-1de7a231e7b7	sostenibilità aziendale
3db23013-d313-4aa9-8178-1c4870d1dd07	sviluppare tecnologia blockchain
3dbc57ae-3b1a-451d-bb7a-80380289a9ec	applicare misure di sicurezza digitale
3dd3fe86-85e5-498d-8dbe-afb46beb6da2	eseguire procedure per soddisfare i requisiti di volo degli UAV
3ec187c1-1862-4c1e-bf70-a2ea4df90f7f	schemi di firma blockchain
3f172508-5f77-4ca1-8fa6-68218f423c4f	applicare lenti a contatto
3f35a48f-fb57-45e4-a218-2da92e49c1e3	materiali e componenti sostenibili per calzature
3f5f3804-f8ad-48cd-8895-15b496cc7721	creare alleanze sociali
3f90bdf5-e37c-4f8d-9a9e-77ecc5c809d9	teoria dei giochi
3fbdc3dc-44e7-4893-a770-6024ef1d2a6f	ambiti di applicazione della blockchain
3ff1f43e-7faf-4014-b462-f70deab1fafe	progettare microclimi negli edifici
403cabd8-eb1d-421b-9798-c21d370b04df	sistemi avanzati di assistenza alla guida
408eeef3-7456-4dfe-b817-c1ca7af1dcd6	installare sistemi eolici onshore
40e4a4e7-e8b7-4f46-a6b8-728f1e512acc	gestione della conoscenza
40fda743-629f-4ef4-b60b-2da73c01a973	fenomenologia
41801926-5798-47e2-a6e5-150224fe472e	apprendimento automatico
41c407d2-9f2c-4603-bd86-dc72c99bbe72	framework per applicazioni decentralizzate
41e6a786-7586-42ba-abde-f2e955a66651	pianificare il processo di produzione tessile
41f59859-e6fe-424d-8f22-1b6a582a0278	progettare le operazioni di post-concia
423befa8-7d07-45c4-8088-025d6cb63dc7	interagire con gli stakeholder
428075d4-09fd-4a88-9832-2ac746bd40c0	ecoturismo
429752ed-dbb9-4de8-b5bc-f91e1874d8b6	gestione degli ecosistemi
429d50cb-5f58-4c2d-9a42-0f97c431817e	etica alimentare
42fc6052-76dc-496b-8a79-2ec7fd5688bb	tipi di valutazione
437be8ce-f830-4f8b-bdcd-49f80bfdbe1d	valutare gli apprendimenti pregressi
43b1af65-487e-4aa6-8492-5d3fd21aa9f0	moderare una discussione
4428b3f1-04cb-4389-a73e-ca0159f4347d	fornire consulenza sulla riduzione dell'uso di sostanze chimiche
443aa367-402a-45b9-b896-f629abb29c67	sicurezza e conformità del cloud
44fab7d8-bd25-4e61-a11c-e778793f5e3a	tecniche di finanziamento del rischio
454870c4-c3bf-4d7e-adc2-7aa6238ce193	manutenere apparecchiature per l'integrazione multimediale
45c3fb48-5d76-4d23-8885-2174636c9821	conformità al GDPR
466e2485-b611-4ca0-a3bf-51b947b6cf24	organizzare esercitazioni antincendio
479aa393-23f0-4cad-a1af-03b62ebe59a4	obiettivi di sviluppo sostenibile
479c5c64-242f-4b52-b94f-203a28edab57	architettura blockchain
48bcd6f7-5cf2-42d9-80c5-84b2e1aa85fb	sviluppare architetture blockchain innovative
4906b7b4-aeb1-4871-824b-e3e63d36dbfa	adottare modalità per favorire la biodiversità e il benessere animale
4976f197-5c1d-4d36-896d-83a73a7ecedc	eseguire studi di fattibilità per smart grid
49e4760c-f946-4e2f-aa38-ff35c1194b5f	rispondere agli incidenti nel cloud
4a1930de-f7bc-4bb2-a03b-afa475027cbe	calcolare probabilità
4a4e9625-dfd4-424c-9ac6-8e1b64e174f6	sci nautico
4c1a6865-752c-4b57-9113-c5a3044efed3	standard dei sistemi di gestione
4c350f35-299d-4fea-91ae-7bcad9382931	sviluppare sistemi di visione artificiale
4c76ae72-4a10-424f-ba03-8a2b29cf8b75	gestire volontari online
4ca8c1ac-2de2-49cc-a339-c6b045608826	amministrazione di Windows Server
4cce947c-1ddb-480b-8437-fcd561588083	descrivere il sistema di trazione elettrica
4d00a599-c54e-497e-ba43-3be0bb7745ad	identificazione dei rischi
4d518792-1b0f-4c70-bb40-6955c833d9e3	promuovere la partecipazione dei cittadini alle attività scientifiche e di ricerca
4d52ca4f-23a7-4668-bc4f-407f7d5f60a9	tecnologie per le energie rinnovabili offshore
4d751d4a-4e0d-41af-8ede-f0bce2595963	sviluppo Android
4dc6844d-84ce-4439-bf4d-fb2fee87d1d5	valutare criticamente le informazioni e le relative fonti
4e00c6e8-1450-4ab4-a07c-3fc6fe7d2472	Elasticsearch
4e04cec4-7c8c-4db2-9147-cc7f5328bdf6	progettare modelli 2D per la visualizzazione 3D di calzature
4e2daa9a-6c07-4d09-a12b-1a2c15805711	applicare il ragionamento clinico
4e466f6e-0360-4cc5-baab-8ff4398294bf	gestire le questioni etiche nell'industria alimentare
4e7f1fe3-8e0d-4141-930b-3a037f428deb	pianificare le tecniche di formazione del velo per i nontessuti
4e93e847-8698-4056-8110-63f67f2929b8	industria dei beni strumentali
4edfe5b3-92da-49d4-8cf4-ea042fd316c7	mantenere la forma fisica
4ee001b2-9be6-483e-965e-66f086b337e0	sistema di controllo automatico
4f3ca817-3c6c-433a-bb89-517172791d84	crowdfunding
4f4b9db1-eed0-4d1e-b925-f30116fad23f	gestire dati e archiviazione nel cloud
4f8d18e8-195b-48e5-85fa-2f33a6af331d	qualità ambientale degli ambienti interni
4fdfef7e-c8ac-4448-95a7-52f73f4dde80	utilizzare sistemi di motion capture per spettacoli dal vivo
4ff37cc4-96f7-46fd-b470-034653a4ef47	impact investing
508f7c50-51e2-4435-bad1-b5630393eb9d	analizzare i tipi di calzature
50d0fb47-1b9a-414a-afbe-ced45ff6b4f0	ciclo di vita degli approvvigionamenti
50d8c850-2715-4c56-9f22-3ab1d24f4cf9	diffondere i risultati alla comunità scientifica
5139ae47-7abc-4642-b395-80808b9d0e86	promuovere i principi della democrazia e dello Stato di diritto
516abcb8-bd08-40c4-ba45-c18adc7b1721	insegnare windsurf
51e0b2ac-5ce5-448e-8fa5-5f88d2d79388	sistemi integrati cibo-energia
5281279d-a1c3-4fed-9e9d-9518c8507b76	dimostrare consapevolezza dei rischi per la salute
529690d9-b4c4-4205-9e5d-50d2f0e367ed	capacità di negoziazione
52b0cf95-52df-4785-9129-2e722420000e	sistema di gestione della tesoreria
53d14182-b926-48fc-8878-38d1ad03fed3	influenzare le politiche pubbliche
543d956e-1b5c-4e69-b915-cc802ba8ecd1	tecnologie automotive verdi
54bde084-47e2-4ad8-b06d-e6ef58a60e8d	verificare tenuta e pressione dei circuiti di refrigerazione
54cbbb9e-e353-4778-aba3-bc54fcdc0867	insegnare in contesti accademici o professionali
54fbacad-cbd4-4efa-9cd2-21692c7bb3c0	effettuare analisi del mercato degli approvvigionamenti
5520e36c-34cb-455b-b63d-c664d5c3eccf	utilizzare strumenti di simulazione aziendale
552a242c-bfb3-44a7-9c2c-3662e702aa34	analizzare le applicazioni decentralizzate
55fa2deb-d2a1-442a-90ab-d54340bd6a98	Prometheus
5620dea4-6c8b-4f72-9b95-74527854daa4	strategie di gestione dei talenti
57291a05-71a8-4e9e-912a-5a6f54671dbf	linguaggi di programmazione per smart contract
573aedd7-b4f7-429e-896d-9c6d5b3146ae	definire i cue di show control
574cbc2d-a5f6-4600-b703-36c65c5a5836	Google Cloud Platform
587f80b3-afd6-476a-9b0d-69312a78f4ba	sistemi digitali
589b28d2-49de-438a-8329-d88804d39a2b	produzione sostenibile
58db95ef-bd45-4a0e-bbcd-dd4ed6a956f8	diritto dell'UE
595e530c-2cdb-42db-8284-2166f97ffbd6	vettori di attacco
59c79ab6-397b-4a08-a4c9-dcac3e1f0b56	analisi predittiva
5a2d08bb-cf35-483a-94c8-8430065475f0	ISO 27001
5ad1cb20-d4ab-431b-8952-0e0efd96dd49	servizi web
5ae6d024-4a6e-4cce-9bf0-273442b5bc48	applicare il design thinking sistemico
5afe650f-eb48-4e17-a317-d6863a0ea610	riforestazione
5b24a9cd-1d47-40f8-8980-3b09239a8700	reti neurali artificiali
5befe559-479c-49ee-8da2-b753b2d0d92f	analisi delle cause profonde
5c2daa34-1a7f-4870-8023-2f67efa0bdc9	analisi dei dati sanitari
5c6755d0-4deb-45ac-9b15-25998a828af7	proteggere la salute degli altri
5c7c0227-871b-4542-b854-4bf0d77db880	screen reader
5c9a6827-c5f1-4456-bd79-d61e05eb770c	gestione progetti
5cf02f2b-3947-446e-8eeb-0f5fbe737748	sviluppare strategie di collaborazione interregionale
5cfb7381-f2e6-4b32-96d0-9df635ce9d49	raccogliere informazioni di geolocalizzazione in tempo reale
5d0bd583-b80a-404d-9661-01a9c95058fe	gestione orientata ai risultati
5d33977c-1113-44ac-b7a6-72628d83c2a0	condurre attività di threat intelligence
5d73363d-3ed7-424e-8b22-b849e111d550	framework React
5d9ed89d-e4dd-46f9-b507-196407e772ac	preparare la valutazione degli apprendimenti pregressi
5dda8f86-2968-4a06-a241-2ba7c18ab404	integrare l'energia da biogas negli edifici
5e20c143-cd6a-480a-8cfd-ce5338297597	proteomica
5e828ec4-c478-4ec6-b4f0-7fa516a288f0	progettare reti cloud
5e83ce73-b2cc-46c2-806f-2de67ea54665	sistemi di illuminazione artificiale
5ec21a72-ed12-45a1-a095-6b084933e368	scienze della vita
5f280c48-1c68-4d52-b291-8267e5044552	sviluppare la strategia di approvvigionamento
5f69fe48-3d3d-4f5d-8de5-fdfe1072e082	adottare metodi per ridurre l'inquinamento
5fd6a213-d9fd-4a5a-8427-9723d195f0ac	aeroponica
5ff26e4e-ce3b-4782-bc1e-5325ef4149ac	delineare la gestione dell'identità basata su blockchain
60163969-d127-46c4-8065-9f782bbdfa7c	curation digitale
60168beb-b3c7-4799-a181-da7e1f070066	effettuare uno studio di fattibilità sull'energia geotermica
60aa8a4b-d20c-43f1-ac87-8a85fc4cc7f8	gestione dei brevetti
60bc714e-a2bc-46ad-a7d5-4b1a61010171	adattare la metodologia di valutazione
60cc5b92-f330-4e8b-8bad-0cc7eff88242	innovazione sociale
60dc90e9-72b5-4957-a2ae-2ef0546b2c68	tecniche di analisi quantitativa del rischio
60df481c-d55e-4e04-b85c-3faf7c8d2579	mappatura del customer journey
612c83c9-39e5-40b8-a0e3-8a695cd85b29	energia marina
61381154-5cee-4b5e-82f2-ca8aa3b655cc	pianificare campagne di marketing sui social media
614c5756-4330-4ac4-8a4e-ada64d3414bc	applicare i principi di etica della ricerca e integrità scientifica nelle attività di ricerca
6216427a-0203-4e13-97c2-b75bf7d87f27	fornire consulenza sulla riduzione delle emissioni di carbonio
62b660f5-999d-471a-97db-8f15e619b971	sistemi fotovoltaici
6335042d-e561-408a-bf0c-853b2a35551a	implementare la gestione del rischio negli approvvigionamenti
63fc8d6a-152f-4675-8047-c1ed6d7fe0c9	valutare la progettazione integrata degli edifici
644d4100-5611-47df-ac94-02a11436229a	individuare software per la gestione del magazzino
64d0d6a5-f77b-4aa9-989d-5860ac8e2eb6	glossario commerciale dell'abbigliamento
654ef309-bf51-49c7-957d-3a13f599fc2a	tipi di celle a combustibile
6580125b-1496-49ab-9c98-d4419cdf1822	risparmio energetico
658dd58c-8ca7-43a9-908d-587f3f4e53ad	criptovaluta
65c8d8d0-094c-4619-a5c2-aee52d9c1578	utilizzare un sistema di gestione della flotta
660be223-eead-4631-a91a-529674d328e3	Angular
661a30bb-aeda-4ea5-aa6b-bfde46145f6b	chimica computazionale
668814b8-90ec-4575-8189-da1ffc6b7ad0	analisi dei dati
66f9d6cd-350b-4c3c-8924-d52356c898c3	ingegneria dei materiali
673bb926-99bf-4ad3-b53b-8fa4624cdea3	riconoscere i rischi della blockchain
67c2be1e-45e8-4d3e-ba24-edd40a21ad4f	tipi di generatori a corrente di marea
67d8b315-a329-44c5-89d6-363ed4da822a	processo di fermentazione dell'aceto
6837f7b4-ccd7-442c-a046-2b8b7fd5e913	seguire un tech pack
68ffa1cc-62a6-4a47-9d94-c588e1d2689a	effettuare uno studio di fattibilità sul teleriscaldamento e teleraffrescamento
691b0093-919c-40a2-b2f5-d61cd8932039	architettura dei veicoli ibridi
6928d946-442b-4fcf-944f-94554849a9f7	bioeconomia
696c9c90-128e-4971-984f-3b9bb57e2059	gestire i diritti di proprietà intellettuale
6999afdf-d939-46d6-a0bf-3b1c342aac62	energia geotermica
69cc05fb-4a75-42cd-8077-3834524bdbdb	valutare i sistemi domotici integrati
6a11a051-45aa-4122-b09a-f48c38de4591	normativa europea sull'omologazione dei veicoli
6a7cc159-aff7-419e-80db-a10a358feabf	tecniche di riflessione personale basate sul feedback
6a8bbb06-21e7-428e-ab71-29d1b76c4034	commercio elettronico
6ad87ee5-19af-4e07-a08f-d8467a08bc5c	progettare sistemi energetici di teleriscaldamento e teleraffrescamento
6b0999d9-0f58-4ff7-accd-67c2fb691c90	utilizzare la modellazione agronomica
6b0ec470-e10b-4057-8665-1b4fe8a6f217	automatizzare le attività nel cloud
6b10c789-a213-4630-99ad-999ffa5ff6cb	applicare tecniche di bagnatura e asciugatura alternate
6b308298-da40-4a50-aa0d-58ed0e19fb15	eseguire test di ingegneria sociale
6b3b9d45-860e-4a86-9df9-c8fd9f16da66	sistemi di involucro per edifici
6b76b602-1f7e-4693-8804-7bfba85d0997	frode alimentare
6b7f238f-dbcb-406b-86ce-6c03a7cb495a	gestire i dati di ricerca
6bbfaf37-c92a-425c-83f2-55d174022c3c	progettare un impianto di riscaldamento solare
6d224eea-9a6f-4fdb-bf0a-2b412e8a13eb	configurare sistemi di integrazione multimediale
6d33f7b6-6654-4c69-b5fd-3c8020605156	amministrazione sanitaria
6e29f16a-562e-466d-a45e-7c206d0d988a	implementare la sicurezza e la conformità del cloud
6e2a07aa-72f2-40fa-acd2-9c9023306fce	sostenibilità urbana
6eeb488a-ce46-4cff-8550-1c16c199941e	community management
6eeba6e3-aabe-4e0b-af24-c369da1f0f99	adottare modalità per ridurre l'impatto negativo dei consumi
6f194b81-1053-464e-b369-30f86ad55f2d	utilizzare hardware digitale
6f3800bf-8110-423b-a344-8a944ae01205	attuare gli appalti per l'innovazione
6f49a225-72b6-49c2-acac-6e126f8cdc5e	progettare il concetto di isolamento
6fa356a0-73ac-4c5c-81cf-f7e3b60626a4	ridurre i costi di mobilità aziendale
6fe6c88c-8d41-430a-b3cc-37871f539f47	utilizzare impianti solari termici per acqua calda e riscaldamento
70adcc26-0d18-47c9-a3e7-63657e889ce5	deliberare sui risultati della valutazione dell'apprendimento pregresso
70c7cc78-0521-401b-a1ce-01f29491a823	eseguire il test PCR per il COVID
711f8f79-de1b-4be8-919e-e0cf8e6b2157	costruire la fiducia
7156a485-09a9-4698-81d6-3c588af07e2a	antropologia economica
717485a4-054d-442a-ad83-1a42a26417a5	containerizzazione con Docker
719d3ace-58e2-4afe-b2f5-5487f557cd94	supercalcolo
71ac259c-7e28-46ea-b054-b4166765f5af	applicare le conoscenze delle scienze sociali e umanistiche
7202e5b7-94ee-4377-bcda-f425f518bff7	creare forme per calzature
7229c4f6-de14-4f11-afcc-c74985a43d5c	normativa sugli aiuti di Stato
7256a70c-7955-4e04-9f8a-b69b53ca1e50	gestire la documentazione delle valutazioni dell'apprendimento pregresso
728861d4-2f3d-4e1b-83c1-d83c52808082	genomica
72c51165-998e-4954-88e9-b523fecc8eae	applicare competenze di programmazione di base
738eef0a-b969-404c-9a97-42ab3b666eb0	mentoring
743bdd92-540d-4576-b7f0-c9a511984762	green bond
7451524f-cc18-4962-ad76-d264f5ddf691	comprendere il lussemburghese scritto
74b0d7c3-c95c-401b-8326-9d60a147f241	pianificare la migrazione al cloud
74cf8ea1-0e92-4e4a-b067-ccad40d58572	ricercare ubicazioni per allevamenti offshore
7501dd5a-5eed-42d7-b198-90795fd04e2f	documentare le valutazioni dell'apprendimento pregresso
750ebed9-99db-4a4c-b686-d91cd8fe3fe4	pianificare la valutazione
755d6e9e-ce0d-46ad-8f3a-e6ca57b5da68	protocolli di consenso delle tecnologie di registro distribuito
75bccd8c-9cc9-4551-80af-9db0608552d4	stabilire relazioni con i giovani
7612fad2-a8aa-4364-a750-e14a1fc59a3d	formazione clinica basata sulla simulazione
7638b73b-c6de-4bf2-a2e9-96d70d2245bb	costruire reti di contatti
764886e3-49ec-4ca2-a3fd-d924d8f2792e	chirurgia vertebrale
7656eff8-6f3e-426f-bfc2-a069ac2be141	utilizzare la intranet
765b5d27-67fe-41d2-8a8e-f80f9d2a7639	fornire consulenza sugli impianti di ventilazione installati
76c7cf27-f390-4bdb-a3fa-4d45383ee118	sistemi di reti elettriche intelligenti (smart grid)
76cdc4d4-85e1-4696-b88d-56db8cbac7ac	digitalizzazione
77320fcc-6579-46fa-be23-50797f42d296	condurre studi di fattibilità sul riscaldamento solare
7762bc66-b7f8-45cb-aa99-52ac869b13e7	applicare standard di qualità nei servizi per i giovani
7771f718-23c7-42ad-b2be-71845345c2cc	sviluppare l'orientamento alle prestazioni nella pubblica amministrazione
78598055-192c-4d31-8190-15564d1592cb	Machine Learning
78769f15-ced9-4f8f-a83e-f18d98a96b04	creare una campagna di crowdfunding
788e74d8-92cc-48fc-9618-0d35f3602cb1	determinare il sistema di riscaldamento e raffrescamento appropriato
789008b2-a12d-4dd2-b260-f7e41c1827bf	analisi empirica
78fc3f55-75b4-4f98-b88a-3cf49d25ad17	esprimersi in modo creativo
7966738b-1ccf-44c4-aa25-73f48bdda874	generazione minieolica
79d10d4d-dfc2-4d62-88aa-cb45b55fcc9c	stimare l'impatto dei rischi
79d6a70d-5573-49e9-842e-2e0a78148fe9	meccanica del continuo
79e09e5d-2f83-4cf3-b561-a05e8638b035	eseguire imaging pre-trattamento
7a0bb93a-ad77-4831-8903-084c6a856286	condurre uno studio di fattibilità sul raffrescamento solare ad assorbimento
7a3cf833-28a8-4c23-84f2-c99f82bd2aa7	Grafana
7a6c822a-e7a1-4283-931a-4bc5f1c433a4	caching con Redis
7a99a92e-b44f-4fcd-a2cb-6b37a89ebee5	proporre ingredienti alternativi per mescole di gomma
7afa4a03-7174-4ee8-8ae8-f00577fdda57	gestione di programmi
7b1b6269-22cf-46cb-9263-4a9a622f4a06	condurre analisi competitiva online
7be33aae-6112-4f5e-abdf-b92b33742b65	progettare per la complessità organizzativa
7c2fdff6-6f3d-4e7a-8fea-c96b94b1fb88	strategia macroregionale
7ca43ac5-f9f5-4b32-83d9-a2e73d704cc7	identificare i processi chiave dei sistemi di tracciabilità
7cb5446d-3193-45b0-b407-5acd73cfb527	sviluppo frontend
7d0819e9-4d53-44b7-9de1-85cd902dfe0e	dimostrare competenza disciplinare
7d0a5ad8-39a1-4ab1-ae3c-822a875755e9	formare il personale alla riduzione degli sprechi alimentari
7d299142-9574-4541-92ac-a9675e5844ce	organizzare riunioni di progetto
7d2bdc4f-b332-408b-acac-6f512155fa46	fornire formazione sullo sviluppo e la gestione del turismo sostenibile
7d657273-649d-422e-9a93-56262e6ddd0d	metodologia di project management (PM²)
7da5480f-b4e8-4ee2-8d44-35d96377420d	gestione costiera
7de2d80d-ad34-420d-aaa3-866197cf410b	adattare ausili per ipovedenti
7e3ee7cb-bd17-41c8-b62c-4b71374f23d0	ripristino degli habitat
7e6962bf-6cae-4e1c-a9e2-5786aaf96cf3	progettare un sistema di cogenerazione di calore ed energia
7ed72878-3504-4acc-9c8d-98c5b6e1dee7	responsabilizzare i giovani
7f04f2ed-13b8-4c59-a52d-d390d951d7c3	alleanze sociali
7f753964-5dbe-4c50-8572-42110d3edde5	monitoraggio e reporting cloud
7f98089c-d6ef-4261-9509-bf8d7cbb4e75	componenti per illuminazione a LED
7fa4d7aa-1f0d-4c38-ae93-2a3659e9ad52	servizi di traffico marittimo
805cae58-2ceb-4277-bd56-917bd2cfb650	iconografia
8092ea38-6eb6-4d0b-81c3-5fc6c12accba	agroecologia
80d054a9-00fa-4be8-9899-134e0bf4e882	Angular Framework
80d0f4d0-7090-4724-8183-5ebe3f33d851	psicologia dello sport
80f0a7e9-2f8d-4c6b-8deb-df77984df486	applicare conoscenze di filosofia, etica e religione
812cf3eb-a5d7-441f-9a5c-15e464e124d1	utilizzare piattaforme di e-tourism
813a9cb8-5b0b-440d-a758-e77758571c4a	diritto canonico
8182e109-4c58-43a2-9654-c61e95ff026f	agroforestazione
81a8619c-22b2-4de5-815e-81be4c483b0f	procedure di condivisione documenti
81bb68dc-87d6-4834-981c-01d3d3b1b063	biologia marina
81c49d14-1e3c-43ac-b6d0-8222eabf0499	definire profili energetici
81d20140-3dff-4267-9b99-9b6217504a7d	pensare in modo olistico
82278484-33f7-4106-9f67-c0f1836313f0	progettazione UI/UX
8293a0b9-beed-4f54-a682-e4e203bffe8e	progettazione integrata
82b240cd-adb8-40d2-b605-18926e0d542a	modellazione matematica
82e0666e-251f-424b-9e62-f263f8ff1883	eseguire incannulamento venoso
838d49ea-6f04-49a1-b139-6f6cb0a24711	marketing dei servizi
8467c440-79ee-4192-b9f7-e67aaa89bea7	fornire consulenza sulle malattie infettive
846919fb-0aba-4eba-88e5-6500b2e3f14c	distribuire risorse cloud
847a41a3-2285-49ef-94d8-cb005d75d986	verificare la durabilità dei materiali in legno
84a3b015-96c8-45f0-9d56-2eeeea656115	diritto marittimo
84e7d473-fcaf-41b2-b03e-cd789a607e42	apertura della blockchain
84fd2a9a-ebd6-43d7-8bae-13712213c705	principi di sicurezza delle applicazioni blockchain
8536bb2f-bae0-4f79-8595-547a4db78105	gestire i flussi di visitatori nelle aree naturali protette
85c9d732-a0f7-4512-b0d8-3d818b633240	normative sulle telecomunicazioni
86161f74-6ba4-474c-bec5-3474b51f8182	gestione del rischio aziendale
86532ba3-d8a4-403a-bc22-95bd2595f43c	svolgere attività di progetto
8657c1dc-4957-4732-8393-055c6465c808	BPMN
86694684-4108-4771-88ed-9ebbe4f5e627	monitorare il follow-up delle raccomandazioni
86786b86-6c16-4113-8569-43128b35a62a	costruire lo spirito di squadra
8687f302-7edc-4c33-84fa-9dba88a8e0f7	valutare i fabbisogni di approvvigionamento
8697297e-6806-4e31-98ee-b8e537783d10	ricerca multidisciplinare
86a22a33-4e73-4726-a593-13b1da11c6a7	filologia
86d38cd4-5ff7-40d3-a9ad-38cfcc166357	promuovere idee, prodotti, servizi
87620e71-8b7c-4f7d-b295-29a41208efc5	competenze specifiche di categoria
87fc7ac2-4dba-4441-97d9-9e6eaedcc585	ricerca e sviluppo industriale
880d235a-57a7-4dfc-9ac5-5ec9fa49d7e1	eseguire il refactoring cloud
885767d1-4693-4459-b62f-1e1485adf4f7	normativa sugli appalti
885a116c-045d-4813-b722-389d0a27d1ce	materiali avanzati
88dc04b1-83b2-4aee-bb6a-e0c5f44624d4	mantenere i confini professionali nel lavoro sociale
89015f88-a098-4314-80bd-45c9ad858351	consulenza in materia di sostenibilità
89bff713-d85a-4d58-a49f-28fa0d657561	analisi di marketing
89ee8276-0123-461f-8753-013cb2ed248c	fornire servizi di gestione dell'omologazione
89f4841c-4183-4197-ba5e-516100669a94	building information modelling
8a0da663-f63c-4e88-9211-0e3cd210652b	tipi di legno per mobili
8a0debbb-e5a2-4e74-a550-5390d88f9f1f	museologia
8a4c4ccc-7ac7-4e00-afe1-148f473fcb41	comunicare con un pubblico non scientifico
8b23ed68-30d0-4dd2-9729-af5f6a1a847a	Adobe Creative Suite
8b308ad1-9b84-462c-b077-14646b623c9e	visione artificiale
8beacc25-d32a-4fa7-9cc3-e00f343dea6e	gestire le operazioni di concia
8c08ff3e-2bc6-48d9-85db-15c5469e5e1c	impostare programmi di formazione sulla cybersicurezza
8c77faf8-9036-437b-aeb4-02a4eac5ab68	meccanismi di consenso blockchain
8ca209ca-fc53-4704-afc6-19cb4a57ba32	gestione della configurazione di progetto
8d0c0bb8-d746-4845-98be-281054f78e55	imprenditoria sociale
8d650a94-c91b-4250-aa93-849892e05077	finanza sostenibile
8dc1a8f7-e8b7-48da-bde2-6d6f5535c3fb	mostrare spirito di iniziativa
8f4ffdfb-2358-4b20-b76f-f242833e666d	illustrare le implicazioni della blockchain
901f5902-80f3-48ee-a77c-b8c0efa11df7	social bond
9097d4ef-ac0b-4771-a9a7-65959dfa2def	analizzare i casi d'uso della blockchain
91eae650-89e2-4508-a49d-ed83d8d4afc0	apprendimento linguistico assistito da computer
9220094e-d413-4498-a727-5f1ba92c18e6	strategie didattiche
924eb1ae-4ed3-4dec-9d21-28f2f997c2b5	progettare un sistema domotico negli edifici
93c2b1a3-6753-4d58-b47b-86c5ea8a4aaa	Solidity
93d65e9f-2e46-407b-b588-284e37a946ef	eseguire un'analisi PESTEL
93f4ebd7-e805-4861-bd0c-db5349675bf8	fare un uso consapevole del sistema sanitario
94bfa33c-e861-4701-b42e-49a97edc640e	e-agricoltura
94e89ac3-0e11-40e6-b54a-6894b01b5bab	modellare l'elettronica di potenza
9540f56f-b483-46d2-82eb-b5b54addb629	ingegneria navale
9572531f-73f6-4973-8fdb-52582966a6a3	badminton
95a18dc4-6834-4db2-a773-540df31ee774	distribuzione di riscaldamento, raffrescamento e acqua calda
96104ff2-7d03-476f-846d-538807297b5c	procedure standard della difesa
963e1b6e-d225-4d51-88f3-199f6e7fb748	idroponica
96a61dba-64e9-4d34-8324-5425df76b26f	formare volontari
96bfe6c6-227d-4a49-be82-f4575a6a727a	progettare sistemi di involucro edilizio
96c26661-c4b6-41d2-b552-92f2bc6812cd	bilanciare l'idraulica dei sistemi di acqua calda
96e1bc4e-fd2b-4c81-9990-7ddc09f5d808	valutare le tecnologie di produzione dell'idrogeno
97703bb2-804c-4146-97ff-105c422bf276	migliorare l'esperienza di viaggio dei clienti con la realtà aumentata
981c5134-c4f3-4958-9ee3-a381c378ad46	salute e sicurezza sul lavoro
982244ec-dcf8-4aee-a730-202468613344	sostenere il turismo comunitario
98257c22-c679-406e-b0e0-a6af66295cb2	progettare un sistema di illuminazione artificiale
98e18d5c-06e1-4112-a581-74b154a4ec5c	eseguire uno studio di fattibilità sul mini eolico
99c3ecab-187d-480f-b879-9e52183f375a	tecniche di campagne pubblicitarie online
9ab76a58-4e6b-4b8c-8aaf-ce248bb8dd40	raggiungere giovani provenienti da contesti diversi
9b1500a5-b6e1-4955-b9b3-3e2289bd3df7	sistemi domotici
9b1b08b1-6dbb-40d3-a364-b760d2591528	misurare la temperatura
9c591e8e-11aa-4743-954c-f1fccaa4c51e	architettura a microservizi
9c642a9f-3234-4b04-8b7c-62675088ca78	sostenere l'autonomia dei giovani
9c6924cd-aec4-4c0b-9529-7da0d2521723	economia matematica
9cace21a-076b-4599-913e-93c34f2fc867	eseguire uno studio di fattibilità per sistemi di gestione degli edifici
9d005c78-6d06-4300-a835-8234de03bca0	fisica computazionale
9d0d041e-ed63-4f44-8ebb-fe708906b8a8	sviluppare strategie di riduzione dello spreco alimentare
9de4061b-78a2-40d5-a648-dcdcaf914c72	manutenere sistemi di produzione additiva
9e76d257-567c-427c-9302-1f6035765b8d	ingegneria delle reti
9ea1e0ea-6382-457e-8d47-cbaee3980c1e	configurare l'archiviazione dei media
9ee250ba-3b7b-46c0-b91a-662626b3c883	sviluppare soluzioni di mobilità innovative
9f5d3f48-fa18-4826-8992-0c5b04eec9b4	omologazione dei veicoli
9ffdaf7b-af43-4a6c-983e-374b938f16cd	gestione patrimoniale
a01622e3-af39-4ddb-b36b-b3a5aa74c4f1	definire indicatori per la riduzione dello spreco alimentare
a0650ff3-6a2e-415c-a9fc-8b9755243c90	economia ambientale
a0787723-ce44-4cb7-b8e6-b75aa6858ed1	valutare il gruppo propulsore
a0a80417-cf41-408d-a115-bc996ac2d32f	pensare in modo astratto
a0b76195-62fb-40b8-b861-4fcd1aa2686b	ispezionare i convertitori di energia dal moto ondoso
a149f4bc-f6b5-4837-81d8-8fea45007fa1	tecniche di analisi qualitativa del rischio
a14b4fbb-95b7-449c-8345-f270eb25178d	sviluppare dispositivi scanner per alimenti
a15cf85e-dcbd-4fb4-a3a8-1094dc08aa79	partecipare attivamente alla vita civica
a16421a5-60f8-463b-825e-13a3dd63121f	fisica matematica
a1671d43-b66e-4202-a809-4b36c7b8f0b0	condurre ricerche sulla prevenzione dello spreco alimentare
a1ebd17f-bb7a-4a57-927d-140f02d700d1	ingegneria dei dati
a26376df-9b29-4665-9994-4304d0dd003a	progettare installazioni di pompe di calore
a27fb1c2-c462-410b-97bf-d20eac2d202b	attuare approvvigionamenti sostenibili
a35dcd0a-8cd5-463a-b0bd-1d66bb4c4721	gestire reti TIC temporanee per spettacoli dal vivo
a3822e74-6992-4fb4-8242-b3c81174307c	eseguire simulazioni virtuali
a38a8974-dcc4-46ab-a39f-6b007efc7a58	applicare procedure e normative per l'etichettatura ecologica
a3c4c512-0998-403e-8a1e-3167110edd98	riciclare il letame del bestiame
a3cbdf59-1e33-4b92-a111-88546bf82e07	sintetizzare le informazioni
a49ef17c-9d6b-4751-a877-4f2c9c55a42a	candidarsi a finanziamenti per la ricerca
a4bdfdc8-e4ce-4ecc-abf5-18ecafc6b80e	promuovere l'uso del trasporto sostenibile
a5c6d97c-e4d0-4a82-bfc2-98f473f28d9f	design thinking
a63926fc-05c2-426d-b031-077fba326484	sviluppare attività educative non formali
a68dbece-4371-4ff1-baad-25d65dd86e45	architettura navale
a75062f5-68d2-4826-9cc7-cb30e73b8cd7	pianificazione territoriale
a76c479a-3f99-40df-9769-2f45d011d2bc	selezionare il dispositivo di immobilizzazione per la radioterapia
a786af15-07a5-47e9-ba90-4f081319f426	gestione delle operazioni
a7b44021-c802-41be-96eb-084ce56f7045	risolvere problemi
a829e917-f53f-4098-9bdd-391fef02f92f	promuovere l'innovazione aperta nella ricerca
a87cb2d1-ccf2-4220-963e-e9c08c95f747	definire la roadmap per la blockchain nelle applicazioni
a8d0fc64-488d-45fe-b667-c0cb31188b00	approccio incentrato sui giovani
a917c130-0888-4a0e-8dff-df40c7e580c7	filantropia
a9219307-e53d-42b7-8b48-730e0632194c	monitorare la conformità alla metodologia di progetto
a9310fe9-b72c-43a8-932e-e5d6bc26b771	riassicurazione
a943365f-4d78-4c9f-9837-ab030cac8a44	rispettare le normative
a95b45a9-be02-4255-a20e-b7ca5f7e257c	gestire la propria progressione professionale
a96b56c1-c139-4c63-960d-f77e8d4a50e1	utilizzare l'e-procurement
a98b86be-9f3b-4645-9c5d-d1110106754d	servizio sociale clinico
a9ad2752-e2e5-41b6-ba69-210bcbc718be	analizzare i prototipi 3D di capi d'abbigliamento
a9f66442-fca1-4a9b-9ec7-a05ecba0604b	Kafka
aa46e040-875d-4720-9cae-e5800e0ee54d	fornire consulenza su tematiche di energie rinnovabili offshore
aa4c1951-af13-485a-923a-4e520caa79d7	gestione della compliance
aa4d3f15-18fd-4a1b-898b-0e1c55af9a38	fornire consulenza sull'ammissibilità delle spese
aa5528d5-10dd-4b54-bea3-f593905a81aa	implementare smart contract
aab754a6-4b26-487d-8f21-0bf4f8b1fd83	fornire consulenza su soluzioni di sostenibilità
aac98484-06de-4d0a-920a-20edf5fc875c	fornire consulenza sulla procedura di omologazione
ab675259-ddb5-4973-a382-cea88a2e7bf7	energia alternativa
aba8b410-c504-4f42-8831-f645b76a42ef	lingua tedesca
abb3721e-6b5e-40aa-a859-41c5050d0ae9	mantenere un repository centrale di progetto
ac1627cd-75f9-4c29-8ba0-74406ef30e42	biologia computazionale
acce9dd3-6a3b-4ec4-921c-c3911ceb57a4	implementare un sistema di gestione
ad3da53c-8f4d-40d7-825e-a1b9f36be27e	progettare impianti a biomassa
ad791534-87d4-4e02-aef8-1744d882eece	distinguere la qualità del legno
ae2ec097-ca71-491e-a582-34ecbf98b681	elaborazione digitale delle immagini
ae3d0359-7122-418f-ae3d-0888f86e082d	applicare tecniche di lavorazione del suolo sostenibili
ae476ca2-157e-465a-86b4-7d53d28a64f0	condurre operazioni di riviera (beamhouse)
ae82fecf-c8db-4ec7-a25d-84caf9288a25	spiegare i principi delle tecnologie a registro distribuito
aed7170e-1060-46e9-80d0-6d35613ac041	energia da biogas
b01d2f25-8d29-481b-9d2d-3dea963443fd	gestire le pubblicazioni ad accesso aperto
b0b82555-fd40-4245-9a27-2f722ccbdc30	software di core banking
b0d11f8c-6225-449d-acf0-3ceed3ebe2c8	utilizzare attrezzature, strumenti o tecnologie con precisione
b119f441-f36f-4dc0-b23e-1f8ba7594fea	sistemi di energia geotermica
b1980f8d-6df5-4c72-82fa-9319e8d75899	meccanica dei solidi
b29a5914-51f3-4400-a449-ccae9a1abf27	condurre operazioni di riconcia
b2db57f1-7216-4294-9cd9-3f21d6a3bb3a	materiali da costruzione sostenibili
b319cc81-8d1e-48bd-9396-f185a0762ae5	standard globali per la rendicontazione di sostenibilità
b32deb0f-dd9b-4eef-ae8b-87b48a849f4c	istituire un sistema di gestione della sicurezza delle informazioni
b33fe046-3b15-4167-a17f-b17c026673a4	giornalismo digitale
b375a2e3-f5a2-4af0-ab21-73990d583970	storia della blockchain
b383e5cf-3bd8-4c8e-b656-df64103de661	gestione forestale sostenibile
b3b16c45-3d6f-4ab6-ae19-a4b62d3df289	progettare sistemi di finestre e vetrate
b3cf6436-18af-4ada-9470-4609eb9e26b4	calcolo scientifico
b44b6b11-b009-4c72-bddd-bd92ef223800	teorie sulla sicurezza del paziente
b4626422-aa8b-4464-9104-4376d8525ab1	effettuare uno studio di fattibilità sui sistemi a biomassa
b479b79b-e347-4388-8903-4ab2dc1956af	diritto privato
b4891eea-5f8a-4230-a132-fa0e69d41158	determinare i parametri di qualità dell'aria interna
b4c7c7fe-9e9e-4d9d-b083-71505ee74a95	geografia culturale
b78acee4-9f68-4d1c-a062-d50364c743ab	seguire il codice etico nelle situazioni di valutazione
b797e2e3-df6f-42a4-8e0a-da447f558b75	coinvolgere gli altri in comportamenti rispettosi dell'ambiente
b81d4994-8b61-4f16-a428-4f0311b315c6	formazione delle batterie
b843b456-56c7-4dec-984c-d1ec7acbab02	lussemburghese
b8c0df34-4de1-4c74-b775-139f1a7b161f	SMED
b8e1b5ff-e0ad-41ee-a74f-e48aa261bfd1	misurare la sostenibilità delle attività turistiche
b9382ef8-283f-41f1-81a7-5f0266cf553c	valutazione delle tecnologie sanitarie
b994ebe2-00e1-47e0-8507-6dd035db920e	Tableau
b9f066d1-133d-457d-a0dd-394bc351b50a	prendere decisioni basate sui dati
ba05ff43-2d1b-45c0-a3d3-35ac7f02b87a	redigere le specifiche tecniche di approvvigionamento
ba7af18c-c667-4a39-a7c7-96e22edf60ab	prodotti solari
bac158b9-ed31-4411-9a2f-7f35d1ac7015	tecnologia della gomma
bbaefcb6-f67c-46fe-8f97-6257847cd329	condurre interviste di tracciamento dei contatti
bbbf018e-c9bc-42bb-925f-73e524612d96	tecnologie assistive nell'istruzione
bbc28104-2d8f-4bfc-8ca2-844c28983881	cogenerazione di calore ed energia elettrica
bbd9ca21-cef1-454b-9204-b3f4ecac6f1d	olografia
bbf44dd2-871d-4fbd-a75d-fc59fd0f924f	piattaforme blockchain
bc53a09e-f2fe-44f5-adc8-c5846fe0fca3	Vyper
bc7b9b2c-7a72-41ba-8ddf-ee339a59666d	pianificare le operazioni di rifinizione della concia
bc97166d-37e6-488f-bee2-fef13b85b925	dimostrare impegno
bcedcb3c-350d-4edc-bfbb-0575074871e4	analizzare i microclimi degli edifici
bd868335-24a2-4138-ab12-d098b4a13df6	sistemi operativi
bdd95f89-8339-480c-9292-75e358fb70d8	implementare costrutti crittografici
be562b1b-8c27-455c-b2c5-bbcf7c6cc4eb	sistema middleware inter-organizzativo
bef27855-8140-4d2f-a3ff-189a3aa5ed11	psicologia sperimentale
bf8f1ef4-f1fc-4d31-8a9e-230011ad078d	azionamenti elettrici marittimi
bfcf0fac-5e62-4fa5-83dc-72cfdc894587	simulazione Monte Carlo
bfdbdc81-defe-47bf-8645-66f8849dd003	tecnologia quantistica
c04e533c-69eb-42a5-81b0-3fb5900bf520	redigere articoli scientifici o accademici e documentazione tecnica
c08483c1-4f54-43fc-bc87-e6794eb2244f	installare impianti di refrigerazione
c1d6bed6-72e9-4892-ab4b-8776e3ac1b04	fornire assistenza infermieristica in contesti territoriali
c201bf3c-239d-461a-b209-21da70f8177c	guidare i discenti nell'uso delle tecnologie assistive
c2e5ca5c-351e-4d02-ac8c-3b23033c3361	Sviluppo Blockchain
c367eed9-252b-43b5-a842-7479d0270447	tipi di convertitori di energia dalle onde
c3a90c04-655c-44ee-9f0a-47e8609dbf9d	Lingua francese
c3c95dcf-6d39-4222-a3f8-8b39451f89f0	reagire a cambiamenti fisici o pericoli
c3da7ff7-6385-4bb7-8d7a-0c41d4faa0a1	creare contenuti digitali
c3eee294-64e7-41ce-ac65-518f40e56407	utilizzare materiali e componenti sostenibili
c3f00f26-8da2-4e52-abd6-c6de525ea558	industria dei beni di consumo
c40fba67-328f-44c1-910f-c80f870680ba	tecnologia a registro distribuito
c422fb86-df07-4a0b-90ce-776b129c0b3c	studi politici europei
c42516b1-4caf-484b-973e-db8774173bab	Collaborazione interfunzionale
c4260738-85fc-4e30-a8d1-b4a9768fe4b7	gestione dell'identità digitale
c4b3d397-4bc8-49a7-a7af-682e23369727	erogare formazione su framework di monitoraggio e valutazione
c4b8a945-a8dc-4b56-88f2-3d75be71bc2a	valutare le offerte di gara
c4ed0f36-c7ff-4448-88b2-61a699c4f80d	gestione integrata dei parassiti
c51b6824-4c0a-4407-b85a-84e9ee5489cb	gestire i servizi di informazione per i giovani
c602c9e5-b03c-4966-9639-1612ce22fb7b	pubblica amministrazione
c60d4a53-b233-401a-9905-724a247f1a34	Backend Node.js
c61be8aa-f27f-4430-8c61-3b1d0abde73b	gestire la distribuzione di segnali wireless multifrequenza
c69740ee-d258-4878-a9ec-0da815c9bc72	base di conoscenza
c7123973-1da8-4f3d-8308-cd7f418740e9	installare sistemi di energia rinnovabile offshore
c78a9995-74a3-48b7-9d5f-2494205bc162	identificare l'imbarcamento del legno
c7960715-cb00-4c8e-9226-0feca2ae6b9e	sviluppo delle capacità
c883ee35-0d39-4b11-ba38-90a19b3ccf19	carburanti alternativi
c8951ef7-c3ca-4579-8ae8-af498a563b66	educare al turismo sostenibile
ca834bd9-e2ab-49d6-bc5e-06ffb5d9d65b	strategie di sviluppo rurale
caaf4875-a76b-4ffe-9a5b-18339825431d	utilizzare tecniche di visualizzazione 3D performanti
cad000d9-28c4-47d0-8fb1-d33b49389c31	analisi quantitativa
cbd8a163-4f6a-4be8-a795-33c4c4ad06a7	progettare un sistema di gestione degli edifici
cc454dde-de87-4e2e-a33d-925533db0f99	Gestione di team virtuali
cc6262eb-bb81-4e09-b0dc-135bb29806f1	fornire soluzioni per auto connesse
cc799222-7369-4d88-878b-a7406953522b	modellazione del rischio
ccc4a653-1417-4754-8345-0545e9657f39	paleografia
cd146364-5c79-4c81-86f2-321f61c84596	tecnologie efficienti nell'uso delle risorse
ce77d6bb-6413-46fa-ac91-86b42f4b9a7d	business internazionale
ceb0a958-754e-4e75-ae3f-a53df074895e	realtà aumentata
ceb17405-8fc1-4380-906d-b3f2ad607b8c	apprezzare le diverse espressioni culturali e artistiche
cef1bf95-6ded-4479-ab79-3261f3c2ede6	progettare architetture cloud
cf181576-d484-4f63-8a66-c86d8179cea5	configurare sistemi di integrazione dei media
cfc440c2-1911-489a-930b-e2443ac8563c	tecniche di modellazione statistica
d0b25329-6775-4490-ad1d-12f80ec0add7	metodologia 5S
d0be9161-6719-41c7-b7d7-5d810859f7ef	applicazioni blockchain
d0f41aef-34e5-4612-8e33-9a69d34c981e	economia dello sviluppo
d1433575-8902-4eef-8877-f912ce646634	simulazione al computer
d1a861f8-6cd1-4dc5-aa21-ed0d265eed18	sistemi di monitoraggio degli sprechi alimentari
d22ccbc2-0574-4329-a0b4-b4644dd91848	pratiche di edilizia sostenibile
d2ba0aa3-48e6-417b-b239-2d2c7bbc3f5a	pianificazione strategica hoshin kanri
d2e36104-8cb8-4201-872e-fab236755977	maneggiare polveri metalliche
d2e40ea5-407e-46a1-a4f4-5d35cfd68ce2	investment banking
d360d8ca-6393-4bec-8706-d3b510cdf301	diritto delle convivenze di fatto
d43a3430-ef45-44aa-8301-eb2c6cd0073a	framework Vue.js
d44b7f5f-67fe-4426-ad6d-f05e65b07111	applicare procedure di certificazione e pagamento
d47a972e-e99e-415e-a294-225f29f1649b	sviluppo sociale
d55f056c-67c0-40a1-b752-0caaf19eabdf	media digitali
d5648b1c-4772-48df-8f76-c5153cfaf69c	realtà virtuale
d68c568a-0aec-4740-9673-9db3203107df	progettare sistemi energetici offshore
d7635c8d-b7c4-4934-984c-4dcb004f627e	mostrare imparzialità in una situazione di valutazione
d82af90d-6c57-401d-a1a5-1581fed6db78	rispettare gli obblighi di riservatezza
d865d5e6-fc67-4409-a9c0-52f99b4d8cdf	valutazione della strategia web
d8a93d88-4552-44c5-b1f2-43bda5365dfb	gestione di database SQL
d8fbbcf9-968b-40dc-aedb-72f8a4e35f97	pianificare misure di salvaguardia delle aree naturali protette
d9016ce5-951e-4538-bb9b-7a8c7374cd23	progettare sistemi a energia geotermica
d99aedae-d109-4db2-8d55-e013068d5dfa	eseguire studi di fattibilità sull'idrogeno
d9a7ba47-77d3-463e-b94b-4ee9985bc73a	funzionalità delle smart city
d9e2c5f2-4cd9-4535-8132-28634eaeebf3	gestire risorse finanziarie e materiali
dae9a316-00d8-4b15-8bae-e52e25e962a9	car sharing
dbb3bf01-67c3-4e2e-ba98-2fc36a0e3afc	economia politica
dbc5bb3a-1007-4b2c-a51f-fdfe3c5aa517	applicare standard igienici
dbca58c2-bd8d-4bd6-bc4a-903973bc0c10	regolamentazione dei servizi basati su blockchain
dc198710-f248-4b09-82c5-eb167b4e56b2	redigere documentazione di gara
dc343d20-708d-4c42-ac72-c15009407ef4	attuare piani di gestione della sicurezza antincendio
dc81a414-680e-4860-b91c-15a598da73c9	studi sulla sicurezza internazionale
dcc473f5-3c01-4c04-a53e-50a27735513e	sviluppo internazionale
dcf1d21b-aeb8-4be4-9c17-141d545b975e	utilizzare software di comunicazione e collaborazione
dcf911d1-73f5-4c90-a7fd-3ca46961270a	comunicare verbalmente in lussemburghese
dd0d6c47-1009-462c-b169-83ae5f451191	utilizzare software multimediali
dd4a6de8-b3af-4809-8c91-2e5d120557b9	garantire un approvvigionamento responsabile nelle filiere alimentari
dd7e7b86-fb1c-4b65-8e33-3fc63a8a56b0	design management
dd97cee5-a48b-44af-a538-4648fbbe45b4	eseguire analisi dei guasti del processo produttivo
de18be78-1eb9-4b6b-89d7-a53708cae725	graphic design
de292061-b580-4f10-9bee-ddbe940b6838	sviluppo locale di tipo partecipativo
de3da763-6b66-41c0-bb45-61c7f0cac4ae	agricoltura climaticamente intelligente
de5cc79f-2e0a-416f-a229-79fe7ec51147	mantenere una mentalità aperta
de7a7470-f723-4a69-8db4-8431d8ae870c	progettazione di sistemi
de88e208-7b26-4926-8ac0-6252df8e5933	disegno della ricerca
deaf911c-9f9b-4da9-9621-453aea27b9e3	progettazione di edifici sostenibili
defde94a-1988-4f6f-867e-f76f8faf24c9	ridurre le emissioni della concia
df7dc6f5-3ff8-44eb-a418-66cfcc61b282	ispezionare i materiali in legno
dfd82008-c39f-4633-afc0-f0063783f80c	gestire lo sviluppo di prodotti in gomma
e03846ad-0a7c-47bf-be5f-ccbbb6573cac	dimostrare affidabilità
e04a5830-8112-4f0f-82e9-3764aea81c22	media interattivi
e091e391-f6d1-4672-87ca-32590f2f3753	svolgere attività di ideazione
e0b2260b-cb12-49ee-82d4-095e8a795922	potenziale di risparmio energetico dei sistemi di turni automatizzati
e0cdffc3-6b61-4691-8c2e-34a6928ed1b1	Jenkins
e0d5573a-e392-4843-a72a-5c1bd010d6f3	gastronomia molecolare
e0f3d8cd-bdd4-44c5-980e-a5696ba5305e	eseguire controlli delle perdite di refrigerante
e12fc5ac-1a10-4043-8d45-dd843572700e	etica dei dati
e1550de5-9506-43d3-b1cf-08ffedf794d4	energia eolica
e1924452-e1a3-4485-93f4-4eccead74970	condurre ricerche interdisciplinari
e1addc27-660a-4ced-b0fa-5d9823b429d8	progettare un mini sistema eolico
e23ae686-c3b7-46fc-a4fc-bbc5e04e3460	progettazione di batterie
e25bbd45-237f-4eb6-9031-9b545d3be73f	TOGAF
e2b6bb75-517b-4b6f-998d-6d129fb6706e	interpretare informazioni matematiche
e2d1bc51-8a3c-41b8-aefe-6c438bff6310	valutare i candidati
e2e5e64b-d242-4134-9d58-85ab40d977c1	comunicare con gruppi di anziani
e31b5235-04fa-4b12-8ad5-08a4901bd070	processo di concia
e3263f21-ece0-48ce-9e90-f2e5665dce52	gestire le chiavi per la protezione dei dati
e337baf5-749f-45ae-8740-dba13218e097	sostenere l'occupabilità delle persone con disabilità
e34482d1-703a-4834-86b0-11ef269c96f1	convalida dell'apprendimento acquisito tramite il volontariato
e34880ce-8d25-4f5f-ac13-012fbcdc6e2c	microfinanza
e419a74a-a7e4-43ff-935a-5369afc3d2d0	sviluppare materiale di comunicazione inclusiva
e480c6e7-141c-4608-a1ab-9725d54a39da	pensare rapidamente
e511c50b-314a-461e-b663-540a8d53c328	amministrazione di sistema
e54667b4-70c3-4829-9f52-abcfe4e0377b	elaborare informazioni spaziali
e551f28f-96d5-40b4-8474-c5fb96224a3f	negoziazione con i fornitori
e6836390-7cf8-42bd-a66a-244490f642f4	marketing relazionale
e830ead6-8321-44fe-9d9e-763d062ab289	valutare i sistemi di riscaldamento e raffrescamento
e850c1ff-8ab0-4ac5-9e98-0e111b47b65d	analisi fondamentale
e8904281-bbcd-46f4-9f7b-201f99a0ddf5	sostenere il turismo locale
e9239c05-b62f-4b21-9c8a-f8e8e463b308	principi di sicurezza dei dati
e978854b-bf22-4a3c-a042-0103d1a5a39f	confrontare veicoli alternativi
e9d27a75-ddc3-45ad-bceb-8946b515e62a	orchestrazione Kubernetes
ea57ee52-af11-4987-a6ee-090d1c488570	servizi di carpooling
eae6dbd7-beee-4f17-911b-3b1b08a8122f	promuovere esperienze di viaggio in realtà virtuale
eaef9cc3-3e0c-4e3e-87df-0baa0b9aae05	collaborazione uomo-robot
ebd0e0bc-68fa-4e6f-b502-f1b3055cc697	rispettare la diversità dei valori e delle norme culturali
ec134958-c13d-4db4-b74d-39d107e77392	studi africani
ec1f53a7-1036-41d4-9df0-32a2131ac9ad	definire obiettivi e ambito della valutazione
ecb280b8-dcb0-4f35-8152-4a40174925ef	applicazione del concetto di blockchain
ed54e19b-d5ca-4fd1-8ffc-416af9150342	valutare l'impatto ambientale del comportamento personale
ed9c7ea2-ed68-4d73-9d6a-5bf7b94cd0c4	smart contract
ee0ed445-f5b3-4a5c-92e9-f7c8e6b4b8c6	sviluppare materiali avanzati
ee6ed2ef-9377-4972-a8f3-74b7e98a80a4	ricerca-azione
eeaa5c91-1b02-4f27-8212-8287e67a4d55	economia circolare
eeb6a6ba-2aa9-417b-93fd-3bb0de3949f1	data science
efa5d5d4-807c-40e0-86af-64e0d59fe7ef	Analisi finanziaria
efec7a06-4d2a-41a0-9873-2cec80de0588	Identificatori decentralizzati
effd7dc5-b243-46b5-9d1c-a47175b3eb4e	Ecopedagogia
f030cd89-bc1b-454b-9a15-43c4644cbedf	Principi di ethical hacking
f05b5ead-b427-4f0c-b1a7-123f872d7e91	GDPR
f0698576-0fec-4b09-a0e7-6adbb301ee35	Progettazione ambientale
f0ba2d1b-9157-4569-9366-47a5bbb14598	Analisi delle politiche
f0f92ca2-4970-4460-be6d-594f1aa2a29e	Acquaponica
f16f9b73-2a62-4db4-a2c1-9bf85e32a6eb	Software di gestione immobiliare
f1bdd792-89a2-4038-a1c5-b8026278b7e1	Consulenza direzionale
f1d7eea9-ff40-457a-90b3-e11450ccd171	Ingegneria DevOps
f20898c2-8013-49e9-8bf2-b06987dff38c	Processo decisionale partecipativo
f26fa332-8acb-44d7-85bd-18088fbed281	Misurare le performance di sostenibilità aziendale
f2d1e1c7-bcc1-4ccc-886a-3fb32ed243c6	Utilizzare tecnologie efficienti nell'uso delle risorse nel settore alberghiero
f2f2ebbf-ede3-4708-b7ae-9329caced6fb	Servizi cloud Azure
f2fda9d2-9b75-4092-b364-f95a3d4e5cfc	Piattaforme collaborative basate sul web
f309d9ec-a0d4-4247-b31f-e521b6567743	Sistemi di raffrescamento domestico
f319989e-ea70-4f53-a9c7-edd3335da027	Message queuing
f3b95239-ed50-4f26-819a-e44726b0d50b	Riconoscimento delle immagini
f3d854f4-c803-40bb-a58c-511de983c86c	Gestione della reputazione
f3eb2514-d029-47a3-91f5-177a774d8e4c	Utilizzare sistemi di integrazione dei media
f40d8f6d-c95c-4a45-80a7-1489925ffcfd	Sistemi di accumulo dell'energia
f4825627-9d7c-4f4d-9ebe-e2f72ab3d6d9	Security engineering
f5589de6-1dcb-49c6-872a-9d37ac939885	Metodo Kanban
f5bc4cd1-f7f8-4826-8ddc-4b6f7524dac9	Mantenere il benessere psicologico
f625a953-3c41-422c-9533-9886a860ffaa	Gestire la rotazione delle colture
f62908da-509e-41ad-b998-936b1322fd6e	Misurare i fenomeni fisici in ambito sanitario
f648324b-0521-442e-802d-cc6c23365f52	Domain Name Service
f64e2639-4c3e-46c6-9d23-16a896287e8f	Gestire gli incidenti di cybersecurity
f685b9bb-ab95-4596-b80a-daf19375c184	Guidare il processo di reporting sulla sostenibilità
f742edbe-e686-4efc-b886-f67cdcf2a280	Help desk
f7da46e7-0532-471d-9d15-254a50be5e58	Sviluppare formulazioni di mescole di gomma
f7e07007-c8a1-496b-b668-4f8811462f78	Integrare la dimensione di genere nella ricerca
f8dbef2c-e751-4c74-840c-a0d429c7df16	Sistemi di gestione delle batterie
f91b1b0f-158a-4d1a-a125-fdb397b2025e	Teoria della valutazione
f94e2667-a63b-456c-a917-7b9cbefe529a	Pianificare le operazioni di riviera
f9e0c8fc-d53f-41a9-8544-887b77e00e4d	Progettare l'elettronica di potenza
fa8f44d4-2100-484f-93c3-8a23b9f0bc3a	Affrontare le sfide in modo positivo
faad732e-8c0e-459b-9b57-c872a6dccd14	Condurre operazioni di post-concia
fbb8cc1b-f8b5-4648-89f7-06435e6e9f7f	Individuare la fonte adeguata per pompe di calore
fbcfaa08-2639-4869-8e3d-435aa759a5c1	Componenti blockchain
fc1ff4fe-5200-4b06-9d7c-ca80b1ef1d3a	Indicatori utilizzati nella gestione dei programmi dei fondi UE
fcac0215-daa3-49f3-a96d-412df7ec1d45	Valutazione delle commesse
fdf73ac8-9f71-4103-8d1b-e64b0b1efcea	Wireframing
fe038a5c-c903-4418-989f-f6b7e1518a21	Computer grafica
fe61aea9-f3e8-4673-a349-8875ee9972ab	Gestire le modifiche di progetto
ff73ca6f-c935-486d-a20d-501dc0364fb7	Tecniche di neuromarketing
ff7b367b-2cf0-4b59-a86c-378fbcd3240f	Analizzare la configurazione e le performance di rete
ffe353d2-2238-4a35-b5d6-6715d69d5eab	aumentare l'impatto della scienza su politiche e società
\.

UPDATE sys.sys_skills s
   SET skill_name = e.it
  FROM pg_temp.esco_llm e
 WHERE s.skill_id = e.skill_id
   AND e.it IS NOT NULL AND e.it <> ''
   AND s.skill_name <> e.it;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_temp.esco_llm;
  RAISE NOTICE '000162: % stale-URI ESCO skill names translated to IT via LLM (G-01 residuo).', n;
END $$;

DROP TABLE IF EXISTS pg_temp.esco_llm;
