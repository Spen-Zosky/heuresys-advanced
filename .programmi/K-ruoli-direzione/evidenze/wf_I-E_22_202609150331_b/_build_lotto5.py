import json

righe = []

def add(tabella, api, imp, origine, righe_n, prov, stato, dubbia, motivo):
    righe.append({
        "tabella": tabella,
        "scrittori_api": api,
        "scrittori_import": imp,
        "colonna_origine": origine,
        "righe": righe_n,
        "righe_con_provenienza": prov,
        "stato_proposto": stato,
        "dubbia": dubbia,
        "motivo": motivo,
    })

add("sys_ui_interface_data_classes", [], [
    "db/migrations/000394_la_voce_progetti_dichiara_la_sua_classe.sql:16",
    "db/migrations/000366_le_risposte_di_clima_sono_un_dato_della_persona.sql:33",
    "db/migrations/000326_le_otto_famiglie_di_cruscotto_hanno_una_pagina.sql:111",
    "db/migrations/000317_organigramma_rubrica_aziendale.sql:72",
    "db/migrations/000315_classi_di_dato_delle_voci_di_menu.sql:54",
], "assente", 43, 0, "infrastruttura", False,
   "solo migrazioni scrivono questo registro di configurazione UI (quali classi di dato espone ogni voce di menu); nessuna rotta CRUD applicativa, nessun writer di importazione dati-cliente; non e' dato business del cliente")

add("sys_ui_interfaces", [], [
    "db/migrations/000050_sys_ui_interfaces_registry.sql:51",
    "db/migrations/000163_sidebar_five_sections_taxonomy.sql:78 (UPDATE)",
    "db/migrations/000271_dashboard_interface_declares_its_permission.sql:46 (UPDATE)",
    "db/migrations/000306_nessuna_pagina_irraggiungibile.sql:62",
    "altre ~35 migrazioni, una per voce di menu introdotta (rg --no-ignore --hidden -c \"insert into sys\\.sys_ui_interfaces\" db/migrations = 41 file)",
], "assente", 85, 0, "infrastruttura", False,
   "registro delle voci di menu/interfaccia, scritto solo da migrazioni (una per feature che nasce); nessuna rotta API di scrittura; non e' dato business del cliente")

add("sys_user_addresses", [], [
    "db/seeds/rtl-rebuild/14_user_anagraphic_satellites.generated.sql:833 (+279 righe simili, INSERT...ON CONFLICT DO UPDATE)",
    "db/seeds/rtl-banking-skills/seed_residual_user_coherence.sql:358 (UPDATE)",
    "db/scripts/gen-anagraphic-seed.sql:57 (template INSERT)",
], "assente", 171, 0, "importato", False,
   "nessuna rotta di scrittura in apps/api/src (solo SELECT in me/repository.ts:229); tutte le 171 righe generate dal seed anagrafico rtl-rebuild/gen-anagraphic-seed")

add("sys_user_assessment_evidence", [], [
    "db/seeds/rtl-rebuild/12_user_satellites.sql:141 (INSERT)",
    "db/seeds/storia36/12_registration_dates.sql:205 (UPDATE date-shift)",
], "assente", 1560, 0, "importato", False,
   "solo SELECT in apps/api/src (evidence/repository.ts:35); scritta solo da seed rtl-rebuild e dal meccanismo di avanzamento storia36")

add("sys_user_auth_roles", [
    "apps/api/src/modules/users/repository.ts:394 (INSERT grant ruolo)",
    "apps/api/src/modules/users/repository.ts:412 (UPDATE revoke ruolo)",
], [
    "db/scripts/seed-service-user.ts:178",
    "db/scripts/provision-collaudo-access.ts:214",
    "db/seeds/rtl-rebuild/13_teams_from_org.sql:58,74",
    "db/seeds/rtl-rebuild/08_rbac_role_grants.sql:29",
    "db/migrations/000295_platform_admin_is_the_owner.sql:65",
    "db/migrations/000272_branch_manager_role_and_dashboard.sql:70",
    "db/migrations/000259_command_roles_for_unit_managers.sql:73",
    "db/migrations/000205_whistleblowing_custodian_and_console.sql:20",
    "db/migrations/000155_grant_user_role_to_functional_employees.sql:25",
    "db/migrations/000150_org_director_grant_valentina.sql:19",
    "db/migrations/000111_import_chiara_spenuso_heuresys.sql:44",
    "db/migrations/000049_r2_assign_holderless_functional_roles.sql:23",
], "assente", 399, 0, "ibrido", True,
   "regola meccanica: scrittore API (grant/revoke ruoli in users/repository.ts) E scrittori di importazione (script di provisioning, seed onboarding, migrazioni di grant) coesistono")

