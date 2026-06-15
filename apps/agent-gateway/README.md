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

## Status (mock-first slice, 2026-06-15)
Core gate + client are unit-tested with mocks (zero install of a live SDK / no live
heuresys). The SDK wiring (`mcp-tools`/`sdk-agent`) is the regime skeleton. **Residual
(WI-B.2)**: HTTP/SSE bridge + approval round-trip, `compliance-guard`/`hr-verifier`
integration, live `/v1` smoke, adversarial `canUseTool` matrix (full M-2), rate-limit
post-D-28. Nothing here mutates heuresys; nothing is deployed.
