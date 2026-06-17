# FINDINGS/ — registro finding per workstream

> Una pagina per WS (`WS-<x>.md`), popolata nella relativa sessione di audit (S-100X-A?). Template + classificazione in `../AUDIT_PROTOCOL.md`. Il seed di recon trasversale (S-100X-0) è in `S-100X-0_recon.md`.

| File | WS | Sessione | Stato | Headline |
|---|---|---|---|---|
| `S-100X-0_recon.md` | A..K (recon trasversale) | S-100X-0 | seed ✅ | recon trasversale (seed dei finding per-WS) |
| `WS-A.md` | Architettura | A6 | **done ✅** (S-100X-A6) | monorepo 5 workspace (agent-gateway fuori CI); 78 subpath-export dead surface; 0 dep circolari; 0 moduli orfani (75/75 registrati) |
| `WS-B.md` | Backend/servizi | A5 | **done ✅** (S-100X-A5) | 🔴 B-1 `POST /v1/notifications` N+1 illimitato admin-pilotato; B-2 list-endpoint senza LIMIT; B-3 boilerplate 75× (~28k LOC); tenant-IDOR pulito |
| `WS-C.md` | Dati & persistenza | A4 | **done ✅** (S-100X-A4) | 🟠 C-1 243/494 FK senza indice (56 tenant_id); C-2 auth-audit illimitata (refresh_tokens 46k righe/9 utenti); Backup/DR maturo; dead-schema ZERO |
| `WS-D.md` | Frontend | A7 | **done ✅** (S-100X-A7) | 🟠 D-1 code-split chart incoerente (8/12 pagine importano EChartsCard eager dal barrel, bypassano il wrapper ssr:false) |
| `WS-E.md` | Design system / UX-IX | A8 | **done ✅** (S-100X-A8) | UX-IX strutturalmente sano: 0 raw-hex UI, i18n parity perfetta, 0 onClick non-semantici, a11y gate serious=0 shipped; 3 leve MEDIUM/LOW |
| `WS-F.md` | Test & QA | A3 | **done ✅** (S-100X-A3) | 🟠 F-1 la CI non gira mai la full E2E suite (solo smoke-5-personas gating; ~46 spec non-gating) |
| `WS-G.md` | CI/CD & deploy | A1 | **done ✅** (S987 — 30 finding, 1 CRITICAL) | 🔴 repo pubblico + runner self-hosted su host PROD + pull_request trigger → fork-PR esegue codice attacker su box prod (eleva D-08 a priorità-sicurezza) |
| `WS-H.md` | Sicurezza & supply chain | A2 | **done ✅** (S988) | 🔴 H-1 `TRUST_PROXY=false` di default dietro nginx collassa il rate-limit per-IP in un bucket unico (verificare/forzare TRUST_PROXY=true nel .env VM) |
| `WS-I.md` | Documentazione | A11 | **done ✅** (S-100X-A11) | 🟠 I-1 README milestone-snapshot congelato a v1.0.0/S957, drift su ~tutti i conteggi headline (60→75 moduli, 55→130 migr, ecc.) — il README non è handoff-governed |
| `WS-J.md` | Config & env | A9 | **done ✅** (S-100X-A9) | 🟢 contratto env ALLINEATO post-S993 (env.ts ↔ .env.example parità reale, WS-G F-29/R09 chiuso) |
| `WS-K.md` | Repo hygiene & footprint | A10 | **done ✅** (S-100X-A10) | 🟠 K-1 footprint rigenerabile 24G→29G `.next` in 3gg, quasi tutto `apps/web/.next/dev/cache` (28G, dev-mode E2E) mai potato |
| `WS-L_*` | Ecosistema Claude (in `../`) | A-L | TODO | — |