add("sys_user_bank_details", [], [
    "db/seeds/rtl-rebuild/14_user_anagraphic_satellites.generated.sql:1113 (+263 righe simili)",
    "db/scripts/gen-anagraphic-seed.sql:70",
], "assente", 156, 0, "importato", False,
   "nessuna rotta di scrittura (solo SELECT in me/repository.ts:249); generata dal seed anagrafico")

add("sys_user_career_plans", [
    "apps/api/src/modules/user-career-plans/repository.ts:161 (INSERT)",
    "apps/api/src/modules/user-career-plans/repository.ts:207 (UPDATE)",
    "apps/api/src/modules/user-career-plans/repository.ts:216 (DELETE)",
], [
    "db/seeds/reconciliation/06_user_career_plans.sql:22",
], "assente", 113, 0, "ibrido", True,
   "regola meccanica: CRUD nativo completo E scrittore di importazione (seed di riconciliazione) coesistono")

add("sys_user_certifications", [
    "apps/api/src/modules/me/repository.ts:1773 (INSERT self-service)",
], [
    "db/seeds/storia36/repair/2026-07-28_c4_rui_sezione_d_oneshot.sql:54",
    "db/seeds/storia36/repair/2026-07-28_c4_certs_monotonia_oneshot.sql:57",
    "db/seeds/storia36/13_avanzamento.sql:647",
    "db/seeds/storia36/04_learning.sql:429",
    "db/seeds/storia36/04b_safety.sql:117",
    "db/scripts/verify-storia36.sql:5185",
    "db/seeds/rtl-rebuild/06_skills_certs.sql:108",
    "db/seeds/rtl-banking-skills/seed_comp_dates.sql:319",
    "db/migrations/000292_emergency_team_coverage_per_branch.sql:86",
    "db/migrations/000291_preposti_safety_training_for_new_supervisors.sql:61",
], "assente", 1062, 0, "ibrido", True,
   "regola meccanica: scrittore API (aggiunta certificazione self-service) E numerosi scrittori di importazione (seed storia36, rtl-rebuild, migrazioni) coesistono")

add("sys_user_consents", [
    "apps/api/src/modules/gdpr/repository.ts:345 (INSERT)",
], [
    "db/seeds/storia36/10_security_privacy.sql:91",
    "db/scripts/verify-storia36.sql:6878 (UPDATE date-shift)",
    "db/migrations/000372_chi_ha_un_account_ha_espresso_le_sue_scelte.sql:72",
], "consent_source (valori misurati: ADMIN=8, ESS=9, IMPORT=632 -- select consent_source, count(*) from sys.sys_user_consents group by 1)",
   649, 0, "ibrido", True,
   "regola meccanica: scrittore API (consenso GDPR via ESS/ADMIN) E scrittori di importazione coesistono; confermato dalla colonna consent_source, 632/649 righe sono IMPORT")

add("sys_user_contracts", [], [
    "db/seeds/rtl-rebuild/15_user_contracts.generated.sql:4 (+267 righe simili)",
    "db/seeds/rtl-banking-skills/seed_user_role_coherence.sql:42",
    "db/seeds/rtl-banking-skills/seed_residual_user_coherence.sql:566",
    "db/seeds/rtl-banking-skills/seed_key_roles_coverage.sql:150",
    "db/seeds/rtl-banking-skills/seed_comp_dates.sql:224",
    "db/seeds/rtl-banking-skills/seed_ccnl_floors.sql:38",
    "db/seeds/storia36/00_repair_g4_contracts.sql:27",
    "db/scripts/verify-storia36.sql:4819",
    "db/scripts/gen-contracts-seed.sql:20",
    "db/migrations/000376_le_due_sentinelle_dei_contratti_a_termine.sql:109",
    "db/migrations/000375_nessun_contratto_a_termine_a_chi_ha_piu_di_dodici_mesi.sql:82",
    "db/migrations/000371_il_rinnovo_dei_contratti_smette_di_essere_una_fotografia.sql:115",
    "db/migrations/000311_nessuno_lavora_con_un_contratto_scaduto.sql:73",
    "db/migrations/000307_due_direzioni_di_vertice_a_dirigente.sql:136",
    "db/migrations/000289_contracts_in_force_and_ccnl_floor.sql:78",
    "db/migrations/000264_ten_unit_managers_to_qd3_and_mg2.sql:122",
    "db/migrations/000188_f2_db_hygiene.sql:78",
], "assente", 160, 0, "importato", True, "D6")

