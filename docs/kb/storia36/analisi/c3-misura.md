# C3 — misura (inline, 2026-07-28; gli agenti sono morti per limite sessione ×2)

## Shape (verificate a DB)
- `sys_reward_gate_catalog` (7, tutti blocking, blueprint-linked): COMPLIANCE_GATE, RISK_GATE, CONDUCT_GATE, AUDIT_FINDING_GATE, CERTIFICATION_GATE, CUSTOMER_HARM_GATE, TRAINING_GATE.
- `sys_reward_gates` (VUOTA): istanza per (user|position, catalog, period_start/end) + payload jsonb.
- `sys_payout_curves` (VUOTA): code/name/kind CHECK {LINEAR,CAPPED,STEPPED,SIGMOID} + payload jsonb + is_global.
- `sys_reward_gate_results` (VUOTA): per gate → status CHECK {PASSED,WARNING,BLOCKED,ESCALATED,OVERRIDDEN_WITH_REASON}, score numeric, evaluator_user_id, override_reason, payload, recorded_at.
- `sys_payroll_handoff_records` (VUOTA): per periodo → recipient_system, payload jsonb, handed_off_at, status CHECK {PENDING,SENT,ACKNOWLEDGED,REJECTED}.
- `sys_variable_pay_calculations` (121 righe / **68 utenti distinti**): FY2024 in **3 forme di periodo** (annuale 47, Q4 46, giu-nov 28 — premi multipli coesistono), 27 coppie utente+periodo DUPLICATE esatte (rumore import, dedupe in fixups X2), 34 righe amount NULL (mai quantificate), payload.legacy da `bonus_allocations`.
- `sys_position_compensation_profiles` (172): position→band, economic_weight, reward_gates_applied `[]`.
- RAL: `sys_user_contracts.user_contract_gross_annual_salary` — medie per livello: 3A1L 36,4k · 3A2L 39,0k · 3A3L 49,5k · 3A4L 62,5k · QD3 74,6k · QD4 91,5k · Quadro 94,6k · Dirigente 146,5k (76,7k..212k).
- Buste esistenti: gross ≈ RAL/13 (avg 4.568 vs 4.742 ✓; max 16.325 = Dirigente 212k/13 ✓). Deductions FLAT su ogni fascia: **INPS = 9,19% gross · IRPEF = 18,81% gross · net = 72,00% gross** (misurato su 624 righe 2026) — formula da replicare identica (indistinguibilità); la non-progressività IRPEF è convenzione legacy, registrata.
- Floors CCNL (S1025, `db/seeds/rtl-banking-skills/seed_ccnl_floors.sql`): QD4 67.081 · QD3 57.159 · QD2 51.551 · QD1 48.662 · 3A4L 43.445 · 3A3L 39.773 · 3A2L 37.575 · 3A1L 35.650 · AU 32.233 (Dirigente fuori CCNL Credito aree).
- Generatore `db/scripts/gen-pay-slips-seed.sql`: import-only dal legacy (`employee_pay_stubs`), NON riusabile per il backfill sintetico — il C3 genera dalle RAL contrattuali con la formula flat misurata.

## Buchi che C3 riempie
- Buste: esistono SOLO 2026-04/05/06 ×156 + 1 utente 2025-09..11 + 2026-07 ×156 (C1). Backfill: ogni (utente RTL attivo, mese) da GREATEST(hire, 2023-08) a 2026-07 senza busta → ~4.800 righe. Copre anche i 2 utenti C3S (alberto.colombo, alice.esposito).
- Adeguamenti CCNL (rinnovo 23/11/2023, fonte pmi.it/ccnlbancari nel DOMINIO): tranches mensili +250 dal 2023-12, +100 dal 2024-09, +50 dal 2025-06, +35 dal 2026-03 (figura media 3A4L) → RAL storica = RAL odierna − 13×(tranches future al mese m)×param(level), param = floor(level)/floor(3A4L); Dirigente param 0 (CCNL dirigenti separato).
- Tredicesima: gross di dicembre ×2 (13 mensilità CCNL Credito — i mesi legacy 2026 restano flat: convenzione import, registrata).
- VAP nel cedolino: FY2023 → busta 2024-06 (+amount), FY2024 (legacy 121) → busta 2025-06; FY2025 → busta 2026-06 LEGACY flat = **deviazione dichiarata** (busta esistente non modificabile).
- Gates: 7 catalogo × utenti attivi (hire ≤ fine FY) × FY2023/24/25 + results 1:1; chi ha variable-pay FY2024 → 2024 tutto PASSED (coerenza); altrove ~96% PASSED / 2,5% WARNING / 1% BLOCKED / 0,5% OVERRIDDEN; evaluator = andrea.martino (compliance); recorded gen-feb FY+1 workday.
- Curve: MBO_STANDARD CAPPED {threshold 0.8, floor 0.5, target 1.0, cap 1.5} (convenzione RTL dichiarata — DOMINIO §4), VAP_LINEAR, EXEC_SIGMOID.
- variable_pay FY2023/FY2025: platea = i 68 percettori FY2024 con review ANNUAL e attainment >=0,8 (-5% hash + uscite causali da gate); amount = RAL(FY) × target%(level: Dir .15, QD .12, 3A4L .08, 3A3L .07, altri .05) × payout(curva, attainment da rating C2 ancorati) — cap 30% RAL (DOMINIO §2); zero per chi ha gate BLOCKED.

## Check C3a-e
C3a handoff 36/36 mesi · C3b busta per ogni (utente, mese dalla hire) · C3c gross×13 ≥ floor staged alla data (stesso modello tranches, Dirigente escluso) · C3d variable⇒gates tutti PASSED quell'FY + amount ≤ 30% RAL + amount = curva(attainment) ±1€ · C3e VAP FY2023/24 visibile nella busta di giugno N+1 (FY2025 = deviazione dichiarata). Selftest per ciascuno.
