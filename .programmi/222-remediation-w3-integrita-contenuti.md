# #222 — Remediation forense W3 · Integrità e contenuti (F1/F6/F2 non gated)

**Capofila del programma**: `.programmi/220-remediation-dossier-forense.md` — fonte, metodo vincolante, fuori-perimetro. Effort: ~150-250k token, multi-sessione. Ogni rilievo si ri-misura alla presa in carico (#149); le query stanno in `D:\heuresys-datastore\docs\00_preface\07_QUERY_DI_MISURA.md`.

| id | rilievi | cosa | stato |
|---|---|---|---|
| W3.1 | F1-04 | indice UNIQUE su `skill_esco_uri` (14.003=14.003 misurato al 2026-08-19; guardia al momento) | da fare |
| W3.2 | F1-06 | 3 FK senza indice (`occupation_class_mapping_target_id`, `blueprint_family_activity_classes.classification_id` oltre il parziale, `sys_skills.created_by/updated_by`) | da fare |
| W3.3 | F1-07 | traduzioni: CHECK su `entity_table` (insieme chiuso) + sentinella orfani | da fare |
| W3.4 | F1-03, F2-05 | normalizzazione formato `skill_group_uri` nei metadati (13.178 righe, undo journal) | da fare |
| W3.5 | F6-01 | traduzioni EN/DE ATECO già in `activity_classification_metadata` → travaso in `sys_reference_translations` + registrazione in `sys_translatable_field` (costo acquisizione zero) | da fare |
| W3.6 | F6-03 | 70 URI ESCO contraffatti → namespace `CUSTOM::` (misurare prima chi li referenzia) | da fare |
| W3.7 | F6-02 | 103 canonici in inglese con traduzioni-copia | da fare |
| W3.8 | F6-04 | 5 codici settore ATECO 2007 → 2025 in `sys_industry_codes` | da fare |
| W3.9 | F6-07 | ricollegare 286 competenze dagli archi tassonomici; curare le 84 isolate | da fare |
| W3.10 | F6-09 | 4 ridondanze vere (pattern `mappa_competenze_rimosse.csv`) | da fare |
| W3.11 | F2-01 | consolidamento canale ruolo↔occupazione (64 FK + 111 metadata, 0 sovrapposti, 176 ruoli) | da fare |
| W3.12 | F6-10, F1-05, F1-08, F1-09 | pulizie basse: tipografia, colonne morte, indici mai usati (ri-misurare `idx_scan`), tipi incoerenti | da fare |
