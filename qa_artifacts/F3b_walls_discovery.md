# F3 Bridge Discovery — job→position wall, per-source overlap (read-only)

> Workflow `wf_0786bb6c-c26` (S960): 4 cluster agents measured the REAL overlap of each legacy source behind the job→position wall against `sys.*`. Read-only (staging temp tables created+dropped). Adds to the already-measured `job_kpis` = 0 overlap (DEAD_END).

## Verdict summary

| Verdict | N | Meaning |
|---|---|---|
| BRIDGEABLE | 0 | required FK resolves (mostly) — importable (a 1:N fan-out design choice may apply) |
| PARTIAL | 1 | only a fraction resolves, or resolves ambiguously (broadcast) — low value / needs decision |
| DEAD_END | 4 | ≈0 overlap — source disjoint from the workforce (like job_kpis) |

## The pattern (decisive)

Sources that key on **an employee** (`employee_career_progress`, `critical_roles.current_incumbent_id`, succession-by-incumbent) or on **a job_title employees actually hold** (`job_title_courses`) BRIDGE via `position_metadata->>legacy_employee_id` / B-51 job_roles. Sources that key on the **ESCO-generic `job_templates` catalog** (`job_kpis`, `position_skill_requirements`) are DEAD_END/near-zero: that catalog is disjoint from the real workforce vocabulary. **Employee-centric bridges work; job-template bridges fail.**

## Per-source measurements

