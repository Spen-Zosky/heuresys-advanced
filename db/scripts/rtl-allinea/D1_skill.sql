-- Blocco D / skill (mandato RTL 2026-11-11, criteri di profili.ts: chiave = skill ESCO, si aggiunge senza mai togliere).
-- Per ogni persona abbinata a un posto della corsa, i requisiti di skill della corsa (pacchetto 15 di p20261010010521tjb)
-- mancanti sul suo posto RTL vengono aggiunti. Mappa livelli: BASE->BASIC, INTERMEDIO->COMPETENT, AVANZATO->PROFICIENT;
-- ESSENZIALE->HIGH (peso 1.0), UTILE->MEDIUM (peso 0.5). Una skill della corsa che manca al catalogo si crea come skill del tenant.
-- Idempotente. Giornale: staging.rtl_allinea_skill_undo (id inseriti; rollback = DELETE di quegli id).
-- Dati di ingresso: staging.rtl_corsa_skill e staging.rtl_persona_corsa, caricati con COPY inline (sotto) dall'estrazione del datastore.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_corsa_skill(posto text, skill_code text, nome text, esco_uri text, kind text, livello text, criticita text);
CREATE TABLE IF NOT EXISTS staging.rtl_persona_corsa(persona text, codice text, livello text);
TRUNCATE staging.rtl_corsa_skill; TRUNCATE staging.rtl_persona_corsa;
COPY staging.rtl_corsa_skill FROM STDIN;
R001	ESCO_21C5790C09304D74B3B084CAF5AF12EA	gestire i bilanci	http://data.europa.eu/esco/skill/21c5790c-0930-4d74-b3b0-84caf5af12ea	SKILL	AVANZATO	ESSENZIALE
R001	ESCO_2D008D5AB7BD46F7BBB15D70A0AF9C84	controllare le risorse finanziarie	http://data.europa.eu/esco/skill/2d008d5a-b7bd-46f7-bbb1-5d70a0af9c84	SKILL	AVANZATO	ESSENZIALE
R001	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	AVANZATO	ESSENZIALE
R001	ESCO_4CB512223E2E417C9A5CE9CCF262721D	garantire il rispetto della normativa aziendale	http://data.europa.eu/esco/skill/4cb51222-3e2e-417c-9a5c-e9ccf262721d	SKILL	AVANZATO	ESSENZIALE
R001	ESCO_83E97138899A4AF8918747823E875841	rispettare gli obblighi di legge	http://data.europa.eu/esco/skill/83e97138-899a-4af8-9187-47823e875841	SKILL	AVANZATO	ESSENZIALE
R001	ESCO_A2851A4A86AB43F88015936EB955D99E	salvaguardare la reputazione della banca	http://data.europa.eu/esco/skill/a2851a4a-86ab-43f8-8015-936eb955d99e	SKILL	AVANZATO	ESSENZIALE
R001	ESCO_BF12B4611C534D81A3958BA77F7483C4	analisi degli investimenti	http://data.europa.eu/esco/skill/bf12b461-1c53-4d81-a395-8ba77f7483c4	KNOWLEDGE	AVANZATO	ESSENZIALE
R001	ESCO_DDC8DA70B94F43EF88DCAEBC7BEF4F7D	assumere la responsabilità della gestione di un’impresa	http://data.europa.eu/esco/skill/ddc8da70-b94f-43ef-88dc-aebc7bef4f7d	SKILL	AVANZATO	ESSENZIALE
R001	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R001	ESCO_F60C9E5295FC4CA1A73C18A491153B63	prendere decisioni aziendali strategiche	http://data.europa.eu/esco/skill/f60c9e52-95fc-4ca1-a73c-18a491153b63	SKILL	AVANZATO	ESSENZIALE
R002	ESCO_089BAB26A85440FB8C045BE4F693315A	integrare i fondamenti strategici nelle prestazioni quotidiane	http://data.europa.eu/esco/skill/089bab26-a854-40fb-8c04-5be4f693315a	SKILL	AVANZATO	ESSENZIALE
R002	ESCO_3E61EE412BD9466FB31300CE04072410	dirigere i direttori dei reparti dell’azienda	http://data.europa.eu/esco/skill/3e61ee41-2bd9-466f-b313-00ce04072410	SKILL	AVANZATO	ESSENZIALE
R002	ESCO_6C8709939341438B91C0C7FE4F96D8F5	applicare il pensiero strategico	http://data.europa.eu/esco/skill/6c870993-9341-438b-91c0-c7fe4f96d8f5	SKILL	AVANZATO	ESSENZIALE
R002	ESCO_6FCE8D3FA15F4F26943AD200B32F6949	monitorare la politica aziendale	http://data.europa.eu/esco/skill/6fce8d3f-a15f-4f26-943a-d200b32f6949	SKILL	INTERMEDIO	ESSENZIALE
R002	ESCO_949CED5F75364614AC60563FFC91A2F2	pianificazione strategica	http://data.europa.eu/esco/skill/949ced5f-7536-4614-ac60-563ffc91a2f2	KNOWLEDGE	AVANZATO	ESSENZIALE
R002	ESCO_953445C047704BE091CF270A64C0E297	attuare la gestione strategica	http://data.europa.eu/esco/skill/953445c0-4770-4be0-91cf-270a64c0e297	SKILL	AVANZATO	ESSENZIALE
R002	ESCO_BA2C6181B03640B48F6D51499463CCBB	sviluppare le strategie aziendali	http://data.europa.eu/esco/skill/ba2c6181-b036-40b4-8f6d-51499463ccbb	SKILL	AVANZATO	ESSENZIALE
R002	ESCO_EAD58F220AF5467CAC1EB750E4E1AC6A	sviluppare i piani aziendali	http://data.europa.eu/esco/skill/ead58f22-0af5-467c-ac1e-b750e4e1ac6a	SKILL	AVANZATO	ESSENZIALE
R002	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R002	ESCO_F7B5D91652F04865B6A6E1A3B711CB5E	attuare la pianificazione strategica	http://data.europa.eu/esco/skill/f7b5d916-52f0-4865-b6a6-e1a3b711cb5e	SKILL	AVANZATO	ESSENZIALE
R003	ESCO_3D427A494F8542CD8A9262D4A34F41A1	archiviare i documenti	http://data.europa.eu/esco/skill/3d427a49-4f85-42cd-8a92-62d4a34f41a1	SKILL	INTERMEDIO	ESSENZIALE
R003	ESCO_3E04E39D9EB64167AD2DE3413F647E4E	organizzare i documenti aziendali	http://data.europa.eu/esco/skill/3e04e39d-9eb6-4167-ad2d-e3413f647e4e	SKILL	INTERMEDIO	ESSENZIALE
R003	ESCO_43B1305868D040C68031CAF5A7B7D20C	mantenere un registro delle attività	http://data.europa.eu/esco/skill/43b13058-68d0-40c6-8031-caf5a7b7d20c	SKILL	INTERMEDIO	ESSENZIALE
R003	ESCO_5FA6CD2F9BAB4AFAA1842D2F1401B770	redigere le relazioni delle riunioni	http://data.europa.eu/esco/skill/5fa6cd2f-9bab-4afa-a184-2d2f1401b770	SKILL	INTERMEDIO	UTILE
R003	ESCO_933E7CCF5D5646BAACA4857F826A6B3A	gestire gli appuntamenti	http://data.europa.eu/esco/skill/933e7ccf-5d56-46ba-aca4-857f826a6b3a	SKILL	BASE	ESSENZIALE
R003	ESCO_B769F5240F2544D785385C46710A040E	gestire documenti digitali	http://data.europa.eu/esco/skill/b769f524-0f25-44d7-8538-5c46710a040e	SKILL	INTERMEDIO	ESSENZIALE
R003	ESCO_DA56FEEA941C4FF6B573BB16CCBDE670	comunicare i programmi alle persone interessate	http://data.europa.eu/esco/skill/da56feea-941c-4ff6-b573-bb16ccbde670	SKILL	INTERMEDIO	ESSENZIALE
R003	ESCO_EC0BBF390EDD4015A2C382AD563CE3A8	redigere i messaggi di posta elettronica aziendali	http://data.europa.eu/esco/skill/ec0bbf39-0edd-4015-a2c3-82ad563ce3a8	SKILL	INTERMEDIO	ESSENZIALE
R003	ESCO_F683AE1DCB7C4AA1B9FE205E1BD23535	utilizzare microsoft office	http://data.europa.eu/esco/skill/f683ae1d-cb7c-4aa1-b9fe-205e1bd23535	SKILL	BASE	ESSENZIALE
R003	ESCO_F75B740CB36C495EBC67EFE347BBC6B5	politiche aziendali	http://data.europa.eu/esco/skill/f75b740c-b36c-495e-bc67-efe347bbc6b5	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R004	ESCO_171EEE5519B946D6ADED33193BA8CCF1	studiare i livelli di vendita dei prodotti	http://data.europa.eu/esco/skill/171eee55-19b9-46d6-aded-33193ba8ccf1	SKILL	INTERMEDIO	ESSENZIALE
R004	ESCO_2DD6ECDF8A08438B8B4BE0374F7B523B	eseguire le analisi delle vendite	http://data.europa.eu/esco/skill/2dd6ecdf-8a08-438b-8b4b-e0374f7b523b	SKILL	INTERMEDIO	ESSENZIALE
R004	ESCO_4DDF520495F54BE2AD35571E2F493AE5	agire con senso degli affari	http://data.europa.eu/esco/skill/4ddf5204-95f5-4be2-ad35-571e2f493ae5	SKILL	AVANZATO	ESSENZIALE
R004	ESCO_5DA3C76510A349EB934CEC401CEB1A34	analizzare i piani economici	http://data.europa.eu/esco/skill/5da3c765-10a3-49eb-934c-ec401ceb1a34	SKILL	INTERMEDIO	ESSENZIALE
R004	ESCO_949CED5F75364614AC60563FFC91A2F2	pianificazione strategica	http://data.europa.eu/esco/skill/949ced5f-7536-4614-ac60-563ffc91a2f2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R004	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R004	ESCO_B011C8B476E14BBC8BB91D205E7B618A	analisi di mercato	http://data.europa.eu/esco/skill/b011c8b4-76e1-4bbc-8bb9-1d205e7b618a	KNOWLEDGE	AVANZATO	ESSENZIALE
R004	ESCO_B679EF35EEBF4DA88E45FEE6841C3214	collaborare allo sviluppo di strategie di marketing	http://data.europa.eu/esco/skill/b679ef35-eebf-4da8-8e45-fee6841c3214	SKILL	INTERMEDIO	ESSENZIALE
R004	ESCO_D207A30B2F8041389B77F88D549B8768	individuare le nuove opportunità commerciali	http://data.europa.eu/esco/skill/d207a30b-2f80-4138-9b77-f88d549b8768	SKILL	AVANZATO	ESSENZIALE
R004	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R005	ESCO_3D427A494F8542CD8A9262D4A34F41A1	archiviare i documenti	http://data.europa.eu/esco/skill/3d427a49-4f85-42cd-8a92-62d4a34f41a1	SKILL	BASE	ESSENZIALE
R005	ESCO_3E04E39D9EB64167AD2DE3413F647E4E	organizzare i documenti aziendali	http://data.europa.eu/esco/skill/3e04e39d-9eb6-4167-ad2d-e3413f647e4e	SKILL	BASE	ESSENZIALE
R005	ESCO_43B1305868D040C68031CAF5A7B7D20C	mantenere un registro delle attività	http://data.europa.eu/esco/skill/43b13058-68d0-40c6-8031-caf5a7b7d20c	SKILL	BASE	ESSENZIALE
R005	ESCO_76F227078D30453F9EB73376E2960311	gestire la posta	http://data.europa.eu/esco/skill/76f22707-8d30-453f-9eb7-3376e2960311	SKILL	BASE	ESSENZIALE
R005	ESCO_7EC3C77B195543979BD37B7B9D0B8531	gestire un’agenda del personale	http://data.europa.eu/esco/skill/7ec3c77b-1955-4397-9bd3-7b7b9d0b8531	SKILL	BASE	ESSENZIALE
R005	ESCO_933E7CCF5D5646BAACA4857F826A6B3A	gestire gli appuntamenti	http://data.europa.eu/esco/skill/933e7ccf-5d56-46ba-aca4-857f826a6b3a	SKILL	BASE	ESSENZIALE
R005	ESCO_B769F5240F2544D785385C46710A040E	gestire documenti digitali	http://data.europa.eu/esco/skill/b769f524-0f25-44d7-8538-5c46710a040e	SKILL	BASE	ESSENZIALE
R005	ESCO_DA56FEEA941C4FF6B573BB16CCBDE670	comunicare i programmi alle persone interessate	http://data.europa.eu/esco/skill/da56feea-941c-4ff6-b573-bb16ccbde670	SKILL	BASE	ESSENZIALE
R005	ESCO_EC0BBF390EDD4015A2C382AD563CE3A8	redigere i messaggi di posta elettronica aziendali	http://data.europa.eu/esco/skill/ec0bbf39-0edd-4015-a2c3-82ad563ce3a8	SKILL	BASE	ESSENZIALE
R005	ESCO_F683AE1DCB7C4AA1B9FE205E1BD23535	utilizzare microsoft office	http://data.europa.eu/esco/skill/f683ae1d-cb7c-4aa1-b9fe-205e1bd23535	SKILL	BASE	ESSENZIALE
R006	ESCO_0A43729F2A794DAE9FAA95520DAAE79F	applicare le politiche aziendali	http://data.europa.eu/esco/skill/0a43729f-2a79-4dae-9faa-95520daae79f	SKILL	INTERMEDIO	ESSENZIALE
R006	ESCO_1DAE844512E5423ABB26824010E299B9	garantire la conformità ai requisiti legali	http://data.europa.eu/esco/skill/1dae8445-12e5-423a-bb26-824010e299b9	SKILL	AVANZATO	ESSENZIALE
R006	ESCO_2313B15DA9A748309BCCFD7DF79D842B	applicare le politiche finanziarie	http://data.europa.eu/esco/skill/2313b15d-a9a7-4830-9bcc-fd7df79d842b	SKILL	INTERMEDIO	UTILE
R006	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R006	ESCO_3D3EE5C34286457F9F761704011F7E11	ottemperare alle disposizioni legali	http://data.europa.eu/esco/skill/3d3ee5c3-4286-457f-9f76-1704011f7e11	SKILL	AVANZATO	ESSENZIALE
R006	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R006	ESCO_6A609F8F14514102AD2D62C5270E1237	amministrazione di ufficio	http://data.europa.eu/esco/skill/6a609f8f-1451-4102-ad2d-62c5270e1237	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R006	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	INTERMEDIO	UTILE
R006	ESCO_9E84A506DF064BE3874AFA01293E3DD5	processi aziendali	http://data.europa.eu/esco/skill/9e84a506-df06-4be3-874a-fa01293e3dd5	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R006	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R007	ESCO_0A43729F2A794DAE9FAA95520DAAE79F	applicare le politiche aziendali	http://data.europa.eu/esco/skill/0a43729f-2a79-4dae-9faa-95520daae79f	SKILL	AVANZATO	ESSENZIALE
R007	ESCO_1DAE844512E5423ABB26824010E299B9	garantire la conformità ai requisiti legali	http://data.europa.eu/esco/skill/1dae8445-12e5-423a-bb26-824010e299b9	SKILL	AVANZATO	ESSENZIALE
R007	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	AVANZATO	ESSENZIALE
R007	ESCO_3D3EE5C34286457F9F761704011F7E11	ottemperare alle disposizioni legali	http://data.europa.eu/esco/skill/3d3ee5c3-4286-457f-9f76-1704011f7e11	SKILL	AVANZATO	ESSENZIALE
R007	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R007	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	INTERMEDIO	UTILE
R007	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R007	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	INTERMEDIO	ESSENZIALE
R008	ESCO_0A43729F2A794DAE9FAA95520DAAE79F	applicare le politiche aziendali	http://data.europa.eu/esco/skill/0a43729f-2a79-4dae-9faa-95520daae79f	SKILL	INTERMEDIO	ESSENZIALE
R008	ESCO_1DAE844512E5423ABB26824010E299B9	garantire la conformità ai requisiti legali	http://data.europa.eu/esco/skill/1dae8445-12e5-423a-bb26-824010e299b9	SKILL	INTERMEDIO	ESSENZIALE
R008	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R008	ESCO_3D3EE5C34286457F9F761704011F7E11	ottemperare alle disposizioni legali	http://data.europa.eu/esco/skill/3d3ee5c3-4286-457f-9f76-1704011f7e11	SKILL	INTERMEDIO	ESSENZIALE
R008	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	BASE	UTILE
R008	ESCO_6A609F8F14514102AD2D62C5270E1237	amministrazione di ufficio	http://data.europa.eu/esco/skill/6a609f8f-1451-4102-ad2d-62c5270e1237	KNOWLEDGE	BASE	UTILE
R008	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	INTERMEDIO	ESSENZIALE
R008	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	INTERMEDIO	ESSENZIALE
R009	ESCO_1DAE844512E5423ABB26824010E299B9	garantire la conformità ai requisiti legali	http://data.europa.eu/esco/skill/1dae8445-12e5-423a-bb26-824010e299b9	SKILL	AVANZATO	ESSENZIALE
R009	ESCO_3A5231A08C3048EEB67108E2DEBD4441	politiche dell’organizzazione	http://data.europa.eu/esco/skill/3a5231a0-8c30-48ee-b671-08e2debd4441	KNOWLEDGE	AVANZATO	ESSENZIALE
R009	ESCO_3D3EE5C34286457F9F761704011F7E11	ottemperare alle disposizioni legali	http://data.europa.eu/esco/skill/3d3ee5c3-4286-457f-9f76-1704011f7e11	SKILL	AVANZATO	ESSENZIALE
R009	ESCO_4CB512223E2E417C9A5CE9CCF262721D	garantire il rispetto della normativa aziendale	http://data.europa.eu/esco/skill/4cb51222-3e2e-417c-9a5c-e9ccf262721d	SKILL	AVANZATO	ESSENZIALE
R009	ESCO_4CC2EDE96AD744FA97093EC4D3116E48	soddisfare i requisiti delle entità giuridiche	http://data.europa.eu/esco/skill/4cc2ede9-6ad7-44fa-9709-3ec4d3116e48	SKILL	INTERMEDIO	ESSENZIALE
R009	ESCO_6E5B66F0FF0B4D18BCE5FFCD2E7DE127	analizzare la legislazione	http://data.europa.eu/esco/skill/6e5b66f0-ff0b-4d18-bce5-ffcd2e7de127	SKILL	AVANZATO	ESSENZIALE
R009	ESCO_B9BF9E17AE47417BBBB1E8B7C263CCAC	identificare i requisiti di legge	http://data.europa.eu/esco/skill/b9bf9e17-ae47-417b-bbb1-e8b7c263ccac	SKILL	AVANZATO	ESSENZIALE
R009	ESCO_BDA0D115F315453E99DCF8B0E5862DB3	assicurare la conformità alle politiche	http://data.europa.eu/esco/skill/bda0d115-f315-453e-99dc-f8b0e5862db3	SKILL	AVANZATO	ESSENZIALE
R009	ESCO_F453B1A6C7DB4D9D9BA347C45159BFE3	garantire che i prodotti soddisfino le prescrizioni di legge	http://data.europa.eu/esco/skill/f453b1a6-c7db-4d9d-9ba3-47c45159bfe3	SKILL	INTERMEDIO	ESSENZIALE
R009	ESCO_F75B740CB36C495EBC67EFE347BBC6B5	politiche aziendali	http://data.europa.eu/esco/skill/f75b740c-b36c-495e-bc67-efe347bbc6b5	KNOWLEDGE	AVANZATO	ESSENZIALE
R010	ESCO_2A2FA8E8AAF34ABFA60BAF6415F1C6D4	impegnarsi per far crescere l’azienda	http://data.europa.eu/esco/skill/2a2fa8e8-aaf3-4abf-a60b-af6415f1c6d4	SKILL	AVANZATO	ESSENZIALE
R010	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	AVANZATO	ESSENZIALE
R010	ESCO_7F27F1FF2E174B69990EC23334478313	valutazione dei rischi e delle minacce	http://data.europa.eu/esco/skill/7f27f1ff-2e17-4b69-990e-c23334478313	KNOWLEDGE	AVANZATO	ESSENZIALE
R010	ESCO_7F7756FCD89D41D593EF85991603F4AD	gestire il rischio finanziario	http://data.europa.eu/esco/skill/7f7756fc-d89d-41d5-93ef-85991603f4ad	SKILL	AVANZATO	ESSENZIALE
R010	ESCO_8744F28F59A945AF8EF66944CB5A1473	identificazione dei rischi	http://data.europa.eu/esco/skill/8744f28f-59a9-45af-8ef6-6944cb5a1473	KNOWLEDGE	AVANZATO	ESSENZIALE
R010	ESCO_BD832A82B079400180D1F59EFED33688	scrivere le relazioni sui rischi	http://data.europa.eu/esco/skill/bd832a82-b079-4001-80d1-f59efed33688	SKILL	INTERMEDIO	ESSENZIALE
R010	ESCO_D7B66759C40C44DE9F319418F84E10C5	valutare i fattori di rischio	http://data.europa.eu/esco/skill/d7b66759-c40c-44de-9f31-9418f84e10c5	SKILL	AVANZATO	ESSENZIALE
R010	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R010	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	AVANZATO	ESSENZIALE
R010	ESCO_F60C9E5295FC4CA1A73C18A491153B63	prendere decisioni aziendali strategiche	http://data.europa.eu/esco/skill/f60c9e52-95fc-4ca1-a73c-18a491153b63	SKILL	AVANZATO	ESSENZIALE
R011	ESCO_00920055EB504CB8A23D3DEEDBF3753E	gestione del rischio aziendale	http://data.europa.eu/esco/skill/00920055-eb50-4cb8-a23d-3deedbf3753e	KNOWLEDGE	AVANZATO	ESSENZIALE
R011	ESCO_0EFBE2DC277047ECB8F4D1BDFF6AC0A4	offrire consulenza sulla gestione dei rischi	http://data.europa.eu/esco/skill/0efbe2dc-2770-47ec-b8f4-d1bdff6ac0a4	SKILL	AVANZATO	ESSENZIALE
R011	ESCO_64BD41575DF041668259EDE237DD7CDF	stimare l'incidenza dei rischi	http://data.europa.eu/esco/skill/64bd4157-5df0-4166-8259-ede237dd7cdf	SKILL	AVANZATO	ESSENZIALE
R011	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	AVANZATO	ESSENZIALE
R011	ESCO_773E217C8B214D8CB38468752A2243A9	tecniche di analisi quantitativa dei rischi	http://data.europa.eu/esco/skill/773e217c-8b21-4d8c-b384-68752a2243a9	KNOWLEDGE	AVANZATO	ESSENZIALE
R011	ESCO_7E7BBF722BFB49C2A34104C02932F916	definire politiche di rischio	http://data.europa.eu/esco/skill/7e7bbf72-2bfb-49c2-a341-04c02932f916	SKILL	AVANZATO	ESSENZIALE
R011	ESCO_8744F28F59A945AF8EF66944CB5A1473	identificazione dei rischi	http://data.europa.eu/esco/skill/8744f28f-59a9-45af-8ef6-6944cb5a1473	KNOWLEDGE	AVANZATO	ESSENZIALE
R011	ESCO_88EC9E5E8798475D81A3DD5EA7E96215	tecniche di analisi qualitativa dei rischi	http://data.europa.eu/esco/skill/88ec9e5e-8798-475d-81a3-dd5ea7e96215	KNOWLEDGE	AVANZATO	ESSENZIALE
R011	ESCO_D7B66759C40C44DE9F319418F84E10C5	valutare i fattori di rischio	http://data.europa.eu/esco/skill/d7b66759-c40c-44de-9f31-9418f84e10c5	SKILL	AVANZATO	ESSENZIALE
R011	ESCO_F60C9E5295FC4CA1A73C18A491153B63	prendere decisioni aziendali strategiche	http://data.europa.eu/esco/skill/f60c9e52-95fc-4ca1-a73c-18a491153b63	SKILL	AVANZATO	ESSENZIALE
R012	ESCO_292549E608EC456CB008EBA7A0A68428	analizzare le tendenze del mercato finanziario	http://data.europa.eu/esco/skill/292549e6-08ec-456c-b008-eba7a0a68428	SKILL	AVANZATO	ESSENZIALE
R012	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R012	ESCO_749CE4C24DFD461AA8F30F6914814D3E	titoli	http://data.europa.eu/esco/skill/749ce4c2-4dfd-461a-a8f3-0f6914814d3e	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R012	ESCO_7F27F1FF2E174B69990EC23334478313	valutazione dei rischi e delle minacce	http://data.europa.eu/esco/skill/7f27f1ff-2e17-4b69-990e-c23334478313	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R012	ESCO_7F7756FCD89D41D593EF85991603F4AD	gestire il rischio finanziario	http://data.europa.eu/esco/skill/7f7756fc-d89d-41d5-93ef-85991603f4ad	SKILL	INTERMEDIO	ESSENZIALE
R012	ESCO_8744F28F59A945AF8EF66944CB5A1473	identificazione dei rischi	http://data.europa.eu/esco/skill/8744f28f-59a9-45af-8ef6-6944cb5a1473	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R012	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R012	ESCO_D7B66759C40C44DE9F319418F84E10C5	valutare i fattori di rischio	http://data.europa.eu/esco/skill/d7b66759-c40c-44de-9f31-9418f84e10c5	SKILL	INTERMEDIO	ESSENZIALE
R012	ESCO_DA1398AC69554CF3922567F16E41DBDC	raccogliere i dati finanziari	http://data.europa.eu/esco/skill/da1398ac-6955-4cf3-9225-67f16e41dbdc	SKILL	INTERMEDIO	ESSENZIALE
R012	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	INTERMEDIO	ESSENZIALE
R013	ESCO_00920055EB504CB8A23D3DEEDBF3753E	gestione del rischio aziendale	http://data.europa.eu/esco/skill/00920055-eb50-4cb8-a23d-3deedbf3753e	KNOWLEDGE	AVANZATO	ESSENZIALE
R013	ESCO_0EFBE2DC277047ECB8F4D1BDFF6AC0A4	offrire consulenza sulla gestione dei rischi	http://data.europa.eu/esco/skill/0efbe2dc-2770-47ec-b8f4-d1bdff6ac0a4	SKILL	INTERMEDIO	UTILE
R013	ESCO_1C08D63D1C5E4B9BAD3EF7BA7DEBB2D1	prevedere i rischi organizzativi	http://data.europa.eu/esco/skill/1c08d63d-1c5e-4b9b-ad3e-f7ba7debb2d1	SKILL	INTERMEDIO	ESSENZIALE
R013	ESCO_64BD41575DF041668259EDE237DD7CDF	stimare l'incidenza dei rischi	http://data.europa.eu/esco/skill/64bd4157-5df0-4166-8259-ede237dd7cdf	SKILL	INTERMEDIO	ESSENZIALE
R013	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	AVANZATO	ESSENZIALE
R013	ESCO_773E217C8B214D8CB38468752A2243A9	tecniche di analisi quantitativa dei rischi	http://data.europa.eu/esco/skill/773e217c-8b21-4d8c-b384-68752a2243a9	KNOWLEDGE	AVANZATO	ESSENZIALE
R013	ESCO_7E7BBF722BFB49C2A34104C02932F916	definire politiche di rischio	http://data.europa.eu/esco/skill/7e7bbf72-2bfb-49c2-a341-04c02932f916	SKILL	AVANZATO	ESSENZIALE
R013	ESCO_8744F28F59A945AF8EF66944CB5A1473	identificazione dei rischi	http://data.europa.eu/esco/skill/8744f28f-59a9-45af-8ef6-6944cb5a1473	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R013	ESCO_88EC9E5E8798475D81A3DD5EA7E96215	tecniche di analisi qualitativa dei rischi	http://data.europa.eu/esco/skill/88ec9e5e-8798-475d-81a3-dd5ea7e96215	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R013	ESCO_D7B66759C40C44DE9F319418F84E10C5	valutare i fattori di rischio	http://data.europa.eu/esco/skill/d7b66759-c40c-44de-9f31-9418f84e10c5	SKILL	INTERMEDIO	ESSENZIALE
R014	ESCO_00920055EB504CB8A23D3DEEDBF3753E	gestione del rischio aziendale	http://data.europa.eu/esco/skill/00920055-eb50-4cb8-a23d-3deedbf3753e	KNOWLEDGE	AVANZATO	ESSENZIALE
R014	ESCO_2DDB122611174EB4AE653A2F5A5A3C80	rischi di sicurezza della rete TIC	http://data.europa.eu/esco/skill/2ddb1226-1117-4eb4-ae65-3a2f5a5a3c80	KNOWLEDGE	INTERMEDIO	UTILE
R014	ESCO_3D3EE5C34286457F9F761704011F7E11	ottemperare alle disposizioni legali	http://data.europa.eu/esco/skill/3d3ee5c3-4286-457f-9f76-1704011f7e11	SKILL	AVANZATO	ESSENZIALE
R014	ESCO_7E7BBF722BFB49C2A34104C02932F916	definire politiche di rischio	http://data.europa.eu/esco/skill/7e7bbf72-2bfb-49c2-a341-04c02932f916	SKILL	AVANZATO	ESSENZIALE
R014	ESCO_8804D9635A314609B5DFF741B7199FB7	audit interno	http://data.europa.eu/esco/skill/8804d963-5a31-4609-b5df-f741b7199fb7	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R014	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	AVANZATO	ESSENZIALE
R014	ESCO_F2C63B7AED6C48909F8C7685D172624C	attuare la corporate governance	http://data.europa.eu/esco/skill/f2c63b7a-ed6c-4890-9f8c-7685d172624c	SKILL	AVANZATO	ESSENZIALE
R014	ESCO_F5F5B2446CEA4FBC8A508F712791BC09	osservare le norme aziendali	http://data.europa.eu/esco/skill/f5f5b244-6cea-4fbc-8a50-8f712791bc09	SKILL	AVANZATO	ESSENZIALE
R014	ESCO_F60C9E5295FC4CA1A73C18A491153B63	prendere decisioni aziendali strategiche	http://data.europa.eu/esco/skill/f60c9e52-95fc-4ca1-a73c-18a491153b63	SKILL	AVANZATO	ESSENZIALE
R014	ESCO_F780A6ADB01E4C359746AF8FC0C5AD06	applicare la gestione delle crisi	http://data.europa.eu/esco/skill/f780a6ad-b01e-4c35-9746-af8fc0c5ad06	SKILL	AVANZATO	ESSENZIALE
R015	ESCO_06358891842443C5891ED40F226BEF40	garantire la conformità ai requisiti di sicurezza IT	http://data.europa.eu/esco/skill/06358891-8424-43c5-891e-d40f226bef40	SKILL	AVANZATO	ESSENZIALE
R015	ESCO_11EEBD4244AB401D8A2CBDB9FC9BEB50	strategia in materia di sicurezza delle informazioni	http://data.europa.eu/esco/skill/11eebd42-44ab-401d-8a2c-bdb9fc9beb50	KNOWLEDGE	AVANZATO	ESSENZIALE
R015	ESCO_14D1E3673EFE4EC586AEECA48710EE4E	attuare politiche di sicurezza delle TIC	http://data.europa.eu/esco/skill/14d1e367-3efe-4ec5-86ae-eca48710ee4e	SKILL	AVANZATO	ESSENZIALE
R015	ESCO_1DAE844512E5423ABB26824010E299B9	garantire la conformità ai requisiti legali	http://data.europa.eu/esco/skill/1dae8445-12e5-423a-bb26-824010e299b9	SKILL	AVANZATO	ESSENZIALE
R015	ESCO_1F1D2FF8C4C145CC98126A7EE84A73CB	guidare un gruppo	http://data.europa.eu/esco/skill/1f1d2ff8-c4c1-45cc-9812-6a7ee84a73cb	SKILL	INTERMEDIO	UTILE
R015	ESCO_3FF589B768DF4EA5AE41B395BDB2378F	standard di sicurezza TIC	http://data.europa.eu/esco/skill/3ff589b7-68df-4ea5-ae41-b395bdb2378f	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R015	ESCO_69CFC5ED65694ACAA4CCFD782BA51D9C	attuare la gestione del rischio TIC	http://data.europa.eu/esco/skill/69cfc5ed-6569-4aca-a4cc-fd782ba51d9c	SKILL	AVANZATO	ESSENZIALE
R015	ESCO_7814E88FC1334C3BB27F857AFA145D42	normativa sulla sicurezza TIC	http://data.europa.eu/esco/skill/7814e88f-c133-4c3b-b27f-857afa145d42	KNOWLEDGE	AVANZATO	ESSENZIALE
R015	ESCO_8088750D83884170A76F48354C469C44	sicurezza informatica	http://data.europa.eu/esco/skill/8088750d-8388-4170-a76f-48354c469c44	KNOWLEDGE	AVANZATO	ESSENZIALE
R015	ESCO_BDA0D115F315453E99DCF8B0E5862DB3	assicurare la conformità alle politiche	http://data.europa.eu/esco/skill/bda0d115-f315-453e-99dc-f8b0e5862db3	SKILL	AVANZATO	ESSENZIALE
R016	ESCO_1C08D63D1C5E4B9BAD3EF7BA7DEBB2D1	prevedere i rischi organizzativi	http://data.europa.eu/esco/skill/1c08d63d-1c5e-4b9b-ad3e-f7ba7debb2d1	SKILL	INTERMEDIO	ESSENZIALE
R016	ESCO_3DBB132FFB62422782777C89A9FE4749	compilare le relazioni di valutazione	http://data.europa.eu/esco/skill/3dbb132f-fb62-4227-8277-7c89a9fe4749	SKILL	INTERMEDIO	UTILE
R016	ESCO_5D5F0963A8B74A4FA8F505B3142752B9	modellizzazione dei rischi	http://data.europa.eu/esco/skill/5d5f0963-a8b7-4a4f-a8f5-05b3142752b9	KNOWLEDGE	AVANZATO	ESSENZIALE
R016	ESCO_64BD41575DF041668259EDE237DD7CDF	stimare l'incidenza dei rischi	http://data.europa.eu/esco/skill/64bd4157-5df0-4166-8259-ede237dd7cdf	SKILL	INTERMEDIO	ESSENZIALE
R016	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R016	ESCO_773E217C8B214D8CB38468752A2243A9	tecniche di analisi quantitativa dei rischi	http://data.europa.eu/esco/skill/773e217c-8b21-4d8c-b384-68752a2243a9	KNOWLEDGE	AVANZATO	ESSENZIALE
R016	ESCO_8744F28F59A945AF8EF66944CB5A1473	identificazione dei rischi	http://data.europa.eu/esco/skill/8744f28f-59a9-45af-8ef6-6944cb5a1473	KNOWLEDGE	AVANZATO	ESSENZIALE
R016	ESCO_88EC9E5E8798475D81A3DD5EA7E96215	tecniche di analisi qualitativa dei rischi	http://data.europa.eu/esco/skill/88ec9e5e-8798-475d-81a3-dd5ea7e96215	KNOWLEDGE	AVANZATO	ESSENZIALE
R016	ESCO_8DCBCABE09F74D11940D125AF57BBC40	individuare gli indicatori chiave di prestazione	http://data.europa.eu/esco/skill/8dcbcabe-09f7-4d11-940d-125af57bbc40	SKILL	INTERMEDIO	UTILE
R016	ESCO_D7B66759C40C44DE9F319418F84E10C5	valutare i fattori di rischio	http://data.europa.eu/esco/skill/d7b66759-c40c-44de-9f31-9418f84e10c5	SKILL	AVANZATO	ESSENZIALE
R017	ESCO_14464B1319B544038C2C09EB98E28F2F	fornire informazioni sugli obblighi fiscali	http://data.europa.eu/esco/skill/14464b13-19b5-4403-8c2c-09eb98e28f2f	SKILL	INTERMEDIO	ESSENZIALE
R017	ESCO_1973C966F23640C9B2D45D71A89019BE	utilizzare software per fogli elettronici	http://data.europa.eu/esco/skill/1973c966-f236-40c9-b2d4-5d71a89019be	SKILL	BASE	UTILE
R017	ESCO_2FF405ECF59C4A7B84B69776A49582C4	regolamenti di contabilità	http://data.europa.eu/esco/skill/2ff405ec-f59c-4a7b-84b6-9776a49582c4	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R017	ESCO_541CDC231EEC452081FC3392EAF538ED	individuazione delle frodi	http://data.europa.eu/esco/skill/541cdc23-1eec-4520-81fc-3392eaf538ed	KNOWLEDGE	AVANZATO	ESSENZIALE
R017	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	INTERMEDIO	ESSENZIALE
R017	ESCO_880C54F9866E4F37B5FA25EF8A7D49B6	tecniche contabili	http://data.europa.eu/esco/skill/880c54f9-866e-4f37-b5fa-25ef8a7d49b6	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R017	ESCO_8D202E2285E947B1A1E03296D17244CD	rispettare la riservatezza	http://data.europa.eu/esco/skill/8d202e22-85e9-47b1-a1e0-3296d17244cd	SKILL	INTERMEDIO	UTILE
R017	ESCO_AB986BC4DF9243519AC1AA75AF943CF7	svolgere le mansioni di segreteria	http://data.europa.eu/esco/skill/ab986bc4-df92-4351-9ac1-aa75af943cf7	SKILL	BASE	UTILE
R017	ESCO_B9EFC4B5026643E3A7E3064D09BCF90A	verificare i documenti fiscali	http://data.europa.eu/esco/skill/b9efc4b5-0266-43e3-a7e3-064d09bcf90a	SKILL	AVANZATO	ESSENZIALE
R017	ESCO_D669AF41756C48D9A2861443253F54B1	normativa fiscale	http://data.europa.eu/esco/skill/d669af41-756c-48d9-a286-1443253f54b1	KNOWLEDGE	AVANZATO	ESSENZIALE
R018	ESCO_08371FE9C6584F6A966F71DBB0AB683D	processi del reparto contabilità	http://data.europa.eu/esco/skill/08371fe9-c658-4f6a-966f-71dbb0ab683d	KNOWLEDGE	AVANZATO	ESSENZIALE
R018	ESCO_541CDC231EEC452081FC3392EAF538ED	individuazione delle frodi	http://data.europa.eu/esco/skill/541cdc23-1eec-4520-81fc-3392eaf538ed	KNOWLEDGE	AVANZATO	ESSENZIALE
R018	ESCO_5F1EBFF698EC411FA1D40BF04BD03BDF	verificare le scritture contabili	http://data.europa.eu/esco/skill/5f1ebff6-98ec-411f-a1d4-0bf04bd03bdf	SKILL	AVANZATO	ESSENZIALE
R018	ESCO_83E97138899A4AF8918747823E875841	rispettare gli obblighi di legge	http://data.europa.eu/esco/skill/83e97138-899a-4af8-9187-47823e875841	SKILL	AVANZATO	ESSENZIALE
R018	ESCO_8A43795BBB384F2991DFA6C92AD4643C	analizzare le prestazioni finanziarie di un’impresa	http://data.europa.eu/esco/skill/8a43795b-bb38-4f29-91df-a6c92ad4643c	SKILL	AVANZATO	ESSENZIALE
R018	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R018	ESCO_D6E78D9ADECA4BCBB08D011B2616758D	garantire il rispetto delle convenzioni contabili	http://data.europa.eu/esco/skill/d6e78d9a-deca-4bcb-b08d-011b2616758d	SKILL	AVANZATO	ESSENZIALE
R018	ESCO_DA629999D2264FF39E1A01788132664F	garantire il rispetto dei criteri di divulgazione delle informazioni contabili	http://data.europa.eu/esco/skill/da629999-d226-4ff3-9e1a-01788132664f	SKILL	AVANZATO	ESSENZIALE
R018	ESCO_F5652E8E7E254F3ABD31509C8406213F	supervisionare le operazioni contabili	http://data.europa.eu/esco/skill/f5652e8e-7e25-4f3a-bd31-509c8406213f	SKILL	AVANZATO	ESSENZIALE
R018	ESCO_F5F5B2446CEA4FBC8A508F712791BC09	osservare le norme aziendali	http://data.europa.eu/esco/skill/f5f5b244-6cea-4fbc-8a50-8f712791bc09	SKILL	AVANZATO	ESSENZIALE
R019	ESCO_08371FE9C6584F6A966F71DBB0AB683D	processi del reparto contabilità	http://data.europa.eu/esco/skill/08371fe9-c658-4f6a-966f-71dbb0ab683d	KNOWLEDGE	AVANZATO	ESSENZIALE
R019	ESCO_39E43F7CA95E4583BE76BB134CCCE1AE	processi dell’ufficio finanziario	http://data.europa.eu/esco/skill/39e43f7c-a95e-4583-be76-bb134ccce1ae	KNOWLEDGE	AVANZATO	ESSENZIALE
R019	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	AVANZATO	ESSENZIALE
R019	ESCO_6556CBF1D5C04F5389A98707066069A6	valutare i bilanci	http://data.europa.eu/esco/skill/6556cbf1-d5c0-4f53-89a9-8707066069a6	SKILL	AVANZATO	ESSENZIALE
R019	ESCO_83E97138899A4AF8918747823E875841	rispettare gli obblighi di legge	http://data.europa.eu/esco/skill/83e97138-899a-4af8-9187-47823e875841	SKILL	AVANZATO	ESSENZIALE
R019	ESCO_8A43795BBB384F2991DFA6C92AD4643C	analizzare le prestazioni finanziarie di un’impresa	http://data.europa.eu/esco/skill/8a43795b-bb38-4f29-91df-a6c92ad4643c	SKILL	AVANZATO	ESSENZIALE
R019	ESCO_D6E78D9ADECA4BCBB08D011B2616758D	garantire il rispetto delle convenzioni contabili	http://data.europa.eu/esco/skill/d6e78d9a-deca-4bcb-b08d-011b2616758d	SKILL	AVANZATO	ESSENZIALE
R019	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	INTERMEDIO	UTILE
R020	ESCO_1883A1F5F1904EF3852136D8CC6DBB47	verificare le dichiarazioni dei redditi	http://data.europa.eu/esco/skill/1883a1f5-f190-4ef3-8521-36d8cc6dbb47	SKILL	INTERMEDIO	ESSENZIALE
R020	ESCO_3E9B580D811B48DFA5D1A7BDD26F901F	preparare le relazioni di audit finanziario	http://data.europa.eu/esco/skill/3e9b580d-811b-48df-a5d1-a7bdd26f901f	SKILL	AVANZATO	ESSENZIALE
R020	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	AVANZATO	ESSENZIALE
R020	ESCO_5F1EBFF698EC411FA1D40BF04BD03BDF	verificare le scritture contabili	http://data.europa.eu/esco/skill/5f1ebff6-98ec-411f-a1d4-0bf04bd03bdf	SKILL	AVANZATO	ESSENZIALE
R020	ESCO_8804D9635A314609B5DFF741B7199FB7	audit interno	http://data.europa.eu/esco/skill/8804d963-5a31-4609-b5df-f741b7199fb7	KNOWLEDGE	AVANZATO	UTILE
R020	ESCO_89FF28D6342C435D83AA83E71DBBBC96	effettuare la revisione dei conti	http://data.europa.eu/esco/skill/89ff28d6-342c-435d-83aa-83e71dbbbc96	SKILL	AVANZATO	ESSENZIALE
R020	ESCO_8D202E2285E947B1A1E03296D17244CD	rispettare la riservatezza	http://data.europa.eu/esco/skill/8d202e22-85e9-47b1-a1e0-3296d17244cd	SKILL	INTERMEDIO	ESSENZIALE
R020	ESCO_8D5EE30C4B1C465F84A17BB7A05AACA6	monitorare le attività bancarie	http://data.europa.eu/esco/skill/8d5ee30c-4b1c-465f-84a1-7bb7a05aaca6	SKILL	AVANZATO	ESSENZIALE
R020	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R020	ESCO_ED0718F658234C7497492936C9C06203	sviluppare un piano di audit	http://data.europa.eu/esco/skill/ed0718f6-5823-4c74-9749-2936c9c06203	SKILL	AVANZATO	ESSENZIALE
R021	ESCO_00E53A0AC0BA4C9FA2ED4706D5832A00	garantire la soddisfazione del cliente	http://data.europa.eu/esco/skill/00e53a0a-c0ba-4c9f-a2ed-4706d5832a00	SKILL	INTERMEDIO	UTILE
R021	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	AVANZATO	ESSENZIALE
R021	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	AVANZATO	ESSENZIALE
R021	ESCO_8A43795BBB384F2991DFA6C92AD4643C	analizzare le prestazioni finanziarie di un’impresa	http://data.europa.eu/esco/skill/8a43795b-bb38-4f29-91df-a6c92ad4643c	SKILL	AVANZATO	ESSENZIALE
R021	ESCO_A2851A4A86AB43F88015936EB955D99E	salvaguardare la reputazione della banca	http://data.europa.eu/esco/skill/a2851a4a-86ab-43f8-8015-936eb955d99e	SKILL	AVANZATO	ESSENZIALE
R021	ESCO_A9C205EF365A4AE4B905CB48BA761FF0	comunicare i piani aziendali ai collaboratori	http://data.europa.eu/esco/skill/a9c205ef-365a-4ae4-b905-cb48ba761ff0	SKILL	AVANZATO	ESSENZIALE
R021	ESCO_DDC8DA70B94F43EF88DCAEBC7BEF4F7D	assumere la responsabilità della gestione di un’impresa	http://data.europa.eu/esco/skill/ddc8da70-b94f-43ef-88dc-aebc7bef4f7d	SKILL	AVANZATO	ESSENZIALE
R021	ESCO_E3C7BD87EDC14D9AA3D536415DE1AAC6	offrire i servizi finanziari	http://data.europa.eu/esco/skill/e3c7bd87-edc1-4d9a-a3d5-36415de1aac6	SKILL	INTERMEDIO	UTILE
R021	ESCO_F60C9E5295FC4CA1A73C18A491153B63	prendere decisioni aziendali strategiche	http://data.europa.eu/esco/skill/f60c9e52-95fc-4ca1-a73c-18a491153b63	SKILL	AVANZATO	ESSENZIALE
R022	ESCO_1DEA2F3A857C4FC3B1F8D5F2015C46A9	fornire istruzioni al personale	http://data.europa.eu/esco/skill/1dea2f3a-857c-4fc3-b1f8-d5f2015c46a9	SKILL	INTERMEDIO	ESSENZIALE
R022	ESCO_237DB40B460047C0837F4A2C4F3014AB	principi di gestione di un progetto	http://data.europa.eu/esco/skill/237db40b-4600-47c0-837f-4a2c4f3014ab	KNOWLEDGE	AVANZATO	ESSENZIALE
R022	ESCO_2D008D5AB7BD46F7BBB15D70A0AF9C84	controllare le risorse finanziarie	http://data.europa.eu/esco/skill/2d008d5a-b7bd-46f7-bbb1-5d70a0af9c84	SKILL	AVANZATO	ESSENZIALE
R022	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	AVANZATO	ESSENZIALE
R022	ESCO_7111B95D0CE3441A9D924C75D05C4388	gestione di progetto	http://data.europa.eu/esco/skill/7111b95d-0ce3-441a-9d92-4c75d05c4388	KNOWLEDGE	AVANZATO	ESSENZIALE
R022	ESCO_811BDB9D5BF74B5AA3F54FC2002F6D57	capacità finanziaria	http://data.europa.eu/esco/skill/811bdb9d-5bf7-4b5a-a3f5-4fc2002f6d57	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R022	ESCO_918F5211B99F4B299A346E475583EF55	scrivere relazioni connesse al lavoro	http://data.europa.eu/esco/skill/918f5211-b99f-4b29-9a34-6e475583ef55	SKILL	INTERMEDIO	ESSENZIALE
R022	ESCO_C983DBC88B2E4F7EAA66F9042A898EA8	combinare molteplici campi di conoscenze	http://data.europa.eu/esco/skill/c983dbc8-8b2e-4f7e-aa66-f9042a898ea8	SKILL	AVANZATO	ESSENZIALE
R022	ESCO_CD5EFA8CE44D4CBC91C6796018DBED68	eseguire la gestione del progetto	http://data.europa.eu/esco/skill/cd5efa8c-e44d-4cbc-91c6-796018dbed68	SKILL	AVANZATO	ESSENZIALE
R022	ESCO_FF862044D49E4417BF651AE2C0A47E5A	analizzare le relazioni scritte connesse al lavoro	http://data.europa.eu/esco/skill/ff862044-d49e-4417-bf65-1ae2c0a47e5a	SKILL	INTERMEDIO	ESSENZIALE
R023	ESCO_00E53A0AC0BA4C9FA2ED4706D5832A00	garantire la soddisfazione del cliente	http://data.europa.eu/esco/skill/00e53a0a-c0ba-4c9f-a2ed-4706d5832a00	SKILL	AVANZATO	ESSENZIALE
R023	ESCO_03B9B491FC9B4868914ABF7CD47B5041	creare soluzioni a problemi	http://data.europa.eu/esco/skill/03b9b491-fc9b-4868-914a-bf7cd47b5041	SKILL	INTERMEDIO	ESSENZIALE
R023	ESCO_0DA516EEE70E4384BE13F5FF80BE8127	comunicare con i clienti	http://data.europa.eu/esco/skill/0da516ee-e70e-4384-be13-f5ff80be8127	SKILL	AVANZATO	ESSENZIALE
R023	ESCO_0EE94AF1B44549739C3F459FAB250342	gestire i conflitti	http://data.europa.eu/esco/skill/0ee94af1-b445-4973-9c3f-459fab250342	SKILL	INTERMEDIO	ESSENZIALE
R023	ESCO_15A33D764640438DAE64FDC0C1D3EEBC	servizio clienti	http://data.europa.eu/esco/skill/15a33d76-4640-438d-ae64-fdc0c1d3eebc	KNOWLEDGE	AVANZATO	ESSENZIALE
R023	ESCO_89BA58E8A67E4D2BAD426ACAB25C241B	valutare i feedback dei clienti	http://data.europa.eu/esco/skill/89ba58e8-a67e-4d2b-ad42-6acab25c241b	SKILL	INTERMEDIO	UTILE
R023	ESCO_8B7409B0E18E4DFC9AD98DDBCCE38849	tenere un archivio dell’interazione con il cliente	http://data.europa.eu/esco/skill/8b7409b0-e18e-4dfc-9ad9-8ddbcce38849	SKILL	INTERMEDIO	ESSENZIALE
R023	ESCO_A17286C5238D4F0BBC2429E9121345DE	ascoltare attivamente	http://data.europa.eu/esco/skill/a17286c5-238d-4f0b-bc24-29e9121345de	SKILL	INTERMEDIO	ESSENZIALE
R023	ESCO_DEBB8D81ED7F447D853A5D107FDA6FCF	fornire ai clienti servizi assistenza	http://data.europa.eu/esco/skill/debb8d81-ed7f-447d-853a-5d107fda6fcf	SKILL	AVANZATO	ESSENZIALE
R024	ESCO_21C5790C09304D74B3B084CAF5AF12EA	gestire i bilanci	http://data.europa.eu/esco/skill/21c5790c-0930-4d74-b3b0-84caf5af12ea	SKILL	AVANZATO	ESSENZIALE
R024	ESCO_2D008D5AB7BD46F7BBB15D70A0AF9C84	controllare le risorse finanziarie	http://data.europa.eu/esco/skill/2d008d5a-b7bd-46f7-bbb1-5d70a0af9c84	SKILL	AVANZATO	ESSENZIALE
R024	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R024	ESCO_56FF27EF256545BFA70CF06D78D2A480	produrre un piano finanziario	http://data.europa.eu/esco/skill/56ff27ef-2565-45bf-a70c-f06d78d2a480	SKILL	AVANZATO	ESSENZIALE
R024	ESCO_880C54F9866E4F37B5FA25EF8A7D49B6	tecniche contabili	http://data.europa.eu/esco/skill/880c54f9-866e-4f37-b5fa-25ef8a7d49b6	KNOWLEDGE	AVANZATO	ESSENZIALE
R024	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R024	ESCO_BF12B4611C534D81A3958BA77F7483C4	analisi degli investimenti	http://data.europa.eu/esco/skill/bf12b461-1c53-4d81-a395-8ba77f7483c4	KNOWLEDGE	AVANZATO	ESSENZIALE
R024	ESCO_C503729B8F9143F682B8522B92826656	consultare il punteggio sull’affidabilità creditizia	http://data.europa.eu/esco/skill/c503729b-8f91-43f6-82b8-522b92826656	SKILL	INTERMEDIO	ESSENZIALE
R024	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R025	ESCO_009DB49BFCF54409B4A5232D059F3597	applicare la politica di rischio del credito	http://data.europa.eu/esco/skill/009db49b-fcf5-4409-b4a5-232d059f3597	SKILL	AVANZATO	ESSENZIALE
R025	ESCO_2FD26AE6BD9846C7B1BA8A0B52734FAC	tecniche di riscossione debiti	http://data.europa.eu/esco/skill/2fd26ae6-bd98-46c7-b1ba-8a0b52734fac	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R025	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	INTERMEDIO	ESSENZIALE
R025	ESCO_5CD78D6BB4144A52A24AAE3BA1FFE7A1	definire la politica di credito	http://data.europa.eu/esco/skill/5cd78d6b-b414-4a52-a24a-ae3ba1ffe7a1	SKILL	AVANZATO	ESSENZIALE
R025	ESCO_7236D0D1127F4307A7D49730EE8A9167	determinare le condizioni di un prestito	http://data.europa.eu/esco/skill/7236d0d1-127f-4307-a7d4-9730ee8a9167	SKILL	AVANZATO	ESSENZIALE
R025	ESCO_AFE9C5D2E8BD43779D2D49B9589F05F9	analizzare le informazioni relative alla storia creditizia e alla capacità di rimborso di potenziali clienti	http://data.europa.eu/esco/skill/afe9c5d2-e8bd-4377-9d2d-49b9589f05f9	SKILL	AVANZATO	ESSENZIALE
R025	ESCO_B497A163DAF44F1BA6BA8C640D803979	sistemi di credito	http://data.europa.eu/esco/skill/b497a163-daf4-4f1b-a6ba-8c640d803979	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R025	ESCO_E126F782B4E64F7D8DCA8D2E6778559B	processi di controllo del credito	http://data.europa.eu/esco/skill/e126f782-b4e6-4f7d-8dca-8d2e6778559b	KNOWLEDGE	AVANZATO	ESSENZIALE
R025	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R025	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R026	ESCO_009DB49BFCF54409B4A5232D059F3597	applicare la politica di rischio del credito	http://data.europa.eu/esco/skill/009db49b-fcf5-4409-b4a5-232d059f3597	SKILL	AVANZATO	ESSENZIALE
R026	ESCO_0EFBE2DC277047ECB8F4D1BDFF6AC0A4	offrire consulenza sulla gestione dei rischi	http://data.europa.eu/esco/skill/0efbe2dc-2770-47ec-b8f4-d1bdff6ac0a4	SKILL	INTERMEDIO	ESSENZIALE
R026	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	AVANZATO	ESSENZIALE
R026	ESCO_7F27F1FF2E174B69990EC23334478313	valutazione dei rischi e delle minacce	http://data.europa.eu/esco/skill/7f27f1ff-2e17-4b69-990e-c23334478313	KNOWLEDGE	AVANZATO	ESSENZIALE
R026	ESCO_7F7756FCD89D41D593EF85991603F4AD	gestire il rischio finanziario	http://data.europa.eu/esco/skill/7f7756fc-d89d-41d5-93ef-85991603f4ad	SKILL	AVANZATO	ESSENZIALE
R026	ESCO_8744F28F59A945AF8EF66944CB5A1473	identificazione dei rischi	http://data.europa.eu/esco/skill/8744f28f-59a9-45af-8ef6-6944cb5a1473	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R026	ESCO_BD832A82B079400180D1F59EFED33688	scrivere le relazioni sui rischi	http://data.europa.eu/esco/skill/bd832a82-b079-4001-80d1-f59efed33688	SKILL	INTERMEDIO	ESSENZIALE
R026	ESCO_D7B66759C40C44DE9F319418F84E10C5	valutare i fattori di rischio	http://data.europa.eu/esco/skill/d7b66759-c40c-44de-9f31-9418f84e10c5	SKILL	AVANZATO	ESSENZIALE
R026	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R026	ESCO_EDF081E4D2DC4A608C497B7E45B5EBE3	creare le mappe di rischio	http://data.europa.eu/esco/skill/edf081e4-d2dc-4a60-8c49-7b7e45b5ebe3	SKILL	AVANZATO	ESSENZIALE
R027	ESCO_248894D142DC474FAF6E2DA52AC0C679	definire una strategia tecnologica	http://data.europa.eu/esco/skill/248894d1-42dc-474f-af6e-2da52ac0c679	SKILL	AVANZATO	ESSENZIALE
R027	ESCO_3CFA46E9B7DA44ACB09E9596DFFE0425	ottimizzare la scelta di soluzioni TIC	http://data.europa.eu/esco/skill/3cfa46e9-b7da-44ac-b09e-9596dffe0425	SKILL	INTERMEDIO	ESSENZIALE
R027	ESCO_501537A79D63491DAE0209F04767FF1E	vettori di attacco	http://data.europa.eu/esco/skill/501537a7-9d63-491d-ae02-09f04767ff1e	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R027	ESCO_69CFC5ED65694ACAA4CCFD782BA51D9C	attuare la gestione del rischio TIC	http://data.europa.eu/esco/skill/69cfc5ed-6569-4aca-a4cc-fd782ba51d9c	SKILL	AVANZATO	ESSENZIALE
R027	ESCO_7A17D7CE01A24746BBCC22FFE22FA16E	monitorare le tendenze tecnologiche	http://data.europa.eu/esco/skill/7a17d7ce-01a2-4746-bbcc-22ffe22fa16e	SKILL	INTERMEDIO	ESSENZIALE
R027	ESCO_8FA840F7E66A43708E6D7D554260C31C	prevedere le future necessità della rete TIC	http://data.europa.eu/esco/skill/8fa840f7-e66a-4370-8e6d-7d554260c31c	SKILL	INTERMEDIO	ESSENZIALE
R027	ESCO_909A28CED4B645679B74D111F1ED9633	mantenere il piano di continuità operativa	http://data.europa.eu/esco/skill/909a28ce-d4b6-4567-9b74-d111f1ed9633	SKILL	AVANZATO	ESSENZIALE
R027	ESCO_AF607E5E4BA14E5FA2A6DC05806567C7	coordinare attività tecnologiche	http://data.europa.eu/esco/skill/af607e5e-4ba1-4e5f-a2a6-dc05806567c7	SKILL	AVANZATO	ESSENZIALE
R027	ESCO_B8271C8ACBA64BAA80F56361AF3F07E3	garantire il rispetto degli standard organizzativi TIC	http://data.europa.eu/esco/skill/b8271c8a-cba6-4baa-80f5-6361af3f07e3	SKILL	AVANZATO	ESSENZIALE
R027	ESCO_F2C63B7AED6C48909F8C7685D172624C	attuare la corporate governance	http://data.europa.eu/esco/skill/f2c63b7a-ed6c-4890-9f8c-7685d172624c	SKILL	AVANZATO	ESSENZIALE
R028	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	AVANZATO	ESSENZIALE
R028	ESCO_3D3EE5C34286457F9F761704011F7E11	ottemperare alle disposizioni legali	http://data.europa.eu/esco/skill/3d3ee5c3-4286-457f-9f76-1704011f7e11	SKILL	INTERMEDIO	ESSENZIALE
R028	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	BASE	ESSENZIALE
R028	ESCO_71DDE84C00584C52A556523369333DB8	utilizzare i sistemi per ufficio	http://data.europa.eu/esco/skill/71dde84c-0058-4c52-a556-523369333db8	SKILL	BASE	ESSENZIALE
R028	ESCO_77E7CB082C6F42AB881BB34B2318ACBE	gestire sistemi amministrativi	http://data.europa.eu/esco/skill/77e7cb08-2c6f-42ab-881b-b34b2318acbe	SKILL	AVANZATO	ESSENZIALE
R028	ESCO_9E84A506DF064BE3874AFA01293E3DD5	processi aziendali	http://data.europa.eu/esco/skill/9e84a506-df06-4be3-874a-fa01293e3dd5	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R028	ESCO_AFDB41DD5DD54FBBBF9EE041422698B4	coordinare le attività operative	http://data.europa.eu/esco/skill/afdb41dd-5dd5-4fbb-bf9e-e041422698b4	SKILL	AVANZATO	ESSENZIALE
R028	ESCO_BDCAC0C8B77A46409EAFC0CF3EFD1E23	elaborare i pagamenti	http://data.europa.eu/esco/skill/bdcac0c8-b77a-4640-9eaf-c0cf3efd1e23	SKILL	AVANZATO	ESSENZIALE
R028	ESCO_E3C7BD87EDC14D9AA3D536415DE1AAC6	offrire i servizi finanziari	http://data.europa.eu/esco/skill/e3c7bd87-edc1-4d9a-a3d5-36415de1aac6	SKILL	INTERMEDIO	ESSENZIALE
R028	ESCO_FA6ACFC30A4F4192B77D80E94D0FAF2A	gestire gli aspetti finanziari di un’impresa	http://data.europa.eu/esco/skill/fa6acfc3-0a4f-4192-b77d-80e94d0faf2a	SKILL	INTERMEDIO	ESSENZIALE
R029	ESCO_248894D142DC474FAF6E2DA52AC0C679	definire una strategia tecnologica	http://data.europa.eu/esco/skill/248894d1-42dc-474f-af6e-2da52ac0c679	SKILL	AVANZATO	ESSENZIALE
R029	ESCO_397DA142AB3548FEB1547C38F447ADFB	sistemi digitali	http://data.europa.eu/esco/skill/397da142-ab35-48fe-b154-7c38f447adfb	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R029	ESCO_3BDDFD7CAB6D40C2883D5E97FB7640BA	sviluppare progetti di software	http://data.europa.eu/esco/skill/3bddfd7c-ab6d-40c2-883d-5e97fb7640ba	SKILL	AVANZATO	ESSENZIALE
R029	ESCO_3C76296D4BBD44BA8EAA95BF275F79B7	gestire progetti TIC	http://data.europa.eu/esco/skill/3c76296d-4bbd-44ba-8eaa-95bf275f79b7	SKILL	AVANZATO	ESSENZIALE
R029	ESCO_41BF7EDEFC844A578C89B548D11B0BA1	gestire le conoscenze aziendali	http://data.europa.eu/esco/skill/41bf7ede-fc84-4a57-8c89-b548d11b0ba1	SKILL	INTERMEDIO	ESSENZIALE
R029	ESCO_6430EB0DC6DE46B7A7FC3DD2E8E62A69	usare sistemi di ticketing TIC	http://data.europa.eu/esco/skill/6430eb0d-c6de-46b7-a7fc-3dd2e8e62a69	SKILL	BASE	ESSENZIALE
R029	ESCO_94DD823C148E4614A6E899249B16357D	gestione di progetti TIC	http://data.europa.eu/esco/skill/94dd823c-148e-4614-a6e8-99249b16357d	KNOWLEDGE	AVANZATO	ESSENZIALE
R029	ESCO_A7F0FBE0C5464F308E4134A58C64567E	archiviazione dati	http://data.europa.eu/esco/skill/a7f0fbe0-c546-4f30-8e41-34a58c64567e	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R029	ESCO_C7CC6DC5D56B43238E5C47C4022F615F	metodologie di assicurazione della qualità	http://data.europa.eu/esco/skill/c7cc6dc5-d56b-4323-8e5c-47c4022f615f	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R029	ESCO_F28617ADAFDD4041814C216153A38998	analizzare le specifiche del software	http://data.europa.eu/esco/skill/f28617ad-afdd-4041-814c-216153a38998	SKILL	AVANZATO	ESSENZIALE
R030	ESCO_08FE59108C4C4679A988EB2DED3C4909	legislazione del lavoro	http://data.europa.eu/esco/skill/08fe5910-8c4c-4679-a988-eb2ded3c4909	KNOWLEDGE	AVANZATO	ESSENZIALE
R030	ESCO_496932F10B6B4F739432D95C7DDCD43B	assumere dipendenti	http://data.europa.eu/esco/skill/496932f1-0b6b-4f73-9432-d95c7ddcd43b	SKILL	AVANZATO	ESSENZIALE
R030	ESCO_5AA57BDC5765435E8FC999B3FEBDB213	assumere risorse umane	http://data.europa.eu/esco/skill/5aa57bdc-5765-435e-8fc9-99b3febdb213	SKILL	AVANZATO	ESSENZIALE
R030	ESCO_7FF2C6680E86418AA9624958262EE337	utilizzare le tecniche di comunicazione	http://data.europa.eu/esco/skill/7ff2c668-0e86-418a-a962-4958262ee337	SKILL	INTERMEDIO	ESSENZIALE
R030	ESCO_8D202E2285E947B1A1E03296D17244CD	rispettare la riservatezza	http://data.europa.eu/esco/skill/8d202e22-85e9-47b1-a1e0-3296d17244cd	SKILL	BASE	ESSENZIALE
R030	ESCO_97B713F0B9E849038DEE7E0B4019A1C0	diritto dell’occupazione	http://data.europa.eu/esco/skill/97b713f0-b9e8-4903-8dee-7e0b4019a1c0	KNOWLEDGE	AVANZATO	ESSENZIALE
R030	ESCO_9D916D7C89B34084A6D9E2B0B3091404	gestire l’ufficio paghe	http://data.europa.eu/esco/skill/9d916d7c-89b3-4084-a6d9-e2b0b3091404	SKILL	INTERMEDIO	ESSENZIALE
R030	ESCO_BF5D77ADE18C48D883F0BC79C011C74A	sviluppare una rete professionale	http://data.europa.eu/esco/skill/bf5d77ad-e18c-48d8-83f0-bc79c011c74a	SKILL	INTERMEDIO	ESSENZIALE
R030	ESCO_F206E732110C47CEA53FF00C9D97C90D	strategie di gestione dei talenti	http://data.europa.eu/esco/skill/f206e732-110c-47ce-a53f-f00c9d97c90d	KNOWLEDGE	AVANZATO	ESSENZIALE
R030	ESCO_FC54BD7F0C034FDDAF8C5EB4021E716D	identificarsi con gli obiettivi aziendali	http://data.europa.eu/esco/skill/fc54bd7f-0c03-4fdd-af8c-5eb4021e716d	SKILL	INTERMEDIO	ESSENZIALE
R031	ESCO_08FE59108C4C4679A988EB2DED3C4909	legislazione del lavoro	http://data.europa.eu/esco/skill/08fe5910-8c4c-4679-a988-eb2ded3c4909	KNOWLEDGE	AVANZATO	ESSENZIALE
R031	ESCO_0A43729F2A794DAE9FAA95520DAAE79F	applicare le politiche aziendali	http://data.europa.eu/esco/skill/0a43729f-2a79-4dae-9faa-95520daae79f	SKILL	INTERMEDIO	ESSENZIALE
R031	ESCO_2AE4AE1A367E47E0A0CC6777BE3E58D0	organizzare la valutazione del personale	http://data.europa.eu/esco/skill/2ae4ae1a-367e-47e0-a0cc-6777be3e58d0	SKILL	INTERMEDIO	UTILE
R031	ESCO_5AA57BDC5765435E8FC999B3FEBDB213	assumere risorse umane	http://data.europa.eu/esco/skill/5aa57bdc-5765-435e-8fc9-99b3febdb213	SKILL	AVANZATO	ESSENZIALE
R031	ESCO_811ACF0C4DD74DDAA4FA7CA498A95204	negoziare gli accordi di lavoro	http://data.europa.eu/esco/skill/811acf0c-4dd7-4dda-a4fa-7ca498a95204	SKILL	AVANZATO	ESSENZIALE
R031	ESCO_8D202E2285E947B1A1E03296D17244CD	rispettare la riservatezza	http://data.europa.eu/esco/skill/8d202e22-85e9-47b1-a1e0-3296d17244cd	SKILL	AVANZATO	ESSENZIALE
R031	ESCO_97B713F0B9E849038DEE7E0B4019A1C0	diritto dell’occupazione	http://data.europa.eu/esco/skill/97b713f0-b9e8-4903-8dee-7e0b4019a1c0	KNOWLEDGE	AVANZATO	ESSENZIALE
R031	ESCO_9D916D7C89B34084A6D9E2B0B3091404	gestire l’ufficio paghe	http://data.europa.eu/esco/skill/9d916d7c-89b3-4084-a6d9-e2b0b3091404	SKILL	INTERMEDIO	ESSENZIALE
R031	ESCO_F206E732110C47CEA53FF00C9D97C90D	strategie di gestione dei talenti	http://data.europa.eu/esco/skill/f206e732-110c-47ce-a53f-f00c9d97c90d	KNOWLEDGE	AVANZATO	ESSENZIALE
R031	ESCO_F77B73F08C654389A3AE3A57A73AD148	sviluppare programmi per trattenere i dipendenti	http://data.europa.eu/esco/skill/f77b73f0-8c65-4389-a3ae-3a57a73ad148	SKILL	INTERMEDIO	UTILE
R032	ESCO_21C5790C09304D74B3B084CAF5AF12EA	gestire i bilanci	http://data.europa.eu/esco/skill/21c5790c-0930-4d74-b3b0-84caf5af12ea	SKILL	INTERMEDIO	ESSENZIALE
R032	ESCO_66DB424F2ABE420D8E5B186607266B61	responsabilità sociale delle imprese	http://data.europa.eu/esco/skill/66db424f-2abe-420d-8e5b-186607266b61	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R032	ESCO_6DD4CE8C1813429D9F063382C4833CA3	valutare le esigenze ai fini di un appalto	http://data.europa.eu/esco/skill/6dd4ce8c-1813-429d-9f06-3382c4833ca3	SKILL	INTERMEDIO	UTILE
R032	ESCO_71152876B6294A99B9EA0F25A0D07E4E	negoziare i contratti di compravendita	http://data.europa.eu/esco/skill/71152876-b629-4a99-b9ea-0f25a0d07e4e	SKILL	AVANZATO	ESSENZIALE
R032	ESCO_8D4271CAC9FD40B3875F15F78332A49E	standard di qualità	http://data.europa.eu/esco/skill/8d4271ca-c9fd-40b3-875f-15f78332a49e	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R032	ESCO_92721092FE7C468996BD4F02385BC0E7	gestire i contratti	http://data.europa.eu/esco/skill/92721092-fe7c-4689-96bd-4f02385bc0e7	SKILL	AVANZATO	ESSENZIALE
R032	ESCO_96EC2D534F4141728EF270742C4BB540	valutare i rischi del fornitore	http://data.europa.eu/esco/skill/96ec2d53-4f41-4172-8ef2-70742c4bb540	SKILL	AVANZATO	ESSENZIALE
R032	ESCO_B7E57889A84F440C9E60459AA69979E9	analizzare le tendenze della catena di approvvigionamento	http://data.europa.eu/esco/skill/b7e57889-a84f-440c-9e60-459aa69979e9	SKILL	AVANZATO	ESSENZIALE
R032	ESCO_F5F5B2446CEA4FBC8A508F712791BC09	osservare le norme aziendali	http://data.europa.eu/esco/skill/f5f5b244-6cea-4fbc-8a50-8f712791bc09	SKILL	INTERMEDIO	ESSENZIALE
R032	ESCO_FE1EC582D63B466C9149E7FC4FE93E22	gestione dei fornitori	http://data.europa.eu/esco/skill/fe1ec582-d63b-466c-9149-e7fc4fe93e22	KNOWLEDGE	AVANZATO	ESSENZIALE
R033	ESCO_0E54CC0E6CEF41ECBD8CE8E8778969EC	marketing relazionale	http://data.europa.eu/esco/skill/0e54cc0e-6cef-41ec-bd8c-e8e8778969ec	KNOWLEDGE	AVANZATO	ESSENZIALE
R033	ESCO_13E2378E0D10450D843AB3592575826E	applicare le strategie di marketing	http://data.europa.eu/esco/skill/13e2378e-0d10-450d-843a-b3592575826e	SKILL	AVANZATO	ESSENZIALE
R033	ESCO_1C460D2D90C64FC9AD49FEBB6E15605A	strategie di determinazione del prezzo	http://data.europa.eu/esco/skill/1c460d2d-90c6-4fc9-ad49-febb6e15605a	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R033	ESCO_49D81D86E748418184E9106173058081	marketing dei servizi	http://data.europa.eu/esco/skill/49d81d86-e748-4181-84e9-106173058081	KNOWLEDGE	AVANZATO	ESSENZIALE
R033	ESCO_5BBAA0E60FD74DF29DB734F78B40DC34	gestione del marketing	http://data.europa.eu/esco/skill/5bbaa0e6-0fd7-4df2-9db7-34f78b40dc34	KNOWLEDGE	AVANZATO	ESSENZIALE
R033	ESCO_66DB424F2ABE420D8E5B186607266B61	responsabilità sociale delle imprese	http://data.europa.eu/esco/skill/66db424f-2abe-420d-8e5b-186607266b61	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R033	ESCO_7111B95D0CE3441A9D924C75D05C4388	gestione di progetto	http://data.europa.eu/esco/skill/7111b95d-0ce3-441a-9d92-4c75d05c4388	KNOWLEDGE	AVANZATO	ESSENZIALE
R033	ESCO_7A98628784F24E5D9AB4FD7EC424ECF3	definire obiettivi di marketing misurabili	http://data.europa.eu/esco/skill/7a986287-84f2-4e5d-9ab4-fd7ec424ecf3	SKILL	AVANZATO	ESSENZIALE
R033	ESCO_AA7EAC5FDC9D401AB197C9C455D78C95	integrare le strategie di marketing con la strategia aziendale globale	http://data.europa.eu/esco/skill/aa7eac5f-dc9d-401a-b197-c9c455d78c95	SKILL	AVANZATO	ESSENZIALE
R033	ESCO_DE03F4FDC1474477A0487109E5BA2D6F	principi di marketing	http://data.europa.eu/esco/skill/de03f4fd-c147-4477-a048-7109e5ba2d6f	KNOWLEDGE	AVANZATO	ESSENZIALE
R034	ESCO_11C56452FCEC4B009695CCA4728E5048	analisi di marketing	http://data.europa.eu/esco/skill/11c56452-fcec-4b00-9695-cca4728e5048	KNOWLEDGE	AVANZATO	ESSENZIALE
R034	ESCO_292549E608EC456CB008EBA7A0A68428	analizzare le tendenze del mercato finanziario	http://data.europa.eu/esco/skill/292549e6-08ec-456c-b008-eba7a0a68428	SKILL	AVANZATO	ESSENZIALE
R034	ESCO_46CB72827FB04D3CB6B8BFE81FAB077E	trarre le conclusioni dai risultati delle ricerche di mercato	http://data.europa.eu/esco/skill/46cb7282-7fb0-4d3c-b6b8-bfe81fab077e	SKILL	AVANZATO	ESSENZIALE
R034	ESCO_5F302D63048E451CB15097C124A5A26B	analizzare le tendenze economiche	http://data.europa.eu/esco/skill/5f302d63-048e-451c-b150-97c124a5a26b	SKILL	AVANZATO	ESSENZIALE
R034	ESCO_6360A934CC8749549656B32DB20592E3	analisi quantitativa	http://data.europa.eu/esco/skill/6360a934-cc87-4954-9656-b32db20592e3	KNOWLEDGE	AVANZATO	ESSENZIALE
R034	ESCO_7EE4C2EAB3494BD281A3EC31475D4833	statistica	http://data.europa.eu/esco/skill/7ee4c2ea-b349-4bd2-81a3-ec31475d4833	KNOWLEDGE	AVANZATO	ESSENZIALE
R034	ESCO_8770350E746F4ADB955618CA68104BE6	ricerca di mercato	http://data.europa.eu/esco/skill/8770350e-746f-4adb-9556-18ca68104be6	KNOWLEDGE	AVANZATO	ESSENZIALE
R034	ESCO_F414DC0835BD4BC7846D88A3844D057C	analisi delle tendenze	http://data.europa.eu/esco/skill/f414dc08-35bd-4bc7-846d-88a3844d057c	KNOWLEDGE	AVANZATO	ESSENZIALE
R034	ESCO_FD843A67466246829C7EB4D794EAFF12	preparare le relazioni sulle ricerche di mercato	http://data.europa.eu/esco/skill/fd843a67-4662-4682-9c7e-b4d794eaff12	SKILL	AVANZATO	ESSENZIALE
R034	ESCO_FE39D4DB4CB54299BB9F896C8FD6AB13	eseguire le ricerche di mercato	http://data.europa.eu/esco/skill/fe39d4db-4cb5-4299-bb9f-896c8fd6ab13	SKILL	AVANZATO	ESSENZIALE
R035	ESCO_05FC6F8D639C4329A6DEDFDD800ED091	comprensione del cliente	http://data.europa.eu/esco/skill/05fc6f8d-639c-4329-a6de-dfdd800ed091	KNOWLEDGE	AVANZATO	UTILE
R035	ESCO_15A33D764640438DAE64FDC0C1D3EEBC	servizio clienti	http://data.europa.eu/esco/skill/15a33d76-4640-438d-ae64-fdc0c1d3eebc	KNOWLEDGE	INTERMEDIO	UTILE
R035	ESCO_46CB72827FB04D3CB6B8BFE81FAB077E	trarre le conclusioni dai risultati delle ricerche di mercato	http://data.europa.eu/esco/skill/46cb7282-7fb0-4d3c-b6b8-bfe81fab077e	SKILL	AVANZATO	ESSENZIALE
R035	ESCO_68698869C13C4563ADC7118B7644F45D	individuare i desideri del cliente	http://data.europa.eu/esco/skill/68698869-c13c-4563-adc7-118b7644f45d	SKILL	AVANZATO	ESSENZIALE
R035	ESCO_750CAEE512A046BAB8AA1E56370DEAF9	analizzare le tendenze di acquisto dei consumatori	http://data.europa.eu/esco/skill/750caee5-12a0-46ba-b8aa-1e56370deaf9	SKILL	AVANZATO	ESSENZIALE
R035	ESCO_8770350E746F4ADB955618CA68104BE6	ricerca di mercato	http://data.europa.eu/esco/skill/8770350e-746f-4adb-9556-18ca68104be6	KNOWLEDGE	AVANZATO	ESSENZIALE
R035	ESCO_C94DD931F56848E29A1C922F1CE21F67	demografia	http://data.europa.eu/esco/skill/c94dd931-f568-48e2-9a1c-922f1ce21f67	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R035	ESCO_CE5B1446B5E34F05A5AC83F2EE142A44	analizzare i fattori esterni delle imprese	http://data.europa.eu/esco/skill/ce5b1446-b5e3-4f05-a5ac-83f2ee142a44	SKILL	INTERMEDIO	ESSENZIALE
R035	ESCO_E5635E022D344A8CB8CA556D45E9B20E	individuare i mercati potenziali per le imprese	http://data.europa.eu/esco/skill/e5635e02-2d34-4a8c-b8ca-556d45e9b20e	SKILL	INTERMEDIO	ESSENZIALE
R035	ESCO_FE39D4DB4CB54299BB9F896C8FD6AB13	eseguire le ricerche di mercato	http://data.europa.eu/esco/skill/fe39d4db-4cb5-4299-bb9f-896c8fd6ab13	SKILL	AVANZATO	ESSENZIALE
R036	ESCO_1BA59CE07FEC434B8D5C9B275250A26C	preparare il materiale per una presentazione	http://data.europa.eu/esco/skill/1ba59ce0-7fec-434b-8d5c-9b275250a26c	SKILL	INTERMEDIO	ESSENZIALE
R036	ESCO_4BD6E2ADBF694198B3AC3BAABD9DA46E	offrire supporto ai responsabili	http://data.europa.eu/esco/skill/4bd6e2ad-bf69-4198-b3ac-3baabd9da46e	SKILL	INTERMEDIO	ESSENZIALE
R036	ESCO_4CE09E3DCA6B424AA3287F551DB75E59	aggiornare il bilancio	http://data.europa.eu/esco/skill/4ce09e3d-ca6b-424a-a328-7f551db75e59	SKILL	INTERMEDIO	ESSENZIALE
R036	ESCO_5303169C75D647519136A4B88343388C	gestione dei media sociali	http://data.europa.eu/esco/skill/5303169c-75d6-4751-9136-a4b88343388c	KNOWLEDGE	INTERMEDIO	UTILE
R036	ESCO_5FD5C985EAAA47AA831462359C54505A	sviluppare contenuti digitali	http://data.europa.eu/esco/skill/5fd5c985-eaaa-47aa-8314-62359c54505a	SKILL	BASE	ESSENZIALE
R036	ESCO_7C3865D1E5A94043A7A42E9E30468C0B	svolgere le regolari attività di ufficio	http://data.europa.eu/esco/skill/7c3865d1-e5a9-4043-a7a4-2e9e30468c0b	SKILL	BASE	ESSENZIALE
R036	ESCO_84605F915AB44965A1ADCDC1901A820D	processi dell’ufficio marketing	http://data.europa.eu/esco/skill/84605f91-5ab4-4965-a1ad-cdc1901a820d	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R036	ESCO_8770350E746F4ADB955618CA68104BE6	ricerca di mercato	http://data.europa.eu/esco/skill/8770350e-746f-4adb-9556-18ca68104be6	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R036	ESCO_DA56FEEA941C4FF6B573BB16CCBDE670	comunicare i programmi alle persone interessate	http://data.europa.eu/esco/skill/da56feea-941c-4ff6-b573-bb16ccbde670	SKILL	INTERMEDIO	ESSENZIALE
R036	ESCO_DC9A236CC64043C3812F269403591EDB	gestione delle relazioni con i clienti	http://data.europa.eu/esco/skill/dc9a236c-c640-43c3-812f-269403591edb	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R037	ESCO_0BFB44C7C41249EDAAB4E33D0DD3B265	gestire i gruppi di vendita	http://data.europa.eu/esco/skill/0bfb44c7-c412-49ed-aab4-e33d0dd3b265	SKILL	AVANZATO	ESSENZIALE
R037	ESCO_13E2378E0D10450D843AB3592575826E	applicare le strategie di marketing	http://data.europa.eu/esco/skill/13e2378e-0d10-450d-843a-b3592575826e	SKILL	INTERMEDIO	ESSENZIALE
R037	ESCO_4FFEC20B5BBB47A2BED5EB70C4CBB572	gestire i canali di vendita	http://data.europa.eu/esco/skill/4ffec20b-5bbb-47a2-bed5-eb70c4cbb572	SKILL	AVANZATO	ESSENZIALE
R037	ESCO_683BC3E36EC14AD28D62D0AC1FABBE76	utilizzare le analisi per scopi commerciali	http://data.europa.eu/esco/skill/683bc3e3-6ec1-4ad2-8d62-d0ac1fabbe76	SKILL	INTERMEDIO	ESSENZIALE
R037	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	AVANZATO	ESSENZIALE
R037	ESCO_92721092FE7C468996BD4F02385BC0E7	gestire i contratti	http://data.europa.eu/esco/skill/92721092-fe7c-4689-96bd-4f02385bc0e7	SKILL	INTERMEDIO	ESSENZIALE
R037	ESCO_BF5D77ADE18C48D883F0BC79C011C74A	sviluppare una rete professionale	http://data.europa.eu/esco/skill/bf5d77ad-e18c-48d8-83f0-bc79c011c74a	SKILL	INTERMEDIO	ESSENZIALE
R037	ESCO_D6D3FEE747E247F4A0EC6C75F28C6ABD	comprensione del prodotto	http://data.europa.eu/esco/skill/d6d3fee7-47e2-47f4-a0ec-6c75f28c6abd	KNOWLEDGE	AVANZATO	ESSENZIALE
R037	ESCO_DC9A236CC64043C3812F269403591EDB	gestione delle relazioni con i clienti	http://data.europa.eu/esco/skill/dc9a236c-c640-43c3-812f-269403591edb	KNOWLEDGE	AVANZATO	ESSENZIALE
R037	ESCO_EE7F90CC922E4DA7A7AE83C2688FED10	adeguare l’impegno allo sviluppo dell’impresa	http://data.europa.eu/esco/skill/ee7f90cc-922e-4da7-a7ae-83c2688fed10	SKILL	AVANZATO	ESSENZIALE
R038	ESCO_089BAB26A85440FB8C045BE4F693315A	integrare i fondamenti strategici nelle prestazioni quotidiane	http://data.europa.eu/esco/skill/089bab26-a854-40fb-8c04-5be4f693315a	SKILL	AVANZATO	ESSENZIALE
R038	ESCO_3D3EE5C34286457F9F761704011F7E11	ottemperare alle disposizioni legali	http://data.europa.eu/esco/skill/3d3ee5c3-4286-457f-9f76-1704011f7e11	SKILL	INTERMEDIO	ESSENZIALE
R038	ESCO_3E679F1CE5154F1B82B32A7E848183A5	fornire consulenza per la definizione delle politiche	http://data.europa.eu/esco/skill/3e679f1c-e515-4f1b-82b3-2a7e848183a5	SKILL	AVANZATO	ESSENZIALE
R038	ESCO_4CB512223E2E417C9A5CE9CCF262721D	garantire il rispetto della normativa aziendale	http://data.europa.eu/esco/skill/4cb51222-3e2e-417c-9a5c-e9ccf262721d	SKILL	INTERMEDIO	ESSENZIALE
R038	ESCO_633A36372C6B40AEAC38289EB2A62AA6	analisi aziendale	http://data.europa.eu/esco/skill/633a3637-2c6b-40ae-ac38-289eb2a62aa6	KNOWLEDGE	AVANZATO	ESSENZIALE
R038	ESCO_8BAD61B875F74BDCB994F7158F4B90F0	definire le politiche organizzative	http://data.europa.eu/esco/skill/8bad61b8-75f7-4bdc-b994-f7158f4b90f0	SKILL	AVANZATO	ESSENZIALE
R038	ESCO_8BC75DCEBEBA40F993FC66C9708ED74B	fornire consulenza sul miglioramento dell’efficienza	http://data.europa.eu/esco/skill/8bc75dce-beba-40f9-93fc-66c9708ed74b	SKILL	INTERMEDIO	ESSENZIALE
R038	ESCO_949CED5F75364614AC60563FFC91A2F2	pianificazione strategica	http://data.europa.eu/esco/skill/949ced5f-7536-4614-ac60-563ffc91a2f2	KNOWLEDGE	AVANZATO	ESSENZIALE
R038	ESCO_BA2C6181B03640B48F6D51499463CCBB	sviluppare le strategie aziendali	http://data.europa.eu/esco/skill/ba2c6181-b036-40b4-8f6d-51499463ccbb	SKILL	AVANZATO	ESSENZIALE
R038	ESCO_C54496679B4041148D74F51177669984	analisi delle politiche	http://data.europa.eu/esco/skill/c5449667-9b40-4114-8d74-f51177669984	KNOWLEDGE	AVANZATO	ESSENZIALE
R039	ESCO_171EEE5519B946D6ADED33193BA8CCF1	studiare i livelli di vendita dei prodotti	http://data.europa.eu/esco/skill/171eee55-19b9-46d6-aded-33193ba8ccf1	SKILL	INTERMEDIO	ESSENZIALE
R039	ESCO_2DD6ECDF8A08438B8B4BE0374F7B523B	eseguire le analisi delle vendite	http://data.europa.eu/esco/skill/2dd6ecdf-8a08-438b-8b4b-e0374f7b523b	SKILL	INTERMEDIO	ESSENZIALE
R039	ESCO_4DDF520495F54BE2AD35571E2F493AE5	agire con senso degli affari	http://data.europa.eu/esco/skill/4ddf5204-95f5-4be2-ad35-571e2f493ae5	SKILL	AVANZATO	ESSENZIALE
R039	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R039	ESCO_B011C8B476E14BBC8BB91D205E7B618A	analisi di mercato	http://data.europa.eu/esco/skill/b011c8b4-76e1-4bbc-8bb9-1d205e7b618a	KNOWLEDGE	AVANZATO	ESSENZIALE
R039	ESCO_B679EF35EEBF4DA88E45FEE6841C3214	collaborare allo sviluppo di strategie di marketing	http://data.europa.eu/esco/skill/b679ef35-eebf-4da8-8e45-fee6841c3214	SKILL	INTERMEDIO	ESSENZIALE
R039	ESCO_D207A30B2F8041389B77F88D549B8768	individuare le nuove opportunità commerciali	http://data.europa.eu/esco/skill/d207a30b-2f80-4138-9b77-f88d549b8768	SKILL	AVANZATO	ESSENZIALE
R039	ESCO_DE03F4FDC1474477A0487109E5BA2D6F	principi di marketing	http://data.europa.eu/esco/skill/de03f4fd-c147-4477-a048-7109e5ba2d6f	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R039	ESCO_E7219848A27A4BF48775D367707BE7C9	strategie di vendita	http://data.europa.eu/esco/skill/e7219848-a27a-4bf4-8775-d367707be7c9	KNOWLEDGE	AVANZATO	ESSENZIALE
R039	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R040	ESCO_0D6714C6720E498597915AB85D28DA79	raccogliere i dati	http://data.europa.eu/esco/skill/0d6714c6-720e-4985-9791-5ab85d28da79	SKILL	INTERMEDIO	ESSENZIALE
R040	ESCO_2B92A5B267584EE39FB4B6387A55CC8F	eseguire l’analisi dei dati	http://data.europa.eu/esco/skill/2b92a5b2-6758-4ee3-9fb4-b6387a55cc8f	SKILL	AVANZATO	ESSENZIALE
R040	ESCO_382C11ED20D54AE7B60E15FEC527FA6C	applicare tecniche di analisi statistica	http://data.europa.eu/esco/skill/382c11ed-20d5-4ae7-b60e-15fec527fa6c	SKILL	AVANZATO	ESSENZIALE
R040	ESCO_3A58581803F1434CB41B9D3C4CEEDFAA	analizzare la qualità delle prestazioni relative alle chiamate	http://data.europa.eu/esco/skill/3a585818-03f1-434c-b41b-9d3c4ceedfaa	SKILL	AVANZATO	ESSENZIALE
R040	ESCO_3BB6F78F24F34799B24791A0C4BF5D81	analizzare le attività del call center	http://data.europa.eu/esco/skill/3bb6f78f-24f3-4799-b247-91a0c4bf5d81	SKILL	AVANZATO	ESSENZIALE
R040	ESCO_918F5211B99F4B299A346E475583EF55	scrivere relazioni connesse al lavoro	http://data.europa.eu/esco/skill/918f5211-b99f-4b29-9a34-6e475583ef55	SKILL	INTERMEDIO	ESSENZIALE
R040	ESCO_A571AE143E164FD3A6155646E0B0B696	controllare i dati	http://data.europa.eu/esco/skill/a571ae14-3e16-4fd3-a615-5646e0b0b696	SKILL	INTERMEDIO	ESSENZIALE
R040	ESCO_B535516B9F8A4C29B6AAA0A4561E1086	gestione della garanzia della qualità delle chiamate	http://data.europa.eu/esco/skill/b535516b-9f8a-4c29-b6aa-a0a4561e1086	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R040	ESCO_BE72777446D743D7AEE91A51B5CD8C71	eseguire le previsioni statistiche	http://data.europa.eu/esco/skill/be727774-46d7-43d7-aee9-1a51b5cd8c71	SKILL	AVANZATO	ESSENZIALE
R040	ESCO_E13B734A218C434AA7CCFEBAC6D24EF3	tecnologie di call center	http://data.europa.eu/esco/skill/e13b734a-218c-434a-a7cc-febac6d24ef3	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R041	ESCO_1DEA2F3A857C4FC3B1F8D5F2015C46A9	fornire istruzioni al personale	http://data.europa.eu/esco/skill/1dea2f3a-857c-4fc3-b1f8-d5f2015c46a9	SKILL	INTERMEDIO	ESSENZIALE
R041	ESCO_21FECC8A392E49CEAC26FB0696CCFEAD	creare specifiche di progetto	http://data.europa.eu/esco/skill/21fecc8a-392e-49ce-ac26-fb0696ccfead	SKILL	INTERMEDIO	ESSENZIALE
R041	ESCO_237DB40B460047C0837F4A2C4F3014AB	principi di gestione di un progetto	http://data.europa.eu/esco/skill/237db40b-4600-47c0-837f-4a2c4f3014ab	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R041	ESCO_2D008D5AB7BD46F7BBB15D70A0AF9C84	controllare le risorse finanziarie	http://data.europa.eu/esco/skill/2d008d5a-b7bd-46f7-bbb1-5d70a0af9c84	SKILL	AVANZATO	ESSENZIALE
R041	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	AVANZATO	ESSENZIALE
R041	ESCO_7111B95D0CE3441A9D924C75D05C4388	gestione di progetto	http://data.europa.eu/esco/skill/7111b95d-0ce3-441a-9d92-4c75d05c4388	KNOWLEDGE	AVANZATO	ESSENZIALE
R041	ESCO_811BDB9D5BF74B5AA3F54FC2002F6D57	capacità finanziaria	http://data.europa.eu/esco/skill/811bdb9d-5bf7-4b5a-a3f5-4fc2002f6d57	KNOWLEDGE	AVANZATO	ESSENZIALE
R041	ESCO_918F5211B99F4B299A346E475583EF55	scrivere relazioni connesse al lavoro	http://data.europa.eu/esco/skill/918f5211-b99f-4b29-9a34-6e475583ef55	SKILL	INTERMEDIO	ESSENZIALE
R041	ESCO_CD5EFA8CE44D4CBC91C6796018DBED68	eseguire la gestione del progetto	http://data.europa.eu/esco/skill/cd5efa8c-e44d-4cbc-91c6-796018dbed68	SKILL	AVANZATO	ESSENZIALE
R041	ESCO_FF862044D49E4417BF651AE2C0A47E5A	analizzare le relazioni scritte connesse al lavoro	http://data.europa.eu/esco/skill/ff862044-d49e-4417-bf65-1ae2c0a47e5a	SKILL	INTERMEDIO	ESSENZIALE
R042	ESCO_0295B2A4FB86495F9547D479532FC4C2	rintracciare le transazioni finanziarie	http://data.europa.eu/esco/skill/0295b2a4-fb86-495f-9547-d479532fc4c2	SKILL	INTERMEDIO	ESSENZIALE
R042	ESCO_0EDAAB251B724531950DD8B9A9F4A1C8	sistema di gestione della tesoreria	http://data.europa.eu/esco/skill/0edaab25-1b72-4531-950d-d8b9a9f4a1c8	KNOWLEDGE	AVANZATO	ESSENZIALE
R042	ESCO_21C5790C09304D74B3B084CAF5AF12EA	gestire i bilanci	http://data.europa.eu/esco/skill/21c5790c-0930-4d74-b3b0-84caf5af12ea	SKILL	AVANZATO	ESSENZIALE
R042	ESCO_2313B15DA9A748309BCCFD7DF79D842B	applicare le politiche finanziarie	http://data.europa.eu/esco/skill/2313b15d-a9a7-4830-9bcc-fd7df79d842b	SKILL	AVANZATO	ESSENZIALE
R042	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R042	ESCO_56FF27EF256545BFA70CF06D78D2A480	produrre un piano finanziario	http://data.europa.eu/esco/skill/56ff27ef-2565-45bf-a70c-f06d78d2a480	SKILL	INTERMEDIO	ESSENZIALE
R042	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	INTERMEDIO	ESSENZIALE
R042	ESCO_880C54F9866E4F37B5FA25EF8A7D49B6	tecniche contabili	http://data.europa.eu/esco/skill/880c54f9-866e-4f37-b5fa-25ef8a7d49b6	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R042	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R042	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	AVANZATO	ESSENZIALE
R043	ESCO_009DB49BFCF54409B4A5232D059F3597	applicare la politica di rischio del credito	http://data.europa.eu/esco/skill/009db49b-fcf5-4409-b4a5-232d059f3597	SKILL	AVANZATO	ESSENZIALE
R043	ESCO_2FD26AE6BD9846C7B1BA8A0B52734FAC	tecniche di riscossione debiti	http://data.europa.eu/esco/skill/2fd26ae6-bd98-46c7-b1ba-8a0b52734fac	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R043	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	INTERMEDIO	ESSENZIALE
R043	ESCO_5CD78D6BB4144A52A24AAE3BA1FFE7A1	definire la politica di credito	http://data.europa.eu/esco/skill/5cd78d6b-b414-4a52-a24a-ae3ba1ffe7a1	SKILL	AVANZATO	ESSENZIALE
R043	ESCO_7236D0D1127F4307A7D49730EE8A9167	determinare le condizioni di un prestito	http://data.europa.eu/esco/skill/7236d0d1-127f-4307-a7d4-9730ee8a9167	SKILL	AVANZATO	ESSENZIALE
R043	ESCO_7F7756FCD89D41D593EF85991603F4AD	gestire il rischio finanziario	http://data.europa.eu/esco/skill/7f7756fc-d89d-41d5-93ef-85991603f4ad	SKILL	AVANZATO	ESSENZIALE
R043	ESCO_AFE9C5D2E8BD43779D2D49B9589F05F9	analizzare le informazioni relative alla storia creditizia e alla capacità di rimborso di potenziali clienti	http://data.europa.eu/esco/skill/afe9c5d2-e8bd-4377-9d2d-49b9589f05f9	SKILL	AVANZATO	ESSENZIALE
R043	ESCO_B497A163DAF44F1BA6BA8C640D803979	sistemi di credito	http://data.europa.eu/esco/skill/b497a163-daf4-4f1b-a6ba-8c640d803979	KNOWLEDGE	AVANZATO	ESSENZIALE
R043	ESCO_E126F782B4E64F7D8DCA8D2E6778559B	processi di controllo del credito	http://data.europa.eu/esco/skill/e126f782-b4e6-4f7d-8dca-8d2e6778559b	KNOWLEDGE	AVANZATO	ESSENZIALE
R043	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R044	ESCO_00E53A0AC0BA4C9FA2ED4706D5832A00	garantire la soddisfazione del cliente	http://data.europa.eu/esco/skill/00e53a0a-c0ba-4c9f-a2ed-4706d5832a00	SKILL	AVANZATO	ESSENZIALE
R044	ESCO_03B9B491FC9B4868914ABF7CD47B5041	creare soluzioni a problemi	http://data.europa.eu/esco/skill/03b9b491-fc9b-4868-914a-bf7cd47b5041	SKILL	AVANZATO	ESSENZIALE
R044	ESCO_0DA516EEE70E4384BE13F5FF80BE8127	comunicare con i clienti	http://data.europa.eu/esco/skill/0da516ee-e70e-4384-be13-f5ff80be8127	SKILL	AVANZATO	ESSENZIALE
R044	ESCO_0EE94AF1B44549739C3F459FAB250342	gestire i conflitti	http://data.europa.eu/esco/skill/0ee94af1-b445-4973-9c3f-459fab250342	SKILL	AVANZATO	ESSENZIALE
R044	ESCO_15A33D764640438DAE64FDC0C1D3EEBC	servizio clienti	http://data.europa.eu/esco/skill/15a33d76-4640-438d-ae64-fdc0c1d3eebc	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R044	ESCO_68698869C13C4563ADC7118B7644F45D	individuare i desideri del cliente	http://data.europa.eu/esco/skill/68698869-c13c-4563-adc7-118b7644f45d	SKILL	AVANZATO	ESSENZIALE
R044	ESCO_732CB4DDAF914C889A9F5FC62144E500	fornire informazioni	http://data.europa.eu/esco/skill/732cb4dd-af91-4c88-9a9f-5fc62144e500	SKILL	INTERMEDIO	ESSENZIALE
R044	ESCO_8B7409B0E18E4DFC9AD98DDBCCE38849	tenere un archivio dell’interazione con il cliente	http://data.europa.eu/esco/skill/8b7409b0-e18e-4dfc-9ad9-8ddbcce38849	SKILL	INTERMEDIO	ESSENZIALE
R044	ESCO_A17286C5238D4F0BBC2429E9121345DE	ascoltare attivamente	http://data.europa.eu/esco/skill/a17286c5-238d-4f0b-bc24-29e9121345de	SKILL	AVANZATO	ESSENZIALE
R044	ESCO_A6D697D180BA417582D443440ED04270	trattare i rimborsi	http://data.europa.eu/esco/skill/a6d697d1-80ba-4175-82d4-43440ed04270	SKILL	AVANZATO	ESSENZIALE
R045	ESCO_1D25213CAB0145C58BB3F2FD9702A919	integrare le linee guida della sede nelle operazioni locali	http://data.europa.eu/esco/skill/1d25213c-ab01-45c5-8bb3-f2fd9702a919	SKILL	AVANZATO	ESSENZIALE
R045	ESCO_2910E2F0115F48689282604067153C4F	garantire la legalità delle operazioni aziendali	http://data.europa.eu/esco/skill/2910e2f0-115f-4868-9282-604067153c4f	SKILL	AVANZATO	ESSENZIALE
R045	ESCO_2D008D5AB7BD46F7BBB15D70A0AF9C84	controllare le risorse finanziarie	http://data.europa.eu/esco/skill/2d008d5a-b7bd-46f7-bbb1-5d70a0af9c84	SKILL	AVANZATO	ESSENZIALE
R045	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	AVANZATO	ESSENZIALE
R045	ESCO_496932F10B6B4F739432D95C7DDCD43B	assumere dipendenti	http://data.europa.eu/esco/skill/496932f1-0b6b-4f73-9432-d95c7ddcd43b	SKILL	INTERMEDIO	ESSENZIALE
R045	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R045	ESCO_6BC02A4A66AF4B499BD3D07695D52B42	rispettare il codice etico degli affari	http://data.europa.eu/esco/skill/6bc02a4a-66af-4b49-9bd3-d07695d52b42	SKILL	AVANZATO	ESSENZIALE
R045	ESCO_87DE6E49CA1C42A487515FF0B991966B	negoziare con le parti interessate	http://data.europa.eu/esco/skill/87de6e49-ca1c-42a4-8751-5ff0b991966b	SKILL	AVANZATO	ESSENZIALE
R045	ESCO_8DCBCABE09F74D11940D125AF57BBC40	individuare gli indicatori chiave di prestazione	http://data.europa.eu/esco/skill/8dcbcabe-09f7-4d11-940d-125af57bbc40	SKILL	AVANZATO	ESSENZIALE
R045	ESCO_DDC8DA70B94F43EF88DCAEBC7BEF4F7D	assumere la responsabilità della gestione di un’impresa	http://data.europa.eu/esco/skill/ddc8da70-b94f-43ef-88dc-aebc7bef4f7d	SKILL	AVANZATO	ESSENZIALE
R046	ESCO_1D25213CAB0145C58BB3F2FD9702A919	integrare le linee guida della sede nelle operazioni locali	http://data.europa.eu/esco/skill/1d25213c-ab01-45c5-8bb3-f2fd9702a919	SKILL	AVANZATO	ESSENZIALE
R046	ESCO_2910E2F0115F48689282604067153C4F	garantire la legalità delle operazioni aziendali	http://data.europa.eu/esco/skill/2910e2f0-115f-4868-9282-604067153c4f	SKILL	AVANZATO	ESSENZIALE
R046	ESCO_2D008D5AB7BD46F7BBB15D70A0AF9C84	controllare le risorse finanziarie	http://data.europa.eu/esco/skill/2d008d5a-b7bd-46f7-bbb1-5d70a0af9c84	SKILL	AVANZATO	ESSENZIALE
R046	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	AVANZATO	ESSENZIALE
R046	ESCO_496932F10B6B4F739432D95C7DDCD43B	assumere dipendenti	http://data.europa.eu/esco/skill/496932f1-0b6b-4f73-9432-d95c7ddcd43b	SKILL	INTERMEDIO	ESSENZIALE
R046	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R046	ESCO_6BC02A4A66AF4B499BD3D07695D52B42	rispettare il codice etico degli affari	http://data.europa.eu/esco/skill/6bc02a4a-66af-4b49-9bd3-d07695d52b42	SKILL	AVANZATO	ESSENZIALE
R046	ESCO_87DE6E49CA1C42A487515FF0B991966B	negoziare con le parti interessate	http://data.europa.eu/esco/skill/87de6e49-ca1c-42a4-8751-5ff0b991966b	SKILL	AVANZATO	ESSENZIALE
R046	ESCO_8DCBCABE09F74D11940D125AF57BBC40	individuare gli indicatori chiave di prestazione	http://data.europa.eu/esco/skill/8dcbcabe-09f7-4d11-940d-125af57bbc40	SKILL	AVANZATO	ESSENZIALE
R046	ESCO_DDC8DA70B94F43EF88DCAEBC7BEF4F7D	assumere la responsabilità della gestione di un’impresa	http://data.europa.eu/esco/skill/ddc8da70-b94f-43ef-88dc-aebc7bef4f7d	SKILL	AVANZATO	ESSENZIALE
R047	ESCO_1D25213CAB0145C58BB3F2FD9702A919	integrare le linee guida della sede nelle operazioni locali	http://data.europa.eu/esco/skill/1d25213c-ab01-45c5-8bb3-f2fd9702a919	SKILL	AVANZATO	ESSENZIALE
R047	ESCO_2910E2F0115F48689282604067153C4F	garantire la legalità delle operazioni aziendali	http://data.europa.eu/esco/skill/2910e2f0-115f-4868-9282-604067153c4f	SKILL	AVANZATO	ESSENZIALE
R047	ESCO_2D008D5AB7BD46F7BBB15D70A0AF9C84	controllare le risorse finanziarie	http://data.europa.eu/esco/skill/2d008d5a-b7bd-46f7-bbb1-5d70a0af9c84	SKILL	AVANZATO	ESSENZIALE
R047	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	AVANZATO	ESSENZIALE
R047	ESCO_496932F10B6B4F739432D95C7DDCD43B	assumere dipendenti	http://data.europa.eu/esco/skill/496932f1-0b6b-4f73-9432-d95c7ddcd43b	SKILL	INTERMEDIO	ESSENZIALE
R047	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R047	ESCO_6BC02A4A66AF4B499BD3D07695D52B42	rispettare il codice etico degli affari	http://data.europa.eu/esco/skill/6bc02a4a-66af-4b49-9bd3-d07695d52b42	SKILL	AVANZATO	ESSENZIALE
R047	ESCO_87DE6E49CA1C42A487515FF0B991966B	negoziare con le parti interessate	http://data.europa.eu/esco/skill/87de6e49-ca1c-42a4-8751-5ff0b991966b	SKILL	AVANZATO	ESSENZIALE
R047	ESCO_8DCBCABE09F74D11940D125AF57BBC40	individuare gli indicatori chiave di prestazione	http://data.europa.eu/esco/skill/8dcbcabe-09f7-4d11-940d-125af57bbc40	SKILL	AVANZATO	ESSENZIALE
R047	ESCO_DDC8DA70B94F43EF88DCAEBC7BEF4F7D	assumere la responsabilità della gestione di un’impresa	http://data.europa.eu/esco/skill/ddc8da70-b94f-43ef-88dc-aebc7bef4f7d	SKILL	AVANZATO	ESSENZIALE
R048	ESCO_0BD4C62AC309467EBE768403B3F3A1A8	prodotti finanziari	http://data.europa.eu/esco/skill/0bd4c62a-c309-467e-be76-8403b3f3a1a8	KNOWLEDGE	AVANZATO	ESSENZIALE
R048	ESCO_0DA516EEE70E4384BE13F5FF80BE8127	comunicare con i clienti	http://data.europa.eu/esco/skill/0da516ee-e70e-4384-be13-f5ff80be8127	SKILL	INTERMEDIO	ESSENZIALE
R048	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	AVANZATO	ESSENZIALE
R048	ESCO_603FC2C9B1BB4CF5BE48E62FBCD3A12E	gestire il caveau di una banca	http://data.europa.eu/esco/skill/603fc2c9-b1bb-4cf5-be48-e62fbcd3a12e	SKILL	INTERMEDIO	ESSENZIALE
R048	ESCO_BDCAC0C8B77A46409EAFC0CF3EFD1E23	elaborare i pagamenti	http://data.europa.eu/esco/skill/bdcac0c8-b77a-4640-9eaf-c0cf3efd1e23	SKILL	AVANZATO	ESSENZIALE
R048	ESCO_E3C7BD87EDC14D9AA3D536415DE1AAC6	offrire i servizi finanziari	http://data.europa.eu/esco/skill/e3c7bd87-edc1-4d9a-a3d5-36415de1aac6	SKILL	AVANZATO	ESSENZIALE
R048	ESCO_E92F46731DEC41ECB6EC36FEF226359C	fornire informazioni sui prodotti finanziari	http://data.europa.eu/esco/skill/e92f4673-1dec-41ec-b6ec-36fef226359c	SKILL	INTERMEDIO	ESSENZIALE
R048	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	AVANZATO	ESSENZIALE
R048	ESCO_FA3E5CEC703E4D46B3BBE8A89540AB54	gestire gli archivi digitali	http://data.europa.eu/esco/skill/fa3e5cec-703e-4d46-b3bb-e8a89540ab54	SKILL	BASE	UTILE
R048	ESCO_FAF8943C72FF4736A58725508695D6F0	tenere la contabilità	http://data.europa.eu/esco/skill/faf8943c-72ff-4736-a587-25508695d6f0	SKILL	INTERMEDIO	ESSENZIALE
R049	ESCO_0BD4C62AC309467EBE768403B3F3A1A8	prodotti finanziari	http://data.europa.eu/esco/skill/0bd4c62a-c309-467e-be76-8403b3f3a1a8	KNOWLEDGE	BASE	ESSENZIALE
R049	ESCO_0DA516EEE70E4384BE13F5FF80BE8127	comunicare con i clienti	http://data.europa.eu/esco/skill/0da516ee-e70e-4384-be13-f5ff80be8127	SKILL	BASE	ESSENZIALE
R049	ESCO_15A33D764640438DAE64FDC0C1D3EEBC	servizio clienti	http://data.europa.eu/esco/skill/15a33d76-4640-438d-ae64-fdc0c1d3eebc	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R049	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R049	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	BASE	ESSENZIALE
R049	ESCO_BDCAC0C8B77A46409EAFC0CF3EFD1E23	elaborare i pagamenti	http://data.europa.eu/esco/skill/bdcac0c8-b77a-4640-9eaf-c0cf3efd1e23	SKILL	INTERMEDIO	ESSENZIALE
R049	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	INTERMEDIO	ESSENZIALE
R049	ESCO_FAF8943C72FF4736A58725508695D6F0	tenere la contabilità	http://data.europa.eu/esco/skill/faf8943c-72ff-4736-a587-25508695d6f0	SKILL	INTERMEDIO	ESSENZIALE
R050	ESCO_0BD4C62AC309467EBE768403B3F3A1A8	prodotti finanziari	http://data.europa.eu/esco/skill/0bd4c62a-c309-467e-be76-8403b3f3a1a8	KNOWLEDGE	AVANZATO	ESSENZIALE
R050	ESCO_2239694B771A45868B542794E361A9AE	tenere rapporti con i clienti	http://data.europa.eu/esco/skill/2239694b-771a-4586-8b54-2794e361a9ae	SKILL	AVANZATO	ESSENZIALE
R050	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R050	ESCO_56FF27EF256545BFA70CF06D78D2A480	produrre un piano finanziario	http://data.europa.eu/esco/skill/56ff27ef-2565-45bf-a70c-f06d78d2a480	SKILL	AVANZATO	ESSENZIALE
R050	ESCO_58D8E3488BBC48279214822B1EE0007A	offrire consulenza in materia di investimenti	http://data.europa.eu/esco/skill/58d8e348-8bbc-4827-9214-822b1ee0007a	SKILL	AVANZATO	ESSENZIALE
R050	ESCO_6D97BF556FB6479582823EF915AE0BB8	reperire nuovi clienti	http://data.europa.eu/esco/skill/6d97bf55-6fb6-4795-8282-3ef915ae0bb8	SKILL	INTERMEDIO	ESSENZIALE
R050	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	AVANZATO	ESSENZIALE
R050	ESCO_905B6ACD377B46B99D80E47E9CA789CA	mercati finanziari	http://data.europa.eu/esco/skill/905b6acd-377b-46b9-9d80-e47e9ca789ca	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R050	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R050	ESCO_C503729B8F9143F682B8522B92826656	consultare il punteggio sull’affidabilità creditizia	http://data.europa.eu/esco/skill/c503729b-8f91-43f6-82b8-522b92826656	SKILL	AVANZATO	ESSENZIALE
R051	ESCO_12D9335678E7485799A6F00B4AE2EC77	analizzare i prestiti	http://data.europa.eu/esco/skill/12d93356-78e7-4857-99a6-f00b4ae2ec77	SKILL	AVANZATO	ESSENZIALE
R051	ESCO_34E0F0230CA94F64A9323248BB4ED5DF	intervistare i mutuatari	http://data.europa.eu/esco/skill/34e0f023-0ca9-4f64-a932-3248bb4ed5df	SKILL	INTERMEDIO	ESSENZIALE
R051	ESCO_41DF905992654D0DA94B6B0BB06C991B	decidere in merito alle domande di prestito	http://data.europa.eu/esco/skill/41df9059-9265-4d0d-a94b-6b0bb06c991b	SKILL	AVANZATO	ESSENZIALE
R051	ESCO_5DA3C76510A349EB934CEC401CEB1A34	analizzare i piani economici	http://data.europa.eu/esco/skill/5da3c765-10a3-49eb-934c-ec401ceb1a34	SKILL	AVANZATO	ESSENZIALE
R051	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	INTERMEDIO	ESSENZIALE
R051	ESCO_68BABD5264D14904A476173828217FD2	esaminare i rating di credito	http://data.europa.eu/esco/skill/68babd52-64d1-4904-a476-173828217fd2	SKILL	AVANZATO	ESSENZIALE
R051	ESCO_C503729B8F9143F682B8522B92826656	consultare il punteggio sull’affidabilità creditizia	http://data.europa.eu/esco/skill/c503729b-8f91-43f6-82b8-522b92826656	SKILL	AVANZATO	ESSENZIALE
R051	ESCO_D5AC6A937FBA49D493FDB38D23B556E8	fornire informazioni sui tassi di interesse	http://data.europa.eu/esco/skill/d5ac6a93-7fba-49d4-93fd-b38d23b556e8	SKILL	INTERMEDIO	ESSENZIALE
R051	ESCO_E126F782B4E64F7D8DCA8D2E6778559B	processi di controllo del credito	http://data.europa.eu/esco/skill/e126f782-b4e6-4f7d-8dca-8d2e6778559b	KNOWLEDGE	AVANZATO	ESSENZIALE
R051	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R052	ESCO_1DEA2F3A857C4FC3B1F8D5F2015C46A9	fornire istruzioni al personale	http://data.europa.eu/esco/skill/1dea2f3a-857c-4fc3-b1f8-d5f2015c46a9	SKILL	INTERMEDIO	ESSENZIALE
R052	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	AVANZATO	ESSENZIALE
R052	ESCO_415ABD43E8E54643B5DA5F11307AF57A	utilizzare canali di comunicazione diversi	http://data.europa.eu/esco/skill/415abd43-e8e5-4643-b5da-5f11307af57a	SKILL	BASE	ESSENZIALE
R052	ESCO_77E7CB082C6F42AB881BB34B2318ACBE	gestire sistemi amministrativi	http://data.europa.eu/esco/skill/77e7cb08-2c6f-42ab-881b-b34b2318acbe	SKILL	INTERMEDIO	ESSENZIALE
R052	ESCO_918F5211B99F4B299A346E475583EF55	scrivere relazioni connesse al lavoro	http://data.europa.eu/esco/skill/918f5211-b99f-4b29-9a34-6e475583ef55	SKILL	INTERMEDIO	ESSENZIALE
R052	ESCO_958B8802EC3E481397F76C8F48610DBD	individuare i miglioramenti dei processi	http://data.europa.eu/esco/skill/958b8802-ec3e-4813-97f7-6c8f48610dbd	SKILL	AVANZATO	ESSENZIALE
R052	ESCO_9D59F4E520A5428EB8B3645043500457	creare un’atmosfera di lavoro volta al miglioramento continuo	http://data.europa.eu/esco/skill/9d59f4e5-20a5-428e-b8b3-645043500457	SKILL	AVANZATO	ESSENZIALE
R052	ESCO_CB108A0A88E64579885DB1E794ADA512	gestire i fabbisogni di attrezzature da ufficio	http://data.europa.eu/esco/skill/cb108a0a-88e6-4579-885d-b1e794ada512	SKILL	BASE	ESSENZIALE
R052	ESCO_D58A48D15B7F4028AE11B051D13EE1A8	analizzare la capacità produttiva del personale	http://data.europa.eu/esco/skill/d58a48d1-5b7f-4028-ae11-b051d13ee1a8	SKILL	INTERMEDIO	ESSENZIALE
R052	ESCO_F2C63B7AED6C48909F8C7685D172624C	attuare la corporate governance	http://data.europa.eu/esco/skill/f2c63b7a-ed6c-4890-9f8c-7685d172624c	SKILL	AVANZATO	ESSENZIALE
R053	ESCO_0CB013AF6DD94FB2B34E63DDA1A5CF82	utilizzare il registratore di cassa	http://data.europa.eu/esco/skill/0cb013af-6dd9-4fb2-b34e-63dda1a5cf82	SKILL	BASE	ESSENZIALE
R053	ESCO_15A33D764640438DAE64FDC0C1D3EEBC	servizio clienti	http://data.europa.eu/esco/skill/15a33d76-4640-438d-ae64-fdc0c1d3eebc	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R053	ESCO_415ABD43E8E54643B5DA5F11307AF57A	utilizzare canali di comunicazione diversi	http://data.europa.eu/esco/skill/415abd43-e8e5-4643-b5da-5f11307af57a	SKILL	BASE	ESSENZIALE
R053	ESCO_5DD01A1E7BA04B7FA76CED811C12BFDE	applicare le competenze matematiche	http://data.europa.eu/esco/skill/5dd01a1e-7ba0-4b7f-a76c-ed811c12bfde	SKILL	BASE	ESSENZIALE
R053	ESCO_A6D697D180BA417582D443440ED04270	trattare i rimborsi	http://data.europa.eu/esco/skill/a6d697d1-80ba-4175-82d4-43440ed04270	SKILL	BASE	ESSENZIALE
R053	ESCO_B7C8F41808D545D6B697AB26C6ECBFB4	orientare di clienti	http://data.europa.eu/esco/skill/b7c8f418-08d5-45d6-b697-ab26c6ecbfb4	SKILL	BASE	ESSENZIALE
R053	ESCO_BDCAC0C8B77A46409EAFC0CF3EFD1E23	elaborare i pagamenti	http://data.europa.eu/esco/skill/bdcac0c8-b77a-4640-9eaf-c0cf3efd1e23	SKILL	INTERMEDIO	ESSENZIALE
R053	ESCO_DEBB8D81ED7F447D853A5D107FDA6FCF	fornire ai clienti servizi assistenza	http://data.europa.eu/esco/skill/debb8d81-ed7f-447d-853a-5d107fda6fcf	SKILL	INTERMEDIO	ESSENZIALE
R053	ESCO_E3E42D5478BD4337AA87BB31A7670C9A	emettere le fatture di vendita	http://data.europa.eu/esco/skill/e3e42d54-78bd-4337-aa87-bb31a7670c9a	SKILL	BASE	ESSENZIALE
R053	ESCO_EFE5D94C22494A508C446E77331C698D	gestire la prevenzione dei furti	http://data.europa.eu/esco/skill/efe5d94c-2249-4a50-8c44-6e77331c698d	SKILL	BASE	ESSENZIALE
R054	ESCO_0BD4C62AC309467EBE768403B3F3A1A8	prodotti finanziari	http://data.europa.eu/esco/skill/0bd4c62a-c309-467e-be76-8403b3f3a1a8	KNOWLEDGE	AVANZATO	ESSENZIALE
R054	ESCO_2239694B771A45868B542794E361A9AE	tenere rapporti con i clienti	http://data.europa.eu/esco/skill/2239694b-771a-4586-8b54-2794e361a9ae	SKILL	AVANZATO	ESSENZIALE
R054	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R054	ESCO_56FF27EF256545BFA70CF06D78D2A480	produrre un piano finanziario	http://data.europa.eu/esco/skill/56ff27ef-2565-45bf-a70c-f06d78d2a480	SKILL	AVANZATO	ESSENZIALE
R054	ESCO_58D8E3488BBC48279214822B1EE0007A	offrire consulenza in materia di investimenti	http://data.europa.eu/esco/skill/58d8e348-8bbc-4827-9214-822b1ee0007a	SKILL	AVANZATO	ESSENZIALE
R054	ESCO_6D97BF556FB6479582823EF915AE0BB8	reperire nuovi clienti	http://data.europa.eu/esco/skill/6d97bf55-6fb6-4795-8282-3ef915ae0bb8	SKILL	INTERMEDIO	ESSENZIALE
R054	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	AVANZATO	ESSENZIALE
R054	ESCO_905B6ACD377B46B99D80E47E9CA789CA	mercati finanziari	http://data.europa.eu/esco/skill/905b6acd-377b-46b9-9d80-e47e9ca789ca	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R054	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R054	ESCO_C503729B8F9143F682B8522B92826656	consultare il punteggio sull’affidabilità creditizia	http://data.europa.eu/esco/skill/c503729b-8f91-43f6-82b8-522b92826656	SKILL	AVANZATO	ESSENZIALE
R055	ESCO_12D9335678E7485799A6F00B4AE2EC77	analizzare i prestiti	http://data.europa.eu/esco/skill/12d93356-78e7-4857-99a6-f00b4ae2ec77	SKILL	AVANZATO	ESSENZIALE
R055	ESCO_34E0F0230CA94F64A9323248BB4ED5DF	intervistare i mutuatari	http://data.europa.eu/esco/skill/34e0f023-0ca9-4f64-a932-3248bb4ed5df	SKILL	INTERMEDIO	ESSENZIALE
R055	ESCO_41DF905992654D0DA94B6B0BB06C991B	decidere in merito alle domande di prestito	http://data.europa.eu/esco/skill/41df9059-9265-4d0d-a94b-6b0bb06c991b	SKILL	AVANZATO	ESSENZIALE
R055	ESCO_5DA3C76510A349EB934CEC401CEB1A34	analizzare i piani economici	http://data.europa.eu/esco/skill/5da3c765-10a3-49eb-934c-ec401ceb1a34	SKILL	AVANZATO	ESSENZIALE
R055	ESCO_68BABD5264D14904A476173828217FD2	esaminare i rating di credito	http://data.europa.eu/esco/skill/68babd52-64d1-4904-a476-173828217fd2	SKILL	AVANZATO	ESSENZIALE
R055	ESCO_71AE4F6465054B6F91B95ACFA5721798	ottenere le informazioni finanziarie	http://data.europa.eu/esco/skill/71ae4f64-6505-4b6f-91b9-5acfa5721798	SKILL	INTERMEDIO	ESSENZIALE
R055	ESCO_C35B19ADB06F44E8BE9FC20C68750346	monitorare il portafoglio prestiti	http://data.europa.eu/esco/skill/c35b19ad-b06f-44e8-be9f-c20c68750346	SKILL	AVANZATO	ESSENZIALE
R055	ESCO_C503729B8F9143F682B8522B92826656	consultare il punteggio sull’affidabilità creditizia	http://data.europa.eu/esco/skill/c503729b-8f91-43f6-82b8-522b92826656	SKILL	AVANZATO	ESSENZIALE
R055	ESCO_D5AC6A937FBA49D493FDB38D23B556E8	fornire informazioni sui tassi di interesse	http://data.europa.eu/esco/skill/d5ac6a93-7fba-49d4-93fd-b38d23b556e8	SKILL	INTERMEDIO	ESSENZIALE
R055	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R056	ESCO_1DEA2F3A857C4FC3B1F8D5F2015C46A9	fornire istruzioni al personale	http://data.europa.eu/esco/skill/1dea2f3a-857c-4fc3-b1f8-d5f2015c46a9	SKILL	INTERMEDIO	ESSENZIALE
R056	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	AVANZATO	ESSENZIALE
R056	ESCO_415ABD43E8E54643B5DA5F11307AF57A	utilizzare canali di comunicazione diversi	http://data.europa.eu/esco/skill/415abd43-e8e5-4643-b5da-5f11307af57a	SKILL	INTERMEDIO	ESSENZIALE
R056	ESCO_71DDE84C00584C52A556523369333DB8	utilizzare i sistemi per ufficio	http://data.europa.eu/esco/skill/71dde84c-0058-4c52-a556-523369333db8	SKILL	BASE	ESSENZIALE
R056	ESCO_77E7CB082C6F42AB881BB34B2318ACBE	gestire sistemi amministrativi	http://data.europa.eu/esco/skill/77e7cb08-2c6f-42ab-881b-b34b2318acbe	SKILL	INTERMEDIO	ESSENZIALE
R056	ESCO_7D35602DBC944975AA7CF4E8E05CE8E0	gestione dei costi	http://data.europa.eu/esco/skill/7d35602d-bc94-4975-aa7c-f4e8e05ce8e0	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R056	ESCO_958B8802EC3E481397F76C8F48610DBD	individuare i miglioramenti dei processi	http://data.europa.eu/esco/skill/958b8802-ec3e-4813-97f7-6c8f48610dbd	SKILL	INTERMEDIO	ESSENZIALE
R056	ESCO_9D59F4E520A5428EB8B3645043500457	creare un’atmosfera di lavoro volta al miglioramento continuo	http://data.europa.eu/esco/skill/9d59f4e5-20a5-428e-b8b3-645043500457	SKILL	INTERMEDIO	ESSENZIALE
R056	ESCO_D58A48D15B7F4028AE11B051D13EE1A8	analizzare la capacità produttiva del personale	http://data.europa.eu/esco/skill/d58a48d1-5b7f-4028-ae11-b051d13ee1a8	SKILL	INTERMEDIO	ESSENZIALE
R056	ESCO_F2C63B7AED6C48909F8C7685D172624C	attuare la corporate governance	http://data.europa.eu/esco/skill/f2c63b7a-ed6c-4890-9f8c-7685d172624c	SKILL	INTERMEDIO	ESSENZIALE
R057	ESCO_0CB013AF6DD94FB2B34E63DDA1A5CF82	utilizzare il registratore di cassa	http://data.europa.eu/esco/skill/0cb013af-6dd9-4fb2-b34e-63dda1a5cf82	SKILL	AVANZATO	ESSENZIALE
R057	ESCO_15A33D764640438DAE64FDC0C1D3EEBC	servizio clienti	http://data.europa.eu/esco/skill/15a33d76-4640-438d-ae64-fdc0c1d3eebc	KNOWLEDGE	AVANZATO	ESSENZIALE
R057	ESCO_415ABD43E8E54643B5DA5F11307AF57A	utilizzare canali di comunicazione diversi	http://data.europa.eu/esco/skill/415abd43-e8e5-4643-b5da-5f11307af57a	SKILL	INTERMEDIO	ESSENZIALE
R057	ESCO_5DD01A1E7BA04B7FA76CED811C12BFDE	applicare le competenze matematiche	http://data.europa.eu/esco/skill/5dd01a1e-7ba0-4b7f-a76c-ed811c12bfde	SKILL	INTERMEDIO	ESSENZIALE
R057	ESCO_A6D697D180BA417582D443440ED04270	trattare i rimborsi	http://data.europa.eu/esco/skill/a6d697d1-80ba-4175-82d4-43440ed04270	SKILL	INTERMEDIO	ESSENZIALE
R057	ESCO_B7C8F41808D545D6B697AB26C6ECBFB4	orientare di clienti	http://data.europa.eu/esco/skill/b7c8f418-08d5-45d6-b697-ab26c6ecbfb4	SKILL	BASE	ESSENZIALE
R057	ESCO_BDCAC0C8B77A46409EAFC0CF3EFD1E23	elaborare i pagamenti	http://data.europa.eu/esco/skill/bdcac0c8-b77a-4640-9eaf-c0cf3efd1e23	SKILL	AVANZATO	ESSENZIALE
R057	ESCO_DEBB8D81ED7F447D853A5D107FDA6FCF	fornire ai clienti servizi assistenza	http://data.europa.eu/esco/skill/debb8d81-ed7f-447d-853a-5d107fda6fcf	SKILL	INTERMEDIO	ESSENZIALE
R057	ESCO_E3E42D5478BD4337AA87BB31A7670C9A	emettere le fatture di vendita	http://data.europa.eu/esco/skill/e3e42d54-78bd-4337-aa87-bb31a7670c9a	SKILL	BASE	ESSENZIALE
R057	ESCO_EFE5D94C22494A508C446E77331C698D	gestire la prevenzione dei furti	http://data.europa.eu/esco/skill/efe5d94c-2249-4a50-8c44-6e77331c698d	SKILL	INTERMEDIO	ESSENZIALE
R058	ESCO_2239694B771A45868B542794E361A9AE	tenere rapporti con i clienti	http://data.europa.eu/esco/skill/2239694b-771a-4586-8b54-2794e361a9ae	SKILL	AVANZATO	ESSENZIALE
R058	ESCO_2A2FA8E8AAF34ABFA60BAF6415F1C6D4	impegnarsi per far crescere l’azienda	http://data.europa.eu/esco/skill/2a2fa8e8-aaf3-4abf-a60b-af6415f1c6d4	SKILL	AVANZATO	ESSENZIALE
R058	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R058	ESCO_56FF27EF256545BFA70CF06D78D2A480	produrre un piano finanziario	http://data.europa.eu/esco/skill/56ff27ef-2565-45bf-a70c-f06d78d2a480	SKILL	AVANZATO	ESSENZIALE
R058	ESCO_6D97BF556FB6479582823EF915AE0BB8	reperire nuovi clienti	http://data.europa.eu/esco/skill/6d97bf55-6fb6-4795-8282-3ef915ae0bb8	SKILL	INTERMEDIO	ESSENZIALE
R058	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	AVANZATO	ESSENZIALE
R058	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R058	ESCO_C503729B8F9143F682B8522B92826656	consultare il punteggio sull’affidabilità creditizia	http://data.europa.eu/esco/skill/c503729b-8f91-43f6-82b8-522b92826656	SKILL	AVANZATO	ESSENZIALE
R058	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	AVANZATO	ESSENZIALE
R058	ESCO_F5F5B2446CEA4FBC8A508F712791BC09	osservare le norme aziendali	http://data.europa.eu/esco/skill/f5f5b244-6cea-4fbc-8a50-8f712791bc09	SKILL	INTERMEDIO	ESSENZIALE
R059	ESCO_0BD4C62AC309467EBE768403B3F3A1A8	prodotti finanziari	http://data.europa.eu/esco/skill/0bd4c62a-c309-467e-be76-8403b3f3a1a8	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R059	ESCO_15A33D764640438DAE64FDC0C1D3EEBC	servizio clienti	http://data.europa.eu/esco/skill/15a33d76-4640-438d-ae64-fdc0c1d3eebc	KNOWLEDGE	AVANZATO	ESSENZIALE
R059	ESCO_2239694B771A45868B542794E361A9AE	tenere rapporti con i clienti	http://data.europa.eu/esco/skill/2239694b-771a-4586-8b54-2794e361a9ae	SKILL	AVANZATO	ESSENZIALE
R059	ESCO_58D8E3488BBC48279214822B1EE0007A	offrire consulenza in materia di investimenti	http://data.europa.eu/esco/skill/58d8e348-8bbc-4827-9214-822b1ee0007a	SKILL	AVANZATO	ESSENZIALE
R059	ESCO_68698869C13C4563ADC7118B7644F45D	individuare i desideri del cliente	http://data.europa.eu/esco/skill/68698869-c13c-4563-adc7-118b7644f45d	SKILL	AVANZATO	ESSENZIALE
R059	ESCO_6D97BF556FB6479582823EF915AE0BB8	reperire nuovi clienti	http://data.europa.eu/esco/skill/6d97bf55-6fb6-4795-8282-3ef915ae0bb8	SKILL	AVANZATO	ESSENZIALE
R059	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	AVANZATO	ESSENZIALE
R059	ESCO_84F583F4F32A42029B92E25F0C978410	software per attività bancarie essenziali	http://data.europa.eu/esco/skill/84f583f4-f32a-4202-9b92-e25f0c978410	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R059	ESCO_E3C7BD87EDC14D9AA3D536415DE1AAC6	offrire i servizi finanziari	http://data.europa.eu/esco/skill/e3c7bd87-edc1-4d9a-a3d5-36415de1aac6	SKILL	AVANZATO	ESSENZIALE
R059	ESCO_E92F46731DEC41ECB6EC36FEF226359C	fornire informazioni sui prodotti finanziari	http://data.europa.eu/esco/skill/e92f4673-1dec-41ec-b6ec-36fef226359c	SKILL	INTERMEDIO	ESSENZIALE
R060	ESCO_00E53A0AC0BA4C9FA2ED4706D5832A00	garantire la soddisfazione del cliente	http://data.europa.eu/esco/skill/00e53a0a-c0ba-4c9f-a2ed-4706d5832a00	SKILL	INTERMEDIO	ESSENZIALE
R060	ESCO_05FC6F8D639C4329A6DEDFDD800ED091	comprensione del cliente	http://data.europa.eu/esco/skill/05fc6f8d-639c-4329-a6de-dfdd800ed091	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R060	ESCO_0DA516EEE70E4384BE13F5FF80BE8127	comunicare con i clienti	http://data.europa.eu/esco/skill/0da516ee-e70e-4384-be13-f5ff80be8127	SKILL	AVANZATO	ESSENZIALE
R060	ESCO_1585FC98BFE4461F97FC734055A2C3CE	caratteristiche dei prodotti	http://data.europa.eu/esco/skill/1585fc98-bfe4-461f-97fc-734055a2c3ce	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R060	ESCO_15A33D764640438DAE64FDC0C1D3EEBC	servizio clienti	http://data.europa.eu/esco/skill/15a33d76-4640-438d-ae64-fdc0c1d3eebc	KNOWLEDGE	AVANZATO	ESSENZIALE
R060	ESCO_5A0BFFCF4FF649CFA7DB4142E63F5F04	rispondere alle chiamate in arrivo	http://data.europa.eu/esco/skill/5a0bffcf-4ff6-49cf-a7db-4142e63f5f04	SKILL	AVANZATO	ESSENZIALE
R060	ESCO_8B7409B0E18E4DFC9AD98DDBCCE38849	tenere un archivio dell’interazione con il cliente	http://data.europa.eu/esco/skill/8b7409b0-e18e-4dfc-9ad9-8ddbcce38849	SKILL	INTERMEDIO	ESSENZIALE
R060	ESCO_91306A209B814F3D97EBF5368B607DA7	gestire i clienti	http://data.europa.eu/esco/skill/91306a20-9b81-4f3d-97eb-f5368b607da7	SKILL	INTERMEDIO	ESSENZIALE
R060	ESCO_A3E7EBBA51834DF8920335B9B9B8F4FA	raccogliere i dati dei clienti	http://data.europa.eu/esco/skill/a3e7ebba-5183-4df8-9203-35b9b9b8f4fa	SKILL	INTERMEDIO	ESSENZIALE
R060	ESCO_DE2F0CE8F8D648C5A2134D065251CECF	comunicare tramite telefono	http://data.europa.eu/esco/skill/de2f0ce8-f8d6-48c5-a213-4d065251cecf	SKILL	AVANZATO	ESSENZIALE
R061	ESCO_00E53A0AC0BA4C9FA2ED4706D5832A00	garantire la soddisfazione del cliente	http://data.europa.eu/esco/skill/00e53a0a-c0ba-4c9f-a2ed-4706d5832a00	SKILL	AVANZATO	ESSENZIALE
R061	ESCO_03B9B491FC9B4868914ABF7CD47B5041	creare soluzioni a problemi	http://data.europa.eu/esco/skill/03b9b491-fc9b-4868-914a-bf7cd47b5041	SKILL	INTERMEDIO	ESSENZIALE
R061	ESCO_0DA516EEE70E4384BE13F5FF80BE8127	comunicare con i clienti	http://data.europa.eu/esco/skill/0da516ee-e70e-4384-be13-f5ff80be8127	SKILL	AVANZATO	ESSENZIALE
R061	ESCO_31C839038FC84BD89CA47A98A9C31EAE	eseguire l’analisi dei bisogni dei clienti	http://data.europa.eu/esco/skill/31c83903-8fc8-4bd8-9ca4-7a98a9c31eae	SKILL	INTERMEDIO	ESSENZIALE
R061	ESCO_68698869C13C4563ADC7118B7644F45D	individuare i desideri del cliente	http://data.europa.eu/esco/skill/68698869-c13c-4563-adc7-118b7644f45d	SKILL	INTERMEDIO	ESSENZIALE
R061	ESCO_A3E7EBBA51834DF8920335B9B9B8F4FA	raccogliere i dati dei clienti	http://data.europa.eu/esco/skill/a3e7ebba-5183-4df8-9203-35b9b9b8f4fa	SKILL	BASE	UTILE
R061	ESCO_B215031ADD2148B1A99875D6373838D8	comunicare con il reparto assistenza clienti	http://data.europa.eu/esco/skill/b215031a-dd21-48b1-a998-75d6373838d8	SKILL	INTERMEDIO	UTILE
R061	ESCO_C09C5786A47946DEB0AAD5D2D8CCC123	gestire l’assistenza clienti	http://data.europa.eu/esco/skill/c09c5786-a479-46de-b0aa-d5d2d8ccc123	SKILL	AVANZATO	ESSENZIALE
R061	ESCO_EADE41713D574FB2951844D5A1DA4FF5	instaurare un clima di fiducia	http://data.europa.eu/esco/skill/eade4171-3d57-4fb2-9518-44d5a1da4ff5	SKILL	INTERMEDIO	ESSENZIALE
R061	ESCO_F5F5B2446CEA4FBC8A508F712791BC09	osservare le norme aziendali	http://data.europa.eu/esco/skill/f5f5b244-6cea-4fbc-8a50-8f712791bc09	SKILL	BASE	ESSENZIALE
R062	ESCO_009DB49BFCF54409B4A5232D059F3597	applicare la politica di rischio del credito	http://data.europa.eu/esco/skill/009db49b-fcf5-4409-b4a5-232d059f3597	SKILL	AVANZATO	ESSENZIALE
R062	ESCO_2A2FA8E8AAF34ABFA60BAF6415F1C6D4	impegnarsi per far crescere l’azienda	http://data.europa.eu/esco/skill/2a2fa8e8-aaf3-4abf-a60b-af6415f1c6d4	SKILL	INTERMEDIO	ESSENZIALE
R062	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	INTERMEDIO	ESSENZIALE
R062	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	INTERMEDIO	UTILE
R062	ESCO_5CD78D6BB4144A52A24AAE3BA1FFE7A1	definire la politica di credito	http://data.europa.eu/esco/skill/5cd78d6b-b414-4a52-a24a-ae3ba1ffe7a1	SKILL	AVANZATO	ESSENZIALE
R062	ESCO_7236D0D1127F4307A7D49730EE8A9167	determinare le condizioni di un prestito	http://data.europa.eu/esco/skill/7236d0d1-127f-4307-a7d4-9730ee8a9167	SKILL	AVANZATO	ESSENZIALE
R062	ESCO_7F7756FCD89D41D593EF85991603F4AD	gestire il rischio finanziario	http://data.europa.eu/esco/skill/7f7756fc-d89d-41d5-93ef-85991603f4ad	SKILL	AVANZATO	ESSENZIALE
R062	ESCO_B497A163DAF44F1BA6BA8C640D803979	sistemi di credito	http://data.europa.eu/esco/skill/b497a163-daf4-4f1b-a6ba-8c640d803979	KNOWLEDGE	AVANZATO	ESSENZIALE
R062	ESCO_E126F782B4E64F7D8DCA8D2E6778559B	processi di controllo del credito	http://data.europa.eu/esco/skill/e126f782-b4e6-4f7d-8dca-8d2e6778559b	KNOWLEDGE	AVANZATO	ESSENZIALE
R062	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R063	ESCO_009DB49BFCF54409B4A5232D059F3597	applicare la politica di rischio del credito	http://data.europa.eu/esco/skill/009db49b-fcf5-4409-b4a5-232d059f3597	SKILL	AVANZATO	ESSENZIALE
R063	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	BASE	ESSENZIALE
R063	ESCO_68BABD5264D14904A476173828217FD2	esaminare i rating di credito	http://data.europa.eu/esco/skill/68babd52-64d1-4904-a476-173828217fd2	SKILL	INTERMEDIO	UTILE
R063	ESCO_71AE4F6465054B6F91B95ACFA5721798	ottenere le informazioni finanziarie	http://data.europa.eu/esco/skill/71ae4f64-6505-4b6f-91b9-5acfa5721798	SKILL	INTERMEDIO	ESSENZIALE
R063	ESCO_7236D0D1127F4307A7D49730EE8A9167	determinare le condizioni di un prestito	http://data.europa.eu/esco/skill/7236d0d1-127f-4307-a7d4-9730ee8a9167	SKILL	AVANZATO	ESSENZIALE
R063	ESCO_AFE9C5D2E8BD43779D2D49B9589F05F9	analizzare le informazioni relative alla storia creditizia e alla capacità di rimborso di potenziali clienti	http://data.europa.eu/esco/skill/afe9c5d2-e8bd-4377-9d2d-49b9589f05f9	SKILL	AVANZATO	ESSENZIALE
R063	ESCO_B497A163DAF44F1BA6BA8C640D803979	sistemi di credito	http://data.europa.eu/esco/skill/b497a163-daf4-4f1b-a6ba-8c640d803979	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R063	ESCO_C503729B8F9143F682B8522B92826656	consultare il punteggio sull’affidabilità creditizia	http://data.europa.eu/esco/skill/c503729b-8f91-43f6-82b8-522b92826656	SKILL	INTERMEDIO	UTILE
R063	ESCO_E126F782B4E64F7D8DCA8D2E6778559B	processi di controllo del credito	http://data.europa.eu/esco/skill/e126f782-b4e6-4f7d-8dca-8d2e6778559b	KNOWLEDGE	AVANZATO	ESSENZIALE
R063	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R064	ESCO_0EFBE2DC277047ECB8F4D1BDFF6AC0A4	offrire consulenza sulla gestione dei rischi	http://data.europa.eu/esco/skill/0efbe2dc-2770-47ec-b8f4-d1bdff6ac0a4	SKILL	AVANZATO	ESSENZIALE
R064	ESCO_102B6BA8452C4F6B8B3F1AB5A2D02FFE	fornire consulenza sul rating di credito	http://data.europa.eu/esco/skill/102b6ba8-452c-4f6b-8b3f-1ab5a2d02ffe	SKILL	AVANZATO	ESSENZIALE
R064	ESCO_12D9335678E7485799A6F00B4AE2EC77	analizzare i prestiti	http://data.europa.eu/esco/skill/12d93356-78e7-4857-99a6-f00b4ae2ec77	SKILL	AVANZATO	ESSENZIALE
R064	ESCO_5C99D21A9D0246389B52A6BA840DCB0A	sintetizzare le informazioni finanziarie	http://data.europa.eu/esco/skill/5c99d21a-9d02-4638-9b52-a6ba840dcb0a	SKILL	INTERMEDIO	ESSENZIALE
R064	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	AVANZATO	ESSENZIALE
R064	ESCO_71AE4F6465054B6F91B95ACFA5721798	ottenere le informazioni finanziarie	http://data.europa.eu/esco/skill/71ae4f64-6505-4b6f-91b9-5acfa5721798	SKILL	INTERMEDIO	ESSENZIALE
R064	ESCO_95FC86DE8E7447539344281179AA74B0	mantenere uno storico dei crediti dei clienti	http://data.europa.eu/esco/skill/95fc86de-8e74-4753-9344-281179aa74b0	SKILL	INTERMEDIO	ESSENZIALE
R064	ESCO_9DA2279543834BEA9AC5E80FDF16ECE5	eseguire le indagini sul credito	http://data.europa.eu/esco/skill/9da22795-4383-4bea-9ac5-e80fdf16ece5	SKILL	AVANZATO	ESSENZIALE
R064	ESCO_AFE9C5D2E8BD43779D2D49B9589F05F9	analizzare le informazioni relative alla storia creditizia e alla capacità di rimborso di potenziali clienti	http://data.europa.eu/esco/skill/afe9c5d2-e8bd-4377-9d2d-49b9589f05f9	SKILL	AVANZATO	ESSENZIALE
R064	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R065	ESCO_12D9335678E7485799A6F00B4AE2EC77	analizzare i prestiti	http://data.europa.eu/esco/skill/12d93356-78e7-4857-99a6-f00b4ae2ec77	SKILL	INTERMEDIO	ESSENZIALE
R065	ESCO_24016006C9634135A2C5B1F7740782E2	tenere un archivio dei debiti del cliente	http://data.europa.eu/esco/skill/24016006-c963-4135-a2c5-b1f7740782e2	SKILL	BASE	ESSENZIALE
R065	ESCO_34E0F0230CA94F64A9323248BB4ED5DF	intervistare i mutuatari	http://data.europa.eu/esco/skill/34e0f023-0ca9-4f64-a932-3248bb4ed5df	SKILL	BASE	UTILE
R065	ESCO_4A460161EAEA4FE2BD0E164CCC635BE1	rendiconti d’esercizio	http://data.europa.eu/esco/skill/4a460161-eaea-4fe2-bd0e-164ccc635be1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R065	ESCO_5C99D21A9D0246389B52A6BA840DCB0A	sintetizzare le informazioni finanziarie	http://data.europa.eu/esco/skill/5c99d21a-9d02-4638-9b52-a6ba840dcb0a	SKILL	BASE	ESSENZIALE
R065	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	INTERMEDIO	ESSENZIALE
R065	ESCO_71AE4F6465054B6F91B95ACFA5721798	ottenere le informazioni finanziarie	http://data.europa.eu/esco/skill/71ae4f64-6505-4b6f-91b9-5acfa5721798	SKILL	BASE	ESSENZIALE
R065	ESCO_9DA2279543834BEA9AC5E80FDF16ECE5	eseguire le indagini sul credito	http://data.europa.eu/esco/skill/9da22795-4383-4bea-9ac5-e80fdf16ece5	SKILL	INTERMEDIO	ESSENZIALE
R065	ESCO_AFE9C5D2E8BD43779D2D49B9589F05F9	analizzare le informazioni relative alla storia creditizia e alla capacità di rimborso di potenziali clienti	http://data.europa.eu/esco/skill/afe9c5d2-e8bd-4377-9d2d-49b9589f05f9	SKILL	INTERMEDIO	ESSENZIALE
R065	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	INTERMEDIO	ESSENZIALE
R066	ESCO_12D9335678E7485799A6F00B4AE2EC77	analizzare i prestiti	http://data.europa.eu/esco/skill/12d93356-78e7-4857-99a6-f00b4ae2ec77	SKILL	INTERMEDIO	ESSENZIALE
R066	ESCO_24016006C9634135A2C5B1F7740782E2	tenere un archivio dei debiti del cliente	http://data.europa.eu/esco/skill/24016006-c963-4135-a2c5-b1f7740782e2	SKILL	BASE	ESSENZIALE
R066	ESCO_36570124E7784213862EC4059EB5C224	valutare la situazione finanziaria del debitore	http://data.europa.eu/esco/skill/36570124-e778-4213-862e-c4059eb5c224	SKILL	AVANZATO	ESSENZIALE
R066	ESCO_68BABD5264D14904A476173828217FD2	esaminare i rating di credito	http://data.europa.eu/esco/skill/68babd52-64d1-4904-a476-173828217fd2	SKILL	INTERMEDIO	ESSENZIALE
R066	ESCO_91003B4AF2AA4472A9C14597ABB518F2	diritto fallimentare	http://data.europa.eu/esco/skill/91003b4a-f2aa-4472-a9c1-4597abb518f2	KNOWLEDGE	AVANZATO	ESSENZIALE
R066	ESCO_95FC86DE8E7447539344281179AA74B0	mantenere uno storico dei crediti dei clienti	http://data.europa.eu/esco/skill/95fc86de-8e74-4753-9344-281179aa74b0	SKILL	INTERMEDIO	ESSENZIALE
R066	ESCO_9DA2279543834BEA9AC5E80FDF16ECE5	eseguire le indagini sul credito	http://data.europa.eu/esco/skill/9da22795-4383-4bea-9ac5-e80fdf16ece5	SKILL	AVANZATO	ESSENZIALE
R066	ESCO_AFE9C5D2E8BD43779D2D49B9589F05F9	analizzare le informazioni relative alla storia creditizia e alla capacità di rimborso di potenziali clienti	http://data.europa.eu/esco/skill/afe9c5d2-e8bd-4377-9d2d-49b9589f05f9	SKILL	AVANZATO	ESSENZIALE
R066	ESCO_C503729B8F9143F682B8522B92826656	consultare il punteggio sull’affidabilità creditizia	http://data.europa.eu/esco/skill/c503729b-8f91-43f6-82b8-522b92826656	SKILL	INTERMEDIO	ESSENZIALE
R066	ESCO_E126F782B4E64F7D8DCA8D2E6778559B	processi di controllo del credito	http://data.europa.eu/esco/skill/e126f782-b4e6-4f7d-8dca-8d2e6778559b	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R067	ESCO_0839EEA4C57B4C14B19B923FBEDB5D88	effettuare una ricerca per fini aziendali	http://data.europa.eu/esco/skill/0839eea4-c57b-4c14-b19b-923fbedb5d88	SKILL	INTERMEDIO	ESSENZIALE
R067	ESCO_3D427A494F8542CD8A9262D4A34F41A1	archiviare i documenti	http://data.europa.eu/esco/skill/3d427a49-4f85-42cd-8a92-62d4a34f41a1	SKILL	INTERMEDIO	ESSENZIALE
R067	ESCO_71DDE84C00584C52A556523369333DB8	utilizzare i sistemi per ufficio	http://data.europa.eu/esco/skill/71dde84c-0058-4c52-a556-523369333db8	SKILL	INTERMEDIO	ESSENZIALE
R067	ESCO_76F227078D30453F9EB73376E2960311	gestire la posta	http://data.europa.eu/esco/skill/76f22707-8d30-453f-9eb7-3376e2960311	SKILL	BASE	ESSENZIALE
R067	ESCO_7C3865D1E5A94043A7A42E9E30468C0B	svolgere le regolari attività di ufficio	http://data.europa.eu/esco/skill/7c3865d1-e5a9-4043-a7a4-2e9e30468c0b	SKILL	BASE	ESSENZIALE
R067	ESCO_8D49F760376546128D40A2BDD50738FE	compilare i moduli	http://data.europa.eu/esco/skill/8d49f760-3765-4612-8d40-a2bdd50738fe	SKILL	BASE	ESSENZIALE
R067	ESCO_B769F5240F2544D785385C46710A040E	gestire documenti digitali	http://data.europa.eu/esco/skill/b769f524-0f25-44d7-8538-5c46710a040e	SKILL	INTERMEDIO	ESSENZIALE
R067	ESCO_C241F5A5E23F47BFAD24D83EA0010166	garantire una gestione adeguata dei documenti	http://data.europa.eu/esco/skill/c241f5a5-e23f-47bf-ad24-d83ea0010166	SKILL	INTERMEDIO	ESSENZIALE
R067	ESCO_F683AE1DCB7C4AA1B9FE205E1BD23535	utilizzare microsoft office	http://data.europa.eu/esco/skill/f683ae1d-cb7c-4aa1-b9fe-205e1bd23535	SKILL	INTERMEDIO	ESSENZIALE
R067	ESCO_F75B740CB36C495EBC67EFE347BBC6B5	politiche aziendali	http://data.europa.eu/esco/skill/f75b740c-b36c-495e-bc67-efe347bbc6b5	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R068	ESCO_0EDAAB251B724531950DD8B9A9F4A1C8	sistema di gestione della tesoreria	http://data.europa.eu/esco/skill/0edaab25-1b72-4531-950d-d8b9a9f4a1c8	KNOWLEDGE	AVANZATO	ESSENZIALE
R068	ESCO_2313B15DA9A748309BCCFD7DF79D842B	applicare le politiche finanziarie	http://data.europa.eu/esco/skill/2313b15d-a9a7-4830-9bcc-fd7df79d842b	SKILL	AVANZATO	ESSENZIALE
R068	ESCO_2A2FA8E8AAF34ABFA60BAF6415F1C6D4	impegnarsi per far crescere l’azienda	http://data.europa.eu/esco/skill/2a2fa8e8-aaf3-4abf-a60b-af6415f1c6d4	SKILL	AVANZATO	ESSENZIALE
R068	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R068	ESCO_56FF27EF256545BFA70CF06D78D2A480	produrre un piano finanziario	http://data.europa.eu/esco/skill/56ff27ef-2565-45bf-a70c-f06d78d2a480	SKILL	AVANZATO	ESSENZIALE
R068	ESCO_6556CBF1D5C04F5389A98707066069A6	valutare i bilanci	http://data.europa.eu/esco/skill/6556cbf1-d5c0-4f53-89a9-8707066069a6	SKILL	AVANZATO	ESSENZIALE
R068	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	AVANZATO	ESSENZIALE
R068	ESCO_8A43795BBB384F2991DFA6C92AD4643C	analizzare le prestazioni finanziarie di un’impresa	http://data.europa.eu/esco/skill/8a43795b-bb38-4f29-91df-a6c92ad4643c	SKILL	AVANZATO	ESSENZIALE
R068	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R068	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	AVANZATO	ESSENZIALE
R069	ESCO_0295B2A4FB86495F9547D479532FC4C2	rintracciare le transazioni finanziarie	http://data.europa.eu/esco/skill/0295b2a4-fb86-495f-9547-d479532fc4c2	SKILL	INTERMEDIO	ESSENZIALE
R069	ESCO_0EDAAB251B724531950DD8B9A9F4A1C8	sistema di gestione della tesoreria	http://data.europa.eu/esco/skill/0edaab25-1b72-4531-950d-d8b9a9f4a1c8	KNOWLEDGE	AVANZATO	ESSENZIALE
R069	ESCO_21C5790C09304D74B3B084CAF5AF12EA	gestire i bilanci	http://data.europa.eu/esco/skill/21c5790c-0930-4d74-b3b0-84caf5af12ea	SKILL	INTERMEDIO	ESSENZIALE
R069	ESCO_4A460161EAEA4FE2BD0E164CCC635BE1	rendiconti d’esercizio	http://data.europa.eu/esco/skill/4a460161-eaea-4fe2-bd0e-164ccc635be1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R069	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	INTERMEDIO	ESSENZIALE
R069	ESCO_89FF28D6342C435D83AA83E71DBBBC96	effettuare la revisione dei conti	http://data.europa.eu/esco/skill/89ff28d6-342c-435d-83aa-83e71dbbbc96	SKILL	INTERMEDIO	ESSENZIALE
R069	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R069	ESCO_E2E1549465B94AF58B8653FB51E7E022	gestire la contabilità	http://data.europa.eu/esco/skill/e2e15494-65b9-4af5-8b86-53fb51e7e022	SKILL	INTERMEDIO	ESSENZIALE
R069	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	AVANZATO	ESSENZIALE
R069	ESCO_FAF8943C72FF4736A58725508695D6F0	tenere la contabilità	http://data.europa.eu/esco/skill/faf8943c-72ff-4736-a587-25508695d6f0	SKILL	INTERMEDIO	ESSENZIALE
R070	ESCO_0DA516EEE70E4384BE13F5FF80BE8127	comunicare con i clienti	http://data.europa.eu/esco/skill/0da516ee-e70e-4384-be13-f5ff80be8127	SKILL	INTERMEDIO	ESSENZIALE
R070	ESCO_25A7FC25F2FC4BFD9999943C03D53372	tutelare gli interessi del cliente	http://data.europa.eu/esco/skill/25a7fc25-f2fc-4bfd-9999-943c03d53372	SKILL	INTERMEDIO	ESSENZIALE
R070	ESCO_292549E608EC456CB008EBA7A0A68428	analizzare le tendenze del mercato finanziario	http://data.europa.eu/esco/skill/292549e6-08ec-456c-b008-eba7a0a68428	SKILL	AVANZATO	ESSENZIALE
R070	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	INTERMEDIO	ESSENZIALE
R070	ESCO_905B6ACD377B46B99D80E47E9CA789CA	mercati finanziari	http://data.europa.eu/esco/skill/905b6acd-377b-46b9-9d80-e47e9ca789ca	KNOWLEDGE	AVANZATO	ESSENZIALE
R070	ESCO_A05EAD0217284D60929C7E7C3A87672C	utilizzare gli strumenti finanziari	http://data.europa.eu/esco/skill/a05ead02-1728-4d60-929c-7e7c3a87672c	SKILL	AVANZATO	ESSENZIALE
R070	ESCO_E3C7BD87EDC14D9AA3D536415DE1AAC6	offrire i servizi finanziari	http://data.europa.eu/esco/skill/e3c7bd87-edc1-4d9a-a3d5-36415de1aac6	SKILL	INTERMEDIO	ESSENZIALE
R070	ESCO_E4C205F655BA4BED9C5D2032058300C0	competenza giurisdizionale finanziaria	http://data.europa.eu/esco/skill/e4c205f6-55ba-4bed-9c5d-2032058300c0	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R070	ESCO_E92F46731DEC41ECB6EC36FEF226359C	fornire informazioni sui prodotti finanziari	http://data.europa.eu/esco/skill/e92f4673-1dec-41ec-b6ec-36fef226359c	SKILL	INTERMEDIO	ESSENZIALE
R070	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	AVANZATO	ESSENZIALE
R071	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R071	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R071	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	INTERMEDIO	ESSENZIALE
R071	ESCO_6A609F8F14514102AD2D62C5270E1237	amministrazione di ufficio	http://data.europa.eu/esco/skill/6a609f8f-1451-4102-ad2d-62c5270e1237	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R071	ESCO_6BF6B5BD66584338B0EEDC143E68E6D3	fornire sostegno per il calcolo finanziario	http://data.europa.eu/esco/skill/6bf6b5bd-6658-4338-b0ee-dc143e68e6d3	SKILL	INTERMEDIO	ESSENZIALE
R071	ESCO_71DDE84C00584C52A556523369333DB8	utilizzare i sistemi per ufficio	http://data.europa.eu/esco/skill/71dde84c-0058-4c52-a556-523369333db8	SKILL	BASE	ESSENZIALE
R071	ESCO_9E84A506DF064BE3874AFA01293E3DD5	processi aziendali	http://data.europa.eu/esco/skill/9e84a506-df06-4be3-874a-fa01293e3dd5	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R071	ESCO_E92F46731DEC41ECB6EC36FEF226359C	fornire informazioni sui prodotti finanziari	http://data.europa.eu/esco/skill/e92f4673-1dec-41ec-b6ec-36fef226359c	SKILL	INTERMEDIO	ESSENZIALE
R071	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	INTERMEDIO	ESSENZIALE
R071	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	INTERMEDIO	ESSENZIALE
R072	ESCO_0BD4C62AC309467EBE768403B3F3A1A8	prodotti finanziari	http://data.europa.eu/esco/skill/0bd4c62a-c309-467e-be76-8403b3f3a1a8	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R072	ESCO_30B1F3E115864D41AA02E2AB021B5164	gestire la documentazione cartacea	http://data.europa.eu/esco/skill/30b1f3e1-1586-4d41-aa02-e2ab021b5164	SKILL	BASE	ESSENZIALE
R072	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R072	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	INTERMEDIO	ESSENZIALE
R072	ESCO_6A609F8F14514102AD2D62C5270E1237	amministrazione di ufficio	http://data.europa.eu/esco/skill/6a609f8f-1451-4102-ad2d-62c5270e1237	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R072	ESCO_905B6ACD377B46B99D80E47E9CA789CA	mercati finanziari	http://data.europa.eu/esco/skill/905b6acd-377b-46b9-9d80-e47e9ca789ca	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R072	ESCO_92721092FE7C468996BD4F02385BC0E7	gestire i contratti	http://data.europa.eu/esco/skill/92721092-fe7c-4689-96bd-4f02385bc0e7	SKILL	INTERMEDIO	ESSENZIALE
R072	ESCO_AB986BC4DF9243519AC1AA75AF943CF7	svolgere le mansioni di segreteria	http://data.europa.eu/esco/skill/ab986bc4-df92-4351-9ac1-aa75af943cf7	SKILL	BASE	ESSENZIALE
R072	ESCO_CF310CFF0D284DBC9DBBCC500A3196C2	software per ufficio	http://data.europa.eu/esco/skill/cf310cff-0d28-4dbc-9dbb-cc500a3196c2	KNOWLEDGE	BASE	ESSENZIALE
R072	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	INTERMEDIO	ESSENZIALE
R073	ESCO_009DB49BFCF54409B4A5232D059F3597	applicare la politica di rischio del credito	http://data.europa.eu/esco/skill/009db49b-fcf5-4409-b4a5-232d059f3597	SKILL	INTERMEDIO	ESSENZIALE
R073	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	AVANZATO	ESSENZIALE
R073	ESCO_7F27F1FF2E174B69990EC23334478313	valutazione dei rischi e delle minacce	http://data.europa.eu/esco/skill/7f27f1ff-2e17-4b69-990e-c23334478313	KNOWLEDGE	AVANZATO	ESSENZIALE
R073	ESCO_7F7756FCD89D41D593EF85991603F4AD	gestire il rischio finanziario	http://data.europa.eu/esco/skill/7f7756fc-d89d-41d5-93ef-85991603f4ad	SKILL	AVANZATO	ESSENZIALE
R073	ESCO_8744F28F59A945AF8EF66944CB5A1473	identificazione dei rischi	http://data.europa.eu/esco/skill/8744f28f-59a9-45af-8ef6-6944cb5a1473	KNOWLEDGE	AVANZATO	ESSENZIALE
R073	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R073	ESCO_BD832A82B079400180D1F59EFED33688	scrivere le relazioni sui rischi	http://data.europa.eu/esco/skill/bd832a82-b079-4001-80d1-f59efed33688	SKILL	INTERMEDIO	ESSENZIALE
R073	ESCO_D7B66759C40C44DE9F319418F84E10C5	valutare i fattori di rischio	http://data.europa.eu/esco/skill/d7b66759-c40c-44de-9f31-9418f84e10c5	SKILL	AVANZATO	ESSENZIALE
R073	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	AVANZATO	ESSENZIALE
R073	ESCO_EDF081E4D2DC4A608C497B7E45B5EBE3	creare le mappe di rischio	http://data.europa.eu/esco/skill/edf081e4-d2dc-4a60-8c49-7b7e45b5ebe3	SKILL	AVANZATO	ESSENZIALE
R074	ESCO_21C5790C09304D74B3B084CAF5AF12EA	gestire i bilanci	http://data.europa.eu/esco/skill/21c5790c-0930-4d74-b3b0-84caf5af12ea	SKILL	INTERMEDIO	ESSENZIALE
R074	ESCO_2D140A3A45A6424880DDB3760EBC9CC6	gestione operativa	http://data.europa.eu/esco/skill/2d140a3a-45a6-4248-80dd-b3760ebc9cc6	KNOWLEDGE	AVANZATO	ESSENZIALE
R074	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	INTERMEDIO	ESSENZIALE
R074	ESCO_4CFC7EF6E2514C93BD5EFD6936DEE11C	gestire la redditività	http://data.europa.eu/esco/skill/4cfc7ef6-e251-4c93-bd5e-fd6936dee11c	SKILL	AVANZATO	ESSENZIALE
R074	ESCO_69F2342692794FE6A28324C2AA4C855D	garantire la disponibilità delle attrezzature	http://data.europa.eu/esco/skill/69f23426-9279-4fe6-a283-24c2aa4c855d	SKILL	INTERMEDIO	ESSENZIALE
R074	ESCO_7111B95D0CE3441A9D924C75D05C4388	gestione di progetto	http://data.europa.eu/esco/skill/7111b95d-0ce3-441a-9d92-4c75d05c4388	KNOWLEDGE	AVANZATO	ESSENZIALE
R074	ESCO_9013B46E5A9B49298918FCADFDFD37CE	supervisionare le operazioni quotidiane di informazione	http://data.europa.eu/esco/skill/9013b46e-5a9b-4929-8918-fcadfdfd37ce	SKILL	INTERMEDIO	ESSENZIALE
R074	ESCO_953C0B65537A42FEA90B26CD36C64361	gestire la logistica	http://data.europa.eu/esco/skill/953c0b65-537a-42fe-a90b-26cd36c64361	SKILL	INTERMEDIO	ESSENZIALE
R074	ESCO_CD5EFA8CE44D4CBC91C6796018DBED68	eseguire la gestione del progetto	http://data.europa.eu/esco/skill/cd5efa8c-e44d-4cbc-91c6-796018dbed68	SKILL	AVANZATO	ESSENZIALE
R074	ESCO_F60C9E5295FC4CA1A73C18A491153B63	prendere decisioni aziendali strategiche	http://data.europa.eu/esco/skill/f60c9e52-95fc-4ca1-a73c-18a491153b63	SKILL	AVANZATO	ESSENZIALE
R075	ESCO_03FF0D53573A47A0A0AD1995815A4339	struttura dell’informazione	http://data.europa.eu/esco/skill/03ff0d53-573a-47a0-a0ad-1995815a4339	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R075	ESCO_46EC00333C71415EBCFFB065675BA2DC	integrare dati TIC	http://data.europa.eu/esco/skill/46ec0033-3c71-415e-bcff-b065675ba2dc	SKILL	AVANZATO	ESSENZIALE
R075	ESCO_6014921E1D254039ADC204852D61880E	strumenti di debug TIC	http://data.europa.eu/esco/skill/6014921e-1d25-4039-adc2-04852d61880e	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R075	ESCO_861313BA3A1A4D33842A1B8E45E2415B	gestire i processi di trasferimento e sostituzione di un sistema legacy TIC	http://data.europa.eu/esco/skill/861313ba-3a1a-4d33-842a-1b8e45e2415b	SKILL	INTERMEDIO	ESSENZIALE
R075	ESCO_9CF681C789EC470CB6517FE03786F586	linguaggi di interrogazione	http://data.europa.eu/esco/skill/9cf681c7-89ec-470c-b651-7fe03786f586	KNOWLEDGE	AVANZATO	ESSENZIALE
R075	ESCO_9D0D89BEBFFA4393B6F68D05BEA49051	strumenti di estrazione trasformazione e caricamento dei dati	http://data.europa.eu/esco/skill/9d0d89be-bffa-4393-b6f6-8d05bea49051	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R075	ESCO_9FF9DB9DD14B426E83F3E7449AF6C79F	gestire dati	http://data.europa.eu/esco/skill/9ff9db9d-d14b-426e-83f3-e7449af6c79f	SKILL	AVANZATO	ESSENZIALE
R075	ESCO_AB1E97ED23194293A8B7072D2648822F	sistemi di gestione di database	http://data.europa.eu/esco/skill/ab1e97ed-2319-4293-a8b7-072d2648822f	KNOWLEDGE	AVANZATO	ESSENZIALE
R075	ESCO_EA412DE39D7A49438D8CC6D3C7495D0E	eseguire test d’integrazione	http://data.europa.eu/esco/skill/ea412de3-9d7a-4943-8d8c-c6d3c7495d0e	SKILL	INTERMEDIO	ESSENZIALE
R075	ESCO_FD6D29813D4A4CE29741CFC98C5B74BD	implementare tecniche di data warehouse	http://data.europa.eu/esco/skill/fd6d2981-3d4a-4ce2-9741-cfc98c5b74bd	SKILL	INTERMEDIO	ESSENZIALE
R076	ESCO_27ED854C15B84BA290E9AE888A219703	eseguire l’analisi commerciale	http://data.europa.eu/esco/skill/27ed854c-15b8-4ba2-90e9-ae888a219703	SKILL	AVANZATO	ESSENZIALE
R076	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R076	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	AVANZATO	ESSENZIALE
R076	ESCO_6360A934CC8749549656B32DB20592E3	analisi quantitativa	http://data.europa.eu/esco/skill/6360a934-cc87-4954-9656-b32db20592e3	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R076	ESCO_7EE4C2EAB3494BD281A3EC31475D4833	statistica	http://data.europa.eu/esco/skill/7ee4c2ea-b349-4bd2-81a3-ec31475d4833	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R076	ESCO_98A1DEC381384F46A5965E2A83B884B9	analisi dei processi operativi	http://data.europa.eu/esco/skill/98a1dec3-8138-4f46-a596-5e2a83b884b9	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R076	ESCO_9E84A506DF064BE3874AFA01293E3DD5	processi aziendali	http://data.europa.eu/esco/skill/9e84a506-df06-4be3-874a-fa01293e3dd5	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R076	ESCO_DD7C9DFD6E2C46FDAEFC369402D0200C	creare una relazione finanziaria	http://data.europa.eu/esco/skill/dd7c9dfd-6e2c-46fd-aefc-369402d0200c	SKILL	AVANZATO	ESSENZIALE
R076	ESCO_E3C7BD87EDC14D9AA3D536415DE1AAC6	offrire i servizi finanziari	http://data.europa.eu/esco/skill/e3c7bd87-edc1-4d9a-a3d5-36415de1aac6	SKILL	INTERMEDIO	ESSENZIALE
R076	ESCO_ECC18804A46640D998B4FBA5CD67DD4B	contabilità	http://data.europa.eu/esco/skill/ecc18804-a466-40d9-98b4-fba5cd67dd4b	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R077	ESCO_1DEA2F3A857C4FC3B1F8D5F2015C46A9	fornire istruzioni al personale	http://data.europa.eu/esco/skill/1dea2f3a-857c-4fc3-b1f8-d5f2015c46a9	SKILL	INTERMEDIO	ESSENZIALE
R077	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	AVANZATO	ESSENZIALE
R077	ESCO_415ABD43E8E54643B5DA5F11307AF57A	utilizzare canali di comunicazione diversi	http://data.europa.eu/esco/skill/415abd43-e8e5-4643-b5da-5f11307af57a	SKILL	INTERMEDIO	ESSENZIALE
R077	ESCO_6AE8306A4F9D4410AC826406F3CBD16A	gestire i sistemi degli uffici	http://data.europa.eu/esco/skill/6ae8306a-4f9d-4410-ac82-6406f3cbd16a	SKILL	AVANZATO	ESSENZIALE
R077	ESCO_77E7CB082C6F42AB881BB34B2318ACBE	gestire sistemi amministrativi	http://data.europa.eu/esco/skill/77e7cb08-2c6f-42ab-881b-b34b2318acbe	SKILL	AVANZATO	ESSENZIALE
R077	ESCO_7D35602DBC944975AA7CF4E8E05CE8E0	gestione dei costi	http://data.europa.eu/esco/skill/7d35602d-bc94-4975-aa7c-f4e8e05ce8e0	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R077	ESCO_918F5211B99F4B299A346E475583EF55	scrivere relazioni connesse al lavoro	http://data.europa.eu/esco/skill/918f5211-b99f-4b29-9a34-6e475583ef55	SKILL	INTERMEDIO	ESSENZIALE
R077	ESCO_958B8802EC3E481397F76C8F48610DBD	individuare i miglioramenti dei processi	http://data.europa.eu/esco/skill/958b8802-ec3e-4813-97f7-6c8f48610dbd	SKILL	AVANZATO	ESSENZIALE
R077	ESCO_D58A48D15B7F4028AE11B051D13EE1A8	analizzare la capacità produttiva del personale	http://data.europa.eu/esco/skill/d58a48d1-5b7f-4028-ae11-b051d13ee1a8	SKILL	INTERMEDIO	ESSENZIALE
R077	ESCO_F2C63B7AED6C48909F8C7685D172624C	attuare la corporate governance	http://data.europa.eu/esco/skill/f2c63b7a-ed6c-4890-9f8c-7685d172624c	SKILL	INTERMEDIO	ESSENZIALE
R078	ESCO_25A7FC25F2FC4BFD9999943C03D53372	tutelare gli interessi del cliente	http://data.europa.eu/esco/skill/25a7fc25-f2fc-4bfd-9999-943c03d53372	SKILL	AVANZATO	ESSENZIALE
R078	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R078	ESCO_3FC5A30DD49344EDA2B5FF9A50F84DE3	risolvere le problematiche legate ai conti bancari	http://data.europa.eu/esco/skill/3fc5a30d-d493-44ed-a2b5-ff9a50f84de3	SKILL	AVANZATO	ESSENZIALE
R078	ESCO_4AB4E2984E354E2E938CDA2C1E11864C	aprire conti bancari	http://data.europa.eu/esco/skill/4ab4e298-4e35-4e2e-938c-da2c1e11864c	SKILL	AVANZATO	ESSENZIALE
R078	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	INTERMEDIO	ESSENZIALE
R078	ESCO_84F583F4F32A42029B92E25F0C978410	software per attività bancarie essenziali	http://data.europa.eu/esco/skill/84f583f4-f32a-4202-9b92-e25f0c978410	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R078	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R078	ESCO_E3C7BD87EDC14D9AA3D536415DE1AAC6	offrire i servizi finanziari	http://data.europa.eu/esco/skill/e3c7bd87-edc1-4d9a-a3d5-36415de1aac6	SKILL	INTERMEDIO	ESSENZIALE
R078	ESCO_E92F46731DEC41ECB6EC36FEF226359C	fornire informazioni sui prodotti finanziari	http://data.europa.eu/esco/skill/e92f4673-1dec-41ec-b6ec-36fef226359c	SKILL	INTERMEDIO	ESSENZIALE
R078	ESCO_FF1932ED788945AE8A6D1734E8E3117F	offrire consulenza sui conti bancari	http://data.europa.eu/esco/skill/ff1932ed-7889-45ae-8a6d-1734e8e3117f	SKILL	AVANZATO	ESSENZIALE
R079	ESCO_0295B2A4FB86495F9547D479532FC4C2	rintracciare le transazioni finanziarie	http://data.europa.eu/esco/skill/0295b2a4-fb86-495f-9547-d479532fc4c2	SKILL	INTERMEDIO	ESSENZIALE
R079	ESCO_08371FE9C6584F6A966F71DBB0AB683D	processi del reparto contabilità	http://data.europa.eu/esco/skill/08371fe9-c658-4f6a-966f-71dbb0ab683d	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R079	ESCO_39E43F7CA95E4583BE76BB134CCCE1AE	processi dell’ufficio finanziario	http://data.europa.eu/esco/skill/39e43f7c-a95e-4583-be76-bb134ccce1ae	KNOWLEDGE	INTERMEDIO	UTILE
R079	ESCO_54D684009DA34077A7EE52E68B390EF6	seguire le istruzioni scritte	http://data.europa.eu/esco/skill/54d68400-9da3-4077-a7ee-52e68b390ef6	SKILL	BASE	ESSENZIALE
R079	ESCO_6A536B36C5C74D10BF67A4FB0F8549B2	tecniche di audit	http://data.europa.eu/esco/skill/6a536b36-c5c7-4d10-bf67-a4fb0f8549b2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R079	ESCO_83E97138899A4AF8918747823E875841	rispettare gli obblighi di legge	http://data.europa.eu/esco/skill/83e97138-899a-4af8-9187-47823e875841	SKILL	AVANZATO	ESSENZIALE
R079	ESCO_89FF28D6342C435D83AA83E71DBBBC96	effettuare la revisione dei conti	http://data.europa.eu/esco/skill/89ff28d6-342c-435d-83aa-83e71dbbbc96	SKILL	AVANZATO	ESSENZIALE
R079	ESCO_8A326EE1169C4C44B38B8F1BB20EC79B	individuare gli errori contabili	http://data.europa.eu/esco/skill/8a326ee1-169c-4c44-b38b-8f1bb20ec79b	SKILL	AVANZATO	ESSENZIALE
R079	ESCO_8D202E2285E947B1A1E03296D17244CD	rispettare la riservatezza	http://data.europa.eu/esco/skill/8d202e22-85e9-47b1-a1e0-3296d17244cd	SKILL	INTERMEDIO	ESSENZIALE
R079	ESCO_FC511E12FE9040A0BEC8227ABB5E4255	seguire le istruzioni verbali	http://data.europa.eu/esco/skill/fc511e12-fe90-40a0-bec8-227abb5e4255	SKILL	BASE	ESSENZIALE
R080	ESCO_08371FE9C6584F6A966F71DBB0AB683D	processi del reparto contabilità	http://data.europa.eu/esco/skill/08371fe9-c658-4f6a-966f-71dbb0ab683d	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R080	ESCO_4A460161EAEA4FE2BD0E164CCC635BE1	rendiconti d’esercizio	http://data.europa.eu/esco/skill/4a460161-eaea-4fe2-bd0e-164ccc635be1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R080	ESCO_54D684009DA34077A7EE52E68B390EF6	seguire le istruzioni scritte	http://data.europa.eu/esco/skill/54d68400-9da3-4077-a7ee-52e68b390ef6	SKILL	BASE	ESSENZIALE
R080	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	AVANZATO	UTILE
R080	ESCO_6A536B36C5C74D10BF67A4FB0F8549B2	tecniche di audit	http://data.europa.eu/esco/skill/6a536b36-c5c7-4d10-bf67-a4fb0f8549b2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R080	ESCO_83E97138899A4AF8918747823E875841	rispettare gli obblighi di legge	http://data.europa.eu/esco/skill/83e97138-899a-4af8-9187-47823e875841	SKILL	AVANZATO	ESSENZIALE
R080	ESCO_89FF28D6342C435D83AA83E71DBBBC96	effettuare la revisione dei conti	http://data.europa.eu/esco/skill/89ff28d6-342c-435d-83aa-83e71dbbbc96	SKILL	AVANZATO	ESSENZIALE
R080	ESCO_8A326EE1169C4C44B38B8F1BB20EC79B	individuare gli errori contabili	http://data.europa.eu/esco/skill/8a326ee1-169c-4c44-b38b-8f1bb20ec79b	SKILL	AVANZATO	ESSENZIALE
R080	ESCO_8D202E2285E947B1A1E03296D17244CD	rispettare la riservatezza	http://data.europa.eu/esco/skill/8d202e22-85e9-47b1-a1e0-3296d17244cd	SKILL	INTERMEDIO	ESSENZIALE
R080	ESCO_FC511E12FE9040A0BEC8227ABB5E4255	seguire le istruzioni verbali	http://data.europa.eu/esco/skill/fc511e12-fe90-40a0-bec8-227abb5e4255	SKILL	BASE	ESSENZIALE
R081	ESCO_0BD4C62AC309467EBE768403B3F3A1A8	prodotti finanziari	http://data.europa.eu/esco/skill/0bd4c62a-c309-467e-be76-8403b3f3a1a8	KNOWLEDGE	AVANZATO	ESSENZIALE
R081	ESCO_2313B15DA9A748309BCCFD7DF79D842B	applicare le politiche finanziarie	http://data.europa.eu/esco/skill/2313b15d-a9a7-4830-9bcc-fd7df79d842b	SKILL	INTERMEDIO	ESSENZIALE
R081	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	AVANZATO	UTILE
R081	ESCO_4A460161EAEA4FE2BD0E164CCC635BE1	rendiconti d’esercizio	http://data.europa.eu/esco/skill/4a460161-eaea-4fe2-bd0e-164ccc635be1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R081	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R081	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	AVANZATO	ESSENZIALE
R081	ESCO_84F583F4F32A42029B92E25F0C978410	software per attività bancarie essenziali	http://data.europa.eu/esco/skill/84f583f4-f32a-4202-9b92-e25f0c978410	KNOWLEDGE	AVANZATO	ESSENZIALE
R081	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R081	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R081	ESCO_F5F5B2446CEA4FBC8A508F712791BC09	osservare le norme aziendali	http://data.europa.eu/esco/skill/f5f5b244-6cea-4fbc-8a50-8f712791bc09	SKILL	INTERMEDIO	ESSENZIALE
R082	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	AVANZATO	ESSENZIALE
R082	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	AVANZATO	ESSENZIALE
R082	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	AVANZATO	ESSENZIALE
R082	ESCO_7EE4C2EAB3494BD281A3EC31475D4833	statistica	http://data.europa.eu/esco/skill/7ee4c2ea-b349-4bd2-81a3-ec31475d4833	KNOWLEDGE	INTERMEDIO	UTILE
R082	ESCO_88AF9294B6974687AE19AEFBB6234DFA	economia	http://data.europa.eu/esco/skill/88af9294-b697-4687-ae19-aefbb6234dfa	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R082	ESCO_98A1DEC381384F46A5965E2A83B884B9	analisi dei processi operativi	http://data.europa.eu/esco/skill/98a1dec3-8138-4f46-a596-5e2a83b884b9	KNOWLEDGE	AVANZATO	ESSENZIALE
R082	ESCO_9E84A506DF064BE3874AFA01293E3DD5	processi aziendali	http://data.europa.eu/esco/skill/9e84a506-df06-4be3-874a-fa01293e3dd5	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R082	ESCO_D41262AEECA14EDE89A846D2D99A7A31	considerare i criteri economici nel processo decisionale	http://data.europa.eu/esco/skill/d41262ae-eca1-4ede-89a8-46d2d99a7a31	SKILL	INTERMEDIO	ESSENZIALE
R082	ESCO_DD7C9DFD6E2C46FDAEFC369402D0200C	creare una relazione finanziaria	http://data.europa.eu/esco/skill/dd7c9dfd-6e2c-46fd-aefc-369402d0200c	SKILL	INTERMEDIO	ESSENZIALE
R082	ESCO_ECC18804A46640D998B4FBA5CD67DD4B	contabilità	http://data.europa.eu/esco/skill/ecc18804-a466-40d9-98b4-fba5cd67dd4b	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R083	ESCO_25A7FC25F2FC4BFD9999943C03D53372	tutelare gli interessi del cliente	http://data.europa.eu/esco/skill/25a7fc25-f2fc-4bfd-9999-943c03d53372	SKILL	AVANZATO	ESSENZIALE
R083	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	AVANZATO	ESSENZIALE
R083	ESCO_3FC5A30DD49344EDA2B5FF9A50F84DE3	risolvere le problematiche legate ai conti bancari	http://data.europa.eu/esco/skill/3fc5a30d-d493-44ed-a2b5-ff9a50f84de3	SKILL	AVANZATO	ESSENZIALE
R083	ESCO_4AB4E2984E354E2E938CDA2C1E11864C	aprire conti bancari	http://data.europa.eu/esco/skill/4ab4e298-4e35-4e2e-938c-da2c1e11864c	SKILL	INTERMEDIO	ESSENZIALE
R083	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R083	ESCO_79C36C9128A544B7AB9B7093B2D4B21E	fornire consulenza in materia finanziaria	http://data.europa.eu/esco/skill/79c36c91-28a5-44b7-ab9b-7093b2d4b21e	SKILL	INTERMEDIO	ESSENZIALE
R083	ESCO_84F583F4F32A42029B92E25F0C978410	software per attività bancarie essenziali	http://data.europa.eu/esco/skill/84f583f4-f32a-4202-9b92-e25f0c978410	KNOWLEDGE	AVANZATO	ESSENZIALE
R083	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R083	ESCO_DEBEF2FC7AF44BFFAC924D0317915A84	comunicazione elettronica	http://data.europa.eu/esco/skill/debef2fc-7af4-4bff-ac92-4d0317915a84	KNOWLEDGE	BASE	ESSENZIALE
R083	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R084	ESCO_248894D142DC474FAF6E2DA52AC0C679	definire una strategia tecnologica	http://data.europa.eu/esco/skill/248894d1-42dc-474f-af6e-2da52ac0c679	SKILL	AVANZATO	ESSENZIALE
R084	ESCO_3CFA46E9B7DA44ACB09E9596DFFE0425	ottimizzare la scelta di soluzioni TIC	http://data.europa.eu/esco/skill/3cfa46e9-b7da-44ac-b09e-9596dffe0425	SKILL	AVANZATO	ESSENZIALE
R084	ESCO_501537A79D63491DAE0209F04767FF1E	vettori di attacco	http://data.europa.eu/esco/skill/501537a7-9d63-491d-ae02-09f04767ff1e	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R084	ESCO_69CFC5ED65694ACAA4CCFD782BA51D9C	attuare la gestione del rischio TIC	http://data.europa.eu/esco/skill/69cfc5ed-6569-4aca-a4cc-fd782ba51d9c	SKILL	AVANZATO	ESSENZIALE
R084	ESCO_7A17D7CE01A24746BBCC22FFE22FA16E	monitorare le tendenze tecnologiche	http://data.europa.eu/esco/skill/7a17d7ce-01a2-4746-bbcc-22ffe22fa16e	SKILL	INTERMEDIO	UTILE
R084	ESCO_909A28CED4B645679B74D111F1ED9633	mantenere il piano di continuità operativa	http://data.europa.eu/esco/skill/909a28ce-d4b6-4567-9b74-d111f1ed9633	SKILL	AVANZATO	ESSENZIALE
R084	ESCO_978DB6A172974C89819A47605F2C3BA8	gestire il rilascio di software	http://data.europa.eu/esco/skill/978db6a1-7297-4c89-819a-47605f2c3ba8	SKILL	AVANZATO	ESSENZIALE
R084	ESCO_AF607E5E4BA14E5FA2A6DC05806567C7	coordinare attività tecnologiche	http://data.europa.eu/esco/skill/af607e5e-4ba1-4e5f-a2a6-dc05806567c7	SKILL	AVANZATO	ESSENZIALE
R084	ESCO_B8271C8ACBA64BAA80F56361AF3F07E3	garantire il rispetto degli standard organizzativi TIC	http://data.europa.eu/esco/skill/b8271c8a-cba6-4baa-80f5-6361af3f07e3	SKILL	AVANZATO	ESSENZIALE
R084	ESCO_F2C63B7AED6C48909F8C7685D172624C	attuare la corporate governance	http://data.europa.eu/esco/skill/f2c63b7a-ed6c-4890-9f8c-7685d172624c	SKILL	AVANZATO	ESSENZIALE
R085	ESCO_09F2F811A3FB4DE3A70F6420A6935575	ciclo di vita dello sviluppo di sistemi	http://data.europa.eu/esco/skill/09f2f811-a3fb-4de3-a70f-6420a6935575	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R085	ESCO_248894D142DC474FAF6E2DA52AC0C679	definire una strategia tecnologica	http://data.europa.eu/esco/skill/248894d1-42dc-474f-af6e-2da52ac0c679	SKILL	AVANZATO	ESSENZIALE
R085	ESCO_3BDDFD7CAB6D40C2883D5E97FB7640BA	sviluppare progetti di software	http://data.europa.eu/esco/skill/3bddfd7c-ab6d-40c2-883d-5e97fb7640ba	SKILL	AVANZATO	ESSENZIALE
R085	ESCO_3C76296D4BBD44BA8EAA95BF275F79B7	gestire progetti TIC	http://data.europa.eu/esco/skill/3c76296d-4bbd-44ba-8eaa-95bf275f79b7	SKILL	AVANZATO	ESSENZIALE
R085	ESCO_41BF7EDEFC844A578C89B548D11B0BA1	gestire le conoscenze aziendali	http://data.europa.eu/esco/skill/41bf7ede-fc84-4a57-8c89-b548d11b0ba1	SKILL	INTERMEDIO	UTILE
R085	ESCO_7A17D7CE01A24746BBCC22FFE22FA16E	monitorare le tendenze tecnologiche	http://data.europa.eu/esco/skill/7a17d7ce-01a2-4746-bbcc-22ffe22fa16e	SKILL	BASE	UTILE
R085	ESCO_B8271C8ACBA64BAA80F56361AF3F07E3	garantire il rispetto degli standard organizzativi TIC	http://data.europa.eu/esco/skill/b8271c8a-cba6-4baa-80f5-6361af3f07e3	SKILL	INTERMEDIO	ESSENZIALE
R085	ESCO_C7CC6DC5D56B43238E5C47C4022F615F	metodologie di assicurazione della qualità	http://data.europa.eu/esco/skill/c7cc6dc5-d56b-4323-8e5c-47c4022f615f	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R085	ESCO_F28617ADAFDD4041814C216153A38998	analizzare le specifiche del software	http://data.europa.eu/esco/skill/f28617ad-afdd-4041-814c-216153a38998	SKILL	AVANZATO	ESSENZIALE
R085	ESCO_FB7AEE4DF6C64A878E9D8E542B3771F8	metriche software	http://data.europa.eu/esco/skill/fb7aee4d-f6c6-4a87-8e9d-8e542b3771f8	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R086	ESCO_114C9698C9994369849881BF641FE871	implementare un piano in materia di sicurezza TIC	http://data.europa.eu/esco/skill/114c9698-c999-4369-8498-81bf641fe871	SKILL	AVANZATO	ESSENZIALE
R086	ESCO_2A3A96A3709E4D6081F6D247D6933F13	gestire la sicurezza del sistema	http://data.europa.eu/esco/skill/2a3a96a3-709e-4d60-81f6-d247d6933f13	SKILL	AVANZATO	ESSENZIALE
R086	ESCO_3579208E49B34CE498E720E41B1CE8D4	sviluppare strategie di sicurezza delle informazioni	http://data.europa.eu/esco/skill/3579208e-49b3-4ce4-98e7-20e41b1ce8d4	SKILL	AVANZATO	ESSENZIALE
R086	ESCO_426CEABA6867481CBB6BAEE3933DA7D2	sicurezza in ambito TIC	http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2	KNOWLEDGE	AVANZATO	ESSENZIALE
R086	ESCO_4918EC9A020449358B09B0112370DAA8	istituire un sistema di gestione della sicurezza delle informazioni	http://data.europa.eu/esco/skill/4918ec9a-0204-4935-8b09-b0112370daa8	SKILL	AVANZATO	ESSENZIALE
R086	ESCO_501537A79D63491DAE0209F04767FF1E	vettori di attacco	http://data.europa.eu/esco/skill/501537a7-9d63-491d-ae02-09f04767ff1e	KNOWLEDGE	INTERMEDIO	UTILE
R086	ESCO_69CFC5ED65694ACAA4CCFD782BA51D9C	attuare la gestione del rischio TIC	http://data.europa.eu/esco/skill/69cfc5ed-6569-4aca-a4cc-fd782ba51d9c	SKILL	AVANZATO	ESSENZIALE
R086	ESCO_8088750D83884170A76F48354C469C44	sicurezza informatica	http://data.europa.eu/esco/skill/8088750d-8388-4170-a76f-48354c469c44	KNOWLEDGE	AVANZATO	ESSENZIALE
R086	ESCO_B8271C8ACBA64BAA80F56361AF3F07E3	garantire il rispetto degli standard organizzativi TIC	http://data.europa.eu/esco/skill/b8271c8a-cba6-4baa-80f5-6361af3f07e3	SKILL	INTERMEDIO	ESSENZIALE
R086	ESCO_FE1C2B327FE94668AFFA07FF658A68CF	identificare i rischi per la sicurezza TIC	http://data.europa.eu/esco/skill/fe1c2b32-7fe9-4668-affa-07ff658a68cf	SKILL	AVANZATO	ESSENZIALE
R087	ESCO_3C209873C75747BB91B59B6DC05DF116	attività bancarie	http://data.europa.eu/esco/skill/3c209873-c757-47bb-91b5-9b6dc05df116	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R087	ESCO_3D3EE5C34286457F9F761704011F7E11	ottemperare alle disposizioni legali	http://data.europa.eu/esco/skill/3d3ee5c3-4286-457f-9f76-1704011f7e11	SKILL	BASE	ESSENZIALE
R087	ESCO_52E53619FA774F72B2375E4AAE784DC2	gestione finanziaria	http://data.europa.eu/esco/skill/52e53619-fa77-4f72-b237-5e4aae784dc2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R087	ESCO_648782E0B5E54E59BED0627AA8AC29F0	tenere un archivio delle transazioni finanziarie	http://data.europa.eu/esco/skill/648782e0-b5e5-4e59-bed0-627aa8ac29f0	SKILL	INTERMEDIO	ESSENZIALE
R087	ESCO_9E84A506DF064BE3874AFA01293E3DD5	processi aziendali	http://data.europa.eu/esco/skill/9e84a506-df06-4be3-874a-fa01293e3dd5	KNOWLEDGE	INTERMEDIO	UTILE
R087	ESCO_E92F46731DEC41ECB6EC36FEF226359C	fornire informazioni sui prodotti finanziari	http://data.europa.eu/esco/skill/e92f4673-1dec-41ec-b6ec-36fef226359c	SKILL	INTERMEDIO	ESSENZIALE
R087	ESCO_EB8BABFBAB914937A0326A79F82E9B7F	analizzare il rischio finanziario	http://data.europa.eu/esco/skill/eb8babfb-ab91-4937-a032-6a79f82e9b7f	SKILL	INTERMEDIO	ESSENZIALE
R087	ESCO_F7E7CCB6FADC4C35935DE1040BE40DFE	gestire le transazioni finanziarie	http://data.europa.eu/esco/skill/f7e7ccb6-fadc-4c35-935d-e1040be40dfe	SKILL	INTERMEDIO	ESSENZIALE
R088	ESCO_020918EF4B5547C18430AB7B8F6A7377	trasferire dati esistenti	http://data.europa.eu/esco/skill/020918ef-4b55-47c1-8430-ab7b8f6a7377	SKILL	INTERMEDIO	ESSENZIALE
R088	ESCO_0B0335F30AA1491E895E81FC8774A300	sviluppare metodi di migrazione automatica dei dati	http://data.europa.eu/esco/skill/0b0335f3-0aa1-491e-895e-81fc8774a300	SKILL	INTERMEDIO	ESSENZIALE
R088	ESCO_85C11255469F41BDA6D1382BC4A87783	interpretare testi tecnici	http://data.europa.eu/esco/skill/85c11255-469f-41bd-a6d1-382bc4a87783	SKILL	BASE	UTILE
R088	ESCO_B3C8EADAB0A84B61968BB354FBFB6874	configurare sistemi TIC	http://data.europa.eu/esco/skill/b3c8eada-b0a8-4b61-968b-b354fbfb6874	SKILL	AVANZATO	ESSENZIALE
R088	ESCO_CA73AC82867A4AFA9732834AEBE896FF	esigenze degli utenti del sistema TIC	http://data.europa.eu/esco/skill/ca73ac82-867a-4afa-9732-834aebe896ff	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R088	ESCO_D0C6D77ECB254770BF772073FC5F7523	infrastruttura TIC	http://data.europa.eu/esco/skill/d0c6d77e-cb25-4770-bf77-2073fc5f7523	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R088	ESCO_ED39EDD344D04A169796BFB99F92BAF3	metodi di analisi delle prestazioni TIC	http://data.europa.eu/esco/skill/ed39edd3-44d0-4a16-9796-bfb99f92baf3	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R088	ESCO_ED8DE897ADBE4F0EB4D2534953E64C72	integrare componenti di sistema	http://data.europa.eu/esco/skill/ed8de897-adbe-4f0e-b4d2-534953e64c72	SKILL	AVANZATO	ESSENZIALE
R088	ESCO_F28617ADAFDD4041814C216153A38998	analizzare le specifiche del software	http://data.europa.eu/esco/skill/f28617ad-afdd-4041-814c-216153a38998	SKILL	INTERMEDIO	ESSENZIALE
R089	ESCO_00E53A0AC0BA4C9FA2ED4706D5832A00	garantire la soddisfazione del cliente	http://data.europa.eu/esco/skill/00e53a0a-c0ba-4c9f-a2ed-4706d5832a00	SKILL	INTERMEDIO	ESSENZIALE
R089	ESCO_01E7DEE73FF14807ACAD058DBED91ABA	tenersi aggiornati sul prodotto	http://data.europa.eu/esco/skill/01e7dee7-3ff1-4807-acad-058dbed91aba	SKILL	BASE	UTILE
R089	ESCO_61970F8B099C4E7E82E09CCDCED0BAF3	fornire assistenza ai clienti	http://data.europa.eu/esco/skill/61970f8b-099c-4e7e-82e0-9ccdced0baf3	SKILL	INTERMEDIO	ESSENZIALE
R089	ESCO_6430EB0DC6DE46B7A7FC3DD2E8E62A69	usare sistemi di ticketing TIC	http://data.europa.eu/esco/skill/6430eb0d-c6de-46b7-a7fc-3dd2e8e62a69	SKILL	INTERMEDIO	ESSENZIALE
R089	ESCO_6474FC3667AE436B9D39C14402C6A89B	utilizzare hardware ICT	http://data.europa.eu/esco/skill/6474fc36-67ae-436b-9d39-c14402c6a89b	SKILL	BASE	ESSENZIALE
R089	ESCO_9889B795D75541B28AFD2E3C87A65A38	utilizzare il software per la gestione delle relazioni con i clienti	http://data.europa.eu/esco/skill/9889b795-d755-41b2-8afd-2e3c87a65a38	SKILL	INTERMEDIO	ESSENZIALE
R089	ESCO_9E06BAC66B9148CA8B7DC1F48CDECD7C	risolvere i problemi del sistema TIC	http://data.europa.eu/esco/skill/9e06bac6-6b91-48ca-8b7d-c1f48cdecd7c	SKILL	INTERMEDIO	ESSENZIALE
R089	ESCO_CA73AC82867A4AFA9732834AEBE896FF	esigenze degli utenti del sistema TIC	http://data.europa.eu/esco/skill/ca73ac82-867a-4afa-9732-834aebe896ff	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R089	ESCO_DB36F7F1590045BD9FFBF2B19C4362AC	assistere gli utenti di sistemi TIC	http://data.europa.eu/esco/skill/db36f7f1-5900-45bd-9ffb-f2b19c4362ac	SKILL	INTERMEDIO	ESSENZIALE
R089	ESCO_F642D7EDE8D74355A747B85094D4E2E3	stabilire la priorità delle richieste	http://data.europa.eu/esco/skill/f642d7ed-e8d7-4355-a747-b85094d4e2e3	SKILL	INTERMEDIO	ESSENZIALE
R090	ESCO_08FE59108C4C4679A988EB2DED3C4909	legislazione del lavoro	http://data.europa.eu/esco/skill/08fe5910-8c4c-4679-a988-eb2ded3c4909	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R090	ESCO_1212AC4225644FCE80E16CE4EA4D9BF5	offrire consulenza sulla gestione del personale	http://data.europa.eu/esco/skill/1212ac42-2564-4fce-80e1-6ce4ea4d9bf5	SKILL	INTERMEDIO	UTILE
R090	ESCO_279A4B1D21DF4D789F4D324C73FD7536	gestire le risorse umane	http://data.europa.eu/esco/skill/279a4b1d-21df-4d78-9f4d-324c73fd7536	SKILL	AVANZATO	ESSENZIALE
R090	ESCO_5AA57BDC5765435E8FC999B3FEBDB213	assumere risorse umane	http://data.europa.eu/esco/skill/5aa57bdc-5765-435e-8fc9-99b3febdb213	SKILL	AVANZATO	ESSENZIALE
R090	ESCO_88B406D072E24087BE19D5992D259473	gestione del personale	http://data.europa.eu/esco/skill/88b406d0-72e2-4087-be19-d5992d259473	KNOWLEDGE	AVANZATO	ESSENZIALE
R090	ESCO_B3F22AB4B553439D80A25B8AE6D11E0D	diritto del lavoro	http://data.europa.eu/esco/skill/b3f22ab4-b553-439d-80a2-5b8ae6d11e0d	KNOWLEDGE	AVANZATO	ESSENZIALE
R090	ESCO_CC3B901C4D6648F890B941883BE1E1ED	pianificare gli obiettivi a medio e lungo termine	http://data.europa.eu/esco/skill/cc3b901c-4d66-48f8-90b9-41883be1e1ed	SKILL	AVANZATO	ESSENZIALE
R090	ESCO_E437EBA13E2241F28703741E94785CBA	gestione delle risorse umane	http://data.europa.eu/esco/skill/e437eba1-3e22-41f2-8703-741e94785cba	KNOWLEDGE	AVANZATO	ESSENZIALE
R090	ESCO_EBFF1A39726149CD9CB288F565E8DC26	sviluppare programmi di formazione aziendali	http://data.europa.eu/esco/skill/ebff1a39-7261-49cd-9cb2-88f565e8dc26	SKILL	INTERMEDIO	ESSENZIALE
R090	ESCO_F77B73F08C654389A3AE3A57A73AD148	sviluppare programmi per trattenere i dipendenti	http://data.europa.eu/esco/skill/f77b73f0-8c65-4389-a3ae-3a57a73ad148	SKILL	INTERMEDIO	ESSENZIALE
R091	ESCO_11BBB82EF3CC473494D5B99FDD0A683E	spiegare i fini dell’intervista	http://data.europa.eu/esco/skill/11bbb82e-f3cc-4734-94d5-b99fdd0a683e	SKILL	INTERMEDIO	ESSENZIALE
R091	ESCO_324F02431A214F5C9F7152EEBC2596ED	tecniche di intervista	http://data.europa.eu/esco/skill/324f0243-1a21-4f5c-9f71-52eebc2596ed	KNOWLEDGE	AVANZATO	ESSENZIALE
R091	ESCO_38A5C459C5914F76A35837DE342BB11D	offerte del mercato del lavoro	http://data.europa.eu/esco/skill/38a5c459-c591-4f76-a358-37de342bb11d	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R091	ESCO_496932F10B6B4F739432D95C7DDCD43B	assumere dipendenti	http://data.europa.eu/esco/skill/496932f1-0b6b-4f73-9432-d95c7ddcd43b	SKILL	AVANZATO	ESSENZIALE
R091	ESCO_550E2D00BD8946148E15330AE5277AF3	valutare candidati	http://data.europa.eu/esco/skill/550e2d00-bd89-4614-8e15-330ae5277af3	SKILL	AVANZATO	ESSENZIALE
R091	ESCO_5AA57BDC5765435E8FC999B3FEBDB213	assumere risorse umane	http://data.europa.eu/esco/skill/5aa57bdc-5765-435e-8fc9-99b3febdb213	SKILL	AVANZATO	ESSENZIALE
R091	ESCO_6345D3A47D1A40A99A826ED06BEFFE7B	piattaforme di lavoro online	http://data.europa.eu/esco/skill/6345d3a4-7d1a-40a9-9a82-6ed06beffe7b	KNOWLEDGE	AVANZATO	ESSENZIALE
R091	ESCO_AF76C8135C7F4A08A560B4B70F96F3FF	valutare le relazioni sulle interviste	http://data.europa.eu/esco/skill/af76c813-5c7f-4a08-a560-b4b70f96f3ff	SKILL	INTERMEDIO	ESSENZIALE
R091	ESCO_C6E308B487994461A9BD560BDECB0DBB	processi dell’ufficio risorse umane	http://data.europa.eu/esco/skill/c6e308b4-8799-4461-a9bd-560bdecb0dbb	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R091	ESCO_E437EBA13E2241F28703741E94785CBA	gestione delle risorse umane	http://data.europa.eu/esco/skill/e437eba1-3e22-41f2-8703-741e94785cba	KNOWLEDGE	AVANZATO	ESSENZIALE
R092	ESCO_08FE59108C4C4679A988EB2DED3C4909	legislazione del lavoro	http://data.europa.eu/esco/skill/08fe5910-8c4c-4679-a988-eb2ded3c4909	KNOWLEDGE	INTERMEDIO	UTILE
R092	ESCO_517F678E001B4985ACB49EDC3500D74C	elaborare i programmi di formazione	http://data.europa.eu/esco/skill/517f678e-001b-4985-acb4-9edc3500d74c	SKILL	AVANZATO	ESSENZIALE
R092	ESCO_60856BBBE5DB4398BABB300A24A7FE97	istruzione degli adulti	http://data.europa.eu/esco/skill/60856bbb-e5db-4398-babb-300a24a7fe97	KNOWLEDGE	AVANZATO	ESSENZIALE
R092	ESCO_6E66FA0F4D3B415E9693DC556EB5112A	gestire i programmi di formazione aziendale	http://data.europa.eu/esco/skill/6e66fa0f-4d3b-415e-9693-dc556eb5112a	SKILL	AVANZATO	ESSENZIALE
R092	ESCO_7111B95D0CE3441A9D924C75D05C4388	gestione di progetto	http://data.europa.eu/esco/skill/7111b95d-0ce3-441a-9d92-4c75d05c4388	KNOWLEDGE	AVANZATO	ESSENZIALE
R092	ESCO_B4832996B36C40B2B54E780325B2546E	adattare la formazione al mercato del lavoro	http://data.europa.eu/esco/skill/b4832996-b36c-40b2-b54e-780325b2546e	SKILL	INTERMEDIO	ESSENZIALE
R092	ESCO_B9BB1F0315E24079943E7E483B21725B	fornire un riscontro costruttivo	http://data.europa.eu/esco/skill/b9bb1f03-15e2-4079-943e-7e483b21725b	SKILL	INTERMEDIO	ESSENZIALE
R092	ESCO_C6E308B487994461A9BD560BDECB0DBB	processi dell’ufficio risorse umane	http://data.europa.eu/esco/skill/c6e308b4-8799-4461-a9bd-560bdecb0dbb	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R092	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R092	ESCO_F77B73F08C654389A3AE3A57A73AD148	sviluppare programmi per trattenere i dipendenti	http://data.europa.eu/esco/skill/f77b73f0-8c65-4389-a3ae-3a57a73ad148	SKILL	INTERMEDIO	UTILE
R093	ESCO_08FE59108C4C4679A988EB2DED3C4909	legislazione del lavoro	http://data.europa.eu/esco/skill/08fe5910-8c4c-4679-a988-eb2ded3c4909	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R093	ESCO_1212AC4225644FCE80E16CE4EA4D9BF5	offrire consulenza sulla gestione del personale	http://data.europa.eu/esco/skill/1212ac42-2564-4fce-80e1-6ce4ea4d9bf5	SKILL	INTERMEDIO	UTILE
R093	ESCO_21C5790C09304D74B3B084CAF5AF12EA	gestire i bilanci	http://data.europa.eu/esco/skill/21c5790c-0930-4d74-b3b0-84caf5af12ea	SKILL	AVANZATO	ESSENZIALE
R093	ESCO_36ECE87E32BC4FB587732AA5160CB93B	gestire i fondi pensione	http://data.europa.eu/esco/skill/36ece87e-32bc-4fb5-8773-2aa5160cb93b	SKILL	AVANZATO	ESSENZIALE
R093	ESCO_88B406D072E24087BE19D5992D259473	gestione del personale	http://data.europa.eu/esco/skill/88b406d0-72e2-4087-be19-d5992d259473	KNOWLEDGE	AVANZATO	ESSENZIALE
R093	ESCO_9D916D7C89B34084A6D9E2B0B3091404	gestire l’ufficio paghe	http://data.europa.eu/esco/skill/9d916d7c-89b3-4084-a6d9-e2b0b3091404	SKILL	AVANZATO	ESSENZIALE
R093	ESCO_B3F22AB4B553439D80A25B8AE6D11E0D	diritto del lavoro	http://data.europa.eu/esco/skill/b3f22ab4-b553-439d-80a2-5b8ae6d11e0d	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R093	ESCO_E437EBA13E2241F28703741E94785CBA	gestione delle risorse umane	http://data.europa.eu/esco/skill/e437eba1-3e22-41f2-8703-741e94785cba	KNOWLEDGE	AVANZATO	ESSENZIALE
R093	ESCO_F206E732110C47CEA53FF00C9D97C90D	strategie di gestione dei talenti	http://data.europa.eu/esco/skill/f206e732-110c-47ce-a53f-f00c9d97c90d	KNOWLEDGE	AVANZATO	ESSENZIALE
R093	ESCO_F77B73F08C654389A3AE3A57A73AD148	sviluppare programmi per trattenere i dipendenti	http://data.europa.eu/esco/skill/f77b73f0-8c65-4389-a3ae-3a57a73ad148	SKILL	INTERMEDIO	UTILE
R094	ESCO_0A43729F2A794DAE9FAA95520DAAE79F	applicare le politiche aziendali	http://data.europa.eu/esco/skill/0a43729f-2a79-4dae-9faa-95520daae79f	SKILL	INTERMEDIO	ESSENZIALE
R094	ESCO_3EE090A19D1C44EDBD93F6B7C9B68A97	gestire i resoconti sulle buste paga	http://data.europa.eu/esco/skill/3ee090a1-9d1c-44ed-bd93-f6b7c9b68a97	SKILL	AVANZATO	ESSENZIALE
R094	ESCO_7FF2C6680E86418AA9624958262EE337	utilizzare le tecniche di comunicazione	http://data.europa.eu/esco/skill/7ff2c668-0e86-418a-a962-4958262ee337	SKILL	INTERMEDIO	ESSENZIALE
R094	ESCO_8D202E2285E947B1A1E03296D17244CD	rispettare la riservatezza	http://data.europa.eu/esco/skill/8d202e22-85e9-47b1-a1e0-3296d17244cd	SKILL	AVANZATO	ESSENZIALE
R094	ESCO_8EBB2C0A0BAA43BF95CF094047C57427	tenere l’amministrazione professionale	http://data.europa.eu/esco/skill/8ebb2c0a-0baa-43bf-95cf-094047c57427	SKILL	AVANZATO	ESSENZIALE
R094	ESCO_906C9E66BDEE4F8E93D788D9FCF39A0A	fissare le riunioni e gli incontri	http://data.europa.eu/esco/skill/906c9e66-bdee-4f8e-93d7-88d9fcf39a0a	SKILL	INTERMEDIO	ESSENZIALE
R094	ESCO_918F5211B99F4B299A346E475583EF55	scrivere relazioni connesse al lavoro	http://data.europa.eu/esco/skill/918f5211-b99f-4b29-9a34-6e475583ef55	SKILL	INTERMEDIO	ESSENZIALE
R094	ESCO_933E7CCF5D5646BAACA4857F826A6B3A	gestire gli appuntamenti	http://data.europa.eu/esco/skill/933e7ccf-5d56-46ba-aca4-857f826a6b3a	SKILL	INTERMEDIO	ESSENZIALE
R094	ESCO_DE2F0CE8F8D648C5A2134D065251CECF	comunicare tramite telefono	http://data.europa.eu/esco/skill/de2f0ce8-f8d6-48c5-a213-4d065251cecf	SKILL	BASE	UTILE
R094	ESCO_FC54BD7F0C034FDDAF8C5EB4021E716D	identificarsi con gli obiettivi aziendali	http://data.europa.eu/esco/skill/fc54bd7f-0c03-4fdd-af8c-5eb4021e716d	SKILL	INTERMEDIO	UTILE
R095	ESCO_38A5C459C5914F76A35837DE342BB11D	offerte del mercato del lavoro	http://data.europa.eu/esco/skill/38a5c459-c591-4f76-a358-37de342bb11d	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R095	ESCO_496932F10B6B4F739432D95C7DDCD43B	assumere dipendenti	http://data.europa.eu/esco/skill/496932f1-0b6b-4f73-9432-d95c7ddcd43b	SKILL	AVANZATO	ESSENZIALE
R095	ESCO_5AA57BDC5765435E8FC999B3FEBDB213	assumere risorse umane	http://data.europa.eu/esco/skill/5aa57bdc-5765-435e-8fc9-99b3febdb213	SKILL	AVANZATO	ESSENZIALE
R095	ESCO_66D47084943748B2819BC4C8214ED650	intervistare le persone	http://data.europa.eu/esco/skill/66d47084-9437-48b2-819b-c4c8214ed650	SKILL	AVANZATO	ESSENZIALE
R095	ESCO_68698869C13C4563ADC7118B7644F45D	individuare i desideri del cliente	http://data.europa.eu/esco/skill/68698869-c13c-4563-adc7-118b7644f45d	SKILL	INTERMEDIO	ESSENZIALE
R095	ESCO_8D202E2285E947B1A1E03296D17244CD	rispettare la riservatezza	http://data.europa.eu/esco/skill/8d202e22-85e9-47b1-a1e0-3296d17244cd	SKILL	AVANZATO	ESSENZIALE
R095	ESCO_929E89F9AC694BCB9EEA37257AA5AFF9	preparare le persone a sostenere un colloquio di lavoro	http://data.europa.eu/esco/skill/929e89f9-ac69-4bcb-9eea-37257aa5aff9	SKILL	INTERMEDIO	UTILE
R095	ESCO_BF5D77ADE18C48D883F0BC79C011C74A	sviluppare una rete professionale	http://data.europa.eu/esco/skill/bf5d77ad-e18c-48d8-83f0-bc79c011c74a	SKILL	INTERMEDIO	UTILE
R095	ESCO_E437EBA13E2241F28703741E94785CBA	gestione delle risorse umane	http://data.europa.eu/esco/skill/e437eba1-3e22-41f2-8703-741e94785cba	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R095	ESCO_E49C4D19DEA642A1BDE230D69DC0CA24	scrivere il profilo delle persone	http://data.europa.eu/esco/skill/e49c4d19-dea6-42a1-bde2-30d69dc0ca24	SKILL	AVANZATO	ESSENZIALE
R096	ESCO_0FBACEFFDF054EF7B735188DC183B56B	effettuare l’analisi del lavoro	http://data.europa.eu/esco/skill/0fbaceff-df05-4ef7-b735-188dc183b56b	SKILL	AVANZATO	ESSENZIALE
R096	ESCO_2136F9D2EBB54C1FAA2DCEE24417C5C7	promuovere la parità di retribuzione	http://data.europa.eu/esco/skill/2136f9d2-ebb5-4c1f-aa2d-cee24417c5c7	SKILL	INTERMEDIO	ESSENZIALE
R096	ESCO_4E02CE5A7321426BA8096C507F30EF52	tecniche di valutazione aziendale	http://data.europa.eu/esco/skill/4e02ce5a-7321-426b-a809-6c507f30ef52	KNOWLEDGE	AVANZATO	UTILE
R096	ESCO_6789DEFADC5742A8B2ED2B8C349AA3E2	determinare gli stipendi	http://data.europa.eu/esco/skill/6789defa-dc57-42a8-b2ed-2b8c349aa3e2	SKILL	AVANZATO	ESSENZIALE
R096	ESCO_88B406D072E24087BE19D5992D259473	gestione del personale	http://data.europa.eu/esco/skill/88b406d0-72e2-4087-be19-d5992d259473	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R096	ESCO_99474C7C70964FF99E8703DB28727B00	calcolare i pagamenti dei risarcimenti	http://data.europa.eu/esco/skill/99474c7c-7096-4ff9-9e87-03db28727b00	SKILL	AVANZATO	ESSENZIALE
R096	ESCO_99571E68801F49AFA8975F75996642E1	analisi finanziaria	http://data.europa.eu/esco/skill/99571e68-801f-49af-a897-5f75996642e1	KNOWLEDGE	AVANZATO	ESSENZIALE
R096	ESCO_A4E50B958962440881F9F5DE71461276	calcolare le indennità dei dipendenti	http://data.europa.eu/esco/skill/a4e50b95-8962-4408-81f9-f5de71461276	SKILL	AVANZATO	ESSENZIALE
R096	ESCO_D9A3CB06D6E04A6488A69A8E11A99C93	mercato del lavoro	http://data.europa.eu/esco/skill/d9a3cb06-d6e0-4a64-88a6-9a8e11a99c93	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R096	ESCO_E437EBA13E2241F28703741E94785CBA	gestione delle risorse umane	http://data.europa.eu/esco/skill/e437eba1-3e22-41f2-8703-741e94785cba	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R097	ESCO_3E61EE412BD9466FB31300CE04072410	dirigere i direttori dei reparti dell’azienda	http://data.europa.eu/esco/skill/3e61ee41-2bd9-466f-b313-00ce04072410	SKILL	AVANZATO	ESSENZIALE
R097	ESCO_6ABB92C905534D3DADD88240494E182D	attuare il piano operativo dell’azienda	http://data.europa.eu/esco/skill/6abb92c9-0553-4d3d-add8-8240494e182d	SKILL	AVANZATO	ESSENZIALE
R097	ESCO_6C8709939341438B91C0C7FE4F96D8F5	applicare il pensiero strategico	http://data.europa.eu/esco/skill/6c870993-9341-438b-91c0-c7fe4f96d8f5	SKILL	AVANZATO	ESSENZIALE
R097	ESCO_6FCE8D3FA15F4F26943AD200B32F6949	monitorare la politica aziendale	http://data.europa.eu/esco/skill/6fce8d3f-a15f-4f26-943a-d200b32f6949	SKILL	AVANZATO	ESSENZIALE
R097	ESCO_949CED5F75364614AC60563FFC91A2F2	pianificazione strategica	http://data.europa.eu/esco/skill/949ced5f-7536-4614-ac60-563ffc91a2f2	KNOWLEDGE	AVANZATO	ESSENZIALE
R097	ESCO_953445C047704BE091CF270A64C0E297	attuare la gestione strategica	http://data.europa.eu/esco/skill/953445c0-4770-4be0-91cf-270a64c0e297	SKILL	AVANZATO	ESSENZIALE
R097	ESCO_BA2C6181B03640B48F6D51499463CCBB	sviluppare le strategie aziendali	http://data.europa.eu/esco/skill/ba2c6181-b036-40b4-8f6d-51499463ccbb	SKILL	AVANZATO	ESSENZIALE
R097	ESCO_EAD58F220AF5467CAC1EB750E4E1AC6A	sviluppare i piani aziendali	http://data.europa.eu/esco/skill/ead58f22-0af5-467c-ac1e-b750e4e1ac6a	SKILL	AVANZATO	ESSENZIALE
R097	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	AVANZATO	ESSENZIALE
R097	ESCO_F7B5D91652F04865B6A6E1A3B711CB5E	attuare la pianificazione strategica	http://data.europa.eu/esco/skill/f7b5d916-52f0-4865-b6a6-e1a3b711cb5e	SKILL	AVANZATO	ESSENZIALE
R098	ESCO_05CD93410D924BCC983CBF47132AC3F8	supervisionare i dipendenti degli stabilimenti di produzione alimentare	http://data.europa.eu/esco/skill/05cd9341-0d92-4bcc-983c-bf47132ac3f8	SKILL	INTERMEDIO	ESSENZIALE
R098	ESCO_095B0A0F9B664E42965ED1C538A2986F	stabilire gli indicatori chiave di prestazione (KPI) del processo di produzione	http://data.europa.eu/esco/skill/095b0a0f-9b66-4e42-965e-d1c538a2986f	SKILL	AVANZATO	ESSENZIALE
R098	ESCO_22B8039CC890461092285527E3B98F12	stabilire obiettivi di garanzia della qualità	http://data.europa.eu/esco/skill/22b8039c-c890-4610-9228-5527e3b98f12	SKILL	INTERMEDIO	ESSENZIALE
R098	ESCO_286E486CA09447158E5BA2370B09A408	gestire azioni correttive	http://data.europa.eu/esco/skill/286e486c-a094-4715-8e5b-a2370b09a408	SKILL	INTERMEDIO	ESSENZIALE
R098	ESCO_2DA7327367CE4A5DB890491491BAC073	attuare obiettivi a breve termine	http://data.europa.eu/esco/skill/2da73273-67ce-4a5d-b890-491491bac073	SKILL	INTERMEDIO	ESSENZIALE
R098	ESCO_4548416B23104AFCBD6AC022D3E41014	garantire efficienza in termini di costi nella produzione alimentare	http://data.europa.eu/esco/skill/4548416b-2310-4afc-bd6a-c022d3e41014	SKILL	AVANZATO	ESSENZIALE
R098	ESCO_811BDB9D5BF74B5AA3F54FC2002F6D57	capacità finanziaria	http://data.europa.eu/esco/skill/811bdb9d-5bf7-4b5a-a3f5-4fc2002f6d57	KNOWLEDGE	AVANZATO	ESSENZIALE
R098	ESCO_AA5428E2546445BCAD2B928775051258	gestire le risorse nella produzione alimentare	http://data.europa.eu/esco/skill/aa5428e2-5464-45bc-ad2b-928775051258	SKILL	INTERMEDIO	ESSENZIALE
R098	ESCO_E1F5C5397C9349EE917DA24E0D887686	controllare le spese	http://data.europa.eu/esco/skill/e1f5c539-7c93-49ee-917d-a24e0d887686	SKILL	AVANZATO	ESSENZIALE
R098	ESCO_F6FCC8953DFC4B00BB83348E3C9C72E1	interpretare dati relativi alla produzione alimentare	http://data.europa.eu/esco/skill/f6fcc895-3dfc-4b00-bb83-348e3c9c72e1	SKILL	AVANZATO	ESSENZIALE
R099	ESCO_27ED854C15B84BA290E9AE888A219703	eseguire l’analisi commerciale	http://data.europa.eu/esco/skill/27ed854c-15b8-4ba2-90e9-ae888a219703	SKILL	AVANZATO	ESSENZIALE
R099	ESCO_5DA3C76510A349EB934CEC401CEB1A34	analizzare i piani economici	http://data.europa.eu/esco/skill/5da3c765-10a3-49eb-934c-ec401ceb1a34	SKILL	AVANZATO	ESSENZIALE
R099	ESCO_5F1D131979544A9B90C757668E3A0D4B	interpretare i bilanci d’esercizio	http://data.europa.eu/esco/skill/5f1d1319-7954-4a9b-90c7-57668e3a0d4b	SKILL	AVANZATO	ESSENZIALE
R099	ESCO_633A36372C6B40AEAC38289EB2A62AA6	analisi aziendale	http://data.europa.eu/esco/skill/633a3637-2c6b-40ae-ac38-289eb2a62aa6	KNOWLEDGE	AVANZATO	ESSENZIALE
R099	ESCO_65E58886BD1E4C5B8CA58D9B353C8AA1	software di visualizzazione dei dati	http://data.europa.eu/esco/skill/65e58886-bd1e-4c5b-8ca5-8d9b353c8aa1	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R099	ESCO_6EFF134BE34F4D6EA6E85E47CF2228D0	gestione del rischio	http://data.europa.eu/esco/skill/6eff134b-e34f-4d6e-a6e8-5e47cf2228d0	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R099	ESCO_8A43795BBB384F2991DFA6C92AD4643C	analizzare le prestazioni finanziarie di un’impresa	http://data.europa.eu/esco/skill/8a43795b-bb38-4f29-91df-a6c92ad4643c	SKILL	AVANZATO	ESSENZIALE
R099	ESCO_91816E1AD0264D219B1C59CA5CF488DE	analizzare i fattori interni delle imprese	http://data.europa.eu/esco/skill/91816e1a-d026-4d21-9b1c-59ca5cf488de	SKILL	INTERMEDIO	ESSENZIALE
R099	ESCO_98A1DEC381384F46A5965E2A83B884B9	analisi dei processi operativi	http://data.europa.eu/esco/skill/98a1dec3-8138-4f46-a596-5e2a83b884b9	KNOWLEDGE	AVANZATO	ESSENZIALE
R099	ESCO_CE5B1446B5E34F05A5AC83F2EE142A44	analizzare i fattori esterni delle imprese	http://data.europa.eu/esco/skill/ce5b1446-b5e3-4f05-a5ac-83f2ee142a44	SKILL	INTERMEDIO	ESSENZIALE
R100	ESCO_415ABD43E8E54643B5DA5F11307AF57A	utilizzare canali di comunicazione diversi	http://data.europa.eu/esco/skill/415abd43-e8e5-4643-b5da-5f11307af57a	SKILL	INTERMEDIO	ESSENZIALE
R100	ESCO_6AE8306A4F9D4410AC826406F3CBD16A	gestire i sistemi degli uffici	http://data.europa.eu/esco/skill/6ae8306a-4f9d-4410-ac82-6406f3cbd16a	SKILL	INTERMEDIO	ESSENZIALE
R100	ESCO_71DDE84C00584C52A556523369333DB8	utilizzare i sistemi per ufficio	http://data.europa.eu/esco/skill/71dde84c-0058-4c52-a556-523369333db8	SKILL	INTERMEDIO	ESSENZIALE
R100	ESCO_77E7CB082C6F42AB881BB34B2318ACBE	gestire sistemi amministrativi	http://data.europa.eu/esco/skill/77e7cb08-2c6f-42ab-881b-b34b2318acbe	SKILL	INTERMEDIO	ESSENZIALE
R100	ESCO_7D35602DBC944975AA7CF4E8E05CE8E0	gestione dei costi	http://data.europa.eu/esco/skill/7d35602d-bc94-4975-aa7c-f4e8e05ce8e0	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R100	ESCO_918F5211B99F4B299A346E475583EF55	scrivere relazioni connesse al lavoro	http://data.europa.eu/esco/skill/918f5211-b99f-4b29-9a34-6e475583ef55	SKILL	AVANZATO	ESSENZIALE
R100	ESCO_958B8802EC3E481397F76C8F48610DBD	individuare i miglioramenti dei processi	http://data.europa.eu/esco/skill/958b8802-ec3e-4813-97f7-6c8f48610dbd	SKILL	INTERMEDIO	ESSENZIALE
R100	ESCO_9D59F4E520A5428EB8B3645043500457	creare un’atmosfera di lavoro volta al miglioramento continuo	http://data.europa.eu/esco/skill/9d59f4e5-20a5-428e-b8b3-645043500457	SKILL	BASE	UTILE
R100	ESCO_CF310CFF0D284DBC9DBBCC500A3196C2	software per ufficio	http://data.europa.eu/esco/skill/cf310cff-0d28-4dbc-9dbb-cc500a3196c2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R100	ESCO_D58A48D15B7F4028AE11B051D13EE1A8	analizzare la capacità produttiva del personale	http://data.europa.eu/esco/skill/d58a48d1-5b7f-4028-ae11-b051d13ee1a8	SKILL	INTERMEDIO	UTILE
R101	ESCO_117476650E984F27BD0D536862CD5746	identificare fornitori	http://data.europa.eu/esco/skill/11747665-0e98-4f27-bd0d-536862cd5746	SKILL	INTERMEDIO	ESSENZIALE
R101	ESCO_210827E3312945A2868370399F3F561F	ordinare le forniture	http://data.europa.eu/esco/skill/210827e3-3129-45a2-8683-70399f3f561f	SKILL	INTERMEDIO	ESSENZIALE
R101	ESCO_21C5790C09304D74B3B084CAF5AF12EA	gestire i bilanci	http://data.europa.eu/esco/skill/21c5790c-0930-4d74-b3b0-84caf5af12ea	SKILL	AVANZATO	ESSENZIALE
R101	ESCO_3CD35F5DCE6D4F149A0953D7A28D834C	tenere i rapporti con i fornitori	http://data.europa.eu/esco/skill/3cd35f5d-ce6d-4f14-9a09-53d7a28d834c	SKILL	AVANZATO	ESSENZIALE
R101	ESCO_7111B95D0CE3441A9D924C75D05C4388	gestione di progetto	http://data.europa.eu/esco/skill/7111b95d-0ce3-441a-9d92-4c75d05c4388	KNOWLEDGE	AVANZATO	ESSENZIALE
R101	ESCO_AB6265F2A9BF49E8A9A567CBAB4DE38B	gestire l’inventario	http://data.europa.eu/esco/skill/ab6265f2-a9bf-49e8-a9a5-67cbab4de38b	SKILL	AVANZATO	ESSENZIALE
R101	ESCO_CF579543272B43C8B942555836AE4241	principi della catena di approvvigionamento	http://data.europa.eu/esco/skill/cf579543-272b-43c8-b942-555836ae4241	KNOWLEDGE	AVANZATO	ESSENZIALE
R101	ESCO_D1724CA5EBD3472ABEA9FAD9FE9004BF	stimare i costi delle forniture necessarie	http://data.europa.eu/esco/skill/d1724ca5-ebd3-472a-bea9-fad9fe9004bf	SKILL	INTERMEDIO	ESSENZIALE
R101	ESCO_F929C89EC3634132A918E021D57B307C	gestione della catena di approvvigionamento	http://data.europa.eu/esco/skill/f929c89e-c363-4132-a918-e021d57b307c	KNOWLEDGE	AVANZATO	ESSENZIALE
R101	ESCO_FE1EC582D63B466C9149E7FC4FE93E22	gestione dei fornitori	http://data.europa.eu/esco/skill/fe1ec582-d63b-466c-9149-e7fc4fe93e22	KNOWLEDGE	AVANZATO	ESSENZIALE
R102	ESCO_0295B2A4FB86495F9547D479532FC4C2	rintracciare le transazioni finanziarie	http://data.europa.eu/esco/skill/0295b2a4-fb86-495f-9547-d479532fc4c2	SKILL	INTERMEDIO	ESSENZIALE
R102	ESCO_16F61A5B23BA4268851782C77C4041A1	esaminare i bilanci	http://data.europa.eu/esco/skill/16f61a5b-23ba-4268-8517-82c77c4041a1	SKILL	INTERMEDIO	ESSENZIALE
R102	ESCO_207F87C4AC684987990C636CA19C2626	calcolare i salari	http://data.europa.eu/esco/skill/207f87c4-ac68-4987-990c-636ca19c2626	SKILL	AVANZATO	ESSENZIALE
R102	ESCO_4339176E3ACD4F7FA5D9445BEE3D23F2	matematica	http://data.europa.eu/esco/skill/4339176e-3acd-4f7f-a5d9-445bee3d23f2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R102	ESCO_4E756773AE144981838B9FE27E81C0AF	effettuare le transazioni finanziarie	http://data.europa.eu/esco/skill/4e756773-ae14-4981-838b-9fe27e81c0af	SKILL	INTERMEDIO	ESSENZIALE
R102	ESCO_734187E4650E4A0AA7F8826CD4757229	controllare le retribuzioni	http://data.europa.eu/esco/skill/734187e4-650e-4a0a-a7f8-826cd4757229	SKILL	AVANZATO	ESSENZIALE
R102	ESCO_9D916D7C89B34084A6D9E2B0B3091404	gestire l’ufficio paghe	http://data.europa.eu/esco/skill/9d916d7c-89b3-4084-a6d9-e2b0b3091404	SKILL	AVANZATO	ESSENZIALE
R102	ESCO_AF0F7625B9FC4F97A71DD7C7648BFC35	preparare le buste paga	http://data.europa.eu/esco/skill/af0f7625-b9fc-4f97-a71d-d7c7648bfc35	SKILL	AVANZATO	ESSENZIALE
R102	ESCO_EE6A9D2001324F319DA332FDC5749A9B	assegnare le buste paga	http://data.europa.eu/esco/skill/ee6a9d20-0132-4f31-9da3-32fdc5749a9b	SKILL	BASE	UTILE
R102	ESCO_FF5E9B54D1414F5AAD04DDEFD7D8843F	ottenere l’approvazione dei fogli di presenza	http://data.europa.eu/esco/skill/ff5e9b54-d141-4f5a-ad04-ddefd7d8843f	SKILL	INTERMEDIO	ESSENZIALE
R103	ESCO_117476650E984F27BD0D536862CD5746	identificare fornitori	http://data.europa.eu/esco/skill/11747665-0e98-4f27-bd0d-536862cd5746	SKILL	INTERMEDIO	ESSENZIALE
R103	ESCO_3CD35F5DCE6D4F149A0953D7A28D834C	tenere i rapporti con i fornitori	http://data.europa.eu/esco/skill/3cd35f5d-ce6d-4f14-9a09-53d7a28d834c	SKILL	INTERMEDIO	ESSENZIALE
R103	ESCO_650F44E2CB4C41BA9095581FE6BEA4B1	coordinare le attività di acquisto	http://data.europa.eu/esco/skill/650f44e2-cb4c-41ba-9095-581fe6bea4b1	SKILL	AVANZATO	ESSENZIALE
R103	ESCO_71152876B6294A99B9EA0F25A0D07E4E	negoziare i contratti di compravendita	http://data.europa.eu/esco/skill/71152876-b629-4a99-b9ea-0f25a0d07e4e	SKILL	AVANZATO	ESSENZIALE
R103	ESCO_92721092FE7C468996BD4F02385BC0E7	gestire i contratti	http://data.europa.eu/esco/skill/92721092-fe7c-4689-96bd-4f02385bc0e7	SKILL	AVANZATO	ESSENZIALE
R103	ESCO_96EC2D534F4141728EF270742C4BB540	valutare i rischi del fornitore	http://data.europa.eu/esco/skill/96ec2d53-4f41-4172-8ef2-70742c4bb540	SKILL	AVANZATO	ESSENZIALE
R103	ESCO_D1724CA5EBD3472ABEA9FAD9FE9004BF	stimare i costi delle forniture necessarie	http://data.europa.eu/esco/skill/d1724ca5-ebd3-472a-bea9-fad9fe9004bf	SKILL	INTERMEDIO	ESSENZIALE
R103	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R103	ESCO_FDE186DFC9C449F5B2A5D66ADC7C43A5	negoziare le condizioni di acquisto	http://data.europa.eu/esco/skill/fde186df-c9c4-49f5-b2a5-d66adc7c43a5	SKILL	AVANZATO	ESSENZIALE
R103	ESCO_FE1EC582D63B466C9149E7FC4FE93E22	gestione dei fornitori	http://data.europa.eu/esco/skill/fe1ec582-d63b-466c-9149-e7fc4fe93e22	KNOWLEDGE	AVANZATO	ESSENZIALE
R104	ESCO_0295B2A4FB86495F9547D479532FC4C2	rintracciare le transazioni finanziarie	http://data.europa.eu/esco/skill/0295b2a4-fb86-495f-9547-d479532fc4c2	SKILL	INTERMEDIO	ESSENZIALE
R104	ESCO_16F61A5B23BA4268851782C77C4041A1	esaminare i bilanci	http://data.europa.eu/esco/skill/16f61a5b-23ba-4268-8517-82c77c4041a1	SKILL	INTERMEDIO	ESSENZIALE
R104	ESCO_207F87C4AC684987990C636CA19C2626	calcolare i salari	http://data.europa.eu/esco/skill/207f87c4-ac68-4987-990c-636ca19c2626	SKILL	AVANZATO	ESSENZIALE
R104	ESCO_4339176E3ACD4F7FA5D9445BEE3D23F2	matematica	http://data.europa.eu/esco/skill/4339176e-3acd-4f7f-a5d9-445bee3d23f2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R104	ESCO_4E756773AE144981838B9FE27E81C0AF	effettuare le transazioni finanziarie	http://data.europa.eu/esco/skill/4e756773-ae14-4981-838b-9fe27e81c0af	SKILL	INTERMEDIO	ESSENZIALE
R104	ESCO_734187E4650E4A0AA7F8826CD4757229	controllare le retribuzioni	http://data.europa.eu/esco/skill/734187e4-650e-4a0a-a7f8-826cd4757229	SKILL	AVANZATO	ESSENZIALE
R104	ESCO_9D916D7C89B34084A6D9E2B0B3091404	gestire l’ufficio paghe	http://data.europa.eu/esco/skill/9d916d7c-89b3-4084-a6d9-e2b0b3091404	SKILL	INTERMEDIO	ESSENZIALE
R104	ESCO_AF0F7625B9FC4F97A71DD7C7648BFC35	preparare le buste paga	http://data.europa.eu/esco/skill/af0f7625-b9fc-4f97-a71d-d7c7648bfc35	SKILL	AVANZATO	ESSENZIALE
R104	ESCO_FF5E9B54D1414F5AAD04DDEFD7D8843F	ottenere l’approvazione dei fogli di presenza	http://data.europa.eu/esco/skill/ff5e9b54-d141-4f5a-ad04-ddefd7d8843f	SKILL	BASE	ESSENZIALE
R105	ESCO_117476650E984F27BD0D536862CD5746	identificare fornitori	http://data.europa.eu/esco/skill/11747665-0e98-4f27-bd0d-536862cd5746	SKILL	INTERMEDIO	ESSENZIALE
R105	ESCO_31EECEA5C1EF4E5C96A9808FF4E43813	rilevare l’andamento dei prezzi	http://data.europa.eu/esco/skill/31eecea5-c1ef-4e5c-96a9-808ff4e43813	SKILL	INTERMEDIO	ESSENZIALE
R105	ESCO_3CD35F5DCE6D4F149A0953D7A28D834C	tenere i rapporti con i fornitori	http://data.europa.eu/esco/skill/3cd35f5d-ce6d-4f14-9a09-53d7a28d834c	SKILL	INTERMEDIO	ESSENZIALE
R105	ESCO_650F44E2CB4C41BA9095581FE6BEA4B1	coordinare le attività di acquisto	http://data.europa.eu/esco/skill/650f44e2-cb4c-41ba-9095-581fe6bea4b1	SKILL	INTERMEDIO	ESSENZIALE
R105	ESCO_732250187139433BBDBA2B90774761D9	emettere gli ordini di acquisto	http://data.europa.eu/esco/skill/73225018-7139-433b-bdba-2b90774761d9	SKILL	AVANZATO	ESSENZIALE
R105	ESCO_92721092FE7C468996BD4F02385BC0E7	gestire i contratti	http://data.europa.eu/esco/skill/92721092-fe7c-4689-96bd-4f02385bc0e7	SKILL	INTERMEDIO	ESSENZIALE
R105	ESCO_96EC2D534F4141728EF270742C4BB540	valutare i rischi del fornitore	http://data.europa.eu/esco/skill/96ec2d53-4f41-4172-8ef2-70742c4bb540	SKILL	INTERMEDIO	ESSENZIALE
R105	ESCO_9E9A4209C7CF4F6E973EDC2FFADCCC74	svolgere le procedure di approvvigionamento	http://data.europa.eu/esco/skill/9e9a4209-c7cf-4f6e-973e-dc2ffadccc74	SKILL	AVANZATO	ESSENZIALE
R105	ESCO_A6AE7A345A5C48DD9B828BECCCA63E3C	garantire la conformità con le normative di acquisto e di appalto	http://data.europa.eu/esco/skill/a6ae7a34-5a5c-48dd-9b82-8beccca63e3c	SKILL	INTERMEDIO	ESSENZIALE
R105	ESCO_C7D64DF47AF34269ADD697833BD5448E	gestire il ciclo di acquisto	http://data.europa.eu/esco/skill/c7d64df4-7af3-4269-add6-97833bd5448e	SKILL	AVANZATO	ESSENZIALE
R106	ESCO_0839EEA4C57B4C14B19B923FBEDB5D88	effettuare una ricerca per fini aziendali	http://data.europa.eu/esco/skill/0839eea4-c57b-4c14-b19b-923fbedb5d88	SKILL	INTERMEDIO	ESSENZIALE
R106	ESCO_1973C966F23640C9B2D45D71A89019BE	utilizzare software per fogli elettronici	http://data.europa.eu/esco/skill/1973c966-f236-40c9-b2d4-5d71a89019be	SKILL	INTERMEDIO	ESSENZIALE
R106	ESCO_1F6EAC42E5AA4FA7A75DA4EEA12C618E	diffondere le comunicazioni interne	http://data.europa.eu/esco/skill/1f6eac42-e5aa-4fa7-a75d-a4eea12c618e	SKILL	INTERMEDIO	ESSENZIALE
R106	ESCO_4BD6E2ADBF694198B3AC3BAABD9DA46E	offrire supporto ai responsabili	http://data.europa.eu/esco/skill/4bd6e2ad-bf69-4198-b3ac-3baabd9da46e	SKILL	INTERMEDIO	ESSENZIALE
R106	ESCO_71DDE84C00584C52A556523369333DB8	utilizzare i sistemi per ufficio	http://data.europa.eu/esco/skill/71dde84c-0058-4c52-a556-523369333db8	SKILL	INTERMEDIO	ESSENZIALE
R106	ESCO_906C9E66BDEE4F8E93D788D9FCF39A0A	fissare le riunioni e gli incontri	http://data.europa.eu/esco/skill/906c9e66-bdee-4f8e-93d7-88d9fcf39a0a	SKILL	BASE	ESSENZIALE
R106	ESCO_918F5211B99F4B299A346E475583EF55	scrivere relazioni connesse al lavoro	http://data.europa.eu/esco/skill/918f5211-b99f-4b29-9a34-6e475583ef55	SKILL	INTERMEDIO	ESSENZIALE
R106	ESCO_EC0BBF390EDD4015A2C382AD563CE3A8	redigere i messaggi di posta elettronica aziendali	http://data.europa.eu/esco/skill/ec0bbf39-0edd-4015-a2c3-82ad563ce3a8	SKILL	INTERMEDIO	ESSENZIALE
R106	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R106	ESCO_F75B740CB36C495EBC67EFE347BBC6B5	politiche aziendali	http://data.europa.eu/esco/skill/f75b740c-b36c-495e-bc67-efe347bbc6b5	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R107	ESCO_0DAAF0961639461CBF1ABBEEA77E6B67	politica interna di gestione del rischio	http://data.europa.eu/esco/skill/0daaf096-1639-461c-bf1a-bbeea77e6b67	KNOWLEDGE	AVANZATO	ESSENZIALE
R107	ESCO_1A63B1A72CAC437287607BB6AFB36949	analizzare questioni di sicurezza	http://data.europa.eu/esco/skill/1a63b1a7-2cac-4372-8760-7bb6afb36949	SKILL	AVANZATO	ESSENZIALE
R107	ESCO_2ABFAC2EAD5149FDBBED34953C95AB20	supervisionare la pianificazione dei sistemi di sicurezza	http://data.europa.eu/esco/skill/2abfac2e-ad51-49fd-bbed-34953c95ab20	SKILL	AVANZATO	ESSENZIALE
R107	ESCO_5760A84EC9A04C369BEE46A8CF1A036D	stabilire regolari procedure di sicurezza del sito	http://data.europa.eu/esco/skill/5760a84e-c9a0-4c36-9bee-46a8cf1a036d	SKILL	AVANZATO	ESSENZIALE
R107	ESCO_64852ADE6AE14760BA4A976BF07CA255	gestire piani di disaster recovery	http://data.europa.eu/esco/skill/64852ade-6ae1-4760-ba4a-976bf07ca255	SKILL	AVANZATO	ESSENZIALE
R107	ESCO_6CD29D73E35240B489C5CDB3FAFF0A38	gestire il personale di sicurezza	http://data.europa.eu/esco/skill/6cd29d73-e352-40b4-89c5-cdb3faff0a38	SKILL	AVANZATO	ESSENZIALE
R107	ESCO_79F24A62771846E19B4137BE0560A5CA	resilienza organizzativa	http://data.europa.eu/esco/skill/79f24a62-7718-46e1-9b41-37be0560a5ca	KNOWLEDGE	AVANZATO	ESSENZIALE
R107	ESCO_BAD614FBFC664401B75B3D366013A493	scrivere le relazioni su aspetti relativi alla sicurezza	http://data.europa.eu/esco/skill/bad614fb-fc66-4401-b75b-3d366013a493	SKILL	INTERMEDIO	ESSENZIALE
R107	ESCO_D433C82EFA7A492EA8FDEEE7B39E4C48	norme di sicurezza	http://data.europa.eu/esco/skill/d433c82e-fa7a-492e-a8fd-eee7b39e4c48	KNOWLEDGE	AVANZATO	ESSENZIALE
R107	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R108	ESCO_1A63B1A72CAC437287607BB6AFB36949	analizzare questioni di sicurezza	http://data.europa.eu/esco/skill/1a63b1a7-2cac-4372-8760-7bb6afb36949	SKILL	AVANZATO	ESSENZIALE
R108	ESCO_339AC029066A49859F9DB3D7C8FEA0BB	coordinare lo staff	http://data.europa.eu/esco/skill/339ac029-066a-4985-9f9d-b3d7c8fea0bb	SKILL	INTERMEDIO	ESSENZIALE
R108	ESCO_42645B8406994072B9CF335512434B67	uso legale della forza	http://data.europa.eu/esco/skill/42645b84-0699-4072-b9cf-335512434b67	KNOWLEDGE	AVANZATO	ESSENZIALE
R108	ESCO_5760A84EC9A04C369BEE46A8CF1A036D	stabilire regolari procedure di sicurezza del sito	http://data.europa.eu/esco/skill/5760a84e-c9a0-4c36-9bee-46a8cf1a036d	SKILL	AVANZATO	ESSENZIALE
R108	ESCO_69F2342692794FE6A28324C2AA4C855D	garantire la disponibilità delle attrezzature	http://data.europa.eu/esco/skill/69f23426-9279-4fe6-a283-24c2aa4c855d	SKILL	INTERMEDIO	ESSENZIALE
R108	ESCO_6CD29D73E35240B489C5CDB3FAFF0A38	gestire il personale di sicurezza	http://data.europa.eu/esco/skill/6cd29d73-e352-40b4-89c5-cdb3faff0a38	SKILL	AVANZATO	ESSENZIALE
R108	ESCO_865CCBA0E1A2402C9641D23A4ACAC6EA	gestire le attrezzature di sicurezza	http://data.europa.eu/esco/skill/865ccba0-e1a2-402c-9641-d23a4acac6ea	SKILL	AVANZATO	ESSENZIALE
R108	ESCO_8D13E6ED49E84C0D876C4629D798B2C8	maneggiare l’attrezzatura di sicurezza e sorveglianza	http://data.europa.eu/esco/skill/8d13e6ed-49e8-4c0d-876c-4629d798b2c8	SKILL	AVANZATO	ESSENZIALE
R108	ESCO_D433C82EFA7A492EA8FDEEE7B39E4C48	norme di sicurezza	http://data.europa.eu/esco/skill/d433c82e-fa7a-492e-a8fd-eee7b39e4c48	KNOWLEDGE	AVANZATO	ESSENZIALE
R108	ESCO_F14FF4B7BE1E4B55B39B520005F8A97E	collaborare con i dirigenti	http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e	SKILL	INTERMEDIO	ESSENZIALE
R109	ESCO_0C606377FBD64F66B700BA4524670B73	vagliare i clienti	http://data.europa.eu/esco/skill/0c606377-fbd6-4f66-b700-ba4524670b73	SKILL	INTERMEDIO	ESSENZIALE
R109	ESCO_1B45B91C094945CFA6D8040A62423060	monitorare gli accessi degli ospiti	http://data.europa.eu/esco/skill/1b45b91c-0949-45cf-a6d8-040a62423060	SKILL	INTERMEDIO	ESSENZIALE
R109	ESCO_499C05A26F36440783C1DC3448D35818	garantire la sicurezza e l’incolumità delle persone	http://data.europa.eu/esco/skill/499c05a2-6f36-4407-83c1-dc3448d35818	SKILL	AVANZATO	ESSENZIALE
R109	ESCO_49E1EB78E6B141168E9FF23316EE503E	reagire con calma in situazioni di stress	http://data.europa.eu/esco/skill/49e1eb78-e6b1-4116-8e9f-f23316ee503e	SKILL	AVANZATO	ESSENZIALE
R109	ESCO_61268E2293674C3B91D9B651E4C142E2	normative di sicurezza antincendio	http://data.europa.eu/esco/skill/61268e22-9367-4c3b-91d9-b651e4c142e2	KNOWLEDGE	INTERMEDIO	ESSENZIALE
R109	ESCO_753F2B67BA4749C2A3FDC40C4CFB4421	controllare la folla	http://data.europa.eu/esco/skill/753f2b67-ba47-49c2-a3fd-c40c4cfb4421	SKILL	INTERMEDIO	ESSENZIALE
R109	ESCO_A4FD17BF630947C5B7FAAE5560673ACF	individuare le minacce alla sicurezza	http://data.europa.eu/esco/skill/a4fd17bf-6309-47c5-b7fa-ae5560673acf	SKILL	AVANZATO	ESSENZIALE
R109	ESCO_AE699DE107464FE286F017770DB7790D	eseguire i controlli di sicurezza	http://data.europa.eu/esco/skill/ae699de1-0746-4fe2-86f0-17770db7790d	SKILL	AVANZATO	ESSENZIALE
R109	ESCO_C1B0BFC249324E03907792BC56042511	gestire i piani di evacuazione di emergenza	http://data.europa.eu/esco/skill/c1b0bfc2-4932-4e03-9077-92bc56042511	SKILL	INTERMEDIO	UTILE
R109	ESCO_F83C245F4AA9484F8FD24AD65DD82AE5	praticare la vigilanza	http://data.europa.eu/esco/skill/f83c245f-4aa9-484f-8fd2-4ad65dd82ae5	SKILL	AVANZATO	ESSENZIALE
\.
COPY staging.rtl_persona_corsa FROM STDIN;
Amato, Gabriele	R051	3A2L
Barbieri, Paolo	R092	QD2
Barbieri, Pietro	R051	3A2L
Barbieri, Riccardo	R020	3A3L
Bellini, Quintino	R084	Dirigente
Bernardi, Antonio	R051	3A2L
Bianchi, Luca	R027	Dirigente
Bianco, Valentina	R059	3A3L
Bruno, Ilaria	R078	-
Bruno, Marco	R094	3A2L
Bruno, Noemi	R051	3A2L
Caputo, Paolo	R062	Dirigente
Caputo, Roberta	R077	QD3
Caputo, Sergio	R021	Dirigente
Caputo, Tommaso	R078	-
Caruso, Giulia	R070	QD2
Caruso, Martina	R048	QD2
Caruso, Simone	R048	QD2
Caruso, Tommaso	R079	-
Castaldi, Paolo	R051	3A2L
Cattaneo, Benedetta	R069	QD3
Cattaneo, Davide	R050	QD3
Colombo, Alberto	R039	3A3L
Colombo, Filippo	R048	QD2
Colombo, Gabriele	R036	-
Colombo, Maria	R102	QD2
Colombo, Silvia	R048	QD2
Conte, Tatiana	R082	3A3L
Conti, Luca	R066	3A4L
Conti, Marco	R066	3A4L
Conti, Tommaso	R055	3A2L
Conti, Valentina	R090	Dirigente
Costa, Alessio	R064	QD2
Costa, Alice	R086	QD1
Costa, Cristina	R047	QD3
Costa, Filippo	R050	QD3
D'Angelo, Luca	R023	3A1L
Dangelo, Carlo	R099	3A2L
De Rosa, Andrea	R083	-
De Rosa, Federica	R068	Dirigente
De Santis, Claudia	R048	QD2
De Santis, Marco	R014	Dirigente
De Santis, Riccardo	R019	QD2
De Santis, Tommaso	R055	3A2L
Deluca, Umberto	R048	QD2
Donati, Filippo	R049	3A1L
Esposito, Alice	R010	Dirigente
Esposito, Laura	R055	3A2L
Esposito, Matteo	R050	QD3
Esposito, Tommaso	R048	QD2
Fabbri, Daniela	R045	QD3
Fabbri, Giorgio	R048	QD2
Ferrara, Gabriele	R051	3A2L
Ferrara, Paolo	R050	QD3
Ferrari, Laura	R049	3A1L
Ferri, Cristina	R083	-
Ferri, Giuseppe	R081	QD3
Ferri, Luca	R078	-
Ferri, Marco	R053	3A1L
Ferri, Veronica	R051	3A2L
Fiore, Elena	R049	3A1L
Fiore, Gabriele	R051	3A2L
Fiore, Tommaso	R045	QD3
Fontana, Dario	R064	QD2
Fontana, Diego	R020	3A3L
Fontana, Gabriele	R065	3A3L
Gallo, Francesca	R099	3A2L
Gallo, Pietro	R085	QD2
Gallo, Roberta	R049	3A1L
Gallo, Sara	R033	QD4
Gatti, Alessandro	R045	QD3
Gatti, Cristina	R045	QD3
Gatti, Marta	R048	QD2
Gatti, Pietro	R088	3A1L
Gentile, Beatrice	R049	3A1L
Gentile, Emanuele	R034	QD3
Gentile, Martina	R011	QD3
Giordano, Gabriele	R057	3A1L
Giordano, Luca	R044	3A3L
Giuliani, Walter	R012	3A3L
Greco, Andrea	R023	3A1L
Greco, Filippo	R051	3A2L
Greco, Marta	R046	QD3
Greco, Sara	R087	3A3L
Leone, Luca	R043	QD3
Leone, Simone	R049	3A1L
Leone, Xenia	R050	QD3
Lombardi, Cristina	R063	QD3
Lombardi, Federica	R079	-
Lombardi, Matteo	R018	Dirigente
Longo, Yuri	R049	3A1L
Mancini, Giorgio	R080	-
Mancini, Silvia	R049	3A1L
Marchetti, Federica	R001	Dirigente
Marchetti, Giovanni	R051	3A2L
Marchetti, Ilaria	R082	3A3L
Marchetti, Noemi	R050	QD3
Mariani, Daniele	R050	QD3
Mariani, Elisa	R050	QD3
Mariani, Luca	R087	3A3L
Mariani, Paolo	R099	3A2L
Marino, Antonio	R051	3A2L
Martelli, Silvia	R049	3A1L
Martini, Elisa	R079	-
Martini, Riccardo	R022	QD4
Martini, Silvia	R049	3A1L
Martini, Zelda	R051	3A2L
Martino, Andrea	R006	Dirigente
Messina, Alberto	R070	QD2
Monti, Elisa	R045	QD3
Monti, Michele	R049	3A1L
Monti, Stefano	R073	3A4L
Moretti, Alice	R048	QD2
Moretti, Laura	R053	3A1L
Moretti, Valentina	R039	3A3L
Negri, Helena	R008	3A3L
Orlando, Ignazio	R044	3A3L
Pagano, Jessica	R065	3A3L
Pagano, Matteo	R050	QD3
Palmieri, Cristina	R051	3A2L
Parisi, Antonio	R065	3A3L
Pellegrini, Alessandro	R049	3A1L
Pellegrini, Marta	R042	QD3
Ricci, Giorgio	R065	3A3L
Ricci, Martina	R065	3A3L
Rinaldi, Davide	R049	3A1L
Rinaldi, Lorenzo	R051	3A2L
Rinaldi, Stefano	R088	3A1L
Romano, Claudia	R050	QD3
Romano, Cristina	R057	3A1L
Rossi, Alice	R013	3A2L
Rossi, Cristina	R082	3A3L
Rossi, Roberta	R070	QD2
Russo, Beatrice	R095	3A1L
Russo, Martina	R051	3A2L
Russo, Simone	R049	3A1L
Sala, Martina	R098	QD2
Sanna, Pietro	R039	3A3L
Santoro, Gabriele	R045	QD3
Santoro, Laura	R007	QD3
Santoro, Martina	R045	QD3
Santoro, Noemi	R039	3A3L
Serra, Alberto	R045	QD3
Serra, Claudia	R063	QD3
Testa, Nicola	R049	3A1L
Villa, Paolo	R080	-
Zanetti, Chiara	R087	3A3L
\.
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_skill_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, PRIMARY KEY (tabella, chiave));