add("sys_user_delegations", [
    "apps/api/src/modules/delegations/repository.ts:132 (INSERT)",
    "apps/api/src/modules/delegations/repository.ts:160 (UPDATE revoca)",
], [], "assente", 0, 0, "nativo", False,
   "unico scrittore e' l'API (modulo delegations, mig 000314); nessuno scrittore di importazione trovato in db/ ne' in docs/archive; 0 righe oggi")

add("sys_user_demographics", [], [
    "db/seeds/rtl-rebuild/14_user_anagraphic_satellites.generated.sql:3,4 (+righe simili)",
    "db/scripts/gen-anagraphic-seed.sql:30",
    "db/seeds/rtl-banking-skills/seed_user_role_coherence.sql:72",
    "db/seeds/rtl-banking-skills/seed_comp_dates.sql:202,213",
], "assente", 160, 0, "importato", False,
   "nessuna rotta di scrittura (solo SELECT in me/repository.ts:220); generata dal seed anagrafico")

add("sys_user_documents", [], [
    "db/seeds/reconciliation/07_user_documents.sql:23",
], "assente", 657, 0, "importato", False,
   "nessuna rotta di scrittura (solo SELECT in me/repository.ts:1832); unico scrittore e' il seed di riconciliazione")

add("sys_user_education_records", [], [
    "db/seeds/rtl-rebuild/12_user_satellites.sql:83",
    "db/seeds/storia36/repair/2026-07-28_c5_education_durata_oneshot.sql:35,53",
    "db/seeds/storia36/12_registration_dates.sql:442,493",
    "db/seeds/rtl-banking-skills/seed_residual_user_coherence.sql:147,190",
    "db/scripts/verify-storia36.sql:5535",
], "assente", 160, 0, "importato", False,
   "nessuna rotta di scrittura (solo SELECT in me/repository.ts:244); scritta da seed rtl-rebuild e meccanismo storia36")

add("sys_user_employment", [], [
    "db/seeds/rtl-rebuild/14_user_anagraphic_satellites.generated.sql:1377,1378",
    "db/scripts/gen-anagraphic-seed.sql:77",
    "db/seeds/rtl-banking-skills/seed_user_role_coherence.sql:78,183",
    "db/seeds/rtl-banking-skills/seed_residual_user_coherence.sql:577",
    "db/seeds/rtl-banking-skills/seed_comp_dates.sql:177,193",
    "db/migrations/000307_due_direzioni_di_vertice_a_dirigente.sql:141,166",
    "db/migrations/000264_ten_unit_managers_to_qd3_and_mg2.sql:190,200",
    "db/migrations/000188_f2_db_hygiene.sql:74",
], "assente", 160, 0, "importato", False,
   "nessuna rotta di scrittura (solo SELECT in me/repository.ts:269); scritta da seed anagrafico e da migrazioni di riorganizzazione")

add("sys_user_family_members", [], [
    "db/seeds/rtl-rebuild/14_user_anagraphic_satellites.generated.sql:1648,1649",
    "db/scripts/gen-anagraphic-seed.sql:89",
    "db/seeds/rtl-banking-skills/seed_residual_user_coherence.sql:369,377",
], "assente", 150, 0, "importato", False,
   "nessuna rotta di scrittura (solo SELECT in me/repository.ts:236); generata dal seed anagrafico")

add("sys_user_identity_documents", [], [
    "db/scripts/gen-anagraphic-seed.sql:41,46",
    "db/seeds/rtl-rebuild/14_user_anagraphic_satellites.generated.sql:273,274",
    "db/seeds/rtl-banking-skills/seed_residual_user_coherence.sql:415,426",
], "assente", 332, 0, "importato", True, "D6")