| Legacy source | Target | Rows | Verdict | Overlap | Bridge key |
|---|---|---|---|---|---|
| public.course_enrollments + public.learning_path_enrollments | sys.sys_user_learning_assignments | 3393 | PARTIAL | 1998 | assignment user_id via LEGACY_EMP:: + assignment path_id via learning_path_code  |
| public.course_enrollments (completed/passed subset) | sys.sys_user_learning_evidence | 2657 | DEAD_END | 0 | evidence user_id via LEGACY_EMP:: + evidence module_id via learning_module_code  |
| public.course_esco_skills | sys.sys_skill_learning_mappings | 717 | DEAD_END | 0 | mapping skill_id via skill_esco_uri (resolves 635/717=88.6%) + mapping module_id |
| public.learning_path_courses | sys.sys_learning_path_steps | 124 | DEAD_END | 0 | step path_id via learning_path_code=PATH-* (resolves 124/124) + step module_id v |
| public.org_unit_kpis | sys.sys_organization_unit_kpi_templates | 100 | DEAD_END | 1 | org_unit_templates.code <-> sys_organization_units.organization_unit_code (only  |

## Detail

### public.course_enrollments + public.learning_path_enrollments → sys.sys_user_learning_assignments — **PARTIAL** (1998/3393)
- **keys_on:** employee_id -> sys_users.user_external_code='LEGACY_EMP::'||id (I14 employee-centric) AND course_id->courses.code / learning_path_id->learning_paths.code
- **bridge_key:** assignment user_id via LEGACY_EMP:: + assignment path_id via learning_path_code (catalog landed in sys_learning_paths; CHECK allows path_id OR module_id OR initiative_id)
- **rationale:** Staged both enrollment sources. course_enrollments (3052): employee->sys_user resolves 1798/3052 (159/269 distinct employees via LEGACY_EMP::); course->sys_learning_path resolves 3052/3052 (100%, catalog is there); full bridge via the path_id leg = 1798/3052. learning_path_enrollments (341): employee resolves 200/341 (125/213 distinct employees); path->sys_learning_path 341/341 (100%); full = 200/341. Combined 1998/3393 = 58.9%. This target survives ONLY because sys_user_learning_assignments has an OR-CHECK accepting path_id (FK to sys_learning_paths) where the catalog actually lives — the dead module_id leg is sidestepped. The ~59% cap is NOT a structural wall: the catalog/path leg is 100%; the entire loss is the employee->user import ceiling (160/270 legacy employees materialized as sys_users, I14/ADR-0024). Above the ~70% threshold it would be BRIDGEABLE; at 58.9% it is PARTIAL, fully recoverable by widening employee coverage.

### public.course_enrollments (completed/passed subset) → sys.sys_user_learning_evidence — **DEAD_END** (0/2657)
- **keys_on:** employee_id -> sys_users.user_external_code='LEGACY_EMP::'||id AND course_id -> courses.code (CRS-*)
- **bridge_key:** evidence user_id via LEGACY_EMP:: + evidence module_id via learning_module_code (NOT NULL, NO path fallback)
- **rationale:** Of 3052 course_enrollments, 2657 are completion evidence (2400 status=completed plus passed=true / completed_at non-null). sys_user_learning_evidence.module_id is a NOT NULL FK to sys_learning_modules with NO path_id column (unlike assignments, evidence has no OR-CHECK fallback to a path). The completed-enrollment course->module bridge resolves 0/2657 because the catalog course exists only as a sys_learning_path, never a sys_learning_module. For contrast, the same query with a hypothetical path-as-module fallback would yield 1633 (= completed AND employee-resolved AND course->path), but the schema forbids it: evidence is strictly module-anchored. Employee leg would cap it at ~59% like T3, but the module wall drives it to 0 regardless. Full evidence bridge 0/2657.

### public.course_esco_skills → sys.sys_skill_learning_mappings — **DEAD_END** (0/717)
- **keys_on:** course_esco_skills.esco_skill_uri -> sys_skills.skill_esco_uri AND course_id -> courses.code (CRS-*)
- **bridge_key:** mapping skill_id via skill_esco_uri (resolves 635/717=88.6%) + mapping module_id via learning_module_code=course CRS-* code
- **rationale:** Staged all 717 course_esco_skills rows with resolved course code + esco_skill_uri. The SKILL leg is strong: 635/717 (88.6%) esco_skill_uri values match a sys_skills.skill_esco_uri (sys_skills has 14011 non-null esco URIs). But sys_skill_learning_mappings.module_id is a NOT NULL FK to sys_learning_modules and 0/717 course CRS-* codes resolve as a sys_learning_module (all 717 resolve in sys_learning_paths instead). Full bridge (skill resolves AND course-as-module resolves) = 0/717. Tested an alternate non-code bridge through legacy course_modules (course_modules.id matches 564/845 advanced OLDDB::course_modules:: modules via course_modules.course_id): this yields 300/717 esco rows but is semantically wrong — it fans a single catalog course out to its N sub-module surrogate rows (only 60/127 courses covered) rather than the intended course=module identity, so it does not constitute a clean course->skill catalog mapping. The course-as-module catalog identity simply does not exist.

### public.learning_path_courses → sys.sys_learning_path_steps — **DEAD_END** (0/124)
- **keys_on:** learning_path_courses.learning_path_id -> learning_paths.code (PATH-*) AND course_id -> courses.code (CRS-*)
- **bridge_key:** step path_id via learning_path_code=PATH-* (resolves 124/124) + step module_id via learning_module_code=course CRS-* code
- **rationale:** Staged all 124 learning_path_courses with both resolved codes and joined. The path leg is perfect: 124/124 PATH-* codes resolve in sys_learning_paths. But sys_learning_path_steps.module_id is a NOT NULL FK to sys_learning_modules, and 0/124 course CRS-* codes resolve as a sys_learning_module: sys_learning_modules (7300 rows) is 100% operational-event-derived (4166 OLDDB::module_completions, 1625 learning_recommendations, 845 course_modules, 568 learning_ratings, 71 bookmarks, 24 content_providers, +1 stray) with ZERO catalog codes. The legacy course CATALOG was imported into sys_learning_paths instead (all 127 courses.code + all 20 learning_paths.code resolve there, confirming the F3 207/207 match was code-vs-sys_learning_paths, not modules). A step is path->course containment, but in the advanced model both legacy course and legacy path are sibling rows in sys_learning_paths, so there is no path->module step edge to build. Full step bridge 0/124.

### public.org_unit_kpis → sys.sys_organization_unit_kpi_templates — **DEAD_END** (1/100)
- **keys_on:** org_unit_kpis.org_unit_template_id -> org_unit_templates(id) [225 design-layer rows, only 25 distinct codes]; the target needs organization_unit_kpi_template_unit_id -> sys.sys_organization_units (26 instances) + kpi_id -> sys.sys_kpi_definitions (resolves, KPI catalog unified)
- **bridge_key:** org_unit_templates.code <-> sys_organization_units.organization_unit_code (only candidate; the advanced instances bridge to legacy ONLY via metadata->>'legacy_org_unit_id' -> legacy org_units.id, an INSTANCE, not a template)
- **rationale:** The template->instance wall holds firm; measured exactly. The 100 legacy org_unit_kpis FK on org_unit_template_id -> org_unit_templates (DESIGN layer: 225 rows but only 25 distinct codes -> ~9x replicated catalog; 91 distinct template rows / 24 distinct codes actually carry KPIs). The advanced target's unit FK must resolve to one of the 26 sys_organization_units INSTANCES. Measured every candidate bridge: (1) sys_organization_units carry metadata->>'legacy_org_unit_id' pointing to legacy org_units (INSTANCES, 76 rows), NOT to org_unit_templates -- confirmed: 0 of 100 KPIs have org_unit_template_id pointing into the org_units instance UUID space. (2) Legacy org_units has NO template_id/source_unit_id/design_id column (information_schema returned none); its only design-ish FK candidate, legacy_department_id (74 non-null), matches org_unit_templates.id 0/74 times -- no instance->template chain exists. (3) tenant_org_units.source_unit_id (the per-tenant instance layer) matches org_unit_templates.id 0/47 -- that chain is also dead. (4) Code-based bridge: the 24 distinct KPI-bearing template codes (CEO, DEPT-AFC-1, DIR-CORP...) intersect the 26 advanced instance codes (DIR-AML, DIV-CFO, FIL-MI-CEN, RTL...) in EXACTLY 1 code = DIR-CORP. The two namespaces are otherwise fully disjoint (generic org-design codes vs RTL-bank-domain codes). Even DIR-CORP is ambiguous: it maps to 4 distinct template rows (9x catalog replication => many-to-many, no clean instance pick) carrying only 4 of the 100 KPIs (4%). overlap_count=1 (codes); KPI-attach ceiling = 4/100 = 4%, ambiguously. Far below the ~70% BRIDGEABLE threshold and below any reasonable PARTIAL bar. kpi_id resolves and tenant_id is derivable, but the unit_id (template->instance) FK is unbridgeable -- the org_unit_kpi_templates target cannot be populated from the legacy design-layer KPIs.

