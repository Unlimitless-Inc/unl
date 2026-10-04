/**
 * Unl in a TanStack AI chat: the person's why reaches the model as a system prompt on every chat, and
 * Unl's MCP tools let the agent read the full reasoning and propose new decisions.
 *
 *   npm install @tanstack/ai @tanstack/ai-openai @tanstack/ai-mcp @modelcontextprotocol/sdk @unlimitless/ai-sdk
 *   export UNL_KEY=...          # https://unlimitless.ai/portal/keys
 *   export OPENAI_API_KEY=...   # your agent's own model
 */
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { createMCPClient } from "@tanstack/ai-mcp";
import { serve } from "@unlimitless/ai-sdk";

export async function POST(request: Request): Promise<Response> {
  const { messages } = (await request.json()) as { messages: Array<{ role: string; content: string }> };
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  // Fetch the why first: one HTTP call, no model call. If Unl cannot be reached, chat goes on without it.
  const why = await serve(lastUser).then((s) => s.context).catch(() => "");

  const unl = await createMCPClient({
    transport: { type: "http", url: "https://api.unlimitless.ai/mcp", headers: { Authorization: `Bearer ${process.env.UNL_KEY}` } },
  });

  const stream = chat({
    adapter: openaiText("gpt-5.5"),
    messages: messages as any,
    systemPrompts: why ? [why] : [],
    mcp: { clients: [unl] },
  });
  return toServerSentEventsResponse(stream);
}