add("sys_user_kpi_evidence", [], [
    "apps/api/src/modules/tenant-materialization/repository.ts:454 (INSERT, materializzazione onboarding tenant)",
    "db/seeds/reconciliation/19_user_kpi_evidence.sql:5",
    "db/seeds/storia36/12_registration_dates.sql:125 (UPDATE)",
], "assente", 248, 0, "importato", False,
   "nessuna rotta CRUD utente (solo SELECT/JOIN in insights, capability-maturity, me); unico scrittore in codice e' l'effetto di materializzazione onboarding tenant, oltre a seed/riconciliazione")

add("sys_user_learning_assignments", [
    "apps/api/src/modules/me/repository.ts:1200 (INSERT, iscrizione self-service)",
], [
    "db/seeds/storia36/04_learning.sql:300",
    "db/seeds/reconciliation/15_user_learning_assignments.sql:16",
], "assente", 3061, 0, "ibrido", True,
   "regola meccanica: scrittore API (iscrizione self-service a un percorso) E scrittori di importazione (seed storia36, riconciliazione) coesistono")

add("sys_user_learning_evidence", [], [
    "db/seeds/storia36/04_learning.sql:274,399",
    "db/seeds/rtl-rebuild/12_user_satellites.sql:113",
    "db/seeds/reconciliation/38_user_learning_evidence.sql:48",
    "db/scripts/verify-storia36.sql:5206,5332 (UPDATE)",
], "assente", 3882, 0, "importato", False,
   "nessuna rotta di scrittura (solo SELECT in evidence/repository.ts:63); scritta da seed storia36/rtl-rebuild/riconciliazione")

add("sys_user_pay_slips", [], [
    "db/seeds/storia36/03_compensation.sql:240",
    "db/seeds/storia36/01_attendance_timeoff.sql:525",
    "db/seeds/storia36/repair/2026-07-28_c3_slips_floor_oneshot.sql:19",
    "db/seeds/storia36/repair/2026-07-28_c3_fixups_oneshot.sql:65,100",
    "db/seeds/storia36/13_avanzamento.sql:757",
    "db/seeds/rtl-rebuild/16_user_pay_slips.generated.sql:3,4",
    "db/seeds/rtl-banking-skills/seed_comp_dates.sql:291",
    "db/scripts/verify-storia36.sql:5086,5140",
    "db/scripts/gen-pay-slips-seed.sql:22",
    "db/migrations/000362_un_contratto_attivo_deve_avere_una_busta_paga_recente.sql:175",
    "db/migrations/000296_sentinelle_segreti_e_paghe.sql:197",
    "db/migrations/000290_variable_pay_at_current_level_and_paid_in_june.sql:104,142",
    "db/migrations/000289_contracts_in_force_and_ccnl_floor.sql:104,150",
], "assente", 5818, 0, "importato", True, "D6")

add("sys_user_position_assignments", [], [
    "apps/api/src/modules/approvals/effects/tenant-import-run.ts:161 (UPDATE), 206 (INSERT)",
    "apps/api/src/modules/tenant-materialization/repository.ts:379 (INSERT)",
    "db/seeds/storia36/05_career.sql:513,533",
    "db/seeds/rtl-rebuild/04_assignments.sql:25",
    "db/seeds/rtl-banking-skills/seed_user_role_coherence.sql:104,142",
    "db/seeds/rtl-banking-skills/seed_residual_user_coherence.sql:527,540",
    "db/seeds/rtl-banking-skills/seed_key_roles_coverage.sql:101,112,123",
    "db/scripts/seed-reference-bank.ts:374",
    "db/migrations/000251_organization_closure_and_gates.sql:75,88",
    "db/migrations/000250_positions_central_staff.sql:152,165",
    "db/migrations/000249_positions_network_staff.sql:140,154",
    "db/migrations/000248_positions_command_roles.sql:110,126",
    "db/migrations/000204_key_roles_reactivation_integrity.sql:29",
    "db/migrations/000188_f2_db_hygiene.sql:97",
], "assente", 329, 0, "importato", False,
   "nessuna rotta CRUD nativa trovata (il gesto assegnazione persona-posizione non e' ancora costruito: e' G-1, fase F6 del mandato); gli unici scrittori in apps/api/src sono effetti di importazione/materializzazione (tenant-import-run.ts, tenant-materialization/repository.ts), non rotte utente")

