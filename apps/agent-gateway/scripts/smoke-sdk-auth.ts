/**
 * SDK auth smoke (#9 §A.1). Confirms the Agent SDK query() authenticates via the
 * machine's logged-in Claude credentials (subscription) when no ANTHROPIC_API_KEY
 * is forced in the process env. Minimal: no tools, no plugin discovery.
 *
 * Run with the key UNSET:
 *   Remove-Item Env:\ANTHROPIC_API_KEY; pnpm exec tsx scripts/smoke-sdk-auth.ts
 */
import { query } from "@anthropic-ai/claude-agent-sdk";

const it = query({
  prompt: "Reply with exactly one word: PONG",
  options: { allowedTools: [], settingSources: [] },
});

for await (const ev of it) {
  const t = (ev as { type?: string }).type;
  if (t === "assistant") {
    const msg = (ev as { message?: { content?: Array<{ type: string; text?: string }> } }).message;
    const text = msg?.content?.filter((c) => c.type === "text").map((c) => c.text).join("");
    if (text) console.log("[assistant]", text.slice(0, 120));
  }
  if (t === "result") {
    const r = ev as { is_error?: boolean; api_error_status?: number; result?: string };
    console.log(`[result] is_error=${r.is_error} api_status=${r.api_error_status ?? "-"} result=${JSON.stringify(r.result)?.slice(0, 160)}`);
  }
}
