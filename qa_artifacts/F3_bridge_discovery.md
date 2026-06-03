# F3 Bridge Discovery — job→position wall, per-source overlap (read-only)

> Workflow `wf_0786bb6c-c26` (S960): 4 cluster agents measured the REAL overlap of each legacy source behind the job→position wall against `sys.*`. Read-only (staging temp tables created+dropped). Adds to the already-measured `job_kpis` = 0 overlap (DEAD_END).

## Verdict summary

| Verdict | N | Meaning |
|---|---|---|
| BRIDGEABLE | 3 | required FK resolves (mostly) — importable (a 1:N fan-out design choice may apply) |
| PARTIAL | 5 | only a fraction resolves, or resolves ambiguously (broadcast) — low value / needs decision |
| DEAD_END | 1 | ≈0 overlap — source disjoint from the workforce (like job_kpis) |

## The pattern (decisive)

Sources that key on **an employee** (`employee_career_progress`, `critical_roles.current_incumbent_id`, succession-by-incumbent) or on **a job_title employees actually hold** (`job_title_courses`) BRIDGE via `position_metadata->>legacy_employee_id` / B-51 job_roles. Sources that key on the **ESCO-generic `job_templates` catalog** (`job_kpis`, `position_skill_requirements`) are DEAD_END/near-zero: that catalog is disjoint from the real workforce vocabulary. **Employee-centric bridges work; job-template bridges fail.**

## Per-source measurements

