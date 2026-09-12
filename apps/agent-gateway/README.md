# @heuresys/agent-gateway — #9 WI-B (Agent SDK + MCP backend)

Backend that makes the `human-resources-plus` plugin callable from the heuresys
webapps via the Claude Agent SDK, exposing the platform `/v1/*` endpoints as MCP
tools with **hybrid auth + CSRF** and a **human-in-the-loop write gate**.

Design: `docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md` (§ WI-B) +
the read-only Cowork design in the plugin repo (`docs/MCP_TOOL_CATALOG.md`,
`docs/AUTH_AND_COMPLIANCE_DESIGN.md`).

## Layout
- `src/write-gate.ts` — pure gate logic: `isWriteTool()` + `makeCanUseTool()`
  (reads auto-allow; writes → human approval; **deny-by-default on timeout/error**, M-2).
- `src/heuresys-client.ts` — `/v1` client: hybrid session (forwarded user cookie /
  service-user session), **CSRF double-submit on writes**, single-flight refresh (M-5).
- `src/mcp-tools.ts` — MCP tool catalogue over `/v1` (real permission codes; reads
  auto, writes gated; `job-families` + `blueprint-*` use the service principal).
- `src/sdk-agent.ts` — `query()` wiring (loads the plugin, attaches the MCP server,
  enforces the write gate via `canUseTool`). SDK symbols pinned to the installed
  `@anthropic-ai/claude-agent-sdk` version.

## Status — distinto per implementato / configurato / esercitato / distribuito (D-91 ④, 2026-09-12)

Lo stadio «mock-first slice, 2026-06-15» che stava qui era superato da mesi: `src/` porta il
regime intero. I quattro verbi qui sotto sono misurabili, e accanto a ciascuno c'e' il comando.

- **Implementato** — 12 sorgenti in `src/` (`ls src`): il server HTTP (`server.ts`), il cancello
  di scrittura (`write-gate.ts`), il ponte di approvazione (`approval-bridge.ts`), gli strumenti
  MCP con il risolutore dell'atlante (`mcp-tools.ts`, `atlas-resolver.ts`, `mcp-tool-names.ts`),
  il client verso `/v1` (`heuresys-client.ts`), il diario senza PII (`audit-sink.ts`,
  `redact.ts`), l'autenticazione ad abbonamento (`subscription-auth.ts`) e il **fornitore di
  proposte** della ricerca (`research-propose.ts`, #132 F4h — due fasi: indirizzi, proposte;
  dal 2026-09-12 la fase indirizzi riceve il perimetro delle fonti ammesse). 8 file di test
  (`ls test`): `pnpm test`.
- **Configurato** — nessun segreto nei file: `AGENT_GATEWAY_SUBSCRIPTION_AUTH=1` usa il `claude`
  autenticato della macchina (#9, abbonamento MAX); `AGENT_GATEWAY_RESEARCH_TOKEN` e' la parola
  d'ordine condivisa con l'API (`RESEARCH_GATEWAY_TOKEN`), che sul gemello vive in
  `~/.research-token` (600) e passa solo nell'ambiente dei due processi — `scripts/avvia-ricerca.sh`.
  Con `ANTHROPIC_API_KEY` presente nell'ambiente l'SDK la preferirebbe: i lanci la tolgono
  (`env -u ANTHROPIC_API_KEY`).
- **Esercitato** — si': le prove live dei perimetri dell'agente con login reale e secondo fattore
  (`apps/api/scripts/live-perimetro.ts <concetto>`, #214, 13 perimetri aperti a oggi) e le corse
  di ricerca vere (#132 F7 sul gemello: 15 + 34 proposte; S1096: `percorri-dominio.mts`, 8
  fonti registrate). Il `claude` deve essere autenticato sulla macchina che ospita il gateway:
  misurato il 2026-09-12, su gemello e VM la sessione OAuth era scaduta e il gateway rispondeva
  502 `PROPOSE_FAILED`.
- **Distribuito** — **no**: nessuna unit systemd `agent-gateway` sulla VM
  (`ssh oracle-vm-default 'systemctl list-units --all | grep -i gateway'` mostra solo
  `heuresys-api-gateway`, che e' del legacy). Si accende a mano, dove serve, per la durata di una
  prova o di una corsa. Nulla qui muta heuresys senza passare dal cancello di scrittura e
  dall'approvazione umana.
