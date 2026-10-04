/**
 * The one call every agent in this example shares: ask Unl what bears on this agent's task.
 *
 * POST https://api.unlimitless.ai/api/ask with the task, the agent's own name for itself (`surface`)
 * and its model (`receiver_model`), so Unl can shape what it hands over for that agent. The answer's
 * `operating_posture` is a text block: the decisions that bear, each with its reason. It is the
 * TypeScript twin of ../unl_ask.py. One HTTP call, no model call on your bill. If Unl cannot be
 * reached, it returns "" and the agent carries on without it.
 */

const BASE = (process.env.UNL_BASE_URL ?? "https://api.unlimitless.ai").replace(/\/+$/, "");

/** The names Unl knows an agent by. Anything else is still served, and counted as unclassified. */
export type AgentSurface = "claude-code" | "cursor" | "copilot" | "gemini-cli" | "opencode" | "cline";

export type WhatBears = { agent: string; surface: AgentSurface; model: string; task: string; why: string };

export async function whatBears(agent: string, surface: AgentSurface, model: string, task: string): Promise<WhatBears> {
  const key = process.env.UNL_KEY;
  const none = { agent, surface, model, task, why: "" };
  if (!key || !task.trim()) return none;
  try {
    const res = await fetch(`${BASE}/api/ask`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "user-agent": "unl-mastra-example/0.1" },
      body: JSON.stringify({ query: task, surface, ...(model ? { receiver_model: model } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { operating_posture?: string };
    return { ...none, why: body.operating_posture ?? "" };
  } catch (err) {
    // Fail open: never stop the agent because Unl did.
    console.log(`[unl] ${agent} carries on without Unl: ${(err as Error).message}`);
    return none;
  }
}

/**
 * Unl's own tools over MCP, for an agent that wants the full reasoning behind a decision, or to report
 * what it did. Both SDKs in this example take an HTTP MCP server in exactly this shape.
 */
export function unlMcp(): { type: "http"; url: string; headers: Record<string, string> } {
  return { type: "http", url: `${BASE}/mcp`, headers: { Authorization: `Bearer ${process.env.UNL_KEY ?? ""}` } };
}

/** The decisions a window carries, by title, so two agents' windows can be compared side by side. */
export function decisionTitles(why: string): string[] {
  return [...why.matchAll(/^\[(\d+)\] (.+?)(?= \(canonical| — why:| — open:| — held back:|$)/gm)].map((m) => m[2].trim());
}