| Legacy source | Target | Rows | Verdict | Overlap | Bridge key |
|---|---|---|---|---|---|
| public.employee_career_progress (employee->path enrollment; the position-resolving source for position_career_paths, since career_path_levels carries no position/employee key) | sys.sys_position_career_paths | 40 | BRIDGEABLE | 40 | position FK: employee_id -> sys.sys_positions via position_metadata->>'legacy_em |
| public.job_title_courses | sys.sys_position_learning_requirements | 207 | BRIDGEABLE | 207 | position_id via: job_title_courses.job_title -> lower() match to sys_job_roles.j |
| public.talent_pool_members | sys.sys_successor_candidates | 40 | BRIDGEABLE | 40 | 'LEGACY_EMP::'\|\|employee_id (employee -> sys_user) |
| public.career_path_levels | sys.sys_career_path_steps | 75 | PARTIAL | 35 | LEGACY_CP::<career_paths.id> on sys.sys_career_paths.career_path_code (path FK;  |
| public.critical_roles | sys.sys_critical_positions | 16 | PARTIAL | 8 | position_metadata->>'legacy_employee_id' (employee -> sys_position instance) |
| public.position_skill_requirements | sys.sys_position_skill_requirements | 1632 | PARTIAL | 45 | job_templates.title_en (or title_it) -> match against sys_positions.position_met |
| public.succession_candidates | sys.sys_successor_candidates | 206 | PARTIAL | 120 | 'LEGACY_EMP::'\|\|candidate_employee_id (employee -> sys_user) |
| public.succession_plans | sys.sys_position_succession_relevance | 31 | PARTIAL | 9 | position_metadata->>'legacy_employee_id' (incumbent employee -> sys_position ins |
| public.talent_pools | sys.sys_succession_pools | 24 | DEAD_END | 0 |  |

## Detail

### public.employee_career_progress (employee->path enrollment; the position-resolving source for position_career_paths, since career_path_levels carries no position/employee key) → sys.sys_position_career_paths — **BRIDGEABLE** (40/40)
- **keys_on:** employee_id (FK -> employees_core.id) for the position FK + path_id (FK -> career_paths.id) for the career_path FK; 40 distinct (employee_id, path_id) pairs
- **bridge_key:** position FK: employee_id -> sys.sys_positions via position_metadata->>'legacy_employee_id'; path FK: LEGACY_CP::<path_id> on sys.sys_career_paths.career_path_code
- **rationale:** Measured in-DB (staged employee_career_progress + career_paths metadata, joined to sys.sys_positions and sys.sys_career_paths). All 40 distinct employee->path pairs resolve BOTH required FKs: employee->sys_position via legacy_employee_id (40/40; all 162 sys_positions carry legacy_employee_id) AND path->sys_career_paths via LEGACY_CP:: (40/40). Yields 40 buildable position x path rows across 40 distinct positions and 5 distinct paths. The alternative career_paths.created_by_employee_id bridge resolves only 7/32 and is the wrong key; employee_career_progress is the correct 100%-resolving source. career_path_levels itself has no position/employee key, so it cannot source position_career_paths directly -- the bridge is the per-person enrollment table.

### public.job_title_courses → sys.sys_position_learning_requirements — **BRIDGEABLE** (207/207)
- **keys_on:** job_title (free-text varchar(100), 21 distinct values) + course_id (FK -> courses.id, 38 distinct); single tenant. NOT a job/template FK.
- **bridge_key:** position_id via: job_title_courses.job_title -> lower() match to sys_job_roles.job_role_name (B-51 RTL roles derived from employees.job_title) -> sys_positions.position_job_role_id -> position instances (1:N fan-out). learning_path_id via: job_title_courses.course_id -> legacy courses.code -> sys_learning_paths.learning_path_code (and learning_path_name).
- **rationale:** Both required target FKs resolve at 100%. position_id: all 21 distinct job_titles match (case-insensitive) an RTL sys_job_role that owns >=1 sys_positions instance -> 207/207 source rows resolve a position; this crosses the job->position-instance 'wall' because the courses target job_titles that employees actually hold (the same population that seeded the B-51 job_roles), unlike job_kpis which keyed on disjoint job_templates. learning_path_id: all 38 distinct legacy course codes/titles match sys_learning_paths.learning_path_code AND learning_path_name -> 207/207 resolve. End-to-end: 207/207 source rows resolve BOTH FKs. Target table currently empty (0 rows) so this is net-new ingestible data. CAVEAT: the job->position bridge is 1:N (job_title is a role label, not an instance key), so naive expansion produces 1791 (position,learning_path) target pairs from 207 source rows -- an ingestion fan-out design decision, not a resolution gap. NOTE: correctly does NOT use sys_user/LEGACY_EMP:: crosswalk since target is position-scoped not person-scoped. Verified S960 read-only via staging temp tables (since dropped): psql advanced 5433 + ssh oracle-vm-default legacy heuresys_platform.

### public.talent_pool_members → sys.sys_successor_candidates — **BRIDGEABLE** (40/40)
- **keys_on:** employee_id (legacy employees.id, FK to employees_core which is 1:1 with employees) + talent_pool_id -> talent_pools(id)
- **bridge_key:** 'LEGACY_EMP::'||employee_id (employee -> sys_user)
- **rationale:** The employee bridge is clean and complete: all 40/40 talent_pool_members.employee_id are non-null, FK-validated to employees_core (= employees, 270 rows, 1:1), and 40/40 (100%) resolve to a sys_user via LEGACY_EMP::. This is the strongest source in the cluster on the person key (every member lands in the RTL subset). CAVEAT: if these are migrated into sys_successor_candidates, the membership's pool (talent_pool_id -> talent_pools) inherits the talent_pools DEAD_END problem (no position anchor for succession_pool_position_id) — so the USER FK is fully bridgeable but the destination pool may need a synthetic/criteria-based pool rather than a position-anchored one. On the measured required-key overlap (employee -> sys_user) it is 100% -> BRIDGEABLE.

### public.career_path_levels → sys.sys_career_path_steps — **PARTIAL** (35/75)
- **keys_on:** path_id (FK -> public.career_paths.id) + level_order (step ordinal); step origin/target position would need target_job_id which is NULL on 100% of rows
- **bridge_key:** LEGACY_CP::<career_paths.id> on sys.sys_career_paths.career_path_code (path FK; sys_career_path_steps.career_path_step_path_id resolves via this)
- **rationale:** Measured in-DB (staged career_path_levels, joined to sys.sys_career_paths). Of 75 legacy levels, 35 (46.7%) have a path_id resolving to an imported LEGACY_CP:: path, covering 7 of the 15 distinct paths-that-have-levels. The other 40 levels reference paths NOT imported (only 28 of 32 legacy career_paths were imported, and the with-levels subset is largely disjoint from the imported subset). The path FK (career_path_step_path_id, the structurally-required FK) is PARTIAL. The optional position FKs (origin/target_position_id) are a DEAD_END: all 75 levels have target_job_id IS NULL, so no job->position resolution at the step level. Verified: levels_total=75, levels_path_resolves_to_sys_cp=35, distinct_paths_resolving=7/15, levels_with_target_job_id_nonnull=0.

### public.critical_roles → sys.sys_critical_positions — **PARTIAL** (8/16)
- **keys_on:** current_incumbent_id (legacy employees.id, employee-centric) + free-text role_name/department (generic exec titles: CEO/CFO/VP Sales/etc., NOT instance keys)
- **bridge_key:** position_metadata->>'legacy_employee_id' (employee -> sys_position instance)
- **rationale:** sys_critical_positions requires a position_id (NOT NULL FK -> sys_positions). critical_roles has no position FK; the only instance bridge is current_incumbent_id -> legacy employees.id, which resolves to a sys_positions instance via position_metadata.legacy_employee_id. Measured: 15/16 incumbents non-null, of which 8 resolve to a sys_position in the RTL_BANK tenant (8/16 = 50%; 1 row null incumbent, 7 incumbents are employees outside the rebuilt RTL subset). The role_name free-text (generic C-suite titles) does NOT map to sys_job_roles B-51 codes (derived job_role_code namespace, no clean title match) and is irrelevant anyway since the target keys on position instance. Half resolve -> PARTIAL.

### public.position_skill_requirements → sys.sys_position_skill_requirements — **PARTIAL** (45/1632)
- **keys_on:** position_id FK -> job_templates(id) (a JOB-TEMPLATE catalog entry, NOT a position instance; the FK name 'position_id' is a false friend). The other identity cols (position_name, esco_skill_id/custom_skill_name) are template-level. No employee key, no instance key.
- **bridge_key:** job_templates.title_en (or title_it) -> match against sys_positions.position_metadata->>'legacy_position_text' (== sys_job_roles.job_role_name via position_job_role_id). There is NO UUID/FK path: legacy employees.position_id and employees.job_title are FREE TEXT, never join to job_templates.id; no brownfield.column_mappings row exists for position_skill_requirements. Title-match is the only candidate bridge.
- **rationale:** Source keys on job_templates (JOB level), target sys_position_skill_requirements is INSTANCE level and currently EMPTY (0 rows). Only 374 of 1632 rows belong to RTL Bank tenant (0c54b84a), the sole tenant whose 270 employees produced the 162 sys_positions; the other 1258 rows are SmartFood/Heuresys/EcoNova templates with no sys_positions at all. Within RTL, the 17 job_templates carrying skills are all PROTO-* prototype catalog entries with ESCO bilingual occupation titles ('bank teller','credit analyst','investment adviser','loan officer','credit manager'...). Measured via staged cross-DB join (staging.tmp_f3_psr, 374 rows): only 2 of 17 titles ('bank manager','bank teller') match any sys_position.legacy_position_text; the remaining 15 ESCO titles score EXACTLY ZERO (disjoint from the workforce vocabulary, same failure mode as job_kpis). Best-case overlap = 45/374 = 12% (well below the ~70% BRIDGEABLE bar). Worse, the 45 are NOT clean resolutions: each matching title fans out to 22 distinct sys_positions (44 positions total), so one template's skill set would be BROADCAST identically across 22 instances rather than FK-resolved 1:1 -- a template-level guess, not instance resolution. Not a true 0 like job_kpis (hence PARTIAL not DEAD_END), but effectively unusable for instance-level import: 88% of rows unresolvable and the resolvable 12% are ambiguous broadcasts. Cleanup: staging.tmp_f3_psr dropped (read-only honored).

### public.succession_candidates → sys.sys_successor_candidates — **PARTIAL** (120/206)
- **keys_on:** candidate_employee_id (legacy employees.id, required for the sys_user FK) + critical_role_id -> succession_plans(id) for the pool/position context
- **bridge_key:** 'LEGACY_EMP::'||candidate_employee_id (employee -> sys_user)
- **rationale:** sys_successor_candidates has TWO required FKs: successor_candidate_user_id (-> sys_users, NOT NULL) and successor_candidate_pool_id (-> sys_succession_pools, NOT NULL). The candidate bridge is strong: all 206 candidate_employee_id are non-null and resolve to legacy employees; 120/206 (58%) resolve to a sys_user via LEGACY_EMP:: (the 86 misses are candidates outside the rebuilt RTL_BANK subset). BUT the pool side is the binding constraint and it collapses: the parent succession_plans.position_id is 100% NULL, so a pool can only be anchored via the parent plan's incumbent -> position, which resolves for only 24/206 candidates; the strict full chain (candidate->user AND parent->position both resolve) is just 22/206. So ~58% of candidates can resolve their user FK but only ~11% can also land in a position-anchored pool. Some resolve, most do not at full fidelity -> PARTIAL (user-side bridgeable, pool-side largely dead).

### public.succession_plans → sys.sys_position_succession_relevance — **PARTIAL** (9/31)
- **keys_on:** incumbent_employee_id (legacy employees.id) + position_id (UUID column but 100% NULL) + free-text position_name
- **bridge_key:** position_metadata->>'legacy_employee_id' (incumbent employee -> sys_position instance)
- **rationale:** sys_position_succession_relevance requires a position_id (NOT NULL FK -> sys_positions). succession_plans.position_id is NULL for all 31 rows (verified count(position_id)=0), so the native position FK is dead; the only bridge is incumbent_employee_id -> legacy employees.id -> sys_position via position_metadata.legacy_employee_id. Measured: only 10/31 rows have a non-null incumbent, of which 9 resolve to a sys_position (9/31 = 29%; the remaining 21 plans have no incumbent and no position key at all, so they are structurally unresolvable). Minority resolve, and even those depend on the incumbent-as-position-proxy bridge rather than a true position key -> PARTIAL (leaning weak).

### public.talent_pools → sys.sys_succession_pools — **DEAD_END** (0/24)
- **keys_on:** no entity FK at all — only name, pool_type (8 types x3), and an abstract criteria jsonb (min_tenure_months, min_performance, readiness_level, etc.); no employee_id, no position_id, no role reference
- **bridge_key:** (none)
- **rationale:** sys_succession_pools requires succession_pool_position_id (NOT NULL FK -> sys_positions). talent_pools carries ZERO position/employee/role key: it is a pure pool DEFINITION (name + pool_type + jsonb selection criteria). There is no column and no jsonb field that references a legacy employee.id or position, so nothing can resolve the mandatory position FK. The conceptual mismatch is structural: legacy talent_pools are criteria-defined cohorts (high_potential/leadership/critical/...), not position-anchored succession pools. 0/24 resolvable -> DEAD_END, same shape as job_kpis (no overlapping key to bridge on).

