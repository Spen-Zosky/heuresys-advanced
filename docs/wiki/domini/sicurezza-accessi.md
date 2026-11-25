---
dominio: sicurezza-accessi
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Autenticazione separata, perimetro gerarchico e modalità funzionale, maschere e mandati
fonti: [.claude/rules/security-auth.md, apps/api/src/lib/scope/mask.ts, docs/architecture/adr/0036_hierarchical_and_functional_domains.md]
concetti: [perimetro, mandato, maschera, autenticazione]
---

# Sicurezza e accessi

## Com'è oggi

- L'autenticazione è separata da `sys.sys_users`, nelle tabelle `sys.sys_auth_*` (I7); password Argon2id (ADR-0005), JWT breve con refresh ruotato in cookie HttpOnly e CSRF (ADR-0006). Regole in [security-auth](../../../.claude/rules/security-auth.md).
- L'accesso è l'intersezione di perimetro gerarchico e modalità funzionale `edit/read/mask/none` (ADR-0036, I16-I22); l'isolamento dei tenant è nel middleware, mai RLS (I5).
- I mandati HR (`TENANT_ADMIN`, `HRMS_MANAGER`) vedono tutto il tenant salvo le eccezioni di ADR-0036 §5; `PLATFORM_ADMIN` è tecnico e vede `COMPENSATION` ed `EVALUATION` mascherate (ADR-0032, `apps/api/src/lib/scope/mask.ts`); `DPO` ha il perimetro tenant-wide mascherato.
- Il modello dei ruoli: il comando si calcola, il funzionale si decide (ADR-0057); la piattaforma concede ruoli dentro un cliente solo con un motivo scritto (ADR-0055); la forza dell'identificazione segue il mandato (ADR-0050).

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0005](../../architecture/adr/0005_password_hashing_argon2id.md) | Password Hashing: Argon2id | Accepted |
| [0006](../../architecture/adr/0006_auth_strategy_jwt_plus_httponly_cookie.md) | Auth Strategy: Short JWT + Rotated Refresh + HttpOnly Cookie + CSRF | Accepted |
| [0021](../../architecture/adr/0021_ssh_tunnel_automation_and_service_key.md) | SSH tunnel automation via restricted service-account key (B-31 / CW-B62 closure) | ACCEPTED |
| [0027](../../architecture/adr/0027_two_axis_contextual_authorization.md) | Two-axis contextual authorization: the organizational chain gates sensitive personal data, the functional chain gates activities | SUPERSEDED by ADR-0036 |
| [0032](../../architecture/adr/0032_platform_mandate_masks_pay_and_evaluation.md) | The platform mandate stops opening pay and evaluation: `mask` becomes a real state | ACCEPTED |
| [0036](../../architecture/adr/0036_hierarchical_and_functional_domains.md) | Hierarchical and functional domains: the perimeter and the modality are orthogonal | ACCEPTED * |
| [0037](../../architecture/adr/0037_user_deletion_is_anonymization.md) | Cancellare una persona significa anonimizzarla; la cancellazione fisica è la revoca di una creazione | Accepted |
| [0050](../../architecture/adr/0050_identificazione_legata_al_mandato.md) | La forza dell'identificazione segue il mandato funzionale | ACCETTATO il 2026-11-03 da Enzo Spenuso |
| [0055](../../architecture/adr/0055_la_piattaforma_concede_ruoli_nel_cliente_con_un_motivo.md) | La piattaforma concede ruoli dentro un cliente solo con un motivo scritto | ACCETTATO il 2026-11-06 da Enzo Spenuso, alle 01:22 UTC |
| [0057](../../architecture/adr/0057_il_modello_dei_ruoli.md) | Il modello dei ruoli: il comando si calcola, il funzionale si decide | ACCETTATO il 2026-11-10 da Enzo Spenuso, alle 15:16 UTC |
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| perimetri dell'agente | `python docs/kb/tools/check_concetti_agente.py` |

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **5** documenti di questo dominio (lotti: ACC-1 1, B 4). Si recuperano con `git show <commit>:<percorso>` dai commit a1872a180, dbd339511, oppure dalla copia nel cestino della cartella del progetto; l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `docs/superpowers/specs` 3, `docs/superpowers/plans` 2.
<!-- /generato -->

## Vedi anche

[agenti-ia](agenti-ia.md), [api-backend](api-backend.md).