-- 1) skill della corsa assenti dal catalogo: skill del tenant RTL
CREATE TEMP TABLE nuove ON COMMIT DROP AS
SELECT DISTINCT ON (c.esco_uri) c.esco_uri, c.skill_code, c.nome, c.kind FROM staging.rtl_corsa_skill c
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skills s WHERE s.skill_esco_uri = c.esco_uri);
WITH ins AS (
  INSERT INTO sys.sys_skills (skill_tenant_id, skill_code, skill_name, skill_esco_uri, skill_is_global, skill_kind)
  SELECT '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid, n.skill_code, n.nome, n.esco_uri, false, n.kind FROM nuove n RETURNING skill_id)
INSERT INTO staging.rtl_allinea_skill_undo (tabella, chiave) SELECT 'sys_skills', skill_id FROM ins ON CONFLICT DO NOTHING;

-- 2) persona -> posto RTL attivo
CREATE TEMP TABLE pp ON COMMIT DROP AS
SELECT pc.codice, a.user_position_assignment_position_id AS posto
FROM staging.rtl_persona_corsa pc
JOIN sys.sys_users u ON u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND u.user_last_name || ', ' || u.user_first_name = pc.persona
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY';
DO $$ DECLARE n int; m int; BEGIN
  SELECT count(*) INTO n FROM staging.rtl_persona_corsa; SELECT count(*) INTO m FROM pp;
  IF n<>m THEN RAISE EXCEPTION 'D/skill: % persone abbinate su %', m, n; END IF; END $$;