add("sys_user_preferences", [
    "apps/api/src/modules/me/repository.ts:1881 (INSERT/UPSERT self-service tema/lingua)",
], [], "assente", 6, 0, "nativo", False,
   "unico scrittore e' l'API self-service (preferenze tema/palette/lingua); nessun writer di importazione trovato")

add("sys_user_professional_experiences", [], [
    "db/seeds/storia36/05_career.sql:102",
    "db/seeds/storia36/repair/2026-07-28_c5_coda_rilievi_oneshot.sql:302",
    "db/scripts/verify-storia36.sql:5463,5563,5585,5602,5956,5978,5994",
], "assente", 255, 0, "importato", False,
   "nessuna rotta di scrittura (solo SELECT in me/repository.ts:2017); scritta da seed storia36 e dal meccanismo di avanzamento")

add("sys_user_profile_embeddings", [
    "apps/api/src/modules/semantic-matching/repository.ts:140 (INSERT, chiamato da backfill.ts::runBackfill, esposto via POST /reindex con permesso matching:admin)",
], [], "assente", 156, 0, "nativo", False,
   "unico scrittore e' la rotta POST /reindex (matching:admin) che ricalcola gli embedding dalle evidenze di competenza; nessun writer di importazione dati-cliente trovato: e' un derivato calcolato dalla piattaforma, non un dato dal gestionale esterno")

add("sys_user_profiles", [
    "apps/api/src/modules/me/repository.ts:164 (INSERT/UPSERT self-service bio/contatti)",
], [
    "db/seeds/rtl-rebuild/12_user_satellites.sql:61",
], "assente", 157, 0, "ibrido", True,
   "regola meccanica: scrittore API (self-service bio/contatti) E scrittore di importazione (seed rtl-rebuild) coesistono")

add("sys_user_skill_evidence", [
    "apps/api/src/modules/me/repository.ts:837 (INSERT self/manager assessment)",
], [
    "apps/api/src/modules/tenant-materialization/repository.ts:437 (INSERT, source='MANAGER_ASSESSMENT', materializzazione onboarding)",
    "db/seeds/rtl-rebuild/06_skills_certs.sql:84",
    "db/seeds/storia36/12_registration_dates.sql:406 (UPDATE)",
    "db/migrations/000351_una_competenza_e_una_sola_anche_fra_globale_e_tenant.sql:194",
    "db/migrations/000196_restore_skill_natural_key_uq.sql:109",
    "db/migrations/000189_dedup_skill_names.sql:120",
], "user_skill_evidence_source (valori misurati: MANAGER_ASSESSMENT=312, SELF_ASSESSMENT=590 -- select user_skill_evidence_source, count(*) from sys.sys_user_skill_evidence group by 1)",
   902, 0, "ibrido", True,
   "regola meccanica: scrittore API (autovalutazione/valutazione manager via me/repository.ts) E scrittore di importazione/materializzazione (onboarding tenant, seed) coesistono")

add("sys_user_skills", [], [
    "apps/api/src/modules/approvals/effects/tenant-import-run.ts:219 (INSERT, effetto di importazione approvata)",
    "db/scripts/import-d1-user-skills.sh:102",
    "db/seeds/rtl-banking-skills/seed_banking_skills.sql:315",
    "db/seeds/storia36/12_registration_dates.sql:417 (UPDATE)",
    "db/migrations/000351_una_competenza_e_una_sola_anche_fra_globale_e_tenant.sql:149",
    "db/migrations/000196_restore_skill_natural_key_uq.sql:85",
    "db/migrations/000189_dedup_skill_names.sql:96",
], "user_skill_source (valori: MANAGER_OVERRIDE=814, SELF_DECLARATION=537 -- select user_skill_source, count(*) from sys.sys_user_skills group by 1; ma SELF_DECLARATION non compare mai come letterale scritto da codice applicativo: e' il DEFAULT di colonna, non un valore scelto attivamente da una rotta)",
   1351, 0, "importato", False,
   "nessuna rotta CRUD nativa trovata nel codice applicativo (l'unico scrittore in apps/api/src e' l'effetto di importazione tenant-import-run.ts); il resto sono script/seed di importazione")

add("sys_user_target_positions", [
    "apps/api/src/modules/user-target-positions/repository.ts:151 (INSERT)",
    "apps/api/src/modules/user-target-positions/repository.ts:194 (UPDATE)",
    "apps/api/src/modules/user-target-positions/repository.ts:215 (UPDATE review)",
    "apps/api/src/modules/user-target-positions/repository.ts:230 (DELETE)",
    "apps/api/src/modules/me/repository.ts:1330 (INSERT self-service)",
], [
    "db/seeds/storia36/05_career.sql:213",
    "db/scripts/verify-storia36.sql:5497,5659",
    "db/migrations/000277_realign_career_paths_and_targets.sql:160,242,295",
], "assente", 255, 0, "ibrido", True,
   "regola meccanica: CRUD nativo completo (modulo dedicato + self-service) E scrittori di importazione (seed storia36, migrazione di riallineamento) coesistono")

add("sys_user_timeline_events", [], [
    "docs/archive/etl-brownfield-ritirato/scripts/import-d5-timeline.sh:92 (RITIRATO, #170)",
], "user_timeline_event_source_table / user_timeline_event_source_id (riferimento polimorfico all'entita' di origine dell'evento, non e' una colonna di provenienza dati nel senso di I23)",
   2682, 0, "importato", False,
   "il repository stesso lo dichiara in testa (apps/api/src/modules/user-timeline/repository.ts:2-4): 'Sola lettura: la tabella si popola dall'import (...import-d5-timeline.sh, ritirato #170), mai dall'API'; nessuna rotta scrive oggi, l'unico scrittore mai esistito e' l'import ritirato")

add("sys_users", [
    "apps/api/src/modules/users/repository.ts:163 (INSERT)",
    "apps/api/src/modules/users/repository.ts:220,235 (UPDATE)",
    "apps/api/src/modules/me/repository.ts:160 (UPDATE self-service)",
    "apps/api/src/modules/gdpr/repository.ts:250 (UPDATE, cancellazione/anonimizzazione)",
], [
    "apps/api/src/modules/approvals/effects/tenant-import-run.ts:169 (UPDATE deactivate), 197 (INSERT)",
    "apps/api/src/modules/tenant-materialization/repository.ts:347 (INSERT)",
    "db/seeds/rtl-banking-skills/seed_user_role_coherence.sql:132",
    "db/scripts/verify-storia36.sql:6414",
    "db/scripts/seed-service-user.ts:106",
    "db/scripts/seed-reference-bank.ts:348",
    "db/scripts/provision-collaudo-access.ts:199",
    "db/migrations/000356_un_account_di_servizio_non_e_una_persona_senza_posizione.sql:170",
    "db/migrations/000287_user_census_158_plus_3.sql:50",
    "db/migrations/000285_platform_admin_false_legacy_origin.sql:44",
    "db/migrations/000284_mfa_exemption_explicit_allowlist.sql:115",
    "db/migrations/000218_person_display_name_placeholder.sql:15",
    "db/migrations/000204_key_roles_reactivation_integrity.sql:24",
    "db/migrations/000154_retire_synthetic_user_flag.sql:27",
    "db/migrations/000111_import_chiara_spenuso_heuresys.sql:21",
    "db/migrations/000046_rekey_external_code_employee_centric.sql:33",
], "assente (user_external_code e' chiave di raccordo per il crosswalk legacy, non colonna di provenienza dati)",
   164, 162, "ibrido", True,
   "regola meccanica: scrittori API (creazione/modifica utente da admin, self-service, GDPR) E scrittori di importazione/materializzazione (onboarding tenant, seed, migrazioni) coesistono; unica tabella del lotto con provenienza nel registro (162/164 -- select replace(source_lineage_target_table_name,'sys.','') t, count(*) from sys.sys_source_lineage_records where t='sys_users')")

add("sys_valutazione_condivisione_eccezioni", [], [
    "db/migrations/000396_le_valutazioni_non_condivise_hanno_un_registro_di_eccezione.sql:45 (INSERT di backfill nella migrazione che crea il registro)",
], "assente", 568, 0, "importato", False,
   "nessuna rotta di scrittura applicativa trovata (solo SELECT in performance-reviews/repository.ts:19,22,97); le 568 righe sono il backfill fatto dalla migrazione 000396 che ha creato il registro delle eccezioni ADR-0036 (valutazioni non comunicate); nessuno scrittore ricorrente da allora")