-- 3) requisiti mancanti
WITH ins AS (
  INSERT INTO sys.sys_position_skill_requirements (position_id, position_skill_requirement_tenant_id, skill_id, required_proficiency, weight, criticality)
  SELECT DISTINCT p.posto, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid, s.skill_id,
         CASE c.livello WHEN 'BASE' THEN 'BASIC' WHEN 'INTERMEDIO' THEN 'COMPETENT' ELSE 'PROFICIENT' END,
         CASE c.criticita WHEN 'ESSENZIALE' THEN 1.0 ELSE 0.5 END,
         CASE c.criticita WHEN 'ESSENZIALE' THEN 'HIGH' ELSE 'MEDIUM' END
  FROM pp p JOIN staging.rtl_corsa_skill c ON c.posto = p.codice
  JOIN sys.sys_skills s ON s.skill_esco_uri = c.esco_uri AND (s.skill_tenant_id IS NULL OR s.skill_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0')
  WHERE NOT EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements r WHERE r.position_id=p.posto AND r.skill_id=s.skill_id)
    -- competenze che una banca non ha: ritirate dal blocco H, D non le riporta (altrimenti H le toglierebbe a ogni corsa)
    AND NOT (s.skill_name IN ('materiali avanzati','regolamentazione della sosta') OR s.skill_name ~* 'produzione alimentare')
  RETURNING position_skill_requirement_id)
INSERT INTO staging.rtl_allinea_skill_undo (tabella, chiave) SELECT 'sys_position_skill_requirements', position_skill_requirement_id FROM ins ON CONFLICT DO NOTHING;
COMMIT;
SELECT 'D/skill ok' esito, (SELECT count(*) FROM staging.rtl_allinea_skill_undo WHERE tabella='sys_position_skill_requirements') requisiti_aggiunti,
       (SELECT count(*) FROM staging.rtl_allinea_skill_undo WHERE tabella='sys_skills') skill_create;