add("sys_variable_pay_calculations", [], [
    "db/seeds/storia36/12_registration_dates.sql:170 (UPDATE)",
    "db/seeds/storia36/03_compensation.sql:184",
    "db/seeds/reconciliation/24_variable_pay_calculations.sql:5",
    "db/scripts/verify-storia36.sql:5105",
    "db/migrations/000290_variable_pay_at_current_level_and_paid_in_june.sql:80,138",
], "assente", 182, 0, "importato", False,
   "nessuna rotta di scrittura (solo SELECT in compensation/repository.ts:562,570,1003); scritta da seed storia36/riconciliazione e dalla migrazione di allineamento")

add("sys_visualization_edges", [
    "apps/api/src/modules/visualization-edges/repository.ts:69 (INSERT)",
    "apps/api/src/modules/visualization-graphs/repository.ts:256 (INSERT bulk)",
], [
    "db/seeds/org_chart_rtl_demo.sql:55",
], "edge_source_node_id (riferimento al nodo sorgente dell'arco nel grafo, non e' provenienza dati)",
   314, 0, "ibrido", True,
   "regola meccanica: modulo CRUD nativo dedicato E seed demo organigramma coesistono")

add("sys_visualization_exports", [
    "apps/api/src/modules/visualization-exports/repository.ts:70 (INSERT)",
], [
    "db/seeds/storia36/11_platform_config.sql:151",
    "db/migrations/000373_un_export_di_visualizzazione_non_deve_poter_contenere_persone.sql:136,144,149,156,161,168 (UPDATE, redazione persone)",
], "assente", 16, 0, "ibrido", True,
   "regola meccanica: modulo CRUD nativo E seed/migrazione di redazione coesistono")

add("sys_visualization_graphs", [
    "apps/api/src/modules/visualization-graphs/repository.ts:136 (INSERT)",
    "apps/api/src/modules/visualization-graphs/repository.ts:161 (UPDATE)",
    "apps/api/src/modules/visualization-graphs/repository.ts:205 (INSERT)",
], [
    "db/seeds/org_chart_rtl_demo.sql:36",
], "graph_source_query (la query usata per generare il grafo, non e' provenienza dati)",
   2, 0, "ibrido", True,
   "regola meccanica: CRUD nativo E seed demo organigramma coesistono")

add("sys_visualization_layouts", [
    "apps/api/src/modules/visualization-layouts/repository.ts:60 (INSERT)",
    "apps/api/src/modules/visualization-layouts/repository.ts:80 (UPDATE)",
    "apps/api/src/modules/visualization-graphs/repository.ts:291 (INSERT)",
], [
    "db/seeds/storia36/11_platform_config.sql:97",
], "assente", 2, 0, "ibrido", True,
   "regola meccanica: CRUD nativo E seed di configurazione piattaforma coesistono")

add("sys_visualization_node_layouts", [
    "apps/api/src/modules/visualization-node-layouts/repository.ts:93 (INSERT)",
    "apps/api/src/modules/visualization-graphs/repository.ts:304 (INSERT bulk)",
], [
    "db/seeds/storia36/11_platform_config.sql:109",
], "assente", 316, 0, "ibrido", True,
   "regola meccanica: CRUD nativo E seed di configurazione piattaforma coesistono")

add("sys_visualization_nodes", [
    "apps/api/src/modules/visualization-nodes/repository.ts:63 (INSERT)",
    "apps/api/src/modules/visualization-nodes/repository.ts:86 (UPDATE)",
    "apps/api/src/modules/visualization-graphs/repository.ts:244 (INSERT bulk)",
], [
    "db/seeds/storia36/11_platform_config.sql:78 (UPDATE)",
    "db/seeds/org_chart_rtl_demo.sql:48",
    "db/migrations/000373_un_export_di_visualizzazione_non_deve_poter_contenere_persone.sql:173",
    "db/scripts/verify-storia36.sql:7029 (UPDATE)",
], "node_source_entity_id / node_source_entity_type (l'entita' di business che il nodo rappresenta, non e' provenienza dati)",
   316, 0, "ibrido", True,
   "regola meccanica: CRUD nativo E seed/migrazione coesistono")

add("sys_visualization_styles", [
    "apps/api/src/modules/visualization-styles/repository.ts:56 (INSERT)",
    "apps/api/src/modules/visualization-graphs/repository.ts:335 (INSERT)",
], [
    "db/seeds/storia36/11_platform_config.sql:138",
    "db/migrations/000276_backfill_graph_version_styles.sql:35",
], "assente", 6, 0, "ibrido", True,
   "regola meccanica: CRUD nativo E seed/migrazione di backfill coesistono")

add("sys_whistleblowing_reports", [
    "apps/api/src/modules/whistleblowing/repository.ts:48 (INSERT, invio segnalazione)",
    "apps/api/src/modules/whistleblowing/repository.ts:117 (UPDATE, custode)",
], [
    "db/seeds/storia36/10_security_privacy.sql:162",
    "db/scripts/verify-storia36.sql:6930,6948",
], "assente", 2, 0, "ibrido", True,
   "regola meccanica: scrittore API (invio segnalazione whistleblowing) E scrittore di importazione (seed storia36) coesistono")

conteggi = {
    "sys_ui_interface_data_classes": 43, "sys_ui_interfaces": 85, "sys_user_addresses": 171,
    "sys_user_assessment_evidence": 1560, "sys_user_auth_roles": 399, "sys_user_bank_details": 156,
    "sys_user_career_plans": 113, "sys_user_certifications": 1062, "sys_user_consents": 649,
    "sys_user_contracts": 160, "sys_user_delegations": 0, "sys_user_demographics": 160,
    "sys_user_documents": 657, "sys_user_education_records": 160, "sys_user_employment": 160,
    "sys_user_family_members": 150, "sys_user_identity_documents": 332, "sys_user_kpi_evidence": 248,
    "sys_user_learning_assignments": 3061, "sys_user_learning_evidence": 3882, "sys_user_pay_slips": 5818,
    "sys_user_position_assignments": 329, "sys_user_preferences": 6, "sys_user_professional_experiences": 255,
    "sys_user_profile_embeddings": 156, "sys_user_profiles": 157, "sys_user_skill_evidence": 902,
    "sys_user_skills": 1351, "sys_user_target_positions": 255, "sys_user_timeline_events": 2682,
    "sys_users": 164, "sys_valutazione_condivisione_eccezioni": 568, "sys_variable_pay_calculations": 182,
    "sys_visualization_edges": 314, "sys_visualization_exports": 16, "sys_visualization_graphs": 2,
    "sys_visualization_layouts": 2, "sys_visualization_node_layouts": 316, "sys_visualization_nodes": 316,
    "sys_visualization_styles": 6, "sys_whistleblowing_reports": 2,
}

lotto_ordine = ["sys_ui_interface_data_classes","sys_ui_interfaces","sys_user_addresses","sys_user_assessment_evidence","sys_user_auth_roles","sys_user_bank_details","sys_user_career_plans","sys_user_certifications","sys_user_consents","sys_user_contracts","sys_user_delegations","sys_user_demographics","sys_user_documents","sys_user_education_records","sys_user_employment","sys_user_family_members","sys_user_identity_documents","sys_user_kpi_evidence","sys_user_learning_assignments","sys_user_learning_evidence","sys_user_pay_slips","sys_user_position_assignments","sys_user_preferences","sys_user_professional_experiences","sys_user_profile_embeddings","sys_user_profiles","sys_user_skill_evidence","sys_user_skills","sys_user_target_positions","sys_user_timeline_events","sys_users","sys_valutazione_condivisione_eccezioni","sys_variable_pay_calculations","sys_visualization_edges","sys_visualization_exports","sys_visualization_graphs","sys_visualization_layouts","sys_visualization_node_layouts","sys_visualization_nodes","sys_visualization_styles","sys_whistleblowing_reports"]

assert len(lotto_ordine) == 41, len(lotto_ordine)
assert set(lotto_ordine) == set(r["tabella"] for r in righe), set(lotto_ordine) ^ set(r["tabella"] for r in righe)
assert len(righe) == 41, len(righe)

comandi = [{"tabella": t, "comando": "select count(*) from sys." + t, "numero": conteggi[t]} for t in lotto_ordine]

by_tab = {r["tabella"]: r for r in righe}
righe_ordinate = [by_tab[t] for t in lotto_ordine]

out = {"righe": righe_ordinate, "comandi": comandi}
with open(r"D:\heuresys-advanced\.programmi\K-ruoli-direzione\evidenze\wf_I-E_22_202609150331_b\lotto_5_lettore.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print("OK", len(righe_ordinate), "righe scritte")
